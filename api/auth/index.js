import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL || 'https://jkbugbsnmygvrejjurvi.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprYnVnYnNubXlndnJlamp1cnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MzA3MTQsImV4cCI6MjA4NzUwNjcxNH0.Q_Yho42qCLyMCUVwvG1bW6OzB9TI-0VRA4U2QeH5YTk';

const supabase = createClient(supabaseUrl, supabaseKey);

const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const url = req.url || '';
    
    // Check if has users
    if (req.method === 'GET') {
      const { data } = await supabase.from('users').select('id').limit(1);
      return res.json({ hasUsers: data?.length > 0 });
    }
    
    // Login
    if (req.method === 'POST') {
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

    return res.status(404).json({ error: 'Not found' });

  } catch (error) {
    console.error('Auth Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
