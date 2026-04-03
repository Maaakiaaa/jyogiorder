import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "文化祭モバイルオーダー",
  description: "文化祭用モバイルオーダーシステム",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
