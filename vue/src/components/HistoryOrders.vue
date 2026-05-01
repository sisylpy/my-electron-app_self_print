<template>
  <div class="history-order-tab">
    <!-- 有历史订单数据 -->
    <div v-if="accountBillData && accountBillData.length > 0">
      <!-- 月份标签页 -->
      <ul class="nav nav-tabs mb-3" id="monthTabs" role="tablist">
        <li class="nav-item" v-for="(month, index) in groupedAccountBillData"
            :key="month.month" role="presentation">
          <button
              class="nav-link"
              :class="{ 'active': index === activeMonthIndex }"
              :id="'month-' + month.month + '-tab'"
              type="button"
              role="tab"
              @click="handleSwitchMonthTab(index)">
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
               @click="handleOpenOrderDetail(item)">

            <!-- 订单信息 -->
            <div class="order-info">
              <div v-if="item.nxDbDepId !== item.nxDbDepFatherId"
                   class="d-flex align-items-center" style="margin-bottom: 2px;">
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
                  <span v-if="item.nxDbTotal < 0"
                        class="badge bg-warning ms-2">（退货）</span>
                </div>
                <div v-if="item.nxDbStatus == 0" class="small text-danger">未结账</div>
                <div v-else class="small text-success">已结账</div>
              </div>

              <button
                      class="btn btn-outline-primary btn-sm"
                      @click.stop="handleDownloadExcel(item)"
                      :disabled="downloadExcelLoading === item.nxDepartmentBillId"
                      title="下载订单详情">
                {{ downloadExcelLoading === item.nxDepartmentBillId ? '下载中...' : '下载Excel' }}
              </button>
              <!-- 查看详情按钮 -->
              <button
                  class="btn btn-outline-primary btn-sm"
                  @click.stop="handleOpenOrderDetail(item)"
                  title="查看订单详情">
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
</template>

<script>
import api from '../api/all';

export default {
  name: 'HistoryOrders',
  props: {
    selectedAllCustomer: {
      type: [Number, String],
      default: null
    }
  },
  data() {
    return {
      accountBillData: [], // 客户历史订单数据
      activeMonthIndex: 0, // 当前激活的月份索引
      downloadExcelLoading: null // 正在下载的账单ID
    };
  },
  computed: {
    disUser() {
      return this.$store.state.disUser;
    },
    groupedAccountBillData() {
      if (!this.accountBillData || this.accountBillData.length === 0) {
        return [];
      }
      return this.accountBillData.map((monthData) => {
        return {
          month: monthData.month,
          arr: monthData.arr || [],
          unSettleTotal: monthData.unSettleTotal || 0,
          subDeps: monthData.subDeps || []
        };
      }).filter(month => month.arr && month.arr.length > 0);
    }
  },
  watch: {
    selectedAllCustomer: {
      handler(newVal) {
        if (newVal) {
          this.fetchCustomerHistoryOrders(newVal);
        } else {
          this.accountBillData = [];
          this.activeMonthIndex = 0;
        }
      },
      immediate: true
    }
  },
  methods: {
    formatDate(date) {
      if (!date) return '';
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    },
    handleSwitchMonthTab(index) {
      this.activeMonthIndex = index;
    },
    handleOpenOrderDetail(item) {
      this.$emit('open-order-detail', item);
    },
    async handleDownloadExcel(item) {
      const billId = item?.nxDepartmentBillId;
      console.log('[HistoryOrders] 下载Excel 开始:', { billId, tradeNo: item?.nxDbTradeNo });
      if (!billId) {
        console.warn('[HistoryOrders] 下载Excel 失败: 账单ID不存在');
        return;
      }
      this.downloadExcelLoading = billId;
      try {
        console.log('[HistoryOrders] 下载Excel 请求:', billId);
        const res = await api.downloadBillExcel(billId);
        const blob = res?.data;
        const contentDisposition = res?.headers?.['content-disposition'] || res?.headers?.['Content-Disposition'] || '';
        const filename = (() => {
          const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i) || contentDisposition.match(/filename=["']?([^"';]+)["']?/i);
          try {
            return match ? decodeURIComponent(match[1].trim()) : null;
          } catch {
            return match ? match[1].trim() : null;
          }
        })();
        console.log('[HistoryOrders] 下载Excel 响应:', {
          status: res?.status,
          blobSize: blob?.size,
          blobType: blob?.type,
          contentDisposition,
          filename: filename || '(未返回)'
        });
        if (!filename) {
          throw new Error('后端未返回文件名(Content-Disposition)');
        }
        if (!blob || !(blob instanceof Blob)) {
          throw new Error('下载失败：返回数据格式异常');
        }
        // 检查是否为错误响应（如 404 返回的 JSON 被当作 blob）
        if (blob.type?.includes('application/json')) {
          const text = await blob.text();
          const err = JSON.parse(text).message || text;
          console.warn('[HistoryOrders] 下载Excel 接口返回错误:', text);
          throw new Error(err || '接口未实现，请联系后端开发');
        }
        if (window.electronAPI?.showSaveDialog && window.electronAPI?.saveBufferToFile) {
          const saveResult = await window.electronAPI.showSaveDialog({
            title: '保存订单Excel',
            defaultPath: filename,
            filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }]
          });
          if (!saveResult?.success || !saveResult?.filePath) {
            console.log('[HistoryOrders] 用户取消保存');
            return;
          }
          const arrayBuffer = await blob.arrayBuffer();
          const writeResult = await window.electronAPI.saveBufferToFile(arrayBuffer, saveResult.filePath);
          if (writeResult?.success) {
            console.log('[HistoryOrders] 下载Excel 成功:', saveResult.filePath);
          } else {
            throw new Error(writeResult?.error || '保存失败');
          }
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          console.log('[HistoryOrders] 下载Excel 成功:', filename);
        }
      } catch (e) {
        console.error('[HistoryOrders] 下载Excel 失败:', { billId, status: e?.response?.status, message: e?.message, error: e });
      } finally {
        this.downloadExcelLoading = null;
      }
    },
    // 获取客户历史订单
    async fetchCustomerHistoryOrders(customerId) {
      try {
        // 检查disUser是否存在
        if (!this.disUser || !this.disUser.nxDiuDistributerId) {
          console.error('disUser或nxDiuDistributerId不存在:', this.disUser);
          return;
        }

        const requestData = {
          disId: this.disUser.nxDiuDistributerId,
          depFatherId: customerId
        };
        
        console.log('请求历史订单参数:', requestData);

        const res = await api.sellerAndBuyerGetAccountBills(requestData);
        
        if (res && res.data && res.data.code === 0) {
          // 数据结构：直接在 data.arr 中
          this.accountBillData = res.data.data.arr || [];
          this.activeMonthIndex = 0; // 重置到第一个月份
          console.log('成功获取历史订单数据:', this.accountBillData);
        } else {
          console.error('获取历史订单失败:', res);
          this.accountBillData = [];
        }
      } catch (error) {
        console.error('获取历史订单API请求失败:', error);
        this.accountBillData = [];
      }
    }
  }
}
</script>

<style scoped>
.hover-shadow:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.2s;
}
</style>


