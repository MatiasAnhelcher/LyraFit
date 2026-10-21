/**
 * El motor de progresión.
 *
 * Es el corazón de la app y la única parte que decide qué entrenás mañana.
 * Todo acá adentro son funciones puras: reciben datos, devuelven datos, no
 * tocan la base ni la pantalla.
 *
 * La idea del método es vieja y probada, y es la misma a la que llegan todos
 * los sistemas serios de calistenia: **doble progresión**. Se suben
 * repeticiones dentro de una ventana acotada y, recién cuando se llega al
 * techo de esa ventana, se pasa al eslabón siguiente de la cadena — que es la
 * única variable que de verdad equivale a ponerle más peso a la barra.
 *
 * Tres decisiones de diseño que valen la pena explicar, porque parecen
 * detalles y son las que hacen que el motor funcione:
 *
 * 1. **La memoria es suave, no son contadores.** Antes había dos rachas que se
 *    reiniciaban una a la otra, y eso tenía un agujero: una sesión que no era
 *    ni éxito ni fallo las borraba las dos, así que quien quedaba siempre un
 *    poco corto no subía ni bajaba nunca. Una media móvil exponencial siempre
 *    se mueve, así que el motor no se puede trabar.
 *
 * 2. **Quedarse quieto tiene fecha de vencimiento.** Si pasan varias sesiones
 *    con el mismo objetivo, el motor fuerza un cambio. Puede subir, puede
 *    bajar, pero no puede no hacer nada: repetir la misma frase treinta veces
 *    es la forma más rápida de que alguien deje de abrir la app.
 *
 * 3. **Cambiar de eslabón se calcula, no se inventa.** Cada ejercicio sabe qué
 *    fracción del peso del cuerpo mueve, así que cuánto bajar al subir de
 *    nivel sale de una cuenta y no de un número escrito a mano.
 */

import type {
  Avance,
  Cadena,
  Ejercicio,
  Medida,
  Objetivo,
  Serie,
  TipoSesion,
} from './tipos'

// ─── Las constantes del motor ────────────────────────────────────────────
// Están todas acá arriba y son públicas a propósito: la app le muestra sus
// reglas a la persona, y no se puede mostrar lo que está escondido.

/** Por encima de esta señal, el objetivo sube. */
export const SUBE = 0.95

/** Por debajo de esta señal, el objetivo baja. */
export const BAJA = 0.75

/**
 * Cuánto pesa la última sesión sobre la señal. Con 0,5 la memoria efectiva es
 * de unas dos sesiones: la misma inercia de antes, sin los reinicios.
 */
export const SUAVIZADO = 0.5

/** Sesiones seguidas con el mismo objetivo antes de forzar un cambio. */
export const MESETA = 4

/** Sesiones de gracia después de cambiar de eslabón, para no rebotar. */
export const GRACIA = 3

/**
 * Sesiones sosteniendo el techo de la ventana antes de cambiar de eslabón.
 *
 * Es la diferencia entre tocar un techo y dominarlo. Con una sola sesión, un
 * buen día alcanza para mandar a alguien a una palanca que no puede sostener —
 * que es justamente cómo se llegaba antes a la flexión a una mano en cinco
 * semanas.
 */
export const CONSOLIDACION = 2

/**
 * Tope de validez de la fórmula de Brzycki. Más allá de doce repeticiones la
 * relación entre repeticiones y porcentaje del máximo se rompe, así que se
 * satura en vez de devolver un número inventado.
 */
const TOPE_BRZYCKI = 12

/** Segundos de referencia para los isométricos, el equivalente del tope de arriba. */
const REFERENCIA_ISOMETRICA = 12

// ─── Cuánto sube el objetivo ─────────────────────────────────────────────

/**
 * El incremento es proporcional, no fijo.
 *
 * Sumar una repetición sobre cinco es subir un veinte por ciento; sumarla
 * sobre veinte es subir un cinco. Un paso fijo hace que la progresión sea
 * brutal al principio de cada eslabón y despreciable al final.
 */
export function incremento(medida: Medida, cantidad: number): number {
  const proporcion = medida === 'segundos' ? 0.15 : 0.1
  const minimo = medida === 'segundos' ? 3 : 1
  return Math.max(minimo, Math.round(cantidad * proporcion))
}

/**
 * Cómo se nombra una cantidad según su unidad. "Subimos a 25 por serie" no
 * dice lo mismo en una plancha que en una flexión: en una es tiempo y en la
 * otra son repeticiones, y el texto tiene que decir cuál.
 */
export function conUnidad(medida: Medida, cantidad: number): string {
  return medida === 'segundos' ? `${cantidad} segundos` : `${cantidad}`
}

// ─── Cómo salió la sesión ────────────────────────────────────────────────

/**
 * El rendimiento de una sesión, como número continuo alrededor de 1.
 *
 * Antes esto era una clasificación en tres cajones y el del medio no tenía
 * salida. Ahora es una medida: 1 es cumplir el objetivo, más es superarlo,
 * menos es quedarse corto, y todo lo intermedio existe.
 *
 * El volumen total pesa tres cuartos y la peor serie un cuarto. Ese cuarto
 * conserva la intuición correcta —tres series de diez y una de dos no es un
 * objetivo cumplido— sin darle el mando al estimador más ruidoso, que además,
 * por la fatiga que se acumula dentro de la sesión, termina midiendo aguante y
 * no capacidad.
 *
 * Se topea en 1,25 para que una sesión extraordinaria no tape dos malas.
 */
/**
 * Lo que hace falta saber para comparar series con distinta carga: de qué
 * ejercicio son y cuánto pesa la persona.
 *
 * Es opcional en todos lados. Sin contexto, las cuentas son exactamente las de
 * siempre — y hay un test que verifica que "exactamente" sea literal.
 */
export interface ContextoDeCarga {
  ejercicio: Ejercicio
  pesoCorporalKg?: number
  /** El objetivo contra el que se traduce. Lo usa `logradoTipico`, que no lo recibe. */
  objetivo?: Objetivo
}

/**
 * Una serie, traducida a repeticiones del objetivo.
 *
 * Es la pieza que impide el peor error que la carga externa puede causar.
 * Medido: objetivo de 3×10 fijado sin discos, hecho 6-6-5 con veinte kilos. En
 * repeticiones peladas eso da rendimiento 0,550 y el motor BAJA el objetivo al
 * día siguiente, cuando lo que pasó es que la carga subió un 28%. Traducido,
 * las seis repeticiones con veinte kilos valen lo que valen.
 *
 * La traducción pasa por el índice de carga, que es la única escala de esta
 * app en la que dos esfuerzos distintos son comparables, y usa la inversa
 * exacta para volver. Si no hay con qué traducir —sin peso corporal, o cuando
 * la serie tiene la misma carga que el objetivo— devuelve lo logrado tal cual.
 */
function traducirAlObjetivo(
  serie: Serie,
  objetivo: Objetivo | undefined,
  contexto: ContextoDeCarga | undefined,
): number {
  const logrado = Math.max(0, serie.logrado)
  // Cero es cero: una serie que no se hizo no se traduce, se cuenta como lo
  // que fue. Sin esto, la inversa le devolvería un número positivo a una serie
  // vacía, que es la clase de error que nadie encuentra mirando.
  if (logrado <= 0) return 0
  if (!contexto) return logrado

  const peso = contexto.pesoCorporalKg
  const kgObjetivo = objetivo?.kg ?? 0
  const kgSerie = serie.kg ?? kgObjetivo
  if (!peso || kgSerie === kgObjetivo) return logrado

  const indice = indiceDeCarga(contexto.ejercicio, logrado, {
    kg: kgSerie,
    pesoCorporalKg: peso,
  })
  const equivalente = cantidadParaCarga(contexto.ejercicio, indice, {
    kg: kgObjetivo,
    pesoCorporalKg: peso,
  })
  return Math.max(0, equivalente)
}

export function rendimientoDeSesion(
  objetivo: Objetivo,
  series: Serie[],
  contexto?: ContextoDeCarga,
): number {
  const propuesto = objetivo.series * objetivo.cantidad
  if (propuesto <= 0 || objetivo.cantidad <= 0) return 0

  // La serie de cierre no opina. Se filtra acá y no en la pantalla para que
  // proteja a todos los que llaman, incluida la proyección del alta.
  const logrados = series
    .filter((s) => !s.cierre)
    .map((s) => traducirAlObjetivo(s, objetivo, contexto))
  const volumen = logrados.reduce((suma, n) => suma + n, 0)

  // Las series que faltaron cuentan como cero, así que abandonar a la mitad
  // queda penalizado sin necesidad de una regla aparte.
  const faltantes = objetivo.series - logrados.length
  const peor = faltantes > 0 ? 0 : Math.min(...logrados, Infinity)
  const peorFinal = Number.isFinite(peor) ? peor : 0

  return (
    0.75 * Math.min(volumen / propuesto, 1.25) +
    0.25 * Math.min(peorFinal / objetivo.cantidad, 1.25)
  )
}

/** La cantidad típica que se logró, para saber a qué bajar cuando hay meseta. */
export function logradoTipico(series: Serie[], contexto?: ContextoDeCarga): number {
  const logrados = series
    .filter((s) => !s.cierre)
    .map((s) => traducirAlObjetivo(s, contexto?.objetivo, contexto))
    .sort((a, b) => a - b)
  if (logrados.length === 0) return 0
  const medio = Math.floor(logrados.length / 2)
  if (logrados.length % 2 === 1) return logrados[medio]!
  return Math.round(((logrados[medio - 1] ?? 0) + (logrados[medio] ?? 0)) / 2)
}

/**
 * Si una sesión de este tipo mueve la progresión o no.
 *
 * Vivía adentro de `cerrarSesion`, o sea en la capa de datos y fuera del
 * alcance de cualquier test. Está acá porque es una regla del motor, y porque
 * las dos excepciones tienen la misma forma —una vara más baja— y llegaron por
 * caminos distintos:
 *
 * - La **corta** cuenta para la adherencia y no para la progresión: seis
 *   minutos no dicen nada sobre si alguien está listo para el eslabón que
 *   sigue, y castigar a alguien por haber hecho algo es la peor lección
 *   posible.
 * - La **de vuelta** trae el objetivo ya recortado al 70%. Cumplirlo da
 *   rendimiento 1,00 contra esa vara más baja, así que si contara podría
 *   disparar un salto de eslabón que no se ganó. La vara se baja para que
 *   volver sea fácil, no para regalar un nivel.
 * - La **de fuelle** es el día de acondicionamiento: no tiene una sola serie de
 *   la cadena, así que no hay nada que medir. Cuenta para la adherencia, que es
 *   justamente lo que la hace útil: permite entrenar cinco días sin que el
 *   motor lea como pérdida de capacidad lo que fue no haber descansado.
 *
 * Es exhaustiva a propósito: un tipo de sesión nuevo no hereda el permiso de
 * mover el plan, hay que dárselo acá.
 */
export function mueveElPlan(tipo: TipoSesion): boolean {
  return tipo === 'plan'
}

// ─── Carga relativa: lo que hace comparables dos ejercicios distintos ────

/**
 * Qué fracción del máximo representa hacer esta cantidad.
 *
 * Para repeticiones es Brzycki, saturada en doce. Para isométricos es la ley
 * de potencia del tiempo hasta el fallo, que es su equivalente: aguantar el
 * doble de tiempo implica bastante menos intensidad relativa.
 */
export function fraccionDelMaximo(medida: Medida, cantidad: number): number {
  if (medida === 'segundos') {
    const segundos = Math.max(cantidad, 3)
    return Math.min(1, Math.cbrt(REFERENCIA_ISOMETRICA / segundos))
  }
  return 1.0278 - 0.0278 * Math.min(Math.max(cantidad, 1), TOPE_BRZYCKI)
}

/**
 * La carga externa de una serie o de un objetivo: los discos puestos y el peso
 * del cuerpo con el que se los compara.
 *
 * Van juntos a propósito. Los kilos solos no significan nada en la escala del
 * motor —el `ccr` es una fracción del peso corporal— y el peso corporal solo
 * no agrega información. Si falta cualquiera de los dos, no hay carga.
 */
export interface CargaExterna {
  kg?: number
  pesoCorporalKg?: number
}

/**
 * El `ccr` con los discos puestos.
 *
 * `ccr` es la fracción del peso del cuerpo que mueve el ejercicio, y un disco
 * es peso absoluto, así que la suma es directa: veinte kilos sobre una persona
 * de setenta y cinco son 0,267 de peso corporal, y una dominada de 0,95 pasa a
 * ser 1,217.
 *
 * **La salida temprana devuelve `ejercicio.ccr` tal cual, no una expresión
 * equivalente.** No es una optimización: `ccr + 0 / 75` y `ccr` son el mismo
 * número en el papel y pueden no serlo en punto flotante, y toda la app está
 * llena de igualdades pineadas sobre estos valores. Sin carga, nada cambia, y
 * "nada" quiere decir ni un bit.
 */
export function ccrEfectivo(ejercicio: Ejercicio, carga?: CargaExterna): number {
  const kg = carga?.kg
  const peso = carga?.pesoCorporalKg
  if (!kg || !peso || kg <= 0 || peso <= 0) return ejercicio.ccr
  return ejercicio.ccr + kg / peso
}

/**
 * El índice de carga: cuánto está levantando esta persona, en una escala
 * comparable entre ejercicios distintos.
 *
 * Tiene una propiedad que vale oro para la pantalla de progreso: al cambiar de
 * eslabón con la fórmula de recalibración de más abajo, este número queda
 * exactamente igual. O sea que la curva de progreso no se corta ni se desploma
 * justo en el momento de mayor logro, que es lo que le pasa a todo registro
 * crudo de repeticiones cuando se sube de nivel.
 *
 * Es una estimación y la app lo dice: no es una medición del cuerpo de nadie.
 */
export function indiceDeCarga(
  ejercicio: Ejercicio,
  cantidad: number,
  externa?: CargaExterna,
): number {
  return ccrEfectivo(ejercicio, externa) / fraccionDelMaximo(ejercicio.medida, cantidad)
}

/**
 * La cantidad de este ejercicio que equivale a un índice de carga dado.
 *
 * Es la inversa EXACTA de la de arriba y hay un test que lo pinea, así que el
 * término de carga entra en las dos o en ninguna: una inversa que no invierte
 * rompe la recalibración al cambiar de eslabón, que es la cuenta que sostiene
 * que la curva de progreso no se desplome en el momento de mayor logro.
 */
export function cantidadParaCarga(
  ejercicio: Ejercicio,
  carga: number,
  externa?: CargaExterna,
): number {
  if (carga <= 0) return ejercicio.ventana.min
  const fraccion = ccrEfectivo(ejercicio, externa) / carga

  if (ejercicio.medida === 'segundos') {
    if (fraccion <= 0) return ejercicio.ventana.max
    return Math.round(REFERENCIA_ISOMETRICA / Math.pow(fraccion, 3))
  }
  // El épsilon no es cosmética: sin él, `cantidadParaCarga(e, indiceDeCarga(e,
  // 4))` devuelve 3. La división deja 3,999999999 y el piso se come una
  // repetición entera. Sin carga externa el redondeo caía bien por casualidad
  // en los valores que se usaban; con el término de kilos el `ccr` efectivo
  // trae más decimales y la inversa dejó de invertir. Lo encontró el test de
  // la inversa con quince kilos puestos.
  return Math.floor((1.0278 - fraccion) / 0.0278 + 1e-9)
}

/**
 * Cuánto hacer del ejercicio nuevo, a partir de lo que se estaba haciendo en
 * el viejo. Es la cuenta que reemplaza al número escrito a mano.
 *
 * Cuando cambia la unidad de medida —de repeticiones a segundos— no hay
 * traducción defendible, así que se entra por el piso de la ventana y se dice.
 */
export function recalibrar(
  desde: Ejercicio,
  cantidad: number,
  hacia: Ejercicio,
): number {
  if (desde.medida !== hacia.medida) return hacia.ventana.min

  const cruda = cantidadParaCarga(hacia, indiceDeCarga(desde, cantidad))
  return acotar(cruda, hacia.ventana.min, hacia.ventana.max)
}

function acotar(valor: number, minimo: number, maximo: number): number {
  return Math.min(Math.max(valor, minimo), maximo)
}

// ─── La decisión ─────────────────────────────────────────────────────────

/** Qué clase de movimiento hizo el motor. Lo usa la interfaz para destacarlo. */
export type Movimiento =
  | 'subida'
  | 'sostiene'
  | 'bajada'
  | 'nivel-arriba'
  | 'nivel-abajo'
  | 'neutra'

export interface Decision {
  avance: Avance
  /** Qué cambió, en una frase, para poder mostrárselo a la persona. */
  explicacion: string
  movimiento: Movimiento
  /** True si hubo cambio de ejercicio, para destacarlo en la interfaz. */
  cambioDeNivel: boolean
}

/** Lo que el motor necesita saber de una sesión para decidir. */
export interface Evaluacion {
  /** Rendimiento continuo, el que devuelve `rendimientoDeSesion`. */
  rendimiento: number
  /** La cantidad típica lograda, para saber a qué bajar si hay meseta. */
  tipico: number
  /**
   * La sesión no mueve la progresión en ningún sentido. Es lo que pasa con una
   * sesión corta o con un día que la persona marcó como malo: no cuenta ni a
   * favor ni en contra.
   */
  neutra?: boolean
  /**
   * Una sesión floja que no debería contar como fallo, porque hay una razón
   * conocida —dormiste mal, venís cargado— que la explica.
   *
   * El motor decide con muy pocas observaciones. Si una de ellas está
   * contaminada por algo transitorio e identificable, bajarle la exigencia a
   * alguien por eso es un error de medición, no una decisión de entrenamiento.
   * Protegida solo puede ayudar, nunca perjudicar: una sesión buena cuenta
   * igual.
   */
  protegida?: boolean
  /**
   * Cómo se viene sintiendo, de -2 a +2, promediando las últimas sesiones.
   *
   * Frena las subidas cuando la persona viene cumpliendo pero pasándola mal.
   * No vetea entrenamientos ni hace bajar de nivel: solo evita apretar el
   * acelerador en el peor momento posible, que es cuando alguien está a punto
   * de dejar.
   */
  animo?: number
}

interface Contexto {
  cadena: Cadena
  /** Los ejercicios de la cadena, indexados por id. */
  ejercicios: Map<string, Ejercicio>
  /**
   * La barra cargable, si la hay. Sin esto el motor se comporta exactamente
   * como antes de que existieran los kilos, que es el caso de quien entrena
   * con el piso y una barra de dominadas.
   */
  barra?: Barra
  /**
   * Los eslabones de esta cadena a los que todavía no se puede subir, cada uno
   * con su motivo. Los calcula `eslabonesCerrados` (en `apertura.ts`), que es
   * el que mira afuera de la cadena: el equipo y las otras cadenas.
   *
   * El motor no sube a uno cerrado, y lo dice. Bajar a uno sí puede, porque
   * bajar nunca es el riesgo. Sin esto se comporta exactamente como antes.
   */
  cerrados?: ReadonlyMap<string, Cierre>
}

/**
 * Por qué un eslabón está cerrado.
 *
 * - **sin-barra**: se hace colgado y la persona dijo que no tiene de dónde.
 * - **requisito**: pide haber llegado a un eslabón de otra cadena, que viaja
 *   acá para poder nombrarlo, y a veces con un mínimo en ese eslabón —las 3
 *   series de 8 dominadas completas de la palanca frontal—, que viaja por lo
 *   mismo: decir "cuando llegues a las dominadas completas" a quien ya está
 *   en ellas sería no decirle nada.
 */
export type Cierre =
  | { motivo: 'sin-barra' }
  | { motivo: 'requisito'; requisito: Ejercicio; minimo?: Pick<Objetivo, 'series' | 'cantidad'> }

/**
 * El requisito dicho para la persona: "3 series de 8 dominadas completas", o
 * el nombre del eslabón si alcanza con llegar.
 *
 * Es lo que va después de "cuando llegues a", y lo usan el motor, la ficha y
 * el aviso de cuando hubo que bajar: si cada uno lo armara por su cuenta, el
 * mismo requisito se diría de tres maneras.
 */
export function requisitoDicho(
  requisito: Ejercicio,
  minimo?: Pick<Objetivo, 'series' | 'cantidad'>,
): string {
  if (!minimo) return requisito.nombre
  const nombre = requisito.nombre.toLowerCase()
  return requisito.medida === 'segundos'
    ? `${minimo.series} series de ${minimo.cantidad} segundos de ${nombre}`
    : `${minimo.series} series de ${minimo.cantidad} ${nombre}`
}

/** Lo que falta para que se abra el eslabón siguiente, dicho para la persona. */
function loQueFalta(siguiente: Ejercicio, cierre: Cierre): string {
  return cierre.motivo === 'sin-barra'
    ? `Lo que sigue, ${siguiente.nombre}, necesita una barra`
    : `Lo que sigue, ${siguiente.nombre}, se abre cuando llegues a ${requisitoDicho(cierre.requisito, cierre.minimo)}`
}

/**
 * Lo que hace falta saber para que el motor pueda proponer discos.
 *
 * Los tres juntos o ninguno: sin el peso corporal los kilos no se pueden
 * traducir a la escala del motor, sin el tope la app propondría algo que no
 * existe en la casa de la persona, y sin el paso de disco propondría 1,8 kg,
 * que no se puede poner con discos de 2,5.
 */
export interface Barra {
  pesoCorporalKg: number
  cargaMaximaKg: number
  pasoDeDiscoKg: number
}

/**
 * El paso de carga, cuantizado al disco más chico que la persona tiene.
 *
 * NO es un porcentaje del peso ni el 25% de la escalera de eslabones, que es
 * lo que la fórmula pediría: es el disco. Una app que propone subir 1,8 kg a
 * alguien que tiene discos de 2,5 está pidiendo algo imposible, y lo que pasa
 * entonces no es que la persona redondee — es que deja de creerle al número.
 *
 * Los dos pasos de `docs/fuerza-con-barra.md` salen de acá: 2,5 kg en lo que
 * empuja o tracciona con los brazos y 5 en lo que mueve la cadera. La cadera
 * lleva el doble porque un paso de 2,5 kg sobre un peso muerto es ruido.
 */
export function pasoDeCarga(ejercicio: Ejercicio, barra: Barra): number {
  const dobla = ejercicio.patron === 'piernas' || ejercicio.patron === 'bisagra'
  return barra.pasoDeDiscoKg * (dobla ? 2 : 1)
}

/**
 * ¿Este eslabón admite discos?
 *
 * La pregunta no es si se puede atar un disco a cualquier cosa —se puede— sino
 * si el motor puede LEER la carga. Dos condiciones:
 *
 *   1. Hay con qué: peso corporal, tope de barra y paso de disco.
 *   2. El índice de carga está saturado, o sea que la persona ya pasó las doce
 *      repeticiones. Por debajo de eso sumar una repetición sí mueve el
 *      índice, y repeticiones son gratis mientras sirvan.
 *
 * La segunda es la que importa y es la que arregla el agujero: pasadas las
 * doce, `fraccionDelMaximo` se satura por el tope de Brzycki y el índice queda
 * CONGELADO. El motor seguía diciendo "seguís sumando" para siempre, la curva
 * de fuerza quedaba horizontal y los hechos dejaban de encontrar subidas,
 * mientras la persona hacía veinte repeticiones de algo que ya dominaba.
 */
export function admiteDiscos(
  ejercicio: Ejercicio,
  cantidad: number,
  barra: Barra | undefined,
): barra is Barra {
  if (!barra) return false
  if (barra.pesoCorporalKg <= 0 || barra.cargaMaximaKg <= 0 || barra.pasoDeDiscoKg <= 0) return false
  // Los isométricos no llevan discos en esta app: cargarle peso a una plancha
  // cambia el ejercicio, no su intensidad, y el motor no tiene forma de saber
  // si lo que se cargó fue el abdomen o la espalda baja.
  if (ejercicio.medida === 'segundos') return false
  return cantidad >= TOPE_BRZYCKI
}

function ejercicioDe(ctx: Contexto, id: string): Ejercicio {
  const ejercicio = ctx.ejercicios.get(id)
  if (!ejercicio) {
    throw new Error(`El ejercicio "${id}" no está en la cadena de ${ctx.cadena.patron}.`)
  }
  return ejercicio
}

function vecino(ctx: Contexto, id: string, salto: 1 | -1): Ejercicio | null {
  const posicion = ctx.cadena.ejercicios.indexOf(id)
  if (posicion === -1) return null
  const destino = ctx.cadena.ejercicios[posicion + salto]
  return destino ? ejercicioDe(ctx, destino) : null
}

/**
 * Decide el próximo paso a partir del avance actual y de cómo salió la sesión.
 *
 * Las reglas, en orden:
 *
 * - La señal se actualiza con el rendimiento de la sesión.
 * - Señal alta y todavía hay techo en la ventana → más repeticiones.
 * - Señal alta y ya se llegó al techo → siguiente eslabón, con la carga
 *   recalculada a partir de lo que la persona demostró.
 * - Señal baja → menos repeticiones y, si ya está en el piso, un eslabón atrás.
 * - Ni una cosa ni la otra → se sostiene… pero no para siempre: a las cuatro
 *   sesiones sin cambios el motor mueve algo sí o sí.
 */
export function siguienteAvance(
  avance: Avance,
  evaluacion: Evaluacion,
  ctx: Contexto,
  ahora: number = Date.now(),
): Decision {
  const actual = ejercicioDe(ctx, avance.ejercicioId)
  const { medida, ventana } = actual
  const cantidad = avance.objetivoActual.cantidad

  // Una sesión neutra no toca nada. Ni la señal, ni el contador de meseta.
  if (evaluacion.neutra) {
    return {
      movimiento: 'neutra',
      cambioDeNivel: false,
      explicacion: 'Sesión registrada. Esta no mueve el plan, ni a favor ni en contra.',
      avance: { ...avance, actualizadoEn: ahora },
    }
  }

  // Protegida quiere decir que una sesión floja no arrastra la señal para
  // abajo. Si salió bien, cuenta como cualquier otra: premiar sí, castigar no.
  const arrastra = !(evaluacion.protegida && evaluacion.rendimiento < avance.senal)
  const senal = arrastra
    ? SUAVIZADO * evaluacion.rendimiento + (1 - SUAVIZADO) * avance.senal
    : avance.senal

  const gracia = Math.max(0, avance.graciaRestante - 1)
  const base = {
    patron: avance.patron,
    senal,
    graciaRestante: gracia,
    actualizadoEn: ahora,
  }

  const sostener = (explicacion: string, movimiento: Movimiento = 'sostiene'): Decision => ({
    movimiento,
    cambioDeNivel: false,
    explicacion,
    avance: {
      ...base,
      ejercicioId: actual.id,
      objetivoActual: { ...avance.objetivoActual },
      sesionesEnObjetivo: avance.sesionesEnObjetivo + 1,
    },
  })

  /**
   * Mover la cantidad, sobre el mismo ejercicio y con los mismos discos.
   *
   * El `...avance.objetivoActual` del principio no es cosmético: sin él, la
   * persona que llegaba al tope de su barra con 45 kg puestos volvía en
   * silencio a peso corporal, porque esta función reconstruía el objetivo
   * desde cero y se dejaba los kilos afuera. Lo agarró un test que verificaba
   * el mensaje, no el dato — el mensaje decía "45 kg" y el objetivo decía
   * nada.
   *
   * Todos los que llaman acá son cambios sobre el MISMO ejercicio, así que
   * conservar la carga es correcto en los cuatro.
   */
  const ajustar = (nueva: number, explicacion: string, movimiento: Movimiento): Decision => ({
    movimiento,
    cambioDeNivel: false,
    explicacion,
    avance: {
      ...base,
      ejercicioId: actual.id,
      objetivoActual: { ...avance.objetivoActual, series: avance.objetivoActual.series, cantidad: nueva },
      sesionesEnObjetivo: 0,
    },
  })

  /**
   * Cambiar los discos, que es un movimiento de carga y no de eslabón.
   *
   * `cambioDeNivel` queda en false a propósito: el ejercicio es el mismo, y
   * las pantallas que celebran un eslabón nuevo no tienen nada que celebrar
   * acá. Lo que cambió es cuánto pesa, y eso lo dice la explicación.
   *
   * `sesionesEnObjetivo` vuelve a cero porque el objetivo ES otro: sostener
   * veinte kilos tres sesiones no dice nada sobre sostener veintidós.
   */
  const conDiscos = (
    kg: number,
    nueva: number,
    explicacion: string,
    movimiento: Movimiento,
  ): Decision => ({
    movimiento,
    cambioDeNivel: false,
    explicacion,
    avance: {
      ...base,
      ejercicioId: actual.id,
      objetivoActual: { series: avance.objetivoActual.series, cantidad: nueva, kg },
      sesionesEnObjetivo: 0,
    },
  })

  const cambiarDeNivel = (
    destino: Ejercicio,
    nueva: number,
    explicacion: string,
    movimiento: Movimiento,
  ): Decision => ({
    movimiento,
    cambioDeNivel: true,
    explicacion,
    avance: {
      ...base,
      ejercicioId: destino.id,
      objetivoActual: { series: destino.series, cantidad: nueva },
      sesionesEnObjetivo: 0,
      graciaRestante: GRACIA,
    },
  })

  /**
   * Volver un eslabón atrás, con dos precauciones contra el rebote.
   *
   * Se entra por la mitad de la ventana y no cerca del techo, porque si no dos
   * buenas sesiones devuelven a la persona al ejercicio que la acaba de
   * superar. Y la gracia es más larga que la de una subida: si algo ya resultó
   * demasiado, volver a probarlo la semana que viene es perder el mes.
   */
  const retroceder = (destino: Ejercicio, cruda: number, explicacion: string): Decision => {
    /*
     * CON DISCOS PUESTOS NO SE RETROCEDE: PRIMERO SE SACAN.
     *
     * Y la guarda vive acá adentro, en el único lugar por el que pasan todos
     * los retrocesos, a propósito. La versión anterior razonaba sobre qué
     * caminos podían llegar con kilos —"los discos solo existen en el último
     * eslabón, y bajando se sacan antes de retroceder"— y el razonamiento era
     * incompleto: con la señal sostenida en 0,80 la rama de bajada NUNCA
     * corre (0,80 > BAJA = 0,75) y a las cuatro sesiones entra la meseta, que
     * retrocede por su cuenta. `cambiarDeNivel` arma el objetivo nuevo sin
     * `kg`, así que los 20 kg del dueño desaparecían sin que la explicación
     * los mencionara.
     *
     * Tenía un test que afirmaba justo esto —"no se puede salir de un eslabón
     * con discos puestos"— y usaba el camino que NO rompe: empujaba la señal
     * abajo de BAJA, que es donde la rama de discos sí corre. Probé el camino
     * seguro y di por probado el otro.
     *
     * Por eso ahora es una guarda estructural y no una cadena de razonamientos
     * sobre alcanzabilidad: cualquier retroceso, venga de donde venga, saca un
     * disco en vez de cambiar de ejercicio. Si quedan discos, el eslabón se
     * mantiene; recién con la barra vacía se puede retroceder.
     */
    const puestos = avance.objetivoActual.kg ?? 0
    if (puestos > 0 && ctx.barra) {
      const paso = pasoDeCarga(actual, ctx.barra)
      const nuevos = Math.max(0, puestos - paso)
      const medioDeAca = Math.round((ventana.min + ventana.max) / 2)
      return conDiscos(
        nuevos,
        medioDeAca,
        nuevos > 0
          ? `${actual.nombre} te está costando hace varias sesiones. Antes de cambiar de ejercicio sacamos peso: ${nuevos} kg, ${conUnidad(medida, medioDeAca)} por serie.`
          : `${actual.nombre} te está costando hace varias sesiones. Sacamos los discos y lo hacemos a peso corporal, ${conUnidad(medida, medioDeAca)} por serie. Si sigue costando, el próximo paso es volver un eslabón.`,
        'bajada',
      )
    }

    const medio = Math.round((destino.ventana.min + destino.ventana.max) / 2)
    const nueva = acotar(Math.min(cruda, medio), destino.ventana.min, destino.ventana.max)
    const decision = cambiarDeNivel(destino, nueva, explicacion, 'nivel-abajo')
    return { ...decision, avance: { ...decision.avance, graciaRestante: GRACIA * 2 } }
  }

  // ── Sube ───────────────────────────────────────────────────────────────
  if (senal >= SUBE) {
    // El eslabón que viene, y si está cerrado. Se mira antes que nada porque
    // cambia lo que se puede prometer: con el siguiente cerrado, llegar al
    // techo no es pasar de nivel.
    const siguiente = vecino(ctx, actual.id, 1)
    const cierre = siguiente ? ctx.cerrados?.get(siguiente.id) : undefined

    if (cantidad < ventana.max) {
      // Viene cumpliendo, pero la está pasando mal. Subirle la carga ahora es
      // la forma más segura de perderla: se consolida en su lugar.
      //
      // El freno vive acá adentro y no antes, a propósito. Cambiar de eslabón
      // es casi siempre neutro en carga —`recalibrar` conserva el índice a los
      // dos lados del salto— así que frenarlo no bajaría ninguna exigencia:
      // solo postergaría lo único que la app prometió, y encima el día en que
      // la persona ya se lo ganó. El "casi" importa y está resuelto más abajo:
      // en los bordes de la ventana el salto sí puede pedir más, y ahí el freno
      // vuelve a aplicar.
      if (evaluacion.animo !== undefined && evaluacion.animo < 0) {
        return sostener(
          'Venís cumpliendo, pero las últimas sesiones se te hicieron cuesta arriba. Nos quedamos acá para consolidar.',
        )
      }

      const nueva = Math.min(cantidad + incremento(medida, cantidad), ventana.max)
      const faltaPoco = nueva >= ventana.max
      const techo = cierre
        ? `es el techo de ${actual.nombre}.`
        : `es el techo de ${actual.nombre}, y con eso pasás de nivel.`
      return ajustar(
        nueva,
        faltaPoco
          ? `Objetivo cumplido. Subimos a ${conUnidad(medida, nueva)} por serie: ${techo}`
          : `Objetivo cumplido. Subimos a ${conUnidad(medida, nueva)} por serie.`,
        'subida',
      )
    }

    /*
     * EL SIGUIENTE ESTÁ CERRADO: SE SIGUE SUMANDO ACÁ.
     *
     * Es el mismo trato que el último eslabón de una cadena —se suma volumen—
     * con dos diferencias. No pasa por la consolidación, porque consolidar es
     * asegurarse antes de cambiar de ejercicio y acá no se cambia. Y no ofrece
     * discos: la barra cargable es para el final de una cadena, no para el
     * eslabón donde la persona espera que se le abra el siguiente.
     *
     * Existe por dos casos medidos con el código real: sin barra, el motor
     * subía igual a las dominadas negativas y a las elevaciones colgado; y con
     * cero dominadas, llegaba a la palanca frontal apenas terminaban las
     * elevaciones colgado.
     */
    if (siguiente && cierre) {
      return ajustar(
        cantidad + incremento(medida, cantidad),
        `Llegaste al techo de ${actual.nombre}. ${loQueFalta(siguiente, cierre)}: mientras tanto seguís sumando acá.${
          cierre.motivo === 'sin-barra' ? ' Si conseguís una, marcalo en Ajustes.' : ''
        }`,
        'subida',
      )
    }

    // Está en el techo de la ventana. Dominar un eslabón no es tocar el techo
    // una vez: es poder repetirlo. Una sola sesión buena puede ser un buen día,
    // y subir de palanca con un buen día es cómo se llega a un ejercicio que no
    // se puede sostener.
    if (avance.graciaRestante > 0 || avance.sesionesEnObjetivo < CONSOLIDACION) {
      const faltan = CONSOLIDACION - avance.sesionesEnObjetivo
      return sostener(
        faltan <= 1
          ? `Llegaste al techo de ${actual.nombre}. Una sesión más así y cambiamos de ejercicio.`
          : `Techo de ${actual.nombre} alcanzado. Lo sostenemos un par de sesiones antes de subir: dominar es poder repetirlo.`,
      )
    }

    if (siguiente) {
      const nueva = recalibrar(actual, cantidad, siguiente)

      // El freno por ánimo, también acá, pero solo cuando el salto de verdad
      // sube la carga.
      //
      // La versión anterior de este archivo dejaba pasar todos los cambios de
      // eslabón con el argumento de que son neutros en carga por construcción.
      // Es falso en los bordes: `recalibrar` acota contra la ventana del
      // ejercicio destino, y cuando la cuenta cae por debajo del piso —que es
      // lo que pasa en la base de las cadenas, donde los eslabones están más
      // juntos— el salto termina pidiendo MÁS carga, no la misma. Medido: de
      // plancha de rodillas a plancha son casi nueve puntos porcentuales
      // arriba. O sea que a un principiante que viene pasándola mal el freno no
      // lo estaba frenando justo donde más falta hacía.
      //
      // Comparar los dos índices lo resuelve sin tocar el caso bueno: cuando el
      // salto es neutro o baja la carga —que es lo normal, y es lo que hace que
      // la curva de progreso no se corte— sigue pasando aunque la persona la
      // esté pasando mal, porque postergarlo ahí no le baja ninguna exigencia.
      //
      // Y la comparación se hace CON LOS DISCOS PUESTOS. Medido sobre los 35
      // pares de eslabones de repeticiones que tiene la app: con 20 kg encima
      // sobre una persona de 75, el signo de esta comparación se da vuelta en
      // 5 de los 35, y siempre en la misma dirección — sin carga el freno
      // dispara, con carga no debería. Los cinco son
      // remo-australiano-alto→medio, dominada-arquera→un-brazo-asistida,
      // sentadilla-completa→zancada, puente-una-pierna→bisagra-una-pierna y
      // curl-nordico-negativo→curl-nordico.
      //
      // Hoy este caso no se puede alcanzar: los discos solo existen en el
      // último eslabón de una cadena, donde no hay `siguiente`, y bajando se
      // sacan antes de retroceder. O sea que esto no arregla un bug vivo: lo
      // previene para cuando entren eslabones con carga en medio de una
      // cadena, que es exactamente lo que viene. Decirlo así importa — un
      // comentario que afirma haber arreglado algo que nunca pasó es peor que
      // ninguno.
      const carga = ctx.barra
        ? { kg: avance.objetivoActual.kg ?? 0, pesoCorporalKg: ctx.barra.pesoCorporalKg }
        : undefined
      if (
        evaluacion.animo !== undefined &&
        evaluacion.animo < 0 &&
        indiceDeCarga(siguiente, nueva, carga) > indiceDeCarga(actual, cantidad, carga)
      ) {
        return sostener(
          `Llegaste al techo de ${actual.nombre}, pero las últimas sesiones se te hicieron cuesta arriba y el paso a ${siguiente.nombre} pide más. Lo dejamos listo para cuando estés mejor.`,
        )
      }

      return cambiarDeNivel(
        siguiente,
        nueva,
        `Dominaste ${actual.nombre} con ${conUnidad(medida, cantidad)}. Subís a ${siguiente.nombre}, arrancando en ${conUnidad(siguiente.medida, nueva)}.`,
        'nivel-arriba',
      )
    }

    /*
     * ÚLTIMO ESLABÓN. Acá estaba el agujero más grande que dejó la barra.
     *
     * Lo que había era "no hay adónde subir, así que se suma volumen", para
     * siempre. Y pasadas las doce repeticiones `fraccionDelMaximo` se satura
     * por el tope de Brzycki, así que el índice de carga queda CONGELADO: la
     * persona suma repeticiones sin fin, la curva de fuerza queda horizontal y
     * los hechos dejan de encontrar subidas. Estaba haciendo veinte
     * repeticiones de algo que dominaba y la app no tenía nada que decirle.
     *
     * El lugar natural de los kilos es exactamente este. En vez de "seguís
     * sumando": subí un disco y volvé al piso de la ventana, que es la misma
     * doble progresión que la app aplica en todos lados, un nivel más arriba.
     */
    if (admiteDiscos(actual, cantidad, ctx.barra)) {
      const puestos = avance.objetivoActual.kg ?? 0
      const paso = pasoDeCarga(actual, ctx.barra)
      const nuevos = puestos + paso

      if (nuevos <= ctx.barra.cargaMaximaKg) {
        return conDiscos(
          nuevos,
          ventana.min,
          puestos === 0
            ? `Llegaste al final de la cadena de ${ctx.cadena.nombre} y a ${conUnidad(medida, cantidad)} por serie, que es donde sumar repeticiones deja de medir. Le ponemos ${nuevos} kg y volvemos a ${ventana.min}: la misma doble progresión, un escalón más arriba.`
            : `Dominaste ${actual.nombre} con ${puestos} kg. Subimos a ${nuevos} y volvés a ${ventana.min} por serie.`,
          'subida',
        )
      }

      // La barra se quedó corta. No es un final: es el momento de los recursos
      // que no son discos —tempo, pausa—, y la app lo dice en vez de quedarse
      // muda o proponer un peso que no existe. Los ofrece como otra forma de
      // hacerlo más difícil, no como algo que "rinde más": la estrategia dice
      // que el tempo no funciona como palanca de carga, y repeticiones de medio
      // segundo a ocho dan un crecimiento parecido (Schoenfeld, Ogborn y
      // Krieger 2015, metaanálisis).
      return ajustar(
        cantidad + incremento(medida, cantidad),
        `Llegaste al tope de tu barra: ${ctx.barra.cargaMaximaKg} kg sobre ${actual.nombre}. Seguimos sumando repeticiones. Si querés otra forma de hacerlo más difícil sin más discos, probá bajar más despacio o hacer una pausa abajo.`,
        'subida',
      )
    }

    // Sin barra —o todavía por debajo de las doce, donde una repetición más sí
    // mueve el índice— se suma volumen, que es lo que esta app hizo siempre.
    return ajustar(
      cantidad + incremento(medida, cantidad),
      `Llegaste al final de la cadena de ${ctx.cadena.nombre}. Seguís sumando sobre ${actual.nombre}.`,
      'subida',
    )
  }

  // ── Baja ───────────────────────────────────────────────────────────────
  if (senal <= BAJA) {
    /*
     * CON DISCOS PUESTOS, LO PRIMERO QUE BAJA ES EL PESO.
     *
     * La asimetría con la subida es deliberada y es la parte de esto que más
     * fácil sería hacer mal. Subiendo, los kilos son lo ÚLTIMO: primero se
     * agotan las repeticiones porque son gratis. Bajando son lo PRIMERO, por
     * dos razones distintas:
     *
     *   1. Un disco de menos es un escalón de carga grande y limpio. Bajar de
     *      diez a nueve repeticiones con veinticinco kilos encima no arregla
     *      una serie que se está yendo: la alarga.
     *   2. Es lo que hace cualquiera en un gimnasio y por el motivo correcto
     *      — la técnica se recupera con menos peso, no con menos volumen.
     *
     * Y las repeticiones van al MEDIO de la ventana, no al piso: con el peso
     * ya bajado, mandar también las repeticiones abajo del todo sería bajar
     * dos escalones de una por una sola mala racha.
     */
    const puestos = avance.objetivoActual.kg ?? 0
    if (puestos > 0 && ctx.barra) {
      const paso = pasoDeCarga(actual, ctx.barra)
      const nuevos = Math.max(0, puestos - paso)
      const medio = Math.round((ventana.min + ventana.max) / 2)
      /*
       * 'bajada', y el movimiento NO es una etiqueta decorativa.
       *
       * `conDiscos` tenía 'subida' escrito adentro, y la rama de bajada lo
       * reusaba: sacarle un disco a alguien que viene cortándose quedaba
       * registrado como una SUBIDA. La explicación decía "vienen saliendo
       * cortas, sacamos un disco" y el movimiento decía que había subido.
       *
       * No es cosmético. `Cierre.tsx` mira este campo para decidir si usa la
       * frase de reencuadre — la que existe justamente para que bajar de
       * carga no se lea como "no servís para esto"—. Con la etiqueta
       * equivocada, la app te sacaba peso de la barra y te felicitaba: el
       * único momento que está diseñado para tratarse con cuidado, tratado
       * como su opuesto. Y el historial guardaba "subida" el día que bajó.
       *
       * Lo encontró una prueba de refutación de la revisión, no mis tests:
       * yo había verificado los kilos y las repeticiones de esta rama, y no
       * el movimiento.
       */
      return conDiscos(
        nuevos,
        medio,
        nuevos > 0
          ? `Vienen saliendo cortas. Sacamos un disco: ${nuevos} kg, ${conUnidad(medida, medio)} por serie. La técnica se recupera con menos peso, no con menos repeticiones.`
          : `Vienen saliendo cortas. Sacamos los discos y volvemos a ${actual.nombre} a peso corporal, ${conUnidad(medida, medio)} por serie.`,
        'bajada',
      )
    }

    if (cantidad > ventana.min) {
      const nueva = Math.max(cantidad - incremento(medida, cantidad), ventana.min)
      return ajustar(
        nueva,
        `Vienen saliendo cortas. Bajamos a ${conUnidad(medida, nueva)} por serie para recuperar la técnica.`,
        'bajada',
      )
    }

    if (avance.graciaRestante > 0) {
      return sostener(
        `${actual.nombre} todavía te está costando. Le damos un par de sesiones más antes de tocar nada.`,
      )
    }

    const anterior = vecino(ctx, actual.id, -1)
    if (anterior) {
      return retroceder(
        anterior,
        recalibrar(actual, cantidad, anterior),
        `${actual.nombre} todavía te queda grande. Volvemos a ${anterior.nombre} para construir la base.`,
      )
    }

    // Primer eslabón de la cadena: no hay adónde bajar de ejercicio, pero
    // tampoco se puede dejar a alguien pidiéndole para siempre algo que no le
    // sale. Acá el piso de la ventana deja de ser un piso.
    if (cantidad > 1) {
      const nueva = Math.max(1, cantidad - incremento(medida, cantidad))
      return ajustar(
        nueva,
        `Bajamos a ${conUnidad(medida, nueva)} por serie. Es el principio de todo y no hay apuro.`,
        'bajada',
      )
    }

    return sostener(
      'Ya estás en el primer nivel con la carga mínima. Sostené y dale tiempo: esto también es entrenar.',
    )
  }

  // ── Ni una cosa ni la otra ─────────────────────────────────────────────
  // Acá es donde el motor viejo se colgaba. Sostener está bien un par de
  // sesiones —consolidar también es progresar— pero no puede ser para siempre.
  const sesiones = avance.sesionesEnObjetivo + 1
  if (sesiones < MESETA) {
    return sostener('Quedaste cerca. Repetimos el mismo objetivo para consolidarlo.')
  }

  // Meseta. Hay que mover algo.
  if (senal >= (SUBE + BAJA) / 2) {
    // Está muy cerca: se le da el empujón.
    if (cantidad < ventana.max) {
      const nueva = Math.min(cantidad + incremento(medida, cantidad), ventana.max)
      return ajustar(
        nueva,
        `Cuatro sesiones rondando el objetivo sin terminar de cerrarlo. Estás listo igual: subimos a ${conUnidad(medida, nueva)}.`,
        'subida',
      )
    }
    const siguiente = vecino(ctx, actual.id, 1)
    const cierre = siguiente ? ctx.cerrados?.get(siguiente.id) : undefined
    // Con el siguiente cerrado no hay empujón que dar, y "la próxima
    // cambiamos" sería una promesa que el motor no va a cumplir.
    if (siguiente && cierre) {
      return sostener(`Seguimos en ${actual.nombre}. ${loQueFalta(siguiente, cierre)}.`)
    }
    if (siguiente && avance.graciaRestante === 0) {
      const nueva = recalibrar(actual, cantidad, siguiente)
      return cambiarDeNivel(
        siguiente,
        nueva,
        `Estás hace rato en el techo de ${actual.nombre}. Probemos ${siguiente.nombre} con ${conUnidad(siguiente.medida, nueva)}.`,
        'nivel-arriba',
      )
    }
    return sostener(`Seguimos en ${actual.nombre}. La próxima cambiamos.`)
  }

  // Está estancado abajo: el objetivo no es realista. Se lo lleva a lo que la
  // persona está haciendo de verdad.
  const objetivoReal = Math.min(evaluacion.tipico, cantidad - incremento(medida, cantidad))
  const anterior = vecino(ctx, actual.id, -1)
  const piso = anterior ? ventana.min : 1

  if (objetivoReal >= piso) {
    return ajustar(
      objetivoReal,
      `Cuatro sesiones en ${conUnidad(medida, cantidad)} sin llegar. El objetivo era optimista: lo llevamos a ${conUnidad(medida, objetivoReal)}, que es lo que estás haciendo de verdad.`,
      'bajada',
    )
  }

  if (anterior && avance.graciaRestante === 0) {
    return retroceder(
      anterior,
      recalibrar(actual, Math.max(evaluacion.tipico, 1), anterior),
      `${actual.nombre} te está quedando grande hace varias sesiones. Volvemos a ${anterior.nombre}: se progresa más rápido desde un escalón que se domina.`,
    )
  }

  return sostener(
    `Seguimos en ${actual.nombre} con la carga mínima. Hay semanas así, y no borran nada de lo que llevás hecho.`,
  )
}

// ─── Puntos de partida ───────────────────────────────────────────────────

/** Crea el punto de partida de un patrón: primer ejercicio, carga de entrada. */
export function avanceInicial(
  cadena: Cadena,
  ejercicios: Map<string, Ejercicio>,
  ahora: number = Date.now(),
): Avance {
  const primeroId = cadena.ejercicios[0]
  if (!primeroId) {
    throw new Error(`La cadena de ${cadena.patron} está vacía.`)
  }
  const primero = ejercicios.get(primeroId)
  if (!primero) {
    throw new Error(`Falta el ejercicio "${primeroId}".`)
  }

  return {
    patron: cadena.patron,
    ejercicioId: primero.id,
    objetivoActual: { series: primero.series, cantidad: primero.ventana.min },
    senal: 1,
    sesionesEnObjetivo: 0,
    graciaRestante: 0,
    actualizadoEn: ahora,
  }
}

/**
 * Ubica a alguien en la cadena a partir de una sola prueba.
 *
 * Es lo que hace que la app no le proponga flexiones contra la pared a quien
 * ya hace quince completas. La cuenta es la misma que usa el motor para
 * cambiar de nivel: se traduce lo que la persona hizo a índice de carga y se
 * busca el eslabón donde ese índice cae dentro de la ventana de trabajo.
 *
 * Se baja un escalón a propósito. Lo que uno dice que hace siempre está un
 * poco inflado, y arrancar demasiado fácil se corrige solo en dos sesiones,
 * mientras que arrancar demasiado arriba se corrige con una lesión.
 *
 * `techo` es el eslabón más alto en el que se puede ubicar, aunque la cuenta
 * dé más. Lo decide `techoDeUbicacion` (en `apertura.ts`): una plancha de dos
 * minutos dice mucho del abdomen y nada de colgarse de una barra. Si la cuenta
 * pasa el techo, se queda en el techo sin el escalón de descuento: lo que
 * demostró ya alcanza de sobra para ese eslabón.
 */
export function ubicarEnCadena(
  cadena: Cadena,
  ejercicios: Map<string, Ejercicio>,
  pruebaId: string,
  logrado: number,
  ahora: number = Date.now(),
  techo?: string,
): Avance {
  const inicial = avanceInicial(cadena, ejercicios, ahora)
  const prueba = ejercicios.get(pruebaId)
  if (!prueba || logrado <= 0) return inicial

  const carga = indiceDeCarga(prueba, logrado)

  // De más difícil a más fácil: el primero donde la persona entra en la
  // ventana de trabajo es su nivel.
  let elegido = 0
  for (let i = cadena.ejercicios.length - 1; i >= 0; i--) {
    const id = cadena.ejercicios[i]
    const ejercicio = id ? ejercicios.get(id) : undefined
    if (!ejercicio) continue
    if (cantidadParaCarga(ejercicio, carga) >= ejercicio.ventana.min) {
      elegido = i
      break
    }
  }

  const tope = techo === undefined ? -1 : cadena.ejercicios.indexOf(techo)
  const conDescuento = Math.max(0, elegido - 1)
  const seguro = tope === -1 ? conDescuento : Math.min(conDescuento, tope)
  const id = cadena.ejercicios[seguro]
  const ejercicio = id ? ejercicios.get(id) : undefined
  if (!ejercicio) return inicial

  const cantidad = acotar(
    cantidadParaCarga(ejercicio, carga),
    ejercicio.ventana.min,
    ejercicio.ventana.max,
  )

  return {
    ...inicial,
    ejercicioId: ejercicio.id,
    objetivoActual: { series: ejercicio.series, cantidad },
  }
}

/**
 * Cuánto de la ventana de un eslabón ya recorrió un objetivo, de 0 a 1.
 *
 * Es el relleno del segmento actual en la barra de cada cadena: el piso de la
 * ventana es 0, el techo es 1, y lo de afuera se acota. No sirve
 * `porcentajeDeCadena` para esto porque esa mide la cadena ENTERA y redondea
 * a un entero: con once eslabones, un 60 % no dice dónde está la estrella
 * dentro del séptimo.
 *
 * Una ventana sin recorrido (piso igual al techo) da 0 y no NaN.
 */
export function rellenoDeVentana(ejercicio: Ejercicio, cantidad: number): number {
  const recorrido = ejercicio.ventana.max - ejercicio.ventana.min
  if (recorrido <= 0) return 0
  return Math.min(1, Math.max(0, (cantidad - ejercicio.ventana.min) / recorrido))
}

/**
 * Qué porcentaje de la cadena llevás recorrido, contando el ejercicio actual
 * y lo que falta para dominarlo.
 */
export function porcentajeDeCadena(
  avance: Avance,
  cadena: Cadena,
  ejercicios: Map<string, Ejercicio>,
): number {
  const total = cadena.ejercicios.length
  if (total === 0) return 0

  const posicion = cadena.ejercicios.indexOf(avance.ejercicioId)
  if (posicion === -1) return 0

  const actual = ejercicios.get(avance.ejercicioId)
  if (!actual) return 0

  const dentroDelNivel = rellenoDeVentana(actual, avance.objetivoActual.cantidad)

  return Math.round(((posicion + dentroDelNivel) / total) * 100)
}

/**
 * Cuántas sesiones faltan para llegar a un ejercicio, si todo sale bien.
 *
 * Se calcula corriendo el motor en seco contra alguien que cumple siempre. No
 * es una promesa y la pantalla lo dice con esas palabras: es el mejor caso
 * imaginable, y sirve para que la persona vea que el camino existe y tiene
 * forma, no para prometerle una fecha.
 *
 * Devuelve null si el ejercicio no está más adelante en la cadena.
 */
export function proyectar(
  avance: Avance,
  ctx: Contexto,
  hasta: string,
  tope = 600,
): number | null {
  const destino = ctx.cadena.ejercicios.indexOf(hasta)
  const actual = ctx.cadena.ejercicios.indexOf(avance.ejercicioId)
  if (destino === -1 || actual === -1 || destino <= actual) return null

  // Un eslabón cerrado en el camino no se cruza cumpliendo: se abre con otra
  // cosa. Contar sesiones hasta ahí sería prometer un salto que el motor no va
  // a dar, y correrlo seiscientas veces para descubrirlo, un desperdicio.
  for (let i = actual + 1; i <= destino; i++) {
    if (ctx.cerrados?.has(ctx.cadena.ejercicios[i]!)) return null
  }

  let corriendo = avance
  for (let sesion = 1; sesion <= tope; sesion++) {
    const objetivo = corriendo.objetivoActual
    const series: Serie[] = Array.from({ length: objetivo.series }, () => ({
      logrado: objetivo.cantidad,
    }))
    const decision = siguienteAvance(
      corriendo,
      { rendimiento: rendimientoDeSesion(objetivo, series), tipico: objetivo.cantidad },
      ctx,
      corriendo.actualizadoEn,
    )
    corriendo = decision.avance
    if (corriendo.ejercicioId === hasta) return sesion
  }
  return null
}

/** El primer ejercicio de la cadena que todavía no se alcanzó. */
export function proximoHitoDeCadena(
  avance: Avance,
  cadena: Cadena,
  ejercicios: Map<string, Ejercicio>,
): Ejercicio | null {
  const posicion = cadena.ejercicios.indexOf(avance.ejercicioId)
  if (posicion === -1) return null
  const siguiente = cadena.ejercicios[posicion + 1]
  return siguiente ? (ejercicios.get(siguiente) ?? null) : null
}
