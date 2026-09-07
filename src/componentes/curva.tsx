/**
 * La curva de fuerza.
 *
 * Está en su propio archivo porque es lo único de la app que usa la librería
 * de gráficos, y esa librería pesa casi tanto como el resto junto. Cargándola
 * aparte, quien abre la app para entrenar no baja nada de esto.
 *
 * Los cuatro colores salen de la paleta de gráficos, que es distinta de la de
 * interfaz a propósito: un color pensado para un título sobre papel casi nunca
 * sirve como línea de dos píxeles.
 */

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { NOMBRE_PATRON } from '@/dominio/biblioteca'
import type { PuntoDeFuerza } from '@/dominio/estadisticas'
import type { Patron } from '@/dominio/tipos'

const COLOR: Record<Patron, string> = {
  empuje: 'var(--color-grafico-1)',
  traccion: 'var(--color-grafico-2)',
  piernas: 'var(--color-grafico-3)',
  core: 'var(--color-grafico-4)',
}

const FORMATO = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' })

interface Serie {
  patron: Patron
  puntos: PuntoDeFuerza[]
}

type Fila = { fecha: string } & Partial<Record<Patron, number>>

function combinar(series: Serie[]): Fila[] {
  const porFecha = new Map<string, Fila>()
  for (const { patron, puntos } of series) {
    for (const punto of puntos) {
      const fila = porFecha.get(punto.fecha) ?? { fecha: punto.fecha }
      fila[patron] = Math.round(punto.carga * 100) / 100
      porFecha.set(punto.fecha, fila)
    }
  }
  return [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha))
}

function Globo({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { dataKey?: string | number; value?: number; color?: string }[]
  label?: string
}) {
  if (!active || !payload?.length || !label) return null
  return (
    <div className="border border-[var(--color-regla)] bg-[var(--color-fondo)] px-3 py-2">
      <p className="rotulo">{FORMATO.format(new Date(`${label}T12:00:00`))}</p>
      <ul className="mt-1.5 space-y-0.5">
        {payload.map((p) => (
          <li key={String(p.dataKey)} className="cifra text-xs" style={{ color: p.color }}>
            {NOMBRE_PATRON[p.dataKey as Patron]} · {p.value}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Curva({ series }: { series: Serie[] }) {
  const datos = combinar(series)
  const conDatos = series.filter((s) => s.puntos.length > 0)

  if (datos.length < 2) {
    return (
      <p className="text-sm text-[var(--color-glosa)]">
        Con una sola sesión todavía no hay curva. Después de la segunda empieza a dibujarse.
      </p>
    )
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} stroke="var(--color-grafico-grilla)" strokeDasharray="2 4" />
          <XAxis
            dataKey="fecha"
            tickFormatter={(f: string) => FORMATO.format(new Date(`${f}T12:00:00`))}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--color-glosa)', fontSize: 10 }}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={40}
            tick={{ fill: 'var(--color-glosa)', fontSize: 10 }}
            domain={['dataMin - 0.1', 'dataMax + 0.1']}
          />
          <Tooltip content={<Globo />} cursor={{ stroke: 'var(--color-regla)' }} />
          {conDatos.map(({ patron }) => (
            <Line
              key={patron}
              type="monotone"
              dataKey={patron}
              stroke={COLOR[patron]}
              strokeWidth={1.75}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
