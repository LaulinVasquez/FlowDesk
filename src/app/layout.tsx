import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tideline — Focused work",
  description: "A polished task management dashboard"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
