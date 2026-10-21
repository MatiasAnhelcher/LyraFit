import type { Opcion, Tramo } from '@/dominio/reloj'

/** Escribe el logro de una vuelta. Fuera del componente para no recrearla. */
export function anotar(
  set: React.Dispatch<React.SetStateAction<(number | null)[]>>,
  vuelta: number,
  cuanto: (previo: number | null) => number,
) {
  set((previos) => previos.map((n, i) => (i === vuelta ? cuanto(n) : n)))
}

// ─────────────────────────────────────────────────────────────────────────

/** El ejercicio que le toca a una vuelta. */
export function opcionDeVuelta(
  plan: readonly Tramo[],
  opciones: readonly Opcion[],
  vuelta: number,
): Opcion | undefined {
  const tramo = plan.find((t) => t.clase === 'trabajo' && t.vuelta === vuelta)
  if (!tramo || tramo.clase !== 'trabajo') return undefined
  return opciones.find((o) => o.id === tramo.ejercicioId)
}

/**
 * La cuenta de una vuelta: menos, el número, más.
 *
 * El número que se OFRECE va en gris y el que está anotado va en tinta, y la
 * diferencia no es decorativa. La versión anterior mostraba la vuelta anterior
 * en tinta sin haberla guardado: la pantalla decía "doce" y la base guardaba
 * "no contada". Mostrar en gris lo que todavía no es, y en tinta lo que ya es,
 * es la misma regla que usa toda la app para lo que falta.
 */
export function Cuenta({
  vuelta,
  logro,
  sugerido,
  sugeridoEs,
  enSegundos,
  set,
}: {
  vuelta: number
  logro: number | null
  /** Lo que se ofrece sin haberlo guardado: la vuelta anterior del mismo
      ejercicio, o la vuelta entera si es un sostén. */
  sugerido: number | undefined
  sugeridoEs: 'anterior' | 'entera'
  enSegundos: boolean
  set: (cuanto: (previo: number | null) => number) => void
}) {
  const anotado = logro !== null
  const mostrado = logro ?? sugerido
  return (
    <>
      <p className="text-center text-sm text-[var(--color-glosa)]">
        {enSegundos
          ? `¿Cuántos segundos aguantaste en la vuelta ${vuelta + 1}?`
          : `¿Cuántas en la vuelta ${vuelta + 1}?`}
      </p>
      <div className="mt-3 flex items-center justify-center gap-5">
        <button
          onClick={() => set((n) => Math.max(0, (n ?? sugerido ?? 0) - 1))}
          className="paso h-14 w-14 text-2xl"
          aria-label="Restar"
        >
          −
        </button>
        <p
          className="cifra w-24 text-center text-5xl"
          style={anotado ? undefined : { color: 'var(--color-glosa)' }}
        >
          {mostrado ?? '—'}
        </p>
        <button
          onClick={() => set((n) => (n ?? sugerido ?? 0) + 1)}
          className="paso h-14 w-14 text-2xl"
          aria-label="Sumar"
        >
          +
        </button>
      </div>
      {!anotado && sugerido !== undefined && (
        <button
          onClick={() => set(() => sugerido)}
          className="rotulo mt-3 block w-full text-center underline underline-offset-4"
        >
          {sugeridoEs === 'entera' ? 'La aguanté entera' : 'Las mismas que la anterior'}
        </button>
      )}
    </>
  )
}
