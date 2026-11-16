// ---------------------------------------------------------------------------
// Ce qui dépend du téléphone et du navigateur : détection d'iOS, appli
// installée ou non, stockage persistant, partage et téléchargement de fichiers.
// ---------------------------------------------------------------------------

/** Vrai sur iPhone et iPad (y compris l'iPad qui se présente comme un Mac). */
export function estIOS() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

/** Vrai si l'appli est lancée depuis son icône sur l'écran d'accueil. */
export function estInstallee() {
  return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

/**
 * Demande au navigateur de ne pas effacer les données locales pour faire de
 * la place. Sans garantie : le navigateur peut refuser.
 * @returns {Promise<'accordee'|'refusee'|'indisponible'>}
 */
export async function demanderPersistance() {
  try {
    if (!navigator.storage?.persist) return 'indisponible';
    if (await navigator.storage.persisted()) return 'accordee';
    return (await navigator.storage.persist()) ? 'accordee' : 'refusee';
  } catch {
    return 'indisponible';
  }
}

/** Déclenche un téléchargement classique (repli quand le partage n'existe pas). */
function telecharger(fichier) {
  const url = URL.createObjectURL(fichier);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = fichier.name;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Remet un ou plusieurs fichiers à l'utilisateur.
 * Sur iPhone : ouvre la feuille de partage (« Enregistrer dans Fichiers »,
 * iCloud Drive, AirDrop…). Ailleurs, ou si le partage échoue : téléchargement.
 *
 * IMPORTANT : cette fonction doit être appelée directement dans le
 * gestionnaire du toucher, avec des contenus déjà prêts. Safari refuse
 * d'ouvrir la feuille de partage si trop de temps s'écoule après le geste.
 *
 * @param {Array<{nom:string, contenu:string, type:string}>} fichiers
 * @returns {Promise<'partage'|'annule'|'telecharge'>}
 */
export async function remettreFichiers(fichiers) {
  const fabriquer = (typeForce) => fichiers.map((f) => new File([f.contenu], f.nom, { type: typeForce ?? f.type }));
  // Certains navigateurs ne partagent que quelques types de fichiers : si le
  // type d'origine est refusé, on retente en « texte brut » (même nom, même contenu).
  const essais = [fabriquer(null), fabriquer('text/plain')];
  const partageables = essais.find((objets) => {
    try {
      return navigator.canShare?.({ files: objets }) === true;
    } catch {
      return false;
    }
  });
  if (partageables) {
    try {
      await navigator.share({ files: partageables });
      return 'partage';
    } catch (erreur) {
      if (erreur?.name === 'AbortError') return 'annule'; // feuille de partage refermée
      // autre erreur (ex. partage refusé) : on retombe sur le téléchargement
    }
  }
  essais[0].forEach(telecharger);
  return 'telecharge';
}

/** Lit un fichier choisi par l'utilisateur et renvoie son contenu texte. */
export function lireFichierTexte(fichier) {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resoudre(String(lecteur.result));
    lecteur.onerror = () => rejeter(new Error('Lecture du fichier impossible.'));
    lecteur.readAsText(fichier);
  });
}

/** Nom de fichier daté : horodaterNom('ardoise-sauvegarde', 'json') → « ardoise-sauvegarde-2026-11-15.json ». */
export function horodaterNom(prefixe, extension, maintenant = Date.now()) {
  const d = new Date(maintenant);
  const p = (n) => String(n).padStart(2, '0');
  return `${prefixe}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.${extension}`;
}
