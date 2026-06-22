import type { NextAuthConfig } from 'next-auth';

// Edge-safe config — no Prisma imports here.
export const authConfig: NextAuthConfig = {
  // 允许在公网 IP / 内网 IP / 域名等任意 host 下访问；否则 NextAuth v5
  // 在 host 与 NEXTAUTH_URL 不一致时会抛 UntrustedHost。
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [], // 实际 provider 在 auth.ts 注入（Node 运行时）
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const isPublic =
        path.startsWith('/login') ||
        path.startsWith('/signup') ||
        path.startsWith('/api/auth') ||
        path.startsWith('/_next') ||
        path.startsWith('/sample-data');
      if (isPublic) return true;
      if (!auth) return false;
      const role = (auth.user as any)?.role;
      if ((path.startsWith('/rules') || path.startsWith('/users')) && role !== 'ADMIN') {
        return Response.redirect(new URL('/', request.nextUrl));
      }
      return true;
    },
  },
};
