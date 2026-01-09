<template>
  <div class="bills-container">
<!--    <PageHeader />-->

    <section class="row justify-content-center bill-body">
      <!-- 侧边栏 -->
      <div class="col-md-2 sidebar-container">
        <!-- 客户管理按钮组 -->
        <div class="btn-group w-100 mb-3" role="group" style="flex-shrink: 0;">
          <button type="button" 
                  :class="currentView === 'order' ? 'btn btn-primary' : 'btn btn-outline-primary'" 
                  @click="switchToOrderCustomers">
            配送单
          </button>
          <button type="button" 
                  :class="currentView === 'all' ? 'btn btn-primary' : 'btn btn-outline-primary'" 
                  @click="switchToAllCustomers">
            客户
          </button>
        </div>

        <!-- 未打印订单客户列表 -->
        <div v-if="currentView === 'order'" class="box customer-list-box">
          <div class="box-body no-padding customer-list-body">
            <!-- 有数据时显示列表 -->
            <ul v-if="depList.length > 0 || gbBatchArr.length > 0" class="nav nav-pills nav-stacked customer-list">
              <li v-for="(item, index) in depList" :key="item.nxDepartmentId" :id="item.nxDepartmentId"
                :class="{ 'active': isactive === index, 'tab-item': true }"
                @click="onclick(index, item.nxDepartmentId, item.nxDepartmentId,item.nxDepartmentAttrName, '',item.nxDepartmentPrintName , item.nxDepartmentSubAmount)">
                <a>{{ item.nxDepartmentName }}</a>
                <ul v-if="item.nxDepartmentEntities && item.nxDepartmentEntities.length > 0" class="sub-department-list"
                  style="list-style-type: none; padding-left: 20px;">
                  <li v-for="(subItem, subIndex) in item.nxDepartmentEntities" :key="subItem.nxDepartmentId"
                    :class="{ 'active': issubactive === subIndex && isactive === index, 'tab-item-sub': true }"
                    @click="childClick(index, subIndex, item.nxDepartmentId, subItem.nxDepartmentId, item.nxDepartmentAttrName,  '-'+subItem.nxDepartmentAttrName, subItem.nxDepartmentPrintName,$event, item.nxDepartmentSubAmount)">
                    <a>{{ subItem.nxDepartmentName }}</a>
                  </li>
                </ul>
              </li>

              <!-- 改进 nav 样式，确保垂直排列 -Gb-- ---->
      <li v-for="(item, index) in gbBatchArr" :key="item.gbDepartmentId" :id="item.gbDepartmentId"
                :class="{ 'active': isactivepb === index, 'tab-item': true }"
                @click="onclickPb(index, item.gbDistributerPurchaseBatchId, item.gbDistributerEntity.gbDistributerPrintName)">
                <a>{{ item.gbDistributerEntity.gbDistributerName }}</a>
              </li>
              <!-- 显示子部门 -->
            </ul>
            
            <!-- 无数据时显示提示 -->
            <div v-else class="empty-customer-list text-center p-4">
              <div class="text-muted">
                <div class="mb-2" style="font-size: 48px;">📋</div>
                <div class="fw-bold mb-1">暂无配送单客户</div>
                <div class="small">请等待数据加载或联系管理员</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 全部客户列表 -->
        <div v-if="currentView === 'all'" class="box customer-list-box">
          <div class="box-body no-padding customer-list-body">
            <!-- 现金客户 -->
            <div class="customer-type-section">
              <h6 
                class="text-muted customer-type-header" 
                @click="toggleCustomerType('cash')"
                style="cursor: pointer; user-select: none;">
                <span class="me-2">{{ collapsedCustomerTypes.cash ? '▶' : '▼' }}</span>
                现金客户
                <span class="badge bg-secondary ms-2">{{ myCustomerArrOne.length }}</span>
              </h6>
              <ul v-show="!collapsedCustomerTypes.cash" class="nav nav-pills nav-stacked">
                <li v-for="customer in myCustomerArrOne" :key="customer.nxDepartmentId"
                    :class="{ 'active': selectedAllCustomer === customer.nxDepartmentId }"
                    @click="selectAllCustomer(customer.nxDepartmentId, customer)">
                  <a>{{ customer.nxDepartmentAttrName }}</a>
                </li>
              </ul>
            </div>

            <!-- 记账客户 -->
            <div class="customer-type-section">
              <h6 
                class="text-muted customer-type-header" 
                @click="toggleCustomerType('credit')"
                style="cursor: pointer; user-select: none;">
                <span class="me-2">{{ collapsedCustomerTypes.credit ? '▶' : '▼' }}</span>
                记账客户
                <span class="badge bg-secondary ms-2">{{ myCustomerArrTwo.length }}</span>
              </h6>
              <ul v-show="!collapsedCustomerTypes.credit" class="nav nav-pills nav-stacked">
                <li v-for="customer in myCustomerArrTwo" :key="customer.nxDepartmentId"
                    :class="{ 'active': selectedAllCustomer === customer.nxDepartmentId }"
                    @click="selectAllCustomer(customer.nxDepartmentId, customer)">
                  <a>{{ customer.nxDepartmentAttrName }}</a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- 主内容区域 -->
      <div class="col-md-10 main-content-container">
        <!-- 未打印订单客户视图 - 显示订单详情组件 -->
        <keep-alive v-if="currentView === 'order' && depPrintName && depPrintName !== ''">
            <component :is="depPrintName" :nxDepFatherId="nxDepFatherId" :nxDepId="nxDepId" :depName="depName" :depPrintName="depPrintName"
              :updateTime="updateTime" :disId="disId" :disName="disName" :gbDepFatherId="gbDepFatherId" :gbDepId="gbDepId"
                :gbDepName="gbDepName" :gbDisId="gbDisId" :gbBatchId="gbBatchId"
              
        @order-saved="switchToOrderCustomers"
        @print-only="handlePrintOnly"
              ></component>
          </keep-alive>
        
        <!-- 配送单视图 - 无数据提示 -->
        <div v-else-if="currentView === 'order'" class="empty-order-content text-center p-5">
          <div class="text-muted">
            <div class="mb-3" style="font-size: 64px;">📦</div>
            <h5 class="fw-bold mb-2">暂无配送单数据</h5>
            <p class="mb-0">请在左侧选择客户查看订单详情</p>
          </div>
        </div>

        <!-- 全部客户视图 - 显示两个标签页 -->
        <div v-if="currentView === 'all'">
          <!-- 未选择客户时的提示 -->
          <div v-if="!selectedAllCustomer" class="text-center p-5">
            <div class="alert alert-info">
              <h5>请选择客户</h5>
              <p class="mb-0">在左侧客户列表中点击任意客户，右侧将显示该客户的相关信息</p>
            </div>
          </div>

          <!-- 已选择客户时显示标签页 -->
          <div v-if="selectedAllCustomer" class="card shadow-lg p-4">
            <!-- 客户信息行：客户名称、类型、子部门、订单保存路径 -->
            <div class="d-flex align-items-center justify-content-between mb-3 pb-3 border-bottom">
              <div class="d-flex align-items-center gap-3 flex-grow-1">
                <h5 class="mb-0">
                  <span class="text-muted">{{ customerType === 'cash' ? '现金' : '记账' }}</span>
                  客户：{{ selectedCustomerName }}
                </h5>
                
                <!-- 子部门选择（如果有子部门） -->
                <div v-if="hasSubDepartments" class="d-flex align-items-center gap-2">
                  <span class="text-muted">部门：</span>
                  <select 
                    v-model="selectedSubDepartment" 
                    @change="handleSubDepartmentChange"
                    class="form-select form-select-sm"
                    style="width: auto; min-width: 150px;">
                    <option 
                      v-for="subDept in selectedCustomerEntity.nxDepartmentEntities" 
                      :key="subDept.nxDepartmentId"
                      :value="subDept.nxDepartmentId">
                      {{ subDept.nxDepartmentAttrName || subDept.nxDepartmentName }}
                    </option>
                  </select>
                </div>
              </div>
              
              <!-- 订单保存路径（显示在右侧） -->
              <div class="d-flex align-items-center gap-2">
                <span class="text-muted small">📁 订单保存路径：</span>
                <span v-if="customerFolderPath" class="text-muted small" style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" :title="customerFolderPath">
                  {{ customerFolderPath }}
                </span>
                <span v-else class="text-warning small">未设置</span>
                <button 
                  class="btn btn-sm btn-primary" 
                  @click="selectCustomerFolder"
                  :disabled="selectingFolder">
                  <span v-if="selectingFolder" class="spinner-border spinner-border-sm me-1"></span>
                  {{ selectingFolder ? '选择中...' : '选择' }}
                </button>
                <button 
                  v-if="customerFolderPath"
                  class="btn btn-sm btn-outline-secondary" 
                  @click="clearCustomerFolder">
                  清除
                </button>
              </div>
            </div>
            
            <!-- 主标签页：今日订单 / 下单 / 历史订单 -->
            <ul class="nav nav-tabs mb-3" role="tablist">
              <li class="nav-item" role="presentation">
                <button 
                  class="nav-link" 
                  :class="{ 'active': allCustomerTabIndex === 0 }" 
                  type="button" 
                  role="tab"
                  @click="switchAllCustomerTab(0)">
                  💾 今日订单
                </button>
              </li>
              <li class="nav-item" role="presentation">
                <button 
                  class="nav-link" 
                  :class="{ 'active': allCustomerTabIndex === 1 }" 
                  type="button" 
                  role="tab"
                  @click="switchAllCustomerTab(1)">
                  ➕ 下单
                </button>
              </li>
              <li class="nav-item" role="presentation">
                <button 
                  class="nav-link" 
                  :class="{ 'active': allCustomerTabIndex === 2 }" 
                  type="button" 
                  role="tab"
                  @click="switchAllCustomerTab(2)">
                  📋 历史订单
                </button>
              </li>
            </ul>

            <!-- 标签页内容 -->
            <div class="tab-content">
              <!-- 标签1：今日订单 -->
              <div v-if="allCustomerTabIndex === 0" class="tab-pane fade show active" role="tabpanel">
                    <div class="saved-orders-tab" style="height: calc(100vh - 300px); overflow: hidden; display: flex; flex-direction: column;">
                      <!-- 订单列表显示区域 -->
                      <div class="order-list-container" style="flex: 1; min-height: 0; overflow-y: auto;">
                        <!-- 无子部门的情况 -->
                        <div v-if="!hasSubDepartments || !selectedSubDepartment">
                          <!-- 表头 -->
                          <div class="table-header bg-light border-bottom p-2 d-flex align-items-center fw-bold small">
                            <div style="width: 40px; flex-shrink: 0;" class="text-center">序号</div>
                            <div style="flex: 1; min-width: 0;">商品名称</div>
                            <div style="width: 80px; flex-shrink: 0;" class="text-center">订货</div>
                            <div style="width: 80px; flex-shrink: 0;" class="text-center">出货</div>
                            <div style="width: 100px; flex-shrink: 0;" class="text-center">单价</div>
                            <div style="width: 100px; flex-shrink: 0;" class="text-end">小计</div>
                            <div style="width: 60px; flex-shrink: 0;" class="text-center">操作</div>
                          </div>
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
                              <div style="width: 40px; flex-shrink: 0;" class="text-center fw-bold">{{ index + 1 }}</div>
                              <div style="flex: 1; min-width: 0;">
                                <div class="d-flex align-items-center flex-wrap">
                                  <span v-if="order.nxDistributerGoodsEntity && order.nxDistributerGoodsEntity.nxDgGoodsBrand && order.nxDistributerGoodsEntity.nxDgGoodsBrand !== 'null'" class="text-muted small me-1">
                                    {{ order.nxDistributerGoodsEntity.nxDgGoodsBrand }}
                                  </span>
                                  <span class="fw-bold me-1">{{ order.nxDistributerGoodsEntity?.nxDgGoodsName || order.nxDoGoodsName }}</span>
                                  <span v-if="order.nxDepartmentDisGoodsEntity && order.nxDepartmentDisGoodsEntity.nxDdgOrderGoodsName !== order.nxDistributerGoodsEntity?.nxDgGoodsName && order.nxDepartmentDisGoodsEntity.nxDdgOrderGoodsName !== order.nxDoGoodsName" class="text-muted small me-1">
                                    ({{ order.nxDepartmentDisGoodsEntity.nxDdgOrderGoodsName }})
                                  </span>
                                  <span v-if="order.nxDoGoodsName && order.nxDoGoodsName !== order.nxDistributerGoodsEntity?.nxDgGoodsName" class="text-muted small me-1">
                                    ({{ order.nxDoGoodsName }})
                                  </span>
                                  <span v-if="order.nxDistributerGoodsEntity?.nxDgGoodsPlace && order.nxDistributerGoodsEntity.nxDgGoodsPlace !== 'null'" class="text-muted small me-1">
                                    ({{ order.nxDistributerGoodsEntity.nxDgGoodsPlace }})
                                  </span>
                                  <span v-if="order.nxDistributerGoodsEntity?.nxDgGoodsDetail && order.nxDistributerGoodsEntity.nxDgGoodsDetail !== 'null'" class="text-muted small me-1">
                                    {{ order.nxDistributerGoodsEntity.nxDgGoodsDetail }}
                                  </span>
                                  <span v-if="order.nxDistributerGoodsEntity?.nxDgGoodsStandardWeight && order.nxDistributerGoodsEntity.nxDgGoodsStandardWeight !== 'null'" class="text-muted small me-1">
                                    ({{ order.nxDistributerGoodsEntity.nxDgGoodsStandardname }}/{{ order.nxDistributerGoodsEntity.nxDgGoodsStandardWeight }})
                                  </span>
                                  <span v-if="order.nxDistributerGoodsEntity?.nxDgGoodsStandardname !== order.nxDoPrintStandard" class="text-muted small me-1">
                                    ({{ order.nxDoPrintStandard }})
                                  </span>
                                  <span v-if="order.nxDoRemark" class="text-danger small">({{ order.nxDoRemark }})</span>
                                </div>
                              </div>
                              <div style="width: 80px; flex-shrink: 0;" class="text-center small">{{ order.nxDoQuantity }}{{ order.nxDoStandard }}</div>
                              <div style="width: 80px; flex-shrink: 0;" class="text-center small">
                                <span v-if="order.nxDoWeight !== null">{{ order.nxDoWeight }}{{ order.nxDoPrintStandard }}</span>
                                <span v-else class="text-muted">-</span>
                              </div>
                              <div style="width: 100px; flex-shrink: 0;" class="text-center small">
                                <span :class="{ 'text-danger': order.nxDoPrice == '0.1' || order.nxDoPrice == '' }">
                                  {{ order.nxDoPrice == 0.1 || order.nxDoPrice == '' ? '-' : order.nxDoPrice }}
                                </span>
                                <span class="text-muted">/{{ order.nxDoPrintStandard }}</span>
                              </div>
                              <div style="width: 100px; flex-shrink: 0;" class="text-end small">
                                <span v-if="order.nxDoSubtotal !== null || order.nxDoSubtotal == ''">
                                  <span :class="{ 'text-danger': order.nxDoPrice == '0.1' || order.nxDoPrice == '' }">
                                    {{ order.nxDoPrice == 0.1 || order.nxDoPrice == '' ? '-' : order.nxDoSubtotal }}
                                  </span>
                                  <span class="text-muted">元</span>
                                </span>
                                <span v-else class="text-muted">-</span>
                              </div>
                              <div style="width: 60px; flex-shrink: 0;" class="text-center">
                                <button 
                                  class="btn btn-link btn-sm p-0"
                                  @click="openOrderOperation(order, index, 'list')"
                                  style="color: #6c757d; text-decoration: none;"
                                  title="操作">
                                  <span style="font-size: 18px;">⋯</span>
                                </button>
                              </div>
                            </div>
                            <div v-else class="d-flex align-items-center">
                              <div style="width: 40px; flex-shrink: 0;" class="text-center fw-bold">{{ index + 1 }}</div>
                              <div style="flex: 1; min-width: 0;">
                                <span class="text-danger small me-2">(未完成)</span>
                                <span class="me-2">{{ order.nxDoGoodsName }}</span>
                                <span v-if="order.nxDoRemark" class="text-danger small">({{ order.nxDoRemark }})</span>
                              </div>
                              <div style="width: 80px; flex-shrink: 0;" class="text-center small">{{ order.nxDoQuantity }}{{ order.nxDoStandard }}</div>
                              <div style="width: 80px; flex-shrink: 0;" class="text-center small text-muted">-</div>
                              <div style="width: 100px; flex-shrink: 0;" class="text-center small text-muted">-</div>
                              <div style="width: 100px; flex-shrink: 0;" class="text-end small text-muted">-</div>
                              <div style="width: 60px; flex-shrink: 0;" class="text-center">
                                <button 
                                  class="btn btn-link btn-sm p-0"
                                  @click="openOrderOperation(order, index, 'list')"
                                  style="color: #6c757d; text-decoration: none;"
                                  title="操作">
                                  <span style="font-size: 18px;">⋯</span>
                                </button>
                              </div>
                            </div>
                          </div>
                          <div v-if="todayOrderList.length === 0" class="text-center p-5 text-muted">
                            暂无已保存的订单
                          </div>
                        </div>

                        <!-- 有子部门的情况 -->
                        <div v-else>
                          <div v-for="(dep, depIndex) in filteredTodayOrderDepArr" :key="dep.depId || depIndex" class="mb-3">
                            <div class="d-flex justify-content-between align-items-center p-2 bg-light border-bottom">
                              <span class="text-primary fw-bold">#{{ dep.depName }}</span>
                              <span class="text-muted">¥:{{ dep.depSubtotal }}元</span>
                            </div>
                            <!-- 表头 -->
                            <div class="table-header bg-light border-bottom p-2 d-flex align-items-center fw-bold small">
                              <div style="width: 40px; flex-shrink: 0;" class="text-center">序号</div>
                              <div style="flex: 1; min-width: 0;">商品名称</div>
                              <div style="width: 80px; flex-shrink: 0;" class="text-center">订货</div>
                              <div style="width: 80px; flex-shrink: 0;" class="text-center">出货</div>
                              <div style="width: 100px; flex-shrink: 0;" class="text-center">单价</div>
                              <div style="width: 100px; flex-shrink: 0;" class="text-end">小计</div>
                              <div style="width: 60px; flex-shrink: 0;" class="text-center">操作</div>
                            </div>
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
                                <div class="col-1 text-center fw-bold">{{ index + 1 }}</div>
                                <div class="col-5">
                                  <div class="d-flex align-items-center flex-wrap">
                                    <span v-if="order.nxDistributerGoodsEntity && order.nxDistributerGoodsEntity.nxDgGoodsBrand && order.nxDistributerGoodsEntity.nxDgGoodsBrand !== 'null'" class="text-muted small me-1">
                                      {{ order.nxDistributerGoodsEntity.nxDgGoodsBrand }}
                                    </span>
                                    <span class="fw-bold me-1">{{ order.nxDistributerGoodsEntity?.nxDgGoodsName || order.nxDoGoodsName }}</span>
                                    <span v-if="order.nxDepartmentDisGoodsEntity && order.nxDepartmentDisGoodsEntity.nxDdgOrderGoodsName !== order.nxDistributerGoodsEntity?.nxDgGoodsName" class="text-muted small me-1">
                                      ({{ order.nxDepartmentDisGoodsEntity.nxDdgOrderGoodsName }})
                                    </span>
                                    <span v-if="order.nxDoGoodsName && order.nxDoGoodsName !== order.nxDistributerGoodsEntity?.nxDgGoodsName" class="text-muted small me-1">
                                      ({{ order.nxDoGoodsName }})
                                    </span>
                                    <span v-if="order.nxDistributerGoodsEntity?.nxDgGoodsPlace && order.nxDistributerGoodsEntity.nxDgGoodsPlace !== 'null'" class="text-muted small me-1">
                                      ({{ order.nxDistributerGoodsEntity.nxDgGoodsPlace }})
                                    </span>
                                    <span v-if="order.nxDistributerGoodsEntity?.nxDgGoodsDetail && order.nxDistributerGoodsEntity.nxDgGoodsDetail !== 'null'" class="text-muted small me-1">
                                      {{ order.nxDistributerGoodsEntity.nxDgGoodsDetail }}
                                    </span>
                                    <span v-if="order.nxDistributerGoodsEntity?.nxDgGoodsStandardWeight && order.nxDistributerGoodsEntity.nxDgGoodsStandardWeight !== 'null'" class="text-muted small me-1">
                                      ({{ order.nxDistributerGoodsEntity.nxDgGoodsStandardname }}/{{ order.nxDistributerGoodsEntity.nxDgGoodsStandardWeight }})
                                    </span>
                                    <span v-if="order.nxDistributerGoodsEntity?.nxDgGoodsStandardname !== order.nxDoPrintStandard" class="text-muted small me-1">
                                      ({{ order.nxDoPrintStandard }})
                                    </span>
                                    <span v-if="order.nxDoRemark" class="text-danger small">({{ order.nxDoRemark }})</span>
                                  </div>
                                </div>
                                <div class="col-1 text-center small">{{ order.nxDoQuantity }}{{ order.nxDoStandard }}</div>
                                <div class="col-1 text-center small">
                                  <span v-if="order.nxDoWeight !== null" :class="{ 'text-danger': order.nxDoWeight == '' }">
                                    {{ order.nxDoWeight == '' ? '-' : order.nxDoWeight }}{{ order.nxDoPrintStandard }}
                                  </span>
                                  <span v-else class="text-muted">-</span>
                                </div>
                                <div class="col-2 text-center small">
                                  <span :class="{ 'text-danger': order.nxDoPrice == '0.1' || order.nxDoPrice == '' }">
                                    {{ order.nxDoPrice == 0.1 || order.nxDoPrice == '' ? '-' : order.nxDoPrice }}
                                  </span>
                                  <span class="text-muted">/{{ order.nxDoPrintStandard }}</span>
                                </div>
                                <div class="col-2 text-end small">
                                  <span v-if="order.nxDoSubtotal !== null || order.nxDoSubtotal == ''">
                                    <span :class="{ 'text-danger': order.nxDoPrice == '0.1' || order.nxDoPrice == '' }">
                                      {{ order.nxDoPrice == 0.1 || order.nxDoPrice == '' ? '-' : order.nxDoSubtotal }}
                                    </span>
                                    <span class="text-muted">元</span>
                                  </span>
                                  <span v-else class="text-muted">-</span>
                                </div>
                                <div class="col-1 text-center">
                                  <button 
                                    class="btn btn-link btn-sm p-0"
                                    @click="openOrderOperation(order, index, 'dep', depIndex)"
                                    style="color: #6c757d; text-decoration: none;"
                                    title="操作">
                                    <span style="font-size: 18px;">⋯</span>
                                  </button>
                                </div>
                              </div>
                              <div v-else class="d-flex align-items-center">
                                <div class="col-1 text-center fw-bold">{{ index + 1 }}</div>
                                <div class="col-5">
                                  <span class="text-danger small me-2">(未完成)</span>
                                  <span class="me-2">{{ order.nxDoGoodsName }}</span>
                                  <span v-if="order.nxDoRemark" class="text-danger small">({{ order.nxDoRemark }})</span>
                                </div>
                                <div class="col-1 text-center small">{{ order.nxDoQuantity }}{{ order.nxDoStandard }}</div>
                                <div class="col-1 text-center small text-muted">-</div>
                                <div class="col-2 text-center small text-muted">-</div>
                                <div class="col-2 text-end small text-muted">-</div>
                                <div class="col-1 text-center">
                                  <button 
                                    class="btn btn-link btn-sm p-0"
                                    @click="openOrderOperation(order, index, 'dep', depIndex)"
                                    style="color: #6c757d; text-decoration: none;"
                                    title="操作">
                                    <span style="font-size: 18px;">⋯</span>
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

                      <!-- 操作菜单弹窗 -->
                      <div v-if="showOrderOperationMenu" class="order-operation-overlay" @click.self="closeOrderOperationMenu">
                        <div class="order-operation-menu">
                          <div class="operation-menu-item" @click="openEditOrderModal">
                            <span class="me-2">✏️</span>
                            修改订单
                          </div>
                          <div class="operation-menu-item text-danger" @click="handleDeleteTodayOrder">
                            <span class="me-2">🗑️</span>
                            删除订单
                          </div>
                        </div>
                      </div>

                      <!-- 修改订单弹窗 -->
                      <div v-if="showEditOrderModal" class="order-edit-overlay" @click.self="closeEditOrderModal">
                        <div class="order-edit-popup">
                          <!-- 顶部商品名称 -->
                          <div class="popup-header text-center p-3 bg-light border-bottom">
                            <div class="d-flex align-items-center justify-content-center flex-wrap mb-2">
                              <span v-if="currentEditOrderItem?.nxDistributerGoodsEntity?.nxDgGoodsBrand && currentEditOrderItem.nxDistributerGoodsEntity.nxDgGoodsBrand !== 'null'" class="brand me-2">
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
                            <div class="input-group mb-3 d-flex align-items-center justify-content-between">
                              <label class="form-label mb-0 me-3">单位:</label>
                              <div class="d-flex flex-wrap gap-2" style="flex: 1;">
                                <button
                                  v-for="standard in availableStandards"
                                  :key="standard"
                                  class="btn btn-sm"
                                  :class="editOrderForm.standard === standard ? 'btn-primary' : 'btn-outline-secondary'"
                                  @click="editOrderForm.standard = standard">
                                  {{ standard }}
                                </button>
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
                          <div class="popup-footer d-flex justify-content-end gap-2 p-3 border-top bg-light">
                            <button class="btn btn-sm btn-secondary" @click="closeEditOrderModal">取消</button>
                            <button class="btn btn-sm btn-success" @click="saveEditOrder">保存</button>
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
                  </div>

                  <!-- 子标签2：下单 -->
                  <div v-if="todayOrderTabIndex === 1" class="tab-pane fade show active" role="tabpanel">
                <div class="save-order-tab" style="height: calc(100vh - 300px); overflow: hidden; display: flex; flex-direction: column;">
                  <!-- 上传方式选择 -->
                  <div class="mb-3">
                    <div class="form-group d-flex gap-3 align-items-center flex-wrap">
                      <label class="mb-0" style="cursor: pointer;">
                        <input 
                          type="radio" 
                          v-model="uploadType" 
                          value="excel" 
                          class="me-2"
                          @change="handleUploadTypeChange('excel')">
                        上传Excel表
                      </label>
                      <label class="mb-0" style="cursor: pointer;">
                        <input 
                          type="radio" 
                          v-model="uploadType" 
                          value="image" 
                          class="me-2"
                          @change="handleUploadTypeChange('image')">
                        上传图片
                      </label>
                      <label class="mb-0" style="cursor: pointer;">
                        <input 
                          type="radio" 
                          v-model="uploadType" 
                          value="paste" 
                          class="me-2"
                          @change="handleUploadTypeChange('paste')">
                        复制粘贴
                      </label>
                      <label class="mb-0" style="cursor: pointer;">
                        <input 
                          type="radio" 
                          v-model="uploadType" 
                          value="auto" 
                          class="me-2"
                          @change="handleUploadTypeChange('auto')">
                        🔄 转订单
                      </label>
                    </div>
                    <small class="text-muted d-block mt-2">当前选择：{{ uploadType === 'auto' ? '转订单（自动处理文件夹）' : uploadType }}</small>
                  </div>

                  <!-- Excel上传区域 - 左右分栏布局 -->
                  <div v-if="uploadType === 'excel'" class="upload-section mb-3" style="flex: 1; min-height: 400px; display: flex; flex-direction: column; overflow: hidden;">
                    <div class="row g-3" style="flex: 1; min-height: 400px; overflow: hidden;">
                      <!-- 左侧：Excel文件上传和预览 -->
                      <div :class="orderItems.length > 0 ? 'col-md-6' : 'col-12'" style="display: flex; flex-direction: column; min-height: 400px; overflow: hidden;">
                        <div class="card h-100 p-3" style="display: flex; flex-direction: column; min-height: 400px; overflow-y: auto;">
                          <!-- 文件选择功能（始终显示，允许重新上传） -->
                          <div v-if="uploadType === 'excel'" style="flex-shrink: 0;">
                      <label class="form-label">选择Excel文件</label>
                      <input 
                        type="file" 
                        ref="excelFileInput"
                        accept=".xlsx,.xls"
                        @change="handleExcelUpload"
                        class="form-control mb-2"
                      />
                      <small class="text-muted">支持 .xlsx 和 .xls 格式</small>
                          </div>
                          
                          <!-- 显示已上传的文件信息和Excel预览 -->
                          <!-- 显示已上传的文件信息和Excel预览 -->
                          <div v-if="uploadedExcelFile" class="mt-3">
                            <div class="p-2 bg-light rounded mb-2">
                              <div class="d-flex justify-content-between align-items-center">
                                <div>
                                  <div class="fw-bold">📄 {{ uploadedExcelFile.name }}</div>
                                  <div class="small text-muted">
                                    大小: {{ formatFileSize(uploadedExcelFile.size) }}
                                  </div>
                                </div>
                                <button 
                                  class="btn btn-sm btn-outline-danger"
                                  @click="clearUploadedExcelFile"
                                  title="清除文件">
                                  ✕
                                </button>
                    </div>
                  </div>

                            <!-- Excel内容预览 -->
                            <div v-if="uploadedExcelPreview" class="border rounded p-2" style="max-height: 400px; overflow-y: auto;">
                              <div v-if="uploadedExcelPreview.sheets && uploadedExcelPreview.sheets.length > 0">
                                <!-- 工作表选择 -->
                                <div v-if="uploadedExcelPreview.sheets.length > 1" class="mb-2">
                                  <select 
                                    class="form-select form-select-sm"
                                    :value="uploadedExcelPreview.currentSheet || 0"
                                    @change="changeUploadedExcelSheet($event.target.value)">
                                    <option 
                                      v-for="(sheet, sheetIndex) in uploadedExcelPreview.sheets" 
                                      :key="sheetIndex"
                                      :value="sheetIndex">
                                      {{ sheet.name }}
                                    </option>
                                  </select>
                                </div>
                                <!-- 表格显示 -->
                                <div class="table-responsive">
                                  <table class="table table-sm table-bordered" style="font-size: 11px;">
                                    <tbody>
                                      <tr v-for="(row, rowIndex) in getUploadedExcelSheetData()" :key="rowIndex">
                                        <td 
                                          v-for="(cell, cellIndex) in row" 
                                          :key="cellIndex"
                                          :class="{ 'bg-light': rowIndex === 0 }"
                                          style="padding: 4px; white-space: nowrap;">
                                          {{ cell || '' }}
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                              <div v-else class="text-muted small">Excel文件为空或无法读取</div>
                            </div>
                            <div v-else-if="uploadedExcelFile" class="border rounded p-2 text-center">
                              <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                              <span class="small text-muted">加载Excel预览中...</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <!-- 右侧：订单列表（Excel模式） -->
                      <div v-if="orderItems.length > 0" class="col-md-6 order-items-section" style="display: flex; flex-direction: column; height: 100%; min-height: 0; max-height: 100%; overflow: hidden;">
                        <div class="d-flex justify-content-between align-items-center mb-3" style="flex-shrink: 0;">
                          <h6 class="mb-0">转换订单 ({{ orderItems.length }} 项)</h6>
                          <div class="d-flex gap-2">
                            <button 
                              v-if="hasCache"
                              class="btn btn-warning btn-sm" 
                              @click="clearSave">
                              清除草稿
                            </button>
                            <button 
                              class="btn btn-success btn-sm" 
                              @click="pasteSearchGoods"
                              :disabled="savingOrder">
                              {{ savingOrder ? '保存中...' : '保存订单' }}
                            </button>
                          </div>
                        </div>
                        
                        <!-- 订单列表（参考微信小程序样式） -->
                        <div class="order-list-container flex-grow-1" style="overflow-y: auto; border: 1px solid #dee2e6; border-radius: 0.375rem; padding: 1rem; min-height: 400px;">
                          <div 
                            v-for="(item, orderIndex) in orderItems" 
                            :key="orderIndex"
                            class="order-item-card mb-2 p-3 bg-white rounded shadow-sm"
                            :class="{ 'border-success': item.nxDoStatus === -2, 'border-primary': item.nxDoStatus === 0 }"
                            style="border-left: 4px solid; position: relative;">
                            
                            <!-- 订单行 -->
                            <div class="d-flex align-items-center gap-2 mb-2">
                              <!-- 序号 -->
                              <span class="text-secondary fw-bold" style="min-width: 30px;">{{ orderIndex + 1 }}.</span>
                              
                              <!-- 来源文件标识（转订单时显示） -->
                              <!-- 商品名称（可编辑） -->
                              <div class="flex-grow-1 position-relative" style="min-width: 0;">
                                <div class="d-flex align-items-center">
                                  <span v-if="item.nxDoStatus === 0" class="text-dark flex-grow-1">
                                    {{ item.nxDoGoodsName || '请输入商品名称' }}
                                  </span>
                                  <input 
                                    v-else
                                    type="text" 
                                    :value="item.nxDoGoodsName"
                                    @input="editOrderName($event, orderIndex)"
                                    class="form-control form-control-sm flex-grow-1"
                                    :class="{ 'border-success': item.nxDoStatus === -2 }"
                                    placeholder="请输入商品名称"
                                    style="font-size: 14px;"
                                  />
                                  <!-- 显示已匹配商品列表的图标 -->
                                  <button
                                    v-if="orderArrIndex !== orderIndex && item.nxDoStatus !== 0 && (item.nxDistributerGoodsEntityList && item.nxDistributerGoodsEntityList.length > 0 || item.nxGoodsEntities && item.nxGoodsEntities.length > 0)"
                                    class="btn btn-link btn-sm p-1 ms-2"
                                    @click="toggleMatchedGoods(orderIndex)"
                                    :title="showMatchedGoods[orderIndex] ? '隐藏已匹配商品' : '显示已匹配商品'"
                                    style="flex-shrink: 0; text-decoration: none; color: #6c757d;"
                                  >
                                    <span v-if="showMatchedGoods[orderIndex]">▼</span>
                                    <span v-else>▶</span>
                                  </button>
                                </div>
                                
                                <!-- 已匹配的商品列表（参考微信小程序第102-147行） -->
                                <!-- 当不在编辑当前订单时，显示已匹配的商品列表 -->
                                <div 
                                  v-if="orderArrIndex !== orderIndex && item.nxDoStatus !== 0 && showMatchedGoods[orderIndex] && (item.nxDistributerGoodsEntityList && item.nxDistributerGoodsEntityList.length > 0 || item.nxGoodsEntities && item.nxGoodsEntities.length > 0)"
                                  class="matched-goods-list position-absolute bg-white border rounded shadow-lg p-2"
                                  style="top: 100%; left: 0; right: 0; z-index: 999; max-height: 400px; overflow-y: auto; margin-top: 4px; border-left: 1px solid gray;">
                                  
                                  <!-- 标题栏和关闭按钮 -->
                                  <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                                    <span class="text-muted small fw-bold">已匹配商品列表</span>
                                    <button 
                                      class="btn btn-sm btn-link p-0"
                                      @click="toggleMatchedGoods(orderIndex)"
                                      style="font-size: 12px; color: #6c757d;"
                                      title="隐藏">
                                      ✕
                                    </button>
                                  </div>
                                  
                                  <!-- 配送商已匹配商品列表 -->
                                  <div v-if="item.nxDistributerGoodsEntityList && item.nxDistributerGoodsEntityList.length > 0" class="mb-2">
                                    <div 
                                      v-for="(orderGoods, orderGoodsIndex) in item.nxDistributerGoodsEntityList" 
                                      :key="orderGoods.nxDistributerGoodsId || orderGoodsIndex"
                                      class="matched-goods-item p-2 mb-1 rounded hover-bg d-flex align-items-center justify-content-between"
                                      @click="saveOrder(orderGoods, orderIndex)"
                                      style="cursor: pointer; background-color: #ffffff; border-bottom: 1px solid #f0f0f0; padding: 12px 16px;">
                                      <div class="flex-grow-1">
                                        <span class="text-muted fw-bold me-2" style="color: #666;">({{ orderGoodsIndex + 1 }}).</span>
                                        <span v-if="orderGoods.nxDgGoodsBrand && orderGoods.nxDgGoodsBrand !== 'null'" 
                                              class="badge bg-warning text-dark me-1">
                                          {{ orderGoods.nxDgGoodsBrand }}
                                        </span>
                                        <span class="text-dark" style="color: #333; font-weight: 500;">{{ orderGoods.nxDgGoodsName }}</span>
                                        <span class="text-muted small ms-1" style="color: #666;">
                                          ({{ orderGoods.nxDgGoodsStandardWeight && orderGoods.nxDgGoodsStandardWeight !== 'null' 
                                            ? orderGoods.nxDgGoodsStandardWeight + '/' + orderGoods.nxDgGoodsStandardname 
                                            : orderGoods.nxDgGoodsStandardname }})
                                        </span>
                                      </div>
                                      <button class="btn btn-success btn-sm" style="flex-shrink: 0; min-width: 80px; padding: 8px 16px;">
                                        选择
                                      </button>
                                    </div>
                                  </div>
                                  
                                  <!-- 系统已匹配商品列表（参考微信小程序第121-145行） -->
                                  <div v-if="item.nxGoodsEntities && item.nxGoodsEntities.length > 0" 
                                       class="mb-2"
                                       style="border-left: 1px solid gray; border-right: 1px solid gray; border-bottom: 1px solid gray;">
                                    <div 
                                      v-for="(goods, nxIndex) in item.nxGoodsEntities" 
                                      :key="goods.nxGoodsId || nxIndex"
                                      class="matched-goods-item p-2 mb-1 d-flex align-items-center justify-content-between"
                                      style="width: 100%; border-bottom: 1px solid #f0f0f0; padding: 12px 16px; box-sizing: border-box;">
                                      <div class="flex-grow-1 d-flex align-items-center" style="flex: 1; padding: 10px; min-height: 60px; margin-right: 20px; width: calc(100% - 100px);">
                                        <span class="text-muted fw-bold me-2" style="color: #666; min-width: 40px; flex-shrink: 0;">{{ nxIndex + 1 }}.</span>
                                        <div class="d-flex flex-wrap align-items-center" style="flex: 1; padding: 10px; min-height: 40px; overflow: hidden;">
                                          <span v-if="goods.nxGoodsBrand && goods.nxGoodsBrand !== 'null'" 
                                                class="badge bg-warning text-dark me-1">
                                            {{ goods.nxGoodsBrand }}
                                          </span>
                                          <span class="text-dark fw-bold me-2" style="color: #333; font-weight: 500;">{{ goods.nxGoodsName }}</span>
                                          <span v-if="goods.nxAliasEntities && goods.nxAliasEntities.length > 0" 
                                                v-for="(alias, aliasIndex) in goods.nxAliasEntities" 
                                                :key="alias.nxDaAliasName || aliasIndex"
                                                class="text-primary me-1" 
                                                style="color: #1c7efb; margin-right: 8px;">
                                            @{{ alias.nxDaAliasName }}
                                          </span>
                                          <span class="text-muted small ms-1" style="color: #666; margin-right: 12px;">
                                            <template v-if="goods.nxGoodsStandardWeight && goods.nxGoodsStandardWeight !== 'null'">
                                              <template v-if="goods.nxGoodsStandardname !== '斤'">
                                                ({{ goods.nxGoodsStandardWeight }}/{{ goods.nxGoodsStandardname }})
                                              </template>
                                            </template>
                                            <template v-else>
                                              ({{ goods.nxGoodsStandardname }})
                                            </template>
                                          </span>
                                          <span v-if="goods.nxGoodsPlace && goods.nxGoodsPlace !== 'null'" 
                                                class="text-muted small me-2" 
                                                style="color: #666; margin-right: 12px;">
                                            产地:{{ goods.nxGoodsPlace }}
                                          </span>
                                          <span v-if="goods.nxGoodsDetail && goods.nxGoodsDetail !== 'null'" 
                                                class="text-muted small" 
                                                style="color: #666;">
                                            {{ goods.nxGoodsDetail }}
                                          </span>
                                        </div>
                                      </div>
                                      <button 
                                        class="btn btn-info btn-sm"
                                        @click="downLoadGoodsNx(goods, orderIndex)"
                                        style="flex-shrink: 0; padding: 20px; display: flex; align-items: center; justify-content: center; width: 40px;"
                                        title="下载商品">
                                        ⬇️
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                
                                <!-- 商品搜索下拉框（参考微信小程序第149-213行） -->
                                <!-- 当正在编辑当前订单时，显示搜索下拉框 -->
                                <div 
                                  v-if="orderArrIndex === orderIndex && item.nxDoStatus !== 0 && (strArr.length > 0 || nxArr.length > 0)"
                                  class="goods-search-dropdown position-absolute bg-white border rounded shadow-lg p-2"
                                  style="top: 100%; left: 0; right: 0; z-index: 1000; max-height: 400px; overflow-y: auto; margin-top: 4px;">
                                  
                                  <!-- 搜索标题 -->
                                  <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                                    <span class="text-muted small">搜索{{ strArr.length + nxArr.length }}个商品:</span>
                                    <button class="btn btn-sm btn-link p-0" @click="closeStr" style="font-size: 12px;">✕</button>
                                  </div>
                                  
                                  <!-- 配送商商品列表 -->
                                  <div v-if="strArr.length > 0" class="mb-2">
                                    <div 
                                      v-for="(goods, goodsIndex) in strArr" 
                                      :key="goods.nxDistributerGoodsId || goodsIndex"
                                      class="goods-item p-2 mb-1 rounded hover-bg"
                                      @click="saveOrder(goods, orderIndex)"
                                      style="cursor: pointer;">
                                      <div class="d-flex align-items-center justify-content-between">
                                        <div class="flex-grow-1">
                                          <span class="text-success fw-bold me-2">{{ goodsIndex + 1 }}.</span>
                                          <span v-if="goods.nxDgGoodsBrand && goods.nxDgGoodsBrand !== 'null'" 
                                                class="badge bg-warning text-dark me-1">
                                            {{ goods.nxDgGoodsBrand }}
                                          </span>
                                          <span class="text-dark">{{ goods.nxDgGoodsName }}</span>
                                          <span class="text-muted small ms-1">
                                            ({{ goods.nxDgGoodsStandardWeight && goods.nxDgGoodsStandardWeight !== 'null' 
                                              ? goods.nxDgGoodsStandardWeight + '/' + goods.nxDgGoodsStandardname 
                                              : goods.nxDgGoodsStandardname }})
                                          </span>
                                        </div>
                                        <button 
                                          class="btn btn-success btn-sm"
                                          :class="{ 'btn-warning': !goods.nxDgNxGoodsId }">
                                          {{ goods.nxDgNxGoodsId ? '选择' : '临时' }}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <!-- 系统商品列表 -->
                                  <div v-if="nxArr.length > 0" class="mb-2">
                                    <div class="bg-info text-white p-1 mb-2 rounded small">
                                      📦 下载商品库{{ nxArr.length }}个:
                                    </div>
                                    <div 
                                      v-for="(goods, nxIndex) in nxArr" 
                                      :key="goods.nxGoodsId || nxIndex"
                                      class="goods-item p-2 mb-1 rounded hover-bg d-flex align-items-center justify-content-between"
                                      style="cursor: pointer;">
                                      <div class="flex-grow-1">
                                        <span class="text-primary fw-bold me-2">{{ nxIndex + 1 }}.</span>
                                        <span v-if="goods.nxGoodsBrand && goods.nxGoodsBrand !== 'null'" 
                                              class="badge bg-warning text-dark me-1">
                                          {{ goods.nxGoodsBrand }}
                                        </span>
                                        <span class="text-dark">{{ goods.nxGoodsName }}</span>
                                        <span v-if="goods.nxAliasEntities && goods.nxAliasEntities.length > 0" 
                                              v-for="(alias, aliasIndex) in goods.nxAliasEntities" 
                                              :key="alias.nxDaAliasName || aliasIndex"
                                              class="text-primary me-1">
                                          @{{ alias.nxDaAliasName }}
                                        </span>
                                        <span class="text-muted small ms-1">
                                          <template v-if="goods.nxGoodsStandardWeight && goods.nxGoodsStandardWeight !== 'null'">
                                            <template v-if="goods.nxGoodsStandardname !== '斤'">
                                              ({{ goods.nxGoodsStandardWeight }}/{{ goods.nxGoodsStandardname }})
                                            </template>
                                          </template>
                                          <template v-else>
                                            ({{ goods.nxGoodsStandardname }})
                                          </template>
                                        </span>
                                        <span v-if="goods.nxGoodsPlace && goods.nxGoodsPlace !== 'null'" 
                                              class="text-muted small me-2">
                                          产地:{{ goods.nxGoodsPlace }}
                                        </span>
                                        <span v-if="goods.nxGoodsDetail && goods.nxGoodsDetail !== 'null'" 
                                              class="text-muted small">
                                          {{ goods.nxGoodsDetail }}
                                        </span>
                                      </div>
                                      <button 
                                        class="btn btn-info btn-sm"
                                        @click="downLoadGoodsNx(goods, orderIndex)"
                                        style="flex-shrink: 0; padding: 20px; display: flex; align-items: center; justify-content: center; width: 40px;"
                                        title="下载商品">
                                        ⬇️
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              <!-- 数量（可编辑） -->
                              <div style="width: 100px;">
                                <span v-if="item.nxDoStatus === 0" class="text-dark">
                                  {{ item.nxDoQuantity || '数量' }}
                                </span>
                                <input 
                                  v-else
                                  type="number" 
                                  :value="item.nxDoQuantity"
                                  @input="editOrder($event, 'quantity', orderIndex)"
                                  class="form-control form-control-sm"
                                  :class="{ 'border-success': item.nxDoStatus === -2 }"
                                  placeholder="数量"
                                  style="font-size: 14px;"
                                />
                              </div>
                              
                              <!-- 规格（可编辑） -->
                              <div style="width: 80px;">
                                <span v-if="item.nxDoStatus === 0" class="text-dark">
                                  {{ item.nxDoStandard || '规格' }}
                                </span>
                                <input 
                                  v-else
                                  type="text" 
                                  :value="item.nxDoStandard"
                                  @input="editOrder($event, 'standard', orderIndex)"
                                  class="form-control form-control-sm"
                                  :class="{ 'border-success': item.nxDoStatus === -2 }"
                                  placeholder="规格"
                                  style="font-size: 14px;"
                                />
                              </div>
                              
                              <!-- 操作按钮（三点菜单） -->
                              <button 
                                v-if="item.nxDoStatus === -2"
                                class="btn btn-link p-1"
                                @click="showPasteOperation(orderIndex)"
                                title="更多操作">
                                ⋮
                              </button>
                            </div>
                            
                            <!-- 备注（可编辑） -->
                            <div v-if="item.nxDoAddRemark || item.nxDoRemark || item.nxDoStatus === -2" class="mt-2 ps-4">
                              <span class="text-muted small me-2">备注:</span>
                              <span v-if="item.nxDoStatus === 0" class="text-dark">
                                {{ item.nxDoRemark || '' }}
                              </span>
                              <input 
                                v-else
                                type="text" 
                                :value="item.nxDoRemark"
                                @input="editOrder($event, 'remark', orderIndex)"
                                class="form-control form-control-sm d-inline-block"
                                :class="{ 'border-success': item.nxDoStatus === -2 }"
                                placeholder="添加备注信息"
                                style="width: calc(100% - 60px); font-size: 14px;"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 图片上传区域 - 左右分栏布局 -->
                  <div v-if="uploadType === 'image'" class="upload-section mb-3" style="flex: 1; min-height: 0; max-height: 100%; display: flex; flex-direction: column; overflow: hidden;">
                    <div class="row g-3" style="flex: 1; min-height: 0; max-height: 100%; overflow: hidden;">
                      <!-- 左侧：图片文件上传和预览 -->
                      <div :class="orderItems.length > 0 ? 'col-md-6' : 'col-12'" style="display: flex; flex-direction: column; min-height: 0; max-height: 100%; overflow: hidden;">
                        <div class="card h-100 p-3" style="display: flex; flex-direction: column; min-height: 0; overflow-y: auto;">
                          <!-- 如果没有缓存，显示文件选择功能 -->
                          <div v-if="!hasCache || uploadType !== 'image'">
                      <label class="form-label">选择图片文件（OCR识别）</label>
                      <input 
                        type="file" 
                        ref="imageFileInput"
                        accept="image/*"
                        @change="handleImageUpload"
                        class="form-control mb-2"
                        :disabled="recognizingImage"
                      />
                      <small class="text-muted">支持 JPG、PNG 等图片格式，系统将自动识别图片中的订单信息</small>
                          </div>
                          
                          <!-- 显示已上传的文件信息 -->
                          <div v-if="uploadedImageFile" class="mt-3">
                            <div class="p-2 bg-light rounded mb-2">
                              <div class="d-flex justify-content-between align-items-center">
                                <div>
                                  <div class="fw-bold">🖼️ {{ uploadedImageFile.name }}</div>
                                  <div class="small text-muted">
                                    大小: {{ formatFileSize(uploadedImageFile.size) }}
                                  </div>
                                </div>
                                <button 
                                  class="btn btn-sm btn-outline-danger"
                                  @click="clearUploadedImageFile"
                                  title="清除文件">
                                  ✕
                                </button>
                              </div>
                            </div>
                            <!-- 显示图片预览 -->
                            <div v-if="imagePreview" class="border rounded p-2">
                              <img 
                                :src="imagePreview" 
                                alt="预览" 
                                class="img-fluid rounded"
                                style="max-height: 400px; width: 100%; object-fit: contain; cursor: pointer;"
                                @click="previewImageFullScreen"
                              />
                            </div>
                          </div>
                      
                      <!-- 识别状态 -->
                      <div v-if="recognizingImage" class="mt-3">
                        <div class="alert alert-info">
                          <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                          正在识别图片中，请稍候...
                        </div>
                      </div>
                    </div>
                  </div>

                      <!-- 右侧：订单列表（图片模式） -->
                      <div v-if="orderItems.length > 0" class="col-md-6 order-items-section" style="display: flex; flex-direction: column; height: 100%; min-height: 0; max-height: 100%; overflow: hidden;">
                        <div class="d-flex justify-content-between align-items-center mb-3" style="flex-shrink: 0;">
                          <h6 class="mb-0">转换订单 ({{ orderItems.length }} 项)</h6>
                          <div class="d-flex gap-2">
                            <button 
                              v-if="hasCache"
                              class="btn btn-warning btn-sm" 
                              @click="clearSave">
                              清除草稿
                            </button>
                            <button 
                              class="btn btn-success btn-sm" 
                              @click="pasteSearchGoods"
                              :disabled="savingOrder">
                              {{ savingOrder ? '保存中...' : '保存订单' }}
                            </button>
                          </div>
                        </div>
                        
                        <!-- 订单列表（参考微信小程序样式） -->
                        <div class="order-list-container flex-grow-1" style="overflow-y: auto; border: 1px solid #dee2e6; border-radius: 0.375rem; padding: 1rem; min-height: 400px;">
                          <div 
                            v-for="(item, orderIndex) in orderItems" 
                            :key="orderIndex"
                            class="order-item-card mb-2 p-3 bg-white rounded shadow-sm"
                            :class="{ 'border-success': item.nxDoStatus === -2, 'border-primary': item.nxDoStatus === 0 }"
                            style="border-left: 4px solid; position: relative;">
                            
                            <!-- 订单行 -->
                            <div class="d-flex align-items-center gap-2 mb-2">
                              <!-- 序号 -->
                              <span class="text-secondary fw-bold" style="min-width: 30px;">{{ orderIndex + 1 }}.</span>
                              
                              <!-- 来源文件标识（转订单时显示） -->
                              <!-- 商品名称（可编辑） -->
                              <div class="flex-grow-1 position-relative" style="min-width: 0;">
                                <div class="d-flex align-items-center">
                                  <span v-if="item.nxDoStatus === 0" class="text-dark flex-grow-1">
                                    {{ item.nxDoGoodsName || '请输入商品名称' }}
                                  </span>
                                  <input 
                                    v-else
                                    type="text" 
                                    :value="item.nxDoGoodsName"
                                    @input="editOrderName($event, orderIndex)"
                                    class="form-control form-control-sm flex-grow-1"
                                    :class="{ 'border-success': item.nxDoStatus === -2 }"
                                    placeholder="请输入商品名称"
                                    style="font-size: 14px;"
                                  />
                                  <!-- 显示已匹配商品列表的图标 -->
                                  <button
                                    v-if="orderArrIndex !== orderIndex && item.nxDoStatus !== 0 && (item.nxDistributerGoodsEntityList && item.nxDistributerGoodsEntityList.length > 0 || item.nxGoodsEntities && item.nxGoodsEntities.length > 0)"
                                    class="btn btn-link btn-sm p-1 ms-2"
                                    @click="toggleMatchedGoods(orderIndex)"
                                    :title="showMatchedGoods[orderIndex] ? '隐藏已匹配商品' : '显示已匹配商品'"
                                    style="flex-shrink: 0; text-decoration: none; color: #6c757d;"
                                  >
                                    <span v-if="showMatchedGoods[orderIndex]">▼</span>
                                    <span v-else>▶</span>
                                  </button>
                                </div>
                                
                                <!-- 已匹配的商品列表（参考微信小程序第102-147行） -->
                                <!-- 当不在编辑当前订单时，显示已匹配的商品列表 -->
                                <div 
                                  v-if="orderArrIndex !== orderIndex && item.nxDoStatus !== 0 && showMatchedGoods[orderIndex] && (item.nxDistributerGoodsEntityList && item.nxDistributerGoodsEntityList.length > 0 || item.nxGoodsEntities && item.nxGoodsEntities.length > 0)"
                                  class="matched-goods-list position-absolute bg-white border rounded shadow-lg p-2"
                                  style="top: 100%; left: 0; right: 0; z-index: 999; max-height: 400px; overflow-y: auto; margin-top: 4px; border-left: 1px solid gray;">
                                  
                                  <!-- 标题栏和关闭按钮 -->
                                  <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                                    <span class="text-muted small fw-bold">已匹配商品列表</span>
                                    <button 
                                      class="btn btn-sm btn-link p-0"
                                      @click="toggleMatchedGoods(orderIndex)"
                                      style="font-size: 12px; color: #6c757d;"
                                      title="隐藏">
                                      ✕
                                    </button>
                                  </div>
                                  
                                  <!-- 配送商已匹配商品列表 -->
                                  <div v-if="item.nxDistributerGoodsEntityList && item.nxDistributerGoodsEntityList.length > 0" class="mb-2">
                                    <div 
                                      v-for="(orderGoods, orderGoodsIndex) in item.nxDistributerGoodsEntityList" 
                                      :key="orderGoods.nxDistributerGoodsId || orderGoodsIndex"
                                      class="matched-goods-item p-2 mb-1 rounded hover-bg d-flex align-items-center justify-content-between"
                                      @click="saveOrder(orderGoods, orderIndex)"
                                      style="cursor: pointer; background-color: #ffffff; border-bottom: 1px solid #f0f0f0; padding: 12px 16px;">
                                      <div class="flex-grow-1">
                                        <span class="text-muted fw-bold me-2" style="color: #666;">({{ orderGoodsIndex + 1 }}).</span>
                                        <span v-if="orderGoods.nxDgGoodsBrand && orderGoods.nxDgGoodsBrand !== 'null'" 
                                              class="badge bg-warning text-dark me-1">
                                          {{ orderGoods.nxDgGoodsBrand }}
                                        </span>
                                        <span class="text-dark" style="color: #333; font-weight: 500;">{{ orderGoods.nxDgGoodsName }}</span>
                                        <span class="text-muted small ms-1" style="color: #666;">
                                          ({{ orderGoods.nxDgGoodsStandardWeight && orderGoods.nxDgGoodsStandardWeight !== 'null' 
                                            ? orderGoods.nxDgGoodsStandardWeight + '/' + orderGoods.nxDgGoodsStandardname 
                                            : orderGoods.nxDgGoodsStandardname }})
                                        </span>
                                      </div>
                                      <button class="btn btn-success btn-sm" style="flex-shrink: 0; min-width: 80px; padding: 8px 16px;">
                                        选择
                                      </button>
                                    </div>
                                  </div>
                                  
                                  <!-- 系统已匹配商品列表（参考微信小程序第121-145行） -->
                                  <div v-if="item.nxGoodsEntities && item.nxGoodsEntities.length > 0" 
                                       class="mb-2"
                                       style="border-left: 1px solid gray; border-right: 1px solid gray; border-bottom: 1px solid gray;">
                                    <div 
                                      v-for="(goods, nxIndex) in item.nxGoodsEntities" 
                                      :key="goods.nxGoodsId || nxIndex"
                                      class="matched-goods-item p-2 mb-1 d-flex align-items-center justify-content-between"
                                      style="width: 100%; border-bottom: 1px solid #f0f0f0; padding: 12px 16px; box-sizing: border-box;">
                                      <div class="flex-grow-1 d-flex align-items-center" style="flex: 1; padding: 10px; min-height: 60px; margin-right: 20px; width: calc(100% - 100px);">
                                        <span class="text-muted fw-bold me-2" style="color: #666; min-width: 40px; flex-shrink: 0;">{{ nxIndex + 1 }}.</span>
                                        <div class="d-flex flex-wrap align-items-center" style="flex: 1; padding: 10px; min-height: 40px; overflow: hidden;">
                                          <span v-if="goods.nxGoodsBrand && goods.nxGoodsBrand !== 'null'" 
                                                class="badge bg-warning text-dark me-1">
                                            {{ goods.nxGoodsBrand }}
                                          </span>
                                          <span class="text-dark fw-bold me-2" style="color: #333; font-weight: 500;">{{ goods.nxGoodsName }}</span>
                                          <span v-if="goods.nxAliasEntities && goods.nxAliasEntities.length > 0" 
                                                v-for="(alias, aliasIndex) in goods.nxAliasEntities" 
                                                :key="alias.nxDaAliasName || aliasIndex"
                                                class="text-primary me-1" 
                                                style="color: #1c7efb; margin-right: 8px;">
                                            @{{ alias.nxDaAliasName }}
                                          </span>
                                          <span class="text-muted small ms-1" style="color: #666; margin-right: 12px;">
                                            <template v-if="goods.nxGoodsStandardWeight && goods.nxGoodsStandardWeight !== 'null'">
                                              <template v-if="goods.nxGoodsStandardname !== '斤'">
                                                ({{ goods.nxGoodsStandardWeight }}/{{ goods.nxGoodsStandardname }})
                                              </template>
                                            </template>
                                            <template v-else>
                                              ({{ goods.nxGoodsStandardname }})
                                            </template>
                                          </span>
                                          <span v-if="goods.nxGoodsPlace && goods.nxGoodsPlace !== 'null'" 
                                                class="text-muted small me-2" 
                                                style="color: #666; margin-right: 12px;">
                                            产地:{{ goods.nxGoodsPlace }}
                                          </span>
                                          <span v-if="goods.nxGoodsDetail && goods.nxGoodsDetail !== 'null'" 
                                                class="text-muted small" 
                                                style="color: #666;">
                                            {{ goods.nxGoodsDetail }}
                                          </span>
                                        </div>
                                      </div>
                                      <button 
                                        class="btn btn-info btn-sm"
                                        @click="downLoadGoodsNx(goods, orderIndex)"
                                        style="flex-shrink: 0; padding: 20px; display: flex; align-items: center; justify-content: center; width: 40px;"
                                        title="下载商品">
                                        ⬇️
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                
                                <!-- 商品搜索下拉框（参考微信小程序第149-213行） -->
                                <!-- 当正在编辑当前订单时，显示搜索下拉框 -->
                                <div 
                                  v-if="orderArrIndex === orderIndex && item.nxDoStatus !== 0 && (strArr.length > 0 || nxArr.length > 0)"
                                  class="goods-search-dropdown position-absolute bg-white border rounded shadow-lg p-2"
                                  style="top: 100%; left: 0; right: 0; z-index: 1000; max-height: 400px; overflow-y: auto; margin-top: 4px;">
                                  
                                  <!-- 搜索标题 -->
                                  <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                                    <span class="text-muted small">搜索{{ strArr.length + nxArr.length }}个商品:</span>
                                    <button class="btn btn-sm btn-link p-0" @click="closeStr" style="font-size: 12px;">✕</button>
                                  </div>
                                  
                                  <!-- 配送商商品列表 -->
                                  <div v-if="strArr.length > 0" class="mb-2">
                                    <div 
                                      v-for="(goods, goodsIndex) in strArr" 
                                      :key="goods.nxDistributerGoodsId || goodsIndex"
                                      class="goods-item p-2 mb-1 rounded hover-bg"
                                      @click="saveOrder(goods, orderIndex)"
                                      style="cursor: pointer;">
                                      <div class="d-flex align-items-center justify-content-between">
                                        <div class="flex-grow-1">
                                          <span class="text-success fw-bold me-2">{{ goodsIndex + 1 }}.</span>
                                          <span v-if="goods.nxDgGoodsBrand && goods.nxDgGoodsBrand !== 'null'" 
                                                class="badge bg-warning text-dark me-1">
                                            {{ goods.nxDgGoodsBrand }}
                                          </span>
                                          <span class="text-dark">{{ goods.nxDgGoodsName }}</span>
                                          <span class="text-muted small ms-1">
                                            ({{ goods.nxDgGoodsStandardWeight && goods.nxDgGoodsStandardWeight !== 'null' 
                                              ? goods.nxDgGoodsStandardWeight + '/' + goods.nxDgGoodsStandardname 
                                              : goods.nxDgGoodsStandardname }})
                                          </span>
                                        </div>
                                        <button 
                                          class="btn btn-success btn-sm"
                                          :class="{ 'btn-warning': !goods.nxDgNxGoodsId }">
                                          {{ goods.nxDgNxGoodsId ? '选择' : '临时' }}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <!-- 系统商品列表 -->
                                  <div v-if="nxArr.length > 0" class="mb-2">
                                    <div class="bg-info text-white p-1 mb-2 rounded small">
                                      📦 下载商品库{{ nxArr.length }}个:
                                    </div>
                                    <div 
                                      v-for="(goods, nxIndex) in nxArr" 
                                      :key="goods.nxGoodsId || nxIndex"
                                      class="goods-item p-2 mb-1 rounded hover-bg d-flex align-items-center justify-content-between"
                                      style="cursor: pointer;">
                                      <div class="flex-grow-1">
                                        <span class="text-primary fw-bold me-2">{{ nxIndex + 1 }}.</span>
                                        <span v-if="goods.nxGoodsBrand && goods.nxGoodsBrand !== 'null'" 
                                              class="badge bg-warning text-dark me-1">
                                          {{ goods.nxGoodsBrand }}
                                        </span>
                                        <span class="text-dark">{{ goods.nxGoodsName }}</span>
                                        <span v-if="goods.nxAliasEntities && goods.nxAliasEntities.length > 0" 
                                              v-for="(alias, aliasIndex) in goods.nxAliasEntities" 
                                              :key="alias.nxDaAliasName || aliasIndex"
                                              class="text-primary me-1">
                                          @{{ alias.nxDaAliasName }}
                                        </span>
                                        <span class="text-muted small ms-1">
                                          <template v-if="goods.nxGoodsStandardWeight && goods.nxGoodsStandardWeight !== 'null'">
                                            <template v-if="goods.nxGoodsStandardname !== '斤'">
                                              ({{ goods.nxGoodsStandardWeight }}/{{ goods.nxGoodsStandardname }})
                                            </template>
                                          </template>
                                          <template v-else>
                                            ({{ goods.nxGoodsStandardname }})
                                          </template>
                                        </span>
                                        <span v-if="goods.nxGoodsPlace && goods.nxGoodsPlace !== 'null'" 
                                              class="text-muted small me-2">
                                          产地:{{ goods.nxGoodsPlace }}
                                        </span>
                                        <span v-if="goods.nxGoodsDetail && goods.nxGoodsDetail !== 'null'" 
                                              class="text-muted small">
                                          {{ goods.nxGoodsDetail }}
                                        </span>
                                      </div>
                                      <button 
                                        class="btn btn-info btn-sm"
                                        @click="downLoadGoodsNx(goods, orderIndex)"
                                        style="flex-shrink: 0; padding: 20px; display: flex; align-items: center; justify-content: center; width: 40px;"
                                        title="下载商品">
                                        ⬇️
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              <!-- 数量（可编辑） -->
                              <div style="width: 100px;">
                                <span v-if="item.nxDoStatus === 0" class="text-dark">
                                  {{ item.nxDoQuantity || '数量' }}
                                </span>
                                <input 
                                  v-else
                                  type="number" 
                                  :value="item.nxDoQuantity"
                                  @input="editOrder($event, 'quantity', orderIndex)"
                                  class="form-control form-control-sm"
                                  :class="{ 'border-success': item.nxDoStatus === -2 }"
                                  placeholder="数量"
                                  style="font-size: 14px;"
                                />
                              </div>
                              
                              <!-- 规格（可编辑） -->
                              <div style="width: 80px;">
                                <span v-if="item.nxDoStatus === 0" class="text-dark">
                                  {{ item.nxDoStandard || '规格' }}
                                </span>
                                <input 
                                  v-else
                                  type="text" 
                                  :value="item.nxDoStandard"
                                  @input="editOrder($event, 'standard', orderIndex)"
                                  class="form-control form-control-sm"
                                  :class="{ 'border-success': item.nxDoStatus === -2 }"
                                  placeholder="规格"
                                  style="font-size: 14px;"
                                />
                              </div>
                              
                              <!-- 操作按钮（三点菜单） -->
                              <button 
                                v-if="item.nxDoStatus === -2"
                                class="btn btn-link p-1"
                                @click="showPasteOperation(orderIndex)"
                                title="更多操作">
                                ⋮
                              </button>
                            </div>
                            
                            <!-- 备注（可编辑） -->
                            <div v-if="item.nxDoAddRemark || item.nxDoRemark" class="mt-2 ps-4">
                              <span class="text-muted small me-2">备注:</span>
                              <span v-if="item.nxDoStatus === 0" class="text-dark">
                                {{ item.nxDoRemark || '' }}
                              </span>
                              <input 
                                v-else
                                type="text" 
                                :value="item.nxDoRemark"
                                @input="editOrder($event, 'remark', orderIndex)"
                                class="form-control form-control-sm d-inline-block"
                                :class="{ 'border-success': item.nxDoStatus === -2 }"
                                placeholder="添加备注信息"
                                style="width: calc(100% - 60px); font-size: 14px;"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 转订单区域 - 左右分栏布局 -->
                  <div v-if="uploadType === 'auto'" class="upload-section mb-3" style="flex: 1; min-height: 0; max-height: 100%; display: flex; flex-direction: column; overflow: hidden;">
                    <div class="row g-3" style="flex: 1; min-height: 0; max-height: 100%; overflow: hidden;">
                      <!-- 左侧：文件列表和操作 / 图片预览 -->
                      <div :class="(filteredOrderItems.length > 0 && !autoProcessImagePreview) ? 'col-md-6' : (autoProcessImagePreview ? 'col-md-4' : 'col-12')">
                        <!-- 图片预览区域（当点击图片文件时显示） -->
                        <div v-if="autoProcessImagePreview" class="card h-100 mb-3">
                          <div class="card-header d-flex justify-content-between align-items-center">
                            <h6 class="mb-0">图片预览 - {{ autoProcessImagePreviewFileName }}</h6>
                            <button 
                              class="btn btn-sm btn-outline-danger"
                              @click="clearAutoProcessImagePreview">
                              关闭预览
                            </button>
                          </div>
                          <div class="card-body p-2 position-relative" 
                               style="min-height: 400px; overflow: hidden; cursor: move;"
                               @mousedown="startDrag"
                               @mousemove="onDrag"
                               @mouseup="endDrag"
                               @mouseleave="endDrag"
                               @wheel.prevent="onWheel">
                            <div class="position-absolute top-0 end-0 m-2 d-flex gap-1" style="z-index: 10;">
                              <button 
                                class="btn btn-sm btn-outline-secondary"
                                @click.stop="resetImageTransform"
                                title="重置">
                                🔄
                              </button>
                              <button 
                                class="btn btn-sm btn-outline-secondary"
                                @click.stop="zoomIn"
                                title="放大">
                                ➕
                              </button>
                              <button 
                                class="btn btn-sm btn-outline-secondary"
                                @click.stop="zoomOut"
                                title="缩小">
                                ➖
                              </button>
                            </div>
                            <div 
                              class="d-flex align-items-center justify-content-center"
                              style="width: 100%; height: 100%; transform-origin: center center;">
                              <img 
                                :src="autoProcessImagePreview" 
                                alt="预览" 
                                class="img-fluid"
                                :style="{
                                  transform: `translate(${imageTranslateX}px, ${imageTranslateY}px) scale(${imageScale})`,
                                  transition: isDragging ? 'none' : 'transform 0.1s',
                                  cursor: isDragging ? 'grabbing' : 'grab',
                                  maxWidth: 'none',
                                  height: 'auto',
                                  objectFit: 'contain'
                                }"
                                @dragstart.prevent>
                            </div>
                          </div>
                        </div>
                        
                        <div class="card h-100 p-3">
<!--                          <div class="mb-3">-->
<!--                            <label class="form-label fw-bold">🔄 自动转订单</label>-->
<!--                            <p class="text-muted small mb-2">-->
<!--                              自动扫描客户文件夹，识别 Excel 和图片文件并处理订单-->
<!--                            </p>-->
<!--                            <div v-if="!customerFolderPath" class="alert alert-warning">-->
<!--                              <strong>提示：</strong>请先设置订单保存路径-->
<!--                            </div>-->
<!--                            <div v-else class="alert alert-info">-->
<!--                              <strong>当前文件夹：</strong>{{ customerFolderPath }}-->
<!--                            </div>-->
<!--                          </div>-->

                          <!-- 操作按钮 -->
                          <div v-if="!hasCache" class="mb-3 d-flex gap-2">
                            <button 
                              class="btn btn-primary"
                              @click="scanFolderFiles"
                              :disabled="!customerFolderPath || scanningFiles || processingFiles">
                              <span v-if="scanningFiles" class="spinner-border spinner-border-sm me-1"></span>
                              {{ scanningFiles ? '扫描中...' : '刷新文件夹' }}
                            </button>
                            <button 
                              class="btn btn-success"
                              @click="startAutoProcess"
                              :disabled="!customerFolderPath || autoProcessFiles.length === 0 || processingFiles">
                              <span v-if="processingFiles" class="spinner-border spinner-border-sm me-1"></span>
                              {{ processingFiles ? '处理中...' : '开始处理' }}
                            </button>
                          </div>

                          <!-- 处理进度 -->
                          <div v-if="processingFiles" class="mb-3">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                              <span class="fw-bold">总体进度：</span>
                              <span>{{ autoProcessProgress.current }}/{{ autoProcessProgress.total }}</span>
                            </div>
                            <div class="progress" style="height: 20px;">
                              <div 
                                class="progress-bar progress-bar-striped progress-bar-animated" 
                                :style="{ width: autoProcessProgress.percent + '%' }">
                                {{ autoProcessProgress.percent }}%
                              </div>
                            </div>
                          </div>

                          <!-- 文件列表 -->
                          <div v-if="autoProcessFiles.length > 0" class="mb-3">
                            <h6 class="mb-2">文件列表 ({{ autoProcessFiles.length }})</h6>
                            <div style="max-height: 400px; overflow-y: auto;">
                              <!-- 已处理的文件：标签页显示 -->
                              <div v-if="processedFiles.length > 0" class="mb-3">
                                <h6 class="mb-2 small text-muted">已处理文件 ({{ processedFiles.length }})</h6>
                                
                                <!-- 标签页导航（固定，不滚动） -->
                                <div style="overflow-x: auto; overflow-y: hidden; border-bottom: 1px solid #dee2e6;">
                                  <ul class="nav nav-tabs" role="tablist" style="flex-wrap: nowrap; white-space: nowrap; margin-bottom: 0;">
                                    <li 
                                      v-for="(file, index) in processedFiles" 
                                      :key="'tab-' + index"
                                      class="nav-item" 
                                      role="presentation"
                                      style="flex-shrink: 0;">
                                      <button 
                                        class="nav-link"
                                        :class="{ 'active': activeProcessedFileTab === file.filePath }"
                                        @click="activeProcessedFileTab = file.filePath"
                                        type="button"
                                        style="font-size: 12px; padding: 6px 12px; white-space: nowrap;"
                                        :title="file.fileName">
                                        {{ file.fileType === 'excel' ? '📄' : '🖼️' }} {{ file.fileName }}
                                      </button>
                                    </li>
                                  </ul>
                                </div>
                                
                                <!-- 标签页内容（可滚动） -->
                                <div class="tab-content border border-top-0 p-2" style="min-height: 300px; max-height: 500px; overflow-y: auto; overflow-x: hidden;">
                                  <div 
                                    v-for="(file, index) in processedFiles" 
                                    :key="'content-' + index"
                                    class="tab-pane"
                                    :class="{ 'active': activeProcessedFileTab === file.filePath }"
                                    v-show="activeProcessedFileTab === file.filePath">
                                    
                                    <!-- 图片文件内容 -->
                                    <div v-if="file.fileType === 'image'">
                                      <div class="position-relative" style="min-height: 250px; background-color: #f5f5f5; display: flex; align-items: center; justify-content: center;">
                                        <img 
                                          v-if="autoProcessImagePreviews && autoProcessImagePreviews[file.filePath]"
                                          :src="autoProcessImagePreviews[file.filePath]"
                                          alt=""
                                          class="img-fluid"
                                          style="object-fit: contain; max-height: 450px; display: block;"
                                          @error="handleImagePreviewError(file.filePath)"
                                        />
                                        <div v-else class="text-muted">
                                          <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                                          <span>加载中...</span>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <!-- Excel文件内容 -->
                                    <div v-else-if="file.fileType === 'excel'">
                                      <div>
                                        <div v-if="autoProcessExcelPreviews && autoProcessExcelPreviews[file.filePath]">
                                          <div v-if="autoProcessExcelPreviews[file.filePath].sheets && autoProcessExcelPreviews[file.filePath].sheets.length > 0">
                                            <!-- 工作表选择 -->
                                            <div v-if="autoProcessExcelPreviews[file.filePath].sheets.length > 1" class="mb-2">
                      <select 
                                                class="form-select form-select-sm"
                                                :value="autoProcessExcelPreviews[file.filePath].currentSheet || 0"
                                                @change="changeExcelSheet(file.filePath, $event.target.value)">
                        <option 
                                                  v-for="(sheet, sheetIndex) in autoProcessExcelPreviews[file.filePath].sheets" 
                                                  :key="sheetIndex"
                                                  :value="sheetIndex">
                                                  {{ sheet.name }}
                        </option>
                      </select>
                                            </div>
                                            <!-- 表格显示 -->
                                            <div class="table-responsive">
                                              <table class="table table-sm table-bordered" style="font-size: 11px;">
                                                <tbody>
                                                  <tr v-for="(row, rowIndex) in getCurrentExcelSheetData(file.filePath)" :key="rowIndex">
                                                    <td 
                                                      v-for="(cell, cellIndex) in row" 
                                                      :key="cellIndex"
                                                      :class="{ 'bg-light': rowIndex === 0 }"
                                                      style="padding: 4px; white-space: nowrap;">
                                                      {{ cell || '' }}
                                                    </td>
                                                  </tr>
                                                </tbody>
                                              </table>
                                            </div>
                                          </div>
                                          <div v-else class="text-muted small">Excel文件为空或无法读取</div>
                                        </div>
                                        <div v-else class="text-muted small">
                                          <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                                          加载中...
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                    </div>
                  </div>

                            </div>
                          </div>
                          
                          <!-- 空文件夹提示 -->
                          <div v-else-if="customerFolderPath && !scanningFiles" class="mb-3">
                            <div class="alert alert-info text-center">
                              <div class="mb-2">📁 文件夹为空</div>
                              <div class="small text-muted">
                                当前文件夹中没有可处理的文件（Excel 或图片）<br>
                                请将订单文件放入文件夹后点击"刷新文件夹"
                              </div>
                            </div>
                          </div>

                          <!-- 处理结果 -->
                          <div v-if="autoProcessResults.length > 0" class="mt-3">
                            <h6 class="mb-2">处理结果：</h6>
                            <div class="list-group" style="max-height: 200px; overflow-y: auto;">
                              <div 
                                v-for="(result, index) in autoProcessResults" 
                                :key="index"
                                class="list-group-item"
                                :class="result.success ? 'list-group-item-success' : 'list-group-item-danger'">
                                <div class="d-flex align-items-center">
                                  <span class="me-2">{{ result.success ? '✅' : '❌' }}</span>
                                  <div>
                                    <strong>{{ result.fileName }}</strong>
                                    <span v-if="result.success" class="ms-2">
                                      - 成功 ({{ result.orderCount || 0 }}条订单)
                                    </span>
                                    <span v-else class="ms-2">
                                      - 失败: {{ result.error }}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- 右侧：订单列表（当有订单时显示） -->
                      <div v-if="filteredOrderItems.length > 0" class="col-md-6" style="display: flex; flex-direction: column; height: 100%; min-height: 0; max-height: 100%; overflow: hidden;">
                        <div class="card h-100 p-3" style="display: flex; flex-direction: column; min-height: 0; overflow: hidden;">
                          <div class="d-flex justify-content-between align-items-center mb-3" style="flex-shrink: 0;">
                            <h6 class="mb-0">转换订单 ({{ filteredOrderItems.length }} 项)</h6>
                            <div class="d-flex gap-2">
                              <button 
                                v-if="hasCache"
                                class="btn btn-warning btn-sm" 
                                @click="clearSave">
                                清除草稿
                              </button>
                              <button 
                                class="btn btn-success btn-sm" 
                                @click="pasteSearchGoods"
                                :disabled="savingOrder">
                                {{ savingOrder ? '保存中...' : '保存订单' }}
                              </button>
                            </div>
                          </div>
                          
                          <!-- 订单列表 -->
                          <div class="order-list-container flex-grow-1" style="overflow-y: auto; border: 1px solid #dee2e6; border-radius: 0.375rem; padding: 1rem; min-height: 400px;">
                            <div 
                              v-for="(item, orderIndex) in filteredOrderItems" 
                              :key="orderIndex"
                              class="order-item-card mb-2 p-3 bg-white rounded shadow-sm"
                              :class="{ 'border-success': item.nxDoStatus === -2, 'border-primary': item.nxDoStatus === 0 }"
                              style="border-left: 4px solid; position: relative;">
                              
                              <!-- 订单行 -->
                              <div class="d-flex align-items-center gap-2 mb-2">
                                <!-- 序号 -->
                                <span class="text-secondary fw-bold" style="min-width: 30px;">{{ orderIndex + 1 }}.</span>
                                
                                <!-- 商品名称（可编辑） -->
                                <div class="flex-grow-1 position-relative" style="min-width: 0;">
                                  <div class="d-flex align-items-center">
                                    <span v-if="item.nxDoStatus === 0" class="text-dark flex-grow-1">
                                      {{ item.nxDoGoodsName || '请输入商品名称' }}
                                    </span>
                                    <input 
                                      v-else
                                      type="text" 
                                      :value="item.nxDoGoodsName"
                                      @input="editOrderName($event, orderIndex)"
                                      class="form-control form-control-sm flex-grow-1"
                                      :class="{ 'border-success': item.nxDoStatus === -2 }"
                                      placeholder="请输入商品名称"
                                      style="font-size: 14px;"
                                    />
                                    <!-- 显示已匹配商品列表的图标 -->
                                    <button
                                      v-if="orderArrIndex !== orderIndex && item.nxDoStatus !== 0 && (item.nxDistributerGoodsEntityList && item.nxDistributerGoodsEntityList.length > 0 || item.nxGoodsEntities && item.nxGoodsEntities.length > 0)"
                                      class="btn btn-link btn-sm p-1 ms-2"
                                      @click="toggleMatchedGoods(orderIndex)"
                                      :title="showMatchedGoods[orderIndex] ? '隐藏已匹配商品' : '显示已匹配商品'"
                                      style="flex-shrink: 0; text-decoration: none; color: #6c757d;"
                                    >
                                      <span v-if="showMatchedGoods[orderIndex]">▼</span>
                                      <span v-else>▶</span>
                                    </button>
                                  </div>
                                  
                                  <!-- 已匹配的商品列表 -->
                                  <div 
                                    v-if="orderArrIndex !== orderIndex && item.nxDoStatus !== 0 && showMatchedGoods[orderIndex] && (item.nxDistributerGoodsEntityList && item.nxDistributerGoodsEntityList.length > 0 || item.nxGoodsEntities && item.nxGoodsEntities.length > 0)"
                                    class="matched-goods-list position-absolute bg-white border rounded shadow-lg p-2"
                                    style="top: 100%; left: 0; right: 0; z-index: 999; max-height: 400px; overflow-y: auto; margin-top: 4px; border-left: 1px solid gray;">
                                    
                                    <!-- 标题栏和关闭按钮 -->
                                    <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                                      <span class="text-muted small fw-bold">已匹配商品列表</span>
                                      <button 
                                        class="btn btn-sm btn-link p-0"
                                        @click="toggleMatchedGoods(orderIndex)"
                                        style="font-size: 12px; color: #6c757d;"
                                        title="隐藏">
                                        ✕
                                      </button>
                                    </div>
                                    
                                    <!-- 配送商已匹配商品列表 -->
                                    <div v-if="item.nxDistributerGoodsEntityList && item.nxDistributerGoodsEntityList.length > 0" class="mb-2">
                                      <div 
                                        v-for="(orderGoods, orderGoodsIndex) in item.nxDistributerGoodsEntityList" 
                                        :key="orderGoods.nxDistributerGoodsId || orderGoodsIndex"
                                        class="matched-goods-item p-2 mb-1 rounded hover-bg d-flex align-items-center justify-content-between"
                                        @click="saveOrder(orderGoods, orderIndex)"
                                        style="cursor: pointer; background-color: #ffffff; border-bottom: 1px solid #f0f0f0; padding: 12px 16px;">
                                        <div class="flex-grow-1">
                                          <span class="text-muted fw-bold me-2" style="color: #666;">({{ orderGoodsIndex + 1 }}).</span>
                                          <span v-if="orderGoods.nxDgGoodsBrand && orderGoods.nxDgGoodsBrand !== 'null'" 
                                                class="badge bg-warning text-dark me-1">
                                            {{ orderGoods.nxDgGoodsBrand }}
                                          </span>
                                          <span class="text-dark" style="color: #333; font-weight: 500;">{{ orderGoods.nxDgGoodsName }}</span>
                                          <span class="text-muted small ms-1" style="color: #666;">
                                            ({{ orderGoods.nxDgGoodsStandardWeight && orderGoods.nxDgGoodsStandardWeight !== 'null' 
                                              ? orderGoods.nxDgGoodsStandardWeight + '/' + orderGoods.nxDgGoodsStandardname 
                                              : orderGoods.nxDgGoodsStandardname }})
                                          </span>
                                        </div>
                                        <button class="btn btn-success btn-sm" style="flex-shrink: 0; min-width: 80px; padding: 8px 16px;">
                                          选择
                                        </button>
                                      </div>
                                    </div>
                                    
                                    <!-- 系统已匹配商品列表 -->
                                    <div v-if="item.nxGoodsEntities && item.nxGoodsEntities.length > 0" 
                                         class="mb-2"
                                         style="border-left: 1px solid gray; border-right: 1px solid gray; border-bottom: 1px solid gray;">
                                      <div 
                                        v-for="(goods, nxIndex) in item.nxGoodsEntities" 
                                        :key="goods.nxGoodsId || nxIndex"
                                        class="matched-goods-item p-2 mb-1 d-flex align-items-center justify-content-between"
                                        style="width: 100%; border-bottom: 1px solid #f0f0f0; padding: 12px 16px; box-sizing: border-box;">
                                        <div class="flex-grow-1 d-flex align-items-center" style="flex: 1; padding: 10px; min-height: 60px; margin-right: 20px; width: calc(100% - 100px);">
                                          <span class="text-muted fw-bold me-2" style="color: #666; min-width: 40px; flex-shrink: 0;">{{ nxIndex + 1 }}.</span>
                                          <div class="d-flex flex-wrap align-items-center" style="flex: 1; padding: 10px; min-height: 40px; overflow: hidden;">
                                            <span v-if="goods.nxGoodsBrand && goods.nxGoodsBrand !== 'null'" 
                                                  class="badge bg-warning text-dark me-1">
                                              {{ goods.nxGoodsBrand }}
                                            </span>
                                            <span class="text-dark fw-bold me-2" style="color: #333; font-weight: 500;">{{ goods.nxGoodsName }}</span>
                                            <span v-if="goods.nxAliasEntities && goods.nxAliasEntities.length > 0" 
                                                  v-for="(alias, aliasIndex) in goods.nxAliasEntities" 
                                                  :key="alias.nxDaAliasName || aliasIndex"
                                                  class="text-primary me-1" 
                                                  style="color: #1c7efb; margin-right: 8px;">
                                              @{{ alias.nxDaAliasName }}
                                            </span>
                                            <span class="text-muted small ms-1" style="color: #666; margin-right: 12px;">
                                              <template v-if="goods.nxGoodsStandardWeight && goods.nxGoodsStandardWeight !== 'null'">
                                                <template v-if="goods.nxGoodsStandardname !== '斤'">
                                                  ({{ goods.nxGoodsStandardWeight }}/{{ goods.nxGoodsStandardname }})
                                                </template>
                                              </template>
                                              <template v-else>
                                                ({{ goods.nxGoodsStandardname }})
                                              </template>
                                            </span>
                                            <span v-if="goods.nxGoodsPlace && goods.nxGoodsPlace !== 'null'" 
                                                  class="text-muted small me-2" 
                                                  style="color: #666; margin-right: 12px;">
                                              产地:{{ goods.nxGoodsPlace }}
                                            </span>
                                            <span v-if="goods.nxGoodsDetail && goods.nxGoodsDetail !== 'null'" 
                                                  class="text-muted small" 
                                                  style="color: #666;">
                                              {{ goods.nxGoodsDetail }}
                                            </span>
                                          </div>
                                        </div>
                                        <button 
                                          class="btn btn-info btn-sm"
                                          @click="downLoadGoodsNx(goods, orderIndex)"
                                          style="flex-shrink: 0; padding: 20px; display: flex; align-items: center; justify-content: center; width: 40px;"
                                          title="下载商品">
                                          ⬇️
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <!-- 商品搜索下拉框（参考微信小程序第149-213行） -->
                                  <!-- 当正在编辑当前订单时，显示搜索下拉框 -->
                                  <div 
                                    v-if="orderArrIndex === orderIndex && item.nxDoStatus !== 0 && (strArr.length > 0 || nxArr.length > 0)"
                                    class="goods-search-dropdown position-absolute bg-white border rounded shadow-lg p-2"
                                    style="top: 100%; left: 0; right: 0; z-index: 1000; max-height: 400px; overflow-y: auto; margin-top: 4px;">
                                    
                                    <!-- 搜索标题 -->
                                    <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                                      <span class="text-muted small">搜索{{ strArr.length + nxArr.length }}个商品:</span>
                                      <button class="btn btn-sm btn-link p-0" @click="closeStr" style="font-size: 12px;">✕</button>
                                    </div>
                                    
                                    <!-- 配送商商品列表 -->
                                    <div v-if="strArr.length > 0" class="mb-2">
                                      <div 
                                        v-for="(goods, goodsIndex) in strArr" 
                                        :key="goods.nxDistributerGoodsId || goodsIndex"
                                        class="goods-item p-2 mb-1 rounded hover-bg"
                                        @click="saveOrder(goods, orderIndex)"
                                        style="cursor: pointer;">
                                        <div class="d-flex align-items-center justify-content-between">
                                          <div class="flex-grow-1">
                                            <span class="text-success fw-bold me-2">{{ goodsIndex + 1 }}.</span>
                                            <span v-if="goods.nxDgGoodsBrand && goods.nxDgGoodsBrand !== 'null'" 
                                                  class="badge bg-warning text-dark me-1">
                                              {{ goods.nxDgGoodsBrand }}
                                            </span>
                                            <span class="text-dark">{{ goods.nxDgGoodsName }}</span>
                                            <span class="text-muted small ms-1">
                                              ({{ goods.nxDgGoodsStandardWeight && goods.nxDgGoodsStandardWeight !== 'null' 
                                                ? goods.nxDgGoodsStandardWeight + '/' + goods.nxDgGoodsStandardname 
                                                : goods.nxDgGoodsStandardname }})
                                            </span>
                                          </div>
                                          <button 
                                            class="btn btn-success btn-sm"
                                            :class="{ 'btn-warning': !goods.nxDgNxGoodsId }">
                                            {{ goods.nxDgNxGoodsId ? '选择' : '临时' }}
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <!-- 系统商品列表 -->
                                    <div v-if="nxArr.length > 0" class="mb-2">
                                      <div class="bg-info text-white p-1 mb-2 rounded small">
                                        📦 下载商品库{{ nxArr.length }}个:
                                      </div>
                                      <div 
                                        v-for="(goods, nxIndex) in nxArr" 
                                        :key="goods.nxGoodsId || nxIndex"
                                        class="goods-item p-2 mb-1 rounded hover-bg d-flex align-items-center justify-content-between"
                                        style="cursor: pointer;">
                                        <div class="flex-grow-1">
                                          <span class="text-primary fw-bold me-2">{{ nxIndex + 1 }}.</span>
                                          <span v-if="goods.nxGoodsBrand && goods.nxGoodsBrand !== 'null'" 
                                                class="badge bg-warning text-dark me-1">
                                            {{ goods.nxGoodsBrand }}
                                          </span>
                                          <span class="text-dark">{{ goods.nxGoodsName }}</span>
                                          <span v-if="goods.nxAliasEntities && goods.nxAliasEntities.length > 0" 
                                                v-for="(alias, aliasIndex) in goods.nxAliasEntities" 
                                                :key="alias.nxDaAliasName || aliasIndex"
                                                class="text-primary me-1">
                                            @{{ alias.nxDaAliasName }}
                                          </span>
                                          <span class="text-muted small ms-1">
                                            <template v-if="goods.nxGoodsStandardWeight && goods.nxGoodsStandardWeight !== 'null'">
                                              <template v-if="goods.nxGoodsStandardname !== '斤'">
                                                ({{ goods.nxGoodsStandardWeight }}/{{ goods.nxGoodsStandardname }})
                                              </template>
                                            </template>
                                            <template v-else>
                                              ({{ goods.nxGoodsStandardname }})
                                            </template>
                                          </span>
                                          <span v-if="goods.nxGoodsPlace && goods.nxGoodsPlace !== 'null'" 
                                                class="text-muted small me-2">
                                            产地:{{ goods.nxGoodsPlace }}
                                          </span>
                                          <span v-if="goods.nxGoodsDetail && goods.nxGoodsDetail !== 'null'" 
                                                class="text-muted small">
                                            {{ goods.nxGoodsDetail }}
                                          </span>
                                        </div>
                                        <button 
                                          class="btn btn-info btn-sm"
                                          @click="downLoadGoodsNx(goods, orderIndex)"
                                          style="flex-shrink: 0; padding: 20px; display: flex; align-items: center; justify-content: center; width: 40px;"
                                          title="下载商品">
                                          ⬇️
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                <!-- 数量（可编辑） -->
                                <div style="width: 100px;">
                                  <span v-if="item.nxDoStatus === 0" class="text-dark">
                                    {{ item.nxDoQuantity || '数量' }}
                                  </span>
                                  <input 
                                    v-else
                                    type="number" 
                                    :value="item.nxDoQuantity"
                                    @input="editOrder($event, 'quantity', orderIndex)"
                                    class="form-control form-control-sm"
                                    :class="{ 'border-success': item.nxDoStatus === -2 }"
                                    placeholder="数量"
                                    style="font-size: 14px;"
                                  />
                                </div>
                                
                                <!-- 规格（可编辑） -->
                                <div style="width: 80px;">
                                  <span v-if="item.nxDoStatus === 0" class="text-dark">
                                    {{ item.nxDoStandard || '规格' }}
                                  </span>
                                  <input 
                                    v-else
                                    type="text" 
                                    :value="item.nxDoStandard"
                                    @input="editOrder($event, 'standard', orderIndex)"
                                    class="form-control form-control-sm"
                                    :class="{ 'border-success': item.nxDoStatus === -2 }"
                                    placeholder="规格"
                                    style="font-size: 14px;"
                                  />
                                </div>
                                
                                <!-- 操作按钮（三点菜单） -->
                                <button 
                                  v-if="item.nxDoStatus === -2"
                                  class="btn btn-link p-1"
                                  @click="showPasteOperation(orderIndex)"
                                  title="更多操作">
                                  ⋮
                                </button>
                              </div>
                              
                              <!-- 备注（可编辑） -->
                              <div v-if="item.nxDoAddRemark || item.nxDoRemark" class="mt-2 ps-4">
                                <span class="text-muted small me-2">备注:</span>
                                <span v-if="item.nxDoStatus === 0" class="text-dark">
                                  {{ item.nxDoRemark || '' }}
                                </span>
                                <input 
                                  v-else
                                  type="text" 
                                  :value="item.nxDoRemark"
                                  @input="editOrder($event, 'remark', orderIndex)"
                                  class="form-control form-control-sm d-inline-block"
                                  :class="{ 'border-success': item.nxDoStatus === -2 }"
                                  placeholder="添加备注信息"
                                  style="width: calc(100% - 60px); font-size: 14px;"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 左右分栏布局：左侧图片/粘贴输入框，右侧订单列表（转订单模式和图片上传模式不在这里显示，它们有各自的显示区域） -->
                  <div v-if="uploadType === 'paste' || (uploadType !== 'image' && uploadType !== 'paste' && uploadType !== 'auto' && orderItems.length > 0)" class="row g-3" style="min-height: 500px;">
                    <!-- 左侧：图片预览（仅图片模式，但图片上传模式不在这里显示） -->
                    <div v-if="false" class="col-md-4">
                      <div class="card h-100">
                        <div class="card-header d-flex justify-content-between align-items-center">
                          <h6 class="mb-0">图片预览</h6>
                          <button 
                            class="btn btn-sm btn-outline-danger"
                            @click="clearImagePreview">
                            清除图片
                          </button>
                        </div>
                        <div class="card-body p-2 position-relative" 
                             style="min-height: 400px; overflow: hidden; cursor: move;"
                             @mousedown="startDrag"
                             @mousemove="onDrag"
                             @mouseup="endDrag"
                             @mouseleave="endDrag"
                             @wheel.prevent="onWheel">
                          <div class="position-absolute top-0 end-0 m-2 d-flex gap-1" style="z-index: 10;">
                            <button 
                              class="btn btn-sm btn-outline-secondary"
                              @click.stop="resetImageTransform"
                              title="重置">
                              🔄
                            </button>
                            <button 
                              class="btn btn-sm btn-outline-secondary"
                              @click.stop="zoomIn"
                              title="放大">
                              ➕
                            </button>
                            <button 
                              class="btn btn-sm btn-outline-secondary"
                              @click.stop="zoomOut"
                              title="缩小">
                              ➖
                            </button>
                          </div>
                          <div 
                            class="d-flex align-items-center justify-content-center"
                            style="width: 100%; height: 100%; transform-origin: center center;">
                            <img 
                              :src="imagePreview" 
                              alt="预览" 
                              class="img-fluid"
                              :style="{
                                transform: `translate(${imageTranslateX}px, ${imageTranslateY}px) scale(${imageScale})`,
                                transition: isDragging ? 'none' : 'transform 0.1s',
                                cursor: isDragging ? 'grabbing' : 'grab',
                                maxWidth: 'none',
                                height: 'auto',
                                objectFit: 'contain'
                              }"
                              @dragstart.prevent>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 左侧：粘贴输入框（仅粘贴模式，选择即显示） -->
                    <div v-if="uploadType === 'paste'" class="col-md-4">
                      <div class="card h-100">
                        <div class="card-header d-flex justify-content-between align-items-center">
                          <h6 class="mb-0">粘贴订单文本</h6>
                          <button 
                            class="btn btn-sm btn-outline-danger"
                            @click="clearPasteText">
                            清除
                          </button>
                        </div>
                        <div class="card-body p-3" style="min-height: 400px; display: flex; flex-direction: column;">
                          <textarea
                            v-model="pasteInputText"
                            class="form-control mb-2 flex-grow-1"
                            rows="15"
                            placeholder="请将订单文本粘贴到这里，例如：&#10;苹果 5 斤&#10;香蕉 3 斤&#10;橙子 2 斤"
                            style="font-size: 14px; resize: none; min-height: 350px;"
                          ></textarea>
                          
                          <div class="d-flex gap-2 mt-2">
                            <button 
                              class="btn btn-sm btn-primary"
                              @click="pasteFromClipboard">
                              从剪贴板粘贴
                            </button>
                            <button 
                              class="btn btn-sm btn-success"
                              @click="parsePasteText"
                              :disabled="!pasteInputText || pasteInputText.trim() === ''">
                              解析订单
                            </button>
                          </div>
                          
                          <small class="text-muted d-block mt-2">
                            支持多种格式：商品名 数量 单位，例如：苹果 5 斤、香蕉 3 个
                          </small>
                        </div>
                      </div>
                    </div>

                    <!-- 右侧：订单列表 -->
                    <div v-if="uploadType !== 'excel' && uploadType !== 'image'" :class="uploadType === 'paste' ? 'col-md-8' : 'col-12'" class="order-items-section" style="display: flex; flex-direction: column; height: 100%; min-height: 500px;">
                      <div v-if="orderItems.length > 0" class="d-flex justify-content-between align-items-center mb-3" style="flex-shrink: 0;">
                        <h6 class="mb-0">转换订单 ({{ orderItems.length }} 项)</h6>
                        <div class="d-flex gap-2">
                          <button 
                            v-if="hasCache"
                            class="btn btn-warning btn-sm" 
                            @click="clearSave">
                            清除草稿
                          </button>
                          <button 
                            class="btn btn-success btn-sm" 
                            @click="pasteSearchGoods"
                            :disabled="savingOrder">
                            {{ savingOrder ? '保存中...' : '保存订单' }}
                          </button>
                        </div>
                      </div>
                      
                      <!-- 订单列表（参考微信小程序样式） -->
                      <div v-if="orderItems.length > 0" class="order-list-container flex-grow-1" style="overflow-y: auto; border: 1px solid #dee2e6; border-radius: 0.375rem; padding: 1rem; min-height: 400px;">
                        <div 
                          v-for="(item, orderIndex) in orderItems" 
                          :key="orderIndex"
                          class="order-item-card mb-2 p-3 bg-white rounded shadow-sm"
                          :class="{ 'border-success': item.nxDoStatus === -2, 'border-primary': item.nxDoStatus === 0 }"
                          style="border-left: 4px solid; position: relative;">
                          
                          <!-- 订单行 -->
                        <div class="d-flex align-items-center gap-2 mb-2">
                          <!-- 序号 -->
                          <span class="text-secondary fw-bold" style="min-width: 30px;">{{ orderIndex + 1 }}.</span>
                          
                          <!-- 来源文件标识（转订单时显示） -->
                          <!-- 商品名称（可编辑） -->
                          <div class="flex-grow-1 position-relative" style="min-width: 0;">
                            <span v-if="item.nxDoStatus === 0" class="text-dark">
                              {{ item.nxDoGoodsName || '请输入商品名称' }}
                            </span>
                            <input 
                              v-else
                              type="text" 
                              :value="item.nxDoGoodsName"
                              @input="editOrderName($event, orderIndex)"
                              class="form-control form-control-sm"
                              :class="{ 'border-success': item.nxDoStatus === -2 }"
                              placeholder="请输入商品名称"
                              style="font-size: 14px;"
                            />
                            
                            <!-- 已匹配的商品列表（参考微信小程序第102-147行） -->
                            <!-- 当不在编辑当前订单时，显示已匹配的商品列表 -->
                            <div 
                              v-if="orderArrIndex !== orderIndex && item.nxDoStatus !== 0 && (item.nxDistributerGoodsEntityList && item.nxDistributerGoodsEntityList.length > 0 || item.nxGoodsEntities && item.nxGoodsEntities.length > 0)"
                              class="matched-goods-list position-absolute bg-white border rounded shadow-lg p-2"
                              style="top: 100%; left: 0; right: 0; z-index: 999; max-height: 400px; overflow-y: auto; margin-top: 4px; border-left: 1px solid gray;">
                              
                              <!-- 配送商已匹配商品列表 -->
                              <div v-if="item.nxDistributerGoodsEntityList && item.nxDistributerGoodsEntityList.length > 0" class="mb-2">
                                <div 
                                  v-for="(orderGoods, orderGoodsIndex) in item.nxDistributerGoodsEntityList" 
                                  :key="orderGoods.nxDistributerGoodsId || orderGoodsIndex"
                                  class="matched-goods-item p-2 mb-1 rounded hover-bg d-flex align-items-center justify-content-between"
                                  @click="saveOrder(orderGoods, orderIndex)"
                                  style="cursor: pointer; background-color: #ffffff; border-bottom: 1px solid #f0f0f0; padding: 12px 16px;">
                                  <div class="flex-grow-1">
                                    <span class="text-muted fw-bold me-2" style="color: #666;">({{ orderGoodsIndex + 1 }}).</span>
                                    <span v-if="orderGoods.nxDgGoodsBrand && orderGoods.nxDgGoodsBrand !== 'null'" 
                                          class="badge bg-warning text-dark me-1">
                                      {{ orderGoods.nxDgGoodsBrand }}
                                    </span>
                                    <span class="text-dark" style="color: #333; font-weight: 500;">{{ orderGoods.nxDgGoodsName }}</span>
                                    <span class="text-muted small ms-1" style="color: #666;">
                                      ({{ orderGoods.nxDgGoodsStandardWeight && orderGoods.nxDgGoodsStandardWeight !== 'null' 
                                        ? orderGoods.nxDgGoodsStandardWeight + '/' + orderGoods.nxDgGoodsStandardname 
                                        : orderGoods.nxDgGoodsStandardname }})
                                    </span>
                                  </div>
                                  <button class="btn btn-success btn-sm" style="flex-shrink: 0; min-width: 80px; padding: 8px 16px;">
                                    选择
                                  </button>
                                </div>
                              </div>
                              
                              <!-- 系统已匹配商品列表（参考微信小程序第121-145行） -->
                              <div v-if="item.nxGoodsEntities && item.nxGoodsEntities.length > 0" 
                                   class="mb-2"
                                   style="border-left: 1px solid gray; border-right: 1px solid gray; border-bottom: 1px solid gray;">
                                <div 
                                  v-for="(goods, nxIndex) in item.nxGoodsEntities" 
                                  :key="goods.nxGoodsId || nxIndex"
                                  class="matched-goods-item p-2 mb-1 d-flex align-items-center justify-content-between"
                                  style="width: 100%; border-bottom: 1px solid #f0f0f0; padding: 12px 16px; box-sizing: border-box;">
                                  <div class="flex-grow-1 d-flex align-items-center" style="flex: 1; padding: 10px; min-height: 60px; margin-right: 20px; width: calc(100% - 100px);">
                                    <span class="text-muted fw-bold me-2" style="color: #666; min-width: 40px; flex-shrink: 0;">{{ nxIndex + 1 }}.</span>
                                    <div class="d-flex flex-wrap align-items-center" style="flex: 1; padding: 10px; min-height: 40px; overflow: hidden;">
                                      <span v-if="goods.nxGoodsBrand && goods.nxGoodsBrand !== 'null'" 
                                            class="badge bg-warning text-dark me-1">
                                        {{ goods.nxGoodsBrand }}
                                      </span>
                                      <span class="text-dark fw-bold me-2" style="color: #333; font-weight: 500;">{{ goods.nxGoodsName }}</span>
                                      <span v-if="goods.nxAliasEntities && goods.nxAliasEntities.length > 0" 
                                            v-for="(alias, aliasIndex) in goods.nxAliasEntities" 
                                            :key="alias.nxDaAliasName || aliasIndex"
                                            class="text-primary me-1" 
                                            style="color: #1c7efb; margin-right: 8px;">
                                        @{{ alias.nxDaAliasName }}
                                      </span>
                                      <span class="text-muted small ms-1" style="color: #666; margin-right: 12px;">
                                        <template v-if="goods.nxGoodsStandardWeight && goods.nxGoodsStandardWeight !== 'null'">
                                          <template v-if="goods.nxGoodsStandardname !== '斤'">
                                            ({{ goods.nxGoodsStandardWeight }}/{{ goods.nxGoodsStandardname }})
                                          </template>
                                        </template>
                                        <template v-else>
                                          ({{ goods.nxGoodsStandardname }})
                                        </template>
                                      </span>
                                      <span v-if="goods.nxGoodsPlace && goods.nxGoodsPlace !== 'null'" 
                                            class="text-muted small me-2" 
                                            style="color: #666; margin-right: 12px;">
                                        产地:{{ goods.nxGoodsPlace }}
                                      </span>
                                      <span v-if="goods.nxGoodsDetail && goods.nxGoodsDetail !== 'null'" 
                                            class="text-muted small" 
                                            style="color: #666;">
                                        {{ goods.nxGoodsDetail }}
                                      </span>
                                    </div>
                                  </div>
                                  <button 
                                    class="btn btn-info btn-sm"
                                    @click="downLoadGoodsNx(goods, orderIndex)"
                                    style="flex-shrink: 0; padding: 20px; display: flex; align-items: center; justify-content: center; width: 40px;"
                                    title="下载商品">
                                    ⬇️
                                  </button>
                                </div>
                              </div>
                            </div>
                            
                            <!-- 商品搜索下拉框（参考微信小程序第149-213行） -->
                            <!-- 当正在编辑当前订单时，显示搜索下拉框 -->
                            <div 
                              v-if="orderArrIndex === orderIndex && item.nxDoStatus !== 0 && (strArr.length > 0 || nxArr.length > 0)"
                              class="goods-search-dropdown position-absolute bg-white border rounded shadow-lg p-2"
                              style="top: 100%; left: 0; right: 0; z-index: 1000; max-height: 400px; overflow-y: auto; margin-top: 4px;">
                              
                              <!-- 搜索标题 -->
                              <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                                <span class="text-muted small">搜索{{ strArr.length + nxArr.length }}个商品:</span>
                                <button class="btn btn-sm btn-link p-0" @click="closeStr" style="font-size: 12px;">✕</button>
                              </div>
                              
                              <!-- 配送商商品列表 -->
                              <div v-if="strArr.length > 0" class="mb-2">
                                <div 
                                  v-for="(goods, goodsIndex) in strArr" 
                                  :key="goods.nxDistributerGoodsId || goodsIndex"
                                  class="goods-item p-2 mb-1 rounded hover-bg"
                                  @click="saveOrder(goods, orderIndex)"
                                  style="cursor: pointer;">
                                  <div class="d-flex align-items-center justify-content-between">
                                    <div class="flex-grow-1">
                                      <span class="text-success fw-bold me-2">{{ goodsIndex + 1 }}.</span>
                                      <span v-if="goods.nxDgGoodsBrand && goods.nxDgGoodsBrand !== 'null'" 
                                            class="badge bg-warning text-dark me-1">
                                        {{ goods.nxDgGoodsBrand }}
                                      </span>
                                      <span class="text-dark">{{ goods.nxDgGoodsName }}</span>
                                      <span class="text-muted small ms-1">
                                        ({{ goods.nxDgGoodsStandardWeight && goods.nxDgGoodsStandardWeight !== 'null' 
                                          ? goods.nxDgGoodsStandardWeight + '/' + goods.nxDgGoodsStandardname 
                                          : goods.nxDgGoodsStandardname }})
                                      </span>
                                    </div>
                                    <button 
                                      class="btn btn-success btn-sm"
                                      :class="{ 'btn-warning': !goods.nxDgNxGoodsId }">
                                      {{ goods.nxDgNxGoodsId ? '选择' : '临时' }}
                                    </button>
                                  </div>
                                </div>
                              </div>
                              
                              <!-- 系统商品列表 -->
                              <div v-if="nxArr.length > 0" class="mb-2">
                                <div class="bg-info text-white p-1 mb-2 rounded small">
                                  📦 下载商品库{{ nxArr.length }}个:
                                </div>
                                <div 
                                  v-for="(goods, nxIndex) in nxArr" 
                                  :key="goods.nxGoodsId || nxIndex"
                                  class="goods-item p-2 mb-1 rounded hover-bg d-flex align-items-center justify-content-between"
                                  style="cursor: pointer;">
                                  <div class="flex-grow-1">
                                    <span class="text-primary fw-bold me-2">{{ nxIndex + 1 }}.</span>
                                    <span v-if="goods.nxGoodsBrand && goods.nxGoodsBrand !== 'null'" 
                                          class="badge bg-warning text-dark me-1">
                                      {{ goods.nxGoodsBrand }}
                                    </span>
                                    <span class="text-dark">{{ goods.nxGoodsName }}</span>
                                    <span class="text-muted small ms-1">
                                      ({{ goods.nxGoodsStandardWeight && goods.nxGoodsStandardWeight !== 'null' 
                                        ? goods.nxGoodsStandardname + '/' + goods.nxGoodsStandardWeight 
                                        : goods.nxGoodsStandardname }})
                                    </span>
                                  </div>
                                  <button 
                                    class="btn btn-info btn-sm"
                                    @click="downLoadGoodsNx(goods, orderIndex)"
                                    title="下载商品">
                                    ⬇️
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <!-- 数量（可编辑） -->
                          <div style="width: 100px;">
                            <span v-if="item.nxDoStatus === 0" class="text-dark">
                              {{ item.nxDoQuantity || '数量' }}
                            </span>
                            <input 
                              v-else
                              type="number" 
                              :value="item.nxDoQuantity"
                              @input="editOrder($event, 'quantity', orderIndex)"
                              class="form-control form-control-sm"
                              :class="{ 'border-success': item.nxDoStatus === -2 }"
                              placeholder="数量"
                              style="font-size: 14px;"
                            />
                          </div>
                          
                          <!-- 规格（可编辑） -->
                          <div style="width: 80px;">
                            <span v-if="item.nxDoStatus === 0" class="text-dark">
                              {{ item.nxDoStandard || '规格' }}
                            </span>
                            <input 
                              v-else
                              type="text" 
                              :value="item.nxDoStandard"
                              @input="editOrder($event, 'standard', orderIndex)"
                              class="form-control form-control-sm"
                              :class="{ 'border-success': item.nxDoStatus === -2 }"
                              placeholder="规格"
                              style="font-size: 14px;"
                            />
                          </div>
                          
                          <!-- 操作按钮（三点菜单） -->
                          <button 
                            v-if="item.nxDoStatus === -2"
                            class="btn btn-link p-1"
                            @click="showPasteOperation(orderIndex)"
                            title="更多操作">
                            ⋮
                          </button>
                        </div>
                        
                        <!-- 备注（可编辑） -->
                        <div v-if="item.nxDoAddRemark || item.nxDoRemark" class="mt-2 ps-4">
                          <span class="text-muted small me-2">备注:</span>
                          <span v-if="item.nxDoStatus === 0" class="text-dark">
                            {{ item.nxDoRemark || '' }}
                          </span>
                          <input 
                            v-else
                            type="text" 
                            :value="item.nxDoRemark"
                            @input="editOrder($event, 'remark', orderIndex)"
                            class="form-control form-control-sm d-inline-block"
                            :class="{ 'border-success': item.nxDoStatus === -2 }"
                            placeholder="添加备注信息"
                            style="width: calc(100% - 60px); font-size: 14px;"
                          />
                          </div>
                        </div>
                      </div>
                      
                      <!-- 空状态提示（订单列表为空时） -->
                      <div v-else class="text-center p-5">
                        <div class="alert alert-info">
                          <h6>暂无订单数据</h6>
                          <p class="mb-0">请上传Excel文件或图片文件来生成订单</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 操作菜单弹窗（参考微信小程序） -->
              <div 
                v-if="showOperationPaste"
                class="overlay position-fixed top-0 start-0 w-100 h-100 d-flex align-items-end justify-content-center"
                style="background-color: rgba(0,0,0,0.5); z-index: 2000;"
                @click.self="hideMask">
                <div class="bg-white rounded-top shadow-lg" style="width: 100%; max-width: 500px; max-height: 70%;">
                  <div class="text-center p-3 border-bottom">
                    <strong>{{ orderItem && orderItem.nxDoGoodsName ? orderItem.nxDoGoodsName : '' }}</strong>
                  </div>
                  <div class="list-group list-group-flush">
                    <!-- 已保存订单显示修改订单，草稿订单显示删除订单 -->
                    <button 
                      v-if="orderItem && orderItem.nxDoStatus === 0"
                      class="list-group-item list-group-item-action border-0"
                      @click="editOrderItem">
                      <span class="me-2">✏️</span>修改订单
                    </button>
                    <button 
                      v-if="orderItem && orderItem.nxDoStatus !== 0"
                      class="list-group-item list-group-item-action border-0 text-danger"
                      @click="delOrder">
                      <span class="me-2">🗑️</span>删除订单
                    </button>
                    <button 
                      class="list-group-item list-group-item-action border-0"
                      @click="addNewPasteOrderBefore">
                      <span class="me-2">➕</span>在之前加新订单
                    </button>
                    <button 
                      v-if="orderItem && orderItem.nxDoStatus === -2"
                      class="list-group-item list-group-item-action border-0"
                      @click="addDisAlias">
                      <span class="me-2">➕</span>添加临时商品
                    </button>
                    <button 
                      v-if="orderItem && orderItem.nxDoStatus === -2"
                      class="list-group-item list-group-item-action border-0"
                      @click="addRemark">
                      <span class="me-2">📝</span>添加备注
                    </button>
                  </div>
                </div>
                  </div>
                </div>
              </div>

              <!-- 标签2：下单 -->
              <div v-if="allCustomerTabIndex === 1" class="tab-pane fade show active" role="tabpanel">
                <div class="save-order-tab" style="height: calc(100vh - 300px); overflow: hidden; display: flex; flex-direction: column;">
                  <!-- 上传方式选择 -->
                  <div class="mb-3">
                    <div class="form-group d-flex gap-3 align-items-center flex-wrap">
                      <label class="mb-0" style="cursor: pointer;">
                        <input 
                          type="radio" 
                          v-model="uploadType" 
                          value="excel" 
                          class="me-2"
                          @change="handleUploadTypeChange('excel')">
                        上传Excel表
                      </label>
                      <label class="mb-0" style="cursor: pointer;">
                        <input 
                          type="radio" 
                          v-model="uploadType" 
                          value="image" 
                          class="me-2"
                          @change="handleUploadTypeChange('image')">
                        上传图片
                      </label>
                      <label class="mb-0" style="cursor: pointer;">
                        <input 
                          type="radio" 
                          v-model="uploadType" 
                          value="paste" 
                          class="me-2"
                          @change="handleUploadTypeChange('paste')">
                        复制粘贴
                      </label>
                      <label class="mb-0" style="cursor: pointer;">
                        <input 
                          type="radio" 
                          v-model="uploadType" 
                          value="auto" 
                          class="me-2"
                          @change="handleUploadTypeChange('auto')">
                        🔄 转订单
                      </label>
                    </div>
                    <small class="text-muted d-block mt-2">当前选择：{{ uploadType === 'auto' ? '转订单（自动处理文件夹）' : uploadType }}</small>
                  </div>

                  <!-- Excel上传区域 - 左右分栏布局 -->
                  <div v-if="uploadType === 'excel'" class="upload-section mb-3" style="flex: 1; min-height: 400px; display: flex; flex-direction: column; overflow: hidden;">
            <!-- 月份标签页 -->
            <ul class="nav nav-tabs mb-3" id="monthTabs" role="tablist">
              <li class="nav-item" v-for="(month, index) in groupedAccountBillData" :key="month.month" role="presentation">
                <button 
                  class="nav-link" 
                  :class="{ 'active': index === activeMonthIndex }" 
                  :id="'month-' + month.month + '-tab'" 
                  type="button" 
                  role="tab"
                  @click="switchMonthTab(index)">
                  {{ month.month }}月
                </button>
              </li>
            </ul>

            <!-- 月份内容 -->
            <div class="tab-content history-orders-content" id="monthTabContent">
              <div v-for="(month, index) in groupedAccountBillData" :key="month.month"
                   class="tab-pane fade" 
                   :class="{ 'show active': index === activeMonthIndex }"
                   :id="'month-' + month.month" 
                   role="tabpanel">

                <!-- 订单列表 -->
                <div v-for="item in month.arr" :key="item.nxDepartmentBillId" 
                     class="order-item p-2 mb-1 border bg-white d-flex justify-content-between align-items-center rounded hover-shadow"
                     style="cursor: pointer;"
                     @click="openOrderDetail(item)">
                  
                  <!-- 订单信息 -->
                  <div class="order-info">
                    <div v-if="item.nxDbDepId !== item.nxDbDepFatherId" class="d-flex align-items-center" style="margin-bottom: 2px;">
                      <span class="me-2">部门:</span>
                      <span>{{ item.nxDepartmentEntity?.nxDepartmentName }}</span>
                    </div>
                    <div class="d-flex align-items-center" style="margin-bottom: 2px;">
                      <span class="me-2">日期:</span>
                      <span class="me-3">{{ formatDate(item.nxDbDate) }}</span>
                      <span>{{ item.nxDbDay }}</span>
                    </div>
                    <div class="d-flex align-items-center small text-muted">
                      <span class="me-2">单号:</span>
                      <span>{{ item.nxDbTradeNo }}</span>
                    </div>
                  </div>

                  <!-- 金额和状态 -->
                  <div class="order-amount d-flex align-items-center">
                    <div class="amount-section me-3 text-end">
                      <div class="d-flex align-items-center justify-content-end">
                        <span class="h5 mb-0">{{ item.nxDbTotal }}</span>
                        <span class="small ms-1">元</span>
                        <span v-if="item.nxDbTotal < 0" class="badge bg-warning ms-2">（退货）</span>
                      </div>
                      <div v-if="item.nxDbStatus == 0" class="small text-danger">未结账</div>
                      <div v-else class="small text-success">已结账</div>
                    </div>
                    
                    <!-- 查看详情按钮 -->
                    <button 
                      class="btn btn-outline-primary btn-sm"
                      @click.stop="openOrderDetail(item)"
                      title="查看订单详情"
                    >
                      👁️ 详情
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

                  <!-- 无历史订单数据 -->
                  <div v-else class="text-center p-5">
            <div class="alert alert-warning">
              <h5>暂无历史订单</h5>
              <p class="mb-0">该客户在最近3个月内没有订单记录</p>
            </div>
          </div>
        </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 编辑订单弹窗（参考微信小程序） -->
    <div 
      v-if="show"
      class="modal fade show d-block"
      tabindex="-1"
      style="background-color: rgba(0,0,0,0.5); z-index: 3000;"
      @click.self="cancle">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">编辑订单</h5>
            <button type="button" class="btn-close" @click="cancle"></button>
                </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">商品名称</label>
              <input type="text" class="form-control" v-model="applyGoodsName" disabled />
              </div>
            <div class="mb-3">
              <label class="form-label">数量</label>
              <input type="number" class="form-control" v-model="applyNumber" />
            </div>
            <div class="mb-3">
              <label class="form-label">规格</label>
              <select 
                class="form-control" 
                v-model="applyStandardName" 
                @change="onStandardChange"
                v-if="itemDis && itemDis.nxDistributerStandardEntities && itemDis.nxDistributerStandardEntities.length > 0">
                <option v-for="standard in itemDis.nxDistributerStandardEntities" 
                        :key="standard.nxDsStandardId" 
                        :value="standard.nxDsStandardName">
                  {{ standard.nxDsStandardName }}
                </option>
              </select>
              <input v-else type="text" class="form-control" v-model="applyStandardName" />
              <button v-if="itemDis" class="btn btn-sm btn-link mt-1" @click="showAddStandard = true">+ 添加新规格</button>
          </div>
            <div class="mb-3" v-if="showAddStandard">
              <label class="form-label">新规格名称</label>
              <div class="input-group">
                <input type="text" class="form-control" v-model="newStandardName" />
                <button class="btn btn-success" @click="confirmStandard">确认</button>
                <button class="btn btn-secondary" @click="showAddStandard = false">取消</button>
        </div>
      </div>
            <div class="mb-3">
              <label class="form-label">备注</label>
              <textarea class="form-control" v-model="applyRemark" rows="3"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-danger" @click="delApply" v-if="editApply">删除订单</button>
            <button type="button" class="btn btn-secondary" @click="cancle">取消</button>
            <button type="button" class="btn btn-primary" @click="confirm">确认</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 警告弹窗（参考微信小程序） -->
    <div 
      v-if="showPopupWarn"
      class="modal fade show d-block"
      tabindex="-1"
      style="background-color: rgba(0,0,0,0.5); z-index: 3001;"
      @click.self="closeWarn">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">警告</h5>
            <button type="button" class="btn-close" @click="closeWarn"></button>
          </div>
          <div class="modal-body">
            <p>{{ warnContent }}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeWarn">取消</button>
            <button type="button" class="btn btn-danger" @click="confirmWarn">确认</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 订单详情弹窗 -->
    <div v-if="showOrderModal" class="modal-overlay" @click="closeOrderModal">
      <div class="modal-content" @click.stop>
<!--        <div class="modal-header">-->
<!--          <h5 class="modal-title">-->
<!--            订单详情 - {{ getPrintComponentName(selectedBillDepPrintName) }}-->
<!--          </h5>-->
<!--          <div class="d-flex align-items-center">-->
<!--            <button class="btn btn-primary me-2" @click="printOrder">-->
<!--              <i class="fas fa-print"></i> 打印订单-->
<!--            </button>-->
<!--            <button type="button" class="btn-close" @click="closeOrderModal"></button>-->
<!--          </div>-->
<!--        </div>-->
        
        <div class="modal-body">
          <!-- 订单基本信息 -->
<!--          <div class="order-info mb-4">-->
<!--            <div class="row">-->
<!--              <div class="col-md-6">-->
<!--                <strong>单号:</strong> {{ billDetailData?.nxDbTradeNo || 'N/A' }}-->
<!--              </div>-->
<!--              <div class="col-md-6">-->
<!--                <strong>总金额:</strong> {{ billDetailData?.nxDbTotal || 0 }} 元-->
<!--              </div>-->
<!--            </div>-->
<!--            <div class="row mt-2">-->
<!--              <div class="col-md-6">-->
<!--                <strong>部门:</strong> {{ selectedBillDepName || 'N/A' }}-->
<!--              </div>-->
<!--              <div class="col-md-6">-->
<!--                <strong>打印格式:</strong> {{ getPrintComponentName(selectedBillDepPrintName) }}-->
<!--              </div>-->
<!--            </div>-->
<!--          </div>-->

          <!-- 打印组件预览区域 -->
          <div class="print-preview-section">
            <!-- 根据打印组件类型显示对应的预览 -->
            <div v-if="selectedBillDepPrintName === 'ApplyPanel'" class="print-component-preview">
              <ApplyPanel 
                ref="applyPanelRef"
                :nxDepFatherId="selectedBillDepFatherId"
                :nxDepId="selectedBillDepFatherId"
                :depName="selectedBillDepName"
                :depPrintName="selectedBillDepPrintName"
                :updateTime="selectedBillId"
                :gbDepFatherId="-1"
                :gbDepId="-1"
                :gbDisId="-1"
                :gbBatchId="-1"
                :orderData="{
                  bill: billDetailData,
                  arr: Array.from(billDetailData?.nxDepartmentOrdersEntities || [])
                }"
                @print-started="closeOrderModal"
              />
            </div>
            
            <div v-else-if="selectedBillDepPrintName === 'ApplyFiftyPanel'" class="print-component-preview">
              <ApplyFiftyPanel 
                ref="applyFiftyPanelRef"
                :nxDepFatherId="selectedBillDepFatherId"
                :nxDepId="selectedBillDepFatherId"
                :depName="selectedBillDepName"
                :depPrintName="selectedBillDepPrintName"
                :updateTime="selectedBillId"
                :gbDepFatherId="-1"
                :gbDepId="-1"
                :gbDisId="-1"
                :gbBatchId="-1"
                :orderData="{
                  bill: billDetailData,
                  arr: Array.from(billDetailData?.nxDepartmentOrdersEntities || [])
                }"
                @print-started="closeOrderModal"
              />
            </div>
            
            <div v-else-if="selectedBillDepPrintName === 'ApplyHalfPanel'" class="print-component-preview">
              <ApplyHalfPanel 
                ref="applyHalfPanelRef"
                :nxDepFatherId="selectedBillDepFatherId"
                :nxDepId="selectedBillDepFatherId"
                :depName="selectedBillDepName"
                :depPrintName="selectedBillDepPrintName"
                :updateTime="selectedBillId"
                :gbDepFatherId="-1"
                :gbDepId="-1"
                :gbDisId="-1"
                :gbBatchId="-1"
                :orderData="{
                  bill: billDetailData,
                  arr: Array.from(billDetailData?.nxDepartmentOrdersEntities || [])
                }"
                @print-started="closeOrderModal"
              />
            </div>
            
            <div v-else-if="selectedBillDepPrintName === 'ApplyHalfWholePanel'" class="print-component-preview">
              <ApplyHalfWholePanel 
                ref="applyHalfWholePanelRef"
                :nxDepFatherId="selectedBillDepFatherId"
                :nxDepId="selectedBillDepFatherId"
                :depName="selectedBillDepName"
                :depPrintName="selectedBillDepPrintName"
                :updateTime="selectedBillId"
                :gbDepFatherId="-1"
                :gbDepId="-1"
                :gbDisId="-1"
                :gbBatchId="-1"
                :orderData="{
                  bill: billDetailData,
                  arr: Array.from(billDetailData?.nxDepartmentOrdersEntities || [])
                }"
                @print-started="closeOrderModal"
              />
            </div>
            
            <div v-else-if="selectedBillDepPrintName === 'ApplyThirtyWholePanel'" class="print-component-preview">
              <ApplyThirtyWholePanel 
                ref="applyThirtyWholePanelRef"
                :nxDepFatherId="selectedBillDepFatherId"
                :nxDepId="selectedBillDepFatherId"
                :depName="selectedBillDepName"
                :depPrintName="selectedBillDepPrintName"
                :updateTime="selectedBillId"
                :gbDepFatherId="-1"
                :gbDepId="-1"
                :gbDisId="-1"
                :gbBatchId="-1"
                :orderData="{
                  bill: billDetailData,
                  arr: Array.from(billDetailData?.nxDepartmentOrdersEntities || [])
                }"
                @print-started="closeOrderModal"
              />
            </div>
            
            <div v-else-if="selectedBillDepPrintName === 'ApplyThirtyPanel'" class="print-component-preview">
              <ApplyThirtyPanel 
                ref="applyThirtyPanelRef"
                :nxDepFatherId="selectedBillDepFatherId"
                :nxDepId="selectedBillDepFatherId"
                :depName="selectedBillDepName"
                :depPrintName="selectedBillDepPrintName"
                :updateTime="selectedBillId"
                :gbDepFatherId="-1"
                :gbDepId="-1"
                :gbDisId="-1"
                :gbBatchId="-1"
                :orderData="{
                  bill: billDetailData,
                  arr: Array.from(billDetailData?.nxDepartmentOrdersEntities || [])
                }"
                @print-started="closeOrderModal"
              />
            </div>
            
            <div v-else class="print-component-preview">
              <div class="alert alert-info">
                暂不支持该打印格式的预览
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import PageHeader from '@/components/PageHeader.vue'
import api from "../api/all";
import config from "../config/index";
import ApplyPanel from "../components/Applys/ApplyPanel.vue";
import ApplyFiftyPanel from '../components/Applys/ApplyFiftyPanel.vue'
import ApplyHalfPanel from '../components/Applys/ApplyHalfPanel.vue';


import ApplyHalfWholePanel from '../components/Applys/ApplyHalfWholePanel.vue';
import ApplyThirtyPanel from '../components/Applys/ApplyThirtyPanel.vue';
import ApplyThirtyWholePanel from '../components/Applys/ApplyThirtyWholePanel.vue';

export default {
  name: "Bills",

  components: {
    PageHeader,
    ApplyPanel,
    ApplyFiftyPanel,
    ApplyHalfPanel,


    ApplyHalfWholePanel,
    ApplyThirtyPanel,
    ApplyThirtyWholePanel,

  },


  data() {
    return {
      depList: [],
      gbDepList: [],
      gbBatchArr: [],
      isactive: 0,
      isactivegb: -1,
      issubactive: -1,
      issubactivegb: -1,
      isactivepb: -1,
      disId: null,
      resFatherId: -1,
      gbBatchId: -1,
      gbDisId: "",
      comId: -1,
      subAmount: 0,
      gbDepFatherId: "",
      gbDepId: "",
      gbDepName: "",
      gbDepPrintName: "",
      nxDepFatherId: "",
      nxDepId: "",
      depName: "",
      depPrintName: "",
      currPage: 1,
      limit: 10,
      totalCount: "",
      totalPage: "",
      updateTime: new Date().getMilliseconds(),
      pollInterval: null,  // 保存定时器ID
      pollStartTime: null, // 轮询开始时间
      
      // 新增：视图切换相关
      currentView: 'order', // 当前视图：'order' 或 'all'
      
      // 新增：全部客户列表相关
      myCustomerArrOne: [], // 现金客户
      myCustomerArrTwo: [], // 记账客户
      selectedAllCustomer: null, // 选中的全部客户ID
      selectedCustomerName: '', // 选中的客户名称
      selectedCustomerDepPrintName: '', // 选中客户的打印组件名称
      selectedCustomerEntity: null, // 选中的客户完整信息
      selectedSubDepartment: null, // 选中的子部门ID（用于订单保存，默认不选择）
      collapsedCustomerTypes: {
        cash: false,    // 现金客户是否折叠（false=展开，true=折叠）
        credit: false  // 记账客户是否折叠
      },
      
      // 新增：客户历史订单相关
      accountBillData: [], // 客户历史订单数据
      activeMonthIndex: 0, // 当前激活的月份索引
      allCustomerTabIndex: 0, // 全部客户视图的标签页索引：0=今日订单, 1=下单, 2=历史订单
      todayOrderTabIndex: 0, // 今日订单下的子标签页索引：0=已保存订单, 1=下单
      todayOrderList: [], // 今日已保存的订单列表（无子部门）
      todayOrderDepArr: [], // 今日已保存的订单列表（有子部门）
      todayOrderTotal: 0, // 今日订单总计
      todayOrderFinishCount: 0, // 今日订单完成数量
      todayOrderTotalCount: 0, // 今日订单总数量
      showOrderOperationMenu: false, // 是否显示操作菜单
      showEditOrderModal: false, // 是否显示修改订单弹窗
      currentEditOrderItem: null, // 当前编辑的订单项
      currentEditOrderIndex: -1, // 当前编辑的订单索引
      currentEditOrderType: '', // 当前编辑的订单类型：'list' 或 'dep'
      currentEditOrderDepIndex: -1, // 当前编辑的订单所属部门索引（如果有子部门）
      editOrderForm: {
        quantity: '',
        standard: '',
        remark: ''
      }, // 编辑订单表单数据
      
      // 新增：保存订单相关
      uploadType: 'excel', // 上传类型：'excel'、'image'、'paste' 或 'auto'
      orderItems: [], // 订单项列表（参考微信小程序的 orderArr）
      imagePreview: null, // 图片预览URL
      savingOrder: false, // 是否正在保存订单
      recognizingImage: false, // 是否正在识别图片
      
      // 新增：转订单相关
      customerFolderPath: null, // 客户文件夹路径
      selectingFolder: false, // 是否正在选择文件夹
      scanningFiles: false, // 是否正在扫描文件
      autoProcessFiles: [], // 待处理的文件列表
      processingFiles: false, // 是否正在处理文件
      autoProcessProgress: { // 处理进度
        current: 0,
        total: 0,
        percent: 0
      },
      autoProcessResults: [], // 处理结果
      autoProcessImagePreview: null, // 转订单模式下的图片预览URL
      autoProcessImagePreviewFileName: '', // 当前预览的图片文件名
      autoProcessImagePreviews: {}, // 已处理图片文件的完整图片预览缓存 { filePath: base64Url }
      autoProcessExcelPreviews: {}, // 已处理Excel文件的数据预览缓存 { filePath: { sheets: [], currentSheet: 0 } }
      activeProcessedFileTab: null, // 当前激活的已处理文件标签 { filePath: string }
      uploadedExcelFile: null, // 当前上传的Excel文件信息 { name, size, dataUrl }
      uploadedImageFile: null, // 当前上传的图片文件信息 { name, size, dataUrl }
      uploadedExcelPreview: null, // 当前上传的Excel文件预览数据 { sheets: [], currentSheet: 0 }
      
      // 复制粘贴相关
      pasteInputText: '', // 粘贴的文本内容
      
      // 图片缩放和移动相关
      imageScale: 1, // 图片缩放比例
      imageTranslateX: 0, // 图片X轴偏移
      imageTranslateY: 0, // 图片Y轴偏移
      isDragging: false, // 是否正在拖拽
      dragStartX: 0, // 拖拽起始X坐标
      dragStartY: 0, // 拖拽起始Y坐标
      
      // 商品搜索相关（参考微信小程序）
      strArr: [], // 配送商商品搜索结果
      nxArr: [], // 系统商品搜索结果
      orderArrIndex: -1, // 当前正在编辑的订单索引
      searchStr: '', // 搜索关键词
      
      // 操作菜单相关（参考微信小程序）
      showOperationPaste: false, // 是否显示操作菜单
      orderPasteIndex: -1, // 当前操作的订单索引
      orderItem: null, // 当前操作的订单项
      findGoods: false, // 从添加临时商品页面返回后，是否需要更新订单
      
      // 编辑订单弹窗相关（参考微信小程序）
      show: false, // 是否显示编辑订单弹窗
      editApply: false, // 是否为编辑模式
      applyItem: null, // 当前编辑的订单项
      applyNumber: '', // 编辑的数量
      applyStandardName: '', // 编辑的规格
      applyRemark: '', // 编辑的备注
      itemDis: null, // 配送商商品信息
      item: null, // 部门商品信息
      printStandard: '', // 打印规格
      priceLevel: '', // 价格等级
      applyGoodsName: '', // 商品名称
      applyGoodsId: '', // 商品ID
      newStandardName: '', // 新规格名称
      
      // 警告弹窗相关（参考微信小程序）
      showPopupWarn: false, // 是否显示警告弹窗
      popupType: '', // 弹窗类型
      warnContent: '', // 警告内容
      disStandardId: '', // 规格ID
      
      // 其他（参考微信小程序）
      goodsId: '', // 商品ID（用于选择商品后保存）
      selectedGoodsName: '', // 选择的商品名称
      name: '', // 商品名称（从添加临时商品页面返回时使用）
      showAddStandard: false, // 是否显示添加规格输入框
      
      // 缓存相关（参考微信小程序）
      ocrOrderDepList: null, // OCR订单缓存列表（按部门）
      ocrOrderDepIndex: -1, // 当前部门的缓存索引
      hasCache: false, // 是否有当前部门的缓存数据
      
      // 已匹配商品列表显示控制
      showMatchedGoods: {}, // 跟踪每个订单的已匹配商品列表显示状态 { orderIndex: boolean }
      
      // 新增：自动刷新相关
      autoRefreshInterval: null, // 自动刷新定时器ID
      
      // 新增：弹窗相关
      showOrderModal: false, // 控制订单详情弹窗显示
      selectedBillId: null, // 选中的账单ID
      selectedBillDepPrintName: '', // 选中账单的打印组件名称
      selectedBillDepName: '', // 选中账单的部门名称
      selectedBillDepFatherId: null, // 选中账单的部门父ID
      billDetailData: null, // 账单详情数据
      billDetailLoading: false, // 账单详情加载状态
      billDetailError: null // 账单详情错误信息
    }
  },

  created() {
    // 获取 URL 中的 query 参数 disId---
    this.disId = this.$route.query.disId;
    this.disName = this.$route.query.disName;

    console.log('获取到的 disId:====', this.disId, this.disName);
  },
  computed: {
    // 判断客户类型（现金或记账）
    customerType() {
      if (!this.selectedAllCustomer) {
        return null;
      }
      // 检查是否在现金客户列表中
      const isCash = this.myCustomerArrOne.some(c => c.nxDepartmentId === this.selectedAllCustomer);
      return isCash ? 'cash' : 'credit';
    },
    // 判断是否有子部门
    hasSubDepartments() {
      return this.selectedCustomerEntity && 
             this.selectedCustomerEntity.nxDepartmentEntities && 
             Array.isArray(this.selectedCustomerEntity.nxDepartmentEntities) &&
             this.selectedCustomerEntity.nxDepartmentEntities.length > 0;
    },
    // 已处理的文件列表
    processedFiles() {
      return this.autoProcessFiles.filter(f => f.status === 'processed');
    },
    // 待处理的文件列表
    pendingFiles() {
      return this.autoProcessFiles.filter(f => f.status !== 'processed');
    },
    // 根据当前选中的文件过滤订单列表
    filteredOrderItems() {
      // 如果不是转订单模式，或者没有选中已处理文件，显示所有订单
      if (this.uploadType !== 'auto' || !this.activeProcessedFileTab) {
        return this.orderItems;
      }
      
      // 找到当前选中的文件
      const activeFile = this.processedFiles.find(f => f.filePath === this.activeProcessedFileTab);
      if (!activeFile) {
        return this.orderItems;
      }
      
      // 只显示来自当前选中文件的订单
      return this.orderItems.filter(order => {
        return order.sourceFile === activeFile.fileName;
      });
    },
    disUser() {
      return this.$store.state.disUser;
    },

    currentTabComponent() {
      return this.depPrintName;
    },

    // 获取可用规格列表（用于编辑订单弹窗）
    availableStandards() {
      if (!this.currentEditOrderItem) {
        return ['斤', '公斤'];
      }
      const standards = [];
      
      // 添加商品默认规格
      if (this.currentEditOrderItem.nxDistributerGoodsEntity?.nxDgGoodsStandardname) {
        standards.push(this.currentEditOrderItem.nxDistributerGoodsEntity.nxDgGoodsStandardname);
      }
      
      // 添加订单当前使用的规格
      if (this.currentEditOrderItem.nxDoPrintStandard && !standards.includes(this.currentEditOrderItem.nxDoPrintStandard)) {
        standards.push(this.currentEditOrderItem.nxDoPrintStandard);
      }
      
      // 添加配送商自定义规格（如果有）
      if (this.currentEditOrderItem.nxDistributerGoodsEntity?.nxDistributerStandardEntities) {
        this.currentEditOrderItem.nxDistributerGoodsEntity.nxDistributerStandardEntities.forEach(standard => {
          if (standard.nxDsStandardName && !standards.includes(standard.nxDsStandardName)) {
            standards.push(standard.nxDsStandardName);
          }
        });
      }
      
      return standards.length > 0 ? standards : ['斤', '公斤'];
    },

    // 过滤后的今日订单部门数组（只显示当前选择的子部门）
    filteredTodayOrderDepArr() {
      if (!this.hasSubDepartments || !this.selectedSubDepartment) {
        return this.todayOrderDepArr;
      }
      
      // 只返回当前选择的子部门的订单
      // 比较时使用 == 以处理字符串和数字类型不匹配的情况
      return this.todayOrderDepArr.filter(dep => {
        // depId 是子部门的 ID，应该等于 selectedSubDepartment
        return String(dep.depId) === String(this.selectedSubDepartment) || 
               String(dep.depFatherId) === String(this.selectedSubDepartment);
      });
    },

    // 按月份分组的订单数据
    groupedAccountBillData() {
      if (!this.accountBillData || this.accountBillData.length === 0) {
        return [];
      }

      // API返回的数据已经是按月份分组的，每个月份对象包含该月的订单
      return this.accountBillData.map((monthData) => {
        // 确保每个月份对象有正确的结构
        return {
          month: monthData.month,
          arr: monthData.arr || [],
          unSettleTotal: monthData.unSettleTotal || 0,
          subDeps: monthData.subDeps || []
        };
      }).filter(month => month.arr && month.arr.length > 0); // 只显示有订单的月份
    }
  },

  watch: {
    disUser: {
      handler(newVal) {
        console.log('disUser发生变化:', newVal);
        if (newVal && newVal.nxDiuDistributerId) {
          console.log('disUser已设置，nxDiuDistributerId:', newVal.nxDiuDistributerId);
        }
      },
      immediate: true
    }
  },


  beforeUnmount() {
    // 清除定时器，防止内存泄漏
    if (this.pollInterval) {
      console.log("清除定时器，防止内存泄漏")
      clearInterval(this.pollInterval);
    }
    
    // 清除自动刷新定时器
    if (this.autoRefreshInterval) {
      console.log("清除自动刷新定时器，防止内存泄漏")
      clearInterval(this.autoRefreshInterval);
    }
    
  },


  mounted() {

    
    // 检查 window.electronAPI 是否存在
    console.log('electronAPI:', window.electronAPI);
    if (window.electronAPI) {
      console.log('electronAPI 方法列表:', Object.keys(window.electronAPI));
      console.log('selectFolder:', typeof window.electronAPI.selectFolder);
      console.log('getCustomerFolderPath:', typeof window.electronAPI.getCustomerFolderPath);
    }

    // 检查disUser状态
    console.log('mounted时的disUser状态:', this.disUser);

    this.fetchCustomerList();

    // 监听来自主进程的 'refresh-customer-list' 消息
    if (window.electronAPI && window.electronAPI.onRefreshCustomerList) {
      console.log("billlvueeieieieieijiantongdaoo----------")
      window.electronAPI.onRefreshCustomerList(() => {
        this.fetchCustomerList();
      });
    }


  },

  methods: {
    // 切换已匹配商品列表的显示/隐藏
    toggleMatchedGoods(orderIndex) {
      // Vue 3 不需要 $set，直接赋值即可
      this.showMatchedGoods[orderIndex] = !this.showMatchedGoods[orderIndex];
    },
    
    // 切换客户类型折叠状态
    toggleCustomerType(type) {
      if (type === 'cash') {
        this.collapsedCustomerTypes.cash = !this.collapsedCustomerTypes.cash;
      } else if (type === 'credit') {
        this.collapsedCustomerTypes.credit = !this.collapsedCustomerTypes.credit;
      }
    },
    
    // 切换到未打印订单客户视图并刷新数据
    switchToOrderCustomers() {
      this.currentView = 'order';
      this.selectedAllCustomer = null;
      this.selectedCustomerName = '';
      this.accountBillData = [];
      // 刷新客户列表数据
      this.fetchCustomerList();
    },

    // 切换到全部客户列表视图
    switchToAllCustomers() {
      this.currentView = 'all';
      this.activeMonthIndex = 0; // 重置月份索引
      this.initAllCustomers();
    },

    // 切换月份标签页
    switchMonthTab(index) {
      this.activeMonthIndex = index;
    },

    // 切换全部客户视图的标签页
    switchAllCustomerTab(index) {
      this.allCustomerTabIndex = index;
      
      // 如果切换到历史订单标签且已选择客户，加载历史订单
      if (index === 2 && this.selectedAllCustomer) {
        const customer = this.myCustomerArrOne.find(c => c.nxDepartmentId === this.selectedAllCustomer) ||
                         this.myCustomerArrTwo.find(c => c.nxDepartmentId === this.selectedAllCustomer);
        if (customer) {
          this.fetchCustomerHistoryOrders(customer);
        }
      } else if (index === 0 && this.selectedAllCustomer) {
        // 如果切换到今日订单标签，加载今日订单
        this.fetchTodayOrders();
      } else if (index === 1 && this.selectedAllCustomer) {
        // 如果切换到下单标签，加载缓存数据
        this._loadCache();
      }
    },

    // 切换今日订单下的子标签页
    switchTodayOrderTab(index) {
      this.todayOrderTabIndex = index;
      
      // 如果切换到已保存订单标签且已选择客户，加载今日订单
      if (index === 0 && this.selectedAllCustomer) {
        this.fetchTodayOrders();
      } else if (index === 1 && this.selectedAllCustomer) {
        // 如果切换到下单标签且已选择客户，加载缓存数据
        this._loadCache();
      }
    },

    // 获取今日已保存的订单
    async fetchTodayOrders() {
      if (!this.selectedAllCustomer || !this.disUser || !this.disUser.nxDiuDistributerId) {
        return;
      }

      try {
        // depFatherId 应该始终传主客户的 ID，而不是子部门的 ID
        // 子部门的选择只用于过滤显示结果
        const requestData = {
          depFatherId: this.selectedAllCustomer,
          gbDepFatherId: this.selectedCustomerEntity?.gbDepFatherId || -1,
          resFatherId: this.selectedCustomerEntity?.resFatherId || -1,
          disId: this.disUser.nxDiuDistributerId
        };

        console.log('获取今日订单，请求参数:', requestData);

        // 使用 phoneGetToFillDepOrders 接口获取今日订单
        const res = await api.phoneGetToFillDepOrders(requestData);
        
        if (res && res.data && res.data.code === 0) {
          const orderData = res.data.data;
          
          // 判断是否有子部门（根据 depHasSubs 或 selectedCustomerEntity 判断）
          const hasSubs = this.selectedCustomerEntity?.nxDepartmentEntities && 
                         this.selectedCustomerEntity.nxDepartmentEntities.length > 0;
          
          if (hasSubs && this.selectedSubDepartment) {
            // 有子部门的情况，数据在 depArr 中
            this.todayOrderDepArr = orderData.arr || [];
            this.todayOrderList = [];
          } else {
            // 无子部门的情况，数据在 applyArr 中
            this.todayOrderList = orderData.arr || [];
            this.todayOrderDepArr = [];
          }
          
          this.todayOrderTotal = orderData.total || 0;
          this.todayOrderFinishCount = orderData.finishCount || 0;
          this.todayOrderTotalCount = orderData.totalCount || 0;
          
          console.log('成功获取今日订单数据:', {
            hasSubs,
            listLength: this.todayOrderList.length,
            depArrLength: this.todayOrderDepArr.length,
            total: this.todayOrderTotal,
            finishCount: this.todayOrderFinishCount,
            totalCount: this.todayOrderTotalCount
          });
        } else {
          console.error('获取今日订单失败:', res);
          this.todayOrderList = [];
          this.todayOrderDepArr = [];
          this.todayOrderTotal = 0;
          this.todayOrderFinishCount = 0;
          this.todayOrderTotalCount = 0;
        }
      } catch (error) {
        console.error('获取今日订单API请求失败:', error);
        this.todayOrderList = [];
        this.todayOrderDepArr = [];
        this.todayOrderTotal = 0;
        this.todayOrderFinishCount = 0;
        this.todayOrderTotalCount = 0;
      }
    },

    // 打开订单操作菜单
    openOrderOperation(order, index, type, depIndex = -1) {
      this.currentEditOrderItem = order;
      this.currentEditOrderIndex = index;
      this.currentEditOrderType = type;
      this.currentEditOrderDepIndex = depIndex;
      this.showOrderOperationMenu = true;
    },

    // 关闭订单操作菜单
    closeOrderOperationMenu() {
      this.showOrderOperationMenu = false;
      this.currentEditOrderItem = null;
      this.currentEditOrderIndex = -1;
      this.currentEditOrderType = '';
      this.currentEditOrderDepIndex = -1;
    },

    // 打开编辑订单弹窗
    openEditOrderModal() {
      if (!this.currentEditOrderItem) {
        return;
      }
      
      // 初始化编辑表单
      this.editOrderForm = {
        quantity: this.currentEditOrderItem.nxDoQuantity || '',
        standard: this.currentEditOrderItem.nxDoStandard || this.currentEditOrderItem.nxDoPrintStandard || '',
        remark: this.currentEditOrderItem.nxDoRemark || ''
      };
      
      // 关闭操作菜单，打开编辑弹窗
      this.showOrderOperationMenu = false;
      this.showEditOrderModal = true;
    },

    // 关闭编辑订单弹窗
    closeEditOrderModal() {
      this.showEditOrderModal = false;
      this.currentEditOrderItem = null;
      this.currentEditOrderIndex = -1;
      this.currentEditOrderType = '';
      this.currentEditOrderDepIndex = -1;
      this.editOrderForm = {
        quantity: '',
        standard: '',
        remark: ''
      };
    },


    // 保存编辑订单
    async saveEditOrder() {
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
          // 更新本地订单数组
          const updatedOrder = {
            ...this.currentEditOrderItem,
            ...res.data.data
          };
          
          // 根据订单类型更新对应的数组
          if (this.currentEditOrderType === 'list') {
            this.todayOrderList[this.currentEditOrderIndex] = updatedOrder;
          } else if (this.currentEditOrderType === 'dep' && this.currentEditOrderDepIndex >= 0) {
            this.todayOrderDepArr[this.currentEditOrderDepIndex].depOrders[this.currentEditOrderIndex] = updatedOrder;
          }
          
          // 重新获取今日订单以刷新数据
          await this.fetchTodayOrders();
          
          alert('修改成功');
          this.closeEditOrderModal();
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

    // 删除今日订单
    async handleDeleteTodayOrder() {
      if (!this.currentEditOrderItem) {
        return;
      }

      if (!confirm(`确定要删除订单 "${this.currentEditOrderItem.nxDistributerGoodsEntity?.nxDgGoodsName || this.currentEditOrderItem.nxDoGoodsName}" 吗？`)) {
        return;
      }

      if (!this.currentEditOrderItem.nxDepartmentOrdersId) {
        alert('订单信息错误，无法删除');
        this.closeOrderOperationMenu();
        return;
      }

      try {
        this.$store.commit('SET_LOADING', true);
        
        const res = await api.deleteOrder(this.currentEditOrderItem.nxDepartmentOrdersId);
        
        if (res && res.data && res.data.code === 0) {
          // 从本地数组中删除
          if (this.currentEditOrderType === 'list') {
            this.todayOrderList = this.todayOrderList.filter((_, idx) => idx !== this.currentEditOrderIndex);
          } else if (this.currentEditOrderType === 'dep' && this.currentEditOrderDepIndex >= 0) {
            this.todayOrderDepArr[this.currentEditOrderDepIndex].depOrders = 
              this.todayOrderDepArr[this.currentEditOrderDepIndex].depOrders.filter((_, idx) => idx !== this.currentEditOrderIndex);
          }
          
          // 重新获取今日订单以刷新数据
          await this.fetchTodayOrders();
          
          alert('删除成功');
          this.closeOrderOperationMenu();
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

    // 处理Excel文件上传（使用新的 recognizeOrderFromExcel 接口）
    async handleExcelUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      // 保存上传的文件信息（用于缓存和显示）
      this.uploadedExcelFile = {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      };
      
      // 读取并解析Excel文件，用于预览
      await this.loadUploadedExcelPreview(file);

      // 验证文件类型
      const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
                          'application/vnd.ms-excel'];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
        alert('请选择有效的Excel文件（.xlsx 或 .xls）');
        return;
      }

      // 验证文件大小（最大10MB）
      if (file.size > 10 * 1024 * 1024) {
        alert('文件大小超过限制，最大支持 10MB');
        return;
      }

      if (!this.selectedAllCustomer) {
        alert('请先选择客户');
        return;
      }

      // 检查是否选择了子部门（如果有子部门的话）
      if (!this.checkSubDepartmentSelected()) {
        // 清空文件输入
        if (this.$refs.excelFileInput) {
          this.$refs.excelFileInput.value = '';
        }
        return;
      }

      // 确定要使用的部门ID（如果有子部门选择，使用子部门ID，否则使用父部门ID）
      const targetDepId = this.selectedSubDepartment || this.selectedAllCustomer;
      
      try {
        this.$store.commit('SET_LOADING', true);
        
        const formData = new FormData();
        formData.append('file', file);
        // 使用确定的部门ID（可能是子部门ID）
        formData.append('depId', targetDepId);
        formData.append('depFatherId', this.selectedAllCustomer); // 父部门ID始终是选中的客户ID
        formData.append('disId', this.disUser.nxDiuDistributerId);
        formData.append('userId', this.disUser.nxDepartmentUserId || this.disUser.nxDistributerUserId || -1);

        // 调用新的Excel解析接口
        const res = await api.recognizeOrderFromExcel(formData);
        
        if (res && res.data) {
          // 根据文档，如果提供了 depId 和 disId，返回的是 data 数组（已保存的订单）
          if (res.data.code === 200 || res.data.code === 0) {
            // 检查是否返回了已保存的订单（data 数组）
            if (Array.isArray(res.data.data) && res.data.data.length > 0) {
              console.log('Excel解析并保存成功，订单数量:', res.data.data.length);
              // 转换为订单格式
              this.orderItems = res.data.data.map(item => ({
                nxDoGoodsName: item.goodsName || item.nxDoGoodsName || '',
                nxDoGoodsNameOriginal: item.goodsName || item.nxDoGoodsName || '',
                nxDoQuantity: item.quantity || item.nxDoQuantity || '',
                nxDoStandard: item.standard || item.nxDoStandard || '斤',
                nxDoRemark: item.remark || item.nxDoRemark || '',
                nxDoAddRemark: !!(item.remark || item.nxDoRemark),
                nxDoStatus: item.status !== undefined ? item.status : (item.nxDoStatus !== undefined ? item.nxDoStatus : -2),
                nxDoDepartmentId: targetDepId, // 使用确定的部门ID（可能是子部门ID）
                nxDoDepartmentFatherId: this.selectedAllCustomer,
                nxDoDisGoodsId: item.disGoodsId || item.nxDoDisGoodsId || null,
                nxDoStandardWarn: 0,
                goodsNameWarn: 0,
                nxDoDistributerId: this.disUser.nxDiuDistributerId,
                nxDoPurchaseUserId: -1,
                nxDoOrderUserId: this.disUser.nxDepartmentUserId || this.disUser.nxDistributerUserId || -1,
                nxDoIsAgent: -1,
                nxDepartmentOrdersId: item.orderId || item.nxDepartmentOrdersId || null,
                // 保留匹配的商品信息
                nxDistributerGoodsEntityList: item.matchedGoods || item.nxDistributerGoodsEntityList || [],
                nxGoodsEntities: item.matchedGoods || item.nxGoodsEntities || []
              }));
              
              alert('Excel解析并保存成功！');
              // 确保预览数据已加载完成后再保存到缓存
              // 如果预览数据还在加载中，等待一下
              if (!this.uploadedExcelPreview) {
                console.log('等待Excel预览数据加载完成...');
                // 等待最多2秒
                let waitCount = 0;
                while (!this.uploadedExcelPreview && waitCount < 20) {
                  await new Promise(resolve => setTimeout(resolve, 100));
                  waitCount++;
                }
              }
              console.log('保存缓存前，预览数据状态:', this.uploadedExcelPreview ? '已加载' : '未加载');
              // 保存到缓存（会保留 uploadedExcelFile 和 uploadedExcelPreview）
              this._saveToStorage(this.orderItems, 'excel');
              // 刷新客户列表（不会清空 uploadedExcelFile 和 uploadedExcelPreview）
              this.fetchCustomerList();
            } 
            // 如果返回的是 items 数组（仅解析，未保存）
            else if (Array.isArray(res.data.items) && res.data.items.length > 0) {
              console.log('Excel解析成功，订单数量:', res.data.items.length);
              // 转换为订单格式
              this.orderItems = res.data.items.map(item => ({
                nxDoGoodsName: item.name || '',
                nxDoGoodsNameOriginal: item.name || '',
                nxDoQuantity: item.qty || '',
                nxDoStandard: item.unit || '斤',
                nxDoRemark: item.remark || '',
                nxDoAddRemark: !!(item.remark && item.remark.trim()),
                nxDoStatus: -2, // 未保存的草稿
                nxDoDepartmentId: targetDepId, // 使用确定的部门ID（可能是子部门ID）
                nxDoDepartmentFatherId: this.selectedAllCustomer,
                nxDoDisGoodsId: null,
                nxDoStandardWarn: 0,
                goodsNameWarn: 0,
                nxDoDistributerId: this.disUser.nxDiuDistributerId,
                nxDoPurchaseUserId: -1,
                nxDoOrderUserId: this.disUser.nxDepartmentUserId || this.disUser.nxDistributerUserId || -1,
                nxDoIsAgent: -1
              }));
              
              alert('Excel解析成功！');
              // 确保预览数据已加载完成后再保存到缓存
              // 如果预览数据还在加载中，等待一下
              if (!this.uploadedExcelPreview) {
                console.log('等待Excel预览数据加载完成...');
                // 等待最多2秒
                let waitCount = 0;
                while (!this.uploadedExcelPreview && waitCount < 20) {
                  await new Promise(resolve => setTimeout(resolve, 100));
                  waitCount++;
                }
              }
              console.log('保存缓存前，预览数据状态:', this.uploadedExcelPreview ? '已加载' : '未加载');
              // 保存到缓存
              this._saveToStorage(this.orderItems, 'excel');
            } else {
              alert('Excel文件中没有可读取的数据');
            }
          } else {
            const errorMsg = res.data.msg || 'Excel解析失败';
            alert(errorMsg);
          }
        }
      } catch (error) {
        console.error('Excel上传失败:', error);
        const errorMsg = error.response?.data?.msg || error.message || 'Excel上传失败，请重试';
        alert(errorMsg);
      } finally {
        this.$store.commit('SET_LOADING', false);
        // 清空文件输入
        if (this.$refs.excelFileInput) {
          this.$refs.excelFileInput.value = '';
        }
      }
    },

    // 处理图片文件上传（OCR识别）
    async handleImageUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      // 验证文件类型
      if (!file.type.startsWith('image/')) {
        alert('请选择有效的图片文件');
        return;
      }

      // 验证文件大小（限制10MB）
      if (file.size > 10 * 1024 * 1024) {
        alert('图片文件过大，请选择小于10MB的图片');
        return;
      }

      if (!this.selectedAllCustomer) {
        alert('请先选择客户');
        return;
      }

      // 检查是否选择了子部门（如果有子部门的话）
      if (!this.checkSubDepartmentSelected()) {
        // 清空文件输入
        if (this.$refs.imageFileInput) {
          this.$refs.imageFileInput.value = '';
        }
        return;
      }

      // 保存上传的文件信息（用于缓存和显示）
      this.uploadedImageFile = {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      };

      // 创建预览
      const reader = new FileReader();
      reader.onload = (e) => {
        this.imagePreview = e.target.result;
        // 保存预览数据到文件信息中
        if (this.uploadedImageFile) {
          this.uploadedImageFile.dataUrl = e.target.result;
        }
      };
      reader.readAsDataURL(file);

      // 确定要使用的部门ID（如果有子部门选择，使用子部门ID，否则使用父部门ID）
      const targetDepId = this.selectedSubDepartment || this.selectedAllCustomer;
      
      try {
        this.recognizingImage = true;
        this.$store.commit('SET_LOADING', true);
        
        // 将图片转换为Base64（参考微信小程序实现）
        const imageBase64 = await this.imageToBase64(file);
        
        // 调用OCR识别API（参考微信小程序 callTencentOCR）
        const ocrData = {
          ImageBase64: imageBase64,
          depId: targetDepId, // 使用确定的部门ID（可能是子部门ID）
          depFatherId: this.selectedAllCustomer, // 父部门ID始终是选中的客户ID
          disId: this.disUser.nxDiuDistributerId,
          userId: this.disUser.nxDistributerUserId || this.disUser.nxDiuDistributerId
        };
        
        const res = await api.recognizeOrderOCR(ocrData);
        
        if (res && res.data && res.data.code === 0) {
          // 检查后端是否已经保存了订单（pasteSearchGoods 已调用）
          // 如果 res.data.data 是数组，说明后台已经保存了订单
          if (Array.isArray(res.data.data) && res.data.data.length > 0) {
            console.log('后台已保存订单，直接使用已保存的数据，订单数量:', res.data.data.length);
            this.orderItems = res.data.data;
            // 保存到缓存（图片解析）
            this._saveToStorage(this.orderItems, 'image');
            alert('识别并保存完成！');
            // 刷新客户列表
            this.fetchCustomerList();
            return;
          }
          
          // 检查后端是否返回了 DeepSeek 解析后的商品列表
          const items = res.data.items || (res.data.data && res.data.data.items);
          const ocrText = res.data.ocrText || (res.data.data && res.data.data.ocrText) || '';
          
          if (items && items.length > 0) {
            // 将后端返回的 items 转换为订单格式（参考微信小程序实现）
            const formattedOrders = items.map(item => ({
              nxDoGoodsName: item.name || '',
              nxDoGoodsNameOriginal: item.name || '', // 保存原始商品名称
              nxDoQuantity: item.qty || '',
              nxDoStandard: item.unit || '斤', // 默认单位
              nxDoRemark: item.remark || '',
              nxDoAddRemark: !!(item.remark && item.remark.trim()),
              nxDoStatus: -2, // 未匹配状态
              nxDoDepartmentId: targetDepId, // 使用确定的部门ID（可能是子部门ID）
              nxDoDepartmentFatherId: this.selectedAllCustomer,
              nxDoDisGoodsId: null,
              nxDoStandardWarn: 0,
              goodsNameWarn: 0,
              nxDoDistributerId: this.disUser.nxDiuDistributerId,
              nxDoPurchaseUserId: -1,
              nxDoOrderUserId: this.disUser.nxDistributerUserId || this.disUser.nxDiuDistributerId,
              nxDoIsAgent: -1,
            }));
            
            // 过滤掉无效订单（商品名为空）
            this.orderItems = formattedOrders.filter(order => 
              order.nxDoGoodsName && order.nxDoGoodsName.trim()
            );
            
            console.log('OCR识别成功，订单项数量:', this.orderItems.length);
            // 保存到缓存（图片解析）
            this._saveToStorage(this.orderItems, 'image');
            alert('识别完成！');
          } else if (ocrText) {
            // 如果只有OCR文本，使用文本解析（参考 formatContent）
            console.log('OCR返回文本，使用文本解析:', ocrText);
            this.parseOCRText(ocrText, 'image');
          } else {
            alert('识别失败：未返回有效数据');
          }
        } else {
          const errorMsg = res?.data?.msg || res?.data?.message || '识别失败';
          
          // 处理不同类型的错误
          if (errorMsg.includes('资源包耗尽') || errorMsg.includes('ResourcePackageRunOut')) {
            alert('OCR 资源包已耗尽，请联系管理员购买资源包');
          } else if (errorMsg.includes('服务未开通') || errorMsg.includes('UnOpenError')) {
            alert('OCR 服务未开通，请联系管理员开通服务');
          } else {
            alert('识别失败：' + errorMsg);
          }
        }
      } catch (error) {
        console.error('图片识别失败:', error);
        
        // 处理404错误（接口未实现）
        if (error.response && error.response.status === 404) {
          alert('OCR 接口未实现，请联系后端开发人员实现接口：POST /api/ocr/recognizeOrder');
        } else {
          alert('图片识别失败，请重试：' + (error.message || '未知错误'));
        }
      } finally {
        this.recognizingImage = false;
        this.$store.commit('SET_LOADING', false);
        // 不清空文件输入，保留以便重新识别
      }
    },

    // 清除图片预览
    clearImagePreview() {
      this.imagePreview = null;
      this.orderItems = [];
      this.resetImageTransform();
      if (this.$refs.imageFileInput) {
        this.$refs.imageFileInput.value = '';
      }
    },
    
    // 重置图片变换
    resetImageTransform() {
      this.imageScale = 1;
      this.imageTranslateX = 0;
      this.imageTranslateY = 0;
    },
    
    // 放大图片
    zoomIn() {
      this.imageScale = Math.min(this.imageScale + 0.2, 5); // 最大5倍
    },
    
    // 缩小图片
    zoomOut() {
      this.imageScale = Math.max(this.imageScale - 0.2, 0.5); // 最小0.5倍
    },
    
    // 鼠标滚轮缩放
    onWheel(event) {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.1 : 0.1;
      const newScale = Math.max(0.5, Math.min(5, this.imageScale + delta));
      this.imageScale = newScale;
    },
    
    // 开始拖拽
    startDrag(event) {
      if (event.button !== 0) return; // 只响应左键
      this.isDragging = true;
      this.dragStartX = event.clientX - this.imageTranslateX;
      this.dragStartY = event.clientY - this.imageTranslateY;
    },
    
    // 拖拽中
    onDrag(event) {
      if (!this.isDragging) return;
      this.imageTranslateX = event.clientX - this.dragStartX;
      this.imageTranslateY = event.clientY - this.dragStartY;
    },
    
    // 结束拖拽
    endDrag() {
      this.isDragging = false;
    },

    // 将图片文件转换为Base64（Electron环境）
    imageToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          // 移除 data:image/xxx;base64, 前缀
          const base64 = e.target.result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = (error) => {
          reject(error);
        };
        reader.readAsDataURL(file);
      });
    },

    // 解析OCR文本为订单（参考微信小程序的 formatContent）
    // orderSourceType: 'image' | 'paste' - 订单来源类型
    parseOCRText(ocrText, orderSourceType) {
      if (!ocrText || !ocrText.trim()) {
        console.log('OCR文本为空，跳过解析');
        return;
      }

      console.log('开始解析OCR文本:', ocrText);
      
      // 确定要使用的部门ID（如果有子部门选择，使用子部门ID，否则使用父部门ID）
      const targetDepId = this.selectedSubDepartment || this.selectedAllCustomer;
      
      // 尝试解析JSON格式（后端DeepSeek返回的格式）
      try {
        let jsonStr = ocrText.trim();
        // 移除可能的 markdown 代码块标记
        jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
        jsonStr = jsonStr.trim();
        
        const ordersJson = JSON.parse(jsonStr);
        
        if (Array.isArray(ordersJson) && ordersJson.length > 0) {
          console.log('JSON解析成功，订单数量:', ordersJson.length);
          
          const formattedOrders = ordersJson.map(item => ({
            nxDoGoodsName: item.name || '',
            nxDoGoodsNameOriginal: item.name || '',
            nxDoQuantity: item.qty || '',
            nxDoStandard: item.unit || '斤',
            nxDoRemark: item.remark || '',
            nxDoAddRemark: !!(item.remark && item.remark.trim()),
            nxDoStatus: -2,
            nxDoDepartmentId: targetDepId, // 使用确定的部门ID
            nxDoDepartmentFatherId: this.selectedAllCustomer,
            nxDoDisGoodsId: null,
            nxDoStandardWarn: 0,
            goodsNameWarn: 0,
            nxDoDistributerId: this.disUser.nxDiuDistributerId,
            nxDoPurchaseUserId: -1,
            nxDoOrderUserId: this.disUser.nxDistributerUserId || this.disUser.nxDiuDistributerId,
            nxDoIsAgent: -1,
          }));
          
          this.orderItems = formattedOrders.filter(order => 
            order.nxDoGoodsName && order.nxDoGoodsName.trim()
          );
          
          console.log('文本解析成功，订单项数量:', this.orderItems.length);
          return;
        }
      } catch (jsonError) {
        console.log('JSON解析失败，使用正则解析:', jsonError.message);
      }
      
      // JSON解析失败，使用正则解析（调用 parseTextToOrders，它会使用正确的部门ID）
      console.log('JSON解析失败，使用文本解析');
      this.parseTextToOrders(ocrText, targetDepId, 'image');
    },

    // 删除订单项
    deleteOrderItem(index) {
      if (confirm('确定要删除此项吗？')) {
        this.orderItems.splice(index, 1);
      }
    },

    // 保存订单（参考微信小程序的 pasteSearchGoods）
    async saveOrderItems() {
      if (!this.selectedAllCustomer) {
        alert('请先选择客户');
        return;
      }

      if (this.orderItems.length === 0) {
        alert('没有可保存的订单项');
        return;
      }

      // 验证订单内容（参考微信小程序的 _checkOrderContent）
      const canSave = this.checkOrderContent();
      if (!canSave) {
        return;
      }

      try {
        this.savingOrder = true;
        this.$store.commit('SET_LOADING', true);

        // 确定要使用的部门ID（优先使用子部门ID）
        const targetDepId = this.selectedSubDepartment || this.selectedAllCustomer;
        
        // 准备订单数据，确保包含必要的字段
        const originalOrderArr = [...this.orderItems];
        const orderData = this.orderItems.map(item => ({
          ...item,
          nxDoDepartmentId: targetDepId, // 使用确定的部门ID
          nxDoDepartmentFatherId: this.selectedAllCustomer,
          nxDoDistributerId: this.disUser.nxDiuDistributerId,
          nxDoIsAgent: this.disUser.nxDistributerUserId || this.disUser.nxDiuDistributerId
        }));

        // 调用保存订单API（参考微信小程序的 pasteSearchGoods）
        const res = await api.pasteSearchGoods(orderData);

        if (res && res.data && res.data.code === 0) {
          const tempArr = res.data.data || [];
          
          // 处理返回的订单数据（参考微信小程序逻辑）
          const listArr = [];
          let haveId = 0;
          
          for (let i = 0; i < tempArr.length; i++) {
            const status = tempArr[i].nxDoStatus;
            if (status !== -2) {
              haveId = haveId + 1;
            }
            
            const item = {
              ...tempArr[i],
              nxDoStandardWarn: 0
            };
            
            // 保留原有的 nxDoGoodsNameOriginal
            const originalOrder = originalOrderArr[i];
            if (originalOrder && originalOrder.nxDoGoodsNameOriginal) {
              item.nxDoGoodsNameOriginal = originalOrder.nxDoGoodsNameOriginal;
            } else {
              item.nxDoGoodsNameOriginal = originalOrder?.nxDoGoodsName || item.nxDoGoodsName || '';
            }
            
            listArr.push(item);
          }
          
          // 更新订单列表
          this.orderItems = listArr;
          
          // 检查保存状态
          if (haveId === listArr.length) {
            alert('订单保存成功！所有订单项已处理完成');
            // 清空订单列表
            this.orderItems = [];
            this.imagePreview = null;
            // 刷新客户列表
            this.fetchCustomerList();
          } else {
            alert(`订单保存成功！已处理 ${haveId}/${listArr.length} 项`);
          }
        } else {
          const errorMsg = res?.data?.msg || '订单保存失败';
          alert(errorMsg);
        }
      } catch (error) {
        console.error('保存订单失败:', error);
        alert('保存订单失败，请重试：' + (error.message || '未知错误'));
      } finally {
        this.savingOrder = false;
        this.$store.commit('SET_LOADING', false);
      }
    },

    // ========== 上传方式切换处理 ==========
    
    // 处理上传方式切换
    handleUploadTypeChange(type) {
      console.log('上传方式切换为:', type);
      this.uploadType = type;
      
      // 切换模式时，重新加载对应模式的缓存
      if (this.selectedAllCustomer) {
        this._loadCache();
      }
      
      // 如果切换到转订单模式，自动扫描文件夹
      if (type === 'auto' && this.customerFolderPath) {
        // 延迟一下，确保 hasCache 已经更新
        this.$nextTick(() => {
          this.scanFolderFiles();
        });
      }
    },
    
    // 检查是否选择了子部门（如果有子部门的话）
    checkSubDepartmentSelected() {
      // 检查是否有选中的客户
      if (!this.selectedCustomerEntity) {
        return true; // 如果没有选中客户，不检查子部门
      }
      
      // 检查是否有子部门
      const hasSubDepartments = this.selectedCustomerEntity.nxDepartmentEntities && 
                                Array.isArray(this.selectedCustomerEntity.nxDepartmentEntities) &&
                                this.selectedCustomerEntity.nxDepartmentEntities.length > 0;
      
      if (hasSubDepartments) {
        // 如果有子部门，必须选择一个子部门
        if (!this.selectedSubDepartment) {
          alert('请先选择子部门');
          return false;
        }
        return true;
      }
      
      // 如果没有子部门，直接返回 true
      return true;
    },
    
    // 处理子部门选择改变
    handleSubDepartmentChange() {
      console.log('========== 子部门选择改变 ==========');
      console.log('选中的子部门ID:', this.selectedSubDepartment);
      
      // 清空订单数据
      this.orderItems = [];
      this.imagePreview = null;
      this.pasteInputText = '';
      this.strArr = [];
      this.nxArr = [];
      this.orderArrIndex = -1;
      this.searchStr = '';
      this.hasCache = false;
      this.recognizingImage = false;
      
      // 重新加载该子部门的文件夹路径
      this.loadCustomerFolderPath();
      
      // 如果当前在今日订单标签的已保存订单子标签，重新加载今日订单
      if (this.allCustomerTabIndex === 0 && this.todayOrderTabIndex === 0) {
        this.fetchTodayOrders();
      } else {
        // 否则重新加载缓存数据
        this._loadCache();
      }
      
      console.log('已清空订单数据，已重新加载文件夹路径和缓存');
      console.log('============================');
    },

    // ========== 复制粘贴相关方法 ==========
    
    // 从剪贴板粘贴
    async pasteFromClipboard() {
      try {
        const text = await navigator.clipboard.readText();
        this.pasteInputText = text;
      } catch (error) {
        console.error('读取剪贴板失败:', error);
        alert('无法读取剪贴板，请手动粘贴');
      }
    },
    
    // 解析粘贴文本为订单
    parsePasteText() {
      if (!this.pasteInputText || !this.pasteInputText.trim()) {
        alert('请输入或粘贴订单文本');
        return;
      }
      
      if (!this.selectedAllCustomer) {
        alert('请先选择客户');
        return;
      }
      
      // 检查是否选择了子部门（如果有子部门的话）
      if (!this.checkSubDepartmentSelected()) {
        return;
      }
      
      // 直接解析文本（parseTextToOrders 会使用 selectedSubDepartment）
      this.parseTextToOrders(this.pasteInputText, null, 'paste');
    },
    
    // 清除粘贴文本
    clearPasteText() {
      this.pasteInputText = '';
    },
    
    // ========== 文本解析为订单（参考 paste.js 的 formatContent 和 _formatOrderContent）==========
    
    // 解析文本为订单（统一入口）
    // orderSourceType: 'image' | 'paste' | 'auto' - 订单来源类型
    parseTextToOrders(text, depId = null, orderSourceType = 'paste') {
      if (!text || !text.trim()) {
        return;
      }
      
      // 确定要使用的部门ID（优先使用传入的depId，否则使用selectedSubDepartment，最后使用selectedAllCustomer）
      const targetDepId = depId || this.selectedSubDepartment || this.selectedAllCustomer;
      
      console.log('[parseTextToOrders] 开始处理内容:', text);
      console.log('[parseTextToOrders] 使用的部门ID:', targetDepId);
      
      // 优先尝试解析 JSON（AI 返回的格式）
      try {
        let jsonStr = text.trim();
        // 移除可能的 markdown 代码块标记
        jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
        jsonStr = jsonStr.trim();
        
        // 尝试解析 JSON
        const ordersJson = JSON.parse(jsonStr);
        
        if (Array.isArray(ordersJson) && ordersJson.length > 0) {
          console.log('[parseTextToOrders] JSON 解析成功，订单数量:', ordersJson.length);
          
          // 转换为系统需要的格式
          const formattedOrders = ordersJson.map(item => ({
            nxDoGoodsName: item.name || '',
            nxDoGoodsNameOriginal: item.name || '',
            nxDoQuantity: item.qty || '',
            nxDoStandard: item.unit || '斤',
            nxDoRemark: item.remark || '',
            nxDoAddRemark: !!(item.remark && item.remark.trim()),
            nxDoStatus: -2,
            nxDoDepartmentId: targetDepId, // 使用确定的部门ID
            nxDoDepartmentFatherId: this.selectedAllCustomer,
            nxDoDisGoodsId: null,
            nxDoStandardWarn: 0,
            goodsNameWarn: 0,
            nxDoDistributerId: this.disUser?.nxDiuDistributerId,
            nxDoPurchaseUserId: -1,
            nxDoOrderUserId: this.disUser?.nxDistributerUserId || this.disUser?.nxDiuDistributerId,
            nxDoIsAgent: -1,
          }));
          
          // 过滤掉无效订单
          const validOrders = formattedOrders.filter(order => 
            order.nxDoGoodsName && order.nxDoGoodsName.trim()
          );
          
          console.log('[parseTextToOrders] 有效订单数量:', validOrders.length);
          this.orderItems = validOrders;
          
          // 保存到缓存（根据来源类型）
          const sourceType = orderSourceType || 'paste';
          this._saveToStorage(validOrders, sourceType);
          
          return;
        }
      } catch (jsonError) {
        console.log('[parseTextToOrders] JSON 解析失败，使用正则解析:', jsonError.message);
      }
      
      // JSON 解析失败，使用正则解析
      const content = text
        .replace(/(\d)\s+/g, '$1') // 处理数字后的空格
        .replace(/[^\S\r\n]+/g, ' '); // 只替换水平空白，保留换行符
      
      const orders = this._formatOrderContent(content, targetDepId);
      this.orderItems = orders;
      
      // 保存到缓存（根据来源类型）
      const sourceType = orderSourceType || 'paste';
      this._saveToStorage(orders, sourceType);
    },
    
    // 格式化订单内容（参考 paste.js 的 _formatOrderContent，简化版）
    _formatOrderContent(content, depId = null) {
      // 确定要使用的部门ID
      const targetDepId = depId || this.selectedSubDepartment || this.selectedAllCustomer;
      console.log('[formatOrderContent] 入参 content:', content);
      let orders = [];
      
      // 按行拆分
      let lines = content.split(/\r?\n/);
      
      // 过滤无效行
      lines = lines.filter(line => {
        line = line.trim();
        if (!line) return false;
        if (/^备注[:：]/.test(line)) return true;
        
        let orderRegex = /^\d+[、，\.．]\s*(.+?)[:：]\s*(.+)$/;
        if (orderRegex.test(line)) return true;
        
        let commaRegex = /^(.*?)\s*[\,，]\s*(.+)$/;
        if (commaRegex.test(line)) return true;
        
        let hasNumber = /[\d零一二两三四五六七八九十百千万半]/.test(line);
        return hasNumber;
      });
      
      // 中文数字转阿拉伯数字
      function chineseNumberToArabic(chineseNum) {
        const map = {
          '零': 0, '一': 1, '二': 2, '两': 2, '三': 3,
          '四': 4, '五': 5, '六': 6, '七': 7, '八': 8,
          '九': 9, '十': 10, '百': 100, '千': 1000,
          '万': 10000, '半': 0.5
        };
        let result = 0, temp = 0;
        for (let i = 0; i < chineseNum.length; i++) {
          const char = chineseNum[i];
          if (char === '半') {
            result += 0.5;
          } else if (map[char] >= 10) {
            if (temp === 0) temp = 1;
            result += temp * map[char];
            temp = 0;
          } else if (map[char] !== undefined) {
            temp = temp * 10 + map[char];
          }
        }
        result += temp;
        return result;
      }
      
      // 从尾部解析「名称 + 括号备注 + 数量+单位」
      function parseSegmentEndOfLine(segment) {
        segment = segment.trim().replace(/[,，、。.]+$/g, '');
        
        const bracketRegex = /(?:（|\(|【)(.+?)(?:）|\)|】)/;
        let remarkText = '';
        const bracketMatch = segment.match(bracketRegex);
        if (bracketMatch) {
          remarkText = bracketMatch[1];
          segment = segment.replace(bracketRegex, '').trim();
        }
        
        const hasArabic = /[0-9]/.test(segment);
        let name = segment, qtyVal = '', qtyUnit = '', regex;
        
        if (hasArabic) {
          regex = /^(.*?)([\d\.]+)(\S*)$/;
        } else {
          regex = /^(.*?)([一二两三四五六七八九十百千万半]+)(\S*)$/;
        }
        const m = segment.match(regex);
        if (m) {
          let potentialName = m[1].trim().replace(/\s+/g, '');
          let potentialQty = m[2].trim();
          let potentialUnit = m[3].trim();
          name = potentialName;
          
          // 数量值
          if (/^[\d\.]+$/.test(potentialQty)) {
            qtyVal = potentialQty;
          } else {
            qtyVal = chineseNumberToArabic(potentialQty).toString();
          }
          
          // 单位列表
          const validUnits = ['斤','个','包','根','棵','条','盒','捆','袋','跟','块','瓶','罐','桶','箱','件'];
          let foundUnit = '';
          for (let u of validUnits) {
            if (potentialUnit.startsWith(u)) {
              foundUnit = u; break;
            }
          }
          if (foundUnit) {
            qtyUnit = foundUnit;
          } else {
            qtyUnit = potentialUnit || '斤'; // 默认单位
          }
        }
        
        return {
          nxDoGoodsName: name,
          nxDoGoodsNameOriginal: name,
          nxDoQuantity: qtyVal,
          nxDoStandard: qtyUnit,
          nxDoRemark: remarkText,
        };
      }
      
      // 逐行处理
      lines.forEach(line => {
        line = line.trim();
        if (!line) return;
        
        if (/^备注[:：]/.test(line)) {
          if (orders.length) {
            let last = orders[orders.length - 1];
            last.nxDoRemark = (last.nxDoRemark || '') + ' ' + line.replace(/^备注[:：]/, '').trim();
          }
          return;
        }
        
        // 尝试解析
        let parsed = parseSegmentEndOfLine(line);
        if (parsed && parsed.nxDoQuantity) {
          orders.push({
            ...parsed,
            nxDoAddRemark: !!parsed.nxDoRemark,
            nxDoStatus: -2,
            nxDoDepartmentId: targetDepId, // 使用确定的部门ID
            nxDoDepartmentFatherId: this.selectedAllCustomer,
            nxDoDisGoodsId: null,
            nxDoStandardWarn: 0,
            goodsNameWarn: 0,
            nxDoDistributerId: this.disUser?.nxDiuDistributerId,
            nxDoPurchaseUserId: -1,
            nxDoOrderUserId: this.disUser?.nxDistributerUserId || this.disUser?.nxDiuDistributerId,
            nxDoIsAgent: -1,
          });
        }
      });
      
      // 过滤掉无效订单
      const validOrders = orders.filter(order => 
        order.nxDoGoodsName && order.nxDoGoodsName.trim() && order.nxDoQuantity
      );
      
      console.log('[formatOrderContent] 解析结果，有效订单数量:', validOrders.length);
      return validOrders;
    },
    
    // ========== 上传方式切换处理 ==========
    
    // 处理上传方式切换
    handleUploadTypeChange(type) {
      console.log('上传方式切换为:', type);
      this.uploadType = type;
      
      // 切换模式时，重新加载对应模式的缓存
      if (this.selectedAllCustomer) {
        this._loadCache();
      }
      
      // 如果切换到转订单模式，自动扫描文件夹
      if (type === 'auto' && this.customerFolderPath) {
        // 延迟一下，确保 hasCache 已经更新
        this.$nextTick(() => {
          this.scanFolderFiles();
        });
      }
    },
    
    // 检查订单内容（参考微信小程序的 _checkOrderContent）
    checkOrderContent() {
      const orderArr = this.orderItems;
      
      if (!orderArr || orderArr.length === 0) {
        alert('没有可保存的订单');
        return false;
      }
      
      for (let i = 0; i < orderArr.length; i++) {
        const order = orderArr[i];
        
        if (!order.nxDoGoodsName || order.nxDoGoodsName.trim() === '') {
          alert(`第${i + 1}条订单商品名称为空`);
          return false;
        }
        
        if (!order.nxDoQuantity || Number(order.nxDoQuantity) <= 0) {
          alert(`第${i + 1}条订单数量无效`);
          return false;
        }
        
        if (!order.nxDoStandard || order.nxDoStandard.trim() === '') {
          alert(`第${i + 1}条订单规格为空`);
          return false;
        }
      }
      
      return true;
    },

    // 保存订单（使用 pasteSearchGoods，参考微信小程序）
    async pasteSearchGoods() {
      const canSave = this.checkOrderContent();
      if (!canSave) {
        return;
      }

      try {
        this.savingOrder = true;
        this.$store.commit('SET_LOADING', true);
        
        const res = await api.pasteSearchGoods(this.orderItems);
        
        if (res && res.data && res.data.code === 0) {
          const tempArr = res.data.data || [];
          const originalOrderArr = [...this.orderItems];
          
          const listArr = [];
          let haveId = 0;
          
          for (let i = 0; i < tempArr.length; i++) {
            const status = tempArr[i].nxDoStatus;
            if (status !== -2) {
              haveId = haveId + 1;
            }
            
            const item = {
              ...tempArr[i],
              nxDoStandardWarn: 0
            };
            
            // 保留原有的 nxDoGoodsNameOriginal
            const originalOrder = originalOrderArr[i];
            if (originalOrder && originalOrder.nxDoGoodsNameOriginal) {
              item.nxDoGoodsNameOriginal = originalOrder.nxDoGoodsNameOriginal;
            } else {
              item.nxDoGoodsNameOriginal = originalOrder?.nxDoGoodsName || item.nxDoGoodsName || '';
            }
            
            listArr.push(item);
          }
          
          this.orderItems = listArr;
          
          // 保存到缓存（复制粘贴）
          this._saveToStorage(listArr, 'paste');
          
          alert('保存成功！');
          
          // 刷新客户列表
          this.fetchCustomerList();
        } else {
          const errorMsg = res?.data?.msg || '保存失败';
          alert(errorMsg);
        }
      } catch (error) {
        console.error('保存订单失败:', error);
        alert('保存订单失败，请重试：' + (error.message || '未知错误'));
      } finally {
        this.savingOrder = false;
        this.$store.commit('SET_LOADING', false);
      }
    },

    // 编辑订单项（参考微信小程序 editOrder）
    editOrder(event, type, index) {
      const value = event.target.value;
      
      if (value.length > 0) {
        // Vue 3 中直接赋值即可，不需要 $set
        if (type === 'name') {
          this.orderItems[index].nxDoGoodsName = value;
        } else if (type === 'quantity') {
          this.orderItems[index].nxDoQuantity = value;
        } else if (type === 'standard') {
          this.orderItems[index].nxDoStandard = value;
        } else if (type === 'remark') {
          this.orderItems[index].nxDoRemark = value;
          this.orderItems[index].nxDoAddRemark = value.length > 0;
        }
        
        // 保存到缓存
        this._saveToStorage();
      }
    },

    // 编辑商品名称（触发搜索，参考微信小程序 editOrderName）
    editOrderName(event, index) {
      const value = event.target.value;
      
      this.orderArrIndex = index;
      this.goodsName = value;
      
      if (value.length > 0) {
        // Vue 3 中直接赋值即可，不需要 $set
        this.orderItems[index].nxDoGoodsName = value;
        this.orderItems[index].nxDoGoodsNameOriginal = value;
        
        // 调用搜索
        this.getSearchString(value);
      } else {
        this.strArr = [];
        this.nxArr = [];
        this.orderArrIndex = -1;
      }
    },

    // 根据商品名称搜索商品（参考微信小程序 getSearchString）
    async getSearchString(searchValue) {
      if (!searchValue || searchValue.length === 0) {
        this.strArr = [];
        this.nxArr = [];
        return;
      }

      try {
        this.$store.commit('SET_LOADING', true);
        this.searchStr = searchValue;
        
        const data = {
          disId: this.disUser.nxDiuDistributerId,
          searchStr: searchValue,
          depId: this.selectedAllCustomer,
        };
        
        const res = await api.queryDisGoodsByQuickSearchWithDepId(data);
        
        if (res && res.data && res.data.code === 0) {
          this.strArr = res.data.data.disArr || [];
          this.nxArr = res.data.data.nxArr || [];
          
          // 保存到缓存
          this._saveToStorage();
        } else {
          this.strArr = [];
          this.nxArr = [];
          alert(res?.data?.msg || '搜索失败');
        }
      } catch (error) {
        console.error('搜索商品失败:', error);
        this.strArr = [];
        this.nxArr = [];
      } finally {
        this.$store.commit('SET_LOADING', false);
      }
    },

    // 关闭搜索结果（参考微信小程序 closeStr）
    closeStr() {
      this.strArr = [];
      this.nxArr = [];
      this.orderArrIndex = -1;
    },

    // 选择商品（参考微信小程序 saveOrder）
    saveOrder(goods, orderIndex) {
      this.orderArrIndex = orderIndex;
      this.goodsId = goods.nxDistributerGoodsId;
      this.selectedGoodsName = goods.nxDgGoodsName || '';
      
      this._choiceGoods();
    },

    // 保存订单（选择商品后，参考微信小程序 _choiceGoods）
    async _choiceGoods() {
      const index = this.orderArrIndex;
      
      if (index === undefined || index === null || index < 0) {
        console.error('orderArrIndex 无效:', index);
        return;
      }
      
      if (!this.orderItems || index >= this.orderItems.length) {
        console.error('orderItems 不存在或索引越界');
        return;
      }
      
      const order = this.orderItems[index];
      
      if (!order) {
        console.error('订单项不存在');
        return;
      }
      
      if (!this.goodsId) {
        console.error('goodsId 不存在，无法更新订单');
        alert('商品ID不存在');
        return;
      }
      
      const selectedGoodsName = this.selectedGoodsName || this.name || order.nxDoGoodsName || '';
      
      // 准备发送的订单对象
      const orderToSend = {
        ...order,
        nxDoGoodsName: selectedGoodsName,
        nxDoDisGoodsId: this.goodsId,
      };
      
      try {
        this.$store.commit('SET_LOADING', true);
        
        const res = await api.choiceGoodsForApply(orderToSend);
        
        if (res && res.data && res.data.code === 0) {
          // 合并原有订单对象的所有字段 + 后端返回的字段
          const currentOrderBeforeUpdate = this.orderItems[index];
          const updatedOrder = {
            ...currentOrderBeforeUpdate,
            ...res.data.data,
            nxDoGoodsName: selectedGoodsName,
            nxDoGoodsNameOriginal: currentOrderBeforeUpdate?.nxDoGoodsNameOriginal || selectedGoodsName
          };
          
          // Vue 3 中直接赋值即可，不需要 $set
          this.orderItems[index] = updatedOrder;
          this.strArr = [];
          this.nxArr = [];
          
          // 更新缓存
          this._updateStorage(updatedOrder);
          
          // 重置相关状态
          this.orderArrIndex = -1;
          this.findGoods = false;
          this.name = '';
          this.selectedGoodsName = '';
        } else {
          alert(res?.data?.msg || '保存失败');
        }
      } catch (error) {
        console.error('保存订单失败:', error);
        alert('保存订单失败');
      } finally {
        this.$store.commit('SET_LOADING', false);
      }
    },

    // 下载商品（参考微信小程序 downLoadGoodsNx）
    async downLoadGoodsNx(goods, orderIndex) {
      try {
        this.$store.commit('SET_LOADING', true);
        this.selectedGoodsName = goods.nxGoodsName;
        
        const dg = {
          nxDgDistributerId: this.disUser.nxDiuDistributerId,
          nxDgNxGoodsId: goods.nxGoodsId,
          nxDgGoodsName: goods.nxGoodsName,
          nxDgGoodsDetail: goods.nxGoodsDetail,
          nxDgGoodsPlace: goods.nxGoodsPlace,
          nxDgGoodsBrand: goods.nxGoodsBrand,
          nxDgGoodsStandardname: goods.nxGoodsStandardname,
          nxDgGoodsStandardWeight: goods.nxGoodsStandardWeight,
          nxDgGoodsPinyin: goods.nxGoodsPinyin,
          nxDgGoodsPy: goods.nxGoodsPy,
          nxDgPullOff: 0,
          nxDgGoodsStatus: 0,
          nxDgPurchaseAuto: 1,
        };
        
        const res = await api.downDisGoods(dg);
        
        if (res && res.data && res.data.code === 0) {
          this.goodsId = res.data.data.nxDistributerGoodsId;
          this.orderArrIndex = orderIndex;
          this._choiceGoods();
        } else {
          alert(res?.data?.msg || '下载商品失败');
        }
      } catch (error) {
        console.error('下载商品失败:', error);
        alert('下载商品失败');
      } finally {
        this.$store.commit('SET_LOADING', false);
      }
    },

    // 删除订单项（参考微信小程序 delOrder）
    async delOrder() {
      const index = this.orderPasteIndex;
      
      if (index < 0 || index >= this.orderItems.length) {
        console.error('要删除的订单索引无效，index:', index);
        return;
      }
      
      const orderItem = this.orderItems[index];
      
      if (!orderItem) {
        console.error('要删除的订单不存在，index:', index);
        return;
      }
      
      // 关闭操作菜单
      this.showOperationPaste = false;
      
      // 如果订单有 nxDepartmentOrdersId，说明已经保存到服务器，需要调用接口删除
      if (orderItem.nxDepartmentOrdersId) {
        if (!confirm('确定要删除此订单吗？')) {
          return;
        }
        
        try {
          this.$store.commit('SET_LOADING', true);
          
          const res = await api.deleteOrder(orderItem.nxDepartmentOrdersId);
          
          if (res && res.data && res.data.code === 0) {
            this.orderItems = this.orderItems.filter((_, idx) => idx !== index);
            this.orderArrIndex = -1;
            this.strArr = [];
            this.nxArr = [];
            this.orderItem = null;
            
            // 更新缓存（保持原有订单来源类型）
            const existingSourceType = this.ocrOrderDepList && this.ocrOrderDepList[this.ocrOrderDepIndex] 
              ? this.ocrOrderDepList[this.ocrOrderDepIndex].orderSourceType 
              : 'paste';
            this._saveToStorage(this.orderItems, existingSourceType);
            
            alert('删除成功');
          } else {
            alert(res?.data?.msg || '删除失败');
          }
        } catch (error) {
          console.error('删除订单失败:', error);
          alert('删除失败，请检查网络');
        } finally {
          this.$store.commit('SET_LOADING', false);
        }
        return;
      }
      
      // 如果订单没有 nxDepartmentOrdersId，说明只是草稿，直接从数组中删除
      if (confirm('确定要删除此订单吗？')) {
        this.orderItems.splice(index, 1);
        this.orderArrIndex = -1;
        this.strArr = [];
        this.nxArr = [];
        this.orderItem = null;
        
        // 更新缓存（保持原有订单来源类型）
        const existingSourceType = this.ocrOrderDepList && this.ocrOrderDepList[this.ocrOrderDepIndex] 
          ? this.ocrOrderDepList[this.ocrOrderDepIndex].orderSourceType 
          : 'paste';
        this._saveToStorage(this.orderItems, existingSourceType);
        
        alert('删除成功');
      }
    },

    // 显示操作菜单（参考微信小程序 showPasteOperation）
    showPasteOperation(index) {
      this.orderPasteIndex = index;
      this.showOperationPaste = true;
      this.orderItem = this.orderItems[index];
    },

    // 隐藏遮罩（参考微信小程序 hideMask）
    hideMask() {
      this.showOperationPaste = false;
    },

    // 添加临时商品（参考微信小程序 addDisAlias）
    addDisAlias() {
      const index = this.orderPasteIndex;
      if (index < 0 || index >= this.orderItems.length) {
        console.error('订单索引无效，index:', index);
        return;
      }
      
      const order = this.orderItems[index];
      if (!order) {
        console.error('订单不存在，index:', index);
        return;
      }
      
      const standard = order.nxDoStandard || '';
      const name = order.nxDoGoodsName || '';
      
      // 先关闭操作菜单
      this.showOperationPaste = false;
      
      // 保存当前订单索引
      this.orderArrIndex = index;
      
      // 跳转到添加临时商品页面（需要实现路由）
      // 这里先提示，后续可以实现路由跳转
      alert('添加临时商品功能需要实现路由跳转');
    },

    // 添加备注（参考微信小程序 addRemark）
    addRemark() {
      const index = this.orderPasteIndex;
      if (index < 0 || index >= this.orderItems.length) {
        console.error('添加备注失败，订单索引无效:', index);
        return;
      }
      
      // Vue 3 中直接赋值即可，不需要 $set
      this.orderItems[index].nxDoAddRemark = true;
      this.showOperationPaste = false;
      
      // 保存到缓存（保持原有订单来源类型）
      const existingSourceType = this.ocrOrderDepList && this.ocrOrderDepList[this.ocrOrderDepIndex] 
        ? this.ocrOrderDepList[this.ocrOrderDepIndex].orderSourceType 
        : 'paste';
      this._saveToStorage(undefined, existingSourceType);
    },

    // 在之前加新订单（参考微信小程序 addNewPasteOrderBefore）
    addNewPasteOrderBefore() {
      // 关闭操作菜单
      this.showOperationPaste = false;
      
      // 获取当前订单索引
      const index = this.orderPasteIndex;
      
      // 保存当前订单索引到 localStorage，供返回时使用
      localStorage.setItem('ocrOrderInsertIndex', index.toString());
      localStorage.setItem('fromOcrOrder', '1');
      
      // 跳转到商品列表页面（需要实现路由）
      // 这里先提示，后续可以实现路由跳转
      alert('在之前加新订单功能需要实现路由跳转');
    },

    // 修改订单（已保存的订单，参考微信小程序 editOrderItem）
    async editOrderItem() {
      const index = this.orderPasteIndex;
      
      if (index < 0 || index >= this.orderItems.length) {
        console.error('要修改的订单索引无效，index:', index);
        return;
      }
      
      const orderItem = this.orderItems[index];
      
      if (!orderItem) {
        console.error('要修改的订单不存在，index:', index);
        return;
      }
      
      // 检查订单是否已保存
      if (!orderItem.nxDepartmentOrdersId) {
        alert('订单未保存，无法修改');
        this.showOperationPaste = false;
        return;
      }
      
      // 关闭操作菜单
      this.showOperationPaste = false;
      
      // 根据 nxDoDisGoodsId 先请求接口获取商品信息
      const goodsId = orderItem.nxDoDisGoodsId;
      
      if (goodsId) {
        try {
          this.$store.commit('SET_LOADING', true);
          
          const res = await api.disGetGoods(goodsId);
          
          if (res && res.data && res.data.code === 0 && res.data.data) {
            // 获取到商品信息后，设置到 itemDis
            this.show = true;
            this.editApply = true;
            this.applyItem = orderItem;
            this.applyStandardName = orderItem.nxDoStandard || '';
            this.printStandard = orderItem.nxDoPrintStandard || orderItem.nxDoStandard || '';
            this.itemDis = res.data.data;
            this.item = orderItem.nxDepartmentDisGoodsEntity || null;
            this.applyNumber = orderItem.nxDoQuantity || '';
            this.applyRemark = orderItem.nxDoRemark || '';
            this.priceLevel = orderItem.nxDoCostPriceLevel || '';
            this.applyGoodsName = orderItem.nxDoGoodsName || '';
            this.applyGoodsId = goodsId || '';
          } else {
            alert(res?.data?.msg || '获取商品信息失败');
            // 失败时使用原有的商品信息
            this.show = true;
            this.editApply = true;
            this.applyItem = orderItem;
            this.applyStandardName = orderItem.nxDoStandard || '';
            this.printStandard = orderItem.nxDoPrintStandard || orderItem.nxDoStandard || '';
            this.itemDis = orderItem.nxDistributerGoodsEntity || null;
            this.item = orderItem.nxDepartmentDisGoodsEntity || null;
            this.applyNumber = orderItem.nxDoQuantity || '';
            this.applyRemark = orderItem.nxDoRemark || '';
            this.priceLevel = orderItem.nxDoCostPriceLevel || '';
            this.applyGoodsName = orderItem.nxDoGoodsName || '';
            this.applyGoodsId = goodsId || '';
          }
        } catch (error) {
          console.error('获取商品信息失败:', error);
          alert('获取商品信息失败');
          // 失败时使用原有的商品信息
          this.show = true;
          this.editApply = true;
          this.applyItem = orderItem;
          this.applyStandardName = orderItem.nxDoStandard || '';
          this.printStandard = orderItem.nxDoPrintStandard || orderItem.nxDoStandard || '';
          this.itemDis = orderItem.nxDistributerGoodsEntity || null;
          this.item = orderItem.nxDepartmentDisGoodsEntity || null;
          this.applyNumber = orderItem.nxDoQuantity || '';
          this.applyRemark = orderItem.nxDoRemark || '';
          this.priceLevel = orderItem.nxDoCostPriceLevel || '';
          this.applyGoodsName = orderItem.nxDoGoodsName || '';
          this.applyGoodsId = goodsId || '';
        } finally {
          this.$store.commit('SET_LOADING', false);
        }
      } else {
        // 没有商品ID，直接使用原有的商品信息
        this.show = true;
        this.editApply = true;
        this.applyItem = orderItem;
        this.applyStandardName = orderItem.nxDoStandard || '';
        this.printStandard = orderItem.nxDoPrintStandard || orderItem.nxDoStandard || '';
        this.itemDis = orderItem.nxDistributerGoodsEntity || null;
        this.item = orderItem.nxDepartmentDisGoodsEntity || null;
        this.applyNumber = orderItem.nxDoQuantity || '';
        this.applyRemark = orderItem.nxDoRemark || '';
        this.priceLevel = orderItem.nxDoCostPriceLevel || '';
        this.applyGoodsName = orderItem.nxDoGoodsName || '';
        this.applyGoodsId = orderItem.nxDoDisGoodsId || '';
      }
    },

    // 清除草稿订单（参考微信小程序 clearSave）
    async clearSave() {
      if (!confirm('确定要清除所有草稿订单吗？')) {
        return;
      }
      
      // 从 orderItems 中删除所有状态为 -2 的订单
      const originalOrderArr = [...this.orderItems];
      const filteredOrderArr = [];
      const ordersToDeleteFromServer = [];
      
      for (let k = 0; k < originalOrderArr.length; k++) {
        const currentOrder = originalOrderArr[k];
        
        // 直接判断状态是否为 -2
        if (currentOrder.nxDoStatus === -2) {
          // 如果订单有 nxDepartmentOrdersId，需要调用接口删除
          if (currentOrder.nxDepartmentOrdersId) {
            ordersToDeleteFromServer.push({
              index: k,
              nxDepartmentOrdersId: currentOrder.nxDepartmentOrdersId,
              goodsName: currentOrder.nxDoGoodsName
            });
          }
        } else {
          filteredOrderArr.push(currentOrder);
        }
      }
      
      // 调用接口删除服务器上的订单
      if (ordersToDeleteFromServer.length > 0) {
        try {
          this.$store.commit('SET_LOADING', true);
          
          const deletePromises = ordersToDeleteFromServer.map(order => 
            api.deleteOrder(order.nxDepartmentOrdersId)
          );
          
          const results = await Promise.all(deletePromises);
          
          let allSuccess = true;
          const failedOrders = [];
          
          results.forEach((res, idx) => {
            if (res && res.data && res.data.code === 0) {
              console.log(`订单 ${ordersToDeleteFromServer[idx].nxDepartmentOrdersId} 删除成功`);
            } else {
              allSuccess = false;
              failedOrders.push(ordersToDeleteFromServer[idx]);
            }
          });
          
          if (allSuccess) {
            alert('删除成功');
          } else {
            alert(`删除失败 ${failedOrders.length} 个订单`);
          }
        } catch (error) {
          console.error('删除订单失败:', error);
          alert('删除失败，请检查网络');
        } finally {
          this.$store.commit('SET_LOADING', false);
        }
      }
      
      // 无论接口是否成功，都从 orderItems 中删除
      this.orderItems = filteredOrderArr;
      
      // 检查删除后是否还有草稿订单（status == -2）
      const hasDraftOrders = filteredOrderArr.some(order => order.nxDoStatus === -2);
      
      // 如果删除后没有订单了，或者所有订单都是已保存的（没有草稿），删除该部门的缓存
      if (filteredOrderArr.length === 0 || !hasDraftOrders) {
        console.log('删除草稿后，没有草稿订单了，清理该部门的缓存');
        
        // 如果当前是 Excel 上传模式，清除已选择的 Excel 文件
        if (this.uploadType === 'excel') {
          this.uploadedExcelFile = null;
          this.uploadedExcelPreview = null;
          if (this.$refs.excelFileInput) {
            this.$refs.excelFileInput.value = '';
          }
          console.log('已清除 Excel 文件信息');
        }
        
        // 如果当前是图片上传模式，清除已选择的图片文件
        if (this.uploadType === 'image') {
          this.uploadedImageFile = null;
          this.imagePreview = null;
          if (this.$refs.imageFileInput) {
            this.$refs.imageFileInput.value = '';
          }
          console.log('已清除图片文件信息');
        }
        
        // 从缓存中删除当前部门的数据（需要根据当前来源类型删除对应的缓存）
        try {
          const currentSourceType = this.uploadType || 'paste';
          const storageKey = `ocrOrderDepList_${currentSourceType}`;
          
          const ocrOrderDepListStr = localStorage.getItem(storageKey);
          if (ocrOrderDepListStr) {
            const ocrOrderDepList = JSON.parse(ocrOrderDepListStr);
            if (Array.isArray(ocrOrderDepList)) {
              // 从对应来源类型的缓存中删除当前部门的数据
            const updatedOcrOrderDepList = ocrOrderDepList.filter(item => item.depId !== this.selectedAllCustomer);
            
            if (updatedOcrOrderDepList.length === 0) {
                // 如果整个缓存都空了，删除整个缓存
                localStorage.removeItem(storageKey);
                this.ocrOrderDepList = [];
            } else {
                // 保存更新后的缓存
                localStorage.setItem(storageKey, JSON.stringify(updatedOcrOrderDepList));
              this.ocrOrderDepList = updatedOcrOrderDepList;
              }
            }
          }
          
          // 兼容旧格式：也尝试清理旧格式的缓存
          const oldOcrOrderDepListStr = localStorage.getItem('ocrOrderDepList');
          if (oldOcrOrderDepListStr) {
            const oldOcrOrderDepList = JSON.parse(oldOcrOrderDepListStr);
            if (Array.isArray(oldOcrOrderDepList)) {
              const updatedOldList = oldOcrOrderDepList.filter(item => 
                !(item.depId === this.selectedAllCustomer && (item.orderSourceType || 'paste') === currentSourceType)
              );
              
              if (updatedOldList.length === 0) {
                localStorage.removeItem('ocrOrderDepList');
              } else {
                localStorage.setItem('ocrOrderDepList', JSON.stringify(updatedOldList));
              }
            }
          }
        } catch (error) {
          console.error('清理缓存失败:', error);
        }
        
        // 重置相关状态
        this.orderItems = []; // 清空订单数据
        this.hasCache = false;
        this.ocrOrderDepIndex = -1;
        this.strArr = [];
        this.nxArr = [];
        this.orderArrIndex = -1;
        this.searchStr = '';
        this.imagePreview = ''; // 清空图片预览
        
        // 清除上传的文件信息（根据当前上传模式）
        if (this.uploadType === 'excel') {
          this.uploadedExcelFile = null;
          this.uploadedExcelPreview = null;
          if (this.$refs.excelFileInput) {
            this.$refs.excelFileInput.value = '';
          }
        } else if (this.uploadType === 'image') {
          this.uploadedImageFile = null;
          if (this.$refs.imageFileInput) {
            this.$refs.imageFileInput.value = '';
          }
        }
      } else {
        // 如果还有草稿订单，更新缓存（保持原有订单来源类型）
        const existingSourceType = this.ocrOrderDepList && this.ocrOrderDepList[this.ocrOrderDepIndex] 
          ? this.ocrOrderDepList[this.ocrOrderDepIndex].orderSourceType 
          : 'paste';
        this._saveToStorage(filteredOrderArr, existingSourceType);
      }
    },

    // 保存到缓存（参考微信小程序 _saveToStorage）
    // orderSourceType: 'excel' | 'image' | 'paste' | 'auto' - 订单来源类型
    _saveToStorage(orders, orderSourceType) {
      const orderArr = orders || this.orderItems;
      
      // 如果没有订单数据，跳过
      if (!orderArr || orderArr.length === 0) {
        return;
      }
      
      // 如果没有指定订单来源类型，使用当前的 uploadType
      const sourceType = orderSourceType || this.uploadType || 'paste';
      
      // 根据来源类型使用不同的 localStorage key
      const storageKey = `ocrOrderDepList_${sourceType}`;
      
      // 从 localStorage 读取对应来源类型的缓存
      let ocrOrderDepList = [];
      try {
        const ocrOrderDepListStr = localStorage.getItem(storageKey);
        if (ocrOrderDepListStr) {
          ocrOrderDepList = JSON.parse(ocrOrderDepListStr);
          if (!Array.isArray(ocrOrderDepList)) {
            ocrOrderDepList = [];
          }
        }
      } catch (error) {
        console.error('读取缓存失败:', error);
        ocrOrderDepList = [];
      }
      
        // 查找是否已经存在当前部门的缓存
        let existingIndex = -1;
      for (let i = 0; i < ocrOrderDepList.length; i++) {
        if (ocrOrderDepList[i].depId === this.selectedAllCustomer) {
            existingIndex = i;
            break;
          }
        }
        
        if (existingIndex >= 0) {
        // 更新现有缓存
        ocrOrderDepList[existingIndex].depId = this.selectedAllCustomer;
        ocrOrderDepList[existingIndex].depFatherId = this.selectedAllCustomer;
        ocrOrderDepList[existingIndex].depName = this.selectedCustomerName;
        ocrOrderDepList[existingIndex].arr = orderArr;
        ocrOrderDepList[existingIndex].strArr = this.strArr || [];
        ocrOrderDepList[existingIndex].nxArr = this.nxArr || [];
        ocrOrderDepList[existingIndex].orderArrIndex = this.orderArrIndex !== undefined ? this.orderArrIndex : -1;
        ocrOrderDepList[existingIndex].searchStr = this.searchStr || "";
        ocrOrderDepList[existingIndex].orderSourceType = sourceType;
        // 更新上传的文件信息（包括预览数据）
        if (sourceType === 'excel' && this.uploadedExcelFile) {
          console.log('保存Excel文件信息到缓存，预览数据:', this.uploadedExcelPreview);
          ocrOrderDepList[existingIndex].uploadedFile = {
            ...this.uploadedExcelFile,
            preview: this.uploadedExcelPreview
          };
          console.log('已保存的uploadedFile:', ocrOrderDepList[existingIndex].uploadedFile);
        } else if (sourceType === 'image' && this.uploadedImageFile) {
          ocrOrderDepList[existingIndex].uploadedFile = this.uploadedImageFile;
        } else {
          // 保留原有的文件信息
          ocrOrderDepList[existingIndex].uploadedFile = ocrOrderDepList[existingIndex].uploadedFile;
        }
          this.ocrOrderDepIndex = existingIndex;
        } else {
        // 创建新的缓存项
          const newDepData = {
            depId: this.selectedAllCustomer,
            depFatherId: this.selectedAllCustomer,
            depName: this.selectedCustomerName,
          arr: orderArr,
            saveCount: null,
          strArr: this.strArr || [],
          nxArr: this.nxArr || [],
          orderArrIndex: this.orderArrIndex !== undefined ? this.orderArrIndex : -1,
          searchStr: this.searchStr || "",
          orderSourceType: sourceType,
          // 保存上传的文件信息（包括预览数据）
          uploadedFile: sourceType === 'excel' && this.uploadedExcelFile ? (() => {
            console.log('创建新缓存项，保存Excel文件信息，预览数据:', this.uploadedExcelPreview);
            const uploadedFile = {
              ...this.uploadedExcelFile,
              preview: this.uploadedExcelPreview
            };
            console.log('已创建的uploadedFile:', uploadedFile);
            return uploadedFile;
          })() : sourceType === 'image' ? this.uploadedImageFile : null
        };
        ocrOrderDepList.push(newDepData);
        this.ocrOrderDepIndex = ocrOrderDepList.length - 1;
      }
      
      // 更新内存中的数据（用于当前来源类型）
      this.ocrOrderDepList = ocrOrderDepList;
      
      try {
        // 立即同步到 localStorage（使用对应来源类型的 key）
        localStorage.setItem(storageKey, JSON.stringify(ocrOrderDepList));
        
        // 更新 hasCache 状态
        if (orderArr.length > 0) {
          this.hasCache = true;
        }
      } catch (error) {
        console.error('缓存同步失败:', error);
      }
    },

    // 更新单个订单到缓存（参考微信小程序 _updateStorage）
    _updateStorage(order) {
      // 检查 orderArrIndex 是否有效
      if (this.orderArrIndex === undefined || this.orderArrIndex === null || this.orderArrIndex < 0) {
        console.error('orderArrIndex 无效，无法更新存储:', this.orderArrIndex);
        return;
      }
      
      // 更新内存中的 orderItems
      const currentOrder = this.orderItems[this.orderArrIndex];
      const mergedOrder = {
        ...currentOrder,
        ...order,
      };
      
      // Vue 3 中直接赋值即可，不需要 $set
      this.orderItems[this.orderArrIndex] = mergedOrder;
      
      // 更新缓存
      this._saveToStorage();
    },

    // 确认修改订单（参考微信小程序 confirm 和 _updateDisOrder）
    async confirm() {
      if (this.editApply) {
        await this._updateDisOrder();
      }
      
      this.show = false;
      this.editApply = false;
      this.applyItem = null;
      this.item = null;
      this.applyNumber = '';
      this.applyStandardName = '';
      this.printStandard = '';
      this.showAddStandard = false;
    },

    // 取消编辑（参考微信小程序 cancle）
    cancle() {
      this.show = false;
      this.editApply = false;
      this.applyItem = null;
      this.item = null;
      this.applyNumber = '';
      this.applyStandardName = '';
      this.printStandard = '';
      this.showAddStandard = false;
    },

    // 删除申请（在编辑弹窗中，参考微信小程序 delApply）
    delApply() {
      const index = this.orderPasteIndex;
      const orderItem = this.orderItems[index];
      
      this.warnContent = (orderItem.nxDoGoodsName || '') + "  " + (orderItem.nxDoQuantity || '') + (orderItem.nxDoStandard || '');
      this.show = false;
      this.popupType = 'deleteOrder';
      this.showPopupWarn = true;
    },

    // 确认规格（参考微信小程序 confirmStandard）
    async confirmStandard() {
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
          nxDsStandardName: this.newStandardName,
        };
        
        const res = await api.disSaveStandard(data);
        
        if (res && res.data && res.data.code === 0) {
          // 更新 itemDis 的规格列表
          if (!this.itemDis.nxDistributerStandardEntities) {
            this.itemDis.nxDistributerStandardEntities = [];
          }
          this.itemDis.nxDistributerStandardEntities.push(res.data.data);
          this.applyStandardName = res.data.data.nxDsStandardName;
          this.showAddStandard = false;
          this.newStandardName = '';
          
          alert('添加规格成功');
        } else {
          alert(res?.data?.msg || '添加规格失败');
        }
      } catch (error) {
        console.error('添加规格失败:', error);
        alert('添加规格失败');
      } finally {
        this.$store.commit('SET_LOADING', false);
      }
    },

    // 规格选择改变事件
    onStandardChange(event) {
      const standardName = event.target.value;
      // 查找对应的规格信息以获取价格等级
      let level = '';
      if (this.itemDis && this.itemDis.nxDistributerStandardEntities) {
        const standard = this.itemDis.nxDistributerStandardEntities.find(s => s.nxDsStandardName === standardName);
        if (standard) {
          level = standard.nxDsPriceLevel || '';
        }
      }
      this.changeStandard(standardName, level);
    },

    // 改变规格（参考微信小程序 changeStandard）
    changeStandard(standardName, level) {
      this.applyStandardName = standardName;
      this.priceLevel = level;
      
      if (this.itemDis) {
        const levelTwoStandard = this.itemDis.nxDgWillPriceTwoStandard;
        if (this.applyStandardName == levelTwoStandard) {
          this.printStandard = levelTwoStandard;
        } else {
          this.printStandard = this.itemDis.nxDgGoodsStandardname || '';
        }
      }
    },

    // 确认警告（参考微信小程序 confirmWarn）
    confirmWarn() {
      if (this.popupType == 'deleteSpec') {
        this.deleteStandardApi();
      } else if (this.popupType == 'deleteOrder') {
        this.delOrder();
        this.showPopupWarn = false;
        this.popupType = '';
      }
    },

    // 关闭警告弹窗（参考微信小程序 closeWarn）
    closeWarn() {
      this.showPopupWarn = false;
      this.popupType = '';
      this.warnContent = '';
    },

    // 删除规格 API（参考微信小程序 deleteStandardApi）
    async deleteStandardApi() {
      if (!this.disStandardId) {
        alert('规格ID错误');
        this.popupType = "";
        this.showPopupWarn = false;
        this.disStandardId = "";
        return;
      }
      
      try {
        this.$store.commit('SET_LOADING', true);
        
        const res = await api.disDeleteStandard(this.disStandardId);
        
        if (res && res.data && res.data.code === 0) {
          // 更新 itemDis 为接口返回的最新数据
          this.popupType = "";
          this.showPopupWarn = false;
          this.disStandardId = "";
          this.itemDis = res.data.data;
          this.item = res.data.data;
          
          alert('删除成功');
        } else {
          alert(res?.data?.msg || '删除失败');
          this.popupType = "";
          this.showPopupWarn = false;
          this.disStandardId = "";
        }
      } catch (error) {
        console.error('删除规格失败:', error);
        alert('删除失败，请检查网络');
        this.popupType = "";
        this.showPopupWarn = false;
        this.disStandardId = "";
      } finally {
        this.$store.commit('SET_LOADING', false);
      }
    },

    // 修改配送申请（参考微信小程序 _updateDisOrder）
    async _updateDisOrder() {
      const index = this.orderPasteIndex;
      const orderItem = this.orderItems[index];
      
      if (!orderItem || !orderItem.nxDepartmentOrdersId) {
        alert('订单信息错误');
        return;
      }
      
      try {
        this.$store.commit('SET_LOADING', true);
        
        const dg = {
          id: orderItem.nxDepartmentOrdersId,
          weight: this.applyNumber,
          standard: this.applyStandardName,
          remark: this.applyRemark,
          printStandard: this.printStandard,
          priceLevel: this.priceLevel
        };
        
        const res = await api.updateOrder(dg);
        
        if (res && res.data && res.data.code === 0) {
          // 更新本地订单数组
          const updatedOrder = {
            ...orderItem,
            ...res.data.data,
            // 保留原有的商品名称相关字段
            nxDoGoodsName: orderItem.nxDoGoodsName,
            nxDoGoodsNameOriginal: orderItem.nxDoGoodsNameOriginal || orderItem.nxDoGoodsName,
          };
          
          // Vue 3 中直接赋值即可，不需要 $set
          this.orderItems[index] = updatedOrder;
          
          // 更新缓存（保持原有订单来源类型）
          const existingSourceType = this.ocrOrderDepList && this.ocrOrderDepList[this.ocrOrderDepIndex] 
            ? this.ocrOrderDepList[this.ocrOrderDepIndex].orderSourceType 
            : 'paste';
          this._saveToStorage(this.orderItems, existingSourceType);
          
          alert('修改成功');
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

    // 初始化全部客户列表
    async initAllCustomers() {
      try {
        // 检查disUser是否存在
        if (!this.disUser || !this.disUser.nxDiuDistributerId) {
          console.error('disUser或nxDiuDistributerId不存在:', this.disUser);
          return;
        }

        console.log('开始获取全部客户，disId:', this.disUser.nxDiuDistributerId);
        const res = await api.disGetAllCustomer(this.disUser.nxDiuDistributerId);
        
        if (res && res.data && res.data.code === 0) {
          this.myCustomerArrOne = res.data.data.settleTypeOne || [];
          this.myCustomerArrTwo = res.data.data.settleTypeTwo || [];
          console.log('获取全部客户成功:', res.data.data);
          
          // 自动选择第一个可用的客户
          this.autoSelectFirstCustomer();
        } else {
          console.error('获取全部客户失败:', res);
        }
      } catch (error) {
        console.error('获取全部客户API请求失败:', error);
      }
    },

    // 选择全部客户列表中的客户
    async selectAllCustomer(customerId, customer) {
      console.log('========== 选择客户 ==========');
      console.log('客户ID:', customerId);
      console.log('客户名称:', customer.nxDepartmentAttrName);
      console.log('客户完整信息:', customer);
      
      // 检查是否有子部门
      const hasSubDepartments = customer && 
                                customer.nxDepartmentEntities && 
                                Array.isArray(customer.nxDepartmentEntities) &&
                                customer.nxDepartmentEntities.length > 0;
      
      console.log('是否有子部门:', hasSubDepartments);
      
      if (hasSubDepartments) {
        console.log('子部门数量:', customer.nxDepartmentEntities.length);
        console.log('子部门列表:', customer.nxDepartmentEntities);
        customer.nxDepartmentEntities.forEach((subDept, index) => {
          console.log(`  子部门 ${index + 1}:`, {
            id: subDept.nxDepartmentId,
            name: subDept.nxDepartmentName,
            attrName: subDept.nxDepartmentAttrName,
            fatherId: subDept.nxDepartmentFatherId
          });
        });
      } else {
        console.log('该客户没有子部门');
      }
      console.log('============================');
      
      this.selectedAllCustomer = customerId;
      this.selectedCustomerName = customer.nxDepartmentAttrName;
      this.selectedCustomerDepPrintName = customer.nxDepartmentPrintName || 'ApplyPanel'; // 设置打印组件名称
      this.selectedCustomerEntity = customer; // 保存完整的客户信息，包括子部门
      
      // 如果有子部门，默认选择第一个
      if (hasSubDepartments && customer.nxDepartmentEntities.length > 0) {
        this.selectedSubDepartment = customer.nxDepartmentEntities[0].nxDepartmentId;
        console.log('默认选择第一个子部门:', this.selectedSubDepartment);
      } else {
        this.selectedSubDepartment = null;
      }
      
      // 加载客户文件夹路径
      this.loadCustomerFolderPath();
      
      // 如果当前在历史订单标签，获取该客户的历史订单
      if (this.allCustomerTabIndex === 1) {
      this.fetchCustomerHistoryOrders(customer);
      } else if (this.allCustomerTabIndex === 0) {
        // 如果在今日订单标签
        if (this.todayOrderTabIndex === 0) {
          // 如果在已保存订单子标签，加载今日订单
          this.fetchTodayOrders();
      } else {
          // 如果在下单子标签，加载缓存数据
        this._loadCache();
        }
      }
    },

    // 加载缓存数据（参考微信小程序 _loadCache）
    _loadCache() {
      console.log('========== _loadCache 加载缓存数据 ==========');
      console.log('当前 depId:', this.selectedAllCustomer);
      console.log('当前 uploadType:', this.uploadType);
      
      try {
        // 确定当前模式对应的 orderSourceType
        const currentSourceType = this.uploadType || 'paste';
        
        // 根据来源类型使用不同的 localStorage key
        const storageKey = `ocrOrderDepList_${currentSourceType}`;
        
        // 先尝试从新的存储方式读取（按来源类型分离）
        let ocrOrderDepList = null;
        try {
          const ocrOrderDepListStr = localStorage.getItem(storageKey);
          if (ocrOrderDepListStr) {
            ocrOrderDepList = JSON.parse(ocrOrderDepListStr);
          }
        } catch (error) {
          console.error('读取新格式缓存失败:', error);
        }
        
        // 如果新格式没有数据，尝试兼容旧格式（ocrOrderDepList）
        if (!ocrOrderDepList || !Array.isArray(ocrOrderDepList) || ocrOrderDepList.length === 0) {
          console.log('新格式缓存不存在，尝试读取旧格式缓存（兼容性处理）');
          const oldOcrOrderDepListStr = localStorage.getItem('ocrOrderDepList');
          if (oldOcrOrderDepListStr) {
            const oldOcrOrderDepList = JSON.parse(oldOcrOrderDepListStr);
            if (Array.isArray(oldOcrOrderDepList)) {
              // 从旧格式中过滤出匹配当前来源类型的缓存
              ocrOrderDepList = oldOcrOrderDepList.filter(item => {
                const cacheSourceType = item.orderSourceType || 'paste';
                return cacheSourceType === currentSourceType;
              });
            }
          }
        }
        
        console.log('从缓存读取的 ocrOrderDepList:', ocrOrderDepList);
        
        if (ocrOrderDepList && Array.isArray(ocrOrderDepList) && ocrOrderDepList.length > 0) {
          this.ocrOrderDepList = ocrOrderDepList;
          
          for (let i = 0; i < ocrOrderDepList.length; i++) {
            const pDepId = ocrOrderDepList[i].depId;
            
            // 匹配 depId（因为已经按来源类型过滤了，所以不需要再检查 orderSourceType）
            // 使用宽松相等比较，处理字符串和数字类型不匹配的情况
            const pDepIdStr = String(pDepId);
            const selectedDepIdStr = String(this.selectedAllCustomer);
            console.log(`比较 depId: 缓存中的 "${pDepIdStr}" (类型: ${typeof pDepId}) vs 当前的 "${selectedDepIdStr}" (类型: ${typeof this.selectedAllCustomer})`);
            
            if (pDepIdStr === selectedDepIdStr || pDepId == this.selectedAllCustomer) {
              console.log('找到匹配的缓存，加载订单数据，订单数量:', ocrOrderDepList[i].arr ? ocrOrderDepList[i].arr.length : 0);
              console.log('缓存来源类型:', currentSourceType);
              
              // 从缓存恢复订单数据
              let orders = ocrOrderDepList[i].arr || [];
              // 确保每个订单都有原始商品名称字段（兼容旧数据）
              orders = orders.map((order) => {
                if (order && !order.nxDoGoodsNameOriginal) {
                  return {
                    ...order,
                    nxDoGoodsNameOriginal: order.nxDoGoodsName || ''
                  };
                }
                return order;
              });
              
              // 恢复搜索相关数据
              const searchData = ocrOrderDepList[i];
              const hasCacheData = orders && orders.length > 0;
              
              this.ocrOrderDepIndex = i;
              this.orderItems = orders;
              this.strArr = searchData.strArr || [];
              this.nxArr = searchData.nxArr || [];
              this.orderArrIndex = searchData.orderArrIndex !== undefined ? searchData.orderArrIndex : -1;
              this.searchStr = searchData.searchStr || "";
              this.hasCache = hasCacheData;
              
              // 恢复上传的文件信息
              if (searchData.uploadedFile) {
                console.log('恢复上传的文件信息:', searchData.uploadedFile);
                if (currentSourceType === 'excel') {
                  this.uploadedExcelFile = {
                    name: searchData.uploadedFile.name,
                    size: searchData.uploadedFile.size,
                    type: searchData.uploadedFile.type,
                    lastModified: searchData.uploadedFile.lastModified
                  };
                  console.log('恢复Excel文件信息:', this.uploadedExcelFile);
                  // 恢复Excel预览数据
                  if (searchData.uploadedFile.preview) {
                    console.log('恢复Excel预览数据:', searchData.uploadedFile.preview);
                    // 使用 Vue 3 的响应式方式，确保数据是响应式的
                    this.uploadedExcelPreview = JSON.parse(JSON.stringify(searchData.uploadedFile.preview));
                    console.log('Excel预览数据已恢复，工作表数量:', this.uploadedExcelPreview?.sheets?.length || 0);
                    console.log('uploadedExcelPreview 对象:', this.uploadedExcelPreview);
                  } else {
                    console.log('缓存中没有Excel预览数据');
                  }
                  // 确保数据是响应式的（Vue 3 需要）
                  console.log('恢复后立即检查，uploadedExcelFile:', this.uploadedExcelFile);
                  console.log('恢复后立即检查，uploadedExcelPreview:', this.uploadedExcelPreview);
                  // 强制更新视图，确保显示
                  this.$nextTick(() => {
                    console.log('$nextTick 中，uploadedExcelFile:', this.uploadedExcelFile);
                    console.log('$nextTick 中，uploadedExcelPreview:', this.uploadedExcelPreview);
                    if (this.uploadedExcelFile) {
                      console.log('uploadedExcelFile 存在，强制更新视图');
                      this.$forceUpdate();
                    } else {
                      console.warn('警告：uploadedExcelFile 在 $nextTick 中为 null！');
                    }
                  });
                } else if (currentSourceType === 'image') {
                  this.uploadedImageFile = searchData.uploadedFile;
                  // 如果有图片预览数据，恢复预览
                  if (searchData.uploadedFile.dataUrl) {
                    this.imagePreview = searchData.uploadedFile.dataUrl;
                  }
                  // 强制更新视图，确保显示
                  this.$nextTick(() => {
                    this.$forceUpdate();
                  });
                }
              } else {
                console.log('缓存中没有上传的文件信息');
              }
              
              // 如果有缓存且是转订单模式，自动扫描"已处理"文件夹
              if (hasCacheData && this.uploadType === 'auto' && this.customerFolderPath) {
                this.$nextTick(() => {
                  this.scanFolderFiles();
                });
              }
              
              return; // 找到匹配的缓存，退出循环
            }
          }
          
          // 如果没有找到匹配的缓存（depId 不匹配）
          console.log('未找到匹配的缓存（depId 不匹配）');
            this.hasCache = false;
            this.orderItems = [];
            this.imagePreview = null;
            // 清空上传的文件信息（因为当前客户没有缓存）
            this.uploadedExcelFile = null;
            this.uploadedExcelPreview = null;
            this.uploadedImageFile = null;
          this.ocrOrderDepIndex = -1;
            this.recognizingImage = false;
        } else {
          console.log('缓存中没有数据，初始化空数组');
          this.ocrOrderDepList = [];
          this.ocrOrderDepIndex = -1;
          this.hasCache = false;
          this.orderItems = [];
          this.imagePreview = null;
          // 清空上传的文件信息
          this.uploadedExcelFile = null;
          this.uploadedExcelPreview = null;
          this.uploadedImageFile = null;
          // 不重置 uploadType，保持用户的选择
          this.recognizingImage = false;
        }
      } catch (error) {
        console.error('加载缓存失败:', error);
        this.hasCache = false;
        this.orderItems = [];
        this.imagePreview = null;
        // 清空上传的文件信息
        this.uploadedExcelFile = null;
        this.uploadedExcelPreview = null;
        this.uploadedImageFile = null;
        // 不重置 uploadType，保持用户的选择
        this.recognizingImage = false;
      }
      
      console.log('========== _loadCache 加载缓存数据结束 ==========');
    },

    // 自动选择第一个可用的客户
    autoSelectFirstCustomer() {
      // 优先选择现金客户
      if (this.myCustomerArrOne && this.myCustomerArrOne.length > 0) {
        const firstCashCustomer = this.myCustomerArrOne[0];
        console.log('自动选择第一个现金客户:', firstCashCustomer);
        this.selectAllCustomer(firstCashCustomer.nxDepartmentId, firstCashCustomer);
        return;
      }
      
      // 如果没有现金客户，选择第一个记账客户
      if (this.myCustomerArrTwo && this.myCustomerArrTwo.length > 0) {
        const firstCreditCustomer = this.myCustomerArrTwo[0];
        console.log('自动选择第一个记账客户:', firstCreditCustomer);
        this.selectAllCustomer(firstCreditCustomer.nxDepartmentId, firstCreditCustomer);
        return;
      }
      
      // 如果都没有客户，显示提示
      console.log('没有可用的客户数据');
    },

    // 获取客户历史订单
    async fetchCustomerHistoryOrders(customer) {
      try {
        // 检查disUser是否存在
        if (!this.disUser || !this.disUser.nxDiuDistributerId) {
          console.error('disUser或nxDiuDistributerId不存在:', this.disUser);
          return;
        }

        const requestData = {
          disId: this.disUser.nxDiuDistributerId,
          depFatherId: customer.nxDepartmentId
        };
        
        // 添加调试日志
        console.log('请求参数:', requestData);
        console.log('customer对象:', customer);
        console.log('this.disUser:', this.disUser);

        const res = await api.sellerAndBuyerGetAccountBills(requestData);
        
        // 添加调试日志
        console.log('API响应完整数据:', res);
        console.log('res.data:', res.data);
        console.log('res.data.code:', res.data?.code);
        console.log('res.data.data:', res.data?.data);
        console.log('res.data.data.arr:', res.data?.data?.arr);
        
        if (res && res.data && res.data.code === 0) {
          // 数据结构：直接在 data.arr 中
          this.accountBillData = res.data.data.arr || [];
          console.log('成功获取历史订单数据:', this.accountBillData);
        } else {
          console.error('获取历史订单失败:', res);
          this.accountBillData = [];
        }
      } catch (error) {
        console.error('获取历史订单API请求失败:', error);
        this.accountBillData = [];
      }
    },

    // 打开订单详情弹窗
    openOrderDetail(orderItem) {
      console.log('=== openOrderDetail 开始 ===');
      console.log('选中的订单项:', orderItem);
      console.log('选中的客户打印组件名称:', this.selectedCustomerDepPrintName);
      
      this.selectedBillId = orderItem.nxDepartmentBillId;
      this.selectedBillDepPrintName = this.selectedCustomerDepPrintName || 'ApplyPanel'; // 默认使用ApplyPanel
      this.selectedBillDepName = this.selectedCustomerName;
      this.selectedBillDepFatherId = this.selectedAllCustomer;
      
      console.log('设置弹窗数据:', {
        selectedBillId: this.selectedBillId,
        selectedBillDepPrintName: this.selectedBillDepPrintName,
        selectedBillDepName: this.selectedBillDepName,
        selectedBillDepFatherId: this.selectedBillDepFatherId
      });
      
      // 显示弹窗
      this.showOrderModal = true;
      
      // 加载订单详情数据
      console.log('🔄 开始加载订单详情...');
      this.loadBillDetail();
      console.log('=== openOrderDetail 结束 ===');
    },

    // 关闭订单详情弹窗
    closeOrderModal() {
      this.showOrderModal = false;
      this.selectedBillId = null;
      this.selectedBillDepPrintName = '';
      this.selectedBillDepName = '';
      this.selectedBillDepFatherId = null;
      
      // 清空订单详情数据
      this.billDetailData = null;
      this.billDetailLoading = false;
      this.billDetailError = null;
    },

    // 加载订单详情数据
    async loadBillDetail() {
      console.log('=== loadBillDetail 开始 ===');
      console.log('this.selectedBillId:', this.selectedBillId);
      console.log('this.selectedBillDepFatherId:', this.selectedBillDepFatherId);
      
      if (!this.selectedBillId) {
        console.error('❌ 没有选中的账单ID');
        return;
      }

      if (!this.selectedBillDepFatherId) {
        console.error('❌ 没有选中的部门父ID');
        return;
      }

      this.billDetailLoading = true;
      this.billDetailError = null;
      this.billDetailData = null;

      try {
        // 调用 getBillApplys 接口获取订单详情
        // 接口需要 billId 和 depFatherId 两个参数
        const requestData = {
          billId: this.selectedBillId,
          depFatherId: this.selectedBillDepFatherId
        };
        
        console.log('📤 getBillApplys 请求参数:', requestData);
        console.log('📤 请求URL:', `nxdepartmentbill/getBillApplys?billId=${requestData.billId}&depFatherId=${requestData.depFatherId}`);
        
        const res = await api.getBillApplys(requestData);
        
        console.log('📥 getBillApplys 接口响应:', res);
        console.log('📥 res.data:', res?.data);
        console.log('📥 res.data.code:', res?.data?.code);
        console.log('📥 res.data.data:', res?.data?.data);
        
        if (res && res.data && res.data.data) {
          // 根据实际接口返回的数据结构处理
          const responseData = res.data.data;
          this.billDetailData = {
            ...responseData.bill,  // 账单基本信息
            nxDepartmentOrdersEntities: responseData.bill?.nxDepartmentOrdersEntities || responseData.arr || []  // 优先使用 bill.nxDepartmentOrdersEntities
          };
          
          console.log('✅ 成功获取订单详情:', this.billDetailData);
          console.log('✅ 原始响应数据:', responseData);
          console.log('✅ 账单信息:', responseData.bill);
          console.log('✅ 订单商品数组 (bill.nxDepartmentOrdersEntities):', responseData.bill?.nxDepartmentOrdersEntities);
          console.log('✅ 订单商品数组 (arr):', responseData.arr);
          console.log('✅ 最终使用的商品数组:', this.billDetailData?.nxDepartmentOrdersEntities);
          console.log('✅ 订单商品数量:', this.billDetailData?.nxDepartmentOrdersEntities?.length || 0);
          
          // 检查关键字段
          if (this.billDetailData?.nxDepartmentOrdersEntities && this.billDetailData.nxDepartmentOrdersEntities.length > 0) {
            console.log('✅ 第一个商品信息:', this.billDetailData.nxDepartmentOrdersEntities[0]);
            console.log('✅ 商品实体:', this.billDetailData.nxDepartmentOrdersEntities[0]?.nxDistributerGoodsEntity);
          } else {
            console.log('⚠️ 订单商品数组为空或不存在');
            console.log('⚠️ 检查 bill.nxDepartmentOrdersEntities:', responseData.bill?.nxDepartmentOrdersEntities);
            console.log('⚠️ 检查 arr:', responseData.arr);
          }
        } else {
          this.billDetailError = '获取订单详情失败：数据结构不正确';
          console.error('❌ 获取订单详情失败:', res);
          console.error('❌ 响应数据结构:', res?.data);
        }
      } catch (error) {
        this.billDetailError = '网络请求失败，请稍后重试';
        console.error('❌ 获取订单详情API请求失败:', error);
        console.error('❌ 错误详情:', error.message);
        console.error('❌ 错误堆栈:', error.stack);
      } finally {
        this.billDetailLoading = false;
        console.log('=== loadBillDetail 结束 ===');
      }
    },

    // 打印订单
    printOrder() {
      console.log('=== printOrder 开始 ===');
      console.log('选中的打印组件:', this.selectedBillDepPrintName);
      
      if (this.selectedBillDepPrintName === 'ApplyPanel') {
        this.printWithApplyPanel();
      } else if (this.selectedBillDepPrintName === 'ApplyHalfPanel') {
        this.printWithApplyHalfPanel();
      } else if (this.selectedBillDepPrintName === 'ApplyThirtyWholePanel') {
        this.printWithApplyThirtyWholePanel();
      } else {
        console.warn('不支持的打印组件类型:', this.selectedBillDepPrintName);
        alert('不支持的打印组件类型');
      }
    },

    // 使用 ApplyPanel 打印
    printWithApplyPanel() {
      console.log('使用 ApplyPanel 打印');
      if (this.$refs.applyPanelRef) {
        this.$refs.applyPanelRef.printOnly();
      } else {
        console.error('ApplyPanel 组件未找到');
        alert('ApplyPanel 组件未找到');
      }
    },

    // 使用 ApplyHalfPanel 打印
    printWithApplyHalfPanel() {
      console.log('使用 ApplyHalfPanel 打印');
      if (this.$refs.applyHalfPanelRef) {
        this.$refs.applyHalfPanelRef.printOnly();
      } else {
        console.error('ApplyHalfPanel 组件未找到');
        alert('ApplyHalfPanel 组件未找到');
      }
    },

    // 使用 ApplyThirtyWholePanel 打印
    printWithApplyThirtyWholePanel() {
      console.log('使用 ApplyThirtyWholePanel 打印');
      if (this.$refs.applyThirtyWholePanelRef) {
        this.$refs.applyThirtyWholePanelRef.printOnly();
      } else {
        console.error('ApplyThirtyWholePanel 组件未找到');
        alert('ApplyThirtyWholePanel 组件未找到');
      }
    },

    // 获取打印组件名称
    getPrintComponentName(depPrintName) {
      switch (depPrintName) {
        case 'ApplyPanel':
          return 'ApplyPanel 格式';
        case 'ApplyHalfPanel':
          return 'ApplyHalfPanel 格式';
        case 'ApplyFiftyPanel':
          return 'ApplyFiftyPanel 格式';
        case 'ApplyThirtyWholePanel':
          return 'ApplyThirtyWholePanel 格式';
        default:
          return '默认格式';
      }
    },

    //开启自动刷新
    startAutoRefresh() {
      if (this.autoRefreshInterval) {
        clearInterval(this.autoRefreshInterval);
      }

      this.autoRefreshInterval = setInterval(() => {
        console.log('自动刷新数据...');
        this.switchToOrderCustomers();
      }, 30000); // 每30秒刷新一次

      console.log('已开启自动刷新，每30秒刷新一次');
    },

    // 停止自动刷新
    stopAutoRefresh() {
      if (this.autoRefreshInterval) {
        clearInterval(this.autoRefreshInterval);
        this.autoRefreshInterval = null;
        console.log('已停止自动刷新');
      }
    },

    // 格式化日期
    formatDate(dateString) {
      if (!dateString) return '';
      
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    },

    startPolling() {
      this.pollStartTime = Date.now();  // 记录轮询开始的时间
      this.pollForUserInfo();
    },


    pollForUserInfo() {
    this.pollInterval = setInterval(() => {
    // 检查是否超过 1 分钟
    const currentTime = Date.now();
    if (currentTime - this.pollStartTime >= 60000) {
      // 超过 1 分钟，停止轮询并返回上一页
      clearInterval(this.pollInterval);
      // alert('登录超时，返回上一页');
      this.$router.back();
      return;
    }

  }, 5000);  // 每 5 秒轮询一次
},


fetchCustomerList(){

  const disId = this.disUser.nxDiuDistributerId;
    api.webNxDisGetTodayOrderCustomer(disId).then(res => {
      if (res  && res.data) {
        console.log("收到的数据:", res.data.data);
        this.isactive = 0;
        this.issubactive = -1;
        this.depList = res.data.data.nxArr;
        this.gbDepList = res.data.data.gbArr;
        this.gbBatchArr = res.data.data.gbBatchArr;
      

        if (res.data.data.nxArr.length > 0) {
          this.nxDepFatherId = res.data.data.nxArr[0].nxDepartmentId;
          this.nxDepId = res.data.data.nxArr[0].nxDepartmentId;
          this.depName = res.data.data.nxArr[0].nxDepartmentName;
          this.depPrintName = res.data.data.nxArr[0].nxDepartmentPrintName;
          this.updateTime =  new Date().getMilliseconds()   // 启动轮询
          this.gbDepFatherId = -1;
          this.gbDepId = -1;
          this.isactivepb = -1;

        } else {
          // 处理空数据的情况
          this.nxDepFatherId = -1;
          this.nxDepId = -1;
          this.depName = "";
          this.depPrintName = "";

          if(res.data.data.gbArr.length > 0){
           this.gbDepFatherId = res.data.data.gbArr[0].gbDepartmentId;
           this.gbDepId = res.data.data.gbArr[0].gbDepartmentId;
           this.gbDisId = res.data.data.gbArr[0].gbDepartmentDisId;
           this.depName = res.data.data.gbArr[0].gbDepartmentName;
           this.depPrintName = res.data.data.gbArr[0].gbDepartmentPrintName;
           this.updateTime =  new Date().getMilliseconds()   // 启动轮询
           this.nxDepFatherId = -1;
           this.nxDepId = -1;
           this.indexgb = 0;
           this.isactivegb = 0;
           this.isactivepb = -1;
          }else{

            if(res.data.data.gbBatchArr.length > 0){
          this.nxDepFatherId = -1;
           this.nxDepId = -1;
           this.gbDepFatherId = -1;
           this.gbDepId = -1;
           this.gbDisId = -1;
           this.isactive = -1;
           this.isactivepb = 0,
           this.gbBatchId = res.data.data.gbBatchArr[0].gbDistributerPurchaseBatchId;
           this.depName = res.data.data.gbBatchArr[0].gbDistributerEntity.gbDistributerName;
           this.depPrintName = res.data.data.gbBatchArr[0].gbDistributerEntity.gbDistributerPrintName;
           this.updateTime =  new Date().getMilliseconds()   // 启动轮询

                          }else{
               // 防止退出，设置默认值
               this.nxDepFatherId = -1;
               this.nxDepId = -1;
               this.gbDepFatherId = -1;
               this.gbDepId = -1;
               this.gbDisId = -1;
               this.isactive = -1;
               this.isactivepb = -1;
               this.gbBatchId = -1;
               this.depName = "";
               this.depPrintName = "";
               console.log("所有客户数据都为空，但不退出应用");
              }

          
          }
    
        }

        
      }else {
        console.error("API 返回的数据格式不正确:", res);
      }
      console.log("this.nxdefatheid=" , this.nxDepFatherId)
    }).catch(error => {
      console.error("API 请求失败:", error);
    });;

},
    



    // 处理 'print-only' 事件，如果需要
    handlePrintOnly() {
      // 如果 'print-only' 也需要刷新客户列表，可以调用 fetchCustomerList
      // 如果不需要，可以忽略或执行其他逻辑
      this.fetchCustomerList();
    },

    onclickPb(index,gbBatchId, depPrintName){
      console.log("onclickPbonclickPbonclickPb", gbBatchId, depPrintName);
      this.isactivepb = index;
      this.isactive = -1;
      this.issubactive = -1;
      this.isactivegb = -1;
      this.issubactivegb = -1;
      this.gbDepFatherId = -1;
      this.gbDepId = -1,
      this.nxDepFatherId = -1;
      this.nxDepId = -1,
      this.gbBatchId = gbBatchId;
      this.depPrintName = depPrintName;
      this.subAmount = 0;
      this.updateTime = new Date().getMilliseconds();

    },
    onclick(index, nxDepFatherId, nxDeId,depName, subDepName,depPrintName,subAmount) {
      console.log("depPrintName==", depPrintName);

      this.isactive = index;
      this.issubactive = -1;
      this.isactivegb = -1;
      this.issubactivegb = -1;
      this.isactivepb = -1;
      this.gbBatchId = -1;
      this.nxDepFatherId = nxDepFatherId;
      this.nxDepId = nxDeId,
      this.depName = depName + subDepName;
      this.depPrintName = depPrintName;
      this.subAmount = 0;
      this.updateTime = new Date().getMilliseconds();
    },


    onclickGb(index, gbDepFatherId, gbDepId,depName, subDepName,depPrintName,subAmount) {
      console.log("subnamemGGGb", subDepName);

      this.isactivegb = index;
      this.issubactivegb = -1;
      this.isactive = -1;
      this.issubactive = -1;
      this.isactivepb = -1;
      this.gbBatchId = -1;
      this.nxDepFatherId = -1;
      this.nxDepId = -1,
      this.gbDepFatherId = gbDepFatherId;
      this.gbDepId = gbDepId,
      this.depName = depName + subDepName;
      this.depPrintName = depPrintName;
      this.subAmount = 0;
      this.updateTime = new Date().getMilliseconds();
    },


    childClick(index, subIndex,nxDepFatherId, nxDeId,depName, subDepName,depPrintName,event, subAmount) {
      // 阻止事件冒泡，防止触发父部门的点击事件
      event.stopPropagation();

      // 更新子部门的选中状态
      this.isactive = index;
      this.issubactive = subIndex;
      this.isactivegb = -1;
      this.issubactivegb = -1;
      this.isactivepb = -1;
      this.gbBatchId = -1;
      this.gbDepFatherId = -1;
      this.gbDepId = -1,
      this.nxDepFatherId = nxDepFatherId;
      this.nxDepId = nxDeId,
      this.depName = depName + subDepName;
      this.depPrintName = depPrintName;
      this.subAmount = subAmount;
      this.updateTime = new Date().getMilliseconds();
      console.log("点击了子部门:", subDepName);
      
      // 可以在这里处理子部门的具体逻辑，比如传递参数等
    },


    childClickGb(index, subIndex,gbDepFatherId, gbDepId,depName, subDepName,depPrintName,event, subAmount) {
      // 阻止事件冒泡，防止触发父部门的点击事件
      event.stopPropagation();

      // 更新子部门的选中状态
      this.isactivegb = index;
      this.issubactivegb = subIndex;
      this.isactivepb = -1;
      this.isactive = -1;
      this.issubactive = -1;
      this.gbBatchId = -1;
      this.nxDepFatherId = -1;
      this.nxDepId = -1,
      this.gbDepFatherId = gbDepFatherId;
      this.gbDepId = gbDepId,
      // this.depName = depName + subDepName;
      this.depPrintName = depPrintName;
      this.subAmount = subAmount;
      this.updateTime = new Date().getMilliseconds();
      console.log("点击了子部门gbgb:", subDepName, gbDepFatherId, gbDepId,depPrintName);
      
      // 可以在这里处理子部门的具体逻辑，比如传递参数等
    },

    // ========== 转订单相关方法 ==========
    
    // 选择客户文件夹
    async selectCustomerFolder() {
      if (!window.electronAPI) {
        alert('Electron API 不可用，请确保在 Electron 环境中运行');
        return;
      }
      
      if (typeof window.electronAPI.selectFolder !== 'function') {
        alert('selectFolder API 不可用，请重启应用');
        console.error('window.electronAPI:', window.electronAPI);
        return;
      }
      
      try {
        this.selectingFolder = true;
        const result = await window.electronAPI.selectFolder();
        
        if (result.success && result.path) {
          // 确定要保存的客户ID（如果有子部门，使用子部门ID；否则使用主客户ID）
          const targetCustomerId = this.hasSubDepartments && this.selectedSubDepartment 
            ? this.selectedSubDepartment 
            : this.selectedAllCustomer;
          
          // 保存文件夹路径
          const saveResult = await window.electronAPI.saveCustomerFolderPath(
            targetCustomerId,
            result.path
          );
          
          if (saveResult.success) {
            this.customerFolderPath = result.path;
            alert('文件夹路径设置成功！');
            // 自动扫描文件夹
            await this.scanFolderFiles();
          } else {
            alert('保存文件夹路径失败：' + (saveResult.error || '未知错误'));
          }
        }
      } catch (error) {
        console.error('选择文件夹失败:', error);
        alert('选择文件夹失败：' + error.message);
      } finally {
        this.selectingFolder = false;
      }
    },

    // 清除客户文件夹路径
    async clearCustomerFolder() {
      if (!window.electronAPI) {
        return;
      }
      
      if (typeof window.electronAPI.saveCustomerFolderPath !== 'function') {
        alert('saveCustomerFolderPath API 不可用，请重启应用');
        return;
      }
      
      if (confirm('确定要清除文件夹路径设置吗？')) {
        try {
          // 确定要清除的客户ID（如果有子部门，使用子部门ID；否则使用主客户ID）
          const targetCustomerId = this.hasSubDepartments && this.selectedSubDepartment 
            ? this.selectedSubDepartment 
            : this.selectedAllCustomer;
          
          const result = await window.electronAPI.saveCustomerFolderPath(
            targetCustomerId,
            ''
          );
          
          if (result.success) {
            this.customerFolderPath = null;
            this.autoProcessFiles = [];
            this.autoProcessResults = [];
            alert('已清除文件夹路径');
          }
        } catch (error) {
          console.error('清除文件夹路径失败:', error);
        }
      }
    },

    // 加载客户文件夹路径
    async loadCustomerFolderPath() {
      if (!window.electronAPI || !this.selectedAllCustomer) {
        return;
      }
      
      if (typeof window.electronAPI.getCustomerFolderPath !== 'function') {
        console.warn('getCustomerFolderPath API 不可用，请重启应用');
        return;
      }
      
      try {
        // 确定要加载的客户ID（如果有子部门且已选择，使用子部门ID；否则使用主客户ID）
        const targetCustomerId = this.hasSubDepartments && this.selectedSubDepartment 
          ? this.selectedSubDepartment 
          : this.selectedAllCustomer;
        
        const result = await window.electronAPI.getCustomerFolderPath(
          targetCustomerId
        );
        
        if (result.success) {
          this.customerFolderPath = result.path;
          // 如果有路径，自动扫描文件
          if (this.customerFolderPath) {
            await this.scanFolderFiles();
          }
        }
      } catch (error) {
        console.error('加载文件夹路径失败:', error);
      }
    },

    // 扫描文件夹中的文件
    async scanFolderFiles() {
      if (!window.electronAPI || !this.customerFolderPath) {
        return;
      }
      
      if (typeof window.electronAPI.scanFolderFiles !== 'function') {
        console.warn('scanFolderFiles API 不可用，请重启应用');
        return;
      }
      
      try {
        this.scanningFiles = true;
        // 如果有缓存，同时扫描"已处理"文件夹
        const includeProcessed = this.hasCache && this.uploadType === 'auto';
        const result = await window.electronAPI.scanFolderFiles(this.customerFolderPath, includeProcessed);
        
        if (result.success) {
          // 初始化文件列表，设置状态为待处理
          this.autoProcessFiles = result.files.map(file => ({
            ...file,
            status: file.isProcessed ? 'processed' : 'pending', // 已处理的文件状态为 'processed'
            progress: 0,
            orderCount: 0,
            error: null
          }));
          
          // 清空之前的结果
          this.autoProcessResults = [];
          
          // 为已处理的图片文件加载完整图片预览
          this.loadProcessedImagePreviews();
          
          // 为已处理的Excel文件加载预览
          this.loadProcessedExcelPreviews();
          
          // 设置默认激活的标签（第一个已处理的文件）
          const processedFiles = this.autoProcessFiles.filter(f => f.status === 'processed');
          if (processedFiles.length > 0 && !this.activeProcessedFileTab) {
            this.activeProcessedFileTab = processedFiles[0].filePath;
          }
        } else {
          alert('扫描文件夹失败：' + (result.error || '未知错误'));
        }
      } catch (error) {
        console.error('扫描文件夹失败:', error);
        alert('扫描文件夹失败：' + error.message);
      } finally {
        this.scanningFiles = false;
      }
    },

    // 开始自动处理
    async startAutoProcess() {
      if (!this.customerFolderPath || this.autoProcessFiles.length === 0) {
        return;
      }
      
      // 检查是否选择了子部门
      if (!this.checkSubDepartmentSelected()) {
        return;
      }
      
      // 确定要使用的部门ID
      const targetDepId = this.selectedSubDepartment || this.selectedAllCustomer;
      
      this.processingFiles = true;
      this.autoProcessProgress = {
        current: 0,
        total: this.autoProcessFiles.length,
        percent: 0
      };
      this.autoProcessResults = [];
      
      // 收集所有成功处理的订单数据
      const allProcessedOrders = [];
      
      // 逐个处理文件
      for (let i = 0; i < this.autoProcessFiles.length; i++) {
        const file = this.autoProcessFiles[i];
        
        // 更新进度
        this.autoProcessProgress.current = i + 1;
        this.autoProcessProgress.percent = Math.round(
          ((i + 1) / this.autoProcessFiles.length) * 100
        );
        
        // 更新文件状态为处理中
        file.status = 'processing';
        file.progress = 50;
        
        try {
          let result;
          
          if (file.fileType === 'excel') {
            // 处理 Excel 文件
            result = await this.processExcelFile(file, targetDepId);
          } else if (file.fileType === 'image') {
            // 处理图片文件
            result = await this.processImageFile(file, targetDepId);
          } else {
            throw new Error('不支持的文件类型');
          }
          
          // 处理成功
          file.status = 'success';
          file.progress = 100;
          file.orderCount = result.orderCount || 0;
          
          // 收集订单数据（如果有）
          if (result.orders && Array.isArray(result.orders) && result.orders.length > 0) {
            // 为每个订单添加来源文件信息
            const ordersWithSource = result.orders.map(order => ({
              ...order,
              sourceFile: file.fileName, // 记录来源文件
              sourceFileType: file.fileType // 记录文件类型
            }));
            allProcessedOrders.push(...ordersWithSource);
          }
          
          // 移动到"已处理"文件夹
          const moveResult = await window.electronAPI.moveFileToProcessed(
            file.filePath,
            this.customerFolderPath
          );
          
          if (moveResult.success) {
            // 添加到结果列表
            this.autoProcessResults.push({
              fileName: file.fileName,
              success: true,
              orderCount: result.orderCount || 0
            });
          } else {
            console.warn('移动文件失败:', moveResult.error);
            // 即使移动失败，也记录为成功（因为订单已处理）
            this.autoProcessResults.push({
              fileName: file.fileName,
              success: true,
              orderCount: result.orderCount || 0,
              warning: '文件移动失败，但订单已处理'
            });
          }
          
        } catch (error) {
          // 处理失败
          file.status = 'error';
          file.error = error.message || '未知错误';
          
          // 添加到结果列表（失败）
          this.autoProcessResults.push({
            fileName: file.fileName,
            success: false,
            error: error.message || '未知错误'
          });
          
          console.error(`处理文件 ${file.fileName} 失败:`, error);
        }
      }
      
      this.processingFiles = false;
      
      // 如果有处理成功的订单，显示在右侧
      if (allProcessedOrders.length > 0) {
        // 合并到现有订单列表（如果已有订单，追加；否则替换）
        if (this.orderItems.length > 0) {
          // 追加到现有订单
          this.orderItems = [...this.orderItems, ...allProcessedOrders];
        } else {
          // 替换订单列表
          this.orderItems = allProcessedOrders;
        }
        
        // 保存到缓存（转订单类型）
        this._saveToStorage(this.orderItems, 'auto');
        
        // 切换到显示订单列表（确保右侧显示订单）
        console.log(`✅ 转订单完成，共处理 ${allProcessedOrders.length} 条订单`);
      }
      
      // 显示处理完成提示
      const successCount = this.autoProcessResults.filter(r => r.success).length;
      const failCount = this.autoProcessResults.length - successCount;
      const orderCount = allProcessedOrders.length;
      alert(`处理完成！成功：${successCount}，失败：${failCount}${orderCount > 0 ? `，共 ${orderCount} 条订单已显示在右侧` : ''}`);
      
      // 处理完成后，重新扫描文件夹（包括已处理文件夹），以便显示已处理的文件
      if (this.customerFolderPath) {
        // 延迟一下，确保文件移动操作已完成
        setTimeout(async () => {
          try {
            // 重新扫描文件夹（包括已处理文件夹）
            const includeProcessed = true; // 强制包含已处理文件夹
            const result = await window.electronAPI.scanFolderFiles(this.customerFolderPath, includeProcessed);
            
            if (result.success) {
              // 更新文件列表，标记已处理的文件
              this.autoProcessFiles = result.files.map(file => {
                // 查找原文件列表中对应的文件，保留处理状态
                const existingFile = this.autoProcessFiles.find(f => f.filePath === file.filePath || f.fileName === file.fileName);
                if (existingFile && existingFile.status === 'success') {
                  return {
                    ...file,
                    status: 'processed', // 标记为已处理
                    progress: 100,
                    orderCount: existingFile.orderCount || 0,
                    error: null
                  };
                }
                // 如果是新扫描到的已处理文件
                if (file.isProcessed) {
                  return {
                    ...file,
                    status: 'processed',
                    progress: 100,
                    orderCount: 0,
                    error: null
                  };
                }
                // 其他文件保持待处理状态
                return {
                  ...file,
                  status: 'pending',
                  progress: 0,
                  orderCount: 0,
                  error: null
                };
              });
              
              // 为已处理的图片文件加载完整图片预览
              this.loadProcessedImagePreviews();
              
              // 为已处理的Excel文件加载预览
              this.loadProcessedExcelPreviews();
              
              // 设置默认激活的标签（第一个已处理的文件）
              const processedFiles = this.autoProcessFiles.filter(f => f.status === 'processed');
              if (processedFiles.length > 0) {
                this.activeProcessedFileTab = processedFiles[0].filePath;
              }
            }
          } catch (error) {
            console.error('重新扫描已处理文件夹失败:', error);
          }
        }, 500); // 延迟500ms，确保文件移动操作完成
      }
      
      // 刷新客户列表
      this.fetchCustomerList();
    },

    // 处理 Excel 文件
    async processExcelFile(file, targetDepId) {
      if (!window.electronAPI) {
        throw new Error('Electron API 不可用');
      }
      
      // 读取文件
      const readResult = await window.electronAPI.readFile(file.filePath);
      if (!readResult.success) {
        throw new Error('读取文件失败：' + readResult.error);
      }
      
      // 将 base64 转换为 Blob
      const byteCharacters = atob(readResult.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      // 创建 File 对象
      const fileObj = new File([blob], readResult.fileName, { 
        type: blob.type 
      });
      
      // 创建 FormData
      const formData = new FormData();
      formData.append('file', fileObj);
      formData.append('depId', targetDepId);
      formData.append('depFatherId', this.selectedAllCustomer);
      formData.append('disId', this.disUser.nxDiuDistributerId);
      formData.append('userId', this.disUser.nxDepartmentUserId || this.disUser.nxDistributerUserId || -1);
      
      // 调用 Excel 解析接口
      const res = await api.recognizeOrderFromExcel(formData);
      
      if (res && res.data) {
        if (res.data.code === 200 || res.data.code === 0) {
          // 检查是否返回了已保存的订单
          if (Array.isArray(res.data.data) && res.data.data.length > 0) {
            // 转换为订单格式（参考 handleExcelUpload）
            const orders = res.data.data.map(item => ({
              nxDoGoodsName: item.goodsName || item.nxDoGoodsName || '',
              nxDoGoodsNameOriginal: item.goodsName || item.nxDoGoodsName || '',
              nxDoQuantity: item.quantity || item.nxDoQuantity || '',
              nxDoStandard: item.standard || item.nxDoStandard || '斤',
              nxDoRemark: item.remark || item.nxDoRemark || '',
              nxDoAddRemark: !!(item.remark || item.nxDoRemark),
              nxDoStatus: item.status !== undefined ? item.status : (item.nxDoStatus !== undefined ? item.nxDoStatus : -2),
              nxDoDepartmentId: targetDepId,
              nxDoDepartmentFatherId: this.selectedAllCustomer,
              nxDoDisGoodsId: item.disGoodsId || item.nxDoDisGoodsId || null,
              nxDoStandardWarn: 0,
              goodsNameWarn: 0,
              nxDoDistributerId: this.disUser.nxDiuDistributerId,
              nxDoPurchaseUserId: -1,
              nxDoOrderUserId: this.disUser.nxDepartmentUserId || this.disUser.nxDistributerUserId || -1,
              nxDoIsAgent: -1,
              nxDepartmentOrdersId: item.orderId || item.nxDepartmentOrdersId || null,
              nxDistributerGoodsEntityList: item.matchedGoods || item.nxDistributerGoodsEntityList || [],
              nxGoodsEntities: item.matchedGoods || item.nxGoodsEntities || []
            }));
            
            return { 
              orderCount: orders.length,
              orders: orders
            };
          } else if (Array.isArray(res.data.items) && res.data.items.length > 0) {
            // 转换为订单格式（仅解析，未保存）
            const orders = res.data.items.map(item => ({
              nxDoGoodsName: item.name || '',
              nxDoGoodsNameOriginal: item.name || '',
              nxDoQuantity: item.qty || '',
              nxDoStandard: item.unit || '斤',
              nxDoRemark: item.remark || '',
              nxDoAddRemark: !!(item.remark && item.remark.trim()),
              nxDoStatus: -2, // 未保存的草稿
              nxDoDepartmentId: targetDepId,
              nxDoDepartmentFatherId: this.selectedAllCustomer,
              nxDoDisGoodsId: null,
              nxDoStandardWarn: 0,
              goodsNameWarn: 0,
              nxDoDistributerId: this.disUser.nxDiuDistributerId,
              nxDoPurchaseUserId: -1,
              nxDoOrderUserId: this.disUser.nxDepartmentUserId || this.disUser.nxDistributerUserId || -1,
              nxDoIsAgent: -1
            }));
            
            return { 
              orderCount: orders.length,
              orders: orders
            };
          } else {
            throw new Error('Excel文件中没有可读取的数据');
          }
        } else {
          throw new Error(res.data.msg || 'Excel解析失败');
        }
      } else {
        throw new Error('接口返回数据异常');
      }
    },

    // 处理图片文件
    async processImageFile(file, targetDepId) {
      if (!window.electronAPI) {
        throw new Error('Electron API 不可用');
      }
      
      // 读取文件
      const readResult = await window.electronAPI.readFile(file.filePath);
      if (!readResult.success) {
        throw new Error('读取文件失败：' + readResult.error);
      }
      
      // 使用 base64 数据（已经是 base64 格式）
      const imageBase64 = readResult.data;
      
      // 调用 OCR 识别接口
      const ocrData = {
        ImageBase64: imageBase64,
        depId: targetDepId,
        depFatherId: this.selectedAllCustomer,
        disId: this.disUser.nxDiuDistributerId,
        userId: this.disUser.nxDistributerUserId || this.disUser.nxDiuDistributerId
      };
      
      const res = await api.recognizeOrderOCR(ocrData);
      
      if (res && res.data && res.data.code === 0) {
        // 检查是否返回了已保存的订单
        if (Array.isArray(res.data.data) && res.data.data.length > 0) {
          // 已保存的订单，直接返回
          return { 
            orderCount: res.data.data.length,
            orders: res.data.data
          };
        } else {
          // 检查是否有解析的商品列表
          const items = res.data.items || (res.data.data && res.data.data.items);
          if (items && items.length > 0) {
            // 转换为订单格式（参考 handleImageUpload）
            // targetDepId 是函数参数，不需要重新赋值
            const orders = items.map(item => ({
              nxDoGoodsName: item.name || '',
              nxDoGoodsNameOriginal: item.name || '',
              nxDoQuantity: item.qty || '',
              nxDoStandard: item.unit || '斤',
              nxDoRemark: item.remark || '',
              nxDoAddRemark: !!(item.remark && item.remark.trim()),
              nxDoStatus: -2, // 未匹配状态
              nxDoDepartmentId: targetDepId,
              nxDoDepartmentFatherId: this.selectedAllCustomer,
              nxDoDisGoodsId: null,
              nxDoStandardWarn: 0,
              goodsNameWarn: 0,
              nxDoDistributerId: this.disUser.nxDiuDistributerId,
              nxDoPurchaseUserId: -1,
              nxDoOrderUserId: this.disUser.nxDistributerUserId || this.disUser.nxDiuDistributerId,
              nxDoIsAgent: -1,
            })).filter(order => order.nxDoGoodsName && order.nxDoGoodsName.trim());
            
            return { 
              orderCount: orders.length,
              orders: orders
            };
          } else {
            throw new Error('图片中未识别到订单信息');
          }
        }
      } else {
        const errorMsg = res?.data?.msg || res?.data?.message || '识别失败';
        throw new Error(errorMsg);
      }
    },

    // 打开文件（用默认程序打开，如果文件在"已处理"文件夹，则从"已处理"文件夹打开）
    async openFile(filePath) {
      if (!window.electronAPI) {
        alert('Electron API 不可用');
        return;
      }
      
      if (typeof window.electronAPI.openFile !== 'function') {
        alert('openFile API 不可用，请重启应用');
        return;
      }
      
      try {
        const result = await window.electronAPI.openFile(filePath, this.customerFolderPath);
        if (!result.success) {
          alert('打开文件失败：' + (result.error || '未知错误'));
        }
      } catch (error) {
        console.error('打开文件失败:', error);
        alert('打开文件失败：' + error.message);
      }
    },

    // 预览转订单模式下的图片
    async previewAutoProcessImage(file) {
      if (!window.electronAPI) {
        alert('Electron API 不可用');
        return;
      }
      
      if (typeof window.electronAPI.readFile !== 'function') {
        alert('readFile API 不可用，请重启应用');
        return;
      }
      
      try {
        // 先尝试读取原始路径的图片
        let imageBase64 = null;
        let filePathToRead = file.filePath;
        
        try {
          const result = await window.electronAPI.readFile(filePathToRead);
          if (result.success && result.data) {
            imageBase64 = result.data;
          }
        } catch (error) {
          console.log('原始路径读取失败，尝试从已处理文件夹读取:', error);
          // 如果原始路径读取失败，尝试从已处理文件夹读取
          if (this.customerFolderPath) {
            // 使用字符串拼接处理路径（Vue 中不能使用 Node.js 的 path 模块）
            const processedFolder = this.customerFolderPath.endsWith('/') || this.customerFolderPath.endsWith('\\')
              ? this.customerFolderPath + '已处理'
              : this.customerFolderPath + (this.customerFolderPath.includes('\\') ? '\\' : '/') + '已处理';
            
            // 从文件路径中提取文件名
            const fileName = file.filePath.split(/[/\\]/).pop();
            const processedFilePath = processedFolder + (processedFolder.endsWith('/') || processedFolder.endsWith('\\') ? '' : (processedFolder.includes('\\') ? '\\' : '/')) + fileName;
            
            try {
              const processedResult = await window.electronAPI.readFile(processedFilePath);
              if (processedResult.success && processedResult.data) {
                imageBase64 = processedResult.data;
                filePathToRead = processedFilePath;
              }
            } catch (processedError) {
              // 如果文件名不匹配，尝试查找带时间戳的文件
              console.log('尝试查找带时间戳的文件...');
              // 这里可以进一步优化，查找匹配的文件
            }
          }
        }
        
        if (!imageBase64) {
          alert('无法读取图片文件，文件可能已被移动或删除');
          return;
        }
        
        // 将 Base64 转换为 data URL
        // 检查 Base64 是否包含 data URL 前缀
        if (!imageBase64.startsWith('data:')) {
          // 根据文件扩展名确定 MIME 类型
          const ext = file.fileName.toLowerCase().split('.').pop();
          const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'bmp': 'image/bmp',
            'webp': 'image/webp'
          };
          const mimeType = mimeTypes[ext] || 'image/jpeg';
          imageBase64 = `data:${mimeType};base64,${imageBase64}`;
        }
        
        // 设置预览图片
        this.autoProcessImagePreview = imageBase64;
        this.autoProcessImagePreviewFileName = file.fileName;
        
        // 重置图片变换（缩放和位置）
        this.imageScale = 1;
        this.imageTranslateX = 0;
        this.imageTranslateY = 0;
        this.isDragging = false;
        
      } catch (error) {
        console.error('预览图片失败:', error);
        alert('预览图片失败：' + error.message);
      }
    },

    // 清除转订单模式下的图片预览
    clearAutoProcessImagePreview() {
      this.autoProcessImagePreview = null;
      this.autoProcessImagePreviewFileName = '';
      // 重置图片变换
      this.imageScale = 1;
      this.imageTranslateX = 0;
      this.imageTranslateY = 0;
      this.isDragging = false;
    },

    // 为已处理的图片文件加载完整图片预览
    async loadProcessedImagePreviews() {
      if (!window.electronAPI) {
        return;
      }
      
      if (typeof window.electronAPI.readFile !== 'function') {
        return;
      }
      
      // 筛选出已处理的图片文件
      const processedImageFiles = this.autoProcessFiles.filter(
        file => file.fileType === 'image' && file.status === 'processed'
      );
      
      // 确保 autoProcessImagePreviews 已初始化
      if (!this.autoProcessImagePreviews) {
        this.autoProcessImagePreviews = {};
      }
      
      // 并发加载所有图片
      const loadPromises = processedImageFiles.map(async (file) => {
        // 如果已经有预览，跳过
        if (this.autoProcessImagePreviews && this.autoProcessImagePreviews[file.filePath]) {
          return;
        }
        
        try {
          const result = await window.electronAPI.readFile(file.filePath);
          
          if (result.success && result.data) {
            // 将 Base64 转换为 data URL
            let imageBase64 = result.data;
            if (!imageBase64.startsWith('data:')) {
              const ext = file.fileName.toLowerCase().split('.').pop();
              const mimeTypes = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'bmp': 'image/bmp',
                'webp': 'image/webp'
              };
              const mimeType = mimeTypes[ext] || 'image/jpeg';
              imageBase64 = `data:${mimeType};base64,${imageBase64}`;
            }
            
            // Vue 3 中直接赋值即可，不需要 $set
            if (!this.autoProcessImagePreviews) {
              this.autoProcessImagePreviews = {};
            }
            this.autoProcessImagePreviews[file.filePath] = imageBase64;
          }
        } catch (error) {
          console.error('加载图片预览失败:', file.fileName, error);
          // 不显示错误，静默失败
        }
      });
      
      // 等待所有图片加载完成（不阻塞UI）
      Promise.all(loadPromises).catch(error => {
        console.error('批量加载图片预览时出错:', error);
      });
    },

    // 处理图片预览加载错误
    handleImagePreviewError(filePath) {
      // 如果图片加载失败，从缓存中移除，以便重新加载
      if (this.autoProcessImagePreviews && this.autoProcessImagePreviews[filePath]) {
        // Vue 3 中直接删除即可，不需要 $delete
        delete this.autoProcessImagePreviews[filePath];
      }
    },

    // 为已处理的Excel文件加载预览
    async loadProcessedExcelPreviews() {
      if (!window.electronAPI) {
        return;
      }
      
      if (typeof window.electronAPI.readFile !== 'function') {
        return;
      }
      
      // 动态导入 xlsx 库
      let XLSX;
      try {
        XLSX = await import('xlsx');
      } catch (error) {
        console.error('无法加载 xlsx 库:', error);
        return;
      }
      
      // 筛选出已处理的Excel文件
      const processedExcelFiles = this.autoProcessFiles.filter(
        file => file.fileType === 'excel' && file.status === 'processed'
      );
      
      // 确保 autoProcessExcelPreviews 已初始化
      if (!this.autoProcessExcelPreviews) {
        this.autoProcessExcelPreviews = {};
      }
      
      // 并发加载所有Excel文件
      const loadPromises = processedExcelFiles.map(async (file) => {
        // 如果已经有预览，跳过
        if (this.autoProcessExcelPreviews && this.autoProcessExcelPreviews[file.filePath]) {
          return;
        }
        
        try {
          const result = await window.electronAPI.readFile(file.filePath);
          
          if (result.success && result.data) {
            // 将 Base64 转换为二进制数据
            const binaryString = atob(result.data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            
            // 使用 xlsx 读取 Excel
            const workbook = XLSX.read(bytes, { type: 'array' });
            
            // 提取所有工作表的数据
            const sheets = workbook.SheetNames.map((sheetName, index) => {
              const worksheet = workbook.Sheets[sheetName];
              // 转换为 JSON 数组（保留原始格式）
              const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
                header: 1, 
                defval: '',
                raw: false 
              });
              
              return {
                name: sheetName,
                index: index,
                data: jsonData
              };
            });
            
            // 保存预览数据
            if (!this.autoProcessExcelPreviews) {
              this.autoProcessExcelPreviews = {};
            }
            this.autoProcessExcelPreviews[file.filePath] = {
              sheets: sheets,
              currentSheet: 0
            };
          }
        } catch (error) {
          console.error('加载Excel预览失败:', file.fileName, error);
          // 保存错误状态
          if (!this.autoProcessExcelPreviews) {
            this.autoProcessExcelPreviews = {};
          }
          this.autoProcessExcelPreviews[file.filePath] = {
            sheets: [],
            currentSheet: 0,
            error: error.message
          };
        }
      });
      
      // 等待所有Excel文件加载完成（不阻塞UI）
      Promise.all(loadPromises).catch(error => {
        console.error('批量加载Excel预览时出错:', error);
      });
    },

    // 获取当前工作表的数据
    getCurrentExcelSheetData(filePath) {
      if (!this.autoProcessExcelPreviews || !this.autoProcessExcelPreviews[filePath]) {
        return [];
      }
      
      const preview = this.autoProcessExcelPreviews[filePath];
      const currentSheetIndex = preview.currentSheet || 0;
      
      if (preview.sheets && preview.sheets[currentSheetIndex]) {
        return preview.sheets[currentSheetIndex].data || [];
      }
      
      return [];
    },

    // 切换Excel工作表
    changeExcelSheet(filePath, sheetIndex) {
      if (this.autoProcessExcelPreviews && this.autoProcessExcelPreviews[filePath]) {
        this.autoProcessExcelPreviews[filePath].currentSheet = parseInt(sheetIndex);
      }
    },

    // 预览Excel文件（大图预览）
    previewAutoProcessExcel(file) {
      // 可以打开一个模态框显示完整的Excel表格
      // 这里先简单提示，后续可以扩展为模态框
      alert('Excel预览功能：\n文件：' + file.fileName + '\n\n可以点击"打开"按钮用默认程序打开Excel文件进行查看和编辑。');
    },

    // 获取当前激活文件的文件名
    getActiveFileName() {
      if (!this.activeProcessedFileTab) {
        return '';
      }
      const activeFile = this.processedFiles.find(f => f.filePath === this.activeProcessedFileTab);
      return activeFile ? activeFile.fileName : '';
    },

    // 格式化文件大小
    formatFileSize(bytes) {
      if (!bytes || bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    },

    // 清除已上传的Excel文件
    clearUploadedExcelFile() {
      this.uploadedExcelFile = null;
      this.uploadedExcelPreview = null;
      if (this.$refs.excelFileInput) {
        this.$refs.excelFileInput.value = '';
      }
    },

    // 清除已上传的图片文件
    clearUploadedImageFile() {
      this.uploadedImageFile = null;
      this.imagePreview = null;
      if (this.$refs.imageFileInput) {
        this.$refs.imageFileInput.value = '';
      }
    },

    // 全屏预览图片
    previewImageFullScreen() {
      if (this.imagePreview) {
        // 可以打开一个模态框显示大图，这里先简单处理
        const newWindow = window.open();
        if (newWindow) {
          newWindow.document.write(`<img src="${this.imagePreview}" style="max-width: 100%; height: auto;" />`);
        }
      }
    },

    // 加载上传的Excel文件预览
    async loadUploadedExcelPreview(file) {
      if (!file) {
        return;
      }
      
      // 动态导入 xlsx 库
      let XLSX;
      try {
        XLSX = await import('xlsx');
      } catch (error) {
        console.error('无法加载 xlsx 库:', error);
        this.uploadedExcelPreview = {
          sheets: [],
          currentSheet: 0,
          error: '无法加载 xlsx 库'
        };
        return;
      }
      
      try {
        // 使用 Promise 包装 FileReader
        const fileData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          
          reader.onload = (e) => {
            try {
              const data = new Uint8Array(e.target.result);
              resolve(data);
            } catch (error) {
              reject(error);
            }
          };
          
          reader.onerror = (error) => {
            reject(new Error('读取文件失败'));
          };
          
          // 以 ArrayBuffer 方式读取
          reader.readAsArrayBuffer(file);
        });
        
        // 使用 xlsx 读取 Excel
        const workbook = XLSX.read(fileData, { type: 'array' });
        
        // 提取所有工作表的数据
        const sheets = workbook.SheetNames.map((sheetName, index) => {
          const worksheet = workbook.Sheets[sheetName];
          // 转换为 JSON 数组（保留原始格式）
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1, 
            defval: '',
            raw: false 
          });
          
          return {
            name: sheetName,
            index: index,
            data: jsonData
          };
        });
        
        // 保存预览数据
        this.uploadedExcelPreview = {
          sheets: sheets,
          currentSheet: 0
        };
        
        console.log('Excel预览数据加载完成，工作表数量:', sheets.length);
        
        // 同时保存到缓存的文件信息中
        if (this.uploadedExcelFile) {
          this.uploadedExcelFile.preview = this.uploadedExcelPreview;
        }
        
        // 强制触发 Vue 响应式更新
        this.$forceUpdate();
      } catch (error) {
        console.error('加载Excel预览失败:', error);
        this.uploadedExcelPreview = {
          sheets: [],
          currentSheet: 0,
          error: error.message || '加载失败'
        };
      }
    },

    // 获取上传的Excel当前工作表数据
    getUploadedExcelSheetData() {
      if (!this.uploadedExcelPreview || !this.uploadedExcelPreview.sheets) {
        return [];
      }
      
      const currentSheetIndex = this.uploadedExcelPreview.currentSheet || 0;
      
      if (this.uploadedExcelPreview.sheets[currentSheetIndex]) {
        return this.uploadedExcelPreview.sheets[currentSheetIndex].data || [];
      }
      
      return [];
    },

    // 切换上传的Excel工作表
    changeUploadedExcelSheet(sheetIndex) {
      if (this.uploadedExcelPreview) {
        this.uploadedExcelPreview.currentSheet = parseInt(sheetIndex);
      }
    }

  }
}
</script>

<style scoped>
/* 客户管理按钮样式 */
.btn-group .btn {
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.3s ease;
  margin: 0 2px;
}

.btn-group .btn:hover {
  /* 移除 transform 避免布局抖动 */
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.btn-group .btn:first-child {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.btn-group .btn:last-child {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.customer-type-section {
  margin-top: 15px;
}

.customer-type-section h6,
.customer-type-header {
  margin-bottom: 10px;
  padding: 8px;
  border-radius: 5px;
  background-color: #f8f9fa;
  transition: background-color 0.2s ease;
}

.customer-type-header:hover {
  background-color: #e9ecef;
}

/* 空状态提示样式 */
.empty-customer-list {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  height: 100%;
}

.empty-order-content {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  min-height: 400px;
  height: 100%;
  padding-top: 150px; /* 向下偏移，避免位置太高 */
}

/* .customer-type-section .nav-pills 移除独立滚动，使用外层统一滚动容器 */

.customer-type-section .nav-pills li {
  padding: 8px 12px;
  margin-bottom: 5px;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.customer-type-section .nav-pills li:hover {
  background-color: #e9ecef;
}

.customer-type-section .nav-pills li.active {
  background-color: #007bff;
  color: white;
}

.customer-type-section .nav-pills li a {
  color: inherit;
  text-decoration: none;
  display: block;
}

/* 订单相关样式 */
.history-orders-content {
  max-height: 500px;
  overflow-y: scroll; /* 改为 scroll 确保滚动条始终显示 */
}

.order-item {
  transition: all 0.2s ease;
  border: 1px solid #e9ecef !important;
}

.order-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  /* 移除 transform 避免布局抖动 */
}

.month-stats-header {
  border: 1px solid #e9ecef;
}

.sub-dep-item {
  font-size: 0.875rem;
  padding: 0.25rem 0.5rem;
  background-color: #f8f9fa;
  border-radius: 0.25rem;
  margin-right: 0.5rem;
  margin-bottom: 0.25rem;
  display: inline-block;
}

.nav-tabs .nav-link {
  border: 1px solid transparent !important;
  border-top-left-radius: 0.375rem;
  border-top-right-radius: 0.375rem;
  color: #495057;
  font-weight: 500;
  /* 确保边框稳定，避免hover时变化 */
  box-sizing: border-box;
  /* 完全禁用所有过渡效果，避免任何变化 */
  transition: none !important;
  transform: none !important;
  margin: 0 !important;
  padding: 0.5rem 1rem !important;
  /* 强制固定所有布局属性 */
  display: block !important;
  position: static !important;
  float: none !important;
  width: auto !important;
  height: auto !important;
  min-width: auto !important;
  max-width: none !important;
  flex: none !important;
  flex-shrink: 0 !important;
  flex-grow: 0 !important;
  flex-basis: auto !important;
}

/* 月份标签页稳定性样式 */
.nav-tabs {
  border-bottom: 1px solid #dee2e6;
  /* 强制固定布局 */
  display: flex !important;
  flex-wrap: nowrap !important;
  width: 100% !important;
  overflow: hidden !important;
}

.nav-tabs .nav-item {
  margin-bottom: -1px;
  /* 强制固定项目布局 */
  flex-shrink: 0 !important;
  width: auto !important;
}

.nav-tabs .nav-link:hover {
  /* 移除 border-color 变化，避免布局抖动 */
  color: #0d6efd;
  border-color: transparent !important;
  /* 确保hover时没有任何其他变化 */
  transition: none !important;
  transform: none !important;
  margin: 0 !important;
  padding: 0.5rem 1rem !important;
  /* 强制固定所有布局属性 */
  display: block !important;
  position: static !important;
  float: none !important;
  width: auto !important;
  height: auto !important;
  min-width: auto !important;
  max-width: none !important;
  flex: none !important;
  flex-shrink: 0 !important;
  flex-grow: 0 !important;
  flex-basis: auto !important;
  box-sizing: border-box !important;
}

.nav-tabs .nav-link.active {
  color: #495057;
  background-color: #fff;
  border: 1px solid #dee2e6 !important;
  border-bottom-color: #fff !important;
  font-weight: 600;
  /* 确保边框稳定 */
  box-sizing: border-box;
  /* 确保active状态也没有任何变化 */
  transition: none !important;
  transform: none !important;
  margin: 0 !important;
  padding: 0.5rem 1rem !important;
  /* 强制固定所有布局属性 */
  display: block !important;
  position: static !important;
  float: none !important;
  width: auto !important;
  height: auto !important;
  min-width: auto !important;
  max-width: none !important;
  flex: none !important;
  flex-shrink: 0 !important;
  flex-grow: 0 !important;
  flex-basis: auto !important;
}

.order-info {
  flex: 1;
}

.amount-section {
  min-width: 120px;
}

/* 侧边栏和内容区域的整体布局 */
  .bills-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.bill-body {
  padding: 20px;
  display: flex;
  flex: 1;
  min-height: 0; /* 允许 flex 子元素收缩 */
  overflow: hidden;
}

/* 侧边栏容器 - 使用 flex 布局 */
.sidebar-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

/* 客户列表容器 - 自动填充剩余空间 */
.customer-list-box {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.customer-list-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* 客户列表 - 自动滚动 */
.customer-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  /* 移除固定的 max-height 和 min-height，让 flex 自动处理 */
}

/* 主内容区域 - 使用 flex 布局 */
.main-content-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
/* 侧边栏样式 */
.box-primary {
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.box-header {
  background-color: #e2e2e2;
  padding: 10px 20px;
  border-radius: 10px 10px 0 0;
  font-size: 12px;
  text-align: center;
}

/* .box-body {
  padding: 10px;
} */

.nav-pills {
  list-style: none;
  padding-left: 0;
  display: block;
}

.nav-pills .tab-item {
  padding: 20px 20px;
  cursor: pointer;
  border-bottom: 1px solid #ddd;
  transition: background-color 0.3s ease;
}

.nav-pills .tab-item .tab-item-sub{
  padding: 20px 20px;
  cursor: pointer;
  border-bottom: 1px solid #ddd;
  color: #343333;
  transition: background-color 0.3s ease;
}


.nav-pills .tab-item .tab-item-sub.active {
  background-color: yellowgreen; /* 设置选中状态的背景色 */
  color: white; /* 选中时文字颜色 */
}

/* 当父部门被选中时，子部门显示为白色 */
.nav-pills .tab-item.active .tab-item-sub {
  color: white;
}
.nav-pills .tab-item:hover {
  background-color: #f4f4f4;
  color: #000;
}

.nav-pills .active {
  background-color: #590381;
  color: #fff;
  font-weight: bold;
}
.nav-pills .tab-item.active {
  background-color: #590381;  /* 父类选中的背景色 */
  color: white;
}

/* 主内容区域样式 */
.col-md-10,
.main-content-container {
  padding-left: 20px;
  padding-right: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  border-radius: 10px;
  background-color: #fff;
}

/* 上传区域和订单区域使用 flex 布局 */
.upload-section {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.order-items-section {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.col-md-10 .box {
  border-radius: 10px;
  margin-bottom: 20px;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #dee2e6;
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6c757d;
}

.btn-close:hover {
  color: #000;
}

.modal-body {
  padding: 20px;
}

.order-info {
  background-color: #f8f9fa;
  /*padding: 15px;*/
  border-radius: 6px;
  /*margin-bottom: 20px;*/
}

.order-items {
  margin-bottom: 20px;
}

.order-items h6 {
  margin-bottom: 15px;
  color: #495057;
  font-weight: 600;
}

.brand {
  border: 1px solid #acacac;
  color: rgb(27, 27, 27);
  font-weight: 300;
  padding: 0 6px;
  border-radius: 10px;
  font-size: 24px;
  margin-right: 4px;
}

.goods-name, .goods-standard {
  margin-right: 8px;
}

.print-preview-section {
  margin-top: 20px;
  padding: 15px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  background-color: #f8f9fa;
}

.print-component-preview {
  min-height: 200px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .content {
    flex-direction: column;
  }

  .col-md-2,
  .col-md-10 {
    width: 100%;
    padding: 10px;
  }

  .nav-pills {
    max-height: 300px;
    overflow-y: auto;
  }
}

/* 订单状态颜色 - 参考 orderPage，与小程序保持一致 */
.liziBack {
  background: #e5f8f6; /* 默认浅青绿色背景 */
}

.liziClock {
  background: #ebebeb; /* 待处理 - 浅灰色背景 */
}

.liziDelivery {
  background: #cfcfcf; /* 已送货 - 中灰色背景 */
}

/* 操作菜单弹窗样式 */
.order-operation-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.order-operation-menu {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  min-width: 200px;
  overflow: hidden;
}

.operation-menu-item {
  padding: 15px 20px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  transition: background-color 0.2s;
}

.operation-menu-item:last-child {
  border-bottom: none;
}

.operation-menu-item:hover {
  background-color: #f8f9fa;
}

/* 编辑订单弹窗样式 */
.order-edit-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2100;
}

.order-edit-popup {
  width: 90%;
  max-width: 600px;
  background-color: white;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  max-height: 90vh;
  overflow-y: auto;
}

.popup-header {
  background-color: #f8f8f8;
  border-bottom: 1px solid #ddd;
}

.popup-body {
  padding: 20px;
}

.popup-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 15px 20px;
  border-top: 1px solid #ddd;
  background-color: #f8f8f8;
}
</style>