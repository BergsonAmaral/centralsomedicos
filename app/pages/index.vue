<script setup lang="ts">
import {
  Bluetooth, Users, Video, FileText, Building2, Activity,
  CheckCircle2, ArrowRight, HeartPulse, Stethoscope,
  Menu, X as XIcon, Phone, Mail,
  Brain, Bone, Heart, Eye, Baby, FlaskConical, MapPin, Sparkles,
  Zap, Shield, ChevronRight, Truck,
} from 'lucide-vue-next'

definePageMeta({ layout: false })

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const checking = ref(true)
const mobileMenu = ref(false)

onMounted(async () => {
  if (user.value) {
    const { data } = await supabase.from('profiles').select('role').eq('id', user.value.id).single()
    if (data?.role === 'admin') return navigateTo('/admin')
    if (data?.role === 'medico') return navigateTo('/medico')
  }
  checking.value = false
  await nextTick()
  const io = new IntersectionObserver(
    (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') }),
    { threshold: 0.1 }
  )
  document.querySelectorAll('.reveal').forEach(el => io.observe(el))
})

const services = [
  {
    icon: Video,
    title: 'Teleconsulta com Exame Físico',
    desc: 'Realizamos consultas remotas com coleta de sinais vitais em tempo real. O médico vê os dados do paciente na mesma tela da videoconferência.',
    accent: '#1e4d9a', bg: '#e8eef8',
  },
  {
    icon: Bluetooth,
    title: 'Sinais Vitais via Bluetooth',
    desc: 'Pressão arterial, pulso, saturação, temperatura, glicemia e bioimpedância capturados sem fio durante a consulta remota — com precisão clínica.',
    accent: '#2daa8a', bg: '#e6f5f1',
  },
  {
    icon: Activity,
    title: 'Prontuário Digital Completo',
    desc: 'Todo o histórico do paciente centralizado: triagem, evolução médica, sinais vitais e documentos. Acessível em tempo real por qualquer profissional autorizado.',
    accent: '#1e4d9a', bg: '#e8eef8',
  },
  {
    icon: FileText,
    title: 'Documentos Clínicos Automáticos',
    desc: 'Receitas, atestados, pedidos de exame e encaminhamentos gerados em PDF com link seguro ao paciente. Rastreabilidade total.',
    accent: '#2daa8a', bg: '#e6f5f1',
  },
  {
    icon: Users,
    title: 'Gestão de Fila em Tempo Real',
    desc: 'Fila digital com atualização instantânea para recepção, médico e sala. Check-in, triagem e chamada sem papel e sem atrasos.',
    accent: '#1e4d9a', bg: '#e8eef8',
  },
  {
    icon: Building2,
    title: 'Integração com a Rede SUS',
    desc: 'Importamos a agenda do SUS, cadastramos os pacientes e gerenciamos os agendamentos. Tudo integrado ao fluxo já existente da sua unidade.',
    accent: '#2daa8a', bg: '#e6f5f1',
  },
]

const specialties = [
  { icon: Heart,        label: 'Cardiologia e Risco Cirúrgico' },
  { icon: Brain,        label: 'Saúde Mental' },
  { icon: Bone,         label: 'Ortopedia e Traumatologia' },
  { icon: Eye,          label: 'Dermatologia' },
  { icon: Baby,         label: 'Pediatria' },
  { icon: FlaskConical, label: 'Endocrinologia' },
  { icon: Stethoscope,  label: 'Clínico Geral' },
  { icon: Activity,     label: 'Medicina de Família' },
]

const steps = [
  {
    n: '01', title: 'Você nos contacta',
    desc: 'Apresentamos a plataforma, entendemos o seu fluxo de atendimento e elaboramos uma proposta alinhada à realidade da sua instituição.',
  },
  {
    n: '02', title: 'Instalamos tudo na sua unidade',
    desc: 'Nossa equipe vai até você — configura a infraestrutura física, os equipamentos de telemetria, médicos, salas e fluxos. Treinamos recepcionistas e equipe de saúde. Operacional no mesmo dia.',
  },
  {
    n: '03', title: 'Atendimento com qualidade',
    desc: 'Teleconsultas com exame físico real, prontuário completo e documentos automáticos. Seus pacientes saem com toda a documentação em mãos.',
  },
]

const where = [
  { icon: Building2,  title: 'Hospitais e Clínicas',      desc: 'Instalamos a estrutura completa de teleconsulta — equipamentos, plataforma e médicos — integrada ao fluxo já existente da sua unidade.', c: '#1e4d9a', bg: '#e8eef8' },
  { icon: MapPin,     title: 'UBS e Postos de Saúde',      desc: 'Gestão de filas SUS, importação de agenda e acesso a especialistas remotos. Estrutura instalada na unidade, sem obras.', c: '#2daa8a', bg: '#e6f5f1' },
  { icon: Truck,      title: 'Atendimento Itinerante',      desc: 'Levamos toda a estrutura até municípios remotos, feiras de saúde e campanhas móveis. Teleconsultas com exame físico onde o paciente está.', c: '#2daa8a', bg: '#e6f5f1' },
  { icon: HeartPulse, title: 'Regiões Remotas e Rurais',   desc: 'Especialistas médicos a municípios sem acesso presencial — com telemetria Bluetooth ao vivo e prontuário digital completo.', c: '#1e4d9a', bg: '#e8eef8' },
]

const numbers = [
  { value: '< 1 dia', label: 'Para estar operacional' },
  { value: '6+',      label: 'Dispositivos BT suportados' },
  { value: '100%',    label: 'Baseado em nuvem' },
  { value: '24/7',    label: 'Suporte disponível' },
]

const compare = [
  { label: 'Médicos inclusos no serviço',            nos: true,  hardware: false, soSoftware: false },
  { label: 'Telemetria Bluetooth inclusa',            nos: true,  hardware: false, soSoftware: false },
  { label: 'Implantação em menos de 24h',            nos: true,  hardware: false, soSoftware: true  },
  { label: 'Integração nativa com SUS',              nos: true,  hardware: false, soSoftware: false },
  { label: 'Suporte operacional incluso',            nos: true,  hardware: false, soSoftware: false },
  { label: 'Exame físico real durante teleconsulta', nos: true,  hardware: true,  soSoftware: false },
]

const mockQueue = [
  { initials: 'MA', name: 'Maria Aparecida', status: 'Aguardando triagem', c: '#1e4d9a', badge: 'Na fila' },
  { initials: 'JC', name: 'José Carlos',     status: 'Triagem concluída',  c: '#2daa8a', badge: 'Pronto' },
  { initials: 'AS', name: 'Ana Silva',       status: 'Em consulta',        c: '#163c7d', badge: 'Consultando' },
]
</script>

<template>
  <div v-if="checking" class="min-h-screen flex items-center justify-center" style="background:#f8faff">
    <div class="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style="border-color:#2daa8a;border-top-color:transparent" />
  </div>

  <div v-else style="font-family:'Inter',sans-serif;color:#0f172a;background:#ffffff;overflow-x:hidden">

    <!-- ── NAVBAR ─────────────────────────────────── -->
    <nav class="sticky top-0 z-50" style="background:rgba(255,255,255,0.97);backdrop-filter:blur(16px);border-bottom:2px solid #e8eef8;box-shadow:0 2px 16px rgba(30,77,154,0.06)">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <!-- Logo real -->
        <a href="#">
          <img src="/logo.png" alt="Central SóMedicos" style="height:90px;width:auto;display:block" />
        </a>
        <!-- Links desktop -->
        <div class="hidden md:flex items-center gap-7 text-sm font-semibold" style="color:#475569">
          <a href="#servicos"       class="hover:text-[#1e4d9a] transition-colors">Serviços</a>
          <a href="#diferenciais"   class="hover:text-[#1e4d9a] transition-colors">Diferenciais</a>
          <a href="#especialidades" class="hover:text-[#1e4d9a] transition-colors">Especialidades</a>
          <a href="#onde-atuamos"   class="hover:text-[#1e4d9a] transition-colors">Onde Atuamos</a>
          <a href="#contato"        class="hover:text-[#1e4d9a] transition-colors">Contato</a>
        </div>
        <div class="hidden md:flex items-center gap-3">
          <NuxtLink to="/auth/login" class="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-bold rounded-xl transition-all hover:scale-[1.04] hover:shadow-lg" style="background:rgba(45,170,138,0.1);color:#2daa8a;border:1.5px solid rgba(45,170,138,0.4)">
            <Zap :size="14" />
            Plataforma
          </NuxtLink>
          <a href="#contato" class="px-5 py-2 text-sm font-bold rounded-xl text-white transition-all hover:opacity-90" style="background:linear-gradient(135deg,#1e4d9a,#2daa8a)">
            Fale conosco
          </a>
        </div>
        <button class="md:hidden p-2" @click="mobileMenu = !mobileMenu">
          <component :is="mobileMenu ? XIcon : Menu" :size="22" style="color:#1e4d9a" />
        </button>
      </div>
      <!-- Mobile -->
      <div v-if="mobileMenu" class="md:hidden px-4 py-4 space-y-1 text-sm" style="border-top:1px solid #e8eef8;background:white">
        <a v-for="[href, label] in [['#servicos','Serviços'],['#diferenciais','Diferenciais'],['#especialidades','Especialidades'],['#onde-atuamos','Onde Atuamos'],['#contato','Contato']]"
           :key="href" :href="href" class="block py-2.5 font-semibold" style="color:#475569" @click="mobileMenu=false">
          {{ label }}
        </a>
        <a href="#contato" class="block text-center py-3 rounded-xl font-bold text-white mt-2" style="background:linear-gradient(135deg,#1e4d9a,#2daa8a)" @click="mobileMenu=false">
          Fale conosco
        </a>
      </div>
    </nav>

    <!-- ── HERO ───────────────────────────────────── -->
    <section class="relative overflow-hidden" style="background:linear-gradient(135deg,#080f1e 0%,#0e2550 42%,#0b3326 100%);min-height:94vh;display:flex;align-items:center">
      <!-- Orbs -->
      <div class="glow-orb" style="position:absolute;width:700px;height:700px;background:radial-gradient(circle,rgba(45,170,138,0.22) 0%,transparent 65%);top:-150px;right:-100px;pointer-events:none" />
      <div class="glow-orb" style="position:absolute;width:500px;height:500px;background:radial-gradient(circle,rgba(93,150,250,0.2) 0%,transparent 65%);bottom:-100px;left:-50px;pointer-events:none;animation-delay:2s" />
      <!-- Grid -->
      <div style="position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,0.04) 1px,transparent 1px);background-size:30px 30px;pointer-events:none" />

      <div class="relative w-full max-w-6xl mx-auto px-4 sm:px-6 py-24 lg:py-0 flex flex-col lg:flex-row items-center gap-16">
        <!-- Texto -->
        <div class="flex-1 text-center lg:text-left">
          <!-- eyebrow label -->
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-5 uppercase tracking-widest" style="background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.45);border:1px solid rgba(255,255,255,0.1);letter-spacing:0.18em">
            Serviço de Teleconsulta
          </div>

          <h1 class="font-extrabold tracking-tight mb-6" style="color:white;-webkit-text-fill-color:white">
            <span class="hero-line block text-5xl sm:text-6xl lg:text-7xl leading-[1.0] mb-1"
                  style="background:linear-gradient(90deg,#ffffff 0%,#c7f0e6 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">
              Teleconsultas
            </span>
            <span class="hero-line hero-line-2 block text-2xl sm:text-3xl lg:text-4xl leading-[1.3] font-bold" style="color:rgba(255,255,255,0.85)">
              com exame físico ao vivo.
            </span>
            <span class="hero-line hero-line-3 block text-lg sm:text-xl leading-[1.5] mt-3 font-medium" style="color:rgba(255,255,255,0.55)">
              Médicos treinados, plataforma e telemetria Bluetooth — tudo incluso.
            </span>
          </h1>

          <!-- badges de prova -->
          <div class="flex flex-wrap gap-2 justify-center lg:justify-start mb-10">
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold badge-shine" style="background:rgba(45,170,138,0.13);color:#5debb9;border:1px solid rgba(45,170,138,0.22)">
              <span class="w-1.5 h-1.5 rounded-full inline-block animate-pulse" style="background:#5debb9" />
              Telemetria ao vivo
            </span>
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style="background:rgba(93,149,255,0.12);color:#93c5fd;border:1px solid rgba(93,149,255,0.2)">
              <span class="w-1.5 h-1.5 rounded-full inline-block" style="background:#93c5fd" />
              Médicos inclusos
            </span>
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style="background:rgba(180,142,255,0.12);color:#c4b5fd;border:1px solid rgba(180,142,255,0.2)">
              <span class="w-1.5 h-1.5 rounded-full inline-block" style="background:#c4b5fd" />
              Sem hardware para comprar
            </span>
          </div>

          <p class="text-base leading-relaxed mb-10 max-w-xl mx-auto lg:mx-0" style="color:rgba(255,255,255,0.65)">
            Os sinais vitais do paciente — pressão, SpO₂, glicemia, temperatura e mais — aparecem na tela do médico em tempo real, durante a videoconferência. Sem compras adicionais.
          </p>
          <div class="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
            <a href="#contato"
               class="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-white transition-all hover:scale-[1.03] btn-glow"
               style="background:linear-gradient(135deg,#2daa8a,#1a6b56)">
              Quero começar agora
              <ArrowRight :size="18" />
            </a>
            <a href="#diferenciais"
               class="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold transition-all"
               style="background:rgba(255,255,255,0.07);color:white;border:1px solid rgba(255,255,255,0.12)">
              Ver diferenciais
              <ChevronRight :size="16" />
            </a>
          </div>
        </div>

        <!-- Mock dashboard -->
        <div class="flex-1 flex justify-center lg:justify-end shrink-0">
          <div class="relative w-full max-w-[330px] float-el">
            <div class="rounded-2xl p-5 shadow-2xl" style="background:rgba(255,255,255,0.07);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.1)">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full animate-pulse inline-block" style="background:#2daa8a" />
                  <span class="text-white text-sm font-semibold">Fila ao vivo</span>
                </div>
                <span class="text-xs px-2 py-0.5 rounded-full font-medium" style="background:rgba(45,170,138,0.18);color:#7de8d0">3 pacientes</span>
              </div>
              <div class="space-y-2">
                <div v-for="p in mockQueue" :key="p.name" class="flex items-center gap-3 p-2.5 rounded-xl" style="background:rgba(255,255,255,0.05)">
                  <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" :style="`background:${p.c}30;color:${p.c === '#163c7d' ? '#93c5fd' : p.c === '#1e4d9a' ? '#93c5fd' : '#7de8d0'}`">{{ p.initials }}</div>
                  <div class="flex-1 min-w-0">
                    <p class="text-white text-xs font-semibold truncate">{{ p.name }}</p>
                    <p class="text-xs truncate" style="color:rgba(255,255,255,0.65)">{{ p.status }}</p>
                  </div>
                  <span class="text-xs px-2 py-0.5 rounded-full shrink-0 font-medium" style="background:rgba(45,170,138,0.18);color:#7de8d0">{{ p.badge }}</span>
                </div>
              </div>
            </div>
            <!-- Sinais vitais flutuante -->
            <div class="absolute -right-5 -bottom-5 rounded-2xl p-4 shadow-2xl" style="background:white;min-width:155px">
              <div class="flex items-center gap-1.5 mb-3">
                <span class="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style="background:#2daa8a" />
                <p class="text-xs font-bold" style="color:#0f172a">Sinais Vitais</p>
              </div>
              <div class="space-y-1.5">
                <div v-for="sv in [{l:'Pressão',v:'120/80',c:'#1e4d9a'},{l:'Pulso',v:'72 bpm',c:'#2daa8a'},{l:'SpO₂',v:'98%',c:'#2d62bc'},{l:'Glicemia',v:'95 mg/dL',c:'#d97706'}]" :key="sv.l" class="flex justify-between items-center">
                  <span class="text-xs" style="color:#64748b">{{ sv.l }}</span>
                  <span class="text-xs font-bold" :style="`color:${sv.c}`">{{ sv.v }}</span>
                </div>
              </div>
              <div class="flex items-center gap-1.5 mt-3 pt-2.5" style="border-top:1px solid #f1f5f9">
                <Bluetooth :size="11" style="color:#2daa8a" />
                <span class="text-xs font-semibold" style="color:#2daa8a">Bluetooth ativo</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 70" preserveAspectRatio="none" style="width:100%;height:70px;display:block">
          <path d="M0,70 C480,0 960,0 1440,70 L1440,70 L0,70 Z" fill="#ffffff"/>
        </svg>
      </div>
    </section>

    <!-- ── FOTO REAL ──────────────────────────────── -->
    <section class="py-20 px-4 sm:px-6" style="background:#ffffff">
      <div class="max-w-5xl mx-auto flex flex-col lg:flex-row items-center gap-12 reveal">
        <!-- Imagem -->
        <div class="flex-1 w-full">
          <div class="relative rounded-3xl overflow-hidden shadow-2xl" style="border:1px solid #e8eef8">
            <img
              :src="'/foto-teleconsulta.jpg'"
              alt="Teleconsulta SóMedicos — paciente com médico na tela e enfermeira ao lado"
              class="w-full h-auto block"
              style="object-fit:cover"
            />
            <!-- Badge flutuante -->
            <div class="absolute bottom-4 left-4 right-4 rounded-2xl px-4 py-3 flex items-center gap-3" style="background:rgba(8,15,30,0.75);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,0.1)">
              <span class="w-2 h-2 rounded-full shrink-0 animate-pulse inline-block" style="background:#2daa8a" />
              <span class="text-xs font-semibold" style="color:rgba(255,255,255,0.9)">Teleconsulta com exame físico real — ao vivo, via Bluetooth</span>
            </div>
          </div>
        </div>
        <!-- Texto -->
        <div class="flex-1 lg:pl-4">
          <span class="inline-block text-xs font-bold px-3 py-1.5 rounded-full mb-4 uppercase tracking-wide" style="background:#e6f5f1;color:#1a6b56">Como funciona na prática</span>
          <h2 class="text-3xl sm:text-4xl font-extrabold tracking-tight mb-5" style="color:#0b1120;line-height:1.15">
            O médico vê os dados<br>
            <span style="background:linear-gradient(90deg,#1e4d9a,#2daa8a);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">em tempo real, na tela.</span>
          </h2>
          <p class="text-base leading-relaxed mb-6" style="color:#475569">
            A enfermeira coleta os sinais vitais com dispositivos Bluetooth — pressão, SpO₂, glicemia e mais — enquanto o médico acompanha tudo ao vivo na videoconferência. Sem fios, sem demora.
          </p>
          <ul class="space-y-3 mb-8">
            <li v-for="item in [
              'Pressão arterial, pulso e SpO₂ ao vivo',
              'Médico treinado incluso no serviço',
              'Receitas e atestados gerados automaticamente',
              'Integração nativa com agenda do SUS',
            ]" :key="item" class="flex items-start gap-3 text-sm font-medium" style="color:#0f172a">
              <CheckCircle2 :size="17" class="mt-0.5 shrink-0" style="color:#2daa8a" />
              {{ item }}
            </li>
          </ul>
          <a href="#contato" class="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl font-bold text-white transition-all hover:opacity-90 hover:scale-[1.02]" style="background:linear-gradient(135deg,#1e4d9a,#2daa8a)">
            Quero saber mais
            <ArrowRight :size="16" />
          </a>
        </div>
      </div>
    </section>

    <!-- ── NÚMEROS ─────────────────────────────────── -->
    <section style="background:#ffffff;padding:0 1.5rem 4rem">
      <div class="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
        <div v-for="n in numbers" :key="n.value" class="text-center py-7 px-4 rounded-2xl reveal" style="background:#f8faff;border:1px solid #e8eef8">
          <p class="text-3xl font-extrabold mb-1" style="background:linear-gradient(135deg,#1e4d9a,#2daa8a);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">{{ n.value }}</p>
          <p class="text-xs font-medium" style="color:#64748b">{{ n.label }}</p>
        </div>
      </div>
    </section>

    <!-- ── DIFERENCIAIS ──────────────────────────────── -->
    <section id="diferenciais" class="py-24 px-4 sm:px-6" style="background:#f8faff">
      <div class="max-w-5xl mx-auto">
        <div class="text-center mb-16 reveal">
          <span class="inline-block text-xs font-bold px-3 py-1.5 rounded-full mb-4 uppercase tracking-wide" style="background:#e6f5f1;color:#1a6b56">Por que a Central SóMedicos?</span>
          <h2 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4 tracking-tight leading-tight" style="color:#0b1120">
            Médicos treinados.<br>
            <span style="background:linear-gradient(90deg,#1e4d9a,#2daa8a);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">Telemetria ao vivo.</span><br>
            Serviço completo.
          </h2>
          <p class="text-lg max-w-2xl mx-auto" style="color:#64748b">Um único serviço que inclui o corpo clínico, a plataforma e todos os dispositivos de telemetria Bluetooth — integrados e funcionando desde o primeiro dia.</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-14">
          <div class="p-7 rounded-3xl reveal delay-1" style="background:linear-gradient(135deg,#1e4d9a,#163c7d);color:white">
            <div class="w-11 h-11 rounded-2xl flex items-center justify-center mb-5" style="background:rgba(255,255,255,0.12)"><Users :size="22" style="color:white" /></div>
            <h3 class="font-bold text-lg mb-2">Médicos inclusos</h3>
            <p class="text-sm leading-relaxed" style="color:rgba(255,255,255,0.75)">Corpo clínico treinado em telemedicina com exame físico. Você não recruta, não treina, não gerencia.</p>
          </div>
          <div class="p-7 rounded-3xl reveal delay-2" style="background:linear-gradient(135deg,#2daa8a,#1a6b56);color:white">
            <div class="w-11 h-11 rounded-2xl flex items-center justify-center mb-5" style="background:rgba(255,255,255,0.12)"><Zap :size="22" style="color:white" /></div>
            <h3 class="font-bold text-lg mb-2">Operacional em 24h</h3>
            <p class="text-sm leading-relaxed" style="color:rgba(255,255,255,0.75)">Nossa equipe configura tudo remotamente. Do primeiro contato ao primeiro atendimento em menos de um dia.</p>
          </div>
          <div class="p-7 rounded-3xl border reveal delay-3" style="border-color:#e2e8f4;background:white">
            <div class="w-11 h-11 rounded-2xl flex items-center justify-center mb-5" style="background:#e8eef8"><Shield :size="22" style="color:#1e4d9a" /></div>
            <h3 class="font-bold text-lg mb-2" style="color:#0b1120">Telemetria inclusa no serviço</h3>
            <p class="text-sm leading-relaxed" style="color:#64748b">Não vendemos kit. Todo equipamento de telemetria Bluetooth para coleta de sinais vitais já está incluso — sem compra à parte.</p>
          </div>
        </div>

        <!-- Tabela comparativa -->
        <div class="rounded-3xl overflow-hidden border" style="border-color:#e2e8f4">
          <div class="grid grid-cols-4 text-sm font-bold" style="background:#f0f4ff">
            <div class="px-6 py-4" />
            <div class="px-4 py-4 text-center" style="background:linear-gradient(135deg,#1e4d9a,#2daa8a)">
              <span class="text-white text-xs font-bold">Central SóMedicos</span>
            </div>
            <div class="px-4 py-4 text-center text-xs" style="color:#94a3b8">Kit de hardware</div>
            <div class="px-4 py-4 text-center text-xs" style="color:#94a3b8">Só software</div>
          </div>
          <div v-for="(row, i) in compare" :key="row.label"
               class="grid grid-cols-4 text-sm border-t items-center"
               :style="i % 2 === 0 ? 'border-color:#e8eef8;background:#ffffff' : 'border-color:#e8eef8;background:#fafbff'">
            <div class="px-6 py-4 font-medium text-sm" style="color:#374151">{{ row.label }}</div>
            <div class="px-4 py-4 flex justify-center">
              <span v-if="row.nos" class="flex items-center justify-center w-7 h-7 rounded-full" style="background:#e6f5f1"><CheckCircle2 :size="16" style="color:#2daa8a" /></span>
              <span v-else class="font-bold text-xl leading-none" style="color:#cbd5e1">—</span>
            </div>
            <div class="px-4 py-4 flex justify-center">
              <span v-if="row.hardware" class="flex items-center justify-center w-7 h-7 rounded-full" style="background:#f1f5f9"><CheckCircle2 :size="16" style="color:#94a3b8" /></span>
              <span v-else class="font-bold text-xl leading-none" style="color:#cbd5e1">—</span>
            </div>
            <div class="px-4 py-4 flex justify-center">
              <span v-if="row.soSoftware" class="flex items-center justify-center w-7 h-7 rounded-full" style="background:#f1f5f9"><CheckCircle2 :size="16" style="color:#94a3b8" /></span>
              <span v-else class="font-bold text-xl leading-none" style="color:#cbd5e1">—</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── MODALIDADES DE INSTALAÇÃO ──────────────── -->
    <section class="py-24 px-4 sm:px-6" style="background:#ffffff">
      <div class="max-w-5xl mx-auto">
        <div class="text-center mb-14">
          <span class="inline-block text-xs font-bold px-3 py-1.5 rounded-full mb-4 uppercase tracking-wide" style="background:#e6f5f1;color:#1a6b56">Modalidades de implantação</span>
          <h2 class="text-3xl sm:text-4xl font-extrabold mb-3 tracking-tight" style="color:#0b1120">Implantamos na sua unidade<br>ou levamos até o paciente</h2>
          <p class="text-lg max-w-2xl mx-auto" style="color:#64748b">Estrutura fixa instalada no seu espaço ou atendimento itinerante — adaptamos o modelo ao seu contexto operacional.</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">

          <!-- Fixa -->
          <div class="group p-8 rounded-3xl border transition-all hover:-translate-y-1 hover:shadow-xl reveal" style="border-color:#dbeafe;background:#f0f7ff">
            <div class="w-14 h-14 rounded-2xl flex items-center justify-center mb-6" style="background:linear-gradient(135deg,#1e4d9a,#163c7d)">
              <Building2 :size="26" style="color:white" />
            </div>
            <div class="flex items-center gap-2 mb-3">
              <h3 class="font-extrabold text-xl" style="color:#0b1120">Estrutura Fixa na Unidade</h3>
              <span class="text-xs px-2 py-0.5 rounded-full font-bold" style="background:#dbeafe;color:#1e4d9a">Padrão</span>
            </div>
            <p class="text-sm leading-relaxed mb-6" style="color:#64748b">Nossa equipe instala toda a infraestrutura de teleconsulta diretamente na sua unidade — equipamentos de telemetria, plataforma configurada e médicos prontos para atender.</p>
            <ul class="space-y-2.5">
              <li v-for="t in ['Configuração completa no local','Treinamento da equipe administrativa','Sala de teleconsulta pronta para uso','Suporte técnico contínuo']" :key="t"
                  class="flex items-center gap-2.5 text-sm font-medium" style="color:#1e4d9a">
                <CheckCircle2 :size="16" style="color:#1e4d9a;flex-shrink:0" />
                {{ t }}
              </li>
            </ul>
          </div>

          <!-- Itinerante -->
          <div class="group p-8 rounded-3xl border transition-all hover:-translate-y-1 hover:shadow-xl reveal delay-2" style="border-color:#b2e8d8;background:#f0faf6">
            <div class="w-14 h-14 rounded-2xl flex items-center justify-center mb-6" style="background:linear-gradient(135deg,#2daa8a,#1a6b56)">
              <Truck :size="26" style="color:white" />
            </div>
            <div class="flex items-center gap-2 mb-3">
              <h3 class="font-extrabold text-xl" style="color:#0b1120">Atendimento Itinerante</h3>
              <span class="text-xs px-2 py-0.5 rounded-full font-bold" style="background:#e6f5f1;color:#1a6b56">Móvel</span>
            </div>
            <p class="text-sm leading-relaxed mb-6" style="color:#64748b">Levamos toda a estrutura até campanhas de saúde, municípios remotos ou locais sem infraestrutura fixa. Teleconsultas com exame físico ao vivo, onde quer que o paciente esteja.</p>
            <ul class="space-y-2.5">
              <li v-for="t in ['Equipamentos transportados pela nossa equipe','Funciona sem instalação permanente','Ideal para campanhas e mutirões','Feiras de saúde e áreas rurais']" :key="t"
                  class="flex items-center gap-2.5 text-sm font-medium" style="color:#2daa8a">
                <CheckCircle2 :size="16" style="color:#2daa8a;flex-shrink:0" />
                {{ t }}
              </li>
            </ul>
          </div>

        </div>
      </div>
    </section>

    <!-- ── SERVIÇOS (bento) ──────────────────────────── -->
    <section id="servicos" class="py-24 px-4 sm:px-6" style="background:#ffffff">
      <div class="max-w-6xl mx-auto">
        <div class="text-center mb-14">
          <span class="inline-block text-xs font-bold px-3 py-1.5 rounded-full mb-4 uppercase tracking-wide" style="background:#e8eef8;color:#1e4d9a">O que entregamos</span>
          <h2 class="text-3xl sm:text-4xl font-extrabold mb-3 tracking-tight" style="color:#0b1120">Tudo que sua unidade precisa<br>para teleconsultar com excelência</h2>
          <p class="text-lg max-w-2xl mx-auto" style="color:#64748b">Da infraestrutura digital ao médico na tela — um único fornecedor, uma única responsabilidade.</p>
        </div>
        <!-- Bento grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div class="lg:col-span-2 group p-8 rounded-3xl border transition-all hover:-translate-y-1 hover:shadow-xl reveal delay-1" style="border-color:#e2e8f4;background:#f8faff">
            <div class="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style="background:#e8eef8"><Users :size="24" style="color:#1e4d9a" /></div>
            <h3 class="font-bold text-xl mb-3" style="color:#0b1120">Médicos treinados e prontos para atender</h3>
            <p class="text-sm leading-relaxed" style="color:#64748b">Fornecemos o corpo clínico especializado, já treinado em telemedicina com exame físico. Você não precisa contratar, treinar ou gerenciar equipe médica. Só receber os pacientes.</p>
          </div>
          <div class="group p-8 rounded-3xl transition-all hover:-translate-y-1 hover:shadow-xl reveal delay-2" style="background:linear-gradient(135deg,#1e4d9a,#163c7d)">
            <div class="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style="background:rgba(255,255,255,0.12)"><Bluetooth :size="24" style="color:white" /></div>
            <h3 class="font-bold text-xl mb-3 text-white">Sinais vitais<br>via Bluetooth</h3>
            <p class="text-sm leading-relaxed" style="color:rgba(255,255,255,0.72)">Pressão, SpO₂, glicemia, temperatura e bioimpedância capturados sem fio durante a consulta remota.</p>
          </div>
          <div class="group p-8 rounded-3xl transition-all hover:-translate-y-1 hover:shadow-xl reveal delay-1" style="background:linear-gradient(135deg,#2daa8a,#1a6b56)">
            <div class="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style="background:rgba(255,255,255,0.12)"><Activity :size="24" style="color:white" /></div>
            <h3 class="font-bold text-xl mb-3 text-white">Fila, prontuário<br>e documentos</h3>
            <p class="text-sm leading-relaxed" style="color:rgba(255,255,255,0.72)">Triagem, chamada, evolução, receitas e atestados — tudo no browser, sem instalar nada.</p>
          </div>
          <div class="lg:col-span-2 group p-8 rounded-3xl border transition-all hover:-translate-y-1 hover:shadow-xl" style="border-color:#e2e8f4;background:#f8faff">
            <div class="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style="background:#e6f5f1"><Building2 :size="24" style="color:#2daa8a" /></div>
            <h3 class="font-bold text-xl mb-3" style="color:#0b1120">Integração nativa com o SUS</h3>
            <p class="text-sm leading-relaxed" style="color:#64748b">Importamos a agenda do SUS, cadastramos pacientes e gerenciamos os agendamentos — sem duplicidade, sem retrabalho. Especialmente indicado para UBS e Policlínicas públicas.</p>
          </div>
          <div class="group p-8 rounded-3xl border transition-all hover:-translate-y-1 hover:shadow-xl" style="border-color:#e2e8f4">
            <div class="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style="background:#e8eef8"><Video :size="24" style="color:#1e4d9a" /></div>
            <h3 class="font-bold text-base mb-2" style="color:#0b1120">Videoconferência integrada</h3>
            <p class="text-sm leading-relaxed" style="color:#64748b">Consulta por vídeo segura com sinais vitais na mesma tela. Sem links externos.</p>
          </div>
          <div class="group p-8 rounded-3xl border transition-all hover:-translate-y-1 hover:shadow-xl" style="border-color:#e2e8f4">
            <div class="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style="background:#e6f5f1"><FileText :size="24" style="color:#2daa8a" /></div>
            <h3 class="font-bold text-base mb-2" style="color:#0b1120">Documentos automáticos</h3>
            <p class="text-sm leading-relaxed" style="color:#64748b">Receitas, atestados e pedidos de exame em PDF com link seguro para o paciente.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ── TECNOLOGIA BT ──────────────────────────── -->
    <section id="tecnologia" class="py-20 px-4 sm:px-6 relative overflow-hidden" style="background:linear-gradient(135deg,#0b1f40,#163c7d 50%,#1a5c4a)">
      <div style="position:absolute;width:600px;height:600px;background:radial-gradient(circle,rgba(45,170,138,0.15) 0%,transparent 65%);top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none" />
      <div style="position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,0.03) 1px,transparent 1px);background-size:24px 24px;pointer-events:none" />

      <div class="relative max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-14">
        <!-- Grid dispositivos -->
        <div class="flex-1 grid grid-cols-3 gap-3 max-w-sm mx-auto lg:mx-0">
          <div v-for="d in [
            { emoji:'🫀', label:'Pressão Arterial',   val:'120/80 mmHg', c:'#93c5fd' },
            { emoji:'💧', label:'Saturação SpO₂',     val:'98%',         c:'#7de8d0' },
            { emoji:'🌡️', label:'Temperatura',        val:'36.8°C',      c:'#fcd34d' },
            { emoji:'⚖️', label:'Balança / IMC',      val:'74.2 kg',     c:'#a5b4fc' },
            { emoji:'🩸', label:'Glicemia',           val:'95 mg/dL',    c:'#fca5a5' },
            { emoji:'📊', label:'Bioimpedância',      val:'22% gordura', c:'#6ee7b7' },
          ]" :key="d.label"
             class="flex flex-col items-center text-center p-3.5 rounded-2xl"
             style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1)">
            <span class="text-3xl mb-2">{{ d.emoji }}</span>
            <p class="text-xs font-bold leading-tight mb-1" :style="`color:${d.c}`">{{ d.val }}</p>
            <p class="text-xs leading-tight" style="color:rgba(255,255,255,0.75)">{{ d.label }}</p>
          </div>
        </div>

        <!-- Texto -->
        <div class="flex-1 text-center lg:text-left">
          <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-5" style="background:rgba(45,170,138,0.18);color:#7de8d0;border:1px solid rgba(45,170,138,0.3)">
            <Bluetooth :size="12" />
            Protocolo aberto IEEE 11073
          </div>
          <h2 class="text-3xl sm:text-4xl font-extrabold mb-5 tracking-tight leading-tight" style="color:white;-webkit-text-fill-color:white">
            Exame físico real<br>
            <span style="background:linear-gradient(90deg,#7de8d0,#93c5fd);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">
              durante a teleconsulta
            </span>
          </h2>
          <p class="text-lg leading-relaxed mb-7" style="color:rgba(255,255,255,0.82)">
            Nossa plataforma captura 6 tipos de sinais vitais via Bluetooth enquanto o médico conversa com o paciente. Os dados aparecem em tempo real na mesma tela — com a mesma confiabilidade de um consultório presencial.
          </p>
          <div class="space-y-3">
            <div v-for="txt in [
              'Todo equipamento de telemetria Bluetooth incluso no serviço',
              'Compatível com os principais dispositivos médicos BT do mercado',
              'Dados capturados e salvos automaticamente no prontruário',
              'Sem compra de kit, sem contrato de hardware separado',
            ]" :key="txt" class="flex items-start gap-3">
              <CheckCircle2 :size="17" style="color:#2daa8a;flex-shrink:0;margin-top:2px" />
              <span class="text-sm leading-relaxed" style="color:rgba(255,255,255,0.85)">{{ txt }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 70" preserveAspectRatio="none" style="width:100%;height:70px;display:block">
          <path d="M0,70 C480,0 960,0 1440,70 L1440,70 L0,70 Z" fill="#ffffff"/>
        </svg>
      </div>
    </section>

    <!-- ── ESPECIALIDADES (chips) ──────────────────── -->
    <section id="especialidades" class="py-24 px-4 sm:px-6" style="background:#ffffff">
      <div class="max-w-4xl mx-auto text-center">
        <span class="inline-block text-xs font-bold px-3 py-1.5 rounded-full mb-4 uppercase tracking-wide" style="background:#e8eef8;color:#1e4d9a">Especialidades</span>
        <h2 class="text-3xl sm:text-4xl font-extrabold mb-4 tracking-tight" style="color:#0b1120">Corpo clínico treinado<br>em telemedicina com exame físico</h2>
        <p class="text-lg max-w-xl mx-auto mb-12" style="color:#64748b">Médicos capacitados para atender remotamente com qualidade de consultório presencial.</p>
        <div class="flex flex-wrap justify-center gap-3">
          <div v-for="sp in specialties" :key="sp.label"
               class="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl border font-semibold text-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
               style="border-color:#e2e8f4;background:#f8faff">
            <div class="w-7 h-7 rounded-xl flex items-center justify-center" style="background:linear-gradient(135deg,#e8eef8,#e6f5f1)">
              <component :is="sp.icon" :size="15" style="color:#1e4d9a" />
            </div>
            <span style="color:#374151">{{ sp.label }}</span>
          </div>
          <div class="inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-sm" style="background:#f1f5f9;color:#94a3b8;border:1px dashed #cbd5e1">+ muito mais</div>
        </div>
      </div>
    </section>

    <!-- ── COMO FUNCIONA ──────────────────────────── -->
    <section class="py-24 px-4 sm:px-6" style="background:#f8faff">
      <div class="max-w-5xl mx-auto">
        <div class="text-center mb-16 reveal">
          <span class="inline-block text-xs font-bold px-3 py-1.5 rounded-full mb-4 uppercase tracking-wide" style="background:#e6f5f1;color:#1a6b56">Como funciona</span>
          <h2 class="text-3xl sm:text-4xl font-extrabold mb-3 tracking-tight" style="color:#0b1120">Do contato ao primeiro atendimento<br>em menos de um dia</h2>
          <p class="text-lg max-w-xl mx-auto" style="color:#64748b">Nossa equipe cuida de todo o setup — você só precisa abrir as portas.</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div v-for="(step, idx) in steps" :key="step.n"
               class="relative bg-white rounded-3xl p-8 border text-center group hover:-translate-y-1 transition-all hover:shadow-xl reveal"
               style="border-color:#e2e8f4">
            <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5 text-xl font-black" style="background:linear-gradient(135deg,#1e4d9a,#2daa8a);color:white">{{ step.n }}</div>
            <h3 class="text-base font-bold mb-2.5" style="color:#0b1120">{{ step.title }}</h3>
            <p class="text-sm leading-relaxed" style="color:#64748b">{{ step.desc }}</p>
            <div v-if="idx < 2" class="hidden md:flex absolute -right-3 top-12 w-6 h-6 rounded-full items-center justify-center z-10" style="background:#e8eef8">
              <ChevronRight :size="14" style="color:#1e4d9a" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── ONDE ATUAMOS ───────────────────────────── -->
    <section id="onde-atuamos" class="py-24 px-4 sm:px-6" style="background:#ffffff">
      <div class="max-w-5xl mx-auto text-center">
        <span class="inline-block text-xs font-bold px-3 py-1.5 rounded-full mb-4 uppercase tracking-wide" style="background:#e8eef8;color:#1e4d9a">Onde atuamos</span>
        <h2 class="text-3xl sm:text-4xl font-extrabold mb-4 tracking-tight" style="color:#0b1120">Instalamos e operamos<br>onde você precisar</h2>
        <p class="text-lg max-w-2xl mx-auto mb-12" style="color:#64748b">Estrutura fixa na sua unidade ou atendimento itinerante — adaptamos o serviço ao seu modelo de operarção.</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div v-for="local in where" :key="local.title"
               class="p-8 rounded-3xl border text-left transition-all hover:-translate-y-1 hover:shadow-lg"
               style="border-color:#e2e8f4">
            <div class="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" :style="`background:${local.bg}`">
              <component :is="local.icon" :size="22" :style="`color:${local.c}`" />
            </div>
            <h3 class="font-bold text-base mb-2" style="color:#0b1120">{{ local.title }}</h3>
            <p class="text-sm leading-relaxed" style="color:#64748b">{{ local.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ── CONTATO ────────────────────────────────── -->
    <section id="contato" class="py-28 px-4 sm:px-6 relative overflow-hidden" style="background:linear-gradient(135deg,#080f1e 0%,#0e2550 45%,#0b3326 100%)">
      <div style="position:absolute;width:600px;height:600px;background:radial-gradient(circle,rgba(45,170,138,0.2) 0%,transparent 65%);top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none" />
      <div class="relative max-w-3xl mx-auto text-center">
        <!-- Logo no CTA -->
        <img src="/logo.png" alt="Central SóMedicos" style="height:90px;width:auto;margin:0 auto 2rem;filter:brightness(0) invert(1);opacity:0.9" />
        <h2 class="text-3xl sm:text-4xl font-extrabold text-white mb-5 tracking-tight">
          Pronto para transformar<br>
          <span style="background:linear-gradient(90deg,#5debb9,#7eb4ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">
            o atendimento da sua unidade?
          </span>
        </h2>
        <p class="text-lg mb-12" style="color:rgba(255,255,255,0.78)">
          Fale com nossa equipe. Sem compromisso, sem burocracia. Apresentamos como a Central SóMedicos se adapta ao seu fluxo — e estamos operacionais em menos de 24h.
        </p>
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href="mailto:contato@somedicos.com.br"
             class="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl font-bold text-white transition-all hover:scale-[1.03] shadow-xl"
             style="background:linear-gradient(135deg,#2daa8a,#1a6b56)">
            <Mail :size="18" />
            contato@somedicos.com.br
          </a>
          <a href="https://wa.me/5500000000000"
             class="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl font-semibold transition-all"
             style="background:rgba(255,255,255,0.08);color:white;border:1px solid rgba(255,255,255,0.15)">
            <Phone :size="18" />
            Chamar no WhatsApp
          </a>
        </div>
      </div>
    </section>

    <!-- ── FOOTER ──────────────────────────────────── -->
    <footer class="py-10 px-4 sm:px-6" style="background:#06101f;border-top:1px solid rgba(255,255,255,0.06)">
      <div class="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5">
        <img src="/logo.png" alt="Central SóMedicos" style="height:64px;width:auto;filter:brightness(0) invert(1);opacity:0.8" />
        <p class="text-sm text-center" style="color:rgba(255,255,255,0.6)">© 2026 Central SóMedicos · Uma nova visão da saúde</p>
        <div class="flex gap-5 text-sm" style="color:rgba(255,255,255,0.6)">
          <a href="#" class="hover:text-white transition-colors">Privacidade</a>
          <a href="#" class="hover:text-white transition-colors">Termos</a>
          <NuxtLink to="/auth/login" class="hover:text-white transition-colors">Plataforma</NuxtLink>
        </div>
      </div>
    </footer>

  </div>
</template>

<style scoped>
@keyframes float {
  0%, 100% { transform: translateY(0);     }
  50%       { transform: translateY(-14px); }
}
@keyframes glow-pulse {
  0%, 100% { opacity: 0.5; }
  50%       { opacity: 1;   }
}
@keyframes btn-glow-pulse {
  0%, 100% { box-shadow: 0 4px 24px rgba(45,170,138,0.4),  0 2px 8px  rgba(45,170,138,0.2); }
  50%       { box-shadow: 0 4px 52px rgba(45,170,138,0.85), 0 0 90px  rgba(45,170,138,0.3); }
}
@keyframes badge-shimmer {
  0%   { background-position: -300% center; }
  100% { background-position:  300% center; }
}
@keyframes ticker-scroll {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
@keyframes hero-fade-up {
  from { opacity: 0; transform: translateY(28px); }
  to   { opacity: 1; transform: none; }
}

.float-el    { animation: float 5.5s ease-in-out infinite; }
.glow-orb    { animation: glow-pulse 4s ease-in-out infinite; }
.btn-glow    { animation: btn-glow-pulse 2.6s ease-in-out infinite; }
.badge-shine {
  background-image: linear-gradient(90deg,
    rgba(45,170,138,0.13) 0%,
    rgba(93,235,185,0.25) 40%,
    rgba(45,170,138,0.13) 80%);
  background-size: 300% auto;
  animation: badge-shimmer 3.5s linear infinite;
}

/* Hero line stagger */
.hero-line       { animation: hero-fade-up 0.7s cubic-bezier(.22,1,.36,1) both; animation-delay: 0.15s; }
.hero-line-2     { animation-delay: 0.32s; }
.hero-line-3     { animation-delay: 0.5s;  }

/* Ticker */
.ticker-track  { display: flex; width: max-content; animation: ticker-scroll 22s linear infinite; }
.ticker-inner  { display: inline-flex; align-items: center; gap: 0; }
.ticker-item   { display: inline-flex; align-items: center; gap: 6px; font-size: 0.72rem; font-weight: 600; color: rgba(255,255,255,0.55); white-space: nowrap; padding: 0 1.4rem; }
.ticker-label  { color: rgba(93,235,185,0.8); }
.ticker-sep    { color: rgba(255,255,255,0.12); font-size: 0.7rem; }
.ticker-dot    { display: inline-block; width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

.reveal {
  opacity: 0;
  transform: translateY(26px);
  transition:
    opacity  0.65s cubic-bezier(.22,1,.36,1),
    transform 0.65s cubic-bezier(.22,1,.36,1);
}
.reveal.visible { opacity: 1; transform: none; }
.delay-1 { transition-delay: 0.10s; }
.delay-2 { transition-delay: 0.20s; }
.delay-3 { transition-delay: 0.30s; }
.delay-4 { transition-delay: 0.40s; }
</style>
