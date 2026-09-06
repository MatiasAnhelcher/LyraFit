import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { buscarEjercicio, cadenaDe, NOMBRE_PATRON, POR_ID } from '@/dominio/biblioteca'
import { porcentajeDeCadena } from '@/dominio/progresion'
import {
  NOMBRE_DIA,
  RUTINA_POR_DEFECTO,
  RUTINA_POR_ID,
  diaDeLaSemana,
  proximoDia,
  tocaEntrenar,
} from '@/dominio/rutinas'
import { rachaActual, totales } from '@/dominio/estadisticas'
import { fechaISO, leerAvances, leerPreferencias, leerSesiones } from '@/datos/repositorio'
import { Barra, Boton, COLOR_PATRON, Dato, Etiqueta, plural, unidad } from '@/componentes/ui'
import { IconoLlama, IconoReloj } from '@/componentes/iconos'

const FORMATO_FECHA = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

export function Hoy() {
  const navegar = useNavigate()
  const hoy = new Date()

  const avances = useLiveQuery(leerAvances, [])
  const preferencias = useLiveQuery(leerPreferencias, [])
  const sesiones = useLiveQuery(() => leerSesiones(), [])

  if (!avances || !preferencias || !sesiones) {
    return <p className="py-16 text-center text-[var(--color-texto-suave)]">Cargando…</p>
  }

  const rutina = RUTINA_POR_ID.get(preferencias.rutinaActivaId) ?? RUTINA_POR_ID.get(RUTINA_POR_DEFECTO)!
  const esDiaDeEntrenar = tocaEntrenar(rutina, hoy)
  const siguiente = proximoDia(rutina, hoy)
  const resumen = totales(sesiones, fechaISO(hoy))
  const entrenoHoy = sesiones.some((s) => s.fecha === fechaISO(hoy))

  return (
    <>
      <header className="mb-6">
        <p className="text-sm text-[var(--color-texto-suave)]">
          {FORMATO_FECHA.format(hoy)}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          {entrenoHoy
            ? 'Entrenaste hoy'
            : esDiaDeEntrenar
              ? 'Hoy toca entrenar'
              : 'Hoy toca descansar'}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-texto-suave)]">
          {entrenoHoy
            ? 'Sesión registrada. Si querés sumar otra vuelta, adelante.'
            : esDiaDeEntrenar
              ? `${rutina.nombre} · ${plural(rutina.bloques.length, 'bloque', 'bloques')}`
              : siguiente
                ? `El próximo es el ${NOMBRE_DIA[diaDeLaSemana(siguiente)]?.toLowerCase()}. El descanso es cuando el músculo se construye.`
                : 'No tenés días de entrenamiento configurados.'}
        </p>
      </header>

      <section className="mb-6 grid grid-cols-3 gap-3">
        <Dato
          valor={
            <span className="inline-flex items-center gap-1.5">
              <IconoLlama className="h-5 w-5 text-[var(--color-acento)]" />
              {rachaActual(sesiones, fechaISO(hoy))}
            </span>
          }
          etiqueta="Racha"
        />
        <Dato valor={resumen.sesiones} etiqueta="Sesiones" />
        <Dato valor={resumen.volumen.toLocaleString('es-AR')} etiqueta="Volumen" />
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-texto-suave)]">
          {esDiaDeEntrenar ? 'La sesión de hoy' : 'Tu próxima sesión'}
        </h2>

        <ul className="space-y-3">
          {rutina.bloques.map((bloque) => {
            const avance = avances.get(bloque.patron)
            if (!avance) return null

            const ejercicio = buscarEjercicio(avance.ejercicioId)
            if (!ejercicio) return null

            const cadena = cadenaDe(bloque.patron)
            const posicion = cadena.ejercicios.indexOf(ejercicio.id) + 1
            const color = COLOR_PATRON[bloque.patron]

            return (
              <li key={bloque.patron} className="tarjeta p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Etiqueta patron={bloque.patron}>{NOMBRE_PATRON[bloque.patron]}</Etiqueta>
                    <p className="mt-2 font-semibold leading-tight">{ejercicio.nombre}</p>
                    <p className="mt-1 text-sm text-[var(--color-texto-suave)]">
                      Nivel {posicion} de {cadena.ejercicios.length}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="cifra text-2xl font-bold" style={{ color }}>
                      {avance.objetivoActual.series}×
                      {unidad(ejercicio.medida, avance.objetivoActual.cantidad)}
                    </p>
                    <p className="mt-0.5 text-[0.7rem] uppercase tracking-wide text-[var(--color-texto-suave)]">
                      objetivo
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <Barra porcentaje={porcentajeDeCadena(avance, cadena, POR_ID)} color={color} />
                </div>

                {avance.rachaExitos > 0 && (
                  <p className="mt-3 text-xs font-medium" style={{ color }}>
                    Una sesión más cumpliendo el objetivo y subís de nivel.
                  </p>
                )}
                {avance.rachaFallos > 0 && (
                  <p className="mt-3 text-xs font-medium text-[var(--color-alerta)]">
                    La última salió floja. Si se repite, bajamos la carga.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <Boton className="w-full py-4 text-base" onClick={() => navegar('/entrenar')}>
        {entrenoHoy ? 'Entrenar otra vez' : 'Empezar entrenamiento'}
      </Boton>

      {sesiones.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-texto-suave)]">
            Últimas sesiones
          </h2>
          <ul className="space-y-2">
            {sesiones.slice(0, 3).map((sesion) => (
              <li
                key={sesion.id}
                className="tarjeta flex items-center justify-between px-4 py-3 text-sm"
              >
                <span>
                  {new Date(`${sesion.fecha}T12:00:00`).toLocaleDateString('es-AR', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
                <span className="flex items-center gap-3 text-[var(--color-texto-suave)]">
                  <span className="cifra">
                    {plural(sesion.registros.length, 'ejercicio', 'ejercicios')}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <IconoReloj className="h-4 w-4" />
                    <span className="cifra">{Math.round(sesion.duracionSegundos / 60)} min</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
