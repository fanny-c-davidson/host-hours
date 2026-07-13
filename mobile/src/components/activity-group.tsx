import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { updateTimeLog } from "@/lib/db";
import { formatDayLabel, formatDuration, formatTime, type LogGroup } from "@/lib/format";
import { ReceiptAttach } from "@/components/receipt-attach";
import { colors, fonts, radius, space } from "@/theme/tokens";

// ---------------------------------------------------------------------------
// Activity row (grouped by task + property + day)
// ---------------------------------------------------------------------------
function localDateStr(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function displayAmPm(hhmm: string): string {
  if (!hhmm.includes(":")) return "--:-- --";
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function parseTimeInput(text: string): string | null {
  const c = text.trim().toUpperCase();
  const m12 = c.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const m = parseInt(m12[2], 10);
    if (h < 1 || h > 12 || m > 59) return null;
    if (m12[3] === "AM" && h === 12) h = 0;
    else if (m12[3] === "PM" && h !== 12) h += 12;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const m24 = c.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const m = parseInt(m24[2], 10);
    if (h > 23 || m > 59) return null;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  return null;
}

function TimeRangeBar({ entry, onSave }: { entry: LogGroup["entries"][0]; onSave: (id: string, fields: any) => void }) {
  const [startT, setStartT] = useState(() => {
    const s = toHHMM(entry.started_at), e = toHHMM(entry.ended_at);
    return s <= e ? s : e;
  });
  const [endT, setEndT] = useState(() => {
    const s = toHHMM(entry.started_at), e = toHHMM(entry.ended_at);
    return s <= e ? e : s;
  });
  const [editField, setEditField] = useState<"start" | "end" | null>(null);
  const [buf, setBuf] = useState("");
  const committed = useRef(false);

  useEffect(() => {
    let s = toHHMM(entry.started_at);
    let e = toHHMM(entry.ended_at);
    if (s > e) { const tmp = s; s = e; e = tmp; }
    setStartT(s);
    setEndT(e);
  }, [entry.started_at, entry.ended_at]);

  function commit(field: "start" | "end", raw: string) {
    if (committed.current) return;
    committed.current = true;
    const hhmm = parseTimeInput(raw);
    if (!hhmm) { setEditField(null); return; }
    const dateStr = localDateStr(entry.started_at);
    const st = field === "start" ? hhmm : startT;
    const en = field === "end" ? hhmm : endT;
    setStartT(st);
    setEndT(en);
    const newStart = new Date(`${dateStr}T${st}:00`);
    let newEnd = new Date(`${dateStr}T${en}:00`);
    // An end before the start means the session ran past midnight — roll the
    // end to the next day (matches the web editor) instead of swapping fields.
    if (newEnd.getTime() < newStart.getTime()) {
      newEnd = new Date(newEnd.getTime() + 24 * 60 * 60 * 1000);
    }
    setEditField(null);
    onSave(entry.id, { started_at: newStart.toISOString(), ended_at: newEnd.toISOString() });
  }

  function startEdit(field: "start" | "end") {
    committed.current = false;
    setBuf(displayAmPm(field === "start" ? startT : endT));
    setEditField(field);
  }

  return (
    <View style={{ marginBottom: space(3), marginHorizontal: 6 }}>
      <View style={{ height: 3, backgroundColor: "rgba(74,20,140,0.15)", borderRadius: radius.pill }}>
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(74,20,140,0.7)", borderRadius: radius.pill }} />
        <View style={{ position: "absolute", top: "50%", left: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.plum, borderWidth: 2, borderColor: colors.cream, transform: [{ translateX: -5 }, { translateY: -5 }] }} />
        <View style={{ position: "absolute", top: "50%", right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.plum, borderWidth: 2, borderColor: colors.cream, transform: [{ translateX: 5 }, { translateY: -5 }] }} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: space(2.5) }}>
        {editField === "start" ? (
          <TextInput autoFocus value={buf} onChangeText={setBuf}
            onBlur={() => commit("start", buf)}
            onSubmitEditing={() => commit("start", buf)}
            placeholder="1:30 PM" placeholderTextColor={colors.stone}
            style={{ minWidth: 100, paddingHorizontal: space(2.5), paddingVertical: space(1.5), borderWidth: 1, borderColor: colors.plum, borderRadius: radius.md, fontSize: 13, color: colors.char, backgroundColor: colors.cream }} />
        ) : (
          <Pressable onPress={() => startEdit("start")}
            style={{ flexDirection: "row", alignItems: "center", gap: space(1.5), paddingHorizontal: space(2.5), paddingVertical: space(1.5), borderWidth: 1, borderColor: colors.chalk, borderRadius: radius.md }}>
            <Text style={{ fontSize: 13, color: colors.char }}>{displayAmPm(startT)}</Text>
            <Ionicons name="time-outline" size={14} color={colors.plum} />
          </Pressable>
        )}
        {editField === "end" ? (
          <TextInput autoFocus value={buf} onChangeText={setBuf}
            onBlur={() => commit("end", buf)}
            onSubmitEditing={() => commit("end", buf)}
            placeholder="2:30 PM" placeholderTextColor={colors.stone}
            style={{ minWidth: 100, paddingHorizontal: space(2.5), paddingVertical: space(1.5), borderWidth: 1, borderColor: colors.plum, borderRadius: radius.md, fontSize: 13, color: colors.char, backgroundColor: colors.cream }} />
        ) : (
          <Pressable onPress={() => startEdit("end")}
            style={{ flexDirection: "row", alignItems: "center", gap: space(1.5), paddingHorizontal: space(2.5), paddingVertical: space(1.5), borderWidth: 1, borderColor: colors.chalk, borderRadius: radius.md }}>
            <Text style={{ fontSize: 13, color: colors.char }}>{displayAmPm(endT)}</Text>
            <Ionicons name="time-outline" size={14} color={colors.plum} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function ActivityRow({
  group,
  expanded,
  onToggle,
  onUpdated,
}: {
  group: LogGroup;
  expanded: boolean;
  onToggle: () => void;
  onUpdated: () => void;
}) {
  const rep = group.entries[0];
  const ids = group.entries.map((e) => e.id);
  const [notes, setNotes] = useState(group.description ?? "");
  const [isOnsite, setIsOnsite] = useState(group.isOnsite);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const noteTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  async function runSave(fn: () => Promise<any>) {
    setSaveStatus("saving");
    await fn();
    setSaveStatus("saved");
    onUpdated();
    setTimeout(() => setSaveStatus((s) => (s === "saved" ? null : s) as any), 1500);
  }

  function handleTimeChange(entryId: string, fields: { started_at: string; ended_at: string }) {
    runSave(() => updateTimeLog(entryId, fields));
  }

  function handleNotesChange(text: string) {
    setNotes(text);
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => {
      runSave(async () => {
        for (const id of ids) await updateTimeLog(id, { description: text.trim() || null });
      });
    }, 800);
  }

  function handleOnsiteToggle(onsite: boolean) {
    setIsOnsite(onsite);
    runSave(async () => {
      for (const id of ids) await updateTimeLog(id, { is_onsite: onsite });
    });
  }

  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.chalk }}>
      <Pressable onPress={onToggle} style={{ flexDirection: "row", alignItems: "center", paddingVertical: space(4.5) }}>
        <View style={{ width: 72 }}>
          <Text style={{ fontFamily: fonts.mono, fontSize: 12, fontWeight: "700", color: colors.char, lineHeight: 16 }}>
            {formatDayLabel(rep.started_at)}
          </Text>
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.slate, lineHeight: 16 }}>
            {formatTime(rep.started_at)}
          </Text>
        </View>
        <View style={{ flex: 1, paddingHorizontal: space(3) }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 15, fontWeight: "500", color: colors.char, lineHeight: 20 }} numberOfLines={1}>
            {group.title}
          </Text>
          <Text style={{ fontSize: 12, color: colors.quill, lineHeight: 16 }} numberOfLines={1}>
            {group.propertyName ?? "—"}
            {group.entries.length > 1 ? ` · ${group.entries.length} sessions` : ""}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space(2.5) }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 17, color: colors.plum }}>
            {formatDuration(group.totalSecs)}
          </Text>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.tangerine} />
        </View>
      </Pressable>

      {expanded && (
        <View style={{ paddingBottom: space(4) }}>
          <View style={{ alignItems: "flex-end", height: 16, marginBottom: space(1) }}>
            {saveStatus === "saving" && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <ActivityIndicator size="small" color={colors.slate} />
                <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: colors.slate }}>Saving</Text>
              </View>
            )}
            {saveStatus === "saved" && (
              <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: colors.success }}>✓ Saved</Text>
            )}
          </View>

          {group.entries.map((entry) => (
            <TimeRangeBar key={entry.id} entry={entry} onSave={handleTimeChange} />
          ))}

          <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: colors.quill, fontWeight: "500", marginTop: space(2), marginBottom: space(2) }}>Location</Text>
          <View style={{ flexDirection: "row", gap: space(2) }}>
            <Pressable onPress={() => handleOnsiteToggle(true)} style={{ flex: 1, paddingVertical: space(2.5), borderRadius: radius.md, borderWidth: 1, borderColor: isOnsite ? colors.plum : colors.chalk, backgroundColor: isOnsite ? colors.plum : colors.cream, alignItems: "center" }}>
              <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: isOnsite ? colors.cream : colors.quill, fontWeight: "500" }}>On-site</Text>
            </Pressable>
            <Pressable onPress={() => handleOnsiteToggle(false)} style={{ flex: 1, paddingVertical: space(2.5), borderRadius: radius.md, borderWidth: 1, borderColor: !isOnsite ? colors.plum : colors.chalk, backgroundColor: !isOnsite ? colors.plum : colors.cream, alignItems: "center" }}>
              <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: !isOnsite ? colors.cream : colors.quill, fontWeight: "500" }}>Remote</Text>
            </Pressable>
          </View>

          <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: colors.quill, fontWeight: "500", marginTop: space(4), marginBottom: space(2) }}>Notes</Text>
          <TextInput value={notes} onChangeText={handleNotesChange} placeholder="What did you work on?" placeholderTextColor={colors.stone} multiline
            style={{ minHeight: 60, paddingHorizontal: space(4), paddingVertical: space(3), borderWidth: 1, borderColor: colors.chalk, borderRadius: radius.md, fontSize: 14, color: colors.char, backgroundColor: colors.cream, textAlignVertical: "top" }} />

          <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: colors.quill, fontWeight: "500", marginTop: space(4), marginBottom: space(2) }}>Receipts or photos</Text>
          <ReceiptAttach timeLogIds={ids} />
        </View>
      )}
    </View>
  );
}
