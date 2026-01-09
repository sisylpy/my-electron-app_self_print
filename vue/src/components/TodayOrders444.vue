<template>
  <div class="saved-orders-tab"
       style="height: calc(100vh - 300px); overflow: hidden; display: flex; flex-direction: column;">
    <!-- 订单列表显示区域 -->
    <div class="order-list-container" style="flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden;">
      <!-- 无子部门的情况 -->
      <div v-if="!hasSubDepartments || !selectedSubDepartment" class="order-table-wrapper">
        <!-- 固定表头 -->
        <div class="table-header-fixed bg-light border-bottom p-2 d-flex align-items-center fw-bold small">
          <div style="width: 50px; flex-shrink: 0;" class="text-center table-cell">序号</div>
          <div style="width: 300px; flex-shrink: 0;" class="table-cell">商品名称</div>
          <div style="width: 100px; flex-shrink: 0;" class="text-center table-cell">订货</div>
          <div style="width: 100px; flex-shrink: 0;" class="text-center table-cell">出货</div>
          <div style="width: 120px; flex-shrink: 0;" class="text-center table-cell">单价</div>
          <div style="width: 120px; flex-shrink: 0;" class="text-end table-cell">小计</div>
          <div style="width: 80px; flex-shrink: 0;" class="text-center table-cell">操作</div>
        </div>
        <!-- 可滚动内容区域 -->
        <div class="order-list-scroll" style="flex: 1; min-height: 0; overflow-y: auto; background: red;">
        <div
            v-for="(order, index) in todayOrderList"
            :key="order.nxDepartmentOrdersId || index"
            class="order-item border-bottom p-2"
            :class="{
              'bg-white': order.nxDoPurchaseStatus == 4,
              'liziBack': order.nxDoPurchaseStatus != 4 && order.nxDoPurchaseStatus != 5 && order.nxDoPurchaseStatus != 3,
              'liziDelivery': order.nxDoPurchaseStatus == 5,
              'liziClock': order.nxDoPurchaseStatus == 3
            }">
          <div v-if="order.nxDoStatus > -2" class="d-flex align-items-center">
            <div style="width: 50px; flex-shrink: 0;" class="text-center fw-bold table-cell">{{ index + 1 }}</div>
            <div style="width: 300px; flex-shrink: 0;" class="table-cell">
              <div class="d-flex align-items-center flex-wrap" style="max-width: 300px;">
                <span v-if="order.nxDistributerGoodsEntity && order.nxDistributerGoodsEntity.nxDgGoodsBrand && order.nxDistributerGoodsEntity.nxDgGoodsBrand !== 'null'"
                      class="text-muted small me-1">
                  {{ order.nxDistributerGoodsEntity.nxDgGoodsBrand }}
                </span>
                <span class="fw-bold me-1">{{ order.nxDistributerGoodsEntity?.nxDgGoodsName || order.nxDoGoodsName }}</span>
                <span v-if="order.nxDepartmentDisGoodsEntity && order.nxDepartmentDisGoodsEntity.nxDdgOrderGoodsName !== order.nxDistributerGoodsEntity?.nxDgGoodsName && order.nxDepartmentDisGoodsEntity.nxDdgOrderGoodsName !== order.nxDoGoodsName"
                      class="text-muted small me-1">
                  ({{ order.nxDepartmentDisGoodsEntity.nxDdgOrderGoodsName }})
                </span>
                <span v-if="order.nxDoGoodsName && order.nxDoGoodsName !== order.nxDistributerGoodsEntity?.nxDgGoodsName"
                      class="text-muted small me-1">
                  ({{ order.nxDoGoodsName }})
                </span>
                <span v-if="order.nxDistributerGoodsEntity?.nxDgGoodsPlace && order.nxDistributerGoodsEntity.nxDgGoodsPlace !== 'null'"
                      class="text-muted small me-1">
                  ({{ order.nxDistributerGoodsEntity.nxDgGoodsPlace }})
                </span>
                <span v-if="order.nxDistributerGoodsEntity?.nxDgGoodsDetail && order.nxDistributerGoodsEntity.nxDgGoodsDetail !== 'null'"
                      class="text-muted small me-1">
                  {{ order.nxDistributerGoodsEntity.nxDgGoodsDetail }}
                </span>
                <span v-if="order.nxDistributerGoodsEntity?.nxDgGoodsStandardWeight && order.nxDistributerGoodsEntity.nxDgGoodsStandardWeight !== 'null'"
                      class="text-muted small me-1">
                  ({{ order.nxDistributerGoodsEntity.nxDgGoodsStandardname }}/{{ order.nxDistributerGoodsEntity.nxDgGoodsStandardWeight }})
                </span>
                <span v-if="order.nxDistributerGoodsEntity?.nxDgGoodsStandardname !== order.nxDoPrintStandard"
                      class="text-muted small me-1">
                  ({{ order.nxDoPrintStandard }})
                </span>
                <span v-if="order.nxDoRemark" class="text-danger small">({{ order.nxDoRemark }})</span>
              </div>
            </div>
            <div style="width: 100px; flex-shrink: 0;" class="text-center small table-cell">
              {{ order.nxDoQuantity }}{{ order.nxDoStandard }}
            </div>
            <div style="width: 100px; flex-shrink: 0;" class="text-center small table-cell">
              <span v-if="order.nxDoWeight !== null">{{ order.nxDoWeight }}{{ order.nxDoPrintStandard }}</span>
              <span v-else class="text-muted">-</span>
            </div>
            <div style="width: 120px; flex-shrink: 0;" class="text-center small table-cell">
              <span :class="{ 'text-danger': order.nxDoPrice == '0.1' || order.nxDoPrice == '' }">
                {{ order.nxDoPrice == 0.1 || order.nxDoPrice == '' ? '-' : order.nxDoPrice }}
              </span>
              <span class="text-muted">/{{ order.nxDoPrintStandard }}</span>
            </div>
            <div style="width: 120px; flex-shrink: 0;" class="text-end small table-cell">
              <span v-if="order.nxDoSubtotal !== null || order.nxDoSubtotal == ''">
                <span :class="{ 'text-danger': order.nxDoPrice == '0.1' || order.nxDoPrice == '' }">
                  {{ order.nxDoPrice == 0.1 || order.nxDoPrice == '' ? '-' : order.nxDoSubtotal }}
                </span>
                <span class="text-muted">元</span>
              </span>
              <span v-else class="text-muted">-</span>
            </div>
            <div style="width: 80px; flex-shrink: 0;" class="text-center table-cell">
              <button
                  v-if="order.nxDoStatus === -2"
                  class="btn btn-sm btn-danger"
                  @click="handleDeleteOrderDirect(order, index, 'list')"
                  title="删除">
                删除
              </button>
              <button
                    v-else-if="order.nxDoStatus !== 2"
                    class="btn btn-sm btn-secondary"
                    @click="handleOpenEditOrderModalDirect(order, index, 'dep', depIndex)"
                    title="修改">
                  修改
                </button>
            </div>
          </div>
          <div v-else class="d-flex align-items-center">
            <div style="width: 50px; flex-shrink: 0;" class="text-center fw-bold table-cell">{{ index + 1 }}</div>
            <div style="width: 300px; flex-shrink: 0;" class="table-cell">
              <span class="text-danger small me-2">(未完成)</span>
              <span class="me-2">{{ order.nxDoGoodsName }}</span>
              <span v-if="order.nxDoRemark" class="text-danger small">({{ order.nxDoRemark }})</span>
            </div>
            <div style="width: 100px; flex-shrink: 0;" class="text-center small table-cell">
              {{ order.nxDoQuantity }}{{ order.nxDoStandard }}
            </div>
            <div style="width: 100px; flex-shrink: 0;" class="text-center small text-muted table-cell">-</div>
            <div style="width: 120px; flex-shrink: 0;" class="text-center small text-muted table-cell">-</div>
            <div style="width: 120px; flex-shrink: 0;" class="text-end small text-muted table-cell">-</div>
            <div style="width: 80px; flex-shrink: 0;" class="text-center table-cell">
              <button
                  class="btn btn-sm btn-danger"
                  @click="handleDeleteOrderDirect(order, index, 'list')"
                  title="删除">
                删除
              </button>
            </div>
          </div>
        </div>
        <div v-if="todayOrderList.length === 0" class="text-center p-5 text-muted">
          暂无已保存的订单
        </div>
        </div>
      </div>

      <!-- 有子部门的情况 -->
      <div v-else>
        <div v-for="(dep, depIndex) in filteredTodayOrderDepArr"
             :key="dep.depId || depIndex" class="mb-3 order-table-wrapper">
          <div class="d-flex justify-content-between align-items-center p-2 bg-light border-bottom">
            <span class="text-primary fw-bold">#{{ dep.depName }}</span>
            <span class="text-muted">¥:{{ dep.depSubtotal }}元</span>
          </div>
          <!-- 固定表头 -->
          <div class="table-header-fixed bg-light border-bottom p-2 d-flex align-items-center fw-bold small">
            <div style="width: 50px; flex-shrink: 0;" class="text-center table-cell">序号</div>
            <div style="width: 300px; flex-shrink: 0;" class="table-cell">商品名称</div>
            <div style="width: 100px; flex-shrink: 0;" class="text-center table-cell">订货</div>
            <div style="width: 100px; flex-shrink: 0;" class="text-center table-cell">出货</div>
            <div style="width: 120px; flex-shrink: 0;" class="text-center table-cell">单价</div>
            <div style="width: 120px; flex-shrink: 0;" class="text-end table-cell">小计</div>
            <div style="width: 80px; flex-shrink: 0;" class="text-center table-cell">操作</div>
          </div>
          <!-- 可滚动内容区域 -->
          <div class="order-list-scroll" style="max-height: 400px; overflow-y: auto;">
          <div
              v-for="(order, index) in dep.depOrders"
              :key="order.nxDepartmentOrdersId || index"
              class="order-item border-bottom p-2"
              :class="{
                'bg-white': order.nxDoPurchaseStatus == 4,
                'liziBack': order.nxDoPurchaseStatus != 4 && order.nxDoPurchaseStatus != 5 && order.nxDoPurchaseStatus != 3,
                'liziDelivery': order.nxDoPurchaseStatus == 5,
                'liziClock': order.nxDoPurchaseStatus == 3
              }">
            <div v-if="order.nxDoStatus > -2" class="d-flex align-items-center">
              <div style="width: 50px; flex-shrink: 0;" class="text-center fw-bold table-cell">{{ index + 1 }}</div>
              <div style="width: 300px; flex-shrink: 0;" class="table-cell">
                <div class="d-flex align-items-center flex-wrap" style="max-width: 300px;">
                  <span v-if="order.nxDistributerGoodsEntity && order.nxDistributerGoodsEntity.nxDgGoodsBrand && order.nxDistributerGoodsEntity.nxDgGoodsBrand !== 'null'"
                        class="text-muted small me-1">
                    {{ order.nxDistributerGoodsEntity.nxDgGoodsBrand }}
                  </span>
                  <span class="fw-bold me-1">{{ order.nxDistributerGoodsEntity?.nxDgGoodsName || order.nxDoGoodsName }}</span>
                  <span v-if="order.nxDepartmentDisGoodsEntity && order.nxDepartmentDisGoodsEntity.nxDdgOrderGoodsName !== order.nxDistributerGoodsEntity?.nxDgGoodsName"
                        class="text-muted small me-1">
                    ({{ order.nxDepartmentDisGoodsEntity.nxDdgOrderGoodsName }})
                  </span>
                  <span v-if="order.nxDoGoodsName && order.nxDoGoodsName !== order.nxDistributerGoodsEntity?.nxDgGoodsName"
                        class="text-muted small me-1">
                    ({{ order.nxDoGoodsName }})
                  </span>
                  <span v-if="order.nxDistributerGoodsEntity?.nxDgGoodsPlace && order.nxDistributerGoodsEntity.nxDgGoodsPlace !== 'null'"
                        class="text-muted small me-1">
                    ({{ order.nxDistributerGoodsEntity.nxDgGoodsPlace }})
                  </span>
                  <span v-if="order.nxDistributerGoodsEntity?.nxDgGoodsDetail && order.nxDistributerGoodsEntity.nxDgGoodsDetail !== 'null'"
                        class="text-muted small me-1">
                    {{ order.nxDistributerGoodsEntity.nxDgGoodsDetail }}
                  </span>
                  <span v-if="order.nxDistributerGoodsEntity?.nxDgGoodsStandardWeight && order.nxDistributerGoodsEntity.nxDgGoodsStandardWeight !== 'null'"
                        class="text-muted small me-1">
                    ({{ order.nxDistributerGoodsEntity.nxDgGoodsStandardname }}/{{ order.nxDistributerGoodsEntity.nxDgGoodsStandardWeight }})
                  </span>
                  <span v-if="order.nxDistributerGoodsEntity?.nxDgGoodsStandardname !== order.nxDoPrintStandard"
                        class="text-muted small me-1">
                    ({{ order.nxDoPrintStandard }})
                  </span>
                  <span v-if="order.nxDoRemark" class="text-danger small">({{ order.nxDoRemark }})</span>
                </div>
              </div>
              <div style="width: 100px; flex-shrink: 0;" class="text-center small table-cell">{{ order.nxDoQuantity }}{{ order.nxDoStandard }}</div>
              <div style="width: 100px; flex-shrink: 0;" class="text-center small table-cell">
                <span v-if="order.nxDoWeight !== null"
                      :class="{ 'text-danger': order.nxDoWeight == '' }">
                  {{ order.nxDoWeight == '' ? '-' : order.nxDoWeight }}{{ order.nxDoPrintStandard }}
                </span>
                <span v-else class="text-muted">-</span>
              </div>
              <div style="width: 120px; flex-shrink: 0;" class="text-center small table-cell">
                <span :class="{ 'text-danger': order.nxDoPrice == '0.1' || order.nxDoPrice == '' }">
                  {{ order.nxDoPrice == 0.1 || order.nxDoPrice == '' ? '-' : order.nxDoPrice }}
                </span>
                <span class="text-muted">/{{ order.nxDoPrintStandard }}</span>
              </div>
              <div style="width: 120px; flex-shrink: 0;" class="text-end small table-cell">
                <span v-if="order.nxDoSubtotal !== null || order.nxDoSubtotal == ''">
                  <span :class="{ 'text-danger': order.nxDoPrice == '0.1' || order.nxDoPrice == '' }">
                    {{ order.nxDoPrice == 0.1 || order.nxDoPrice == '' ? '-' : order.nxDoSubtotal }}
                  </span>
                  <span class="text-muted">元</span>
                </span>
                <span v-else class="text-muted">-</span>
              </div>
              <div style="width: 80px; flex-shrink: 0;" class="text-center table-cell">
                <button
                    v-if="order.nxDoStatus === -2"
                    class="btn btn-sm btn-danger"
                    @click="handleDeleteOrderDirect(order, index, 'dep', depIndex)"
                    title="删除">
                  删除
                </button>
                <button
                    v-else-if="order.nxDoStatus !== 2"
                    class="btn btn-sm btn-secondary"
                    @click="handleOpenEditOrderModalDirect(order, index, 'dep', depIndex)"
                    title="修改">
                  修改
                </button>
              </div>
            </div>
            <div v-else class="d-flex align-items-center">
              <div style="width: 50px; flex-shrink: 0;" class="text-center fw-bold table-cell">{{ index + 1 }}</div>
              <div style="width: 300px; flex-shrink: 0;" class="table-cell">
                <span class="text-danger small me-2">(未完成)</span>
                <span class="me-2">{{ order.nxDoGoodsName }}</span>
                <span v-if="order.nxDoRemark" class="text-danger small">({{ order.nxDoRemark }})</span>
              </div>
              <div style="width: 100px; flex-shrink: 0;" class="text-center small table-cell">{{ order.nxDoQuantity }}{{ order.nxDoStandard }}</div>
              <div style="width: 100px; flex-shrink: 0;" class="text-center small text-muted table-cell">-</div>
              <div style="width: 120px; flex-shrink: 0;" class="text-center small text-muted table-cell">-</div>
              <div style="width: 120px; flex-shrink: 0;" class="text-end small text-muted table-cell">-</div>
              <div style="width: 80px; flex-shrink: 0;" class="text-center table-cell">
                <button
                    class="btn btn-sm btn-danger"
                    @click="handleDeleteOrderDirect(order, index, 'dep', depIndex)"
                    title="删除">
                  删除
                </button>
              </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="filteredTodayOrderDepArr.length === 0" class="text-center p-5 text-muted">
          暂无已保存的订单
        </div>
      </div>
    </div>

    <!-- 修改订单弹窗 -->
    <div v-if="showEditOrderModal" class="order-edit-overlay" @click.self="closeEditOrderModal">
      <div class="order-edit-popup">
        <!-- 顶部商品名称 -->
        <div class="popup-header text-center p-3 bg-light border-bottom">
          <div class="d-flex align-items-center justify-content-center flex-wrap mb-2">
            <span v-if="currentEditOrderItem?.nxDistributerGoodsEntity?.nxDgGoodsBrand && currentEditOrderItem.nxDistributerGoodsEntity.nxDgGoodsBrand !== 'null'"
                  class="brand me-2">
              {{ currentEditOrderItem.nxDistributerGoodsEntity.nxDgGoodsBrand }}
            </span>
            <span class="fw-bold">{{ currentEditOrderItem?.nxDistributerGoodsEntity?.nxDgGoodsName || currentEditOrderItem?.nxDoGoodsName || '商品名称' }}</span>
          </div>
          <div v-if="currentEditOrderItem?.nxDistributerGoodsEntity" class="small text-muted">
            <span v-if="currentEditOrderItem.nxDistributerGoodsEntity.nxDgGoodsDetail && currentEditOrderItem.nxDistributerGoodsEntity.nxDgGoodsDetail !== 'null'">
              {{ currentEditOrderItem.nxDistributerGoodsEntity.nxDgGoodsDetail }}
            </span>
            <span v-if="currentEditOrderItem.nxDistributerGoodsEntity.nxDgGoodsStandardWeight && currentEditOrderItem.nxDistributerGoodsEntity.nxDgGoodsStandardWeight !== 'null'">
              ({{ currentEditOrderItem.nxDistributerGoodsEntity.nxDgGoodsStandardname }}/{{ currentEditOrderItem.nxDistributerGoodsEntity.nxDgGoodsStandardWeight }})
            </span>
            <span v-else-if="currentEditOrderItem.nxDistributerGoodsEntity.nxDgGoodsStandardname">
              ({{ currentEditOrderItem.nxDistributerGoodsEntity.nxDgGoodsStandardname }})
            </span>
          </div>
        </div>

        <!-- 输入内容 -->
        <div class="popup-body p-3">
          <!-- 订货数量 -->
          <div class="input-group mb-3 d-flex align-items-center justify-content-between">
            <label class="form-label mb-0 me-3">订货数量:</label>
            <input
                type="number"
                class="form-control form-control-sm"
                v-model="editOrderForm.quantity"
                style="width: 200px;"
                placeholder="请输入数量"
            />
          </div>

          <!-- 单位 -->
          <div class="input-group mb-3 d-flex align-items-start justify-content-between">
            <label class="form-label mb-0 me-3" style="flex-shrink: 0;">单位:</label>
            <div style="flex: 1;">
              <div class="d-flex flex-wrap gap-2">
                <!-- 商品的标准单位 -->
              <button
                    v-if="itemDis && itemDis.nxDgGoodsStandardname"
                    class="btn btn-sm standard-btn"
                    :class="editOrderForm.standard === itemDis.nxDgGoodsStandardname ? 'btn-primary' : 'btn-outline-secondary'"
                    @click="editOrderForm.standard = itemDis.nxDgGoodsStandardname">
                  {{ itemDis.nxDgGoodsStandardname }}
                </button>
              <!-- 商品的规格列表 -->
              <button
                  v-for="standard in (itemDis && itemDis.nxDistributerStandardEntities ? itemDis.nxDistributerStandardEntities : [])"
                  :key="standard.nxDistributerStandardId"
                  class="btn btn-sm standard-btn"
                  :class="editOrderForm.standard === standard.nxDsStandardName ? 'btn-primary' : 'btn-outline-secondary'"
                  @click="handleStandardClick(standard)"
                  @mousedown="startLongPress($event, standard)"
                  @mouseup="endLongPress"
                  @mouseleave="endLongPress"
                  @touchstart="startLongPress($event, standard)"
                  @touchend="endLongPress"
                  @touchcancel="endLongPress"
                  :title="'长按删除规格: ' + standard.nxDsStandardName">
                {{ standard.nxDsStandardName }}
              </button>
                <!-- 添加规格按钮 -->
                <button
                    v-if="!showAddStandard && itemDis && itemDis.nxDistributerGoodsId"
                    class="btn btn-sm btn-outline-secondary standard-btn"
                    @click="showAddStandard = true">
                  +
              </button>
              </div>
              <!-- 添加规格输入框 -->
              <div v-if="showAddStandard" class="d-flex align-items-center gap-2 mt-2">
                <input
                    type="text"
                    class="form-control form-control-sm"
                    v-model="newStandardName"
                    @focus="focusType = 'standard'"
                    @blur="focusType = ''"
                    placeholder="请输入规格名称"
                    style="flex: 1; max-width: 200px;"
                />
                <button class="btn btn-sm btn-outline-secondary" @click="cancelAddStandard">取消</button>
                <button class="btn btn-sm btn-primary" @click="confirmAddStandard">保存</button>
              </div>
            </div>
          </div>

          <!-- 备注 -->
          <div class="input-group mb-3 d-flex align-items-center justify-content-between">
            <label class="form-label mb-0 me-3">备注:</label>
            <input
                type="text"
                class="form-control form-control-sm"
                v-model="editOrderForm.remark"
                style="width: 300px;"
                placeholder="请输入备注（最多15个字符）"
                maxlength="15"
            />
          </div>
        </div>

        <!-- 按钮组 -->
        <div class="popup-footer d-flex gap-2 p-3 border-top bg-light">
          <button 
              class="btn btn-sm btn-danger" 
              @click="handleDeleteOrderFromEditModal"
              style="flex: 0 0 auto; width: 80px; margin-right: 10px;">
            删除
          </button>
          <button 
              class="btn btn-sm btn-secondary" 
              @click="closeEditOrderModal"
              style="flex: 0 0 auto; width: 80px; margin-right: 10px;">
            取消
          </button>
          <button 
              class="btn btn-sm btn-success" 
              @click="handleSaveEditOrder"
              style="flex: 0 0 auto; width: 160px;">
            保存
          </button>
        </div>
      </div>
    </div>

    <!-- 底部总计 -->
    <div v-if="todayOrderTotal > 0" class="border-top p-3 bg-light">
      <div class="d-flex justify-content-between align-items-center">
        <span>总计:</span>
        <span class="fw-bold fs-5">{{ todayOrderTotal }}元</span>
      </div>
    </div>
  </div>
</template>

<script>
import api from '../api/all';

export default {
  name: 'TodayOrders',
  props: {
    todayOrderList: {
      type: Array,
      default: () => []
    },
    todayOrderDepArr: {
      type: Array,
      default: () => []
    },
    hasSubDepartments: {
      type: Boolean,
      default: false
    },
    selectedSubDepartment: {
      type: [String, Number],
      default: null
    },
    todayOrderTotal: {
      type: Number,
      default: 0
    },
    selectedAllCustomer: {
      type: [String, Number],
      default: null
    }
  },
  emits: ['order-updated', 'order-deleted'],
  data() {
    return {
      showEditOrderModal: false,
      currentEditOrderItem: null,
      currentEditOrderIndex: -1,
      currentEditOrderType: '',
      currentEditOrderDepIndex: -1,
      itemDis: null, // 商品的完整信息（包含规格列表）
      showAddStandard: false, // 是否显示添加规格输入框
      newStandardName: '', // 新规格名称
      focusType: '', // 当前聚焦的输入框类型
      longPressTimer: null, // 长按定时器
      longPressTarget: null, // 长按目标规格
      isLongPress: false, // 是否正在长按
      editOrderForm: {
        quantity: '',
        standard: '',
        remark: ''
      }
    }
  },
  computed: {
    filteredTodayOrderDepArr() {
      if (!this.hasSubDepartments || !this.selectedSubDepartment) {
        return this.todayOrderDepArr;
      }
      return this.todayOrderDepArr.filter(dep => {
        return String(dep.depId) === String(this.selectedSubDepartment) ||
            String(dep.depFatherId) === String(this.selectedSubDepartment);
      });
    }
    },
  methods: {
    handleOpenEditOrderModal() {
      if (!this.currentEditOrderItem) {
        return;
      }
      this.loadGoodsInfoAndOpenModal();
    },
    handleOpenEditOrderModalDirect(order, index, type, depIndex = -1) {
      this.currentEditOrderItem = order;
      this.currentEditOrderIndex = index;
      this.currentEditOrderType = type;
      this.currentEditOrderDepIndex = depIndex;
      this.loadGoodsInfoAndOpenModal();
    },
    // 加载商品信息并打开编辑弹窗
    async loadGoodsInfoAndOpenModal() {
      if (!this.currentEditOrderItem) {
        return;
      }
      
      // 初始化表单
      this.editOrderForm = {
        quantity: this.currentEditOrderItem.nxDoQuantity || '',
        standard: this.currentEditOrderItem.nxDoStandard || this.currentEditOrderItem.nxDoPrintStandard || '',
        remark: this.currentEditOrderItem.nxDoRemark || ''
      };
      
      // 如果有商品ID，获取完整的商品信息（包含规格列表）
      const goodsId = this.currentEditOrderItem.nxDoDisGoodsId;
      if (goodsId) {
        try {
          this.$store.commit('SET_LOADING', true);
          const res = await api.disGetGoods(goodsId);
          
          if (res && res.data && res.data.code === 0 && res.data.data) {
            this.itemDis = res.data.data;
          } else {
            // 如果获取失败，使用原有的商品信息
            this.itemDis = this.currentEditOrderItem.nxDistributerGoodsEntity || null;
          }
        } catch (error) {
          console.error('获取商品信息失败:', error);
          // 失败时使用原有的商品信息
          this.itemDis = this.currentEditOrderItem.nxDistributerGoodsEntity || null;
        } finally {
          this.$store.commit('SET_LOADING', false);
        }
      } else {
        // 没有商品ID，使用原有的商品信息
        this.itemDis = this.currentEditOrderItem.nxDistributerGoodsEntity || null;
      }
      
      this.showEditOrderModal = true;
      this.showAddStandard = false;
      this.newStandardName = '';
    },
    handleDeleteOrderDirect(order, index, type, depIndex = -1) {
      this.currentEditOrderItem = order;
      this.currentEditOrderIndex = index;
      this.currentEditOrderType = type;
      this.currentEditOrderDepIndex = depIndex;
      
      // 如果 nxDoStatus = -2，弹出提示窗口
      if (order.nxDoStatus === -2) {
        if (!confirm(`确定要删除未完成的订单 "${order.nxDoGoodsName || '该订单'}" 吗？\n\n注意：此订单尚未完成，删除后将无法恢复。`)) {
          return;
        }
      }
      
      this.handleDeleteOrder();
    },
    handleDeleteOrderFromEditModal() {
      if (!this.currentEditOrderItem) {
        return;
      }
      
      if (!confirm(`确定要删除订单 "${this.currentEditOrderItem.nxDistributerGoodsEntity?.nxDgGoodsName || this.currentEditOrderItem.nxDoGoodsName}" 吗？`)) {
        return;
      }
      
      this.handleDeleteOrder();
    },
    closeEditOrderModal() {
      this.showEditOrderModal = false;
      this.currentEditOrderItem = null;
      this.currentEditOrderIndex = -1;
      this.currentEditOrderType = '';
      this.currentEditOrderDepIndex = -1;
      this.itemDis = null;
      this.showAddStandard = false;
      this.newStandardName = '';
      this.focusType = '';
      // 清除长按定时器
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
      this.longPressTarget = null;
      this.editOrderForm = {
        quantity: '',
        standard: '',
        remark: ''
      };
    },
    // 取消添加规格
    cancelAddStandard() {
      this.showAddStandard = false;
      this.newStandardName = '';
    },
    // 确认添加规格
    async confirmAddStandard() {
      if (!this.itemDis || !this.itemDis.nxDistributerGoodsId) {
        alert('商品信息错误');
        return;
      }
      
      if (!this.newStandardName || !this.newStandardName.trim()) {
        alert('请输入规格名称');
        return;
      }
      
      try {
        this.$store.commit('SET_LOADING', true);
        
        const data = {
          nxDsDisGoodsId: this.itemDis.nxDistributerGoodsId,
          nxDsStandardName: this.newStandardName.trim(),
        };
        
        console.log('🟢 confirmAddStandard 准备发送的数据:', data);
        console.log('🟢 itemDis:', this.itemDis);
        console.log('🟢 nxDistributerGoodsId:', this.itemDis?.nxDistributerGoodsId);
        console.log('🟢 newStandardName:', this.newStandardName);
        
        const res = await api.disSaveStandard(data);
        
        console.log('🟢 confirmAddStandard 响应:', res);
        
        if (res && res.data && res.data.code === 0) {
          // 更新 itemDis 的规格列表
          if (!this.itemDis.nxDistributerStandardEntities) {
            this.itemDis.nxDistributerStandardEntities = [];
          }
          this.itemDis.nxDistributerStandardEntities.push(res.data.data);
          // 自动选择新添加的规格
          this.editOrderForm.standard = res.data.data.nxDsStandardName;
          this.showAddStandard = false;
          this.newStandardName = '';
          
          alert('添加规格成功');
        } else {
          alert(res?.data?.msg || '添加规格失败');
        }
      } catch (error) {
        console.error('添加规格失败:', error);
        alert('添加规格失败，请检查网络');
      } finally {
        this.$store.commit('SET_LOADING', false);
      }
    },
    // 开始长按
    startLongPress(event, standard) {
      this.longPressTarget = standard;
      // 设置长按定时器，500ms 后触发删除
      this.longPressTimer = setTimeout(() => {
        // 长按时间达到，触发删除
        this.handleDeleteStandard(standard);
        this.longPressTimer = null;
        this.longPressTarget = null;
        // 标记为长按，阻止后续的点击事件
        this.isLongPress = true;
        // 清除标记，避免影响下次操作
        setTimeout(() => {
          this.isLongPress = false;
        }, 100);
      }, 500);
    },
    // 结束长按
    endLongPress() {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
        this.longPressTarget = null;
      }
    },
    // 处理规格点击（区分点击和长按）
    handleStandardClick(standard) {
      // 如果是长按触发的，不执行点击操作
      if (this.isLongPress) {
        return;
      }
      // 正常点击，选择规格
      this.editOrderForm.standard = standard.nxDsStandardName;
    },
    // 删除规格（长按触发）
    async handleDeleteStandard(standard) {
      if (!standard || !standard.nxDistributerStandardId) {
        return;
      }
      
      if (!confirm(`确定要删除规格 "${standard.nxDsStandardName}" 吗？`)) {
        return;
      }
      
      try {
        this.$store.commit('SET_LOADING', true);
        
        const res = await api.disDeleteStandard(standard.nxDistributerStandardId);
        
        if (res && res.data && res.data.code === 0) {
          // 更新 itemDis 为接口返回的最新数据
          this.itemDis = res.data.data;
          // 如果删除的规格是当前选中的，清空选择
          if (this.editOrderForm.standard === standard.nxDsStandardName) {
            this.editOrderForm.standard = '';
          }
          
          alert('删除成功');
        } else {
          alert(res?.data?.msg || '删除失败');
        }
      } catch (error) {
        console.error('删除规格失败:', error);
        alert('删除失败，请检查网络');
      } finally {
        this.$store.commit('SET_LOADING', false);
      }
    },
    // 保存编辑订单
    async handleSaveEditOrder() {
      if (!this.currentEditOrderItem || !this.currentEditOrderItem.nxDepartmentOrdersId) {
        alert('订单信息错误');
        return;
      }

      if (!this.editOrderForm.quantity || parseFloat(this.editOrderForm.quantity) <= 0) {
        alert('请输入有效的订货数量');
        return;
      }

      if (!this.editOrderForm.standard) {
        alert('请选择单位');
        return;
      }

      if (this.editOrderForm.remark && this.editOrderForm.remark.length > 15) {
        alert('备注最多15个字符');
        return;
      }

      try {
        this.$store.commit('SET_LOADING', true);

        const updateData = {
          id: this.currentEditOrderItem.nxDepartmentOrdersId,
          weight: this.editOrderForm.quantity,
          standard: this.editOrderForm.standard,
          remark: this.editOrderForm.remark || '',
          printStandard: this.editOrderForm.standard,
          priceLevel: this.currentEditOrderItem.nxDoPriceLevel || 1
        };

        const res = await api.updateOrder(updateData);

        if (res && res.data && res.data.code === 0) {
          // 更新缓存中的订单
          const orderId = this.currentEditOrderItem.nxDepartmentOrdersId;
          const updatedOrderData = {
            nxDoQuantity: parseFloat(this.editOrderForm.quantity),
            nxDoStandard: this.editOrderForm.standard,
            nxDoPrintStandard: this.editOrderForm.standard,
            nxDoRemark: this.editOrderForm.remark || '',
            // 保留原有订单的其他字段
            ...this.currentEditOrderItem
          };
          this.updateOrderInCache(orderId, updatedOrderData);
          
          alert('修改成功');
          this.closeEditOrderModal();
          // 通知父组件刷新数据
          this.$emit('order-updated');
        } else {
          alert(res?.data?.msg || '修改失败');
        }
      } catch (error) {
        console.error('修改订单失败:', error);
        alert('修改失败，请检查网络');
      } finally {
        this.$store.commit('SET_LOADING', false);
      }
    },
    
    // 更新缓存中的订单
    updateOrderInCache(orderId, updatedData) {
      if (!orderId || !this.selectedAllCustomer) {
        return;
      }

      // 所有可能的缓存类型
      const cacheTypes = ['paste', 'excel', 'image', 'auto'];
      let updatedCount = 0;
      
      cacheTypes.forEach(sourceType => {
        const storageKey = `ocrOrderDepList_${sourceType}`;
        
        try {
          const ocrOrderDepListStr = localStorage.getItem(storageKey);
          if (!ocrOrderDepListStr) {
            console.log(`🟡 ${sourceType} 缓存不存在`);
            return;
          }

          let ocrOrderDepList = JSON.parse(ocrOrderDepListStr);
          if (!Array.isArray(ocrOrderDepList)) {
            console.log(`🟡 ${sourceType} 缓存格式不正确`);
            return;
          }

          console.log(`🟡 ${sourceType} 缓存存在，部门数量:`, ocrOrderDepList.length);
          
          // 查找当前部门的缓存
          // 打印缓存中所有部门的ID，用于调试
          console.log(`🟡 ${sourceType} 缓存中所有部门的ID:`, 
            ocrOrderDepList.map(item => ({
              depId: item.depId,
              depFatherId: item.depFatherId,
              depName: item.depName
            }))
          );
          console.log(`🟡 当前要查找的 selectedAllCustomer:`, this.selectedAllCustomer);
          
          const depIndex = ocrOrderDepList.findIndex(item => {
            const itemDepIdStr = String(item.depId);
            const itemDepFatherIdStr = String(item.depFatherId || '');
            const selectedDepIdStr = String(this.selectedAllCustomer);
            // 匹配 depId 或 depFatherId（因为缓存可能存储的是父部门ID或子部门ID）
            const match = itemDepIdStr === selectedDepIdStr || 
                   itemDepFatherIdStr === selectedDepIdStr ||
                   item.depId == this.selectedAllCustomer ||
                   item.depFatherId == this.selectedAllCustomer;
            
            if (match) {
              console.log(`🟡 ${sourceType} 缓存中找到匹配的部门:`, {
                depId: item.depId,
                depFatherId: item.depFatherId,
                depName: item.depName
              });
            }
            
            return match;
          });

          if (depIndex >= 0) {
            const depCache = ocrOrderDepList[depIndex];
            if (depCache.arr && Array.isArray(depCache.arr)) {
              // 查找并更新订单
              // 先尝试通过 nxDepartmentOrdersId 匹配（支持类型转换）
              let orderIndex = depCache.arr.findIndex(order => {
                const orderIdValue = order.nxDepartmentOrdersId;
                return orderIdValue === orderId || 
                       String(orderIdValue) === String(orderId) ||
                       Number(orderIdValue) === Number(orderId);
              });

              // 如果通过 ID 找不到，尝试通过商品名称匹配（不依赖数量，因为数量可能已经改变）
              if (orderIndex === -1 && this.currentEditOrderItem) {
                const originalGoodsName = this.currentEditOrderItem.nxDoGoodsName || 
                                         this.currentEditOrderItem.nxDistributerGoodsEntity?.nxDgGoodsName;
                
                // 通过商品名称匹配，如果有多个匹配的，优先选择有相同ID的，否则选择第一个
                const matchingOrders = depCache.arr
                  .map((order, idx) => {
                    const orderGoodsName = order.nxDoGoodsName || 
                                         order.nxDistributerGoodsEntity?.nxDgGoodsName;
                    if (orderGoodsName === originalGoodsName) {
                      return { order, index: idx };
                    }
                    return null;
                  })
                  .filter(item => item !== null);
                
                if (matchingOrders.length > 0) {
                  // 优先选择有相同ID的订单
                  const exactMatch = matchingOrders.find(item => 
                    String(item.order.nxDepartmentOrdersId) === String(orderId)
                  );
                  orderIndex = exactMatch ? exactMatch.index : matchingOrders[0].index;
                }
              }

              if (orderIndex >= 0) {
                // 更新订单信息
                const order = depCache.arr[orderIndex];
                
                depCache.arr[orderIndex] = {
                  ...order,
                  ...updatedData,
                  // 确保保留原有的重要字段
                  nxDepartmentOrdersId: order.nxDepartmentOrdersId,
                  nxDoDisGoodsId: order.nxDoDisGoodsId || updatedData.nxDoDisGoodsId,
                  nxDistributerGoodsEntity: order.nxDistributerGoodsEntity || updatedData.nxDistributerGoodsEntity
                };

                // 更新缓存
                ocrOrderDepList[depIndex] = depCache;
                localStorage.setItem(storageKey, JSON.stringify(ocrOrderDepList));
                console.log(`✅ 已更新 ${sourceType} 缓存中的订单 ${orderId}`);
                updatedCount++;
                
                // 触发自定义事件，通知 PlaceOrder 组件刷新缓存
                window.dispatchEvent(new CustomEvent('cache-updated', {
                  detail: {
                    sourceType: sourceType,
                    depId: this.selectedAllCustomer,
                    orderId: orderId
                  }
                }));
              }
            }
          }
        } catch (error) {
          console.error(`❌ 更新 ${sourceType} 缓存中的订单失败:`, error);
        }
      });
      
      if (updatedCount > 0) {
        console.log(`✅ 缓存更新完成，共更新 ${updatedCount} 个缓存`);
      }
    },
    // 从缓存中删除订单
    deleteOrderFromCache(orderId) {
      if (!orderId || !this.selectedAllCustomer) {
        return;
      }

      // 所有可能的缓存类型
      const cacheTypes = ['paste', 'excel', 'image', 'auto'];
      
      cacheTypes.forEach(sourceType => {
        const storageKey = `ocrOrderDepList_${sourceType}`;
        
        try {
          const ocrOrderDepListStr = localStorage.getItem(storageKey);
          if (!ocrOrderDepListStr) {
            return;
          }

          let ocrOrderDepList = JSON.parse(ocrOrderDepListStr);
          if (!Array.isArray(ocrOrderDepList)) {
            return;
          }

          // 查找当前部门的缓存
          const depIndex = ocrOrderDepList.findIndex(item => {
            const itemDepIdStr = String(item.depId);
            const itemDepFatherIdStr = String(item.depFatherId || '');
            const selectedDepIdStr = String(this.selectedAllCustomer);
            // 匹配 depId 或 depFatherId（因为缓存可能存储的是父部门ID或子部门ID）
            return itemDepIdStr === selectedDepIdStr || 
                   itemDepFatherIdStr === selectedDepIdStr ||
                   item.depId == this.selectedAllCustomer ||
                   item.depFatherId == this.selectedAllCustomer;
          });

          if (depIndex >= 0) {
            const depCache = ocrOrderDepList[depIndex];
            if (depCache.arr && Array.isArray(depCache.arr)) {
              // 从订单数组中删除该订单
              const originalLength = depCache.arr.length;
              depCache.arr = depCache.arr.filter(order => {
                return order.nxDepartmentOrdersId !== orderId;
              });

              // 如果订单被删除了，更新缓存
              if (depCache.arr.length < originalLength) {
                console.log(`从 ${sourceType} 缓存中删除订单 ${orderId}`);
                
                // 如果删除后没有订单了，删除该部门的缓存项
                if (depCache.arr.length === 0) {
                  ocrOrderDepList.splice(depIndex, 1);
                  
                  // 如果整个缓存列表都空了，删除整个缓存
                  if (ocrOrderDepList.length === 0) {
                    localStorage.removeItem(storageKey);
                    console.log(`已删除整个 ${sourceType} 缓存`);
                  } else {
                    localStorage.setItem(storageKey, JSON.stringify(ocrOrderDepList));
                    console.log(`已从 ${sourceType} 缓存中删除该部门的缓存项`);
                  }
                } else {
                  // 更新缓存
                  ocrOrderDepList[depIndex] = depCache;
                  localStorage.setItem(storageKey, JSON.stringify(ocrOrderDepList));
                  console.log(`已更新 ${sourceType} 缓存，删除订单 ${orderId}`);
                }
                
                // 触发自定义事件，通知 PlaceOrder 组件刷新缓存
                window.dispatchEvent(new CustomEvent('cache-updated', {
                  detail: {
                    sourceType: sourceType,
                    depId: this.selectedAllCustomer,
                    orderId: orderId,
                    action: 'delete'
                  }
                }));
              }
            }
          }
        } catch (error) {
          console.error(`删除 ${sourceType} 缓存中的订单失败:`, error);
        }
      });
    },
    // 删除订单
    async handleDeleteOrder() {
      if (!this.currentEditOrderItem) {
        return;
      }

      if (!this.currentEditOrderItem.nxDepartmentOrdersId) {
        alert('订单信息错误，无法删除');
        this.closeEditOrderModal();
        return;
      }

      const orderId = this.currentEditOrderItem.nxDepartmentOrdersId;

      try {
        this.$store.commit('SET_LOADING', true);

        const res = await api.deleteOrder(orderId);

        if (res && res.data && res.data.code === 0) {
          // 从缓存中删除订单
          this.deleteOrderFromCache(orderId);
          
          alert('删除成功');
          this.closeEditOrderModal();
          // 通知父组件刷新数据
          this.$emit('order-deleted');
        } else {
          alert(res?.data?.msg || '删除失败');
        }
      } catch (error) {
        console.error('删除订单失败:', error);
        alert('删除失败，请检查网络');
      } finally {
        this.$store.commit('SET_LOADING', false);
      }
    }
  }
}
</script>

<style scoped>
.order-edit-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1050;
  display: flex;
  align-items: center;
  justify-content: center;
}

.order-edit-popup {
  background: white;
  border-radius: 8px;
  min-width: 500px;
  max-width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.liziBack {
  background-color: #fff3cd;
}

.liziDelivery {
  background-color: #d1ecf1;
}

.liziClock {
  background-color: #f8d7da;
}

/* 表格美化样式 */
.order-table-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.table-header-fixed {
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: #f8f9fa !important;
}

.table-cell {
  border-right: 1px solid #dee2e6;
  padding: 0 8px;
}

.table-cell:last-child {
  border-right: none;
}

.order-list-scroll {
  overflow-y: auto;
  overflow-x: hidden;
}

.order-item {
  border-right: none;
}

.order-item .table-cell {
  border-right: 1px solid #e9ecef;
}

.order-item .table-cell:last-child {
  border-right: none;
}

/* 商品名称列文本处理 */
.table-cell > div {
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
}

.table-cell > div > span {
  white-space: nowrap;
}

/* 规格按钮样式 */
.standard-btn {
  min-width: 60px;
  margin-right: 8px;
  margin-bottom: 8px;
}

.standard-btn.btn-primary {
  background-color: #007bff;
  border-color: #007bff;
  color: white;
}

.standard-btn.btn-outline-secondary {
  border-color: #6c757d;
  color: #6c757d;
}

.standard-btn.btn-outline-secondary:hover {
  background-color: #6c757d;
  color: white;
}
</style>

