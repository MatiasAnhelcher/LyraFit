/**
 * Las cuatro rutinas por grupo muscular.
 *
 * Son el pedido más repetido del dueño y el que más lejos estaba del modelo:
 * una rutina de esta app dice "hoy toca empuje" y el ejercicio sale del
 * eslabón que tengas. Cuatro bloques de empuje traerían cuatro veces el mismo
 * ejercicio, que no es un día de pecho: es una serie de pecho repetida.
 *
 * Lo que las hace posibles son las dos clases de bloque nuevas —volumen en el
 * eslabón anterior, y accesorio fijo con barra— y lo que estos tests fijan es
 * que esas dos clases no puedan romper nada de lo que ya andaba.
 */

import { describe, expect, it } from 'vitest'
import { CADENAS, EJERCICIOS, FUERA_DE_CADENA, POR_ID, cadenaDe } from './biblioteca'
import { ejercicioDelBloque } from './bajada'
import { RUTINAS, RUTINAS_POR_GRUPO, RUTINA_POR_ID, advertenciaDe } from './rutinas'
import { avanceInicial } from './progresion'
import { curvaDeFuerza, laVezPasada } from './estadisticas'
import type { Avance, Patron } from './tipos'

const PATRONES: Patron[] = ['empuje', 'traccion', 'piernas', 'core', 'bisagra']

/** Alguien en el medio de cada cadena, que es donde el volumen tiene sentido. */
function avancesEnElMedio(): Map<Patron, Avance> {
  const m = new Map<Patron, Avance>()
  for (const p of PATRONES) {
    const cadena = cadenaDe(p)
    const medio = cadena.ejercicios[Math.floor(cadena.ejercicios.length / 2)]!
    const e = POR_ID.get(medio)!
    m.set(p, {
      ...avanceInicial(cadena, POR_ID, 0),
      ejercicioId: e.id,
      objetivoActual: { series: e.series, cantidad: e.ventana.min },
    })
  }
  return m
}

/** Y alguien recién empezado: primer eslabón de todo, sin nada debajo. */
function avancesAlPrincipio(): Map<Patron, Avance> {
  const m = new Map<Patron, Avance>()
  for (const p of PATRONES) {
    m.set(p, avanceInicial(cadenaDe(p), POR_ID, 0))
  }
  return m
}

const porGrupo = RUTINAS.filter((r) => RUTINAS_POR_GRUPO.has(r.id))

function armar(rutinaId: string, avances: Map<Patron, Avance>, tieneBarraCargable: boolean) {
  const rutina = RUTINA_POR_ID.get(rutinaId)!
  return rutina.bloques.flatMap((b) => {
    const r = ejercicioDelBloque(b, avances.get(b.patron), POR_ID, cadenaDe(b.patron), {
      tieneBarraCargable,
    })
    return r ? [r] : []
  })
}

describe('las cuatro existen y dicen lo que cuestan', () => {
  it('son cuatro, y las cuatro están declaradas', () => {
    expect(porGrupo.map((r) => r.id).sort()).toEqual([
      'grupo-brazos',
      'grupo-espalda',
      'grupo-pecho-core',
      'grupo-piernas',
    ])
    expect(RUTINAS_POR_GRUPO.size).toBe(4)
  })

  it('las cuatro advierten el costo, y ninguna otra lo hace', () => {
    // El costo es real y va en pantalla: partir en cuatro días entrena cada
    // grupo UNA vez por semana, y con el mismo volumen semanal la evidencia
    // favorece dos. Decirlo es la diferencia entre ofrecer una opción y
    // venderla.
    for (const r of RUTINAS) {
      const dicho = advertenciaDe(r)
      if (RUTINAS_POR_GRUPO.has(r.id)) {
        expect(dicho, r.id).toBeTruthy()
        expect(dicho, r.id).toContain('una vez por semana')
      } else {
        expect(dicho, r.id).toBeNull()
      }
    }
  })
})

describe('cada día trae ejercicios DISTINTOS', () => {
  it('ningún ejercicio aparece dos veces en la misma sesión', () => {
    // Es la razón de ser de las dos clases de bloque nuevas. Sin ellas, los
    // cuatro bloques de empuje del día de pecho traerían cuatro veces el
    // mismo ejercicio y la sesión sería una serie repetida.
    for (const r of porGrupo) {
      for (const avances of [avancesEnElMedio(), avancesAlPrincipio()]) {
        for (const barra of [true, false]) {
          const armada = armar(r.id, avances, barra)
          const ids = armada.map((x) => x.ejercicio.id)
          expect(new Set(ids).size, `${r.id} repite: ${ids.join(', ')}`).toBe(ids.length)
        }
      }
    }
  })

  it('en el medio de las cadenas, cada día trae al menos cuatro ejercicios', () => {
    for (const r of porGrupo) {
      expect(armar(r.id, avancesEnElMedio(), true).length, r.id).toBeGreaterThanOrEqual(4)
    }
  })
})

describe('sin barra cargable, siguen funcionando', () => {
  it('ninguna queda vacía, y los accesorios con barra desaparecen', () => {
    // Una rutina que no se puede hacer sin comprar algo no es una opción: es
    // una publicidad. Sin barra quedan los bloques de cadena y de volumen.
    for (const r of porGrupo) {
      const armada = armar(r.id, avancesEnElMedio(), false)
      expect(armada.length, `${r.id} quedó vacía sin barra`).toBeGreaterThan(0)
      for (const { ejercicio } of armada) {
        expect(FUERA_DE_CADENA.has(ejercicio.id), `${ejercicio.id} necesita barra`).toBe(false)
      }
    }
  })

  it('el día de brazos sin barra igual trae algo de brazo', () => {
    // Es el caso límite: los dos ejercicios directos de brazo son con barra.
    // Lo que queda son los bloques de volumen de tracción y empuje, que es
    // bíceps y tríceps con otro ángulo. Si un día alguien saca esos bloques,
    // este test dice que el día de brazos se quedó sin brazos.
    const armada = armar('grupo-brazos', avancesEnElMedio(), false)
    expect(armada.length).toBeGreaterThanOrEqual(2)
  })
})

describe('un accesorio no mueve la cadena, que es lo que lo hace seguro', () => {
  it('ningún accesorio es el eslabón actual de su patrón', () => {
    /*
     * De esto depende que los accesorios no rompan el motor, y no hace falta
     * un `if` nuevo para lograrlo: `cerrarSesion` solo progresa un patrón "si
     * se entrenó el ejercicio que tocaba". Mientras un accesorio nunca SEA el
     * que tocaba, sus series se guardan, cuentan para el mapa muscular y para
     * el volumen, y no mueven un eslabón.
     *
     * Un bloque de volumen es el eslabón ANTERIOR y un accesorio fijo no está
     * en ninguna cadena, así que ninguno de los dos puede coincidir. Esto lo
     * verifica sobre las cuatro rutinas y en los dos extremos de cadena.
     */
    for (const r of porGrupo) {
      for (const avances of [avancesEnElMedio(), avancesAlPrincipio()]) {
        const rutina = RUTINA_POR_ID.get(r.id)!
        for (const b of rutina.bloques) {
          const resuelto = ejercicioDelBloque(b, avances.get(b.patron), POR_ID, cadenaDe(b.patron), {
            tieneBarraCargable: true,
          })
          if (!resuelto?.accesorio) continue
          expect(
            resuelto.ejercicio.id,
            `${r.id}: el accesorio ${resuelto.ejercicio.id} ES el eslabón actual y va a mover la cadena`,
          ).not.toBe(avances.get(b.patron)!.ejercicioId)
        }
      }
    }
  })

  it('en el primer eslabón no hay volumen que sacar, y no se inventa', () => {
    // `bajadaDe` devuelve null y el bloque simplemente no se dibuja. Es una
    // situación normal —alguien que recién empieza— y no un error.
    const alPrincipio = avancesAlPrincipio()
    const conVolumen = RUTINA_POR_ID.get('grupo-pecho-core')!.bloques.filter((b) => b.volumen)
    expect(conVolumen.length).toBeGreaterThan(0)
    for (const b of conVolumen) {
      const r = ejercicioDelBloque(b, alPrincipio.get(b.patron), POR_ID, cadenaDe(b.patron), {
        tieneBarraCargable: true,
      })
      expect(r).toBeNull()
    }
  })
})

describe('los accesorios que las rutinas nombran existen de verdad', () => {
  it('todo ejercicioId de toda rutina está en la biblioteca', () => {
    // El error más barato de cometer y el más caro de encontrar: un id con
    // una letra de más deja el bloque sin dibujar y la sesión sin un
    // ejercicio, en silencio.
    const ids = new Set(EJERCICIOS.map((e) => e.id))
    for (const r of RUTINAS) {
      for (const b of r.bloques) {
        if (!b.ejercicioId) continue
        expect(ids.has(b.ejercicioId), `${r.id} → ${b.ejercicioId}`).toBe(true)
      }
    }
  })

  it('y el patrón del bloque coincide con el del ejercicio', () => {
    // Si no coincidieran, el glifo de color de la fila diría una cadena y el
    // ejercicio sería de otra.
    for (const r of RUTINAS) {
      for (const b of r.bloques) {
        if (!b.ejercicioId) continue
        expect(POR_ID.get(b.ejercicioId)!.patron, `${r.id} → ${b.ejercicioId}`).toBe(b.patron)
      }
    }
  })

  it('un bloque no puede ser accesorio Y volumen a la vez', () => {
    // Serían dos respuestas distintas a la misma pregunta, y `ejercicioDelBloque`
    // resolvería la primera en silencio.
    for (const r of RUTINAS) {
      for (const b of r.bloques) {
        expect(Boolean(b.ejercicioId) && Boolean(b.volumen), r.id).toBe(false)
      }
    }
  })
})

describe('el tope de filas de Hoy', () => {
  it('ninguna rutina tiene menos bloques que el tope, ni tantos que la cuenta mienta', () => {
    /*
     * Hoy dibuja como mucho cuatro filas y cuenta el resto en un renglón.
     * El tope existe por la regla del pliegue: en 360×640, `Empezar` tiene
     * exactamente doce píxeles de aire con cuatro filas, y cada fila mide 56.
     *
     * Lo que este test protege es la cuenta: si una rutina tuviera veinte
     * bloques, el renglón diría "y 16 ejercicios más" y la pantalla dejaría
     * de ser un resumen para ser un acertijo. Cinco o seis está bien; más que
     * eso hay que repensar la rutina, no la pantalla.
     */
    for (const r of RUTINAS) {
      expect(r.bloques.length, `${r.id} tiene demasiados bloques`).toBeLessThanOrEqual(6)
    }
  })
})

describe('las cadenas siguen intactas', () => {
  it('ninguna rutina nueva agregó un ejercicio a una cadena', () => {
    const enCadenas = new Set(CADENAS.flatMap((c) => c.ejercicios))
    for (const id of FUERA_DE_CADENA) expect(enCadenas.has(id)).toBe(false)
  })
})

describe('qué hacen los accesorios con los datos', () => {
  it('la vara SÍ los ve, y la curva de fuerza NO', () => {
    /*
     * De estas dos cosas juntas depende que los accesorios funcionen, y son
     * contrarias entre sí, así que conviene que estén fijadas en un test y no
     * en la cabeza de alguien.
     *
     * LA VARA los ve, porque es la única progresión que tienen: el motor no
     * los mueve —no son el eslabón que tocaba— así que la doble progresión la
     * lleva la persona, y lo que la sostiene es el número de la última vez
     * puesto delante. Si `laVezPasada` los salteara, un accesorio arrancaría
     * siempre en el piso de su ventana y nunca progresaría.
     *
     * LA CURVA no los ve, porque el punto del día es la mejor marca de la
     * cadena y un curl con diez kilos puede dar un índice más alto que una
     * dominada. Darle el punto atribuiría la sesión al ejercicio equivocado,
     * que es exactamente el motivo por el que existe la marca `bajada`.
     */
    const sesion = {
      id: 's1',
      fecha: '2026-03-10',
      tipo: 'plan' as const,
      finalizadaEn: 1,
      duracionSegundos: 600,
      registros: [
        {
          ejercicioId: 'curl-barra',
          objetivo: { series: 3, cantidad: 10, kg: 15 },
          series: [{ logrado: 12, kg: 15 }],
          bajada: true as const,
        },
      ],
    }
    expect(laVezPasada([sesion], 'curl-barra', '2026-03-11')?.mejor).toBe(12)
    expect(curvaDeFuerza([sesion], 'traccion')).toEqual([])
  })
})
