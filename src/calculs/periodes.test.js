import { describe, expect, it } from 'vitest';
import {
  ajouterJours, ajouterMois, bornesPeriode, cleJour, debutJour, debutMois, debutSemaine, periodePrecedente,
} from './periodes.js';

// Raccourci : instant local à partir d'une date lisible (mois de 1 à 12).
const le = (a, m, j, h = 0, min = 0) => new Date(a, m - 1, j, h, min).getTime();

describe('périodes', () => {
  it('les tests tournent bien dans le fuseau horaire français', () => {
    // −120 min en été (UTC+2), −60 min en hiver (UTC+1) : voir `test.env.TZ` dans vite.config.js
    expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(-120);
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(-60);
  });

  it('la semaine va du lundi au dimanche', () => {
    // Le dimanche 15 novembre 2026 appartient à la semaine du lundi 9.
    expect(debutSemaine(le(2026, 11, 15, 22))).toBe(le(2026, 11, 9));
    // Le lundi 16 commence une nouvelle semaine.
    expect(debutSemaine(le(2026, 11, 16, 0, 30))).toBe(le(2026, 11, 16));
    const { debut, fin } = bornesPeriode('semaine', le(2026, 11, 12, 18));
    expect(debut).toBe(le(2026, 11, 9));
    expect(fin).toBe(le(2026, 11, 16));
  });

  it('le mois civil', () => {
    const { debut, fin } = bornesPeriode('mois', le(2026, 12, 31, 23, 59));
    expect(debut).toBe(le(2026, 12, 1));
    expect(fin).toBe(le(2027, 1, 1));
    expect(debutMois(le(2026, 2, 28, 12))).toBe(le(2026, 2, 1));
    expect(ajouterMois(le(2026, 1, 31), 1)).toBe(le(2026, 2, 1));
  });

  it('le jour', () => {
    const { debut, fin } = bornesPeriode('jour', le(2026, 11, 15, 19, 26));
    expect(debut).toBe(le(2026, 11, 15));
    expect(fin).toBe(le(2026, 11, 16));
  });

  it("7 jours glissants : aujourd'hui et les 6 jours précédents", () => {
    const { debut, fin } = bornesPeriode('jours', le(2026, 11, 15, 19), 7);
    expect(debut).toBe(le(2026, 11, 9));
    expect(fin).toBe(le(2026, 11, 16));
  });

  it('reste juste au changement d\'heure (dernier dimanche de mars et d\'octobre)', () => {
    expect(ajouterJours(le(2026, 3, 28), 1)).toBe(le(2026, 3, 29));
    expect(ajouterJours(le(2026, 3, 29), 1)).toBe(le(2026, 3, 30));
    expect(ajouterJours(le(2026, 10, 25), 1)).toBe(le(2026, 10, 26));
    expect(debutJour(le(2026, 10, 25, 23, 30))).toBe(le(2026, 10, 25));
  });

  it('période précédente', () => {
    const semaine = bornesPeriode('semaine', le(2026, 11, 15));
    expect(periodePrecedente('semaine', semaine)).toEqual({ debut: le(2026, 11, 2), fin: le(2026, 11, 9) });
    const mois = bornesPeriode('mois', le(2026, 1, 10));
    expect(periodePrecedente('mois', mois)).toEqual({ debut: le(2025, 12, 1), fin: le(2026, 1, 1) });
    const glissant = bornesPeriode('jours', le(2026, 11, 15), 10);
    expect(periodePrecedente('jours', glissant, 10)).toEqual({ debut: le(2026, 10, 27), fin: le(2026, 11, 6) });
  });

  it('clé de jour', () => {
    expect(cleJour(le(2026, 1, 5, 23, 59))).toBe('2026-01-05');
  });
});
