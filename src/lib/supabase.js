// frontend/src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jkbugbsnmygvrejjurvi.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprYnVnYnNubXlndnJlamp1cnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MzA3MTQsImV4cCI6MjA4NzUwNjcxNH0.Q_Yho42qCLyMCUVwvG1bW6OzB9TI-0VRA4U2QeH5YTk'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Helpers para converter nomes de tabela para snake_case do Supabase
export const tables = {
  users: 'users',
  products: 'products',
  clients: 'clients',
  sales: 'sales',
  sale_items: 'sale_items',
  stock_movements: 'stock_movements',
  fixed_costs: 'fixed_costs',
  expenses: 'expenses',
  cash_sessions: 'cash_sessions',
  cash_movements: 'cash_movements',
  settings: 'settings'
}
