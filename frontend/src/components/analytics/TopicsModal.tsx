"use client";

import { Hash, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, Topic } from "@/lib/api";

/** Create / delete topic trackers (keyword sets tracked across meetings). */
export function TopicsModal({ onClose, onChange }: { onClose: () => void; onChange: () => void }) {
  const toast = useToast();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => { api.topics().then(setTopics).catch((e) => toast.error(e.message)); }, [toast]);

  const addKeyword = (raw: string) => {
    const k = raw.trim().toLowerCase();
    if (k && !keywords.includes(k)) setKeywords([...keywords, k]);
    setDraft("");
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const all = draft.trim() ? [...keywords, draft.trim().toLowerCase()] : keywords;
    if (!name.trim() || !all.length) return toast.error("Add a title and at least one keyword");
    try {
      const t = await api.createTopic(name.trim(), all);
      setTopics([...topics, t].sort((a, b) => a.name.localeCompare(b.name)));
      setName(""); setKeywords([]); setDraft("");
      toast.success(`Topic “${t.name}” created`);
      onChange();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function remove(t: Topic) {
    try {
      await api.deleteTopic(t.id);
      setTopics(topics.filter((x) => x.id !== t.id));
      toast.success("Topic deleted");
      onChange();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Modal title="Topic trackers" onClose={onClose}>
      <p className="mb-4 text-xs text-muted">Track keywords like competitor names or product areas and see how often they come up across meetings.</p>
      <div className="mb-5 space-y-2">
        {topics.map((t) => (
          <div key={t.id} className="flex items-start gap-2 rounded-lg border border-line bg-card p-2.5">
            <Hash size={14} className="mt-0.5 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium">{t.name}</p>
              <p className="truncate text-xs text-muted">{t.keywords.join(", ")}</p>
            </div>
            <button onClick={() => remove(t)} aria-label={`Delete ${t.name}`} className="text-faint hover:text-red-400"><Trash2 size={13} /></button>
          </div>
        ))}
        {!topics.length && <p className="text-xs text-faint">No topics yet.</p>}
      </div>
      <form onSubmit={save} className="space-y-3 border-t border-line pt-4">
        <label className="block text-xs text-muted">Title
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Competitors" className="input mt-1" />
        </label>
        <label className="block text-xs text-muted">Keywords (press Enter or comma to add)
          <div className="input mt-1 flex flex-wrap items-center gap-1.5">
            {keywords.map((k) => (
              <span key={k} className="chip text-text">{k}
                <button type="button" onClick={() => setKeywords(keywords.filter((x) => x !== k))} aria-label={`Remove ${k}`}><X size={11} /></button>
              </span>
            ))}
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={keywords.length ? "" : "e.g. hubspot, salesforce"}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addKeyword(draft); } }}
              className="min-w-24 flex-1 bg-transparent outline-none" />
          </div>
        </label>
        <div className="flex justify-end"><button className="btn-primary">Save topic</button></div>
      </form>
    </Modal>
  );
}
