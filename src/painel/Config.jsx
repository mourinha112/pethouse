import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAviso } from './Aviso';
import { Save, ExternalLink, Users, Store } from 'lucide-react';

/*
 * Configuracoes da loja online. Conta e permissao ficam na gestao, em
 * /admin > Configuracoes: sao os mesmos usuarios, e ter dois lugares para
 * mexer nisso so daria chance de divergir.
 */

export default function Config({ usuario }) {
  const aviso = useAviso();
  const [cfg, setCfg] = useState({
    nome_loja: '', loja_aberta: 'true', whatsapp_loja: '', endereco_loja: '',
    email_loja: '', cnpj_loja: '',
    frete_valor: '9.90', frete_gratis_acima: '99', pedido_minimo: '0',
  });
  const [salvando, setSalvando] = useState(false);


  useEffect(() => { carregar(); }, []);

  async function carregar() {
    try {
      const c = await api.get('/settings');
      setCfg((atual) => ({ ...atual, ...c.data }));
    } catch (err) {
      aviso.erro('Erro ao carregar as configurações');
    } finally {
      setCarregando(false);
    }
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api.put('/settings', {
        ...cfg,
        whatsapp_loja: String(cfg.whatsapp_loja || '').replace(/\D/g, ''),
      });
      aviso.sucesso('Configurações salvas');
    } catch (err) {
      aviso.erro(err.response?.data?.error || 'Não consegui salvar');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <div className="pn-carregando">Carregando…</div>;

  const enderecoDoCatalogo = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="pn-pagina">
      <header className="pn-cabecalho">
        <h1>Configurações</h1>
      </header>

      <section className="pn-secao">
        <h2><Store size={17} /> A loja</h2>

        <div className="pn-link-loja">
          <div>
            <span>Link para mandar aos clientes</span>
            <strong>{enderecoDoCatalogo}</strong>
          </div>
          <a className="pn-btn pn-btn-claro" href="/" target="_blank" rel="noopener noreferrer">
            <ExternalLink size={15} /> Abrir
          </a>
        </div>

        <form onSubmit={salvar}>
          <label className="pn-marcador" style={{ margin: '1rem 0' }}>
            <input
              type="checkbox"
              checked={cfg.loja_aberta !== 'false'}
              onChange={(e) => setCfg({ ...cfg, loja_aberta: e.target.checked ? 'true' : 'false' })}
            />
            <span>Aceitando pedidos agora</span>
          </label>

          <div className="pn-linha">
            <label className="pn-campo">
              <span>Nome da loja</span>
              <input value={cfg.nome_loja || ''} onChange={(e) => setCfg({ ...cfg, nome_loja: e.target.value })}
                placeholder="Aparece no topo do catálogo" />
            </label>
            <label className="pn-campo">
              <span>WhatsApp (só números, com DDD)</span>
              <input value={cfg.whatsapp_loja || ''} onChange={(e) => setCfg({ ...cfg, whatsapp_loja: e.target.value })}
                placeholder="21999999999" inputMode="numeric" />
            </label>
          </div>

          <label className="pn-campo">
            <span>Endereço mostrado no catálogo</span>
            <input value={cfg.endereco_loja || ''} onChange={(e) => setCfg({ ...cfg, endereco_loja: e.target.value })}
              placeholder="Rua, número, bairro" />
          </label>

          <div className="pn-linha">
            <label className="pn-campo">
              <span>E-mail</span>
              <input value={cfg.email_loja || ''} onChange={(e) => setCfg({ ...cfg, email_loja: e.target.value })}
                placeholder="contato@sualoja.com" inputMode="email" />
            </label>
            <label className="pn-campo">
              <span>CNPJ</span>
              <input value={cfg.cnpj_loja || ''} onChange={(e) => setCfg({ ...cfg, cnpj_loja: e.target.value })}
                placeholder="00.000.000/0001-00" />
            </label>
          </div>

          <div className="pn-linha">
            <label className="pn-campo">
              <span>Taxa de entrega (R$)</span>
              <input value={cfg.frete_valor || ''} onChange={(e) => setCfg({ ...cfg, frete_valor: e.target.value })}
                inputMode="decimal" />
            </label>
            <label className="pn-campo">
              <span>Entrega grátis acima de (R$)</span>
              <input value={cfg.frete_gratis_acima || ''} onChange={(e) => setCfg({ ...cfg, frete_gratis_acima: e.target.value })}
                inputMode="decimal" />
            </label>
            <label className="pn-campo">
              <span>Pedido mínimo (R$)</span>
              <input value={cfg.pedido_minimo || ''} onChange={(e) => setCfg({ ...cfg, pedido_minimo: e.target.value })}
                inputMode="decimal" />
            </label>
          </div>

          <p className="pn-dica">
            Sem o WhatsApp preenchido, o botão “Falar no WhatsApp” não aparece para o cliente
            no fim do pedido.
          </p>

          <div className="pn-modal-acoes" style={{ justifyContent: 'flex-start' }}>
            <button className="pn-btn pn-btn-primario" type="submit" disabled={salvando}>
              <Save size={16} /> {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </section>

      <section className="pn-secao">
        <h2><Users size={17} /> Quem acessa</h2>
        <p className="pn-secao-nota">
          O login é o mesmo do sistema de gestão. Para criar ou remover
          usuário, entre em <a href="/admin/settings">/admin › Configurações</a>.
        </p>
      </section>


    </div>
  );
}
