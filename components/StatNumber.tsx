type Props = {
  label: string;
  value: string | number;
  hint?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  align?: 'left' | 'right';
  accent?: 'cobalt' | 'pink' | 'cyan' | 'ink';
};

const SIZE: Record<NonNullable<Props['size']>, string> = {
  sm: 'text-2xl',
  md: 'text-4xl',
  lg: 'text-6xl',
  xl: 'text-7xl',
};

const ACCENT: Record<NonNullable<Props['accent']>, string> = {
  cobalt: 'text-cobalt',
  pink: 'text-irid-pink',
  cyan: 'text-irid-cyan',
  ink: 'text-ink',
};

export function StatNumber({ label, value, hint, size = 'md', align = 'left', accent = 'ink' }: Props) {
  return (
    <div className={align === 'right' ? 'text-right' : ''}>
      <div className="eyebrow mb-2">{label}</div>
      <div className={`num font-light ${SIZE[size]} ${ACCENT[accent]} tracking-tight`}>{value}</div>
      {hint && <div className="mt-1 text-2xs text-ink-3 font-mono">{hint}</div>}
    </div>
  );
}
