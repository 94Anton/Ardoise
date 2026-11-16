// Deux feuilles autour d'une consommation :
//  - FeuilleAjout : choisir contenant, quantité et prix avant d'ajouter ;
//  - FeuilleConsommation : modifier ou supprimer une consommation existante.

import { useState } from 'react';
import { Champ, ChampNombre, Compteur, Feuille } from './base.jsx';
import { ChoixVolume, ResumeApports, choixInitial, volumeDuChoix } from './ChoixVolume.jsx';
import { useDonnees } from '../contexte/Donnees.jsx';
import { useNotifications } from '../contexte/Notifications.jsx';
import { snapshotBoisson, snapshotCocktail, volumeRecette } from '../calculs/alcool.js';
import {
  dateCourte, depuisChampDateHeure, lireNombre, nombre, versChampDateHeure, volume,
} from '../calculs/format.js';
import { dernierPrix, derniereConsommationDe } from '../donnees/selecteurs.js';
import {
  enregistrerContenant, modifierConsommation, recalculerConsommation, restaurerConsommation, supprimerConsommation,
} from '../donnees/actions.js';
import { libelleConsommation } from '../utilitaires/crochets.js';

const enTexte = (x) => (x === null || x === undefined ? '' : String(x).replace('.', ','));

/** Choix de volume proposé par défaut pour une boisson ou un cocktail. */
function choixParDefaut(type, reference, d, recetteML) {
  const derniere = derniereConsommationDe(d.consommations, type, reference.id);
  if (derniere) {
    if (derniere.contenantId !== null && d.contenantsParId.has(derniere.contenantId)) return choixInitial(derniere.contenantId);
    if (type === 'cocktail' && derniere.volumeML === recetteML) return choixInitial('recette');
    return { ...choixInitial('libre'), texte: enTexte(derniere.volumeML / 10) };
  }
  if (type === 'cocktail') return choixInitial('recette');
  // Jamais consommée : on reprend le contenant utilisé en dernier pour la même catégorie.
  const voisine = d.consommations.find(
    (c) => c.type === 'boisson' && c.contenantId !== null && d.contenantsParId.has(c.contenantId)
      && d.boissonsParId.get(c.refId)?.categorieId === reference.categorieId,
  );
  return choixInitial(voisine ? voisine.contenantId : d.contenants[0]?.id ?? 'libre');
}

/** Crée le contenant si « Enregistrer comme contenant » est coché ; renvoie l'id du contenant ou null. */
async function contenantDuChoix(choix, volumeML) {
  if (typeof choix.choix === 'number') return choix.choix;
  if (choix.choix === 'libre' && choix.memoriser) {
    return enregistrerContenant({ nom: choix.nom.trim() || volume(volumeML), volumeML });
  }
  return null;
}

/**
 * Feuille d'ajout.
 * @param {'boisson'|'cocktail'} type
 * @param {object} reference  la boisson ou le cocktail choisi
 * @param {function} onValider(saisie, libelle)  reçoit de quoi appeler ajouterConsommation
 */
export function FeuilleAjout({ type, reference, onFermer, onValider }) {
  const d = useDonnees();
  const recetteML = type === 'cocktail' ? volumeRecette(reference) : null;
  const [choix, setChoix] = useState(() => choixParDefaut(type, reference, d, recetteML));
  const [quantite, setQuantite] = useState(1);
  const [prix, setPrix] = useState(null); // null = pas encore touché : on propose le dernier prix payé
  const [erreur, setErreur] = useState('');

  const volumeML = volumeDuChoix(choix, d.contenantsParId, recetteML);
  const prixPropose = volumeML !== null ? dernierPrix(d.consommations, type, reference.id, volumeML) : null;
  const prixTexte = prix !== null ? prix : enTexte(prixPropose);
  const snapshot = volumeML === null ? null
    : type === 'cocktail' ? snapshotCocktail(reference, d.boissonsParId, volumeML) : snapshotBoisson(reference, volumeML);

  async function valider() {
    if (volumeML === null) {
      setErreur('Indique un volume supérieur à 0.');
      return;
    }
    const prixEuros = lireNombre(prixTexte);
    if (prixTexte.trim() !== '' && (prixEuros === null || prixEuros < 0)) {
      setErreur("Le prix n'est pas un nombre valide.");
      return;
    }
    const contenantId = await contenantDuChoix(choix, volumeML);
    const nomContenant = contenantId !== null ? (d.contenantsParId.get(contenantId)?.nom ?? choix.nom.trim()) : null;
    onValider(
      { type, refId: reference.id, contenantId, volumeML, quantite, prixEuros },
      libelleConsommation(reference.nom, nomContenant, volumeML, quantite),
    );
  }

  return (
    <Feuille titre={reference.nom} onFermer={onFermer}>
      <div className="pile">
        <ChoixVolume etat={choix} onChange={(c) => { setChoix(c); setErreur(''); }} contenants={d.contenants} volumeRecetteML={recetteML} />
        <div className="rangee rangee--entre">
          <span className="champ__label">Quantité</span>
          <Compteur valeur={quantite} onChange={setQuantite} />
        </div>
        <ChampNombre
          label="Prix à l'unité" unite="€" valeur={prixTexte} onChange={setPrix} placeholder="facultatif"
          aide={prix === null && prixPropose !== null ? 'Dernier prix payé pour cette boisson dans ce volume.' : undefined}
        />
        {snapshot && <ResumeApports snapshot={snapshot} quantite={quantite} gParVerre={d.parametres.gParVerre} />}
        {erreur && <p className="champ__erreur" role="alert">{erreur}</p>}
      </div>
      <div className="feuille__pied">
        <button className="bouton bouton--plein bouton--grand" onClick={valider}>Ajouter</button>
      </div>
    </Feuille>
  );
}

/** Feuille de modification d'une consommation de l'historique. */
export function FeuilleConsommation({ consommation, onFermer }) {
  const d = useDonnees();
  const { afficherToast } = useNotifications();
  const c = consommation;
  const reference = c.type === 'cocktail' ? d.cocktailsParId.get(c.refId) : d.boissonsParId.get(c.refId);
  const recetteML = c.type === 'cocktail' && reference ? volumeRecette(reference) : null;

  const [dateHeure, setDateHeure] = useState(versChampDateHeure(c.horodatage));
  const [choix, setChoix] = useState(() => {
    if (c.contenantId !== null && d.contenantsParId.has(c.contenantId)) return choixInitial(c.contenantId);
    if (recetteML !== null && c.volumeML === recetteML) return choixInitial('recette');
    return { ...choixInitial('libre'), texte: enTexte(c.volumeML / 10) };
  });
  const [quantite, setQuantite] = useState(c.quantite ?? 1);
  const [prix, setPrix] = useState(enTexte(c.prixEuros));
  const [soireeId, setSoireeId] = useState(c.soireeId === null ? '' : String(c.soireeId));
  const [erreur, setErreur] = useState('');

  const volumeML = volumeDuChoix(choix, d.contenantsParId, recetteML);

  async function enregistrer() {
    const horodatage = depuisChampDateHeure(dateHeure);
    if (horodatage === null) return setErreur('Indique la date et l\'heure.');
    if (volumeML === null) return setErreur('Indique un volume supérieur à 0.');
    const prixEuros = lireNombre(prix);
    if (prix.trim() !== '' && (prixEuros === null || prixEuros < 0)) return setErreur("Le prix n'est pas un nombre valide.");
    try {
      const contenantId = await contenantDuChoix(choix, volumeML);
      await modifierConsommation(c.id, {
        horodatage, contenantId, volumeML, quantite, prixEuros,
        soireeId: soireeId === '' ? null : Number(soireeId),
      });
      onFermer();
    } catch (e) {
      setErreur(e.message);
    }
    return undefined;
  }

  async function supprimer() {
    await supprimerConsommation(c.id);
    afficherToast({
      message: `Supprimé : ${c.snapshot.nom}`,
      // « Annuler » remet la ligne telle qu'elle était, avec le même identifiant.
      action: { libelle: 'Annuler', executer: () => restaurerConsommation(c) },
    });
    onFermer();
  }

  async function recalculer() {
    try {
      await recalculerConsommation(c.id);
      afficherToast({ message: 'Valeurs recalculées avec le dataset actuel.' });
      onFermer();
    } catch (e) {
      setErreur(e.message);
    }
  }

  return (
    <Feuille titre={c.snapshot.nom} onFermer={onFermer}>
      <div className="pile">
        <Champ label="Date et heure">
          <input className="saisie" type="datetime-local" value={dateHeure} onChange={(e) => setDateHeure(e.target.value)} />
        </Champ>
        <ChoixVolume etat={choix} onChange={setChoix} contenants={d.contenants} volumeRecetteML={recetteML} />
        <div className="rangee rangee--entre">
          <span className="champ__label">Quantité</span>
          <Compteur valeur={quantite} onChange={setQuantite} />
        </div>
        <ChampNombre label="Prix à l'unité" unite="€" valeur={prix} onChange={setPrix} placeholder="facultatif" />
        <Champ label="Soirée">
          <select className="choix" value={soireeId} onChange={(e) => setSoireeId(e.target.value)}>
            <option value="">Aucune soirée</option>
            {d.soirees.map((s) => (
              <option key={s.id} value={s.id}>{s.titre} ({dateCourte(s.debut)})</option>
            ))}
          </select>
        </Champ>
        <p className="resume">
          Valeurs figées à la saisie, pour une unité de {volume(c.volumeML)} : {nombre(c.snapshot.gAlcool, 1)} g d'alcool
          à {nombre(c.snapshot.degre, 1)} %, {nombre(c.snapshot.kcal, 0)} kcal{c.snapshot.kcalEstimee ? ' (alcool seul)' : ''}
          {c.snapshot.sucreG !== null ? `, ${nombre(c.snapshot.sucreG, 1)} g de sucre` : ''}.
        </p>
        {erreur && <p className="champ__erreur" role="alert">{erreur}</p>}
      </div>
      <div className="feuille__pied">
        <button className="bouton bouton--plein" onClick={enregistrer}>Enregistrer</button>
      </div>
      <div className="pile" style={{ marginTop: 22 }}>
        {reference && (
          <button className="bouton bouton--large" onClick={recalculer}>Recalculer avec le dataset actuel</button>
        )}
        <button className="bouton bouton--large bouton--danger" onClick={supprimer}>Supprimer</button>
      </div>
    </Feuille>
  );
}
