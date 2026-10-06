<template>
  <div class="sales-analysis">
    <header class="analysis-toolbar">
      <section class="summary-grid" aria-label="销售概览">
        <article><span>成交销售额</span><strong>{{ formatMoney(summary.salesAmount) }}</strong><small>已完成历史订单</small></article>
        <article class="profit-card">
          <span>可核算毛利</span>
          <strong :class="{ negative: Number(summary.grossProfit) < 0 }">{{ formatOptionalMoney(summary.grossProfit) }}</strong>
          <small>{{ profitCoverageText(summary) }}</small>
        </article>
        <article class="profit-card">
          <span>毛利率</span>
          <strong :class="{ negative: Number(summary.grossMarginRate) < 0 }">{{ optionalPercentageLabel(summary.grossMarginRate) }}</strong>
          <small>可核算成本 {{ formatOptionalMoney(summary.costAmount) }}</small>
        </article>
        <article><span>使用客户</span><strong>{{ summary.customerCount || 0 }} 家</strong><small>按父客户去重</small></article>
        <article><span>成交商品</span><strong>{{ summary.goodsCount || 0 }} 种</strong><small>覆盖 {{ summary.subcategoryCount || 0 }} 个小类</small></article>
        <article><span>销售数量</span><strong>{{ primaryQuantity }}</strong><small>{{ otherQuantityText }}</small></article>
      </section>
      <div class="analysis-filters">
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
          <div class="category-share-guide">
            <nav class="category-mode-switch" aria-label="销售分析显示方式">
              <button
                type="button"
                :class="{ active: displayMode === 'product' }"
                @click="setDisplayMode('product')"
              >商品</button>
              <button
                type="button"
                :class="{ active: displayMode === 'customer' }"
                @click="setDisplayMode('customer')"
              >客户</button>
            </nav>
          </div>
          <nav class="category-tree" aria-label="销售分类树">
            <section
              v-for="(category, categoryIndex) in filteredCategories"
              :key="category.id"
              class="category-section"
              :class="`tone-${categoryIndex % 4}`"
              :style="categoryColorStyle(category.color)"
            >
              <button
                type="button"
                class="category-row"
                :class="{ active: same(category.id, selectedCategoryId) }"
                @click="selectCategory(category)"
              >
                <span
                  class="tree-caret"
                  role="button"
                  tabindex="0"
                  :aria-label="`${same(category.id, expandedCategoryId) ? '折叠' : '展开'}${category.name}`"
                  :aria-expanded="same(category.id, expandedCategoryId)"
                  @click.stop="toggleCategory(category)"
                  @keydown.enter.stop.prevent="toggleCategory(category)"
                  @keydown.space.stop.prevent="toggleCategory(category)"
                >{{ same(category.id, expandedCategoryId) ? '⌄' : '›' }}</span>
                <span class="category-icon" aria-hidden="true">
                  <img
                    v-if="catalogImage(category, 'category')"
                    :src="catalogImage(category, 'category')"
                    alt=""
                    @error="markCatalogImageFailed(category, 'category')"
                  />
                  <svg v-else viewBox="0 0 32 32" role="presentation">
                    <path d="M25 5C15 5.8 7.5 11.8 7.5 20.2c0 4 2.9 6.8 6.8 6.8C22 27 27.5 16.3 25 5Z" />
                    <path d="M6 27c4.4-8.2 9.6-12.6 17-16.3" />
                  </svg>
                </span>
                <span class="category-row__copy">
                  <strong>{{ category.name }}</strong>
                  <span class="category-row__share">
                    <em>{{ percentageLabel(category.share) }}</em>
                    <i class="category-row__progress" aria-hidden="true"><b :style="{ width: shareBarWidth(category.share) }"></b></i>
                  </span>
                </span>
                <b class="category-row__amount">{{ formatMoney(category.salesAmount) }}</b>
              </button>
              <div
                v-if="same(category.id, selectedCategoryId) && same(category.id, expandedCategoryId) && displayMode === 'product'"
                class="subcategory-tree"
              >
                <button
                  v-for="subcategory in subcategories"
                  :key="subcategory.id"
                  type="button"
                  :class="{ active: same(subcategory.id, selectedSubcategoryId) }"
                  @click="selectSubcategory(subcategory)"
                >
                  <span class="subcategory-row__copy">
                    <strong>{{ subcategory.name }}</strong>
                    <small>{{ percentageLabel(overallShare(subcategory.salesAmount)) }}</small>
                  </span>
                  <b>{{ formatMoney(subcategory.salesAmount) }}</b>
                </button>
                <p v-if="detailLoading">正在加载分类…</p>
                <p v-else-if="!subcategories.length">暂无小类</p>
              </div>
              <div
                v-else-if="same(category.id, selectedCategoryId) && same(category.id, expandedCategoryId)"
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
            <div class="selection-heading__top">
              <h2>{{ selectedCategoryName }} / {{ selectedSubcategoryName }}</h2>
              <label class="product-search"><span>⌕</span><input v-model.trim="keyword" placeholder="搜索商品名称、规格、条码" /></label>
            </div>
            <div class="selection-heading__metrics" aria-label="当前小类统计">
              <span><i>成交额</i><b>{{ formatMoney(selectedSubcategory?.salesAmount) }}</b></span>
              <span><i>占总额</i><b>{{ percentageLabel(overallShare(selectedSubcategory?.salesAmount)) }}</b></span>
              <span><i>客户</i><b>{{ selectedSubcategory?.customerCount || 0 }} 家</b></span>
              <span><i>商品</i><b>{{ selectedSubcategory?.goodsCount || visibleProducts.length }} 种</b></span>
              <span><i>客均</i><b>{{ formatMoney(selectedSubcategoryCustomerAverage) }}</b></span>
              <span><i>可核算额</i><b>{{ formatOptionalMoney(selectedSubcategory?.profitEligibleSalesAmount) }}</b></span>
              <span><i>成本</i><b>{{ formatOptionalMoney(selectedSubcategory?.costAmount) }}</b></span>
              <span><i>毛利</i><b :class="{ negative: Number(selectedSubcategory?.grossProfit) < 0 }">{{ formatOptionalMoney(selectedSubcategory?.grossProfit) }}</b></span>
              <span><i>毛利率</i><b :class="{ negative: Number(selectedSubcategory?.grossMarginRate) < 0 }">{{ optionalPercentageLabel(selectedSubcategory?.grossMarginRate) }}</b></span>
              <span><i>成本覆盖</i><b>{{ optionalPercentageLabel(selectedSubcategory?.profitCoverageRate) }}</b></span>
            </div>
          </header>

          <div v-if="detailLoading" class="panel-state">正在加载商品明细…</div>
          <div v-else class="product-table-wrap">
            <table>
              <thead><tr><th>商品</th><th>销售数量</th><th>成交销售额</th><th>可核算毛利</th><th>毛利率</th><th>加权平均单价</th><th>使用客户</th><th>主要购买客户</th><th aria-label="查看详情"></th></tr></thead>
              <tbody>
                <tr
                  v-for="(product, index) in visibleProducts"
                  :key="product.goodsId"
                  :class="{ selected: same(product.goodsId, selectedProductId) }"
                >
                  <td>
                    <div class="product-identity">
                      <span class="product-index">{{ index + 1 }}</span>
                      <span class="product-thumb"><img :src="goodsImage(product)" :alt="product.goodsName" /></span>
                      <span class="product-copy"><strong>{{ product.goodsName }}</strong><small>{{ product.goodsStandard || '未标规格' }}</small></span>
                    </div>
                  </td>
                  <td>{{ formatQuantities(product.quantities) }}</td>
                  <td class="money">{{ formatMoney(product.salesAmount) }}</td>
                  <td class="profit-value" :class="{ negative: Number(product.grossProfit) < 0 }">{{ formatOptionalMoney(product.grossProfit) }}</td>
                  <td class="profit-value" :class="{ negative: Number(product.grossMarginRate) < 0 }">{{ optionalPercentageLabel(product.grossMarginRate) }}</td>
                  <td>{{ formatAveragePrices(product.averagePrices) }}</td>
                  <td>{{ product.customerCount }} 家</td>
                  <td><span class="customer-tags"><i v-for="customer in product.topCustomers" :key="customer.customerId">{{ customer.customerName }}</i></span></td>
                  <td><button class="row-open" type="button" :aria-label="`查看${product.goodsName}的客户分布`" @click="openProductDrawer(product)">›</button></td>
                </tr>
                <tr v-if="!visibleProducts.length"><td colspan="9" class="empty-cell">没有符合条件的商品</td></tr>
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
          @select="openProductDrawer"
          @page="loadCustomerProductsPage"
        />

        <ProductCustomerDrawer
          :visible="productDrawerVisible"
          :product="selectedProduct"
          :detail="productDetail"
          :loading="productLoading"
          :error="productError"
          :image-server="imageServer"
          @close="closeProductDrawer"
        />
      </section>

      <footer class="data-note">
        <span>口径：{{ overview?.sourceTable || 'nx_department_order_history' }}</span>
        <span>分类：按当前配送目录归类</span>
        <span>毛利：成交额扣除确认退货后减去订单成本</span>
        <span v-if="summary.profitStatus === 'PARTIAL'">毛利依据不完整，缺 {{ summary.profitIneligibleLineCount || 0 }} 条</span>
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
  formatOptionalMoney,
  formatQuantities,
  optionalPercentageLabel,
  percentageLabel,
  rangeForDays,
  resolveCategoryImage,
  resolveGoodsImage,
} from '../presentation/salesAnalysisPresentation';

const IMAGE_SERVER = new URL('../', config.baseURL).toString();

export default {
  name: 'SalesAnalysis',
  components: { CustomerProductPanel, ProductCustomerDrawer },
  data() {
    return {
      imageServer: IMAGE_SERVER,
      range: rangeForDays(30),
      overview: null,
      categoryDetail: null,
      productDetail: null,
      productDrawerVisible: false,
      categoryCustomersDetail: null,
      customerProductsDetail: null,
      displayMode: 'product',
      selectedCategoryId: null,
      expandedCategoryId: null,
      selectedSubcategoryId: null,
      selectedProductId: null,
      selectedCustomerId: null,
      keyword: '',
      failedCatalogImages: {},
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
    selectedSubcategoryCustomerAverage() {
      const amount = Number(this.selectedSubcategory?.salesAmount) || 0;
      const customerCount = Number(this.selectedSubcategory?.customerCount) || 0;
      return customerCount > 0 ? amount / customerCount : 0;
    },
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
    formatOptionalMoney,
    formatQuantities,
    optionalPercentageLabel,
    percentageLabel,
    profitCoverageText(value) {
      if (!value || value.profitStatus === 'NO_DATA') return '暂无毛利依据';
      const coverage = optionalPercentageLabel(value.profitCoverageRate);
      return value.profitStatus === 'COMPLETE'
        ? `成本依据完整 · 覆盖 ${coverage}`
        : `部分可核算 · 覆盖 ${coverage}`;
    },
    goodsImage(product) {
      return resolveGoodsImage(product, this.imageServer, 'goodsImage/logo.jpg');
    },
    catalogImage(item, kind) {
      const key = `${kind}:${item?.id ?? ''}`;
      return this.failedCatalogImages[key] ? '' : resolveCategoryImage(item, this.imageServer);
    },
    markCatalogImageFailed(item, kind) {
      this.failedCatalogImages[`${kind}:${item?.id ?? ''}`] = true;
    },
    categoryColorStyle(value) {
      const color = String(value || '').trim();
      return /^#[0-9a-f]{6}$/i.test(color) ? { '--category-accent': color } : {};
    },
    same(left, right) { return String(left) === String(right); },
    overallShare(amount) {
      const total = Number(this.summary.salesAmount) || 0;
      return total > 0 ? (Number(amount) || 0) / total * 100 : 0;
    },
    shareBarWidth(value) {
      const percentage = Math.max(0, Math.min(100, Number(value) || 0));
      return `${percentage}%`;
    },
    useCustomRange() {
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
      this.expandedCategoryId = null;
      this.selectedSubcategoryId = null;
      this.selectedProductId = null;
      this.selectedCustomerId = null;
      this.productLoading = false;
      this.categoryCustomersLoading = false;
      this.customerProductsLoading = false;
      this.cancelDetailRequests();
    },
    async selectCategory(category, force = false) {
      this.expandedCategoryId = category.id;
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
    toggleCategory(category) {
      if (this.same(category.id, this.expandedCategoryId)) {
        this.expandedCategoryId = null;
        return;
      }
      this.expandedCategoryId = category.id;
      if (!this.same(category.id, this.selectedCategoryId)) this.selectCategory(category);
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
      this.clearProductSelection();
      if (mode === 'product') {
        this.categoryCustomersRequestId += 1;
        this.customerProductsRequestId += 1;
        this.categoryCustomersLoading = false;
        this.customerProductsLoading = false;
        if (!this.categoryDetail) {
          await this.loadCategoryDetail();
        }
        return;
      }
      if (!this.categoryCustomersDetail) {
        await this.loadCategoryCustomers(1);
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
      this.productDrawerVisible = false;
    },
    selectSubcategory(subcategory) {
      this.selectedSubcategoryId = subcategory.id;
      this.keyword = '';
      this.clearProductSelection();
    },
    clearProductSelection() {
      this.productRequestId += 1;
      this.productDrawerVisible = false;
      this.selectedProductId = null;
      this.productDetail = null;
      this.productError = '';
      this.productLoading = false;
    },
    openProductDrawer(product) {
      if (!product?.goodsId) return;
      this.productDrawerVisible = true;
      this.selectProduct(product);
    },
    closeProductDrawer() {
      this.clearProductSelection();
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
*{box-sizing:border-box}.sales-analysis{height:100%;min-width:0;display:flex;flex-direction:column;background:#f3f7f5;color:#202d27;overflow:hidden}.analysis-toolbar{flex:none;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:15px 22px;background:#fff;border-bottom:1px solid #dce7e1}.analysis-toolbar h1{margin:0;font-size:24px}.analysis-toolbar p{margin:4px 0 0;color:#7d8983;font-size:11px}.analysis-filters{display:flex;align-items:flex-end;gap:10px}.analysis-filters label{display:flex;flex-direction:column;gap:5px;color:#66756d;font-size:12px;font-weight:700}.analysis-filters input{width:158px;height:44px;padding:0 11px;border:1px solid #cddbd4;border-radius:9px;background:#fff;color:#26362e;font-family:inherit;font-size:15px;font-weight:700}.analysis-filters input::-webkit-calendar-picker-indicator{width:18px;height:18px;cursor:pointer}.analysis-filters>i{padding-bottom:11px;color:#75847d;font-size:18px;font-style:normal}.refresh-button{height:44px;padding:0 18px;border:0;border-radius:9px;background:#109c5c;color:#fff;font-size:15px;font-weight:800}.refresh-button:disabled{opacity:.6}.analysis-body{flex:1;min-height:0;overflow:auto;padding:14px 16px 22px}.summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.summary-grid article{min-width:0;padding:13px 15px;border:1px solid #dfe8e3;border-radius:11px;background:#fff}.summary-grid span,.summary-grid small{display:block}.summary-grid span{color:#7d8983;font-size:10px}.summary-grid strong{display:block;margin-top:4px;overflow:hidden;font-size:22px;text-overflow:ellipsis;white-space:nowrap}.summary-grid small{margin-top:4px;color:#07814b;font-size:9px}.overview-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(270px,.72fr);gap:11px;margin-top:11px}.analysis-panel{min-width:0;border:1px solid #dfe8e3;border-radius:12px;background:#fff;overflow:hidden}.analysis-panel>header{min-height:54px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 15px;border-bottom:1px solid #e3ebe7}.analysis-panel h2,.analysis-panel p{margin:0}.analysis-panel h2{font-size:15px}.analysis-panel p{margin-top:3px;color:#84908a;font-size:9px}.analysis-panel>header>span{color:#7a8881;font-size:10px}.drill-grid{display:grid;grid-template-columns:minmax(230px,.55fr) minmax(0,1.75fr);gap:11px;margin-top:11px}.subcategory-list{display:grid}.subcategory-list button{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 10px;padding:12px 14px;border:0;border-bottom:1px solid #e8eeeb;background:#fff;color:#34423b;text-align:left;cursor:pointer}.subcategory-list button:last-child{border-bottom:0}.subcategory-list button.active{background:#eaf7f0;box-shadow:inset 3px 0 0 #119b5c}.subcategory-list span,.subcategory-list strong,.subcategory-list small{display:block;min-width:0}.subcategory-list strong{font-size:12px}.subcategory-list small{margin-top:4px;overflow:hidden;color:#7f8c85;font-size:9px;text-overflow:ellipsis;white-space:nowrap}.subcategory-list b{font-size:12px}.subcategory-list em{grid-column:1/3;height:4px;border-radius:4px;background:#eef2f0;overflow:hidden}.subcategory-list i{display:block;height:100%;border-radius:4px;background:#14a262}.product-heading label{width:230px;height:34px;display:flex;align-items:center;gap:7px;padding:0 10px;border:1px solid #d7e2dc;border-radius:8px;color:#0b8851}.product-heading input{min-width:0;width:100%;border:0;outline:0;background:transparent;font-size:11px}.product-table-wrap{overflow:auto}.product-table-wrap table{width:100%;min-width:850px;border-collapse:collapse}.product-table-wrap th,.product-table-wrap td{padding:12px 11px;border-bottom:1px solid #e9eeeb;text-align:left;vertical-align:middle}.product-table-wrap th{background:#f5f8f6;color:#78857f;font-size:12px;font-weight:700;white-space:nowrap}.product-table-wrap td{font-size:13px}.product-table-wrap tbody tr[tabindex]{cursor:pointer;outline:none}.product-table-wrap tbody tr[tabindex]:hover,.product-table-wrap tr.selected{background:#f0f9f4}.product-table-wrap tbody tr[tabindex]:focus-visible{box-shadow:inset 0 0 0 2px #159d60}.product-table-wrap td:first-child{min-width:130px}.product-table-wrap td:nth-child(2),.product-table-wrap td:nth-child(4){max-width:155px}.product-table-wrap td>button{width:100%;padding:0;border:0;background:transparent;color:#293831;text-align:left;cursor:pointer}.product-table-wrap td>button strong,.product-table-wrap td>button small{display:block}.product-table-wrap td>button strong{font-size:15px}.product-table-wrap td>button small{margin-top:4px;color:#76847d;font-size:12px}.product-table-wrap .money{color:#07814b;font-weight:800;white-space:nowrap}.customer-tags{display:flex;flex-wrap:wrap;gap:4px}.customer-tags i{padding:4px 7px;border-radius:10px;background:#eef3f0;color:#5f6e67;font-size:11px;font-style:normal;white-space:nowrap}.product-table-wrap td:last-child{width:42px;padding-left:3px;padding-right:9px}.product-table-wrap .row-open{width:30px;height:30px;display:grid;place-items:center;border:1px solid #d9e4de;border-radius:8px;background:#fff;color:#0b8b52;font-size:22px;text-align:center}.empty-cell{padding:35px!important;color:#87938d;text-align:center!important}.panel-state{min-height:180px;display:grid;place-items:center;color:#84918b;font-size:11px}.data-note{display:flex;flex-wrap:wrap;gap:7px 18px;margin-top:10px;padding:0 3px;color:#829089;font-size:9px}.inline-message{margin-bottom:9px;padding:9px 12px;border-radius:8px;background:#edf6fb;color:#376277;font-size:11px}.inline-message.error{background:#fff0f1;color:#ac3c45}.page-state{flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#7f8c85}.page-state>span{width:54px;height:54px;display:grid;place-items:center;border-radius:16px;background:#e6f5ed;color:#0a8951;font-size:19px;font-weight:900}.page-state h3{margin:13px 0 3px;color:#34423b}.page-state p{margin:0}.page-state button{margin-top:11px;padding:8px 13px;border:0;border-radius:8px;background:#109c5c;color:#fff}.page-state.error>span{background:#fde9eb;color:#b93c46}@media(max-width:1250px){.analysis-toolbar{align-items:flex-start}.analysis-filters{flex-wrap:wrap;justify-content:flex-end}.summary-grid{grid-template-columns:repeat(2,1fr)}.overview-grid{grid-template-columns:minmax(0,1.4fr) minmax(250px,.75fr)}}@media(max-width:980px){.analysis-toolbar{flex-direction:column}.analysis-filters{justify-content:flex-start}.overview-grid,.drill-grid{grid-template-columns:1fr}}@media(max-width:640px){.analysis-toolbar{padding:13px}.analysis-filters label,.analysis-filters>i{display:none}.analysis-body{padding:10px}.summary-grid{grid-template-columns:1fr}.product-heading{align-items:flex-start!important;flex-direction:column}.product-heading label{width:100%}}
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
  flex: 0 1 820px;
  min-width: 0;
  gap: 0;
  grid-template-columns: repeat(6, minmax(0, 1fr));
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
.analysis-toolbar .summary-grid .profit-card { background: #f4fbf7; }
.analysis-toolbar .summary-grid .profit-card strong { color: #087f4c; }
.analysis-toolbar .summary-grid strong.negative { color: #c43e48; }
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

/* Two-column workspace; product customers open in an overlay drawer. */
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
  grid-template-columns: 290px minmax(0, 1fr);
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
.selection-heading {
  min-height: 112px;
  align-items: stretch;
  flex-direction: column;
  gap: 10px;
  padding: 11px 14px 12px 17px;
  border-left: 3px solid #10a05d;
}
.selection-heading__top { min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.selection-heading__metrics {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(10, minmax(70px, 1fr));
  overflow: hidden;
  border: 1px solid #e0eae5;
  border-radius: 9px;
  background: #f8fbf9;
}
.selection-heading__metrics span { min-width: 0; display: flex; flex-direction: column; gap: 3px; padding: 7px 9px; border-right: 1px solid #e4ece8; white-space: nowrap; }
.selection-heading__metrics span:last-child { border-right: 0; }
.selection-heading__metrics i { color: #75857d; font-size: 10px; font-style: normal; }
.selection-heading__metrics b { overflow: hidden; color: #176b43; font-size: 13px; text-overflow: ellipsis; }
.selection-heading__metrics b.negative { color: #c43e48; }

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

.category-share-guide {
  flex: none;
  min-height: 58px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 12px;
  border-bottom: 1px solid #dfe8e3;
  background: linear-gradient(135deg, #fbfefc 0%, #f1f9f5 100%);
}
.category-mode-switch {
  width: calc(100% - 20px);
  max-width: 246px;
  height: 38px;
  flex: none;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 3px;
  border: 1px solid #cfe0d7;
  border-radius: 9px;
  background: rgba(255, 255, 255, .78);
  box-shadow: inset 0 1px 2px rgba(31, 70, 49, .04);
}
.category-mode-switch button {
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #6d7c74;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}
.category-mode-switch button.active {
  background: #109c5c;
  color: #fff;
  box-shadow: 0 3px 8px rgba(16, 156, 92, .2);
}
.category-tree { flex: 1; min-height: 0; overflow: auto; }
.category-tree > section { border-bottom: 1px solid #e8eeeb; }
.category-section { --category-accent: #28a568; --category-soft: #e9f8ef; }
.category-section.tone-1 { --category-accent: #42a57a; --category-soft: #eaf7f1; }
.category-section.tone-2 { --category-accent: #68a65a; --category-soft: #eef8e9; }
.category-section.tone-3 { --category-accent: #2f9989; --category-soft: #e8f6f3; }
.category-row {
  width: calc(100% - 12px);
  min-height: 66px;
  display: grid;
  grid-template-columns: 16px 42px minmax(0, 1fr) 68px;
  align-items: center;
  gap: 7px;
  margin: 6px;
  padding: 8px 9px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: #fff;
  color: #25342d;
  text-align: left;
  cursor: pointer;
}
.category-row:hover { background: #f4faf7; }
.category-row.active {
  border-color: #d3eadf;
  background: linear-gradient(100deg, var(--category-soft) 0%, #f8fcfa 100%);
  box-shadow: 0 3px 12px rgba(23, 105, 63, .07);
}
.category-icon {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--category-soft);
  color: var(--category-accent);
}
.category-icon svg { width: 28px; height: 28px; overflow: visible; }
.category-icon img { width: 100%; height: 100%; display: block; border-radius: inherit; object-fit: cover; }
.category-icon path:first-child { fill: currentColor; opacity: .22; }
.category-icon path:last-child { fill: none; stroke: currentColor; stroke-width: 2.1; stroke-linecap: round; }
.category-row__copy { min-width: 0; display: block; }
.category-row__copy > strong { display: block; overflow: hidden; color: #25342d; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.category-row__share { min-width: 0; display: flex; align-items: center; gap: 8px; margin-top: 5px; }
.category-row__share em { flex: none; color: #078b51; font-size: 11px; font-style: normal; font-weight: 900; }
.category-row__progress {
  width: 58px;
  height: 7px;
  display: block;
  overflow: hidden;
  border-radius: 5px;
  background: #e7eeea;
}
.category-row__progress b {
  min-width: 4px;
  height: 100%;
  display: block;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--category-accent), #7fd8a8);
}
.category-row > b { color: #26372f; font-size: 12px; text-align: right; white-space: nowrap; }
.tree-caret {
  width: 24px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 7px;
  color: #466057;
  font-size: 17px;
  cursor: pointer;
  outline: none;
}
.tree-caret:hover { background: rgba(16, 156, 92, .09); color: #087f4c; }
.tree-caret:focus-visible { box-shadow: 0 0 0 2px rgba(16, 156, 92, .28); }

.subcategory-tree {
  margin-left: 26px;
  padding: 0 8px 8px 13px;
  border-left: 2px solid #d8e8df;
}
.subcategory-tree button {
  position: relative;
  width: 100%;
  min-height: 50px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 64px;
  align-items: center;
  gap: 7px;
  padding: 5px 7px;
  border: 0;
  border-radius: 7px;
  background: #fff;
  color: #415149;
  text-align: left;
  cursor: pointer;
}
.subcategory-tree button::before {
  position: absolute;
  top: 24px;
  left: -13px;
  width: 10px;
  border-top: 2px solid #d8e8df;
  content: '';
}
.subcategory-tree button:hover { background: #f4faf7; }
.subcategory-tree button.active { background: #eaf7f0; color: #176741; }
.subcategory-row__copy { min-width: 0; display: block; }
.subcategory-row__copy > strong,
.subcategory-row__copy > small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.subcategory-row__copy > strong { min-width: 0; font-size: 11px; }
.subcategory-row__copy > small { margin-top: 4px; color: #078b51; font-size: 10px; font-weight: 900; }
.subcategory-tree button b { color: #3d5147; font-size: 11px; text-align: right; white-space: nowrap; }
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

.analysis-workspace.customer-mode { grid-template-columns: 290px minmax(0, 1fr); }

.product-search { width: 250px; height: 32px; flex: none; padding: 0 9px; border-radius: 8px; }
.product-table-wrap { flex: 1; min-height: 0; overflow: auto; }
.product-table-wrap table { min-width: 980px; }
.product-table-wrap .profit-value { color: #087f4c; font-weight: 800; white-space: nowrap; }
.product-table-wrap .profit-value.negative { color: #c43e48; }
.product-table-wrap th,
.product-table-wrap td { padding: 9px 10px; }
.product-table-wrap th { position: sticky; top: 0; z-index: 1; font-size: 10px; }
.product-table-wrap td { font-size: 13px; }
.product-table-wrap .product-identity { min-width: 170px; gap: 8px; }
.product-table-wrap .product-copy strong { display: block; font-size: 13px; }
.product-table-wrap .product-copy small { display: block; margin-top: 2px; color: #76847d; font-size: 10px; }
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
  .analysis-workspace { grid-template-columns: 260px minmax(0, 1fr); }
  .analysis-workspace.customer-mode { grid-template-columns: 260px minmax(0, 1fr); }
  .selection-heading__metrics { grid-template-columns: repeat(5, minmax(90px, 1fr)); }
  .selection-heading__metrics span:nth-child(5) { border-right: 0; }
  .selection-heading__metrics span:nth-child(-n + 5) { border-bottom: 1px solid #e4ece8; }
}

.analysis-filters nav button { font-size: 13px; }

@media (max-width: 1120px) {
  .analysis-body { overflow: auto; }
  .analysis-workspace { min-height: 760px; grid-template-columns: 240px minmax(520px, 1fr); overflow: visible; }
  .analysis-workspace.customer-mode { grid-template-columns: 240px minmax(520px, 1fr); }
}
</style>
