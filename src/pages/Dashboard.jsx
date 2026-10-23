import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Loading from '../components/Loading';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  PointOfSale, Lock, LockOpen, Inventory2, ArrowForward, TrendingUp, TrendingDown,
  Refresh, Storefront, ReceiptLong, WarningAmber, EventBusy, Inventory,
} from '@mui/icons-material';
import '../styles/dashboard.css';

/*
 * Dashboard: o que esta acontecendo hoje, o que precisa de acao e a
 * tendencia da quinzena. Tudo vem de uma chamada so (/dashboard), montada
 * em api/_lib/dashboard.js.
 */

const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCurto = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1000) return `R$ ${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return brl(n);
};
const hora = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const PAGTO = { dinheiro: 'Dinheiro', pix: 'Pix', cartao: 'Cartão', debito: 'Débito', credito: 'Crédito', fiado: 'Fiado', outros: 'Outros' };
const COR_PAGTO = { dinheiro: '#2E7D32', pix: '#0E8F8F', cartao: '#B60100', debito: '#B60100', credito: '#8B0000', fiado: '#EF6C00', outros: '#8A776D' };
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function Variacao({ atual, anterior, rotulo }) {
  if (!anterior) {
    return <span className="dsh-var dsh-var-neutra">{rotulo}: {brl(anterior)}</span>;
  }
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  const sobe = pct >= 0;
  return (
    <span className={`dsh-var ${sobe ? 'dsh-var-sobe' : 'dsh-var-desce'}`}>
      {sobe ? <TrendingUp sx={{ fontSize: 15 }} /> : <TrendingDown sx={{ fontSize: 15 }} />}
      {sobe ? '+' : ''}{pct}% {rotulo}
    </span>
  );
}

function TooltipBarra({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="dsh-tooltip">
      <strong>{d.semana} {d.dia}{d.hoje ? ' · hoje' : ''}</strong>
      <span>{brl(d.faturamento)}</span>
      <small>{d.vendas} {d.vendas === 1 ? 'venda' : 'vendas'}</small>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const navigate = useNavigate();

  const nomeUsuario = useMemo(() => {
    try { return (JSON.parse(localStorage.getItem('petshop_user') || 'null')?.nome || '').split(' ')[0]; } catch (_) { return ''; }
  }, []);

  useEffect(() => { carregar(); }, []);

  async function carregar(silencioso = false) {
    if (silencioso) setAtualizando(true);
    try {
      const res = await api.get('/dashboard');
      setData(res.data);
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
    } finally {
      setLoading(false);
      setAtualizando(false);
    }
  }

  if (loading) return <Loading />;
  if (!data) return <div className="page-error">Erro ao carregar dados</div>;

  // Formato novo com fallback para o antigo (API ainda nao atualizada).
  const hoje = data.hoje || { faturamento: data.faturamento_dia || 0, vendas: data.vendas_dia || 0, ticket: data.ticket_medio || 0, lucro: data.lucro_dia || 0, margem: 0 };
  const ontem = data.ontem || { faturamento: 0, vendas: 0 };
  const mes = data.mes || { faturamento: data.faturamento_mes || 0, lucro: data.lucro_mes || 0, margem: 0, projecao: 0, dias_passados: new Date().getDate(), dias_no_mes: 30, despesas_pendentes: data.despesas_pendentes || 0 };
  const semana = data.semana || { atual: 0, anterior: 0 };
  const serie = data.serie || [];
  const caixa = data.caixa || { aberto: false };
  const estoque = data.estoque || { zerados: 0, criticos: data.alertas_estoque || [], valor: data.valor_estoque || 0 };
  const pagamentos = data.vendas_por_pagamento || [];
  const top = data.top_produtos || [];
  const ultimas = data.ultimas_vendas || [];
  const despesas = data.despesas_vencendo || [];
  const pedidosNovos = data.pedidos_novos || 0;

  const meta = Number(data.meta_diaria) || 0;
  const metaPct = meta > 0 ? Math.min(100, Math.round((hoje.faturamento / meta) * 100)) : 0;
  const faltaMeta = Math.max(0, meta - hoje.faturamento);
  const agora = new Date();
  const dataBruta = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const dataLonga = dataBruta.charAt(0).toUpperCase() + dataBruta.slice(1);
  const nomeMes = MESES[agora.getMonth()];
  const tituloMes = `${nomeMes.charAt(0).toUpperCase()}${nomeMes.slice(1)} até agora`;

  // Lista unica de "precisa de atencao", do mais urgente para o menos.
  const atencao = [];
  if (pedidosNovos > 0) atencao.push({ chave: 'pedidos', icone: <Storefront />, tom: 'vermelho', titulo: `${pedidosNovos} pedido${pedidosNovos > 1 ? 's' : ''} online esperando`, sub: 'Confirmar e separar', rota: '/orders' });
  if (!caixa.aberto) atencao.push({ chave: 'caixa', icone: <Lock />, tom: 'laranja', titulo: 'Caixa fechado', sub: 'Abra o caixa para registrar vendas', rota: '/cashier' });
  despesas.forEach((d) => atencao.push({
    chave: `desp-${d.id}`, icone: <EventBusy />, tom: d.dias < 0 ? 'vermelho' : d.dias <= 2 ? 'laranja' : 'neutro',
    titulo: `${d.descricao} · ${brl(d.valor)}`,
    sub: d.dias < 0 ? `Venceu há ${-d.dias} dia${-d.dias > 1 ? 's' : ''}` : d.dias === 0 ? 'Vence hoje' : `Vence em ${d.dias} dia${d.dias > 1 ? 's' : ''}`,
    rota: '/expenses',
  }));
  (estoque.criticos || []).slice(0, 4).forEach((p) => {
    const temDias = p.dias !== null && p.dias !== undefined;
    atencao.push({
      chave: `est-${p.id}`, icone: <Inventory2 />, tom: temDias && p.dias <= 3 ? 'vermelho' : 'laranja',
      titulo: `${p.nome}${p.marca ? ` · ${p.marca}` : ''}`,
      sub: `${p.restante || ''}${temDias ? ` · dá pra uns ${p.dias} dia${p.dias === 1 ? '' : 's'}` : ' · pouco estoque'}`,
      rota: '/stock',
    });
  });
  if (estoque.zerados > 0) atencao.push({ chave: 'zerados', icone: <WarningAmber />, tom: 'neutro', titulo: `${estoque.zerados} produto${estoque.zerados > 1 ? 's' : ''} com estoque zerado`, sub: 'Dê entrada ou desative o que não vende mais', rota: '/stock' });

  const totalPagto = pagamentos.reduce((s, p) => s + (Number(p.total) || 0), 0);
  const pctMes = Math.min(100, Math.round(((mes.dias_passados || 0) / (mes.dias_no_mes || 30)) * 100));

  return (
    <div className="page page-wide dsh-root">
      {/* ------------------------------------------------ cabecalho */}
      <header className="dsh-topo">
        <div>
          <h1 className="dsh-saudacao">{saudacao()}{nomeUsuario ? `, ${nomeUsuario}` : ''}</h1>
          <p className="dsh-data">{dataLonga}</p>
        </div>
        <div className="dsh-acoes">
          <button type="button" className={`dsh-chip-caixa ${caixa.aberto ? 'is-aberto' : 'is-fechado'}`} onClick={() => navigate('/cashier')}>
            {caixa.aberto ? <LockOpen sx={{ fontSize: 16 }} /> : <Lock sx={{ fontSize: 16 }} />}
            {caixa.aberto ? `Caixa aberto desde ${hora(caixa.desde)}` : 'Caixa fechado · abrir'}
          </button>
          <button type="button" className="dsh-btn dsh-btn-claro" onClick={() => navigate('/stock')}><Inventory sx={{ fontSize: 17 }} /> Entrada de estoque</button>
          <button type="button" className="dsh-btn dsh-btn-primario" onClick={() => navigate('/sales')}><PointOfSale sx={{ fontSize: 18 }} /> Nova venda</button>
          <button type="button" className="dsh-btn-icone" title="Atualizar" onClick={() => carregar(true)} disabled={atualizando}>
            <Refresh sx={{ fontSize: 18 }} className={atualizando ? 'dsh-gira' : ''} />
          </button>
        </div>
      </header>

      {/* ------------------------------------------------ hoje + mes */}
      <section className="dsh-grid dsh-grid-hero">
        <article className="dsh-card dsh-hoje">
          <div className="dsh-hoje-topo">
            <div>
              <span className="dsh-rotulo">Vendido hoje</span>
              <div className="dsh-valorao">{brl(hoje.faturamento)}</div>
              <Variacao atual={hoje.faturamento} anterior={ontem.faturamento} rotulo="vs ontem" />
            </div>
            <div className="dsh-meta">
              <div className="dsh-meta-linha">
                <span>Meta do dia · {brl(meta)}</span>
                <strong className={metaPct >= 100 ? 'is-bateu' : ''}>{metaPct}%</strong>
              </div>
              <div className="dsh-meta-barra"><span style={{ width: `${metaPct}%` }} /></div>
              <small>{metaPct >= 100 ? 'Meta batida. Boa!' : `Faltam ${brl(faltaMeta)} pra bater a meta`}</small>
            </div>
          </div>
          <div className="dsh-hoje-minis">
            <div className="dsh-mini">
              <span>Vendas</span>
              <strong>{hoje.vendas}</strong>
              <small>ontem {ontem.vendas || 0}</small>
            </div>
            <div className="dsh-mini">
              <span>Ticket médio</span>
              <strong>{brl(hoje.ticket)}</strong>
              <small>por venda</small>
            </div>
            <div className="dsh-mini">
              <span>Lucro de hoje</span>
              <strong className={hoje.lucro >= 0 ? 'is-positivo' : 'is-negativo'}>{brl(hoje.lucro)}</strong>
              <small>{hoje.margem ? `margem de ${hoje.margem}%` : 'sobre o custo cadastrado'}</small>
            </div>
            <div className="dsh-mini">
              <span>Esta semana</span>
              <strong>{brlCurto(semana.atual)}</strong>
              <small><Variacao atual={semana.atual} anterior={semana.anterior} rotulo="vs anterior" /></small>
            </div>
          </div>
        </article>

        <article className="dsh-card dsh-mes">
          <div className="dsh-card-cab">
            <h2>{tituloMes}</h2>
            <button type="button" className="dsh-link" onClick={() => navigate('/reports')}>Relatórios <ArrowForward sx={{ fontSize: 14 }} /></button>
          </div>
          <div className="dsh-mes-valor">{brl(mes.faturamento)}</div>
          <div className="dsh-mes-sub">
            dia {mes.dias_passados} de {mes.dias_no_mes} · no ritmo atual fecha em <strong>{brlCurto(mes.projecao)}</strong>
          </div>
          <div className="dsh-mes-barra"><span style={{ width: `${pctMes}%` }} /></div>
          <dl className="dsh-mes-lista">
            <div><dt>Lucro bruto</dt><dd className={mes.lucro >= 0 ? 'is-positivo' : 'is-negativo'}>{brl(mes.lucro)} <small>{mes.margem ? `${mes.margem}%` : ''}</small></dd></div>
            <div><dt>Despesas pendentes</dt><dd className={mes.despesas_pendentes > 0 ? 'is-negativo' : ''}>{brl(mes.despesas_pendentes)}</dd></div>
            <div><dt>Estoque em loja</dt><dd>{brlCurto(estoque.valor ?? data.valor_estoque)} <small>a preço de venda</small></dd></div>
          </dl>
        </article>
      </section>

      {/* ------------------------------------------------ grafico + pagamentos */}
      <section className="dsh-grid dsh-grid-meio">
        <article className="dsh-card">
          <div className="dsh-card-cab">
            <h2>Últimos 14 dias</h2>
            <span className="dsh-card-nota">Esta semana {brl(semana.atual)} · semana passada {brl(semana.anterior)}</span>
          </div>
          <div className="dsh-grafico">
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={serie} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap="28%">
                <XAxis dataKey="dia" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8A776D' }} />
                <YAxis hide domain={[0, 'dataMax']} />
                <Tooltip content={<TooltipBarra />} cursor={{ fill: 'rgba(182,1,0,0.06)' }} />
                <Bar dataKey="faturamento" radius={[6, 6, 2, 2]} maxBarSize={38}>
                  {serie.map((d) => <Cell key={d.data} fill={d.hoje ? '#B60100' : d.faturamento === 0 ? '#F0E6DE' : '#E3B8B0'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="dsh-grafico-legenda">
              {serie.map((d) => <span key={d.data} className={d.hoje ? 'is-hoje' : ''}>{d.semana}</span>)}
            </div>
          </div>
        </article>

        <article className="dsh-card">
          <div className="dsh-card-cab">
            <h2>Como pagaram hoje</h2>
            <span className="dsh-card-nota">{brl(totalPagto)}</span>
          </div>
          {pagamentos.length === 0 ? (
            <p className="dsh-vazio">Nenhuma venda registrada hoje ainda.</p>
          ) : (
            <>
              <div className="dsh-pagto-barra">
                {pagamentos.map((p) => (
                  <span key={p.forma_pagamento} style={{ width: `${p.pct}%`, background: COR_PAGTO[p.forma_pagamento] || COR_PAGTO.outros }} title={`${PAGTO[p.forma_pagamento] || p.forma_pagamento} ${p.pct}%`} />
                ))}
              </div>
              <ul className="dsh-pagto-lista">
                {pagamentos.map((p) => (
                  <li key={p.forma_pagamento}>
                    <i style={{ background: COR_PAGTO[p.forma_pagamento] || COR_PAGTO.outros }} />
                    <span className="dsh-pagto-nome">{PAGTO[p.forma_pagamento] || p.forma_pagamento}</span>
                    <span className="dsh-pagto-qtd">{p.qtd} {p.qtd === 1 ? 'venda' : 'vendas'}</span>
                    <strong>{brl(p.total)}</strong>
                    <em>{p.pct}%</em>
                  </li>
                ))}
              </ul>
              {caixa.aberto && (
                <button type="button" className="dsh-link dsh-link-rodape" onClick={() => navigate('/cashier')}>Conferir o caixa <ArrowForward sx={{ fontSize: 14 }} /></button>
              )}
            </>
          )}
        </article>
      </section>

      {/* ------------------------------------------------ atencao + top + ultimas */}
      <section className="dsh-grid dsh-grid-base">
        <article className="dsh-card">
          <div className="dsh-card-cab">
            <h2>Precisa de atenção</h2>
            {atencao.length > 0 && <span className="dsh-contador">{atencao.length}</span>}
          </div>
          {atencao.length === 0 ? (
            <p className="dsh-vazio dsh-vazio-ok">Tudo em dia. Caixa aberto, estoque ok e nenhuma conta vencendo.</p>
          ) : (
            <ul className="dsh-atencao">
              {atencao.slice(0, 7).map((a) => (
                <li key={a.chave}>
                  <button type="button" onClick={() => navigate(a.rota)}>
                    <span className={`dsh-atencao-icone is-${a.tom}`}>{a.icone}</span>
                    <span className="dsh-atencao-texto">
                      <strong>{a.titulo}</strong>
                      <small>{a.sub}</small>
                    </span>
                    <ArrowForward sx={{ fontSize: 15 }} className="dsh-atencao-seta" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="dsh-card">
          <div className="dsh-card-cab">
            <h2>Mais vendidos · 30 dias</h2>
            <button type="button" className="dsh-link" onClick={() => navigate('/marketing')}>Marketing <ArrowForward sx={{ fontSize: 14 }} /></button>
          </div>
          {top.length === 0 ? (
            <p className="dsh-vazio">Ainda não tem venda nos últimos 30 dias.</p>
          ) : (
            <ol className="dsh-top">
              {top.map((p, i) => (
                <li key={p.id || i}>
                  <span className="dsh-top-pos">{i + 1}</span>
                  <span className="dsh-top-texto">
                    <strong>{p.nome}</strong>
                    <small>{p.marca}{p.marca ? ' · ' : ''}{Number(p.total_kg || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} {p.unidade || 'kg'}</small>
                    <i style={{ width: `${p.pct ?? 100}%` }} />
                  </span>
                  <strong className="dsh-top-valor">{brl(p.total)}</strong>
                </li>
              ))}
            </ol>
          )}
        </article>

        <article className="dsh-card">
          <div className="dsh-card-cab">
            <h2>Últimas vendas</h2>
            <button type="button" className="dsh-link" onClick={() => navigate('/sales')}>PDV <ArrowForward sx={{ fontSize: 14 }} /></button>
          </div>
          {ultimas.length === 0 ? (
            <p className="dsh-vazio">Nenhuma venda registrada ainda.</p>
          ) : (
            <ul className="dsh-ultimas">
              {ultimas.map((v) => (
                <li key={v.id}>
                  <span className="dsh-ultimas-hora"><ReceiptLong sx={{ fontSize: 15 }} /> {hora(v.created_at)}</span>
                  <span className="dsh-ultimas-nome">{v.client_nome || v.clients?.nome || 'Cliente avulso'}</span>
                  <span className="dsh-ultimas-pagto" style={{ color: COR_PAGTO[v.forma_pagamento] || COR_PAGTO.outros }}>{PAGTO[v.forma_pagamento] || v.forma_pagamento}</span>
                  <strong>{brl(v.total)}</strong>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </div>
  );
}
