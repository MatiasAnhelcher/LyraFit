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

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { POR_ID, cadenaDe } from '@/dominio/biblioteca'
import {
  DIAS,
  claseDeDia,
  diasDe,
  patronDelBloque,
  proximoDia,
  rutinaActiva,
  semanaActiva,
  advertenciaDe,
  tieneFuelle,
} from '@/dominio/rutinas'
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
  type Densidad,
} from '@/dominio/metabolico'
import {
  RECORTE_DE_VUELTA,
  adherencia,
  esVuelta,
  proximoHito,
  sesionesDeVida,
} from '@/dominio/adherencia'
import { laVezPasada } from '@/dominio/estadisticas'
import {
  bandaSostenida,
  ajusteDelDia,
  cadenasCongeladas,
  contestoElChequeo,
} from '@/dominio/estado'
import { bloqueConMolestia, molestiasDeHoy } from '@/dominio/molestia'
import { seAbreHoy } from '@/dominio/anticipacion'
import { avisosDeLaRevision, eslabonesCerrados } from '@/dominio/apertura'
import { mueveElPlan } from '@/dominio/progresion'
import {
  descartarSesionEnCurso,
  fechaISO,
  guardarSesionSinCerrar,
  leerAvances,
  leerDiaDelDiario,
  leerEstadoDeHoy,
  leerHoraDeDormir,
  leerEstados,
  guardarPreferencias,
  leerPreferencias,
  leerSesionSinCerrar,
  leerSesiones,
} from '@/datos/repositorio'
import { respaldarEnSilencio } from '@/datos/respaldo'
import { SesionSinCerrar } from '@/componentes/sinCerrar'
import { Carta } from '@/componentes/carta'
import { Lyra } from '@/componentes/lyra'
import { useIrA } from '@/componentes/movimiento'
import { fraseDe, recordar, type Momento } from '@/dominio/frases'
import { Cargando, Glosa, Rotulo, Simbolo } from '@/componentes/ui'
import { Encabezado, FORMATO_FECHA } from './Encabezado'
import { Plan } from './Plan'
import { ElDia } from './ElDia'
import { Marcha } from './Marcha'

/**
 * Lo que Lyra ya dijo en esta pestaña.
 *
 * A nivel de módulo y no en el estado del componente: `Hoy` se monta y se
 * desmonta cada vez que se navega, y con la memoria adentro del componente
 * Lyra repetiría la misma frase al volver de Progreso. Tampoco va a la base:
 * una escritura en IndexedDB por cada apertura de la app, para recordar qué
 * frase se mostró, es un precio que esto no vale.
 */
let dichas: string[] = []

/**
 * El último sorteo, para que la frase no se vuelva a sortear en cada render.
 *
 * Vive al lado de `dichas` y por el mismo motivo: los dos son memoria de
 * módulo y no estado del componente, porque `Hoy` se monta y se desmonta cada
 * vez que se navega y la gracia es que Lyra no se repita entre idas y
 * vueltas.
 */
let ultimoSorteo: { azar: number; momento: Momento; dijo: ReturnType<typeof fraseDe> } | null = null

export function Hoy() {
  /**
   * El azar de la frase.
   *
   * Vive acá y no adentro de `fraseDe` porque todo `src/dominio/` son funciones
   * puras: una fuente de azar ahí adentro haría que el mismo estado diera
   * distintas frases y no habría forma de atar nada con un test.
   */
  const [azar, setAzar] = useState(() => Math.random())
  const irA = useIrA()
  const hoy = new Date()
  const fecha = fechaISO(hoy)

  const avances = useLiveQuery(leerAvances, [])
  const preferencias = useLiveQuery(leerPreferencias, [])
  const sesiones = useLiveQuery(() => leerSesiones(), [])
  const estados = useLiveQuery(leerEstados, [])
  const estadoDeHoy = useLiveQuery(leerEstadoDeHoy, [])
  const diaDelDiario = useLiveQuery(() => leerDiaDelDiario(), [])
  /** La misma hora de acostarse que usa el diario, para que los dos avisos digan lo mismo. */
  const horaDeDormir = useLiveQuery(() => leerHoraDeDormir(), [])
  /**
   * La sesión que quedó sin cerrar, si la hay: un borrador vencido con
   * trabajo adentro. Antes se borraba sola, sin mostrarse; ahora aparece acá
   * hasta que la persona elige qué hacer con ella.
   */
  const sinCerrar = useLiveQuery(leerSesionSinCerrar, [])
  const [sinCerrarResuelta, setSinCerrarResuelta] = useState<'guardada' | 'descartada' | null>(
    null,
  )

  if (!avances || !preferencias || !sesiones || !estados) {
    return (
      <>
        <h1 className="sr-only" tabIndex={-1}>
          Hoy
        </h1>
        <Rotulo>{FORMATO_FECHA.format(hoy).toUpperCase()}</Rotulo>
        <div className="mt-6">
          <Cargando filas={4} />
        </div>
      </>
    )
  }

  const rutina = rutinaActiva(preferencias)
  // Lo que implica haber elegido partir por grupo, dicho en pantalla y no
  // escondido en un comentario: si se hacen las cuatro, a cada una le toca una
  // vez por semana. Se dice y no se impide.
  const advertencia = advertenciaDe(rutina)
  const semana = semanaActiva(preferencias)
  /**
   * Qué clase de día es: los dos ejes —fuerza y fuelle— en un solo valor.
   *
   * El día de fuelle no le pide fuerza a ninguna cadena, así que la pantalla no
   * puede ofrecer lo mismo: anunciar los cuatro eslabones y después abrir un
   * bloque metabólico sería mentir dos veces.
   */
  const clase = claseDeDia(semana, hoy)
  const esDiaDeEntrenar = clase !== 'descanso'
  const esDiaDeFuelle = clase === 'fuelle'
  const siguiente = proximoDia(semana, hoy)
  const entrenoHoy = sesiones.some((s) => s.fecha === fecha)
  const total = sesionesDeVida(sesiones)
  const hito = proximoHito(total)
  const marcha = adherencia(sesiones, fecha, diasDe(semana))
  const banda = bandaSostenida(estados, fecha)
  const ajuste = ajusteDelDia(banda)
  const vuelve = esVuelta(sesiones, fecha)

  const congeladas = cadenasCongeladas(estados, fecha)
  /**
   * La molestia avisada hoy, con el chequeo prendido o apagado. Cambia el plan
   * de hoy —esa cadena baja un eslabón o se saltea— y Hoy lo tiene que
   * anunciar igual que lo va a pedir `Entrenar`.
   */
  const molestias = molestiasDeHoy(estados, fecha)
  const molestiaDeHoy = [...molestias][0]

  /**
   * El factor con el que se anuncia el objetivo, y tiene que ser EL MISMO que
   * aplica la sesión.
   *
   * Hoy usaba solo `ajuste.factor` y `Entrenar` usa `ajuste.factor *
   * RECORTE_DE_VUELTA`. En una sesión de vuelta —después de faltar— Hoy
   * ponía el encabezado "SESIÓN DE VUELTA", el botón de la vuelta, y al
   * lado anunciaba el objetivo entero: la pantalla prometía 10 y la sesión
   * pedía 7. El recorte es lo correcto; lo que estaba mal era no decirlo.
   */
  const factorDelDia = ajuste.factor * (vuelve ? RECORTE_DE_VUELTA : 1)

  const tieneBarraCargable = (preferencias.cargaMaximaKg ?? 0) > 0
  // La de dominadas, que decide qué eslabones puede abrir el motor. Ausente
  // cuenta como sí, que es lo que la app asumió siempre.
  const tieneBarra = preferencias.tieneBarra !== false

  const bloques = rutina.bloques.flatMap((bloqueDelPlan) => {
    // Un bloque puede alternar entre dos patrones según el día. La resolución
    // vive en el dominio para que esta pantalla y `Entrenar` no puedan diferir.
    const bloque = { ...bloqueDelPlan, patron: patronDelBloque(bloqueDelPlan, semana, hoy) }
    const avance = avances.get(bloque.patron)
    // Tres clases de bloque —el eslabón del motor, volumen en el anterior, y
    // un accesorio fijo con barra— resueltas en el dominio por el mismo
    // motivo que `patronDelBloque`: si esta pantalla y `Entrenar` difirieran,
    // Hoy anunciaría una sesión y la sesión sería otra.
    const resuelto = ejercicioDelBloque(bloque, avance, POR_ID, cadenaDe(bloque.patron), {
      tieneBarraCargable,
    })
    if (!resuelto || !avance) return []
    // Y la molestia, también desde el dominio y por el mismo motivo: si Hoy
    // anunciara la cadena entera y la sesión la pidiera bajada, la promesa
    // sería falsa justo donde más importa.
    const conMolestia = bloqueConMolestia(resuelto, molestias, POR_ID, cadenaDe(bloque.patron))
    if (conMolestia.cambio === 'saltea') return []
    const { ejercicio, objetivo, accesorio } = conMolestia
    const porMolestia = conMolestia.cambio === 'baja'

    // Si la sesión de hoy no mueve la progresión, no hay nada que anticipar:
    // el dato sería correcto y la promesa igual sería falsa.
    const cuenta =
      mueveElPlan(vuelve ? 'vuelta' : 'plan') && !ajuste.neutra && !congeladas.has(bloque.patron)

    // Sin vara en el eslabón bajado por una molestia, igual que en la sesión:
    // la vez pasada de ese eslabón puede ser su techo, y hoy se pide el piso.
    const antes = porMolestia ? null : laVezPasada(sesiones, ejercicio.id, fecha)
    return [
      {
        patron: bloque.patron,
        avance,
        ejercicio,
        /*
         * El objetivo de un accesorio sale de la VARA, no de una tabla.
         *
         * Un accesorio no tiene avance —el motor no lo progresa, y no debe:
         * `cerrarSesion` solo mueve un patrón "si se entrenó el ejercicio que
         * tocaba"— así que su progresión la lleva la persona. La app le pone
         * delante lo que hizo la última vez, que es exactamente la doble
         * progresión escrita a mano: llegaste al techo de la ventana, subí el
         * peso; no llegaste, repetilo.
         *
         * Acotado a la ventana para que una sesión excepcional no fije un
         * objetivo que después no se sostiene.
         */
        objetivo:
          accesorio && antes
            ? {
                series: objetivo.series,
                cantidad: Math.min(Math.max(antes.mejor, ejercicio.ventana.min), ejercicio.ventana.max),
                ...(antes.kg !== undefined ? { kg: antes.kg } : {}),
              }
            : objetivo,
        accesorio,
        porMolestia,
        // Lo que hiciste la última vez que te tocó ESTE ejercicio. Si cambiaste
        // de eslabón la semana pasada no hay con qué comparar, y no se inventa.
        antes,
        // Un accesorio nunca abre un eslabón: no está en ninguna cadena, o es
        // el anterior al que ya tenés. Anunciarlo sería una promesa falsa. El
        // eslabón bajado por una molestia, tampoco: no es el del motor. Y un
        // eslabón cerrado tampoco: el motor no lo va a abrir aunque cumplas.
        abre:
          accesorio || porMolestia
            ? null
            : seAbreHoy(
                avance,
                cadenaDe(bloque.patron),
                POR_ID,
                cuenta,
                eslabonesCerrados(cadenaDe(bloque.patron), avances, tieneBarra),
              ),
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
  /**
   * `densidad` dice cuán fuerte aprieta el fuelle, NO en qué días entra. Eso lo
   * decide la clase del día, que es lo que hace posible entrenar fuerte el
   * lunes y meterle fuelle solo al miércoles.
   *
   * El respaldo es suave y no apagada: un día marcado con fuelle por alguien
   * que nunca abrió Ajustes tiene que traer algo, y suave es la única densidad
   * que no supone ni que puede saltar ni que tiene un cajón.
   */
  const densidad: Densidad =
    preferencias.densidad === undefined || preferencias.densidad === 'apagada'
      ? tieneFuelle(clase)
        ? 'suave'
        : 'apagada'
      : preferencias.densidad
  const esDensa = clase === 'ambos'
  const equipo = {
    ...(preferencias.puedeSaltar !== undefined ? { puedeSaltar: preferencias.puedeSaltar } : {}),
    ...(preferencias.tieneEscalon !== undefined ? { tieneEscalon: preferencias.tieneEscalon } : {}),
  }
  const densidadDelDia: Densidad = tieneFuelle(clase) ? densidad : 'apagada'
  // Las mismas cuentas que hace `Entrenar`, con los mismos datos: la fuerza
  // primero, y el bloque cubriendo lo que falta para llegar a la duración
  // elegida. Si estas dos pantallas se separaran, la estimación diría una cosa
  // y la sesión duraría otra, que es peor que no estimar nada.
  // La MISMA cuenta que arma `Entrenar`, deduplicada igual: en un día denso
  // con una rutina por grupo el mismo ejercicio salía dos veces, y acá eso
  // inflaba la estimación de minutos que Hoy anuncia antes de empezar.
  const entradas = sinEjerciciosRepetidos(
    bloques.flatMap(({ patron, ejercicio, objetivo, accesorio, porMolestia }) => {
      const duro = { ejercicio, objetivo, bajada: porMolestia }
      // Un accesorio no lleva bajada: ya ES el trabajo liviano, o es un
      // movimiento con barra que no tiene eslabón anterior del que bajar. El
      // eslabón bajado por una molestia, tampoco: ya ES el de abajo, y la
      // cadena no se carga dos veces el día que avisa.
      if (!esDensa || accesorio || porMolestia) return [duro]
      const abajo = bajadaDe(ejercicio, cadenaDe(patron), POR_ID)
      return abajo
        ? [duro, { ...abajo, descansoSegundos: DESCANSO_DE_BAJADA, bajada: true }]
        : [duro]
    }),
  )

  const segundosDeFuelle =
    densidadDelDia === 'apagada'
      ? 0
      : bloqueDeFuelle(
          esDiaDeFuelle
            ? minutosDelDiaDeFuelle(densidadDelDia)
            : minutosDelBloque(minutosDeSesion(entradas), densidadDelDia),
          equipo,
          densidadDelDia,
          molestias,
        ).reduce((suma, paso) => suma + paso.segundos + paso.descansoSegundos, 0)

  const minutos = esDiaDeFuelle
    ? Math.round(segundosDeFuelle / 60) + 6
    : minutosDeSesion(entradas, segundosDeFuelle)

  /**
   * Qué le toca decir a Lyra.
   *
   * No es una frase al azar sobre un fondo: el momento sale del estado real de
   * la app, que es lo que separa una voz de un cartel. Si hoy toca descansar,
   * habla de descansar; si volvés después de faltar, habla de volver.
   */
  const momento: Momento = !esDiaDeEntrenar
    ? 'descanso'
    : vuelve
      ? 'vuelta'
      : entrenoHoy
        ? 'constancia'
        : 'abrir'

  /*
   * La frase, sorteada UNA vez por (momento, azar) y no en cada render.
   *
   * Lo que había era `const dijo = fraseDe(...)` seguido de `dichas =
   * recordar(...)` en el cuerpo del componente. `fraseDe` descarta lo que ya
   * está en `dichas`, así que el segundo render con el mismo azar no podía
   * devolver la frase del primero: la frase de Lyra cambiaba sola en cada
   * repintado, sin que nadie tocara nada.
   *
   * ## Por qué un memo de módulo y no `useMemo`
   *
   * Porque acá no se puede poner un hook. Este punto del componente está
   * DESPUÉS de los returns tempranos que esperan a `useLiveQuery`, y un hook
   * después de un return es el error #310 de React: la pantalla entera se
   * cae. Lo hice igual en el primer intento de este mismo arreglo, y es la
   * segunda vez en esta sesión que cometo exactamente este error —la primera
   * fue en `Entrenar`—. Lo agarró `revisar.mjs` en las dos.
   *
   * El memo de módulo hace el trabajo del `useMemo` sin ser un hook: mientras
   * el sorteo no cambie, devuelve lo mismo, y `dichas` se escribe una sola
   * vez por sorteo en vez de una por render. Sigue siendo una escritura
   * durante el render, pero ahora es IDEMPOTENTE, que es la propiedad que
   * importa: dos renders seguidos dan el mismo resultado.
   */
  if (!ultimoSorteo || ultimoSorteo.azar !== azar || ultimoSorteo.momento !== momento) {
    const sorteada = fraseDe(momento, azar, dichas, total)
    if (sorteada) dichas = recordar(dichas, sorteada.texto)
    ultimoSorteo = { azar, momento, dijo: sorteada }
  }
  const dijo = ultimoSorteo.dijo

  /**
   * Si la revisión única bajó algo de la palanca frontal, por qué. Se dice
   * hasta la próxima sesión, o hasta que algo lo mueva de donde lo bajamos, y
   * se calla solo: lo decide el dominio con lo que ya está guardado.
   */
  const avisosDeBajada = avisosDeLaRevision(
    preferencias.revisionDeRequisitos,
    sesiones,
    avances,
    tieneBarra,
  )

  const filasDeCarta = [...avances.values()].map((avance) => ({
    patron: avance.patron,
    avance,
  }))

  return (
    <>
      {/* El título de la pantalla es para el lector: lo que se ve arriba es
          la fecha y la cifra, y un "Hoy" grande no diría nada que la barra no
          diga. Es adonde va el foco al llegar. */}
      <h1 className="sr-only" tabIndex={-1}>
        Hoy
      </h1>
      <Encabezado hoy={hoy} total={total} hito={hito} />

      {ajuste.mensaje && (
        <div className="mt-8">
          <Glosa tono="ambar" cita={`Regla · estado sostenido ${banda === 'rojo' ? '3 días' : '2 de 3'}`}>
            {ajuste.mensaje}
          </Glosa>
        </div>
      )}

      {/* La sesión sin cerrar va ARRIBA de todo lo que toca hoy, y empuja
          `Empezar` hacia abajo a sabiendas: es un estado de excepción, que dura
          hasta el primer toque, y es lo único de la pantalla que se puede
          perder. Si igual se toca `Empezar`, Entrenar pregunta lo mismo antes
          de arrancar: nada se pisa sin mostrarse. */}
      {sinCerrar ? (
        <div className="mt-8">
          <SesionSinCerrar
            borrador={sinCerrar}
            hoy={fecha}
            alGuardar={async () => {
              await guardarSesionSinCerrar()
              void respaldarEnSilencio()
              setSinCerrarResuelta('guardada')
            }}
            alDescartar={async () => {
              await descartarSesionEnCurso()
              setSinCerrarResuelta('descartada')
            }}
          />
        </div>
      ) : (
        sinCerrarResuelta && (
          <p className="mt-8 text-sm text-[var(--color-glosa)]" role="status">
            {sinCerrarResuelta === 'guardada'
              ? 'Listo: la sesión quedó guardada en tu historial.'
              : 'Listo: la sesión se descartó.'}
          </p>
        )
      )}

      {/* Una fila de hoy con la molestia sola —avisada desde abajo— no es el
          chequeo contestado: la pregunta sigue en pie. */}
      {preferencias.estadoActivo && !(estadoDeHoy && contestoElChequeo(estadoDeHoy)) && (
        <button
          onClick={() => irA('/estado', { direccion: 'profundo' })}
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

      <Plan
        clase={clase}
        esDiaDeEntrenar={esDiaDeEntrenar}
        esDiaDeFuelle={esDiaDeFuelle}
        entrenoHoy={entrenoHoy}
        vuelve={vuelve}
        nombreDeLaRutina={rutina.nombre}
        minutos={minutos}
        bloques={bloques}
        factorDelDia={factorDelDia}
        siguiente={siguiente}
        molestiaDeHoy={molestiaDeHoy}
        haySinCerrar={!!sinCerrar}
      />

      {/* Por qué bajó el core, si la revisión de la palanca frontal lo bajó.
          DEBAJO de la acción por la regla del pliegue, como todo lo que no es
          lo que toca hoy: es una línea que se lee una vez, no algo que tenga
          que estar antes de poder empezar. */}
      {avisosDeBajada.map((aviso) => (
        <p
          key={aviso}
          className="mt-6 max-w-[42ch] text-sm leading-relaxed text-[var(--color-glosa)]"
          data-prueba="aviso-de-bajada"
        >
          {aviso}
        </p>
      ))}

      {/* El costo de haber partido por grupo.
       *
       * DEBAJO de la acción, y es la regla del pliegue otra vez: arriba son
       * cuatro renglones de texto —unos 76 px— sobre una pantalla que ya tiene
       * una fila más que la rutina por defecto. Medido: con la advertencia
       * arriba y cinco bloques, `Empezar` se va abajo de la barra en un
       * teléfono de 360×640.
       *
       * Y acá está mejor: el momento de decidir si partir por grupo conviene
       * es cuando se elige la rutina, y ahí la advertencia está completa, en
       * Ajustes, ANTES de las cuatro filas. Esto es el recordatorio, no la
       * decisión. */}
      {advertencia && (
        <p className="mt-6 max-w-[42ch] text-xs leading-relaxed text-[var(--color-glosa)]">
          {advertencia}
        </p>
      )}

      <ElDia
        clase={clase}
        esDiaDeEntrenar={esDiaDeEntrenar}
        entrenoHoy={entrenoHoy}
        minutos={minutos}
        diaDelDiario={diaDelDiario}
        horaDeDormir={horaDeDormir}
      />

      {/* Lyra, y lo único que dice.
       *
       * Va DEBAJO de la acción por la misma razón que el ofrecimiento del
       * fuelle: `Empezar` tiene doce píxeles de aire sobre la barra en un
       * teléfono chico, y ya se rompió una vez por un renglón de más. La marca
       * quieta, que es lo que hay que ver primero, está arriba y no cuesta alto.
       *
       * Tocarla cambia la frase. Es la única forma de que cientos de frases no
       * sean cientos de frases que nadie va a leer nunca. */}
      {dijo && (
        <section className="mt-8 flex items-start gap-3">
          <Lyra
            tamano={52}
            expresion={dijo.expresion}
            className="shrink-0"
            onTocar={() => setAzar(Math.random())}
          />
          <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-[var(--color-glosa)]">
            {dijo.texto}
          </p>
        </section>
      )}

      {/* El fuelle, ofrecido una vez.
       *
       * Una función que hay que ir a buscar a Ajustes es una función que no
       * existe: el fuelle se publicó apagado y la app se veía idéntica, así que
       * quien lo había pedido no lo encontró.
       *
       * La condición es `=== undefined` y no un campo de "ya lo vio", y es todo
       * el mecanismo: la diferencia entre "nunca se preguntó" y "se preguntó y
       * dijo que no" YA ESTÁ en los datos, y alcanza con no aplanarla. Los dos
       * botones escriben la semana entera, así que la fila no vuelve nunca más.
       *
       * La condición se mudó de `densidad` a `semana` cuando el fuelle pasó a
       * ser del día: desde entonces `densidad` dice cuán fuerte y no en qué
       * días, así que "Ahora no" no tendría dónde escribirse. Y de paso queda
       * mejor: quien armó su semana a mano ya sabe que el fuelle existe, y a ese
       * no hay nada que ofrecerle.
       *
       * Va DEBAJO de la acción y no arriba. Que "Empezar" esté arriba del
       * pliegue fue un arreglo medido en tres teléfonos —estaba entre 160 y 367
       * píxeles por debajo— y nada puede volver a empujarlo.
       */}
      {preferencias.semana === undefined && (
        <section className="mt-8">
          <Rotulo>ALGO QUE TODAVÍA NO PROBASTE</Rotulo>
          <div className="registro mt-3">
            <div>
              <span className="canal">
                <Simbolo nombre="rombo-vacio" />
              </span>
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
              onClick={() =>
                void guardarPreferencias({
                  // Los días de fuerza pasan a llevar fuelle adentro. No se
                  // agrega ningún día: probar algo nuevo no puede costar un día
                  // más de la semana de nadie.
                  semana: Object.fromEntries(
                    DIAS.map((d) => [d, semana[d] === 'fuerza' ? 'ambos' : (semana[d] ?? 'descanso')]),
                  ),
                })
              }
              className="boton-contorno boton-contorno-fuerte"
            >
              Probarlo
            </button>
            <button
              // Se guarda la semana tal cual está. No cambia nada, y eso es
              // justo lo que hace: deja escrito que ya se preguntó.
              onClick={() => void guardarPreferencias({ semana })}
              className="boton-contorno"
            >
              Ahora no
            </button>
          </div>
        </section>
      )}

      <section className="mt-8">
        <Rotulo className="mb-3">DÓNDE ESTÁS</Rotulo>
        <Carta filas={filasDeCarta} rotulo="nombre" />
      </section>

      {/* La barra mide solo los días del plan que ya pasaron desde la primera
          sesión (`adherencia()`), así que antes de la primera no hay nada que
          medir: aparece con ella, y no como una fila de casillas vacías el día uno.
          El aviso de créditos sale solo si de verdad pasó un día del plan sin
          sesión; no entrenar todavía hoy no lo dispara. */}
      {marcha.meta > 0 && <Marcha marcha={marcha} encuadre={preferencias.encuadre} />}

    </>
  )
}
