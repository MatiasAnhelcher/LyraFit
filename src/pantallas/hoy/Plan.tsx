import { useNavigate } from 'react-router-dom'
import { NOMBRE_PATRON, cadenaDe } from '@/dominio/biblioteca'
import { NOMBRE_DIA, diaDeLaSemana, destinoDelDia, type ClaseDeDia } from '@/dominio/rutinas'
import type { VezPasada } from '@/dominio/estadisticas'
import type { Ejercicio, Patron } from '@/dominio/tipos'
import { despertarAudio } from '@/respuesta'
import { orden } from '@/componentes/movimiento'
import { Accion, Glifo, Objetivo, Rotulo } from '@/componentes/ui'

/** Un bloque de hoy, ya resuelto como lo va a pedir la sesión. */
export interface BloqueDeHoy {
  patron: Patron
  ejercicio: Ejercicio
  objetivo: { series: number; cantidad: number }
  accesorio: boolean
  porMolestia: boolean
  antes: VezPasada | null
  abre: Ejercicio | null
}

/**
 * Qué toca hoy y la puerta para hacerlo: el rótulo del día, los ejercicios,
 * lo que se abre si se cumple y `Empezar`, con sus dos alternativas.
 *
 * Es donde se juega la regla del pliegue: `Empezar` tiene que quedar arriba de
 * la barra en un teléfono de 360×640, y cada renglón que se agregue acá lo
 * empuja hacia abajo.
 */
export function Plan({
  clase,
  esDiaDeEntrenar,
  esDiaDeFuelle,
  entrenoHoy,
  vuelve,
  nombreDeLaRutina,
  minutos,
  bloques,
  factorDelDia,
  siguiente,
  molestiaDeHoy,
}: {
  clase: ClaseDeDia
  esDiaDeEntrenar: boolean
  esDiaDeFuelle: boolean
  entrenoHoy: boolean
  /** Si es una sesión de vuelta, después de faltar. */
  vuelve: boolean
  nombreDeLaRutina: string
  /** Cuánto va a durar la sesión, estimado con las mismas cuentas que la arman. */
  minutos: number
  bloques: BloqueDeHoy[]
  /** El factor del día, el mismo que aplica la sesión. */
  factorDelDia: number
  /** El próximo día de entrenar, para decirlo los días de descanso. */
  siguiente: Date | null
  molestiaDeHoy: Patron | undefined
}) {
  const navegar = useNavigate()

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

  /**
   * CUÁNTAS FILAS ENTRAN EN HOY, Y POR QUÉ HAY UN TOPE.
   *
   * No es estético: es la regla del pliegue, y es el único lugar de la app
   * donde una preferencia de la persona puede romperla.
   *
   * Medido en un Android de 360×640 un día de entrenar, `Empezar` queda con
   * EXACTAMENTE doce píxeles de aire sobre la barra de navegación, que es el
   * mínimo. Esa medición está hecha con la rutina por defecto, que tiene
   * cuatro bloques. Las cuatro rutinas por grupo tienen CINCO, y cada fila
   * mide 56 px: con la quinta, `Empezar` queda cuarenta y cuatro píxeles por
   * debajo de la barra, o sea invisible hasta que alguien scrollee.
   *
   * Sería la cuarta vez que se rompe el pliegue, y esta vez ni siquiera haría
   * falta tocar Hoy: alcanzaría con elegir otra rutina en Ajustes.
   *
   * El tope lo hace imposible. Las que no entran se cuentan en un renglón de
   * dieciocho píxeles en vez de ocuparlas, y no se pierde información: la
   * sesión completa está a un toque de distancia, que es lo que `Empezar`
   * hace. `pliegue.mjs` mide esto con la rutina más alta, no con la que le
   * toque correr.
   */
  const TOPE_DE_FILAS = 4
  /*
   * Y cuando sobran, se muestra UNA MENOS, no el tope.
   *
   * La primera versión de esto cortaba en cuatro y ponía el renglón del resto
   * como una quinta fila del registro. Una fila del registro mide 56 px de
   * mínimo, así que cuatro filas más el renglón ocupan lo mismo que CINCO:
   * exactamente lo que el tope venía a evitar. Medido por `pliegue.mjs` en un
   * Android de 360×640: `Empezar` quedó a **−44 px** de la barra, o sea
   * tapado. Habría sido la cuarta vez que se rompe el pliegue, y la primera
   * causada por el arreglo del pliegue.
   *
   * Ahora el renglón del resto no es una fila: es una línea de rótulo de unos
   * 20 px, fuera del registro. Con tres filas más esa línea la pantalla queda
   * 36 px MÁS CORTA que con las cuatro de la rutina por defecto, así que la
   * rutina más alta tiene más aire que la común en vez de menos.
   *
   * Y con cuatro bloques o menos no se corta nada: la rutina por defecto
   * sigue mostrando sus cuatro filas y sus 12 px de aire, sin cambios.
   */
  const corta = bloques.length > TOPE_DE_FILAS
  const filasVisibles = bloques.slice(0, corta ? TOPE_DE_FILAS - 1 : TOPE_DE_FILAS)
  const filasOcultas = bloques.length - filasVisibles.length

  return (
    <>
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
                  : `HOY · ${nombreDeLaRutina.toUpperCase()}`
                : 'HOY TOCA DESCANSAR'}
          {esDiaDeEntrenar && !entrenoHoy && ` · ${minutos} MIN`}
        </Rotulo>

        {/* Los cuatro eslabones se muestran SOLO los días que se entrena.
            Hasta acá se pintaban siempre, y eso hacía dos cosas mal a la vez.
            La primera ya estaba escrita en `Hoy`, en el comentario de la clase
            del día: anunciar los cuatro eslabones un día de fuelle —donde no se
            hace una sola serie de cadena— es mentir dos veces.
            La segunda la encontró `pliegue.mjs` el primer jueves que corrió:
            son trescientos sesenta píxeles, y con ellos `Empezar` quedaba
            SETENTA Y TRES por debajo de la barra en un Android de 360×640 los
            días de descanso. O sea que en la rutina por defecto —lunes,
            miércoles y viernes— cuatro días de cada siete había que scrollear
            para llegar a lo único que la pantalla existe para hacer. Es la
            tercera vez que se rompe el pliegue y la primera que lo agarra una
            medición en vez de una persona.
            El botón se queda: entrenar un día de más está permitido. Lo que se
            va es la lista de lo que hoy no toca. */}
        {esDiaDeEntrenar && !esDiaDeFuelle && (
        <div className="registro mt-3" data-prueba="plan-de-hoy">
          {filasVisibles.map(({ patron, ejercicio, antes, objetivo, accesorio, porMolestia }, i) => {
            const cadena = cadenaDe(patron)
            const posicion = cadena.ejercicios.indexOf(ejercicio.id) + 1
            return (
              <div key={`${patron}-${ejercicio.id}`} className="entrar-en-orden" style={orden(i)}>
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
                    {/* Un accesorio no tiene posición en la cadena —no está en
                        ninguna, o es el eslabón de abajo— así que decir "3/9"
                        sería inventar un lugar que no ocupa. */}
                    {NOMBRE_PATRON[patron]}
                    {accesorio
                      ? ' · accesorio'
                      : porMolestia
                        ? ' · por molestia'
                        : ` · ${posicion}/${cadena.ejercicios.length}`}
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
                  series={objetivo.series}
                  cantidad={Math.max(1, Math.round(objetivo.cantidad * factorDelDia))}
                  medida={ejercicio.medida}
                />
              </div>
            )
          })}
        </div>
        )}

        {/* El resto, en una línea y NO en una fila del registro: una fila mide
            56 px de mínimo y acá no hay 56 px para gastar. Ver el comentario
            de `TOPE_DE_FILAS`. */}
        {esDiaDeEntrenar && !esDiaDeFuelle && filasOcultas > 0 && (
          <p className="rotulo mt-2" data-prueba="resto-del-plan">
            + {filasOcultas} {filasOcultas === 1 ? 'ejercicio más' : 'ejercicios más'} en la sesión
          </p>
        )}

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
            navegar(destinoDelDia(clase))
          }}
        >
          {entrenoHoy
            ? 'Entrenar otra vez'
            : esDiaDeFuelle
              ? 'Empezar el fuelle'
              : vuelve
                ? // "Volver a empezar" se lee como arrancar de cero, que es justo
                  // el miedo de quien faltó, y Lyra al lado dice que esto no se
                  // reinicia. No se reinicia: se retoma.
                  'Retomar'
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
        {/* Avisar una molestia, a un toque y siempre a mano.
            Hasta acá el único camino era el chequeo diario, que viene apagado
            de fábrica: para casi todo el mundo no había forma de decir "me
            molesta la muñeca". Va DEBAJO de `Empezar`, que es lo único que no
            puede moverse de lugar (la regla del pliegue), y con el mismo peso
            que la sesión corta: es una alternativa a empezar igual, no un
            cartel. Con una molestia avisada dice cuál, para poder retirarla. */}
        <button
          onClick={() => navegar('/molestia')}
          className="accion-quieta"
          data-prueba="avisar-molestia"
        >
          {molestiaDeHoy
            ? `Molestia en ${NOMBRE_PATRON[molestiaDeHoy].toLowerCase()} · cambiar`
            : 'Me molesta algo'}
        </button>
      </div>
    </>
  )
}
