/**
 * Todo lo que se toca, del tamaño de un dedo.
 *
 * Un botón de 16 px de alto se toca igual con un dedo quieto, sentado y
 * mirando. Con el pulso a ciento cuarenta, con una mano y de reojo, se falla,
 * y fallar ahí es anotar una serie que no fue. Por eso Pulso pide 56 en el
 * esfuerzo y 48 en el resto (§5.5 y §5.6), y esto lo mide en el teléfono más
 * chico que se usa (360×640) y en el más chico que existe (320×568).
 *
 * ## Qué afirma
 *
 *   1. **La barra.** En las cinco secciones, cada pestaña mide 48 o más de
 *      alto y de ancho, y su rótulo va entero en un renglón: ni partido, ni
 *      cortado, ni afuera de la pestaña.
 *   2. **Las regletas.** Cada `.regleta` de la app —el diario con la hora de
 *      acostarse, el chequeo, la molestia, Ajustes, las cuatro pruebas del
 *      alta (con barra y sin ella) y las preguntas del final— cumple la regla
 *      de §5.6:
 *      - va en una fila, o en dos filas parejas: ⌈N/2⌉ arriba y ⌊N/2⌋ abajo,
 *        y cada fila, con sus huecos, cubre la regleta de un borde al otro;
 *      - cada celda mide 48 o más de ancho y de alto (52 de alto las de cifra,
 *        y 56 las del esfuerzo);
 *      - ninguna palabra se parte en dos renglones ni se sale de su celda;
 *      - a 360 va igual que a 320, porque la regla se decide contra un 320;
 *      - y a 320 va en dos filas solo si en una no entraba: celdas de menos
 *        del mínimo, o la palabra más ancha sin lugar. Partir lo que entraba
 *        también es un error: un teclado de cinco teclas en dos filas se lee
 *        peor que en una.
 *      Además, el ✓ está montado en todos los segmentos, ninguno corre una
 *      animación de `@keyframes` y elegir no corre el rótulo de lugar.
 *   3. **Las filas de Ajustes** miden 56 o más de alto, interruptores
 *      incluidos.
 *   4. **Los botones de contorno del descanso** ("+30 s", "Hoy no",
 *      "Saltear") miden 56 de alto: son del esfuerzo.
 *
 * ## La maquinaria, y lo que todavía no afirma
 *
 * `tocables()` junta todo `button`, `a` y `[role=button]` que se ve, con su
 * caja, y `chicos()` dice cuáles no llegan a un mínimo. Con eso se afirma lo
 * de arriba. El resto de cada pantalla se mide igual y se informa como deuda,
 * sin fallar: los paquetes de pantalla de Pulso (P1 a P10) la van pasando a
 * afirmación, pantalla por pantalla, hasta que todo mida 56 en el esfuerzo y
 * 48 afuera, con las filas de 56 (§10.3). Un portón que nace exigiendo lo que
 * todavía nadie arregló nace en rojo, y un portón en rojo no lo mira nadie.
 *
 * Uso: npm run build && npx vite preview --port 4173, y después `node toques.mjs`.
 * Con otro puerto: `BASE=http://localhost:4187 node toques.mjs`.
 */

import { BASE, abrir, alta, completarUnaSesion, revisarQueSirvaLoCompilado } from './lib/portones.mjs'

await revisarQueSirvaLoCompilado(BASE)

const TELEFONOS = [
  { nombre: '360×640', width: 360, height: 640 },
  { nombre: '320×568', width: 320, height: 568 },
]

/** El toque de afuera del esfuerzo, el de adentro y el de una fila (§5.6). */
const MINIMO = 48
const MINIMO_ESFUERZO = 56
const ALTO_DE_FILA = 56
/** Una celda de cifra lleva el número en Sora a 16 px: pide 52 de alto. */
const ALTO_DE_CIFRA = 52

/**
 * La geometría de la regleta, la misma de `src/componentes/regleta.ts`:
 * 4 px de relleno y de hueco, y el rótulo necesita 6 px de cada lado más el
 * píxel de cada borde. Está escrita de nuevo a propósito: si alguien cambia
 * la regla en el componente, el portón sigue midiendo la de la especificación.
 */
const RELLENO = 4
const HUECO = 4
const MARGEN_DEL_TEXTO = 14

/** Lo que un redondeo de subpíxel no debería convertir en una falla. */
const TOLERANCIA = 0.05
/** Lo que una fila puede quedar corta de la regleta: la grilla reparte en subpíxeles. */
const CUBRIR = 1

const fallos = []
const deudas = []
const medidas = []

/** La forma de cada regleta, por pantalla y por teléfono: `{ 'Diario · Alcohol': '3' }`. */
const formas = {}

/**
 * Todo lo que se toca y se ve, adentro de `raiz`, con su caja.
 *
 * Visible es visible de verdad: ni `display: none`, ni transparente, ni
 * adentro de algo `aria-hidden` o `inert`, y con caja. Lo que está abajo del
 * borde cuenta igual: se scrollea y se toca.
 */
async function tocables(p, raiz = 'body') {
  return p.evaluate((raiz) => {
    const nombre = (el) =>
      (el.getAttribute('aria-label') || el.innerText || el.textContent || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 40)
    return [...document.querySelectorAll(`${raiz} :is(button, a, [role="button"])`)]
      .filter(
        (el) =>
          el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) &&
          !el.closest('[aria-hidden="true"], [inert]'),
      )
      .map((el) => {
        const caja = el.getBoundingClientRect()
        return {
          nombre: nombre(el),
          ancho: caja.width,
          alto: caja.height,
          fila: el.matches('.fila-pulsable, .registro > *'),
        }
      })
      .filter((t) => t.ancho > 0 && t.alto > 0)
  }, raiz)
}

/** Los que no llegan: al mínimo de ancho y de alto, y las filas a 56 de alto. */
function chicos(lista, minimo) {
  return lista.filter((t) => {
    const alto = t.fila ? Math.max(minimo, ALTO_DE_FILA) : minimo
    return t.alto + TOLERANCIA < alto || t.ancho + TOLERANCIA < minimo
  })
}

const comoCaja = (t) => `«${t.nombre}» ${Math.round(t.ancho)}×${Math.round(t.alto)}`

/** La deuda de una pantalla: se informa y no hace fallar (ver arriba). */
async function anotarDeuda(p, telefono, pantalla, minimo = MINIMO) {
  const lista = chicos(await tocables(p, 'body'), minimo)
  if (lista.length === 0) return
  deudas.push(
    `[${telefono.nombre}] ${pantalla} · ${lista.length} de menos de ${minimo}: ${lista
      .slice(0, 4)
      .map(comoCaja)
      .join(', ')}${lista.length > 4 ? ', …' : ''}`,
  )
}

async function ir(p, ruta) {
  await p.goto(`${BASE}/#${ruta}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(600)
}

// ─── 1. La barra ─────────────────────────────────────────────────────────

const SECCIONES = [
  ['/', 'Hoy'],
  ['/biblioteca', 'Cadenas'],
  ['/diario', 'Diario'],
  ['/progreso', 'Progreso'],
  ['/ajustes', 'Ajustes'],
]

async function revisarLaBarra(p, telefono, pantalla) {
  const pestanas = await p.evaluate(() =>
    [...document.querySelectorAll('nav[aria-label="Secciones"] a')].map((a) => {
      const caja = a.getBoundingClientRect()
      const etiqueta = a.querySelector('.etiqueta-barra')
      if (!etiqueta) return { nombre: a.textContent?.trim() ?? '', sinEtiqueta: true }
      const suya = etiqueta.getBoundingClientRect()
      const rango = document.createRange()
      rango.selectNodeContents(etiqueta)
      const renglones = new Set(
        [...rango.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)),
      ).size
      return {
        nombre: etiqueta.textContent?.trim() ?? '',
        ancho: caja.width,
        alto: caja.height,
        renglones,
        cortada:
          etiqueta.scrollWidth > etiqueta.clientWidth + 0.5 ||
          suya.left < caja.left - 0.5 ||
          suya.right > caja.right + 0.5 ||
          suya.bottom > caja.bottom + 0.5,
        afuera: caja.left < -0.5 || caja.right > window.innerWidth + 0.5,
      }
    }),
  )
  if (pestanas.length !== 5) {
    fallos.push(`[${telefono.nombre}] ${pantalla} · la barra tiene ${pestanas.length} pestañas y no 5.`)
    return
  }
  for (const t of pestanas) {
    const donde = `[${telefono.nombre}] ${pantalla} · la pestaña «${t.nombre}»`
    if (t.sinEtiqueta) {
      fallos.push(`${donde} no tiene su .etiqueta-barra.`)
      continue
    }
    if (t.alto + TOLERANCIA < MINIMO || t.ancho + TOLERANCIA < MINIMO) {
      fallos.push(`${donde} mide ${t.ancho.toFixed(1)}×${t.alto.toFixed(1)}: le faltan para ${MINIMO}×${MINIMO}.`)
    }
    if (t.renglones !== 1) fallos.push(`${donde} parte su rótulo en ${t.renglones} renglones.`)
    if (t.cortada) fallos.push(`${donde} tiene el rótulo cortado o afuera de la pestaña.`)
    if (t.afuera) fallos.push(`${donde} se sale de la pantalla.`)
  }
  // La maquinaria, sobre lo mismo: si alguien suma algo tocable a la barra,
  // también tiene que medir 48.
  for (const t of chicos(await tocables(p, 'nav[aria-label="Secciones"]'), MINIMO)) {
    fallos.push(`[${telefono.nombre}] ${pantalla} · en la barra, ${comoCaja(t)} no llega a ${MINIMO}.`)
  }
}

// ─── 2. Las regletas ─────────────────────────────────────────────────────

/** Cada regleta visible, medida en la página. */
async function leerRegletas(p) {
  return p.evaluate(() => {
    const visibles = [...document.querySelectorAll('.regleta')].filter((r) => r.checkVisibility())
    return visibles.map((regleta) => {
      const celdas = [...regleta.children].filter((c) => c.matches('.segmento'))
      const cajas = celdas.map((c) => c.getBoundingClientRect())
      const arribas = [...new Set(cajas.map((c) => Math.round(c.top)))].sort((a, b) => a - b)
      const filas = []
      for (const arriba of arribas) {
        if (filas.length > 0 && arriba - filas[filas.length - 1].arriba <= 1) continue
        const suyas = cajas.filter((c) => Math.abs(Math.round(c.top) - arriba) <= 1)
        filas.push({
          arriba,
          celdas: suyas.length,
          izquierda: Math.min(...suyas.map((c) => c.left)),
          derecha: Math.max(...suyas.map((c) => c.right)),
          anchos: suyas.reduce((suma, c) => suma + c.width, 0),
        })
      }

      const cortadas = []
      let palabraMasAncha = 0
      for (const celda of celdas) {
        const texto = celda.querySelector('.segmento-texto')
        if (!texto) continue
        if (celda.scrollWidth > celda.clientWidth + 0.5 || texto.scrollWidth > texto.clientWidth + 0.5) {
          cortadas.push(`«${texto.textContent}» se sale de su celda`)
        }
        // Palabra por palabra: una palabra partida en dos renglones —con
        // guion o sin él— tiene dos cajas.
        const recorrido = document.createTreeWalker(texto, NodeFilter.SHOW_TEXT)
        for (let nodo = recorrido.nextNode(); nodo; nodo = recorrido.nextNode()) {
          for (const m of nodo.data.matchAll(/\S+/g)) {
            const rango = document.createRange()
            rango.setStart(nodo, m.index)
            rango.setEnd(nodo, m.index + m[0].length)
            const partes = [...rango.getClientRects()].filter((r) => r.width > 0)
            if (partes.length > 1) cortadas.push(`«${m[0]}» partida en ${partes.length}`)
            for (const parte of partes) palabraMasAncha = Math.max(palabraMasAncha, parte.width)
          }
        }
      }

      const estilo = (el) => (el ? getComputedStyle(el).animationName : 'none')
      const caja = regleta.getBoundingClientRect()
      return {
        etiqueta: regleta.getAttribute('aria-label') ?? '(sin nombre)',
        grupo: regleta.getAttribute('role') === 'group',
        ancho: caja.width,
        vertical: regleta.hasAttribute('data-vertical'),
        esfuerzo: regleta.hasAttribute('data-esfuerzo'),
        n: celdas.length,
        filas: filas.map((f) => f.celdas),
        // Cada fila contra los bordes de la regleta: dónde empieza su primera
        // celda, dónde termina la última y cuánto suman entre las dos.
        bordes: filas.map((f) => ({
          celdas: f.celdas,
          izquierda: f.izquierda - caja.left,
          derecha: caja.right - f.derecha,
          anchos: f.anchos,
        })),
        celdas: celdas.map((c, i) => ({
          nombre: c.textContent?.trim() ?? '',
          ancho: cajas[i].width,
          alto: cajas[i].height,
          cifra: c.classList.contains('segmento-cifra'),
          tilde: !!c.querySelector('.segmento-tilde'),
          animada: estilo(c) !== 'none' || estilo(c.querySelector('.segmento-tilde')) !== 'none',
          mayusculas: getComputedStyle(c).textTransform === 'uppercase',
        })),
        cortadas,
        palabraMasAncha,
      }
    })
  })
}

/** Lo que la regla de §5.6 dice para N opciones en ese ancho de 320. */
function laForma(r) {
  if (r.n <= 2) return [r.n]
  const minimo = r.esfuerzo ? MINIMO_ESFUERZO : MINIMO
  const celda = (r.ancho - 2 * RELLENO - (r.n - 1) * HUECO) / r.n
  const entra = celda + TOLERANCIA >= minimo && r.palabraMasAncha + MARGEN_DEL_TEXTO <= celda + TOLERANCIA
  return entra ? [r.n] : [Math.ceil(r.n / 2), Math.floor(r.n / 2)]
}

async function revisarRegletas(p, telefono, pantalla, { esperadas = 1 } = {}) {
  const regletas = await leerRegletas(p)
  if (regletas.length < esperadas) {
    fallos.push(
      `[${telefono.nombre}] ${pantalla} · se esperaban ${esperadas} regletas o más y hay ${regletas.length}: el recorrido no llegó a donde tenía que medir.`,
    )
  }
  for (const r of regletas) {
    const donde = `[${telefono.nombre}] ${pantalla} · «${r.etiqueta}»`
    const minimo = r.esfuerzo ? MINIMO_ESFUERZO : MINIMO
    if (!r.grupo || r.etiqueta === '(sin nombre)') fallos.push(`${donde} no es un grupo con nombre.`)
    if (r.vertical) fallos.push(`${donde} cayó a una columna con la letra al 100 %: ni en dos filas entraba.`)

    const forma = r.filas.join(' + ')
    medidas.push(`${donde} · ${r.n} en ${forma}, palabra más ancha ${r.palabraMasAncha.toFixed(1)} px.`)
    ;(formas[pantalla] ??= {})[r.etiqueta] ??= {}
    formas[pantalla][r.etiqueta][telefono.nombre] = forma

    // Contar las celdas de cada fila no alcanza: un 4 + 3 con la última fila
    // repartida en tercios de cuarto deja una celda de hueco a la derecha y
    // cuenta igual. Cada fila, con sus huecos, cubre el ancho de adentro de la
    // regleta, de relleno a relleno.
    const interior = r.ancho - 2 * RELLENO
    for (const [i, f] of r.bordes.entries()) {
      const cubre = f.anchos + (f.celdas - 1) * HUECO
      const corrida = Math.max(Math.abs(f.izquierda - RELLENO), Math.abs(f.derecha - RELLENO), Math.abs(cubre - interior))
      if (corrida > CUBRIR) {
        fallos.push(
          `${donde} · la fila ${i + 1} (${f.celdas} celdas) no cubre la regleta: empieza a ${f.izquierda.toFixed(1)} px del borde, termina a ${f.derecha.toFixed(1)} y ocupa ${cubre.toFixed(1)} de ${interior.toFixed(1)} px (con relleno de ${RELLENO}).`,
        )
      }
    }

    if (!r.vertical) {
      const parejas = r.filas.length === 2 && r.filas[0] === Math.ceil(r.n / 2) && r.filas[1] === Math.floor(r.n / 2)
      if (!(r.filas.length === 1 || parejas)) {
        fallos.push(`${donde} va en ${forma}: tiene que ir en una fila o en dos parejas (${Math.ceil(r.n / 2)} + ${Math.floor(r.n / 2)}).`)
      }
      // La regla se decide a 320, que es donde el ancho medido es el de la regla.
      if (telefono.width === 320) {
        const debida = laForma(r).join(' + ')
        if (debida !== forma) {
          fallos.push(
            `${donde} va en ${forma} y a 320 le toca ${debida} (celda en una fila: ${((r.ancho - 2 * RELLENO - (r.n - 1) * HUECO) / r.n).toFixed(1)} px para un mínimo de ${minimo} y una palabra de ${r.palabraMasAncha.toFixed(1)}).`,
          )
        }
      }
    }

    for (const c of r.celdas) {
      const alto = Math.max(minimo, c.cifra ? ALTO_DE_CIFRA : 0)
      if (c.alto + TOLERANCIA < alto || c.ancho + TOLERANCIA < minimo) {
        fallos.push(`${donde} · «${c.nombre}» mide ${c.ancho.toFixed(1)}×${c.alto.toFixed(1)}: le faltan para ${minimo} de ancho y ${alto} de alto.`)
      }
      if (!c.tilde) fallos.push(`${donde} · «${c.nombre}» no tiene el ✓ montado.`)
      if (c.animada) fallos.push(`${donde} · «${c.nombre}» corre una animación de @keyframes.`)
      if (c.mayusculas) fallos.push(`${donde} · «${c.nombre}» va en mayúsculas.`)
    }
    for (const cortada of r.cortadas) fallos.push(`${donde} · ${cortada}.`)
  }
}

/**
 * Elegir no corre el rótulo: el ✓ tiene su lugar reservado. Se mide el rótulo
 * de un segmento sin elegir, se lo elige y se lo vuelve a medir.
 */
async function revisarQueElegirNoCorra(p, telefono, pantalla, grupo, nombre) {
  const segmento = p.getByRole('group', { name: grupo }).getByRole('button', { name: nombre, exact: true })
  // Contra la caja del segmento y no contra la pantalla: tocar algo de abajo
  // scrollea la página, y eso no es el rótulo corriéndose.
  const caja = () =>
    segmento.evaluate((s) => {
      const de = s.getBoundingClientRect()
      const texto = s.querySelector('.segmento-texto')?.getBoundingClientRect()
      return texto ? { x: texto.left - de.left, y: texto.top - de.top } : null
    })
  const antes = await caja()
  await segmento.click()
  await p.waitForTimeout(400)
  const elegido = (await segmento.getAttribute('aria-pressed')) === 'true'
  const despues = await caja()
  if (!antes || !despues || !elegido) {
    fallos.push(`[${telefono.nombre}] ${pantalla} · no se pudo elegir «${nombre}» en «${grupo}» para ver si el rótulo se corre.`)
    return
  }
  const corrido = Math.max(Math.abs(despues.x - antes.x), Math.abs(despues.y - antes.y))
  if (corrido > 0.5) {
    fallos.push(`[${telefono.nombre}] ${pantalla} · elegir «${nombre}» corrió el rótulo ${corrido.toFixed(1)} px: el ✓ no tiene su lugar reservado.`)
  }
}

// ─── El recorrido ────────────────────────────────────────────────────────

for (const telefono of TELEFONOS) {
  const { navegador, pagina: p, fallos: errores } = await abrir({
    viewport: { width: telefono.width, height: telefono.height },
  })

  // Las cuatro pruebas del alta, con barra y sin ella. Cada una tiene su
  // regleta (ocho, siete, siete y ocho valores; seis en la tracción sin
  // barra), y es la MISMA regleta la que pasa de una prueba a la otra sin
  // desmontarse: mirando solo la primera no se ve si la segunda hereda el
  // reparto de ocho. Elegir «12» en la primera es el "no se corre" del alta.
  for (const conBarra of [true, false]) {
    const cual = conBarra ? 'con barra' : 'sin barra'
    const abierto = conBarra ? null : await abrir({ viewport: { width: telefono.width, height: telefono.height } })
    const q = abierto ? abierto.pagina : p
    let rotuloAntes = null
    let pruebas = 0
    await alta(q, {
      conBarra,
      enCadaPaso: async (paso) => {
        if (paso === 'prueba' || /^prueba-\d$/.test(paso)) {
          pruebas++
          await revisarRegletas(q, telefono, `Alta ${cual} · prueba ${paso === 'prueba' ? 1 : paso.slice(-1)}`)
        }
        // En coordenadas de documento: cada paso del alta arranca arriba, y
        // tocar «12» scrollea la página para alcanzarlo, cosa que la pantalla
        // no ve. Pero si al elegir se corre el segmento o la regleta entera,
        // el rótulo se corre con ellos, y eso sí se ve.
        const rotuloDel12 = () =>
          q.getByRole('button', { name: '12', exact: true }).evaluate((s) => {
            const texto = s.querySelector('.segmento-texto')?.getBoundingClientRect()
            return texto ? { x: texto.left + window.scrollX, y: texto.top + window.scrollY } : null
          })
        if (paso === 'prueba') {
          rotuloAntes = await rotuloDel12()
        }
        if (paso === 'prueba-elegida') {
          const ahora = await rotuloDel12()
          const corrido = rotuloAntes && ahora ? Math.max(Math.abs(ahora.x - rotuloAntes.x), Math.abs(ahora.y - rotuloAntes.y)) : 0
          if (!rotuloAntes || !ahora) {
            fallos.push(`[${telefono.nombre}] Alta ${cual} · prueba 1 · no se pudo medir el rótulo de «12» para ver si se corre.`)
          } else if (corrido > 0.5) {
            fallos.push(`[${telefono.nombre}] Alta ${cual} · prueba 1 · elegir «12» corrió el rótulo ${corrido.toFixed(1)} px.`)
          }
        }
        if (conBarra && paso !== 'prueba-elegida') await anotarDeuda(q, telefono, `Alta · ${paso}`)
      },
    })
    if (pruebas !== 4) fallos.push(`[${telefono.nombre}] Alta ${cual} · se midieron ${pruebas} de 4 pruebas.`)
    if (abierto) {
      fallos.push(...abierto.fallos.map((e) => `[${telefono.nombre}] Alta ${cual} · ${e}`))
      await abierto.navegador.close()
    }
  }

  for (const [ruta, nombre] of SECCIONES) {
    await ir(p, ruta)
    await revisarLaBarra(p, telefono, nombre)
    await anotarDeuda(p, telefono, nombre)
  }

  // El diario, con la hora de acostarse abierta: aparece con un café a las 20.
  await ir(p, '/diario')
  await p.getByRole('group', { name: 'Hora de la última cafeína' }).getByRole('button', { name: '20', exact: true }).click()
  await p.getByRole('group', { name: 'Hora de acostarte' }).waitFor({ state: 'visible' })
  await p.waitForTimeout(300)
  await revisarRegletas(p, telefono, 'Diario', { esperadas: 7 })
  await revisarQueElegirNoCorra(p, telefono, 'Diario', 'Alcohol', 'Nada')

  await ir(p, '/estado')
  await revisarRegletas(p, telefono, 'Estado', { esperadas: 4 })
  await anotarDeuda(p, telefono, 'Estado')

  await ir(p, '/molestia')
  await revisarRegletas(p, telefono, 'Molestia')
  await anotarDeuda(p, telefono, 'Molestia')

  // Ajustes: la regleta de la barra de 28 días y las filas, interruptores
  // incluidos. Las filas son lo que se toca en esta pantalla.
  await ir(p, '/ajustes')
  await revisarRegletas(p, telefono, 'Ajustes')
  const filas = (await tocables(p, '.registro')).filter((t) => t.fila)
  const interruptores = await p.locator('button:has(.interruptor)').count()
  if (filas.length < 10 || interruptores < 3) {
    fallos.push(`[${telefono.nombre}] Ajustes · se midieron ${filas.length} filas y ${interruptores} interruptores: el recorrido no vio la pantalla entera.`)
  }
  for (const t of chicos(filas, MINIMO)) {
    fallos.push(`[${telefono.nombre}] Ajustes · la fila ${comoCaja(t)} no llega a ${ALTO_DE_FILA} de alto.`)
  }
  medidas.push(`[${telefono.nombre}] Ajustes · ${filas.length} filas, ${interruptores} con interruptor, la más baja de ${Math.round(Math.min(...filas.map((t) => t.alto)))} px.`)

  // La sesión entera, para el descanso y las preguntas del final.
  let descansoMedido = false
  const razon = await completarUnaSesion(p, {
    alVerElDescanso: async () => {
      const contornos = await p.evaluate(() =>
        [...document.querySelectorAll('.boton-contorno')]
          .filter((b) => b.checkVisibility())
          .map((b) => ({ nombre: b.textContent?.trim() ?? '', alto: b.getBoundingClientRect().height })),
      )
      descansoMedido = contornos.length >= 2
      for (const b of contornos) {
        if (b.alto + TOLERANCIA < MINIMO_ESFUERZO) {
          fallos.push(`[${telefono.nombre}] Descanso · «${b.nombre}» mide ${b.alto.toFixed(1)} de alto: en el esfuerzo son ${MINIMO_ESFUERZO}.`)
        }
      }
      await anotarDeuda(p, telefono, 'Descanso', MINIMO_ESFUERZO)
    },
    alVerElFinal: async (cual) => {
      if (cual !== 'las preguntas') return
      await revisarRegletas(p, telefono, 'Preguntas del final', { esperadas: 3 })
      const esfuerzo = await p.locator('.regleta[data-esfuerzo]').count()
      if (esfuerzo !== 3) {
        fallos.push(`[${telefono.nombre}] Preguntas del final · ${esfuerzo} de 3 regletas son del esfuerzo: sin eso piden 48 y no 56.`)
      }
    },
  })
  if (razon) fallos.push(`[${telefono.nombre}] La sesión no se pudo recorrer: ${razon}.`)
  if (!razon && !descansoMedido) fallos.push(`[${telefono.nombre}] El descanso no mostró sus botones de contorno.`)

  fallos.push(...errores.map((e) => `[${telefono.nombre}] ${e}`))
  await navegador.close()
}

// A 360 igual que a 320: la regla se toma contra un 320 en cualquier teléfono.
for (const [pantalla, regletas] of Object.entries(formas)) {
  for (const [etiqueta, porTelefono] of Object.entries(regletas)) {
    const vistas = Object.entries(porTelefono)
    if (vistas.length !== TELEFONOS.length) {
      fallos.push(`${pantalla} · «${etiqueta}» se vio en ${vistas.length} de ${TELEFONOS.length} teléfonos.`)
    } else if (new Set(vistas.map(([, forma]) => forma)).size > 1) {
      fallos.push(`${pantalla} · «${etiqueta}» cambia de forma entre teléfonos: ${vistas.map(([t, f]) => `${f} a ${t}`).join(', ')}.`)
    }
  }
}

for (const linea of medidas) console.log(linea)

if (deudas.length > 0) {
  console.log(
    '\nDeuda de toques que no hace fallar todavía (la van pasando a afirmación los paquetes de pantalla):\n' +
      deudas.map((d) => `· ${d}`).join('\n'),
  )
}

if (fallos.length > 0) {
  console.error('\n' + fallos.map((f) => `· ${f}`).join('\n'))
  process.exit(1)
}

console.log('\nLa barra, las regletas, las filas de Ajustes y el descanso tienen el tamaño de un dedo.')
