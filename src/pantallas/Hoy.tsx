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
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { NOMBRE_PATRON, POR_ID, cadenaDe } from '@/dominio/biblioteca'
import {
  DIAS,
  NOMBRE_DIA,
  claseDeDia,
  diaDeLaSemana,
  diasDe,
  patronDelBloque,
  destinoDelDia,
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
import { bandaSostenida, ajusteDelDia, cadenasCongeladas } from '@/dominio/estado'
import { seAbreHoy } from '@/dominio/anticipacion'
import { PISO_DE_PROTEINA, senalesDelDia } from '@/dominio/nutricion'
import { mueveElPlan } from '@/dominio/progresion'
import {
  fechaISO,
  leerAvances,
  leerDiaDelDiario,
  leerEstadoDeHoy,
  leerEstados,
  guardarPreferencias,
  leerPreferencias,
  leerSesiones,
} from '@/datos/repositorio'
import { despertarAudio } from '@/respuesta'
import { Carta } from '@/componentes/carta'
import { Lyra } from '@/componentes/lyra'
import { IconoComida, IconoFuerza, IconoSueno } from '@/componentes/iconos'
import { orden } from '@/componentes/movimiento'
import { fraseDe, recordar, type Momento } from '@/dominio/frases'
import { Accion, Cargando, Glifo, Glosa, Objetivo, Rotulo, Tira } from '@/componentes/ui'

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

const FORMATO_FECHA = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

export function Hoy() {
  /**
   * El azar de la frase.
   *
   * Vive acá y no adentro de `fraseDe` porque todo `src/dominio/` son funciones
   * puras: una fuente de azar ahí adentro haría que el mismo estado diera
   * distintas frases y no habría forma de atar nada con un test.
   */
  const [azar, setAzar] = useState(() => Math.random())
  const navegar = useNavigate()
  const hoy = new Date()
  const fecha = fechaISO(hoy)

  const avances = useLiveQuery(leerAvances, [])
  const preferencias = useLiveQuery(leerPreferencias, [])
  const sesiones = useLiveQuery(() => leerSesiones(), [])
  const estados = useLiveQuery(leerEstados, [])
  const estadoDeHoy = useLiveQuery(leerEstadoDeHoy, [])
  const diaDelDiario = useLiveQuery(() => leerDiaDelDiario(), [])

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

  const rutina = rutinaActiva(preferencias)
  // Lo que implica haber elegido partir por grupo, dicho en pantalla y no
  // escondido en un comentario: cada músculo una vez por semana. Se dice y no
  // se impide.
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
  const marcha = adherencia(sesiones, fecha, diasDe(semana).length)
  const banda = bandaSostenida(estados, fecha)
  const ajuste = ajusteDelDia(banda)
  const vuelve = esVuelta(sesiones, fecha)

  const congeladas = cadenasCongeladas(estados, fecha)

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
    if (!resuelto) return []
    const { ejercicio, objetivo, accesorio } = resuelto
    if (!avance) return []

    // Si la sesión de hoy no mueve la progresión, no hay nada que anticipar:
    // el dato sería correcto y la promesa igual sería falsa.
    const cuenta =
      mueveElPlan(vuelve ? 'vuelta' : 'plan') && !ajuste.neutra && !congeladas.has(bloque.patron)

    const antes = laVezPasada(sesiones, ejercicio.id, fecha)
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
        // Lo que hiciste la última vez que te tocó ESTE ejercicio. Si cambiaste
        // de eslabón la semana pasada no hay con qué comparar, y no se inventa.
        antes,
        // Un accesorio nunca abre un eslabón: no está en ninguna cadena, o es
        // el anterior al que ya tenés. Anunciarlo sería una promesa falsa.
        abre: accesorio ? null : seAbreHoy(avance, cadenaDe(bloque.patron), POR_ID, cuenta),
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
    bloques.flatMap(({ patron, ejercicio, objetivo, accesorio }) => {
      const duro = { ejercicio, objetivo, bajada: false }
      // Un accesorio no lleva bajada: ya ES el trabajo liviano, o es un
      // movimiento con barra que no tiene eslabón anterior del que bajar.
      if (!esDensa || accesorio) return [duro]
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

  /**
   * Las tres señales del día.
   *
   * `valor === null` quiere decir "todavía no hay respuesta" y se dibuja como
   * un guion apagado. Un 0 NO es null: contestar "cero comidas con proteína"
   * es una respuesta, y tratarla como silencio dejaría la fila esperando para
   * siempre algo que ya está dicho.
   */
  const senales = senalesDelDia(diaDelDiario)
  const porciones = diaDelDiario?.porcionesDeProteina
  const senalesDelDia_filas = [
    {
      clave: 'entrenaste',
      a: esDiaDeEntrenar ? destinoDelDia(clase) : '/progreso',
      Icono: IconoFuerza,
      luz: 'var(--dominio-fuerza-luz)',
      titulo: 'Entrenaste',
      detalle: entrenoHoy
        ? 'hoy'
        : esDiaDeEntrenar
          ? `hoy toca · ${minutos} min`
          : 'hoy toca descansar',
      valor: entrenoHoy ? '✓' : esDiaDeEntrenar ? null : '·',
    },
    {
      clave: 'comiste',
      a: '/diario',
      Icono: IconoComida,
      luz: 'var(--dominio-comida-luz)',
      titulo: 'Comiste',
      detalle:
        porciones === undefined
          ? `comidas con proteína · el piso son ${PISO_DE_PROTEINA}`
          : porciones >= PISO_DE_PROTEINA
            ? 'comidas con proteína · estás en el piso'
            : `comidas con proteína · el piso son ${PISO_DE_PROTEINA}`,
      valor: porciones === undefined ? null : String(porciones),
    },
    {
      clave: 'dormiste',
      a: '/diario',
      Icono: IconoSueno,
      luz: 'var(--dominio-sueno-luz)',
      titulo: 'Dormiste',
      detalle: diaDelDiario?.sueno ? 'horas, anoche' : 'anoche',
      valor: diaDelDiario?.sueno ?? null,
    },
  ]

  const filasDeCarta = [...avances.values()].map((avance) => ({
    patron: avance.patron,
    avance,
  }))

  return (
    <>
      <header>
        <Rotulo>{FORMATO_FECHA.format(hoy).toUpperCase()}</Rotulo>
        {/* Lyra va acá, al lado de la cifra de identidad, y no arriba: la
            columna de la derecha de esta línea estaba vacía, así que la marca
            no cuesta un solo píxel de alto. Importa porque `Empezar` tiene doce
            píxeles de aire sobre la barra en un teléfono de 360×640, y ya se
            rompió una vez por un renglón de más.

            Quieta y no interactiva: acá es el logo. La que respira y contesta
            es la de más abajo. */}
        <div className="flex items-center justify-between gap-4">
          <p className="cifra-identidad mt-3">{String(total).padStart(3, '0')}</p>
          <Lyra tamano={56} interactiva={false} expresion="calma" className="shrink-0" />
        </div>
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

        {/* Los cuatro eslabones se muestran SOLO los días que se entrena.
            Hasta acá se pintaban siempre, y eso hacía dos cosas mal a la vez.
            La primera ya estaba escrita arriba, en el comentario de la clase
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
          {filasVisibles.map(({ patron, ejercicio, antes, objetivo, accesorio }, i) => {
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
                    {accesorio ? ' · accesorio' : ` · ${posicion}/${cadena.ejercicios.length}`}
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
      </div>

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

      {/*
        EL DÍA: entrenaste · comiste · dormiste.

        Las tres con el mismo peso visual exacto —misma fila, mismo canal,
        misma tipografía— porque esa igualdad ES la afirmación. Una app de
        entrenamiento que pone la comida y el sueño en una pantalla secundaria
        está diciendo que son secundarios, y no lo son: con dieta, dormir poco
        hizo que una parte mayor de lo que se bajó fuera músculo (Nedeltcheva
        2010, un ensayo chico). No es un accesorio del entrenamiento.

        Van DEBAJO de `Empezar` y no arriba. No es una decisión de jerarquía:
        es la regla del pliegue, medida en tres teléfonos. En un Android de
        360×640 `Empezar` tiene exactamente doce píxeles de aire sobre la barra
        de navegación, y cada renglón que se agregue arriba lo empuja por
        debajo. El orden sigue siendo quién sos, qué toca hoy, empezar, y
        después dónde estás parado.

        Y es un ESTADO, no un reclamo. Lo que falta se dibuja como un guion en
        glosa, nunca como una cruz ni en rojo: lo que falta no está prohibido,
        está sin iluminar. El silencio es la respuesta correcta la mayoría de
        los días.
      */}
      <section className="mt-10">
        <Rotulo>EL DÍA</Rotulo>
        <div className="registro mt-3">
          {senalesDelDia_filas.map((fila, i) => (
            <button
              key={fila.clave}
              onClick={() => navegar(fila.a)}
              className="fila-pulsable entrar-en-orden"
              style={orden(i)}
              data-prueba={`dia-${fila.clave}`}
            >
              <span className="canal" style={{ color: fila.luz }}>
                <fila.Icono className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="nombre block">{fila.titulo}</span>
                <span className="rotulo mt-0.5 block truncate">{fila.detalle}</span>
              </span>
              {/* Sin `opacity`: la glosa YA ES el apagado de este sistema, y
                  poner 0,55 encima la bajaba a 2,89:1 — por debajo del piso
                  de 4,5 que la propia paleta declara. Medido. Lo que falta se
                  dice en glosa y nada más; doblar el apagado lo vuelve
                  ilegible en vez de discreto. */}
              <span
                className="cifra-fila"
                style={fila.valor === null ? { color: 'var(--color-glosa)' } : undefined}
              >
                {fila.valor ?? '—'}
              </span>
            </button>
          ))}
        </div>
        {/* El único aviso que este módulo levanta solo, y por eso está acá y no
            escondido en el diario: es el dato que la percepción de la persona
            NO puede detectar sola. Los otros seis hábitos no avisan nada —
            nadie necesita que una app le diga que comió poca proteína. */}
        {senales.avisoDeCafeina && (
          <p className="mt-4 max-w-[40ch] text-sm leading-relaxed text-[var(--color-glosa)]">
            {senales.avisoDeCafeina}
          </p>
        )}
      </section>

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
