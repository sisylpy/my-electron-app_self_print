<template>
  <div class="price-layer" @click.self="$emit('close')">
    <aside class="price-drawer">
      <header class="drawer-head">
        <div class="product-avatar">
          <img v-if="goods.imageUrl" :src="goods.imageUrl" alt="" />
          <span v-else>{{ goods.initials || '商' }}</span>
        </div>
        <div class="product-copy">
          <span>历史单价</span>
          <h3>{{ goods.goodsName }}</h3>
          <p>{{ customerName }}<template v-if="goods.spec"> · {{ goods.spec }}</template> · 有效记录 {{ records.length }} 条</p>
        </div>
        <button type="button" class="close-button" aria-label="关闭" @click="$emit('close')">×</button>
      </header>

      <div v-if="loading" class="drawer-state">正在读取真实订单单价…</div>
      <div v-else-if="errorText" class="drawer-state error">
        {{ errorText }}
        <button type="button" @click="loadHistory">重新加载</button>
      </div>

      <div v-else class="drawer-body">
        <section class="price-summary">
          <article class="current"><span>当前单价</span><strong>¥{{ summary.currentPrice }}<small v-if="summary.priceUnit">/{{ summary.priceUnit }}</small></strong><em>{{ summary.currentDate }}</em></article>
          <article><span>近30天均价</span><strong>¥{{ summary.averagePrice }}<small v-if="summary.priceUnit">/{{ summary.priceUnit }}</small></strong><em>{{ summary.averagePrice === '—' ? '近30天无记录' : '真实订单均价' }}</em></article>
          <article class="high"><span>最高价</span><strong>¥{{ summary.highestPrice }}<small v-if="summary.priceUnit">/{{ summary.priceUnit }}</small></strong><em>{{ summary.highestDate }}</em></article>
          <article class="low"><span>最低价</span><strong>¥{{ summary.lowestPrice }}<small v-if="summary.priceUnit">/{{ summary.priceUnit }}</small></strong><em>{{ summary.lowestDate }}</em></article>
        </section>

        <section class="trend-card">
          <header>
            <div><h4>价格趋势</h4><span>只统计真实订单中的有效单价</span></div>
            <nav aria-label="价格时间范围">
              <button v-for="days in rangeOptions" :key="days" type="button" :class="{ active: selectedDays === days }" @click="selectedDays = days">{{ days }}天</button>
            </nav>
          </header>

          <div v-if="chart.points.length > 1" class="price-chart">
            <svg viewBox="0 0 760 238" role="img" aria-label="历史单价趋势图" preserveAspectRatio="none">
              <g v-for="tick in chart.yTicks" :key="tick.y">
                <line x1="54" :y1="tick.y" x2="735" :y2="tick.y" class="grid-line" />
                <text x="45" :y="tick.y + 4" text-anchor="end" class="axis-text">{{ tick.label }}</text>
              </g>
              <line v-if="chart.averageY !== null" x1="54" :y1="chart.averageY" x2="735" :y2="chart.averageY" class="average-line" />
              <polyline :points="chart.polyline" class="trend-line" />
              <circle v-for="point in chart.points" :key="point.date" :cx="point.x" :cy="point.y" r="4" class="trend-point" />
              <g v-for="label in chart.xLabels" :key="label.date">
                <text :x="label.x" y="228" text-anchor="middle" class="axis-text">{{ label.label }}</text>
              </g>
            </svg>
            <span v-if="chart.averageY !== null" class="average-badge" :style="{ top: `${chart.averagePercent}%` }">均价 ¥{{ chart.averageText }}</span>
          </div>
          <div v-else class="chart-empty">所选时间内价格记录不足</div>

          <div :class="['trend-note', `tone-${trend.tone}`]">
            <b>{{ trend.tone === 'up' ? '↗' : trend.tone === 'down' ? '↘' : '→' }}</b>
            <span>{{ trend.text }}</span>
          </div>
        </section>

        <section class="history-card">
          <header><h4>历史价格明细</h4><span>近{{ selectedDays }}天 · {{ filteredRecords.length }}条</span></header>
          <div v-if="filteredRecords.length" class="history-table">
            <div class="table-head"><span>订货日期</span><span>订货数量</span><span>单价</span><span>备注</span></div>
            <div v-for="record in filteredRecords" :key="record.id" class="table-row">
              <strong>{{ record.orderDateText }}</strong>
              <span>{{ record.demandText }}</span>
              <b>¥{{ record.priceText }}<small v-if="record.priceUnit">/{{ record.priceUnit }}</small></b>
              <em>{{ record.remark || '—' }}</em>
            </div>
          </div>
          <div v-else class="history-empty">所选时间内没有真实单价记录</div>
        </section>
      </div>
    </aside>
  </div>
</template>

<script>
import customerApi from '../api/customerApi';

function emptySummary() {
  return {
    currentPrice: '—', currentDate: '—', averagePrice: '—', highestPrice: '—',
    highestDate: '—', lowestPrice: '—', lowestDate: '—', priceUnit: '',
  };
}

export default {
  name: 'CustomerGoodsPriceDrawer',
  props: {
    goods: { type: Object, required: true },
    customerId: { type: [Number, String], required: true },
    customerName: { type: String, default: '' },
  },
  emits: ['close'],
  data() {
    return {
      loading: false,
      errorText: '',
      records: [],
      selectedDays: 30,
      rangeOptions: [7, 30, 90],
    };
  },
  computed: {
    filteredRecords() { return this.recordsWithinDays(this.records, this.selectedDays); },
    dailyPoints() {
      const grouped = {};
      this.filteredRecords.forEach((item) => {
        if (!grouped[item.orderDate]) grouped[item.orderDate] = [];
        grouped[item.orderDate].push(item.price);
      });
      return Object.keys(grouped).sort().map((date) => {
        const values = grouped[date];
        return { date, label: date.slice(5), price: values.reduce((sum, value) => sum + value, 0) / values.length };
      });
    },
    summary() { return this.buildSummary(this.records); },
    trend() { return this.buildTrend(this.dailyPoints, this.selectedDays); },
    chart() { return this.buildChart(this.dailyPoints); },
  },
  mounted() {
    window.addEventListener('keydown', this.handleKeydown);
    this.loadHistory();
  },
  beforeUnmount() { window.removeEventListener('keydown', this.handleKeydown); },
  methods: {
    handleKeydown(event) { if (event.key === 'Escape') this.$emit('close'); },
    async loadHistory() {
      if (!this.customerId || !this.goods.goodsId) {
        this.errorText = '当前商品缺少历史单价查询信息';
        return;
      }
      this.loading = true;
      this.errorText = '';
      try {
        const response = await customerApi.getCustomerGoodsHistoryPrice(this.customerId, this.goods.goodsId);
        if (response?.data?.code !== 0) throw new Error(response?.data?.msg || '历史单价读取失败');
        const normalized = this.normalizeRecords(response.data.data || []);
        const primaryUnit = normalized[0]?.priceUnit || '';
        this.records = normalized.filter((item) => item.priceUnit === primaryUnit);
      } catch (error) {
        this.records = [];
        this.errorText = error?.message || '历史单价读取失败';
      } finally {
        this.loading = false;
      }
    },
    normalizeRecords(source) {
      return source.map((row, index) => {
        const price = this.positiveNumber(row.nxDoPrice);
        const date = this.parseDate(row.orderDate);
        if (price === null || !date) return null;
        const priceUnit = this.text(row.printStandard) || this.text(row.nxDoStandard);
        return {
          id: `${row.orderDate || ''}-${row.departName || ''}-${index}`,
          orderDate: this.dateKey(date),
          orderDateText: this.formatDate(date),
          timestamp: date.getTime(),
          price,
          priceText: this.money(price),
          priceUnit,
          demandText: this.quantityText(row.nxDoQuantity, row.nxDoStandard),
          remark: this.text(row.nxDoRemark),
        };
      }).filter(Boolean).sort((a, b) => b.timestamp - a.timestamp);
    },
    buildSummary(records) {
      if (!records.length) return emptySummary();
      const latest = records[0];
      const recent = this.recordsWithinDays(records, 30);
      if (!recent.length) return { ...emptySummary(), currentPrice: this.money(latest.price), currentDate: latest.orderDateText, priceUnit: latest.priceUnit };
      const highest = recent.reduce((result, item) => (item.price > result.price ? item : result), recent[0]);
      const lowest = recent.reduce((result, item) => (item.price < result.price ? item : result), recent[0]);
      return {
        currentPrice: this.money(latest.price), currentDate: latest.orderDateText,
        averagePrice: this.money(recent.reduce((sum, item) => sum + item.price, 0) / recent.length),
        highestPrice: this.money(highest.price), highestDate: highest.orderDateText,
        lowestPrice: this.money(lowest.price), lowestDate: lowest.orderDateText, priceUnit: latest.priceUnit,
      };
    },
    buildTrend(points, days) {
      if (points.length < 2) return { text: `近${days}天价格记录较少，暂时无法判断趋势`, tone: 'stable' };
      const first = points[0].price;
      const last = points[points.length - 1].price;
      const change = first ? ((last - first) / first) * 100 : 0;
      if (Math.abs(change) < 2) return { text: `近${days}天整体稳定，当前价格与期初接近`, tone: 'stable' };
      return change > 0
        ? { text: `近${days}天价格有所上涨，较期初约高${Math.abs(change).toFixed(1)}%`, tone: 'up' }
        : { text: `近${days}天价格有所下降，较期初约低${Math.abs(change).toFixed(1)}%`, tone: 'down' };
    },
    buildChart(points) {
      if (!points.length) return { points: [], yTicks: [], xLabels: [], polyline: '', averageY: null, averageText: '—', averagePercent: 50 };
      const prices = points.map((point) => point.price);
      let min = Math.min(...prices);
      let max = Math.max(...prices);
      if (min === max) { min *= 0.96; max *= 1.04; if (min === max) max = min + 1; }
      const padding = (max - min) * 0.12;
      min = Math.max(0, min - padding);
      max += padding;
      const left = 54; const right = 735; const top = 18; const bottom = 205;
      const x = (index) => left + (points.length === 1 ? 0 : (index / (points.length - 1)) * (right - left));
      const y = (price) => top + ((max - price) / (max - min)) * (bottom - top);
      const plotted = points.map((point, index) => ({ ...point, x: x(index), y: y(point.price) }));
      const average = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      const labelIndexes = [...new Set([0, Math.floor((points.length - 1) * 0.25), Math.floor((points.length - 1) * 0.5), Math.floor((points.length - 1) * 0.75), points.length - 1])];
      return {
        points: plotted,
        polyline: plotted.map((point) => `${point.x},${point.y}`).join(' '),
        yTicks: [0, 1, 2, 3, 4].map((step) => {
          const value = max - ((max - min) * step) / 4;
          return { y: y(value), label: this.money(value) };
        }),
        xLabels: labelIndexes.map((index) => plotted[index]),
        averageY: y(average),
        averageText: this.money(average),
        averagePercent: Math.max(4, Math.min(88, (y(average) / 238) * 100)),
      };
    },
    recordsWithinDays(records, days) {
      const now = new Date();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - days + 1);
      return records.filter((item) => item.timestamp >= start.getTime() && item.timestamp <= end.getTime());
    },
    parseDate(value) {
      if (!value) return null;
      const parts = String(value).replace(/[./]/g, '-').slice(0, 10).split('-').map(Number);
      if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
      const date = new Date(parts[0], parts[1] - 1, parts[2]);
      return Number.isNaN(date.getTime()) ? null : date;
    },
    dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; },
    formatDate(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; },
    quantityText(quantity, standard) { return this.text(quantity) ? `${this.text(quantity)}${this.text(standard)}` : '—'; },
    positiveNumber(value) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : null; },
    money(value) { const number = Number(value); return Number.isFinite(number) ? number.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1') : '—'; },
    text(value) { return value === null || value === undefined ? '' : String(value).trim(); },
  },
};
</script>

<style scoped>
*{box-sizing:border-box}.price-layer{position:fixed;inset:0;z-index:1130;background:rgba(14,30,23,.26);display:flex;justify-content:flex-end}.price-drawer{width:min(980px,96vw);height:100%;background:#f5f8f6;box-shadow:-18px 0 48px rgba(20,55,42,.2);display:flex;flex-direction:column;animation:price-slide .22s ease}.drawer-head{flex:none;display:flex;align-items:center;gap:14px;padding:18px 22px;background:#fff;border-bottom:1px solid #dfe8e3}.product-avatar{width:54px;height:54px;border-radius:12px;background:#e7f5ed;color:#0b8951;display:grid;place-items:center;overflow:hidden;font-weight:900;font-size:20px}.product-avatar img{width:100%;height:100%;object-fit:cover}.product-copy{min-width:0}.product-copy>span{font-size:10px;letter-spacing:.12em;color:#0d9256;font-weight:900}.product-copy h3{margin:2px 0;font-size:22px}.product-copy p{margin:0;color:#7c8983;font-size:12px}.close-button{margin-left:auto;width:40px;height:40px;border:0;border-radius:10px;background:#eef3f0;color:#53615a;font-size:27px;cursor:pointer}.drawer-state{margin:24px;padding:60px;text-align:center;background:#fff;border:1px dashed #d4dfd9;border-radius:13px;color:#7f8b85}.drawer-state.error{color:#b9424c}.drawer-state button{display:block;margin:12px auto 0;border:0;border-radius:8px;padding:8px 13px;background:#e8f6ee;color:#087c49;font-weight:800}.drawer-body{min-height:0;overflow:auto;padding:18px;display:grid;gap:15px}.price-summary{display:grid;grid-template-columns:repeat(4,1fr);background:#fff;border:1px solid #dfe8e3;border-radius:13px}.price-summary article{display:flex;align-items:center;justify-content:center;flex-direction:column;min-height:104px;border-right:1px solid #e7eeea}.price-summary article:last-child{border-right:0}.price-summary span{font-size:11px;color:#7c8983}.price-summary strong{margin:5px 0 3px;font-size:22px}.price-summary strong small{font-size:11px;color:#65736c}.price-summary em{font-style:normal;font-size:10px;color:#8b9691}.price-summary .current strong,.price-summary .low strong{color:#07804a}.price-summary .high strong{color:#d34848}.trend-card,.history-card{background:#fff;border:1px solid #dfe8e3;border-radius:13px;padding:16px}.trend-card>header,.history-card>header{display:flex;align-items:center;justify-content:space-between}.trend-card h4,.history-card h4{margin:0;font-size:17px}.trend-card header>div>span,.history-card header>span{font-size:10px;color:#89948f}.trend-card nav{display:flex;background:#f2f5f3;border-radius:8px;padding:3px}.trend-card nav button{border:0;background:transparent;border-radius:6px;padding:6px 14px;color:#5f6d66;cursor:pointer}.trend-card nav button.active{background:#109c5c;color:#fff}.price-chart{height:260px;margin-top:11px;position:relative}.price-chart svg{width:100%;height:100%;overflow:visible}.grid-line{stroke:#e7edea;stroke-dasharray:4 5}.average-line{stroke:#52b17f;stroke-dasharray:6 5}.trend-line{fill:none;stroke:#129a59;stroke-width:3;stroke-linejoin:round;stroke-linecap:round}.trend-point{fill:#fff;stroke:#129a59;stroke-width:2}.axis-text{font-size:10px;fill:#7f8b85}.average-badge{position:absolute;right:9px;transform:translateY(-50%);padding:4px 7px;border-radius:5px;background:#119c5b;color:#fff;font-size:10px}.chart-empty{height:190px;display:grid;place-items:center;color:#8b9691}.trend-note{margin-top:9px;border-radius:8px;padding:10px 13px;display:flex;gap:8px;background:#eef8f3;color:#267651;font-size:12px}.trend-note.tone-up{background:#fff4ed;color:#bd632a}.trend-note.tone-down{background:#eef8f3;color:#16804d}.history-card>header{margin-bottom:10px}.history-table{border:1px solid #e4ebe7;border-radius:10px;overflow:hidden}.table-head,.table-row{display:grid;grid-template-columns:145px 150px 150px minmax(180px,1fr);align-items:center}.table-head{background:#f6f8f7;color:#74817b;font-size:10px;font-weight:800}.table-head span,.table-row>*{padding:10px 13px}.table-row{border-top:1px solid #e8eeeb;font-size:12px}.table-row strong{font-size:12px}.table-row>b{color:#07804a}.table-row b small{color:#76827c}.table-row em{font-style:normal;color:#7d8983;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.history-empty{padding:45px;text-align:center;color:#89948f}@keyframes price-slide{from{opacity:.4;transform:translateX(40px)}to{opacity:1;transform:none}}@media(max-width:760px){.price-summary{grid-template-columns:repeat(2,1fr)}.price-summary article:nth-child(2){border-right:0}.price-summary article:nth-child(-n+2){border-bottom:1px solid #e7eeea}.table-head,.table-row{grid-template-columns:110px 1fr 1fr}.table-head span:last-child,.table-row em{display:none}}
</style>
