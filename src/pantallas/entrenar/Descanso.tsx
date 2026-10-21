import { Lyra } from '@/componentes/lyra'
import { Arco } from '@/componentes/arco'
import { Rotulo } from '@/componentes/ui'
import { dichoDelDescanso, type Expresion } from '@/dominio/frases'
import { textoDeLoQueViene, type LoQueViene } from '@/dominio/siguiente'
import type { Rafaga } from '@/dominio/metabolico'

/**
 * El aviso de lo que viene, en una línea.
 *
 * Está en un solo lugar a propósito. Antes el `<p>` estaba escrito adentro de
 * una de las dos ramas del descanso y la otra rama quedaba sin aviso: el mismo
 * error que duplicar el arco, con la diferencia de que acá no se ve, porque
 * nadie mira las dos ramas en la misma sesión.
 */
function Aviso({ viene, className = '' }: { viene: LoQueViene | null; className?: string }) {
  if (!viene) return null
  return (
    <p className={`rotulo ${className}`} aria-live="polite">
      después · <span className="text-[var(--color-tinta)]">{textoDeLoQueViene(viene)}</span>
    </p>
  )
}

/** El descanso: un arco que se vacía en silencio. Lineal, porque es tiempo real. */
export function Descanso({
  restante,
  total,
  clave,
  rafaga,
  viene,
  onSumar,
  onSaltear,
  onSaltearRafaga,
}: {
  restante: number
  total: number
  /**
   * Lo que hace falta para saber QUÉ decir en este descanso: la técnica del
   * ejercicio, cuántas series faltan, en qué lugar de la sesión está y el azar
   * de este descanso. Lo decide `dichoDelDescanso`, en el dominio.
   */
  clave: {
    tecnica: string[]
    faltan: number
    indice: number
    total: number
    azar: number
  }
  /**
   * La ráfaga, si este descanso está en su tramo metabólico. En null el
   * descanso es exactamente el que era antes de que existiera el fuelle.
   */
  rafaga: Rafaga | null
  /**
   * Lo que viene después del ejercicio, o null si todavía faltan dos series.
   * Lo resuelve el dominio; acá solo se dibuja.
   */
  viene: LoQueViene | null
  onSumar: () => void
  onSaltear: () => void
  onSaltearRafaga: () => void
}) {
  // Lo que se dice en el descanso, y con qué cara. La decisión entera vive en
  // el dominio, con test: son cuatro caminos y la garantía de que ninguno deja
  // el descanso mudo, que es justo lo que se rompe sin que nadie lo note.
  //
  // Sesenta o noventa segundos por serie son unos veinte minutos de sesión
  // mirando un arco vaciarse: es el bloque de tiempo más grande de la app y
  // estaba muerto. La técnica ya estaba escrita para los cuarenta y siete
  // ejercicios y no la veía nadie, porque para leerla hay que salir de la
  // sesión y entrar a la ficha, que es exactamente lo que nadie hace con el
  // pulso a ciento cuarenta.
  //
  // Y quién lo dice: Lyra, en el descanso y NUNCA durante la serie. El aliento
  // verbal aumenta las repeticiones, pero funciona como voz, no como algo que
  // compita por la mirada mientras se lee un número.
  //
  // Los errores comunes no van acá y sí en la ficha: un "no hagas esto" leído
  // de reojo y a medias se puede entender al revés, y la ficha tiene lugar
  // para enmarcarlo.
  const dicho = dichoDelDescanso(clave)
  const texto = dicho?.texto ?? null
  const cara: Expresion = dicho?.expresion ?? 'piensa'

  return (
    <section className="flex flex-1 flex-col items-center justify-center pb-8">
      {/* El rótulo es lo único que dice en qué tramo estás. El arco no cambia:
          sigue midiendo el descanso entero, que es el tiempo que de verdad
          falta para la serie siguiente. Partirlo en dos arcos habría sido una
          animación nueva y, peor, habría escondido cuánto falta en serio. */}
      <Rotulo>{rafaga ? 'RÁFAGA' : 'DESCANSO'}</Rotulo>
      <div className="mt-3">
        <Arco restante={restante} total={total} />
      </div>

      {rafaga ? (
        <>
          <p className="mt-6 text-center text-lg font-semibold" data-prueba="nombre-rafaga">
            {rafaga.nombre}
          </p>
          <p className="mt-2 max-w-[32ch] text-center text-sm leading-relaxed text-[var(--color-glosa)]">
            {rafaga.gesto}
          </p>
          {/* Acá NO va el aviso de lo que viene, y conviene dejar escrito por
              qué, porque yo mismo lo agregué y lo tuve que sacar.

              Primero la razón de fondo: no falta. La ráfaga ocupa el PRINCIPIO
              del descanso —`enRafaga` se apaga cuando quedan los segundos de
              descanso verdadero— así que al terminar el tramo esta misma
              pantalla pasa a la rama de abajo, con Lyra y con el aviso, y se
              queda ahí todo el tramo pegado a la serie siguiente. Medido en el
              portón del fuelle: 150 s de descanso total, 105 de ellos con el
              aviso puesto.

              Y después la razón de píxeles, que es la que lo cierra: agregarlo
              también en el tramo de ráfaga costaba 45 px —el renglón se parte
              en dos— en una pantalla que en 360×640 ya termina 52 px abajo del
              borde. `pliegue.mjs` lo midió y lo rechazó, con razón. */}
        </>
      ) : (
        texto && (
          /* El ancho es fijo —`w-full` con tope— y no el que pida la frase.
             Con una caja que se encoge, Lyra aparecía a 24 px del borde con la
             indicación larga y a 140 con "La última sale": saltaba de lugar en
             cada descanso, y el descanso vuelve doce veces por sesión. Con el
             ancho fijo cae siempre en el mismo punto y lo único que cambia es
             lo que dice. */
          <div className="mt-6 flex w-full max-w-[36ch] items-start gap-3">
            <Lyra tamano={44} expresion={cara} className="shrink-0" />
            <div className="min-w-0">
              <p className="mt-1 text-sm leading-relaxed text-[var(--color-glosa)]">{texto}</p>
              {/* El aviso previo va PEGADO a la línea de Lyra y no como párrafo
                  aparte: medido en 320×568, como renglón suelto costaba 33 px y
                  acá cuesta 19. Esta pantalla ya termina abajo del borde en el
                  teléfono más chico —el descanso del medio, con la indicación
                  de técnica de tres renglones, llega a 690 de 568— así que cada
                  píxel que se agregue acá tiene que pelearse. */}
              <Aviso viene={viene} className="mt-2" />
            </div>
          </div>
        )
      )}

      {/* Los botones del esfuerzo miden 56 y no 47: para que no bajaran del
          borde, los dos aires de arriba pasaron de 32 a 24. */}
      <div className="mt-6 flex gap-3">
        <button onClick={onSumar} className="boton-contorno">
          +30 s
        </button>
        {/* Saltear la ráfaga NO saltea el descanso: lo que queda sigue siendo
            descanso. Es la diferencia entre "hoy no" y "ya estoy listo", y
            confundirlas le cobraría recuperación a alguien que solo quería no
            hacer burpees. */}
        {rafaga && (
          <button
            onClick={onSaltearRafaga}
            className="boton-contorno"
          >
            Hoy no
          </button>
        )}
        <button onClick={onSaltear} className="boton-contorno">
          Saltear
        </button>
      </div>
    </section>
  )
}
