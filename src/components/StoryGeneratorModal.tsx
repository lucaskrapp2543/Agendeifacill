import { Download, Share2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * 📸 "Gerar story": desenha, em código, uma imagem 1080x1920 com a logo, o nome da
 * barbearia, os horários livres do dia e o link/QR de agendamento. O barbeiro só
 * escolhe o modelo e toca em Compartilhar (abre o Instagram/WhatsApp no celular) ou Baixar.
 * Só leitura: usa os horários que a agenda já calculou. Não grava nada.
 */
export interface StoryProfessionalSlots {
  id: string;
  name: string;
  freeTimes: string[];
}

interface StoryGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  establishmentName: string;
  establishmentCode: string;
  /** URL da logo já pronta para o navegador (pode ser vazia). */
  logoUrl?: string | null;
  /** Ex.: "HOJE · 21/10" ou "QUARTA · 22/10". */
  dateLabel: string;
  professionals: StoryProfessionalSlots[];
}

type TemplateId = 'dark' | 'gold' | 'neon';
type LinkKind = 'booking' | 'chat';

const BASE_URL = 'https://agendeifacil.com';
const W = 1080;
const H = 1920;

const TEMPLATES: Record<TemplateId, {
  label: string;
  bgTop: string;
  bgBottom: string;
  glow: string;
  accent: string;
  chipBg: string;
  chipBorder: string;
  text: string;
  muted: string;
}> = {
  dark: { label: 'Clássico', bgTop: '#0b0b0c', bgBottom: '#101814', glow: 'rgba(52,211,153,0.22)', accent: '#34d399', chipBg: '#0f2f22', chipBorder: '#34d399', text: '#ffffff', muted: 'rgba(255,255,255,0.65)' },
  gold: { label: 'Dourado', bgTop: '#0a0a0a', bgBottom: '#1a1408', glow: 'rgba(230,199,139,0.22)', accent: '#E6C78B', chipBg: '#2a2110', chipBorder: '#E6C78B', text: '#ffffff', muted: 'rgba(255,255,255,0.65)' },
  neon: { label: 'Neon', bgTop: '#1a0b2e', bgBottom: '#3b0764', glow: 'rgba(240,171,252,0.28)', accent: '#f0abfc', chipBg: '#4c1d95', chipBorder: '#f0abfc', text: '#ffffff', muted: 'rgba(255,255,255,0.7)' },
};

const FONT = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const initialsOf = (name: string): string => {
  const parts = String(name || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AF';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const loadImage = (url: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });

// PNG do canvas como File (null se falhar; toBlob joga SecurityError em canvas "sujo").
const canvasToPngFile = (canvas: HTMLCanvasElement, fileName: string) =>
  new Promise<File | null>((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob ? new File([blob], fileName, { type: 'image/png' }) : null), 'image/png');
    } catch {
      resolve(null);
    }
  });

// Só diz "Compartilhar" quando o navegador deixa compartilhar ESSE arquivo
// (precisa de https; pelo link de teste em http o celular não libera).
const canShareFile = (file: File | null): boolean => {
  try {
    return (
      file !== null &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] }) === true
    );
  } catch {
    return false;
  }
};

// Mesma regra de fallbackToOriginalStorageImage, só que para uma URL em texto:
// a versão reduzida (/render/image/) pode falhar em algum arquivo; aí volta pro original.
const originalStorageUrl = (url: string): string => {
  const RENDER_PREFIX = '/storage/v1/render/image/public/';
  if (!url || !url.includes(RENDER_PREFIX)) return '';
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.href : undefined);
    u.pathname = u.pathname.replace(RENDER_PREFIX, '/storage/v1/object/public/');
    ['width', 'height', 'resize', 'quality', 'format'].forEach((k) => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return '';
  }
};

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

/** Quebra o nome em até 2 linhas e reduz a fonte se ainda não couber. */
const drawTitle = (ctx: CanvasRenderingContext2D, text: string, y: number, maxWidth: number, color: string) => {
  let size = 68;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  const words = String(text || '').trim().split(/\s+/);
  const fits = (s: string, px: number) => {
    ctx.font = `800 ${px}px ${FONT}`;
    return ctx.measureText(s).width <= maxWidth;
  };
  while (size > 40 && !fits(text, size) && words.length === 1) size -= 4;
  ctx.font = `800 ${size}px ${FONT}`;
  if (fits(text, size)) {
    ctx.fillText(text, W / 2, y);
    return y + size;
  }
  // duas linhas
  let line1 = '';
  let line2 = '';
  for (const word of words) {
    const candidate = line1 ? `${line1} ${word}` : word;
    if (fits(candidate, size) && !line2) line1 = candidate;
    else line2 = line2 ? `${line2} ${word}` : word;
  }
  while (size > 40 && (!fits(line1, size) || !fits(line2, size))) size -= 4;
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.fillText(line1, W / 2, y);
  ctx.fillText(line2, W / 2, y + size + 8);
  return y + size * 2 + 8;
};

async function drawStory(params: {
  canvas: HTMLCanvasElement;
  template: TemplateId;
  establishmentName: string;
  dateLabel: string;
  professionals: StoryProfessionalSlots[];
  logoUrl: string;
  link: string;
  linkShort: string;
}) {
  const { canvas, template, establishmentName, dateLabel, professionals, logoUrl, linkShort } = params;
  const t = TEMPLATES[template];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Fundo
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, t.bgTop);
  bg.addColorStop(1, t.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 300, 50, W / 2, 300, 700);
  glow.addColorStop(0, t.glow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Logo (ou iniciais)
  const logo = (await loadImage(logoUrl)) || (await loadImage(originalStorageUrl(logoUrl)));
  const logoR = 95;
  const logoCx = W / 2;
  const logoCy = 240;
  ctx.save();
  ctx.beginPath();
  ctx.arc(logoCx, logoCy, logoR + 8, 0, Math.PI * 2);
  ctx.fillStyle = t.accent;
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.arc(logoCx, logoCy, logoR, 0, Math.PI * 2);
  ctx.clip();
  if (logo) {
    const side = Math.min(logo.naturalWidth, logo.naturalHeight);
    const sx = (logo.naturalWidth - side) / 2;
    const sy = (logo.naturalHeight - side) / 2;
    try {
      ctx.drawImage(logo, sx, sy, side, side, logoCx - logoR, logoCy - logoR, logoR * 2, logoR * 2);
    } catch {
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(logoCx - logoR, logoCy - logoR, logoR * 2, logoR * 2);
    }
  } else {
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(logoCx - logoR, logoCy - logoR, logoR * 2, logoR * 2);
    ctx.fillStyle = t.text;
    ctx.font = `800 70px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initialsOf(establishmentName), logoCx, logoCy + 4);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();

  // Nome + título + data
  let y = drawTitle(ctx, establishmentName, 420, W - 160, t.text);
  y += 70;
  ctx.textAlign = 'center';
  ctx.fillStyle = t.accent;
  ctx.font = `900 58px ${FONT}`;
  ctx.fillText('HORÁRIOS LIVRES', W / 2, y);
  y += 56;
  ctx.fillStyle = t.muted;
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText(dateLabel, W / 2, y);
  y += 70;

  // Horários por profissional
  const bottomStart = 1540;
  const totalFree = professionals.reduce((sum, p) => sum + p.freeTimes.length, 0);
  if (professionals.length === 0 || totalFree === 0) {
    ctx.fillStyle = t.text;
    ctx.font = `900 84px ${FONT}`;
    ctx.fillText('AGENDA CHEIA 🔥', W / 2, y + 220);
    ctx.fillStyle = t.muted;
    ctx.font = `600 44px ${FONT}`;
    ctx.fillText('Garanta seu horário pros próximos dias', W / 2, y + 300);
  } else {
    const n = professionals.length;
    const perProfessionalHeight = (bottomStart - y) / n;
    const rowsPerProfessional = Math.max(1, Math.min(3, Math.floor((perProfessionalHeight - 70) / 120)));
    const maxChips = rowsPerProfessional * 3;
    const chipW = 300;
    const chipH = 92;
    const gap = 24;
    const gridW = chipW * 3 + gap * 2;
    const startX = (W - gridW) / 2;

    for (const professional of professionals) {
      ctx.textAlign = 'center';
      ctx.fillStyle = t.text;
      ctx.font = `800 46px ${FONT}`;
      ctx.fillText(n > 1 ? `✂️ ${professional.name}` : `✂️ com ${professional.name}`, W / 2, y + 40);
      y += 70;

      if (professional.freeTimes.length === 0) {
        ctx.fillStyle = t.muted;
        ctx.font = `700 38px ${FONT}`;
        ctx.fillText('agenda cheia hoje 🔥', W / 2, y + 50);
        y += 120;
        continue;
      }

      const times = professional.freeTimes.slice(0, maxChips);
      const hiddenCount = professional.freeTimes.length - times.length;
      const chips = hiddenCount > 0 ? [...times.slice(0, maxChips - 1), `+${hiddenCount + 1}`] : times;
      chips.forEach((label, index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const x = startX + col * (chipW + gap);
        const cy = y + row * (chipH + gap);
        roundRect(ctx, x, cy, chipW, chipH, 26);
        ctx.fillStyle = t.chipBg;
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = t.chipBorder;
        ctx.stroke();
        ctx.fillStyle = t.text;
        ctx.font = `800 52px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + chipW / 2, cy + chipH / 2 + 2);
        ctx.textBaseline = 'alphabetic';
      });
      y += Math.ceil(chips.length / 3) * (chipH + gap) + 30;
    }
  }

  // Rodapé: chamada pro link (sem QR — ninguém escaneia QR olhando o story no próprio celular).
  // O barbeiro cola o link no sticker de link do story ou deixa na bio.
  const pillW = W - 160;
  const pillH = 120;
  const pillX = 80;
  const pillY = 1600;
  roundRect(ctx, pillX, pillY, pillW, pillH, 40);
  ctx.fillStyle = t.accent;
  ctx.fill();
  ctx.fillStyle = '#0b0b0c';
  ctx.font = `900 54px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('AGENDE PELO LINK 👇', W / 2, pillY + pillH / 2 + 2);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = t.text;
  ctx.font = `800 46px ${FONT}`;
  ctx.fillText(linkShort, W / 2, pillY + pillH + 80);
  ctx.fillStyle = t.muted;
  ctx.font = `600 32px ${FONT}`;
  ctx.fillText('toque no link do story ou veja na bio', W / 2, pillY + pillH + 135);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = `600 26px ${FONT}`;
  ctx.fillText('agendamento online com Agendei Fácil', W / 2, 1895);
}

export function StoryGeneratorModal({
  isOpen,
  onClose,
  establishmentName,
  establishmentCode,
  logoUrl,
  dateLabel,
  professionals,
}: StoryGeneratorModalProps) {
  const [template, setTemplate] = useState<TemplateId>('dark');
  const [professionalId, setProfessionalId] = useState<string>('all');
  const [linkKind, setLinkKind] = useState<LinkKind>('booking');
  const [dataUrl, setDataUrl] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [status, setStatus] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // PNG já pronto (gerado logo depois de desenhar): o "Compartilhar" precisa chamar
  // navigator.share() na hora do toque, sem esperar nada antes, senão o celular recusa.
  const fileRef = useRef<File | null>(null);
  const previewUrlRef = useRef<string>('');
  const [shareSupported, setShareSupported] = useState(false);

  // O pai recria o array a cada render; comparar pelo conteúdo evita redesenhar à toa
  // (e evita cancelar o arquivo do story antes de ele ficar pronto).
  const professionalsKey = JSON.stringify(professionals.map((p) => [p.id, p.name, p.freeTimes]));
  const selected = useMemo(() => {
    const list: StoryProfessionalSlots[] = (JSON.parse(professionalsKey) as [string, string, string[]][])
      .map(([id, name, freeTimes]) => ({ id, name, freeTimes }));
    return professionalId === 'all' ? list : list.filter((p) => p.id === professionalId);
  }, [professionalsKey, professionalId]);
  const link = `${BASE_URL}/booking/${establishmentCode}${linkKind === 'chat' ? '/chat' : ''}`;
  const linkShort = link.replace(/^https?:\/\//, '');
  const isMobileUA = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isSecure = typeof window !== 'undefined' && window.isSecureContext === true;
  const fileName = `story-${establishmentCode}-${dateLabel.replace(/[^\d]/g, '') || 'hoje'}.png`;

  useEffect(() => {
    if (!isOpen) {
      setDataUrl('');
      setStatus('');
      fileRef.current = null;
      setShareSupported(false);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = '';
      return;
    }
    let cancelled = false;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvasRef.current = canvas;
    setIsDrawing(true);
    fileRef.current = null;
    // Prévia + arquivo pronto + suporte a compartilhar, tudo junto (sem o botão "piscar").
    const publish = () => {
      // Logo de outro domínio sem CORS "suja" o canvas: getImageData joga SecurityError
      // (barato, sem codificar a imagem) e quem chamou cai no catch e redesenha sem logo.
      canvas.getContext('2d')?.getImageData(0, 0, 1, 1);
      void canvasToPngFile(canvas, fileName).then((file) => {
        if (cancelled) return;
        fileRef.current = file;
        setShareSupported(canShareFile(file));
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = file ? URL.createObjectURL(file) : '';
        setDataUrl(previewUrlRef.current);
      });
    };
    void drawStory({
      canvas,
      template,
      establishmentName,
      dateLabel,
      professionals: selected,
      logoUrl: String(logoUrl || ''),
      link,
      linkShort,
    })
      .then(() => {
        if (cancelled) return;
        try {
          publish();
        } catch {
          // Logo de outro domínio sem CORS "suja" o canvas: redesenha sem a logo.
          void drawStory({ canvas, template, establishmentName, dateLabel, professionals: selected, logoUrl: '', link, linkShort })
            .then(() => { if (!cancelled) publish(); });
        }
      })
      .finally(() => { if (!cancelled) setIsDrawing(false); });
    return () => { cancelled = true; };
  }, [isOpen, template, selected, establishmentName, dateLabel, logoUrl, link, linkShort, fileName]);

  const getFile = async (): Promise<File | null> => {
    if (fileRef.current) return fileRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const file = await canvasToPngFile(canvas, fileName);
    fileRef.current = file;
    return file;
  };

  const downloadFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const handleDownload = async () => {
    const file = await getFile();
    if (!file) return;
    downloadFile(file);
    setStatus('Imagem baixada. Abre o Instagram → Story, escolhe ela na galeria e posta! 😉');
  };

  const handleShare = () => {
    const file = fileRef.current;
    // Sem arquivo pronto ou sem suporte: baixa e avisa (nunca fica mudo).
    if (!file || !canShareFile(file)) {
      void handleDownload();
      return;
    }
    // navigator.share() direto no toque (sem await antes): é o que o celular exige.
    navigator
      .share({ files: [file], title: `Horários livres — ${establishmentName}` })
      .then(() => setStatus('Compartilhado! 🎉'))
      .catch((error: unknown) => {
        if (String((error as { name?: string } | null)?.name || '') === 'AbortError') return; // fechou o menu, tudo bem
        downloadFile(file);
        setStatus('O celular não deixou compartilhar direto, então baixei a imagem na galeria. Abre o Instagram → Story e escolhe ela.');
      });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0f1318] text-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4 sm:p-5">
          <div className="min-w-0">
            <h3 className="text-lg font-black sm:text-xl">📸 Story dos horários livres</h3>
            <p className="mt-0.5 text-xs text-gray-400">Imagem pronta pro Instagram/WhatsApp com os horários livres de {dateLabel.toLowerCase()}.</p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-1.5 text-gray-300 hover:bg-white/10 hover:text-white" title="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:flex-row sm:p-5">
          <div className="space-y-4 sm:w-72 sm:shrink-0">
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Modelo</p>
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.keys(TEMPLATES) as TemplateId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTemplate(id)}
                    className={`rounded-xl border px-2 py-2 text-xs font-bold transition-colors ${template === id ? 'border-amber-400 bg-amber-400 text-black' : 'border-white/10 bg-white/5 text-gray-200 hover:bg-white/10'}`}
                  >
                    {TEMPLATES[id].label}
                  </button>
                ))}
              </div>
            </div>

            {professionals.length > 1 && (
              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Profissional</p>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setProfessionalId('all')} className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${professionalId === 'all' ? 'border-amber-400 bg-amber-400 text-black' : 'border-white/10 bg-white/5 text-gray-200 hover:bg-white/10'}`}>Todos</button>
                  {professionals.map((p) => (
                    <button key={p.id} type="button" onClick={() => setProfessionalId(p.id)} className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${professionalId === p.id ? 'border-amber-400 bg-amber-400 text-black' : 'border-white/10 bg-white/5 text-gray-200 hover:bg-white/10'}`}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Link na imagem</p>
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" onClick={() => setLinkKind('booking')} className={`rounded-xl border px-2 py-2 text-xs font-bold ${linkKind === 'booking' ? 'border-amber-400 bg-amber-400 text-black' : 'border-white/10 bg-white/5 text-gray-200 hover:bg-white/10'}`}>Página completa</button>
                <button type="button" onClick={() => setLinkKind('chat')} className={`rounded-xl border px-2 py-2 text-xs font-bold ${linkKind === 'chat' ? 'border-amber-400 bg-amber-400 text-black' : 'border-white/10 bg-white/5 text-gray-200 hover:bg-white/10'}`}>Chat</button>
              </div>
              <p className="mt-1 break-all text-[11px] text-gray-500">{linkShort}</p>
            </div>

            <div className="space-y-2 pt-1">
              <button type="button" onClick={handleShare} disabled={isDrawing || !dataUrl} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-orange-500 px-3 py-3 text-sm font-black text-white shadow-lg hover:from-pink-400 hover:to-orange-400 disabled:opacity-50">
                {shareSupported ? <Share2 className="h-4 w-4" /> : <Download className="h-4 w-4" />} {shareSupported ? 'Compartilhar' : 'Baixar imagem'}
              </button>
              {shareSupported && (
                <button type="button" onClick={() => void handleDownload()} disabled={isDrawing || !dataUrl} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50">
                  <Download className="h-4 w-4" /> Baixar
                </button>
              )}
              {status && <p className="text-center text-xs text-emerald-300">{status}</p>}
              <p className="text-[11px] leading-relaxed text-gray-500">
                {shareSupported
                  ? 'Toque em Compartilhar e, no menu do celular, escolha Instagram → Stories ou WhatsApp → Meu status.'
                  : isMobileUA && !isSecure
                    ? 'Nesse link de teste (sem https) o celular não libera o compartilhar direto. No site publicado o botão abre o Instagram/WhatsApp. Por enquanto, baixa a imagem e posta pela galeria.'
                    : 'No computador a imagem é baixada. No celular, com o site publicado, o botão abre o Instagram (Stories) ou o WhatsApp.'}
              </p>
            </div>
          </div>

          <div className="flex flex-1 items-start justify-center">
            <div className="relative aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-2xl border border-white/10 bg-black shadow-xl">
              {dataUrl ? (
                <img src={dataUrl} alt="Prévia do story" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">Montando a imagem…</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StoryGeneratorModal;
