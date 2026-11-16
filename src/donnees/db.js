// ---------------------------------------------------------------------------
// Base de données locale (IndexedDB, via la bibliothèque Dexie).
//
// Tout est stocké sur le téléphone : rien ne part sur Internet.
// Schéma détaillé (champs de chaque table) : voir le README.
// ---------------------------------------------------------------------------

import Dexie from 'dexie';
import { CATEGORIES_INITIALES, CONTENANTS_INITIAUX } from './valeursInitiales.js';

export const NOM_BASE = 'ardoise';

/** Liste des tables, dans l'ordre utilisé pour l'export et l'import. */
export const TABLES = [
  'categories', 'boissons', 'contenants', 'cocktails',
  'consommations', 'soirees', 'objectifs', 'parametres',
];

export const db = new Dexie(NOM_BASE);

// Dans Dexie, on ne déclare que la clé primaire et les champs indexés
// (ceux sur lesquels on veut chercher ou trier) ; les autres champs sont
// libres. « ++id » = identifiant entier attribué automatiquement.
db.version(1).stores({
  categories: '++id, nom',
  boissons: '++id, nom, categorieId',
  contenants: '++id, nom',
  cocktails: '++id, nom',
  consommations: '++id, horodatage, soireeId',
  soirees: '++id, debut',
  objectifs: '++id',
  parametres: 'cle', // une ligne par réglage : { cle, valeur }
});

// Appelé une seule fois, quand la base est créée (premier lancement ou après
// une réinitialisation) : on y met les catégories et contenants de départ.
db.on('populate', (transaction) => {
  transaction.table('categories').bulkAdd(CATEGORIES_INITIALES.map((c) => ({ ...c })));
  transaction.table('contenants').bulkAdd(CONTENANTS_INITIAUX.map((c) => ({ ...c })));
  transaction.table('parametres').add({ cle: 'premierLancement', valeur: Date.now() });
});

/** Efface absolument tout et recrée une base neuve avec les données de départ. */
export async function reinitialiserBase() {
  await db.delete();
  await db.open();
}
