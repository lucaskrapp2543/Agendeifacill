import { format } from 'date-fns';

const csvCell = (value: unknown): string => {
  const raw = value === null || value === undefined ? '' : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
};

const csvRow = (...cells: unknown[]): string => cells.map(csvCell).join(';');

const fmtMoney = (value: number): string =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (raw: unknown): string => {
  const value = String(raw || '').trim();
  if (!value) return '';
  const datePart = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [y, m, d] = datePart.split('-');
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return format(dt, 'dd/MM/yyyy');
};

export type SubscriberAccountantReportInput = {
  establishmentName: string;
  establishmentCode: string;
  establishmentId: string;
  monthLabel: string;
  year: number;
  monthIndex: number;
  generatedAt?: Date;
  brutoAtivo: number;
  liquidoAtivo: number;
  emContaEntradasMes: number;
  emContaSaidasMes: number;
  emContaMes: number;
  totalAssinantes: number;
  assinantesNaoPagos: number;
  totalRepasses: number;
  repassesAtendimentos: number;
  repassesComissaoVenda: number;
  saldoAssinantes: number | null;
  totalDescontos: number;
  novosAssinantesMes: number;
  renovacoesMes: number;
  totalAtendimentosMes: number;
  assinantesDesativados: number;
  emContaBreakdown: Array<{
    clientName: string;
    planName: string;
    paymentDate: Date;
    value: number;
    typeLabel: string;
  }>;
  liquidoAtivoBreakdown: Array<{
    clientName: string;
    planName: string;
    bruto: number;
    liquido: number;
    endDate: Date | null;
  }>;
  naoPagosBreakdown: Array<{
    clientName: string;
    planName: string;
    value: number;
    bucket: string;
  }>;
  professionalPayments: Array<{
    professional_name?: string;
    amount?: number;
    payment_date?: string;
    for_month?: string;
  }>;
  attendances: Array<{
    attendance_date?: string;
    professional_name?: string;
    clientName?: string;
    repass_value?: number;
  }>;
  saleCommissions: Array<{
    professional_name?: string;
    commission_amount?: number | string;
    clientName?: string;
  }>;
  discountRows: Array<{
    clientName: string;
    planName: string;
    planValue: number;
    paidValue: number;
    discount: number;
  }>;
};

export function buildSubscriberAccountantReportCsv(input: SubscriberAccountantReportInput): string {
  const generatedAt = input.generatedAt || new Date();
  const lines: string[] = [];

  const pushBlank = () => lines.push('');
  const pushSection = (title: string) => {
    pushBlank();
    lines.push(csvRow(`=== ${title} ===`));
  };

  lines.push(csvRow('RELATÓRIO DE ASSINATURAS — AGENDEI FÁCIL (para contador)'));
  lines.push(csvRow('Estabelecimento', input.establishmentName || '—'));
  lines.push(csvRow('Código', input.establishmentCode || '—'));
  lines.push(csvRow('ID estabelecimento', input.establishmentId));
  lines.push(csvRow('Competência', `${input.monthLabel} ${input.year}`));
  lines.push(csvRow('Gerado em', format(generatedAt, 'dd/MM/yyyy HH:mm:ss')));

  pushSection('RESUMO FINANCEIRO');
  lines.push(csvRow('Indicador', 'Valor'));
  lines.push(csvRow('Bruto (assinantes ativos pagos no mês)', fmtMoney(input.brutoAtivo)));
  lines.push(csvRow('Líquido (após taxas gateway/plataforma — ativos pagos)', fmtMoney(input.liquidoAtivo)));
  lines.push(csvRow('Entradas do mês (pagamentos recebidos no período)', fmtMoney(input.emContaEntradasMes)));
  lines.push(csvRow('Pagamentos abatidos (saídas a profissionais)', fmtMoney(input.emContaSaidasMes)));
  lines.push(csvRow('Em conta (entradas - saídas)', fmtMoney(input.emContaMes)));
  if (input.saldoAssinantes !== null) {
    lines.push(csvRow('Saldo operacional PIX assinaturas (Pagar.me)', fmtMoney(input.saldoAssinantes)));
  }
  lines.push(csvRow('Total repasses (atendimentos + comissão venda)', fmtMoney(input.totalRepasses)));
  lines.push(csvRow('Repasses por atendimentos', fmtMoney(input.repassesAtendimentos)));
  lines.push(csvRow('Comissões de venda de assinatura', fmtMoney(input.repassesComissaoVenda)));
  lines.push(csvRow('Total descontos concedidos (plano x valor pago)', fmtMoney(input.totalDescontos)));
  lines.push(csvRow('Taxas estimadas (bruto - líquido ativos)', fmtMoney(Math.max(0, input.brutoAtivo - input.liquidoAtivo))));

  pushSection('MOVIMENTAÇÃO DO MÊS');
  lines.push(csvRow('Indicador', 'Quantidade'));
  lines.push(csvRow('Novos assinantes (entrada no mês)', input.novosAssinantesMes));
  lines.push(csvRow('Renovações no mês', input.renovacoesMes));
  lines.push(csvRow('Total assinantes ativos na competência', input.totalAssinantes));
  lines.push(csvRow('Assinantes não pagos', input.assinantesNaoPagos));
  lines.push(csvRow('Assinantes desativados (fora da contagem ativa)', input.assinantesDesativados));
  lines.push(csvRow('Atendimentos de assinatura registrados', input.totalAtendimentosMes));

  pushSection('ENTRADAS DO MÊS (DETALHE)');
  lines.push(csvRow('Data', 'Cliente', 'Plano', 'Tipo', 'Valor'));
  if (input.emContaBreakdown.length === 0) {
    lines.push(csvRow('—', 'Nenhuma entrada neste mês', '', '', ''));
  } else {
    input.emContaBreakdown.forEach((row) => {
      lines.push(csvRow(
        format(row.paymentDate, 'dd/MM/yyyy'),
        row.clientName,
        row.planName,
        row.typeLabel,
        fmtMoney(row.value)
      ));
    });
    lines.push(csvRow('', '', '', 'TOTAL', fmtMoney(input.emContaEntradasMes)));
  }

  pushSection('ASSINANTES ATIVOS PAGOS (MRR NA COMPETÊNCIA)');
  lines.push(csvRow('Cliente', 'Plano', 'Bruto', 'Líquido', 'Vencimento'));
  if (input.liquidoAtivoBreakdown.length === 0) {
    lines.push(csvRow('—', 'Nenhum assinante ativo pago', '', '', ''));
  } else {
    input.liquidoAtivoBreakdown.forEach((row) => {
      lines.push(csvRow(
        row.clientName,
        row.planName,
        fmtMoney(row.bruto),
        fmtMoney(row.liquido),
        row.endDate ? format(row.endDate, 'dd/MM/yyyy') : '—'
      ));
    });
    lines.push(csvRow('', '', fmtMoney(input.brutoAtivo), fmtMoney(input.liquidoAtivo), ''));
  }

  pushSection('ASSINANTES NÃO PAGOS');
  lines.push(csvRow('Cliente', 'Plano', 'Valor previsto', 'Situação'));
  if (input.naoPagosBreakdown.length === 0) {
    lines.push(csvRow('—', 'Nenhum', '', ''));
  } else {
    input.naoPagosBreakdown.forEach((row) => {
      lines.push(csvRow(row.clientName, row.planName, fmtMoney(row.value), row.bucket));
    });
  }

  pushSection('DESCONTOS CONCEDIDOS');
  lines.push(csvRow('Cliente', 'Plano base', 'Valor pago', 'Desconto'));
  if (input.discountRows.length === 0) {
    lines.push(csvRow('—', 'Sem descontos registrados', '', ''));
  } else {
    input.discountRows.forEach((row) => {
      lines.push(csvRow(row.clientName, fmtMoney(row.planValue), fmtMoney(row.paidValue), fmtMoney(row.discount)));
    });
    lines.push(csvRow('', '', 'TOTAL', fmtMoney(input.totalDescontos)));
  }

  pushSection('PAGAMENTOS A PROFISSIONAIS (MÊS)');
  lines.push(csvRow('Data', 'Profissional', 'Valor', 'Mês ref.'));
  if (input.professionalPayments.length === 0) {
    lines.push(csvRow('—', 'Nenhum pagamento registrado', '', ''));
  } else {
    input.professionalPayments.forEach((payment) => {
      lines.push(csvRow(
        fmtDate(payment.payment_date),
        payment.professional_name || 'Profissional',
        fmtMoney(Number(payment.amount || 0)),
        payment.for_month || ''
      ));
    });
    lines.push(csvRow('', '', fmtMoney(input.emContaSaidasMes), ''));
  }

  pushSection('ATENDIMENTOS DE ASSINANTES (MÊS)');
  lines.push(csvRow('Data', 'Profissional', 'Assinante', 'Repasse'));
  if (input.attendances.length === 0) {
    lines.push(csvRow('—', 'Nenhum atendimento', '', ''));
  } else {
    input.attendances.forEach((row) => {
      lines.push(csvRow(
        fmtDate(row.attendance_date),
        row.professional_name || 'Profissional',
        row.clientName || 'Assinante',
        fmtMoney(Number(row.repass_value || 0))
      ));
    });
    lines.push(csvRow('', '', 'TOTAL repasses', fmtMoney(input.repassesAtendimentos)));
  }

  pushSection('COMISSÕES DE VENDA DE ASSINATURA');
  lines.push(csvRow('Profissional vendedor', 'Assinante', 'Comissão'));
  if (input.saleCommissions.length === 0) {
    lines.push(csvRow('—', 'Nenhuma comissão', ''));
  } else {
    input.saleCommissions.forEach((row) => {
      lines.push(csvRow(
        row.professional_name || 'Profissional',
        row.clientName || 'Assinante',
        fmtMoney(Number(row.commission_amount || 0))
      ));
    });
    lines.push(csvRow('', 'TOTAL', fmtMoney(input.repassesComissaoVenda)));
  }

  pushBlank();
  lines.push(csvRow('Observação', 'Valores conforme tela Meus Assinantes na competência selecionada. Uso interno/contabilidade.'));

  return lines.join('\r\n');
}

export function downloadSubscriberAccountantReport(input: SubscriberAccountantReportInput): void {
  const csv = buildSubscriberAccountantReportCsv(input);
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const monthNum = String(input.monthIndex + 1).padStart(2, '0');
  const code = String(input.establishmentCode || input.establishmentId || 'estabelecimento').replace(/[^\w-]+/g, '_');
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `relatorio-assinaturas-${code}-${input.year}-${monthNum}.csv`;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
