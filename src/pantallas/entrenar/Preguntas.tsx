import { useState } from 'react'
import { Accion, Regleta, Rotulo, Segmento } from '@/componentes/ui'

/** Las preguntas del final. Tres toques, todos opcionales. */
export function Preguntas({
  guardando,
  error,
  onListo,
}: {
  guardando: boolean
  /** Si el último intento de cerrar falló, qué decir. */
  error: string | null
  onListo: (datos: { esfuerzo?: number; animo?: number; vitalidadPost?: number }) => void
}) {
  const [esfuerzo, setEsfuerzo] = useState<number | undefined>()
  const [animo, setAnimo] = useState<number | undefined>()
  const [energia, setEnergia] = useState<number | undefined>()

  // Una grilla de dos filas al alto de la pantalla: las preguntas scrollean
  // adentro de `main` y "Cerrar la sesión" es la fila de abajo, siempre a la
  // vista. Con tres regletas de 3 + 2 la página entera no entra en un 640, y
  // si scrolleara ella, la acción quedaría debajo del borde.
  return (
    <div className="grid h-svh grid-rows-[minmax(0,1fr)_auto]">
      <main className="overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-lg px-4 pt-10 pb-6">
          <Rotulo>ANTES DE CERRAR</Rotulo>

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

          <p className="mt-8 max-w-[38ch] text-xs leading-relaxed text-[var(--color-glosa)]">
            Nada de esto es obligatorio. Lo usa el motor para no bajarte el objetivo por un mal día,
            y para mostrarte con tus propios datos qué te deja entrenar.
          </p>
        </div>
      </main>

      <div>
        {/* En ámbar, que es el techo de alarma de esta pantalla: el rojo de
            borrar no existe en el entrenamiento. Va en la fila de abajo, arriba
            del botón que lo provocó: en el scroll de `main` quedaría escondido
            debajo de las preguntas. */}
        {error && (
          <p
            role="alert"
            className="mx-auto w-full max-w-lg px-4 pt-3 pb-4 text-sm leading-relaxed text-[var(--color-ambar)]"
          >
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
    </div>
  )
}

/**
 * Una pregunta y su regleta de 56, la del esfuerzo. Lo elegido va en tinta,
 * no en el acento, que acá es de "Cerrar la sesión".
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
    <section className="mt-8">
      <p className="nombre">{titulo}</p>
      <Regleta className="mt-3" etiqueta={titulo} esfuerzo>
        {opciones.map(([n, etiqueta]) => (
          <Segmento key={n} elegido={valor === n} onClick={() => onElegir(n)}>
            {etiqueta}
          </Segmento>
        ))}
      </Regleta>
    </section>
  )
}
