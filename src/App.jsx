// ---------------------------------------------------------------------------
// Squelette de l'appli : les routes (une par écran) et la barre de navigation.
//
// On utilise un routeur « à dièse » (adresses du type …/#/stats) : c'est le
// seul qui marche sans réglage sur GitHub Pages et hors ligne.
// ---------------------------------------------------------------------------

import { useEffect } from 'react';
import { HashRouter, Link, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { DonneesProvider, useDonnees } from './contexte/Donnees.jsx';
import { NotificationsProvider } from './contexte/Notifications.jsx';
import { Icone } from './composants/Icone.jsx';
import { ecrireParametres } from './donnees/actions.js';
import { demanderPersistance } from './utilitaires/plateforme.js';
import Accueil from './ecrans/Accueil.jsx';
import Saisie from './ecrans/Saisie.jsx';
import Historique from './ecrans/Historique.jsx';
import Soiree from './ecrans/Soiree.jsx';
import Bilan from './ecrans/Bilan.jsx';
import Stats from './ecrans/Stats.jsx';
import Plus from './ecrans/Plus.jsx';
import Dataset from './ecrans/Dataset.jsx';
import EditeurCocktail from './ecrans/EditeurCocktail.jsx';
import Objectifs from './ecrans/Objectifs.jsx';
import DetailObjectif from './ecrans/DetailObjectif.jsx';
import Parametres from './ecrans/Parametres.jsx';

/** Remonte en haut de page à chaque changement d'écran. */
function RetourEnHaut() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** Au premier lancement : demande un stockage persistant, une seule fois. */
function PremierLancement() {
  const { parametres } = useDonnees();
  useEffect(() => {
    if (parametres.persistance === undefined) {
      demanderPersistance().then((persistance) => ecrireParametres({ persistance }));
    }
  }, [parametres.persistance]);
  return null;
}

/** Barre du bas : Accueil, Historique, « + » au centre, Stats, Plus. */
function BarreNavigation() {
  const { pathname } = useLocation();
  // L'onglet « Plus » reste allumé sur ses sous-écrans.
  const dansPlus = ['/plus', '/dataset', '/objectifs', '/parametres'].some((p) => pathname.startsWith(p));
  return (
    <nav className="nav" aria-label="Navigation principale">
      <div className="nav__contenu">
        <NavLink to="/" end className="nav__lien">
          <Icone nom="accueil" />
          Accueil
        </NavLink>
        <NavLink to="/historique" className="nav__lien">
          <Icone nom="historique" />
          Historique
        </NavLink>
        <Link to="/saisie" className="nav__plus" aria-label="Ajouter une consommation">
          <Icone nom="plus" taille={30} strokeWidth="2.4" />
        </Link>
        <NavLink to="/stats" className="nav__lien">
          <Icone nom="stats" />
          Stats
        </NavLink>
        <Link to="/plus" className="nav__lien" aria-current={dansPlus ? 'page' : undefined}>
          <Icone nom="menu" />
          Plus
        </Link>
      </div>
    </nav>
  );
}

/** Cadre commun aux écrans qui affichent la barre de navigation. */
function Cadre() {
  return (
    <>
      <main className="ecran">
        <Outlet />
      </main>
      <BarreNavigation />
    </>
  );
}

/** Cadre des écrans plein écran (saisie, bilan) : pas de barre de navigation. */
function CadreSansNav() {
  return (
    <main className="ecran ecran--sans-nav">
      <Outlet />
    </main>
  );
}

export default function App() {
  return (
    <HashRouter>
      <DonneesProvider>
        <NotificationsProvider>
          <RetourEnHaut />
          <PremierLancement />
          <Routes>
            <Route element={<Cadre />}>
              <Route index element={<Accueil />} />
              <Route path="historique" element={<Historique />} />
              <Route path="soiree/:id" element={<Soiree />} />
              <Route path="stats" element={<Stats />} />
              <Route path="plus" element={<Plus />} />
              <Route path="dataset" element={<Dataset />} />
              <Route path="dataset/cocktail/:id" element={<EditeurCocktail />} />
              <Route path="objectifs" element={<Objectifs />} />
              <Route path="objectifs/:id" element={<DetailObjectif />} />
              <Route path="parametres" element={<Parametres />} />
              <Route path="*" element={<Accueil />} />
            </Route>
            <Route element={<CadreSansNav />}>
              <Route path="saisie" element={<Saisie />} />
              <Route path="soiree/:id/bilan" element={<Bilan />} />
            </Route>
          </Routes>
        </NotificationsProvider>
      </DonneesProvider>
    </HashRouter>
  );
}
