// ---------------------------------------------------------------------------
// Alcoolémie estimée — formule de Widmark.
//
//   C(t) ≈ max(0, Σ A_k / (r · P)  −  β · (t − t0))
//
//   A_k : grammes d'alcool de la consommation k, prise à l'instant t_k
//   P   : poids en kg
//   r   : coefficient de diffusion (0,7 homme ; 0,6 femme)
//   β   : vitesse d'élimination, en g/L par heure (0,15 par défaut)
//
// LIMITES (à garder en tête, et affichées dans l'appli) :
//  - absorption supposée instantanée : en réalité le pic arrive 30 à 90 min
//    après le verre, plus tard et plus bas si on a mangé ;
//  - β varie d'une personne à l'autre (≈ 0,10 à 0,20 g/L/h) ;
//  - c'est une estimation indicative, jamais un moyen de savoir si l'on peut
//    conduire.
// ---------------------------------------------------------------------------

/** Coefficient r par défaut selon le sexe. */
export const R_PAR_SEXE = { homme: 0.7, femme: 0.6 };

/** Vitesse d'élimination par défaut, en g/L par heure. */
export const BETA_DEFAUT = 0.15;

const HEURE_MS = 3600 * 1000;

/**
 * Hausse d'alcoolémie provoquée par une dose, AVANT toute élimination (g/L).
 * Exemple : 40 g pour 67 kg et r = 0,7 → 40 / (0,7 × 67) ≈ 0,85 g/L.
 */
export function picTheorique(gAlcool, poidsKg, r) {
  return gAlcool / (r * poidsKg);
}

/**
 * Paramètres de Widmark à utiliser pour une soirée donnée.
 * Le poids est celui noté au début de la soirée quand il existe : changer
 * son poids dans les paramètres ne modifie donc que les estimations des
 * soirées suivantes. r et β, eux, sont des réglages du modèle : ils
 * s'appliquent à toutes les soirées.
 *
 * @param {object|null} soiree      { poidsKg? }
 * @param {object} parametres       { poidsKg, r, beta }
 */
export function parametresPourSoiree(soiree, parametres) {
  const poidsSoiree = soiree?.poidsKg;
  const poidsKg = typeof poidsSoiree === 'number' && poidsSoiree > 0 ? poidsSoiree : parametres.poidsKg;
  return { poidsKg, r: parametres.r, beta: parametres.beta };
}

/**
 * Simule la courbe d'alcoolémie d'une suite de consommations.
 *
 * Simulation pas à pas : entre deux instants, l'alcoolémie baisse de
 * β × durée sans jamais passer sous 0 (si elle retombe à 0 avant un nouveau
 * verre, on repart de 0) ; à chaque verre, elle monte d'un coup de A/(r·P).
 *
 * @param {Array<{t:number, gAlcool:number}>} prises  t en millisecondes
 * @param {object} options
 *   - poidsKg, r, beta : paramètres de Widmark
 *   - pasMin : pas de la simulation en minutes (5 par défaut)
 *   - maxHeuresApres : sécurité, on arrête la courbe au plus tard N heures
 *     après le dernier verre
 * @returns {{points:Array<{t:number,c:number}>, pic:number, tPic:number|null, tRetourZero:number|null}}
 */
export function simulerAlcoolemie(prises, { poidsKg, r, beta, pasMin = 5, maxHeuresApres = 36 }) {
  const doses = prises
    .filter((p) => p.gAlcool > 0)
    .slice()
    .sort((a, b) => a.t - b.t);
  if (doses.length === 0 || !(poidsKg > 0) || !(r > 0)) {
    return { points: [], pic: 0, tPic: null, tRetourZero: null };
  }

  const pasMs = pasMin * 60 * 1000;
  const t0 = doses[0].t;
  const tDernier = doses[doses.length - 1].t;
  const tMax = tDernier + maxHeuresApres * HEURE_MS;

  const points = [];
  let c = 0; // alcoolémie courante, g/L
  let curseur = t0; // instant jusqu'où la simulation est à jour
  let i = 0; // prochaine dose à appliquer
  let pic = 0;
  let tPic = null;
  let tRetourZero = null;

  // Fait avancer la simulation jusqu'à l'instant t (élimination linéaire).
  const eliminerJusqua = (t) => {
    if (beta > 0 && c > 0) {
      const baisse = beta * ((t - curseur) / HEURE_MS);
      if (baisse >= c) {
        // L'alcoolémie touche 0 pendant l'intervalle : on note l'instant exact.
        tRetourZero = curseur + (c / beta) * HEURE_MS;
        c = 0;
        if (tRetourZero < t) points.push({ t: tRetourZero, c: 0 });
      } else {
        c -= baisse;
      }
    }
    curseur = t;
  };

  for (let t = t0; t <= tMax; t += pasMs) {
    // 1) appliquer toutes les doses prises jusqu'à l'instant t
    while (i < doses.length && doses[i].t <= t) {
      const dose = doses[i];
      eliminerJusqua(dose.t);
      if (dose.t > t0) points.push({ t: dose.t, c }); // juste avant le verre
      c += picTheorique(dose.gAlcool, poidsKg, r);
      tRetourZero = null;
      points.push({ t: dose.t, c }); // juste après le verre
      if (c > pic) {
        pic = c;
        tPic = dose.t;
      }
      i += 1;
    }
    // 2) avancer jusqu'à t et enregistrer le point
    eliminerJusqua(t);
    const dernier = points[points.length - 1];
    if (!dernier || dernier.t !== t) points.push({ t, c });
    // 3) fin : plus de dose à venir et alcoolémie revenue à 0
    if (i >= doses.length && c === 0) break;
  }

  return { points, pic, tPic, tRetourZero };
}

/**
 * Alcoolémie estimée à un instant donné, lue sur une courbe déjà simulée
 * (interpolation linéaire entre deux points). Renvoie 0 hors de la courbe.
 */
export function alcoolemieA(points, t) {
  if (points.length === 0 || t < points[0].t || t > points[points.length - 1].t) return 0;
  for (let i = points.length - 1; i >= 0; i -= 1) {
    if (points[i].t <= t) {
      const suivant = points[i + 1];
      if (!suivant || suivant.t === points[i].t) return points[i].c;
      const part = (t - points[i].t) / (suivant.t - points[i].t);
      return points[i].c + (suivant.c - points[i].c) * part;
    }
  }
  return 0;
}
