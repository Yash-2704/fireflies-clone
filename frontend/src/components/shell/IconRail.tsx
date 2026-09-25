"use client";

import {
  BarChart3, Bot, Home, ListChecks, LogOut, Moon, Plug, Settings, Sparkles, Sun, UserPlus, Video, Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useToast } from "@/components/ui/Toast";
import { api, User } from "@/lib/api";
import { setTheme, useTheme } from "@/lib/theme";

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
      <ProfileMenu />
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

/** Avatar menu: profile placeholder (auth is out of scope), settings, theme. */
function ProfileMenu() {
  const toast = useToast();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { api.me().then(setUser).catch(() => {}); }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const item = "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] hover:bg-hover";
  return (
    <div ref={ref} className="relative mb-3">
      <button onClick={() => setOpen(!open)} aria-label="Profile menu" aria-expanded={open}
        className="flex h-7 w-7 items-center justify-center rounded-md bg-[#c22f5c] text-xs font-semibold text-white hover:ring-2 hover:ring-[var(--primary)]">
        {user?.name[0] ?? "Y"}
      </button>
      {open && (
        <div className="absolute left-10 top-0 z-50 w-60 rounded-lg border border-line bg-panel p-1 shadow-2xl">
          <div className="border-b border-line px-2 pb-2 pt-1.5">
            <p className="text-[13px] font-medium">Hi {user?.name.split(" ")[0] ?? "there"}</p>
            <p className="truncate text-xs text-muted">{user?.email}</p>
            <p className="mt-1.5 text-[11px] text-faint">Business · Unlimited meetings</p>
          </div>
          <Link href="/settings" onClick={() => setOpen(false)} className={item}><Settings size={14} className="text-muted" /> Settings</Link>
          <Link href="/team" onClick={() => setOpen(false)} className={item}><UserPlus size={14} className="text-muted" /> My Team</Link>
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className={item}>
            {theme === "dark" ? <Sun size={14} className="text-muted" /> : <Moon size={14} className="text-muted" />}
            Theme <span className="ml-auto text-xs capitalize text-faint">{theme}</span>
          </button>
          <div className="my-1 border-t border-line" />
          <button onClick={() => { setOpen(false); toast.success("Signed in as the demo user — authentication is a placeholder"); }}
            className={item}><LogOut size={14} className="text-muted" /> Log out</button>
        </div>
      )}
    </div>
  );
}
