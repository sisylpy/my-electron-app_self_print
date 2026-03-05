<template>
    <div class="bills-container">

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
                    <button
                            v-if="taskCount > 0"
                            type="button"
                            :class="currentView === 'task' ? 'btn btn-primary' : 'btn btn-outline-primary'"
                            @click="switchToTaskList">
                        下单中
                        <span class="badge bg-secondary ms-2" >{{ taskCount }}</span>

                    </button>
                    <button type="button"
                            :class="currentView === 'all' ? 'btn btn-primary' : 'btn btn-outline-primary'"
                            @click="switchToAllCustomers">
                        客户
                    </button>
                </div>

                <!-- 增加搜索客户名称的搜索框 -->
                <div v-if="currentView === 'all'" class="customer-search-box mb-2">
                    <div class="input-group">
            <span class="input-group-text">
              <i class="bi bi-search"></i>
            </span>
                        <input
                                type="text"
                                class="form-control"
                                placeholder="搜索客户名称..."
                                v-model="customerSearchKeyword"
                                @input="handleCustomerSearch"
                        />
                        <button
                                v-if="customerSearchKeyword"
                                class="btn btn-outline-secondary"
                                type="button"
                                @click="clearCustomerSearch"
                                title="清除搜索"
                        >
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                </div>

                <!-- 未打印订单客户列表 -->
                <div v-if="currentView === 'order'" class="box customer-list-box">
                    <div class="box-body no-padding customer-list-body">
                        <!-- 有数据时显示列表 -->
                        <ul v-if="depList.length > 0 || gbBatchArr.length > 0"
                            class="nav nav-pills nav-stacked customer-list">
                            <li v-for="(item, index) in depList" :key="item.nxDepartmentId" :id="item.nxDepartmentId"
                                :class="{ 'active': isactive === index, 'tab-item': true }"
                                @click="onclick(index, item.nxDepartmentId, item.nxDepartmentId,item.nxDepartmentAttrName, '',item.nxDepartmentPrintName , item.nxDepartmentSubAmount)">
                                <a>{{ item.nxDepartmentName }}</a>
                                <ul v-if="item.nxDepartmentEntities && item.nxDepartmentEntities.length > 0"
                                    class="sub-department-list"
                                    style="list-style-type: none; padding-left: 20px;">
                                    <li v-for="(subItem, subIndex) in item.nxDepartmentEntities"
                                        :key="subItem.nxDepartmentId"
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

                <!-- 今日任务客户（父级部门列表，选中后右侧按部门用 depFatherGetTaskList 拉任务） -->
                <div v-if="currentView === 'task'" class="box customer-list-box">
                    <div class="box-body no-padding customer-list-body">
                        <div v-if="taskListLoading" class="text-center p-3 text-muted">加载中...</div>
                        <ul v-else-if="taskList.length > 0" class="nav nav-pills nav-stacked customer-list">
                            <li v-for="dep in taskList" :key="dep.nxDepartmentId"
                                :class="{ 'active': selectedTask && selectedTask.nxDepartmentId === dep.nxDepartmentId, 'tab-item': true }"
                                @click="selectTask(dep)">
                                <a>{{ taskDepartmentLabel(dep) }}</a>
                                <span class="badge bg-secondary ms-2" v-if="dep.taskCount">{{ dep.taskCount }}</span>
                            </li>
                        </ul>
                        <div v-else class="empty-customer-list text-center p-4">
                            <div class="text-muted">
                                <div class="mb-2" style="font-size: 48px;">📋</div>
                                <div class="fw-bold mb-1">暂无今日任务客户</div>
                                <div class="small">点击上方按钮加载有未完成任务的客户列表</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 全部客户列表 -->
                <div v-if="currentView === 'all'" class="box customer-list-box">
                    <div class="box-body no-padding customer-list-body" 
                         ref="customerListBody"
                         @scroll="handleCustomerListScroll">
                        <!-- 现金客户 -->
                        <div class="customer-type-section"
                             :class="{ 'collapsed': collapsedCustomerTypes.cash || filteredCashCustomers.length === 0 }">
                            <h6
                                    class="text-muted customer-type-header"
                                    @click="toggleCustomerType('cash')"
                                    style="cursor: pointer; user-select: none;">
                                <span class="me-2">{{ collapsedCustomerTypes.cash ? '▶' : '▼' }}</span>
                                现金客户
                            </h6>
                            <ul v-show="!collapsedCustomerTypes.cash && filteredCashCustomers.length > 0"
                                class="nav nav-pills nav-stacked">
                                <li v-for="customer in filteredCashCustomers" :key="customer.nxDepartmentId"
                                    :class="{ 'active': String(selectedAllCustomer) === String(customer.nxDepartmentId) }"
                                    @click="selectAllCustomer(customer.nxDepartmentId, customer)">
                                    <a class="d-flex align-items-center flex-nowrap" style="white-space: nowrap;">
                                        <span>{{ customer.nxDepartmentAttrName }}</span>
                                        <span class="badge bg-secondary ms-2" v-if="customer.taskCount > 0">{{ customer.taskCount }}</span>
                                    </a>
                                </li>
                            </ul>
                        </div>

                        <!-- 记账客户 -->
                        <div class="customer-type-section"
                             :class="{ 'collapsed': collapsedCustomerTypes.credit || filteredCreditCustomers.length === 0 }">
                            <h6
                                    class="text-muted customer-type-header"
                                    @click="toggleCustomerType('credit')"
                                    style="cursor: pointer; user-select: none;">
                                <span class="me-2">{{ collapsedCustomerTypes.credit ? '▶' : '▼' }}</span>
                                记账客户
                            </h6>
                            <ul v-show="!collapsedCustomerTypes.credit && filteredCreditCustomers.length > 0"
                                class="nav nav-pills nav-stacked">
                                <li v-for="customer in filteredCreditCustomers" :key="customer.nxDepartmentId"
                                    :class="{ 'active': String(selectedAllCustomer) === String(customer.nxDepartmentId) }"
                                    @click="selectAllCustomer(customer.nxDepartmentId, customer)">
                                    <a class="d-flex align-items-center flex-nowrap" style="white-space: nowrap;">
                                        <span>{{ customer.nxDepartmentAttrName }}</span>
                                        <span class="badge bg-secondary ms-2" v-if="customer.taskCount">{{ customer.taskCount }}</span>
                                    </a>
                                </li>
                            </ul>
                        </div>
                        
                        <!-- 到底了提示 -->
                        <div v-if="isCustomerListBottom" class="customer-list-bottom-tip">
                            到底了！
                        </div>
                    </div>
                </div>
            </div>

            <!-- 主内容区域 -->
            <div class="col-md-10 main-content-container">
                <!-- 未打印订单客户视图 - 显示订单详情组件 -->
                <keep-alive v-if="currentView === 'order' && depPrintName && depPrintName !== ''">
                    <component :is="depPrintName" :nxDepFatherId="nxDepFatherId" :nxDepId="nxDepId" :depName="depName"
                               :depPrintName="depPrintName"
                               :updateTime="updateTime" :disId="disId" :disName="disName" :gbDepFatherId="gbDepFatherId"
                               :gbDepId="gbDepId"
                               :gbDepName="gbDepName" :gbDisId="gbDisId" :gbBatchId="gbBatchId"

                               @order-saved="handleOrderSavedFromPrintView"
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

                <!-- 今日任务视图 - 右侧显示 TaskOrder（按父级部门拉取任务，由 ImageUpload depFatherGetTaskList 获取） -->
                <div v-if="currentView === 'task'" class="task-order-wrapper">
                    <div v-if="!selectedTask" class="text-center p-5">
                        <div class="text-muted">
                            <div class="mb-3" style="font-size: 64px;">📋</div>
                            <h5 class="fw-bold mb-2">请选择客户</h5>
                            <p class="mb-0">在左侧选择有未完成任务的客户，右侧将按该客户的父级部门拉取任务并显示订单</p>
                        </div>
                    </div>
                    <TaskOrder
                        v-else
                        ref="taskOrderRef"
                        :selected-all-customer="selectedTask.nxDepartmentId"
                        :selected-sub-department="selectedTask.nxDepartmentId"
                        @task-list-changed="handleTaskAdded"
                    />
                </div>

                <!-- 全部客户视图 - 显示三个标签页 -->
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
<!--                        <div class="d-flex align-items-center justify-content-between mb-3 pb-3 border-bottom">-->
<!--                            <div class="d-flex align-items-center gap-3 flex-grow-1">-->
<!--                                <h5 class="mb-0">-->
<!--                                    <span class="text-muted">{{ customerType === 'cash' ? '现金' : '记账' }}</span>-->
<!--                                    客户：{{ selectedCustomerName }}-->
<!--                                </h5>-->

<!--                            </div>-->
<!--                        </div>-->

                        <!-- 主标签页：今日订单 / 下单 / 历史订单 -->
                        <ul class="nav nav-tabs mb-3 d-flex align-items-center" role="tablist">
                            <li class="nav-item" role="presentation">
                                <button
                                        class="nav-link"
                                        :class="{ 'active': allCustomerTabIndex === 0 }"
                                        type="button"
                                        role="tab"
                                        @click="switchAllCustomerTab(0)">
                                    💾 今日订单
                                    <span class="badge bg-primary ms-2" v-if="todayOrderTotal > 0">{{ todayOrderTotal }}</span>
                                </button>
                            </li>
                            <li class="nav-item d-flex align-items-center" role="presentation">
                                <div class="d-flex align-items-center" 
                                     :class="{ 'nav-link-active-wrapper': allCustomerTabIndex === 1 }"
                                     style="display: flex; align-items: center; border: 1px solid transparent; border-top-left-radius: 0.375rem; border-top-right-radius: 0.375rem; margin-bottom: -1px;">
                                    <button
                                            class="nav-link"
                                            :class="{ 'active': allCustomerTabIndex === 1 }"
                                            type="button"
                                            role="tab"
                                            @click="switchAllCustomerTab(1)"
                                            style="border: none; border-radius: 0;">
                                        ➕ 下单
                                    </button>
                                    <!-- 子部门选择（只在"下单"标签页显示） -->
                                    <div v-if="allCustomerTabIndex === 1 && hasSubDepartments" 
                                         class="d-flex align-items-center gap-2 px-2"
                                         style="border-left: 1px solid #dee2e6; height: 100%;">
                                        <!-- <span class="text-muted small">部门：</span> -->
                                        <select
                                                v-model="selectedSubDepartment"
                                                @change="handleSubDepartmentChange"
                                                class="form-select form-select-sm"
                                                style="width: auto; min-width: 150px; border: none; box-shadow: none;"
                                                @click.stop>
                                            <option
                                                    v-for="subDept in selectedCustomerEntity.nxDepartmentEntities"
                                                    :key="subDept.nxDepartmentId"
                                                    :value="subDept.nxDepartmentId">
                                                {{ subDept.nxDepartmentAttrName || subDept.nxDepartmentName }}
                                            </option>
                                        </select>
                                    </div>
                                </div>
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
                                <TodayOrders
                                        :todayOrderList="todayOrderList"
                                        :todayOrderDepArr="todayOrderDepArr"
                                        :hasSubDepartments="hasSubDepartments"
                                        :selectedSubDepartment="selectedSubDepartment"
                                        :todayOrderTotal="todayOrderTotal"
                                        :selectedAllCustomer="selectedAllCustomer"
                                        @order-updated="fetchTodayOrders"
                                        @order-deleted="fetchTodayOrders"
                                />
                            </div>

                            <!-- 标签2：下单 -->
                            <div v-if="allCustomerTabIndex === 1" class="tab-pane fade show active" role="tabpanel">
                                <PlaceOrder
                                        ref="placeOrderRef"
                                        :selectedAllCustomer="selectedAllCustomer"
                                        :selectedSubDepartment="selectedSubDepartment"
                                        :selectedCustomerEntity="selectedCustomerEntity"
                                        :selectedCustomerName="selectedCustomerName"
                                        @order-saved="handleOrderSaved"
                                        @task-added="handleTaskAdded"
                                        @switch-to-today-orders="() => switchAllCustomerTab(0)"
                                />
                            </div>

                            <!-- 标签3：历史订单 -->
                            <div v-if="allCustomerTabIndex === 2" class="tab-pane fade show active" role="tabpanel">
                                <HistoryOrders
                                        :selectedAllCustomer="selectedAllCustomer"
                                        @open-order-detail="openOrderDetail"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- 订单详情弹窗 -->
        <div v-if="showOrderModal" class="modal-overlay" @click="closeOrderModal">
            <div class="modal-content" @click.stop>
                <div class="modal-body">
                    <!-- 打印组件预览区域 -->
                    <div class="print-preview-section">
                        <!-- 使用动态组件简化代码 -->
                        <component
                                v-if="currentPrintComponent && billDetailData"
                                :key="'history-print-' + selectedBillId"
                                :is="currentPrintComponent"
                                :ref="currentPrintComponentRef"
                                :nxDepFatherId="selectedBillDepFatherId"
                                :nxDepId="selectedBillDepFatherId"
                                :depName="selectedBillDepName"
                                :depPrintName="selectedBillDepPrintName"
                                :updateTime="selectedBillId"
                                :gbDepFatherId="-1"
                                :gbDepId="-1"
                                :gbDisId="-1"
                                :gbBatchId="-1"
                                :isHistoryOrder="true"
                                :orderData="{
                  bill: billDetailData,
                  arr: Array.from(billDetailData?.nxDepartmentOrdersEntities || [])
                }"
                                @print-started="closeOrderModal"
                                class="print-component-preview"
                        />
                        <div v-else class="print-component-preview">
                            <div class="alert alert-info">
                                {{ billDetailData ? '暂不支持该打印格式的预览' : '加载中...' }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
    import api from "../api/all";
    import ApplyPanel from "../components/Applys/ApplyPanel.vue";
    import ApplyFiftyPanel from '../components/Applys/ApplyFiftyPanel.vue'
    import ApplyHalfPanel from '../components/Applys/ApplyHalfPanel.vue';


    import ApplyHalfWholePanel from '../components/Applys/ApplyHalfWholePanel.vue';
    import ApplyThirtyPanel from '../components/Applys/ApplyThirtyPanel.vue';
    import ApplyThirtyWholePanel from '../components/Applys/ApplyThirtyWholePanel.vue';
    import TodayOrders from '@/components/TodayOrders.vue';
    import PlaceOrder from '@/components/PlaceOrder.vue';
    import TaskOrder from '@/components/TaskOrder.vue';
    import HistoryOrders from '@/components/HistoryOrders.vue';

    export default {
        name: "Bills",

        components: {
            ApplyPanel,
            ApplyFiftyPanel,
            ApplyHalfPanel,
            ApplyHalfWholePanel,
            ApplyThirtyPanel,
            ApplyThirtyWholePanel,
            TodayOrders,
            PlaceOrder,
            TaskOrder,
            HistoryOrders
        },


        data() {
            return {
                depList: [],
                // 注意：gbDepList 已不再使用（模板中只使用 depList 和 gbBatchArr）
                gbBatchArr: [],
                isactive: 0,
                issubactive: -1,
                isactivepb: -1,
                disId: null,
                resFatherId: -1,
                gbBatchId: -1,
                gbDisId: "",
                subAmount: 0,
                gbDepFatherId: "",
                gbDepId: "",
                gbDepName: "",
                nxDepFatherId: "",
                nxDepId: "",
                depName: "",
                depPrintName: "",
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
                customerSearchKeyword: '', // 客户搜索关键词
                isCustomerListBottom: false, // 客户列表是否滚动到底部

                // 新增：客户历史订单相关
                allCustomerTabIndex: 0, // 全部客户视图的标签页索引：0=今日订单, 1=下单, 2=历史订单
                todayOrderList: [], // 今日已保存的订单列表（无子部门）
                todayOrderDepArr: [], // 今日已保存的订单列表（有子部门）
                todayOrderTotal: 0, // 今日订单个数

                // 客户文件夹路径相关
                customerFolderPath: null, // 客户文件夹路径
                selectingFolder: false, // 是否正在选择文件夹

                // 新增：自动刷新相关
                autoRefreshInterval: null, // 自动刷新定时器ID

                // 新增：弹窗相关
                showOrderModal: false, // 控制订单详情弹窗显示
                selectedBillId: null, // 选中的账单ID
                selectedBillDepPrintName: '', // 选中账单的打印组件名称
                selectedBillDepName: '', // 选中账单的部门名称
                selectedBillDepFatherId: null, // 选中账单的部门父ID
                billDetailData: null, // 账单详情数据

                // 今日任务列表（disGetTaskList）
                taskList: [],
                taskListLoading: false,
                selectedTask: null,
                taskCount: 0,
            }
        },

        created() {
            // 获取 URL 中的 query 参数 disId---
            this.disId = this.$route.query.disId;
            this.disName = this.$route.query.disName;

            console.log('获取到的 disId:====', this.disId, this.disName);
        },
        computed: {
            // 根据打印组件名称返回对应的组件
            currentPrintComponent() {
                const componentMap = {
                    'ApplyPanel': 'ApplyPanel',
                    'ApplyFiftyPanel': 'ApplyFiftyPanel',
                    'ApplyHalfPanel': 'ApplyHalfPanel',
                    'ApplyHalfWholePanel': 'ApplyHalfWholePanel',
                    'ApplyThirtyWholePanel': 'ApplyThirtyWholePanel',
                    'ApplyThirtyPanel': 'ApplyThirtyPanel'
                };
                return componentMap[this.selectedBillDepPrintName] || null;
            },
            // 当前打印组件的ref名称
            currentPrintComponentRef() {
                const refMap = {
                    'ApplyPanel': 'applyPanelRef',
                    'ApplyFiftyPanel': 'applyFiftyPanelRef',
                    'ApplyHalfPanel': 'applyHalfPanelRef',
                    'ApplyHalfWholePanel': 'applyHalfWholePanelRef',
                    'ApplyThirtyWholePanel': 'applyThirtyWholePanelRef',
                    'ApplyThirtyPanel': 'applyThirtyPanelRef'
                };
                return refMap[this.selectedBillDepPrintName] || 'printComponentRef';
            },
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
            // 注意：processedFiles, pendingFiles, filteredOrderItems 已移到 PlaceOrder 组件中
            disUser() {
                return this.$store.state.disUser;
            },


            // 过滤后的现金客户列表
            filteredCashCustomers() {
                if (!this.customerSearchKeyword || this.customerSearchKeyword.trim() === '') {
                    return this.myCustomerArrOne;
                }
                const keyword = this.customerSearchKeyword.trim().toLowerCase();
                return this.myCustomerArrOne.filter(customer => {
                    const name = customer.nxDepartmentAttrName || customer.nxDepartmentName || '';
                    return name.toLowerCase().includes(keyword);
                });
            },
            // 过滤后的记账客户列表
            filteredCreditCustomers() {
                if (!this.customerSearchKeyword || this.customerSearchKeyword.trim() === '') {
                    return this.myCustomerArrTwo;
                }
                const keyword = this.customerSearchKeyword.trim().toLowerCase();
                return this.myCustomerArrTwo.filter(customer => {
                    const name = customer.nxDepartmentAttrName || customer.nxDepartmentName || '';
                    return name.toLowerCase().includes(keyword);
                });
            },

        },

        watch: {
            disUser: {
                handler(newVal, oldVal) {
                    console.log('disUser发生变化:', newVal);
                    if (newVal && newVal.nxDiuDistributerId) {
                        console.log('disUser已设置，nxDiuDistributerId:', newVal.nxDiuDistributerId);
                        // 如果disUser从null变为有值，且当前视图是订单视图，则获取客户列表
                        if (!oldVal && newVal && this.currentView === 'order') {
                            this.fetchCustomerList();
                        }
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

            // 只有在disUser存在时才调用fetchCustomerList
            if (this.disUser && this.disUser.nxDiuDistributerId) {
                this.fetchCustomerList();
            } else {
                console.warn('mounted时disUser未初始化，等待disUser设置后再获取客户列表');
            }

            // 监听来自主进程的 'refresh-customer-list' 消息
            if (window.electronAPI && window.electronAPI.onRefreshCustomerList) {
                console.log("billlvueeieieieieijiantongdaoo----------")
                window.electronAPI.onRefreshCustomerList(() => {
                    this.fetchCustomerList();
                });
            }

        },

        methods: {
            // 处理客户搜索
            handleCustomerSearch() {
                // 当有搜索关键词时，自动展开所有客户类型以便查看结果
                if (this.customerSearchKeyword && this.customerSearchKeyword.trim() !== '') {
                    this.collapsedCustomerTypes.cash = false;
                    this.collapsedCustomerTypes.credit = false;
                }
            },
            // 清除客户搜索
            clearCustomerSearch() {
                this.customerSearchKeyword = '';
            },
            // 切换客户类型折叠状态
            toggleCustomerType(type) {
                if (type === 'cash') {
                    this.collapsedCustomerTypes.cash = !this.collapsedCustomerTypes.cash;
                } else if (type === 'credit') {
                    this.collapsedCustomerTypes.credit = !this.collapsedCustomerTypes.credit;
                }
            },

            // 处理客户列表滚动事件
            handleCustomerListScroll(event) {
                const element = event.target;
                // 判断是否滚动到底部（允许5px的误差）
                const isBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 5;
                this.isCustomerListBottom = isBottom;
            },

            // 切换到未打印订单客户视图并刷新数据
            switchToOrderCustomers() {
                console.log("switchToOrderCustomersswitchToOrderCustomers")
                this.currentView = 'order';
                this.selectedAllCustomer = null;
                this.selectedCustomerName = '';
                
                // 检查disUser是否存在，如果不存在则尝试从 localStorage 恢复
                if (!this.disUser || !this.disUser.nxDiuDistributerId) {
                    console.warn('切换视图时disUser未初始化，尝试从 localStorage 恢复');
                    
                    // 尝试从 localStorage 恢复
                    try {
                        const disUserStr = localStorage.getItem('disUser');
                        if (disUserStr) {
                            const restoredDisUser = JSON.parse(disUserStr);
                            if (restoredDisUser && restoredDisUser.nxDiuDistributerId) {
                                console.log('从 localStorage 恢复 disUser 成功');
                                this.$store.commit('SET_DISUSER', restoredDisUser);
                                // 恢复后继续执行
                            } else {
                                console.error('从 localStorage 恢复的 disUser 无效');
                                // 如果恢复失败，跳转到登录页
                                if (this.$route.name !== 'Screen') {
                                    this.$router.push({ name: 'Screen' });
                                }
                                return;
                            }
                        } else {
                            console.error('localStorage 中也没有 disUser，跳转到登录页');
                            // 如果 localStorage 也没有，跳转到登录页
                            if (this.$route.name !== 'Screen') {
                                this.$router.push({ name: 'Screen' });
                            }
                            return;
                        }
                    } catch (error) {
                        console.error('恢复 disUser 失败:', error);
                        // 恢复失败，跳转到登录页
                        if (this.$route.name !== 'Screen') {
                            this.$router.push({ name: 'Screen' });
                        }
                        return;
                    }
                }
                
                // 刷新客户列表数据
                this.fetchCustomerList();
            },

            // 切换到全部客户列表视图
            switchToAllCustomers() {
                this.currentView = 'all';
                this.initAllCustomers();
            },

            // 切换到今日任务视图并拉取任务列表
            async switchToTaskList() {
                this.currentView = 'task';
                this.selectedTask = null;
                const disId = this.disId || (this.disUser && this.disUser.nxDiuDistributerId);
                if (!disId) {
                    alert('请先登录或选择配送商');
                    return;
                }
                this.taskListLoading = true;
                this.taskList = [];
                try {
                    const res = await api.getDisTaskFatherDepartmentList(disId);
                    const data = res && res.data;
                    // 打印完整响应，便于核对后端返回结构（code、data/list 等）
                    console.log('[Bills] switchToTaskList API 原始响应', {
                        hasData: !!data,
                        code: data?.code,
                        keys: data ? Object.keys(data) : [],
                        dataLength: Array.isArray(data?.data) ? data.data.length : '-',
                        listLength: Array.isArray(data?.list) ? data.list.length : '-',
                        firstItem: (data?.data || data?.list)?.[0]
                    });
                    const list = (data && (data.code === 0 || data.code === 200))
                        ? (data.data || data.list || data.result || [])
                        : [];
                    this.taskList = Array.isArray(list) ? list : [];
                    if (this.taskList.length > 0) {
                        this.selectedTask = this.taskList[0];
                        this.taskCount = this.taskList.length;
                        console.log('[Bills] switchToTaskList 默认选中第一个客户', {
                            taskListLength: this.taskList.length,
                            nxDepartmentId: this.selectedTask?.nxDepartmentId,
                            departmentName: this.selectedTask?.nxDepartmentName ?? this.selectedTask?.nxDepartmentAttrName
                        });
                    } else {
                        this.taskCount = 0;
                        console.log('[Bills] switchToTaskList 任务客户列表为空，未设置 selectedTask');
                    }
                } catch (e) {
                    console.error('[Bills] getDisTaskFatherDepartmentList failed:', e);
                    alert('获取今日任务客户列表失败：' + (e.message || '请稍后重试'));
                } finally {
                    this.taskListLoading = false;
                }
            },

            selectTask(dep) {
                this.selectedTask = dep;
                // 切换任务客户时立即清除 TaskOrder 的任务状态和轮询
                if (this.$refs.taskOrderRef && typeof this.$refs.taskOrderRef.clearTaskStatusOnCustomerChange === 'function') {
                    this.$refs.taskOrderRef.clearTaskStatusOnCustomerChange();
                }
            },

            // TaskOrder 删除任务后刷新左侧今日任务客户列表（task-added 时无论当前 tab 都刷新，切换时数据已就绪）
            async refreshTaskCustomerList() {
                const disId = this.disId || (this.disUser && this.disUser.nxDiuDistributerId);
                if (!disId) return;
                this.taskListLoading = true;
                try {
                    const res = await api.getDisTaskFatherDepartmentList(disId);
                    const data = res && res.data;
                    if (data && (data.code === 0 || data.code === 200)) {
                        const list = data.data || data.list || [];
                        this.taskList = Array.isArray(list) ? list : [];
                        const currentId = this.selectedTask && this.selectedTask.nxDepartmentId;
                        const stillInList = this.taskList.find(d => d.nxDepartmentId === currentId);
                        if (!stillInList) {
                            this.selectedTask = this.taskList.length > 0 ? this.taskList[0] : null;
                        }
                    }
                } catch (e) {
                    console.error('[Bills] refreshTaskCustomerList failed:', e);
                } finally {
                    this.taskListLoading = false;
                }
            },

            // 今日任务左侧列表：父级部门（客户）展示文案
            taskDepartmentLabel(dep) {
                return dep.nxDepartmentAttrName;
            },

            // 切换全部客户视图的标签页
            switchAllCustomerTab(index) {
                // 停止所有正在进行的朗读
                if (this.$refs.placeOrderRef && typeof this.$refs.placeOrderRef.stopAllReading === 'function') {
                    this.$refs.placeOrderRef.stopAllReading();
                }
                
                this.allCustomerTabIndex = index;

                // 历史订单的加载已经由 HistoryOrders 组件内部通过 watch selectedAllCustomer 自动处理
                if (index === 0 && this.selectedAllCustomer) {
                    // 如果切换到今日订单标签，加载今日订单
                    this.fetchTodayOrders();
                }
            },


            // 获取今日已保存的订单
            async fetchTodayOrders() {
                // 检查disUser是否存在，如果不存在则尝试从 localStorage 恢复
                if (!this.disUser || !this.disUser.nxDiuDistributerId) {
                    console.warn('fetchTodayOrders: disUser不存在，尝试从 localStorage 恢复');
                    
                    // 尝试从 localStorage 恢复
                    try {
                        const disUserStr = localStorage.getItem('disUser');
                        if (disUserStr) {
                            const restoredDisUser = JSON.parse(disUserStr);
                            if (restoredDisUser && restoredDisUser.nxDiuDistributerId) {
                                console.log('从 localStorage 恢复 disUser 成功');
                                this.$store.commit('SET_DISUSER', restoredDisUser);
                                // 恢复后继续执行
                            } else {
                                console.error('从 localStorage 恢复的 disUser 无效');
                                return;
                            }
                        } else {
                            console.error('localStorage 中也没有 disUser');
                            return;
                        }
                    } catch (error) {
                        console.error('恢复 disUser 失败:', error);
                        return;
                    }
                }
                
                if (!this.selectedAllCustomer) {
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

                        console.log('📦 [fetchTodayOrders] API返回的数据结构:', {
                            hasArr: !!orderData.arr,
                            arrLength: orderData.arr?.length || 0,
                            arrFirstItem: orderData.arr?.[0],
                            arrFirstItemKeys: orderData.arr?.[0] ? Object.keys(orderData.arr[0]) : []
                        });

                        // 判断是否有子部门：检查 arr 的第一个元素是否有 depOrders 字段
                        // phoneGetToFillDepOrders 接口：如果有子部门，arr 是部门数组（每个部门有 depOrders）
                        // 如果没有子部门，arr 是订单数组
                        let hasSubs = false;
                        if (orderData.arr && orderData.arr.length > 0) {
                            const firstItem = orderData.arr[0];
                            // 如果有 depOrders 或 depName 字段，说明是子部门结构
                            hasSubs = firstItem.hasOwnProperty('depOrders') || firstItem.hasOwnProperty('depName');
                            console.log('🔍 [fetchTodayOrders] 检测子部门结构:', {
                                hasSubs,
                                firstItemKeys: Object.keys(firstItem),
                                hasDepOrders: firstItem.hasOwnProperty('depOrders'),
                                hasDepName: firstItem.hasOwnProperty('depName')
                            });
                        }

                        // 今日订单标签页：总是显示全部部门的订单
                        // 如果有子部门，按部门显示（使用 todayOrderDepArr）
                        // 如果没有子部门，使用 todayOrderList
                        if (hasSubs) {
                            // 有子部门的情况：显示所有部门的订单
                            // 确保每个部门都有 depOrders 属性，避免 Vue 渲染错误
                            this.todayOrderDepArr = (orderData.arr || []).map(dep => ({
                                ...dep,
                                depOrders: dep.depOrders || []
                            }));
                            this.todayOrderList = [];
                            console.log('✅ [fetchTodayOrders] 多部门模式，显示所有部门的订单');
                            console.log('📊 [fetchTodayOrders] 部门数量:', this.todayOrderDepArr.length);
                            this.todayOrderDepArr.forEach((dep, index) => {
                                console.log(`  📁 部门 ${index + 1}: "${dep.depName}", 订单数: ${dep.depOrders?.length || 0}`);
                            });
                        } else {
                            // 无子部门的情况：使用订单列表
                            this.todayOrderList = orderData.arr || [];
                            this.todayOrderDepArr = [];
                            console.log('✅ [fetchTodayOrders] 单部门模式，显示订单列表');
                            console.log('📊 [fetchTodayOrders] 订单数量:', this.todayOrderList.length);
                        }

                        // 今日订单个数（订单数，非金额）
                        if (hasSubs) {
                            this.todayOrderTotal = (this.todayOrderDepArr || []).reduce((sum, dep) => sum + (dep.depOrders?.length || 0), 0);
                        } else {
                            this.todayOrderTotal = (this.todayOrderList || []).length;
                        }

                        console.log('✅ [fetchTodayOrders] 成功获取今日订单数据:', {
                            hasSubs,
                            listLength: this.todayOrderList.length,
                            depArrLength: this.todayOrderDepArr.length,
                            total: this.todayOrderTotal
                        });
                    } else {
                        console.error('获取今日订单失败:', res);
                        this.todayOrderList = [];
                        this.todayOrderDepArr = [];
                        this.todayOrderTotal = 0;
                    }
                } catch (error) {
                    console.error('获取今日订单API请求失败:', error);
                    this.todayOrderList = [];
                    this.todayOrderDepArr = [];
                    this.todayOrderTotal = 0;
                }
            },



            // 处理任务添加成功事件（从 PlaceOrder 发出：图片识别、粘贴/Excel粘贴保存）
            handleTaskAdded() {
                this.refreshTaskCustomerList(); // getDisTaskFatherDepartmentList 今日任务
                this.initAllCustomers({ skipAutoSelect: true }); // 仅刷新客户列表，不切换选中客户，避免任务数据被清空
            },

            // 处理订单保存成功事件（从 PlaceOrder 组件发出）
            handleOrderSaved(payload) {
                // 图片模式保存后已刷新任务列表，跳过多余的客户列表接口（webNxDisGetTodayOrderCustomer）
                if (payload && payload.skipCustomerRefresh === true) {
                    return;
                }
                console.log('订单保存成功，刷新客户列表');
                this.fetchCustomerList();
            },

            // 配送单视图内保存成功：只刷新任务列表和客户列表，不切换视图、不清空选中客户
            handleOrderSavedFromPrintView() {
                console.log('订单保存成功（配送单视图），刷新任务列表与客户列表');
                this.refreshTaskCustomerList();
                this.fetchCustomerList();
            },

            // 处理子部门选择改变
            // 注意：所有下单相关的逻辑已移到 PlaceOrder 组件中，这里只需要处理今日订单的刷新
            handleSubDepartmentChange() {
                console.log('子部门选择改变:', this.selectedSubDepartment);

                // 如果当前在今日订单标签，重新加载今日订单
                if (this.allCustomerTabIndex === 0) {
                    this.fetchTodayOrders();
                }
            },

            // 初始化全部客户列表
            // options.skipAutoSelect: 为 true 时仅刷新列表，不调用 autoSelectFirstCustomer（避免 task-added 时切换客户导致任务数据被清空）
            async initAllCustomers(options = {}) {
                try {
                    // 检查disUser是否存在，如果不存在则尝试从 localStorage 恢复
                    if (!this.disUser || !this.disUser.nxDiuDistributerId) {
                        console.warn('disUser或nxDiuDistributerId不存在，尝试从 localStorage 恢复:', this.disUser);
                        
                        // 尝试从 localStorage 恢复
                        try {
                            const disUserStr = localStorage.getItem('disUser');
                            if (disUserStr) {
                                const restoredDisUser = JSON.parse(disUserStr);
                                if (restoredDisUser && restoredDisUser.nxDiuDistributerId) {
                                    console.log('从 localStorage 恢复 disUser 成功');
                                    this.$store.commit('SET_DISUSER', restoredDisUser);
                                    // 恢复后继续执行
                                } else {
                                    console.error('从 localStorage 恢复的 disUser 无效');
                                    return;
                                }
                            } else {
                                console.error('localStorage 中也没有 disUser，无法继续');
                                // 如果 localStorage 也没有，可能需要重新登录
                                if (this.$route.name !== 'Screen') {
                                    this.$router.push({ name: 'Screen' });
                                }
                                return;
                            }
                        } catch (error) {
                            console.error('恢复 disUser 失败:', error);
                            return;
                        }
                    }

                    console.log('开始获取全部客户，disId:', this.disUser.nxDiuDistributerId);
                    const res = await api.disGetAllCustomer(this.disUser.nxDiuDistributerId);

                    if (res && res.data && res.data.code === 0) {
                        this.taskCount = res.data.taskCount;
                        this.myCustomerArrOne = res.data.data.settleTypeOne || [];
                        this.myCustomerArrTwo = res.data.data.settleTypeTwo || [];
                        console.log('获取全部客户成功:', res.data.data);
                        
                        // 打印客户ID列表用于调试
                        console.log('📋 [Bills] 现金客户ID列表:', this.myCustomerArrOne.map(c => ({
                            id: c.nxDepartmentId,
                            name: c.nxDepartmentAttrName
                        })));
                        console.log('📋 [Bills] 记账客户ID列表:', this.myCustomerArrTwo.map(c => ({
                            id: c.nxDepartmentId,
                            name: c.nxDepartmentAttrName
                        })));

                        // 非 skipAutoSelect 时才自动选择第一个客户（task-added 刷新时不应切换客户）
                        if (!options.skipAutoSelect) {
                            this.autoSelectFirstCustomer();
                        }
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

                // 停止所有正在进行的朗读
                if (this.$refs.placeOrderRef && typeof this.$refs.placeOrderRef.stopAllReading === 'function') {
                    this.$refs.placeOrderRef.stopAllReading();
                }
                // 切换部门时立即清除任务状态和轮询，避免「后台处理中」蒙版残留
                if (this.$refs.placeOrderRef && typeof this.$refs.placeOrderRef.clearTaskStatusOnCustomerChange === 'function') {
                    this.$refs.placeOrderRef.clearTaskStatusOnCustomerChange();
                }

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

                try {
                    // 使用 nextTick 确保组件更新完成后再设置，避免组件为 null 时的错误
                    await this.$nextTick();
                    
                    // 设置客户信息（使用 try-catch 包裹，避免响应式更新时的错误）
                    this.selectedAllCustomer = customerId;
                    console.log('✅ [selectAllCustomer] 已设置 selectedAllCustomer:', this.selectedAllCustomer, '类型:', typeof this.selectedAllCustomer);
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

                    // 再次使用 nextTick 确保所有响应式更新完成
                    await this.$nextTick();
                    
                    // 额外等待一小段时间，确保所有组件更新完成
                    await new Promise(resolve => setTimeout(resolve, 50));
                } catch (error) {
                    console.error('❌ [selectAllCustomer] 设置客户信息时出错:', error);
                    // 即使出错，也继续执行后续操作
                }

                // 加载客户文件夹路径
                this.loadCustomerFolderPath();

                // 历史订单的加载已经由 HistoryOrders 组件内部通过 watch selectedAllCustomer 自动处理
                // 如果在今日订单标签，加载今日订单
                if (this.allCustomerTabIndex === 0) {
                    this.fetchTodayOrders();
                }
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
                        console.error('❌ 获取订单详情失败:', res);
                        console.error('❌ 响应数据结构:', res?.data);
                    }
                } catch (error) {
                    console.error('❌ 获取订单详情API请求失败:', error);
                    console.error('❌ 错误详情:', error.message);
                    console.error('❌ 错误堆栈:', error.stack);
                } finally {
                    console.log('=== loadBillDetail 结束 ===');
                }
            },


            fetchCustomerList() {
                // 检查disUser是否存在，如果不存在则尝试从 localStorage 恢复
                console.log("fetchCustomerListfetchCustomerList")
                if (!this.disUser || !this.disUser.nxDiuDistributerId) {
                    console.warn('fetchCustomerList: disUser或nxDiuDistributerId不存在，尝试从 localStorage 恢复:', this.disUser);
                    
                    // 尝试从 localStorage 恢复
                    try {
                        const disUserStr = localStorage.getItem('disUser');
                        if (disUserStr) {
                            const restoredDisUser = JSON.parse(disUserStr);
                            if (restoredDisUser && restoredDisUser.nxDiuDistributerId) {
                                console.log('从 localStorage 恢复 disUser 成功');
                                this.$store.commit('SET_DISUSER', restoredDisUser);
                                // 恢复后继续执行
                            } else {
                                console.error('从 localStorage 恢复的 disUser 无效');
                                return;
                            }
                        } else {
                            console.error('localStorage 中也没有 disUser');
                            return;
                        }
                    } catch (error) {
                        console.error('恢复 disUser 失败:', error);
                        return;
                    }
                }

                // 请求配送单客户列表
                const _disId = this.disUser.nxDiuDistributerId;
                api.webNxDisGetTodayOrderCustomer(_disId).then((res) => {
                    if (res && res.data) {
                        console.log("收到的数据:", res.data);
                        this.isactive = 0;
                        this.issubactive = -1;
                        this.depList = res.data.data.nxArr || [];
                        this.gbBatchArr = res.data.data.gbBatchArr || [];
                        this.taskCount = res.data.taskCount;

                        if ((res.data.data.nxArr || []).length > 0) {
                            const firstCustomer = res.data.data.nxArr[0];
                            this.onclick(0, firstCustomer.nxDepartmentId, firstCustomer.nxDepartmentId,
                                        firstCustomer.nxDepartmentAttrName || firstCustomer.nxDepartmentName,
                                        '',
                                        firstCustomer.nxDepartmentPrintName || 'ApplyPanel',
                                        0);
                        } else {
                            this.nxDepFatherId = -1;
                            this.nxDepId = -1;
                            this.depName = "";
                            this.depPrintName = "";

                            const gbArr = res.data.data.gbArr || [];
                            const gbBatchArr = res.data.data.gbBatchArr || [];
                            if (gbArr.length > 0) {
                                this.gbDepFatherId = gbArr[0].gbDepartmentId;
                                this.gbDepId = gbArr[0].gbDepartmentId;
                                this.gbDisId = gbArr[0].gbDepartmentDisId;
                                this.depName = gbArr[0].gbDepartmentName;
                                this.depPrintName = gbArr[0].gbDepartmentPrintName;
                                this.updateTime = new Date().getMilliseconds();
                                this.nxDepFatherId = -1;
                                this.nxDepId = -1;
                                this.isactivepb = -1;
                            } else if (gbBatchArr.length > 0) {
                                this.nxDepFatherId = -1;
                                this.nxDepId = -1;
                                this.gbDepFatherId = -1;
                                this.gbDepId = -1;
                                this.gbDisId = -1;
                                this.isactive = -1;
                                this.isactivepb = 0;
                                this.gbBatchId = gbBatchArr[0].gbDistributerPurchaseBatchId;
                                this.depName = gbBatchArr[0].gbDistributerEntity.gbDistributerName;
                                this.depPrintName = gbBatchArr[0].gbDistributerEntity.gbDistributerPrintName;
                                this.updateTime = new Date().getMilliseconds();
                            } else {
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
                    } else {
                        console.error("API 返回的数据格式不正确:", res);
                    }
                }).catch((err) => {
                    console.error("fetchCustomerList 请求失败:", err);
                    this.depList = this.depList || [];
                    this.gbBatchArr = this.gbBatchArr || [];
                    this.isactive = 0;
                    this.issubactive = -1;
                });
            },


            // 处理 'print-only' 事件，如果需要
            handlePrintOnly() {
                // 如果 'print-only' 也需要刷新客户列表，可以调用 fetchCustomerList
                // 如果不需要，可以忽略或执行其他逻辑
                this.fetchCustomerList();
            },

            onclickPb(index, gbBatchId, depPrintName) {
                console.log("onclickPbonclickPbonclickPb", gbBatchId, depPrintName);
                
                // 检查打印组件是否存在，如果不存在则使用默认组件
                const validComponents = ['ApplyPanel', 'ApplyFiftyPanel', 'ApplyHalfPanel', 'ApplyHalfWholePanel', 
                                        'ApplyThirtyPanel', 'ApplyThirtyWholePanel'];
                const finalDepPrintName = depPrintName && validComponents.includes(depPrintName) 
                    ? depPrintName 
                    : 'ApplyPanel'; // 默认使用 ApplyPanel
                
                if (depPrintName !== finalDepPrintName) {
                    console.warn(`打印组件 "${depPrintName}" 不存在，使用默认组件 "ApplyPanel"`);
                }
                
                this.isactivepb = index;
                this.isactive = -1;
                this.issubactive = -1;
                this.gbDepFatherId = -1;
                this.gbDepId = -1,
                    this.nxDepFatherId = -1;
                this.nxDepId = -1,
                    this.gbBatchId = gbBatchId;
                this.depPrintName = finalDepPrintName;
                this.subAmount = 0;
                this.updateTime = new Date().getMilliseconds();

            },
            onclick(index, nxDepFatherId, nxDeId, depName, subDepName, depPrintName, subAmount) {
                console.log("depPrintName==", depPrintName);

                // 检查打印组件是否存在，如果不存在则使用默认组件
                const validComponents = ['ApplyPanel', 'ApplyFiftyPanel', 'ApplyHalfPanel', 'ApplyHalfWholePanel', 
                                        'ApplyThirtyPanel', 'ApplyThirtyWholePanel'];
                const finalDepPrintName = depPrintName && validComponents.includes(depPrintName) 
                    ? depPrintName 
                    : 'ApplyPanel'; // 默认使用 ApplyPanel
                
                if (depPrintName !== finalDepPrintName) {
                    console.warn(`打印组件 "${depPrintName}" 不存在，使用默认组件 "ApplyPanel"`);
                }

                this.isactive = index;
                this.issubactive = -1;
                this.isactivepb = -1;
                this.gbBatchId = -1;
                this.gbDepFatherId = -1; // 选择普通订单时，设置 gbDepFatherId 为 -1
                this.gbDepId = -1; // 选择普通订单时，设置 gbDepId 为 -1
                this.nxDepFatherId = nxDepFatherId;
                this.nxDepId = nxDeId,
                    this.depName = depName + subDepName;
                this.depPrintName = finalDepPrintName;
                this.subAmount = 0;
                this.updateTime = new Date().getMilliseconds();
            },


            // 注意：onclickGb 方法已不再使用（模板中未引用）


            childClick(index, subIndex, nxDepFatherId, nxDeId, depName, subDepName, depPrintName, event, subAmount) {
                // 阻止事件冒泡，防止触发父部门的点击事件
                event.stopPropagation();

                // 更新子部门的选中状态
                this.isactive = index;
                this.issubactive = subIndex;
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

            },


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
                            // 刷新 PlaceOrder 组件的文件夹路径状态（刷新"转订单"标签页下的按钮状态）
                            if (this.$refs.placeOrderRef && typeof this.$refs.placeOrderRef.loadCustomerFolderPath === 'function') {
                                this.$refs.placeOrderRef.loadCustomerFolderPath();
                            }
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
                            alert('已清除文件夹路径');
                            // 刷新 PlaceOrder 组件的文件夹路径状态（刷新"转订单"标签页下的按钮状态）
                            if (this.$refs.placeOrderRef && typeof this.$refs.placeOrderRef.loadCustomerFolderPath === 'function') {
                                this.$refs.placeOrderRef.loadCustomerFolderPath();
                            }
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
                    }
                } catch (error) {
                    console.error('加载文件夹路径失败:', error);
                }
            },


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
        display: flex;
        flex-direction: column;
        flex: 0 0 auto; /* 按照实际内容高度显示，不平均分配空间 */
        min-height: auto;
    }

    /* 未展开的客户类型不占用 flex 空间，只占用 header 高度 */
    .customer-type-section.collapsed {
        flex: 0 0 auto;
        min-height: auto;
    }

    .customer-type-section h6,
    .customer-type-header {
        margin-bottom: 10px;
        padding: 8px;
        border-radius: 5px;
        background-color: #f8f9fa;
        transition: background-color 0.2s ease;
        flex-shrink: 0; /* 防止 header 被压缩 */
    }

    .customer-type-header:hover {
        background-color: #e9ecef;
    }

    /* 客户列表 - 移除独立滚动，使用外层统一滚动容器 */
    .customer-type-section .nav-pills {
        flex: 0 0 auto; /* 按照实际内容高度显示 */
        min-height: 0;
        overflow: visible; /* 移除独立滚动，使用外层滚动 */
    }

    /* 客户列表滚动条样式 - 应用到外层容器 */
    .customer-list-body::-webkit-scrollbar {
        width: 8px;
    }

    .customer-list-body::-webkit-scrollbar-track {
        background: #f7fafc;
        border-radius: 4px;
    }

    .customer-list-body::-webkit-scrollbar-thumb {
        background: #cbd5e0;
        border-radius: 4px;
    }

    .customer-list-body::-webkit-scrollbar-thumb:hover {
        background: #a0aec0;
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
        border: 1px solid #86b7fe !important;
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
    }

    /* 下单按钮的包装器样式（选中时淡蓝色边框） */
    .nav-link-active-wrapper {
        border: 1px solid #86b7fe !important;
        border-bottom-color: #fff !important;
        background-color: #fff;
    }

    /* 侧边栏和内容区域的整体布局 */
    .bills-container {
        display: flex;
        flex-direction: column;
        height: 100vh;
        overflow: hidden;
    }

    .bill-body {
        padding: 15px; /* 减少 padding，让空间更紧凑 */
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

    /* 客户搜索框样式 */
    .customer-search-box {
        padding: 10px 15px;
        background-color: #f8f9fa;
        border-bottom: 1px solid #dee2e6;
    }

    .customer-search-box .input-group {
        width: 100%;
    }

    .customer-search-box .input-group-text {
        background-color: #fff;
        border-right: none;
    }

    .customer-search-box .form-control {
        border-left: none;
    }

    .customer-search-box .form-control:focus {
        border-color: #ced4da;
        box-shadow: none;
    }

    .customer-search-box .btn {
        border-left: none;
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
        overflow-y: auto;
        overflow-x: hidden;
        padding-bottom: 30px; /* 底部留白 */
        /* 滚动条样式 */
        scrollbar-width: thin;
        scrollbar-color: #cbd5e0 #f7fafc;
    }

    /* 到底了提示样式 */
    .customer-list-bottom-tip {
        text-align: center;
        padding: 15px;
        color: #6c757d;
        font-size: 14px;
        margin-top: 10px;
        flex-shrink: 0;
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

    .nav-pills .tab-item .tab-item-sub {
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
        background-color: #590381; /* 父类选中的背景色 */
        color: white;
    }

    /* 主内容区域样式 */
    .col-md-10,
    .main-content-container {
        padding-left: 15px; /* 减少左右 padding */
        padding-right: 15px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        border-radius: 10px;
        background-color: #fff;
    }

    /* 客户视图 - 让内容区域充分利用空间 */
    .main-content-container > div {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .main-content-container .card {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        padding: 1rem !important; /* 减少 padding */
    }

    .main-content-container .tab-content {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        overflow: hidden;
    }

    .main-content-container .tab-pane {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        overflow: hidden;
    }

    /* 减少客户信息行的 padding */
    .main-content-container .card .border-bottom {
        margin-bottom: 0.75rem !important;
        padding-bottom: 0.75rem !important;
    }

    /* 减少标签页的 margin */
    .main-content-container .nav-tabs {
        margin-bottom: 0.75rem !important;
    }

    /* 让子组件充分利用空间 */
    .main-content-container .tab-pane > div {
        height: 100% !important;
        flex: 1 !important;
        min-height: 0 !important;
    }

    /* 覆盖 TodayOrders 和 PlaceOrder 的固定高度 */
    .main-content-container .tab-pane [style*="calc(100vh"] {
        height: 100% !important;
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


    .modal-body {
        padding: 20px;
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

</style>