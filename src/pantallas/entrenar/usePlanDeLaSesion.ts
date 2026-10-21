/**
 * Lo que la sesión pide: los ejercicios, el bloque de fuelle y la clase de
 * sesión.
 *
 * Son cuentas y no estado. Entra lo que se leyó de la base y lo que la sesión
 * ya hizo, y sale el plan. Viven juntas porque se alimentan entre sí —el fuelle
 * se dimensiona con los minutos del plan, y el plan depende del tipo de
 * sesión— y ninguna escribe nada: lo que se guarda lo decide `Entrenar`.
 */

import { useMemo } from 'react'
import { POR_ID, cadenaDe } from '@/dominio/biblioteca'
import { patronDelBloque } from '@/dominio/rutinas'
import { ajusteDelDia, bandaSostenida, cadenasCongeladas } from '@/dominio/estado'
import { avisosDeMolestia, bloqueConMolestia, type CambioPorMolestia } from '@/dominio/molestia'
import { seAbreHoy } from '@/dominio/anticipacion'
import { eslabonesCerrados } from '@/dominio/apertura'
import { mueveElPlan } from '@/dominio/progresion'
import {
  DESCANSO_DE_BAJADA,
  bajadaDe,
  ejercicioDelBloque,
  minutosDeSesion,
  sinEjerciciosRepetidos,
} from '@/dominio/bajada'
import {
  bloqueDeFuelle,
  minutosDelBloque,
  minutosDelDiaDeFuelle,
  type Densidad,
  type Equipo,
  type PasoDeFuelle,
} from '@/dominio/metabolico'
import { esVuelta, RECORTE_DE_VUELTA } from '@/dominio/adherencia'
import { laVezPasada } from '@/dominio/estadisticas'
import type {
  Avance,
  Estado,
  PasoDelBorrador,
  Patron,
  Preferencias,
  Rutina,
  Semana,
  Serie,
  Sesion,
  TipoSesion,
} from '@/dominio/tipos'

export function usePlanDeLaSesion({
  preferencias,
  avances,
  estados,
  historial,
  rutina,
  semana,
  dia,
  fechaDeLaSesion,
  esCorta,
  esDiaDeFuelle,
  esDiaDenso,
  molestias,
  hechas,
}: {
  preferencias: Preferencias | undefined
  avances: Map<Patron, Avance> | undefined
  estados: Estado[] | undefined
  historial: Sesion[] | undefined
  rutina: Rutina | null
  semana: Semana | null
  /** El día de la sesión, fijo desde que arranca: nunca el reloj. */
  dia: string
  fechaDeLaSesion: Date
  esCorta: boolean
  esDiaDeFuelle: boolean
  esDiaDenso: boolean
  molestias: ReadonlySet<Patron>
  hechas: Record<string, Serie[]>
}) {
  /**
   * Cuánto aprieta el fuelle, y con qué cuenta donde entrena.
   *
   * `densidad` dice cuán FUERTE, ya no en qué días: eso lo decide la clase del
   * día. El respaldo es suave y no apagada porque un día marcado con fuelle por
   * alguien que nunca abrió Ajustes tiene que traer algo, y suave es la única
   * densidad que no supone ni que puede saltar ni que tiene un cajón.
   */
  const densidad: Densidad =
    preferencias?.densidad === undefined || preferencias.densidad === 'apagada'
      ? 'suave'
      : preferencias.densidad
  const equipo: Equipo = useMemo(
    () => ({
      ...(preferencias?.puedeSaltar !== undefined ? { puedeSaltar: preferencias.puedeSaltar } : {}),
      ...(preferencias?.tieneEscalon !== undefined
        ? { tieneEscalon: preferencias.tieneEscalon }
        : {}),
    }),
    [preferencias?.puedeSaltar, preferencias?.tieneEscalon],
  )

  /** Qué clase de sesión es. Lo necesitan el factor, la anticipación y el cierre. */
  const tipo: TipoSesion = useMemo(
    () =>
      esDiaDeFuelle
        ? 'fuelle'
        : esCorta
          ? 'corta'
          : esVuelta(historial ?? [], dia)
            ? 'vuelta'
            : 'plan',
    [esDiaDeFuelle, esCorta, historial, dia],
  )

  /**
   * Si esta sesión lleva fuelle.
   *
   * La corta queda afuera y no hace falta una regla aparte para los descansos
   * —con una serie por ejercicio no hay ningún descanso— pero sí para el bloque
   * del final: siete minutos con diez de fuelle encima ya no son siete minutos,
   * y la sesión corta existe para que hacer algo sea barato.
   */
  const esDensa = esDiaDenso && !esCorta

  /**
   * La densidad con la que se arma el bloque.
   *
   * Apagada en un día que no lleva fuelle, y la elegida en los que sí. Antes
   * esto tenía que remendar el caso del día de fuelle con el fuelle apagado
   * —una pantalla vacía— y ya no puede pasar: `densidad` nunca vale apagada.
   */
  const densidadDelBloque: Densidad =
    esDiaDeFuelle || esDiaDenso ? densidad : 'apagada'

  /** El factor del día: estado sostenido y sesión de vuelta se multiplican. */
  const factor = useMemo(() => {
    if (!estados || !historial) return 1
    const ajuste = ajusteDelDia(bandaSostenida(estados, dia))
    const vuelta = esVuelta(historial, dia) ? RECORTE_DE_VUELTA : 1
    return ajuste.factor * vuelta
  }, [estados, historial, dia])

  /**
   * Si hay barra con discos, que es lo que decide si los accesorios existen.
   *
   * Extraído a su propia constante y puesto en las dependencias del memo de
   * abajo, y eso NO es higiene: el memo leía `preferencias` sin depender de
   * ella. En el primer render `preferencias` todavía no cargó —viene de
   * `liveQuery`— así que el plan se armaba sin accesorios, y cuando las
   * preferencias llegaban el memo no volvía a correr. Resultado: los
   * accesorios con barra no aparecían NUNCA en la sesión, aunque Hoy los
   * hubiera anunciado un segundo antes.
   *
   * Un booleano en vez del objeto entero porque `preferencias` cambia con
   * cualquier ajuste, y rearmar el plan a mitad de una sesión por haber
   * tocado el sonido sería peor que el bug.
   */
  const tieneBarraCargable = (preferencias?.cargaMaximaKg ?? 0) > 0
  /** La de dominadas, por el mismo motivo: un booleano y en las dependencias. */
  const tieneBarra = preferencias?.tieneBarra !== false

  /**
   * Los ejercicios concretos de la sesión, según el avance de cada patrón, y
   * lo que la molestia de hoy le cambió a cada cadena, para decirlo.
   */
  const { plan, avisos } = useMemo(() => {
    if (!rutina || !semana || !avances) return { plan: [], avisos: [] }
    const cambios: { patron: Patron; cambio: CambioPorMolestia }[] = []
    // El `sinEjerciciosRepetidos` de afuera no es higiene: en un día denso con
    // una rutina por grupo, el mismo ejercicio entraba dos veces —la bajada
    // del bloque de cadena y el bloque de volumen resuelven al mismo eslabón—
    // y las dos entradas compartían el arreglo de series, porque `hechas` se
    // indexa por id de ejercicio y el plan es posicional.
    const entradas = sinEjerciciosRepetidos(rutina.bloques.flatMap((bloqueDelPlan) => {
      const bloque = {
        ...bloqueDelPlan,
        patron: patronDelBloque(bloqueDelPlan, semana, fechaDeLaSesion),
      }
      const avance = avances.get(bloque.patron)
      // La misma resolución que hace `Hoy`, desde el dominio: tres clases de
      // bloque —el eslabón del motor, volumen en el anterior, y un accesorio
      // fijo con barra—. Si las dos pantallas difirieran, Hoy anunciaría una
      // sesión y la sesión sería otra, que es exactamente el bug que
      // `patronDelBloque` ya había evitado una vez.
      const resuelto = ejercicioDelBloque(bloque, avance, POR_ID, cadenaDe(bloque.patron), {
        tieneBarraCargable,
      })
      if (!resuelto || !avance) return []
      // La molestia de hoy, con la misma función que usa `Hoy`. Lo que ya
      // tiene series anotadas en esta sesión no se toca: cambiarlo a mitad de
      // camino dejaría esas series fuera del plan, y el cierre no las
      // guardaría.
      const conMolestia = bloqueConMolestia(
        resuelto,
        molestias,
        POR_ID,
        cadenaDe(bloque.patron),
        { yaEmpezado: (hechas[resuelto.ejercicio.id]?.length ?? 0) > 0 },
      )
      if (conMolestia.cambio === 'saltea') {
        cambios.push({ patron: bloque.patron, cambio: 'saltea' })
        return []
      }
      const porMolestia = conMolestia.cambio === 'baja'
      if (porMolestia) cambios.push({ patron: bloque.patron, cambio: 'baja' })
      const { ejercicio, objetivo: delBloque, accesorio } = conMolestia
      // La vara de la vez pasada manda en un accesorio: el motor no lo
      // progresa —y no debe— así que la doble progresión la lleva la persona,
      // con el número de la última vez delante.
      const varaAccesoria = accesorio
        ? laVezPasada(historial ?? [], ejercicio.id, dia)
        : null
      const base = varaAccesoria
        ? {
            series: delBloque.series,
            cantidad: Math.min(
              Math.max(varaAccesoria.mejor, ejercicio.ventana.min),
              ejercicio.ventana.max,
            ),
            ...(varaAccesoria.kg !== undefined ? { kg: varaAccesoria.kg } : {}),
          }
        : delBloque
      // La sesión corta es un ejercicio por cadena y una serie de cada uno.
      const series = esCorta ? 1 : base.series
      const cantidad = Math.max(1, Math.round(base.cantidad * factor))
      // La vez pasada de ESTE ejercicio, para poner una vara adentro de cada
      // casillero. Es lo que hace que la segunda sesión no se sienta idéntica
      // a la primera: los casilleros vacíos ya no están vacíos.
      // En el eslabón bajado por una molestia, no: la vez pasada de ese
      // eslabón puede ser su techo, y un 12 adentro del casillero invita a
      // buscar 12 justo en la zona que avisó, con el objetivo pidiendo el piso.
      // Es lo mismo que hace la bajada, que tampoco lleva vara.
      const antes =
        historial && !porMolestia ? laVezPasada(historial, ejercicio.id, dia) : null
      // Y si esta sesión, cumplida, abre el eslabón siguiente. Solo cuando la
      // sesión de verdad mueve la progresión: en una corta, una de vuelta o una
      // cadena congelada el dato sigue siendo correcto y la promesa sería falsa.
      const cuenta =
        mueveElPlan(tipo) &&
        !ajusteDelDia(bandaSostenida(estados ?? [], dia)).neutra &&
        !cadenasCongeladas(estados ?? [], dia).has(bloque.patron)
      // Un accesorio nunca abre un eslabón: no está en ninguna cadena, o es el
      // anterior al que ya tenés. Anunciarlo sería una promesa falsa. El
      // eslabón bajado por una molestia, tampoco: no es el del motor. Y un
      // eslabón cerrado tampoco: el motor no lo va a abrir aunque cumplas.
      const abre =
        accesorio || porMolestia
          ? null
          : seAbreHoy(
              avance,
              cadenaDe(bloque.patron),
              POR_ID,
              cuenta,
              eslabonesCerrados(cadenaDe(bloque.patron), avances, tieneBarra),
            )
      const duro = {
        ejercicio,
        objetivo: { series, cantidad, ...(base.kg !== undefined ? { kg: base.kg } : {}) },
        antes,
        abre,
        descansoSegundos: ejercicio.descansoSegundos,
        // Un accesorio ocupa el lugar de una bajada: marcarlo como tal lo deja
        // fuera de la curva de fuerza y del cálculo de rendimiento, que es
        // donde no tiene nada que hacer. El eslabón bajado por una molestia,
        // lo mismo: hacer el de abajo no es haber perdido fuerza.
        bajada: accesorio || porMolestia,
        porMolestia,
      }

      // Y, en las sesiones densas, volumen en el eslabón anterior.
      //
      // Es otro ejercicio, así que `cerrarSesion` lo saltea sin que nadie se lo
      // pida —"solo progresa el patrón si se entrenó el ejercicio que tocaba"—
      // y la curva de fuerza se queda con el máximo del día, así que tampoco
      // puede hundirla. Las dos cosas tienen su test en `bajada.test.ts`.
      // Un accesorio no lleva bajada encima: ya ES el trabajo liviano, o es un
      // movimiento con barra sin eslabón anterior del que bajar. Una cadena
      // con molestia tampoco: ya bajó, y no se carga dos veces.
      if (!esDensa || accesorio || porMolestia) return [duro]
      const abajo = bajadaDe(ejercicio, cadenaDe(bloque.patron), POR_ID)
      if (!abajo) return [duro]
      return [
        duro,
        {
          ejercicio: abajo.ejercicio,
          objetivo: abajo.objetivo,
          antes: null,
          abre: null,
          descansoSegundos: DESCANSO_DE_BAJADA,
          bajada: true,
          porMolestia: false,
        },
      ]
    }))
    return {
      plan: entradas,
      avisos: avisosDeMolestia(
        cambios,
        entradas.map((e) => e.ejercicio.patron),
      ),
    }
  }, [
    rutina,
    semana,
    avances,
    esCorta,
    esDensa,
    factor,
    historial,
    estados,
    tipo,
    tieneBarraCargable,
    tieneBarra,
    dia,
    fechaDeLaSesion,
    molestias,
    hechas,
  ])

  /**
   * Lo que el plan pide de cada ejercicio, en la forma en que lo guarda el
   * borrador. Es lo que permite guardar un borrador vencido días después tal
   * como lo habría cerrado "Cerrar la sesión", y es también lo que usa
   * `terminar`: los dos cierres salen de la misma cuenta.
   */
  const pasos: PasoDelBorrador[] = useMemo(
    () =>
      plan.map(({ ejercicio, objetivo, bajada }) => ({
        ejercicioId: ejercicio.id,
        objetivo,
        ...(bajada ? { bajada: true as const } : {}),
      })),
    [plan],
  )

  /**
   * El bloque de fuelle: una prescripción fija, no un relleno.
   *
   * Antes esto se dimensionaba para que la sesión llegara a la duración elegida,
   * y ese era el error de fondo: la app optimizaba "que dure una hora" en vez de
   * "que sirva". La sesión dura lo que dura; lo que se elige es cuán fuerte.
   */
  const minutosDeFuerza = useMemo(() => minutosDeSesion(plan), [plan])

  const fuelle: PasoDeFuelle[] = useMemo(() => {
    if (densidadDelBloque === 'apagada') return []
    // Las ráfagas del bloque tampoco cargan la cadena con molestia: el bloque
    // es lo que se hace sin que nadie lo mida, y por eso mismo no puede caer
    // encima de la zona que avisó.
    if (esDiaDeFuelle) {
      return bloqueDeFuelle(
        minutosDelDiaDeFuelle(densidadDelBloque),
        equipo,
        densidadDelBloque,
        molestias,
      )
    }
    if (!esDensa) return []
    return bloqueDeFuelle(
      minutosDelBloque(minutosDeFuerza, densidadDelBloque),
      equipo,
      densidadDelBloque,
      molestias,
    )
  }, [esDensa, esDiaDeFuelle, densidadDelBloque, equipo, minutosDeFuerza, molestias])

  return { plan, avisos, pasos, fuelle, tipo, esDensa, densidad, equipo }
}

/** Un ejercicio del plan, con su objetivo, la vara y lo que abre. */
export type PasoDelPlan = ReturnType<typeof usePlanDeLaSesion>['plan'][number]
