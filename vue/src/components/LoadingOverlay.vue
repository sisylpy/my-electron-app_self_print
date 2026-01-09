<!-- src/components/LoadingOverlay.vue -->
<template>
    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner"></div>
    </div>
  </template>
  
  <script>
  import { computed } from 'vue';
  import { useStore } from 'vuex';
  
  export default {
    name: 'LoadingOverlay',
    setup() {
      const store = useStore();
      const isLoading = computed(() => store.state.loading);
      return { isLoading };
    },
  };
  </script>
  
  <style scoped>
  .loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5); /* 半透明背景 */
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999; /* 确保在最上层 */
  }
  
  .spinner {
    border: 16px solid #f3f3f3; /* Light grey */
    border-top: 16px solid #3498db; /* Blue */
    border-radius: 50%;
    width: 120px;
    height: 120px;
    animation: spin 2s linear infinite;
  }
  
  /* Spinner 动画 */
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  </style>
  