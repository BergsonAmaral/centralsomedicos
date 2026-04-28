import type { Agendamento, Triagem } from '~/types'
import { useFilaStore } from '~/stores/fila'

export const useFila = () => {
  const supabase = useSupabaseClient()
  const filaStore = useFilaStore()

  // hoje em horário local (não UTC) — recalculado a cada chamada
  function dataHoje(): string {
    const d = new Date()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  let channel: ReturnType<typeof supabase.channel> | null = null

  // Posição calculada dinamicamente — nunca campo salvo
  const getPosicao = (id: string) => filaStore.getPosicao(id)

  async function carregar(medicoId?: string | null) {
    let q = supabase
      .from('agendamentos')
      .select('*, pacientes(*), medicos(id, nome, especialidade, meet_link, sala_slug, crm, pausado)')
      .eq('data_consulta', dataHoje())

    if (medicoId) q = q.eq('medico_id', medicoId)

    const { data } = await q
    if (!data) return

    filaStore.agendados = data.filter((a: Agendamento) => a.status === 'agendado')
    filaStore.finalizados = data.filter((a: Agendamento) =>
      ['concluido', 'faltou', 'cancelado', 'aguardando_avaliacao'].includes(a.status)
    )
    filaStore.filaAtiva = data
      .filter((a: Agendamento) =>
        ['checkin', 'aguardando_medico', 'aguardando_paciente', 'em_consulta'].includes(a.status)
      )
      .sort(
        (a: Agendamento, b: Agendamento) =>
          new Date(a.checkin_em ?? a.created_at).getTime() -
          new Date(b.checkin_em ?? b.created_at).getTime()
      )
  }

  async function fazerCheckin(id: string, triagem: Triagem) {
    return supabase
      .from('agendamentos')
      .update({
        status: 'checkin',
        checkin_em: new Date().toISOString(),
        triagem,
      })
      .eq('id', id)
  }

  // ADMIN chama → médico recebe modal de aceite (medicoId e salaSlug opcionais)
  async function chamar(id: string, medicoId?: string, salaSlug?: string) {
    const updates: Record<string, any> = {
      status: 'aguardando_medico',
      chamado_em: new Date().toISOString(),
    }
    if (medicoId) updates.medico_id = medicoId
    if (salaSlug !== undefined) updates.sala_slug = salaSlug
    return supabase.from('agendamentos').update(updates).eq('id', id)
  }

  // MÉDICO aceita → paciente recebe botão "Entrar na consulta"
  async function aceitarMedico(id: string) {
    return supabase
      .from('agendamentos')
      .update({ status: 'aguardando_paciente' })
      .eq('id', id)
  }

  // MÉDICO chama diretamente da fila (sem passar pelo modal do admin)
  async function medicoIniciarConsulta(id: string) {
    return supabase
      .from('agendamentos')
      .update({ status: 'aguardando_paciente', chamado_em: new Date().toISOString() })
      .eq('id', id)
  }

  // MÉDICO recusa → volta para fila
  async function recusarMedico(id: string) {
    return supabase
      .from('agendamentos')
      .update({ status: 'checkin', chamado_em: null })
      .eq('id', id)
  }

  // PACIENTE clica "Entrar" → consulta inicia
  async function entrarConsulta(id: string) {
    return supabase
      .from('agendamentos')
      .update({ status: 'em_consulta' })
      .eq('id', id)
  }

  async function encerrar(id: string) {
    return supabase
      .from('agendamentos')
      .update({
        status: 'aguardando_avaliacao',
        encerrado_em: new Date().toISOString(),
      })
      .eq('id', id)
  }

  async function marcarFaltou(id: string) {
    return supabase.from('agendamentos').update({ status: 'faltou' }).eq('id', id)
  }

  function subscrever(medicoId?: string | null) {
    if (channel) supabase.removeChannel(channel)

    channel = supabase
      .channel('fila-realtime-admin')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'agendamentos' },
        () => carregar(medicoId)
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agendamentos' },
        () => carregar(medicoId)
      )
      .subscribe()
  }

  function desinscrever() {
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }
  }

  return {
    agendados: computed(() => filaStore.agendados),
    filaAtiva: computed(() => filaStore.filaAtiva),
    finalizados: computed(() => filaStore.finalizados),
    getPosicao,
    carregar,
    fazerCheckin,
    chamar,
    aceitarMedico,
    medicoIniciarConsulta,
    recusarMedico,
    entrarConsulta,
    encerrar,
    marcarFaltou,
    subscrever,
    desinscrever,
  }
}
