/**
 * Lo que la app dice, leído en la pantalla y no en el código.
 *
 * Las frases de Lyra tienen sus reglas en `frases.test.ts` y el aviso de
 * cafeína en `nutricion.test.ts`, pero esos tests miran el dominio. Lo que
 * se arregló en octubre de 2026 tenía una mitad en las pantallas, y esa mitad
 * no la veía nadie:
 *
 *   1. **La cafeína sin hora de acostarse no avisa nada.** `Diario` suponía
 *      las 23:00 y las GUARDABA al tocar la hora del café. El dominio ya sabía
 *      callarse sin ese dato; el que lo inventaba era la pantalla, así que un
 *      test de dominio nunca podía agarrarlo. Acá se toca el café a las 20 en
 *      una base limpia: ni aviso ni "CORTE SUGERIDO", en el diario ni en Hoy,
 *      y la fila del día no tiene `horaDeDormir`.
 *   2. **Con la hora de verdad, sí.** Si la hora contestada está en la base
 *      (con `horaDeDormirContestada`, la marca que separa una respuesta de las
 *      23:00 que se inventaban), se usa: el corte es esa hora menos nueve y el
 *      aviso habla de esta noche, no de un "dormiste" que todavía no pasó.
 *      Cómo se contesta en pantalla lo recorre `dormir.mjs`.
 *   3. **La escala de energía no le supone un género a nadie.** "Con poca
 *      energía", no "Cansado".
 *   4. **Ajustes y las fichas no afirman lo que no tiene fuente**: ni que dos
 *      veces por semana "rinde más", ni "cada músculo un solo día" (el core y
 *      los brazos se repiten entre las cuatro), ni el pectoral interno, ni el
 *      tempo "rindiendo más" que el peso.
 *   5. **Ninguna pantalla recorrida dice algo de `PROHIBIDAS`**, la misma
 *      lista que leen los tests de dominio (`lib/palabras.mjs`, copia de
 *      `palabras.ts`): ni promesas, ni reto, ni "demasiado", ni "48 horas", ni
 *      "previene". El Cierre de la tercera sesión del día lo lee
 *      `tres-sesiones.mjs`.
 *
 * Uso: npm run build && npx vite preview --port 4173, y después `node textos.mjs`.
 * Con otro puerto: `BASE=http://localhost:4184 node textos.mjs`.
 */

import { BASE, abrir, alta, conLaBase, revisarQueSirvaLoCompilado } from './lib/portones.mjs'
import { loProhibido } from './lib/palabras.mjs'

await revisarQueSirvaLoCompilado(BASE)

// El teléfono chico: "Con poca energía" es la etiqueta más larga de la escala.
const { navegador, pagina: p, fallos } = await abrir({ viewport: { width: 360, height: 640 } })
const notas = []

const texto = async () => p.locator('body').innerText()
/** Las pantallas que se leyeron enteras contra `PROHIBIDAS`. */
const leidas = []
/** Lo que dice la pantalla de ahora, contra la lista de lo que no se dice nunca. */
const sinProhibidas = async (donde) => {
  const dicho = loProhibido(await texto())
  if (dicho) fallos.push(`${donde} dice "${dicho}", que la app no dice nunca (lib/palabras.mjs).`)
  else leidas.push(donde)
}
const ir = async (ruta) => {
  await p.goto(`${BASE}/#${ruta}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(600)
}
/** La fila del diario de hoy, leída por atrás de la interfaz. */
const filaDeHoy = async () => {
  const filas = await conLaBase(p, ['diario'], (leer) => leer('diario'))
  const hoy = await p.evaluate(() => {
    const d = new Date()
    const dd = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`
  })
  return { hoy, fila: filas.find((f) => f.fecha === hoy) }
}

try {
  await alta(p)

  // ── 3. La escala de energía ───────────────────────────────────────────────
  await ir('/estado')
  if (!(await p.getByRole('button', { name: 'Con poca energía', exact: true }).isVisible().catch(() => false))) {
    fallos.push('El chequeo diario no muestra "Con poca energía" en la escala de energía.')
  }
  if (/\bcansad[oa]\b/i.test(await texto())) {
    fallos.push('El chequeo diario sigue diciendo "Cansado": le supone un género a la persona.')
  }
  await sinProhibidas('El chequeo diario')

  // ── 1. Café a las 20, sin hora de acostarse ───────────────────────────────
  await ir('/diario')
  const cafe = p.getByRole('group', { name: 'Hora de la última cafeína' })
  await cafe.getByRole('button', { name: '20', exact: true }).click()
  await p.waitForTimeout(600)

  const diarioSinHora = await texto()
  if (diarioSinHora.includes('CORTE SUGERIDO')) {
    fallos.push('Sin hora de acostarse, el diario igual calcula un "CORTE SUGERIDO": la está suponiendo.')
  }
  if (diarioSinHora.includes('Tomaste cafeína')) {
    fallos.push('Sin hora de acostarse, el diario igual avisa de la cafeína.')
  }
  await sinProhibidas('El diario')

  const antes = await filaDeHoy()
  if (!antes.fila || antes.fila.ultimaCafeina !== 20 * 60) {
    fallos.push(`Tocar "20" no guardó la cafeína en la fila de ${antes.hoy}: ${JSON.stringify(antes.fila)}`)
  } else if (antes.fila.horaDeDormir !== undefined) {
    fallos.push(
      `Tocar la hora del café guardó una hora de acostarse que nadie contestó: ${antes.fila.horaDeDormir} min.`,
    )
  } else {
    notas.push('Café a las 20 sin hora de acostarse: sin aviso, sin corte y sin hora inventada en la base.')
  }

  await ir('/')
  if ((await texto()).includes('Tomaste cafeína')) {
    fallos.push('Sin hora de acostarse, Hoy igual avisa de la cafeína.')
  }
  await sinProhibidas('Hoy')

  // ── 2. Con la hora en la base, el aviso sale y habla de esta noche ────────
  // Una escritura cruda no despierta a `liveQuery`: hay que recargar.
  await conLaBase(p, ['diario'], async (leer, poner) => {
    const filas = await leer('diario')
    const d = new Date()
    const dd = (n) => String(n).padStart(2, '0')
    const hoy = `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`
    const fila = filas.find((f) => f.fecha === hoy)
    poner('diario', { ...fila, horaDeDormir: 22 * 60, horaDeDormirContestada: true })
  })
  await p.reload({ waitUntil: 'networkidle' })
  await ir('/diario')
  const diarioConHora = await texto()
  if (!diarioConHora.includes('CORTE SUGERIDO · 13:00')) {
    fallos.push('Con hora de acostarse a las 22:00 y café a las 20, el diario no muestra "CORTE SUGERIDO · 13:00".')
  }
  if (!diarioConHora.includes('esta noche')) {
    fallos.push('El aviso de cafeína no habla de esta noche.')
  }
  if (/\bdormiste (mal|menos)\b/i.test(diarioConHora)) {
    fallos.push('El aviso de cafeína le dice "dormiste" a alguien que todavía no se acostó.')
  }
  await ir('/')
  if (!(await texto()).includes('Tomaste cafeína')) {
    fallos.push('Con la hora de acostarse en la base, Hoy no muestra el aviso de cafeína.')
  } else {
    notas.push('Con la hora de acostarse en la base: "CORTE SUGERIDO · 13:00" y el aviso en Hoy.')
  }

  // ── 4. Ajustes y las fichas ───────────────────────────────────────────────
  await ir('/ajustes')
  const ajustes = await texto()
  if (!ajustes.includes('POR GRUPO MUSCULAR')) {
    fallos.push('Ajustes no dibujó la sección de rutinas por grupo: lo de abajo no midió nada.')
  }
  if (/rinde más/i.test(ajustes)) fallos.push('Ajustes sigue diciendo que algo "rinde más", sin fuente.')
  if (/cada músculo/i.test(ajustes)) {
    fallos.push('Ajustes dice "cada músculo": el core y los brazos se repiten entre las cuatro rutinas por grupo.')
  }
  await sinProhibidas('Ajustes')

  for (const [ruta, nombre] of [
    ['/progreso', 'Progreso'],
    ['/biblioteca', 'Cadenas'],
  ]) {
    await ir(ruta)
    await sinProhibidas(nombre)
  }

  for (const [id, prohibidas, presente] of [
    ['flexion-diamante', /pectoral interno|interna del pectoral/i, 'Manos juntas debajo del pecho'],
    ['peso-muerto-rumano', /rinde|tiempo bajo tensión/i, 'así controlás el recorrido'],
    ['curl-barra', /rinde/i, 'El tramo de abajo es el que más cuesta'],
  ]) {
    await ir(`/biblioteca/${id}`)
    const ficha = await texto()
    if (!ficha.includes(presente)) {
      fallos.push(`La ficha de ${id} no dibujó "${presente}": lo que sigue no midió nada.`)
    } else if (prohibidas.test(ficha)) {
      fallos.push(`La ficha de ${id} afirma algo sin fuente (${prohibidas}).`)
    }
    await sinProhibidas(`La ficha de ${id}`)
  }
} catch (e) {
  fallos.push(`El recorrido se cortó: ${e.message}`)
} finally {
  await navegador.close()
}

if (leidas.length > 0) notas.push(`Sin nada de PROHIBIDAS: ${leidas.join(', ')}.`)
for (const n of notas) console.log(`· ${n}`)
if (fallos.length > 0) {
  console.error(`\n${fallos.length} problema(s):`)
  for (const f of fallos) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log('\nLo que la app dice en pantalla no supone la hora de acostarse, ni el género, ni lo que no tiene fuente.')
