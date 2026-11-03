import type { ReactNode } from 'react';

/** Renderiza el texto del asistente con párrafos, listas y negritas sin mostrar `**`. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}

type Block =
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'list'; items: string[] }
  | { kind: 'heading'; text: string }
  | { kind: 'table'; lines: string[] };

function blocksOf(text: string): Block[] {
  const lines = text.replaceAll('\r\n', '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let table: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'paragraph', lines: paragraph });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length > 0) {
      blocks.push({ kind: 'list', items: list });
      list = [];
    }
  };
  const flushTable = () => {
    if (table.length > 0) {
      blocks.push({ kind: 'table', lines: table });
      table = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      flushParagraph();
      flushList();
      flushTable();
      continue;
    }
    if (/^\|.*\|$/.test(trimmed)) {
      flushParagraph();
      flushList();
      table.push(trimmed);
      continue;
    }
    flushTable();
    const bullet = trimmed.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1] ?? '');
      continue;
    }
    flushList();
    const heading = trimmed.match(/^#{1,4}\s+(.*)$/);
    if (heading) {
      flushParagraph();
      blocks.push({ kind: 'heading', text: heading[1] ?? '' });
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  flushTable();
  return blocks;
}

export function AssistantMessage({ text }: { text: string }) {
  return (
    <div className="space-y-2 whitespace-pre-wrap break-words">
      {blocksOf(text).map((block, index) => {
        if (block.kind === 'heading') {
          return (
            <p key={index} className="pt-1 font-display text-[13px] font-bold text-ink">
              {inline(block.text)}
            </p>
          );
        }
        if (block.kind === 'list') {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{inline(item)}</li>
              ))}
            </ul>
          );
        }
        if (block.kind === 'table') {
          return (
            <pre
              key={index}
              className="scroll-thin overflow-x-auto rounded-lg border border-line bg-surface px-2 py-1.5 text-[10px] leading-4"
            >
              {block.lines.join('\n')}
            </pre>
          );
        }
        return (
          <p key={index} className="whitespace-pre-wrap">
            {block.lines.map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 ? '\n' : null}
                {inline(line)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
