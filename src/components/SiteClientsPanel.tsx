import { Calendar, CreditCard, Edit3, RefreshCw, Save, Search, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

interface SiteCheckoutRow {
  id: string;
  client_name: string;
  establishment_name: string;
  email: string;
  client_whatsapp?: string | null;
  selected_plan: 'prata' | 'diamante';
  amount_cents: number;
  payment_method: 'pix' | 'recurring_card';
  status: string;
  payment_id?: string | null;
  preapproval_id?: string | null;
  created_establishment_id?: string | null;
  created_at: string;
  paid_at?: string | null;
  converted_at?: string | null;
}

interface SiteClientsPanelProps {
  onClose: () => void;
}

const formatMoney = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents || 0) / 100);

const monthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
};

export const SiteClientsPanel: React.FC<SiteClientsPanelProps> = ({ onClose }) => {
  const [rows, setRows] = useState<SiteCheckoutRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editingAmount, setEditingAmount] = useState('');

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      row.client_name.toLowerCase().includes(term) ||
      row.establishment_name.toLowerCase().includes(term) ||
      row.email.toLowerCase().includes(term) ||
      String(row.client_whatsapp || '').includes(term)
    );
  }, [rows, searchTerm]);

  const totalConverted = rows
    .filter((row) => row.status === 'converted')
    .reduce((sum, row) => sum + Number(row.amount_cents || 0), 0);

  const fetchRows = async () => {
    try {
      setIsLoading(true);
      const { start, end } = monthRange();
      const { data, error } = await supabase
        .from('site_registration_checkouts')
        .select('*')
        .gte('created_at', start)
        .lt('created_at', end)
        .eq('status', 'converted')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setRows((data || []) as SiteCheckoutRow[]);
    } catch (error: any) {
      console.error('Erro ao carregar clientes do site:', error);
      toast.error(error?.message || 'Erro ao carregar Clientes Site');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const saveAmount = async (row: SiteCheckoutRow) => {
    const numeric = Number(String(editingAmount).replace(',', '.'));
    if (!Number.isFinite(numeric) || numeric <= 0) {
      toast.error('Informe um valor valido');
      return;
    }

    const { error } = await supabase
      .from('site_registration_checkouts')
      .update({
        amount_cents: Math.round(numeric * 100),
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', row.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Valor ajustado');
    setEditingId('');
    setEditingAmount('');
    fetchRows();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 p-5">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Clientes Site</h2>
            <p className="text-sm text-gray-600">Clientes pagos vindos de /planos e da página inicial, filtrados pelo mês atual.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-3 border-b border-gray-200 p-5 sm:grid-cols-3">
          <div className="rounded-xl bg-blue-50 p-4">
            <p className="text-sm text-blue-700">Clientes convertidos</p>
            <p className="text-2xl font-black text-blue-900">{rows.filter((row) => row.status === 'converted').length}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-4">
            <p className="text-sm text-emerald-700">Receita convertida</p>
            <p className="text-2xl font-black text-emerald-900">{formatMoney(totalConverted)}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-700">Total do mês</p>
            <p className="text-2xl font-black text-gray-900">{rows.length}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-gray-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              placeholder="Buscar por cliente, estabelecimento, email ou WhatsApp"
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

        <div className="max-h-[52vh] overflow-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="sticky top-0 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-gray-700">Cliente</th>
                <th className="px-4 py-3 text-left font-bold text-gray-700">Plano</th>
                <th className="px-4 py-3 text-left font-bold text-gray-700">Pagamento</th>
                <th className="px-4 py-3 text-left font-bold text-gray-700">Valor</th>
                <th className="px-4 py-3 text-left font-bold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left font-bold text-gray-700">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-bold text-gray-900">{row.establishment_name}</div>
                    <div className="text-gray-600">{row.client_name}</div>
                    <div className="text-xs text-gray-500">{row.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-black ${row.selected_plan === 'prata' ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-700'}`}>
                      {row.selected_plan.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-gray-800">
                      {row.payment_method === 'pix' ? <Calendar className="h-4 w-4 text-emerald-600" /> : <CreditCard className="h-4 w-4 text-blue-600" />}
                      {row.payment_method === 'pix' ? 'PIX' : 'Cartao recorrente'}
                    </div>
                    <div className="text-xs text-gray-500">{row.payment_id || row.preapproval_id || '-'}</div>
                  </td>
                  <td className="px-4 py-3">
                    {editingId === row.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={editingAmount}
                          onChange={(event) => setEditingAmount(event.target.value)}
                          className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                        <button type="button" onClick={() => saveAmount(row)} className="rounded bg-emerald-600 p-1 text-white">
                          <Save className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(row.id);
                          setEditingAmount(String(Number(row.amount_cents || 0) / 100).replace('.', ','));
                        }}
                        className="inline-flex items-center gap-1 font-bold text-gray-900 hover:text-blue-700"
                      >
                        {formatMoney(row.amount_cents)}
                        <Edit3 className="h-3 w-3" />
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700">{row.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(row.created_at).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
              {!isLoading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Nenhum cliente do site encontrado neste mês.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
