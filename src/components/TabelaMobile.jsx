import { useEffect } from 'react';

/*
 * No celular, tabela larga vira rolagem lateral e ninguem le. Aqui cada
 * celula recebe o titulo da sua coluna em `data-rotulo`, e o CSS (dentro
 * do @media de telas pequenas) usa isso para transformar cada linha num
 * cartaozinho com "Nome: valor".
 *
 * Nada muda no desktop: `data-rotulo` e so um atributo, nao aparece.
 * Fica montado uma vez no layout do PDV e vigia o conteudo, entao serve
 * para qualquer tabela nova sem precisar mexer na pagina.
 */
export default function TabelaMobile() {
  useEffect(() => {
    const area = document.querySelector('.main-content');
    if (!area) return undefined;

    let agendado = false;

    function etiquetar() {
      agendado = false;
      const tabelas = area.querySelectorAll('table.data-table');
      for (const tabela of tabelas) {
        const titulos = Array.from(tabela.querySelectorAll('thead th'))
          .map((th) => th.textContent.trim());
        if (titulos.length === 0) continue;

        for (const linha of tabela.querySelectorAll('tbody tr')) {
          const celulas = linha.children;
          // linha de "nenhum registro" usa colspan: nao tem coluna para rotular
          if (celulas.length !== titulos.length) continue;
          for (let i = 0; i < celulas.length; i++) {
            const titulo = titulos[i];
            if (!titulo) continue;
            if (celulas[i].getAttribute('data-rotulo') !== titulo) {
              celulas[i].setAttribute('data-rotulo', titulo);
            }
          }
        }
      }
    }

    function agendar() {
      if (agendado) return;
      agendado = true;
      window.requestAnimationFrame(etiquetar);
    }

    etiquetar();
    const vigia = new MutationObserver(agendar);
    vigia.observe(area, { childList: true, subtree: true });
    return () => vigia.disconnect();
  }, []);

  return null;
}
