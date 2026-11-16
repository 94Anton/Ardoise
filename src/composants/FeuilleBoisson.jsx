// Formulaire de création / modification d'une boisson du dataset.
// Utilisé depuis l'écran Dataset et directement depuis l'écran de saisie.

import { useState } from 'react';
import { Champ, ChampNombre, Feuille } from './base.jsx';
import { useDonnees } from '../contexte/Donnees.jsx';
import { useNotifications } from '../contexte/Notifications.jsx';
import { enregistrerBoisson, recalculerPourBoisson, restaurer, supprimerBoisson } from '../donnees/actions.js';
import { nombreUtilisationsBoisson } from '../donnees/selecteurs.js';
import { lireNombre } from '../calculs/format.js';

const texte = (x) => (x === null || x === undefined ? '' : String(x).replace('.', ','));

/**
 * @param {object|null} boisson   boisson à modifier, ou null pour une création
 * @param {string} nomInitial     nom prérempli (ce qu'on vient de chercher)
 * @param {function} onEnregistre appelée avec l'id une fois la boisson enregistrée
 */
export function FeuilleBoisson({ boisson = null, nomInitial = '', categorieInitiale = null, onFermer, onEnregistre }) {
  const d = useDonnees();
  const { afficherToast } = useNotifications();
  const [nom, setNom] = useState(boisson?.nom ?? nomInitial);
  const [categorieId, setCategorieId] = useState(String(boisson?.categorieId ?? categorieInitiale ?? d.categories[0]?.id ?? ''));
  const [degre, setDegre] = useState(texte(boisson?.degre));
  const [kcal, setKcal] = useState(texte(boisson?.kcalParL));
  const [sucre, setSucre] = useState(texte(boisson?.sucreGParL));
  const [favori, setFavori] = useState(boisson?.favori ?? false);
  const [notes, setNotes] = useState(boisson?.notes ?? '');
  const [erreur, setErreur] = useState('');

  const categorie = d.categoriesParId.get(Number(categorieId));
  const nbUtilisations = boisson ? nombreUtilisationsBoisson(boisson.id, d.consommations) : 0;

  async function enregistrer() {
    try {
      const id = await enregistrerBoisson({
        id: boisson?.id,
        nom,
        categorieId: Number(categorieId),
        // Un diluant sans degré saisi vaut 0 %.
        degre: lireNombre(degre) ?? (categorie && !categorie.alcoolisee ? 0 : null),
        kcalParL: lireNombre(kcal),
        sucreGParL: lireNombre(sucre),
        favori,
        notes,
        archive: boisson?.archive ?? false,
      });
      onEnregistre?.(id);
      onFermer();
    } catch (e) {
      setErreur(e.message);
    }
  }

  async function supprimer() {
    const resultat = await supprimerBoisson(boisson.id);
    afficherToast({
      message: resultat === 'archivee'
        ? `« ${boisson.nom} » est archivée : elle reste dans l'historique mais n'est plus proposée à la saisie.`
        : `« ${boisson.nom} » est supprimée.`,
    });
    onFermer();
  }

  async function recalculer() {
    // On enregistre d'abord les valeurs du formulaire, puis on les applique au passé.
    try {
      await enregistrerBoisson({
        id: boisson.id, nom, categorieId: Number(categorieId), degre: lireNombre(degre),
        kcalParL: lireNombre(kcal), sucreGParL: lireNombre(sucre), favori, notes, archive: boisson.archive,
      });
      const n = await recalculerPourBoisson(boisson.id);
      afficherToast({ message: `${n} consommation${n > 1 ? 's' : ''} recalculée${n > 1 ? 's' : ''} avec ces valeurs.` });
      onFermer();
    } catch (e) {
      setErreur(e.message);
    }
  }

  return (
    <Feuille titre={boisson ? 'Modifier la boisson' : 'Nouvelle boisson'} onFermer={onFermer}>
      <div className="pile">
        <Champ label="Nom (marque et produit)">
          <input className="saisie" type="text" value={nom} placeholder="ex. Leffe Blonde" autoFocus={!boisson} onChange={(e) => setNom(e.target.value)} />
        </Champ>
        <Champ label="Catégorie">
          <select className="choix" value={categorieId} onChange={(e) => setCategorieId(e.target.value)}>
            {d.categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </Champ>
        <ChampNombre
          label="Degré d'alcool" unite="% vol." valeur={degre} onChange={setDegre}
          placeholder={categorie && !categorie.alcoolisee ? '0' : 'ex. 6,6'}
        />
        <div className="champs-2">
          <ChampNombre label="Calories" unite="kcal/L" valeur={kcal} onChange={setKcal} placeholder="facultatif" />
          <ChampNombre label="Sucre" unite="g/L" valeur={sucre} onChange={setSucre} placeholder="facultatif" />
        </div>
        <p className="champ__aide">
          Les étiquettes donnent souvent ces valeurs pour 100 mL : multiplie-les par 10. Sans calories renseignées,
          l'appli compte seulement celles de l'alcool ; sans sucre renseigné, la boisson est exclue des totaux de sucre.
        </p>
        <label className="case">
          <input type="checkbox" checked={favori} onChange={(e) => setFavori(e.target.checked)} />
          <span>Favori (proposé en haut de la saisie)</span>
        </label>
        {boisson && (
          <Champ label="Notes">
            <textarea className="saisie" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Champ>
        )}
        {erreur && <p className="champ__erreur" role="alert">{erreur}</p>}
      </div>

      <div className="feuille__pied">
        <button className="bouton bouton--plein" onClick={enregistrer}>{boisson ? 'Enregistrer' : 'Créer la boisson'}</button>
      </div>

      {boisson && (
        <div className="pile" style={{ marginTop: 22 }}>
          {nbUtilisations > 0 && (
            <button className="bouton bouton--large" onClick={recalculer}>
              Enregistrer et recalculer {nbUtilisations} consommation{nbUtilisations > 1 ? 's' : ''} passée{nbUtilisations > 1 ? 's' : ''}
            </button>
          )}
          {boisson.archive ? (
            <button className="bouton bouton--large" onClick={async () => { await restaurer('boissons', boisson.id); onFermer(); }}>
              Sortir des archives
            </button>
          ) : (
            <button className="bouton bouton--large bouton--danger" onClick={supprimer}>
              {nbUtilisations > 0 ? 'Archiver la boisson' : 'Supprimer la boisson'}
            </button>
          )}
          {nbUtilisations > 0 && (
            <p className="champ__aide">
              Par défaut, modifier une boisson ne change pas les consommations déjà saisies : chacune garde les valeurs
              du jour où elle a été notée.
            </p>
          )}
        </div>
      )}
    </Feuille>
  );
}
