<template>
  <header class="product-header" :class="{ 'is-dispatch': route.meta?.module === 'dispatch' }">
    <div class="product-header__page">
      <div>
        <h1>{{ pageTitle }}</h1>
        <p>{{ pageDescription }}</p>
      </div>
    </div>

    <div id="product-header-context" class="product-header__context" aria-label="当前页面操作"></div>

    <div class="product-header__runtime">
      <div class="runtime-chip" :class="{ warning: !networkOnline }">
        <i></i>
        <span>
          <small>服务连接</small>
          <strong>{{ networkOnline ? '网络正常' : '连接中断' }}</strong>
        </span>
      </div>
      <div class="runtime-chip">
        <i class="printer"></i>
        <span>
          <small>默认打印机</small>
          <strong :title="printerName">{{ printerLabel }}</strong>
        </span>
      </div>
      <div class="runtime-chip" :class="{ warning: mcpStatus === '未运行' }">
        <i class="mcp"></i>
        <span>
          <small>MCP</small>
          <strong>{{ mcpStatus }}</strong>
        </span>
      </div>
    </div>

  </header>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const props = defineProps({
  networkOnline: {
    type: Boolean,
    default: true,
  },
  printerName: {
    type: String,
    default: '',
  },
  mcpRunning: {
    type: Boolean,
    default: false,
  },
  runtimeAvailable: {
    type: Boolean,
    default: false,
  },
});

const route = useRoute();
const pageTitle = computed(() => route.meta?.title || '农心乐配送商系统');
const pageDescription = computed(() => route.meta?.description || '桌面业务工作区');
const printerLabel = computed(() => {
  if (!props.runtimeAvailable) return '浏览器预览';
  return props.printerName || '未选择';
});
const mcpStatus = computed(() => {
  if (!props.runtimeAvailable) return '浏览器预览';
  return props.mcpRunning ? '运行中' : '未运行';
});
</script>

<style scoped>
.product-header {
  box-sizing: border-box;
  display: grid;
  height: var(--product-header-height);
  grid-template-columns: minmax(270px, .8fr) minmax(340px, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 11px 22px;
  border-bottom: 1px solid var(--product-border);
  background: #fff;
}

.product-header__context {
  min-width: 0;
}

.product-header__page {
  display: flex;
  min-width: 0;
  align-items: center;
}

.product-header__page div {
  min-width: 0;
}

.product-header__page h1,
.product-header__page p {
  overflow: hidden;
  margin: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-header__page h1 {
  color: var(--product-text);
  font-size: 19px;
  font-weight: 900;
}

.product-header__page p {
  margin-top: 3px;
  color: var(--product-text-muted);
  font-size: 10px;
}

.product-header__runtime {
  display: flex;
  align-items: center;
  gap: 0;
}

.product-header.is-dispatch {
  grid-template-columns: 270px minmax(0, 1fr);
  gap: 16px;
  padding: 9px 22px;
}

.product-header.is-dispatch .product-header__page h1 {
  font-size: 22px;
}

.product-header.is-dispatch .product-header__page p {
  margin-top: 4px;
  font-size: 11px;
}

.product-header.is-dispatch .product-header__runtime {
  display: none;
}

.runtime-chip {
  display: flex;
  min-width: 112px;
  max-width: 158px;
  align-items: center;
  gap: 7px;
  padding: 4px 13px;
  border: 0;
  border-left: 1px solid #edf1ef;
  border-radius: 0;
  background: transparent;
}

.runtime-chip > i {
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: 50%;
  background: #20a875;
  box-shadow: none;
}

.runtime-chip > i.printer {
  background: #4f7563;
  box-shadow: none;
}

.runtime-chip > i.mcp {
  background: #7b8b83;
  box-shadow: none;
}

.runtime-chip.warning > i {
  background: #d99426;
  box-shadow: none;
}

.runtime-chip span,
.runtime-chip small,
.runtime-chip strong {
  display: block;
  min-width: 0;
}

.runtime-chip small {
  color: var(--product-text-muted);
  font-size: 9px;
}

.runtime-chip strong {
  overflow: hidden;
  margin-top: 1px;
  color: var(--product-text-secondary);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1480px) {
  .product-header {
    grid-template-columns: minmax(250px, .8fr) minmax(320px, 1fr);
  }

  .product-header__runtime {
    display: none;
  }

  .product-header.is-dispatch {
    grid-template-columns: 235px minmax(0, 1fr);
    padding-right: 16px;
    padding-left: 18px;
  }
}
</style>
