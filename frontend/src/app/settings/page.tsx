"use client";

import { Bell, Globe, Moon, Shield, Sun, Video } from "lucide-react";
import { useEffect, useState } from "react";

import { TopBar } from "@/components/shell/TopBar";
import { api, User } from "@/lib/api";
import { setTheme, useTheme } from "@/lib/theme";

function Row({ icon: Icon, title, hint, children }: { icon: typeof Bell; title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <Icon size={17} className="text-muted" />
      <div className="flex-1"><p className="text-[13.5px] font-medium">{title}</p><p className="text-xs text-muted">{hint}</p></div>
      {children}
    </div>
  );
}

const Soon = () => <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-faint">Coming soon</span>;

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const theme = useTheme();

  useEffect(() => { api.me().then(setUser).catch(() => {}); }, []);

  return (
    <>
      <TopBar title="Settings" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-6 px-6 py-8">
          <section>
            <h2 className="mb-2 text-[13px] font-semibold text-muted">Profile</h2>
            <div className="rounded-xl border border-line bg-panel px-5 py-4 text-[13.5px]">
              <p className="font-medium">{user?.name ?? "—"}</p>
              <p className="text-xs text-muted">{user?.email} · Signed in as the default workspace user</p>
            </div>
          </section>
          <section>
            <h2 className="mb-2 text-[13px] font-semibold text-muted">Appearance</h2>
            <div className="rounded-xl border border-line bg-panel">
              <Row icon={theme === "dark" ? Moon : Sun} title="Theme" hint="Fireflies uses a dark theme by default">
                <div className="inline-flex rounded-md bg-card p-0.5 text-[13px]">
                  {(["dark", "light"] as const).map((t) => (
                    <button key={t} onClick={() => setTheme(t)} className={`rounded px-3 py-1 capitalize ${theme === t ? "bg-hover text-text" : "text-muted"}`}>{t}</button>
                  ))}
                </div>
              </Row>
            </div>
          </section>
          <section>
            <h2 className="mb-2 text-[13px] font-semibold text-muted">Recording & Privacy</h2>
            <div className="divide-y divide-[var(--line)] rounded-xl border border-line bg-panel">
              <Row icon={Video} title="Auto-record meetings" hint="Fireflies notetaker joins and records calendar events"><Soon /></Row>
              <Row icon={Globe} title="Meeting language" hint="For transcripts and summaries"><Soon /></Row>
              <Row icon={Shield} title="Auto-delete meetings" hint="Delete meetings after a retention period"><Soon /></Row>
              <Row icon={Bell} title="Email recaps" hint="Send notes to participants after each meeting"><Soon /></Row>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
