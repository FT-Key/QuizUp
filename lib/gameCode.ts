import { Game } from "@/models/Game";

export function generateGameCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function getUniqueGameCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateGameCode();
    const exists = await Game.findOne({ gameCode: code }).lean();
    if (!exists) return code;
  }
  throw new Error("Failed to generate unique game code after 10 attempts");
}
