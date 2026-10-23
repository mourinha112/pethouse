import { createClient } from '@supabase/supabase-js';
import { montarDashboard, dashboardVazio } from './_lib/dashboard.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VERCEL_SUPABASE_URL || 'https://jkbugbsnmygvrejjurvi.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VERCEL_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprYnVnYnNubXlndnJlamp1cnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MzA3MTQsImV4cCI6MjA4NzUwNjcxNH0.Q_Yho42qCLyMCUVwvG1bW6OzB9TI-0VRA4U2QeH5YTk';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(200).json(dashboardVazio());

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    return res.status(200).json(await montarDashboard(supabase));
  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(200).json(dashboardVazio());
  }
}
