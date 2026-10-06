import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// 🚀 POLYFILL: Parche de seguridad para entornos sin SSL (HTTP)
// Esto permite que los botones guarden datos en la IP pública
if (!window.crypto) {
  window.crypto = {};
}
if (!window.crypto.randomUUID) {
  window.crypto.randomUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };
}

// Importar y arrancar el motor offline (Service Worker)
import { registerSW } from 'virtual:pwa-register'
registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)