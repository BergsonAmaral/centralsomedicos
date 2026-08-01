<template>
  <NuxtLayout>
    <NuxtPage :transition="{ name: 'page', mode: 'out-in' }" />
  </NuxtLayout>
</template>

<style>
.page-enter-active {
  animation: page-enter 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.page-leave-active {
  animation: page-leave 150ms ease both;
}
@keyframes page-enter {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes page-leave {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(-6px); }
}
</style>
