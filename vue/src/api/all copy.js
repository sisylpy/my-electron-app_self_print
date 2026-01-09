import axios from './axios';

// 获取环境变量中的 API 地址
const api = import.meta.env.VITE_API_URL;
if (!api) {
    console.error('VITE_API_URL is not defined in the environment variables.');
  }
export default {
 
  // 获取今天的订单客户
  webNxDisGetTodayOrderCustomer(disId) {
    return axios.get(`nxdepartmentorders/webNxDisGetTodayOrderCustomer/${disId}`);
  },


  webNxDisGetTodayReturnCustomer(data) {
      return axios({
          url: 'nxdepartmentorders/webNxDisGetTodayReturnCustomer/'+ data,
          method: 'get',
      })
  },


   // 获取待打印的部门订单
   disGetToFillDepOrders(data) {
    return axios.post('/nxdepartmentorders/printerGetPrintOrders', data, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
},

  disGetToFillDepOrdersReturn(data) {
      return axios({
          url: 'nxdepartmentorders/getToFillDepOrdersReturn',
          method: 'post',
          data
      })
  },

  webGetOrderPageSubDep(data) {
      return axios({
          url: 'nxdepartmentorders/webGetSubDepOrderPageSubDep',
          method: 'post',
          data
      })
  },
  webGetOrderPageSubDepRetrun(data) {
      return axios({
          url: 'nxdepartmentorders/webGetSubDepOrderPageSubDepReturn',
          method: 'post',
          data
      })
  },

  webGetOrderPage(data) {
      return axios({
          url: 'nxdepartmentorders/webGetSubDepOrderPage',
          method: 'post',
          data
      })
  },


  webGetOrderPageReturn(data) {
      return axios({
          url: 'nxdepartmentorders/webGetSubDepOrderPageReturn',
          method: 'post',
          data
      })
  },
  //

  saveToFillPriceOrder(data) {
      return axios({
          url: 'nxdepartmentorders/giveOrderPrice',
          method: 'post',
          data
      })
  },

  giveOrderWeight(data) {
      return axios({
          url: 'nxdepartmentorders/giveOrderWeight',
          method: 'post',
          data
      })
  },

//   saveAccountBill(data) {
//       return axios({
//           url: 'nxdepartmentbill/saveAccountBillPrinter',
//           method: 'post',
//           data
//       })
//   },

saveAccountBillGb(data) {
    return axios({
        url: 'nxdepartmentbill/saveAccountBillPrinterGb/'+ data,
        method: 'get',
    })
},

  saveAccountBill(data) {
    return axios({
        url: 'nxdepartmentbill/saveAccountBillPrinter/'+ data,
        method: 'get',
    })
},

  saveAccountReturnBill(data) {
      return axios({
          url: 'nxdepartmentbill/saveAccountReturnBill',
          method: 'post',
          data
      })
  },




  checkLoginStatus(data,config = {}) {
    return axios({
      url: `${api}/nxdistributeruser/checkLoginStatus/${data}`,  // 确保这里拼接正确
      method: 'get',
    });
    
  },
  
  
  


};