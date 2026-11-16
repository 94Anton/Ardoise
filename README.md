# Ardoise

Appli web installable sur téléphone (PWA) pour suivre sa propre consommation d'alcool : saisie en un ou deux taps, dataset de boissons construit par l'utilisateur, objectifs à ne pas dépasser, soirées avec bilan, estimation d'alcoolémie, graphiques et corrélations.

Tout est stocké **sur le téléphone** (IndexedDB). Il n'y a pas de serveur, pas de compte, pas d'outil de suivi : rien n'est envoyé sur Internet.

- [Démarrer en local](#démarrer-en-local)
- [Mettre en ligne sur GitHub Pages](#mettre-en-ligne-sur-github-pages)
- [Installer sur l'iPhone](#installer-sur-liphone)
- [Sauvegarde et analyse en Python](#sauvegarde-et-analyse-en-python)
- [Données de démonstration](#données-de-démonstration)
- [Structure du code](#structure-du-code)
- [Schéma de la base](#schéma-de-la-base)
- [Calculs](#calculs)
- [Choix faits là où le cahier des charges laissait une marge](#choix-faits-là-où-le-cahier-des-charges-laissait-une-marge)
- [Ce qui a été vérifié, et ce qui reste à vérifier sur ton iPhone](#ce-qui-a-été-vérifié-et-ce-qui-reste-à-vérifier-sur-ton-iphone)

## Démarrer en local

Il faut [Node.js](https://nodejs.org) 20.19 ou plus récent (22 conseillé).

```bash
npm install        # installe les bibliothèques (une seule fois)
npm run dev        # lance l'appli sur http://localhost:5173, rechargée à chaque modification
npm test           # lance les tests des calculs et de la base
npm run build      # construit la version de production dans dist/
npm run preview    # sert dist/ sur http://localhost:4173, comme en production
```

Pour qui vient de Python ou du C++ : `package.json` joue le rôle d'un `requirements.txt`, `npm install` celui de `pip install -r`, et `npm run build` celui d'une compilation. Les fichiers `.jsx` sont du JavaScript dans lequel on écrit l'interface comme du HTML.

## Mettre en ligne sur GitHub Pages

Une PWA doit être servie en HTTPS pour être installable : GitHub Pages le fait gratuitement.

1. Sur GitHub, crée un dépôt vide, par exemple `ardoise`. Avec un compte gratuit, le dépôt doit être **public** pour utiliser Pages (avec GitHub Pro, offert aux étudiants, il peut être privé). Seul le code est publié : tes données restent sur ton téléphone.
2. Envoie le code :

   ```bash
   git init
   git add .
   git commit -m "Ardoise 1.0"
   git branch -M main
   git remote add origin https://github.com/<ton-compte>/ardoise.git
   git push -u origin main
   ```

3. Dans le dépôt : **Settings → Pages → Build and deployment → Source : « GitHub Actions »**.
4. Onglet **Actions** : le déploiement tourne (tests, build, publication). L'appli est ensuite à l'adresse `https://<ton-compte>.github.io/ardoise/`.

Ensuite, chaque `git push` sur `main` redéploie automatiquement (fichier `.github/workflows/deploiement.yml`). Le chemin de base de Vite (`base`) est réglé tout seul sur le nom du dépôt : rien à modifier si tu l'appelles autrement.

## Installer sur l'iPhone

1. Ouvre l'adresse de l'appli dans **Safari**.
2. Touche le bouton **Partager**, puis **« Sur l'écran d'accueil »**, puis **Ajouter**.
3. Ouvre ensuite toujours l'appli **depuis son icône**.

À savoir :

- **Installe avant de saisir des données.** L'appli installée a son propre stockage, séparé de celui de Safari. Ce qui est saisi dans Safari n'apparaît pas dans l'appli installée (pour transférer : sauvegarde dans l'un, restauration dans l'autre).
- Utilisée dans Safari sans installation, l'appli peut voir ses données effacées par iOS après quelques semaines sans visite. Installée, non.
- Après la première ouverture, l'appli fonctionne sans réseau.
- Mise à jour : quand une nouvelle version est déployée, l'appli la récupère toute seule à une ouverture suivante, avec du réseau. Si l'ancienne version reste affichée, ferme l'appli et rouvre-la.

## Sauvegarde et analyse en Python

Dans **Plus → Paramètres → Sauvegarde** :

- **Sauvegarder (fichier JSON)** : toutes les tables, pour restaurer l'appli à l'identique. Sur iPhone, la feuille de partage s'ouvre : choisis « Enregistrer dans Fichiers » (iCloud Drive de préférence, pour que la sauvegarde ne soit pas seulement sur le téléphone).
- **Restaurer une sauvegarde** : remplace tout le contenu de l'appli par celui du fichier (rien n'est fusionné).
- **Exporter en CSV** : deux fichiers, `ardoise-consommations-AAAA-MM-JJ.csv` et `ardoise-soirees-AAAA-MM-JJ.csv` (séparateur virgule, point décimal, UTF-8).

L'accueil affiche un rappel si aucune sauvegarde n'a été faite depuis 30 jours.

```python
import pandas as pd

consos = pd.read_csv("ardoise-consommations-2026-11-15.csv", parse_dates=["date_heure"])
soirees = pd.read_csv("ardoise-soirees-2026-11-15.csv", parse_dates=["debut", "fin"])

# Verres standard par semaine (semaines du lundi au dimanche)
print(consos.set_index("date_heure")["verres_standard"].resample("W-SUN").sum())

# Corrélation de Spearman entre l'eau bue et la gueule de bois
print(soirees[["hydratation", "gueule_de_bois"]].corr(method="spearman"))
```

## Données de démonstration

`demo/ardoise-demo.json` est une sauvegarde **fictive** (une quinzaine de soirées sur onze semaines) pour voir l'appli remplie : graphiques, objectifs, corrélations. Importe-la avec « Restaurer une sauvegarde », puis fais « Tout effacer » avant de commencer ton vrai suivi.

Attention : une restauration **remplace** les données présentes. N'importe pas la démo par-dessus de vraies données sans les avoir sauvegardées.

`npm run demo` régénère le fichier à la date du jour. Les boissons de la démo n'ont ni calories ni sucre renseignés : on n'invente pas de valeurs nutritionnelles, et la démo montre ainsi le cas « données incomplètes ».

## Structure du code

```text
index.html                  page unique ; réglages iOS (encoche, icône, plein écran)
vite.config.js              outil de build + configuration de la PWA (manifest, cache hors ligne)
public/                     icônes (apple-touch-icon 180 px, 192, 512, maskable)
.github/workflows/          déploiement automatique sur GitHub Pages
scripts/generer-demo.mjs    fabrique demo/ardoise-demo.json

src/
  main.jsx                  point d'entrée : police, styles, service worker, affichage
  App.jsx                   les routes (une par écran) et la barre de navigation du bas
  styles.css                toute la mise en forme ; couleurs en variables, mode sombre automatique

  calculs/                  FONCTIONS PURES, sans base ni écran, toutes testées (*.test.js)
    alcool.js               grammes d'alcool, verres standard, kcal, sucre, cocktails, snapshots
    widmark.js              estimation d'alcoolémie (simulation pas à pas)
    periodes.js             jour, semaine lundi-dimanche, mois, N jours glissants
    objectifs.js            unités, progression, alertes à 80 % / 100 %, historique
    agregats.js             totaux, séries par semaine ou mois, répartition, chiffres clés
    correlations.js         Spearman, phrases de résultat, nuage de points
    format.js               affichage à la française : nombres, cL, €, dates

  donnees/                  la base locale
    db.js                   schéma IndexedDB (bibliothèque Dexie) et données de départ
    valeursInitiales.js     catégories, contenants et paramètres préremplis
    actions.js              TOUTES les écritures (ajouter une consommation, une soirée…)
    selecteurs.js           petites lectures sur les données chargées (récents, dernier prix…)
    sauvegarde.js           export / import JSON, export CSV

  contexte/
    Donnees.jsx             charge toute la base et la tient à jour ; les écrans font useDonnees()
    Notifications.jsx       message « Ajouté… Annuler » (5 s) et bandeaux d'alerte d'objectif

  composants/               briques d'interface réutilisées
    base.jsx                en-tête, feuille (panneau du bas), champs, curseur, jauge, bâtons
    graphiques.jsx          barres, courbe d'alcoolémie, nuage de points (Chart.js)
    FeuillesConsommation.jsx  ajouter / modifier une consommation
    FeuilleBoisson.jsx, FeuilleObjectif.jsx, ChoixVolume.jsx, Objectif.jsx, Icone.jsx

  ecrans/                   un fichier par écran
    Accueil, Saisie, Historique, Soiree, Bilan, Stats,
    Plus, Dataset, EditeurCocktail, Objectifs, DetailObjectif, Parametres

  utilitaires/
    crochets.js             hooks partagés : heure courante, couleurs du thème, ajout avec messages
    plateforme.js           iOS : détection, stockage persistant, feuille de partage, fichiers
```

Le sens de circulation est toujours le même : un écran lit `useDonnees()`, calcule ce qu'il affiche avec les fonctions de `calculs/`, et écrit en appelant une fonction de `donnees/actions.js`. La base prévient alors `Donnees.jsx`, qui relit tout, et l'écran se met à jour.

Bibliothèques : React (interface), React Router (écrans), Dexie (IndexedDB), Chart.js (graphiques), vite-plugin-pwa (installation et hors-ligne), Vitest (tests). La police Atkinson Hyperlegible Next est embarquée dans l'appli.

## Schéma de la base

Base IndexedDB `ardoise`, huit tables. Les instants sont des nombres de millisecondes (comme `Date.now()`).

**categories**

| Champ | Type | Détail |
| --- | --- | --- |
| id | entier | clé, attribuée automatiquement |
| nom | texte | Bière, Vin rouge, Whisky… |
| couleur | texte `#rrggbb` | couleur dans les listes et les graphiques |
| alcoolisee | booléen | faux pour les diluants (sirop, jus, soda) |

**boissons**

| Champ | Type | Détail |
| --- | --- | --- |
| id | entier | clé |
| nom | texte | marque et produit |
| categorieId | entier | catégorie |
| degre | réel | % vol. (0 pour un diluant) |
| kcalParL | réel ou null | facultatif |
| sucreGParL | réel ou null | facultatif |
| favori | booléen | proposée en haut de la saisie |
| notes | texte | facultatif |
| archive | booléen | masquée de la saisie, conservée dans l'historique |

**contenants**

| Champ | Type | Détail |
| --- | --- | --- |
| id | entier | clé |
| nom | texte | Pinte, Demi… |
| volumeML | réel | volume en mL |
| predefini | booléen | fourni au départ (reste modifiable) |

**cocktails**

| Champ | Type | Détail |
| --- | --- | --- |
| id | entier | clé |
| nom | texte | Mojito… |
| ingredients | liste | `[{ boissonId, volumeML }]`, alcools et diluants |
| favori, archive | booléens | comme pour les boissons |

**consommations**

| Champ | Type | Détail |
| --- | --- | --- |
| id | entier | clé |
| horodatage | instant | moment de la consommation |
| type | texte | `boisson` ou `cocktail` |
| refId | entier | id de la boisson ou du cocktail |
| contenantId | entier ou null | null = volume libre (ou recette du cocktail) |
| volumeML | réel | volume d'une unité |
| quantite | entier | nombre d'unités |
| prixEuros | réel ou null | prix d'une unité |
| soireeId | entier ou null | soirée de rattachement |
| snapshot | objet | valeurs d'UNE unité, figées à la saisie (voir ci-dessous) |

`snapshot` = `{ nom, volumeML, degre, gAlcool, kcal, kcalEstimee, sucreG, sucreIncomplet, composants }`, où `composants` liste chaque ingrédient : `{ boissonId, categorieId, nom, volumeML, degre, gAlcool, kcal, kcalEstimee, sucreG }`. Une boisson simple a un seul composant. Les totaux d'une consommation sont ceux du snapshot multipliés par `quantite`.

**soirees**

| Champ | Type | Détail |
| --- | --- | --- |
| id | entier | clé |
| titre | texte | « Anniv de Paul » |
| debut, fin | instants | `fin` vaut null tant que la soirée est en cours |
| poidsKg | réel ou null | poids réglé au début de la soirée (pour l'alcoolémie) |
| ressenti, repas, hydratation, fatigue | entier 1 à 10 ou null | bilan |
| gueuleDeBois | entier 1 à 10 ou null | notée le lendemain |
| gueuleDeBoisIgnoree | booléen | « ne pas noter » a été choisi au rappel |
| notes | texte | facultatif |

**objectifs**

| Champ | Type | Détail |
| --- | --- | --- |
| id | entier | clé |
| nom | texte | « Max 20 verres par mois » |
| unite | texte | `verres`, `g`, `kcal`, `sucre`, `euros`, `nombre` |
| limite | réel | valeur à ne pas dépasser |
| periode | texte | `jour`, `semaine`, `mois`, `jours` (N jours glissants) |
| nJours | entier ou null | N, pour la période `jours` |
| filtreCategorie | entier ou null | limite restreinte à une catégorie |
| seuilAlerte | réel | 0,8 par défaut |
| actif | booléen | affiché sur l'accueil, avec alertes |
| creeLe | instant | date de création |

**parametres** : une ligne `{ cle, valeur }` par réglage. Clés : `poidsKg` (67), `sexe` (`homme`), `gParVerre` (10), `r` (0,7), `beta` (0,15), `premierLancement`, `dernierExport`, `persistance`, `aideInstallationMasquee`.

## Calculs

Masse d'alcool pur et verres standard (masse volumique de l'éthanol prise à 0,8 g/mL ; 1 verre standard = 10 g en France) :

$$m_{\text{alcool}}\ [\text{g}] = V\ [\text{mL}] \times \frac{\text{degré}}{100} \times 0{,}8 \qquad N_{\text{verres}} = \frac{m_{\text{alcool}}}{10}$$

Exemple : une pinte de 500 mL à 5 % donne $500 \times 0{,}05 \times 0{,}8 = 20$ g, soit 2 verres standard.

Calories et sucre :

$$E\ [\text{kcal}] = \frac{V}{1000} \times \text{kcalParL} \qquad m_{\text{sucre}}\ [\text{g}] = \frac{V}{1000} \times \text{sucreGParL}$$

- `kcalParL` vide : estimation minimale de 7 kcal par gramme d'alcool, signalée « alcool seul ».
- `sucreGParL` vide : sucre inconnu, exclu des totaux, avec la mention « données incomplètes ».

Cocktail (somme sur les ingrédients $i$, degré moyen pondéré par les volumes) :

$$m_{\text{alcool}} = \sum_i V_i \times \frac{d_i}{100} \times 0{,}8 \qquad d_{\text{moy}} = \frac{\sum_i V_i\, d_i}{\sum_i V_i}$$

Alcoolémie estimée (Widmark), avec $A_k$ les grammes d'alcool du verre pris à l'instant $t_k$, $P$ le poids en kg, $r = 0{,}7$ (homme) ou $0{,}6$ (femme), $\beta = 0{,}15$ g/L par heure :

$$C(t) \approx \max\left(0,\ \sum_{k\,:\,t_k \le t} \frac{A_k}{r \cdot P} - \beta\,(t - t_0)\right)$$

Le calcul se fait par simulation pas à pas (pas de 5 min) : si l'alcoolémie retombe à 0 avant un nouveau verre, on repart de 0. Exemple : 40 g pour 67 kg donnent un pic de $40 / (0{,}7 \times 67) \approx 0{,}85$ g/L avant élimination.

**Limites.** Le modèle suppose une absorption instantanée ; en réalité le pic arrive 30 à 90 min après le verre, plus tard et plus bas si on a mangé. $\beta$ varie d'environ 0,10 à 0,20 g/L par heure selon les personnes. C'est une estimation indicative : **elle ne permet pas de savoir si l'on peut conduire**, et l'appli l'affiche sous chaque courbe.

Corrélations : coefficient de Spearman $\rho$ (corrélation de Pearson calculée sur les rangs, ex æquo au rang moyen), à partir de 10 soirées avec bilan complet, affiché seulement si $|\rho| \ge 0{,}3$. Un lien est marqué « net » s'il passe un test approché au seuil de 5 % (transformation de Fisher) ; avec 10 soirées, cela demande environ $|\rho| \ge 0{,}65$. En dessous, il est marqué « fragile ».

## Choix faits là où le cahier des charges laissait une marge

- **Nom.** L'appli s'appelle « Ardoise » (l'ardoise du bar, avec ses bâtons : un trait par verre standard). Le nom affiché se change dans `index.html`, `vite.config.js` (manifest) et dans quelques textes des écrans (cherche « Ardoise » dans `src/ecrans/`).
- **Jours calendaires.** Une journée va de minuit à minuit. Un verre bu à 1 h du matin compte donc pour le jour qui commence (objectifs journaliers, jours sans alcool). La soirée, elle, regroupe ses consommations quelle que soit l'heure.
- **N jours glissants.** La période couvre aujourd'hui et les N − 1 jours précédents. Dans l'historique, les périodes passées sont des blocs de N jours qui se suivent.
- **Objectif limité à une catégorie.** Alcool, verres, kcal et sucre ne comptent que les ingrédients de la catégorie (le rhum d'un mojito compte en « Rhum »). Le prix et le nombre comptent en entier dès qu'un ingrédient en fait partie.
- **Unité « nombre de consommations ».** Chaque saisie compte pour sa quantité, y compris une boisson sans alcool si tu en notes une.
- **Alertes.** Bandeau à 80 % puis à 100 % ; si une seule saisie franchit les deux, seul le bandeau de 100 % s'affiche. Un bandeau se ferme à la main ou au bout de 20 s. Pas de notifications push.
- **Valeurs figées.** Chaque consommation garde les valeurs du jour de la saisie. Corriger une boisson ne change pas le passé, sauf avec les boutons « recalculer » (sur une consommation, une boisson ou un cocktail). Modifier le volume d'une consommation la recalcule avec le dataset actuel.
- **Prix.** Prérempli avec le dernier prix payé pour la même boisson dans le même volume. Un raccourci (favori, récent, « reprendre le même ») reprend ce prix ; une consommation sans prix compte pour 0 € et est signalée (« n sans prix »).
- **Favoris.** Un favori reprend le contenant de sa dernière consommation ; jamais consommé, il ouvre le choix du contenant (un cocktail part du volume de sa recette).
- **Répartition en euros.** Le prix d'un cocktail est réparti entre ses ingrédients au prorata de leur alcool.
- **Poids.** Il est noté au début de chaque soirée : le modifier dans les paramètres ne change que les estimations des soirées suivantes. `r` et `β`, eux, s'appliquent à toutes les soirées.
- **Fin de soirée.** Si le dernier verre date de plus de 3 h quand tu touches « Terminer », l'heure de fin proposée est celle de ce verre (modifiable dans le bilan).
- **Rappel de gueule de bois.** Proposé sur l'accueil entre 6 h et 4 jours après la fin de la soirée ; « Ne pas noter » le fait disparaître.
- **Bilan complet.** Une soirée compte dans les corrélations si ses cinq notes sont remplies (les quatre curseurs et la gueule de bois) et qu'on y a bu de l'alcool. Quinze couples sont étudiés : sept facteurs (alcool, rythme, pic estimé, durée, repas, eau, fatigue) face au ressenti et à la gueule de bois, plus ressenti face à gueule de bois. Le nuage de points, lui, s'affiche dès 3 soirées.
- **Suppression.** Une boisson ou un cocktail déjà consommé est archivé au lieu d'être supprimé. Supprimer une soirée détache ses consommations sans les effacer. Une catégorie ne se supprime que si plus rien ne s'en sert.

## Ce qui a été vérifié, et ce qui reste à vérifier sur ton iPhone

Vérifié automatiquement :

- 87 tests unitaires (`npm test`) sur les calculs et la base, dont les critères chiffrés du cahier des charges : pinte de 500 mL à 5 % = 20 g = 2 verres ; 40 g pour 67 kg → pic ≈ 0,85 g/L ; alertes à 80 % puis 100 % ; objectif sur 7 jours glissants ; objectif mensuel en euros ; corrélations masquées sous 10 soirées ; export, réinitialisation, import.
- Un parcours complet dans Chromium réglé comme un iPhone 14 : création d'une boisson et d'un contenant depuis la saisie, ajout d'un favori en 2 taps, alertes, cocktail à 3 ingrédients, soirée et bilan, courbe, stats, changement de poids, export JSON et CSV, réinitialisation, restauration, rechargement sans réseau.

**Pas vérifié** : le comportement réel dans Safari sur iPhone. Les points qui dépendent d'iOS sont à contrôler sur ton téléphone :

- [ ] installation depuis Safari et ouverture en mode avion ;
- [ ] feuille de partage à la sauvegarde (« Enregistrer dans Fichiers ») et choix du fichier à la restauration ;
- [ ] mention « Stockage persistant accordé » dans les paramètres une fois l'appli installée ;
- [ ] affichage autour de l'encoche et de la barre du bas ;
- [ ] rappel de gueule de bois le lendemain d'une vraie soirée.
