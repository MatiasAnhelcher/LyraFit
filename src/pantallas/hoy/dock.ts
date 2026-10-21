/**
 * Cuándo `Empezar` se pega sobre la barra: solo cuando lo que toca es
 * empezar. Un día de descanso o con la sesión ya hecha, el botón va en el
 * flujo como cualquier otro, y pegado sería un empujón que nadie pidió
 * (Tarjeta 4). La sesión sin cerrar cuenta porque `Empezar` es también la
 * forma de retomarla.
 *
 * Es la regla y no la medida: si además entra en su lugar, `useDock` lo deja
 * ahí aunque pueda pegarse.
 */
export function debePegarse({
  esDiaDeEntrenar,
  entrenoHoy,
  haySinCerrar,
}: {
  esDiaDeEntrenar: boolean
  entrenoHoy: boolean
  haySinCerrar: boolean
}): boolean {
  return haySinCerrar || (esDiaDeEntrenar && !entrenoHoy)
}
