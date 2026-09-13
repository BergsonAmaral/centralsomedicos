<script setup lang="ts">
definePageMeta({ layout: false })
</script>

<template>
  <div class="tela">
    <div class="conteudo">
      <div class="logo-card">
        <img src="/logo.png" alt="Central SóMedicos" class="logo" />
      </div>
      <h1>Em manutenção</h1>
      <p>Estamos fazendo alguns ajustes na plataforma.</p>
      <p class="destaque">Em breve voltamos.</p>
    </div>
  </div>
</template>

<style scoped>
.tela {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, #0a1628, #112240);
  color: #ffffff;
  font-family: 'DM Sans', 'Inter', sans-serif;
  text-align: center;
  padding: 1.5rem;
}

.conteudo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  max-width: 32rem;
}

.logo-card {
  background: #ffffff;
  border-radius: 1rem;
  padding: 1rem 1.5rem;
  margin-bottom: 0.5rem;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
}

.logo {
  height: 3rem;
  width: auto;
  display: block;
}

h1 {
  font-size: clamp(2rem, 6vw, 3rem);
  font-weight: 900;
  margin: 0;
  color: #ffffff;
}

p {
  font-size: clamp(1rem, 2.5vw, 1.25rem);
  color: rgba(255, 255, 255, 0.75);
  margin: 0;
}

.destaque {
  color: #86efac;
  font-weight: 700;
}
</style>
