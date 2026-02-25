// api/server.js - Servidor Express para desenvolvimento
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const app = express();
const PORT = 3001;

const supabaseUrl = 'https://jkbugbsnmygvrejjurvi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprYnVnYnNubXlndnJlamp1cnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MzA3MTQsImV4cCI6MjA4NzUwNjcxNH0.Q_Yho42qCLyMCUVwvG1bW6OzB9TI-0VRA4U2QeH5YTk';
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.json());

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Auth - Check if has users
app.get('/api/auth/check', async (req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('id').limit(1);
    res.json({ hasUsers: data?.length > 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Auth - Setup (primeiro usuário)
app.post('/api/auth/setup', async (req, res) => {
  try {
    const { nome, login, senha } = req.body;
    
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{
        nome: nome || login,
        login,
        senha_hash: hashPassword(senha),
        role: 'admin'
      }])
      .select()
      .single();

    if (error) throw error;

    const token = Buffer.from(`${newUser.id}:${Date.now()}`).toString('base64');
    
    res.json({
      token,
      user: {
        id: newUser.id,
        nome: newUser.nome,
        login: newUser.login,
        role: newUser.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Auth - Login/Register
app.post('/api/auth', async (req, res) => {
  try {
    const { action, login, senha, nome } = req.body;

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
        user: {
          id: data.id,
          nome: data.nome,
          login: data.login,
          role: data.role
        }
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
        .insert([{
          nome: nome || login,
          login,
          senha_hash: hashPassword(senha),
          role: 'admin'
        }])
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({
        id: newUser.id,
        nome: newUser.nome,
        login: newUser.login,
        role: newUser.role
      });
    }

    return res.status(400).json({ error: 'Ação inválida' });
  } catch (error) {
    console.error('Auth Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Products
app.get('/api/products', async (req, res) => {
  try {
    const { search } = req.query;
    
    let query = supabase.from('products').select('*').eq('ativo', 1).order('nome');
    
    if (search) {
      query = query.or(`nome.ilike.%${search}%,marca.ilike.%${search}%`);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Products - Search (para o PDV)
app.get('/api/products/search/:term', async (req, res) => {
  try {
    const { term } = req.params;
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('ativo', 1)
      .or(`nome.ilike.%${term}%,marca.ilike.%${term}%`)
      .limit(20);
    
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products/movements', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('*, products(nome)')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { data, error } = await supabase.from('products').insert([req.body]).select();
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select();
    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('products')
      .update({ ativo: 0 })
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Entrada de estoque
app.post('/api/products/:id/stock', async (req, res) => {
  try {
    const { quantidade_kg, motivo } = req.body;
    const productId = req.params.id;

    // Atualizar estoque
    const { data: product } = await supabase
      .from('products')
      .select('estoque_kg')
      .eq('id', productId)
      .single();

    const newStock = (product?.estoque_kg || 0) + quantidade_kg;

    await supabase
      .from('products')
      .update({ estoque_kg: newStock })
      .eq('id', productId);

    // Registrar movimentação
    await supabase.from('stock_movements').insert([{
      product_id: productId,
      tipo: 'entrada',
      quantidade_kg: quantidade_kg,
      motivo: motivo || 'Entrada manual'
    }]);

    res.json({ success: true, estoque_kg: newStock });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sales
app.get('/api/sales', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('sales')
      .select('*, clients(nome)')
      .gte('created_at', today)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sales', async (req, res) => {
  try {
    const { items, ...saleData } = req.body;
    
    const { data: newSale, error: saleError } = await supabase
      .from('sales')
      .insert([saleData])
      .select();
    
    if (saleError) throw saleError;
    const saleId = newSale[0].id;

    for (const item of items) {
      await supabase.from('sale_items').insert([{
        sale_id: saleId,
        product_id: item.product_id,
        tipo_venda: item.tipo_venda,
        quantidade_kg: item.quantidade_kg,
        preco_unitario: item.preco_unitario,
        subtotal: item.subtotal
      }]);

      const qty = item.tipo_venda === 'saco' ? item.quantidade_kg * (item.peso_saco || 1) : item.quantidade_kg;

      await supabase.from('stock_movements').insert([{
        product_id: item.product_id,
        tipo: 'saida',
        quantidade_kg: -qty,
        motivo: `Venda #${saleId}`,
        sale_id: saleId
      }]);
    }

    res.status(201).json(newSale[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard
app.get('/api/dashboard', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    const monthStart = firstDayOfMonth.toISOString().split('T')[0];

    // Vendas de hoje
    const { data: todaySales } = await supabase
      .from('sales')
      .select('total, forma_pagamento')
      .gte('created_at', today);

    const todayTotal = todaySales?.reduce((sum, s) => sum + (s.total || 0), 0) || 0;
    const todayCount = todaySales?.length || 0;
    const ticketMedio = todayCount > 0 ? todayTotal / todayCount : 0;

    // Vendas do mês
    const { data: monthSales } = await supabase
      .from('sales')
      .select('total')
      .gte('created_at', monthStart);

    const monthTotal = monthSales?.reduce((sum, s) => sum + (s.total || 0), 0) || 0;

    // Estoque total
    const { data: products } = await supabase
      .from('products')
      .select('estoque_kg, preco_por_kg')
      .eq('ativo', 1);

    const totalEstoque = products?.reduce((sum, p) => sum + (p.estoque_kg || 0), 0) || 0;
    const valorEstoque = products?.reduce((sum, p) => sum + ((p.estoque_kg || 0) * (p.preco_por_kg || 0)), 0) || 0;

    // Despesas pendentes
    const { data: expenses } = await supabase
      .from('expenses')
      .select('valor')
      .eq('pago', 0);

    const despesasPendentes = expenses?.reduce((sum, e) => sum + (e.valor || 0), 0) || 0;

    // Meta diária
    const { data: metaData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'meta_diaria')
      .single();

    const metaDiaria = parseFloat(metaData?.value || '500');
    const metaAtingida = (todayTotal / metaDiaria) * 100;

    // Últimas vendas
    const { data: ultimasVendas } = await supabase
      .from('sales')
      .select('*, clients(nome)')
      .order('created_at', { ascending: false })
      .limit(5);

    // Produtos com estoque baixo
    const { data: estoqueBaixo } = await supabase
      .from('products')
      .select('nome, estoque_kg, estoque_minimo_dias')
      .eq('ativo', 1)
      .lt('estoque_kg', 10)
      .order('estoque_kg')
      .limit(5);

    // Vendas por pagamento
    const payments = {};
    todaySales?.forEach(s => {
      const forma = s.forma_pagamento || 'outros';
      payments[forma] = (payments[forma] || 0) + s.total;
    });

    res.json({
      // Formato que o frontend espera
      faturamento_dia: todayTotal,
      vendas_dia: todayCount,
      ticket_medio: ticketMedio,
      faturamento_mes: monthTotal,
      estoque_total_kg: totalEstoque,
      valor_estoque: valorEstoque,
      total_produtos: products?.length || 0,
      despesas_pendentes: despesasPendentes,
      meta_diaria: metaDiaria,
      meta_percent: metaAtingida,
      pagamentos: payments,
      ultimas_vendas: ultimasVendas || [],
      estoque_baixo: estoqueBaixo || [],
      top_produtos: []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard alerts
app.get('/api/dashboard/alerts', async (req, res) => {
  try {
    const { data } = await supabase
      .from('products')
      .select('nome, estoque_kg, estoque_minimo_dias')
      .eq('ativo', 1)
      .lt('estoque_kg', 10)
      .order('estoque_kg')
      .limit(10);
    
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generic - Clientes, Despesas, etc
// Cashier - Sessão atual
app.get('/api/cashier/current', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('status', 'aberto')
      .order('opened_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    if (data) {
      // Buscar movimentações
      const { data: movements } = await supabase
        .from('cash_movements')
        .select('*')
        .eq('session_id', data.id)
        .order('created_at', { ascending: false });
      
      data.movements = movements || [];
    }
    
    res.json(data || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cashier - Abrir sessão
app.post('/api/cashier/open', async (req, res) => {
  try {
    const { saldo_inicial } = req.body;
    
    // Verificar se já existe sessão aberta
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
    
    // Registrar movimentação
    await supabase.from('cash_movements').insert([{
      session_id: data.id,
      tipo: 'abertura',
      valor: saldo_inicial || 0,
      descricao: 'Abertura de caixa'
    }]);
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cashier - Fechar sessão
app.post('/api/cashier/close', async (req, res) => {
  try {
    const { id, saldo_final, observacao } = req.body;
    
    const { data, error } = await supabase
      .from('cash_sessions')
      .update({ status: 'fechado', saldo_final, observacao_fechamento: observacao, closed_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cashier - Movimentações
app.post('/api/cashier/movement', async (req, res) => {
  try {
    const { session_id, tipo, valor, descricao } = req.body;
    
    const { data, error } = await supabase
      .from('cash_movements')
      .insert([{ session_id, tipo, valor, descricao }])
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cashier - Histórico
app.get('/api/cashier/history', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('status', 'fechado')
      .order('closed_at', { ascending: false })
      .limit(20);
    
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Expenses: lista com filtro por mês (despesas do mês + recorrentes) — antes do generic
app.get('/api/expenses', async (req, res) => {
  try {
    const mes = req.query.mes || new Date().toISOString().slice(0, 7);
    const pagoFilter = req.query.pago;
    const [y, m] = mes.split('-').map(Number);
    const mesInicio = new Date(y, m - 1, 1).toISOString().split('T')[0];
    const mesFim = new Date(y, m, 0).toISOString().split('T')[0];
    const { data: noMes, error: err1 } = await supabase
      .from('expenses')
      .select('*')
      .gte('data_vencimento', mesInicio)
      .lte('data_vencimento', mesFim)
      .order('data_vencimento', { ascending: true });
    if (err1) throw err1;
    const { data: rec, error: err2 } = await supabase
      .from('expenses')
      .select('*')
      .or('recorrente.eq.1,recorrente.eq.true')
      .order('data_vencimento', { ascending: true });
    if (err2) throw err2;
    const seen = new Set((noMes || []).map(e => e.id));
    const recUniq = (rec || []).filter(e => !seen.has(e.id) && seen.add(e.id));
    let list = [...(noMes || []), ...recUniq].sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || ''));
    if (pagoFilter === 'true' || pagoFilter === '1') list = list.filter(e => e.pago);
    if (pagoFilter === 'false' || pagoFilter === '0') list = list.filter(e => !e.pago);
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/expenses/summary', async (req, res) => {
  try {
    const mes = req.query.mes || new Date().toISOString().slice(0, 7);
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
    res.json({ mes, total, pago, pendente, por_categoria });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/expenses', async (req, res) => {
  try {
    const body = req.body || {};
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
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/expenses/:id/toggle-pago', async (req, res) => {
  try {
    const id = req.params.id;
    const { data: current, error: getErr } = await supabase.from('expenses').select('pago').eq('id', id).single();
    if (getErr || !current) return res.status(404).json({ error: 'Despesa não encontrada' });
    const novoPago = current.pago ? 0 : 1;
    const { data, error } = await supabase.from('expenses').update({ pago: novoPago, data_pagamento: novoPago ? new Date().toISOString().split('T')[0] : null }).eq('id', id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/expenses/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body || {};
    const { tipo_recorrencia, ...rest } = body;
    const row = {
      descricao: rest.descricao,
      categoria: rest.categoria || 'outros',
      valor: Number(rest.valor) || 0,
      pago: rest.pago === true || rest.pago === 1 ? 1 : 0,
      recorrente: rest.recorrente === true || rest.recorrente === 1 ? 1 : 0,
      tipo_recorrencia: tipo_recorrencia || 'nenhum',
    };
    if (rest.data_vencimento != null) row.data_vencimento = rest.data_vencimento || null;
    if (rest.data_inicio != null) row.data_inicio = rest.data_inicio || null;
    if (rest.data_fim != null) row.data_fim = rest.data_fim || null;
    const { data, error } = await supabase.from('expenses').update(row).eq('id', id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/expenses/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('expenses').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const genericTables = ['clients', 'fixed_costs', 'settings'];

genericTables.forEach(table => {
  app.get(`/api/${table}`, async (req, res) => {
    try {
      const { data, error } = await supabase.from(table).select('*').order('id');
      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post(`/api/${table}`, async (req, res) => {
    try {
      const { data, error } = await supabase.from(table).insert([req.body]).select();
      if (error) throw error;
      res.status(201).json(data[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put(`/api/${table}/:id`, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from(table)
        .update(req.body)
        .eq('id', req.params.id)
        .select();
      if (error) throw error;
      res.json(data[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete(`/api/${table}/:id`, async (req, res) => {
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
