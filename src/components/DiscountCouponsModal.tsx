import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2, Edit } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from './ui/Toaster';

type DiscountCoupon = {
  id: string;
  establishment_id: string;
  code: string;
  discount_percent: number;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
};

interface DiscountCouponsModalProps {
  isOpen: boolean;
  onClose: () => void;
  establishmentId: string;
}

const normalizeCouponCode = (raw: string) =>
  String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');

export function DiscountCouponsModal({ isOpen, onClose, establishmentId }: DiscountCouponsModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [coupons, setCoupons] = useState<DiscountCoupon[]>([]);

  const [code, setCode] = useState('');
  const [percent, setPercent] = useState<string>('5');

  const [editing, setEditing] = useState<DiscountCoupon | null>(null);

  const remaining = useMemo(() => Math.max(0, 20 - (coupons?.length || 0)), [coupons?.length]);

  const fetchCoupons = async () => {
    if (!establishmentId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('discount_coupons')
        .select('*')
        .eq('establishment_id', establishmentId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCoupons((data || []) as any);
    } catch (e: any) {
      console.error('❌ Erro ao buscar cupons:', e);
      toast(e?.message || 'Erro ao buscar cupons', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchCoupons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, establishmentId]);

  const resetForm = () => {
    setEditing(null);
    setCode('');
    setPercent('5');
  };

  const handleSave = async () => {
    const normalized = normalizeCouponCode(code);
    const pct = Number(String(percent).replace(',', '.'));

    if (!normalized) {
      toast('Informe o código do cupom (ex: NEY1)', 'error');
      return;
    }
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      toast('Informe um desconto válido entre 0,01% e 100%', 'error');
      return;
    }

    // Limite 20 (UI). O banco também valida.
    if (!editing && coupons.length >= 20) {
      toast('Limite de 20 cupons atingido. Exclua algum para criar outro.', 'error');
      return;
    }

    setLoading(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from('discount_coupons')
          .update({
            code: normalized,
            discount_percent: pct,
            is_active: true,
          })
          .eq('id', editing.id);
        if (error) throw error;
        toast('Cupom atualizado!', 'success');
      } else {
        const { error } = await supabase.from('discount_coupons').insert({
          establishment_id: establishmentId,
          code: normalized,
          discount_percent: pct,
          is_active: true,
        } as any);
        if (error) throw error;
        toast('Cupom criado!', 'success');
      }
      resetForm();
      await fetchCoupons();
    } catch (e: any) {
      console.error('❌ Erro ao salvar cupom:', e);
      toast(e?.message || 'Erro ao salvar cupom', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (coupon: DiscountCoupon) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('discount_coupons')
        .update({ is_active: !coupon.is_active })
        .eq('id', coupon.id);
      if (error) throw error;
      await fetchCoupons();
    } catch (e: any) {
      console.error('❌ Erro ao atualizar cupom:', e);
      toast(e?.message || 'Erro ao atualizar cupom', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (coupon: DiscountCoupon) => {
    if (!window.confirm(`Excluir cupom "${coupon.code}"?`)) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('discount_coupons').delete().eq('id', coupon.id);
      if (error) throw error;
      toast('Cupom excluído!', 'success');
      await fetchCoupons();
      if (editing?.id === coupon.id) resetForm();
    } catch (e: any) {
      console.error('❌ Erro ao excluir cupom:', e);
      toast(e?.message || 'Erro ao excluir cupom', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2147483000] bg-black/60 flex items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-gray-200 shrink-0">
          <div>
            <div className="text-lg font-bold text-gray-900">Cupons de desconto</div>
            <div className="text-xs text-gray-600">
              Você pode criar até <strong>20</strong> cupons. Restantes: <strong>{remaining}</strong>
            </div>
            <div className="text-xs text-gray-600 mt-2 max-w-xl">
              Crie um cupom, envie para seu cliente e ele poderá aplicar no agendamento para receber <strong>desconto em %</strong> no valor do(s) serviço(s).
              O cupom é solicitado <strong>no final</strong> do agendamento, <strong>antes do pagamento</strong> (ou antes da confirmação da reserva).
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-700"
            aria-label="Fechar"
            title="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto overscroll-contain">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-sm font-extrabold text-amber-900">Como funciona</div>
            <ul className="mt-1 text-sm text-amber-900/90 leading-relaxed list-disc pl-5 space-y-1">
              <li>
                <strong>Você cria o cupom</strong> (ex: <strong>NEY1</strong>) e escolhe o desconto (ex: <strong>5%</strong>)
              </li>
              <li>
                <strong>Você envia o código</strong> para o cliente
              </li>
              <li>
                <strong>O cliente aplica no final do agendamento</strong>, antes de pagar/confirmar e o valor final já aparece com o desconto
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Código do cupom</label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ex: NEY1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
                />
                <div className="text-[11px] text-gray-600 mt-1">
                  Sem espaços. Será salvo em maiúsculas automaticamente.
                </div>
              </div>
              <div className="w-full sm:w-44">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Desconto (%)</label>
                <input
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                  inputMode="decimal"
                  placeholder="5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
                />
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={handleSave}
                className="px-4 py-2 rounded-lg bg-black text-white font-semibold hover:bg-gray-900 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                {editing ? 'Salvar' : 'Criar'}
              </button>
            </div>
            {editing && (
              <div className="mt-3 flex items-center justify-between text-xs">
                <div className="text-gray-700">
                  Editando: <strong>{editing.code}</strong>
                </div>
                <button type="button" onClick={resetForm} className="text-gray-600 hover:text-gray-900">
                  Cancelar edição
                </button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-white border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-bold text-gray-900">Meus cupons</div>
              {loading && <div className="text-xs text-gray-600">Carregando...</div>}
            </div>
            <div className="divide-y divide-gray-200">
              {coupons.length === 0 ? (
                <div className="p-4 text-sm text-gray-700">Nenhum cupom criado ainda.</div>
              ) : (
                coupons.map((c) => (
                  <div key={c.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-extrabold text-gray-900 truncate">{c.code}</div>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full border ${
                            c.is_active ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-600'
                          }`}
                        >
                          {c.is_active ? 'ATIVO' : 'INATIVO'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-700">
                        Desconto: <strong>{Number(c.discount_percent).toFixed(2).replace('.', ',')}%</strong> • Usos:{' '}
                        <strong>{c.usage_count ?? 0}</strong>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => {
                          setEditing(c);
                          setCode(c.code);
                          setPercent(String(c.discount_percent));
                        }}
                        className="px-3 py-2 rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50 flex items-center gap-2"
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleToggleActive(c)}
                        className="px-3 py-2 rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50"
                        title={c.is_active ? 'Desativar' : 'Ativar'}
                      >
                        {c.is_active ? 'Desativar' : 'Ativar'}
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleDelete(c)}
                        className="px-3 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 flex items-center gap-2"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                        Excluir
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

