import { describe, expect, it } from 'vitest'
import { PROHIBIDAS, loProhibido } from './palabras'
import {
  PROHIBIDAS as DE_LOS_PORTONES,
  loProhibido as loProhibidoEnLosPortones,
} from '../../lib/palabras.mjs'

describe('una sola lista, en dos idiomas', () => {
  it('los portones leen exactamente las mismas expresiones', () => {
    // Letra por letra, con las banderas: una `u` que falta en una copia deja
    // de reconocer los bordes de "recuperá" y nadie lo ve en una captura.
    expect(DE_LOS_PORTONES.map(String)).toEqual(PROHIBIDAS.map(String))
  })

  it('y las dos dicen lo mismo de los mismos textos', () => {
    const textos = [
      'Cuidado, estás entrenando demasiado.',
      'Te faltan 7 para llegar a 10.',
      'Te falta 1 para llegar a 10.',
      'Te falta una serie.',
      'Recuperá.',
      'Bajá controlado hasta el pecho.',
    ]
    for (const texto of textos) {
      expect(loProhibidoEnLosPortones(texto), texto).toBe(loProhibido(texto))
    }
  })
})

describe('qué agarra y qué deja pasar', () => {
  it('agarra lo que retaría a quien entrena más de una vez por día', () => {
    for (const frase of [
      'Cuidado, estás entrenando demasiado.',
      'Te pasaste de series.',
      'Necesitás descansar.',
      'Riesgo de sobreentrenamiento.',
      'No completaste la rutina.',
      'Te faltó una serie.',
      'Te falta una serie.',
      'Vas atrasado.',
      'Fallaste la última.',
      'Perdiste la racha.',
      'Recuperá.',
      'Quemá calorías.',
      'Tonifica los brazos.',
      'Estirar previene lesiones.',
      'Tus músculos necesitan 48 horas.',
      'Estás cansada.',
      'Hoy estás en ámbar.',
      'Hoy estás en rojo.',
      'Vas a lograr la dominada.',
      'Deberías entrenar más.',
      'Es un fracaso.',
    ]) {
      expect(loProhibido(frase), frase).not.toBeNull()
    }
  })

  it('deja el hito, en plural y en singular', () => {
    // T3 deja "Te faltan N" como está, y es el único "faltan" que se dice.
    expect(loProhibido('Te faltan 7 para llegar a 10.')).toBeNull()
    expect(loProhibido('Te falta 1 para llegar a 10.')).toBeNull()
  })

  it('no confunde una palabra con otra que empieza igual', () => {
    // Los bordes son letras de verdad, también las acentuadas.
    expect(loProhibido('Recuperar el aire entre series.')).toBeNull()
    expect(loProhibido('Hay que poner atrás la cadera.')).toBeNull()
    expect(loProhibido('Empuje ya se leyó hoy a las 9:10: esta sesión sumó volumen.')).toBeNull()
  })
})
