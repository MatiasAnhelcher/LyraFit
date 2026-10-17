import { describe, expect, it } from 'vitest'
import { POR_ID, cadenaDe } from './biblioteca'
import { siguienteAvance } from './progresion'
import type { Avance } from './tipos'

const BARRA = { pesoCorporalKg: 75, cargaMaximaKg: 45, pasoDeDiscoKg: 2.5 }
const ID = 'dominada-un-brazo-asistida'
const E = POR_ID.get(ID)!
const ctx = { cadena: cadenaDe('traccion'), ejercicios: POR_ID, barra: BARRA }

describe('verificacion', () => {
  it('meseta baja con discos puestos', () => {
    let avance: Avance = {
      patron: 'traccion',
      ejercicioId: ID,
      objetivoActual: { series: E.series, cantidad: E.ventana.min, kg: 20 },
      senal: 0.8,
      sesionesEnObjetivo: 0,
      graciaRestante: 0,
      actualizadoEn: 0,
    }
    for (let i = 0; i < 6; i++) {
      const d = siguienteAvance(avance, { rendimiento: 0.8, tipico: 2 }, ctx, 0)
      console.log(
        `#${i} ${d.movimiento} nivel:${d.cambioDeNivel} ej:${d.avance.ejercicioId} cant:${d.avance.objetivoActual.cantidad} kg:${d.avance.objetivoActual.kg} senal:${d.avance.senal.toFixed(3)} seo:${d.avance.sesionesEnObjetivo} gr:${d.avance.graciaRestante}`,
      )
      avance = d.avance
      if (d.cambioDeNivel) break
    }
    console.log('FINAL', JSON.stringify(avance))
    expect(true).toBe(true)
  })
})
