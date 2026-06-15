'use client';
import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return (
    <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-xs text-ink-3 hover:text-ink underline underline-offset-4">
      退出登录
    </button>
  );
}
