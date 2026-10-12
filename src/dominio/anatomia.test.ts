import { describe, expect, it } from 'vitest'
import { ALTO, ANCHO, ESPALDA, FRENTE, SILUETA, TINTA } from './anatomia'
import { APORTE, NOMBRE_MUSCULO, type Musculo } from './musculos'

/** Los números de un path, para poder medirlo sin interpretarlo. */
function coordenadas(d: string): { xs: number[]; ys: number[] } {
  const numeros = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
  const xs: number[] = []
  const ys: number[] = []
  numeros.forEach((n, i) => (i % 2 === 0 ? xs : ys).push(n))
  return { xs, ys }
}

const DIBUJADOS = new Set<string>([...Object.keys(FRENTE), ...Object.keys(ESPALDA)])

describe('el cuerpo del mapa muscular', () => {
  it('los dieciocho músculos están dibujados en alguna vista', () => {
    // Es el agujero que este archivo puede tener sin que se note: alguien
    // agrega un músculo a la matriz, el mapa lo ignora en silencio y el
    // ejercicio que lo entrena se dibuja como si no entrenara nada.
    const faltan = (Object.keys(NOMBRE_MUSCULO) as Musculo[]).filter((m) => !DIBUJADOS.has(m))
    expect(faltan, `sin dibujar: ${faltan.join(', ')}`).toEqual([])
  })

  it('no hay dibujado ningún músculo que la matriz no conozca', () => {
    const sobran = [...DIBUJADOS].filter((m) => !(m in NOMBRE_MUSCULO))
    expect(sobran, `dibujados de más: ${sobran.join(', ')}`).toEqual([])
  })

  it('cada músculo está en la vista donde se ve, y no en las dos salvo que corresponda', () => {
    // Tres se ven de los dos lados y están en los dos a propósito: el
    // antebrazo y el hombro de costado porque el brazo cuelga al costado del
    // cuerpo, y el gemelo porque la pantorrilla se reconoce igual de frente
    // que de espaldas — de frente, en rigor, se ve el tibial, pero pintar la
    // pierna de abajo es lo que hace que alguien entienda "esto trabaja acá".
    //
    // Si mañana el pectoral aparece también de espaldas, eso SÍ es un error de
    // copiado, y este test lo nombra.
    const enLasDos = [...DIBUJADOS].filter((m) => m in FRENTE && m in ESPALDA).sort()
    expect(enLasDos).toEqual(['antebrazo', 'deltoide-lateral', 'gemelo'])
  })

  it('todos los trazos están cerrados y empiezan donde tienen que empezar', () => {
    for (const [musculo, d] of [...Object.entries(FRENTE), ...Object.entries(ESPALDA)]) {
      expect(d.startsWith('M'), musculo).toBe(true)
      expect(d.trim().endsWith('Z'), musculo).toBe(true)
    }
    expect(SILUETA.startsWith('M')).toBe(true)
    expect(SILUETA.trim().endsWith('Z')).toBe(true)
  })

  it('nada se sale del lienzo, y nada cruza el eje del espejo', () => {
    // Un número tipeado de más —350 en vez de 35— no rompe nada: dibuja una
    // mancha fuera de cuadro que solo se ve mirando. Esto lo agarra.
    //
    // El eje está en x = 50 y se dibuja media persona. La silueta es la única
    // que puede pasarse, y a propósito: se dibuja un poco cruzada y el
    // componente le recorta lo que sobra para que el contorno no deje una
    // costura por el medio de la cabeza.
    for (const [musculo, d] of [...Object.entries(FRENTE), ...Object.entries(ESPALDA)]) {
      const { xs, ys } = coordenadas(d)
      expect(Math.min(...xs), `${musculo} cruza el eje`).toBeGreaterThanOrEqual(ANCHO / 2)
      expect(Math.max(...xs), `${musculo} se sale a lo ancho`).toBeLessThanOrEqual(ANCHO)
      expect(Math.min(...ys), `${musculo} se sale por arriba`).toBeGreaterThanOrEqual(0)
      expect(Math.max(...ys), `${musculo} se sale por abajo`).toBeLessThanOrEqual(ALTO)
    }
  })

  it('la silueta cruza el eje, que es lo que mata la costura', () => {
    const { xs, ys } = coordenadas(SILUETA)
    expect(Math.min(...xs)).toBeLessThan(ANCHO / 2)
    expect(Math.max(...xs)).toBeLessThanOrEqual(ANCHO)
    expect(Math.max(...ys)).toBeLessThanOrEqual(ALTO)
  })

  it('las tres intensidades se distinguen a ojo', () => {
    // Si el estabilizador y el primario quedan cerca, el mapa deja de decir
    // cuál es el que falla y pasa a decir "acá trabaja todo", que es
    // exactamente lo que hace un mapa muscular decorativo.
    expect(TINTA[1] - TINTA[0.5]).toBeGreaterThan(0.3)
    expect(TINTA[0.5] - TINTA[0.25]).toBeGreaterThan(0.2)
  })

  it('cualquier ejercicio de la matriz se puede dibujar entero', () => {
    // La prueba de fuego: que no exista un ejercicio cuyo vector mencione un
    // músculo que el cuerpo no sabe pintar.
    for (const [id, vector] of Object.entries(APORTE)) {
      for (const musculo of Object.keys(vector)) {
        expect(DIBUJADOS.has(musculo), `${id} usa ${musculo} y no está dibujado`).toBe(true)
      }
    }
  })
})
