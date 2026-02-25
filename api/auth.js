// api/auth.js - API de Autenticação
const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

const supabaseUrl = process.env.SUPABASE_URL || 'https://jkbugbsnmygvrejjurvi.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprYnVnYnNubXlndnJlamp1cnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MzA3MTTsImV4cCI6MjA4NzUwNjcxNH0.Q_Yho42qCLyMCUVwvG1bW6OzB9TI-0VRA4U2QeH5YTk'

const supabase = createClient(supabaseUrl, supabaseKey)

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex')
}

module.exports = async function handler(req, res) {
  const { method, body } = req

  try {
    switch (method) {
      case 'POST':
        const { action, login, senha, nome } = body

        if (action === 'login') {
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('login', login)
            .eq('senha_hash', hashPassword(senha))
            .single()

          if (error || !data) {
            return res.status(401).json({ error: 'Login ou senha incorretos' })
          }

          return res.status(200).json({
            id: data.id,
            nome: data.nome,
            login: data.login,
            role: data.role
          })
        }

        if (action === 'register') {
          // Verificar se já existe usuário
          const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('login', login)
            .single()

          if (existing) {
            return res.status(400).json({ error: 'Login já existe' })
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
            .single()

          if (error) throw error

          return res.status(201).json({
            id: newUser.id,
            nome: newUser.nome,
            login: newUser.login,
            role: newUser.role
          })
        }

        return res.status(400).json({ error: 'Ação inválida' })

      default:
        res.setHeader('Allow', ['POST'])
        return res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('Auth Error:', error)
    return res.status(500).json({ error: error.message })
  }
}
