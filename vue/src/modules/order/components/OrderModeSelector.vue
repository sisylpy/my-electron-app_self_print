<template>
  <div
    class="order-mode-selector"
    :class="`order-mode-selector--${variant}`"
    role="radiogroup"
    aria-label="录单方式"
  >
    <label
      v-for="option in options"
      :key="option.value"
      :class="{ 'is-active': modelValue === option.value }"
    >
      <input
        type="radio"
        name="uploadType"
        :value="option.value"
        :checked="modelValue === option.value"
        @change="$emit('change', option.value)"
      >
      <span v-if="variant === 'cards' || variant === 'toolbar'" class="order-mode-selector__icon" aria-hidden="true">
        {{ option.icon }}
      </span>
      <span class="order-mode-selector__copy">
        <strong>{{ option.label }}</strong>
        <small v-if="variant === 'cards'">{{ option.description }}</small>
      </span>
      <em v-if="variant === 'cards' && option.recommended">推荐</em>
    </label>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
  variant: {
    type: String,
    default: 'inline',
    validator: (value) => ['inline', 'cards', 'toolbar'].includes(value),
  },
});

defineEmits(['change']);

const cardOptions = Object.freeze([
  { value: 'paste', label: '复制粘贴', description: '粘贴微信或文字订单', icon: '文', recommended: true },
  { value: 'image', label: '图片识别', description: '拖入或粘贴订单图片', icon: '图' },
  { value: 'excel-paste', label: 'Excel 粘贴', description: '直接粘贴表格内容', icon: '表' },
  { value: 'manual', label: '手工录入', description: '逐项搜索并填写商品', icon: '录' },
]);

const inlineOptions = Object.freeze([
  { value: 'paste', label: '复制粘贴' },
  { value: 'image', label: '图片识别' },
  { value: 'excel-paste', label: 'Excel 粘贴' },
  { value: 'manual', label: '手工录入' },
]);

const options = computed(() => (['cards', 'toolbar'].includes(props.variant) ? cardOptions : inlineOptions));
</script>

<style scoped>
.order-mode-selector {
  display: flex;
  min-height: 36px;
  align-items: center;
  gap: 22px;
  flex-wrap: wrap;
}

.order-mode-selector label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  color: var(--product-text-secondary, #5f6f67);
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}

.order-mode-selector__copy strong {
  font: inherit;
}

.order-mode-selector__copy small,
.order-mode-selector label > em,
.order-mode-selector__icon {
  display: none;
}

.order-mode-selector input {
  margin: 0;
  accent-color: var(--product-primary, #119b5d);
}

.order-mode-selector--cards {
  display: grid;
  min-height: 66px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
  align-items: stretch;
}

.order-mode-selector--cards label {
  position: relative;
  display: grid;
  min-width: 0;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 9px;
  align-items: center;
  padding: 10px 11px;
  border: 1px solid var(--product-border);
  border-radius: var(--product-radius-md);
  color: var(--product-text-secondary);
  background: #fff;
}

.order-mode-selector--cards label:hover {
  border-color: #bdd6c8;
  background: #fbfdfc;
}

.order-mode-selector--cards label.is-active {
  border-color: var(--product-primary);
  color: var(--product-primary-strong);
  background: var(--product-primary-soft);
  box-shadow: inset 0 0 0 1px rgba(17, 155, 93, .08);
}

.order-mode-selector--cards input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.order-mode-selector--cards .order-mode-selector__icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 4px;
  color: var(--product-primary-strong);
  background: #eef5f1;
  font-size: 12px;
  font-weight: 900;
}

.order-mode-selector--cards label.is-active .order-mode-selector__icon {
  color: #fff;
  background: var(--product-primary);
}

.order-mode-selector--cards .order-mode-selector__copy,
.order-mode-selector--cards .order-mode-selector__copy strong,
.order-mode-selector--cards .order-mode-selector__copy small {
  display: block;
  min-width: 0;
}

.order-mode-selector--cards .order-mode-selector__copy strong {
  color: inherit;
  font-size: 12px;
  font-weight: 850;
}

.order-mode-selector--cards .order-mode-selector__copy small {
  overflow: hidden;
  margin-top: 2px;
  color: var(--product-text-muted);
  font-size: 9px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-mode-selector--cards label > em {
  position: absolute;
  top: 5px;
  right: 6px;
  display: block;
  color: var(--product-primary);
  font-size: 8px;
  font-style: normal;
  font-weight: 850;
}

.order-mode-selector--toolbar {
  display: grid;
  min-height: 38px;
  grid-template-columns: repeat(4, minmax(82px, 1fr));
  gap: 4px;
  flex-wrap: nowrap;
}

.order-mode-selector--toolbar label {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 38px;
  grid-template-columns: 25px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: 1px solid #ccd9d2;
  border-radius: 6px;
  color: #42584d;
  background: #fff;
  font-size: 10px;
  font-weight: 850;
  white-space: nowrap;
}

.order-mode-selector--toolbar label:hover {
  border-color: #8fc5aa;
  background: #f4faf7;
}

.order-mode-selector--toolbar label.is-active {
  border-color: var(--product-primary);
  color: #fff;
  background: var(--product-primary);
  box-shadow: 0 4px 10px rgba(17, 155, 93, .18);
}

.order-mode-selector--toolbar input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.order-mode-selector--toolbar .order-mode-selector__icon {
  display: grid;
  width: 25px;
  height: 25px;
  place-items: center;
  border-radius: 4px;
  color: var(--product-primary-strong);
  background: #eaf5ef;
  font-size: 10px;
  font-weight: 900;
}

.order-mode-selector--toolbar label.is-active .order-mode-selector__icon {
  color: var(--product-primary-strong);
  background: #fff;
}

.order-mode-selector--toolbar .order-mode-selector__copy,
.order-mode-selector--toolbar .order-mode-selector__copy strong {
  display: block;
  min-width: 0;
}

.order-mode-selector--toolbar .order-mode-selector__copy strong {
  overflow: hidden;
  color: inherit;
  font-size: 11px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
