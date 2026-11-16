import { describe, expect, it } from 'vitest';
import { alcoolemieA, picTheorique, simulerAlcoolemie } from './widmark.js';

const H = 3600 * 1000;
const MOI = { poidsKg: 67, r: 0.7, beta: 0.15 };

describe('Widmark', () => {
  it('40 g pour 67 kg et r = 0,7 : pic ≈ 0,85 g/L avant élimination (critère du cahier des charges)', () => {
    expect(picTheorique(40, 67, 0.7)).toBeCloseTo(0.853, 3);
  });

  it('deux pintes bues au même instant donnent ce même pic dans la simulation', () => {
    const sim = simulerAlcoolemie([{ t: 0, gAlcool: 20 }, { t: 0, gAlcool: 20 }], MOI);
    expect(sim.pic).toBeCloseTo(0.853, 3);
    expect(sim.tPic).toBe(0);
  });

  it("l'élimination est linéaire : β = 0,15 g/L par heure", () => {
    const sim = simulerAlcoolemie([{ t: 0, gAlcool: 40 }], MOI);
    const aUneHeure = sim.points.find((p) => p.t === H);
    expect(aUneHeure.c).toBeCloseTo(0.853 - 0.15, 3);
    // retour à 0 après pic / β heures
    expect(sim.tRetourZero / H).toBeCloseTo(0.853 / 0.15, 2);
    expect(sim.points.at(-1).c).toBe(0);
  });

  it("repart de 0 si l'alcoolémie est retombée avant un nouveau verre", () => {
    // 10 g → pic 0,213 g/L, éliminé en 1 h 25. Deuxième verre 4 h plus tard.
    const sim = simulerAlcoolemie([{ t: 0, gAlcool: 10 }, { t: 4 * H, gAlcool: 10 }], MOI);
    expect(sim.pic).toBeCloseTo(10 / (0.7 * 67), 6); // pas de cumul
    const juste_avant = sim.points.filter((p) => p.t === 4 * H)[0];
    expect(juste_avant.c).toBe(0);
  });

  it('cumule les verres rapprochés', () => {
    const sim = simulerAlcoolemie([{ t: 0, gAlcool: 20 }, { t: H, gAlcool: 20 }], MOI);
    const attendu = 20 / (0.7 * 67) - 0.15 + 20 / (0.7 * 67);
    expect(sim.pic).toBeCloseTo(attendu, 6);
    expect(sim.tPic).toBe(H);
  });

  it('gère une prise qui tombe entre deux pas de 5 minutes', () => {
    const sim = simulerAlcoolemie([{ t: 0, gAlcool: 20 }, { t: 7 * 60 * 1000, gAlcool: 20 }], MOI);
    const attendu = 20 / (0.7 * 67) - 0.15 * (7 / 60) + 20 / (0.7 * 67);
    expect(sim.pic).toBeCloseTo(attendu, 6);
  });

  it("le poids modifie l'estimation", () => {
    const leger = simulerAlcoolemie([{ t: 0, gAlcool: 20 }], { ...MOI, poidsKg: 60 });
    const lourd = simulerAlcoolemie([{ t: 0, gAlcool: 20 }], { ...MOI, poidsKg: 80 });
    expect(leger.pic).toBeGreaterThan(lourd.pic);
  });

  it('ne plante pas sans consommation ni avec des boissons sans alcool', () => {
    expect(simulerAlcoolemie([], MOI).points).toEqual([]);
    expect(simulerAlcoolemie([{ t: 0, gAlcool: 0 }], MOI).pic).toBe(0);
  });

  it('les points sont dans l\'ordre chronologique et jamais négatifs', () => {
    const sim = simulerAlcoolemie(
      [{ t: 0, gAlcool: 20 }, { t: 0.6 * H, gAlcool: 12 }, { t: 3.1 * H, gAlcool: 26 }],
      MOI,
    );
    for (let i = 1; i < sim.points.length; i += 1) {
      expect(sim.points[i].t).toBeGreaterThanOrEqual(sim.points[i - 1].t);
      expect(sim.points[i].c).toBeGreaterThanOrEqual(0);
    }
  });

  it("lit l'alcoolémie à un instant quelconque de la courbe", () => {
    const sim = simulerAlcoolemie([{ t: 0, gAlcool: 40 }], MOI);
    expect(alcoolemieA(sim.points, 0)).toBeCloseTo(0.853, 3); // juste après le verre
    expect(alcoolemieA(sim.points, 2.5 * 60 * 1000)).toBeCloseTo(0.853 - 0.15 * (2.5 / 60), 3);
    expect(alcoolemieA(sim.points, 12 * H)).toBe(0); // bien après le retour à zéro
    expect(alcoolemieA(sim.points, -H)).toBe(0);
  });
});
