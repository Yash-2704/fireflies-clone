"use client";

import { Bot } from "lucide-react";
import { useEffect, useState } from "react";

import { AskFredChat } from "@/components/meeting/AskFredPanel";
import { api } from "@/lib/api";

/** AskFred across all meetings (Home) or one channel/tag (library). */
export function WorkspaceAskFred({ userName, tag }: { userName: string; tag?: string }) {
  const [meetingIds, setMeetingIds] = useState(new Map<string, number>());

  // Answers cite meetings as [[Title]]; map titles to ids so they become links.
  useEffect(() => {
    api.meetings({ tag }).then((r) => setMeetingIds(new Map(r.meetings.map((m) => [m.title.toLowerCase(), m.id])))).catch(() => {});
  }, [tag]);

  return (
    <aside className="hidden w-[380px] shrink-0 flex-col border-l border-line bg-panel xl:flex">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-[13px] font-medium">
        <Bot size={15} className="text-primary" /> AskFred {tag && <span className="chip">#{tag}</span>}
      </div>
      <AskFredChat
        key={tag ?? "all"}
        ask={(q, h) => api.askWorkspace(q, h, tag)}
        greeting={`Hi ${userName.split(" ")[0] || "there"}!`}
        subtitle={tag ? `Ask anything across #${tag} meetings` : "Ask anything across your meetings"}
        suggestions={["Pending tasks across all meetings", "List out my action items from the past week", "What key decisions were made recently?"]}
        quickChips={tag ? ["Summarize the channel", "Key initiatives"] : ["Key initiatives", "Open risks"]}
        meetingIds={meetingIds}
        placeholder="Ask anything across the meetings"
      />
    </aside>
  );
}
