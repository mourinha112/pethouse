import React, { useState, useEffect, useRef, useMemo } from 'react';
import api from '../api';
import { prepararFoto, enviarFoto } from '../lib/foto';
import { useToast } from '../components/Toast';
import Loading from '../components/Loading';
import ConfirmModal from '../components/ConfirmModal';
import { Camera, Link2, Trash2, X, Check, ImageOff } from 'lucide-react';
import { combina, textoDoProduto } from '../lib/busca';

/*
 * Fotos da loja online.
 *
 * Nao existe base publica com as racoes que a loja vende (Golden, Premier,
 * Quatree e as marcas regionais nao estao em nenhum catalogo aberto), entao
 * a foto vem de voce, de tres jeitos: arquivo que voce baixou no computador,
 * foto tirada na hora com o celular, ou link colado. O trabalho chato
 * (encolher, cortar, tirar o fundo) o navegador faz sozinho aqui.
 */

export default function Photos() {
  const toast = useToast();
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState('sem_foto');
  const [soComEstoque, setSoComEstoque] = useState(false);
  const [busca, setBusca] = useState('');
  const [tirarFundo, setTirarFundo] = useState(true);

  const [processando, setProcessando] = useState(null);
  const [previa, setPrevia] = useState(null);   // { produto, blob, preview, ... }
  const [colando, setColando] = useState(null); // produto
  const [link, setLink] = useState('');
  const [removendo, setRemovendo] = useState(null);
  const [arrastando, setArrastando] = useState(null);

  const inputRef = useRef(null);
  const alvoRef = useRef(null);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    try {
      const res = await api.get('/products');
      setProdutos((res.data || []).filter((p) => !p.categoria || p.categoria === 'racao'));
    } catch (err) {
      toast.error('Erro ao carregar produtos');
    } finally {
      setCarregando(false);
    }
  }

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return produtos.filter((p) => {
      if (filtro === 'sem_foto' && p.foto_url) return false;
      if (filtro === 'com_foto' && !p.foto_url) return false;
      if (soComEstoque && !((p.estoque_kg || 0) > 0)) return false;
      if (termo && !combina(textoDoProduto(p), busca)) return false;
      return true;
    }).sort((a, b) => (b.estoque_kg || 0) - (a.estoque_kg || 0));
  }, [produtos, filtro, soComEstoque, busca]);

  function escolherArquivo(produto) {
    alvoRef.current = produto;
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.click();
    }
  }

  async function aoEscolher(e) {
    await tratarArquivo(e.target.files?.[0], alvoRef.current);
  }

  async function tratarArquivo(arquivo, produto) {
    if (!arquivo || !produto) return;
    if (!arquivo.type.startsWith('image/')) {
      toast.error('Isso nao e uma imagem');
      return;
    }

    setProcessando(produto.id);
    try {
      const resultado = await prepararFoto(arquivo, tirarFundo);
      setPrevia({ produto, ...resultado });
    } catch (err) {
      toast.error('Nao consegui ler essa imagem');
    } finally {
      setProcessando(null);
    }
  }

  async function salvarPrevia() {
    const { produto, blob, transparente } = previa;
    setProcessando(produto.id);
    try {
      const url = await enviarFoto(`produto-${produto.id}`, blob, transparente);
      await api.put(`/products/${produto.id}`, { foto_url: url });
      setProdutos((atual) => atual.map((p) => (p.id === produto.id ? { ...p, foto_url: url } : p)));
      setPrevia(null);
      toast.success('Foto salva!');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setProcessando(null);
    }
  }

  async function salvarLink() {
    const produto = colando;
    const url = link.trim();
    if (!url) return;
    setProcessando(produto.id);
    try {
      await api.put(`/products/${produto.id}`, { foto_url: url });
      setProdutos((atual) => atual.map((p) => (p.id === produto.id ? { ...p, foto_url: url } : p)));
      setColando(null);
      setLink('');
      toast.success('Foto salva!');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setProcessando(null);
    }
  }

  async function removerFoto() {
    const produto = removendo;
    setRemovendo(null);
    setProcessando(produto.id);
    try {
      await api.put(`/products/${produto.id}`, { foto_url: null });
      setProdutos((atual) => atual.map((p) => (p.id === produto.id ? { ...p, foto_url: null } : p)));
      toast.success('Foto removida');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessando(null);
    }
  }

  if (carregando) return <Loading />;

  const semFoto = produtos.filter((p) => !p.foto_url).length;

  return (
    <div className="page page-wide">
      <div className="page-header">
        <h1 className="page-title">Fotos da loja</h1>
        <span className="page-date">{semFoto} de {produtos.length} rações ainda sem foto</span>
      </div>

      <div className="foto-aviso">
        Três jeitos de pôr a foto: <strong>arraste um arquivo</strong> em cima do quadrado,
        clique em <strong>Foto</strong> para escolher do computador (ou tirar na hora, no celular),
        ou <strong>cole o link</strong>. O sistema encolhe, centraliza e tira o fundo sozinho.
        Se o fundo estiver bagunçado, ele desiste de recortar e mantém a foto inteira — nunca
        come pedaço do produto. <strong>Imagem baixada do site do fornecedor, em fundo branco,
        é o que recorta melhor.</strong>
      </div>

      <div className="products-filters">
        <input className="filter-input" placeholder="Buscar nome ou marca..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select className="filter-select" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="sem_foto">Sem foto</option>
          <option value="com_foto">Com foto</option>
          <option value="todas">Todas</option>
        </select>
        <label className="loja-switch">
          <input type="checkbox" checked={soComEstoque} onChange={(e) => setSoComEstoque(e.target.checked)} />
          <span>Só com estoque</span>
        </label>
        <label className="loja-switch">
          <input type="checkbox" checked={tirarFundo} onChange={(e) => setTirarFundo(e.target.checked)} />
          <span>Tirar o fundo</span>
        </label>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={aoEscolher}
      />

      {lista.length === 0 && (
        <div className="table-empty" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
          Nenhuma ração nesse filtro.
        </div>
      )}

      <div className="foto-grade">
        {lista.map((p) => (
          <div className="foto-card" key={p.id}>
            <div
              className={`foto-quadro ${arrastando === p.id ? 'arrastando' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setArrastando(p.id); }}
              onDragLeave={() => setArrastando(null)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastando(null);
                tratarArquivo(e.dataTransfer.files?.[0], p);
              }}
              title="Arraste uma imagem aqui"
            >
              {p.foto_url
                ? <img src={p.foto_url} alt={p.nome} loading="lazy" />
                : <ImageOff size={32} color="#cfc4bd" />}
            </div>
            <div className="foto-info">
              <div className="foto-marca">{p.marca || 'sem marca'}</div>
              <div className="foto-nome">{p.nome}</div>
              <div className="foto-estoque">
                {(p.estoque_kg || 0) > 0 ? `${p.estoque_kg} kg em estoque` : 'sem estoque'}
              </div>
            </div>
            <div className="foto-acoes">
              <button className="btn btn-primary btn-sm" disabled={processando === p.id} onClick={() => escolherArquivo(p)}>
                <Camera size={15} /> {processando === p.id ? '...' : p.foto_url ? 'Trocar' : 'Foto'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setColando(p); setLink(p.foto_url || ''); }}>
                <Link2 size={15} />
              </button>
              {p.foto_url && (
                <button className="btn btn-delete btn-sm" onClick={() => setRemovendo(p)}>
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {previa && (
        <div className="modal-overlay" onClick={() => setPrevia(null)}>
          <div className="modal modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Ficou boa?</h2>
              <button className="btn-icon" onClick={() => setPrevia(null)}><X size={18} /></button>
            </div>
            <div style={{ padding: '0 1.25rem 1.25rem' }}>
              <div className="foto-previa">
                <img src={previa.preview} alt="Prévia" />
              </div>
              <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.75rem' }}>
                <strong>{previa.produto.marca} {previa.produto.nome}</strong><br />
                {previa.jaRecortada
                  ? 'Essa imagem já veio sem fundo — só centralizei.'
                  : previa.transparente
                    ? 'Fundo removido — vai ficar recortada na loja.'
                    : tirarFundo
                      ? 'O fundo não era uniforme o suficiente, então mantive a foto inteira.'
                      : 'Foto inteira, sem recorte de fundo.'}
              </p>
              <div className="form-actions" style={{ marginTop: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => setPrevia(null)}>Descartar</button>
                <button className="btn btn-primary" disabled={processando} onClick={salvarPrevia}>
                  <Check size={16} /> {processando ? 'Enviando...' : 'Usar essa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {colando && (
        <div className="modal-overlay" onClick={() => setColando(null)}>
          <div className="modal modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Link da foto</h2>
              <button className="btn-icon" onClick={() => setColando(null)}><X size={18} /></button>
            </div>
            <div style={{ padding: '0 1.25rem 1.25rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.75rem' }}>
                {colando.marca} {colando.nome}
              </p>
              <div className="form-group">
                <label>Endereço da imagem</label>
                <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." autoFocus />
              </div>
              {link.trim() && (
                <div className="foto-previa" style={{ marginTop: '0.75rem' }}>
                  <img src={link.trim()} alt="Prévia" onError={(e) => { e.currentTarget.style.opacity = 0.15; }} />
                </div>
              )}
              <div className="form-actions" style={{ marginTop: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => setColando(null)}>Cancelar</button>
                <button className="btn btn-primary" disabled={!link.trim()} onClick={salvarLink}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {removendo && (
        <ConfirmModal
          title="Remover a foto?"
          message={`${removendo.marca || ''} ${removendo.nome} volta a aparecer com o desenho de saco na loja.`}
          confirmText="Remover"
          danger
          onConfirm={removerFoto}
          onCancel={() => setRemovendo(null)}
        />
      )}
    </div>
  );
}
