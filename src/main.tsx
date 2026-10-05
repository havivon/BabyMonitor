import '@fontsource/rubik/400.css';
import '@fontsource/rubik/500.css';
import '@fontsource/rubik/600.css';
import '@fontsource/rubik/700.css';
import './styles/tokens.css';
import './styles/global.css';
import './styles/components.css';
import './styles/app-extra.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { syncThemeWithStore } from './platform/theme';
import { appStore, enableCrossTabSync } from './store';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root element missing from index.html');

syncThemeWithStore(appStore);
enableCrossTabSync(appStore);

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
