"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Overview", icon: "◉" },
  { href: "/sessions", label: "Sessions", icon: "⟐" },
  { href: "/trends", label: "Trends", icon: "⟿" },
  { href: "/projects", label: "Projects", icon: "⊞" },
  { href: "/health", label: "Health", icon: "♥" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="fixed left-0 top-0 h-screen w-56 bg-surface-raised border-r border-border flex flex-col">
      <div className="p-5 border-b border-border">
        <h1 className="text-lg font-semibold tracking-tight text-text-primary">
          TokenTracker
        </h1>
        <p className="text-xs text-text-muted mt-0.5">Claude Code usage</p>
      </div>
      <div className="flex-1 py-3">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-accent/10 text-accent border-r-2 border-accent"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-overlay"
              }`}
            >
              <span className="text-base">{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </div>
      <div className="p-4 border-t border-border text-xs text-text-muted">
        Local Dashboard
      </div>
    </nav>
  );
}
