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
 * Uso: node logo.mjs   →   public/favicon.svg, icon-192.png, icon-512.png
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

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="LyraFit">
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
  <rect width="100" height="100" rx="22" fill="#0b0e13"/>
  <g transform="translate(4.3 6.3) scale(0.92)">
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
writeFileSync('public/favicon.svg', svg)

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const px of [192, 512]) {
  const ctx = await nav.newContext({ viewport: { width: px, height: px }, deviceScaleFactor: 1 })
  const p = await ctx.newPage()
  await p.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${px}" height="${px}" `)}</body>`)
  await p.waitForTimeout(200)
  await p.screenshot({ path: `public/icon-${px}.png` })
  await ctx.close()
}
await nav.close()
console.log('logo listo')
