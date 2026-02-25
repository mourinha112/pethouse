import React, { useState, useEffect } from 'react';
import api from '../api';
import { useToast } from '../components/Toast';
import Loading from '../components/Loading';
import { BarChart3, TrendingUp, DollarSign, CreditCard, Plus, Trash2, X } from 'lucide-react';

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

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [summaryRes, dailyRes, monthlyRes, costsRes] = await Promise.all([
        api.get('/reports/summary'),
        api.get('/reports/daily'),
        api.get('/reports/monthly'),
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

  function formatCurrency(value) { return `R$ ${(value || 0).toFixed(2)}`; }
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return day ? `${day}/${month}/${year}` : `${month}/${year}`;
  }

  if (loading) return <Loading />;

  return (
    <div className="page page-wide">
      <div className="page-header">
        <h1 className="page-title"><BarChart3 size={24} /> Relatorios</h1>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'resumo' ? 'active' : ''}`} onClick={() => setActiveTab('resumo')}>Resumo Mensal</button>
        <button className={`tab ${activeTab === 'diario' ? 'active' : ''}`} onClick={() => setActiveTab('diario')}>Faturamento Diario</button>
        <button className={`tab ${activeTab === 'mensal' ? 'active' : ''}`} onClick={() => setActiveTab('mensal')}>Faturamento Mensal</button>
        <button className={`tab ${activeTab === 'custos' ? 'active' : ''}`} onClick={() => setActiveTab('custos')}>Custos Fixos</button>
      </div>

      {activeTab === 'resumo' && summary && (
        <div className="report-summary">
          <div className="cards-grid cards-grid-4">
            <div className="card card-green"><div className="card-icon"><TrendingUp size={24} /></div><div className="card-info"><span className="card-label">Faturamento do Mes</span><span className="card-value">{formatCurrency(summary.faturamento_mes)}</span></div></div>
            <div className="card card-blue"><div className="card-icon"><DollarSign size={24} /></div><div className="card-info"><span className="card-label">Lucro Bruto</span><span className="card-value">{formatCurrency(summary.lucro_bruto)}</span></div></div>
            <div className="card card-purple"><div className="card-icon"><DollarSign size={24} /></div><div className="card-info"><span className="card-label">Lucro Liquido</span><span className="card-value">{formatCurrency(summary.lucro_liquido)}</span></div></div>
            <div className="card card-orange"><div className="card-icon"><CreditCard size={24} /></div><div className="card-info"><span className="card-label">Taxa Maquininha</span><span className="card-value">{formatCurrency(summary.custo_maquininha)}</span></div></div>
          </div>
          <div className="report-details">
            <h3>Detalhamento</h3>
            <table className="data-table"><tbody>
              <tr><td>Faturamento</td><td className="text-right">{formatCurrency(summary.faturamento_mes)}</td></tr>
              <tr><td>(-) Custo dos Produtos</td><td className="text-right text-danger">{formatCurrency(summary.custo_produtos)}</td></tr>
              <tr className="row-highlight"><td><strong>Lucro Bruto</strong></td><td className="text-right"><strong>{formatCurrency(summary.lucro_bruto)}</strong></td></tr>
              <tr><td>(-) Custos Fixos</td><td className="text-right text-danger">{formatCurrency(summary.custos_fixos)}</td></tr>
              <tr><td>(-) Taxa Maquininha ({summary.taxa_maquininha}%)</td><td className="text-right text-danger">{formatCurrency(summary.custo_maquininha)}</td></tr>
              <tr className="row-highlight"><td><strong>Lucro Liquido Estimado</strong></td><td className="text-right"><strong>{formatCurrency(summary.lucro_liquido)}</strong></td></tr>
            </tbody></table>
          </div>
          {summary.vendas_por_pagamento && summary.vendas_por_pagamento.length > 0 && (
            <div className="report-details">
              <h3>Vendas por Forma de Pagamento</h3>
              <table className="data-table"><thead><tr><th>Forma</th><th>Vendas</th><th>Total</th></tr></thead><tbody>
                {summary.vendas_por_pagamento.map(p => (
                  <tr key={p.forma_pagamento}><td className="capitalize">{p.forma_pagamento}</td><td>{p.vendas}</td><td>{formatCurrency(p.total)}</td></tr>
                ))}
              </tbody></table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'diario' && (
        <div className="table-container"><table className="data-table"><thead><tr><th>Data</th><th>Vendas</th><th>Faturamento</th></tr></thead><tbody>
          {daily.length === 0 ? (<tr><td colSpan="3" className="table-empty">Sem dados</td></tr>) : (
            daily.map(d => (<tr key={d.data}><td>{formatDate(d.data)}</td><td>{d.vendas}</td><td>{formatCurrency(d.faturamento)}</td></tr>))
          )}
        </tbody></table></div>
      )}

      {activeTab === 'mensal' && (
        <div className="table-container"><table className="data-table"><thead><tr><th>Mes</th><th>Vendas</th><th>Faturamento</th></tr></thead><tbody>
          {monthly.length === 0 ? (<tr><td colSpan="3" className="table-empty">Sem dados</td></tr>) : (
            monthly.map(m => (<tr key={m.mes}><td>{formatDate(m.mes)}</td><td>{m.vendas}</td><td>{formatCurrency(m.faturamento)}</td></tr>))
          )}
        </tbody></table></div>
      )}

      {activeTab === 'custos' && (
        <div>
          <div className="page-header" style={{ marginTop: '1rem' }}>
            <h3>Custos Fixos Mensais</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCostForm(true)}><Plus size={16} /> Adicionar</button>
          </div>
          {showCostForm && (
            <form onSubmit={handleAddCost} className="inline-form">
              <input placeholder="Descricao" value={costForm.descricao} onChange={e => setCostForm({ ...costForm, descricao: e.target.value })} required />
              <input type="number" step="0.01" placeholder="Valor (R$)" value={costForm.valor} onChange={e => setCostForm({ ...costForm, valor: e.target.value })} required />
              <button type="submit" className="btn btn-primary btn-sm">Salvar</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCostForm(false)}>Cancelar</button>
            </form>
          )}
          <div className="table-container"><table className="data-table"><thead><tr><th>Descricao</th><th>Valor</th><th>Acoes</th></tr></thead><tbody>
            {costs.length === 0 ? (<tr><td colSpan="3" className="table-empty">Nenhum custo fixo</td></tr>) : (
              costs.map(c => (
                <tr key={c.id}><td>{c.descricao}</td><td>{formatCurrency(c.valor)}</td><td><button className="btn-icon btn-delete" onClick={() => handleDeleteCost(c.id)}><Trash2 size={16} /></button></td></tr>
              ))
            )}
            <tr className="row-highlight"><td><strong>Total</strong></td><td><strong>{formatCurrency(costs.reduce((s, c) => s + c.valor, 0))}</strong></td><td></td></tr>
          </tbody></table></div>
        </div>
      )}
    </div>
  );
}
