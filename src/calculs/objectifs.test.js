import { describe, expect, it } from 'vitest';
import { snapshotBoisson, snapshotCocktail } from './alcool.js';
import {
  alertesFranchies, etatObjectif, historiqueObjectif, progression, valeurConsommation,
} from './objectifs.js';

const le = (a, m, j, h = 12, min = 0) => new Date(a, m - 1, j, h, min).getTime();

// --- Petit jeu de données -------------------------------------------------
const BIERE = 1;
const RHUM = 8;
const DILUANTS = 15;
const leffe = { id: 1, nom: 'Leffe Blonde', categorieId: BIERE, degre: 5, kcalParL: 450, sucreGParL: 30 };
const rhum = { id: 10, nom: 'Rhum blanc', categorieId: RHUM, degre: 40, kcalParL: 2310, sucreGParL: 0 };
const sirop = { id: 11, nom: 'Sirop de sucre', categorieId: DILUANTS, degre: 0, kcalParL: 2600, sucreGParL: 650 };
const boissons = new Map([[1, leffe], [10, rhum], [11, sirop]]);
const mojito = { id: 1, nom: 'Mojito', ingredients: [{ boissonId: 10, volumeML: 50 }, { boissonId: 11, volumeML: 20 }] };

let prochainId = 1;
/** Une pinte de Leffe à 5 % : 20 g d'alcool, soit 2 verres standard. */
const pinte = (horodatage, extra = {}) => ({
  id: prochainId++, horodatage, type: 'boisson', refId: 1, volumeML: 500, quantite: 1, prixEuros: 7,
  snapshot: snapshotBoisson(leffe, 500), ...extra,
});
const unMojito = (horodatage, extra = {}) => ({
  id: prochainId++, horodatage, type: 'cocktail', refId: 1, volumeML: 70, quantite: 1, prixEuros: 10,
  snapshot: snapshotCocktail(mojito, boissons), ...extra,
});

describe('valeur d\'une consommation selon l\'unité', () => {
  const c = pinte(le(2026, 11, 15), { quantite: 2 });

  it('tient compte de la quantité', () => {
    expect(valeurConsommation(c, 'g')).toBeCloseTo(40, 10);
    expect(valeurConsommation(c, 'verres')).toBeCloseTo(4, 10);
    expect(valeurConsommation(c, 'kcal')).toBeCloseTo(450, 10);
    expect(valeurConsommation(c, 'sucre')).toBeCloseTo(30, 10);
    expect(valeurConsommation(c, 'euros')).toBeCloseTo(14, 10);
    expect(valeurConsommation(c, 'nombre')).toBe(2);
  });

  it('une consommation sans prix compte pour 0 €', () => {
    expect(valeurConsommation(pinte(0, { prixEuros: null }), 'euros')).toBe(0);
  });

  it('filtre de catégorie : seul le rhum du mojito compte en « Rhum »', () => {
    const m = unMojito(le(2026, 11, 15));
    expect(valeurConsommation(m, 'g', { categorieId: RHUM })).toBeCloseTo(16, 10);
    expect(valeurConsommation(m, 'g', { categorieId: BIERE })).toBe(0);
    expect(valeurConsommation(m, 'kcal', { categorieId: DILUANTS })).toBeCloseTo(52, 10);
    expect(valeurConsommation(m, 'nombre', { categorieId: RHUM })).toBe(1);
    expect(valeurConsommation(m, 'euros', { categorieId: RHUM })).toBe(10);
    expect(valeurConsommation(m, 'euros', { categorieId: BIERE })).toBe(0);
  });
});

describe('état d\'un objectif', () => {
  it('vert sous 80 %, orange de 80 à 100 %, rouge au-delà', () => {
    expect(etatObjectif(0.79)).toBe('ok');
    expect(etatObjectif(0.8)).toBe('alerte');
    expect(etatObjectif(1)).toBe('alerte');
    expect(etatObjectif(1.01)).toBe('depasse');
  });
});

describe('progression et alertes', () => {
  const objectif = {
    id: 1, nom: 'Max 20 verres par mois', unite: 'verres', limite: 20, periode: 'mois',
    filtreCategorie: null, seuilAlerte: 0.8, actif: true,
  };
  const maintenant = le(2026, 11, 15, 22);

  // 7 pintes en novembre = 14 verres (70 %) ; une pinte en octobre ne compte pas.
  const consos = [
    pinte(le(2026, 10, 30)),
    ...[2, 4, 6, 8, 10, 12, 14].map((j) => pinte(le(2026, 11, j))),
  ];

  it('ne compte que la période en cours', () => {
    const p = progression(objectif, consos, maintenant);
    expect(p.valeur).toBeCloseTo(14, 10);
    expect(p.ratio).toBeCloseTo(0.7, 10);
    expect(p.etat).toBe('ok');
    expect(p.reste).toBeCloseTo(6, 10);
  });

  it('alerte « seuil » quand une saisie fait passer à 80 % (critère du cahier des charges)', () => {
    const apres = [...consos, pinte(maintenant)]; // 16 verres = 80 %
    const alertes = alertesFranchies([objectif], consos, apres, maintenant);
    expect(alertes).toHaveLength(1);
    expect(alertes[0].type).toBe('seuil');
    expect(alertes[0].reste).toBeCloseTo(4, 10);
  });

  it('pas de nouvelle alerte tant qu\'on reste entre 80 et 100 %', () => {
    const avant = [...consos, pinte(maintenant)]; // 80 %
    const apres = [...avant, pinte(maintenant)]; // 90 %
    expect(alertesFranchies([objectif], avant, apres, maintenant)).toHaveLength(0);
  });

  it('alerte « limite » quand une saisie fait atteindre ou dépasser 100 %', () => {
    const avant = [...consos, pinte(maintenant), pinte(maintenant)]; // 18 verres = 90 %
    const pile = [...avant, pinte(maintenant)]; // 20 verres = 100 %
    const a1 = alertesFranchies([objectif], avant, pile, maintenant);
    expect(a1).toHaveLength(1);
    expect(a1[0].type).toBe('limite');
    expect(a1[0].reste).toBeCloseTo(0, 10);
    const audela = [...avant, pinte(maintenant, { quantite: 2 })]; // 22 verres
    const a2 = alertesFranchies([objectif], avant, audela, maintenant);
    expect(a2[0].type).toBe('limite');
    expect(a2[0].reste).toBeCloseTo(-2, 10);
  });

  it('une saisie qui saute de 70 % à plus de 100 % ne donne que l\'alerte « limite »', () => {
    const apres = [...consos, pinte(maintenant, { quantite: 4 })]; // 22 verres
    const alertes = alertesFranchies([objectif], consos, apres, maintenant);
    expect(alertes).toHaveLength(1);
    expect(alertes[0].type).toBe('limite');
  });

  it('une saisie dans une période passée ne déclenche rien', () => {
    const apres = [...consos, pinte(le(2026, 10, 3), { quantite: 10 })];
    expect(alertesFranchies([objectif], consos, apres, maintenant)).toHaveLength(0);
  });

  it('un objectif inactif ne déclenche rien', () => {
    const apres = [...consos, pinte(maintenant, { quantite: 4 })];
    expect(alertesFranchies([{ ...objectif, actif: false }], consos, apres, maintenant)).toHaveLength(0);
  });

  it('objectif sur 7 jours glissants (critère du cahier des charges)', () => {
    const glissant = { ...objectif, periode: 'jours', nJours: 7, limite: 10 };
    // Fenêtre : du 9 au 15 novembre inclus → pintes des 10, 12 et 14 = 6 verres.
    const p = progression(glissant, consos, maintenant);
    expect(p.debut).toBe(new Date(2026, 10, 9).getTime());
    expect(p.valeur).toBeCloseTo(6, 10);
    expect(p.etat).toBe('ok');
  });

  it('objectif mensuel en euros (critère du cahier des charges)', () => {
    const budget = { ...objectif, unite: 'euros', limite: 60 };
    const p = progression(budget, consos, maintenant);
    expect(p.valeur).toBeCloseTo(49, 10); // 7 pintes à 7 €
    expect(p.ratio).toBeCloseTo(49 / 60, 10);
    expect(p.etat).toBe('alerte');
  });

  it('objectif limité à une catégorie', () => {
    const spiritueux = { ...objectif, unite: 'g', limite: 40, filtreCategorie: RHUM };
    const p = progression(spiritueux, [...consos, unMojito(maintenant)], maintenant);
    expect(p.valeur).toBeCloseTo(16, 10);
  });

  it('historique : périodes passées, la plus récente d\'abord, respecté ou dépassé et de combien', () => {
    const octobre = [...Array(12)].map((_, i) => pinte(le(2026, 10, 2 + i))); // 24 verres
    const h = historiqueObjectif(objectif, [...consos, ...octobre], maintenant, 10, {
      depuis: le(2026, 9, 10),
    });
    expect(h).toHaveLength(2); // octobre puis septembre
    expect(h[0].debut).toBe(new Date(2026, 9, 1).getTime());
    expect(h[0].valeur).toBeCloseTo(26, 10); // 12 pintes + celle du 30 octobre
    expect(h[0].respecte).toBe(false);
    expect(h[0].ecart).toBeCloseTo(6, 10);
    expect(h[1].valeur).toBe(0);
    expect(h[1].respecte).toBe(true);
  });
});
