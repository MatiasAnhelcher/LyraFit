/**
 * El pliegue, medido en vez de mirado.
 *
 * Esta app tiene una restricción que ya se rompió DOS veces y que hasta hoy se
 * verificaba a mano: en `Hoy`, el botón `Empezar` tiene doce píxeles de aire
 * sobre la barra de navegación en un Android de 360×640. Las dos veces la
 * rompió un renglón nuevo que parecía inofensivo, y la segunda la encontré
 * midiendo después de haberla publicado.
 *
 * Un comentario escrito cinco veces en el código no impide nada. Una medición
 * que corre en cada cambio, sí.
 *
 * Mide tres cosas, las tres con `boundingBox()` y no con el ojo:
 *
 *   1. `Empezar` con aire suficiente sobre la barra, en tres teléfonos.
 *   2. Los botones del descanso —`+30 s` y `Saltear`— adentro de la pantalla.
 *      Esta es la que decide si el aviso de "qué viene después" se queda en el
 *      descanso o se va: esa pantalla ya estaba a pocos píxeles del borde.
 *   3. La grilla de la semana en Ajustes, sin desborde y con las filas
 *      alcanzables con el dedo.
 *
 * Uso: npm run build && npx vite preview --port 4173, y después `node pliegue.mjs`.
 */

import { chromium } from 'playwright'

const BASE = 'http://localhost:4173'
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'

/**
 * Los teléfonos.
 *
 * `exige` marca cuáles hacen fallar el portón. Los dos exigidos son los del
 * conjunto con el que esta app siempre midió. El de 320×568 se mide y se
 * informa pero no falla, y eso está dicho así a propósito: al agregarlo
 * aparecieron dos desbordes ANTERIORES a este cambio —la pantalla del descanso
 * termina abajo del borde y el botón "cómo se hace" se sale a lo ancho— y
 * hacer fallar el portón por deuda vieja lo volvería ruido que nadie mira.
 * Los números quedan impresos para que la deuda no se olvide.
 */
const TELEFONOS = [
  { nombre: '320×568', width: 320, height: 568, exige: false },
  { nombre: '360×640', width: 360, height: 640, exige: true },
  { nombre: '390×844', width: 390, height: 844, exige: true },
]

/**
 * Un fallo que solo cuenta en los teléfonos exigidos.
 *
 * Se llama `culpar` y no `anotar` porque adentro de `medirDescanso` ya hay una
 * `anotar` que anota una SERIE. Con el mismo nombre, esta función llamaba a la
 * otra sin esperarla y el portón moría con "la página se cerró" en vez de
 * decir qué había medido mal.
 */
function culpar(telefono, texto) {
  if (telefono.exige) fallos.push(texto)
  else deudas.push(texto)
}

/** Cuánto aire tiene que quedar entre la acción y la barra. Medido, no elegido. */
const AIRE_MINIMO = 12

const fallos = []
const deudas = []
const medidas = []

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
  await p.waitForTimeout(600)
}

/** Quién se sale a lo ancho, con nombre y apellido. Suponerlo acusa al inocente. */
async function quienDesborda(p) {
  return p.evaluate(() => {
    const limite = document.documentElement.clientWidth
    let peor = null
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.right > limite + 0.5 && (!peor || r.right > peor.right)) {
        peor = {
          right: Math.round(r.right),
          que: `<${el.tagName.toLowerCase()}> "${(el.textContent ?? '').trim().slice(0, 30)}"`,
        }
      }
    }
    return peor
  })
}

async function medirHoy(p, telefono) {
  // El ofrecimiento del fuelle se cierra: su fila también ocupa alto, y se mide
  // el estado en el que la app se abre veinte veces por semana, no el del
  // primer día.
  const ahoraNo = p.getByRole('button', { name: 'Ahora no' })
  if (await ahoraNo.isVisible().catch(() => false)) {
    await ahoraNo.click()
    await p.waitForTimeout(300)
  }

  // Al tope antes de medir: `boundingBox` es relativo al viewport, así que con
  // la página scrolleada el número da negativo y no quiere decir nada.
  await p.evaluate(() => window.scrollTo(0, 0))
  await p.waitForTimeout(200)

  const empezar = await p.getByRole('button', { name: /^Empezar$/ }).boundingBox()
  if (!empezar) {
    culpar(telefono, `[${telefono.nombre}] No se encontró el botón Empezar en Hoy.`)
    return
  }
  // El piso es la barra de navegación; si no hay, el borde de la pantalla.
  const nav = await p.locator('nav').first().boundingBox()
  const piso = nav ? nav.y : telefono.height
  const aire = piso - (empezar.y + empezar.height)
  medidas.push(`[${telefono.nombre}] Hoy · Empezar termina en ${Math.round(empezar.y + empezar.height)}, la barra arranca en ${Math.round(piso)}: ${Math.round(aire)} px de aire.`)
  // Medio píxel de tolerancia: el alto real es fraccionario y sin esto un aire
  // de 11,996 se imprime como 12 y falla, que es la peor clase de portón.
  if (aire + 0.5 < AIRE_MINIMO) {
    culpar(
      telefono,
      `[${telefono.nombre}] "Empezar" quedó a ${Math.round(aire)} px de la barra (hacen falta ${AIRE_MINIMO}). Es la regresión que ya pasó dos veces: algún renglón nuevo lo empujó.`,
    )
  }
}

async function medirDescanso(p, telefono) {
  await p.getByRole('button', { name: /^Empezar$/ }).click()
  await p.waitForTimeout(600)

  const anotar = async () => {
    const voy = p.getByRole('button', { name: 'Voy', exact: true })
    if (await voy.isVisible().catch(() => false)) {
      await voy.click()
      await p.waitForTimeout(150)
    }
    await p.getByRole('button', { name: 'Anotar serie', exact: true }).click()
    await p.waitForTimeout(500)
  }

  /** Dónde termina el último botón del descanso. Es lo que decide si se ve. */
  const fondoDeLosBotones = async () => {
    let fondo = 0
    for (const nombre of ['+30 s', 'Saltear']) {
      const caja = await p.getByRole('button', { name: nombre, exact: true }).boundingBox()
      if (!caja) return null
      fondo = Math.max(fondo, caja.y + caja.height)
    }
    return fondo
  }

  // El descanso del MEDIO: el que esta entrega no tocó, y el más alto de los
  // dos porque lleva la indicación de técnica, que ocupa hasta tres renglones.
  await anotar()
  const medio = await fondoDeLosBotones()

  await p.getByRole('button', { name: 'Saltear', exact: true }).click()
  await p.waitForTimeout(300)

  // Y el ÚLTIMO, que es el que ahora lleva el aviso de lo que viene.
  await anotar()
  const ultimo = await fondoDeLosBotones()

  if (medio === null || ultimo === null) {
    culpar(telefono, `[${telefono.nombre}] No se encontraron los botones del descanso.`)
    return
  }

  const despues = p.getByText(/^después ·/)
  if (!(await despues.isVisible().catch(() => false))) {
    // Esta sí falla siempre: es la función que se está entregando. Si no está,
    // no hay nada que medir.
    fallos.push(
      `[${telefono.nombre}] En el último descanso no apareció el aviso de lo que viene.`,
    )
  }

  medidas.push(
    `[${telefono.nombre}] Descanso · los botones terminan en ${Math.round(medio)} en el del medio y ${Math.round(ultimo)} en el último, de ${telefono.height}.`,
  )

  /*
   * La aserción que importa, y por qué NO es "que los botones entren".
   *
   * No entran, y no entraban antes de esta entrega: el descanso del medio
   * termina en 690 de 568 en el teléfono más chico, empujado por la indicación
   * de técnica de tres renglones. Poner "que entren" haría un portón que nace
   * en rojo y que por lo tanto nadie mira, que es peor que no tenerlo.
   *
   * Lo que sí se puede exigir es que lo agregado no empeore lo que había: el
   * último descanso —el que lleva el aviso— no puede irse MÁS abajo del borde
   * de lo que ya se iba el del medio, que nadie tocó. Es una vara que se
   * calibra sola, sin número mágico, y se rompe exactamente cuando alguien
   * agrega un renglón de más acá.
   *
   * Se compara lo que se sale, no el alto: en un teléfono donde las dos
   * pantallas entran enteras, doce píxeles más de alto no le hacen daño a
   * nadie, y hacer fallar el portón por eso sería medir la cosa equivocada.
   */
  const seVa = (fondo) => Math.max(0, fondo - telefono.height)
  if (seVa(ultimo) > seVa(medio)) {
    fallos.push(
      `[${telefono.nombre}] El último descanso se va ${Math.round(seVa(ultimo))} px abajo del borde, y el del medio se iba ${Math.round(seVa(medio))}. Lo que se agregó ahí empeoró una pantalla que ya estaba al borde.`,
    )
  }

  const ancho = await p.evaluate(() => document.documentElement.scrollWidth)
  if (ancho > telefono.width + 1) {
    const quien = await quienDesborda(p)
    culpar(
      telefono,
      `[${telefono.nombre}] El descanso desborda a lo ancho: ${ancho} px en ${telefono.width}. Lo empuja ${quien?.que ?? 'algo que ya no está'}.`,
    )
  }
}

async function medirSemana(p, telefono) {
  await p.goto(`${BASE}/#/ajustes`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(500)

  // Se toca un día para que la semana pase a ser propia, que es el estado nuevo
  // y el que puede desbordar: la fila del sábado pasa de "—" a "FUERZA + FUELLE",
  // que es el rótulo más largo de los cuatro.
  const sabado = p.getByRole('button', { name: /Sábado/ })
  if (!(await sabado.isVisible().catch(() => false))) {
    culpar(telefono, `[${telefono.nombre}] No se encontró la fila del sábado en la grilla de la semana.`)
    return
  }
  await sabado.click()
  await p.waitForTimeout(200)
  await sabado.click()
  await p.waitForTimeout(300)

  const caja = await sabado.boundingBox()
  if (caja && caja.height < 44) {
    culpar(
      telefono,
      `[${telefono.nombre}] La fila del sábado mide ${Math.round(caja.height)} px de alto: por debajo de los 44 que el sistema fija como mínimo táctil.`,
    )
  }
  if (caja) {
    medidas.push(`[${telefono.nombre}] Ajustes · la fila de un día mide ${Math.round(caja.height)} px de alto.`)
  }

  const ancho = await p.evaluate(() => document.documentElement.scrollWidth)
  if (ancho > telefono.width + 1) {
    const quien = await quienDesborda(p)
    culpar(
      telefono,
      `[${telefono.nombre}] Ajustes desborda a lo ancho: ${ancho} px en ${telefono.width}. Lo empuja ${quien?.que ?? 'algo que ya no está'}.`,
    )
  }
}

const navegador = await chromium.launch({ executablePath: CHROMIUM })

for (const telefono of TELEFONOS) {
  const contexto = await navegador.newContext({
    viewport: { width: telefono.width, height: telefono.height },
    colorScheme: 'dark',
    locale: 'es-AR',
  })
  const pagina = await contexto.newPage()
  pagina.on('pageerror', (e) => fallos.push(`[${telefono.nombre}] Error de JavaScript: ${e.message}`))

  // Cada teléfono en su propio try: que uno se caiga no puede dejar sin medir a
  // los otros dos, que es justo cuando una regresión se escapa.
  try {
    await alta(pagina)
    await medirHoy(pagina, telefono)
    await medirSemana(pagina, telefono)
    await pagina.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
    await pagina.waitForTimeout(400)
    await medirDescanso(pagina, telefono)
  } catch (e) {
    fallos.push(`[${telefono.nombre}] El recorrido se cortó: ${e.message.split('\n')[0]}`)
  }

  await contexto.close()
}

await navegador.close()

for (const linea of medidas) console.log(linea)

if (deudas.length > 0) {
  console.log(
    '\nDeuda vieja en 320×568, anterior a este portón y que no lo hace fallar:\n' +
      deudas.map((d) => `· ${d}`).join('\n'),
  )
}

if (fallos.length > 0) {
  console.error('\n' + fallos.map((f) => `· ${f}`).join('\n'))
  process.exit(1)
}

console.log('\nLa acción de Hoy tiene su aire y nada nuevo se fue abajo del pliegue.')
