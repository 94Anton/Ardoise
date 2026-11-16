// ---------------------------------------------------------------------------
// Données préremplies au tout premier lancement (et après une réinitialisation).
// Tout reste modifiable ensuite depuis l'appli.
// ---------------------------------------------------------------------------

/**
 * Catégories de départ. `couleur` sert dans les graphiques ; `alcoolisee: false`
 * désigne les diluants (sirop, jus, soda…) utilisés dans les cocktails.
 */
export const CATEGORIES_INITIALES = [
  { nom: 'Bière', couleur: '#dd8a1c', alcoolisee: true },
  { nom: 'Vin rouge', couleur: '#b8405a', alcoolisee: true },
  { nom: 'Vin blanc', couleur: '#a3a23a', alcoolisee: true },
  { nom: 'Vin rosé', couleur: '#e07a9c', alcoolisee: true },
  { nom: 'Champagne et mousseux', couleur: '#bfa56a', alcoolisee: true },
  { nom: 'Cidre', couleur: '#7fae3a', alcoolisee: true },
  { nom: 'Whisky', couleur: '#b5651d', alcoolisee: true },
  { nom: 'Rhum', couleur: '#8a5a3c', alcoolisee: true },
  { nom: 'Vodka', couleur: '#6aa8de', alcoolisee: true },
  { nom: 'Gin', couleur: '#2f9e86', alcoolisee: true },
  { nom: 'Tequila', couleur: '#5b6fd6', alcoolisee: true },
  { nom: 'Liqueur', couleur: '#9a5fd0', alcoolisee: true },
  { nom: 'Anisé', couleur: '#d9c23a', alcoolisee: true },
  { nom: 'Autre spiritueux', couleur: '#7d8a96', alcoolisee: true },
  { nom: 'Diluants (sans alcool)', couleur: '#a9b0aa', alcoolisee: false },
];

/** Contenants prédéfinis (volumes en mL). */
export const CONTENANTS_INITIAUX = [
  { nom: 'Pinte', volumeML: 500, predefini: true },
  { nom: 'Demi', volumeML: 250, predefini: true },
  { nom: 'Bouteille ou canette', volumeML: 330, predefini: true },
  { nom: 'Grande canette', volumeML: 500, predefini: true },
  { nom: 'Verre de vin', volumeML: 125, predefini: true },
  { nom: 'Flûte', volumeML: 100, predefini: true },
  { nom: 'Shot', volumeML: 40, predefini: true },
  { nom: 'Bouteille de vin', volumeML: 750, predefini: true },
];

/** Paramètres par défaut. Chaque clé est une ligne de la table `parametres`. */
export const PARAMETRES_DEFAUT = {
  poidsKg: 67, // sert à l'estimation d'alcoolémie (Widmark)
  sexe: 'homme', // 'homme' ou 'femme'
  gParVerre: 10, // grammes d'alcool pur dans un verre standard (France : 10 g)
  r: 0.7, // coefficient de Widmark (0,7 homme ; 0,6 femme)
  beta: 0.15, // vitesse d'élimination, en g/L par heure
  premierLancement: null, // instant du premier lancement (ms)
  dernierExport: null, // instant de la dernière sauvegarde JSON (ms)
  aideInstallationMasquee: false, // l'encart « installer sur l'écran d'accueil » a été fermé
};
