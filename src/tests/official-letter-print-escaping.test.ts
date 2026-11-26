// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { buildPrintTitle, buildStandaloneHtml, escapeHtmlText, renderPrintDocument } from "@/lib/utils/print-window";

const evil = '</title><script>window.__pwned=1</script><img src=x onerror="alert(1)">';

function freshDoc() {
  return document.implementation.createHTMLDocument("");
}

describe("official letter print window", () => {
  it("keeps a markup/script-like employee name as literal title text", () => {
    const target = freshDoc();
    const body = document.createElement("div");
    body.textContent = "sheet";
    renderPrintDocument(target, { title: buildPrintTitle("شهادة راتب", evil), css: "", body });
    expect(target.title).toBe(`شهادة راتب - ${evil}`);
    expect(target.querySelectorAll("script").length).toBe(0);
    expect(target.querySelectorAll("img").length).toBe(0);
  });

  it("shows an ordinary Arabic name unchanged", () => {
    const target = freshDoc();
    const body = document.createElement("div");
    renderPrintDocument(target, { title: buildPrintTitle("شهادة خبرة", "محمد عبدالله"), css: "", body });
    expect(target.title).toBe("شهادة خبرة - محمد عبدالله");
  });

  it("escapes the title in the downloaded HTML file", () => {
    const html = buildStandaloneHtml(`خطاب - ${evil}`, "", "<p>x</p>");
    const parsed = new DOMParser().parseFromString(html, "text/html");
    expect(parsed.title).toBe(`خطاب - ${evil}`);
    expect(parsed.querySelectorAll("script").length).toBe(0);
    expect(escapeHtmlText(`a"b'<`)).toBe("a&quot;b&#39;&lt;");
  });
});
