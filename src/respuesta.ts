/**
 * La respuesta: lo que la app contesta cuando hacés algo.
 *
 * Dos canales con jurisdicción estricta —tacto y sonido— y una regla que los
 * ordena a los dos: **el énfasis se gasta**. Si cada serie anotada sonara,
 * dieciocho sonidos por sesión convertirían el sonido en ruido y no quedaría
 * con qué marcar nada.
 *
 * Por eso el presupuesto de una sesión típica es: los avisos del descanso
 * —que son funcionales, porque en ese momento no estás mirando la pantalla— y
 * nada más.
 *
 * La frecuencia del resto se midió sobre el motor real, y salió al revés de lo
 * que se creía al escribir esto: el cambio de eslabón cae en el 35-40% de los
 * cierres, no seis veces por año. Las cuatro cadenas arrancan juntas y se
 * agrupan. Eso no lo vuelve ruido —un día común sigue sin sonar— pero sí
 * explica por qué el récord se fue: disparaba todavía más seguido.
 *
 * ## Sobre iOS, sin vueltas
 *
 * `navigator.vibrate` no existe en WebKit. Ni en Safari, ni en una PWA
 * instalada, ni detrás de un flag: no hay superficie web para el Taptic
 * Engine, y los trucos de "háptica falsa" con un tono de 20 Hz mueven el
 * parlante, no el motor. La consecuencia de diseño es la única que importa:
 * **ningún evento puede tener el tacto como única señal.** En este vocabulario
 * ninguno lo tiene — la serie tiene la casilla que se llena, el descanso tiene
 * su earcon, el nivel tiene la estrella.
 *
 * Y el audio tiene su propia trampa en iOS: un `AudioContext` creado fuera de
 * un gesto del usuario nace suspendido y se queda así para siempre. Un
 * temporizador no es un gesto. Por eso `despertarAudio()` se llama al tocar
 * "Empezar", y no cuando el descanso termina: si no, el aviso no suena nunca
 * en iPhone, que era el agujero más grande que tenía el producto.
 */

let ctx: AudioContext | null = null
let sonidoActivo = true
let hapticaActiva = true

export function configurarSonido(activo: boolean): void {
  sonidoActivo = activo
}

export function configurarHaptica(activo: boolean): void {
  hapticaActiva = activo
}

/** En iOS Safari `navigator.vibrate` no existe y no hay reemplazo. */
export const HAY_HAPTICA =
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

/**
 * Despierta el audio. Se llama DENTRO de un gesto del usuario, una sola vez.
 * Es idempotente y cuesta prácticamente nada si el contexto ya está andando.
 */
export function despertarAudio(): void {
  try {
    const Contexto =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Contexto) return

    ctx ??= new Contexto()
    if (ctx.state === 'suspended') void ctx.resume()

    // Un buffer mudo de un sample: el desbloqueo clásico de iOS.
    const fuente = ctx.createBufferSource()
    fuente.buffer = ctx.createBuffer(1, 1, 22050)
    fuente.connect(ctx.destination)
    fuente.start(0)
  } catch {
    /* Sin audio la app funciona igual. */
  }
}

// Al volver de segundo plano el contexto queda suspendido otra vez.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx?.state === 'suspended') void ctx.resume()
  })
}

// ─── Tacto ───────────────────────────────────────────────────────────────

/**
 * Siete patrones con una gramática: el peso dice qué clase de cosa pasó y la
 * cantidad de pulsos dice cuánto falta.
 *
 * Los huecos son de 80 ms porque por debajo de unos 50 ms el motor no llega a
 * frenar entre pulsos y dos toques se funden en uno solo largo. Y ninguno pasa
 * de 600 ms: más que eso se lee como alarma y no como respuesta.
 */
const TOQUE = {
  /** El piso del idioma: casi nada, solo la confirmación de que se anotó. */
  serie: [25],
  /** Los mismos dos livianos: "queda una", antes de que la hagas. */
  quedaUna: [25, 80, 25],
  /** Dos livianos y uno que se apoya: una cadencia que llega. */
  ejercicio: [25, 80, 25, 80, 110],
  /** El mismo dibujo que "queda una", al doble de peso. No es logro: es "ahora". */
  descanso: [45, 80, 45],
  /**
   * El único que EMPIEZA pesado. Medido sobre el motor real: el salto de
   * eslabón cae cada dos o tres sesiones, no seis veces por año como se creía
   * al escribir esto — las cuatro cadenas arrancan juntas y se agrupan.
   */
  nivel: [110, 110, 25, 80, 25, 80, 25],
  /** Cinco iguales: es un conteo, no una fanfarria. */
  hito: [25, 80, 25, 80, 25, 80, 25, 80, 25],
  /** Lo único de la app que baja. */
  deshacer: [80, 60, 25],
  /** La unidad más chica que el hardware produce, para la cuenta atrás. */
  antes: [18],
} as const

export type Toque = keyof typeof TOQUE

export function tocar(cual: Toque): void {
  if (!hapticaActiva || !HAY_HAPTICA) return
  try {
    navigator.vibrate(TOQUE[cual] as unknown as number[])
  } catch {
    /* Un dispositivo que no vibra no es motivo para romper nada. */
  }
}

// ─── Sonido ──────────────────────────────────────────────────────────────

/**
 * La voz: dos sinusoides, fundamental y octava.
 *
 * Una sinusoide sola desaparece bajo el ruido de un gimnasio; la octava por
 * debajo le da presencia sin volverla chillona en el parlante de un teléfono,
 * que pica justo entre 2 y 4 kHz.
 */
function nota(frecuencia: number, enSegundos: number, decaimiento: number, pico: number): void {
  if (!ctx) return

  const t = ctx.currentTime + enSegundos
  const volumen = ctx.createGain()
  volumen.connect(ctx.destination)

  // Ataque de 6 ms: con 0 ms hay un salto en la onda y se oye un clic.
  volumen.gain.setValueAtTime(0.0001, t)
  volumen.gain.linearRampToValueAtTime(pico, t + 0.006)
  // Decaimiento exponencial: la sonoridad se percibe en escala logarítmica,
  // así que una rampa lineal suena como si se cortara de golpe.
  volumen.gain.exponentialRampToValueAtTime(0.0001, t + decaimiento)

  // Arriba de 1200 Hz el parcial de octava se vuelve áspero, así que se baja.
  const parcial = frecuencia >= 1200 ? 0.1 : 0.22

  for (const [multiplo, amplitud] of [
    [1, 1],
    [2, parcial],
  ] as const) {
    const osc = ctx.createOscillator()
    const gan = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = frecuencia * multiplo
    gan.gain.value = amplitud
    osc.connect(gan)
    gan.connect(volumen)
    osc.start(t)
    osc.stop(t + decaimiento + 0.02)
  }
}

const CORTA = 0.1
const LARGA = 0.44

/**
 * Tres sonidos en toda la app, y son tres a propósito.
 *
 * Hubo un cuarto —el récord— y se fue después de medirlo: `esRecord` dispara
 * en más de la mitad de los pares ejercicio-sesión, porque al entrar a un
 * eslabón nuevo el máximo de ese ejercicio es cero y después cada peldaño de
 * la ventana es un máximo nuevo. No mide un récord: mide "estás subiendo", que
 * es lo que la app hace todo el tiempo. En este producto no existe un récord
 * raro, y un sonido frecuente disfrazado de raro devalúa a los otros dos.
 *
 * También se fue el de deshacer: una corrección no necesita banda de sonido, y
 * ya se ve en la pantalla.
 *
 * Los tres que quedan comparten una nota. El aviso es un D5, el cero es el A5
 * que está una cuarta más arriba, y el cambio de nivel arranca en ese mismo A5
 * y sube una octava. No es un idioma nuevo: es el idioma que escuchás ocho
 * veces por sesión, un piso más arriba, que es literalmente lo que pasó.
 */
const EARCON = {
  /** Sube una cuarta: "se terminó, arrancá". */
  descanso: () => {
    nota(660, 0, CORTA, 0.2)
    nota(880, 0.11, CORTA, 0.2)
  },
  /**
   * La entrada del descanso, tres segundos antes del cero. Un D5, una cuarta
   * justa por debajo del A5 que suena al final, y a la mitad del volumen: se
   * lee como "ya… ahora", no como dos alarmas.
   */
  aviso: () => {
    nota(587.33, 0, CORTA, 0.1)
  },
  /** El motivo del récord, completado con la octava, largo y lento. */
  nivel: () => {
    nota(880, 0, LARGA, 0.18)
    nota(1320, 0.26, LARGA, 0.18)
    nota(1760, 0.52, 0.9, 0.2)
  },
  /** El mismo tono cinco veces: es un conteo, no una melodía. */
  hito: () => {
    for (let i = 0; i < 5; i++) nota(440, i * 0.15, CORTA, 0.14)
  },
} as const

export type Earcon = keyof typeof EARCON

export function sonar(cual: Earcon): void {
  if (!sonidoActivo || ctx?.state !== 'running') return
  try {
    EARCON[cual]()
  } catch {
    /* Nada. */
  }
}

/**
 * Lo que NO suena, que es la mitad del diseño: la serie anotada, el ejercicio
 * completo —la pantalla ya lo dice y la estás mirando—, saltear, avanzar de
 * ejercicio, abrir la app, el chequeo diario, y cerrar una sesión de un día
 * normal.
 */
export const NO_SUENAN = [
  'serie anotada',
  'ejercicio completo',
  'récord personal',
  'deshacer',
  'saltear',
  'avanzar de ejercicio',
  'abrir la app',
  'chequeo diario',
  'cierre de un día normal',
] as const
