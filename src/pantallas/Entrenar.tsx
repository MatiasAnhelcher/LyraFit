import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { buscarEjercicio, NOMBRE_PATRON } from '@/dominio/biblioteca'
import { RUTINA_POR_DEFECTO, RUTINA_POR_ID } from '@/dominio/rutinas'
import type { RegistroEjercicio, Serie } from '@/dominio/tipos'
import { cerrarSesion, leerAvances, leerPreferencias, type ResumenSesion } from '@/datos/repositorio'
import { comoReloj, useCronometro, useTemporizador } from '@/hooks/useTemporizador'
import { Boton, COLOR_PATRON, Etiqueta, nombreUnidad, plural, unidad } from '@/componentes/ui'
import { IconoAtras, IconoTilde, IconoSubir, IconoBajar } from '@/componentes/iconos'

/** Un pitido corto al terminar el descanso, sin archivos de audio. */
function pitar() {
  try {
    const Contexto = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Contexto) return
    const ctx = new Contexto()
    const osc = ctx.createOscillator()
    const gan = ctx.createGain()
    osc.connect(gan)
    gan.connect(ctx.destination)
    osc.frequency.value = 880
    gan.gain.setValueAtTime(0.001, ctx.currentTime)
    gan.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02)
    gan.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start()
    osc.stop(ctx.currentTime + 0.42)
    setTimeout(() => void ctx.close(), 600)
  } catch {
    // Si el navegador no deja hacer sonar nada sin un gesto previo, no pasa
    // nada: el descanso igual termina y la pantalla lo muestra.
  }
}

function vibrar(patron: number | number[]) {
  try {
    navigator.vibrate?.(patron)
  } catch {
    /* No todos los dispositivos vibran. No es motivo para romper nada. */
  }
}

export function Entrenar() {
  const navegar = useNavigate()
  const avances = useLiveQuery(leerAvances, [])
  const preferencias = useLiveQuery(leerPreferencias, [])

  const [indice, setIndice] = useState(0)
  const [hechas, setHechas] = useState<Record<string, Serie[]>>({})
  const [resumen, setResumen] = useState<ResumenSesion | null>(null)
  const [guardando, setGuardando] = useState(false)

  const duracion = useCronometro(resumen === null)
  const descanso = useTemporizador(() => {
    if (preferencias?.sonidoDescanso !== false) pitar()
    vibrar([120, 80, 120])
  })

  const rutina = preferencias
    ? (RUTINA_POR_ID.get(preferencias.rutinaActivaId) ?? RUTINA_POR_ID.get(RUTINA_POR_DEFECTO)!)
    : null

  /** Los ejercicios concretos de la sesión, según el avance de cada patrón. */
  const plan = useMemo(() => {
    if (!rutina || !avances) return []
    return rutina.bloques.flatMap((bloque) => {
      const avance = avances.get(bloque.patron)
      const ejercicio = avance ? buscarEjercicio(avance.ejercicioId) : undefined
      return avance && ejercicio ? [{ ejercicio, objetivo: avance.objetivoActual }] : []
    })
  }, [rutina, avances])

  const [valor, setValor] = useState<number | null>(null)

  if (!avances || !preferencias || plan.length === 0) {
    return <p className="p-8 text-center text-[var(--color-texto-suave)]">Preparando la sesión…</p>
  }

  if (resumen) {
    return <Resumen resumen={resumen} duracion={duracion} alSalir={() => navegar('/')} />
  }

  const paso = plan[indice]!
  const { ejercicio, objetivo } = paso
  const series = hechas[ejercicio.id] ?? []
  const completo = series.length >= objetivo.series
  const color = COLOR_PATRON[ejercicio.patron]
  const propuesto = valor ?? objetivo.cantidad
  const esUltimo = indice === plan.length - 1

  function registrarSerie() {
    const logrado = Math.max(0, propuesto)
    setHechas((previas) => ({
      ...previas,
      [ejercicio.id]: [...(previas[ejercicio.id] ?? []), { logrado }],
    }))
    setValor(null)
    vibrar(40)

    // No tiene sentido descansar después de la última serie del ejercicio.
    if (series.length + 1 < objetivo.series) {
      descanso.arrancar(ejercicio.descansoSegundos)
    }
  }

  function deshacerSerie() {
    setHechas((previas) => ({
      ...previas,
      [ejercicio.id]: (previas[ejercicio.id] ?? []).slice(0, -1),
    }))
    descanso.detener()
  }

  function avanzar() {
    descanso.detener()
    setValor(null)
    setIndice((i) => Math.min(i + 1, plan.length - 1))
  }

  async function terminar() {
    setGuardando(true)
    descanso.detener()

    const registros: RegistroEjercicio[] = plan.map(({ ejercicio: e, objetivo: o }) => ({
      ejercicioId: e.id,
      objetivo: o,
      series: hechas[e.id] ?? [],
    }))

    try {
      setResumen(await cerrarSesion(registros, duracion))
    } finally {
      setGuardando(false)
    }
  }

  const algoRegistrado = Object.values(hechas).some((s) => s.length > 0)

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-fondo)]">
      <header className="flex items-center justify-between border-b border-[var(--color-borde)] px-4 py-3">
        <button
          onClick={() => navegar('/')}
          className="flex items-center gap-1 text-sm text-[var(--color-texto-suave)]"
        >
          <IconoAtras className="h-5 w-5" />
          Salir
        </button>
        <p className="cifra text-sm text-[var(--color-texto-suave)]">{comoReloj(duracion)}</p>
      </header>

      <div className="flex gap-1.5 px-4 pt-4">
        {plan.map((p, i) => (
          <div
            key={p.ejercicio.id}
            className="h-1 flex-1 rounded-full transition-colors"
            style={{
              backgroundColor:
                i < indice
                  ? COLOR_PATRON[p.ejercicio.patron]
                  : i === indice
                    ? color
                    : 'var(--color-superficie-alta)',
              opacity: i < indice ? 0.45 : 1,
            }}
          />
        ))}
      </div>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-6">
        <Etiqueta patron={ejercicio.patron}>{NOMBRE_PATRON[ejercicio.patron]}</Etiqueta>
        <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight">
          {ejercicio.nombre}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-texto-suave)]">
          Objetivo: {objetivo.series} series de {unidad(ejercicio.medida, objetivo.cantidad)}
        </p>

        <ul className="mt-6 flex gap-2" aria-label="Series de este ejercicio">
          {Array.from({ length: objetivo.series }).map((_, i) => {
            const serie = series[i]
            const activa = i === series.length
            return (
              <li
                key={i}
                className="flex h-14 flex-1 items-center justify-center rounded-xl border-2 text-lg font-bold transition"
                style={{
                  borderColor: serie ? color : activa ? color : 'var(--color-borde)',
                  backgroundColor: serie
                    ? `color-mix(in srgb, ${color} 16%, transparent)`
                    : 'transparent',
                  color: serie ? color : 'var(--color-texto-suave)',
                  borderStyle: activa && !serie ? 'dashed' : 'solid',
                }}
              >
                <span className="cifra">{serie ? serie.logrado : i + 1}</span>
              </li>
            )
          })}
        </ul>

        {descanso.activo ? (
          <section className="mt-8 flex flex-1 flex-col items-center justify-center pb-8">
            <p className="text-sm uppercase tracking-wide text-[var(--color-texto-suave)]">
              Descanso
            </p>
            <p className="cifra pulso-descanso mt-2 text-6xl font-bold" style={{ color }}>
              {comoReloj(descanso.restante)}
            </p>
            <div className="mt-6 flex gap-3">
              <Boton variante="secundario" onClick={() => descanso.sumar(30)}>
                +30 s
              </Boton>
              <Boton variante="secundario" onClick={descanso.detener}>
                Saltear
              </Boton>
            </div>
          </section>
        ) : completo ? (
          <section className="mt-8 flex flex-1 flex-col items-center justify-center text-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)` }}
            >
              <IconoTilde className="h-8 w-8" style={{ color }} />
            </div>
            <p className="mt-4 font-semibold">Ejercicio completo</p>
            <button
              onClick={deshacerSerie}
              className="mt-2 text-sm text-[var(--color-texto-suave)] underline underline-offset-4"
            >
              Deshacer la última serie
            </button>
          </section>
        ) : (
          <section className="mt-8 flex flex-1 flex-col justify-center pb-8">
            <p className="text-center text-sm text-[var(--color-texto-suave)]">
              Serie {series.length + 1} · {nombreUnidad(ejercicio.medida)}
            </p>

            <div className="mt-3 flex items-center justify-center gap-6">
              <button
                onClick={() => setValor(Math.max(0, propuesto - (ejercicio.medida === 'segundos' ? 5 : 1)))}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-superficie-alta)]"
                aria-label="Restar"
              >
                <IconoBajar className="h-6 w-6" />
              </button>

              <p className="cifra w-28 text-center text-6xl font-bold tabular-nums">
                {propuesto}
              </p>

              <button
                onClick={() => setValor(propuesto + (ejercicio.medida === 'segundos' ? 5 : 1))}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-superficie-alta)]"
                aria-label="Sumar"
              >
                <IconoSubir className="h-6 w-6" />
              </button>
            </div>

            {series.length > 0 && (
              <div className="mt-4 text-center">
                <button
                  onClick={deshacerSerie}
                  className="text-sm text-[var(--color-texto-suave)] underline underline-offset-4"
                >
                  Deshacer la última
                </button>
              </div>
            )}
          </section>
        )}

        <div className="mt-auto space-y-3 pb-8 pt-8">
          {!completo && !descanso.activo && (
            <Boton className="w-full py-4 text-base" onClick={registrarSerie}>
              Registrar serie
            </Boton>
          )}

          {completo && !esUltimo && (
            <Boton className="w-full py-4 text-base" onClick={avanzar}>
              Siguiente ejercicio
            </Boton>
          )}

          {(completo || algoRegistrado) && (
            <Boton
              variante={completo && esUltimo ? 'principal' : 'secundario'}
              className="w-full py-4 text-base"
              onClick={() => void terminar()}
              deshabilitado={guardando || !algoRegistrado}
            >
              {guardando ? 'Guardando…' : 'Terminar sesión'}
            </Boton>
          )}

          {!completo && !esUltimo && (
            <Boton variante="fantasma" className="w-full" onClick={avanzar}>
              Saltear este ejercicio
            </Boton>
          )}
        </div>
      </main>
    </div>
  )
}

function Resumen({
  resumen,
  duracion,
  alSalir,
}: {
  resumen: ResumenSesion
  duracion: number
  alSalir: () => void
}) {
  const volumen = resumen.sesion.registros.reduce(
    (total, r) => total + r.series.reduce((s, serie) => s + serie.logrado, 0),
    0,
  )

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Sesión terminada</h1>
      <p className="mt-2 text-[var(--color-texto-suave)]">
        {comoReloj(duracion)} · {volumen} en total ·{' '}
        {plural(resumen.sesion.registros.length, 'ejercicio', 'ejercicios')}
      </p>

      <ul className="mt-8 space-y-3">
        {resumen.decisiones.map(({ patron, decision }) => (
          <li key={patron} className="tarjeta p-4">
            <div className="flex items-center justify-between">
              <Etiqueta patron={patron}>{NOMBRE_PATRON[patron]}</Etiqueta>
              {decision.cambioDeNivel && (
                <span
                  className="text-xs font-bold uppercase tracking-wide"
                  style={{ color: COLOR_PATRON[patron] }}
                >
                  Cambio de nivel
                </span>
              )}
            </div>
            <p className="mt-3 text-sm leading-relaxed">{decision.explicacion}</p>
            <p className="mt-2 text-xs text-[var(--color-texto-suave)]">
              Próxima vez:{' '}
              <span className="cifra">
                {decision.avance.objetivoActual.series}×
                {unidad(
                  buscarEjercicio(decision.avance.ejercicioId)?.medida ?? 'repeticiones',
                  decision.avance.objetivoActual.cantidad,
                )}
              </span>{' '}
              de {buscarEjercicio(decision.avance.ejercicioId)?.nombre}
            </p>
          </li>
        ))}
      </ul>

      {resumen.decisiones.length === 0 && (
        <p className="mt-8 text-sm text-[var(--color-texto-suave)]">
          La sesión quedó registrada. Como no completaste los ejercicios que
          tocaban, el plan se mantiene igual.
        </p>
      )}

      <Boton className="mt-auto w-full py-4 text-base" onClick={alSalir}>
        Listo
      </Boton>
    </div>
  )
}
