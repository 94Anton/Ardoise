// ---------------------------------------------------------------------------
// Graphiques (bibliothèque Chart.js) : barres par semaine ou par mois, courbe
// d'alcoolémie d'une soirée, nuage de points alcool × ressenti.
//
// Règles suivies : une seule teinte pour une seule série, barres fines aux
// bouts arrondis, grille discrète, un seul axe vertical, et chaque valeur
// accessible autrement que par l'infobulle (tableau sous le graphique).
// ---------------------------------------------------------------------------

import {
  BarController, BarElement, CategoryScale, Chart, Filler, LineController, LineElement, LinearScale,
  PointElement, ScatterController, Tooltip,
} from 'chart.js';
import { Bar, Line, Scatter } from 'react-chartjs-2';
import { useCouleurs } from '../utilitaires/crochets.js';
import { heure, nombre } from '../calculs/format.js';

// Chart.js est modulaire : on n'embarque que les éléments utilisés.
Chart.register(
  BarController, BarElement, CategoryScale, Filler, LineController, LineElement, LinearScale,
  PointElement, ScatterController, Tooltip,
);

const HEURE_MS = 3600 * 1000;

/** Ajoute de la transparence à une couleur « #rrggbb ». */
function alpha(hex, opacite) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacite})`;
}

/** Réglages communs : police, couleurs des axes, infobulle. */
function optionsCommunes(c) {
  const police = { family: c.police, size: 12.5 };
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    police,
    axe: {
      ticks: { color: c.encre3, font: police },
      grid: { color: c.trait, lineWidth: 1 },
      border: { display: false },
    },
    infobulle: {
      backgroundColor: c.encre,
      titleColor: c.fond,
      bodyColor: c.fond,
      titleFont: { family: c.police, size: 13, weight: '400' },
      bodyFont: { family: c.police, size: 15, weight: '700' },
      padding: 10,
      cornerRadius: 8,
      displayColors: false,
    },
  };
}

// Trace la limite d'un objectif : un trait pointillé horizontal avec son libellé.
const pluginLimite = {
  id: 'limite',
  afterDatasetsDraw(chart, _args, options) {
    if (options.valeur === null || options.valeur === undefined) return;
    const { ctx, chartArea, scales } = chart;
    const y = scales.y.getPixelForValue(options.valeur);
    if (y < chartArea.top - 1 || y > chartArea.bottom + 1) return;
    ctx.save();
    ctx.strokeStyle = options.couleur;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(chartArea.left, y);
    ctx.lineTo(chartArea.right, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `600 12.5px ${options.police}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    // Petit fond sous le libellé : il reste lisible quand il passe devant une barre.
    const largeur = ctx.measureText(options.texte).width;
    ctx.fillStyle = options.fond;
    ctx.beginPath();
    // roundRect n'existe pas sur les vieux Safari : rectangle simple dans ce cas.
    if (ctx.roundRect) ctx.roundRect(chartArea.right - largeur - 7, y - 23, largeur + 9, 19, 5);
    else ctx.rect(chartArea.right - largeur - 7, y - 23, largeur + 9, 19);
    ctx.fill();
    ctx.fillStyle = options.couleur;
    ctx.fillText(options.texte, chartArea.right - 2, y - 5);
    ctx.restore();
  },
};

/**
 * Barres : une par semaine ou par mois. La dernière (période en cours) est
 * plus pâle, puisqu'elle n'est pas terminée.
 *
 * @param {string[]} etiquettes  texte sous chaque barre
 * @param {string[]} titres      texte complet de chaque période (infobulle)
 * @param {number[]} valeurs
 * @param {function} formater    met en forme une valeur avec son unité
 * @param {{valeur:number, texte:string}|null} limite  objectif à tracer
 */
export function GraphiqueBarres({ etiquettes, titres, valeurs, formater, limite = null, description }) {
  const c = useCouleurs();
  const commun = optionsCommunes(c);
  const dernier = valeurs.length - 1;
  return (
    <div className="graphique graphique--barres">
      <Bar
        role="img"
        aria-label={description}
        data={{
          labels: etiquettes,
          datasets: [{
            data: valeurs,
            backgroundColor: valeurs.map((_, i) => (i === dernier ? alpha(c.donnee, 0.5) : c.donnee)),
            hoverBackgroundColor: c.encre,
            borderRadius: { topLeft: 4, topRight: 4 },
            borderSkipped: 'bottom',
            maxBarThickness: 24,
            categoryPercentage: 0.82,
            barPercentage: 0.86,
          }],
        }}
        options={{
          responsive: commun.responsive,
          maintainAspectRatio: commun.maintainAspectRatio,
          animation: commun.animation,
          layout: { padding: { top: 20 } },
          scales: {
            x: {
              ...commun.axe,
              grid: { display: false },
              border: { display: true, color: c.trait },
              ticks: { ...commun.axe.ticks, maxRotation: 0, autoSkip: true, autoSkipPadding: 10 },
            },
            y: {
              ...commun.axe,
              beginAtZero: true,
              // On laisse la place de voir la limite même si aucune barre ne l'atteint.
              suggestedMax: limite ? limite.valeur * 1.12 : undefined,
              ticks: { ...commun.axe.ticks, maxTicksLimit: 5, callback: (v) => nombre(v, 1) },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              ...commun.infobulle,
              callbacks: {
                title: (items) => titres[items[0].dataIndex],
                label: (item) => formater(item.parsed.y),
              },
            },
            limite: limite ? { valeur: limite.valeur, texte: limite.texte, couleur: c.encre, fond: alpha(c.fond, 0.88), police: c.police } : { valeur: null },
          },
        }}
        plugins={[pluginLimite]}
      />
    </div>
  );
}

/**
 * Courbe d'alcoolémie estimée d'une soirée (modèle de Widmark).
 * @param {Array<{t:number, c:number}>} points  résultat de simulerAlcoolemie()
 */
export function CourbeAlcoolemie({ points, description }) {
  const c = useCouleurs();
  const commun = optionsCommunes(c);
  if (points.length === 0) return null;
  const debut = points[0].t;
  const fin = points[points.length - 1].t;
  // Une graduation par heure pleine, ou toutes les 2 ou 3 h si la courbe est longue.
  const dureeH = (fin - debut) / HEURE_MS;
  const pasH = dureeH > 14 ? 3 : dureeH > 7 ? 2 : 1;
  return (
    <div className="graphique graphique--courbe">
      <Line
        role="img"
        aria-label={description}
        data={{
          datasets: [{
            data: points.map((p) => ({ x: p.t, y: p.c })),
            borderColor: c.donnee,
            borderWidth: 2,
            borderJoinStyle: 'round',
            pointRadius: 0,
            pointHitRadius: 14,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: c.donnee,
            pointHoverBorderColor: c.fond,
            pointHoverBorderWidth: 2,
            fill: true,
            backgroundColor: alpha(c.donnee, 0.1),
          }],
        }}
        options={{
          responsive: commun.responsive,
          maintainAspectRatio: commun.maintainAspectRatio,
          animation: commun.animation,
          parsing: false,
          interaction: { mode: 'nearest', axis: 'x', intersect: false },
          layout: { padding: { top: 8, right: 6 } },
          scales: {
            x: {
              ...commun.axe,
              type: 'linear',
              min: debut,
              max: fin,
              grid: { display: false },
              border: { display: true, color: c.trait },
              afterBuildTicks: (axe) => {
                const ticks = [];
                const premiere = new Date(debut);
                premiere.setMinutes(0, 0, 0);
                for (let t = premiere.getTime(); t <= fin; t += HEURE_MS) {
                  if (t >= debut && new Date(t).getHours() % pasH === 0) ticks.push({ value: t });
                }
                axe.ticks = ticks;
              },
              ticks: { ...commun.axe.ticks, maxRotation: 0, callback: (v) => heure(v) },
            },
            y: {
              ...commun.axe,
              beginAtZero: true,
              ticks: { ...commun.axe.ticks, maxTicksLimit: 5, callback: (v) => nombre(v, 2) },
              title: { display: true, text: 'g/L', color: c.encre3, font: commun.police },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              ...commun.infobulle,
              callbacks: {
                title: (items) => heure(items[0].parsed.x),
                label: (item) => `≈ ${nombre(item.parsed.y, 2)} g/L`,
              },
            },
          },
        }}
      />
    </div>
  );
}

/** Tranches de la note de repas, pour colorer le nuage de points. */
export const TRANCHES_REPAS = [
  { libelle: 'Peu mangé (1 à 3)', test: (n) => n <= 3 },
  { libelle: 'Repas moyen (4 à 7)', test: (n) => n >= 4 && n <= 7 },
  { libelle: 'Bien mangé (8 à 10)', test: (n) => n >= 8 },
];

/**
 * Nuage de points : grammes d'alcool (horizontal) × ressenti (vertical),
 * teinte plus ou moins soutenue selon la note de repas.
 * @param {Array<{x:number, y:number, repas:number, titre:string}>} points
 */
export function NuageRessenti({ points, description }) {
  const c = useCouleurs();
  const commun = optionsCommunes(c);
  return (
    <>
      <div className="graphique graphique--nuage">
        <Scatter
          role="img"
          aria-label={description}
          data={{
            datasets: TRANCHES_REPAS.map((tranche, i) => ({
              label: tranche.libelle,
              data: points.filter((p) => tranche.test(p.repas)),
              backgroundColor: c.rampe[i],
              // Anneau de la couleur du fond : les points restent lisibles quand ils se chevauchent.
              borderColor: c.fond,
              borderWidth: 2,
              pointRadius: 7,
              pointHoverRadius: 9,
              pointHitRadius: 16,
            })),
          }}
          options={{
            responsive: commun.responsive,
            maintainAspectRatio: commun.maintainAspectRatio,
            animation: commun.animation,
            layout: { padding: { top: 10, right: 10 } },
            scales: {
              x: {
                ...commun.axe,
                beginAtZero: true,
                border: { display: true, color: c.trait },
                ticks: { ...commun.axe.ticks, maxTicksLimit: 6, callback: (v) => nombre(v, 0) },
                title: { display: true, text: "Alcool pur de la soirée (g)", color: c.encre3, font: commun.police },
              },
              y: {
                ...commun.axe,
                min: 0,
                max: 10.5,
                ticks: { ...commun.axe.ticks, stepSize: 2, callback: (v) => (Number.isInteger(v) ? v : '') },
                title: { display: true, text: 'Ressenti (1 à 10)', color: c.encre3, font: commun.police },
              },
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                ...commun.infobulle,
                callbacks: {
                  title: (items) => items[0].raw.titre,
                  label: (item) => `${nombre(item.raw.x, 0)} g, ressenti ${item.raw.y}, repas ${item.raw.repas}`,
                },
              },
            },
          }}
        />
      </div>
      <div className="legende">
        {TRANCHES_REPAS.map((tranche, i) => (
          <span key={tranche.libelle} className="legende__item">
            <span className="legende__rond" style={{ background: c.rampe[i] }} />
            {tranche.libelle}
          </span>
        ))}
      </div>
    </>
  );
}
