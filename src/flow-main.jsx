import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import FlowApp from './FlowApp';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <FlowApp />
  </StrictMode>
);
