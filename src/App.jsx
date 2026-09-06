import React, { Suspense, lazy } from 'react';

/*
 * Qual aplicacao desenhar ja foi decidido no main.jsx, pelo endereco.
 *
 * Cada uma carrega no navegador so o seu proprio pedaco: quem entra na loja
 * pelo celular nao baixa o painel nem o sistema de gestao junto.
 */
const Loja = lazy(() => import('./loja/Loja'));
const PainelDaLoja = lazy(() => import('./painel/Painel'));
const Pdv = lazy(() => import('./Pdv'));

const APPS = {
  loja: Loja,
  painel: PainelDaLoja,
  gestao: Pdv,
};

export default function App({ qual }) {
  const Escolhida = APPS[qual] || Loja;
  return (
    <Suspense fallback={null}>
      <Escolhida />
    </Suspense>
  );
}
