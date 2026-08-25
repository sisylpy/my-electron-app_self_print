function isoDate(value) {
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function deviceDateText(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** 智能备货“今天”优先使用服务端自然日，绝不回退到订单 businessDate。 */
export function resolveForecastDate(catalog, deviceDate = new Date()) {
  return isoDate(catalog?.forecastDate)
    || isoDate(catalog?.serverNow)
    || deviceDateText(deviceDate);
}

