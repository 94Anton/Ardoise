// Point d'entrée : charge la police et les styles, enregistre le service
// worker (fonctionnement hors ligne), puis affiche l'appli.

import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
// Police embarquée dans l'appli (aucun appel à un serveur de polices).
import '@fontsource-variable/atkinson-hyperlegible-next/wght.css';
import './styles.css';
import App from './App.jsx';

// Le service worker met l'appli en cache : après la première visite, elle
// s'ouvre sans réseau. `immediate` = enregistrement dès le chargement.
registerSW({ immediate: true });

createRoot(document.getElementById('racine')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
