import React, { useState, useEffect } from 'react';
import api from '../api';
import { TextField, Button, Alert, CircularProgress, InputAdornment, IconButton } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import PersonAdd from '@mui/icons-material/PersonAdd';
import LoginIcon from '@mui/icons-material/Login';
import Star from '@mui/icons-material/Star';

export default function Login({ onLogin }) {
  const [isSetup, setIsSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nome: '', login: '', senha: '' });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    api.get('/auth').then(res => {
      setIsSetup(!res.data.hasUsers);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (isSetup) {
      if (!form.nome || !form.login || !form.senha) { setError('Preencha todos os campos'); return; }
      if (form.senha.length < 4) { setError('Senha mínimo 4 caracteres'); return; }
    } else {
      if (!form.login || !form.senha) { setError('Preencha login e senha'); return; }
    }
    try {
      const payload = isSetup
        ? { action: 'register', nome: form.nome, login: form.login, senha: form.senha }
        : { action: 'login', login: form.login, senha: form.senha };
      const res = await api.post('/auth', payload);
      localStorage.setItem('petshop_token', res.data.token);
      localStorage.setItem('petshop_user', JSON.stringify(res.data.user));
      onLogin(res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao conectar');
    }
  }

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <CircularProgress size={48} sx={{ color: 'primary.main' }} />
          <span>Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <img src="/logo.png" alt="Logo" className="login-logo-img" onError={e => { e.target.style.display = 'none'; }} />
          <div className="login-brand">
            <Star sx={{ fontSize: 28 }} />
            <span>PetShop</span>
          </div>
        </div>
        <h2>{isSetup ? 'Configurar Sistema' : 'Entrar no Sistema'}</h2>
        {isSetup && <p className="login-subtitle">Crie o usuário administrador para começar</p>}
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isSetup && (
            <TextField
              label="Seu Nome"
              value={form.nome}
              onChange={e => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: João"
              fullWidth
              autoFocus
            />
          )}
          <TextField
            label="Login"
            value={form.login}
            onChange={e => setForm({ ...form, login: e.target.value })}
            placeholder="Ex: admin"
            fullWidth
            autoFocus={!isSetup}
          />
          <TextField
            label="Senha"
            type={showPassword ? 'text' : 'password'}
            value={form.senha}
            onChange={e => setForm({ ...form, senha: e.target.value })}
            placeholder="****"
            fullWidth
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Button type="submit" variant="contained" size="large" fullWidth startIcon={isSetup ? <PersonAdd /> : <LoginIcon />}>
            {isSetup ? 'Criar e Entrar' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  );
}
