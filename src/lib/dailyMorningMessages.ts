export type DailyMorningMessage = {
  quote: string;
  reference: string;
};

export const DAILY_MORNING_MESSAGES: DailyMorningMessage[] = [
  { quote: 'Tudo posso naquele que me fortalece.', reference: 'Filipenses 4:13' },
  { quote: 'Entrega o teu caminho ao Senhor.', reference: 'Salmos 37:5' },
  { quote: 'Seja forte e corajoso.', reference: 'Josué 1:9' },
  { quote: 'O Senhor é meu pastor; nada me faltará.', reference: 'Salmos 23:1' },
  { quote: 'Tudo tem o seu tempo determinado.', reference: 'Eclesiastes 3:1' },
  { quote: 'Não temas, porque eu sou contigo.', reference: 'Isaías 41:10' },
  { quote: 'Em todo trabalho há proveito.', reference: 'Provérbios 14:23' },
  { quote: 'Tudo quanto fizerdes, fazei de coração.', reference: 'Colossenses 3:23' },
  { quote: 'A alegria do Senhor é a nossa força.', reference: 'Neemias 8:10' },
  { quote: 'O justo florescerá.', reference: 'Salmos 92:12' },
  { quote: 'O homem faz planos, mas Deus dirige os passos.', reference: 'Provérbios 16:9' },
  { quote: 'A bênção do Senhor enriquece.', reference: 'Provérbios 10:22' },
  { quote: 'Tudo coopera para o bem.', reference: 'Romanos 8:28' },
  { quote: 'Bem-aventurado o homem que confia no Senhor.', reference: 'Jeremias 17:7' },
  { quote: 'A resposta branda desvia o furor.', reference: 'Provérbios 15:1' },
  { quote: 'Os que esperam no Senhor renovam as suas forças.', reference: 'Isaías 40:31' },
  { quote: 'O choro pode durar uma noite, mas a alegria vem pela manhã.', reference: 'Salmos 30:5' },
  { quote: 'Quem é fiel no pouco também é fiel no muito.', reference: 'Lucas 16:10' },
  { quote: 'Não andeis ansiosos por coisa alguma.', reference: 'Filipenses 4:6' },
  { quote: 'Melhor é o fim das coisas do que o começo.', reference: 'Eclesiastes 7:8' },
];

const SEEN_KEY_PREFIX = 'daily_message_seen_';
const ENABLED_KEY_PREFIX = 'daily_morning_message_enabled_';

export function getTodayDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildDailyMessageUserKey(userId?: string | null, professionalId?: string | null): string {
  const proId = String(professionalId || '').trim();
  if (proId) return `pro_${proId}`;
  const uid = String(userId || '').trim();
  if (uid) return `user_${uid}`;
  return 'anonymous';
}

export function buildDailyMessageSeenStorageKey(
  establishmentId: string,
  userKey: string,
  dateKey = getTodayDateKey()
): string {
  return `${SEEN_KEY_PREFIX}${establishmentId}_${userKey}_${dateKey}`;
}

export function buildDailyMorningMessageEnabledStorageKey(establishmentId: string): string {
  return `${ENABLED_KEY_PREFIX}${establishmentId}`;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getDailyMorningMessageForEstablishment(
  establishmentId: string,
  dateKey = getTodayDateKey()
): DailyMorningMessage {
  const messages = DAILY_MORNING_MESSAGES;
  if (messages.length === 0) {
    return { quote: 'Que seu dia seja abençoado.', reference: '' };
  }
  const index = hashString(`${establishmentId}_${dateKey}`) % messages.length;
  return messages[index];
}

export function hasSeenDailyMorningMessage(
  establishmentId: string,
  userKey: string,
  dateKey = getTodayDateKey()
): boolean {
  try {
    const key = buildDailyMessageSeenStorageKey(establishmentId, userKey, dateKey);
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function markDailyMorningMessageSeen(
  establishmentId: string,
  userKey: string,
  dateKey = getTodayDateKey()
): void {
  try {
    const key = buildDailyMessageSeenStorageKey(establishmentId, userKey, dateKey);
    localStorage.setItem(key, '1');
  } catch {
    // noop — não travar o sistema
  }
}

export function readDailyMorningMessageEnabledFromLocal(establishmentId: string): boolean | null {
  try {
    const raw = localStorage.getItem(buildDailyMorningMessageEnabledStorageKey(establishmentId));
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return null;
  } catch {
    return null;
  }
}

export function writeDailyMorningMessageEnabledToLocal(establishmentId: string, enabled: boolean): void {
  try {
    localStorage.setItem(buildDailyMorningMessageEnabledStorageKey(establishmentId), enabled ? 'true' : 'false');
  } catch {
    // noop
  }
}

export function resolveDailyMorningMessageEnabled(
  establishmentValue: unknown,
  establishmentId?: string | null
): boolean {
  if (establishmentValue === false) return false;
  if (establishmentValue === true) return true;
  const local = establishmentId ? readDailyMorningMessageEnabledFromLocal(establishmentId) : null;
  if (local === false) return false;
  return true;
}
