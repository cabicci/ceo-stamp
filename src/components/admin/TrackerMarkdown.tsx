import type { ReactNode } from "react";

function inlineFormat(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(
        <strong key={key++} style={{ fontWeight: 600 }}>
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      parts.push(
        <code
          key={key++}
          className="font-mono text-[12px] px-1"
          style={{ backgroundColor: "var(--surface)", borderRadius: "2px" }}
        >
          {token.slice(1, -1)}
        </code>,
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : [text];
}

function isTableRow(line: string): boolean {
  return line.trim().startsWith("|") && line.trim().endsWith("|");
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .slice(1, -1)
    .split("|")
    .map((c) => c.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

type Block =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "hr" }
  | { type: "ul"; items: string[] }
  | { type: "p"; text: string }
  | { type: "table"; headers: string[]; rows: string[][] };

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed === "---") {
      blocks.push({ type: "hr" });
      i += 1;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      blocks.push({ type: "h3", text: trimmed.slice(4) });
      i += 1;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      blocks.push({ type: "h2", text: trimmed.slice(3) });
      i += 1;
      continue;
    }
    if (trimmed.startsWith("# ")) {
      blocks.push({ type: "h1", text: trimmed.slice(2) });
      i += 1;
      continue;
    }

    if (isTableRow(trimmed)) {
      const headers = parseTableRow(trimmed);
      i += 1;
      if (i < lines.length && isTableSeparator(lines[i])) i += 1;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i].trim())) {
        rows.push(parseTableRow(lines[i]));
        i += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    if (trimmed.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        items.push(lines[i].trim().slice(2));
        i += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    const para: string[] = [trimmed];
    i += 1;
    while (i < lines.length && lines[i].trim() && !lines[i].trim().startsWith("#") && !lines[i].trim().startsWith("- ") && !isTableRow(lines[i].trim()) && lines[i].trim() !== "---") {
      para.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: "p", text: para.join(" ") });
  }

  return blocks;
}

export function TrackerMarkdown({ source }: { source: string }) {
  const blocks = parseBlocks(source);

  return (
    <article className="space-y-4 text-sm leading-relaxed" style={{ color: "var(--ink-text)" }}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "h1":
            return (
              <h2
                key={idx}
                className="font-display text-[22px] pt-2"
                style={{ fontWeight: 500, color: "var(--ink-text)" }}
              >
                {inlineFormat(block.text)}
              </h2>
            );
          case "h2":
            return (
              <h3
                key={idx}
                className="font-display text-[18px] pt-1"
                style={{ fontWeight: 500, color: "var(--ink-text)" }}
              >
                {inlineFormat(block.text)}
              </h3>
            );
          case "h3":
            return (
              <h4
                key={idx}
                className="font-mono text-[11px] uppercase tracking-[0.18em] pt-1"
                style={{ color: "var(--muted-text)" }}
              >
                {inlineFormat(block.text)}
              </h4>
            );
          case "hr":
            return (
              <hr key={idx} style={{ border: "none", borderTop: "1px solid var(--hairline)" }} />
            );
          case "ul":
            return (
              <ul key={idx} className="list-disc ps-5 space-y-1">
                {block.items.map((item, j) => (
                  <li key={j}>{inlineFormat(item)}</li>
                ))}
              </ul>
            );
          case "p":
            return <p key={idx}>{inlineFormat(block.text)}</p>;
          case "table":
            return (
              <div
                key={idx}
                className="overflow-x-auto rounded-[3px]"
                style={{ border: "1px solid var(--hairline)" }}
              >
                <table className="w-full text-sm">
                  <thead style={{ backgroundColor: "var(--surface)" }}>
                    <tr>
                      {block.headers.map((h, j) => (
                        <th
                          key={j}
                          className="text-start px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em]"
                          style={{ color: "var(--muted-text)" }}
                        >
                          {inlineFormat(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, ri) => (
                      <tr key={ri} style={{ borderTop: "1px solid var(--hairline)" }}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-2 align-top">
                            {inlineFormat(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return null;
        }
      })}
    </article>
  );
}
