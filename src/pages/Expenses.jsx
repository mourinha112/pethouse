import React, { useState, useEffect } from 'react';
import api from '../api';
import { useToast } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import Loading from '../components/Loading';
import {
  DollarSign, Plus, Trash2, X, Check, Clock,
  Home, User, Zap, Wifi, Wrench, FileText, MoreHorizontal, Truck
} from 'lucide-react';

const CATEGORIAS = [
  { value: 'aluguel', label: 'Aluguel', icon: Home },
  { value: 'funcionario', label: 'Funcionario', icon: User },
  { value: 'agua', label: 'Agua', icon: Zap },
  { value: 'luz', label: 'Luz', icon: Zap },
  { value: 'internet', label: 'Internet', icon: Wifi },
  { value: 'fornecedor', label: 'Fornecedor / Boleto', icon: Truck },
  { value: 'manutencao', label: 'Manutencao', icon: Wrench },
  { value: 'imposto', label: 'Imposto', icon: FileText },
  { value: 'outros', label: 'Outros', icon: MoreHorizontal },
];

const emptyForm = {
  descricao: '',
  categoria: 'fornecedor',
  valor: '',
  data_vencimento: '',
  recorrente: false,
  tipo_recorrencia: 'nenhum',
  data_inicio: '',
  data_fim: '',
};

export default function Expenses() {
  const toast = useToast();
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filterPago, setFilterPago] = useState('todos');
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => { loadData(); }, [currentMonth, filterPago]);

  async function loadData() {
    setLoading(true);
    try {
      let url = `/expenses?mes=${currentMonth}`;
      if (filterPago !== 'todos') url += `&pago=${filterPago === 'pago'}`;
      const [expRes, sumRes] = await Promise.all([
        api.get(url),
        api.get(`/expenses/summary?mes=${currentMonth}`),
      ]);
      setExpenses(Array.isArray(expRes.data) ? expRes.data : []);
      setSummary(sumRes.data || null);
    } catch (err) {
      console.error(err);
      setExpenses([]);
      setSummary(null);
    } finally { setLoading(false); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        valor: parseFloat(form.valor) || 0,
        recorrente: form.tipo_recorrencia === 'mensal' || form.tipo_recorrencia === 'periodo',
      };
      if (form.tipo_recorrencia === 'periodo') {
        payload.data_inicio = form.data_inicio || null;
        payload.data_fim = form.data_fim || null;
      }
      await api.post('/expenses', payload);
      setShowForm(false);
      setForm(emptyForm);
      toast.success('Despesa cadastrada!');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  }

  async function togglePago(id) {
    try {
      await api.put(`/expenses/${id}/toggle-pago?mes=${currentMonth}`);
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/expenses/${confirmDel.id}`);
      setConfirmDel(null);
      toast.success('Despesa removida');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  }

  function catLabel(value) {
    return CATEGORIAS.find(c => c.value === value)?.label || value;
  }

  function formatDate(d) {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }

  function formatMonth(m) {
    const [y, mo] = m.split('-');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${months[parseInt(mo) - 1]} ${y}`;
  }

  if (loading) return <Loading />;

  return (
    <div className="page page-wide">
      {confirmDel && <ConfirmModal title="Excluir Despesa" message={`Excluir "${confirmDel.descricao}"?`} onConfirm={handleDelete} onCancel={() => setConfirmDel(null)} confirmText="Excluir" danger />}
      <div className="page-header">
        <h1 className="page-title"><DollarSign size={24} /> Financeiro / Contas</h1>
        <button className="btn btn-primary" onClick={() => { setShowForm(true); setForm(emptyForm); }}>
          <Plus size={18} /> Nova Despesa
        </button>
      </div>

      {/* Cards resumo */}
      {summary && (
        <div className="cards-grid cards-grid-3">
          <div className="card card-green">
            <div className="card-icon"><DollarSign size={24} /></div>
            <div className="card-info">
              <span className="card-label">Total do Mês</span>
              <span className="card-value">R$ {(Number(summary.total) || 0).toFixed(2)}</span>
            </div>
          </div>
          <div className="card card-blue">
            <div className="card-icon"><Check size={24} /></div>
            <div className="card-info">
              <span className="card-label">Pago</span>
              <span className="card-value" style={{ color: '#43A047' }}>R$ {(Number(summary.pago) || 0).toFixed(2)}</span>
            </div>
          </div>
          <div className="card card-orange">
            <div className="card-icon"><Clock size={24} /></div>
            <div className="card-info">
              <span className="card-label">Pendente</span>
              <span className="card-value" style={{ color: '#E65100' }}>R$ {(Number(summary.pendente) || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="expenses-filters">
        <input type="month" value={currentMonth} onChange={e => setCurrentMonth(e.target.value)} className="expenses-month-input" />
        <div className="tabs" style={{ marginBottom: 0, flex: 1 }}>
          <button className={`tab ${filterPago === 'todos' ? 'active' : ''}`} onClick={() => setFilterPago('todos')}>Todos</button>
          <button className={`tab ${filterPago === 'pendente' ? 'active' : ''}`} onClick={() => setFilterPago('pendente')}>Pendentes</button>
          <button className={`tab ${filterPago === 'pago' ? 'active' : ''}`} onClick={() => setFilterPago('pago')}>Pagos</button>
        </div>
      </div>

      {/* Por categoria */}
      {summary && (summary.por_categoria || []).length > 0 && (
        <div className="expenses-categories">
          {(summary.por_categoria || []).map(c => (
            <div key={c.categoria} className="expenses-cat-chip">
              <span className="capitalize">{catLabel(c.categoria)}</span>
              <strong>R$ {(Number(c.total) || 0).toFixed(2)}</strong>
            </div>
          ))}
        </div>
      )}

      {/* Modal de nova despesa */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal modal-small" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nova Despesa</h2>
              <button className="btn-icon" onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Descricao</label>
                <input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}
                  required placeholder="Ex: Aluguel da loja" autoFocus />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Categoria</label>
                  <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                    {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Valor (R$)</label>
                  <input type="number" step="0.01" value={form.valor}
                    onChange={e => setForm({ ...form, valor: e.target.value })} required placeholder="0,00" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Vencimento</label>
                  <input type="date" value={form.data_vencimento}
                    onChange={e => setForm({ ...form, data_vencimento: e.target.value })}
                    placeholder="Data do boleto" />
                </div>
                <div className="form-group">
                  <label>Tipo</label>
                  <select
                    value={form.tipo_recorrencia || 'nenhum'}
                    onChange={e => {
                      const v = e.target.value;
                      setForm({
                        ...form,
                        tipo_recorrencia: v,
                        recorrente: v === 'mensal' || v === 'periodo',
                      });
                    }}>
                    <option value="nenhum">Única (não recorrente)</option>
                    <option value="mensal">Recorrente mensal (ex: aluguel)</option>
                    <option value="periodo">Várias parcelas / boletos (data início e fim)</option>
                  </select>
                </div>
              </div>
              {(form.tipo_recorrencia === 'periodo') && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Data início (1º boleto)</label>
                    <input type="date" value={form.data_inicio || ''}
                      onChange={e => setForm({ ...form, data_inicio: e.target.value })}
                      required={form.tipo_recorrencia === 'periodo'} />
                  </div>
                  <div className="form-group">
                    <label>Data fim (último boleto)</label>
                    <input type="date" value={form.data_fim || ''}
                      onChange={e => setForm({ ...form, data_fim: e.target.value })}
                      required={form.tipo_recorrencia === 'periodo'} />
                  </div>
                </div>
              )}
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabela de despesas */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Descricao</th>
              <th>Categoria</th>
              <th>Valor</th>
              <th>Vencimento / Período</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr><td colSpan="6" className="table-empty">Nenhuma despesa neste mes</td></tr>
            ) : (
              expenses.map(exp => (
                <tr key={exp.id} className={exp.pago ? '' : 'row-pending'}>
                  <td>
                    <button className={`expense-status-btn ${exp.pago ? 'paid' : 'pending'}`}
                      onClick={() => togglePago(exp.id)} title={exp.pago ? 'Marcar como pendente' : 'Marcar como pago'}>
                      {exp.pago ? <Check size={16} /> : <Clock size={16} />}
                    </button>
                  </td>
                  <td>
                    <strong>{exp.descricao}</strong>
                    {exp.recorrente && !exp.data_inicio && !exp.data_fim ? <span className="expense-recorrente">mensal</span> : null}
                    {exp.data_inicio && exp.data_fim ? (
                      <span className="expense-periodo" title="Período de boletos">
                        {formatDate(exp.data_inicio)} → {formatDate(exp.data_fim)}
                      </span>
                    ) : null}
                  </td>
                  <td><span className="capitalize">{catLabel(exp.categoria)}</span></td>
                  <td className={exp.pago ? '' : 'text-danger'}><strong>R$ {(Number(exp.valor) || 0).toFixed(2)}</strong></td>
                  <td>
                    {exp.data_inicio && exp.data_fim
                      ? `${formatDate(exp.data_inicio)} → ${formatDate(exp.data_fim)}`
                      : formatDate(exp.data_vencimento)}
                  </td>
                  <td>
                    <button className="btn-icon btn-delete" onClick={() => setConfirmDel(exp)}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
