// ---------------------------------------------------------------------------
// Sauvegarde et restauration : export / import JSON complet, export CSV.
//
// Le JSON contient TOUTES les tables : il sert à sauvegarder puis restaurer
// l'appli à l'identique. Les CSV sont faits pour l'analyse (Python, tableur).
// ---------------------------------------------------------------------------

import { db, TABLES } from './db.js';
import { somme } from '../calculs/alcool.js';
import { valeurConsommation } from '../calculs/objectifs.js';
import { parametresPourSoiree, simulerAlcoolemie } from '../calculs/widmark.js';
import { versChampDateHeure } from '../calculs/format.js';
import { categoriePrincipale } from './selecteurs.js';

/** Marqueur qui permet de reconnaître un fichier de sauvegarde de l'appli. */
export const FORMAT_SAUVEGARDE = 'ardoise-sauvegarde';
export const VERSION_SAUVEGARDE = 1;

/** Lit toutes les tables et renvoie l'objet à écrire dans le fichier JSON. */
export async function exporterDonnees(maintenant = Date.now()) {
  const tables = {};
  await db.transaction('r', db.tables, async () => {
    for (const nom of TABLES) tables[nom] = await db.table(nom).toArray();
  });
  return {
    format: FORMAT_SAUVEGARDE,
    version: VERSION_SAUVEGARDE,
    exporteLe: new Date(maintenant).toISOString(),
    tables,
  };
}

/**
 * Vérifie qu'un objet lu depuis un fichier est bien une sauvegarde utilisable.
 * Lève une erreur expliquant le problème sinon.
 */
export function verifierSauvegarde(objet) {
  if (!objet || typeof objet !== 'object' || objet.format !== FORMAT_SAUVEGARDE) {
    throw new Error("Ce fichier n'est pas une sauvegarde d'Ardoise.");
  }
  if (typeof objet.version !== 'number' || objet.version > VERSION_SAUVEGARDE) {
    throw new Error("Cette sauvegarde vient d'une version plus récente de l'appli. Mets l'appli à jour, puis réessaie.");
  }
  for (const nom of TABLES) {
    if (!Array.isArray(objet.tables?.[nom])) {
      throw new Error(`Sauvegarde incomplète : la table « ${nom} » est absente.`);
    }
  }
}

/**
 * Restaure une sauvegarde : REMPLACE tout le contenu actuel par celui du
 * fichier. Tout se fait dans une seule transaction : si une étape échoue,
 * rien n'est modifié.
 */
export async function importerDonnees(objet) {
  verifierSauvegarde(objet);
  await db.transaction('rw', db.tables, async () => {
    for (const nom of TABLES) {
      await db.table(nom).clear();
      await db.table(nom).bulkAdd(objet.tables[nom]);
    }
  });
}

// ================================= CSV =====================================

/** Écrit une valeur dans une cellule CSV (guillemets si nécessaire, point décimal). */
function cellule(valeur) {
  if (valeur === null || valeur === undefined) return '';
  if (typeof valeur === 'number') return Number.isFinite(valeur) ? String(Math.round(valeur * 1000) / 1000) : '';
  if (typeof valeur === 'boolean') return valeur ? '1' : '0';
  const texte = String(valeur);
  return /[",\n\r]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
}

/**
 * Fabrique un texte CSV (séparateur virgule, encodage UTF-8).
 * @param {string[]} colonnes  noms des colonnes
 * @param {object[]} lignes    un objet par ligne, indexé par nom de colonne
 */
export function versCSV(colonnes, lignes) {
  const sortie = [colonnes.join(',')];
  for (const ligne of lignes) sortie.push(colonnes.map((c) => cellule(ligne[c])).join(','));
  return `${sortie.join('\n')}\n`;
}

/** CSV des consommations : une ligne par saisie, de la plus ancienne à la plus récente. */
export function csvConsommations({ consommations, categories, contenants, soirees, parametres }) {
  const categoriesParId = new Map(categories.map((c) => [c.id, c]));
  const contenantsParId = new Map(contenants.map((c) => [c.id, c]));
  const soireesParId = new Map(soirees.map((s) => [s.id, s]));
  const options = { gParVerre: parametres.gParVerre };
  const lignes = [...consommations]
    .sort((a, b) => a.horodatage - b.horodatage)
    .map((c) => ({
      id: c.id,
      date_heure: versChampDateHeure(c.horodatage),
      type: c.type,
      nom: c.snapshot?.nom ?? '',
      categorie: categoriesParId.get(categoriePrincipale(c))?.nom ?? '',
      contenant: contenantsParId.get(c.contenantId)?.nom ?? '',
      volume_ml: c.volumeML,
      quantite: c.quantite ?? 1,
      degre: c.snapshot?.degre ?? null,
      g_alcool: valeurConsommation(c, 'g', options),
      verres_standard: valeurConsommation(c, 'verres', options),
      kcal: valeurConsommation(c, 'kcal', options),
      kcal_estimee: Boolean(c.snapshot?.kcalEstimee),
      sucre_g: c.snapshot?.sucreG === null ? null : valeurConsommation(c, 'sucre', options),
      sucre_incomplet: Boolean(c.snapshot?.sucreIncomplet),
      prix_unitaire_eur: c.prixEuros,
      cout_eur: typeof c.prixEuros === 'number' ? valeurConsommation(c, 'euros', options) : null,
      soiree_id: c.soireeId,
      soiree_titre: soireesParId.get(c.soireeId)?.titre ?? '',
    }));
  return versCSV(
    ['id', 'date_heure', 'type', 'nom', 'categorie', 'contenant', 'volume_ml', 'quantite', 'degre',
      'g_alcool', 'verres_standard', 'kcal', 'kcal_estimee', 'sucre_g', 'sucre_incomplet',
      'prix_unitaire_eur', 'cout_eur', 'soiree_id', 'soiree_titre'],
    lignes,
  );
}

/** CSV des soirées : une ligne par soirée, avec ses totaux et son bilan. */
export function csvSoirees({ consommations, soirees, parametres }) {
  const options = { gParVerre: parametres.gParVerre };
  const lignes = [...soirees]
    .sort((a, b) => a.debut - b.debut)
    .map((s) => {
      const consos = consommations.filter((c) => c.soireeId === s.id);
      const widmark = parametresPourSoiree(s, parametres);
      const simulation = simulerAlcoolemie(
        consos.map((c) => ({ t: c.horodatage, gAlcool: valeurConsommation(c, 'g') })),
        widmark,
      );
      const avecPrix = consos.filter((c) => typeof c.prixEuros === 'number');
      return {
        id: s.id,
        titre: s.titre,
        debut: versChampDateHeure(s.debut),
        fin: s.fin ? versChampDateHeure(s.fin) : '',
        duree_h: s.fin ? (s.fin - s.debut) / 3600000 : null,
        nb_consommations: somme(consos, (c) => c.quantite ?? 1),
        g_alcool: somme(consos, (c) => valeurConsommation(c, 'g', options)),
        verres_standard: somme(consos, (c) => valeurConsommation(c, 'verres', options)),
        kcal: somme(consos, (c) => valeurConsommation(c, 'kcal', options)),
        sucre_g: somme(consos, (c) => valeurConsommation(c, 'sucre', options)),
        cout_eur: avecPrix.length > 0 ? somme(avecPrix, (c) => valeurConsommation(c, 'euros', options)) : null,
        pic_alcoolemie_estime_g_l: consos.length > 0 ? simulation.pic : null,
        poids_kg: widmark.poidsKg,
        ressenti: s.ressenti,
        repas: s.repas,
        hydratation: s.hydratation,
        fatigue: s.fatigue,
        gueule_de_bois: s.gueuleDeBois,
        notes: s.notes ?? '',
      };
    });
  return versCSV(
    ['id', 'titre', 'debut', 'fin', 'duree_h', 'nb_consommations', 'g_alcool', 'verres_standard', 'kcal',
      'sucre_g', 'cout_eur', 'pic_alcoolemie_estime_g_l', 'poids_kg', 'ressenti', 'repas', 'hydratation', 'fatigue',
      'gueule_de_bois', 'notes'],
    lignes,
  );
}
