// Tracks market-data requests that are taking unusually long, which on the free hosting plan almost
// always means the stock API is waking from sleep. Components subscribe via useSyncExternalStore.
let slowRequests = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeWakeStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getWakeStatusSnapshot(): boolean {
  return slowRequests > 0;
}

export function getWakeStatusServerSnapshot(): boolean {
  return false;
}

const SLOW_AFTER_MS = 4_000;

// Wraps a request: if it is still pending after SLOW_AFTER_MS it counts as "slow" until it settles.
export async function trackSlowRequest<T>(run: () => Promise<T>): Promise<T> {
  let counted = false;
  const timer = setTimeout(() => {
    counted = true;
    slowRequests += 1;
    emit();
  }, SLOW_AFTER_MS);

  try {
    return await run();
  } finally {
    clearTimeout(timer);
    if (counted) {
      slowRequests -= 1;
      emit();
    }
  }
}
