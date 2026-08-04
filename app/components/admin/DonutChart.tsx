"use client";

type Slice = {
  name: string;
  value: number;
};

const COLORS = ["#23406E", "#C88A1A", "#E4572E", "#1F9D63", "#5B6472", "#7C3AED", "#0EA5E9"];

interface Props {
  data: Slice[];
  size?: number;
}

// 外部ライブラリなしで描く軽量なドーナツグラフ。カテゴリ数が少ない(味・種類)前提の簡易実装。
export default function DonutChart({ data, size = 140 }: Props) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return null;

  const radius = size / 2;
  const strokeWidth = size * 0.28;
  const innerRadius = radius - strokeWidth / 2;
  const circumference = 2 * Math.PI * innerRadius;

  const slices = data.reduce<{ cumulative: number; items: { name: string; dash: number; dashoffset: number }[] }>(
    (acc, d) => {
      const dash = (d.value / total) * circumference;
      acc.items.push({ name: d.name, dash, dashoffset: -acc.cumulative });
      acc.cumulative += dash;
      return acc;
    },
    { cumulative: 0, items: [] }
  ).items;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0">
        {slices.map((s, i) => (
          <circle
            key={s.name}
            cx={radius}
            cy={radius}
            r={innerRadius}
            fill="none"
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={strokeWidth}
            strokeDasharray={`${s.dash} ${circumference - s.dash}`}
            strokeDashoffset={s.dashoffset}
          />
        ))}
      </svg>

      <ul className="space-y-1.5">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="font-bold text-ink">{d.name}</span>
            <span className="text-xs text-sub">
              {d.value}本({Math.round((d.value / total) * 100)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
