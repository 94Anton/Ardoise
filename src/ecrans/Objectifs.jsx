// Objectifs : toutes les limites fixées, avec leur avancement sur la période
// en cours. Toucher un objectif ouvre son détail et son historique.

import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Entete, Section, Vide } from '../composants/base.jsx';
import { Icone } from '../composants/Icone.jsx';
import { BlocObjectif, libelleRythme } from '../composants/Objectif.jsx';
import { FeuilleObjectif, nomParDefaut } from '../composants/FeuilleObjectif.jsx';
import { useDonnees } from '../contexte/Donnees.jsx';
import { useMaintenant } from '../utilitaires/crochets.js';
import { progression } from '../calculs/objectifs.js';
import { valeurAvecUnite } from '../calculs/format.js';
import { enregistrerObjectif } from '../donnees/actions.js';

// Repères de consommation à moindre risque de Santé publique France,
// proposés en un tap quand aucun objectif n'existe encore.
const REPERES = [
  { unite: 'verres', limite: 10, periode: 'semaine', nJours: null },
  { unite: 'verres', limite: 2, periode: 'jour', nJours: null },
];

export default function Objectifs() {
  const d = useDonnees();
  const maintenant = useMaintenant();
  const [parametresUrl, setParametresUrl] = useSearchParams();
  // « ?nouveau=1 » (lien « Fixer un objectif » de l'accueil) ouvre directement le formulaire.
  const [feuille, setFeuille] = useState(parametresUrl.get('nouveau') === '1');
  const gParVerre = d.parametres.gParVerre;

  const actifs = d.objectifs.filter((o) => o.actif);
  const enPause = d.objectifs.filter((o) => !o.actif);

  function fermerFeuille() {
    setFeuille(false);
    if (parametresUrl.has('nouveau')) setParametresUrl({}, { replace: true });
  }

  return (
    <>
      <Entete titre="Objectifs" retour="/plus" />

      <button className="bouton bouton--plein bouton--large" onClick={() => setFeuille(true)}>Nouvel objectif</button>

      {d.objectifs.length === 0 && (
        <Vide>
          <p>
            Un objectif est une limite à ne pas dépasser sur une période : des verres standard par mois, une dépense
            par semaine, des calories sur 30 jours… Une alerte s'affiche quand tu atteins 80 % de la limite, puis 100 %.
          </p>
          <p style={{ marginTop: 14 }}>
            Pour démarrer, tu peux reprendre les repères de Santé publique France :
          </p>
          <div className="pile" style={{ marginTop: 4 }}>
            {REPERES.map((r) => (
              <button
                key={r.periode} className="bouton bouton--large bouton--gauche"
                onClick={() => enregistrerObjectif({ ...r, nom: nomParDefaut(r) })}
              >
                <Icone nom="plus" taille={20} style={{ flex: 'none' }} />
                {valeurAvecUnite(r.limite, r.unite)} standard au plus {libelleRythme(r)}
              </button>
            ))}
          </div>
        </Vide>
      )}

      {actifs.length > 0 && (
        <Section titre="En cours">
          <ul className="liste">
            {actifs.map((o) => (
              <li key={o.id}>
                <BlocObjectif objectif={o} p={progression(o, d.consommations, maintenant, gParVerre)} vers={`/objectifs/${o.id}`} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {enPause.length > 0 && (
        <Section titre="En pause">
          <ul className="liste">
            {enPause.map((o) => (
              <li key={o.id}>
                <Link className="ligne" to={`/objectifs/${o.id}`}>
                  <span className="ligne__corps">
                    <span className="ligne__titre" style={{ display: 'block' }}>{o.nom}</span>
                    <span className="ligne__detail">
                      {valeurAvecUnite(o.limite, o.unite)} {libelleRythme(o)}, sans alerte ni affichage sur l'accueil
                    </span>
                  </span>
                  <Icone nom="chevron" taille={20} style={{ color: 'var(--encre-3)', flex: 'none' }} />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {feuille && <FeuilleObjectif onFermer={fermerFeuille} />}
    </>
  );
}
