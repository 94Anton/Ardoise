// Dataset : les boissons (marques), les cocktails, les contenants et les
// catégories. Tout se crée, se modifie et se supprime ici.

import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Champ, ChampNombre, Entete, Feuille, Pastille, Vide } from '../composants/base.jsx';
import { Icone } from '../composants/Icone.jsx';
import { FeuilleBoisson } from '../composants/FeuilleBoisson.jsx';
import { useDonnees } from '../contexte/Donnees.jsx';
import { useNotifications } from '../contexte/Notifications.jsx';
import { snapshotCocktail } from '../calculs/alcool.js';
import { degre, lireNombre, nombre, volume } from '../calculs/format.js';
import {
  enregistrerCategorie, enregistrerContenant, supprimerCategorie, supprimerContenant,
} from '../donnees/actions.js';

const ONGLETS = [
  { valeur: 'boissons', libelle: 'Boissons' },
  { valeur: 'cocktails', libelle: 'Cocktails' },
  { valeur: 'contenants', libelle: 'Contenants' },
  { valeur: 'categories', libelle: 'Catégories' },
];

const normaliser = (texte) => texte.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function Dataset() {
  const [parametresUrl, setParametresUrl] = useSearchParams();
  const onglet = ONGLETS.some((o) => o.valeur === parametresUrl.get('onglet')) ? parametresUrl.get('onglet') : 'boissons';

  return (
    <>
      <Entete titre="Dataset" retour="/plus" />
      <div className="puces puces--defilent" role="group" aria-label="Partie du dataset" style={{ marginBottom: 22 }}>
        {ONGLETS.map((o) => (
          <button
            key={o.valeur} className="puce" aria-pressed={onglet === o.valeur}
            onClick={() => setParametresUrl({ onglet: o.valeur }, { replace: true })}
          >
            {o.libelle}
          </button>
        ))}
      </div>
      {onglet === 'boissons' && <OngletBoissons />}
      {onglet === 'cocktails' && <OngletCocktails />}
      {onglet === 'contenants' && <OngletContenants />}
      {onglet === 'categories' && <OngletCategories />}
    </>
  );
}

// ================================ Boissons =================================

function OngletBoissons() {
  const d = useDonnees();
  const [recherche, setRecherche] = useState('');
  const [archives, setArchives] = useState(false);
  const [feuille, setFeuille] = useState(null); // 'nouvelle' ou id de la boisson ouverte

  const texte = normaliser(recherche.trim());
  const nbArchivees = d.boissons.filter((b) => b.archive).length;
  const visibles = d.boissons.filter((b) => (archives || !b.archive) && (!texte || normaliser(b.nom).includes(texte)));
  const groupes = d.categories
    .map((c) => ({ categorie: c, boissons: visibles.filter((b) => b.categorieId === c.id) }))
    .filter((g) => g.boissons.length > 0);
  const boissonOuverte = typeof feuille === 'number' ? d.boissonsParId.get(feuille) : null;

  return (
    <>
      <button className="bouton bouton--plein bouton--large" onClick={() => setFeuille('nouvelle')}>Nouvelle boisson</button>

      {d.boissons.length === 0 ? (
        <Vide>
          <p>
            Le dataset démarre vide : c'est toi qui le construis, boisson par boisson. Pour chacune, le nom, la catégorie
            et le degré suffisent ; calories, sucre et prix sont facultatifs.
          </p>
        </Vide>
      ) : (
        <>
          <div className="recherche" style={{ marginTop: 14 }}>
            <Icone nom="recherche" taille={20} />
            <input
              className="saisie" type="search" value={recherche} placeholder="Chercher une boisson"
              aria-label="Chercher une boisson" onChange={(e) => setRecherche(e.target.value)}
            />
          </div>

          {groupes.length === 0 && <Vide><p>Aucune boisson ne correspond à « {recherche.trim()} ».</p></Vide>}

          {groupes.map(({ categorie, boissons }) => (
            <section key={categorie.id}>
              <div className="jour-tete">
                <h2 className="rangee" style={{ fontSize: 17, gap: 8 }}><Pastille couleur={categorie.couleur} /> {categorie.nom}</h2>
                <span className="discret" style={{ fontWeight: 400 }}>{boissons.length}</span>
              </div>
              <ul className="liste">
                {boissons.map((b) => (
                  <li key={b.id}>
                    <button className={`ligne${b.archive ? ' ligne--archive' : ''}`} onClick={() => setFeuille(b.id)}>
                      <span className="ligne__corps">
                        <span className="ligne__titre" style={{ display: 'block' }}>
                          {b.nom} {b.archive && <span className="etiquette">archivée</span>}
                        </span>
                        <span className="ligne__detail">
                          {degre(b.degre)}
                          {b.kcalParL !== null && `, ${nombre(b.kcalParL, 0)} kcal/L`}
                          {b.sucreGParL !== null && `, ${nombre(b.sucreGParL, 1)} g/L de sucre`}
                        </span>
                      </span>
                      {b.favori && <Icone nom="etoile" plein taille={18} style={{ flex: 'none' }} aria-label="Favori" aria-hidden={false} role="img" />}
                      <Icone nom="chevron" taille={20} style={{ color: 'var(--encre-3)', flex: 'none' }} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {nbArchivees > 0 && (
            <label className="case" style={{ marginTop: 18 }}>
              <input type="checkbox" checked={archives} onChange={(e) => setArchives(e.target.checked)} />
              <span>Afficher les boissons archivées ({nbArchivees})</span>
            </label>
          )}
        </>
      )}

      {feuille === 'nouvelle' && <FeuilleBoisson nomInitial={recherche.trim()} onFermer={() => setFeuille(null)} />}
      {boissonOuverte && <FeuilleBoisson key={boissonOuverte.id} boisson={boissonOuverte} onFermer={() => setFeuille(null)} />}
    </>
  );
}

// ================================ Cocktails ================================

function OngletCocktails() {
  const d = useDonnees();
  return (
    <>
      <Link className="bouton bouton--plein bouton--large" to="/dataset/cocktail/nouveau">Nouveau cocktail</Link>
      {d.cocktails.length === 0 ? (
        <Vide>
          <p>
            Un cocktail est une recette : des boissons du dataset, chacune avec son volume. L'appli en déduit le
            degré moyen, l'alcool, les calories et le sucre. Crée d'abord les alcools et les diluants (sirop, jus,
            soda) dans l'onglet Boissons.
          </p>
        </Vide>
      ) : (
        <ul className="liste" style={{ marginTop: 18 }}>
          {d.cocktails.map((c) => {
            const s = snapshotCocktail(c, d.boissonsParId);
            return (
              <li key={c.id}>
                <Link className={`ligne${c.archive ? ' ligne--archive' : ''}`} to={`/dataset/cocktail/${c.id}`}>
                  <span className="ligne__corps">
                    <span className="ligne__titre" style={{ display: 'block' }}>
                      {c.nom} {c.archive && <span className="etiquette">archivé</span>}
                    </span>
                    <span className="ligne__detail">
                      {volume(s.volumeML)} à {degre(s.degre)}, {c.ingredients.length} ingrédient{c.ingredients.length > 1 ? 's' : ''}
                    </span>
                  </span>
                  {c.favori && <Icone nom="etoile" plein taille={18} style={{ flex: 'none' }} />}
                  <Icone nom="chevron" taille={20} style={{ color: 'var(--encre-3)', flex: 'none' }} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

// ================================ Contenants ===============================

function OngletContenants() {
  const d = useDonnees();
  const [feuille, setFeuille] = useState(null); // 'nouveau' ou id
  const ouvert = typeof feuille === 'number' ? d.contenantsParId.get(feuille) : null;
  return (
    <>
      <button className="bouton bouton--plein bouton--large" onClick={() => setFeuille('nouveau')}>Nouveau contenant</button>
      <ul className="liste" style={{ marginTop: 18 }}>
        {d.contenants.map((c) => (
          <li key={c.id}>
            <button className="ligne" onClick={() => setFeuille(c.id)}>
              <span className="ligne__corps"><span className="ligne__titre">{c.nom}</span></span>
              <span className="ligne__valeur">{volume(c.volumeML)}</span>
              <Icone nom="chevron" taille={20} style={{ color: 'var(--encre-3)', flex: 'none' }} />
            </button>
          </li>
        ))}
      </ul>
      <p className="champ__aide" style={{ marginTop: 12 }}>À la saisie, un volume libre reste toujours possible.</p>
      {feuille === 'nouveau' && <FeuilleContenant onFermer={() => setFeuille(null)} />}
      {ouvert && <FeuilleContenant key={ouvert.id} contenant={ouvert} onFermer={() => setFeuille(null)} />}
    </>
  );
}

function FeuilleContenant({ contenant = null, onFermer }) {
  const [nom, setNom] = useState(contenant?.nom ?? '');
  const [volumeCL, setVolumeCL] = useState(contenant ? String(contenant.volumeML / 10).replace('.', ',') : '');
  const [erreur, setErreur] = useState('');

  async function enregistrer() {
    try {
      const v = lireNombre(volumeCL);
      await enregistrerContenant({ id: contenant?.id, nom, volumeML: v === null ? null : v * 10, predefini: contenant?.predefini });
      onFermer();
    } catch (e) {
      setErreur(e.message);
    }
  }

  return (
    <Feuille titre={contenant ? 'Modifier le contenant' : 'Nouveau contenant'} onFermer={onFermer}>
      <div className="pile">
        <Champ label="Nom">
          <input className="saisie" type="text" value={nom} placeholder="ex. Chope" autoFocus={!contenant} onChange={(e) => setNom(e.target.value)} />
        </Champ>
        <ChampNombre label="Volume" unite="cL" valeur={volumeCL} onChange={setVolumeCL} placeholder="ex. 40" aide="1 cL = 10 mL. Une pinte fait 50 cL." />
        {erreur && <p className="champ__erreur" role="alert">{erreur}</p>}
      </div>
      <div className="feuille__pied">
        <button className="bouton bouton--plein" onClick={enregistrer}>{contenant ? 'Enregistrer' : 'Créer le contenant'}</button>
      </div>
      {contenant && (
        <div className="pile" style={{ marginTop: 22 }}>
          <button className="bouton bouton--large bouton--danger" onClick={async () => { await supprimerContenant(contenant.id); onFermer(); }}>
            Supprimer le contenant
          </button>
          <p className="champ__aide">Les consommations déjà saisies gardent leur volume.</p>
        </div>
      )}
    </Feuille>
  );
}

// ================================ Catégories ===============================

function OngletCategories() {
  const d = useDonnees();
  const [feuille, setFeuille] = useState(null); // 'nouvelle' ou id
  const ouverte = typeof feuille === 'number' ? d.categoriesParId.get(feuille) : null;
  return (
    <>
      <button className="bouton bouton--plein bouton--large" onClick={() => setFeuille('nouvelle')}>Nouvelle catégorie</button>
      <ul className="liste" style={{ marginTop: 18 }}>
        {d.categories.map((c) => {
          const n = d.boissons.filter((b) => b.categorieId === c.id).length;
          return (
            <li key={c.id}>
              <button className="ligne" onClick={() => setFeuille(c.id)}>
                <Pastille couleur={c.couleur} />
                <span className="ligne__corps">
                  <span className="ligne__titre" style={{ display: 'block' }}>{c.nom}</span>
                  <span className="ligne__detail">
                    {n === 0 ? 'Aucune boisson' : `${n} boisson${n > 1 ? 's' : ''}`}{!c.alcoolisee && ', sans alcool'}
                  </span>
                </span>
                <Icone nom="chevron" taille={20} style={{ color: 'var(--encre-3)', flex: 'none' }} />
              </button>
            </li>
          );
        })}
      </ul>
      {feuille === 'nouvelle' && <FeuilleCategorie onFermer={() => setFeuille(null)} />}
      {ouverte && <FeuilleCategorie key={ouverte.id} categorie={ouverte} onFermer={() => setFeuille(null)} />}
    </>
  );
}

function FeuilleCategorie({ categorie = null, onFermer }) {
  const { afficherToast } = useNotifications();
  const [nom, setNom] = useState(categorie?.nom ?? '');
  const [couleur, setCouleur] = useState(categorie?.couleur ?? '#7d8a96');
  const [alcoolisee, setAlcoolisee] = useState(categorie?.alcoolisee ?? true);
  const [erreur, setErreur] = useState('');

  async function enregistrer() {
    try {
      await enregistrerCategorie({ id: categorie?.id, nom, couleur, alcoolisee });
      onFermer();
    } catch (e) {
      setErreur(e.message);
    }
  }

  async function supprimer() {
    try {
      await supprimerCategorie(categorie.id);
      afficherToast({ message: `Catégorie « ${categorie.nom} » supprimée.` });
      onFermer();
    } catch (e) {
      setErreur(e.message);
    }
  }

  return (
    <Feuille titre={categorie ? 'Modifier la catégorie' : 'Nouvelle catégorie'} onFermer={onFermer}>
      <div className="pile">
        <div className="rangee rangee--haut">
          <div className="grandit">
            <Champ label="Nom">
              <input className="saisie" type="text" value={nom} placeholder="ex. Saké" autoFocus={!categorie} onChange={(e) => setNom(e.target.value)} />
            </Champ>
          </div>
          <Champ label="Couleur">
            <input className="couleur-choix" type="color" value={couleur} onChange={(e) => setCouleur(e.target.value)} />
          </Champ>
        </div>
        <label className="case">
          <input type="checkbox" checked={alcoolisee} onChange={(e) => setAlcoolisee(e.target.checked)} />
          <span>Contient de l'alcool (décoche pour des diluants : sirops, jus, sodas)</span>
        </label>
        {erreur && <p className="champ__erreur" role="alert">{erreur}</p>}
      </div>
      <div className="feuille__pied">
        <button className="bouton bouton--plein" onClick={enregistrer}>{categorie ? 'Enregistrer' : 'Créer la catégorie'}</button>
      </div>
      {categorie && (
        <div className="pile" style={{ marginTop: 22 }}>
          <button className="bouton bouton--large bouton--danger" onClick={supprimer}>Supprimer la catégorie</button>
        </div>
      )}
    </Feuille>
  );
}
