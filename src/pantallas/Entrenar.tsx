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
 * - **La predicción antes de cada serie.** Cuesta cero toques si aceptás el
 *   número que ya está puesto, y convierte datos que la app igual iba a
 *   guardar en una medida de qué tan bien te conocés el cuerpo. No da puntos
 *   a propósito: si diera puntos, se podría hacer trampa prediciendo bajo.
 *
 * - **La serie de cierre.** Después de la última serie prescrita se agrega una
 *   serie fácil, al sesenta por ciento, que nunca cuenta para fallo. Sale de
 *   la regla del pico y el final: lo que uno recuerda de una sesión, y lo que
 *   predice si va a haber una próxima, depende del pico y del final mucho más
 *   que del promedio. Terminar destruido envenena el recuerdo de todo lo demás.
 *
 * - **El descanso se muestra vaciando un arco**, en silencio y en lineal. Lo
 *   que había antes latía a opacidad variable: un elemento que late mientras
 *   tenés el pulso alto es estresante y encima hace ilegible el número.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { NOMBRE_PATRON, POR_ID, buscarEjercicio, cadenaDe } from '@/dominio/biblioteca'
import { RUTINA_POR_DEFECTO, RUTINA_POR_ID } from '@/dominio/rutinas'
import { ajusteDelDia, bandaSostenida, cadenasCongeladas } from '@/dominio/estado'
import { seAbreHoy } from '@/dominio/anticipacion'
import { mueveElPlan } from '@/dominio/progresion'
import { esVuelta, RECORTE_DE_VUELTA } from '@/dominio/adherencia'
import { haceCuanto, laVezPasada } from '@/dominio/estadisticas'
import type { RegistroEjercicio, Serie, TipoSesion } from '@/dominio/tipos'
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
import { Cierre } from './Cierre'

type Etapa = 'series' | 'cierre-serie' | 'preguntas'

export function Entrenar() {
  const navegar = useNavigate()
  const [parametros] = useSearchParams()
  const esCorta = parametros.get('corta') === '1'

  const avances = useLiveQuery(leerAvances, [])
  const preferencias = useLiveQuery(leerPreferencias, [])
  const estados = useLiveQuery(leerEstados, [])
  const historial = useLiveQuery(() => leerSesiones(), [])

  const [indice, setIndice] = useState(0)
  const [hechas, setHechas] = useState<Record<string, Serie[]>>({})
  const [etapa, setEtapa] = useState<Etapa>('series')
  const [resumen, setResumen] = useState<ResumenSesion | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [prediccion, setPrediccion] = useState<number | null>(null)
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

  const duracion = useCronometro(resumen === null, arrancadaEn)
  const descanso = useTemporizador(() => {
    sonar('descanso')
    tocar('descanso')
  })

  useEffect(() => {
    configurarSonido(preferencias?.sonidoDescanso !== false)
    configurarHaptica(preferencias?.haptica !== false)
  }, [preferencias?.sonidoDescanso, preferencias?.haptica])

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
          setArrancadaEn(borrador.arrancadaEn)
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
    const algo = Object.values(hechas).some((series) => series.length > 0)
    if (!algo) return
    void guardarSesionEnCurso({
      arrancadaEn: arrancadaEn ?? Date.now(),
      corta: esCorta,
      indice,
      etapa,
      hechas,
    })
  }, [listo, resumen, hechas, indice, etapa, arrancadaEn, esCorta])

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

  useModoDePantalla(resumen ? 'cierre' : 'entrenar')
  usePantallaDespierta(resumen === null)

  const rutina = preferencias
    ? (RUTINA_POR_ID.get(preferencias.rutinaActivaId) ?? RUTINA_POR_ID.get(RUTINA_POR_DEFECTO)!)
    : null

  /** Qué clase de sesión es. Lo necesitan el factor, la anticipación y el cierre. */
  const tipo: TipoSesion = useMemo(
    () => (esCorta ? 'corta' : esVuelta(historial ?? [], fechaISO()) ? 'vuelta' : 'plan'),
    [esCorta, historial],
  )

  /** El factor del día: estado sostenido y sesión de vuelta se multiplican. */
  const factor = useMemo(() => {
    if (!estados || !historial) return 1
    const ajuste = ajusteDelDia(bandaSostenida(estados, fechaISO()))
    const vuelta = esVuelta(historial, fechaISO()) ? RECORTE_DE_VUELTA : 1
    return ajuste.factor * vuelta
  }, [estados, historial])

  /** Los ejercicios concretos de la sesión, según el avance de cada patrón. */
  const plan = useMemo(() => {
    if (!rutina || !avances) return []
    const bloques = esCorta ? rutina.bloques.slice(0, rutina.bloques.length) : rutina.bloques
    return bloques.flatMap((bloque) => {
      const avance = avances.get(bloque.patron)
      const ejercicio = avance ? buscarEjercicio(avance.ejercicioId) : undefined
      if (!avance || !ejercicio) return []
      // La sesión corta es un ejercicio por cadena y una serie de cada uno.
      const series = esCorta ? 1 : avance.objetivoActual.series
      const cantidad = Math.max(1, Math.round(avance.objetivoActual.cantidad * factor))
      // La vez pasada de ESTE ejercicio, para poner una vara adentro de cada
      // casillero. Es lo que hace que la segunda sesión no se sienta idéntica
      // a la primera: los casilleros vacíos ya no están vacíos.
      const antes = historial ? laVezPasada(historial, ejercicio.id, fechaISO()) : null
      // Y si esta sesión, cumplida, abre el eslabón siguiente. Solo cuando la
      // sesión de verdad mueve la progresión: en una corta, una de vuelta o una
      // cadena congelada el dato sigue siendo correcto y la promesa sería falsa.
      const cuenta =
        mueveElPlan(tipo) &&
        !ajusteDelDia(bandaSostenida(estados ?? [], fechaISO())).neutra &&
        !cadenasCongeladas(estados ?? [], fechaISO()).has(bloque.patron)
      const abre = seAbreHoy(avance, cadenaDe(bloque.patron), POR_ID, cuenta)
      return [{ ejercicio, objetivo: { series, cantidad }, antes, abre }]
    })
  }, [rutina, avances, esCorta, factor, historial, estados, tipo])

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
  const { ejercicio, objetivo, antes, abre } = paso
  const series = hechas[ejercicio.id] ?? []
  const completo = series.length >= objetivo.series
  const esUltimo = enCurso === plan.length - 1
  const propuesto = prediccion ?? objetivo.cantidad
  const salto = ejercicio.medida === 'segundos' ? 5 : 1

  // La serie de cierre: el ejercicio más fácil de la sesión, al 60%.
  const cierre = plan.reduce((facil, p) => (p.ejercicio.ccr < facil.ejercicio.ccr ? p : facil), plan[0]!)
  const objetivoCierre = Math.max(1, Math.round(cierre.objetivo.cantidad * 0.6))

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
    registrarSerie(ejercicio.id, logrado, preferencias?.prediccionActiva ? propuesto : undefined)

    const quedan = objetivo.series - (series.length + 1)
    tocar(quedan === 0 ? 'ejercicio' : quedan === 1 ? 'quedaUna' : 'serie')

    if (quedan > 0) descanso.arrancar(ejercicio.descansoSegundos)
  }

  function deshacer() {
    setHechas((previas) => ({
      ...previas,
      [ejercicio.id]: (previas[ejercicio.id] ?? []).slice(0, -1),
    }))
    descanso.detener()
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
    setArrancadaEn(Date.now())
    setRetomada(false)
    descanso.detener()
  }

  function avanzar() {
    descanso.detener()
    setPrediccion(null)
    if (!esUltimo) setIndice((i) => i + 1)
    else setEtapa('cierre-serie')
  }

  async function terminar(datos: {
    esfuerzo?: number
    animo?: number
    vitalidadPost?: number
  }) {
    setGuardando(true)
    descanso.detener()

    const registros: RegistroEjercicio[] = plan.map(({ ejercicio: e, objetivo: o }) => ({
      ejercicioId: e.id,
      objetivo: o,
      series: hechas[e.id] ?? [],
    }))

    try {
      const cerrada = await cerrarSesion({
        registros,
        duracionSegundos: duracion,
        tipo,
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
      <header className="flex items-center justify-between px-4 py-3">
        <button onClick={() => navegar('/')} className="rotulo">
          Salir
        </button>
        <p className="cifra text-sm text-[var(--color-glosa)]">{comoReloj(duracion)}</p>
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
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight">{ejercicio.nombre}</h1>

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
            total={ejercicio.descansoSegundos}
            onSumar={() => descanso.sumar(30)}
            onSaltear={descanso.detener}
          />
        ) : completo ? (
          <section className="flex flex-1 flex-col items-center justify-center text-center">
            <Rotulo>EJERCICIO COMPLETO</Rotulo>
            <button onClick={deshacer} className="mt-3 text-sm text-[var(--color-glosa)] underline underline-offset-4">
              Deshacer la última serie
            </button>
          </section>
        ) : (
          <section className="flex flex-1 flex-col justify-center pb-8">
            <p className="text-center text-sm text-[var(--color-glosa)]">
              {preferencias.prediccionActiva
                ? '¿Cuántas te salen ahora?'
                : `${nombreUnidad(ejercicio.medida)} de esta serie`}
            </p>

            <div className="mt-4 flex items-center justify-center gap-6">
              <button
                onClick={() => setPrediccion(Math.max(0, propuesto - salto))}
                className="cifra flex h-16 w-16 items-center justify-center text-3xl"
                style={{ border: '1px solid var(--color-regla)' }}
                aria-label="Restar"
              >
                −
              </button>
              <p className="cifra w-32 text-center text-7xl">{propuesto}</p>
              <button
                onClick={() => setPrediccion(propuesto + salto)}
                className="cifra flex h-16 w-16 items-center justify-center text-3xl"
                style={{ border: '1px solid var(--color-regla)' }}
                aria-label="Sumar"
              >
                +
              </button>
            </div>

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
          <Accion esfuerzo onClick={anotar}>
            Anotar serie
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
          <AccionQuieta onClick={() => setEtapa('cierre-serie')}>Terminar acá</AccionQuieta>
        )}
      </div>
    </div>
  )
}

/** El descanso: un arco que se vacía en silencio. Lineal, porque es tiempo real. */
function Descanso({
  restante,
  total,
  onSumar,
  onSaltear,
}: {
  restante: number
  total: number
  onSumar: () => void
  onSaltear: () => void
}) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center pb-8">
      <div className="relative flex h-44 w-44 items-center justify-center">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
          <circle className="arco-descanso-fondo" cx="50" cy="50" r="46" />
          <circle
            className="arco-descanso"
            cx="50"
            cy="50"
            r="46"
            pathLength={1}
            style={{ ['--resto' as string]: String(Math.max(0, restante / Math.max(total, 1))) }}
          />
        </svg>
        <p className="cifra text-5xl">{comoReloj(restante)}</p>
      </div>
      <div className="mt-8 flex gap-3">
        <button onClick={onSumar} className="rotulo px-4 py-3" style={{ border: '1px solid var(--color-regla)' }}>
          +30 s
        </button>
        <button onClick={onSaltear} className="rotulo px-4 py-3" style={{ border: '1px solid var(--color-regla)' }}>
          Saltear
        </button>
      </div>
    </section>
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
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight">{nombre}</h1>
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
