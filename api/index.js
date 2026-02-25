import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://jkbugbsnmygvrejjurvi.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprYnVnYnNubXlndnJlamp1cnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MzA3MTQsImV4cCI6MjA4NzUwNjcxNH0.Q_Yho42qCLyMCUVwvG1bW6OzB9TI-0VRA4U2QeH5YTk';

const supabase = createClient(supabaseUrl, supabaseKey);

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

export default async function handler(req, res) {
  const method = req.method;
  const rawUrl = req.url || '';
  const urlOnly = rawUrl.split('?')[0] || '';
  const url = urlOnly.startsWith('http') ? new URL(urlOnly).pathname : urlOnly;

  // Debug
  console.log('Received:', method, url);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
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
        const today = new Date().toISOString().split('T')[0];
        
        const { data: todaySales, error: salesError } = await supabase
          .from('sales')
          .select('total, forma_pagamento')
          .gte('created_at', today);

        if (salesError) {
          console.error('Dashboard sales error:', salesError);
          return res.status(500).json({ error: 'Erro ao buscar vendas' });
        }

        const todayTotal = todaySales?.reduce((sum, s) => sum + (s.total || 0), 0) || 0;
        const todayCount = todaySales?.length || 0;
        const ticketMedio = todayCount > 0 ? todayTotal / todayCount : 0;

        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('estoque_kg')
          .eq('ativo', 1);

        if (productsError) {
          console.error('Dashboard products error:', productsError);
          return res.status(500).json({ error: 'Erro ao buscar produtos' });
        }

        const totalEstoque = products?.reduce((sum, p) => sum + (p.estoque_kg || 0), 0) || 0;

        const now = new Date();
        const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const mesFim = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        const { data: noMes } = await supabase.from('expenses').select('id, valor, pago').gte('data_vencimento', mesInicio).lte('data_vencimento', mesFim);
        const { data: rec } = await supabase.from('expenses').select('id, valor, pago').eq('recorrente', 1);
        const seen = new Set((noMes || []).map(e => e.id));
        const recUniq = (rec || []).filter(e => !seen.has(e.id) && seen.add(e.id));
        const todasDoMes = [...(noMes || []), ...recUniq];
        const despesasPendentes = todasDoMes.filter(e => !e.pago).reduce((s, e) => s + (Number(e.valor) || 0), 0);

        return res.json({
          faturamento_dia: todayTotal,
          vendas_dia: todayCount,
          ticket_medio: ticketMedio,
          estoque_total_kg: totalEstoque,
          meta_diaria: 500,
          meta_percent: 0,
          despesas_pendentes: despesasPendentes
        });
      } catch (err) {
        console.error('Dashboard error:', err);
        return res.status(500).json({ error: err.message });
      }
    }

    // Dashboard - alerts
    if (url === '/api/dashboard/alerts' && method === 'GET') {
      try {
        const { data: products, error: prodErr } = await supabase
          .from('products')
          .select('*')
          .eq('ativo', 1)
          .gt('estoque_kg', 0);

        if (prodErr) {
          console.error('Dashboard alerts products error:', prodErr);
          return res.status(500).json({ error: 'Erro ao buscar alertas' });
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

        const alerts = (products || []).filter(p => {
          const totalVendido30d = salesByProduct[p.id] || 0;
          const mediaDiaria = totalVendido30d / 30;
          const diasEstoque = mediaDiaria > 0 ? p.estoque_kg / mediaDiaria : 999;
          return diasEstoque < (p.estoque_minimo_dias || 7);
        }).map(p => ({
          id: p.id,
          nome: p.nome,
          estoque_kg: p.estoque_kg,
          estoque_minimo_dias: p.estoque_minimo_dias || 7
        }));

        return res.json(alerts);
      } catch (err) {
        console.error('Dashboard alerts error:', err);
        return res.status(500).json({ error: err.message });
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
        const query = rawUrl.includes('?') ? Object.fromEntries(new URLSearchParams(rawUrl.split('?')[1])) : {};
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
          return res.status(500).json({ error: 'Erro ao buscar vendas' });
        }
        const list = (data || []).map(s => ({ ...s, client_nome: s.clients?.nome || null }));
        return res.json(list);
      } catch (err) {
        console.error('Sales error:', err);
        return res.status(500).json({ error: err.message });
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
        const qs = rawUrl.includes('?') ? new URLSearchParams(rawUrl.split('?')[1]) : null;
        const mes = (qs && qs.get('mes')) || new Date().toISOString().slice(0, 7);
        const [y, m] = mes.split('-').map(Number);
        const mesInicio = new Date(y, m - 1, 1).toISOString().split('T')[0];
        const mesFim = new Date(y, m, 0).toISOString().split('T')[0];
        const { data: noMes } = await supabase.from('expenses').select('id, valor, pago, categoria').gte('data_vencimento', mesInicio).lte('data_vencimento', mesFim);
        const { data: rec } = await supabase.from('expenses').select('id, valor, pago, categoria').or('recorrente.eq.1,recorrente.eq.true');
        const seen = new Set((noMes || []).map(e => e.id));
        const recUniq = (rec || []).filter(e => !seen.has(e.id) && seen.add(e.id));
        const items = [...(noMes || []), ...recUniq];
        const total = items.reduce((s, e) => s + (Number(e.valor) || 0), 0);
        const pago = items.filter(e => e.pago).reduce((s, e) => s + (Number(e.valor) || 0), 0);
        const pendente = total - pago;
        const porCat = {};
        items.forEach(e => { const c = e.categoria || 'outros'; porCat[c] = (porCat[c] || 0) + (Number(e.valor) || 0); });
        const por_categoria = Object.entries(porCat).map(([categoria, total]) => ({ categoria, total }));
        return res.json({ total, pago, pendente, por_categoria });
      } catch (err) {
        console.error('Expenses summary error:', err);
        return res.status(500).json({ error: err.message });
      }
    }

    // Expenses - lista (filtro por mês: despesas do mês + recorrentes)
    if (url === '/api/expenses' || url === '/api/expenses/') {
      if (method === 'GET') {
        try {
          const qs = rawUrl.includes('?') ? new URLSearchParams(rawUrl.split('?')[1]) : null;
          const mes = (qs && qs.get('mes')) || new Date().toISOString().slice(0, 7);
          const pagoFilter = qs && qs.get('pago');
          const [y, m] = mes.split('-').map(Number);
          const mesInicio = new Date(y, m - 1, 1).toISOString().split('T')[0];
          const mesFim = new Date(y, m, 0).toISOString().split('T')[0];
          const { data: noMes, error: err1 } = await supabase.from('expenses').select('*').gte('data_vencimento', mesInicio).lte('data_vencimento', mesFim).order('data_vencimento', { ascending: true });
          if (err1) throw err1;
          const { data: rec, error: err2 } = await supabase.from('expenses').select('*').or('recorrente.eq.1,recorrente.eq.true').order('data_vencimento', { ascending: true });
          if (err2) throw err2;
          const seen = new Set((noMes || []).map(e => e.id));
          const recUniq = (rec || []).filter(e => !seen.has(e.id) && seen.add(e.id));
          let list = [...(noMes || []), ...recUniq].sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || ''));
          if (pagoFilter === 'true' || pagoFilter === '1') list = list.filter(e => e.pago);
          if (pagoFilter === 'false' || pagoFilter === '0') list = list.filter(e => !e.pago);
          return res.json(list);
        } catch (err) {
          console.error('Expenses list error:', err);
          return res.status(500).json({ error: err.message });
        }
      }
      if (method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { tipo_recorrencia, ...rest } = body;
        const row = {
          descricao: rest.descricao,
          categoria: rest.categoria || 'outros',
          valor: Number(rest.valor) || 0,
          pago: rest.pago === true || rest.pago === 1 ? 1 : 0,
          recorrente: rest.recorrente === true || rest.recorrente === 1 ? 1 : 0,
          tipo_recorrencia: tipo_recorrencia || 'nenhum',
        };
        if (rest.data_vencimento && rest.data_vencimento !== '') row.data_vencimento = rest.data_vencimento;
        else if (row.recorrente) row.data_vencimento = new Date().toISOString().slice(0, 7) + '-01';
        if (rest.data_inicio && rest.data_inicio !== '') row.data_inicio = rest.data_inicio;
        if (rest.data_fim && rest.data_fim !== '') row.data_fim = rest.data_fim;
        const { data, error } = await supabase.from('expenses').insert([row]).select();
        if (error) {
          console.error('Expenses insert error:', error);
          throw error;
        }
        return res.status(201).json(data[0]);
      }
    }

    // Expenses - toggle pago (marcar como pago/pendente)
    if (url.match(/^\/api\/expenses\/\d+\/toggle-pago$/) && method === 'PUT') {
      try {
        const id = url.replace(/^\/api\/expenses\//, '').replace(/\/toggle-pago$/, '');
        const { data: current, error: getErr } = await supabase.from('expenses').select('pago').eq('id', id).single();
        if (getErr || !current) return res.status(404).json({ error: 'Despesa não encontrada' });
        const novoPago = current.pago ? 0 : 1;
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
    return res.status(500).json({ error: error.message });
  }
};
