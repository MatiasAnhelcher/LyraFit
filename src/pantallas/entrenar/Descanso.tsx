import { Lyra } from '@/componentes/lyra'
import { Arco } from '@/componentes/arco'
import { dichoDelDescanso, type Expresion } from '@/dominio/frases'
import { textoDeLoQueViene, type LoQueViene } from '@/dominio/siguiente'
import type { Rafaga } from '@/dominio/metabolico'

/**
 * El descanso: un arco que se vacía en silencio. Lineal, porque es tiempo real.
 *
 * Son filas de la grilla de `main` (§7.4.1): la `section` no tiene caja
 * propia, y el rótulo, el arco, "después ·" y la técnica caen cada uno en su
 * fila. La del arco es la que crece: entre 7rem y 12rem, antes que el aire.
 * Así el arco se achica en un teléfono bajo en vez de empujar la técnica o
 * los botones afuera de la pantalla, que era lo que pasaba cuando todo esto
 * era una columna centrada.
 */
export function Descanso({
  restante,
  total,
  clave,
  rafaga,
  viene,
}: {
  restante: number
  /** El total del descanso con lo sumado: contra eso mide el arco, y es lo que dice "de 2:30". */
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
  // Y quién lo dice: Lyra, en el descanso y NUNCA durante la serie. Quieta y
  // chica, flotando al lado de la frase: no es un botón, y en el esfuerzo no
  // se mueve nada que no sea el arco.
  //
  // Los errores comunes no van acá y sí en "Cómo se hace": un "no hagas esto"
  // leído de reojo y a medias se puede entender al revés, y la hoja tiene
  // lugar para enmarcarlo.
  const dicho = dichoDelDescanso(clave)
  const texto = dicho?.texto ?? null
  const cara: Expresion = dicho?.expresion ?? 'piensa'

  return (
    <section>
      {/* El rótulo es lo único que dice en qué tramo estás, y es el
          encabezado de este estado: ahí va el foco al llegar. El arco no
          cambia: sigue midiendo el descanso entero, que es el tiempo que de
          verdad falta para la serie siguiente. */}
      <p className="rotulo rotulo-tramo" data-foco>
        {rafaga ? 'RÁFAGA' : 'DESCANSO'}
      </p>
      <Arco restante={restante} total={total} lado="fila" etiqueta="Descanso" conTotal />

      {rafaga ? (
        <>
          <p className="nombre-rafaga" data-prueba="nombre-rafaga">
            {rafaga.nombre}
          </p>
          <p className="gesto-rafaga">{rafaga.gesto}</p>
          {/* Acá NO va el aviso de lo que viene. La ráfaga ocupa el PRINCIPIO
              del descanso —`enRafaga` se apaga cuando quedan los segundos de
              descanso verdadero— así que al terminar el tramo esta misma
              pantalla pasa a la rama de abajo, con el aviso, y se queda ahí
              todo el tramo pegado a la serie siguiente. Medido en el portón
              del fuelle: 150 s de descanso total, 105 de ellos con el aviso
              puesto. */}
        </>
      ) : (
        <>
          {/* Justo debajo del arco, que es lo segundo que se mira. Sin
              `aria-live`: se monta junto con su texto y no anunciaría nada;
              lo dice la región viva de la sesión al arrancar el descanso. */}
          {viene && (
            <p className="despues-del-descanso">
              después · <span>{textoDeLoQueViene(viene)}</span>
            </p>
          )}
          {texto && (
            <p className="tecnica-del-descanso">
              <Lyra tamano={28} expresion={cara} interactiva={false} />
              {texto}
            </p>
          )}
        </>
      )}
    </section>
  )
}

/**
 * Los botones del descanso, en la fila de la acción: abajo de todo, a la
 * vista siempre y sin tapar nada, porque son una fila de la grilla.
 */
export function PieDelDescanso({
  conRafaga,
  onSumar,
  onSaltear,
  onSaltearRafaga,
}: {
  conRafaga: boolean
  onSumar: () => void
  onSaltear: () => void
  onSaltearRafaga: () => void
}) {
  return (
    <div className="pie-esfuerzo" data-tres={conRafaga || undefined}>
      <button type="button" onClick={onSumar} className="boton-contorno">
        +30 s
      </button>
      {/* Saltear la ráfaga NO saltea el descanso: lo que queda sigue siendo
          descanso. Es la diferencia entre "hoy no" y "ya estoy listo", y
          confundirlas le cobraría recuperación a alguien que solo quería no
          hacer burpees. */}
      {conRafaga && (
        <button type="button" onClick={onSaltearRafaga} className="boton-contorno">
          Hoy no
        </button>
      )}
      <button type="button" onClick={onSaltear} className="boton-contorno">
        Saltear
      </button>
    </div>
  )
}
