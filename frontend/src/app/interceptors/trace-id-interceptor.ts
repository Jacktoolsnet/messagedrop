import { HttpInterceptorFn } from '@angular/common/http';

const TRACE_HEADER = 'X-Trace-Id';

function generateTraceId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
}

export const traceIdInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.includes('tenor') || req.headers.has(TRACE_HEADER)) {
    return next(req);
  }

  const traceId = generateTraceId();
  const traceReq = req.clone({
    setHeaders: {
      [TRACE_HEADER]: traceId
    }
  });
  return next(traceReq);
};
