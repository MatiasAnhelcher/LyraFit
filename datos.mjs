/**
 * Las formas de perder trabajo sin enterarse, medidas contra una base real.
 *
 * No hay servidor: la base del teléfono es la única copia. Este portón hace,
 * con la app compilada, lo que hace una persona que pierde datos sin saberlo,
 * y después lee la base y el almacenamiento privado por atrás de la interfaz.
 * Cada caso salió de una reproducción del rol de QA (revisión del 20 de
 * octubre de 2026) y todos terminaban en verde con el error puesto, porque el
 * guion de entonces no afirmaba nada. Este afirma.
 *
 * La hora la pone el reloj falso de Playwright (`clock.install` y
 * `clock.setSystemTime`), que la página mantiene aunque se recargue: la
 * medianoche y las siete horas se prueban en segundos.
 *
 * 1. **La medianoche.** Miércoles 23:40, dos series en el tercer ejercicio;
 *    la pestaña muere y vuelve el jueves 00:05. El ejercicio en pantalla
 *    tiene que ser el mismo, las series tienen que seguir ahí y, al cerrar,
 *    estar en la sesión guardada, que es del miércoles.
 * 2. **El borrador vencido.** Una sesión entera hasta "Antes de cerrar", sin
 *    tocar "Cerrar la sesión"; siete horas después Hoy la ofrece con
 *    "Guardarla" y "Descartarla", Entrenar no la pisa, y guardarla deja la
 *    sesión con todas sus series y lo dice, sin ningún aviso de error. Si
 *    guardarla falla, se dice y la sesión sigue ofrecida. Un borrador viejo,
 *    sin el día ni el plan, también se ofrece, y descartarlo lo borra.
 *    Cambiar de nivel a mano desde una ficha lo cierra con lo hecho: la ficha
 *    lo dice antes, si falla lo dice y no cambia nada, y si sale bien la
 *    sesión queda guardada con todas sus series y su día.
 * 3. **El archivo roto.** Una copia con una sesión sin registros se rechaza
 *    con un mensaje y la base queda intacta.
 * 4. **Restaurar una copia vieja.** Aparece un resumen y una confirmación,
 *    que cuenta las rutinas y nombra la sesión a medio hacer que también se
 *    borraría; "Mejor no" no toca nada; "Sí, reemplazar" deja antes una copia
 *    automática con lo que había, rutinas incluidas. Si esa copia no se puede
 *    guardar, lo dice y no reemplaza hasta un segundo toque; si el reemplazo
 *    falla, la base queda como estaba. Una copia v3 deja las rutinas vacías y
 *    la cola de sincronización limpia; una v4 trae sus rutinas idénticas.
 * 5. **Borrar todo.** Si borrar las copias falla, se dice y no aparece
 *    "Listo"; si sale bien, la base (rutinas incluidas) y la carpeta de copias
 *    quedan vacías y el "Listo" aparece recién entonces.
 * 6. **El cierre que falla.** Si falla guardar la sesión, aparece un aviso y
 *    el borrador sigue entero. Si falla borrar el borrador, la sesión tampoco
 *    queda guardada: es una sola transacción, todo o nada.
 * 7. **Dos pantallas a la vez.** "Guardarla" desde Entrenar guarda sin decir
 *    que falló. Y con Entrenar en "Antes de cerrar" en una pestaña, la ficha
 *    de otra cambia de nivel y cierra esa sesión: Entrenar no la vuelve a
 *    guardar ni a escribir como borrador, y dice que ya se guardó.
 *
 * El quinto portón de la tabla del rol 12 —"IndexedDB no abre"— no está:
 * es otro arreglo.
 *
 * Uso: BASE=http://localhost:4173 node datos.mjs   (con `vite preview` andando)
 */

import { BASE, abrir, alta, conLaBase, revisarQueSirvaLoCompilado } from './lib/portones.mjs'

await revisarQueSirvaLoCompilado(BASE)

const fallos = []
const notas = []

/** Una hora de Buenos Aires, que no tiene cambio de horario: el huso de `abrir()`. */
const enBuenosAires = (fechaYHora) => new Date(`${fechaYHora}-03:00`)

const boton = (p, nombre) => p.getByRole('button', { name: nombre, exact: true })
const sePuede = (localizador) => localizador.isVisible().catch(() => false)
/** Toca un botón si está, y dice si estaba. */
async function tocar(p, nombre) {
  const b = boton(p, nombre)
  if (!(await sePuede(b))) return false
  await b.click()
  await p.waitForTimeout(150)
  return true
}

/**
 * Las fallas a propósito, apagadas hasta que el portón las prende con
 * `globalThis.__fallar`. Se instalan antes de que cargue la app para que
 * Dexie y el almacenamiento privado ya encuentren la versión con trampa.
 */
function trampas() {
  const poner = IDBObjectStore.prototype.put
  IDBObjectStore.prototype.put = function (...args) {
    const tabla = globalThis.__fallar
    if ((tabla === 'sesiones' || tabla === 'avances') && this.name === tabla) {
      throw new DOMException('Simulado: no hay lugar', 'QuotaExceededError')
    }
    return poner.apply(this, args)
  }
  const borrar = IDBObjectStore.prototype.delete
  IDBObjectStore.prototype.delete = function (...args) {
    if (globalThis.__fallar === 'curso' && this.name === 'curso') {
      throw new DOMException('Simulado: no se pudo borrar', 'UnknownError')
    }
    return borrar.apply(this, args)
  }
  if (globalThis.FileSystemDirectoryHandle) {
    // Sin poder abrir la carpeta de copias: lo que pasa en un navegador sin
    // sistema de archivos privado, o en modo privado.
    const abrirCarpeta = FileSystemDirectoryHandle.prototype.getDirectoryHandle
    FileSystemDirectoryHandle.prototype.getDirectoryHandle = function (...args) {
      if (globalThis.__fallar === 'guardar-copia') {
        return Promise.reject(new DOMException('Simulado', 'NotAllowedError'))
      }
      return abrirCarpeta.apply(this, args)
    }
    const quitar = FileSystemDirectoryHandle.prototype.removeEntry
    FileSystemDirectoryHandle.prototype.removeEntry = function (...args) {
      if (globalThis.__fallar === 'copias') {
        return Promise.reject(new DOMException('Simulado', 'NoModificationAllowedError'))
      }
      return quitar.apply(this, args)
    }
  }
}
const fallar = (p, que) => p.evaluate((q) => (globalThis.__fallar = q), que)

/** Un navegador nuevo, con base vacía, la hora puesta y las trampas listas. */
async function empezar(hora) {
  const abierto = await abrir()
  await abierto.contexto.addInitScript(trampas)
  await abierto.contexto.clock.install({ time: enBuenosAires(hora) })
  await alta(abierto.pagina)
  return abierto
}

const TABLAS = ['sesiones', 'curso', 'avances', 'preferencias', 'estados', 'diario', 'pendientes', 'rutinas']
/** Todas las tablas, leídas directo de IndexedDB. */
// La lista va escrita dos veces porque `conLaBase` serializa la función y no
// se lleva `TABLAS`.
const laBase = (p) =>
  conLaBase(p, TABLAS, async (leer) => {
    const salida = {}
    for (const t of ['sesiones', 'curso', 'avances', 'preferencias', 'estados', 'diario', 'pendientes', 'rutinas']) {
      salida[t] = await leer(t)
    }
    return salida
  })

/** Las copias automáticas en el almacenamiento privado; null si no hay carpeta. */
const lasCopias = (p) =>
  p.evaluate(async () => {
    const raiz = await navigator.storage.getDirectory()
    let carpeta
    try {
      carpeta = await raiz.getDirectoryHandle('respaldos')
    } catch {
      return null
    }
    const copias = []
    for await (const [nombre, archivo] of carpeta.entries()) {
      const texto = await (await archivo.getFile()).text()
      let sesiones = null
      let rutinas = null
      try {
        const copia = JSON.parse(texto)
        sesiones = copia.sesiones.length
        rutinas = copia.rutinas?.length ?? null
      } catch {}
      copias.push({ nombre, bytes: texto.length, sesiones, rutinas })
    }
    return copias
  })

/**
 * Un JSON con las claves ordenadas: lo mismo en cualquier orden de campos.
 * La copia rearma cada rutina campo por campo, y el orden de las claves de un
 * objeto no es un dato.
 */
const canonico = (valor) =>
  JSON.stringify(valor, (_, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  )

/** Escribe una fila directo en IndexedDB, por atrás de la app. */
const ponerFila = (p, tabla, fila) =>
  p.evaluate(
    async ([t, f]) => {
      const req = indexedDB.open('lyrafit')
      const db = await new Promise((r) => (req.onsuccess = () => r(req.result)))
      await new Promise((r) => {
        const tx = db.transaction(t, 'readwrite')
        tx.objectStore(t).put(f)
        tx.oncomplete = () => r()
      })
      db.close()
    },
    [tabla, fila],
  )

const seriesHechas = (registrosOHechas) =>
  registrosOHechas.flatMap((r) => r.series ?? r).filter((s) => s.logrado > 0).length

const casilleros = (p) => p.locator('ul[aria-label="Series de este ejercicio"] li').allInnerTexts()
const titulo = (p) => p.locator('[data-prueba="titulo-ejercicio"]').innerText()

/** Una sesión entera hasta "Antes de cerrar", sin tocar "Cerrar la sesión". */
async function hastaLasPreguntas(p) {
  for (let vuelta = 0; vuelta < 150; vuelta++) {
    if (await sePuede(p.getByText('ANTES DE CERRAR', { exact: true }))) return true
    if (await tocar(p, 'Saltear')) continue
    if (await tocar(p, 'Voy')) continue
    if (await tocar(p, 'Anotar serie')) continue
    if (await tocar(p, 'Siguiente ejercicio')) continue
    if (await tocar(p, 'Terminar')) continue
    if (await tocar(p, 'Listo')) continue
    break
  }
  return sePuede(p.getByText('ANTES DE CERRAR', { exact: true }))
}

/** Desde donde esté, salteando lo que falta, hasta tocar "Cerrar la sesión". */
async function cerrarComoSea(p) {
  for (let vuelta = 0; vuelta < 30; vuelta++) {
    if (await tocar(p, 'Cerrar la sesión')) return true
    if (await tocar(p, 'Saltear')) continue
    if (await tocar(p, 'Siguiente ejercicio')) continue
    if (await tocar(p, 'Saltear este ejercicio')) continue
    if (await tocar(p, 'Terminar acá')) continue
    if (await tocar(p, 'Terminar')) continue
    if (await tocar(p, 'Saltear el cierre')) continue
    break
  }
  return false
}

const errores = (lista, caso) => {
  for (const e of lista) fallos.push(`[${caso}] ${e}`)
}

// ─── 1. La medianoche ────────────────────────────────────────────────────

{
  const caso = '1 · medianoche'
  const { navegador, contexto, pagina: p, fallos: deJs } = await empezar('2026-10-21T23:40:00')

  await p.goto(`${BASE}/#/entrenar`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(800)
  await tocar(p, 'Saltear este ejercicio')
  await tocar(p, 'Saltear este ejercicio')
  const elDelMiercoles = await titulo(p)
  for (let i = 0; i < 2; i++) {
    await tocar(p, 'Saltear')
    await tocar(p, 'Voy')
    await tocar(p, 'Anotar serie')
  }
  await tocar(p, 'Saltear')
  await p.waitForTimeout(400)
  const anotadas = await casilleros(p)

  // La pestaña muere y vuelve pasada la medianoche: lo que hace iOS cuando
  // salís a contestar un mensaje con el teléfono corto de memoria.
  await contexto.clock.setSystemTime(enBuenosAires('2026-10-22T00:05:00'))
  await p.reload({ waitUntil: 'networkidle' })
  await p.waitForTimeout(1200)
  const elDeLas0005 = await titulo(p).catch(() => '(no hay ejercicio en pantalla)')
  const retomadas = await casilleros(p).catch(() => [])
  const { curso } = await laBase(p)

  if (elDeLas0005 !== elDelMiercoles) {
    fallos.push(
      `[${caso}] A las 00:05 el tercer ejercicio cambió: "${elDelMiercoles}" → "${elDeLas0005}". ` +
        'El plan se rearmó con el día nuevo y las series hechas quedan afuera.',
    )
  }
  if (JSON.stringify(retomadas) !== JSON.stringify(anotadas)) {
    fallos.push(`[${caso}] Las series no siguen en pantalla: ${JSON.stringify(anotadas)} → ${JSON.stringify(retomadas)}`)
  }
  if (curso[0]?.dia !== '2026-10-21') {
    fallos.push(`[${caso}] El borrador no guarda el día de la sesión en un campo propio (dice ${JSON.stringify(curso[0]?.dia)}).`)
  }

  if (!(await cerrarComoSea(p))) fallos.push(`[${caso}] No se pudo llegar a "Cerrar la sesión".`)
  await p.waitForTimeout(1500)
  const { sesiones, curso: despues } = await laBase(p)
  const guardadas = sesiones[0] ? seriesHechas(sesiones[0].registros) : 0
  if (sesiones.length !== 1) {
    fallos.push(`[${caso}] Se esperaba una sesión guardada y hay ${sesiones.length}.`)
  } else {
    if (guardadas !== 2) {
      fallos.push(`[${caso}] La sesión guardada tiene ${guardadas} series con algo hecho, y se anotaron 2.`)
    }
    if (sesiones[0].fecha !== '2026-10-21') {
      fallos.push(`[${caso}] La sesión quedó con fecha ${sesiones[0].fecha}: es del miércoles, que es cuando se entrenó.`)
    }
  }
  if (despues.length !== 0) fallos.push(`[${caso}] Después de cerrar quedó el borrador vivo.`)
  errores(deJs, caso)
  notas.push(`${caso}: "${elDelMiercoles}" a las 23:40 y a las 00:05, ${guardadas} series guardadas el ${sesiones[0]?.fecha}.`)
  await navegador.close()
}

// ─── 2 a 5. El borrador vencido, restaurar y borrar, en la misma base ────

{
  const { navegador, contexto, pagina: p, fallos: deJs } = await empezar('2026-10-21T20:00:00')

  // 2. El borrador vencido.
  let caso = '2 · borrador vencido'
  await p.goto(`${BASE}/#/entrenar`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(800)
  if (!(await hastaLasPreguntas(p))) fallos.push(`[${caso}] La sesión no llegó a "Antes de cerrar".`)
  await p.waitForTimeout(400)
  const [borrador] = (await laBase(p)).curso
  const anotadas = borrador ? seriesHechas(Object.values(borrador.hechas)) : 0
  if (anotadas === 0) fallos.push(`[${caso}] No quedó ninguna serie en el borrador antes de irse.`)

  // Se va sin tocar "Cerrar la sesión", y abre la app siete horas después.
  await p.goto('about:blank')
  await contexto.clock.setSystemTime(enBuenosAires('2026-10-22T03:10:00'))
  await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1200)
  const oferta = p.locator('[data-prueba="sesion-sin-cerrar"]')
  const textoDeHoy = (await sePuede(oferta)) ? await oferta.innerText() : null
  if (!textoDeHoy) {
    fallos.push(`[${caso}] Siete horas después, Hoy no ofrece la sesión sin cerrar.`)
  } else {
    if (!textoDeHoy.includes(`de ayer, con ${anotadas} series`)) {
      fallos.push(`[${caso}] La oferta no dice de cuándo es ni cuántas series tiene: "${textoDeHoy.replace(/\s+/g, ' ')}"`)
    }
    if (!(await sePuede(boton(p, 'Guardarla'))) || !(await sePuede(boton(p, 'Descartarla')))) {
      fallos.push(`[${caso}] Faltan "Guardarla" o "Descartarla".`)
    }
  }

  // Y si se entra a Entrenar igual, pregunta lo mismo y no pisa el borrador.
  await p.goto(`${BASE}/#/entrenar`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1200)
  if (!(await sePuede(oferta))) fallos.push(`[${caso}] Entrenar arrancó una sesión encima del borrador vencido sin mostrarlo.`)
  const [sigue] = (await laBase(p)).curso
  if (JSON.stringify(sigue?.hechas) !== JSON.stringify(borrador?.hechas)) {
    fallos.push(`[${caso}] Abrir Entrenar borró o pisó el borrador vencido.`)
  }

  await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(800)

  // Si guardarla falla, se dice, y la sesión sigue ahí para probar de nuevo.
  await fallar(p, 'sesiones')
  await tocar(p, 'Guardarla')
  await p.waitForTimeout(1000)
  {
    const dice = await p.getByRole('alert').allInnerTexts()
    const { sesiones, curso } = await laBase(p)
    if (!dice.some((t) => t.includes('No se pudo guardar'))) {
      fallos.push(`[${caso}] Si "Guardarla" falla, Hoy no lo dice: ${JSON.stringify(dice)}`)
    }
    if (sesiones.length !== 0) fallos.push(`[${caso}] "Guardarla" falló y quedaron ${sesiones.length} sesiones.`)
    if (JSON.stringify(curso[0]?.hechas) !== JSON.stringify(borrador?.hechas)) {
      fallos.push(`[${caso}] "Guardarla" falló y el borrador no sigue entero.`)
    }
    if (!(await sePuede(oferta))) fallos.push(`[${caso}] "Guardarla" falló y Hoy dejó de ofrecer la sesión.`)
    notas.push(`${caso}: si guardarla falla, Hoy dice "${dice.join(' ')}".`)
  }
  await fallar(p, null)

  await tocar(p, 'Guardarla')
  await p.waitForTimeout(1500)
  {
    const { sesiones, curso } = await laBase(p)
    const guardadas = sesiones[0] ? seriesHechas(sesiones[0].registros) : 0
    if (sesiones.length !== 1) fallos.push(`[${caso}] "Guardarla" dejó ${sesiones.length} sesiones.`)
    else {
      if (guardadas !== anotadas) fallos.push(`[${caso}] Se anotaron ${anotadas} series y se guardaron ${guardadas}.`)
      if (sesiones[0].fecha !== '2026-10-21') fallos.push(`[${caso}] La sesión quedó con fecha ${sesiones[0].fecha} y es del miércoles.`)
    }
    if (curso.length !== 0) fallos.push(`[${caso}] Después de guardarla quedó el borrador.`)
    // Que la base esté bien no alcanza: con la transacción cortada, la sesión
    // se guardaba y la pantalla decía que no.
    const dice = await p.getByRole('alert').allInnerTexts()
    if (dice.some((t) => t.includes('No se pudo'))) {
      fallos.push(`[${caso}] "Guardarla" guardó la sesión y la pantalla dice que no: ${JSON.stringify(dice)}`)
    }
    if (!(await sePuede(p.getByText('Listo: la sesión quedó guardada en tu historial.')))) {
      fallos.push(`[${caso}] Después de "Guardarla", Hoy no dice que la sesión quedó guardada.`)
    }
    const cifra = await p.locator('.cifra-identidad').innerText().catch(() => '')
    if (cifra.trim() !== '001') fallos.push(`[${caso}] Hoy dice "${cifra}" sesiones después de guardarla.`)
    const frase = textoDeHoy?.split('\n').find((l) => l.startsWith('Quedó sin cerrar')) ?? ''
    notas.push(`${caso}: Hoy dijo "${frase}" y se guardaron ${guardadas} de ${anotadas} series.`)
  }

  // Un borrador como los de antes: sin día, sin plan, sin tipo, escrito
  // directo en la base.
  const ejercicio = Object.keys(borrador?.hechas ?? {})[0] ?? 'flexion-pared'
  const borradorViejo = {
    id: 'actual',
    arrancadaEn: Date.parse('2026-10-20T19:00:00-03:00'),
    duracionAcumulada: 900,
    actualizadoEn: Date.parse('2026-10-20T19:15:00-03:00'),
    corta: false,
    indice: 0,
    etapa: 'series',
    hechas: { [ejercicio]: [{ logrado: 6 }, { logrado: 5 }] },
  }
  await ponerFila(p, 'curso', borradorViejo)
  await p.reload({ waitUntil: 'networkidle' })
  await p.waitForTimeout(1200)
  const textoViejo = (await sePuede(oferta)) ? await oferta.innerText() : null
  if (!textoViejo?.includes('del martes 20/10, con 2 series')) {
    fallos.push(`[${caso}] Un borrador viejo, sin el día, no se ofrece bien: ${JSON.stringify(textoViejo)}`)
  }

  await tocar(p, 'Descartarla')
  await p.waitForTimeout(800)
  {
    const { sesiones, curso } = await laBase(p)
    if (curso.length !== 0) fallos.push(`[${caso}] "Descartarla" no borró el borrador.`)
    if (sesiones.length !== 1) fallos.push(`[${caso}] "Descartarla" cambió las sesiones guardadas (${sesiones.length}).`)
  }

  // Cambiar de nivel a mano desde una ficha cierra la sesión a medio hacer
  // con lo hecho. Antes "Empezar la cadena acá" tiraba el borrador que todavía
  // se retomaba —Entrenar lo rearmaba con el eslabón nuevo y las series del
  // viejo quedaban afuera—, y eso era perderlas igual. Ahora se guardan, y la
  // ficha lo dice antes del toque.
  {
    await ponerFila(p, 'curso', borradorViejo)
    const { avances } = await laBase(p)
    const empuje = avances.find((a) => a.patron === 'empuje')?.ejercicioId
    const destino = empuje === 'flexion-pared' ? 'flexion-inclinada-alta' : 'flexion-pared'
    await p.goto(`${BASE}/#/biblioteca/${destino}`, { waitUntil: 'networkidle' })
    await p.waitForTimeout(800)
    if (!(await sePuede(p.getByText('Tenés una sesión a medio hacer: se cierra con lo hecho.')))) {
      fallos.push(`[${caso}] La ficha no avisa que cambiar de nivel cierra la sesión a medio hacer.`)
    }
    // Si guardar la sesión falla, la ficha lo dice y no cambia nada.
    await fallar(p, 'sesiones')
    await tocar(p, 'Empezar la cadena de empuje acá')
    await p.waitForTimeout(800)
    await fallar(p, null)
    {
      const dice = await p.getByRole('alert').allInnerTexts()
      const { curso, sesiones, avances: tras } = await laBase(p)
      if (!dice.some((t) => t.includes('No se pudo cambiar el nivel. Tu sesión a medio hacer sigue como estaba'))) {
        fallos.push(`[${caso}] Si cambiar de nivel falla, la ficha no lo dice: ${JSON.stringify(dice)}`)
      }
      if (curso.length !== 1 || sesiones.length !== 1 || tras.find((a) => a.patron === 'empuje')?.ejercicioId !== empuje) {
        fallos.push(`[${caso}] Cambiar de nivel falló y cambió algo: ${curso.length} borradores, ${sesiones.length} sesiones.`)
      }
      notas.push(`${caso}: si cambiar de nivel falla, la ficha dice "${dice.join(' ')}".`)
    }
    if (!(await tocar(p, 'Empezar la cadena de empuje acá'))) {
      fallos.push(`[${caso}] La ficha de ${destino} no ofrece empezar la cadena ahí.`)
    }
    await p.waitForTimeout(800)
    const { curso, sesiones, avances: despues } = await laBase(p)
    if (despues.find((a) => a.patron === 'empuje')?.ejercicioId !== destino) {
      fallos.push(`[${caso}] "Empezar la cadena acá" no movió empuje a ${destino}.`)
    }
    if (curso.length !== 0) fallos.push(`[${caso}] Cambiar de nivel a mano dejó el borrador sin cerrar.`)
    const cerrada = sesiones.find((s) => s.fecha === '2026-10-20')
    if (sesiones.length !== 2 || !cerrada) {
      fallos.push(`[${caso}] Cambiar de nivel a mano no guardó la sesión a medio hacer: ${sesiones.length} sesiones.`)
    } else if (seriesHechas(cerrada.registros) !== 2) {
      fallos.push(`[${caso}] La sesión cerrada al cambiar de nivel tiene ${seriesHechas(cerrada.registros)} series y se anotaron 2.`)
    }
    await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
    await p.waitForTimeout(800)
    if (await sePuede(oferta)) fallos.push(`[${caso}] Después de cerrarla con el cambio de nivel, Hoy la sigue ofreciendo.`)
    notas.push(`${caso}: cambiar de nivel a mano cerró la sesión a medio hacer con ${cerrada ? seriesHechas(cerrada.registros) : 0} de 2 series, del ${cerrada?.fecha}.`)
  }

  // 3. El archivo roto.
  caso = '3 · archivo roto'
  const antes = await laBase(p)
  const [preferencias] = antes.preferencias
  const copiaCon = (sesiones) =>
    Buffer.from(
      JSON.stringify({
        version: 3,
        exportadoEn: '2026-09-01T12:00:00.000Z',
        sesiones,
        avances: antes.avances,
        estados: [],
        preferencias,
        diario: [],
      }),
    )
  const elegir = async (nombre, contenido) => {
    await p.locator('input[type="file"]').setInputFiles({
      name: nombre,
      mimeType: 'application/json',
      buffer: contenido,
    })
    await p.waitForTimeout(900)
  }
  await p.goto(`${BASE}/#/ajustes`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(800)
  await elegir(
    'lyrafit-2026-09-01.json',
    copiaCon([{ id: 'rota', fecha: '2026-09-01', finalizadaEn: 1, duracionSegundos: 600 }]),
  )
  const confirmar = p.locator('[data-prueba="confirmar-restauracion"]')
  const avisoRoto = await p.getByRole('status').allInnerTexts()
  if (!avisoRoto.some((t) => t.includes('La sesión 1 de la copia está rota') && t.includes('No se cambió nada'))) {
    fallos.push(`[${caso}] El archivo roto no se rechazó con un mensaje: ${JSON.stringify(avisoRoto)}`)
  }
  if (await sePuede(confirmar)) fallos.push(`[${caso}] Con un archivo roto se ofreció reemplazar.`)
  {
    const { sesiones } = await laBase(p)
    if (JSON.stringify(sesiones.map((s) => s.id)) !== JSON.stringify(antes.sesiones.map((s) => s.id))) {
      fallos.push(`[${caso}] La base cambió con un archivo roto: ${sesiones.length} sesiones.`)
    }
  }
  notas.push(`${caso}: "${avisoRoto.join(' ')}"`)

  // 4. Restaurar una copia vieja.
  caso = '4 · restaurar'
  // Una rutina armada por la persona, como la escribe la app.
  const rutina = {
    id: 'rutina-del-porton',
    nombre: 'Pecho en casa',
    carpeta: 'Casa',
    creadaEn: Date.parse('2026-10-19T10:00:00-03:00'),
    actualizadaEn: Date.parse('2026-10-19T10:05:00-03:00'),
    pasos: [
      { id: 'p1', clase: 'cadena', patron: 'empuje', series: 3, seccion: 'principal' },
      { id: 'p2', clase: 'fijo', ejercicioId: 'flexion-diamante', series: 2, cantidad: 8, seccion: 'principal' },
    ],
  }
  await ponerFila(p, 'rutinas', rutina)
  // Con una sesión a medio hacer: restaurar la borra y no va en ninguna copia,
  // así que la confirmación tiene que nombrarla. Se escribe parado en Ajustes,
  // donde nada reescribe el borrador.
  await p.evaluate(async (enCurso) => {
    const req = indexedDB.open('lyrafit')
    const db = await new Promise((r) => (req.onsuccess = () => r(req.result)))
    await new Promise((r) => {
      const tx = db.transaction('curso', 'readwrite')
      tx.objectStore('curso').put({ ...enCurso, arrancadaEn: Date.now(), actualizadoEn: Date.now() })
      tx.oncomplete = () => r()
    })
    db.close()
  }, {
    id: 'actual',
    duracionAcumulada: 300,
    corta: false,
    indice: 0,
    etapa: 'series',
    hechas: { [ejercicio]: [{ logrado: 7 }, { logrado: 6 }, { logrado: 6 }, { logrado: 5 }] },
  })
  const vieja = copiaCon([])
  await elegir('lyrafit-2026-09-01.json', vieja)
  const resumen = (await sePuede(confirmar)) ? await confirmar.innerText() : null
  if (!resumen) {
    fallos.push(`[${caso}] Elegir una copia vieja no mostró ninguna confirmación.`)
  } else {
    if (!resumen.includes('Vas a reemplazar 2 sesiones y 1 rutina por ninguna sesión y ninguna rutina.')) {
      fallos.push(`[${caso}] El resumen no dice qué se reemplaza: "${resumen.replace(/\s+/g, ' ')}"`)
    }
    if (!resumen.includes('que quedó sin cerrar, con 4 series, también se borra')) {
      fallos.push(`[${caso}] La confirmación no avisa que la sesión a medio hacer también se borra: "${resumen.replace(/\s+/g, ' ')}"`)
    }
  }
  if ((await laBase(p)).sesiones.length !== 2) fallos.push(`[${caso}] Se reemplazó antes de confirmar.`)
  await tocar(p, 'Mejor no')
  if (await sePuede(confirmar)) fallos.push(`[${caso}] "Mejor no" no cerró la confirmación.`)
  {
    const { sesiones, curso, rutinas } = await laBase(p)
    if (sesiones.length !== 2 || rutinas.length !== 1) fallos.push(`[${caso}] "Mejor no" cambió la base.`)
    if (curso.length !== 1) fallos.push(`[${caso}] "Mejor no" borró la sesión a medio hacer.`)
  }

  // Si la copia de antes no se puede guardar, no reemplaza en silencio.
  await elegir('lyrafit-2026-09-01.json', vieja)
  await fallar(p, 'guardar-copia')
  await tocar(p, 'Sí, reemplazar')
  await p.waitForTimeout(1000)
  await fallar(p, null)
  {
    const dice = await p.getByRole('alert').allInnerTexts()
    const { sesiones, curso } = await laBase(p)
    if (!dice.some((t) => t.includes('No pude guardar una copia automática'))) {
      fallos.push(`[${caso}] Sin poder guardar la copia de antes, no lo dice: ${JSON.stringify(dice)}`)
    }
    if (!(await sePuede(boton(p, 'Reemplazar sin copia')))) {
      fallos.push(`[${caso}] Sin poder guardar la copia de antes, el botón no dice que va sin copia.`)
    }
    if (sesiones.length !== 2 || curso.length !== 1) {
      fallos.push(`[${caso}] Sin poder guardar la copia de antes, reemplazó igual en el primer toque.`)
    }
    notas.push(`${caso}: sin copia de antes, dice "${dice.join(' ').replace(/\s+/g, ' ')}".`)
  }
  await tocar(p, 'Mejor no')

  // Si el reemplazo falla a mitad de camino, la base queda como estaba.
  await elegir('lyrafit-2026-09-01.json', vieja)
  await fallar(p, 'avances')
  await tocar(p, 'Sí, reemplazar')
  await p.waitForTimeout(1500)
  await fallar(p, null)
  {
    const dice = await p.getByRole('status').allInnerTexts()
    const { sesiones, avances, curso, rutinas } = await laBase(p)
    if (!dice.some((t) => t.includes('No se pudo restaurar. Tus datos quedaron como estaban.'))) {
      fallos.push(`[${caso}] Si el reemplazo falla, no lo dice: ${JSON.stringify(dice)}`)
    }
    if (
      sesiones.length !== 2 ||
      curso.length !== 1 ||
      canonico(rutinas) !== canonico([rutina]) ||
      JSON.stringify(avances) !== JSON.stringify(antes.avances)
    ) {
      fallos.push(
        `[${caso}] El reemplazo falló y la base quedó a medias: ${sesiones.length} sesiones, ` +
          `${avances.length} niveles, ${curso.length} borradores.`,
      )
    }
  }

  // Y ahora sí: se prueba de nuevo desde la misma confirmación.
  await tocar(p, 'Sí, reemplazar')
  await p.waitForTimeout(1500)
  {
    const { sesiones, rutinas, pendientes } = await laBase(p)
    const copias = (await lasCopias(p)) ?? []
    const previa = copias.find((c) => c.nombre.includes('antes-de-restaurar'))
    const avisoFinal = await p.getByRole('status').allInnerTexts()
    if (sesiones.length !== 0) fallos.push(`[${caso}] Después de confirmar hay ${sesiones.length} sesiones y la copia traía 0.`)
    // Una copia v3 no conoce las rutinas: entran vacías, y las de antes no
    // quedan pegadas a un historial que no es el suyo.
    if (rutinas.length !== 0) fallos.push(`[${caso}] Después de restaurar una copia v3 quedaron ${rutinas.length} rutinas.`)
    if (pendientes.length !== 0) {
      fallos.push(`[${caso}] Restaurar dejó ${pendientes.length} filas en la cola de sincronización, que nombran datos que ya no están.`)
    }
    if (!avisoFinal.some((t) => t.includes('Listo: 0 sesiones restauradas.'))) {
      fallos.push(`[${caso}] Después de reemplazar no dice "Listo": ${JSON.stringify(avisoFinal)}`)
    }
    if (!previa) {
      fallos.push(`[${caso}] No quedó una copia automática antes de reemplazar: ${JSON.stringify(copias)}`)
    } else if (previa.sesiones !== 2 || previa.rutinas !== 1) {
      fallos.push(
        `[${caso}] La copia de antes tiene ${previa.sesiones} sesiones y ${previa.rutinas} rutinas, ` +
          'y tenía que tener lo que había: 2 y 1.',
      )
    }
    notas.push(`${caso}: resumen "${resumen?.split('\n').find((l) => l.startsWith('Vas a reemplazar')) ?? ''}", copia previa ${previa?.nombre} con ${previa?.sesiones} sesiones y ${previa?.rutinas} rutina.`)
  }

  // Una copia v4 trae sus rutinas, idénticas.
  await elegir(
    'lyrafit-2026-10-21.json',
    Buffer.from(
      JSON.stringify({
        version: 4,
        exportadoEn: '2026-10-21T12:00:00.000Z',
        sesiones: [],
        avances: antes.avances,
        estados: [],
        preferencias,
        diario: [],
        rutinas: [rutina],
      }),
    ),
  )
  {
    const frase = (await sePuede(confirmar)) ? await confirmar.innerText() : ''
    if (!frase.includes('Hoy no tenés sesiones ni rutinas guardadas. El archivo trae 1 rutina.')) {
      fallos.push(`[${caso}] El resumen de una copia v4 no cuenta su rutina: "${frase.replace(/\s+/g, ' ')}"`)
    }
  }
  await tocar(p, 'Sí, reemplazar')
  await p.waitForTimeout(1500)
  {
    const { rutinas } = await laBase(p)
    if (canonico(rutinas) !== canonico([rutina])) {
      fallos.push(`[${caso}] La rutina de una copia v4 no volvió idéntica: ${JSON.stringify(rutinas)}`)
    }
  }

  // 5. Borrar todo.
  caso = '5 · borrar todo'
  const copiasAntes = (await lasCopias(p)) ?? []
  if (copiasAntes.length === 0) fallos.push(`[${caso}] No había copias automáticas para borrar: la prueba no mediría nada.`)
  await fallar(p, 'copias')
  await p.getByRole('button', { name: 'Borrar todos mis datos' }).click()
  await p.waitForTimeout(300)
  await tocar(p, 'Sí, borrar todo')
  await p.waitForTimeout(1000)
  const errorVisible = await sePuede(p.getByText('No se pudo borrar todo. Probá de nuevo.'))
  const listoAntes = await sePuede(p.getByText(/^Listo\./))
  if (!errorVisible) fallos.push(`[${caso}] Si borrar las copias falla, la pantalla no lo dice.`)
  if (listoAntes) fallos.push(`[${caso}] Dijo "Listo" con las copias todavía en el teléfono.`)
  if (((await lasCopias(p)) ?? []).length === 0) fallos.push(`[${caso}] La falla simulada no impidió borrar las copias: la prueba no mide nada.`)

  await fallar(p, null)
  await tocar(p, 'Sí, borrar todo')
  await p.waitForTimeout(1500)
  {
    const base = await laBase(p)
    const llenas = TABLAS.filter((t) => base[t].length > 0)
    const copias = await lasCopias(p)
    if (llenas.length > 0) fallos.push(`[${caso}] Después de borrar todo quedan filas en: ${llenas.join(', ')}.`)
    if (copias && copias.length > 0) fallos.push(`[${caso}] Después de borrar todo quedan ${copias.length} copias automáticas: ${copias.map((c) => c.nombre).join(', ')}`)
    if (!p.url().includes('#/alta')) fallos.push(`[${caso}] Después de borrar todo no fue al alta: ${p.url()}`)
    if (!(await sePuede(p.getByText('Listo. Se borró todo lo que la app guardaba en este teléfono.')))) {
      fallos.push(`[${caso}] Terminado el borrado, no aparece el "Listo".`)
    }
    notas.push(`${caso}: ${copiasAntes.length} copias antes, ${copias?.length ?? 0} después, ${llenas.length} tablas con filas.`)
  }

  errores(deJs, 'casos 2 a 5')
  await navegador.close()
}

// ─── 6. El cierre que falla ──────────────────────────────────────────────

{
  const caso = '6 · cierre que falla'
  const { navegador, pagina: p, fallos: deJs } = await empezar('2026-10-21T19:00:00')
  await p.goto(`${BASE}/#/entrenar?corta=1`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(800)
  if (!(await hastaLasPreguntas(p))) fallos.push(`[${caso}] La sesión corta no llegó a "Antes de cerrar".`)
  await p.waitForTimeout(400)
  const [borrador] = (await laBase(p)).curso
  const aviso = p.getByRole('alert')

  for (const [que, como] of [
    ['sesiones', 'falla guardar la sesión'],
    ['curso', 'falla borrar el borrador en la misma transacción'],
  ]) {
    await fallar(p, que)
    await p.getByRole('button', { name: 'Cerrar la sesión' }).click()
    await p.waitForTimeout(1000)
    const dice = (await sePuede(aviso)) ? await aviso.innerText() : null
    const { sesiones, curso } = await laBase(p)
    if (!dice?.includes('No se pudo guardar')) fallos.push(`[${caso}] Cuando ${como}, no aparece ningún aviso.`)
    if (sesiones.length !== 0) {
      fallos.push(`[${caso}] Cuando ${como}, la sesión quedó guardada igual (${sesiones.length}): no es todo o nada.`)
    }
    if (JSON.stringify(curso[0]?.hechas) !== JSON.stringify(borrador?.hechas)) {
      fallos.push(`[${caso}] Cuando ${como}, el borrador no sigue entero.`)
    }
    if (!(await sePuede(p.getByText('ANTES DE CERRAR', { exact: true })))) {
      fallos.push(`[${caso}] Cuando ${como}, la pantalla dejó de mostrar la sesión.`)
    }
    notas.push(`${caso}: cuando ${como}, dice "${dice}".`)
  }

  await fallar(p, null)
  await p.getByRole('button', { name: 'Cerrar la sesión' }).click()
  await p.waitForTimeout(2000)
  const { sesiones, curso } = await laBase(p)
  if (sesiones.length !== 1 || curso.length !== 0) {
    fallos.push(`[${caso}] Sin falla, cerrar dejó ${sesiones.length} sesiones y ${curso.length} borradores (se esperaba 1 y 0).`)
  }
  errores(deJs, caso)
  await navegador.close()
}

// ─── 7. Dos pantallas a la vez ───────────────────────────────────────────

{
  const caso = '7 · dos pantallas'
  const { navegador, contexto, pagina: a, fallos: deJs } = await empezar('2026-10-21T19:00:00')

  // "Guardarla" desde Entrenar: la otra puerta de la misma función, que con
  // la transacción cortada guardaba la sesión y decía "No se pudo guardar".
  await ponerFila(a, 'curso', {
    id: 'actual',
    arrancadaEn: Date.parse('2026-10-20T19:00:00-03:00'),
    duracionAcumulada: 900,
    actualizadoEn: Date.parse('2026-10-20T19:15:00-03:00'),
    corta: false,
    indice: 0,
    etapa: 'series',
    hechas: { 'flexion-pared': [{ logrado: 6 }, { logrado: 5 }] },
  })
  await a.goto(`${BASE}/#/entrenar`, { waitUntil: 'networkidle' })
  await a.waitForTimeout(1000)
  if (!(await tocar(a, 'Guardarla'))) fallos.push(`[${caso}] Entrenar no ofrece "Guardarla" con un borrador vencido.`)
  await a.waitForTimeout(1200)
  {
    const dice = await a.getByRole('alert').allInnerTexts()
    const { sesiones } = await laBase(a)
    if (dice.some((t) => t.includes('No se pudo'))) {
      fallos.push(`[${caso}] "Guardarla" en Entrenar guardó la sesión y dice que no: ${JSON.stringify(dice)}`)
    }
    if (sesiones.length !== 1) fallos.push(`[${caso}] "Guardarla" en Entrenar dejó ${sesiones.length} sesiones.`)
    if (await sePuede(a.locator('[data-prueba="sesion-sin-cerrar"]'))) {
      fallos.push(`[${caso}] Después de "Guardarla", Entrenar sigue mostrando la sesión sin cerrar.`)
    }
  }

  // Entrenar sigue con una sesión nueva hasta "Antes de cerrar"...
  if (!(await hastaLasPreguntas(a))) fallos.push(`[${caso}] La sesión no llegó a "Antes de cerrar".`)
  await a.waitForTimeout(400)
  const [borrador] = (await laBase(a)).curso
  const anotadas = borrador ? seriesHechas(Object.values(borrador.hechas)) : 0
  if (!borrador?.idDeLaSesion) fallos.push(`[${caso}] El borrador no lleva el id de su sesión.`)

  // ...y en otra pestaña, la ficha cambia de nivel y la cierra con lo hecho.
  const b = await contexto.newPage()
  b.on('pageerror', (e) => deJs.push(`Error de JavaScript en la ficha: ${e.message}`))
  const empuje = (await laBase(a)).avances.find((x) => x.patron === 'empuje')?.ejercicioId
  const destino = empuje === 'flexion-pared' ? 'flexion-inclinada-alta' : 'flexion-pared'
  await b.goto(`${BASE}/#/biblioteca/${destino}`, { waitUntil: 'networkidle' })
  await b.waitForTimeout(800)
  if (!(await tocar(b, 'Empezar la cadena de empuje acá'))) {
    fallos.push(`[${caso}] La ficha de ${destino} no ofrece empezar la cadena ahí.`)
  }
  await b.waitForTimeout(1000)
  await b.close()

  // Entrenar se entera solo, o al tocar "Cerrar la sesión": las dos valen.
  // Lo que no vale es guardar la misma sesión dos veces.
  await a.waitForTimeout(1200)
  const placa = a.locator('[data-prueba="sesion-ya-guardada"]')
  let como = 'sola, al refrescarse'
  if (!(await sePuede(placa))) {
    como = 'al tocar "Cerrar la sesión"'
    await tocar(a, 'Cerrar la sesión')
    await a.waitForTimeout(1500)
  }
  {
    const { sesiones, curso } = await laBase(a)
    const esta = sesiones.filter((s) => s.id === borrador?.idDeLaSesion)
    if (sesiones.length !== 2 || esta.length !== 1) {
      fallos.push(
        `[${caso}] Quedaron ${sesiones.length} sesiones y tenían que ser 2: la de "Guardarla" y esta, una sola vez.`,
      )
    } else if (seriesHechas(esta[0].registros) !== anotadas) {
      fallos.push(`[${caso}] La sesión cerrada desde la ficha tiene ${seriesHechas(esta[0].registros)} series y se anotaron ${anotadas}.`)
    }
    if (curso.length !== 0) fallos.push(`[${caso}] Entrenar volvió a escribir el borrador de una sesión ya guardada.`)
    const texto = (await sePuede(placa)) ? await placa.innerText() : null
    if (!texto?.includes('Esta sesión ya se guardó desde otra pantalla.')) {
      fallos.push(`[${caso}] Entrenar no dice que la sesión ya se guardó desde otra pantalla: ${JSON.stringify(texto)}`)
    }
    if (await sePuede(a.getByRole('alert'))) fallos.push(`[${caso}] Entrenar muestra un aviso de error con la sesión ya guardada.`)
    notas.push(`${caso}: Entrenar se enteró ${como} y dice "${texto?.replace(/\s+/g, ' ')}"; ${sesiones.length} sesiones.`)
  }
  await tocar(a, 'Ir a Hoy')
  await a.waitForTimeout(800)
  if (!a.url().endsWith('#/')) fallos.push(`[${caso}] "Ir a Hoy" no fue a Hoy: ${a.url()}`)

  errores(deJs, caso)
  await navegador.close()
}

for (const n of notas) console.log(n)
if (fallos.length > 0) {
  console.log('\nPROBLEMAS ENCONTRADOS:')
  for (const f of fallos) console.log(' -', f)
  process.exit(1)
}
console.log('\nNinguna de las formas medidas pierde trabajo sin decirlo.')
