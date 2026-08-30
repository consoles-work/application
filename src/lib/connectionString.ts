// ══════════════════════════════════════════════════════════════════
// connectionString.ts — сборка параметров SSH-подключения
// ══════════════════════════════════════════════════════════════════
//
// Единственное место, где строится ssh-команда. Ею пользуются и
// TerminalPanel (реальное подключение), и кнопка «Копировать» в диалогах —
// так копируемая строка гарантированно совпадает с тем, что выполняется.

import type { ConsoleConfig } from "../types";

/** `user@host` или просто `host`, если пользователь не задан */
export function buildSshTarget(c: Pick<ConsoleConfig, "sshHost" | "sshUser">): string {
  const host = c.sshHost || "";
  const user = c.sshUser || "";
  return user ? `${user}@${host}` : host;
}

/**
 * Готовая ssh-команда — её можно вставить в любой терминал.
 *
 * `accept-new`: автоматически принимаем ключ нового (неизвестного) хоста и
 * добавляем его в known_hosts без интерактивного вопроса. Без этого при первом
 * подключении ssh спрашивает "Are you sure you want to continue connecting?",
 * а с SSH_ASKPASS_REQUIRE=force (когда задан пароль) этот вопрос уходит в
 * askpass-скрипт, получает пароль вместо "yes" и соединение молча обрывается.
 * Если ключ известного хоста изменился — ssh всё равно откажет (защита от MITM).
 */
export function buildSshCommand(
  c: Pick<ConsoleConfig, "sshHost" | "sshPort" | "sshUser" | "sshKeyPath" | "sshExtraArgs">
): string {
  const port = c.sshPort || 22;
  const keyPath = c.sshKeyPath || "";
  const extraArgs = c.sshExtraArgs || "";

  let cmd = "ssh -o StrictHostKeyChecking=accept-new";
  if (port !== 22) cmd += ` -p ${port}`;
  if (keyPath) cmd += ` -i "${keyPath}"`;
  if (extraArgs) cmd += ` ${extraArgs}`;
  cmd += ` ${buildSshTarget(c)}`;
  return cmd;
}

/**
 * Построчный список параметров — когда нужно перенести настройки руками
 * или переслать их коллеге.
 *
 * Пароль и passphrase сюда НЕ попадают: секреты в буфере обмена оседают
 * в истории clipboard-менеджеров и в общем буфере системы.
 */
export function buildSshParamList(c: ConsoleConfig): string {
  const lines = [
    `Name:   ${c.name}`,
    `ID:     ${c.id}`,
    `Host:   ${c.sshHost || "—"}`,
    `Port:   ${c.sshPort || 22}`,
    `User:   ${c.sshUser || "—"}`,
  ];
  if (c.sshKeyPath) lines.push(`Key:    ${c.sshKeyPath}`);
  if (c.sshExtraArgs) lines.push(`Args:   ${c.sshExtraArgs}`);
  lines.push(`Cmd:    ${buildSshCommand(c)}`);
  return lines.join("\n");
}

/** Форматы, доступные в меню кнопки «Копировать» */
export type ConnectionCopyFormat = "command" | "target" | "params";

export function buildConnectionString(
  c: ConsoleConfig,
  format: ConnectionCopyFormat
): string {
  switch (format) {
    case "target": {
      const port = c.sshPort || 22;
      return port !== 22 ? `${buildSshTarget(c)}:${port}` : buildSshTarget(c);
    }
    case "params":
      return buildSshParamList(c);
    case "command":
    default:
      return buildSshCommand(c);
  }
}
