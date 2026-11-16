// ---------------------------------------------------------------------------
// Mise en forme pour l'affichage : nombres à la française (virgule décimale),
// volumes en cL, euros, dates JJ/MM/AAAA, durées.
// ---------------------------------------------------------------------------

import { UNITES } from './objectifs.js';

// Espace insécable : évite qu'une unité se retrouve seule à la ligne (« 20 g »).
const INSECABLE = ' ';

/** Nombre avec virgule française. nombre(6.42, 1) → « 6,4 » ; nombre(2, 1) → « 2 ». */
export function nombre(x, decimalesMax = 1, decimalesMin = 0) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return '–';
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimalesMin,
    maximumFractionDigits: decimalesMax,
  }).format(x);
}

/** Volume lisible : 500 → « 50 cL », 125 → « 12,5 cL », 40 → « 4 cL ». */
export function volume(ml) {
  return `${nombre(ml / 10, 1)}${INSECABLE}cL`;
}

/** Montant en euros : 6.5 → « 6,50 € ». */
export function euros(x) {
  return `${nombre(x, 2, 2)}${INSECABLE}€`;
}

/** Degré d'alcool : 6.6 → « 6,6 % ». */
export function degre(x) {
  return `${nombre(x, 1)}${INSECABLE}%`;
}

/** Valeur suivie de son unité : valeurAvecUnite(3.6, 'verres') → « 3,6 verres ». */
export function valeurAvecUnite(x, unite) {
  const info = UNITES[unite];
  if (unite === 'euros') return euros(x);
  const texte = nombre(x, info.decimales);
  const pluriel = Math.abs(x) >= 2;
  return `${texte}${INSECABLE}${pluriel ? info.court : info.singulier}`;
}

/** Date JJ/MM/AAAA. */
export function dateCourte(ms) {
  return new Date(ms).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** « dimanche 15 novembre ». */
export function dateLongue(ms) {
  return new Date(ms).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** « novembre 2026 ». */
export function moisAnnee(ms) {
  return new Date(ms).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

/** « 15/11 » — pour les axes des graphiques. */
export function jourMois(ms) {
  return new Date(ms).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

/** « nov. » — pour les axes des graphiques. */
export function moisCourt(ms) {
  return new Date(ms).toLocaleDateString('fr-FR', { month: 'short' });
}

/** « 21:05 ». */
export function heure(ms) {
  return new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** « 15/11/2026 à 21:05 ». */
export function dateHeure(ms) {
  return `${dateCourte(ms)} à ${heure(ms)}`;
}

/** Durée lisible : « 45 min », « 2 h 10 ». */
export function duree(ms) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes}${INSECABLE}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}${INSECABLE}h` : `${h}${INSECABLE}h${INSECABLE}${String(m).padStart(2, '0')}`;
}

/** Met une majuscule au début d'un texte. */
export function majuscule(texte) {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/**
 * Convertit un instant (ms) vers la valeur attendue par un champ
 * <input type="datetime-local"> : « AAAA-MM-JJTHH:MM » en heure locale.
 */
export function versChampDateHeure(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Inverse de versChampDateHeure ; renvoie null si le champ est vide ou invalide. */
export function depuisChampDateHeure(texte) {
  if (!texte) return null;
  const ms = new Date(texte).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Lit un nombre tapé à la française (« 6,5 ») ou à l'anglaise (« 6.5 »).
 * Renvoie null si le champ est vide ou n'est pas un nombre.
 */
export function lireNombre(texte) {
  if (texte === null || texte === undefined) return null;
  const propre = String(texte).trim().replace(/\s/g, '').replace(',', '.');
  if (propre === '') return null;
  const x = Number(propre);
  return Number.isFinite(x) ? x : null;
}
