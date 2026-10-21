import { useCallback, useEffect, useRef, useState } from 'react'
import {
  anteriorDelMismo,
  peorPorEjercicio,
  peorVuelta,
  registrosDelReloj,
  vueltaSinPausa,
  vueltasSinContar,
  type Formato,
  type Opcion,
  type Tramo,
} from '@/dominio/reloj'
import { cerrarSesion } from '@/datos/repositorio'
import { Accion, AccionQuieta, Rotulo } from '@/componentes/ui'
import { Cuenta, anotar, opcionDeVuelta } from './Cuenta'

/** TERMINASTE: el puntaje, la última vuelta si quedó sin contar, y la salida. */
export function Final({
  plan,
  formato,
  logros,
  setLogros,
  opciones,
  duracion,
  alSalir,
}: {
  plan: Tramo[]
  formato: Formato
  logros: (number | null)[]
  setLogros: React.Dispatch<React.SetStateAction<(number | null)[]>>
  opciones: Opcion[]
  duracion: number
  alSalir: () => void
}) {
  const puntajes = peorPorEjercicio(plan, logros)
  const unEjercicio = puntajes.length === 1
  const peor = peorVuelta(logros)
  const sinContar = vueltasSinContar(logros)
  const nombreDe = (id: string) => opciones.find((o) => o.id === id)?.nombre ?? id

  /**
   * La última vuelta no tuvo pausa, así que no hubo dónde contarla. Se cuenta
   * acá y no es un detalle: es la vuelta más dura, la que suele SER el puntaje,
   * y antes quedaba sin contar siempre.
   */
  const ultima = vueltaSinPausa(formato)
  const faltaLaUltima = ultima !== null && (logros[ultima] ?? null) === null
  const opcionUltima = ultima === null ? undefined : opcionDeVuelta(plan, opciones, ultima)

  // Se guarda al salir, como la sesión, y no al entrar: acá todavía se puede
  // anotar la última vuelta, y guardar antes sería guardarla sin ella.
  const guardado = useRef(false)
  const [guardada, setGuardada] = useState(false)
  const ultimos = useRef(logros)
  ultimos.current = logros
  const guardar = useCallback(() => {
    if (guardado.current) return
    guardado.current = true
    setGuardada(true)
    const registros = registrosDelReloj(plan, ultimos.current, opciones)
    if (registros.length === 0) return
    void cerrarSesion({ registros, duracionSegundos: duracion, tipo: 'reloj' })
  }, [plan, opciones, duracion])

  // Y también si la app se va al fondo sin que nadie toque nada: es la única
  // copia que existe y el teléfono puede matar la pestaña sin avisar.
  useEffect(() => {
    const alOcultarse = () => {
      if (document.visibilityState === 'hidden') guardar()
    }
    document.addEventListener('visibilitychange', alOcultarse)
    return () => document.removeEventListener('visibilitychange', alOcultarse)
  }, [guardar])

  const salir = () => {
    guardar()
    alSalir()
  }

  return (
    <div className="flex min-h-dvh flex-col" data-pantalla="cierre">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4">
        <Rotulo>TERMINASTE</Rotulo>

        {peor === null ? (
          <p className="mt-4 max-w-[34ch] text-sm leading-relaxed text-[var(--color-glosa)]">
            No contaste ninguna vuelta, así que no hay puntaje ni repeticiones que anotarle a
            ningún ejercicio. La sesión queda en el historial igual.
          </p>
        ) : unEjercicio ? (
          <>
            <p className="cifra mt-2 text-7xl" data-prueba="puntaje">
              {peor}
            </p>
            <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-[var(--color-glosa)]">
              Tu peor vuelta, que es el puntaje que vale. No el total: un total premia salir a lo
              loco y apagarse, y esto premia sostener, que es lo que el tabata mide.
            </p>
          </>
        ) : (
          <>
            {/* Con rotación no hay un número: un mínimo entre flexiones y
                sentadillas no es un puntaje, es la noticia de que las flexiones
                son más duras. Uno por ejercicio, que sí se puede comparar con
                el de la próxima vez. */}
            <div className="registro mt-4">
              {puntajes.map((p) => (
                <div key={p.ejercicioId}>
                  <span className="canal">◆</span>
                  <span className="nombre min-w-0">{nombreDe(p.ejercicioId)}</span>
                  <span className="cifra-fila">{p.peor ?? '—'}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 max-w-[34ch] text-sm leading-relaxed text-[var(--color-glosa)]">
              La peor vuelta de cada uno, que es el puntaje que vale. Uno por ejercicio y no uno
              solo: comparar una flexión con una sentadilla no diría nada.
            </p>
          </>
        )}

        {sinContar > 0 && peor !== null && !faltaLaUltima && (
          <p className="mt-2 text-xs leading-relaxed text-[var(--color-glosa)]">
            {sinContar === 1 ? 'Una vuelta quedó' : `${sinContar} vueltas quedaron`} sin contar,
            así que el puntaje sale de las demás.
          </p>
        )}

        {/* Si se guardó sola —porque el teléfono se fue al fondo— se dice, en
            vez de dejar unos botones que ya no van a cambiar nada. */}
        {faltaLaUltima && guardada && (
          <p className="mt-6 text-xs leading-relaxed text-[var(--color-glosa)]">
            La sesión ya quedó guardada, así que la última vuelta queda sin contar.
          </p>
        )}

        {faltaLaUltima && !guardada && ultima !== null && (
          <div className="mt-6 w-full max-w-[20rem] self-center">
            <Cuenta
              vuelta={ultima}
              logro={logros[ultima] ?? null}
              sugerido={
                anteriorDelMismo(plan, logros, ultima) ??
                (opcionUltima?.enSegundos ? formato.trabajo : undefined)
              }
              sugeridoEs={
                anteriorDelMismo(plan, logros, ultima) !== undefined ? 'anterior' : 'entera'
              }
              enSegundos={opcionUltima?.enSegundos === true}
              set={(cuanto) => anotar(setLogros, ultima, cuanto)}
            />
          </div>
        )}

        <div className="registro mt-8">
          {logros.map((n, i) => {
            const suyo = opcionDeVuelta(plan, opciones, i)
            return (
              <div key={i}>
                <span className="canal">{i + 1}</span>
                {/* El nombre solo cuando hay rotación: con un solo ejercicio
                    repetirlo ocho veces es ruido. */}
                <span className="min-w-0 text-sm text-[var(--color-glosa)]">
                  {unEjercicio ? '' : (suyo?.nombre ?? '')}
                </span>
                <span className="cifra-fila">{n ?? '—'}</span>
              </div>
            )
          })}
        </div>
      </main>

      <div className="mt-auto">
        <Accion esfuerzo onClick={salir}>
          Listo
        </Accion>
        <AccionQuieta onClick={salir}>Salir sin mirar</AccionQuieta>
      </div>
    </div>
  )
}
