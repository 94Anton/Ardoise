// ---------------------------------------------------------------------------
// Objectifs : valeur d'une consommation dans une unité donnée, progression sur
// la période en cours, alertes à 80 % / 100 %, historique respecté / dépassé.
// ---------------------------------------------------------------------------

import { somme } from './alcool.js';
import { bornesPeriode, periodePrecedente, dansPeriode } from './periodes.js';

/**
 * Unités dans lesquelles on peut suivre sa consommation.
 * `court` sert dans les phrases (« il reste 3,6 verres »),
 * `decimales` règle l'affichage.
 */
export const UNITES = {
  verres: { libelle: 'Verres standard', court: 'verres', singulier: 'verre', decimales: 1 },
  g: { libelle: "Grammes d'alcool", court: "g d'alcool", singulier: "g d'alcool", decimales: 0 },
  kcal: { libelle: 'Calories', court: 'kcal', singulier: 'kcal', decimales: 0 },
  sucre: { libelle: 'Sucre', court: 'g de sucre', singulier: 'g de sucre', decimales: 0 },
  euros: { libelle: 'Dépense', court: '€', singulier: '€', decimales: 2 },
  nombre: { libelle: 'Nombre de consommations', court: 'consommations', singulier: 'consommation', decimales: 0 },
};

/** Libellés des périodes d'objectif. */
export const PERIODES = {
  jour: { libelle: 'Par jour', court: 'jour' },
  semaine: { libelle: 'Par semaine (lundi → dimanche)', court: 'semaine' },
  mois: { libelle: 'Par mois', court: 'mois' },
  jours: { libelle: 'Sur N jours glissants', court: 'jours glissants' },
};

/** Petite tolérance pour les comparaisons de nombres à virgule. */
const EPSILON = 1e-9;

/**
 * Valeur d'UNE consommation dans l'unité demandée (quantité comprise).
 *
 * Avec un filtre de catégorie :
 *  - alcool, verres, kcal et sucre ne comptent que les ingrédients de cette
 *    catégorie (le rhum d'un mojito compte en « Rhum ») ;
 *  - le prix et le nombre comptent en entier dès que la consommation contient
 *    un ingrédient de la catégorie.
 *
 * @param {object} conso  consommation avec son snapshot
 * @param {string} unite  clé de UNITES
 * @param {{gParVerre?:number, categorieId?:number|null}} options
 */
export function valeurConsommation(conso, unite, { gParVerre = 10, categorieId = null } = {}) {
  const quantite = conso.quantite ?? 1;
  let composants = conso.snapshot?.composants ?? [];
  if (categorieId !== null && categorieId !== undefined) {
    composants = composants.filter((k) => k.categorieId === categorieId);
    if (composants.length === 0) return 0;
  }
  switch (unite) {
    case 'g':
      return quantite * somme(composants, (k) => k.gAlcool);
    case 'verres':
      return (quantite * somme(composants, (k) => k.gAlcool)) / gParVerre;
    case 'kcal':
      return quantite * somme(composants, (k) => k.kcal);
    case 'sucre':
      return quantite * somme(composants, (k) => k.sucreG ?? 0);
    case 'euros':
      return typeof conso.prixEuros === 'number' ? quantite * conso.prixEuros : 0;
    case 'nombre':
      return quantite;
    default:
      throw new Error(`Unité inconnue : ${unite}`);
  }
}

/** Total des consommations d'une période, dans l'unité de l'objectif. */
export function sommeSurPeriode(consommations, objectif, bornes, gParVerre = 10) {
  const options = { gParVerre, categorieId: objectif.filtreCategorie ?? null };
  return somme(
    consommations.filter((c) => dansPeriode(c.horodatage, bornes)),
    (c) => valeurConsommation(c, objectif.unite, options),
  );
}

/**
 * État d'un objectif selon son taux de remplissage :
 *   'ok'      sous le seuil d'alerte (vert)
 *   'alerte'  du seuil à 100 % inclus (orange)
 *   'depasse' au-delà de 100 % (rouge)
 */
export function etatObjectif(ratio, seuilAlerte = 0.8) {
  if (ratio > 1 + EPSILON) return 'depasse';
  if (ratio >= seuilAlerte - EPSILON) return 'alerte';
  return 'ok';
}

/**
 * Où en est un objectif sur sa période en cours.
 * @returns {{debut, fin, valeur, limite, ratio, etat, reste}}
 *   reste = ce qu'il reste avant la limite (négatif si elle est dépassée)
 */
export function progression(objectif, consommations, maintenant, gParVerre = 10) {
  const bornes = bornesPeriode(objectif.periode, maintenant, objectif.nJours);
  const valeur = sommeSurPeriode(consommations, objectif, bornes, gParVerre);
  const ratio = objectif.limite > 0 ? valeur / objectif.limite : valeur > 0 ? Infinity : 0;
  return {
    ...bornes,
    valeur,
    limite: objectif.limite,
    ratio,
    etat: etatObjectif(ratio, objectif.seuilAlerte ?? 0.8),
    reste: objectif.limite - valeur,
  };
}

/**
 * Alertes déclenchées par une saisie : compare la situation avant et après.
 * Une alerte « seuil » quand on franchit le seuil (80 % par défaut), une
 * alerte « limite » quand on atteint ou dépasse 100 %. Si une même saisie
 * franchit les deux, seule l'alerte « limite » est renvoyée.
 *
 * @returns {Array<{objectif, type:'seuil'|'limite', valeur, limite, ratio, reste}>}
 */
export function alertesFranchies(objectifs, consosAvant, consosApres, maintenant, gParVerre = 10) {
  const alertes = [];
  for (const objectif of objectifs) {
    if (!objectif.actif || !(objectif.limite > 0)) continue;
    const seuil = objectif.seuilAlerte ?? 0.8;
    const avant = progression(objectif, consosAvant, maintenant, gParVerre);
    const apres = progression(objectif, consosApres, maintenant, gParVerre);
    const info = { objectif, valeur: apres.valeur, limite: apres.limite, ratio: apres.ratio, reste: apres.reste };
    if (avant.ratio < 1 - EPSILON && apres.ratio >= 1 - EPSILON) {
      alertes.push({ ...info, type: 'limite' });
    } else if (avant.ratio < seuil - EPSILON && apres.ratio >= seuil - EPSILON) {
      alertes.push({ ...info, type: 'seuil' });
    }
  }
  return alertes;
}

/**
 * Historique d'un objectif : pour chaque période passée (la plus récente
 * d'abord), la valeur atteinte, si l'objectif a été respecté, et l'écart à la
 * limite (positif = dépassement).
 *
 * @param {number} depuis  on ne remonte pas avant la période contenant cet instant
 * @param {number} nbMax   nombre maximal de périodes renvoyées
 */
export function historiqueObjectif(objectif, consommations, maintenant, gParVerre = 10, { depuis = 0, nbMax = 12 } = {}) {
  const lignes = [];
  let bornes = bornesPeriode(objectif.periode, maintenant, objectif.nJours);
  for (let i = 0; i < nbMax; i += 1) {
    bornes = periodePrecedente(objectif.periode, bornes, objectif.nJours);
    if (bornes.fin <= depuis) break;
    const valeur = sommeSurPeriode(consommations, objectif, bornes, gParVerre);
    lignes.push({
      ...bornes,
      valeur,
      respecte: valeur <= objectif.limite + EPSILON,
      ecart: valeur - objectif.limite,
    });
  }
  return lignes;
}
