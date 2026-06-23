export function hoursFromSeconds(secs: number): number {
  return secs / 3600;
}

/** "12.5" style hours for KPIs. */
export function formatHours(secs: number): string {
  return (secs / 3600).toFixed(1);
}

/** "HH:MM:SS" running clock for the live timer. */
export function formatElapsed(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** "Sep 12" style short date. */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
