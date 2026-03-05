<template>
  <div class="saved-orders-tab"
       style="height: calc(100vh - 300px); overflow: hidden; display: flex; flex-direction: column;">
    <!-- 订单列表显示区域 -->
    <div class="order-list-container" style="flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden;">
      <!-- 无子部门的情况 -->
      <div v-if="!hasSubDepartments" class="order-table-wrapper">
        <!-- 固定表头 -->
        <div class="table-header-fixed bg-light border-bottom p-2 d-flex align-items-center fw-bold small">
          <div style="width: 50px; flex-shrink: 0;" class="text-center table-cell">序号</div>
          <div style="width: 200px; flex-shrink: 0;" class="table-cell">商品名称</div>
          <div style="width: 100px; flex-shrink: 0;" class="text-center table-cell">订货</div>
          <div style="width: 100px; flex-shrink: 0;" class="text-center table-cell">出货数量</div>
          <div style="width: 100px; flex-shrink: 0;" class="text-center table-cell">出货规格</div>
          <div style="width: 150px; flex-shrink: 0;" class="text-center table-cell">规格</div>
          <div style="width: 120px; flex-shrink: 0;" class="text-center table-cell">单价</div>
          <div style="width: 120px; flex-shrink: 0;" class="text-end table-cell">小计</div>
          <div style="width: 80px; flex-shrink: 0;" class="text-center table-cell">操作</div>
        </div>
        <!-- 可滚动内容区域 -->
        <div class="order-list-scroll" style="flex: 1; min-height: 0; overflow-y: auto;">
        <div
            v-for="(order, index) in todayOrderList"
            :key="order.nxDepartmentOrdersId || order._tmpKey"
            class="order-item border-bottom p-2"
            :class="{
              'bg-white': order.nxDoPurchaseStatus == 4,
              'liziBack': order.nxDoPurchaseStatus != 4 && order.nxDoStatus == 0 ,
              'liziDelivery': order.nxDoPurchaseStatus == 5,
              'liziClock': order.nxDoPurchaseStatus == 3
            }">
          <div v-if="order.nxDoStatus > -2" class="d-flex align-items-center">
            <div style="width: 50px; flex-shrink: 0;" class="text-center fw-bold table-cell">{{ index + 1 }}</div>
            <div style="width: 200px; flex-shrink: 0;" class="table-cell">
              <div class="d-flex align-items-center flex-wrap" style="max-width: 300px;">
                <span v-if="order.nxDistributerGoodsEntity && order.nxDistributerGoodsEntity.nxDgGoodsBrand && order.nxDistributerGoodsEntity.nxDgGoodsBrand !== 'null'"
                      class="text-muted small me-1">
                  {{ order.nxDistributerGoodsEntity.nxDgGoodsBrand }}
                </span>
                <span class="fw-bold me-1">{{ order.nxDistributerGoodsEntity?.nxDgGoodsName || order.nxDoGoodsName }}</span>
                <span v-if="order.nxDoRemark" class="text-danger small">({{ order.nxDoRemark }})</span>
              </div>
            </div>

            <div style="width: 100px; flex-shrink: 0;" class="text-center  table-cell">
              {{ order.nxDoQuantity }}{{ order.nxDoStandard }}
            </div>

            <div style="width: 100px; flex-shrink: 0;" class="text-center  table-cell">
               <span class="">
                  {{ order.nxDoWeight }}
                </span>
            </div>

            <div style="width: 100px; flex-shrink: 0;" class="text-center  table-cell">
               <span class="">
                  {{ order.nxDoPrintStandard}}
               </span>
               <span 
                 v-if="order.nxDoStatus > -2 && order.nxDoPrintStandard"
                 class="ms-1 text-primary" 
                 style="cursor: pointer; font-size: 12px; opacity: 0.7; transition: opacity 0.2s;"
                 @click.stop="handleOpenEditPrintStandardModal(order, index, 'list')"
                 @mouseenter="$event.target.style.opacity = '1'"
                 @mouseleave="$event.target.style.opacity = '0.7'"
                 title="修改打印规格">
                 ✏️
               </span>
            </div>

            <div style="width: 150px; flex-shrink: 0;" class="text-center  table-cell"
                 v-if="order.nxDistributerGoodsEntity.nxDgGoodsStandardWeight !== null && order.nxDistributerGoodsEntity.nxDgGoodsStandardWeight !== ''">
              <span class="text-muted small me-1" v-if="order.nxDistributerGoodsEntity.nxDgItemsPerCarton !== null">
                 {{ order.nxDistributerGoodsEntity.nxDgGoodsStandardWeight }} *{{ order.nxDistributerGoodsEntity.nxDgItemsPerCarton }}{{ order.nxDistributerGoodsEntity.nxDgCartonUnit }}
                </span>
               <span class="text-muted small me-1"  v-else>
                  {{ order.nxDistributerGoodsEntity.nxDgGoodsStandardWeight }}/{{order.nxDistributerGoodsEntity.nxDgGoodsStandardname}}
                </span>

            </div>

            <div style="width: 150px; flex-shrink: 0;" class="text-center  table-cell" v-else>
               <span class="text-muted">
                  {{ order.nxDistributerGoodsEntity.nxDgGoodsStandardname}}
                </span>

            </div>

          <div style="width: 120px; flex-shrink: 0;" class="text-center  table-cell" v-if="order.nxDoPrice > 0.1">
              <span class="">{{order.nxDoPrice }}</span>
              <span 
                v-if="order.nxDoStatus > -2"
                class="ms-1 text-primary" 
                style="cursor: pointer; font-size: 12px; opacity: 0.7; transition: opacity 0.2s;"
                @click.stop="handleOpenEditPriceModal(order, index, 'list')"
                @mouseenter="$event.target.style.opacity = '1'"
                @mouseleave="$event.target.style.opacity = '0.7'"
                title="修改单价">
                ✏️
              </span>
            </div>
            <div style="width: 120px; flex-shrink: 0;" class="text-center small table-cell text-danger" v-else>
              <span class="">
               -
              </span>
              <span 
                v-if="order.nxDoStatus > -2"
                class="ms-1 text-primary" 
                style="cursor: pointer; font-size: 12px; opacity: 0.7; transition: opacity 0.2s;"
                @click.stop="handleOpenEditPriceModal(order, index, 'list')"
                @mouseenter="$event.target.style.opacity = '1'"
                @mouseleave="$event.target.style.opacity = '0.7'"
                title="修改单价">
                ✏️
              </span>
            </div>
            <div style="width: 120px; flex-shrink: 0;" class="text-end  table-cell" >
              <span class="">{{order.nxDoSubtotal }}</span>
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
                    @click="handleOpenEditOrderModalDirect(order, index, 'list')"
                    title="修改">
                  修改
                </button>
            </div>
          </div>
          <div v-else class="d-flex align-items-center">
            <div style="width: 50px; flex-shrink: 0;" class="text-center fw-bold table-cell">{{ index + 1 }}</div>
            <div style="width: 200px; flex-shrink: 0;" class="table-cell">
              <span class="text-danger small me-2">(未完成)</span>
              <span class="me-2">{{ order.nxDoGoodsName }}</span>
              <span v-if="order.nxDoRemark" class="text-danger small">({{ order.nxDoRemark }})</span>
            </div>
            <div style="width: 100px; flex-shrink: 0;" class="text-center small table-cell">
              {{ order.nxDoQuantity }}{{ order.nxDoStandard }}
            </div>
            <div style="width: 100px; flex-shrink: 0;" class="text-center small text-muted table-cell"></div>
            <div style="width: 100px; flex-shrink: 0;" class="text-center small text-muted table-cell"></div>
            <div style="width: 150px; flex-shrink: 0;" class="text-center small text-muted table-cell"></div>
            <div style="width: 120px; flex-shrink: 0;" class="text-center small text-muted table-cell"></div>
            <div style="width: 120px; flex-shrink: 0;" class="text-end small text-muted table-cell"></div>
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
      <div v-else class="order-table-wrapper" style="flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden;">
          <!-- 固定表头 -->
        <div class="table-header-fixed bg-light border-bottom p-2 d-flex align-items-center fw-bold small" style="flex-shrink: 0;">
            <div style="width: 50px; flex-shrink: 0;" class="text-center table-cell">序号</div>
            <div style="width: 300px; flex-shrink: 0;" class="table-cell">商品名称</div>
            <div style="width: 100px; flex-shrink: 0;" class="text-center table-cell">订货</div>
            <div style="width: 100px; flex-shrink: 0;" class="text-center table-cell">出货</div>
            <div style="width: 120px; flex-shrink: 0;" class="text-center table-cell">单价</div>
            <div style="width: 120px; flex-shrink: 0;" class="text-end table-cell">小计</div>
            <div style="width: 80px; flex-shrink: 0;" class="text-center table-cell">操作</div>
          </div>

        <!-- 可滚动内容区域（包含所有部门） -->
        <div class="order-list-scroll" style="flex: 1; min-height: 0; overflow-y: auto;">
          <div v-for="(dep, depIndex) in filteredTodayOrderDepArr"
               :key="dep.depId || dep.depName" class="mb-3">
            <div class="d-flex justify-content-between align-items-center p-2 bg-light border-bottom">
              <span class="text-primary fw-bold">#{{ dep.depName }}</span>
              <span class="text-muted">¥:{{ dep.depSubtotal }}元</span>
            </div>
          <div
              v-for="(order, index) in (dep.depOrders || [])"
              :key="order.nxDepartmentOrdersId || order._tmpKey"
              class="order-item border-bottom p-2"
              :class="{
                'bg-white': order.nxDoPurchaseStatus == 4,
                'liziBack': order.nxDoPurchaseStatus != 4 && order.nxDoPurchaseStatus != 5 && order.nxDoPurchaseStatus != 3,
                'liziDelivery': order.nxDoPurchaseStatus == 5,
                'liziClock': order.nxDoPurchaseStatus == 3
              }">
            <div v-if="order.nxDoStatus > -2" class="d-flex align-items-center">
              <div style="width: 50px; flex-shrink: 0;" class="text-center fw-bold table-cell">{{ index + 1 }}</div>
              <div style="width: 200px; flex-shrink: 0;" class="table-cell">
                <div class="d-flex align-items-center flex-wrap" style="max-width: 200px;">
                  <span v-if="order.nxDistributerGoodsEntity && order.nxDistributerGoodsEntity.nxDgGoodsBrand && order.nxDistributerGoodsEntity.nxDgGoodsBrand !== 'null'"
                        class="text-muted small me-1">
                    {{ order.nxDistributerGoodsEntity.nxDgGoodsBrand }}
                  </span>
                  <span class="fw-bold me-1">{{ order.nxDistributerGoodsEntity?.nxDgGoodsName || order.nxDoGoodsName }}</span>

                  <span v-if="order.nxDistributerGoodsEntity?.nxDgGoodsStandardWeight && order.nxDistributerGoodsEntity.nxDgGoodsStandardWeight !== 'null'"
                        class="text-muted small me-1">
                    ({{ order.nxDistributerGoodsEntity.nxDgGoodsStandardname }}/{{ order.nxDistributerGoodsEntity.nxDgGoodsStandardWeight }})
                  </span>
                  <span v-if="order.nxDistributerGoodsEntity?.nxDgGoodsStandardname !== order.nxDoPrintStandard"
                        class="text-muted small me-1">
                    ({{ order.nxDoPrintStandard }})
                  </span>
                  <span 
                    v-if="order.nxDoStatus > -2 && order.nxDoPrintStandard"
                    class="ms-1 text-primary" 
                    style="cursor: pointer; font-size: 11px; opacity: 0.7; transition: opacity 0.2s;"
                    @click.stop="handleOpenEditPrintStandardModal(order, index, 'dep', depIndex)"
                    @mouseenter="$event.target.style.opacity = '1'"
                    @mouseleave="$event.target.style.opacity = '0.7'"
                    title="修改打印规格">
                    ✏️
                  </span>
                  <span v-if="order.nxDoRemark" class="text-danger small">({{ order.nxDoRemark }})</span>
                </div>
              </div>
              <div style="width: 100px; flex-shrink: 0;" class="text-center small table-cell">{{ order.nxDoQuantity }}{{ order.nxDoStandard }}</div>
              <div style="width: 150px; flex-shrink: 0;" class="text-center  table-cell"
                   v-if="order.nxDistributerGoodsEntity.nxDgGoodsStandardWeight !== null && order.nxDistributerGoodsEntity.nxDgGoodsStandardWeight !== ''">
               <span class="text-muted small me-1">
                  {{ order.nxDistributerGoodsEntity.nxDgGoodsStandardWeight }}
                </span>
                <span class="text-muted small me-1" v-if="order.nxDistributerGoodsEntity.nxDgItemsPerCarton !== null">
                  *{{ order.nxDistributerGoodsEntity.nxDgItemsPerCarton }}{{ order.nxDistributerGoodsEntity.nxDgGoodsStandardname }}/{{ order.nxDistributerGoodsEntity.nxDgCartonUnit }}
                </span>
              </div>
              <div style="width: 150px; flex-shrink: 0;" class="text-center  table-cell" v-else>
               <span class="text-muted">
                  {{ order.nxDistributerGoodsEntity.nxDgGoodsStandardname}}
                </span>

              </div>

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
                <span 
                  v-if="order.nxDoStatus > -2"
                  class="ms-1 text-primary" 
                  style="cursor: pointer; font-size: 11px; opacity: 0.7; transition: opacity 0.2s;"
                  @click.stop="handleOpenEditPriceModal(order, index, 'dep', depIndex)"
                  @mouseenter="$event.target.style.opacity = '1'"
                  @mouseleave="$event.target.style.opacity = '0.7'"
                  title="修改单价">
                  ✏️
                </span>
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
              <div style="width: 100px; flex-shrink: 0;" class="text-center small text-muted table-cell">-a</div>
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
        <div v-if="filteredTodayOrderDepArr.length === 0" class="text-center p-5 text-muted">
          暂无已保存的订单
          </div>
        </div>
      </div>
    </div>

    <!-- 修改单价弹窗 -->
    <div v-if="showEditPriceModal" class="order-edit-overlay" @click.self="closeEditPriceModal">
      <div class="order-edit-popup" style="max-width: 400px;">
        <!-- 顶部标题 -->
        <div class="popup-header text-center p-3 bg-light border-bottom">
          <h5 class="mb-0">修改单价</h5>
        </div>

        <!-- 输入内容 -->
        <div class="popup-body p-3">
          <!-- 商品名称（只读） -->
          <div class="mb-3">
            <label class="form-label fw-bold">商品名称：</label>
            <div class="text-muted">
              {{ currentEditPriceOrder?.nxDistributerGoodsEntity?.nxDgGoodsName || currentEditPriceOrder?.nxDoGoodsName || '未知商品' }}
            </div>
          </div>

          <!-- 当前单价 -->
          <div class="mb-3">
            <label class="form-label fw-bold">当前单价：</label>
            <div class="text-muted">
              {{ currentEditPriceOrder?.nxDoPrice && currentEditPriceOrder.nxDoPrice > 0.1 ? currentEditPriceOrder.nxDoPrice : '-' }}
            </div>
          </div>

          <!-- 新单价输入 -->
          <div class="mb-3">
            <label class="form-label fw-bold">新单价：</label>
            <input
                ref="editPriceInput"
                type="number"
                step="0.01"
                class="form-control"
                v-model="editPriceForm.price"
                placeholder="请输入新的单价"
                @keyup.enter="handleSavePrice"
            />
          </div>
        </div>

        <!-- 按钮组 -->
        <div class="popup-footer d-flex gap-2 p-3 border-top bg-light">
          <button 
              class="btn btn-sm btn-secondary" 
              @click="closeEditPriceModal"
              style="flex: 1;">
            取消
          </button>
          <button 
              class="btn btn-sm btn-primary" 
              @click="handleSavePrice"
              style="flex: 1;">
            保存
          </button>
        </div>
      </div>
    </div>

    <!-- 修改打印规格弹窗 -->
    <div v-if="showEditPrintStandardModal" class="order-edit-overlay" @click.self="closeEditPrintStandardModal">
      <div class="order-edit-popup" style="max-width: 400px;">
        <!-- 顶部标题 -->
        <div class="popup-header text-center p-3 bg-light border-bottom">
          <h5 class="mb-0">修改打印规格</h5>
        </div>

        <!-- 输入内容 -->
        <div class="popup-body p-3">
          <!-- 商品名称（只读） -->
          <div class="mb-3">
            <label class="form-label fw-bold">商品名称：</label>
            <div class="text-muted">
              {{ currentEditPrintStandardOrder?.nxDistributerGoodsEntity?.nxDgGoodsName || currentEditPrintStandardOrder?.nxDoGoodsName || '未知商品' }}
            </div>
          </div>

          <!-- 当前打印规格 -->
          <div class="mb-3">
            <label class="form-label fw-bold">当前打印规格：</label>
            <div class="text-muted">
              {{ currentEditPrintStandardOrder?.nxDoPrintStandard || '-' }}
            </div>
          </div>

          <!-- 新打印规格输入 -->
          <div class="mb-3">
            <label class="form-label fw-bold">新打印规格：</label>
            <input
                ref="editPrintStandardInput"
                type="text"
                class="form-control"
                v-model="editPrintStandardForm.printName"
                placeholder="请输入新的打印规格"
                @keyup.enter="handleSavePrintStandard"
            />
          </div>
        </div>

        <!-- 按钮组 -->
        <div class="popup-footer d-flex gap-2 p-3 border-top bg-light">
          <button 
              class="btn btn-sm btn-secondary" 
              @click="closeEditPrintStandardModal"
              style="flex: 1;">
            取消
          </button>
          <button 
              class="btn btn-sm btn-primary" 
              @click="handleSavePrintStandard"
              style="flex: 1;">
            保存
          </button>
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

    <!-- 底部总计和下载按钮 -->
    <div class="border-top p-3 bg-light">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div class="d-flex flex-column gap-1">
          <div class="d-flex align-items-center gap-2">
        <span>总计:</span>
          <span class="fw-bold fs-5">{{ todayOrderTotal }}元</span>
          </div>
          <!-- 订单状态统计 -->
          <div class="d-flex align-items-center gap-3 text-muted small" @click="handleStatsAreaClick">
            <span>完成: <span class="text-success fw-bold">{{ orderStatusStats.completed || 0 }}</span></span>
            <span>待完成: <span class="text-warning fw-bold">{{ orderStatusStats.pending || 0 }}</span></span>
            <span>临时订单: <span class="text-danger fw-bold">{{ orderStatusStats.temp || 0 }}</span></span>

            <!-- 隐藏按钮，连续点击3次后显示 -->
            <div v-if="showSaveTrainingDataButton" class="d-flex align-items-center gap-3">
              <button class="btn btn-primary btn-sm"
                      @click.stop="handleShowDatePicker">
                保存训练数据
              </button>
            </div>
          </div>
          
          <!-- 日期选择器模态框 -->
          <div v-if="showDatePicker" class="modal fade show" style="display: block; background-color: rgba(0,0,0,0.5);" @click.self="showDatePicker = false">
            <div class="modal-dialog modal-dialog-centered">
              <div class="modal-content" @click.stop>
                <div class="modal-header">
                  <h5 class="modal-title">选择日期</h5>
                  <button type="button" class="btn-close" @click="showDatePicker = false"></button>
                </div>
                <div class="modal-body">
                  <div class="mb-3">
                    <label for="dateInput" class="form-label">日期 (格式: YYYY-MM-DD)</label>
                    <input 
                      type="date" 
                      id="dateInput" 
                      class="form-control" 
                      v-model="selectedDate"
                      :max="maxDate"
                      :min="minDate">
                  </div>
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" @click="showDatePicker = false">取消</button>
                  <button type="button" class="btn btn-primary" @click="handleSaveTrainingData" :disabled="!selectedDate">保存</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="d-flex align-items-center gap-3">
          <button
            class="btn btn-primary btn-sm"
            @click="handleDownloadExcel"
            :disabled="!canDownloadExcel">
            下载 Excel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import api from '../api/all';
import * as XLSX from 'xlsx';

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
      },
      // 修改打印规格相关
      showEditPrintStandardModal: false,
      currentEditPrintStandardOrder: null,
      currentEditPrintStandardIndex: -1,
      currentEditPrintStandardType: '',
      currentEditPrintStandardDepIndex: -1,
      editPrintStandardForm: {
        printName: ''
      },
      // 修改单价相关
      showEditPriceModal: false,
      currentEditPriceOrder: null,
      currentEditPriceIndex: -1,
      currentEditPriceType: '',
      currentEditPriceDepIndex: -1,
      editPriceForm: {
        price: ''
      },
      // 保存训练数据相关
      clickCount: 0, // 点击次数
      clickTimer: null, // 点击计时器
      showSaveTrainingDataButton: false, // 是否显示保存训练数据按钮
      showDatePicker: false, // 是否显示日期选择器
      selectedDate: '' // 选择的日期
    }
  },
  computed: {
    // 日期选择器的最大日期（今天）
    maxDate() {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    },
    // 日期选择器的最小日期（可以设置为较早的日期，比如2020-01-01）
    minDate() {
      return '2020-01-01';
    },
    filteredTodayOrderDepArr() {
      // 今日订单标签页：总是显示所有部门的订单，不进行过滤
      // selectedSubDepartment 只在"下单"标签页使用，不影响"今日订单"的显示
      console.log('🔍 [filteredTodayOrderDepArr] 计算过滤后的部门列表');
      console.log('  - hasSubDepartments:', this.hasSubDepartments);
      console.log('  - selectedSubDepartment:', this.selectedSubDepartment);
      console.log('  - todayOrderDepArr.length:', this.todayOrderDepArr?.length || 0);
      console.log('  - 今日订单标签页：显示所有部门，不进行过滤');
      
      // 如果没有子部门或数据为空，返回空数组
      if (!this.hasSubDepartments || !this.todayOrderDepArr || !Array.isArray(this.todayOrderDepArr) || this.todayOrderDepArr.length === 0) {
        return [];
      }
      
      // 确保每个部门都有 depOrders 属性，避免 Vue 渲染错误
      return this.todayOrderDepArr.map(dep => {
        if (!dep) return null;
        return {
          ...dep,
          depOrders: Array.isArray(dep.depOrders) ? dep.depOrders : []
        };
      }).filter(dep => dep !== null);
    },
    // 检查是否可以下载 Excel（所有订单状态都是 0 或 2）
    // 状态说明：0=已保存，2=已完成/已确认（不能编辑但可以下载），-2=草稿（未保存）
    canDownloadExcel() {
      console.log('🔍 [canDownloadExcel] 开始检查下载条件');
      console.log('  - hasSubDepartments:', this.hasSubDepartments);
      console.log('  - todayOrderDepArr:', this.todayOrderDepArr);
      console.log('  - todayOrderDepArr.length:', this.todayOrderDepArr?.length || 0);
      console.log('  - todayOrderList.length:', this.todayOrderList?.length || 0);
      
      // 辅助函数：检查订单状态是否允许下载（0 或 2）
      const isDownloadableStatus = (status) => {
        return status === 0 || status === 2;
      };
      
      // 多部门情况：检查所有部门的订单状态
      if (this.hasSubDepartments && this.todayOrderDepArr && this.todayOrderDepArr.length > 0) {
        console.log('📊 [canDownloadExcel] 多部门模式，检查部门订单状态');
        
        const result = this.todayOrderDepArr.every((dep, depIndex) => {
          console.log(`  📁 [canDownloadExcel] 检查部门 ${depIndex + 1}: "${dep.depName}"`);
          console.log(`    - depOrders存在:`, !!dep.depOrders);
          console.log(`    - depOrders.length:`, dep.depOrders?.length || 0);
          
          if (!dep.depOrders || dep.depOrders.length === 0) {
            console.log(`    ✅ [canDownloadExcel] 部门 "${dep.depName}" 无订单，跳过检查`);
            return true; // 没有订单的部门也算通过
          }
          
          // 检查订单状态（允许状态 0 或 2）
          const allDownloadable = dep.depOrders.every(order => {
            const status = order.nxDoStatus;
            console.log(`    - 订单 ${order.nxDepartmentOrdersId} 状态:`, status);
            const downloadable = isDownloadableStatus(status);
            if (!downloadable) {
              console.log(`      ⚠️ 订单 ${order.nxDepartmentOrdersId} 状态 ${status} 不允许下载`);
            }
            return downloadable;
          });
          
          console.log(`    ${allDownloadable ? '✅' : '❌'} [canDownloadExcel] 部门 "${dep.depName}" 所有订单状态检查: ${allDownloadable}`);
          
          if (!allDownloadable) {
            // 找出状态不允许下载的订单
            const invalidOrders = dep.depOrders.filter(order => !isDownloadableStatus(order.nxDoStatus));
            console.log(`    ⚠️ [canDownloadExcel] 部门 "${dep.depName}" 有 ${invalidOrders.length} 个订单状态不允许下载:`, 
              invalidOrders.map(o => ({ id: o.nxDepartmentOrdersId, status: o.nxDoStatus })));
          }
          
          return allDownloadable;
        });
        
        console.log(`📊 [canDownloadExcel] 多部门检查结果: ${result}`);
        return result;
      }
      
      // 单部门情况：检查 todayOrderList
      console.log('📊 [canDownloadExcel] 单部门模式，检查 todayOrderList');
      if (!this.todayOrderList || this.todayOrderList.length === 0) {
        console.log('❌ [canDownloadExcel] todayOrderList 为空');
        return false;
      }
      
      // 检查所有订单的状态是否允许下载（0 或 2）
      const allDownloadable = this.todayOrderList.every(order => {
        const status = order.nxDoStatus;
        console.log(`  - 订单 ${order.nxDepartmentOrdersId} 状态:`, status);
        const downloadable = isDownloadableStatus(status);
        if (!downloadable) {
          console.log(`    ⚠️ 订单 ${order.nxDepartmentOrdersId} 状态 ${status} 不允许下载`);
        }
        return downloadable;
      });
      
      if (!allDownloadable) {
        const invalidOrders = this.todayOrderList.filter(order => !isDownloadableStatus(order.nxDoStatus));
        console.log(`⚠️ [canDownloadExcel] 有 ${invalidOrders.length} 个订单状态不允许下载:`, 
          invalidOrders.map(o => ({ id: o.nxDepartmentOrdersId, status: o.nxDoStatus })));
      }
      
      console.log(`📊 [canDownloadExcel] 单部门检查结果: ${allDownloadable}`);
      return allDownloadable;
    },
    // 订单状态统计
    orderStatusStats() {
    console.log('🚀 [orderStatusStats] ========== 计算属性被调用 ==========');
    try {
      console.log('📊 [orderStatusStats] 开始计算订单状态统计');
      console.log('  - hasSubDepartments:', this.hasSubDepartments);
      console.log('  - todayOrderDepArr.length:', this.todayOrderDepArr?.length || 0);
      console.log('  - todayOrderList.length:', this.todayOrderList?.length || 0);
      
      let completedCount = 0; // nxDoStatus = 2：完成
      let tempCount = 0; // nxDoStatus = -2：临时订单
      let pendingCount = 0; // nxDoStatus = 0：待完成
      
      // 多部门情况
      if (this.hasSubDepartments && this.todayOrderDepArr && Array.isArray(this.todayOrderDepArr) && this.todayOrderDepArr.length > 0) {
        console.log('📊 [orderStatusStats] 多部门模式，统计部门订单');
        this.todayOrderDepArr.forEach((dep, depIdx) => {
          if (dep && dep.depOrders && Array.isArray(dep.depOrders) && dep.depOrders.length > 0) {
            console.log(`  📁 部门 ${depIdx + 1} "${dep.depName}": ${dep.depOrders.length} 个订单`);
            dep.depOrders.forEach(order => {
              if (order && typeof order.nxDoStatus !== 'undefined') {
                const status = order.nxDoStatus;
                if (status === 2) {
                  completedCount++;
                } else if (status === -2) {
                  tempCount++;
                } else if (status === 0) {
                  pendingCount++;
                }
              }
            });
          }
        });
      } 
      // 单部门情况
      else if (this.todayOrderList && Array.isArray(this.todayOrderList) && this.todayOrderList.length > 0) {
        console.log('📊 [orderStatusStats] 单部门模式，统计订单列表');
        this.todayOrderList.forEach((order, idx) => {
          if (order && typeof order.nxDoStatus !== 'undefined') {
            const status = order.nxDoStatus;
            console.log(`  📦 订单 ${idx + 1} (ID: ${order.nxDepartmentOrdersId}): 状态=${status}`);
            if (status === 2) {
              completedCount++;
            } else if (status === -2) {
              tempCount++;
            } else if (status === 0) {
              pendingCount++;
            }
          }
        });
      } else {
        console.log('📊 [orderStatusStats] 没有订单数据');
      }
      
      const result = {
        completed: completedCount,
        temp: tempCount,
        pending: pendingCount,
        total: completedCount + tempCount + pendingCount
      };
      
      console.log('✅ [orderStatusStats] 统计结果:', result);
      console.log('✅ [orderStatusStats] 结果类型:', typeof result);
      console.log('✅ [orderStatusStats] 结果是否为对象:', result instanceof Object);
      console.log('✅ [orderStatusStats] 结果键:', Object.keys(result));
      console.log('✅ [orderStatusStats] completed:', result.completed);
      console.log('✅ [orderStatusStats] pending:', result.pending);
      console.log('✅ [orderStatusStats] temp:', result.temp);
      console.log('✅ [orderStatusStats] total:', result.total);
      return result;
    } catch (error) {
      console.error('❌ [orderStatusStats] 计算订单状态统计时出错:', error);
      // 返回默认值，避免渲染错误
      const defaultResult = {
        completed: 0,
        temp: 0,
        pending: 0,
        total: 0
      };
      console.log('⚠️ [orderStatusStats] 返回默认值:', defaultResult);
      return defaultResult;
    }
  },
  },
  watch: {
    todayOrderList: {
      immediate: true,
      deep: true,
      handler(val) {
        this.ensureTmpKeys(val);
      }
    },
    todayOrderDepArr: {
      immediate: true,
      deep: true,
      handler(deps) {
        if (!Array.isArray(deps)) return;
        deps.forEach(d => this.ensureTmpKeys(d?.depOrders));
      }
    },
    // 监听修改单价弹窗显示状态，自动聚焦输入框（备用方案）
    showEditPriceModal(newVal) {
      if (newVal) {
        this.$nextTick(() => {
          setTimeout(() => {
            if (this.$refs.editPriceInput) {
              this.$refs.editPriceInput.focus();
            }
          }, 100);
        });
      }
    },
    // 监听修改打印规格弹窗显示状态，自动聚焦输入框（备用方案）
    showEditPrintStandardModal(newVal) {
      if (newVal) {
        this.$nextTick(() => {
          setTimeout(() => {
            if (this.$refs.editPrintStandardInput) {
              this.$refs.editPrintStandardInput.focus();
            }
          }, 100);
        });
      }
    }
  },
  methods: {
    // 确保临时订单有稳定的 _tmpKey
    ensureTmpKeys(list) {
      if (!Array.isArray(list)) return;
      list.forEach(o => {
        if (!o) return;
        if (!o.nxDepartmentOrdersId && !o._tmpKey) {
          o._tmpKey = `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        }
      });
    },
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

          // alert('删除成功');
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

          // alert('修改成功');
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
                            return {order, index: idx};
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

          // alert('删除成功');
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
    },

    
    // 打开修改单价弹窗
    handleOpenEditPriceModal(order, index, type, depIndex = -1) {
      console.log('打开修改单价弹窗', { order, index, type, depIndex });
      this.currentEditPriceOrder = order;
      this.currentEditPriceIndex = index;
      this.currentEditPriceType = type;
      this.currentEditPriceDepIndex = depIndex;
      this.editPriceForm.price = order.nxDoPrice && order.nxDoPrice > 0.1 ? order.nxDoPrice : '';
      this.showEditPriceModal = true;
      console.log('showEditPriceModal:', this.showEditPriceModal);
      // 延迟聚焦输入框，确保弹窗完全渲染
      this.$nextTick(() => {
        setTimeout(() => {
          if (this.$refs.editPriceInput) {
            this.$refs.editPriceInput.focus();
            console.log('单价输入框已聚焦');
          } else {
            console.warn('单价输入框 ref 未找到');
          }
        }, 100);
      });
    },
    // 关闭修改单价弹窗
    closeEditPriceModal() {
      this.showEditPriceModal = false;
      this.currentEditPriceOrder = null;
      this.currentEditPriceIndex = -1;
      this.currentEditPriceType = '';
      this.currentEditPriceDepIndex = -1;
      this.editPriceForm.price = '';
    },
    // 保存单价
    async handleSavePrice() {
      if (!this.currentEditPriceOrder || !this.currentEditPriceOrder.nxDepartmentOrdersId) {
        alert('订单信息错误');
        return;
      }

      if (!this.editPriceForm.price || this.editPriceForm.price === '') {
        alert('请输入单价');
        return;
      }

      const price = parseFloat(this.editPriceForm.price);
      if (isNaN(price) || price < 0) {
        alert('请输入有效的单价');
        return;
      }

      try {
        this.$store.commit('SET_LOADING', true);

        const updateData = {
          orderId: this.currentEditPriceOrder.nxDepartmentOrdersId,
          price: price
        };

        const res = await api.giveOrderPrice(updateData);

        if (res && res.data && res.data.code === 0) {
          // 更新本地订单数据
          const orderId = this.currentEditPriceOrder.nxDepartmentOrdersId;
          const updatedOrderData = {
            nxDoPrice: price
          };
          
          // 更新对应列表中的订单
          if (this.currentEditPriceType === 'list') {
            // 单部门情况
            const orderIndex = this.todayOrderList.findIndex(o => o.nxDepartmentOrdersId === orderId);
            if (orderIndex >= 0) {
              this.todayOrderList[orderIndex] = {
                ...this.todayOrderList[orderIndex],
                ...updatedOrderData
              };
            }
          } else if (this.currentEditPriceType === 'dep') {
            // 多部门情况
            if (this.currentEditPriceDepIndex >= 0 && 
                this.todayOrderDepArr[this.currentEditPriceDepIndex] &&
                this.todayOrderDepArr[this.currentEditPriceDepIndex].depOrders) {
              const orderIndex = this.todayOrderDepArr[this.currentEditPriceDepIndex].depOrders
                .findIndex(o => o.nxDepartmentOrdersId === orderId);
              if (orderIndex >= 0) {
                this.todayOrderDepArr[this.currentEditPriceDepIndex].depOrders[orderIndex] = {
                  ...this.todayOrderDepArr[this.currentEditPriceDepIndex].depOrders[orderIndex],
                  ...updatedOrderData
                };
              }
            }
          }

          this.closeEditPriceModal();
          // 通知父组件刷新数据
          this.$emit('order-updated');
        } else {
          alert(res?.data?.msg || '修改失败');
        }
      } catch (error) {
        console.error('修改单价失败:', error);
        alert('修改失败，请检查网络');
      } finally {
        this.$store.commit('SET_LOADING', false);
      }
    },
    
    // 打开修改打印规格弹窗
    handleOpenEditPrintStandardModal(order, index, type, depIndex = -1) {
      this.currentEditPrintStandardOrder = order;
      this.currentEditPrintStandardIndex = index;
      this.currentEditPrintStandardType = type;
      this.currentEditPrintStandardDepIndex = depIndex;
      this.editPrintStandardForm.printName = order.nxDoPrintStandard || '';
      this.showEditPrintStandardModal = true;
      // 延迟聚焦输入框，确保弹窗完全渲染
      this.$nextTick(() => {
        setTimeout(() => {
          if (this.$refs.editPrintStandardInput) {
            this.$refs.editPrintStandardInput.focus();
            console.log('打印规格输入框已聚焦');
          } else {
            console.warn('打印规格输入框 ref 未找到');
          }
        }, 100);
      });
    },
    // 关闭修改打印规格弹窗
    closeEditPrintStandardModal() {
      this.showEditPrintStandardModal = false;
      this.currentEditPrintStandardOrder = null;
      this.currentEditPrintStandardIndex = -1;
      this.currentEditPrintStandardType = '';
      this.currentEditPrintStandardDepIndex = -1;
      this.editPrintStandardForm.printName = '';
    },
    // 保存打印规格
    async handleSavePrintStandard() {
      if (!this.currentEditPrintStandardOrder || !this.currentEditPrintStandardOrder.nxDepartmentOrdersId) {
        alert('订单信息错误');
        return;
      }

      if (!this.editPrintStandardForm.printName || !this.editPrintStandardForm.printName.trim()) {
        alert('请输入打印规格');
        return;
      }

      try {
        this.$store.commit('SET_LOADING', true);

        const updateData = {
          orderId: this.currentEditPrintStandardOrder.nxDepartmentOrdersId,
          printName: this.editPrintStandardForm.printName.trim()
        };

        const res = await api.updateOrderPrint(updateData);

        if (res && res.data && res.data.code === 0) {
          // 更新本地订单数据
          const orderId = this.currentEditPrintStandardOrder.nxDepartmentOrdersId;
          const updatedOrderData = {
            nxDoPrintStandard: this.editPrintStandardForm.printName.trim()
          };
          
          // 更新对应列表中的订单
          if (this.currentEditPrintStandardType === 'list') {
            // 单部门情况
            const orderIndex = this.todayOrderList.findIndex(o => o.nxDepartmentOrdersId === orderId);
            if (orderIndex >= 0) {
              this.todayOrderList[orderIndex] = {
                ...this.todayOrderList[orderIndex],
                ...updatedOrderData
              };
            }
          } else if (this.currentEditPrintStandardType === 'dep') {
            // 多部门情况
            if (this.currentEditPrintStandardDepIndex >= 0 && 
                this.todayOrderDepArr[this.currentEditPrintStandardDepIndex] &&
                this.todayOrderDepArr[this.currentEditPrintStandardDepIndex].depOrders) {
              const orderIndex = this.todayOrderDepArr[this.currentEditPrintStandardDepIndex].depOrders
                .findIndex(o => o.nxDepartmentOrdersId === orderId);
              if (orderIndex >= 0) {
                this.todayOrderDepArr[this.currentEditPrintStandardDepIndex].depOrders[orderIndex] = {
                  ...this.todayOrderDepArr[this.currentEditPrintStandardDepIndex].depOrders[orderIndex],
                  ...updatedOrderData
                };
              }
            }
          }

          this.closeEditPrintStandardModal();
          // 通知父组件刷新数据
          this.$emit('order-updated');
        } else {
          alert(res?.data?.msg || '修改失败');
        }
      } catch (error) {
        console.error('修改打印规格失败:', error);
        alert('修改失败，请检查网络');
      } finally {
        this.$store.commit('SET_LOADING', false);
      }
    },
    
    // 下载 Excel
    handleDownloadExcel() {


      // 检查是否可以下载
      if (!this.canDownloadExcel) {
        console.warn('⚠️ [handleDownloadExcel] 下载条件不满足，所有订单状态必须为0或2');
        alert('只有所有订单状态都是已保存（状态为0或2）时才能下载 Excel');
        return;
      }

      // 检查是否有数据可导出
      if (this.hasSubDepartments && this.todayOrderDepArr && this.todayOrderDepArr.length > 0) {
        console.log('📊 [handleDownloadExcel] 多部门模式');
        console.log('📊 [handleDownloadExcel] 部门列表:', this.todayOrderDepArr.map(dep => ({
          depId: dep.depId,
          depName: dep.depName,
          orderCount: dep.depOrders?.length || 0,
          depSubtotal: dep.depSubtotal
        })));

        // 多部门情况：检查是否有部门有订单
        const hasOrders = this.todayOrderDepArr.some(dep => dep.depOrders && dep.depOrders.length > 0);
        if (!hasOrders) {
          console.warn('⚠️ [handleDownloadExcel] 没有找到有订单的部门');
          alert('没有数据可导出');
          return;
        }
      }

      try {
        console.log('=== [handleDownloadExcel] 开始导出 Excel ===');

        // 创建工作簿
        const wb = XLSX.utils.book_new();

        // 辅助函数：构建商品名称
        const buildGoodsName = (order) => {
          let goodsName = order.nxDistributerGoodsEntity?.nxDgGoodsName || order.nxDoGoodsName || '';

          // 添加品牌
          if (order.nxDistributerGoodsEntity?.nxDgGoodsBrand && order.nxDistributerGoodsEntity.nxDgGoodsBrand !== 'null') {
            goodsName = `${order.nxDistributerGoodsEntity.nxDgGoodsBrand} ${goodsName}`;
          }

          // 添加规格信息
          if (order.nxDistributerGoodsEntity?.nxDgGoodsStandardWeight && order.nxDistributerGoodsEntity.nxDgGoodsStandardWeight !== 'null') {
            goodsName += ` (${order.nxDistributerGoodsEntity.nxDgGoodsStandardname}/${order.nxDistributerGoodsEntity.nxDgGoodsStandardWeight})`;
          }

          return goodsName;
        };

        // 辅助函数：创建单个部门的工作表数据
        const createDepartmentSheet = (orders, depName, depSubtotal) => {
          const sheetData = [];

          // 添加表头
          sheetData.push(['序号', '商品名称', '订货数量', '订货规格', '备注', '规格重量', '大包装', '大包装数量']);

          // 添加数据行
          orders.forEach((order, index) => {
            const goodsName = buildGoodsName(order);

            sheetData.push([
              index + 1,
              goodsName,
              order.nxDoQuantity || '',
              order.nxDoPrintStandard || '',
              order.nxDoRemark || '',
              order.nxDistributerGoodsEntity?.nxDgGoodsStandardWeight || '',
              order.nxDistributerGoodsEntity?.nxDgCartonUnit || '',
              order.nxDistributerGoodsEntity?.nxDgItemsPerCarton || ''
            ]);
          });

          return sheetData;
        };

        // 生成文件名：当前日期
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const dateStr = `${year}${month}${day}`;

        // 辅助函数：清理文件名中的特殊字符
        const cleanFileName = (name) => {
          return name.replace(/[\\\/\?\*\[\]:<>|"]/g, '').trim();
        };

        let fileName = '';

        // 判断是否有多个部门
        if (this.hasSubDepartments && this.todayOrderDepArr && this.todayOrderDepArr.length > 0) {
          // 多部门情况：每个部门创建一个 sheet
          console.log(`📊 检测到 ${this.todayOrderDepArr.length} 个部门，将为每个部门创建独立的 sheet`);

          // 收集所有部门名称用于文件名
          const depNames = this.todayOrderDepArr
            .filter(dep => dep.depOrders && dep.depOrders.length > 0)
            .map(dep => cleanFileName(dep.depName || ''))
            .filter(name => name);

          this.todayOrderDepArr.forEach((dep, depIndex) => {
            if (dep.depOrders && dep.depOrders.length > 0) {
              const sheetData = createDepartmentSheet(dep.depOrders, dep.depName, dep.depSubtotal);
              const ws = XLSX.utils.aoa_to_sheet(sheetData);

              // 使用部门名称作为 sheet 名称（如果名称太长或包含特殊字符，进行清理）
              let sheetName = dep.depName || `部门${depIndex + 1}`;
              const originalSheetName = sheetName;
              // Excel sheet 名称限制：最多31个字符，不能包含特殊字符
              sheetName = sheetName.replace(/[\\\/\?\*\[\]:]/g, '').substring(0, 31);
              if (!sheetName) {
                sheetName = `部门${depIndex + 1}`;
              }

              console.log(`   - Sheet 名称: "${originalSheetName}" -> "${sheetName}"`);

              XLSX.utils.book_append_sheet(wb, ws, sheetName);
              console.log(`✅ [handleDownloadExcel] 已创建部门 "${dep.depName}" 的 sheet，包含 ${dep.depOrders.length} 条订单`);

              // 收集部门名称
              const cleanedName = cleanFileName(dep.depName || '');
              if (cleanedName) {
                depNames.push(cleanedName);
              }
            } else {
              console.log(`⏭️ [handleDownloadExcel] 跳过部门 ${depIndex + 1}: "${dep.depName}" (无订单)`);
            }
          });

          // 多部门文件名：包含所有部门名称
          if (depNames.length > 0) {
            const depNamesStr = depNames.join('_');
            fileName = `订单_${depNamesStr}_${dateStr}.xlsx`;
            console.log(`📝 [handleDownloadExcel] 多部门文件名: "${fileName}"`);
            console.log(`📝 [handleDownloadExcel] 包含的部门: ${depNames.join(', ')}`);
          } else {
            fileName = `订单_${dateStr}.xlsx`;
            console.log(`📝 [handleDownloadExcel] 多部门文件名（无部门名）: "${fileName}"`);
          }
        } else {
          // 单部门情况：创建一个 sheet
          console.log('📊 [handleDownloadExcel] 单部门模式，创建一个 sheet');
          console.log(`📊 [handleDownloadExcel] 订单数量: ${this.todayOrderList.length}`);

          // 尝试获取部门名称
          let depName = '';

          // 方法1：从 todayOrderDepArr 中获取（如果有且只有一个部门）
          if (this.todayOrderDepArr && this.todayOrderDepArr.length === 1) {
            depName = this.todayOrderDepArr[0].depName || '';
            console.log(`📋 [handleDownloadExcel] 从 todayOrderDepArr 获取部门名称: "${depName}"`);
          }

          // 方法2：从订单中获取部门名称（如果方法1没有获取到）
          if (!depName && this.todayOrderList && this.todayOrderList.length > 0) {
            const firstOrder = this.todayOrderList[0];
            // 尝试多种可能的字段名
            depName = firstOrder.nxDepartmentEntity?.nxDepartmentName ||
                    firstOrder.nxDepartmentEntity?.nxDepartmentAttrName ||
                    firstOrder.nxDoDepartmentName ||
                    firstOrder.depName ||
                    '';
            console.log(`📋 [handleDownloadExcel] 从订单中获取部门名称: "${depName}"`);
            console.log(`📋 [handleDownloadExcel] 订单中的部门相关字段:`, {
              hasNxDepartmentEntity: !!firstOrder.nxDepartmentEntity,
              nxDoDepartmentName: firstOrder.nxDoDepartmentName,
              depName: firstOrder.depName
            });
          }

          const sheetData = createDepartmentSheet(this.todayOrderList, depName || '订单数据', this.todayOrderTotal);
          console.log(`📄 [handleDownloadExcel] Sheet 数据行数: ${sheetData.length} (包含表头和汇总行)`);

          const ws = XLSX.utils.aoa_to_sheet(sheetData);
          const sheetName = depName || '订单数据';
          XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31).replace(/[\\\/\?\*\[\]:]/g, ''));

          // 单部门文件名：包含部门名称（如果有）
          if (depName) {
            const cleanedDepName = cleanFileName(depName);
            fileName = `订单_${cleanedDepName}_${dateStr}.xlsx`;
            console.log(`📝 [handleDownloadExcel] 单部门文件名（含部门名）: "${fileName}"`);
          } else {
            fileName = `订单_${dateStr}.xlsx`;
            console.log(`📝 [handleDownloadExcel] 单部门文件名（无部门名）: "${fileName}"`);
          }
        }

        // 导出文件
        console.log(`💾 [handleDownloadExcel] 准备导出文件: "${fileName}"`);
        console.log(`💾 [handleDownloadExcel] 工作簿包含 ${wb.SheetNames.length} 个 sheet:`, wb.SheetNames);

        XLSX.writeFile(wb, fileName);

        console.log(`✅ [handleDownloadExcel] Excel 导出成功！`);
        console.log(`✅ [handleDownloadExcel] 文件名: ${fileName}`);
        console.log(`✅ [handleDownloadExcel] Sheet 数量: ${wb.SheetNames.length}`);
        console.log(`✅ [handleDownloadExcel] Sheet 列表:`, wb.SheetNames);
        console.log('=== [handleDownloadExcel] Excel 导出完成 ===');
      } catch (error) {
        console.error('❌ [handleDownloadExcel] Excel 导出失败:', error);
        console.error('❌ [handleDownloadExcel] 错误详情:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        alert('导出失败，请重试');
      }
      
    },
    
    // 处理订单状态统计区域点击（连续点击3次显示按钮）
    handleStatsAreaClick() {
      // 清除之前的计时器
      if (this.clickTimer) {
        clearTimeout(this.clickTimer);
      }
      
      // 增加点击次数
      this.clickCount++;
      
      // 如果点击次数达到3次，显示按钮
      if (this.clickCount >= 3) {
        this.showSaveTrainingDataButton = true;
        this.clickCount = 0; // 重置计数
        console.log('✅ 连续点击3次，显示保存训练数据按钮');
      } else {
        // 设置2秒后重置计数（如果2秒内没有继续点击）
        this.clickTimer = setTimeout(() => {
          this.clickCount = 0;
          console.log('⏱️ 点击超时，重置计数');
        }, 2000);
      }
    },
    
    // 显示日期选择器
    handleShowDatePicker() {
      // 设置默认日期为今天
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      this.selectedDate = `${year}-${month}-${day}`;
      this.showDatePicker = true;
    },
    
    // 保存训练数据
    async handleSaveTrainingData() {
      if (!this.selectedDate) {
        alert('请选择日期');
        return;
      }
      
      if (!this.selectedAllCustomer) {
        alert('缺少部门ID');
        return;
      }
      
      try {
        this.$store.commit('SET_LOADING', true);
        
        // 调用API保存数据
        const response = await api.saveDepartmentOrdersToHistory({
          depFatherId: this.selectedAllCustomer,
          date: this.selectedDate
        });
        
        if (response && response.data && response.data.code === 0) {
          alert('保存成功');
          this.showDatePicker = false;
          this.showSaveTrainingDataButton = false; // 保存后隐藏按钮
          this.selectedDate = '';
          
          // 保存成功后，删除该部门的缓存（excel、粘贴、图片）
          this.clearDepartmentCacheByDepFatherId();
          
          // 触发刷新今日订单事件
          this.$emit('order-updated');
        } else {
          alert('保存失败：' + (response?.data?.msg || '未知错误'));
        }
      } catch (error) {
        console.error('保存训练数据失败:', error);
        alert('保存失败：' + (error.message || '网络错误'));
      } finally {
        this.$store.commit('SET_LOADING', false);
      }
    },

    // 清除部门缓存（按照 depFatherId 查找，excel、粘贴、图片）
    clearDepartmentCacheByDepFatherId() {
      console.log('========== [clearDepartmentCacheByDepFatherId] 开始清除部门缓存 ==========');
      console.log('📋 [clearDepartmentCacheByDepFatherId] depFatherId:', this.selectedAllCustomer);

      if (!this.selectedAllCustomer) {
        console.warn('⚠️ [clearDepartmentCacheByDepFatherId] depFatherId无效，跳过清除缓存');
        return;
      }

      // 需要清除的缓存类型
      const cacheTypes = ['excel', 'paste', 'image'];

      for (const sourceType of cacheTypes) {
        const storageKey = `ocrOrderDepList_${sourceType}`;
        console.log(`\n📦 [clearDepartmentCacheByDepFatherId] 处理 ${sourceType} 缓存`);

        try {
          let ocrOrderDepList = [];
          const ocrOrderDepListStr = localStorage.getItem(storageKey);
          if (ocrOrderDepListStr) {
            ocrOrderDepList = JSON.parse(ocrOrderDepListStr);
            if (Array.isArray(ocrOrderDepList)) {
              const beforeCount = ocrOrderDepList.length;
              
              // 按照 depFatherId 查找并删除缓存
              // filter 返回 true 表示保留，返回 false 表示删除
              const filteredList = ocrOrderDepList.filter(item => {
                const itemDepIdStr = String(item.depId || '');
                const itemDepFatherIdStr = String(item.depFatherId || '');
                const currentDepFatherIdStr = String(this.selectedAllCustomer);

                // 如果 depFatherId 匹配，则删除（返回 false）
                const matchDepFatherId = itemDepFatherIdStr === currentDepFatherIdStr || item.depFatherId == this.selectedAllCustomer;
                // 如果 depId 也匹配（可能是父部门自己），也删除（返回 false）
                const matchDepId = itemDepIdStr === currentDepFatherIdStr || item.depId == this.selectedAllCustomer;
                
                return !matchDepFatherId && !matchDepId; // 不匹配的保留
              });
              const afterCount = filteredList.length;

              // 如果过滤后没有数据了，删除整个缓存
              if (filteredList.length === 0) {
                localStorage.removeItem(storageKey);
                console.log(`✅ [clearDepartmentCacheByDepFatherId] 已删除整个 ${sourceType} 缓存`);
              } else {
                // 保存更新后的缓存
                localStorage.setItem(storageKey, JSON.stringify(filteredList));
                const deletedCount = beforeCount - afterCount;
                console.log(`✅ [clearDepartmentCacheByDepFatherId] 已删除 ${deletedCount} 个部门的 ${sourceType} 缓存，剩余 ${filteredList.length} 个部门的缓存`);
              }
            }
          } else {
            console.log(`   - ${sourceType} 缓存不存在或为空`);
          }
        } catch (error) {
          console.error(`❌ [clearDepartmentCacheByDepFatherId] 删除 ${sourceType} 缓存失败:`, error);
        }
      }

      console.log('========== [clearDepartmentCacheByDepFatherId] 缓存清除完成 ==========');
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
  background-color: #f1fbfd;
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

