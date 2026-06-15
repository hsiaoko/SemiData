import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { UsersManager } from './UsersManager';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const session = await auth();
  const role = (session!.user as any).role as string;
  if (role !== 'ADMIN') redirect('/');

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { batches: true } },
      permissions: { include: { dataset: { select: { name: true, slug: true } } } },
    },
  });

  return (
    <div className="p-10 max-w-[1000px]">
      <div className="mb-10">
        <div className="eyebrow mb-2">USERS · 04</div>
        <h1 className="display-zh text-5xl text-ink">用户管理</h1>
        <p className="mt-3 text-sm text-ink-3">共 <span className="num text-cobalt">{users.length}</span> 个账号</p>
      </div>
      <UsersManager
        users={users.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          company: u.company,
          role: u.role,
          batches: u._count.batches,
          createdAt: u.createdAt.toISOString(),
          datasets: u.permissions.map((p) => ({ name: p.dataset.name, slug: p.dataset.slug })),
        }))}
        currentUserId={(session!.user as any).id}
      />
    </div>
  );
}
