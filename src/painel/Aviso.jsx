import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

/* Avisos curtos no canto da tela (sucesso / erro). */

const Contexto = createContext(null);

export function useAviso() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useAviso precisa estar dentro de <ProvedorDeAvisos>');
  return ctx;
}

export function ProvedorDeAvisos({ children }) {
  const [avisos, setAvisos] = useState([]);

  const remover = useCallback((id) => {
    setAvisos((atuais) => atuais.filter((a) => a.id !== id));
  }, []);

  const mostrar = useCallback((texto, tipo) => {
    const id = Date.now() + Math.random();
    setAvisos((atuais) => atuais.concat([{ id, texto, tipo }]));
    setTimeout(() => remover(id), 4200);
  }, [remover]);

  const valor = {
    sucesso: (t) => mostrar(t, 'sucesso'),
    erro: (t) => mostrar(t, 'erro'),
  };

  return (
    <Contexto.Provider value={valor}>
      {children}
      <div className="pn-avisos">
        {avisos.map((a) => (
          <div key={a.id} className={`pn-aviso ${a.tipo}`}>
            {a.tipo === 'sucesso' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{a.texto}</span>
            <button onClick={() => remover(a.id)} aria-label="Fechar"><X size={15} /></button>
          </div>
        ))}
      </div>
    </Contexto.Provider>
  );
}
