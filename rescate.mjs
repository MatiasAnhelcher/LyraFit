/**
 * ¿Sobrevive una sesión a que el navegador recicle la pestaña?
 *
 * Es la pregunta más cara de toda la app. No hay servidor: los cuarenta
 * minutos de una sesión viven en el dispositivo, y hasta la versión 3 de la
 * base vivían además en la memoria de la pestaña, que iOS descarta sin avisar
 * cuando atendés un llamado, cambiás de app o el teléfono queda corto de
 * memoria. Perder una sesión entera es peor que cualquier función que la app
 * pueda no tener, así que esto se revisa aparte y con un guion propio.
 *
 * La prueba hace media sesión, recarga la página a lo bruto —lo más parecido a
 * que muera la pestaña: se pierde todo el estado de React y queda solo lo que
 * llegó a IndexedDB— y revisa tres cosas: que las series anotadas sigan ahí,
 * que el cronómetro no se haya reiniciado, y que "empezar de cero" limpie de
 * verdad el borrador en vez de dejarlo para la próxima.
 *
 * Uso: node rescate.mjs   (con `npm run preview` andando en el 4173)
 */

import { chromium } from 'playwright'

const BASE = 'http://localhost:4173'
const fallos = []

const navegador = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
})
const contexto = await navegador.newContext({
  viewport: { width: 390, height: 844 },
  colorScheme: 'dark',
  locale: 'es-AR',
})
const p = await contexto.newPage()
p.on('pageerror', (e) => fallos.push(`Error de JavaScript: ${e.message}`))

// El alta, que es el portero: sin completarla todo redirige a /alta.
await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
await p.waitForTimeout(400)
await p.getByRole('button', { name: 'Empezar', exact: true }).click()
await p.getByRole('button', { name: 'Sí, tengo barra' }).click()
for (let i = 0; i < 4; i++) {
  for (let n = 0; n < 6; n++) await p.getByRole('button', { name: 'Sumar' }).click()
  const plan = p.getByRole('button', { name: 'Ver mi plan' })
  if (await plan.isVisible().catch(() => false)) await plan.click()
  else await p.getByRole('button', { name: 'Siguiente', exact: true }).click()
  await p.waitForTimeout(100)
}
await p.getByRole('button', { name: 'Seguir', exact: true }).click()
await p.waitForTimeout(200)
await p.getByRole('button', { name: /Cuerpo completo/ }).click()
await p.waitForTimeout(500)

// Media sesión: se anotan tres series salteando los descansos.
await p.goto(`${BASE}/#/entrenar`, { waitUntil: 'networkidle' })
await p.waitForTimeout(600)
const salteaDescanso = async () => {
  const saltear = p.getByRole('button', { name: 'Saltear', exact: true })
  if (await saltear.isVisible().catch(() => false)) await saltear.click()
}
for (let i = 0; i < 3; i++) {
  await salteaDescanso()
  await p.getByRole('button', { name: 'Anotar serie', exact: true }).click()
  await p.waitForTimeout(200)
}
await salteaDescanso()
await p.waitForTimeout(300)

const casilleros = () => p.locator('ul[aria-label="Series de este ejercicio"] li').allInnerTexts()
const reloj = () => p.locator('header p').innerText()
const enSegundos = (t) => {
  const partes = t.trim().split(':').map(Number)
  return partes.length === 3
    ? partes[0] * 3600 + partes[1] * 60 + partes[2]
    : partes[0] * 60 + partes[1]
}

const antes = await casilleros()
const relojAntes = await reloj()
if (!antes.some((t) => /\d/.test(t))) {
  fallos.push(`No se anotó nada antes de la prueba: ${JSON.stringify(antes)}`)
}

// Que pase un rato, para que el cronómetro tenga algo que perder.
await p.waitForTimeout(4000)

// Acá muere la pestaña.
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(1200)

const despues = await casilleros()
const relojDespues = await reloj()
const avisa = await p.getByText('sesión retomada donde la dejaste').isVisible().catch(() => false)

if (JSON.stringify(antes) !== JSON.stringify(despues)) {
  fallos.push(`Las series no sobrevivieron: ${JSON.stringify(antes)} → ${JSON.stringify(despues)}`)
}
if (!avisa) fallos.push('La sesión se retomó sin decírselo a la persona.')
if (enSegundos(relojDespues) < enSegundos(relojAntes)) {
  fallos.push(`El cronómetro se reinició: ${relojAntes} → ${relojDespues}`)
}

// Y "empezar de cero" tiene que borrar el borrador, no solo limpiar la pantalla.
await p.getByRole('button', { name: 'empezar de cero' }).click()
await p.waitForTimeout(400)
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(1000)
if (await p.getByText('sesión retomada donde la dejaste').isVisible().catch(() => false)) {
  fallos.push('Empezar de cero no borró el borrador: la sesión volvió a retomarse.')
}

await navegador.close()

if (fallos.length > 0) {
  console.log('PROBLEMAS ENCONTRADOS:')
  for (const f of fallos) console.log(' -', f)
  process.exit(1)
}
console.log(`La sesión sobrevive a que muera la pestaña (${relojAntes} → ${relojDespues}).`)
