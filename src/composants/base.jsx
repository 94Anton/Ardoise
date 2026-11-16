// ---------------------------------------------------------------------------
// Briques d'interface réutilisées par tous les écrans.
// ---------------------------------------------------------------------------

import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Icone } from './Icone.jsx';
import { nombre } from '../calculs/format.js';

/** En-tête d'écran : titre, sur-titre facultatif, bouton retour et action à droite. */
export function Entete({ titre, surTitre, retour = false, action = null }) {
  const naviguer = useNavigate();
  return (
    <header className="entete">
      {retour && (
        <button
          className="bouton-icone bouton-icone--fond"
          onClick={() => (typeof retour === 'string' ? naviguer(retour) : naviguer(-1))}
          aria-label="Retour"
        >
          <Icone nom="retour" />
        </button>
      )}
      <div className="entete__texte grandit">
        {surTitre && <p className="entete__sur-titre">{surTitre}</p>}
        <h1>{titre}</h1>
      </div>
      {action}
    </header>
  );
}

/** Section d'un écran, avec un titre et un lien d'action facultatif à droite. */
export function Section({ titre, lien = null, children }) {
  return (
    <section className="section">
      {(titre || lien) && (
        <div className="section__tete">
          {titre && <h2>{titre}</h2>}
          {lien}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Feuille : panneau qui monte du bas de l'écran, pour une saisie courte.
 * Se ferme en touchant le voile, la croix, ou avec la touche Échap.
 */
export function Feuille({ titre, onFermer, children }) {
  useEffect(() => {
    const surTouche = (e) => e.key === 'Escape' && onFermer();
    document.addEventListener('keydown', surTouche);
    // On bloque le défilement de la page derrière la feuille.
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', surTouche);
      document.body.style.overflow = avant;
    };
  }, [onFermer]);

  return createPortal(
    <div className="voile" onClick={(e) => e.target === e.currentTarget && onFermer()}>
      <div className="feuille" role="dialog" aria-modal="true" aria-label={titre}>
        <div className="feuille__poignee" />
        <div className="feuille__tete">
          <h2>{titre}</h2>
          <button className="bouton-icone" onClick={onFermer} aria-label="Fermer">
            <Icone nom="fermer" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Champ de formulaire : libellé au-dessus, aide ou erreur en dessous. */
export function Champ({ label, aide, erreur, children }) {
  return (
    <label className="champ">
      <span className="champ__label">{label}</span>
      {children}
      {aide && !erreur && <span className="champ__aide">{aide}</span>}
      {erreur && <span className="champ__erreur">{erreur}</span>}
    </label>
  );
}

/**
 * Champ numérique. On garde le texte tel que tapé (la virgule française est
 * acceptée) ; la conversion en nombre se fait avec lireNombre() à la validation.
 */
export function ChampNombre({ label, aide, erreur, valeur, onChange, unite, placeholder }) {
  return (
    <Champ label={label} aide={aide} erreur={erreur}>
      <span className="saisie-suffixe">
        <input
          className="saisie"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={valeur}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {unite && <span className="saisie-suffixe__unite">{unite}</span>}
      </span>
    </Champ>
  );
}

/** Sélecteur à segments : <Segments options={[{ valeur, libelle }]} valeur onChange /> */
export function Segments({ options, valeur, onChange, label }) {
  return (
    <div className="segments" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.valeur}
          type="button"
          className="segments__option"
          aria-pressed={o.valeur === valeur}
          onClick={() => onChange(o.valeur)}
        >
          {o.libelle}
        </button>
      ))}
    </div>
  );
}

/** Compteur − valeur + (quantité). */
export function Compteur({ valeur, onChange, min = 1, max = 99, label = 'Quantité' }) {
  return (
    <div className="compteur" role="group" aria-label={label}>
      <button
        type="button" className="bouton-icone bouton-icone--fond" aria-label="Diminuer"
        disabled={valeur <= min} onClick={() => onChange(Math.max(min, valeur - 1))}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
      </button>
      <span className="compteur__valeur" aria-live="polite">{valeur}</span>
      <button
        type="button" className="bouton-icone bouton-icone--fond" aria-label="Augmenter"
        disabled={valeur >= max} onClick={() => onChange(Math.min(max, valeur + 1))}
      >
        <Icone nom="plus" taille={20} />
      </button>
    </div>
  );
}

/**
 * Curseur de 1 à 10, facultatif : tant qu'on n'y a pas touché, la valeur est
 * `null` (affichée « – »). « Effacer » remet à null.
 */
export function Curseur({ label, valeur, onChange, min = 'faible', max = 'fort' }) {
  const id = useId();
  const vide = valeur === null || valeur === undefined;
  return (
    <div className={`curseur${vide ? ' curseur--vide' : ''}`}>
      <div className="curseur__tete">
        <label htmlFor={id} className="gras">{label}</label>
        <span className={`curseur__valeur${vide ? ' curseur__valeur--vide' : ''}`}>{vide ? '–' : valeur}</span>
      </div>
      <input
        id={id}
        type="range"
        min="1"
        max="10"
        step="1"
        value={vide ? 5 : valeur}
        onChange={(e) => onChange(Number(e.target.value))}
        // Un simple toucher sans glisser doit aussi fixer la valeur.
        onPointerUp={(e) => vide && onChange(Number(e.currentTarget.value))}
        onKeyUp={(e) => vide && onChange(Number(e.currentTarget.value))}
        aria-valuetext={vide ? 'non renseigné' : `${valeur} sur 10`}
      />
      <div className="curseur__reperes">
        <span>1 : {min}</span>
        {!vide && (
          <button type="button" className="section__lien mini" style={{ padding: 0 }} onClick={() => onChange(null)}>
            Effacer
          </button>
        )}
        <span>10 : {max}</span>
      </div>
    </div>
  );
}

/** Pastille de couleur d'une catégorie. */
export function Pastille({ couleur }) {
  return <span className="pastille" style={{ background: couleur }} aria-hidden="true" />;
}

/**
 * Jauge d'objectif : remplissage coloré selon l'état, avec un repère au seuil
 * d'alerte. L'état est toujours répété en texte à côté (jamais la couleur seule).
 */
export function Jauge({ ratio, seuil = 0.8, etat }) {
  const largeur = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div className="jauge" data-etat={etat} role="img" aria-label={`${nombre(ratio * 100, 0)} % de la limite`}>
      <div className="jauge__plein" style={{ width: `${largeur}%` }} />
      <div className="jauge__seuil" style={{ left: `${seuil * 100}%` }} />
    </div>
  );
}

// Position des quatre bâtons d'un groupe (x du bas, x du haut) : légèrement
// penchés, comme tracés à la craie.
const TRAITS = [[7, 8.6], [17.4, 16.2], [27, 28.2], [37.6, 36]];
const BAS = 41;
const HAUT = 5;

/**
 * Les bâtons de l'ardoise : un trait par verre standard, le cinquième barre
 * les quatre premiers. Une fraction de verre donne un trait plus court.
 */
export function Batons({ valeur }) {
  const entiers = Math.floor(valeur + 1e-9);
  // En dessous d'un quart de verre, la fraction n'est pas dessinée (elle ferait un simple point).
  const fraction = valeur - entiers >= 0.25 ? valeur - entiers : 0;
  const nbTraits = entiers + (fraction > 0 ? 1 : 0);
  if (nbTraits === 0) return null;
  const groupes = [];
  for (let debut = 0; debut < nbTraits; debut += 5) {
    const chemins = [];
    for (let i = debut; i < Math.min(debut + 5, nbTraits); i += 1) {
      // Longueur du trait : complète, sauf pour le dernier si c'est une fraction de verre.
      const f = i === nbTraits - 1 && fraction > 0 ? fraction : 1;
      const rang = i - debut;
      if (rang < 4) {
        const [xBas, xHaut] = TRAITS[rang];
        chemins.push(`M${xBas} ${BAS}L${xBas + (xHaut - xBas) * f} ${BAS - (BAS - HAUT) * f}`);
      } else {
        chemins.push(`M2.5 35L${2.5 + 43 * f} ${35 - 24 * f}`);
      }
    }
    groupes.push(
      <svg key={debut} viewBox="0 0 48 46" aria-hidden="true">
        <path d={chemins.join('')} />
      </svg>,
    );
  }
  return <div className="batons">{groupes}</div>;
}

/** Message affiché quand une liste est vide, avec une action pour commencer. */
export function Vide({ children }) {
  return <div className="vide">{children}</div>;
}

/** Demande de confirmation avant une action qui ne se rattrape pas. */
export function FeuilleConfirmation({ titre, children, libelle = 'Supprimer', onConfirmer, onFermer }) {
  return (
    <Feuille titre={titre} onFermer={onFermer}>
      <div className="discret">{children}</div>
      <div className="feuille__pied">
        <button className="bouton" onClick={onFermer}>Annuler</button>
        <button className="bouton bouton--danger" onClick={onConfirmer}>{libelle}</button>
      </div>
    </Feuille>
  );
}
