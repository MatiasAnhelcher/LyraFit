import { describe, expect, it } from 'vitest'
import {
  FORMATOS,
  anteriorDelMismo,
  cuentaEnLaVuelta,
  peorPorEjercicio,
  registrosDelReloj,
  vueltaSinPausa,
  FORMATO_POR_DEFECTO,
  FORMATO_POR_ID,
  PREPARACION,
  TOPE_DE_EJERCICIOS,
  dichoDelTramo,
  duracionDelReloj,
  peorVuelta,
  planDelReloj,
  rotuloDelTramo,
  vueltasSinContar,
  type Tramo,
} from './reloj'

const tabata = FORMATO_POR_ID.get('tabata')!
const emom = FORMATO_POR_ID.get('emom')!

const trabajos = (tramos: Tramo[]) =>
  tramos.filter((t): t is Extract<Tramo, { clase: 'trabajo' }> => t.clase === 'trabajo')

describe('los formatos', () => {
  it('el tabata es el de verdad: veinte, diez, ocho', () => {
    // Si alguna vez alguien lo "mejora" a 30/15, dejó de ser un tabata y la
    // palabra pasa a mentir. Es el único formato de los cuatro cuyo nombre es
    // un protocolo publicado.
    expect(tabata).toMatchObject({ trabajo: 20, pausa: 10, vueltas: 8 })
  })

  it('el tabata entero dura exactamente cuatro minutos', () => {
    // Y sale redondo por casualidad feliz: el protocolo son 8×(20+10) = 240,
    // acá se saca la última pausa —que no sirve para nada— y se agregan los
    // diez de preparación, que es el mismo número. Cuatro minutos clavados,
    // preparación incluida.
    expect(duracionDelReloj(tabata, ['flexion-completa'])).toBe(4 * 60)
  })

  it('el formato por defecto existe y es el tabata', () => {
    expect(FORMATO_POR_ID.get(FORMATO_POR_DEFECTO)).toBeDefined()
    expect(FORMATO_POR_DEFECTO).toBe('tabata')
  })

  it('ninguno tiene números imposibles', () => {
    for (const f of FORMATOS) {
      expect(f.trabajo, f.id).toBeGreaterThan(0)
      expect(f.vueltas, f.id).toBeGreaterThan(0)
      expect(f.pausa, f.id).toBeGreaterThanOrEqual(0)
      expect(f.nota.length, f.id).toBeGreaterThan(20)
      expect(f.nombre.length, f.id).toBeGreaterThan(0)
    }
  })

  it('los ids no se repiten', () => {
    expect(new Set(FORMATOS.map((f) => f.id)).size).toBe(FORMATOS.length)
  })

  it('ninguno pasa de veinte minutos', () => {
    // Un reloj de intervalos que dura media hora dejó de ser un reloj de
    // intervalos: es una sesión, y para eso está la sesión.
    for (const f of FORMATOS) {
      expect(duracionDelReloj(f, ['x']), f.id).toBeLessThanOrEqual(20 * 60)
    }
  })
})

describe('el plan', () => {
  it('arranca preparando, siempre', () => {
    // Sin esto la primera vuelta empieza con el teléfono en la mano.
    for (const f of FORMATOS) {
      expect(planDelReloj(f, ['x'])[0], f.id).toEqual({
        clase: 'preparacion',
        segundos: PREPARACION,
      })
    }
  })

  it('el tabata da ocho trabajos y siete pausas', () => {
    const plan = planDelReloj(tabata, ['flexion-completa'])
    expect(plan.filter((t) => t.clase === 'trabajo')).toHaveLength(8)
    expect(plan.filter((t) => t.clase === 'pausa')).toHaveLength(7)
    expect(plan).toHaveLength(16)
  })

  it('la última vuelta no lleva pausa', () => {
    // Un reloj que te hace esperar diez segundos al final para decirte que
    // terminaste no entendió para qué está la pausa.
    const plan = planDelReloj(tabata, ['x'])
    expect(plan[plan.length - 1]!.clase).toBe('trabajo')
  })

  it('los ejercicios rotan vuelta por vuelta', () => {
    const plan = planDelReloj(tabata, ['flexiones', 'sentadillas'])
    expect(trabajos(plan).map((t) => t.ejercicioId)).toEqual([
      'flexiones', 'sentadillas', 'flexiones', 'sentadillas',
      'flexiones', 'sentadillas', 'flexiones', 'sentadillas',
    ])
  })

  it('con tres ejercicios y ocho vueltas, la rotación da la vuelta', () => {
    const plan = planDelReloj(tabata, ['a', 'b', 'c'])
    expect(trabajos(plan).map((t) => t.ejercicioId)).toEqual([
      'a', 'b', 'c', 'a', 'b', 'c', 'a', 'b',
    ])
  })

  it('con uno solo, las ocho vueltas son de ese', () => {
    const plan = planDelReloj(tabata, ['flexion-completa'])
    expect(new Set(trabajos(plan).map((t) => t.ejercicioId))).toEqual(
      new Set(['flexion-completa']),
    )
  })

  it('las vueltas se numeran desde cero y sin saltos', () => {
    expect(trabajos(planDelReloj(tabata, ['x'])).map((t) => t.vuelta)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ])
  })

  it('el EMOM no tiene pausas y cada vuelta dura un minuto', () => {
    // La pausa del EMOM es lo que te sobra del minuto, y eso lo decide tu
    // cuerpo, no el reloj.
    const plan = planDelReloj(emom, ['x'])
    expect(plan.some((t) => t.clase === 'pausa')).toBe(false)
    expect(trabajos(plan).every((t) => t.segundos === 60)).toBe(true)
  })

  it('sin ejercicios no hay plan, en vez de un plan vacío de tramos', () => {
    expect(planDelReloj(tabata, [])).toEqual([])
    expect(duracionDelReloj(tabata, [])).toBe(0)
  })

  it('se puede rotar hasta el tope sin que nada se rompa', () => {
    const muchos = Array.from({ length: TOPE_DE_EJERCICIOS }, (_, i) => `e${i}`)
    expect(trabajos(planDelReloj(tabata, muchos))).toHaveLength(8)
  })
})

describe('el puntaje', () => {
  it('es la peor vuelta, no el total ni el promedio', () => {
    // Un total premia salir a lo loco y apagarse en la quinta. La peor vuelta
    // premia sostener, que es lo que el protocolo mide.
    expect(peorVuelta([12, 11, 9, 10, 9, 8, 8, 7])).toBe(7)
  })

  it('las vueltas sin contar se ignoran, y no valen cero', () => {
    expect(peorVuelta([10, null, 8, null])).toBe(8)
    expect(vueltasSinContar([10, null, 8, null])).toBe(2)
  })

  it('sin ninguna contada no hay puntaje, y eso no es cero', () => {
    // Decir cero sería afirmar que no hizo nada.
    expect(peorVuelta([null, null])).toBeNull()
    expect(peorVuelta([])).toBeNull()
  })

  it('un cero contado sí es cero', () => {
    // No es lo mismo "no lo conté" que "no me salió ninguna".
    expect(peorVuelta([10, 0, 8])).toBe(0)
  })
})

describe('lo que se dice y lo que se muestra', () => {
  const plan = planDelReloj(tabata, ['flexiones'])

  it('ningún tramo se queda sin rótulo ni sin dicho', () => {
    for (const tramo of plan) {
      expect(rotuloDelTramo(tramo).length).toBeGreaterThan(0)
      expect(dichoDelTramo(tramo, 'Flexiones', tabata.vueltas).length).toBeGreaterThan(0)
    }
  })

  it('la voz nombra el ejercicio al entrar en trabajo', () => {
    // Es lo único que no se puede adivinar, y en una rotación cambia cada vuelta.
    const primero = trabajos(plan)[0]!
    expect(dichoDelTramo(primero, 'Flexiones', 8)).toContain('Flexiones')
  })

  it('la última vuelta se canta como última', () => {
    const ultima = trabajos(plan)[7]!
    expect(dichoDelTramo(ultima, 'Flexiones', 8)).toMatch(/^Última/)
  })

  it('sin nombre no queda un punto colgando', () => {
    // Medido con la voz falsa en el portón: la preparación decía "Preparate. ."
    // porque la preparación no tiene ejercicio propio y se le pasaba el nombre
    // vacío. Ahora la pantalla le pasa el ejercicio que VIENE, y si igual
    // llegara vacío, lo que se dice sigue siendo una frase.
    expect(dichoDelTramo(plan[0]!, '', 8)).toBe('Preparate.')
    expect(dichoDelTramo(trabajos(plan)[0]!, '  ', 8)).toBe('Ya.')
  })

  it('la pausa canta el ejercicio que viene solo si es otro', () => {
    const pausa = plan.find((t) => t.clase === 'pausa')!
    expect(dichoDelTramo(pausa, '', 8)).toBe('Aflojá.')
    expect(dichoDelTramo(pausa, '', 8, 'Sentadillas')).toBe('Aflojá. Viene Sentadillas.')
  })

  it('lo que se dice es corto: tapa el primer segundo de trabajo', () => {
    // En una vuelta de veinte segundos, dos segundos de voz son el diez por
    // ciento. El tope de `voz.ts` es 80 caracteres.
    for (const tramo of plan) {
      expect(dichoDelTramo(tramo, 'Dominadas con banda liviana', 8).length).toBeLessThanOrEqual(80)
      expect(
        dichoDelTramo(tramo, 'Dominadas con banda liviana', 8, 'Sentadilla búlgara al banco')
          .length,
      ).toBeLessThanOrEqual(80)
    }
  })
})

describe('el puntaje de una rotación', () => {
  const plan = planDelReloj(tabata, ['flexiones', 'sentadillas'])

  it('es uno por ejercicio, porque un mínimo entre los dos no dice nada', () => {
    // Las vueltas pares son flexiones y las impares sentadillas. El mínimo de
    // las ocho daría 9 —las flexiones— y eso no es un puntaje: es la noticia de
    // que las flexiones son más duras que las sentadillas.
    const puntajes = peorPorEjercicio(plan, [12, 24, 11, 22, 10, 20, 9, 18])
    expect(puntajes).toEqual([
      { ejercicioId: 'flexiones', peor: 9, vueltas: 4, sinContar: 0 },
      { ejercicioId: 'sentadillas', peor: 18, vueltas: 4, sinContar: 0 },
    ])
  })

  it('con un solo ejercicio da un solo puntaje: el clásico', () => {
    const puntajes = peorPorEjercicio(planDelReloj(tabata, ['x']), [12, 11, 10, 9, 9, 8, 8, 7])
    expect(puntajes).toEqual([{ ejercicioId: 'x', peor: 7, vueltas: 8, sinContar: 0 }])
  })

  it('cuenta las sin contar por ejercicio, no en total', () => {
    const puntajes = peorPorEjercicio(plan, [12, null, 11, null, 10, null, 9, null])
    expect(puntajes[0]).toEqual({ ejercicioId: 'flexiones', peor: 9, vueltas: 4, sinContar: 0 })
    expect(puntajes[1]).toEqual({
      ejercicioId: 'sentadillas',
      peor: null,
      vueltas: 4,
      sinContar: 4,
    })
  })

  it('respeta el orden en que se eligieron', () => {
    const puntajes = peorPorEjercicio(planDelReloj(tabata, ['b', 'a']), [])
    expect(puntajes.map((p) => p.ejercicioId)).toEqual(['b', 'a'])
  })
})

describe('qué número se ofrece para anotar', () => {
  const plan = planDelReloj(tabata, ['flexiones', 'sentadillas'])

  it('es la vuelta anterior DEL MISMO ejercicio, no la anterior a secas', () => {
    // Es el error que tenía la pantalla: en la vuelta 3 —flexiones— ofrecía las
    // veinticuatro sentadillas de la vuelta 2, y alguien con el pulso a ciento
    // ochenta lo acepta de un toque.
    expect(anteriorDelMismo(plan, [12, 24, null, null, null, null, null, null], 2)).toBe(12)
    expect(anteriorDelMismo(plan, [12, 24, null, null, null, null, null, null], 3)).toBe(24)
  })

  it('salta las vueltas que no se contaron y busca más atrás', () => {
    expect(anteriorDelMismo(plan, [12, 24, null, null, null, null, null, null], 4)).toBe(12)
  })

  it('en la primera vuelta de un ejercicio no hay nada que ofrecer', () => {
    expect(anteriorDelMismo(plan, [], 0)).toBeUndefined()
    expect(anteriorDelMismo(plan, [12], 1)).toBeUndefined()
  })
})

describe('dónde hay lugar para anotar', () => {
  it('en el EMOM la cuenta va en la vuelta, porque no hay pausa', () => {
    // Sin esto el EMOM no tenía NINGÚN momento para anotar y el formato entero
    // quedaba sin puntaje: ocho vueltas y "no contaste ninguna".
    expect(cuentaEnLaVuelta(emom)).toBe(true)
    expect(cuentaEnLaVuelta(tabata)).toBe(false)
  })

  it('la última vuelta de un tabata se cuenta al final, porque no tiene pausa', () => {
    // Y es justo la vuelta que más importa: la más dura, la que suele SER el
    // puntaje. Antes quedaba sin contar siempre.
    expect(vueltaSinPausa(tabata)).toBe(7)
    expect(vueltaSinPausa(emom)).toBeNull()
  })
})

describe('lo que se guarda', () => {
  const opciones = [
    {
      id: 'flexion-completa',
      nombre: 'Flexiones',
      ejercicioId: 'flexion-completa',
      grupo: 'tuyos' as const,
      enSegundos: false,
      etiqueta: 'empuje',
    },
    { id: 'rafaga:trote', nombre: 'Trote', grupo: 'cardio' as const, enSegundos: false, etiqueta: 'cardio' },
  ]

  it('un registro por ejercicio, con todas sus vueltas como series', () => {
    const plan = planDelReloj(tabata, ['flexion-completa'])
    const registros = registrosDelReloj(plan, [12, 11, 10, 10, 9, 9, 8, 8], opciones)
    expect(registros).toHaveLength(1)
    expect(registros[0]!.series.map((s) => s.logrado)).toEqual([12, 11, 10, 10, 9, 9, 8, 8])
    expect(registros[0]!.reloj).toBe(true)
  })

  it('va marcado como reloj, que es lo que lo mantiene fuera de la curva', () => {
    const plan = planDelReloj(tabata, ['flexion-completa'])
    for (const r of registrosDelReloj(plan, [10], opciones)) expect(r.reloj).toBe(true)
  })

  it('las ráfagas no entran: no tienen patrón ni cadena', () => {
    const plan = planDelReloj(tabata, ['rafaga:trote'])
    expect(registrosDelReloj(plan, [10, 10, 10, 10, 10, 10, 10, 10], opciones)).toEqual([])
  })

  it('las vueltas sin contar quedan en cero, y el volumen se conserva', () => {
    // El cero es lo único que `Serie.logrado` admite para "no sé cuántas", y es
    // seguro porque todo lector que lo malinterpretaría saltea el reloj. Lo que
    // NO se puede perder son las series: ocho vueltas son ocho series.
    const plan = planDelReloj(tabata, ['flexion-completa'])
    const registros = registrosDelReloj(plan, [12, null, null, null, null, null, null, null], opciones)
    expect(registros[0]!.series).toHaveLength(8)
    expect(registros[0]!.series.map((s) => s.logrado)).toEqual([12, 0, 0, 0, 0, 0, 0, 0])
  })

  it('con rotación, cada ejercicio se lleva sus propias vueltas', () => {
    const dos = [
      opciones[0]!,
      {
        id: 'sentadilla-completa',
        nombre: 'Sentadillas',
        ejercicioId: 'sentadilla-completa',
        grupo: 'tuyos' as const,
        enSegundos: false,
        etiqueta: 'piernas',
      },
    ]
    const plan = planDelReloj(tabata, ['flexion-completa', 'sentadilla-completa'])
    const registros = registrosDelReloj(plan, [12, 24, 11, 22, 10, 20, 9, 18], dos)
    expect(registros.map((r) => r.ejercicioId)).toEqual(['flexion-completa', 'sentadilla-completa'])
    expect(registros[0]!.series.map((s) => s.logrado)).toEqual([12, 11, 10, 9])
    expect(registros[1]!.series.map((s) => s.logrado)).toEqual([24, 22, 20, 18])
  })
})
