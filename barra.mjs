/**
 * La barra de 28 días, mirada en Hoy con el reloj puesto.
 *
 * `adherencia.test.ts` cubre la cuenta. Esto mira lo que dice la pantalla, que
 * es donde estaba el daño: alguien con diez semanas sin faltar leía "Un día
 * cubierto con tus créditos. Faltar estaba previsto." cada lunes, miércoles y
 * viernes antes de entrenar, y quien llevaba una semana veía "3 de 12".
 *
 * Con el reloj del navegador fijo (`clock.setFixedTime`) y las sesiones
 * escritas en la base, recorre cinco momentos de una persona con Cuerpo
 * completo (lunes, miércoles y viernes):
 *
 *   1. Recién hecha el alta, sin ninguna sesión: la barra no aparece.
 *   2. Una semana impecable, el lunes siguiente antes de entrenar: "3 de 3" y
 *      ningún aviso.
 *   3. Diez semanas impecables, un lunes antes de entrenar: "12 de 12" y
 *      ningún aviso.
 *   4. El mismo lunes, ya entrenado: "12 de 12" y ningún aviso.
 *   5. Y el aviso sigue existiendo cuando corresponde: si el miércoles pasa
 *      sin sesión, el viernes dice "11 de 12" y "Un día cubierto". Sin este
 *      paso, borrar el aviso entero también pasaría el portón.
 *
 * Uso: npm run build && npx vite preview --port 4173, y después `node barra.mjs`.
 * Contra otro puerto: `BASE=http://localhost:4185 node barra.mjs`.
 */

import { BASE, abrir, alta, conLaBase, revisarQueSirvaLoCompilado } from './lib/portones.mjs'

await revisarQueSirvaLoCompilado(BASE)

const { navegador, pagina: p, fallos } = await abrir()
const notas = []

/** Las 9 de la mañana de ese día en Buenos Aires, la zona que fija `abrir`. */
const alas9 = (fecha) => new Date(`${fecha}T09:00:00-03:00`)

/** Lunes, miércoles y viernes de `semanas` semanas desde un lunes. */
function lmv(lunes, semanas) {
  const fechas = []
  const base = Date.parse(`${lunes}T12:00:00Z`)
  for (let s = 0; s < semanas; s++) {
    for (const d of [0, 2, 4]) {
      fechas.push(new Date(base + (s * 7 + d) * 86_400_000).toISOString().slice(0, 10))
    }
  }
  return fechas
}

/**
 * Escribe una sesión por fecha. `conLaBase` manda el trabajo al navegador como
 * texto, así que no puede cerrar sobre `fechas`: las fechas van escritas
 * adentro del cuerpo de la función.
 */
async function sumarSesiones(fechas) {
  const sesiones = fechas.map((fecha) => ({
    id: `barra-${fecha}`,
    fecha,
    finalizadaEn: Date.parse(`${fecha}T21:00:00Z`),
    duracionSegundos: 1800,
    tipo: 'plan',
    registros: [],
  }))
  // eslint-disable-next-line no-new-func
  const trabajo = new Function(
    'leer',
    'poner',
    `for (const s of ${JSON.stringify(sesiones)}) poner('sesiones', s)`,
  )
  await conLaBase(p, ['sesiones'], trabajo)
}

/** Lo que dice Hoy en la sección de los 28 días, o null si no está. */
async function laBarra() {
  await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await p.reload({ waitUntil: 'networkidle' })
  await p.waitForTimeout(700)
  const seccion = p.locator('section', { has: p.getByText('ÚLTIMOS 28 DÍAS', { exact: true }) })
  if ((await seccion.count()) === 0) return null
  const cifra = (await seccion.locator('.cifra').first().innerText()).trim()
  const aviso = (await seccion.getByText(/cubiertos? con/).count()) > 0
  const texto = (await seccion.innerText()).replace(/\s+/g, ' ').trim()
  return { cifra, aviso, texto }
}

async function esperar(momento, { cifra, aviso }) {
  const vista = await laBarra()
  if (vista === null) {
    fallos.push(`${momento}: la barra de 28 días no aparece`)
    return
  }
  notas.push(`${momento}: "${vista.texto}"`)
  if (vista.cifra !== cifra) fallos.push(`${momento}: dice "${vista.cifra}" y tenía que decir "${cifra}"`)
  if (vista.aviso !== aviso) {
    fallos.push(
      aviso
        ? `${momento}: pasó un día del plan sin sesión y no aparece el día cubierto`
        : `${momento}: le avisa un día cubierto a alguien que no faltó`,
    )
  }
}

// 1. El alta, un lunes, sin ninguna sesión.
await p.clock.setFixedTime(alas9('2026-10-12'))
await alta(p)
const alEmpezar = await conLaBase(p, ['sesiones'], async (leer) => (await leer('sesiones')).length)
const sinNada = await laBarra()
notas.push(`Recién hecha el alta (${alEmpezar} sesiones): ${sinNada ? `"${sinNada.texto}"` : 'la barra no aparece'}`)
if (alEmpezar !== 0) fallos.push(`El alta dejó ${alEmpezar} sesiones guardadas y este portón supone cero`)
if (sinNada !== null) fallos.push(`Sin ninguna sesión ya muestra la barra: "${sinNada.texto}"`)

// 2. Una semana impecable, y el lunes siguiente antes de entrenar.
await sumarSesiones(lmv('2026-10-12', 1))
await p.clock.setFixedTime(alas9('2026-10-19'))
await esperar('Una semana impecable, lunes 19 antes de entrenar', { cifra: '3 de 3', aviso: false })

// 3. Diez semanas impecables (desde el 10 de agosto), el mismo lunes.
await sumarSesiones(lmv('2026-08-10', 9))
await esperar('Diez semanas impecables, lunes 19 antes de entrenar', { cifra: '12 de 12', aviso: false })

// 4. El mismo lunes, ya entrenado.
await sumarSesiones(['2026-10-19'])
await esperar('Diez semanas impecables, lunes 19 ya entrenado', { cifra: '12 de 12', aviso: false })

// 5. El miércoles 21 pasa sin sesión: el viernes 23 sí corresponde el aviso.
await p.clock.setFixedTime(alas9('2026-10-23'))
await esperar('Faltó el miércoles 21, viernes 23 antes de entrenar', { cifra: '11 de 12', aviso: true })

await navegador.close()

for (const n of notas) console.log(n)
if (fallos.length > 0) {
  console.error('\n' + fallos.map((f) => `· ${f}`).join('\n'))
  process.exit(1)
}
console.log('\nLa barra mide los días que pasaron y el aviso sale solo cuando hubo una falta.')
