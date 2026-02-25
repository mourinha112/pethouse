// api/dashboard.js - API de Dashboard
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL || 'https://jkbugbsnmygvrejjurvi.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprYnVnYnNubXlndnJlamp1cnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MzA3MTQsImV4cCI6MjA4NzUwNjcxNH0.Q_Yho42qCLyMCUVwvG1bW6OzB9TI-0VRA4U2QeH5YTk'

const supabase = createClient(supabaseUrl, supabaseKey)

module.exports = async function handler(req, res) {
  try {
    const today = new Date().toISOString().split('T')[0]
    const firstDayOfMonth = new Date()
    firstDayOfMonth.setDate(1)
    const monthStart = firstDayOfMonth.toISOString().split('T')[0]

    // Vendas de hoje
    const { data: todaySales, error: todayError } = await supabase
      .from('sales')
      .select('total, forma_pagamento')
      .gte('created_at', today)

    if (todayError) throw todayError

    const todayTotal = todaySales?.reduce((sum, s) => sum + (s.total || 0), 0) || 0
    const todayCount = todaySales?.length || 0

    // Vendas do mês
    const { data: monthSales, error: monthError } = await supabase
      .from('sales')
      .select('total')
      .gte('created_at', monthStart)

    if (monthError) throw monthError

    const monthTotal = monthSales?.reduce((sum, s) => sum + (s.total || 0), 0) || 0

    // Ticket médio
    const ticketMedio = todayCount > 0 ? todayTotal / todayCount : 0

    // Vendas por forma de pagamento
    const payments = {}
    todaySales?.forEach(s => {
      const forma = s.forma_pagamento || 'outros'
      payments[forma] = (payments[forma] || 0) + s.total
    })

    // Estoque total
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('estoque_kg, preco_por_kg')
      .eq('ativo', 1)

    if (productsError) throw productsError

    const totalEstoque = products?.reduce((sum, p) => sum + (p.estoque_kg || 0), 0) || 0
    const valorEstoque = products?.reduce((sum, p) => sum + ((p.estoque_kg || 0) * (p.preco_por_kg || 0)), 0) || 0

    // Despesas pendentes
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('valor')
      .eq('pago', 0)

    if (expensesError) throw expensesError

    const despesasPendentes = expenses?.reduce((sum, e) => sum + (e.valor || 0), 0) || 0

    // Meta diária
    const { data: metaData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'meta_diaria')
      .single()

    const metaDiaria = parseFloat(metaData?.value || '500')
    const metaAtingida = (todayTotal / metaDiaria) * 100

    // Últimas vendas
    const { data: ultimasVendas } = await supabase
      .from('sales')
      .select('*, clients(nome)')
      .order('created_at', { ascending: false })
      .limit(5)

    // Produtos com estoque baixo
    const { data: estoqueBaixo } = await supabase
      .from('products')
      .select('nome, estoque_kg, estoque_minimo_dias')
      .eq('ativo', 1)
      .lt('estoque_kg', 10)
      .order('estoque_kg')
      .limit(5)

    // Top produtos vendidos hoje
    const { data: topProdutos } = await supabase
      .from('sale_items')
      .select('quantity:quantidade_kg, products(nome)')
      .gte('created_at', today)

    // Agrupar top produtos
    const prodCounts = {}
    topProdutos?.forEach(item => {
      const nome = item.products?.nome || 'Unknown'
      prodCounts[nome] = (prodCounts[nome] || 0) + (item.quantidade_kg || 0)
    })

    const topProdutosList = Object.entries(prodCounts)
      .map(([nome, quantidade]) => ({ nome, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5)

    return res.status(200).json({
      hoje: {
        vendas: todayCount,
        faturamento: todayTotal,
        ticketMedio
      },
      mes: {
        faturamento: monthTotal
      },
      estoque: {
        totalKg: totalEstoque,
        valor: valorEstoque
      },
      despesas: {
        pendentes: despesasPendentes
      },
      meta: {
        diaria: metaDiaria,
        atingida: metaAtingida
      },
      pagamentos: payments,
      ultimasVendas: ultimasVendas || [],
      estoqueBaixo: estoqueBaixo || [],
      topProdutos: topProdutosList
    })

  } catch (error) {
    console.error('Dashboard Error:', error)
    return res.status(500).json({ error: error.message })
  }
}
