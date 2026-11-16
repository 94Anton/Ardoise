// Bilan d'une soirée : quatre curseurs de 1 à 10 (ressenti, repas, eau,
// fatigue), la gueule de bois du lendemain, des notes. Tout est facultatif
// et modifiable plus tard.

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Champ, Curseur, Entete } from '../composants/base.jsx';
import { useDonnees } from '../contexte/Donnees.jsx';
import { depuisChampDateHeure, versChampDateHeure } from '../calculs/format.js';
import { enregistrerSoiree } from '../donnees/actions.js';

export default function Bilan() {
  const d = useDonnees();
  const { id } = useParams();
  const soiree = d.soireesParId.get(Number(id));
  if (!soiree) {
    return (
      <>
        <Entete titre="Soirée introuvable" retour="/historique" />
        <p className="discret">Cette soirée a été supprimée.</p>
      </>
    );
  }
  // Le formulaire est un composant à part : son état de départ vient de la soirée.
  return <FormulaireBilan soiree={soiree} />;
}

function FormulaireBilan({ soiree }) {
  const naviguer = useNavigate();
  const terminee = soiree.fin !== null;
  const [titre, setTitre] = useState(soiree.titre);
  const [debut, setDebut] = useState(versChampDateHeure(soiree.debut));
  const [fin, setFin] = useState(terminee ? versChampDateHeure(soiree.fin) : '');
  const [ressenti, setRessenti] = useState(soiree.ressenti);
  const [repas, setRepas] = useState(soiree.repas);
  const [hydratation, setHydratation] = useState(soiree.hydratation);
  const [fatigue, setFatigue] = useState(soiree.fatigue);
  const [gueuleDeBois, setGueuleDeBois] = useState(soiree.gueuleDeBois);
  const [notes, setNotes] = useState(soiree.notes ?? '');
  const [erreur, setErreur] = useState('');

  async function enregistrer() {
    const tDebut = depuisChampDateHeure(debut);
    const tFin = terminee ? depuisChampDateHeure(fin) : null;
    if (tDebut === null || (terminee && tFin === null)) return setErreur('Indique le début et la fin de la soirée.');
    if (terminee && tFin < tDebut) return setErreur('La fin ne peut pas précéder le début.');
    await enregistrerSoiree(soiree.id, {
      titre: titre.trim() || soiree.titre,
      debut: tDebut,
      fin: tFin,
      ressenti, repas, hydratation, fatigue, gueuleDeBois,
      notes,
    });
    naviguer(`/soiree/${soiree.id}`, { replace: true });
    return undefined;
  }

  return (
    <>
      <Entete titre="Bilan de la soirée" surTitre={soiree.titre} retour={`/soiree/${soiree.id}`} />

      <div className="pile" style={{ gap: 26 }}>
        <Curseur label="À quel point te sentais-tu alcoolisé ?" valeur={ressenti} onChange={setRessenti} min="pas du tout" max="très" />
        <Curseur label="Avais-tu bien mangé avant ?" valeur={repas} onChange={setRepas} min="rien mangé" max="très bien" />
        <Curseur label="Avais-tu bu assez d'eau ?" valeur={hydratation} onChange={setHydratation} min="pas d'eau" max="beaucoup" />
        <Curseur label="Étais-tu fatigué ?" valeur={fatigue} onChange={setFatigue} min="en forme" max="très fatigué" />
        {terminee && (
          <div>
            <Curseur label="Gueule de bois le lendemain" valeur={gueuleDeBois} onChange={setGueuleDeBois} min="aucune" max="très forte" />
            <p className="champ__aide" style={{ marginTop: 6 }}>À noter le lendemain : l'appli te le rappellera à la première ouverture.</p>
          </div>
        )}

        <Champ label="Notes">
          <textarea className="saisie" value={notes} placeholder="Contexte, ce qui a compté…" onChange={(e) => setNotes(e.target.value)} />
        </Champ>

        <Champ label="Titre">
          <input className="saisie" type="text" value={titre} onChange={(e) => setTitre(e.target.value)} />
        </Champ>
        <div className="pile">
          <Champ label="Début">
            <input className="saisie" type="datetime-local" value={debut} onChange={(e) => setDebut(e.target.value)} />
          </Champ>
          {terminee && (
            <Champ label="Fin">
              <input className="saisie" type="datetime-local" value={fin} onChange={(e) => setFin(e.target.value)} />
            </Champ>
          )}
        </div>

        {erreur && <p className="champ__erreur" role="alert">{erreur}</p>}
        <button className="bouton bouton--plein bouton--grand bouton--large" onClick={enregistrer}>Enregistrer le bilan</button>
        <p className="champ__aide centre">Rien n'est obligatoire : un curseur non touché reste « non renseigné ».</p>
      </div>
    </>
  );
}
