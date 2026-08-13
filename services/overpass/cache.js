class BoundedTtlCache {
  constructor({ ttlMs, maxEntries, maxBytes, now = () => Date.now() }) {
    this.ttlMs = positiveNumber(ttlMs, 0);
    this.maxEntries = positiveInteger(maxEntries, 1);
    this.maxBytes = positiveInteger(maxBytes, 1);
    this.now = now;
    this.entries = new Map();
    this.bytes = 0;
    this.metrics = { hits: 0, misses: 0, evictions: 0, rejected: 0 };
  }

  get enabled() {
    return this.ttlMs > 0;
  }

  get(key) {
    if (!this.enabled) {
      this.metrics.misses += 1;
      return undefined;
    }
    const entry = this.entries.get(key);
    if (!entry) {
      this.metrics.misses += 1;
      return undefined;
    }
    if (entry.expiresAt <= this.now()) {
      this.delete(key);
      this.metrics.misses += 1;
      return undefined;
    }
    // Re-insertion makes Map iteration order a simple LRU order.
    this.entries.delete(key);
    this.entries.set(key, entry);
    this.metrics.hits += 1;
    return entry.value;
  }

  set(key, value) {
    if (!this.enabled) return false;
    const bytes = byteLength(value);
    if (bytes > this.maxBytes) {
      this.metrics.rejected += 1;
      return false;
    }
    this.delete(key);
    this.entries.set(key, { value, bytes, expiresAt: this.now() + this.ttlMs });
    this.bytes += bytes;
    this.evictToLimits();
    return this.entries.has(key);
  }

  delete(key) {
    const entry = this.entries.get(key);
    if (!entry) return false;
    this.bytes -= entry.bytes;
    this.entries.delete(key);
    return true;
  }

  evictToLimits() {
    while (this.entries.size > this.maxEntries || this.bytes > this.maxBytes) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) break;
      this.delete(oldestKey);
      this.metrics.evictions += 1;
    }
  }

  snapshot() {
    return {
      enabled: this.enabled,
      entries: this.entries.size,
      bytes: this.bytes,
      maxEntries: this.maxEntries,
      maxBytes: this.maxBytes,
      ttlMs: this.ttlMs,
      ...this.metrics
    };
  }
}

function byteLength(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

module.exports = { BoundedTtlCache, byteLength };
