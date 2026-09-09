import { describe, expect, it } from 'vitest'
import { EJERCICIOS } from './biblioteca'
import { POSTURAS } from './posturas'
import {
  ALTO_CUERPO,
  ALTURA_BARRA,
  PISO,
  entre,
  puntoDeApoyo,
  todos,
  ubicar,
  type Figura,
  type Postura,
} from './figuras'

/**
 * Que los dibujos cierren, sin mirarlos.
 *
 * Un dibujo malo se ve en un segundo, pero son treinta y nueve ejercicios por
 * dos posturas y revisarlos a ojo cada vez que se toca algo no escala. Lo bueno
 * de que las figuras sean números es que los defectos típicos —el pie flotando
 * en el aire, la mano despegada de la barra a mitad del movimiento, una pierna
 * atravesando el piso— son desigualdades, y una desigualdad se comprueba sola.
 *
 * Esto no reemplaza mirar: que los números cierren no garantiza que la postura
 * se parezca al ejercicio. Lo que hace es que mirar sirva para juzgar el
 * parecido en vez de para cazar errores de aritmética.
 */

/** Un poco de tolerancia: son dibujos, no un motor de física. */
const HOLGURA = 4

const cada = (f: Figura): [string, Postura][] => [
  ['inicio', f.inicio],
  ['fin', f.fin],
]

/**
 * Los que todavía no tienen dibujo.
 *
 * Escrita a mano y no calculada, a propósito. Así la lista solo puede
 * achicarse: agregar un ejercicio sin dibujarlo hace fallar el test, y dibujar
 * uno que está en la lista también lo hace fallar hasta que se lo saque. El día
 * que quede vacía, esto pasa a ser la comprobación estricta sin que nadie la
 * toque.
 *
 * Es deuda declarada, que es distinto de deuda escondida: el test verde no dice
 * "está todo dibujado", dice "está dibujado todo lo que dijimos que iba a estar".
 */
const SIN_DIBUJO_TODAVIA = new Set<string>([])

describe('las figuras de los ejercicios', () => {
  it('no falta ningún dibujo sin que esté declarado', () => {
    const sinDibujo = EJERCICIOS.filter((e) => !POSTURAS[e.id]).map((e) => e.id)
    expect(
      sinDibujo.filter((id) => !SIN_DIBUJO_TODAVIA.has(id)),
      'ejercicios sin dibujo y sin declarar en SIN_DIBUJO_TODAVIA',
    ).toEqual([])
  })

  it('la lista de pendientes no se queda vieja', () => {
    expect(
      [...SIN_DIBUJO_TODAVIA].filter((id) => POSTURAS[id]),
      'ya tienen dibujo: sacalos de SIN_DIBUJO_TODAVIA',
    ).toEqual([])
  })

  it('no dibujan ejercicios que no existen', () => {
    const ids = new Set(EJERCICIOS.map((e) => e.id))
    expect(Object.keys(POSTURAS).filter((id) => !ids.has(id))).toEqual([])
  })

  for (const ejercicio of EJERCICIOS) {
    const figura = POSTURAS[ejercicio.id]
    if (!figura) continue

    describe(ejercicio.nombre, () => {
      it('apoya donde dice que apoya', () => {
        for (const [cual, postura] of cada(figura)) {
          const e = ubicar(postura, figura.apoyo, figura.inicio)
          if (figura.apoyo === 'colgado') {
            // Colgado el apoyo es lo más ALTO: las manos en la barra.
            expect(Math.abs(e.muñeca.y - ALTURA_BARRA), `${cual}: la mano no está en la barra`)
              .toBeLessThan(HOLGURA)
          } else {
            const masBajo = Math.max(...todos(e).map((p) => p.y))
            expect(masBajo, `${cual}: el cuerpo no llega al piso o lo atraviesa`)
              .toBeGreaterThan(PISO - HOLGURA)
          }
        }
      })

      it('no atraviesa el piso', () => {
        for (const [cual, postura] of cada(figura)) {
          const e = ubicar(postura, figura.apoyo, figura.inicio)
          const hundido = todos(e).filter((p) => p.y > PISO + HOLGURA)
          expect(hundido.length, `${cual}: ${hundido.length} puntos por debajo del piso`).toBe(0)
        }
      })

      it('lo que se apoya no se desliza durante el movimiento', () => {
        // El defecto más feo de una animación así: la mano que patina por el
        // piso, o el pie que se corre mientras la persona baja. Se mide sobre
        // el recorrido entero y no solo en los extremos, porque una
        // interpolación puede pasar por lugares que ninguna de las dos puntas
        // muestra.
        const seguidos = [0, 0.25, 0.5, 0.75, 1].map((t) =>
          ubicar(entre(figura.inicio, figura.fin, t), figura.apoyo, figura.inicio),
        )
        const xs = seguidos.map((e) => puntoDeApoyo(e, figura.apoyo).x)
        const corrimiento = Math.max(...xs) - Math.min(...xs)
        // Un décimo de la altura del cuerpo. Más que eso ya se ve como que
        // patina; menos es el juego natural de un dibujo de líneas.
        expect(corrimiento, 'el apoyo patina durante el movimiento').toBeLessThan(ALTO_CUERPO * 0.1)
      })

      it('tiene dos posturas distintas, o dice por qué no', () => {
        const iguales = (Object.keys(figura.inicio) as (keyof Postura)[]).every(
          (k) => figura.inicio[k] === figura.fin[k],
        )
        expect(iguales, 'inicio y fin son idénticos: no hay nada que mostrar').toBe(false)
      })

      it('el lado lejano está completo o no está', () => {
        // Media pierna lejana dibuja un muñón. O están los tres ángulos o
        // ninguno, y tienen que estar en las dos posturas: si aparece a mitad
        // del recorrido, la pierna brota de la nada.
        for (const lado of [
          ['musloLejos', 'pantorrillaLejos'],
          ['brazoLejos', 'antebrazoLejos'],
        ] as const) {
          for (const [cual, postura] of cada(figura)) {
            const puestos = lado.filter((k) => postura[k] !== undefined)
            expect(puestos.length === 0 || puestos.length === lado.length, `${cual}: ${lado[0]}`)
              .toBe(true)
          }
          const enInicio = figura.inicio[lado[0]] !== undefined
          const enFin = figura.fin[lado[0]] !== undefined
          expect(enInicio, `${lado[0]} tiene que estar en las dos posturas o en ninguna`)
            .toBe(enFin)
        }
      })

      it('la escena y el apoyo no se contradicen', () => {
        // Si la escena levanta las manos sobre un cajón, lo que toca el piso
        // son los pies, y al revés. Declararlo cruzado es el error que hundió
        // media figura bajo el piso, y es una contradicción que se puede
        // comprobar sola en vez de descubrirla mirando.
        if (figura.escena === 'apoyo-manos') {
          expect(figura.apoyo, 'con las manos en alto, lo que apoya son los pies').toBe('pies')
        }
        if (figura.escena === 'apoyo-pies') {
          expect(figura.apoyo, 'con los pies en alto, lo que apoya son las manos').toBe('manos')
        }
        if (figura.escena === 'barra') {
          expect(figura.apoyo, 'de una barra alta se cuelga').toBe('colgado')
        }
      })

      it('mira para el lado que tiene que mirar', () => {
        // El error que se me escapó en los cuatro remos, y que dije que ningún
        // test podía cazar. Me equivoqué: sí se puede, y así.
        //
        // La persona siempre mira a la derecha, así que el hombro no puede
        // quedar francamente detrás de la cadera. Un torso de 132 grados lo
        // pone arriba y a la IZQUIERDA: es la figura espejada, y una figura
        // espejada apoya igual de bien en el piso, no atraviesa nada y no
        // patina, así que todas las demás comprobaciones la dejaban pasar.
        //
        // El límite no es noventa sino ciento quince, y la diferencia importa:
        // colgado de una barra subiendo las piernas uno SÍ se recuesta un poco
        // hacia atrás, y noventa y seis grados es eso. Ciento treinta ya no es
        // recostarse, es estar dado vuelta.
        for (const [cual, postura] of cada(figura)) {
          const grados = ((postura.torso % 360) + 360) % 360
          const pasado = grados > 115 && grados < 245
          expect(pasado, `${cual}: torso ${postura.torso}° — la figura está espejada`).toBe(false)
        }
      })

      it('el gesto dice algo', () => {
        expect(figura.gesto.length).toBeGreaterThan(20)
        expect(figura.gesto.trim().endsWith('.')).toBe(true)
      })
    })
  }
})
