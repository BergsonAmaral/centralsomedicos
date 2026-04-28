import { defineStore } from 'pinia'
import type { Agendamento } from '~/types'

export const useFilaStore = defineStore('fila', () => {
  const agendados = ref<Agendamento[]>([])
  const filaAtiva = ref<Agendamento[]>([])
  const finalizados = ref<Agendamento[]>([])
  const medicosFiltro = ref<string | null>(null)

  // Posição calculada dinamicamente — nunca campo salvo
  function getPosicao(id: string): number {
    return filaAtiva.value.findIndex((a) => a.id === id) + 1
  }

  return {
    agendados,
    filaAtiva,
    finalizados,
    medicosFiltro,
    getPosicao,
  }
})
