// Choix du volume d'une consommation : un contenant (pinte, demi…), la
// recette d'un cocktail, ou un volume libre — qu'on peut enregistrer au
// passage comme nouveau contenant.

import { Champ } from './base.jsx';
import { lireNombre, nombre, volume } from '../calculs/format.js';

/**
 * État du choix :
 *   { choix: <id de contenant> | 'recette' | 'libre',
 *     texte: '33',            volume libre tel que tapé
 *     unite: 'cL' | 'mL',
 *     memoriser: false,       enregistrer ce volume comme contenant
 *     nom: '' }               nom du nouveau contenant
 */
export function choixInitial(choix) {
  return { choix, texte: '', unite: 'cL', memoriser: false, nom: '' };
}

/** Volume en mL correspondant au choix, ou null s'il est incomplet. */
export function volumeDuChoix(etat, contenantsParId, volumeRecetteML = null) {
  if (etat.choix === 'recette') return volumeRecetteML;
  if (etat.choix === 'libre') {
    const v = lireNombre(etat.texte);
    if (v === null || v <= 0) return null;
    return etat.unite === 'cL' ? v * 10 : v;
  }
  return contenantsParId.get(etat.choix)?.volumeML ?? null;
}

export function ChoixVolume({ etat, onChange, contenants, volumeRecetteML = null }) {
  const maj = (modifs) => onChange({ ...etat, ...modifs });
  return (
    <div className="pile">
      <div className="puces" role="group" aria-label="Contenant">
        {volumeRecetteML !== null && (
          <button type="button" className="puce" aria-pressed={etat.choix === 'recette'} onClick={() => maj({ choix: 'recette' })}>
            Recette <span className="puce__second">{volume(volumeRecetteML)}</span>
          </button>
        )}
        {contenants.map((c) => (
          <button key={c.id} type="button" className="puce" aria-pressed={etat.choix === c.id} onClick={() => maj({ choix: c.id })}>
            {c.nom} <span className="puce__second">{volume(c.volumeML)}</span>
          </button>
        ))}
        <button type="button" className="puce" aria-pressed={etat.choix === 'libre'} onClick={() => maj({ choix: 'libre' })}>
          Autre volume
        </button>
      </div>

      {etat.choix === 'libre' && (
        <div className="pile">
          <div className="rangee rangee--haut">
            <div className="grandit">
              <Champ label="Volume">
                <input
                  className="saisie" type="text" inputMode="decimal" autoComplete="off" autoFocus
                  value={etat.texte} placeholder={etat.unite === 'cL' ? 'ex. 40' : 'ex. 400'}
                  onChange={(e) => maj({ texte: e.target.value })}
                />
              </Champ>
            </div>
            <Champ label="Unité">
              <select className="choix" value={etat.unite} onChange={(e) => maj({ unite: e.target.value })} style={{ width: 96 }}>
                <option value="cL">cL</option>
                <option value="mL">mL</option>
              </select>
            </Champ>
          </div>
          <label className="case">
            <input type="checkbox" checked={etat.memoriser} onChange={(e) => maj({ memoriser: e.target.checked })} />
            <span>Enregistrer comme contenant</span>
          </label>
          {etat.memoriser && (
            <Champ label="Nom du contenant">
              <input className="saisie" type="text" value={etat.nom} placeholder="ex. Chope" onChange={(e) => maj({ nom: e.target.value })} />
            </Champ>
          )}
        </div>
      )}
    </div>
  );
}

/** Résumé d'un snapshot multiplié par la quantité : verres, grammes, kcal, sucre. */
export function ResumeApports({ snapshot, quantite, gParVerre }) {
  const g = snapshot.gAlcool * quantite;
  const sucre = snapshot.sucreG === null ? null : snapshot.sucreG * quantite;
  return (
    <p className="resume" aria-live="polite">
      <strong>{nombre(g / gParVerre, 1)} verre{g / gParVerre >= 2 ? 's' : ''} standard</strong>
      {' '}soit {nombre(g, 1)} g d'alcool pur à {nombre(snapshot.degre, 1)} %.
      <br />
      {nombre(snapshot.kcal * quantite, 0)} kcal{snapshot.kcalEstimee ? ' au moins (alcool seul)' : ''}
      {sucre !== null && `, ${nombre(sucre, 1)} g de sucre${snapshot.sucreIncomplet ? ' au moins' : ''}`}
      {sucre === null && ', sucre non renseigné'}.
    </p>
  );
}
