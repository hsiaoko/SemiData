'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Rs = {
  id: string;
  name: string;
  description: string | null;
  rules: string; // JSON
  isDefault: boolean;
  createdByName: string;
  createdAt: string;
};

export function RulesEditor({ ruleSets }: { ruleSets: Rs[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Rs | null>(ruleSets[0] ?? null);
  const [draft, setDraft] = useState<string>(ruleSets[0] ? prettify(ruleSets[0].rules) : '');
  const [name, setName] = useState<string>(ruleSets[0]?.name ?? '');
  const [description, setDescription] = useState<string>(ruleSets[0]?.description ?? '');
  const [isDefault, setIsDefault] = useState<boolean>(ruleSets[0]?.isDefault ?? false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [parseErr, setParseErr] = useState<string | null>(null);

  function selectRs(r: Rs) {
    setSelected(r);
    setDraft(prettify(r.rules));
    setName(r.name);
    setDescription(r.description ?? '');
    setIsDefault(r.isDefault);
    setErr(null);
    setParseErr(null);
  }

  function newRs() {
    const tmpl = JSON.stringify(
      {
        fields: [
          { field: 'frequencyMhz', min: 380, ideal: 480, max: 540, weight: 0.4 },
          { field: 'leakageNa', max: 60, weight: 0.25 },
          { field: 'vthV', ideal: 0.7, tolerance: 0.06, weight: 0.2 },
          { field: 'iddUa', max: 120, weight: 0.15 },
        ],
        hardReject: [{ field: 'failCount', greaterThan: 0 }],
        percentileField: 'frequencyMhz',
        percentileWeight: 0.3,
        priceTable: { S: 18, A: 14, B: 10, C: 6, D: 3, FAIL: 0 },
      },
      null,
      2,
    );
    setSelected(null);
    setDraft(tmpl);
    setName('新规则集');
    setDescription('');
    setIsDefault(false);
  }

  function validate(): boolean {
    try {
      const obj = JSON.parse(draft);
      if (!Array.isArray(obj.fields)) throw new Error('fields 必须为数组');
      if (!obj.priceTable) throw new Error('缺少 priceTable');
      setParseErr(null);
      return true;
    } catch (e: any) {
      setParseErr(e.message);
      return false;
    }
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(selected ? `/api/rules/${selected.id}` : '/api/rules', {
        method: selected ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, rules: draft, isDefault }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!selected) return;
    if (!confirm(`确认删除规则集「${selected.name}」？`)) return;
    const res = await fetch(`/api/rules/${selected.id}`, { method: 'DELETE' });
    if (!res.ok) {
      setErr(await res.text());
      return;
    }
    setSelected(null);
    setDraft('');
    setName('');
    router.refresh();
  }

  return (
    <div className="grid grid-cols-[260px_1fr] gap-6">
      <aside className="card p-4 self-start">
        <div className="eyebrow mb-3">RULE SETS · {ruleSets.length}</div>
        <ul className="space-y-1 mb-4">
          {ruleSets.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => selectRs(r)}
                className={`block w-full text-left px-3 py-2 text-sm hover:bg-surface-2 ${
                  selected?.id === r.id ? 'bg-surface-2 border-l-2 border-cobalt' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate">{r.name}</span>
                  {r.isDefault && <span className="tag text-cobalt text-2xs">默认</span>}
                </div>
                <div className="serial mt-0.5">{r.createdByName} · {new Date(r.createdAt).toLocaleDateString('zh-CN')}</div>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={newRs} className="btn-ghost w-full justify-center text-xs">+ 新规则集</button>
      </aside>

      <main className="card p-6">
        <div className="grid grid-cols-2 gap-6 mb-5">
          <div>
            <label className="label">名称</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">备注</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <div className="mb-5 flex items-center gap-2">
          <input
            id="isDefault"
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
          />
          <label htmlFor="isDefault" className="text-sm">设为默认规则集</label>
        </div>
        <label className="label">规则 JSON</label>
        <textarea
          className="input font-mono text-xs"
          rows={22}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={validate}
          spellCheck={false}
        />
        {parseErr && <div className="text-2xs text-bin-c mt-2">JSON 校验：{parseErr}</div>}
        {err && <div className="text-2xs text-bin-c mt-2">{err}</div>}
        <div className="mt-5 flex justify-between">
          <div className="serial leading-relaxed max-w-md">
            字段范围内得分高、权重和决定该字段对综合分的贡献。<br />
            硬否决（hardReject）命中将直接判为 FAIL。
          </div>
          <div className="flex gap-2">
            {selected && !selected.isDefault && (
              <button type="button" className="btn-ghost text-bin-c" onClick={remove}>删除</button>
            )}
            <button type="button" className="btn-primary" onClick={save} disabled={saving}>
              {saving ? '保存中…' : selected ? '保存修改' : '创建规则集'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function prettify(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}
