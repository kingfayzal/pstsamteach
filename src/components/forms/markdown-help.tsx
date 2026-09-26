const EXAMPLES: ReadonlyArray<[string, string]> = [
  ["## Heading", "A section heading"],
  ["**bold**", "Bold text"],
  ["*italic*", "Italic text"],
  ["- item", "A bulleted list"],
  ["1. step", "A numbered list"],
  ["> note", "A highlighted note"],
  ["| a | b |", "A table (header row, then | --- | --- |)"],
];

/** Collapsible cheat sheet for the Markdown the lesson renderer supports. */
export function MarkdownHelp() {
  return (
    <details className="text-sm text-ink-soft">
      <summary className="cursor-pointer font-bold text-ink underline decoration-rule underline-offset-4">Formatting help</summary>
      <table className="mt-3 w-full max-w-md border-collapse">
        <tbody>
          {EXAMPLES.map(([code, meaning]) => (
            <tr key={code} className="border-b border-rule">
              <td className="py-1.5 pr-4">
                <code className="rounded bg-rule-soft px-1.5 py-0.5">{code}</code>
              </td>
              <td className="py-1.5">{meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
