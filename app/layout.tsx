import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
 title: '同桌 · 两个人的自习室', description: '隔着距离，也能并肩。邀请你的学习搭子，一起专注、打卡、慢慢变好。',
 icons: { icon: '/favicon.svg' }, manifest: '/manifest.webmanifest',
 appleWebApp: { capable: true, title: '同桌', statusBarStyle: 'black-translucent' },
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
 return <html lang="zh-CN"><body>{children}</body></html>;
}
