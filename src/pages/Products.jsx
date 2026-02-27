import React, { useState, useEffect } from 'react';
import api from '../api';
import { useToast } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import Loading from '../components/Loading';
import { Plus, Edit2, Trash2, PackagePlus, X } from 'lucide-react';

const TIPOS = [
  { value: 'cao', label: 'Cão' }, { value: 'gato', label: 'Gato' },
  { value: 'filhote', label: 'Filhote' }, { value: 'castrado', label: 'Castrado' }, { value: 'outro', label: 'Outro' },
];

const CATEGORIAS = [
  { value: 'racao', label: 'Ração' },
  { value: 'sache', label: 'Sachê' },
  { value: 'medicamento', label: 'Medicamento' },
  { value: 'coleira', label: 'Coleira' },
  { value: 'roupinha', label: 'Roupinha' },
  { value: 'comida_aves', label: 'Comida (aves/pássaros)' },
  { value: 'acessorio', label: 'Acessório' },
  { value: 'outros', label: 'Outros' },
];

const emptyForm = {
  nome: '', marca: '', tipo: 'cao', categoria: 'racao',
  peso_saco_kg: '', custo_saco: '', margem_percentual: '', margem_saco: '', preco_saco_fechado: '',
  estoque_kg: '', estoque_minimo_dias: '7',
  custo_unitario: '', preco_unitario: '', estoque_unidade: '', estoque_minimo_unidade: '0',
  custo_pacote: '', unidades_pacote: '', margem_unitaria: '',
};

function isRacao(cat) { return !cat || cat === 'racao'; }

export default function Products() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showStockModal, setShowStockModal] = useState(null);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [stockEntry, setStockEntry] = useState({ quantidade_kg: '', quantidade_unidade: '', motivo: 'Reposicao' });
  const [loading, setLoading] = useState(true);
  const [confirmDel, setConfirmDel] = useState(null);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [filterStock, setFilterStock] = useState('');

  useEffect(() => { loadProducts(); }, []);

  async function loadProducts() {
    try { const res = await api.get('/products'); setProducts(res.data); }
    catch (err) { toast.error('Erro ao carregar produtos'); }
    finally { setLoading(false); }
  }

  function handleChange(e) { setForm({ ...form, [e.target.name]: e.target.value }); }

  const custo_por_kg = form.peso_saco_kg > 0 ? (form.custo_saco / form.peso_saco_kg) : 0;
  const preco_por_kg = custo_por_kg * (1 + (form.margem_percentual || 0) / 100);
  const preco_saco_calculado = form.margem_saco ? form.custo_saco * (1 + (form.margem_saco || 0) / 100) : 0;

  // Cálculo automático para produtos por unidade (pacote)
  const custoUnitCalc = (form.custo_pacote > 0 && form.unidades_pacote > 0) ? (form.custo_pacote / form.unidades_pacote) : 0;
  const precoUnitCalc = custoUnitCalc > 0 && form.margem_unitaria > 0 ? custoUnitCalc * (1 + form.margem_unitaria / 100) : 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nome.trim()) { toast.error('Nome do produto obrigatório'); return; }
    const isR = isRacao(form.categoria);
    if (isR) {
      if (!form.peso_saco_kg || parseFloat(form.peso_saco_kg) <= 0) { toast.error('Peso do saco obrigatório'); return; }
      if (!form.custo_saco || parseFloat(form.custo_saco) <= 0) { toast.error('Custo do saco obrigatório'); return; }
    } else {
      if ((parseFloat(form.preco_unitario) || 0) <= 0 && precoUnitCalc <= 0) { toast.error('Preço unitário obrigatório'); return; }
    }
    try {
      const payload = {
        nome: form.nome.trim(),
        marca: form.marca || '',
        tipo: form.tipo,
        categoria: form.categoria || 'racao',
        peso_saco_kg: isR ? parseFloat(form.peso_saco_kg) || 0 : 0,
        custo_saco: isR ? parseFloat(form.custo_saco) || 0 : 0,
        custo_por_kg: isR ? custo_por_kg : 0,
        margem_percentual: isR ? parseFloat(form.margem_percentual) || 0 : 0,
        margem_saco: isR ? parseFloat(form.margem_saco) || 0 : 0,
        preco_por_kg: isR ? preco_por_kg : 0,
        preco_saco_fechado: isR ? (form.margem_saco ? preco_saco_calculado : parseFloat(form.preco_saco_fechado) || 0) : 0,
        estoque_kg: isR ? parseFloat(form.estoque_kg) || 0 : 0,
        estoque_minimo_dias: isR ? parseInt(form.estoque_minimo_dias) || 7 : 7,
        custo_unitario: !isR ? (custoUnitCalc > 0 ? custoUnitCalc : parseFloat(form.custo_unitario) || 0) : 0,
        preco_unitario: !isR ? (precoUnitCalc > 0 ? precoUnitCalc : parseFloat(form.preco_unitario) || 0) : 0,
        estoque_unidade: !isR ? parseInt(form.estoque_unidade, 10) || 0 : 0,
        estoque_minimo_unidade: !isR ? parseInt(form.estoque_minimo_unidade, 10) || 0 : 0,
      };
      if (editId) { await api.put(`/products/${editId}`, payload); toast.success('Produto atualizado!'); }
      else { await api.post('/products', payload); toast.success('Produto cadastrado!'); }
      setShowForm(false); setEditId(null); setForm(emptyForm); loadProducts();
    } catch (err) { toast.error(err.response?.data?.error || err.message); }
  }

  function handleEdit(p) {
    setForm({
      nome: p.nome, marca: p.marca || '', tipo: p.tipo || 'cao', categoria: p.categoria || 'racao',
      peso_saco_kg: p.peso_saco_kg ?? '', custo_saco: p.custo_saco ?? '', margem_percentual: p.margem_percentual ?? '', margem_saco: p.margem_saco ?? '', preco_saco_fechado: p.preco_saco_fechado ?? '',
      estoque_kg: p.estoque_kg ?? '', estoque_minimo_dias: p.estoque_minimo_dias ?? 7,
      custo_unitario: p.custo_unitario ?? '', preco_unitario: p.preco_unitario ?? '', estoque_unidade: p.estoque_unidade ?? '', estoque_minimo_unidade: p.estoque_minimo_unidade ?? 0,
    });
    setEditId(p.id); setShowForm(true);
  }

  async function handleDelete() {
    try { await api.delete(`/products/${confirmDel.id}`); setConfirmDel(null); toast.success('Produto desativado'); loadProducts(); }
    catch (err) { toast.error(err.message); }
  }

  const productForStock = showStockModal ? products.find(p => p.id === showStockModal) : null;
  const isUnitProduct = productForStock && !isRacao(productForStock.categoria);

  async function handleStockEntry(e) {
    e.preventDefault();
    if (isUnitProduct) {
      const qty = parseInt(stockEntry.quantidade_unidade, 10);
      if (!qty || qty <= 0) { toast.error('Quantidade inválida'); return; }
      try {
        await api.post(`/products/${showStockModal}/stock-entry`, { quantidade_unidade: qty, motivo: stockEntry.motivo });
        setShowStockModal(null); setStockEntry({ quantidade_kg: '', quantidade_unidade: '', motivo: 'Reposicao' }); toast.success('Estoque atualizado!'); loadProducts();
      } catch (err) { toast.error(err.message); }
    } else {
      const qty = parseFloat(stockEntry.quantidade_kg);
      if (!qty || qty <= 0) { toast.error('Quantidade inválida'); return; }
      try {
        await api.post(`/products/${showStockModal}/stock-entry`, { quantidade_kg: qty, motivo: stockEntry.motivo });
        setShowStockModal(null); setStockEntry({ quantidade_kg: '', quantidade_unidade: '', motivo: 'Reposicao' }); toast.success('Estoque atualizado!'); loadProducts();
      } catch (err) { toast.error(err.message); }
    }
  }

  const filtered = products.filter(p => {
    if (search && !p.nome.toLowerCase().includes(search.toLowerCase()) && !(p.marca || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (filterTipo && p.tipo !== filterTipo) return false;
    if (filterCategoria && (p.categoria || 'racao') !== filterCategoria) return false;
    if (filterStock) {
      const isR = isRacao(p.categoria);
      if (isR) {
        if (filterStock === 'baixo' && p.estoque_kg >= 10) return false;
        if (filterStock === 'zerado' && p.estoque_kg > 0) return false;
        if (filterStock === 'ok' && p.estoque_kg < 10) return false;
      } else {
        const un = p.estoque_unidade ?? 0;
        const minUn = p.estoque_minimo_unidade ?? 0;
        if (filterStock === 'baixo' && un >= minUn) return false;
        if (filterStock === 'zerado' && un > 0) return false;
        if (filterStock === 'ok' && un < (minUn || 1)) return false;
      }
    }
    return true;
  });

  function catLabel(v) { return CATEGORIAS.find(c => c.value === v)?.label || v; }

  if (loading) return <Loading />;

  return (
    <div className="page page-wide">
      <div className="page-header">
        <h1 className="page-title">Produtos / Estoque</h1>
        <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); }}><Plus size={18} /> Novo Produto</button>
      </div>

      <div className="products-filters">
        <input type="text" placeholder="Buscar nome ou marca..." value={search} onChange={e => setSearch(e.target.value)} className="filter-input" />
        <select value={filterCategoria} onChange={e => setFilterCategoria(e.target.value)} className="filter-select">
          <option value="">Todas as categorias</option>
          {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className="filter-select">
          <option value="">Todos os tipos</option>
          {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={filterStock} onChange={e => setFilterStock(e.target.value)} className="filter-select">
          <option value="">Todo estoque</option>
          <option value="ok">Estoque OK</option>
          <option value="baixo">Estoque Baixo</option>
          <option value="zerado">Zerado</option>
        </select>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>{editId ? 'Editar Produto' : 'Novo Produto'}</h2><button className="btn-icon" onClick={() => setShowForm(false)}><X size={20} /></button></div>
            <form onSubmit={handleSubmit} className="product-form">
              <div className="form-row">
                <div className="form-group"><label>Categoria do produto *</label>
                  <select name="categoria" value={form.categoria} onChange={handleChange}>
                    {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Nome *</label><input name="nome" value={form.nome} onChange={handleChange} required placeholder="Ex: Royal Canin ou Antipulgas" /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Marca</label><input name="marca" value={form.marca} onChange={handleChange} placeholder="Ex: Royal Canin" /></div>
                {(isRacao(form.categoria) || form.categoria === 'sache') && (
                  <div className="form-group"><label>Tipo (pet)</label><select name="tipo" value={form.tipo} onChange={handleChange}>{TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
                )}
              </div>

              {isRacao(form.categoria) ? (
                <>
                  <div className="form-row">
                    <div className="form-group"><label>Peso do Saco (kg) *</label><input name="peso_saco_kg" type="number" step="0.1" value={form.peso_saco_kg} onChange={handleChange} placeholder="15" /></div>
                    <div className="form-group"><label>Custo do Saco (R$) *</label><input name="custo_saco" type="number" step="0.01" value={form.custo_saco} onChange={handleChange} placeholder="150.00" /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label>Margem KG (%)</label><input name="margem_percentual" type="number" step="0.1" value={form.margem_percentual} onChange={handleChange} placeholder="50" /></div>
                    <div className="form-group"><label>Margem Saco (%)</label><input name="margem_saco" type="number" step="0.1" value={form.margem_saco} onChange={handleChange} placeholder="30" /></div>
                  </div>
                  <div className="form-row form-calculated">
                    <div className="form-group"><label>Custo por KG (auto)</label><input value={`R$ ${custo_por_kg.toFixed(2)}`} readOnly className="input-readonly" /></div>
                    <div className="form-group"><label>Preco por KG (auto)</label><input value={`R$ ${preco_por_kg.toFixed(2)}`} readOnly className="input-readonly" /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label>Preco Saco Fechado (R$)</label><input name="preco_saco_fechado" type="number" step="0.01" value={form.preco_saco_fechado} onChange={handleChange} placeholder="200.00" /></div>
                    {!editId && <div className="form-group"><label>Estoque Inicial (kg)</label><input name="estoque_kg" type="number" step="0.1" value={form.estoque_kg} onChange={handleChange} placeholder="0" /></div>}
                    <div className="form-group"><label>Alerta (dias)</label><input name="estoque_minimo_dias" type="number" value={form.estoque_minimo_dias} onChange={handleChange} placeholder="7" /></div>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-row">
                    <div className="form-group"><label>Custo do Pacote (R$)</label><input name="custo_pacote" type="number" step="0.01" value={form.custo_pacote} onChange={handleChange} placeholder="Ex: 25.00" /></div>
                    <div className="form-group"><label>Un. por Pacote</label><input name="unidades_pacote" type="number" min="1" value={form.unidades_pacote} onChange={handleChange} placeholder="Ex: 5" /></div>
                    <div className="form-group"><label>Margem (%)</label><input name="margem_unitaria" type="number" step="0.1" value={form.margem_unitaria} onChange={handleChange} placeholder="Ex: 50" /></div>
                  </div>
                  {custoUnitCalc > 0 && (
                    <div className="form-row form-calculated">
                      <div className="form-group"><label>Custo un. (auto)</label><input value={`R$ ${custoUnitCalc.toFixed(2)}`} readOnly className="input-readonly" /></div>
                      {precoUnitCalc > 0 && <div className="form-group"><label>Preço un. (auto)</label><input value={`R$ ${precoUnitCalc.toFixed(2)}`} readOnly className="input-readonly" /></div>}
                    </div>
                  )}
                  <div className="form-row">
                    <div className="form-group"><label>Custo unitário (R$)</label><input name="custo_unitario" type="number" step="0.01" value={custoUnitCalc > 0 ? custoUnitCalc.toFixed(2) : form.custo_unitario} onChange={handleChange} placeholder="5.00" readOnly={custoUnitCalc > 0} className={custoUnitCalc > 0 ? 'input-readonly' : ''} /></div>
                    <div className="form-group"><label>Preço unitário (R$) *</label><input name="preco_unitario" type="number" step="0.01" value={precoUnitCalc > 0 ? precoUnitCalc.toFixed(2) : form.preco_unitario} onChange={handleChange} placeholder="12.00" readOnly={precoUnitCalc > 0} className={precoUnitCalc > 0 ? 'input-readonly' : ''} /></div>
                  </div>
                  <div className="form-row">
                    {!editId && <div className="form-group"><label>Estoque inicial (un.)</label><input name="estoque_unidade" type="number" min="0" value={form.estoque_unidade} onChange={handleChange} placeholder="0" /></div>}
                    <div className="form-group"><label>Alerta mínimo (un.)</label><input name="estoque_minimo_unidade" type="number" min="0" value={form.estoque_minimo_unidade} onChange={handleChange} placeholder="0" /></div>
                  </div>
                </>
              )}

              <div className="form-actions"><button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button><button type="submit" className="btn btn-primary">{editId ? 'Salvar' : 'Cadastrar'}</button></div>
            </form>
          </div>
        </div>
      )}

      {showStockModal && (
        <div className="modal-overlay" onClick={() => setShowStockModal(null)}>
          <div className="modal modal-small" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>Entrada de Estoque</h2><button className="btn-icon" onClick={() => setShowStockModal(null)}><X size={20} /></button></div>
            <form onSubmit={handleStockEntry}>
              {isUnitProduct ? (
                <div className="form-group"><label>Quantidade (unidades)</label><input type="number" min="1" value={stockEntry.quantidade_unidade} onChange={e => setStockEntry({ ...stockEntry, quantidade_unidade: e.target.value })} required autoFocus /></div>
              ) : (
                <div className="form-group"><label>Quantidade (kg)</label><input type="number" step="0.1" value={stockEntry.quantidade_kg} onChange={e => setStockEntry({ ...stockEntry, quantidade_kg: e.target.value })} required autoFocus /></div>
              )}
              <div className="form-group"><label>Motivo</label><input value={stockEntry.motivo} onChange={e => setStockEntry({ ...stockEntry, motivo: e.target.value })} /></div>
              <div className="form-actions"><button type="button" className="btn btn-secondary" onClick={() => setShowStockModal(null)}>Cancelar</button><button type="submit" className="btn btn-primary">Confirmar</button></div>
            </form>
          </div>
        </div>
      )}

      {confirmDel && <ConfirmModal title="Desativar Produto" message={`Desativar "${confirmDel.nome}"? O produto não aparecerá mais nas buscas.`} onConfirm={handleDelete} onCancel={() => setConfirmDel(null)} confirmText="Desativar" danger />}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr><th>Produto</th><th>Marca</th><th>Categoria</th><th>Tipo</th><th>Saco (kg)</th><th>Custo/kg</th><th>Preco/kg</th><th>Preco Saco</th><th>Preço un.</th><th>Estoque</th><th>Ações</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (<tr><td colSpan="11" className="table-empty">Nenhum produto encontrado</td></tr>) : (
              filtered.map(p => {
                const isR = isRacao(p.categoria);
                return (
                  <tr key={p.id} className={isR ? (p.estoque_kg <= 0 ? 'row-danger' : '') : ((p.estoque_unidade ?? 0) <= 0 ? 'row-danger' : '')}>
                    <td><strong>{p.nome}</strong></td>
                    <td>{p.marca}</td>
                    <td>{catLabel(p.categoria)}</td>
                    <td className="capitalize">{(isR || p.categoria === 'sache') ? (p.tipo || '-') : '-'}</td>
                    <td>{isR ? `${p.peso_saco_kg}kg` : '-'}</td>
                    <td>{isR ? `R$ ${(p.custo_por_kg || 0).toFixed(2)}` : '-'}</td>
                    <td>{isR ? `R$ ${(p.preco_por_kg || 0).toFixed(2)}` : '-'}</td>
                    <td>{isR ? `R$ ${(p.preco_saco_fechado || 0).toFixed(2)}` : '-'}</td>
                    <td>{!isR ? `R$ ${(p.preco_unitario || 0).toFixed(2)}` : '-'}</td>
                    <td className={isR ? (p.estoque_kg < 10 ? 'text-danger' : '') : ((p.estoque_unidade ?? 0) < (p.estoque_minimo_unidade || 1) ? 'text-danger' : '')}>
                      {isR ? `${(p.estoque_kg || 0).toFixed(1)}kg` : `${p.estoque_unidade ?? 0} un.`}
                    </td>
                    <td className="table-actions">
                      <button className="btn-icon btn-stock" title="Entrada" onClick={() => { setShowStockModal(p.id); setStockEntry({ quantidade_kg: '', quantidade_unidade: '', motivo: 'Reposicao' }); }}><PackagePlus size={16} /></button>
                      <button className="btn-icon btn-edit" title="Editar" onClick={() => handleEdit(p)}><Edit2 size={16} /></button>
                      <button className="btn-icon btn-delete" title="Desativar" onClick={() => setConfirmDel(p)}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
