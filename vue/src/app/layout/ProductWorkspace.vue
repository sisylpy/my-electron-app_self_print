<template>
  <main class="product-workspace">
    <slot />
  </main>
</template>

<style scoped>
.product-workspace {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--product-bg);
}
</style>
