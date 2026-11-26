/** Escape a value for HTML text or double-quoted attribute contexts. */
export function escapeHtmlText(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Build a print document title from plain-text parts (never interpreted as markup). */
export function buildPrintTitle(...parts: Array<string | null | undefined>): string {
  return parts.map((p) => String(p ?? "").replace(/\s+/g, " ").trim()).filter(Boolean).join(" - ");
}

/**
 * Populate a print window using DOM APIs only: the title is set via textContent
 * and the body node is cloned, so user-controlled values stay literal text.
 */
export function renderPrintDocument(target: Document, opts: { title: string; css: string; body: Node }) {
  target.open();
  target.write('<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"></head><body></body></html>');
  target.close();
  const titleEl = target.createElement("title");
  titleEl.textContent = opts.title;
  target.head.appendChild(titleEl);
  const style = target.createElement("style");
  style.textContent = opts.css;
  target.head.appendChild(style);
  target.body.appendChild(target.importNode(opts.body, true));
}

/** Serialize a standalone HTML file with an escaped title and trusted React-rendered body markup. */
export function buildStandaloneHtml(title: string, css: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${escapeHtmlText(title)}</title><style>${css.replace(/<\/style/gi, "<\\/style")}</style></head><body>${bodyHtml}</body></html>`;
}
