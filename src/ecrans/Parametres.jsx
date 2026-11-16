// Paramètres : profil (pour l'estimation d'alcoolémie), constantes de calcul,
// sauvegarde et restauration, installation sur iPhone, réinitialisation.

import { useEffect, useRef, useState } from 'react';
import { ChampNombre, Entete, Feuille, Section, Segments } from '../composants/base.jsx';
import { useDonnees } from '../contexte/Donnees.jsx';
import { useNotifications } from '../contexte/Notifications.jsx';
import { BETA_DEFAUT, R_PAR_SEXE } from '../calculs/widmark.js';
import { dateHeure, lireNombre } from '../calculs/format.js';
import { ecrireParametres } from '../donnees/actions.js';
import { reinitialiserBase } from '../donnees/db.js';
import {
  csvConsommations, csvSoirees, exporterDonnees, importerDonnees, verifierSauvegarde,
} from '../donnees/sauvegarde.js';
import {
  demanderPersistance, estIOS, estInstallee, horodaterNom, lireFichierTexte, remettreFichiers,
} from '../utilitaires/plateforme.js';

const enTexte = (x) => (x === null || x === undefined ? '' : String(x).replace('.', ','));
const compter = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

export default function Parametres() {
  const d = useDonnees();
  return (
    <>
      <Entete titre="Paramètres" retour="/plus" />
      {/* `key` : si les réglages changent ailleurs (restauration d'une sauvegarde), le formulaire repart des nouvelles valeurs. */}
      <Profil
        key={[d.parametres.poidsKg, d.parametres.sexe, d.parametres.gParVerre, d.parametres.r, d.parametres.beta].join('|')}
        parametres={d.parametres}
      />
      <Sauvegarde d={d} />
      <Installation />
      <Reinitialisation d={d} />
    </>
  );
}

// ===================== Profil et constantes de calcul ======================

function Profil({ parametres }) {
  const { afficherToast } = useNotifications();
  const [poids, setPoids] = useState(enTexte(parametres.poidsKg));
  const [sexe, setSexe] = useState(parametres.sexe);
  const [gParVerre, setGParVerre] = useState(enTexte(parametres.gParVerre));
  const [r, setR] = useState(enTexte(parametres.r));
  const [beta, setBeta] = useState(enTexte(parametres.beta));
  const [erreurs, setErreurs] = useState({});

  /** Changer de sexe remet le coefficient r sur sa valeur habituelle. */
  function changerSexe(valeur) {
    setSexe(valeur);
    setR(enTexte(R_PAR_SEXE[valeur]));
  }

  function valeursParDefaut() {
    setGParVerre('10');
    setR(enTexte(R_PAR_SEXE[sexe]));
    setBeta(enTexte(BETA_DEFAUT));
  }

  async function enregistrer() {
    const valeurs = {
      poidsKg: lireNombre(poids), gParVerre: lireNombre(gParVerre), r: lireNombre(r), beta: lireNombre(beta),
    };
    // Bornes larges : elles servent seulement à attraper les fautes de frappe.
    const bornes = {
      poidsKg: [30, 250, 'Indique un poids entre 30 et 250 kg.'],
      gParVerre: [5, 20, 'Indique une valeur entre 5 et 20 g.'],
      r: [0.4, 0.9, 'Indique une valeur entre 0,4 et 0,9.'],
      beta: [0.05, 0.3, 'Indique une valeur entre 0,05 et 0,30.'],
    };
    const trouvees = {};
    for (const [cle, [min, max, message]] of Object.entries(bornes)) {
      if (valeurs[cle] === null || valeurs[cle] < min || valeurs[cle] > max) trouvees[cle] = message;
    }
    setErreurs(trouvees);
    if (Object.keys(trouvees).length > 0) return;
    await ecrireParametres({ ...valeurs, sexe });
    afficherToast({ message: 'Paramètres enregistrés.' });
  }

  return (
    <>
      <Section titre="Profil">
        <div className="pile">
          <ChampNombre
            label="Poids" unite="kg" valeur={poids} onChange={setPoids} erreur={erreurs.poidsKg}
            aide="Sert uniquement à l'estimation d'alcoolémie. Le poids est noté au début de chaque soirée : le modifier ici ne change que les estimations des prochaines soirées."
          />
          <div className="champ">
            <span className="champ__label">Sexe</span>
            <Segments
              label="Sexe" valeur={sexe} onChange={changerSexe}
              options={[{ valeur: 'homme', libelle: 'Homme' }, { valeur: 'femme', libelle: 'Femme' }]}
            />
            <span className="champ__aide">Fixe le coefficient r ci-dessous : 0,7 pour un homme, 0,6 pour une femme.</span>
          </div>
        </div>
      </Section>

      <Section
        titre="Calculs"
        lien={<button className="section__lien" onClick={valeursParDefaut}>Valeurs par défaut</button>}
      >
        <div className="pile">
          <ChampNombre
            label="Alcool pur dans un verre standard" unite="g" valeur={gParVerre} onChange={setGParVerre} erreur={erreurs.gParVerre}
            aide="10 g en France. Cette valeur change l'affichage en verres standard de tout l'historique."
          />
          <ChampNombre
            label="Coefficient de Widmark r" valeur={r} onChange={setR} erreur={erreurs.r}
            aide="Part du corps dans laquelle l'alcool se répartit. Plus r est petit, plus l'alcoolémie estimée est haute."
          />
          <ChampNombre
            label="Vitesse d'élimination β" unite="g/L/h" valeur={beta} onChange={setBeta} erreur={erreurs.beta}
            aide="0,15 par défaut. Elle varie d'environ 0,10 à 0,20 selon les personnes."
          />
          <button className="bouton bouton--plein bouton--large" onClick={enregistrer}>Enregistrer les paramètres</button>
        </div>
      </Section>
    </>
  );
}

// ======================= Sauvegarde et restauration ========================

function Sauvegarde({ d }) {
  const { afficherToast } = useNotifications();
  const champFichier = useRef(null);
  const [pret, setPret] = useState(null); // texte JSON de la sauvegarde, préparé à l'avance
  const [aRestaurer, setARestaurer] = useState(null); // sauvegarde lue, en attente de confirmation
  const [erreur, setErreur] = useState('');

  // Le fichier est préparé dès l'affichage de l'écran (et à chaque changement
  // des données) : au moment du toucher, la feuille de partage de l'iPhone
  // peut ainsi s'ouvrir tout de suite, ce que Safari exige.
  useEffect(() => {
    let abandonne = false;
    exporterDonnees().then((objet) => {
      if (!abandonne) setPret(JSON.stringify(objet));
    });
    return () => {
      abandonne = true;
    };
  }, [d]);

  async function sauvegarder() {
    const contenu = pret ?? JSON.stringify(await exporterDonnees());
    const resultat = await remettreFichiers([
      { nom: horodaterNom('ardoise-sauvegarde', 'json'), contenu, type: 'application/json' },
    ]);
    if (resultat === 'annule') return;
    await ecrireParametres({ dernierExport: Date.now() });
    afficherToast({
      message: resultat === 'partage'
        ? 'Sauvegarde faite. Garde le fichier hors du téléphone si possible (iCloud Drive, ordinateur).'
        : 'Sauvegarde téléchargée.',
    });
  }

  async function exporterCSV() {
    const resultat = await remettreFichiers([
      { nom: horodaterNom('ardoise-consommations', 'csv'), contenu: csvConsommations(d), type: 'text/csv' },
      { nom: horodaterNom('ardoise-soirees', 'csv'), contenu: csvSoirees(d), type: 'text/csv' },
    ]);
    if (resultat === 'telecharge') afficherToast({ message: 'Deux fichiers CSV téléchargés : consommations et soirées.' });
  }

  async function fichierChoisi(evenement) {
    const fichier = evenement.target.files?.[0];
    evenement.target.value = ''; // pour pouvoir rechoisir le même fichier ensuite
    if (!fichier) return;
    try {
      const objet = JSON.parse(await lireFichierTexte(fichier));
      verifierSauvegarde(objet);
      setErreur('');
      setARestaurer(objet);
    } catch (e) {
      setErreur(e instanceof SyntaxError ? "Ce fichier n'est pas une sauvegarde lisible (JSON invalide)." : e.message);
    }
  }

  async function restaurer() {
    try {
      await importerDonnees(aRestaurer);
      setARestaurer(null);
      afficherToast({ message: 'Sauvegarde restaurée : toutes les données ont été remplacées.' });
    } catch (e) {
      setARestaurer(null);
      setErreur(`La restauration a échoué, rien n'a été modifié. ${e.message}`);
    }
  }

  const persistance = d.parametres.persistance;

  return (
    <Section titre="Sauvegarde">
      <p className="petit discret" style={{ marginBottom: 12 }}>
        Tes données n'existent que sur ce téléphone.{' '}
        {d.parametres.dernierExport
          ? `Dernière sauvegarde le ${dateHeure(d.parametres.dernierExport)}.`
          : 'Aucune sauvegarde pour l\'instant.'}
      </p>
      <div className="pile">
        <button className="bouton bouton--plein bouton--large" onClick={sauvegarder}>Sauvegarder (fichier JSON)</button>
        <button className="bouton bouton--large" onClick={() => champFichier.current?.click()}>Restaurer une sauvegarde</button>
        <input
          ref={champFichier} type="file" accept="application/json,.json" hidden
          aria-label="Fichier de sauvegarde à restaurer" onChange={fichierChoisi}
        />
        {erreur && <p className="champ__erreur" role="alert">{erreur}</p>}
        <button className="bouton bouton--large" onClick={exporterCSV}>Exporter en CSV pour l'analyse</button>
        <p className="champ__aide">
          Le JSON contient tout et sert à restaurer l'appli à l'identique. Les deux CSV (consommations et soirées) sont
          faits pour Python ou un tableur : séparateur virgule, point décimal, UTF-8.
        </p>
      </div>

      <p className="mention">
        {persistance === 'accordee' && (
          <><strong>Stockage persistant accordé.</strong> Le navigateur ne supprimera pas les données pour faire de la place.</>
        )}
        {persistance === 'refusee' && (
          <>
            <strong>Stockage persistant non accordé.</strong> Le navigateur pourrait effacer les données s'il manque de
            place. Sur iPhone, installer l'appli sur l'écran d'accueil règle le problème.{' '}
            <button
              className="section__lien" style={{ padding: 0 }}
              onClick={() => demanderPersistance().then((p) => ecrireParametres({ persistance: p }))}
            >
              Redemander
            </button>
          </>
        )}
        {persistance !== 'accordee' && persistance !== 'refusee' && (
          <><strong>Stockage persistant indisponible.</strong> Ce navigateur ne permet pas de le demander : sauvegarde régulièrement.</>
        )}
      </p>

      {aRestaurer && (
        <Feuille titre="Restaurer cette sauvegarde ?" onFermer={() => setARestaurer(null)}>
          <div className="pile discret">
            <p>
              Sauvegarde du {dateHeure(new Date(aRestaurer.exporteLe).getTime())} :{' '}
              {compter(aRestaurer.tables.consommations.length, 'consommation')},{' '}
              {compter(aRestaurer.tables.soirees.length, 'soirée')},{' '}
              {compter(aRestaurer.tables.boissons.length, 'boisson')},{' '}
              {compter(aRestaurer.tables.objectifs.length, 'objectif')}.
            </p>
            <p>
              Elle <strong style={{ color: 'var(--encre)' }}>remplace</strong> tout ce qui se trouve actuellement dans
              l'appli ({compter(d.consommations.length, 'consommation')}, {compter(d.boissons.length, 'boisson')}). Rien
              n'est fusionné.
            </p>
          </div>
          <div className="feuille__pied">
            <button className="bouton" onClick={() => setARestaurer(null)}>Annuler</button>
            <button className="bouton bouton--danger" onClick={restaurer}>Remplacer mes données</button>
          </div>
        </Feuille>
      )}
    </Section>
  );
}

// ============================== Installation ===============================

function Installation() {
  const installee = estInstallee();
  return (
    <Section titre="Installation sur iPhone">
      {installee ? (
        <p className="discret">
          L'appli est installée sur l'écran d'accueil : elle a son propre stockage et fonctionne sans réseau.
        </p>
      ) : (
        <>
          <p className="discret">
            {estIOS()
              ? 'Tu utilises l\'appli dans le navigateur. Pour l\'installer :'
              : 'Sur iPhone, pour installer l\'appli :'}
          </p>
          <ol className="petit discret" style={{ margin: '8px 0 0', paddingLeft: 22, lineHeight: 1.5 }}>
            <li>Ouvre cette page dans Safari.</li>
            <li>Touche le bouton Partager.</li>
            <li>Choisis « Sur l'écran d'accueil », puis « Ajouter ».</li>
          </ol>
          <p className="mention">
            <strong>Installe avant de saisir des données.</strong> L'appli installée a son propre stockage, séparé de
            celui de Safari : ce qui est saisi dans Safari n'apparaît pas dans l'appli installée. Pour transférer,
            sauvegarde ici puis restaure le fichier dans l'appli installée.
          </p>
        </>
      )}
    </Section>
  );
}

// ============================ Réinitialisation =============================

function Reinitialisation({ d }) {
  const [etape, setEtape] = useState(0); // 0 = fermé, 1 = première confirmation, 2 = seconde
  const [enCours, setEnCours] = useState(false);

  async function toutEffacer() {
    setEnCours(true);
    await reinitialiserBase();
    // On recharge l'appli pour repartir d'un état propre, sur l'accueil.
    window.location.hash = '#/';
    window.location.reload();
  }

  return (
    <Section titre="Réinitialisation">
      <button className="bouton bouton--large bouton--danger" onClick={() => setEtape(1)}>Tout effacer</button>

      {etape === 1 && (
        <Feuille titre="Tout effacer ?" onFermer={() => setEtape(0)}>
          <div className="pile discret">
            <p>
              Toutes les données de l'appli seront supprimées de ce téléphone :{' '}
              {compter(d.consommations.length, 'consommation')}, {compter(d.soirees.length, 'soirée')},{' '}
              {compter(d.objectifs.length, 'objectif')}, et ton dataset ({compter(d.boissons.length, 'boisson')},{' '}
              {compter(d.cocktails.length, 'cocktail')}). L'appli repartira comme au premier lancement.
            </p>
            <p>
              {d.parametres.dernierExport
                ? `Ta dernière sauvegarde date du ${dateHeure(d.parametres.dernierExport)}.`
                : 'Tu n\'as fait aucune sauvegarde.'}
            </p>
          </div>
          <div className="feuille__pied">
            <button className="bouton" onClick={() => setEtape(0)}>Annuler</button>
            <button className="bouton bouton--danger" onClick={() => setEtape(2)}>Continuer</button>
          </div>
        </Feuille>
      )}

      {etape === 2 && (
        <Feuille titre="Dernière confirmation" onFermer={() => setEtape(0)}>
          <p className="discret">
            Sans fichier de sauvegarde, rien ne pourra être récupéré. Cette action ne s'annule pas.
          </p>
          <div className="feuille__pied">
            <button className="bouton" onClick={() => setEtape(0)}>Annuler</button>
            <button className="bouton bouton--danger" disabled={enCours} onClick={toutEffacer}>Effacer définitivement</button>
          </div>
        </Feuille>
      )}
    </Section>
  );
}
