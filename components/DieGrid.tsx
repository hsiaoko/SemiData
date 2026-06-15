'use client';
import { useMemo, useRef, useEffect } from 'react';

export type DiePoint = {
  x: number;
  y: number;
  color: string; // hex
  id?: string;
  title?: string;
};


type Props = {
  dies: DiePoint[];
  size?: number;
  showWaferOutline?: boolean;
  className?: string;
  onDieClick?: (id: string) => void;
};

// 圆形晶圆形态：把 dies 按顺序填入圆内的网格
export function DieGrid({ dies, size = 360, showWaferOutline = true, className, onDieClick }: Props) {
  const layout = useMemo(() => {
    const count = dies.length;
    // 选择一个网格密度让 dies 大致铺满圆形
    const side = Math.ceil(Math.sqrt((count * 4) / Math.PI)) + 4;
    const cell = (size - 8) / side;
    const cx = size / 2;
    const cy = size / 2;
    const r = (size - 8) / 2;
    // 收集圆内格子
    const slots: { x: number; y: number }[] = [];
    for (let gy = 0; gy < side; gy++) {
      for (let gx = 0; gx < side; gx++) {
        const px = (gx + 0.5) * cell + 4;
        const py = (gy + 0.5) * cell + 4;
        const dx = px - cx, dy = py - cy;
        if (dx * dx + dy * dy <= (r - cell * 0.55) * (r - cell * 0.55)) {
          slots.push({ x: px, y: py });
        }
      }
    }
    // 按到圆心距离排序，把好等级的（前面的 die）放中心
    slots.sort((a, b) => {
      const da = (a.x - cx) ** 2 + (a.y - cy) ** 2;
      const db = (b.x - cx) ** 2 + (b.y - cy) ** 2;
      return da - db;
    });
    return { slots, cell, cx, cy, r };
  }, [dies.length, size]);

  const useCanvas = dies.length > 1500;

  if (useCanvas) {
    return <CanvasDieGrid dies={dies} size={size} layout={layout} showWaferOutline={showWaferOutline} className={className} />;
  }

  const { slots, cell, cx, cy, r } = layout;
  const gap = Math.max(1, cell * 0.12);
  const tile = cell - gap;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      width={size}
      height={size}
      style={{ display: 'block' }}
    >
      {showWaferOutline && (
        <>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(21,23,27,0.18)" strokeWidth={1} />
          {/* notch — 真实晶圆的对齐凹口 */}
          <path
            d={`M ${cx - 6} ${cy + r - 1} L ${cx + 6} ${cy + r - 1} L ${cx} ${cy + r - 9} Z`}
            fill="#DCD9D2"
            stroke="rgba(21,23,27,0.25)"
            strokeWidth={1}
          />
        </>
      )}
      {dies.slice(0, slots.length).map((d, i) => {
        const slot = slots[i];
        return (
          <rect
            key={d.id ?? i}
            x={slot.x - tile / 2}
            y={slot.y - tile / 2}
            width={tile}
            height={tile}
            fill={d.color}
            opacity={0.92}
            onClick={d.id && onDieClick ? () => onDieClick(d.id!) : undefined}
            style={{ cursor: d.id && onDieClick ? 'pointer' : undefined }}
          >
            {d.title && <title>{d.title}</title>}
          </rect>
        );
      })}
    </svg>
  );
}

function CanvasDieGrid({
  dies, size, layout, showWaferOutline, className,
}: {
  dies: DiePoint[];
  size: number;
  layout: { slots: { x: number; y: number }[]; cell: number; cx: number; cy: number; r: number };
  showWaferOutline: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);
    if (showWaferOutline) {
      ctx.strokeStyle = 'rgba(21,23,27,0.18)';
      ctx.beginPath();
      ctx.arc(layout.cx, layout.cy, layout.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    const { slots, cell } = layout;
    const gap = Math.max(1, cell * 0.12);
    const tile = cell - gap;
    const N = Math.min(dies.length, slots.length);
    for (let i = 0; i < N; i++) {
      const s = slots[i];
      ctx.fillStyle = dies[i].color;
      ctx.globalAlpha = 0.92;
      ctx.fillRect(s.x - tile / 2, s.y - tile / 2, tile, tile);
    }
  }, [dies, layout, size, showWaferOutline]);
  return <canvas ref={ref} style={{ width: size, height: size, display: 'block' }} className={className} />;
}

// 用于登录页背景：基于随机色合成的"呼吸"晶圆
export function BreathingWafer({ size = 520 }: { size?: number }) {
  const dies = useMemo(() => {
    // 用真实 BIN 颜色分布；70% 蓝、15% 绿、8% 琥珀、4% 红、3% 灰
    const palette = [
      ...Array(70).fill('#1B4FE3'),
      ...Array(15).fill('#3FAE6B'),
      ...Array(8).fill('#E8A53C'),
      ...Array(4).fill('#C24A4A'),
      ...Array(3).fill('#5A5A60'),
    ];
    return Array.from({ length: 1200 }, (_, i) => ({
      x: 0, y: 0,
      color: palette[Math.floor(Math.random() * palette.length)],
      id: String(i),
    }));
  }, []);
  return (
    <div className="animate-breathe" style={{ filter: 'saturate(0.9)' }}>
      <DieGrid dies={dies} size={size} showWaferOutline />
    </div>
  );
}
