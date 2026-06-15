'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { BreathingWafer } from '@/components/DieGrid';

export default function SignupPage() {
  const [form, setForm] = useState({ email: '', name: '', company: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? '注册失败');
      const login = await signIn('credentials', {
        email: form.email,
        password: form.password,
        redirect: false,
      });
      // 硬跳转，让浏览器携带新写入的 session cookie
      window.location.assign(login?.ok ? '/' : '/login');
    } catch (e: any) {
      setErr(e.message);
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen relative overflow-hidden">
      <div className="pointer-events-none absolute -right-32 -bottom-40 opacity-90">
        <BreathingWafer size={760} />
      </div>
      <div className="pointer-events-none absolute inset-0 substrate-noise" />

      <div className="relative flex justify-between items-center px-10 py-7">
        <Link href="/login" className="flex items-baseline gap-3 hover:opacity-70">
          <span className="num text-sm tracking-[0.22em] text-ink-2">SEMIDATA</span>
          <span className="serial">v0.1 · 封测数据中枢</span>
        </Link>
        <Link href="/login" className="serial hover:text-ink underline underline-offset-4">已有账号？登录 →</Link>
      </div>

      <div className="relative px-10 mt-16 max-w-[560px]">
        <div className="eyebrow mb-4">REGISTER · 02</div>
        <h1 className="display-zh text-[64px] leading-[1.02] text-ink">
          注册一个<br />
          <span className="font-bold">访问账号</span>
        </h1>
        <p className="mt-6 text-sm text-ink-2 max-w-md leading-relaxed">
          自定义账号名即可注册，无需邮箱。具体能访问哪些数据集，
          需要管理员在后台勾选授权后方可见。
        </p>
      </div>

      <div className="relative mx-auto mt-12 max-w-[420px] card p-8 shadow-card">
        <div className="eyebrow mb-5">NEW ACCOUNT</div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">账号</label>
            <input
              className="input num"
              type="text"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="字母 / 数字 / 下划线"
            />
          </div>
          <div>
            <label className="label">姓名</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              autoComplete="name"
              maxLength={80}
            />
          </div>
          <div>
            <label className="label">公司 / 组织</label>
            <input
              className="input"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              required
              autoComplete="organization"
              maxLength={120}
              placeholder="如：长鑫存储 / 中芯国际 / 某高校实验室"
            />
          </div>
          <div>
            <label className="label">密码（至少 6 位）</label>
            <input
              className="input num"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          {err && <div className="text-xs text-bin-c">{err}</div>}
          <button
            type="submit"
            className="btn-primary w-full justify-center"
            disabled={
              loading ||
              !form.email.trim() ||
              !form.name.trim() ||
              !form.company.trim() ||
              form.password.length < 6
            }
          >
            {loading ? '提交中…' : '注 册'}
          </button>
        </form>
        <div className="mt-6 pt-5 border-t border-line serial leading-relaxed">
          注册成功后将自动登录，并进入"等待授权"页。<br />
          联系管理员（admin / chenmk / zhuxk）申请数据集权限。
        </div>
      </div>

      <div className="relative px-10 mt-16 pb-10 flex justify-between items-end">
        <div className="serial max-w-xs">
          一颗芯片 = 一条记录。<br />一张 CSV = 一次入库。一份报告 = 一次决策。
        </div>
        <div className="serial">© SEMIDATA · {new Date().getFullYear()}</div>
      </div>
    </main>
  );
}
