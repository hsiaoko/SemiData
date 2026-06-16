'use client';
import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { BreathingWafer } from '@/components/DieGrid';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const sp = useSearchParams();
  const callbackUrl = sp.get('callbackUrl') ?? '/';
  const [email, setEmail] = useState('admin');
  const [password, setPassword] = useState('admin1234');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    const res = await signIn('credentials', { email, password, redirect: false });
    if (res?.ok) {
      // 硬跳转：确保浏览器把新的 session cookie 带进下一次请求
      window.location.assign(callbackUrl);
    } else {
      setLoading(false);
      setErr('登录失败：请检查账号与密码');
    }
  }

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Wafer background — anchored bottom-left for asymmetry */}
      <div className="pointer-events-none absolute -left-32 -bottom-40 opacity-90">
        <BreathingWafer size={760} />
      </div>
      <div className="pointer-events-none absolute inset-0 substrate-noise" />

      {/* Top bar */}
      <div className="relative flex justify-between items-center px-10 py-7">
        <div className="flex items-baseline gap-3">
          <span className="num text-sm tracking-[0.22em] text-ink-2">YIELDEX BENCH</span>
          <span className="serial">v0.1 · 芯测台</span>
        </div>
        <span className="serial">FAB · LAB · BENCH</span>
      </div>

      {/* Title */}
      <div className="relative px-10 mt-16 max-w-[560px]">
        <div className="eyebrow mb-4">LOGIN · 01</div>
        <h1 className="display-zh text-[64px] leading-[1.02] text-ink">
          封测数据的<br />
          <span className="font-bold">中央调度台</span>
        </h1>
        <p className="mt-6 text-sm text-ink-2 max-w-md leading-relaxed">
          统一存储每一颗芯片的电性、温度与 BIN 信息；一键生成可向客户发送的分级与定价报告。
        </p>
      </div>

      {/* Login card — bottom right */}
      <div className="relative ml-auto mr-10 mt-12 max-w-[400px] card p-8 shadow-card">
        <div className="eyebrow mb-5">CREDENTIALS</div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">账号</label>
            <input
              className="input num"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <div>
            <label className="label">密码</label>
            <input
              className="input num"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {err && <div className="text-xs text-bin-c">{err}</div>}
          <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
            {loading ? '验证中…' : '登 录'}
          </button>
        </form>
        <div className="mt-6 pt-5 border-t border-line">
          <div className="flex items-center justify-between mb-3">
            <div className="serial">SEED CREDENTIALS</div>
            <a href="/signup" className="text-xs text-cobalt hover:underline underline-offset-4">没有账号？注册 →</a>
          </div>
          <div className="text-xs text-ink-2 space-y-1 font-mono">
            <div>admin · admin1234</div>
            <div>demo · demo1234</div>
          </div>
        </div>
      </div>

      <div className="relative px-10 mt-16 pb-10 flex justify-between items-end">
        <div className="serial max-w-xs">
          一颗芯片 = 一条记录。<br />一张 CSV = 一次入库。一份报告 = 一次决策。
        </div>
        <div className="serial">© YIELDEX · {new Date().getFullYear()}</div>
      </div>
    </main>
  );
}
