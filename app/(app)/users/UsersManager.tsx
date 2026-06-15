'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type U = {
  id: string;
  email: string;
  name: string;
  company: string;
  role: string;
  batches: number;
  createdAt: string;
  datasets: { name: string; slug: string }[];
};

export function UsersManager({ users, currentUserId }: { users: U[]; currentUserId: string }) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState({ email: '', name: '', company: '', password: '', role: 'USER' });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function create() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error(await res.text());
      setShowNew(false);
      setDraft({ email: '', name: '', company: '', password: '', role: 'USER' });
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleRole(u: U) {
    const newRole = u.role === 'ADMIN' ? 'USER' : 'ADMIN';
    await fetch(`/api/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    router.refresh();
  }

  async function reset(u: U) {
    const pw = prompt(`为「${u.name}」设置新密码（至少 4 位）`);
    if (!pw || pw.length < 4) return;
    await fetch(`/api/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    alert('已重置');
  }

  async function remove(u: U) {
    if (u.id === currentUserId) return alert('不可删除当前登录账号');
    if (!confirm(`确认删除「${u.name}」？该账号下的批次也会被级联删除。`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert(await res.text());
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button type="button" className="btn-primary" onClick={() => setShowNew(true)}>+ 新建用户</button>
      </div>

      {showNew && (
        <div className="card p-6 mb-6 animate-fade-up">
          <div className="eyebrow mb-4">NEW USER</div>
          <div className="grid grid-cols-5 gap-4">
            <div>
              <label className="label">账号</label>
              <input type="text" className="input" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            </div>
            <div>
              <label className="label">姓名</label>
              <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <label className="label">公司</label>
              <input className="input" value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} maxLength={120} />
            </div>
            <div>
              <label className="label">初始密码</label>
              <input type="password" className="input" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
            </div>
            <div>
              <label className="label">角色</label>
              <select className="input" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
                <option value="USER">普通用户</option>
                <option value="ADMIN">管理员</option>
              </select>
            </div>
          </div>
          {err && <div className="text-2xs text-bin-c mt-3">{err}</div>}
          <div className="flex justify-end gap-3 mt-5">
            <button type="button" className="btn-ghost" onClick={() => setShowNew(false)} disabled={saving}>取消</button>
            <button
              type="button"
              className="btn-primary"
              onClick={create}
              disabled={saving || !draft.email.trim() || !draft.name.trim() || !draft.company.trim() || draft.password.length < 4}
            >
              {saving ? '创建中…' : '创建'}
            </button>
          </div>
        </div>
      )}

      <div className="border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-2 text-ink-2">
              <th className="px-4 py-3 text-left font-mono text-2xs tracking-eyebrow uppercase">姓名</th>
              <th className="px-4 py-3 text-left font-mono text-2xs tracking-eyebrow uppercase">账号</th>
              <th className="px-4 py-3 text-left font-mono text-2xs tracking-eyebrow uppercase">公司</th>
              <th className="px-4 py-3 text-center font-mono text-2xs tracking-eyebrow uppercase">角色</th>
              <th className="px-4 py-3 text-left font-mono text-2xs tracking-eyebrow uppercase">授权数据集</th>
              <th className="px-4 py-3 text-right font-mono text-2xs tracking-eyebrow uppercase">批次数</th>
              <th className="px-4 py-3 text-right font-mono text-2xs tracking-eyebrow uppercase">创建时间</th>
              <th className="px-4 py-3 text-right font-mono text-2xs tracking-eyebrow uppercase">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-line hover:bg-surface-2/60">
                <td className="px-4 py-3 font-medium">{u.name}{u.id === currentUserId && <span className="ml-2 serial">· 你</span>}</td>
                <td className="px-4 py-3 num text-2xs text-ink-2">{u.email}</td>
                <td className="px-4 py-3 text-sm">
                  {u.company ? u.company : <span className="serial text-ink-3">—</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`tag ${u.role === 'ADMIN' ? 'text-cobalt' : 'text-ink-3'}`}>{u.role === 'ADMIN' ? '管理员' : '普通'}</span>
                </td>
                <td className="px-4 py-3">
                  {u.role === 'ADMIN' ? (
                    <span className="serial">全部（admin）</span>
                  ) : u.datasets.length === 0 ? (
                    <span className="serial text-bin-c">未授权</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {u.datasets.slice(0, 4).map((d) => (
                        <span key={d.slug} className="tag text-cobalt text-2xs">{d.name}</span>
                      ))}
                      {u.datasets.length > 4 && <span className="serial">+{u.datasets.length - 4}</span>}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 num text-right">{u.batches}</td>
                <td className="px-4 py-3 serial text-right">{new Date(u.createdAt).toLocaleDateString('zh-CN')}</td>
                <td className="px-4 py-3 text-right space-x-3">
                  <button onClick={() => toggleRole(u)} className="text-xs text-cobalt hover:underline">
                    切为{u.role === 'ADMIN' ? ' 普通' : ' 管理员'}
                  </button>
                  <button onClick={() => reset(u)} className="text-xs text-ink-2 hover:underline">重置密码</button>
                  <button onClick={() => remove(u)} className="text-xs text-bin-c hover:underline" disabled={u.id === currentUserId}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
