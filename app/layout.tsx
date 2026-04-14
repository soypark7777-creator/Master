import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SoulTree Vision",
  description: "Real-time concert analysis dashboard"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
