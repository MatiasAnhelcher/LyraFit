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
  dichoDelTramo,
  duracionDelReloj,
  planDelReloj,
  rotuloDelTramo,
  type Formato,
  type Opcion,
  type Tramo,
} from '@/dominio/reloj'
import { leerAvances, leerPreferencias } from '@/datos/repositorio'
import { useTemporizador, comoReloj } from '@/hooks/useTemporizador'
import { useModoDePantalla, usePantallaDespierta } from '@/hooks/usePantalla'
import { despertarAudio, configurarHaptica, configurarSonido, sonar, tocar } from '@/respuesta'
import { callar, configurarVoz, decir, prepararVoz } from '@/voz'
import { Arco } from '@/componentes/arco'
import { FiguraEjercicio } from '@/componentes/figura'
import { Accion, Cargando, MarcaRadio, Rotulo, Simbolo } from '@/componentes/ui'
import { Cuenta, anotar, opcionDeVuelta } from './Cuenta'
import { Final } from './Final'

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
    //
    // RECORRE LAS CADENAS Y NO `EJERCICIOS`, Y ESO ES DELIBERADO.
    //
    // Los cuatro de la barra cargable quedan afuera, y tienen que quedar
    // afuera. Un tabata es veinte segundos al fallo contra un reloj, y un peso
    // muerto rumano con discos al fallo contra un reloj es la receta exacta de
    // una lesión de espalda baja: el intervalo empuja a sostener el ritmo
    // cuando la técnica ya se fue, que es justo lo contrario de lo que pide un
    // patrón de bisagra cargado.
    //
    // Hoy esto sale gratis porque no están en ninguna cadena. Si mañana alguien
    // "arregla" esto recorriendo `EJERCICIOS` para que no falte nada, el reloj
    // va a ofrecerlos. El test de `reloj.test.ts` lo agarra.
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
              <button
                key={f.id}
                onClick={() => setFormatoId(f.id)}
                aria-pressed={f.id === formatoId}
                className="fila-pulsable"
              >
                <span className="canal">
                  <MarcaRadio elegida={f.id === formatoId} />
                </span>
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
                  <span className="canal">
                    {puesto >= 0 ? String(puesto + 1) : <Simbolo nombre="rombo-vacio" />}
                  </span>
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
        <Rotulo prueba="vuelta">
          {tramo.clase === 'preparacion'
            ? formato.nombre.toUpperCase()
            : `VUELTA ${tramo.vuelta + 1} DE ${formato.vueltas}`}
        </Rotulo>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-8">
        <Rotulo prueba="rotulo-tramo">{rotuloDelTramo(tramo)}</Rotulo>
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
