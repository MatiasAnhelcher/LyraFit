/**
 * Las figuras: cómo se ve cada ejercicio.
 *
 * El agujero que tapan es concreto. El motor te manda a hacer "flexiones
 * pseudo plancha" o "palanca frontal negativa" y la app te lo explica con
 * cuatro renglones de texto. El texto es bueno y no alcanza: nadie deduce una
 * postura leyendo "las manos a la altura de la cintura, el cuerpo adelantado".
 * Lo que falta no es más texto, es la forma.
 *
 * ## Por qué dibujos y no fotos
 *
 * No hay servidor: todo lo que la app muestra tiene que estar precacheado para
 * funcionar en un parque sin señal. Treinta y nueve ejercicios en foto o video
 * son decenas de megabytes contra los novecientos kilobytes que pesa hoy la app
 * entera. Además no hay de dónde sacar esas fotos con licencia, y una foto de
 * banco de imágenes sería un cuerpo ajeno adentro de un sistema visual de
 * líneas finas.
 *
 * Un dibujo generado pesa los bytes de sus ángulos, se pinta con los colores
 * del tema, y —esto es lo que de verdad importa— **se puede mover**. Lo que
 * nadie entiende de un ejercicio no es la postura quieta: es qué se mueve y
 * hasta dónde. Dos posturas y una interpolación entre ellas dicen eso, y el
 * texto no puede.
 *
 * ## Por qué paramétrico y no treinta y nueve dibujos
 *
 * Dibujar cada ejercicio a mano daría treinta y nueve figuras que no se
 * parecen entre sí, imposibles de mantener y pesadas de revisar. Acá el cuerpo
 * es uno solo —siete segmentos con proporciones humanas fijas— y cada ejercicio
 * es una lista de ángulos. Todos los ejercicios salen de la misma persona, un
 * arreglo en las proporciones los arregla a los treinta y nueve, y revisar uno
 * nuevo es mirar catorce números.
 *
 * ## Lo que un dibujo así NO puede decir, y hay que decirlo
 *
 * De perfil y con líneas no se ve el agarre, la rotación del hombro ni la
 * separación de las manos. Eso sigue viviendo en `tecnica`, que no se
 * reemplaza: la figura muestra el recorrido y la forma del cuerpo, el texto
 * dice el detalle. Son dos cosas distintas y se necesitan las dos.
 */

/** Los ángulos son absolutos, en grados: 0 apunta a la derecha, 90 hacia arriba. */
export interface Postura {
  /** Cadera → hombro. La inclinación del tronco. */
  torso: number
  /** Hombro → cabeza. */
  cuello: number
  /** Hombro → codo. */
  brazo: number
  /** Codo → muñeca. */
  antebrazo: number
  /** Cadera → rodilla. */
  muslo: number
  /** Rodilla → tobillo. */
  pantorrilla: number
  /** Tobillo → punta del pie. */
  pie: number
  /**
   * La pierna y el brazo del otro lado, cuando hacen algo distinto.
   *
   * De perfil, en un ejercicio simétrico, el lado lejano queda exactamente
   * detrás del cercano: dibujarlo no agrega nada y encima se ve como un error
   * de registro. Por eso son opcionales y por defecto no se dibujan.
   *
   * Pero siete de los treinta y nueve ejercicios son asimétricos —la zancada,
   * la búlgara, el pistol, las arqueras, la de un brazo— y sin el otro lado no
   * se entienden: una zancada dibujada con una sola pierna es una persona
   * parada en un pie. Ahí se especifican y se dibujan más finos, que es como se
   * lee "esto está más lejos".
   */
  musloLejos?: number
  pantorrillaLejos?: number
  pieLejos?: number
  brazoLejos?: number
  antebrazoLejos?: number
}

/**
 * Qué hay alrededor del cuerpo.
 *
 * Los apoyos se dibujan a partir de la postura y no se ubican a mano: el banco
 * va donde están las manos, la barra donde están las muñecas. Es lo que evita
 * la clase de error más común de un dibujo así — la persona flotando diez
 * píxeles arriba del banco en el que se supone que se apoya.
 */
export type Escena =
  /** Solo el piso. */
  | 'piso'
  /** El piso y una superficie bajo las manos: pared, mesada, banco, silla. */
  | 'apoyo-manos'
  /** El piso y una superficie bajo los pies: flexiones declinadas. */
  | 'apoyo-pies'
  /** Una barra a la altura de las muñecas, y el piso abajo. */
  | 'barra'
  /** Barra baja para remo: el cuerpo debajo, los pies en el piso. */
  | 'barra-baja'
  /** El piso y un banco detrás, bajo el pie de atrás o la cola. */
  | 'banco-atras'

export interface Figura {
  /** La postura de la que se parte, que es donde la serie descansa. */
  inicio: Postura
  /** El otro extremo del recorrido. */
  fin: Postura
  escena: Escena
  /**
   * Qué parte sostiene el peso, para apoyarla en el piso al dibujar.
   *
   * Sin esto habría que acertar la altura de la cadera a mano en cada
   * ejercicio, que es imposible de mantener. Se calcula la figura con la cadera
   * en el origen y después se baja entera hasta que esta parte toca el piso.
   */
  apoyo: 'manos' | 'pies' | 'antebrazos' | 'cola' | 'colgado'
  /** Una línea que dice qué mirar. No repite la técnica: la resume en el gesto. */
  gesto: string
}

// ─── El cuerpo ───────────────────────────────────────────────────────────

/**
 * Proporciones humanas, como fracción de la altura de pie.
 *
 * Salen de las tablas antropométricas de Drillis y Contini, que es lo que usa
 * cualquier libro de biomecánica. Importa que sean las reales y no unas
 * inventadas: con proporciones mal puestas, una sentadilla dibujada con los
 * ángulos correctos igual se ve rara y nadie sabe por qué.
 */
export const CUERPO = {
  muslo: 0.245,
  pantorrilla: 0.246,
  /** Cadera a hombro. */
  torso: 0.288,
  brazo: 0.186,
  antebrazo: 0.146,
  pie: 0.055,
  /** Hombro a centro de la cabeza. */
  cuello: 0.11,
  cabeza: 0.065,
} as const

export interface Punto {
  x: number
  y: number
}

export interface Esqueleto {
  cadera: Punto
  hombro: Punto
  cabeza: Punto
  codo: Punto
  muñeca: Punto
  rodilla: Punto
  tobillo: Punto
  punta: Punto
  /** El lado lejano, solo cuando la postura lo pide. */
  rodillaLejos?: Punto
  tobilloLejos?: Punto
  puntaLejos?: Punto
  codoLejos?: Punto
  muñecaLejos?: Punto
}

/** Un punto a `largo` de distancia de `desde`, en el ángulo dado. */
function avanzar(desde: Punto, grados: number, largo: number): Punto {
  const rad = (grados * Math.PI) / 180
  // La y del SVG crece hacia abajo, así que un ángulo positivo —que para quien
  // escribe la postura significa "hacia arriba"— tiene que restar.
  return { x: desde.x + Math.cos(rad) * largo, y: desde.y - Math.sin(rad) * largo }
}

/**
 * Arma el esqueleto a partir de una postura, con la cadera en el origen y a
 * escala 1. Quien dibuja se encarga de escalar y ubicar.
 */
export function esqueleto(p: Postura): Esqueleto {
  const cadera = { x: 0, y: 0 }
  const hombro = avanzar(cadera, p.torso, CUERPO.torso)
  const rodilla = avanzar(cadera, p.muslo, CUERPO.muslo)
  const tobillo = avanzar(rodilla, p.pantorrilla, CUERPO.pantorrilla)
  const codo = avanzar(hombro, p.brazo, CUERPO.brazo)
  const e: Esqueleto = {
    cadera,
    hombro,
    rodilla,
    tobillo,
    codo,
    cabeza: avanzar(hombro, p.cuello, CUERPO.cuello),
    muñeca: avanzar(codo, p.antebrazo, CUERPO.antebrazo),
    punta: avanzar(tobillo, p.pie, CUERPO.pie),
  }

  if (p.musloLejos !== undefined) {
    e.rodillaLejos = avanzar(cadera, p.musloLejos, CUERPO.muslo)
    e.tobilloLejos = avanzar(e.rodillaLejos, p.pantorrillaLejos ?? p.musloLejos, CUERPO.pantorrilla)
    e.puntaLejos = avanzar(e.tobilloLejos, p.pieLejos ?? p.pie, CUERPO.pie)
  }
  if (p.brazoLejos !== undefined) {
    e.codoLejos = avanzar(hombro, p.brazoLejos, CUERPO.brazo)
    e.muñecaLejos = avanzar(e.codoLejos, p.antebrazoLejos ?? p.brazoLejos, CUERPO.antebrazo)
  }

  return e
}

/**
 * El punto por el que la figura está clavada al mundo.
 *
 * Es uno solo y es el que no se mueve en todo el ejercicio: la mano en el
 * piso, el pie en el suelo, la muñeca en la barra. Sirve para alinear las
 * posturas entre sí, que es lo que evita el defecto más feo de una animación
 * así — la mano que patina por el piso mientras la persona baja.
 */
export function puntoDeApoyo(e: Esqueleto, apoyo: Figura['apoyo']): Punto {
  switch (apoyo) {
    case 'manos':
    case 'colgado':
      return e.muñeca
    case 'antebrazos':
      return e.codo
    case 'cola':
      return e.cadera
    case 'pies':
    default:
      return e.tobillo
  }
}

/** Los puntos que tocan el suelo según qué sostiene el peso. */
export function puntosDeApoyo(e: Esqueleto, apoyo: Figura['apoyo']): Punto[] {
  switch (apoyo) {
    case 'manos':
      return [e.muñeca]
    case 'antebrazos':
      return [e.codo, e.muñeca]
    case 'cola':
      return [e.cadera]
    case 'colgado':
      return [e.muñeca]
    case 'pies':
    default:
      return [e.tobillo, e.punta, ...(e.puntaLejos ? [e.tobilloLejos!, e.puntaLejos] : [])]
  }
}

/** Interpola dos posturas. `t` va de 0 (inicio) a 1 (fin). */
export function entre(a: Postura, b: Postura, t: number): Postura {
  const mezclar = (x: number, y: number) => x + (y - x) * t
  // El lado lejano solo se mezcla si las dos posturas lo tienen. Si una lo
  // declara y la otra no, aparecería de la nada a mitad del recorrido.
  const par = (x?: number, y?: number) =>
    x === undefined || y === undefined ? undefined : mezclar(x, y)

  return {
    torso: mezclar(a.torso, b.torso),
    cuello: mezclar(a.cuello, b.cuello),
    brazo: mezclar(a.brazo, b.brazo),
    antebrazo: mezclar(a.antebrazo, b.antebrazo),
    muslo: mezclar(a.muslo, b.muslo),
    pantorrilla: mezclar(a.pantorrilla, b.pantorrilla),
    pie: mezclar(a.pie, b.pie),
    musloLejos: par(a.musloLejos, b.musloLejos),
    pantorrillaLejos: par(a.pantorrillaLejos, b.pantorrillaLejos),
    pieLejos: par(a.pieLejos, b.pieLejos),
    brazoLejos: par(a.brazoLejos, b.brazoLejos),
    antebrazoLejos: par(a.antebrazoLejos, b.antebrazoLejos),
  }
}

// ─── Dónde cae el cuerpo en el lienzo ────────────────────────────────────
//
// Esto vive acá y no en el componente porque es geometría pura, y porque una
// figura mal ubicada —el pie flotando, la mano despegada de la barra— es un
// defecto que se puede comprobar con una cuenta en vez de con el ojo. Con
// treinta y nueve ejercicios, revisar a ojo no escala.

/** El lienzo. La figura de pie mide `ALTO_CUERPO` y el piso está en `PISO`. */
export const ANCHO = 120
export const ALTO = 100
export const PISO = 88
export const ALTO_CUERPO = 62
/** Dónde va la barra cuando alguien cuelga de ella. */
export const ALTURA_BARRA = 20

/** Aplica la misma transformación a todos los puntos, estén o no presentes. */
function transformar(e: Esqueleto, f: (p: Punto) => Punto): Esqueleto {
  const salida = {} as Record<string, Punto | undefined>
  for (const [nombre, punto] of Object.entries(e)) {
    salida[nombre] = punto ? f(punto) : undefined
  }
  return salida as unknown as Esqueleto
}

export const escalar = (e: Esqueleto, k: number) =>
  transformar(e, (p) => ({ x: p.x * k, y: p.y * k }))

export const mover = (e: Esqueleto, dx: number, dy: number) =>
  transformar(e, (p) => ({ x: p.x + dx, y: p.y + dy }))

export const todos = (e: Esqueleto): Punto[] => Object.values(e).filter(Boolean) as Punto[]

/**
 * Ubica la figura: la apoya donde corresponde y la centra.
 *
 * La descomposición importa y costó un intento entenderla:
 *
 * - **La altura se calcula en cada cuadro.** El pie no despega del piso ni la
 *   muñeca de la barra mientras el cuerpo se mueve. Anclar una sola vez con la
 *   postura de inicio dejaba a la sentadilla flotando abajo y a la dominada
 *   despegada de la barra en la posición de arriba.
 * - **El centrado horizontal sale de una sola postura.** Si cada cuadro se
 *   centrara por su propia caja, el cuerpo se correría de costado al doblar los
 *   codos y parecería que camina en el aire.
 *
 * Colgado es la excepción a la segunda: ahí las manos tampoco se mueven de
 * lugar, así que la referencia horizontal es la muñeca y no la caja del cuerpo.
 */
export function ubicar(p: Postura, apoyo: Figura['apoyo'], referencia: Postura): Esqueleto {
  const cuerpo = escalar(esqueleto(p), ALTO_CUERPO)

  if (apoyo === 'colgado') {
    // La barra es un punto fijo: las manos se quedan ahí toda la serie.
    return mover(cuerpo, ANCHO / 2 - cuerpo.muñeca.x, ALTURA_BARRA - cuerpo.muñeca.y)
  }

  const dy = PISO - Math.max(...puntosDeApoyo(cuerpo, apoyo).map((q) => q.y))

  // El centrado horizontal se ancla en el APOYO, no en la caja del cuerpo.
  //
  // Anclarlo en la caja parecía razonable y estaba mal: en una sentadilla el
  // cuerpo cambia de forma —la cadera se va atrás— así que su caja se corre, y
  // con ella se corría el pie, que en la realidad está clavado al piso. Se veía
  // como si la persona patinara. Lo que no se mueve es lo que te sostiene, así
  // que es eso lo que hay que dejar quieto.
  //
  // La postura de referencia sí se centra por su caja: alguien tiene que
  // decidir dónde va la figura en el lienzo, y esa es la que lo decide.
  const base = escalar(esqueleto(referencia), ALTO_CUERPO)
  const xs = todos(base).map((q) => q.x)
  const dxReferencia = ANCHO / 2 - (Math.min(...xs) + Math.max(...xs)) / 2
  const anclaje = puntoDeApoyo(base, apoyo).x + dxReferencia
  const dx = anclaje - puntoDeApoyo(cuerpo, apoyo).x

  return mover(cuerpo, dx, dy)
}
