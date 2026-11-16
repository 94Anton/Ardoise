import { describe, expect, it } from 'vitest';
import { snapshotBoisson } from './alcool.js';
import {
  MIN_SOIREES, analyserCorrelations, estSolide, pointsNuage, rangs, spearman,
} from './correlations.js';

const H = 3600 * 1000;
const PARAMETRES = { poidsKg: 67, r: 0.7, beta: 0.15 };
const leffe = { id: 1, nom: 'Leffe Blonde', categorieId: 1, degre: 5, kcalParL: 450, sucreGParL: 30 };

describe('rangs et Spearman', () => {
  it('donne aux ex æquo la moyenne de leurs rangs', () => {
    expect(rangs([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4]);
    expect(rangs([3, 1, 2])).toEqual([3, 1, 2]);
  });

  it('vaut +1 pour une relation croissante, même non linéaire', () => {
    expect(spearman([1, 2, 3, 4, 5], [1, 4, 9, 16, 25])).toBeCloseTo(1, 10);
  });

  it('vaut −1 pour une relation décroissante', () => {
    expect(spearman([1, 2, 3, 4, 5], [10, 8, 6, 4, 2])).toBeCloseTo(-1, 10);
  });

  it('retrouve une valeur de référence calculée à la main', () => {
    // Sans ex æquo : ρ = 1 − 6 Σd² / (n (n² − 1)), avec d = différences de rangs.
    // Σd² = 4 → ρ = 1 − 24/120 = 0,8
    expect(spearman([1, 2, 3, 4, 5], [2, 1, 4, 3, 5])).toBeCloseTo(0.8, 10);
    // Σd² = 8 → ρ = 1 − 48/120 = 0,6
    expect(spearman([1, 2, 3, 4, 5], [3, 1, 2, 5, 4])).toBeCloseTo(0.6, 10);
  });

  it('renvoie null si une grandeur ne varie pas ou s\'il y a trop peu de points', () => {
    expect(spearman([1, 2, 3, 4], [5, 5, 5, 5])).toBeNull();
    expect(spearman([1, 2], [2, 1])).toBeNull();
  });

  it('juge la solidité du lien : il faut environ |ρ| ≥ 0,65 avec 10 soirées', () => {
    expect(estSolide(0.45, 10)).toBe(false);
    expect(estSolide(0.7, 10)).toBe(true);
    expect(estSolide(-0.45, 40)).toBe(true);
    expect(estSolide(1, 10)).toBe(true);
  });
});

/** Fabrique n soirées : la soirée i comporte i pintes et les notes données par `notes(i)`. */
function fabriquer(n, notes) {
  const soirees = [];
  const consommations = [];
  let idConso = 1;
  for (let i = 1; i <= n; i += 1) {
    const debut = i * 7 * 24 * H;
    soirees.push({ id: i, titre: `Soirée ${i}`, debut, fin: debut + 4 * H, ...notes(i) });
    for (let k = 0; k < i; k += 1) {
      consommations.push({
        id: idConso++, horodatage: debut + k * 20 * 60 * 1000, soireeId: i, quantite: 1,
        snapshot: snapshotBoisson(leffe, 500),
      });
    }
  }
  return { soirees, consommations };
}

const notesCompletes = (i) => ({
  ressenti: Math.min(10, i), // monte avec l'alcool
  repas: 5,
  hydratation: 11 - Math.min(10, i), // moins d'eau quand on boit plus
  fatigue: (i % 3) + 4,
  gueuleDeBois: Math.min(10, i),
});

describe('analyse des corrélations', () => {
  it(`reste masquée sous ${MIN_SOIREES} soirées avec bilan complet (critère du cahier des charges)`, () => {
    const { soirees, consommations } = fabriquer(9, notesCompletes);
    const a = analyserCorrelations(soirees, consommations, PARAMETRES);
    expect(a.nbCompletes).toBe(9);
    expect(a.manquantes).toBe(1);
    expect(a.resultats).toEqual([]);
  });

  it('une soirée sans note de gueule de bois ne compte pas comme complète', () => {
    const { soirees, consommations } = fabriquer(10, (i) => ({
      ...notesCompletes(i), gueuleDeBois: i === 4 ? null : notesCompletes(i).gueuleDeBois,
    }));
    expect(analyserCorrelations(soirees, consommations, PARAMETRES).nbCompletes).toBe(9);
  });

  it('à partir de 10 soirées, renvoie des phrases avec ρ et n', () => {
    const { soirees, consommations } = fabriquer(12, notesCompletes);
    const a = analyserCorrelations(soirees, consommations, PARAMETRES);
    expect(a.nbCompletes).toBe(12);

    const alcoolRessenti = a.resultats.find((r) => r.cause === 'gAlcool' && r.effet === 'ressenti');
    expect(alcoolRessenti.rho).toBeGreaterThan(0.9);
    expect(alcoolRessenti.n).toBe(12);
    expect(alcoolRessenti.solide).toBe(true);
    expect(alcoolRessenti.phrase).toBe("Plus tu bois d'alcool, plus tu te sens alcoolisé");

    const eauGdb = a.resultats.find((r) => r.cause === 'hydratation' && r.effet === 'gueuleDeBois');
    expect(eauGdb.rho).toBeLessThan(-0.9);
    expect(eauGdb.phrase).toBe("Plus tu bois d'eau, moins tu as la gueule de bois");
  });

  it('ne montre que les |ρ| ≥ 0,3 et ignore les grandeurs constantes', () => {
    const { soirees, consommations } = fabriquer(12, notesCompletes);
    const a = analyserCorrelations(soirees, consommations, PARAMETRES);
    expect(a.resultats.every((r) => Math.abs(r.rho) >= 0.3)).toBe(true);
    expect(a.resultats.some((r) => r.cause === 'repas')).toBe(false); // repas toujours à 5
    // triés du lien le plus fort au plus faible
    for (let i = 1; i < a.resultats.length; i += 1) {
      expect(Math.abs(a.resultats[i - 1].rho)).toBeGreaterThanOrEqual(Math.abs(a.resultats[i].rho));
    }
  });

  it('nuage de points : grammes d\'alcool × ressenti, avec la note de repas', () => {
    const { soirees, consommations } = fabriquer(3, (i) => ({ ressenti: i + 2, repas: 8, gueuleDeBois: null }));
    const points = pointsNuage(soirees, consommations, PARAMETRES);
    expect(points).toHaveLength(3);
    expect(points[1]).toMatchObject({ x: 40, y: 4, repas: 8 });
  });
});
