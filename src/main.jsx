import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

/*
 * Tres aplicacoes moram no mesmo deploy:
 *
 *   /          loja online, publica  (thepethouse.com.br abre aqui)
 *   /painel    painel da loja: pedidos, catalogo e metricas
 *   /admin     sistema de gestao completo (PDV)
 *
 * Cada uma roda no seu proprio `basename`, entao as rotas internas de cada
 * uma se escrevem como se ela fosse a raiz — o React Router poe e tira o
 * prefixo sozinho, e nenhum link precisou ser reescrito.
 */
function qualApp(caminho) {
  if (/^\/painel(\/|$)/.test(caminho)) return { nome: 'painel', base: '/painel' };
  if (/^\/admin(\/|$)/.test(caminho)) return { nome: 'gestao', base: '/admin' };
  return { nome: 'loja', base: undefined };
}

const app = qualApp(window.location.pathname);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={app.base}>
      <App qual={app.nome} />
    </BrowserRouter>
  </React.StrictMode>
);
