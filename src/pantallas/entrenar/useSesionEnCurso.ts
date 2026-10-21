/**
 * La sesión en curso y su red de contención: en qué ejercicio y en qué etapa
 * se está, qué se anotó, y el borrador que la devuelve entera si el navegador
 * recicla la pestaña.
 *
 * Todo lo que vive acá se guarda en el borrador y se restaura con él, o sale
 * de lo que se restauró: la clase de la sesión y las molestias que la cambian.
 * Lo que no sobrevive a una recarga —la predicción a medio hacer, los kilos
 * tocados, el panel abierto— se queda en `Entrenar`.
 */

import { useEffect, useMemo, useState } from 'react'
import { claseDeDia, type ClaseDeDia } from '@/dominio/rutinas'
import { molestiasDeLaSesion } from '@/dominio/molestia'
import { destinoDelBorrador, diaDelBorrador, fechaDelDia } from '@/dominio/borrador'
import type {
  Estado,
  PasoDelBorrador,
  Patron,
  RegistroRafaga,
  Semana,
  Serie,
  SesionEnCurso,
  TipoSesion,
} from '@/dominio/tipos'
import {
  descartarSesionEnCurso,
  fechaISO,
  guardarSesionEnCurso,
  leerSesionEnCurso,
  type ResumenSesion,
} from '@/datos/repositorio'

/**
 * Las etapas de la sesión, en orden.
 *
 * El bloque de fuelle va antes de la serie de cierre y no después, y el orden
 * no es un detalle: `docs/estrategia-2026.md` §2.4 dice que "terminá fuerte"
 * está contradicho por la regla del pico y el final, y la serie de cierre
 * existe justamente para que la sesión no termine en el punto más duro. Así la
 * sesión tiene su pico de exigencia y igual termina en algo que se puede
 * sostener.
 */
export type Etapa = 'series' | 'fuelle' | 'cierre-serie' | 'preguntas'

export function useSesionEnCurso({
  parametros,
  semana,
  estados,
}: {
  /** La URL con la que se abrió: `corta`, `fuelle` y `densa`. */
  parametros: URLSearchParams
  semana: Semana | null
  estados: Estado[] | undefined
}) {
  /**
   * Lo que el borrador dice de la clase de la sesión. Solo, no alcanza: lo
   * combinan con la URL y la semana `esCorta` y `claseDeLaSesion`, más abajo.
   */
  const [cortaRetomada, setCortaRetomada] = useState(false)
  const [fuelleRetomado, setFuelleRetomado] = useState(false)
  const [densaRetomada, setDensaRetomada] = useState(false)

  const [indice, setIndice] = useState(0)
  const [hechas, setHechas] = useState<Record<string, Serie[]>>({})
  const [etapa, setEtapa] = useState<Etapa>(
    // El día de fuelle arranca directamente en el bloque: no hay series que
    // hacer antes, y pasar por la pantalla de series sería ofrecer un plan que
    // hoy no toca.
    parametros.get('fuelle') === '1' ? 'fuelle' : 'series',
  )
  /**
   * La red de contención de la sesión.
   *
   * `arrancadaEn` es de cuándo empezó de verdad, no de cuándo montó el
   * componente: si el navegador recicló la pestaña, esos dos momentos son
   * distintos y el que vale es el primero. `retomada` es solo para decírselo a
   * la persona, y `listo` bloquea el primer render hasta saber si hay algo que
   * restaurar — si no, se vería un parpadeo de "serie 1 de 3" antes del salto.
   */
  const [arrancadaEn, setArrancadaEn] = useState<number | undefined>()
  const [retomada, setRetomada] = useState(false)
  const [listo, setListo] = useState(false)
  /**
   * El día de la sesión, fijo desde que arranca.
   *
   * Todo lo que depende del día —la clase del día, qué patrón toca en el
   * bloque que alterna, el estado sostenido, la vara de la vez pasada— se
   * calcula con esto y nunca con el reloj. Antes era `new Date()`, y una
   * sesión arrancada el miércoles a las 23:40 y retomada a las 00:05 se
   * rearmaba como del jueves: otro ejercicio en el tercer bloque, las series
   * hechas afuera, y la pantalla igual decía "sesión retomada". Sin recargar
   * pasaba lo mismo: alcanzaba con que algo hiciera rearmar el plan después
   * de la medianoche. Se guarda en el borrador en un campo propio.
   */
  const [dia, setDia] = useState(() => fechaISO())
  const fechaDeLaSesion = useMemo(() => fechaDelDia(dia), [dia])
  /**
   * Un borrador vencido con trabajo adentro, si se llegó acá directo sin pasar
   * por Hoy. Mientras esté, no se arranca nada: arrancar escribiría el
   * borrador nuevo encima del viejo, que es perderlo sin que nadie lo vea.
   */
  const [sinCerrar, setSinCerrar] = useState<SesionEnCurso | null>(null)
  /**
   * El fuelle: lo metabólico que se hizo en los huecos.
   *
   * Vive en el estado de la sesión y no adentro del componente del descanso
   * porque tiene que sobrevivir a que el navegador recicle la pestaña, igual
   * que las series. Se guarda en el borrador y se restaura con él.
   */
  const [rafagas, setRafagas] = useState<RegistroRafaga[]>([])
  /** Las cadenas con molestia que traía el borrador. Las suma `molestias`, más abajo. */
  const [molestiasRetomadas, setMolestiasRetomadas] = useState<Patron[]>([])

  /**
   * Retomar lo que había quedado a medio hacer.
   *
   * Corre una sola vez, antes de dibujar nada. Si hay un borrador vigente se
   * entra directamente donde se había quedado y en silencio: la persona no
   * eligió perder la sesión, así que tampoco tiene que elegir recuperarla. El
   * único aviso es el renglón de la retomada, en `Encabezado`, que además
   * ofrece la salida.
   *
   * Uno vencido con trabajo adentro no se retoma ni se borra: se muestra, con
   * "Guardarla" y "Descartarla", igual que en Hoy. Uno vencido y vacío no
   * tiene nada que perder y se tira. Lo decide `destinoDelBorrador`.
   */
  useEffect(() => {
    let vivo = true
    void leerSesionEnCurso()
      .then((borrador) => {
        if (!vivo) return
        const destino = borrador ? destinoDelBorrador(borrador, Date.now()) : null
        if (borrador && destino === 'ofrecer') {
          setSinCerrar(borrador)
          setArrancadaEn(Date.now())
        } else if (borrador && destino === 'retomar') {
          setIndice(borrador.indice)
          setHechas(borrador.hechas)
          setEtapa(borrador.etapa)
          setRafagas(borrador.rafagas ?? [])
          setMolestiasRetomadas(borrador.molestias ?? [])
          // Se re-ancla el arranque a lo que se llevaba entrenado, no a la
          // hora original: el hueco entre que te fuiste y volviste no es
          // tiempo de entrenamiento.
          setArrancadaEn(Date.now() - (borrador.duracionAcumulada ?? 0) * 1000)
          if (borrador.corta) setCortaRetomada(true)
          if (borrador.diaDeFuelle) setFuelleRetomado(true)
          if (borrador.densa) setDensaRetomada(true)
          // El día de la sesión, no el de hoy: es lo que mantiene el mismo
          // plan aunque el reloj haya pasado la medianoche.
          setDia(diaDelBorrador(borrador))
          setRetomada(true)
        } else {
          if (borrador) void descartarSesionEnCurso()
          // El arranque es ahora, no la primera serie anotada: entre abrir la
          // pantalla y anotar hay una entrada en calor que también es la sesión.
          setArrancadaEn(Date.now())
        }
      })
      .finally(() => {
        if (vivo) setListo(true)
      })
    return () => {
      vivo = false
    }
  }, [])

  /**
   * Si es una sesión corta.
   *
   * Sale de la URL o del borrador, y lo segundo importa tanto como lo primero:
   * la URL se pierde cuando el navegador recicla la pestaña, y al retomar
   * `/entrenar` sin el parámetro la sesión de siete minutos se cerraba como
   * sesión de plan. Una serie por ejercicio contra un objetivo de tres da un
   * rendimiento de 0,33, así que el motor le bajaba el objetivo a las cuatro
   * cadenas por series que nadie falló: nunca se las pidió.
   */
  const esCorta = parametros.get('corta') === '1' || cortaRetomada

  /**
   * Qué clase de día es esta sesión: fuerza, fuelle o las dos.
   *
   * Sale de tres lugares, en este orden, y los tres hacen falta:
   *
   * 1. **El borrador**, si la sesión se retomó. Manda sobre todo lo demás: una
   *    sesión que arrancó anoche a las 23:58 no puede cambiar de clase porque
   *    el reloj pasó la medianoche mientras se descansaba.
   * 2. **La URL**, que es lo que escribe `Hoy` al abrir. Es la respuesta ya
   *    calculada, y tomarla evita que las dos pantallas puedan diferir.
   * 3. **La semana**, si no hay ni lo uno ni lo otro. Acá estaba el agujero:
   *    entrar a `/entrenar` directo —un marcador, el atajo de la PWA, el botón
   *    de atrás— daba una sesión de fuerza pelada aunque el día fuera denso o
   *    de fuelle. La URL es un atajo, no la única fuente.
   *
   * Y si la semana dice que hoy no se entrena, la sesión es de fuerza a secas:
   * entrenar un día de más no puede quedar sin plan.
   */
  const claseDeLaSesion: ClaseDeDia = retomada
    ? fuelleRetomado
      ? 'fuelle'
      : densaRetomada
        ? 'ambos'
        : 'fuerza'
    : parametros.get('fuelle') === '1'
      ? 'fuelle'
      : parametros.get('densa') === '1'
        ? 'ambos'
        : semana
          ? (() => {
              const hoy = claseDeDia(semana, fechaDeLaSesion)
              return hoy === 'descanso' ? 'fuerza' : hoy
            })()
          : 'fuerza'

  const esDiaDeFuelle = claseDeLaSesion === 'fuelle'
  const esDiaDenso = claseDeLaSesion === 'ambos'

  /**
   * Las cadenas con una molestia avisada hoy, con el chequeo prendido o
   * apagado. Bajan un eslabón o se saltean, y ninguna ráfaga las carga.
   *
   * Más las que la sesión ya traía en el borrador: retirar la molestia a mitad
   * de camino no puede devolver el eslabón de siempre y dejar afuera las
   * series anotadas en el de abajo.
   *
   * "Hoy" es el día de la sesión, como en todo lo demás de esta pantalla: una
   * sesión que cruza la medianoche se sigue armando con la molestia del día en
   * que empezó. Y además con la que se avise pasada la medianoche, que queda
   * en la fila del día nuevo: es cómo está el cuerpo ahora, y Hoy ya la está
   * anunciando. Avisarla escribe en `estados`, así que el memo se rehace solo.
   */
  const molestias = useMemo(
    () => molestiasDeLaSesion(estados ?? [], dia, molestiasRetomadas, fechaISO()),
    [estados, dia, molestiasRetomadas],
  )

  /**
   * Un día de fuelle abierto sin el parámetro igual arranca en el bloque.
   *
   * `etapa` se decide en el primer render, cuando todavía no se leyeron las
   * preferencias, así que ahí lo único que hay es la URL. Entrando directo
   * —un marcador, el atajo de la PWA, el botón de atrás— la sesión abría la
   * pantalla de series de un día que no tiene series.
   *
   * Solo corrige hacia adelante y solo si no se hizo nada todavía: una sesión
   * retomada, o una con una serie anotada, manda ella.
   */
  useEffect(() => {
    if (!listo || retomada || etapa !== 'series') return
    if (Object.values(hechas).some((series) => series.length > 0)) return
    if (claseDeLaSesion === 'fuelle') setEtapa('fuelle')
  }, [listo, retomada, etapa, hechas, claseDeLaSesion])

  // Un borrador vencido con trabajo adentro, si se llegó directo: primero se
  // decide qué hacer con él, y recién después arranca la sesión de hoy.
  function arrancarDeNuevo() {
    setSinCerrar(null)
    setDia(fechaISO())
    setArrancadaEn(Date.now())
  }

  /**
   * Lo de la sesión que vuelve a cero al empezar de cero, borrador incluido.
   * La predicción, los kilos y el descanso son de la pantalla, y los limpia ella.
   */
  function deCero() {
    void descartarSesionEnCurso()
    setHechas({})
    setIndice(0)
    setEtapa('series')
    setArrancadaEn(Date.now())
    // Una sesión nueva es del día de hoy, aunque la descartada fuera de ayer.
    setDia(fechaISO())
    setCortaRetomada(false)
    setRetomada(false)
    setRafagas([])
    // De cero es de cero: la sesión nueva se arma con la molestia de hoy, no
    // con la del borrador que se acaba de descartar.
    setMolestiasRetomadas([])
  }

  return {
    esCorta,
    esDiaDeFuelle,
    esDiaDenso,
    molestias,
    indice,
    setIndice,
    hechas,
    setHechas,
    etapa,
    setEtapa,
    arrancadaEn,
    retomada,
    listo,
    dia,
    fechaDeLaSesion,
    sinCerrar,
    rafagas,
    setRafagas,
    arrancarDeNuevo,
    deCero,
  }
}

/**
 * Y guardarlo, después de cada cambio.
 *
 * Se escribe en IndexedDB y no en `sessionStorage` a propósito: iOS descarta
 * el sessionStorage de una pestaña reciclada, que es justamente el caso que
 * esto tiene que sobrevivir.
 *
 * No se guarda una sesión vacía. Un borrador sin una sola serie anotada no
 * tiene nada que restaurar, y dejarlo escrito haría que abrir la pantalla y
 * salir cuente como "sesión a medio hacer" para siempre.
 *
 * Tampoco se escribe sin plan ni con un borrador vencido esperando
 * respuesta: el primero dejaría `pasos` vacío —y el borrador sin con qué
 * guardarse— y el segundo pisaría la sesión que todavía no se mostró. Es un
 * hook aparte del que retoma porque necesita el plan y el tipo ya calculados,
 * y el plan se arma con lo que se retomó.
 */
export function useGuardarBorrador({
  listo,
  resumen,
  sinCerrar,
  cerrando,
  arrancadaEn,
  esCorta,
  esDiaDeFuelle,
  esDiaDenso,
  indice,
  etapa,
  hechas,
  rafagas,
  molestias,
  dia,
  pasos,
  tipo,
}: {
  listo: boolean
  resumen: ResumenSesion | null
  sinCerrar: SesionEnCurso | null
  /** Prendido mientras se cierra: lo que la transacción borra no se vuelve a escribir. */
  cerrando: { current: boolean }
  arrancadaEn: number | undefined
  esCorta: boolean
  esDiaDeFuelle: boolean
  esDiaDenso: boolean
  indice: number
  etapa: Etapa
  hechas: Record<string, Serie[]>
  rafagas: RegistroRafaga[]
  molestias: ReadonlySet<Patron>
  dia: string
  pasos: PasoDelBorrador[]
  tipo: TipoSesion
}) {
  useEffect(() => {
    if (!listo || resumen || sinCerrar || cerrando.current || pasos.length === 0) return
    const algo =
      Object.values(hechas).some((series) => series.length > 0) || rafagas.length > 0
    if (!algo) return
    const desde = arrancadaEn ?? Date.now()
    void guardarSesionEnCurso({
      arrancadaEn: desde,
      // Se recalcula acá y no se toma del cronómetro para no meter `duracion`
      // como dependencia del efecto: escribiría en la base una vez por segundo.
      duracionAcumulada: Math.max(0, Math.round((Date.now() - desde) / 1000)),
      corta: esCorta,
      diaDeFuelle: esDiaDeFuelle,
      densa: esDiaDenso,
      indice,
      etapa,
      hechas,
      ...(rafagas.length > 0 ? { rafagas } : {}),
      ...(molestias.size > 0 ? { molestias: [...molestias] } : {}),
      dia,
      pasos,
      tipo,
    })
    // `cerrando` es un ref: se lee en el momento, no dispara nada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    listo,
    resumen,
    sinCerrar,
    hechas,
    indice,
    etapa,
    arrancadaEn,
    esCorta,
    esDiaDeFuelle,
    esDiaDenso,
    rafagas,
    molestias,
    dia,
    pasos,
    tipo,
  ])
}
