import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './estilos.css';
import Inicializacao from './Inicializacao';

const raiz = document.getElementById('root');
if (!raiz) throw new Error('Elemento raiz não encontrado');

createRoot(raiz).render(
  <StrictMode>
    <Inicializacao />
  </StrictMode>
);
