/**
 * Validação de CPF pelos dígitos verificadores.
 *
 * Antes só se conferia o tamanho (11 dígitos), então valores como
 * 111.111.111-11 ou um número digitado errado entravam na base e só
 * apareciam como problema na hora de emitir documento ou faturar.
 */
export function cpfValido(valor: string): boolean {
  const cpf = (valor ?? '').replace(/\D/g, '')

  if (cpf.length !== 11) return false
  // Sequências repetidas (000..., 111...) passam no cálculo mas não existem
  if (/^(\d)\1{10}$/.test(cpf)) return false

  const digitoVerificador = (atePosicao: number): number => {
    let soma = 0
    let peso = atePosicao + 1
    for (let i = 0; i < atePosicao; i++) {
      soma += Number(cpf[i]) * peso--
    }
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }

  return digitoVerificador(9) === Number(cpf[9])
    && digitoVerificador(10) === Number(cpf[10])
}

/** Formata para 000.000.000-00 (mantém o que já foi digitado). */
export function formatarCPF(valor: string): string {
  const cpf = (valor ?? '').replace(/\D/g, '').slice(0, 11)
  return cpf
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}
