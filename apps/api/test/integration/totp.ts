import { createHmac } from 'node:crypto';

/** Decodifica base32 (RFC 4648) — el secreto viene así en el enlace otpauth:// del QR. */
function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = input.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = alphabet.indexOf(char);
    if (idx < 0) throw new Error(`Carácter base32 inválido: ${char}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Código TOTP de 6 dígitos (RFC 6238, HMAC-SHA1, periodo 30 s) a partir del enlace otpauth://. */
export function totpFromUri(uri: string, now = Date.now()): string {
  const secret = new URL(uri).searchParams.get('secret');
  if (!secret) throw new Error('El enlace no trae secreto');
  const counter = Math.floor(now / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const code = ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString();
  return code.padStart(6, '0');
}
