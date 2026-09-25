import { colorFor, initials } from "@/lib/format";

export function Avatar({ name, size = 24, square = false }: { name: string; size?: number; square?: boolean }) {
  return (
    <span
      title={name}
      className={`inline-flex shrink-0 items-center justify-center font-semibold text-white ${square ? "rounded-md" : "rounded-full"}`}
      style={{ width: size, height: size, fontSize: size * 0.42, background: colorFor(name) }}
    >
      {initials(name).slice(0, size < 28 ? 1 : 2)}
    </span>
  );
}
