import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import AppRoot from './poker/AppRoot.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
);
