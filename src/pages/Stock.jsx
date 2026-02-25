import React, { useState, useEffect } from 'react';
import api from '../api';
import { useToast } from '../components/Toast';
import Loading from '../components/Loading';
import { Warehouse, PackagePlus, ArrowDown, ArrowUp, X, Clock, Printer } from 'lucide-react';

export default function Stock() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [search, setSearch] = useState('');
  const [showEntry, setShowEntry] = useState(null);
  const [entryProduct, setEntryProduct] = useState(null);
  const [entryForm, setEntryForm] = useState({ quantidade_kg: '', quantidade_unidade: '', motivo: 'Reposicao' });
  const [activeTab, setActiveTab] = useState('estoque');
  const [movFilter, setMovFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (activeTab === 'movimentacoes') loadMovements(); }, [activeTab, movFilter]);

  async function loadData() {
    try {
      const res = await api.get('/products');
      setProducts(res.data);
    } catch (err) { toast.error('Erro ao carregar produtos'); }
    finally { setLoading(false); }
  }

  async function loadMovements() {
    try {
      let url = '/products/movements?limit=200';
      if (movFilter) url += `&product_id=${movFilter}`;
      const res = await api.get(url);
      setMovements(res.data);
    } catch (err) { toast.error('Erro ao carregar movimentacoes'); }
  }

  const isRacao = (p) => !p?.categoria || p.categoria === 'racao';

  async function handleEntry(e) {
    e.preventDefault();
    const byUnit = entryProduct && !isRacao(entryProduct);
    const qty = byUnit ? parseInt(entryForm.quantidade_unidade, 10) : parseFloat(entryForm.quantidade_kg);
    if (qty == null || qty <= 0) { toast.error('Informe uma quantidade valida'); return; }
    try {
      await api.post(`/products/${showEntry}/stock-entry`, byUnit
        ? { quantidade_unidade: qty, motivo: entryForm.motivo }
        : { quantidade_kg: qty, motivo: entryForm.motivo });
      setShowEntry(null);
      setEntryProduct(null);
      setEntryForm({ quantidade_kg: '', quantidade_unidade: '', motivo: 'Reposicao' });
      toast.success('Estoque atualizado!');
      loadData();
    } catch (err) { toast.error(err.response?.data?.error || err.message); }
  }

  function openEntryModal(p) {
    setEntryProduct(p);
    setShowEntry(p.id);
    setEntryForm({ quantidade_kg: '', quantidade_unidade: '', motivo: 'Reposicao' });
  }

  function handlePrintStock() {
    const totalKg = products.filter(p => isRacao(p)).reduce((s, p) => s + (p.estoque_kg || 0), 0);
    const totalUn = products.filter(p => !isRacao(p)).reduce((s, p) => s + (p.estoque_unidade || 0), 0);
    const subText = [totalKg > 0 && `${totalKg.toFixed(0)} kg`, totalUn > 0 && `${totalUn} un.`].filter(Boolean).join(' | ') || '0';
    const win = window.open('', '_blank', 'width=800,height=600');
    win.document.write(`<html><head><title>Relatorio de Estoque</title>
      <style>body{font-family:Arial;font-size:12px;margin:20px}table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f0f0f0}
      h1{font-size:16px;margin-bottom:4px}.danger{color:red;font-weight:bold}
      .sub{font-size:11px;color:#888}</style></head><body>
      <h1>Relatorio de Estoque - ${new Date().toLocaleDateString('pt-BR')}</h1>
      <p class="sub">${products.length} produtos | Total: ${subText}</p>
      <table><thead><tr><th>Produto</th><th>Marca</th><th>Categoria</th><th>Estoque</th><th>Status</th></tr></thead><tbody>
      ${products.map(p => {
        const racao = isRacao(p);
        const val = racao ? (p.estoque_kg || 0) : (p.estoque_unidade ?? 0);
        const un = racao ? 'kg' : 'un.';
        const zerado = racao ? (p.estoque_kg <= 0) : ((p.estoque_unidade ?? 0) <= 0);
        const baixo = racao ? (p.estoque_kg > 0 && p.estoque_kg < 10) : ((p.estoque_unidade ?? 0) > 0 && (p.estoque_unidade ?? 0) < (p.estoque_minimo_unidade || 1));
        const status = zerado ? 'ZERADO' : baixo ? 'BAIXO' : 'OK';
        return `<tr><td>${p.nome}</td><td>${p.marca}</td><td>${(p.categoria || 'racao')}</td><td${zerado ? ' class="danger"' : ''}>${racao ? val.toFixed(1) : val} ${un}</td><td>${status}</td></tr>`;
      }).join('')}
      </tbody></table><script>window.print();</script></body></html>`);
    win.document.close();
  }

  const filtered = products.filter(p =>
    p.nome.toLowerCase().includes(search.toLowerCase()) ||
    p.marca.toLowerCase().includes(search.toLowerCase())
  );

  const estoqueTotal = products.filter(p => isRacao(p)).reduce((s, p) => s + (p.estoque_kg || 0), 0);
  const estoqueTotalUn = products.filter(p => !isRacao(p)).reduce((s, p) => s + (p.estoque_unidade || 0), 0);
  const produtosZerados = products.filter(p => isRacao(p) ? (p.estoque_kg || 0) <= 0 : (p.estoque_unidade ?? 0) <= 0).length;
  const produtosBaixo = products.filter(p => {
    if (isRacao(p)) return (p.estoque_kg || 0) > 0 && (p.estoque_kg || 0) < 10;
    const u = p.estoque_unidade ?? 0;
    return u > 0 && u < (p.estoque_minimo_unidade || 1);
  }).length;

  if (loading) return <Loading />;

  return (
    <div className="page page-wide">
      <div className="page-header">
        <h1 className="page-title"><Warehouse size={24} /> Estoque</h1>
        <button className="btn btn-secondary btn-sm" onClick={handlePrintStock}><Printer size={14} /> Imprimir Relatorio</button>
      </div>

      <div className="cards-grid cards-grid-4">
        <div className="card card-green"><div className="card-icon"><Warehouse size={24} /></div><div className="card-info"><span className="card-label">Estoque Total</span><span className="card-value">{estoqueTotal > 0 || estoqueTotalUn > 0 ? [estoqueTotal > 0 && `${estoqueTotal.toFixed(0)} kg`, estoqueTotalUn > 0 && `${estoqueTotalUn} un.`].filter(Boolean).join(' + ') : '0 kg'}</span></div></div>
        <div className="card card-blue"><div className="card-icon"><PackagePlus size={24} /></div><div className="card-info"><span className="card-label">Produtos Ativos</span><span className="card-value">{products.length}</span></div></div>
        <div className="card card-orange"><div className="card-icon"><ArrowDown size={24} /></div><div className="card-info"><span className="card-label">Estoque Baixo</span><span className="card-value">{produtosBaixo}</span></div></div>
        <div className="card card-purple"><div className="card-icon"><ArrowDown size={24} /></div><div className="card-info"><span className="card-label">Zerados</span><span className="card-value">{produtosZerados}</span></div></div>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'estoque' ? 'active' : ''}`} onClick={() => setActiveTab('estoque')}>Estoque Atual</button>
        <button className={`tab ${activeTab === 'movimentacoes' ? 'active' : ''}`} onClick={() => setActiveTab('movimentacoes')}>Movimentacoes</button>
      </div>

      {activeTab === 'estoque' && (
        <>
          <div className="filter-bar">
            <input type="text" placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} className="filter-input" />
          </div>
          {showEntry && entryProduct && (
            <div className="modal-overlay" onClick={() => { setShowEntry(null); setEntryProduct(null); }}>
              <div className="modal modal-small" onClick={e => e.stopPropagation()}>
                <div className="modal-header"><h2>Entrada de Estoque</h2><button className="btn-icon" onClick={() => { setShowEntry(null); setEntryProduct(null); }}><X size={20} /></button></div>
                <form onSubmit={handleEntry}>
                  {isRacao(entryProduct) ? (
                    <div className="form-group"><label>Quantidade (kg)</label><input type="number" step="0.1" value={entryForm.quantidade_kg} onChange={e => setEntryForm({ ...entryForm, quantidade_kg: e.target.value })} required autoFocus /></div>
                  ) : (
                    <div className="form-group"><label>Quantidade (un.)</label><input type="number" min="1" step="1" value={entryForm.quantidade_unidade} onChange={e => setEntryForm({ ...entryForm, quantidade_unidade: e.target.value })} required autoFocus /></div>
                  )}
                  <div className="form-group"><label>Motivo</label>
                    <select value={entryForm.motivo} onChange={e => setEntryForm({ ...entryForm, motivo: e.target.value })}>
                      <option value="Reposicao">Reposicao</option><option value="Compra fornecedor">Compra fornecedor</option><option value="Ajuste inventario">Ajuste inventario</option><option value="Devolucao">Devolucao</option>
                    </select>
                  </div>
                  <div className="form-actions"><button type="button" className="btn btn-secondary" onClick={() => { setShowEntry(null); setEntryProduct(null); }}>Cancelar</button><button type="submit" className="btn btn-primary">Confirmar</button></div>
                </form>
              </div>
            </div>
          )}
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Produto</th><th>Marca</th><th>Categoria</th><th>Estoque</th><th>Status</th><th>Acoes</th></tr></thead>
              <tbody>
                {filtered.length === 0 ? (<tr><td colSpan="6" className="table-empty">Nenhum produto</td></tr>) : (
                  filtered.map(p => {
                    const racao = isRacao(p);
                    const valor = racao ? (p.estoque_kg || 0) : (p.estoque_unidade ?? 0);
                    const un = racao ? 'kg' : 'un.';
                    let status = 'ok', label = 'OK';
                    if (racao) {
                      if ((p.estoque_kg || 0) <= 0) { status = 'zerado'; label = 'Zerado'; }
                      else if ((p.estoque_kg || 0) < 10) { status = 'baixo'; label = 'Baixo'; }
                    } else {
                      if ((p.estoque_unidade ?? 0) <= 0) { status = 'zerado'; label = 'Zerado'; }
                      else if ((p.estoque_unidade ?? 0) < (p.estoque_minimo_unidade || 1)) { status = 'baixo'; label = 'Baixo'; }
                    }
                    return (
                      <tr key={p.id} className={status === 'zerado' ? 'row-danger' : ''}>
                        <td><strong>{p.nome}</strong></td><td>{p.marca}</td><td className="capitalize">{p.categoria || 'racao'}</td>
                        <td><strong>{racao ? valor.toFixed(1) : valor} {un}</strong></td>
                        <td><span className={`stock-badge stock-${status}`}>{label}</span></td>
                        <td><button className="btn btn-sm btn-primary" onClick={() => openEntryModal(p)}><PackagePlus size={14} /> Entrada</button></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'movimentacoes' && (
        <>
          <div className="filter-bar" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <select value={movFilter} onChange={e => setMovFilter(e.target.value)} style={{ padding: '0.5rem 0.75rem', border: '1.5px solid #ddd', borderRadius: '10px', fontSize: '0.9rem' }}>
              <option value="">Todos os produtos</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.nome} ({p.marca})</option>)}
            </select>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Data/Hora</th><th>Produto</th><th>Tipo</th><th>Qtd</th><th>Motivo</th></tr></thead>
              <tbody>
                {movements.length === 0 ? (<tr><td colSpan="5" className="table-empty">Sem movimentacoes</td></tr>) : (
                  movements.map(m => {
                    const prod = products.find(pr => pr.id === m.product_id);
                    const isUn = prod && !isRacao(prod);
                    const qty = Math.abs(m.quantidade_kg);
                    const qtyStr = isUn ? `${qty} un.` : `${qty.toFixed(1)} kg`;
                    const nome = m.products?.nome ?? m.product_nome ?? prod?.nome ?? '-';
                    return (
                      <tr key={m.id}>
                        <td>{new Date(m.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                        <td><strong>{nome}</strong> {prod && <small className="text-muted">{prod.marca}</small>}</td>
                        <td><span className={`stock-badge ${m.tipo === 'entrada' ? 'stock-ok' : 'stock-zerado'}`}>{m.tipo === 'entrada' ? 'Entrada' : 'Saida'}</span></td>
                        <td>{m.tipo === 'entrada' ? '+' : '-'}{qtyStr}</td>
                        <td>{m.motivo}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
