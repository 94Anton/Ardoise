// Historique : consommations et soirées regroupées par jour, du plus récent
// au plus ancien. Toucher une ligne permet de la modifier ou de la supprimer.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Entete, Pastille, Vide } from '../composants/base.jsx';
import { Icone } from '../composants/Icone.jsx';
import { FeuilleConsommation } from '../composants/FeuillesConsommation.jsx';
import { useDonnees } from '../contexte/Donnees.jsx';
import { somme } from '../calculs/alcool.js';
import { valeurConsommation } from '../calculs/objectifs.js';
import { cleJour } from '../calculs/periodes.js';
import { dateLongue, heure, majuscule, nombre, volume } from '../calculs/format.js';
import { categoriePrincipale, nomContenant } from '../donnees/selecteurs.js';

const JOURS_PAR_PAGE = 30;

export default function Historique() {
  const d = useDonnees();
  const [nbJours, setNbJours] = useState(JOURS_PAR_PAGE);
  const [ouverte, setOuverte] = useState(null); // id de la consommation en cours de modification
  const gParVerre = d.parametres.gParVerre;

  // Regroupe par jour : { cle, date, consommations[], soirees[] }, jours récents d'abord.
  const jours = useMemo(() => {
    const parCle = new Map();
    const jour = (t) => {
      const cle = cleJour(t);
      if (!parCle.has(cle)) parCle.set(cle, { cle, date: t, consommations: [], soirees: [] });
      return parCle.get(cle);
    };
    for (const c of d.consommations) jour(c.horodatage).consommations.push(c);
    for (const s of d.soirees) jour(s.debut).soirees.push(s);
    return [...parCle.values()].sort((a, b) => (a.cle < b.cle ? 1 : -1));
  }, [d.consommations, d.soirees]);

  const consommationOuverte = ouverte === null ? null : d.consommations.find((c) => c.id === ouverte) ?? null;

  return (
    <>
      <Entete titre="Historique" />

      {jours.length === 0 && (
        <Vide>
          <p>Rien sur l'ardoise. Ta première consommation apparaîtra ici.</p>
          <Link className="bouton bouton--plein" to="/saisie">Ajouter une consommation</Link>
        </Vide>
      )}

      {jours.slice(0, nbJours).map((jour) => {
        const verres = somme(jour.consommations, (c) => valeurConsommation(c, 'verres', { gParVerre }));
        return (
          <section key={jour.cle}>
            <div className="jour-tete">
              <h2 style={{ fontSize: 17 }}>{majuscule(dateLongue(jour.date))}</h2>
              <span className="chiffres discret" style={{ fontWeight: 400 }}>
                {nombre(verres, 1)} verre{verres >= 2 ? 's' : ''}
              </span>
            </div>
            <ul className="liste">
              {jour.soirees.map((s) => {
                const consos = d.consommations.filter((c) => c.soireeId === s.id);
                const verresSoiree = somme(consos, (c) => valeurConsommation(c, 'verres', { gParVerre }));
                return (
                  <li key={`s${s.id}`}>
                    <Link className="ligne" to={`/soiree/${s.id}`}>
                      <span className="ligne__corps">
                        <span className="ligne__titre" style={{ display: 'block' }}>{s.titre}</span>
                        <span className="ligne__detail">
                          Soirée, {heure(s.debut)} {s.fin === null ? 'en cours' : `à ${heure(s.fin)}`}, {nombre(verresSoiree, 1)} verre{verresSoiree >= 2 ? 's' : ''}
                        </span>
                      </span>
                      <Icone nom="chevron" taille={20} style={{ color: 'var(--encre-3)', flex: 'none' }} />
                    </Link>
                  </li>
                );
              })}
              {jour.consommations.map((c) => (
                <li key={c.id}>
                  <LigneConsommation consommation={c} d={d} onClick={() => setOuverte(c.id)} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {jours.length > nbJours && (
        <button className="bouton bouton--large" style={{ marginTop: 24 }} onClick={() => setNbJours(nbJours + JOURS_PAR_PAGE)}>
          Afficher les jours précédents
        </button>
      )}

      {consommationOuverte && <FeuilleConsommation consommation={consommationOuverte} onFermer={() => setOuverte(null)} />}
    </>
  );
}

/** Ligne d'une consommation : heure, pastille de catégorie, nom, détail, verres standard. */
export function LigneConsommation({ consommation: c, d, onClick, montrerSoiree = true }) {
  const categorie = d.categoriesParId.get(categoriePrincipale(c));
  const contenant = nomContenant(c, d.contenantsParId);
  const quantite = c.quantite ?? 1;
  const verres = valeurConsommation(c, 'verres', { gParVerre: d.parametres.gParVerre });
  const soiree = montrerSoiree && c.soireeId !== null ? d.soireesParId.get(c.soireeId) : null;
  return (
    <button className="ligne" onClick={onClick}>
      <span className="ligne__heure">{heure(c.horodatage)}</span>
      <Pastille couleur={categorie?.couleur} />
      <span className="ligne__corps">
        <span className="ligne__titre" style={{ display: 'block' }}>
          {quantite > 1 && `${quantite} × `}{c.snapshot.nom}
        </span>
        <span className="ligne__detail">
          {contenant ? `${contenant}, ${volume(c.volumeML)}` : volume(c.volumeML)}
          {soiree && <> <span className="etiquette">{soiree.titre}</span></>}
        </span>
      </span>
      <span className="ligne__valeur">
        {nombre(verres, 1)}
        <span className="ligne__detail" style={{ display: 'block' }}>verre{verres >= 2 ? 's' : ''}</span>
      </span>
    </button>
  );
}
