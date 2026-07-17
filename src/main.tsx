import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import PokerApp from './poker/PokerApp.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PokerApp />
  </StrictMode>,
);
