<script setup lang="ts">
import { Bluetooth, BluetoothSearching, BluetoothConnected, AlertCircle, CheckCircle2, Heart } from 'lucide-vue-next'
import { useOmronBluetooth } from '~/composables/useOmronBluetooth'

const emit = defineEmits<{
  medido: [{ sistolica: number; diastolica: number; pulso: number }]
}>()

const { status, mensagem, medicao, suportado, ultimoNomeDispositivo, parear, ler, resetar, esquecerDispositivo } = useOmronBluetooth()

watch(medicao, (m) => {
  if (m) emit('medido', { sistolica: m.sistolica, diastolica: m.diastolica, pulso: m.pulso })
})

const ocupado = computed(() => status.value === 'conectando' || status.value === 'lendo' || status.value === 'pareando')
</script>

<template>
  <div class="rounded-xl border p-4 space-y-3" style="border-color:var(--color-border);background:var(--color-surface-2)">
    <!-- Header -->
    <div class="flex items-center gap-2">
      <Bluetooth :size="16" style="color:#7c3aed" />
      <span class="text-sm font-semibold text-[var(--color-text)]">Omron HEM-7156T</span>
      <span class="ml-auto text-xs px-2 py-0.5 rounded-full" style="background:#ede9fe;color:#7c3aed">Bluetooth</span>
    </div>

    <!-- Navegador não suporta -->
    <div v-if="!suportado" class="flex items-start gap-2 text-xs p-3 rounded-lg" style="background:#fef9c3;color:#854d0e">
      <AlertCircle :size="14" class="shrink-0 mt-0.5" />
      <span>Web Bluetooth requer <strong>Google Chrome</strong> ou <strong>Microsoft Edge</strong>.</span>
    </div>

    <template v-else>
      <!-- Resultado da leitura -->
      <div
        v-if="status === 'sucesso' && medicao"
        class="rounded-xl p-4 space-y-1"
        style="background:#f0fdf4;border:1px solid #bbf7d0"
      >
        <div class="flex items-center gap-2 mb-2">
          <CheckCircle2 :size="16" style="color:#16a34a" />
          <span class="text-sm font-semibold" style="color:#16a34a">Medição capturada</span>
          <span v-if="medicao.irregular" class="ml-auto text-xs px-2 py-0.5 rounded-full font-medium" style="background:#fef9c3;color:#a16207">
            ⚠️ Irregular
          </span>
        </div>

        <!-- Valores -->
        <div class="grid grid-cols-3 gap-3 text-center">
          <div>
            <p class="text-2xl font-bold" style="color:#15803d">{{ medicao.sistolica }}</p>
            <p class="text-xs" style="color:#16a34a">Sistólica</p>
          </div>
          <div>
            <p class="text-2xl font-bold" style="color:#15803d">{{ medicao.diastolica }}</p>
            <p class="text-xs" style="color:#16a34a">Diastólica</p>
          </div>
          <div class="flex flex-col items-center">
            <div class="flex items-center gap-1">
              <Heart :size="14" style="color:#dc2626" />
              <p class="text-2xl font-bold" style="color:#15803d">{{ medicao.pulso }}</p>
            </div>
            <p class="text-xs" style="color:#16a34a">Pulso (bpm)</p>
          </div>
        </div>

        <p class="text-xs text-center pt-1" style="color:#86efac">
          {{ medicao.dia }}/{{ medicao.mes }}/{{ medicao.ano }}
          {{ String(medicao.hora).padStart(2,'0') }}:{{ String(medicao.minuto).padStart(2,'0') }}
        </p>

        <button
          type="button"
          class="w-full mt-2 text-xs py-1.5 rounded-lg transition-colors hover:opacity-80"
          style="background:#dcfce7;color:#16a34a"
          @click="resetar"
        >
          Ler novamente
        </button>
      </div>

      <!-- Mensagem de status (conectando / lendo / erro) -->
      <div v-else-if="status !== 'idle'" class="flex items-center gap-2 text-sm p-3 rounded-lg"
        :style="status === 'erro'
          ? 'background:#fef2f2;color:#dc2626'
          : 'background:#eff6ff;color:#1d4ed8'"
      >
        <BluetoothSearching v-if="ocupado" :size="15" class="shrink-0 animate-pulse" />
        <AlertCircle v-else-if="status === 'erro'" :size="15" class="shrink-0" />
        <BluetoothConnected v-else :size="15" class="shrink-0" />
        <span class="flex-1">{{ mensagem }}</span>
        <button v-if="status === 'erro'" type="button" class="shrink-0 underline text-xs" @click="resetar">
          Tentar novamente
        </button>
        <button v-if="status === 'sucesso' && !medicao" type="button" class="shrink-0 underline text-xs" @click="resetar">
          Continuar
        </button>
      </div>

      <!-- Botões de ação (idle) -->
      <div v-if="status === 'idle'" class="flex gap-2">
        <button
          type="button"
          class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:opacity-90"
          style="background:#7c3aed;color:#ffffff"
          @click="ler()"
        >
          <BluetoothSearching :size="15" />
          Ler medição
        </button>
        <button
          type="button"
          class="px-3 py-2.5 rounded-xl text-sm font-medium transition-colors hover:opacity-80"
          style="background:var(--color-surface);color:var(--color-text-muted);border:1px solid var(--color-border)"
          title="Parear aparelho pela primeira vez"
          @click="parear()"
        >
          Parear
        </button>
      </div>

      <!-- Instrução -->
      <p v-if="status === 'idle'" class="text-xs" style="color:var(--color-text-muted)">
        Tire a pressão no aparelho <strong>antes</strong> de clicar em "Ler medição".
      </p>
      <p v-if="status === 'idle' && ultimoNomeDispositivo" class="text-xs" style="color:var(--color-text-dim)">
        Último aparelho tentado: <strong>"{{ ultimoNomeDispositivo }}"</strong> ·
        <button type="button" class="underline" @click="esquecerDispositivo(); ultimoNomeDispositivo = ''">esquecer / trocar aparelho</button>
      </p>
    </template>
  </div>
</template>
