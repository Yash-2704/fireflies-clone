"use client";

import { ListChecks } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { TopBar } from "@/components/shell/TopBar";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { api, Task } from "@/lib/api";
import { fmtTime } from "@/lib/format";

/** Every action item across meetings — the Fireflies Tasks page. */
export default function TasksPage() {
  const toast = useToast();
  const [status, setStatus] = useState<"open" | "done" | "all">("open");
  const [tasks, setTasks] = useState<Task[] | null>(null);

  const load = useCallback(() => {
    api.tasks(status).then(setTasks).catch((e) => toast.error(e.message));
  }, [status, toast]);
  useEffect(load, [load]);

  async function toggle(t: Task) {
    try {
      await api.updateActionItem(t.id, { is_completed: !t.is_completed });
      toast.success(t.is_completed ? "Task reopened" : "Task completed");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <TopBar title="Tasks" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-6">
          <div className="inline-flex rounded-md bg-card p-0.5 text-[13px]">
            {(["open", "done", "all"] as const).map((s) => (
              <button key={s} onClick={() => setStatus(s)} className={`rounded px-3 py-1 capitalize ${status === s ? "bg-hover text-text" : "text-muted"}`}>
                {s === "done" ? "Completed" : s}
              </button>
            ))}
          </div>
          <div className="mt-4 divide-y divide-[var(--line)] rounded-lg border border-line bg-panel">
            {tasks?.map((t) => (
              <div key={t.id} className="flex items-start gap-3 px-4 py-3">
                <input type="checkbox" checked={t.is_completed} onChange={() => toggle(t)} aria-label="Toggle complete"
                  className="mt-1 accent-[var(--primary)]" />
                <div className="min-w-0 flex-1">
                  <p className={`text-[13.5px] ${t.is_completed ? "text-faint line-through" : ""}`}>{t.text}</p>
                  <Link href={`/meetings/${t.meeting_id}${t.start_sec != null ? `?t=${Math.floor(t.start_sec)}` : ""}`}
                    className="text-xs text-muted hover:text-link">
                    {t.meeting_title}{t.start_sec != null && ` · ${fmtTime(t.start_sec)}`}
                  </Link>
                </div>
                {t.assignee && <span className="flex items-center gap-1.5 text-xs text-muted"><Avatar name={t.assignee.name} size={18} />{t.assignee.name}</span>}
              </div>
            ))}
            {tasks?.length === 0 && (
              <div className="py-14 text-center">
                <ListChecks size={24} className="mx-auto mb-3 text-faint" />
                <p className="font-medium">All your meeting tasks in one place</p>
                <p className="mt-1 text-[13px] text-muted">Action items from your meetings will show up here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
