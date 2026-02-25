// api/sales.js - API de Vendas
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL || 'https://jkbugbsnmygvrejjurvi.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprYnVnYnNubXlndnJlamp1cnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MzA3MTQsImV4cCI6MjA4NzUwNjcxNH0.Q_Yho42qCLyMCUVwvG1bW6OzB9TI-0VRA4U2QeH5YTk'

const supabase = createClient(supabaseUrl, supabaseKey)

module.exports = async function handler(req, res) {
  const { method, query, body } = req

  try {
    switch (method) {
      case 'GET':
        if (query.id) {
          const { data, error } = await supabase
            .from('sales')
            .select('*, clients(nome), sale_items(*, products(nome))')
            .eq('id', query.id)
            .single()
          
          if (error) throw error
          return res.status(200).json(data || {})
        }

        // Listar vendas do dia
        const today = new Date().toISOString().split('T')[0]
        const { data: sales, error: listError } = await supabase
          .from('sales')
          .select('*, clients(nome)')
          .gte('created_at', today)
          .order('created_at', { ascending: false })
        
        if (listError) throw listError
        return res.status(200).json(sales || [])

      case 'POST':
        // Criar venda com itens
        const { items, ...saleData } = body
        
        // Criar venda
        const { data: newSale, error: saleError } = await supabase
          .from('sales')
          .insert([saleData])
          .select()
        
        if (saleError) throw saleError
        const saleId = newSale[0].id

        // Criar itens e atualizar estoque
        for (const item of items) {
          // Adicionar item
          await supabase.from('sale_items').insert([{
            sale_id: saleId,
            product_id: item.product_id,
            tipo_venda: item.tipo_venda,
            quantidade_kg: item.quantidade_kg,
            preco_unitario: item.preco_unitario,
            subtotal: item.subtotal
          }])

          // Atualizar estoque
          const qty = item.tipo_venda === 'saco' 
            ? item.quantidade_kg * (item.peso_saco || 1) 
            : item.quantidade_kg

          await supabase.rpc('decrement_estoque', { 
            product_id: item.product_id, 
            qty: qty 
          }).catch(async () => {
            // Se RPC não existir, faz manualmente
            const { data: prod } = await supabase
              .from('products')
              .select('estoque_kg')
              .eq('id', item.product_id)
              .single()
            
            if (prod) {
              await supabase
                .from('products')
                .update({ estoque_kg: Math.max(0, prod.estoque_kg - qty) })
                .eq('id', item.product_id)
            }
          })

          // Registrar movimentação
          await supabase.from('stock_movements').insert([{
            product_id: item.product_id,
            tipo: 'saida',
            quantidade_kg: -qty,
            motivo: `Venda #${saleId}`,
            sale_id: saleId
          }])
        }

        return res.status(201).json(newSale[0])

      default:
        res.setHeader('Allow', ['GET', 'POST'])
        return res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('API Error:', error)
    return res.status(500).json({ error: error.message })
  }
}
