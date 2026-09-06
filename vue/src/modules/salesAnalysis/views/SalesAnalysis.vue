<template>
  <div class="sales-analysis">
    <header class="analysis-toolbar">
      <div>
        <h1>销售分析</h1>
        <p>配送商品分布、客户结构与每种商品的重要客户</p>
      </div>
      <div class="analysis-filters">
        <nav aria-label="快捷统计范围">
          <button
            v-for="preset in presets"
            :key="preset.days"
            type="button"
            :class="{ active: activePreset === preset.days }"
            @click="applyPreset(preset.days)"
          >{{ preset.label }}</button>
        </nav>
        <label><span>开始</span><input v-model="range.startDate" type="date" @change="useCustomRange" /></label>
        <i>—</i>
        <label><span>结束</span><input v-model="range.endDate" type="date" @change="useCustomRange" /></label>
        <button class="refresh-button" type="button" :disabled="overviewLoading" @click="loadReport">
          {{ overviewLoading ? '加载中' : '刷新' }}
        </button>
      </div>
    </header>

    <div v-if="errorMessage && !overview" class="page-state error">
      <span>!</span><h3>{{ errorMessage }}</h3><button type="button" @click="loadReport">重新加载</button>
    </div>
    <div v-else-if="overviewLoading && !overview" class="page-state">
      <span>析</span><h3>正在统计历史销售数据…</h3><p>数据只来自已完成历史订单。</p>
    </div>

    <main v-else class="analysis-body">
      <div v-if="errorMessage" class="inline-message error">{{ errorMessage }}</div>

      <section class="summary-grid" aria-label="销售概览">
        <article><span>成交销售额</span><strong>{{ formatMoney(summary.salesAmount) }}</strong><small>已完成历史订单</small></article>
        <article><span>使用客户</span><strong>{{ summary.customerCount || 0 }} 家</strong><small>按父客户去重</small></article>
        <article><span>成交商品</span><strong>{{ summary.goodsCount || 0 }} 种</strong><small>覆盖 {{ summary.subcategoryCount || 0 }} 个小类</small></article>
        <article><span>销售数量</span><strong>{{ primaryQuantity }}</strong><small>{{ otherQuantityText }}</small></article>
      </section>

      <section class="overview-grid">
        <article class="analysis-panel category-panel">
          <header><div><h2>配送商品分布</h2><p>面积代表成交销售额，点击大类继续下钻</p></div><span>{{ overview?.categories?.length || 0 }} 个大类</span></header>
          <SalesCategoryTreemap
            :categories="overview?.categories || []"
            :selected-id="selectedCategoryId"
            @select="selectCategory"
          />
        </article>

        <article class="analysis-panel customer-panel">
          <header><div><h2>{{ customerChartTitle }}</h2><p>按成交销售额排序</p></div><span>Top 5</span></header>
          <CustomerContributionBars :customers="currentTopCustomers" />
        </article>
      </section>

      <div v-if="detailError" class="inline-message error">{{ detailError }}</div>
      <section class="drill-grid">
        <article class="analysis-panel subcategory-panel">
          <header><div><h2>{{ selectedCategoryName }} · 小类</h2><p>金额、数量与使用客户</p></div><span>{{ subcategories.length }} 类</span></header>
          <div v-if="detailLoading" class="panel-state">正在加载小类…</div>
          <div v-else-if="!subcategories.length" class="panel-state">当前大类暂无可下钻的小类</div>
          <nav v-else class="subcategory-list">
            <button
              v-for="subcategory in subcategories"
              :key="subcategory.id"
              type="button"
              :class="{ active: same(subcategory.id, selectedSubcategoryId) }"
              @click="selectSubcategory(subcategory)"
            >
              <span><strong>{{ subcategory.name }}</strong><small>{{ formatQuantities(subcategory.quantities) }} · {{ subcategory.customerCount }} 家客户</small></span>
              <b>{{ formatMoney(subcategory.salesAmount) }}</b>
              <em><i :style="{ width: `${Math.max(3, Number(subcategory.share || 0))}%` }"></i></em>
            </button>
          </nav>
        </article>

        <article class="analysis-panel product-panel">
          <header class="product-heading">
            <div><h2>{{ selectedSubcategoryName }} · 商品明细</h2><p>点击商品查看它的重要客户</p></div>
            <label><span>⌕</span><input v-model.trim="keyword" placeholder="搜索商品名称、规格" /></label>
          </header>
          <div v-if="detailLoading" class="panel-state">正在加载商品明细…</div>
          <div v-else class="product-table-wrap">
            <table>
              <thead><tr><th>商品</th><th>销售数量</th><th>成交销售额</th><th>加权平均单价</th><th>使用客户</th><th>重要客户</th><th aria-label="查看详情"></th></tr></thead>
              <tbody>
                <tr
                  v-for="product in visibleProducts"
                  :key="product.goodsId"
                  :class="{ selected: same(product.goodsId, selectedProductId) }"
                  role="button"
                  tabindex="0"
                  @click="selectProduct(product)"
                  @keydown.enter.prevent="selectProduct(product)"
                >
                  <td>
                    <button class="product-identity" type="button" @click.stop="selectProduct(product)">
                      <span class="product-thumb"><img :src="goodsImage(product)" :alt="product.goodsName" /></span>
                      <span class="product-copy"><strong>{{ product.goodsName }}</strong><small>{{ product.goodsStandard || '未标规格' }}</small></span>
                    </button>
                  </td>
                  <td>{{ formatQuantities(product.quantities) }}</td>
                  <td class="money">{{ formatMoney(product.salesAmount) }}</td>
                  <td>{{ formatAveragePrices(product.averagePrices) }}</td>
                  <td>{{ product.customerCount }} 家</td>
                  <td><span class="customer-tags"><i v-for="customer in product.topCustomers" :key="customer.customerId">{{ customer.customerName }}</i></span></td>
                  <td><button class="row-open" type="button" :aria-label="`查看${product.goodsName}的客户分布`" @click.stop="selectProduct(product)">›</button></td>
                </tr>
                <tr v-if="!visibleProducts.length"><td colspan="7" class="empty-cell">没有符合条件的商品</td></tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <footer class="data-note">
        <span>口径：{{ overview?.sourceTable || 'nx_department_order_history' }}</span>
        <span>分类：按当前配送目录归类</span>
        <span v-if="qualityIssueCount">数据质量待核对 {{ qualityIssueCount }} 条</span>
        <span v-else>有效成交行的数据质量检查通过</span>
      </footer>
    </main>

    <ProductCustomerDrawer
      :visible="productDrawerOpen"
      :product="selectedProduct"
      :detail="productDetail"
      :loading="productLoading"
      :error="productError"
      :image-server="imageServer"
      @close="closeProductDrawer"
    />
  </div>
</template>

<script>
import SalesCategoryTreemap from '../components/SalesCategoryTreemap.vue';
import CustomerContributionBars from '../components/CustomerContributionBars.vue';
import ProductCustomerDrawer from '../components/ProductCustomerDrawer.vue';
import salesAnalysisApi from '../api/salesAnalysisApi';
import config from '../../../config';
import {
  formatAveragePrices,
  formatMoney,
  formatQuantities,
  rangeForDays,
  resolveGoodsImage,
} from '../presentation/salesAnalysisPresentation';

const IMAGE_SERVER = new URL('../', config.baseURL).toString();

export default {
  name: 'SalesAnalysis',
  components: { SalesCategoryTreemap, CustomerContributionBars, ProductCustomerDrawer },
  data() {
    return {
      presets: [{ days: 7, label: '近7天' }, { days: 30, label: '近30天' }, { days: 90, label: '近90天' }],
      imageServer: IMAGE_SERVER,
      activePreset: 30,
      range: rangeForDays(30),
      overview: null,
      categoryDetail: null,
      productDetail: null,
      selectedCategoryId: null,
      selectedSubcategoryId: null,
      selectedProductId: null,
      productDrawerOpen: false,
      keyword: '',
      overviewLoading: false,
      detailLoading: false,
      productLoading: false,
      errorMessage: '',
      detailError: '',
      productError: '',
      overviewRequestId: 0,
      detailRequestId: 0,
      productRequestId: 0,
    };
  },
  computed: {
    summary() { return this.overview?.summary || {}; },
    primaryQuantity() {
      return this.summary.primaryQuantity
        ? formatQuantities([this.summary.primaryQuantity]) : '暂无有效数量';
    },
    otherQuantityText() {
      const count = Number(this.summary.otherUnitCount || 0);
      return count ? `另有 ${count} 种交易单位` : '按原交易单位统计';
    },
    selectedCategory() {
      return (this.overview?.categories || []).find((row) => this.same(row.id, this.selectedCategoryId)) || null;
    },
    selectedCategoryName() { return this.categoryDetail?.category?.name || this.selectedCategory?.name || '商品大类'; },
    customerChartTitle() { return `${this.selectedCategoryName} · 客户贡献`; },
    currentTopCustomers() { return this.categoryDetail?.topCustomers || this.overview?.topCustomers || []; },
    subcategories() { return this.categoryDetail?.subcategories || []; },
    selectedSubcategory() {
      return this.subcategories.find((row) => this.same(row.id, this.selectedSubcategoryId)) || null;
    },
    selectedSubcategoryName() { return this.selectedSubcategory?.name || '商品'; },
    visibleProducts() {
      const key = this.keyword.toLowerCase();
      return (this.categoryDetail?.products || []).filter((product) => {
        if (!this.same(product.subcategoryId, this.selectedSubcategoryId)) return false;
        if (!key) return true;
        return [product.goodsName, product.goodsStandard]
          .some((value) => String(value || '').toLowerCase().includes(key));
      });
    },
    selectedProduct() {
      return (this.categoryDetail?.products || []).find((row) => this.same(row.goodsId, this.selectedProductId)) || null;
    },
    qualityIssueCount() {
      const quality = this.overview?.quality || {};
      return Number(quality.invalidAmountLineCount || 0)
        + Number(quality.invalidQuantityLineCount || 0)
        + Number(quality.missingGoodsLineCount || 0)
        + Number(quality.missingCustomerLineCount || 0)
        + Number(quality.missingCategoryLineCount || 0);
    },
  },
  mounted() { this.loadReport(); },
  methods: {
    formatAveragePrices,
    formatMoney,
    formatQuantities,
    goodsImage(product) {
      return resolveGoodsImage(product, this.imageServer, 'goodsImage/logo.jpg');
    },
    same(left, right) { return String(left) === String(right); },
    applyPreset(days) {
      this.activePreset = days;
      this.range = rangeForDays(days);
      this.loadReport();
    },
    useCustomRange() {
      this.activePreset = null;
      if (this.range.startDate && this.range.endDate && this.range.startDate <= this.range.endDate) {
        this.loadReport();
      }
    },
    async loadReport() {
      const requestId = ++this.overviewRequestId;
      this.productDrawerOpen = false;
      this.productRequestId += 1;
      this.productLoading = false;
      this.overviewLoading = true;
      this.errorMessage = '';
      try {
        const overview = await salesAnalysisApi.overview({ ...this.range });
        if (requestId !== this.overviewRequestId) return;
        this.overview = overview;
        const first = overview.categories?.[0];
        if (first) await this.selectCategory(first, true);
        else this.resetDrill();
      } catch (error) {
        if (requestId === this.overviewRequestId) this.errorMessage = error?.message || '销售分析加载失败';
      } finally {
        if (requestId === this.overviewRequestId) this.overviewLoading = false;
      }
    },
    resetDrill() {
      this.categoryDetail = null;
      this.productDetail = null;
      this.selectedCategoryId = null;
      this.selectedSubcategoryId = null;
      this.selectedProductId = null;
      this.productDrawerOpen = false;
      this.productLoading = false;
      this.productRequestId += 1;
    },
    async selectCategory(category, force = false) {
      if (!force && this.same(category.id, this.selectedCategoryId) && this.categoryDetail) return;
      this.selectedCategoryId = category.id;
      this.selectedSubcategoryId = null;
      this.selectedProductId = null;
      this.productDrawerOpen = false;
      this.productRequestId += 1;
      this.categoryDetail = null;
      this.productDetail = null;
      this.keyword = '';
      const requestId = ++this.detailRequestId;
      this.detailLoading = true;
      this.detailError = '';
      try {
        const detail = await salesAnalysisApi.category(category.id, { ...this.range });
        if (requestId !== this.detailRequestId) return;
        this.categoryDetail = detail;
        const firstSubcategory = detail.subcategories?.[0];
        if (firstSubcategory) await this.selectSubcategory(firstSubcategory);
      } catch (error) {
        if (requestId === this.detailRequestId) this.detailError = error?.message || '商品大类加载失败';
      } finally {
        if (requestId === this.detailRequestId) this.detailLoading = false;
      }
    },
    selectSubcategory(subcategory) {
      this.selectedSubcategoryId = subcategory.id;
      this.keyword = '';
      this.productDrawerOpen = false;
      this.selectedProductId = null;
      this.productDetail = null;
      this.productError = '';
      this.productLoading = false;
      this.productRequestId += 1;
    },
    async selectProduct(product) {
      this.selectedProductId = product.goodsId;
      this.productDrawerOpen = true;
      this.productDetail = null;
      const requestId = ++this.productRequestId;
      this.productLoading = true;
      this.productError = '';
      try {
        const detail = await salesAnalysisApi.productCustomers(
          product.goodsId, { ...this.range }, 200,
        );
        if (requestId === this.productRequestId) this.productDetail = detail;
      } catch (error) {
        if (requestId === this.productRequestId) this.productError = error?.message || '重要客户加载失败';
      } finally {
        if (requestId === this.productRequestId) this.productLoading = false;
      }
    },
    closeProductDrawer() {
      this.productDrawerOpen = false;
      this.productRequestId += 1;
      this.productLoading = false;
    },
  },
};
</script>

<style scoped>
*{box-sizing:border-box}.sales-analysis{height:100%;min-width:0;display:flex;flex-direction:column;background:#f3f7f5;color:#202d27;overflow:hidden}.analysis-toolbar{flex:none;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:15px 22px;background:#fff;border-bottom:1px solid #dce7e1}.analysis-toolbar h1{margin:0;font-size:24px}.analysis-toolbar p{margin:4px 0 0;color:#7d8983;font-size:11px}.analysis-filters{display:flex;align-items:flex-end;gap:7px}.analysis-filters nav{display:flex;border:1px solid #d5e1db;border-radius:9px;overflow:hidden}.analysis-filters nav button{height:36px;padding:0 14px;border:0;border-right:1px solid #dce5e0;background:#fff;color:#66746d;font-weight:800}.analysis-filters nav button:last-child{border-right:0}.analysis-filters nav button.active{background:#109c5c;color:#fff}.analysis-filters label{display:flex;flex-direction:column;gap:2px;color:#84918b;font-size:9px}.analysis-filters input{height:36px;padding:0 8px;border:1px solid #d5e1db;border-radius:8px;background:#fff;color:#314139}.analysis-filters>i{padding-bottom:9px;color:#95a09b;font-style:normal}.refresh-button{height:36px;padding:0 14px;border:0;border-radius:8px;background:#109c5c;color:#fff;font-weight:800}.refresh-button:disabled{opacity:.6}.analysis-body{flex:1;min-height:0;overflow:auto;padding:14px 16px 22px}.summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.summary-grid article{min-width:0;padding:13px 15px;border:1px solid #dfe8e3;border-radius:11px;background:#fff}.summary-grid span,.summary-grid small{display:block}.summary-grid span{color:#7d8983;font-size:10px}.summary-grid strong{display:block;margin-top:4px;overflow:hidden;font-size:22px;text-overflow:ellipsis;white-space:nowrap}.summary-grid small{margin-top:4px;color:#07814b;font-size:9px}.overview-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(270px,.72fr);gap:11px;margin-top:11px}.analysis-panel{min-width:0;border:1px solid #dfe8e3;border-radius:12px;background:#fff;overflow:hidden}.analysis-panel>header{min-height:54px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 15px;border-bottom:1px solid #e3ebe7}.analysis-panel h2,.analysis-panel p{margin:0}.analysis-panel h2{font-size:15px}.analysis-panel p{margin-top:3px;color:#84908a;font-size:9px}.analysis-panel>header>span{color:#7a8881;font-size:10px}.drill-grid{display:grid;grid-template-columns:minmax(230px,.55fr) minmax(0,1.75fr);gap:11px;margin-top:11px}.subcategory-list{display:grid}.subcategory-list button{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 10px;padding:12px 14px;border:0;border-bottom:1px solid #e8eeeb;background:#fff;color:#34423b;text-align:left;cursor:pointer}.subcategory-list button:last-child{border-bottom:0}.subcategory-list button.active{background:#eaf7f0;box-shadow:inset 3px 0 0 #119b5c}.subcategory-list span,.subcategory-list strong,.subcategory-list small{display:block;min-width:0}.subcategory-list strong{font-size:12px}.subcategory-list small{margin-top:4px;overflow:hidden;color:#7f8c85;font-size:9px;text-overflow:ellipsis;white-space:nowrap}.subcategory-list b{font-size:12px}.subcategory-list em{grid-column:1/3;height:4px;border-radius:4px;background:#eef2f0;overflow:hidden}.subcategory-list i{display:block;height:100%;border-radius:4px;background:#14a262}.product-heading label{width:230px;height:34px;display:flex;align-items:center;gap:7px;padding:0 10px;border:1px solid #d7e2dc;border-radius:8px;color:#0b8851}.product-heading input{min-width:0;width:100%;border:0;outline:0;background:transparent;font-size:11px}.product-table-wrap{overflow:auto}.product-table-wrap table{width:100%;min-width:850px;border-collapse:collapse}.product-table-wrap th,.product-table-wrap td{padding:12px 11px;border-bottom:1px solid #e9eeeb;text-align:left;vertical-align:middle}.product-table-wrap th{background:#f5f8f6;color:#78857f;font-size:12px;font-weight:700;white-space:nowrap}.product-table-wrap td{font-size:13px}.product-table-wrap tbody tr[tabindex]{cursor:pointer;outline:none}.product-table-wrap tbody tr[tabindex]:hover,.product-table-wrap tr.selected{background:#f0f9f4}.product-table-wrap tbody tr[tabindex]:focus-visible{box-shadow:inset 0 0 0 2px #159d60}.product-table-wrap td:first-child{min-width:130px}.product-table-wrap td:nth-child(2),.product-table-wrap td:nth-child(4){max-width:155px}.product-table-wrap td>button{width:100%;padding:0;border:0;background:transparent;color:#293831;text-align:left;cursor:pointer}.product-table-wrap td>button strong,.product-table-wrap td>button small{display:block}.product-table-wrap td>button strong{font-size:15px}.product-table-wrap td>button small{margin-top:4px;color:#76847d;font-size:12px}.product-table-wrap .money{color:#07814b;font-weight:800;white-space:nowrap}.customer-tags{display:flex;flex-wrap:wrap;gap:4px}.customer-tags i{padding:4px 7px;border-radius:10px;background:#eef3f0;color:#5f6e67;font-size:11px;font-style:normal;white-space:nowrap}.product-table-wrap td:last-child{width:42px;padding-left:3px;padding-right:9px}.product-table-wrap .row-open{width:30px;height:30px;display:grid;place-items:center;border:1px solid #d9e4de;border-radius:8px;background:#fff;color:#0b8b52;font-size:22px;text-align:center}.empty-cell{padding:35px!important;color:#87938d;text-align:center!important}.panel-state{min-height:180px;display:grid;place-items:center;color:#84918b;font-size:11px}.data-note{display:flex;flex-wrap:wrap;gap:7px 18px;margin-top:10px;padding:0 3px;color:#829089;font-size:9px}.inline-message{margin-bottom:9px;padding:9px 12px;border-radius:8px;background:#edf6fb;color:#376277;font-size:11px}.inline-message.error{background:#fff0f1;color:#ac3c45}.page-state{flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#7f8c85}.page-state>span{width:54px;height:54px;display:grid;place-items:center;border-radius:16px;background:#e6f5ed;color:#0a8951;font-size:19px;font-weight:900}.page-state h3{margin:13px 0 3px;color:#34423b}.page-state p{margin:0}.page-state button{margin-top:11px;padding:8px 13px;border:0;border-radius:8px;background:#109c5c;color:#fff}.page-state.error>span{background:#fde9eb;color:#b93c46}@media(max-width:1250px){.analysis-toolbar{align-items:flex-start}.analysis-filters{flex-wrap:wrap;justify-content:flex-end}.summary-grid{grid-template-columns:repeat(2,1fr)}.overview-grid{grid-template-columns:minmax(0,1.4fr) minmax(250px,.75fr)}}@media(max-width:980px){.analysis-toolbar{flex-direction:column}.analysis-filters{justify-content:flex-start}.overview-grid,.drill-grid{grid-template-columns:1fr}}@media(max-width:640px){.analysis-toolbar{padding:13px}.analysis-filters label,.analysis-filters>i{display:none}.analysis-body{padding:10px}.summary-grid{grid-template-columns:1fr}.product-heading{align-items:flex-start!important;flex-direction:column}.product-heading label{width:100%}}
.product-table-wrap .product-identity{display:flex;align-items:center;gap:10px;min-width:172px}.product-thumb{width:46px;height:46px;flex:none;display:block;overflow:hidden;border:1px solid #e0e9e4;border-radius:10px;background:#f3f7f5}.product-thumb img{width:100%;height:100%;display:block;object-fit:cover}.product-copy{min-width:0;display:block}.product-copy strong,.product-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
</style>
