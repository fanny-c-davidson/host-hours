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

export function formatDuration(secs: number): string {
  if (secs < 3600) return `${Math.max(1, Math.ceil(secs / 60))}m`;
  return `${(secs / 3600).toFixed(1)}h`;
}

export function formatDurationLong(secs: number): string {
  const mins = Math.max(1, Math.round(secs / 60));
  if (mins < 60) return `${mins} min`;
  return `${(secs / 3600).toFixed(1)} hours`;
}

export function formatDayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const entryDate = new Date(date);
  entryDate.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - entryDate.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "short" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ---------------------------------------------------------------------------
// Log grouping — same task + property + day → one group
// ---------------------------------------------------------------------------
export type GroupableLog = {
  id: string;
  title: string;
  started_at: string;
  ended_at: string;
  duration_secs: number;
  description: string | null;
  is_onsite: boolean;
  property_id: string;
  propertyName: string | null;
};

export type LogGroup = {
  key: string;
  title: string;
  propertyName: string | null;
  totalSecs: number;
  isOnsite: boolean;
  description: string | null;
  entries: GroupableLog[];
  latestStartedAt: string;
};

export function groupLogs(logs: GroupableLog[]): LogGroup[] {
  const map = new Map<string, LogGroup>();
  for (const log of logs) {
    const d = new Date(log.started_at);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const key = `${log.title}__${dateKey}__${log.property_id}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        title: log.title,
        propertyName: log.propertyName,
        totalSecs: 0,
        isOnsite: log.is_onsite,
        description: log.description,
        entries: [],
        latestStartedAt: log.started_at,
      };
      map.set(key, g);
    }
    g.entries.push(log);
    g.totalSecs += log.duration_secs;
    if (log.started_at > g.latestStartedAt) g.latestStartedAt = log.started_at;
  }
  const groups = Array.from(map.values());
  for (const g of groups) {
    g.entries.sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
    const rep = g.entries[0];
    g.isOnsite = rep.is_onsite;
    g.description = rep.description;
    g.propertyName = rep.propertyName ?? g.propertyName;
  }
  groups.sort((a, b) => (a.latestStartedAt < b.latestStartedAt ? 1 : -1));
  return groups;
}

/** "SATURDAY · JUNE 13" style masthead date. */
export function mastheadDate(date = new Date()): string {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const month = date.toLocaleDateString("en-US", { month: "long" }).toUpperCase();
  const day = date.getDate();
  return `${weekday} · ${month} ${day}`;
}
