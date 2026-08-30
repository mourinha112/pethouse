import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useToast } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import Loading from '../components/Loading';
import {
  RefreshCw, Truck, Store, Clock, Phone, MapPin, Repeat, Check, X, Receipt,
} from 'lucide-react';

/*
 * Pedidos que chegam da loja online (/loja).
 * Confirmar um pedido cria a venda no PDV e baixa o estoque.
 */

const FILTROS = [
  { value: 'novo', label: 'Novos' },
  { value: 'confirmado', label: 'Confirmados' },
  { value: 'separando', label: 'Separando' },
  { value: 'pronto', label: 'Prontos' },
  { value: 'entregue', label: 'Entregues' },
  { value: 'todos', label: 'Todos' },
];

const STATUS_INFO = {
  novo: { label: 'Novo', cor: '#B60100', fundo: '#FDECEC' },
  confirmado: { label: 'Confirmado', cor: '#0B6B3A', fundo: '#E9F6EC' },
  separando: { label: 'Separando', cor: '#8A5A00', fundo: '#FFF3C9' },
  pronto: { label: 'Pronto', cor: '#14507A', fundo: '#E4F0FA' },
  entregue: { label: 'Entregue', cor: '#555', fundo: '#EEE' },
  cancelado: { label: 'Cancelado', cor: '#777', fundo: '#F1F1F1' },
};

const PROXIMO_STATUS = {
  confirmado: { valor: 'separando', label: 'Separar' },
  separando: { valor: 'pronto', label: 'Marcar pronto' },
  pronto: { valor: 'entregue', label: 'Marcar entregue' },
};

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = (v) => brl.format(Number(v) || 0);

function quando(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return mesmoDia ? `hoje ${hora}` : `${d.toLocaleDateString('pt-BR')} ${hora}`;
}

function telefoneBonito(w) {
  const d = String(w || '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return w;
}

export default function Orders() {
  const toast = useToast();
  const [pedidos, setPedidos] = useState([]);
  const [filtro, setFiltro] = useState('novo');
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(null);
  const [confirmando, setConfirmando] = useState(null);
  const [pagamento, setPagamento] = useState('pix');
  const [cancelando, setCancelando] = useState(null);

  const carregar = useCallback(async (silencioso) => {
    if (!silencioso) setCarregando(true);
    try {
      const res = await api.get(`/orders?status=${filtro}`);
      setPedidos(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (!silencioso) toast.error('Erro ao carregar pedidos');
    } finally {
      setCarregando(false);
    }
  }, [filtro]);

  useEffect(() => { carregar(); }, [carregar]);

  // Pedido novo cai na tela sozinho, sem precisar ficar recarregando.
  useEffect(() => {
    const t = setInterval(() => carregar(true), 30000);
    return () => clearInterval(t);
  }, [carregar]);

  async function confirmarPedido() {
    const pedido = confirmando;
    setOcupado(pedido.id);
    try {
      const res = await api.post(`/orders/${pedido.id}/confirm`, { forma_pagamento: pagamento });
      toast.success(`Pedido #${pedido.id} lançado como venda #${res.data.sale_id}`);
      setConfirmando(null);
      carregar(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Não foi possível confirmar');
    } finally {
      setOcupado(null);
    }
  }

  async function mudarStatus(pedido, status) {
    setOcupado(pedido.id);
    try {
      await api.put(`/orders/${pedido.id}/status`, { status });
      carregar(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Não foi possível atualizar');
    } finally {
      setOcupado(null);
    }
  }

  async function cancelarPedido() {
    const pedido = cancelando;
    setCancelando(null);
    await mudarStatus(pedido, 'cancelado');
    toast.success(`Pedido #${pedido.id} cancelado`);
  }

  function abrirWhatsApp(pedido) {
    const numero = String(pedido.cliente_whatsapp || '').replace(/\D/g, '');
    if (!numero) return;
    const texto = `Oi ${pedido.cliente_nome}! Aqui é a The Pet House. Recebemos seu pedido #${pedido.id}.`;
    window.open(`https://wa.me/55${numero}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
  }

  if (carregando) return <Loading />;

  const novos = pedidos.filter((p) => p.status === 'novo').length;

  return (
    <div className="page page-wide">
      <div className="page-header">
        <h1 className="page-title">
          Pedidos online
          {filtro === 'novo' && novos > 0 && <span className="ped-contador">{novos}</span>}
        </h1>
        <button className="btn btn-secondary" onClick={() => carregar()}>
          <RefreshCw size={16} /> Atualizar
        </button>
      </div>

      <div className="filter-bar ped-filtros">
        {FILTROS.map((f) => (
          <button
            key={f.value}
            className={`pdv-filter-btn ${filtro === f.value ? 'active' : ''}`}
            onClick={() => setFiltro(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {pedidos.length === 0 && (
        <div className="table-empty" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
          Nenhum pedido {filtro === 'todos' ? '' : `com status "${FILTROS.find((f) => f.value === filtro)?.label.toLowerCase()}"`} por aqui.
        </div>
      )}

      <div className="ped-lista">
        {pedidos.map((p) => {
          const info = STATUS_INFO[p.status] || STATUS_INFO.novo;
          const proximo = PROXIMO_STATUS[p.status];
          const itens = p.order_items || [];
          const travado = ocupado === p.id;

          return (
            <div className="ped-card" key={p.id}>
              <div className="ped-card-topo">
                <div>
                  <div className="ped-numero">Pedido #{p.id}</div>
                  <div className="ped-hora">{quando(p.created_at)}</div>
                </div>
                <span className="ped-status" style={{ color: info.cor, background: info.fundo }}>{info.label}</span>
              </div>

              <div className="ped-cliente">
                <div className="ped-nome">{p.cliente_nome}</div>
                <button className="ped-zap" onClick={() => abrirWhatsApp(p)} title="Abrir no WhatsApp">
                  <Phone size={14} /> {telefoneBonito(p.cliente_whatsapp)}
                </button>
              </div>

              <div className="ped-entrega">
                {p.tipo_entrega === 'entrega' ? <Truck size={16} /> : <Store size={16} />}
                <div>
                  <div className="ped-entrega-titulo">
                    {p.tipo_entrega === 'entrega' ? 'Entregar' : 'Retirar na loja'}
                    {p.janela ? ` · ${p.janela}` : ''}
                  </div>
                  {p.tipo_entrega === 'entrega' && p.endereco && (
                    <div className="ped-endereco"><MapPin size={12} /> {p.endereco}{p.referencia ? ` — ${p.referencia}` : ''}</div>
                  )}
                </div>
              </div>

              <ul className="ped-itens">
                {itens.map((it) => (
                  <li key={it.id}>
                    <span>
                      <b>{it.tipo_venda === 'kg' ? `${it.quantidade_kg} kg` : `${it.quantidade_kg}x`}</b> {it.descricao}
                    </span>
                    <span>{money(it.subtotal)}</span>
                  </li>
                ))}
              </ul>

              {p.observacao && <div className="ped-obs">“{p.observacao}”</div>}

              {p.assinatura && (
                <div className="ped-clube">
                  <Repeat size={14} /> Cliente quer repetir {p.frequencia === 'semanal' ? 'toda semana' : p.frequencia === 'mensal' ? 'todo mês' : 'a cada 15 dias'}
                </div>
              )}

              <div className="ped-totais">
                <span>Produtos {money(p.subtotal)}</span>
                <span>{p.frete > 0 ? `Entrega ${money(p.frete)}` : 'Entrega grátis'}</span>
                <strong>{money(p.total)}</strong>
              </div>

              {p.sale_id && (
                <div className="ped-venda"><Receipt size={14} /> Lançado como venda #{p.sale_id}</div>
              )}

              <div className="ped-acoes">
                {p.status === 'novo' && (
                  <button
                    className="btn btn-primary"
                    disabled={travado}
                    onClick={() => { setPagamento('pix'); setConfirmando(p); }}
                  >
                    <Check size={16} /> Confirmar e lançar
                  </button>
                )}
                {proximo && (
                  <button className="btn btn-secondary" disabled={travado} onClick={() => mudarStatus(p, proximo.valor)}>
                    {proximo.label}
                  </button>
                )}
                {p.status !== 'cancelado' && p.status !== 'entregue' && (
                  <button className="btn btn-delete" disabled={travado} onClick={() => setCancelando(p)}>
                    <X size={16} /> Cancelar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {confirmando && (
        <div className="modal-overlay" onClick={() => setConfirmando(null)}>
          <div className="modal modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirmar pedido #{confirmando.id}</h2>
              <button className="btn-icon" onClick={() => setConfirmando(null)}><X size={18} /></button>
            </div>
            <div style={{ padding: '0 1.25rem 1.25rem' }}>
              <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
                Isso cria a venda de {money(confirmando.subtotal)} no caixa e dá baixa no estoque.
                {confirmando.frete > 0 && ` A taxa de entrega de ${money(confirmando.frete)} fica registrada só no pedido.`}
              </p>

              <label className="ped-rotulo">Forma de pagamento</label>
              <div className="ped-pagamentos">
                {[['dinheiro', 'Dinheiro'], ['pix', 'PIX'], ['cartao', 'Cartão']].map(([v, l]) => (
                  <button
                    key={v}
                    className={`pdv-filter-btn ${pagamento === v ? 'active' : ''}`}
                    onClick={() => setPagamento(v)}
                  >{l}</button>
                ))}
              </div>

              <div className="form-actions" style={{ marginTop: '1.25rem' }}>
                <button className="btn btn-secondary" onClick={() => setConfirmando(null)}>Voltar</button>
                <button className="btn btn-primary" disabled={ocupado === confirmando.id} onClick={confirmarPedido}>
                  {ocupado === confirmando.id ? 'Lançando…' : 'Confirmar venda'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cancelando && (
        <ConfirmModal
          title={`Cancelar pedido #${cancelando.id}?`}
          message="O cliente não é avisado automaticamente — combine pelo WhatsApp antes."
          confirmText="Cancelar pedido"
          danger
          onConfirm={cancelarPedido}
          onCancel={() => setCancelando(null)}
        />
      )}
    </div>
  );
}
