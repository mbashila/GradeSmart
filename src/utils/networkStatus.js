// App-wide connectivity signal fed by the Supabase fetch wrapper, so the UI can
// show an offline indicator without a native NetInfo dependency.
let online = true;
const listeners = new Set();

function set(next) {
  if (online === next) return;
  online = next;
  listeners.forEach((fn) => fn(online));
}

export function reportNetworkFailure() { set(false); }
export function reportNetworkSuccess() { set(true); }
export function isOnline() { return online; }

export function subscribeNetworkStatus(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
