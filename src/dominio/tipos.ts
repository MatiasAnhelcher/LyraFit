/**
 * Tipos del dominio.
 *
 * Todo el vocabulario de la app vive acá y está en castellano a propósito:
 * cuando el código habla el mismo idioma que el entrenamiento, se lee sin
 * traducir mentalmente cada vez.
 */

/** Los cuatro patrones de movimiento sobre los que se arma el entrenamiento. */
export type Patron = 'empuje' | 'traccion' | 'piernas' | 'core' | 'bisagra'

/**
 * Un ejercicio se mide por repeticiones (flexiones) o por tiempo de sostén
 * (plancha, palanca). Cambia la unidad, no la lógica de progresión.
 */
export type Medida = 'repeticiones' | 'segundos'

/** Cuánto hay que hacer de un ejercicio para considerarlo dominado. */
export interface Objetivo {
  series: number
  /** Repeticiones o segundos por serie, según la medida del ejercicio. */
  cantidad: number
}

export interface Ejercicio {
  id: string
  nombre: string
  patron: Patron
  medida: Medida
  /**
   * Posición dentro de su cadena de progresión, empezando en 1.
   * Es lo que permite avanzar y retroceder de nivel sin listas sueltas.
   */
  nivel: number
  /** Una línea que explica de qué se trata el ejercicio. */
  resumen: string
  /** Cómo se ejecuta, paso a paso. */
  tecnica: string[]
  /** Los errores que aparecen siempre y arruinan el ejercicio. */
  erroresComunes: string[]
  /**
   * La ventana de trabajo del ejercicio: se sube de a poco dentro de ella y,
   * al llegar al techo, se pasa al eslabón siguiente. Es la doble progresión
   * en la que coinciden todos los sistemas serios de calistenia.
   */
  ventana: Ventana
  /** Cuántas series se hacen de este ejercicio. */
  series: number
  /**
   * Coeficiente de carga relativa: qué fracción del peso del cuerpo mueve
   * este ejercicio. Es lo que hace comparables dos ejercicios distintos, y
   * por lo tanto lo que permite calcular cuánto bajar el objetivo al cambiar
   * de eslabón en vez de inventar un número.
   *
   * Para las variantes de flexión hay mediciones directas publicadas; para el
   * resto es una estimación calibrada contra la práctica. Es una escala
   * ordinal con magnitud, no una medición: la app nunca la muestra como si
   * fuera un dato del cuerpo de la persona.
   */
  ccr: number
  /** Segundos de descanso sugeridos entre series. */
  descansoSegundos: number
}

/** El rango de repeticiones (o segundos) en el que se trabaja un ejercicio. */
export interface Ventana {
  /** Con cuánto se entra al eslabón. */
  min: number
  /** El techo: llegar acá es haberlo dominado. */
  max: number
}

/**
 * Una cadena de progresión: los ejercicios de un patrón ordenados de más
 * accesible a más exigente. Es la columna vertebral de la app.
 */
export interface Cadena {
  patron: Patron
  nombre: string
  descripcion: string
  /** Ids de ejercicios, ordenados por nivel ascendente. */
  ejercicios: string[]
}

/** Una serie efectivamente realizada y registrada. */
export interface Serie {
  /** Repeticiones o segundos logrados. */
  logrado: number
  /**
   * Lo que la persona dijo que le iba a salir, antes de hacerla.
   *
   * Cuesta cero toques si acepta el número propuesto, y convierte datos que la
   * app ya guardaba en una medida de qué tan bien se conoce el propio cuerpo.
   * No es una meta ni da puntos: si diera puntos, se podría hacer trampa
   * prediciendo bajo.
   */
  predicho?: number
  /**
   * Repeticiones que sentía que le quedaban al cortar. Se pregunta solo en la
   * última serie del ejercicio, y nunca es obligatorio.
   */
  reservas?: number
  /**
   * La serie de cierre: la fácil que se agrega al final para que la sesión no
   * termine en el punto más duro.
   *
   * Se guarda porque es trabajo real y cuenta para el volumen y el historial,
   * pero **no opina sobre la progresión**. Está declarada "no se puede
   * fallar", y una serie que no se puede fallar tampoco puede empujar un
   * cambio de eslabón: al entrar en el promedio subía el rendimiento de 1,00
   * a 1,04 y podía disparar un salto que no se ganó.
   */
  cierre?: true
}

/** El registro de un ejercicio dentro de una sesión de entrenamiento. */
export interface RegistroEjercicio {
  ejercicioId: string
  /** El objetivo que tenía propuesto para esa sesión. */
  objetivo: Objetivo
  series: Serie[]
  /**
   * La bajada: volumen en el eslabón anterior, después del trabajo duro.
   *
   * Se marca por la misma razón que `Serie.cierre`, y la razón resultó ser más
   * concreta de lo previsto. El motor ya la saltea sin ayuda —es otro ejercicio
   * que el del avance— pero la curva de fuerza no: se queda con el máximo
   * índice de carga del día, y un eslabón más fácil hecho al techo de su
   * ventana puede dar un índice MÁS ALTO que el duro hecho al piso de la suya.
   * Medido: flexión inclinada baja al máximo da 0,576 contra 0,571 del eslabón
   * siguiente al mínimo. Sin esta marca, el punto del día quedaba atribuido al
   * ejercicio equivocado en las sesiones más completas.
   */
  bajada?: true
}

/**
 * Qué clase de sesión fue.
 *
 * La distinción no es cosmética: la sesión corta cuenta para la adherencia
 * —para que faltar sea recuperable— pero no mueve la progresión, porque un
 * entrenamiento de siete minutos no dice nada sobre si alguien está listo
 * para el eslabón siguiente. Separar las dos cosas es lo que permite ser
 * indulgente con la persona sin mentirle al motor.
 *
 * `fuelle` es el día de acondicionamiento: metabólico y movilidad, sin una sola
 * serie de la que el motor pueda opinar. Existe por la misma razón que la
 * corta, del otro lado: permite entrenar cinco días sin que el motor lea como
 * pérdida de capacidad lo que en realidad es no haber descansado.
 */
export type TipoSesion = 'plan' | 'corta' | 'vuelta' | 'fuelle'

/** Una sesión de entrenamiento completa. */
/**
 * Lo que el motor decidió esa noche, guardado para poder releerlo.
 *
 * La explicación del motor es el activo diferencial del producto —ninguna otra
 * app te muestra la regla que decidió tu próximo objetivo— y vivía diez
 * segundos: se mostraba en el cierre y se perdía para siempre. Guardarla
 * cuesta un par de cientos de bytes por sesión y convierte el historial en
 * algo que se puede leer en vez de una lista de fechas.
 *
 * Es una copia y no una referencia a propósito: si mañana cambian las reglas
 * del motor, lo que dice el historial tiene que seguir siendo lo que la app
 * dijo esa noche, no lo que diría hoy.
 */
export interface DecisionGuardada {
  patron: Patron
  /** El mismo `Movimiento` del motor, guardado como texto. */
  movimiento: string
  explicacion: string
  cambioDeNivel: boolean
}

/**
 * Una ráfaga metabólica efectivamente hecha.
 *
 * Es trabajo real y por eso se guarda, pero no tiene objetivo, no tiene ventana
 * y no pertenece a ninguna cadena: no hay nada que el motor pueda decidir con
 * esto. Es el mismo criterio que la serie de cierre —cuenta para el volumen, no
 * opina sobre la progresión— llevado un paso más lejos.
 */
export interface RegistroRafaga {
  rafagaId: string
  /** Segundos efectivamente en movimiento. */
  segundos: number
  /**
   * El ejercicio en cuyo descanso ocurrió, o `null` si fue en el bloque de
   * fuelle del final, que no cuelga de ninguna serie.
   */
  despuesDe: string | null
}

export interface Sesion {
  id: string
  /** Fecha en formato ISO (AAAA-MM-DD), para poder ordenar y agrupar. */
  fecha: string
  /** Momento en que se cerró la sesión, en milisegundos. */
  finalizadaEn: number
  /** Duración total en segundos. */
  duracionSegundos: number
  registros: RegistroEjercicio[]
  nota?: string
  tipo: TipoSesion
  /** Lo que el motor decidió al cerrarla. Ausente en las sesiones viejas. */
  decisiones?: DecisionGuardada[]
  /**
   * El trabajo metabólico de la sesión: las ráfagas que entraron en los
   * descansos y el bloque de fuelle del final.
   *
   * Vive en un campo aparte y no como un `RegistroEjercicio` más, a propósito.
   * Meterlo entre los registros funcionaría de casualidad —`cerrarSesion` sigue
   * de largo cuando el id no está en `POR_ID`— y "anda porque el Map no lo
   * tiene" es la clase de invariante que se rompe el día que alguien quiera
   * dibujar las ráfagas. Además ensuciaría el volumen: `seriesDeSesion` y
   * `repeticionesDeSesion` recorren `registros` sin filtrar.
   */
  rafagas?: RegistroRafaga[]
  /**
   * True si fue una sesión densa. Mismo idioma que `Serie.cierre`: un campo
   * opcional que solo está cuando es cierto.
   */
  densa?: true
  /**
   * Esfuerzo de la sesión entera, del 1 al 10. Es el session-RPE de Foster,
   * que es la forma más barata y mejor validada de estimar carga interna sin
   * un solo sensor.
   */
  esfuerzo?: number
  /**
   * Energía sentida antes y después, del 1 al 5, en la misma escala que el
   * ítem de energía del chequeo diario —que es de donde sale la medición
   * previa, sin pedir un toque extra—. Adaptado de la Subjective Vitality
   * Scale de Ryan y Frederick; no es la escala completa.
   *
   * La diferencia entre las dos es el único número honesto que puede dar una
   * app de entrenamiento sobre lo que entrenar le hace a la cabeza: es propio
   * de cada persona y se mide, no se promete.
   */
  vitalidadPre?: number
  vitalidadPost?: number
  /**
   * Cómo se sintió la sesión, de -2 a +2. Adaptado de la Feeling Scale de
   * Hardy y Rejeski.
   *
   * Importa más de lo que parece: la respuesta afectiva al entrenamiento
   * predice si va a haber una próxima sesión mejor que cualquier medida de
   * rendimiento. Por eso el motor la mira antes de subir la exigencia.
   */
  animo?: number
}

/**
 * El estado de avance en un patrón: en qué ejercicio de la cadena está,
 * con qué objetivo, y cómo viene la racha.
 */
export interface Avance {
  patron: Patron
  ejercicioId: string
  objetivoActual: Objetivo
  /**
   * Rendimiento reciente, suavizado. Es una media móvil exponencial del
   * rendimiento de cada sesión: 1 es "vengo cumpliendo", menos es "vengo
   * quedándome corto".
   *
   * Reemplaza a las dos rachas que había antes, y no es un detalle de
   * implementación: dos contadores que se reinician entre sí se pueden trabar
   * para siempre —una sesión que no era ni éxito ni fallo borraba las dos, así
   * que quien quedaba cerca del objetivo no subía ni bajaba nunca—. Una media
   * móvil tiene memoria suave: siempre se mueve, así que nunca se traba.
   */
  senal: number
  /**
   * Sesiones seguidas con el mismo objetivo. Si llega al techo, el motor
   * fuerza un cambio: quedarse quieto no es una opción que la app pueda tomar.
   */
  sesionesEnObjetivo: number
  /**
   * Sesiones que faltan antes de poder volver a cambiar de eslabón. Se pone
   * al cambiar de nivel para que nadie rebote entre dos ejercicios sin llegar
   * a consolidar ninguno.
   */
  graciaRestante: number
  actualizadoEn: number
}

/** Un bloque dentro de una rutina: qué patrón se trabaja y en qué orden. */
export interface BloqueRutina {
  patron: Patron
  /** Para mostrar el porqué del bloque al armar la sesión. */
  nota?: string
  /**
   * El patrón con el que este bloque ALTERNA entre un día y el siguiente.
   *
   * Existe por dos razones que coinciden. La de entrenamiento: la bisagra de
   * cadera y la sentadilla no hace falta hacerlas las dos todos los días, y el
   * curl nórdico —donde termina la bisagra— se banca una vez por semana y no
   * tres. La de interfaz: sumar un quinto bloque empujaba `Empezar` abajo del
   * pliegue en un teléfono de 360×640, que es exactamente lo que ya se arregló
   * dos veces. Alternar no cuesta ni un píxel.
   */
  alterna?: Patron
}

/**
 * Qué clase de día es cada día de la semana. Las claves son 1 (lunes) a 7.
 *
 * El tipo vive acá y no en `rutinas.ts` porque `Preferencias` lo necesita, y
 * `rutinas.ts` ya importa de acá: al revés sería un ciclo.
 */
export type Semana = Record<number, 'descanso' | 'fuerza' | 'fuelle' | 'ambos'>

export interface Rutina {
  id: string
  nombre: string
  descripcion: string
  /** Días de la semana (1 = lunes … 7 = domingo) en que toca entrenar. */
  dias: number[]
  bloques: BloqueRutina[]
  /**
   * Los días que son de fuelle en vez de fuerza: acondicionamiento, sin una
   * sola serie de la cadena.
   *
   * Tienen que ser un subconjunto de `dias`, y existen para que se pueda
   * entrenar cinco días sin que el motor lea como pérdida de capacidad lo que
   * en realidad fue no haber descansado. Ausente en las rutinas que no los
   * tienen, que son todas las que ya estaban publicadas.
   */
  diasDeFuelle?: number[]
  /**
   * Los días que llevan fuerza Y fuelle: ráfagas adentro de los descansos y
   * bloque metabólico al final.
   *
   * Antes esto no era un día sino `Preferencias.densidad`, o sea una palanca
   * global que volvía densos todos los días de fuerza a la vez. Acá el preset
   * declara cuáles, y `densidad` queda reducida a lo único que de verdad es:
   * cuán fuerte, no cuáles.
   */
  diasDensos?: number[]
}

/** Preferencias de la app, guardadas junto con el resto de los datos. */
export interface Preferencias {
  id: 'unico'
  rutinaActivaId: string
  /**
   * Sonido. El fin del descanso, los récords y el cambio de nivel: nada más
   * suena. Se llama así por historia — antes era solo el aviso del descanso—
   * y se conserva el nombre para no migrar la base por un rótulo.
   */
  sonidoDescanso: boolean
  /**
   * Vibración. En iOS la API no existe, así que la fila ni se muestra: un
   * interruptor muerto es peor que ninguno.
   */
  haptica?: boolean
  tema: 'claro' | 'oscuro' | 'sistema'
  /** Cuándo se terminó de configurar la app. Si no está, se muestra el alta. */
  altaCompletadaEn?: number
  /** Qué tiene a mano para entrenar. Filtra las cadenas que necesitan barra. */
  tieneBarra?: boolean
  /**
   * Cómo prefiere leer la adherencia: lo que lleva hecho o lo que le falta.
   * Parece un detalle y no lo es — poder elegir el encuadre de la propia
   * métrica es una de las formas más baratas de respetar la autonomía.
   */
  encuadre?: 'logrado' | 'restante'
  /** Si el chequeo diario de tres preguntas está activado. Apagado por defecto. */
  estadoActivo?: boolean
  /** Si el módulo de hábitos de alimentación está activado. Apagado por defecto. */
  habitosActivos?: boolean
  /** Si se pide la predicción de repeticiones antes de cada serie. */
  prediccionActiva?: boolean
  /**
   * Cuánto aprieta el fuelle: el trabajo metabólico que entra en los descansos.
   * Apagada por defecto, y apagada deja la sesión exactamente como estaba.
   */
  densidad?: 'apagada' | 'suave' | 'fuerte'
  /**
   * Si puede saltar donde entrena. No es una preferencia de gusto: un
   * departamento con vecinos abajo no admite burpees, y ofrecerlos igual es
   * ofrecer algo que no va a hacer.
   */
  puedeSaltar?: boolean
  /** Si tiene un escalón, un cajón o una silla firme a mano. */
  tieneEscalon?: boolean
  /**
   * Cuánto se quiere que dure una sesión, en minutos.
   *
   * Lo que se estira para llegar es el bloque de fuelle, nunca las series: el
   * motor mide el rendimiento contra las series propuestas, así que agregar
   * series para llenar una hora se pagaría con eslabones.
   */
  minutosObjetivo?: number
  /**
   * La semana armada a mano: qué clase de día es cada día.
   *
   * Ausente quiere decir "nunca la tocó", y entonces manda la del preset
   * activo. Es la misma distinción que hace `densidad === undefined`, y por el
   * mismo motivo: ya está en los datos y alcanza con no aplanarla.
   *
   * El primer toque en la grilla escribe los siete días de una, así que no hay
   * estado a medio camino y no hay nada que migrar.
   */
  semana?: Semana
  /**
   * Si Lyra habla en voz alta lo que viene después.
   *
   * Es un canal distinto del sonido y por eso tiene su propio interruptor: los
   * earcons son marcas y el habla lleva contenido. Y donde el navegador no
   * tenga ninguna voz en español, la fila ni se muestra — mismo criterio que la
   * vibración en iOS.
   */
  voz?: boolean
  /** Cómo se quiere describir dentro de un año. Se usa en el cierre de sesión. */
  identidad?: string
}

/**
 * El chequeo diario: tres preguntas, quince segundos.
 *
 * Todas orientadas para que 5 sea lo mejor. Mezclar direcciones obliga a
 * invertir mentalmente y produce errores de carga.
 */
export interface Estado {
  /** Fecha local AAAA-MM-DD. Es la clave: una entrada por día. */
  fecha: string
  /** ¿Cómo dormiste anoche? 1 muy mal … 5 muy bien. */
  sueno: number
  /** ¿Cómo está tu energía hoy? 1 en el piso … 5 a pleno. */
  energia: number
  /** ¿Cómo andan tus músculos? 1 muy doloridos … 5 sin dolor. */
  musculos: number
  /**
   * Molestia en una zona puntual, no dolor muscular parejo. Es información de
   * seguridad, categórica: nunca entra en el promedio del índice.
   */
  molestia?: Patron
  /** True si se contestó después de entrenar, cuando el dolor ya está contaminado. */
  posterior?: boolean
  actualizadoEn: number
}

/**
 * Una sesión a medio hacer.
 *
 * No hay servidor, y hasta acá tampoco había red de contención: los cuarenta
 * minutos de una sesión vivían enteros en la memoria de la pestaña. Un
 * navegador que recicla la pestaña —que es exactamente lo que hace iOS cuando
 * atendés un llamado, cambiás de app o el teléfono queda corto de memoria—
 * borraba la sesión entera. Perder cuarenta minutos de trabajo es peor que
 * cualquier función que la app pueda no tener.
 *
 * Es una fila sola, con clave fija: no tiene sentido tener dos sesiones a
 * medio hacer al mismo tiempo.
 */
export interface SesionEnCurso {
  id: 'actual'
  /** Cuándo arrancó de verdad, para que el cronómetro no se reinicie al volver. */
  arrancadaEn: number
  /**
   * Segundos de sesión efectivamente transcurridos hasta este guardado.
   *
   * Es lo que se restaura, y no `arrancadaEn` a secas, porque las dos cosas no
   * son lo mismo cuando hubo un hueco: quien empieza a las ocho, se va, y
   * vuelve a las doce y media entrenó veinticinco minutos, no cuatro horas y
   * media. Sin esto la sesión quedaba escrita en el historial —para siempre—
   * con el tiempo muerto adentro, y contaminaba también la carga interna, que
   * se calcula sobre la duración.
   */
  duracionAcumulada: number
  actualizadoEn: number
  /** Si era una sesión corta. Se guarda porque venía en la URL y la URL se pierde. */
  corta: boolean
  /** Si era un día de fuelle. Mismo motivo que `corta`: venía en la URL. */
  diaDeFuelle?: boolean
  /**
   * Si era un día denso: fuerza CON fuelle. Mismo motivo que los dos de arriba.
   *
   * Hace falta desde que la densidad es del día y no una preferencia global:
   * antes se podía recalcular leyendo `preferencias.densidad`, y ahora depende
   * de qué día era cuando la sesión arrancó. Una sesión densa retomada como
   * fuerza pelada perdería las ráfagas y el bloque a mitad de camino.
   */
  densa?: boolean
  /** En qué ejercicio del plan iba. */
  indice: number
  /** En qué etapa: las series, el fuelle, la de cierre o las preguntas. */
  etapa: 'series' | 'fuelle' | 'cierre-serie' | 'preguntas'
  /** Cuántas ráfagas van hechas, para no repetir la misma al retomar. */
  rafagas?: RegistroRafaga[]
  /** Lo anotado hasta ahora, por ejercicio. */
  hechas: Record<string, Serie[]>
}
