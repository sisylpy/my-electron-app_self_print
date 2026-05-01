<template>

    <div class="applyBodyPage " style="position: relative;">
        <!-- 打印蒙版 -->
        <div v-if="isPrinting1" class="printing-overlay">
            <div class="printing-content">
                <div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;">
                    <span class="visually-hidden">打印中...</span>
                </div>
                <div class="text-white fw-bold" style="font-size: 18px;">正在打印，请稍候...</div>
                <div class="text-white mt-2" style="font-size: 14px;">打印完成后将自动保存</div>
            </div>
        </div>



        <div class=" card  shadow-lg p-20" style="min-height: 500px;">
            <!-- 页头 -->
            <div class="headerPage" >
                <div class="header-content">
                    <!-- 溯源类型布局（3行） -->
                    <template v-if="isTraceabilityType">
                        <div class="leftPage" @click="handleHeaderClick">
                            <div class="item">单位: {{ depName }}</div>
                            <div class="item">时间: {{ displayDate }}</div>
                            <div class="item">共{{ totalPages }}页 - 第{{ pagesIndex }}页</div>
                        </div>
                        <div class="centerPage" @click="handleHeaderClick">
                            <div class="title">{{ disInfo.nxDistributerName }}</div>
                        </div>
                        <div class="rightPage" @click="handleHeaderClick">
                            <div class="item" v-if="qrCodeUrl" style="text-align: right; height: 75px; display: flex; align-items: center; justify-content: flex-end;">
                                <img :src="qrCodeUrl" alt="订单二维码" style="width: 75px; height: 75px; display: block; image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges; object-fit: contain;" />
                            </div>
                        </div>
                    </template>
                    
                    <!-- 普通类型布局（2行） -->
                    <template v-else>
                        <div class="leftPage" @click="handleHeaderClick">
                            <div class="item">单位: {{ depName }}</div>
                            <div class="item">时间: {{ displayDate }}</div>
                        </div>
                        <div class="centerPage" @click="handleHeaderClick">
                            <div class="title">{{ disInfo.nxDistributerName }} 送货单</div>
                        </div>

                        <div class="rightPage" @click="handleHeaderClick">
                            <div class="item">共{{ totalPages }}页 - 第{{ pagesIndex }}页</div>
                            <div class="item">单号: {{ tradeNo }}</div>
                        </div>
                    </template>
                </div>
            </div>

            <!-- 打印校准面板组件 -->
            <PrintCalibrationPanel
                :visible="showCalibrationPanel"
                :current-left-margin.sync="currentLeftMargin"
                :distributor-name-font-size.sync="distributorNameFontSize"
                :order-content-font-size.sync="orderContentFontSize"
                @print-calibration-page="printCalibrationPage"
                @close="showCalibrationPanel = false"
                @saved="handleProfileSaved"
            />

            <!-- 订单内容部分 - 双列布局 -->
            <div class="content-bill">
                    <!-- 外层容器：左右各占50% -->
                    <div class="whole-column-container" >
                        <!-- 左列表头 -->
                        <div class="table-header">
                            <div class="ten">序号</div>
                            <div class="thirty">商品</div>
                            <div class="fifteen">规格</div>
                            <div class="ten">单位</div>
                            <div class="ten">数量</div>
                            <div class="ten">单价</div>
                            <div class="fifteen">小计</div>
                        </div>

                        <!-- 左列数据 -->
                        <div class="table-row" v-for="(item, index) in currentPageData.dualRows"
                             :key="'left-' + index">
                            <div class="ten">{{ (pagesIndex - 1) * pageRowsCount + index + 1 }}</div>
                            <div class="thirty">{{ item.nxDistributerGoodsEntity?.nxDgGoodsName }}</div>
                            <div class="fifteen">
                                <template v-if="item.nxDistributerGoodsEntity?.nxDgItemsPerCarton != null">
                                    {{ item.nxDistributerGoodsEntity?.nxDgGoodsStandardWeight }} * {{ item.nxDistributerGoodsEntity?.nxDgItemsPerCarton }}{{ item.nxDistributerGoodsEntity?.nxDgGoodsStandardname }}
                                </template>
                            </div>
                            <div class="ten">{{ item.nxDoPrintStandard }}</div>
                            <div class="ten">{{ item.nxDoWeight }}</div>
                            <div class="ten">{{ item.nxDoPrice }}</div>
                            <div class="fifteen">{{ item.nxDoSubtotal }}</div>
                        </div>
                    </div>
            </div>

            <!-- 合计信息 -->
            <div class="summary pr-10"
                 style="border-bottom: 1px solid #000; border-left: 1px solid #000; border-right: 1px solid #000;">
                <div class="fifty_line">
                    <div class="pl-10">
                        地址: {{ disInfo.nxDistributerAddress }}
                    </div>
                </div>
                <div class="centerPage text-right pr-10">
                    <div>第{{ pagesIndex }}页小计: {{ currentPageData.pageSubtotal }}</div>
                </div>
            </div>

            <!-- 页脚 -->
            <div class="footerPage" v-if="totalPages == pagesIndex">
                <!-- 合计信息 -->
                <div class="summary pr-10">
                    <div class="" style="background-color: red;">
                        <div></div>
                    </div>
                    <div class="text-right pr-10" style="font-size: 18px">
                        <div>{{ subtotalHanzi }} 合计: {{ subtotalFormatted || subtotal }}元</div>
                    </div>
                </div>

            </div>

        </div>

        <div class="d-flex justify-content-between p-20">

            <div>
                <ul class="pagination pagination-sm">
                    <li class="page-item">
                        <button class="page-link" @click="changePage(pagesIndex - 1)"
                                :disabled="pagesIndex <= 1">上一页
                        </button>
                    </li>
                    <li class="page-item">
                        <button class="page-link" @click="changePage(pagesIndex + 1)"
                                :disabled="pagesIndex >= totalPages">下一页
                        </button>
                    </li>
                </ul>
            </div>

            <div v-if="gbBatchId !== -1">
                <button class="btn btn-lg btn-primary" @click="printOnly">
                    <i class="fas fa-print"></i> 打印订货单
                </button>
                <!-- <button class="btn btn-lg btn-warning" @click="printTestPage" style="margin-left: 20px;">
                    <i class="fas fa-flask"></i> 测试打印系数
                </button> -->
            </div>

            <div v-else>

                <div v-if="gbDepFatherId == -1">
                 <button class="btn btn-lg btn-secondary" @click="downLoadOnly" v-if="nxDepFatherId == nxDepId ">
                        <i class="fas fa-download"></i> 全部下载
                    </button>
                    <button class="btn btn-lg btn-secondary" v-if="nxDepFatherId !== nxDepId" @click="downLoadOnly">
                        <i class="fas fa-download"></i> 分部门下载
                    </button>


                    <button class="btn btn-lg btn-primary" @click="printOnly" v-if="nxDepFatherId == nxDepId " style="margin-left: 40px;">
                        <i class="fas fa-print"></i> 全部打印
                    </button>
                    <button class="btn btn-lg btn-success" v-if="nxDepFatherId !== nxDepId" @click="printOnly" style="margin-left: 40px;">
                        <i class="fas fa-print"></i> 分部门打印
                    </button>
                    <!-- <button class="btn btn-lg btn-warning" @click="printTestPage" style="margin-left: 20px;">
                        <i class="fas fa-flask"></i> 测试打印系数
                    </button> -->

                </div>
                <div v-if="gbDepFatherId !== -1">
                    <button class="btn btn-lg btn-secondary" @click="downLoadOnly" v-if="gbDepFatherId == gbDepId ">
                        <i class="fas fa-download"></i> 全部下载GB
                    </button>
                    <button class="btn btn-lg btn-secondary" v-if="gbDepFatherId !== gbDepId" @click="downLoadOnly">
                        <i class="fas fa-download"></i> 分部门下载GB
                    </button>


                    <button class="btn btn-lg btn-primary" @click="printOnly" v-if="gbDepFatherId == gbDepId " style="margin-left: 40px;">
                        <i class="fas fa-print"></i> 全部打印GB
                    </button>
                    <button class="btn btn-lg btn-success" v-if="gbDepFatherId !== gbDepId" @click="printOnly" style="margin-left: 40px;">
                        <i class="fas fa-print"></i> 分部门打印GB
                    </button>

                </div>

            </div>



        </div>



        <!-- 打印区域  -->
        <div id="printAreaThirtyWhole" class="print-area" ref="printArea"
             :style="`position: absolute; left: -9999px; top: -9999px; width: ${previewWidth}mm; height: 93mm; box-sizing: border-box;`">
            <div
                    v-for="page in printPagesData"
                    :key="page.pageIndex"
                    class="print-page"
                    :class="{ 'page-break': page.pageIndex < totalPages }"
            >
                <!-- 页头 -->
                <div class="print-header">
                    <div class="print-header-content">
                        <!-- 溯源类型布局（3行） -->
                        <template v-if="isTraceabilityType">
                            <div class="print-left">
                                <div class="print-item">单位: {{ depName }}</div>
                                <div class="print-item">时间: {{ displayDate }}</div>
                                <div class="print-item">共{{ totalPages }}页 - 第{{ page.pageIndex }}页 | 单号: {{ tradeNo }}</div>
                            </div>
                            <div class="print-center">
                                <div class="print-title">{{ disInfo?.nxDistributerName || '配送商' }}</div>
                                <div class="print-item" style="height: 25px;"></div>
                                <div class="print-item" style="height: 25px;"></div>
                            </div>
                            <div class="print-right">
                                <div class="print-item" v-if="qrCodeUrl" style="text-align: right; height: 75px; display: flex; align-items: center; justify-content: flex-end;">
                                    <img :src="qrCodeUrl" alt="订单二维码" style="width: 70px; height: 70px; display: block;" />
                                </div>
                            </div>
                        </template>
                        
                        <!-- 普通类型布局（2行） -->
                        <template v-else>
                            <div class="print-left">
                                <div class="print-item">单位: {{ depName }}</div>
                                <div class="print-item">时间: {{ displayDate }}</div>
                            </div>
                            <div class="print-center">
                                <div class="print-title">{{ disInfo?.nxDistributerName || '配送商' }} 送货单</div>
                            </div>
                            <div class="print-right">
                                <div class="print-item">共{{ totalPages }}页 - 第{{ page.pageIndex }}页</div>
                                <div class="print-item">单号: {{ tradeNo }}</div>
                            </div>
                        </template>
                    </div>
                </div>

                <!-- 表格容器 - 双列布局 -->
                <div class="print-content-bill">
                    <!-- 外层容器：左右各占50% -->
                    <div class="print-fifty-column-container">
                        <!-- 左列表头 -->
                        <div class="print-table-header">
                            <div class="print-col print-ten">序号</div>
                            <div class="print-col print-thirty">商品</div>
                            <div class="print-col print-ten">规格</div>
                            <div class="print-col print-fifteen">单位</div>
                            <div class="print-col print-ten">数量</div>
                            <div class="print-col print-ten">单价</div>
                            <div class="print-col print-fifteen">小计</div>
                        </div>

                        <!-- 左列数据 -->
                        <div
                                v-for="(item, rowIndex) in page.dualRows"
                                :key="'left-' + rowIndex"
                                class="print-table-row"
                        >
                            <div class="print-col print-ten">{{ ((page.pageIndex - 1) * pageRowsCount + rowIndex + 1) }}</div>
                            <div class="print-col print-thirty">{{ item.nxDistributerGoodsEntity?.nxDgGoodsName }}</div>
                            <div class="print-col print-fifteen">
                                <template v-if="item.nxDistributerGoodsEntity?.nxDgItemsPerCarton != null">
                                    {{ item.nxDistributerGoodsEntity?.nxDgGoodsStandardWeight }} * {{ item.nxDistributerGoodsEntity?.nxDgItemsPerCarton }}{{ item.nxDistributerGoodsEntity?.nxDgGoodsStandardname }}
                                </template>
                            </div>
                            <div class="print-col print-ten">{{ item.nxDoPrintStandard }}</div>
                            <div class="print-col print-ten">{{ item.nxDoWeight }}</div>
                            <div class="print-col print-ten">{{ item.nxDoPrice }}</div>
                            <div class="print-col print-fifteen">{{ item.nxDoSubtotal }}</div>
                        </div>
                    </div>


                </div>

                <!-- 小计 -->
                <div class="print-subtotal" v-if="totalPages > 1">
                    第{{ page.pageIndex }}页小计：{{ page.pageSubtotalHanzi }} {{ page.pageSubtotalFormatted ||
                    page.pageSubtotal }}元
                </div>

                <!-- 最后一页显示地址和合计（合并一行） -->
                <div class="print-address-total" v-if="page.isLastPage">
                    <span class="address">地址: {{ disInfo?.nxDistributerAddress || '暂无地址' }}</span>
                    <span class="total">{{ subtotalHanzi }} 合计: {{ subtotalFormatted || subtotal }}元</span>
                </div>

                <!-- 非最后一页只显示地址 -->
                <div class="print-address" v-if="!page.isLastPage">
                    地址: {{ disInfo?.nxDistributerAddress || '暂无地址' }}
                </div>
            </div>
        </div>

        <!-- 打印纸尺寸信息 -->
        <!-- <div class="paper-size-info">
            打印纸尺寸: 241mm x 279mm<br>
            当前打印区域尺寸: {{ printWidth }}px x {{ printHeight }}px
        </div> -->


        <AlertDialog ref="alertDialog" />


    </div>

</template>


<script>
    import api from '@/api/all'
    import {mapState} from 'vuex';
    import QRCode from 'qrcode'
    import PrintCalibrationPanel from '@/components/PrintCalibrationPanel.vue'
    import AlertDialog from '@/components/AlertDialog.vue'
    import { initPrinterProfile, getCurrentPrinterName, loadPrinterProfile, DEFAULT_PROFILE } from '@/utils/printerProfile'

    export default {
        name: "ApplyThirtyWholePanel",
        components: {
            PrintCalibrationPanel,
            AlertDialog
        },
        props: ['nxDepFatherId', 'nxDepId', 'depName', 'depPrintName',
            'updateTime', 'gbDepFatherId', 'gbDepId', 'gbDisId', 'gbBatchId', 'orderData'],
        watch: {
            // 监听字体大小变化，确保CSS变量同步更新
            distributorNameFontSize(newValue) {
                const cssValue = String(newValue) + 'px';
                document.documentElement.style.setProperty('--distributor-name-font-size', cssValue);
                setTimeout(() => {
                    const titleElements = document.querySelectorAll('.title, .print-title');
                    titleElements.forEach(el => {
                        el.style.setProperty('font-size', cssValue, 'important');
                    });
                    this.$forceUpdate();
                }, 10);
            },
            orderContentFontSize(newValue) {
                const cssValue = String(newValue) + 'px';
                document.documentElement.style.setProperty('--order-content-font-size', cssValue);
                setTimeout(() => {
                    const contentElements = document.querySelectorAll('.table-row, .table-header, .print-table-row, .print-table-header, .print-item, .print-address');
                    contentElements.forEach(el => {
                        el.style.setProperty('font-size', cssValue, 'important');
                    });
                    this.$forceUpdate();
                }, 10);
            },
            currentLeftMargin(newValue) {
                document.documentElement.style.setProperty('--safe-left-mm', String(newValue));
            },
        },
        computed: {
            // 统一过滤后的数据源（只保留有小计的行）
            _filteredRows() {
                // 确定数据源
                let dataSource;
                if (this.orderData && this.orderData.arr) {
                    dataSource = this.orderData.arr;
                } else if (this.orderData && this.orderData.nxDepartmentOrdersEntities) {
                    dataSource = this.orderData.nxDepartmentOrdersEntities;
                } else {
                    dataSource = this.applyArrPrint;
                }

                if (!Array.isArray(dataSource)) return [];
                
                return dataSource.filter(
                    it => it && Object.keys(it).length > 0 && it.nxDoSubtotal !== undefined
                );
            },

            // 单一事实来源：总页数
            totalPages() {
                return Math.ceil(this._filteredRows.length / this.pageRowsCount) || 0;
            },

            ...mapState(['loading', 'disUser']),
            currentPageData() {
                const rows = this._filteredRows;
                if (rows.length === 0) {
                    return { dualRows: [], rightColumnData: [], pageSubtotal: 0, pageSubtotalHanzi: '零元' };
                }
                const start = (this.pagesIndex - 1) * this.pageRowsCount;
                const end   = Math.min(start + this.pageRowsCount, rows.length);
                const pageData = rows.slice(start, end);

                const pageSubtotal = pageData.reduce((acc, it) => acc + parseFloat(it.nxDoSubtotal || 0), 0);
                const pageSubtotalFormatted = parseFloat(pageSubtotal.toFixed(1));

                return {
                    dualRows: pageData,
                    rightColumnData: [],
                    pageSubtotal: pageSubtotalFormatted,
                    pageSubtotalHanzi: this.numberToChinese(pageSubtotalFormatted, false),
                };
            },

            disInfo() {
                return this.disUser && this.disUser.nxDistributerEntity ? this.disUser.nxDistributerEntity : {};
            },
            
            // 判断是否是溯源类型的配送商
            isTraceabilityType() {
                return this.disUser && 
                       this.disUser.nxDistributerEntity && 
                       this.disUser.nxDistributerEntity.nxDistributerType == 2;
            },
            disId() {
                return this.disUser && this.disUser.nxDistributerEntity ? this.disUser.nxDistributerEntity.nxDistributerId : -1;
            },
            disName() {
                return this.disUser && this.disUser.nxDistributerEntity ? this.disUser.nxDistributerEntity.nxDistributerName : '';
            },

            todayDate() {
                const today = new Date();
                const year = today.getFullYear();
                const month = today.getMonth() + 1;
                const day = today.getDate();
                return `${year}-${month}-${day}`;
            },

            // 显示日期：历史订单显示订单日期，新订单显示当前日期
            displayDate() {
                // 如果是历史订单（有orderDate），显示订单日期
                if (this.orderDate) {
                    return this.orderDate;
                }
                // 否则显示当前日期
                return this.todayDate;
            },

            // 格式化合计金额，保留1位小数
            subtotalFormatted() {
                const num = parseFloat(this.subtotal) || 0;
                return parseFloat(num.toFixed(1));
            },

            // 获取每页行数
            rowsPerPage() {
                return this.pageRowsCount;
            },

            // 生成打印页面数据
            printPagesData() {
                const rows = this._filteredRows;
                if (rows.length === 0) return [];

                const pages = [];
                const totalPages = this.totalPages; // 用上面的 computed
                for (let pageIndex = 1; pageIndex <= totalPages; pageIndex++) {
                    const startIndex = (pageIndex - 1) * this.pageRowsCount;
                    const endIndex   = Math.min(pageIndex * this.pageRowsCount, rows.length);
                    const pageData   = rows.slice(startIndex, endIndex);

                    const pageSubtotal = pageData.reduce((acc, it) => acc + parseFloat(it.nxDoSubtotal || 0), 0);
                    const pageSubtotalFormatted = parseFloat(pageSubtotal.toFixed(1));

                    pages.push({
                        pageIndex,
                        isLastPage: pageIndex === totalPages,
                        isMultiplePages: totalPages > 1,
                        dualRows: pageData,
                        rightColumnData: [],
                        pageSubtotal,
                        pageSubtotalFormatted,
                        pageSubtotalHanzi: this.numberToChinese(pageSubtotalFormatted, false),
                    });
                }
                return pages;
            },

            // 计算屏幕预览宽度（根据左右边距计算，不应用缩放，因为缩放通过 transform: scale() 实现）
            previewWidth() {
                const originalPageWidth = 240; // 原始纸张宽度（mm）
                const originalAvailableWidth = originalPageWidth - this.currentLeftMargin - this.currentRightMargin;
                // 预览宽度使用原始可用宽度，缩放通过 CSS transform: scale() 实现
                return originalAvailableWidth;
            },
        },


        watch: {
            // 数据变化：回到第 1 页（或保持不超过总页数）
            _filteredRows() {
                this.pagesIndex = 1;
            },
            // 总页数变化：保证当前页在合法范围
            totalPages(newVal) {
                if (newVal === 0) { this.pagesIndex = 1; return; }
                if (this.pagesIndex > newVal) this.pagesIndex = newVal;
                if (this.pagesIndex < 1) this.pagesIndex = 1;
            },
            
            // 监听历史订单数据变化
            orderData(newVal) {
                if (newVal) {

                    
                    // 设置历史订单数据
                    this.tradeNo = newVal.bill?.nxDbTradeNo || '';
                    this.subtotal = parseFloat(newVal.bill?.nxDbTotal) || 0;
                    this.orderDate = newVal.bill?.nxDbDate || '';
                    // 生成二维码
                    this.generateQRCode();

                    
                    // 强制重新计算页数
                    this.$nextTick(() => {
                        const calculatedPages = this.totalPages;
                        console.log("🔍 orderData 更新后总页数:", calculatedPages);
                    });
                }
            },
            
            applyArrPrint(newVal) {


                this.$nextTick(() => {
                    setTimeout(() => {
                        const printArea = this.$refs.printArea;

                    }, 50);
                });
            },

            gbBatchId: 'reloadByContext',
            gbDepFatherId: 'reloadByContext',
            gbDepId: 'reloadByContext',
            nxDepFatherId: 'reloadByContext',
            nxDepId: 'reloadByContext',
            updateTime: 'reloadByContext',

            // 监听applyArrPrint的变化，重新计算页数
            applyArrPrint() {
                console.log("applyArrPrint changed, length:", this.applyArrPrint.length);
            }
        },



        data() {
            return {
                pagesIndex: 1, // 当前页
                resFatherId: -1,
                comId: -1,
                tradeNo: "",
                qrCodeUrl: "", // 二维码图片URL
                applyArrPrint: [], // 假设从外部获取到的订单数据
                subtotalHanzi: '', // 合计大写
                subtotal: 0,
                orderDate: '', // 历史订单的日期
                printWidth: 0,
                printHeight: 0,
                isModalVisible: false, // 控制模态框显示
                printPages: [], // 打印页面数据数组
                forceUpdate: 0, // 强制更新变量
                pageRowsCount: 5, // 每页行数，单列布局每页5行
                showCalibrationPanel: false, // 控制打印校准面板显示
                currentLeftMargin: 12, // 当前左侧边距
                currentRightMargin: 12, // 当前右侧边距
                distributorNameFontSize: 18, // 配送商名称字体大小（px）
                orderContentFontSize: 14, // 订单内容字体大小（px）
                zoomFactor: 1.0, // 打印缩放系数（默认 1.0，不缩放）
                
                // 隐藏功能：连续点击页头3次显示校准面板
                headerClickCount: 0, // 页头点击计数
                headerClickTimer: null, // 点击计时器（用于重置计数）
                
                isPrinting: false, // 控制打印蒙版显示

            }
        },


        // 组件挂载时初始化
        async mounted() {
            console.log("ApplyThirtyWholePanel mounted");
            console.log(window.electronAPI);  // Ensure electronAPI is available
            console.log("gbBatchId===", this.gbBatchId);

            // 1) 打印机配置初始化
            await this.initPrinterProfile();

            // 2) 加载数据
            if (this.orderData) {
                // 历史订单：直接使用传入的 orderData
                console.log("使用历史订单数据：", this.orderData);
                this.tradeNo = this.orderData.bill?.nxDbTradeNo || '';
                this.subtotal = parseFloat(this.orderData.bill?.nxDbTotal) || 0;
                this.orderDate = this.orderData.bill?.nxDbDate || '';
                // 生成二维码
                this.generateQRCode();
                console.log("历史订单信息：", {
                    tradeNo: this.tradeNo,
                    subtotal: this.subtotal,
                    orderDate: this.orderDate
                });
            } else if (this.gbBatchId < 0) {
                // 新订单：调用 API 获取数据
                console.log("fetchOrderDatafetchOrderData");
                try {
                    await this.fetchOrderData();
                    console.log("订单数据加载完成：", this.applyArrPrint);
                } catch (error) {
                    console.error("加载订单数据失败：", error);
                }
            } else {
                // 批次订单：调用 API 获取数据
                console.log("fetchBatchDatafetchBatchData");
                try {
                    await this.fetchBatchData();
                    console.log("批次数据加载完成：", this.applyArrPrint);
                } catch (error) {
                    console.error("加载批次数据失败：", error);
                }
            }

            // 3) 量一下容器尺寸
                    this.$nextTick(() => {
                const printArea = document.getElementById('printAreaThirtyWhole');
                        if (printArea) {
                            const rect = printArea.getBoundingClientRect();
                            this.printWidth = rect.width.toFixed(2);
                            this.printHeight = rect.height.toFixed(2);
                        }
                    });

            // 4) 添加键盘快捷键：Ctrl+Shift+D 显示/隐藏调试信息
            document.addEventListener('keydown', this.handleDebugKeyPress);
        },

        beforeUnmount() {
            // 移除键盘事件监听
            document.removeEventListener('keydown', this.handleDebugKeyPress);
        },

        methods: {
            // 生成二维码
            async generateQRCode() {
                if (!this.tradeNo) {
                    this.qrCodeUrl = '';
                    return;
                }
                try {
                    // 构建完整的URL
                    const qrCodeContent = `https://www.grainservice.club/trace/${this.tradeNo}`;
                    
                    const qrCodeDataUrl = await QRCode.toDataURL(qrCodeContent, {
                        width: 400, // 增加二维码生成尺寸，提高打印清晰度
                        margin: 2, // 增加边距，提高识别率
                        errorCorrectionLevel: 'H', // 最高容错率（30%），即使部分损坏也能识别
                        color: {
                            dark: '#000000',
                            light: '#FFFFFF'
                        }
                    });
                    this.qrCodeUrl = qrCodeDataUrl;
                    console.log('二维码生成成功:', qrCodeContent);
                } catch (error) {
                    console.error('生成二维码失败:', error);
                    this.qrCodeUrl = '';
                }
            },

            // ==================== 数据重载相关方法 ====================
            
            // 统一入口：参数变化 → 重置 + 拉数据
            async reloadByContext() {
                if (this.orderData) {
                    console.log("reloadByContext: 历史订单模式，跳过 fetchOrderData/fetchBatchData");
                    return;
                }
                this.pagesIndex = 1;
                this.applyArrPrint = [];
                this.subtotal = 0;
                this.subtotalHanzi = "";

                if (this.gbBatchId != -1) {
                    console.log("条件1满足，调用 fetchBatchData()");
                    await this.fetchBatchData();
                } else if ((this.gbDepFatherId != -1 && this.gbDepId != -1) ||
                           (this.nxDepFatherId != -1 && this.nxDepId != -1)) {
                    console.log("条件2满足，调用 fetchOrderData()");
                    await this.fetchOrderData();
            } else {
                    console.log("所有条件都不满足，不调用任何接口");
                }
            },

            // ==================== 打印机校准相关方法 ====================
            
            // 应用打印机配置文件（使用共享工具）
            applyPrinterProfile(profile) {
                console.log('🎨 [applyPrinterProfile] 开始应用配置（组件方法）:', {
                    profile,
                    currentComponentValues: {
                        distributorNameFontSize: this.distributorNameFontSize,
                        orderContentFontSize: this.orderContentFontSize
                    }
                });
                
                const root = document.documentElement.style;
                // 先更新数据属性 - 使用 ?? 而不是 ||，避免 0 值被误判
                const oldDistributorFont = this.distributorNameFontSize;
                const oldOrderFont = this.orderContentFontSize;
                
                this.currentLeftMargin = profile.safeLeftMm ?? 12;
                this.currentRightMargin = profile.safeRightMm ?? 12; // 加载右边距
                this.distributorNameFontSize = profile.distributorNameFontSize ?? 18;
                this.orderContentFontSize = profile.orderContentFontSize ?? 14;
                
                this.zoomFactor = profile.zoomFactor ?? 1.0;
                
                console.log('🎨 [applyPrinterProfile] 配置已应用:', {
                    zoomFactor: this.zoomFactor,
                    distributorNameFontSize: {
                        profileValue: profile.distributorNameFontSize,
                        oldValue: oldDistributorFont,
                        newValue: this.distributorNameFontSize,
                        changed: oldDistributorFont !== this.distributorNameFontSize,
                        usingDefault: this.distributorNameFontSize === 18 && profile.distributorNameFontSize == null
                    },
                    orderContentFontSize: {
                        profileValue: profile.orderContentFontSize,
                        oldValue: oldOrderFont,
                        newValue: this.orderContentFontSize,
                        changed: oldOrderFont !== this.orderContentFontSize,
                        usingDefault: this.orderContentFontSize === 14 && profile.orderContentFontSize == null
                    }
                });
                
                // 再设置CSS变量
                const distributorFontValue = String(this.distributorNameFontSize) + 'px';
                const orderFontValue = String(this.orderContentFontSize) + 'px';
                
                root.setProperty('--safe-left-mm', String(this.currentLeftMargin));
                root.setProperty('--distributor-name-font-size', distributorFontValue);
                root.setProperty('--order-content-font-size', orderFontValue);
                
                console.log('✅ [applyPrinterProfile] 配置已应用:', {
                    zoomFactor: this.zoomFactor,
                    leftMargin: this.currentLeftMargin,
                    rightMargin: this.currentRightMargin,
                    distributorFont: this.distributorNameFontSize,
                    orderFont: this.orderContentFontSize
                });
            },

            // 初始化打印机配置（使用共享工具）
            async initPrinterProfile() {
                await initPrinterProfile(this);
            },

            
            // 处理页头点击（隐藏功能：连续点击3次显示校准面板）
            handleHeaderClick() {
                // 清除之前的计时器
                if (this.headerClickTimer) {
                    clearTimeout(this.headerClickTimer);
                }
                
                // 增加点击计数
                this.headerClickCount++;
                
                // 设置计时器：2秒内如果没有再次点击，重置计数
                this.headerClickTimer = setTimeout(() => {
                    this.headerClickCount = 0;
                }, 2000);
                
                // 如果连续点击3次，显示校准面板
                if (this.headerClickCount >= 3) {
                    this.showCalibrationPanel = true;
                    this.headerClickCount = 0; // 重置计数
                    console.log('✅ [handleHeaderClick] 连续点击3次，已显示校准面板');
                }
            },
            
            // 处理配置保存事件（由 PrintCalibrationPanel 组件触发）
            async handleProfileSaved(profile) {
                console.log('✅ [handleProfileSaved] 配置已保存:', profile);
                console.log('✅ [handleProfileSaved] 保存的缩放系数:', profile.zoomFactor);
                
                // 保存后立即重新加载配置，确保组件使用最新的值
                console.log('🔄 [handleProfileSaved] 重新加载打印机配置...');
                await this.initPrinterProfile();
                
                console.log('✅ [handleProfileSaved] 重新加载后，组件缩放系数:', this.zoomFactor);
                console.log('✅ [handleProfileSaved] 验证:', {
                    '保存的值': profile.zoomFactor,
                    '组件当前值': this.zoomFactor,
                    '是否匹配': profile.zoomFactor === this.zoomFactor,
                    '⚠️ 警告': profile.zoomFactor !== this.zoomFactor ? '缩放系数不匹配！' : '缩放系数正确'
                });
            },
            
            // 打印校准页面
            printCalibrationPage() {
                const calibrationHTML = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <title>打印校准页</title>
                        <style>
                            @page { size: 240mm 93mm; margin: 3mm; }
                            body { margin: 0; font-family: Arial, sans-serif; }
                            .calibration-container {
                                width: 220mm;
                                height: 87mm;
                                border: 2px solid #000;
                                position: relative;
                                margin: 0 auto;
                            }
                            .scale-line {
                                position: absolute;
                                border: 1px solid #000;
                                font-size: 10px;
                            }
                            .horizontal-line { width: 100%; height: 0; }
                            .vertical-line { width: 0; height: 100%; }
                            .top-line { top: 0; }
                            .bottom-line { bottom: 0; }
                            .left-line { left: 0; }
                            .right-line { right: 0; }
                            .marker {
                                position: absolute;
                                font-size: 8px;
                                color: #666;
                            }
                            .right-marker {
                                right: 2mm;
                                top: 50%;
                                transform: translateY(-50%);
                                background: white;
                                padding: 2px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="calibration-container">
                            <!-- 刻度线 -->
                            <div class="scale-line horizontal-line top-line"></div>
                            <div class="scale-line horizontal-line bottom-line"></div>
                            <div class="scale-line vertical-line left-line"></div>
                            <div class="scale-line vertical-line right-line"></div>
                            
                            <!-- 右侧标记 -->
                            <div class="marker right-marker">
                                右边线应在此处<br>内侧2mm内
                            </div>
                            
                            <!-- 刻度标记 -->
                            <div style="position: absolute; top: 5mm; left: 10mm; font-size: 12px; font-weight: bold;">
                                打印校准页 - 检查右侧边框是否完整显示
                            </div>
                        </div>
                    </body>
                    </html>
                `;
                
                const printWindow = window.open('', '_blank');
                printWindow.document.write(calibrationHTML);
                printWindow.document.close();
                printWindow.focus();
                setTimeout(() => {
                    printWindow.print();
                }, 500);
            },

            // 微调左侧安全边距
            adjustLeftMargin(delta) {
                const newValue = Math.max(5, Math.min(20, this.currentLeftMargin + delta));
                this.currentLeftMargin = newValue;
                document.documentElement.style.setProperty('--safe-left-mm', String(newValue));
                console.log('调整左侧安全边距:', newValue);
            },

            // 微调整体缩放
            adjustScale(delta) {
                const newValue = Math.max(0.95, Math.min(1.05, this.currentScale + delta));
                this.currentScale = newValue;
                document.documentElement.style.setProperty('--content-scale', String(newValue));
                console.log('调整整体缩放:', newValue);
            },

            // 打印校准页面
            printCalibrationPage() {
                const calibrationHTML = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <title>打印校准页</title>
                        <style>
                            @page { size: 240mm 93mm; margin: 3mm; }
                            body { margin: 0; font-family: Arial, sans-serif; }
                            .calibration-container {
                                width: 220mm;
                                height: 87mm;
                                border: 2px solid #000;
                                position: relative;
                                margin: 0 auto;
                            }
                            .scale-line {
                                position: absolute;
                                border: 1px solid #000;
                                font-size: 10px;
                            }
                            .horizontal-line { width: 100%; height: 0; }
                            .vertical-line { width: 0; height: 100%; }
                            .top-line { top: 0; }
                            .bottom-line { bottom: 0; }
                            .left-line { left: 0; }
                            .right-line { right: 0; }
                            .marker {
                                position: absolute;
                                font-size: 8px;
                                color: #666;
                            }
                            .right-marker {
                                right: 2mm;
                                top: 50%;
                                transform: translateY(-50%);
                                background: white;
                                padding: 2px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="calibration-container">
                            <!-- 刻度线 -->
                            <div class="scale-line horizontal-line top-line"></div>
                            <div class="scale-line horizontal-line bottom-line"></div>
                            <div class="scale-line vertical-line left-line"></div>
                            <div class="scale-line vertical-line right-line"></div>
                            
                            <!-- 右侧标记 -->
                            <div class="marker right-marker">
                                右边线应在此处<br>内侧2mm内
                            </div>
                            
                            <!-- 刻度标记 -->
                            <div style="position: absolute; top: 5mm; left: 10mm; font-size: 12px; font-weight: bold;">
                                打印校准页 - 检查右侧边框是否完整显示
                            </div>
                        </div>
                    </body>
                    </html>
                `;
                
                const printWindow = window.open('', '_blank');
                printWindow.document.write(calibrationHTML);
                printWindow.document.close();
                printWindow.focus();
                setTimeout(() => {
                    printWindow.print();
                }, 500);
            },

            // ==================== 原有方法 ====================

            // 打开确认模态框
            print() {
                this.isModalVisible = true;
            },


            // 处理模态框的确认事件
            async handleConfirm() {
                this.isModalVisible = false;
                try {
                    // 暂时屏蔽保存接口，方便测试打印功能
                    // await this.saveOrder();
                    console.log("保存接口已屏蔽，仅用于测试打印功能");
                    // this.executePrint();
                    // Emit event to parent
                    this.$emit('order-saved');
                } catch (error) {
                    console.error("保存订单或打印失败:", error);
                    // Optionally, show an error message to user
                }
            },

            // 处理取消保存
            handleCancel() {
                this.isModalVisible = false;

            },


            async fetchBatchData() {
                console.log("开始获取nxDisGetGbBatchOrders数据");
                try {

                    // 构建请求参数
                    // const params = new URLSearchParams();
                    // params.append('depFatherId', parseInt(this.nxDepFatherId));
                    // params.append('depId', parseInt(this.nxDepId));
                    // params.append('gbDepFatherId', parseInt(this.gbDepFatherId));
                    // params.append('gbDepId', parseInt(this.gbDepId));
                    // params.append('resFatherId', parseInt(this.resFatherId));
                    // params.append('disId', this.disId);

                    // // 发送请求
                    // console.log("请求参数-====", params.toString());
                    const res = await api.nxDisGetGbBatchOrders(this.gbBatchId);
                    console.log("请求参数-====", res);
                    if (res.data && res.data.data) {
                        // 历史订单使用bill字段
                        this.tradeNo = res.data.data.nxDbTradeNo || res.data.data.tradeNo;
                        // 生成二维码
                        this.generateQRCode();
                        this.subtotal = res.data.data.nxDbTotal || res.data.data.total;
                        this.subtotalHanzi = res.data.data.totalHanzi;
                        this.orderDate = res.data.data.nxDbDate || '';
                        this.applyArrPrint = res.data.data.arr;

                        console.log("历史订单数据结构:", res.data.data);
                        console.log("历史订单日期:", this.orderDate);
                        console.log("历史订单总金额:", this.subtotal);
                        console.log("this.orders=========", this.applyArrPrint); // 应输出数组内容

                        // ✅ 等 Vue 渲染完
                        this.$nextTick(() => {
                            console.log("DOM 已渲染，打印区域长度:", this.$refs.printArea?.outerHTML.length);
                        });
                    } else {
                        console.error("响应数据格式不正确:", res.data);
                    }

                } catch (error) {
                    console.error("请求数据失败:", error);
                }
            },

            async fetchOrderData() {
                console.log("开始获取订单数据");
                try {
                    // 调试：打印所有相关属性值
                    console.log("参数值检查:", {
                        nxDepFatherId: this.nxDepFatherId,
                        nxDepId: this.nxDepId,
                        gbDepFatherId: this.gbDepFatherId,
                        gbDepId: this.gbDepId,
                        resFatherId: this.resFatherId,
                        disId: this.disId
                    });

                    // 构建请求参数 - 传递所有必需参数（后端接口需要这些参数）
                    const params = new URLSearchParams();
                    
                    // 辅助函数：将值转换为整数，如果无效则返回 -1（后端需要所有参数）
                    const toIntOrMinusOne = (value) => {
                        if (value === null || value === undefined || value === '') {
                            return -1; // 空值统一返回 -1
                        }
                        const num = parseInt(value);
                        return isNaN(num) ? -1 : num;
                    };

                    // 添加所有必需参数（后端接口需要这些参数，即使值为 -1 也要传递）
                    params.append('depFatherId', toIntOrMinusOne(this.nxDepFatherId));
                    params.append('depId', toIntOrMinusOne(this.nxDepId));
                    params.append('gbDepFatherId', toIntOrMinusOne(this.gbDepFatherId));
                    params.append('gbDepId', toIntOrMinusOne(this.gbDepId));
                    params.append('resFatherId', toIntOrMinusOne(this.resFatherId));
                    params.append('disId', toIntOrMinusOne(this.disId));

                    // 发送请求
                    console.log("请求参数-====", params.toString());
                    
                    // 检查是否有有效参数
                    if (params.toString() === '') {
                        console.error("错误：没有有效的请求参数！");
                        throw new Error("缺少必要的请求参数");
                    }
                    
                    const res = await api.disGetToFillDepOrders(params);

                    if (res.data && res.data.data) {
                        this.tradeNo = res.data.data.tradeNo;
                        // 生成二维码
                        this.generateQRCode();
                        this.subtotal = res.data.data.total;
                        this.subtotalHanzi = res.data.data.totalHanzi;
                        this.applyArrPrint = res.data.data.arr;

                        console.log("this.orders=========", this.applyArrPrint); // 应输出数组内容

                        // ✅ 等 Vue 渲染完
                        this.$nextTick(() => {
                            console.log("DOM 已渲染，打印区域长度:", this.$refs.printArea?.outerHTML.length);
                        });
                    } else {
                        console.error("响应数据格式不正确:", res.data);
                    }

                } catch (error) {
                    console.error("请求数据失败:", error);
                }
            },

            // 切换页面
            changePage(page) {
                if (page < 1 || page > this.totalPages) return;
                this.pagesIndex = page; // 更新当前页
            },


            // 保存订单的逻辑
            async saveOrder() {
                console.log("开始保存订单");
                try {
                    const ids = this.applyArrPrint.map(item => item.nxDepartmentOrdersId);
                    const bill = {
                        nxDbTradeNo: this.tradeNo,
                        nxDbDepId: this.nxDepId,
                        nxDbDepFatherId: this.nxDepId,
                        nxDbTotal: this.subtotal,
                        nxDbIssueUserId: this.disUser ? this.disUser.nxDistributerUserId : null,
                        nxOrderIds: ids,
                        nxDbPrintTimes: 1,
                        nxDbGbDisId: this.gbDisId,
                        nxDbDisId: this.disUser ? this.disUser.nxDistributerEntity.nxDistributerId : null,
                        nxDbGbDepId: this.gbDepId,
                        nxDbNxCommunityId: this.comId,
                        nxDbNxRestrauntId: this.resFatherId
                    };
                    // const res = await api.saveAccountBill(bill);
                    //     if (res) {
                    //     console.log("订单保存成功");
                    //
                    //     this.isModalVisible = false;
                    //
                    //     // 如果需要，您可以在这里添加成功提示
                    // }
                } catch (error) {
                    // console.error("保存账单失败:", error);
                    throw error; // 将错误抛出以便在 saveOrderAndPrint 中捕获
                }
            },


                    // 计算需要的打印页数
            // 可选：仅返回值，不改任何 state
            calculateTotalPages() {
                return Math.ceil(this._filteredRows.length / this.pageRowsCount) || 0;
            },


            // 构建单页HTML（用于逐页打印）
            async buildSinglePageHtml(pageData, pageIndex, totalPages) {
                // 直接从配置文件获取缩放系数
                const zoomFactor = await this.getZoomFactorFromProfile();
                // 字体大小直接乘以缩放系数（保留1位小数，确保小系数也能看到变化）
                const scaledDistributorFontSize = Math.round((this.distributorNameFontSize * zoomFactor) * 10) / 10;
                const scaledOrderFontSize = Math.round((this.orderContentFontSize * zoomFactor) * 10) / 10;
                

                // 构建表格行HTML
                let tableRowsHtml = '';
                if (pageData.dualRows && pageData.dualRows.length > 0) {
                    pageData.dualRows.forEach((item, rowIndex) => {
                        const rowNum = ((pageIndex - 1) * this.pageRowsCount + rowIndex + 1);
                        const subtotalValue = item.nxDoSubtotal || '0';
                        const pack = item.nxDistributerGoodsEntity?.nxDgItemsPerCarton != null 
                            ? `${item.nxDistributerGoodsEntity?.nxDgGoodsStandardWeight || ''} * ${item.nxDistributerGoodsEntity?.nxDgItemsPerCarton}${item.nxDistributerGoodsEntity?.nxDgGoodsStandardname || ''}`
                            : '';
                        tableRowsHtml += `
                            <div class="print-table-row" style="font-size: ${scaledOrderFontSize}px !important;">
                                <div class="print-col print-ten" style="font-size: ${scaledOrderFontSize}px !important;">${rowNum}</div>
                                <div class="print-col print-thirty" style="font-size: ${scaledOrderFontSize}px !important;">${item.nxDistributerGoodsEntity?.nxDgGoodsName || ''}</div>
                                <div class="print-col print-fifteen" style="font-size: ${scaledOrderFontSize}px !important;">${pack}</div>
                                <div class="print-col print-ten" style="font-size: ${scaledOrderFontSize}px !important;">${item.nxDoPrintStandard || ''}</div>
                                <div class="print-col print-ten" style="font-size: ${scaledOrderFontSize}px !important;">${item.nxDoWeight || ''}</div>
                                <div class="print-col print-ten" style="font-size: ${scaledOrderFontSize}px !important;">${item.nxDoPrice || ''}</div>
                                <div class="print-col print-fifteen" style="border-right: 1px solid #000; text-align: right; padding-right: 2mm; font-size: ${scaledOrderFontSize}px !important;">${subtotalValue}</div>
                            </div>
                        `;
                    });
                }

                // 小计行
                let subtotalHtml = '';
                if (totalPages > 1) {
                    subtotalHtml = `
                        <div class="print-subtotal" style="font-size: ${this.orderContentFontSize}px !important;">
                            第${pageIndex}页小计：${pageData.pageSubtotalHanzi} ${pageData.pageSubtotalFormatted || pageData.pageSubtotal}元
                        </div>
                    `;
                }

                // 地址和合计行
                let addressTotalHtml = '';
                if (pageData.isLastPage) {
                    addressTotalHtml = `
                        <div class="print-address-total" style="font-size: ${this.orderContentFontSize}px !important;">
                            <span class="address" style="font-size: ${this.orderContentFontSize}px !important;">地址: ${this.disInfo?.nxDistributerAddress || '暂无地址'}</span>
                            <span class="total" style="font-size: ${this.orderContentFontSize}px !important;">${this.subtotalHanzi} 合计: ${this.subtotalFormatted || this.subtotal}元</span>
                        </div>
                    `;
                } else {
                    addressTotalHtml = `
                        <div class="print-address" style="font-size: ${this.orderContentFontSize}px !important;">
                            地址: ${this.disInfo?.nxDistributerAddress || '暂无地址'}
                        </div>
                    `;
                }

                // 构建完整单页HTML
                // 注意：使用包装div来应用scale，保持.print-page的padding不被缩放
                const singlePageHtml = `
                    <div class="print-page">
                        <div class="print-page-content">
                            <!-- 页头 -->
                            <div class="print-header">
                                <div class="print-header-content">
                                    ${this.isTraceabilityType ? `
                                        <!-- 溯源类型布局（3行） -->
                                        <div class="print-left">
                                            <div class="print-item" style="font-size: ${scaledOrderFontSize}px !important;">单位: ${this.depName}</div>
                                            <div class="print-item" style="font-size: ${scaledOrderFontSize}px !important;">时间: ${this.displayDate}</div>
                                            <div class="print-item" style="font-size: ${scaledOrderFontSize}px !important;">共${totalPages}页 - 第${pageIndex}页</div>
                                        </div>
                                        <div class="print-center">
                                            <div class="print-title" style="font-size: ${scaledDistributorFontSize}px !important;">${this.disInfo?.nxDistributerName || '配送商'} </div>
                                        </div>
                                        <div class="print-right">
                                            ${this.qrCodeUrl ? `<div class="print-item" style="text-align: right; height: 75px; display: flex; align-items: center; justify-content: flex-end;"><img src="${this.qrCodeUrl}" alt="订单二维码" style="width: 70px; height: 70px; display: block;" /></div>` : ''}
                                        </div>
                                    ` : `
                                        <!-- 普通类型布局（2行） -->
                                        <div class="print-left">
                                            <div class="print-item" style="font-size: ${scaledOrderFontSize}px !important;">单位: ${this.depName}</div>
                                            <div class="print-item" style="font-size: ${scaledOrderFontSize}px !important;">时间: ${this.displayDate}</div>
                                        </div>
                                        <div class="print-center">
                                            <div class="print-title" style="font-size: ${scaledDistributorFontSize}px !important;">${this.disInfo?.nxDistributerName || '配送商'}</div>
                                        </div>
                                        <div class="print-right">
                                            <div class="print-item" style="font-size: ${scaledOrderFontSize}px !important;">共${totalPages}页 - 第${pageIndex}页</div>
                                            <div class="print-item" style="font-size: ${scaledOrderFontSize}px !important;">单号: ${this.tradeNo}</div>
                                        </div>
                                    `}
                                </div>
                            </div>

                            <!-- 表格容器 -->
                            <div class="print-content-bill">
                                <div class="print-fifty-column-container">
                                    <!-- 表头 -->
                                    <div class="print-table-header" style="font-size: ${scaledOrderFontSize}px !important;">
                                        <div class="print-col print-ten" style="font-size: ${scaledOrderFontSize}px !important;">序号</div>
                                        <div class="print-col print-thirty" style="font-size: ${scaledOrderFontSize}px !important;">商品</div>
                                        <div class="print-col print-fifteen" style="font-size: ${scaledOrderFontSize}px !important;">规格</div>
                                        <div class="print-col print-ten" style="font-size: ${scaledOrderFontSize}px !important;">单位</div>
                                        <div class="print-col print-ten" style="font-size: ${scaledOrderFontSize}px !important;">数量</div>
                                        <div class="print-col print-ten" style="font-size: ${scaledOrderFontSize}px !important;">单价</div>
                                        <div class="print-col print-fifteen" style="border-right: 1px solid #000; text-align: right; padding-right: 2mm; font-size: ${scaledOrderFontSize}px !important;">小计</div>
                                    </div>
                                <!-- 数据行 -->
                                ${tableRowsHtml}
                                
                                <!-- 调试：检查数据 -->
                                <!-- 数据行数: ${pageData.dualRows?.length || 0} -->
                                </div>
                            </div>

                            ${subtotalHtml}
                            ${addressTotalHtml}
                        </div>
                    </div>
                `;

                return singlePageHtml;
            },

            // 从配置文件获取缩放系数（每次都读取最新值）
            async getZoomFactorFromProfile() {
                try {
                    // 获取当前配置的打印机名称
                    const printerName = await getCurrentPrinterName();
                    if (!printerName) {
                        console.warn('⚠️ [getZoomFactorFromProfile] 未配置打印机，使用组件默认缩放系数');
                        return this.zoomFactor || 1.0;
                    }
                    
                    console.log('🔍 [getZoomFactorFromProfile] 使用打印机名称:', printerName);
                    const profile = await loadPrinterProfile(printerName);
                    const zoomFactor = profile.zoomFactor ?? 1.0;
                    
                    console.log('🔍 [getZoomFactorFromProfile] 获取到的缩放系数:', {
                        printerName,
                        zoomFactor,
                        componentZoomFactor: this.zoomFactor
                    });
                    
                    return zoomFactor;
                } catch (error) {
                    console.warn('⚠️ [getZoomFactorFromProfile] 读取失败:', error);
                    return this.zoomFactor || 1.0;
                }
            },

            async getMaxPrintableWidthFromProfile() {
                try {
                    const printerName = await getCurrentPrinterName();
                    if (!printerName) return DEFAULT_PROFILE.maxPrintableWidth ?? 195;
                    const profile = await loadPrinterProfile(printerName);
                    const val = profile.maxPrintableWidth ?? DEFAULT_PROFILE.maxPrintableWidth ?? 195;
                    return Math.max(180, Math.min(205, val));
                } catch (error) {
                    return DEFAULT_PROFILE.maxPrintableWidth ?? 195;
                }
            },

            // 注入打印样式（单页模式）
            async injectPrintStyles(singlePageHtml) {
                const zoomFactor = await this.getZoomFactorFromProfile();
                const actualPrintableWidth = await this.getMaxPrintableWidthFromProfile();
                
                // 物理纸张尺寸（固定）
                const physicalPageWidth = 241; // 物理纸张宽度（mm）
                const physicalPageHeight = 93; // 物理纸张高度（mm）
                const adjustedPageWidth = physicalPageWidth; // @page size 使用物理纸张尺寸
                const adjustedPageHeight = physicalPageHeight;
                
                // ========== 最大化打印宽度策略 ==========
                // 目标：尽量满纸宽度打印，最大化利用纸张，但不超过实际可打印宽度200mm
                // 策略：使用210mm作为基准宽度，但最终不超过实际可打印宽度200mm
                // 根据实际测试，打印机实际可打印宽度约为200mm，超过此宽度会被裁剪
                const safeBaseWidth = 210; // 使用210mm作为基准，但最终会被限制在200mm以内
                
                // ========== 原方案：直接乘以缩放系数（当前使用） ==========
                // 直接调整尺寸方案：所有尺寸乘以 zoomFactor
                let adjustedLeftMargin = this.currentLeftMargin * zoomFactor;
                let adjustedRightMargin = this.currentRightMargin * zoomFactor;
                
                // ========== 方案A：保持总边距比例，然后整体缩放（已注释，如需使用请取消注释） ==========
                // // 1. 计算总边距和比例
                // const totalMargin = this.currentLeftMargin + this.currentRightMargin; // 例如：5 + 19 = 24mm
                // const leftMarginRatio = this.currentLeftMargin / totalMargin; // 例如：5/24 = 0.2083
                // const rightMarginRatio = this.currentRightMargin / totalMargin; // 例如：19/24 = 0.7917
                // 
                // // 2. 总边距乘以缩放系数
                // const scaledTotalMargin = totalMargin * zoomFactor; // 例如：24 × 1.2 = 28.8mm
                // 
                // // 3. 按比例分配缩放后的左右边距
                // let adjustedLeftMargin = scaledTotalMargin * leftMarginRatio; // 例如：28.8 × 0.2083 = 6mm
                // let adjustedRightMargin = scaledTotalMargin * rightMarginRatio; // 例如：28.8 × 0.7917 = 22.8mm
                
                // 计算可用宽度（原始）
                const originalAvailableWidth = safeBaseWidth - this.currentLeftMargin - this.currentRightMargin;
                
                // 缩放后的可用宽度（不应用任何补偿系数）
                let realAvailableWidth = originalAvailableWidth * zoomFactor;
                
                // 容器宽度 = 左边距 + 可用宽度 + 右边距（全部按系数缩放）
                // 目标：最大化打印范围，尽量满纸宽度打印
                // 策略：让容器宽度尽量接近物理纸张宽度241mm，最大化利用纸张
                let cssContainerWidth = adjustedLeftMargin + realAvailableWidth + adjustedRightMargin;
                
                // 如果容器宽度超过物理纸张宽度，按比例缩小到241mm（避免超出纸张）
                // 这样可以确保CSS层面最大化利用纸张宽度
                if (cssContainerWidth > physicalPageWidth) {
                    const scaleDown = physicalPageWidth / cssContainerWidth;
                    const originalContainerWidth = cssContainerWidth;
                    cssContainerWidth = physicalPageWidth;
                    // 按比例缩小边距和可用宽度，保持整体比例
                    adjustedLeftMargin = adjustedLeftMargin * scaleDown;
                    adjustedRightMargin = adjustedRightMargin * scaleDown;
                    realAvailableWidth = realAvailableWidth * scaleDown;
                    
                    console.log('📏 [打印宽度调试] 容器宽度超过物理纸张，按比例缩小到最大宽度:', {
                        原始容器宽度: originalContainerWidth.toFixed(2) + 'mm',
                        物理纸张宽度: physicalPageWidth + 'mm',
                        缩小比例: scaleDown.toFixed(4),
                        最终容器宽度: cssContainerWidth.toFixed(2) + 'mm',
                        调整后左边距: adjustedLeftMargin.toFixed(2) + 'mm',
                        调整后右边距: adjustedRightMargin.toFixed(2) + 'mm',
                        调整后可用宽度: realAvailableWidth.toFixed(2) + 'mm',
                        说明: 'CSS层面最大化利用241mm纸张宽度，实际打印宽度由打印驱动/硬件决定，尽量满纸宽度打印'
                    });
                } else {
                    // 如果容器宽度小于物理纸张宽度，说明还有空间，可以进一步优化
                    console.log('📏 [打印宽度调试] 容器宽度未达到物理纸张宽度，可以进一步增大缩放系数:', {
                        当前容器宽度: cssContainerWidth.toFixed(2) + 'mm',
                        物理纸张宽度: physicalPageWidth + 'mm',
                        剩余空间: (physicalPageWidth - cssContainerWidth).toFixed(2) + 'mm',
                        提示: '可以通过增大缩放系数来进一步利用纸张宽度'
                    });
                }
                
                // ========== 已屏蔽：打印驱动补偿系数和二次缩小逻辑 ==========
                // 不再应用 printDriverScaleCompensation 补偿系数
                // 不再进行补偿后的二次缩小检查
                
                // 计算容器的实际内容区域宽度（容器宽度 - 左右padding）
                let containerContentWidth = cssContainerWidth - adjustedLeftMargin - adjustedRightMargin;
                
                // ========== 实际可打印宽度限制（使用用户配置） ==========
                if (containerContentWidth > actualPrintableWidth) {
                    const scaleDownForPrintable = actualPrintableWidth / containerContentWidth;
                    const originalContentWidth = containerContentWidth;
                    containerContentWidth = actualPrintableWidth;
                    
                    // 按比例缩小容器宽度和边距，保持整体比例
                    cssContainerWidth = cssContainerWidth * scaleDownForPrintable;
                    adjustedLeftMargin = adjustedLeftMargin * scaleDownForPrintable;
                    adjustedRightMargin = adjustedRightMargin * scaleDownForPrintable;
                    realAvailableWidth = realAvailableWidth * scaleDownForPrintable;
                    
                    console.warn('⚠️ [打印宽度调试] 内容区域宽度超过实际可打印宽度，按比例缩小:', {
                        原始内容区域宽度: originalContentWidth.toFixed(2) + 'mm',
                        实际可打印宽度: actualPrintableWidth + 'mm',
                        缩小比例: scaleDownForPrintable.toFixed(4),
                        最终内容区域宽度: containerContentWidth.toFixed(2) + 'mm',
                        最终容器宽度: cssContainerWidth.toFixed(2) + 'mm',
                        调整后左边距: adjustedLeftMargin.toFixed(2) + 'mm',
                        调整后右边距: adjustedRightMargin.toFixed(2) + 'mm',
                        调整后可用宽度: realAvailableWidth.toFixed(2) + 'mm',
                        说明: '根据实际测试，打印机实际可打印宽度约为200mm，超过此宽度会被裁剪'
                    });
                }
                
                // 表格宽度应该等于内容区域宽度（边框包含在宽度内，box-sizing: border-box）
                const borderWidth = 0.53; // 左右各 2px 边框（1.06mm 总边框宽度）
                // 表格宽度 = 内容区域宽度（边框已经包含在 box-sizing: border-box 中）
                const tableWidth = containerContentWidth;
                
                console.log('📏 [打印宽度调试] 容器内容区域宽度:', containerContentWidth.toFixed(2), 'mm', `(容器 ${cssContainerWidth.toFixed(2)} - 左padding ${adjustedLeftMargin.toFixed(2)} - 右padding ${adjustedRightMargin.toFixed(2)})`);
                console.log('📏 [打印宽度调试] 表格宽度（等于内容区域宽度，边框包含在内）:', tableWidth.toFixed(2), 'mm');
                
                // 计算各列宽度（基于容器内容区域宽度，确保与表格宽度一致）
                // 注意：需要减去边框宽度，因为表格有左右边框
                const tableInnerWidth = containerContentWidth - (borderWidth * 2); // 减去左右边框
                const columnWidths = {
                    ten: (tableInnerWidth * 0.10).toFixed(2),
                    thirty: (tableInnerWidth * 0.30).toFixed(2),
                    fifteen: (tableInnerWidth * 0.15).toFixed(2)
                };
                
                console.log('📏 [打印宽度调试] 表格内部宽度（减去边框）:', tableInnerWidth.toFixed(2), 'mm', `(内容区域 ${containerContentWidth.toFixed(2)} - 左右边框 ${(borderWidth * 2).toFixed(2)})`);
                console.log('📏 [打印宽度调试] 各列宽度:', {
                    '10%列': columnWidths.ten + 'mm',
                    '30%列': columnWidths.thirty + 'mm',
                    '15%列': columnWidths.fifteen + 'mm',
                    '总列宽度': (parseFloat(columnWidths.ten) + parseFloat(columnWidths.thirty) + parseFloat(columnWidths.fifteen) + parseFloat(columnWidths.fifteen)).toFixed(2) + 'mm',
                    '表格内部宽度': tableInnerWidth.toFixed(2) + 'mm',
                    '是否匹配': Math.abs((parseFloat(columnWidths.ten) + parseFloat(columnWidths.thirty) + parseFloat(columnWidths.fifteen) + parseFloat(columnWidths.fifteen)) - tableInnerWidth) < 0.1 ? '✅ 匹配' : '⚠️ 不匹配'
                });
                
                // 字体大小：直接乘以缩放系数（保留1位小数，确保小系数也能看到变化）
                const scaledDistributorFontSize = Math.round((this.distributorNameFontSize * zoomFactor) * 10) / 10;
                const scaledOrderFontSize = Math.round((this.orderContentFontSize * zoomFactor) * 10) / 10;
                
                // 详细调试日志
                console.log('📏 [打印宽度调试] ========== 宽度计算详情 ==========');
                console.log('📏 [打印宽度调试] 缩放系数:', zoomFactor);
                console.log('📏 [打印宽度调试] 物理纸张宽度:', physicalPageWidth, 'mm');
                console.log('📏 [打印宽度调试] 安全基准宽度（简化方案）:', {
                    安全基准宽度: safeBaseWidth + 'mm',
                    物理纸张宽度: physicalPageWidth + 'mm',
                    实际可打印宽度: actualPrintableWidth + 'mm',
                    说明: '使用210mm作为基准，但最终会被限制在实际可打印宽度200mm以内',
                    右侧安全边距: (physicalPageWidth - safeBaseWidth) + 'mm'
                });
                console.log('📏 [打印宽度调试] 原始边距:', {
                    左边距: this.currentLeftMargin,
                    右边距: this.currentRightMargin,
                    总边距: this.currentLeftMargin + this.currentRightMargin
                });
                console.log('📏 [打印宽度调试] 缩放后边距（原方案：直接乘以缩放系数）:', {
                    左边距: adjustedLeftMargin.toFixed(2) + 'mm',
                    右边距: adjustedRightMargin.toFixed(2) + 'mm',
                    总边距: (adjustedLeftMargin + adjustedRightMargin).toFixed(2) + 'mm'
                });
                console.log('📏 [打印宽度调试] 原始可用宽度:', originalAvailableWidth, 'mm');
                console.log('📏 [打印宽度调试] 缩放后可用宽度:', realAvailableWidth.toFixed(2), 'mm');
                console.log('📏 [打印宽度调试] 容器总宽度:', cssContainerWidth.toFixed(2), 'mm', `(左边距 ${adjustedLeftMargin.toFixed(2)} + 可用宽度 ${realAvailableWidth.toFixed(2)} + 右边距 ${adjustedRightMargin.toFixed(2)})`);
                console.log('📏 [打印宽度调试] 表格宽度（含边框）:', tableWidth.toFixed(2), 'mm');
                console.log('📏 [打印宽度调试] 容器宽度 vs 物理纸张:', {
                    容器宽度: cssContainerWidth.toFixed(2) + 'mm',
                    物理纸张宽度: physicalPageWidth + 'mm',
                    差值: (cssContainerWidth - physicalPageWidth).toFixed(2) + 'mm',
                    是否超出: cssContainerWidth > physicalPageWidth ? '⚠️ 超出' : '✅ 正常',
                    说明: 'CSS层面使用241mm最大化打印范围，实际打印宽度由打印驱动/硬件决定，不同打印机可能有不同的可打印区域'
                });
                console.log('📏 [打印宽度调试] 最大化打印宽度策略:', {
                    内容区域宽度: containerContentWidth.toFixed(2) + 'mm',
                    物理纸张宽度: physicalPageWidth + 'mm',
                    策略: 'CSS层面最大化利用纸张宽度，通过调整缩放系数控制实际打印宽度',
                    提示: '如果右侧被裁剪，可以适当减小缩放系数；如果打印宽度不够，可以适当增大缩放系数'
                });
                console.log('📏 [打印宽度调试] 字体缩放:', {
                    配送商: `${this.distributorNameFontSize}px → ${scaledDistributorFontSize}px (${(scaledDistributorFontSize / this.distributorNameFontSize).toFixed(3)}倍)`,
                    订单内容: `${this.orderContentFontSize}px → ${scaledOrderFontSize}px (${(scaledOrderFontSize / this.orderContentFontSize).toFixed(3)}倍)`,
                    缩放系数: zoomFactor
                });
                
                // 验证宽度变化是否敏感（相对于基准值）
                // 注意：基准值固定使用210mm（简化方案，不再动态调整）
                const baseContainerWidth = 210; // 基准容器宽度（固定使用210mm）
                const baseTableWidth = 186; // 基准表格宽度（210 - 24 = 186mm）
                const widthChangePercent = ((cssContainerWidth - baseContainerWidth) / baseContainerWidth * 100).toFixed(2);
                const tableWidthChangePercent = ((tableWidth - baseTableWidth) / baseTableWidth * 100).toFixed(2);
                const expectedChangePercent = ((zoomFactor - 1) * 100).toFixed(2);
                
                console.log('📏 [打印宽度调试] 宽度变化对比:', {
                    缩放系数: zoomFactor,
                    预期变化百分比: `${expectedChangePercent}%`,
                    容器宽度变化: `${widthChangePercent}% (${baseContainerWidth}mm → ${cssContainerWidth.toFixed(2)}mm)`,
                    表格宽度变化: `${tableWidthChangePercent}% (${baseTableWidth}mm → ${tableWidth.toFixed(2)}mm)`,
                    变化是否匹配: Math.abs(parseFloat(widthChangePercent) - parseFloat(expectedChangePercent)) < 1 ? '✅ 匹配' : '⚠️ 不匹配'
                });
                
                console.log('📏 [打印宽度调试] ========== 宽度计算完成 ==========');
                
                const pageWidthValue = realAvailableWidth;
                const pageHeightValue = (physicalPageHeight - 10 - 5) * zoomFactor;
                
                
                const styleTag = `
                        <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        
                        /* 全局打印参数 */
                        :root {
                            --page-width-mm: ${physicalPageWidth};
                            --page-height-mm: ${physicalPageHeight};
                            --safe-left-mm: ${adjustedLeftMargin};
                            --safe-right-mm: ${adjustedRightMargin};
                            --distributor-name-font-size: ${scaledDistributorFontSize}px;
                            --order-content-font-size: ${scaledOrderFontSize}px;
                        }
                        
                        html {
                            width: 100% !important;
                            height: 100% !important;
                            overflow: hidden !important;
                        }
                        body {
                            margin: 0 !important;
                            padding: 0 !important;
                            /* 关键：body 保持物理纸张宽度，但实际容器会缩小 */
                            width: ${physicalPageWidth}mm !important;
                            overflow: hidden !important;
                        }
                        .print-page {
                            /* 使用缩小后的CSS容器宽度 */
                            width: ${cssContainerWidth.toFixed(2)}mm !important;
                            max-width: ${cssContainerWidth.toFixed(2)}mm !important;
                            height: ${pageHeightValue}mm !important;
                            /* 左右padding使用原始边距值（不缩小，保持用户设置的位置） */
                            padding: 10mm ${adjustedRightMargin.toFixed(2)}mm 5mm ${adjustedLeftMargin.toFixed(2)}mm !important;
                            /* 调试阶段先设为 visible，看看内容飘到哪去了 */
                            overflow: visible !important;
                            /* 关键：必须使用 border-box，确保 padding 不撑大容器 */
                            box-sizing: border-box !important;
                        }
                        @media print {
                            @page {
                                /* 关键：@page size 永远固定为物理纸张尺寸，驱动需要知道真实的纸张大小 */
                                size: ${adjustedPageWidth}mm ${adjustedPageHeight}mm !important;
                                margin: 0 !important;
                            }
                            html {
                                width: 100% !important;
                                height: 100% !important;
                                overflow: hidden !important;
                            }
                            body {
                                margin: 0 !important;
                                padding: 0 !important;
                                /* 关键：body 保持物理纸张宽度 */
                                width: ${physicalPageWidth}mm !important;
                                overflow: hidden !important;
                            }
                            .print-page {
                                /* 关键：必须使用 border-box，确保 padding 不撑大容器 */
                                box-sizing: border-box !important;
                                width: ${cssContainerWidth.toFixed(2)}mm !important;
                                max-width: ${cssContainerWidth.toFixed(2)}mm !important;
                                height: ${pageHeightValue}mm !important;
                                /* 左右padding使用调整后的边距值（已按比例缩小） */
                                padding: 10mm ${adjustedRightMargin.toFixed(2)}mm 5mm ${adjustedLeftMargin.toFixed(2)}mm !important;
                                overflow: hidden !important;
                                display: flex !important;
                                flex-direction: column !important;
                                position: relative !important;
                                margin: 0 !important;
                            }
                        }
                        
                            .print-header { padding: 2px 0; margin-bottom: 0; width: 100%; }
                            .print-header-content { display: flex !important; justify-content: space-between !important; align-items: center !important; width: 100% !important; }
                            .print-left, .print-right { flex: 1 !important; }
                            .print-center { flex: 2 !important; text-align: center !important; }
                            .print-title { font-size: var(--distributor-name-font-size, 18px) !important; font-weight: bold; }
                            .print-item { font-size: var(--order-content-font-size, 14px) !important; line-height: 24px; }
                            
                        .print-table-header { 
                            display: flex !important; 
                            font-size: var(--order-content-font-size, 14px) !important; 
                            line-height: 24px !important; 
                            text-align: center !important; 
                            border-bottom: 1px solid #000 !important; 
                            font-weight: bold !important;
                            width: 100% !important;
                            box-sizing: border-box !important;
                        }
                        .print-content-bill { 
                            border: 2px solid #000 !important; 
                            position: relative !important; 
                            z-index: 1 !important; 
                            display: flex !important; 
                            justify-content: center !important; 
                            /* 关键：直接锁定表格宽度（含边框），不给浏览器喘息机会 */
                            /* 注意：宽度包含边框（box-sizing: border-box），所以使用 tableWidth */
                            width: ${tableWidth.toFixed(2)}mm !important;
                            max-width: ${tableWidth.toFixed(2)}mm !important;
                            min-width: ${tableWidth.toFixed(2)}mm !important;
                            /* 关键：必须使用 border-box，确保边框包含在宽度内 */
                            box-sizing: border-box !important;
                            /* 防止内容溢出 */
                            overflow: hidden !important;
                        }
                            .print-fifty-column-container { 
                                width: 100% !important; 
                                max-width: 100% !important;
                                min-width: 100% !important;
                                box-sizing: border-box !important;
                                /* 确保容器不超出父元素 */
                                overflow: hidden !important;
                                /* 防止 flex 子元素溢出 */
                                flex-shrink: 0 !important;
                            }
                            .print-table-row { 
                                display: flex !important; 
                                line-height: 24px !important; 
                                font-size: var(--order-content-font-size, 14px) !important; 
                                text-align: center !important; 
                                border-bottom: 1px solid #000 !important; 
                                flex-wrap: nowrap !important;
                                width: 100% !important;
                                box-sizing: border-box !important;
                            }

                            /* 基础列样式 */
                            .print-col { 
                                flex: 0 0 auto !important;
                                min-width: 0 !important;
                                padding: 0 !important; 
                                /* 关键：必须使用 border-box，确保边框包含在宽度内 */
                                box-sizing: border-box !important; 
                                display: flex !important; 
                                align-items: center !important; 
                                justify-content: center !important; 
                                /* 移除硬编码的字体大小，使用内联样式或 CSS 变量 */
                                /* font-size 由内联样式控制，确保缩放系数生效 */
                                white-space: nowrap !important;
                                overflow: hidden !important;
                                text-overflow: ellipsis !important;
                                flex-shrink: 0 !important; 
                                flex-grow: 0 !important;
                                /* 列的右边框（1px），包含在 flex-basis 宽度内 */
                                border-right: 1px solid #000 !important;
                            }
                            
                            /* 各列宽度定义 - 确保百分比总和 = 100% */
                            /* 7列：10% + 30% + 15% + 10% + 10% + 10% + 15% = 100% */
                            .print-col.print-ten     { 
                                flex: 0 0 10% !important;
                                flex-basis: 10% !important;  
                                max-width: 10% !important;
                                min-width: 0 !important;
                                overflow: hidden !important;
                                text-overflow: ellipsis !important;
                            }
                            .print-col.print-thirty  { 
                                flex: 0 0 30% !important;
                                flex-basis: 30% !important;  
                                max-width: 30% !important;
                                min-width: 0 !important;
                                overflow: hidden !important;
                                text-overflow: ellipsis !important;
                            }
                            .print-col.print-fifteen { 
                                flex: 0 0 15% !important;
                                flex-basis: 15% !important;  
                                max-width: 15% !important;
                                min-width: 0 !important;
                                overflow: hidden !important;
                                text-overflow: ellipsis !important;
                            }
                            .print-col.print-twenty  { 
                                flex: 0 0 15% !important;
                                flex-basis: 15% !important;  
                                max-width: 15% !important;
                                min-width: 0 !important;
                                overflow: hidden !important;
                                text-overflow: ellipsis !important;
                            }
                            
                            /* 小计列（最后一列）特殊样式 - 必须放在最后，确保优先级最高 */
                            .print-col.print-fifteen:last-child { 
                                /* 1. 必须有右边框 - 最高优先级 */
                                border-right: 1px solid #000 !important;
                                /* 2. 金额右对齐 */
                                justify-content: flex-end !important;
                                text-align: right !important;
                                /* 3. 右内边距，避免数字贴线 */
                                padding-right: 2mm !important;
                                padding-left: 0 !important;
                                /* 4. 确保数字完整显示 */
                                overflow: visible !important;
                                text-overflow: clip !important;
                                white-space: nowrap !important;
                                /* 5. 确保文字可见 */
                                color: #000 !important;
                                visibility: visible !important;
                            }
                            
                            /* 强制确保小计列在所有情况下都有右边框 */
                            .print-table-header .print-col.print-fifteen:last-child,
                            .print-table-row .print-col.print-fifteen:last-child {
                                border-right: 1px solid #000 !important;
                            }
                                
                            .print-subtotal { 
                                text-align: right; 
                                font-size: var(--order-content-font-size, 14px) !important; 
                                font-weight: bold; 
                                margin-bottom: 4px; 
                                padding: 4px 8px; 
                                border-left: 1px solid #000; 
                                border-right: 1px solid #000; 
                                border-bottom: 1px solid #000; 
                                box-sizing: border-box; 
                                overflow: visible !important; /* 改为visible，确保文本不被截断 */
                                white-space: nowrap !important; /* 防止换行 */
                            }
                        .print-address-total { display: flex; justify-content: space-between; align-items: center; padding: 2px 8px; font-size: var(--order-content-font-size, 14px) !important; margin-top: 2px; }
                        .print-address-total .address { text-align: left; }
                        .print-address-total .total { text-align: right; font-weight: bold; }
                            .print-address { margin-top: 2px; padding: 2px 0; font-size: var(--order-content-font-size, 14px) !important; }
                        
                        /* 打印样式 */
                            @media print {
                                :root {
                                    --page-width-mm: ${physicalPageWidth};
                                    --page-height-mm: ${physicalPageHeight};
                                    --safe-left-mm: ${adjustedLeftMargin};
                                    --safe-right-mm: ${adjustedRightMargin};
                                    --distributor-name-font-size: ${scaledDistributorFontSize}px;
                                    --order-content-font-size: ${scaledOrderFontSize}px;
                                }
                                
                                @page {
                                    size: ${physicalPageWidth}mm ${physicalPageHeight}mm !important;
                                    margin: 0 !important;
                                }

                                * { visibility: visible !important; }
                                
                                body { 
                                    margin: 0 !important; 
                                    padding: 0 !important;
                                    width: ${physicalPageWidth}mm !important;
                                }
                                
                            .print-page {
                                box-sizing: border-box !important;
                                width: ${cssContainerWidth.toFixed(2)}mm !important;
                                max-width: ${cssContainerWidth.toFixed(2)}mm !important;
                                    height: ${physicalPageHeight}mm !important;
                                    padding: ${(10 * zoomFactor).toFixed(2)}mm ${adjustedRightMargin.toFixed(2)}mm ${(5 * zoomFactor).toFixed(2)}mm ${adjustedLeftMargin.toFixed(2)}mm !important;
                                /* 调试阶段先设为 visible，看看内容飘到哪去了 */
                                overflow: visible !important;
                                    overflow: visible !important;
                                    display: flex !important;
                                    flex-direction: column !important;
                                    position: relative !important;
                                    margin: 0 !important;
                                }
                                
                                /* 3) 允许"本页后换页"，但绝对不要加 margin-bottom */
                                .print-page.page-break {
                                    break-after: page !important;
                                    page-break-after: always !important;
                                    /* 不要任何 margin-bottom */
                                }
                                
                                /* 内容包装器 */
                                .print-page-content {
                                    width: 100% !important;
                                    height: 100% !important;
                                    display: flex !important;
                                    flex-direction: column !important;
                                    box-sizing: border-box !important;
                                    overflow: visible !important;
                                    min-width: 0 !important;
                                }
                                
                                /* 外框 - 确保所有边框都显示，特别是右侧边框 */
                                .print-content-bill {
                                    border: 2px solid #000 !important;
                                    border-right: 2px solid #000 !important;
                                    /* 关键：直接锁定表格宽度（含边框），不给浏览器喘息机会 */
                                    width: ${tableWidth.toFixed(2)}mm !important;
                                    max-width: ${tableWidth.toFixed(2)}mm !important;
                                    /* 关键：必须使用 border-box，确保边框包含在宽度内 */
                                    box-sizing: border-box !important;
                                    max-width: 100% !important;
                                    box-sizing: border-box !important;
                                    position: relative !important;
                                    flex-shrink: 0 !important;
                                    overflow: visible !important;
                                }
                                
                                /* 打印时确保小计列样式正确应用 - 最高优先级，放在最后 */
                                .print-col.print-twenty { 
                                    /* 1. 右边框 - 必须要有 */
                                    border-right: 1px solid #000 !important;
                                    /* 2. 右对齐金额 */
                                    justify-content: flex-end !important;
                                    text-align: right !important;
                                    /* 3. 右边距 */
                                    padding-right: 2mm !important;
                                    padding-left: 0 !important;
                                    /* 4. 显示完整 - 关键 */
                                    overflow: visible !important;
                                    text-overflow: clip !important;
                                    white-space: nowrap !important;
                                    /* 5. 确保可见 */
                                    color: #000 !important;
                                    visibility: visible !important;
                                    opacity: 1 !important;
                                    /* 6. 确保flex子元素正确对齐 */
                                    display: flex !important;
                                    align-items: center !important;
                                }
                                
                                /* 强制覆盖 - 确保所有情况下小计列都有右边框和正确对齐 */
                                .print-table-header .print-col.print-fifteen:last-child,
                                .print-table-row .print-col.print-fifteen:last-child {
                                    border-right: 1px solid #000 !important;
                                    justify-content: flex-end !important;
                                    text-align: right !important;
                                    padding-right: 2mm !important;
                                    overflow: visible !important;
                                }
                                
                                /* 确保内部容器宽度正确，不超出外框 */
                                .print-fifty-column-container {
                                    width: 100% !important;
                                    max-width: 100% !important;
                                    box-sizing: border-box !important;
                                    flex-shrink: 0 !important;
                                    /* 允许内容可见，避免文本被截断 */
                                    overflow: visible !important;
                                }
                                
                                /* 确保小计行宽度正确，不被截断 */
                                .print-subtotal {
                                    width: 100% !important;
                                    box-sizing: border-box !important;
                                    overflow: visible !important; /* 确保文本完整显示 */
                                    white-space: nowrap !important; /* 防止换行 */
                                    flex-shrink: 0 !important;
                                }
                            }
                        </style>
                    `;

                const finalHtml = styleTag + singlePageHtml;
                
                return finalHtml;
            },

            // 打印页面的逻辑 - 改为逐页打印
            async printOnly() {
                // 显示打印蒙版
                this.isPrinting = true;
                
                try {
                    // 打印前重新加载打印机配置，确保使用最新的设置
                    await this.initPrinterProfile();
                
                if (!this.printPagesData || this.printPagesData.length === 0) {
                    console.error("❌ [printOnly] printPagesData为空，无法打印");
                    return;
                }

                        // 检查是否在Electron环境中
                        if (typeof window.electronAPI === 'undefined') {
                    console.warn("⚠️ [printOnly] 警告：不在Electron环境中，无法调用打印功能");
                            return;
                        }

                // 检查是否有有效的订单ID
                if (this.nxDepFatherId === -1 && this.gbDepFatherId === -1 && this.gbBatchId === -1) {
                    console.error("❌ [printOnly] 错误：所有ID都为-1，无法确定调用哪个打印接口！");
                    return;
                }

                    // 逐页循环打印（使用新接口，支持缩放系数和IPC回执）
                    console.log(`🖨️ [printOnly] 开始打印，总页数: ${this.printPagesData.length}`);
                    for (let i = 0; i < this.printPagesData.length; i++) {
                        const pageData = this.printPagesData[i];
                        const pageIndex = pageData.pageIndex || (i + 1);
                        const totalPages = this.printPagesData.length;
                        
                        console.log(`🖨️ [printOnly] ========== 开始处理第 ${pageIndex}/${totalPages} 页 (循环索引: ${i}) ==========`);
                        
                        // 判断是否是最后一页：只在最后一页保存
                        const isLastPage = pageData.isLastPage;
                        const paperCount = totalPages; // 总页数
                        const shouldSave = isLastPage; // 只在最后一页保存

                        try {
                            // 1. 构建单页HTML（从配置文件读取最新缩放系数）
                            console.log(`🖨️ [printOnly] 第${pageIndex}页: 开始构建HTML...`);
                            const singlePageHtml = await this.buildSinglePageHtml(pageData, pageIndex, totalPages);
                            
                            // 2. 注入打印样式（从配置文件读取最新缩放系数）
                            console.log(`🖨️ [printOnly] 第${pageIndex}页: 开始注入打印样式...`);
                            const finalHtmlForThisPage = await this.injectPrintStyles(singlePageHtml);
                            
                            // 3. 清理Vue特殊属性
                            let cleanHtml = finalHtmlForThisPage.replace(/data-v-[a-zA-Z0-9]+=""/g, '');
                            cleanHtml = cleanHtml.replace(/data-v-[a-zA-Z0-9]+/g, '');
                            
                            // 4. 发送打印请求（每页单独发送，只在最后一页保存）
                            const pageSpecificTradeNo = totalPages > 1 ? `${this.tradeNo}-${pageIndex}` : this.tradeNo;
                            
                            console.log(`📏 [打印列宽度] 第${pageIndex}/${totalPages}页准备打印，缩放系数: ${this.zoomFactor || 1.0}`);
                            
                            try {
                                let printResult;
                                console.log(`🖨️ [printOnly] 第${pageIndex}页: 准备调用打印API...`);
                                console.log(`🖨️ [printOnly] 第${pageIndex}页: ID检查 - nxDepFatherId=${this.nxDepFatherId}, gbDepFatherId=${this.gbDepFatherId}, gbBatchId=${this.gbBatchId}`);
                                
                                if (this.nxDepFatherId !== -1) {
                                    // 使用带回调的打印API，等待实际打印完成
                                    console.log(`🖨️ [printOnly] 第${pageIndex}页: 调用 sendPrintRequestWithCallback...`);
                                    printResult = await window.electronAPI.sendPrintRequestWithCallback(
                                        cleanHtml,
                                        this.nxDepFatherId,
                                        this.nxDepId,
                                        this.tradeNo,  // 使用原始tradeNo，不用带页码
                                        this.disUser.nxDistributerUserId,
                                        paperCount,  // 传入总页数
                                        shouldSave,  // 只在最后一页为true
                                        !!this.isHistoryOrder  // 历史订单打印时跳过保存接口和刷新客户列表
                                    );
                                    console.log(`✅ [printOnly] 第${pageIndex}页: sendPrintRequestWithCallback 完成，结果:`, printResult);
                                } else if (this.gbDepFatherId !== -1) {
                                    console.log(`🖨️ [printOnly] 第${pageIndex}页: 调用 sendPrintRequestGbWithCallback...`);
                                    printResult = await window.electronAPI.sendPrintRequestGbWithCallback(
                                        cleanHtml,
                                        this.gbDepFatherId,
                                        this.gbDepId,
                                        this.tradeNo,  // 使用原始tradeNo，不用带页码
                                        this.disUser.nxDistributerUserId,
                                        this.disId,
                                        paperCount,  // 传入总页数
                                        shouldSave   // 只在最后一页为true
                                    );
                                    console.log(`✅ [printOnly] 第${pageIndex}页: sendPrintRequestGbWithCallback 完成，结果:`, printResult);
                                } else if (this.gbBatchId !== -1) {
                                    console.log(`🖨️ [printOnly] 第${pageIndex}页: 调用 sendPrintRequestGbBatchWithCallback...`);
                                    printResult = await window.electronAPI.sendPrintRequestGbBatchWithCallback(
                                        cleanHtml,
                                        this.gbBatchId,
                                        paperCount,  // 传入总页数
                                        shouldSave   // 只在最后一页为true
                                    );
                                    console.log(`✅ [printOnly] 第${pageIndex}页: sendPrintRequestGbBatchWithCallback 完成，结果:`, printResult);
                                } else {
                                    console.error(`❌ [printOnly] 第${pageIndex}页: 错误！所有ID都为-1，无法确定调用哪个打印接口！`);
                                    continue; // 跳过这一页，继续下一页
                                }

                                console.log(`✅ [printOnly] 第${pageIndex}页打印完成（收到回执）`, printResult);
                                
                                // 打印完成后，给打印机一点额外时间完成走纸（针对针式打印机）
                                if (i < this.printPagesData.length - 1) {
                                    const walkTime = 400; // 400ms让打印机走纸
                                    console.log(`⏳ [printOnly] 等待${walkTime}ms，让打印机自动走纸到下一张起始位置...`);
                                    await new Promise(resolve => setTimeout(resolve, walkTime));
                                    console.log(`✅ [printOnly] 走纸完成，准备打印下一页`);
                                }
                                
                            } catch (error) {
                                console.error(`❌ [printOnly] 第${pageIndex}页打印失败（收到错误回执）:`, error);
                                console.error(`❌ [printOnly] 错误详情:`, {
                                    error: error,
                                    errorType: typeof error,
                                    errorString: String(error),
                                    errorMessage: error?.message,
                                    errorStack: error?.stack
                                });
                                // 抛出错误，让外层catch处理，决定是否继续打印下一页
                                throw error;
                            }
                            
                        } catch (error) {
                            console.error(`❌ [printOnly] 打印第${pageIndex}页时出错:`, error);
                            // 即使打印失败，也继续打印下一页（可选：可以选择break停止）
                            continue;
                        }
                        
                        console.log(`🖨️ [printOnly] ========== 第 ${pageIndex}/${totalPages} 页处理完成 ==========\n`);
                    }
                    console.log(`\n✅ [printOnly] ========== 所有页面打印完成 ==========`);
                    console.log(`✅ [printOnly] 总计打印 ${this.printPagesData.length} 页`);
                } catch (error) {
                    console.error("❌ [printOnly] 打印过程中出错:", error);
                } finally {
                    // 无论成功还是失败，都隐藏打印蒙版
                    this.isPrinting = false;
                }
            },

            // 注入测试打印样式（使用新的"固定纸张+缩放内容"方案）
            injectTestPrintStyles(contentHtml) {
                // const zoomFactor = this.zoomFactor || 1.0;
                const zoomFactor = 0.8;
                const offsetX = this.currentLeftMargin || 12; // 左边距作为偏移量
                const rightMargin = this.currentRightMargin || 12; // 右边距
                const paperWidth = 240; // 纸张宽度（mm）
                
                // 计算可用宽度（减去左右边距）
                const availableWidth = paperWidth - offsetX - rightMargin;
                
                // 缩放层的宽度 = 可用宽度 / zoomFactor
                // 这样缩放后正好等于可用宽度，不会超出纸张
                const scalingLayerWidth = availableWidth / zoomFactor;
                
                console.log('🎨 [injectTestPrintStyles] 应用新方案:', {
                    zoomFactor,
                    offsetX,
                    rightMargin,
                    paperWidth,
                    availableWidth,
                    scalingLayerWidth,
                    strategy: '固定纸张 + 缩放内容',
                    calculation: `缩放层宽度 ${scalingLayerWidth.toFixed(2)}mm × 缩放系数 ${zoomFactor} = ${availableWidth.toFixed(2)}mm (可用宽度)`
                });

                const styleTag = `
                    <style>
                        /* ========== 新方案：固定纸张 + 缩放内容 ========== */
                        
                        @media print {
                            /* 1. 纸张尺寸永远固定，不随系数变动 */
                            @page {
                                size: ${paperWidth}mm 93mm; /* 固定标准尺寸 */
                                margin: 0 !important;
                            }
                            
                            * {
                                visibility: visible !important;
                            }
                            
                            body {
                                margin: 0 !important;
                                padding: 0 !important;
                                width: ${paperWidth}mm;
                                height: 93mm;
                                overflow: hidden;
                            }
                        }
                        
                        /* 2. 物理底座：锁定标准宽度和高度，防止驱动因"找不到纸"而乱缩放 */
                        .print-paper-wrapper {
                            width: ${paperWidth}mm;
                            height: 93mm;
                            overflow: hidden;
                            margin: 0;
                            padding: 0;
                            padding-left: ${offsetX}mm; /* 左边距偏移 */
                            padding-right: ${rightMargin}mm; /* 右边距 */
                            padding-top: 2mm; /* 顶部边距 */
                            padding-bottom: 2mm; /* 底部边距 */
                            box-sizing: border-box;
                        }
                        
                        /* 3. 内容层：移除 CSS zoom，缩放统一由 Electron setZoomFactor 处理 */
                        .print-scaling-layer {
                            width: ${availableWidth.toFixed(2)}mm; /* 直接使用可用宽度，不除以 zoomFactor */
                            height: ${(93 - 2 - 2).toFixed(2)}mm; /* 直接使用可用高度，不除以 zoomFactor */
                            padding: 2mm;
                            box-sizing: border-box;
                            overflow: hidden;
                            /* 重要：前端不应用缩放，缩放由 Electron setZoomFactor 统一处理 */
                        }
                        
                        /* 4. 内容样式 */
                        .test-page-content {
                            font-family: "SimSun", "宋体", serif;
                            font-size: 14px;
                            line-height: 1.5;
                            color: #000;
                            width: 100%;
                            height: 100%;
                            overflow: hidden;
                            box-sizing: border-box;
                            /* macOS 字体渲染优化：禁用抗锯齿，提高针式打印机清晰度 */
                            -webkit-font-smoothing: none;
                            -moz-osx-font-smoothing: grayscale;
                            font-smooth: never;
                            text-rendering: optimizeSpeed; /* 优先速度而非质量，适合点阵打印 */
                        }
                        
                        .test-header {
                            text-align: center;
                            margin-bottom: 5mm; /* 减少边距 */
                            border-bottom: 2px solid #000;
                            padding-bottom: 3mm; /* 减少 padding */
                        }
                        
                        .test-header h2 {
                            font-size: 18px;
                            font-weight: bold;
                            margin: 0 0 5px 0;
                        }
                        
                        .test-header p {
                            font-size: 12px;
                            margin: 0;
                        }
                        
                        .test-ruler {
                            margin: 5mm 0; /* 减少边距 */
                            padding: 3mm; /* 减少 padding */
                            border: 1px solid #000;
                        }
                        
                        .ruler-line {
                            background-color: #ff0000;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        
                        .horizontal-ruler {
                            width: 100mm;
                            height: 2px;
                            margin-bottom: 5mm;
                        }
                        
                        .ruler-label {
                            font-size: 12px;
                            display: block;
                            margin-top: 3mm;
                        }
                        
                        .test-table {
                            margin-top: 5mm; /* 减少边距 */
                            width: 100%;
                            box-sizing: border-box;
                        }
                        
                        .test-table-header,
                        .test-table-row {
                            display: flex;
                            border-bottom: 1px solid #000;
                            padding: 2mm 0; /* 减少 padding */
                            width: 100%;
                            box-sizing: border-box;
                            flex-wrap: nowrap; /* 防止换行 */
                        }
                        
                        .test-table-header {
                            font-weight: bold;
                            background-color: #f0f0f0;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        
                        /* 调整列宽度，确保总宽度不超过100%，"小计"列稍微缩小 */
                        .col-10 { 
                            width: 10%; 
                            text-align: center; 
                            flex-shrink: 0;
                            box-sizing: border-box;
                        }
                        .col-15 { 
                            width: 15%; 
                            text-align: center; 
                            flex-shrink: 0;
                            box-sizing: border-box;
                        }
                        .col-20 { 
                            width: 18%; /* 从20%减少到18%，避免超出 */
                            text-align: right; 
                            padding-right: 2mm; /* 减少 padding */
                            flex-shrink: 0;
                            box-sizing: border-box;
                        }
                        .col-30 { 
                            width: 32%; /* 从30%增加到32%，补偿小计列的减少 */
                            text-align: left; 
                            padding-left: 2mm; /* 减少 padding */
                            flex-shrink: 0;
                            box-sizing: border-box;
                        }
                        
                        .test-footer {
                            margin-top: 5mm; /* 减少边距 */
                            padding-top: 3mm; /* 减少 padding */
                            border-top: 2px solid #000;
                            font-size: 14px;
                        }
                        
                        .test-footer p {
                            margin: 3mm 0;
                        }
                    </style>
                `;

                // 包装结构：外层固定纸张，内层缩放内容
                const wrapperHtml = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <title>打印系数测试</title>
                        ${styleTag}
                    </head>
                    <body>
                        <div class="print-paper-wrapper">
                            <div class="print-scaling-layer">
                                ${contentHtml}
                            </div>
                        </div>
                    </body>
                    </html>
                `;

                return wrapperHtml;
            },

            // 导出Excel方法
            async downLoadOnly() {
                console.log("=== downLoadOnly 开始导出Excel ===");
                const XLSXMod = await import('xlsx');
                const XLSX = XLSXMod.default || XLSXMod;

                const rows = this._filteredRows;
                if (!rows || rows.length === 0) {
                    console.error("❌ [downLoadOnly] 数据为空，无法导出");
                    await this.$refs.alertDialog.alert('没有数据可导出', 'warning');
                    return;
                }

                // 准备Excel数据
                const excelData = [];
                
                // 添加表头
                excelData.push(['序号', '商品', '规格', '数量', '单价', '小计']);
                
                // 添加数据行
                rows.forEach((item, index) => {
                    excelData.push([
                        index + 1,
                        item.nxDistributerGoodsEntity?.nxDgGoodsName || '',
                        item.nxDoPrintStandard || '',
                        item.nxDoWeight || '',
                        item.nxDoPrice || '',
                        item.nxDoSubtotal || ''
                    ]);
                });
                
                // 添加汇总行
                excelData.push(['', '', '', '', '合计', this.subtotalFormatted || this.subtotal]);
                
                // 创建工作表
                const ws = XLSX.utils.aoa_to_sheet(excelData);
                
                // 创建工作簿
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, '订单数据');
                
                // 生成文件名：部门名称_日期
                const fileName = `${this.depName}_${this.displayDate}.xlsx`;
                
                // 导出文件
                XLSX.writeFile(wb, fileName);
                
                console.log(`✅ [downLoadOnly] Excel导出成功，文件名: ${fileName}`);
            },

            numberToChinese(num, withZheng = true) {
                // 定义汉字数字
                const units = ["", "拾", "佰", "仟"];
                const sectionUnits = ["", "万", "亿", "万亿"];
                const numMap = ["零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"];

                if (num === 0) return withZheng ? "零元整" : "零元";

                // 分离整数和小数部分
                let [integer, decimal] = String(num).split(".");
                decimal = decimal ? decimal.slice(0, 2) : "";

                // 转换整数部分
                const integerToChinese = (integer) => {
                    let result = "";
                    let section = 0;
                    let zero = false;

                    // 处理整数部分
                    if (integer === "0" && decimal === "") {
                        return ""; // 如果整数部分为 0 且没有小数部分，则不返回“元”
                    }

                    while (integer.length > 0) {
                        let part = integer.slice(-4);  // 每4位为一段
                        integer = integer.slice(0, -4);
                        let str = "";

                        for (let i = 0; i < part.length; i++) {
                            const digit = Number(part[part.length - 1 - i]);
                            if (digit === 0) {
                                zero = true;
                            } else {
                                if (zero) {
                                    str = numMap[0] + str;
                                    zero = false;
                                }
                                str = numMap[digit] + units[i] + str;
                            }
                        }
                        if (str) {
                            result = str + sectionUnits[section] + result;
                        }
                        section++;
                    }
                    console.log("trannsnssnum==", num + "resl==" + result + "...")

                    if (result.length > 0) {
                        return result + "元";
                    } else {
                        return result;
                    }
                };

                // 转换小数部分
                const decimalToChinese = (decimal) => {
                    if (!decimal) return withZheng ? "整" : "";
                    let result = "";
                    if (decimal[0]) result += numMap[decimal[0]] + "角";
                    if (decimal[1]) result += numMap[decimal[1]] + "分";
                    return result;
                };

                // 整数部分 + 小数部分
                return integerToChinese(integer) + decimalToChinese(decimal);
            },


        }


    }
</script>


<style >

         /* ===== 打印专用样式 ===== */
    /* 注意：由于现在使用逐页打印模式，这些样式仅用于屏幕预览 */
    /* 实际打印时使用的是 injectPrintStyles() 注入的独立样式 */
              @media print {
         /* 已删除 @page 规则，统一使用 injectPrintStyles() 中的样式 */

        /* 打印根容器：用于屏幕预览 */
        /* 注意：宽度通过内联样式动态设置，这里不设置固定宽度 */
        #printAreaThirtyWhole {
            position: static !important;
            left: 0 !important;
            top: 0 !important;
            /* width 通过内联样式动态计算，根据缩放系数和左边距 */
            height: auto !important;           /* ←← 关键：允许内部多页自由扩展 */
            visibility: visible !important;
            margin: 0 !important;
            border: none !important;
            background: transparent !important;
            overflow: visible !important;      /* ← 防止内容被裁剪 */
        }

        body { margin: 0 !important; }

        /* 每一页的容器：禁止内部断页（仅用于预览） */
        .print-page {
            display: block;
            break-inside: avoid;               /* 新标准 */
            page-break-inside: avoid;          /* 兼容旧版 */
            margin-bottom: 0 !important;       /* 确保没有页间距 */
        }

        /* 让除最后一页外，强制在本页后断页（仅用于预览） */
        .print-page.page-break {
            break-after: page;                 /* 新标准 */
            page-break-after: always;          /* 兼容旧版 */
            /* 绝对不要添加 margin-bottom */
        }
    }

         /* ===== 打印页面样式 ===== */
    .print-page {
        margin-bottom: 0;
    }

    .print-header {
        padding: 4px 0;
        margin-bottom: 4px;
        width: 100%; /* 确保页头占满整个宽度 */
    }

    .print-header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%; /* 确保内容占满整个宽度 */
    }

    .print-left,
    .print-right {
        width: 30%; /* 从30%增加到35%，与显示层保持一致 */
    }

    .print-center {
        width: 40%; /* 从40%减少到30%，与显示层保持一致 */
        text-align: center;
    }

    .print-right{
        text-align: right;
    }

    .print-title {
        font-size: 18px;
        font-weight: bold;
    }

    .print-item {
        font-size: 14px;
        line-height: 25px;
    }

    .print-content-bill {
        border-left: 2px solid #000 !important;
        border-top: 2px solid #000 !important;
        border-bottom: 2px solid #000 !important;
        border-right: 2px solid #000 !important; /* ✅ 最右侧用 border 画，最稳定 */
        margin-top: 0; /* 减少表格顶部边距，避免空白 */
        margin-bottom: 0; /* 减少表格底部边距 */
        width: 100% !important;
        position: relative !important; /* 确保边框层级 */
        z-index: 1 !important; /* 提高边框优先级 */
        display: flex !important; /* 使用flexbox布局 */
        justify-content: center !important; /* 居中对齐，单列布局 */
    }

    /* 双列打印布局 */

    .print-fifty-column-container {
        width: 100% !important;
        box-sizing: border-box !important;
    }

    .print-table-header {
        display: flex;
        font-size: 12px;
        line-height: 25px;
        text-align: center;
        border-bottom: 1px solid #000;
        /*border-top: 1px solid #000;*/
        background-color: #f5f5f5;
        font-weight: bold;
        width: 100%;
        /*max-width: 100%;*/
        /*overflow: hidden;*/
    }

    .print-table-row {
        display: flex !important; /* 确保使用flexbox布局 */
        line-height: 25px;
        font-size: 12px;
        text-align: center;
        border-bottom: 1px solid #000;
        width: 100%; /* 确保表行占满整个宽度 */
    }

   

    .print-col {
        padding: 0; /* 移除内边距，避免宽度超出 */
        box-sizing: border-box; /* 边框包含在宽度内，不额外增加宽度 */
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden; /* 防止内容溢出 */
        flex-shrink: 0; /* 防止列收缩 */
        flex-grow: 0; /* 防止列扩展 */
    }

    /* 列宽（注意统一用 print- 前缀） */
    .print-col.print-ten     { flex-basis: 10%;  max-width: 10%;  border-right: 1px solid #000; box-sizing: border-box; }
    .print-col.print-thirty  { flex-basis: 30%;  max-width: 30%;  border-right: 1px solid #000; box-sizing: border-box; }
    .print-col.print-fifteen { flex-basis: 15%;  max-width: 15%;  border-right: 1px solid #000; box-sizing: border-box; }
    .print-col.print-twenty  { flex-basis: 15%;  max-width: 15%;  border-right: none; box-sizing: border-box; }

    /* 统一去掉每行最后一格的右边框（右边线由容器伪元素画） */
    .print-table-header .print-col:last-child,
    .print-table-row .print-col:last-child {
        border-right: none !important;
    }
    


    .print-summary {
        margin-top: 6px;
        padding: 4px 0;
    }

    .print-address {
        /*margin-top: 6px;*/
        /*padding: 4px 0;*/
        font-size: 14px;
    }

    .print-address-total {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 2px 8px;
        font-size: 14px;
        margin-top: 2px;
    }

    .print-address-total .address {
        text-align: left;
    }

    .print-address-total .total {
        text-align: right;
        font-weight: bold;
    }

    .print-subtotal {
        text-align: right;
        font-size: 14px;
        font-weight: bold;
        margin-bottom: 4px;
        padding: 4px 8px; /* 添加左右内边距，避免文字贴边 */
        border-left: 2px solid #000;
        border-right: 2px solid #000;
        border-bottom: 1px solid #000;
        box-sizing: border-box; /* 确保边框包含在宽度内 */
        /*width: 100%; !* 确保宽度不超出父容器 *!*/
        /*overflow: hidden; !* 防止内容溢出 *!*/
    }

    .print-header {
        padding: 4px 0;
        margin-bottom: 4px;
    }

    .print-header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .print-left,
    .print-right {
        flex: 1;
    }

    .print-center {
        flex: 2;
        text-align: center;
    }

    .print-title {
        font-size: 18px;
        font-weight: bold;
    }

    .print-item {
        font-size: 12px;
        line-height: 25px;
    }

    .print-footer {
        margin-top: 0;
        padding: 4px 0;
        text-align: right;
    }

    .print-total {
        font-size: 16px;
        font-weight: bold;
        text-align: right; /* 合计行右对齐，与小计行保持一致 */
        padding: 4px 8px; /* 添加左右内边距，避免文字贴边 */
        box-sizing: border-box; /* 确保内边距包含在宽度内 */
    }

    /* ===== 屏幕显示样式 ===== */
    .applyBodyPage {
        width: 100%;
        /* padding: 20px; */
        box-sizing: border-box;
        /* 确保内边距被包含在宽度内 */
        background-color: #fff;
        margin: 0;
        padding: 0;

    }

    .card {
        box-shadow: none;
        /* 移除阴影，避免影响打印 */
        padding: 0;
        /* 移除内边距 */
        min-height: unset;
        /* 根据需要调整 */
    }

    .p-20 {
        padding: 20px;

    }

    .headerPage {
        width: 100%;
        margin-bottom: 0; /* 减少页头底部边距 */
        font-size: 14px;
    }

    .header-content {
        display: flex;
        justify-content: space-between; /* 保持space-between，但调整宽度分配 */
    }

    .leftPage,
    .rightPage {
        width: 25%; /* 从30%增加到35%，确保左右两边有足够空间 */
    }


    .fifty_line {
        width: 55%; /* 减少地址列宽度，避免溢出 */
    }

    .centerPage {
        width: 40%; /* 增加小计列宽度，确保内容不溢出 */
        text-align: center; /* 小计信息右对齐 */

    }
    .rightPage{
        text-align: right;
    }

    .title {
        font-size: 18px;
        font-weight: bold;
    }

    .item {
        font-size: 14px;
        line-height: 25px;
    }

    .content-bill {
        display: flex;
        justify-content: center; /* 改为居中对齐，单列布局 */
        margin-top: 0; /* 减少表格顶部边距 */
        border: 1px solid #000; /* 加粗外边框，使用黑色 */
        box-sizing: border-box;
        /* 防止布局溢出 */
    }

    .whole-column-container{
        width: 100%; /* 单列占满整个宽度 */
        box-sizing: border-box;
    }



    .text-right {
        text-align: right;
    }

    .table-header {
        display: flex;
        flex-wrap: nowrap; /* 确保不换行 */
        justify-content: flex-start; /* 改为左对齐，让列按顺序排列 */
        font-size: 12px;
        line-height: 25px;
        text-align: center;
        border-bottom: 1px solid #000;
        border-top: 1px solid #000;
        margin-top: 0; /* 减少表头顶部边距 */
        margin-bottom: 0; /* 减少表头底部边距 */
        width: 100%; /* 确保表头占满整个宽度 */
    }

    /* .table-header .col {
        width: 16.66%;
        padding: 5px;
        box-sizing: border-box;
    } */

    .table-row {
        display: flex;
        flex-wrap: nowrap; /* 确保不换行 */
        justify-content: flex-start; /* 改为左对齐，让列按顺序排列 */
        line-height: 25px;
        font-size: 12px;
        text-align: center;
        border-bottom: 1px solid #000;
        width: 100%; /* 确保表行占满整个宽度 */
    }

    .summary {
        display: flex;
        justify-content: flex-start; /* 改为左对齐，避免中间空白 */
        /* margin-bottom: 20px; */
        font-size: 14px;
    }

    .footerPage {
        text-align: left;
        font-size: 14px;
    }

    .address {
        margin-top: 10px;
    }

    .address div {
        margin-bottom: 5px;
    }

    .pr-10 {
        padding-right: 10px;
    }

    .pl-10 {
        padding-left: 10px;
    }

    /* 显示表格的列宽度和右边线样式 */
    .ten {
        width: 10%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .thirty {
        width: 30%;
        border-right: 1px solid #000;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .fifteen {
        width: 15%;
        border-right: 1px solid #000;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .fifteen {
        width: 15%;
        border-right: 1px solid #000;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .twenty {
        width: 15%; /* 小计列宽度，从20%改为15% */
        border-right: 1px solid #000; /* 小计列右边框，加粗 */
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

* {
    box-sizing: border-box;
}

/* 打印蒙版样式 */
.printing-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
}

.printing-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: rgba(255, 255, 255, 0.1);
    padding: 40px;
    border-radius: 10px;
}

</style>


