import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Search, X, CreditCard, Banknote, Smartphone, Package,
  Clock, Printer, ChevronRight, List, Scale, PackageOpen, AlertCircle, CheckCircle,
  Calendar, BarChart3, DollarSign
} from 'lucide-react';

const API = '/api';

function getDateRange(filter, periodStart, periodEnd) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let start, end;
  if (filter === 'hoje') {
    start = end = today.toISOString().split('T')[0];
  } else if (filter === 'ontem') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    start = end = yesterday.toISOString().split('T')[0];
  } else if (filter === '7dias') {
    const d = new Date(today);
    d.setDate(d.getDate() - 6);
    start = d.toISOString().split('T')[0];
    end = today.toISOString().split('T')[0];
  } else {
    start = periodStart || today.toISOString().split('T')[0];
    end = periodEnd || start;
  }
  return { start, end };
}

export default function Sales() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('dinheiro');
  const [discount, setDiscount] = useState(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [cashReceived, setCashReceived] = useState('');
  const [showReceipt, setShowReceipt] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [todaySales, setTodaySales] = useState([]);
  const [historySales, setHistorySales] = useState([]);
  const [salesFilter, setSalesFilter] = useState('hoje');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [selectedSaleDetail, setSelectedSaleDetail] = useState(null);
  const [kgModal, setKgModal] = useState(null);
  const [kgInput, setKgInput] = useState('');
  const [toast, setToast] = useState(null);
  const searchRef = useRef(null);
  const receiptRef = useRef(null);
  const kgInputRef = useRef(null);

  useEffect(() => { loadClients(); loadTodaySales(); }, []);
  useEffect(() => {
    if (showHistory) loadHistorySales();
  }, [showHistory, salesFilter, periodStart, periodEnd]);

  // Foco no campo de busca - funcao centralizada
  function focusSearch() {
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  // Toast notification (substitui alert nativo)
  function showToast(message, type = 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function loadClients() {
    try { const res = await axios.get(`${API}/clients`); setClients(res.data); }
    catch (err) { console.error('Erro ao carregar clientes:', err); }
  }

  async function loadTodaySales() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await axios.get(`${API}/sales?data_inicio=${today}&data_fim=${today}`);
      setTodaySales(res.data || []);
    } catch (err) { console.error('Erro ao carregar vendas:', err); }
  }

  async function loadHistorySales() {
    try {
      const { start, end } = getDateRange(salesFilter, periodStart, periodEnd);
      const res = await axios.get(`${API}/sales?data_inicio=${start}&data_fim=${end}`);
      setHistorySales(res.data || []);
    } catch (err) { console.error('Erro ao carregar vendas:', err); setHistorySales([]); }
  }

  async function loadSaleDetail(saleId) {
    try { const res = await axios.get(`${API}/sales/${saleId}`); setSelectedSaleDetail(res.data); }
    catch (err) { console.error('Erro ao carregar detalhe:', err); }
  }

  // Busca de produtos
  async function handleSearch(e) {
    const term = e.target.value;
    setSearchTerm(term);
    if (term.length < 2) { setSearchResults([]); return; }
    try {
      const res = await axios.get(`${API}/products/search/${encodeURIComponent(term)}`);
      setSearchResults(res.data);
    } catch (err) { setSearchResults([]); }
  }

  // Fechar dropdown ao clicar fora
  function closeDropdown() {
    setSearchResults([]);
  }

  // Abrir modal de KG
  function openKgModal(product) {
    setKgModal(product);
    setKgInput('');
    setSearchTerm('');
    setSearchResults([]);
    setTimeout(() => kgInputRef.current?.focus(), 100);
  }

  // Fechar modal de KG
  function closeKgModal() {
    setKgModal(null);
    setKgInput('');
    focusSearch();
  }

  // Confirmar KG
  function confirmKg() {
    const kg = parseFloat(kgInput);
    if (!kg || kg <= 0 || !kgModal) return;
    addToCart(kgModal, 'kg', kg);
    setKgModal(null);
    setKgInput('');
    focusSearch();
  }

  // Adicionar por saco
  function addSaco(product) {
    addToCart(product, 'saco', product.peso_saco_kg);
    setSearchTerm('');
    setSearchResults([]);
    focusSearch();
  }

  function addToCart(product, tipoVenda, qty) {
    const existing = cart.find(c => c.product_id === product.id && c.tipo_venda === tipoVenda);
    if (existing) {
      setCart(cart.map(c =>
        c.product_id === product.id && c.tipo_venda === tipoVenda
          ? { ...c, quantidade_kg: c.quantidade_kg + qty }
          : c
      ));
    } else {
      const isUnit = product.categoria && product.categoria !== 'racao';
      setCart([...cart, {
        product_id: product.id,
        nome: product.nome,
        marca: product.marca,
        tipo_venda: tipoVenda,
        quantidade_kg: qty,
        peso_saco_kg: product.peso_saco_kg,
        preco_por_kg: product.preco_por_kg,
        preco_saco_fechado: product.preco_saco_fechado,
        preco_unitario: isUnit ? (product.preco_unitario || 0) : undefined,
        estoque_kg: product.estoque_kg,
        estoque_unidade: product.estoque_unidade,
      }]);
    }
  }

  // Remover do carrinho e devolver foco
  function removeFromCart(index) {
    setCart(prev => prev.filter((_, i) => i !== index));
    focusSearch();
  }

  function itemSubtotal(item) {
    if (item.tipo_venda === 'unidade') {
      return (item.quantidade_kg || 0) * (item.preco_unitario || 0);
    }
    if (item.tipo_venda === 'saco') {
      return Math.round(item.quantidade_kg / (item.peso_saco_kg || 1)) * item.preco_saco_fechado;
    }
    return item.quantidade_kg * item.preco_por_kg;
  }

  function itemQtyDisplay(item) {
    if (item.tipo_venda === 'unidade') {
      return `${item.quantidade_kg}x un.`;
    }
    if (item.tipo_venda === 'saco') {
      return `${Math.round(item.quantidade_kg / (item.peso_saco_kg || 1))}x saco`;
    }
    return `${item.quantidade_kg}kg`;
  }

  const totalQty = cart.reduce((sum, item) => {
    if (item.tipo_venda === 'unidade') return sum + (item.quantidade_kg || 0);
    if (item.tipo_venda === 'saco') return sum + Math.round(item.quantidade_kg / (item.peso_saco_kg || 1));
    return sum + item.quantidade_kg;
  }, 0);

  const cartSubtotal = cart.reduce((sum, item) => sum + itemSubtotal(item), 0);
  const discountValue = discount > 0 ? cartSubtotal * (discount / 100) : 0;
  const finalTotal = cartSubtotal - discountValue;

  const cashNum = parseFloat(cashReceived) || 0;
  const change = cashNum > 0 ? cashNum - finalTotal : 0;

  function toggleDiscount() { setDiscount(prev => prev === 10 ? 0 : 10); }

  function openPayment() {
    if (cart.length === 0) return;
    setCashReceived('');
    setShowPaymentModal(true);
  }

  // Fechar modal de pagamento e devolver foco
  function closePayment() {
    setShowPaymentModal(false);
    focusSearch();
  }

  async function handleFinalizeSale() {
    if (cart.length === 0) return;
    if (paymentMethod === 'dinheiro' && cashNum > 0 && cashNum < finalTotal) {
      showToast('Valor recebido menor que o total!');
      return;
    }
    try {
      const items = cart.map(item => ({
        product_id: item.product_id,
        tipo_venda: item.tipo_venda,
        quantidade_kg: item.quantidade_kg,
        peso_saco: item.peso_saco_kg,
        preco_unitario: item.preco_unitario,
        subtotal: itemSubtotal(item),
      }));

      const saleRes = await axios.post(`${API}/sales`, {
        items,
        client_id: selectedClient || null,
        forma_pagamento: paymentMethod,
        desconto: discountValue,
      });

      const receiptData = {
        id: saleRes.data.id,
        date: new Date(),
        items: cart.map(item => ({ nome: item.nome, qty: itemQtyDisplay(item), subtotal: itemSubtotal(item) })),
        subtotal: cartSubtotal,
        desconto: discountValue,
        total: finalTotal,
        forma_pagamento: paymentMethod,
        valor_recebido: paymentMethod === 'dinheiro' ? cashNum : null,
        troco: paymentMethod === 'dinheiro' ? change : null,
        cliente: selectedClient ? clients.find(c => String(c.id) === String(selectedClient))?.nome : 'Avulso',
      };

      setShowPaymentModal(false);
      setShowReceipt(receiptData);
      setCart([]);
      setDiscount(0);
      setSelectedClient('');
      setPaymentMethod('dinheiro');
      setCashReceived('');
      loadTodaySales();
      if (showHistory) loadHistorySales();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      // Fechar modal e mostrar toast de erro para o usuario poder corrigir
      setShowPaymentModal(false);
      showToast(errorMsg);
      focusSearch();
    }
  }

  function handlePrint() {
    const content = receiptRef.current;
    if (!content) return;
    const win = window.open('', '_blank', 'width=320,height=600');
    win.document.write(`
      <html><head><title>Cupom</title>
      <style>
        body { font-family: 'Courier New', monospace; font-size: 12px; width: 280px; margin: 0 auto; padding: 10px; }
        .center { text-align: center; }
        .line { border-top: 1px dashed #000; margin: 6px 0; }
        .bold { font-weight: bold; }
        .row { display: flex; justify-content: space-between; padding: 2px 0; }
        .big { font-size: 16px; font-weight: bold; }
        .receipt-logo { max-width: 120px; margin: 0 auto 8px; display: block; }
      </style></head><body>
      ${content.innerHTML}
      <script>window.print(); window.close();<\/script>
      </body></html>
    `);
    win.document.close();
  }

  function closeReceipt() {
    setShowReceipt(null);
    focusSearch();
  }

  // Atalhos de teclado
  useEffect(() => {
    function handleKeyDown(e) {
      if (showReceipt || showPaymentModal || kgModal) {
        // Escape fecha qualquer modal aberto
        if (e.key === 'Escape') {
          e.preventDefault();
          if (kgModal) closeKgModal();
          else if (showPaymentModal) closePayment();
          else if (showReceipt) closeReceipt();
        }
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); setSearchResults([]); focusSearch(); }
      else if (e.key === 'F2') { e.preventDefault(); openPayment(); }
      else if (e.key === 'F3') { e.preventDefault(); setDiscount(prev => prev === 10 ? 0 : 10); }
      else if (e.key === 'F5') {
        e.preventDefault();
        setCart([]); setDiscount(0); setSearchTerm(''); setSearchResults([]);
        focusSearch();
      }
      else if (e.key === 'F4') { e.preventDefault(); setShowHistory(prev => !prev); }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart.length, showReceipt, showPaymentModal, kgModal]);

  // Fechar dropdown ao clicar fora do search wrapper
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchResults.length > 0 && searchRef.current && !searchRef.current.closest('.pdv-search-wrap')?.contains(e.target)) {
        setSearchResults([]);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchResults.length]);

  function formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function formatPayment(p) {
    const map = { dinheiro: 'Dinheiro', pix: 'PIX', cartao: 'Cartão' };
    return map[p] || p;
  }

  const historySummary = {
    total: historySales.length,
    faturamento: historySales.reduce((s, v) => s + (Number(v.total) || 0), 0),
    porPagamento: historySales.reduce((acc, v) => {
      const fp = v.forma_pagamento || 'dinheiro';
      acc[fp] = (acc[fp] || 0) + (Number(v.total) || 0);
      return acc;
    }, {}),
  };

  return (
    <div className="pdv-fullscreen">
      {/* Toast de feedback */}
      {toast && (
        <div className={`pdv-toast pdv-toast-${toast.type}`} onClick={() => setToast(null)}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          <span>{toast.message}</span>
          <X size={16} className="pdv-toast-close" />
        </div>
      )}

      {/* Barra superior escura */}
      <div className="pdv-topbar">
        <div className="pdv-search-wrap">
          <Search size={18} className="pdv-search-icon" />
          <input
            ref={searchRef}
            type="text"
            className="pdv-search-input"
            placeholder="Buscar produto por nome ou marca..."
            value={searchTerm}
            onChange={handleSearch}
            onFocus={() => { if (searchTerm.length >= 2 && searchResults.length === 0) handleSearch({ target: { value: searchTerm } }); }}
            autoFocus
          />
          {searchResults.length > 0 && (
            <div className="pdv-dropdown">
              {searchResults.map(p => {
                const isUnit = p.categoria && p.categoria !== 'racao';
                return (
                  <div key={p.id} className="pdv-dropdown-item">
                    <div className="pdv-dropdown-info">
                      <strong>{p.nome}</strong>
                      <span className="pdv-dropdown-marca">
                        {p.marca} | Estoque: {isUnit ? `${p.estoque_unidade ?? 0} un.` : `${(p.estoque_kg || 0).toFixed(1)}kg`}
                      </span>
                    </div>
                    <div className="pdv-dropdown-actions">
                      {isUnit ? (
                        <button className="pdv-dropdown-btn pdv-dropdown-btn-saco" onClick={() => addToCart(p, 'unidade', 1)}>
                          <Package size={14} /> Unidade R$ {(p.preco_unitario || 0).toFixed(2)}
                        </button>
                      ) : (
                        <>
                          <button className="pdv-dropdown-btn pdv-dropdown-btn-kg" onClick={() => openKgModal(p)}>
                            <Scale size={14} /> R$ {(p.preco_por_kg || 0).toFixed(2)}/kg
                          </button>
                          <button className="pdv-dropdown-btn pdv-dropdown-btn-saco" onClick={() => addSaco(p)}>
                            <PackageOpen size={14} /> Saco R$ {(p.preco_saco_fechado || 0).toFixed(2)}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <button className={`pdv-topbar-btn ${showHistory ? 'active' : ''}`} onClick={() => setShowHistory(!showHistory)} title="Vendas do dia (F4)">
          <List size={18} />
          <span>Vendas</span>
          {todaySales.length > 0 && <span className="pdv-topbar-badge">{todaySales.length}</span>}
        </button>
      </div>

      {/* Corpo principal */}
      <div className="pdv-body">
        <div className="pdv-left-area">
          {showHistory ? (
            <div className="pdv-history">
              <div className="pdv-history-header">
                <h2><BarChart3 size={20} /> Vendas e Relatórios</h2>
                <span className="pdv-history-count">{historySales.length} vendas</span>
              </div>
              <div className="pdv-history-filters">
                <button className={`pdv-filter-btn ${salesFilter === 'hoje' ? 'active' : ''}`} onClick={() => setSalesFilter('hoje')}>Hoje</button>
                <button className={`pdv-filter-btn ${salesFilter === 'ontem' ? 'active' : ''}`} onClick={() => setSalesFilter('ontem')}>Ontem</button>
                <button className={`pdv-filter-btn ${salesFilter === '7dias' ? 'active' : ''}`} onClick={() => setSalesFilter('7dias')}>7 dias</button>
                <button className={`pdv-filter-btn ${salesFilter === 'periodo' ? 'active' : ''}`} onClick={() => setSalesFilter('periodo')}>Período</button>
              </div>
              {salesFilter === 'periodo' && (
                <div className="pdv-history-period">
                  <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} placeholder="Início" />
                  <span>até</span>
                  <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} placeholder="Fim" />
                  <button type="button" className="btn btn-sm btn-primary" onClick={loadHistorySales}>Buscar</button>
                </div>
              )}
              <div className="pdv-history-summary">
                <div className="pdv-summary-card">
                  <DollarSign size={18} />
                  <div>
                    <span className="pdv-summary-label">Faturamento</span>
                    <strong className="pdv-summary-value">R$ {historySummary.faturamento.toFixed(2)}</strong>
                  </div>
                </div>
                <div className="pdv-summary-card">
                  <BarChart3 size={18} />
                  <div>
                    <span className="pdv-summary-label">Quantidade</span>
                    <strong className="pdv-summary-value">{historySummary.total} vendas</strong>
                  </div>
                </div>
                {Object.entries(historySummary.porPagamento).length > 0 && (
                  <div className="pdv-summary-payment">
                    <span className="pdv-summary-label">Por pagamento</span>
                    {Object.entries(historySummary.porPagamento).map(([fp, val]) => (
                      <div key={fp} className="pdv-summary-pay-row">
                        <span className={`pdv-pay-badge ${fp}`}>{formatPayment(fp)}</span>
                        <span>R$ {Number(val).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="pdv-history-list">
                {historySales.length === 0 ? (
                  <div className="pdv-history-empty">Nenhuma venda no período</div>
                ) : (
                  historySales.map(sale => (
                    <div key={sale.id} className={`pdv-history-item ${selectedSaleDetail?.id === sale.id ? 'active' : ''}`}
                      onClick={() => loadSaleDetail(sale.id)}>
                      <div className="pdv-history-item-left">
                        <span className="pdv-history-item-id">#{sale.id}</span>
                        <span className="pdv-history-item-time">{formatDate(sale.created_at)} {formatTime(sale.created_at)}</span>
                      </div>
                      <div className="pdv-history-item-center">
                        <span className="pdv-history-item-client">{sale.client_nome || 'Avulso'}</span>
                        <span className={`pdv-history-item-pay ${sale.forma_pagamento}`}>{formatPayment(sale.forma_pagamento)}</span>
                      </div>
                      <div className="pdv-history-item-right">
                        <span className="pdv-history-item-total">R$ {(Number(sale.total) || 0).toFixed(2)}</span>
                        <ChevronRight size={16} />
                      </div>
                    </div>
                  ))
                )}
              </div>
              {selectedSaleDetail && (
                <div className="pdv-history-detail">
                  <div className="pdv-history-detail-header">
                    <h3>Venda #{selectedSaleDetail.id}</h3>
                    <span>{formatTime(selectedSaleDetail.created_at)}</span>
                  </div>
                  <div className="pdv-history-detail-items">
                    {selectedSaleDetail.items?.map((item, i) => (
                      <div key={i} className="pdv-history-detail-row">
                        <span>
                          {item.tipo_venda === 'unidade' ? `${item.quantidade_kg}x un.` : item.tipo_venda === 'saco' ? `${item.quantidade_kg} saco` : `${item.quantidade_kg}kg`} {item.product_nome}
                        </span>
                        <span>R$ {(item.subtotal || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pdv-history-detail-footer">
                    <div className="pdv-history-detail-row bold"><span>Total</span><span>R$ {selectedSaleDetail.total.toFixed(2)}</span></div>
                    {selectedSaleDetail.desconto > 0 && (
                      <div className="pdv-history-detail-row discount"><span>Desconto</span><span>- R$ {selectedSaleDetail.desconto.toFixed(2)}</span></div>
                    )}
                    <div className="pdv-history-detail-row"><span>Pagamento</span><span>{formatPayment(selectedSaleDetail.forma_pagamento)}</span></div>
                  </div>
                  <button className="pdv-history-reprint" onClick={() => {
                    setShowReceipt({
                      id: selectedSaleDetail.id, date: new Date(selectedSaleDetail.created_at),
                      items: selectedSaleDetail.items.map(it => ({
                        nome: it.product_nome,
                        qty: it.tipo_venda === 'unidade' ? `${it.quantidade_kg}x un.` : it.tipo_venda === 'saco' ? `${it.quantidade_kg} saco` : `${it.quantidade_kg}kg`,
                        subtotal: it.subtotal
                      })),
                      subtotal: selectedSaleDetail.total + selectedSaleDetail.desconto, desconto: selectedSaleDetail.desconto,
                      total: selectedSaleDetail.total, forma_pagamento: selectedSaleDetail.forma_pagamento,
                      valor_recebido: null, troco: null, cliente: selectedSaleDetail.client_nome || 'Avulso',
                    });
                  }}>
                    <Printer size={16} /> Reimprimir Cupom
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="pdv-brand-area">
              <img src="/logo.png" alt="Logo" className="pdv-brand-logo" />
            </div>
          )}
        </div>

        {/* Carrinho */}
        <div className="pdv-cart-panel">
          <div className="pdv-cart-header">
            <span className="pdv-cart-count-num">{cart.length} {cart.length === 1 ? 'item' : 'itens'}</span>
            <span className="pdv-cart-count-qty">Quantidade: {totalQty}</span>
          </div>
          <div className="pdv-cart-items">
            {cart.length === 0 ? (
              <div className="pdv-cart-empty"><Package size={48} strokeWidth={1} /><p>Busque um produto para adicionar</p></div>
            ) : (
              cart.map((item, index) => (
                <div key={index} className="pdv-cart-row">
                  <span className="pdv-cart-row-qty">{itemQtyDisplay(item)}</span>
                  <span className="pdv-cart-row-name">{item.nome}</span>
                  <span className="pdv-cart-row-price">R$ {itemSubtotal(item).toFixed(2)}</span>
                  <button className="pdv-cart-row-remove" onClick={() => removeFromCart(index)}><X size={16} /></button>
                </div>
              ))
            )}
          </div>
          <div className="pdv-cart-summary">
            <div className="pdv-summary-line"><span>{cart.length} itens :</span><span>R$ {cartSubtotal.toFixed(2)}</span></div>
            <div className="pdv-summary-line pdv-summary-discount" onClick={toggleDiscount}>
              <span>Desconto {discount}% (F3) :</span><span>R$ {discountValue.toFixed(2)}</span>
            </div>
            <div className="pdv-summary-line"><span>Subtotal :</span><span>R$ {(cartSubtotal - discountValue).toFixed(2)}</span></div>
          </div>
          <div className="pdv-cart-footer">
            <button className="pdv-pay-btn" onClick={openPayment} disabled={cart.length === 0}>PAGAR - F2</button>
            <div className="pdv-total">
              <span className="pdv-total-label">Total:</span>
              <span className="pdv-total-value">R$ {finalTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal KG */}
      {kgModal && (
        <div className="modal-overlay" onClick={closeKgModal}>
          <div className="pdv-kg-modal" onClick={e => e.stopPropagation()}>
            <div className="pdv-kg-modal-header">
              <Scale size={22} /><h2>Venda por KG</h2>
              <button className="btn-icon" onClick={closeKgModal}><X size={20} /></button>
            </div>
            <div className="pdv-kg-modal-product"><strong>{kgModal.nome}</strong><span>{kgModal.marca}</span></div>
            <div className="pdv-kg-modal-price">R$ {kgModal.preco_por_kg.toFixed(2)} / kg</div>
            <div className="pdv-kg-modal-stock">Estoque disponivel: {kgModal.estoque_kg.toFixed(1)} kg</div>
            <div className="pdv-kg-modal-input-wrap">
              <label>Quantos KG?</label>
              <input ref={kgInputRef} type="number" className="pdv-kg-modal-input" placeholder="Ex: 2.5"
                step="0.1" min="0.1" value={kgInput} onChange={e => setKgInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmKg(); if (e.key === 'Escape') closeKgModal(); }} />
            </div>
            {parseFloat(kgInput) > 0 && (
              <div className="pdv-kg-modal-preview">
                <span>{kgInput}kg x R$ {kgModal.preco_por_kg.toFixed(2)}</span>
                <strong>= R$ {(parseFloat(kgInput) * kgModal.preco_por_kg).toFixed(2)}</strong>
              </div>
            )}
            <div className="pdv-kg-modal-quick">
              {[0.5, 1, 2, 3, 5, 10].map(v => (
                <button key={v} className="pdv-kg-modal-quick-btn" onClick={() => setKgInput(String(v))}>{v}kg</button>
              ))}
            </div>
            <button className="pdv-confirm-btn" onClick={confirmKg} disabled={!parseFloat(kgInput) || parseFloat(kgInput) <= 0}>
              ADICIONAR AO CARRINHO
            </button>
          </div>
        </div>
      )}

      {/* Modal Pagamento */}
      {showPaymentModal && (
        <div className="modal-overlay" onClick={closePayment}>
          <div className="pdv-payment-modal" onClick={e => e.stopPropagation()}>
            <div className="pdv-payment-header">
              <h2>Finalizar Venda</h2>
              <button className="btn-icon" onClick={closePayment}><X size={22} /></button>
            </div>
            <div className="pdv-payment-total">R$ {finalTotal.toFixed(2)}</div>
            <div className="pdv-payment-client">
              <label>Cliente (opcional)</label>
              <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}>
                <option value="">Avulso</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="pdv-payment-methods">
              <label>Forma de Pagamento</label>
              <div className="pdv-payment-options">
                <button className={`pdv-payment-option ${paymentMethod === 'dinheiro' ? 'active' : ''}`} onClick={() => setPaymentMethod('dinheiro')}>
                  <Banknote size={28} /><span>Dinheiro</span>
                </button>
                <button className={`pdv-payment-option ${paymentMethod === 'pix' ? 'active' : ''}`} onClick={() => setPaymentMethod('pix')}>
                  <Smartphone size={28} /><span>PIX</span>
                </button>
                <button className={`pdv-payment-option ${paymentMethod === 'cartao' ? 'active' : ''}`} onClick={() => setPaymentMethod('cartao')}>
                  <CreditCard size={28} /><span>Cartao</span>
                </button>
              </div>
            </div>
            {paymentMethod === 'dinheiro' && (
              <div className="pdv-cash-section">
                <div className="pdv-cash-input-wrap">
                  <label>Valor Recebido (R$)</label>
                  <input type="number" className="pdv-cash-input" placeholder="0,00" step="0.01"
                    value={cashReceived} onChange={e => setCashReceived(e.target.value)} autoFocus />
                </div>
                {cashNum > 0 && (
                  <div className={`pdv-cash-change ${change >= 0 ? 'positive' : 'negative'}`}>
                    <span className="pdv-cash-change-label">Troco:</span>
                    <span className="pdv-cash-change-value">R$ {change.toFixed(2)}</span>
                  </div>
                )}
                <div className="pdv-cash-quick">
                  {[5, 10, 20, 50, 100, 200].map(v => (
                    <button key={v} className="pdv-cash-quick-btn" onClick={() => setCashReceived(String(v))}>R$ {v}</button>
                  ))}
                </div>
              </div>
            )}
            <button className="pdv-confirm-btn" onClick={handleFinalizeSale}>CONFIRMAR PAGAMENTO</button>
          </div>
        </div>
      )}

      {/* Cupom */}
      {showReceipt && (
        <div className="modal-overlay" onClick={closeReceipt}>
          <div className="pdv-receipt-modal" onClick={e => e.stopPropagation()}>
            <div className="pdv-receipt-actions">
              <button className="pdv-receipt-print-btn" onClick={handlePrint}><Printer size={18} /> Imprimir</button>
              <button className="pdv-receipt-close-btn" onClick={closeReceipt}>Nova Venda</button>
            </div>
            <div className="pdv-receipt" ref={receiptRef}>
              <div className="center">
                <img src="/logo.png" alt="Logo" className="receipt-logo" style={{ maxWidth: '120px', margin: '0 auto 8px', display: 'block' }} />
                <div className="line"></div>
              </div>
              <div className="center" style={{ fontSize: '11px', color: '#888' }}>CUPOM NAO FISCAL</div>
              <div className="line"></div>
              <div className="row"><span>Venda #{showReceipt.id}</span><span>{showReceipt.date.toLocaleDateString('pt-BR')}</span></div>
              <div className="row"><span>Hora: {showReceipt.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span><span>Cliente: {showReceipt.cliente}</span></div>
              <div className="line"></div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>ITENS</div>
              {showReceipt.items.map((item, i) => (
                <div key={i} className="row"><span>{item.qty} {item.nome}</span><span>R$ {item.subtotal.toFixed(2)}</span></div>
              ))}
              <div className="line"></div>
              <div className="row"><span>Subtotal</span><span>R$ {showReceipt.subtotal.toFixed(2)}</span></div>
              {showReceipt.desconto > 0 && (
                <div className="row" style={{ color: '#B60100' }}><span>Desconto</span><span>- R$ {showReceipt.desconto.toFixed(2)}</span></div>
              )}
              <div className="line"></div>
              <div className="row big"><span>TOTAL</span><span>R$ {showReceipt.total.toFixed(2)}</span></div>
              <div className="line"></div>
              <div className="row"><span>Pagamento</span><span>{formatPayment(showReceipt.forma_pagamento)}</span></div>
              {showReceipt.valor_recebido > 0 && (
                <>
                  <div className="row"><span>Valor Recebido</span><span>R$ {showReceipt.valor_recebido.toFixed(2)}</span></div>
                  <div className="row bold"><span>Troco</span><span>R$ {showReceipt.troco.toFixed(2)}</span></div>
                </>
              )}
              <div className="line"></div>
              <div className="center" style={{ fontSize: '11px', color: '#888', marginTop: '8px' }}>Obrigado pela preferencia!<br />Volte sempre!</div>
            </div>
          </div>
        </div>
      )}

      {/* Atalhos */}
      <div className="pdv-shortcuts-bar">
        <span>F2 Pagar</span>
        <span>F3 Desconto 10%</span>
        <span>F4 Vendas do Dia</span>
        <span>F5 Limpar</span>
        <span>ESC Fechar</span>
      </div>
    </div>
  );
}
