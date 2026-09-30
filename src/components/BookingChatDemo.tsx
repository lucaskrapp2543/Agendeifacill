import { useEffect, useRef, useState } from 'react';
import { CheckCheck } from 'lucide-react';

/**
 * Demonstração animada da Página Chat (/booking/:code/chat) para o dashboard.
 *
 * É um "celular" desenhado em HTML que reproduz a conversa em loop: balões
 * aparecendo um a um, "digitando…", botões de escolha e a confirmação. Leve
 * (sem vídeo, sem imagem) e personalizado com o nome/foto do estabelecimento.
 * Só apresentação: não chama banco nem cria nada.
 */

const WA = {
  bg: '#0b141a',
  header: '#202c33',
  incoming: '#202c33',
  outgoing: '#005c4b',
  accent: '#00a884',
  text: '#e9edef',
  muted: '#8696a0',
  ticks: '#53bdeb',
  chip: '#2a3942',
  chipBorder: '#3b4a54',
};

type DemoStep =
  | { from: 'bot'; text: string; chips?: string[]; grid?: string[]; delay?: number }
  | { from: 'user'; text: string; delay?: number };

const buildScript = (nome: string): DemoStep[] => [
  { from: 'bot', text: `Olá! 👋 Seja bem-vindo(a) à ${nome}!` },
  { from: 'bot', text: 'O que você deseja hoje?', chips: ['📅 Fazer um agendamento', '🔎 Ver meus agendamentos'] },
  { from: 'user', text: 'Fazer um agendamento 📅' },
  { from: 'bot', text: 'Boa! Pra começar, me diz seu nome:' },
  { from: 'user', text: 'Lucas' },
  { from: 'bot', text: 'Prazer, Lucas! 🙌 Agora me passa seu WhatsApp com DDD:' },
  { from: 'user', text: '(11) 99999-9999' },
  { from: 'bot', text: 'Perfeito! Qual serviço você deseja?', chips: ['Corte · R$ 45,00', 'Barba · R$ 30,00', 'Corte + Barba · R$ 60,00'] },
  { from: 'user', text: 'Corte + Barba · R$ 60,00' },
  { from: 'bot', text: 'Ótima escolha! 😄 Qual dia fica melhor?', grid: ['Hoje', 'Amanhã', 'Qui', 'Sex', 'Sáb', 'Seg'] },
  { from: 'user', text: 'Amanhã' },
  { from: 'bot', text: 'Vou puxar os horários disponíveis pra você… 🔎' },
  { from: 'bot', text: 'Horários livres amanhã:', grid: ['09:00', '09:30', '10:00', '10:30', '14:00', '15:30'] },
  { from: 'user', text: '10:00' },
  { from: 'bot', text: '👤 Lucas · ✂️ Corte + Barba · 📅 Amanhã às 10:00 · 💰 R$ 60,00', chips: ['Confirmar ✅'] },
  { from: 'user', text: 'Confirmar ✅' },
  { from: 'bot', text: 'Como você prefere pagar os R$ 60,00?', chips: ['💠 Pagar com PIX', '💳 Pagar com cartão'] },
  { from: 'user', text: 'Pagar com PIX 💠' },
  { from: 'bot', text: '✅ Tudo certo, Lucas! Seu horário está confirmado 🎉', delay: 3500 },
];

const typingDelayFor = (text: string) => Math.min(1300, Math.max(500, text.length * 22));

const Tail = ({ side }: { side: 'left' | 'right' }) => (
  <svg viewBox="0 0 8 13" width="7" height="11" className={`absolute top-0 ${side === 'left' ? '-left-[6px]' : '-right-[6px]'}`} aria-hidden>
    {side === 'left' ? <path d="M8 0 L0 0 C3 2 6 6 8 13 Z" fill={WA.incoming} /> : <path d="M0 0 L8 0 C5 2 2 6 0 13 Z" fill={WA.outgoing} />}
  </svg>
);

export function BookingChatDemo({ establishmentName, logoUrl }: { establishmentName?: string | null; logoUrl?: string | null }) {
  const nome = String(establishmentName || 'Sua Barbearia').trim() || 'Sua Barbearia';
  const script = buildScript(nome);
  const [shown, setShown] = useState<number>(0); // quantos passos já apareceram
  const [typing, setTyping] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = (index: number) => {
      if (cancelled) return;
      if (index >= script.length) {
        // Pausa no final e recomeça
        timer = setTimeout(() => {
          if (cancelled) return;
          setShown(0);
          run(0);
        }, 4000);
        return;
      }
      const step = script[index];
      if (step.from === 'bot') {
        setTyping(true);
        timer = setTimeout(() => {
          if (cancelled) return;
          setTyping(false);
          setShown(index + 1);
          timer = setTimeout(() => run(index + 1), step.delay ?? 700);
        }, typingDelayFor(step.text));
      } else {
        timer = setTimeout(() => {
          if (cancelled) return;
          setShown(index + 1);
          timer = setTimeout(() => run(index + 1), step.delay ?? 500);
        }, 900);
      }
    };

    run(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nome]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [shown, typing]);

  const initials = nome.split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase() || 'AF';

  return (
    <div
      className="w-full rounded-[22px] overflow-hidden flex flex-col select-none"
      style={{ aspectRatio: '9 / 16', backgroundColor: WA.bg, border: '6px solid #0d1117', boxShadow: '0 10px 30px rgba(0,0,0,0.45)' }}
      aria-label="Demonstração da página chat"
    >
      <style>{`@keyframes wa-demo-bounce { 0%, 80%, 100% { transform: translateY(0); opacity: .5 } 40% { transform: translateY(-3px); opacity: 1 } }`}</style>
      <div className="flex items-center gap-2 px-2.5 py-2 shrink-0" style={{ backgroundColor: WA.header }}>
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: '#008f72' }}>{initials}</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold truncate leading-tight" style={{ color: WA.text }}>{nome}</p>
          <p className="text-[10px] leading-tight" style={{ color: typing ? WA.accent : WA.muted }}>{typing ? 'digitando…' : 'online'}</p>
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-hidden px-2 py-2 flex flex-col gap-1 text-[11px]" style={{ color: WA.text }}>
        {script.slice(0, shown).map((step, i) => {
          const isUser = step.from === 'user';
          return (
            <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`relative max-w-[85%] rounded-lg px-2 py-1 ${isUser ? 'rounded-tr-none' : 'rounded-tl-none'}`} style={{ backgroundColor: isUser ? WA.outgoing : WA.incoming }}>
                <Tail side={isUser ? 'right' : 'left'} />
                <p className="leading-snug">{step.text}</p>
                {step.from === 'bot' && step.chips && (
                  <div className="flex flex-col gap-1 mt-1">
                    {step.chips.map((c, j) => (
                      <span key={j} className="rounded-lg px-2 py-1 text-center font-semibold" style={{ backgroundColor: j === 0 ? WA.accent : WA.chip, color: j === 0 ? '#0b141a' : WA.text, border: `1px solid ${j === 0 ? WA.accent : WA.chipBorder}` }}>
                        {c}
                      </span>
                    ))}
                  </div>
                )}
                {step.from === 'bot' && step.grid && (
                  <div className="grid grid-cols-3 gap-1 mt-1">
                    {step.grid.map((g, j) => (
                      <span key={j} className="rounded-md px-1 py-1 text-center font-semibold" style={{ backgroundColor: WA.chip, border: `1px solid ${WA.chipBorder}` }}>{g}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-end gap-0.5 mt-0.5">
                  <span className="text-[9px]" style={{ color: 'rgba(233,237,239,0.6)' }}>10:0{(i % 9) + 1}</span>
                  {isUser && <CheckCheck className="h-3 w-3" style={{ color: WA.ticks }} />}
                </div>
              </div>
            </div>
          );
        })}
        {typing && (
          <div className="flex justify-start">
            <div className="relative rounded-lg rounded-tl-none px-2 py-1.5" style={{ backgroundColor: WA.incoming }}>
              <Tail side="left" />
              <span className="inline-flex items-center gap-0.5 px-0.5">
                {[0, 1, 2].map((d) => (
                  <span key={d} className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: WA.muted, animation: 'wa-demo-bounce 1.2s infinite', animationDelay: `${d * 0.18}s` }} />
                ))}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 px-2 py-1.5 flex items-center gap-1.5" style={{ backgroundColor: WA.header }}>
        <div className="flex-1 rounded-full px-2.5 py-1.5 text-[10px]" style={{ backgroundColor: WA.chip, color: WA.muted }}>Mensagem</div>
        <div className="h-6 w-6 rounded-full" style={{ backgroundColor: WA.accent }} />
      </div>
    </div>
  );
}

export default BookingChatDemo;
