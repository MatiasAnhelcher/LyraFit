/**
 * La voz: lo único que la app dice en palabras.
 *
 * ## Por qué esto no viola la regla de `respuesta.ts`
 *
 * Ahí está escrito que **el énfasis se gasta**, y una lista `NO_SUENAN` que
 * incluye literalmente "avanzar de ejercicio". Las dos cosas siguen siendo
 * ciertas y este módulo no las toca, porque habla de otra cosa.
 *
 * Los earcons son **marcas**: no significan nada por sí solas —un A5 no quiere
 * decir "terminó el descanso", lo quiere decir porque siempre suena ahí— así
 * que todo su valor es la rareza, y por eso se gastan. El habla no es una
 * marca: lleva contenido que ninguna marca puede llevar, que es CUÁL es el
 * ejercicio que viene. No hay forma de codificar "flexiones declinadas" en un
 * tono sin inventar un idioma que nadie va a aprender.
 *
 * Así que es un canal aparte, con su propio presupuesto y una regla más
 * estricta que la del sonido:
 *
 * > **Solo dice lo que no se puede codificar como marca, y nunca dice lo que la
 * > pantalla ya está diciendo bien.**
 *
 * En una sesión típica de cuatro ejercicios habla tres veces: una por cambio de
 * ejercicio. No dice series, ni repeticiones, ni aliento — eso está en la
 * pantalla y decirlo dos veces es ruido, no ayuda.
 *
 * ## El problema que resuelve
 *
 * "No hay nada que me avise qué ejercicio viene después y tener que estar
 * pendiente de eso me quita segundos de actividad y me hace perder ritmo."
 *
 * Y era literal: en toda la pantalla de entrenar no se nombraba nunca el
 * ejercicio siguiente. El cambio de ejercicio no tenía descanso, ni sonido, ni
 * vibración: cambiaba el título y había que leerlo. Lo que se muestra en
 * pantalla arregla la mitad; lo que se dice en voz alta arregla la otra, que es
 * la de no tener que mirar.
 *
 * ## Las tres trampas del navegador
 *
 * 1. **Las voces cargan tarde.** En Chrome la primera llamada a `getVoices()`
 *    devuelve una lista vacía y hay que esperar `voiceschanged`. Por eso la voz
 *    se resuelve cada vez y no se cachea en el módulo.
 * 2. **iOS pide un gesto**, igual que el `AudioContext`. Se resuelve por el
 *    camino que ya existía: `prepararVoz()` lo llama `despertarAudio()`, que
 *    corre al tocar "Empezar".
 * 3. **La cola se acumula.** Dos `speak()` seguidos no se pisan: se encolan, y
 *    la segunda frase sale cuando la primera terminó, que puede ser media serie
 *    después. Por eso siempre se cancela antes.
 */

let activa = true

export function configurarVoz(valor: boolean): void {
  activa = valor
}

/** Si el navegador tiene la API. Sin ella la fila de Ajustes no se muestra. */
export const HAY_VOZ =
  typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined'

/**
 * El orden de preferencia de voces.
 *
 * Rioplatense primero, después latinoamericano, después cualquier español. La
 * diferencia no es cosmética: una voz peninsular diciendo "flexiones" con la ce
 * castellana suena a otra app, y la app entera está escrita en la segunda
 * persona de acá.
 */
const PREFERIDAS = ['es-ar', 'es-419', 'es-uy', 'es-mx', 'es-us', 'es-cl', 'es-es', 'es']

/**
 * La voz elegida, o `null` si no hay ninguna en español.
 *
 * Sin voz en español **se queda muda**, y eso es una decisión: una voz en
 * inglés leyendo "flexiones declinadas" es peor que el silencio. El texto en
 * pantalla no depende de esto, así que quedarse mudo no pierde información.
 */
export function vozElegida(): SpeechSynthesisVoice | null {
  if (!HAY_VOZ) return null
  let voces: SpeechSynthesisVoice[] = []
  try {
    voces = window.speechSynthesis.getVoices()
  } catch {
    return null
  }
  if (voces.length === 0) return null

  for (const prefijo of PREFERIDAS) {
    const encontrada = voces.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith(prefijo))
    if (encontrada) return encontrada
  }
  return null
}

/**
 * Desbloquea el habla. Se llama DENTRO de un gesto, una sola vez.
 *
 * La `utterance` vacía a volumen cero es el equivalente del buffer mudo de un
 * sample que usa `despertarAudio()`: en iOS el motor de habla nace bloqueado y
 * solo un gesto lo abre, y un temporizador no es un gesto.
 */
export function prepararVoz(): void {
  if (!HAY_VOZ) return
  try {
    // Tocar `getVoices()` también dispara la carga asincrónica en Chrome.
    window.speechSynthesis.getVoices()
    const muda = new SpeechSynthesisUtterance('')
    muda.volume = 0
    window.speechSynthesis.speak(muda)
  } catch {
    /* Sin voz la app funciona igual. */
  }
}

/** Lo más largo que se dice de una vez. Más que esto ya no es un aviso. */
export const LARGO_MAXIMO = 80

export function decir(texto: string): void {
  if (!activa || !HAY_VOZ || texto.length === 0) return
  const voz = vozElegida()
  if (!voz) return

  try {
    // Sin esto, dos avisos seguidos se encolan y el segundo sale media serie
    // más tarde, cuando ya no sirve.
    window.speechSynthesis.cancel()
    const dicho = new SpeechSynthesisUtterance(texto.slice(0, LARGO_MAXIMO))
    dicho.voice = voz
    dicho.lang = voz.lang
    // Apenas por debajo de lo normal: con el pulso alto y ruido alrededor, la
    // velocidad por defecto se entiende a medias y no hay segunda oportunidad.
    dicho.rate = 0.95
    dicho.pitch = 1
    window.speechSynthesis.speak(dicho)
  } catch {
    /* Nada. */
  }
}

/** Corta lo que esté diciendo. Al salir de la sesión, para no hablarle a nadie. */
export function callar(): void {
  if (!HAY_VOZ) return
  try {
    window.speechSynthesis.cancel()
  } catch {
    /* Nada. */
  }
}
