/**
 * EL PORTÓN DE LOS PASAJES.
 *
 * Un pasaje entre pantallas es lo primero que se nota cuando anda mal y lo
 * último que se mira cuando anda bien. En una computadora rápida todos se
 * ven perfectos; en el Android de gama baja que usa la mitad de la gente,
 * el mismo pasaje tartamudea, dura el doble o deja la pantalla nueva
 * temblando cuando ya terminó. Por eso esto corre con la CPU frenada cuatro
 * veces: es lo más parecido a ese teléfono que se puede tener acá.
 *
 * Recorre lo que recorre una persona —los pasos del alta, las cinco
 * pestañas, Cadenas a una ficha y de vuelta, Hoy al chequeo y de vuelta, Hoy
 * a la molestia y de vuelta— y en cada pasaje exige:
 *
 *   - que haya un pasaje, con la dirección que corresponde (un portón que
 *     no encuentra el pasaje no está en verde: está ciego);
 *   - ningún cuadro largo (`long-animation-frame`) mientras se mueve;
 *   - que `finished` llegue a la duración más 150 ms o antes, contada desde
 *     que arranca el movimiento;
 *   - como mucho dos nombres compartidos, más `root` y `marco`;
 *   - cero avisos de `view-transition-name` repetido en la consola;
 *   - que en `finished` no quede ninguna animación de `::view-transition-*`;
 *   - y que 400 ms después no se mueva nada, salvo Lyra respirando si está
 *     viva en el destino.
 *
 * Y además que el atrás del sistema sea un corte, que volver a una sección
 * deje el scroll donde estaba, y que tocar la pestaña activa suba.
 *
 * ## Desde cuándo se cuenta, y por qué no desde el toque
 *
 * Un pasaje tiene dos tramos. En el primero el navegador saca la foto de lo
 * viejo, la app dibuja lo nuevo y el navegador le saca la foto: mientras
 * tanto NO PINTA —la pantalla queda en la foto vieja, quieta—, así que todo
 * ese tramo es, por construcción, un único cuadro. En el segundo tramo, de
 * `ready` a `finished`, se mueve. Un cuadro largo en el segundo tramo es un
 * tirón que se ve; en el primero es espera, no tirón.
 *
 * La especificación (§9) pedía además que, con la CPU ×4, `finished` llegara
 * a 280 + 150 ms del toque. Medido acá no se puede: solo las dos fotos que
 * saca el navegador —sin una línea de la app— cuestan entre 115 y 165 ms con
 * la CPU frenada, y el primer tramo entero va de 130 a 290. Así que la
 * espera desde el toque no se afirma: se mide y se informa al final, para
 * que se vea si empeora, y queda anotada para medirla en el teléfono real.
 */

import { BASE, abrir, alta, revisarQueSirvaLoCompilado } from './lib/portones.mjs'

const fallos = []
const dichos = new Set()
const anotar = (linea) => {
  if (dichos.has(linea)) return
  dichos.add(linea)
  fallos.push(linea)
}

/** Lo que dura cada dirección en el CSS (§6.4): todas 280, la puerta 260. */
const DURACION = { puerta: 260 }
const duracionDe = (direccion) => DURACION[direccion] ?? 280
const HOLGURA = 150
/** Medio cuadro a 60 Hz. */
const MEDIO_CUADRO = 8
/** Lo que el cuadro congelado sigue pintando después de `ready` (ver `revisarDesde`). */
const COLA_DEL_CONGELADO = 25

/**
 * Los ganchos, antes de que corra la app: los cuadros largos, y cada pasaje
 * con su comienzo, su dirección, sus nombres, su `finished` y lo que quedaba
 * animándose en ese momento.
 *
 * Los nombres se leen de las animaciones del pasaje en `ready`, cuando ya
 * existen los pseudoelementos: así salen también los de la foto vieja, que
 * para entonces ya no están en el DOM. `marco` no aparece ahí porque va con
 * `animation: none`, y está permitido igual.
 */
function instalar() {
  window.__loaf = []
  try {
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries()) {
        window.__loaf.push({
          inicio: e.startTime,
          duracion: e.duration,
          // Quién lo ocupó, para que el aviso diga dónde mirar.
          scripts: (e.scripts ?? [])
            .filter((x) => x.duration >= 5)
            .map((x) => `${x.invoker || x.invokerType} ${Math.round(x.duration)} ms`),
          estilo: e.styleAndLayoutStart ? Math.round(e.startTime + e.duration - e.styleAndLayoutStart) : null,
          bloqueo: e.blockingDuration ?? null,
        })
      }
    }).observe({ type: 'long-animation-frame', buffered: true })
  } catch {
    window.__sinLoaf = true
  }
  window.__pasajes = []
  const original = Document.prototype.startViewTransition
  if (!original) return
  Document.prototype.startViewTransition = function (...args) {
    const registro = {
      inicio: performance.now(),
      direccion: document.documentElement.dataset.vt ?? null,
      listo: null,
      fin: null,
      nombres: null,
      quedan: null,
      salteado: false,
    }
    window.__pasajes.push(registro)
    const t = original.apply(this, args)
    t.ready.then(
      () => {
        registro.listo = performance.now()
        const nombres = new Set()
        for (const a of document.getAnimations()) {
          const m = /^::view-transition-(?:group|image-pair|old|new)\((.+)\)$/.exec(a.effect?.pseudoElement ?? '')
          if (m) nombres.add(m[1])
        }
        registro.nombres = [...nombres]
      },
      () => (registro.salteado = true),
    )
    t.finished.then(
      () => {
        registro.fin = performance.now()
        registro.quedan = document
          .getAnimations()
          .map((a) => a.effect?.pseudoElement ?? '')
          .filter((p) => p.startsWith('::view-transition'))
      },
      () => (registro.fin = performance.now()),
    )
    return t
  }
}

let pagina
const duplicados = []
let cuantosVistos = 0
/** Lo que tarda cada pasaje en empezar a moverse, desde el toque. */
const esperas = []

/**
 * Mide el pasaje que dispara `accion`.
 *
 * Espera su `finished` sin esperas fijas y después exactamente 400 ms más,
 * medidos adentro de la página desde el `finished` y no desde acá: la ida y
 * vuelta del protocolo con la CPU frenada no tiene que regalarle tiempo a
 * una animación que se pasó.
 */
async function medir(nombre, direccion, accion) {
  const desde = await pagina.evaluate(() => window.__pasajes.length)
  await accion()
  return revisarDesde(nombre, direccion, desde)
}

/**
 * Espera a que `condicion` se cumpla en la página con una evaluación suelta
 * cada 100 ms, y nada más.
 *
 * Mientras dura un pasaje el portón no puede hacer trabajo en la página: lo
 * que Playwright evalúa por DevTools no figura como script en los cuadros
 * largos, y un cuadro largo hecho por el portón se lee igual que uno de la
 * app. `waitForFunction` sondea desde adentro (con `raf`, un cuadro pedido
 * por vuelta; con intervalo, igual instala su guion la primera vez) y un
 * localizador por rol calcula nombres accesibles: los dos se vieron, medidos,
 * como cuadros de 50 a 80 ms en el arranque del movimiento.
 */
async function esperarSinMolestar(condicion, arg, tope = 6000) {
  const hasta = Date.now() + tope
  while (Date.now() < hasta) {
    if (await pagina.evaluate(condicion, arg).catch(() => false)) return true
    await pagina.waitForTimeout(100)
  }
  return false
}

async function revisarDesde(nombre, direccion, desde) {
  await esperarSinMolestar(
    (n) => window.__pasajes.length > n && window.__pasajes.slice(n).every((r) => r.fin !== null),
    desde,
  )
  const r = await pagina.evaluate(async (n) => {
    const nuevos = window.__pasajes.slice(n)
    const ultimo = nuevos[nuevos.length - 1]
    if (!ultimo || ultimo.fin === null) return { nuevos, despues: [], quedaRastro: null }
    const falta = ultimo.fin + 400 - performance.now()
    if (falta > 0) await new Promise((r) => setTimeout(r, falta))
    const despues = document.getAnimations().map((a) => {
      const el = a.effect?.target
      const clase = el && typeof el.className === 'string' ? el.className.split(' ')[0] : ''
      return {
        nombre: a.animationName ?? a.transitionProperty ?? '(sin nombre)',
        tipo: a.constructor.name,
        estado: a.playState,
        objetivo: el?.tagName ? `${el.tagName.toLowerCase()}${clase ? '.' + clase : ''}` : '(?)',
      }
    })
    return {
      nuevos,
      despues,
      lyraViva: document.querySelector('.lyra--viva') !== null,
      quedaRastro:
        document.documentElement.hasAttribute('data-vt') || document.querySelector('[data-inerte-del-pasaje]') !== null,
      loaf: window.__loaf,
    }
  }, desde)

  if (r.nuevos.length === 0) {
    fallos.push(`[${nombre}] no hubo pasaje. Este tramo no está en verde: está ciego.`)
    return null
  }
  cuantosVistos += r.nuevos.length
  if (r.nuevos.length > 1) {
    anotar(`[${nombre}] un toque arrancó ${r.nuevos.length} pasajes. Es uno.`)
  }
  const p = r.nuevos[r.nuevos.length - 1]
  if (p.direccion !== direccion) {
    anotar(`[${nombre}] el pasaje fue "${p.direccion}" y tenía que ser "${direccion}".`)
  }
  if (p.salteado) anotar(`[${nombre}] el pasaje se salteó solo: algo lo canceló antes de empezar.`)
  if (p.fin === null) {
    fallos.push(`[${nombre}] el pasaje no terminó nunca.`)
    return p
  }
  if (p.listo === null) {
    fallos.push(`[${nombre}] el pasaje terminó sin arrancar nunca (ready no llegó).`)
    return p
  }
  esperas.push({ nombre, ms: p.listo - p.inicio })
  const moviendose = p.fin - p.listo
  const tope = duracionDe(direccion) + HOLGURA
  if (moviendose > tope) {
    anotar(
      `[${nombre}] desde que arrancó, finished tardó ${Math.round(moviendose)} ms. Tope: ${duracionDe(direccion)} + ${HOLGURA} = ${tope}.`,
    )
  }
  // Los cuadros que caen mientras se mueve: los que empiezan después de
  // `ready`, y los que empezaron antes pero se comen el arranque. El cuadro
  // congelado de antes termina pintando la primera foto del movimiento, y
  // eso le lleva hasta 11 ms después de `ready` con la CPU ×4 (medido en 96
  // pasajes, con el portón callado); los 25 de tope son un cuadro y medio de
  // margen para una máquina más lenta. Si termina más tarde, algo se colgó
  // de `ready` y el movimiento arrancó trabado. El que empieza en el último
  // medio cuadro es el de la limpieza de `finished`: la última foto ya salió
  // y nadie lo ve moverse.
  //
  // Todo cuadro largo ahí falla, tenga o no scripts a la vista. Uno "vacío"
  // —sin bloqueo, sin scripts, sin estilo— parecía el hilo esperando al
  // compositor y era el portón: lo que Playwright evalúa en la página por
  // DevTools no figura como script. Por eso ni el alta de `lib/portones.mjs`
  // (`trasElPasaje`) ni este portón (`esperarSinMolestar`) le preguntan nada
  // a la página mientras se mueve, salvo una evaluación suelta cada 100 ms.
  const largos = (r.loaf ?? []).filter(
    (f) => f.inicio < p.fin - MEDIO_CUADRO && f.inicio + f.duracion > p.listo + COLA_DEL_CONGELADO,
  )
  for (const f of largos) {
    anotar(
      `[${nombre}] hubo un cuadro largo de ${Math.round(f.duracion)} ms, de ${Math.round(f.inicio - p.listo)} a ${Math.round(f.inicio + f.duracion - p.listo)} ms del arranque del movimiento (${f.scripts.length ? f.scripts.join(', ') : 'sin scripts largos'}; estilo y layout ${f.estilo ?? '?'} ms). Mientras se mueve no puede haber ninguno.`,
    )
  }
  const propios = (p.nombres ?? []).filter((n) => n !== 'root' && n !== 'marco')
  if (propios.length > 2) {
    anotar(`[${nombre}] viajaron ${propios.length} nombres (${propios.join(', ')}). Como mucho 2, más root y marco.`)
  }
  if ((p.quedan ?? []).length > 0) {
    anotar(`[${nombre}] en finished todavía quedaban ${p.quedan.join(', ')}.`)
  }
  const sobran = r.despues.filter((a) => !(a.nombre === 'latir' && r.lyraViva))
  for (const a of sobran) {
    anotar(
      `[${nombre}] 400 ms después del pasaje sigue "${a.nombre}" (${a.tipo}, ${a.estado}) sobre ${a.objetivo}. Para entonces no se mueve nada, salvo Lyra respirando.`,
    )
  }
  if (r.quedaRastro) {
    anotar(`[${nombre}] terminado el pasaje, quedó data-vt en <html> o el contenido sigue inerte.`)
  }
  return p
}

const ruta = () => pagina.evaluate(() => location.hash.slice(1) || '/')

async function main() {
  await revisarQueSirvaLoCompilado(BASE)
  const abierto = await abrir({ fallos })
  pagina = abierto.pagina
  await abierto.contexto.addInitScript(instalar)
  pagina.on('console', (m) => {
    if (/view-transition-name/i.test(m.text())) duplicados.push(m.text())
  })

  // La CPU frenada cuatro veces, desde antes del alta.
  const cdp = await abierto.contexto.newCDPSession(pagina)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })

  // ── Los pasos del alta ─────────────────────────────────────────────────
  //
  // Cada paso se revisa cuando la pantalla nueva ya está dibujada, antes de
  // tocar nada en ella. En la segunda prueba se vuelve una atrás y se sigue,
  // para medir también el paso hacia atrás.
  let pasosDelAlta = 0
  let marca = 0
  await alta(pagina, {
    enCadaPaso: async (paso) => {
      if (paso === 'inicio') {
        marca = await pagina.evaluate(() => window.__pasajes.length)
        return
      }
      if (paso === 'prueba-elegida') return
      if (await revisarDesde(`Alta, ${paso}`, 'paso-adelante', marca)) pasosDelAlta++
      if (paso === 'prueba-2') {
        await medir('Alta, volver a la prueba 1', 'paso-atras', () =>
          pagina.getByRole('button', { name: 'Volver', exact: true }).click(),
        )
        await medir('Alta, otra vez a la prueba 2', 'paso-adelante', () =>
          pagina.getByRole('button', { name: 'Siguiente', exact: true }).click(),
        )
        await pagina.getByRole('button', { name: 'Sumar' }).waitFor({ state: 'visible' })
      }
      marca = await pagina.evaluate(() => window.__pasajes.length)
    },
  })
  if (pasosDelAlta < 7) {
    fallos.push(`El alta tiene que pasar por 7 pasos con pasaje y se midieron ${pasosDelAlta}.`)
  }
  if ((await ruta()) !== '/') fallos.push(`Después del alta no se llegó a Hoy (la ruta es ${await ruta()}).`)
  await pagina.waitForTimeout(600)

  const pestaña = (nombre) => pagina.locator(`[data-prueba="nav-${nombre}"]`)

  // ── Las cinco pestañas ─────────────────────────────────────────────────
  for (const [nombre, direccion] of [
    ['cadenas', 'lateral-der'],
    ['diario', 'lateral-der'],
    ['progreso', 'lateral-der'],
    ['ajustes', 'lateral-der'],
    ['hoy', 'lateral-izq'],
  ]) {
    await medir(`La barra, a ${nombre}`, direccion, () => pestaña(nombre).click())
  }

  // ── Cadenas → Ficha → Cadenas, con el scroll guardado ──────────────────
  //
  // La ficha todavía no tiene "Volver" (llega con su paquete): la vuelta va
  // por la pestaña de Cadenas, que es la misma superficie.
  await medir('Hoy a Cadenas', 'lateral-der', () => pestaña('cadenas').click())
  const enlaces = pagina.locator('main a[href*="/biblioteca/"]')
  const cuantos = await enlaces.count()
  if (cuantos === 0) {
    fallos.push('En Cadenas no hay ningún enlace a una ficha: Cadenas → Ficha quedó sin medir.')
  } else {
    // Uno de la mitad de la lista, para que el scroll de antes no sea cero.
    const enlace = enlaces.nth(Math.floor(cuantos / 2))
    await enlace.scrollIntoViewIfNeeded()
    await pagina.waitForTimeout(300)
    const yAntes = await pagina.evaluate(() => window.scrollY)
    await medir('Cadenas a una ficha', 'profundo', () => enlace.click())
    const yFicha = await pagina.evaluate(() => window.scrollY)
    if (yFicha !== 0) anotar(`La ficha abrió con el scroll en ${yFicha}: una subpantalla empieza arriba.`)
    await medir('La ficha a Cadenas', 'superficie', () => pestaña('cadenas').click())
    const yDespues = await pagina.evaluate(() => window.scrollY)
    if (yAntes < 50) {
      fallos.push(`El scroll de Cadenas antes de abrir la ficha era ${yAntes}: la memoria del scroll quedó sin medir.`)
    } else if (Math.abs(yDespues - yAntes) > 2) {
      anotar(`Al volver a Cadenas el scroll quedó en ${yDespues} y estaba en ${yAntes}. Volver es volver adonde estabas.`)
    }
  }

  // ── Hoy → Estado → Hoy no, y el atrás del sistema ──────────────────────
  await medir('Cadenas a Ajustes', 'lateral-der', () => pestaña('ajustes').click())
  const chequeo = pagina.getByRole('button', { name: /Chequeo diario/ })
  if ((await chequeo.getAttribute('aria-pressed')) !== 'true') await chequeo.click()
  await pagina.waitForTimeout(300)
  await medir('Ajustes a Hoy', 'lateral-izq', () => pestaña('hoy').click())
  const alEstado = pagina.getByRole('button', { name: /¿Cómo venís hoy\?/ })
  if (!(await alEstado.isVisible().catch(() => false))) {
    fallos.push('En Hoy no apareció "¿Cómo venís hoy?" con el chequeo prendido: Hoy → Estado quedó sin medir.')
  } else {
    await medir('Hoy al chequeo', 'profundo', () => alEstado.click())
    if ((await ruta()) !== '/estado') fallos.push(`"¿Cómo venís hoy?" no llevó al chequeo (la ruta es ${await ruta()}).`)
    await medir('El chequeo a Hoy, con "Hoy no"', 'superficie', () =>
      pagina.getByRole('button', { name: 'Hoy no', exact: true }).click(),
    )
    if ((await ruta()) !== '/') fallos.push(`"Hoy no" no volvió a Hoy (la ruta es ${await ruta()}).`)

    // El atrás del sistema: un corte, sin pasaje.
    await medir('Hoy al chequeo, otra vez', 'profundo', () => alEstado.click())
    const antesDelAtras = await pagina.evaluate(() => window.__pasajes.length)
    await pagina.goBack()
    await pagina.waitForFunction(() => (location.hash.slice(1) || '/') === '/', null, { timeout: 3000 }).catch(() => {})
    await pagina.waitForTimeout(400)
    const conAtras = (await pagina.evaluate(() => window.__pasajes.length)) - antesDelAtras
    if ((await ruta()) !== '/') fallos.push(`El atrás del sistema desde el chequeo no volvió a Hoy (la ruta es ${await ruta()}).`)
    if (conAtras !== 0) anotar(`El atrás del sistema arrancó ${conAtras} pasaje(s). El atrás es un corte.`)
  }

  // ── Hoy → Molestia → Volver ────────────────────────────────────────────
  const aMolestia = pagina.locator('[data-prueba="avisar-molestia"]')
  if (!(await aMolestia.isVisible().catch(() => false))) {
    fallos.push('En Hoy no está "avisar una molestia": Hoy → Molestia quedó sin medir.')
  } else {
    await medir('Hoy a la molestia', 'profundo', () => aMolestia.click())
    await medir('La molestia a Hoy, con "Volver"', 'superficie', () =>
      pagina.getByRole('button', { name: 'Volver', exact: true }).click(),
    )
  }

  // ── La pestaña activa sube, sin pasaje ─────────────────────────────────
  await pagina.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
  await pagina.waitForTimeout(200)
  const abajo = await pagina.evaluate(() => window.scrollY)
  const antesDeSubir = await pagina.evaluate(() => window.__pasajes.length)
  await pestaña('hoy').click()
  const subio = await pagina
    .waitForFunction(() => window.scrollY === 0, null, { timeout: 3000 })
    .then(() => true)
    .catch(() => false)
  if (abajo < 50) fallos.push(`Hoy no tiene scroll (${abajo}): "tocar la pestaña activa sube" quedó sin medir.`)
  else if (!subio) anotar('Tocar la pestaña activa no subió al principio.')
  if ((await pagina.evaluate(() => window.__pasajes.length)) !== antesDeSubir) {
    anotar('Tocar la pestaña activa arrancó un pasaje: sube y nada más.')
  }

  if (await pagina.evaluate(() => window.__sinLoaf === true)) {
    fallos.push('Este Chromium no informa long-animation-frame: los cuadros largos quedaron sin medir.')
  }
  if (duplicados.length > 0) {
    fallos.push(
      `Hubo ${duplicados.length} aviso(s) de view-transition-name en la consola (el primero: ${duplicados[0]}). Dos elementos con el mismo nombre cancelan el pasaje entero.`,
    )
  }
  await abierto.navegador.close()

  if (fallos.length > 0) {
    console.log('PROBLEMAS EN LOS PASAJES:')
    for (const f of fallos) console.log(' -', f)
    process.exit(1)
  }
  console.log(
    `Pasajes verificados con la CPU frenada ×4: ${cuantosVistos} pasajes (alta, barra, ficha, chequeo y molestia), todos a tiempo, sin cuadros largos mientras se mueven, sin nombres de más y quietos 400 ms después. El atrás es un corte, el scroll vuelve adonde estaba y la pestaña activa sube.`,
  )
  // La espera desde el toque, informada y no afirmada (ver arriba).
  const ordenadas = [...esperas].sort((a, b) => a.ms - b.ms)
  const mediana = ordenadas[Math.floor(ordenadas.length / 2)]
  const peor = ordenadas[ordenadas.length - 1]
  console.log(
    `Del toque a que arranca el movimiento, con la CPU ×4: mediana ${Math.round(mediana.ms)} ms, la peor ${Math.round(peor.ms)} ms (${peor.nombre}). La §9 pedía 150: queda para medir en el teléfono real.`,
  )
}

main().catch((e) => {
  // Un toque que no llega —un contenido que quedó inerte, por ejemplo— corta
  // el recorrido con un timeout de Playwright que no dice por qué. Lo que ya
  // se había encontrado antes suele ser el porqué: va primero.
  if (fallos.length > 0) {
    console.log('PROBLEMAS EN LOS PASAJES (antes de que el recorrido se cortara):')
    for (const f of fallos) console.log(' -', f)
  }
  console.error(e)
  process.exit(1)
})
