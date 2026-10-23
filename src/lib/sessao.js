import api from '../api';

/*
 * Confere no servidor se a sessao guardada no navegador ainda vale.
 *
 * O token carrega uma impressao da senha. Se a senha ou o login mudaram
 * no banco, o servidor responde 401 e a sessao e apagada - a pessoa cai
 * na tela de entrar. Sem internet o servidor nao responde; ai a sessao
 * fica como esta, para nao derrubar ninguem por falha de rede.
 */
export function limparSessao() {
  try {
    localStorage.removeItem('petshop_token');
    localStorage.removeItem('petshop_user');
  } catch (_) { /* sem localStorage */ }
}

export async function conferirSessao() {
  try {
    const r = await api.get('/auth/sessao');
    if (!r.data?.ok) { limparSessao(); return null; }
    const user = r.data.user;
    try { localStorage.setItem('petshop_user', JSON.stringify(user)); } catch (_) { /* ignora */ }
    return user;
  } catch (e) {
    if (e.response && (e.response.status === 401 || e.response.status === 403)) {
      limparSessao();
      return null;
    }
    return undefined; // servidor fora do ar: mantem o que esta
  }
}
