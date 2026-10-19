/** Ícones decorativos; o controle pai fornece nome e estado acessíveis. */
export function Icone({ nome }: { nome: 'microfone' | 'microfone-ativo' | 'obras' | 'aviso' }) {
  return (
    <svg className={`icone-vetorial icone-vetorial--${nome}`} aria-hidden="true" focusable="false" width="24" height="24">
      <use href={`/icons.svg#${nome}`} />
    </svg>
  );
}
