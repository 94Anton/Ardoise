import { describe, expect, it } from 'vitest';
import {
  calculerComposant, grammesAlcool, snapshotBoisson, snapshotCocktail, verresStandard, volumeRecette,
} from './alcool.js';

describe('alcool pur et verres standard', () => {
  it('pinte de 500 mL à 5 % = 20 g = 2 verres standard (critère du cahier des charges)', () => {
    const g = grammesAlcool(500, 5);
    expect(g).toBeCloseTo(20, 10);
    expect(verresStandard(g)).toBeCloseTo(2, 10);
  });

  it('verre de vin 125 mL à 12 % = 12 g', () => {
    expect(grammesAlcool(125, 12)).toBeCloseTo(12, 10);
  });

  it('shot de 40 mL à 40 % = 12,8 g', () => {
    expect(grammesAlcool(40, 40)).toBeCloseTo(12.8, 10);
  });

  it("le nombre de grammes par verre standard est réglable", () => {
    expect(verresStandard(20, 8)).toBeCloseTo(2.5, 10);
  });
});

describe('calories et sucre', () => {
  const leffe = { id: 1, nom: 'Leffe Blonde', categorieId: 1, degre: 6.6, kcalParL: 560, sucreGParL: 30 };

  it('utilise kcalParL et sucreGParL quand ils sont connus', () => {
    const k = calculerComposant(leffe, 500);
    expect(k.kcal).toBeCloseTo(280, 10);
    expect(k.kcalEstimee).toBe(false);
    expect(k.sucreG).toBeCloseTo(15, 10);
  });

  it('kcalParL vide : estimation minimale de 7 kcal par gramme d\'alcool, marquée estimée', () => {
    const k = calculerComposant({ ...leffe, kcalParL: null }, 500);
    expect(k.kcal).toBeCloseTo(26.4 * 7, 10);
    expect(k.kcalEstimee).toBe(true);
  });

  it('sucreGParL vide : sucre inconnu (null), signalé incomplet', () => {
    const s = snapshotBoisson({ ...leffe, sucreGParL: undefined }, 500);
    expect(s.sucreG).toBeNull();
    expect(s.sucreIncomplet).toBe(true);
  });

  it('un sucre connu égal à 0 reste connu', () => {
    const s = snapshotBoisson({ ...leffe, sucreGParL: 0 }, 500);
    expect(s.sucreG).toBe(0);
    expect(s.sucreIncomplet).toBe(false);
  });
});

describe('cocktails', () => {
  const boissons = new Map([
    [10, { id: 10, nom: 'Rhum blanc', categorieId: 8, degre: 40, kcalParL: 2310, sucreGParL: 0 }],
    [11, { id: 11, nom: 'Sirop de sucre', categorieId: 15, degre: 0, kcalParL: 2600, sucreGParL: 650 }],
    [12, { id: 12, nom: 'Eau gazeuse', categorieId: 15, degre: 0, kcalParL: 0, sucreGParL: 0 }],
  ]);
  const mojito = {
    id: 1,
    nom: 'Mojito',
    ingredients: [
      { boissonId: 10, volumeML: 50 },
      { boissonId: 11, volumeML: 20 },
      { boissonId: 12, volumeML: 130 },
    ],
  };

  it('additionne les ingrédients et calcule le degré moyen pondéré par les volumes', () => {
    const s = snapshotCocktail(mojito, boissons);
    expect(volumeRecette(mojito)).toBe(200);
    expect(s.volumeML).toBe(200);
    expect(s.gAlcool).toBeCloseTo(50 * 0.4 * 0.8, 10); // 16 g
    expect(s.degre).toBeCloseTo((50 * 40) / 200, 10); // 10 %
    expect(s.kcal).toBeCloseTo(0.05 * 2310 + 0.02 * 2600, 10); // 167,5 kcal
    expect(s.sucreG).toBeCloseTo(13, 10);
    expect(s.kcalEstimee).toBe(false);
    expect(s.sucreIncomplet).toBe(false);
    expect(s.composants).toHaveLength(3);
  });

  it("attribue l'alcool à la catégorie de chaque ingrédient (le mojito compte en rhum)", () => {
    const s = snapshotCocktail(mojito, boissons);
    const rhum = s.composants.find((k) => k.categorieId === 8);
    expect(rhum.gAlcool).toBeCloseTo(16, 10);
    expect(s.composants.filter((k) => k.categorieId === 15).every((k) => k.gAlcool === 0)).toBe(true);
  });

  it('met la recette à l\'échelle si le volume servi diffère', () => {
    const double = snapshotCocktail(mojito, boissons, 400);
    expect(double.gAlcool).toBeCloseTo(32, 10);
    expect(double.degre).toBeCloseTo(10, 10);
  });

  it('un ingrédient sans sucre renseigné rend le total incomplet mais garde la partie connue', () => {
    const incomplets = new Map(boissons);
    incomplets.set(10, { ...boissons.get(10), sucreGParL: null });
    const s = snapshotCocktail(mojito, incomplets);
    expect(s.sucreG).toBeCloseTo(13, 10);
    expect(s.sucreIncomplet).toBe(true);
  });

  it('accepte aussi un objet simple à la place d\'une Map', () => {
    const s = snapshotCocktail(mojito, Object.fromEntries(boissons));
    expect(s.gAlcool).toBeCloseTo(16, 10);
  });
});
