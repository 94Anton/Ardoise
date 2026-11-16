// ---------------------------------------------------------------------------
// Calculs de base : alcool pur, verres standard, calories, sucre, cocktails.
//
// Ce fichier ne contient que des fonctions « pures » : elles ne lisent ni la
// base de données ni l'écran, et renvoient toujours le même résultat pour les
// mêmes arguments. C'est ce qui permet de les tester facilement (voir
// alcool.test.js).
// ---------------------------------------------------------------------------

/** Masse volumique de l'éthanol retenue, en g/mL (convention française). */
export const DENSITE_ETHANOL = 0.8;

/** Énergie de l'alcool pur, en kcal/g. Sert d'estimation minimale des calories. */
export const KCAL_PAR_G_ALCOOL = 7;

/** Vrai si x est un nombre utilisable (ni null, ni undefined, ni NaN). */
export function estNombre(x) {
  return typeof x === 'number' && Number.isFinite(x);
}

/**
 * Masse d'alcool pur, en grammes.
 *   m = V (mL) × degré / 100 × 0,8
 * Exemple : une pinte (500 mL) à 5 % → 20 g.
 */
export function grammesAlcool(volumeML, degre) {
  return volumeML * (degre / 100) * DENSITE_ETHANOL;
}

/** Nombre de verres standard (en France, 1 verre standard = 10 g d'alcool pur). */
export function verresStandard(gAlcool, gParVerre = 10) {
  return gAlcool / gParVerre;
}

/**
 * Calcule ce qu'apporte un volume donné d'une boisson.
 * C'est la brique de base : une consommation simple a un seul composant,
 * un cocktail en a un par ingrédient.
 *
 * @param {object} boisson   { id, nom, categorieId, degre, kcalParL, sucreGParL }
 * @param {number} volumeML  volume servi, en mL
 * @returns {object} composant :
 *   - gAlcool      grammes d'alcool pur
 *   - kcal         calories ; si kcalParL est inconnu, estimation « alcool seul »
 *                  (7 kcal par gramme d'alcool) et kcalEstimee = true
 *   - sucreG       grammes de sucre, ou null si sucreGParL est inconnu
 */
export function calculerComposant(boisson, volumeML) {
  const degre = estNombre(boisson.degre) ? boisson.degre : 0;
  const gAlcool = grammesAlcool(volumeML, degre);
  const kcalConnues = estNombre(boisson.kcalParL);
  const kcal = kcalConnues ? (volumeML / 1000) * boisson.kcalParL : gAlcool * KCAL_PAR_G_ALCOOL;
  const sucreG = estNombre(boisson.sucreGParL) ? (volumeML / 1000) * boisson.sucreGParL : null;
  return {
    boissonId: boisson.id,
    categorieId: boisson.categorieId,
    nom: boisson.nom,
    volumeML,
    degre,
    gAlcool,
    kcal,
    kcalEstimee: !kcalConnues,
    sucreG,
  };
}

/**
 * Assemble des composants en un « snapshot » : la photo des valeurs d'UNE
 * unité servie (une pinte, un mojito…), figée au moment de la saisie.
 * Les totaux d'une consommation s'obtiennent en multipliant par la quantité.
 */
function assemblerSnapshot(nom, composants) {
  const volumeML = somme(composants, (k) => k.volumeML);
  const gAlcool = somme(composants, (k) => k.gAlcool);
  const sucresConnus = composants.filter((k) => k.sucreG !== null);
  return {
    nom,
    volumeML,
    // Degré affiché : moyenne pondérée par les volumes.
    degre: volumeML > 0 ? somme(composants, (k) => k.volumeML * k.degre) / volumeML : 0,
    gAlcool,
    kcal: somme(composants, (k) => k.kcal),
    kcalEstimee: composants.some((k) => k.kcalEstimee),
    // Sucre : somme des valeurs connues ; null si aucune n'est connue.
    sucreG: sucresConnus.length > 0 ? somme(sucresConnus, (k) => k.sucreG) : null,
    sucreIncomplet: sucresConnus.length < composants.length,
    composants,
  };
}

/** Snapshot d'une boisson simple servie dans un volume donné. */
export function snapshotBoisson(boisson, volumeML) {
  return assemblerSnapshot(boisson.nom, [calculerComposant(boisson, volumeML)]);
}

/** Volume total de la recette d'un cocktail, en mL. */
export function volumeRecette(cocktail) {
  return somme(cocktail.ingredients ?? [], (i) => i.volumeML);
}

/**
 * Snapshot d'un cocktail.
 * Les grandeurs s'additionnent sur les ingrédients. Si un volume servi est
 * donné et diffère de celui de la recette, toute la recette est mise à
 * l'échelle (un « double » mojito = 2 × chaque ingrédient).
 *
 * @param {object} cocktail      { nom, ingredients: [{ boissonId, volumeML }] }
 * @param {Map|object} boissonsParId  pour retrouver chaque ingrédient
 * @param {number|null} volumeML volume servi ; null = volume de la recette
 */
export function snapshotCocktail(cocktail, boissonsParId, volumeML = null) {
  const lire = (id) => (boissonsParId instanceof Map ? boissonsParId.get(id) : boissonsParId[id]);
  const total = volumeRecette(cocktail);
  const facteur = estNombre(volumeML) && total > 0 ? volumeML / total : 1;
  const composants = [];
  for (const ingredient of cocktail.ingredients ?? []) {
    const boisson = lire(ingredient.boissonId);
    if (!boisson) continue; // ingrédient introuvable : ignoré plutôt que de planter
    composants.push(calculerComposant(boisson, ingredient.volumeML * facteur));
  }
  return assemblerSnapshot(cocktail.nom, composants);
}

/** Somme de f(x) sur un tableau. */
export function somme(tableau, f = (x) => x) {
  let total = 0;
  for (const x of tableau) total += f(x);
  return total;
}
