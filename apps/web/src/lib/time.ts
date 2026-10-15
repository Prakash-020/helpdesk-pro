/** "3m ago" / "due in 2h" style human timestamps. */
export function timeAgo(iso: string | Date): string {
  const then = typeof iso === 'string' ? new Date(iso) : iso;
  const s = Math.max(0, (Date.now() - then.getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m ago`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = h / 24;
  if (d < 30) return `${Math.floor(d)}d ago`;
  return then.toLocaleDateString();
}

/** Human-readable countdown for SLA due dates. */
export function dueIn(iso: string | null): { label: string; overdue: boolean } | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  const overdue = ms < 0;
  const abs = Math.abs(ms);
  const h = abs / 3_600_000;
  const label =
    h >= 48 ? `${Math.round(h / 24)}d` : h >= 1 ? `${Math.round(h)}h` : `${Math.max(1, Math.round(abs / 60_000))}m`;
  return { label: overdue ? `${label} overdue` : `due in ${label}`, overdue };
}
