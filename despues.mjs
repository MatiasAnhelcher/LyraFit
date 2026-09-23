/**
 * Qué viene después: que se vea, que se diga, y que sea verdad.
 *
 * Nace de una queja concreta: *"no hay nada que me avise qué ejercicio viene
 * después y tener que estar pendiente de eso me quita segundos de actividad y
 * me hace perder ritmo"*. Era literal — en toda la pantalla de entrenar no se
 * nombraba nunca el ejercicio siguiente.
 *
 * Mide cinco cosas, y ninguna es una captura que "se ve bien":
 *
 *   1. **Está durante todo el último descanso**, no solo en el último segundo.
 *      Se muestrea varias veces y tiene que estar en todas: si apareciera al
 *      final, habría que mirar la pantalla justo en ese momento, que es lo
 *      contrario de lo que se pidió.
 *   2. **Lo que anunció es lo que vino.** Se guarda el nombre anunciado, se
 *      completa el ejercicio y se compara contra el título de la pantalla
 *      siguiente. Una función que miente es peor que no tenerla.
 *   3. **No aparece cuando no corresponde.** En un descanso del medio —donde lo
 *      que viene es otra serie de lo mismo— no puede estar. Un dato que sale en
 *      los doce descansos de la sesión deja de ser un dato.
 *   4. **Habla una vez por ejercicio, y dice lo mismo que muestra.**
 *   5. **Con la voz apagada no habla ni una vez.**
 *
 * ## Sobre la voz y este navegador
 *
 * Chromium sin cabeza no trae ninguna voz instalada, y la app entonces se queda
 * MUDA a propósito: una voz en inglés leyendo "flexiones declinadas" es peor
 * que el silencio. O sea que sin ayuda este portón solo podría verificar el
 * caso mudo.
 *
 * Así que se inyecta una voz falsa en es-AR, y con ella hay que reemplazar
 * también `SpeechSynthesisUtterance`: asignarle a `.voice` de una utterance
 * real un objeto que no es una `SpeechSynthesisVoice` tira un TypeError que la
 * app se traga —y hace bien en tragárselo—, así que sin eso el portón mediría
 * silencio y lo llamaría éxito.
 *
 * Lo que este portón NO mide, y hay que decirlo: el motor de voz del sistema
 * operativo. Eso no es de esta app. Lo que mide es el cableado: cuándo habla,
 * cuántas veces y qué dice.
 *
 * Uso: npm run build && npx vite preview --port 4173, y después `node despues.mjs`.
 */

import { chromium } from 'playwright'

const BASE = 'http://localhost:4173'
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'

const fallos = []
const dichos = []

/** La voz falsa, y el reemplazo de la utterance que la hace utilizable. */
const VOZ_FALSA = () => {
  window.__dicho = []
  const falsa = {
    voiceURI: 'prueba',
    name: 'Voz de prueba',
    lang: 'es-AR',
    localService: true,
    default: true,
  }
  Object.defineProperty(window.speechSynthesis, 'getVoices', {
    value: () => [falsa],
    configurable: true,
  })
  Object.defineProperty(window.speechSynthesis, 'speak', {
    value: (u) => {
      if (u && typeof u.text === 'string' && u.text.length > 0) window.__dicho.push(u.text)
    },
    configurable: true,
  })
  Object.defineProperty(window.speechSynthesis, 'cancel', { value: () => {}, configurable: true })
  // Sin esto, `utterance.voice = laFalsa` tira TypeError y la app —que atrapa y
  // sigue, como corresponde— se queda muda sin que se note.
  window.SpeechSynthesisUtterance = class {
    constructor(texto) {
      this.text = texto
      this.voice = null
      this.lang = ''
      this.rate = 1
      this.pitch = 1
      this.volume = 1
    }
  }
}

async function alta(p) {
  await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(400)
  await p.getByRole('button', { name: 'Empezar', exact: true }).click()
  await p.getByRole('button', { name: 'Sí, tengo barra' }).click()
  await p.getByRole('button', { name: '12', exact: true }).click()
  await p.getByRole('button', { name: 'Siguiente', exact: true }).click()
  await p.waitForTimeout(150)
  for (let i = 0; i < 3; i++) {
    for (let n = 0; n < 6; n++) await p.getByRole('button', { name: 'Sumar' }).click()
    const ver = p.getByRole('button', { name: 'Ver mi plan' })
    if (await ver.isVisible().catch(() => false)) await ver.click()
    else await p.getByRole('button', { name: 'Siguiente', exact: true }).click()
    await p.waitForTimeout(120)
  }
  await p.getByRole('button', { name: 'Seguir', exact: true }).click()
  await p.waitForTimeout(400)
  await p.getByRole('button', { name: /Cuerpo completo/ }).click()
  await p.waitForTimeout(700)
  const ahoraNo = p.getByRole('button', { name: 'Ahora no' })
  if (await ahoraNo.isVisible().catch(() => false)) {
    await ahoraNo.click()
    await p.waitForTimeout(300)
  }
}

const anotarSerie = async (p) => {
  const voy = p.getByRole('button', { name: 'Voy', exact: true })
  if (await voy.isVisible().catch(() => false)) {
    await voy.click()
    await p.waitForTimeout(150)
  }
  await p.getByRole('button', { name: 'Anotar serie', exact: true }).click()
  await p.waitForTimeout(450)
}

const textoDelAviso = async (p) => {
  const aviso = p.getByText(/^después ·/)
  if (!(await aviso.isVisible().catch(() => false))) return null
  return (await aviso.innerText()).replace(/^después ·\s*/i, '').trim()
}

const navegador = await chromium.launch({ executablePath: CHROMIUM })
const contexto = await navegador.newContext({
  viewport: { width: 390, height: 844 },
  locale: 'es-AR',
  colorScheme: 'dark',
})
await contexto.addInitScript(VOZ_FALSA)
const p = await contexto.newPage()
p.on('pageerror', (e) => fallos.push(`Error de JavaScript: ${e.message}`))
p.on('console', (m) => {
  if (m.type() === 'error') fallos.push(`Error en consola: ${m.text()}`)
})

await alta(p)
await p.getByRole('button', { name: /^Empezar$/ }).click()
await p.waitForTimeout(600)

const tituloActual = async () => (await p.locator('h1').first().innerText()).replace(/\n/g, ' ').trim()
const deQuienVengo = await tituloActual()

// ── 3. El descanso del medio no puede anunciar nada ───────────────────────
await anotarSerie(p)
const enElMedio = await textoDelAviso(p)
if (enElMedio !== null) {
  fallos.push(
    `En el descanso del medio apareció "${enElMedio}". Ahí lo que viene es otra serie del mismo ejercicio: un dato que sale en los doce descansos deja de ser un dato.`,
  )
}

await p.getByRole('button', { name: 'Saltear', exact: true }).click()
await p.waitForTimeout(300)

// ── 1. Presente durante TODO el último descanso ───────────────────────────
await anotarSerie(p)
const vistos = []
for (let muestra = 0; muestra < 6; muestra++) {
  vistos.push(await textoDelAviso(p))
  await p.waitForTimeout(700)
}
const faltantes = vistos.filter((v) => v === null).length
if (faltantes > 0) {
  fallos.push(
    `El aviso de lo que viene faltó en ${faltantes} de ${vistos.length} muestras del último descanso. Si aparece a último momento hay que mirar la pantalla justo entonces, que es lo contrario de lo que se pidió.`,
  )
}
const distintos = new Set(vistos.filter(Boolean))
if (distintos.size > 1) {
  fallos.push(`El aviso cambió de texto durante el mismo descanso: ${[...distintos].join(' / ')}.`)
}
const anunciado = vistos.find(Boolean) ?? null
if (!anunciado) {
  fallos.push('El último descanso no anunció nada.')
}

// ── 4. Habla una vez, y dice lo mismo que muestra ─────────────────────────
const antesDeCompletar = await p.evaluate(() => window.__dicho.length)
await p.getByRole('button', { name: 'Saltear', exact: true }).click()
await p.waitForTimeout(300)
await anotarSerie(p)
await p.waitForTimeout(400)

const hablado = await p.evaluate(() => window.__dicho.slice())
dichos.push(...hablado)
const nuevas = hablado.length - antesDeCompletar
if (nuevas !== 1) {
  fallos.push(
    `Al completar el ejercicio habló ${nuevas} ${nuevas === 1 ? 'vez' : 'veces'} y tenía que hablar exactamente una. Lo dicho: ${JSON.stringify(hablado)}.`,
  )
}
const ultimoDicho = hablado[hablado.length - 1] ?? ''
if (anunciado && !ultimoDicho.toLowerCase().includes(anunciado.toLowerCase())) {
  fallos.push(
    `Dijo "${ultimoDicho}" pero en pantalla decía "${anunciado}". La voz y la pantalla tienen que decir lo mismo.`,
  )
}

// ── 2. Lo que anunció es lo que vino ──────────────────────────────────────
const enCompleto = await p
  .getByText(/^DESPUÉS/)
  .locator('xpath=following-sibling::p[1]')
  .innerText()
  .catch(() => null)
if (enCompleto && anunciado && enCompleto.trim().toLowerCase() !== anunciado.toLowerCase()) {
  fallos.push(
    `El descanso anunció "${anunciado}" y la pantalla de ejercicio completo dice "${enCompleto.trim()}".`,
  )
}

await p.getByRole('button', { name: 'Siguiente ejercicio', exact: true }).click()
await p.waitForTimeout(600)
const llegado = await tituloActual()
if (anunciado && llegado.toLowerCase() !== anunciado.toLowerCase()) {
  fallos.push(
    `Anunció "${anunciado}" y llegó "${llegado}". Una función que miente sobre lo que viene es peor que no tenerla.`,
  )
}
if (llegado === deQuienVengo) {
  fallos.push('El ejercicio no cambió: el recorrido no llegó a medir la transición.')
}

// ── 5. Con la voz apagada no habla ni una vez ─────────────────────────────
await p.goto(`${BASE}/#/ajustes`, { waitUntil: 'networkidle' })
await p.waitForTimeout(500)
const filaDeVoz = p.getByRole('button', { name: /Lyra habla/ })
if (!(await filaDeVoz.isVisible().catch(() => false))) {
  fallos.push(
    'No apareció la fila "Lyra habla" en Ajustes, y con una voz en español disponible tiene que estar.',
  )
} else {
  await filaDeVoz.click()
  await p.waitForTimeout(400)
  await p.evaluate(() => {
    window.__dicho.length = 0
  })
  await p.goto(`${BASE}/#/entrenar`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(800)
  for (let i = 0; i < 4; i++) {
    const saltear = p.getByRole('button', { name: 'Saltear', exact: true })
    if (await saltear.isVisible().catch(() => false)) {
      await saltear.click()
      await p.waitForTimeout(250)
      continue
    }
    await anotarSerie(p)
  }
  const conVozApagada = await p.evaluate(() => window.__dicho.length)
  if (conVozApagada > 0) {
    fallos.push(
      `Con la voz apagada en Ajustes igual habló ${conVozApagada} ${conVozApagada === 1 ? 'vez' : 'veces'}. Un interruptor que no apaga es peor que ninguno.`,
    )
  }
}

await navegador.close()

if (anunciado) {
  console.log(`El último descanso anunció "${anunciado}" en las ${vistos.length} muestras, y eso fue lo que vino.`)
}
if (dichos.length > 0) {
  console.log(`Lo que dijo en voz alta: ${dichos.map((d) => `"${d}"`).join(', ')}.`)
}

if (fallos.length > 0) {
  console.error('\n' + fallos.map((f) => `· ${f}`).join('\n'))
  process.exit(1)
}

console.log('\nSe sabe qué viene sin buscarlo, y lo que se anuncia es lo que llega.')
