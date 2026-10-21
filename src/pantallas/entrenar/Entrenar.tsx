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
import { rutinaActiva, semanaActiva } from '@/dominio/rutinas'
import { fueraDeLaMolestia, lineaDeMolestia } from '@/dominio/molestia'
import { dichoDeLoQueViene, loQueViene } from '@/dominio/siguiente'
import { callar, configurarVoz, decir } from '@/voz'
import { rafagaDelDescanso } from '@/dominio/metabolico'
import { registrosDeLaSesion } from '@/dominio/borrador'
import {
  cerrarSesion,
  descartarSesionEnCurso,
  fechaISO,
  guardarSesionSinCerrar,
  leerAvances,
  leerEstados,
  leerPreferencias,
  leerSesiones,
  type ResumenSesion,
} from '@/datos/repositorio'
import { respaldarEnSilencio } from '@/datos/respaldo'
import { useCronometro } from '@/hooks/useTemporizador'
import { useModoDePantalla, usePantallaDespierta } from '@/hooks/usePantalla'
import { configurarHaptica, configurarSonido, despertarAudio, tocar } from '@/respuesta'
import { Accion, AccionQuieta, Rotulo } from '@/componentes/ui'
import { ComoSeHace } from '@/componentes/comoSeHace'
import { SesionSinCerrar } from '@/componentes/sinCerrar'
import { Cierre } from '../Cierre'
import { useGuardarBorrador, useSesionEnCurso } from './useSesionEnCurso'
import { useDescanso } from './useDescanso'
import { usePlanDeLaSesion } from './usePlanDeLaSesion'
import { Encabezado } from './Encabezado'
import { ElEjercicio, Serie } from './Serie'
import { Descanso } from './Descanso'
import { Completo } from './Completo'
import { BloqueDeFuelle } from './Fuelle'
import { SerieDeCierre } from './CierreSerie'
import { Preguntas } from './Preguntas'

export function Entrenar() {
  const navegar = useNavigate()
  const [parametros] = useSearchParams()
  const avances = useLiveQuery(leerAvances, [])
  const preferencias = useLiveQuery(leerPreferencias, [])
  const estados = useLiveQuery(leerEstados, [])
  const historial = useLiveQuery(() => leerSesiones(), [])

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
  /** Lo que salió mal al cerrar, dicho en la pantalla de las preguntas. */
  const [errorAlCerrar, setErrorAlCerrar] = useState<string | null>(null)
  /**
   * Prendido mientras se cierra la sesión, para que nada vuelva a escribir el
   * borrador. Guardar la sesión refresca el historial, el historial rearma el
   * plan, y el plan dispara el efecto que guarda el borrador: si eso llegaba
   * antes que `resumen`, el borrador que la transacción acababa de borrar
   * volvía a aparecer, y al abrir Entrenar la sesión se cerraba dos veces.
   * Lo encontró `datos.mjs` con la prueba por mutación.
   */
  const cerrando = useRef(false)

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
    () => estados?.find((e) => e.fecha === dia)?.energia,
    [estados, dia],
  )

  const duracion = useCronometro(resumen === null, arrancadaEn)
  const descanso = useDescanso(setRafagas)

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

  useGuardarBorrador({
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
  })

  if (sinCerrar) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4">
        <SesionSinCerrar
          borrador={sinCerrar}
          hoy={fechaISO()}
          alGuardar={async () => {
            await guardarSesionSinCerrar()
            void respaldarEnSilencio()
            arrancarDeNuevo()
          }}
          alDescartar={async () => {
            await descartarSesionEnCurso()
            arrancarDeNuevo()
          }}
        />
        <button onClick={() => navegar('/')} className="rotulo mt-10 self-start">
          Salir
        </button>
      </div>
    )
  }

  /*
   * Un plan vacío por la molestia no es una sesión que todavía carga.
   *
   * Pasa cuando todo lo que la rutina pedía hoy es de la cadena que avisó y
   * esa cadena está en su primer eslabón —o lo demás necesita una barra que no
   * hay—. Sin esto la pantalla se quedaba en "preparando" para siempre: se
   * dice lo que pasó y se ofrece volver.
   *
   * Va después de la sesión sin cerrar y no antes: si hay un borrador vencido
   * con trabajo adentro, lo primero es decidir qué hacer con él, y eso no
   * puede taparlo un aviso sobre la sesión de hoy.
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
  const { ejercicio, objetivo, antes, descansoSegundos, bajada } = paso

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
      descanso.arrancar(descansoSegundos, elegida, ejercicio.id)
    }
  }

  function deshacer() {
    setHechas((previas) => ({
      ...previas,
      [ejercicio.id]: (previas[ejercicio.id] ?? []).slice(0, -1),
    }))
    descanso.cortar()
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
    deCero()
    setPrediccion(null)
    setPredicho(null)
    setKgPuestos({})
    descanso.cortar()
  }

  function avanzar() {
    descanso.cortar()
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
    setErrorAlCerrar(null)
    cerrando.current = true
    descanso.cortar()

    try {
      const cerrada = await cerrarSesion({
        registros: registrosDeLaSesion(pasos, hechas),
        duracionSegundos: duracion,
        tipo,
        ...(rafagas.length > 0 ? { rafagas } : {}),
        ...(esDensa ? { densa: true as const } : {}),
        ...(vitalidadPre !== undefined ? { vitalidadPre } : {}),
        ...datos,
        fecha: dia,
        // El borrador se borra adentro de la misma transacción que guarda la
        // sesión: o quedan las dos cosas hechas o ninguna.
        cierraElBorrador: true,
      })
      setResumen(cerrada)
      // El respaldo ocurre solo, sin avisar y sin poder romper nada.
      void respaldarEnSilencio()
    } catch {
      // Antes no había `catch`: el botón dejaba de decir "Guardando…" y no
      // pasaba nada más. Ahora se dice, y no se pierde nada: la transacción
      // no llegó a borrar el borrador, así que la sesión sigue entera acá y
      // también si se cierra la app.
      cerrando.current = false
      setErrorAlCerrar('No se pudo guardar. Tu sesión sigue acá: probá de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  const algoRegistrado = Object.values(hechas).some((s) => s.length > 0)

  if (etapa === 'preguntas') {
    return (
      <Preguntas
        guardando={guardando}
        error={errorAlCerrar}
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
      <Encabezado
        duracion={duracion}
        plan={plan}
        enCurso={enCurso}
        retomada={retomada}
        onSalir={() => navegar('/')}
        onEmpezarDeCero={empezarDeCero}
      />

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-8">
        <ElEjercicio
          paso={paso}
          series={series}
          enCurso={enCurso}
          avisos={avisos}
          onComoSeHace={() => setExplicando(true)}
        />

        {descanso.activo ? (
          <Descanso
            restante={descanso.restante}
            total={descansoSegundos}
            clave={{
              tecnica: ejercicio.tecnica,
              faltan: objetivo.series - series.length,
              indice: enCurso,
              total: plan.length,
              azar: descanso.azarDeLaFrase,
            }}
            rafaga={descanso.rafaga}
            viene={viene}
            onSumar={() => descanso.sumar(30)}
            onSaltear={descanso.cortar}
            onSaltearRafaga={descanso.saltearRafaga}
          />
        ) : completo ? (
          <Completo viene={viene} onDeshacer={deshacer} />
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
            hayAnotadas={series.length > 0}
            onDeshacer={deshacer}
          />
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
