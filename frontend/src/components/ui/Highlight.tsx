const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Wraps case-insensitive matches of `query` in <mark>. */
export function Highlight({ text, query, currentIndex }: { text: string; query: string; currentIndex?: number }) {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escape(query.trim())})`, "gi"));
  let n = 0;
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? <mark key={i} className={currentIndex === n++ ? "current" : undefined} data-match>{p}</mark> : p,
      )}
    </>
  );
}

export function countMatches(text: string, query: string) {
  if (!query.trim()) return 0;
  return (text.match(new RegExp(escape(query.trim()), "gi")) ?? []).length;
}
