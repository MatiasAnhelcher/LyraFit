/**
 * El logo, generado desde la mascota.
 *
 * El favicon y los íconos de la PWA son Lyra, y tienen que ser LA MISMA Lyra
 * que `src/componentes/lyra.tsx`: si se dibujaran aparte, la primera vez que
 * alguien toque el degradé el logo y la mascota pasarían a ser dos criaturas
 * parecidas, que es peor que dos criaturas distintas.
 *
 * Así que esto no copia nada: lee el degradé del cuerpo y los tres trazos de la
 * cresta del componente, y calcula la estrella con la misma cuenta. Si el
 * componente cambia de forma y el `regex` deja de encontrar lo que busca, esto
 * falla ruidosamente en vez de generar un logo viejo en silencio.
 *
 * Uso: node logo.mjs   →   public/favicon.svg, icon-192.png, icon-512.png,
 *                         icon-512-maskable.png
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

// El cuerpo y la cresta se LEEN del componente, no se copian: si se copiaran,
// en dos semanas el logo y la mascota serían dos criaturas parecidas.
const tsx = readFileSync('src/componentes/lyra.tsx', 'utf8')
const grad = [...tsx.matchAll(/id="lyCuerpo"[\s\S]*?<\/radialGradient>/g)][0][0]
const paradas = [...grad.matchAll(/offset="([\d%]+)" stopColor="(#[0-9A-Fa-f]+)"/g)]
  .map(([, o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('\n      ')
const cresta = [...tsx.matchAll(/<path d="(M50 2[^"]*|M41 10[^"]*|M59 10[^"]*)" fill="url\(#lyCresta\)" opacity="([\d.]+)"/g)]
  .map(([, d, o]) => `<path d="${d}" fill="url(#k)" opacity="${o}"/>`).join('\n    ')
if (paradas.split('<stop').length - 1 !== 4 || cresta.split('<path').length - 1 !== 3) {
  console.error('No se pudo leer el cuerpo o la cresta del componente.'); process.exit(2)
}

function puntas(cx, cy, afuera, adentro, n = 5) {
  const rot = -Math.PI / 2, p = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? adentro : afuera
    const a = rot + (i * Math.PI) / n
    p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return p
}
function suavizar(p) {
  const n = p.length
  let d = `M ${p[0][0].toFixed(2)} ${p[0][1].toFixed(2)} `
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += `C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)} `
  }
  return d + 'Z'
}
const CUERPO = suavizar(puntas(50, 54, 41, 30))

/**
 * El SVG del logo. `sangre` es la variante para la máscara de Android: el
 * cuadrado entero, sin radio, porque la forma la recorta el sistema, y Lyra
 * achicada `escala` veces alrededor del centro para que entre en el círculo
 * que el sistema garantiza no recortar.
 */
const svgDe = ({ sangre = false, escala = 1 } = {}) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="LyraFit">
  <!-- LYRA, en el naranja de Vega — que es la estrella alfa de la constelación
       de Lyra, así que el color y el nombre eran la misma cosa desde siempre.
       Generado por zz-logo desde src/componentes/lyra.tsx: el cuerpo, el
       degradé y la cresta son los mismos que los de la mascota, no una copia. -->
  <defs>
    <radialGradient id="c" cx="38%" cy="30%" r="78%">
      ${paradas}
    </radialGradient>
    <linearGradient id="k" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#B03A0C"/>
      <stop offset="100%" stop-color="#FFC08A"/>
    </linearGradient>
    <radialGradient id="h" cx="50%" cy="48%" r="55%">
      <stop offset="0%" stop-color="rgba(255,138,84,0.45)"/>
      <stop offset="100%" stop-color="rgba(255,122,69,0)"/>
    </radialGradient>
  </defs>
  <rect width="100" height="100"${sangre ? '' : ' rx="22"'} fill="#07090C"/>
  <g id="lyra" transform="${escala === 1 ? '' : `translate(50 50) scale(${escala}) translate(-50 -50) `}translate(4.3 6.3) scale(0.92)">
    <circle cx="50" cy="52" r="46" fill="url(#h)"/>
    ${cresta}
    <path d="${CUERPO}" fill="url(#c)" stroke="rgba(255,236,220,0.45)" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="${CUERPO}" fill="none" stroke="rgba(90,28,4,0.28)" stroke-width="2" clip-path="inset(55% 0 0 0)"/>
    <ellipse cx="38" cy="36" rx="11" ry="7" fill="rgba(255,255,255,0.5)" transform="rotate(-28 38 36)"/>
    <g fill="#2A1206">
      <ellipse cx="41" cy="51" rx="3.5" ry="4.6"/>
      <ellipse cx="59" cy="51" rx="3.5" ry="4.6"/>
    </g>
    <circle cx="42.4" cy="49.2" r="1.35" fill="#fff"/>
    <circle cx="60.4" cy="49.2" r="1.35" fill="#fff"/>
    <path d="M43 58 Q50 65 57 58" fill="none" stroke="#2A1206" stroke-width="2.6" stroke-linecap="round"/>
  </g>
</svg>
`
const svg = svgDe()
writeFileSync('public/favicon.svg', svg)

const nav = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' })
const ctx = await nav.newContext({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 })
const p = await ctx.newPage()

/*
 * Cuánto achicar a Lyra en la variante a sangre. El círculo seguro de un
 * ícono enmascarable tiene radio 40 de 100: lo de afuera el sistema puede
 * recortarlo. Se mide sobre los trazos de verdad —la cresta y el cuerpo, sin
 * el halo, que se desvanece solo— y no sobre su caja, que en las esquinas
 * queda más lejos que la forma y achicaría de más.
 */
await p.setContent(svgDe({ sangre: true }))
const lejos = await p.evaluate(() => {
  let max = 0
  const raiz = document.querySelector('svg').getScreenCTM().inverse()
  for (const el of document.querySelectorAll('#lyra > path')) {
    // De las coordenadas del trazo a las del viewBox de 100.
    const m = raiz.multiply(el.getScreenCTM())
    const largo = el.getTotalLength()
    for (let i = 0; i <= 400; i++) {
      const q = el.getPointAtLength((largo * i) / 400).matrixTransform(m)
      max = Math.max(max, Math.hypot(q.x - 50, q.y - 50))
    }
  }
  return max
})
const escala = Number((38 / lejos).toFixed(3))

// Las esquinas del cuadrado redondeado salen transparentes: sobre un body
// blanco y sin `omitBackground`, la captura las pintaba blancas, y así se
// veían en el escritorio y en los atajos.
const capturar = async (contenido, px, archivo) => {
  await p.setViewportSize({ width: px, height: px })
  await p.setContent(
    `<body style="margin:0;background:transparent">${contenido.replace('<svg ', `<svg width="${px}" height="${px}" `)}</body>`,
  )
  await p.waitForTimeout(200)
  await p.screenshot({ path: `public/${archivo}`, omitBackground: true })
}
for (const px of [192, 512]) await capturar(svg, px, `icon-${px}.png`)
await capturar(svgDe({ sangre: true, escala }), 512, 'icon-512-maskable.png')
await nav.close()
console.log(`logo listo (Lyra a ${escala} en el enmascarable: lo más lejano quedaba a ${lejos.toFixed(1)} del centro)`)
