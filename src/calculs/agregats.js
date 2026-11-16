// ---------------------------------------------------------------------------
// Agrégats pour l'accueil et les statistiques : totaux, séries par semaine ou
// par mois, répartition par catégorie puis par marque, chiffres clés du mois.
// ---------------------------------------------------------------------------

import { somme } from './alcool.js';
import { valeurConsommation } from './objectifs.js';
import {
  ajouterJours, ajouterMois, cleJour, dansPeriode, debutJour, debutMois, debutSemaine,
} from './periodes.js';

/**
 * Totaux d'un ensemble de consommations.
 * - kcalEstimee : au moins une valeur de kcal est une estimation « alcool seul »
 * - sucreIncomplet : au moins une boisson n'a pas de sucre renseigné (elle est
 *   exclue du total sucre)
 * - nbSansPrix : consommations sans prix (exclues de la dépense)
 */
export function totaux(consommations, gParVerre = 10) {
  const gAlcool = somme(consommations, (c) => valeurConsommation(c, 'g'));
  return {
    nombre: somme(consommations, (c) => c.quantite ?? 1),
    gAlcool,
    verres: gAlcool / gParVerre,
    kcal: somme(consommations, (c) => valeurConsommation(c, 'kcal')),
    kcalEstimee: consommations.some((c) => c.snapshot?.kcalEstimee),
    sucreG: somme(consommations, (c) => valeurConsommation(c, 'sucre')),
    sucreIncomplet: consommations.some((c) => c.snapshot?.sucreIncomplet),
    euros: somme(consommations, (c) => valeurConsommation(c, 'euros')),
    nbSansPrix: consommations.filter((c) => typeof c.prixEuros !== 'number').length,
  };
}

/**
 * Série pour le graphique en barres : une valeur par semaine ou par mois,
 * de la plus ancienne à la plus récente (la dernière est la période en cours).
 *
 * @returns {Array<{debut:number, fin:number, valeur:number}>}
 */
export function serieParPeriode(consommations, { granularite, nb, maintenant, unite, gParVerre = 10 }) {
  const periodes = [];
  if (granularite === 'semaine') {
    const courante = debutSemaine(maintenant);
    for (let i = nb - 1; i >= 0; i -= 1) {
      const debut = ajouterJours(courante, -7 * i);
      periodes.push({ debut, fin: ajouterJours(debut, 7), valeur: 0 });
    }
  } else {
    const courant = debutMois(maintenant);
    for (let i = nb - 1; i >= 0; i -= 1) {
      const debut = ajouterMois(courant, -i);
      periodes.push({ debut, fin: ajouterMois(debut, 1), valeur: 0 });
    }
  }
  for (const c of consommations) {
    const periode = periodes.find((p) => dansPeriode(c.horodatage, p));
    if (periode) periode.valeur += valeurConsommation(c, unite, { gParVerre });
  }
  return periodes;
}

/**
 * Parts d'une consommation, ingrédient par ingrédient, dans l'unité demandée.
 * Pour l'alcool, les kcal et le sucre, chaque ingrédient apporte sa propre
 * valeur. Le prix (qui est global) est réparti au prorata de l'alcool de
 * chaque ingrédient — ou du volume si la consommation est sans alcool.
 */
function partsConsommation(conso, unite, gParVerre) {
  const quantite = conso.quantite ?? 1;
  const composants = conso.snapshot?.composants ?? [];
  if (unite === 'euros') {
    if (typeof conso.prixEuros !== 'number') return [];
    const totalAlcool = somme(composants, (k) => k.gAlcool);
    const totalVolume = somme(composants, (k) => k.volumeML);
    return composants.map((k) => {
      const part = totalAlcool > 0 ? k.gAlcool / totalAlcool : totalVolume > 0 ? k.volumeML / totalVolume : 0;
      return { composant: k, valeur: quantite * conso.prixEuros * part };
    });
  }
  const lire = {
    g: (k) => k.gAlcool,
    verres: (k) => k.gAlcool / gParVerre,
    kcal: (k) => k.kcal,
    sucre: (k) => k.sucreG ?? 0,
  }[unite];
  if (!lire) throw new Error(`Unité non prévue pour la répartition : ${unite}`);
  return composants.map((k) => ({ composant: k, valeur: quantite * lire(k) }));
}

/**
 * Répartition par catégorie, puis par marque à l'intérieur de chaque
 * catégorie. Les deux niveaux sont triés du plus grand au plus petit.
 *
 * @returns {{total:number, categories:Array<{categorieId, valeur, part, boissons:Array<{boissonId, nom, valeur, part}>}>}}
 */
export function repartition(consommations, { unite, gParVerre = 10 }) {
  const parCategorie = new Map();
  for (const conso of consommations) {
    for (const { composant, valeur } of partsConsommation(conso, unite, gParVerre)) {
      if (!(valeur > 0)) continue;
      if (!parCategorie.has(composant.categorieId)) {
        parCategorie.set(composant.categorieId, { categorieId: composant.categorieId, valeur: 0, boissons: new Map() });
      }
      const categorie = parCategorie.get(composant.categorieId);
      categorie.valeur += valeur;
      if (!categorie.boissons.has(composant.boissonId)) {
        categorie.boissons.set(composant.boissonId, { boissonId: composant.boissonId, nom: composant.nom, valeur: 0 });
      }
      categorie.boissons.get(composant.boissonId).valeur += valeur;
    }
  }
  const total = somme([...parCategorie.values()], (c) => c.valeur);
  const categories = [...parCategorie.values()]
    .map((c) => ({
      categorieId: c.categorieId,
      valeur: c.valeur,
      part: total > 0 ? c.valeur / total : 0,
      boissons: [...c.boissons.values()]
        .map((b) => ({ ...b, part: c.valeur > 0 ? b.valeur / c.valeur : 0 }))
        .sort((a, b) => b.valeur - a.valeur),
    }))
    .sort((a, b) => b.valeur - a.valeur);
  return { total, categories };
}

/**
 * Nombre de jours sans alcool entre `debut` (inclus) et `fin` (exclue).
 * Les jours à venir ne sont pas comptés : on s'arrête à aujourd'hui inclus.
 */
export function joursSansAlcool(consommations, debut, fin, maintenant) {
  const joursAvecAlcool = new Set(
    consommations
      .filter((c) => valeurConsommation(c, 'g') > 0)
      .map((c) => cleJour(c.horodatage)),
  );
  const dernierJour = Math.min(fin, ajouterJours(debutJour(maintenant), 1));
  let n = 0;
  for (let t = debutJour(debut); t < dernierJour; t = ajouterJours(t, 1)) {
    if (!joursAvecAlcool.has(cleJour(t))) n += 1;
  }
  return n;
}

/**
 * Chiffres clés d'un mois : total dans l'unité choisie, jours sans alcool,
 * dépense, moyenne de verres standard par soirée.
 *
 * @param {number} refMois  n'importe quel instant du mois voulu
 */
export function chiffresClesMois(consommations, soirees, refMois, maintenant, { unite, gParVerre = 10 }) {
  const debut = debutMois(refMois);
  const fin = ajouterMois(debut, 1);
  const bornes = { debut, fin };
  const consosMois = consommations.filter((c) => dansPeriode(c.horodatage, bornes));
  const soireesMois = soirees.filter((s) => dansPeriode(s.debut, bornes));
  const verresParSoiree = soireesMois.map((s) =>
    somme(consommations.filter((c) => c.soireeId === s.id), (c) => valeurConsommation(c, 'verres', { gParVerre })),
  );
  const t = totaux(consosMois, gParVerre);
  return {
    debut,
    fin,
    total: somme(consosMois, (c) => valeurConsommation(c, unite, { gParVerre })),
    joursSansAlcool: joursSansAlcool(consosMois, debut, fin, maintenant),
    joursEcoules: Math.max(0, Math.round((Math.min(fin, ajouterJours(debutJour(maintenant), 1)) - debut) / 86400000)),
    depense: t.euros,
    nbSansPrix: t.nbSansPrix,
    nbSoirees: soireesMois.length,
    moyenneParSoiree: soireesMois.length > 0 ? somme(verresParSoiree) / soireesMois.length : null,
    sucreIncomplet: t.sucreIncomplet,
    kcalEstimee: t.kcalEstimee,
  };
}
