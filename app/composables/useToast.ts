/**
 * Notificações globais de feedback (salvou, erro, etc).
 *
 * Antes, salvar um cadastro simplesmente fechava o modal ou navegava de
 * volta — o usuário não tinha confirmação nenhuma de que deu certo.
 */
export type ToastTipo = 'sucesso' | 'erro' | 'info'

export interface Toast {
  id: number
  tipo: ToastTipo
  mensagem: string
}

let proximoId = 0

export const useToast = () => {
  // useState mantém a lista compartilhada entre todos os componentes
  const toasts = useState<Toast[]>('toasts', () => [])

  function remover(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function mostrar(mensagem: string, tipo: ToastTipo = 'sucesso', duracaoMs = 3500) {
    const id = ++proximoId
    toasts.value = [...toasts.value, { id, tipo, mensagem }]
    if (import.meta.client) {
      setTimeout(() => remover(id), duracaoMs)
    }
    return id
  }

  return {
    toasts,
    remover,
    mostrar,
    sucesso: (msg: string) => mostrar(msg, 'sucesso'),
    erro: (msg: string) => mostrar(msg, 'erro', 6000),
    info: (msg: string) => mostrar(msg, 'info'),
  }
}
