'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type RuleSet = { id: string; name: string; description: string | null; isDefault: boolean };

export function GenerateReportButton({
  batchId,
  datasetId,
  label = '生成报告',
  variant = 'primary',
}: {
  batchId: string;
  datasetId: string;
  label?: string;
  variant?: 'primary' | 'ghost';
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ruleSets, setRuleSets] = useState<RuleSet[] | null>(null);
  const [selected, setSelected] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function openDialog() {
    setErr(null);
    setOpen(true);
    if (ruleSets === null) {
      try {
        const res = await fetch(`/api/datasets/${datasetId}/rule-sets`);
        if (!res.ok) throw new Error('加载规则集失败');
        const data: RuleSet[] = await res.json();
        setRuleSets(data);
        const def = data.find((r) => r.isDefault) ?? data[0];
        setSelected(def?.id ?? '');
      } catch (e: any) {
        setErr(e.message);
      }
    }
  }

  async function go() {
    if (!selected) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/batches/${batchId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleSetId: selected }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t.startsWith('{') ? JSON.parse(t).error : t);
      }
      setOpen(false);
      router.push(`/batches/${batchId}/report`);
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openDialog}
        className={variant === 'primary' ? 'btn-primary' : 'btn-ghost'}
      >
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-ink/30 flex items-center justify-center p-6" onClick={() => !loading && setOpen(false)}>
          <div
            className="bg-surface border border-line shadow-card p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="eyebrow mb-4">RULE SET · 选择评级规则</div>
            {ruleSets === null && !err && (
              <div className="text-sm text-ink-3">加载规则集…</div>
            )}
            {ruleSets && ruleSets.length === 0 && (
              <div className="text-sm text-bin-c">
                该数据集尚未绑定任何规则集，无法生成报告。请管理员前往数据集详情页绑定规则集后再试。
              </div>
            )}
            {ruleSets && ruleSets.length > 0 && (
              <div className="space-y-2 mb-5">
                {ruleSets.map((rs) => (
                  <label
                    key={rs.id}
                    className={`flex items-start gap-3 px-3 py-2.5 border cursor-pointer transition-colors ${
                      selected === rs.id ? 'border-cobalt bg-cobalt/[0.04]' : 'border-line hover:border-ink-2'
                    }`}
                  >
                    <input
                      type="radio"
                      name="ruleSet"
                      checked={selected === rs.id}
                      onChange={() => setSelected(rs.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{rs.name}</span>
                        {rs.isDefault && <span className="tag text-cobalt text-2xs">默认</span>}
                      </div>
                      {rs.description && (
                        <div className="serial mt-0.5 leading-relaxed">{rs.description}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
            {err && <div className="text-2xs text-bin-c mb-3">{err}</div>}
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)} disabled={loading}>
                取消
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={go}
                disabled={loading || !selected || (ruleSets?.length ?? 0) === 0}
              >
                {loading ? '运算中…' : '使用此规则生成报告 →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
