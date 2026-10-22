import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Accion, Regleta, Segmento } from '@/componentes/ui'
import { Armazon } from './Armazon'

/**
 * Las preguntas del final. Tres toques, todos opcionales.
 *
 * En el armazón de la sesión: las preguntas scrollean adentro de `main` y
 * "Cerrar la sesión" es la fila de abajo, siempre a la vista. Con tres
 * regletas de 3 + 2 no entran en un 640 (§7.4.2), y si scrolleara la página,
 * la acción quedaría debajo del borde.
 */
export function Preguntas({
  encabezado,
  guardando,
  error,
  onListo,
}: {
  encabezado: ReactNode
  guardando: boolean
  /** Si el último intento de cerrar falló, qué decir. */
  error: string | null
  onListo: (datos: { esfuerzo?: number; animo?: number; vitalidadPost?: number }) => void
}) {
  const [esfuerzo, setEsfuerzo] = useState<number | undefined>()
  const [animo, setAnimo] = useState<number | undefined>()
  const [energia, setEnergia] = useState<number | undefined>()

  // Mientras guarda, el botón está deshabilitado y el foco se le cae a
  // `<body>`. Si falla, vuelve al botón: el aviso lo dice la región de alerta,
  // y el Tab siguiente tiene que arrancar de "Cerrar la sesión", no de arriba.
  const pie = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!error || (document.activeElement && document.activeElement !== document.body)) return
    pie.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [error])

  return (
    <Armazon
      encabezado={encabezado}
      pie={
        <div ref={pie}>
          {/* En ámbar, que es el techo de alarma de esta pantalla: el rojo de
              borrar no existe en el entrenamiento. Va en la fila de abajo,
              arriba del botón que lo provocó: la fila crece y `main` se
              achica, así que nunca queda escondido debajo de las preguntas. */}
          {error && (
            <p role="alert" className="error-al-cerrar">
              {error}
            </p>
          )}
          <Accion
            esfuerzo
            deshabilitado={guardando}
            onClick={() =>
              onListo({
                ...(esfuerzo !== undefined ? { esfuerzo } : {}),
                ...(animo !== undefined ? { animo } : {}),
                ...(energia !== undefined ? { vitalidadPost: energia } : {}),
              })
            }
          >
            {guardando ? 'Guardando…' : 'Cerrar la sesión'}
          </Accion>
        </div>
      }
    >
      <p className="rotulo" data-foco>
        ANTES DE CERRAR
      </p>

      <Pregunta
        titulo="¿Qué tan dura te resultó?"
        opciones={[
          [2, 'Suave'],
          [4, 'Moderada'],
          [6, 'Exigente'],
          [8, 'Dura'],
          [10, 'Al límite'],
        ]}
        valor={esfuerzo}
        onElegir={setEsfuerzo}
      />

      <Pregunta
        titulo="¿Cómo te sentiste haciéndola?"
        opciones={[
          [-2, 'Mal'],
          [-1, 'Cuesta arriba'],
          [0, 'Neutra'],
          [1, 'Bien'],
          [2, 'Muy bien'],
        ]}
        valor={animo}
        onElegir={setAnimo}
      />

      <Pregunta
        titulo="¿Cuánta energía tenés ahora?"
        // La misma escala de cinco puntos y las mismas etiquetas que el
        // chequeo diario. Si las dos puntas del delta no se miden con la
        // misma vara, el delta no significa nada.
        opciones={[
          [1, 'En el piso'],
          [2, 'Con poca energía'],
          [3, 'Normal'],
          [4, 'Con energía'],
          [5, 'A pleno'],
        ]}
        valor={energia}
        onElegir={setEnergia}
      />

      <p className="texto-chico mt-6 max-w-[38ch]">
        Nada de esto es obligatorio. Lo usa el motor para no bajarte el objetivo por un mal día,
        y para mostrarte con tus propios datos qué te deja entrenar.
      </p>
    </Armazon>
  )
}

/**
 * Una pregunta y su regleta de 56, la del esfuerzo, en 3 + 2. Lo elegido va
 * en tinta, no en el acento, que acá es de "Cerrar la sesión".
 */
function Pregunta({
  titulo,
  opciones,
  valor,
  onElegir,
}: {
  titulo: string
  opciones: [number, string][]
  valor: number | undefined
  onElegir: (n: number) => void
}) {
  return (
    <section>
      <h2 className="pregunta-final">{titulo}</h2>
      <Regleta etiqueta={titulo} esfuerzo>
        {opciones.map(([n, etiqueta]) => (
          <Segmento key={n} elegido={valor === n} onClick={() => onElegir(n)}>
            {etiqueta}
          </Segmento>
        ))}
      </Regleta>
    </section>
  )
}
