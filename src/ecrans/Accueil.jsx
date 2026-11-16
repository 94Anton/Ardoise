// Écran d'accueil : la soirée en cours (ou la journée), les objectifs, les
// totaux du jour et de la semaine, et les rappels (installation, gueule de
// bois du lendemain, sauvegarde).

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Batons, Champ, Curseur, Entete, Feuille, Section, Vide } from '../composants/base.jsx';
import { BlocObjectif } from '../composants/Objectif.jsx';
import { Icone } from '../composants/Icone.jsx';
import { useDonnees } from '../contexte/Donnees.jsx';
import { useNotifications } from '../contexte/Notifications.jsx';
import { libelleConsommation, useAjout, useMaintenant } from '../utilitaires/crochets.js';
import { estIOS, estInstallee } from '../utilitaires/plateforme.js';
import { totaux } from '../calculs/agregats.js';
import { progression } from '../calculs/objectifs.js';
import { bornesPeriode, dansPeriode } from '../calculs/periodes.js';
import { dateCourte, dateLongue, duree, euros, heure, majuscule, nombre } from '../calculs/format.js';
import { nomContenant } from '../donnees/selecteurs.js';
import { demarrerSoiree, ecrireParametres, enregistrerSoiree, terminerSoiree } from '../donnees/actions.js';

const HEURE_MS = 3600 * 1000;
const JOUR_MS = 24 * HEURE_MS;

export default function Accueil() {
  const d = useDonnees();
  const maintenant = useMaintenant();
  const naviguer = useNavigate();
  const { reprendre } = useAjout();
  const { afficherToast } = useNotifications();
  const [feuilleSoiree, setFeuilleSoiree] = useState(false);
  const gParVerre = d.parametres.gParVerre;

  // --- Soirée en cours, journée, semaine ---------------------------------
  const enCours = d.soireeEnCours;
  const consosSoiree = enCours ? d.consommations.filter((c) => c.soireeId === enCours.id) : [];
  const consosJour = d.consommations.filter((c) => dansPeriode(c.horodatage, bornesPeriode('jour', maintenant)));
  const consosSemaine = d.consommations.filter((c) => dansPeriode(c.horodatage, bornesPeriode('semaine', maintenant)));
  const tSoiree = totaux(consosSoiree, gParVerre);
  const tJour = totaux(consosJour, gParVerre);
  const tSemaine = totaux(consosSemaine, gParVerre);
  const verresAffiches = enCours ? tSoiree.verres : tJour.verres;

  // --- « Reprendre le même » ---------------------------------------------
  const derniere = d.consommations[0] ?? null;
  const libelleDerniere = derniere
    ? libelleConsommation(derniere.snapshot.nom, nomContenant(derniere, d.contenantsParId), derniere.volumeML, derniere.quantite)
    : null;

  // --- Objectifs actifs ---------------------------------------------------
  const objectifs = d.objectifs.filter((o) => o.actif);

  async function terminer() {
    // Si le dernier verre date de plus de 3 h, la soirée s'est sans doute
    // arrêtée à ce moment-là : on propose cette heure (modifiable dans le bilan).
    const dernierVerre = consosSoiree.length > 0 ? Math.max(...consosSoiree.map((c) => c.horodatage)) : null;
    const fin = dernierVerre !== null && maintenant - dernierVerre > 3 * HEURE_MS ? dernierVerre : maintenant;
    await terminerSoiree(enCours.id, fin);
    naviguer(`/soiree/${enCours.id}/bilan`);
  }

  return (
    <>
      <Entete titre={majuscule(dateLongue(maintenant))} />

      <Rappels d={d} maintenant={maintenant} />

      {/* ----- La soirée en cours, ou la journée ----- */}
      <Section>
        {enCours ? (
          <>
            <p className="entete__sur-titre">Soirée en cours, commencée à {heure(enCours.debut)}</p>
            <h2>{enCours.titre}</h2>
          </>
        ) : (
          <h2>Aujourd'hui</h2>
        )}

        <div style={{ marginTop: 14 }}>
          <Batons valeur={verresAffiches} />
          {verresAffiches < 0.1 && <p className="discret">Rien sur l'ardoise pour l'instant.</p>}
          <div className="compte">
            <span className="compte__nombre">{nombre(verresAffiches, 1)}</span>
            <span className="compte__unite">
              verre{verresAffiches >= 2 ? 's' : ''} standard
              {enCours && `, depuis ${duree(maintenant - enCours.debut)}`}
            </span>
          </div>
        </div>

        <div className="pile" style={{ marginTop: 18 }}>
          {derniere && (
            <button className="bouton bouton--large bouton--gauche" onClick={() => reprendre(libelleDerniere)}>
              <Icone nom="reprise" style={{ flex: 'none' }} />
              <span>
                Reprendre le même
                <span className="ligne__detail" style={{ display: 'block', fontWeight: 400 }}>{libelleDerniere}</span>
              </span>
            </button>
          )}
          {enCours ? (
            <div className="rangee">
              <button className="bouton bouton--plein grandit" onClick={terminer}>Terminer la soirée</button>
              <Link className="bouton" to={`/soiree/${enCours.id}`}>Détail</Link>
            </div>
          ) : (
            <button className="bouton bouton--large" onClick={() => setFeuilleSoiree(true)}>Démarrer une soirée</button>
          )}
        </div>
      </Section>

      {/* ----- Objectifs ----- */}
      <Section titre="Objectifs" lien={<Link className="section__lien" to="/objectifs">Gérer</Link>}>
        {objectifs.length === 0 ? (
          <Vide>
            <p>Aucun objectif pour l'instant. Fixe une limite par semaine ou par mois pour voir où tu en es.</p>
            <Link className="bouton" to="/objectifs?nouveau=1">Fixer un objectif</Link>
          </Vide>
        ) : (
          <ul className="liste">
            {objectifs.map((o) => (
              <li key={o.id}>
                <BlocObjectif objectif={o} p={progression(o, d.consommations, maintenant, gParVerre)} vers={`/objectifs/${o.id}`} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ----- Totaux du jour et de la semaine ----- */}
      <Section titre="Totaux">
        <table className="table-valeurs">
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">Grandeur</span></th>
              <th scope="col" style={{ textAlign: 'right' }}>Aujourd'hui</th>
              <th scope="col">Cette semaine</th>
            </tr>
          </thead>
          <tbody>
            <LigneTotal libelle="Verres standard" a={nombre(tJour.verres, 1)} b={nombre(tSemaine.verres, 1)} />
            <LigneTotal libelle="Alcool pur" a={`${nombre(tJour.gAlcool, 0)} g`} b={`${nombre(tSemaine.gAlcool, 0)} g`} />
            <LigneTotal libelle="Calories" a={`${nombre(tJour.kcal, 0)} kcal`} b={`${nombre(tSemaine.kcal, 0)} kcal`} />
            <LigneTotal libelle="Sucre" a={`${nombre(tJour.sucreG, 0)} g`} b={`${nombre(tSemaine.sucreG, 0)} g`} />
            <LigneTotal libelle="Dépense" a={euros(tJour.euros)} b={euros(tSemaine.euros)} />
          </tbody>
        </table>
        <NoteIncomplet t={tSemaine} />
      </Section>

      {feuilleSoiree && (
        <FeuilleDemarrer
          maintenant={maintenant}
          onFermer={() => setFeuilleSoiree(false)}
          onDemarre={(titre) => afficherToast({ message: `Soirée « ${titre} » démarrée. Tes prochaines saisies y seront rattachées.` })}
        />
      )}
    </>
  );
}

/** Précise ce qui manque dans les totaux de la semaine (calories estimées, sucre ou prix absents). */
function NoteIncomplet({ t }) {
  const manques = [];
  if (t.kcalEstimee) manques.push('calories comptées pour l\'alcool seul quand elles ne sont pas renseignées');
  if (t.sucreIncomplet) manques.push('boissons sans sucre renseigné exclues du total');
  if (t.nbSansPrix > 0) manques.push(`${t.nbSansPrix} consommation${t.nbSansPrix > 1 ? 's' : ''} sans prix`);
  if (manques.length === 0) return null;
  return (
    <p className="mini tres-discret" style={{ marginTop: 8 }}>
      Données incomplètes cette semaine : {manques.join(' ; ')}.
    </p>
  );
}

function LigneTotal({ libelle, a, b }) {
  return (
    <tr>
      <th scope="row" style={{ color: 'inherit', fontSize: 'inherit' }}>{libelle}</th>
      <td style={{ textAlign: 'right' }} className="chiffres">{a}</td>
      <td className="chiffres">{b}</td>
    </tr>
  );
}

/** Feuille « Démarrer une soirée » : juste un titre, facultatif. */
function FeuilleDemarrer({ maintenant, onFermer, onDemarre }) {
  const [titre, setTitre] = useState('');
  const [erreur, setErreur] = useState('');
  const parDefaut = `Soirée du ${dateCourte(maintenant)}`;

  async function demarrer() {
    try {
      const titreFinal = titre.trim() || parDefaut;
      await demarrerSoiree(titreFinal);
      onDemarre(titreFinal);
      onFermer();
    } catch (e) {
      setErreur(e.message);
    }
  }

  return (
    <Feuille titre="Démarrer une soirée" onFermer={onFermer}>
      <div className="pile">
        <Champ label="Titre" aide="Sert à retrouver la soirée dans l'historique.">
          <input className="saisie" type="text" value={titre} placeholder={parDefaut} autoFocus onChange={(e) => setTitre(e.target.value)} />
        </Champ>
        {erreur && <p className="champ__erreur" role="alert">{erreur}</p>}
      </div>
      <div className="feuille__pied">
        <button className="bouton bouton--plein bouton--grand" onClick={demarrer}>Démarrer</button>
      </div>
    </Feuille>
  );
}

/** Encarts de rappel en haut de l'accueil. Chacun n'apparaît que s'il est utile. */
function Rappels({ d, maintenant }) {
  // 1. Gueule de bois : première ouverture au moins 6 h après la fin d'une soirée.
  const aNoter = d.soirees.find(
    (s) => s.fin !== null && s.gueuleDeBois === null && !s.gueuleDeBoisIgnoree
      && maintenant - s.fin >= 6 * HEURE_MS && maintenant - s.fin <= 4 * JOUR_MS,
  );

  // 2. Sauvegarde : rien d'exporté depuis 30 jours (ou depuis le premier lancement).
  const reference = d.parametres.dernierExport ?? d.parametres.premierLancement;
  const joursSansSauvegarde = reference ? Math.floor((maintenant - reference) / JOUR_MS) : 0;
  const rappelSauvegarde = d.consommations.length > 0 && joursSansSauvegarde >= 30;

  // 3. Installation : sur iPhone, tant que l'appli tourne dans Safari.
  const aideInstallation = estIOS() && !estInstallee() && !d.parametres.aideInstallationMasquee;

  if (!aNoter && !rappelSauvegarde && !aideInstallation) return null;

  return (
    <div style={{ marginBottom: 26 }}>
      {aNoter && <RappelGueuleDeBois key={aNoter.id} soiree={aNoter} />}

      {aideInstallation && (
        <div className="encart">
          <h3>Installe Ardoise sur l'écran d'accueil</h3>
          <p className="petit discret" style={{ marginTop: 6 }}>
            Dans Safari : bouton Partager, puis « Sur l'écran d'accueil ». Ouvre ensuite toujours l'appli depuis
            son icône : installée, elle a son propre stockage, séparé de Safari, et iOS ne l'efface pas. Dans
            Safari seul, les données peuvent disparaître après quelques semaines sans visite.
          </p>
          <div className="encart__actions">
            <button className="bouton bouton--petit" onClick={() => ecrireParametres({ aideInstallationMasquee: true })}>Compris</button>
          </div>
        </div>
      )}

      {rappelSauvegarde && (
        <div className="encart">
          <h3>Pense à sauvegarder</h3>
          <p className="petit discret" style={{ marginTop: 6 }}>
            {d.parametres.dernierExport
              ? `Dernière sauvegarde il y a ${joursSansSauvegarde} jours.`
              : `Aucune sauvegarde depuis ${joursSansSauvegarde} jours.`}
            {' '}Tes données n'existent que sur ce téléphone.
          </p>
          <div className="encart__actions">
            <Link className="bouton bouton--petit bouton--plein" to="/parametres">Sauvegarder</Link>
          </div>
        </div>
      )}
    </div>
  );
}

function RappelGueuleDeBois({ soiree }) {
  const [note, setNote] = useState(null);
  return (
    <div className="encart">
      <h3>Gueule de bois après « {soiree.titre} » ?</h3>
      <div style={{ marginTop: 12 }}>
        <Curseur label="Ce matin" valeur={note} onChange={setNote} min="aucune" max="très forte" />
      </div>
      <div className="encart__actions">
        <button className="bouton bouton--petit bouton--plein" disabled={note === null} onClick={() => enregistrerSoiree(soiree.id, { gueuleDeBois: note })}>
          Enregistrer
        </button>
        <button className="bouton bouton--petit" onClick={() => enregistrerSoiree(soiree.id, { gueuleDeBoisIgnoree: true })}>
          Ne pas noter
        </button>
        <Link className="bouton bouton--petit bouton--nu" to={`/soiree/${soiree.id}/bilan`}>Ouvrir le bilan</Link>
      </div>
    </div>
  );
}
