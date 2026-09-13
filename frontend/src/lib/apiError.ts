/**
 * formatApiError — by direct bug report ("Fix error -- object
 * Object],[object Object]"). FastAPI's own 422 validation-error body
 * shapes `detail` as an ARRAY of `{loc, msg, type}` objects, not a
 * string — every other error response (401/403/404/409/500 from a
 * route's own `raise HTTPException(detail="...")`) DOES send a plain
 * string, which is what every `throw new Error(body.detail || ...)`
 * call site in this app was written assuming unconditionally. `new
 * Error(someArray)` silently coerces it via `Array.prototype.toString`
 * — joining each object with a comma, and each object itself stringifies
 * to the literal text "[object Object]" — instead of throwing or
 * showing anything useful. Route every `body.detail` through this
 * first rather than handing it to `new Error()`/a raw string template
 * directly.
 */
export function formatApiError(detail: unknown, fallback: string): string {
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((d) => (d && typeof d === 'object' && 'msg' in d ? String((d as { msg: unknown }).msg) : String(d)))
      .join('; ');
  }
  return fallback;
}
