/**
 * El acceso a "cómo se hace", en la sesión y no afuera.
 *
 * Va al lado del nombre del ejercicio porque la pregunta "¿cómo era esto?"
 * aparece mirando el nombre, no buscándola en un menú. Lo que abre —el dibujo
 * y la técnica encima de la sesión— está en `componentes/comoSeHace.tsx`;
 * acá vive solo la puerta, que es lo que pertenece a la pantalla.
 */
export function BotonComoSeHace({ onAbrir }: { onAbrir: () => void }) {
  return (
    <button
      onClick={onAbrir}
      className="rotulo shrink-0 whitespace-nowrap underline underline-offset-4"
    >
      cómo se hace
    </button>
  )
}
