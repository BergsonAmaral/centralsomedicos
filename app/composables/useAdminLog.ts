export type AdminLogAcao =
  | 'login'
  | 'logout'
  | 'paciente_criado'
  | 'paciente_editado'
  | 'paciente_excluido'
  | 'medico_criado'
  | 'medico_editado'
  | 'medico_pausado'
  | 'medico_ativado'
  | 'atendente_criado'
  | 'atendente_editado'
  | 'atendente_excluido'
  | 'admin_criado'
  | 'admin_excluido'
  | 'paciente_chamado'
  | 'paciente_recolocado_fila'
  | 'agendamento_criado'
  | 'agendamento_cancelado'
  | 'importacao_sus'
  | 'consulta_encerrada'
  | 'documento_emitido'

export interface AdminLog {
  id: string
  admin_id: string | null
  admin_email: string | null
  acao: AdminLogAcao
  entidade: string | null
  entidade_id: string | null
  detalhes: Record<string, any>
  created_at: string
}

export const useAdminLog = () => {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  async function registrar(
    acao: AdminLogAcao,
    opts: {
      entidade?: string
      entidadeId?: string
      detalhes?: Record<string, any>
    } = {}
  ) {
    if (!user.value) return
    try {
      await supabase.from('admin_logs').insert({
        admin_id: user.value.id,
        admin_email: user.value.email ?? null,
        acao,
        entidade: opts.entidade ?? null,
        entidade_id: opts.entidadeId ?? null,
        detalhes: opts.detalhes ?? {},
      })
    } catch (e) {
      // log nunca quebra a operação principal
      console.warn('[admin-log] falha ao registrar', e)
    }
  }

  async function listar(opts: {
    limite?: number
    desde?: string
    acao?: AdminLogAcao
  } = {}) {
    let q = supabase
      .from('admin_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(opts.limite ?? 100)

    if (opts.desde) q = q.gte('created_at', opts.desde)
    if (opts.acao) q = q.eq('acao', opts.acao)

    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as AdminLog[]
  }

  return { registrar, listar }
}
