import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/nav";

export const metadata: Metadata = {
  title: "TokenTracker",
  description: "Claude Code token usage dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="flex">
          <Nav />
          <main className="flex-1 ml-56 p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
