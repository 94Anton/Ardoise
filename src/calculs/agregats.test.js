import { describe, expect, it } from 'vitest';
import { snapshotBoisson, snapshotCocktail } from './alcool.js';
import { chiffresClesMois, joursSansAlcool, repartition, serieParPeriode, totaux } from './agregats.js';

const le = (a, m, j, h = 12) => new Date(a, m - 1, j, h).getTime();

const BIERE = 1;
const RHUM = 8;
const DILUANTS = 15;
const leffe = { id: 1, nom: 'Leffe Blonde', categorieId: BIERE, degre: 5, kcalParL: 450, sucreGParL: 30 };
const chouffe = { id: 2, nom: 'La Chouffe', categorieId: BIERE, degre: 8, kcalParL: null, sucreGParL: null };
const rhum = { id: 10, nom: 'Rhum blanc', categorieId: RHUM, degre: 40, kcalParL: 2310, sucreGParL: 0 };
const sirop = { id: 11, nom: 'Sirop de sucre', categorieId: DILUANTS, degre: 0, kcalParL: 2600, sucreGParL: 650 };
const boissons = new Map([[1, leffe], [2, chouffe], [10, rhum], [11, sirop]]);
const mojito = { id: 1, nom: 'Mojito', ingredients: [{ boissonId: 10, volumeML: 50 }, { boissonId: 11, volumeML: 20 }] };

let id = 1;
const conso = (boisson, volumeML, horodatage, extra = {}) => ({
  id: id++, horodatage, type: 'boisson', refId: boisson.id, volumeML, quantite: 1, prixEuros: null,
  soireeId: null, snapshot: snapshotBoisson(boisson, volumeML), ...extra,
});
const consoMojito = (horodatage, extra = {}) => ({
  id: id++, horodatage, type: 'cocktail', refId: 1, volumeML: 70, quantite: 1, prixEuros: 10,
  soireeId: null, snapshot: snapshotCocktail(mojito, boissons), ...extra,
});

describe('totaux', () => {
  it('additionne et signale les données incomplètes', () => {
    const t = totaux([
      conso(leffe, 500, le(2026, 11, 14), { prixEuros: 7, quantite: 2 }),
      conso(chouffe, 330, le(2026, 11, 14)),
    ]);
    expect(t.nombre).toBe(3);
    expect(t.gAlcool).toBeCloseTo(40 + 21.12, 6);
    expect(t.verres).toBeCloseTo(6.112, 6);
    expect(t.kcal).toBeCloseTo(450 + 21.12 * 7, 6);
    expect(t.kcalEstimee).toBe(true); // la Chouffe n'a pas de kcal renseignées
    expect(t.sucreG).toBeCloseTo(30, 6); // la Chouffe est exclue du total sucre
    expect(t.sucreIncomplet).toBe(true);
    expect(t.euros).toBeCloseTo(14, 6);
    expect(t.nbSansPrix).toBe(1);
  });
});

describe('série par semaine ou par mois', () => {
  const maintenant = le(2026, 11, 15, 20); // dimanche
  const consos = [
    conso(leffe, 500, le(2026, 11, 15)), // semaine du 9 novembre
    conso(leffe, 500, le(2026, 11, 9)), // semaine du 9 novembre (lundi)
    conso(leffe, 500, le(2026, 11, 8)), // semaine du 2 novembre (dimanche)
    conso(leffe, 500, le(2026, 10, 20)), // octobre
  ];

  it('par semaine, de la plus ancienne à la plus récente', () => {
    const serie = serieParPeriode(consos, { granularite: 'semaine', nb: 4, maintenant, unite: 'verres' });
    expect(serie).toHaveLength(4);
    expect(serie.map((p) => p.valeur)).toEqual([2, 0, 2, 4]);
    expect(serie[3].debut).toBe(new Date(2026, 10, 9).getTime());
  });

  it('par mois', () => {
    const serie = serieParPeriode(consos, { granularite: 'mois', nb: 3, maintenant, unite: 'g' });
    expect(serie.map((p) => p.valeur)).toEqual([0, 20, 60]);
  });
});

describe('répartition par catégorie puis par marque', () => {
  const consos = [
    conso(leffe, 500, 0), // 20 g bière
    conso(chouffe, 330, 0), // 21,12 g bière
    consoMojito(0), // 16 g rhum
  ];

  it('attribue le cocktail à ses ingrédients et trie par ordre décroissant', () => {
    const r = repartition(consos, { unite: 'g' });
    expect(r.total).toBeCloseTo(57.12, 6);
    expect(r.categories.map((c) => c.categorieId)).toEqual([BIERE, RHUM]); // diluants : 0 g, absents
    expect(r.categories[0].valeur).toBeCloseTo(41.12, 6);
    expect(r.categories[0].boissons.map((b) => b.nom)).toEqual(['La Chouffe', 'Leffe Blonde']);
    expect(r.categories[0].part + r.categories[1].part).toBeCloseTo(1, 10);
  });

  it('en kcal, les diluants apparaissent', () => {
    const r = repartition(consos, { unite: 'kcal' });
    expect(r.categories.some((c) => c.categorieId === DILUANTS)).toBe(true);
  });

  it('en euros, le prix d\'un cocktail suit la part d\'alcool de ses ingrédients', () => {
    const r = repartition(consos, { unite: 'euros' });
    expect(r.total).toBeCloseTo(10, 10); // seules les consommations avec un prix comptent
    expect(r.categories).toHaveLength(1);
    expect(r.categories[0].categorieId).toBe(RHUM);
  });
});

describe('chiffres clés du mois', () => {
  const maintenant = le(2026, 11, 15, 20);
  const soirees = [
    { id: 1, titre: 'A', debut: le(2026, 11, 7, 20), fin: le(2026, 11, 8, 1) },
    { id: 2, titre: 'B', debut: le(2026, 11, 14, 21), fin: le(2026, 11, 14, 23) },
  ];
  const consos = [
    conso(leffe, 500, le(2026, 11, 7, 21), { soireeId: 1, prixEuros: 7 }),
    conso(leffe, 500, le(2026, 11, 7, 23), { soireeId: 1, prixEuros: 7 }),
    conso(leffe, 500, le(2026, 11, 14, 22), { soireeId: 2, prixEuros: 6 }),
    conso(sirop, 20, le(2026, 11, 3)), // sans alcool : ne casse pas un « jour sans alcool »
    conso(leffe, 500, le(2026, 10, 31, 22), { prixEuros: 7 }), // octobre : hors du mois
  ];

  it('total, jours sans alcool, dépense, moyenne par soirée', () => {
    const k = chiffresClesMois(consos, soirees, maintenant, maintenant, { unite: 'verres' });
    expect(k.total).toBeCloseTo(6, 10);
    expect(k.joursEcoules).toBe(15);
    expect(k.joursSansAlcool).toBe(13); // 15 jours écoulés, alcool les 7 et 14
    expect(k.depense).toBeCloseTo(20, 10);
    expect(k.nbSoirees).toBe(2);
    expect(k.moyenneParSoiree).toBeCloseTo(3, 10); // (4 + 2) / 2
  });

  it('pour un mois terminé, tous les jours sont comptés', () => {
    expect(joursSansAlcool(consos, le(2026, 10, 1, 0), le(2026, 11, 1, 0), maintenant)).toBe(30);
  });

  it('sans soirée, pas de moyenne', () => {
    const k = chiffresClesMois([], [], maintenant, maintenant, { unite: 'verres' });
    expect(k.moyenneParSoiree).toBeNull();
    expect(k.joursSansAlcool).toBe(15);
  });
});
