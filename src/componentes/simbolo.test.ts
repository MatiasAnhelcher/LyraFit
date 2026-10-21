/**
 * Ningún glifo librado a la letra del teléfono.
 *
 * Inter y Sora no traen ✓ ✕ ◆ ◇ ◈ → ← ↔ ◷ ★ ⟳ ≈, y Sora tampoco trae ↑: escritos
 * como texto, cada teléfono los dibuja con su propia fuente, y un ◆ de Roboto
 * al lado de un rombo de Apple no son el mismo signo. Se dibujan con
 * `<Simbolo>`. Esto recorre `src/` y falla si alguno vuelve a escribirse
 * como carácter.
 *
 * Quedan afuera `src/dominio/`, que es el texto fuente que `<Simbolo>`
 * traduce al dibujar (`GLIFO_CLASE`, por ejemplo), y los comentarios, que no
 * se dibujan. Para saber qué es comentario no alcanza con buscar `//`: está
 * en cada dirección web y en más de una expresión regular. Se recorre el
 * texto como lo recorre el compilador —cadenas, plantillas y comentarios—, y
 * una cadena que no cierra termina con su línea, como en TypeScript, para que
 * un apóstrofo suelto en un texto de JSX no se trague el resto del archivo.
 */

import { describe, expect, it } from 'vitest'

/** Escritos con su código y no con el carácter, para no encontrarse a sí mismos. */
const CODIGOS = [0x2713, 0x2715, 0x25c6, 0x25c7, 0x25c8, 0x2192, 0x2190, 0x2194, 0x25f7, 0x2605, 0x27f3, 0x2248, 0x2191]
const GLIFOS = new Set(CODIGOS.map((c) => String.fromCodePoint(c)))

const FUENTES = import.meta.glob<string>(['../**/*.{ts,tsx,css}', '!../dominio/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

/**
 * El texto sin sus comentarios, con cada comentario cambiado por espacios del
 * mismo largo: así las líneas de lo que queda siguen siendo las del archivo.
 */
function sinComentarios(texto: string, css = false): string {
  const salida = texto.split('')
  const borrar = (desde: number, hasta: number) => {
    for (let k = desde; k < hasta; k++) if (salida[k] !== '\n') salida[k] = ' '
  }
  let i = 0
  // Las llaves abiertas adentro de cada `${` de una plantilla: al cerrarse la
  // última, se vuelve a la plantilla.
  const plantillas: number[] = []

  const plantilla = () => {
    while (i < texto.length) {
      const c = texto[i]
      if (c === '\\') i += 2
      else if (c === '`') {
        i++
        return
      } else if (c === '$' && texto[i + 1] === '{') {
        i += 2
        plantillas.push(0)
        return
      } else i++
    }
  }

  while (i < texto.length) {
    const c = texto[i]
    const sigue = texto[i + 1]
    if (c === '/' && sigue === '*') {
      const fin = texto.indexOf('*/', i + 2)
      const hasta = fin === -1 ? texto.length : fin + 2
      borrar(i, hasta)
      i = hasta
    } else if (!css && c === '/' && sigue === '/') {
      const fin = texto.indexOf('\n', i)
      const hasta = fin === -1 ? texto.length : fin
      borrar(i, hasta)
      i = hasta
    } else if (c === "'" || c === '"') {
      i++
      while (i < texto.length && texto[i] !== c && texto[i] !== '\n') i += texto[i] === '\\' ? 2 : 1
      i++
    } else if (!css && c === '`') {
      i++
      plantilla()
    } else if (!css && plantillas.length > 0 && c === '{') {
      plantillas[plantillas.length - 1]!++
      i++
    } else if (!css && plantillas.length > 0 && c === '}') {
      i++
      if (plantillas[plantillas.length - 1] === 0) {
        plantillas.pop()
        plantilla()
      } else plantillas[plantillas.length - 1]!--
    } else i++
  }
  return salida.join('')
}

function glifosEn(archivo: string, texto: string): string[] {
  const limpio = sinComentarios(texto, archivo.endsWith('.css'))
  return limpio.split('\n').flatMap((linea, n) =>
    [...linea].filter((c) => GLIFOS.has(c)).map((c) => `${archivo}:${n + 1} ${c}`),
  )
}

describe('los símbolos', () => {
  it('ningún glifo de §3.3 se escribe como carácter fuera del dominio y de los comentarios', () => {
    const archivos = Object.keys(FUENTES)
    // Si el patrón dejara de encontrar archivos, el portón pasaría sin mirar.
    expect(archivos.length).toBeGreaterThan(50)
    expect(archivos.some((a) => a.includes('/dominio/'))).toBe(false)
    const hallazgos = archivos.flatMap((archivo) =>
      glifosEn(archivo.replace(/^\.\.\//, 'src/').replace(/^\.\//, 'src/componentes/'), FUENTES[archivo]!),
    )
    expect(hallazgos).toEqual([])
  })

  it('el recorrido distingue el código de los comentarios', () => {
    const [tilde, arriba, derecha, rombo, vacio, estrella] = [0x2713, 0x2191, 0x2192, 0x25c6, 0x25c7, 0x2605].map(
      (c) => String.fromCodePoint(c),
    )
    const tsx = [
      `// ${tilde} en un comentario no cuenta`,
      `const a = "${tilde}" // y este ${rombo} tampoco`,
      `const b = <p>Subís ${arriba}</p>`,
      `const c = \`${derecha} \${a ? '${rombo}' : \`${vacio}\`}\``,
      `/* ${rombo} */ const d = <p>{/* ${vacio} ni este */}No hay barra</p>`,
      `const e = 'https://lyrafit.app' + "${estrella}"`,
      `const f = <p>Es lo que hay. It's ${tilde}</p>`,
      `const g = 1`,
    ].join('\n')
    expect(glifosEn('x.tsx', tsx)).toEqual([
      `x.tsx:2 ${tilde}`,
      `x.tsx:3 ${arriba}`,
      `x.tsx:4 ${derecha}`,
      `x.tsx:4 ${rombo}`,
      `x.tsx:4 ${vacio}`,
      `x.tsx:6 ${estrella}`,
      `x.tsx:7 ${tilde}`,
    ])
    expect(glifosEn('x.css', `/* ${estrella} */\n.a::before { content: '${estrella}'; }`)).toEqual([
      `x.css:2 ${estrella}`,
    ])
  })
})
