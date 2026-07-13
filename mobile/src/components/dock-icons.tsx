import type { ColorValue } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

// The web Dock's icons (src/components/dock.tsx), stroke-for-stroke — keep the
// two in sync so the tab bars read identically.

type IconProps = { color: ColorValue; size?: number };

const strokeProps = {
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none" as const,
};

export function HomeIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke={color} {...strokeProps} />
    </Svg>
  );
}

export function HoursIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Line x1={18} y1={20} x2={18} y2={10} stroke={color} {...strokeProps} />
      <Line x1={12} y1={20} x2={12} y2={4} stroke={color} {...strokeProps} />
      <Line x1={6} y1={20} x2={6} y2={14} stroke={color} {...strokeProps} />
    </Svg>
  );
}

export function PlusIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Line x1={12} y1={5} x2={12} y2={19} stroke={color} {...strokeProps} />
      <Line x1={5} y1={12} x2={19} y2={12} stroke={color} {...strokeProps} />
    </Svg>
  );
}

export function PropertiesIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path d="M3 9l9-7 9 7" stroke={color} {...strokeProps} />
      <Path d="M9 22V12h6v10" stroke={color} {...strokeProps} />
      <Rect x={2} y={9} width={20} height={13} rx={1} stroke={color} {...strokeProps} />
    </Svg>
  );
}

export function SettingsIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Circle cx={12} cy={12} r={3} stroke={color} {...strokeProps} />
      <Path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke={color}
        {...strokeProps}
      />
    </Svg>
  );
}
