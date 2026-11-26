/**
 * Admin → "Vendas Cakto": quem pagou o Diamante pela Cakto, quem já criou a conta em
 * /cadastrar e quem ainda falta. Só a conta do suporte lê esta tabela (regra no banco).
 *
 * Única ação: corrigir o e-mail de uma venda que ainda não virou conta
 * (cliente digitou o e-mail errado na Cakto e não consegue se cadastrar).
 */
import { AlertTriangle, Edit3, RefreshCw, Save, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { emailValido } from '../lib/caktoPayload';
import { supabase } from '../lib/supabase';

interface CaktoOrderRow {
  id: string;
  cakto_order_id: string;
  ref_id?: string | null;
  kind: 'signup' | 'renewal';
  status: 'paid' | 'refunded' | 'chargeback';
  email: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  amount_cents: number;
  payment_method?: string | null;
  subscription_status?: string | null;
  paid_at?: string | null;
  used_at?: string | null;
  establishment_id?: string | null;
  needs_attention?: boolean | null;
  attention_reason?: string | null;
  created_at: string;
}

interface CaktoSalesPanelProps {
  onClose: () => void;
}

const formatMoney = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents || 0) / 100);

const formatDate = (iso?: string | null) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '-'
    : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const METODO: Record<string, string> = {
  pix: 'PIX',
  pix_auto: 'PIX automático',
  credit_card: 'Cartão',
  debit_card: 'Cartão de débito',
};

type Situacao = { texto: string; classe: string; aguardando?: boolean; atencao?: boolean };

const situacaoDe = (row: CaktoOrderRow): Situacao => {
  if (row.status === 'refunded') return { texto: 'Reembolsado', classe: 'bg-red-100 text-red-800', atencao: true };
  if (row.status === 'chargeback') return { texto: 'Contestado', classe: 'bg-red-100 text-red-800', atencao: true };
  if (row.kind === 'renewal') {
    // Assinante que já pagava pela Cakto antes deste fluxo: não tem conta ligada por aqui.
    if (!row.establishment_id && row.attention_reason === 'renovacao_sem_conta') {
      return { texto: 'Renovação de assinante antigo (cuidar na mão)', classe: 'bg-slate-200 text-slate-800', atencao: true };
    }
    return row.establishment_id
      ? { texto: 'Renovação lançada', classe: 'bg-blue-100 text-blue-800' }
      : { texto: 'Renovação: falta cadastrar', classe: 'bg-amber-100 text-amber-800', aguardando: true };
  }
  if (row.establishment_id) return { texto: 'Conta criada', classe: 'bg-emerald-100 text-emerald-800' };
  if (row.needs_attention) {
    return { texto: 'Atenção: e-mail já tem conta', classe: 'bg-amber-100 text-amber-900', atencao: true };
  }
  return { texto: 'Pagou, falta cadastrar', classe: 'bg-amber-100 text-amber-800', aguardando: true };
};

export function CaktoSalesPanel({ onClose }: CaktoSalesPanelProps) {
  const [rows, setRows] = useState<CaktoOrderRow[]>([]);
  const [barbearias, setBarbearias] = useState<Record<string, { code: string; name: string }>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [semTabela, setSemTabela] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editingEmail, setEditingEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchRows = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('cakto_orders' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) {
        // Tabela ainda não criada (SQL 20261125_cakto_vendas.sql não rodado).
        const codigo = String((error as any)?.code || '');
        if (codigo === '42P01' || codigo === 'PGRST205' || String(error.message || '').includes('cakto_orders')) {
          setSemTabela(true);
          setRows([]);
          return;
        }
        throw error;
      }
      setSemTabela(false);
      const lista = (data || []) as unknown as CaktoOrderRow[];
      setRows(lista);

      const ids = Array.from(new Set(lista.map((r) => String(r.establishment_id || '')).filter(Boolean)));
      if (ids.length > 0) {
        const { data: ests } = await supabase.from('establishments').select('id, code, name').in('id', ids);
        const mapa: Record<string, { code: string; name: string }> = {};
        (ests || []).forEach((e: any) => {
          mapa[String(e.id)] = { code: String(e.code || ''), name: String(e.name || '') };
        });
        setBarbearias(mapa);
      } else {
        setBarbearias({});
      }
    } catch (error: any) {
      console.error('Erro ao carregar vendas da Cakto:', error);
      toast.error(error?.message || 'Erro ao carregar as vendas da Cakto');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (row) =>
        String(row.customer_name || '').toLowerCase().includes(term) ||
        row.email.toLowerCase().includes(term) ||
        String(row.customer_phone || '').includes(term) ||
        String(row.ref_id || '').toLowerCase().includes(term) ||
        String(barbearias[String(row.establishment_id || '')]?.name || '').toLowerCase().includes(term) ||
        String(barbearias[String(row.establishment_id || '')]?.code || '').includes(term)
    );
  }, [rows, searchTerm, barbearias]);

  const resumo = useMemo(() => {
    const compras = rows.filter((r) => r.kind === 'signup' && r.status === 'paid');
    return {
      pagaram: compras.length,
      contas: compras.filter((r) => r.establishment_id).length,
      aguardando: rows.filter((r) => situacaoDe(r).aguardando).length,
      atencao: rows.filter((r) => situacaoDe(r).atencao).length,
    };
  }, [rows]);

  const saveEmail = async (row: CaktoOrderRow) => {
    const novo = editingEmail.trim().toLowerCase();
    if (!emailValido(novo)) {
      toast.error('Digite um e-mail válido');
      return;
    }
    if (novo === row.email) {
      setEditingId('');
      return;
    }
    try {
      setSaving(true);
      const mudanca: Record<string, unknown> = { email: novo, updated_at: new Date().toISOString() };
      // Era "e-mail já tem conta": com o e-mail trocado, o cliente pode se cadastrar normalmente.
      if (row.attention_reason === 'email_ja_tem_conta') {
        mudanca.needs_attention = false;
        mudanca.attention_reason = null;
      }
      const { data, error } = await supabase
        .from('cakto_orders' as any)
        .update(mudanca)
        .eq('id', row.id)
        .is('used_at', null)
        .select('id');
      if (error) throw error;
      if (!data || (data as any[]).length === 0) {
        toast.error('Essa venda já virou conta. O e-mail não pode mais ser trocado por aqui.');
      } else {
        toast.success('E-mail corrigido. O cliente já pode criar a conta com o e-mail novo.');
      }
      setEditingId('');
      await fetchRows();
    } catch (error: any) {
      console.error('Erro ao corrigir e-mail da venda:', error);
      toast.error(error?.message || 'Erro ao corrigir o e-mail');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white text-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 p-4 sm:p-5">
          <div>
            <h2 className="text-xl font-black text-gray-900 sm:text-2xl">Vendas Cakto</h2>
            <p className="text-sm text-gray-600">Quem pagou o Diamante pela Cakto e quem já criou a conta em /cadastrar.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100">
            <X className="h-6 w-6" />
          </button>
        </div>

        {semTabela ? (
          <div className="m-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm">
              A tabela das vendas da Cakto ainda não existe no banco. Falta rodar o SQL{' '}
              <b>20261125_cakto_vendas.sql</b> no Supabase.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 border-b border-gray-200 p-4 sm:grid-cols-4 sm:p-5">
          <div className="rounded-xl bg-blue-50 p-3">
            <p className="text-xs text-blue-700 sm:text-sm">Pagaram</p>
            <p className="text-2xl font-black text-blue-900">{resumo.pagaram}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3">
            <p className="text-xs text-emerald-700 sm:text-sm">Contas criadas</p>
            <p className="text-2xl font-black text-emerald-900">{resumo.contas}</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-3">
            <p className="text-xs text-amber-700 sm:text-sm">Falta cadastrar</p>
            <p className="text-2xl font-black text-amber-900">{resumo.aguardando}</p>
          </div>
          <div className="rounded-xl bg-red-50 p-3">
            <p className="text-xs text-red-700 sm:text-sm">Precisam de atenção</p>
            <p className="text-2xl font-black text-red-900">{resumo.atencao}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              placeholder="Buscar por nome, e-mail, telefone, pedido ou barbearia"
            />
          </div>
          <button
            type="button"
            onClick={fetchRows}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="sticky top-0 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-gray-700">Cliente</th>
                <th className="px-4 py-3 text-left font-bold text-gray-700">Tipo</th>
                <th className="px-4 py-3 text-left font-bold text-gray-700">Valor</th>
                <th className="px-4 py-3 text-left font-bold text-gray-700">Situação</th>
                <th className="px-4 py-3 text-left font-bold text-gray-700">Barbearia</th>
                <th className="px-4 py-3 text-left font-bold text-gray-700">Pago em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredRows.map((row) => {
                const situacao = situacaoDe(row);
                const barbearia = barbearias[String(row.establishment_id || '')];
                const podeCorrigir = !row.used_at && row.status === 'paid';
                return (
                  <tr key={row.id} className="align-top hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-bold text-gray-900">{row.customer_name || '(sem nome)'}</div>
                      {editingId === row.id ? (
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            value={editingEmail}
                            onChange={(event) => setEditingEmail(event.target.value)}
                            className="w-56 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900"
                            placeholder="e-mail certo"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => saveEmail(row)}
                            disabled={saving}
                            aria-label="Salvar e-mail"
                            className="rounded bg-emerald-600 p-1 text-white disabled:opacity-60"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId('')}
                            aria-label="Cancelar"
                            className="rounded bg-gray-200 p-1 text-gray-700"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-x-2 text-gray-700">
                          <span className="min-w-0 break-all">{row.email}</span>
                          {podeCorrigir ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(row.id);
                                setEditingEmail(row.email);
                              }}
                              title="Corrigir o e-mail desta venda"
                              className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-blue-700 hover:underline"
                            >
                              <Edit3 className="h-3 w-3" /> corrigir
                            </button>
                          ) : null}
                        </div>
                      )}
                      <div className="text-xs text-gray-500">{row.customer_phone || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      <div className="font-bold">{row.kind === 'renewal' ? 'Renovação' : 'Compra'}</div>
                      <div className="text-xs text-gray-500">{METODO[String(row.payment_method || '')] || row.payment_method || '-'}</div>
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900">{formatMoney(row.amount_cents)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-1 text-xs font-bold ${situacao.classe}`}>{situacao.texto}</span>
                      {row.subscription_status === 'canceled' ? (
                        <div className="mt-1 text-xs font-bold text-gray-600">assinatura cancelada</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      {barbearia ? (
                        <>
                          <div className="font-bold text-gray-900">{barbearia.name}</div>
                          <div className="text-xs text-gray-500">Código {barbearia.code}</div>
                        </>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div>{formatDate(row.paid_at || row.created_at)}</div>
                      <div className="text-xs text-gray-400">Pedido {row.ref_id || row.cakto_order_id.slice(0, 8)}</div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Nenhuma venda da Cakto por enquanto.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
