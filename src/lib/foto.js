import { supabase } from './supabase';

/*
 * Preparo e envio de foto de produto.
 *
 * Usado na tela "Fotos da loja" e tambem no cadastro do produto, para os
 * dois se comportarem igual: encolhe, tira o fundo quando da, centraliza
 * num quadrado e manda para o Storage do Supabase.
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

/** A imagem ja veio recortada (PNG com cantos transparentes)? */
function cantosTransparentes(ctx, largura, altura) {
  const px = ctx.getImageData(0, 0, largura, altura).data;
  const cantos = [0, (largura - 1) * 4, (altura - 1) * largura * 4, (altura * largura - 1) * 4];
  return cantos.every((c) => px[c + 3] < 12);
}

/**
 * Tira o fundo por preenchimento a partir das bordas: so apaga o que
 * encosta na moldura e tem cor parecida com a dos cantos. Funciona bem em
 * fundo branco de catalogo e em foto contra parede clara; em fundo
 * baguncado devolve false e ninguem mexe no produto.
 */
function limparFundo(ctx, largura, altura, tolerancia = 42) {
  const img = ctx.getImageData(0, 0, largura, altura);
  const px = img.data;

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

  // borda suave, para nao ficar recorte serrilhado
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

  // se apagou quase tudo, o fundo nao era uniforme: melhor nem recortar
  let apagados = 0;
  for (let i = 0; i < visto.length; i++) apagados += visto[i];
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

/** Encolhe, (opcional) tira o fundo e centraliza num quadrado de 800px. */
export async function prepararFoto(arquivo, tirarFundo = true) {
  const img = await carregarImagem(arquivo);

  const escala = Math.min(1, MAX_ANTES / Math.max(img.width, img.height));
  const lg = Math.max(1, Math.round(img.width * escala));
  const al = Math.max(1, Math.round(img.height * escala));

  const tela = document.createElement('canvas');
  tela.width = lg; tela.height = al;
  const ctx = tela.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, lg, al);

  let corte = { x: 0, y: 0, w: lg, h: al };

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
  if (!deuCerto) {
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
    blob,
    transparente,
    jaRecortada,
    preview: saida.toDataURL(transparente ? 'image/png' : 'image/jpeg', 0.7),
  };
}

/**
 * Manda a foto para o Storage e devolve o endereco publico.
 * `nomeBase` costuma ser `produto-12`; para produto ainda sem id, use algo
 * unico como `novo-1712345678`.
 */
export async function enviarFoto(nomeBase, blob, transparente) {
  const caminho = `${nomeBase}.${transparente ? 'png' : 'jpg'}`;

  const { error } = await supabase.storage
    .from('produtos')
    .upload(caminho, blob, {
      upsert: true,
      contentType: transparente ? 'image/png' : 'image/jpeg',
    });

  if (error) {
    if (String(error.message || '').includes('Bucket not found')) {
      throw new Error('Rode antes a migracao 002_fotos_produtos.sql no Supabase');
    }
    throw new Error(`Erro no envio: ${error.message}`);
  }

  const { data } = supabase.storage.from('produtos').getPublicUrl(caminho);
  // o endereco nao muda quando a foto e trocada, entao o ?v evita cache velho
  return `${data.publicUrl}?v=${Date.now()}`;
}
