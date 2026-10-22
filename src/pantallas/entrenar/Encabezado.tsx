import { comoReloj } from '@/hooks/useTemporizador'
import { BotonSalir } from '@/componentes/ui'

/**
 * La primera fila del armazón: la salida, el cronómetro, deshacer, cuánto
 * falta de la sesión y, si la sesión se retomó, el aviso.
 *
 * "Deshacer la última" vive acá y en ningún otro lado: hay uno solo por
 * pantalla, en el mismo lugar en la serie, el descanso y el ejercicio
 * completo, que es donde se busca cuando una serie se anotó mal. Su celda
 * está siempre reservada —sin serie para deshacer va con `visibility:
 * hidden`, que no se enfoca ni se lee—, así que el cronómetro no salta de
 * lugar cuando aparece.
 */
export function Encabezado({
  duracion,
  ejercicios,
  enCurso,
  retomada,
  onSalir,
  onEmpezarDeCero,
  onDeshacer,
}: {
  /** Los segundos que lleva la sesión. */
  duracion: number
  /** Cuántos ejercicios tiene la sesión. */
  ejercicios: number
  /** Qué ejercicio está en curso, empezando en cero. Pasados todos, `ejercicios`. */
  enCurso: number
  retomada: boolean
  onSalir: () => void
  onEmpezarDeCero: () => void
  /** Null si no hay serie de este ejercicio para deshacer. */
  onDeshacer: (() => void) | null
}) {
  return (
    <header className="encabezado-esfuerzo">
      <div className="encabezado-esfuerzo-fila">
        <BotonSalir onClick={onSalir} />
        <p className="cronometro" data-prueba="cronometro">
          {comoReloj(duracion)}
        </p>
        <button
          type="button"
          onClick={onDeshacer ?? undefined}
          className="boton-contorno boton-deshacer"
          aria-label="Deshacer la última serie"
          data-oculto={onDeshacer ? undefined : ''}
        >
          Deshacer la última
        </button>
      </div>

      {/* Cambia por corte, como todo en el esfuerzo. Para un lector dice la
          posición y no "hechos": un ejercicio salteado también quedó atrás. */}
      <div className="barra-sesion">
        {Array.from({ length: ejercicios }, (_, i) => (
          <i
            key={i}
            aria-hidden="true"
            data-estado={i < enCurso ? 'hecho' : i === enCurso ? 'actual' : undefined}
          />
        ))}
        <span className="sr-only">
          {enCurso < ejercicios
            ? `Ejercicio ${enCurso + 1} de ${ejercicios}`
            : ejercicios === 1
              ? 'Pasado el único ejercicio'
              : `Pasados los ${ejercicios} ejercicios`}
        </span>
      </div>

      {/* El único aviso de que esto se retomó. Va acá y no en un cartel: lo
          que hay que comunicar es "no perdiste nada", y para eso alcanza con
          que las series ya anotadas estén en su lugar. El botón es para el
          otro caso, el que salió a propósito y quiere arrancar limpio. */}
      {retomada && (
        <div className="franja-retomada">
          {/* Cortado en dos frases y no donde caiga: a 320 son dos renglones
              parejos y no cuatro sueltos. Cuando no entra al lado del botón,
              el que cede es el botón (ver `.franja-retomada`). */}
          <p className="rotulo">
            <span className="whitespace-nowrap">sesión retomada</span>{' '}
            <span className="whitespace-nowrap">donde la dejaste</span>
          </p>
          <button type="button" onClick={onEmpezarDeCero} className="boton-contorno">
            Empezar de cero
          </button>
        </div>
      )}
    </header>
  )
}
