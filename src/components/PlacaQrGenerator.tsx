import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

/**
 * Gera a placa da barbearia NO NAVEGADOR do próprio dono.
 *
 * Antes: o barbeiro clicava em "Pedir Placa", mandava WhatsApp, e alguém do
 * Agendei Fácil abria a arte, gerava o QR na mão, encaixava no quadrado branco
 * e devolvia a imagem — dezenas de vezes por mês.
 *
 * Agora: pega a MESMA arte (public/BARBEIRO3333.png), desenha o QR da página de
 * agendamento dele no quadrado branco e entrega o PNG. Duas versões:
 *
 *   completa → https://agendeifacil.com/booking/CODIGO
 *   simples  → https://agendeifacil.com/booking/CODIGO/af
 *
 * Não usa servidor, não grava nada no banco: é imagem + QR + download.
 */

// Domínio FIXO de propósito: a placa é impressa e vai para a porta. Se usasse
// window.location, um dono testando no celular/localhost imprimiria um QR que
// aponta para o lugar errado.
const BASE_URL = 'https://agendeifacil.com';

// A arte enviada hoje pelo suporte. Fica em public/ e é servida pelo próprio site.
const ARTE_PLACA = '/BARBEIRO3333.png';

// Onde fica o quadrado branco DENTRO da arte (medido pixel a pixel na imagem de
// 1414×2000). Se a arte for trocada por outra, é só remedir e ajustar aqui.
const QUADRADO_BRANCO = { x: 448, y: 1080, w: 512, h: 475 };

// Lado do QR dentro do quadrado: deixa uma margem branca em volta (a "zona
// quieta" que o leitor do celular precisa) sem encostar na moldura dourada.
const QR_LADO = 420;

type VarianteKey = 'completa' | 'simples';

interface Variante {
  key: VarianteKey;
  titulo: string;
  descricao: string;
  url: string;
  arquivo: string;
}

interface PlacaQrGeneratorProps {
  establishmentCode: string;
  establishmentName: string;
}

const carregarArte = (): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não consegui carregar a arte da placa. Tente de novo em instantes.'));
    img.src = ARTE_PLACA;
  });

async function desenharPlaca(url: string, arte: HTMLImageElement): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = arte.naturalWidth;
  canvas.height = arte.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Seu navegador não conseguiu desenhar a placa.');

  // 1) a arte inteira, como ela é
  ctx.drawImage(arte, 0, 0);

  // 2) o QR, em alta correção de erro: sobrevive a impressão ruim, vidro e reflexo
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, url, {
    width: QR_LADO,
    margin: 1,
    errorCorrectionLevel: 'H',
    color: { dark: '#111111', light: '#ffffff' },
  });

  // 3) centralizado no quadrado branco
  const x = QUADRADO_BRANCO.x + (QUADRADO_BRANCO.w - QR_LADO) / 2;
  const y = QUADRADO_BRANCO.y + (QUADRADO_BRANCO.h - QR_LADO) / 2;
  ctx.drawImage(qr, Math.round(x), Math.round(y), QR_LADO, QR_LADO);

  return canvas.toDataURL('image/png');
}

export const PlacaQrGenerator = ({ establishmentCode, establishmentName }: PlacaQrGeneratorProps) => {
  const codigo = String(establishmentCode || '').trim();
  const nome = String(establishmentName || '').trim();

  const variantes: Variante[] = [
    {
      key: 'completa',
      titulo: 'Página completa',
      descricao: 'QR leva para a sua página de agendamento normal, com tudo.',
      url: `${BASE_URL}/booking/${codigo}`,
      arquivo: `placa-${codigo}-completa.png`,
    },
    {
      key: 'simples',
      titulo: 'Página simples',
      descricao: 'QR leva para a versão enxuta, direto ao agendamento.',
      url: `${BASE_URL}/booking/${codigo}/af`,
      arquivo: `placa-${codigo}-simples.png`,
    },
  ];

  const [imagens, setImagens] = useState<Partial<Record<VarianteKey, string>>>({});
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const gerar = async () => {
    if (!codigo) {
      setErro('Não encontrei o código da sua barbearia. Recarregue a página.');
      return;
    }
    setGerando(true);
    setErro(null);
    try {
      const arte = await carregarArte();
      const resultado: Partial<Record<VarianteKey, string>> = {};
      for (const v of variantes) {
        resultado[v.key] = await desenharPlaca(v.url, arte);
      }
      setImagens(resultado);
    } catch (e: any) {
      setErro(String(e?.message || 'Não foi possível gerar a placa agora.'));
    } finally {
      setGerando(false);
    }
  };

  useEffect(() => {
    void gerar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo]);

  const baixar = (v: Variante) => {
    const dataUrl = imagens[v.key];
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = v.arquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success(`Placa (${v.titulo.toLowerCase()}) baixada. É só imprimir.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-lg font-extrabold text-gray-900">Sua placa está pronta</p>
          <p className="text-sm text-gray-700">
            {nome ? `${nome} — ` : ''}código {codigo || '—'}. Baixe, imprima e cole na porta.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { void gerar(); }}
          disabled={gerando}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-blue-300 bg-white text-blue-700 text-sm font-semibold hover:bg-blue-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${gerando ? 'animate-spin' : ''}`} />
          {gerando ? 'Gerando...' : 'Gerar de novo'}
        </button>
      </div>

      {erro && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {variantes.map((v) => {
          const img = imagens[v.key];
          return (
            <div key={v.key} className="rounded-xl border border-blue-200 bg-white p-3 sm:p-4 flex flex-col gap-3">
              <div>
                <p className="font-bold text-gray-900">{v.titulo}</p>
                <p className="text-xs text-gray-600">{v.descricao}</p>
              </div>

              <div className="rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center min-h-[260px]">
                {img ? (
                  <img src={img} alt={`Placa — ${v.titulo}`} className="w-full h-auto max-h-[560px] object-contain" />
                ) : (
                  <p className="text-sm text-gray-500 py-10">{gerando ? 'Gerando a placa...' : 'Placa ainda não gerada.'}</p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => baixar(v)}
                  disabled={!img || gerando}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-700 text-white font-bold hover:from-cyan-600 hover:via-blue-700 hover:to-indigo-800 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  Baixar PNG
                </button>
                <a
                  href={v.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-800 text-sm font-semibold hover:bg-gray-50"
                  title="Abre a página que o QR Code aponta, para você conferir"
                >
                  <ExternalLink className="h-4 w-4" />
                  Testar link
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-600">
        O QR foi gerado com correção alta de erro — funciona mesmo atrás de vidro ou com reflexo.
      </p>
    </div>
  );
};
