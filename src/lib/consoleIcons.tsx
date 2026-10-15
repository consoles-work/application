import {
  Server, Terminal, Database, Globe, Cloud, Monitor, Laptop, Container, Box, Cpu,
  HardDrive, Network, Router, Shield, Lock, Rocket, Bug, FlaskConical, Mail, Code,
  GitBranch, Bot, Activity, ShoppingCart, Gamepad2, Home, Zap, Flame, Star,
  type LucideIcon,
} from "lucide-react";
import type { ConsoleConfig } from "../types";
import { quickCommandHex } from "./quickCommandColors";

// Иконки консолей. В БД хранится ключ (`consoles.icon`), не имя компонента:
// переименование иконок в lucide не ломает сохранённые данные.
export const CONSOLE_ICONS: { id: string; Icon: LucideIcon }[] = [
  { id: "server", Icon: Server },
  { id: "terminal", Icon: Terminal },
  { id: "database", Icon: Database },
  { id: "globe", Icon: Globe },
  { id: "cloud", Icon: Cloud },
  { id: "monitor", Icon: Monitor },
  { id: "laptop", Icon: Laptop },
  { id: "container", Icon: Container },
  { id: "box", Icon: Box },
  { id: "cpu", Icon: Cpu },
  { id: "hdd", Icon: HardDrive },
  { id: "network", Icon: Network },
  { id: "router", Icon: Router },
  { id: "shield", Icon: Shield },
  { id: "lock", Icon: Lock },
  { id: "rocket", Icon: Rocket },
  { id: "bug", Icon: Bug },
  { id: "flask", Icon: FlaskConical },
  { id: "mail", Icon: Mail },
  { id: "code", Icon: Code },
  { id: "git", Icon: GitBranch },
  { id: "bot", Icon: Bot },
  { id: "activity", Icon: Activity },
  { id: "shop", Icon: ShoppingCart },
  { id: "game", Icon: Gamepad2 },
  { id: "home", Icon: Home },
  { id: "zap", Icon: Zap },
  { id: "flame", Icon: Flame },
  { id: "star", Icon: Star },
];

/** Иконка консоли: выбранная, иначе по типу подключения (SSH — сервер, local — терминал) */
export function consoleIcon(con: Pick<ConsoleConfig, "icon" | "connectionType">): LucideIcon {
  const chosen = con.icon ? CONSOLE_ICONS.find((i) => i.id === con.icon) : undefined;
  if (chosen) return chosen.Icon;
  return con.connectionType === "ssh" ? Server : Terminal;
}

/** Иконка консоли с её цветом; без цвета — приглушённая, как раньше выглядело дерево */
export function ConsoleIcon({
  con,
  size = 13,
}: {
  con: Pick<ConsoleConfig, "icon" | "color" | "connectionType">;
  size?: number;
}) {
  const Icon = consoleIcon(con);
  const hex = quickCommandHex(con.color);
  return (
    <Icon
      size={size}
      className={`shrink-0 ${hex ? "" : "text-text-muted"}`}
      style={hex ? { color: hex } : undefined}
    />
  );
}

/**
 * Иконка консоли в квадратной плашке — для дерева. Фон и рамка подкрашены цветом
 * консоли; без цвета — нейтральная плашка. Тип подключения — в подсказке.
 */
export function ConsoleIconTile({
  con,
}: {
  con: Pick<ConsoleConfig, "icon" | "color" | "connectionType" | "sshUser" | "sshHost">;
}) {
  const Icon = consoleIcon(con);
  const hex = quickCommandHex(con.color);
  const title = con.connectionType === "ssh"
    ? `SSH${con.sshHost ? ` · ${con.sshUser ? `${con.sshUser}@` : ""}${con.sshHost}` : ""}`
    : "Local";
  return (
    <span
      title={title}
      className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center border ${
        hex ? "" : "bg-surface-3 border-border text-text-secondary"
      }`}
      // #RRGGBB + альфа: фон ~15%, рамка ~30%
      style={hex ? { color: hex, backgroundColor: `${hex}26`, borderColor: `${hex}4d` } : undefined}
    >
      <Icon size={16} />
    </span>
  );
}
