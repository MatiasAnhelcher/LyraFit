/**
 * Entrenar.
 *
 * Es la única pantalla que se mira con el pulso a ciento cuarenta, de reojo,
 * entre respiraciones y a veces con sol de frente. Por eso conmuta la app
 * entera a noche fija: blanco puro sobre casi negro es el par de mayor
 * contraste del sistema, y acá es donde hace falta.
 *
 * Tres cosas nuevas, y ninguna es decorativa:
 *
 * - **La predicción antes de la primera serie de cada ejercicio.** Son dos
 *   pantallas y no una: primero "¿cuántas te salen ahora?" y después, hecha la
 *   serie, "¿cuántas hiciste?". Tienen que ser dos porque medir requiere dos
 *   momentos — la versión anterior guardaba el mismo número como predicho y
 *   como logrado, así que el error daba cero por construcción y la pantalla de
 *   progreso mostraba un 0 fijo que no medía nada—. Solo la primera serie: las
 *   dieciocho de una sesión serían dieciocho toques extra, y predecir la
 *   tercera no mide interocepción sino aritmética.
 *
 *   El resultado viene precargado con lo que predijiste, así que acertar
 *   cuesta cero toques. Eso ancla un poco la respuesta hacia la predicción y
 *   por lo tanto achica el error medido; el sesgo se acepta a ojos abiertos,
 *   porque la alternativa —precargar el objetivo— le cobra toques al que
 *   acertó, y nadie declara que hizo nueve cuando hizo siete por lo que diga
 *   una casilla. No da puntos a propósito: si diera puntos, se podría hacer
 *   trampa prediciendo bajo.
 *
 * - **La serie de cierre.** Después de la última serie prescrita se agrega una
 *   serie fácil, al sesenta por ciento, que nunca cuenta para fallo. Sale de
 *   la regla del pico y el final: lo que uno recuerda de una sesión, y lo que
 *   predice si va a haber una próxima, depende del pico y del final mucho más
 *   que del promedio. Terminar destruido envenena el recuerdo de todo lo demás.
 *
 * - **El descanso se muestra vaciando un arco**, en silencio y en lineal. Lo
 *   que había antes latía a opacidad variable: un elemento que late mientras
 *   tenés el pulso alto es estresante y encima hace ilegible el número. Y
 *   debajo del arco va una indicación de técnica, que rota: veinte minutos de
 *   sesión mirando un arco vaciarse eran el bloque de tiempo más grande de la
 *   app y estaba muerto, mientras la técnica de los treinta y nueve ejercicios
 *   vivía en una ficha a la que nadie entra a mitad de una serie.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { NOMBRE_PATRON, POR_ID, cadenaDe } from '@/dominio/biblioteca'
import { claseDeDia, patronDelBloque, rutinaActiva, semanaActiva } from '@/dominio/rutinas'
import type { ClaseDeDia } from '@/dominio/rutinas'
import { ajusteDelDia, bandaSostenida, cadenasCongeladas } from '@/dominio/estado'
import {
  avisosDeMolestia,
  bloqueConMolestia,
  fueraDeLaMolestia,
  lineaDeMolestia,
  molestiasDeLaSesion,
  type CambioPorMolestia,
} from '@/dominio/molestia'
import { seAbreHoy } from '@/dominio/anticipacion'
import { mueveElPlan } from '@/dominio/progresion'
import { dichoDelDescanso, type Expresion } from '@/dominio/frases'
import {
  dichoDeLoQueViene,
  loQueViene,
  rotuloDeLoQueViene,
  textoDeLoQueViene,
  type LoQueViene,
} from '@/dominio/siguiente'
import { callar, configurarVoz, decir } from '@/voz'
import { Lyra } from '@/componentes/lyra'
import { Arco } from '@/componentes/arco'
import {
  DESCANSO_DE_BAJADA,
  bajadaDe,
  ejercicioDelBloque,
  minutosDeSesion,
  sinEjerciciosRepetidos,
} from '@/dominio/bajada'
import {
  bloqueDeFuelle,
  minutosDelBloque,
  minutosDelDiaDeFuelle,
  rafagaDelDescanso,
  type Densidad,
  type Equipo,
  type PasoDeFuelle,
  type Rafaga,
} from '@/dominio/metabolico'
import { esVuelta, RECORTE_DE_VUELTA } from '@/dominio/adherencia'
import { haceCuanto, laVezPasada } from '@/dominio/estadisticas'
import type { Patron, RegistroEjercicio, RegistroRafaga, Serie, TipoSesion } from '@/dominio/tipos'
import {
  cerrarSesion,
  descartarSesionEnCurso,
  fechaISO,
  guardarSesionEnCurso,
  leerSesionEnCurso,
  leerAvances,
  leerEstados,
  leerPreferencias,
  leerSesiones,
  type ResumenSesion,
} from '@/datos/repositorio'
import { respaldarEnSilencio } from '@/datos/respaldo'
import { comoReloj, useCronometro, useTemporizador } from '@/hooks/useTemporizador'
import { useModoDePantalla, usePantallaDespierta } from '@/hooks/usePantalla'
import { configurarHaptica, configurarSonido, despertarAudio, sonar, tocar } from '@/respuesta'
import { Accion, AccionQuieta, Rotulo, nombreUnidad } from '@/componentes/ui'
import { ComoSeHace } from '@/componentes/comoSeHace'
import { Cierre } from './Cierre'

type Etapa = 'series' | 'fuelle' | 'cierre-serie' | 'preguntas'

/**
 * Cuántos minutos dura el bloque de fuelle del final.
 *
 * Va antes de la serie de cierre y no después, y el orden no es un detalle:
 * `docs/estrategia-2026.md` §2.4 dice que "terminá fuerte" está contradicho por
 * la regla del pico y el final, y la serie de cierre existe justamente para que
 * la sesión no termine en el punto más duro. Así la sesión tiene su pico de
 * exigencia y igual termina en algo que se puede sostener.
 */
export function Entrenar() {
  const navegar = useNavigate()
  const [parametros] = useSearchParams()
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
  const [cortaRetomada, setCortaRetomada] = useState(false)
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
  const [fuelleRetomado, setFuelleRetomado] = useState(false)
  const [densaRetomada, setDensaRetomada] = useState(false)

  const avances = useLiveQuery(leerAvances, [])
  const preferencias = useLiveQuery(leerPreferencias, [])
  const estados = useLiveQuery(leerEstados, [])
  const historial = useLiveQuery(() => leerSesiones(), [])

  const [indice, setIndice] = useState(0)
  const [hechas, setHechas] = useState<Record<string, Serie[]>>({})
  const [etapa, setEtapa] = useState<Etapa>(
    // El día de fuelle arranca directamente en el bloque: no hay series que
    // hacer antes, y pasar por la pantalla de series sería ofrecer un plan que
    // hoy no toca.
    parametros.get('fuelle') === '1' ? 'fuelle' : 'series',
  )
  const [resumen, setResumen] = useState<ResumenSesion | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [prediccion, setPrediccion] = useState<number | null>(null)
  /**
   * La predicción de la serie que está por hacerse, ya cerrada.
   *
   * Existe porque sin ella la medición era una mentira aritmética: se guardaba
   * el mismo número como predicho y como logrado, así que el error era cero por
   * construcción y "qué tan bien te conocés" mostraba un 0 fijo para siempre.
   * Medir requiere dos momentos separados, y no hay forma de evitarlo.
   *
   * `null` quiere decir que la serie en curso no tiene predicción: o porque la
   * función está apagada, o porque no es la primera serie del ejercicio, o
   * porque la pestaña murió entre predecir y anotar. En ese último caso la
   * serie se guarda sin predicción a propósito: un dato inventado después de
   * saber el resultado sería peor que ningún dato.
   */
  const [predicho, setPredicho] = useState<number | null>(null)
  /**
   * Los kilos puestos, por ejercicio.
   *
   * Es un mapa y no un número suelto por dos razones. La primera es que cada
   * ejercicio lleva su propia carga y una sesión pasa por varios. La segunda
   * la encontró el portón: la primera versión era un número con un
   * `useEffect` que lo reseteaba al cambiar de ejercicio, y ese efecto quedaba
   * DESPUÉS de los returns tempranos de este componente —React error #310,
   * "más hooks que en el render anterior"— así que la pantalla de entrenar
   * crasheaba entera. Derivado de un mapa no hace falta ningún hook.
   *
   * Lo que no está en el mapa arranca donde quedó la vez pasada, que es la
   * diferencia entre un toque y ocho: con discos de 2,5 kg, volver a veinte
   * cuesta ocho toques en CADA ejercicio de CADA sesión.
   */
  const [kgPuestos, setKgPuestos] = useState<Record<string, number>>({})
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

  const rutina = preferencias ? rutinaActiva(preferencias) : null
  const semana = preferencias ? semanaActiva(preferencias) : null

  /** La clase de esta sesión, con las tres fuentes en orden. */
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
              const hoy = claseDeDia(semana, new Date())
              return hoy === 'descanso' ? 'fuerza' : hoy
            })()
          : 'fuerza'

  const esDiaDeFuelle = claseDeLaSesion === 'fuelle'
  const esDiaDenso = claseDeLaSesion === 'ambos'

  /**
   * El panel de "cómo se hace", abierto encima de la sesión.
   *
   * Es estado local y no una ruta a propósito: navegar a la ficha desmontaría
   * la sesión, y aunque ahora el borrador la recupera, la persona igual perdería
   * el hilo de dónde estaba. Esto se abre adelante y se cierra, y abajo la
   * sesión nunca se movió.
   */
  const [explicando, setExplicando] = useState(false)
  const [listo, setListo] = useState(false)
  /**
   * El fuelle: lo metabólico que se hizo en los huecos.
   *
   * Vive en el estado de la sesión y no adentro del componente del descanso
   * porque tiene que sobrevivir a que el navegador recicle la pestaña, igual
   * que las series. Se guarda en el borrador y se restaura con él.
   */
  const [rafagas, setRafagas] = useState<RegistroRafaga[]>([])
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
   * La energía de antes no se pregunta: ya la contestaste.
   *
   * Si hoy hiciste el chequeo diario, el ítem de energía ES la medición previa.
   * Preguntarla otra vez al empezar la sesión sería cobrar dos veces por el
   * mismo dato, y el delta de vitalidad no vale un toque extra: vale reusar
   * uno que ya diste.
   *
   * Sin chequeo diario no hay delta, y está bien que no lo haya. Media
   * medición no es media respuesta, es una respuesta inventada.
   */
  const vitalidadPre = useMemo(
    () => estados?.find((e) => e.fecha === fechaISO())?.energia,
    [estados],
  )

  /**
   * Las cadenas con una molestia avisada hoy, con el chequeo prendido o
   * apagado. Bajan un eslabón o se saltean, y ninguna ráfaga las carga.
   *
   * Más las que la sesión ya traía en el borrador: retirar la molestia a mitad
   * de camino no puede devolver el eslabón de siempre y dejar afuera las
   * series anotadas en el de abajo.
   */
  const [molestiasRetomadas, setMolestiasRetomadas] = useState<Patron[]>([])
  const molestias = useMemo(
    () => molestiasDeLaSesion(estados ?? [], fechaISO(), molestiasRetomadas),
    [estados, molestiasRetomadas],
  )

  /**
   * Cuánto aprieta el fuelle, y con qué cuenta donde entrena.
   *
   * `densidad` dice cuán FUERTE, ya no en qué días: eso lo decide la clase del
   * día. El respaldo es suave y no apagada porque un día marcado con fuelle por
   * alguien que nunca abrió Ajustes tiene que traer algo, y suave es la única
   * densidad que no supone ni que puede saltar ni que tiene un cajón.
   */
  const densidad: Densidad =
    preferencias?.densidad === undefined || preferencias.densidad === 'apagada'
      ? 'suave'
      : preferencias.densidad
  const equipo: Equipo = useMemo(
    () => ({
      ...(preferencias?.puedeSaltar !== undefined ? { puedeSaltar: preferencias.puedeSaltar } : {}),
      ...(preferencias?.tieneEscalon !== undefined
        ? { tieneEscalon: preferencias.tieneEscalon }
        : {}),
    }),
    [preferencias?.puedeSaltar, preferencias?.tieneEscalon],
  )

  const duracion = useCronometro(resumen === null, arrancadaEn)
  const descanso = useTemporizador(() => {
    sonar('descanso')
    tocar('descanso')
  })

  useEffect(() => {
    configurarSonido(preferencias?.sonidoDescanso !== false)
    configurarHaptica(preferencias?.haptica !== false)
    configurarVoz(preferencias?.voz !== false)
  }, [preferencias?.sonidoDescanso, preferencias?.haptica, preferencias?.voz])

  /**
   * Retomar lo que había quedado a medio hacer.
   *
   * Corre una sola vez, antes de dibujar nada. Si hay un borrador vigente se
   * entra directamente donde se había quedado y en silencio: la persona no
   * eligió perder la sesión, así que tampoco tiene que elegir recuperarla. El
   * único aviso es el renglón de abajo, que además ofrece la salida.
   */
  useEffect(() => {
    let vivo = true
    void leerSesionEnCurso()
      .then((borrador) => {
        if (!vivo) return
        if (borrador) {
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
          setRetomada(true)
        } else {
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
   * Y guardarlo, después de cada cambio.
   *
   * Se escribe en IndexedDB y no en `sessionStorage` a propósito: iOS descarta
   * el sessionStorage de una pestaña reciclada, que es justamente el caso que
   * esto tiene que sobrevivir.
   *
   * No se guarda una sesión vacía. Un borrador sin una sola serie anotada no
   * tiene nada que restaurar, y dejarlo escrito haría que abrir la pantalla y
   * salir cuente como "sesión a medio hacer" para siempre.
   */
  useEffect(() => {
    if (!listo || resumen) return
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
    })
  }, [
    listo,
    resumen,
    hechas,
    indice,
    etapa,
    arrancadaEn,
    esCorta,
    esDiaDeFuelle,
    esDiaDenso,
    rafagas,
    molestias,
  ])

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
      // insoportables a la octava repetición de la sesión.
      if (faltan === 3) sonar('aviso')
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

  // Al desmontar, callar: si alguien sale a mitad de una frase, la frase sigue
  // sonando en la pantalla siguiente, que es de otra cosa.
  useEffect(() => callar, [])


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

  useModoDePantalla(resumen ? 'cierre' : 'entrenar')
  usePantallaDespierta(resumen === null)



  /** Qué clase de sesión es. Lo necesitan el factor, la anticipación y el cierre. */
  const tipo: TipoSesion = useMemo(
    () =>
      esDiaDeFuelle
        ? 'fuelle'
        : esCorta
          ? 'corta'
          : esVuelta(historial ?? [], fechaISO())
            ? 'vuelta'
            : 'plan',
    [esDiaDeFuelle, esCorta, historial],
  )

  /**
   * Si esta sesión lleva fuelle.
   *
   * La corta queda afuera y no hace falta una regla aparte para los descansos
   * —con una serie por ejercicio no hay ningún descanso— pero sí para el bloque
   * del final: siete minutos con diez de fuelle encima ya no son siete minutos,
   * y la sesión corta existe para que hacer algo sea barato.
   */
  const esDensa = esDiaDenso && !esCorta

  /**
   * La densidad con la que se arma el bloque.
   *
   * Apagada en un día que no lleva fuelle, y la elegida en los que sí. Antes
   * esto tenía que remendar el caso del día de fuelle con el fuelle apagado
   * —una pantalla vacía— y ya no puede pasar: `densidad` nunca vale apagada.
   */
  const densidadDelBloque: Densidad =
    esDiaDeFuelle || esDiaDenso ? densidad : 'apagada'


  /** El factor del día: estado sostenido y sesión de vuelta se multiplican. */
  const factor = useMemo(() => {
    if (!estados || !historial) return 1
    const ajuste = ajusteDelDia(bandaSostenida(estados, fechaISO()))
    const vuelta = esVuelta(historial, fechaISO()) ? RECORTE_DE_VUELTA : 1
    return ajuste.factor * vuelta
  }, [estados, historial])

  /**
   * Si hay barra con discos, que es lo que decide si los accesorios existen.
   *
   * Extraído a su propia constante y puesto en las dependencias del memo de
   * abajo, y eso NO es higiene: el memo leía `preferencias` sin depender de
   * ella. En el primer render `preferencias` todavía no cargó —viene de
   * `liveQuery`— así que el plan se armaba sin accesorios, y cuando las
   * preferencias llegaban el memo no volvía a correr. Resultado: los
   * accesorios con barra no aparecían NUNCA en la sesión, aunque Hoy los
   * hubiera anunciado un segundo antes.
   *
   * Un booleano en vez del objeto entero porque `preferencias` cambia con
   * cualquier ajuste, y rearmar el plan a mitad de una sesión por haber
   * tocado el sonido sería peor que el bug.
   */
  const tieneBarraCargable = (preferencias?.cargaMaximaKg ?? 0) > 0

  /**
   * Los ejercicios concretos de la sesión, según el avance de cada patrón, y
   * lo que la molestia de hoy le cambió a cada cadena, para decirlo.
   */
  const { plan, avisos } = useMemo(() => {
    if (!rutina || !semana || !avances) return { plan: [], avisos: [] }
    const cambios: { patron: Patron; cambio: CambioPorMolestia }[] = []
    // El `sinEjerciciosRepetidos` de afuera no es higiene: en un día denso con
    // una rutina por grupo, el mismo ejercicio entraba dos veces —la bajada
    // del bloque de cadena y el bloque de volumen resuelven al mismo eslabón—
    // y las dos entradas compartían el arreglo de series, porque `hechas` se
    // indexa por id de ejercicio y el plan es posicional.
    const entradas = sinEjerciciosRepetidos(rutina.bloques.flatMap((bloqueDelPlan) => {
      const bloque = {
        ...bloqueDelPlan,
        patron: patronDelBloque(bloqueDelPlan, semana, new Date()),
      }
      const avance = avances.get(bloque.patron)
      // La misma resolución que hace `Hoy`, desde el dominio: tres clases de
      // bloque —el eslabón del motor, volumen en el anterior, y un accesorio
      // fijo con barra—. Si las dos pantallas difirieran, Hoy anunciaría una
      // sesión y la sesión sería otra, que es exactamente el bug que
      // `patronDelBloque` ya había evitado una vez.
      const resuelto = ejercicioDelBloque(bloque, avance, POR_ID, cadenaDe(bloque.patron), {
        tieneBarraCargable,
      })
      if (!resuelto || !avance) return []
      // La molestia de hoy, con la misma función que usa `Hoy`. Lo que ya
      // tiene series anotadas en esta sesión no se toca: cambiarlo a mitad de
      // camino dejaría esas series fuera del plan, y el cierre no las
      // guardaría.
      const conMolestia = bloqueConMolestia(
        resuelto,
        molestias,
        POR_ID,
        cadenaDe(bloque.patron),
        { yaEmpezado: (hechas[resuelto.ejercicio.id]?.length ?? 0) > 0 },
      )
      if (conMolestia.cambio === 'saltea') {
        cambios.push({ patron: bloque.patron, cambio: 'saltea' })
        return []
      }
      const porMolestia = conMolestia.cambio === 'baja'
      if (porMolestia) cambios.push({ patron: bloque.patron, cambio: 'baja' })
      const { ejercicio, objetivo: delBloque, accesorio } = conMolestia
      // La vara de la vez pasada manda en un accesorio: el motor no lo
      // progresa —y no debe— así que la doble progresión la lleva la persona,
      // con el número de la última vez delante.
      const varaAccesoria = accesorio
        ? laVezPasada(historial ?? [], ejercicio.id, fechaISO())
        : null
      const base = varaAccesoria
        ? {
            series: delBloque.series,
            cantidad: Math.min(
              Math.max(varaAccesoria.mejor, ejercicio.ventana.min),
              ejercicio.ventana.max,
            ),
            ...(varaAccesoria.kg !== undefined ? { kg: varaAccesoria.kg } : {}),
          }
        : delBloque
      // La sesión corta es un ejercicio por cadena y una serie de cada uno.
      const series = esCorta ? 1 : base.series
      const cantidad = Math.max(1, Math.round(base.cantidad * factor))
      // La vez pasada de ESTE ejercicio, para poner una vara adentro de cada
      // casillero. Es lo que hace que la segunda sesión no se sienta idéntica
      // a la primera: los casilleros vacíos ya no están vacíos.
      // En el eslabón bajado por una molestia, no: la vez pasada de ese
      // eslabón puede ser su techo, y un 12 adentro del casillero invita a
      // buscar 12 justo en la zona que avisó, con el objetivo pidiendo el piso.
      // Es lo mismo que hace la bajada, que tampoco lleva vara.
      const antes =
        historial && !porMolestia ? laVezPasada(historial, ejercicio.id, fechaISO()) : null
      // Y si esta sesión, cumplida, abre el eslabón siguiente. Solo cuando la
      // sesión de verdad mueve la progresión: en una corta, una de vuelta o una
      // cadena congelada el dato sigue siendo correcto y la promesa sería falsa.
      const cuenta =
        mueveElPlan(tipo) &&
        !ajusteDelDia(bandaSostenida(estados ?? [], fechaISO())).neutra &&
        !cadenasCongeladas(estados ?? [], fechaISO()).has(bloque.patron)
      // Un accesorio nunca abre un eslabón: no está en ninguna cadena, o es el
      // anterior al que ya tenés. Anunciarlo sería una promesa falsa. El
      // eslabón bajado por una molestia, tampoco: no es el del motor.
      const abre =
        accesorio || porMolestia
          ? null
          : seAbreHoy(avance, cadenaDe(bloque.patron), POR_ID, cuenta)
      const duro = {
        ejercicio,
        objetivo: { series, cantidad, ...(base.kg !== undefined ? { kg: base.kg } : {}) },
        antes,
        abre,
        descansoSegundos: ejercicio.descansoSegundos,
        // Un accesorio ocupa el lugar de una bajada: marcarlo como tal lo deja
        // fuera de la curva de fuerza y del cálculo de rendimiento, que es
        // donde no tiene nada que hacer. El eslabón bajado por una molestia,
        // lo mismo: hacer el de abajo no es haber perdido fuerza.
        bajada: accesorio || porMolestia,
        porMolestia,
      }

      // Y, en las sesiones densas, volumen en el eslabón anterior.
      //
      // Es otro ejercicio, así que `cerrarSesion` lo saltea sin que nadie se lo
      // pida —"solo progresa el patrón si se entrenó el ejercicio que tocaba"—
      // y la curva de fuerza se queda con el máximo del día, así que tampoco
      // puede hundirla. Las dos cosas tienen su test en `bajada.test.ts`.
      // Un accesorio no lleva bajada encima: ya ES el trabajo liviano, o es un
      // movimiento con barra sin eslabón anterior del que bajar. Una cadena
      // con molestia tampoco: ya bajó, y no se carga dos veces.
      if (!esDensa || accesorio || porMolestia) return [duro]
      const abajo = bajadaDe(ejercicio, cadenaDe(bloque.patron), POR_ID)
      if (!abajo) return [duro]
      return [
        duro,
        {
          ejercicio: abajo.ejercicio,
          objetivo: abajo.objetivo,
          antes: null,
          abre: null,
          descansoSegundos: DESCANSO_DE_BAJADA,
          bajada: true,
          porMolestia: false,
        },
      ]
    }))
    return {
      plan: entradas,
      avisos: avisosDeMolestia(
        cambios,
        entradas.map((e) => e.ejercicio.patron),
      ),
    }
  }, [
    rutina,
    semana,
    avances,
    esCorta,
    esDensa,
    factor,
    historial,
    estados,
    tipo,
    tieneBarraCargable,
    molestias,
    hechas,
  ])

  /**
   * El bloque de fuelle: una prescripción fija, no un relleno.
   *
   * Antes esto se dimensionaba para que la sesión llegara a la duración elegida,
   * y ese era el error de fondo: la app optimizaba "que dure una hora" en vez de
   * "que sirva". La sesión dura lo que dura; lo que se elige es cuán fuerte.
   */
  const minutosDeFuerza = useMemo(() => minutosDeSesion(plan), [plan])

  const fuelle: PasoDeFuelle[] = useMemo(() => {
    if (densidadDelBloque === 'apagada') return []
    // Las ráfagas del bloque tampoco cargan la cadena con molestia: el bloque
    // es lo que se hace sin que nadie lo mida, y por eso mismo no puede caer
    // encima de la zona que avisó.
    if (esDiaDeFuelle) {
      return bloqueDeFuelle(
        minutosDelDiaDeFuelle(densidadDelBloque),
        equipo,
        densidadDelBloque,
        molestias,
      )
    }
    if (!esDensa) return []
    return bloqueDeFuelle(
      minutosDelBloque(minutosDeFuerza, densidadDelBloque),
      equipo,
      densidadDelBloque,
      molestias,
    )
  }, [esDensa, esDiaDeFuelle, densidadDelBloque, equipo, minutosDeFuerza, molestias])

  /*
   * Un plan vacío por la molestia no es una sesión que todavía carga.
   *
   * Pasa cuando todo lo que la rutina pedía hoy es de la cadena que avisó y
   * esa cadena está en su primer eslabón —o lo demás necesita una barra que no
   * hay—. Sin esto la pantalla se quedaba en "preparando" para siempre: se
   * dice lo que pasó y se ofrece volver.
   */
  if (avances && preferencias && historial && listo && plan.length === 0 && avisos.length > 0) {
    return (
      <div className="flex min-h-dvh flex-col">
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4">
          <Rotulo>HOY</Rotulo>
          {avisos.map((aviso) => (
            <p
              key={aviso.patron}
              className="mt-3 max-w-[34ch] text-lg leading-snug"
              data-prueba="linea-molestia"
            >
              {lineaDeMolestia(aviso)}
            </p>
          ))}
          <p className="mt-4 max-w-[36ch] text-sm leading-relaxed text-[var(--color-glosa)]">
            Sin esa cadena, la sesión de hoy se queda sin ejercicios.
          </p>
        </main>
        <div className="mt-auto">
          <AccionQuieta onClick={() => navegar('/')}>Volver</AccionQuieta>
        </div>
      </div>
    )
  }

  if (!avances || !preferencias || !historial || !listo || plan.length === 0) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Rotulo>PREPARANDO LA SESIÓN…</Rotulo>
      </div>
    )
  }

  if (resumen) {
    return <Cierre resumen={resumen} duracion={duracion} alSalir={() => navegar('/')} />
  }

  // El índice viene de un borrador que se escribió con otro plan en la mano.
  // Hoy el plan puede ser más corto —cambió la rutina, cambió un eslabón— así
  // que se acota: entrar por un índice que no existe rompe la pantalla entera.
  const enCurso = Math.min(Math.max(indice, 0), plan.length - 1)
  const paso = plan[enCurso]!
  const { ejercicio, objetivo, antes, abre, descansoSegundos, bajada, porMolestia } = paso

  /* Los kilos arrancan donde quedaron la vez pasada. Va en un efecto y no en
     el estado inicial porque el ejercicio cambia sin que el componente se
     vuelva a montar, y arrancar siempre en cero costaría ocho toques por
     ejercicio y por sesión para volver a veinte kilos. */
  /* Los kilos del ejercicio en curso, derivados, y el ORDEN importa:
     lo que tocaste hoy, después lo que el MOTOR propuso, y recién después lo
     que usaste la vez pasada.

     El del medio es el que faltaba. Desde que el motor puede decir "subí a
     12,5 kg" al llegar al final de una cadena, ese número tiene que estar
     puesto cuando la persona llega a la serie: si no, el motor propone un
     disco, lo escribe en la explicación del cierre, y al día siguiente la
     pantalla muestra callada el peso viejo. La propuesta quedaría en un texto
     que nadie va a seguir a mano. */
  const kg = kgPuestos[ejercicio.id] ?? objetivo.kg ?? antes?.kg ?? 0
  const ponerKg = (valor: number) =>
    setKgPuestos((previos) => ({ ...previos, [ejercicio.id]: valor }))

  /* Los discos solo se ofrecen cuando hay con qué: el peso del cuerpo, que es
     lo único que deja pasar kilos a la escala del motor, y una barra. Sin eso
     la fila no aparece, que es lo mismo que hace la vibración en iOS. */
  const tope = preferencias?.cargaMaximaKg ?? 0
  const pasoDeDisco = preferencias?.pasoDeDiscoKg ?? 2.5
  const puedeCargar = preferencias?.pesoCorporalKg !== undefined && tope > 0
  const series = hechas[ejercicio.id] ?? []
  const completo = series.length >= objetivo.series
  const esUltimo = enCurso === plan.length - 1
  const propuesto = prediccion ?? objetivo.cantidad
  const salto = ejercicio.medida === 'segundos' ? 5 : 1

  /**
   * ¿Toca predecir antes de esta serie?
   *
   * Solo en la primera de cada ejercicio, y por dos razones. Una es el costo:
   * predecir las dieciocho series de una sesión son dieciocho toques extra, y
   * esta app no le cobra a nadie dieciocho toques por una métrica secundaria.
   * La otra es que predecir la tercera serie no mide interocepción, mide
   * aritmética — ya hiciste dos y sabés cómo viene la mano—. La primera serie
   * es el único momento en que la pregunta es sobre el cuerpo y no sobre el
   * historial de los últimos cuatro minutos.
   *
   * Cuatro predicciones por sesión llegan a las treinta series que pide la
   * calibración en unas ocho sesiones. Es más lento que antes y, a diferencia
   * de antes, mide algo.
   */
  const tocaPredecir =
    preferencias.prediccionActiva !== false &&
    // En la bajada no: la calibración mide qué tan bien se conoce uno el cuerpo
    // en el ejercicio que está costando, y preguntarla en un eslabón ya
    // dominado cobra toques para medir algo que ya se sabe.
    !bajada &&
    series.length === 0 &&
    predicho === null

  // La serie de cierre: el ejercicio más fácil de la sesión, al 60%. Fuera de
  // la cadena con molestia mientras haya otra cosa: el eslabón bajado suele
  // ser el más fácil, y una serie más ahí es volver a cargar la zona.
  const candidatasDeCierre = fueraDeLaMolestia(plan, molestias)
  const cierre = candidatasDeCierre.reduce(
    (facil, p) => (p.ejercicio.ccr < facil.ejercicio.ccr ? p : facil),
    candidatasDeCierre[0]!,
  )
  const objetivoCierre = Math.max(1, Math.round(cierre.objetivo.cantidad * 0.6))

  /**
   * Qué viene después, cuando falta poco para que haga falta saberlo.
   *
   * Null mientras queden dos series o más: ahí lo que viene es otra serie del
   * mismo ejercicio. La decisión entera está en el dominio, con test.
   */
  const viene = loQueViene({
    plan: plan.map((paso) => ({ nombre: paso.ejercicio.nombre, bajada: paso.bajada })),
    enCurso,
    quedan: objetivo.series - series.length,
    hayFuelle: fuelle.length > 0,
    nombreDelCierre: esDiaDeFuelle ? null : cierre.ejercicio.nombre,
  })

  function registrarSerie(
    idEjercicio: string,
    logrado: number,
    predicho?: number,
    esCierre?: boolean,
  ) {
    setHechas((previas) => ({
      ...previas,
      [idEjercicio]: [
        ...(previas[idEjercicio] ?? []),
        {
          logrado,
          ...(predicho !== undefined ? { predicho } : {}),
          ...(esCierre ? { cierre: true as const } : {}),
          // Los kilos de ESTA serie, que es donde de verdad viven: los discos
          // se cambian entre serie y serie. La serie de cierre va sin ellos
          // porque es la fácil del final y se hace a peso corporal.
          ...(kg > 0 && !esCierre ? { kg } : {}),
        },
      ],
    }))
    setPrediccion(null)
  }

  function anotar() {
    // Idempotente y casi gratis si el audio ya está andando. Está acá como
    // red: si alguien entra a /entrenar por la URL, el gesto de Hoy no ocurrió.
    despertarAudio()

    const logrado = Math.max(0, propuesto)
    registrarSerie(ejercicio.id, logrado, predicho ?? undefined)
    setPredicho(null)

    const quedan = objetivo.series - (series.length + 1)
    tocar(quedan === 0 ? 'ejercicio' : quedan === 1 ? 'quedaUna' : 'serie')

    // Y acá habla, UNA vez por ejercicio: cuando el ejercicio se completa y la
    // transición que viene no tiene descanso, ni sonido, ni nada que leer sin
    // mirar. En los demás casos la pantalla ya lo dice bien y repetirlo en voz
    // sería ruido. Va adentro de `anotar` porque `anotar` es un gesto de la
    // persona, que es lo único que en iOS deja hablar al navegador.
    if (quedan === 0) {
      const loDicho = loQueViene({
        plan: plan.map((paso) => ({ nombre: paso.ejercicio.nombre, bajada: paso.bajada })),
        enCurso,
        quedan: 0,
        hayFuelle: fuelle.length > 0,
        nombreDelCierre: esDiaDeFuelle ? null : cierre.ejercicio.nombre,
      })
      if (loDicho) decir(dichoDeLoQueViene(loDicho))
    }

    if (quedan > 0) {
      // Qué ráfaga entra en ESTE descanso. El patrón que viene es el de este
      // mismo ejercicio —lo que sigue es otra serie suya— y por eso el dominio
      // nunca va a devolver algo que lo cargue: saltos de sentadilla antes de
      // una serie de sentadillas le costarían repeticiones, y el motor leería
      // esas repeticiones de menos como pérdida de fuerza.
      // Y tampoco una que cargue una cadena con molestia, aunque no sea la que
      // viene: el filtro mira todo lo que la ráfaga carga.
      const elegida = esDensa
        ? rafagaDelDescanso({
            descansoSegundos,
            patronQueViene: ejercicio.patron,
            equipo,
            densidad,
            indice: rafagas.length,
            evitar: molestias,
          })
        : null
      setRafagaActual(
        elegida ? { ...elegida, total: descansoSegundos } : null,
      )
      setRafagaSalteada(false)
      setAzarDeLaFrase(Math.random())
      pendiente.current = elegida
        ? { rafagaId: elegida.rafaga.id, segundos: elegida.segundos, despuesDe: ejercicio.id }
        : null
      descanso.arrancar(descansoSegundos)
    }
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
   * descanso.
   */
  function cortarDescanso() {
    pendiente.current = null
    descanso.detener()
  }

  function deshacer() {
    setHechas((previas) => ({
      ...previas,
      [ejercicio.id]: (previas[ejercicio.id] ?? []).slice(0, -1),
    }))
    cortarDescanso()
    setPredicho(null)
    // El tacto sí: es el único patrón de la app que baja, y confirma que la
    // corrección entró sin tener que mirar. El sonido no, porque deshacer es
    // una corrección y no un evento.
    tocar('deshacer')
  }

  /**
   * Empezar de cero: la salida de la sesión retomada.
   *
   * Existe porque restaurar en silencio es lo correcto para el caso común —te
   * sacó un llamado— pero deja sin salida al otro: el que se fue a propósito y
   * quiere arrancar limpio. Un toque, sin confirmación: no borra nada que esté
   * guardado, solo un borrador.
   */
  function empezarDeCero() {
    void descartarSesionEnCurso()
    setHechas({})
    setIndice(0)
    setEtapa('series')
    setPrediccion(null)
    setPredicho(null)
    setKgPuestos({})
    setArrancadaEn(Date.now())
    setCortaRetomada(false)
    setRetomada(false)
    setRafagas([])
    // De cero es de cero: la sesión nueva se arma con la molestia de hoy, no
    // con la del borrador que se acaba de descartar.
    setMolestiasRetomadas([])
    cortarDescanso()
  }

  function avanzar() {
    cortarDescanso()
    setPrediccion(null)
    setPredicho(null)
    if (!esUltimo) setIndice((i) => i + 1)
    else setEtapa(fuelle.length > 0 ? 'fuelle' : 'cierre-serie')
  }

  async function terminar(datos: {
    esfuerzo?: number
    animo?: number
    vitalidadPost?: number
  }) {
    setGuardando(true)
    cortarDescanso()

    const registros: RegistroEjercicio[] = plan.map(({ ejercicio: e, objetivo: o, bajada: b }) => ({
      ejercicioId: e.id,
      objetivo: o,
      series: hechas[e.id] ?? [],
      ...(b ? { bajada: true as const } : {}),
    }))

    try {
      const cerrada = await cerrarSesion({
        registros,
        duracionSegundos: duracion,
        tipo,
        ...(rafagas.length > 0 ? { rafagas } : {}),
        ...(esDensa ? { densa: true as const } : {}),
        ...(vitalidadPre !== undefined ? { vitalidadPre } : {}),
        ...datos,
      })
      setResumen(cerrada)
      // La sesión ya está guardada de verdad: el borrador dejó de hacer falta.
      await descartarSesionEnCurso()
      // El respaldo ocurre solo, sin avisar y sin poder romper nada.
      void respaldarEnSilencio()
    } finally {
      setGuardando(false)
    }
  }

  const algoRegistrado = Object.values(hechas).some((s) => s.length > 0)

  if (etapa === 'preguntas') {
    return (
      <Preguntas
        guardando={guardando}
        onListo={(datos) => void terminar(datos)}
      />
    )
  }

  if (etapa === 'fuelle') {
    return (
      <BloqueDeFuelle
        pasos={fuelle}
        onRafaga={(hecha) => setRafagas((previas) => [...previas, hecha])}
        onListo={() => setEtapa(esDiaDeFuelle ? 'preguntas' : 'cierre-serie')}
        onSaltear={() => setEtapa(esDiaDeFuelle ? 'preguntas' : 'cierre-serie')}
      />
    )
  }

  if (etapa === 'cierre-serie') {
    return (
      <SerieDeCierre
        nombre={cierre.ejercicio.nombre}
        cantidad={objetivoCierre}
        medida={cierre.ejercicio.medida}
        onHecho={() => {
          registrarSerie(cierre.ejercicio.id, objetivoCierre, undefined, true)
          tocar('ejercicio')
          setEtapa('preguntas')
        }}
        onSaltear={() => setEtapa('preguntas')}
      />
    )
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {explicando && <ComoSeHace ejercicio={ejercicio} alCerrar={() => setExplicando(false)} />}
      <header className="flex items-center justify-between px-4 py-3">
        <button onClick={() => navegar('/')} className="rotulo">
          Salir
        </button>
        <p className="cifra text-sm text-[var(--color-glosa)]" data-prueba="cronometro">
          {comoReloj(duracion)}
        </p>
      </header>

      <div className="flex gap-px px-4">
        {plan.map((p, i) => (
          <div
            key={p.ejercicio.id}
            className="h-0.5 flex-1"
            style={{
              backgroundColor: i <= enCurso ? 'var(--color-vega)' : 'var(--color-regla)',
              opacity: i < enCurso ? 0.5 : 1,
            }}
          />
        ))}
      </div>

      {/* El único aviso de que esto se retomó. Va acá y no en un cartel: lo
          que hay que comunicar es "no perdiste nada", y para eso alcanza con
          que las series ya anotadas estén en su lugar. El botón es para el
          otro caso, el que salió a propósito y quiere arrancar limpio. */}
      {retomada && (
        <p className="rotulo mt-3 flex items-center justify-between gap-3 px-4">
          <span>sesión retomada donde la dejaste</span>
          <button onClick={empezarDeCero} className="underline underline-offset-4">
            empezar de cero
          </button>
        </p>
      )}

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-8">
        <Rotulo>
          {NOMBRE_PATRON[ejercicio.patron].toUpperCase()} · SERIE {Math.min(series.length + 1, objetivo.series)} DE{' '}
          {objetivo.series}
        </Rotulo>
        <div className="mt-2 flex items-start justify-between gap-3">
          <h1
            className="text-3xl font-bold leading-tight tracking-tight"
            data-prueba="titulo-ejercicio"
          >
            {ejercicio.nombre}
          </h1>
          {/* El acceso a la explicación, en la sesión y no afuera. Va al lado
              del nombre porque la pregunta "¿cómo era esto?" aparece mirando el
              nombre, no buscándola en un menú. */}
          <button
            onClick={() => setExplicando(true)}
            className="rotulo shrink-0 whitespace-nowrap underline underline-offset-4"
          >
            cómo se hace
          </button>
        </div>

        {/* La víspera, adentro de la sesión: lo que está en juego hoy en esta
            cadena. Es una sola línea y aparece muy poco —solo cuando falta
            exactamente una sesión— porque una anticipación permanente deja de
            ser una anticipación. Y no dice "esta serie": el motor decide al
            cerrar la sesión, no al anotar una serie, y decirlo de otra forma
            sería prometer algo que la app no controla.

            Va en texto normal y no en rótulo: un rótulo en versalitas espaciadas
            es para dos palabras, y una frase entera ahí se lee como un segundo
            título gritándole al nombre del ejercicio. Tampoco va en `.glosa`:
            esta pantalla apaga la voz del motor a propósito, y eso es una
            decisión de diseño, no un descuido que haya que esquivar. */}
        {abre && (
          <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-[var(--color-glosa)]">
            Si cerrás esta sesión, pasás a{' '}
            <span className="text-[var(--color-tinta)]">{abre.nombre.toLowerCase()}</span>.
          </p>
        )}

        {/* La molestia, dicha donde cambia algo. La cadena bajada lo dice en
            su propio ejercicio; la salteada no tiene ejercicio donde decirlo,
            así que va en el primero, que es donde la persona está mirando
            cuando la sesión arranca. Una línea, con el motivo y sin retar:
            avisar fue lo correcto. Mismo tono que la víspera, por lo mismo. */}
        {porMolestia && (
          <p
            className="mt-2 max-w-[34ch] text-sm leading-relaxed text-[var(--color-glosa)]"
            data-prueba="linea-molestia"
          >
            {lineaDeMolestia({ patron: ejercicio.patron, cambio: 'baja' })}
          </p>
        )}
        {enCurso === 0 &&
          avisos
            .filter((aviso) => aviso.cambio === 'saltea')
            .map((aviso) => (
              <p
                key={aviso.patron}
                className="mt-2 max-w-[34ch] text-sm leading-relaxed text-[var(--color-glosa)]"
                data-prueba="linea-molestia"
              >
                {lineaDeMolestia(aviso)}
              </p>
            ))}

        {/* Los casilleros, con la vara adentro.
            Un casillero vacío no dice nada; un casillero con el número de la
            vez pasada dice exactamente qué hay que hacer, y lo dice con un dato
            que puso la propia persona. Cuando la serie se anota, el número de
            hoy lo tapa: la comparación importa antes, no después. */}
        <ul className="mt-6 flex gap-2" aria-label="Series de este ejercicio">
          {Array.from({ length: objetivo.series }).map((_, i) => {
            const serie = series[i]
            const activa = i === series.length
            const vara = antes?.logros[i]
            return (
              <li
                key={i}
                className="cifra relative flex h-14 flex-1 items-center justify-center text-lg"
                style={{
                  border: `1px ${activa && !serie ? 'dashed' : 'solid'} ${
                    serie || activa ? 'var(--color-vega)' : 'var(--color-regla)'
                  }`,
                  color: serie ? 'var(--color-tinta)' : 'var(--color-glosa)',
                }}
                aria-label={
                  serie
                    ? `Serie ${i + 1}: ${serie.logrado}`
                    : vara !== undefined
                      ? `Serie ${i + 1}, sin hacer. La vez pasada: ${vara}`
                      : `Serie ${i + 1}, sin hacer`
                }
              >
                {serie ? serie.logrado : vara !== undefined ? <span className="vara">{vara}</span> : '·'}
              </li>
            )
          })}
        </ul>

        {antes && (
          <p className="rotulo mt-2 text-right">
            {antes.hace === 0 ? 'hoy, más temprano' : `la vez pasada, ${haceCuanto(antes.hace)}`}
          </p>
        )}

        {descanso.activo ? (
          <Descanso
            restante={descanso.restante}
            total={descansoSegundos}
            clave={{
              tecnica: ejercicio.tecnica,
              faltan: objetivo.series - series.length,
              indice: enCurso,
              total: plan.length,
              azar: azarDeLaFrase,
            }}
            rafaga={enRafaga && rafagaActual ? rafagaActual.rafaga : null}
            viene={viene}
            onSumar={() => descanso.sumar(30)}
            onSaltear={cortarDescanso}
            onSaltearRafaga={saltearRafaga}
          />
        ) : completo ? (
          <section className="flex flex-1 flex-col items-center justify-center text-center">
            <Rotulo>EJERCICIO COMPLETO</Rotulo>
            {/* Acá está el agujero que se tapa.
                Esta pantalla decía "ejercicio completo" y nada más, y es el
                instante exacto en que se pierde el hilo: la transición entre
                ejercicios no tiene descanso —`anotar` solo lo arranca si queda
                otra serie— así que cambiaba el título y había que leerlo.

                `aria-live` es gratis y es la respuesta honesta al "sin mirar"
                para quien ya usa lector de pantalla: lo escucha con su voz, su
                idioma y su volumen. Cambia una vez por ejercicio, así que no es
                ruido — sobre el reloj sería un desastre, y por eso no va ahí.

                El botón de abajo NO cambia de etiqueta: "Siguiente ejercicio" y
                "Terminar" los clickean tres portones por nombre. El nombre de
                lo que viene va acá, que además es donde la mirada ya está. */}
            {viene && (
              <div className="mt-6" aria-live="polite">
                <Rotulo>{rotuloDeLoQueViene(viene)}</Rotulo>
                <p
                  className="mt-1 max-w-[20ch] text-lg font-semibold leading-tight"
                  data-prueba="lo-que-viene"
                >
                  {textoDeLoQueViene(viene)}
                </p>
              </div>
            )}
            <button onClick={deshacer} className="mt-6 text-sm text-[var(--color-glosa)] underline underline-offset-4">
              Deshacer la última serie
            </button>
          </section>
        ) : (
          <section className="flex flex-1 flex-col justify-center pb-8">
            {/* La pregunta dice en qué momento estás.
                Antes decía "¿Cuántas te salen ahora?" y abajo el botón decía
                "Anotar serie": la misma pantalla preguntaba por lo que iba a
                pasar y guardaba lo que había pasado. De ahí salía el cero
                eterno de la calibración. Ahora son dos preguntas distintas
                porque son dos momentos distintos. */}
            <p className="text-center text-sm text-[var(--color-glosa)]">
              {tocaPredecir
                ? '¿Cuántas te salen ahora?'
                : predicho !== null
                  ? '¿Cuántas hiciste?'
                  : `${nombreUnidad(ejercicio.medida)} de esta serie`}
            </p>

            <div className="mt-4 flex items-center justify-center gap-6">
              <button
                onClick={() => setPrediccion(Math.max(0, propuesto - salto))}
                className="paso h-16 w-16 text-3xl"
                aria-label="Restar"
              >
                −
              </button>
              <p className="cifra w-32 text-center text-7xl" data-prueba="repeticiones">
                {propuesto}
              </p>
              <button
                onClick={() => setPrediccion(propuesto + salto)}
                className="paso h-16 w-16 text-3xl"
                aria-label="Sumar"
              >
                +
              </button>
            </div>

            {/* Los discos. Cerrado por defecto: la inmensa mayoría de los
                ejercicios de esta app se hacen con el cuerpo y una fila de
                kilos en todos sería mobiliario.

                Los rótulos dicen "peso" y no "sumar" o "restar" a propósito:
                `rescate.mjs` busca los botones de repeticiones por nombre y
                sin `exact`, así que un aria-label con esas palabras le parte
                el portón por ambigüedad. Y el número va en `w-20` y no en
                `w-32` por lo mismo: el portón lee `main p.cifra.w-32` para
                sacar las repeticiones. */}
            {puedeCargar &&
              (kg > 0 ? (
                <div className="mt-5 flex items-center justify-center gap-3">
                  <button
                    onClick={() => ponerKg(Math.max(0, Number((kg - pasoDeDisco).toFixed(2))))}
                    className="paso h-10 w-10"
                    aria-label="Menos peso"
                  >
                    −
                  </button>
                  <span className="cifra w-20 text-center text-lg" data-prueba="kilos">
                    {kg} kg
                  </span>
                  <button
                    onClick={() => ponerKg(Math.min(tope, Number((kg + pasoDeDisco).toFixed(2))))}
                    className="paso h-10 w-10"
                    aria-label="Más peso"
                  >
                    +
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => ponerKg(pasoDeDisco)}
                  className="rotulo mt-5 block w-full text-center underline underline-offset-4"
                >
                  Con discos
                </button>
              ))}

            {series.length > 0 && (
              <button
                onClick={deshacer}
                className="mt-6 text-center text-sm text-[var(--color-glosa)] underline underline-offset-4"
              >
                Deshacer la última
              </button>
            )}
          </section>
        )}
      </main>

      <div className="mt-auto">
        {!completo && !descanso.activo && (
          <Accion
            esfuerzo
            onClick={
              tocaPredecir
                ? () => {
                    // Se cierra la predicción y se deja el mismo número puesto:
                    // si acertaste, anotar cuesta un toque y nada más.
                    despertarAudio()
                    setPredicho(propuesto)
                  }
                : anotar
            }
          >
            {tocaPredecir ? 'Voy' : 'Anotar serie'}
          </Accion>
        )}
        {completo && (
          <Accion esfuerzo onClick={avanzar}>
            {esUltimo ? 'Terminar' : 'Siguiente ejercicio'}
          </Accion>
        )}
        {!completo && !esUltimo && (
          <AccionQuieta onClick={avanzar}>Saltear este ejercicio</AccionQuieta>
        )}
        {!completo && esUltimo && algoRegistrado && (
          <AccionQuieta onClick={() => setEtapa(fuelle.length > 0 ? 'fuelle' : 'cierre-serie')}>
            Terminar acá
          </AccionQuieta>
        )}
      </div>
    </div>
  )
}

/**
 * El aviso de lo que viene, en una línea.
 *
 * Está en un solo lugar a propósito. Antes el `<p>` estaba escrito adentro de
 * una de las dos ramas del descanso y la otra rama quedaba sin aviso: el mismo
 * error que duplicar el arco, con la diferencia de que acá no se ve, porque
 * nadie mira las dos ramas en la misma sesión.
 */
function Aviso({ viene, className = '' }: { viene: LoQueViene | null; className?: string }) {
  if (!viene) return null
  return (
    <p className={`rotulo ${className}`} aria-live="polite">
      después · <span className="text-[var(--color-tinta)]">{textoDeLoQueViene(viene)}</span>
    </p>
  )
}

/** El descanso: un arco que se vacía en silencio. Lineal, porque es tiempo real. */
function Descanso({
  restante,
  total,
  clave,
  rafaga,
  viene,
  onSumar,
  onSaltear,
  onSaltearRafaga,
}: {
  restante: number
  total: number
  /**
   * Lo que hace falta para saber QUÉ decir en este descanso: la técnica del
   * ejercicio, cuántas series faltan, en qué lugar de la sesión está y el azar
   * de este descanso. Lo decide `dichoDelDescanso`, en el dominio.
   */
  clave: {
    tecnica: string[]
    faltan: number
    indice: number
    total: number
    azar: number
  }
  /**
   * La ráfaga, si este descanso está en su tramo metabólico. En null el
   * descanso es exactamente el que era antes de que existiera el fuelle.
   */
  rafaga: Rafaga | null
  /**
   * Lo que viene después del ejercicio, o null si todavía faltan dos series.
   * Lo resuelve el dominio; acá solo se dibuja.
   */
  viene: LoQueViene | null
  onSumar: () => void
  onSaltear: () => void
  onSaltearRafaga: () => void
}) {
  // Lo que se dice en el descanso, y con qué cara. La decisión entera vive en
  // el dominio, con test: son cuatro caminos y la garantía de que ninguno deja
  // el descanso mudo, que es justo lo que se rompe sin que nadie lo note.
  //
  // Sesenta o noventa segundos por serie son unos veinte minutos de sesión
  // mirando un arco vaciarse: es el bloque de tiempo más grande de la app y
  // estaba muerto. La técnica ya estaba escrita para los cuarenta y siete
  // ejercicios y no la veía nadie, porque para leerla hay que salir de la
  // sesión y entrar a la ficha, que es exactamente lo que nadie hace con el
  // pulso a ciento cuarenta.
  //
  // Y quién lo dice: Lyra, en el descanso y NUNCA durante la serie. El aliento
  // verbal aumenta las repeticiones, pero funciona como voz, no como algo que
  // compita por la mirada mientras se lee un número.
  //
  // Los errores comunes no van acá y sí en la ficha: un "no hagas esto" leído
  // de reojo y a medias se puede entender al revés, y la ficha tiene lugar
  // para enmarcarlo.
  const dicho = dichoDelDescanso(clave)
  const texto = dicho?.texto ?? null
  const cara: Expresion = dicho?.expresion ?? 'piensa'

  return (
    <section className="flex flex-1 flex-col items-center justify-center pb-8">
      {/* El rótulo es lo único que dice en qué tramo estás. El arco no cambia:
          sigue midiendo el descanso entero, que es el tiempo que de verdad
          falta para la serie siguiente. Partirlo en dos arcos habría sido una
          animación nueva y, peor, habría escondido cuánto falta en serio. */}
      <Rotulo>{rafaga ? 'RÁFAGA' : 'DESCANSO'}</Rotulo>
      <div className="mt-3">
        <Arco restante={restante} total={total} />
      </div>

      {rafaga ? (
        <>
          <p className="mt-6 text-center text-lg font-semibold" data-prueba="nombre-rafaga">
            {rafaga.nombre}
          </p>
          <p className="mt-2 max-w-[32ch] text-center text-sm leading-relaxed text-[var(--color-glosa)]">
            {rafaga.gesto}
          </p>
          {/* Acá NO va el aviso de lo que viene, y conviene dejar escrito por
              qué, porque yo mismo lo agregué y lo tuve que sacar.

              Primero la razón de fondo: no falta. La ráfaga ocupa el PRINCIPIO
              del descanso —`enRafaga` se apaga cuando quedan los segundos de
              descanso verdadero— así que al terminar el tramo esta misma
              pantalla pasa a la rama de abajo, con Lyra y con el aviso, y se
              queda ahí todo el tramo pegado a la serie siguiente. Medido en el
              portón del fuelle: 150 s de descanso total, 105 de ellos con el
              aviso puesto.

              Y después la razón de píxeles, que es la que lo cierra: agregarlo
              también en el tramo de ráfaga costaba 45 px —el renglón se parte
              en dos— en una pantalla que en 360×640 ya termina 52 px abajo del
              borde. `pliegue.mjs` lo midió y lo rechazó, con razón. */}
        </>
      ) : (
        texto && (
          /* El ancho es fijo —`w-full` con tope— y no el que pida la frase.
             Con una caja que se encoge, Lyra aparecía a 24 px del borde con la
             indicación larga y a 140 con "La última sale": saltaba de lugar en
             cada descanso, y el descanso vuelve doce veces por sesión. Con el
             ancho fijo cae siempre en el mismo punto y lo único que cambia es
             lo que dice. */
          <div className="mt-8 flex w-full max-w-[36ch] items-start gap-3">
            <Lyra tamano={44} expresion={cara} className="shrink-0" />
            <div className="min-w-0">
              <p className="mt-1 text-sm leading-relaxed text-[var(--color-glosa)]">{texto}</p>
              {/* El aviso previo va PEGADO a la línea de Lyra y no como párrafo
                  aparte: medido en 320×568, como renglón suelto costaba 33 px y
                  acá cuesta 19. Esta pantalla ya termina abajo del borde en el
                  teléfono más chico —el descanso del medio, con la indicación
                  de técnica de tres renglones, llega a 690 de 568— así que cada
                  píxel que se agregue acá tiene que pelearse. */}
              <Aviso viene={viene} className="mt-2" />
            </div>
          </div>
        )
      )}

      <div className="mt-8 flex gap-3">
        <button onClick={onSumar} className="boton-contorno">
          +30 s
        </button>
        {/* Saltear la ráfaga NO saltea el descanso: lo que queda sigue siendo
            descanso. Es la diferencia entre "hoy no" y "ya estoy listo", y
            confundirlas le cobraría recuperación a alguien que solo quería no
            hacer burpees. */}
        {rafaga && (
          <button
            onClick={onSaltearRafaga}
            className="boton-contorno"
          >
            Hoy no
          </button>
        )}
        <button onClick={onSaltear} className="boton-contorno">
          Saltear
        </button>
      </div>
    </section>
  )
}

/**
 * El bloque de fuelle: lo metabólico, al final de la fuerza.
 *
 * Va acá y no entre medio de las series porque es lo único que puede ser
 * exigente sin costarle nada al motor: cuando arranca, ya no queda ninguna
 * serie que medir. Y va ANTES de la serie de cierre, no después, para que la
 * sesión termine igual que terminaba: en algo que se puede sostener.
 *
 * Cada ráfaga se avisa apenas termina, en vez de entregar la lista al final.
 * Es a propósito: si el navegador recicla la pestaña a mitad del bloque, lo que
 * ya se hizo está en el borrador y no se pierde.
 */
function BloqueDeFuelle({
  pasos,
  onRafaga,
  onListo,
  onSaltear,
}: {
  pasos: PasoDeFuelle[]
  onRafaga: (hecha: RegistroRafaga) => void
  onListo: () => void
  onSaltear: () => void
}) {
  const [indice, setIndice] = useState(0)
  /** Si está en la pausa que sigue a la ráfaga, en vez de en la ráfaga. */
  const [pausando, setPausando] = useState(false)
  const paso = pasos[indice]

  const reloj = useTemporizador(() => {
    const actual = pasos[indice]
    if (!actual) return
    if (!pausando) {
      onRafaga({ rafagaId: actual.rafaga.id, segundos: actual.segundos, despuesDe: null })
      tocar('serie')
      if (actual.descansoSegundos > 0) {
        setPausando(true)
        return
      }
    }
    setPausando(false)
    setIndice((n) => n + 1)
  })

  const { arrancar } = reloj
  useEffect(() => {
    const actual = pasos[indice]
    if (!actual) return
    arrancar(pausando ? actual.descansoSegundos : actual.segundos)
  }, [indice, pausando, pasos, arrancar])

  const terminado = useRef(false)
  useEffect(() => {
    if (indice < pasos.length || terminado.current) return
    terminado.current = true
    sonar('descanso')
    onListo()
  }, [indice, pasos.length, onListo])

  if (!paso) return null

  const total = pausando ? paso.descansoSegundos : paso.segundos
  const quedan = pasos.length - indice

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-4 py-3">
        <Rotulo>EL FUELLE · {quedan === 1 ? 'LA ÚLTIMA' : `QUEDAN ${quedan}`}</Rotulo>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center pb-8">
        <Rotulo>{pausando ? 'AFLOJÁ' : 'AHORA'}</Rotulo>
        <div className="mt-3">
          <Arco restante={reloj.restante} total={total} />
        </div>
        <p className="mt-6 text-center text-lg font-semibold" data-prueba="nombre-rafaga">
          {paso.rafaga.nombre}
        </p>
        {!pausando && (
          <p className="mt-2 max-w-[32ch] text-center text-sm leading-relaxed text-[var(--color-glosa)]">
            {paso.rafaga.gesto}
          </p>
        )}
      </section>

      <div className="mt-auto">
        <AccionQuieta onClick={onSaltear}>Cortar el fuelle</AccionQuieta>
      </div>
    </div>
  )
}

/**
 * La serie de cierre.
 *
 * Nunca cuenta para fallo y siempre se puede saltear. Está para que la sesión
 * termine en una nota que se pueda sostener, no en el punto más duro.
 */
function SerieDeCierre({
  nombre,
  cantidad,
  medida,
  onHecho,
  onSaltear,
}: {
  nombre: string
  cantidad: number
  medida: 'repeticiones' | 'segundos'
  onHecho: () => void
  onSaltear: () => void
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4">
        <Rotulo>CIERRE</Rotulo>
        <h1
          className="mt-2 text-3xl font-bold leading-tight tracking-tight"
          data-prueba="titulo-ejercicio"
        >
          {nombre}
        </h1>
        <p className="cifra mt-8 text-7xl">
          {cantidad}
          {medida === 'segundos' && <span className="unidad">s</span>}
        </p>
        <p className="mt-6 max-w-[36ch] text-sm leading-relaxed text-[var(--color-glosa)]">
          Una serie fácil para terminar. No cuenta para la progresión y no se puede fallar: está
          para que te vayas con la sensación de que podías más, que es lo que hace que vuelvas.
        </p>
      </main>
      <div className="mt-auto">
        <Accion esfuerzo onClick={onHecho}>
          Listo
        </Accion>
        <AccionQuieta onClick={onSaltear}>Saltear el cierre</AccionQuieta>
      </div>
    </div>
  )
}

/** Las preguntas del final. Tres toques, todos opcionales. */
function Preguntas({
  guardando,
  onListo,
}: {
  guardando: boolean
  onListo: (datos: { esfuerzo?: number; animo?: number; vitalidadPost?: number }) => void
}) {
  const [esfuerzo, setEsfuerzo] = useState<number | undefined>()
  const [animo, setAnimo] = useState<number | undefined>()
  const [energia, setEnergia] = useState<number | undefined>()

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-10">
        <Rotulo>ANTES DE CERRAR</Rotulo>

        <Pregunta
          titulo="¿Qué tan dura te resultó?"
          opciones={[
            [2, 'Suave'],
            [4, 'Moderada'],
            [6, 'Exigente'],
            [8, 'Dura'],
            [10, 'Al límite'],
          ]}
          valor={esfuerzo}
          onElegir={setEsfuerzo}
        />

        <Pregunta
          titulo="¿Cómo te sentiste haciéndola?"
          opciones={[
            [-2, 'Mal'],
            [-1, 'Cuesta arriba'],
            [0, 'Neutra'],
            [1, 'Bien'],
            [2, 'Muy bien'],
          ]}
          valor={animo}
          onElegir={setAnimo}
        />

        <Pregunta
          titulo="¿Cuánta energía tenés ahora?"
          // La misma escala de cinco puntos y las mismas etiquetas que el
          // chequeo diario. Si las dos puntas del delta no se miden con la
          // misma vara, el delta no significa nada.
          opciones={[
            [1, 'En el piso'],
            [2, 'Cansado'],
            [3, 'Normal'],
            [4, 'Con energía'],
            [5, 'A pleno'],
          ]}
          valor={energia}
          onElegir={setEnergia}
        />

        <p className="mt-8 max-w-[38ch] text-xs leading-relaxed text-[var(--color-glosa)]">
          Nada de esto es obligatorio. Lo usa el motor para no bajarte el objetivo por un mal día,
          y para mostrarte con tus propios datos qué te deja entrenar.
        </p>
      </main>

      <div className="mt-auto">
        <Accion
          esfuerzo
          deshabilitado={guardando}
          onClick={() =>
            onListo({
              ...(esfuerzo !== undefined ? { esfuerzo } : {}),
              ...(animo !== undefined ? { animo } : {}),
              ...(energia !== undefined ? { vitalidadPost: energia } : {}),
            })
          }
        >
          {guardando ? 'Guardando…' : 'Cerrar la sesión'}
        </Accion>
      </div>
    </div>
  )
}

function Pregunta({
  titulo,
  opciones,
  valor,
  onElegir,
}: {
  titulo: string
  opciones: [number, string][]
  valor: number | undefined
  onElegir: (n: number) => void
}) {
  return (
    <section className="mt-8">
      <p className="nombre">{titulo}</p>
      <div className="mt-3 flex gap-px">
        {opciones.map(([n, etiqueta]) => (
          <button
            key={n}
            onClick={() => onElegir(n)}
            className="flex-1 px-1 py-3 text-[0.6875rem] leading-tight"
            style={{
              border: '1px solid var(--color-regla)',
              backgroundColor: valor === n ? 'var(--color-vega)' : 'transparent',
              color: valor === n ? '#100f0d' : 'var(--color-glosa)',
            }}
          >
            {etiqueta}
          </button>
        ))}
      </div>
    </section>
  )
}
