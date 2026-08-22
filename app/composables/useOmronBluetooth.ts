/**
 * useOmronBluetooth — Protocolo proprietário Omron BLE (HEM-7155T / HEM-7156T)
 *
 * Baseado em: https://github.com/userx14/omblepy
 *
 * Fluxo:
 *   1. requestDevice (filtra por service UUID proprietário Omron)
 *   2. Unlock: escreve [0x01 + chave 16 bytes] na característica de unlock
 *   3. Start TX: envia comando de início de transmissão pelo canal TX 0
 *   4. Lê 60 registros de EEPROM a partir do endereço 0x0098 (usuário 1)
 *   5. End TX: encerra sessão
 *   6. Retorna a medição mais recente: { sistolica, diastolica, pulso }
 *
 * IMPORTANTE:
 *   - Funciona APENAS em Chrome/Edge (Web Bluetooth API)
 *   - Exige HTTPS (ou localhost)
 *   - Deve ser chamado a partir de um clique do usuário (gesto)
 *   - Primeira vez: executar parear() para gravar a chave no aparelho
 */

// ─── UUIDs proprietários Omron ────────────────────────────────────────────────

const OMRON_SERVICE = 'ecbe3980-c9a2-11e1-b1bd-0002a5d5c51b'
const OMRON_UNLOCK  = 'b305b680-aee7-11e1-a730-0002a5d5c51b'

const OMRON_RX = [
  '49123040-aee8-11e1-a74d-0002a5d5c51b', // canal 0
  '4d0bf320-aee8-11e1-a0d9-0002a5d5c51b', // canal 1
  '5128ce60-aee8-11e1-b84b-0002a5d5c51b', // canal 2
  '560f1420-aee8-11e1-8184-0002a5d5c51b', // canal 3
]

const OMRON_TX = [
  'db5b55e0-aee7-11e1-965e-0002a5d5c51b', // canal 0
  'e0b8a060-aee7-11e1-92f4-0002a5d5c51b', // canal 1
  '0ae12b00-aee8-11e1-a192-0002a5d5c51b', // canal 2
  '10e1ba60-aee8-11e1-89e5-0002a5d5c51b', // canal 3
]

// Chave padrão de fábrica Omron
const OMRON_KEY = new Uint8Array([
  0xde, 0xad, 0xbe, 0xaf, 0x12, 0x34, 0x12, 0x34,
  0xde, 0xad, 0xbe, 0xaf, 0x12, 0x34, 0x12, 0x34,
])

// EEPROM: usuário 1 começa em 0x0098, 60 registros de 16 bytes cada
const EEPROM_USER1_START = 0x0098
const RECORDS_COUNT      = 60
const RECORD_SIZE        = 16

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface OmronMedicao {
  sistolica:  number
  diastolica: number
  pulso:      number
  irregular:  boolean
  ano:        number
  mes:        number
  dia:        number
  hora:       number
  minuto:     number
  segundo:    number
}

// ─── Helpers de protocolo ─────────────────────────────────────────────────────

function xorCrc(bytes: number[]): number {
  return bytes.reduce((acc, b) => acc ^ b, 0)
}

// Monta comando TX com CRC (XOR de todos os bytes deve ser 0)
function buildCmd(data: number[]): Uint8Array {
  const crc = xorCrc(data)
  return new Uint8Array([...data, crc])
}

// Monta comando de leitura EEPROM
function eepromReadCmd(address: number, size: number): Uint8Array {
  const addrHi = (address >> 8) & 0xFF
  const addrLo = address & 0xFF
  const data = [0x08, 0x01, 0x00, addrHi, addrLo, size, 0x00]
  return buildCmd(data)
}

// Parseia um registro de 16 bytes (little-endian)
function parseRecord(bytes: Uint8Array): OmronMedicao | null {
  // bits 120-127 = byte 15 → sistólica (raw + 25)
  // bits 112-119 = byte 14 → diastólica
  // bits 104-111 = byte 13 → pulso
  const sistolica  = bytes[15] + 25
  const diastolica = bytes[14]
  const pulso      = bytes[13]

  // Registro vazio/inválido (inclui o caso de a conexão cair no meio da
  // leitura: sobra um buffer zerado ou parcial, que sem essa checagem mais
  // ampla passava como se fosse uma medição real, tipo sistólica 25/0/1).
  if (diastolica === 0 || pulso === 0) return null
  // Valores impossíveis
  if (sistolica > 300 || diastolica > 200 || pulso > 250) return null

  // Timestamp (bit-fields little-endian)
  const ano    = ((bytes[12] >> 2) & 0x3F) + 2000
  const hora   = (bytes[11] >> 3) & 0x1F
  const dia    = ((bytes[10] >> 6) & 0x03) | ((bytes[11] & 0x07) << 2)
  const mes    = (bytes[10] >> 2) & 0x0F
  const segundo = Math.min((bytes[9] >> 2) & 0x3F, 59) // Omron firmware bug: clamp
  const minuto  = ((bytes[8] >> 4) & 0x0F) | ((bytes[9] & 0x03) << 4)

  // Data implausível (ex: mês 0, dia 0) também indica registro corrompido
  // ou lido durante uma queda de conexão — não é uma medição de verdade.
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null

  // bit 81 = irregular (ihb)
  const irregular = !!(bytes[10] & 0x02)

  return { sistolica, diastolica, pulso, irregular, ano, mes, dia, hora, minuto, segundo }
}

// ─── Composable ──────────────────────────────────────────────────────────────

export function useOmronBluetooth() {
  type Status = 'idle' | 'conectando' | 'pareando' | 'lendo' | 'sucesso' | 'erro'

  const status   = ref<Status>('idle')
  const mensagem = ref('')
  const medicao  = ref<OmronMedicao | null>(null)
  // Nome do último aparelho escolhido no seletor Bluetooth — mostrado na UI
  // (sucesso ou erro) pra ajudar a identificar o Omron manualmente, já que
  // a lista mostra todo Bluetooth por perto e não dá pra filtrar pelo nome
  // sem saber qual é de antemão.
  const ultimoNomeDispositivo = ref('')

  const suportado = computed(() =>
    typeof navigator !== 'undefined' && 'bluetooth' in navigator,
  )

  // Buffer multi-canal RX
  let rxBuf: (Uint8Array | null)[] = [null, null, null, null]
  let rxResolve: ((d: Uint8Array) => void) | null = null
  let rxReject:  ((e: Error) => void)      | null = null

  function onRxNotification(idx: number, dv: DataView) {
    rxBuf[idx] = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength)
    flushRx()
  }

  function flushRx() {
    if (!rxBuf[0]) return
    const totalSize = rxBuf[0][0]
    const needed    = Math.ceil(totalSize / 16)
    for (let i = 0; i < needed; i++) {
      if (!rxBuf[i]) return
    }
    // Monta pacote completo
    const raw = new Uint8Array(needed * 16)
    for (let i = 0; i < needed; i++) raw.set(rxBuf[i]!, i * 16)
    const packet = raw.slice(0, totalSize)
    rxBuf = [null, null, null, null]

    // Verifica CRC (XOR de todos os bytes deve ser 0)
    const crc = packet.reduce((a, b) => a ^ b, 0)
    if (crc !== 0) {
      rxReject?.(new Error('Erro de CRC na resposta do aparelho'))
    } else {
      rxResolve?.(packet)
    }
    rxResolve = null
    rxReject  = null
  }

  function aguardarRx(timeoutMs = 10000): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        rxResolve = null
        rxReject  = null
        reject(new Error('Timeout: aparelho não respondeu'))
      }, timeoutMs)
      rxResolve = (d) => { clearTimeout(t); resolve(d) }
      rxReject  = (e) => { clearTimeout(t); reject(e) }
    })
  }

  // Guarda o id do aparelho escolhido pra não precisar reabrir a lista de
  // seleção do navegador toda vez que clicar em "Ler medição" — só na
  // primeira vez (ou se trocar de aparelho/navegador) precisa escolher de
  // novo. O id só é útil dentro do mesmo navegador/computador.
  const DEVICE_ID_KEY = 'omron_device_id'

  async function dispositivoLembrado(): Promise<any | null> {
    try {
      const salvo = localStorage.getItem(DEVICE_ID_KEY)
      if (!salvo || !(navigator as any).bluetooth?.getDevices) return null
      const dispositivos = await (navigator as any).bluetooth.getDevices()
      return dispositivos.find((d: any) => d.id === salvo) ?? null
    } catch {
      return null
    }
  }

  function esquecerDispositivo() {
    localStorage.removeItem(DEVICE_ID_KEY)
  }

  async function conectarDispositivo(forcarEscolha = false) {
    if (!suportado.value) {
      throw new Error('Web Bluetooth não disponível. Use Google Chrome ou Edge.')
    }

    let device = forcarEscolha ? null : await dispositivoLembrado()

    if (device) {
      mensagem.value = `Reconectando a "${device.name || ultimoNomeDispositivo.value}"...`
    } else {
      mensagem.value = 'Aguardando seleção do aparelho...'
      // O HEM-7156T (e outros Omron BLE) não anuncia o serviço proprietário
      // no pacote de advertising — só expõe depois de conectado — então
      // filtrar por serviço (ou por nome — testamos "BLESmart"/"OMRON" e não
      // bateu com o nome real que esse aparelho anuncia) fazia ele nunca
      // aparecer. acceptAllDevices é a única forma confiável de garantir que
      // ele apareça na lista — mostra outros Bluetooth por perto também.
      device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [OMRON_SERVICE],
      })
      // Lembra esse aparelho pras próximas vezes não precisar escolher de
      // novo — só funciona nesse mesmo navegador/computador.
      try { localStorage.setItem(DEVICE_ID_KEY, device.id) } catch { /* ignora se localStorage indisponível */ }
    }
    ultimoNomeDispositivo.value = device.name || '(sem nome)'

    mensagem.value = `Conectando a "${ultimoNomeDispositivo.value}"...`
    let server: any
    try {
      server = await device.gatt.connect()
    } catch (e: any) {
      if (!forcarEscolha) {
        // Aparelho lembrado não respondeu (fora de alcance, desligado etc.)
        // — cai pra pedir escolha manual em vez de simplesmente falhar.
        esquecerDispositivo()
        return conectarDispositivo(true)
      }
      throw e
    }
    let service: any
    try {
      service = await server.getPrimaryService(OMRON_SERVICE)
    } catch {
      esquecerDispositivo()
      throw new Error(`"${ultimoNomeDispositivo.value}" não tem o serviço da Omron — não é esse aparelho. Tente ler de novo e escolha outro da lista.`)
    }

    // Subscreve nos canais RX
    const rxChars: BluetoothRemoteGATTCharacteristic[] = []
    for (let i = 0; i < OMRON_RX.length; i++) {
      const char = await service.getCharacteristic(OMRON_RX[i])
      await char.startNotifications()
      const idx = i
      char.addEventListener('characteristicvaluechanged', (e: any) =>
        onRxNotification(idx, e.target.value),
      )
      rxChars.push(char)
    }

    // Obtém canais TX
    const txChars: BluetoothRemoteGATTCharacteristic[] = []
    for (const uuid of OMRON_TX) {
      txChars.push(await service.getCharacteristic(uuid))
    }

    // Característica de unlock
    const unlockChar = await service.getCharacteristic(OMRON_UNLOCK)

    return { device, server, service, rxChars, txChars, unlockChar }
  }

  async function unlock(unlockChar: BluetoothRemoteGATTCharacteristic) {
    // Subscreve na própria característica de unlock para receber resposta
    let unlockResolve: ((d: Uint8Array) => void) | null = null
    let unlockReject:  ((e: Error) => void)      | null = null

    const onUnlockNotify = (e: any) => {
      const bytes = new Uint8Array((e.target as BluetoothRemoteGATTCharacteristic).value!.buffer)
      unlockResolve?.(bytes)
      unlockResolve = null
      unlockReject  = null
    }

    await unlockChar.startNotifications()
    unlockChar.addEventListener('characteristicvaluechanged', onUnlockNotify)

    const cmd = new Uint8Array([0x01, ...OMRON_KEY])
    await unlockChar.writeValueWithResponse(cmd)

    const response = await new Promise<Uint8Array>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Timeout no unlock')), 8000)
      unlockResolve = (d) => { clearTimeout(t); resolve(d) }
      unlockReject  = (e) => { clearTimeout(t); reject(e) }
    })

    unlockChar.removeEventListener('characteristicvaluechanged', onUnlockNotify)

    if (response[0] !== 0x81 || response[1] !== 0x00) {
      throw new Error(
        `Unlock falhou (resposta: ${response[0].toString(16)} ${response[1].toString(16)}). ` +
        'O aparelho precisa ser pareado primeiro.',
      )
    }
  }

  async function pareamentoUnlock(unlockChar: BluetoothRemoteGATTCharacteristic) {
    let resolve: ((d: Uint8Array) => void) | null = null
    const onNotify = (e: any) => {
      resolve?.(new Uint8Array((e.target as BluetoothRemoteGATTCharacteristic).value!.buffer))
      resolve = null
    }
    await unlockChar.startNotifications()
    unlockChar.addEventListener('characteristicvaluechanged', onNotify)

    const aguardar = (ms = 5000) => new Promise<Uint8Array>((res, rej) => {
      const t = setTimeout(() => rej(new Error('Timeout pareamento')), ms)
      resolve = (d) => { clearTimeout(t); res(d) }
    })

    // Passo 1: entrar em modo de programação de chave
    await unlockChar.writeValueWithResponse(new Uint8Array([0x02, ...new Array(16).fill(0)]))
    const r1 = await aguardar()
    if (r1[0] !== 0x82 || r1[1] !== 0x00) {
      throw new Error('Modo de pareamento não suportado por este aparelho')
    }

    // Passo 2: gravar a chave
    await unlockChar.writeValueWithResponse(new Uint8Array([0x00, ...OMRON_KEY]))
    const r2 = await aguardar()
    if (r2[0] !== 0x80 || r2[1] !== 0x00) {
      throw new Error('Falha ao gravar chave no aparelho')
    }

    unlockChar.removeEventListener('characteristicvaluechanged', onNotify)
  }

  async function enviarComando(txChar: BluetoothRemoteGATTCharacteristic, cmd: Uint8Array) {
    await txChar.writeValueWithResponse(cmd)
  }

  // ─── API pública ─────────────────────────────────────────────────────────

  /**
   * parear() — apenas na primeira vez por aparelho.
   * Grava a chave padrão no aparelho para permitir conexões futuras.
   */
  async function parear() {
    status.value   = 'pareando'
    mensagem.value = 'Iniciando pareamento...'
    medicao.value  = null

    try {
      const { txChars, unlockChar } = await conectarDispositivo()

      mensagem.value = 'Gravando chave no aparelho...'
      await pareamentoUnlock(unlockChar)

      status.value   = 'sucesso'
      mensagem.value = `Pareamento concluído com "${ultimoNomeDispositivo.value}"! Agora use "Ler medição".`
    } catch (e: any) {
      status.value   = 'erro'
      mensagem.value = e?.message ?? 'Erro no pareamento'
    }
  }

  /**
   * ler() — lê a medição mais recente do aparelho.
   * O paciente deve tirar a pressão ANTES de clicar.
   */
  async function ler() {
    status.value   = 'conectando'
    mensagem.value = 'Conectando ao aparelho...'
    medicao.value  = null

    try {
      const { device, txChars, unlockChar } = await conectarDispositivo()

      // Detecta se a conexão cair no meio da leitura (relatado: "o
      // pareamento cai" quando começa a ler). Sem isso, o loop de 60
      // registros ficava tentando de novo a cada timeout de 5s — até 5
      // minutos "rodando" sem avisar nada — e ainda podia devolver lixo
      // como se fosse uma medição válida.
      let desconectado = false
      device.addEventListener('gattserverdisconnected', () => { desconectado = true })

      // Unlock
      mensagem.value = 'Autenticando...'
      await unlock(unlockChar)

      // Start transmission
      mensagem.value = 'Iniciando leitura...'
      const startCmd = buildCmd([0x08, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00])
      // Nota: buildCmd adiciona CRC como último byte, mas start TX já inclui 0x18 como CRC
      // Usando os bytes fixos documentados:
      const startFixed = new Uint8Array([0x08, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x18])

      status.value = 'lendo'
      const startPromise = aguardarRx()
      await enviarComando(txChars[0], startFixed)
      const startResp = await startPromise

      if (startResp[1] !== 0x80 || startResp[2] !== 0x00) {
        throw new Error('Falha ao iniciar transmissão com o aparelho')
      }

      // Lê todos os registros EEPROM
      const registros: OmronMedicao[] = []
      for (let i = 0; i < RECORDS_COUNT; i++) {
        if (desconectado) {
          throw new Error(`Conexão com "${ultimoNomeDispositivo.value}" caiu no meio da leitura (registro ${i}/${RECORDS_COUNT}). Aproxime o aparelho do computador e tente de novo.`)
        }

        const addr = EEPROM_USER1_START + i * RECORD_SIZE
        const cmd  = eepromReadCmd(addr, RECORD_SIZE)

        const rxPromise = aguardarRx(5000)
        await enviarComando(txChars[0], cmd)
        const resp = await rxPromise

        // resp: [size, 0x81, 0x00, data[0..15], CRC]
        if (resp[1] === 0x81 && resp[2] === 0x00) {
          const data = resp.slice(3, 3 + RECORD_SIZE)
          const rec  = parseRecord(data)
          if (rec) registros.push(rec)
        }

        // Pequena pausa entre comandos — ler os 60 registros sem intervalo
        // sobrecarrega o rádio BLE de alguns aparelhos e derruba a conexão
        // no meio do processo.
        await new Promise((resolve) => setTimeout(resolve, 30))
      }

      // End transmission
      const endFixed = new Uint8Array([0x08, 0x0f, 0x00, 0x00, 0x00, 0x00, 0x00, 0x07])
      const endPromise = aguardarRx()
      await enviarComando(txChars[0], endFixed)
      await endPromise

      device.gatt?.disconnect()

      if (registros.length === 0) {
        throw new Error('Nenhuma medição encontrada no aparelho')
      }

      // Ordena por data/hora desc e retorna a mais recente
      registros.sort((a, b) => {
        const da = new Date(a.ano, a.mes - 1, a.dia, a.hora, a.minuto, a.segundo)
        const db = new Date(b.ano, b.mes - 1, b.dia, b.hora, b.minuto, b.segundo)
        return db.getTime() - da.getTime()
      })

      medicao.value  = registros[0]
      status.value   = 'sucesso'
      mensagem.value = `"${ultimoNomeDispositivo.value}" · Medição lida: ${registros[0].sistolica}/${registros[0].diastolica} mmHg · ${registros[0].pulso} bpm`
    } catch (e: any) {
      status.value   = 'erro'
      mensagem.value = e?.message ?? 'Erro ao ler aparelho'
    }
  }

  function resetar() {
    status.value   = 'idle'
    mensagem.value = ''
    medicao.value  = null
    rxBuf          = [null, null, null, null]
    rxResolve      = null
    rxReject       = null
  }

  return { status, mensagem, medicao, suportado, ultimoNomeDispositivo, parear, ler, resetar, esquecerDispositivo }
}
