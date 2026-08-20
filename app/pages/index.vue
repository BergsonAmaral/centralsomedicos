<script setup lang="ts">
import {
  Bluetooth, Users, Video, FileText, Building2, Activity,
  CheckCircle2, ArrowRight, HeartPulse, Stethoscope,
  Phone, Mail, Brain, Bone, Heart, Eye, Baby, FlaskConical,
  MapPin, Zap, Truck, MessageCircle, ChevronRight,
} from 'lucide-vue-next'

definePageMeta({ layout: false })

const supabase = useSupabaseClient()
const user     = useSupabaseUser()
const checking    = ref(true)
const mobileMenu  = ref(false)
const scrollProgress = ref(0)
const navScrolled    = ref(false)
const showBackToTop  = ref(false)
const parallaxY      = ref(0)
const reducedMotion  = ref(false)

/* ── Scroll-driven refs ─────────────────────────────────────────── */
const heroOpacity   = ref(1)
const heroShift     = ref(0)
const statementEl   = ref<HTMLElement | null>(null)
const demoEl        = ref<HTMLElement | null>(null)
const ctaEl         = ref<HTMLElement | null>(null)
const wordsOn       = ref(0)
const statementProgress = ref(0)
const demoTiltX     = ref(10)
const demoScale     = ref(0.95)
const demoOpacity   = ref(0)
const ctaBgShift    = ref(0)

const statementWords = (
  'Levamos médicos especializados em telemedicina, a plataforma e toda a telemetria Bluetooth ' +
  'direto para a sua unidade de saúde. Um único fornecedor. Uma única responsabilidade.'
).split(' ')

/* ── Animated counters ──────────────────────────────────────────── */
const displayNums = ref(['< 1', '0', '0', '0'])
const numTargets: (number | null)[] = [null, 6, 100, 24]
let counted = false
function runCounters() {
  if (counted) return
  counted = true
  if (reducedMotion.value) {
    displayNums.value = ['< 1', '6', '100', '24']
    return
  }
  const t0 = performance.now()
  const dur = 1500
  const tick = (t: number) => {
    const p = Math.min(1, (t - t0) / dur)
    const e = 1 - Math.pow(1 - p, 3)
    numTargets.forEach((tg, i) => {
      if (tg != null) displayNums.value[i] = String(Math.round(tg * e))
    })
    if (p < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

/* ── Cursor ─────────────────────────────────────────────────────── */
const cursorX    = ref(-200)
const cursorY    = ref(-200)
const ringX      = ref(-200)
const ringY      = ref(-200)
const cursorHover = ref(false)
let _rx = -200, _ry = -200, _tx = -200, _ty = -200
let rafId: number | null = null
let vitalInterval: ReturnType<typeof setInterval> | null = null

function animateRing() {
  _rx += (_tx - _rx) * 0.1
  _ry += (_ty - _ry) * 0.1
  ringX.value = _rx
  ringY.value = _ry
  rafId = requestAnimationFrame(animateRing)
}

/* ── Scroll ──────────────────────────────────────────────────────── */
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
let scrollTicking = false

function updateScrollFX() {
  scrollTicking = false
  const st = window.scrollY
  const vh = window.innerHeight
  const dh = document.documentElement.scrollHeight - vh
  scrollProgress.value = dh > 0 ? Math.min(100, (st / dh) * 100) : 0
  navScrolled.value   = st > 60
  showBackToTop.value = st > 700
  parallaxY.value     = st

  if (reducedMotion.value) {
    heroOpacity.value = 1; heroShift.value = 0
    wordsOn.value = statementWords.length
    demoTiltX.value = 0; demoScale.value = 1; demoOpacity.value = 1
    ctaBgShift.value = 0
    return
  }

  /* Hero content fades + drifts away while scrolling past */
  heroOpacity.value = clamp(1 - st / (vh * 0.55), 0, 1)
  heroShift.value   = st * 0.28

  /* Statement: pinned section — words light up while it's sticky-pinned to the viewport */
  if (statementEl.value) {
    const r = statementEl.value.getBoundingClientRect()
    const p = clamp(-r.top / Math.max(1, r.height - vh), 0, 1)
    statementProgress.value = p
    wordsOn.value = Math.round(p * statementWords.length * 1.08)
  }

  /* Demo window: untilt + scale in as it enters the viewport */
  if (demoEl.value) {
    const r = demoEl.value.getBoundingClientRect()
    const p = clamp((vh - r.top) / (vh * 0.75), 0, 1)
    const e = 1 - Math.pow(1 - p, 2)
    demoTiltX.value   = (1 - e) * 12
    demoScale.value   = 0.94 + e * 0.06
    demoOpacity.value = clamp(e * 1.4, 0, 1)
  }

  /* CTA giant background text drifts sideways with scroll */
  if (ctaEl.value) {
    const r = ctaEl.value.getBoundingClientRect()
    ctaBgShift.value = clamp((vh - r.top) * 0.1, -80, 240)
  }
}

function onScroll() {
  if (!scrollTicking) {
    scrollTicking = true
    requestAnimationFrame(updateScrollFX)
  }
}
function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }) }

/* ── Live vitals ──────────────────────────────────────────────────── */
const liveVitals = ref([
  { l: 'Pressão',  v: '120/80', unit: 'mmHg',  },
  { l: 'Pulso',    v: '72',     unit: 'bpm',   },
  { l: 'SpO₂',    v: '98',     unit: '%',     },
  { l: 'Glicemia', v: '95',    unit: 'mg/dL', },
])

/* ── Static data ────────────────────────────────────────────────── */
const featureList = [
  { title: 'Médicos treinados em telemedicina', desc: 'Corpo clínico especializado incluso — sem recrutar, treinar ou gerenciar equipe médica.' },
  { title: 'Sinais vitais via Bluetooth', desc: 'Pressão, SpO₂, glicemia, temperatura e mais capturados sem fio durante a consulta.' },
  { title: 'Prontuário e documentos automáticos', desc: 'Receitas, atestados e pedidos de exame em PDF gerados ao fim de cada consulta.' },
  { title: 'Operacional em menos de 24h', desc: 'Nossa equipe instala e configura tudo — você só precisa abrir as portas.' },
]

const specialties = [
  { icon: Heart,        label: 'Cardiologia' },
  { icon: Brain,        label: 'Saúde Mental' },
  { icon: Bone,         label: 'Ortopedia' },
  { icon: Eye,          label: 'Dermatologia' },
  { icon: Baby,         label: 'Pediatria' },
  { icon: FlaskConical, label: 'Endocrinologia' },
  { icon: Stethoscope,  label: 'Clínico Geral' },
  { icon: Activity,     label: 'Medicina de Família' },
]

const steps = [
  { n: '01', title: 'Você nos contacta', desc: 'Apresentamos a plataforma e elaboramos uma proposta alinhada ao seu fluxo.', video: '/video-passo1-contato.mp4', poster: '/passo1-contato-poster.jpg' },
  { n: '02', title: 'Instalamos tudo', desc: 'Nossa equipe vai até você — equipamentos, plataforma, médicos e treinamento. Operacional no mesmo dia.', video: '/video-passo2-instalacao.mp4', poster: '/passo2-instalacao-poster.jpg' },
  { n: '03', title: 'Atendimento com qualidade', desc: 'Teleconsultas com exame físico real, prontuário completo e documentos automáticos.', video: '/video-passo3-atendimento.mp4', poster: '/passo3-atendimento-poster.jpg' },
]

const where = [
  { title: 'Hospitais e Clínicas',    img: '/ilustra-hospital.png',    tag: 'FIXED'    },
  { title: 'UBS e Postos de Saúde',   img: '/ilustra-ubs.png',         tag: 'FIXED'    },
  { title: 'Atendimento Itinerante',  img: '/ilustra-itinerante.png',  tag: 'MOBILE'   },
  { title: 'Regiões Rurais',          img: '/ilustra-rural.png',       tag: 'REMOTE'   },
]

const numbers = [
  { value: '< 1',   suffix: 'dia',  label: 'Para estar operacional' },
  { value: '6',     suffix: '+',    label: 'Dispositivos BT suportados' },
  { value: '100',   suffix: '%',    label: 'Baseado em nuvem' },
  { value: '24',    suffix: '/7',   label: 'Suporte disponível' },
]

const mockQueue = [
  { initials: 'MA', name: 'Maria Aparecida', status: 'Em consulta',        badge: 'Consultando' },
  { initials: 'JC', name: 'José Carlos',     status: 'Triagem concluída',  badge: 'Pronto' },
  { initials: 'AS', name: 'Ana Silva',       status: 'Aguardando triagem', badge: 'Na fila' },
]

/* ── Lifecycle ──────────────────────────────────────────────────── */
onMounted(async () => {
  if (user.value) {
    const { data } = await supabase.from('profiles').select('role').eq('id', user.value.id).single()
    if (data?.role === 'admin') return navigateTo('/admin')
    if (data?.role === 'medico') return navigateTo('/medico')
  }
  checking.value = false
  await nextTick()

  reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /* Reveal observer */
  const io = new IntersectionObserver(
    entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') }),
    { threshold: 0.07 }
  )
  document.querySelectorAll('.reveal, .reveal-l, .reveal-r').forEach(el => io.observe(el))

  /* Counters fire once when the stats strip becomes visible.
     Belt-and-suspenders: some browsers/automation contexts don't fire
     IntersectionObserver reliably, so also poll on scroll as a fallback. */
  const statsSection = document.querySelector('.s-stats')
  if (statsSection) {
    const statsIo = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) { runCounters(); statsIo.disconnect() } }),
      { threshold: 0.3 }
    )
    statsIo.observe(statsSection)

    const checkStatsVisible = () => {
      if (counted) { window.removeEventListener('scroll', checkStatsVisible); return }
      const r = statsSection.getBoundingClientRect()
      if (r.top < window.innerHeight * 0.85 && r.bottom > 0) {
        runCounters()
        statsIo.disconnect()
        window.removeEventListener('scroll', checkStatsVisible)
      }
    }
    window.addEventListener('scroll', checkStatsVisible, { passive: true })
    checkStatsVisible()
  }

  /* Cursor */
  const onMove = (e: MouseEvent) => {
    _tx = e.clientX; _ty = e.clientY
    cursorX.value = e.clientX; cursorY.value = e.clientY
  }
  const onEnter = () => { cursorHover.value = true }
  const onLeave = () => { cursorHover.value = false }
  document.addEventListener('mousemove', onMove)
  document.querySelectorAll('a, button').forEach(el => {
    el.addEventListener('mouseenter', onEnter)
    el.addEventListener('mouseleave', onLeave)
  })
  animateRing()

  /* Vitals */
  vitalInterval = setInterval(() => {
    liveVitals.value[1].v = String(68 + Math.floor(Math.random() * 8))
    liveVitals.value[2].v = String(96 + Math.floor(Math.random() * 3))
  }, 2400)

  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

/* Stop the cursor RAF loop the instant we start leaving this route —
   otherwise its continuous re-renders can stall the page-leave transition. */
onBeforeRouteLeave(() => {
  window.removeEventListener('scroll', onScroll)
  if (rafId) cancelAnimationFrame(rafId)
  if (vitalInterval) clearInterval(vitalInterval)
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  if (rafId) cancelAnimationFrame(rafId)
  if (vitalInterval) clearInterval(vitalInterval)
})
</script>

<template>
  <div class="somedicos-landing">
  <!-- Custom cursor (desktop only) -->
  <div class="cur-dot" :class="{ hover: cursorHover }" :style="`left:${cursorX}px;top:${cursorY}px`" />
  <div class="cur-ring" :class="{ hover: cursorHover }" :style="`left:${ringX}px;top:${ringY}px`" />

  <div v-if="checking" class="min-h-screen flex items-center justify-center bg-[#F2F0EA]">
    <div class="w-6 h-6 rounded-full border border-[#2daa8a] border-t-transparent animate-spin" />
  </div>

  <div v-else class="site">

    <!-- ── SCROLL PROGRESS ─── -->
    <div class="fixed top-0 left-0 right-0 z-[60] h-[2px] pointer-events-none">
      <div class="h-full bg-[#2daa8a] transition-[width_.1s_linear]" :style="`width:${scrollProgress}%`" />
    </div>

    <!-- ══════════════════════════════════════════════════
         HERO
    ══════════════════════════════════════════════════ -->
    <section class="s-hero">
      <!-- Full-bleed video with parallax -->
      <div class="hero-photo-wrap" :style="`transform:translateY(${parallaxY * 0.14}px)`">
        <video
          class="hero-photo"
          src="/video-hero-teleconsulta.mp4"
          poster="/hero-poster.jpg"
          autoplay muted loop playsinline
        />
      </div>
      <!-- Overlay -->
      <div class="hero-ov" />

      <!-- NAV -->
      <nav class="hero-nav">
        <img src="/logo.png" alt="Central SóMedicos" class="hero-logo" />
        <div class="hero-nav-links">
          <a href="#servicos">Serviços</a>
          <a href="#especialidades">Especialidades</a>
          <a href="#onde-atuamos">Onde Atuamos</a>
        </div>
        <div class="hero-nav-right">
          <NuxtLink to="/auth/login" class="nav-btn-ghost">Plataforma</NuxtLink>
          <a href="#contato" class="nav-btn-solid">Fale conosco</a>
        </div>
        <!-- Mobile burger -->
        <button class="hero-burger md:hidden" @click="mobileMenu = !mobileMenu">
          <span /><span /><span />
        </button>
      </nav>

      <!-- Mobile menu -->
      <div v-if="mobileMenu" class="mobile-menu">
        <a href="#servicos"       @click="mobileMenu=false">Serviços</a>
        <a href="#especialidades" @click="mobileMenu=false">Especialidades</a>
        <a href="#onde-atuamos"   @click="mobileMenu=false">Onde Atuamos</a>
        <NuxtLink to="/auth/login" @click="mobileMenu=false">Plataforma</NuxtLink>
        <a href="#contato"        @click="mobileMenu=false" class="mobile-cta">Fale conosco →</a>
      </div>

      <!-- TITLE BLOCK (bottom-left) -->
      <div class="hero-body" :style="`opacity:${heroOpacity};transform:translateY(${heroShift}px)`">
        <p class="hero-eyebrow intro intro-1">TELECONSULTA · TELEMEDICINA · BRASIL</p>
        <h1 class="hero-h1">
          <span class="h1-line"><span class="h1-thin intro-line intro-2">CENTRAL</span></span>
          <span class="h1-line"><span class="h1-black intro-line intro-3">SÓMEDICOS</span></span>
          <span class="h1-line"><span class="h1-sub intro-line intro-4">COM EXAME<br>FÍSICO AO VIVO.</span></span>
        </h1>
        <div class="hero-actions intro intro-5">
          <a href="#contato" class="btn-accent">Começar agora <ArrowRight :size="16" /></a>
          <a href="#demo"    class="btn-ghost-light">Ver plataforma</a>
        </div>
      </div>

      <!-- INFO TAG (bottom-right) -->
      <div class="hero-tag" :style="`opacity:${heroOpacity}`">
        <span class="tag-top intro intro-5">EM OPERAÇÃO</span>
        <span class="tag-bottom intro intro-5">CEARÁ · BRASIL</span>
        <span class="hero-scroll-hint intro intro-5"><span class="hint-line" />SCROLL</span>
      </div>

      <!-- MARQUEE (very bottom) -->
      <div class="hero-marquee">
        <div class="mq-track">
          <span class="mq-inner" v-for="_ in 3" :key="_">
            TELEMEDICINA &nbsp;·&nbsp; EXAME FÍSICO AO VIVO &nbsp;·&nbsp; BLUETOOTH &nbsp;·&nbsp;
            PRONTUÁRIO DIGITAL &nbsp;·&nbsp; MÉDICOS INCLUSOS &nbsp;·&nbsp;
            IMPLANTAÇÃO &lt; 24H &nbsp;·&nbsp; FORTALEZA, CE &nbsp;·&nbsp;
          </span>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════════════════
         STATS STRIP
    ══════════════════════════════════════════════════ -->
    <section class="s-stats">
      <div class="stats-inner">
        <div v-for="(n, i) in numbers" :key="n.value" class="stat-item reveal" :class="`delay-${i+1}`">
          <div class="stat-num">{{ displayNums[i] }}<span class="stat-suffix">{{ n.suffix }}</span></div>
          <div class="stat-label">{{ n.label }}</div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════════════════
         STATEMENT
    ══════════════════════════════════════════════════ -->
    <section class="s-statement" ref="statementEl">
      <div class="statement-pin">
        <div class="statement-bg" aria-hidden="true">
          <img
            class="st-doctor"
            src="/medico-cutout.png"
            alt=""
            :style="`transform:translateY(${statementProgress * -24}px)`"
          />
          <div class="st-orb st-orb-a" :style="`transform:translate(${statementProgress * -60}px,${statementProgress * 40}px) scale(${1 + statementProgress * 0.25})`" />
          <div class="st-orb st-orb-b" :style="`transform:translate(${statementProgress * 50}px,${statementProgress * -30}px) scale(${1 + statementProgress * 0.18})`" />
          <div class="st-grid" :style="`opacity:${0.15 + statementProgress * 0.2}`" />
        </div>
        <div class="statement-inner">
          <p class="section-eyebrow reveal">O QUE FAZEMOS</p>
          <p class="statement-text">
            <span
              v-for="(w, i) in statementWords"
              :key="i"
              class="st-w"
              :class="{ on: i < wordsOn }"
            >{{ w + ' ' }}</span>
          </p>
          <a href="#contato" class="link-arrow reveal">Fale com nossa equipe <ArrowRight :size="14" /></a>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════════════════
         SERVICES  id="servicos"
    ══════════════════════════════════════════════════ -->
    <section id="servicos" class="s-features">
      <div class="features-grid">
        <!-- Left col -->
        <div class="features-left reveal-l">
          <p class="section-eyebrow">NOSSOS SERVIÇOS</p>
          <p class="features-headline">Tudo que<br>sua unidade<br>precisa.</p>
          <video
            class="features-photo"
            src="/video-dispositivo-bt.mp4"
            poster="/dispositivo-bt-poster.jpg"
            autoplay muted loop playsinline
          />
        </div>
        <!-- Right col -->
        <div class="features-right">
          <div
            v-for="(f, i) in featureList"
            :key="f.title"
            class="feat-row reveal"
            :class="`delay-${i + 1}`"
          >
            <span class="feat-n">0{{ i + 1 }}</span>
            <div class="feat-body">
              <p class="feat-title">{{ f.title }}</p>
              <p class="feat-desc">{{ f.desc }}</p>
            </div>
            <CheckCircle2 :size="16" class="feat-check" />
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════════════════
         PLATFORM DEMO  id="demo"
    ══════════════════════════════════════════════════ -->
    <section id="demo" class="s-demo">
      <div class="demo-header reveal">
        <p class="section-eyebrow light">PLATAFORMA EM AÇÃO</p>
        <h2 class="demo-h2">
          Uma teleconsulta<br>com exame físico<br>em tempo real.
        </h2>
        <p class="demo-sub">O médico conduz a consulta por vídeo enquanto a enfermeira coleta sinais vitais via Bluetooth. Tudo aparece na mesma tela.</p>
      </div>

      <!-- App mockup (3D tilt scrubbed to scroll) -->
      <div class="demo-persp" ref="demoEl">
      <div
        class="demo-window"
        :style="`opacity:${demoOpacity};transform:rotateX(${demoTiltX}deg) scale(${demoScale})`"
      >
        <!-- Title bar -->
        <div class="dw-bar">
          <span class="dw-dot red" /><span class="dw-dot yellow" /><span class="dw-dot green" />
          <span class="dw-url">app.centralsomedicos.com.br/medico/consulta</span>
          <span class="dw-live"><span class="dw-blink" />Ao vivo</span>
        </div>
        <!-- Body -->
        <div class="dw-body">
          <!-- Video feed (2/3) -->
          <div class="dw-video">
            <div class="dw-patient-bg">
              <div class="dw-avatar" />
              <span class="dw-name-tag">Maria Aparecida · Paciente</span>
            </div>
            <div class="dw-rec"><span class="dw-rec-dot" />REC 00:08:24</div>
            <div class="dw-self">
              <div class="dw-self-av" />
              <span class="dw-self-name">Dr. Alex F.</span>
            </div>
            <!-- Controls -->
            <div class="dw-controls">
              <button class="dw-ctrl">🎙</button>
              <button class="dw-ctrl">📷</button>
              <button class="dw-ctrl end"><Phone :size="15" style="transform:rotate(135deg)" /></button>
              <button class="dw-ctrl">📋</button>
            </div>
          </div>
          <!-- Sidebar (1/3) -->
          <div class="dw-sidebar">
            <div class="dw-vitals">
              <div class="dw-vitals-hdr">
                <Bluetooth :size="11" /><span>Sinais Vitais · Ao Vivo</span>
                <span class="dw-bt-tag">BT</span>
              </div>
              <div v-for="v in liveVitals" :key="v.l" class="dw-vital-row">
                <span class="dw-vl">{{ v.l }}</span>
                <span class="dw-vv">{{ v.v }} <span class="dw-vu">{{ v.unit }}</span></span>
              </div>
              <!-- ECG -->
              <div class="dw-ecg">
                <svg viewBox="0 0 200 28" preserveAspectRatio="none" class="dw-ecg-svg">
                  <polyline points="0,14 20,14 28,6 36,22 44,14 60,14 68,3 76,25 80,14 96,14 104,6 112,22 120,14 136,14 144,3 152,25 156,14 172,14 180,6 188,22 200,14" fill="none" stroke="#2daa8a" stroke-width="1.2" />
                </svg>
              </div>
            </div>
            <div class="dw-queue">
              <p class="dw-q-hdr">Fila de Espera</p>
              <div v-for="p in mockQueue" :key="p.name" class="dw-q-row">
                <span class="dw-q-av">{{ p.initials }}</span>
                <div class="dw-q-info">
                  <span class="dw-q-name">{{ p.name }}</span>
                  <span class="dw-q-status">{{ p.status }}</span>
                </div>
                <span class="dw-q-badge">{{ p.badge }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════════════════
         SPECIALTIES  id="especialidades"
    ══════════════════════════════════════════════════ -->
    <section id="especialidades" class="s-specs">
      <div class="specs-inner">
        <p class="section-eyebrow reveal">ESPECIALIDADES</p>
        <h2 class="specs-h2 reveal">Corpo clínico<br>treinado.</h2>
        <div class="specs-chips reveal">
          <span v-for="sp in specialties" :key="sp.label" class="spec-chip">
            <component :is="sp.icon" :size="13" />
            {{ sp.label }}
          </span>
          <span class="spec-chip ghost">+ muito mais</span>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════════════════
         HOW IT WORKS (dark)
    ══════════════════════════════════════════════════ -->
    <section class="s-steps">
      <div class="steps-hdr reveal">
        <p class="section-eyebrow light">COMO FUNCIONA</p>
        <h2 class="steps-h2">Do contato ao<br>primeiro atendimento<br>em menos de um dia.</h2>
      </div>
      <div class="steps-list">
        <div
          v-for="(s, i) in steps"
          :key="s.n"
          class="step reveal"
          :class="i === 0 ? 'reveal-l' : i === 2 ? 'reveal-r' : 'reveal'"
          :style="`--delay:${i * 0.12}s`"
        >
          <div class="step-img-wrap">
            <video
              :src="s.video"
              :poster="s.poster"
              class="step-img"
              autoplay muted loop playsinline
            />
          </div>
          <div class="step-body">
            <span class="step-n">{{ s.n }}</span>
            <p class="step-title">{{ s.title }}</p>
            <p class="step-desc">{{ s.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════════════════
         WHERE  id="onde-atuamos"
    ══════════════════════════════════════════════════ -->
    <section id="onde-atuamos" class="s-where">
      <div class="where-banner reveal">
        <video
          class="where-banner-video"
          src="/video-onde-atuamos.mp4"
          poster="/onde-atuamos-poster.jpg"
          autoplay muted loop playsinline
        />
        <div class="where-banner-ov" />
        <div class="where-hdr">
          <p class="section-eyebrow light">ONDE ATUAMOS</p>
          <h2 class="where-h2 light">Instalamos onde<br>você precisar.</h2>
        </div>
      </div>
      <div class="where-grid">
        <div
          v-for="(w, i) in where"
          :key="w.title"
          class="where-card reveal"
          :class="i < 2 ? 'reveal-l' : 'reveal-r'"
          :style="`--delay:${i * 0.1}s`"
        >
          <div class="where-img-wrap">
            <img :src="w.img" :alt="w.title" class="where-img" />
            <span class="where-tag">{{ w.tag }}</span>
          </div>
          <p class="where-title">{{ w.title }}</p>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════════════════
         TEAM
    ══════════════════════════════════════════════════ -->
    <section class="s-team">
      <div class="team-inner reveal">
        <p class="section-eyebrow">NOSSA EQUIPE</p>
        <div class="team-card">
          <img src="/equipe-alex-fernandes.jpg" alt="Dr. Alex Fernandes" class="team-photo" />
          <div class="team-bio">
            <p class="team-name">Alex Fernandes</p>
            <p class="team-crm">CRM/CE 19594</p>
            <p class="team-text">
              Médico formado pela FAMENE, com experiência sólida em Atenção Primária e Secundária,
              foco em Saúde da Família e Comunidade, Telemedicina e Psiquiatria.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════════════════
         CONTACT / CTA  id="contato"
    ══════════════════════════════════════════════════ -->
    <section id="contato" class="s-cta" ref="ctaEl">
      <div class="cta-inner reveal">
        <p class="section-eyebrow light">FALE CONOSCO</p>
        <h2 class="cta-h2">
          Pronto para<br>transformar o<br>atendimento?
        </h2>
        <p class="cta-sub">Sem compromisso, sem burocracia. Operacionais em menos de 24h.</p>
        <div class="cta-actions">
          <a href="mailto:contato@centralsomedicos.com.br" class="btn-accent">
            contato@centralsomedicos.com.br <ArrowRight :size="16" />
          </a>
          <a href="https://wa.me/5585984050068" class="btn-ghost-light">
            WhatsApp · (85) 98405-0068
          </a>
        </div>
        <p class="cta-hours">Suporte das 8h às 18h · Segunda a Sábado</p>
      </div>
      <!-- big decorative text (drifts with scroll) -->
      <p class="cta-bg-text" aria-hidden="true" :style="`transform:translateX(${-ctaBgShift}px)`">CENTRAL<br>SÓMEDICOS</p>
    </section>

    <!-- ══════════════════════════════════════════════════
         FOOTER
    ══════════════════════════════════════════════════ -->
    <footer class="s-footer">
      <div class="footer-top">
        <img src="/logo.png" alt="Central SóMedicos" class="footer-logo" />
        <nav class="footer-nav">
          <a href="#servicos">Serviços</a>
          <a href="#especialidades">Especialidades</a>
          <a href="#onde-atuamos">Onde Atuamos</a>
          <a href="#contato">Contato</a>
          <NuxtLink to="/auth/login">Plataforma</NuxtLink>
        </nav>
        <div class="footer-contact">
          <a href="tel:+5585984050068">(85) 98405-0068</a>
          <span>Av. Ministro José Américo, 326 · Fortaleza/CE</span>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© {{ new Date().getFullYear() }} Central SóMedicos · CNPJ 15.105.657/0001-90</span>
        <div class="footer-legal">
          <a href="#">Privacidade</a>
          <a href="#">Termos</a>
        </div>
      </div>
    </footer>

    <!-- ── WhatsApp float ── -->
    <a
      href="https://wa.me/5585984050068"
      target="_blank"
      rel="noopener"
      class="wa-float"
      aria-label="WhatsApp"
    >
      <MessageCircle :size="22" fill="white" />
    </a>

    <!-- ── Back to top ── -->
    <Transition name="bt">
      <button
        v-if="showBackToTop"
        class="btt"
        aria-label="Voltar ao topo"
        @click="scrollToTop"
      >
        <ChevronRight :size="18" style="transform:rotate(-90deg)" />
      </button>
    </Transition>

  </div>
  </div>
</template>

<style>
/* ══ GLOBAL ════════════════════════════════════════════════════════ */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html {
  scroll-behavior: smooth;
  font-size: 16px;
}
.somedicos-landing {
  background: #F2F0EA;
  color: #0A0C09;
  font-family: 'DM Sans', 'Inter', sans-serif;
  overflow-x: clip;
  cursor: none;
  -webkit-font-smoothing: antialiased;
}

@media (hover: none) {
  .somedicos-landing { cursor: auto; }
  .cur-dot, .cur-ring { display: none; }
}

section[id] { scroll-margin-top: 80px; }

/* ══ CURSOR ════════════════════════════════════════════════════════ */
.cur-dot {
  position: fixed;
  width: 7px; height: 7px;
  border-radius: 50%;
  background: #2daa8a;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 9999;
  transition: width .18s, height .18s;
}
.cur-dot.hover { width: 10px; height: 10px; }

.cur-ring {
  position: fixed;
  width: 38px; height: 38px;
  border-radius: 50%;
  border: 1.5px solid rgba(10,12,9,0.28);
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 9998;
  transition: width .22s, height .22s, border-color .22s;
}
.cur-ring.hover {
  width: 56px; height: 56px;
  border-color: #2daa8a;
}

/* ══ SITE WRAPPER ════════════════════════════════════════════════ */
.site {
  background: #F2F0EA;
  color: #0A0C09;
}

/* ══ HERO ════════════════════════════════════════════════════════ */
.s-hero {
  position: relative;
  height: 100vh;
  min-height: 600px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.hero-photo-wrap {
  position: absolute;
  inset: 0;
  will-change: transform;
}
.hero-photo {
  position: absolute;
  inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  object-position: center 30%;
  animation: kenburns 7s cubic-bezier(.16,1,.3,1) forwards;
}
@keyframes kenburns {
  0%   { transform: scale(1.32); }
  100% { transform: scale(1.14); }
}

/* Hero staged intro */
.intro {
  opacity: 0;
  transform: translateY(24px);
  animation: intro-up .9s cubic-bezier(.22,1,.36,1) forwards;
}
@keyframes intro-up {
  to { opacity: 1; transform: none; }
}
.h1-line {
  display: block;
  overflow: hidden;
  padding-bottom: 0.05em;
}
.intro-line {
  display: block;
  transform: translateY(110%);
  animation: intro-line 1s cubic-bezier(.22,1,.36,1) forwards;
}
@keyframes intro-line {
  to { transform: translateY(0); }
}
.intro-1 { animation-delay: .15s; }
.intro-2 { animation-delay: .3s; }
.intro-3 { animation-delay: .45s; }
.intro-4 { animation-delay: .62s; }
.intro-5 { animation-delay: .85s; }

/* Scroll hint */
.hero-scroll-hint {
  display: flex; align-items: center; gap: 0.5rem;
  margin-top: 1rem;
  font-size: 0.6rem; font-weight: 700; letter-spacing: 0.25em;
  color: rgba(255,255,255,0.5);
}
.hint-line {
  display: block; width: 34px; height: 1px;
  background: rgba(255,255,255,0.35);
  position: relative; overflow: hidden;
}
.hint-line::after {
  content: ''; position: absolute; inset: 0;
  background: #2daa8a;
  animation: hint-sweep 1.8s cubic-bezier(.4,0,.2,1) infinite;
}
@keyframes hint-sweep {
  0%   { transform: translateX(-100%); }
  55%  { transform: translateX(100%); }
  100% { transform: translateX(100%); }
}

@media (prefers-reduced-motion: reduce) {
  .hero-photo { animation: none; transform: scale(1.14); }
  .intro, .intro-line { animation: none; opacity: 1; transform: none; }
  .hint-line::after { animation: none; }
}

.hero-ov {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(6, 9, 6, 0.35) 0%,
    rgba(6, 9, 6, 0.05) 35%,
    rgba(6, 9, 6, 0.55) 70%,
    rgba(6, 9, 6, 0.88) 100%
  );
}

/* Nav */
.hero-nav {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  padding: 1.5rem 2.5rem;
  gap: 2rem;
}
.hero-logo {
  height: 76px; width: auto;
  padding: 0.6rem 1.1rem;
  background: rgba(255,255,255,0.9);
  border-radius: 12px;
  backdrop-filter: blur(6px);
  box-shadow: 0 2px 14px rgba(0,0,0,0.12);
}
.hero-nav-links {
  display: flex;
  gap: 2rem;
  margin-left: auto;
}
.hero-nav-links a {
  font-size: 0.8125rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: rgba(255,255,255,0.72);
  text-decoration: none;
  transition: color .2s;
}
.hero-nav-links a:hover { color: #fff; }
.hero-nav-right { display: flex; gap: 0.75rem; align-items: center; }

.nav-btn-ghost {
  font-size: 0.8125rem; font-weight: 600; letter-spacing: 0.03em;
  color: rgba(255,255,255,0.7);
  text-decoration: none;
  border: 1px solid rgba(255,255,255,0.2);
  padding: 0.45rem 1.1rem;
  border-radius: 100px;
  transition: all .2s;
}
.nav-btn-ghost:hover { color: #fff; border-color: rgba(255,255,255,0.5); }

.nav-btn-solid {
  font-size: 0.8125rem; font-weight: 700; letter-spacing: 0.03em;
  color: #0A0C09;
  text-decoration: none;
  background: #2daa8a;
  padding: 0.45rem 1.1rem;
  border-radius: 100px;
  transition: opacity .2s;
}
.nav-btn-solid:hover { opacity: 0.88; }

.hero-burger {
  background: none; border: none;
  display: flex; flex-direction: column; gap: 5px;
  padding: 4px; margin-left: auto;
}
.hero-burger span {
  display: block; width: 22px; height: 1.5px;
  background: rgba(255,255,255,0.8);
  border-radius: 2px;
}

.mobile-menu {
  position: absolute; top: 80px; left: 0; right: 0;
  background: rgba(10,12,9,0.96);
  backdrop-filter: blur(16px);
  padding: 1.5rem 2rem;
  display: flex; flex-direction: column; gap: 1.25rem;
  z-index: 50;
}
.mobile-menu a {
  color: rgba(255,255,255,0.8); font-weight: 500; font-size: 1rem;
  text-decoration: none;
}
.mobile-cta { color: #2daa8a !important; font-weight: 700; }

/* Hero body (bottom-left) */
.hero-body {
  position: absolute;
  bottom: 7rem;
  left: 2.5rem;
  right: 2.5rem;
  z-index: 10;
  max-width: 780px;
}

.hero-eyebrow {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  color: rgba(255,255,255,0.45);
  text-transform: uppercase;
  margin-bottom: 1rem;
}

.hero-h1 {
  display: flex;
  flex-direction: column;
  line-height: 0.95;
  margin-bottom: 2rem;
  font-size: clamp(2.8rem, 8vw, 7rem);
}
.h1-thin {
  font-weight: 200;
  letter-spacing: 0.05em;
  color: rgba(255,255,255,0.75);
  text-transform: uppercase;
}
.h1-black {
  font-weight: 900;
  letter-spacing: -0.02em;
  color: #ffffff;
  text-transform: uppercase;
}
.h1-sub {
  font-size: clamp(1rem, 2.5vw, 1.5rem);
  font-weight: 400;
  letter-spacing: 0.03em;
  color: rgba(255,255,255,0.6);
  text-transform: uppercase;
  line-height: 1.4;
  margin-top: 0.75rem;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

/* Hero tag (bottom-right) */
.hero-tag {
  position: absolute;
  bottom: 7rem;
  right: 2.5rem;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.2rem;
}
.tag-top {
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  color: rgba(255,255,255,0.4);
  text-transform: uppercase;
}
.tag-bottom {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: rgba(255,255,255,0.75);
  text-transform: uppercase;
}

/* Marquee */
.hero-marquee {
  position: absolute;
  bottom: 0;
  left: 0; right: 0;
  overflow: hidden;
  border-top: 1px solid rgba(255,255,255,0.08);
  background: rgba(0,0,0,0.35);
  z-index: 10;
}
@keyframes mq-scroll { 0%{transform:translateX(0)} 100%{transform:translateX(-33.33%)} }
.mq-track {
  display: flex;
  white-space: nowrap;
  animation: mq-scroll 28s linear infinite;
}
.mq-inner {
  display: inline-block;
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
  padding: 0.65rem 0;
}

@media (max-width: 768px) {
  .hero-nav-links, .hero-nav-right { display: none; }
  .hero-body { bottom: 6rem; left: 1.25rem; right: 1.25rem; }
  .hero-tag { display: none; }
}

/* ══ BUTTONS ═════════════════════════════════════════════════════ */
.btn-accent {
  display: inline-flex; align-items: center; gap: 0.5rem;
  background: #2daa8a;
  color: #fff;
  font-size: 0.875rem; font-weight: 700; letter-spacing: 0.02em;
  padding: 0.85rem 1.75rem;
  border-radius: 100px;
  text-decoration: none;
  transition: opacity .2s, transform .2s;
}
.btn-accent:hover { opacity: 0.88; transform: translateY(-1px); }

.btn-ghost-light {
  display: inline-flex; align-items: center; gap: 0.5rem;
  background: transparent;
  color: rgba(255,255,255,0.75);
  font-size: 0.875rem; font-weight: 600; letter-spacing: 0.02em;
  padding: 0.85rem 1.75rem;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 100px;
  text-decoration: none;
  transition: all .2s;
}
.btn-ghost-light:hover { color: #fff; border-color: rgba(255,255,255,0.5); }

/* ══ SECTION COMMON ════════════════════════════════════════════════ */
.section-eyebrow {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #767670;
  margin-bottom: 1.25rem;
  display: block;
}
.section-eyebrow.light { color: rgba(255,255,255,0.35); }

/* ══ STATS ════════════════════════════════════════════════════════ */
.s-stats {
  background: #F2F0EA;
  border-bottom: 1px solid rgba(10,12,9,0.08);
}
.stats-inner {
  max-width: 1200px; margin: 0 auto;
  display: grid; grid-template-columns: repeat(4, 1fr);
}
.stat-item {
  padding: 3rem 2rem;
  border-right: 1px solid rgba(10,12,9,0.08);
  text-align: center;
}
.stat-item:last-child { border-right: none; }
.stat-num {
  font-size: clamp(2.5rem, 5vw, 3.5rem);
  font-weight: 900;
  letter-spacing: -0.04em;
  color: #0A0C09;
  line-height: 1;
  margin-bottom: 0.5rem;
}
.stat-suffix {
  font-weight: 200;
  letter-spacing: 0.02em;
  color: #2daa8a;
}
.stat-label {
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #767670;
}

@media (max-width: 640px) {
  .stats-inner { grid-template-columns: repeat(2, 1fr); }
  .stat-item:nth-child(2) { border-right: none; }
  .stat-item:nth-child(3) { border-top: 1px solid rgba(10,12,9,0.08); }
}

/* ══ STATEMENT (pinned, Apple-style scroll reveal) ═════════════════ */
.s-statement {
  position: relative;
  background: #F2F0EA;
  min-height: 180vh;
  border-bottom: 1px solid rgba(10,12,9,0.08);
}
.statement-pin {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  align-items: center;
  padding: 0 2.5rem;
  overflow: hidden;
}
.statement-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}
.st-doctor {
  position: absolute;
  right: 2%;
  bottom: -12%;
  height: 108%;
  width: auto;
  max-width: 46%;
  object-fit: contain;
  object-position: bottom;
  filter: grayscale(65%) contrast(1.02);
  opacity: 0.5;
  -webkit-mask-image: linear-gradient(to top, black 55%, transparent 92%);
          mask-image: linear-gradient(to top, black 55%, transparent 92%);
  animation: st-doctor-float 7s ease-in-out infinite;
  will-change: transform;
}
@keyframes st-doctor-float {
  0%, 100% { margin-bottom: 0; }
  50%      { margin-bottom: 14px; }
}
.st-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  transition: transform .3s linear;
  animation: st-drift 14s ease-in-out infinite alternate;
}
.st-orb-a {
  width: 460px; height: 460px;
  left: 6%; top: 12%;
  background: radial-gradient(circle, rgba(45,170,138,0.32), transparent 70%);
}
.st-orb-b {
  width: 400px; height: 400px;
  right: 8%; bottom: 10%;
  background: radial-gradient(circle, rgba(10,12,9,0.10), transparent 70%);
  animation-delay: -7s;
}
@keyframes st-drift {
  0%   { margin: 0; }
  100% { margin: 20px 0 0 20px; }
}
.st-grid {
  position: absolute;
  inset: -1px;
  background-image:
    linear-gradient(rgba(10,12,9,0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(10,12,9,0.06) 1px, transparent 1px);
  background-size: 56px 56px;
  transition: opacity .3s linear;
}
.statement-inner {
  position: relative;
  z-index: 1;
  max-width: 860px; margin: 0 auto;
}
.statement-text {
  font-size: clamp(1.4rem, 3vw, 2.25rem);
  font-weight: 300;
  line-height: 1.5;
  letter-spacing: -0.01em;
  color: #0A0C09;
  margin-bottom: 2rem;
}
.st-w {
  color: rgba(10,12,9,0.16);
  transition: color .35s ease;
}
.st-w.on { color: #0A0C09; }
.link-arrow {
  display: inline-flex; align-items: center; gap: 0.4rem;
  font-size: 0.875rem; font-weight: 700; letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #2daa8a;
  text-decoration: none;
  border-bottom: 1px solid transparent;
  padding-bottom: 2px;
  transition: border-color .2s;
}
.link-arrow:hover { border-bottom-color: #2daa8a; }

/* ══ FEATURES ════════════════════════════════════════════════════ */
.s-features {
  background: #F2F0EA;
  padding: 7rem 2.5rem;
  border-bottom: 1px solid rgba(10,12,9,0.08);
}
.features-grid {
  max-width: 1200px; margin: 0 auto;
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 5rem;
}
.features-left {
  position: sticky;
  top: 6rem;
  align-self: start;
}
.features-headline {
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1.05;
  color: #0A0C09;
  margin-bottom: 2.5rem;
}
.features-photo {
  display: block;
  width: 100%; height: auto; border-radius: 4px;
  aspect-ratio: 4/3; object-fit: cover;
  filter: grayscale(20%) contrast(1.05);
}
.features-right {
  display: flex; flex-direction: column; gap: 0;
}
.feat-row {
  display: grid;
  grid-template-columns: 2.5rem 1fr 1.5rem;
  gap: 1.25rem;
  align-items: start;
  padding: 1.75rem 0;
  border-bottom: 1px solid rgba(10,12,9,0.08);
  transition: background .2s;
}
.feat-row:hover { background: rgba(10,12,9,0.02); }
.feat-n {
  font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.1em;
  color: #2daa8a;
  padding-top: 0.2rem;
}
.feat-title {
  font-size: 1rem; font-weight: 700; color: #0A0C09;
  margin-bottom: 0.35rem;
}
.feat-desc { font-size: 0.875rem; line-height: 1.6; color: #767670; }
.feat-check { color: #2daa8a; margin-top: 0.25rem; }

@media (max-width: 768px) {
  .features-grid { grid-template-columns: 1fr; gap: 3rem; }
  .features-left { position: static; }
  .features-photo { display: none; }
}

/* ══ DEMO (dark) ═════════════════════════════════════════════════ */
.s-demo {
  background: #0C0F0D;
  padding: 7rem 2.5rem;
}
.demo-header {
  max-width: 700px; margin: 0 auto 4rem;
  text-align: center;
}
.demo-h2 {
  font-size: clamp(2rem, 4.5vw, 3.5rem);
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1.05;
  color: #fff;
  margin-bottom: 1rem;
}
.demo-sub { font-size: 1rem; line-height: 1.6; color: rgba(255,255,255,0.5); }

/* App window */
.demo-persp {
  perspective: 1400px;
  perspective-origin: 50% 0%;
}
.demo-window {
  max-width: 1100px; margin: 0 auto;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 40px 100px rgba(0,0,0,0.6);
  transform-origin: 50% 100%;
  will-change: transform, opacity;
}
.dw-bar {
  display: flex; align-items: center; gap: 0.5rem;
  background: #161b1a; padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.dw-dot { width: 11px; height: 11px; border-radius: 50%; }
.dw-dot.red { background: #ff5f57; }
.dw-dot.yellow { background: #ffbd2e; }
.dw-dot.green { background: #28ca41; }
.dw-url {
  flex: 1; margin: 0 0.75rem;
  font-size: 0.7rem; color: rgba(255,255,255,0.3);
  text-align: center;
  background: rgba(255,255,255,0.05);
  border-radius: 4px; padding: 0.3rem 0.75rem;
}
.dw-live {
  font-size: 0.7rem; font-weight: 700; letter-spacing: 0.06em;
  color: #2daa8a; display: flex; align-items: center; gap: 0.35rem;
}
.dw-blink {
  width: 6px; height: 6px; border-radius: 50%;
  background: #2daa8a; animation: pulse-dot 1.4s ease-in-out infinite;
}
@keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.35} }

.dw-body {
  display: grid; grid-template-columns: 2fr 1fr; min-height: 340px;
}

/* Video area */
.dw-video {
  position: relative; background: #0a1422; overflow: hidden;
}
.dw-patient-bg {
  position: absolute; inset: 0;
  background: linear-gradient(135deg, #0a1628, #0f2040);
  display: flex; align-items: center; justify-content: center;
}
.dw-avatar {
  width: 80px; height: 80px; border-radius: 50%;
  background: linear-gradient(135deg, #1a3a5f, #2a4f7a);
  border: 2px solid rgba(255,255,255,0.06);
}
.dw-name-tag {
  position: absolute; bottom: 3.5rem; left: 0.75rem;
  font-size: 0.7rem; font-weight: 600; color: white;
  background: rgba(0,0,0,0.65); padding: 0.3rem 0.6rem; border-radius: 4px;
  backdrop-filter: blur(8px);
}
.dw-rec {
  position: absolute; top: 0.75rem; left: 0.75rem;
  display: flex; align-items: center; gap: 0.35rem;
  font-size: 0.7rem; font-weight: 700; color: white;
  background: rgba(0,0,0,0.6); padding: 0.3rem 0.6rem; border-radius: 4px;
  backdrop-filter: blur(8px);
}
.dw-rec-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #ef4444; animation: pulse-dot 1s ease-in-out infinite;
}
.dw-self {
  position: absolute; bottom: 0.75rem; right: 0.75rem;
  width: 80px; height: 60px; border-radius: 6px; overflow: hidden;
  border: 1.5px solid rgba(255,255,255,0.12);
  background: linear-gradient(135deg, #1a3a5c, #1e4d9a);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
}
.dw-self-av {
  width: 26px; height: 26px; border-radius: 50%;
  background: linear-gradient(135deg, #2d62bc, #163c7d);
}
.dw-self-name { font-size: 8px; color: rgba(255,255,255,0.6); }
.dw-controls {
  position: absolute; bottom: 0; left: 0; right: 0;
  display: flex; align-items: center; justify-content: center; gap: 0.6rem;
  padding: 0.6rem;
  background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
}
.dw-ctrl {
  width: 36px; height: 36px; border-radius: 50%; border: none;
  background: rgba(255,255,255,0.1); font-size: 0.85rem;
  display: flex; align-items: center; justify-content: center; color: white;
  cursor: pointer; transition: background .2s;
}
.dw-ctrl:hover { background: rgba(255,255,255,0.18); }
.dw-ctrl.end { background: #ef4444; }
.dw-ctrl.end:hover { background: #dc2626; }

/* Sidebar */
.dw-sidebar {
  border-left: 1px solid rgba(255,255,255,0.06);
  background: #0d1117; display: flex; flex-direction: column;
}
.dw-vitals { padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.06); flex: 1; }
.dw-vitals-hdr {
  display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.75rem;
  font-size: 0.65rem; font-weight: 700; letter-spacing: 0.06em;
  color: rgba(255,255,255,0.5);
}
.dw-bt-tag {
  margin-left: auto; font-size: 0.55rem; font-weight: 800; letter-spacing: 0.1em;
  background: rgba(45,170,138,0.15); color: #7de8d0;
  padding: 1px 5px; border-radius: 3px;
}
.dw-vital-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.4rem 0.5rem; border-radius: 5px; margin-bottom: 0.2rem;
  background: rgba(255,255,255,0.03);
}
.dw-vl { font-size: 0.7rem; color: rgba(255,255,255,0.4); }
.dw-vv { font-size: 0.8rem; font-weight: 700; color: #2daa8a; transition: color .5s; }
.dw-vu { font-size: 0.6rem; color: rgba(255,255,255,0.28); font-weight: 400; }
.dw-ecg {
  margin-top: 0.5rem; border-radius: 4px; overflow: hidden;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); height: 30px;
}
.dw-ecg-svg {
  width: 100%; height: 100%;
}
.dw-ecg-svg polyline {
  stroke-dasharray: 600; animation: ecg 3s linear infinite;
}
@keyframes ecg { 0%{stroke-dashoffset:600} 100%{stroke-dashoffset:0} }

.dw-queue { padding: 0.75rem 1rem; }
.dw-q-hdr {
  font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em;
  text-transform: uppercase; color: rgba(255,255,255,0.35);
  margin-bottom: 0.5rem;
}
.dw-q-row {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.4rem 0; border-bottom: 1px solid rgba(255,255,255,0.04);
}
.dw-q-av {
  width: 24px; height: 24px; border-radius: 50%;
  background: rgba(45,170,138,0.15); color: #7de8d0;
  font-size: 9px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.dw-q-info { flex: 1; min-width: 0; }
.dw-q-name { font-size: 0.7rem; font-weight: 600; color: rgba(255,255,255,0.72); display: block; truncate: true; overflow: hidden; white-space: nowrap; }
.dw-q-status { font-size: 0.6rem; color: rgba(255,255,255,0.3); }
.dw-q-badge { font-size: 0.55rem; font-weight: 800; color: #7de8d0; background: rgba(45,170,138,0.12); padding: 2px 5px; border-radius: 3px; flex-shrink: 0; }

@media (max-width: 640px) {
  .dw-body { grid-template-columns: 1fr; }
  .dw-sidebar { border-left: none; border-top: 1px solid rgba(255,255,255,0.06); }
  .dw-video { min-height: 300px; }
}

/* ══ SPECIALTIES ════════════════════════════════════════════════ */
.s-specs {
  background: #F2F0EA;
  padding: 7rem 2.5rem;
  border-top: 1px solid rgba(10,12,9,0.08);
}
.specs-inner { max-width: 900px; margin: 0 auto; }
.specs-h2 {
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 900; letter-spacing: -0.03em; line-height: 1.05;
  color: #0A0C09; margin-bottom: 2.5rem;
}
.specs-chips {
  display: flex; flex-wrap: wrap; gap: 0.65rem;
}
.spec-chip {
  display: inline-flex; align-items: center; gap: 0.5rem;
  font-size: 0.8125rem; font-weight: 600;
  color: #0A0C09;
  border: 1px solid rgba(10,12,9,0.14);
  padding: 0.55rem 1.1rem; border-radius: 100px;
  transition: all .2s;
}
.spec-chip:hover { background: #0A0C09; color: #F2F0EA; }
.spec-chip.ghost { color: #767670; border-style: dashed; }

/* ══ HOW IT WORKS (dark) ════════════════════════════════════════ */
.s-steps {
  background: #0C0F0D;
  padding: 7rem 2.5rem;
}
.steps-hdr {
  max-width: 1200px; margin: 0 auto 4rem; padding: 0;
}
.steps-h2 {
  font-size: clamp(2rem, 4.5vw, 3.5rem);
  font-weight: 900; letter-spacing: -0.03em; line-height: 1.05;
  color: #fff;
}
.steps-list {
  max-width: 1200px; margin: 0 auto;
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem;
}
.step { display: flex; flex-direction: column; gap: 1.25rem; }
.step { transition-delay: var(--delay, 0s); }
.step-img-wrap {
  border-radius: 6px; overflow: hidden;
  background: rgba(255,255,255,0.04);
  aspect-ratio: 4/3;
}
.step-img { width: 100%; height: 100%; object-fit: cover; filter: brightness(0.8); }
.step-body { padding: 0 0.25rem; }
.step-n {
  font-size: 0.65rem; font-weight: 800; letter-spacing: 0.15em;
  color: #2daa8a; display: block; margin-bottom: 0.5rem;
}
.step-title {
  font-size: 1rem; font-weight: 700; color: #fff; margin-bottom: 0.4rem;
}
.step-desc { font-size: 0.875rem; line-height: 1.6; color: rgba(255,255,255,0.45); }

@media (max-width: 768px) {
  .steps-list { grid-template-columns: 1fr; max-width: 480px; }
}

/* ══ WHERE ════════════════════════════════════════════════════════ */
.s-where {
  background: #F2F0EA;
  padding: 7rem 2.5rem;
  border-top: 1px solid rgba(10,12,9,0.08);
}
.where-banner {
  position: relative;
  max-width: 1200px; margin: 0 auto 3rem;
  border-radius: 8px; overflow: hidden;
  aspect-ratio: 21/9;
  display: flex; align-items: flex-end;
}
.where-banner-video {
  position: absolute; inset: 0;
  width: 100%; height: 100%; object-fit: cover;
}
.where-banner-ov {
  position: absolute; inset: 0;
  background: linear-gradient(to top, rgba(6,9,6,0.75) 0%, rgba(6,9,6,0.15) 55%, rgba(6,9,6,0.35) 100%);
}
.where-hdr { position: relative; z-index: 2; padding: 2.5rem; }
.where-h2 {
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 900; letter-spacing: -0.03em; line-height: 1.05;
  color: #0A0C09;
}
.where-h2.light { color: #fff; }
.where-grid {
  max-width: 1200px; margin: 0 auto;
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.25rem;
}
.where-card { display: flex; flex-direction: column; gap: 0.75rem; }
.where-card { transition-delay: var(--delay, 0s); }
.where-img-wrap { position: relative; border-radius: 6px; overflow: hidden; aspect-ratio: 3/4; }
.where-img { width: 100%; height: 100%; object-fit: cover; filter: grayscale(30%); transition: transform .5s; }
.where-card:hover .where-img { transform: scale(1.04); }
.where-tag {
  position: absolute; bottom: 0.75rem; left: 0.75rem;
  font-size: 0.6rem; font-weight: 800; letter-spacing: 0.12em;
  background: #2daa8a; color: #fff; padding: 0.25rem 0.5rem; border-radius: 3px;
}
.where-title { font-size: 0.9375rem; font-weight: 700; color: #0A0C09; }

@media (max-width: 900px) {
  .where-grid { grid-template-columns: repeat(2, 1fr); }
  .where-banner { aspect-ratio: 4/3; }
}
@media (max-width: 480px) {
  .where-grid { grid-template-columns: 1fr; }
}

/* ══ TEAM ════════════════════════════════════════════════════════ */
.s-team {
  background: #F2F0EA;
  padding: 5rem 2.5rem;
  border-top: 1px solid rgba(10,12,9,0.08);
  border-bottom: 1px solid rgba(10,12,9,0.08);
}
.team-inner { max-width: 860px; margin: 0 auto; }
.team-card {
  display: flex; gap: 2.5rem; align-items: center;
  padding-top: 1.5rem;
}
.team-photo {
  width: 120px; height: 120px; border-radius: 6px;
  object-fit: cover; flex-shrink: 0;
  filter: grayscale(20%);
}
.team-name { font-size: 1.25rem; font-weight: 900; letter-spacing: -0.01em; color: #0A0C09; }
.team-crm  { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.12em; color: #2daa8a; text-transform: uppercase; margin: 0.25rem 0 0.75rem; }
.team-text { font-size: 0.9rem; line-height: 1.65; color: #767670; }

@media (max-width: 560px) {
  .team-card { flex-direction: column; }
}

/* ══ CTA (dark) ═══════════════════════════════════════════════════ */
.s-cta {
  background: #0C0F0D;
  padding: 8rem 2.5rem;
  position: relative;
  overflow: hidden;
}
.cta-inner {
  max-width: 800px; margin: 0 auto; position: relative; z-index: 2;
}
.cta-h2 {
  font-size: clamp(2.5rem, 6vw, 5rem);
  font-weight: 900; letter-spacing: -0.04em; line-height: 1;
  color: #fff; margin-bottom: 1.25rem;
}
.cta-sub {
  font-size: 1rem; color: rgba(255,255,255,0.45);
  margin-bottom: 2.5rem;
}
.cta-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.cta-hours {
  margin-top: 2rem; font-size: 0.75rem; letter-spacing: 0.06em;
  text-transform: uppercase; color: rgba(255,255,255,0.25);
}
.cta-bg-text {
  position: absolute; bottom: -0.5rem; right: -1rem;
  font-size: clamp(6rem, 18vw, 16rem);
  font-weight: 900; letter-spacing: -0.05em; line-height: 0.88;
  color: rgba(255,255,255,0.025);
  pointer-events: none; user-select: none;
  text-transform: uppercase;
}

/* ══ FOOTER ════════════════════════════════════════════════════════ */
.s-footer {
  background: #080B08;
  padding: 3rem 2.5rem 2rem;
}
.footer-top {
  display: flex; align-items: flex-start; justify-content: space-between;
  flex-wrap: wrap; gap: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 1.5rem;
}
.footer-logo { height: 48px; width: auto; filter: brightness(0) invert(1); opacity: 0.6; }
.footer-nav { display: flex; flex-wrap: wrap; gap: 1.5rem; align-items: center; }
.footer-nav a {
  font-size: 0.8125rem; font-weight: 500;
  color: rgba(255,255,255,0.4); text-decoration: none;
  transition: color .2s;
}
.footer-nav a:hover { color: rgba(255,255,255,0.8); }
.footer-contact {
  display: flex; flex-direction: column; gap: 0.25rem;
  font-size: 0.8rem; color: rgba(255,255,255,0.3);
  text-align: right;
}
.footer-contact a { color: rgba(255,255,255,0.45); text-decoration: none; }
.footer-bottom {
  display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;
  font-size: 0.72rem; color: rgba(255,255,255,0.22);
}
.footer-legal { display: flex; gap: 1.25rem; }
.footer-legal a { color: rgba(255,255,255,0.22); text-decoration: none; }
.footer-legal a:hover { color: rgba(255,255,255,0.5); }

/* ══ FLOATS ════════════════════════════════════════════════════════ */
.wa-float {
  position: fixed; bottom: 1.5rem; left: 1.5rem; z-index: 50;
  width: 48px; height: 48px; border-radius: 50%;
  background: #25d366;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 20px rgba(37,211,102,0.4);
  transition: transform .2s, box-shadow .2s;
}
.wa-float:hover { transform: scale(1.08); box-shadow: 0 4px 32px rgba(37,211,102,0.6); }

.btt {
  position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 50;
  width: 44px; height: 44px; border-radius: 50%;
  background: #0A0C09;
  color: white; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: transform .2s;
}
.btt:hover { transform: translateY(-2px); }

.bt-enter-active, .bt-leave-active { transition: opacity .25s, transform .25s; }
.bt-enter-from, .bt-leave-to { opacity: 0; transform: translateY(10px); }

/* ══ REVEAL ANIMATIONS ══════════════════════════════════════════ */
.reveal {
  opacity: 0; transform: translateY(28px); filter: blur(6px);
  transition: opacity .8s cubic-bezier(.22,1,.36,1), transform .8s cubic-bezier(.22,1,.36,1), filter .8s cubic-bezier(.22,1,.36,1);
  transition-delay: var(--delay, 0s);
}
.reveal.visible { opacity: 1; transform: none; filter: none; }

.reveal-l {
  opacity: 0; transform: translateX(-36px); filter: blur(6px);
  transition: opacity .8s cubic-bezier(.22,1,.36,1), transform .8s cubic-bezier(.22,1,.36,1), filter .8s cubic-bezier(.22,1,.36,1);
}
.reveal-l.visible { opacity: 1; transform: none; filter: none; }

.reveal-r {
  opacity: 0; transform: translateX(36px); filter: blur(6px);
  transition: opacity .8s cubic-bezier(.22,1,.36,1), transform .8s cubic-bezier(.22,1,.36,1), filter .8s cubic-bezier(.22,1,.36,1);
}
.reveal-r.visible { opacity: 1; transform: none; filter: none; }

@media (prefers-reduced-motion: reduce) {
  .reveal, .reveal-l, .reveal-r { opacity: 1; transform: none; filter: none; transition: none; }
  .mq-track { animation: none; }
  .s-statement { min-height: auto; }
  .statement-pin { position: static; height: auto; padding: 7rem 2.5rem; }
  .st-orb { animation: none; }
  .st-doctor { animation: none; }
}

/* ══ MOBILE TUNING ═══════════════════════════════════════════════ */
@media (max-width: 768px) {
  .s-stats, .s-features, .s-demo,
  .s-specs, .s-steps, .s-where, .s-team, .s-cta {
    padding-left: 1.25rem;
    padding-right: 1.25rem;
  }
  .s-features, .s-demo, .s-specs, .s-steps, .s-where, .s-cta {
    padding-top: 4rem;
    padding-bottom: 4rem;
  }
  .s-statement { min-height: 145vh; }
  .statement-pin { padding: 0 1.25rem; }
  .s-team { padding-top: 3rem; padding-bottom: 3rem; }

  .statement-text { font-size: clamp(1.2rem, 5vw, 1.6rem); }

  .demo-window { border-radius: 8px; }
  .dw-bar { padding: 0.6rem 0.75rem; }
  .dw-url { display: none; }

  .where-banner { aspect-ratio: 3/4; border-radius: 6px; margin-bottom: 2rem; }
  .where-hdr { padding: 1.5rem; }
  .where-grid { gap: 0.85rem; }

  .cta-actions { flex-direction: column; align-items: stretch; }
  .cta-actions a { justify-content: center; text-align: center; }
  .cta-bg-text { display: none; }

  .footer-contact { text-align: left; }
  .footer-top { flex-direction: column; align-items: flex-start; }
}

@media (max-width: 420px) {
  .hero-h1 { font-size: clamp(2.4rem, 12vw, 3.5rem); }
  .btn-accent, .btn-ghost-light { width: 100%; justify-content: center; }
  .hero-actions { flex-direction: column; align-items: stretch; }
}

.delay-1 { transition-delay: .08s; }
.delay-2 { transition-delay: .16s; }
.delay-3 { transition-delay: .24s; }
.delay-4 { transition-delay: .32s; }
.delay-5 { transition-delay: .40s; }
</style>
