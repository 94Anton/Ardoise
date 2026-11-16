// ---------------------------------------------------------------------------
// Périodes de temps : jour, semaine (du lundi au dimanche), mois civil,
// N derniers jours glissants.
//
// Tous les instants sont des nombres de millisecondes (comme Date.now()).
// Une période est un intervalle { debut, fin } où `fin` est EXCLU :
// un instant t appartient à la période si debut <= t < fin.
//
// On passe toujours par `new Date(année, mois, jour)` plutôt que d'ajouter
// 24 × 3600 × 1000 ms : c'est ce qui reste juste lors des changements d'heure.
// ---------------------------------------------------------------------------

/** Minuit (heure locale) du jour contenant l'instant donné. */
export function debutJour(ms) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Décale un instant de n jours calendaires (n peut être négatif). */
export function ajouterJours(ms, n) {
  const d = new Date(ms);
  return new Date(
    d.getFullYear(), d.getMonth(), d.getDate() + n,
    d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds(),
  ).getTime();
}

/** Lundi 00:00 de la semaine contenant l'instant donné. */
export function debutSemaine(ms) {
  const minuit = debutJour(ms);
  const rangDansSemaine = (new Date(minuit).getDay() + 6) % 7; // 0 = lundi … 6 = dimanche
  return ajouterJours(minuit, -rangDansSemaine);
}

/** 1er du mois, 00:00, du mois contenant l'instant donné. */
export function debutMois(ms) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

/** 1er du mois, 00:00, n mois plus tard (ou plus tôt si n < 0). */
export function ajouterMois(ms, n) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth() + n, 1).getTime();
}

/**
 * Bornes de la période qui contient l'instant `ref`.
 *
 * @param {'jour'|'semaine'|'mois'|'jours'} periode
 *   'jours' = N derniers jours glissants, aujourd'hui compris.
 * @param {number} ref     instant de référence (ms)
 * @param {number} nJours  utilisé seulement pour la période 'jours'
 * @returns {{debut:number, fin:number}}  fin exclue
 */
export function bornesPeriode(periode, ref, nJours = 7) {
  switch (periode) {
    case 'jour': {
      const debut = debutJour(ref);
      return { debut, fin: ajouterJours(debut, 1) };
    }
    case 'semaine': {
      const debut = debutSemaine(ref);
      return { debut, fin: ajouterJours(debut, 7) };
    }
    case 'mois': {
      const debut = debutMois(ref);
      return { debut, fin: ajouterMois(debut, 1) };
    }
    case 'jours': {
      const fin = ajouterJours(debutJour(ref), 1);
      return { debut: ajouterJours(fin, -Math.max(1, nJours)), fin };
    }
    default:
      throw new Error(`Période inconnue : ${periode}`);
  }
}

/**
 * Période qui précède immédiatement celle passée en argument.
 * Pour les jours glissants, ce sont des blocs de N jours qui se suivent.
 */
export function periodePrecedente(periode, bornes, nJours = 7) {
  switch (periode) {
    case 'jour':
      return { debut: ajouterJours(bornes.debut, -1), fin: bornes.debut };
    case 'semaine':
      return { debut: ajouterJours(bornes.debut, -7), fin: bornes.debut };
    case 'mois':
      return { debut: ajouterMois(bornes.debut, -1), fin: bornes.debut };
    case 'jours':
      return { debut: ajouterJours(bornes.debut, -Math.max(1, nJours)), fin: bornes.debut };
    default:
      throw new Error(`Période inconnue : ${periode}`);
  }
}

/** Vrai si l'instant t est dans la période (fin exclue). */
export function dansPeriode(t, bornes) {
  return t >= bornes.debut && t < bornes.fin;
}

/** Clé texte d'un jour, « AAAA-MM-JJ », pratique pour regrouper par jour. */
export function cleJour(ms) {
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const jj = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${jj}`;
}

/** Nombre de jours calendaires entre deux minuits (fin exclue). */
export function nombreJours(debut, fin) {
  let n = 0;
  for (let t = debutJour(debut); t < fin; t = ajouterJours(t, 1)) n += 1;
  return n;
}
