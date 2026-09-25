"use client";

import { mediaSrc } from "@/lib/api";

/** The page's single recording element; the player bar and transcript read time from it. */
export function MeetingMedia({ url, type, showVideo, onElement, onClick }: {
  url: string;
  type: "audio" | "video";
  showVideo: boolean;
  onElement: (el: HTMLMediaElement | null) => void;
  onClick: () => void;
}) {
  if (type === "audio") return <audio ref={onElement} src={mediaSrc(url)} preload="metadata" className="hidden" />;
  return (
    <div className={showVideo ? "sticky top-0 z-10 bg-bg px-8 pt-6" : "hidden"}>
      <video ref={onElement} src={mediaSrc(url)} preload="metadata" playsInline onClick={onClick}
        className="mx-auto max-h-[38vh] w-full max-w-2xl rounded-lg bg-black" />
    </div>
  );
}
