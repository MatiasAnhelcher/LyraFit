/**
 * Rutinas: qué patrones se trabajan cada día, y qué clase de día es cada día.
 *
 * La rutina define el molde; el motor de progresión define la carga. Por eso
 * una rutina no menciona ningún ejercicio puntual: dice "hoy toca empuje" y el
 * ejercicio exacto sale del avance que tengas en esa cadena.
 *
 * ## Los dos ejes de un día
 *
 * Un día tiene dos interruptores independientes —fuerza sí/no y fuelle sí/no—
 * y por lo tanto cuatro estados. Antes eran tres clases mutuamente excluyentes
 * y "hacer las dos cosas" no era un día: era `Preferencias.densidad`, una
 * preferencia global que volvía densos TODOS los días de fuerza a la vez. Así
 * que no se podía, por ejemplo, entrenar fuerte el lunes y meterle fuelle solo
 * al miércoles.
 *
 * `'ambos'` no inventa nada: es exactamente la sesión densa que ya existía
 * —ráfagas adentro de los descansos y bloque metabólico al final—, con nombre
 * de día. `densidad` deja de decidir QUÉ días y pasa a decidir solamente cuán
 * fuerte.
 *
 * ## Por qué un valor por día y no tres listas
 *
 * La alternativa era sumar `diasDensos` al lado de `dias` y `diasDeFuelle`.
 * `claseDeDia` existe justo para que nadie cruce dos listas a mano —lo dice su
 * comentario— y pasar a tres habría triplicado las formas de contradecirse: un
 * día denso que no está en `dias`, un día que está en las dos listas. Un valor
 * por día es imposible de contradecir, y el cruce desaparece en vez de crecer.
 */

import type { BloqueRutina, Patron, Preferencias, Rutina, Semana } from './tipos'

export type { Semana } from './tipos'

export const RUTINAS: Rutina[] = [
  {
    id: 'cuerpo-completo',
    nombre: 'Cuerpo completo',
    descripcion:
      'Tres días por semana, los cuatro patrones en cada sesión. Es la mejor opción para arrancar y la que más cuesta abandonar: si perdés un día, el resto de la semana lo compensa.',
    dias: [1, 3, 5],
    bloques: [
      { patron: 'traccion', nota: 'Primero lo que más cuesta, con el cuerpo entero.' },
      { patron: 'empuje' },
      {
        patron: 'piernas',
        alterna: 'bisagra',
        nota: 'Un día sentadilla, el siguiente bisagra de cadera: adelante y atrás del muslo.',
      },
      { patron: 'core', nota: 'Al final: si lo hacés antes, te sabotea el resto.' },
    ],
  },
  {
    id: 'empuje-traccion',
    nombre: 'Empuje y tracción',
    descripcion:
      'Cuatro días alternando la mitad de arriba del cuerpo. Más volumen por patrón y más descanso entre sesiones parecidas.',
    dias: [1, 2, 4, 5],
    bloques: [
      { patron: 'empuje' },
      { patron: 'traccion' },
      { patron: 'core' },
    ],
  },
  {
    id: 'densa-cinco',
    nombre: 'Densa, cinco días',
    descripcion:
      'Tres días de fuerza con el fuelle metido en los descansos y dos días de acondicionamiento en el medio. Es la forma de entrenar cinco días sin quedarse sin recuperación: los días de fuelle no le piden fuerza a ninguna cadena, así que el motor no los lee.',
    dias: [1, 2, 3, 4, 5],
    diasDeFuelle: [2, 4],
    diasDensos: [1, 3, 5],
    bloques: [
      { patron: 'traccion', nota: 'Primero lo que más cuesta, con el cuerpo entero.' },
      { patron: 'empuje' },
      {
        patron: 'piernas',
        alterna: 'bisagra',
        nota: 'Un día sentadilla, el siguiente bisagra de cadera: adelante y atrás del muslo.',
      },
      { patron: 'core', nota: 'Al final: si lo hacés antes, te sabotea el resto.' },
    ],
  },
  {
    id: 'minima',
    nombre: 'La mínima',
    descripcion:
      'Dos días, dos patrones. Para las semanas complicadas. Menos que esto ya no sostiene el progreso, pero sostiene el hábito, que es lo que importa cuando el trabajo aprieta.',
    dias: [2, 5],
    bloques: [{ patron: 'traccion' }, { patron: 'empuje' }],
  },

  /* ══════════════════════════════════════════════════════════════════════
     LAS CUATRO POR GRUPO MUSCULAR

     Un pedido explícito del dueño, dos veces: "rutinas específicas para
     grupos musculares, priorizá pecho completo y core, espalda y piernas,
     brazos también, con los ejercicios específicos para explotar la cadena
     muscular elegida".

     ## Lo que hay que decir antes

     Partir por grupo y hacer las cuatro significa que a cada una le toca un
     día por semana, y la app lo dice EN PANTALLA —en `advertenciaDe`, no
     escondido en este comentario—. Decía además que la evidencia favorece
     dos veces por semana con el mismo volumen, y eso no tiene una cita
     verificada todavía: ver `advertenciaDe`.

     Lo que el split sí da, y por lo que vale la pena cuando alguien lo pide:
     mucho más volumen por grupo en la sesión, y una sesión que se siente de
     algo en vez de un poco de todo. Si el objetivo es que la cosa se sostenga
     seis meses, que la persona quiera entrar al día siguiente también cuenta.

     ## Cómo están armadas

     Tres clases de bloque, y las tres hacían falta:

       · `patron` solo          → el eslabón que el motor eligió. Progresa solo.
       · `volumen: true`        → el eslabón ANTERIOR del mismo patrón. Es el
                                  trabajo de volumen, más liviano, y se escala
                                  solo cuando la persona sube de eslabón.
       · `ejercicioId`          → un accesorio fijo con barra. No mueve la
                                  cadena y su progresión la lleva la persona
                                  con la vara de la vez pasada.

     Los accesorios con barra solo aparecen si la persona declaró tener una
     barra cargable: `Hoy` y `Entrenar` los filtran. Sin barra, estas cuatro
     rutinas siguen funcionando con los bloques de cadena y de volumen.
     ══════════════════════════════════════════════════════════════════════ */

  {
    id: 'grupo-pecho-core',
    nombre: 'Pecho y core',
    descripcion:
      'El día de empuje completo: el eslabón que te toca, volumen en el anterior, el empuje por encima de la cabeza que ninguna cadena cubre, y core al final. Es el primero de las cuatro rutinas por grupo.',
    dias: [1, 2, 4, 5],
    bloques: [
      { patron: 'empuje', nota: 'Lo más duro primero, con el cuerpo entero.' },
      { patron: 'empuje', volumen: true, nota: 'Volumen en el eslabón de abajo: acá se junta el trabajo.' },
      { patron: 'empuje', ejercicioId: 'press-militar-barra', nota: 'Por encima de la cabeza: el hombro de costado no lo entrena nada más.' },
      { patron: 'empuje', ejercicioId: 'extension-triceps-barra' },
      { patron: 'core', nota: 'Al final: si lo hacés antes, te sabotea el resto.' },
    ],
  },
  {
    id: 'grupo-espalda',
    nombre: 'Espalda',
    descripcion:
      'Tracción vertical y horizontal en la misma sesión, que es lo que ninguna rutina de peso corporal puede dar sola: las dominadas tiran de arriba y el remo con barra tira de adelante.',
    dias: [1, 2, 4, 5],
    bloques: [
      { patron: 'traccion', nota: 'Vertical primero: es lo que más cuesta.' },
      { patron: 'traccion', volumen: true, nota: 'Volumen en el eslabón de abajo.' },
      { patron: 'traccion', ejercicioId: 'remo-barra', nota: 'Horizontal y cargado: la espalda media no la entrena la dominada.' },
      { patron: 'bisagra', ejercicioId: 'peso-muerto-rumano', nota: 'La cadena de atrás entera, de los gemelos a la espalda baja.' },
      { patron: 'traccion', ejercicioId: 'curl-barra' },
    ],
  },
  {
    id: 'grupo-piernas',
    nombre: 'Piernas',
    descripcion:
      'Adelante y atrás del muslo en la misma sesión, más el gemelo, que ningún ejercicio de peso corporal entrena con rango completo.',
    dias: [1, 2, 4, 5],
    bloques: [
      { patron: 'piernas', nota: 'Sentadilla primero, que es la que pide el cuerpo entero.' },
      { patron: 'piernas', volumen: true, nota: 'Volumen en el eslabón de abajo.' },
      { patron: 'bisagra', nota: 'La mitad de atrás, que la sentadilla casi no toca.' },
      { patron: 'piernas', ejercicioId: 'elevacion-talones-barra' },
      { patron: 'core' },
    ],
  },
  {
    id: 'grupo-brazos',
    nombre: 'Brazos',
    descripcion:
      'Bíceps y tríceps directos, más el volumen de las dos cadenas que los usan. Es el día que la app no podía armar: hasta ahora el bíceps tenía un solo ejercicio que lo limitara, y estaba al final de la cadena más difícil.',
    dias: [1, 2, 4, 5],
    bloques: [
      { patron: 'traccion', ejercicioId: 'curl-barra', nota: 'Directo, y primero: es lo que vinimos a hacer.' },
      { patron: 'empuje', ejercicioId: 'extension-triceps-barra' },
      { patron: 'traccion', volumen: true, nota: 'Tracción liviana: el bíceps otra vez, con el codo en otro ángulo.' },
      { patron: 'empuje', volumen: true, nota: 'Empuje liviano: el tríceps otra vez.' },
      { patron: 'core' },
    ],
  },
]

/** Las rutinas que parten la semana por grupo muscular. */
export const RUTINAS_POR_GRUPO = new Set([
  'grupo-pecho-core',
  'grupo-espalda',
  'grupo-piernas',
  'grupo-brazos',
])

/**
 * La advertencia que va en pantalla cuando alguien elige partir por grupo.
 *
 * No es letra chica y no es opcional: es lo que implica la decisión, dicho en
 * el momento de tomarla. Si se hacen las cuatro, a cada una le toca una vez
 * por semana.
 *
 * Dice "cada una" y no "cada músculo", a propósito: decía "cada músculo se
 * entrena una vez por semana", y no es cierto con estas cuatro. El core está
 * en tres, Brazos repite tracción y empuje con el volumen, y el rumano de
 * Espalda vuelve a cargar la bisagra de Piernas. El test de `grupos.test.ts`
 * lo cuenta sobre los bloques.
 *
 * Decía también que "con el mismo volumen semanal, dos veces rinde más", y no
 * tenía ninguna fuente: el metaanálisis de frecuencia que podría decidirlo
 * (Schoenfeld, Grgic y Krieger 2019) todavía no se verificó. El consejo que
 * seguía, alternar de a dos por semana, en promedio bajaba la frecuencia en
 * vez de subirla. Hasta tener la cita, se dice el hecho y nada más.
 *
 * Se dice y no se impide. El dueño pidió esto dos veces, sabe lo que quiere y
 * hay razones legítimas para elegirlo — más volumen por sesión, y una sesión
 * que se siente de algo.
 */
export function advertenciaDe(rutina: Rutina): string | null {
  if (!RUTINAS_POR_GRUPO.has(rutina.id)) return null
  return 'Partida por grupo: si hacés las cuatro, a cada una le toca una vez por semana.'
}

export const RUTINA_POR_ID = new Map(RUTINAS.map((r) => [r.id, r]))

export const RUTINA_POR_DEFECTO = 'cuerpo-completo'

export const NOMBRE_DIA: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
}

export const DIA_CORTO: Record<number, string> = {
  1: 'L',
  2: 'M',
  3: 'M',
  4: 'J',
  5: 'V',
  6: 'S',
  7: 'D',
}

/** Los siete días, en orden, para recorrer una semana sin escribir el rango a mano. */
export const DIAS: readonly number[] = [1, 2, 3, 4, 5, 6, 7]

/** Día de la semana en formato 1–7 (lunes a domingo), no el 0–6 de JavaScript. */
export function diaDeLaSemana(fecha: Date): number {
  const dia = fecha.getDay()
  return dia === 0 ? 7 : dia
}

/** Qué clase de día es: los dos ejes —fuerza y fuelle— en un solo valor. */
export type ClaseDeDia = 'descanso' | 'fuerza' | 'fuelle' | 'ambos'

/** Qué tiene cada clase, sin que nadie tenga que acordarse. */
export function tieneFuerza(clase: ClaseDeDia): boolean {
  return clase === 'fuerza' || clase === 'ambos'
}

export function tieneFuelle(clase: ClaseDeDia): boolean {
  return clase === 'fuelle' || clase === 'ambos'
}

/** Cómo se llama cada clase en la interfaz. */
export const NOMBRE_CLASE: Record<ClaseDeDia, string> = {
  descanso: 'Descanso',
  fuerza: 'Fuerza',
  // "Las dos" y no "Fuerza + fuelle": son las palabras con las que el dueño lo
  // pidió, y además el rótulo largo desbordaba la fila en un teléfono de 320.
  ambos: 'Las dos',
  fuelle: 'Fuelle',
}

/**
 * El orden en que la interfaz cicla los cuatro estados.
 *
 * Arranca en descanso y sube: fuerza, fuerza con fuelle, fuelle solo. Es de
 * menos a más exigente hasta `ambos` y después baja, porque el fuelle solo es
 * un día liviano y no el más pesado de todos — ponerlo al final del ciclo lo
 * deja al lado del descanso, que es donde se parece.
 */
export const CICLO: readonly ClaseDeDia[] = ['descanso', 'fuerza', 'ambos', 'fuelle']

export function siguienteClase(clase: ClaseDeDia): ClaseDeDia {
  const i = CICLO.indexOf(clase)
  return CICLO[(i + 1) % CICLO.length]!
}

/**
 * La semana de un preset, expandida a un valor por día.
 *
 * Es la traducción de las listas viejas al modelo nuevo, y es la que corre
 * cuando alguien todavía no tocó su semana. Un día que está en `diasDensos` es
 * `'ambos'`; uno en `diasDeFuelle`, `'fuelle'`; el resto de `dias`, `'fuerza'`.
 */
export function semanaDe(rutina: Rutina): Semana {
  const semana: Semana = {}
  for (const dia of DIAS) {
    if (!rutina.dias.includes(dia)) semana[dia] = 'descanso'
    else if (rutina.diasDeFuelle?.includes(dia)) semana[dia] = 'fuelle'
    else if (rutina.diasDensos?.includes(dia)) semana[dia] = 'ambos'
    else semana[dia] = 'fuerza'
  }
  return semana
}

/** Completa una semana a medio escribir. Un día que falta es descanso. */
export function semanaCompleta(parcial: Semana | undefined, deBase: Semana): Semana {
  if (!parcial) return deBase
  const semana: Semana = {}
  for (const dia of DIAS) semana[dia] = parcial[dia] ?? 'descanso'
  return semana
}

/** La rutina activa, con el mismo respaldo en los dos lugares que la leen. */
export function rutinaActiva(preferencias: Pick<Preferencias, 'rutinaActivaId'>): Rutina {
  return RUTINA_POR_ID.get(preferencias.rutinaActivaId) ?? RUTINA_POR_ID.get(RUTINA_POR_DEFECTO)!
}

/**
 * La semana que de verdad corre.
 *
 * `preferencias.semana` ausente quiere decir "nunca la tocó", y entonces manda
 * el preset. Es el mismo criterio con el que `densidad === undefined` distingue
 * "nunca se preguntó" de "dijo que no": la diferencia ya está en los datos y
 * alcanza con no aplanarla.
 */
export function semanaActiva(preferencias: Pick<Preferencias, 'rutinaActivaId' | 'semana'>): Semana {
  return semanaCompleta(preferencias.semana, semanaDe(rutinaActiva(preferencias)))
}

export function claseDeDia(semana: Semana, fecha: Date): ClaseDeDia {
  return semana[diaDeLaSemana(fecha)] ?? 'descanso'
}

export function tocaEntrenar(semana: Semana, fecha: Date): boolean {
  return claseDeDia(semana, fecha) !== 'descanso'
}

/** Los días que se entrena, de cualquier clase. En orden. */
export function diasDe(semana: Semana): number[] {
  return DIAS.filter((d) => (semana[d] ?? 'descanso') !== 'descanso')
}

/** Los días que le piden fuerza a las cadenas: `fuerza` y `ambos`. En orden. */
export function diasDeFuerza(semana: Semana): number[] {
  return DIAS.filter((d) => tieneFuerza(semana[d] ?? 'descanso'))
}

/**
 * Qué patrón toca hoy en un bloque que alterna.
 *
 * Sale del ÍNDICE del día dentro de los días de FUERZA, no de un contador
 * guardado. Es determinista a partir de la fecha, así que `Hoy` y `Entrenar`
 * llegan siempre a la misma respuesta sin compartir estado, y no hay nada que
 * pueda desincronizarse ni migrar.
 *
 * Antes contaba sobre TODOS los días de entrenamiento, y ahí estaba el defecto:
 * en "Densa, cinco días" —lunes a viernes, con martes y jueves de fuelle— los
 * tres días de fuerza caían en los índices 0, 2 y 4, todos pares, así que
 * siempre salía sentadilla. Medido: `{piernas: 3, bisagra: 0}`. La cadena
 * entera de bisagra —ocho eslabones, hasta el curl nórdico— era inalcanzable
 * en esa rutina. Un día de fuelle no corre bloques, así que no puede consumir
 * un turno de la alternancia, y contarlo era el error.
 *
 * Con la rutina de cuerpo completo —lunes, miércoles, viernes— da sentadilla,
 * bisagra, sentadilla. O sea bisagra una vez por semana, que es justo la
 * frecuencia que admite el curl nórdico donde esa cadena termina.
 */
export function patronDelBloque(bloque: BloqueRutina, semana: Semana, fecha: Date): Patron {
  if (!bloque.alterna) return bloque.patron
  const posicion = diasDeFuerza(semana).indexOf(diaDeLaSemana(fecha))
  if (posicion < 0) return bloque.patron
  return posicion % 2 === 0 ? bloque.patron : bloque.alterna
}

/** El próximo día de entrenamiento a partir de una fecha, sin contarla. */
export function proximoDia(semana: Semana, desde: Date): Date | null {
  if (diasDe(semana).length === 0) return null

  for (let salto = 1; salto <= 7; salto++) {
    const candidato = new Date(desde)
    candidato.setDate(candidato.getDate() + salto)
    if (tocaEntrenar(semana, candidato)) return candidato
  }
  return null
}

/**
 * Lo que la app tiene para decir de una semana armada a mano.
 *
 * Hasta acá los invariantes de las rutinas eran tests sobre cuatro objetos
 * escritos a mano. Ahora la semana la escribe una persona, así que los mismos
 * invariantes tienen que correr en vivo — y cambia el tono, porque ya no le
 * habla a quien programa sino a quien entrena.
 *
 * La línea entre `'impide'` y `'avisa'` es una sola: **se impide solo lo que
 * dejaría a la app sin poder hacer su trabajo**, y se avisa todo lo demás. Una
 * semana de seis días de fuerza es mala idea y se dice por qué, pero es su
 * cuerpo y su decisión; una semana sin ningún día de fuerza no es una decisión
 * discutible, es una app que no puede progresar ninguna cadena ni leer nada.
 */
export interface Aviso {
  clave: string
  texto: string
  gravedad: 'impide' | 'avisa'
}

/** Cuántos días de fuerza seguidos hay que encadenar para que valga avisar. */
export const SEGUIDOS_QUE_PREOCUPAN = 3

export function revisarSemana(semana: Semana, rutina: Rutina): Aviso[] {
  const avisos: Aviso[] = []
  const entrena = diasDe(semana)
  const fuerza = diasDeFuerza(semana)
  const fuelle = DIAS.filter((d) => (semana[d] ?? 'descanso') === 'fuelle')

  if (entrena.length === 0) {
    avisos.push({
      clave: 'vacia',
      gravedad: 'impide',
      texto: 'Una semana sin ningún día no es una rutina. Marcá al menos uno.',
    })
    return avisos
  }

  if (fuerza.length === 0) {
    avisos.push({
      clave: 'sin-fuerza',
      gravedad: 'impide',
      texto:
        'Sin un solo día de fuerza ninguna cadena avanza: el fuelle no le pide fuerza a nada, así que el motor no tendría de dónde leer. Marcá al menos un día de fuerza.',
    })
  }

  // Seis o siete días de fuerza rompen la alternancia antes que la recuperación:
  // con seis, un bloque que alterna cae tres veces por semana, y el curl nórdico
  // —donde termina la bisagra— se banca una.
  if (fuerza.length >= 6 && rutina.bloques.some((b) => b.alterna)) {
    avisos.push({
      clave: 'alternancia-apretada',
      gravedad: 'avisa',
      texto: `Con ${fuerza.length} días de fuerza, la bisagra de cadera cae tres veces por semana. El curl nórdico, donde esa cadena termina, se banca una.`,
    })
  }

  // Los dos avisos dicen lo que el motor hace de verdad: cada cadena se lee una
  // vez por día, con lo que sale ese día. Ni reto ni una regla de horas que la
  // app no tiene con qué sostener; la persona decide con el dato.
  if (fuerza.length >= 5 && fuelle.length === 0) {
    const cuantos = ['Cinco', 'Seis', 'Siete'][fuerza.length - 5] ?? 'Siete'
    avisos.push({
      clave: 'sin-recuperacion',
      gravedad: 'avisa',
      texto: `${cuantos} días de fuerza y ninguno de fuelle. Tu nivel se lee con lo que sale cada día: si llegás con menos resto, eso es lo que va a leer. Si querés, cambiá uno por fuelle.`,
    })
  }

  const seguidos = masSeguidos(fuerza)
  if (seguidos >= SEGUIDOS_QUE_PREOCUPAN) {
    avisos.push({
      clave: 'seguidos',
      gravedad: 'avisa',
      texto: `Hay ${seguidos} días de fuerza seguidos. Cada uno lee una vez las cadenas que entrena, con lo que salga ese día.`,
    })
  }

  return avisos
}

/** La tira más larga de días consecutivos. La semana no da la vuelta a propósito. */
function masSeguidos(dias: number[]): number {
  let mejor = 0
  let corriendo = 0
  let anterior = -9
  for (const dia of dias) {
    corriendo = dia === anterior + 1 ? corriendo + 1 : 1
    if (corriendo > mejor) mejor = corriendo
    anterior = dia
  }
  return mejor
}

/** Si la semana se puede guardar: ningún aviso que impida. */
export function semanaValida(semana: Semana, rutina: Rutina): boolean {
  return !revisarSemana(semana, rutina).some((a) => a.gravedad === 'impide')
}

/**
 * A dónde lleva el botón de Hoy, según la clase del día.
 *
 * La clase viaja por la URL y no se recalcula en `Entrenar` a propósito: si
 * cada pantalla la dedujera por su cuenta, una sesión arrancada a las 23:58
 * podría cambiar de clase a mitad de camino. Y por el mismo motivo que ya está
 * escrito en `SesionEnCurso`, además se guarda en el borrador: la URL se pierde
 * cuando el navegador recicla la pestaña.
 */
export function destinoDelDia(clase: ClaseDeDia): string {
  if (clase === 'fuelle') return '/entrenar?fuelle=1'
  if (clase === 'ambos') return '/entrenar?densa=1'
  return '/entrenar'
}
