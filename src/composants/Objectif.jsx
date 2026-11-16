// Affichage d'un objectif : nom, chiffres, jauge et état en toutes lettres.

import { Link } from 'react-router-dom';
import { Jauge } from './base.jsx';
import { UNITES } from '../calculs/objectifs.js';
import { nombre, valeurAvecUnite } from '../calculs/format.js';

/** « ce mois », « cette semaine », « aujourd'hui », « 7 derniers jours ». */
export function libellePeriode(objectif) {
  switch (objectif.periode) {
    case 'jour': return "aujourd'hui";
    case 'semaine': return 'cette semaine';
    case 'mois': return 'ce mois';
    default: return `${objectif.nJours} derniers jours`;
  }
}

/** « par jour », « par semaine », « par mois », « sur 7 jours glissants ». */
export function libelleRythme(objectif) {
  switch (objectif.periode) {
    case 'jour': return 'par jour';
    case 'semaine': return 'par semaine';
    case 'mois': return 'par mois';
    default: return `sur ${objectif.nJours} jours glissants`;
  }
}

/** Phrase d'état : dit toujours où l'on en est par rapport à la limite. */
export function phraseEtat(objectif, p) {
  const pourcent = `${nombre(p.ratio * 100, 0)} %`;
  if (p.etat === 'depasse') return `Dépassé de ${valeurAvecUnite(-p.reste, objectif.unite)}`;
  if (p.reste < 1e-9) return 'Limite atteinte';
  const reste = `il reste ${valeurAvecUnite(p.reste, objectif.unite)}`;
  return p.etat === 'alerte' ? `Alerte, ${pourcent} : ${reste}` : `${pourcent}, ${reste}`;
}

/** « 14,2 / 20 verres » */
export function chiffresObjectif(objectif, valeur) {
  const info = UNITES[objectif.unite];
  const decimales = objectif.unite === 'euros' ? 2 : info.decimales;
  return `${nombre(valeur, decimales)} / ${nombre(objectif.limite, decimales)} ${info.court}`;
}

/**
 * Bloc d'un objectif sur sa période en cours.
 * @param {object} p  résultat de progression() (calculs/objectifs.js)
 */
export function BlocObjectif({ objectif, p, vers }) {
  const contenu = (
    <>
      <div className="objectif__tete">
        <span className="objectif__nom">{objectif.nom}</span>
        <span className="objectif__chiffres">{chiffresObjectif(objectif, p.valeur)}</span>
      </div>
      <Jauge ratio={p.ratio} seuil={objectif.seuilAlerte ?? 0.8} etat={p.etat} />
      <div className="objectif__etat">
        <span className="etat-point" data-etat={p.etat} aria-hidden="true" />
        <span>{phraseEtat(objectif, p)} ({libellePeriode(objectif)})</span>
      </div>
    </>
  );
  return vers ? <Link to={vers} className="objectif">{contenu}</Link> : <div className="objectif">{contenu}</div>;
}
