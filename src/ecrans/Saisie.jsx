// Écran de saisie : ajouter une consommation, maintenant ou après coup.
//
// En haut : « Quand ? ». Ce réglage vaut pour toutes les façons d'ajouter
// (favoris, récents, liste complète). En mode « Maintenant », un ajout ramène
// à l'accueil ; en mode « Autre moment », on reste ici pour enchaîner les
// saisies d'une soirée passée.

import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Champ, Pastille, Section, Segments, Vide } from '../composants/base.jsx';
import { Icone } from '../composants/Icone.jsx';
import { FeuilleAjout } from '../composants/FeuillesConsommation.jsx';
import { FeuilleBoisson } from '../composants/FeuilleBoisson.jsx';
import { useDonnees } from '../contexte/Donnees.jsx';
import { libelleConsommation, useAjout, useMaintenant } from '../utilitaires/crochets.js';
import { volumeRecette } from '../calculs/alcool.js';
import { dateCourte, degre, depuisChampDateHeure, heure, versChampDateHeure, volume } from '../calculs/format.js';
import { combinaisonsRecentes, derniereConsommationDe, nomContenant } from '../donnees/selecteurs.js';
import { basculerFavori, demarrerSoiree } from '../donnees/actions.js';

const normaliser = (texte) => texte.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function Saisie() {
  const d = useDonnees();
  const naviguer = useNavigate();
  const [parametresUrl] = useSearchParams();
  const maintenant = useMaintenant();
  const { ajouter, reprendre } = useAjout();

  // Arrivée depuis la page d'une soirée (« Ajouter à cette soirée »).
  const soireeCible = d.soireesParId.get(Number(parametresUrl.get('soiree'))) ?? null;
  const cibleTerminee = soireeCible !== null && soireeCible.fin !== null;

  // ----------------------------- Quand ? ---------------------------------
  const [mode, setMode] = useState(cibleTerminee ? 'autre' : 'maintenant');
  const [dateHeure, setDateHeure] = useState(() => versChampDateHeure(cibleTerminee ? soireeCible.fin : Date.now()));
  const [choixSoiree, setChoixSoiree] = useState(cibleTerminee ? String(soireeCible.id) : 'aucune');
  const [titreNouvelle, setTitreNouvelle] = useState('');
  const [erreurQuand, setErreurQuand] = useState('');

  // --------------------------- Recherche ---------------------------------
  const [recherche, setRecherche] = useState('');
  const [filtre, setFiltre] = useState('tout'); // 'tout' | 'cocktails' | id de catégorie

  // ---------------------------- Feuilles ---------------------------------
  const [detail, setDetail] = useState(null); // { type, id } de la boisson ou du cocktail ouvert
  const [nouvelleBoisson, setNouvelleBoisson] = useState(false);

  /** Date, heure et soirée à appliquer à l'ajout, ou null si « Quand ? » est incomplet. */
  function contexteAjout() {
    if (mode === 'maintenant') {
      return { soireeId: d.soireeEnCours ? d.soireeEnCours.id : null };
    }
    const horodatage = depuisChampDateHeure(dateHeure);
    if (horodatage === null) {
      setErreurQuand('Indique la date et l\'heure de la consommation.');
      return null;
    }
    if (horodatage > Date.now() + 5 * 60 * 1000) {
      setErreurQuand('Cette date est dans le futur.');
      return null;
    }
    setErreurQuand('');
    if (choixSoiree === 'nouvelle') {
      return { horodatage, nouvelleSoiree: { titre: titreNouvelle.trim() || `Soirée du ${dateCourte(horodatage)}` } };
    }
    return { horodatage, soireeId: choixSoiree === 'aucune' ? null : Number(choixSoiree) };
  }

  /** Ajoute, puis revient à l'accueil (maintenant) ou reste ici (autre moment). */
  async function valider(saisie, libelle) {
    const contexte = contexteAjout();
    if (contexte === null) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const resultat = await ajouter({ ...saisie, ...contexte }, libelle);
    if (!resultat) return;
    setDetail(null);
    if (mode === 'maintenant') {
      naviguer(soireeCible ? `/soiree/${soireeCible.id}` : '/');
    } else if (resultat.soireeCreeeId !== null) {
      // La soirée vient d'être créée : les saisies suivantes s'y rattachent.
      setChoixSoiree(String(resultat.soireeCreeeId));
      setTitreNouvelle('');
    }
  }

  // ------------------------ Favoris et récents ----------------------------
  const raccourcis = useMemo(() => {
    const favoris = [
      ...d.boissons.filter((b) => b.favori && !b.archive).map((b) => ({ type: 'boisson', reference: b })),
      ...d.cocktails.filter((c) => c.favori && !c.archive).map((c) => ({ type: 'cocktail', reference: c })),
    ].map(({ type, reference }) => {
      // Un favori reprend le contenant de sa dernière consommation.
      const derniere = derniereConsommationDe(d.consommations, type, reference.id);
      const volumeML = derniere ? derniere.volumeML : type === 'cocktail' ? volumeRecette(reference) : null;
      return {
        cle: `${type}:${reference.id}:${derniere?.contenantId ?? 'libre'}:${volumeML}`,
        type, reference, volumeML,
        contenantId: derniere ? derniere.contenantId : null,
        prixEuros: derniere ? derniere.prixEuros : null,
      };
    });
    const clesFavoris = new Set(favoris.map((f) => f.cle));
    const recents = combinaisonsRecentes(d.consommations, d, 6 + favoris.length)
      .filter((r) => !clesFavoris.has(r.cle))
      .slice(0, 6)
      .map((r) => {
        const reference = r.type === 'cocktail' ? d.cocktailsParId.get(r.refId) : d.boissonsParId.get(r.refId);
        const derniere = d.consommations.find((c) => c.type === r.type && c.refId === r.refId && c.volumeML === r.volumeML);
        return { ...r, reference, prixEuros: derniere?.prixEuros ?? null };
      });
    return { favoris, recents };
  }, [d]);

  /** Un tap sur un raccourci : ajout immédiat (ou feuille de détail si le volume est inconnu). */
  function ajouterRaccourci(r) {
    if (r.volumeML === null) {
      setDetail({ type: r.type, id: r.reference.id });
      return;
    }
    const contenant = r.contenantId !== null ? d.contenantsParId.get(r.contenantId)?.nom ?? null : null;
    valider(
      { type: r.type, refId: r.reference.id, contenantId: r.contenantId, volumeML: r.volumeML, quantite: 1, prixEuros: r.prixEuros },
      libelleConsommation(r.reference.nom, contenant, r.volumeML),
    );
  }

  const detailRaccourci = (r) => {
    if (r.volumeML === null) return 'Choisir le contenant';
    const contenant = r.contenantId !== null ? d.contenantsParId.get(r.contenantId)?.nom : null;
    return contenant ? `${contenant}, ${volume(r.volumeML)}` : volume(r.volumeML);
  };

  // -------------------------- Liste complète ------------------------------
  const texte = normaliser(recherche.trim());
  const boissonsVisibles = d.boissons.filter((b) => {
    if (b.archive) return false;
    if (filtre === 'cocktails') return false;
    if (typeof filtre === 'number' && b.categorieId !== filtre) return false;
    if (texte && !normaliser(b.nom).includes(texte)) return false;
    // Les diluants n'apparaissent que si on les cherche ou qu'on filtre dessus.
    if (!texte && filtre === 'tout' && d.categoriesParId.get(b.categorieId)?.alcoolisee === false) return false;
    return true;
  });
  const cocktailsVisibles = d.cocktails.filter((c) => {
    if (c.archive) return false;
    if (typeof filtre === 'number') return false;
    return !texte || normaliser(c.nom).includes(texte);
  });
  const categoriesUtilisees = d.categories.filter((c) => d.boissons.some((b) => b.categorieId === c.id && !b.archive));
  const datasetVide = d.boissons.every((b) => b.archive) && d.cocktails.every((c) => c.archive);

  // Boisson ou cocktail ouvert dans la feuille de détail. Juste après une
  // création, il faut attendre que les données se rechargent : d'ici là, rien ne s'affiche.
  const referenceDetail = detail === null ? null
    : (detail.type === 'cocktail' ? d.cocktailsParId.get(detail.id) : d.boissonsParId.get(detail.id)) ?? null;

  const derniere = d.consommations[0] ?? null;
  const libelleDerniere = derniere
    ? libelleConsommation(derniere.snapshot.nom, nomContenant(derniere, d.contenantsParId), derniere.volumeML, derniere.quantite)
    : null;

  return (
    <>
      <header className="entete">
        <div className="entete__texte grandit">
          <h1>Ajouter</h1>
        </div>
        <button className="bouton-icone bouton-icone--fond" onClick={() => naviguer(soireeCible ? `/soiree/${soireeCible.id}` : '/')} aria-label="Fermer">
          <Icone nom="fermer" />
        </button>
      </header>

      {/* ------------------------------ Quand ? ------------------------------ */}
      <div className="pile">
        <Segments
          label="Quand ?"
          valeur={mode}
          onChange={setMode}
          options={[{ valeur: 'maintenant', libelle: 'Maintenant' }, { valeur: 'autre', libelle: 'Autre moment' }]}
        />
        {mode === 'maintenant' ? (
          <div className="rangee rangee--entre">
            <p className="petit discret">
              {d.soireeEnCours
                ? `Rattaché à la soirée « ${d.soireeEnCours.titre} », à ${heure(maintenant)}.`
                : `Hors soirée, à ${heure(maintenant)}.`}
            </p>
            {!d.soireeEnCours && (
              <button className="section__lien" onClick={() => demarrerSoiree(`Soirée du ${dateCourte(Date.now())}`)}>
                Démarrer une soirée
              </button>
            )}
          </div>
        ) : (
          <div className="pile">
            <Champ label="Date et heure" erreur={erreurQuand}>
              <input className="saisie" type="datetime-local" value={dateHeure} onChange={(e) => setDateHeure(e.target.value)} />
            </Champ>
            <Champ label="Soirée">
              <select className="choix" value={choixSoiree} onChange={(e) => setChoixSoiree(e.target.value)}>
                <option value="aucune">Aucune soirée</option>
                <option value="nouvelle">Nouvelle soirée…</option>
                {d.soirees.slice(0, 30).map((s) => (
                  <option key={s.id} value={s.id}>{s.titre} ({dateCourte(s.debut)})</option>
                ))}
              </select>
            </Champ>
            {choixSoiree === 'nouvelle' && (
              <Champ label="Titre de la soirée" aide="Elle sera créée avec la première consommation ajoutée.">
                <input
                  className="saisie" type="text" value={titreNouvelle} placeholder="ex. Anniv de Paul"
                  onChange={(e) => setTitreNouvelle(e.target.value)}
                />
              </Champ>
            )}
          </div>
        )}
      </div>

      {/* ---------------------------- Raccourcis ---------------------------- */}
      {mode === 'maintenant' && derniere && (
        <Section>
          <button className="bouton bouton--large bouton--gauche" onClick={async () => { if (await reprendre(libelleDerniere)) naviguer('/'); }}>
            <Icone nom="reprise" style={{ flex: 'none' }} />
            <span>
              Reprendre le même
              <span className="ligne__detail" style={{ display: 'block', fontWeight: 400 }}>{libelleDerniere}</span>
            </span>
          </button>
        </Section>
      )}

      {raccourcis.favoris.length > 0 && (
        <Section titre="Favoris">
          <div className="grille-2">
            {raccourcis.favoris.map((r) => (
              <button key={r.cle} className="raccourci" onClick={() => ajouterRaccourci(r)}>
                <span className="raccourci__nom">{r.reference.nom}</span>
                <span className="raccourci__detail">{detailRaccourci(r)}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {raccourcis.recents.length > 0 && (
        <Section titre="Récents">
          <div className="grille-2">
            {raccourcis.recents.map((r) => (
              <button key={r.cle} className="raccourci" onClick={() => ajouterRaccourci(r)}>
                <span className="raccourci__nom">{r.reference.nom}</span>
                <span className="raccourci__detail">{detailRaccourci(r)}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* ------------------------- Toutes les boissons ---------------------- */}
      <Section
        titre="Toutes les boissons"
        lien={!datasetVide && <button className="section__lien" onClick={() => setNouvelleBoisson(true)}>Nouvelle boisson</button>}
      >
        {datasetVide ? (
          <Vide>
            <p>Ton dataset est vide. Crée ta première boisson : son nom, sa catégorie et son degré suffisent.</p>
            <button className="bouton bouton--plein" onClick={() => setNouvelleBoisson(true)}>Créer une boisson</button>
          </Vide>
        ) : (
          <div className="pile">
            <div className="recherche">
              <Icone nom="recherche" taille={20} />
              <input
                className="saisie" type="search" value={recherche} placeholder="Chercher une boisson"
                aria-label="Chercher une boisson" onChange={(e) => setRecherche(e.target.value)}
              />
            </div>
            <div className="puces puces--defilent" role="group" aria-label="Filtrer par catégorie">
              <button className="puce" aria-pressed={filtre === 'tout'} onClick={() => setFiltre('tout')}>Tout</button>
              {d.cocktails.some((c) => !c.archive) && (
                <button className="puce" aria-pressed={filtre === 'cocktails'} onClick={() => setFiltre('cocktails')}>Cocktails</button>
              )}
              {categoriesUtilisees.map((c) => (
                <button key={c.id} className="puce" aria-pressed={filtre === c.id} onClick={() => setFiltre(c.id)}>
                  <Pastille couleur={c.couleur} /> {c.nom}
                </button>
              ))}
            </div>

            {boissonsVisibles.length + cocktailsVisibles.length === 0 ? (
              <Vide>
                <p>Aucune boisson ne correspond{recherche.trim() ? ` à « ${recherche.trim()} »` : ''}.</p>
                <button className="bouton bouton--plein" onClick={() => setNouvelleBoisson(true)}>
                  Créer {recherche.trim() ? `« ${recherche.trim()} »` : 'une boisson'}
                </button>
              </Vide>
            ) : (
              <ul className="liste">
                {cocktailsVisibles.map((c) => (
                  <li key={`c${c.id}`} className="rangee">
                    <button className="ligne" onClick={() => setDetail({ type: 'cocktail', id: c.id })}>
                      <span className="ligne__corps">
                        <span className="ligne__titre" style={{ display: 'block' }}>{c.nom}</span>
                        <span className="ligne__detail">Cocktail, {volume(volumeRecette(c))}</span>
                      </span>
                    </button>
                    <BoutonFavori actif={c.favori} onClick={() => basculerFavori('cocktails', c.id, !c.favori)} />
                  </li>
                ))}
                {boissonsVisibles.map((b) => {
                  const categorie = d.categoriesParId.get(b.categorieId);
                  return (
                    <li key={`b${b.id}`} className="rangee">
                      <button className="ligne" onClick={() => setDetail({ type: 'boisson', id: b.id })}>
                        <Pastille couleur={categorie?.couleur} />
                        <span className="ligne__corps">
                          <span className="ligne__titre" style={{ display: 'block' }}>{b.nom}</span>
                          <span className="ligne__detail">{categorie?.nom ?? 'Sans catégorie'}, {degre(b.degre)}</span>
                        </span>
                      </button>
                      <BoutonFavori actif={b.favori} onClick={() => basculerFavori('boissons', b.id, !b.favori)} />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </Section>

      {referenceDetail && (
        <FeuilleAjout
          key={`${detail.type}:${detail.id}`}
          type={detail.type}
          reference={referenceDetail}
          onFermer={() => setDetail(null)}
          onValider={valider}
        />
      )}

      {nouvelleBoisson && (
        <FeuilleBoisson
          nomInitial={recherche.trim()}
          categorieInitiale={typeof filtre === 'number' ? filtre : null}
          onFermer={() => setNouvelleBoisson(false)}
          // La boisson créée s'ouvre aussitôt pour être ajoutée, sans quitter l'écran.
          onEnregistre={(id) => setDetail({ type: 'boisson', id })}
        />
      )}
    </>
  );
}

function BoutonFavori({ actif, onClick }) {
  return (
    <button className="bouton-icone" onClick={onClick} aria-pressed={actif} aria-label={actif ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
      <Icone nom="etoile" plein={actif} style={{ color: actif ? 'var(--encre)' : 'var(--encre-3)' }} />
    </button>
  );
}
