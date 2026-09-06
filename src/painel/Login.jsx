import React, { useState, useEffect } from 'react';
import api from '../api';
import { LogIn, UserPlus, Loader2 } from 'lucide-react';

/*
 * Enquanto nao existir nenhum usuario, a tela vira "primeiro acesso" e
 * cria o dono do painel. Depois disso, so login.
 */
export default function Login({ aoEntrar }) {
  const [primeiroAcesso, setPrimeiroAcesso] = useState(null);
  const [nome, setNome] = useState('');
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.get('/auth/check')
      .then((r) => setPrimeiroAcesso(!r.data.hasUsers))
      .catch(() => setPrimeiroAcesso(false));
  }, []);

  async function enviar(e) {
    e.preventDefault();
    setErro('');

    if (!login.trim()) { setErro('Informe o login.'); return; }
    if (primeiroAcesso && senha.length < 6) { setErro('A senha precisa ter pelo menos 6 caracteres.'); return; }

    setEnviando(true);
    try {
      const res = await api.post('/auth', primeiroAcesso
        ? { action: 'register', nome: nome.trim(), login: login.trim(), senha }
        : { action: 'login', login: login.trim(), senha });
      try {
        localStorage.setItem('petshop_token', res.data.token);
        localStorage.setItem('petshop_user', JSON.stringify(res.data.user));
      } catch (_) {
        // Sem localStorage a sessao nao sobrevive a recarregar a pagina,
        // mas dentro desta aba o painel funciona igual.
      }
      aoEntrar(res.data.user);
    } catch (err) {
      setErro(err.response?.data?.error || 'Nao consegui entrar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  if (primeiroAcesso === null) return <div className="pn-login" />;

  return (
    <div className="pn-login">
      <form className="pn-login-cartao" onSubmit={enviar}>
        <img src="/logo.png" alt="" className="pn-login-logo" />
        <h1>{primeiroAcesso ? 'Primeiro acesso' : 'Painel da loja'}</h1>
        <p className="pn-login-sub">
          {primeiroAcesso
            ? 'Crie o usuário dono do painel. Essa tela só aparece uma vez.'
            : 'Entre para ver os pedidos e cuidar do catálogo.'}
        </p>

        {erro && <div className="pn-login-erro">{erro}</div>}

        {primeiroAcesso && (
          <label className="pn-campo">
            <span>Seu nome</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como quer ser chamado" autoComplete="name" />
          </label>
        )}

        <label className="pn-campo">
          <span>Login</span>
          <input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="seu usuário" autoComplete="username" autoFocus />
        </label>

        <label className="pn-campo">
          <span>Senha</span>
          <input
            type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
            placeholder={primeiroAcesso ? 'mínimo 6 caracteres' : 'sua senha'}
            autoComplete={primeiroAcesso ? 'new-password' : 'current-password'}
          />
        </label>

        <button className="pn-btn pn-btn-primario pn-btn-largo" type="submit" disabled={enviando}>
          {enviando ? <Loader2 size={18} className="pn-girando" />
            : primeiroAcesso ? <UserPlus size={18} /> : <LogIn size={18} />}
          {enviando ? 'Entrando…' : primeiroAcesso ? 'Criar e entrar' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
