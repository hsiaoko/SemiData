'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Rs = { id: string; name: string; description: string | null; isDefault: boolean };

export function RuleSetsPanel({
  datasetId,
  allRuleSets,
  initialBoundIds,
  canEdit,
}: {
  datasetId: string;
  allRuleSets: Rs[];
  initialBoundIds: string[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [bound, setBound] = useState<Set<string>>(new Set(initialBoundIds));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggle(id: string) {
    if (!canEdit) return;
    const next = new Set(bound);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setBound(next);
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/datasets/${datasetId}/rule-sets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleSetIds: Array.from(bound) }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? '保存失败');
      setDirty(false);
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (allRuleSets.length === 0) {
    return (
      <div className="card p-6 text-sm text-ink-3">
        系统尚无任何规则集 — 请管理员先在 <a href="/rules" className="text-cobalt hover:underline">/rules</a> 创建。
      </div>
    );
  }

  return (
    <div className="card p-6">
      {canEdit ? (
        <div className="text-sm text-ink-3 mb-4 leading-relaxed">
          勾选的规则集将作为该数据集生成报告时的可选项。可绑定多条 — 生成报告时由用户选择具体使用哪一条。
        </div>
      ) : (
        <div className="text-sm text-ink-3 mb-4 leading-relaxed">
          以下是该数据集启用的规则集，生成报告时可选其中之一。
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 mb-5">
        {allRuleSets.map((rs) => {
          const checked = bound.has(rs.id);
          if (!canEdit && !checked) return null; // 普通用户只看到已绑定的
          return (
            <label
              key={rs.id}
              className={`flex items-start gap-3 px-3 py-2.5 border transition-colors ${
                canEdit ? 'cursor-pointer' : 'cursor-default'
              } ${checked ? 'border-cobalt bg-cobalt/[0.04]' : 'border-line hover:border-ink-2'}`}
            >
              {canEdit && (
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(rs.id)}
                  className="cursor-pointer mt-0.5"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{rs.name}</span>
                  {rs.isDefault && <span className="tag text-cobalt text-2xs">默认</span>}
                </div>
                {rs.description && <div className="serial mt-0.5 line-clamp-2">{rs.description}</div>}
              </div>
            </label>
          );
        })}
      </div>
      {canEdit && (
        <>
          {err && <div className="text-2xs text-bin-c mb-3">{err}</div>}
          <div className="flex justify-between items-center">
            <div className="serial">
              已绑定 <span className="text-cobalt num">{bound.size}</span> / {allRuleSets.length} 条规则集
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-ghost"
                disabled={!dirty || saving}
                onClick={() => { setBound(new Set(initialBoundIds)); setDirty(false); }}
              >
                撤销
              </button>
              <button type="button" className="btn-primary" disabled={!dirty || saving} onClick={save}>
                {saving ? '保存中…' : '保存绑定'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
