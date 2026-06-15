'use client';
import { gradeColor } from '@/lib/colors';

type Props = {
  distribution: Record<string, number>;
  order?: string[];
  height?: number;
  showLabels?: boolean;
};

export function BinBar({ distribution, order, height = 28, showLabels = true }: Props) {
  const keys = order ?? Object.keys(distribution);
  const total = keys.reduce((s, k) => s + (distribution[k] ?? 0), 0);
  if (total === 0) return <div className="text-ink-3 text-xs">无数据</div>;

  return (
    <div>
      <div className="flex w-full overflow-hidden" style={{ height }}>
        {keys.map((k) => {
          const v = distribution[k] ?? 0;
          if (v === 0) return null;
          const pct = (v / total) * 100;
          return (
            <div
              key={k}
              title={`${k}: ${v} (${pct.toFixed(1)}%)`}
              style={{ width: `${pct}%`, background: gradeColor(k) }}
            />
          );
        })}
      </div>
      {showLabels && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
          {keys.map((k) => {
            const v = distribution[k] ?? 0;
            const pct = (v / total) * 100;
            return (
              <div key={k} className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2" style={{ background: gradeColor(k) }} />
                <span className="num text-xs text-ink-2">{k}</span>
                <span className="num text-xs text-ink-3">· {v}</span>
                <span className="num text-2xs text-ink-3">{pct.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
