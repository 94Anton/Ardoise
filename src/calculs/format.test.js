import { describe, expect, it } from 'vitest';
import {
  depuisChampDateHeure, duree, euros, lireNombre, nombre, valeurAvecUnite, versChampDateHeure, volume,
} from './format.js';

// Les espaces insécables sont remplacées par des espaces simples pour comparer.
const simple = (texte) => texte.replace(/[  ]/g, ' ');

describe('mise en forme', () => {
  it('nombres à la française', () => {
    expect(nombre(6.42, 1)).toBe('6,4');
    expect(nombre(2, 1)).toBe('2');
    expect(nombre(NaN)).toBe('–');
  });

  it('volumes en cL', () => {
    expect(simple(volume(500))).toBe('50 cL');
    expect(simple(volume(125))).toBe('12,5 cL');
    expect(simple(volume(40))).toBe('4 cL');
  });

  it('euros et unités, avec le pluriel français à partir de 2', () => {
    expect(simple(euros(6.5))).toBe('6,50 €');
    expect(simple(valeurAvecUnite(1.5, 'verres'))).toBe('1,5 verre');
    expect(simple(valeurAvecUnite(3.6, 'verres'))).toBe('3,6 verres');
    expect(simple(valeurAvecUnite(20, 'g'))).toBe("20 g d'alcool");
  });

  it('durées', () => {
    expect(simple(duree(45 * 60000))).toBe('45 min');
    expect(simple(duree(130 * 60000))).toBe('2 h 10');
    expect(simple(duree(120 * 60000))).toBe('2 h');
  });

  it('champ date-heure : aller-retour', () => {
    const t = new Date(2026, 10, 15, 21, 5).getTime();
    expect(versChampDateHeure(t)).toBe('2026-11-15T21:05');
    expect(depuisChampDateHeure('2026-11-15T21:05')).toBe(t);
    expect(depuisChampDateHeure('')).toBeNull();
  });

  it('lecture d\'un nombre tapé avec une virgule ou un point', () => {
    expect(lireNombre('6,5')).toBe(6.5);
    expect(lireNombre(' 12.25 ')).toBe(12.25);
    expect(lireNombre('')).toBeNull();
    expect(lireNombre('abc')).toBeNull();
  });
});
