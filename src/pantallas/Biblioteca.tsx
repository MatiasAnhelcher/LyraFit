import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CADENAS, NOMBRE_PATRON, POR_ID } from '@/dominio/biblioteca'
import { leerAvances } from '@/datos/repositorio'
import { Cargando, Glifo, Objetivo, Rotulo } from '@/componentes/ui'

/**
 * La biblioteca.
 *
 * Cada cadena entera, en orden, con el eslabón donde estás marcado. Lo que
 * falta no está bloqueado ni tachado: está sin marcar. Se puede leer la ficha
 * de cualquier ejercicio, incluso los que faltan años — saber a dónde lleva el
 * camino es la mitad de las ganas de recorrerlo.
 */
export function Biblioteca() {
  const avances = useLiveQuery(leerAvances, [])
  if (!avances) return <Cargando filas={6} />

  return (
    <>
      <Rotulo>BIBLIOTECA</Rotulo>
      <p className="mt-2 max-w-[40ch] text-xs leading-relaxed text-[var(--color-glosa)]">
        Treinta y nueve ejercicios en cuatro cadenas, de más accesible a más exigente. El eslabón
        donde estás va marcado.
      </p>

      {CADENAS.map((cadena) => {
        const avance = avances.get(cadena.patron)
        const actual = avance ? cadena.ejercicios.indexOf(avance.ejercicioId) : -1

        return (
          <section key={cadena.patron} className="mt-8">
            <div className="flex items-center gap-2">
              <Glifo patron={cadena.patron} />
              <Rotulo>{NOMBRE_PATRON[cadena.patron].toUpperCase()}</Rotulo>
            </div>
            <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-[var(--color-glosa)]">
              {cadena.descripcion}
            </p>

            <div className="registro mt-3">
              {cadena.ejercicios.map((id, i) => {
                const ejercicio = POR_ID.get(id)
                if (!ejercicio) return null
                const aca = i === actual
                const hecho = i < actual

                return (
                  <Link key={id} to={`/biblioteca/${id}`} className="fila-pulsable">
                    <span className="canal" style={aca ? { color: 'var(--color-vega)' } : undefined}>
                      {aca ? '◆' : String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0">
                      <span
                        className="nombre block truncate"
                        style={hecho ? { color: 'var(--color-glosa)' } : undefined}
                      >
                        {ejercicio.nombre}
                      </span>
                      {aca && <span className="rotulo mt-0.5 block">ESTÁS ACÁ</span>}
                    </span>
                    <Objetivo
                      series={ejercicio.series}
                      cantidad={ejercicio.ventana.max}
                      medida={ejercicio.medida}
                    />
                  </Link>
                )
              })}
            </div>
          </section>
        )
      })}
    </>
  )
}
