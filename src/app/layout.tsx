import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "FlowDesk", template: "%s | FlowDesk" },
  description: "FlowDesk — a focused task and project management workspace",
  applicationName: "FlowDesk",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
