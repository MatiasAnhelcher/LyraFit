/**
 * Lo que todos los portones hacían por su cuenta, una sola vez.
 *
 * ## Por qué existe
 *
 * Nueve de los diez portones arrancaban con la misma secuencia de alta,
 * copiada a mano nueve veces con nueve juegos de esperas levemente distintos.
 * Eso convertía el texto de un botón del alta en API de pruebas: renombrar
 * `'Sí, tengo barra'` rompía nueve archivos a la vez, y cada arreglo había que
 * hacerlo nueve veces o quedaba un portón en rojo que nadie miraba.
 *
 * Ahora la secuencia vive acá. Si el alta cambia, cambia un archivo.
 *
 * ## Qué NO va acá
 *
 * Nada que un portón concreto mida. Esto es plomería: abrir el navegador,
 * pasar el portero, verificar que se está revisando el build que está en
 * disco. Las afirmaciones son de cada portón, y tienen que seguir estando
 * escritas en el portón que las hace — un helper que afirma cosas es un
 * helper que oculta qué se está midiendo.
 */

import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'

export const BASE = process.env.BASE ?? 'http://localhost:4173'
export const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'

/** El teléfono de referencia. Un Android chico de verdad, no un iPhone grande. */
export const TELEFONO = { width: 390, height: 844 }

/**
 * Que lo que se está revisando sea lo que está en disco.
 *
 * `vite preview` se deja abierto entre corridas y puede quedar sirviendo un
 * build viejo. Pasó, y produjo el peor resultado posible: una revisión en
 * verde sobre código que no era el compilado — incluida una prueba por
 * mutación que "pasó" con la mutación puesta. Un guion que puede revisar el
 * archivo equivocado sin decirlo es peor que no tener guion.
 */
export async function revisarQueSirvaLoCompilado(base = BASE) {
  const enDisco = (await readFile('dist/index.html', 'utf8')).match(/assets\/index-[^"']+\.js/)?.[0]
  const servido = (await (await fetch(`${base}/`)).text()).match(/assets\/index-[^"']+\.js/)?.[0]
  if (!enDisco || !servido) {
    console.log('No se pudo comparar el build servido con el de disco.')
    process.exit(2)
  }
  if (enDisco !== servido) {
    console.log('EL SERVIDOR ESTÁ SIRVIENDO UN BUILD VIEJO.')
    console.log(`  en disco:  ${enDisco}`)
    console.log(`  sirviendo: ${servido}`)
    console.log('Reiniciá `npm run preview` después de compilar; si no, esto revisa otro código.')
    process.exit(2)
  }
}

/**
 * El alta completa, hasta quedar parado en Hoy con un plan elegido.
 *
 * Es el portero: sin esto, cualquier ruta redirige a `/alta` y el portón mide
 * la pantalla equivocada.
 *
 * @param {import('playwright').Page} p
 * @param {{ ir?: boolean, rutina?: RegExp }} opciones
 *   `ir: false` para cuando el portón ya navegó por su cuenta (el de
 *   actualización sirve la app desde su propio servidor).
 */
export async function alta(p, { ir = true, rutina = /Cuerpo completo/ } = {}) {
  if (ir) {
    await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
    await p.waitForTimeout(400)
  }
  await p.getByRole('button', { name: 'Empezar', exact: true }).click()
  await p.getByRole('button', { name: 'Sí, tengo barra' }).click()

  // La prueba de nivel: cuatro pantallas, una por patrón. Se contesta con la
  // regleta cuando está (el primer patrón) y sumando cuando no.
  const doce = p.getByRole('button', { name: '12', exact: true })
  if (await doce.isVisible().catch(() => false)) {
    await doce.click()
    await p.getByRole('button', { name: 'Siguiente', exact: true }).click()
    await p.waitForTimeout(150)
  }
  for (let i = 0; i < 4; i++) {
    const sumar = p.getByRole('button', { name: 'Sumar' })
    if (!(await sumar.isVisible().catch(() => false))) break
    for (let n = 0; n < 6; n++) await sumar.click()
    const ver = p.getByRole('button', { name: 'Ver mi plan' })
    if (await ver.isVisible().catch(() => false)) await ver.click()
    else await p.getByRole('button', { name: 'Siguiente', exact: true }).click()
    await p.waitForTimeout(120)
  }

  await p.getByRole('button', { name: 'Seguir', exact: true }).click()
  await p.waitForTimeout(400)
  await p.getByRole('button', { name: rutina }).click()
  await p.waitForTimeout(700)

  // El ofrecimiento de instalar la app, si aparece: tapa media pantalla.
  const ahoraNo = p.getByRole('button', { name: 'Ahora no' })
  if (await ahoraNo.isVisible().catch(() => false)) {
    await ahoraNo.click()
    await p.waitForTimeout(300)
  }
}

/**
 * Navegador, contexto y página, con los errores de consola ya enganchados.
 *
 * Devuelve también `fallos`, el array donde caen los errores de JavaScript:
 * un portón que no los escucha puede pasar en verde con la pantalla rota.
 */
export async function abrir({ viewport = TELEFONO, escala = 1, fallos = [] } = {}) {
  const navegador = await chromium.launch({ executablePath: CHROMIUM })
  const contexto = await navegador.newContext({
    viewport,
    deviceScaleFactor: escala,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
  })
  const pagina = await contexto.newPage()
  pagina.on('pageerror', (e) => fallos.push(`Error de JavaScript: ${e.message}`))
  pagina.on('console', (m) => {
    if (m.type() === 'error') fallos.push(`Error en consola: ${m.text()}`)
  })
  return { navegador, contexto, pagina, fallos }
}

/**
 * Leer y escribir la base por atrás de la interfaz.
 *
 * Estaba copiada en SEIS portones con seis nombres parecidos —`conLaBase`,
 * `enLaBase`— y las seis con la misma trampa escrita (o no escrita) al lado.
 *
 * ## La trampa, dicha una sola vez
 *
 * Una escritura cruda NO dispara la invalidación de `liveQuery`: Dexie se
 * entera de los cambios que pasan por Dexie, y esto los hace por debajo. Así
 * que después de escribir hay que RECARGAR de verdad (`page.reload`), no
 * navegar por hash: un cambio de hash no vuelve a montar la app y la pantalla
 * sigue mostrando lo de antes.
 *
 * Y se espera el `oncomplete` de la transacción, no el `onsuccess` del
 * pedido: entre uno y otro la escritura todavía no está en disco.
 *
 * @param tablas  los object stores que la transacción necesita.
 * @param trabajo una función `(leer, poner) => …`, serializada al navegador.
 *                NO puede cerrar sobre nada de este archivo.
 */
export async function conLaBase(pagina, tablas, trabajo) {
  return pagina.evaluate(
    async ([tablas, cuerpo]) => {
      const req = indexedDB.open('lyrafit')
      const db = await new Promise((r) => {
        req.onsuccess = () => r(req.result)
      })
      const tx = db.transaction(tablas, 'readwrite')
      const leer = (t) =>
        new Promise((r) => {
          const q = tx.objectStore(t).getAll()
          q.onsuccess = () => r(q.result)
        })
      const poner = (t, v) => tx.objectStore(t).put(v)
      // eslint-disable-next-line no-new-func
      const resultado = await new Function('leer', 'poner', `return (${cuerpo})(leer, poner)`)(
        leer,
        poner,
      )
      // El `oncomplete` y no el `onsuccess` del último pedido: entre los dos
      // la escritura todavía no está.
      await new Promise((r) => {
        tx.oncomplete = () => r()
      })
      return resultado
    },
    [tablas, trabajo.toString()],
  )
}
