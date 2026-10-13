export const DEFAULT_DELIVERY_PRINT_TEMPLATE = 'ApplyPanel';

// Printing from the order list and printing from the print center must resolve
// the exact same customer template components. Keep the loaders in one public
// registry so the two entry points cannot silently drift apart.
export const DELIVERY_PRINT_TEMPLATE_LOADERS = Object.freeze({
  ApplyPanel: () => import('../../../components/Applys/ApplyPanel.vue'),
  ApplyFiftyPanel: () => import('../../../components/Applys/ApplyFiftyPanel.vue'),
  ApplyHalfPanel: () => import('../../../components/Applys/ApplyHalfPanel.vue'),
  ApplyHalfWholePanel: () => import('../../../components/Applys/ApplyHalfWholePanel.vue'),
  ApplyThirtyPanel: () => import('../../../components/Applys/ApplyThirtyPanel.vue'),
  ApplyThirtyWholePanel: () => import('../../../components/Applys/ApplyThirtyWholePanel.vue'),
});

export const DELIVERY_PRINT_TEMPLATE_NAMES = Object.freeze(
  Object.keys(DELIVERY_PRINT_TEMPLATE_LOADERS)
);

export function resolveDeliveryPrintTemplateName(value) {
  const name = String(value || '').trim();
  return Object.prototype.hasOwnProperty.call(DELIVERY_PRINT_TEMPLATE_LOADERS, name)
    ? name
    : DEFAULT_DELIVERY_PRINT_TEMPLATE;
}

export async function loadDeliveryPrintTemplate(value) {
  const name = resolveDeliveryPrintTemplateName(value);
  const module = await DELIVERY_PRINT_TEMPLATE_LOADERS[name]();
  return module?.default || module;
}
