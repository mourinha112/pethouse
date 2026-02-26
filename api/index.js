import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VERCEL_SUPABASE_URL || 'https://jkbugbsnmygvrejjurvi.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VERCEL_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprYnVnYnNubXlndnJlamp1cnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MzA3MTQsImV4cCI6MjA4NzUwNjcxNH0.Q_Yho42qCLyMCUVwvG1bW6OzB9TI-0VRA4U2QeH5YTk';

let supabase;
try {
  supabase = createClient(supabaseUrl, supabaseKey);
} catch (e) {
  console.error('Supabase init error:', e);
  supabase = null;
}

const hashPassword = (password) => {
  // Simple hash without crypto
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
};

function safePath(rawUrl) {
  const urlOnly = (rawUrl || '').split('?')[0].trim() || '';
  if (urlOnly.startsWith('http')) {
    try { return new URL(urlOnly).pathname; } catch (_) { return urlOnly; }
  }
  return urlOnly.startsWith('/') ? urlOnly : '/' + urlOnly;
}

const emptyDashboard = () => ({
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
  const method = req.method || 'GET';
  const rawUrl = req.url || req.path || '';
  const url = safePath(rawUrl);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  const isDashboard = url === '/api/dashboard' || url.endsWith('api/dashboard');
  const isAlerts = url === '/api/dashboard/alerts' || url.endsWith('api/dashboard/alerts');

  try {
    if (!supabase && (isDashboard || isAlerts)) {
      if (isAlerts) return res.status(200).json([]);
      return res.status(200).json(emptyDashboard());
    }
    // Auth check
    if (url === '/api/auth/check' || url === '/api/auth') {
      try {
        const { data, error } = await supabase.from('users').select('id').limit(1);
        if (error) {
          console.error('Auth check error:', error);
          return res.json({ hasUsers: false, error: error.message });
        }
        return res.json({ hasUsers: data?.length > 0 });
      } catch (e) {
        return res.json({ hasUsers: false, error: e.message });
      }
    }
    
    // Auth login/register
    if (url.includes('/auth/login') || url.includes('/auth/setup')) {
      if (method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { action, login, senha, nome } = body;
      
      if (action === 'login') {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('login', login)
          .eq('senha_hash', hashPassword(senha))
          .single();

        if (error || !data) {
          return res.status(401).json({ error: 'Login ou senha incorretos' });
        }

        const token = Buffer.from(`${data.id}:${Date.now()}`).toString('base64');
        return res.json({
          token,
          user: { id: data.id, nome: data.nome, login: data.login, role: data.role }
        });
      }

      if (action === 'register') {
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('login', login)
          .single();

        if (existing) {
          return res.status(400).json({ error: 'Login já existe' });
        }

        const { data: newUser, error } = await supabase
          .from('users')
          .insert([{ nome: nome || login, login, senha_hash: hashPassword(senha), role: 'admin' }])
          .select()
          .single();

        if (error) throw error;

        const token = Buffer.from(`${newUser.id}:${Date.now()}`).toString('base64');
        return res.json({
          token,
          user: { id: newUser.id, nome: newUser.nome, login: newUser.login, role: newUser.role }
        });
      }
    }

    // Dashboard
    if (url === '/api/dashboard' && method === 'GET') {
      try {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const todayStart = todayStr + 'T00:00:00.000Z';
        const todayEnd = todayStr + 'T23:59:59.999Z';
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

        const { data: todaySales, error: salesError } = await supabase
          .from('sales')
          .select('id, total, forma_pagamento, created_at')
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd);

        if (salesError) {
          console.error('Dashboard sales error:', salesError);
        }

        const todayTotal = (todaySales || []).reduce((sum, s) => sum + (s.total || 0), 0);
        const todayCount = todaySales?.length || 0;
        const ticketMedio = todayCount > 0 ? todayTotal / todayCount : 0;

        const { data: monthSales } = await supabase
          .from('sales')
          .select('id, total')
          .gte('created_at', monthStart);
        const monthTotal = monthSales?.reduce((sum, s) => sum + (s.total || 0), 0) || 0;

        let products;
        const productsFull = await supabase
          .from('products')
          .select('id, nome, marca, categoria, estoque_kg, estoque_unidade, preco_por_kg, preco_unitario, custo_unitario, custo_por_kg, custo_saco, peso_saco_kg')
          .eq('ativo', 1);
        if (productsFull.error) {
          const productsMin = await supabase
            .from('products')
            .select('id, nome, marca, categoria, estoque_kg, estoque_unidade, preco_por_kg, preco_unitario, custo_unitario')
            .eq('ativo', 1);
          if (productsMin.error) {
            console.error('Dashboard products error:', productsFull.error);
            products = [];
          } else {
            products = productsMin.data;
          }
        } else {
          products = productsFull.data;
        }
        if (!Array.isArray(products)) products = [];

        const isRacao = (p) => !p.categoria || p.categoria === 'racao';

        async function custoDasVendas(saleIds) {
          if (!saleIds?.length) return 0;
          const { data: items, error: itemsErr } = await supabase.from('sale_items').select('product_id, quantidade_kg').in('sale_id', saleIds);
          if (itemsErr) return 0;
          let custo = 0;
          for (const item of items || []) {
            const prod = products?.find(x => x.id === item.product_id);
            if (!prod) continue;
            const qty = item.quantidade_kg || 0;
            if (!isRacao(prod)) {
              custo += qty * (prod.custo_unitario || 0);
            } else if (prod.peso_saco_kg && prod.custo_saco) {
              const numSacos = qty / (prod.peso_saco_kg || 1);
              custo += numSacos * (prod.custo_saco || 0);
            } else {
              custo += qty * (prod.custo_por_kg || 0);
            }
          }
          return custo;
        }

        const todaySaleIds = (todaySales || []).map(s => s.id).filter(Boolean);
        const monthSaleIds = (monthSales || []).map(s => s.id).filter(Boolean);
        const custoDia = await custoDasVendas(todaySaleIds);
        const custoMes = await custoDasVendas(monthSaleIds);
        const lucroDia = todayTotal - custoDia;
        const lucroMes = monthTotal - custoMes;

        const totalEstoqueKg = products?.reduce((sum, p) => sum + (isRacao(p) ? (p.estoque_kg || 0) : 0), 0) || 0;
        const totalEstoqueUn = products?.reduce((sum, p) => sum + (!isRacao(p) ? (p.estoque_unidade ?? 0) : 0), 0) || 0;
        const valorEstoque = products?.reduce((sum, p) => {
          if (isRacao(p)) return sum + ((p.estoque_kg || 0) * (p.preco_por_kg || 0));
          return sum + ((p.estoque_unidade ?? 0) * (p.preco_unitario || 0));
        }, 0) || 0;

        const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const mesFim = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        let despesasPendentes = 0;
        try {
          const { data: noMes } = await supabase.from('expenses').select('id, valor, pago').gte('data_vencimento', mesInicio).lte('data_vencimento', mesFim);
          const { data: rec } = await supabase.from('expenses').select('id, valor, pago').or('recorrente.eq.1,recorrente.eq.true');
          const seen = new Set((noMes || []).map(e => e.id));
          const recUniq = (rec || []).filter(e => !seen.has(e.id) && seen.add(e.id));
          const todasDoMes = [...(noMes || []), ...recUniq];
          despesasPendentes = todasDoMes.filter(e => !e.pago).reduce((s, e) => s + (Number(e.valor) || 0), 0);
        } catch (_) {}

        const { data: metaData } = await supabase.from('settings').select('value').eq('key', 'meta_diaria').maybeSingle();
        const metaDiaria = parseFloat(metaData?.value || '500');
        const metaPercent = metaDiaria > 0 ? Math.min(100, Math.round((todayTotal / metaDiaria) * 100)) : 0;

        let ultimasVendas = [];
        const uvRes = await supabase.from('sales').select('*, clients(nome)').order('created_at', { ascending: false }).limit(5);
        if (uvRes.error) {
          const uvMin = await supabase.from('sales').select('id, total, created_at, forma_pagamento').order('created_at', { ascending: false }).limit(5);
          ultimasVendas = (uvMin.data || []).map(s => ({ ...s, clients: { nome: '' } }));
        } else {
          ultimasVendas = uvRes.data || [];
        }

        const paymentsObj = {};
        const paymentsQtd = {};
        (todaySales || []).forEach(s => {
          const forma = s.forma_pagamento || 'outros';
          paymentsObj[forma] = (paymentsObj[forma] || 0) + (s.total || 0);
          paymentsQtd[forma] = (paymentsQtd[forma] || 0) + 1;
        });
        const vendasPorPagamento = Object.entries(paymentsObj).map(([forma_pagamento, total]) => ({
          forma_pagamento,
          total,
          qtd: paymentsQtd[forma_pagamento] || 0,
        }));

        const last30 = new Date();
        last30.setDate(last30.getDate() - 30);
        const since = last30.toISOString();
        const { data: sales30 } = await supabase.from('sales').select('id').gte('created_at', since);
        const saleIds = (sales30 || []).map(s => s.id);
        let topProdutos = [];
        if (saleIds.length > 0) {
          const { data: items } = await supabase.from('sale_items').select('product_id, quantidade_kg, subtotal').in('sale_id', saleIds);
          const byProduct = {};
          (items || []).forEach(item => {
            const id = item.product_id;
            if (!byProduct[id]) byProduct[id] = { product_id: id, quantidade_kg: 0, total: 0 };
            byProduct[id].quantidade_kg += item.quantidade_kg || 0;
            byProduct[id].total += item.subtotal || 0;
          });
          topProdutos = Object.values(byProduct)
            .sort((a, b) => b.total - a.total)
            .slice(0, 5)
            .map(p => {
              const prod = products?.find(x => x.id === p.product_id);
              return {
                nome: prod?.nome || 'Produto',
                marca: prod?.marca || '',
                total: p.total,
                total_kg: p.quantidade_kg || 0,
              };
            });
        }

        const isRacaoAlert = (p) => !p.categoria || p.categoria === 'racao';
        const estoqueBaixo = (products || [])
          .filter(p => isRacaoAlert(p) ? (p.estoque_kg || 0) < 10 : (p.estoque_unidade ?? 0) < (p.estoque_minimo_unidade ?? 1))
          .slice(0, 10)
          .map(p => isRacaoAlert(p)
            ? { id: p.id, nome: p.nome, marca: p.marca || '', tipo_estoque: 'kg', estoque_kg: p.estoque_kg, estoque_unidade: null, estoque_minimo_dias: p.estoque_minimo_dias || 7 }
            : { id: p.id, nome: p.nome, marca: p.marca || '', tipo_estoque: 'un', estoque_kg: null, estoque_unidade: p.estoque_unidade ?? 0, estoque_minimo_unidade: p.estoque_minimo_unidade || 0 });

        let totalClientes = 0;
        try {
          const { count } = await supabase.from('clients').select('*', { count: 'exact', head: true });
          totalClientes = count ?? 0;
        } catch (_) {}

        return res.json({
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
          total_produtos: products?.length || 0,
          total_clientes: totalClientes,
          despesas_pendentes: despesasPendentes,
          meta_diaria: metaDiaria,
          meta_percent: metaPercent,
          pagamentos: paymentsObj,
          vendas_por_pagamento: vendasPorPagamento,
          ultimas_vendas: ultimasVendas,
          top_produtos: topProdutos,
          alertas_estoque: estoqueBaixo || [],
          estoque_baixo: estoqueBaixo || [],
        });
      } catch (err) {
        console.error('Dashboard error:', err);
        return res.status(200).json({
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
      }
    }

    // Dashboard - alerts
    if (url === '/api/dashboard/alerts' && method === 'GET') {
      try {
        let products;
        const { data: dataFull, error: prodErr } = await supabase
          .from('products')
          .select('id, nome, marca, estoque_kg, estoque_minimo_dias, categoria, estoque_unidade, estoque_minimo_unidade')
          .eq('ativo', 1);

        if (prodErr) {
          const { data: dataMin, error: minErr } = await supabase
            .from('products')
            .select('id, nome, estoque_kg')
            .eq('ativo', 1);
          if (minErr) {
            console.error('Dashboard alerts products error:', prodErr);
            return res.status(200).json([]);
          }
          products = (dataMin || []).map(p => ({ ...p, marca: '', estoque_minimo_dias: 7, categoria: 'racao', estoque_unidade: 0, estoque_minimo_unidade: 0 }));
        } else {
          products = dataFull || [];
        }

        const last30Days = new Date();
        last30Days.setDate(last30Days.getDate() - 30);
        const since = last30Days.toISOString();

        const { data: salesList } = await supabase
          .from('sales')
          .select('id')
          .gte('created_at', since);

        const saleIds = (salesList || []).map(s => s.id);
        const salesByProduct = {};

        if (saleIds.length > 0) {
          const { data: items } = await supabase
            .from('sale_items')
            .select('product_id, quantidade_kg')
            .in('sale_id', saleIds);
          (items || []).forEach(item => {
            salesByProduct[item.product_id] = (salesByProduct[item.product_id] || 0) + (item.quantidade_kg || 0);
          });
        }

        const isRacao = (p) => !p.categoria || p.categoria === 'racao';
        const alerts = products.filter(p => {
          const isR = isRacao(p);
          if (isR) {
            const totalVendido30d = salesByProduct[p.id] || 0;
            const mediaDiaria = totalVendido30d / 30;
            const diasEstoque = mediaDiaria > 0 ? (p.estoque_kg || 0) / mediaDiaria : 999;
            return (p.estoque_kg || 0) > 0 && diasEstoque < (p.estoque_minimo_dias ?? 7);
          }
          return (p.estoque_unidade ?? 0) > 0 && (p.estoque_unidade ?? 0) < (p.estoque_minimo_unidade || 1);
        }).map(p => {
          const isR = isRacao(p);
          return isR
            ? { id: p.id, nome: p.nome, marca: p.marca || '', estoque_kg: p.estoque_kg, estoque_minimo_dias: p.estoque_minimo_dias ?? 7 }
            : { id: p.id, nome: p.nome, marca: p.marca || '', estoque_unidade: p.estoque_unidade ?? 0, estoque_minimo_unidade: p.estoque_minimo_unidade ?? 0 };
        });

        return res.json(alerts);
      } catch (err) {
        console.error('Dashboard alerts error:', err);
        return res.status(200).json([]);
      }
    }

    // Products - list
    if (url === '/api/products' && method === 'GET') {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('ativo', 1)
          .order('nome');
        
        if (error) {
          console.error('Products list error:', error);
          return res.status(500).json({ error: 'Erro ao buscar produtos' });
        }
        return res.json(data || []);
      } catch (err) {
        console.error('Products error:', err);
        return res.status(500).json({ error: err.message });
      }
    }

    // Products - search
    if (url.includes('/products/search/') && method === 'GET') {
      const term = url.split('/products/search/')[1];
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('ativo', 1)
        .or(`nome.ilike.%${term}%,marca.ilike.%${term}%`)
        .limit(20);
      
      if (error) throw error;
      return res.json(data || []);
    }

    // Products - create
    if (url === '/api/products' && method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { data, error } = await supabase.from('products').insert([body]).select();
      if (error) throw error;
      return res.status(201).json(data[0]);
    }

    // Products - update
    if (url.includes('/products/') && method === 'PUT') {
      const id = url.split('/products/')[1];
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { data, error } = await supabase
        .from('products')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select();
      if (error) throw error;
      return res.json(data[0]);
    }

    // Products - delete
    if (url.includes('/products/') && method === 'DELETE') {
      const id = url.split('/products/')[1].split('/')[0];
      const { error } = await supabase
        .from('products')
        .update({ ativo: 0 })
        .eq('id', id);
      if (error) throw error;
      return res.json({ success: true });
    }

    // Products - entrada de estoque (kg ou unidade)
    if (url.match(/^\/api\/products\/\d+\/stock-entry$/) && method === 'POST') {
      try {
        const id = url.replace(/^\/api\/products\//, '').replace(/\/stock-entry$/, '');
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { data: product, error: getErr } = await supabase.from('products').select('categoria, estoque_kg, estoque_unidade').eq('id', id).single();
        if (getErr || !product) return res.status(404).json({ error: 'Produto não encontrado' });
        const isUnit = product.categoria && product.categoria !== 'racao';
        if (isUnit && (body.quantidade_unidade != null)) {
          const qty = parseInt(body.quantidade_unidade, 10) || 0;
          if (qty <= 0) return res.status(400).json({ error: 'Quantidade inválida' });
          const newUn = (product.estoque_unidade || 0) + qty;
          await supabase.from('products').update({ estoque_unidade: newUn }).eq('id', id);
          await supabase.from('stock_movements').insert([{ product_id: id, tipo: 'entrada', quantidade_kg: qty, motivo: body.motivo || 'Entrada manual' }]);
          return res.json({ success: true, estoque_unidade: newUn });
        }
        const qtyKg = parseFloat(body.quantidade_kg) || 0;
        if (qtyKg <= 0) return res.status(400).json({ error: 'Quantidade inválida' });
        const newKg = (product.estoque_kg || 0) + qtyKg;
        await supabase.from('products').update({ estoque_kg: newKg }).eq('id', id);
        await supabase.from('stock_movements').insert([{ product_id: id, tipo: 'entrada', quantidade_kg: qtyKg, motivo: body.motivo || 'Entrada manual' }]);
        return res.json({ success: true, estoque_kg: newKg });
      } catch (err) {
        console.error('Stock entry error:', err);
        return res.status(500).json({ error: err.message });
      }
    }

    // Sales - list
    if (url === '/api/sales' && method === 'GET') {
      try {
        let query = {};
        try {
          if (rawUrl.includes('?')) {
            query = Object.fromEntries(new URLSearchParams(rawUrl.split('?')[1]));
          }
        } catch (_) {}
        const dataInicio = query.data_inicio || new Date().toISOString().split('T')[0];
        const dataFim = query.data_fim || dataInicio;
        const { data, error } = await supabase
          .from('sales')
          .select('*, clients(nome)')
          .gte('created_at', dataInicio)
          .lte('created_at', dataFim + 'T23:59:59.999Z')
          .order('created_at', { ascending: false });
        if (error) {
          console.error('Sales list error:', error);
        }
        const list = (data || []).map(s => ({ ...s, client_nome: s.clients?.nome || null }));
        return res.json(list);
      } catch (err) {
        console.error('Sales error:', err);
        return res.json([]);
      }
    }

    // Sales - detalhe por id (para relatório / reimprimir)
    if (url.match(/^\/api\/sales\/\d+$/) && method === 'GET') {
      try {
        const id = url.replace(/^\/api\/sales\//, '');
        const { data: sale, error: e1 } = await supabase.from('sales').select('*, clients(nome)').eq('id', id).single();
        if (e1 || !sale) return res.status(404).json({ error: 'Venda não encontrada' });
        const { data: items, error: e2 } = await supabase.from('sale_items').select('*, products(nome)').eq('sale_id', id);
        if (e2) throw e2;
        const itemsMap = (items || []).map(it => ({
          ...it,
          product_nome: it.products?.nome || '',
        }));
        return res.json({
          ...sale,
          client_nome: sale.clients?.nome || null,
          items: itemsMap,
        });
      } catch (err) {
        console.error('Sales detail error:', err);
        return res.status(500).json({ error: err.message });
      }
    }

    // Sales - create
    if (url === '/api/sales' && method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { items, ...saleData } = body;

      // Garantir que valor_total existe - calcular dos itens se não enviado
      if (!saleData.valor_total && items && items.length > 0) {
        const subtotalItens = items.reduce((sum, it) => sum + (it.subtotal || 0), 0);
        saleData.valor_total = subtotalItens - (saleData.desconto || 0);
      }

      const { data: newSale, error: saleError } = await supabase
        .from('sales')
        .insert([saleData])
        .select();

      if (saleError) throw saleError;
      const saleId = newSale[0].id;

      for (const item of items) {
        const { data: prod } = await supabase.from('products').select('categoria, preco_por_kg, preco_saco_fechado, peso_saco_kg, preco_unitario, estoque_kg, estoque_unidade').eq('id', item.product_id).single();
        const isUnit = prod && prod.categoria && prod.categoria !== 'racao';
        let precoUnit = item.preco_unitario;
        let subtotal = item.subtotal;
        if (precoUnit == null || subtotal == null) {
          if (isUnit) {
            precoUnit = prod.preco_unitario || 0;
            subtotal = (item.quantidade_kg || 0) * precoUnit;
          } else if (item.tipo_venda === 'saco') {
            precoUnit = prod.preco_saco_fechado || 0;
            const numSacos = Math.round((item.quantidade_kg || 0) / (prod.peso_saco_kg || 1));
            subtotal = numSacos * precoUnit;
          } else {
            precoUnit = prod.preco_por_kg || 0;
            subtotal = (item.quantidade_kg || 0) * precoUnit;
          }
        }
        await supabase.from('sale_items').insert([{
          sale_id: saleId,
          product_id: item.product_id,
          tipo_venda: item.tipo_venda,
          quantidade_kg: item.quantidade_kg,
          preco_unitario: precoUnit,
          subtotal
        }]);

        const qtyKg = item.tipo_venda === 'saco' ? item.quantidade_kg * (item.peso_saco || prod?.peso_saco_kg || 1) : item.quantidade_kg;
        if (isUnit) {
          const un = Math.round(item.quantidade_kg || 0);
          const newUn = Math.max(0, (prod.estoque_unidade || 0) - un);
          await supabase.from('products').update({ estoque_unidade: newUn }).eq('id', item.product_id);
          await supabase.from('stock_movements').insert([{ product_id: item.product_id, tipo: 'saida', quantidade_kg: -un, motivo: `Venda #${saleId}`, sale_id: saleId }]);
        } else {
          const newKg = Math.max(0, (prod.estoque_kg || 0) - qtyKg);
          await supabase.from('products').update({ estoque_kg: newKg }).eq('id', item.product_id);
          await supabase.from('stock_movements').insert([{ product_id: item.product_id, tipo: 'saida', quantidade_kg: -qtyKg, motivo: `Venda #${saleId}`, sale_id: saleId }]);
        }
      }

      return res.status(201).json(newSale[0]);
    }

    // Clients
    if (url === '/api/clients') {
      try {
        if (method === 'GET') {
          const { data, error } = await supabase.from('clients').select('*').order('nome');
          if (error) {
            console.error('Clients list error:', error);
            return res.status(500).json({ error: 'Erro ao buscar clientes' });
          }
          return res.json(data || []);
        }
        if (method === 'POST') {
          const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
          const { data, error } = await supabase.from('clients').insert([body]).select();
          if (error) {
            console.error('Clients insert error:', error);
            return res.status(500).json({ error: 'Erro ao cadastrar cliente' });
          }
          return res.status(201).json(data[0]);
        }
      } catch (err) {
        console.error('Clients error:', err);
        return res.status(500).json({ error: err.message });
      }
    }

    // Expenses - summary (por mês: total, pago, pendente, por_categoria)
    if ((url === '/api/expenses/summary' || url === '/api/expenses/summary/') && method === 'GET') {
      try {
        let qs = {};
        try { if (rawUrl.includes('?')) qs = Object.fromEntries(new URLSearchParams(rawUrl.split('?')[1])); } catch (_) {}
        const mes = qs.mes || new Date().toISOString().slice(0, 7);
        const [y, m] = mes.split('-').map(Number);
        const mesInicio = new Date(y, m - 1, 1).toISOString().split('T')[0];
        const mesFim = new Date(y, m, 0).toISOString().split('T')[0];
        let noMes = [];
        let rec = [];
        try { const { data } = await supabase.from('expenses').select('id, valor, pago, categoria').gte('data_vencimento', mesInicio).lte('data_vencimento', mesFim); noMes = data || []; } catch (_) {}
        try { const { data } = await supabase.from('expenses').select('id, valor, pago, categoria').or('recorrente.eq.1,recorrente.eq.true'); rec = data || []; } catch (_) {}
        const seen = new Set(noMes.map(e => e.id));
        const recUniq = rec.filter(e => !seen.has(e.id) && seen.add(e.id));
        const items = [...noMes, ...recUniq];
        const total = items.reduce((s, e) => s + (Number(e.valor) || 0), 0);
        const pago = items.filter(e => e.pago).reduce((s, e) => s + (Number(e.valor) || 0), 0);
        const pendente = total - pago;
        const porCat = {};
        items.forEach(e => { const c = e.categoria || 'outros'; porCat[c] = (porCat[c] || 0) + (Number(e.valor) || 0); });
        const por_categoria = Object.entries(porCat).map(([categoria, total]) => ({ categoria, total }));
        return res.json({ total, pago, pendente, por_categoria });
      } catch (err) {
        console.error('Expenses summary error:', err);
        return res.json({ total: 0, pago: 0, pendente: 0, por_categoria: [] });
      }
    }

    // Expenses - lista (filtro por mês: despesas do mês + recorrentes)
    if (url === '/api/expenses' || url === '/api/expenses/') {
      if (method === 'GET') {
        try {
          let qs = {};
          try { if (rawUrl.includes('?')) qs = Object.fromEntries(new URLSearchParams(rawUrl.split('?')[1])); } catch (_) {}
          const mes = qs.mes || new Date().toISOString().slice(0, 7);
          const [y, m] = mes.split('-').map(Number);
          const mesInicio = new Date(y, m - 1, 1).toISOString().split('T')[0];
          const mesFim = new Date(y, m, 0).toISOString().split('T')[0];
          let noMes = [];
          let rec = [];
          try { const { data } = await supabase.from('expenses').select('*').gte('data_vencimento', mesInicio).lte('data_vencimento', mesFim).order('data_vencimento', { ascending: true }); noMes = data || []; } catch (_) {}
          try { const { data } = await supabase.from('expenses').select('*').or('recorrente.eq.1,recorrente.eq.true').order('data_vencimento', { ascending: true }); rec = data || []; } catch (_) {}
          const seen = new Set(noMes.map(e => e.id));
          const noMesDesc = new Set(noMes.map(e => `${e.descricao}|${e.categoria || ''}`));
          const recUniq = rec.filter(e => {
            if (seen.has(e.id)) return false;
            const expMes = e.data_vencimento ? e.data_vencimento.slice(0, 7) : '';
            if (expMes === mes) return seen.add(e.id);
            if (noMesDesc.has(`${e.descricao}|${e.categoria || ''}`)) return false;
            return seen.add(e.id);
          });
          let list = [...noMes, ...recUniq].map(e => {
            const isRec = e.recorrente === 1 || e.recorrente === true;
            const expMes = e.data_vencimento ? e.data_vencimento.slice(0, 7) : '';
            if (isRec && expMes !== mes) return { ...e, pago: 0, data_vencimento: mesInicio };
            return e;
          }).sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || ''));
          return res.json(list);
        } catch (err) {
          console.error('Expenses list error:', err);
          return res.json([]);
        }
      }
      if (method === 'POST') {
        try {
          const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
          const row = {
            descricao: body.descricao,
            categoria: body.categoria || 'outros',
            valor: Number(body.valor) || 0,
            pago: body.pago === true || body.pago === 1 ? 1 : 0,
            recorrente: body.recorrente === true || body.recorrente === 1 ? 1 : 0,
          };
          row.data_vencimento = (body.data_vencimento && body.data_vencimento !== '')
            ? body.data_vencimento
            : new Date().toISOString().slice(0, 7) + '-01';
          const { data, error } = await supabase.from('expenses').insert([row]).select();
          if (error) console.error('Expenses insert error:', error);
          return res.status(201).json(data?.[0] || {});
        } catch (err) {
          console.error('Expenses insert error:', err);
          return res.status(201).json({});
        }
      }
    }

    // Expenses - toggle pago (marcar como pago/pendente). Se recorrente e mes diferente, cria cópia do mês.
    if (url.match(/^\/api\/expenses\/\d+\/toggle-pago$/) && method === 'PUT') {
      try {
        const id = url.replace(/^\/api\/expenses\//, '').replace(/\/toggle-pago$/, '');
        const qs = rawUrl.includes('?') ? new URLSearchParams(rawUrl.split('?')[1]) : null;
        const mesParam = qs && qs.get('mes');
        const { data: expense, error: getErr } = await supabase.from('expenses').select('*').eq('id', id).single();
        if (getErr || !expense) return res.status(404).json({ error: 'Despesa não encontrada' });
        const expMes = expense.data_vencimento ? expense.data_vencimento.slice(0, 7) : '';
        const isRec = expense.recorrente === 1 || expense.recorrente === true;
        const mes = mesParam || expMes || new Date().toISOString().slice(0, 7);
        if (isRec && expMes !== mes) {
          const mesInicio = mes + '-01';
          const { data: existing } = await supabase.from('expenses').select('id, pago').eq('descricao', expense.descricao).eq('categoria', expense.categoria || 'outros').eq('data_vencimento', mesInicio).maybeSingle();
          if (existing) {
            const novoPago = existing.pago ? 0 : 1;
            const { data: updated } = await supabase.from('expenses').update({ pago: novoPago, data_pagamento: novoPago ? new Date().toISOString().split('T')[0] : null }).eq('id', existing.id).select().single();
            return res.json(updated);
          }
          const { data: newRow, error: insErr } = await supabase.from('expenses').insert([{
            descricao: expense.descricao,
            categoria: expense.categoria || 'outros',
            valor: expense.valor,
            data_vencimento: mesInicio,
            pago: 1,
            data_pagamento: new Date().toISOString().split('T')[0],
            recorrente: 0,
            tipo_recorrencia: expense.tipo_recorrencia || 'nenhum',
          }]).select().single();
          if (insErr) throw insErr;
          return res.json(newRow);
        }
        const novoPago = expense.pago ? 0 : 1;
        const { data, error } = await supabase.from('expenses').update({ pago: novoPago, data_pagamento: novoPago ? new Date().toISOString().split('T')[0] : null }).eq('id', id).select().single();
        if (error) throw error;
        return res.json(data);
      } catch (err) {
        console.error('Expenses toggle-pago error:', err);
        return res.status(500).json({ error: err.message });
      }
    }

    // Expenses - delete
    if (url.match(/^\/api\/expenses\/\d+$/) && method === 'DELETE') {
      try {
        const id = url.replace(/^\/api\/expenses\//, '');
        const { error } = await supabase.from('expenses').delete().eq('id', id);
        if (error) throw error;
        return res.json({ success: true });
      } catch (err) {
        console.error('Expenses delete error:', err);
        return res.status(500).json({ error: err.message });
      }
    }

    // Cashier - current session (retorna formato esperado pelo front: open, session, resumo, por_pagamento, movements)
    if (url === '/api/cashier/current') {
      try {
        const { data: session, error } = await supabase
          .from('cash_sessions')
          .select('*')
          .eq('status', 'aberto')
          .order('opened_at', { ascending: false })
          .limit(1)
          .single();
        
        if (error && error.code !== 'PGRST116') {
          console.error('Cashier current error:', error);
          throw error;
        }
        
        if (!session) return res.json(null);
        
        const { data: movements } = await supabase
          .from('cash_movements')
          .select('*')
          .eq('session_id', session.id)
          .order('created_at', { ascending: false });
        const movs = movements || [];
        
        const openedAt = session.opened_at;
        const { data: sessionSales } = await supabase
          .from('sales')
          .select('total, forma_pagamento')
          .gte('created_at', openedAt);
        const salesList = sessionSales || [];
        const totalVendas = salesList.reduce((s, v) => s + (Number(v.total) || 0), 0);
        const porPagamento = {};
        salesList.forEach(v => {
          const fp = v.forma_pagamento || 'dinheiro';
          porPagamento[fp] = (porPagamento[fp] || 0) + (Number(v.total) || 0);
        });
        const suprimentos = movs.filter(m => m.tipo === 'suprimento').reduce((s, m) => s + (Number(m.valor) || 0), 0);
        const sangrias = movs.filter(m => m.tipo === 'sangria').reduce((s, m) => s + (Number(m.valor) || 0), 0);
        const saldoInicial = Number(session.saldo_inicial) || 0;
        const saldoEstimado = saldoInicial + totalVendas + suprimentos - sangrias;
        
        const payload = {
          open: true,
          session: { ...session, id: session.id },
          resumo: {
            total_vendas: totalVendas,
            total_recebido: totalVendas,
            saldo_inicial: saldoInicial,
            suprimentos,
            sangrias,
            saldo_estimado: saldoEstimado,
            lucro_bruto: totalVendas
          },
          por_pagamento: Object.entries(porPagamento).map(([forma_pagamento, total]) => ({ forma_pagamento, total })),
          movements: movs
        };
        return res.json(payload);
      } catch (err) {
        console.error('Cashier error:', err);
        return res.status(500).json({ error: err.message });
      }
    }

    // Cashier - open
    if (url === '/api/cashier/open' && method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { saldo_inicial } = body;
      
      const { data: existing } = await supabase
        .from('cash_sessions')
        .select('id')
        .eq('status', 'aberto')
        .single();
      
      if (existing) {
        return res.status(400).json({ error: 'Já existe uma sessão aberta' });
      }
      
      const { data, error } = await supabase
        .from('cash_sessions')
        .insert([{ saldo_inicial: saldo_inicial || 0, status: 'aberto' }])
        .select()
        .single();
      
      if (error) throw error;
      
      await supabase.from('cash_movements').insert([{
        session_id: data.id,
        tipo: 'abertura',
        valor: saldo_inicial || 0,
        descricao: 'Abertura de caixa'
      }]);
      
      return res.json(data);
    }

    // Cashier - close (aceita só observacao; id e saldo_final sao obtidos da sessao aberta)
    if (url === '/api/cashier/close' && method === 'POST') {
      try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { id: bodyId, saldo_final: bodySaldo, observacao } = body;
        
        const { data: openSession, error: findErr } = await supabase
          .from('cash_sessions')
          .select('*')
          .eq('status', 'aberto')
          .single();
        if (findErr || !openSession) {
          return res.status(400).json({ error: 'Nenhuma sessão de caixa aberta' });
        }
        const sessionId = bodyId || openSession.id;
        const { data: movs } = await supabase
          .from('cash_movements')
          .select('tipo, valor')
          .eq('session_id', sessionId);
        const salesRes = await supabase
          .from('sales')
          .select('total')
          .gte('created_at', openSession.opened_at);
        const totalVendas = (salesRes.data || []).reduce((s, v) => s + (Number(v.total) || 0), 0);
        const suprimentos = (movs || []).filter(m => m.tipo === 'suprimento').reduce((s, m) => s + (Number(m.valor) || 0), 0);
        const sangrias = (movs || []).filter(m => m.tipo === 'sangria').reduce((s, m) => s + (Number(m.valor) || 0), 0);
        const saldoFinal = bodySaldo != null ? Number(bodySaldo) : (Number(openSession.saldo_inicial) || 0) + totalVendas + suprimentos - sangrias;
        
        await supabase.from('cash_movements').insert([{
          session_id: sessionId,
          tipo: 'fechamento',
          valor: saldoFinal,
          descricao: 'Fechamento de caixa'
        }]);
        
        const { data, error } = await supabase
          .from('cash_sessions')
          .update({ status: 'fechado', saldo_final: saldoFinal, observacao_fechamento: observacao || '', closed_at: new Date().toISOString() })
          .eq('id', sessionId)
          .select()
          .single();
        if (error) throw error;
        return res.json(data);
      } catch (err) {
        console.error('Cashier close error:', err);
        return res.status(500).json({ error: err.message });
      }
    }

    // Cashier - movement
    if (url === '/api/cashier/movement' && method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { session_id, tipo, valor, descricao } = body;
      
      const { data, error } = await supabase
        .from('cash_movements')
        .insert([{ session_id, tipo, valor, descricao }])
        .select()
        .single();
      
      if (error) throw error;
      return res.json(data);
    }

    // Cashier - history (com total_vendas e qtd_vendas por sessao)
    if (url === '/api/cashier/history') {
      try {
        const { data: sessions, error } = await supabase
          .from('cash_sessions')
          .select('*')
          .eq('status', 'fechado')
          .order('closed_at', { ascending: false })
          .limit(20);
        if (error) throw error;
        const list = sessions || [];
        const withTotals = await Promise.all(list.map(async (s) => {
          const { data: sales } = await supabase
            .from('sales')
            .select('total')
            .gte('created_at', s.opened_at)
            .lte('created_at', (s.closed_at || new Date().toISOString()));
          const total = (sales || []).reduce((a, v) => a + (Number(v.total) || 0), 0);
          return { ...s, total_vendas: total, qtd_vendas: (sales || []).length };
        }));
        return res.json(withTotals);
      } catch (err) {
        console.error('Cashier history error:', err);
        return res.status(500).json({ error: err.message });
      }
    }

    // Cashier - detalhe de sessao por id (para caixas anteriores)
    if (url.match(/^\/api\/cashier\/\d+$/) && method === 'GET') {
      try {
        const id = url.replace(/^\/api\/cashier\//, '');
        const { data: session, error: sessErr } = await supabase
          .from('cash_sessions')
          .select('*')
          .eq('id', id)
          .single();
        if (sessErr || !session) return res.status(404).json({ error: 'Sessão não encontrada' });
        const { data: movements } = await supabase
          .from('cash_movements')
          .select('*')
          .eq('session_id', session.id)
          .order('created_at', { ascending: true });
        const movs = movements || [];
        const { data: sessionSales } = await supabase
          .from('sales')
          .select('total, forma_pagamento')
          .gte('created_at', session.opened_at)
          .lte('created_at', (session.closed_at || new Date().toISOString()));
        const salesList = sessionSales || [];
        const totalVendas = salesList.reduce((s, v) => s + (Number(v.total) || 0), 0);
        const porPagamento = {};
        salesList.forEach(v => {
          const fp = v.forma_pagamento || 'dinheiro';
          porPagamento[fp] = (porPagamento[fp] || 0) + (Number(v.total) || 0);
        });
        const payload = {
          session,
          resumo: {
            total_vendas: totalVendas,
            saldo_inicial: Number(session.saldo_inicial) || 0,
            saldo_final: Number(session.saldo_final) ?? 0
          },
          por_pagamento: Object.entries(porPagamento).map(([forma_pagamento, total]) => ({ forma_pagamento, total })),
          movements: movs
        };
        return res.json(payload);
      } catch (err) {
        console.error('Cashier detail error:', err);
        return res.status(500).json({ error: err.message });
      }
    }

    // Cashier - supply (suprimento) e withdraw (sangria) usando sessao atual
    if ((url === '/api/cashier/supply' || url === '/api/cashier/withdraw') && method === 'POST') {
      try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { data: openSession, error: findErr } = await supabase
          .from('cash_sessions')
          .select('id')
          .eq('status', 'aberto')
          .single();
        if (findErr || !openSession) {
          return res.status(400).json({ error: 'Nenhuma sessão de caixa aberta' });
        }
        const tipo = url === '/api/cashier/supply' ? 'suprimento' : 'sangria';
        const valor = Number(body.valor) || 0;
        const descricao = body.descricao || (tipo === 'suprimento' ? 'Suprimento de Caixa' : 'Sangria de Caixa');
        const { data, error } = await supabase
          .from('cash_movements')
          .insert([{ session_id: openSession.id, tipo, valor, descricao }])
          .select()
          .single();
        if (error) throw error;
        return res.json(data);
      } catch (err) {
        console.error('Cashier supply/withdraw error:', err);
        return res.status(500).json({ error: err.message });
      }
    }

    // Cashier - reset (forçar fechamento de todas as sessões)
    if (url === '/api/cashier/reset' && method === 'POST') {
      await supabase
        .from('cash_sessions')
        .update({ status: 'fechado', closed_at: new Date().toISOString() })
        .eq('status', 'aberto');
      
      return res.json({ success: true });
    }

    return res.status(404).json({ error: 'Route not found' });

  } catch (error) {
    console.error('API Error:', error);
    if (isDashboard) return res.status(200).json(emptyDashboard());
    if (isAlerts) return res.status(200).json([]);
    return res.status(500).json({ error: error.message });
  }
};
