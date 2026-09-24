/**
 * El mapa muscular: cuánto carga cada ejercicio a cada músculo.
 *
 * La escala tiene tres valores y ninguno es una medición del cuerpo de nadie:
 *   1     primario — el que limita la serie
 *   0,5   secundario — trabaja de verdad, pero no es el que falla
 *   0,25  estabilizador — sostiene, no mueve
 *
 * La unidad es LA SERIE, no la repetición. Una serie de plancha de 30 s y una
 * de 8 flexiones valen lo mismo: una serie. Es la misma razón por la que
 * `estadisticas.ts` borró el "volumen" que sumaba repeticiones con segundos.
 *
 * Qué NO hace esta tabla, a propósito:
 *  - No encoda el régimen. La dominada negativa no lleva números más altos por
 *    ser excéntrica: eso lo paga el `ccr` (ver el comentario de
 *    `curl-nordico-negativo` en `biblioteca.ts`) y subirlo acá sería contarlo
 *    dos veces. El régimen vive en `REGIMEN`.
 *  - No encoda "pectoral interno" ni ninguna región de un músculo. No existe un
 *    pectoral interno entrenable por separado; el `resumen` de la flexión
 *    diamante lo dice y el mapa no lo repite.
 *  - No encoda el lado, y es deliberado. Una serie de búlgaras es el doble de
 *    trabajo para la persona y UNA serie para cada pierna, que es lo que este
 *    mapa cuenta: un cuádriceps que hizo tres series de sentadilla y uno que
 *    hizo tres de pistol recibieron tres cada uno. Contar seis diría que el
 *    pistol estimula el doble, y no es cierto.
 *
 * Dónde hay medición y dónde hay criterio: `EVIDENCIA`, ejercicio por ejercicio.
 */

import { POR_ID } from './biblioteca'
import { enLaVentana } from './adherencia'
import type { Patron, Rutina, Sesion } from './tipos'

export type Musculo =
  // Empuje
  | 'pectoral' | 'deltoide-anterior' | 'triceps' | 'serrato'
  // Tracción
  | 'dorsal' | 'espalda-media' | 'deltoide-posterior' | 'biceps' | 'antebrazo'
  // Tronco
  | 'recto-abdominal' | 'oblicuos' | 'psoas' | 'erectores'
  // Piernas
  | 'cuadriceps' | 'isquiotibial' | 'gluteo-mayor' | 'gluteo-medio' | 'aductor'
  // Sin cobertura: están en el tipo para poder nombrar el hueco, no para sumar.
  | 'deltoide-lateral' | 'gemelo'

/**
 * Los tres valores de la escala, como tipo. Que el compilador rechace un 0,75
 * cuesta cero y evita la única clase de error que esta tabla puede tener sin
 * que nadie se dé cuenta.
 */
export type Aporte = 1 | 0.5 | 0.25

export type Vector = Partial<Record<Musculo, Aporte>>

/** Los 18 que al menos un ejercicio carga con 0,5 o más. En orden de pantalla. */
export const MUSCULOS_CUBIERTOS: Musculo[] = [
  'pectoral', 'deltoide-anterior', 'triceps', 'serrato',
  'dorsal', 'espalda-media', 'deltoide-posterior', 'biceps', 'antebrazo',
  'recto-abdominal', 'oblicuos', 'psoas', 'erectores',
  'cuadriceps', 'isquiotibial', 'gluteo-mayor', 'gluteo-medio', 'aductor',
]

/**
 * Los que NINGÚN ejercicio carga con 0,5 o más. Es un hueco de la app, no de la
 * persona, y en pantalla se dice distinto: no "lo entrenás poco" sino "la app
 * todavía no cubre este patrón", con el patrón nombrado.
 */
export const SIN_COBERTURA: { musculo: Musculo; patronQueFalta: string }[] = [
  { musculo: 'deltoide-lateral', patronQueFalta: 'empuje vertical' },
  { musculo: 'gemelo', patronQueFalta: 'flexión plantar y salto' },
]

/**
 * Músculos que entran por 0,5 pero que ningún ejercicio tiene como primario.
 * No es un error: en esta biblioteca ningún eslabón está limitado por un
 * estabilizador de plano frontal ni por el agarre. Por eso la pantalla de "lo
 * que falta" nunca debe proponer "entrená glúteo medio" como si hubiera un
 * eslabón para eso: no hay. Lo que hay es trabajo unilateral.
 */
export const SIN_PRIMARIO: Musculo[] = [
  'deltoide-posterior', 'antebrazo', 'erectores', 'gluteo-medio', 'aductor',
]

/** Cubiertos por UN solo ejercicio. Si ese eslabón no se hace, la cobertura es cero. */
export const COBERTURA_FRAGIL: { musculo: Musculo; unico: string }[] = [
  { musculo: 'erectores', unico: 'bisagra-una-pierna' },
]

export const NOMBRE_MUSCULO: Record<Musculo, string> = {
  pectoral: 'Pectoral',
  'deltoide-anterior': 'Hombro (adelante)',
  'deltoide-lateral': 'Hombro (costado)',
  'deltoide-posterior': 'Hombro (atrás)',
  triceps: 'Tríceps',
  serrato: 'Serrato',
  dorsal: 'Dorsal',
  'espalda-media': 'Media espalda',
  biceps: 'Bíceps',
  antebrazo: 'Antebrazo y agarre',
  'recto-abdominal': 'Abdomen',
  oblicuos: 'Oblicuos',
  psoas: 'Flexores de cadera',
  erectores: 'Espalda baja',
  cuadriceps: 'Cuádriceps',
  isquiotibial: 'Isquiotibiales',
  'gluteo-mayor': 'Glúteo mayor',
  'gluteo-medio': 'Glúteo medio',
  aductor: 'Aductores',
  gemelo: 'Gemelos',
}

export const APORTE: Record<string, Vector> = {
  // ─── Empuje ──────────────────────────────────────────────────────────
  // El reparto del empuje se mueve en dos ejes y nada más: cuánto se va del
  // codo al hombro (manos altas → pectoral; pies altos → deltoide anterior), y
  // cuándo aparece la demanda de tronco (recién cuando la cadera queda sin
  // apoyo y cerca de la horizontal).

  // Casi parado contra la pared: 0,2 del peso. La cadera no tiene momento que
  // resistir, así que NO lleva abdomen. Es lo único que la distingue de la
  // inclinada alta, y es real.
  'flexion-pared': { pectoral: 1, triceps: 0.5, 'deltoide-anterior': 0.25, serrato: 0.25 },

  // Pies caminados atrás: aparece la línea, entra el abdomen como estabilizador.
  'flexion-inclinada-alta': {
    pectoral: 1, triceps: 0.5, 'deltoide-anterior': 0.25, serrato: 0.25, 'recto-abdominal': 0.25,
  },

  // Tres eslabones con el MISMO reparto (0,40 / 0,46 / 0,53 de `ccr`). El
  // hombro pasa a secundario porque el húmero ya recorre un plano de press y no
  // de empuje horizontal contra una pared.
  'flexion-inclinada': {
    pectoral: 1, triceps: 0.5, 'deltoide-anterior': 0.5, serrato: 0.25, 'recto-abdominal': 0.25,
  },
  'flexion-inclinada-baja': {
    pectoral: 1, triceps: 0.5, 'deltoide-anterior': 0.5, serrato: 0.25, 'recto-abdominal': 0.25,
  },
  // La cadera está APOYADA en las rodillas: por eso no lleva glúteo y el
  // abdomen queda en 0,25. Es exactamente lo que se le saca al pasar a completa.
  'flexion-rodillas': {
    pectoral: 1, triceps: 0.5, 'deltoide-anterior': 0.5, serrato: 0.25, 'recto-abdominal': 0.25,
  },

  // Cadera sin apoyo y cuerpo horizontal: el abdomen duplica y entra el glúteo.
  'flexion-completa': {
    pectoral: 1, triceps: 0.5, 'deltoide-anterior': 0.5, serrato: 0.25,
    'recto-abdominal': 0.5, 'gluteo-mayor': 0.25,
  },

  // Manos juntas: el tríceps pasa a co-limitante. El pectoral NO baja — con
  // manos angostas sube, no cae (Cogley 2005) —, así que la diamante es la
  // completa con un primario más, no con el trabajo movido de lugar.
  'flexion-diamante': {
    pectoral: 1, triceps: 1, 'deltoide-anterior': 0.5, serrato: 0.25,
    'recto-abdominal': 0.5, 'gluteo-mayor': 0.25,
  },

  // Pies elevados: el hombro de adelante pasa a co-limitante y el serrato sube
  // (más elevación humeral = más rotación superior de escápula).
  'flexion-declinada': {
    pectoral: 1, 'deltoide-anterior': 1, triceps: 0.5, serrato: 0.5,
    'recto-abdominal': 0.5, 'gluteo-mayor': 0.25,
  },

  // El único ejercicio de la biblioteca donde la PROTRACCIÓN es el trabajo. El
  // momento se va del codo a la articulación del hombro y a la escápula: el
  // pectoral baja a secundario y el serrato llega a primario, que es lo único
  // nuevo que este eslabón trae. El 0,25 de antebrazo es la muñeca que la
  // técnica nombra dos veces.
  'flexion-pseudoplancha': {
    'deltoide-anterior': 1, serrato: 1, pectoral: 0.5, triceps: 0.5,
    'recto-abdominal': 0.5, 'gluteo-mayor': 0.25, antebrazo: 0.25,
  },

  // Manos muy abiertas: es aducción, no extensión de codo, así que el tríceps NO
  // sube (a diferencia de la diamante). Lo que aparece es antirrotación: el
  // error que la biblioteca nombra es "girar el torso para robarle trabajo".
  'flexion-arquera': {
    pectoral: 1, 'deltoide-anterior': 0.5, triceps: 0.5, serrato: 0.25,
    'recto-abdominal': 0.5, oblicuos: 0.5, 'gluteo-mayor': 0.25,
  },

  // Tres primarios, y los tres los dicta el `resumen` del ejercicio.
  'flexion-una-mano': {
    pectoral: 1, triceps: 1, oblicuos: 1, 'deltoide-anterior': 0.5, serrato: 0.5,
    'recto-abdominal': 0.5, 'gluteo-mayor': 0.25, antebrazo: 0.25,
  },

  // ─── Tracción ────────────────────────────────────────────────────────
  // El eje de esta cadena: cuanto más horizontal el cuerpo, más perpendicular al
  // torso es la resistencia y más manda la RETRACCIÓN. Al pasar a la barra la
  // resistencia se alinea con el eje del cuerpo: manda el dorsal, la media
  // espalda baja a secundario y aparece el agarre.

  // Casi parado: la componente horizontal es chica, así que la retracción no
  // llega a primario.
  'remo-australiano-alto': {
    dorsal: 1, 'espalda-media': 0.5, biceps: 0.5, 'deltoide-posterior': 0.25, antebrazo: 0.25,
  },
  'remo-australiano-medio': {
    dorsal: 1, 'espalda-media': 1, biceps: 0.5, 'deltoide-posterior': 0.5,
    antebrazo: 0.25, 'recto-abdominal': 0.25,
  },
  'remo-australiano-bajo': {
    dorsal: 1, 'espalda-media': 1, biceps: 0.5, 'deltoide-posterior': 0.5,
    antebrazo: 0.25, 'recto-abdominal': 0.25, 'gluteo-mayor': 0.25,
  },
  // Pies en la silla: el cuerpo queda colgado de la cadera. El error que la
  // biblioteca nombra —"terminar la serie hecho una hamaca"— es antiextensión,
  // y es lo que sube el abdomen a 0,5 y trae los erectores.
  'remo-australiano-pies-elevados': {
    dorsal: 1, 'espalda-media': 1, biceps: 0.5, 'deltoide-posterior': 0.5,
    'recto-abdominal': 0.5, antebrazo: 0.25, 'gluteo-mayor': 0.25, erectores: 0.25,
  },

  // Cuatro eslabones con el MISMO reparto, y está bien: la banda saca CARGA, no
  // saca músculos, y la negativa cambia el RÉGIMEN, no el reparto (ver
  // `REGIMEN`). Lo que los separa es `ccr`: 0,72 → 0,78 → 0,86 → 0,95.
  // Nota que el mapa no puede encodar: la banda ayuda más abajo, donde el
  // dorsal está más largo, así que las asistidas subcargan justo ese rango.
  'dominada-negativa': {
    dorsal: 1, 'espalda-media': 0.5, biceps: 0.5, antebrazo: 0.5,
    'deltoide-posterior': 0.25, 'recto-abdominal': 0.25,
  },
  'dominada-asistida': {
    dorsal: 1, 'espalda-media': 0.5, biceps: 0.5, antebrazo: 0.5,
    'deltoide-posterior': 0.25, 'recto-abdominal': 0.25,
  },
  'dominada-asistida-leve': {
    dorsal: 1, 'espalda-media': 0.5, biceps: 0.5, antebrazo: 0.5,
    'deltoide-posterior': 0.25, 'recto-abdominal': 0.25,
  },
  'dominada-completa': {
    dorsal: 1, 'espalda-media': 0.5, biceps: 0.5, antebrazo: 0.5,
    'deltoide-posterior': 0.25, 'recto-abdominal': 0.25,
  },
  // Carga lateral: aparece la antirrotación que no estaba en ninguna dominada.
  'dominada-arquera': {
    dorsal: 1, 'espalda-media': 0.5, biceps: 0.5, antebrazo: 0.5, oblicuos: 0.5,
    'deltoide-posterior': 0.25, 'recto-abdominal': 0.25,
  },
  // El único de la cadena donde el flexor de codo pasa a co-limitante. No es EMG:
  // es que a carga de un brazo el codo es lo que se queja, y la biblioteca lo
  // dice ("si molesta, bajá un nivel y sumá trabajo de antebrazo").
  'dominada-un-brazo-asistida': {
    dorsal: 1, biceps: 1, 'espalda-media': 0.5, antebrazo: 0.5, oblicuos: 0.5,
    'deltoide-posterior': 0.25, 'recto-abdominal': 0.25,
  },

  // ─── Piernas ─────────────────────────────────────────────────────────
  // Lo más importante de estos nueve vectores es lo que NO tienen: el
  // isquiotibial nunca es primario, y en los bilaterales no aparece. Esa
  // ausencia es la auditoría que creó la cadena de bisagra, y la descripción de
  // esa cadena la dice con todas las letras.
  // El aductor a 0,5 es aductor mayor como extensor de cadera: es el que tiene
  // el mayor brazo de momento de extensión en flexión profunda. Entra recién
  // cuando se llega al fondo.
  // El psoas a 0,25 / 0,5 es la pierna libre sostenida en el aire, que es lo
  // único que separa al pistol de la búlgara en el reparto.

  'sentadilla-banco': { cuadriceps: 1, 'gluteo-mayor': 0.5, aductor: 0.25, erectores: 0.25 },
  // Mismo reparto que la completa: los brazos solo acomodan el equilibrio, no
  // traccionan, así que no acreditan nada de tracción. Lo que cambia es `ccr`.
  'sentadilla-asistida': { cuadriceps: 1, 'gluteo-mayor': 0.5, aductor: 0.5, erectores: 0.25 },
  'sentadilla-completa': { cuadriceps: 1, 'gluteo-mayor': 0.5, aductor: 0.5, erectores: 0.25 },
  // Base partida, los dos pies en el piso: el plano frontal apenas asoma.
  zancada: {
    cuadriceps: 1, 'gluteo-mayor': 0.5, 'gluteo-medio': 0.25, aductor: 0.25,
    isquiotibial: 0.25, erectores: 0.25,
  },
  // Búlgara COMO LA DEFINE LA BIBLIOTECA: "bajá vertical", peso en el talón de
  // adelante, y el error explícito es "inclinar el torso adelante y convertirlo
  // en un ejercicio de cadera". O sea: dominante de rodilla. Por eso el glúteo
  // mayor queda en 0,5 y no en 1. El gemelo no entra: el tobillo sostiene.
  'sentadilla-bulgara': {
    cuadriceps: 1, 'gluteo-mayor': 0.5, 'gluteo-medio': 0.5, aductor: 0.5,
    isquiotibial: 0.25, erectores: 0.25,
  },
  // Desde acá la pierna libre va estirada adelante y hay que SOSTENERLA: entra
  // el psoas. Es lo que hace que estos se sientan distintos de la búlgara, donde
  // el pie de atrás está apoyado.
  'sentadilla-a-banco-una-pierna': {
    cuadriceps: 1, 'gluteo-mayor': 0.5, 'gluteo-medio': 0.5, aductor: 0.5,
    psoas: 0.25, isquiotibial: 0.25, erectores: 0.25,
  },
  'sentadilla-una-pierna-asistida': {
    cuadriceps: 1, 'gluteo-mayor': 0.5, 'gluteo-medio': 0.5, aductor: 0.5,
    psoas: 0.25, isquiotibial: 0.25, erectores: 0.25,
  },
  // Pistol: la pierna libre va horizontal en TODO el recorrido, no solo al
  // final. El psoas pasa a secundario, y es una de las razones reales por las
  // que la gente no llega al fondo.
  'pistol-squat': {
    cuadriceps: 1, 'gluteo-mayor': 0.5, 'gluteo-medio': 0.5, aductor: 0.5,
    psoas: 0.5, isquiotibial: 0.25, erectores: 0.25,
  },
  // Mismo reparto que el pistol: la pausa cambia el tiempo bajo tensión, no
  // quién trabaja. Está declarado en `MISMO_REPARTO`.
  'pistol-con-pausa': {
    cuadriceps: 1, 'gluteo-mayor': 0.5, 'gluteo-medio': 0.5, aductor: 0.5,
    psoas: 0.5, isquiotibial: 0.25, erectores: 0.25,
  },

  // ─── Core ────────────────────────────────────────────────────────────
  // Las planchas son antiextensión con la cadera EXTENDIDA. Las elevaciones son
  // flexión de cadera: el recto abdominal hace el enrollado de pelvis y el psoas
  // mueve la pierna. Cuanto más larga la palanca, más psoas — y eso hay que
  // decirlo, no esconderlo.

  'plancha-rodillas': { 'recto-abdominal': 1, serrato: 0.25, oblicuos: 0.25 },
  // Apoyo en las puntas de los pies: palanca más larga, más demanda escapular.
  plancha: { 'recto-abdominal': 1, serrato: 0.5, oblicuos: 0.25, 'gluteo-mayor': 0.25 },
  // El único core que toca la musculatura de empuje (brazos estirados, manos en
  // el piso), y el único donde la ANTIRROTACIÓN es la tarea agregada, no un
  // efecto lateral. Por eso el oblicuo llega a primario acá y no en la plancha.
  'plancha-brazo-alternado': {
    'recto-abdominal': 1, oblicuos: 1, serrato: 0.5, 'deltoide-anterior': 0.25,
    'gluteo-mayor': 0.25, 'gluteo-medio': 0.25,
  },
  // Rodillas dobladas: palanca corta, el psoas queda en secundario.
  'elevacion-rodillas-suelo': { 'recto-abdominal': 1, psoas: 0.5, oblicuos: 0.25 },
  // Piernas estiradas: el psoas pasa a CO-PRIMARIO. Es el dato más incómodo del
  // mapa y el que más valor tiene. El 0,25 de cuádriceps es el recto femoral
  // sosteniendo la rodilla estirada, que la técnica pide explícitamente.
  'elevacion-piernas-suelo': {
    'recto-abdominal': 1, psoas: 1, oblicuos: 0.25, cuadriceps: 0.25,
  },
  // Colgado: el agarre entra a 0,5 porque el propio `resumen` lo dice.
  'elevacion-rodillas-colgado': {
    'recto-abdominal': 1, psoas: 0.5, antebrazo: 0.5, oblicuos: 0.25,
    dorsal: 0.25, 'espalda-media': 0.25,
  },
  'elevacion-piernas-colgado': {
    'recto-abdominal': 1, psoas: 1, antebrazo: 0.5, cuadriceps: 0.25,
    oblicuos: 0.25, dorsal: 0.25, 'espalda-media': 0.25,
  },
  // La palanca frontal es lo único de la biblioteca que es tracción de brazo
  // RECTO: el dorsal y el hombro de atrás mueven sin que el codo se doble, el
  // tríceps trabaja para que el codo NO se doble (el error que la biblioteca
  // nombra primero), y la antiextensión es máxima. Por eso su vector es el más
  // largo de los 47: no es un ejercicio de abdomen, es un ejercicio de cuerpo
  // entero que se anotó en la cadena de core.
  // Negativa: las piernas se ESTIRAN, así que la cadera la sostienen glúteo e
  // isquiotibial.
  'palanca-frontal-negativa': {
    dorsal: 1, 'recto-abdominal': 1, 'espalda-media': 0.5, 'deltoide-posterior': 0.5,
    triceps: 0.5, antebrazo: 0.5, 'gluteo-mayor': 0.5, isquiotibial: 0.25, oblicuos: 0.25,
  },
  // Agrupada: la cadera está FLEXIONADA y la sostiene el psoas. Es el mismo
  // cuerpo en el mismo lugar y el reparto de la cadera se invierte.
  'palanca-frontal-agrupada': {
    dorsal: 1, 'recto-abdominal': 1, 'espalda-media': 0.5, 'deltoide-posterior': 0.5,
    triceps: 0.5, antebrazo: 0.5, psoas: 0.25, 'gluteo-mayor': 0.25, oblicuos: 0.25,
  },

  // ─── Bisagra ─────────────────────────────────────────────────────────
  // La cadena se parte en dos mitades y el mapa tiene que mostrarlo: los puentes
  // son GLÚTEO (extensión de cadera con la rodilla doblada, que acorta el
  // isquiotibial), y la bisagra y los curls son ISQUIOTIBIAL (cargado estirado o
  // flexionando la rodilla). El punto de cruce es `bisagra-una-pierna`.

  // Rodilla doblada y talón cerca de la cola: el isquiotibial está acortado y
  // apenas ayuda. Que se acalambre no significa que sea el motor.
  'puente-gluteos': {
    'gluteo-mayor': 1, isquiotibial: 0.25, erectores: 0.25, 'recto-abdominal': 0.25,
  },
  // "Los isquiotibiales empiezan a trabajar en serio" = cruzan de 0,25 a 0,5.
  // Empiezan; no pasan a mandar.
  'puente-gluteos-pies-elevados': {
    'gluteo-mayor': 1, isquiotibial: 0.5, erectores: 0.25, 'recto-abdominal': 0.25,
  },
  // Un solo pie: la pelvis pareja es la condición de permanencia en el eslabón
  // ("si no la podés sostener pareja, volvé al anterior"), y eso es glúteo medio.
  'puente-una-pierna': {
    'gluteo-mayor': 1, 'gluteo-medio': 0.5, isquiotibial: 0.5, oblicuos: 0.25,
    erectores: 0.25, 'recto-abdominal': 0.25,
  },
  // El cruce de la cadena: rodilla casi estirada, isquiotibial cargado en
  // largo. Es el ÚNICO ejercicio de los 47 con erectores en 0,5 — torso
  // horizontal sin apoyo, y el error nombrado es "redondear la espalda".
  'bisagra-una-pierna': {
    isquiotibial: 1, 'gluteo-mayor': 0.5, 'gluteo-medio': 0.5, erectores: 0.5, oblicuos: 0.25,
  },
  // Talón arriba y rodilla poco doblada: la extensión de cadera se reparte en
  // serio entre los dos. Dos primarios.
  'puente-una-pierna-elevado': {
    isquiotibial: 1, 'gluteo-mayor': 1, 'gluteo-medio': 0.5, erectores: 0.25,
    'recto-abdominal': 0.25, oblicuos: 0.25,
  },
  // Primera vez que el isquiotibial FLEXIONA LA RODILLA con carga, y a la vez
  // hay que mantener el puente toda la serie: "la cadera arriba es el
  // ejercicio". Dos primarios, y la serie termina cuando falla cualquiera.
  'curl-talones-deslizando': {
    isquiotibial: 1, 'gluteo-mayor': 1, erectores: 0.25, 'recto-abdominal': 0.25,
  },
  // Nórdico: el cuerpo es una barra rígida de rodillas a cabeza. El glúteo
  // sostiene la cadera extendida y el abdomen impide que la lumbar se arquee
  // (los dos errores que la biblioteca nombra primero). Y CERO pectoral y cero
  // tríceps aunque se frene con las manos: "la subida no cuenta, no la pelees".
  'curl-nordico-negativo': {
    isquiotibial: 1, 'gluteo-mayor': 0.5, 'recto-abdominal': 0.5, erectores: 0.25,
  },
  // Mismo reparto que el negativo. Lo que cambia es el régimen —excéntrico puro
  // a completo— y eso vive en `REGIMEN` y en el `ccr` (1,05 → 1,30), no acá.
  // Subir los números del vector sería cobrar dos veces el mismo cambio.
  'curl-nordico': {
    isquiotibial: 1, 'gluteo-mayor': 0.5, 'recto-abdominal': 0.5, erectores: 0.25,
  },
}

/**
 * El régimen de contracción, que NO va en el vector.
 *
 * Existe por la misma razón que el `ccr` de `curl-nordico-negativo` es 1,05 y no
 * 0,95: cuando se pasa de concéntrico a excéntrico no cambia quién trabaja,
 * cambia cómo. Si eso se metiera en el aporte, tres eslabones mostrarían más
 * músculo del que mueven.
 *
 * Sirve para dos cosas concretas: que la pantalla pueda decir "estas series
 * fueron excéntricas" (que es por qué duelen tres días), y que el eje de dosis
 * de la balanza no cuente una serie excéntrica como una concéntrica.
 */
export type Regimen = 'concentrico' | 'isometrico' | 'excentrico'

export const REGIMEN: Record<string, Regimen> = {
  // Isométricos: los cuatro sostenes.
  'plancha-rodillas': 'isometrico',
  plancha: 'isometrico',
  'plancha-brazo-alternado': 'isometrico',
  'palanca-frontal-agrupada': 'isometrico',
  // Excéntricos puros: los tres que solo tienen bajada.
  'dominada-negativa': 'excentrico',
  'palanca-frontal-negativa': 'excentrico',
  'curl-nordico-negativo': 'excentrico',
  // Todo el resto: 'concentrico'. Se completa en el módulo con un default, no
  // repitiendo 40 líneas.
}

/**
 * Los grupos de eslabones que comparten vector, declarados a propósito.
 *
 * No es una deuda: es la regla de que el vector dice QUIÉN y el `ccr` dice
 * CUÁNTO. Está escrito acá y testeado para que el día que alguien le agregue un
 * músculo a uno de estos eslabones el test le pregunte por sus hermanos.
 */
export const MISMO_REPARTO: string[][] = [
  // Cambia el porcentaje de peso (0,40 / 0,46 / 0,53), no el reparto.
  ['flexion-inclinada', 'flexion-inclinada-baja', 'flexion-rodillas'],
  // La banda saca carga, no músculos; la negativa cambia régimen, no reparto.
  ['dominada-negativa', 'dominada-asistida', 'dominada-asistida-leve', 'dominada-completa'],
  // El agarre solo acomoda el equilibrio: no acredita tracción.
  ['sentadilla-asistida', 'sentadilla-completa'],
  ['sentadilla-a-banco-una-pierna', 'sentadilla-una-pierna-asistida'],
  // La pausa cambia el tiempo bajo tensión, no quién trabaja.
  ['pistol-squat', 'pistol-con-pausa'],
  // Concéntrico → excéntrico: está en `REGIMEN` y en el `ccr`.
  ['curl-nordico-negativo', 'curl-nordico'],
]
// ─────────────────────────────────────────────────────────────────────────
// Las series efectivas: qué recibió cada músculo, de verdad.
// ─────────────────────────────────────────────────────────────────────────


/**
 * El piso para que una serie cuente como dosis.
 *
 * **El 0,25 no cuenta.** Es la decisión más importante de este archivo y la que
 * separa un mapa que informa de uno que decora: hay `gluteo-mayor: 0.25` en seis
 * flexiones y `cuadriceps: 0.25` en dos elevaciones de piernas, y si eso sumara,
 * la app le diría a alguien que entrenó glúteos haciendo flexiones. Un
 * estabilizador sostiene; no es volumen de nada.
 *
 * Los 0,25 siguen en la tabla porque describen el ejercicio —y porque el eje de
 * orden de la balanza los va a necesitar, para no poner pegados dos ejercicios
 * que comparten estabilizador— pero no llegan nunca a esta cuenta.
 */
export const PISO_DE_DOSIS = 0.5

/**
 * Cuántas series recibió cada músculo en la ventana.
 *
 * ## Qué cuenta y qué no
 *
 * - **La serie de cierre cuenta.** La regla ya estaba escrita y testeada en
 *   `estadisticas.ts`: el volumen la cuenta, la capacidad no. Esto es volumen.
 * - **La bajada cuenta.** El motor la saltea porque es otro eslabón; los
 *   músculos no saben de eslabones.
 * - **Las ráfagas NO cuentan**, y es lo único discutible. Están dosificadas por
 *   tiempo y no por series cerca del fallo, y solo declaran `carga: Patron[]`,
 *   no músculos. Contar los burpees como empuje dejaría el pectoral pareciendo
 *   servido cuando el trabajo de fuerza no está — que es exactamente lo que
 *   este mapa existe para detectar.
 *
 * ## Una serie unilateral es una serie
 *
 * Una serie de búlgaras es el doble de trabajo para la persona y una sola serie
 * para cada pierna, que es lo que este mapa cuenta. Un cuádriceps que hizo tres
 * series de sentadilla y uno que hizo tres de pistol recibieron tres series cada
 * uno: contar seis diría que el pistol estimula el doble, y no es cierto. El
 * mapa es por músculo y los músculos vienen de a pares.
 *
 * ## La unidad es la serie
 *
 * Una plancha de 30 s y ocho flexiones valen lo mismo: una serie. Es la misma
 * razón por la que `estadisticas.ts` borró el "volumen" que sumaba repeticiones
 * con segundos — no era comparable, y era el eje del único gráfico.
 */
export function seriesPorMusculo(sesiones: Sesion[], hoy: string): Map<Musculo, number> {
  const cuenta = new Map<Musculo, number>()

  for (const sesion of enLaVentana(sesiones, hoy)) {
    for (const registro of sesion.registros) {
      const vector = APORTE[registro.ejercicioId]
      if (!vector) continue
      for (const [musculo, aporte] of Object.entries(vector) as [Musculo, Aporte][]) {
        if (aporte < PISO_DE_DOSIS) continue
        cuenta.set(musculo, (cuenta.get(musculo) ?? 0) + registro.series.length * aporte)
      }
    }
  }

  return cuenta
}

/** Los músculos que un ejercicio carga como dosis, o sea de 0,5 para arriba. */
export function musculosDe(ejercicioId: string): Musculo[] {
  const vector = APORTE[ejercicioId]
  if (!vector) return []
  return (Object.entries(vector) as [Musculo, Aporte][])
    .filter(([, aporte]) => aporte >= PISO_DE_DOSIS)
    .map(([musculo]) => musculo)
}

/**
 * Qué músculos puede entrenar esta persona, con lo que tiene.
 *
 * Sin barra, el agarre se queda sin un solo ejercicio que lo cargue: los diez
 * que lo entrenan cuelgan de una. Un mapa que no mire esto le va a recomendar
 * para siempre algo que no puede hacer, que es la peor clase de consejo.
 */
export function musculosAlcanzables(tieneBarra: boolean): Set<Musculo> {
  const alcanzables = new Set<Musculo>()
  for (const [id, vector] of Object.entries(APORTE)) {
    const ejercicio = POR_ID.get(id)
    if (!ejercicio) continue
    if (!tieneBarra && NECESITAN_BARRA.has(id)) continue
    for (const [musculo, aporte] of Object.entries(vector) as [Musculo, Aporte][]) {
      if (aporte >= PISO_DE_DOSIS) alcanzables.add(musculo)
    }
  }
  return alcanzables
}

/**
 * Los diez ejercicios que cuelgan de una barra.
 *
 * Vive acá y no en la biblioteca porque es lo único que lo necesita hoy, y
 * agregarle un campo a los cuarenta y siete por un consumidor sería mover el
 * dato antes de saber si hace falta. El test comprueba que la lista coincida
 * con lo que el alta filtra.
 */
export const NECESITAN_BARRA = new Set([
  'dominada-negativa',
  'dominada-asistida',
  'dominada-asistida-leve',
  'dominada-completa',
  'dominada-arquera',
  'dominada-un-brazo-asistida',
  'elevacion-rodillas-colgado',
  'elevacion-piernas-colgado',
  'palanca-frontal-negativa',
  'palanca-frontal-agrupada',
])

// ─────────────────────────────────────────────────────────────────────────
// El diagnóstico: qué te está faltando, y si la app puede hacer algo.
// ─────────────────────────────────────────────────────────────────────────

/** Con menos de esto no se afirma nada. Tres sesiones no son un mes. */
export const MINIMO_PARA_OPINAR = 3

export type LoQueFalta =
  /** Todavía no hay con qué. No es un diagnóstico neutro: es no tener datos. */
  | { clase: 'sin-datos'; sesiones: number }
  /**
   * Un patrón entero que la rutina no incluye, así que no va a aparecer solo.
   * Es el único caso con arreglo de un toque.
   */
  | { clase: 'patron-ausente'; patron: Patron; musculos: Musculo[]; rutinaQueLoCubre: string }
  /** El músculo con menos dosis entre los que se pueden entrenar hoy. */
  | { clase: 'flojo'; musculo: Musculo; patron: Patron; series: number }
  /** No hay nada que decir, y se dice. */
  | { clase: 'parejo' }

/** Qué patrones cubre una rutina, contando los bloques que alternan. */
export function patronesDe(rutina: Rutina): Set<Patron> {
  return new Set(rutina.bloques.flatMap((b) => (b.alterna ? [b.patron, b.alterna] : [b.patron])))
}

/**
 * Qué te está faltando.
 *
 * Cuatro salidas y un orden de prioridad, porque decir dos cosas a la vez es no
 * decir ninguna.
 *
 * El primer caso es el que justifica la pantalla entera: **"La mínima" entrena
 * tracción y empuje, y nada más.** Quien la eligió no hace piernas, ni core, ni
 * isquiotibiales, y hasta hoy la app no se lo decía en ningún lado. Es también
 * el único hueco que la app puede cerrar sola, porque cambiar eso es escribir
 * una preferencia.
 *
 * El último es tan importante como los otros: cuando no hay nada que señalar,
 * la pantalla lo dice y se calla. Un diagnóstico que siempre encuentra algo
 * deja de ser un diagnóstico.
 */
export function loQueFalta(entrada: {
  sesiones: Sesion[]
  hoy: string
  rutina: Rutina
  tieneBarra: boolean
}): LoQueFalta {
  const { sesiones, hoy, rutina, tieneBarra } = entrada
  const dentro = enLaVentana(sesiones, hoy)

  // Con dos sesiones, "te falta piernas" es ruido. La doctrina del documento de
  // estrategia lo dice para el peso y vale igual acá: hay que poder decir
  // "todavía no sé".
  if (dentro.length < MINIMO_PARA_OPINAR) {
    return { clase: 'sin-datos', sesiones: dentro.length }
  }

  const cuenta = seriesPorMusculo(sesiones, hoy)
  const cubre = patronesDe(rutina)

  // 1. Un patrón entero que la rutina no pide y que no aparece en el historial.
  //    Se recorre en orden fijo y no por gravedad inventada: el primero que
  //    falta es el que se nombra.
  for (const patron of ORDEN_DE_PATRONES) {
    if (cubre.has(patron)) continue
    const suyos = musculosDelPatron(patron)
    const hizo = suyos.some((m) => (cuenta.get(m) ?? 0) > 0)
    if (hizo) continue
    return {
      clase: 'patron-ausente',
      patron,
      musculos: suyos.filter((m) => (cuenta.get(m) ?? 0) === 0 && !NO_SE_PROPONE.includes(m)),
      rutinaQueLoCubre: RUTINA_COMPLETA,
    }
  }

  // 2. El más flojo, entre los que se pueden entrenar y tienen un eslabón que
  //    los limite. Proponer "entrená glúteo medio" no sirve: no hay ejercicio
  //    para eso, hay trabajo unilateral. Esos quedan en el mapa, no en el
  //    consejo.
  const alcanzables = musculosAlcanzables(tieneBarra)
  const candidatos = MUSCULOS_CUBIERTOS.filter(
    (m) => alcanzables.has(m) && !SIN_PRIMARIO.includes(m) && !NO_SE_PROPONE.includes(m),
  )
  if (candidatos.length === 0) return { clase: 'parejo' }

  let peor = candidatos[0]!
  for (const m of candidatos) {
    if ((cuenta.get(m) ?? 0) < (cuenta.get(peor) ?? 0)) peor = m
  }

  const series = cuenta.get(peor) ?? 0
  const mediana = medianaDe(candidatos.map((m) => cuenta.get(m) ?? 0))

  // Solo se señala si de verdad está atrás. Si el más flojo está cerca de la
  // mediana, la semana está pareja y no hay nada que decir.
  if (series >= mediana * PROPORCION_QUE_PREOCUPA) return { clase: 'parejo' }

  return { clase: 'flojo', musculo: peor, patron: PRIMARIO_DE.get(peor) ?? 'core', series }
}

/**
 * Cuán atrás tiene que estar el más flojo para que valga nombrarlo.
 *
 * La mitad de la mediana. Por debajo de eso hay un desbalance real; por encima,
 * la variación normal de una semana en la que se salteó un día.
 */
export const PROPORCION_QUE_PREOCUPA = 0.5

/**
 * Músculos que el mapa muestra pero que nunca propone como lo que falta.
 *
 * Solo el psoas, y por una razón puntual: "entrená más los flexores de la
 * cadera" no es un consejo que dé ningún entrenador. El psoas está en el mapa
 * porque es la mitad de la elevación de piernas y la gente cree que eso es
 * abdomen —la biblioteca ya lo nombra como el modo de falla—, así que se
 * muestra **al lado del abdomen**: si sube el psoas y no sube el abdomen, eso
 * es el aviso. Como objetivo no sirve.
 *
 * Es una lista de uno y ojalá se quede así. Todo lo demás que el mapa cubre es
 * alcanzable en los primeros cinco eslabones de su cadena —medido— así que
 * nombrarlo es siempre un consejo que se puede seguir.
 */
export const NO_SE_PROPONE: Musculo[] = ['psoas']

function medianaDe(valores: number[]): number {
  const orden = [...valores].sort((a, b) => a - b)
  const medio = Math.floor(orden.length / 2)
  if (orden.length === 0) return 0
  return orden.length % 2 === 0 ? ((orden[medio - 1]! + orden[medio]!) / 2) : orden[medio]!
}

/** El orden en que se revisan los patrones. Es el de la sesión, no el alfabético. */
const ORDEN_DE_PATRONES: Patron[] = ['traccion', 'empuje', 'piernas', 'bisagra', 'core']

/** La rutina que cubre los cinco patrones, para el arreglo de un toque. */
export const RUTINA_COMPLETA = 'cuerpo-completo'

/** De qué patrón es primario cada músculo. Se calcula una vez, de la matriz. */
const PRIMARIO_DE = new Map<Musculo, Patron>()
const POR_PATRON = new Map<Patron, Set<Musculo>>()
for (const [id, vector] of Object.entries(APORTE)) {
  const ejercicio = POR_ID.get(id)
  if (!ejercicio) continue
  const suyos = POR_PATRON.get(ejercicio.patron) ?? new Set<Musculo>()
  for (const [musculo, aporte] of Object.entries(vector) as [Musculo, Aporte][]) {
    if (aporte < PISO_DE_DOSIS) continue
    suyos.add(musculo)
    if (aporte === 1 && !PRIMARIO_DE.has(musculo)) PRIMARIO_DE.set(musculo, ejercicio.patron)
  }
  POR_PATRON.set(ejercicio.patron, suyos)
}

/** Los músculos que un patrón entrena como dosis. */
export function musculosDelPatron(patron: Patron): Musculo[] {
  return MUSCULOS_CUBIERTOS.filter((m) => POR_PATRON.get(patron)?.has(m))
}

/**
 * A qué patrón pertenece un músculo, para el glifo de la fila.
 *
 * No es el patrón que lo tiene como primario —cinco músculos no son primarios
 * de nada y quedaban sin glifo, con el canal vacío— sino el que más dosis le
 * da en toda la biblioteca. El glúteo medio no limita ninguna serie y aun así
 * es de piernas.
 */
export function patronDe(musculo: Musculo): Patron | undefined {
  return CASA_DE.get(musculo)
}

const CASA_DE = new Map<Musculo, Patron>()
{
  const suma = new Map<Musculo, Map<Patron, number>>()
  for (const [id, vector] of Object.entries(APORTE)) {
    const ejercicio = POR_ID.get(id)
    if (!ejercicio) continue
    for (const [musculo, aporte] of Object.entries(vector) as [Musculo, Aporte][]) {
      if (aporte < PISO_DE_DOSIS) continue
      const porPatron = suma.get(musculo) ?? new Map<Patron, number>()
      porPatron.set(ejercicio.patron, (porPatron.get(ejercicio.patron) ?? 0) + aporte)
      suma.set(musculo, porPatron)
    }
  }
  for (const [musculo, porPatron] of suma) {
    let mejor: Patron | undefined
    for (const [patron, total] of porPatron) {
      if (!mejor || total > (porPatron.get(mejor) ?? 0)) mejor = patron
    }
    if (mejor) CASA_DE.set(musculo, mejor)
  }
}
