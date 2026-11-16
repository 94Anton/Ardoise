// ---------------------------------------------------------------------------
// Sélecteurs : petites fonctions pures qui extraient une information des
// données déjà chargées (pas d'accès à la base ici).
// ---------------------------------------------------------------------------

import { PARAMETRES_DEFAUT } from './valeursInitiales.js';

/** Transforme un tableau d'objets { id, … } en Map id → objet. */
export function indexerParId(tableau) {
  return new Map(tableau.map((x) => [x.id, x]));
}

/** Transforme les lignes { cle, valeur } en un objet, complété par les valeurs par défaut. */
export function lireParametres(lignes) {
  const parametres = { ...PARAMETRES_DEFAUT };
  for (const { cle, valeur } of lignes) parametres[cle] = valeur;
  return parametres;
}

/** La soirée en cours (celle qui n'a pas de fin), ou null. */
export function soireeEnCours(soirees) {
  return soirees.find((s) => s.fin === null || s.fin === undefined) ?? null;
}

/**
 * Retrouve la boisson ou le cocktail d'une consommation.
 * @returns {object|undefined}
 */
export function reference(type, refId, { boissonsParId, cocktailsParId }) {
  return type === 'cocktail' ? cocktailsParId.get(refId) : boissonsParId.get(refId);
}

/** Clé qui identifie une combinaison « boisson + contenant » (ou volume libre). */
function cleCombinaison(c) {
  return `${c.type}:${c.refId}:${c.contenantId ?? 'libre'}:${c.volumeML}`;
}

/**
 * Les n combinaisons boisson + contenant les plus récentes, sans doublon.
 * Les boissons archivées ou supprimées sont ignorées.
 *
 * @param {Array} consommations  triées de la plus récente à la plus ancienne
 */
export function combinaisonsRecentes(consommations, donnees, n = 6) {
  const vues = new Set();
  const resultat = [];
  for (const c of consommations) {
    const ref = reference(c.type, c.refId, donnees);
    if (!ref || ref.archive) continue;
    const cle = cleCombinaison(c);
    if (vues.has(cle)) continue;
    vues.add(cle);
    resultat.push({
      cle, type: c.type, refId: c.refId, contenantId: c.contenantId ?? null, volumeML: c.volumeML,
    });
    if (resultat.length >= n) break;
  }
  return resultat;
}

/**
 * Dernière consommation d'une boisson (ou d'un cocktail) donnée, pour
 * retrouver son contenant habituel.
 */
export function derniereConsommationDe(consommations, type, refId) {
  return consommations.find((c) => c.type === type && c.refId === refId) ?? null;
}

/**
 * Dernier prix payé pour la même boisson dans le même volume, ou null.
 * Sert à préremplir le champ prix.
 */
export function dernierPrix(consommations, type, refId, volumeML) {
  const trouvee = consommations.find(
    (c) => c.type === type && c.refId === refId && c.volumeML === volumeML && typeof c.prixEuros === 'number',
  );
  return trouvee ? trouvee.prixEuros : null;
}

/** Nom du contenant d'une consommation, ou null si c'est un volume libre. */
export function nomContenant(conso, contenantsParId) {
  if (conso.contenantId === null || conso.contenantId === undefined) return null;
  return contenantsParId.get(conso.contenantId)?.nom ?? null;
}

/** Catégorie « principale » d'une consommation : celle qui apporte le plus d'alcool. */
export function categoriePrincipale(conso) {
  const composants = conso.snapshot?.composants ?? [];
  if (composants.length === 0) return null;
  const principal = composants.reduce((a, b) => (b.gAlcool > a.gAlcool ? b : a));
  return principal.categorieId;
}

/** Nombre de consommations qui utilisent une boisson (directement ou dans un cocktail). */
export function nombreUtilisationsBoisson(boissonId, consommations) {
  return consommations.filter((c) =>
    (c.snapshot?.composants ?? []).some((k) => k.boissonId === boissonId),
  ).length;
}
