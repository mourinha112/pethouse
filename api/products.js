// api/products.js - API de Produtos para Vercel
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
          // Buscar produto por ID
          const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', query.id)
            .single()
          
          if (error) throw error
          return res.status(200).json(data || {})
        }
        
        if (query.search) {
          // Busca rápida para PDV
          const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('ativo', 1)
            .or(`nome.ilike.%${query.search}%,marca.ilike.%${query.search}%`)
            .limit(20)
          
          if (error) throw error
          return res.status(200).json(data || [])
        }
        
        if (query.movements) {
          // Histórico de movimentações
          const { data, error } = await supabase
            .from('stock_movements')
            .select('*, products(nome)')
            .order('created_at', { ascending: false })
            .limit(100)
          
          if (error) throw error
          return res.status(200).json(data || [])
        }
        
        // Listar todos
        const { data: products, error: listError } = await supabase
          .from('products')
          .select('*')
          .eq('ativo', 1)
          .order('nome')
        
        if (listError) throw listError
        return res.status(200).json(products || [])

      case 'POST':
        // Criar produto
        const { data: newProduct, error: createError } = await supabase
          .from('products')
          .insert([body])
          .select()
        
        if (createError) throw createError
        return res.status(201).json(newProduct[0])

      case 'PUT':
        // Atualizar produto
        body.updated_at = new Date().toISOString()
        
        const { data: updated, error: updateError } = await supabase
          .from('products')
          .update(body)
          .eq('id', query.id)
          .select()
        
        if (updateError) throw updateError
        return res.status(200).json(updated[0])

      case 'DELETE':
        // Desativar produto (soft delete)
        const { error: deleteError } = await supabase
          .from('products')
          .update({ ativo: 0 })
          .eq('id', query.id)
        
        if (deleteError) throw deleteError
        return res.status(200).json({ success: true })

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE'])
        return res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('API Error:', error)
    return res.status(500).json({ error: error.message })
  }
}
