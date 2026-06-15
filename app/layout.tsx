import type { Metadata } from 'next';
import './globals.css';
import SessionProvider from '@/components/SessionProvider';

export const metadata: Metadata = {
  title: 'YieldEx Bench · 芯测台',
  description: '芯片封测数据的录入、检索与分级定价分析平台',
};

// 不用 next/font/google（避免内网/防火墙环境拉不到 fonts.googleapis.com 导致 dev 阻塞）。
// 字体回退在 globals.css 里定义，使用系统字体优先。

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
