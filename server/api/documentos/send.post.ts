export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { documentoId, canal, telefone, email } = body as {
    documentoId: string
    canal: 'whatsapp' | 'email' | 'sms'
    telefone?: string
    email?: string
  }

  if (!documentoId || !canal) {
    throw createError({ statusCode: 400, statusMessage: 'documentoId e canal são obrigatórios' })
  }

  const supabase = useSupabaseClient(event)

  const { error } = await supabase
    .from('documentos')
    .update({ status: 'enviado_paciente', enviado_via: canal })
    .eq('id', documentoId)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return { success: true }
})
