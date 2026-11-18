// ════════════════════════════════════════════════════════════════════════
// 🎬 BARBEARIA DE APRESENTAÇÃO (vitrine para palestras e demonstrações)
// ════════════════════════════════════════════════════════════════════════
//
// SÓ as barbearias listadas em SHOWCASE_ESTABLISHMENT_IDS entram neste modo.
// Para TODAS as outras barbearias, as funções daqui respondem "não" e
// absolutamente nada muda no sistema.
//
// O que o modo faz, só para a barbearia listada:
//   • a agenda fica sempre no mesmo dia (SHOWCASE_FIXED_DATE_KEY);
//   • todo agendamento novo (link do cliente, "Reservar cliente",
//     "Trocar horário", encaixe) cai nesse mesmo dia;
//   • o financeiro abre no mês desse dia.
//
// Por que um dia no FUTURO e não "hoje": num dia futuro nenhum horário fica
// como "já passou", nada é concluído sozinho e nenhum lembrete é disparado.
// Assim dá para apresentar e agendar a qualquer hora do dia.
//
// A lista usa o ID (uuid) da barbearia e NUNCA o código de 4 dígitos:
// o ID nunca se repete; o código pode se repetir entre barbearias.
//
// Se um dia o SHOWCASE_FIXED_DATE_KEY estiver chegando perto, é preciso
// trocar a data aqui E mover os agendamentos de mentira para a nova data.

/** IDs (uuid, em minúsculas) das barbearias de apresentação. Vazio = modo desligado para todo mundo. */
export const SHOWCASE_ESTABLISHMENT_IDS: readonly string[] = [
  '9174629e-42ff-4366-9320-102b9c7d861b', // Barbearia Teste 2027 (código 8549) — conta de apresentação do Lucas
];

/** Dia fixo da agenda de apresentação (yyyy-MM-dd). 17/12/2027 é uma sexta-feira. */
export const SHOWCASE_FIXED_DATE_KEY = '2027-12-17';

export const isShowcaseEstablishmentId = (establishmentId: unknown): boolean => {
  if (SHOWCASE_ESTABLISHMENT_IDS.length === 0) return false;
  const normalized = String(establishmentId ?? '').trim().toLowerCase();
  if (!normalized) return false;
  return SHOWCASE_ESTABLISHMENT_IDS.includes(normalized);
};

export const isShowcaseEstablishment = (establishment: { id?: unknown } | null | undefined): boolean =>
  isShowcaseEstablishmentId(establishment?.id);

/** O dia fixo como Date, ao meio-dia local (meio-dia evita virar o dia por causa de fuso). */
export const getShowcaseFixedDate = (): Date => {
  const [year, month, day] = SHOWCASE_FIXED_DATE_KEY.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
};

/**
 * Para telas que guardam a data como texto (yyyy-MM-dd):
 * na barbearia de apresentação, qualquer data escolhida vira o dia fixo.
 * Texto vazio continua vazio (significa "ainda não escolheu").
 */
export const resolveShowcaseDateKey = (establishmentId: unknown, dateKey: string): string => {
  if (!dateKey) return dateKey;
  return isShowcaseEstablishmentId(establishmentId) ? SHOWCASE_FIXED_DATE_KEY : dateKey;
};
