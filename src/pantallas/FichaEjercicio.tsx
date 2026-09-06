import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { buscarEjercicio, cadenaDe, NOMBRE_PATRON } from '@/dominio/biblioteca'
import { historicoDeEjercicio, recordDe } from '@/dominio/estadisticas'
import { fijarNivel, leerAvances, leerSesiones } from '@/datos/repositorio'
import { Boton, COLOR_PATRON, Etiqueta, unidad } from '@/componentes/ui'
import { IconoAtras } from '@/componentes/iconos'

export function FichaEjercicio() {
  const { id } = useParams<{ id: string }>()
  const navegar = useNavigate()
  const avances = useLiveQuery(leerAvances, [])
  const sesiones = useLiveQuery(() => leerSesiones(), [])

  const ejercicio = id ? buscarEjercicio(id) : undefined

  if (!ejercicio) {
    return (
      <>
        <p className="py-16 text-center text-[var(--color-texto-suave)]">
          Ese ejercicio no existe.
        </p>
        <Boton variante="secundario" className="w-full" onClick={() => navegar('/biblioteca')}>
          Volver a la biblioteca
        </Boton>
      </>
    )
  }

  const cadena = cadenaDe(ejercicio.patron)
  const posicion = cadena.ejercicios.indexOf(ejercicio.id)
  const color = COLOR_PATRON[ejercicio.patron]
  const avance = avances?.get(ejercicio.patron)
  const esActual = avance?.ejercicioId === ejercicio.id
  const record = sesiones ? recordDe(sesiones, ejercicio.id) : 0
  const historico = sesiones ? historicoDeEjercicio(sesiones, ejercicio.id) : []

  return (
    <>
      <Link
        to="/biblioteca"
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-texto-suave)]"
      >
        <IconoAtras className="h-5 w-5" />
        Ejercicios
      </Link>

      <Etiqueta patron={ejercicio.patron}>
        {NOMBRE_PATRON[ejercicio.patron]} · nivel {posicion + 1} de {cadena.ejercicios.length}
      </Etiqueta>

      <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight">
        {ejercicio.nombre}
      </h1>
      <p className="mt-3 leading-relaxed text-[var(--color-texto-suave)]">{ejercicio.resumen}</p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="tarjeta px-3 py-4 text-center">
          <p className="cifra text-xl font-bold" style={{ color }}>
            {ejercicio.entrada.series}×{unidad(ejercicio.medida, ejercicio.entrada.cantidad)}
          </p>
          <p className="mt-1 text-[0.65rem] uppercase tracking-wide text-[var(--color-texto-suave)]">
            entrada
          </p>
        </div>
        <div className="tarjeta px-3 py-4 text-center">
          <p className="cifra text-xl font-bold" style={{ color }}>
            {ejercicio.objetivo.series}×{unidad(ejercicio.medida, ejercicio.objetivo.cantidad)}
          </p>
          <p className="mt-1 text-[0.65rem] uppercase tracking-wide text-[var(--color-texto-suave)]">
            para pasar
          </p>
        </div>
        <div className="tarjeta px-3 py-4 text-center">
          <p className="cifra text-xl font-bold">
            {record > 0 ? unidad(ejercicio.medida, record) : '—'}
          </p>
          <p className="mt-1 text-[0.65rem] uppercase tracking-wide text-[var(--color-texto-suave)]">
            tu récord
          </p>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-texto-suave)]">
          Cómo se hace
        </h2>
        <ol className="space-y-3">
          {ejercicio.tecnica.map((paso, i) => (
            <li key={i} className="flex gap-3">
              <span
                className="cifra flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{
                  backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
                  color,
                }}
              >
                {i + 1}
              </span>
              <span className="text-sm leading-relaxed">{paso}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-texto-suave)]">
          Errores que arruinan el ejercicio
        </h2>
        <ul className="space-y-2">
          {ejercicio.erroresComunes.map((error, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-alerta)]" />
              {error}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-texto-suave)]">
          Descanso sugerido
        </h2>
        <p className="text-sm text-[var(--color-texto-suave)]">
          <span className="cifra font-semibold text-[var(--color-texto)]">
            {ejercicio.descansoSegundos} segundos
          </span>{' '}
          entre series. Cuanto más exigente el ejercicio, más descanso necesita
          el sistema nervioso para dar la misma serie de nuevo.
        </p>
      </section>

      {historico.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-texto-suave)]">
            Tus últimas veces
          </h2>
          <ul className="space-y-2">
            {historico.slice(-5).reverse().map((punto, i) => (
              <li
                key={`${punto.fecha}-${i}`}
                className="tarjeta flex items-center justify-between px-4 py-3 text-sm"
              >
                <span>
                  {new Date(`${punto.fecha}T12:00:00`).toLocaleDateString('es-AR', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
                <span className="cifra text-[var(--color-texto-suave)]">
                  mejor {unidad(ejercicio.medida, punto.mejor)} · total{' '}
                  {unidad(ejercicio.medida, punto.volumen)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!esActual && (
        <section className="mt-10">
          <div className="tarjeta p-4">
            <p className="text-sm leading-relaxed">
              Si este es el nivel donde realmente estás, ponelo como punto de
              partida de {NOMBRE_PATRON[ejercicio.patron].toLowerCase()}. El
              motor sigue desde acá.
            </p>
            <Boton
              variante="secundario"
              className="mt-4 w-full"
              onClick={() => void fijarNivel(ejercicio.patron, ejercicio.id)}
            >
              Empezar desde este nivel
            </Boton>
          </div>
        </section>
      )}
    </>
  )
}
