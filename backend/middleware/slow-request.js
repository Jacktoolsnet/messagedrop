function parseBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return String(value).trim().toLowerCase() === 'true';
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createMinuteLimiter(maxPerMinute) {
  let windowStartedAt = Date.now();
  let count = 0;
  let dropped = 0;

  return {
    allow() {
      const now = Date.now();
      if (now - windowStartedAt >= 60_000) {
        const previousDropped = dropped;
        windowStartedAt = now;
        count = 0;
        dropped = 0;
        return { allowed: true, droppedLastWindow: previousDropped };
      }

      if (count >= maxPerMinute) {
        dropped += 1;
        return { allowed: false, droppedLastWindow: 0 };
      }

      count += 1;
      return { allowed: true, droppedLastWindow: 0 };
    }
  };
}

function getRoutePattern(req) {
  const routePath = req.route?.path;
  if (!routePath) {
    return req.path || req.originalUrl || req.url || '';
  }

  const routePart = Array.isArray(routePath) ? routePath.join('|') : String(routePath);
  return `${req.baseUrl || ''}${routePart}`;
}

function createSlowRequestMiddleware(options = {}) {
  const enabled = parseBoolean(
    options.enabled ?? process.env.SLOW_REQUEST_LOG_ENABLED,
    true
  );
  const thresholdMs = parsePositiveInt(
    options.thresholdMs ?? process.env.SLOW_REQUEST_THRESHOLD_MS,
    1000
  );
  const maxPerMinute = parsePositiveInt(
    options.maxPerMinute ?? process.env.SLOW_REQUEST_LOG_MAX_PER_MINUTE,
    60
  );
  const limiter = createMinuteLimiter(maxPerMinute);

  return function slowRequestMiddleware(req, res, next) {
    if (!enabled) {
      return next();
    }

    const startedAt = process.hrtime.bigint();
    let logged = false;
    let finished = false;

    const maybeLog = (aborted) => {
      if (logged) {
        return;
      }
      logged = true;

      const durationMs = Number((process.hrtime.bigint() - startedAt) / 1_000_000n);
      if (durationMs < thresholdMs) {
        return;
      }

      const limitDecision = limiter.allow();
      if (!limitDecision.allowed) {
        return;
      }

      const userId = req.jwtUser?.userId ?? req.jwtUser?.id;
      const cacheHeader = res.getHeader('X-Message-Search-Cache');
      const route = getRoutePattern(req);
      const path = req.path || req.originalUrl || req.url;
      const message = `Slow request ${req.method} ${route || path || ''} ${durationMs}ms`.trim();
      req.logger?.warn?.(message, {
        traceId: req.traceId || res.locals?.traceId,
        method: req.method,
        route,
        path,
        status: aborted ? 499 : res.statusCode,
        durationMs,
        thresholdMs,
        aborted,
        userId: userId || undefined,
        messageSearchCache: typeof cacheHeader === 'string' ? cacheHeader : undefined,
        droppedLastWindow: limitDecision.droppedLastWindow || undefined
      });
    };

    res.once('finish', () => {
      finished = true;
      maybeLog(false);
    });

    res.once('close', () => {
      if (!finished) {
        maybeLog(true);
      }
    });

    return next();
  };
}

module.exports = createSlowRequestMiddleware;
