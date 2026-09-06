import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CADENAS, NOMBRE_PATRON, POR_ID, buscarEjercicio } from '@/dominio/biblioteca'
import { leerAvances } from '@/datos/repositorio'
import { Barra, COLOR_PATRON, Etiqueta, Titulo, unidad } from '@/componentes/ui'
import { porcentajeDeCadena } from '@/dominio/progresion'

export function Biblioteca() {
  const avances = useLiveQuery(leerAvances, [])

  return (
    <>
      <Titulo>Ejercicios</Titulo>
      <p className="-mt-3 mb-6 text-sm leading-relaxed text-[var(--color-texto-suave)]">
        Cuatro cadenas, un patrón de movimiento cada una. Se sube de nivel
        cuando el objetivo está firme, no cuando aburre.
      </p>

      <div className="space-y-8">
        {CADENAS.map((cadena) => {
          const avance = avances?.get(cadena.patron)
          const actual = avance ? buscarEjercicio(avance.ejercicioId) : undefined
          const color = COLOR_PATRON[cadena.patron]

          return (
            <section key={cadena.patron}>
              <div className="mb-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold">{NOMBRE_PATRON[cadena.patron]}</h2>
                  {avance && (
                    <span className="cifra text-sm font-semibold" style={{ color }}>
                      {porcentajeDeCadena(avance, cadena, POR_ID)}%
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-[var(--color-texto-suave)]">
                  {cadena.descripcion}
                </p>
                {avance && (
                  <div className="mt-3">
                    <Barra
                      porcentaje={porcentajeDeCadena(avance, cadena, POR_ID)}
                      color={color}
                    />
                  </div>
                )}
              </div>

              <ol className="space-y-2">
                {cadena.ejercicios.map((id, i) => {
                  const ejercicio = buscarEjercicio(id)
                  if (!ejercicio) return null

                  const esActual = actual?.id === id
                  const superado = actual ? i < cadena.ejercicios.indexOf(actual.id) : false

                  return (
                    <li key={id}>
                      <Link
                        to={`/biblioteca/${id}`}
                        className="tarjeta flex items-center gap-3 p-3 transition hover:border-[var(--color-texto-suave)]"
                        style={esActual ? { borderColor: color } : undefined}
                      >
                        <span
                          className="cifra flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                          style={{
                            backgroundColor: superado
                              ? `color-mix(in srgb, ${color} 18%, transparent)`
                              : 'var(--color-superficie-alta)',
                            color: superado ? color : 'var(--color-texto-suave)',
                          }}
                        >
                          {i + 1}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{ejercicio.nombre}</span>
                          <span className="cifra block text-xs text-[var(--color-texto-suave)]">
                            {ejercicio.objetivo.series}×
                            {unidad(ejercicio.medida, ejercicio.objetivo.cantidad)} para pasar
                          </span>
                        </span>

                        {esActual && <Etiqueta patron={cadena.patron}>Acá estás</Etiqueta>}
                      </Link>
                    </li>
                  )
                })}
              </ol>
            </section>
          )
        })}
      </div>
    </>
  )
}
