"use client";

import { Bell, CheckCircle2, ListChecks } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { api, Notification } from "@/lib/api";

const SEEN_KEY = "notifications-seen-at";

function readSeen() {
  try { return localStorage.getItem(SEEN_KEY) ?? ""; } catch { return ""; }
}

/** Bell + activity panel. Events come from /api/notifications; "unread" is per browser. */
export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [seenAt, setSeenAt] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSeenAt(readSeen()); // eslint-disable-line react-hooks/set-state-in-effect -- browser-only storage
    api.notifications().then(setItems).catch(() => {});
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const isUnread = (n: Notification) => n.at > seenAt;
  const unread = items.filter(isUnread).length;

  function toggle() {
    if (open) {
      // Closing marks everything as read.
      const now = new Date().toISOString().slice(0, 19);
      try { localStorage.setItem(SEEN_KEY, now); } catch {}
      setSeenAt(now);
    }
    setOpen(!open);
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={toggle} aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        className="relative rounded-md p-2 text-muted hover:bg-hover">
        <Bell size={17} />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-96 rounded-xl border border-line bg-panel shadow-2xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5 text-[13px]">
            <span className="font-medium">Notifications {unread > 0 && <span className="text-muted">· {unread} new</span>}</span>
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} className="accent-[var(--primary)]" /> Unread
            </label>
          </div>
          <div className="max-h-96 overflow-y-auto p-1.5">
            {items.filter((n) => !unreadOnly || isUnread(n)).map((n, i) => (
              <Link key={i} href={n.href} onClick={toggle}
                className="flex gap-3 rounded-lg px-3 py-2.5 hover:bg-hover">
                {n.kind === "tasks_due"
                  ? <ListChecks size={16} className="mt-0.5 shrink-0 text-primary" />
                  : <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">{n.title}</p>
                  <p className="truncate text-xs text-muted">{n.body}</p>
                </div>
                {isUnread(n) && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
              </Link>
            ))}
            {!items.length && <p className="px-3 py-8 text-center text-[13px] text-muted">You&apos;re all caught up.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
