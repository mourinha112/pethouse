// api/generic.js - API Genérica para operações CRUD
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL || 'https://jkbugbsnmygvrejjurvi.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprYnVnYnNubXlndnJlamp1cnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MzA3MTQsImV4cCI6MjA4NzUwNjcxNH0.Q_Yho42qCLyMCUVwvG1bW6OzB9TI-0VRA4U2QeH5YTk'

const supabase = createClient(supabaseUrl, supabaseKey)

// Mapeamento de tabelas para chaves de ordenação
const orderKeys = {
  clients: 'nome',
  fixed_costs: 'descricao',
  expenses: 'data_vencimento',
  cash_sessions: 'opened_at',
  cash_movements: 'created_at',
  settings: 'key'
}

module.exports = async function handler(req, res) {
  const { method, query, body } = req
  const table = query.table

  // Tabelas permitidas
  const allowedTables = ['clients', 'fixed_costs', 'expenses', 'cash_sessions', 
                         'cash_movements', 'settings', 'stock_movements']

  if (!table || !allowedTables.includes(table)) {
    return res.status(400).json({ error: 'Tabela inválida' })
  }

  try {
    switch (method) {
      case 'GET':
        let dbQuery = supabase.from(table).select('*')

        // Aplicar filtros
        if (query.filter) {
          const filter = JSON.parse(query.filter)
          Object.entries(filter).forEach(([key, value]) => {
            dbQuery = dbQuery.eq(key, value)
          })
        }

        // Ordenar
        const orderKey = orderKeys[table] || 'id'
        dbQuery = dbQuery.order(orderKey, { ascending: true })

        const { data, error } = await dbQuery
        if (error) throw error
        return res.status(200).json(data || [])

      case 'POST':
        const { data: newItem, error: createError } = await supabase
          .from(table)
          .insert([body])
          .select()
        
        if (createError) throw createError
        return res.status(201).json(newItem[0])

      case 'PUT':
        const { data: updated, error: updateError } = await supabase
          .from(table)
          .update(body)
          .eq('id', query.id)
          .select()
        
        if (updateError) throw updateError
        return res.status(200).json(updated[0])

      case 'DELETE':
        const { error: deleteError } = await supabase
          .from(table)
          .delete()
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
