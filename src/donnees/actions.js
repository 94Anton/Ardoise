// ---------------------------------------------------------------------------
// Actions : toutes les écritures dans la base passent par ce fichier.
// Les écrans n'écrivent jamais directement dans les tables.
// ---------------------------------------------------------------------------

import { db } from './db.js';
import { estNombre, snapshotBoisson, snapshotCocktail } from '../calculs/alcool.js';
import { alertesFranchies } from '../calculs/objectifs.js';
import { indexerParId, lireParametres, soireeEnCours } from './selecteurs.js';

// ============================ Consommations ================================

/**
 * Calcule le snapshot (valeurs figées d'une unité servie) à partir du
 * dataset actuel.
 * @param {number|null} volumeML  null pour un cocktail = volume de la recette
 */
async function construireSnapshot(type, refId, volumeML) {
  if (type === 'cocktail') {
    const cocktail = await db.cocktails.get(refId);
    if (!cocktail) throw new Error('Ce cocktail est introuvable.');
    const ingredients = await db.boissons.bulkGet(cocktail.ingredients.map((i) => i.boissonId));
    return snapshotCocktail(cocktail, indexerParId(ingredients.filter(Boolean)), volumeML);
  }
  const boisson = await db.boissons.get(refId);
  if (!boisson) throw new Error('Cette boisson est introuvable.');
  return snapshotBoisson(boisson, volumeML);
}

/** Élargit les bornes d'une soirée pour qu'elle contienne l'instant t. */
async function etendreSoiree(soireeId, t) {
  const soiree = await db.soirees.get(soireeId);
  if (!soiree) return;
  const modifs = {};
  if (t < soiree.debut) modifs.debut = t;
  if (soiree.fin !== null && soiree.fin !== undefined && t > soiree.fin) modifs.fin = t;
  if (Object.keys(modifs).length > 0) await db.soirees.update(soireeId, modifs);
}

/**
 * Enregistre une consommation.
 *
 * @param {object} saisie
 *   - type            'boisson' ou 'cocktail'
 *   - refId           id de la boisson ou du cocktail
 *   - contenantId     id du contenant, ou null pour un volume libre
 *   - volumeML        volume d'une unité ; facultatif pour un cocktail (recette)
 *   - quantite        nombre d'unités (1 par défaut)
 *   - prixEuros       prix unitaire, ou null
 *   - horodatage      instant de la consommation (maintenant par défaut)
 *   - soireeId        soirée de rattachement, ou null
 *   - nouvelleSoiree  { titre } pour créer la soirée en même temps (saisie après coup)
 * @returns {{id:number, soireeCreeeId:number|null, alertes:Array}}
 *   `alertes` liste les objectifs dont cette saisie fait franchir 80 % ou 100 %.
 */
export async function ajouterConsommation(saisie, maintenant = Date.now()) {
  const horodatage = saisie.horodatage ?? maintenant;
  const quantite = Math.max(1, Math.round(saisie.quantite ?? 1));
  const snapshot = await construireSnapshot(saisie.type, saisie.refId, saisie.volumeML ?? null);
  const volumeML = saisie.volumeML ?? snapshot.volumeML;

  return db.transaction('rw', db.consommations, db.soirees, db.objectifs, db.parametres, async () => {
    const avant = await db.consommations.toArray();
    const parametres = lireParametres(await db.parametres.toArray());

    let soireeId = saisie.soireeId ?? null;
    let soireeCreeeId = null;
    if (saisie.nouvelleSoiree) {
      // Soirée créée après coup : elle commence et finit à l'heure de cette
      // consommation, puis s'élargit au fil des consommations rattachées.
      soireeCreeeId = await db.soirees.add(
        soireeVide(saisie.nouvelleSoiree.titre, horodatage, horodatage, parametres.poidsKg),
      );
      soireeId = soireeCreeeId;
    }

    const consommation = {
      horodatage,
      type: saisie.type,
      refId: saisie.refId,
      contenantId: saisie.contenantId ?? null,
      volumeML,
      quantite,
      prixEuros: estNombre(saisie.prixEuros) ? saisie.prixEuros : null,
      soireeId,
      snapshot,
    };
    const id = await db.consommations.add(consommation);
    if (soireeId !== null) await etendreSoiree(soireeId, horodatage);

    const objectifs = await db.objectifs.toArray();
    const alertes = alertesFranchies(
      objectifs, avant, [...avant, { ...consommation, id }], maintenant, parametres.gParVerre,
    );
    return { id, soireeCreeeId, alertes };
  });
}

/** Annule un ajout tout juste fait (bouton « Annuler » du message de confirmation). */
export async function annulerAjout({ id, soireeCreeeId }) {
  await db.transaction('rw', db.consommations, db.soirees, async () => {
    await db.consommations.delete(id);
    if (soireeCreeeId !== null && soireeCreeeId !== undefined) {
      const restantes = await db.consommations.where('soireeId').equals(soireeCreeeId).count();
      if (restantes === 0) await db.soirees.delete(soireeCreeeId);
    }
  });
}

/**
 * « Reprendre le même » : duplique la consommation la plus récente à l'heure
 * actuelle, rattachée à la soirée en cours s'il y en a une.
 * @returns le même résultat que ajouterConsommation, ou null s'il n'y a rien à reprendre
 */
export async function reprendreLeMeme(maintenant = Date.now()) {
  const derniere = await db.consommations.orderBy('horodatage').last();
  if (!derniere) return null;
  const enCours = soireeEnCours(await db.soirees.toArray());
  return ajouterConsommation(
    {
      type: derniere.type,
      refId: derniere.refId,
      contenantId: derniere.contenantId,
      volumeML: derniere.volumeML,
      quantite: derniere.quantite,
      prixEuros: derniere.prixEuros,
      horodatage: maintenant,
      soireeId: enCours ? enCours.id : null,
    },
    maintenant,
  );
}

/**
 * Modifie une consommation existante.
 * Si le volume change, le snapshot est recalculé avec le dataset actuel ;
 * sinon il reste figé (c'est ce qui préserve l'historique).
 */
export async function modifierConsommation(id, modifs) {
  const actuelle = await db.consommations.get(id);
  if (!actuelle) throw new Error('Cette consommation est introuvable.');
  const suivante = { ...actuelle, ...modifs };
  if (modifs.quantite !== undefined) suivante.quantite = Math.max(1, Math.round(modifs.quantite));
  if (modifs.volumeML !== undefined && modifs.volumeML !== actuelle.volumeML) {
    suivante.snapshot = await construireSnapshot(actuelle.type, actuelle.refId, modifs.volumeML);
  }
  await db.transaction('rw', db.consommations, db.soirees, async () => {
    await db.consommations.put(suivante);
    if (suivante.soireeId !== null && suivante.soireeId !== undefined) {
      await etendreSoiree(suivante.soireeId, suivante.horodatage);
    }
  });
}

export async function supprimerConsommation(id) {
  await db.consommations.delete(id);
}

/** Remet une consommation supprimée, à l'identique (bouton « Annuler » après une suppression). */
export async function restaurerConsommation(consommation) {
  await db.consommations.put(consommation);
}

/** Bouton « Recalculer » : actualise le snapshot d'une consommation avec le dataset actuel. */
export async function recalculerConsommation(id) {
  const c = await db.consommations.get(id);
  if (!c) return;
  const snapshot = await construireSnapshot(c.type, c.refId, c.volumeML);
  await db.consommations.update(id, { snapshot });
}

/**
 * Actualise toutes les consommations passées qui utilisent une boisson
 * (seule ou comme ingrédient d'un cocktail). Utile après avoir corrigé un
 * degré ou des calories dans le dataset.
 * @returns {number} nombre de consommations recalculées
 */
export async function recalculerPourBoisson(boissonId) {
  const concernees = (await db.consommations.toArray()).filter((c) =>
    (c.snapshot?.composants ?? []).some((k) => k.boissonId === boissonId),
  );
  for (const c of concernees) await recalculerConsommation(c.id);
  return concernees.length;
}

/**
 * Même chose pour un cocktail dont la recette a changé.
 *
 * @param {number|null} ancienVolumeML  volume de la recette AVANT modification.
 *   Les consommations servies à ce volume (« à la recette ») passent au
 *   volume de la nouvelle recette ; celles saisies avec un autre volume
 *   gardent le leur, et la nouvelle recette y est mise à l'échelle.
 *   Sans cette information, toutes suivent la nouvelle recette.
 */
export async function recalculerPourCocktail(cocktailId, ancienVolumeML = null) {
  const concernees = (await db.consommations.toArray()).filter(
    (c) => c.type === 'cocktail' && c.refId === cocktailId,
  );
  for (const c of concernees) {
    const suitLaRecette = ancienVolumeML === null || Math.abs(c.volumeML - ancienVolumeML) < 1e-6;
    const snapshot = await construireSnapshot('cocktail', cocktailId, suitLaRecette ? null : c.volumeML);
    await db.consommations.update(c.id, { snapshot, volumeML: suitLaRecette ? snapshot.volumeML : c.volumeML });
  }
  return concernees.length;
}

// ================================ Soirées ==================================

/**
 * Fabrique une soirée sans bilan. `fin` vaut null tant qu'elle est en cours.
 * `poidsKg` est le poids réglé à ce moment-là : l'estimation d'alcoolémie de
 * cette soirée continuera de l'utiliser même si le réglage change plus tard.
 */
function soireeVide(titre, debut, fin, poidsKg = null) {
  return {
    titre: (titre ?? '').trim() || 'Soirée',
    debut,
    fin,
    poidsKg,
    ressenti: null, // 1 = pas du tout alcoolisé … 10 = très alcoolisé
    repas: null, // 1 = rien mangé … 10 = très bien mangé
    hydratation: null, // 1 = pas d'eau … 10 = beaucoup d'eau
    fatigue: null, // 1 = en forme … 10 = très fatigué
    gueuleDeBois: null, // saisie le lendemain : 1 = aucune … 10 = très forte
    gueuleDeBoisIgnoree: false, // vrai si l'on a répondu « ne pas noter » au rappel
    notes: '',
  };
}

/** Démarre une soirée maintenant. Une seule soirée peut être en cours à la fois. */
export async function demarrerSoiree(titre, maintenant = Date.now()) {
  return db.transaction('rw', db.soirees, db.parametres, async () => {
    if (soireeEnCours(await db.soirees.toArray())) {
      throw new Error('Une soirée est déjà en cours. Termine-la avant d\'en démarrer une autre.');
    }
    const parametres = lireParametres(await db.parametres.toArray());
    return db.soirees.add(soireeVide(titre, maintenant, null, parametres.poidsKg));
  });
}

/** Termine une soirée. L'heure de fin ne peut pas précéder le début. */
export async function terminerSoiree(id, fin = Date.now()) {
  const soiree = await db.soirees.get(id);
  if (!soiree) return;
  await db.soirees.update(id, { fin: Math.max(fin, soiree.debut) });
}

/** Enregistre le titre, les horaires ou le bilan d'une soirée. */
export async function enregistrerSoiree(id, champs) {
  await db.soirees.update(id, champs);
}

/** Supprime une soirée. Ses consommations sont conservées, simplement détachées. */
export async function supprimerSoiree(id) {
  await db.transaction('rw', db.consommations, db.soirees, async () => {
    await db.consommations.where('soireeId').equals(id).modify({ soireeId: null });
    await db.soirees.delete(id);
  });
}

// ================================ Dataset ==================================

/** Convertit une saisie en nombre, ou null si le champ est vide. */
function nombreOuNull(x) {
  return estNombre(x) ? x : null;
}

/**
 * Crée ou modifie une boisson (création si `boisson.id` est absent).
 * @returns {number} id de la boisson
 */
export async function enregistrerBoisson(boisson) {
  const nom = (boisson.nom ?? '').trim();
  if (!nom) throw new Error('Donne un nom à la boisson.');
  if (!estNombre(boisson.categorieId)) throw new Error('Choisis une catégorie.');
  if (!estNombre(boisson.degre) || boisson.degre < 0 || boisson.degre > 100) {
    throw new Error('Le degré doit être compris entre 0 et 100 %.');
  }
  const champs = {
    nom,
    categorieId: boisson.categorieId,
    degre: boisson.degre,
    kcalParL: nombreOuNull(boisson.kcalParL),
    sucreGParL: nombreOuNull(boisson.sucreGParL),
    favori: Boolean(boisson.favori),
    notes: boisson.notes ?? '',
    archive: Boolean(boisson.archive),
  };
  if (boisson.id !== undefined && boisson.id !== null) {
    await db.boissons.update(boisson.id, champs);
    return boisson.id;
  }
  return db.boissons.add(champs);
}

/**
 * Supprime une boisson… sauf si elle a déjà été consommée ou sert dans un
 * cocktail : elle est alors archivée (masquée de la saisie, conservée dans
 * l'historique).
 * @returns {'supprimee'|'archivee'}
 */
export async function supprimerBoisson(id) {
  return db.transaction('rw', db.boissons, db.cocktails, db.consommations, async () => {
    const consommee = (await db.consommations.toArray()).some((c) =>
      (c.snapshot?.composants ?? []).some((k) => k.boissonId === id),
    );
    const dansCocktail = (await db.cocktails.toArray()).some((c) =>
      (c.ingredients ?? []).some((i) => i.boissonId === id),
    );
    if (consommee || dansCocktail) {
      await db.boissons.update(id, { archive: true, favori: false });
      return 'archivee';
    }
    await db.boissons.delete(id);
    return 'supprimee';
  });
}

/** Sort une boisson ou un cocktail des archives. */
export async function restaurer(table, id) {
  await db.table(table).update(id, { archive: false });
}

/** Coche ou décoche le favori d'une boisson ou d'un cocktail. */
export async function basculerFavori(table, id, favori) {
  await db.table(table).update(id, { favori: Boolean(favori) });
}

/**
 * Crée ou modifie un cocktail.
 * @param {object} cocktail { id?, nom, ingredients: [{ boissonId, volumeML }], favori }
 */
export async function enregistrerCocktail(cocktail) {
  const nom = (cocktail.nom ?? '').trim();
  if (!nom) throw new Error('Donne un nom au cocktail.');
  const ingredients = (cocktail.ingredients ?? [])
    .filter((i) => estNombre(i.boissonId) && estNombre(i.volumeML) && i.volumeML > 0)
    .map((i) => ({ boissonId: i.boissonId, volumeML: i.volumeML }));
  if (ingredients.length === 0) throw new Error('Ajoute au moins un ingrédient avec son volume.');
  const champs = { nom, ingredients, favori: Boolean(cocktail.favori), archive: Boolean(cocktail.archive) };
  if (cocktail.id !== undefined && cocktail.id !== null) {
    await db.cocktails.update(cocktail.id, champs);
    return cocktail.id;
  }
  return db.cocktails.add(champs);
}

/** Supprime un cocktail, ou l'archive s'il a déjà été consommé. */
export async function supprimerCocktail(id) {
  return db.transaction('rw', db.cocktails, db.consommations, async () => {
    const consomme = (await db.consommations.toArray()).some((c) => c.type === 'cocktail' && c.refId === id);
    if (consomme) {
      await db.cocktails.update(id, { archive: true, favori: false });
      return 'archivee';
    }
    await db.cocktails.delete(id);
    return 'supprimee';
  });
}

/** Crée ou modifie un contenant. */
export async function enregistrerContenant(contenant) {
  const nom = (contenant.nom ?? '').trim();
  if (!nom) throw new Error('Donne un nom au contenant.');
  if (!estNombre(contenant.volumeML) || contenant.volumeML <= 0) {
    throw new Error('Le volume doit être supérieur à 0.');
  }
  const champs = { nom, volumeML: contenant.volumeML, predefini: Boolean(contenant.predefini) };
  if (contenant.id !== undefined && contenant.id !== null) {
    await db.contenants.update(contenant.id, champs);
    return contenant.id;
  }
  return db.contenants.add(champs);
}

/**
 * Supprime un contenant. Les consommations passées gardent leur volume ;
 * elles sont simplement affichées comme un volume libre.
 */
export async function supprimerContenant(id) {
  await db.transaction('rw', db.contenants, db.consommations, async () => {
    await db.consommations.filter((c) => c.contenantId === id).modify({ contenantId: null });
    await db.contenants.delete(id);
  });
}

/** Crée ou modifie une catégorie. */
export async function enregistrerCategorie(categorie) {
  const nom = (categorie.nom ?? '').trim();
  if (!nom) throw new Error('Donne un nom à la catégorie.');
  const champs = {
    nom,
    couleur: categorie.couleur || '#7d8a96',
    alcoolisee: categorie.alcoolisee !== false,
  };
  if (categorie.id !== undefined && categorie.id !== null) {
    await db.categories.update(categorie.id, champs);
    return categorie.id;
  }
  return db.categories.add(champs);
}

/** Supprime une catégorie, seulement si plus rien ne s'en sert. */
export async function supprimerCategorie(id) {
  await db.transaction('rw', db.categories, db.boissons, db.objectifs, async () => {
    const nbBoissons = await db.boissons.where('categorieId').equals(id).count();
    if (nbBoissons > 0) {
      throw new Error(
        `Cette catégorie contient encore ${nbBoissons} boisson${nbBoissons > 1 ? 's' : ''} (archivées comprises). Déplace-les d'abord dans une autre catégorie.`,
      );
    }
    const objectifLie = (await db.objectifs.toArray()).find((o) => o.filtreCategorie === id);
    if (objectifLie) {
      throw new Error(`L'objectif « ${objectifLie.nom} » porte sur cette catégorie. Modifie-le d'abord.`);
    }
    await db.categories.delete(id);
  });
}

// =============================== Objectifs =================================

/**
 * Crée ou modifie un objectif.
 * @param {object} objectif { id?, nom, unite, limite, periode, nJours, filtreCategorie, seuilAlerte, actif }
 */
export async function enregistrerObjectif(objectif, maintenant = Date.now()) {
  if (!estNombre(objectif.limite) || objectif.limite <= 0) {
    throw new Error('La limite doit être un nombre supérieur à 0.');
  }
  if (objectif.periode === 'jours' && (!estNombre(objectif.nJours) || objectif.nJours < 1)) {
    throw new Error('Indique le nombre de jours de la période.');
  }
  const champs = {
    nom: (objectif.nom ?? '').trim() || 'Objectif',
    unite: objectif.unite,
    limite: objectif.limite,
    periode: objectif.periode,
    nJours: objectif.periode === 'jours' ? Math.round(objectif.nJours) : null,
    filtreCategorie: estNombre(objectif.filtreCategorie) ? objectif.filtreCategorie : null,
    seuilAlerte: estNombre(objectif.seuilAlerte) ? objectif.seuilAlerte : 0.8,
    actif: objectif.actif !== false,
  };
  if (objectif.id !== undefined && objectif.id !== null) {
    await db.objectifs.update(objectif.id, champs);
    return objectif.id;
  }
  return db.objectifs.add({ ...champs, creeLe: maintenant });
}

export async function supprimerObjectif(id) {
  await db.objectifs.delete(id);
}

// ============================== Paramètres =================================

/** Enregistre un ou plusieurs réglages : ecrireParametres({ poidsKg: 70 }). */
export async function ecrireParametres(valeurs) {
  await db.parametres.bulkPut(Object.entries(valeurs).map(([cle, valeur]) => ({ cle, valeur })));
}
