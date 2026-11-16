// Statistiques : chiffres clés du mois, consommation par semaine ou par mois,
// répartition par catégorie puis par marque, corrélations entre soirées.

import { useMemo, useState } from 'react';
import { Entete, Pastille, Section, Segments, Vide } from '../composants/base.jsx';
import { Icone } from '../composants/Icone.jsx';
import { GraphiqueBarres, NuageRessenti } from '../composants/graphiques.jsx';
import { useDonnees } from '../contexte/Donnees.jsx';
import { useMaintenant } from '../utilitaires/crochets.js';
import { chiffresClesMois, repartition, serieParPeriode } from '../calculs/agregats.js';
import { MIN_SOIREES, analyserCorrelations, pointsNuage } from '../calculs/correlations.js';
import { ajouterMois, debutMois } from '../calculs/periodes.js';
import {
  dateCourte, euros, jourMois, majuscule, moisAnnee, moisCourt, nombre, valeurAvecUnite,
} from '../calculs/format.js';

// Unités proposées en haut de l'écran : elles s'appliquent à tous les graphiques.
const CHOIX_UNITES = [
  { valeur: 'verres', libelle: 'Verres standard' },
  { valeur: 'g', libelle: 'Alcool pur' },
  { valeur: 'kcal', libelle: 'Calories' },
  { valeur: 'sucre', libelle: 'Sucre' },
  { valeur: 'euros', libelle: 'Dépense' },
];

const PERIODES_REPARTITION = [
  { valeur: 'mois', libelle: 'Ce mois' },
  { valeur: '3mois', libelle: '3 derniers mois' },
  { valeur: '12mois', libelle: '12 derniers mois' },
  { valeur: 'tout', libelle: 'Depuis le début' },
];

const NB_BARRES = 12;

export default function Stats() {
  const d = useDonnees();
  const maintenant = useMaintenant(60000);
  const [unite, setUnite] = useState('verres');
  const gParVerre = d.parametres.gParVerre;

  return (
    <>
      <Entete titre="Stats" />

      <div className="puces puces--defilent" role="group" aria-label="Unité affichée">
        {CHOIX_UNITES.map((u) => (
          <button key={u.valeur} className="puce" aria-pressed={unite === u.valeur} onClick={() => setUnite(u.valeur)}>
            {u.libelle}
          </button>
        ))}
      </div>

      {d.consommations.length === 0 ? (
        <Vide>
          <p>Les graphiques apparaîtront dès ta première consommation.</p>
        </Vide>
      ) : (
        <>
          <ChiffresCles d={d} maintenant={maintenant} unite={unite} gParVerre={gParVerre} />
          <ParPeriode d={d} maintenant={maintenant} unite={unite} gParVerre={gParVerre} />
          <Repartition d={d} maintenant={maintenant} unite={unite} gParVerre={gParVerre} />
        </>
      )}
      <Correlations d={d} />
    </>
  );
}

// =========================== Chiffres clés du mois ==========================

function ChiffresCles({ d, maintenant, unite, gParVerre }) {
  const [mois, setMois] = useState(() => debutMois(Date.now()));
  const k = chiffresClesMois(d.consommations, d.soirees, mois, maintenant, { unite, gParVerre });
  const moisCourant = mois >= debutMois(maintenant);
  return (
    <Section>
      <div className="rangee rangee--entre" style={{ marginBottom: 14 }}>
        <button className="bouton-icone bouton-icone--fond" aria-label="Mois précédent" onClick={() => setMois(ajouterMois(mois, -1))}>
          <Icone nom="retour" taille={20} />
        </button>
        <h2>{majuscule(moisAnnee(mois))}</h2>
        <button className="bouton-icone bouton-icone--fond" aria-label="Mois suivant" disabled={moisCourant} style={{ opacity: moisCourant ? 0.35 : 1 }} onClick={() => setMois(ajouterMois(mois, 1))}>
          <Icone nom="chevron" taille={20} />
        </button>
      </div>
      <div className="chiffres-cles">
        <div>
          <div className="chiffre__valeur">{valeurAvecUnite(k.total, unite)}</div>
          <div className="chiffre__libelle">
            au total
            {unite === 'kcal' && k.kcalEstimee && ', au moins (alcool seul pour certaines boissons)'}
            {unite === 'sucre' && k.sucreIncomplet && ', données incomplètes'}
          </div>
        </div>
        <div>
          <div className="chiffre__valeur">{k.joursSansAlcool} sur {k.joursEcoules}</div>
          <div className="chiffre__libelle">jour{k.joursSansAlcool >= 2 ? 's' : ''} sans alcool</div>
        </div>
        <div>
          <div className="chiffre__valeur">{euros(k.depense)}</div>
          <div className="chiffre__libelle">dépensés{k.nbSansPrix > 0 ? ` (${k.nbSansPrix} sans prix)` : ''}</div>
        </div>
        <div>
          <div className="chiffre__valeur">{k.moyenneParSoiree === null ? '–' : valeurAvecUnite(k.moyenneParSoiree, 'verres')}</div>
          <div className="chiffre__libelle">
            {k.nbSoirees === 0 ? 'par soirée (aucune soirée ce mois)' : `en moyenne par soirée (${k.nbSoirees} soirée${k.nbSoirees > 1 ? 's' : ''})`}
          </div>
        </div>
      </div>
    </Section>
  );
}

// ====================== Consommation par semaine / mois =====================

function ParPeriode({ d, maintenant, unite, gParVerre }) {
  const [granularite, setGranularite] = useState('semaine');
  const [tableau, setTableau] = useState(false);

  const serie = useMemo(
    () => serieParPeriode(d.consommations, { granularite, nb: NB_BARRES, maintenant, unite, gParVerre }),
    [d.consommations, granularite, maintenant, unite, gParVerre],
  );
  const titres = serie.map((p) => (granularite === 'semaine' ? `Semaine du ${dateCourte(p.debut)}` : majuscule(moisAnnee(p.debut))));
  const etiquettes = serie.map((p) => (granularite === 'semaine' ? jourMois(p.debut) : moisCourt(p.debut)));

  // Trait d'objectif : un objectif actif, sans filtre de catégorie, dans la même unité et la même période.
  const objectif = d.objectifs.find(
    (o) => o.actif && o.unite === unite && o.periode === granularite && o.filtreCategorie === null,
  );

  return (
    <Section titre={granularite === 'semaine' ? 'Par semaine' : 'Par mois'}>
      <Segments
        label="Regrouper"
        valeur={granularite}
        onChange={setGranularite}
        options={[{ valeur: 'semaine', libelle: '12 semaines' }, { valeur: 'mois', libelle: '12 mois' }]}
      />
      <div style={{ marginTop: 14 }}>
        <GraphiqueBarres
          etiquettes={etiquettes}
          titres={titres}
          valeurs={serie.map((p) => p.valeur)}
          formater={(v) => valeurAvecUnite(v, unite)}
          limite={objectif ? { valeur: objectif.limite, texte: `Objectif : ${valeurAvecUnite(objectif.limite, unite)}` } : null}
          description={`Consommation par ${granularite} sur les ${NB_BARRES} dernières périodes, en ${CHOIX_UNITES.find((u) => u.valeur === unite).libelle.toLowerCase()}.`}
        />
      </div>
      <div className="rangee rangee--entre" style={{ marginTop: 6 }}>
        <span className="mini tres-discret">
          {granularite === 'semaine' ? 'Semaines du lundi au dimanche. ' : ''}Barre pâle : période en cours.
        </span>
        <button className="section__lien" onClick={() => setTableau(!tableau)} aria-expanded={tableau}>
          {tableau ? 'Masquer les valeurs' : 'Voir les valeurs'}
        </button>
      </div>
      {tableau && (
        <table className="table-valeurs">
          <thead>
            <tr><th scope="col">Période</th><th scope="col">{CHOIX_UNITES.find((u) => u.valeur === unite).libelle}</th></tr>
          </thead>
          <tbody>
            {[...serie].reverse().map((p, i) => (
              <tr key={p.debut}>
                <td>{titres[serie.length - 1 - i]}</td>
                <td>{valeurAvecUnite(p.valeur, unite)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

// ================= Répartition par catégorie, puis par marque ===============

function Repartition({ d, maintenant, unite, gParVerre }) {
  const [periode, setPeriode] = useState('3mois');
  const [ouverte, setOuverte] = useState(null); // id de la catégorie dépliée

  const debut = {
    mois: debutMois(maintenant),
    '3mois': ajouterMois(debutMois(maintenant), -2),
    '12mois': ajouterMois(debutMois(maintenant), -11),
    tout: 0,
  }[periode];
  const r = useMemo(
    () => repartition(d.consommations.filter((c) => c.horodatage >= debut), { unite, gParVerre }),
    [d.consommations, debut, unite, gParVerre],
  );
  const max = r.categories.length > 0 ? r.categories[0].valeur : 1;
  const couleur = (id) => d.categoriesParId.get(id)?.couleur ?? 'var(--encre-3)';
  const nomCategorie = (id) => d.categoriesParId.get(id)?.nom ?? 'Catégorie supprimée';

  return (
    <Section titre="Répartition par catégorie">
      <select className="choix" aria-label="Période de la répartition" value={periode} onChange={(e) => setPeriode(e.target.value)}>
        {PERIODES_REPARTITION.map((p) => <option key={p.valeur} value={p.valeur}>{p.libelle}</option>)}
      </select>

      {r.categories.length === 0 ? (
        <Vide>
          <p>
            {unite === 'euros' ? 'Aucune consommation avec un prix sur cette période.'
              : unite === 'sucre' ? 'Aucune boisson avec du sucre renseigné sur cette période.'
                : 'Aucune consommation sur cette période.'}
          </p>
        </Vide>
      ) : (
        <div style={{ marginTop: 16 }}>
          {/* Vue d'ensemble : une barre fine découpée par catégorie */}
          <div className="segmentee" role="img" aria-label="Part de chaque catégorie dans le total">
            {r.categories.map((c) => (
              <div key={c.categorieId} className="segmentee__part" style={{ width: `${c.part * 100}%`, background: couleur(c.categorieId) }} />
            ))}
          </div>
          <p className="mini tres-discret" style={{ marginBottom: 4 }}>
            Total : {valeurAvecUnite(r.total, unite)}. Touche une catégorie pour voir le détail par marque.
          </p>

          <ul className="liste">
            {r.categories.map((c) => {
              const depliee = ouverte === c.categorieId;
              return (
                <li key={c.categorieId}>
                  <button className="part" aria-expanded={depliee} onClick={() => setOuverte(depliee ? null : c.categorieId)}>
                    <div className="part__tete">
                      <Pastille couleur={couleur(c.categorieId)} />
                      <span className="part__nom">{nomCategorie(c.categorieId)}</span>
                      <span className="part__valeur">{valeurAvecUnite(c.valeur, unite)}</span>
                      <span className="part__pourcent">{nombre(c.part * 100, 0)} %</span>
                    </div>
                    <div className="part__piste" style={{ width: `${Math.max(1.5, (c.valeur / max) * 100)}%`, background: couleur(c.categorieId) }} />
                  </button>
                  {depliee && (
                    <div style={{ padding: '2px 0 12px 21px' }}>
                      {c.boissons.map((b) => (
                        <div key={b.boissonId} style={{ padding: '6px 0' }}>
                          <div className="part__tete" style={{ marginBottom: 4 }}>
                            <span className="part__nom petit" style={{ fontWeight: 400 }}>{b.nom}</span>
                            <span className="part__valeur petit">{valeurAvecUnite(b.valeur, unite)}</span>
                            <span className="part__pourcent">{nombre(b.part * 100, 0)} %</span>
                          </div>
                          <div className="part__piste" style={{ height: 5, opacity: 0.75, width: `${Math.max(1.5, b.part * 100)}%`, background: couleur(c.categorieId) }} />
                        </div>
                      ))}
                      <p className="mini tres-discret" style={{ marginTop: 4 }}>Parts au sein de la catégorie.</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Section>
  );
}

// =============================== Corrélations ===============================

function Correlations({ d }) {
  const analyse = useMemo(() => analyserCorrelations(d.soirees, d.consommations, d.widmark), [d.soirees, d.consommations, d.widmark]);
  const nuage = useMemo(() => pointsNuage(d.soirees, d.consommations, d.widmark), [d.soirees, d.consommations, d.widmark]);
  const rho = (x) => `${x < 0 ? '−' : ''}${nombre(Math.abs(x), 2, 2)}`;

  return (
    <Section titre="Ce qui va ensemble">
      {analyse.manquantes > 0 ? (
        <p className="discret">
          L'analyse démarre à {MIN_SOIREES} soirées avec un bilan complet (les quatre curseurs et la gueule de bois).
          Tu en as {analyse.nbCompletes} : encore {analyse.manquantes}.
        </p>
      ) : analyse.resultats.length === 0 ? (
        <p className="discret">
          Sur tes {analyse.nbCompletes} soirées avec bilan complet, aucun lien n'atteint |ρ| = 0,3 : rien de marquant pour l'instant.
        </p>
      ) : (
        <ul className="liste">
          {analyse.resultats.map((r) => (
            <li key={`${r.cause}-${r.effet}`} style={{ padding: '12px 0' }}>
              <p className="gras">{r.phrase}</p>
              <p className="petit discret chiffres" style={{ marginTop: 3 }}>
                ρ = {rho(r.rho)}, n = {r.n}{' '}
                <span className="etiquette">{r.solide ? 'lien net' : 'lien fragile, peut être dû au hasard'}</span>
              </p>
            </li>
          ))}
        </ul>
      )}

      <h3 style={{ marginTop: 24, marginBottom: 6 }}>Alcool bu et ressenti, selon le repas</h3>
      {nuage.length >= 3 ? (
        <NuageRessenti
          points={nuage}
          description={`Nuage de ${nuage.length} soirées : grammes d'alcool en horizontal, ressenti de 1 à 10 en vertical, couleur selon la note de repas.`}
        />
      ) : (
        <p className="discret">Ce graphique apparaît à partir de 3 soirées avec le ressenti et le repas notés ({nuage.length} pour l'instant).</p>
      )}

      <p className="mention">
        <strong>À lire avec prudence.</strong> ρ est le coefficient de Spearman : +1 quand deux grandeurs montent ensemble,
        −1 quand l'une monte et l'autre baisse, 0 sans lien. Avec une dizaine de soirées, un lien peut apparaître par hasard,
        d'autant que l'appli en teste une quinzaine à la fois. Et une corrélation n'est pas une cause : deux choses peuvent
        aller ensemble sans que l'une provoque l'autre.
      </p>
    </Section>
  );
}
