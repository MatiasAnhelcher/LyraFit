/**
 * Todos los portones, de a uno, y un solo veredicto.
 *
 * Es lo que corre la CI y lo que hay que correr antes de un PR, con el
 * proyecto compilado y `vite preview` sirviéndolo en `BASE` (el 4173 si no se
 * dice otra cosa):
 *
 *     npm run build
 *     npx vite preview --port 4173 --strictPort &
 *     npm run portones                  # todos
 *     npm run portones -- pliegue datos # o solo esos
 *
 * Portón es todo `*.mjs` de la raíz menos los dos generadores, que no afirman
 * nada: `logo.mjs` reescribe los íconos y `figuras.mjs` saca la hoja de
 * contacto de los dibujos, que vive solo en `npm run dev`. Un portón nuevo
 * entra solo, por estar ahí: una lista escrita a mano es la lista que se
 * olvida de sumar el que se acaba de escribir.
 *
 * El orden no importa, y se cuida que no importe: ninguno escribe en `dist/`.
 * `actualizacion.mjs` compila sus tres versiones en una carpeta temporal y las
 * sirve en su propio puerto, así que el `vite preview` sigue sirviendo lo que
 * se compiló para los portones antes, durante y después de él.
 *
 * Corre todos aunque falle uno, para que un rojo no esconda a los que vienen
 * después, y sale con 1 si falló alguno.
 */

import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { BASE, CHROMIUM } from './portones.mjs'

/** La raíz del proyecto: los portones leen `dist/` y `src/` desde ahí. */
const RAIZ = fileURLToPath(new URL('..', import.meta.url))

const GENERADORES = new Set(['logo.mjs', 'figuras.mjs'])
/** Lo más largo que tarda uno sano es unos minutos; colgado, no termina nunca. */
const TOPE_POR_PORTON = 20 * 60 * 1000

const nombrados = process.argv.slice(2).map((n) => (n.endsWith('.mjs') ? n : `${n}.mjs`))
const todos = readdirSync(RAIZ)
  .filter((archivo) => archivo.endsWith('.mjs') && !GENERADORES.has(archivo))
  .sort((a, b) => a.localeCompare(b))
const lista = nombrados.length > 0 ? todos.filter((archivo) => nombrados.includes(archivo)) : todos

for (const nombre of nombrados) {
  if (!todos.includes(nombre)) {
    console.error(`No hay un portón que se llame ${nombre}.`)
    process.exit(2)
  }
}

console.log(`${lista.length} portones contra ${BASE}, con el Chromium de ${CHROMIUM}.`)

const fallados = []
for (const archivo of lista) {
  console.log(`\n── ${archivo} ${'─'.repeat(Math.max(0, 60 - archivo.length))}`)
  const desde = Date.now()
  const corrida = spawnSync(process.execPath, [archivo], {
    cwd: RAIZ,
    stdio: 'inherit',
    timeout: TOPE_POR_PORTON,
  })
  const segundos = Math.round((Date.now() - desde) / 1000)
  if (corrida.status === 0) {
    console.log(`✓ ${archivo} (${segundos} s)`)
  } else {
    const motivo = corrida.error
      ? corrida.error.message
      : corrida.signal
        ? `cortado con ${corrida.signal}`
        : `salió con ${corrida.status}`
    console.log(`✗ ${archivo} (${segundos} s): ${motivo}`)
    fallados.push(archivo)
  }
}

if (fallados.length > 0) {
  console.error(`\nFallaron ${fallados.length} de ${lista.length}: ${fallados.join(', ')}.`)
  process.exit(1)
}
console.log(`\nLos ${lista.length} portones pasaron.`)
