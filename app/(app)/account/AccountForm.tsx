'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Initial = { email: string; name: string; company: string };

export function AccountForm({ initial }: { initial: Initial }) {
  const router = useRouter();

  // 资料表单
  const [name, setName] = useState(initial.name);
  const [company, setCompany] = useState(initial.company);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // 密码表单
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const profileDirty = name.trim() !== initial.name || company.trim() !== initial.company;

  async function saveProfile() {
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), company: company.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? '保存失败');
      setProfileMsg({ kind: 'ok', text: '资料已更新' });
      router.refresh();
    } catch (e: any) {
      setProfileMsg({ kind: 'err', text: e.message });
    } finally {
      setProfileSaving(false);
    }
  }

  async function savePassword() {
    if (newPw !== newPw2) return setPwMsg({ kind: 'err', text: '两次输入的新密码不一致' });
    if (newPw.length < 6) return setPwMsg({ kind: 'err', text: '新密码至少 6 位' });
    setPwSaving(true);
    setPwMsg(null);
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? '修改失败');
      setPwMsg({ kind: 'ok', text: '密码已更新，下次登录请使用新密码' });
      setCurrentPw('');
      setNewPw('');
      setNewPw2('');
    } catch (e: any) {
      setPwMsg({ kind: 'err', text: e.message });
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <div className="space-y-10">
      {/* 个人资料 */}
      <section className="card p-8">
        <div className="eyebrow mb-5">PROFILE · 个人资料</div>
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <label className="label">账号（不可修改）</label>
            <input className="input num text-ink-3" value={initial.email} readOnly disabled />
            <div className="serial mt-1.5">登录用账号，无法修改；如需更换请联系管理员</div>
          </div>
          <div>
            <label className="label">姓名</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
          </div>
          <div className="col-span-2">
            <label className="label">公司 / 组织</label>
            <input
              className="input"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              maxLength={120}
              placeholder="必填"
            />
          </div>
        </div>
        {profileMsg && (
          <div className={`text-sm mb-4 ${profileMsg.kind === 'ok' ? 'text-cobalt' : 'text-bin-c'}`}>
            {profileMsg.text}
          </div>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            className="btn-primary"
            disabled={profileSaving || !profileDirty || !name.trim() || !company.trim()}
            onClick={saveProfile}
          >
            {profileSaving ? '保存中…' : '保存资料'}
          </button>
        </div>
      </section>

      {/* 修改密码 */}
      <section className="card p-8">
        <div className="eyebrow mb-5">PASSWORD · 修改密码</div>
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div>
            <label className="label">当前密码</label>
            <input
              className="input num"
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="label">新密码（至少 6 位）</label>
            <input
              className="input num"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
              minLength={6}
            />
          </div>
          <div>
            <label className="label">再次输入新密码</label>
            <input
              className="input num"
              type="password"
              value={newPw2}
              onChange={(e) => setNewPw2(e.target.value)}
              autoComplete="new-password"
              minLength={6}
            />
          </div>
        </div>
        {pwMsg && (
          <div className={`text-sm mb-4 ${pwMsg.kind === 'ok' ? 'text-cobalt' : 'text-bin-c'}`}>
            {pwMsg.text}
          </div>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            className="btn-primary"
            disabled={pwSaving || !currentPw || newPw.length < 6 || newPw2.length < 6}
            onClick={savePassword}
          >
            {pwSaving ? '保存中…' : '修改密码'}
          </button>
        </div>
      </section>
    </div>
  );
}
