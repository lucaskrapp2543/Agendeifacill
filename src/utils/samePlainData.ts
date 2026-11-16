/**
 * Compara dois dados "simples" (o que vem do banco: texto, número, booleano, null,
 * listas e objetos comuns) campo por campo.
 *
 * Uso: a atualização automática da agenda (a cada 30s) só troca a lista na tela quando
 * ALGUMA coisa mudou de verdade. Se tudo for igual, a tela não é redesenhada à toa.
 *
 * Regra de segurança: na dúvida, responde "diferente" (e a tela redesenha como sempre fez).
 * Ex.: Date, Map ou qualquer objeto que não seja um objeto comum → "diferente".
 */
export const isSamePlainValue = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!isSamePlainValue(a[i], b[i])) return false;
    }
    return true;
  }

  const protoA = Object.getPrototypeOf(a);
  const protoB = Object.getPrototypeOf(b);
  const isPlainA = protoA === Object.prototype || protoA === null;
  const isPlainB = protoB === Object.prototype || protoB === null;
  if (!isPlainA || !isPlainB) return false;

  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA).filter((key) => objA[key] !== undefined);
  const keysB = Object.keys(objB).filter((key) => objB[key] !== undefined);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!isSamePlainValue(objA[key], objB[key])) return false;
  }
  return true;
};

/** Mesma lista (mesma ordem, mesmos itens, mesmos valores em todos os campos)? */
export const isSamePlainList = (a: readonly unknown[], b: readonly unknown[]): boolean => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (!isSamePlainValue(a[i], b[i])) return false;
  }
  return true;
};
