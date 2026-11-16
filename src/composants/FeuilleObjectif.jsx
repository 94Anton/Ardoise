// Formulaire de création / modification d'un objectif (limite à ne pas dépasser).

import { useState } from 'react';
import { Champ, ChampNombre, Feuille } from './base.jsx';
import { libelleRythme } from './Objectif.jsx';
import { useDonnees } from '../contexte/Donnees.jsx';
import { PERIODES, UNITES } from '../calculs/objectifs.js';
import { lireNombre, valeurAvecUnite } from '../calculs/format.js';
import { enregistrerObjectif } from '../donnees/actions.js';

const enTexte = (x) => (x === null || x === undefined ? '' : String(x).replace('.', ','));

/** Nom proposé quand le champ est laissé vide : « Max 20 verres par mois ». */
export function nomParDefaut({ unite, limite, periode, nJours, categorie = null }) {
  const base = `Max ${valeurAvecUnite(limite, unite)} ${libelleRythme({ periode, nJours })}`;
  return categorie ? `${base}, ${categorie.nom}` : base;
}

/**
 * @param {object|null} objectif  objectif à modifier, ou null pour une création
 * @param {function} onEnregistre appelée avec l'id une fois l'objectif enregistré
 */
export function FeuilleObjectif({ objectif = null, onFermer, onEnregistre }) {
  const d = useDonnees();
  const [unite, setUnite] = useState(objectif?.unite ?? 'verres');
  const [limite, setLimite] = useState(enTexte(objectif?.limite));
  const [periode, setPeriode] = useState(objectif?.periode ?? 'mois');
  const [nJours, setNJours] = useState(enTexte(objectif?.nJours ?? 7));
  const [categorieId, setCategorieId] = useState(objectif?.filtreCategorie ? String(objectif.filtreCategorie) : '');
  const [seuil, setSeuil] = useState(enTexte(Math.round((objectif?.seuilAlerte ?? 0.8) * 100)));
  const [nom, setNom] = useState(objectif?.nom ?? '');
  const [actif, setActif] = useState(objectif?.actif ?? true);
  const [erreur, setErreur] = useState('');

  // Valeurs lues dans le formulaire (null tant qu'un champ n'est pas un nombre).
  const valeurLimite = lireNombre(limite);
  const valeurNJours = lireNombre(nJours);
  const categorie = categorieId === '' ? null : d.categoriesParId.get(Number(categorieId)) ?? null;
  const nomPropose = valeurLimite !== null && valeurLimite > 0 && (periode !== 'jours' || valeurNJours >= 1)
    ? nomParDefaut({ unite, limite: valeurLimite, periode, nJours: Math.round(valeurNJours ?? 7), categorie })
    : '';

  async function enregistrer() {
    const valeurSeuil = lireNombre(seuil);
    if (valeurSeuil === null || valeurSeuil < 1 || valeurSeuil > 100) {
      setErreur("Le seuil d'alerte doit être compris entre 1 et 100 %.");
      return;
    }
    try {
      const id = await enregistrerObjectif({
        id: objectif?.id,
        nom: nom.trim() || nomPropose,
        unite,
        limite: valeurLimite,
        periode,
        nJours: valeurNJours,
        filtreCategorie: categorie ? categorie.id : null,
        seuilAlerte: valeurSeuil / 100,
        actif,
      });
      onEnregistre?.(id);
      onFermer();
    } catch (e) {
      setErreur(e.message);
    }
  }

  return (
    <Feuille titre={objectif ? "Modifier l'objectif" : 'Nouvel objectif'} onFermer={onFermer}>
      <div className="pile">
        <Champ label="Ce que tu limites">
          <select className="choix" value={unite} onChange={(e) => setUnite(e.target.value)}>
            {Object.entries(UNITES).map(([cle, u]) => <option key={cle} value={cle}>{u.libelle}</option>)}
          </select>
        </Champ>
        <ChampNombre
          label="Limite à ne pas dépasser" unite={UNITES[unite].court} valeur={limite} onChange={setLimite}
          placeholder={unite === 'verres' ? 'ex. 20' : 'ex. 40'}
        />
        <Champ label="Période">
          <select className="choix" value={periode} onChange={(e) => setPeriode(e.target.value)}>
            {Object.entries(PERIODES).map(([cle, p]) => <option key={cle} value={cle}>{p.libelle}</option>)}
          </select>
        </Champ>
        {periode === 'jours' && (
          <ChampNombre
            label="Nombre de jours" unite="jours" valeur={nJours} onChange={setNJours}
            aide="La période couvre aujourd'hui et les jours qui précèdent : elle avance chaque jour."
          />
        )}
        <Champ label="Catégorie" aide={categorie ? `Seul ce qui vient de la catégorie ${categorie.nom} est compté.` : undefined}>
          <select className="choix" value={categorieId} onChange={(e) => setCategorieId(e.target.value)}>
            <option value="">Toutes les catégories</option>
            {d.categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </Champ>
        <ChampNombre
          label="Alerte à partir de" unite="%" valeur={seuil} onChange={setSeuil}
          aide="Un bandeau s'affiche quand une saisie fait franchir ce seuil, puis quand la limite est atteinte."
        />
        <Champ label="Nom" aide="Facultatif.">
          <input className="saisie" type="text" value={nom} placeholder={nomPropose || 'ex. Max 20 verres par mois'} onChange={(e) => setNom(e.target.value)} />
        </Champ>
        {objectif && (
          <label className="case">
            <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
            <span>Actif (affiché sur l'accueil, avec ses alertes)</span>
          </label>
        )}
        {erreur && <p className="champ__erreur" role="alert">{erreur}</p>}
      </div>
      <div className="feuille__pied">
        <button className="bouton bouton--plein" onClick={enregistrer}>{objectif ? 'Enregistrer' : "Créer l'objectif"}</button>
      </div>
    </Feuille>
  );
}
