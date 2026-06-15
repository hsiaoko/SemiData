import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SignOutButton } from '@/components/SignOutButton';

const NAV = [
  { href: '/', label: '工作台', code: '00' },
  { href: '/upload', label: '数据录入', code: '01', adminOnly: true },
  { href: '/datasets', label: '数据集', code: '02' },
  { href: '/batches', label: '批次浏览', code: '03' },
  { href: '/rules', label: '规则配置', code: '04', adminOnly: true },
  { href: '/users', label: '用户管理', code: '05', adminOnly: true },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const role = (session.user as any).role as string;
  const name = session.user.name ?? session.user.email;

  return (
    <div className="min-h-screen flex">
      <aside className="w-[220px] shrink-0 border-r border-line bg-surface flex flex-col">
        <div className="p-6 border-b border-line">
          <div className="display-en text-lg leading-none">SemiData</div>
          <div className="serial mt-1.5">FAB-OS · v0.1</div>
        </div>
        <nav className="flex-1 py-4">
          {NAV.filter((n) => !n.adminOnly || role === 'ADMIN').map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="block px-6 py-2.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors group"
            >
              <span className="num text-2xs text-ink-3 mr-3 group-hover:text-cobalt">{n.code}</span>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="p-6 border-t border-line">
          <div className="serial mb-1">SIGNED IN</div>
          <div className="text-sm text-ink">{name}</div>
          <div className="text-2xs text-ink-3 font-mono mt-0.5">{role === 'ADMIN' ? '管理员 · ADMIN' : '工程师 · USER'}</div>
          <div className="mt-3"><SignOutButton /></div>
        </div>
      </aside>
      <main className="flex-1 min-w-0 substrate-noise">{children}</main>
    </div>
  );
}
