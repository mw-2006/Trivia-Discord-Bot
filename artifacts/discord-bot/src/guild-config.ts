import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const CONFIG_FILE = join(DATA_DIR, "guild-config.json");

export const DEFAULT_THEME =
  "Ice Planet Hockey book series (Heated Rivalry and Common Goal) by Rachel Reid";

export interface GuildConfig {
  channelId: string;
  roleId: string;
  theme: string;
}

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function loadGuildConfigs(): Record<string, GuildConfig> {
  ensureDataDir();
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf-8")) as Record<string, GuildConfig>;
  } catch {
    return {};
  }
}

export function saveGuildConfig(guildId: string, update: Partial<GuildConfig>): void {
  ensureDataDir();
  const configs = loadGuildConfigs();
  configs[guildId] = { ...(configs[guildId] ?? {}), ...update } as GuildConfig;
  writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2), "utf-8");
}

export function getGuildConfig(guildId: string): GuildConfig | null {
  const configs = loadGuildConfigs();
  return configs[guildId] ?? null;
}
