import { useEffect, useId, useRef } from 'react';

const CICLO_MS = 1400;
const COXA = 60;
const CANELA = 60;
const CHAO = 282;
const GRAUS = 180 / Math.PI;
const ajustar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Movimento contínuo: articulações interpoladas a cada pintura, sem troca de imagens. */
export function HomemCaminhando() {
  const svg = useRef<SVGSVGElement>(null);
  const id = useId().replace(/:/g, '');
  const torso = `${id}-torso`;
  const fundo = `${id}-fundo`;

  useEffect(() => {
    const raiz = svg.current;
    if (!raiz) return;
    const movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
    const elementos = Object.fromEntries(
      Array.from(raiz.querySelectorAll<SVGGElement>('[data-articulacao]'))
        .map((el) => [el.dataset.articulacao!, el])
    );
    const transformar = (nome: string, valor: string) => elementos[nome]?.setAttribute('transform', valor);

    function pintar(fase: number) {
      const balanco = Math.cos(fase * Math.PI * 4) * 1.1;
      transformar('tronco', `translate(0 ${balanco})`);
      const moverPerna = (nome: string, p: number, x: number) => {
        const apoiada = p < .6;
        const u = apoiada ? p / .6 : (p - .6) / .4;
        const passada = apoiada ? 24 - 48 * u : -24 + 48 * (u * u * (3 - 2 * u));
        const elevacao = apoiada ? 0 : 20 * Math.sin(Math.PI * u) ** 2;
        const dy = CHAO - elevacao - (164 + balanco);
        const distancia = ajustar(Math.hypot(passada, dy), 1, COXA + CANELA - .1);
        const direcao = Math.atan2(passada, dy);
        const abertura = Math.acos(ajustar((COXA * COXA + distancia * distancia - CANELA * CANELA) / (2 * COXA * distancia), -1, 1));
        const quadril = -(direcao + abertura) * GRAUS;
        const joelho = (Math.PI - Math.acos(ajustar((COXA * COXA + CANELA * CANELA - distancia * distancia) / (2 * COXA * CANELA), -1, 1))) * GRAUS;
        const inclinacaoPe = apoiada ? 0 : -10 * Math.sin(Math.PI * u);
        transformar(`${nome}-coxa`, `translate(${x} ${164 + balanco}) rotate(${quadril})`);
        transformar(`${nome}-canela`, `translate(0 ${COXA}) rotate(${joelho})`);
        transformar(`${nome}-pe`, `translate(0 ${CANELA}) rotate(${-quadril - joelho + inclinacaoPe})`);
      };
      moverPerna('tras', (fase + .5) % 1, 141);
      moverPerna('frente', fase, 151);
      const braco = 9 * Math.sin(fase * Math.PI * 2);
      transformar('braco-tras', `translate(165 ${89 + balanco}) rotate(${-braco})`);
      transformar('braco-frente', `translate(122 ${90 + balanco}) rotate(${braco})`);
      // Bengala presa à mão. O ângulo mantém sua ponta próxima do chão.
      const rad = braco / GRAUS;
      const maoY = 90 + balanco + 23 * Math.sin(rad) + 77 * Math.cos(rad);
      const anguloBengala = -Math.acos(ajustar((CHAO + 15 - maoY) / 142, -.99, .99)) * GRAUS;
      transformar('bengala', `translate(23 77) rotate(${anguloBengala - braco})`);
    }

    let frame = 0;
    let inicio: number | null = null;
    const animar = (tempo: number) => {
      inicio ??= tempo;
      pintar(((tempo - inicio) % CICLO_MS) / CICLO_MS);
      frame = requestAnimationFrame(animar);
    };
    const atualizar = () => {
      cancelAnimationFrame(frame);
      inicio = null;
      pintar(.18);
      if (!movimentoReduzido.matches && !document.hidden) frame = requestAnimationFrame(animar);
    };
    atualizar();
    movimentoReduzido.addEventListener('change', atualizar);
    document.addEventListener('visibilitychange', atualizar);
    return () => {
      cancelAnimationFrame(frame);
      movimentoReduzido.removeEventListener('change', atualizar);
      document.removeEventListener('visibilitychange', atualizar);
    };
  }, []);

  const perna = (nome: string, escura: boolean) => <g data-articulacao={`${nome}-coxa`}>
    <path d="M-10 -5 Q0 -9 11 -3 L9 55 Q0 66 -9 57 Z" fill={escura ? '#094397' : '#1059b7'} />
    <path d="M5 5 L4 52" stroke={escura ? '#063780' : '#0b4fa7'} strokeWidth="2" fill="none" />
    <g data-articulacao={`${nome}-canela`}>
      <path d="M-9 -5 Q1 -10 9 -4 L7 58 Q0 62 -7 58 Z" fill={escura ? '#094397' : '#1059b7'} />
      <path d="M5 6 L4 51" stroke={escura ? '#063780' : '#0b4fa7'} strokeWidth="2" fill="none" />
      <g data-articulacao={`${nome}-pe`}>
        <path d="M-6 -4 L7 -3 L8 4 Q16 6 24 8 Q29 10 27 15 Q12 20 -9 14 Q-12 10 -8 2 Z" fill="#f9fbff" stroke="#dbe3ef" strokeWidth="1" />
        <path d="M-9 12 Q8 18 27 13" stroke="#d3dceb" strokeWidth="2" fill="none" />
        <path d="M6 4 L13 7 M4 7 L12 10 M2 10 L10 12" stroke="#d3dceb" strokeWidth="1.3" />
      </g>
    </g>
  </g>;

  return <svg ref={svg} className="ep-loading__personagem" viewBox="0 0 317 350" aria-hidden="true">
    <defs>
      {/* Recorte fixo do tronco/rosto: o atlas nunca troca de quadro. */}
      <clipPath id={torso}>
        <path d="M122 24 L173 24 L180 62 L169 79 L173 88 L171 164 Q148 173 122 165 L117 121 L108 156 L91 154 L84 136 L86 109 L94 91 L111 78 L135 72 L133 61 L126 51 Z" />
      </clipPath>
      <filter id={fundo} filterUnits="userSpaceOnUse" x="80" y="15" width="105" height="163" colorInterpolationFilters="sRGB">
        <feFlood floodColor="#032955" result="azul" />
        <feBlend in="SourceGraphic" in2="azul" mode="difference" result="diferenca" />
        <feColorMatrix in="diferenca" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 2 2 2 0 0" />
        <feComponentTransfer result="mascara"><feFuncA type="linear" slope="4" intercept="-0.25" /></feComponentTransfer>
        <feComposite in="SourceGraphic" in2="mascara" operator="in" />
      </filter>
    </defs>
    {perna('tras', true)}
    <g data-articulacao="braco-tras">
      <path d="M-7 -5 Q1 -8 7 1 L12 34 L21 62 L10 67 L0 40 L-8 11 Z" fill="#eef3fc" stroke="#dce5f3" strokeWidth="1" />
      <path d="M10 66 L21 62 L25 72 Q29 80 23 86 L20 79 L20 86 Q15 87 13 81 Z" fill="#ffb282" />
      <path d="M20 71 L24 79" stroke="#e59365" strokeWidth="1.3" />
    </g>
    {perna('frente', false)}
    <g data-articulacao="tronco">
      <path d="M124 156 Q146 164 170 155 L168 177 Q147 184 124 175 Z" fill="#1059b7" />
      <g clipPath={`url(#${torso})`}>
        <image href="/images/echopath-caminhada.png" width="1268" height="1241" filter={`url(#${fundo})`} />
      </g>
    </g>
    <g data-articulacao="braco-frente">
      <path d="M-9 -5 Q1 -12 10 -4 Q13 7 8 27 L14 42 L24 66 L12 72 L-1 49 Q-9 37 -11 23 Z" fill="#fbfcff" stroke="#dce5f3" strokeWidth="1" />
      <path d="M-7 27 Q-1 37 9 44 L19 67" stroke="#e8edf8" strokeWidth="3" fill="none" />
      <g data-articulacao="bengala">
        <path d="M0 0 L0 142" stroke="#f9fbff" strokeWidth="3.1" strokeLinecap="round" />
        <path d="M0 114 L0 137" stroke="#f12a38" strokeWidth="3.3" />
        <path d="M0 -3 L0 12" stroke="#151c28" strokeWidth="4.4" strokeLinecap="round" />
        <circle cy="142" r="4" fill="#fff" stroke="#cdd5e5" strokeWidth=".7" />
      </g>
      <path d="M12 70 L24 65 L27 72 L30 79 Q29 83 27 82 L24 77 L26 87 Q23 90 21 85 L18 77 L20 87 Q17 89 15 84 Z" fill="#ffb282" />
      <path d="M24 72 L26 78 M19 74 L22 83" stroke="#e69a6e" strokeWidth="1.1" fill="none" />
    </g>
  </svg>;
}
