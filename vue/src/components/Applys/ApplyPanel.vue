<template>

    <div class="applyBodyPage ">

        <div class=" card  shadow-lg p-20" style="min-height: 500px;">
            <!-- 页头 -->
            <div class="headerPage" >
                <div class="header-content">
                    <!-- 溯源类型布局（3行） -->
                    <template v-if="isTraceabilityType">
                        <div class="leftPage">
                            <div class="item">单位: {{ depName }}</div>
                            <div class="item">时间: {{ displayDate }}</div>
                            <div class="item">共{{ totalPages }}页 - 第{{ pagesIndex }}页</div>
                        </div>
                        <div class="centerPage" >
                            <div class="title">{{ disInfo.nxDistributerName }}</div>
                        </div>
                        <div class="rightPage" >
                            <div class="item" v-if="qrCodeUrl" style="text-align: right; height: 75px; display: flex; align-items: center; justify-content: flex-end;">
                                <img :src="qrCodeUrl" alt="订单二维码" style="width: 75px; height: 75px; display: block; image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges; object-fit: contain;" />
                            </div>
                        </div>
                    </template>
                    
                    <!-- 普通类型布局（2行） -->
                    <template v-else>
                        <div class="leftPage">
                            <div class="item">单位: {{ depName }}</div>
                            <div class="item">时间: {{ displayDate }}</div>
                        </div>
                        <div class="centerPage" >
                            <div class="title">{{ disInfo.nxDistributerName }} 送货单</div>
                        </div>

                        <div class="rightPage" >
                            <div class="item">共{{ totalPages }}页 - 第{{ pagesIndex }}页</div>
                            <div class="item">单号: {{ tradeNo }}</div>
                        </div>
                    </template>
                </div>
            </div>

            <!-- 打印校准面板 -->
            <div v-if="showCalibrationPanel" style="background: #f5f5f5; border: 1px solid #ddd; margin: 10px; padding: 15px; border-radius: 5px;">
                <h3 style="margin: 0 0 15px 0; color: #333;">🔧 打印校准设置</h3>
                
                <div style="display: flex; gap: 20px; flex-wrap: wrap; align-items: center;">
                    <!-- 左侧安全边距 -->
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <label style="font-weight: bold; min-width: 80px;">左侧边距:</label>
                        <button @click="adjustLeftMargin(-1)" style="background: #ff9800; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">-1mm</button>
                        <button @click="adjustLeftMargin(-0.5)" style="background: #ff9800; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">-0.5mm</button>
                        <span style="min-width: 40px; text-align: center; font-weight: bold;">{{ currentLeftMargin }}mm</span>
                        <button @click="adjustLeftMargin(0.5)" style="background: #4CAF50; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">+0.5mm</button>
                        <button @click="adjustLeftMargin(1)" style="background: #4CAF50; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">+1mm</button>
                    </div>

                    <!-- 右侧安全边距 -->
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <label style="font-weight: bold; min-width: 80px;">右侧边距:</label>
                        <button @click="adjustRightMargin(-1)" style="background: #ff9800; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">-1mm</button>
                        <button @click="adjustRightMargin(-0.5)" style="background: #ff9800; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">-0.5mm</button>
                        <span style="min-width: 40px; text-align: center; font-weight: bold;">{{ currentRightMargin }}mm</span>
                        <button @click="adjustRightMargin(0.5)" style="background: #4CAF50; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">+0.5mm</button>
                        <button @click="adjustRightMargin(1)" style="background: #4CAF50; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">+1mm</button>
                    </div>

                    <!-- 整体缩放 -->
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <label style="font-weight: bold; min-width: 80px;">整体缩放:</label>
                        <button @click="adjustScale(-0.01)" style="background: #ff9800; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">-0.01</button>
                        <button @click="adjustScale(-0.005)" style="background: #ff9800; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">-0.005</button>
                        <span style="min-width: 50px; text-align: center; font-weight: bold;">{{ currentScale }}</span>
                        <button @click="adjustScale(0.005)" style="background: #4CAF50; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">+0.005</button>
                        <button @click="adjustScale(0.01)" style="background: #4CAF50; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">+0.01</button>
                    </div>
                </div>

                <div style="margin-top: 15px; display: flex; gap: 10px; align-items: center;">
                    <button @click="printCalibrationPage()" style="background: #2196F3; color: white; border: none; padding: 8px 15px; border-radius: 3px; cursor: pointer;">
                        📄 打印校准页
                    </button>
                    <button @click="resetCalibration()" style="background: #FF9800; color: white; border: none; padding: 8px 15px; border-radius: 3px; cursor: pointer;">
                        🔄 恢复默认
                    </button>
                    <button @click="saveCurrentProfileAsDefault()" style="background: #9C27B0; color: white; border: none; padding: 8px 15px; border-radius: 3px; cursor: pointer;">
                        💾 保存配置
                    </button>
                    <button @click="showCalibrationPanel = false" style="background: #f44336; color: white; border: none; padding: 8px 15px; border-radius: 3px; cursor: pointer;">
                        ❌ 关闭
                    </button>
                </div>

                <div style="margin-top: 10px; padding: 10px; background: #e3f2fd; border-radius: 3px; font-size: 12px; color: #1976d2;">
                    <strong>使用说明：</strong><br>
                    1. 先打印校准页，检查右侧边框是否完整显示<br>
                    2. 如果右侧边框被裁掉，增加右侧边距或减小整体缩放<br>
                    3. 如果左侧内容被裁掉，增加左侧边距<br>
                    4. 调整满意后点击"保存配置"，系统会记住当前打印机的设置
                </div>
            </div>

            <!-- 订单内容部分 - 单列布局 -->
            <div class="content-bill">
                <!-- 单列容器 -->
                <div class="half-column-container">
                    <!-- 表头 -->
                    <div class="table-header">
                        <div class="ten">序号</div>
                        <div class="thirty">商品</div>
                        <div class="fifteen">规格</div>
                        <div class="ten">数量</div>
                        <div class="fifteen">单价</div>
                        <div class="twenty">小计</div>
                    </div>

                    <!-- 数据行 -->
                    <div class="table-row" v-for="(item, index) in currentPageData.dualRows"
                         :key="'row-' + index">
                        <div class="ten">{{ (pagesIndex - 1) * pageRowsCount + index + 1 }}</div>
                        <div class="thirty">{{ item.nxDistributerGoodsEntity?.nxDgGoodsName }}</div>
                        <div class="fifteen">{{ item.nxDistributerGoodsEntity?.nxDgGoodsStandardname }}</div>
                        <div class="ten">{{ item.nxDoWeight }}</div>
                        <div class="fifteen">{{ item.nxDoPrice }}</div>
                        <div class="twenty">{{ item.nxDoSubtotal }}</div>
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
        <div id="printAreaPanel" class="print-area" ref="printArea"
             style="position: absolute; left: -9999px; top: -9999px; width: 195mm; height: auto; box-sizing: border-box;">
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
                                <div class="print-item">共{{ totalPages }}页 - 第{{ page.pageIndex }}页</div>
                            </div>
                            <div class="print-center">
                                <div class="print-title">{{ disInfo?.nxDistributerName || '配送商' }}</div>
                            </div>
                            <div class="print-right">
                                <div class="print-item" v-if="qrCodeUrl" style="text-align: right; height: 75px; display: flex; align-items: center; justify-content: flex-end;">
                                    <img :src="qrCodeUrl" alt="订单二维码" style="width: 75px; height: 75px; display: block; image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges; object-fit: contain;" />
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
                                <div class="print-title">{{ disInfo?.nxDistributerName || '配送商' }}</div>
                            </div>
                            <div class="print-right">
                                <div class="print-item">共{{ totalPages }}页 - 第{{ page.pageIndex }}页</div>
                                <div class="print-item">单号: {{ tradeNo }}</div>
                            </div>
                        </template>
                    </div>
                </div>

                                <!-- 表格容器 - 单列布局 -->
                <div class="print-content-bill">
                    <!-- 单列容器 -->
                    <div class="print-fifty-column-container">
                    <!-- 表头 -->
                    <div class="print-table-header">
                            <div class="print-col print-ten">序号</div>
                            <div class="print-col print-thirty">商品</div>
                            <div class="print-col print-fifteen">规格</div>
                            <div class="print-col print-ten">数量</div>
                            <div class="print-col print-fifteen">单价</div>
                            <div class="print-col print-twenty">小计</div>
                    </div>

                        <!-- 数据行 -->
                    <div
                                v-for="(item, rowIndex) in page.dualRows"
                                :key="'row-' + rowIndex"
                        class="print-table-row"
                        >
                            <div class="print-col print-ten">{{ ((page.pageIndex - 1) * pageRowsCount + rowIndex + 1) }}</div>
                            <div class="print-col print-thirty">{{ item.nxDistributerGoodsEntity?.nxDgGoodsName }}</div>
                            <div class="print-col print-fifteen">{{ item.nxDistributerGoodsEntity?.nxDgGoodsStandardname }}</div>
                            <div class="print-col print-ten">{{ item.nxDoWeight }}</div>
                            <div class="print-col print-fifteen">{{ item.nxDoPrice }}</div>
                            <div class="print-col print-twenty">{{ item.nxDoSubtotal }}</div>
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


        </div>

</template>


<script>
import api from '@/api/all'
import QRCode from 'qrcode'
    import {mapState} from 'vuex';
    import * as XLSX from 'xlsx';

    export default {
    name: "ApplyPanel",
    props: ['nxDepFatherId', 'nxDepId', 'depName', 'depPrintName', 
            'updateTime', 'gbDepFatherId', 'gbDepId', 'gbDisId', 'gbBatchId', 'orderData'],
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
                const filteredLength = this._filteredRows.length;
                const totalPages = Math.ceil(filteredLength / this.pageRowsCount) || 0;
                console.log('🔍 分页调试信息:', {
                    filteredRowsLength: filteredLength,
                    pageRowsCount: this.pageRowsCount,
                    totalPages: totalPages,
                    calculation: `${filteredLength} / ${this.pageRowsCount} = ${totalPages}`
                });
                return totalPages;
            },

            ...mapState(['loading', 'disUser']),
                        currentPageData() {
                const rows = this._filteredRows;
                if (rows.length === 0) {
                    return { dualRows: [], pageSubtotal: 0, pageSubtotalHanzi: '零元' };
                }
                const start = (this.pagesIndex - 1) * this.pageRowsCount;
                const end   = Math.min(start + this.pageRowsCount, rows.length);
                const pageData = rows.slice(start, end);

                const pageSubtotal = pageData.reduce((acc, it) => acc + parseFloat(it.nxDoSubtotal || 0), 0);
            const pageSubtotalFormatted = parseFloat(pageSubtotal.toFixed(1));

            return {
                    dualRows: pageData,
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
                       this.disUser.nxDistributerEntity.nxDistributerBusinessTypeId == 4;
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
                
                console.log('🔍 打印页面数据生成:', {
                    totalRows: rows.length,
                    pageRowsCount: this.pageRowsCount,
                    totalPages: totalPages
                });
                
            for (let pageIndex = 1; pageIndex <= totalPages; pageIndex++) {
                    const startIndex = (pageIndex - 1) * this.pageRowsCount;
                    const endIndex   = Math.min(pageIndex * this.pageRowsCount, rows.length);
                    const pageData   = rows.slice(startIndex, endIndex);

                    console.log(`🔍 第${pageIndex}页数据:`, {
                        startIndex,
                        endIndex,
                        pageDataLength: pageData.length,
                        pageBreak: pageIndex < totalPages,
                        isLastPage: pageIndex === totalPages
                    });

                    const pageSubtotal = pageData.reduce((acc, it) => acc + parseFloat(it.nxDoSubtotal || 0), 0);
                const pageSubtotalFormatted = parseFloat(pageSubtotal.toFixed(1));

                pages.push({
                    pageIndex,
                    isLastPage: pageIndex === totalPages,
                    isMultiplePages: totalPages > 1,
                        dualRows: pageData,
                        pageSubtotal,
                        pageSubtotalFormatted,
                        pageSubtotalHanzi: this.numberToChinese(pageSubtotalFormatted, false),
                    });
                }
            return pages;
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
                    console.log("=== orderData 更新 (历史订单) ===");
                    console.log("历史订单数据条数:", newVal.arr?.length || newVal.nxDepartmentOrdersEntities?.length);
                    
                    // 详细检查 bill 对象结构
                    console.log("🔍 bill 对象详情:", {
                        hasBill: !!newVal.bill,
                        billKeys: newVal.bill ? Object.keys(newVal.bill) : [],
                        nxDbTradeNo: newVal.bill?.nxDbTradeNo,
                        nxDbTradeNoType: typeof newVal.bill?.nxDbTradeNo,
                        nxDbTotal: newVal.bill?.nxDbTotal,
                        nxDbTotalType: typeof newVal.bill?.nxDbTotal,
                        nxDbDate: newVal.bill?.nxDbDate,
                        nxDbDateType: typeof newVal.bill?.nxDbDate,
                        billSample: newVal.bill ? JSON.stringify(newVal.bill).substring(0, 200) + "..." : "无bill数据"
                    });
                    
                    // 设置历史订单数据
                    this.tradeNo = newVal.bill?.nxDbTradeNo || '';
                    this.subtotal = parseFloat(newVal.bill?.nxDbTotal) || 0;
                    this.orderDate = newVal.bill?.nxDbDate || '';
                    // 生成二维码
                    this.generateQRCode();
                    console.log("🔍 设置历史订单数据:", {
                        tradeNo: this.tradeNo,
                        subtotal: this.subtotal,
                        orderDate: this.orderDate
                    });
                    
                    // 强制重新计算页数
                    this.$nextTick(() => {
                        const calculatedPages = this.totalPages;
                        console.log("🔍 orderData 更新后总页数:", calculatedPages);
                    });
                }
            },
            
            applyArrPrint(newVal) {
                console.log("=== applyArrPrint 更新 ===");
                console.log("新数据条数:", newVal.length);
                console.log("前几条预览:", JSON.stringify(newVal.slice(0, 3)));

                this.$nextTick(() => {
                    setTimeout(() => {
                        const printArea = this.$refs.printArea;
                        console.log("watch 检查 printPagesData 条数:", this.printPagesData.length);
                        if (printArea) {
                            console.log("watch 检查 printArea 子元素数量:", printArea.children.length);
                            console.log("watch 打印区域 HTML 预览:", printArea.outerHTML.substring(0, 200) + "...");
                        } else {
                            console.warn("watch: printArea 还没挂载");
                        }
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
                pageRowsCount: 30, // 每页行数，单列布局每页30行
                showCalibrationPanel: false, // 控制打印校准面板显示
                currentLeftMargin: 12, // 当前左侧边距
                currentRightMargin: 15, // 当前右侧边距
                currentScale: 0.98, // 当前缩放比例

            }
        },


        // 组件挂载时初始化
        async mounted() {
            console.log("ApplyPanel mounted");
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
                const printArea = document.getElementById('printAreaPanel');
                if (printArea) {
                    const rect = printArea.getBoundingClientRect();
                    this.printWidth = rect.width.toFixed(2);
                    this.printHeight = rect.height.toFixed(2);
                }
            });
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
            // 构建单页 HTML（逐页打印）
            buildSinglePageHtml(pageData, pageIndex, totalPages) {
                console.log(`📄 [buildSinglePageHtml] 开始构建第${pageIndex}页, 总页数: ${totalPages}`);
                console.log(`📄 [buildSinglePageHtml] isTraceabilityType: ${this.isTraceabilityType}`);
                const isLastPage = !!pageData.isLastPage;
                
                // 根据 isTraceabilityType 构建不同的 headerHtml
                const headerHtml = this.isTraceabilityType ? `
                    <div class="print-header">
                        <div class="print-header-content">
                            <!-- 溯源类型布局（3行） -->
                            <div class="print-left">
                                <div class="print-item">单位: ${this.depName || ''}</div>
                                <div class="print-item">时间: ${this.displayDate}</div>
                                <div class="print-item">共${totalPages}页 - 第${pageIndex}页 </div>
                            </div>
                            <div class="print-center">
                                <div class="print-title">${this.disInfo?.nxDistributerName || '配送商'}</div>
                            </div>
                            <div class="print-right">
                                ${this.qrCodeUrl ? `<div class="print-item" style="text-align: right; height: 75px; display: flex; align-items: center; justify-content: flex-end;"><img src="${this.qrCodeUrl}" alt="订单二维码" style="width: 75px; height: 75px; display: block; image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges; object-fit: contain;" /></div>` : ''}
                            </div>
                        </div>
                    </div>` : `
                    <div class="print-header">
                        <div class="print-header-content">
                            <!-- 普通类型布局（2行） -->
                            <div class="print-left">
                                <div class="print-item">单位: ${this.depName || ''}</div>
                                <div class="print-item">时间: ${this.displayDate}</div>
                            </div>
                            <div class="print-center">
                                <div class="print-title">${this.disInfo?.nxDistributerName || '配送商'} 送货单</div>
                            </div>
                            <div class="print-right">
                                <div class="print-item">共${totalPages}页 - 第${pageIndex}页</div>
                                <div class="print-item">单号: ${this.tradeNo || ''}</div>
                            </div>
                        </div>
                    </div>`;

                const tableHeaderHtml = `
                    <div class="print-table-header">
                        <div class="print-col print-ten">序号</div>
                        <div class="print-col print-thirty">商品</div>
                        <div class="print-col print-fifteen">规格</div>
                        <div class="print-col print-ten">数量</div>
                        <div class="print-col print-fifteen">单价</div>
                        <div class="print-col print-twenty">小计</div>
                    </div>`;

                const rowsHtml = (pageData.dualRows || []).map((item, rowIndex) => {
                    const seq = ((pageIndex - 1) * this.pageRowsCount) + rowIndex + 1;
                    const name = item.nxDistributerGoodsEntity?.nxDgGoodsName || '';
                    const std  = item.nxDistributerGoodsEntity?.nxDgGoodsStandardname || '';
                    const qty  = item.nxDoWeight ?? '';
                    const price= item.nxDoPrice ?? '';
                    const sub  = item.nxDoSubtotal ?? '';
                    return `
                        <div class="print-table-row">
                            <div class="print-col print-ten">${seq}</div>
                            <div class="print-col print-thirty">${name}</div>
                            <div class="print-col print-fifteen">${std}</div>
                            <div class="print-col print-ten">${qty}</div>
                            <div class="print-col print-fifteen">${price}</div>
                            <div class="print-col print-twenty">${sub}</div>
                        </div>`;
                }).join('');

                const tableHtml = `
                    <div class="print-content-bill">
                        <div class="print-fifty-column-container">
                            ${tableHeaderHtml}
                            ${rowsHtml}
                        </div>
                    </div>`;

                const subtotalHtml = (totalPages > 1) ? `
                    <div class="print-subtotal">第${pageIndex}页小计：${pageData.pageSubtotalHanzi} ${pageData.pageSubtotalFormatted || pageData.pageSubtotal}元</div>` : '';

                const addressOrTotalHtml = isLastPage
                    ? `<div class="print-address-total"><span class="address">地址: ${this.disInfo?.nxDistributerAddress || '暂无地址'}</span><span class="total">${this.subtotalHanzi} 合计: ${this.subtotalFormatted || this.subtotal}元</span></div>`
                    : `<div class="print-address">地址: ${this.disInfo?.nxDistributerAddress || '暂无地址'}</div>`;

                const singlePageHtml = `
                    <div id="printAreaPanel" class="print-area">
                        <div class="print-page">
                            <div class="print-page-content">
                                ${headerHtml}
                                ${tableHtml}
                                ${subtotalHtml}
                                ${addressOrTotalHtml}
                            </div>
                        </div>
                    </div>`;

                console.log(`📄 [buildSinglePageHtml] 第${pageIndex}页HTML构建完成, 长度: ${singlePageHtml.length}`);
                return singlePageHtml;
            },

            // 注入打印样式（逐页打印，带 1mm 缓冲）
            injectPrintStyles(singlePageHtml) {
                console.log("🎨 [injectPrintStyles] 开始注入打印样式");
                const styleTag = `
                    <style>
                        /* 全局打印参数 */
                        :root {
                            --page-width-mm: 240;
                            --page-height-mm: 279;
                            --bleed-mm: 1;
                            --safe-left-mm: ${this.currentLeftMargin};
                            --safe-right-mm: ${this.currentRightMargin};
                            --content-scale: ${this.currentScale};
                        }

                        @media print {
                            @page { size: 240mm 279mm; margin: 0 !important; }

                            * { visibility: visible !important; }
                            body { margin: 0 !important; padding: 0 !important; }

                            .print-page {
                                box-sizing: border-box !important;
                                width: calc((var(--page-width-mm) - var(--safe-left-mm) - var(--safe-right-mm)) * 1mm) !important;
                                height: calc(var(--page-height-mm) * 1mm - var(--bleed-mm) * 1mm) !important;
                                padding: 10mm calc(var(--safe-right-mm) * 1mm) 5mm calc(var(--safe-left-mm) * 1mm) !important;
                                overflow: hidden !important;
                                display: flex !important;
                                flex-direction: column !important;
                                position: relative !important;
                                margin: 0 !important;
                                break-after: auto !important;
                                page-break-after: auto !important;
                            }

                            .print-page.page-break { break-after: auto !important; page-break-after: auto !important; }

                            .print-page-content {
                                width: 100% !important;
                                height: 100% !important;
                                transform: scale(var(--content-scale)) !important;
                                transform-origin: top center !important;
                                display: flex !important;
                                flex-direction: column !important;
                                box-sizing: border-box !important;
                                overflow: visible !important;
                                min-width: 0 !important;
                            }

                            /* ===== 打印页头三栏布局（打印专用） ===== */
                            .print-header { 
                                width: 100% !important;
                                padding: 2px 0 !important;
                                margin-bottom: 0 !important; 
                                box-sizing: border-box !important;
                            }

                            .print-header-content {
                                position: relative !important;        /* 给中间绝对居中做参照 */
                                display: flex !important;
                                align-items: center !important;
                                justify-content: space-between !important;  /* 左右两栏各就各位 */
                                width: 100% !important;
                            }

                            /* 左右两栏正常流，不影响中间绝对居中 */
                            .print-left  { flex: 1 !important; }
                            .print-right { flex: 1 !important; text-align: right !important; }

                            /* 中间标题用“绝对居中”，不受左右宽度影响 */
                            .print-center {
                                position: absolute !important;
                                left: 50% !important;
                                transform: translateX(-50%) !important;
                                text-align: center !important;
                                white-space: nowrap !important;       /* 避免被换行挤偏 */
                                max-width: 70% !important;            /* 防长标题出界 */
                                overflow: hidden !important;
                                text-overflow: ellipsis !important;
                            }

                            /* 标题样式 */
                            .print-title {
                                font-size: 18px !important;
                                font-weight: 700 !important;
                                letter-spacing: 0.5px !important;
                            }

                            /* 左右信息字体（与 ApplyFiftyPanel 对齐） */
                            .print-item { 
                                font-size: 12px !important; 
                                line-height: 24px !important; 
                                font-weight: 600 !important;
                            }

                            .print-content-bill {
                                border: 2px solid #000 !important;
                                border-right: 2px solid #000 !important;
                                width: 100% !important;
                                max-width: 100% !important;
                                box-sizing: border-box !important;
                                position: relative !important;
                                flex-shrink: 0 !important;
                                overflow: visible !important;
                                margin-top: 0 !important;
                                margin-bottom: 0 !important;
                            }

                            .print-fifty-column-container { width: 100% !important; box-sizing: border-box !important; }
                            .print-table-header { display: flex !important; font-size: 12px !important; line-height: 24px !important; text-align: center !important; border-bottom: 1px solid #000 !important; font-weight: bold !important; }
                            .print-table-row { display: flex !important; line-height: 24px !important; font-size: 12px !important; text-align: center !important; border-bottom: 1px solid #000 !important; flex-wrap: nowrap !important; }
                            .print-col { padding: 0 !important; box-sizing: border-box !important; display: flex !important; align-items: center !important; justify-content: center !important; font-size: 12px !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; flex-shrink: 0 !important; flex-grow: 0 !important; }
                            .print-col { flex: 0 0 auto; min-width: 0; border-right: 1px solid #000; }
                            .print-col.print-ten     { flex-basis: 10%;  max-width: 10%; }
                            .print-col.print-thirty  { flex-basis: 30%;  max-width: 30%; }
                            .print-col.print-fifteen { flex-basis: 15%;  max-width: 15%; }
                            .print-col.print-twenty  { flex-basis: 20%;  max-width: 20%; text-align: right !important; padding-right: 2mm !important; }
                            .print-table-header .print-col:last-child, .print-table-row .print-col:last-child { border-right: none !important; }

                            .print-subtotal { text-align: right; font-size: 14px; font-weight: bold; margin-bottom: 4px; padding: 4px 8px; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px solid #000; box-sizing: border-box; overflow: hidden; }
                            .print-address-total { display: flex; justify-content: space-between; align-items: center; padding: 2px 8px; font-size: 14px; margin-top: 2px; }
                            .print-address-total .address { text-align: left; }
                            .print-address-total .total { text-align: right; font-weight: bold; }
                            .print-address { margin-top: 2px; padding: 2px 0; font-size: 14px; }
                        }
                    </style>
                `;

                const finalHtml = styleTag + singlePageHtml;
                console.log("🎨 [injectPrintStyles] 样式注入完成", {
                    htmlLength: finalHtml.length,
                    pageWidthMm: 240,
                    pageHeightMm: 279,
                    bleedMm: 1,
                    safeLeftMm: this.currentLeftMargin,
                    safeRightMm: this.currentRightMargin,
                    contentScale: this.currentScale
                });
                return finalHtml;
            },

            // ==================== 数据重载相关方法 ====================
            
            // 统一入口：参数变化 → 重置 + 拉数据
            async reloadByContext() {
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
            
            // 应用打印机配置文件
            applyPrinterProfile(profile) {
                const root = document.documentElement.style;
                this.currentLeftMargin = profile.safeLeftMm || 10;
                this.currentRightMargin = profile.safeRightMm || 10;
                this.currentScale = profile.scale || 1;
                root.setProperty('--safe-left-mm', String(this.currentLeftMargin));
                root.setProperty('--safe-right-mm', String(this.currentRightMargin));
                root.setProperty('--content-scale', String(this.currentScale));
                console.log('应用打印机配置:', profile);
            },

            // 保存打印机配置文件
            savePrinterProfile(deviceName, profile) {
                const key = 'printerProfile:' + deviceName;
                localStorage.setItem(key, JSON.stringify(profile));
                console.log('保存打印机配置:', deviceName, profile);
            },

            // 加载打印机配置文件
            loadPrinterProfile(deviceName) {
                const key = 'printerProfile:' + deviceName;
                const json = localStorage.getItem(key);
                const defaultProfile = { safeLeftMm: 12, safeRightMm: 12, scale: 0.98 };
                const profile = json ? JSON.parse(json) : defaultProfile;
                console.log('加载打印机配置:', deviceName, profile);
                return profile;
            },

            // 获取当前打印机名称（需要与Electron主进程配合）
            async getCurrentPrinterName() {
                try {
                    // 这里需要与Electron主进程配合，获取当前选择的打印机
                    // 暂时返回默认值，实际使用时需要调用Electron API
                    if (window.electronAPI && window.electronAPI.getSelectedPrinterName) {
                        return await window.electronAPI.getSelectedPrinterName();
                    }
                    return 'default-printer';
                } catch (error) {
                    console.warn('获取打印机名称失败:', error);
                    return 'default-printer';
                }
            },

            // 初始化打印机配置
            async initPrinterProfile() {
                try {
                    const deviceName = await this.getCurrentPrinterName();
                    const profile = this.loadPrinterProfile(deviceName);
                    this.applyPrinterProfile(profile);
                } catch (error) {
                    console.warn('初始化打印机配置失败:', error);
                    // 使用默认配置
                    this.applyPrinterProfile({ safeLeftMm: 12, safeRightMm: 15, scale: 0.98 });
                }
            },

            // 微调左侧安全边距
            adjustLeftMargin(delta) {
                const newValue = Math.max(5, Math.min(20, this.currentLeftMargin + delta));
                this.currentLeftMargin = newValue;
                document.documentElement.style.setProperty('--safe-left-mm', String(newValue));
                console.log('调整左侧安全边距:', newValue);
            },

            // 微调右侧安全边距
            adjustRightMargin(delta) {
                const newValue = Math.max(5, Math.min(20, this.currentRightMargin + delta));
                this.currentRightMargin = newValue;
                document.documentElement.style.setProperty('--safe-right-mm', String(newValue));
                console.log('调整右侧安全边距:', newValue);
            },

            // 微调整体缩放
            adjustScale(delta) {
                const newValue = Math.max(0.95, Math.min(1.05, this.currentScale + delta));
                this.currentScale = newValue;
                document.documentElement.style.setProperty('--content-scale', String(newValue));
                console.log('调整整体缩放:', newValue);
            },

            // 保存当前配置为默认值
            async saveCurrentProfileAsDefault() {
                try {
                    const deviceName = await this.getCurrentPrinterName();
                    const currentProfile = {
                        safeLeftMm: this.currentLeftMargin,
                        safeRightMm: this.currentRightMargin,
                        scale: this.currentScale
                    };
                    this.savePrinterProfile(deviceName, currentProfile);
                    alert(`已保存 ${deviceName} 的打印配置！`);
                } catch (error) {
                    console.error('保存配置失败:', error);
                    alert('保存配置失败，请重试');
                }
            },

            // 恢复默认配置
            resetCalibration() {
                this.applyPrinterProfile({ safeLeftMm: 12, safeRightMm: 12, scale: 0.98 });
                console.log('已恢复默认打印配置');
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
                            @page { size: 240mm 279mm; margin: 3mm; }
                            body { margin: 0; font-family: Arial, sans-serif; }
                            .calibration-container {
                                width: 220mm;
                                height: 273mm;
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
                        this.subtotal = res.data.data.nxDbTotal || res.data.data.total;
                    this.subtotalHanzi = res.data.data.totalHanzi;
                        this.orderDate = res.data.data.nxDbDate || '';
                    this.applyArrPrint = res.data.data.arr;
                    // 生成二维码
                    this.generateQRCode();

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
                    this.subtotal = res.data.data.total;
                    this.subtotalHanzi = res.data.data.totalHanzi;
                    this.applyArrPrint = res.data.data.arr;
                    // 生成二维码
                    this.generateQRCode();

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
                console.error("保存账单失败:", error);
                throw error; // 将错误抛出以便在 saveOrderAndPrint 中捕获
            }
        },


        // 计算需要的打印页数
            // 可选：仅返回值，不改任何 state
        calculateTotalPages() {
                return Math.ceil(this._filteredRows.length / this.pageRowsCount) || 0;
            },


                // 打印页面的逻辑（逐页打印）
        async printOnly() {
            console.log("=== printOnly 开始（逐页打印模式）===");
            console.log("📊 [printOnly] 准备打印, 总页数:", this.printPagesData.length);

            if (!this.printPagesData || this.printPagesData.length === 0) {
                console.error("❌ [printOnly] printPagesData为空，无法打印");
                return;
            }

            if (typeof window.electronAPI === 'undefined') {
                console.warn("⚠️ [printOnly] 警告：不在Electron环境中，无法调用打印功能");
                return;
            }

            for (let i = 0; i < this.printPagesData.length; i++) {
                const pageData = this.printPagesData[i];
                const pageIndex = pageData.pageIndex || (i + 1);
                const totalPages = this.printPagesData.length;
                
                // 判断是否是最后一页：只在最后一页保存
                const isLastPage = pageData.isLastPage;
                const paperCount = totalPages; // 总页数
                const shouldSave = isLastPage; // 只在最后一页保存

                console.log(`\n🖨️ [printOnly] ========== 开始打印第 ${pageIndex}/${totalPages} 页 ==========`);
                console.log(`🖨️ [printOnly] 页面数据:`, {
                    pageIndex: pageIndex,
                    isLastPage: isLastPage,
                    rowsCount: pageData.dualRows?.length || 0,
                    pageSubtotal: pageData.pageSubtotalFormatted,
                    shouldSave: shouldSave
                });

                try {
                    // 1. 构建单页HTML
                    const singlePageHtml = this.buildSinglePageHtml(pageData, pageIndex, totalPages);

                    // 2. 注入打印样式
                    const finalHtmlForThisPage = this.injectPrintStyles(singlePageHtml);

                    // 3. 清理Vue特殊属性
                    let cleanHtml = finalHtmlForThisPage.replace(/data-v-[a-zA-Z0-9]+=""/g, '');
                    cleanHtml = cleanHtml.replace(/data-v-[a-zA-Z0-9]+/g, '');

                    console.log(`🖨️ [printOnly] 第${pageIndex}页HTML准备完成`, {
                        length: cleanHtml.length,
                        safeLeftMm: this.currentLeftMargin,
                        safeRightMm: this.currentRightMargin,
                        contentScale: this.currentScale,
                        pageHeightMm: 279,
                        bleedMm: 1
                    });

                    const pageSpecificTradeNo = totalPages > 1 ? `${this.tradeNo}-${pageIndex}` : this.tradeNo;
                    console.log(`🖨️ [printOnly] 准备发送第${pageIndex}页到打印机`);

                    let printResult;
                    if (this.nxDepFatherId !== -1) {
                        printResult = await window.electronAPI.sendPrintRequestWithCallback(
                            cleanHtml,
                            this.nxDepFatherId,
                            this.nxDepId,
                            this.tradeNo,  // 使用原始tradeNo，不用带页码
                            this.disUser.nxDistributerUserId,
                            paperCount,  // 传入总页数
                            shouldSave   // 只在最后一页为true
                        );
                    } else if (this.gbDepFatherId !== -1) {
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
                    } else if (this.gbBatchId !== -1) {
                        printResult = await window.electronAPI.sendPrintRequestGbBatchWithCallback(
                            cleanHtml,
                            this.gbBatchId,
                            paperCount,  // 传入总页数
                            shouldSave   // 只在最后一页为true
                        );
                    } else {
                        console.error("❌ [printOnly] 错误：所有ID都为-1，无法确定调用哪个打印接口！");
                        return;
                    }

                    console.log(`✅ [printOnly] 第${pageIndex}页打印任务已提交（收到IPC回执）`, printResult);

                    if (i < this.printPagesData.length - 1) {
                        const physicalPrintTime = 1500;
                        console.log(`⏳ [printOnly] 等待${physicalPrintTime}ms，让打印机完成物理打印和走纸（279mm纸张需要约1.5秒）...`);
                        await new Promise(resolve => setTimeout(resolve, physicalPrintTime));
                        console.log(`✅ [printOnly] 物理打印和走纸完成，准备打印下一页（第${pageIndex + 1}页）`);
                    }

                } catch (error) {
                    console.error(`❌ [printOnly] 打印第${pageIndex}页时出错:`, error);
                    continue;
                }
            }

            console.log("\n✅ [printOnly] ========== 所有页面打印完成 ==========");
            console.log(`✅ [printOnly] 总计打印 ${this.printPagesData.length} 页`);
        },

        // 导出Excel方法
        downLoadOnly() {
            console.log("=== downLoadOnly 开始导出Excel ===");
            
            const rows = this._filteredRows;
            if (!rows || rows.length === 0) {
                console.error("❌ [downLoadOnly] 数据为空，无法导出");
                alert('没有数据可导出');
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
                    item.nxDistributerGoodsEntity?.nxDgGoodsStandardname || '',
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
    /* —— 打印介质：只控制页面尺寸和容器回到可视区域 —— */
@media print {
    @page {
            size: 240mm 279mm;
            margin: 8mm 15mm 5mm 12mm;  /* 上 右 下 左 - 一张纸尺寸，增加顶部边距 */
        }

        /* 打印根容器：一定要 auto 高度！别再写死 279mm */
        #printAreaPanel {
            position: static !important;
            left: 0 !important;
            top: 0 !important;
            width: 213mm !important;  /* 240mm - 12mm - 15mm = 213mm */
            height: auto !important;           /* ←← 关键：允许内部多页自由扩展 */
            visibility: visible !important;
            margin: 0 !important;
            border: none !important;
            background: transparent !important;
            overflow: visible !important;      /* ← 防止内容被裁剪 */
        }

        body { margin: 0 !important; }

        /* 每一页的容器：禁止内部断页 */
    .print-page {
            display: block;
            break-inside: avoid;               /* 新标准 */
            page-break-inside: avoid;          /* 兼容旧版 */
        }

        /* 让除最后一页外，强制在本页后断页 */
        .print-page.page-break {
            break-after: page;                 /* 新标准 */
            page-break-after: always;          /* 兼容旧版 */
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
    .print-col.print-twenty  { flex-basis: 20%;  max-width: 20%;  border-right: none; box-sizing: border-box; }

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

    .half-column-container{
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

.twenty {
        width: 20%; /* 小计列宽度，从20%减少到19% */
        border-right: 1px solid #000; /* 小计列右边框，加粗 */
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
}

* {
    box-sizing: border-box;
}


</style>
