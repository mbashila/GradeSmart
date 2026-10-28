// Pure helpers for the local scan list (kept separate so they can be unit-tested).

/** Insert a scan, or replace the existing one with the same id (idempotent save / retry). */
export function upsertScan(list, scan) {
  const arr = Array.isArray(list) ? list : [];
  const idx = arr.findIndex(s => s.id === scan.id);
  if (idx < 0) return [...arr, scan];
  const next = [...arr];
  next[idx] = { ...arr[idx], ...scan, createdAt: arr[idx].createdAt || scan.createdAt };
  return next;
}
