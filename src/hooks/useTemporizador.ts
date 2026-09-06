import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Un cronómetro que no se atrasa.
 *
 * La tentación es restar un segundo cada mil milisegundos, pero los navegadores
 * frenan los temporizadores de las pestañas en segundo plano — que es
 * exactamente lo que pasa cuando bloqueás el celular durante el descanso. Así
 * que se guarda el momento de finalización y se calcula cuánto falta a partir
 * del reloj real. Volvés a la app y el número es el correcto.
 */
export interface Temporizador {
  /** Segundos restantes, redondeados hacia arriba. */
  restante: number
  activo: boolean
  arrancar: (segundos: number) => void
  detener: () => void
  sumar: (segundos: number) => void
}

export function useTemporizador(alTerminar?: () => void): Temporizador {
  const [finEn, setFinEn] = useState<number | null>(null)
  const [restante, setRestante] = useState(0)
  const alTerminarRef = useRef(alTerminar)

  useEffect(() => {
    alTerminarRef.current = alTerminar
  }, [alTerminar])

  useEffect(() => {
    if (finEn === null) return

    const tic = () => {
      const faltan = Math.max(0, Math.ceil((finEn - Date.now()) / 1000))
      setRestante(faltan)
      if (faltan === 0) {
        setFinEn(null)
        alTerminarRef.current?.()
      }
    }

    tic()
    // Se consulta cuatro veces por segundo para que el número no "salte" dos
    // unidades cuando el navegador se demora un poco.
    const id = window.setInterval(tic, 250)
    return () => window.clearInterval(id)
  }, [finEn])

  const arrancar = useCallback((segundos: number) => {
    setFinEn(Date.now() + segundos * 1000)
    setRestante(segundos)
  }, [])

  const detener = useCallback(() => {
    setFinEn(null)
    setRestante(0)
  }, [])

  const sumar = useCallback((segundos: number) => {
    setFinEn((actual) => (actual === null ? null : actual + segundos * 1000))
  }, [])

  return { restante, activo: finEn !== null, arrancar, detener, sumar }
}

/**
 * Un cronómetro que cuenta hacia arriba, para medir cuánto duró la sesión.
 * Mismo criterio: se guarda el momento de inicio y se calcula la diferencia.
 */
export function useCronometro(activo: boolean): number {
  const [inicio] = useState(() => Date.now())
  const [transcurrido, setTranscurrido] = useState(0)

  useEffect(() => {
    if (!activo) return
    const tic = () => setTranscurrido(Math.floor((Date.now() - inicio) / 1000))
    tic()
    const id = window.setInterval(tic, 1000)
    return () => window.clearInterval(id)
  }, [activo, inicio])

  return transcurrido
}

/** Formatea segundos como m:ss, o h:mm:ss si la cosa se estiró. */
export function comoReloj(segundos: number): string {
  const horas = Math.floor(segundos / 3600)
  const minutos = Math.floor((segundos % 3600) / 60)
  const resto = segundos % 60

  if (horas > 0) {
    return `${horas}:${String(minutos).padStart(2, '0')}:${String(resto).padStart(2, '0')}`
  }
  return `${minutos}:${String(resto).padStart(2, '0')}`
}
