/**
 * El diario: comida y sueño, siete hábitos y cero calorías.
 *
 * ## Por qué no hay calorías
 *
 * El balance energético es cierto y prácticamente inservible como función de
 * software. El autorreporte de ingesta subestima en torno al 30% —no por
 * mentira: por aceite a ojo, picoteo de pie y porciones calculadas con el ojo
 * cansado— y el gasto no se puede estimar sin sensores. Contar calorías acá
 * sería construir una versión mediocre de MyFitnessPal y heredar todos sus
 * riesgos, en una app cuyo motor ya premia mecánicamente el peso bajo.
 *
 * Lo que sí se puede medir sin mentir son hábitos, ordenados por impacto. Son
 * siete, y este archivo es la lógica de los siete: puro, sin Dexie y sin
 * React, igual que `progresion.ts`.
 *
 * ## La regla que gobierna todo el módulo
 *
 * **Es un piso, nunca un techo.** La app no dice "te pasaste" de nada. No hay
 * objetivo de sueño, no hay rachas, no hay días limpios, no hay
 * felicitaciones por no tomar alcohol. El silencio es la respuesta correcta la
 * mayoría de los días — la misma regla que ya gobierna `estado.ts`.
 *
 * ## Lo que la app puede afirmar, y lo que no
 *
 * PUEDE: que la proteína suficiente mejora un poco lo que se gana entrenando
 * (Morton 2018); que dormir poco mientras se baja de peso hace que una parte
 * mayor de lo que se baja sea músculo (Nedeltcheva 2010, un ensayo chico de 14
 * días: es "más músculo y menos grasa", no "músculo en vez de grasa"); que la
 * cafeína recorta en promedio unos 45 minutos de sueño y que un café tiene que
 * ir unas nueve horas antes de acostarse para no recortarlo (Gardiner y col.
 * 2023, Sleep Med Rev 69:101764, metaanálisis de 24 estudios), sin que se
 * sienta (Drake 2013); que con alcohol uno se duerme más rápido y la segunda
 * mitad de la noche se vuelve más cortada (Ebrahim 2013); que la creatina
 * monohidrato es el suplemento con más evidencia para fuerza y músculo. Lo que
 * más cuenta de la proteína es el total del día (Schoenfeld y Aragon 2018,
 * JISSN 15:10).
 *
 * NO PUEDE: ninguna cifra de calorías ingeridas o gastadas; que un horario de
 * comida cambie la composición corporal; que un alimento sea inflamatorio,
 * tóxico o detox; que el ayuno intermitente sea superior; ni estimar
 * porcentaje de grasa o gasto energético. Si mañana aparece en esta app un
 * BCAA, un quemador o un colágeno, se perdió la credibilidad entera.
 */

/** Cuánto se durmió, en los cinco tramos que una persona puede contestar. */
export type Sueno = '<5' | '5-6' | '6-7' | '7-8' | '8+'

export const TRAMOS_DE_SUENO: Sueno[] = ['<5', '5-6', '6-7', '7-8', '8+']

/** El punto medio de cada tramo, en horas. Para cruzar con el rendimiento. */
export const HORAS_DE: Record<Sueno, number> = {
  '<5': 4.5,
  '5-6': 5.5,
  '6-7': 6.5,
  '7-8': 7.5,
  '8+': 8.5,
}

/**
 * El alcohol, en tres opciones y sin carga moral.
 *
 * No hay "día limpio" y no hay racha de abstinencia: una racha convierte un
 * dato en una obligación, y esta es información, no un examen.
 */
export type Alcohol = 'nada' | 'poco' | 'bastante'

export const NOMBRE_ALCOHOL: Record<Alcohol, string> = {
  nada: 'Nada',
  poco: 'Una o dos',
  bastante: 'Más de dos',
}

/** Un día del diario. Todo opcional: no contestar es una respuesta válida. */
export interface DiaDelDiario {
  /** 'AAAA-MM-DD'. Es la clave. */
  fecha: string
  /** Cuánto dormiste ANOCHE. */
  sueno?: Sueno
  /** En cuántas comidas de hoy hubo una porción de proteína. 0 a 6. */
  porcionesDeProteina?: number
  /**
   * La hora de la última cafeína, en minutos desde medianoche, o
   * `SIN_CAFEINA` si hoy no hubo.
   *
   * "Hoy no tomé" y "todavía no contesté" son estados distintos y hay que
   * poder distinguirlos: sin el centinela, el día sin café queda indistinguible
   * del día sin contestar, y la fila se queda esperando para siempre una
   * respuesta que ya está dada. Un 0 no sirve de centinela — las doce de la
   * noche es una hora real, y para alguien que se acuesta a las dos de la
   * mañana es además una hora de café perfectamente posible.
   */
  ultimaCafeina?: number
  /** A qué hora te acostaste (o pensás acostarte), en minutos desde medianoche. */
  horaDeDormir?: number
  alcohol?: Alcohol
  /** Verdura o fruta en al menos dos comidas. Binario a propósito. */
  verduraEnDos?: boolean
  creatina?: boolean
  actualizadoEn: number
}

/* ══════════════════════════════════════════════════════════════════════════
   LOS UMBRALES
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * El piso de proteína, en porciones.
 *
 * Cuatro, porque repartir el total del día en al menos cuatro comidas es la
 * forma más fácil de llegar a él (Schoenfeld y Aragon 2018). No es que cada
 * toma "rinda más" que una cena grande: lo que más pesa es el total. Cuatro es
 * el piso; más no es "mejor" y la app no lo va a decir.
 */
export const PISO_DE_PROTEINA = 4

/** El tope del stepper. Seis comidas es ya un día poco común. */
export const TOPE_DE_PROTEINA = 6

/**
 * Cuántas horas antes de dormir la cafeína todavía recorta el sueño.
 *
 * Nueve, que es la cuenta de un café (unos 107 mg: 8,8 horas en Gardiner y
 * col. 2023). Un pre-entreno pide más, unas trece. Es el único hábito donde la
 * app le muestra a alguien algo que su percepción no puede detectar: en
 * promedio la cafeína recortó unos 45 minutos de sueño, y en Drake 2013 la
 * gente no notaba lo que el registro sí medía.
 */
export const HORAS_DE_CAFEINA = 9

/** "Hoy no hubo cafeína". Ver el comentario de `ultimaCafeina`. */
export const SIN_CAFEINA = -1

/** Cuántos días hacen falta antes de decir una sola palabra sobre el sueño. */
export const DIAS_PARA_LEER_SUENO = 21

/** El tramo por debajo del cual el sueño empieza a costar músculo. */
export const SUENO_CORTO: Sueno[] = ['<5', '5-6']

/* ══════════════════════════════════════════════════════════════════════════
   LAS LECTURAS
   ══════════════════════════════════════════════════════════════════════════ */

/** Una hora en minutos desde medianoche → "23:30". */
export function comoHora(minutos: number): string {
  const h = Math.floor(minutos / 60) % 24
  const m = minutos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * ¿La cafeína de hoy cae adentro de la ventana que recorta el sueño?
 *
 * La resta se hace sobre un reloj circular: acostarse a las 00:30 y tomar café
 * a las 17:00 son siete horas y media, no menos diecisiete. Sin esto, la app
 * le diría que no pasa nada justo a quien se acuesta pasada la medianoche, que
 * es exactamente a quien más le importa.
 */
export function cafeinaTarde(dia: DiaDelDiario): boolean {
  const { ultimaCafeina, horaDeDormir } = dia
  if (ultimaCafeina === undefined || ultimaCafeina === SIN_CAFEINA) return false
  if (horaDeDormir === undefined) return false
  const bruto = horaDeDormir - ultimaCafeina
  const horas = (bruto < 0 ? bruto + 24 * 60 : bruto) / 60
  return horas < HORAS_DE_CAFEINA
}

/** A qué hora habría que cortar el café para que no toque el sueño. */
export function corteDeCafeina(horaDeDormir: number): number {
  const bruto = horaDeDormir - HORAS_DE_CAFEINA * 60
  return bruto < 0 ? bruto + 24 * 60 : bruto
}

/**
 * Las señales del día: lo que está, lo que falta, y nada más.
 *
 * `faltan` NO es una lista de incumplimientos: es lo que todavía no
 * contestaste. La distinción es la misma que hace toda la app con los
 * eslabones — lo que falta no está prohibido, está sin iluminar.
 */
export interface SenalesDelDia {
  /** Cuántos de los siete hábitos tienen una respuesta hoy. */
  contestados: number
  /** De los contestados, cuántos están en su piso. Nunca se muestra como nota. */
  enPiso: number
  /** El aviso de cafeína, que es el único que la app levanta sola. */
  avisoDeCafeina: string | null
}

export function senalesDelDia(dia: DiaDelDiario | undefined): SenalesDelDia {
  if (!dia) return { contestados: 0, enPiso: 0, avisoDeCafeina: null }

  const respuestas = [
    dia.sueno !== undefined,
    dia.porcionesDeProteina !== undefined,
    dia.ultimaCafeina !== undefined,
    dia.alcohol !== undefined,
    dia.verduraEnDos !== undefined,
    dia.creatina !== undefined,
  ]

  const pisos = [
    dia.sueno !== undefined && !SUENO_CORTO.includes(dia.sueno),
    (dia.porcionesDeProteina ?? 0) >= PISO_DE_PROTEINA,
    dia.verduraEnDos === true,
  ]

  return {
    contestados: respuestas.filter(Boolean).length,
    enPiso: pisos.filter(Boolean).length,
    avisoDeCafeina: cafeinaTarde(dia)
      ? `Tomaste cafeína a menos de ${HORAS_DE_CAFEINA} horas de tu hora de acostarte. En promedio eso recorta unos 45 minutos de sueño, y no se siente: esta noche es probable que duermas menos sin notarlo.`
      : null,
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   EL CRUCE CON EL ENTRENAMIENTO

   Esta es la única parte del módulo que dice algo que la persona no sabía, y
   por eso es la que más cuidado necesita. Tres reglas:

     · No aparece antes de tres semanas de datos.
     · No aparece si no hay señal — una diferencia chica es ruido con cara de
       dato, y decirla es peor que callarse.
     · No es un objetivo. Dice qué pasó, no qué hacer.
   ══════════════════════════════════════════════════════════════════════════ */

/** La diferencia mínima entre los dos grupos para que valga decir algo. */
export const DIFERENCIA_MINIMA = 0.12

/** Cuántas sesiones hacen falta de cada lado. Con menos, dos casos mandan. */
export const SESIONES_POR_LADO = 4

export interface LecturaDeSueno {
  /** Qué fracción del objetivo se cumplió viniendo de dormir poco. */
  durmiendoPoco: number
  /** Y viniendo de dormir bien. */
  durmiendoBien: number
  sesionesPoco: number
  sesionesBien: number
}

/**
 * Cruzar el sueño de la noche anterior con lo que rindió la sesión.
 *
 * @param sesiones  pares de (fecha de la sesión, rendimiento 0-1).
 * @param diario    el diario completo, indexado por fecha.
 *
 * El sueño de la fila del día D es el de la noche ANTERIOR a D —así se
 * pregunta, "cuánto dormiste anoche"— así que la sesión del día D se cruza con
 * el sueño registrado el día D. No hay que correr la fecha, y escribirlo acá
 * evita el error de correrla de más.
 */
export function cruzarSuenoConRendimiento(
  sesiones: { fecha: string; rendimiento: number }[],
  diario: Map<string, DiaDelDiario>,
): LecturaDeSueno | null {
  const poco: number[] = []
  const bien: number[] = []

  for (const s of sesiones) {
    const sueno = diario.get(s.fecha)?.sueno
    if (sueno === undefined) continue
    if (SUENO_CORTO.includes(sueno)) poco.push(s.rendimiento)
    else if (sueno === '7-8' || sueno === '8+') bien.push(s.rendimiento)
    // El tramo 6-7 queda afuera a propósito: es la frontera, y meterlo de un
    // lado u otro inventaría una diferencia que no está en los datos.
  }

  if (poco.length < SESIONES_POR_LADO || bien.length < SESIONES_POR_LADO) return null

  const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const durmiendoPoco = media(poco)
  const durmiendoBien = media(bien)

  if (durmiendoBien - durmiendoPoco < DIFERENCIA_MINIMA) return null

  return {
    durmiendoPoco,
    durmiendoBien,
    sesionesPoco: poco.length,
    sesionesBien: bien.length,
  }
}

/** La frase, con los números adentro y sin una sola recomendación. */
export function dichoDelSueno(l: LecturaDeSueno): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`
  return `En las sesiones que venís de dormir menos de seis horas cumpliste el objetivo el ${pct(l.durmiendoPoco)} de las veces; durmiendo más de siete, el ${pct(l.durmiendoBien)}.`
}
