import crypto from "crypto";

interface CacheEntry {
  value: string;
  expiresAt: number;
}

export class QueryCache {
  private store = new Map<string, CacheEntry>();
  private defaultTtl: number;

  constructor(defaultTtl = 1800) {
    this.defaultTtl = defaultTtl; // 30 min
  }

  private key(sql: string): string {
    const normalized = sql.toLowerCase().replace(/\s+/g, " ").trim();
    return crypto.createHash("sha256").update(normalized).digest("hex");
  }

  get(sql: string): string | null {
    const k = this.key(sql);
    const entry = this.store.get(k);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(k);
      return null;
    }
    return entry.value;
  }

  set(sql: string, result: string, ttl?: number): void {
    const k = this.key(sql);
    this.store.set(k, {
      value: result,
      expiresAt: Date.now() + (ttl || this.defaultTtl) * 1000,
    });
  }

  clear(): void {
    this.store.clear();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [k, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(k);
    }
  }

  get size(): number {
    this.cleanup();
    return this.store.size;
  }
}
