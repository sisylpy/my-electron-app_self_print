<template>
  <div class="sales-analysis">
    <header class="analysis-toolbar">
      <section class="summary-grid" aria-label="销售概览">
        <article><span>成交销售额</span><strong>{{ formatMoney(summary.salesAmount) }}</strong><small>已完成历史订单</small></article>
        <article><span>使用客户</span><strong>{{ summary.customerCount || 0 }} 家</strong><small>按父客户去重</small></article>
        <article><span>成交商品</span><strong>{{ summary.goodsCount || 0 }} 种</strong><small>覆盖 {{ summary.subcategoryCount || 0 }} 个小类</small></article>
        <article><span>销售数量</span><strong>{{ primaryQuantity }}</strong><small>{{ otherQuantityText }}</small></article>
      </section>
      <nav class="analysis-mode-switch" aria-label="销售分析显示方式">
        <button
          type="button"
          :class="{ active: displayMode === 'product' }"
          @click="setDisplayMode('product')"
        >按商品</button>
        <button
          type="button"
          :class="{ active: displayMode === 'customer' }"
          @click="setDisplayMode('customer')"
        >按客户</button>
      </nav>
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
      <div v-if="displayMode === 'product' && detailError" class="inline-message error">{{ detailError }}</div>

      <section class="analysis-workspace" :class="{ 'customer-mode': displayMode === 'customer' }">
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
              <div
                v-if="same(category.id, selectedCategoryId) && displayMode === 'product'"
                class="subcategory-tree"
              >
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
              <div
                v-else-if="same(category.id, selectedCategoryId)"
                class="category-customer-tree"
              >
                <p v-if="categoryCustomersError" class="error">{{ categoryCustomersError }}</p>
                <p v-else-if="categoryCustomersLoading">正在加载客户…</p>
                <template v-else>
                  <button
                    v-for="customer in categoryCustomers"
                    :key="customer.customerId"
                    type="button"
                    :class="{ active: same(customer.customerId, selectedCustomerId) }"
                    @click="selectCustomer(customer)"
                  >
                    <span>
                      <strong>{{ customer.customerName || '未命名客户' }}</strong>
                      <small>{{ customer.goodsCount || 0 }} 种商品 · {{ customer.orderCount || 0 }} 次订货</small>
                    </span>
                    <b>{{ formatMoney(customer.salesAmount) }}</b>
                  </button>
                  <p v-if="!categoryCustomers.length">该大类暂无成交客户</p>
                  <nav v-if="categoryCustomerTotalPages > 1" aria-label="大类客户分页">
                    <button
                      type="button"
                      :disabled="categoryCustomersLoading || categoryCustomerPage <= 1"
                      @click="loadCategoryCustomers(categoryCustomerPage - 1)"
                    >‹</button>
                    <span>{{ categoryCustomerPage }} / {{ categoryCustomerTotalPages }}</span>
                    <button
                      type="button"
                      :disabled="categoryCustomersLoading || categoryCustomerPage >= categoryCustomerTotalPages"
                      @click="loadCategoryCustomers(categoryCustomerPage + 1)"
                    >›</button>
                  </nav>
                </template>
              </div>
            </section>
            <div v-if="!filteredCategories.length" class="tree-empty">没有符合条件的分类</div>
          </nav>
        </aside>

        <section v-if="displayMode === 'product'" class="product-analysis-panel">
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

        <CustomerProductPanel
          v-else
          :customer="selectedCustomer"
          :detail="customerProductsDetail"
          :selected-product-id="selectedProductId"
          :loading="customerProductsLoading"
          :error="customerProductsError"
          :category-name="selectedCategoryName"
          :image-server="imageServer"
          @select="selectProduct"
          @page="loadCustomerProductsPage"
        />

        <ProductCustomerDrawer
          embedded
          visible
          :product="selectedProduct"
          :detail="productDetail"
          :loading="productLoading"
          :error="productError"
          :image-server="imageServer"
        />
      </section>

      <footer class="data-note">
        <span>口径：{{ overview?.sourceTable || 'nx_department_order_history' }}</span>
        <span>分类：按当前配送目录归类</span>
        <span v-if="qualityIssueCount">数据质量待核对 {{ qualityIssueCount }} 条</span>
        <span v-else>有效成交行的数据质量检查通过</span>
      </footer>
    </main>

  </div>
</template>

<script>
import ProductCustomerDrawer from '../components/ProductCustomerDrawer.vue';
import CustomerProductPanel from '../components/CustomerProductPanel.vue';
import salesAnalysisApi from '../api/salesAnalysisApi';
import config from '../../../config';
import {
  formatAveragePrices,
  formatMoney,
  formatQuantities,
  percentageLabel,
  rangeForDays,
  resolveGoodsImage,
} from '../presentation/salesAnalysisPresentation';

const IMAGE_SERVER = new URL('../', config.baseURL).toString();

export default {
  name: 'SalesAnalysis',
  components: { CustomerProductPanel, ProductCustomerDrawer },
  data() {
    return {
      presets: [{ days: 7, label: '近7天' }, { days: 30, label: '近30天' }, { days: 90, label: '近90天' }],
      imageServer: IMAGE_SERVER,
      activePreset: 30,
      range: rangeForDays(30),
      overview: null,
      categoryDetail: null,
      productDetail: null,
      categoryCustomersDetail: null,
      customerProductsDetail: null,
      displayMode: 'product',
      selectedCategoryId: null,
      selectedSubcategoryId: null,
      selectedProductId: null,
      selectedCustomerId: null,
      keyword: '',
      overviewLoading: false,
      detailLoading: false,
      productLoading: false,
      categoryCustomersLoading: false,
      customerProductsLoading: false,
      errorMessage: '',
      detailError: '',
      productError: '',
      categoryCustomersError: '',
      customerProductsError: '',
      overviewRequestId: 0,
      detailRequestId: 0,
      productRequestId: 0,
      categoryCustomersRequestId: 0,
      customerProductsRequestId: 0,
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
    selectedCategoryName() {
      return this.categoryDetail?.category?.name
        || this.categoryCustomersDetail?.category?.name
        || this.selectedCategory?.name
        || '商品大类';
    },
    filteredCategories() {
      return this.overview?.categories || [];
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
      return [
        ...(this.categoryDetail?.products || []),
        ...(this.customerProductsDetail?.products || []),
      ].find((row) => this.same(row.goodsId, this.selectedProductId)) || null;
    },
    selectedCustomer() {
      return (this.categoryCustomersDetail?.customers || [])
        .find((row) => this.same(row.customerId, this.selectedCustomerId)) || null;
    },
    categoryCustomers() { return this.categoryCustomersDetail?.customers || []; },
    categoryCustomerPage() { return Number(this.categoryCustomersDetail?.page) || 1; },
    categoryCustomerTotalPages() {
      return Math.max(1, Number(this.categoryCustomersDetail?.totalPages) || 1);
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
      this.cancelDetailRequests();
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
      this.categoryCustomersDetail = null;
      this.customerProductsDetail = null;
      this.selectedCategoryId = null;
      this.selectedSubcategoryId = null;
      this.selectedProductId = null;
      this.selectedCustomerId = null;
      this.productLoading = false;
      this.categoryCustomersLoading = false;
      this.customerProductsLoading = false;
      this.cancelDetailRequests();
    },
    async selectCategory(category, force = false) {
      const hasCurrentModeData = this.displayMode === 'product'
        ? Boolean(this.categoryDetail) : Boolean(this.categoryCustomersDetail);
      if (!force && this.same(category.id, this.selectedCategoryId) && hasCurrentModeData) return;
      this.cancelDetailRequests();
      this.selectedCategoryId = category.id;
      this.selectedSubcategoryId = null;
      this.selectedProductId = null;
      this.selectedCustomerId = null;
      this.categoryDetail = null;
      this.productDetail = null;
      this.categoryCustomersDetail = null;
      this.customerProductsDetail = null;
      this.keyword = '';
      this.detailError = '';
      this.categoryCustomersError = '';
      this.customerProductsError = '';
      if (this.displayMode === 'customer') {
        await this.loadCategoryCustomers(1);
        return;
      }
      await this.loadCategoryDetail();
    },
    async loadCategoryDetail() {
      if (this.selectedCategoryId === null || this.selectedCategoryId === undefined) return;
      const requestId = ++this.detailRequestId;
      this.detailLoading = true;
      this.detailError = '';
      try {
        const detail = await salesAnalysisApi.category(this.selectedCategoryId, { ...this.range });
        if (requestId !== this.detailRequestId) return;
        this.categoryDetail = detail;
        const firstSubcategory = detail.subcategories?.[0];
        if (firstSubcategory) this.selectSubcategory(firstSubcategory);
      } catch (error) {
        if (requestId === this.detailRequestId) this.detailError = error?.message || '商品大类加载失败';
      } finally {
        if (requestId === this.detailRequestId) this.detailLoading = false;
      }
    },
    async setDisplayMode(mode) {
      if (!['product', 'customer'].includes(mode) || mode === this.displayMode) return;
      this.displayMode = mode;
      this.productRequestId += 1;
      this.productLoading = false;
      if (mode === 'product') {
        this.categoryCustomersRequestId += 1;
        this.customerProductsRequestId += 1;
        this.categoryCustomersLoading = false;
        this.customerProductsLoading = false;
        if (!this.categoryDetail) {
          await this.loadCategoryDetail();
        } else {
          const firstProduct = (this.categoryDetail.products || [])
            .find((product) => this.same(product.subcategoryId, this.selectedSubcategoryId));
          if (firstProduct) this.selectProduct(firstProduct);
        }
        return;
      }
      this.clearProductSelection();
      if (!this.categoryCustomersDetail) {
        await this.loadCategoryCustomers(1);
      } else {
        const firstProduct = this.customerProductsDetail?.products?.[0];
        if (firstProduct) this.selectProduct(firstProduct);
      }
    },
    async loadCategoryCustomers(page = 1) {
      if (this.selectedCategoryId === null || this.selectedCategoryId === undefined) return;
      const requestId = ++this.categoryCustomersRequestId;
      this.customerProductsRequestId += 1;
      this.categoryCustomersLoading = true;
      this.categoryCustomersError = '';
      this.customerProductsLoading = false;
      this.customerProductsError = '';
      this.selectedCustomerId = null;
      this.customerProductsDetail = null;
      try {
        const detail = await salesAnalysisApi.categoryCustomers(
          this.selectedCategoryId, { ...this.range }, page, 20,
        );
        if (requestId !== this.categoryCustomersRequestId) return;
        this.categoryCustomersDetail = detail;
        const firstCustomer = detail.customers?.[0];
        if (firstCustomer) this.selectCustomer(firstCustomer);
      } catch (error) {
        if (requestId === this.categoryCustomersRequestId) {
          this.categoryCustomersError = error?.message || '大类客户加载失败';
        }
      } finally {
        if (requestId === this.categoryCustomersRequestId) this.categoryCustomersLoading = false;
      }
    },
    async selectCustomer(customer) {
      if (!customer?.customerId) return;
      if (!this.same(customer.customerId, this.selectedCustomerId)) {
        this.customerProductsDetail = null;
        this.clearProductSelection();
      }
      this.selectedCustomerId = customer.customerId;
      await this.loadCustomerProductsPage(1);
    },
    async loadCustomerProductsPage(page = 1) {
      if ((this.selectedCategoryId === null || this.selectedCategoryId === undefined)
          || !this.selectedCustomerId) return;
      const requestId = ++this.customerProductsRequestId;
      this.customerProductsLoading = true;
      this.customerProductsError = '';
      try {
        const detail = await salesAnalysisApi.categoryCustomerProducts(
          this.selectedCategoryId, this.selectedCustomerId, { ...this.range }, page, 20,
        );
        if (requestId === this.customerProductsRequestId) {
          this.customerProductsDetail = detail;
          const firstProduct = detail.products?.[0];
          if (firstProduct) this.selectProduct(firstProduct);
          else this.clearProductSelection();
        }
      } catch (error) {
        if (requestId === this.customerProductsRequestId) {
          this.customerProductsError = error?.message || '客户商品明细加载失败';
        }
      } finally {
        if (requestId === this.customerProductsRequestId) this.customerProductsLoading = false;
      }
    },
    cancelDetailRequests() {
      this.detailRequestId += 1;
      this.productRequestId += 1;
      this.categoryCustomersRequestId += 1;
      this.customerProductsRequestId += 1;
      this.detailLoading = false;
      this.productLoading = false;
      this.categoryCustomersLoading = false;
      this.customerProductsLoading = false;
    },
    selectSubcategory(subcategory) {
      this.selectedSubcategoryId = subcategory.id;
      this.keyword = '';
      this.selectedProductId = null;
      this.productDetail = null;
      this.productError = '';
      this.productLoading = false;
      this.productRequestId += 1;
      const firstProduct = (this.categoryDetail?.products || [])
        .find((product) => this.same(product.subcategoryId, subcategory.id));
      if (firstProduct) this.selectProduct(firstProduct);
    },
    clearProductSelection() {
      this.productRequestId += 1;
      this.selectedProductId = null;
      this.productDetail = null;
      this.productError = '';
      this.productLoading = false;
    },
    async selectProduct(product) {
      this.selectedProductId = product.goodsId;
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
.analysis-mode-switch {
  width: 176px;
  height: 38px;
  flex: none;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 3px;
  border: 1px solid #cfe0d7;
  border-radius: 9px;
  background: #f3f8f5;
}
.analysis-mode-switch button {
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #64736b;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}
.analysis-mode-switch button.active {
  background: #109c5c;
  color: #fff;
  box-shadow: 0 3px 8px rgba(16, 156, 92, .18);
}
.analysis-toolbar .analysis-filters { flex-shrink: 0; }

@media (max-width: 1150px) {
  .analysis-toolbar { flex-direction: row; flex-wrap: wrap; align-items: center; }
  .analysis-toolbar .summary-grid { flex-basis: 100%; }
  .analysis-mode-switch { margin-right: auto; }
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
  grid-template-columns: 290px minmax(560px, 1fr) 440px;
  overflow: hidden;
  border-bottom: 1px solid #dce7e1;
  background: #fff;
}

.category-tree-panel,
.product-analysis-panel {
  min-width: 0;
  min-height: 0;
  background: #fff;
}

.category-tree-panel {
  display: flex;
  flex-direction: column;
}

.category-tree-panel { border-right: 1px solid #dce7e1; }

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

.product-search {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #d7e2dc;
  background: #fff;
  color: #0b8851;
}

.product-search input {
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
.category-customer-tree p,
.tree-empty { margin: 0; padding: 12px; color: #8b9791; font-size: 10px; text-align: center; }
.category-customer-tree { padding: 0 8px 8px 30px; }
.category-customer-tree > button {
  width: 100%;
  min-height: 48px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  padding: 6px 8px;
  border: 0;
  border-radius: 7px;
  background: #fff;
  color: #415149;
  text-align: left;
  cursor: pointer;
}
.category-customer-tree > button:hover { background: #f2f9f5; }
.category-customer-tree > button.active { background: #e7f6ee; color: #176741; }
.category-customer-tree > button span,
.category-customer-tree > button strong,
.category-customer-tree > button small { min-width: 0; display: block; }
.category-customer-tree > button strong { overflow: hidden; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.category-customer-tree > button small { margin-top: 3px; overflow: hidden; color: #7f8d86; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.category-customer-tree > button b { color: #137246; font-size: 10px; white-space: nowrap; }
.category-customer-tree p.error { color: #ac3c45; }
.category-customer-tree nav { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 7px 0 1px; color: #68776f; font-size: 9px; }
.category-customer-tree nav button { width: 27px; height: 25px; border: 1px solid #cfe0d7; border-radius: 6px; background: #fff; color: #167144; cursor: pointer; }
.category-customer-tree nav button:disabled { opacity: .4; cursor: default; }

.product-analysis-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.analysis-workspace.customer-mode { grid-template-columns: 290px minmax(620px, 1fr) 440px; }

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

.analysis-body > .data-note {
  flex: none;
  min-height: 28px;
  align-items: center;
  margin: 0;
  padding: 0 15px;
  background: #fff;
}

@media (max-width: 1500px) {
  .analysis-workspace { grid-template-columns: 260px minmax(520px, 1fr) 390px; }
  .analysis-workspace.customer-mode { grid-template-columns: 260px minmax(560px, 1fr) 390px; }
}

.analysis-filters nav button { font-size: 13px; }

@media (max-width: 1120px) {
  .analysis-body { overflow: auto; }
  .analysis-workspace { min-height: 760px; grid-template-columns: 240px minmax(520px, 1fr); overflow: visible; }
  .analysis-workspace.customer-mode { grid-template-columns: 240px minmax(600px, 1fr); }
}
</style>
