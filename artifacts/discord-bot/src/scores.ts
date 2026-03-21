import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const SCORES_FILE = join(DATA_DIR, "scores.json");

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

export function incrementScore(userId: string): number {
  ensureDataDir();
  const scores = loadScores();
  scores[userId] = (scores[userId] ?? 0) + 1;
  writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 2), "utf-8");
  return scores[userId]!;
}

export function getTopScores(limit = 10): Array<{ userId: string; score: number }> {
  const scores = loadScores();
  return Object.entries(scores)
    .map(([userId, score]) => ({ userId, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
