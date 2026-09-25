import { LucideIcon } from "lucide-react";

import { TopBar } from "@/components/shell/TopBar";

export function ComingSoon({ title, icon: Icon, description }: { title: string; icon: LucideIcon; description: string }) {
  return (
    <>
      <TopBar title={title} />
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary"><Icon size={22} /></div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-1 max-w-sm text-[13px] text-muted">{description}</p>
        <span className="mt-4 rounded-full border border-line px-3 py-1 text-xs text-muted">Coming soon</span>
      </div>
    </>
  );
}
