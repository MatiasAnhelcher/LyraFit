/**
 * Progreso.
 *
 * La pieza nueva y la que justifica toda la aritmética del motor es la curva
 * de fuerza. El registro crudo de repeticiones se desploma cada vez que se
 * cambia de eslabón —pasás de hacer quince a hacer seis— y muestra un
 * retroceso justo en el momento de mayor logro. Es el problema que sufre
 * cualquier app de calistenia que grafique repeticiones.
 *
 * El índice de carga lo resuelve porque hace comparables dos ejercicios
 * distintos, y la fórmula con la que el motor recalibra al cambiar de nivel
 * está construida para que el índice quede exactamente igual a los dos lados
 * del salto. La línea sube parejo a través de la cadena entera.
 *
 * Es una estimación y la pantalla lo dice. No es una medición del cuerpo de
 * nadie.
 */

import { lazy, Suspense } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CADENAS, NOMBRE_PATRON, buscarEjercicio } from '@/dominio/biblioteca'
import { curvaDeFuerza, porSemana, totales } from '@/dominio/estadisticas'
import { calibracion, frasePorCalibracion, vitalidad } from '@/dominio/vitalidad'
import { sesionesDeVida } from '@/dominio/adherencia'
import { leerAvances, leerSesiones } from '@/datos/repositorio'
import { Carta } from '@/componentes/carta'
import { Cargando, Glifo, Rotulo, Tira, Vacio } from '@/componentes/ui'

const Curva = lazy(() => import('@/componentes/curva').then((m) => ({ default: m.Curva })))

const FORMATO_SEMANA = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' })

export function Progreso() {
  const sesiones = useLiveQuery(() => leerSesiones(), [])
  const avances = useLiveQuery(leerAvances, [])

  if (!sesiones || !avances) return <Cargando filas={5} />

  const resumen = totales(sesiones)
  const semanas = porSemana(sesiones).slice(-12)
  const cal = calibracion(sesiones)
  const vit = vitalidad(sesiones)
  const total = sesionesDeVida(sesiones)

  if (sesiones.length === 0) {
    return (
      <>
        <Rotulo>PROGRESO</Rotulo>
        <Vacio
          titulo="Todavía no hay nada que mostrar"
          texto="Después de la primera sesión vas a ver acá tu curva de fuerza: una sola línea que sigue subiendo aunque cambies de ejercicio."
        />
      </>
    )
  }

  return (
    <>
      <Rotulo>PROGRESO</Rotulo>

      <section className="mt-6">
        <p className="cifra-acumulador">{total}</p>
        <p className="mt-1 text-sm text-[var(--color-glosa)]">
          sesiones · {resumen.series} series · {resumen.minutos} minutos
        </p>
        <div className="mt-4">
          <Tira cantidad={total} />
        </div>
      </section>

      <section className="mt-10">
        <Rotulo className="mb-3">TUS CADENAS</Rotulo>
        <Carta filas={[...avances.values()].map((a) => ({ patron: a.patron, avance: a }))} rotulos />
      </section>

      <section className="mt-10">
        <Rotulo>CURVA DE FUERZA</Rotulo>
        <p className="mt-2 max-w-[40ch] text-xs leading-relaxed text-[var(--color-glosa)]">
          Cuánto estás moviendo, en una escala que compara ejercicios distintos. Por eso no se
          corta cuando cambiás de eslabón, que es justo donde un gráfico de repeticiones muestra
          una caída. Es una estimación, no una medición.
        </p>
        <div className="mt-4">
          <Suspense fallback={<div className="h-56" />}>
            <Curva series={CADENAS.map((c) => ({ patron: c.patron, puntos: curvaDeFuerza(sesiones, c.patron) }))} />
          </Suspense>
        </div>
      </section>

      {(cal || vit) && (
        <section className="mt-10">
          <Rotulo>LO QUE TE DEJA ENTRENAR</Rotulo>
          <div className="registro mt-3">
            {vit && (
              <div>
                <span className="canal">↑</span>
                <span className="min-w-0">
                  <span className="nombre block">Energía</span>
                  <span className="rotulo mt-0.5 block">últimas {vit.sesiones} sesiones</span>
                </span>
                <span className="cifra-fila">
                  {vit.delta > 0 ? '+' : ''}
                  {vit.delta}
                </span>
              </div>
            )}
            {cal && (
              <div>
                <span className="canal">≈</span>
                <span className="min-w-0">
                  <span className="nombre block">Qué tan bien te conocés</span>
                  <span className="rotulo mt-0.5 block">últimas {cal.series} series</span>
                </span>
                <span className="cifra-fila">{cal.error}</span>
              </div>
            )}
          </div>
          {cal && (
            <p className="mt-3 max-w-[42ch] text-xs leading-relaxed text-[var(--color-glosa)]">
              {frasePorCalibracion(cal)}
              {cal.tendencia !== null &&
                ` Venís errando ${Math.abs(cal.tendencia).toFixed(1)} ${
                  cal.tendencia < 0 ? 'menos' : 'más'
                } que el mes pasado.`}
            </p>
          )}
          {vit && (
            <p className="mt-2 max-w-[42ch] text-xs leading-relaxed text-[var(--color-glosa)]">
              Terminaste con más energía de la que empezaste en {vit.subieron} de {vit.sesiones}{' '}
              sesiones. Es tu dato, no un promedio de estudios ajenos.
            </p>
          )}
        </section>
      )}

      <section className="mt-10">
        <Rotulo>SERIES POR SEMANA</Rotulo>
        <div className="registro mt-3">
          {[...semanas].reverse().map((s) => (
            <div key={s.semana}>
              <span className="canal">
                {FORMATO_SEMANA.format(new Date(`${s.semana}T12:00:00`))}
              </span>
              <span className="flex h-2 items-center">
                <span
                  className="block h-full"
                  style={{
                    width: `${Math.min(100, (s.series / Math.max(...semanas.map((x) => x.series), 1)) * 100)}%`,
                    backgroundColor: 'var(--color-regla-fuerte)',
                  }}
                />
              </span>
              <span className="cifra-fila">
                {s.series}
                <span className="cifra-contra">{s.sesiones}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* El historial, con la voz del motor adentro.
          Antes era una lista de fechas con nombres de ejercicios: cierta y
          muerta. Lo que le faltaba estaba a mano y se tiraba — la explicación
          del motor se mostraba diez segundos en el cierre y se perdía. Es el
          activo diferencial del producto, ninguna otra app te muestra la regla
          que decidió tu próximo objetivo, y duraba menos que un cartel.

          Solo se muestran los cambios de eslabón, que son los días que valen
          la pena releer. Poner las cuatro decisiones de las veinte sesiones
          serían ochenta renglones en cursiva y el historial dejaría de ser
          legible para decir lo mismo.

          Y en el canal va el número de sesión y no la fecha: "047" dice quién
          sos, "12 sep" dice cuándo. La fecha baja al renglón chico. */}
      <section className="mt-10 pb-4">
        <Rotulo>HISTORIAL</Rotulo>
        <div className="registro mt-3">
          {sesiones.slice(0, 20).map((sesion, i) => {
            const numero = total - i
            const saltos = (sesion.decisiones ?? []).filter((d) => d.cambioDeNivel)
            return (
              <div key={sesion.id}>
                {/* Arriba y no al medio: en una fila de tres renglones el
                    número centrado queda flotando lejos del nombre al que
                    pertenece. */}
                <span className="canal" style={{ alignItems: 'flex-start' }}>
                  {String(numero).padStart(3, '0')}
                </span>
                <span className="min-w-0">
                  <span className="nombre block truncate">
                    {sesion.registros
                      .map((r) => buscarEjercicio(r.ejercicioId)?.nombre)
                      .filter(Boolean)
                      .join(' · ') || 'Sesión sin registros'}
                  </span>
                  <span className="rotulo mt-0.5 flex items-center gap-2">
                    {new Date(`${sesion.fecha}T12:00:00`).toLocaleDateString('es-AR', {
                      day: 'numeric',
                      month: 'short',
                    })}
                    <span className="flex gap-1">
                      {sesion.registros.map((r) => {
                        const e = buscarEjercicio(r.ejercicioId)
                        return e ? <Glifo key={r.ejercicioId} patron={e.patron} /> : null
                      })}
                    </span>
                  </span>
                  {saltos.map((d) => (
                    <span key={d.patron} className="glosa mt-2 block text-[0.9375rem]">
                      {d.explicacion}
                    </span>
                  ))}
                </span>
                <span className="cifra-fila self-start">
                  {Math.round(sesion.duracionSegundos / 60)}
                  <span className="unidad">min</span>
                </span>
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}

export { NOMBRE_PATRON }
