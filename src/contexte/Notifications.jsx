// ---------------------------------------------------------------------------
// Messages affichés par-dessus l'écran :
//  - le message de confirmation en bas (« Ajouté : … » avec « Annuler » 5 s) ;
//  - les bandeaux d'alerte d'objectif en haut (80 % puis 100 %).
// ---------------------------------------------------------------------------

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icone } from '../composants/Icone.jsx';
import { nombre, valeurAvecUnite } from '../calculs/format.js';

const Contexte = createContext(null);

/** Texte d'un bandeau d'alerte : dit toujours ce qu'il reste avant la limite. */
export function texteAlerte(alerte) {
  const { objectif, type, ratio, reste } = alerte;
  const nom = `Objectif « ${objectif.nom} »`;
  if (type === 'seuil') {
    return {
      type,
      titre: `${nom} : ${nombre(ratio * 100, 0)} % de la limite`,
      detail: `Il reste ${valeurAvecUnite(reste, objectif.unite)} avant la limite.`,
    };
  }
  if (reste > -1e-9) {
    return { type, titre: `${nom} : limite atteinte`, detail: 'Il ne reste plus de marge sur cette période.' };
  }
  return {
    type,
    titre: `${nom} : limite dépassée`,
    detail: `Dépassement de ${valeurAvecUnite(-reste, objectif.unite)}.`,
  };
}

export function NotificationsProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [bandeaux, setBandeaux] = useState([]);
  const compteur = useRef(0);
  const minuterie = useRef(null);

  /** Affiche un message en bas, avec une action facultative, pendant `dureeMs`. */
  const afficherToast = useCallback(({ message, action = null, dureeMs = 5000 }) => {
    compteur.current += 1;
    const id = compteur.current;
    clearTimeout(minuterie.current);
    setToast({ id, message, action });
    minuterie.current = setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), dureeMs);
  }, []);

  /** Affiche un bandeau par alerte d'objectif. */
  const afficherAlertes = useCallback((alertes) => {
    if (!alertes || alertes.length === 0) return;
    const nouveaux = alertes.map((a) => {
      compteur.current += 1;
      return { id: compteur.current, ...texteAlerte(a) };
    });
    setBandeaux((b) => [...b, ...nouveaux]);
    // Un bandeau se ferme aussi tout seul au bout de 20 s.
    for (const n of nouveaux) {
      setTimeout(() => setBandeaux((b) => b.filter((x) => x.id !== n.id)), 20000);
    }
  }, []);

  const valeur = useMemo(() => ({ afficherToast, afficherAlertes }), [afficherToast, afficherAlertes]);

  return (
    <Contexte.Provider value={valeur}>
      {children}
      {createPortal(
        <>
          <div className="messages-haut" aria-live="assertive">
            {bandeaux.map((b) => (
              <div key={b.id} className="bandeau" data-type={b.type} role="alert">
                <Icone nom="alerte" style={{ flex: 'none', marginTop: 1 }} />
                <div className="bandeau__texte">
                  <div className="bandeau__titre">{b.titre}</div>
                  <div>{b.detail}</div>
                </div>
                <button
                  className="bouton-icone"
                  aria-label="Fermer l'alerte"
                  onClick={() => setBandeaux((liste) => liste.filter((x) => x.id !== b.id))}
                >
                  <Icone nom="fermer" taille={20} />
                </button>
              </div>
            ))}
          </div>
          <div className="messages-bas" aria-live="polite">
            {toast && (
              <div key={toast.id} className="toast" role="status">
                <span className="toast__texte">{toast.message}</span>
                {toast.action && (
                  <button
                    className="toast__action"
                    onClick={() => {
                      clearTimeout(minuterie.current);
                      setToast(null);
                      toast.action.executer();
                    }}
                  >
                    {toast.action.libelle}
                  </button>
                )}
              </div>
            )}
          </div>
        </>,
        document.body,
      )}
    </Contexte.Provider>
  );
}

export function useNotifications() {
  return useContext(Contexte);
}
