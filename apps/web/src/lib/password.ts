/**
 * Contraseña temporal fácil de dictar: sin caracteres que se confunden (0/O, 1/l/I),
 * en grupos de 4 separados por guion. 3 grupos × 4 de 56 símbolos ≈ 70 bits.
 */
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateTemporaryPassword(groups = 3): string {
  const out: string[] = [];
  const bytes = new Uint32Array(groups * 4);
  crypto.getRandomValues(bytes);
  for (let g = 0; g < groups; g++) {
    let chunk = '';
    for (let i = 0; i < 4; i++) chunk += ALPHABET.charAt((bytes[g * 4 + i] ?? 0) % ALPHABET.length);
    out.push(chunk);
  }
  return out.join('-');
}
