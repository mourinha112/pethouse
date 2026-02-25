import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VERCEL_SUPABASE_URL || 'https://jkbugbsnmygvrejjurvi.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VERCEL_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprYnVnYnNubXlndnJlamp1cnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MzA3MTQsImV4cCI6MjA4NzUwNjcxNH0.Q_Yho42qCLyMCUVwvG1bW6OzB9TI-0VRA4U2QeH5YTk';

const empty = () => ({
  faturamento_dia: 0,
  vendas_dia: 0,
  ticket_medio: 0,
  faturamento_mes: 0,
  custo_dia: 0,
  custo_mes: 0,
  lucro_dia: 0,
  lucro_mes: 0,
  estoque_total_kg: 0,
  estoque_total_unidade: 0,
  valor_estoque: 0,
  total_produtos: 0,
  total_clientes: 0,
  despesas_pendentes: 0,
  meta_diaria: 500,
  meta_percent: 0,
  pagamentos: {},
  vendas_por_pagamento: [],
  ultimas_vendas: [],
  top_produtos: [],
  alertas_estoque: [],
  estoque_baixo: [],
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(200).json(empty());

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const todayStart = todayStr + 'T00:00:00.000Z';
    const todayEnd = todayStr + 'T23:59:59.999Z';
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    const { data: todaySales } = await supabase.from('sales').select('id, total, forma_pagamento').gte('created_at', todayStart).lte('created_at', todayEnd);
    const todayTotal = (todaySales || []).reduce((s, x) => s + (Number(x.total) || 0), 0);
    const todayCount = (todaySales || []).length;
    const ticketMedio = todayCount > 0 ? todayTotal / todayCount : 0;

    const { data: monthSales } = await supabase.from('sales').select('id, total').gte('created_at', monthStart);
    const monthTotal = (monthSales || []).reduce((s, x) => s + (Number(x.total) || 0), 0);

    const { data: products, error: pe } = await supabase.from('products').select('id, nome, marca, categoria, estoque_kg, estoque_unidade, preco_por_kg, preco_unitario, custo_unitario, custo_por_kg, custo_saco, peso_saco_kg').eq('ativo', 1);
    const prods = (products || []);
    const isRacao = (p) => !p.categoria || p.categoria === 'racao';

    const custoDasVendas = async (saleIds) => {
      if (!saleIds?.length) return 0;
      const { data: items } = await supabase.from('sale_items').select('product_id, quantidade_kg').in('sale_id', saleIds);
      let c = 0;
      for (const item of items || []) {
        const p = prods.find(x => x.id === item.product_id);
        if (!p) continue;
        const q = Number(item.quantidade_kg) || 0;
        if (!isRacao(p)) c += q * (Number(p.custo_unitario) || 0);
        else if (p.peso_saco_kg && p.custo_saco) c += (q / (p.peso_saco_kg || 1)) * (Number(p.custo_saco) || 0);
        else c += q * (Number(p.custo_por_kg) || 0);
      }
      return c;
    };
    const todayIds = (todaySales || []).map(s => s.id).filter(Boolean);
    const monthIds = (monthSales || []).map(s => s.id).filter(Boolean);
    const custoDia = await custoDasVendas(todayIds);
    const custoMes = await custoDasVendas(monthIds);
    const lucroDia = todayTotal - custoDia;
    const lucroMes = monthTotal - custoMes;

    const totalEstoqueKg = prods.reduce((s, p) => s + (isRacao(p) ? (Number(p.estoque_kg) || 0) : 0), 0);
    const totalEstoqueUn = prods.reduce((s, p) => s + (!isRacao(p) ? (Number(p.estoque_unidade) || 0) : 0), 0);
    const valorEstoque = prods.reduce((s, p) => {
      if (isRacao(p)) return s + ((Number(p.estoque_kg) || 0) * (Number(p.preco_por_kg) || 0));
      return s + ((Number(p.estoque_unidade) || 0) * (Number(p.preco_unitario) || 0));
    }, 0);

    let despesasPendentes = 0;
    try {
      const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const mesFim = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      const { data: noMes } = await supabase.from('expenses').select('id, valor, pago').gte('data_vencimento', mesInicio).lte('data_vencimento', mesFim);
      const { data: rec } = await supabase.from('expenses').select('id, valor, pago').or('recorrente.eq.1,recorrente.eq.true');
      const seen = new Set((noMes || []).map(e => e.id));
      const recUniq = (rec || []).filter(e => !seen.has(e.id) && seen.add(e.id));
      const todas = [...(noMes || []), ...recUniq];
      despesasPendentes = todas.filter(e => !e.pago).reduce((s, e) => s + (Number(e.valor) || 0), 0);
    } catch (_) {}

    const { data: metaData } = await supabase.from('settings').select('value').eq('key', 'meta_diaria').maybeSingle();
    const metaDiaria = parseFloat(metaData?.value || '500');
    const metaPercent = metaDiaria > 0 ? Math.min(100, Math.round((todayTotal / metaDiaria) * 100)) : 0;

    let ultimasVendas = [];
    const uv = await supabase.from('sales').select('*, clients(nome)').order('created_at', { ascending: false }).limit(5);
    if (uv.data && uv.data.length) ultimasVendas = uv.data;
    else {
      const uv2 = await supabase.from('sales').select('id, total, created_at, forma_pagamento').order('created_at', { ascending: false }).limit(5);
      ultimasVendas = (uv2.data || []).map(s => ({ ...s, clients: { nome: '' } }));
    }

    const paymentsObj = {};
    const paymentsQtd = {};
    (todaySales || []).forEach(s => {
      const f = s.forma_pagamento || 'outros';
      paymentsObj[f] = (paymentsObj[f] || 0) + (Number(s.total) || 0);
      paymentsQtd[f] = (paymentsQtd[f] || 0) + 1;
    });
    const vendasPorPagamento = Object.entries(paymentsObj).map(([forma_pagamento, total]) => ({ forma_pagamento, total, qtd: paymentsQtd[forma_pagamento] || 0 }));

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: sales30 } = await supabase.from('sales').select('id').gte('created_at', since);
    const sIds = (sales30 || []).map(s => s.id);
    let topProdutos = [];
    if (sIds.length > 0) {
      const { data: items } = await supabase.from('sale_items').select('product_id, quantidade_kg, subtotal').in('sale_id', sIds);
      const by = {};
      (items || []).forEach(it => {
        const id = it.product_id;
        if (!by[id]) by[id] = { product_id: id, quantidade_kg: 0, total: 0 };
        by[id].quantidade_kg += Number(it.quantidade_kg) || 0;
        by[id].total += Number(it.subtotal) || 0;
      });
      topProdutos = Object.values(by).sort((a, b) => b.total - a.total).slice(0, 5).map(p => ({
        nome: prods.find(x => x.id === p.product_id)?.nome || 'Produto',
        marca: prods.find(x => x.id === p.product_id)?.marca || '',
        total: p.total,
        total_kg: p.quantidade_kg,
      }));
    }

    const estoqueBaixo = prods
      .filter(p => isRacao(p) ? (Number(p.estoque_kg) || 0) < 10 : (Number(p.estoque_unidade) || 0) < (Number(p.estoque_minimo_unidade) || 1))
      .slice(0, 10)
      .map(p => isRacao(p)
        ? { id: p.id, nome: p.nome, marca: p.marca || '', tipo_estoque: 'kg', estoque_kg: p.estoque_kg, estoque_unidade: null, estoque_minimo_dias: p.estoque_minimo_dias || 7 }
        : { id: p.id, nome: p.nome, marca: p.marca || '', tipo_estoque: 'un', estoque_kg: null, estoque_unidade: p.estoque_unidade ?? 0, estoque_minimo_unidade: p.estoque_minimo_unidade || 0 });

    let totalClientes = 0;
    try {
      const { count } = await supabase.from('clients').select('*', { count: 'exact', head: true });
      totalClientes = count ?? 0;
    } catch (_) {}

    return res.status(200).json({
      faturamento_dia: todayTotal,
      vendas_dia: todayCount,
      ticket_medio: ticketMedio,
      faturamento_mes: monthTotal,
      custo_dia: custoDia,
      custo_mes: custoMes,
      lucro_dia: lucroDia,
      lucro_mes: lucroMes,
      estoque_total_kg: totalEstoqueKg,
      estoque_total_unidade: totalEstoqueUn,
      valor_estoque: valorEstoque,
      total_produtos: prods.length,
      total_clientes: totalClientes,
      despesas_pendentes: despesasPendentes,
      meta_diaria: metaDiaria,
      meta_percent: metaPercent,
      pagamentos: paymentsObj,
      vendas_por_pagamento: vendasPorPagamento,
      ultimas_vendas: ultimasVendas,
      top_produtos: topProdutos,
      alertas_estoque: estoqueBaixo,
      estoque_baixo: estoqueBaixo,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(200).json(empty());
  }
}
