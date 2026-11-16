import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Numéro de version lu dans package.json, affiché dans l'écran « Plus ».
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Chemin de base du site.
//  - En local (npm run dev) : '/'
//  - Sur GitHub Pages : '/<nom-du-depot>/', renseigné automatiquement par le
//    workflow .github/workflows/deploiement.yml via la variable BASE_PATH.
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  // Remplace __VERSION_APPLI__ dans le code par le numéro de version.
  define: { __VERSION_APPLI__: JSON.stringify(version) },
  // L'appli tient dans un seul fichier JavaScript (≈ 210 Ko une fois compressé),
  // mis en cache pour le hors-ligne : on relève le seuil de l'avertissement de taille.
  build: { chunkSizeWarningLimit: 900 },
  plugins: [
    react(),
    // Transforme le site en PWA : manifest (installation sur l'écran d'accueil)
    // et service worker (fonctionnement hors ligne).
    VitePWA({
      registerType: 'autoUpdate', // une nouvelle version s'installe toute seule
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Ardoise',
        short_name: 'Ardoise',
        description: "Suivi personnel de consommation d'alcool. Les données restent sur ce téléphone.",
        lang: 'fr',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        background_color: '#171c1f',
        theme_color: '#171c1f',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Tout ce qui est listé ici est mis en cache à l'installation :
        // l'appli fonctionne ensuite sans réseau.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.js'],
    // Les tests de dates supposent le fuseau horaire français (changements d'heure compris).
    env: { TZ: 'Europe/Paris' },
  },
});
