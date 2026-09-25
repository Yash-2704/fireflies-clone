"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Player } from "@/components/meeting/usePlayer";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { ActionItem, api, MeetingDetail } from "@/lib/api";
import { fmtTime } from "@/lib/format";

/** Action items grouped by owner, like Fireflies. Text edits inline; owner via dropdown. */
export function ActionItems({ meeting, player, onChange }: {
  meeting: MeetingDetail;
  player: Player;
  onChange: (items: ActionItem[]) => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const [draftOwner, setDraftOwner] = useState<string>("");
  const items = meeting.action_items;

  async function run<T>(fn: () => Promise<T>, apply: (r: T) => ActionItem[], ok?: string) {
    try {
      const r = await fn();
      onChange(apply(r));
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const update = (item: ActionItem, body: Parameters<typeof api.updateActionItem>[1]) =>
    run(() => api.updateActionItem(item.id, body), (u) => items.map((i) => (i.id === u.id ? u : i)));

  const groups = new Map<string, ActionItem[]>();
  for (const i of items) {
    const k = i.assignee?.name ?? "Unassigned";
    groups.set(k, [...(groups.get(k) ?? []), i]);
  }

  return (
    <div>
      {[...groups].map(([owner, list]) => (
        <div key={owner} className="mb-4">
          <p className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold">
            {owner !== "Unassigned" && <Avatar name={owner} size={20} />} {owner}
          </p>
          {list.map((item) => (
            <div key={item.id} className="group flex items-start gap-2.5 rounded-md py-1 pl-1 hover:bg-card">
              <input type="checkbox" checked={item.is_completed} aria-label="Mark complete"
                onChange={() => update(item, { is_completed: !item.is_completed })}
                className="mt-1 accent-[var(--primary)]" />
              <div className="min-w-0 flex-1">
                <span contentEditable suppressContentEditableWarning role="textbox" aria-label="Action item text"
                  onBlur={(e) => {
                    const text = e.currentTarget.textContent?.trim() ?? "";
                    if (!text) e.currentTarget.textContent = item.text;
                    else if (text !== item.text) update(item, { text });
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
                  className={`rounded px-0.5 text-[13.5px] leading-relaxed outline-none focus:bg-hover ${item.is_completed ? "text-faint line-through" : ""}`}>
                  {item.text}
                </span>
                {item.start_sec != null && (
                  <button onClick={() => player.seek(item.start_sec!)} className="ml-1 text-[13px] text-link hover:underline">
                    ({fmtTime(item.start_sec)})
                  </button>
                )}
              </div>
              <select value={item.assignee?.id ?? ""} aria-label="Assignee"
                onChange={(e) => update(item, { assignee_id: e.target.value ? Number(e.target.value) : null })}
                className="max-w-28 rounded border border-transparent bg-transparent text-xs text-muted opacity-0 hover:border-line focus:opacity-100 group-hover:opacity-100">
                <option value="">Unassigned</option>
                {meeting.participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button aria-label="Delete action item"
                onClick={() => run(() => api.deleteActionItem(item.id), () => items.filter((i) => i.id !== item.id), "Action item deleted")}
                className="mt-0.5 text-faint opacity-0 hover:text-red-400 group-hover:opacity-100">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      ))}
      {items.length === 0 && <p className="mb-3 text-[13px] text-muted">No action items yet.</p>}

      <form className="flex items-center gap-2" onSubmit={(e) => {
        e.preventDefault();
        if (!draft.trim()) return;
        run(() => api.addActionItem(meeting.id, { text: draft.trim(), assignee_id: draftOwner ? Number(draftOwner) : null }),
          (created) => [...items, created], "Action item added");
        setDraft("");
      }}>
        <Plus size={15} className="text-faint" />
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add an action item"
          className="flex-1 bg-transparent py-1 text-[13px] outline-none placeholder:text-faint" />
        <select value={draftOwner} onChange={(e) => setDraftOwner(e.target.value)} aria-label="New item assignee"
          className="rounded border border-line bg-card px-1 py-1 text-xs text-muted">
          <option value="">Unassigned</option>
          {meeting.participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </form>
    </div>
  );
}
