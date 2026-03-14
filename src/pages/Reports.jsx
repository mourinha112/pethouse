import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';
import { useToast } from '../components/Toast';
import Loading from '../components/Loading';
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, CreditCard, Plus, Trash2,
  ChevronLeft, ChevronRight, ShoppingCart, Percent, Package, ArrowUpRight, ArrowDownRight,
  PieChart as PieChartIcon, Calendar, Award, Download
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const COLORS = ['#B60100', '#2563eb', '#16a34a', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const PAYMENT_COLORS = { pix: '#16a34a', dinheiro: '#f59e0b', cartao: '#2563eb', credito: '#8b5cf6', debito: '#06b6d4', outros: '#6b7280' };
const PAYMENT_LABELS = { pix: 'PIX', dinheiro: 'Dinheiro', cartao: 'Cartão', credito: 'Crédito', debito: 'Débito', outros: 'Outros' };

export default function Reports() {
  const toast = useToast();
  const [summary, setSummary] = useState(null);
  const [daily, setDaily] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [costs, setCosts] = useState([]);
  const [showCostForm, setShowCostForm] = useState(false);
  const [costForm, setCostForm] = useState({ descricao: '', valor: '' });
  const [activeTab, setActiveTab] = useState('resumo');
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => { loadAll(); }, [selectedMonth]);

  async function loadAll() {
    setLoading(true);
    try {
      const [summaryRes, dailyRes, monthlyRes, costsRes] = await Promise.all([
        api.get(`/reports/summary?mes=${selectedMonth}`),
        api.get('/reports/daily?dias=30'),
        api.get('/reports/monthly?meses=12'),
        api.get('/costs'),
      ]);
      setSummary(summaryRes.data);
      setDaily(dailyRes.data);
      setMonthly(monthlyRes.data);
      setCosts(costsRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleAddCost(e) {
    e.preventDefault();
    try {
      await api.post('/costs', { descricao: costForm.descricao, valor: parseFloat(costForm.valor) || 0 });
      setCostForm({ descricao: '', valor: '' });
      setShowCostForm(false);
      toast.success('Custo adicionado!');
      loadAll();
    } catch (err) { toast.error(err.message); }
  }

  async function handleDeleteCost(id) {
    try { await api.delete(`/costs/${id}`); loadAll(); toast.success('Custo removido'); }
    catch (err) { toast.error(err.message); }
  }

  function formatCurrency(value) { return `R$ ${(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return day ? `${day}/${month}/${year}` : `${month}/${year}`;
  }
  function formatMonthLabel(mes) {
    if (!mes) return '';
    const [y, m] = mes.split('-');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${months[parseInt(m) - 1]}/${y.slice(2)}`;
  }
  function formatFullMonth(mes) {
    if (!mes) return '';
    const [y, m] = mes.split('-');
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${months[parseInt(m) - 1]} de ${y}`;
  }

  function changeMonth(delta) {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(d.toISOString().slice(0, 7));
  }

  const CustomTooltip = ({ active, payload, label, prefix = 'R$' }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="report-chart-tooltip">
        <p className="report-chart-tooltip-label">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} style={{ color: entry.color }}>
            {entry.name}: {prefix === 'R$' ? formatCurrency(entry.value) : entry.value}
          </p>
        ))}
      </div>
    );
  };

  // Dados para gráfico de pizza de pagamentos
  const paymentPieData = useMemo(() => {
    if (!summary?.vendas_por_pagamento) return [];
    return summary.vendas_por_pagamento.map(p => ({
      name: PAYMENT_LABELS[p.forma_pagamento] || p.forma_pagamento,
      value: p.total,
      vendas: p.vendas,
      color: PAYMENT_COLORS[p.forma_pagamento] || '#6b7280'
    }));
  }, [summary]);

  // Dados para gráfico de despesas por categoria
  const expensesPieData = useMemo(() => {
    if (!summary?.despesas_por_categoria) return [];
    return summary.despesas_por_categoria.map((d, i) => ({
      name: d.categoria.charAt(0).toUpperCase() + d.categoria.slice(1),
      value: d.total,
      color: COLORS[i % COLORS.length]
    }));
  }, [summary]);

  if (loading) return <Loading />;

  const tabs = [
    { id: 'resumo', label: 'Resumo Mensal', icon: <BarChart3 size={16} /> },
    { id: 'graficos', label: 'Gráficos', icon: <TrendingUp size={16} /> },
    { id: 'diario', label: 'Faturamento Diário', icon: <Calendar size={16} /> },
    { id: 'mensal', label: 'Faturamento Mensal', icon: <BarChart3 size={16} /> },
    { id: 'produtos', label: 'Top Produtos', icon: <Award size={16} /> },
    { id: 'custos', label: 'Custos Fixos', icon: <DollarSign size={16} /> },
  ];

  return (
    <div className="page page-wide">
      <div className="page-header">
        <h1 className="page-title"><BarChart3 size={24} /> Relatórios</h1>
        <div className="report-month-nav">
          <button className="btn btn-secondary btn-sm" onClick={() => changeMonth(-1)}><ChevronLeft size={18} /></button>
          <span className="report-month-label">{formatFullMonth(selectedMonth)}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => changeMonth(1)}><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="tabs">
        {tabs.map(t => (
          <button key={t.id} className={`tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ===== RESUMO MENSAL ===== */}
      {activeTab === 'resumo' && summary && (
        <div className="report-summary">
          {/* KPI Cards */}
          <div className="cards-grid cards-grid-4">
            <div className="card card-green">
              <div className="card-icon"><TrendingUp size={24} /></div>
              <div className="card-info">
                <span className="card-label">Faturamento</span>
                <span className="card-value">{formatCurrency(summary.faturamento_mes)}</span>
                <span className="card-sub">{summary.total_vendas} vendas</span>
              </div>
            </div>
            <div className="card card-blue">
              <div className="card-icon"><DollarSign size={24} /></div>
              <div className="card-info">
                <span className="card-label">Lucro Bruto</span>
                <span className="card-value">{formatCurrency(summary.lucro_bruto)}</span>
                <span className="card-sub">Margem: {(summary.margem_bruta || 0).toFixed(1)}%</span>
              </div>
            </div>
            <div className="card card-purple">
              <div className="card-icon"><DollarSign size={24} /></div>
              <div className="card-info">
                <span className="card-label">Lucro Líquido</span>
                <span className="card-value" style={{ color: (summary.lucro_liquido || 0) >= 0 ? '#16a34a' : '#dc2626' }}>{formatCurrency(summary.lucro_liquido)}</span>
                <span className="card-sub">Margem: {(summary.margem_liquida || 0).toFixed(1)}%</span>
              </div>
            </div>
            <div className="card card-orange">
              <div className="card-icon"><ShoppingCart size={24} /></div>
              <div className="card-info">
                <span className="card-label">Ticket Médio</span>
                <span className="card-value">{formatCurrency(summary.ticket_medio)}</span>
                <span className="card-sub">{summary.total_vendas} vendas</span>
              </div>
            </div>
          </div>

          {/* Gráfico de Faturamento Diário do Mês */}
          {summary.vendas_por_dia && summary.vendas_por_dia.length > 0 && (
            <div className="report-chart-container">
              <h3>Faturamento Diário - {formatFullMonth(selectedMonth)}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={summary.vendas_por_dia}>
                  <defs>
                    <linearGradient id="colorFat" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#B60100" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#B60100" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `R$${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="faturamento" name="Faturamento" stroke="#B60100" fill="url(#colorFat)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* DRE - Detalhamento */}
          <div className="report-details">
            <h3>DRE Simplificado</h3>
            <table className="data-table">
              <tbody>
                <tr><td><strong>Faturamento Bruto</strong></td><td className="text-right"><strong>{formatCurrency(summary.faturamento_mes)}</strong></td></tr>
                <tr><td className="text-indent">(-) Custo dos Produtos (CMV)</td><td className="text-right text-danger">{formatCurrency(summary.custo_produtos)}</td></tr>
                <tr className="row-highlight"><td><strong>= Lucro Bruto</strong></td><td className="text-right"><strong>{formatCurrency(summary.lucro_bruto)}</strong></td></tr>
                <tr><td className="text-indent">(-) Custos Fixos</td><td className="text-right text-danger">{formatCurrency(summary.custos_fixos)}</td></tr>
                <tr><td className="text-indent">(-) Despesas do Mês</td><td className="text-right text-danger">{formatCurrency(summary.despesas_mes)}</td></tr>
                <tr><td className="text-indent">(-) Taxa Maquininha ({summary.taxa_maquininha || 0}%)</td><td className="text-right text-danger">{formatCurrency(summary.custo_maquininha)}</td></tr>
                <tr className="row-highlight" style={{ background: (summary.lucro_liquido || 0) >= 0 ? '#f0fdf4' : '#fef2f2' }}>
                  <td><strong>= Lucro Líquido</strong></td>
                  <td className="text-right" style={{ color: (summary.lucro_liquido || 0) >= 0 ? '#16a34a' : '#dc2626' }}>
                    <strong>{formatCurrency(summary.lucro_liquido)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Vendas por Forma de Pagamento */}
          {paymentPieData.length > 0 && (
            <div className="report-row">
              <div className="report-chart-container report-half">
                <h3>Vendas por Forma de Pagamento</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={paymentPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {paymentPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="report-chart-container report-half">
                <h3>Detalhamento por Pagamento</h3>
                <table className="data-table">
                  <thead><tr><th>Forma</th><th>Vendas</th><th>Total</th><th>%</th></tr></thead>
                  <tbody>
                    {summary.vendas_por_pagamento.map(p => (
                      <tr key={p.forma_pagamento}>
                        <td>
                          <span className="report-color-dot" style={{ background: PAYMENT_COLORS[p.forma_pagamento] || '#6b7280' }}></span>
                          {PAYMENT_LABELS[p.forma_pagamento] || p.forma_pagamento}
                        </td>
                        <td>{p.vendas}</td>
                        <td>{formatCurrency(p.total)}</td>
                        <td>{summary.faturamento_mes > 0 ? ((p.total / summary.faturamento_mes) * 100).toFixed(1) : 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== GRÁFICOS ===== */}
      {activeTab === 'graficos' && (
        <div className="report-graficos">
          {/* Faturamento mensal (barras) */}
          <div className="report-chart-container">
            <h3>Faturamento Mensal (Últimos 12 meses)</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="mes" tickFormatter={formatMonthLabel} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `R$${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                <Tooltip content={<CustomTooltip />} labelFormatter={formatMonthLabel} />
                <Legend />
                <Bar dataKey="faturamento" name="Faturamento" fill="#B60100" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Vendas por mês (linha) */}
          <div className="report-chart-container">
            <h3>Quantidade de Vendas por Mês</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="mes" tickFormatter={formatMonthLabel} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip prefix="" />} labelFormatter={formatMonthLabel} />
                <Legend />
                <Line type="monotone" dataKey="vendas" name="Vendas" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Faturamento diário (últimos 30 dias) */}
          <div className="report-chart-container">
            <h3>Faturamento Diário (Últimos 30 dias)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={daily}>
                <defs>
                  <linearGradient id="colorDaily" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="data" tickFormatter={d => d ? d.slice(8, 10) + '/' + d.slice(5, 7) : ''} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `R$${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                <Tooltip content={<CustomTooltip />} labelFormatter={formatDate} />
                <Area type="monotone" dataKey="faturamento" name="Faturamento" stroke="#16a34a" fill="url(#colorDaily)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Despesas por categoria */}
          {expensesPieData.length > 0 && (
            <div className="report-chart-container">
              <h3>Despesas por Categoria - {formatFullMonth(selectedMonth)}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={expensesPieData} cx="50%" cy="50%" outerRadius={110} paddingAngle={2} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {expensesPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ===== FATURAMENTO DIÁRIO ===== */}
      {activeTab === 'diario' && (
        <div>
          <div className="report-chart-container">
            <h3>Faturamento dos Últimos 30 Dias</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="data" tickFormatter={d => d ? d.slice(8, 10) + '/' + d.slice(5, 7) : ''} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `R$${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                <Tooltip content={<CustomTooltip />} labelFormatter={formatDate} />
                <Bar dataKey="faturamento" name="Faturamento" fill="#B60100" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Data</th><th>Vendas</th><th>Faturamento</th><th>Média/Venda</th></tr></thead>
              <tbody>
                {daily.length === 0 ? (<tr><td colSpan="4" className="table-empty">Sem dados</td></tr>) : (
                  [...daily].reverse().map(d => (
                    <tr key={d.data} className={d.faturamento > 0 ? '' : 'row-muted'}>
                      <td>{formatDate(d.data)}</td>
                      <td>{d.vendas}</td>
                      <td>{formatCurrency(d.faturamento)}</td>
                      <td>{d.vendas > 0 ? formatCurrency(d.faturamento / d.vendas) : '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="row-highlight">
                  <td><strong>Total</strong></td>
                  <td><strong>{daily.reduce((s, d) => s + d.vendas, 0)}</strong></td>
                  <td><strong>{formatCurrency(daily.reduce((s, d) => s + d.faturamento, 0))}</strong></td>
                  <td><strong>{daily.reduce((s, d) => s + d.vendas, 0) > 0 ? formatCurrency(daily.reduce((s, d) => s + d.faturamento, 0) / daily.reduce((s, d) => s + d.vendas, 0)) : '-'}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ===== FATURAMENTO MENSAL ===== */}
      {activeTab === 'mensal' && (
        <div>
          <div className="report-chart-container">
            <h3>Evolução do Faturamento Mensal</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="mes" tickFormatter={formatMonthLabel} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `R$${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                <Tooltip content={<CustomTooltip />} labelFormatter={formatMonthLabel} />
                <Legend />
                <Bar dataKey="faturamento" name="Faturamento" fill="#B60100" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Mês</th><th>Vendas</th><th>Faturamento</th><th>Média/Venda</th></tr></thead>
              <tbody>
                {monthly.length === 0 ? (<tr><td colSpan="4" className="table-empty">Sem dados</td></tr>) : (
                  [...monthly].reverse().map(m => (
                    <tr key={m.mes} className={m.faturamento > 0 ? '' : 'row-muted'}>
                      <td>{formatMonthLabel(m.mes)}</td>
                      <td>{m.vendas}</td>
                      <td>{formatCurrency(m.faturamento)}</td>
                      <td>{m.vendas > 0 ? formatCurrency(m.faturamento / m.vendas) : '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="row-highlight">
                  <td><strong>Total</strong></td>
                  <td><strong>{monthly.reduce((s, m) => s + m.vendas, 0)}</strong></td>
                  <td><strong>{formatCurrency(monthly.reduce((s, m) => s + m.faturamento, 0))}</strong></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ===== TOP PRODUTOS ===== */}
      {activeTab === 'produtos' && summary && (
        <div>
          {summary.top_produtos && summary.top_produtos.length > 0 ? (
            <>
              <div className="report-chart-container">
                <h3>Top 10 Produtos - {formatFullMonth(selectedMonth)}</h3>
                <ResponsiveContainer width="100%" height={Math.max(300, summary.top_produtos.length * 40)}>
                  <BarChart data={summary.top_produtos} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis type="number" tickFormatter={v => `R$${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="nome" width={180} tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total" name="Faturamento" fill="#B60100" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="table-container">
                <table className="data-table">
                  <thead><tr><th>#</th><th>Produto</th><th>Quantidade</th><th>Faturamento</th><th>% do Total</th></tr></thead>
                  <tbody>
                    {summary.top_produtos.map((p, i) => (
                      <tr key={p.id}>
                        <td><span className="report-rank">{i + 1}</span></td>
                        <td><strong>{p.nome}</strong></td>
                        <td>{p.quantidade % 1 === 0 ? p.quantidade : p.quantidade.toFixed(2)}</td>
                        <td>{formatCurrency(p.total)}</td>
                        <td>
                          <div className="report-bar-wrapper">
                            <div className="report-bar" style={{ width: `${summary.faturamento_mes > 0 ? (p.total / summary.faturamento_mes * 100) : 0}%` }}></div>
                            <span>{summary.faturamento_mes > 0 ? ((p.total / summary.faturamento_mes) * 100).toFixed(1) : 0}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="row-highlight">
                      <td></td>
                      <td><strong>Total Top 10</strong></td>
                      <td></td>
                      <td><strong>{formatCurrency(summary.top_produtos.reduce((s, p) => s + p.total, 0))}</strong></td>
                      <td><strong>{summary.faturamento_mes > 0 ? ((summary.top_produtos.reduce((s, p) => s + p.total, 0) / summary.faturamento_mes) * 100).toFixed(1) : 0}%</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          ) : (
            <div className="report-empty">
              <Package size={48} />
              <p>Nenhuma venda registrada em {formatFullMonth(selectedMonth)}</p>
            </div>
          )}
        </div>
      )}

      {/* ===== CUSTOS FIXOS ===== */}
      {activeTab === 'custos' && (
        <div>
          <div className="page-header" style={{ marginTop: '1rem' }}>
            <h3>Custos Fixos Mensais</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCostForm(true)}><Plus size={16} /> Adicionar</button>
          </div>
          {showCostForm && (
            <form onSubmit={handleAddCost} className="inline-form">
              <input placeholder="Descrição" value={costForm.descricao} onChange={e => setCostForm({ ...costForm, descricao: e.target.value })} required />
              <input type="number" step="0.01" placeholder="Valor (R$)" value={costForm.valor} onChange={e => setCostForm({ ...costForm, valor: e.target.value })} required />
              <button type="submit" className="btn btn-primary btn-sm">Salvar</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCostForm(false)}>Cancelar</button>
            </form>
          )}
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Descrição</th><th>Valor</th><th>Ações</th></tr></thead>
              <tbody>
                {costs.length === 0 ? (<tr><td colSpan="3" className="table-empty">Nenhum custo fixo cadastrado</td></tr>) : (
                  costs.map(c => (
                    <tr key={c.id}>
                      <td>{c.descricao}</td>
                      <td>{formatCurrency(c.valor)}</td>
                      <td><button className="btn-icon btn-delete" onClick={() => handleDeleteCost(c.id)}><Trash2 size={16} /></button></td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="row-highlight">
                  <td><strong>Total Mensal</strong></td>
                  <td><strong>{formatCurrency(costs.reduce((s, c) => s + (Number(c.valor) || 0), 0))}</strong></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
