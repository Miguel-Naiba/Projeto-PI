import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { TelaCarregamento } from './components/UI/TelaCarregamento';

// Uma única importação: StrictMode não cria uma segunda inicialização.
const aplicativo = import('./Aplicativo');
const personagem = new Promise<void>((resolve) => {
  const imagem = new Image();
  const timer = window.setTimeout(resolve, 8000);
  const concluir = () => { window.clearTimeout(timer); resolve(); };
  imagem.onload = concluir;
  imagem.onerror = concluir;
  imagem.src = '/images/echopath-caminhada.png';
});

function AplicativoPronto({ Componente, aoMontar }: { Componente: ComponentType; aoMontar: () => void }) {
  useEffect(() => {
    // Libera a tela somente depois do commit e de uma oportunidade de pintura.
    let segundoFrame = 0;
    const primeiroFrame = requestAnimationFrame(() => {
      segundoFrame = requestAnimationFrame(aoMontar);
    });
    return () => { cancelAnimationFrame(primeiroFrame); cancelAnimationFrame(segundoFrame); };
  }, [aoMontar]);
  return <Componente />;
}

export default function Inicializacao() {
  const [Componente, setComponente] = useState<ComponentType | null>(null);
  const [progresso, setProgresso] = useState(25);
  const [erro, setErro] = useState(false);
  const [visivel, setVisivel] = useState(true);
  const [pronto] = useState(() => () => setProgresso(100));

  useEffect(() => {
    let ativo = true;
    Promise.all([aplicativo, personagem]).then(([{ default: App }]) => {
      if (!ativo) return;
      setComponente(() => App);
      setProgresso(75);
    }).catch(() => { if (ativo) setErro(true); });
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    if (progresso !== 100) return;
    const timer = window.setTimeout(() => setVisivel(false), 450);
    return () => window.clearTimeout(timer);
  }, [progresso]);

  return <>
    <div inert={visivel} aria-hidden={visivel ? true : undefined}>
      {Componente && <AplicativoPronto Componente={Componente} aoMontar={pronto} />}
    </div>
    {visivel && <TelaCarregamento progresso={progresso} saindo={progresso === 100} erro={erro} />}
  </>;
}
