import { useState } from 'react';
import { Button } from '../../shared/ui/form';

/**
 * Códigos de respaldo en fuente monoespaciada (evita confundir l/I/1 y O/0) con copiar y descargar:
 * pedir que alguien los transcriba a mano es la forma más segura de que no los guarde.
 */
export function BackupCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const text = `Quatreros — códigos de respaldo (cada uno sirve una sola vez)\n\n${codes.join('\n')}\n`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quatreros-codigos-de-respaldo.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-3">
      <ul
        aria-label="Códigos de respaldo"
        className="grid grid-cols-2 gap-2 rounded-xl border border-grill bg-char p-4 font-mono text-base font-semibold"
      >
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void copy()}>
          Copiar
        </Button>
        <Button variant="secondary" onClick={download}>
          Descargar
        </Button>
      </div>
      <p role="status" className="text-caption text-ash">
        {copied === 'ok' ? 'Códigos copiados.' : copied === 'fail' ? 'No se pudo copiar; usa Descargar.' : ''}
      </p>
    </div>
  );
}
