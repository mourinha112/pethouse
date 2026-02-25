import React, { useState, useEffect } from 'react';
import api from '../api';
import { useToast } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import Loading from '../components/Loading';
import { Plus, Edit2, Trash2, X, Phone } from 'lucide-react';

const emptyForm = { nome: '', whatsapp: '', tipo_pet: '', racao_utilizada: '' };

export default function Clients() {
  const toast = useToast();
  const [clients, setClients] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => { loadClients(); }, []);

  async function loadClients() {
    try { const res = await api.get('/clients'); setClients(res.data); }
    catch (err) { toast.error('Erro ao carregar clientes'); }
    finally { setLoading(false); }
  }

  function handleChange(e) { setForm({ ...form, [e.target.name]: e.target.value }); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nome.trim()) { toast.error('Nome do cliente obrigatorio'); return; }
    try {
      if (editId) { await api.put(`/clients/${editId}`, form); toast.success('Cliente atualizado!'); }
      else { await api.post('/clients', form); toast.success('Cliente cadastrado!'); }
      setShowForm(false); setEditId(null); setForm(emptyForm); loadClients();
    } catch (err) { toast.error(err.response?.data?.error || err.message); }
  }

  function handleEdit(c) { setForm({ nome: c.nome, whatsapp: c.whatsapp, tipo_pet: c.tipo_pet, racao_utilizada: c.racao_utilizada }); setEditId(c.id); setShowForm(true); }

  async function handleDelete() {
    try { await api.delete(`/clients/${confirmDel.id}`); setConfirmDel(null); toast.success('Cliente removido'); loadClients(); }
    catch (err) { toast.error(err.message); }
  }

  const filtered = clients.filter(c => c.nome.toLowerCase().includes(search.toLowerCase()) || c.whatsapp.includes(search));

  if (loading) return <Loading />;

  return (
    <div className="page page-wide">
      <div className="page-header">
        <h1 className="page-title">Clientes</h1>
        <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); }}><Plus size={18} /> Novo Cliente</button>
      </div>

      <div className="filter-bar"><input type="text" placeholder="Buscar por nome ou WhatsApp..." value={search} onChange={e => setSearch(e.target.value)} className="filter-input" /></div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal modal-small" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>{editId ? 'Editar Cliente' : 'Novo Cliente'}</h2><button className="btn-icon" onClick={() => setShowForm(false)}><X size={20} /></button></div>
            <form onSubmit={handleSubmit}>
              <div className="form-group"><label>Nome *</label><input name="nome" value={form.nome} onChange={handleChange} required placeholder="Nome do cliente" autoFocus /></div>
              <div className="form-group"><label>WhatsApp</label><input name="whatsapp" value={form.whatsapp} onChange={handleChange} placeholder="(00) 00000-0000" /></div>
              <div className="form-group"><label>Tipo de Pet</label><input name="tipo_pet" value={form.tipo_pet} onChange={handleChange} placeholder="Cao, Gato..." /></div>
              <div className="form-group"><label>Racao Utilizada</label><input name="racao_utilizada" value={form.racao_utilizada} onChange={handleChange} placeholder="Marca/tipo" /></div>
              <div className="form-actions"><button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button><button type="submit" className="btn btn-primary">{editId ? 'Salvar' : 'Cadastrar'}</button></div>
            </form>
          </div>
        </div>
      )}

      {confirmDel && <ConfirmModal title="Excluir Cliente" message={`Excluir "${confirmDel.nome}"?`} onConfirm={handleDelete} onCancel={() => setConfirmDel(null)} confirmText="Excluir" danger />}

      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Nome</th><th>WhatsApp</th><th>Tipo Pet</th><th>Racao</th><th>Ultima Compra</th><th>Acoes</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? (<tr><td colSpan="6" className="table-empty">Nenhum cliente encontrado</td></tr>) : (
              filtered.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.nome}</strong></td>
                  <td>{c.whatsapp && <span className="whatsapp-link"><Phone size={14} /> {c.whatsapp}</span>}</td>
                  <td>{c.tipo_pet}</td><td>{c.racao_utilizada}</td>
                  <td>{c.ultima_compra ? new Date(c.ultima_compra).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="table-actions">
                    <button className="btn-icon btn-edit" onClick={() => handleEdit(c)}><Edit2 size={16} /></button>
                    <button className="btn-icon btn-delete" onClick={() => setConfirmDel(c)}><Trash2 size={16} /></button>
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
