import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const SCORES_FILE = join(DATA_DIR, "scores.json");

export const XP_CORRECT = 10;
export const XP_CORRECT_WITH_HINT = 5;

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadScores(): Record<string, number> {
  ensureDataDir();
  if (!existsSync(SCORES_FILE)) return {};
  try {
    return JSON.parse(readFileSync(SCORES_FILE, "utf-8")) as Record<string, number>;
  } catch {
    return {};
  }
}

export function addXP(userId: string, amount: number): number {
  ensureDataDir();
  const scores = loadScores();
  scores[userId] = (scores[userId] ?? 0) + amount;
  writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 2), "utf-8");
  return scores[userId]!;
}

export function getTopScores(limit = 10): Array<{ userId: string; xp: number }> {
  const scores = loadScores();
  return Object.entries(scores)
    .map(([userId, xp]) => ({ userId, xp }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit);
}
