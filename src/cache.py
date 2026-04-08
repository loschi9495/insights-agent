import hashlib
import time


class QueryCache:
    """Cache in-memory com TTL para resultados de queries BigQuery."""

    def __init__(self, default_ttl: int = 1800):
        self._store: dict[str, tuple[str, float]] = {}
        self._default_ttl = default_ttl  # 30 min

    def _key(self, sql: str) -> str:
        normalized = " ".join(sql.lower().split())
        return hashlib.sha256(normalized.encode()).hexdigest()

    def get(self, sql: str) -> str | None:
        key = self._key(sql)
        if key not in self._store:
            return None
        value, expires_at = self._store[key]
        if time.time() > expires_at:
            del self._store[key]
            return None
        return value

    def set(self, sql: str, result: str, ttl: int | None = None):
        key = self._key(sql)
        expires_at = time.time() + (ttl or self._default_ttl)
        self._store[key] = (result, expires_at)

    def clear(self):
        self._store.clear()

    def cleanup(self):
        """Remove entradas expiradas."""
        now = time.time()
        expired = [k for k, (_, exp) in self._store.items() if now > exp]
        for k in expired:
            del self._store[k]

    @property
    def size(self) -> int:
        self.cleanup()
        return len(self._store)
