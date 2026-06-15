'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type U = { id: string; name: string; email: string };

export function PermissionsPanel({
  datasetId,
  users,
  initialGranted,
}: {
  datasetId: string;
  users: U[];
  initialGranted: string[];
}) {
  const router = useRouter();
  const [granted, setGranted] = useState<Set<string>>(new Set(initialGranted));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggle(id: string) {
    const next = new Set(granted);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setGranted(next);
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/datasets/${datasetId}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: Array.from(granted) }),
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

  if (users.length === 0) {
    return <div className="card p-6 text-ink-3 text-sm">尚无普通用户。可前往 <a className="text-cobalt hover:underline" href="/users">用户管理</a> 创建或等待用户注册。</div>;
  }

  return (
    <div className="card p-6">
      <div className="text-sm text-ink-3 mb-4 leading-relaxed">
        勾选的用户可查看本数据集。管理员默认能看所有数据集，不显示在此列表。
      </div>
      <div className="grid grid-cols-2 gap-2 mb-5">
        {users.map((u) => (
          <label
            key={u.id}
            className={`flex items-center gap-3 px-3 py-2.5 border cursor-pointer transition-colors ${
              granted.has(u.id) ? 'border-cobalt bg-cobalt/[0.04]' : 'border-line hover:border-ink-2'
            }`}
          >
            <input
              type="checkbox"
              checked={granted.has(u.id)}
              onChange={() => toggle(u.id)}
              className="cursor-pointer"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{u.name}</div>
              <div className="serial truncate">{u.email}</div>
            </div>
          </label>
        ))}
      </div>
      {err && <div className="text-2xs text-bin-c mb-3">{err}</div>}
      <div className="flex justify-between items-center">
        <div className="serial">
          已授权 <span className="text-cobalt num">{granted.size}</span> / {users.length} 个用户
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-ghost"
            disabled={!dirty || saving}
            onClick={() => { setGranted(new Set(initialGranted)); setDirty(false); }}
          >
            撤销
          </button>
          <button type="button" className="btn-primary" disabled={!dirty || saving} onClick={save}>
            {saving ? '保存中…' : '保存授权'}
          </button>
        </div>
      </div>
    </div>
  );
}
