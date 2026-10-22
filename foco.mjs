/**
 * El foco: dónde cae al navegar, que nada lo tape y que se vea.
 *
 * Quien navega con teclado, con un teclado conectado al teléfono o con un
 * lector de pantalla no ve la pantalla como un dedo: ve un solo elemento por
 * vez, el enfocado. Si al cambiar de pantalla el foco se queda en `<body>`,
 * el Tab siguiente arranca de cualquier lado; si el elemento enfocado queda
 * detrás de la barra o del dock pegado, el foco existe y no se ve; y si el
 * contorno se pierde contra lo que tiene al lado, es lo mismo que no tenerlo.
 * Esto lo mide a 360×640, el teléfono de referencia de Pulso (§10.3).
 *
 * ## Qué afirma
 *
 *   1. **Al llegar.** En la primera carga el foco no se mueve. Al navegar —con
 *      un toque en la barra, con Enter sobre una pestaña, de Cadenas a una
 *      ficha y de vuelta, de Hoy al chequeo, a la molestia y a Entrenar— el
 *      foco está en el `h1` de la pantalla nueva, **también en Hoy, donde es
 *      `sr-only`**, o en su `main` si todavía no tiene `h1`; y no dibuja
 *      contorno, porque no es un control. El título del documento es el de
 *      la pantalla (§7.1).
 *   2. **Con Tab.** Hoy con el dock pegado, la serie, el descanso, la serie de
 *      cierre, las preguntas y el Cierre se recorren con Tab y con Shift+Tab,
 *      y en cada elemento enfocado:
 *      - el centro da el mismo elemento en `elementFromPoint`: nada fijo o
 *        pegado lo tapa (WCAG 2.4.11);
 *      - el contorno mide 2 px: afuera va en acento; en `.accion-esfuerzo`,
 *        hacia adentro y en sobre-acento (§2.1, Decisión 29);
 *      - y se ve: por cada lado se toman puntos cada 4 px sobre el trazo, y
 *        cuentan los que caen en la pantalla, sin nada fijo encima y a 3:1 o
 *        más contra lo que tienen al lado. Tienen que sumar por lo menos el
 *        lado más largo, la misma regla que `paleta.mjs`; y ningún lado
 *        entero puede quedar afuera de la pantalla.
 *      Y en Hoy, el Tab que llega a la acción del dock pegado no mueve la
 *      página: ya está a la vista.
 *   3. **El Diario.** Después de tocar "Cambiar" con el teclado, el foco está
 *      en la hora marcada, y su contorno pasa por lo mismo que el de arriba.
 *   4. **Entrenar** (P2). El foco va al encabezado de cada estado nuevo
 *      (§7.1): el rótulo DESCANSO, el `h1` de la serie de cierre, ANTES DE
 *      CERRAR. Y "Cómo se hace", que es una `.hoja[data-completa]`, toma el
 *      foco al abrirse, no lo deja salir con Tab y lo devuelve al botón que
 *      la abrió al cerrarse con Escape.
 *
 * ## Lo que todavía es deuda
 *
 * Se mide igual y se informa sin fallar, como la deuda de `toques.mjs`: en el
 * Cierre, que rehace P3, lo que depende de cómo está armada la pantalla —un
 * elemento tapado, un contorno cortado por el borde o perdido contra lo de al
 * lado—. Lo del contorno mismo —2 px, el color, hacia dónde va— es de toda la
 * app y falla también ahí.
 *
 * Uso: npm run build && npx vite preview --port 4173, y después `node foco.mjs`.
 * Con otro puerto: `BASE=http://localhost:4187 node foco.mjs`.
 */

import { BASE, abrir, alta, completarUnaSesion, conLaBase, revisarQueSirvaLoCompilado, trasElPasaje } from './lib/portones.mjs'
import { medidasEnLaPagina } from './lib/medidas.mjs'
import { aRGB, contraste } from './lib/color.mjs'

await revisarQueSirvaLoCompilado(BASE)

const TELEFONO = { width: 360, height: 640 }
/**
 * Un lunes a las 10 en Buenos Aires: con Cuerpo completo es día de entrenar,
 * y con el chequeo prendido el dock de Hoy se pega a 360×640.
 */
const LUNES = new Date('2026-10-19T10:00:00-03:00')
const FONDO = [7, 9, 12]

const fallos = []
const deudas = []
const medidas = []
let enfocados = 0

const { navegador, contexto, pagina: p, fallos: errores } = await abrir({ viewport: TELEFONO })
await contexto.addInitScript(medidasEnLaPagina)
await p.clock.setFixedTime(LUNES)

const ruta = () => p.evaluate(() => location.hash.slice(1) || '/')

/**
 * Espera a que la pantalla nueva tome el foco: el hook lo mueve cuando
 * termina el pasaje y llega el contenido. Una evaluación suelta cada 100 ms,
 * como `trasElPasaje`, y a los 2 s se mide lo que haya.
 */
async function esperarElFoco() {
  await trasElPasaje(p)
  const hasta = Date.now() + 2000
  while (Date.now() < hasta) {
    const quieto = await p.evaluate(() => {
      const principal = document.querySelector('main')
      return !!principal && document.activeElement === (principal.querySelector('h1') ?? principal)
    })
    if (quieto) return
    await p.waitForTimeout(100)
  }
}

// ─── 1. Al llegar ────────────────────────────────────────────────────────

/** Dónde quedó el foco después de llegar, y si dibuja contorno. */
const leerLaLlegada = () =>
  p.evaluate(() => {
    const a = document.activeElement
    const principal = document.querySelector('main')
    const h1 = principal?.querySelector('h1') ?? null
    const destino = h1 ?? principal
    const e = a ? getComputedStyle(a) : null
    const texto = (a?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 30)
    return {
      titulo: document.title,
      h1: (h1?.textContent ?? '').trim(),
      enElDestino: !!destino && a === destino,
      destino: h1 ? (h1.classList.contains('sr-only') ? 'el h1 sr-only' : 'el h1') : 'el main',
      enfocado: !a || a === document.body ? 'body' : `${a.tagName.toLowerCase()} «${texto}»`,
      contorno: !!e && e.outlineStyle !== 'none' && parseFloat(e.outlineWidth) > 0,
    }
  })

/** `titulo` en `null`: el de la pantalla es su `h1` (la ficha, que se llama como su eslabón). */
async function revisarLaLlegada(pantalla, titulo, ir) {
  await ir()
  await esperarElFoco()
  const m = await leerLaLlegada()
  titulo ??= `${m.h1} · LyraFit`
  medidas.push(`${pantalla} · foco en ${m.enfocado}, «${m.titulo}».`)
  if (m.titulo !== titulo) fallos.push(`${pantalla} · el título del documento es «${m.titulo}» y no «${titulo}».`)
  if (!m.enElDestino) fallos.push(`${pantalla} · el foco quedó en ${m.enfocado} y no en ${m.destino} de la pantalla.`)
  else if (m.contorno) fallos.push(`${pantalla} · ${m.destino} enfocado dibuja contorno: no es un control.`)
}

const pestana = (nombre) => p.locator(`[data-prueba="nav-${nombre}"]`)
/** Una pestaña con el teclado: el foco en ella y Enter, sin tocar la pantalla. */
const conEnter = (nombre) => async () => {
  await pestana(nombre).focus()
  await p.keyboard.press('Enter')
}

await alta(p)
await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(900)
{
  const m = await leerLaLlegada()
  if (m.enfocado !== 'body') fallos.push(`En la primera carga el foco se movió a ${m.enfocado}: en la carga no se mueve.`)
  if (m.titulo !== 'Hoy · LyraFit') fallos.push(`Hoy · el título del documento es «${m.titulo}» y no «Hoy · LyraFit».`)
}

await revisarLaLlegada('Hoy → Cadenas', 'Cadenas · LyraFit', () => pestana('cadenas').click())
await revisarLaLlegada('Cadenas → Diario', 'El diario · LyraFit', () => pestana('diario').click())
await revisarLaLlegada('Diario → Progreso', 'Progreso · LyraFit', () => pestana('progreso').click())
await revisarLaLlegada('Progreso → Ajustes', 'Ajustes · LyraFit', () => pestana('ajustes').click())
await revisarLaLlegada('Ajustes → Hoy', 'Hoy · LyraFit', () => pestana('hoy').click())
// Con el teclado el foco programático sí es `:focus-visible`: es el caso en
// que un `h1` sin su regla dibujaría el contorno.
await revisarLaLlegada('Hoy → Diario, con Enter', 'El diario · LyraFit', conEnter('diario'))
await revisarLaLlegada('Diario → Hoy, con Enter', 'Hoy · LyraFit', conEnter('hoy'))
await revisarLaLlegada('Hoy → Cadenas, con Enter', 'Cadenas · LyraFit', conEnter('cadenas'))

await revisarLaLlegada('Cadenas → una ficha', null, () => p.locator('main a[href*="/biblioteca/"]').first().click())
await revisarLaLlegada('La ficha → Cadenas, con su pestaña', 'Cadenas · LyraFit', () => pestana('cadenas').click())

// ─── 2. Con Tab ──────────────────────────────────────────────────────────

/** El elemento enfocado, medido en la página. `null` si el foco está en nada. */
const medirElEnfocado = () =>
  p.evaluate(async () => {
    // Dos cuadros: el scroll que trae al enfocado a la vista y el estilo de
    // `:focus-visible` ya resueltos.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const el = document.activeElement
    if (!el || el === document.body || el.id === 'foco-ancla') return null
    const registro = window.__foco
    const visto = registro.vistos.has(el)
    registro.vistos.add(el)
    if (!visto) registro.orden.push(el)
    const { etiqueta, trazoDelFoco } = window.__paleta
    const caja = el.getBoundingClientRect()
    const encima = document.elementFromPoint(caja.left + caja.width / 2, caja.top + caja.height / 2)
    const nombreDe = (n) =>
      `${etiqueta(n)} «${(n.getAttribute('aria-label') || n.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30)}»`
    const e = getComputedStyle(el)
    return {
      visto,
      nombre: nombreDe(el),
      tapado: !encima ? 'nada: el centro cae afuera de la pantalla' : encima === el || el.contains(encima) ? null : nombreDe(encima),
      esfuerzo: el.matches('.accion-esfuerzo'),
      offset: parseFloat(e.outlineOffset),
      acento: registro.acento,
      sobreAcento: registro.sobreAcento,
      ...trazoDelFoco(el),
    }
  })

/**
 * Lo que el elemento enfocado tiene mal, en palabras; vacío si nada. Cada
 * problema dice si es del contorno (el grosor, el color, hacia dónde va), que
 * es de toda la app, o del lugar (tapado, cortado por el borde, perdido
 * contra lo de al lado), que depende de cómo está armada la pantalla.
 */
function juzgar(m) {
  const mal = []
  const delLugar = (texto) => mal.push({ texto, lugar: true })
  const delContorno = (texto) => mal.push({ texto, lugar: false })
  if (m.tapado) delLugar(`queda tapado en el centro por ${m.tapado}`)
  if (m.estilo === 'none' || !(m.ancho > 0)) {
    delContorno('no dibuja contorno')
    return mal
  }
  if (Math.abs(m.ancho - 2) > 0.01) delContorno(`tiene un contorno de ${m.ancho} px y no de 2`)
  const debido = m.esfuerzo ? m.sobreAcento : m.acento
  if (m.color !== debido) {
    delContorno(`tiene el contorno en ${m.color} y no en ${m.esfuerzo ? 'sobre-acento' : 'acento'} (${debido})`)
  }
  if (m.esfuerzo && m.offset >= 0) delContorno('es la acción del esfuerzo y lleva el contorno afuera: va hacia adentro')
  const color = aRGB(m.color, FONDO)
  let seVe = 0
  const porLado = []
  for (const [lado, puntos] of Object.entries(m.lados)) {
    let cuentan = 0
    let fuera = 0
    let tapado = null
    let peor = null
    for (const q of puntos) {
      if (!q.visible) {
        fuera++
        continue
      }
      if (q.tapado) {
        tapado = q.tapado
        continue
      }
      const contra = [q.adentro, q.afuera].filter(Boolean).map((f) => ({ ...f, r: contraste(color, aRGB(f.color, FONDO)) }))
      if (contra.some((f) => f.r >= 3)) cuentan++
      else peor ??= contra.sort((x, y) => x.r - y.r)[0]
    }
    seVe += cuentan * 4
    if (puntos.length > 0 && fuera === puntos.length) delLugar(`tiene el lado de ${lado} del contorno entero afuera de la pantalla`)
    else if (cuentan < puntos.length) {
      if (peor) porLado.push(`${lado}, ${peor.r.toFixed(2)}:1 sobre ${peor.color} (${peor.de})`)
      else if (tapado) porLado.push(`${lado}, tapado por ${tapado}`)
      else if (fuera) porLado.push(`${lado}, en parte afuera de la pantalla`)
    }
  }
  if (seVe < m.largo) {
    delLugar(`tiene el contorno a la vista a 3:1 en ${seVe} px, y hace falta el lado más largo, ${Math.round(m.largo)} px — ${porLado.join('; ')}`)
  }
  return mal
}

/**
 * Recorre la pantalla con Tab de arriba abajo y vuelve con Shift+Tab, y juzga
 * cada elemento que recibe el foco. Se arranca desde un ancla quieta al
 * principio del documento, fuera del orden del Tab: sin eso el primer Tab
 * sale de donde haya quedado el último toque.
 *
 * `duenio` es el paquete que todavía rehace la pantalla: lo del lugar se le
 * anota como deuda, y lo del contorno, que es de toda la app, falla igual.
 * `minimo` es cuántos elementos tiene que encontrar el Tab para creer que vio
 * la pantalla: el Cierre tiene uno solo, "Listo".
 */
async function recorrerConTab(pantalla, { tope = 80, minimo = 2, duenio = null } = {}) {
  await p.evaluate(() => {
    const resuelto = (valor) => {
      const prueba = document.createElement('i')
      prueba.style.color = valor
      document.body.append(prueba)
      const color = getComputedStyle(prueba).color
      prueba.remove()
      return color
    }
    window.__foco = {
      vistos: new Set(),
      orden: [],
      acento: resuelto('var(--color-acento)'),
      sobreAcento: resuelto('var(--color-sobre-acento)'),
    }
    let ancla = document.getElementById('foco-ancla')
    if (!ancla) {
      ancla = document.createElement('span')
      ancla.id = 'foco-ancla'
      ancla.tabIndex = -1
      ancla.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px'
      document.body.prepend(ancla)
    }
    ancla.focus({ preventScroll: true })
  })
  const dichos = new Set()
  const juzgarYAnotar = (m, sentido) => {
    for (const mal of juzgar(m)) {
      const texto = `${pantalla} · ${m.nombre} ${mal.texto}.`
      if (dichos.has(texto)) continue
      dichos.add(texto)
      if (mal.lugar && duenio) deudas.push(`${texto} (con ${sentido}; ${duenio})`)
      else fallos.push(`${texto} (con ${sentido})`)
    }
  }

  const nombres = []
  for (let i = 0; i < tope; i++) {
    await p.keyboard.press('Tab')
    const m = await medirElEnfocado()
    if (!m) continue
    if (m.visto) break
    nombres.push(m.nombre.replace(/^\S+ /, ''))
    juzgarYAnotar(m, 'Tab')
  }
  const distintos = nombres.length
  // De vuelta, desde el último: arriba aparece la franja, y es el sentido en
  // que un elemento puede quedar debajo de ella.
  await p.evaluate(() => {
    window.__foco.vistos = new Set()
    window.__foco.orden.at(-1)?.focus()
  })
  await medirElEnfocado()
  for (let i = 0; i < tope; i++) {
    await p.keyboard.press('Shift+Tab')
    const m = await medirElEnfocado()
    if (!m) continue
    if (m.visto) break
    juzgarYAnotar(m, 'Shift+Tab')
  }
  enfocados += distintos
  medidas.push(`${pantalla} · ${distintos} con Tab: ${nombres.join(', ')}.`)
  if (distintos < minimo) fallos.push(`${pantalla} · el Tab recorrió ${distintos} elementos: el recorrido no vio la pantalla.`)
}

// Hoy con el chequeo prendido: a 360×640 el dock no entra en su lugar y se pega.
await conLaBase(p, ['preferencias'], async (leer, poner) => {
  const [pref] = await leer('preferencias')
  poner('preferencias', { ...pref, estadoActivo: true })
})
await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(900)
{
  const pegado = await p.evaluate(() => document.querySelector('.dock')?.hasAttribute('data-pegado') ?? false)
  if (!pegado) fallos.push('Hoy · con el chequeo prendido a 360×640 el dock no está pegado: el recorrido con Tab no mide lo que tiene que medir.')
  await recorrerConTab('Hoy con el dock pegado')
  const enLaFranja = await p.evaluate(() => document.querySelector('.encabezado-compacto')?.matches(':focus-within') ?? false)
  if (enLaFranja) fallos.push('Hoy · la franja de arriba recibió el foco: es aria-hidden y no un control.')

  // Con Tab hasta la acción del dock pegado, desde arriba: ya está a la
  // vista, y enfocarla no mueve la página ni despega el dock.
  await p.evaluate(() => {
    scrollTo(0, 0)
    document.getElementById('foco-ancla').focus({ preventScroll: true })
  })
  await p.waitForTimeout(300)
  let enElDock = null
  for (let i = 0; i < 20 && !enElDock; i++) {
    const antes = await p.evaluate(() => scrollY)
    await p.keyboard.press('Tab')
    enElDock = await p.evaluate(async (antes) => {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const dock = document.activeElement?.closest('.dock')
      if (!dock) return null
      return { antes, despues: scrollY, pegado: dock.hasAttribute('data-pegado'), nombre: document.activeElement.textContent.trim() }
    }, antes)
  }
  if (!enElDock) fallos.push('Hoy · el Tab desde arriba no llegó al dock.')
  else if (Math.abs(enElDock.despues - enElDock.antes) > 1 || !enElDock.pegado) {
    fallos.push(
      `Hoy · el Tab a «${enElDock.nombre}» en el dock pegado movió la página de ${enElDock.antes} a ${enElDock.despues}${enElDock.pegado ? '' : ' y lo despegó'}: ya estaba a la vista.`,
    )
  }
}

await revisarLaLlegada('Hoy → el chequeo', '¿Cómo venís hoy? · LyraFit', () =>
  p.getByRole('button', { name: /¿Cómo venís hoy\?/ }).click(),
)
await revisarLaLlegada('El chequeo → Hoy, con "Hoy no"', 'Hoy · LyraFit', () =>
  p.getByRole('button', { name: 'Hoy no', exact: true }).click(),
)
await revisarLaLlegada('Hoy → la molestia', '¿Te molesta algo? · LyraFit', () =>
  p.locator('[data-prueba="avisar-molestia"]').click(),
)
await revisarLaLlegada('La molestia → Hoy, con "Volver"', 'Hoy · LyraFit', () =>
  p.getByRole('button', { name: 'Volver', exact: true }).click(),
)
await revisarLaLlegada('Hoy → Entrenar, con "Empezar"', 'Entrenando · LyraFit', () =>
  p.locator('.dock').getByRole('button', { name: 'Empezar', exact: true }).click(),
)
if ((await ruta()) !== '/entrenar') fallos.push(`"Empezar" no llevó a Entrenar (la ruta es ${await ruta()}).`)

// ─── Entrenar y el Cierre ────────────────────────────────────────────────

await recorrerConTab('La serie')

/** El encabezado de cada estado nuevo, adonde Entrenar lleva el foco. */
async function revisarElEncabezado(estado, encabezado) {
  const enfocado = await p.evaluate(() => {
    const a = document.activeElement
    if (!a || a === document.body) return { es: 'body', h1: false }
    return { es: `${a.tagName.toLowerCase()} «${(a.textContent ?? '').trim().slice(0, 30)}»`, h1: a.tagName === 'H1', texto: (a.textContent ?? '').trim() }
  })
  const bien = encabezado === 'h1' ? enfocado.h1 : enfocado.texto === encabezado
  if (!bien) fallos.push(`${estado} · el foco está en ${enfocado.es} y no en ${encabezado === 'h1' ? 'el h1' : `«${encabezado}»`}.`)
}

// La hoja: "Cómo se hace" con el teclado. El nombre va en tipo oración, como
// todo botón (§5.6 y la fila del patrón de §7.4).
{
  const abrirla = p.getByRole('button', { name: 'Cómo se hace', exact: true })
  if (!(await abrirla.isVisible().catch(() => false))) {
    fallos.push('La serie · no está "Cómo se hace": la hoja quedó sin medir.')
  } else {
    await abrirla.focus()
    await p.keyboard.press('Enter')
    await p.waitForTimeout(400)
    const dialogo = p.getByRole('dialog')
    const adentro = () => p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))
    if (!(await dialogo.isVisible().catch(() => false))) {
      fallos.push('La serie · Enter sobre "Cómo se hace" no abrió nada.')
    } else {
      if (!(await adentro())) fallos.push('"Cómo se hace" · al abrirse, el foco no entra en la hoja.')
      let escapo = false
      for (let i = 0; i < 12 && !escapo; i++) {
        await p.keyboard.press('Tab')
        escapo = !(await adentro())
      }
      if (escapo) fallos.push('"Cómo se hace" · el Tab sale de la hoja: no atrapa el foco.')
      await p.keyboard.press('Escape')
      await p.waitForTimeout(400)
      if (await dialogo.isVisible().catch(() => false)) fallos.push('"Cómo se hace" · Escape no la cierra.')
      const devuelto = await abrirla.evaluate((b) => document.activeElement === b).catch(() => false)
      if (!devuelto) fallos.push('"Cómo se hace" · al cerrarse, el foco no vuelve a "Cómo se hace".')
    }
  }
}

const razon = await completarUnaSesion(p, {
  alVerElDescanso: async () => {
    await revisarElEncabezado('El descanso', 'DESCANSO')
    await recorrerConTab('El descanso')
  },
  alVerElFinal: async (cual) => {
    if (cual === 'la serie de cierre') {
      await revisarElEncabezado('La serie de cierre', 'h1')
      await recorrerConTab('La serie de cierre')
    } else {
      await revisarElEncabezado('Las preguntas', 'ANTES DE CERRAR')
      await recorrerConTab('Las preguntas')
    }
  },
})
if (razon) fallos.push(`La sesión no se pudo recorrer: ${razon}.`)
else {
  const titulo = await p.evaluate(() => document.title)
  if (titulo !== 'Sesión · LyraFit') fallos.push(`El Cierre · el título del documento es «${titulo}» y no «Sesión · LyraFit».`)
  await recorrerConTab('El Cierre', { minimo: 1, duenio: 'P3' })
}

// ─── 3. El Diario: "Cambiar" ─────────────────────────────────────────────

// La hora de acostarse contestada ayer, y café a las 20 hoy: el diario
// muestra la fila de otro día con "Cambiar".
await conLaBase(p, ['diario'], async (leer, poner) => {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - 1)
  const dd = (n) => String(n).padStart(2, '0')
  poner('diario', {
    fecha: `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`,
    horaDeDormir: 23 * 60,
    horaDeDormirContestada: true,
    actualizadoEn: Date.now(),
  })
})
await p.goto(`${BASE}/#/diario`, { waitUntil: 'networkidle' })
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(700)
await p.getByRole('group', { name: 'Hora de la última cafeína' }).getByRole('button', { name: '20', exact: true }).click()
const cambiar = p.getByRole('button', { name: 'Cambiar la hora de acostarte' })
if (!(await cambiar.waitFor({ state: 'visible', timeout: 3000 }).then(() => true, () => false))) {
  fallos.push('El Diario · con la hora de ayer y café a las 20 no aparece "Cambiar": el foco de después quedó sin medir.')
} else {
  await p.evaluate(() => (window.__foco = { vistos: new Set(), orden: [], acento: '', sobreAcento: '' }))
  await cambiar.focus()
  await p.keyboard.press('Enter')
  await p.waitForTimeout(300)
  const enfocado = await p.evaluate(() => document.activeElement?.getAttribute('data-prueba') ?? document.activeElement?.tagName)
  if (enfocado !== 'dormir-23') fallos.push(`El Diario · después de "Cambiar", el foco quedó en ${enfocado} y no en la hora marcada (dormir-23).`)
  else {
    await p.evaluate(() => {
      const resuelto = (valor) => {
        const prueba = document.createElement('i')
        prueba.style.color = valor
        document.body.append(prueba)
        const color = getComputedStyle(prueba).color
        prueba.remove()
        return color
      }
      window.__foco.acento = resuelto('var(--color-acento)')
      window.__foco.sobreAcento = resuelto('var(--color-sobre-acento)')
    })
    const m = await medirElEnfocado()
    enfocados++
    for (const mal of m ? juzgar(m) : [{ texto: 'no se pudo medir' }]) {
      fallos.push(`El Diario · la hora marcada, después de "Cambiar", ${mal.texto}.`)
    }
  }
}

fallos.push(...errores)
await navegador.close()

for (const linea of medidas) console.log(linea)

if (deudas.length > 0) {
  console.log('\nDeuda de foco que no hace fallar todavía (la del Cierre la resuelve P3):\n' + deudas.map((d) => `· ${d}`).join('\n'))
}

if (fallos.length > 0) {
  console.error('\n' + fallos.map((f) => `· ${f}`).join('\n'))
  process.exit(1)
}

console.log(
  `\nEl foco llega al título de cada pantalla sin contorno; en Hoy con el dock pegado nada lo tapa y se ve, y en Entrenar, el Cierre y el Diario el contorno es el de la app (${enfocados} elementos enfocados).`,
)
