/**
 * Los kilos de la sesión: los puestos por ejercicio y los discos que hay.
 *
 * Vive aparte de `Entrenar` por tamaño y porque es una sola cosa, con un solo
 * estado y todo lo demás derivado.
 */

import { useState } from 'react'
import type { Preferencias } from '@/dominio/tipos'
import type { PasoDelPlan } from './usePlanDeLaSesion'

export function useKilos(paso: PasoDelPlan | undefined, preferencias: Preferencias | undefined) {
  /**
   * Los kilos puestos, por ejercicio.
   *
   * Es un mapa y no un número suelto por dos razones. La primera es que cada
   * ejercicio lleva su propia carga y una sesión pasa por varios. La segunda
   * la encontró el portón: la primera versión era un número con un
   * `useEffect` que lo reseteaba al cambiar de ejercicio, y ese efecto quedaba
   * DESPUÉS de los returns tempranos de `Entrenar` —React error #310, "más
   * hooks que en el render anterior"— así que la pantalla de entrenar
   * crasheaba entera. Derivado de un mapa no hace falta ningún hook.
   *
   * Lo que no está en el mapa arranca donde quedó la vez pasada, que es la
   * diferencia entre un toque y ocho: con discos de 2,5 kg, volver a veinte
   * cuesta ocho toques en CADA ejercicio de CADA sesión.
   */
  const [kgPuestos, setKgPuestos] = useState<Record<string, number>>({})

  /* Los kilos del ejercicio en curso, derivados, y el ORDEN importa:
     lo que tocaste hoy, después lo que el MOTOR propuso, y recién después lo
     que usaste la vez pasada.

     El del medio es el que faltaba. Desde que el motor puede decir "subí a
     12,5 kg" al llegar al final de una cadena, ese número tiene que estar
     puesto cuando la persona llega a la serie: si no, el motor propone un
     disco, lo escribe en la explicación del cierre, y al día siguiente la
     pantalla muestra callada el peso viejo. La propuesta quedaría en un texto
     que nadie va a seguir a mano. */
  const kg = paso ? (kgPuestos[paso.ejercicio.id] ?? paso.objetivo.kg ?? paso.antes?.kg ?? 0) : 0

  /* Los discos solo se ofrecen cuando hay con qué: el peso del cuerpo, que es
     lo único que deja pasar kilos a la escala del motor, y una barra. Sin eso
     la fila no aparece, que es lo mismo que hace la vibración en iOS. */
  const tope = preferencias?.cargaMaximaKg ?? 0
  const pasoDeDisco = preferencias?.pasoDeDiscoKg ?? 2.5
  const puedeCargar = preferencias?.pesoCorporalKg !== undefined && tope > 0

  return {
    kg,
    tope,
    pasoDeDisco,
    puedeCargar,
    /** Los kilos del ejercicio en curso. */
    ponerKg: (valor: number) => {
      if (paso) setKgPuestos((previos) => ({ ...previos, [paso.ejercicio.id]: valor }))
    },
    /** Empezar de cero: todo vuelve a donde quedó la vez pasada. */
    sacarLosKilos: () => setKgPuestos({}),
  }
}
