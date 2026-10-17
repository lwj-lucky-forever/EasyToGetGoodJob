import type { Metadata } from "next";
import { PwaServiceWorker } from "@/components/pwa-install";
import "./globals.css";

export const metadata: Metadata = {
  title: "EasyToGetGoodJob",
  description: "整理意向岗位、匹配简历、规划投递与面试准备。",
  applicationName: "EasyToGetGoodJob",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "EasyToGetGoodJob",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/offer-tower-illustrated-64.png",
    shortcut: "/offer-tower-illustrated-64.png",
    apple: "/offer-tower-illustrated-180.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport = {
  themeColor: "#0f172a",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <PwaServiceWorker />
        {children}
      </body>
    </html>
  );
}
