// Page d'une soirée : totaux, courbe d'alcoolémie estimée, consommations, bilan.

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Entete, FeuilleConfirmation, Section, Vide } from '../composants/base.jsx';
import { FeuilleConsommation } from '../composants/FeuillesConsommation.jsx';
import { CourbeAlcoolemie } from '../composants/graphiques.jsx';
import { LigneConsommation } from './Historique.jsx';
import { useDonnees } from '../contexte/Donnees.jsx';
import { useMaintenant } from '../utilitaires/crochets.js';
import { totaux } from '../calculs/agregats.js';
import { valeurConsommation } from '../calculs/objectifs.js';
import { alcoolemieA, parametresPourSoiree, simulerAlcoolemie } from '../calculs/widmark.js';
import { dateCourte, duree, euros, heure, nombre } from '../calculs/format.js';
import { supprimerSoiree, terminerSoiree } from '../donnees/actions.js';

const HEURE_MS = 3600 * 1000;

/** Les cinq notes du bilan, avec leur libellé. */
export const NOTES_BILAN = [
  { cle: 'ressenti', libelle: 'Ressenti alcoolisé' },
  { cle: 'repas', libelle: 'Repas avant' },
  { cle: 'hydratation', libelle: 'Eau bue' },
  { cle: 'fatigue', libelle: 'Fatigue' },
  { cle: 'gueuleDeBois', libelle: 'Gueule de bois le lendemain' },
];

export default function Soiree() {
  const d = useDonnees();
  const { id } = useParams();
  const naviguer = useNavigate();
  const maintenant = useMaintenant();
  const [ouverte, setOuverte] = useState(null);
  const [confirmation, setConfirmation] = useState(false);

  const soiree = d.soireesParId.get(Number(id));
  if (!soiree) {
    return (
      <>
        <Entete titre="Soirée introuvable" retour="/historique" />
        <p className="discret">Cette soirée a été supprimée.</p>
      </>
    );
  }

  const enCours = soiree.fin === null;
  // Consommations de la soirée, dans l'ordre chronologique.
  const consos = d.consommations.filter((c) => c.soireeId === soiree.id).reverse();
  const t = totaux(consos, d.parametres.gParVerre);
  // Poids noté au début de la soirée ; r et β viennent des paramètres actuels.
  const widmark = parametresPourSoiree(soiree, d.widmark);
  const simulation = simulerAlcoolemie(
    consos.map((c) => ({ t: c.horodatage, gAlcool: valeurConsommation(c, 'g') })),
    widmark,
  );
  const consommationOuverte = ouverte === null ? null : consos.find((c) => c.id === ouverte) ?? null;
  const notesRemplies = NOTES_BILAN.filter((n) => soiree[n.cle] !== null && soiree[n.cle] !== undefined);

  async function terminer() {
    const dernierVerre = consos.length > 0 ? consos[consos.length - 1].horodatage : null;
    const fin = dernierVerre !== null && maintenant - dernierVerre > 3 * HEURE_MS ? dernierVerre : maintenant;
    await terminerSoiree(soiree.id, fin);
    naviguer(`/soiree/${soiree.id}/bilan`);
  }

  return (
    <>
      <Entete
        titre={soiree.titre}
        surTitre={enCours
          ? `Soirée en cours, commencée à ${heure(soiree.debut)}`
          : `${dateCourte(soiree.debut)}, de ${heure(soiree.debut)} à ${heure(soiree.fin)}`}
        retour
      />

      {/* ----- Totaux ----- */}
      <div className="chiffres-cles">
        <Chiffre valeur={nombre(t.verres, 1)} libelle={`verre${t.verres >= 2 ? 's' : ''} standard`} />
        <Chiffre valeur={`${nombre(t.gAlcool, 0)} g`} libelle="d'alcool pur" />
        <Chiffre valeur={`${nombre(t.kcal, 0)} kcal`} libelle={t.kcalEstimee ? 'au moins (alcool seul pour certaines boissons)' : 'calories'} />
        <Chiffre valeur={`${nombre(t.sucreG, 0)} g`} libelle={t.sucreIncomplet ? 'de sucre, données incomplètes' : 'de sucre'} />
        <Chiffre valeur={euros(t.euros)} libelle={t.nbSansPrix > 0 ? `dépensés (${t.nbSansPrix} sans prix)` : 'dépensés'} />
        <Chiffre valeur={duree((enCours ? maintenant : soiree.fin) - soiree.debut)} libelle={enCours ? 'depuis le début' : 'de soirée'} />
      </div>

      {enCours && (
        <div className="pile" style={{ marginTop: 22 }}>
          <Link className="bouton bouton--plein bouton--large" to={`/saisie?soiree=${soiree.id}`}>Ajouter une consommation</Link>
          <button className="bouton bouton--large" onClick={terminer}>Terminer la soirée</button>
        </div>
      )}

      {/* ----- Alcoolémie estimée ----- */}
      <Section titre="Alcoolémie estimée">
        {simulation.points.length === 0 ? (
          <p className="discret">Pas d'alcool noté pour cette soirée : rien à estimer.</p>
        ) : (
          <>
            <p className="petit discret" style={{ marginBottom: 10 }}>
              Pic estimé : <strong className="gras" style={{ color: 'var(--encre)' }}>≈ {nombre(simulation.pic, 2)} g/L</strong> vers {heure(simulation.tPic)}.
              {simulation.tRetourZero !== null && ` Retour à 0 vers ${heure(simulation.tRetourZero)}.`}
              {enCours && ` À l'instant : ≈ ${nombre(alcoolemieA(simulation.points, maintenant), 2)} g/L.`}
            </p>
            <CourbeAlcoolemie
              points={simulation.points}
              description={`Courbe d'alcoolémie estimée. Pic d'environ ${nombre(simulation.pic, 2)} g/L vers ${heure(simulation.tPic)}.`}
            />
          </>
        )}
        <p className="mention">
          <strong>Estimation indicative, pas une mesure. Elle ne permet pas de savoir si tu peux conduire.</strong>{' '}
          Le calcul (formule de Widmark, {nombre(widmark.poidsKg, 1)} kg, r = {nombre(widmark.r, 2)}) suppose que l'alcool
          passe dans le sang instantanément ; en réalité le pic arrive 30 à 90 min après le verre, plus tard et plus bas
          si tu as mangé. La vitesse d'élimination retenue ({nombre(widmark.beta, 2)} g/L par heure) varie d'une personne
          à l'autre, d'environ 0,10 à 0,20 : l'écart avec la réalité peut être important.
        </p>
      </Section>

      {/* ----- Consommations ----- */}
      <Section
        titre="Consommations"
        lien={!enCours && <Link className="section__lien" to={`/saisie?soiree=${soiree.id}`}>Ajouter</Link>}
      >
        {consos.length === 0 ? (
          <Vide><p>Aucune consommation rattachée à cette soirée.</p></Vide>
        ) : (
          <ul className="liste">
            {consos.map((c) => (
              <li key={c.id}>
                <LigneConsommation consommation={c} d={d} montrerSoiree={false} onClick={() => setOuverte(c.id)} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ----- Bilan ----- */}
      <Section titre="Bilan" lien={<Link className="section__lien" to={`/soiree/${soiree.id}/bilan`}>{notesRemplies.length > 0 ? 'Modifier' : 'Remplir'}</Link>}>
        {notesRemplies.length === 0 && !soiree.notes ? (
          <p className="discret">
            {enCours ? 'Le bilan se remplit en fin de soirée.' : 'Pas encore de bilan pour cette soirée.'}
          </p>
        ) : (
          <>
            <div>
              {notesRemplies.map((n) => (
                <div key={n.cle} className="note-ligne">
                  <span>{n.libelle}</span>
                  <span className="gras chiffres">{soiree[n.cle]} / 10</span>
                </div>
              ))}
            </div>
            {soiree.notes && <p style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{soiree.notes}</p>}
          </>
        )}
      </Section>

      <Section>
        <button className="bouton bouton--large bouton--danger" onClick={() => setConfirmation(true)}>Supprimer la soirée</button>
      </Section>

      {consommationOuverte && <FeuilleConsommation consommation={consommationOuverte} onFermer={() => setOuverte(null)} />}

      {confirmation && (
        <FeuilleConfirmation
          titre="Supprimer cette soirée ?"
          onFermer={() => setConfirmation(false)}
          onConfirmer={async () => {
            await supprimerSoiree(soiree.id);
            naviguer('/historique', { replace: true });
          }}
        >
          <p>
            Le titre et le bilan de « {soiree.titre} » seront effacés. Ses {consos.length} consommation{consos.length > 1 ? 's' : ''} restent
            dans l'historique, sans soirée.
          </p>
        </FeuilleConfirmation>
      )}
    </>
  );
}

function Chiffre({ valeur, libelle }) {
  return (
    <div>
      <div className="chiffre__valeur">{valeur}</div>
      <div className="chiffre__libelle">{libelle}</div>
    </div>
  );
}
