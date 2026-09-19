<template>
  <div class="sales-analysis">
    <header class="analysis-toolbar">
      <section class="summary-grid" aria-label="销售概览">
        <article><span>成交销售额</span><strong>{{ formatMoney(summary.salesAmount) }}</strong><small>已完成历史订单</small></article>
        <article><span>使用客户</span><strong>{{ summary.customerCount || 0 }} 家</strong><small>按父客户去重</small></article>
        <article><span>成交商品</span><strong>{{ summary.goodsCount || 0 }} 种</strong><small>覆盖 {{ summary.subcategoryCount || 0 }} 个小类</small></article>
        <article><span>销售数量</span><strong>{{ primaryQuantity }}</strong><small>{{ otherQuantityText }}</small></article>
      </section>
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
      <div v-if="detailError" class="inline-message error">{{ detailError }}</div>

      <section class="analysis-workspace">
        <aside class="category-tree-panel">
          <nav class="category-tree" aria-label="销售分类树">
            <section v-for="category in filteredCategories" :key="category.id">
              <button
                type="button"
                class="category-row"
                :class="{ active: same(category.id, selectedCategoryId) }"
                @click="selectCategory(category)"
              >
                <span class="tree-caret">{{ same(category.id, selectedCategoryId) ? '⌄' : '›' }}</span>
                <strong>{{ category.name }}</strong>
                <em>{{ percentageLabel(category.share) }}</em>
                <b>{{ formatMoney(category.salesAmount) }}</b>
              </button>
              <div v-if="same(category.id, selectedCategoryId)" class="subcategory-tree">
                <button
                  v-for="subcategory in subcategories"
                  :key="subcategory.id"
                  type="button"
                  :class="{ active: same(subcategory.id, selectedSubcategoryId) }"
                  @click="selectSubcategory(subcategory)"
                >
                  <strong>{{ subcategory.name }}</strong>
                  <b>{{ formatMoney(subcategory.salesAmount) }}</b>
                  <em>{{ percentageLabel(overallShare(subcategory.salesAmount)) }}</em>
                </button>
                <p v-if="detailLoading">正在加载分类…</p>
                <p v-else-if="!subcategories.length">暂无小类</p>
              </div>
            </section>
            <div v-if="!filteredCategories.length" class="tree-empty">没有符合条件的分类</div>
          </nav>
        </aside>

        <section class="product-analysis-panel">
          <header class="selection-heading">
            <div>
              <h2>{{ selectedCategoryName }} / {{ selectedSubcategoryName }}</h2>
              <p>共 {{ selectedSubcategory?.goodsCount || visibleProducts.length }} 个商品 · {{ formatMoney(selectedSubcategory?.salesAmount || 0) }} · 占总销售额 {{ percentageLabel(selectedSubcategoryOverallShare) }}</p>
            </div>
            <label class="product-search"><span>⌕</span><input v-model.trim="keyword" placeholder="搜索商品名称、规格、条码" /></label>
          </header>

          <div class="selection-summary" aria-label="当前分类销售概览">
            <article><strong>{{ formatMoney(selectedSubcategory?.salesAmount || 0) }}</strong><span>销售额</span></article>
            <article><strong>{{ selectedSubcategory?.customerCount || 0 }} 家</strong><span>客户数</span></article>
            <article><strong>{{ selectedSubcategory?.goodsCount || visibleProducts.length }} 种</strong><span>商品数</span></article>
            <article><strong>{{ percentageLabel(selectedSubcategoryOverallShare) }}</strong><span>在总销售中的占比</span></article>
          </div>

          <div v-if="detailLoading" class="panel-state">正在加载商品明细…</div>
          <div v-else class="product-table-wrap">
            <table>
              <thead><tr><th>商品</th><th>销售数量</th><th>成交销售额</th><th>加权平均单价</th><th>使用客户</th><th>重要客户</th><th aria-label="查看详情"></th></tr></thead>
              <tbody>
                <tr
                  v-for="(product, index) in visibleProducts"
                  :key="product.goodsId"
                  :class="{ selected: same(product.goodsId, selectedProductId) }"
                  role="button"
                  tabindex="0"
                  @click="selectProduct(product)"
                  @keydown.enter.prevent="selectProduct(product)"
                >
                  <td>
                    <button class="product-identity" type="button" @click.stop="selectProduct(product)">
                      <span class="product-index">{{ index + 1 }}</span>
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
          <footer class="panel-footer">共 {{ visibleProducts.length }} 条数据</footer>
        </section>

        <aside class="customer-contribution-panel">
          <header class="section-heading customer-heading"><h2>客户贡献</h2></header>
          <section class="customer-concentration">
            <div class="concentration-ring" :style="donutStyle"><span></span></div>
            <div class="concentration-copy"><span>客户集中度</span><strong>{{ percentageLabel(customerConcentration) }}</strong><small>前 3 客户贡献</small></div>
            <ul>
              <li v-for="(customer, index) in currentTopCustomers.slice(0, 4)" :key="customer.customerId || customer.customerName">
                <i :class="`tone-${index + 1}`"></i><span>{{ customer.customerName }}</span><b>{{ percentageLabel(customer.share) }}</b>
              </li>
            </ul>
          </section>
          <div class="customer-tools">
            <label><span>⌕</span><input v-model.trim="customerKeyword" placeholder="搜索客户名称" /></label>
            <span>按成交销售额</span>
          </div>
          <div class="customer-table-wrap">
            <table>
              <thead><tr><th>#</th><th>客户名称</th><th>成交销售额</th><th>占比</th></tr></thead>
              <tbody>
                <tr v-for="(customer, index) in filteredCustomers" :key="customer.customerId || customer.customerName">
                  <td>{{ index + 1 }}</td>
                  <td><strong>{{ customer.customerName }}</strong><small>{{ customer.goodsCount }} 种商品</small></td>
                  <td>{{ formatMoney(customer.salesAmount) }}</td>
                  <td><span class="share-bar"><i :style="{ width: relativeBarWidth(currentTopCustomers, customer.salesAmount) }"></i></span><em>{{ percentageLabel(customer.share) }}</em></td>
                </tr>
                <tr v-if="!filteredCustomers.length"><td colspan="4" class="empty-cell">暂无客户贡献数据</td></tr>
              </tbody>
            </table>
          </div>
          <footer class="panel-footer">共 {{ filteredCustomers.length }} 个客户</footer>
        </aside>
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
import ProductCustomerDrawer from '../components/ProductCustomerDrawer.vue';
import salesAnalysisApi from '../api/salesAnalysisApi';
import config from '../../../config';
import {
  formatAveragePrices,
  formatMoney,
  formatQuantities,
  percentageLabel,
  rangeForDays,
  relativeBarWidth,
  resolveGoodsImage,
} from '../presentation/salesAnalysisPresentation';

const IMAGE_SERVER = new URL('../', config.baseURL).toString();

export default {
  name: 'SalesAnalysis',
  components: { ProductCustomerDrawer },
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
      customerKeyword: '',
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
    currentTopCustomers() { return this.categoryDetail?.topCustomers || this.overview?.topCustomers || []; },
    filteredCategories() {
      return this.overview?.categories || [];
    },
    filteredCustomers() {
      const key = this.customerKeyword.toLowerCase();
      if (!key) return this.currentTopCustomers;
      return this.currentTopCustomers.filter((customer) => String(customer.customerName || '').toLowerCase().includes(key));
    },
    customerConcentration() {
      return Math.min(100, this.currentTopCustomers.slice(0, 3)
        .reduce((total, customer) => total + (Number(customer.share) || 0), 0));
    },
    donutStyle() {
      const share = Math.max(0, Math.min(100, this.customerConcentration));
      return { background: `conic-gradient(#109c5c 0 ${share}%, #dfe8e3 ${share}% 100%)` };
    },
    subcategories() { return this.categoryDetail?.subcategories || []; },
    selectedSubcategory() {
      return this.subcategories.find((row) => this.same(row.id, this.selectedSubcategoryId)) || null;
    },
    selectedSubcategoryName() { return this.selectedSubcategory?.name || '商品'; },
    selectedSubcategoryOverallShare() { return this.overallShare(this.selectedSubcategory?.salesAmount); },
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
    percentageLabel,
    relativeBarWidth,
    goodsImage(product) {
      return resolveGoodsImage(product, this.imageServer, 'goodsImage/logo.jpg');
    },
    same(left, right) { return String(left) === String(right); },
    overallShare(amount) {
      const total = Number(this.summary.salesAmount) || 0;
      return total > 0 ? (Number(amount) || 0) / total * 100 : 0;
    },
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

.analysis-body > .inline-message:first-child {
  margin-top: 14px;
}

/* The overview numbers now share the first row with the date controls. */
.analysis-toolbar {
  gap: 14px;
  padding: 10px 16px;
}

.analysis-toolbar .summary-grid {
  flex: 0 1 660px;
  min-width: 0;
  gap: 0;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.analysis-toolbar .summary-grid article {
  min-width: 0;
  padding: 3px 8px;
  border: 0;
  border-right: 1px solid #dce7e1;
  border-radius: 0;
  background: transparent;
}

.analysis-toolbar .summary-grid article:first-child { padding-left: 0; }
.analysis-toolbar .summary-grid article:last-child { border-right: 0; }
.analysis-toolbar .summary-grid strong { font-size: 20px; }
.analysis-toolbar .analysis-filters { flex-shrink: 0; }

@media (max-width: 1150px) {
  .analysis-toolbar { flex-direction: row; flex-wrap: wrap; align-items: center; }
  .analysis-toolbar .summary-grid { flex-basis: 100%; }
}

@media (max-width: 640px) {
  .analysis-toolbar .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .analysis-toolbar .summary-grid article:nth-child(2) { border-right: 0; }
}

/* The two drill-down headings share the page scroll container and pin together. */
.drill-grid .analysis-panel {
  overflow: visible;
}

.drill-grid .analysis-panel > header {
  position: sticky;
  top: 0;
  z-index: 3;
  border-radius: 0;
  background: #fff;
  box-shadow: 0 4px 10px rgba(26, 61, 42, .06);
}

/* Keep the analysis sections flush, like the order workbench. */
.analysis-body {
  padding: 0;
  background: #fff;
}

.overview-grid,
.drill-grid {
  gap: 0;
  margin-top: 0;
}

.analysis-panel {
  border: 0;
  border-radius: 0;
}

.overview-grid .customer-panel,
.drill-grid .product-panel {
  border-left: 1px solid #e3ebe7;
}

.drill-grid {
  border-top: 1px solid #e3ebe7;
}

.drill-grid .analysis-panel > header {
  box-shadow: none;
}

@media (max-width: 980px) {
  .overview-grid .customer-panel,
  .drill-grid .product-panel {
    border-left: 0;
    border-top: 1px solid #e3ebe7;
  }
}

/* Redesigned three-column sales workspace. */
.analysis-body {
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.analysis-body > .inline-message {
  flex: none;
  margin: 0;
  border-radius: 0;
}

.analysis-workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 290px minmax(560px, 1fr) 370px;
  overflow: hidden;
  border-bottom: 1px solid #dce7e1;
  background: #fff;
}

.category-tree-panel,
.product-analysis-panel,
.customer-contribution-panel {
  min-width: 0;
  min-height: 0;
  background: #fff;
}

.category-tree-panel,
.customer-contribution-panel {
  display: flex;
  flex-direction: column;
}

.category-tree-panel { border-right: 1px solid #dce7e1; }
.customer-contribution-panel { border-left: 1px solid #dce7e1; }

.section-heading,
.selection-heading {
  flex: none;
  min-height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid #dfe8e3;
  background: #fff;
}

.section-heading h2,
.selection-heading h2,
.selection-heading p { margin: 0; }
.section-heading h2,
.selection-heading h2 { color: #202d27; font-size: 16px; }
.selection-heading { min-height: 58px; padding-left: 17px; border-left: 3px solid #10a05d; }
.selection-heading p { margin-top: 4px; color: #7d8983; font-size: 10px; }

.product-search,
.customer-tools label {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #d7e2dc;
  background: #fff;
  color: #0b8851;
}

.product-search input,
.customer-tools input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #314139;
  font-size: 10px;
}

.category-tree { flex: 1; min-height: 0; overflow: auto; }
.category-tree > section { border-bottom: 1px solid #e5ece8; }
.category-row {
  width: 100%;
  min-height: 46px;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) 54px 78px;
  align-items: center;
  gap: 5px;
  padding: 7px 11px;
  border: 0;
  background: #fff;
  color: #25342d;
  text-align: left;
  cursor: pointer;
}
.category-row:hover { background: #f4faf7; }
.category-row.active { background: #f7fbf9; }
.category-row strong { overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.category-row b { font-size: 11px; text-align: right; white-space: nowrap; }
.category-row em { color: #079153; font-size: 10px; font-style: normal; text-align: right; }
.tree-caret { color: #466057; font-size: 17px; }

.subcategory-tree { padding: 0 8px 7px 30px; }
.subcategory-tree button {
  width: 100%;
  min-height: 35px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 72px 40px;
  align-items: center;
  gap: 5px;
  padding: 5px 8px;
  border: 0;
  background: #fff;
  color: #415149;
  text-align: left;
  cursor: pointer;
}
.subcategory-tree button.active { background: #e7f6ee; color: #176741; }
.subcategory-tree button strong { overflow: hidden; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.subcategory-tree button b { font-size: 12px; text-align: right; white-space: nowrap; }
.subcategory-tree button em { color: #6f7f77; font-size: 11px; font-style: normal; text-align: right; }
.subcategory-tree p,
.tree-empty { margin: 0; padding: 12px; color: #8b9791; font-size: 10px; text-align: center; }

.product-analysis-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.selection-summary {
  flex: none;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 14px;
  border: 1px solid #dfe8e3;
}
.selection-summary article { min-width: 0; padding: 13px 9px; border-right: 1px solid #dfe8e3; text-align: center; }
.selection-summary article:last-child { border-right: 0; }
.selection-summary strong,
.selection-summary span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.selection-summary strong { color: #17241e; font-size: 20px; }
.selection-summary span { margin-top: 5px; color: #7c8982; font-size: 10px; }

.product-search { width: 250px; height: 32px; flex: none; padding: 0 9px; border-radius: 8px; }
.product-table-wrap { flex: 1; min-height: 0; overflow: auto; }
.product-table-wrap table { min-width: 760px; }
.product-table-wrap th,
.product-table-wrap td { padding: 9px 10px; }
.product-table-wrap th { position: sticky; top: 0; z-index: 1; font-size: 10px; }
.product-table-wrap td { font-size: 13px; }
.product-table-wrap td > button strong { font-size: 13px; }
.product-table-wrap td > button small { margin-top: 2px; font-size: 10px; }
.product-table-wrap .product-identity { min-width: 170px; gap: 8px; }
.product-index { width: 22px; flex: none; color: #607169; font-size: 12px; font-weight: 800; text-align: center; }
.product-thumb { width: 38px; height: 38px; border-radius: 7px; }
.customer-tags i { padding: 3px 7px; border-radius: 8px; font-size: 11px; }
.product-table-wrap .row-open { width: 27px; height: 27px; border-radius: 6px; font-size: 19px; }

.panel-footer {
  flex: none;
  min-height: 34px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 13px;
  border-top: 1px solid #e2eae6;
  color: #7f8c85;
  font-size: 10px;
}

.customer-heading { min-height: 52px; border-left: 3px solid #10a05d; }
.customer-concentration {
  flex: none;
  display: grid;
  grid-template-columns: 72px 90px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 16px 13px;
  border-bottom: 1px solid #dfe8e3;
}
.concentration-ring { width: 68px; height: 68px; display: grid; place-items: center; border-radius: 50%; }
.concentration-ring span { width: 42px; height: 42px; border-radius: 50%; background: #fff; }
.concentration-copy span,
.concentration-copy strong,
.concentration-copy small { display: block; }
.concentration-copy span { color: #5f6f67; font-size: 10px; }
.concentration-copy strong { margin-top: 3px; color: #099253; font-size: 20px; }
.concentration-copy small { margin-top: 3px; color: #87938d; font-size: 9px; }
.customer-concentration ul { display: grid; gap: 5px; margin: 0; padding: 0; list-style: none; }
.customer-concentration li { min-width: 0; display: grid; grid-template-columns: 8px minmax(0, 1fr) auto; align-items: center; gap: 5px; color: #65736c; font-size: 9px; }
.customer-concentration li i { width: 6px; height: 6px; border-radius: 50%; background: #10a05d; }
.customer-concentration li .tone-2 { background: #2f90e8; }
.customer-concentration li .tone-3 { background: #7189e8; }
.customer-concentration li .tone-4 { background: #b3c0ba; }
.customer-concentration li span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.customer-concentration li b { font-weight: 600; white-space: nowrap; }

.customer-tools { flex: none; display: grid; grid-template-columns:minmax(0, 1fr) 105px; gap: 7px; padding: 9px 11px; border-bottom: 1px solid #dfe8e3; }
.customer-tools label { height: 31px; padding: 0 8px; }
.customer-tools > span { display: flex; align-items: center; justify-content: center; border: 1px solid #d7e2dc; color: #637169; font-size: 9px; }
.customer-table-wrap { flex: 1; min-height: 0; overflow: auto; }
.customer-table-wrap table { width: 100%; border-collapse: collapse; }
.customer-table-wrap th,
.customer-table-wrap td { padding: 8px 7px; border-bottom: 1px solid #e6ece9; text-align: left; vertical-align: middle; }
.customer-table-wrap th { position: sticky; top: 0; z-index: 1; background: #f5f8f6; color: #78857f; font-size: 9px; }
.customer-table-wrap td { font-size: 12px; }
.customer-table-wrap td:first-child { width: 28px; text-align: center; }
.customer-table-wrap td:nth-child(3) { white-space: nowrap; }
.customer-table-wrap td:last-child { width: 120px; }
.customer-table-wrap strong,
.customer-table-wrap small { display: block; }
.customer-table-wrap strong { font-size: 13px; }
.customer-table-wrap small { margin-top: 2px; color: #8a9690; font-size: 10px; }
.customer-table-wrap td:last-child { display: grid; grid-template-columns: minmax(44px, 1fr) 35px; align-items: center; gap: 5px; }
.share-bar { height: 7px; display: block; overflow: hidden; border-radius: 5px; background: #edf2ef; }
.share-bar i { height: 100%; display: block; border-radius: inherit; background: #10a05d; }
.customer-table-wrap em { color: #77847d; font-size: 10px; font-style: normal; text-align: right; }

.analysis-body > .data-note {
  flex: none;
  min-height: 28px;
  align-items: center;
  margin: 0;
  padding: 0 15px;
  background: #fff;
}

@media (max-width: 1500px) {
  .analysis-workspace { grid-template-columns: 260px minmax(520px, 1fr) 330px; }
  .customer-concentration { grid-template-columns: 64px 80px minmax(0, 1fr); gap: 7px; }
  .concentration-ring { width: 60px; height: 60px; }
  .concentration-ring span { width: 37px; height: 37px; }
}

.analysis-filters nav button { font-size: 13px; }

@media (max-width: 1120px) {
  .analysis-body { overflow: auto; }
  .analysis-workspace { min-height: 760px; grid-template-columns: 240px minmax(520px, 1fr); overflow: visible; }
  .customer-contribution-panel { grid-column: 1 / -1; min-height: 420px; border-top: 1px solid #dce7e1; border-left: 0; }
}
</style>
