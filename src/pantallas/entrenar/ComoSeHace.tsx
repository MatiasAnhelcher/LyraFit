/**
 * El acceso a "Cómo se hace", en la sesión y no afuera.
 *
 * Va en la fila del patrón, arriba del nombre del ejercicio, porque la
 * pregunta "¿cómo era esto?" aparece mirando el nombre, no buscándola en un
 * menú. Es un botón de contorno de 56, como todo lo que se toca en el
 * esfuerzo: antes era un rótulo subrayado de 16 px de alto. Lo que abre —el
 * dibujo y la técnica, en una hoja encima de la sesión— está en
 * `componentes/comoSeHace.tsx`; acá vive solo la puerta.
 */
export function BotonComoSeHace({ onAbrir }: { onAbrir: () => void }) {
  return (
    <button type="button" onClick={onAbrir} className="boton-contorno boton-como-se-hace shrink-0 whitespace-nowrap">
      Cómo se hace
    </button>
  )
}
