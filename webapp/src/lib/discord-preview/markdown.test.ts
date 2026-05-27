import { describe, expect, test } from "vitest";
import { inlineMarkdown, renderMarkdown } from "./markdown";

describe("renderMarkdown (block)", () => {
  test("renders #/##/### as size-classed headings, not literal hashes", () => {
    const html = renderMarkdown("# title\n## sub\n### small");
    expect(html).toContain('<div class="md md-h1">title</div>');
    expect(html).toContain('<div class="md md-h2">sub</div>');
    expect(html).toContain('<div class="md md-h3">small</div>');
    expect(html).not.toContain("# title");
  });

  test("renders -# as subtext (checked before bullet)", () => {
    expect(renderMarkdown("-# a hint")).toBe('<div class="md md-sub">a hint</div>');
  });

  test("renders bullets and blank lines", () => {
    expect(renderMarkdown("- one")).toContain('class="md md-li">one');
    expect(renderMarkdown("")).toBe('<div class="md md-blank"></div>');
  });

  test("applies inline formatting inside a heading", () => {
    expect(renderMarkdown("## **iron** works")).toContain("<strong>iron</strong> works");
  });

  test("escapes html before formatting", () => {
    expect(renderMarkdown("a <script> b")).toContain("&lt;script&gt;");
  });
});

describe("inlineMarkdown", () => {
  test("handles bold/italic/code/link and newlines", () => {
    expect(inlineMarkdown("**b** *i* `c`")).toBe("<strong>b</strong> <em>i</em> <code>c</code>");
    expect(inlineMarkdown("a\nb")).toBe("a<br />b");
    expect(inlineMarkdown("[x](https://e.test)")).toContain('href="https://e.test"');
  });
});
