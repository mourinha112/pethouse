import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAviso } from './Aviso';
import {
  TrendingUp, ShoppingBag, Hourglass, Ban, Users, Package,
  RefreshCw, AlertTriangle,
} from 'lucide-react';

/*
 * Painel: quanto entrou, quantos pedidos esperam resposta e o que mais
 * vendeu — com recorte por periodo e por tipo de pet.
 */

const PERIODOS = [
  { dias: 7, rotulo: 'Semana' },
  { dias: 15, rotulo: 'Quinzena' },
  { dias: 30, rotulo: 'Mês' },
  { dias: 90, rotulo: '3 meses' },
];

const ESPECIES = [['todos', 'Todos'], ['cao', 'Cão'], ['gato', 'Gato']];
const PORTES = [['todos', 'Todos'], ['pequena', 'Raça pequena'], ['media', 'Médio'], ['grande', 'Grande']];
const PERFIS = [['todos', 'Todas'], ['filhote', 'Filhote'], ['adulto', 'Adulto'], ['castrado', 'Castrado'], ['senior', 'Sênior']];

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = (v) => brl.format(Number(v) || 0);

const ROT_PORTE = { pequena: 'Raça pequena', media: 'Porte médio', grande: 'Porte grande' };
const ROT_PERFIL = { filhote: 'Filhote', adulto: 'Adulto', castrado: 'Castrado', senior: 'Sênior' };

function etiquetas(l) {
  const p = [];
  if (l.especie === 'cao') p.push('Cão');
  else if (l.especie === 'gato') p.push('Gato');
  if (ROT_PERFIL[l.perfil]) p.push(ROT_PERFIL[l.perfil]);
  if (ROT_PORTE[l.porte]) p.push(ROT_PORTE[l.porte]);
  return p.join(' · ');
}

export default function Painel() {
  const aviso = useAviso();
  const [resumo, setResumo] = useState(null);
  const [ranking, setRanking] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const [dias, setDias] = useState(7);
  const [especie, setEspecie] = useState('todos');
  const [porte, setPorte] = useState('todos');
  const [perfil, setPerfil] = useState('todos');

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams({ dias, especie, porte, perfil });
      const [r1, r2] = await Promise.all([
        api.get('/orders/resumo'),
        api.get(`/marketing/ranking?${params.toString()}`),
      ]);
      setResumo(r1.data);
      setRanking(r2.data);
    } catch (err) {
      aviso.erro('Não consegui carregar os números');
    } finally {
      setCarregando(false);
    }
  }, [dias, especie, porte, perfil]);

  useEffect(() => { carregar(); }, [carregar]);

  const lista = ranking?.ranking || [];
  const maior = lista.length > 0 ? lista[0].faturamento : 0;
  const temRecorte = especie !== 'todos' || porte !== 'todos' || perfil !== 'todos';

  return (
    <div className="pn-pagina">
      <header className="pn-cabecalho">
        <h1>Painel</h1>
        <button className="pn-btn pn-btn-claro" onClick={carregar}>
          <RefreshCw size={16} /> Atualizar
        </button>
      </header>

      {resumo && (
        <div className="pn-cartoes">
          <div className="pn-cartao destaque">
            <div className="pn-cartao-icone"><TrendingUp size={19} /></div>
            <div>
              <span className="pn-cartao-rotulo">Vendido hoje</span>
              <strong>{money(resumo.hoje.produtos)}</strong>
              <small>
                {resumo.hoje.pedidos} pedido{resumo.hoje.pedidos === 1 ? '' : 's'}
                {resumo.hoje.frete > 0 ? ` · ${money(resumo.hoje.frete)} de entrega` : ''}
              </small>
            </div>
          </div>

          <div className="pn-cartao">
            <div className="pn-cartao-icone"><ShoppingBag size={19} /></div>
            <div>
              <span className="pn-cartao-rotulo">No mês</span>
              <strong>{money(resumo.mes.produtos)}</strong>
              <small>{resumo.mes.pedidos} pedidos · ticket {money(resumo.ticket_medio_mes)}</small>
            </div>
          </div>

          <div className="pn-cartao">
            <div className="pn-cartao-icone alerta"><Hourglass size={19} /></div>
            <div>
              <span className="pn-cartao-rotulo">Esperando você</span>
              <strong>{resumo.aguardando}</strong>
              <small>{resumo.aguardando === 0 ? 'nada na fila' : 'para confirmar'}</small>
            </div>
          </div>

          <div className="pn-cartao">
            <div className="pn-cartao-icone neutro"><Ban size={19} /></div>
            <div>
              <span className="pn-cartao-rotulo">Cancelados no mês</span>
              <strong>{resumo.cancelados_mes}</strong>
              <small>
                {resumo.mes.pedidos + resumo.cancelados_mes > 0
                  ? `${Math.round((resumo.cancelados_mes / (resumo.mes.pedidos + resumo.cancelados_mes)) * 100)}% dos pedidos`
                  : 'nenhum'}
              </small>
            </div>
          </div>

          <div className="pn-cartao">
            <div className="pn-cartao-icone neutro"><Users size={19} /></div>
            <div>
              <span className="pn-cartao-rotulo">Clientes</span>
              <strong>{resumo.clientes}</strong>
              <small>cadastrados pelo primeiro pedido</small>
            </div>
          </div>

          <div className="pn-cartao">
            <div className="pn-cartao-icone neutro"><Package size={19} /></div>
            <div>
              <span className="pn-cartao-rotulo">Produtos ativos</span>
              <strong>{resumo.produtos}</strong>
              <small>no cadastro</small>
            </div>
          </div>
        </div>
      )}

      <section className="pn-secao">
        <h2>O que mais vendeu</h2>
        <p className="pn-secao-sub">
          Escolha o período e o recorte para decidir a próxima promoção ou o próximo post.
        </p>

        <div className="pn-filtros">
          <div className="pn-filtro">
            <span className="pn-filtro-rotulo">Período</span>
            <div className="pn-chips">
              {PERIODOS.map((p) => (
                <button
                  key={p.dias}
                  className={`pn-chip ${dias === p.dias ? 'ativo' : ''}`}
                  onClick={() => setDias(p.dias)}
                >{p.rotulo}</button>
              ))}
            </div>
          </div>

          <div className="pn-filtro">
            <span className="pn-filtro-rotulo">Espécie</span>
            <div className="pn-chips">
              {ESPECIES.map(([v, r]) => (
                <button
                  key={v}
                  className={`pn-chip ${especie === v ? 'ativo' : ''}`}
                  onClick={() => { setEspecie(v); if (v !== 'cao') setPorte('todos'); }}
                >{r}</button>
              ))}
            </div>
          </div>

          {especie === 'cao' && (
            <div className="pn-filtro">
              <span className="pn-filtro-rotulo">Porte do cão</span>
              <div className="pn-chips">
                {PORTES.map(([v, r]) => (
                  <button key={v} className={`pn-chip ${porte === v ? 'ativo' : ''}`} onClick={() => setPorte(v)}>{r}</button>
                ))}
              </div>
            </div>
          )}

          <div className="pn-filtro">
            <span className="pn-filtro-rotulo">Fase / condição</span>
            <div className="pn-chips">
              {PERFIS.map(([v, r]) => (
                <button key={v} className={`pn-chip ${perfil === v ? 'ativo' : ''}`} onClick={() => setPerfil(v)}>{r}</button>
              ))}
            </div>
          </div>
        </div>

        {ranking && ranking.sem_classificacao > 0 && (
          <div className="pn-alerta">
            <AlertTriangle size={18} />
            <div>
              <strong>{ranking.sem_classificacao} produto(s) vendidos não têm espécie definida</strong> e
              somem quando você filtra por Cão ou Gato. Preencha espécie, porte e fase em
              <strong> Produtos</strong> — comece pelos que aparecem no topo daqui.
            </div>
          </div>
        )}

        {carregando ? (
          <div className="pn-carregando">Carregando…</div>
        ) : lista.length === 0 ? (
          <div className="pn-vazio">
            Nada vendido {temRecorte ? 'com esse recorte — tente afrouxar os filtros' : `nos últimos ${dias} dias`}.
          </div>
        ) : (
          <>
            <div className="pn-resumo-linha">
              <span><strong>{money(ranking.total.faturamento)}</strong> no recorte</span>
              <span>{ranking.total.produtos} produtos · {ranking.periodo.pedidos} pedidos no período</span>
            </div>

            <div className="pn-ranking">
              {lista.map((l, i) => (
                <div className="pn-item" key={l.id}>
                  <div className={`pn-pos p${i + 1}`}>{i + 1}</div>
                  <div className="pn-item-info">
                    <div className="pn-item-marca">{l.marca || 'sem marca'}</div>
                    <div className="pn-item-nome">{l.nome}</div>
                    {etiquetas(l) && <div className="pn-item-tags">{etiquetas(l)}</div>}
                    <div className="pn-barra">
                      <i style={{ width: `${maior > 0 ? (l.faturamento / maior) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <div className="pn-item-numeros">
                    <div className="pn-item-fat">{money(l.faturamento)}</div>
                    <div className="pn-item-detalhe">
                      {l.vezes}x · {l.quilos > 0 ? `${l.quilos} kg · ` : ''}{l.participacao}%
                    </div>
                    <div className={`pn-item-estoque ${l.estoque_kg > 0 || l.estoque_unidade > 0 ? '' : 'zerado'}`}>
                      {l.estoque_kg > 0 ? `${l.estoque_kg} kg` : l.estoque_unidade > 0 ? `${l.estoque_unidade} un` : 'sem estoque'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
