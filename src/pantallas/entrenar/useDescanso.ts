/**
 * El descanso entre series: el reloj, la ráfaga que puede ocupar su principio
 * y la cuenta de los tres últimos segundos.
 *
 * Las tres cosas van juntas porque se cortan juntas. Cualquier camino que
 * detiene el descanso —saltearlo, deshacer, avanzar, cerrar— tiene que
 * descartar también la ráfaga que no se terminó, y eso está escrito una sola
 * vez, en `cortar`.
 */

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { Rafaga } from '@/dominio/metabolico'
import type { RegistroRafaga } from '@/dominio/tipos'
import { useTemporizador } from '@/hooks/useTemporizador'
import { sonar, tocar } from '@/respuesta'

export function useDescanso(
  /** Las ráfagas de la sesión: viven en el borrador, y acá solo se les agrega la terminada. */
  setRafagas: Dispatch<SetStateAction<RegistroRafaga[]>>,
  avisos: {
    /** Al entrar en los tres últimos segundos, una vez por descanso: el anuncio. */
    alQuedarTres?: () => void
    /**
     * Cuando el descanso llega a cero o se corta: lo que se dijo de él deja
     * de ser cierto. También al cortar sin descanso en curso, porque cortar
     * es pasar a otra cosa —el ejercicio siguiente, el final—.
     */
    alTerminar?: () => void
  } = {},
) {
  const avisar = useRef(avisos)
  avisar.current = avisos
  const descanso = useTemporizador(() => {
    sonar('descanso')
    tocar('descanso')
    avisar.current.alTerminar?.()
  })

  /**
   * Lo sumado con "+30 s" en este descanso.
   *
   * Es lo que dice "de 2:30" adentro del arco, y lo que hace que el arco mida
   * contra el total de verdad: contra el programado, sumar le pasaba el
   * círculo entero. Vuelve a cero en cada descanso, y no se guarda en el
   * borrador porque el descanso tampoco: una recarga lo corta.
   */
  const [sumado, setSumado] = useState(0)

  /** La ráfaga del descanso en curso, o null si este descanso no tiene. */
  const [rafagaActual, setRafagaActual] = useState<{
    rafaga: Rafaga
    segundos: number
    /** El descanso entero, para saber dónde termina el tramo de la ráfaga. */
    total: number
  } | null>(null)
  /** Si la salteó a mano. Se apaga sola al arrancar el descanso siguiente. */
  const [rafagaSalteada, setRafagaSalteada] = useState(false)
  /**
   * El azar de lo que dice Lyra en el descanso.
   *
   * Se sortea al arrancar CADA descanso y no se deriva de los contadores. Con
   * los contadores sería determinista —mismo ejercicio, misma serie, misma
   * frase— y entonces todas las sesiones dirían exactamente lo mismo en el
   * mismo orden, que es la forma más rápida de que trescientas setenta y ocho
   * frases se sientan como tres.
   */
  const [azarDeLaFrase, setAzarDeLaFrase] = useState(() => Math.random())
  /**
   * La ráfaga esperando a que termine su tramo para quedar anotada.
   *
   * En un ref y no en el estado porque lo que la anota es un efecto que corre
   * cuatro veces por segundo: con estado, cada tic la volvería a anotar.
   */
  const pendiente = useRef<RegistroRafaga | null>(null)

  /**
   * Los tres últimos segundos del descanso, en la piel.
   *
   * El arco no puede acelerar —representa tiempo real, si acelera miente— pero
   * el tacto sí puede contar la entrada, como un músico. Sabés cuándo arranca
   * sin mirar la pantalla, así que te ponés en posición durante el conteo en
   * vez de reaccionar después del aviso.
   *
   * El ref hace falta porque el temporizador consulta cuatro veces por
   * segundo: sin él serían doce tics en lugar de tres.
   */
  const ultimoTic = useRef(0)
  useEffect(() => {
    if (!descanso.activo) {
      ultimoTic.current = 0
      return
    }
    const faltan = descanso.restante
    if (faltan > 0 && faltan <= 3 && faltan !== ultimoTic.current) {
      ultimoTic.current = faltan
      tocar('antes')
      // La nota grave solo al entrar en la cuenta: tres notas seguidas serían
      // insoportables a la octava repetición de la sesión. El anuncio, lo
      // mismo.
      if (faltan === 3) {
        sonar('aviso')
        avisar.current.alQuedarTres?.()
      }
    }
  }, [descanso.activo, descanso.restante])

  /**
   * Si el descanso está en su tramo de ráfaga.
   *
   * La ráfaga va al principio del descanso y no al final, y eso es lo que la
   * hace inofensiva: lo que queda pegado a la serie siguiente es descanso
   * verdadero, que es justamente lo que resintetiza la fosfocreatina.
   */
  const enRafaga =
    descanso.activo &&
    rafagaActual !== null &&
    !rafagaSalteada &&
    descanso.restante > rafagaActual.total - rafagaActual.segundos

  // Terminado el tramo, la ráfaga queda anotada. Una sola vez: lo que la anota
  // es `pendiente`, que se vacía al hacerlo.
  useEffect(() => {
    if (enRafaga) return
    cerrarRafaga()
    // `cerrarRafaga` lee y limpia un ref; no hace falta en las dependencias.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enRafaga])

  /**
   * Arrancar el descanso que sigue a una serie, con su ráfaga si le toca.
   *
   * Cada descanso vuelve a sortear lo que dice Lyra y vuelve a ofrecer la
   * ráfaga aunque la anterior se haya salteado: "hoy no" es de ese descanso.
   */
  function arrancar(
    segundos: number,
    elegida: { rafaga: Rafaga; segundos: number } | null,
    despuesDe: string,
  ) {
    setRafagaActual(
      elegida ? { ...elegida, total: segundos } : null,
    )
    setRafagaSalteada(false)
    setSumado(0)
    setAzarDeLaFrase(Math.random())
    pendiente.current = elegida
      ? { rafagaId: elegida.rafaga.id, segundos: elegida.segundos, despuesDe }
      : null
    descanso.arrancar(segundos)
  }

  /** Anota la ráfaga cuando su tramo terminó, y una sola vez. */
  function cerrarRafaga() {
    const hecha = pendiente.current
    if (!hecha) return
    pendiente.current = null
    setRafagas((previas) => [...previas, hecha])
  }

  /** Salteá la ráfaga sin saltear el descanso: lo que queda es descanso. */
  function saltearRafaga() {
    pendiente.current = null
    setRafagaSalteada(true)
  }

  /**
   * Cortar el descanso, venga de donde venga.
   *
   * Existe para que ningún camino pueda anotar una ráfaga que no se hizo: si se
   * corta el descanso antes de que el tramo de la ráfaga termine, la ráfaga se
   * descarta. Si ya había terminado, `pendiente` está en null y esto no hace
   * nada. Es más barato que acordarse en los cinco lugares que detienen el
   * descanso, y por lo mismo `alTerminar` va acá.
   */
  function cortar() {
    pendiente.current = null
    descanso.detener()
    avisar.current.alTerminar?.()
  }

  /** "+30 s": el reloj y lo que dice el arco, juntos. */
  function sumar(segundos: number) {
    if (!descanso.activo) return
    setSumado((antes) => antes + segundos)
    descanso.sumar(segundos)
  }

  return {
    activo: descanso.activo,
    restante: descanso.restante,
    sumado,
    /** La ráfaga, solo mientras dura su tramo. */
    rafaga: enRafaga && rafagaActual ? rafagaActual.rafaga : null,
    azarDeLaFrase,
    arrancar,
    sumar,
    cortar,
    saltearRafaga,
  }
}
