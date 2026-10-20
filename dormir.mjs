/**
 * La hora de acostarse, de punta a punta: se pregunta, nunca se inventa, y con
 * ella sale el aviso de cafeína.
 *
 * El aviso no salía nunca: `cafeinaTarde` necesita la hora de acostarse, la
 * pantalla había dejado de suponerla (bien) y nadie la preguntaba. Las reglas
 * de cuándo preguntar y qué hora vale están en `nutricion.test.ts`; esto mira
 * lo que un test de dominio no ve, que es la pantalla y lo que queda en la
 * base:
 *
 *   1. **Sin café que pueda tocar el sueño, no hay pregunta**: sin contestar,
 *      con "Nada" y con un café a las 12.
 *   2. **Con café a las 20 aparece**, y mientras no se contesta no hay aviso,
 *      ni corte, ni hora guardada en la fila de hoy.
 *   3. **Contestada, sale el aviso con el corte**: a la 1 (madrugada
 *      siguiente) el corte es 16:00, a las 23 es 14:00, y Hoy dice lo mismo.
 *   4. **El reloj da la vuelta bien**: café a las 14 y a dormir a las 0 son
 *      diez horas y no hay aviso; con una resta lineal lo habría.
 *   5. **Al día siguiente, la hora de ayer se usa a la vista y no se copia**:
 *      "Te acostás a las 23:00, como dijiste ayer", con el aviso, sin hora en
 *      la fila de hoy; "Cambiar" abre la regleta y lo tocado sí se guarda.
 *   6. **Pasadas dos semanas, se vuelve a preguntar**: a los 14 días todavía
 *      vale y a los 15 ya no.
 *   7. **Las 23:00 que la app escribía sola no cuentan**: hasta octubre de
 *      2026, tocar la cafeína guardaba `horaDeDormir: 1380` sin preguntar.
 *      Con esas filas en la base —hoy y ayer, sin la marca de contestada— el
 *      diario pregunta igual, sin nada marcado, sin "como dijiste" y sin aviso.
 *
 * Guarda tres capturas del diario a 390×844 en `capturas/dormir` (o donde
 * diga `CAPTURAS`): sin contestar, con el aviso, y con la hora de ayer.
 *
 * Uso: npm run build && npx vite preview --port 4173, y después `node dormir.mjs`.
 * Con otro puerto: `BASE=http://localhost:4186 node dormir.mjs`.
 */

import { mkdir } from 'node:fs/promises'
import { BASE, abrir, alta, conLaBase, revisarQueSirvaLoCompilado } from './lib/portones.mjs'

const CAPTURAS = process.env.CAPTURAS ?? 'capturas/dormir'
const PREGUNTA = '¿A qué hora te pensás acostar?'

await revisarQueSirvaLoCompilado(BASE)
await mkdir(CAPTURAS, { recursive: true })

const { navegador, pagina: p, fallos } = await abrir()
const notas = []

const texto = () => p.locator('main').innerText()
const esperar = (ms = 500) => p.waitForTimeout(ms)
/** Recargar de verdad: una escritura cruda no despierta a `liveQuery`. */
async function recargar(ruta) {
  await p.goto(`${BASE}/#${ruta}`, { waitUntil: 'networkidle' })
  await p.reload({ waitUntil: 'networkidle' })
  await esperar(700)
}
async function capturar(nombre) {
  await esperar(450)
  await p.screenshot({ path: `${CAPTURAS}/${nombre}.png` })
}

/*
 * Las dos regletas se buscan adentro de su grupo: la de proteína también
 * tiene botones "0", "1" y "2", y sin el grupo el portón tocaría la que no es.
 */
const cafe = (h) =>
  p.getByRole('group', { name: 'Hora de la última cafeína' }).getByRole('button', { name: String(h), exact: true })
const dormir = (h) =>
  p.getByRole('group', { name: 'Hora de acostarte' }).getByRole('button', { name: String(h), exact: true })
const preguntaVisible = () => p.getByText(PREGUNTA, { exact: true }).isVisible().catch(() => false)
const deAntes = p.locator('[data-prueba="hora-de-dormir-de-antes"]')

/** Las fechas como las escribe la app: locales y AAAA-MM-DD. */
const fechas = await p.evaluate(() => {
  const dd = (n) => String(n).padStart(2, '0')
  const hace = (n) => {
    const d = new Date()
    d.setHours(12, 0, 0, 0)
    d.setDate(d.getDate() - n)
    return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`
  }
  return { hoy: hace(0), ayer: hace(1), hace14: hace(14), hace15: hace(15) }
})

async function fila(fecha) {
  const json = await conLaBase(p, ['diario'], async (leer) => JSON.stringify(await leer('diario')))
  return JSON.parse(json).find((f) => f.fecha === fecha) ?? null
}

/**
 * Deja la fila de hoy sin hora y escribe UNA hora de antes, `dias` atrás.
 * `conLaBase` manda el trabajo como texto: no puede cerrar sobre `dias`, así
 * que va escrito adentro con `replace`.
 */
async function horaDeAntes(dias) {
  const trabajo = async (leer, poner) => {
    const dd = (n) => String(n).padStart(2, '0')
    const hace = (n) => {
      const d = new Date()
      d.setHours(12, 0, 0, 0)
      d.setDate(d.getDate() - n)
      return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`
    }
    for (const f of await leer('diario')) {
      const { horaDeDormir, horaDeDormirContestada, ...sinHora } = f
      if (horaDeDormir !== undefined) poner('diario', sinHora)
    }
    poner('diario', {
      fecha: hace(DIAS),
      horaDeDormir: 23 * 60,
      horaDeDormirContestada: true,
      actualizadoEn: Date.now(),
    })
  }
  await conLaBase(p, ['diario'], { toString: () => trabajo.toString().replace('DIAS', String(dias)) })
}

/** Los dos lados de un control táctil, contra el mínimo de 44 px. */
async function medirToque(locator, nombre) {
  const caja = await locator.boundingBox()
  if (!caja) fallos.push(`${nombre}: no se dibujó.`)
  else if (caja.height < 44 || caja.width < 44) {
    fallos.push(`${nombre} mide ${Math.round(caja.width)}×${Math.round(caja.height)} px: el mínimo táctil es 44.`)
  }
}

try {
  await alta(p)
  await recargar('/diario')

  // ── 1. Sin café que pueda tocar el sueño, no hay pregunta ────────────────
  if (await preguntaVisible()) fallos.push('Sin contestar el café, el diario ya pregunta la hora de acostarse.')
  await cafe('Nada').click()
  await esperar()
  if (await preguntaVisible()) fallos.push('Con "Nada" de cafeína, el diario pregunta la hora de acostarse.')
  await cafe(12).click()
  await esperar()
  if (await preguntaVisible()) {
    fallos.push('Con café a las 12 el diario pregunta la hora de acostarse, y ninguna respuesta cambia nada.')
  } else {
    notas.push('Sin café, con "Nada" y con café a las 12: no pregunta la hora de acostarse.')
  }

  // ── 2. Café a las 20: aparece, y sin contestar no hay aviso ──────────────
  await cafe(20).click()
  await esperar()
  if (!(await preguntaVisible())) {
    fallos.push(`Con café a las 20, el diario no pregunta "${PREGUNTA}".`)
  } else {
    const sinContestar = await texto()
    if (sinContestar.includes('CORTE SUGERIDO')) fallos.push('Sin contestar la hora, el diario muestra un "CORTE SUGERIDO".')
    if (sinContestar.includes('Tomaste cafeína')) fallos.push('Sin contestar la hora, el diario avisa de la cafeína.')
    if (!sinContestar.includes('Gardiner')) fallos.push('La pregunta de la hora afirma las nueve horas sin su fuente.')
    if (!/0, 1 y 2 ya son de madrugada/i.test(sinContestar)) {
      fallos.push('La regleta de la hora no dice con palabras que 0, 1 y 2 son de madrugada.')
    }
    for (const h of [21, 22, 23, 0, 1, 2]) {
      await medirToque(dormir(h), `El botón "${h}" de la hora de acostarse`)
      if ((await dormir(h).getAttribute('aria-pressed')) === 'true') {
        fallos.push(`Sin contestar, el botón "${h}" de la hora de acostarse ya aparece elegido.`)
      }
    }
    const f = await fila(fechas.hoy)
    if (f?.ultimaCafeina !== 20 * 60) fallos.push(`Tocar "20" no guardó la cafeína: ${JSON.stringify(f)}`)
    else if (f.horaDeDormir !== undefined) {
      fallos.push(`Sin contestar, la fila de hoy tiene una hora de acostarse: ${f.horaDeDormir} min.`)
    } else {
      notas.push('Café a las 20: aparece la pregunta; sin contestarla no hay aviso ni hora en la base.')
    }
    await capturar('1-diario-sin-contestar')
  }

  // ── 3. Contestada, sale el aviso con el corte ────────────────────────────
  await dormir(1).click()
  await esperar()
  const ala1 = await texto()
  if (!ala1.includes('CORTE SUGERIDO · 16:00')) {
    fallos.push('A dormir a la 1 con café a las 20, el diario no muestra "CORTE SUGERIDO · 16:00".')
  }
  if (!ala1.includes('Tomaste cafeína')) fallos.push('Contestada la hora (la 1), el aviso de cafeína no sale.')
  if ((await fila(fechas.hoy))?.horaDeDormir !== 60) fallos.push('Tocar "1" no guardó la 1 de la mañana (60 min).')
  if ((await dormir(1).getAttribute('aria-pressed')) !== 'true') fallos.push('La hora contestada no queda marcada.')

  await dormir(23).click()
  await esperar()
  const ala23 = await texto()
  if (!ala23.includes('CORTE SUGERIDO · 14:00')) {
    fallos.push('A dormir a las 23 con café a las 20, el diario no muestra "CORTE SUGERIDO · 14:00".')
  } else {
    notas.push('Contestada: a la 1, "CORTE SUGERIDO · 16:00"; a las 23, "CORTE SUGERIDO · 14:00".')
  }
  if ((await fila(fechas.hoy))?.horaDeDormir !== 23 * 60) fallos.push('Tocar "23" no guardó las 23 (1380 min).')
  // Al centro y no "si hace falta": la barra de abajo es fija y tapa el corte
  // aunque para el navegador ya esté a la vista.
  await p.getByText(/^CORTE SUGERIDO/).evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await capturar('2-diario-con-aviso')
  await p.evaluate(() => window.scrollTo(0, 0))

  await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await esperar(700)
  if (!(await texto()).includes('Tomaste cafeína')) fallos.push('Con la hora contestada, Hoy no muestra el aviso de cafeína.')
  await p.goto(`${BASE}/#/diario`, { waitUntil: 'networkidle' })
  await esperar(700)

  // ── 4. El reloj da la vuelta bien ────────────────────────────────────────
  await dormir(0).click()
  await esperar(300)
  await cafe(14).click()
  await esperar()
  if ((await texto()).includes('Tomaste cafeína')) {
    fallos.push('Café a las 14 y a dormir a las 0 son diez horas, y el diario avisa: está restando sin dar la vuelta al reloj.')
  }
  await cafe(20).click()
  await esperar()
  if (!(await texto()).includes('CORTE SUGERIDO · 15:00')) {
    fallos.push('A dormir a las 0 con café a las 20, el diario no muestra "CORTE SUGERIDO · 15:00".')
  } else {
    notas.push('A dormir a las 0: con café a las 14 no avisa (diez horas), con café a las 20 corta a las 15:00.')
  }

  // ── 5. Al día siguiente: la de ayer se usa a la vista y no se copia ──────
  await horaDeAntes(1)
  await recargar('/diario')
  if (await preguntaVisible()) fallos.push('Con la hora contestada ayer, el diario la vuelve a preguntar entera.')
  const lineaDeAntes = (await deAntes.innerText().catch(() => '')).replace(/\s+/g, ' ')
  if (!lineaDeAntes.includes('Te acostás a las 23:00, como dijiste ayer')) {
    fallos.push(`Con la hora de ayer, el diario no dice cuál usa ni de cuándo es: "${lineaDeAntes}"`)
  }
  if (!(await texto()).includes('CORTE SUGERIDO · 14:00')) {
    fallos.push('Con la hora de ayer (23) y café a las 20, el diario no muestra "CORTE SUGERIDO · 14:00".')
  }
  if ((await fila(fechas.hoy))?.horaDeDormir !== undefined) {
    fallos.push('La hora de ayer se copió a la fila de hoy: hoy nadie la contestó.')
  }
  const cambiar = p.getByRole('button', { name: 'Cambiar la hora de acostarte' })
  await medirToque(cambiar, 'El botón "Cambiar"')
  await capturar('3-diario-hora-de-ayer')

  await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await esperar(700)
  if (!(await texto()).includes('Tomaste cafeína')) fallos.push('Con la hora de ayer, Hoy no muestra el aviso que sí muestra el diario.')
  await p.goto(`${BASE}/#/diario`, { waitUntil: 'networkidle' })
  await esperar(700)

  await cambiar.click()
  await esperar()
  if (!(await preguntaVisible())) fallos.push('"Cambiar" no abre la pregunta de la hora de acostarse.')
  else if ((await dormir(23).getAttribute('aria-pressed')) !== 'true') {
    fallos.push('Al tocar "Cambiar", la regleta no marca la hora que se está usando (23).')
  }
  if ((await fila(fechas.hoy))?.horaDeDormir !== undefined) fallos.push('Tocar "Cambiar" ya guardó una hora sin elegirla.')
  await dormir(22).click()
  await esperar()
  if ((await fila(fechas.hoy))?.horaDeDormir !== 22 * 60) fallos.push('Elegir "22" después de "Cambiar" no la guardó en la fila de hoy.')
  if (!(await texto()).includes('CORTE SUGERIDO · 13:00')) {
    fallos.push('Cambiada a las 22, el diario no muestra "CORTE SUGERIDO · 13:00".')
  } else {
    notas.push('Con la hora de ayer: "Te acostás a las 23:00, como dijiste ayer", aviso y nada copiado; "Cambiar" → 22 guarda y corta a las 13:00.')
  }

  // ── 6. Pasadas dos semanas, se vuelve a preguntar ────────────────────────
  await horaDeAntes(14)
  await recargar('/diario')
  if (!(await deAntes.innerText().catch(() => '')).includes('hace 14 días')) {
    fallos.push('Una hora de hace 14 días ya no se usa, y tendría que valer todavía.')
  }
  await horaDeAntes(15)
  await recargar('/diario')
  const vencida = await texto()
  if (!(await preguntaVisible()) || (await deAntes.isVisible().catch(() => false))) {
    fallos.push('Con la única hora de hace 15 días, el diario no vuelve a preguntar.')
  } else if (vencida.includes('Tomaste cafeína') || vencida.includes('CORTE SUGERIDO')) {
    fallos.push('Con la única hora de hace 15 días, el diario igual avisa de la cafeína.')
  } else {
    notas.push('A los 14 días la hora todavía vale; a los 15 se vuelve a preguntar y no hay aviso.')
  }

  // ── 7. Las 23:00 que la app escribía sola no cuentan ─────────────────────
  // Como las dejaba la versión de antes: la hora pegada a la cafeína, sin la
  // marca de que alguien la contestó. Hoy y ayer.
  await conLaBase(p, ['diario'], async (leer, poner) => {
    const dd = (n) => String(n).padStart(2, '0')
    const hace = (n) => {
      const d = new Date()
      d.setHours(12, 0, 0, 0)
      d.setDate(d.getDate() - n)
      return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`
    }
    for (const f of await leer('diario')) {
      const { horaDeDormir, horaDeDormirContestada, ...sinHora } = f
      if (horaDeDormir !== undefined) poner('diario', sinHora)
    }
    for (const n of [0, 1]) {
      poner('diario', { fecha: hace(n), ultimaCafeina: 20 * 60, horaDeDormir: 23 * 60, actualizadoEn: 1 })
    }
  })
  await recargar('/diario')
  const conViejas = await texto()
  if (!(await preguntaVisible())) fallos.push('Con las 23:00 viejas en la base, el diario no pregunta la hora de acostarse.')
  if (await deAntes.isVisible().catch(() => false)) {
    fallos.push('Con las 23:00 viejas en la base, el diario dice "como dijiste": nadie la dijo.')
  }
  if ((await dormir(23).getAttribute('aria-pressed').catch(() => null)) === 'true') {
    fallos.push('Con las 23:00 viejas en la base, el 23 aparece elegido como si alguien lo hubiera contestado.')
  }
  if (conViejas.includes('Tomaste cafeína') || conViejas.includes('CORTE SUGERIDO')) {
    fallos.push('Con las 23:00 viejas en la base, el diario avisa de la cafeína contra una hora que nadie contestó.')
  }
  await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await esperar(700)
  if ((await texto()).includes('Tomaste cafeína')) {
    fallos.push('Con las 23:00 viejas en la base, Hoy avisa de la cafeína contra una hora que nadie contestó.')
  } else if (fallos.length === 0) {
    notas.push('Las 23:00 que la app escribía sola (hoy y ayer, sin marca): pregunta igual, nada elegido, sin aviso.')
  }
} catch (e) {
  fallos.push(`El recorrido se cortó: ${e.message}`)
} finally {
  await navegador.close()
}

for (const n of notas) console.log(`· ${n}`)
if (fallos.length > 0) {
  console.error(`\n${fallos.length} problema(s):`)
  for (const f of fallos) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log(`\nLa hora de acostarse se pregunta cuando sirve, nunca se inventa, y con ella sale el corte. Capturas en ${CAPTURAS}/.`)
