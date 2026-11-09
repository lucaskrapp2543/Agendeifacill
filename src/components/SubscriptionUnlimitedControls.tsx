import { useState } from 'react';
import {
  UNLIMITED_SERVICE_LIMIT,
  isUnlimitedServiceLimit,
  type UnlimitedCommissionModel,
} from '../utils/subscriptionUnlimited';

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const toNumber = (raw: unknown) => {
  const n = Number(String(raw ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/** Campo "Limite de atendimentos" de um serviço do plano, com o botão "Ilimitado". */
export const ServiceLimitField = ({
  limit,
  onChange,
  focusClass = 'focus:border-gray-500',
}: {
  limit: number;
  onChange: (limit: number) => void;
  focusClass?: string;
}) => {
  const unlimited = isUnlimitedServiceLimit(limit);
  // Volta para o último número usado quando tira o "Ilimitado".
  const [lastLimit, setLastLimit] = useState<number>(unlimited || !(limit > 0) ? 4 : limit);

  return (
    <div>
      <label className="mb-1 block text-[11px] text-gray-400">Limite de atendimentos</label>
      {unlimited ? (
        <button
          type="button"
          onClick={() => onChange(lastLimit)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-violet-400/70 bg-violet-500/25 px-3 py-2 text-sm font-bold text-violet-50 hover:bg-violet-500/35"
          title="Tocar para voltar a ter limite"
        >
          ♾️ Ilimitado
        </button>
      ) : (
        <input
          type="number"
          min={1}
          step={1}
          value={limit}
          onChange={(e) => {
            const next = Number(e.target.value || 0);
            if (next > 0 && next < UNLIMITED_SERVICE_LIMIT) setLastLimit(next);
            onChange(next);
          }}
          placeholder="Ex: 4"
          className={`w-full rounded-lg border border-white/10 bg-[#111213] px-3 py-2 text-white focus:outline-none ${focusClass}`}
        />
      )}
      <button
        type="button"
        onClick={() => {
          if (unlimited) {
            onChange(lastLimit);
          } else {
            if (limit > 0) setLastLimit(limit);
            onChange(UNLIMITED_SERVICE_LIMIT);
          }
        }}
        className={`mt-1.5 w-full rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors ${unlimited
          ? 'border-white/15 bg-transparent text-gray-300 hover:bg-white/5'
          : 'border-violet-400/50 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20'
          }`}
      >
        {unlimited ? 'Colocar limite' : '♾️ Deixar ilimitado'}
      </button>
    </div>
  );
};

type PickerProps = {
  model: UnlimitedCommissionModel | '';
  onModelChange: (model: UnlimitedCommissionModel) => void;
  planValue: number;
  percent: string;
  onPercentChange: (value: string) => void;
  divideQty: string;
  onDivideQtyChange: (value: string) => void;
  focusClass?: string;
};

const OPTIONS: Array<{ id: UnlimitedCommissionModel; title: string; text: string }> = [
  {
    id: 'fixo',
    title: 'Comissão por atendimento',
    text: 'Cada visita paga uma % do valor do plano ao barbeiro que atendeu.',
  },
  {
    id: 'dividir',
    title: 'Dividir valor total',
    text: 'O valor do plano é dividido por uma quantidade de visitas que você escolhe. Cada visita paga esse pedaço, mesmo passando da quantidade.',
  },
  {
    id: 'pontos',
    title: 'Por pontos',
    text: 'Cada visita vale 1 ponto para o barbeiro. O sistema conta os pontos e você decide quanto paga.',
  },
];

/** Aparece quando algum serviço do plano está como "Ilimitado": escolhe como dividir a comissão. */
export const UnlimitedCommissionPicker = ({
  model,
  onModelChange,
  planValue,
  percent,
  onPercentChange,
  divideQty,
  onDivideQtyChange,
  focusClass = 'focus:border-gray-500',
}: PickerProps) => {
  const pct = toNumber(percent);
  const qty = toNumber(divideQty);
  const commission = Math.round(planValue * (pct / 100) * 100) / 100;
  const inputClass = `w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white placeholder-gray-500 focus:outline-none ${focusClass}`;

  const example = (() => {
    if (model === 'fixo') {
      if (!(planValue > 0) || !(pct > 0)) return 'Preencha a % para ver quanto cada visita paga.';
      const aviso = commission >= planValue ? ' Atenção: cada visita paga o valor do plano inteiro.' : '';
      return `Cada visita paga ${fmtBRL(commission)}. Se o cliente vier 5 vezes no mês, são ${fmtBRL(commission * 5)}.${aviso}`;
    }
    if (model === 'dividir') {
      if (!(planValue > 0) || !(qty > 0)) return 'Preencha a quantidade de visitas para ver quanto cada uma paga.';
      const base = pct > 0 ? commission : planValue;
      const porVisita = Math.round((base / qty) * 100) / 100;
      return `Cada visita paga ${fmtBRL(porVisita)} (${fmtBRL(base)} ÷ ${qty}). Se o cliente vier mais de ${qty} vezes, as visitas a mais também pagam ${fmtBRL(porVisita)}.`;
    }
    if (model === 'pontos') return 'Nenhum valor em R$ é calculado por visita. Em Meus Assinantes aparecem os pontos de cada barbeiro.';
    return '';
  })();

  return (
    <div className="rounded-lg border border-violet-400/50 bg-violet-950/40 p-3 text-white">
      <p className="text-sm font-bold text-white">♾️ Plano ilimitado: como dividir a comissão?</p>
      <p className="mt-0.5 text-xs leading-relaxed text-gray-300">
        Como não existe um número de visitas, escolha um modelo. Obrigatório para salvar.
      </p>
      <div className="mt-3 space-y-2" role="radiogroup" aria-label="Modelo de comissão do plano ilimitado">
        {OPTIONS.map((option) => {
          const selected = model === option.id;
          return (
            <div
              key={option.id}
              className={`rounded-lg border p-3 transition-colors ${selected ? 'border-violet-300 bg-violet-500/20' : 'border-white/10 bg-black/20'}`}
            >
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onModelChange(option.id)}
                className="flex w-full items-start gap-2.5 text-left"
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-violet-200' : 'border-gray-500'}`}
                  aria-hidden="true"
                >
                  {selected ? <span className="h-2 w-2 rounded-full bg-violet-200" /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white">{option.title}</span>
                  <span className="block text-xs leading-relaxed text-gray-300">{option.text}</span>
                </span>
              </button>

              {selected && option.id !== 'pontos' ? (
                <div className={`mt-3 grid gap-2 ${option.id === 'dividir' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-gray-300">
                      {option.id === 'dividir' ? 'Comissão do plano (%) — opcional' : 'Comissão por atendimento (%)'}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={percent}
                      onChange={(e) => onPercentChange(e.target.value)}
                      placeholder={option.id === 'dividir' ? 'Vazio = 100%' : 'Ex: 20'}
                      className={inputClass}
                    />
                  </label>
                  {option.id === 'dividir' ? (
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-gray-300">Dividir por quantas visitas</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={divideQty}
                        onChange={(e) => onDivideQtyChange(e.target.value)}
                        placeholder="Ex: 4"
                        className={inputClass}
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}

              {selected && example ? <p className="mt-2 text-xs leading-relaxed text-violet-100">{example}</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};
