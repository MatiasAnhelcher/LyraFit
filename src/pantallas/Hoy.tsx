/**
 * Hoy.
 *
 * La pantalla que se abre veinte veces por semana. De ahí sale casi todo su
 * diseño: es la que más tiene que callarse.
 *
 * Lo que cambió respecto de la versión anterior, y por qué:
 *
 * - **Se fue la racha.** Estaba rota —adherencia perfecta con la rutina por
 *   defecto mostraba un 3— pero el problema de fondo era otro: en una app de
 *   fuerza el descanso es parte del plan, así que premiar días consecutivos es
 *   premiar exactamente lo que no hay que hacer. En su lugar hay un contador
 *   que solo sube y una ventana de veintiocho días que siempre se puede
 *   recuperar.
 *
 * - **Se fue el "volumen".** Sumaba repeticiones con segundos.
 *
 * - **Apareció la carta.** Una barra de porcentaje no ubica a nadie; un camino
 *   con nodos dice de dónde viniste, dónde estás y qué falta.
 */

import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { NOMBRE_PATRON, POR_ID, buscarEjercicio, cadenaDe } from '@/dominio/biblioteca'
import {
  NOMBRE_DIA,
  RUTINA_POR_DEFECTO,
  RUTINA_POR_ID,
  diaDeLaSemana,
  proximoDia,
  tocaEntrenar,
  claseDeDia,
} from '@/dominio/rutinas'
import {
  DESCANSO_DE_BAJADA,
  MINUTOS_DEL_DIA_POR_DEFECTO,
  bajadaDe,
  minutosDelBloque,
  minutosDeSesion,
} from '@/dominio/bajada'
import { bloqueDeFuelle, type Densidad } from '@/dominio/metabolico'
import { adherencia, esVuelta, proximoHito, sesionesDeVida } from '@/dominio/adherencia'
import { laVezPasada } from '@/dominio/estadisticas'
import { bandaSostenida, ajusteDelDia, cadenasCongeladas } from '@/dominio/estado'
import { seAbreHoy } from '@/dominio/anticipacion'
import { mueveElPlan } from '@/dominio/progresion'
import {
  fechaISO,
  leerAvances,
  leerEstadoDeHoy,
  leerEstados,
  guardarPreferencias,
  leerPreferencias,
  leerSesiones,
} from '@/datos/repositorio'
import { despertarAudio } from '@/respuesta'
import { Carta } from '@/componentes/carta'
import { Accion, Cargando, Glifo, Glosa, Objetivo, Rotulo, Tira } from '@/componentes/ui'

const FORMATO_FECHA = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

export function Hoy() {
  const navegar = useNavigate()
  const hoy = new Date()
  const fecha = fechaISO(hoy)

  const avances = useLiveQuery(leerAvances, [])
  const preferencias = useLiveQuery(leerPreferencias, [])
  const sesiones = useLiveQuery(() => leerSesiones(), [])
  const estados = useLiveQuery(leerEstados, [])
  const estadoDeHoy = useLiveQuery(leerEstadoDeHoy, [])

  if (!avances || !preferencias || !sesiones || !estados) {
    return (
      <>
        <Rotulo>{FORMATO_FECHA.format(hoy).toUpperCase()}</Rotulo>
        <div className="mt-6">
          <Cargando filas={4} />
        </div>
      </>
    )
  }

  const rutina =
    RUTINA_POR_ID.get(preferencias.rutinaActivaId) ?? RUTINA_POR_ID.get(RUTINA_POR_DEFECTO)!
  const esDiaDeEntrenar = tocaEntrenar(rutina, hoy)
  /**
   * Fuerza, fuelle o descanso. El día de fuelle no le pide fuerza a ninguna
   * cadena, así que la pantalla no puede ofrecer lo mismo: anunciar los cuatro
   * eslabones y después abrir un bloque metabólico sería mentir dos veces.
   */
  const esDiaDeFuelle = claseDeDia(rutina, hoy) === 'fuelle'
  const siguiente = proximoDia(rutina, hoy)
  const entrenoHoy = sesiones.some((s) => s.fecha === fecha)
  const total = sesionesDeVida(sesiones)
  const hito = proximoHito(total)
  const marcha = adherencia(sesiones, fecha, rutina.dias.length)
  const banda = bandaSostenida(estados, fecha)
  const ajuste = ajusteDelDia(banda)
  const vuelve = esVuelta(sesiones, fecha)

  const congeladas = cadenasCongeladas(estados, fecha)

  const bloques = rutina.bloques.flatMap((bloque) => {
    const avance = avances.get(bloque.patron)
    const ejercicio = avance ? buscarEjercicio(avance.ejercicioId) : undefined
    if (!avance || !ejercicio) return []

    // Si la sesión de hoy no mueve la progresión, no hay nada que anticipar:
    // el dato sería correcto y la promesa igual sería falsa.
    const cuenta =
      mueveElPlan(vuelve ? 'vuelta' : 'plan') && !ajuste.neutra && !congeladas.has(bloque.patron)

    return [
      {
        patron: bloque.patron,
        avance,
        ejercicio,
        // Lo que hiciste la última vez que te tocó ESTE ejercicio. Si cambiaste
        // de eslabón la semana pasada no hay con qué comparar, y no se inventa.
        antes: laVezPasada(sesiones, ejercicio.id, fecha),
        abre: seAbreHoy(avance, cadenaDe(bloque.patron), POR_ID, cuenta),
      },
    ]
  })

  /**
   * Cuánto va a durar la sesión de hoy, estimado.
   *
   * La app nunca supo decirlo, y resulta que es una de las preguntas más
   * concretas que se le pueden hacer: "tengo una hora, ¿entro?". Sale de los
   * mismos números con los que se arma la sesión —las series, las ventanas, los
   * descansos de cada ejercicio y el bloque de fuelle—, así que no es una
   * promesa: es una cuenta.
   *
   * Se muestra redondeada y con un "aprox." adelante, porque la variabilidad
   * real entre dos personas haciendo la misma sesión es de varios minutos y una
   * cifra exacta sería más precisa que honesta.
   */
  const densidad: Densidad = preferencias.densidad ?? 'apagada'
  const esDensa = densidad !== 'apagada'
  const equipo = {
    ...(preferencias.puedeSaltar !== undefined ? { puedeSaltar: preferencias.puedeSaltar } : {}),
    ...(preferencias.tieneEscalon !== undefined ? { tieneEscalon: preferencias.tieneEscalon } : {}),
  }
  const densidadDelDia: Densidad = esDiaDeFuelle && !esDensa ? 'suave' : densidad
  const minutosObjetivo = preferencias.minutosObjetivo

  // Las mismas cuentas que hace `Entrenar`, con los mismos datos: la fuerza
  // primero, y el bloque cubriendo lo que falta para llegar a la duración
  // elegida. Si estas dos pantallas se separaran, la estimación diría una cosa
  // y la sesión duraría otra, que es peor que no estimar nada.
  const entradas = bloques.flatMap(({ patron, avance, ejercicio }) => {
    const duro = { ejercicio, objetivo: avance.objetivoActual }
    if (!esDensa) return [duro]
    const abajo = bajadaDe(ejercicio, cadenaDe(patron), POR_ID)
    return abajo ? [duro, { ...abajo, descansoSegundos: DESCANSO_DE_BAJADA }] : [duro]
  })

  const segundosDeFuelle =
    densidadDelDia === 'apagada'
      ? 0
      : bloqueDeFuelle(
          esDiaDeFuelle
            ? Math.max(1, (minutosObjetivo ?? MINUTOS_DEL_DIA_POR_DEFECTO) - 6)
            : minutosDelBloque(minutosObjetivo, minutosDeSesion(entradas)),
          equipo,
          densidadDelDia,
        ).reduce((suma, paso) => suma + paso.segundos + paso.descansoSegundos, 0)

  const minutos = esDiaDeFuelle
    ? Math.round(segundosDeFuelle / 60) + 6
    : minutosDeSesion(entradas, segundosDeFuelle)

  /**
   * La víspera: el eslabón que se abre hoy si esta sesión se cumple.
   *
   * Es lo único que la app anticipa, y lo dice porque es literalmente cierto —
   * el motor es determinista y `proyectar` lo corre en seco—. La señal
   * dopaminérgica no responde a la recompensa sino al error de predicción de
   * recompensa: un premio perfectamente predecible deja de producir señal, y
   * estar a una sesión de algo que todavía no pasó es exactamente la forma que
   * tiene la anticipación. Acá no hay que fabricarla: ya estaba en el motor y
   * no se mostraba en ningún lado.
   *
   * Sale una sola vez, la del primero que esté a punto. Cuatro cadenas a punto
   * el mismo día es una lista, y una lista no anticipa nada.
   */
  const vispera = bloques.find((b) => b.abre)

  const filasDeCarta = [...avances.values()].map((avance) => ({
    patron: avance.patron,
    avance,
  }))

  return (
    <>
      <header>
        <Rotulo>{FORMATO_FECHA.format(hoy).toUpperCase()}</Rotulo>
        <p className="cifra-identidad mt-3">{String(total).padStart(3, '0')}</p>
        <p className="mt-1 text-sm text-[var(--color-glosa)]">
          {total === 0
            ? 'sesiones. Todavía ninguna.'
            : total === 1
              ? 'sesión en tu vida.'
              : 'sesiones en tu vida.'}
        </p>
        {total > 0 && (
          <div className="mt-4">
            <Tira cantidad={total} />
          </div>
        )}
        {hito && hito.faltan <= 5 && total > 0 && (
          <p className="mt-4 text-sm text-[var(--color-glosa)]">
            Te {hito.faltan === 1 ? 'falta' : 'faltan'}{' '}
            <span className="cifra text-[var(--color-tinta)]">{hito.faltan}</span> para llegar a{' '}
            <span className="cifra text-[var(--color-tinta)]">{hito.hito}</span>.
          </p>
        )}
      </header>

      {ajuste.mensaje && (
        <div className="mt-8">
          <Glosa tono="ambar" cita={`Regla · estado sostenido ${banda === 'rojo' ? '3 días' : '2 de 3'}`}>
            {ajuste.mensaje}
          </Glosa>
        </div>
      )}

      {preferencias.estadoActivo && !estadoDeHoy && (
        <button
          onClick={() => navegar('/estado')}
          className="registro mt-8 w-full text-left"
          style={{ borderTop: '1px solid var(--color-regla)' }}
        >
          <div className="fila-pulsable">
            <span className="canal">?</span>
            <span className="nombre">¿Cómo venís hoy?</span>
            <span className="rotulo">15 s</span>
          </div>
        </button>
      )}

      <section className="mt-8">
        {/* La duración va en ESTA línea y no en una propia.
            Medido en tres teléfonos: como línea aparte empujaba `Empezar` once
            píxeles por debajo de la barra de navegación en un Android de
            360×640. Es la misma regla que ya había movido la acción arriba del
            pliegue, rota por un renglón de veinticuatro píxeles. */}
        <Rotulo>
          {entrenoHoy
            ? 'YA ENTRENASTE HOY'
            : esDiaDeFuelle
              ? 'HOY · FUELLE'
              : esDiaDeEntrenar
                ? vuelve
                  ? 'SESIÓN DE VUELTA'
                  : `HOY · ${rutina.nombre.toUpperCase()}`
                : 'HOY TOCA DESCANSAR'}
          {esDiaDeEntrenar && !entrenoHoy && ` · ${minutos} MIN`}
        </Rotulo>

        <div className="registro mt-3">
          {bloques.map(({ patron, avance, ejercicio, antes }) => {
            const cadena = cadenaDe(patron)
            const posicion = cadena.ejercicios.indexOf(ejercicio.id) + 1
            return (
              <div key={patron}>
                <span className="canal">
                  <Glifo patron={patron} />
                </span>
                <span className="min-w-0">
                  <span className="nombre block truncate">{ejercicio.nombre}</span>
                  {/* La vara que puso la persona la última vez, en el renglón
                      chico y no al lado del objetivo: ahí le comía el ancho al
                      nombre del ejercicio, que es lo único que no se puede
                      truncar. Acá sobra lugar y el número es lo único de la
                      línea que va en tinta, o sea lo único que se ve.

                      No es una recompensa ni una insignia: es información sobre
                      la propia competencia, que es la clase de feedback que
                      construye motivación en vez de erosionarla. Y sin ella la
                      segunda sesión se siente idéntica a la primera. */}
                  <span className="rotulo mt-0.5 block truncate">
                    {NOMBRE_PATRON[patron]} · {posicion}/{cadena.ejercicios.length}
                    {antes && (
                      <>
                        {' · antes '}
                        <span className="cifra text-[var(--color-tinta)]">
                          {antes.mejor}
                          {ejercicio.medida === 'segundos' && <span className="lowercase">s</span>}
                        </span>
                      </>
                    )}
                  </span>
                </span>
                <Objetivo
                  series={avance.objetivoActual.series}
                  cantidad={Math.round(avance.objetivoActual.cantidad * ajuste.factor)}
                  medida={ejercicio.medida}
                />
              </div>
            )
          })}
        </div>

        {vispera?.abre && (
          <p className="mt-4 max-w-[40ch] text-sm leading-relaxed text-[var(--color-glosa)]">
            {/* Dos redacciones, y las dos son ciertas. Con la sesión de hoy por
                delante habla de hoy; ya entrenada, o en un día de descanso,
                habla de la próxima — que es cuando esto más sirve, porque es
                justo el momento en que la persona cierra la app.

                "Pasás a X" y no "se abre X": los nombres de los ejercicios
                cambian de número —"dominadas completas" contra "plancha
                lateral"— y cualquier verbo que concuerde con ellos queda mal la
                mitad de las veces. Es además el verbo que usa el motor cuando
                explica la decisión al cerrar la sesión. */}
            {esDiaDeEntrenar && !entrenoHoy
              ? 'Si cerrás esta sesión cumpliendo, '
              : 'Si cumplís la próxima sesión, '}
            <span className="text-[var(--color-tinta)]">
              pasás a {vispera.abre.nombre.toLowerCase()}
            </span>
            .
          </p>
        )}

        {!esDiaDeEntrenar && siguiente && (
          <p className="mt-4 text-sm leading-relaxed text-[var(--color-glosa)]">
            El próximo es el {NOMBRE_DIA[diaDeLaSemana(siguiente)]?.toLowerCase()}. Descansar no
            es una pausa del plan: es la parte del plan en la que el músculo se construye.
          </p>
        )}
      </section>

      {/* La acción va acá y no al final, que es donde estaba.
          Medido en tres teléfonos: al final quedaba entre 160 y 367 píxeles por
          debajo del pliegue, o sea que en la pantalla que se abre veinte veces
          por semana había que scrollear para llegar a lo único que la pantalla
          existe para hacer. Y lo que la tapaba —la carta y la barra de 28
          días— es contexto: se mira cuando uno quiere mirarlo, no antes de
          poder empezar. El orden ahora es quién sos, qué toca hoy, empezar, y
          después dónde estás parado. */}
      <div className="mt-10 -mx-4">
        <Accion
          onClick={() => {
            // El audio se despierta acá y no cuando el descanso termina: en
            // iOS un contexto creado fuera de un gesto nace suspendido y se
            // queda así, y un temporizador no es un gesto. Sin esta línea el
            // aviso del descanso no suena nunca en iPhone.
            despertarAudio()
            navegar(esDiaDeFuelle ? '/entrenar?fuelle=1' : '/entrenar')
          }}
        >
          {entrenoHoy
            ? 'Entrenar otra vez'
            : esDiaDeFuelle
              ? 'Empezar el fuelle'
              : vuelve
                ? 'Volver a empezar'
                : 'Empezar'}
        </Accion>
        <button
          onClick={() => {
            despertarAudio()
            navegar('/entrenar?corta=1')
          }}
          className="accion-quieta"
        >
          Solo tengo 7 minutos
        </button>
      </div>

      {/* El fuelle, ofrecido una vez.
       *
       * Una función que hay que ir a buscar a Ajustes es una función que no
       * existe: el fuelle se publicó apagado y la app se veía idéntica, así que
       * quien lo había pedido no lo encontró.
       *
       * La condición es `=== undefined` y no `?? 'apagada'` a propósito, y es
       * todo el mecanismo: la diferencia entre "nunca se preguntó" y "se
       * preguntó y dijo que no" YA ESTABA en los datos, aplanada por un
       * operador. Por eso esto no necesita ninguna preferencia nueva, ninguna
       * migración ni ningún campo de "ya lo vio" — los dos botones escriben un
       * valor explícito y con eso la fila no vuelve nunca más.
       *
       * Va DEBAJO de la acción y no arriba. Que "Empezar" esté arriba del
       * pliegue fue un arreglo medido en tres teléfonos —estaba entre 160 y 367
       * píxeles por debajo— y nada puede volver a empujarlo.
       */}
      {preferencias.densidad === undefined && (
        <section className="mt-8">
          <Rotulo>ALGO QUE TODAVÍA NO PROBASTE</Rotulo>
          <div className="registro mt-3">
            <div>
              <span className="canal">◇</span>
              <span className="min-w-0">
                <span className="nombre block">El fuelle</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-[var(--color-glosa)]">
                  Transpirar en los huecos que la sesión ya tiene, sin tocar el descanso que
                  hace falta para la serie que viene.
                </span>
              </span>
              <span />
            </div>
          </div>
          <div className="mt-3 flex gap-3">
            <button
              onClick={() => void guardarPreferencias({ densidad: 'suave' })}
              className="rotulo px-4 py-3"
              style={{ border: '1px solid var(--color-regla-fuerte)' }}
            >
              Probarlo
            </button>
            <button
              onClick={() => void guardarPreferencias({ densidad: 'apagada' })}
              className="rotulo px-4 py-3"
              style={{ border: '1px solid var(--color-regla)' }}
            >
              Ahora no
            </button>
          </div>
        </section>
      )}

      <section className="mt-8">
        <Rotulo className="mb-3">DÓNDE ESTÁS</Rotulo>
        <Carta filas={filasDeCarta} />
      </section>

      <section className="mt-8">
        <div className="flex items-baseline justify-between gap-4">
          <Rotulo>ÚLTIMOS 28 DÍAS</Rotulo>
          <p className="cifra text-sm">
            {preferencias.encuadre === 'restante'
              ? `faltan ${Math.max(0, marcha.meta - marcha.hechas - marcha.cubiertos)}`
              : `${marcha.hechas} de ${marcha.meta}`}
          </p>
        </div>
        <div className="mt-2 flex h-1.5 gap-px" aria-hidden>
          {Array.from({ length: marcha.meta }, (_, i) => (
            <span
              key={i}
              className="flex-1"
              style={{
                backgroundColor:
                  i < marcha.hechas
                    ? 'var(--color-vega)'
                    : i < marcha.hechas + marcha.cubiertos
                      ? 'var(--color-regla-fuerte)'
                      : 'var(--color-regla)',
              }}
            />
          ))}
        </div>
        {marcha.cubiertos > 0 && (
          <p className="mt-2 text-xs text-[var(--color-glosa)]">
            {marcha.cubiertos === 1 ? 'Un día cubierto' : `${marcha.cubiertos} días cubiertos`} con
            tus créditos. Faltar estaba previsto.
          </p>
        )}
      </section>

    </>
  )
}
