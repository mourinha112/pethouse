/*
 * Monta o payload do Dashboard. Um lugar so: a funcao da Vercel
 * (api/dashboard.js), o handler unico (api/index.js) e o servidor de
 * desenvolvimento (api/server.js) chamam esta funcao.
 *
 * Tudo aqui e contado no dia de Sao Paulo (UTC-3). Antes o "hoje" era o
 * dia em UTC, entao venda depois das 21h caia no dia seguinte.
 */

const FUSO = '-03:00';

const fmtDia = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function diaLocal(d = new Date()) {
  return fmtDia.format(d); // YYYY-MM-DD
}

function somarDias(dia, n) {
  const d = new Date(`${dia}T12:00:00${FUSO}`);
  d.setUTCDate(d.getUTCDate() + n);
  return diaLocal(d);
}

const inicioDoDia = (dia) => `${dia}T00:00:00${FUSO}`;
const num = (v) => Number(v) || 0;
const r2 = (v) => Math.round(num(v) * 100) / 100;
const isRacao = (p) => !p.categoria || p.categoria === 'racao';

function custoDoItem(item, p) {
  if (!p) return 0;
  const q = num(item.quantidade_kg);
  if (!isRacao(p)) return q * num(p.custo_unitario);
  if (p.peso_saco_kg && p.custo_saco) return (q / (num(p.peso_saco_kg) || 1)) * num(p.custo_saco);
  return q * num(p.custo_por_kg);
}

export function dashboardVazio() {
  return {
    faturamento_dia: 0, vendas_dia: 0, ticket_medio: 0, faturamento_mes: 0,
    custo_dia: 0, custo_mes: 0, lucro_dia: 0, lucro_mes: 0,
    estoque_total_kg: 0, estoque_total_unidade: 0, valor_estoque: 0,
    total_produtos: 0, total_clientes: 0, despesas_pendentes: 0,
    meta_diaria: 500, meta_percent: 0, pagamentos: {}, vendas_por_pagamento: [],
    ultimas_vendas: [], top_produtos: [], alertas_estoque: [], estoque_baixo: [],
    hoje: { faturamento: 0, vendas: 0, ticket: 0, custo: 0, lucro: 0, margem: 0 },
    ontem: { faturamento: 0, vendas: 0 },
    semana: { atual: 0, anterior: 0 },
    mes: { faturamento: 0, custo: 0, lucro: 0, margem: 0, dias_passados: 0, dias_no_mes: 30, projecao: 0, despesas_pendentes: 0 },
    serie: [], caixa: { aberto: false }, pedidos_novos: 0, despesas_vencendo: [],
    estoque: { zerados: 0, criticos: [], total_kg: 0, total_un: 0, valor: 0 },
  };
}

export async function montarDashboard(supabase) {
  const hoje = diaLocal();
  const ontem = somarDias(hoje, -1);
  const mesInicio = `${hoje.slice(0, 7)}-01`;
  const inicio30 = somarDias(hoje, -29);
  const inicio14 = somarDias(hoje, -13);
  const inicioBusca = inicio30 < mesInicio ? inicio30 : mesInicio;

  const [
    { data: vendasBrutas },
    { data: produtosBrutos },
    { data: metaRow },
    { data: ultimasBrutas },
    { data: caixaRows },
    { count: totalClientes },
  ] = await Promise.all([
    supabase.from('sales').select('id, total, forma_pagamento, created_at, client_id')
      .gte('created_at', inicioDoDia(inicioBusca)).order('created_at', { ascending: true }),
    supabase.from('products')
      .select('id, nome, marca, categoria, estoque_kg, estoque_unidade, estoque_minimo_dias, estoque_minimo_unidade, preco_por_kg, preco_unitario, custo_unitario, custo_por_kg, custo_saco, peso_saco_kg')
      .eq('ativo', 1),
    supabase.from('settings').select('value').eq('key', 'meta_diaria').maybeSingle(),
    supabase.from('sales').select('id, total, forma_pagamento, created_at, clients(nome)')
      .order('created_at', { ascending: false }).limit(6),
    supabase.from('cash_sessions').select('id, saldo_inicial, opened_at').eq('status', 'aberto')
      .order('opened_at', { ascending: false }).limit(1),
    supabase.from('clients').select('id', { count: 'exact', head: true }),
  ]);

  const vendas = (vendasBrutas || []).map((v) => ({ ...v, dia: diaLocal(new Date(v.created_at)) }));
  const prods = produtosBrutos || [];
  const porId = new Map(prods.map((p) => [p.id, p]));

  // Itens de todas as vendas do periodo (mes + 30 dias), uma consulta so.
  const ids = vendas.map((v) => v.id);
  let itens = [];
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await supabase.from('sale_items')
      .select('sale_id, product_id, quantidade_kg, subtotal').in('sale_id', ids.slice(i, i + 300));
    itens = itens.concat(data || []);
  }
  const diaDaVenda = new Map(vendas.map((v) => [v.id, v.dia]));

  // ------------------------------------------------------------ hoje / ontem
  const vHoje = vendas.filter((v) => v.dia === hoje);
  const vOntem = vendas.filter((v) => v.dia === ontem);
  const vMes = vendas.filter((v) => v.dia >= mesInicio);
  const soma = (lista) => lista.reduce((s, v) => s + num(v.total), 0);

  const custoDe = (filtroDia) => itens.reduce((s, it) => {
    const dia = diaDaVenda.get(it.sale_id);
    return dia && filtroDia(dia) ? s + custoDoItem(it, porId.get(it.product_id)) : s;
  }, 0);

  const fatHoje = soma(vHoje);
  const custoHoje = custoDe((d) => d === hoje);
  const fatMes = soma(vMes);
  const custoMes = custoDe((d) => d >= mesInicio);
  const margem = (fat, custo) => (fat > 0 ? ((fat - custo) / fat) * 100 : 0);

  // ------------------------------------------------------------ serie 14 dias
  const porDia = {};
  for (const v of vendas) {
    if (v.dia < inicio14) continue;
    if (!porDia[v.dia]) porDia[v.dia] = { faturamento: 0, vendas: 0 };
    porDia[v.dia].faturamento += num(v.total);
    porDia[v.dia].vendas += 1;
  }
  const semanas = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const serie = [];
  for (let i = 13; i >= 0; i--) {
    const dia = somarDias(hoje, -i);
    const d = new Date(`${dia}T12:00:00${FUSO}`);
    serie.push({
      data: dia,
      dia: dia.slice(8, 10),
      semana: semanas[d.getUTCDay()],
      faturamento: r2(porDia[dia]?.faturamento),
      vendas: porDia[dia]?.vendas || 0,
      hoje: dia === hoje,
    });
  }
  const semanaAtual = serie.slice(7).reduce((s, d) => s + d.faturamento, 0);
  const semanaAnterior = serie.slice(0, 7).reduce((s, d) => s + d.faturamento, 0);

  // ------------------------------------------------------------ mes / projecao
  const [ano, mesNum] = hoje.split('-').map(Number);
  const diasNoMes = new Date(Date.UTC(ano, mesNum, 0)).getUTCDate();
  const diasPassados = Number(hoje.slice(8, 10));
  const projecao = diasPassados > 0 ? (fatMes / diasPassados) * diasNoMes : 0;

  // ------------------------------------------------------------ pagamentos hoje
  const pag = {};
  for (const v of vHoje) {
    const f = v.forma_pagamento || 'outros';
    if (!pag[f]) pag[f] = { forma_pagamento: f, total: 0, qtd: 0 };
    pag[f].total += num(v.total);
    pag[f].qtd += 1;
  }
  const vendasPorPagamento = Object.values(pag)
    .map((p) => ({ ...p, total: r2(p.total), pct: fatHoje > 0 ? Math.round((p.total / fatHoje) * 100) : 0 }))
    .sort((a, b) => b.total - a.total);

  // ------------------------------------------------------------ top produtos 30d
  const por = {};
  for (const it of itens) {
    const dia = diaDaVenda.get(it.sale_id);
    if (!dia || dia < inicio30) continue;
    if (!por[it.product_id]) por[it.product_id] = { product_id: it.product_id, quantidade: 0, total: 0 };
    por[it.product_id].quantidade += num(it.quantidade_kg);
    por[it.product_id].total += num(it.subtotal);
  }
  const ranking = Object.values(por).sort((a, b) => b.total - a.total);
  const maior = ranking[0]?.total || 0;
  const topProdutos = ranking.slice(0, 5).map((p) => {
    const prod = porId.get(p.product_id);
    return {
      id: p.product_id,
      nome: prod?.nome || 'Produto',
      marca: prod?.marca || '',
      total: r2(p.total),
      total_kg: r2(p.quantidade),
      unidade: prod && !isRacao(prod) ? 'un' : 'kg',
      pct: maior > 0 ? Math.round((p.total / maior) * 100) : 0,
    };
  });

  // ------------------------------------------------------------ estoque
  const totalKg = prods.reduce((s, p) => s + (isRacao(p) ? num(p.estoque_kg) : 0), 0);
  const totalUn = prods.reduce((s, p) => s + (!isRacao(p) ? num(p.estoque_unidade) : 0), 0);
  const valorEstoque = prods.reduce((s, p) => s + (isRacao(p)
    ? num(p.estoque_kg) * num(p.preco_por_kg)
    : num(p.estoque_unidade) * num(p.preco_unitario)), 0);

  const criticos = [];
  let zerados = 0;
  for (const p of prods) {
    const media = (por[p.id]?.quantidade || 0) / 30; // por dia, ultimos 30 dias
    if (isRacao(p)) {
      const kg = num(p.estoque_kg);
      if (kg <= 0) { zerados += 1; continue; }
      const dias = media > 0 ? kg / media : null;
      const minimoDias = num(p.estoque_minimo_dias) || 7;
      if ((dias !== null && dias < minimoDias) || kg < 10) {
        criticos.push({ id: p.id, nome: p.nome, marca: p.marca || '', restante: `${kg.toFixed(1)} kg`, dias: dias === null ? null : Math.floor(dias), tipo_estoque: 'kg', estoque_kg: kg, estoque_unidade: null });
      }
    } else {
      const un = num(p.estoque_unidade);
      if (un <= 0) { zerados += 1; continue; }
      const minimo = num(p.estoque_minimo_unidade) || 1;
      const dias = media > 0 ? un / media : null;
      if (un < minimo) {
        criticos.push({ id: p.id, nome: p.nome, marca: p.marca || '', restante: `${un} un`, dias: dias === null ? null : Math.floor(dias), tipo_estoque: 'un', estoque_kg: null, estoque_unidade: un });
      }
    }
  }
  criticos.sort((a, b) => (a.dias ?? 999) - (b.dias ?? 999));

  // ------------------------------------------------------------ despesas
  let despesasPendentes = 0;
  let despesasVencendo = [];
  try {
    const mesFim = `${hoje.slice(0, 7)}-${String(diasNoMes).padStart(2, '0')}`;
    const limite = somarDias(hoje, 7);
    const { data: abertas } = await supabase.from('expenses')
      .select('id, descricao, valor, data_vencimento, pago, recorrente')
      .or('pago.eq.0,pago.is.null');
    const lista = abertas || [];
    despesasPendentes = lista
      .filter((e) => e.recorrente || (e.data_vencimento && e.data_vencimento >= mesInicio && e.data_vencimento <= mesFim))
      .reduce((s, e) => s + num(e.valor), 0);
    despesasVencendo = lista
      .filter((e) => e.data_vencimento && e.data_vencimento <= limite)
      .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
      .slice(0, 5)
      .map((e) => {
        const dias = Math.round((new Date(`${e.data_vencimento}T12:00:00${FUSO}`) - new Date(`${hoje}T12:00:00${FUSO}`)) / 86400000);
        return { id: e.id, descricao: e.descricao, valor: r2(e.valor), data_vencimento: e.data_vencimento, dias };
      });
  } catch (_) { /* tabela ausente: segue sem despesas */ }

  // ------------------------------------------------------------ pedidos online
  let pedidosNovos = 0;
  try {
    const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'novo');
    pedidosNovos = count || 0;
  } catch (_) { /* loja online nao instalada */ }

  // ------------------------------------------------------------ caixa
  const sessao = (caixaRows || [])[0];
  const caixa = sessao
    ? { aberto: true, id: sessao.id, desde: sessao.opened_at, saldo_inicial: r2(sessao.saldo_inicial) }
    : { aberto: false };

  const metaDiaria = parseFloat(metaRow?.value || '500') || 500;
  const metaPercent = metaDiaria > 0 ? Math.min(100, Math.round((fatHoje / metaDiaria) * 100)) : 0;

  const ultimasVendas = (ultimasBrutas || []).map((v) => ({
    id: v.id, total: r2(v.total), forma_pagamento: v.forma_pagamento, created_at: v.created_at,
    client_nome: v.clients?.nome || '', clients: v.clients || { nome: '' },
  }));

  const hojeObj = {
    faturamento: r2(fatHoje), vendas: vHoje.length,
    ticket: vHoje.length ? r2(fatHoje / vHoje.length) : 0,
    custo: r2(custoHoje), lucro: r2(fatHoje - custoHoje), margem: Math.round(margem(fatHoje, custoHoje)),
  };

  return {
    // campos antigos (quem ainda ler o formato velho continua funcionando)
    faturamento_dia: hojeObj.faturamento,
    vendas_dia: hojeObj.vendas,
    ticket_medio: hojeObj.ticket,
    faturamento_mes: r2(fatMes),
    custo_dia: hojeObj.custo,
    custo_mes: r2(custoMes),
    lucro_dia: hojeObj.lucro,
    lucro_mes: r2(fatMes - custoMes),
    estoque_total_kg: r2(totalKg),
    estoque_total_unidade: totalUn,
    valor_estoque: r2(valorEstoque),
    total_produtos: prods.length,
    total_clientes: totalClientes || 0,
    despesas_pendentes: r2(despesasPendentes),
    meta_diaria: metaDiaria,
    meta_percent: metaPercent,
    pagamentos: Object.fromEntries(vendasPorPagamento.map((p) => [p.forma_pagamento, p.total])),
    vendas_por_pagamento: vendasPorPagamento,
    ultimas_vendas: ultimasVendas,
    top_produtos: topProdutos,
    alertas_estoque: criticos.slice(0, 10),
    estoque_baixo: criticos.slice(0, 10),

    // formato novo
    hoje: hojeObj,
    ontem: { faturamento: r2(soma(vOntem)), vendas: vOntem.length },
    semana: { atual: r2(semanaAtual), anterior: r2(semanaAnterior) },
    mes: {
      faturamento: r2(fatMes), custo: r2(custoMes), lucro: r2(fatMes - custoMes),
      margem: Math.round(margem(fatMes, custoMes)),
      dias_passados: diasPassados, dias_no_mes: diasNoMes, projecao: r2(projecao),
      despesas_pendentes: r2(despesasPendentes),
    },
    serie,
    caixa,
    pedidos_novos: pedidosNovos,
    despesas_vencendo: despesasVencendo,
    estoque: { zerados, criticos: criticos.slice(0, 6), total_kg: r2(totalKg), total_un: totalUn, valor: r2(valorEstoque) },
  };
}
