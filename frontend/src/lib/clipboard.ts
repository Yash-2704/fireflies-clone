/**
 * Copy text, falling back to a hidden textarea + execCommand when the async Clipboard API is
 * unavailable or blocked (e.g. embedded browsers without clipboard permission).
 * Resolves true on success so callers can show the right toast.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = Object.assign(document.createElement("textarea"), { value: text });
    area.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

/** Copy and report the outcome with a toast. */
export async function copyAndNotify(
  toast: { success: (m: string) => void; error: (m: string) => void }, text: string, message: string,
) {
  if (await copyText(text)) toast.success(message);
  else toast.error("Couldn't copy — clipboard access is blocked in this browser");
}
