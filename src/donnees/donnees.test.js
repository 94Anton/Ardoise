// Tests de la couche de données, sur une vraie base IndexedDB simulée en mémoire.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, reinitialiserBase } from './db.js';
import {
  ajouterConsommation, annulerAjout, demarrerSoiree, ecrireParametres, enregistrerBoisson,
  enregistrerCocktail, enregistrerContenant, enregistrerObjectif, enregistrerSoiree, modifierConsommation,
  recalculerPourBoisson, reprendreLeMeme, supprimerBoisson, supprimerCategorie, supprimerContenant,
  supprimerSoiree, terminerSoiree,
} from './actions.js';
import { csvConsommations, csvSoirees, exporterDonnees, importerDonnees, verifierSauvegarde } from './sauvegarde.js';
import { combinaisonsRecentes, dernierPrix, indexerParId, lireParametres } from './selecteurs.js';

const le = (a, m, j, h = 12, min = 0) => new Date(a, m - 1, j, h, min).getTime();

/** Retrouve l'id d'une catégorie ou d'un contenant préremplis par son nom. */
const idParNom = async (table, nom) => (await db.table(table).where('nom').equals(nom).first()).id;

beforeEach(async () => {
  await reinitialiserBase();
});

describe('premier lancement', () => {
  it('préremplit les catégories et les contenants', async () => {
    expect(await db.categories.count()).toBe(15);
    expect(await db.contenants.count()).toBe(8);
    const pinte = await db.contenants.where('nom').equals('Pinte').first();
    expect(pinte.volumeML).toBe(500);
    const diluants = await db.categories.where('nom').equals('Diluants (sans alcool)').first();
    expect(diluants.alcoolisee).toBe(false);
    expect(lireParametres(await db.parametres.toArray())).toMatchObject({ poidsKg: 67, sexe: 'homme', gParVerre: 10, r: 0.7 });
  });
});

describe('saisie d\'une consommation', () => {
  it('fige un snapshot au moment de la saisie', async () => {
    const leffe = await enregistrerBoisson({ nom: 'Leffe Blonde', categorieId: await idParNom('categories', 'Bière'), degre: 5 });
    const { id } = await ajouterConsommation({
      type: 'boisson', refId: leffe, contenantId: await idParNom('contenants', 'Pinte'), volumeML: 500, prixEuros: 7,
    });
    const c = await db.consommations.get(id);
    expect(c.snapshot.gAlcool).toBeCloseTo(20, 10);
    expect(c.snapshot.nom).toBe('Leffe Blonde');

    // On corrige le degré plus tard : l'historique ne bouge pas…
    await enregistrerBoisson({ id: leffe, nom: 'Leffe Blonde', categorieId: c.snapshot.composants[0].categorieId, degre: 6.6 });
    expect((await db.consommations.get(id)).snapshot.gAlcool).toBeCloseTo(20, 10);
    // … sauf si on demande explicitement de recalculer.
    expect(await recalculerPourBoisson(leffe)).toBe(1);
    expect((await db.consommations.get(id)).snapshot.gAlcool).toBeCloseTo(26.4, 10);
  });

  it('crée une boisson et un contenant personnalisé, puis un cocktail à 3 ingrédients', async () => {
    const rhum = await enregistrerBoisson({ nom: 'Havana Club 3 ans', categorieId: await idParNom('categories', 'Rhum'), degre: 40, kcalParL: 2310, sucreGParL: 0 });
    const diluants = await idParNom('categories', 'Diluants (sans alcool)');
    const sirop = await enregistrerBoisson({ nom: 'Sirop de sucre', categorieId: diluants, degre: 0, kcalParL: 2600, sucreGParL: 650 });
    const eau = await enregistrerBoisson({ nom: 'Eau gazeuse', categorieId: diluants, degre: 0, kcalParL: 0, sucreGParL: 0 });
    const chope = await enregistrerContenant({ nom: 'Chope', volumeML: 400 });
    expect((await db.contenants.get(chope)).predefini).toBe(false);

    const mojito = await enregistrerCocktail({
      nom: 'Mojito',
      ingredients: [{ boissonId: rhum, volumeML: 50 }, { boissonId: sirop, volumeML: 20 }, { boissonId: eau, volumeML: 130 }],
    });
    const { id } = await ajouterConsommation({ type: 'cocktail', refId: mojito });
    const c = await db.consommations.get(id);
    expect(c.volumeML).toBe(200);
    expect(c.snapshot.degre).toBeCloseTo(10, 10);
    expect(c.snapshot.gAlcool).toBeCloseTo(16, 10);
    expect(c.snapshot.kcal).toBeCloseTo(167.5, 10);
    expect(c.snapshot.sucreG).toBeCloseTo(13, 10);
  });

  it('refuse une boisson sans nom ou avec un degré impossible', async () => {
    const biere = await idParNom('categories', 'Bière');
    await expect(enregistrerBoisson({ nom: ' ', categorieId: biere, degre: 5 })).rejects.toThrow(/nom/);
    await expect(enregistrerBoisson({ nom: 'X', categorieId: biere, degre: 120 })).rejects.toThrow(/degré/);
  });
});

describe('objectifs et alertes à la saisie', () => {
  it('renvoie une alerte à 80 %, puis à 100 %', async () => {
    const maintenant = le(2026, 11, 15, 21);
    const leffe = await enregistrerBoisson({ nom: 'Leffe', categorieId: await idParNom('categories', 'Bière'), degre: 5 });
    await enregistrerObjectif({ nom: 'Max 10 verres par semaine', unite: 'verres', limite: 10, periode: 'semaine' }, maintenant);
    const pinte = { type: 'boisson', refId: leffe, volumeML: 500 };

    const alertes = [];
    for (let i = 0; i < 5; i += 1) {
      const r = await ajouterConsommation({ ...pinte, horodatage: maintenant }, maintenant);
      alertes.push(r.alertes.map((a) => a.type));
    }
    // 2, 4, 6 verres : rien ; 8 verres : seuil de 80 % ; 10 verres : limite atteinte.
    expect(alertes).toEqual([[], [], [], ['seuil'], ['limite']]);
  });
});

describe('soirées', () => {
  it('une seule soirée en cours ; la terminer ; supprimer détache les consommations', async () => {
    const debut = le(2026, 11, 14, 21);
    const soiree = await demarrerSoiree('Anniv de Paul', debut);
    await expect(demarrerSoiree('Autre', debut)).rejects.toThrow(/déjà en cours/);

    const leffe = await enregistrerBoisson({ nom: 'Leffe', categorieId: await idParNom('categories', 'Bière'), degre: 5 });
    const { id } = await ajouterConsommation({ type: 'boisson', refId: leffe, volumeML: 500, soireeId: soiree, horodatage: debut + 60000 });

    await terminerSoiree(soiree, le(2026, 11, 15, 1));
    await enregistrerSoiree(soiree, { ressenti: 6, repas: 8, hydratation: 4, fatigue: 3 });
    expect(await db.soirees.get(soiree)).toMatchObject({ titre: 'Anniv de Paul', ressenti: 6, gueuleDeBois: null });

    await supprimerSoiree(soiree);
    expect(await db.soirees.count()).toBe(0);
    expect((await db.consommations.get(id)).soireeId).toBeNull();
  });

  it('saisie après coup : crée la soirée, élargit ses bornes, et l\'annulation la retire', async () => {
    const leffe = await enregistrerBoisson({ nom: 'Leffe', categorieId: await idParNom('categories', 'Bière'), degre: 5 });
    const t1 = le(2026, 11, 7, 22);
    const r1 = await ajouterConsommation({ type: 'boisson', refId: leffe, volumeML: 500, horodatage: t1, nouvelleSoiree: { titre: 'Samedi' } });
    expect(r1.soireeCreeeId).not.toBeNull();
    await ajouterConsommation({ type: 'boisson', refId: leffe, volumeML: 500, horodatage: t1 - 3600000, soireeId: r1.soireeCreeeId });
    const r3 = await ajouterConsommation({ type: 'boisson', refId: leffe, volumeML: 500, horodatage: t1 + 7200000, soireeId: r1.soireeCreeeId });
    expect(await db.soirees.get(r1.soireeCreeeId)).toMatchObject({ debut: t1 - 3600000, fin: t1 + 7200000 });

    await annulerAjout(r3);
    expect(await db.consommations.count()).toBe(2);
    expect(await db.soirees.count()).toBe(1); // la soirée garde ses autres consommations
  });

  it('« reprendre le même » duplique la dernière consommation dans la soirée en cours', async () => {
    const leffe = await enregistrerBoisson({ nom: 'Leffe', categorieId: await idParNom('categories', 'Bière'), degre: 5 });
    const pinte = await idParNom('contenants', 'Pinte');
    await ajouterConsommation({ type: 'boisson', refId: leffe, contenantId: pinte, volumeML: 500, prixEuros: 7, horodatage: le(2026, 11, 10) });
    const soiree = await demarrerSoiree('Ce soir', le(2026, 11, 15, 20));
    const r = await reprendreLeMeme(le(2026, 11, 15, 20, 30));
    expect(await db.consommations.get(r.id)).toMatchObject({
      refId: leffe, contenantId: pinte, volumeML: 500, prixEuros: 7, soireeId: soiree, horodatage: le(2026, 11, 15, 20, 30),
    });
  });
});

describe('dataset', () => {
  it('une boisson déjà consommée est archivée, pas supprimée', async () => {
    const biere = await idParNom('categories', 'Bière');
    const consommee = await enregistrerBoisson({ nom: 'Leffe', categorieId: biere, degre: 5 });
    const jamaisBue = await enregistrerBoisson({ nom: 'Kwak', categorieId: biere, degre: 8.4 });
    await ajouterConsommation({ type: 'boisson', refId: consommee, volumeML: 500 });

    expect(await supprimerBoisson(consommee)).toBe('archivee');
    expect(await supprimerBoisson(jamaisBue)).toBe('supprimee');
    expect((await db.boissons.get(consommee)).archive).toBe(true);
    expect(await db.boissons.get(jamaisBue)).toBeUndefined();
    await expect(supprimerCategorie(biere)).rejects.toThrow(/contient encore 1 boisson/);
  });

  it('supprimer un contenant conserve le volume des consommations passées', async () => {
    const leffe = await enregistrerBoisson({ nom: 'Leffe', categorieId: await idParNom('categories', 'Bière'), degre: 5 });
    const chope = await enregistrerContenant({ nom: 'Chope', volumeML: 400 });
    const { id } = await ajouterConsommation({ type: 'boisson', refId: leffe, contenantId: chope, volumeML: 400 });
    await supprimerContenant(chope);
    expect(await db.consommations.get(id)).toMatchObject({ contenantId: null, volumeML: 400 });
  });

  it('raccourcis : combinaisons récentes sans doublon et dernier prix payé', async () => {
    const biere = await idParNom('categories', 'Bière');
    const leffe = await enregistrerBoisson({ nom: 'Leffe', categorieId: biere, degre: 5 });
    const kwak = await enregistrerBoisson({ nom: 'Kwak', categorieId: biere, degre: 8.4 });
    const pinte = await idParNom('contenants', 'Pinte');
    const demi = await idParNom('contenants', 'Demi');
    await ajouterConsommation({ type: 'boisson', refId: leffe, contenantId: pinte, volumeML: 500, prixEuros: 6.5, horodatage: 1000 });
    await ajouterConsommation({ type: 'boisson', refId: kwak, contenantId: demi, volumeML: 250, horodatage: 2000 });
    await ajouterConsommation({ type: 'boisson', refId: leffe, contenantId: pinte, volumeML: 500, prixEuros: 7, horodatage: 3000 });
    await ajouterConsommation({ type: 'boisson', refId: leffe, contenantId: demi, volumeML: 250, horodatage: 4000 });

    const consommations = (await db.consommations.toArray()).sort((a, b) => b.horodatage - a.horodatage);
    const donnees = { boissonsParId: indexerParId(await db.boissons.toArray()), cocktailsParId: new Map() };
    const recents = combinaisonsRecentes(consommations, donnees);
    expect(recents.map((r) => [r.refId, r.contenantId])).toEqual([[leffe, demi], [leffe, pinte], [kwak, demi]]);
    expect(dernierPrix(consommations, 'boisson', leffe, 500)).toBe(7);
    expect(dernierPrix(consommations, 'boisson', kwak, 250)).toBeNull();
  });
});

describe('modification d\'une consommation', () => {
  it('recalcule le snapshot seulement si le volume change', async () => {
    const leffe = await enregistrerBoisson({ nom: 'Leffe', categorieId: await idParNom('categories', 'Bière'), degre: 5 });
    const { id } = await ajouterConsommation({ type: 'boisson', refId: leffe, volumeML: 500 });
    await modifierConsommation(id, { quantite: 2, prixEuros: 6 });
    expect(await db.consommations.get(id)).toMatchObject({ quantite: 2, prixEuros: 6 });
    expect((await db.consommations.get(id)).snapshot.gAlcool).toBeCloseTo(20, 10);
    await modifierConsommation(id, { volumeML: 250 });
    expect((await db.consommations.get(id)).snapshot.gAlcool).toBeCloseTo(10, 10);
  });
});

describe('sauvegarde', () => {
  /** Remplit la base avec un peu de tout. */
  async function remplir() {
    const biere = await idParNom('categories', 'Bière');
    const rhum = await idParNom('categories', 'Rhum');
    const leffe = await enregistrerBoisson({ nom: 'Leffe "Blonde", 33 cL', categorieId: biere, degre: 6.6, kcalParL: 560, favori: true });
    const havana = await enregistrerBoisson({ nom: 'Havana Club', categorieId: rhum, degre: 40 });
    const cocktail = await enregistrerCocktail({ nom: 'Rhum sec', ingredients: [{ boissonId: havana, volumeML: 40 }] });
    await enregistrerContenant({ nom: 'Chope', volumeML: 400 });
    const soiree = await demarrerSoiree('Anniv de Paul', le(2026, 11, 14, 21));
    await ajouterConsommation({ type: 'boisson', refId: leffe, volumeML: 500, prixEuros: 7, soireeId: soiree, horodatage: le(2026, 11, 14, 21, 30) });
    await ajouterConsommation({ type: 'cocktail', refId: cocktail, quantite: 2, soireeId: soiree, horodatage: le(2026, 11, 14, 23) });
    await terminerSoiree(soiree, le(2026, 11, 15, 1));
    await enregistrerSoiree(soiree, { ressenti: 6, repas: 8, hydratation: 4, fatigue: 3, gueuleDeBois: 5, notes: 'Bonne soirée,\nrentré à pied' });
    await enregistrerObjectif({ nom: 'Max 20 verres par mois', unite: 'verres', limite: 20, periode: 'mois' });
    await ecrireParametres({ poidsKg: 70 });
  }

  it('export JSON, réinitialisation, import JSON : tout est restauré (critère du cahier des charges)', async () => {
    await remplir();
    const sauvegarde = await exporterDonnees();
    // Passage par du texte, comme dans un vrai fichier.
    const fichier = JSON.parse(JSON.stringify(sauvegarde));

    await reinitialiserBase();
    expect(await db.consommations.count()).toBe(0);
    expect(await db.boissons.count()).toBe(0);
    expect(lireParametres(await db.parametres.toArray()).poidsKg).toBe(67);

    await importerDonnees(fichier);
    const restauree = await exporterDonnees();
    expect(restauree.tables).toEqual(sauvegarde.tables);
    expect(await db.consommations.count()).toBe(2);
    expect(lireParametres(await db.parametres.toArray()).poidsKg).toBe(70);

    // Les identifiants repartent après le plus grand existant : pas de collision.
    const nouvelle = await enregistrerBoisson({ nom: 'Kwak', categorieId: sauvegarde.tables.categories[0].id, degre: 8.4 });
    expect(sauvegarde.tables.boissons.map((b) => b.id)).not.toContain(nouvelle);
  });

  it('refuse un fichier qui n\'est pas une sauvegarde, sans rien effacer', async () => {
    await remplir();
    expect(() => verifierSauvegarde({ nimporte: 'quoi' })).toThrow(/pas une sauvegarde/);
    await expect(importerDonnees({ format: 'ardoise-sauvegarde', version: 1, tables: { boissons: [] } })).rejects.toThrow(/incomplète/);
    await expect(importerDonnees({ format: 'ardoise-sauvegarde', version: 99, tables: {} })).rejects.toThrow(/plus récente/);
    expect(await db.consommations.count()).toBe(2);
  });

  it('export CSV des consommations et des soirées', async () => {
    await remplir();
    const donnees = {
      consommations: await db.consommations.toArray(),
      categories: await db.categories.toArray(),
      contenants: await db.contenants.toArray(),
      soirees: await db.soirees.toArray(),
      parametres: lireParametres(await db.parametres.toArray()),
    };
    const lignes = csvConsommations(donnees).trim().split('\n');
    expect(lignes).toHaveLength(3);
    expect(lignes[0].startsWith('id,date_heure,type,nom,categorie')).toBe(true);
    // Les guillemets et virgules du nom sont protégés.
    expect(lignes[1]).toContain('2026-11-14T21:30,boisson,"Leffe ""Blonde"", 33 cL",Bière,,500,1,6.6,26.4,2.64,280,0');
    expect(lignes[2]).toContain('cocktail,Rhum sec,Rhum,,40,2,40,25.6,2.56');

    const csv = csvSoirees(donnees);
    expect(csv).toContain('Anniv de Paul,2026-11-14T21:00,2026-11-15T01:00,4,3,52,5.2');
    expect(csv).toContain('"Bonne soirée,\nrentré à pied"');
  });
});
