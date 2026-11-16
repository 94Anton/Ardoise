// Détail d'un objectif : avancement sur la période en cours, puis historique
// des périodes passées (respecté ou dépassé, et de combien).

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Entete, FeuilleConfirmation, Section } from '../composants/base.jsx';
import { BlocObjectif, libelleRythme } from '../composants/Objectif.jsx';
import { FeuilleObjectif } from '../composants/FeuilleObjectif.jsx';
import { GraphiqueBarres } from '../composants/graphiques.jsx';
import { Icone } from '../composants/Icone.jsx';
import { useDonnees } from '../contexte/Donnees.jsx';
import { useMaintenant } from '../utilitaires/crochets.js';
import { UNITES, historiqueObjectif, progression } from '../calculs/objectifs.js';
import { ajouterJours } from '../calculs/periodes.js';
import { dateCourte, jourMois, majuscule, moisAnnee, moisCourt, nombre, valeurAvecUnite } from '../calculs/format.js';
import { enregistrerObjectif, supprimerObjectif } from '../donnees/actions.js';

/** Nom lisible d'une période : « Novembre 2026 », « Semaine du 09/11/2026 »… */
function nomPeriode(objectif, bornes) {
  switch (objectif.periode) {
    case 'jour': return dateCourte(bornes.debut);
    case 'semaine': return `Semaine du ${dateCourte(bornes.debut)}`;
    case 'mois': return majuscule(moisAnnee(bornes.debut));
    default: return `Du ${jourMois(bornes.debut)} au ${dateCourte(ajouterJours(bornes.fin, -1))}`;
  }
}

/** Étiquette courte sous une barre du graphique. */
function etiquettePeriode(objectif, bornes) {
  return objectif.periode === 'mois' ? moisCourt(bornes.debut) : jourMois(bornes.debut);
}

export default function DetailObjectif() {
  const d = useDonnees();
  const { id } = useParams();
  const naviguer = useNavigate();
  const maintenant = useMaintenant();
  const [modification, setModification] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [tableau, setTableau] = useState(true);

  const objectif = d.objectifs.find((o) => o.id === Number(id));
  if (!objectif) {
    return (
      <>
        <Entete titre="Objectif introuvable" retour="/objectifs" />
        <p className="discret">Cet objectif a été supprimé.</p>
      </>
    );
  }

  const gParVerre = d.parametres.gParVerre;
  const p = progression(objectif, d.consommations, maintenant, gParVerre);
  const categorie = objectif.filtreCategorie !== null ? d.categoriesParId.get(objectif.filtreCategorie) : null;

  // Historique : on ne remonte pas avant la toute première consommation saisie
  // (avant, l'objectif serait « respecté » sans que cela veuille rien dire).
  const premiere = d.consommations.length > 0 ? d.consommations[d.consommations.length - 1].horodatage : null;
  const historique = premiere === null ? [] : historiqueObjectif(
    objectif, d.consommations, maintenant, gParVerre,
    { depuis: premiere, nbMax: objectif.periode === 'jour' ? 14 : 12 },
  );
  const nbRespectees = historique.filter((h) => h.respecte).length;

  // Graphique : périodes passées de la plus ancienne à la plus récente, puis la période en cours.
  const chronologie = [...historique].reverse();
  const barres = [...chronologie, p];

  return (
    <>
      <Entete
        titre={objectif.nom}
        surTitre={objectif.actif ? 'Objectif' : 'Objectif en pause'}
        retour="/objectifs"
        action={(
          <button className="bouton-icone bouton-icone--fond" aria-label="Modifier l'objectif" onClick={() => setModification(true)}>
            <Icone nom="crayon" taille={20} />
          </button>
        )}
      />

      <BlocObjectif objectif={objectif} p={p} />
      <p className="petit discret" style={{ marginTop: 4 }}>
        Limite de {valeurAvecUnite(objectif.limite, objectif.unite)} {libelleRythme(objectif)}
        {categorie ? `, catégorie ${categorie.nom} seulement` : ''}. Alerte à {nombre((objectif.seuilAlerte ?? 0.8) * 100, 0)} %.
        {objectif.periode !== 'jour' && ` Période en cours : du ${dateCourte(p.debut)} au ${dateCourte(ajouterJours(p.fin, -1))}.`}
      </p>

      <Section
        titre="Périodes passées"
        lien={historique.length > 0 && (
          <button className="section__lien" onClick={() => setTableau(!tableau)} aria-expanded={tableau}>
            {tableau ? 'Masquer le détail' : 'Voir le détail'}
          </button>
        )}
      >
        {historique.length === 0 ? (
          <p className="discret">
            Pas encore de période terminée depuis ta première saisie. L'historique se remplira à la fin de la période en cours.
          </p>
        ) : (
          <>
            <p style={{ marginBottom: 10 }}>
              Respecté {nbRespectees} fois sur {historique.length}.
            </p>
            <GraphiqueBarres
              etiquettes={barres.map((b) => etiquettePeriode(objectif, b))}
              titres={barres.map((b) => nomPeriode(objectif, b))}
              valeurs={barres.map((b) => b.valeur)}
              formater={(v) => valeurAvecUnite(v, objectif.unite)}
              limite={{ valeur: objectif.limite, texte: `Limite : ${valeurAvecUnite(objectif.limite, objectif.unite)}` }}
              description={`${UNITES[objectif.unite].libelle} par période, comparés à la limite de ${valeurAvecUnite(objectif.limite, objectif.unite)}.`}
            />
            <p className="mini tres-discret" style={{ marginTop: 6 }}>Barre pâle : période en cours.</p>

            {tableau && (
              <ul className="liste" style={{ marginTop: 12 }}>
                {historique.map((h) => (
                  <li key={h.debut} className="ligne" style={{ minHeight: 0 }}>
                    <span className="ligne__corps">
                      <span className="ligne__titre" style={{ display: 'block' }}>{nomPeriode(objectif, h)}</span>
                      <span className="ligne__detail rangee" style={{ gap: 7 }}>
                        <span className="etat-point" data-etat={h.respecte ? 'ok' : 'depasse'} aria-hidden="true" />
                        {h.respecte
                          ? `Respecté, marge de ${valeurAvecUnite(-h.ecart, objectif.unite)}`
                          : `Dépassé de ${valeurAvecUnite(h.ecart, objectif.unite)}`}
                      </span>
                    </span>
                    <span className="ligne__valeur">{valeurAvecUnite(h.valeur, objectif.unite)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mini tres-discret" style={{ marginTop: 10 }}>
              L'historique est recalculé à partir de tes consommations : il couvre aussi les périodes d'avant la création
              de l'objectif.
            </p>
          </>
        )}
      </Section>

      <Section>
        <div className="pile">
          <button className="bouton bouton--large" onClick={() => enregistrerObjectif({ ...objectif, actif: !objectif.actif })}>
            {objectif.actif ? 'Mettre en pause' : 'Réactiver'}
          </button>
          <button className="bouton bouton--large bouton--danger" onClick={() => setConfirmation(true)}>Supprimer l'objectif</button>
        </div>
      </Section>

      {modification && <FeuilleObjectif objectif={objectif} onFermer={() => setModification(false)} />}

      {confirmation && (
        <FeuilleConfirmation
          titre="Supprimer cet objectif ?"
          onFermer={() => setConfirmation(false)}
          onConfirmer={async () => {
            await supprimerObjectif(objectif.id);
            naviguer('/objectifs', { replace: true });
          }}
        >
          <p>« {objectif.nom} » sera effacé. Tes consommations ne sont pas touchées.</p>
        </FeuilleConfirmation>
      )}
    </>
  );
}
