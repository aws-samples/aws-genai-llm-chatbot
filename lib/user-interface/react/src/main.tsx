import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import AppConfigured from './components/app-configured';

import '@cloudscape-design/global-styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppConfigured />
  </React.StrictMode>,
);
