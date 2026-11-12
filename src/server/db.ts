/**
 * Tiny JSON document store on the local filesystem (server only).
 * Documents live under DATA_DIR (default: ./.data). Writes are atomic
 * (write temp file + rename) and serialized per document.
 *
 * Swap this module for a real database when you deploy to a host without a
 * persistent disk. The rest of the server only uses get/put/update/remove.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.env["DATA_DIR"] ?? ".data");
const locks = new Map<string, Promise<unknown>>();

function file(collection: string, id: string) {
  const safe = id.replace(/[^a-zA-Z0-9_.@-]/g, "_");
  return path.join(ROOT, collection, `${safe}.json`);
}

export async function get<T>(collection: string, id: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file(collection, id), "utf8")) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

async function write(collection: string, id: string, data: unknown) {
  const f = file(collection, id);
  await fs.mkdir(path.dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data));
  await fs.rename(tmp, f);
}

/** Read-modify-write a document under a per-document lock. */
export function update<T>(
  collection: string,
  id: string,
  fn: (current: T | null) => T | Promise<T>,
): Promise<T> {
  const k = `${collection}/${id}`;
  const prev = locks.get(k) ?? Promise.resolve();
  const next = prev
    .catch(() => undefined)
    .then(async () => {
      const out = await fn(await get<T>(collection, id));
      await write(collection, id, out);
      return out;
    });
  locks.set(k, next);
  void next.finally(() => {
    if (locks.get(k) === next) locks.delete(k);
  });
  return next;
}

export function put<T>(collection: string, id: string, data: T) {
  return update<T>(collection, id, () => data);
}

export async function remove(collection: string, id: string) {
  await fs.rm(file(collection, id), { force: true });
}
