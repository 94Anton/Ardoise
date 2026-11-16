// Petites icônes dessinées au trait (SVG), toutes sur une grille 24 × 24.
// Usage : <Icone nom="plus" /> ; la couleur suit celle du texte.

const TRACES = {
  // Les bâtons de l'ardoise : quatre traits barrés d'un cinquième
  accueil: <path d="M5 4.5v15M9.7 4.5v15M14.3 4.5v15M19 4.5v15M2.5 16.5l19-9" />,
  historique: <path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h12M3.5 6.5h.5M3.5 12h.5M3.5 17.5h.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  stats: <path d="M5 20V11M12 20V4M19 20v-6" />,
  menu: <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth="3.2" />,
  fermer: <path d="M6 6l12 12M18 6L6 18" />,
  retour: <path d="M15 5l-7 7 7 7" />,
  chevron: <path d="M9 5l7 7-7 7" />,
  recherche: <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" />,
  etoile: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" />,
  corbeille: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5h10L18 7M9 7V4h6v3" />,
  crayon: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  reprise: <path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5" />,
  coche: <path d="M5 12.5l4.5 4.5L19 7" />,
  alerte: <path d="M12 4l9 16H3zM12 10v5M12 17.6v.2" />,
  horloge: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3.5 2" />,
  partage: <path d="M12 15V3.5M7.5 7.5L12 3l4.5 4.5M5 12v8h14v-8" />,
};

export function Icone({ nom, taille = 24, plein = false, ...autres }) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill={plein ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...autres}
    >
      {TRACES[nom]}
    </svg>
  );
}
