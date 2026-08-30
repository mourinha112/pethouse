import React, { useState, useEffect, useRef, useMemo } from 'react';
import api from '../api';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import Loading from '../components/Loading';
import ConfirmModal from '../components/ConfirmModal';
import { Camera, Link2, Trash2, X, Check, ImageOff } from 'lucide-react';

/*
 * Fotos da loja online.
 *
 * Nao existe base publica com as racoes que a loja vende (Golden, Premier,
 * Quatree e as marcas regionais nao estao em nenhum catalogo aberto), entao
 * a foto vem de voce, de tres jeitos: arquivo que voce baixou no computador,
 * foto tirada na hora com o celular, ou link colado. O trabalho chato
 * (encolher, cortar, tirar o fundo) o navegador faz sozinho aqui.
 */

const LADO = 800;          // foto final quadrada
const MAX_ANTES = 1000;    // tamanho de trabalho antes de limpar o fundo

/** Le o arquivo escolhido e devolve um <img> ja carregado. */
function carregarImagem(arquivo) {
  return new Promise((ok, falha) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); falha(new Error('Imagem invalida')); };
    img.src = url;
  });
}

/**
 * Tira o fundo por preenchimento a partir das bordas: so apaga o que
 * encosta na moldura e tem a cor parecida com os cantos. Funciona bem em
 * foto contra parede clara; em fundo baguncado, nao mexe no produto.
 */
function cantosTransparentes(ctx, largura, altura) {
  const px = ctx.getImageData(0, 0, largura, altura).data;
  const cantos = [0, (largura - 1) * 4, (altura - 1) * largura * 4, (altura * largura - 1) * 4];
  return cantos.every((c) => px[c + 3] < 12);
}

function limparFundo(ctx, largura, altura, tolerancia = 42) {
  const img = ctx.getImageData(0, 0, largura, altura);
  const px = img.data;

  // cor de referencia: media dos quatro cantos
  const cantos = [0, (largura - 1) * 4, (altura - 1) * largura * 4, (altura * largura - 1) * 4];
  let r = 0, g = 0, b = 0;
  for (const c of cantos) { r += px[c]; g += px[c + 1]; b += px[c + 2]; }
  r /= 4; g /= 4; b /= 4;

  const parecido = (i) => {
    const d = Math.abs(px[i] - r) + Math.abs(px[i + 1] - g) + Math.abs(px[i + 2] - b);
    return d < tolerancia * 3;
  };

  const visto = new Uint8Array(largura * altura);
  const fila = [];

  const enfileirar = (x, y) => {
    const p = y * largura + x;
    if (visto[p]) return;
    if (!parecido(p * 4)) return;
    visto[p] = 1;
    fila.push(p);
  };

  for (let x = 0; x < largura; x++) { enfileirar(x, 0); enfileirar(x, altura - 1); }
  for (let y = 0; y < altura; y++) { enfileirar(0, y); enfileirar(largura - 1, y); }

  while (fila.length) {
    const p = fila.pop();
    const x = p % largura;
    const y = (p - x) / largura;
    if (x > 0) enfileirar(x - 1, y);
    if (x < largura - 1) enfileirar(x + 1, y);
    if (y > 0) enfileirar(x, y - 1);
    if (y < altura - 1) enfileirar(x, y + 1);
  }

  // alpha com uma borda suave, para nao ficar recorte serrilhado
  for (let p = 0; p < visto.length; p++) {
    if (!visto[p]) continue;
    const x = p % largura;
    const y = (p - x) / largura;
    let vizinhosCheios = 0;
    if (x > 0 && !visto[p - 1]) vizinhosCheios++;
    if (x < largura - 1 && !visto[p + 1]) vizinhosCheios++;
    if (y > 0 && !visto[p - largura]) vizinhosCheios++;
    if (y < altura - 1 && !visto[p + largura]) vizinhosCheios++;
    px[p * 4 + 3] = vizinhosCheios > 0 ? 110 : 0;
  }

  ctx.putImageData(img, 0, 0);

  // sobrou produto? (se apagou quase tudo, o fundo nao era uniforme)
  const apagados = visto.reduce((s, v) => s + v, 0);
  return apagados / visto.length < 0.93;
}

/** Recorta o que sobrou de conteudo, para o produto ocupar o quadro. */
function caixaDoConteudo(ctx, largura, altura) {
  const px = ctx.getImageData(0, 0, largura, altura).data;
  let x0 = largura, y0 = altura, x1 = -1, y1 = -1;
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      if (px[(y * largura + x) * 4 + 3] > 12) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Pipeline completo: encolhe, (opcional) tira o fundo, centraliza em quadrado. */
async function prepararFoto(arquivo, tirarFundo) {
  const img = await carregarImagem(arquivo);

  const escala = Math.min(1, MAX_ANTES / Math.max(img.width, img.height));
  const lg = Math.max(1, Math.round(img.width * escala));
  const al = Math.max(1, Math.round(img.height * escala));

  const tela = document.createElement('canvas');
  tela.width = lg; tela.height = al;
  const ctx = tela.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, lg, al);

  let corte = { x: 0, y: 0, w: lg, h: al };

  // PNG que ja veio recortado nao precisa de nada: so centralizar.
  const jaRecortada = cantosTransparentes(ctx, lg, al);
  let deuCerto = jaRecortada;

  if (jaRecortada || tirarFundo) {
    if (!jaRecortada) deuCerto = limparFundo(ctx, lg, al);
    if (deuCerto) {
      const caixa = caixaDoConteudo(ctx, lg, al);
      if (caixa) {
        const folga = Math.round(Math.max(caixa.w, caixa.h) * 0.04);
        corte = {
          x: Math.max(0, caixa.x - folga),
          y: Math.max(0, caixa.y - folga),
          w: Math.min(lg, caixa.w + folga * 2),
          h: Math.min(al, caixa.h + folga * 2),
        };
      }
    }
  }

  const saida = document.createElement('canvas');
  saida.width = LADO; saida.height = LADO;
  const sctx = saida.getContext('2d');
  if (!tirarFundo || !deuCerto) {
    sctx.fillStyle = '#FFF3E4';
    sctx.fillRect(0, 0, LADO, LADO);
  }

  const k = Math.min(LADO / corte.w, LADO / corte.h) * 0.92;
  const dw = corte.w * k;
  const dh = corte.h * k;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(tela, corte.x, corte.y, corte.w, corte.h, (LADO - dw) / 2, (LADO - dh) / 2, dw, dh);

  const transparente = deuCerto;
  const blob = await new Promise((ok) => saida.toBlob(
    ok,
    transparente ? 'image/png' : 'image/jpeg',
    transparente ? undefined : 0.85,
  ));

  return {
    blob, transparente, jaRecortada,
    preview: saida.toDataURL(transparente ? 'image/png' : 'image/jpeg', 0.7),
  };
}

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
      if (termo && !`${p.marca || ''} ${p.nome}`.toLowerCase().includes(termo)) return false;
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
      const caminho = `produto-${produto.id}.${transparente ? 'png' : 'jpg'}`;
      const { error: erroUp } = await supabase.storage
        .from('produtos')
        .upload(caminho, blob, {
          upsert: true,
          contentType: transparente ? 'image/png' : 'image/jpeg',
        });

      if (erroUp) {
        toast.error(
          erroUp.message?.includes('Bucket not found')
            ? 'Rode antes a migracao 002_fotos_produtos.sql no Supabase'
            : `Erro no envio: ${erroUp.message}`,
        );
        return;
      }

      const { data: pub } = supabase.storage.from('produtos').getPublicUrl(caminho);
      // o endereco nao muda quando a foto e trocada, entao o ?v evita cache velho
      const url = `${pub.publicUrl}?v=${Date.now()}`;

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
