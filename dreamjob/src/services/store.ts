import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Read and parse a JSON file. Returns null if the file does not exist.
 */
export async function readJSON<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

/**
 * Write data as formatted JSON to a file. Creates parent directories if needed.
 */
export async function writeJSON<T>(filePath: string, data: T): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

/**
 * Read a JSON array file. Returns an empty array if the file does not exist.
 */
export async function readCollection<T>(filePath: string): Promise<T[]> {
  const data = await readJSON<T[]>(filePath);
  return data ?? [];
}

/**
 * Write an array as formatted JSON to a file. Creates parent directories if needed.
 */
export async function writeCollection<T>(
  filePath: string,
  data: T[],
): Promise<void> {
  await writeJSON(filePath, data);
}
