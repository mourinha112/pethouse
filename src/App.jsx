import React, { Suspense, lazy } from 'react';
import { useLocation } from 'react-router-dom';

/*
 * Duas aplicacoes moram no mesmo deploy:
 *
 *   /loja  -> loja online, publica, sem login (o cliente pedindo racao)
 *   resto  -> PDV de gestao, atras do login
 *
 * Cada uma carrega no navegador so o seu proprio pedaco: quem entra na
 * loja pelo celular nao baixa o sistema de gestao inteiro junto.
 */
const Loja = lazy(() => import('./loja/Loja'));
const Pdv = lazy(() => import('./Pdv'));

export default function App() {
  const { pathname } = useLocation();
  const naLoja = pathname === '/loja' || pathname.startsWith('/loja/');

  return (
    <Suspense fallback={null}>
      {naLoja ? <Loja /> : <Pdv />}
    </Suspense>
  );
}
