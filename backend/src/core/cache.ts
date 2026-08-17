import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export function stableCacheKey(namespace: string, value: unknown): string {
  const canonical = JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
    : item);
  return namespace + ':' + createHash('sha256').update(canonical).digest('hex');
}

export class FileCache {
  constructor(private readonly root: string) {}
  private path(key: string): string { return join(this.root, key.replace(/[^a-zA-Z0-9_.:-]/g, '_') + '.json'); }
  async get<T>(key: string): Promise<T | null> {
    try { return JSON.parse(await readFile(this.path(key), 'utf8')) as T; }
    catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  }
  async set<T>(key: string, value: T): Promise<void> {
    const path = this.path(key); await mkdir(dirname(path), { recursive: true });
    const temp = path + '.tmp-' + process.pid + '-' + Date.now();
    await writeFile(temp, JSON.stringify(value, null, 2), 'utf8');
    await rename(temp, path);
  }
}
