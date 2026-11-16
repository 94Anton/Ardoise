// ---------------------------------------------------------------------------
// Fabrique un jeu de données de DÉMONSTRATION (fictif), au format des
// sauvegardes de l'appli : demo/ardoise-demo.json.
//
// Usage :  npm run demo            (données calées sur la date du jour)
//          npm run demo -- 2026-11-15T12:00
//
// Le fichier s'importe depuis Paramètres → « Restaurer une sauvegarde ».
// Attention : une restauration REMPLACE toutes les données de l'appli.
//
// Les boissons n'ont volontairement ni calories ni sucre renseignés (sauf
// l'eau gazeuse, qui n'en contient pas) : on n'invente pas de valeurs
// nutritionnelles. La démo montre donc aussi le cas « données incomplètes ».
// ---------------------------------------------------------------------------

import { mkdirSync, writeFileSync } from 'node:fs';
import { snapshotBoisson, snapshotCocktail } from '../src/calculs/alcool.js';
import { ajouterJours, debutJour, debutSemaine } from '../src/calculs/periodes.js';
import { CATEGORIES_INITIALES, CONTENANTS_INITIAUX } from '../src/donnees/valeursInitiales.js';

const maintenant = process.argv[2] ? new Date(process.argv[2]).getTime() : Date.now();
if (!Number.isFinite(maintenant)) throw new Error(`Date invalide : ${process.argv[2]}`);

const MIN = 60 * 1000;
const HEURE = 60 * MIN;

// Générateur pseudo-aléatoire à graine fixe : la démo est la même à chaque fois.
let graine = 20261115;
function hasard() {
  graine = (graine + 0x6d2b79f5) | 0;
  let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entre = (min, max) => min + hasard() * (max - min);
const entier = (min, max) => Math.floor(entre(min, max + 1));
const parmi = (liste) => liste[Math.floor(hasard() * liste.length)];
const borner = (x) => Math.max(1, Math.min(10, Math.round(x)));

// ------------------------------- Dataset -----------------------------------
const categories = CATEGORIES_INITIALES.map((c, i) => ({ id: i + 1, ...c }));
const cat = (nom) => categories.find((c) => c.nom === nom).id;
const contenants = [
  ...CONTENANTS_INITIAUX.map((c, i) => ({ id: i + 1, ...c })),
  { id: 9, nom: 'Dose', volumeML: 20, predefini: false },
];
const cont = (nom) => contenants.find((c) => c.nom === nom);

const boisson = (id, nom, categorie, degre, plus = {}) => ({
  id, nom, categorieId: cat(categorie), degre, kcalParL: null, sucreGParL: null, favori: false, notes: '', archive: false, ...plus,
});
const boissons = [
  boisson(1, 'Leffe Blonde', 'Bière', 6.6, { favori: true }),
  boisson(2, 'Heineken', 'Bière', 5),
  boisson(3, '1664', 'Bière', 5.5),
  boisson(4, 'Guinness Draught', 'Bière', 4.2),
  boisson(5, 'Côtes-du-Rhône rouge', 'Vin rouge', 13.5),
  boisson(6, 'Chardonnay', 'Vin blanc', 13),
  boisson(7, 'Champagne brut', 'Champagne et mousseux', 12),
  boisson(8, 'Prosecco', 'Champagne et mousseux', 11),
  boisson(9, 'Ricard', 'Anisé', 45, { favori: true }),
  boisson(10, 'Havana Club 3 ans', 'Rhum', 40),
  boisson(11, "Jack Daniel's", 'Whisky', 40),
  boisson(12, 'Aperol', 'Liqueur', 11),
  boisson(13, 'Jägermeister', 'Liqueur', 35),
  boisson(14, 'Eau gazeuse', 'Diluants (sans alcool)', 0, { kcalParL: 0, sucreGParL: 0 }),
  boisson(15, 'Sirop de sucre de canne', 'Diluants (sans alcool)', 0),
  boisson(16, 'Jus de citron vert', 'Diluants (sans alcool)', 0),
];
const boissonsParId = new Map(boissons.map((b) => [b.id, b]));

const cocktails = [
  {
    id: 1, nom: 'Mojito', favori: false, archive: false,
    ingredients: [{ boissonId: 10, volumeML: 40 }, { boissonId: 15, volumeML: 20 }, { boissonId: 16, volumeML: 20 }, { boissonId: 14, volumeML: 80 }],
  },
  {
    id: 2, nom: 'Spritz', favori: false, archive: false,
    ingredients: [{ boissonId: 12, volumeML: 60 }, { boissonId: 8, volumeML: 90 }, { boissonId: 14, volumeML: 30 }],
  },
];
const cocktailsParId = new Map(cocktails.map((c) => [c.id, c]));

// ---------------------------- Consommations --------------------------------
const consommations = [];
function boire(t, { boissonId = null, cocktailId = null, contenant = null, quantite = 1, prix = null, soireeId = null }) {
  const type = cocktailId !== null ? 'cocktail' : 'boisson';
  const snapshot = type === 'cocktail'
    ? snapshotCocktail(cocktailsParId.get(cocktailId), boissonsParId)
    : snapshotBoisson(boissonsParId.get(boissonId), cont(contenant).volumeML);
  consommations.push({
    id: consommations.length + 1,
    horodatage: Math.round(t / MIN) * MIN,
    type,
    refId: type === 'cocktail' ? cocktailId : boissonId,
    contenantId: type === 'cocktail' ? null : cont(contenant).id,
    volumeML: snapshot.volumeML,
    quantite,
    prixEuros: prix,
    soireeId,
    snapshot,
  });
  return snapshot.gAlcool * quantite;
}

// Quatre styles de soirée : ce qu'on y boit, dans quoi, à quel prix.
const STYLES = {
  bar: () => parmi([
    { boissonId: 1, contenant: 'Pinte', prix: 8 }, { boissonId: 3, contenant: 'Pinte', prix: 7 },
    { boissonId: 2, contenant: 'Demi', prix: 4 }, { boissonId: 4, contenant: 'Pinte', prix: 7.5 },
  ]),
  maison: () => parmi([
    { boissonId: 9, contenant: 'Dose' }, { boissonId: 5, contenant: 'Verre de vin' },
    { boissonId: 6, contenant: 'Verre de vin' }, { boissonId: 2, contenant: 'Bouteille ou canette' },
  ]),
  cocktails: () => parmi([
    { cocktailId: 1, prix: 9.5 }, { cocktailId: 2, prix: 8 }, { cocktailId: 1, prix: 9.5 }, { boissonId: 7, contenant: 'Flûte', prix: 9 },
  ]),
  fete: () => parmi([
    { boissonId: 1, contenant: 'Bouteille ou canette' }, { boissonId: 13, contenant: 'Shot' },
    { boissonId: 11, contenant: 'Shot' }, { boissonId: 5, contenant: 'Verre de vin' }, { boissonId: 2, contenant: 'Grande canette' },
  ]),
};
const TITRES = {
  bar: ['Afterwork', 'Bar avec la promo', 'Match au pub', 'Verre en terrasse'],
  maison: ['Apéro coloc', 'Dîner chez Léa', 'Raclette', 'Soirée jeux'],
  cocktails: ['Anniv de Paul', 'Rooftop', 'Bar à cocktails'],
  fete: ['Soirée BDE', 'Crémaillère', 'Soirée déguisée', 'Fin de partiels'],
};

// Une à deux soirées par week-end sur les onze dernières semaines.
const soirees = [];
const lundi = debutSemaine(maintenant);
for (let semaine = 10; semaine >= 0; semaine -= 1) {
  const joursPossibles = semaine % 3 === 0 ? [4, 5] : [parmi([3, 4, 5])]; // jeudi = 3, vendredi = 4, samedi = 5
  for (const jour of joursPossibles) {
    const debut = ajouterJours(lundi, -7 * semaine + jour) + entre(19.5, 21.5) * HEURE;
    const duree = entre(2.5, 6) * HEURE;
    if (debut + duree > maintenant - 36 * HEURE) continue; // rien dans le futur ; la veille est réservée à la dernière soirée
    const style = parmi(Object.keys(STYLES));
    const id = soirees.length + 1;
    const nbVerres = style === 'fete' ? entier(5, 10) : entier(2, 7);
    let gAlcool = 0;
    for (let i = 0; i < nbVerres; i += 1) {
      const t = debut + (duree * (i + entre(0, 0.6))) / nbVerres;
      gAlcool += boire(t, { ...STYLES[style](), soireeId: id });
    }
    // Bilan : le ressenti monte avec l'alcool, baisse avec le repas ; la gueule
    // de bois monte avec l'alcool et la fatigue, baisse avec l'eau bue.
    const repas = entier(2, 10);
    const hydratation = entier(1, 9);
    const fatigue = entier(1, 8);
    soirees.push({
      id,
      titre: parmi(TITRES[style]),
      debut: Math.round(debut / MIN) * MIN,
      fin: Math.round((debut + duree) / MIN) * MIN,
      poidsKg: 67,
      ressenti: borner(gAlcool / 11 + (6 - repas) / 2.2 + fatigue / 6 + entre(-1, 1)),
      repas,
      hydratation,
      fatigue,
      gueuleDeBois: borner(gAlcool / 13 - hydratation / 2.5 + fatigue / 3.5 + entre(-1, 1) + 1.5),
      gueuleDeBoisIgnoree: false,
      notes: '',
    });
  }
}

// La soirée la plus récente : terminée cette nuit, bilan rempli mais gueule de
// bois pas encore notée (l'accueil affiche donc le rappel du lendemain).
{
  const fin = Math.min(maintenant - 9 * HEURE, debutJour(maintenant) + 1.5 * HEURE);
  const debut = fin - 4.5 * HEURE;
  const id = soirees.length + 1;
  [
    [0, { boissonId: 1, contenant: 'Pinte', prix: 8 }], [50, { boissonId: 1, contenant: 'Pinte', prix: 8 }],
    [110, { cocktailId: 1, prix: 9.5 }], [165, { boissonId: 3, contenant: 'Demi', prix: 4 }],
    [215, { boissonId: 13, contenant: 'Shot', prix: 4 }],
  ].forEach(([minutes, quoi]) => boire(debut + minutes * MIN, { ...quoi, soireeId: id }));
  soirees.push({
    id, titre: 'Anniv de Paul', debut, fin, poidsKg: 67,
    ressenti: 7, repas: 4, hydratation: 3, fatigue: 5, gueuleDeBois: null, gueuleDeBoisIgnoree: false,
    notes: 'Pas dîné avant, arrivé directement après le sport.',
  });
}

// Quelques verres hors soirée, en semaine.
for (let j = 70; j >= 2; j -= 1) {
  if (hasard() < 0.16) {
    const t = ajouterJours(debutJour(maintenant), -j) + entre(19.5, 21.5) * HEURE;
    boire(t, parmi([
      { boissonId: 5, contenant: 'Verre de vin' }, { boissonId: 2, contenant: 'Bouteille ou canette' },
      { boissonId: 6, contenant: 'Verre de vin' }, { boissonId: 1, contenant: 'Bouteille ou canette' },
    ]));
  }
}
consommations.sort((a, b) => a.horodatage - b.horodatage).forEach((c, i) => { c.id = i + 1; });

// ------------------------- Objectifs et paramètres -------------------------
const objectif = (id, nom, unite, limite, periode) => ({
  id, nom, unite, limite, periode, nJours: null, filtreCategorie: null, seuilAlerte: 0.8, actif: true,
  creeLe: ajouterJours(maintenant, -70),
});
const objectifs = [
  objectif(1, 'Max 40 verres par mois', 'verres', 40, 'mois'),
  objectif(2, 'Max 10 verres par semaine', 'verres', 10, 'semaine'),
  objectif(3, 'Max 90 € par mois', 'euros', 90, 'mois'),
];
const parametres = Object.entries({
  poidsKg: 67, sexe: 'homme', gParVerre: 10, r: 0.7, beta: 0.15,
  premierLancement: ajouterJours(maintenant, -77),
  dernierExport: ajouterJours(maintenant, -6),
  aideInstallationMasquee: true,
}).map(([cle, valeur]) => ({ cle, valeur }));

// ------------------------------- Écriture ----------------------------------
const sauvegarde = {
  format: 'ardoise-sauvegarde',
  version: 1,
  exporteLe: new Date(maintenant).toISOString(),
  tables: { categories, boissons, contenants, cocktails, consommations, soirees, objectifs, parametres },
};
mkdirSync(new URL('../demo/', import.meta.url), { recursive: true });
writeFileSync(new URL('../demo/ardoise-demo.json', import.meta.url), `${JSON.stringify(sauvegarde, null, 1)}\n`);
console.log(`demo/ardoise-demo.json : ${consommations.length} consommations, ${soirees.length} soirées, ${boissons.length} boissons.`);
