/**
 * Telefone com país para o cadastro (/cadastrar): só Brasil, Portugal e Estados Unidos.
 * O campo aceita SÓ a quantidade de números de cada país — nada de 300 dígitos.
 * Usado na tela e conferido de novo no servidor (cakto-cadastro).
 */
export type PaisTelefoneCode = 'BR' | 'PT' | 'US';

export interface PaisTelefone {
  code: PaisTelefoneCode;
  nome: string;
  /** Código do país, sem o "+". */
  ddi: string;
  /** Quantidade de números SEM o código do país. */
  min: number;
  max: number;
  exemplo: string;
  dica: string;
}

export const PAISES_TELEFONE: PaisTelefone[] = [
  { code: 'BR', nome: 'Brasil', ddi: '55', min: 10, max: 11, exemplo: '(48) 99999-9999', dica: 'DDD + número' },
  { code: 'PT', nome: 'Portugal', ddi: '351', min: 9, max: 9, exemplo: '912 345 678', dica: '9 números' },
  { code: 'US', nome: 'Estados Unidos', ddi: '1', min: 10, max: 10, exemplo: '(201) 555-0123', dica: 'código de área + número' },
];

export const paisTelefone = (code: unknown): PaisTelefone =>
  PAISES_TELEFONE.find((p) => p.code === String(code || '').toUpperCase()) || PAISES_TELEFONE[0];

const soDigitos = (valor: unknown): string => {
  let out = '';
  for (const c of String(valor ?? '')) if (c >= '0' && c <= '9') out += c;
  return out;
};

/**
 * Deixa só os números do país escolhido, já cortado no tamanho máximo.
 * Se a pessoa colou o número com o código do país na frente (+55 48 9...), tira o código.
 */
export function limparTelefone(valor: unknown, paisCode: unknown): string {
  const pais = paisTelefone(paisCode);
  let digitos = soDigitos(valor);
  // zeros à esquerda (0 48 9...) não fazem parte do número
  while (digitos.startsWith('0')) digitos = digitos.slice(1);
  if (digitos.length > pais.max && digitos.startsWith(pais.ddi)) {
    digitos = digitos.slice(pais.ddi.length);
  }
  return digitos.slice(0, pais.max);
}

/** Máscara de exibição enquanto digita. */
export function formatarTelefone(digitosRaw: unknown, paisCode: unknown): string {
  const pais = paisTelefone(paisCode);
  const d = soDigitos(digitosRaw).slice(0, pais.max);
  if (!d) return '';
  if (pais.code === 'BR') {
    if (d.length <= 2) return `(${d}`;
    const ddd = d.slice(0, 2);
    const resto = d.slice(2);
    if (resto.length <= 4) return `(${ddd}) ${resto}`;
    const corte = d.length === 11 ? 5 : 4;
    if (resto.length <= corte) return `(${ddd}) ${resto}`;
    return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
  }
  if (pais.code === 'US') {
    if (d.length <= 3) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  // PT: 912 345 678
  const partes: string[] = [];
  for (let i = 0; i < d.length; i += 3) partes.push(d.slice(i, i + 3));
  return partes.join(' ');
}

export function validarTelefone(digitosRaw: unknown, paisCode: unknown): { ok: boolean; erro?: string } {
  const pais = paisTelefone(paisCode);
  const d = soDigitos(digitosRaw);
  if (!d) return { ok: false, erro: 'Digite o seu número de telefone.' };
  if (d.length > pais.max) return { ok: false, erro: `Número grande demais para ${pais.nome}.` };
  if (d.length < pais.min) {
    return {
      ok: false,
      erro:
        pais.code === 'BR'
          ? 'Número incompleto. Coloque o DDD e o número, por exemplo (48) 99999-9999.'
          : `Número incompleto. Em ${pais.nome} são ${pais.max} números, por exemplo ${pais.exemplo}.`,
    };
  }
  if (pais.code === 'BR') {
    const ddd = Number(d.slice(0, 2));
    if (!(ddd >= 11 && ddd <= 99) || d[1] === '0') return { ok: false, erro: 'DDD inválido. Confira os 2 primeiros números.' };
    if (d.length === 11 && d[2] !== '9') return { ok: false, erro: 'Celular com 11 números precisa começar com 9 depois do DDD.' };
  }
  if (pais.code === 'PT' && !'239'.includes(d[0])) {
    return { ok: false, erro: 'Número de Portugal inválido. Confira os 9 números.' };
  }
  if (pais.code === 'US' && (d[0] === '0' || d[0] === '1')) {
    return { ok: false, erro: 'Código de área inválido. Confira os 3 primeiros números.' };
  }
  return { ok: true };
}

/** Número completo para salvar (código do país + número), só dígitos. Ex.: 5548999999999. */
export function telefoneCompleto(digitosRaw: unknown, paisCode: unknown): string {
  const pais = paisTelefone(paisCode);
  return `${pais.ddi}${soDigitos(digitosRaw).slice(0, pais.max)}`;
}
