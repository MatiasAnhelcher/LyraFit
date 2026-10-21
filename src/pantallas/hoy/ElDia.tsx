import { useNavigate } from 'react-router-dom'
import { destinoDelDia, type ClaseDeDia } from '@/dominio/rutinas'
import {
  PISO_DE_PROTEINA,
  senalesDelDia,
  type DiaDelDiario,
  type HoraDeDormir,
} from '@/dominio/nutricion'
import { IconoComida, IconoFuerza, IconoSueno } from '@/componentes/iconos'
import { orden } from '@/componentes/movimiento'
import { Rotulo } from '@/componentes/ui'

/**
 * EL DÍA: entrenaste · comiste · dormiste.
 *
 * Las tres con el mismo peso visual exacto —misma fila, mismo canal,
 * misma tipografía— porque esa igualdad ES la afirmación. Una app de
 * entrenamiento que pone la comida y el sueño en una pantalla secundaria
 * está diciendo que son secundarios, y no lo son: con dieta, dormir poco
 * hizo que una parte mayor de lo que se bajó fuera músculo (Nedeltcheva
 * 2010, un ensayo chico). No es un accesorio del entrenamiento.
 *
 * Van DEBAJO de `Empezar` y no arriba. No es una decisión de jerarquía:
 * es la regla del pliegue, medida en tres teléfonos. En un Android de
 * 360×640 `Empezar` tiene exactamente doce píxeles de aire sobre la barra
 * de navegación, y cada renglón que se agregue arriba lo empuja por
 * debajo. El orden sigue siendo quién sos, qué toca hoy, empezar, y
 * después dónde estás parado.
 *
 * Y es un ESTADO, no un reclamo. Lo que falta se dibuja como un guion en
 * glosa, nunca como una cruz ni en rojo: lo que falta no está prohibido,
 * está sin iluminar. El silencio es la respuesta correcta la mayoría de
 * los días.
 */
export function ElDia({
  clase,
  esDiaDeEntrenar,
  entrenoHoy,
  minutos,
  diaDelDiario,
  horaDeDormir,
}: {
  clase: ClaseDeDia
  esDiaDeEntrenar: boolean
  entrenoHoy: boolean
  /** Lo que dura la sesión de hoy, estimado: lo dice la fila de entrenar. */
  minutos: number
  /** La fila del diario de hoy, o nada mientras la consulta vuela. */
  diaDelDiario: DiaDelDiario | undefined
  /** La misma hora de acostarse que usa el diario, para que los dos avisos digan lo mismo. */
  horaDeDormir: HoraDeDormir | null | undefined
}) {
  const navegar = useNavigate()

  /**
   * Las tres señales del día.
   *
   * `valor === null` quiere decir "todavía no hay respuesta" y se dibuja como
   * un guion apagado. Un 0 NO es null: contestar "cero comidas con proteína"
   * es una respuesta, y tratarla como silencio dejaría la fila esperando para
   * siempre algo que ya está dicho.
   */
  // `?? null` mientras la consulta vuela: sin hora todavía, y no la de la fila,
  // que puede ser una de las 23:00 inventadas de antes.
  const senales = senalesDelDia(diaDelDiario, horaDeDormir ?? null)
  const porciones = diaDelDiario?.porcionesDeProteina
  const senalesDelDia_filas = [
    {
      clave: 'entrenaste',
      a: esDiaDeEntrenar ? destinoDelDia(clase) : '/progreso',
      Icono: IconoFuerza,
      luz: 'var(--dominio-fuerza-luz)',
      titulo: 'Entrenaste',
      detalle: entrenoHoy
        ? 'hoy'
        : esDiaDeEntrenar
          ? `hoy toca · ${minutos} min`
          : 'hoy toca descansar',
      valor: entrenoHoy ? '✓' : esDiaDeEntrenar ? null : '·',
    },
    {
      clave: 'comiste',
      a: '/diario',
      Icono: IconoComida,
      luz: 'var(--dominio-comida-luz)',
      titulo: 'Comiste',
      detalle:
        porciones === undefined
          ? `comidas con proteína · el piso son ${PISO_DE_PROTEINA}`
          : porciones >= PISO_DE_PROTEINA
            ? 'comidas con proteína · estás en el piso'
            : `comidas con proteína · el piso son ${PISO_DE_PROTEINA}`,
      valor: porciones === undefined ? null : String(porciones),
    },
    {
      clave: 'dormiste',
      a: '/diario',
      Icono: IconoSueno,
      luz: 'var(--dominio-sueno-luz)',
      titulo: 'Dormiste',
      detalle: diaDelDiario?.sueno ? 'horas, anoche' : 'anoche',
      valor: diaDelDiario?.sueno ?? null,
    },
  ]

  return (
    <section className="mt-10">
      <Rotulo>EL DÍA</Rotulo>
      <div className="registro mt-3">
        {senalesDelDia_filas.map((fila, i) => (
          <button
            key={fila.clave}
            onClick={() => navegar(fila.a)}
            className="fila-pulsable entrar-en-orden"
            style={orden(i)}
            data-prueba={`dia-${fila.clave}`}
          >
            <span className="canal" style={{ color: fila.luz }}>
              <fila.Icono className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="nombre block">{fila.titulo}</span>
              <span className="rotulo mt-0.5 block truncate">{fila.detalle}</span>
            </span>
            {/* Sin `opacity`: la glosa YA ES el apagado de este sistema, y
                poner 0,55 encima la bajaba a 2,89:1 — por debajo del piso
                de 4,5 que la propia paleta declara. Medido. Lo que falta se
                dice en glosa y nada más; doblar el apagado lo vuelve
                ilegible en vez de discreto. */}
            <span
              className="cifra-fila"
              style={fila.valor === null ? { color: 'var(--color-glosa)' } : undefined}
            >
              {fila.valor ?? '—'}
            </span>
          </button>
        ))}
      </div>
      {/* El único aviso que este módulo levanta solo, y por eso está acá y no
          escondido en el diario: es el dato que la percepción de la persona
          NO puede detectar sola. Los otros seis hábitos no avisan nada —
          nadie necesita que una app le diga que comió poca proteína. */}
      {senales.avisoDeCafeina && (
        <p className="mt-4 max-w-[40ch] text-sm leading-relaxed text-[var(--color-glosa)]">
          {senales.avisoDeCafeina}
        </p>
      )}
    </section>
  )
}
