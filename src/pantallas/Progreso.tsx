import { useLiveQuery } from 'dexie-react-hooks'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CADENAS, NOMBRE_PATRON, POR_ID, buscarEjercicio } from '@/dominio/biblioteca'
import { porcentajeDeCadena } from '@/dominio/progresion'
import { porSemana, totales } from '@/dominio/estadisticas'
import { fechaISO, leerAvances, leerSesiones } from '@/datos/repositorio'
import { Barra, COLOR_PATRON, Dato, Titulo, Vacio, unidad } from '@/componentes/ui'

/**
 * Los cuatro colores de gráfico, en orden fijo.
 *
 * Fijo quiere decir fijo: el empuje es siempre el primero aunque un día
 * filtres y quede solo. Un color que se reasigna según quién sobrevive al
 * filtro es la forma más rápida de que alguien lea mal su propio progreso.
 */
const COLOR_GRAFICO = [
  'var(--color-grafico-1)',
  'var(--color-grafico-2)',
  'var(--color-grafico-3)',
  'var(--color-grafico-4)',
]

const FORMATO_SEMANA = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' })

function etiquetaSemana(semana: string): string {
  return FORMATO_SEMANA.format(new Date(`${semana}T12:00:00`))
}

interface DatoTooltip {
  active?: boolean
  payload?: { payload: { semana: string; volumen: number; sesiones: number; minutos: number } }[]
}

function Globo({ active, payload }: DatoTooltip) {
  const punto = payload?.[0]?.payload
  if (!active || !punto) return null

  return (
    <div className="tarjeta px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold">Semana del {etiquetaSemana(punto.semana)}</p>
      <p className="cifra mt-1 text-[var(--color-texto-suave)]">
        {punto.volumen} de volumen · {punto.sesiones}{' '}
        {punto.sesiones === 1 ? 'sesión' : 'sesiones'} · {punto.minutos} min
      </p>
    </div>
  )
}

export function Progreso() {
  const sesiones = useLiveQuery(() => leerSesiones(), [])
  const avances = useLiveQuery(leerAvances, [])

  if (!sesiones || !avances) {
    return <p className="py-16 text-center text-[var(--color-texto-suave)]">Cargando…</p>
  }

  const resumen = totales(sesiones, fechaISO())
  const semanas = porSemana(sesiones).slice(-12)

  return (
    <>
      <Titulo>Progreso</Titulo>

      <section className="mb-8 grid grid-cols-2 gap-3">
        <Dato valor={resumen.sesiones} etiqueta="Sesiones" />
        <Dato valor={resumen.racha} etiqueta="Racha de días" />
        <Dato valor={resumen.volumen.toLocaleString('es-AR')} etiqueta="Volumen total" />
        <Dato valor={`${resumen.minutos}`} etiqueta="Minutos entrenados" />
      </section>

      {sesiones.length === 0 ? (
        <Vacio
          titulo="Todavía no hay nada que mostrar"
          texto="Después de la primera sesión vas a ver acá cómo evoluciona tu volumen semana a semana."
        />
      ) : (
        <section className="mb-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-texto-suave)]">
            Volumen por semana
          </h2>
          <p className="mb-4 mt-1 text-xs text-[var(--color-texto-suave)]">
            Repeticiones y segundos de sostén sumados. Últimas {semanas.length} semanas con
            actividad.
          </p>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={semanas} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid
                  vertical={false}
                  stroke="var(--color-grafico-grilla)"
                  strokeDasharray="2 4"
                />
                <XAxis
                  dataKey="semana"
                  tickFormatter={etiquetaSemana}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--color-texto-suave)', fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tick={{ fill: 'var(--color-texto-suave)', fontSize: 11 }}
                />
                <Tooltip
                  content={<Globo />}
                  cursor={{ fill: 'var(--color-superficie-alta)', opacity: 0.6 }}
                />
                <Bar
                  dataKey="volumen"
                  fill="var(--color-grafico-1)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-[var(--color-texto-suave)]">
              Ver los números
            </summary>
            <table className="mt-3 w-full text-left text-xs">
              <thead className="text-[var(--color-texto-suave)]">
                <tr>
                  <th className="py-1 font-medium">Semana</th>
                  <th className="py-1 font-medium">Sesiones</th>
                  <th className="py-1 font-medium">Volumen</th>
                  <th className="py-1 font-medium">Minutos</th>
                </tr>
              </thead>
              <tbody className="cifra">
                {[...semanas].reverse().map((s) => (
                  <tr key={s.semana} className="border-t border-[var(--color-borde)]">
                    <td className="py-1.5">{etiquetaSemana(s.semana)}</td>
                    <td className="py-1.5">{s.sesiones}</td>
                    <td className="py-1.5">{s.volumen}</td>
                    <td className="py-1.5">{s.minutos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-texto-suave)]">
          Avance en cada cadena
        </h2>
        <p className="mb-4 mt-1 text-xs text-[var(--color-texto-suave)]">
          Cuánto recorriste de cada progresión, del primer ejercicio al último.
        </p>

        <ul className="space-y-4">
          {CADENAS.map((cadena, i) => {
            const avance = avances.get(cadena.patron)
            if (!avance) return null

            const ejercicio = buscarEjercicio(avance.ejercicioId)
            const porcentaje = porcentajeDeCadena(avance, cadena, POR_ID)
            const color = COLOR_GRAFICO[i]!

            return (
              <li key={cadena.patron}>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: color }}
                      aria-hidden
                    />
                    {NOMBRE_PATRON[cadena.patron]}
                  </span>
                  <span className="cifra text-sm font-bold">{porcentaje}%</span>
                </div>

                <Barra porcentaje={porcentaje} color={color} />

                {ejercicio && (
                  <p className="mt-2 text-xs text-[var(--color-texto-suave)]">
                    {ejercicio.nombre} ·{' '}
                    <span className="cifra">
                      {avance.objetivoActual.series}×
                      {unidad(ejercicio.medida, avance.objetivoActual.cantidad)}
                    </span>
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {sesiones.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-texto-suave)]">
            Historial
          </h2>
          <ul className="space-y-2">
            {sesiones.slice(0, 20).map((sesion) => (
              <li key={sesion.id} className="tarjeta px-4 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {new Date(`${sesion.fecha}T12:00:00`).toLocaleDateString('es-AR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </span>
                  <span className="cifra text-xs text-[var(--color-texto-suave)]">
                    {Math.round(sesion.duracionSegundos / 60)} min
                  </span>
                </div>
                <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--color-texto-suave)]">
                  {sesion.registros.map((registro) => {
                    const ejercicio = buscarEjercicio(registro.ejercicioId)
                    if (!ejercicio) return null
                    return (
                      <li key={registro.ejercicioId} className="flex items-center gap-1.5">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: COLOR_PATRON[ejercicio.patron] }}
                          aria-hidden
                        />
                        {ejercicio.nombre}{' '}
                        <span className="cifra">
                          {registro.series.map((s) => s.logrado).join('·')}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
