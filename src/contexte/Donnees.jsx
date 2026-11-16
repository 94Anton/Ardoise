// ---------------------------------------------------------------------------
// Fournisseur de données : lit toute la base une fois et la relit
// automatiquement dès qu'une table change (useLiveQuery de Dexie).
//
// Les écrans appellent simplement `const donnees = useDonnees()` ; ils n'ont
// jamais à se soucier du chargement ni du rafraîchissement.
// Volume de données d'un usage personnel : quelques milliers de lignes au
// plus, donc tout tient en mémoire sans difficulté.
// ---------------------------------------------------------------------------

import { createContext, useContext } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../donnees/db.js';
import { indexerParId, lireParametres, soireeEnCours } from '../donnees/selecteurs.js';

const Contexte = createContext(null);

const parNom = (a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' });

async function toutLire() {
  try {
    const categories = await db.categories.toArray();
    const boissons = (await db.boissons.toArray()).sort(parNom);
    const contenants = await db.contenants.toArray();
    const cocktails = (await db.cocktails.toArray()).sort(parNom);
    // Consommations et soirées : de la plus récente à la plus ancienne.
    const consommations = await db.consommations.orderBy('horodatage').reverse().toArray();
    const soirees = await db.soirees.orderBy('debut').reverse().toArray();
    const objectifs = await db.objectifs.toArray();
    const parametres = lireParametres(await db.parametres.toArray());
    return {
      categories, boissons, contenants, cocktails, consommations, soirees, objectifs, parametres,
      categoriesParId: indexerParId(categories),
      boissonsParId: indexerParId(boissons),
      contenantsParId: indexerParId(contenants),
      cocktailsParId: indexerParId(cocktails),
      soireesParId: indexerParId(soirees),
      soireeEnCours: soireeEnCours(soirees),
      // Paramètres de l'estimation d'alcoolémie, prêts à passer à simulerAlcoolemie().
      widmark: { poidsKg: parametres.poidsKg, r: parametres.r, beta: parametres.beta },
    };
  } catch (erreur) {
    return { erreur };
  }
}

export function DonneesProvider({ children }) {
  const donnees = useLiveQuery(toutLire, []);

  if (!donnees) return <div className="chargement">Ouverture…</div>;
  if (donnees.erreur) {
    return (
      <div className="ecran ecran--sans-nav">
        <h1>Impossible d'ouvrir les données</h1>
        <p className="discret" style={{ marginTop: 12 }}>
          Le stockage local du navigateur est inaccessible (navigation privée, stockage désactivé ou plein).
          Ouvre l'appli dans une fenêtre normale de Safari, ou depuis son icône sur l'écran d'accueil.
        </p>
        <p className="mini tres-discret" style={{ marginTop: 12 }}>{String(donnees.erreur?.message ?? donnees.erreur)}</p>
      </div>
    );
  }
  return <Contexte.Provider value={donnees}>{children}</Contexte.Provider>;
}

/** Toutes les données de l'appli, toujours à jour. */
export function useDonnees() {
  return useContext(Contexte);
}
