import { Pressable, ScrollView, Text, View } from "react-native";
import type { FilterProperty } from "@/lib/db";
import { colors, fonts, radius, space } from "@/theme/tokens";

// Ported from web src/components/property-filter.tsx: tag pills, property
// pills, and the spouse co-owner combine toggle, in horizontal scroll rows.

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: space(3.5),
        paddingVertical: space(2),
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: active ? colors.plum : colors.chalk,
        backgroundColor: active ? colors.plum : colors.cream,
        marginRight: space(2),
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "500", color: active ? colors.cream : colors.quill }}>
        {label}
      </Text>
    </Pressable>
  );
}

function RowLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontFamily: fonts.mono,
        fontSize: 9,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        color: colors.slate,
        fontWeight: "500",
        marginRight: space(2),
        alignSelf: "center",
      }}
    >
      {children}
    </Text>
  );
}

export function PropertyFilter({
  properties,
  allTags,
  activeTag,
  activeProp,
  onTagChange,
  onPropChange,
  cohostName,
  showCombined,
  onToggleCombined,
}: {
  properties: FilterProperty[];
  allTags: string[];
  activeTag: string | null;
  activeProp: string;
  onTagChange: (tag: string | null) => void;
  onPropChange: (prop: string) => void;
  cohostName?: string | null;
  showCombined?: boolean;
  onToggleCombined?: () => void;
}) {
  const tagFiltered = activeTag
    ? properties.filter((p) => p.tags.includes(activeTag))
    : properties;

  if (properties.length <= 1 && allTags.length === 0 && !cohostName) return null;

  return (
    <View style={{ paddingVertical: space(4), borderBottomWidth: 1, borderBottomColor: colors.chalk, gap: space(3) }}>
      {allTags.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space(7) }}>
          <RowLabel>Tags</RowLabel>
          <Pill label="All" active={!activeTag} onPress={() => onTagChange(null)} />
          {allTags.map((tag) => (
            <Pill key={tag} label={tag} active={activeTag === tag} onPress={() => onTagChange(activeTag === tag ? null : tag)} />
          ))}
        </ScrollView>
      )}

      {tagFiltered.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space(7) }}>
          <RowLabel>Property</RowLabel>
          <Pill label="All properties" active={activeProp === "All properties"} onPress={() => onPropChange("All properties")} />
          {tagFiltered.map((p) => (
            <Pill key={p.id} label={p.name} active={activeProp === p.name} onPress={() => onPropChange(p.name)} />
          ))}
        </ScrollView>
      )}

      {cohostName && onToggleCombined && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space(7) }}>
          <RowLabel>Spouse Co-Owner</RowLabel>
          <Pill label={`Add ${cohostName}'s hours`} active={!!showCombined} onPress={onToggleCombined} />
        </ScrollView>
      )}
    </View>
  );
}
