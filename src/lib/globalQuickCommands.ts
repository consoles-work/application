import type { TFunction } from "i18next";
import type { QuickCommand, QuickCommandColor } from "../types";

// ══════════════════════════════════════
// Глобальные быстрые команды
// ══════════════════════════════════════
// Общие для всех консолей: отдельная панель под любым терминалом, правятся
// в «Настройки → Быстрые команды». Хранятся списком в одной настройке; в
// .dchub — отдельным разделом, при импорте сливаются с текущими без дублей.
//
// Пока список ни разу не сохранялся, показывается стандартный набор на языке
// интерфейса. Первое изменение (правка, запуск со счётчиком) сохраняет список
// целиком — дальше он живёт сам по себе, смена языка его уже не переводит.
// «Вернуть стандартные» добавляет в конец только те команды набора, которых
// в списке нет (по id); свои и изменённые команды не трогаются.
// Экспорт и импорт .dchub читают список из БД, а стандартного набора бэкенд не
// знает — перед ними несохранённый список сохраняется таким, каким его видно.

export const GLOBAL_QUICK_KEY = "quickCommands.global";

/** Видимость панели глобальных команд под терминалом */
export const GLOBAL_QUICK_VISIBLE_KEY = "ui.showGlobalQuick";

type DefaultGroup = "ssh" | "system" | "disk" | "network" | "services" | "docker";

interface DefaultCommand {
  /** Ключ перевода подписи и описания; id команды — `std.<key>` */
  key: string;
  group: DefaultGroup;
  command: string;
  color?: QuickCommandColor;
  confirm?: boolean;
}

/** Стандартный набор: подписи и описания — globalQuick.defaults.<key>, группы — globalQuick.groups.<group> */
const DEFAULTS: DefaultCommand[] = [
  { key: "sshAuthKeys", group: "ssh", command: "nano ~/.ssh/authorized_keys" },
  { key: "sshPerms", group: "ssh", command: "chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys" },
  { key: "sshdTest", group: "ssh", command: "sudo sshd -t && echo 'sshd_config OK'" },
  { key: "sshLastLogins", group: "ssh", command: "last -n 20" },

  { key: "sysInfo", group: "system", command: "uname -a && cat /etc/os-release" },
  { key: "sysUptime", group: "system", command: "uptime" },
  { key: "sysMemory", group: "system", command: "free -h" },
  { key: "sysTop", group: "system", command: "htop || top" },
  { key: "sysTopMem", group: "system", command: "ps aux --sort=-%mem | head -n 15" },
  { key: "sysCron", group: "system", command: "crontab -l" },
  { key: "sysUpdate", group: "system", command: "sudo apt update && sudo apt upgrade -y", color: "yellow", confirm: true },
  { key: "sysReboot", group: "system", command: "sudo reboot", color: "red", confirm: true },

  { key: "diskFree", group: "disk", command: "df -h" },
  { key: "diskHere", group: "disk", command: "du -h --max-depth=1 . 2>/dev/null | sort -h" },
  { key: "diskJournal", group: "disk", command: "sudo journalctl --vacuum-time=7d", color: "orange", confirm: true },

  { key: "netPorts", group: "network", command: "sudo ss -tulpn" },
  { key: "netIp", group: "network", command: "curl -s ifconfig.me; echo" },
  { key: "netIfaces", group: "network", command: "ip -br a" },
  { key: "netFirewall", group: "network", command: "sudo ufw status verbose" },

  { key: "svcFailed", group: "services", command: "systemctl --failed" },
  { key: "svcRunning", group: "services", command: "systemctl list-units --type=service --state=running --no-pager" },
  { key: "logFollow", group: "services", command: "sudo journalctl -f -n 50" },
  { key: "logKernel", group: "services", command: "sudo dmesg -T | tail -n 30" },

  { key: "dockerPs", group: "docker", command: "docker ps -a" },
  { key: "dockerStats", group: "docker", command: "docker stats --no-stream" },
  { key: "dockerLogs", group: "docker", command: "docker compose logs -f --tail=100" },
  { key: "dockerDf", group: "docker", command: "docker system df" },
];

/** Список из настройки; настройки нет или она битая — стандартный набор */
export function globalQuickCommands(raw: string | undefined, t: TFunction): QuickCommand[] {
  if (!raw) return defaultGlobalQuickCommands(t);

  try {
    const list = JSON.parse(raw);

    return Array.isArray(list) ? list : defaultGlobalQuickCommands(t);
  } catch {
    return defaultGlobalQuickCommands(t);
  }
}

/** Список уже сохранён: настройка есть и это JSON-массив (иначе показывается стандартный набор) */
export function isSavedGlobalQuick(raw: string | undefined): boolean {
  if (!raw) return false;

  try {
    return Array.isArray(JSON.parse(raw));
  } catch {
    return false;
  }
}

/** Стандартные команды, которых в списке нет (по id) — для «Вернуть стандартные» */
export function missingDefaults(commands: QuickCommand[], t: TFunction): QuickCommand[] {
  const ids = new Set(commands.map((c) => c.id));

  return defaultGlobalQuickCommands(t).filter((c) => !ids.has(c.id));
}

/**
 * +1 запуск команды. Символы — по тексту команды, +1 за Enter: та же формула,
 * что у команд консоли в record_quick_command_run (db.rs) и в TerminalPanel.tsx.
 */
export function countRun(commands: QuickCommand[], id: string): QuickCommand[] {
  return commands.map((c) =>
    c.id === id ? { ...c, runCount: (c.runCount ?? 0) + 1, savedChars: (c.savedChars ?? 0) + [...c.command].length + 1 } : c
  );
}

function defaultGlobalQuickCommands(t: TFunction): QuickCommand[] {
  return DEFAULTS.map((d) => ({
    id: `std.${d.key}`,
    label: t(`globalQuick.defaults.${d.key}.label`),
    description: t(`globalQuick.defaults.${d.key}.description`),
    command: d.command,
    group: t(`globalQuick.groups.${d.group}`),
    color: d.color,
    confirm: d.confirm,
  }));
}
