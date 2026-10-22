/**
 * El arranque de una sesión: qué se pidió al abrir `/entrenar` y qué se arma
 * con eso (§2.4).
 *
 * Antes esto vivía repartido entre `useSesionEnCurso.ts`, que leía `corta`,
 * `fuelle` y `densa` de la URL, y `usePlanDeLaSesion.ts`, que armaba el plan
 * adentro de un `useMemo`. Con la libertad de empezar cualquier cosa (una
 * rutina, un mix, un ejercicio solo, una sesión vieja, la movilidad de una
 * zona) esa forma no escala: cada puerta nueva habría tocado las dos
 * pantallas, y dos pantallas que arman cada una su parte terminan armando dos
 * sesiones distintas. Por eso todo se resuelve acá, en tres pasos puros:
 *
 * 1. **`pedidoDesdeUrl`** lee la URL (y el `estado` del historial, donde
 *    viaja lo cambiado en el Sector) y dice qué se pidió, sin mirar ningún
 *    dato. Una rutina que no existe todavía es un pedido: que no existe se
 *    sabe recién con las rutinas en la mano.
 * 2. **`planDelPedido`** lo arma con los datos: los pasos, el `origen` que se
 *    guarda en el borrador y en la sesión, y el `tipo`, que es lo que lee el
 *    motor. Un pedido que no se puede cumplir no rompe nada: arma lo mismo
 *    que `/entrenar` sin parámetros y dice por qué en `aviso`.
 * 3. **`pasosParaRepetir`** resuelve Repetir (§5.6 G): o lleva a la puerta de
 *    donde salió la sesión, o la rearma con sus registros.
 *
 * ## Lo que no decide
 *
 * Nada de esto lee la base ni el reloj: el día, el historial, los avances y
 * las rutinas llegan como argumentos. Tampoco arma nada por su cuenta: el plan
 * de siempre sale de `ejercicioDelBloque` y `bloqueConMolestia`, una rutina de
 * `planDeRutina`, un mix de `resolverMix`, la molestia de `pasosConMolestia` y
 * el chequeo de `ajusteDelDia`. Acá solo se elige a quién llamar y en qué
 * orden, para que el plan, una rutina, un mix y una repetición bajen
 * exactamente igual. Retomar un borrador vigente tampoco es de acá: lo decide
 * `/entrenar` antes de mirar la URL (§2.4), como siempre.
 */

import { RECORTE_DE_VUELTA, esVuelta } from './adherencia'
import {
  DESCANSO_DE_BAJADA,
  bajadaDe,
  ejercicioDelBloque,
  sinEjerciciosRepetidos,
} from './bajada'
import { POR_ID, cadenaDe } from './biblioteca'
import { fechaDelDia } from './borrador'
import { origenDe, planSemanal } from './dia'
import { equipoDe, type PerfilDeEquipo } from './equipo'
import { ajusteDelDia, ajusteParaFijos, bandaSostenida, type AjusteDelDia } from './estado'
import { laVezPasada } from './estadisticas'
import { MIX_POR_SECTOR, VERSIONES, resolverMix, type VersionDeMix } from './mixes'
import {
  bloqueConMolestia,
  pasosConMolestia,
  type CambioDelPaso,
  type FijosConMolestia,
} from './molestia'
import { buscarMovilidad, movilidadDe } from './movilidad'
import { claseDeDia, patronDelBloque, rutinaActiva, semanaActiva } from './rutinas'
import { objetivoDelFijo, pasoDesdeEjercicio, planDeRutina, rutinaDesdeSesion } from './rutinasPropias'
import { NOMBRE_SECTOR, esSector, sugerirZona } from './sectores'
import type {
  Avance,
  Ejercicio,
  Estado,
  Objetivo,
  OrigenDeSesion,
  PasoDeRutina,
  PasoDelBorrador,
  Patron,
  Preferencias,
  RutinaPropia,
  Sector,
  Serie,
  Sesion,
  TipoSesion,
} from './tipos'

// ─── El pedido ──────────────────────────────────────────────────────────

/**
 * Lo cambiado en el Sector antes de tocar Empezar (§4.6), que viaja en el
 * `estado` del historial y no en la URL (§2.5).
 *
 * `tipos.ts` no lo define porque no se guarda en ningún lado: vale para esta
 * vez, y lo que se quiere conservar se conserva con Copiar y editar. Vive
 * acá porque acá se lee, y el Sector lo escribe con esta forma.
 */
export interface CambiosDelMix {
  /**
   * Por id de bloque (el `id` de su paso), el ejercicio que se eligió en la
   * hoja Cambiar. Los pasos de la entrada no se cambian así: la entrada tiene
   * su interruptor.
   */
  bloques?: Readonly<Record<string, string>>
  /** El interruptor de la entrada. Prendida si falta, como en `resolverMix`. */
  entrada?: boolean
}

/**
 * Lo que se pidió al abrir `/entrenar`, tal como vino: los ids y los sectores
 * todavía sin comprobar contra los datos.
 *
 * Uno solo por URL. Si vienen varios, gana el primero de este orden, que va
 * de lo más puntual a lo más general: `repetir`, `rutina`, `mix`,
 * `ejercicio`, `movilidad`, `libre`, `corta`, `fuelle`, `densa`. Ninguna
 * puerta de la app arma dos a la vez, así que el orden solo decide qué pasa
 * con una URL escrita a mano, y lo que decide es siempre lo mismo.
 */
export type PedidoDeSesion =
  | { clase: 'plan'; liviana?: true }
  | { clase: 'corta' }
  | { clase: 'fuelle' }
  | { clase: 'densa' }
  | { clase: 'rutina'; rutinaId: string; liviana?: true }
  | { clase: 'mix'; sector: string; version: VersionDeMix; cambios?: CambiosDelMix }
  | { clase: 'ejercicio'; ejercicioId: string; liviana?: true }
  | { clase: 'repetir'; sesionId: string; liviana?: true }
  | { clase: 'movilidad'; sector: string }
  | { clase: 'libre' }

/** Un objeto plano, que es lo único de lo que se puede leer un campo sin sorpresas. */
const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor)

/**
 * Lo cambiado en el Sector, si el `estado` lo trae bien formado.
 *
 * El `estado` es `history.state`: sobrevive a una recarga, pero también puede
 * llegar de una versión vieja de la app o de cualquier otra cosa que haya
 * escrito ahí. Se toma solo lo que tiene la forma esperada y el resto se
 * ignora, sin romper: un cambio que no se entiende es un cambio que no se
 * aplica. `Object.fromEntries` y no una asignación, para que una clave como
 * `__proto__` quede como dato y no toque el prototipo.
 */
function cambiosDesde(estado: unknown): CambiosDelMix | undefined {
  if (!esObjeto(estado)) return undefined
  const crudo = estado.cambiosDelMix
  if (!esObjeto(crudo)) return undefined
  const cambios: CambiosDelMix = {}
  if (typeof crudo.entrada === 'boolean') cambios.entrada = crudo.entrada
  if (esObjeto(crudo.bloques)) {
    const validos = Object.entries(crudo.bloques).filter(
      (par): par is [string, string] => typeof par[1] === 'string',
    )
    if (validos.length > 0) cambios.bloques = Object.fromEntries(validos)
  }
  return cambios.entrada === undefined && cambios.bloques === undefined ? undefined : cambios
}

const esVersion = (valor: string | null): valor is VersionDeMix =>
  valor !== null && (VERSIONES as readonly string[]).includes(valor)

/**
 * Qué se pidió, leído de la URL de `/entrenar` y del `estado` del historial
 * (§2.4).
 *
 * - **Un parámetro que vale "1"** (`corta`, `fuelle`, `densa`, `libre`,
 *   `liviana`) cuenta solo con ese valor: `?corta=0` no es la corta.
 * - **`&liviana=1`** acompaña a `/entrenar` solo, a `?rutina=`, a
 *   `?repetir=` y a `?ejercicio=`, cuyos orígenes tienen `liviana`. Con
 *   `?mix=` es la versión liviana, aunque la URL diga otra: pedir liviana es
 *   más explícito que no haber borrado el `version` de antes.
 * - **`?mix=` sin `version`**, o con una que no existe, es la completa: la
 *   zona se entendió, y la versión que no se entiende no es motivo para no
 *   armar el mix que se pidió.
 * - **`?libre=1`** queda como pedido aunque todavía no se arme (llega con el
 *   paquete L): así `planDelPedido` dice qué pasó en vez de ignorarlo.
 * - **Lo que no se reconoce no se lee:** una clave desconocida es como si no
 *   estuviera, y sin nada reconocible el pedido es el plan de hoy.
 *
 * `estado` es lo que dejó `empezar(origen, { estado })`; solo un mix lo usa.
 */
export function pedidoDesdeUrl(
  search: string | URLSearchParams,
  estado?: unknown,
): PedidoDeSesion {
  const parametros = typeof search === 'string' ? new URLSearchParams(search) : search
  const liviana = parametros.get('liviana') === '1'
  const conLiviana = liviana ? { liviana: true as const } : {}
  const valor = (clave: string) => parametros.get(clave)

  const repetir = valor('repetir')
  if (repetir !== null) return { clase: 'repetir', sesionId: repetir, ...conLiviana }
  const rutina = valor('rutina')
  if (rutina !== null) return { clase: 'rutina', rutinaId: rutina, ...conLiviana }
  const mix = valor('mix')
  if (mix !== null) {
    const pedida = valor('version')
    const version: VersionDeMix = liviana ? 'liviana' : esVersion(pedida) ? pedida : 'completa'
    const cambios = cambiosDesde(estado)
    return { clase: 'mix', sector: mix, version, ...(cambios ? { cambios } : {}) }
  }
  const ejercicio = valor('ejercicio')
  if (ejercicio !== null) return { clase: 'ejercicio', ejercicioId: ejercicio, ...conLiviana }
  const movilidad = valor('movilidad')
  if (movilidad !== null) return { clase: 'movilidad', sector: movilidad }
  if (valor('libre') === '1') return { clase: 'libre' }
  if (valor('corta') === '1') return { clase: 'corta' }
  if (valor('fuelle') === '1') return { clase: 'fuelle' }
  if (valor('densa') === '1') return { clase: 'densa' }
  return { clase: 'plan', ...conLiviana }
}

/**
 * La URL de un pedido (lo que va después de `/entrenar`), o `''` para el plan
 * de hoy.
 *
 * Es la inversa de `pedidoDesdeUrl`, salvo lo cambiado en el Sector, que no
 * va en la URL sino en el `estado`. La usa `pasosParaRepetir` para decir
 * adónde lleva Repetir con las mismas palabras que §5.6 G ("es `?rutina=`").
 */
export function busquedaDelPedido(pedido: PedidoDeSesion): string {
  const parametros = new URLSearchParams()
  switch (pedido.clase) {
    case 'plan':
      break
    case 'corta':
    case 'fuelle':
    case 'densa':
    case 'libre':
      parametros.set(pedido.clase, '1')
      break
    case 'rutina':
      parametros.set('rutina', pedido.rutinaId)
      break
    case 'mix':
      parametros.set('mix', pedido.sector)
      parametros.set('version', pedido.version)
      break
    case 'ejercicio':
      parametros.set('ejercicio', pedido.ejercicioId)
      break
    case 'repetir':
      parametros.set('repetir', pedido.sesionId)
      break
    case 'movilidad':
      parametros.set('movilidad', pedido.sector)
      break
  }
  if ('liviana' in pedido && pedido.liviana) parametros.set('liviana', '1')
  const texto = parametros.toString()
  return texto === '' ? '' : `?${texto}`
}

// ─── Lo que se arma ─────────────────────────────────────────────────────

/** Lo que hace falta para armar cualquier pedido. Todo llega de la base, leído afuera. */
export interface ContextoDelPedido {
  /** Plan o sin plan, la rutina activa y su semana, y el equipo (`equipoDe`). */
  preferencias: Pick<Preferencias, 'modoPlan' | 'rutinaActivaId' | 'semana'> & PerfilDeEquipo
  avances: ReadonlyMap<Patron, Avance>
  /** Los chequeos, para el ajuste del día (`ajusteDelDia`). */
  estados: readonly Estado[]
  /** Las sesiones guardadas: la vuelta, la doble progresión, la zona sugerida y Repetir. */
  historial: readonly Sesion[]
  /** Las rutinas propias: `?rutina=` y Repetir de una rutina que sigue existiendo. */
  rutinas: readonly Pick<RutinaPropia, 'id' | 'nombre' | 'pasos'>[]
  /** El día de la sesión, AAAA-MM-DD local: fijo desde que arranca, nunca el reloj. */
  dia: string
  /** Las cadenas con molestia (`molestiasDeLaSesion`). Sin ninguna, nada baja. */
  molestias?: ReadonlySet<Patron>
  /** Lo anotado en la sesión en curso, por id de paso: lo empezado no cambia. */
  hechas?: Readonly<Record<string, readonly Serie[]>>
  /** "Dejarlo como lo armé" (§5.6 E): `como-los-armaste`. Por defecto, la regla del plan. */
  fijos?: FijosConMolestia
  /** **Bajar también los tuyos** (§5.6 D): el chequeo también a los fijos. */
  bajarLosTuyos?: boolean
}

/**
 * La sesión que arranca: lo de §5.1 (`pasos`, `origen`, `tipo`) y lo que la
 * pantalla necesita para correrla sin volver a preguntarle nada a la URL.
 */
export interface ArranqueDeSesion {
  /**
   * En el orden en que corren, con la molestia y el chequeo ya aplicados.
   * Pueden quedar vacíos si la molestia salteó todo (`molestia` dice qué).
   */
  pasos: PasoDelBorrador[]
  /** El que se guarda en el borrador y en la sesión: exactamente un `OrigenDeSesion`. */
  origen: OrigenDeSesion
  /** Cómo la lee el motor: `plan`, `vuelta`, `corta` (nada lee) o `fuelle`. */
  tipo: TipoSesion
  /**
   * Si arranca en el bloque de fuelle. No es lo mismo que `tipo: 'fuelle'`:
   * la movilidad también se guarda como `fuelle`, para que no cuente como
   * sesión de fuerza, y no tiene bloque de fuelle.
   */
  diaDeFuelle: boolean
  /** Si es densa: la bajada después de cada eslabón y el fuelle en los descansos. */
  densa: boolean
  /**
   * Si lleva la serie de cierre. Va en el plan, la corta y la densa, como
   * siempre, y en un mix la decide su bloque opcional Cierre (`resolverMix`:
   * prendido en Completo, en los mixes que lo tienen); no va en las rutinas
   * propias, las repeticiones, un ejercicio solo, las livianas, el fuelle ni
   * la movilidad (§4.14).
   */
  cierre: boolean
  /** Lo que la molestia le cambió a cada paso, para sus líneas (`lineaDeMolestia`). */
  molestia: CambioDelPaso[]
  /**
   * El renglón de la víspera cuando lo pedido no se pudo armar y va lo de
   * siempre (`lineaDelPedido`), o `null`.
   */
  aviso: string | null
}

/** Por qué un pedido no se pudo armar tal cual. */
export type LoQueNoSeEntiende =
  | 'rutina'
  | 'rutina-vacia'
  | 'zona'
  | 'ejercicio'
  | 'movilidad-sola'
  | 'sesion'
  | 'sesion-vacia'
  | 'libre'

const LO_QUE_PASO: Record<LoQueNoSeEntiende, string> = {
  rutina: 'Esa rutina ya no está',
  'rutina-vacia': 'Esa rutina no tiene pasos para armar hoy',
  zona: 'Esa zona no está',
  ejercicio: 'Ese ejercicio no está en la app',
  'movilidad-sola': 'Una ficha de movilidad sola no arma una sesión',
  sesion: 'Esa sesión no está',
  'sesion-vacia': 'Esa sesión no tiene ejercicios para armar de nuevo',
  libre: 'La sesión libre no está en esta versión de la app',
}

/**
 * El renglón de la víspera de un pedido que no se pudo armar (§2.4): qué pasó
 * y qué va en su lugar, que es lo mismo que `/entrenar` sin parámetros.
 *
 * - Con plan, "…va el plan de hoy."; sin plan, "…va la sugerencia de hoy.",
 *   que es el mix de `sugerirZona` y no un plan que la persona no tiene.
 * - Las dos de la especificación ("Esa rutina ya no está", "Esa zona no
 *   está") se dicen tal cual; las demás siguen su forma.
 * - **Una rutina o una sesión que existen pero no dan pasos** (todos los
 *   ejercicios ya no están, una sesión del Reloj, que no se arma acá) no se
 *   dicen "ya no está": están, y lo que falta son pasos.
 * - **`?ejercicio=` con una ficha de movilidad** tampoco es "no está en la
 *   app": está, y lo que pasa es que sola no arma una sesión (ver
 *   `planDelPedido`).
 * - **`?libre=1`** antes del paquete L: la sesión libre no está en esta
 *   versión, que es exactamente lo que pasa, sin prometer cuándo llega.
 */
export function lineaDelPedido(que: LoQueNoSeEntiende, conPlan: boolean): string {
  return `${LO_QUE_PASO[que]}: va ${conPlan ? 'el plan' : 'la sugerencia'} de hoy.`
}

// ─── Lo chico que se repite ─────────────────────────────────────────────

/** Los nombres de lo rápido, los mismos que ya guardan `origenDe` y `siguiente.ts`. */
const LA_CORTA = 'Solo tengo 7 minutos'
const EL_FUELLE = 'El fuelle'
const LA_DENSA = 'Sesión densa'

/**
 * Las series de la versión liviana (§5.6 F): las mismas 2 que pone
 * `resolverMix` en un mix liviano, para que el plan, una rutina y un mix
 * livianos pidan lo mismo.
 */
const SERIES_DE_LA_LIVIANA = 2

/**
 * La cuenta del chequeo sobre un paso de cadena: la de `ajusteParaFijos`, a
 * la que se le pasa el paso como fijo para usar esa misma y no una copia (es
 * lo que hace `planDeRutina` adentro, que no la exporta).
 */
function conElFactor(paso: PasoDelBorrador, factor: number): PasoDelBorrador {
  if (factor >= 1) return paso
  const [bajado] = ajusteParaFijos([{ ...paso, clase: 'fijo' }], { factor })
  return bajado && bajado.objetivo !== paso.objetivo ? { ...paso, objetivo: bajado.objetivo } : paso
}

/**
 * Un paso en su versión liviana (§5.6 F): 2 series, con la cantidad más baja
 * entre la de hoy y lo bajo de la ventana de su ficha.
 *
 * La entrada en calor y la movilidad no cambian: no son trabajo, y "Corto y
 * Liviano conservan la entrada" (lo que se acorta es el trabajo, no la
 * preparación). Es la misma regla que `resolverMix` aplica en un mix liviano;
 * acá es para lo que no es un mix. "3 en reserva" es una indicación de la
 * pantalla: un paso no tiene dónde guardarla.
 */
function pasoLiviano(paso: PasoDelBorrador): PasoDelBorrador {
  if (paso.calentamiento || paso.clase === 'movilidad') return paso
  const ejercicio = POR_ID.get(paso.ejercicioId)
  const cantidad = ejercicio
    ? Math.min(paso.objetivo.cantidad, ejercicio.ventana.min)
    : paso.objetivo.cantidad
  return { ...paso, objetivo: { ...paso.objetivo, series: SERIES_DE_LA_LIVIANA, cantidad } }
}

/**
 * La versión liviana de unos pasos ya armados (`&liviana=1` con el plan, una
 * rutina, una repetición o un ejercicio). Se exporta para que la pantalla que
 * muestra "Versión liviana" muestre los mismos números que van a correr.
 */
export function versionLiviana(pasos: readonly PasoDelBorrador[]): PasoDelBorrador[] {
  return pasos.map(pasoLiviano)
}

/** El chequeo de hoy y si es una vuelta, que es todo lo que el día le hace a los números. */
function elDia(contexto: ContextoDelPedido): { ajuste: AjusteDelDia; vuelta: boolean } {
  return {
    ajuste: ajusteDelDia(bandaSostenida([...contexto.estados], contexto.dia)),
    vuelta: esVuelta([...contexto.historial], contexto.dia),
  }
}

/** El tipo de una sesión que lee sus pasos de cadena: `vuelta` el día de la vuelta (§5.6 B7). */
const queLee = (vuelta: boolean): TipoSesion => (vuelta ? 'vuelta' : 'plan')

/** Lo que `planDeRutina` y `pasosConMolestia` necesitan del contexto, armado una vez. */
function laMolestia(contexto: ContextoDelPedido) {
  return {
    ...(contexto.fijos ? { fijos: contexto.fijos } : {}),
    ...(contexto.hechas ? { hechas: contexto.hechas } : {}),
  }
}

/** El nombre de un ejercicio o de una ficha de movilidad, o `null` si la app no lo tiene. */
function nombreDelEjercicio(id: string): string | null {
  return POR_ID.get(id)?.nombre ?? buscarMovilidad(id)?.nombre ?? null
}

/**
 * La zona de una movilidad, como la guarda el origen: un sector, o `'todo'`.
 * `cuerpo` es la misma fila que `todo` (`movilidadDe`) y se guarda como
 * `todo`, para que la misma movilidad no tenga dos orígenes que `mismaSesion`
 * vea distintos.
 */
function zonaDeMovilidad(texto: string): Exclude<Sector, 'cuerpo'> | 'todo' | null {
  if (texto === 'todo' || texto === 'cuerpo') return 'todo'
  return esSector(texto) ? (texto as Exclude<Sector, 'cuerpo'>) : null
}

function nombreDeLaMovilidad(zona: Sector | 'todo'): string {
  return zona === 'todo' || zona === 'cuerpo'
    ? 'Movilidad de todo el cuerpo'
    : `Movilidad de ${NOMBRE_SECTOR[zona].toLowerCase()}`
}

/** El origen del plan semanal, con el nombre de la rutina activa: "Cuerpo completo". */
function origenDelPlan(contexto: ContextoDelPedido, liviana = false): OrigenDeSesion {
  return {
    clase: 'plan',
    nombre: rutinaActiva(contexto.preferencias).nombre,
    ...(liviana ? { liviana: true as const } : {}),
  }
}

// ─── El plan semanal ────────────────────────────────────────────────────

/** Cómo se arma el plan: la corta (una serie por ejercicio) o la densa (con la bajada). */
interface ComoSeArma {
  corta: boolean
  densa: boolean
}

/**
 * Los pasos del plan semanal de hoy: los bloques de la rutina activa, como
 * los armaba `usePlanDeLaSesion` (que pasa a llamar a `planDelPedido`, L0).
 *
 * Es la misma cuenta, en el mismo orden, para que la sesión del plan no
 * cambie ni un número con la reestructura:
 *
 * 1. El patrón del bloque (`patronDelBloque`, por la alternancia) y su
 *    resolución (`ejercicioDelBloque`): el eslabón del motor, volumen en el
 *    anterior o un accesorio con barra, que sin discos no va.
 * 2. La molestia (`bloqueConMolestia`), antes que nada: lo que ya tiene series
 *    anotadas no cambia. Lo bajado y lo salteado quedan en `molestia`.
 * 3. Un accesorio sigue la vara de su vez pasada, dentro de su ventana: el
 *    motor no lo progresa, y la doble progresión la lleva la persona.
 * 4. La corta es una serie por ejercicio; el chequeo y la vuelta bajan la
 *    cantidad de todos los bloques, como siempre en el plan.
 * 5. En la densa, la bajada del eslabón anterior después de cada eslabón del
 *    motor, con su descanso corto; un accesorio o un bloque bajado por
 *    molestia no llevan bajada encima.
 * 6. Sin ejercicios repetidos (`sinEjerciciosRepetidos`).
 *
 * Cada paso lleva como id el de su ejercicio: es la clave con la que los
 * borradores de antes ya tienen sus series en `hechas` (`normalizarBorrador`),
 * así un borrador a medio hacer de antes de la actualización encuentra sus
 * series. La clase es la que `normalizarBorrador` le daría a ese paso: el
 * eslabón del motor es `cadena`, y lo que se guarda con `bajada` (el volumen,
 * el accesorio, lo bajado por molestia y la bajada de la densa) es `volumen`.
 */
function pasosDelPlan(
  contexto: ContextoDelPedido,
  como: ComoSeArma,
): { pasos: PasoDelBorrador[]; molestia: CambioDelPaso[] } {
  const { preferencias, avances, dia } = contexto
  const rutina = rutinaActiva(preferencias)
  const semana = semanaActiva(preferencias)
  const fecha = fechaDelDia(dia)
  const historial = [...contexto.historial]
  const hechas = contexto.hechas ?? {}
  const molestias = contexto.molestias ?? new Set<Patron>()
  const { ajuste, vuelta } = elDia(contexto)
  const factor = ajuste.factor * (vuelta ? RECORTE_DE_VUELTA : 1)
  const tieneBarraCargable = (preferencias.cargaMaximaKg ?? 0) > 0
  const molestia: CambioDelPaso[] = []

  type Entrada = { ejercicio: Ejercicio; bajada: boolean; paso: PasoDelBorrador }
  const entradas = rutina.bloques.flatMap((delPlan): Entrada[] => {
    const patron = patronDelBloque(delPlan, semana, fecha)
    const cadena = cadenaDe(patron)
    const avance = avances.get(patron)
    const resuelto = ejercicioDelBloque({ ...delPlan, patron }, avance, POR_ID, cadena, {
      tieneBarraCargable,
    })
    if (!resuelto || !avance) return []

    const delBloque = resuelto.ejercicio.id
    const hoy = bloqueConMolestia(resuelto, molestias, POR_ID, cadena, {
      yaEmpezado: (hechas[delBloque]?.length ?? 0) > 0,
    })
    if (hoy.cambio === 'saltea') {
      molestia.push({ paso: delBloque, patron, cambio: 'saltea', de: delBloque, fijo: false })
      return []
    }
    const porMolestia = hoy.cambio === 'baja'
    if (porMolestia) {
      molestia.push({
        paso: hoy.ejercicio.id,
        patron,
        cambio: 'baja',
        de: delBloque,
        a: hoy.ejercicio.id,
        fijo: false,
      })
    }

    const { ejercicio, accesorio } = hoy
    const vara = accesorio ? laVezPasada(historial, ejercicio.id, dia) : null
    const base: Objetivo = vara
      ? {
          series: hoy.objetivo.series,
          cantidad: Math.min(Math.max(vara.mejor, ejercicio.ventana.min), ejercicio.ventana.max),
          ...(vara.kg !== undefined ? { kg: vara.kg } : {}),
        }
      : hoy.objetivo
    const bajada = accesorio || porMolestia
    const duro = conElFactor(
      {
        id: ejercicio.id,
        ejercicioId: ejercicio.id,
        objetivo: { ...base, series: como.corta ? 1 : base.series },
        clase: bajada ? 'volumen' : 'cadena',
        seccion: 'principal',
        ...(bajada ? { bajada: true as const } : {}),
      },
      factor,
    )
    const entrada: Entrada[] = [{ ejercicio, bajada, paso: duro }]

    if (!como.densa || bajada) return entrada
    const abajo = bajadaDe(ejercicio, cadena, POR_ID)
    if (!abajo) return entrada
    return [
      ...entrada,
      {
        ejercicio: abajo.ejercicio,
        bajada: true,
        paso: {
          id: abajo.ejercicio.id,
          ejercicioId: abajo.ejercicio.id,
          objetivo: abajo.objetivo,
          clase: 'volumen',
          seccion: 'principal',
          bajada: true,
          descansoSegundos: DESCANSO_DE_BAJADA,
        },
      },
    ]
  })

  return { pasos: sinEjerciciosRepetidos(entradas).map((e) => e.paso), molestia }
}

/** Una sesión del plan semanal, armada de una de sus formas. */
function delPlan(
  contexto: ContextoDelPedido,
  origen: OrigenDeSesion,
  forma: 'fuerza' | 'densa' | 'fuelle' | 'corta' | 'liviana',
): ArranqueDeSesion {
  const { vuelta } = elDia(contexto)
  const { pasos, molestia } = pasosDelPlan(contexto, {
    corta: forma === 'corta',
    densa: forma === 'densa',
  })
  const comun = { origen, molestia, aviso: null }
  switch (forma) {
    case 'fuerza':
      return { ...comun, pasos, tipo: queLee(vuelta), diaDeFuelle: false, densa: false, cierre: true }
    case 'densa':
      return { ...comun, pasos, tipo: queLee(vuelta), diaDeFuelle: false, densa: true, cierre: true }
    case 'fuelle':
      // Los pasos de fuerza van como siempre en un día de fuelle: la sesión
      // arranca en el bloque y termina en las preguntas, así que no corren, y
      // un borrador vencido que se guarda sin series no deja ningún registro.
      return { ...comun, pasos, tipo: 'fuelle', diaDeFuelle: true, densa: false, cierre: false }
    case 'corta':
      return { ...comun, pasos, tipo: 'corta', diaDeFuelle: false, densa: false, cierre: true }
    case 'liviana':
      return {
        ...comun,
        pasos: versionLiviana(pasos),
        tipo: 'corta',
        diaDeFuelle: false,
        densa: false,
        cierre: false,
      }
  }
}

// ─── Lo que no es el plan ───────────────────────────────────────────────

/**
 * Unos pasos de rutina como sesión: los de una rutina propia, los de una
 * repetición o el de un ejercicio solo.
 *
 * `planDeRutina` arma con el chequeo, la vuelta y **Bajar también los
 * tuyos**; la molestia va después, con `pasosConMolestia`, para quedarse con
 * lo que cambió (`planDeRutina` aplica la misma, pero devuelve solo los
 * pasos). La liviana, al final: es un tope, y da lo mismo antes o después de
 * la molestia, que ya deja lo bajado en 2 series al piso.
 *
 * Si no queda ningún paso que se pueda armar hoy (todos con ids que la app ya
 * no tiene, una rutina vacía, un volumen en el primer eslabón), no arranca una
 * sesión vacía: va lo de siempre con el renglón que lo dice.
 */
function dePasos(
  pasos: readonly PasoDeRutina[],
  origen: OrigenDeSesion,
  liviana: boolean,
  siNoQuedaNada: LoQueNoSeEntiende,
  contexto: ContextoDelPedido,
): ArranqueDeSesion {
  const { ajuste, vuelta } = elDia(contexto)
  const armados = planDeRutina(
    { pasos: [...pasos] },
    {
      avances: contexto.avances,
      historial: contexto.historial,
      ajuste,
      vuelta,
      bajarLosTuyos: contexto.bajarLosTuyos === true,
    },
  )
  if (armados.length === 0) return noSeEntiende(siNoQuedaNada, contexto)
  const conMolestia = pasosConMolestia(armados, contexto.molestias, laMolestia(contexto))
  return {
    pasos: liviana ? versionLiviana(conMolestia.pasos) : conMolestia.pasos,
    origen,
    tipo: liviana ? 'corta' : queLee(vuelta),
    diaDeFuelle: false,
    densa: false,
    cierre: false,
    molestia: conMolestia.cambios,
    aviso: null,
  }
}

/** Lo que `conCambiosDelMix` necesita además de los pasos. */
export interface ContextoDeLosCambios {
  version: VersionDeMix
  /** Para la doble progresión del ejercicio elegido (`objetivoDelFijo`). */
  historial: readonly Sesion[]
}

/**
 * Los pasos de un mix con lo cambiado en el Sector (§4.6).
 *
 * - **Un bloque cambiado** queda con el ejercicio elegido, como paso fijo: un
 *   paso de cadena cambiado por otro ejercicio pasa a fijo (§4.14), aunque el
 *   elegido sea tu eslabón, porque ya hay otro paso que lee esa cadena o el
 *   mix no la eligió para leerla. Conserva su id, su sección y las series que
 *   el bloque tiene en esta versión; la cantidad es la de un fijo de un mix:
 *   la doble progresión (`objetivoDelFijo`) dentro de la ventana de su ficha
 *   (la misma regla que `resolverMix` aplica a sus variantes), y en Liviano,
 *   al piso. El descanso es el de su ficha: el del bloque era del ejercicio
 *   de antes.
 * - **Volver al ejercicio que el mix había puesto** no es ningún cambio.
 * - **La entrada no se cambia así** (tiene su interruptor, que va en
 *   `resolverMix`), y un id de bloque que no está en el mix o un ejercicio que
 *   la app no tiene no cambian nada.
 *
 * Se exporta para que el Sector muestre los mismos números que va a correr la
 * sesión: si los armaran dos funciones, el Sector prometería una cosa y la
 * sesión haría otra.
 */
export function conCambiosDelMix(
  pasos: readonly PasoDelBorrador[],
  cambios: CambiosDelMix | undefined,
  contexto: ContextoDeLosCambios,
): PasoDelBorrador[] {
  const bloques = cambios?.bloques
  if (!bloques) return [...pasos]
  return pasos.map((paso) => {
    if (paso.id === undefined || paso.seccion === 'entrada' || paso.calentamiento) return paso
    if (!Object.hasOwn(bloques, paso.id)) return paso
    const elegido = bloques[paso.id]
    if (elegido === undefined || elegido === paso.ejercicioId) return paso
    const nuevo = pasoDesdeEjercicio(elegido, { id: paso.id, seccion: paso.seccion ?? 'principal' })
    if (!nuevo) return paso
    const series = nuevo.clase === 'movilidad' ? nuevo.series : paso.objetivo.series
    const [armado] = planDeRutina(
      { pasos: [{ ...nuevo, series }] },
      { avances: new Map(), historial: contexto.historial },
    )
    if (!armado) return paso
    const ejercicio = POR_ID.get(armado.ejercicioId)
    const enLaVentana =
      armado.clase === 'fijo' && ejercicio
        ? {
            ...armado,
            objetivo: {
              ...armado.objetivo,
              cantidad: Math.min(
                ejercicio.ventana.max,
                Math.max(ejercicio.ventana.min, armado.objetivo.cantidad),
              ),
            },
          }
        : armado
    return contexto.version === 'liviana' ? pasoLiviano(enLaVentana) : enLaVentana
  })
}

/** Un paso con otra cantidad, lo demás como estaba. */
const conCantidad = (paso: PasoDelBorrador, cantidad: number): PasoDelBorrador => ({
  ...paso,
  objetivo: { ...paso.objetivo, cantidad },
})

/** Lo que el día le hace a un mix liviano: el factor de los pasos de cadena y, si se pidió, el de los fijos. */
interface ElDiaDelLiviano {
  avances: ReadonlyMap<Patron, Avance>
  historial: readonly Sesion[]
  /** El del chequeo por el de la vuelta, como en el plan: el de los pasos de cadena. */
  factor: number
  /** **Bajar también los tuyos**: el del chequeo para los fijos, o `null` si no se tocó. */
  losTuyos: number | null
}

/**
 * Un paso de un mix liviano con el día aplicado en el orden del plan y de una
 * rutina livianos: primero el chequeo y la vuelta sobre el número de hoy,
 * después el piso de la liviana (§5.6 F, "la cantidad más baja entre la de
 * hoy y lo bajo de la ventana").
 *
 * `resolverMix` entrega el liviano ya al piso, y el piso se come el número de
 * hoy. Bajar por el chequeo lo que ya estaba al piso cortaba dos veces: con
 * plancha en 3 × 30 (ventana de 15 a 30) y un chequeo de 0,9, el plan liviano
 * baja 30 a 27 y lo lleva al piso, 15, pero el mix bajaba el 15 a 14, debajo
 * de la ventana y de lo que pedía el plan ese mismo día. Por eso el número de
 * hoy se vuelve a tomar de donde sale, y recién después va el piso:
 *
 * - **Un paso de cadena**, del objetivo del motor: el del avance cuyo eslabón
 *   es ese ejercicio, que es de donde lo sacó `resolverMix`.
 * - **Un fijo, con Bajar también los tuyos**, de su doble progresión dentro
 *   de la ventana de la ficha, la misma cuenta de `resolverMix` y de
 *   `conCambiosDelMix` (`objetivoDelFijo`, acotado por arriba y por abajo).
 *
 * La entrada, la movilidad y el volumen no llevan el día, como en el plan, y
 * quedan como vinieron; un paso que no cambia de número es el mismo paso.
 */
function livianoConElDia(paso: PasoDelBorrador, dia: ElDiaDelLiviano): PasoDelBorrador {
  const ejercicio = POR_ID.get(paso.ejercicioId)
  if (!ejercicio || paso.calentamiento) return paso
  let deHoy: PasoDelBorrador
  if (paso.clase === 'cadena') {
    // Sin avance no hay paso de cadena en un mix (`resolverMix` no lo arma);
    // si faltara, el número de hoy es el que trae el paso.
    const avance = [...dia.avances.values()].find((a) => a.ejercicioId === paso.ejercicioId)
    const delMotor = avance?.objetivoActual.cantidad ?? paso.objetivo.cantidad
    deHoy = conElFactor(conCantidad(paso, delMotor), dia.factor)
  } else if (paso.clase === 'fijo' && dia.losTuyos !== null) {
    const { min, max } = ejercicio.ventana
    const subido = objetivoDelFijo({ series: paso.objetivo.series }, ejercicio, dia.historial).cantidad
    deHoy = conElFactor(conCantidad(paso, Math.min(max, Math.max(min, subido))), dia.losTuyos)
  } else {
    return paso
  }
  const cantidad = Math.min(deHoy.objetivo.cantidad, ejercicio.ventana.min)
  return cantidad === paso.objetivo.cantidad ? paso : conCantidad(paso, cantidad)
}

/**
 * El mix de una zona como sesión (§6.3): `resolverMix` con tu nivel y tu
 * equipo, lo cambiado en el Sector, el chequeo y la vuelta en los pasos de
 * cadena (§5.6 D), **Bajar también los tuyos** en los fijos y la molestia al
 * final, igual que en una rutina.
 *
 * En Liviano el día va antes del piso de la liviana, como en el plan y en
 * una rutina livianos (`livianoConElDia`): los tres piden lo mismo el mismo
 * día. En Completo y Corto no hay ese piso, y el día baja el número que trae
 * cada paso, que ya es el de hoy.
 *
 * Con plan semanal, el mix recibe la rutina activa, para que el Cuerpo
 * completo complete lo que la semana dejó atrás. Liviano se guarda como
 * `corta` y no lee nada; Completo y Corto leen sus pasos de cadena.
 */
function delMix(
  sector: Sector,
  version: VersionDeMix,
  cambios: CambiosDelMix | undefined,
  contexto: ContextoDelPedido,
): ArranqueDeSesion {
  const { preferencias, avances, historial, dia } = contexto
  const conPlan = planSemanal(preferencias) !== null
  const { ajuste, vuelta } = elDia(contexto)
  const factor = ajuste.factor * (vuelta ? RECORTE_DE_VUELTA : 1)
  const mix = resolverMix(sector, version, {
    avances,
    equipo: equipoDe(preferencias),
    historial,
    hoy: dia,
    plan: conPlan ? rutinaActiva(preferencias) : null,
    ...(cambios?.entrada !== undefined ? { entrada: cambios.entrada } : {}),
  })

  const cambiados = conCambiosDelMix(mix.pasos, cambios, { version, historial })
  let pasos: PasoDelBorrador[]
  if (version === 'liviana') {
    const delDia: ElDiaDelLiviano = {
      avances,
      historial,
      factor,
      losTuyos: contexto.bajarLosTuyos ? ajuste.factor : null,
    }
    pasos = cambiados.map((paso) => livianoConElDia(paso, delDia))
  } else {
    pasos = cambiados.map((paso) => (paso.clase === 'cadena' ? conElFactor(paso, factor) : paso))
    if (contexto.bajarLosTuyos) pasos = ajusteParaFijos(pasos, ajuste)
  }
  const conMolestia = pasosConMolestia(pasos, contexto.molestias, laMolestia(contexto))

  return {
    pasos: conMolestia.pasos,
    origen: { clase: 'mix', sector, nombre: MIX_POR_SECTOR[sector].nombre, version },
    tipo: version === 'liviana' ? 'corta' : queLee(vuelta),
    diaDeFuelle: false,
    densa: false,
    cierre: mix.cierre,
    molestia: conMolestia.cambios,
    aviso: null,
  }
}

/**
 * La movilidad de una zona (§6.4): todas sus fichas, también las de
 * `despues`, en el orden de la tabla y con la dosis de cada ficha.
 *
 * Se guarda como `fuelle`, como el resto de lo que no lee ninguna cadena ni
 * cuenta como fuerza, con `origen.clase === 'movilidad'`, que es lo que mira
 * `cuentaComoSesion` para no contarla (§5.6 A). No tiene bloque de fuelle,
 * serie de cierre ni molestia: ninguna ficha carga una cadena.
 */
function deMovilidad(zona: Exclude<Sector, 'cuerpo'> | 'todo', contexto: ContextoDelPedido): ArranqueDeSesion {
  const pasos = movilidadDe(zona)
    .map((ficha) => pasoDesdeEjercicio(ficha.id, { id: ficha.id, seccion: 'principal' }))
    .filter((paso): paso is PasoDeRutina => paso !== null)
  return {
    pasos: planDeRutina({ pasos }, { avances: contexto.avances, historial: contexto.historial }),
    origen: { clase: 'movilidad', sector: zona, nombre: nombreDeLaMovilidad(zona) },
    tipo: 'fuelle',
    diaDeFuelle: false,
    densa: false,
    cierre: false,
    molestia: [],
    aviso: null,
  }
}

// ─── /entrenar sin parámetros ───────────────────────────────────────────

/**
 * Lo que arma `/entrenar` sin parámetros (§2.4), o con `?liviana=1` solo.
 *
 * - **Con plan**, el plan de hoy según la clase del día: un día de fuelle
 *   arranca en el bloque, uno de las dos es la densa, y un día de descanso es
 *   la sesión de fuerza de tu rutina, porque entrenar un día de más no puede
 *   quedar sin plan.
 * - **Sin plan**, la sugerencia de Hoy: el mix completo de `sugerirZona`, que
 *   el primer día es el Cuerpo completo.
 * - **Liviana**, la misma en su versión liviana. Con plan es la de fuerza
 *   también en un día de fuelle o de las dos, como la corta: la versión
 *   liviana baja los pasos, y un bloque de fuelle no tiene pasos que bajar.
 *   Sin plan, `?mix=<sugerida>&version=liviana`.
 */
function deHoy(contexto: ContextoDelPedido, liviana: boolean): ArranqueDeSesion {
  const semana = planSemanal(contexto.preferencias)
  if (semana === null) {
    const sector = sugerirZona(
      [...contexto.historial],
      contexto.dia,
      equipoDe(contexto.preferencias),
    )
    return delMix(sector, liviana ? 'liviana' : 'completa', undefined, contexto)
  }
  if (liviana) return delPlan(contexto, origenDelPlan(contexto, true), 'liviana')
  const clase = claseDeDia(semana, fechaDelDia(contexto.dia))
  const forma = clase === 'fuelle' ? 'fuelle' : clase === 'ambos' ? 'densa' : 'fuerza'
  return delPlan(contexto, origenDelPlan(contexto), forma)
}

/** Lo mismo que sin parámetros, con el renglón que dice por qué (§2.4). */
function noSeEntiende(que: LoQueNoSeEntiende, contexto: ContextoDelPedido): ArranqueDeSesion {
  const conPlan = planSemanal(contexto.preferencias) !== null
  return { ...deHoy(contexto, false), aviso: lineaDelPedido(que, conPlan) }
}

// ─── El pedido, armado ──────────────────────────────────────────────────

/**
 * La sesión de un pedido: sus pasos, su `origen` y su `tipo` (§2.4, §5.1).
 *
 * - **`/entrenar`**: el plan de hoy o, sin plan, la sugerencia (`deHoy`).
 * - **`?corta=1`**: "Solo tengo 7 minutos", desde la rutina activa, con plan
 *   o sin plan y cualquier día, también uno de fuelle: es `corta`, una serie
 *   por ejercicio y no lee nada.
 * - **`?fuelle=1` · `?densa=1`**: el origen es el plan si hoy el plan dice
 *   eso mismo (fuelle, o las dos); si no, es la rápida de RÁPIDAS.
 * - **`?rutina=`**: sus pasos (`planDeRutina`), y solo los de cadena leen.
 * - **`?mix=`**: el mix resuelto con lo cambiado en el Sector.
 * - **`?ejercicio=`**: ese solo; tu eslabón actual entra como paso de cadena
 *   con el objetivo del motor, otro como fijo con `objetivoDelFijo`
 *   (`pasoDesdeEjercicio`). Una ficha de movilidad sola no arma una sesión
 *   (no hay una de movilidad que no sea la de una zona) y va lo de siempre,
 *   con su renglón.
 * - **`?repetir=`**: lo de `pasosParaRepetir`: la puerta de donde salió, o
 *   sus registros rearmados, con `origen: repetir`.
 * - **`?movilidad=`**: la de esa zona, como `fuelle` que no cuenta.
 * - **`&liviana=1`**: lo mismo en versión liviana, como `corta`, con
 *   `liviana: true` en el origen.
 * - **`?libre=1`**, hasta el paquete L, y **todo lo que no se puede armar**
 *   (una rutina que no existe, un sector inventado, una sesión borrada): lo
 *   mismo que sin parámetros, con `aviso` (`lineaDelPedido`).
 *
 * El chequeo, la vuelta y la molestia bajan los pasos de cadena venga de donde
 * venga la sesión (§5.6 D y E); los fijos, solo con `bajarLosTuyos` y
 * con la molestia según `fijos`.
 */
export function planDelPedido(
  pedido: PedidoDeSesion,
  contexto: ContextoDelPedido,
): ArranqueDeSesion {
  const semana = planSemanal(contexto.preferencias)
  const hoy = semana === null ? null : claseDeDia(semana, fechaDelDia(contexto.dia))
  const liviana = 'liviana' in pedido && pedido.liviana === true
  const conLiviana = liviana ? { liviana: true as const } : {}

  switch (pedido.clase) {
    case 'plan':
      return deHoy(contexto, liviana)

    case 'corta':
      return delPlan(contexto, { clase: 'rapida', cual: 'corta', nombre: LA_CORTA }, 'corta')

    case 'fuelle': {
      const origen: OrigenDeSesion =
        hoy === 'fuelle' ? origenDelPlan(contexto) : { clase: 'rapida', cual: 'fuelle', nombre: EL_FUELLE }
      return delPlan(contexto, origen, 'fuelle')
    }

    case 'densa': {
      const origen: OrigenDeSesion =
        hoy === 'ambos' ? origenDelPlan(contexto) : { clase: 'rapida', cual: 'densa', nombre: LA_DENSA }
      return delPlan(contexto, origen, 'densa')
    }

    case 'rutina': {
      const rutina = contexto.rutinas.find((r) => r.id === pedido.rutinaId)
      if (!rutina) return noSeEntiende('rutina', contexto)
      return dePasos(
        rutina.pasos,
        { clase: 'rutina', rutinaId: rutina.id, nombre: rutina.nombre, ...conLiviana },
        liviana,
        'rutina-vacia',
        contexto,
      )
    }

    case 'mix':
      if (!esSector(pedido.sector)) return noSeEntiende('zona', contexto)
      return delMix(pedido.sector, pedido.version, pedido.cambios, contexto)

    case 'ejercicio': {
      // Una ficha de movilidad no arma sola una sesión: entrar como "ese
      // ejercicio solo" la guardaría con `tipo: 'plan'` y `origen: ejercicio`,
      // y cinco minutos de movilidad contarían como sesión, día e hito (§5.6
      // A, Decisión 55). La única sesión de movilidad es la de una zona, con
      // `origen: movilidad`, y no se puede elegir desde una ficha: gato y vaca
      // está en la de tres zonas, e isquiotibiales con toalla en la de
      // ninguna (`MOVILIDAD_POR_SECTOR`). Va lo de siempre, con el renglón que
      // dice qué pasó.
      if (buscarMovilidad(pedido.ejercicioId)) return noSeEntiende('movilidad-sola', contexto)
      const nombre = nombreDelEjercicio(pedido.ejercicioId)
      const paso = pasoDesdeEjercicio(pedido.ejercicioId, {
        id: pedido.ejercicioId,
        avances: contexto.avances,
      })
      if (nombre === null || !paso) return noSeEntiende('ejercicio', contexto)
      return dePasos(
        [paso],
        { clase: 'ejercicio', ejercicioId: pedido.ejercicioId, nombre, ...conLiviana },
        liviana,
        'ejercicio',
        contexto,
      )
    }

    case 'repetir': {
      const sesion = contexto.historial.find((s) => s.id === pedido.sesionId)
      if (!sesion) return noSeEntiende('sesion', contexto)
      const repeticion = repeticionDe(sesion, contexto.rutinas, contexto.historial, liviana)
      if (repeticion.clase === 'ir') return planDelPedido(repeticion.pedido, contexto)
      return dePasos(repeticion.pasos, repeticion.origen, repeticion.liviana, 'sesion-vacia', contexto)
    }

    case 'movilidad': {
      const zona = zonaDeMovilidad(pedido.sector)
      if (zona === null) return noSeEntiende('zona', contexto)
      return deMovilidad(zona, contexto)
    }

    case 'libre':
      return noSeEntiende('libre', contexto)
  }
}

// ─── Repetir ────────────────────────────────────────────────────────────

/** Si el origen guardado era la versión liviana de algo. */
function eraLiviana(origen: OrigenDeSesion): boolean {
  return 'liviana' in origen && origen.liviana === true
}

/** Repetir, por adentro: la puerta adonde lleva, o los pasos de rutina de la sesión. */
type RepeticionInterna =
  | { clase: 'ir'; pedido: PedidoDeSesion }
  | { clase: 'pasos'; pasos: PasoDeRutina[]; origen: OrigenDeSesion; liviana: boolean }

/**
 * Lo que hace Repetir con una sesión (§5.6 G, §4.4).
 *
 * Lleva a la puerta de donde salió cuando esa puerta sigue armando lo mismo
 * con tu nivel de hoy:
 *
 * - **Una rutina que existe**, a `?rutina=`: si la editaste, se repite como
 *   está ahora, que es lo que la persona espera de "su" rutina.
 * - **Un mix**, a `?mix=` con su versión.
 * - **Un ejercicio** que la app tiene, a `?ejercicio=`.
 * - **Una movilidad**, a `?movilidad=` (§4.4).
 * - **Un fuelle**, a `?fuelle=1`: el de RÁPIDAS y el de un día de fuelle del
 *   plan (una sesión vieja de ese día se guardaba como plan con `tipo:
 *   'fuelle'`). Su trabajo son las ráfagas y no deja registros, así que
 *   rearmarlo no daría nada; repetirlo es hacer el fuelle de nuevo. La sesión
 *   del fuelle de RÁPIDAS no muestra Repetir (§4.4), así que esto solo pasa
 *   con una URL escrita a mano.
 *
 * Todo lo demás (el plan de otro día, una sesión libre, una rutina borrada,
 * una repetición, "Solo tengo 7 minutos" y la densa) se rearma con sus
 * registros y se guarda con `origen: repetir` (§5.6 G, §2.4), con las cinco
 * reglas de "Guardar como rutina": las toma de `rutinaDesdeSesion` y no de
 * una copia, así las dos puertas no pueden diferir (Decisión 58). La corta y
 * la densa no van a la suya: esa puerta arma la de hoy desde la rutina activa,
 * y si la rutina cambió, Repetir daría otros ejercicios. Rearmadas, son los
 * mismos ejercicios con tu nivel de hoy, y sus pasos de cadena leen, como
 * dice §2.4 de toda repetición.
 *
 * Lo que era liviano se repite liviano: es la misma sesión. Y `liviana`
 * (Versión liviana, §4.4) pide la liviana de lo que sea; en un mix, su
 * versión Liviano. El fuelle y la movilidad no tienen versión liviana y van
 * como son.
 */
function repeticionDe(
  sesion: Sesion,
  rutinas: readonly Pick<RutinaPropia, 'id'>[],
  historial: readonly Sesion[],
  liviana: boolean,
): RepeticionInterna {
  const origen = origenDe(sesion)
  const livianaTambien = liviana || eraLiviana(origen)
  const conLiviana = livianaTambien ? { liviana: true as const } : {}
  const ir = (pedido: PedidoDeSesion): RepeticionInterna => ({ clase: 'ir', pedido })

  switch (origen.clase) {
    case 'rutina':
      if (rutinas.some((r) => r.id === origen.rutinaId)) {
        return ir({ clase: 'rutina', rutinaId: origen.rutinaId, ...conLiviana })
      }
      break
    case 'mix':
      return ir({ clase: 'mix', sector: origen.sector, version: liviana ? 'liviana' : origen.version })
    case 'ejercicio':
      if (nombreDelEjercicio(origen.ejercicioId) !== null) {
        return ir({ clase: 'ejercicio', ejercicioId: origen.ejercicioId, ...conLiviana })
      }
      break
    case 'movilidad':
      return ir({ clase: 'movilidad', sector: origen.sector })
    case 'rapida':
      if (origen.cual === 'fuelle') return ir({ clase: 'fuelle' })
      break
    case 'plan':
      if (sesion.tipo === 'fuelle') return ir({ clase: 'fuelle' })
      break
    case 'repetir':
    case 'libre':
      break
  }

  // El id de la rutina es el de la sesión: da ids de paso únicos y estables
  // (`<sesion>-p1`, `-p2`…), que son las claves de `hechas` al retomar.
  const pasos = rutinaDesdeSesion(sesion, {
    id: sesion.id,
    ahora: sesion.finalizadaEn,
    nombre: origen.nombre,
    historial,
  }).pasos
  return {
    clase: 'pasos',
    pasos,
    origen: { clase: 'repetir', sesionId: sesion.id, nombre: origen.nombre, ...conLiviana },
    liviana: livianaTambien,
  }
}

/** Lo que devuelve Repetir. */
export type Repeticion =
  /** Va a otra puerta: `pedido` es lo que se arma y `busqueda`, su URL. */
  | { clase: 'ir'; pedido: PedidoDeSesion; busqueda: string }
  /** Se rearma con los registros: los pasos con tu nivel de hoy y el origen que se guarda. */
  | { clase: 'pasos'; pasos: PasoDelBorrador[]; origen: OrigenDeSesion }

/** Lo que Repetir mira además de la sesión. */
export interface OpcionesDeRepetir {
  /** Las rutinas propias: una que ya no está no se puede repetir como rutina. */
  rutinas?: readonly Pick<RutinaPropia, 'id'>[]
  /** Las sesiones guardadas, para la doble progresión de lo que vuelve fijo. */
  historial?: readonly Sesion[]
  /** **Versión liviana** (§4.4). */
  liviana?: boolean
}

/**
 * Repetir una sesión con tu nivel de hoy (§5.6 G): adónde lleva o, si se
 * rearma con sus registros, sus pasos.
 *
 * Las reglas de los registros son las de `rutinaDesdeSesion`:
 *
 * 1. La entrada en calor y el Reloj no vuelven, y de lo que vuelve se sacan
 *    las series de cierre.
 * 2. Lo guardado con `bajada` vuelve como volumen de su cadena.
 * 3. Lo guardado como fijo, o lo que no está en `CADENAS`, vuelve fijo con su
 *    ejercicio y `objetivoDelFijo`.
 * 4. El primer registro de cada cadena vuelve como paso de cadena, con tu
 *    eslabón y el objetivo de hoy; otro de la misma cadena, fijo.
 * 5. La movilidad vuelve en Entrada, con la dosis de su ficha.
 *
 * Los pasos van sin el chequeo ni la molestia de hoy: esos los pone
 * `planDelPedido` al arrancar, que es donde se sabe qué pidió la persona.
 * Una sesión de la que no vuelve nada (una del Reloj) da pasos vacíos, y
 * `planDelPedido` arma lo de siempre con su renglón.
 *
 * `avances` es lo de §5.1; lo demás va en `opciones`, porque sin las rutinas
 * no se puede saber si la de la sesión sigue existiendo, ni sin el historial
 * cuánto subió un fijo. Sin ellas, la rutina cuenta como borrada y el fijo
 * sube desde la sesión misma.
 */
export function pasosParaRepetir(
  sesion: Sesion,
  avances: ReadonlyMap<Patron, Avance>,
  opciones: OpcionesDeRepetir = {},
): Repeticion {
  const historial = opciones.historial ?? []
  const conLaSesion = historial.some((s) => s.id === sesion.id) ? historial : [...historial, sesion]
  const repeticion = repeticionDe(sesion, opciones.rutinas ?? [], conLaSesion, opciones.liviana === true)
  if (repeticion.clase === 'ir') {
    return { clase: 'ir', pedido: repeticion.pedido, busqueda: busquedaDelPedido(repeticion.pedido) }
  }
  const pasos = planDeRutina({ pasos: repeticion.pasos }, { avances, historial: conLaSesion })
  return {
    clase: 'pasos',
    pasos: repeticion.liviana ? versionLiviana(pasos) : pasos,
    origen: repeticion.origen,
  }
}
