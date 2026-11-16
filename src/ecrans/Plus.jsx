// Écran « Plus » : accès au dataset, aux objectifs et aux paramètres.

import { Link } from 'react-router-dom';
import { Entete } from '../composants/base.jsx';
import { Icone } from '../composants/Icone.jsx';
import { useDonnees } from '../contexte/Donnees.jsx';

/** « 3 boissons », « 1 cocktail », « 0 objectif ». */
const compter = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

export default function Plus() {
  const d = useDonnees();
  const nbBoissons = d.boissons.filter((b) => !b.archive).length;
  const nbCocktails = d.cocktails.filter((c) => !c.archive).length;
  const nbObjectifs = d.objectifs.filter((o) => o.actif).length;

  const entrees = [
    {
      vers: '/dataset',
      titre: 'Dataset',
      detail: `${compter(nbBoissons, 'boisson')}, ${compter(nbCocktails, 'cocktail')}, ${compter(d.contenants.length, 'contenant')}`,
    },
    {
      vers: '/objectifs',
      titre: 'Objectifs',
      detail: nbObjectifs === 0 ? 'Aucune limite fixée pour l\'instant' : `${compter(nbObjectifs, 'objectif')} en cours`,
    },
    {
      vers: '/parametres',
      titre: 'Paramètres',
      detail: 'Profil, calculs, sauvegarde et restauration',
    },
  ];

  return (
    <>
      <Entete titre="Plus" />
      <ul className="liste">
        {entrees.map((e) => (
          <li key={e.vers}>
            <Link className="ligne menu-ligne" to={e.vers}>
              <span className="ligne__corps">
                <span className="ligne__titre" style={{ display: 'block', fontSize: 19 }}>{e.titre}</span>
                <span className="ligne__detail">{e.detail}</span>
              </span>
              <Icone nom="chevron" taille={20} style={{ color: 'var(--encre-3)', flex: 'none' }} />
            </Link>
          </li>
        ))}
      </ul>
      <p className="mini tres-discret" style={{ marginTop: 22 }}>
        Ardoise {__VERSION_APPLI__}. Tes données restent sur ce téléphone : rien n'est envoyé sur Internet.
      </p>
    </>
  );
}
