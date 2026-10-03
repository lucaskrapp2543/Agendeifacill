import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import {
  DEFAULT_NO_SHOW_POLICY,
  NO_SHOW_POLICY_OPTIONS,
  fetchMonthLosses,
  isNoShowPolicy,
  type MonthLosses,
  type NoShowPolicy,
} from '../lib/noShowPolicy';
import { NoShowPolicyNotice } from './NoShowPolicyNotice';

/**
 * "Política do sistema" (tela Saques / Pagamentos online): o dono liga a política de
 * faltas, escolhe o que acontece com o valor pago (50% / 30% / 20% / crédito), vê quanto
 * perdeu com faltas e cancelamentos (mês atual e anterior) e a prévia do aviso que o
 * cliente recebe depois de pagar.
 */
type Props = {
  establishmentId: string;
  establishmentName: string;
  initialEnabled: boolean;
  initialPolicy: NoShowPolicy;
  onSaved?: (next: { enabled: boolean; policy: NoShowPolicy }) => void;
};

const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const NoShowPolicyCard: React.FC<Props> = ({ establishmentId, establishmentName, initialEnabled, initialPolicy, onSaved }) => {
  const [enabled, setEnabled] = useState<boolean>(initialEnabled);
  const [policy, setPolicy] = useState<NoShowPolicy>(isNoShowPolicy(initialPolicy) ? initialPolicy : DEFAULT_NO_SHOW_POLICY);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [losses, setLosses] = useState<{ current: MonthLosses; previous: MonthLosses } | null>(null);

  useEffect(() => {
    setEnabled(initialEnabled);
  }, [initialEnabled]);
  useEffect(() => {
    if (isNoShowPolicy(initialPolicy)) setPolicy(initialPolicy);
  }, [initialPolicy]);

  useEffect(() => {
    if (!establishmentId) return;
    let cancelled = false;
    (async () => {
      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const [current, previous] = await Promise.all([
        fetchMonthLosses(establishmentId, now.getFullYear(), now.getMonth()),
        fetchMonthLosses(establishmentId, prev.getFullYear(), prev.getMonth()),
      ]);
      if (!cancelled) setLosses({ current, previous });
    })();
    return () => {
      cancelled = true;
    };
  }, [establishmentId]);

  const persist = async (next: { enabled: boolean; policy: NoShowPolicy }) => {
    if (!establishmentId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('establishments')
        .update({ no_show_policy_enabled: next.enabled, no_show_policy: next.policy })
        .eq('id', establishmentId);
      if (error) throw error;
      onSaved?.(next);
      toast.success(next.enabled ? 'Política de faltas ligada.' : 'Política de faltas desligada.');
    } catch (err: any) {
      const msg = String(err?.message || '');
      toast.error(msg.includes('no_show_policy') ? 'Ainda não disponível: o suporte precisa liberar no sistema.' : 'Não foi possível salvar. Tente novamente.');
      // volta o que estava
      setEnabled(initialEnabled);
      setPolicy(isNoShowPolicy(initialPolicy) ? initialPolicy : DEFAULT_NO_SHOW_POLICY);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (next: boolean) => {
    setEnabled(next);
    void persist({ enabled: next, policy });
  };

  const handlePolicy = (next: NoShowPolicy) => {
    setPolicy(next);
    if (enabled) void persist({ enabled: true, policy: next });
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 via-[#0b1a2b] to-[#0a1628] p-5 sm:p-7 text-white">
      <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">📋 Política do sistema</h2>
            <p className="mt-1 text-sm font-bold text-amber-100">Proteção contra faltas nos pagamentos online.</p>
          </div>
          {/* Chave + palavra ao lado: "DESATIVADO" / "ATIVADO", para ninguém ficar na dúvida */}
          <label className="inline-flex items-center gap-2 cursor-pointer shrink-0 mt-1">
            <span
              className={`text-[11px] font-extrabold uppercase tracking-wide rounded-full px-2.5 py-1 border ${enabled
                ? 'bg-emerald-500 text-black border-emerald-300'
                : 'bg-gray-700 text-gray-200 border-gray-500'
                }`}
            >
              {enabled ? 'Ativado' : 'Desativado'}
            </span>
            <span className="relative inline-flex items-center">
              <input type="checkbox" className="sr-only peer" checked={enabled} disabled={saving} onChange={(e) => handleToggle(e.target.checked)} />
              <span className="w-12 h-7 bg-gray-600 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-[22px] after:w-[22px] after:transition-all peer-checked:after:translate-x-5 block" />
            </span>
          </label>
        </div>

        <p className="mt-3 text-sm text-white/80 leading-relaxed">
          Com esta opção ligada, logo depois de pagar, o cliente vê um aviso rápido: em falta sem aviso, a <strong className="text-white">plataforma Agendei Fácil</strong> retém
          parte do valor pago (ou guarda como crédito). O aviso fala em nome da plataforma, não da sua barbearia, para o cliente
          não descontar em você. Nada aparece antes do pagamento.
        </p>
        <p className="mt-2 text-xs font-bold text-emerald-300">✂️ Barbearias com essa política ligada cortam até 89% dos prejuízos com faltas.</p>

        {/* Opções */}
        <div className={`mt-4 grid gap-2 sm:grid-cols-2 ${enabled ? '' : 'opacity-50'}`}>
          {NO_SHOW_POLICY_OPTIONS.map((opt) => {
            const selected = policy === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={saving}
                onClick={() => handlePolicy(opt.id)}
                className={`rounded-xl border-2 p-3 text-left transition-all ${selected ? 'border-amber-400 bg-amber-500/15' : 'border-gray-700 bg-[#242628] hover:border-gray-500'}`}
              >
                <span className={`block text-sm font-bold ${selected ? 'text-amber-200' : 'text-white'}`}>
                  {selected ? '● ' : '○ '}{opt.label}
                </span>
                <span className="mt-0.5 block text-xs text-gray-400">{opt.desc}</span>
              </button>
            );
          })}
        </div>
        {!enabled && <p className="mt-2 text-[11px] text-gray-400">Ligue a política acima para a escolha valer.</p>}

        {/* Perdas */}
        <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-white/60">Quanto você perdeu com faltas e cancelamentos</p>
          {!losses ? (
            <p className="mt-2 text-sm text-gray-400">Calculando…</p>
          ) : (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {[{ titulo: 'Mês atual', m: losses.current }, { titulo: 'Mês passado', m: losses.previous }].map(({ titulo, m }) => (
                <div key={titulo} className="rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2.5">
                  <p className="text-[11px] text-white/60">{titulo} · {capitalize(m.label)}</p>
                  <p className="text-2xl font-black text-red-300">{brl(m.amount)}</p>
                  <p className="text-[11px] text-white/60">
                    {m.count} {m.count === 1 ? 'agendamento perdido' : 'agendamentos perdidos'}
                    {m.noShows > 0 ? ` · ${m.noShows} ${m.noShows === 1 ? 'falta' : 'faltas'}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-[11px] text-white/50">Soma do valor dos agendamentos cancelados ou com falta no mês. Remarcações não contam.</p>
        </div>

        {/* Prévia */}
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="text-sm font-bold text-amber-200 hover:text-amber-100 underline underline-offset-4"
          >
            {showPreview ? 'Esconder prévia' : '👀 Ver como aparece para o cliente'}
          </button>
          {showPreview && (
            <>
              {/* Aviso ao DONO, piscando: o valor é dele; "plataforma retém" é só a forma de falar com o cliente */}
              <div className="mt-3 rounded-xl border-2 border-amber-400 bg-amber-400 px-4 py-3 text-amber-950 animate-pulse">
                <p className="text-sm font-extrabold">⚠️ Atenção: o valor NÃO fica na plataforma. Fica com você.</p>
                <p className="mt-1 text-xs font-semibold">
                  O aviso fala "o Agendei Fácil retém" só para o cliente não descontar a política em você nem incomodar a
                  barbearia. Nesse formato ele entende fácil e aceita melhor.
                </p>
              </div>
              <div className="mt-3 flex justify-center rounded-2xl bg-black/40 p-4">
                <NoShowPolicyNotice mode="preview" policy={policy} establishmentName={establishmentName} amountLabel="R$ 45,00" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default NoShowPolicyCard;
