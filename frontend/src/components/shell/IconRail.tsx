"use client";

import {
  BarChart3, Bot, Home, ListChecks, Plug, Settings, Sparkles, UserPlus, Video, Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS = [
  [{ href: "/", label: "Home", icon: Home }],
  [
    { href: "/meetings", label: "Meetings", icon: Video },
    { href: "/tasks", label: "Tasks", icon: ListChecks },
    { href: "/ai-skills", label: "AI Skills", icon: Sparkles },
  ],
  [
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/voice-agents", label: "Voice Agents", icon: Bot },
  ],
  [{ href: "/upgrade", label: "Upgrade", icon: Zap }],
];

const BOTTOM = [
  { href: "/team", label: "Invite teammates", icon: UserPlus },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings },
];

function RailLink({ href, label, icon: Icon }: (typeof BOTTOM)[number]) {
  const path = usePathname();
  const active = href === "/" ? path === "/" : path.startsWith(href);
  return (
    <Link href={href} aria-label={label}
      className={`group relative flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
        active ? "bg-hover text-text" : "text-muted hover:bg-hover hover:text-text"}`}>
      <Icon size={17} />
      <span className="pointer-events-none absolute left-11 z-50 whitespace-nowrap rounded-md border border-line bg-card px-2 py-1 text-xs text-text opacity-0 shadow-lg group-hover:opacity-100">
        {label}
      </span>
    </Link>
  );
}

export function IconRail() {
  return (
    <nav className="flex w-[52px] shrink-0 flex-col items-center border-r border-line bg-panel py-3">
      <span className="mb-3 flex h-7 w-7 items-center justify-center rounded-md bg-[#c22f5c] text-xs font-semibold text-white">Y</span>
      <div className="flex flex-1 flex-col items-center">
        {GROUPS.map((group, i) => (
          <div key={i} className="flex flex-col items-center gap-1 border-b border-line py-2 last:border-0">
            {group.map((l) => <RailLink key={l.href} {...l} />)}
          </div>
        ))}
      </div>
      <div className="flex flex-col items-center gap-1">
        {BOTTOM.map((l) => <RailLink key={l.href} {...l} />)}
      </div>
    </nav>
  );
}
