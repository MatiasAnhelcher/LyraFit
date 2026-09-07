/**
 * Tipos del dominio.
 *
 * Todo el vocabulario de la app vive acá y está en castellano a propósito:
 * cuando el código habla el mismo idioma que el entrenamiento, se lee sin
 * traducir mentalmente cada vez.
 */

/** Los cuatro patrones de movimiento sobre los que se arma el entrenamiento. */
export type Patron = 'empuje' | 'traccion' | 'piernas' | 'core'

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
}

/** El registro de un ejercicio dentro de una sesión de entrenamiento. */
export interface RegistroEjercicio {
  ejercicioId: string
  /** El objetivo que tenía propuesto para esa sesión. */
  objetivo: Objetivo
  series: Serie[]
}

/**
 * Qué clase de sesión fue.
 *
 * La distinción no es cosmética: la sesión corta cuenta para la adherencia
 * —para que faltar sea recuperable— pero no mueve la progresión, porque un
 * entrenamiento de siete minutos no dice nada sobre si alguien está listo
 * para el eslabón siguiente. Separar las dos cosas es lo que permite ser
 * indulgente con la persona sin mentirle al motor.
 */
export type TipoSesion = 'plan' | 'corta' | 'vuelta'

/** Una sesión de entrenamiento completa. */
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
  /**
   * Esfuerzo de la sesión entera, del 1 al 10. Es el session-RPE de Foster,
   * que es la forma más barata y mejor validada de estimar carga interna sin
   * un solo sensor.
   */
  esfuerzo?: number
  /**
   * Energía sentida antes y después, del 1 al 7. Adaptado de la Subjective
   * Vitality Scale de Ryan y Frederick; no es la escala completa.
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
}

export interface Rutina {
  id: string
  nombre: string
  descripcion: string
  /** Días de la semana (1 = lunes … 7 = domingo) en que toca entrenar. */
  dias: number[]
  bloques: BloqueRutina[]
}

/** Preferencias de la app, guardadas junto con el resto de los datos. */
export interface Preferencias {
  id: 'unico'
  rutinaActivaId: string
  /** Sonido al terminar el descanso. */
  sonidoDescanso: boolean
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
