// Groups time-log entries that share a task type + day + property into a single
// "session group", so the UI can show one card per task/day with the combined
// duration and let the user edit each session's time range. Location / notes /
// photos are treated as shared across the group (the representative is the most
// recent session).

export type LogEntry = {
  id: string;
  title: string;
  started_at: string;
  ended_at: string;
  duration_secs: number;
  description: string | null;
  is_onsite: boolean;
  property_id: string;
  property_name?: string | null;
};

export type LogGroup = {
  key: string;
  title: string;
  propertyId: string;
  propertyName: string | null;
  dateKey: string; // local YYYY-MM-DD
  totalSecs: number;
  /** Representative (most-recent session) shared metadata */
  isOnsite: boolean;
  description: string | null;
  /** Most-recent session first */
  entries: LogEntry[];
  latestStartedAt: string;
};

export function localDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Group entries by (title, local date, property). Sorted most-recent first. */
export function groupLogs(logs: LogEntry[]): LogGroup[] {
  const map = new Map<string, LogGroup>();
  for (const log of logs) {
    const dateKey = localDateKey(log.started_at);
    const key = `${log.title}__${dateKey}__${log.property_id}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        title: log.title,
        propertyId: log.property_id,
        propertyName: log.property_name ?? null,
        dateKey,
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
    g.propertyName = rep.property_name ?? g.propertyName;
  }
  groups.sort((a, b) => (a.latestStartedAt < b.latestStartedAt ? 1 : -1));
  return groups;
}

/** Compact duration: "1m" / "48m" / "1.3h" (matches the activity lists). */
export function fmtDuration(secs: number): string {
  return secs < 3600
    ? `${Math.max(1, Math.ceil(secs / 60))}m`
    : `${(secs / 3600).toFixed(1)}h`;
}

/** 24-hour "HH:MM" (local) for time inputs. */
export function toTimeStr(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

/** "h:mm AM/PM" from a 24-hour "HH:MM" string. */
export function toAmPm(timeStr: string): string {
  if (!timeStr || !timeStr.includes(":")) return "--:--";
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}
