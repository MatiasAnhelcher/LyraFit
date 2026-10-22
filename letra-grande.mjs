/**
 * La letra grande: la app con el tamaño de letra del teléfono al 125 %.
 *
 * Mucha gente usa el teléfono con la letra agrandada, y no siempre por ver
 * mal: porque lo usa de lejos, apoyado en el piso, o con el pulso alto. Una
 * pantalla diseñada al píxel para la letra de fábrica se rompe ahí sin que
 * nadie la mire: un rótulo cortado por la mitad, un segmento que se sale de
 * su celda, la página que scrollea a lo ancho, la acción que queda abajo de
 * la barra. Esto la mira con `html { font-size: 125% }`, a 360×640 y a
 * 320×568, en todas las rutas (§10.3).
 *
 * ## Qué mide, en cada pantalla
 *
 *   - **Ningún texto cortado:** en todo elemento con texto y `overflow`
 *     `hidden` o `clip`, `scrollHeight ≤ clientHeight + 1`.
 *   - **Ningún `.segmento` que se salga a lo ancho:** `scrollWidth ≤
 *     clientWidth`.
 *   - **Nada de scroll a lo ancho**, ni en la página ni en un contenedor que
 *     scrollea.
 *   - **Empezar, "Listo" y "Cerrar la sesión" alcanzables:** traídos a la
 *     vista, entran enteros en la pantalla y su centro da el mismo botón:
 *     nada fijo los tapa.
 *   - **En la serie,** el número, los dos pasos y la acción principal se ven
 *     sin scrollear, con la predicción ("Voy") y al anotar.
 *   - **El eje de FUERZA POR SEMANA,** con dos, tres, nueve y diez semanas de
 *     sesiones, y de dos a doce a 320 con la letra al 150 %: cada rótulo debajo de su columna, adentro de las barras y sin
 *     pisar al otro, con la fecha más ancha del año. Es lo más angosto de
 *     Progreso, y con una sola semana —lo que deja el alta— no se ve.
 *
 * ## Qué afirma y qué es deuda
 *
 * Falla todo, en todas las pantallas, salvo lo de adentro de Entrenar —la
 * serie, el descanso, la serie de cierre y las preguntas—, que se mide igual
 * y se informa como deuda de P2, el paquete que la rehace (Plan de
 * implementación), como en `toques.mjs`. Hoy esa deuda es la acción de la
 * serie, que con la letra grande mide 110 px y queda abajo del borde, y el
 * encabezado del ejercicio, que a 320 se sale 28 px a lo ancho. Lo del
 * armazón —la barra, la franja de arriba y el dock— falla también ahí.
 *
 * Uso: npm run build && npx vite preview --port 4173, y después `node letra-grande.mjs`.
 * Con otro puerto: `BASE=http://localhost:4187 node letra-grande.mjs`.
 */

import {
  BASE,
  abrir,
  alta,
  completarUnaSesion,
  conLaBase,
  revisarQueSirvaLoCompilado,
  trasElPasaje,
} from './lib/portones.mjs'

await revisarQueSirvaLoCompilado(BASE)

const TELEFONOS = [
  { nombre: '360×640', width: 360, height: 640 },
  { nombre: '320×568', width: 320, height: 568 },
]
/** Un lunes a las 10 en Buenos Aires: con Cuerpo completo, Hoy tiene Empezar. */
const LUNES = new Date('2026-10-19T10:00:00-03:00')

const fallos = []
const deudas = []
const medidas = []

/**
 * La letra del teléfono al 125 %, puesta antes de que corra la app y otra vez
 * en cada carga. Es lo que hace Chrome en Android con el tamaño de letra del
 * sistema: agranda el `rem`, y con él todo lo que se mide en `rem`.
 */
function agrandarLaLetra() {
  const poner = () => document.documentElement.style.setProperty('font-size', '125%')
  if (document.documentElement) poner()
  else document.addEventListener('readystatechange', poner, { once: true })
}

/** Lo que una pantalla tiene mal con la letra grande, medido en la página. */
const medirLaPantalla = (p) =>
  p.evaluate(async () => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const visible = (el) =>
      el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) &&
      !el.closest('[aria-hidden="true"], [inert], .sr-only')
    const nombre = (el) => {
      const clase = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/)[0]}` : ''
      return `${el.tagName.toLowerCase()}${clase} «${(el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 36)}»`
    }
    const delArmazon = (el) => !!el.closest('nav.barra, .encabezado-compacto, .dock')
    const recorta = (valor) => valor === 'hidden' || valor === 'clip'
    const problemas = []
    const raiz = document.documentElement
    if (raiz.scrollWidth > raiz.clientWidth + 0.5) {
      problemas.push({ armazon: false, texto: `la página scrollea a lo ancho: ${raiz.scrollWidth} px de ${raiz.clientWidth}` })
    }
    for (const el of document.body.querySelectorAll('*')) {
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue
      const e = getComputedStyle(el)
      const conTexto = (el.textContent ?? '').trim() !== ''
      if (recorta(e.overflowY) && conTexto && visible(el) && el.scrollHeight > el.clientHeight + 1) {
        problemas.push({
          armazon: delArmazon(el),
          texto: `${nombre(el)} corta el texto: ${el.scrollHeight} px de alto en ${el.clientHeight}`,
        })
      }
      const scrollea = ['auto', 'scroll'].includes(e.overflowX)
      if (scrollea && visible(el) && el.scrollWidth > el.clientWidth + 1) {
        problemas.push({
          armazon: delArmazon(el),
          texto: `${nombre(el)} scrollea a lo ancho: ${el.scrollWidth} px en ${el.clientWidth}`,
        })
      }
    }
    for (const s of document.querySelectorAll('.segmento')) {
      if (visible(s) && s.scrollWidth > s.clientWidth + 0.5) {
        problemas.push({ armazon: delArmazon(s), texto: `el segmento ${nombre(s)} se sale de su celda: ${s.scrollWidth} px en ${s.clientWidth}` })
      }
    }
    // Las filas de cadena de Hoy y del Cierre: rótulo, barra y cuenta adentro
    // de la fila, y cada eslabón con ancho para verse. A 320 con la letra
    // grande la barra quedaba de un dedo y el rótulo se salía de su columna.
    for (const fila of document.querySelectorAll('.fila-cadena-chica')) {
      if (!fila.checkVisibility()) continue
      const caja = fila.getBoundingClientRect()
      for (const hijo of fila.children) {
        const r = hijo.getBoundingClientRect()
        if (r.left < caja.left - 0.5 || r.right > caja.right + 0.5) {
          problemas.push({ armazon: false, texto: `en la fila de ${fila.textContent.trim().slice(0, 20)}, ${nombre(hijo)} se sale de la fila` })
        }
      }
      const angosto = [...fila.querySelectorAll('.bc-seg')].find((seg) => seg.getBoundingClientRect().width < 4)
      if (angosto) {
        problemas.push({
          armazon: false,
          texto: `en la fila de ${fila.textContent.trim().slice(0, 20)}, un eslabón mide ${angosto.getBoundingClientRect().width.toFixed(1)} px de ancho`,
        })
      }
    }
    // Las etiquetas de la barra, enteras y en un renglón: son del armazón.
    for (const etiqueta of document.querySelectorAll('nav.barra .etiqueta-barra')) {
      const pestana = etiqueta.closest('a').getBoundingClientRect()
      const caja = etiqueta.getBoundingClientRect()
      const rango = document.createRange()
      rango.selectNodeContents(etiqueta)
      const renglones = new Set([...rango.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size
      if (
        renglones !== 1 ||
        etiqueta.scrollWidth > etiqueta.clientWidth + 0.5 ||
        caja.left < pestana.left - 0.5 ||
        caja.right > pestana.right + 0.5 ||
        caja.bottom > pestana.bottom + 0.5
      ) {
        problemas.push({ armazon: true, texto: `la pestaña «${etiqueta.textContent}» no tiene su rótulo entero en un renglón adentro de la pestaña` })
      }
    }
    return problemas
  })

/**
 * Que un botón se pueda alcanzar: traído a la vista, entra entero en la
 * pantalla y su centro da el mismo botón.
 */
const alcanzar = (boton) =>
  boton.evaluate(async (el) => {
    el.scrollIntoView({ block: 'nearest' })
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const caja = el.getBoundingClientRect()
    const encima = document.elementFromPoint(caja.left + caja.width / 2, caja.top + caja.height / 2)
    const tapa = encima && !(encima === el || el.contains(encima))
    if (caja.top < -0.5 || caja.bottom > innerHeight + 0.5) return `queda en ${Math.round(caja.top)}–${Math.round(caja.bottom)}, afuera de una pantalla de ${innerHeight}`
    if (!encima) return 'tiene el centro afuera de la pantalla'
    if (tapa) return `queda tapado por ${encima.tagName.toLowerCase()}.${String(encima.className).split(' ')[0]}`
    return null
  })

/** `deuda`: el paquete que todavía rehace la pantalla; lo de adentro se le anota sin fallar. */
async function revisarLaPantalla(p, telefono, pantalla, { deuda = null } = {}) {
  const problemas = await medirLaPantalla(p)
  for (const { armazon, texto } of problemas) {
    if (deuda && !armazon) deudas.push(`[${telefono.nombre}] ${pantalla} · ${texto} (${deuda}).`)
    else fallos.push(`[${telefono.nombre}] ${pantalla} · ${texto}.`)
  }
  medidas.push(`[${telefono.nombre}] ${pantalla} · ${problemas.length === 0 ? 'nada cortado' : `${problemas.length} problema(s)`}.`)
}

async function revisarQueSeAlcance(p, telefono, pantalla, nombre, { dentro = 'body' } = {}) {
  const boton = p.locator(dentro).getByRole('button', { name: nombre, exact: true }).first()
  if (!(await boton.isVisible().catch(() => false))) {
    fallos.push(`[${telefono.nombre}] ${pantalla} · no está «${nombre}»: no se pudo ver si se alcanza.`)
    return
  }
  const mal = await alcanzar(boton)
  if (mal) fallos.push(`[${telefono.nombre}] ${pantalla} · «${nombre}» ${mal}.`)
}

/** En la serie: el número, los dos pasos y la acción, sin scrollear. Deuda de P2. */
async function revisarLaSerie(p, telefono, momento) {
  const afuera = await p.evaluate(() => {
    scrollTo(0, 0)
    for (const m of document.querySelectorAll('main')) m.scrollTop = 0
    const partes = [
      ['el número', document.querySelector('[data-prueba="repeticiones"]')],
      ['«Restar»', document.querySelector('button[aria-label="Restar"]')],
      ['«Sumar»', document.querySelector('button[aria-label="Sumar"]')],
      ['la acción', document.querySelector('.accion-esfuerzo')],
    ]
    return partes
      .map(([cual, el]) => {
        if (!el) return `${cual} no está`
        const c = el.getBoundingClientRect()
        return c.top < -0.5 || c.bottom > innerHeight + 0.5 ? `${cual} queda en ${Math.round(c.top)}–${Math.round(c.bottom)}` : null
      })
      .filter(Boolean)
  })
  if (afuera.length > 0) {
    deudas.push(`[${telefono.nombre}] La serie, ${momento} · sin scrollear no se ve todo: ${afuera.join(', ')} de ${telefono.height} (P2).`)
  }
}

/** Una sesión de flexiones por semana, de `desde` a `hasta` semanas antes de LUNES. */
function sesionesDeFuerza(desde, hasta) {
  const sesiones = []
  for (let atras = desde; atras >= hasta; atras--) {
    const dia = new Date(LUNES.getTime() - atras * 7 * 864e5)
    const fecha = dia.toISOString().slice(0, 10)
    sesiones.push({
      id: `eje-${fecha}`,
      fecha,
      finalizadaEn: dia.getTime(),
      duracionSegundos: 1800,
      tipo: 'plan',
      registros: [
        { ejercicioId: 'flexion-completa', objetivo: { series: 3, cantidad: 8 }, series: [{ logrado: 8 + (atras % 4) }] },
      ],
    })
  }
  return sesiones
}

/**
 * El eje de FUERZA con `semanas` en pantalla: los rótulos que se esperan,
 * cada uno debajo de su columna, adentro de las barras y de la placa, y con
 * dos píxeles de aire entre uno y otro. La primera fecha se mide con el texto
 * más ancho que puede tener, "30 sept": la del reloj fijo del portón es más
 * angosta y escondería un choque que en septiembre sí pasa.
 */
async function revisarElEjeDeFuerza(p, telefono, semanas, esperados) {
  await ir(p, '/progreso')
  await p.waitForTimeout(400)
  const { rotulos, problemas } = await p.evaluate(() => {
    const columnas = [...document.querySelector('.fila-fuerza .fuerza-columnas').children].map((c) => c.getBoundingClientRect())
    const placa = document.querySelector('.fuerza-eje').closest('.placa').getBoundingClientRect()
    const spans = [...document.querySelectorAll('.fuerza-eje > div > span')]
    const primera = spans[0]?.querySelector('.series-fecha')
    if (spans[0]?.hasAttribute('data-inicio') && primera?.textContent) primera.textContent = '30 sept'
    const rotulos = spans
      .map((s, j) => ({ j, texto: s.textContent.trim(), fecha: s.querySelector('.series-fecha') }))
      .filter((r) => r.texto && r.fecha.checkVisibility({ visibilityProperty: true }))
      .map((r) => ({ ...r, caja: r.fecha.getBoundingClientRect() }))
    const problemas = []
    rotulos.forEach((r, i) => {
      const suya = columnas[r.j]
      if (r.caja.left > suya.right + 0.5 || r.caja.right < suya.left - 0.5) problemas.push(`«${r.texto}» no queda debajo de su columna`)
      if (r.caja.left < columnas[0].left - 0.5 || r.caja.right > columnas[columnas.length - 1].right + 0.5 || r.caja.right > placa.right) {
        problemas.push(`«${r.texto}» se sale de las barras`)
      }
      const antes = rotulos[i - 1]
      if (antes && antes.caja.right + 2 > r.caja.left) problemas.push(`«${antes.texto}» y «${r.texto}» se pisan`)
    })
    return { rotulos: rotulos.map((r) => r.texto), problemas }
  })
  if (rotulos.length !== esperados) {
    fallos.push(`[${telefono.nombre}] Progreso con ${semanas} semanas: el eje de fuerza tiene ${rotulos.length} rótulos y se esperaban ${esperados} (${rotulos.join(', ')}).`)
  }
  for (const problema of problemas) fallos.push(`[${telefono.nombre}] Progreso con ${semanas} semanas, eje de fuerza: ${problema}.`)
}

/** Las filas de cadena que la medida de la pantalla mira de verdad. */
const filasVisibles = (p) =>
  p.evaluate(() => [...document.querySelectorAll('.fila-cadena-chica')].filter((f) => f.checkVisibility()).length)

async function ir(p, ruta) {
  await p.goto(`${BASE}/#${ruta}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(600)
}

for (const telefono of TELEFONOS) {
  const { navegador, contexto, pagina: p, fallos: errores } = await abrir({
    viewport: { width: telefono.width, height: telefono.height },
  })
  await contexto.addInitScript(agrandarLaLetra)
  await p.clock.setFixedTime(LUNES)

  // El alta, paso por paso, ya con la letra grande.
  let pasos = 0
  await alta(p, {
    enCadaPaso: async (paso) => {
      pasos++
      await revisarLaPantalla(p, telefono, `Alta · ${paso}`)
    },
  })
  if (pasos < 8) fallos.push(`[${telefono.nombre}] el alta se midió en ${pasos} pasos: el recorrido no la vio entera.`)
  const letra = await p.evaluate(() => getComputedStyle(document.documentElement).fontSize)
  if (letra !== '20px') fallos.push(`[${telefono.nombre}] la letra de la raíz es ${letra} y no 20px: el portón no mide la letra grande.`)

  await ir(p, '/')
  await revisarLaPantalla(p, telefono, 'Hoy')
  // Que las filas de cadena se hayan medido: si cambian de clase, se esconden o
  // Hoy deja de dibujarlas, el bloque que las mide pasaría en verde sin mirar
  // nada. Se cuentan con el mismo criterio de visibilidad que usa la medida.
  const filasDeHoy = await filasVisibles(p)
  if (filasDeHoy !== 5) fallos.push(`[${telefono.nombre}] Hoy dibujó ${filasDeHoy} filas de cadena y son cinco cadenas.`)
  await revisarQueSeAlcance(p, telefono, 'Hoy', 'Empezar', { dentro: 'main' })

  await ir(p, '/biblioteca')
  await revisarLaPantalla(p, telefono, 'Cadenas')
  await p.locator('main a[href*="/biblioteca/"]').first().click()
  await trasElPasaje(p)
  await p.waitForTimeout(500)
  await revisarLaPantalla(p, telefono, 'La ficha')

  // El diario, con la pregunta de la hora de acostarse abierta.
  await ir(p, '/diario')
  await p.getByRole('group', { name: 'Hora de la última cafeína' }).getByRole('button', { name: '20', exact: true }).click()
  await p.getByRole('group', { name: 'Hora de acostarte' }).waitFor({ state: 'visible' }).catch(() => {})
  await revisarLaPantalla(p, telefono, 'El diario')

  await ir(p, '/progreso')
  await revisarLaPantalla(p, telefono, 'Progreso')
  await ir(p, '/ajustes')
  await revisarLaPantalla(p, telefono, 'Ajustes')
  await ir(p, '/estado')
  await revisarLaPantalla(p, telefono, 'El chequeo')
  await revisarQueSeAlcance(p, telefono, 'El chequeo', 'Listo')
  await ir(p, '/molestia')
  await revisarLaPantalla(p, telefono, 'La molestia')
  await revisarQueSeAlcance(p, telefono, 'La molestia', 'Listo')
  await ir(p, '/reloj')
  await revisarLaPantalla(p, telefono, 'El reloj')

  // La serie: con la predicción y al anotar.
  await ir(p, '/')
  await p.locator('main').getByRole('button', { name: 'Empezar', exact: true }).click()
  await trasElPasaje(p)
  await p.getByRole('button', { name: 'Voy', exact: true }).waitFor({ state: 'visible', timeout: 3000 }).catch(() => {})
  await revisarLaPantalla(p, telefono, 'La serie, con "Voy"', { deuda: 'P2' })
  await revisarLaSerie(p, telefono, 'con "Voy"')
  await p.getByRole('button', { name: 'Voy', exact: true }).click()
  await p.waitForTimeout(300)
  await revisarLaPantalla(p, telefono, 'La serie, al anotar', { deuda: 'P2' })
  await revisarLaSerie(p, telefono, 'al anotar')

  const razon = await completarUnaSesion(p, {
    alVerElDescanso: () => revisarLaPantalla(p, telefono, 'El descanso', { deuda: 'P2' }),
    alVerElFinal: async (cual) => {
      if (cual === 'la serie de cierre') {
        await revisarLaPantalla(p, telefono, 'La serie de cierre', { deuda: 'P2' })
        await revisarQueSeAlcance(p, telefono, 'La serie de cierre', 'Listo')
      } else {
        await revisarLaPantalla(p, telefono, 'Las preguntas', { deuda: 'P2' })
        await revisarQueSeAlcance(p, telefono, 'Las preguntas', 'Cerrar la sesión')
      }
    },
  })
  if (razon) fallos.push(`[${telefono.nombre}] La sesión no se pudo recorrer: ${razon}.`)
  else {
    await revisarLaPantalla(p, telefono, 'El Cierre')
    await revisarQueSeAlcance(p, telefono, 'El Cierre', 'Listo')
    if ((await filasVisibles(p)) === 0) {
      fallos.push(`[${telefono.nombre}] El Cierre no dibujó ninguna fila de cadena: la medida de la fila chica no miró nada.`)
    }
  }

  // El eje de FUERZA con historia. La sesión de recién es la de esta semana:
  // con una más, la semana pasada, son dos —solo "esta"—; con tres, "esta"
  // todavía arranca en su columna; con nueve, todavía sin fecha; con diez, la
  // primera con fecha, que es donde quedan más cerca.
  for (const [desde, hasta, semanas, esperados] of [
    [1, 1, 2, 1],
    [2, 2, 3, 1],
    [8, 3, 9, 1],
    [9, 9, 10, 2],
  ]) {
    await p.evaluate((s) => {
      window.__sesiones = s
    }, sesionesDeFuerza(desde, hasta))
    await conLaBase(p, ['sesiones'], async (leer, poner) => {
      for (const s of window.__sesiones) poner('sesiones', s)
    })
    await p.reload({ waitUntil: 'networkidle' })
    await revisarElEjeDeFuerza(p, telefono, semanas, esperados)
  }

  fallos.push(...errores.map((e) => `[${telefono.nombre}] ${e}`))
  await navegador.close()
}

// El eje de FUERZA con la letra al 150 % (la del navegador en algunos
// teléfonos), a 320, de dos a doce semanas: es donde "esta" tiene menos lugar
// y donde la primera fecha ya no entra.
{
  const telefono = { nombre: '320×568 al 150 %', width: 320, height: 568 }
  const { navegador, contexto, pagina: p, fallos: errores } = await abrir({ viewport: { width: 320, height: 568 } })
  await contexto.addInitScript(() => {
    const poner = () => document.documentElement.style.setProperty('font-size', '150%')
    if (document.documentElement) poner()
    else document.addEventListener('readystatechange', poner, { once: true })
  })
  await p.clock.setFixedTime(LUNES)
  await alta(p)
  for (let semanas = 2; semanas <= 12; semanas++) {
    const atras = semanas - 1
    await p.evaluate((s) => {
      window.__sesiones = s
    }, sesionesDeFuerza(atras, semanas === 2 ? 0 : atras))
    await conLaBase(p, ['sesiones'], async (leer, poner) => {
      for (const s of window.__sesiones) poner('sesiones', s)
    })
    await p.reload({ waitUntil: 'networkidle' })
    await revisarElEjeDeFuerza(p, telefono, semanas, 1)
  }
  fallos.push(...errores.map((e) => `[${telefono.nombre}] ${e}`))
  await navegador.close()
}

for (const linea of medidas) console.log(linea)

if (deudas.length > 0) {
  console.log(
    '\nDeuda de letra grande que no hace fallar todavía (la resuelve P2):\n' +
      deudas.map((d) => `· ${d}`).join('\n'),
  )
}

if (fallos.length > 0) {
  console.error('\n' + fallos.map((f) => `· ${f}`).join('\n'))
  process.exit(1)
}

console.log('\nCon la letra al 125 %, a 360 y a 320, ningún texto se corta, nada scrollea a lo ancho, Empezar y "Listo" se alcanzan, y el eje de fuerza se lee de dos a doce semanas, también con la letra al 150 %.')
