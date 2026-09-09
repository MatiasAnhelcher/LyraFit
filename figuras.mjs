/**
 * La hoja de contacto de los dibujos de ejercicios.
 *
 * Los tests de `figuras.test.ts` comprueban que la geometría cierre —que el
 * apoyo sea el punto más bajo, que nada atraviese el piso, que la mano no
 * patine—, pero que los números cierren no garantiza que la postura se parezca
 * al ejercicio. Eso hay que mirarlo, y mirarlo TODO JUNTO: lo que se juzga en
 * una cadena no es un dibujo aislado sino si la serie entera se lee como un
 * continuo.
 *
 * La hoja vive solo en desarrollo, así que esto necesita `npm run dev`
 * corriendo, no `npm run preview`.
 *
 * Uso: npm run dev &  →  node figuras.mjs  →  capturas/figuras.png
 */
import { chromium } from 'playwright'
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await nav.newContext({ viewport: { width: 1400, height: 1400 }, colorScheme: 'light', locale: 'es-AR', deviceScaleFactor: 2 })
const p = await ctx.newPage()
p.on('pageerror', (e) => console.log('JS:', e.message))
// El portero manda todo a /alta: se hace el alta, que es lo que anda seguro.
await p.goto('http://localhost:5173/#/', { waitUntil: 'networkidle' })
await p.waitForTimeout(500)
await p.getByRole('button', { name: 'Empezar', exact: true }).click()
await p.getByRole('button', { name: 'Sí, tengo barra' }).click()
await p.getByRole('button', { name: '12', exact: true }).click()
await p.getByRole('button', { name: 'Siguiente', exact: true }).click()
await p.waitForTimeout(150)
for (let i = 0; i < 3; i++) {
  for (let n = 0; n < 6; n++) await p.getByRole('button', { name: 'Sumar' }).click()
  const v = p.getByRole('button', { name: 'Ver mi plan' })
  if (await v.isVisible().catch(() => false)) await v.click()
  else await p.getByRole('button', { name: 'Siguiente', exact: true }).click()
  await p.waitForTimeout(120)
}
await p.getByRole('button', { name: 'Seguir', exact: true }).click()
await p.waitForTimeout(250)
await p.getByRole('button', { name: /Cuerpo completo/ }).click()
await p.waitForTimeout(700)
await p.goto('http://localhost:5173/#/figuras', { waitUntil: 'networkidle' })
await p.waitForTimeout(1200)
await p.screenshot({ path: 'capturas/figuras.png', fullPage: true })
// Una lámina por cadena, para poder mirarlas de cerca sin abrir la de 2800px.
for (const [i, nombre] of [[0,'empuje'],[1,'traccion'],[2,'piernas'],[3,'core']]) {
  await p.locator('section').nth(i).screenshot({ path: `capturas/${nombre}.png` }).catch(() => {})
}
console.log('url:', p.url())
console.log('svgs:', await p.locator('svg').count())
console.log('texto:', (await p.locator('body').innerText()).replace(/\s+/g,' ').slice(0,200))
await nav.close()
