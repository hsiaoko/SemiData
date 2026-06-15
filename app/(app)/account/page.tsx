import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { AccountForm } from './AccountForm';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const me = await prisma.user.findUnique({
    where: { id: (session.user as any).id },
    select: {
      id: true, email: true, name: true, company: true, role: true, createdAt: true,
      _count: { select: { batches: true, permissions: true } },
    },
  });
  if (!me) redirect('/login');

  return (
    <div className="p-10 max-w-[920px]">
      <div className="mb-10">
        <div className="eyebrow mb-2">ACCOUNT · 我的账号</div>
        <h1 className="display-zh text-5xl text-ink">{me.name}</h1>
        <p className="mt-3 text-sm text-ink-3">
          账号 <span className="num text-ink-2">{me.email}</span> ·{' '}
          {me.role === 'ADMIN' ? '管理员' : '工程师'} · 注册于{' '}
          {new Date(me.createdAt).toLocaleDateString('zh-CN')}
        </p>
      </div>

      <section className="grid grid-cols-3 gap-6 mb-10 border-t border-b border-line py-8">
        <div>
          <div className="eyebrow mb-2">公司</div>
          <div className="text-base text-ink">{me.company || '—'}</div>
        </div>
        <div>
          <div className="eyebrow mb-2">已上传批次</div>
          <div className="num text-base text-ink">{me._count.batches}</div>
        </div>
        <div>
          <div className="eyebrow mb-2">授权数据集</div>
          <div className="num text-base text-ink">
            {me.role === 'ADMIN' ? '全部（admin）' : me._count.permissions}
          </div>
        </div>
      </section>

      <AccountForm
        initial={{
          email: me.email,
          name: me.name,
          company: me.company,
        }}
      />
    </div>
  );
}
