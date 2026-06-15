'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function GenerateReportButton({
  batchId,
  label = '生成报告',
  variant = 'primary',
}: {
  batchId: string;
  label?: string;
  variant?: 'primary' | 'ghost';
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/batches/${batchId}/report`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      router.push(`/batches/${batchId}/report`);
      router.refresh();
    } catch (e: any) {
      setErr(e.message ?? '生成失败');
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={go}
        disabled={loading}
        className={variant === 'primary' ? 'btn-primary' : 'btn-ghost'}
      >
        {loading ? '运算中…' : label}
      </button>
      {err && <span className="text-2xs text-bin-c">{err}</span>}
    </div>
  );
}
