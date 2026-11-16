// ---------------------------------------------------------------------------
// Analyse des corrélations entre les soirées (coefficient de Spearman).
//
// Spearman mesure si deux grandeurs évoluent dans le même sens (ρ proche de
// +1), en sens inverse (ρ proche de −1) ou sans lien (ρ proche de 0). Il
// travaille sur les RANGS et non sur les valeurs, ce qui convient bien à des
// notes de 1 à 10.
//
// À garder en tête : avec une dizaine de soirées, un ρ de 0,3 peut tout à
// fait être dû au hasard, et une corrélation ne prouve pas une cause.
// ---------------------------------------------------------------------------

import { somme } from './alcool.js';
import { parametresPourSoiree, simulerAlcoolemie } from './widmark.js';

/** Nombre minimal de soirées avec bilan complet avant d'afficher quoi que ce soit. */
export const MIN_SOIREES = 10;

/** On ne montre que les liens au moins « modérés ». */
export const RHO_MIN = 0.3;

/**
 * Rangs d'une liste de valeurs (1 = la plus petite).
 * Les ex æquo reçoivent la moyenne de leurs rangs : [10, 20, 20, 30] → [1, 2.5, 2.5, 4].
 */
export function rangs(valeurs) {
  const indices = valeurs.map((v, i) => i).sort((a, b) => valeurs[a] - valeurs[b]);
  const resultat = new Array(valeurs.length);
  let i = 0;
  while (i < indices.length) {
    let j = i;
    while (j + 1 < indices.length && valeurs[indices[j + 1]] === valeurs[indices[i]]) j += 1;
    const rangMoyen = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) resultat[indices[k]] = rangMoyen;
    i = j + 1;
  }
  return resultat;
}

/** Corrélation de Pearson entre deux listes ; null si l'une est constante. */
function pearson(x, y) {
  const n = x.length;
  const mx = somme(x) / n;
  const my = somme(y) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/**
 * Coefficient de Spearman ρ : corrélation de Pearson calculée sur les rangs.
 * @returns {number|null}  null si le calcul n'a pas de sens (moins de 3
 *   points, ou une des deux grandeurs ne varie pas)
 */
export function spearman(x, y) {
  if (x.length !== y.length || x.length < 3) return null;
  return pearson(rangs(x), rangs(y));
}

/**
 * Le lien est-il assez net pour ne probablement pas être dû au hasard ?
 * Test approché (transformation de Fisher), au seuil habituel de 5 %.
 * Avec 10 soirées, il faut environ |ρ| ≥ 0,65 pour passer.
 */
export function estSolide(rho, n) {
  if (rho === null || n < 4) return false;
  if (Math.abs(rho) >= 1) return true;
  const z = Math.atanh(rho) * Math.sqrt((n - 3) / 1.06);
  return Math.abs(z) >= 1.96;
}

/**
 * Variables d'une soirée utilisées dans l'analyse.
 * Renvoie null pour celles qui ne sont pas calculables.
 */
export function variablesSoiree(soiree, consommations, parametres) {
  const consos = consommations.filter((c) => c.soireeId === soiree.id);
  const gAlcool = somme(consos, (c) => (c.quantite ?? 1) * (c.snapshot?.gAlcool ?? 0));
  const dureeH = soiree.fin ? (soiree.fin - soiree.debut) / 3600000 : null;
  const simulation = simulerAlcoolemie(
    consos.map((c) => ({ t: c.horodatage, gAlcool: (c.quantite ?? 1) * (c.snapshot?.gAlcool ?? 0) })),
    parametresPourSoiree(soiree, parametres), // poids noté au début de la soirée
  );
  return {
    gAlcool,
    dureeH,
    // Le rythme n'a de sens que si la soirée dure au moins une demi-heure.
    gParHeure: dureeH !== null && dureeH >= 0.5 ? gAlcool / dureeH : null,
    pic: simulation.pic,
    ressenti: soiree.ressenti ?? null,
    repas: soiree.repas ?? null,
    hydratation: soiree.hydratation ?? null,
    fatigue: soiree.fatigue ?? null,
    gueuleDeBois: soiree.gueuleDeBois ?? null,
  };
}

/** Une soirée compte dans l'analyse si ses cinq notes sont remplies et qu'on y a bu de l'alcool. */
export function bilanComplet(variables) {
  return (
    variables.gAlcool > 0 &&
    ['ressenti', 'repas', 'hydratation', 'fatigue', 'gueuleDeBois'].every((cle) => variables[cle] !== null)
  );
}

// Morceaux de phrase pour chaque variable, en « cause » puis en « effet ».
const FORMULES = {
  gAlcool: { cause: "tu bois d'alcool" },
  gParHeure: { cause: 'tu bois vite' },
  pic: { cause: "ton pic d'alcoolémie estimé est haut" },
  dureeH: { cause: 'la soirée dure longtemps' },
  repas: { cause: 'tu as bien mangé avant' },
  hydratation: { cause: "tu bois d'eau" },
  fatigue: { cause: 'tu es fatigué' },
  ressenti: { cause: 'tu te sens alcoolisé', effet: 'tu te sens alcoolisé' },
  gueuleDeBois: { effet: 'tu as la gueule de bois' },
};

// Couples (cause, effet) étudiés. On se limite à ceux qui ont un sens :
// inutile de comparer l'alcool bu au pic d'alcoolémie, l'un découle de l'autre.
const CAUSES = ['gAlcool', 'gParHeure', 'pic', 'dureeH', 'repas', 'hydratation', 'fatigue'];
export const COUPLES = [
  ...CAUSES.map((cause) => [cause, 'ressenti']),
  ...CAUSES.map((cause) => [cause, 'gueuleDeBois']),
  ['ressenti', 'gueuleDeBois'],
];

/**
 * Analyse complète.
 *
 * @returns {{
 *   nbCompletes:number,            soirées avec bilan complet
 *   manquantes:number,             combien il en manque pour atteindre MIN_SOIREES
 *   resultats:Array<{cause, effet, rho, n, solide, phrase}>   triés par |ρ| décroissant
 * }}
 */
export function analyserCorrelations(soirees, consommations, parametres) {
  const completes = soirees
    .map((s) => variablesSoiree(s, consommations, parametres))
    .filter(bilanComplet);
  const nbCompletes = completes.length;
  if (nbCompletes < MIN_SOIREES) {
    return { nbCompletes, manquantes: MIN_SOIREES - nbCompletes, resultats: [] };
  }
  const resultats = [];
  for (const [cause, effet] of COUPLES) {
    const utilisables = completes.filter((v) => v[cause] !== null && v[effet] !== null);
    const n = utilisables.length;
    if (n < MIN_SOIREES) continue;
    const rho = spearman(utilisables.map((v) => v[cause]), utilisables.map((v) => v[effet]));
    if (rho === null || Math.abs(rho) < RHO_MIN) continue;
    resultats.push({
      cause,
      effet,
      rho,
      n,
      solide: estSolide(rho, n),
      phrase: `Plus ${FORMULES[cause].cause}, ${rho > 0 ? 'plus' : 'moins'} ${FORMULES[effet].effet}`,
    });
  }
  resultats.sort((a, b) => Math.abs(b.rho) - Math.abs(a.rho));
  return { nbCompletes, manquantes: 0, resultats };
}

/**
 * Points du nuage « grammes d'alcool × ressenti », avec la note de repas pour
 * la couleur. Ici il suffit que ces trois valeurs soient renseignées.
 */
export function pointsNuage(soirees, consommations, parametres) {
  return soirees
    .map((s) => ({ soiree: s, v: variablesSoiree(s, consommations, parametres) }))
    .filter(({ v }) => v.gAlcool > 0 && v.ressenti !== null && v.repas !== null)
    .map(({ soiree, v }) => ({ soireeId: soiree.id, titre: soiree.titre, x: v.gAlcool, y: v.ressenti, repas: v.repas }));
}
