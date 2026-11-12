/** Abort a request after `ms`, or earlier if the caller's signal aborts, so nothing can hang forever. */
export function timeoutSignal(ms: number, signal?: AbortSignal): AbortSignal {
  const t = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, t]) : t;
}
