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
 *   pasos y no uno: primero "¿cuántas te salen ahora?" y después, hecha la
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
 *
 * La piel es la de Pulso (§7.4): un armazón de tres filas al alto de la
 * pantalla (`Armazon`), con la acción siempre en su lugar y `main` con su
 * propio scroll, que se aprieta solo cuando la serie no entra (`useApretado`).
 * Los estados cambian por corte, y cada uno lleva el foco a su encabezado.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { rutinaActiva, semanaActiva } from '@/dominio/rutinas'
import { fueraDeLaMolestia } from '@/dominio/molestia'
import { dichoDeLoQueViene, loQueViene } from '@/dominio/siguiente'
import { callar, configurarVoz, decir } from '@/voz'
import { rafagaDelDescanso } from '@/dominio/metabolico'
import {
  descartarSesionEnCurso,
  fechaISO,
  guardarSesionSinCerrar,
  leerAvances,
  leerEstados,
  leerPreferencias,
  leerSesion,
  leerSesiones,
  type ResumenSesion,
} from '@/datos/repositorio'
import { respaldarEnSilencio } from '@/datos/respaldo'
import { useCronometro } from '@/hooks/useTemporizador'
import { useModoDePantalla, usePantallaDespierta } from '@/hooks/usePantalla'
import { configurarHaptica, configurarSonido, despertarAudio, tocar } from '@/respuesta'
import { Accion, AccionQuieta } from '@/componentes/ui'
import { ComoSeHace } from '@/componentes/comoSeHace'
import { Cierre } from '../Cierre'
import { useGuardarBorrador, useSesionEnCurso } from './useSesionEnCurso'
import { useDescanso } from './useDescanso'
import { useCerrarLaSesion } from './useCerrarLaSesion'
import { usePlanDeLaSesion } from './usePlanDeLaSesion'
import { planDelPrimerCuadro } from './primerCuadro'
import { useAnunciador, useApretado, useEstadoNuevo } from './useArmazon'
import { useKilos } from './useKilos'
import {
  QUEDAN_TRES,
  anuncioDeLaSerie,
  anuncioDeLoQueViene,
  anuncioDelDescanso,
  anuncioDelEjercicioCompleto,
} from './anuncios'
import { Armazon } from './Armazon'
import { Encabezado } from './Encabezado'
import { ElEjercicio, Serie } from './Serie'
import { Descanso, PieDelDescanso } from './Descanso'
import { Completo } from './Completo'
import { BloqueDeFuelle } from './Fuelle'
import { SerieDeCierre } from './CierreSerie'
import { Preguntas } from './Preguntas'
import { Preparando, SinCerrarAlEntrar, SinEjercicios, YaGuardada } from './Paradas'

export function Entrenar() {
  const navegar = useNavigate()
  const [parametros] = useSearchParams()
  const { state: estadoDeLaRuta } = useLocation()
  const avances = useLiveQuery(leerAvances, [])
  const preferencias = useLiveQuery(leerPreferencias, [])
  const estados = useLiveQuery(leerEstados, [])
  const historial = useLiveQuery(() => leerSesiones(), [])

  const [resumen, setResumen] = useState<ResumenSesion | null>(null)
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
  const principal = useRef<HTMLElement>(null)

  const rutina = preferencias ? rutinaActiva(preferencias) : null
  const semana = preferencias ? semanaActiva(preferencias) : null
  const {
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
    retomado,
    idDeLaSesion,
    yaGuardada,
    marcarYaGuardada,
    arrancarDeNuevo,
    deCero,
  } = useSesionEnCurso({ parametros, semana, estados })

  /**
   * El panel de "cómo se hace", abierto encima de la sesión.
   *
   * Es estado local y no una ruta a propósito: navegar a la ficha desmontaría
   * la sesión, y aunque ahora el borrador la recupera, la persona igual perdería
   * el hilo de dónde estaba. Esto se abre adelante y se cierra, y abajo la
   * sesión nunca se movió.
   */
  const [explicando, setExplicando] = useState(false)
  /**
   * La región viva, una sola y montada vacía desde el primer cuadro: los
   * lectores registran una región cuando aparece, y una que nace con su texto
   * no anuncia nada. Lo que dice está en `anuncios.ts`, y se vacía cuando deja
   * de ser cierto: al cortarse o terminar el descanso (que es también pasar
   * de ejercicio, deshacer o cerrar) y con "+30 s".
   */
  const region = useAnunciador()

  const duracion = useCronometro(resumen === null, arrancadaEn)
  const descanso = useDescanso(setRafagas, {
    alQuedarTres: () => region.anunciar(QUEDAN_TRES),
    alTerminar: region.callar,
  })
  // Otra pantalla ya guardó la sesión. El descanso de abajo se corta, y con
  // él la región: si no, "Quedan 3 segundos." y su sonido llegarían a la
  // pantalla que dice que esto ya terminó.
  const alYaGuardada = () => {
    descanso.cortar()
    marcarYaGuardada()
  }
  /**
   * Las veces que la serie volvió a su principio con un botón que desaparece
   * al tocarlo: "Deshacer la última" con una sola serie, "Empezar de cero".
   * Sin cambiar de ejercicio ni de momento, la clave del estado era la misma
   * y el foco caía a `<body>`.
   */
  const [vueltas, setVueltas] = useState(0)

  useEffect(() => {
    configurarSonido(preferencias?.sonidoDescanso !== false)
    configurarHaptica(preferencias?.haptica !== false)
    configurarVoz(preferencias?.voz !== false)
  }, [preferencias?.sonidoDescanso, preferencias?.haptica, preferencias?.voz])

  // Al desmontar, callar: si alguien sale a mitad de una frase, la frase sigue
  // sonando en la pantalla siguiente, que es de otra cosa.
  useEffect(() => callar, [])

  useModoDePantalla(resumen ? 'cierre' : 'entrenar')
  usePantallaDespierta(resumen === null)

  const { plan, avisos, pasos, fuelle, tipo, esDensa, densidad, equipo } = usePlanDeLaSesion({
    preferencias,
    avances,
    estados,
    historial,
    rutina,
    semana,
    dia,
    fechaDeLaSesion,
    esCorta,
    esDiaDeFuelle,
    esDiaDenso,
    molestias,
    hechas,
  })

  const { guardando, errorAlCerrar, cerrando, terminar } = useCerrarLaSesion({
    estados,
    historial,
    dia,
    pasos,
    hechas,
    duracion,
    tipo,
    rafagas,
    esDensa,
    idDeLaSesion,
    cortarDescanso: descanso.cortar,
    alYaGuardada,
    alCerrar: setResumen,
  })

  useGuardarBorrador({
    listo,
    resumen,
    sinCerrar,
    cerrando,
    retomado,
    idDeLaSesion,
    yaGuardada,
    alYaGuardada,
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
  })

  /*
   * El primer cuadro no espera a la base (§7.4). Si Hoy mandó el plan en la
   * navegación, la primera serie se dibuja con él mientras Dexie abre; cuando
   * contesta, manda Dexie, y si había una sesión en curso o el plan cambió,
   * el cambio es un corte. Ese cuadro no anota nada: hasta que la base
   * contesta, anotar, saltear o deshacer no hacen nada, porque todavía no se
   * sabe si había una sesión que retomar.
   */
  const cargado = !!avances && !!preferencias && !!historial && listo && plan.length > 0
  const planDeHoy = useMemo(() => planDelPrimerCuadro(estadoDeLaRuta), [estadoDeLaRuta])
  const provisorio = !cargado && etapa === 'series' && !sinCerrar && !yaGuardada ? planDeHoy : null
  const planVisible = cargado ? plan : (provisorio ?? [])

  // El índice viene de un borrador que se escribió con otro plan en la mano.
  // Hoy el plan puede ser más corto —cambió la rutina, cambió un eslabón— así
  // que se acota: entrar por un índice que no existe rompe la pantalla entera.
  const enCurso = Math.min(Math.max(indice, 0), Math.max(planVisible.length - 1, 0))
  const paso = planVisible[enCurso]
  const series = paso ? (hechas[paso.ejercicio.id] ?? []) : []
  const completo = !!paso && series.length >= paso.objetivo.series

  const { kg, tope, pasoDeDisco, puedeCargar, ponerKg, sacarLosKilos } = useKilos(paso, preferencias)

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
    !!paso &&
    preferencias?.prediccionActiva !== false &&
    // En la bajada no: la calibración mide qué tan bien se conoce uno el cuerpo
    // en el ejercicio que está costando, y preguntarla en un eslabón ya
    // dominado cobra toques para medir algo que ya se sabe.
    !paso.bajada &&
    series.length === 0 &&
    predicho === null

  // Qué se ve en la etapa de las series, y cuál es el estado: cada estado
  // nuevo arranca arriba y con el foco en su encabezado. Las dos paradas
  // tienen su clave: la sesión que sigue a "Guardarla" es un estado nuevo, y
  // "SESIÓN GUARDADA" también. La compresión mide solo la serie, y vuelve a
  // medir con todo lo que le cambia el alto.
  const momento = descanso.activo ? (descanso.rafaga ? 'rafaga' : 'descanso') : completo ? 'completo' : 'serie'
  const enSesion = cargado && !resumen && !sinCerrar && !yaGuardada
  const enLaSerie = etapa === 'series' ? `series:${vueltas}:${enCurso}:${momento}` : etapa
  useEstadoNuevo(sinCerrar ? 'sin-cerrar' : yaGuardada ? 'ya-guardada' : enSesion ? enLaSerie : null)
  useApretado(
    principal,
    etapa === 'series' && momento === 'serie' && !!paso,
    [enCurso, tocaPredecir, predicho !== null, kg > 0, puedeCargar, retomada, paso?.abre?.id, avisos.length].join(':'),
  )

  // La región viva va en todas las pantallas de Entrenar, en el mismo lugar
  // del árbol: así React la conserva entre una y otra en vez de montarla de
  // nuevo con cada estado, que es justo lo que la dejaría muda.
  const conLaRegion = (pantalla: ReactNode) => (
    <>
      <p className="sr-only" aria-live="polite" data-prueba="anunciador">
        {region.dicho}
      </p>
      {pantalla}
    </>
  )

  if (sinCerrar) {
    return conLaRegion(
      <SinCerrarAlEntrar
        borrador={sinCerrar}
        hoy={fechaISO()}
        onSalir={() => navegar('/')}
        alGuardar={async () => {
          await guardarSesionSinCerrar()
          void respaldarEnSilencio()
          arrancarDeNuevo()
        }}
        alDescartar={async () => {
          await descartarSesionEnCurso()
          arrancarDeNuevo()
        }}
      />,
    )
  }

  if (yaGuardada) return conLaRegion(<YaGuardada onIrAHoy={() => navegar('/')} />)

  // Va después de la sesión sin cerrar y no antes: si hay un borrador vencido
  // con trabajo adentro, lo primero es decidir qué hacer con él, y eso no
  // puede taparlo un aviso sobre la sesión de hoy.
  if (avances && preferencias && historial && listo && plan.length === 0 && avisos.length > 0) {
    return conLaRegion(<SinEjercicios avisos={avisos} onVolver={() => navegar('/')} />)
  }

  if (!paso) return conLaRegion(<Preparando />)

  if (resumen) {
    return conLaRegion(<Cierre resumen={resumen} duracion={duracion} alSalir={() => navegar('/')} />)
  }

  const { ejercicio, objetivo, descansoSegundos } = paso
  const esUltimo = enCurso === planVisible.length - 1
  const propuesto = prediccion ?? objetivo.cantidad
  const salto = ejercicio.medida === 'segundos' ? 5 : 1

  // La serie de cierre: el ejercicio más fácil de la sesión, al 60%. Fuera de
  // la cadena con molestia mientras haya otra cosa: el eslabón bajado suele
  // ser el más fácil, y una serie más ahí es volver a cargar la zona.
  const candidatasDeCierre = fueraDeLaMolestia(planVisible, molestias)
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
  const queViene = (quedan: number) =>
    loQueViene({
      plan: planVisible.map((p) => ({ nombre: p.ejercicio.nombre, bajada: p.bajada })),
      enCurso,
      quedan,
      hayFuelle: fuelle.length > 0,
      nombreDelCierre: esDiaDeFuelle ? null : cierre.ejercicio.nombre,
    })
  const viene = queViene(objetivo.series - series.length)

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
    if (!cargado) return
    // Idempotente y casi gratis si el audio ya está andando. Está acá como
    // red: si alguien entra a /entrenar por la URL, el gesto de Hoy no ocurrió.
    despertarAudio()

    const logrado = Math.max(0, propuesto)
    registrarSerie(ejercicio.id, logrado, predicho ?? undefined)
    setPredicho(null)

    const quedan = objetivo.series - (series.length + 1)
    tocar(quedan === 0 ? 'ejercicio' : quedan === 1 ? 'quedaUna' : 'serie')
    const anuncio = [anuncioDeLaSerie(series.length + 1, logrado, ejercicio.medida)]

    // Y acá habla, UNA vez por ejercicio: cuando el ejercicio se completa y la
    // transición que viene no tiene descanso, ni sonido, ni nada que leer sin
    // mirar. En los demás casos la pantalla ya lo dice bien y repetirlo en voz
    // sería ruido. Va adentro de `anotar` porque `anotar` es un gesto de la
    // persona, que es lo único que en iOS deja hablar al navegador.
    if (quedan === 0) {
      const loDicho = queViene(0)
      if (loDicho) decir(dichoDeLoQueViene(loDicho))
      anuncio.push(anuncioDelEjercicioCompleto(loDicho))
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
      descanso.arrancar(descansoSegundos, elegida, ejercicio.id)
      anuncio.push(anuncioDelDescanso(descansoSegundos, elegida?.rafaga.nombre ?? null))
      const despues = queViene(quedan)
      if (despues) anuncio.push(anuncioDeLoQueViene(despues))
    }
    // Se dice cuando la base confirma que la sesión sigue abierta. Si otra
    // pantalla ya la guardó, esta serie no va a ningún lado y la pantalla pasa
    // a decir eso (`alYaGuardada`): anunciarla sería decir algo que no pasó.
    region.anunciarSi(
      leerSesion(idDeLaSesion).then(
        (guardada) => !guardada,
        () => true,
      ),
      anuncio.join(' '),
    )
  }

  function deshacer() {
    if (!cargado) return
    setHechas((previas) => ({
      ...previas,
      [ejercicio.id]: (previas[ejercicio.id] ?? []).slice(0, -1),
    }))
    descanso.cortar()
    setPredicho(null)
    // Sin series que deshacer, el botón se oculta con el foco adentro: el
    // foco vuelve al título, como en cualquier estado nuevo.
    if (series.length <= 1) setVueltas((n) => n + 1)
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
    deCero()
    setPrediccion(null)
    setPredicho(null)
    sacarLosKilos()
    descanso.cortar()
    setVueltas((n) => n + 1)
  }

  function avanzar() {
    if (!cargado) return
    descanso.cortar()
    setPrediccion(null)
    setPredicho(null)
    if (!esUltimo) setIndice((i) => i + 1)
    else setEtapa(fuelle.length > 0 ? 'fuelle' : 'cierre-serie')
  }

  const algoRegistrado = Object.values(hechas).some((s) => s.length > 0)

  // El encabezado es el mismo en la serie, el descanso, el ejercicio
  // completo, la serie de cierre y las preguntas: la sesión es una sola.
  // Pasada la fuerza, la barra está entera, no hay serie que deshacer y la
  // retomada ya no ofrece empezar de cero: sería tirar la sesión en la
  // última pantalla, con un toque y sin preguntar.
  const enLasSeries = etapa === 'series'
  const encabezado = (
    <Encabezado
      duracion={duracion}
      ejercicios={planVisible.length}
      enCurso={enLasSeries ? enCurso : planVisible.length}
      retomada={retomada && enLasSeries}
      onSalir={() => navegar('/')}
      onEmpezarDeCero={empezarDeCero}
      onDeshacer={enLasSeries && series.length > 0 ? deshacer : null}
    />
  )

  if (etapa === 'preguntas') {
    return conLaRegion(
      <Preguntas
        encabezado={encabezado}
        guardando={guardando}
        error={errorAlCerrar}
        onListo={(datos) => void terminar(datos)}
      />,
    )
  }

  if (etapa === 'fuelle') {
    return conLaRegion(
      <BloqueDeFuelle
        pasos={fuelle}
        onRafaga={(hecha) => setRafagas((previas) => [...previas, hecha])}
        onListo={() => setEtapa(esDiaDeFuelle ? 'preguntas' : 'cierre-serie')}
        onSaltear={() => setEtapa(esDiaDeFuelle ? 'preguntas' : 'cierre-serie')}
      />,
    )
  }

  if (etapa === 'cierre-serie') {
    return conLaRegion(
      <SerieDeCierre
        encabezado={encabezado}
        nombre={cierre.ejercicio.nombre}
        cantidad={objetivoCierre}
        medida={cierre.ejercicio.medida}
        onHecho={() => {
          registrarSerie(cierre.ejercicio.id, objetivoCierre, undefined, true)
          tocar('ejercicio')
          setEtapa('preguntas')
        }}
        onSaltear={() => setEtapa('preguntas')}
      />,
    )
  }

  // La secundaria va al final de `main`, también en el descanso: saltear un
  // ejercicio que no sale se decide justo ahí. En el último ejercicio es
  // "Terminar acá", y solo si hay algo anotado que terminar. Las dos avanzan,
  // y avanzar corta el descanso: si no, su cuenta seguiría sonando debajo.
  const secundaria =
    completo ? null : !esUltimo ? (
      <AccionQuieta onClick={avanzar}>Saltear este ejercicio</AccionQuieta>
    ) : algoRegistrado ? (
      <AccionQuieta onClick={avanzar}>Terminar acá</AccionQuieta>
    ) : null

  const pie = descanso.activo ? (
    <PieDelDescanso
      conRafaga={descanso.rafaga !== null}
      onSumar={() => {
        // "Descanso de 2 minutos" o "Quedan 3 segundos" ya no serían ciertos.
        region.callar()
        descanso.sumar(30)
      }}
      onSaltear={descanso.cortar}
      onSaltearRafaga={descanso.saltearRafaga}
    />
  ) : completo ? (
    <Accion esfuerzo onClick={avanzar}>
      {esUltimo ? 'Terminar' : 'Siguiente ejercicio'}
    </Accion>
  ) : (
    <Accion
      esfuerzo
      onClick={
        tocaPredecir
          ? () => {
              // Se cierra la predicción y se deja el mismo número puesto: si
              // acertaste, anotar cuesta un toque y nada más.
              despertarAudio()
              setPredicho(propuesto)
            }
          : anotar
      }
    >
      {tocaPredecir ? 'Voy' : 'Anotar serie'}
    </Accion>
  )

  return conLaRegion(
    <>
      {explicando && <ComoSeHace ejercicio={ejercicio} alCerrar={() => setExplicando(false)} />}
      <Armazon
        encabezado={encabezado}
        principal={principal}
        claseDelPrincipal={descanso.activo ? 'main-descanso' : undefined}
        ocupado={!cargado}
        pie={pie}
      >
        <ElEjercicio
          paso={paso}
          series={series}
          enCurso={enCurso}
          avisos={avisos}
          pasoDeLaSerie={tocaPredecir ? 1 : 2}
          enDescanso={descanso.activo}
          focoEnElTitulo={momento === 'serie'}
          onComoSeHace={() => setExplicando(true)}
        />

        {descanso.activo ? (
          <Descanso
            restante={descanso.restante}
            // Lo sumado cuenta, y si una recarga lo perdió, el total no puede
            // ser menos que lo que falta: el arco pasaría del círculo entero.
            total={Math.max(descansoSegundos + descanso.sumado, descanso.restante)}
            clave={{
              tecnica: ejercicio.tecnica,
              faltan: objetivo.series - series.length,
              indice: enCurso,
              total: planVisible.length,
              azar: descanso.azarDeLaFrase,
            }}
            rafaga={descanso.rafaga}
            viene={viene}
          />
        ) : completo ? (
          <Completo viene={viene} />
        ) : (
          <Serie
            tocaPredecir={tocaPredecir}
            predicho={predicho}
            medida={ejercicio.medida}
            propuesto={propuesto}
            salto={salto}
            onCambiar={setPrediccion}
            puedeCargar={puedeCargar}
            kg={kg}
            tope={tope}
            pasoDeDisco={pasoDeDisco}
            onPonerKg={ponerKg}
          />
        )}

        {secundaria && <div className="secundaria-esfuerzo">{secundaria}</div>}
      </Armazon>
    </>,
  )
}
