/**
 * Hoy.
 *
 * La pantalla que se abre veinte veces por semana. De ahí sale casi todo su
 * diseño: es la que más tiene que callarse.
 *
 * Lo que cambió respecto de la versión anterior, y por qué:
 *
 * - **Se fue la racha.** Estaba rota —adherencia perfecta con la rutina por
 *   defecto mostraba un 3— pero el problema de fondo era otro: en una app de
 *   fuerza el descanso es parte del plan, así que premiar días consecutivos es
 *   premiar exactamente lo que no hay que hacer. En su lugar hay un contador
 *   que solo sube y una ventana de veintiocho días que siempre se puede
 *   recuperar.
 *
 * - **Se fue el "volumen".** Sumaba repeticiones con segundos.
 *
 * - **Apareció la carta.** Una barra de porcentaje no ubica a nadie; un camino
 *   con nodos dice de dónde viniste, dónde estás y qué falta.
 */

import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { NOMBRE_PATRON, buscarEjercicio, cadenaDe } from '@/dominio/biblioteca'
import {
  NOMBRE_DIA,
  RUTINA_POR_DEFECTO,
  RUTINA_POR_ID,
  diaDeLaSemana,
  proximoDia,
  tocaEntrenar,
} from '@/dominio/rutinas'
import { adherencia, esVuelta, proximoHito, sesionesDeVida } from '@/dominio/adherencia'
import { bandaSostenida, ajusteDelDia } from '@/dominio/estado'
import {
  fechaISO,
  leerAvances,
  leerEstadoDeHoy,
  leerEstados,
  leerPreferencias,
  leerSesiones,
} from '@/datos/repositorio'
import { Carta } from '@/componentes/carta'
import { Accion, Cargando, Glifo, Glosa, Objetivo, Rotulo, Tira } from '@/componentes/ui'

const FORMATO_FECHA = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

export function Hoy() {
  const navegar = useNavigate()
  const hoy = new Date()
  const fecha = fechaISO(hoy)

  const avances = useLiveQuery(leerAvances, [])
  const preferencias = useLiveQuery(leerPreferencias, [])
  const sesiones = useLiveQuery(() => leerSesiones(), [])
  const estados = useLiveQuery(leerEstados, [])
  const estadoDeHoy = useLiveQuery(leerEstadoDeHoy, [])

  if (!avances || !preferencias || !sesiones || !estados) {
    return (
      <>
        <Rotulo>{FORMATO_FECHA.format(hoy).toUpperCase()}</Rotulo>
        <div className="mt-6">
          <Cargando filas={4} />
        </div>
      </>
    )
  }

  const rutina =
    RUTINA_POR_ID.get(preferencias.rutinaActivaId) ?? RUTINA_POR_ID.get(RUTINA_POR_DEFECTO)!
  const esDiaDeEntrenar = tocaEntrenar(rutina, hoy)
  const siguiente = proximoDia(rutina, hoy)
  const entrenoHoy = sesiones.some((s) => s.fecha === fecha)
  const total = sesionesDeVida(sesiones)
  const hito = proximoHito(total)
  const marcha = adherencia(sesiones, fecha, rutina.dias.length)
  const banda = bandaSostenida(estados, fecha)
  const ajuste = ajusteDelDia(banda)
  const vuelve = esVuelta(sesiones, fecha)

  const bloques = rutina.bloques.flatMap((bloque) => {
    const avance = avances.get(bloque.patron)
    const ejercicio = avance ? buscarEjercicio(avance.ejercicioId) : undefined
    return avance && ejercicio ? [{ patron: bloque.patron, avance, ejercicio }] : []
  })

  const filasDeCarta = [...avances.values()].map((avance) => ({
    patron: avance.patron,
    avance,
  }))

  return (
    <>
      <header>
        <Rotulo>{FORMATO_FECHA.format(hoy).toUpperCase()}</Rotulo>
        <p className="cifra-identidad mt-3">{String(total).padStart(3, '0')}</p>
        <p className="mt-1 text-sm text-[var(--color-glosa)]">
          {total === 0
            ? 'sesiones. Todavía ninguna.'
            : total === 1
              ? 'sesión en tu vida.'
              : 'sesiones en tu vida.'}
        </p>
        {total > 0 && (
          <div className="mt-4">
            <Tira cantidad={total} />
          </div>
        )}
        {hito && hito.faltan <= 5 && total > 0 && (
          <p className="mt-4 text-sm text-[var(--color-glosa)]">
            Te {hito.faltan === 1 ? 'falta' : 'faltan'}{' '}
            <span className="cifra text-[var(--color-tinta)]">{hito.faltan}</span> para llegar a{' '}
            <span className="cifra text-[var(--color-tinta)]">{hito.hito}</span>.
          </p>
        )}
      </header>

      {ajuste.mensaje && (
        <div className="mt-8">
          <Glosa tono="ambar" cita={`Regla · estado sostenido ${banda === 'rojo' ? '3 días' : '2 de 3'}`}>
            {ajuste.mensaje}
          </Glosa>
        </div>
      )}

      {preferencias.estadoActivo && !estadoDeHoy && (
        <button
          onClick={() => navegar('/estado')}
          className="registro mt-8 w-full text-left"
          style={{ borderTop: '1px solid var(--color-regla)' }}
        >
          <div className="fila-pulsable">
            <span className="canal">?</span>
            <span className="nombre">¿Cómo venís hoy?</span>
            <span className="rotulo">15 s</span>
          </div>
        </button>
      )}

      <section className="mt-8">
        <Rotulo>
          {entrenoHoy
            ? 'YA ENTRENASTE HOY'
            : esDiaDeEntrenar
              ? vuelve
                ? 'SESIÓN DE VUELTA'
                : `HOY · ${rutina.nombre.toUpperCase()}`
              : 'HOY TOCA DESCANSAR'}
        </Rotulo>

        <div className="registro mt-3">
          {bloques.map(({ patron, avance, ejercicio }) => {
            const cadena = cadenaDe(patron)
            const posicion = cadena.ejercicios.indexOf(ejercicio.id) + 1
            return (
              <div key={patron}>
                <span className="canal">
                  <Glifo patron={patron} />
                </span>
                <span className="min-w-0">
                  <span className="nombre block truncate">{ejercicio.nombre}</span>
                  <span className="rotulo mt-0.5 block">
                    {NOMBRE_PATRON[patron]} · {posicion}/{cadena.ejercicios.length}
                  </span>
                </span>
                <Objetivo
                  series={avance.objetivoActual.series}
                  cantidad={Math.round(avance.objetivoActual.cantidad * ajuste.factor)}
                  medida={ejercicio.medida}
                />
              </div>
            )
          })}
        </div>

        {!esDiaDeEntrenar && siguiente && (
          <p className="mt-4 text-sm leading-relaxed text-[var(--color-glosa)]">
            El próximo es el {NOMBRE_DIA[diaDeLaSemana(siguiente)]?.toLowerCase()}. Descansar no
            es una pausa del plan: es la parte del plan en la que el músculo se construye.
          </p>
        )}
      </section>

      <section className="mt-8">
        <Rotulo className="mb-3">DÓNDE ESTÁS</Rotulo>
        <Carta filas={filasDeCarta} />
      </section>

      <section className="mt-8">
        <div className="flex items-baseline justify-between gap-4">
          <Rotulo>ÚLTIMOS 28 DÍAS</Rotulo>
          <p className="cifra text-sm">
            {preferencias.encuadre === 'restante'
              ? `faltan ${Math.max(0, marcha.meta - marcha.hechas - marcha.cubiertos)}`
              : `${marcha.hechas} de ${marcha.meta}`}
          </p>
        </div>
        <div className="mt-2 flex h-1.5 gap-px" aria-hidden>
          {Array.from({ length: marcha.meta }, (_, i) => (
            <span
              key={i}
              className="flex-1"
              style={{
                backgroundColor:
                  i < marcha.hechas
                    ? 'var(--color-vega)'
                    : i < marcha.hechas + marcha.cubiertos
                      ? 'var(--color-regla-fuerte)'
                      : 'var(--color-regla)',
              }}
            />
          ))}
        </div>
        {marcha.cubiertos > 0 && (
          <p className="mt-2 text-xs text-[var(--color-glosa)]">
            {marcha.cubiertos === 1 ? 'Un día cubierto' : `${marcha.cubiertos} días cubiertos`} con
            tus créditos. Faltar estaba previsto.
          </p>
        )}
      </section>

      <div className="mt-10 -mx-4">
        <Accion onClick={() => navegar('/entrenar')}>
          {entrenoHoy ? 'Entrenar otra vez' : vuelve ? 'Volver a empezar' : 'Empezar'}
        </Accion>
        <button
          onClick={() => navegar('/entrenar?corta=1')}
          className="accion-quieta"
        >
          Solo tengo 7 minutos
        </button>
      </div>
    </>
  )
}
