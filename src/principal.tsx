import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './estilos.css';
import Aplicativo from './Aplicativo';

const raiz = document.getElementById('root');
if (!raiz) throw new Error('Elemento raiz não encontrado');

createRoot(raiz).render(
  <StrictMode>
    <Aplicativo />
  </StrictMode>
);
