import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

/**
 * Carteira do estabelecimento SEM Mercado Pago conectado.
 *
 * Os pagamentos online dos clientes caem na conta do Agendei Fácil e viram saldo
 * aqui (valor líquido, já descontadas as taxas). O dono pede o saque e recebe por
 * PIX em até 3 dias úteis. Tudo vem das funções SQL da migration
 * 20260929_carteira_pagamentos_plataforma.sql (get_establishment_wallet /
 * request_establishment_withdrawal). Se a migration ainda não foi aplicada, o
 * card mostra "indisponível" e não quebra a tela.
 */

type WalletRequest = {
  id: string;
  amount_cents: number;
  status: 'pending' | 'paid' | 'cancelled' | string;
  requested_at: string;
  paid_at?: string | null;
  pix_key?: string | null;
};

type WalletPayment = {
  id: string;
  appointment_id?: string | null;
  gross_cents: number;
  net_cents: number;
  payment_method?: string | null;
  payer_name?: string | null;
  status: string;
  created_at: string;
};

type Wallet = {
  ok: boolean;
  error?: string;
  balance_cents: number;
  total_received_cents: number;
  total_paid_cents: number;
  pending_request: WalletRequest | null;
  requests: WalletRequest[];
  payments: WalletPayment[];
};

type Props = {
  establishmentId: string;
  /** Chave PIX já cadastrada no perfil (se houver). */
  pixKey?: string | null;
  /** Leva o dono até o botão "Conectar Mercado Pago". */
  onConnectMercadoPago?: () => void;
};

const brl = (cents: number) =>
  (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

const methodLabel = (m?: string | null) => {
  const v = String(m || '').toLowerCase();
  if (v === 'pix') return 'PIX';
  if (v === 'debito') return 'Débito';
  if (v === 'credito') return 'Crédito';
  return 'Online';
};

const statusBadge = (status: string) => {
  const s = String(status || '').toLowerCase();
  if (s === 'paid') return { label: 'Aprovado', cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40' };
  if (s === 'cancelled') return { label: 'Cancelado', cls: 'bg-gray-500/20 text-gray-300 border-gray-400/30' };
  return { label: 'Pendente', cls: 'bg-amber-500/20 text-amber-200 border-amber-400/40' };
};

export const PlatformWalletCard: React.FC<Props> = ({ establishmentId, pixKey, onConnectMercadoPago }) => {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pixKeyDraft, setPixKeyDraft] = useState('');
  const [justRequested, setJustRequested] = useState(false);
  const [showAllPayments, setShowAllPayments] = useState(false);

  const savedPixKey = String(pixKey || '').trim();

  const load = useCallback(async () => {
    if (!establishmentId) return;
    try {
      const { data, error } = await supabase.rpc('get_establishment_wallet', { p_establishment_id: establishmentId });
      if (error) {
        const msg = String(error.message || '').toLowerCase();
        if (msg.includes('get_establishment_wallet') || msg.includes('does not exist') || msg.includes('schema cache')) {
          setUnavailable(true);
        } else {
          console.warn('[Carteira] Falha ao carregar saldo:', error.message);
        }
        return;
      }
      const w = (data || {}) as Wallet;
      if (!w?.ok) {
        console.warn('[Carteira] Saldo indisponível:', w?.error);
        return;
      }
      setWallet({
        ok: true,
        balance_cents: Number(w.balance_cents || 0),
        total_received_cents: Number(w.total_received_cents || 0),
        total_paid_cents: Number(w.total_paid_cents || 0),
        pending_request: w.pending_request || null,
        requests: Array.isArray(w.requests) ? w.requests : [],
        payments: Array.isArray(w.payments) ? w.payments : [],
      });
    } catch (err: any) {
      console.warn('[Carteira] Erro inesperado ao carregar saldo:', err?.message || err);
    } finally {
      setIsLoading(false);
    }
  }, [establishmentId]);

  useEffect(() => {
    setIsLoading(true);
    void load();
  }, [load]);

  const balance = Number(wallet?.balance_cents || 0);
  const pending = wallet?.pending_request || null;
  const canWithdraw = !isLoading && !unavailable && balance > 0 && !pending && !isRequesting;

  const openConfirm = () => {
    if (!canWithdraw) return;
    setPixKeyDraft(savedPixKey);
    setConfirmOpen(true);
  };

  const submitWithdrawal = async () => {
    const key = String(pixKeyDraft || savedPixKey || '').trim();
    if (!key) {
      toast.error('Informe sua chave PIX para receber o saque.');
      return;
    }
    setIsRequesting(true);
    try {
      const { data, error } = await supabase.rpc('request_establishment_withdrawal', {
        p_establishment_id: establishmentId,
        p_pix_key: key,
      });
      if (error) {
        toast.error('Não foi possível enviar o pedido de saque. Tente novamente.');
        console.warn('[Carteira] Erro ao pedir saque:', error.message);
        return;
      }
      const res = (data || {}) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok) {
        toast.error(res.message || 'Não foi possível enviar o pedido de saque.');
        await load();
        return;
      }
      setConfirmOpen(false);
      setJustRequested(true);
      await load();
    } catch (err: any) {
      toast.error('Não foi possível enviar o pedido de saque. Tente novamente.');
      console.warn('[Carteira] Erro inesperado ao pedir saque:', err?.message || err);
    } finally {
      setIsRequesting(false);
    }
  };

  const approvedPayments = (wallet?.payments || []).filter((p) => String(p.status || '') === 'approved');
  const visiblePayments = showAllPayments ? approvedPayments : approvedPayments.slice(0, 5);
  const requests = wallet?.requests || [];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 via-[#0b1a2b] to-[#0a1628] p-5 sm:p-7 text-white">
      <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-emerald-400/15 blur-3xl pointer-events-none" />

      <div className="relative z-10">
        {/* Saldo */}
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-200/90">💰 Seu saldo</p>
        <p className="mt-1 text-4xl sm:text-5xl font-black text-white leading-none">
          {isLoading ? '...' : unavailable ? '—' : brl(balance)}
        </p>
        <p className="mt-2 text-sm text-white/70">
          {unavailable
            ? 'Saldo indisponível no momento. Tente novamente mais tarde.'
            : 'Valor líquido dos pagamentos online dos seus clientes, pronto para sacar.'}
        </p>

        {/* Botão sacar / status do pedido */}
        {!unavailable && (
          <div className="mt-4 space-y-3">
            {pending ? (
              <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 sm:p-4">
                <p className="text-sm font-extrabold text-amber-100">⏳ Pedido de saque enviado</p>
                <p className="text-xs text-amber-100/80 mt-1">
                  Saque de <strong className="text-white">{brl(pending.amount_cents)}</strong> em análise. Você irá receber em até no máximo 3 dias úteis
                  {pending.pix_key ? <> na chave PIX <strong className="text-white">{pending.pix_key}</strong></> : null}.
                </p>
              </div>
            ) : justRequested ? (
              <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3 sm:p-4">
                <p className="text-sm font-extrabold text-emerald-100">✅ Pedido de saque enviado</p>
                <p className="text-xs text-emerald-100/80 mt-1">Você irá receber em até no máximo 3 dias úteis.</p>
              </div>
            ) : null}

            {!confirmOpen && !pending && (
              <button
                type="button"
                onClick={openConfirm}
                disabled={!canWithdraw}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm shadow-lg shadow-emerald-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Sacar valor
              </button>
            )}
            {!confirmOpen && !pending && balance <= 0 && !isLoading && (
              <p className="text-xs text-white/50">Quando um cliente pagar online pelo seu link, o valor aparece aqui.</p>
            )}

            {confirmOpen && (
              <div className="rounded-xl border border-white/15 bg-black/30 p-4 space-y-3">
                <p className="text-sm font-bold text-white">
                  Sacar <span className="text-emerald-300">{brl(balance)}</span> para a chave PIX:
                </p>
                <input
                  type="text"
                  value={pixKeyDraft}
                  onChange={(e) => setPixKeyDraft(e.target.value)}
                  placeholder="CPF, CNPJ, celular, e-mail ou chave aleatória"
                  className="w-full rounded-lg border border-white/20 bg-[#0f172a] px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <p className="text-[11px] text-white/50">Confira a chave: o PIX é enviado para ela em até 3 dias úteis.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => void submitWithdrawal()}
                    disabled={isRequesting || !String(pixKeyDraft || '').trim()}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isRequesting ? 'Enviando...' : 'Confirmar saque'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(false)}
                    disabled={isRequesting}
                    className="px-4 py-2.5 rounded-lg border border-white/20 text-white/80 hover:bg-white/5 font-bold text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pedidos de saque */}
        {!unavailable && requests.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-wider text-white/60 mb-2">Pedidos de saque</p>
            <div className="space-y-1.5">
              {requests.slice(0, 10).map((r) => {
                const badge = statusBadge(r.status);
                return (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white">{brl(r.amount_cents)}</p>
                      <p className="text-[11px] text-white/50 truncate">
                        {fmtDateTime(r.requested_at)}
                        {String(r.status) === 'paid' && r.paid_at ? ` · pago em ${fmtDateTime(r.paid_at)}` : ''}
                      </p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Últimos pagamentos online */}
        {!unavailable && approvedPayments.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-wider text-white/60 mb-2">Pagamentos online recebidos</p>
            <div className="space-y-1.5">
              {visiblePayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{p.payer_name || 'Cliente'}</p>
                    <p className="text-[11px] text-white/50">{methodLabel(p.payment_method)} · {fmtDateTime(p.created_at)}</p>
                  </div>
                  <span className="shrink-0 text-sm font-extrabold text-emerald-300">+ {brl(p.net_cents)}</span>
                </div>
              ))}
            </div>
            {approvedPayments.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllPayments((v) => !v)}
                className="mt-2 text-xs font-bold text-emerald-300 hover:text-emerald-200"
              >
                {showAllPayments ? 'Ver menos' : `Ver todos (${approvedPayments.length})`}
              </button>
            )}
          </div>
        )}

        {/* CTA Mercado Pago */}
        <div className="mt-6 rounded-xl border border-sky-400/30 bg-sky-500/10 p-4">
          <p className="text-sm font-extrabold text-white">⚡ Quer receber na hora, direto na sua conta, no momento em que o cliente paga?</p>
          <p className="text-xs text-white/70 mt-1">Conecte o Mercado Pago: o dinheiro cai na sua conta na hora, sem esperar o saque.</p>
          <button
            type="button"
            onClick={() => onConnectMercadoPago?.()}
            className="mt-3 w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#009EE3] hover:bg-[#0088c7] text-white font-extrabold text-sm transition-colors"
          >
            Conectar Mercado Pago
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlatformWalletCard;
