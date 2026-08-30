import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useToast } from '../components/Toast';
import Loading from '../components/Loading';
import {
  TrendingUp, Package, Receipt, ShoppingBag, AlertTriangle, RefreshCw,
} from 'lucide-react';

/*
 * Marketing: o que mais vendeu, recortado por periodo e por tipo de pet.
 * O ranking do Dashboard e sempre global; aqui da para perguntar coisas
 * como "qual a racao de gato castrado que mais saiu na quinzena".
 */

const PERIODOS = [
  { dias: 7, label: 'Semana' },
  { dias: 15, label: 'Quinzena' },
  { dias: 30, label: 'Mês' },
  { dias: 90, label: '3 meses' },
];

const ESPECIES = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'cao', label: 'Cão' },
  { valor: 'gato', label: 'Gato' },
];

const PORTES = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'pequena', label: 'Raça pequena' },
  { valor: 'media', label: 'Médio' },
  { valor: 'grande', label: 'Grande' },
];

const PERFIS = [
  { valor: 'todos', label: 'Todas' },
  { valor: 'filhote', label: 'Filhote' },
  { valor: 'adulto', label: 'Adulto' },
  { valor: 'castrado', label: 'Castrado' },
  { valor: 'senior', label: 'Sênior' },
];

const CATEGORIAS = [
  { valor: 'todos', label: 'Todas as categorias' },
  { valor: 'racao', label: 'Ração' },
  { valor: 'sache', label: 'Sachê' },
  { valor: 'medicamento', label: 'Medicamento' },
  { valor: 'coleira', label: 'Coleira' },
  { valor: 'roupinha', label: 'Roupinha' },
  { valor: 'comida_aves', label: 'Comida (aves)' },
  { valor: 'acessorio', label: 'Acessório' },
  { valor: 'outros', label: 'Outros' },
];

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = (v) => brl.format(Number(v) || 0);

const ROTULO_PORTE = { pequena: 'Raça pequena', media: 'Porte médio', grande: 'Porte grande' };
const ROTULO_PERFIL = { filhote: 'Filhote', adulto: 'Adulto', castrado: 'Castrado', senior: 'Sênior' };

function etiquetas(l) {
  const partes = [];
  if (l.especie === 'cao') partes.push('Cão');
  else if (l.especie === 'gato') partes.push('Gato');
  if (l.perfil && ROTULO_PERFIL[l.perfil]) partes.push(ROTULO_PERFIL[l.perfil]);
  if (l.porte && ROTULO_PORTE[l.porte]) partes.push(ROTULO_PORTE[l.porte]);
  return partes.join(' · ');
}

export default function Marketing() {
  const toast = useToast();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const [dias, setDias] = useState(7);
  const [especie, setEspecie] = useState('todos');
  const [porte, setPorte] = useState('todos');
  const [perfil, setPerfil] = useState('todos');
  const [categoria, setCategoria] = useState('todos');

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams({ dias, especie, porte, perfil, categoria });
      const res = await api.get(`/marketing/ranking?${params.toString()}`);
      setDados(res.data);
    } catch (err) {
      toast.error('Erro ao carregar o ranking');
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }, [dias, especie, porte, perfil, categoria]);

  useEffect(() => { carregar(); }, [carregar]);

  const periodoAtual = PERIODOS.find((p) => p.dias === dias);
  const ranking = dados?.ranking || [];
  const maiorFaturamento = ranking.length > 0 ? ranking[0].faturamento : 0;

  const temFiltro = especie !== 'todos' || porte !== 'todos' || perfil !== 'todos' || categoria !== 'todos';

  function limparFiltros() {
    setEspecie('todos'); setPorte('todos'); setPerfil('todos'); setCategoria('todos');
  }

  return (
    <div className="page page-wide">
      <div className="page-header">
        <h1 className="page-title">Marketing</h1>
        <button className="btn btn-secondary" onClick={carregar}>
          <RefreshCw size={16} /> Atualizar
        </button>
      </div>

      <div className="mkt-explica">
        O que mais saiu no balcão, recortado do jeito que você precisa para decidir a próxima
        promoção ou o próximo post. O ranking do Dashboard é sempre geral — aqui dá para
        perguntar, por exemplo, qual a ração de <strong>gato castrado</strong> que mais vendeu
        na <strong>quinzena</strong>.
      </div>

      {/* ---- PERIODO ---- */}
      <div className="mkt-bloco">
        <span className="mkt-rotulo">Período</span>
        <div className="mkt-chips">
          {PERIODOS.map((p) => (
            <button
              key={p.dias}
              className={`pdv-filter-btn ${dias === p.dias ? 'active' : ''}`}
              onClick={() => setDias(p.dias)}
            >
              {p.label}
              <small> · {p.dias}d</small>
            </button>
          ))}
        </div>
      </div>

      {/* ---- SEGMENTO ---- */}
      <div className="mkt-filtros">
        <div className="mkt-bloco">
          <span className="mkt-rotulo">Espécie</span>
          <div className="mkt-chips">
            {ESPECIES.map((e) => (
              <button
                key={e.valor}
                className={`pdv-filter-btn ${especie === e.valor ? 'active' : ''}`}
                onClick={() => { setEspecie(e.valor); if (e.valor !== 'cao') setPorte('todos'); }}
              >{e.label}</button>
            ))}
          </div>
        </div>

        {especie === 'cao' && (
          <div className="mkt-bloco">
            <span className="mkt-rotulo">Porte do cão</span>
            <div className="mkt-chips">
              {PORTES.map((o) => (
                <button
                  key={o.valor}
                  className={`pdv-filter-btn ${porte === o.valor ? 'active' : ''}`}
                  onClick={() => setPorte(o.valor)}
                >{o.label}</button>
              ))}
            </div>
          </div>
        )}

        <div className="mkt-bloco">
          <span className="mkt-rotulo">Fase / condição</span>
          <div className="mkt-chips">
            {PERFIS.map((o) => (
              <button
                key={o.valor}
                className={`pdv-filter-btn ${perfil === o.valor ? 'active' : ''}`}
                onClick={() => setPerfil(o.valor)}
              >{o.label}</button>
            ))}
          </div>
        </div>

        <div className="mkt-bloco">
          <span className="mkt-rotulo">Categoria</span>
          <select className="filter-select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIAS.map((c) => <option key={c.valor} value={c.valor}>{c.label}</option>)}
          </select>
        </div>

        {temFiltro && (
          <button className="btn btn-secondary btn-sm mkt-limpar" onClick={limparFiltros}>
            Limpar recorte
          </button>
        )}
      </div>

      {carregando ? <Loading /> : !dados ? null : (
        <>
          <div className="cards-grid cards-grid-4">
            <div className="card">
              <div className="card-icon card-green"><TrendingUp size={20} /></div>
              <div className="card-info">
                <span className="card-label">Faturamento do recorte</span>
                <span className="card-value">{money(dados.total.faturamento)}</span>
                <span className="card-sub">{periodoAtual?.label.toLowerCase()} · últimos {dias} dias</span>
              </div>
            </div>
            <div className="card">
              <div className="card-icon card-blue"><ShoppingBag size={20} /></div>
              <div className="card-info">
                <span className="card-label">Itens vendidos</span>
                <span className="card-value">{dados.total.itens}</span>
                <span className="card-sub">linhas de venda no recorte</span>
              </div>
            </div>
            <div className="card">
              <div className="card-icon card-purple"><Package size={20} /></div>
              <div className="card-info">
                <span className="card-label">Produtos diferentes</span>
                <span className="card-value">{dados.total.produtos}</span>
                <span className="card-sub">saíram pelo menos uma vez</span>
              </div>
            </div>
            <div className="card">
              <div className="card-icon card-orange"><Receipt size={20} /></div>
              <div className="card-info">
                <span className="card-label">Vendas no período</span>
                <span className="card-value">{dados.periodo.vendas}</span>
                <span className="card-sub">cupons emitidos (todos os produtos)</span>
              </div>
            </div>
          </div>

          {dados.sem_classificacao > 0 && (
            <div className="mkt-alerta">
              <AlertTriangle size={18} />
              <div>
                <strong>{dados.sem_classificacao} produto(s) vendidos não têm espécie definida</strong> e
                por isso ficam de fora quando você filtra por Cão ou Gato. Para o recorte ficar
                confiável, preencha espécie, porte e fase no bloco <em>Loja online</em> de cada
                produto, em <strong>Produtos</strong>. Vale começar pelos que aparecem no topo daqui.
              </div>
            </div>
          )}

          {ranking.length === 0 ? (
            <div className="table-empty" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
              Nada vendido com esse recorte {temFiltro ? '— tente afrouxar os filtros' : `nos últimos ${dias} dias`}.
            </div>
          ) : (
            <div className="mkt-ranking">
              {ranking.map((l, i) => (
                <div className={`mkt-item ${i < 3 ? 'podio' : ''}`} key={l.id}>
                  <div className={`mkt-pos p${i + 1}`}>{i + 1}</div>

                  <div className="mkt-info">
                    <div className="mkt-marca">{l.marca || 'sem marca'}</div>
                    <div className="mkt-nome">{l.nome}</div>
                    {etiquetas(l) && <div className="mkt-tags">{etiquetas(l)}</div>}
                    <div className="mkt-barra">
                      <i style={{ width: `${maiorFaturamento > 0 ? (l.faturamento / maiorFaturamento) * 100 : 0}%` }} />
                    </div>
                  </div>

                  <div className="mkt-numeros">
                    <div className="mkt-fat">{money(l.faturamento)}</div>
                    <div className="mkt-detalhe">
                      {l.vezes}x · {l.quilos > 0 ? `${l.quilos} kg · ` : ''}{l.participacao}% do recorte
                    </div>
                    {(l.estoque_kg > 0 || l.estoque_unidade > 0) ? (
                      <div className="mkt-estoque">
                        {l.estoque_kg > 0 ? `${l.estoque_kg} kg` : `${l.estoque_unidade} un`} em estoque
                      </div>
                    ) : (
                      <div className="mkt-estoque zerado">sem estoque</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
