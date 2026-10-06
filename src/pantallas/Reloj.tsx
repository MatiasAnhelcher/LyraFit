/**
 * El reloj: tabata y los otros intervalos.
 *
 * Es la segunda pantalla que se mira con el pulso alto, y la única que se mira
 * con el pulso MÁS alto que la sesión: en un tabata no se puede leer nada. Por
 * eso acá el canal que manda es la voz, y la pantalla es el respaldo.
 *
 * Hereda la noche y el apagado de decoración de `data-pantalla='entrenar'`, y
 * reusa el arco —el mismo, no uno nuevo—, el temporizador anclado al reloj
 * real, los earcons, la háptica y los dibujos. Lo único propio es el plan de
 * tramos y la cuenta de repeticiones.
 *
 * ## Lo que no hace
 *
 * No le habla al motor. La sesión se guarda con `tipo: 'reloj'` y
 * `mueveElPlan` la deja afuera: una vuelta cerca del fallo con diez segundos de
 * pausa no es una medida de capacidad, y leerla como tal haría bajar de eslabón
 * por series que nadie pidió. Es la misma razón por la que existe el día de
 * fuelle.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CADENAS, NOMBRE_PATRON, buscarEjercicio } from '@/dominio/biblioteca'
import { POSTURAS } from '@/dominio/posturas'
import { NECESITAN_BARRA } from '@/dominio/musculos'
import { rafagasDisponibles } from '@/dominio/metabolico'
import {
  CUENTA_AL_FINAL,
  FORMATOS,
  FORMATO_POR_DEFECTO,
  FORMATO_POR_ID,
  TOPE_DE_EJERCICIOS,
  anteriorDelMismo,
  cuentaEnLaVuelta,
  registrosDelReloj,
  dichoDelTramo,
  duracionDelReloj,
  peorPorEjercicio,
  peorVuelta,
  planDelReloj,
  rotuloDelTramo,
  vueltaSinPausa,
  vueltasSinContar,
  type Formato,
  type Opcion,
  type Tramo,
} from '@/dominio/reloj'
import { cerrarSesion, leerAvances, leerPreferencias } from '@/datos/repositorio'
import { useTemporizador, comoReloj } from '@/hooks/useTemporizador'
import { useModoDePantalla, usePantallaDespierta } from '@/hooks/usePantalla'
import { despertarAudio, configurarHaptica, configurarSonido, sonar, tocar } from '@/respuesta'
import { callar, configurarVoz, decir, prepararVoz } from '@/voz'
import { Arco } from '@/componentes/arco'
import { FiguraEjercicio } from '@/componentes/figura'
import { Accion, AccionQuieta, Cargando, Rotulo } from '@/componentes/ui'

export function Reloj() {
  const navegar = useNavigate()
  const avances = useLiveQuery(leerAvances, [])
  const preferencias = useLiveQuery(leerPreferencias, [])

  const [formatoId, setFormatoId] = useState(FORMATO_POR_DEFECTO)
  const [elegidos, setElegidos] = useState<string[]>([])
  const [corriendo, setCorriendo] = useState(false)
  const [todos, setTodos] = useState(false)

  useModoDePantalla('entrenar')
  usePantallaDespierta(corriendo)

  useEffect(() => {
    configurarSonido(preferencias?.sonidoDescanso !== false)
    configurarHaptica(preferencias?.haptica !== false)
    configurarVoz(preferencias?.voz !== false)
  }, [preferencias?.sonidoDescanso, preferencias?.haptica, preferencias?.voz])

  useEffect(() => callar, [])

  /**
   * Lo que se ofrece: el eslabón que te toca en cada cadena, y las ráfagas.
   *
   * Es corto y es tuyo. Abrir los cuarenta y siete de entrada sería pedirle a
   * alguien que elija entre cincuenta y cinco cosas antes de un tabata, y la
   * respuesta correcta casi siempre es la que la app ya sabe: el eslabón en el
   * que estás. Los demás están a un toque —`todos`— y van al final.
   */
  const opciones = useMemo<Opcion[]>(() => {
    if (!avances) return []
    const equipo = {
      ...(preferencias?.puedeSaltar !== undefined ? { puedeSaltar: preferencias.puedeSaltar } : {}),
      ...(preferencias?.tieneEscalon !== undefined
        ? { tieneEscalon: preferencias.tieneEscalon }
        : {}),
    }
    const tuyos: Opcion[] = [...avances.values()].flatMap((avance) => {
      const ejercicio = buscarEjercicio(avance.ejercicioId)
      if (!ejercicio) return []
      return [
        {
          id: ejercicio.id,
          nombre: ejercicio.nombre,
          ejercicioId: ejercicio.id,
          grupo: 'tuyos' as const,
          enSegundos: ejercicio.medida === 'segundos',
          etiqueta: NOMBRE_PATRON[ejercicio.patron].toLowerCase(),
        },
      ]
    })
    const cardio: Opcion[] = rafagasDisponibles(equipo, 'fuerte').map((r) => ({
      id: `rafaga:${r.id}`,
      nombre: r.nombre,
      grupo: 'cardio' as const,
      enSegundos: false,
      gesto: r.gesto,
      etiqueta: 'cardio',
    }))

    // Y los demás, si se piden. Van al final y en orden de cadena, no mezclados
    // con los tuyos: el orden de la lista es información —arriba está lo que te
    // toca— y perderlo para ganar alfabeto sería un mal cambio. Sin barra, los
    // diez que cuelgan de una no se ofrecen: un reloj que propone dominadas a
    // alguien que no tiene dónde colgarse es un reloj que no escuchó.
    const puestos = new Set(tuyos.map((o) => o.id))
    const resto: Opcion[] = todos
      ? CADENAS.flatMap((cadena) =>
          cadena.ejercicios.flatMap((id) => {
            if (puestos.has(id)) return []
            if (preferencias?.tieneBarra === false && NECESITAN_BARRA.has(id)) return []
            const ejercicio = buscarEjercicio(id)
            if (!ejercicio) return []
            return [
              {
                id: ejercicio.id,
                nombre: ejercicio.nombre,
                ejercicioId: ejercicio.id,
                grupo: 'tuyos' as const,
                enSegundos: ejercicio.medida === 'segundos',
                etiqueta: NOMBRE_PATRON[ejercicio.patron].toLowerCase(),
              },
            ]
          }),
        )
      : []

    return [...tuyos, ...cardio, ...resto]
  }, [
    avances,
    todos,
    preferencias?.puedeSaltar,
    preferencias?.tieneEscalon,
    preferencias?.tieneBarra,
  ])

  const formato = FORMATO_POR_ID.get(formatoId) ?? FORMATO_POR_ID.get(FORMATO_POR_DEFECTO)!
  const plan = useMemo(() => planDelReloj(formato, elegidos), [formato, elegidos])

  if (!avances || !preferencias) return <Cargando filas={5} />

  const alternar = (id: string) =>
    setElegidos((previos) =>
      previos.includes(id)
        ? previos.filter((x) => x !== id)
        : previos.length >= TOPE_DE_EJERCICIOS
          ? previos
          : [...previos, id],
    )

  if (corriendo) {
    return (
      <Corriendo
        plan={plan}
        formato={formato}
        opciones={opciones}
        alSalir={() => {
          setCorriendo(false)
          navegar('/biblioteca')
        }}
      />
    )
  }

  const duracion = duracionDelReloj(formato, elegidos)

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 py-3">
        <button onClick={() => navegar('/biblioteca')} className="rotulo">
          Salir
        </button>
        {elegidos.length > 0 && <p className="cifra text-sm">{comoReloj(duracion)}</p>}
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-8">
        <Rotulo>EL RELOJ</Rotulo>

        <section className="mt-6">
          <Rotulo>FORMATO</Rotulo>
          <div className="registro mt-3">
            {FORMATOS.map((f) => (
              <button key={f.id} onClick={() => setFormatoId(f.id)} className="fila-pulsable">
                <span className="canal">{f.id === formatoId ? '◆' : '◇'}</span>
                <span className="min-w-0">
                  <span className="nombre block">{f.nombre}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-[var(--color-glosa)]">
                    {f.nota}
                  </span>
                </span>
                <span className="cifra-fila">{f.vueltas}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <Rotulo>EJERCICIOS</Rotulo>
          <p className="mt-2 max-w-[42ch] text-xs leading-relaxed text-[var(--color-glosa)]">
            De uno a {TOPE_DE_EJERCICIOS}. Si elegís varios, rotan vuelta por vuelta: el músculo
            que descansa es otro y por eso se sostiene mejor.
          </p>
          <div className="registro mt-3">
            {opciones.map((o) => {
              const puesto = elegidos.indexOf(o.id)
              return (
                <button key={o.id} onClick={() => alternar(o.id)} className="fila-pulsable">
                  {/* El número en el canal y no un tilde: en una rotación el
                      ORDEN es información, y un tilde no la lleva. */}
                  <span className="canal">{puesto >= 0 ? String(puesto + 1) : '◇'}</span>
                  <span className="min-w-0">
                    <span className="nombre block">{o.nombre}</span>
                  </span>
                  <span className="rotulo">{o.etiqueta}</span>
                </button>
              )
            })}
          </div>

          {/* Los cuarenta y siete, si hacen falta. Cerrado por defecto porque
              elegir entre cincuenta y cinco cosas antes de un tabata es el
              problema, no la solución: arriba está lo que te toca hoy. */}
          {!todos && (
            <button
              onClick={() => setTodos(true)}
              className="rotulo mt-4 block w-full text-center underline underline-offset-4"
            >
              Ver todos los ejercicios
            </button>
          )}
        </section>
      </main>

      <div className="mt-auto">
        <Accion
          esfuerzo
          deshabilitado={elegidos.length === 0}
          onClick={() => {
            // El único gesto que iOS acepta para desbloquear audio y voz. Si
            // esto no corre acá, el reloj entero queda mudo y es justo el
            // canal que más importa.
            despertarAudio()
            prepararVoz()
            setCorriendo(true)
          }}
        >
          {elegidos.length === 0 ? 'Elegí un ejercicio' : 'Empezar'}
        </Accion>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────

function Corriendo({
  plan,
  formato,
  opciones,
  alSalir,
}: {
  plan: Tramo[]
  formato: Formato
  opciones: Opcion[]
  alSalir: () => void
}) {
  const [indice, setIndice] = useState(0)
  const [logros, setLogros] = useState<(number | null)[]>(() =>
    Array.from({ length: formato.vueltas }, () => null),
  )
  const [terminado, setTerminado] = useState(false)
  const arrancadaEn = useRef(Date.now())
  /** Se congela al terminar: la pantalla del final se queda abierta mientras se
      anota la última vuelta, y la duración no puede seguir creciendo. */
  const duracionFinal = useRef(0)

  const tramo = plan[indice]
  const nombreDe = useCallback(
    (id: string) => opciones.find((o) => o.id === id)?.nombre ?? id,
    [opciones],
  )

  const reloj = useTemporizador(() => setIndice((n) => n + 1))
  const { arrancar } = reloj

  // Cada tramo arranca su cuenta y canta lo que es. El orden importa: primero
  // suena el earcon —que es la marca— y después habla la voz, porque al revés
  // la nota taparía la primera sílaba.
  useEffect(() => {
    const actual = plan[indice]
    if (!actual) return
    arrancar(actual.segundos)
    if (indice > 0) sonar('descanso')
    tocar(actual.clase === 'trabajo' ? 'ejercicio' : 'serie')

    // En la preparación se nombra el ejercicio que VIENE: es lo único que hace
    // falta saber en esos diez segundos. Antes decía "Preparate." y el nombre
    // vacío, porque la preparación no tiene ejercicio propio.
    const proximo = plan.slice(indice).find((t) => t.clase === 'trabajo')
    const nombre =
      actual.clase === 'trabajo'
        ? nombreDe(actual.ejercicioId)
        : actual.clase === 'preparacion' && proximo?.clase === 'trabajo'
          ? nombreDe(proximo.ejercicioId)
          : ''

    // Y en la pausa se canta el que viene solo si es otro. Con un ejercicio
    // solo, anunciarlo siete veces gastaría el canal que más importa.
    const terminada = actual.clase === 'pausa' ? plan.find(
      (t) => t.clase === 'trabajo' && t.vuelta === actual.vuelta,
    ) : undefined
    const cambia =
      actual.clase === 'pausa' &&
      proximo?.clase === 'trabajo' &&
      terminada?.clase === 'trabajo' &&
      proximo.ejercicioId !== terminada.ejercicioId
    const viene = cambia && proximo?.clase === 'trabajo' ? nombreDe(proximo.ejercicioId) : undefined

    decir(dichoDelTramo(actual, nombre, formato.vueltas, viene))
  }, [indice, plan, arrancar, nombreDe, formato.vueltas])

  // Los últimos tres segundos, en la piel. Es el mismo mecanismo que ya está
  // probado en el descanso de la sesión: sabés cuándo arranca sin mirar.
  const ultimoTic = useRef(0)
  useEffect(() => {
    if (!reloj.activo) {
      ultimoTic.current = 0
      return
    }
    const faltan = reloj.restante
    if (faltan > 0 && faltan <= 3 && faltan !== ultimoTic.current) {
      ultimoTic.current = faltan
      tocar('antes')
      if (faltan === 3) sonar('aviso')
    }
  }, [reloj.activo, reloj.restante])

  // Terminado: se guarda una sola vez.
  const guardado = useRef(false)
  useEffect(() => {
    if (indice < plan.length || guardado.current) return
    guardado.current = true
    duracionFinal.current = Math.round((Date.now() - arrancadaEn.current) / 1000)
    setTerminado(true)
    sonar('nivel')
    callar()
  }, [indice, plan.length])

  if (terminado) {
    return (
      <Final
        plan={plan}
        formato={formato}
        logros={logros}
        setLogros={setLogros}
        opciones={opciones}
        duracion={duracionFinal.current}
        alSalir={alSalir}
      />
    )
  }

  if (!tramo) return null

  const ejercicioId = tramo.clase === 'trabajo' ? tramo.ejercicioId : null
  const enCurso = ejercicioId ? opciones.find((o) => o.id === ejercicioId) : undefined
  const dibujo = enCurso?.ejercicioId ? POSTURAS[enCurso.ejercicioId] : undefined

  /** El próximo trabajo, para poder decir qué viene durante la pausa. */
  const viene = plan.slice(indice + 1).find((t) => t.clase === 'trabajo')

  // Dónde se cuenta: en la pausa, la vuelta que acaba de terminar. En el EMOM,
  // que no tiene pausa, en los últimos diez segundos de la vuelta misma —si no,
  // no habría ningún momento para anotarla y el formato entero quedaría sin
  // puntaje—. Los diez segundos y no el minuto entero están explicados en
  // `CUENTA_AL_FINAL`: con el dibujo y la cuenta juntos la pantalla no entra en
  // un teléfono chico, y además nadie quiere un `+` adelante a mitad de vuelta.
  const aContar =
    tramo.clase === 'pausa'
      ? tramo.vuelta
      : tramo.clase === 'trabajo' &&
          cuentaEnLaVuelta(formato) &&
          reloj.restante <= CUENTA_AL_FINAL
        ? tramo.vuelta
        : null
  const contada = aContar === null ? undefined : opcionDeVuelta(plan, opciones, aContar)
  const previa = aContar === null ? undefined : anteriorDelMismo(plan, logros, aContar)
  const enSegundos = contada?.enSegundos === true

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 py-3">
        <button onClick={alSalir} className="rotulo">
          Salir
        </button>
        <Rotulo>
          {tramo.clase === 'preparacion'
            ? formato.nombre.toUpperCase()
            : `VUELTA ${tramo.vuelta + 1} DE ${formato.vueltas}`}
        </Rotulo>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-8">
        <Rotulo>{rotuloDelTramo(tramo)}</Rotulo>
        <div className="mt-3">
          <Arco restante={reloj.restante} total={tramo.segundos} />
        </div>

        {/* El ejercicio: el nombre y el dibujo. El dibujo va quieto —`animar`
            en false— porque esta pantalla apaga el movimiento y porque acá no
            hace falta aprender el gesto, hace falta reconocerlo de un vistazo. */}
        {tramo.clase !== 'pausa' && ejercicioId && (
          <>
            <p className="mt-6 max-w-[24ch] text-center text-lg font-semibold leading-tight">
              {nombreDe(ejercicioId)}
            </p>
            {/* Mientras la cuenta está arriba, el dibujo se va: es lo que
                deja entrar las dos cosas en un 320×568. Y la cuenta solo está
                arriba al final de la vuelta, en el EMOM. */}
            {aContar === null &&
              (dibujo ? (
                <div className="mt-2 w-32 opacity-70">
                  <FiguraEjercicio figura={dibujo} animar={false} />
                </div>
              ) : (
                // Las ráfagas no tienen dibujo pero tienen gesto, que es la
                // línea que dice a qué ritmo va. Sin esto quedaba el nombre solo.
                enCurso?.gesto && (
                  <p className="mt-2 max-w-[28ch] text-center text-xs leading-relaxed text-[var(--color-glosa)]">
                    {enCurso.gesto}
                  </p>
                )
              ))}
          </>
        )}

        {/* Qué viene: es la pregunta que se hace en la pausa con el pulso
            alto, y leerla acá cuesta cero segundos de la vuelta siguiente. */}
        {tramo.clase === 'pausa' && viene?.clase === 'trabajo' && (
          <div className="mt-6 text-center">
            <Rotulo>VIENE</Rotulo>
            <p className="mt-1 max-w-[24ch] text-lg font-semibold leading-tight">
              {nombreDe(viene.ejercicioId)}
            </p>
          </div>
        )}

        {/* El conteo va en la pausa —ahí hay diez segundos que de otra forma se
            van en nada— y en el EMOM, que no tiene pausa, en la vuelta misma. */}
        {aContar !== null && (
          <div className="mt-6 w-full max-w-[20rem]">
            <Cuenta
              vuelta={aContar}
              logro={logros[aContar] ?? null}
              sugerido={previa ?? (enSegundos ? formato.trabajo : undefined)}
              sugeridoEs={previa !== undefined ? 'anterior' : 'entera'}
              enSegundos={enSegundos}
              set={(cuanto) => anotar(setLogros, aContar, cuanto)}
            />
          </div>
        )}
      </main>
    </div>
  )
}

/** Escribe el logro de una vuelta. Fuera del componente para no recrearla. */
function anotar(
  set: React.Dispatch<React.SetStateAction<(number | null)[]>>,
  vuelta: number,
  cuanto: (previo: number | null) => number,
) {
  set((previos) => previos.map((n, i) => (i === vuelta ? cuanto(n) : n)))
}

// ─────────────────────────────────────────────────────────────────────────

/** El ejercicio que le toca a una vuelta. */
function opcionDeVuelta(
  plan: readonly Tramo[],
  opciones: readonly Opcion[],
  vuelta: number,
): Opcion | undefined {
  const tramo = plan.find((t) => t.clase === 'trabajo' && t.vuelta === vuelta)
  if (!tramo || tramo.clase !== 'trabajo') return undefined
  return opciones.find((o) => o.id === tramo.ejercicioId)
}

/**
 * La cuenta de una vuelta: menos, el número, más.
 *
 * El número que se OFRECE va en gris y el que está anotado va en tinta, y la
 * diferencia no es decorativa. La versión anterior mostraba la vuelta anterior
 * en tinta sin haberla guardado: la pantalla decía "doce" y la base guardaba
 * "no contada". Mostrar en gris lo que todavía no es, y en tinta lo que ya es,
 * es la misma regla que usa toda la app para lo que falta.
 */
function Cuenta({
  vuelta,
  logro,
  sugerido,
  sugeridoEs,
  enSegundos,
  set,
}: {
  vuelta: number
  logro: number | null
  /** Lo que se ofrece sin haberlo guardado: la vuelta anterior del mismo
      ejercicio, o la vuelta entera si es un sostén. */
  sugerido: number | undefined
  sugeridoEs: 'anterior' | 'entera'
  enSegundos: boolean
  set: (cuanto: (previo: number | null) => number) => void
}) {
  const anotado = logro !== null
  const mostrado = logro ?? sugerido
  return (
    <>
      <p className="text-center text-sm text-[var(--color-glosa)]">
        {enSegundos
          ? `¿Cuántos segundos aguantaste en la vuelta ${vuelta + 1}?`
          : `¿Cuántas en la vuelta ${vuelta + 1}?`}
      </p>
      <div className="mt-3 flex items-center justify-center gap-5">
        <button
          onClick={() => set((n) => Math.max(0, (n ?? sugerido ?? 0) - 1))}
          className="cifra flex h-14 w-14 items-center justify-center text-2xl"
          style={{ border: '1px solid var(--color-regla)' }}
          aria-label="Restar"
        >
          −
        </button>
        <p
          className="cifra w-24 text-center text-5xl"
          style={anotado ? undefined : { color: 'var(--color-glosa)' }}
        >
          {mostrado ?? '—'}
        </p>
        <button
          onClick={() => set((n) => (n ?? sugerido ?? 0) + 1)}
          className="cifra flex h-14 w-14 items-center justify-center text-2xl"
          style={{ border: '1px solid var(--color-regla)' }}
          aria-label="Sumar"
        >
          +
        </button>
      </div>
      {!anotado && sugerido !== undefined && (
        <button
          onClick={() => set(() => sugerido)}
          className="rotulo mt-3 block w-full text-center underline underline-offset-4"
        >
          {sugeridoEs === 'entera' ? 'La aguanté entera' : 'Las mismas que la anterior'}
        </button>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────

function Final({
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
            <p className="cifra mt-2 text-7xl">{peor}</p>
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
