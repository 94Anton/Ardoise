// ---------------------------------------------------------------------------
// Crochets React (« hooks ») partagés.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ajouterConsommation, annulerAjout, reprendreLeMeme } from '../donnees/actions.js';
import { useNotifications } from '../contexte/Notifications.jsx';
import { volume } from '../calculs/format.js';

/**
 * Heure courante (ms), rafraîchie régulièrement et à chaque retour au premier
 * plan. Indispensable sur téléphone : l'appli peut rester ouverte en
 * arrière-plan toute la nuit et doit se remettre à jour le lendemain.
 */
export function useMaintenant(intervalleMs = 30000) {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const mettreAJour = () => setMaintenant(Date.now());
    const minuterie = setInterval(mettreAJour, intervalleMs);
    document.addEventListener('visibilitychange', mettreAJour);
    window.addEventListener('focus', mettreAJour);
    return () => {
      clearInterval(minuterie);
      document.removeEventListener('visibilitychange', mettreAJour);
      window.removeEventListener('focus', mettreAJour);
    };
  }, [intervalleMs]);
  return maintenant;
}

/**
 * Couleurs du thème courant, lues dans les variables CSS. Les graphiques
 * (dessinés dans un canvas) en ont besoin ; ils se redessinent quand le
 * téléphone passe du mode clair au mode sombre.
 */
export function useCouleurs() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const surChangement = () => setVersion((v) => v + 1);
    media.addEventListener('change', surChangement);
    return () => media.removeEventListener('change', surChangement);
  }, []);
  return useMemo(() => {
    const style = getComputedStyle(document.documentElement);
    const lire = (nom) => style.getPropertyValue(nom).trim();
    return {
      fond: lire('--fond'),
      surface: lire('--surface'),
      encre: lire('--encre'),
      encre2: lire('--encre-2'),
      encre3: lire('--encre-3'),
      trait: lire('--trait'),
      donnee: lire('--donnee'),
      rampe: [lire('--rampe-1'), lire('--rampe-2'), lire('--rampe-3')],
      police: lire('--police'),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
}

/**
 * Ajout d'une consommation avec ses messages : confirmation « Ajouté : … »
 * (bouton Annuler pendant 5 s) et bandeaux d'alerte d'objectif.
 */
export function useAjout() {
  const { afficherToast, afficherAlertes } = useNotifications();

  const confirmer = useCallback(
    (resultat, libelle) => {
      afficherToast({
        message: `Ajouté : ${libelle}`,
        action: { libelle: 'Annuler', executer: () => annulerAjout(resultat) },
      });
      afficherAlertes(resultat.alertes);
    },
    [afficherToast, afficherAlertes],
  );

  /** @param {object} saisie voir ajouterConsommation ; @param {string} libelle texte du message */
  const ajouter = useCallback(
    async (saisie, libelle) => {
      try {
        const resultat = await ajouterConsommation(saisie);
        confirmer(resultat, libelle);
        return resultat;
      } catch (erreur) {
        afficherToast({ message: erreur.message });
        return null;
      }
    },
    [confirmer, afficherToast],
  );

  /** « Reprendre le même » : duplique la dernière consommation, maintenant. */
  const reprendre = useCallback(
    async (libelle) => {
      const resultat = await reprendreLeMeme();
      if (resultat) confirmer(resultat, libelle);
      return resultat;
    },
    [confirmer],
  );

  return { ajouter, reprendre };
}

/** Texte court d'une consommation : « Leffe Blonde, pinte 50 cL ». */
export function libelleConsommation(nom, nomContenant, volumeML, quantite = 1) {
  const contenant = nomContenant ? `${nomContenant.toLowerCase()} ${volume(volumeML)}` : volume(volumeML);
  return `${quantite > 1 ? `${quantite} × ` : ''}${nom}, ${contenant}`;
}
