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

  // Colunas mínimas necessárias — evita buscar campos pesados desnecessariamente
  const SELECT_COLS = [
    'id', 'status', 'data_consulta', 'motivo', 'observacoes', 'origem',
    'checkin_em', 'chamado_em', 'encerrado_em', 'triagem', 'sala_slug',
    'paciente_id', 'medico_id', 'created_at',
    'pacientes(id,nome,cpf,data_nascimento,sexo,telefone,email,sus_cartao,unidade_id,unidades(id,nome))',
    'medicos(id,nome,especialidade,crm,pausado)',
  ].join(',')

  async function carregar(medicoId?: string | null) {
    let q = supabase
      .from('agendamentos')
      .select(SELECT_COLS)
      .eq('data_consulta', dataHoje())

    if (medicoId) q = q.eq('medico_id', medicoId)

    const { data } = await q
    if (!data) return

    _distribuirNaStore(data as Agendamento[])
  }

  function _distribuirNaStore(data: Agendamento[]) {
    filaStore.agendados = data.filter((a) => a.status === 'agendado')
    filaStore.finalizados = data.filter((a) =>
      ['concluido', 'faltou', 'cancelado', 'aguardando_avaliacao'].includes(a.status)
    )
    filaStore.filaAtiva = data
      .filter((a) =>
        ['checkin', 'aguardando_medico', 'aguardando_paciente', 'em_consulta'].includes(a.status)
      )
      .sort(
        (a, b) =>
          new Date(a.checkin_em ?? a.created_at).getTime() -
          new Date(b.checkin_em ?? b.created_at).getTime()
      )
  }

  // Aplica patch de um registro já carregado — evita recarregar tudo
  async function _patchRegistro(id: string) {
    const { data } = await supabase
      .from('agendamentos')
      .select(SELECT_COLS)
      .eq('id', id)
      .single()
    if (!data) return

    const ag = data as Agendamento
    const todas = [
      ...filaStore.agendados,
      ...filaStore.filaAtiva,
      ...filaStore.finalizados,
    ]
    const semEste = todas.filter((a) => a.id !== id)
    _distribuirNaStore([...semEste, ag])
  }

  async function fazerCheckin(id: string, triagem: Triagem, salaSlug?: string | null) {
    const updates: Record<string, any> = {
      status: 'checkin',
      checkin_em: new Date().toISOString(),
      triagem,
    }
    if (salaSlug !== undefined) updates.sala_slug = salaSlug
    return supabase.from('agendamentos').update(updates).eq('id', id)
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
    return supabase
      .from('agendamentos')
      .update({ status: 'faltou' })
      .eq('id', id)
      .in('status', ['agendado', 'checkin'])
  }

  // ADMIN desfaz o encaminhamento → paciente volta para a fila.
  // Serve quando o médico não responde, o paciente desiste ou o
  // atendimento trava em algum estado intermediário.
  async function voltarParaFila(id: string) {
    return supabase
      .from('agendamentos')
      .update({ status: 'checkin', chamado_em: null })
      .eq('id', id)
      .in('status', ['aguardando_medico', 'aguardando_paciente', 'em_consulta'])
  }

  // ADMIN cancela o atendimento de vez, de qualquer estado ativo.
  async function cancelarAtendimento(id: string) {
    return supabase
      .from('agendamentos')
      .update({ status: 'cancelado', encerrado_em: new Date().toISOString() })
      .eq('id', id)
      .in('status', ['agendado', 'checkin', 'aguardando_medico', 'aguardando_paciente', 'em_consulta'])
  }

  function subscrever(medicoId?: string | null) {
    if (channel) supabase.removeChannel(channel)

    channel = supabase
      .channel('fila-realtime-admin')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'agendamentos' },
        (payload) => {
          const id = payload.new?.id
          // Se o registro já está na store, só atualiza ele (mais rápido)
          // Se é novo (INSERT via upsert) ou não está na store, recarrega tudo
          const todas = [...filaStore.agendados, ...filaStore.filaAtiva, ...filaStore.finalizados]
          if (id && todas.some((a) => a.id === id)) {
            _patchRegistro(id)
          } else {
            carregar(medicoId)
          }
        }
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
    voltarParaFila,
    cancelarAtendimento,
    subscrever,
    desinscrever,
  }
}
