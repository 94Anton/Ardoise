// Éditeur de cocktail : une recette = des boissons du dataset, chacune avec
// son volume. Volume total, degré moyen, alcool, calories et sucre sont
// recalculés en direct pendant la saisie.

import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Champ, Entete, FeuilleConfirmation, Section, Vide } from '../composants/base.jsx';
import { Icone } from '../composants/Icone.jsx';
import { FeuilleBoisson } from '../composants/FeuilleBoisson.jsx';
import { useDonnees } from '../contexte/Donnees.jsx';
import { useNotifications } from '../contexte/Notifications.jsx';
import { snapshotCocktail, volumeRecette } from '../calculs/alcool.js';
import { degre, lireNombre, nombre, volume } from '../calculs/format.js';
import { enregistrerCocktail, recalculerPourCocktail, restaurer, supprimerCocktail } from '../donnees/actions.js';

const RETOUR = '/dataset?onglet=cocktails';
const enTexte = (x) => (x === null || x === undefined ? '' : String(x).replace('.', ','));

export default function EditeurCocktail() {
  const d = useDonnees();
  const { id } = useParams();
  const cocktail = id === 'nouveau' ? null : d.cocktailsParId.get(Number(id));
  if (cocktail === undefined) {
    return (
      <>
        <Entete titre="Cocktail introuvable" retour={RETOUR} />
        <p className="discret">Ce cocktail a été supprimé.</p>
      </>
    );
  }
  // `key` : repartir d'un formulaire neuf si l'on passe d'un cocktail à un autre.
  return <Formulaire key={cocktail?.id ?? 'nouveau'} cocktail={cocktail} />;
}

function Formulaire({ cocktail }) {
  const d = useDonnees();
  const naviguer = useNavigate();
  const { afficherToast } = useNotifications();

  // Chaque ligne d'ingrédient garde le texte tel que tapé ; `cle` sert à React.
  const compteur = useRef(0);
  const ligne = (boissonId = '', texte = '') => {
    compteur.current += 1;
    return { cle: compteur.current, boissonId: String(boissonId), texte };
  };
  const [nom, setNom] = useState(cocktail?.nom ?? '');
  const [lignes, setLignes] = useState(() => (cocktail
    ? cocktail.ingredients.map((i) => ligne(i.boissonId, enTexte(i.volumeML / 10)))
    : [ligne(), ligne()]));
  const [favori, setFavori] = useState(cocktail?.favori ?? false);
  const [erreur, setErreur] = useState('');
  const [nouvelleBoisson, setNouvelleBoisson] = useState(false);
  const [confirmation, setConfirmation] = useState(false);

  const majLigne = (cle, modifs) => setLignes((l) => l.map((x) => (x.cle === cle ? { ...x, ...modifs } : x)));

  // Recette lue dans le formulaire : seules les lignes complètes comptent.
  const ingredients = lignes
    .map((l) => ({ boissonId: l.boissonId === '' ? null : Number(l.boissonId), volumeML: (lireNombre(l.texte) ?? 0) * 10 }))
    .filter((i) => i.boissonId !== null && i.volumeML > 0);
  const apercu = snapshotCocktail({ nom, ingredients }, d.boissonsParId);
  const gParVerre = d.parametres.gParVerre;

  const nbUtilisations = cocktail
    ? d.consommations.filter((c) => c.type === 'cocktail' && c.refId === cocktail.id).length
    : 0;

  // Boissons proposées : non archivées, regroupées par catégorie.
  const groupes = d.categories
    .map((c) => ({ categorie: c, boissons: d.boissons.filter((b) => b.categorieId === c.id && !b.archive) }))
    .filter((g) => g.boissons.length > 0);
  const aucuneBoisson = groupes.length === 0;

  async function enregistrer({ recalculer = false } = {}) {
    try {
      const idCocktail = await enregistrerCocktail({ id: cocktail?.id, nom, ingredients, favori, archive: cocktail?.archive ?? false });
      if (recalculer) {
        // Les consommations servies « à la recette » suivent le nouveau volume ;
        // celles saisies avec un autre volume gardent le leur.
        const n = await recalculerPourCocktail(idCocktail, volumeRecette(cocktail));
        afficherToast({ message: `Recette enregistrée, ${n} consommation${n > 1 ? 's' : ''} recalculée${n > 1 ? 's' : ''}.` });
      }
      naviguer(RETOUR, { replace: true });
    } catch (e) {
      setErreur(e.message);
    }
  }

  async function supprimer() {
    const resultat = await supprimerCocktail(cocktail.id);
    afficherToast({
      message: resultat === 'archivee'
        ? `« ${cocktail.nom} » est archivé : il reste dans l'historique mais n'est plus proposé à la saisie.`
        : `« ${cocktail.nom} » est supprimé.`,
    });
    naviguer(RETOUR, { replace: true });
  }

  /** Une boisson vient d'être créée depuis cet écran : elle remplit la première ligne libre. */
  function ajouterBoissonCreee(idBoisson) {
    setLignes((l) => {
      const libre = l.find((x) => x.boissonId === '');
      return libre
        ? l.map((x) => (x.cle === libre.cle ? { ...x, boissonId: String(idBoisson) } : x))
        : [...l, ligne(idBoisson)];
    });
  }

  return (
    <>
      <Entete titre={cocktail ? 'Modifier le cocktail' : 'Nouveau cocktail'} retour={RETOUR} />

      <div className="pile">
        <Champ label="Nom">
          <input className="saisie" type="text" value={nom} placeholder="ex. Mojito" onChange={(e) => setNom(e.target.value)} />
        </Champ>
      </div>

      <Section
        titre="Ingrédients"
        lien={<button className="section__lien" onClick={() => setNouvelleBoisson(true)}>Nouvelle boisson</button>}
      >
        {aucuneBoisson ? (
          <Vide>
            <p>
              Le dataset ne contient encore aucune boisson. Crée d'abord les ingrédients : les alcools, puis les
              diluants (sirop, jus, soda) dans la catégorie « Diluants (sans alcool) ».
            </p>
            <button className="bouton bouton--plein" onClick={() => setNouvelleBoisson(true)}>Créer une boisson</button>
          </Vide>
        ) : (
          <>
            <ul className="liste">
              {lignes.map((l, rang) => {
                const boisson = l.boissonId === '' ? null : d.boissonsParId.get(Number(l.boissonId));
                const volumeML = (lireNombre(l.texte) ?? 0) * 10;
                const composant = boisson && volumeML > 0
                  ? snapshotCocktail({ ingredients: [{ boissonId: boisson.id, volumeML }] }, d.boissonsParId)
                  : null;
                return (
                  <li key={l.cle} className="ingredient">
                    <select
                      className="choix" aria-label={`Ingrédient ${rang + 1}`} value={l.boissonId}
                      onChange={(e) => majLigne(l.cle, { boissonId: e.target.value })}
                    >
                      <option value="">Choisir une boisson…</option>
                      {/* Un ingrédient archivé depuis reste affiché dans sa recette. */}
                      {boisson?.archive && <option value={boisson.id}>{boisson.nom} (archivée)</option>}
                      {groupes.map((g) => (
                        <optgroup key={g.categorie.id} label={g.categorie.nom}>
                          {g.boissons.map((b) => <option key={b.id} value={b.id}>{b.nom} ({degre(b.degre)})</option>)}
                        </optgroup>
                      ))}
                    </select>
                    <div className="rangee">
                      <span className="saisie-suffixe" style={{ width: 124, flex: 'none' }}>
                        <input
                          className="saisie" type="text" inputMode="decimal" autoComplete="off" style={{ paddingRight: 44 }}
                          aria-label={`Volume de l'ingrédient ${rang + 1}, en centilitres`}
                          value={l.texte} placeholder="ex. 4" onChange={(e) => majLigne(l.cle, { texte: e.target.value })}
                        />
                        <span className="saisie-suffixe__unite">cL</span>
                      </span>
                      <span className="grandit petit discret">
                        {composant && (composant.gAlcool > 0 ? `${nombre(composant.gAlcool, 1)} g d'alcool` : 'sans alcool')}
                      </span>
                      <button
                        type="button" className="bouton-icone" aria-label={`Retirer l'ingrédient ${rang + 1}`}
                        onClick={() => setLignes((liste) => liste.filter((x) => x.cle !== l.cle))}
                      >
                        <Icone nom="corbeille" taille={22} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <button className="bouton bouton--large" style={{ marginTop: 12 }} onClick={() => setLignes((l) => [...l, ligne()])}>
              <Icone nom="plus" taille={20} /> Ajouter un ingrédient
            </button>
          </>
        )}
      </Section>

      <Section titre="Ce que donne la recette">
        {ingredients.length === 0 ? (
          <p className="discret">Choisis au moins une boisson et son volume : les valeurs s'affichent ici au fur et à mesure.</p>
        ) : (
          <div aria-live="polite">
            <LigneValeur libelle="Volume total" valeur={volume(apercu.volumeML)} />
            <LigneValeur libelle="Degré moyen" valeur={degre(apercu.degre)} />
            <LigneValeur
              libelle="Alcool pur"
              valeur={`${nombre(apercu.gAlcool, 1)} g, soit ${nombre(apercu.gAlcool / gParVerre, 1)} verre${apercu.gAlcool / gParVerre >= 2 ? 's' : ''} standard`}
            />
            <LigneValeur
              libelle="Calories"
              valeur={`${nombre(apercu.kcal, 0)} kcal${apercu.kcalEstimee ? ' au moins' : ''}`}
            />
            <LigneValeur
              libelle="Sucre"
              valeur={apercu.sucreG === null ? 'non renseigné' : `${nombre(apercu.sucreG, 1)} g${apercu.sucreIncomplet ? ' au moins' : ''}`}
            />
            {(apercu.kcalEstimee || apercu.sucreIncomplet) && (
              <p className="mini tres-discret" style={{ marginTop: 8 }}>
                « Au moins » : un ingrédient n'a pas ses calories ou son sucre renseignés. Sans calories, seul son alcool
                est compté ; sans sucre, il est exclu du total.
              </p>
            )}
          </div>
        )}
      </Section>

      <Section>
        <div className="pile">
          <label className="case">
            <input type="checkbox" checked={favori} onChange={(e) => setFavori(e.target.checked)} />
            <span>Favori (proposé en haut de la saisie)</span>
          </label>
          {erreur && <p className="champ__erreur" role="alert">{erreur}</p>}
          <button className="bouton bouton--plein bouton--large" onClick={() => enregistrer()}>
            {cocktail ? 'Enregistrer' : 'Créer le cocktail'}
          </button>
          {nbUtilisations > 0 && (
            <>
              <button className="bouton bouton--large" onClick={() => enregistrer({ recalculer: true })}>
                Enregistrer et recalculer {nbUtilisations} consommation{nbUtilisations > 1 ? 's' : ''} passée{nbUtilisations > 1 ? 's' : ''}
              </button>
              <p className="champ__aide">
                Par défaut, modifier la recette ne change pas les consommations déjà saisies : chacune garde les valeurs
                du jour où elle a été notée.
              </p>
            </>
          )}
          {cocktail && (cocktail.archive ? (
            <button className="bouton bouton--large" onClick={async () => { await restaurer('cocktails', cocktail.id); naviguer(RETOUR, { replace: true }); }}>
              Sortir des archives
            </button>
          ) : (
            <button className="bouton bouton--large bouton--danger" onClick={() => (nbUtilisations > 0 ? supprimer() : setConfirmation(true))}>
              {nbUtilisations > 0 ? 'Archiver le cocktail' : 'Supprimer le cocktail'}
            </button>
          ))}
        </div>
      </Section>

      {nouvelleBoisson && <FeuilleBoisson onFermer={() => setNouvelleBoisson(false)} onEnregistre={ajouterBoissonCreee} />}

      {confirmation && (
        <FeuilleConfirmation titre="Supprimer ce cocktail ?" onFermer={() => setConfirmation(false)} onConfirmer={supprimer}>
          <p>La recette de « {cocktail.nom} » sera effacée. Les boissons qui la composent restent dans le dataset.</p>
        </FeuilleConfirmation>
      )}
    </>
  );
}

function LigneValeur({ libelle, valeur }) {
  return (
    <div className="note-ligne">
      <span className="discret">{libelle}</span>
      <span className="gras chiffres" style={{ textAlign: 'right' }}>{valeur}</span>
    </div>
  );
}
