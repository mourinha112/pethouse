import React, { useState, useEffect } from 'react';
import api from '../api';
import { useToast } from '../components/Toast';
import Loading from '../components/Loading';
import {
  Landmark, Plus, Minus, X, Clock, Banknote, Smartphone, CreditCard,
  ArrowUpCircle, ArrowDownCircle, ShoppingCart, Lock, Unlock, History,
  ChevronRight, RefreshCw
} from 'lucide-react';

export default function Cashier() {
  const toast = useToast();
  const [cashier, setCashier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('atual');
  const [history, setHistory] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState(null);

  // Modais
  const [showOpen, setShowOpen] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showSupply, setShowSupply] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  // Forms
  const [openAmount, setOpenAmount] = useState('0');
  const [closeObs, setCloseObs] = useState('');
  const [supplyAmount, setSupplyAmount] = useState('');
  const [supplyDesc, setSupplyDesc] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawDesc, setWithdrawDesc] = useState('');

  useEffect(() => { loadCashier(); }, []);
  useEffect(() => { if (activeTab === 'historico') loadHistory(); }, [activeTab]);

  async function loadCashier() {
    setLoading(true);
    try {
      const res = await api.get(`/cashier/current`);
      setCashier(res.data);
    } catch (err) {
      console.error(err);
      setCashier(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    try {
      const res = await api.get(`/cashier/history`);
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadHistoryDetail(id) {
    try {
      const res = await api.get(`/cashier/${id}`);
      setSelectedHistory(res.data);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleOpen(e) {
    e.preventDefault();
    try {
      await api.post(`/cashier/open`, { saldo_inicial: parseFloat(openAmount) || 0 });
      setShowOpen(false);
      setOpenAmount('0');
      toast.success('Caixa aberto!');
      await loadCashier();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  }

  async function handleClose(e) {
    e.preventDefault();
    try {
      await api.post(`/cashier/close`, { observacao: closeObs });
      setShowClose(false);
      setCloseObs('');
      loadCashier();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  }

  async function handleSupply(e) {
    e.preventDefault();
    try {
      await api.post(`/cashier/supply`, {
        valor: parseFloat(supplyAmount) || 0,
        descricao: supplyDesc || 'Suprimento de Caixa',
      });
      setShowSupply(false);
      setSupplyAmount('');
      setSupplyDesc('');
      loadCashier();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  }

  async function handleWithdraw(e) {
    e.preventDefault();
    try {
      await api.post(`/cashier/withdraw`, {
        valor: parseFloat(withdrawAmount) || 0,
        descricao: withdrawDesc || 'Sangria de Caixa',
      });
      setShowWithdraw(false);
      setWithdrawAmount('');
      setWithdrawDesc('');
      loadCashier();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  }

  function formatTime(d) {
    if (!d) return '';
    return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function formatDateTime(d) {
    if (!d) return '';
    return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('pt-BR');
  }

  function payIcon(p) {
    if (p === 'pix') return <Smartphone size={16} />;
    if (p === 'cartao') return <CreditCard size={16} />;
    return <Banknote size={16} />;
  }

  function movIcon(tipo) {
    switch (tipo) {
      case 'abertura': return <Unlock size={16} />;
      case 'fechamento': return <Lock size={16} />;
      case 'suprimento': return <ArrowDownCircle size={16} />;
      case 'sangria': return <ArrowUpCircle size={16} />;
      case 'venda': return <ShoppingCart size={16} />;
      default: return <Clock size={16} />;
    }
  }

  function movColor(tipo) {
    switch (tipo) {
      case 'abertura': return '#1565C0';
      case 'fechamento': return '#555';
      case 'suprimento': return '#2E7D32';
      case 'sangria': return '#c62828';
      case 'venda': return '#B60100';
      default: return '#888';
    }
  }

  if (loading) return <Loading />;

  const isOpen = !!cashier?.open;
  const r = cashier?.resumo || {};
  const safe = (n) => Number(n ?? 0).toFixed(2);

  return (
    <div className="page page-wide">
      <div className="page-header">
        <h1 className="page-title"><Landmark size={24} /> Caixa</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={loadCashier}><RefreshCw size={14} /> Atualizar</button>
          {isOpen && (
            <button className="btn btn-sm" style={{ background: '#c62828', color: '#fff' }} onClick={() => setShowClose(true)}>
              <Lock size={14} /> Fechar Caixa
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: '1.25rem' }}>
        <button className={`tab ${activeTab === 'atual' ? 'active' : ''}`} onClick={() => setActiveTab('atual')}>Caixa Atual</button>
        <button className={`tab ${activeTab === 'historico' ? 'active' : ''}`} onClick={() => setActiveTab('historico')}>Caixas Anteriores</button>
      </div>

      {/* ========== CAIXA ATUAL ========== */}
      {activeTab === 'atual' && (
        <>
          {!isOpen ? (
            /* Caixa fechado - botao de abrir */
            <div className="cx-closed">
              <div className="cx-closed-icon"><Lock size={48} /></div>
              <h2>Caixa Fechado</h2>
              <p>Abra o caixa para comecar a registrar vendas</p>
              <button className="btn btn-primary btn-lg" style={{ maxWidth: '300px' }} onClick={() => setShowOpen(true)}>
                <Unlock size={20} /> Abrir Caixa
              </button>
            </div>
          ) : (
            /* Caixa aberto - layout inspirado na referencia */
            <div className="cx-layout">
              {/* Lado esquerdo */}
              <div className="cx-left">
                {/* Resumo do caixa */}
                <div className="cx-card">
                  <div className="cx-card-header">
                    <h3>Resumo do Caixa #{cashier?.session?.id ?? '-'}</h3>
                    <span className="cx-opened-at">Aberto {formatDateTime(cashier?.session?.opened_at)}</span>
                  </div>
                  <div className="cx-card-body">
                    <div className="cx-stat-row">
                      <span>Total de vendas:</span>
                      <strong>R$ {safe(r.total_vendas)}</strong>
                    </div>
                    <div className="cx-stat-row">
                      <span>Total recebido:</span>
                      <strong>R$ {safe(r.total_recebido)}</strong>
                    </div>
                    <div className="cx-divider"></div>
                    <div className="cx-stat-row">
                      <span>Saldo Inicial:</span>
                      <span>R$ {safe(r.saldo_inicial)}</span>
                    </div>
                    <div className="cx-stat-row">
                      <span>Total recebido:</span>
                      <span>R$ {safe(r.total_recebido)}</span>
                    </div>
                    <div className="cx-stat-row" style={{ color: '#2E7D32' }}>
                      <span>+ Dinheiro adicionado:</span>
                      <span>R$ {safe(r.suprimentos)}</span>
                    </div>
                    {(Number(r.sangrias) || 0) > 0 && (
                      <div className="cx-stat-row" style={{ color: '#c62828' }}>
                        <span>- Sangrias:</span>
                        <span>R$ {safe(r.sangrias)}</span>
                      </div>
                    )}
                    <div className="cx-divider"></div>
                    <div className="cx-stat-row cx-stat-bold">
                      <span>Saldo Final:</span>
                      <strong>R$ {safe(r.saldo_estimado)}</strong>
                    </div>
                    <div className="cx-stat-row" style={{ color: '#2E7D32' }}>
                      <span>Lucro:</span>
                      <span>R$ {safe(r.lucro_bruto)}</span>
                    </div>
                  </div>
                  <div className="cx-card-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowSupply(true)}>
                      <Plus size={14} /> Adicionar Dinheiro
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowWithdraw(true)}>
                      <Minus size={14} /> Retirar Valores
                    </button>
                  </div>
                </div>

                {/* Total por meio de pagamento */}
                <div className="cx-card">
                  <div className="cx-card-header">
                    <h3>Total por meio de pagamento</h3>
                  </div>
                  <div className="cx-card-body">
                    {cashier.por_pagamento.length === 0 ? (
                      <p className="text-muted">Nenhuma venda ainda</p>
                    ) : (
                      (cashier.por_pagamento || []).map(p => (
                        <div key={p.forma_pagamento} className="cx-pay-row">
                          <div className="cx-pay-icon">{payIcon(p.forma_pagamento)}</div>
                          <span className="cx-pay-name capitalize">{p.forma_pagamento}</span>
                          <span className="cx-pay-value">R$ {safe(p.total)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Lado direito - Movimentacoes */}
              <div className="cx-right">
                <div className="cx-card cx-card-full">
                  <div className="cx-card-header">
                    <h3>Movimentacao</h3>
                    <span className="text-muted">{(cashier.movements || []).length} registros</span>
                  </div>
                  <div className="cx-movements">
                    {(cashier.movements || []).length === 0 ? (
                      <p className="text-muted" style={{ padding: '2rem', textAlign: 'center' }}>Sem movimentacoes</p>
                    ) : (
                      (cashier.movements || []).map((m, i) => (
                        <div key={m.id || i} className="cx-mov-item">
                          <div className="cx-mov-icon" style={{ color: movColor(m.tipo) }}>{movIcon(m.tipo)}</div>
                          <div className="cx-mov-info">
                            <span className="cx-mov-desc">
                              {m.descricao}
                              {m.sale_payment && <span className="cx-mov-pay capitalize"> ({m.sale_payment})</span>}
                            </span>
                            <span className="cx-mov-time">{formatDateTime(m.created_at)}</span>
                          </div>
                          <span className={`cx-mov-value ${m.tipo === 'sangria' ? 'negative' : ''}`}>
                            {m.tipo === 'sangria' ? '-' : ''} R$ {safe(m.valor)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="cx-card-footer">
                    <span className="cx-footer-label">Saldo Final:</span>
                    <span className="cx-footer-value">R$ {safe(r.saldo_estimado)}</span>
                  </div>
                  <div style={{ padding: '0 1.25rem 1.25rem' }}>
                    <button className="btn btn-lg" style={{ background: '#c62828', color: '#fff' }} onClick={() => setShowClose(true)}>
                      <Lock size={18} /> Fechar Caixa
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ========== HISTORICO ========== */}
      {activeTab === 'historico' && (
        <div className="cx-layout">
          <div className="cx-left">
            <div className="cx-card cx-card-full">
              <div className="cx-card-header"><h3><History size={18} /> Caixas Anteriores</h3></div>
              <div className="cx-history-list">
                {history.length === 0 ? (
                  <p className="text-muted" style={{ padding: '2rem', textAlign: 'center' }}>Nenhum caixa fechado</p>
                ) : (
                  history.map(h => (
                    <div key={h.id}
                      className={`cx-history-item ${selectedHistory?.session?.id === h.id ? 'active' : ''}`}
                      onClick={() => loadHistoryDetail(h.id)}>
                      <div className="cx-history-item-left">
                        <strong>Caixa #{h.id}</strong>
                        <span className="cx-history-item-date">{formatDate(h.opened_at)}</span>
                      </div>
                      <div className="cx-history-item-center">
                        <span>{h.qtd_vendas ?? 0} vendas</span>
                        <span className="text-muted">{formatTime(h.opened_at)} - {formatTime(h.closed_at)}</span>
                      </div>
                      <div className="cx-history-item-right">
                        <strong>R$ {safe(h.total_vendas)}</strong>
                        <ChevronRight size={16} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Detalhe do caixa selecionado */}
          <div className="cx-right">
            {selectedHistory ? (
              <div className="cx-card cx-card-full">
                <div className="cx-card-header">
                  <h3>Caixa #{selectedHistory.session.id}</h3>
                  <span className="text-muted">{formatDate(selectedHistory.session.opened_at)}</span>
                </div>
                <div className="cx-card-body">
                  <div className="cx-stat-row">
                    <span>Saldo Inicial:</span>
                    <span>R$ {safe(selectedHistory.session.saldo_inicial)}</span>
                  </div>
                  <div className="cx-stat-row cx-stat-bold">
                    <span>Saldo Final:</span>
                    <strong>R$ {safe(selectedHistory.session.saldo_final)}</strong>
                  </div>
                  {selectedHistory.session.observacao_fechamento && (
                    <div className="cx-stat-row">
                      <span>Obs:</span>
                      <span>{selectedHistory.session.observacao_fechamento}</span>
                    </div>
                  )}
                </div>
                {(selectedHistory.por_pagamento || []).length > 0 && (
                  <div className="cx-card-body" style={{ borderTop: '1px solid #eee' }}>
                    <strong style={{ fontSize: '0.85rem', color: '#555', marginBottom: '0.5rem', display: 'block' }}>Por Pagamento</strong>
                    {(selectedHistory.por_pagamento || []).map(p => (
                      <div key={p.forma_pagamento} className="cx-pay-row">
                        <div className="cx-pay-icon">{payIcon(p.forma_pagamento)}</div>
                        <span className="cx-pay-name capitalize">{p.forma_pagamento}</span>
                        <span className="cx-pay-value">R$ {safe(p.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="cx-movements" style={{ maxHeight: '300px' }}>
                  {(selectedHistory.movements || []).map(m => (
                    <div key={m.id} className="cx-mov-item">
                      <div className="cx-mov-icon" style={{ color: movColor(m.tipo) }}>{movIcon(m.tipo)}</div>
                      <div className="cx-mov-info">
                        <span className="cx-mov-desc">{m.descricao}</span>
                        <span className="cx-mov-time">{formatTime(m.created_at)}</span>
                      </div>
                      <span className="cx-mov-value">R$ {safe(m.valor)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="cx-closed" style={{ background: '#fff', borderRadius: '16px', minHeight: '300px' }}>
                <History size={40} style={{ color: '#ccc' }} />
                <p className="text-muted">Selecione um caixa para ver detalhes</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === MODAIS === */}

      {/* Abrir Caixa */}
      {showOpen && (
        <div className="modal-overlay" onClick={() => setShowOpen(false)}>
          <div className="modal modal-small" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2><Unlock size={20} /> Abrir Caixa</h2><button className="btn-icon" onClick={() => setShowOpen(false)}><X size={20} /></button></div>
            <form onSubmit={handleOpen}>
              <div className="form-group">
                <label>Saldo Inicial (R$)</label>
                <input type="number" step="0.01" value={openAmount} onChange={e => setOpenAmount(e.target.value)} autoFocus
                  style={{ fontSize: '1.25rem', fontWeight: 700, textAlign: 'center' }} />
                <small className="text-muted">Quanto de dinheiro tem no caixa agora?</small>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Abrir Caixa</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fechar Caixa */}
      {showClose && (
        <div className="modal-overlay" onClick={() => setShowClose(false)}>
          <div className="modal modal-small" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2><Lock size={20} /> Fechar Caixa</h2><button className="btn-icon" onClick={() => setShowClose(false)}><X size={20} /></button></div>
            <div style={{ textAlign: 'center', padding: '1rem 0', fontSize: '1.1rem', color: '#555' }}>
              Saldo estimado: <strong style={{ color: '#1a1d23', fontSize: '1.5rem' }}>R$ {safe(r?.saldo_estimado)}</strong>
            </div>
            <form onSubmit={handleClose}>
              <div className="form-group">
                <label>Observacao (opcional)</label>
                <input value={closeObs} onChange={e => setCloseObs(e.target.value)} placeholder="Alguma observacao sobre o fechamento?" />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowClose(false)}>Cancelar</button>
                <button type="submit" className="btn" style={{ background: '#c62828', color: '#fff' }}>Confirmar Fechamento</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suprimento */}
      {showSupply && (
        <div className="modal-overlay" onClick={() => setShowSupply(false)}>
          <div className="modal modal-small" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2><Plus size={20} /> Adicionar Dinheiro</h2><button className="btn-icon" onClick={() => setShowSupply(false)}><X size={20} /></button></div>
            <form onSubmit={handleSupply}>
              <div className="form-group">
                <label>Valor (R$)</label>
                <input type="number" step="0.01" value={supplyAmount} onChange={e => setSupplyAmount(e.target.value)} required autoFocus
                  style={{ fontSize: '1.15rem', fontWeight: 700, textAlign: 'center' }} />
              </div>
              <div className="form-group">
                <label>Descricao</label>
                <input value={supplyDesc} onChange={e => setSupplyDesc(e.target.value)} placeholder="Suprimento de Caixa" />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSupply(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sangria */}
      {showWithdraw && (
        <div className="modal-overlay" onClick={() => setShowWithdraw(false)}>
          <div className="modal modal-small" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2><Minus size={20} /> Retirar Valores</h2><button className="btn-icon" onClick={() => setShowWithdraw(false)}><X size={20} /></button></div>
            <form onSubmit={handleWithdraw}>
              <div className="form-group">
                <label>Valor (R$)</label>
                <input type="number" step="0.01" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} required autoFocus
                  style={{ fontSize: '1.15rem', fontWeight: 700, textAlign: 'center' }} />
              </div>
              <div className="form-group">
                <label>Descricao</label>
                <input value={withdrawDesc} onChange={e => setWithdrawDesc(e.target.value)} placeholder="Sangria de Caixa" />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowWithdraw(false)}>Cancelar</button>
                <button type="submit" className="btn" style={{ background: '#c62828', color: '#fff' }}>Confirmar Retirada</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
