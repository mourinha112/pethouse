import axios from 'axios';

// Em produção usa API da Vercel, em desenvolvimento usa localhost
const API_BASE = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

// Interceptor para adicionar token de auth
api.interceptors.request.use(config => {
  const token = localStorage.getItem('petshop_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
export { API_BASE };
