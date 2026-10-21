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
 *   - que la callback de la app —dibujar la pantalla nueva y esperar su
 *     contenido— tarde 300 ms o menos (§9);
 *   - ningún cuadro largo (`long-animation-frame`) mientras se mueve;
 *   - que `finished` llegue a la duración más 150 ms o antes, contada desde
 *     que arranca el movimiento;
 *   - que mientras se mueve, el contenido nuevo esté inerte (§6.4.7);
 *   - como mucho dos nombres compartidos, más `root` y `marco`;
 *   - que la marca de la barra (`lf-nav-marca`) viaje en cada cambio de
 *     sección y en ningún otro pasaje: entrar a una ficha o al chequeo no
 *     cambia de sección, y nombrarla ahí gasta uno de los dos lugares;
 *   - cero avisos de `view-transition-name` repetido en la consola;
 *   - que en `finished` no quede ninguna animación de `::view-transition-*`;
 *   - y que 400 ms después no se mueva nada, salvo Lyra respirando si está
 *     viva en el destino.
 *
 * Y además que el atrás del sistema sea un corte que devuelve el scroll, que
 * volver a una sección deje el scroll donde estaba, que tocar la pestaña
 * activa suba, que un segundo toque en medio de un pasaje llegue (§6.4.8) y
 * que el foco no se pierda por el inerte.
 *
 * ## Lo que pide la §9 y lo que se puede afirmar acá
 *
 * La §9 pide, con la CPU ×4, ningún cuadro largo durante un pasaje y
 * `finished` a la duración más 150 ms o menos. Las dos cosas, contadas desde
 * el toque, no se alcanzan en este Chromium aunque la app no haga nada:
 * medido, un `startViewTransition` vacío —sin cambiar una sola cosa— tarda
 * de 118 a 206 ms en llegar a `ready` y deja dos cuadros largos de 58 a 122
 * ms, que son las dos fotos del navegador. No es una holgura que la app
 * pueda cuidar, así que no se la redefine acá: quedó anotado para que lo
 * decidan el rol 14 y Matias, y para medirlo en el teléfono real, donde las
 * fotos las saca la GPU.
 *
 * Lo que sí es de la app se afirma:
 *
 *   - la callback, de punta a punta, con el número que la §9 le da a la
 *     callback de una transición: 300 ms. Ahí adentro la pantalla está
 *     congelada en la foto vieja: el navegador no pinta, así que todo lo que
 *     corre en ese tramo, por más tareas que sean, se lee como UN cuadro
 *     largo. Por eso ese cuadro no se puede prohibir sin prohibir dibujar,
 *     pero sí acotar, y se acota por la duración de la callback;
 *   - el movimiento, de `ready` a `finished`: 280 + 150, y sin un solo cuadro
 *     largo. Ahí un cuadro largo es un tirón que se ve.
 *
 * Y se informa, sin afirmarlo, cuánto le falta a cada pasaje para la holgura
 * de 150 que la §9 pide en total: la callback más lo que el movimiento se
 * pasa de 280. Es la deuda con la §9, a la vista en cada corrida.
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
/** "La callback de una transición, 300 ms o menos" (§9). */
const TOPE_DE_LA_CALLBACK = 300
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
 *
 * La callback de la app se envuelve para saber cuándo empieza y cuándo
 * termina. Y en `ready` se cuentan los controles de la pantalla nueva que no
 * están inertes: fuera de la barra, que es el marco, tienen que ser cero.
 * Los toques se anotan con su hora, para saber si uno cayó en medio de un
 * pasaje.
 */
function instalar() {
  window.__toques = []
  document.addEventListener('pointerdown', () => window.__toques.push(performance.now()), true)
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
      cbIni: null,
      cbFin: null,
      vivos: null,
    }
    window.__pasajes.push(registro)
    const callback = typeof args[0] === 'function' ? args[0] : args[0]?.update
    if (callback) {
      const envuelta = async () => {
        registro.cbIni = performance.now()
        try {
          return await callback()
        } finally {
          registro.cbFin = performance.now()
        }
      }
      args[0] = typeof args[0] === 'function' ? envuelta : { ...args[0], update: envuelta }
    }
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
        registro.vivos = [...document.querySelectorAll('#root :is(a[href], button, input, select, textarea)')]
          .filter((el) => !el.closest('nav') && !el.closest('[inert]'))
          .slice(0, 3)
          .map((el) => (el.textContent ?? '').trim().slice(0, 30) || el.tagName.toLowerCase())
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

/**
 * La marca de la barra viaja si el pasaje cambia de sección, y si no, no.
 *
 * Se lee de los nombres del pasaje en `ready`: el grupo de la marca va
 * quieto (lo que se corre es su foto nueva, ver `estilos.css`), y su foto
 * nueva siempre tiene animación, así que si viajó, está.
 */
function revisarLaMarca(nombre, p, cambiaDeSeccion) {
  if (!p?.nombres) return
  const viajo = p.nombres.includes('lf-nav-marca')
  if (cambiaDeSeccion && !viajo) {
    anotar(`[${nombre}] cambió de sección y la marca de la barra no viajó (sin \`lf-nav-marca\` en el pasaje).`)
  } else if (!cambiaDeSeccion && viajo) {
    anotar(`[${nombre}] no cambió de sección y la marca de la barra viajó igual: gasta uno de los dos nombres del pasaje.`)
  }
}

let cuantosVistos = 0
/** Lo que tarda cada pasaje en empezar a moverse, desde el toque. */
const esperas = []
/** La callback de cada pasaje, y lo que le falta para la holgura de la §9. */
const callbacks = []

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
  if (p.cbIni === null || p.cbFin === null) {
    fallos.push(`[${nombre}] no se pudo medir la callback del pasaje: el gancho no la vio empezar o terminar.`)
  } else {
    const callback = p.cbFin - p.cbIni
    if (callback > TOPE_DE_LA_CALLBACK) {
      anotar(
        `[${nombre}] la callback de la app tardó ${Math.round(callback)} ms con la pantalla congelada. Tope: ${TOPE_DE_LA_CALLBACK} (§9).`,
      )
    }
    callbacks.push({ nombre, ms: callback, deuda: callback + Math.max(0, moviendose - duracionDe(direccion)) - HOLGURA })
  }
  if (p.vivos === null) {
    fallos.push(`[${nombre}] no se pudo mirar en ready si el contenido nuevo estaba inerte.`)
  } else if (p.vivos.length > 0) {
    anotar(
      `[${nombre}] mientras se movía, el contenido nuevo no estaba inerte (${p.vivos.map((v) => `«${v}»`).join(', ')}). Lo nuevo no se toca hasta que llega.`,
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
        // Con el teclado: "Siguiente" queda en la pantalla nueva, y el inerte
        // del pasaje no se puede quedar con su foco.
        const siguiente = pagina.getByRole('button', { name: 'Siguiente', exact: true })
        await siguiente.focus()
        await pagina.evaluate(() => (window.__enfocado = document.activeElement))
        await medir('Alta, otra vez a la prueba 2, con el teclado', 'paso-adelante', () => pagina.keyboard.press('Enter'))
        const foco = await pagina.evaluate(() => ({
          sigue: window.__enfocado?.isConnected === true,
          tiene: document.activeElement === window.__enfocado,
          donde: document.activeElement?.tagName ?? '(nadie)',
        }))
        if (!foco.sigue) {
          fallos.push('"Siguiente" no quedó en la pantalla nueva del alta: el foco después del pasaje quedó sin medir.')
        } else if (!foco.tiene) {
          anotar(`Después del pasaje de paso, el foco quedó en ${foco.donde} y no en "Siguiente", que lo tenía. El inerte no se queda con el foco.`)
        }
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
    const p = await medir(`La barra, a ${nombre}`, direccion, () => pestaña(nombre).click())
    revisarLaMarca(`La barra, a ${nombre}`, p, true)
  }

  // ── Un segundo toque en medio del pasaje ───────────────────────────────
  //
  // Mientras corre una View Transition, Chromium le manda todo toque a
  // <html>: sin rescate, el segundo toque no le llega a nadie. Con la CPU
  // frenada, 150 ms después del primero el pasaje está en plena foto.
  {
    const desde = await pagina.evaluate(() => window.__pasajes.length)
    const centro = async (nombre) => {
      const c = await pestaña(nombre).boundingBox()
      return { x: c.x + c.width / 2, y: c.y + c.height / 2 }
    }
    const aCadenas = await centro('cadenas')
    const aDiario = await centro('diario')
    const toquesAntes = await pagina.evaluate(() => window.__toques.length)
    await pagina.mouse.click(aCadenas.x, aCadenas.y)
    await pagina.waitForTimeout(150)
    await pagina.mouse.click(aDiario.x, aDiario.y)
    await esperarSinMolestar(
      (n) => window.__pasajes.length > n && window.__pasajes.slice(n).every((r) => r.fin !== null) && !document.documentElement.hasAttribute('data-vt'),
      desde,
    )
    await pagina.waitForTimeout(400)
    // Cayó en medio si llegó antes de que el primer pasaje terminara solo.
    const enMedio = await pagina.evaluate(
      ([n, t]) => {
        const primero = window.__pasajes[n]
        const segundo = window.__toques[t + 1]
        return primero !== undefined && segundo !== undefined && primero.fin !== null && segundo < primero.fin
      },
      [desde, toquesAntes],
    )
    if (!enMedio) {
      fallos.push('El segundo toque no cayó en medio del pasaje: "otro toque durante el pasaje" quedó sin medir.')
    } else if ((await ruta()) !== '/diario') {
      anotar(`Tocar Cadenas y, 150 ms después, el Diario terminó en ${await ruta()}. El segundo toque corta el pasaje y arranca el suyo (§6.4.8).`)
    }
    await medir('Del Diario a Hoy', 'lateral-izq', () => pestaña('hoy').click())
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
    revisarLaMarca('Cadenas a una ficha', await medir('Cadenas a una ficha', 'profundo', () => enlace.click()), false)
    const yFicha = await pagina.evaluate(() => window.scrollY)
    if (yFicha !== 0) anotar(`La ficha abrió con el scroll en ${yFicha}: una subpantalla empieza arriba.`)
    revisarLaMarca('La ficha a Cadenas', await medir('La ficha a Cadenas', 'superficie', () => pestaña('cadenas').click()), false)
    const yDespues = await pagina.evaluate(() => window.scrollY)
    if (yAntes < 50) {
      fallos.push(`El scroll de Cadenas antes de abrir la ficha era ${yAntes}: la memoria del scroll quedó sin medir.`)
    } else if (Math.abs(yDespues - yAntes) > 2) {
      anotar(`Al volver a Cadenas el scroll quedó en ${yDespues} y estaba en ${yAntes}. Volver es volver adonde estabas.`)
    }

    // Y con el atrás del sistema, que en Android es el camino de vuelta más
    // usado: un corte, pero al mismo lugar. Cadenas tarda en leer la base, y
    // el navegador restaura su scroll antes de que haya contenido.
    await medir('Cadenas a la ficha, otra vez', 'profundo', () => enlace.click())
    const antesDelAtras = await pagina.evaluate(() => window.__pasajes.length)
    await pagina.goBack()
    await pagina.waitForFunction(() => location.hash === '#/biblioteca', null, { timeout: 3000 }).catch(() => {})
    await esperarSinMolestar((y) => Math.abs(window.scrollY - y) <= 2, yAntes, 1500)
    await pagina.waitForTimeout(200)
    const yAtras = await pagina.evaluate(() => window.scrollY)
    if ((await ruta()) !== '/biblioteca') {
      fallos.push(`El atrás del sistema desde la ficha no volvió a Cadenas (la ruta es ${await ruta()}).`)
    } else if (yAntes >= 50 && Math.abs(yAtras - yAntes) > 2) {
      anotar(`Con el atrás del sistema desde la ficha, Cadenas quedó en ${yAtras} y estaba en ${yAntes}. El atrás también vuelve adonde estabas.`)
    }
    const conAtras = (await pagina.evaluate(() => window.__pasajes.length)) - antesDelAtras
    if (conAtras !== 0) anotar(`El atrás del sistema desde la ficha arrancó ${conAtras} pasaje(s). El atrás es un corte.`)
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
    revisarLaMarca('Hoy al chequeo', await medir('Hoy al chequeo', 'profundo', () => alEstado.click()), false)
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
    `Pasajes verificados con la CPU frenada ×4: ${cuantosVistos} pasajes (alta, barra, ficha, chequeo y molestia), con la callback en ${TOPE_DE_LA_CALLBACK} ms o menos, a tiempo, sin cuadros largos mientras se mueven, con lo nuevo inerte, sin nombres de más, con la marca de la barra viajando solo cuando cambia la sección y quietos 400 ms después. El atrás es un corte que devuelve el scroll, volver a una sección también, la pestaña activa sube, un segundo toque en medio del pasaje llega y el foco no se pierde.`,
  )
  // Lo que se informa y no se afirma (ver arriba): la espera desde el toque
  // y la deuda con la holgura de 150 ms de la §9.
  const resumen = (lista) => {
    const ordenadas = [...lista].sort((a, b) => a.ms - b.ms)
    return { mediana: ordenadas[Math.floor(ordenadas.length / 2)], peor: ordenadas[ordenadas.length - 1] }
  }
  const espera = resumen(esperas)
  const callback = resumen(callbacks)
  const enDeuda = callbacks.filter((c) => c.deuda > 0).sort((a, b) => b.deuda - a.deuda)
  console.log(
    `Del toque a que arranca el movimiento: mediana ${Math.round(espera.mediana.ms)} ms, la peor ${Math.round(espera.peor.ms)} ms (${espera.peor.nombre}). La callback de la app: mediana ${Math.round(callback.mediana.ms)} ms, la peor ${Math.round(callback.peor.ms)} ms (${callback.peor.nombre}).`,
  )
  console.log(
    enDeuda.length === 0
      ? `Deuda con la holgura de ${HOLGURA} ms de la §9 (la callback más lo que el movimiento se pasa): ninguna.`
      : `Deuda con la holgura de ${HOLGURA} ms de la §9 (la callback más lo que el movimiento se pasa), sin contar las fotos del navegador: ${enDeuda.length} de ${callbacks.length} pasajes, la mayor de ${Math.round(enDeuda[0].deuda)} ms (${enDeuda[0].nombre}). Lo deciden el rol 14 y Matias, y se mide en el teléfono real.`,
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
