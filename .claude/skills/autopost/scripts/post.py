#!/usr/bin/env python3
"""Публикация в Telegram-канал проекта через сервис koval-autopost.

Только стандартная библиотека — скрипт работает в любом проекте без
установки зависимостей. Настройки — переменные окружения или файл
``config.env`` рядом с SKILL.md (окружение важнее):

    AUTOPOST_URL=https://autopost.selll.ru
    AUTOPOST_PROJECT=news
    AUTOPOST_KEY=kap_…

Команды:
    post.py check                        видит ли сервис канал, может ли бот публиковать
    post.py send --text-file post.md [--image a.png --image https://…/b.jpg]
                 [--format markdown|html|text] [--silent] [--no-preview]
                 [--at 2026-11-20T09:00+03:00 | --at 2h] [--dry-run]
    post.py send --text "Коротко"        текст прямо в команде
    post.py status ID                    состояние поста и ссылка
    post.py delete ID                    отменить или удалить из канала
    post.py list [--limit N]             последние посты проекта

send:
  1. Текст (из --text, --text-file или stdin) и картинки (файлы — base64,
     ссылки — как есть) собираются в запрос.
  2. Запрос уходит с ``client_ref`` и ожиданием исхода: обрыв связи —
     повтор с тем же ``client_ref``, второй пост сервис не заведёт.
  3. Итог: ссылка на пост, «запланирован на …» или ошибка с кодом.
Код выхода: 0 — опубликован или запланирован, 1 — ошибка, 2 — ещё в
очереди (повторы после сбоя Telegram; проверить позже командой status).
"""

import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from typing import Any

SKILL_DIR = Path(__file__).resolve().parent.parent
CONFIG_FILE = SKILL_DIR / "config.env"
PLACEHOLDER = "ЗАМЕНИТЬ"
#: Сколько ждать публикации в одном запросе (сервис держит соединение).
WAIT_SECS = 45
#: Повторы запроса при обрыве связи — с тем же client_ref.
RETRIES = 3


def main() -> int:
    args = parse_args()
    config = load_config()

    if args.command == "send" and args.dry_run:
        body = build_body(args)
        shown = {**body, "images": [_short(i) for i in body["images"]]}

        print(json.dumps(shown, ensure_ascii=False, indent=2))

        return 0

    problem = config_problem(config)

    if problem:
        print(f"ошибка настройки: {problem}", file=sys.stderr)

        return 1

    api = Api(config)
    project = args.project or config["AUTOPOST_PROJECT"]

    try:
        return run(api, project, args)
    except ApiFailure as exc:
        print(f"ошибка: {exc}", file=sys.stderr)

        return 1


def run(api: "Api", project: str, args: argparse.Namespace) -> int:
    if args.command == "check":
        info = api.call("GET", f"/projects/{project}?check=true")

        return report_project(info)

    if args.command == "status":
        return report_post(api.call("GET", f"/posts/{args.id}"))

    if args.command == "delete":
        return report_post(api.call("DELETE", f"/posts/{args.id}"))

    if args.command == "list":
        page = api.call("GET", f"/projects/{project}/posts?limit={args.limit}")

        for post in page["items"]:
            first = (post["text"] or "").strip().split("\n")[0][:70]

            print(f"{post['id']}  {post['status']:9}  {post['link'] or '—':40}  {first}")

        return 0

    # send: 1. Запрос.
    body = build_body(args)

    # 2. Отправка с ожиданием исхода.
    post = api.call("POST", f"/projects/{project}/posts?wait={WAIT_SECS}", body)

    # 3. Итог.
    return report_post(post)


def build_body(args: argparse.Namespace) -> dict[str, Any]:
    """send, шаг 1: тело запроса из аргументов."""
    text = args.text if args.text is not None else read_text(args.text_file)

    return {
        "text": text,
        **({"format": args.format} if args.format else {}),
        "images": [image_field(source) for source in args.image],
        **({"silent": True} if args.silent else {}),
        **({"link_preview": False} if args.no_preview else {}),
        **({"delay": args.at} if args.at else {}),
        "client_ref": uuid.uuid4().hex,
    }


def read_text(path: str | None) -> str:
    if path is None or path == "-":
        return sys.stdin.read() if not sys.stdin.isatty() else ""

    return Path(path).read_text(encoding="utf-8")


def image_field(source: str) -> dict[str, str]:
    """Картинка: ссылку отдаём как есть (Telegram скачает сам), файл — base64."""
    if source.startswith(("https://", "http://")):
        return {"url": source}

    path = Path(source).expanduser()
    data = base64.b64encode(path.read_bytes()).decode("ascii")

    return {"filename": path.name, "data": data}


def report_post(post: dict[str, Any]) -> int:
    status = post["status"]
    error = post.get("error") or {}

    if status == "sent":
        print(f"опубликован: {post['link'] or 'ссылки нет (канал без адреса)'}")
        print(f"id: {post['id']}")

        return 0

    if status == "scheduled":
        print(f"запланирован на {post['scheduled_at']}, id: {post['id']}")

        return 0

    if status == "queued":
        note = f" (последний сбой: {error.get('message')})" if error else ""

        print(f"в очереди, следующая попытка {post['next_attempt_at']}{note}")
        print(f"проверить позже: post.py status {post['id']}")

        return 2

    if status in ("cancelled", "deleted"):
        print(f"{'отменён' if status == 'cancelled' else 'удалён из канала'}: {post['id']}")

        return 0

    print(f"ошибка публикации [{error.get('kind')}]: {error.get('message')}", file=sys.stderr)
    print(f"id: {post['id']}", file=sys.stderr)

    return 1


def report_project(info: dict[str, Any]) -> int:
    channel = info.get("channel") or {}

    print(f"проект: {info['slug']} — {info['title']}")
    print(f"канал: {channel.get('title') or '—'} {channel.get('link') or ''}".rstrip())
    print(f"бот: {info.get('bot') or '—'}")

    if not info["enabled"]:
        print("проект выключен — посты не принимаются")

        return 1

    if info.get("can_post"):
        print("бот может публиковать — всё готово")

        return 0

    print(f"публиковать нельзя: {info.get('check_error') or 'бот ещё не проверен'}")

    return 1


class ApiFailure(Exception):
    pass


class Api:
    def __init__(self, config: dict[str, str]) -> None:
        self.base = config["AUTOPOST_URL"].rstrip("/") + "/api/v1"
        self.key = config["AUTOPOST_KEY"]

    def call(self, method: str, path: str, body: dict[str, Any] | None = None) -> Any:
        """Запрос к API; обрыв связи — повтор (тело с тем же client_ref)."""
        data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
        request = urllib.request.Request(
            self.base + path,
            data=data,
            method=method,
            headers={
                "Authorization": f"Bearer {self.key}",
                "Content-Type": "application/json",
                "User-Agent": "koval-autopost-skill/1",
            },
        )

        for attempt in range(1, RETRIES + 1):
            try:
                with urllib.request.urlopen(request, timeout=WAIT_SECS + 30) as response:
                    return json.loads(response.read() or b"null")
            except urllib.error.HTTPError as exc:
                raise ApiFailure(_http_error(exc)) from exc
            except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
                if attempt == RETRIES:
                    raise ApiFailure(f"сервис недоступен: {exc}") from exc

                time.sleep(2 * attempt)

        raise ApiFailure("недостижимо")


def _http_error(exc: urllib.error.HTTPError) -> str:
    try:
        error = json.loads(exc.read())["error"]
    except (ValueError, KeyError, TypeError):
        return f"HTTP {exc.code}"

    return f"{error['message']} [{error['code']}, HTTP {exc.code}]"


def load_config() -> dict[str, str]:
    """Файл config.env рядом с SKILL.md, сверху — переменные окружения."""
    config: dict[str, str] = {}

    if CONFIG_FILE.exists():
        for line in CONFIG_FILE.read_text(encoding="utf-8").splitlines():
            name, sep, value = line.strip().partition("=")

            if sep and not name.startswith("#"):
                config[name.strip()] = value.strip().strip("'\"")

    names = ("AUTOPOST_URL", "AUTOPOST_PROJECT", "AUTOPOST_KEY")

    return {**config, **{n: os.environ[n] for n in names if os.environ.get(n)}}


def config_problem(config: dict[str, str]) -> str | None:
    missing = [n for n in ("AUTOPOST_URL", "AUTOPOST_PROJECT", "AUTOPOST_KEY") if not config.get(n)]

    if missing:
        return f"нет {', '.join(missing)} — заполните {CONFIG_FILE}"

    if PLACEHOLDER in config["AUTOPOST_KEY"]:
        return f"в {CONFIG_FILE} ключ-заглушка — впишите ключ из админки (Ключи → Выпустить)"

    return None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Публикация в Telegram через koval-autopost")
    parser.add_argument("--project", help="адрес проекта, если не тот, что в config.env")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("check", help="может ли бот публиковать в канал проекта")

    send = sub.add_parser("send", help="опубликовать пост")
    source = send.add_mutually_exclusive_group()
    source.add_argument("--text", help="текст поста")
    source.add_argument("--text-file", help="файл с текстом («-» — stdin)")
    send.add_argument("--image", action="append", default=[], help="файл или ссылка, до 10")
    send.add_argument("--format", choices=("markdown", "html", "text"))
    send.add_argument("--silent", action="store_true", help="без звука у подписчиков")
    send.add_argument("--no-preview", action="store_true", help="без превью ссылок")
    send.add_argument("--at", help="когда: 2h, 30m или 2026-11-20T09:00+03:00")
    send.add_argument("--dry-run", action="store_true", help="показать запрос, не отправляя")

    status = sub.add_parser("status", help="состояние поста")
    status.add_argument("id")

    delete = sub.add_parser("delete", help="отменить или удалить из канала")
    delete.add_argument("id")

    listing = sub.add_parser("list", help="последние посты")
    listing.add_argument("--limit", type=int, default=10)

    return parser.parse_args()


def _short(image: dict[str, str]) -> dict[str, str]:
    """Для --dry-run: base64 картинки не печатать целиком."""
    if "data" not in image:
        return image

    return {**image, "data": f"<{len(image['data'])} символов base64>"}


if __name__ == "__main__":
    sys.exit(main())
