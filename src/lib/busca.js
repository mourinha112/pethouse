/*
 * Busca de produtos.
 *
 * O jeito antigo procurava a frase inteira dentro de UM campo só, então
 * "Golden Formula Filhotes" não achava nada: "Golden" está em `marca` e
 * "Formula Filhotes" está em `nome`, e a frase toda não cabe em nenhum
 * dos dois. Aqui cada palavra é procurada separadamente no texto inteiro,
 * sem acento e sem ligar para maiúscula — então funciona digitando só o
 * começo, o nome todo, ou as palavras fora de ordem.
 */

export function normalizar(texto) {
  return String(texto == null ? '' : texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // tira acento
    .replace(/\s+/g, ' ')
    .trim();
}

/*
 * Tira o "s" do plural de palavras com mais de 3 letras. Como a busca e por
 * pedaco de texto, procurar "filhote" acha tanto "Filhote" quanto "Filhotes",
 * e "racas" vira "raca", que acha "Racas Pequenas".
 */
function radical(palavra) {
  return palavra.length > 3 && palavra.endsWith('s') ? palavra.slice(0, -1) : palavra;
}

/** Todas as palavras da consulta aparecem no texto? */
export function combina(texto, consulta) {
  const termos = normalizar(consulta).split(' ').filter(Boolean);
  if (termos.length === 0) return true;
  const alvo = normalizar(texto);
  return termos.every((t) => alvo.includes(radical(t)));
}

/** Texto onde vale a pena procurar um produto. */
export function textoDoProduto(p) {
  return `${p.marca || ''} ${p.nome || ''} ${p.categoria || ''}`;
}

/**
 * Filtra e ordena: quem começa com o que foi digitado sobe, depois
 * quem tem estoque. No balcão isso importa mais que ordem alfabética.
 */
export function filtrarProdutos(produtos, consulta, limite) {
  const termo = normalizar(consulta);
  if (!termo) return limite ? produtos.slice(0, limite) : produtos;

  const achados = produtos.filter((p) => combina(textoDoProduto(p), consulta));

  achados.sort((a, b) => {
    const ca = normalizar(textoDoProduto(a)).startsWith(termo) ? 0 : 1;
    const cb = normalizar(textoDoProduto(b)).startsWith(termo) ? 0 : 1;
    if (ca !== cb) return ca - cb;
    const ea = (a.estoque_kg || 0) + (a.estoque_unidade || 0) > 0 ? 0 : 1;
    const eb = (b.estoque_kg || 0) + (b.estoque_unidade || 0) > 0 ? 0 : 1;
    if (ea !== eb) return ea - eb;
    return String(a.nome || '').localeCompare(String(b.nome || ''));
  });

  return limite ? achados.slice(0, limite) : achados;
}
