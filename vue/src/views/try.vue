<template>
    <div class="container-fluid">
      <div class="top-gradient"></div> <!-- 顶部渐变背景 -->
      
      <div class="row justify-content-center">
        <!-- 主内容区域 -->
        <div class="col-12 col-md-10 col-lg-8">
          <div class="card-body">
            <!-- 顾客与订单并列展示 -->
            <div class="row">
              <!-- 左侧客户信息区域 -->
              <div class="col-12 col-md-6">
                <div class="card mb-4 border-light shadow-none">
                  <div class="card-header">
                    <h4 class="card-title">订货客户</h4>
                  </div>
                  <div class="card-body">
                    <ul class="list-group shadow-sm border rounded">
                      <li 
                        v-for="(customer, index) in customers" 
                        :key="index" 
                        class="list-group-item d-flex justify-content-between align-items-center"
                        @click="selectCustomer(index)"
                      >
                        {{ customer.name }}
                        <span class="badge badge-primary badge-pill">{{ customer.phone }}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
  
              <!-- 右侧订单信息区域 -->
              <div class="col-12 col-md-6">
                <div class="card mb-4 border-light shadow-none">
                  <div class="card-header">
                    <h4 class="card-title">客户订单</h4>
                  </div>
                  <div class="card-body">
                    <table class="table table-bordered table-hover shadow-sm border rounded">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>订单编号</th>
                          <th>订单金额</th>
                          <th>状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="(order, index) in orders" :key="index" @click="selectOrder(index)">
                          <td>{{ index + 1 }}</td>
                          <td>{{ order.id }}</td>
                          <td>{{ order.amount }}</td>
                          <td>{{ order.status }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
  
            <!-- 操作按钮 -->
            <div class="d-flex justify-content-between">
              <button class="btn btn-lg btn-primary" @click="handlePrint">
                <i class="fas fa-print"></i> 打印
              </button>
              <div>
                <ul class="pagination pagination-sm">
                  <li class="page-item">
                    <button class="page-link" @click="previousPage">上一页</button>
                  </li>
                  <li class="page-item">
                    <button class="page-link" @click="nextPage">下一页</button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
  
      <div class="bottom-gradient"></div> <!-- 底部渐变背景 -->
    </div>
  </template>
  
  <script>
  export default {
    data() {
      return {
        customers: [
          { name: '张三', phone: '13800138000' },
          { name: '李四', phone: '13900139000' },
          // 更多客户
        ],
        orders: [
          { id: '1001', amount: '200', status: '待处理' },
          { id: '1002', amount: '150', status: '已完成' },
          // 更多订单
        ],
      };
    },
    methods: {
      handlePrint() {
        console.log('开始打印...');
      },
      previousPage() {
        console.log('上一页');
      },
      nextPage() {
        console.log('下一页');
      },
      selectCustomer(index) {
        console.log(`选中了客户：${this.customers[index].name}`);
      },
      selectOrder(index) {
        console.log(`选中了订单：${this.orders[index].id}`);
      },
    },
  };
  </script>
  
  <style scoped>
  .card-body {
    background-color: #ffffff;
  }
  
  .card-header {
    background-color: #f8f9fa;
    border-bottom: 2px solid #ddd;
  }
  
  .list-group-item {
    cursor: pointer;
  }
  
  .table th, .table td {
    vertical-align: middle;
  }
  
  .table-striped tbody tr:nth-child(odd) {
    background-color: #f9f9f9;
  }
  
  .pagination-sm .page-item .page-link {
    padding: 0.5rem 0.8rem;
  }
  
  .pagination {
    margin-bottom: 0;
  }
  
  .btn-lg {
    font-size: 1.25rem;
    padding: 0.5rem 1rem;
    border-radius: 25px;
  }
  
  .shadow-sm {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
  
  .border {
    border: 1px solid #ddd;
  }
  
  .rounded {
    border-radius: 10px;
  }
  
  .top-gradient, .bottom-gradient {
    height: 50px; /* 设置渐变色的高度 */
    background: linear-gradient(to right, #6a11cb, #2575fc);
  }
  
  @media (max-width: 767px) {
    .col-12 {
      margin-bottom: 20px;
    }
  
    .btn-lg {
      font-size: 1rem;
      padding: 0.4rem 0.8rem;
    }
  }
  </style>
  