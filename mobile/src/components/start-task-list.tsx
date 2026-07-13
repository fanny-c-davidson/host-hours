import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import {
  createTaskType,
  deleteTaskType,
  renameTaskType,
  swapTaskTypeOrder,
  type TaskType,
} from "@/lib/db";
import { colors, fonts, radius, space } from "@/theme/tokens";

const CREAM_60 = "rgba(251, 248, 241, 0.6)";
const CREAM_70 = "rgba(251, 248, 241, 0.7)";
const CREAM_10 = "rgba(251, 248, 241, 0.1)";
const CREAM_15 = "rgba(251, 248, 241, 0.15)";
const CREAM_20 = "rgba(251, 248, 241, 0.2)";
const CREAM_25 = "rgba(251, 248, 241, 0.25)";
const CREAM_40 = "rgba(251, 248, 241, 0.4)";

// Stopwatch icon from the web StartTaskList header.
function StopwatchIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={16} height={16}>
      <Line x1={10} x2={14} y1={2} y2={2} stroke={CREAM_70} strokeWidth={1.75} strokeLinecap="round" />
      <Line x1={12} x2={15} y1={14} y2={11} stroke={CREAM_70} strokeWidth={1.75} strokeLinecap="round" />
      <Circle cx={12} cy={14} r={8} stroke={CREAM_70} strokeWidth={1.75} fill="none" />
    </Svg>
  );
}

/**
 * The "Start a task" task-type list for the plum card — selectable pills plus
 * inline management (add, rename, delete, reorder). Port of the web
 * src/components/start-task-list.tsx.
 */
export function StartTaskList({
  taskTypes,
  userId,
  onSelect,
  onChanged,
  disabled = false,
}: {
  taskTypes: TaskType[];
  userId: string;
  onSelect: (name: string) => void;
  onChanged: () => void;
  disabled?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState(false);
  const [editNames, setEditNames] = useState<Record<string, string>>({});

  async function addType() {
    const name = newName.trim();
    if (!name) return;
    await createTaskType(userId, name, taskTypes.length > 0 ? Math.max(...taskTypes.map((t) => t.sort_order)) + 1 : 0);
    setNewName("");
    setAdding(false);
    onChanged();
  }

  async function commitRename(t: TaskType) {
    const name = (editNames[t.id] ?? "").trim();
    if (!name || name === t.name) return;
    await renameTaskType(t.id, name);
    onChanged();
  }

  async function handleDelete(id: string) {
    await deleteTaskType(id);
    onChanged();
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= taskTypes.length) return;
    await swapTaskTypeOrder(taskTypes[index], taskTypes[target]);
    onChanged();
  }

  return (
    <View>
      {/* Header: stopwatch + START A TASK + Edit list */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space(3) }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
          <StopwatchIcon />
          <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: CREAM_60, fontWeight: "500" }}>
            Start a task
          </Text>
        </View>
        <Pressable
          onPress={() => {
            setEditing((v) => !v);
            setAdding(false);
          }}
          hitSlop={8}
        >
          <Text
            style={{
              fontFamily: fonts.mono,
              fontSize: 10,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: CREAM_70,
              textDecorationLine: "underline",
              textDecorationColor: colors.tangerine,
            }}
          >
            {editing ? "Done" : "Edit list"}
          </Text>
        </Pressable>
      </View>

      {editing ? (
        <View style={{ gap: space(2) }}>
          {taskTypes.map((t, i) => (
            <View key={t.id} style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
              <Pressable
                onPress={() => move(i, -1)}
                disabled={i === 0}
                style={{ width: 32, height: 32, borderRadius: radius.sm, backgroundColor: CREAM_10, alignItems: "center", justifyContent: "center", opacity: i === 0 ? 0.3 : 1 }}
              >
                <Text style={{ color: CREAM_70, fontSize: 14 }}>↑</Text>
              </Pressable>
              <Pressable
                onPress={() => move(i, 1)}
                disabled={i === taskTypes.length - 1}
                style={{ width: 32, height: 32, borderRadius: radius.sm, backgroundColor: CREAM_10, alignItems: "center", justifyContent: "center", opacity: i === taskTypes.length - 1 ? 0.3 : 1 }}
              >
                <Text style={{ color: CREAM_70, fontSize: 14 }}>↓</Text>
              </Pressable>
              <TextInput
                defaultValue={t.name}
                onChangeText={(v) => setEditNames((prev) => ({ ...prev, [t.id]: v }))}
                onBlur={() => commitRename(t)}
                style={{ flex: 1, minHeight: 36, paddingHorizontal: space(3), borderRadius: radius.sm, backgroundColor: CREAM_10, borderWidth: 1, borderColor: CREAM_25, color: colors.cream, fontSize: 14 }}
              />
              <Pressable
                onPress={() => handleDelete(t.id)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.tangerine, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ color: colors.cream, fontSize: 16, lineHeight: 18 }}>×</Text>
              </Pressable>
            </View>
          ))}
          {taskTypes.length === 0 && (
            <Text style={{ fontSize: 13, color: CREAM_60 }}>No task types yet.</Text>
          )}
        </View>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(2), alignItems: "center" }}>
          {taskTypes.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => onSelect(t.name)}
              disabled={disabled}
              style={{
                minHeight: 36,
                paddingHorizontal: space(4),
                paddingVertical: space(2),
                borderRadius: radius.pill,
                backgroundColor: CREAM_15,
                borderWidth: 1,
                borderColor: CREAM_20,
                opacity: disabled ? 0.5 : 1,
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "500", color: colors.cream }}>{t.name}</Text>
            </Pressable>
          ))}

          {!adding ? (
            <Pressable
              onPress={() => setAdding(true)}
              style={{
                minHeight: 36,
                paddingHorizontal: space(4),
                paddingVertical: space(2),
                borderRadius: radius.pill,
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: CREAM_40,
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "500", color: CREAM_70 }}>+ Add</Text>
            </Pressable>
          ) : (
            <View style={{ width: "100%", marginTop: space(1), flexDirection: "row", alignItems: "center", gap: space(2) }}>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                onSubmitEditing={addType}
                autoFocus
                placeholder="New task type"
                placeholderTextColor={CREAM_40}
                style={{ flex: 1, minHeight: 36, paddingHorizontal: space(3), borderRadius: radius.sm, backgroundColor: CREAM_10, borderWidth: 1, borderColor: CREAM_25, color: colors.cream, fontSize: 14 }}
              />
              <Pressable onPress={addType} style={{ minHeight: 36, paddingHorizontal: space(4), borderRadius: radius.sm, backgroundColor: colors.cream, justifyContent: "center" }}>
                <Text style={{ fontSize: 13, fontWeight: "500", color: colors.plum }}>Add</Text>
              </Pressable>
              <Pressable onPress={() => { setAdding(false); setNewName(""); }} style={{ minHeight: 36, paddingHorizontal: space(2), justifyContent: "center" }}>
                <Text style={{ fontSize: 13, color: CREAM_70 }}>Cancel</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
