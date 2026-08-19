/**
 * useDispositivosBT — Leitura automática de sinais vitais via Web Bluetooth (GATT)
 *
 * Perfis GATT utilizados (IEEE 11073 / Bluetooth SIG):
 *   Pressão Arterial   : Service 0x1810 / Char 0x2A35
 *   Frequência Cardíaca: Service 0x180D / Char 0x2A37
 *   Oximetria (SpO₂)   : Service 0x1822 / Char 0x2A5E
 *   Termômetro         : Service 0x1809 / Char 0x2A1C
 *   Balança            : Service 0x181D / Char 0x2A9D
 *
 * Compatível com: Omron, A&D, Contec, Beurer, Xiaomi BIA
 */

export type TipoDispositivo = 'pressao' | 'oximetro' | 'termometro' | 'balanca' | 'glicosimetro' | 'bioimpedancia'

export interface LeituraDispositivo {
  tipo: TipoDispositivo
  conectado: boolean
  lendo: boolean
  erro: string | null
}

export interface SinaisCapturados {
  pressao_sistolica?: number
  pressao_diastolica?: number
  pulso?: number
  saturacao?: number
  temperatura?: number
  peso?: number
  glicemia?: number
  gordura_percentual?: number
  imc?: number
}

// ─── UUIDs GATT padrão ────────────────────────────────────────────────────────
const GATT = {
  pressao: {
    service: 0x1810,
    char: 0x2A35, // Blood Pressure Measurement
  },
  frequencia: {
    service: 0x180D,
    char: 0x2A37, // Heart Rate Measurement
  },
  oximetro: {
    service: 0x1822,
    char: 0x2A5E, // PLX Spot-Check Measurement
  },
  termometro: {
    service: 0x1809,
    char: 0x2A1C, // Temperature Measurement
  },
  balanca: {
    service: 0x181D,
    char: 0x2A9D, // Weight Measurement
  },
  glicosimetro: {
    service: 0x1808,
    char: 0x2A18, // Glucose Measurement
  },
  bioimpedancia: {
    service: 0x181B,
    char: 0x2A9C, // Body Composition Measurement
  },
}

// ─── Decodificadores IEEE 11073 ───────────────────────────────────────────────

function decodificarPressao(data: DataView): { sistolica: number; diastolica: number; pulso?: number } {
  // Flags byte 0: bit 0 = unidade (0=mmHg, 1=kPa), bit 2 = pulso presente
  const flags = data.getUint8(0)
  const kPa = (flags & 0x01) !== 0

  const sfloatToFloat = (raw: number) => {
    const exponent = raw >> 12
    const mantissa = raw & 0x0FFF
    const exp = exponent > 7 ? exponent - 16 : exponent
    const man = mantissa > 0x07FF ? mantissa - 0x1000 : mantissa
    return man * Math.pow(10, exp)
  }

  let sistolica = sfloatToFloat(data.getUint16(1, true))
  let diastolica = sfloatToFloat(data.getUint16(3, true))
  let pulso: number | undefined

  if (kPa) {
    sistolica = Math.round(sistolica * 7.50062)
    diastolica = Math.round(diastolica * 7.50062)
  }

  if (flags & 0x04) {
    pulso = sfloatToFloat(data.getUint16(14, true))
  }

  return { sistolica: Math.round(sistolica), diastolica: Math.round(diastolica), pulso: pulso ? Math.round(pulso) : undefined }
}

function decodificarFrequencia(data: DataView): number {
  const flags = data.getUint8(0)
  // bit 0: 0 = uint8, 1 = uint16
  return (flags & 0x01) ? data.getUint16(1, true) : data.getUint8(1)
}

function decodificarOximetro(data: DataView): { saturacao: number; pulso: number } {
  // PLX Spot-Check: SpO2 = bytes 3-4 (SFLOAT), PR = bytes 5-6 (SFLOAT)
  const sfloat = (raw: number) => {
    const exp = raw >> 12; const man = raw & 0x0FFF
    return (man > 0x07FF ? man - 0x1000 : man) * Math.pow(10, exp > 7 ? exp - 16 : exp)
  }
  return {
    saturacao: Math.round(sfloat(data.getUint16(3, true))),
    pulso: Math.round(sfloat(data.getUint16(5, true))),
  }
}

function decodificarTemperatura(data: DataView): number {
  // Flags byte 0: bit 0 = unidade (0=°C, 1=°F)
  const flags = data.getUint8(0)
  const raw = data.getInt32(1, true) & 0xFFFFFF
  const exp = data.getInt8(4)
  let temp = raw * Math.pow(10, exp)
  if (flags & 0x01) temp = (temp - 32) * 5 / 9 // Fahrenheit → Celsius
  return Math.round(temp * 10) / 10
}

function decodificarBalanca(data: DataView): number {
  // Flags byte 0: bit 0 = unidade (0=kg, 1=lb), bit 2 = BMI presente
  const flags = data.getUint8(0)
  let peso = data.getUint16(1, true) * 0.005 // resolução 0.005 kg
  if (flags & 0x01) peso = Math.round(peso * 0.453592 * 10) / 10 // lb → kg
  return Math.round(peso * 10) / 10
}

function decodificarGlicose(data: DataView): number {
  // Glucose Measurement: flags (1), seq (2), tempo (7), tipo+local (1), glicose SFLOAT (2)
  // Unidade: flags bit 2 = 0 → kg/L (mol/L se 1). Convertemos para mg/dL.
  const flags = data.getUint8(0)
  const offset = 10 // após flags + seq + timestamp
  const raw = data.getUint16(offset, true)
  const exp = raw >> 12
  const man = raw & 0x0FFF
  const e = exp > 7 ? exp - 16 : exp
  const m = man > 0x07FF ? man - 0x1000 : man
  const valor = m * Math.pow(10, e) // kg/L
  // bit 2 = 0 → kg/L, converter para mg/dL: × 100000
  const mgdl = (flags & 0x04) ? valor * 18015.28 : valor * 100000
  return Math.round(mgdl)
}

function decodificarBioimpedancia(data: DataView): { gordura_percentual: number; imc?: number } {
  // Body Composition Measurement (0x2A9C)
  // Flags (2 bytes): bit 1 = % gordura presente, bit 7 = IMC presente
  const flags = data.getUint16(0, true)
  let offset = 2
  let gordura_percentual = 0
  let imc: number | undefined

  if (flags & 0x0002) {
    gordura_percentual = Math.round(data.getUint16(offset, true) * 0.1 * 10) / 10
    offset += 2
  }
  if (flags & 0x0080) {
    imc = Math.round(data.getUint16(offset, true) * 0.1 * 10) / 10
  }
  return { gordura_percentual, imc }
}

// ─── Composable principal ─────────────────────────────────────────────────────

function mensagemErroBT(e: any): string {
  const nome = e?.name ?? ''
  if (nome === 'NotFoundError') return 'Nenhum aparelho selecionado, ou o Bluetooth do computador/celular está desligado.'
  if (nome === 'SecurityError') return 'Este site precisa estar em HTTPS pra usar Bluetooth (já deveria estar — recarregue a página).'
  if (nome === 'NotSupportedError') return 'Este aparelho não é compatível (não usa Bluetooth de baixa energia / BLE).'
  if (nome === 'NetworkError') return 'Falha na conexão com o aparelho — tente aproximar mais ou parear de novo.'
  return e?.message ?? 'Erro ao conectar'
}

export function useDispositivosBT() {
  const suportado = computed(() => typeof navigator !== 'undefined' && 'bluetooth' in navigator)

  const estado = reactive<Record<TipoDispositivo, LeituraDispositivo>>({
    pressao:       { tipo: 'pressao',       conectado: false, lendo: false, erro: null },
    oximetro:      { tipo: 'oximetro',      conectado: false, lendo: false, erro: null },
    termometro:    { tipo: 'termometro',    conectado: false, lendo: false, erro: null },
    balanca:       { tipo: 'balanca',       conectado: false, lendo: false, erro: null },
    glicosimetro:  { tipo: 'glicosimetro',  conectado: false, lendo: false, erro: null },
    bioimpedancia: { tipo: 'bioimpedancia', conectado: false, lendo: false, erro: null },
  })

  const sinais = reactive<SinaisCapturados>({})

  async function conectarPressao() {
    const s = estado.pressao
    s.erro = null; s.lendo = true
    try {
      // acceptAllDevices em vez de filtrar por serviço: muitos aparelhos de
      // pressão não anunciam o serviço 0x1810 no pacote de advertising (só
      // expõem depois de conectado), então o filtro por serviço fazia o
      // navegador não encontrar nada. Mostrando todos os aparelhos próximos,
      // a pessoa escolhe pelo nome e a gente tenta ler o serviço depois.
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [GATT.pressao.service, GATT.frequencia.service],
      })
      const server = await device.gatt.connect()
      s.conectado = true

      // Pressão arterial
      const svcPA = await server.getPrimaryService(GATT.pressao.service)
      const charPA = await svcPA.getCharacteristic(GATT.pressao.char)
      await charPA.startNotifications()
      charPA.addEventListener('characteristicvaluechanged', (e: Event) => {
        const d = (e.target as BluetoothRemoteGATTCharacteristic).value!
        const r = decodificarPressao(d)
        sinais.pressao_sistolica = r.sistolica
        sinais.pressao_diastolica = r.diastolica
        if (r.pulso) sinais.pulso = r.pulso
        s.lendo = false
      })

      // Frequência cardíaca (se disponível no mesmo aparelho)
      try {
        const svcFC = await server.getPrimaryService(GATT.frequencia.service)
        const charFC = await svcFC.getCharacteristic(GATT.frequencia.char)
        await charFC.startNotifications()
        charFC.addEventListener('characteristicvaluechanged', (e: Event) => {
          const d = (e.target as BluetoothRemoteGATTCharacteristic).value!
          sinais.pulso = decodificarFrequencia(d)
        })
      } catch { /* aparelho sem serviço de FC separado */ }

    } catch (e: any) {
      s.erro = mensagemErroBT(e)
      s.lendo = false
      s.conectado = false
    }
  }

  async function conectarOximetro() {
    const s = estado.oximetro
    s.erro = null; s.lendo = true
    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [GATT.oximetro.service, GATT.frequencia.service],
      })
      const server = await device.gatt.connect()
      s.conectado = true

      const svc = await server.getPrimaryService(GATT.oximetro.service)
      const char = await svc.getCharacteristic(GATT.oximetro.char)
      await char.startNotifications()
      char.addEventListener('characteristicvaluechanged', (e: Event) => {
        const d = (e.target as BluetoothRemoteGATTCharacteristic).value!
        const r = decodificarOximetro(d)
        sinais.saturacao = r.saturacao
        sinais.pulso = sinais.pulso ?? r.pulso
        s.lendo = false
      })
    } catch (e: any) {
      s.erro = mensagemErroBT(e)
      s.lendo = false
      s.conectado = false
    }
  }

  async function conectarTermometro() {
    const s = estado.termometro
    s.erro = null; s.lendo = true
    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [GATT.termometro.service],
      })
      const server = await device.gatt.connect()
      s.conectado = true

      const svc = await server.getPrimaryService(GATT.termometro.service)
      const char = await svc.getCharacteristic(GATT.termometro.char)
      await char.startNotifications()
      char.addEventListener('characteristicvaluechanged', (e: Event) => {
        const d = (e.target as BluetoothRemoteGATTCharacteristic).value!
        sinais.temperatura = decodificarTemperatura(d)
        s.lendo = false
      })
    } catch (e: any) {
      s.erro = mensagemErroBT(e)
      s.lendo = false
      s.conectado = false
    }
  }

  async function conectarBalanca() {
    const s = estado.balanca
    s.erro = null; s.lendo = true
    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [GATT.balanca.service],
      })
      const server = await device.gatt.connect()
      s.conectado = true

      const svc = await server.getPrimaryService(GATT.balanca.service)
      const char = await svc.getCharacteristic(GATT.balanca.char)
      await char.startNotifications()
      char.addEventListener('characteristicvaluechanged', (e: Event) => {
        const d = (e.target as BluetoothRemoteGATTCharacteristic).value!
        sinais.peso = decodificarBalanca(d)
        s.lendo = false
      })
    } catch (e: any) {
      s.erro = mensagemErroBT(e)
      s.lendo = false
      s.conectado = false
    }
  }

  async function conectarGlicosimetro() {
    const s = estado.glicosimetro
    s.erro = null; s.lendo = true
    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [GATT.glicosimetro.service],
      })
      const server = await device.gatt.connect()
      s.conectado = true

      const svc = await server.getPrimaryService(GATT.glicosimetro.service)
      const char = await svc.getCharacteristic(GATT.glicosimetro.char)
      await char.startNotifications()
      char.addEventListener('characteristicvaluechanged', (e: Event) => {
        const d = (e.target as BluetoothRemoteGATTCharacteristic).value!
        sinais.glicemia = decodificarGlicose(d)
        s.lendo = false
      })
    } catch (e: any) {
      s.erro = mensagemErroBT(e)
      s.lendo = false
      s.conectado = false
    }
  }

  async function conectarBioimpedancia() {
    const s = estado.bioimpedancia
    s.erro = null; s.lendo = true
    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [GATT.bioimpedancia.service],
      })
      const server = await device.gatt.connect()
      s.conectado = true

      const svc = await server.getPrimaryService(GATT.bioimpedancia.service)
      const char = await svc.getCharacteristic(GATT.bioimpedancia.char)
      await char.startNotifications()
      char.addEventListener('characteristicvaluechanged', (e: Event) => {
        const d = (e.target as BluetoothRemoteGATTCharacteristic).value!
        const r = decodificarBioimpedancia(d)
        sinais.gordura_percentual = r.gordura_percentual
        if (r.imc) sinais.imc = r.imc
        s.lendo = false
      })
    } catch (e: any) {
      s.erro = mensagemErroBT(e)
      s.lendo = false
      s.conectado = false
    }
  }

  const conectar: Record<TipoDispositivo, () => Promise<void>> = {
    pressao: conectarPressao,
    oximetro: conectarOximetro,
    termometro: conectarTermometro,
    balanca: conectarBalanca,
    glicosimetro: conectarGlicosimetro,
    bioimpedancia: conectarBioimpedancia,
  }

  return { suportado, estado, sinais, conectar }
}
