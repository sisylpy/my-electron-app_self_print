<template>
  <div class="standard-layer" @click.self="$emit('close')">
    <aside class="standard-drawer">
      <header class="drawer-head">
        <div><span>客户商品要求</span><h3>{{ customerGoodsName }}</h3><p>{{ departmentName }} · {{ goodsName }}</p></div>
        <button type="button" @click="$emit('close')">×</button>
      </header>

      <div v-if="loading" class="drawer-state">正在加载商品要求…</div>
      <div v-else-if="errorText" class="drawer-state error">{{ errorText }}<button @click="load">重新加载</button></div>

      <template v-else>
        <div v-if="mode === 'view'" class="drawer-scroll">
          <section class="linked-goods-card">
            <div class="card-title"><span>当前关联配送商品</span><button @click="openRelationSearch">更换商品</button></div>
            <strong>{{ current.disGoodsName || goodsName }}</strong>
            <p>{{ [current.disGoodsBrand, current.disGoodsStandardName].filter(Boolean).join(' · ') || '未设置品牌和规格' }}</p>
          </section>

          <div class="section-title"><div><span>CUSTOM STANDARD</span><h4>客户专属要求</h4></div><button @click="loadHistory">修改记录</button></div>
          <div v-if="!currentItems.length && !currentImages.length" class="empty-standard">
            <b>还没有商品要求</b><p>添加文字和图片后，采购、分拣时可以更准确地理解客户偏好。</p>
            <button @click="beginEdit">添加客户要求</button>
          </div>
          <div v-else class="requirement-groups">
            <section v-for="group in groupedItems" :key="group.code">
              <header><h5>{{ dimensionName(group.code) }}</h5><span>{{ group.items.length }} 条</span></header>
              <article v-for="item in group.items" :key="item.nxDdgsiId" class="requirement-card">
                <div class="requirement-text"><strong>{{ item.nxDdgsiRequirementText }}</strong><span>重要度 {{ item.nxDdgsiImportanceLevel || 3 }}</span></div>
                <div v-if="imagesForItem(item.nxDdgsiId).length" class="image-grid">
                  <figure v-for="image in imagesForItem(item.nxDdgsiId)" :key="image.nxDdgimgId" :class="roleClass(image)">
                    <img :src="imageUrl(image.nxDdgimgImageUrl)" alt="" @click="previewImage(image)" />
                    <figcaption>{{ roleName(image.nxDdgimgImageRole) }}<small>{{ image.nxDdgimgDescription }}</small></figcaption>
                  </figure>
                </div>
              </article>
            </section>
            <section v-if="generalImages.length">
              <header><h5>整体参考</h5><span>{{ generalImages.length }} 张</span></header>
              <div class="image-grid general">
                <figure v-for="image in generalImages" :key="image.nxDdgimgId" :class="roleClass(image)">
                  <img :src="imageUrl(image.nxDdgimgImageUrl)" alt="" @click="previewImage(image)" />
                  <figcaption>{{ roleName(image.nxDdgimgImageRole) }}<small>{{ image.nxDdgimgDescription }}</small></figcaption>
                </figure>
              </div>
            </section>
          </div>
        </div>

        <div v-else-if="mode === 'edit'" class="drawer-scroll editor">
          <div class="editor-heading"><div><h4>文字要求</h4><p>同一维度可添加多条，重要度越高越靠前。</p></div><button @click="addItem">＋ 新增要求</button></div>
          <div v-if="!editItems.length" class="editor-empty">先添加一条要求，例如“新鲜度：不能有黄叶”。</div>
          <article v-for="(item, index) in editItems" :key="item.uiKey" class="item-editor">
            <header><strong>要求 {{ index + 1 }}</strong><button @click="removeItem(index)">{{ item.isNew ? '移除' : '失效' }}</button></header>
            <div class="two-field">
              <label>标准维度<select v-model="item.dimensionCode" @change="itemChanged(item)"><option v-for="dimension in dimensions" :key="dimension" :value="dimension">{{ dimensionName(dimension) }}</option></select></label>
              <label>重要程度<select v-model.number="item.importanceLevel" @change="item.dirty = true"><option v-for="level in 5" :key="level" :value="level">{{ level }} {{ importanceLabel(level) }}</option></select></label>
            </div>
            <label>简短要求<input v-model.trim="item.requirementText" maxlength="200" @input="item.dirty = true" placeholder="例如：小颗、禁止替代" /></label>
          </article>

          <div class="editor-heading image-heading"><div><h4>标准图片</h4><p>支持合格参考、禁止示例和普通参考。</p></div><label class="upload-button">＋ 添加图片<input type="file" accept="image/jpeg,image/png,image/webp" multiple @change="uploadImages" /></label></div>
          <div v-if="uploading" class="uploading">正在上传图片…</div>
          <div class="image-editor-list">
            <article v-for="(image, index) in editImages" :key="image.uiKey" class="image-editor-card">
              <img :src="image.previewUrl" alt="" />
              <div>
                <div class="two-field">
                  <label>图片角色<select v-model="image.imageRole" @change="image.dirty = true"><option value="PASS">合格参考</option><option value="PROHIBITED">禁止这样</option><option value="REFERENCE">普通参考</option></select></label>
                  <label>重要程度<select v-model.number="image.importanceLevel" @change="image.dirty = true"><option v-for="level in 5" :key="level" :value="level">{{ level }}</option></select></label>
                </div>
                <label>属于哪条要求<select v-model="image.linkedItemKey" @change="bindImage(image)"><option value="">整个客户商品</option><option v-for="item in editItems" :key="item.uiKey" :value="item.uiKey">{{ dimensionName(item.dimensionCode) }} · {{ item.requirementText || '未填写' }}</option></select></label>
                <label>图片说明<input v-model.trim="image.description" maxlength="200" @input="image.dirty = true" /></label>
                <button class="remove-image" @click="removeImage(index)">{{ image.isNew ? '删除图片' : '将图片失效' }}</button>
              </div>
            </article>
          </div>
        </div>

        <div v-else-if="mode === 'history'" class="drawer-scroll">
          <div class="section-title"><div><span>CHANGE HISTORY</span><h4>修改记录</h4></div><button @click="mode = 'view'">返回当前要求</button></div>
          <div v-if="historyLoading" class="drawer-state">正在读取记录…</div>
          <div v-else-if="!history.length" class="empty-standard"><b>还没有修改记录</b></div>
          <div v-else class="history-list">
            <article v-for="(version, index) in history" :key="version.versionNo || index">
              <time>{{ formatTime(version.changedAt) }}</time><strong>{{ version.changeReason || '修改客户商品要求' }}</strong>
              <p>记录了 {{ (version.changes || []).length }} 项变化</p>
            </article>
          </div>
        </div>

        <div v-else class="drawer-scroll">
          <div class="section-title"><div><span>DELIVERY GOODS</span><h4>更换关联商品</h4></div><button @click="mode = 'view'">返回</button></div>
          <div class="relation-search"><input v-model.trim="relationKeyword" @keyup.enter="searchRelations" placeholder="输入配送商商品名称" /><button @click="searchRelations">搜索</button></div>
          <div v-if="relationLoading" class="drawer-state">正在搜索…</div>
          <div v-else class="relation-list">
            <button v-for="goods in relationResults" :key="goods.nxDistributerGoodsId" @click="changeRelation(goods)">
              <strong>{{ goods.nxDgGoodsName }}</strong><span>{{ goods.nxDgGoodsBrand }} {{ goods.nxDgGoodsStandardname }}</span><em>选择 ›</em>
            </button>
          </div>
        </div>

        <footer v-if="mode === 'view'" class="drawer-actions"><button class="outline" @click="$emit('close')">关闭</button><button class="primary" @click="beginEdit">编辑客户要求</button></footer>
        <footer v-else-if="mode === 'edit'" class="drawer-actions"><span>{{ saveError }}</span><button class="outline" @click="mode = 'view'">取消</button><button class="primary" :disabled="saving || uploading" @click="save">{{ saving ? '保存中…' : '保存本次修改' }}</button></footer>
      </template>
    </aside>
  </div>
</template>

<script>
import customerApi from '../api/customerApi';

const DIMENSION_NAMES = { SIZE: '大小', COLOR: '颜色', FRESHNESS: '新鲜度', ROOT: '根部', PACKAGING: '包装', SUBSTITUTE: '替代', OTHER: '其他' };
const ROLE_NAMES = { PASS: '合格参考', PROHIBITED: '禁止这样', REFERENCE: '普通参考' };
const key = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export default {
  name: 'CustomerGoodsStandardDrawer',
  props: {
    relation: { type: Object, required: true }, distributerId: { type: [Number, String], required: true },
    operatorUserId: { type: [Number, String], required: true },
  },
  emits: ['close', 'updated', 'notice'],
  data() { return { loading: true, errorText: '', mode: 'view', current: {}, dimensions: [], editItems: [], editImages: [], inactiveItemIds: [], inactiveImageIds: [], saving: false, saveError: '', uploading: false, history: [], historyLoading: false, relationKeyword: '', relationResults: [], relationLoading: false, imageServer: customerApi.imageServerUrl() }; },
  computed: {
    relationId() { return this.relation.nxDepartmentDisGoodsId; },
    goodsEntity() { return this.relation.nxDistributerGoodsEntity || {}; },
    goodsName() { return this.goodsEntity.nxDgGoodsName || this.relation.nxDdgDepGoodsName || '未命名商品'; },
    customerGoodsName() { return this.relation.nxDdgOrderGoodsName || this.relation.nxDdgDepGoodsName || this.goodsName; },
    departmentName() { return this.relation?.nxDepartmentEntity?.nxDepartmentAttrName || this.relation?.nxDepartmentEntity?.nxDepartmentName || '当前客户'; },
    currentItems() { return this.current.items || []; }, currentImages() { return this.current.images || []; },
    groupedItems() {
      const map = {};
      this.currentItems.forEach((item) => { const code = item.nxDdgsiDimensionCode || 'OTHER'; (map[code] ||= []).push(item); });
      return Object.entries(map).map(([code, items]) => ({ code, items: items.sort((a, b) => Number(b.nxDdgsiImportanceLevel || 3) - Number(a.nxDdgsiImportanceLevel || 3)) }));
    },
    generalImages() { return this.currentImages.filter((image) => !image.nxDdgimgStandardItemId); },
  },
  mounted() { this.load(); },
  methods: {
    async load() {
      this.loading = true; this.errorText = '';
      try {
        const [dimensionResponse, currentResponse] = await Promise.all([
          customerApi.getStandardDimensions(), customerApi.getCurrentStandard(this.relationId, this.distributerId, this.operatorUserId),
        ]);
        if (dimensionResponse?.data?.code !== 0) throw new Error(dimensionResponse?.data?.msg || '标准维度加载失败');
        if (currentResponse?.data?.code !== 0) throw new Error(currentResponse?.data?.msg || '商品要求加载失败');
        this.dimensions = dimensionResponse.data.data || Object.keys(DIMENSION_NAMES);
        this.current = currentResponse.data.data || { items: [], images: [] };
      } catch (error) { this.errorText = error?.message || '商品要求加载失败'; }
      finally { this.loading = false; }
    },
    dimensionName(code) { return DIMENSION_NAMES[code] || code; },
    importanceLabel(level) { return ['', '普通', '注意', '重要', '重点', '关键'][level] || ''; },
    roleName(role) { return ROLE_NAMES[role] || ROLE_NAMES.REFERENCE; }, roleClass(image) { return String(image.nxDdgimgImageRole || 'REFERENCE').toLowerCase(); },
    imageUrl(value) { if (!value) return ''; return /^https?:|^blob:/i.test(value) ? value : this.imageServer + String(value).replace(/^\//, ''); },
    imagesForItem(itemId) { return this.currentImages.filter((image) => String(image.nxDdgimgStandardItemId || '') === String(itemId)); },
    previewImage(image) { window.open(this.imageUrl(image.nxDdgimgImageUrl), '_blank', 'noopener'); },
    beginEdit() {
      this.editItems = this.currentItems.map((item) => ({ uiKey: `item-${item.nxDdgsiId}`, itemId: item.nxDdgsiId, clientKey: '', dimensionCode: item.nxDdgsiDimensionCode || 'OTHER', dimensionName: item.nxDdgsiDimensionName || '', requirementText: item.nxDdgsiRequirementText || '', importanceLevel: Number(item.nxDdgsiImportanceLevel || 3), sort: Number(item.nxDdgsiSort || 0), isNew: false, dirty: false }));
      this.editImages = this.currentImages.map((image) => { const item = this.editItems.find((row) => String(row.itemId) === String(image.nxDdgimgStandardItemId)); return { uiKey: `image-${image.nxDdgimgId}`, imageId: image.nxDdgimgId, linkedItemKey: item?.uiKey || '', serverImageUrl: image.nxDdgimgImageUrl, previewUrl: this.imageUrl(image.nxDdgimgImageUrl), dimensionCode: image.nxDdgimgDimensionCode || item?.dimensionCode || 'OTHER', imageRole: image.nxDdgimgImageRole || 'REFERENCE', description: image.nxDdgimgDescription || '', importanceLevel: Number(image.nxDdgimgImportanceLevel || 3), sort: Number(image.nxDdgimgSort || 0), isNew: false, dirty: false }; });
      this.inactiveItemIds = []; this.inactiveImageIds = []; this.saveError = ''; this.mode = 'edit';
    },
    addItem() { const dimensionCode = this.dimensions[0] || 'OTHER'; this.editItems.push({ uiKey: key('item'), itemId: null, clientKey: key('client'), dimensionCode, dimensionName: this.dimensionName(dimensionCode), requirementText: '', importanceLevel: 3, sort: (this.editItems.length + 1) * 10, isNew: true, dirty: true }); },
    itemChanged(item) { item.dimensionName = this.dimensionName(item.dimensionCode); item.dirty = true; this.editImages.filter((image) => image.linkedItemKey === item.uiKey).forEach((image) => { image.dimensionCode = item.dimensionCode; image.dirty = true; }); },
    removeItem(index) { const item = this.editItems[index]; if (!item.isNew) this.inactiveItemIds.push(item.itemId); this.editItems.splice(index, 1); this.editImages = this.editImages.filter((image) => { if (image.linkedItemKey !== item.uiKey) return true; if (!image.isNew) this.inactiveImageIds.push(image.imageId); return false; }); },
    bindImage(image) { const item = this.editItems.find((row) => row.uiKey === image.linkedItemKey); image.dimensionCode = item?.dimensionCode || 'OTHER'; image.dirty = true; },
    removeImage(index) { const image = this.editImages[index]; if (!image.isNew) this.inactiveImageIds.push(image.imageId); this.editImages.splice(index, 1); },
    async uploadImages(event) {
      const files = Array.from(event.target.files || []).slice(0, 20);
      event.target.value = ''; if (!files.length) return;
      this.uploading = true; this.saveError = '';
      try {
        for (const file of files) {
          if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} 超过10MB`);
          const response = await customerApi.uploadStandardImage(this.relationId, this.distributerId, this.operatorUserId, file);
          if (response?.data?.code !== 0) throw new Error(response?.data?.msg || '图片上传失败');
          const uploaded = Array.isArray(response.data.data) ? response.data.data[0] : response.data.data;
          if (!uploaded?.imageUrl) throw new Error('后台未返回图片地址');
          this.editImages.push({ uiKey: key('image'), imageId: null, linkedItemKey: '', serverImageUrl: uploaded.imageUrl, previewUrl: this.imageUrl(uploaded.imageUrl), dimensionCode: 'OTHER', imageRole: 'REFERENCE', description: '', importanceLevel: 3, sort: (this.editImages.length + 1) * 10, isNew: true, dirty: true });
        }
      } catch (error) { this.saveError = error?.message || '图片上传失败'; }
      finally { this.uploading = false; }
    },
    async save() {
      if (this.editItems.some((item) => !String(item.requirementText || '').trim())) { this.saveError = '请填写完整的文字要求'; return; }
      const changedItems = this.editItems.filter((item) => item.isNew || item.dirty);
      const changedImages = this.editImages.filter((image) => image.isNew || image.dirty);
      if (!changedItems.length && !changedImages.length && !this.inactiveItemIds.length && !this.inactiveImageIds.length) { this.mode = 'view'; return; }
      const items = changedItems.map((item) => ({ itemId: item.isNew ? null : item.itemId, clientKey: item.isNew ? item.clientKey : null, dimensionCode: item.dimensionCode, dimensionName: item.dimensionCode === 'OTHER' ? (item.dimensionName || '其他') : null, requirementText: item.requirementText.trim(), importanceLevel: item.importanceLevel, sort: item.sort, sourceType: item.isNew ? 'MANUAL' : null }));
      const images = changedImages.map((image) => { const linked = this.editItems.find((item) => item.uiKey === image.linkedItemKey); const data = { imageId: image.isNew ? null : image.imageId, standardItemId: linked && !linked.isNew ? linked.itemId : null, standardItemClientKey: linked?.isNew ? linked.clientKey : null, clearStandardItem: !image.isNew && !linked, dimensionCode: linked?.dimensionCode || image.dimensionCode || 'OTHER', imageRole: image.imageRole, description: image.description || '', importanceLevel: image.importanceLevel, sort: image.sort, sourceType: image.isNew ? 'MANUAL' : null }; if (image.isNew) data.imageUrl = image.serverImageUrl; return data; });
      this.saving = true; this.saveError = '';
      try {
        const response = await customerApi.saveStandard(this.relationId, { distributerId: this.distributerId, operatorUserId: this.operatorUserId, confirmed: true, changeReason: '桌面端维护客户商品要求', sourceType: 'MANUAL', items, images, inactiveItemIds: this.inactiveItemIds, inactiveImageIds: this.inactiveImageIds });
        if (response?.data?.code !== 0) throw new Error(response?.data?.msg || '保存失败');
        await this.load(); this.mode = 'view'; this.$emit('updated'); this.$emit('notice', '客户商品要求已保存');
      } catch (error) { this.saveError = error?.message || '保存失败'; }
      finally { this.saving = false; }
    },
    async loadHistory() { this.mode = 'history'; this.historyLoading = true; try { const response = await customerApi.getStandardHistory(this.relationId, this.distributerId, this.operatorUserId); if (response?.data?.code !== 0) throw new Error(response?.data?.msg || '修改记录加载失败'); this.history = response.data.data || []; } catch (error) { this.$emit('notice', error?.message || '修改记录加载失败', 'error'); } finally { this.historyLoading = false; } },
    formatTime(value) { return value ? String(value).replace('T', ' ').slice(0, 16) : '时间未知'; },
    openRelationSearch() { this.mode = 'relation'; this.relationKeyword = this.customerGoodsName; this.searchRelations(); },
    async searchRelations() { if (!this.relationKeyword) return; this.relationLoading = true; try { const response = await customerApi.searchDistributerGoods(this.distributerId, this.relationKeyword); if (response?.data?.code !== 0) throw new Error(response?.data?.msg || '搜索失败'); this.relationResults = response.data.data?.disArr || []; } catch (error) { this.$emit('notice', error?.message || '搜索失败', 'error'); } finally { this.relationLoading = false; } },
    async changeRelation(goods) { try { const response = await customerApi.updateGoodsRelation(this.relationId, { distributerId: this.distributerId, operatorUserId: this.operatorUserId, disGoodsId: goods.nxDistributerGoodsId }); if (response?.data?.code !== 0) throw new Error(response?.data?.msg || '关联失败'); await this.load(); this.mode = 'view'; this.$emit('updated'); this.$emit('notice', '关联商品已更新'); } catch (error) { this.$emit('notice', error?.message || '关联失败', 'error'); } },
  },
};
</script>

<style scoped>
.standard-layer{position:fixed;inset:0;z-index:1100;background:rgba(13,31,23,.28);display:flex;justify-content:flex-end}.standard-drawer{width:min(760px,94vw);height:100%;background:#f7faf8;box-shadow:-20px 0 55px rgba(14,53,36,.2);display:flex;flex-direction:column;animation:drawer-in .24s ease}.drawer-head{background:#fff;padding:23px 27px;display:flex;justify-content:space-between;border-bottom:1px solid #e2ebe6}.drawer-head span,.section-title span{font-size:11px;font-weight:900;letter-spacing:.14em;color:#10975c}.drawer-head h3{margin:3px 0;font-size:24px}.drawer-head p{margin:0;color:#7e8a85}.drawer-head>button{border:0;background:#eef4f1;border-radius:11px;width:40px;height:40px;font-size:27px}.drawer-scroll{flex:1;overflow:auto;padding:22px 27px}.drawer-state{margin:auto;padding:70px;text-align:center;color:#7c8983}.drawer-state.error{color:#bd414b}.drawer-state button{display:block;margin:12px auto}.linked-goods-card{background:#fff;border:1px solid #dfe9e4;border-radius:14px;padding:18px}.card-title,.section-title{display:flex;justify-content:space-between;align-items:center}.card-title span{font-size:12px;color:#75827c}.card-title button,.section-title button{border:0;background:transparent;color:#07804a;font-weight:800}.linked-goods-card strong{display:block;font-size:18px;margin-top:11px}.linked-goods-card p{margin:4px 0 0;color:#7e8a85}.section-title{margin:25px 0 15px}.section-title h4{margin:2px 0;font-size:20px}.empty-standard{background:#fff;border:1px dashed #cadbd2;border-radius:15px;padding:48px;text-align:center}.empty-standard b{font-size:18px}.empty-standard p{color:#78857f}.empty-standard button{border:0;background:#109d5d;color:#fff;padding:10px 15px;border-radius:9px;font-weight:800}.requirement-groups{display:grid;gap:17px}.requirement-groups>section>header{display:flex;align-items:center;gap:8px;margin-bottom:8px}.requirement-groups h5{margin:0}.requirement-groups header span{font-size:12px;color:#85918c}.requirement-card{background:#fff;border:1px solid #dfe8e4;border-radius:13px;padding:16px;margin-bottom:9px}.requirement-text{display:flex;justify-content:space-between;gap:12px}.requirement-text span{white-space:nowrap;background:#fff2d6;color:#a36a08;border-radius:999px;padding:4px 8px;font-size:11px}.image-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:13px}.image-grid figure{margin:0;border-radius:10px;overflow:hidden;background:#f1f5f3;border:1px solid #dce6e1}.image-grid figure.prohibited{border-color:#e8aeb2;background:#fff2f3}.image-grid img{width:100%;height:120px;object-fit:cover;cursor:zoom-in}.image-grid figcaption{padding:8px;font-size:12px;font-weight:800}.image-grid figcaption small{display:block;font-weight:400;color:#7e8a85;margin-top:3px}.editor-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.editor-heading h4{margin:0}.editor-heading p{margin:3px 0;color:#7f8b86;font-size:13px}.editor-heading>button,.upload-button{border:0;background:#e4f6ec;color:#087c49;padding:9px 12px;border-radius:9px;font-weight:800;cursor:pointer}.upload-button input{display:none}.editor-empty{background:#fff;padding:24px;text-align:center;color:#83908a;border-radius:12px}.item-editor,.image-editor-card{background:#fff;border:1px solid #dfe8e4;border-radius:13px;padding:15px;margin-bottom:11px}.item-editor header{display:flex;justify-content:space-between}.item-editor header button,.remove-image{border:0;background:transparent;color:#c0444e}.item-editor label,.image-editor-card label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:800;color:#68746f;margin-top:11px}.item-editor input,.item-editor select,.image-editor-card input,.image-editor-card select{border:1px solid #cfddd6;border-radius:9px;padding:9px;background:#fff}.two-field{display:grid;grid-template-columns:1fr 1fr;gap:10px}.image-heading{margin-top:28px}.uploading{padding:10px;color:#09814d}.image-editor-list{display:grid;gap:11px}.image-editor-card{display:grid;grid-template-columns:150px 1fr;gap:14px}.image-editor-card>img{width:150px;height:150px;object-fit:cover;border-radius:10px}.remove-image{margin-top:12px;padding:0}.history-list{display:grid;gap:12px}.history-list article{background:#fff;border:1px solid #dfe8e4;border-radius:12px;padding:16px;display:grid;gap:5px}.history-list time{font-size:12px;color:#7d8984}.history-list p{margin:0;color:#7d8984}.relation-search{display:flex;gap:9px}.relation-search input{flex:1;border:1px solid #cedbd5;border-radius:10px;padding:11px}.relation-search button{border:0;background:#129e5e;color:#fff;border-radius:10px;padding:0 18px}.relation-list{display:grid;gap:9px;margin-top:15px}.relation-list button{border:1px solid #dce7e1;background:#fff;border-radius:11px;padding:14px;text-align:left;display:grid;grid-template-columns:1fr auto;gap:3px}.relation-list span{grid-column:1;color:#7c8983}.relation-list em{grid-column:2;grid-row:1/3;align-self:center;color:#07804a;font-style:normal}.drawer-actions{background:#fff;padding:15px 23px;border-top:1px solid #dfe8e3;display:flex;gap:9px;justify-content:flex-end}.drawer-actions>span{margin-right:auto;color:#c23f49;font-size:13px;align-self:center}.drawer-actions button{padding:10px 15px;border-radius:9px;font-weight:800}.drawer-actions .outline{background:#fff;border:1px solid #cedad4}.drawer-actions .primary{border:0;background:#109d5d;color:#fff}.drawer-actions button:disabled{opacity:.55}@keyframes drawer-in{from{transform:translateX(50px);opacity:.5}to{transform:none;opacity:1}}@media(max-width:650px){.two-field{grid-template-columns:1fr}.image-editor-card{grid-template-columns:1fr}.image-editor-card>img{width:100%}}
</style>
