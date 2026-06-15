'use client';
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ZAxis,
} from 'recharts';
import { gradeColor } from '@/lib/colors';

type Point = { x: number; y: number; grade: string };

const GRADES = ['S', 'A', 'B', 'C', 'D', 'FAIL'];

export function ReportScatter({ data }: { data: Point[] }) {
  const byGrade: Record<string, Point[]> = {};
  for (const p of data) {
    (byGrade[p.grade] ??= []).push(p);
  }

  return (
    <ResponsiveContainer width="100%" height={340}>
      <ScatterChart margin={{ top: 10, right: 24, bottom: 30, left: 10 }}>
        <CartesianGrid stroke="#C9C5BB" strokeDasharray="3 4" />
        <XAxis
          type="number"
          dataKey="x"
          name="频率"
          unit=" MHz"
          tick={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fill: '#3A3D44' }}
          stroke="#6B6E76"
          label={{ value: '频率 frequency (MHz)', position: 'insideBottom', offset: -16, fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#6B6E76' }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="漏电"
          unit=" nA"
          tick={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fill: '#3A3D44' }}
          stroke="#6B6E76"
          label={{ value: '漏电流 leakage (nA)', angle: -90, position: 'insideLeft', fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#6B6E76' }}
        />
        <ZAxis range={[28, 28]} />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          contentStyle={{
            background: '#F4F2EC',
            border: '1px solid #15171B',
            borderRadius: 0,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
          }}
          formatter={(v: any, k: string) => [v, k === 'x' ? '频率 (MHz)' : k === 'y' ? '漏电 (nA)' : k]}
        />
        {GRADES.filter((g) => byGrade[g]?.length).map((g) => (
          <Scatter key={g} name={g} data={byGrade[g]} fill={gradeColor(g)} opacity={0.7} />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
