import request from '@/utils/request'

export default {

    disGetStockGoodsWeb(data) {
        return request({
            url: 'api/nxdepartmentorders/disGetStockGoodsWeb',
            method: 'post',
            data
        })
    },


    /**
     * 获取出货部门列表
     * @param data
     */
    webNxDisGetTodayOrderCustomer(data) {
        return request({
            url: 'api/nxdepartmentorders/webNxDisGetTodayOrderCustomer/'+ data,
            method: 'get',
        })
    },

    webNxDisGetTodayReturnCustomer(data) {
        return request({
            url: 'api/nxdepartmentorders/webNxDisGetTodayReturnCustomer/'+ data,
            method: 'get',
        })
    },


    // /**
    //  * 保存出货部门
    //  */
    // disGetToFillDepOrders(data) {
    //     return request({
    //         url: 'api/nxdepartmentorders/getToFillDepOrders',
    //         method: 'post',
    //         data
    //     })
    // },

    disGetToFillDepOrdersReturn(data) {
        return request({
            url: 'api/nxdepartmentorders/getToFillDepOrdersReturn',
            method: 'post',
            data
        })
    },

    webGetOrderPageSubDep(data) {
        return request({
            url: 'api/nxdepartmentorders/webGetSubDepOrderPageSubDep',
            method: 'post',
            data
        })
    },
    webGetOrderPageSubDepRetrun(data) {
        return request({
            url: 'api/nxdepartmentorders/webGetSubDepOrderPageSubDepReturn',
            method: 'post',
            data
        })
    },

    webGetOrderPage(data) {
        return request({
            url: 'api/nxdepartmentorders/webGetSubDepOrderPage',
            method: 'post',
            data
        })
    },


    webGetOrderPageReturn(data) {
        return request({
            url: 'api/nxdepartmentorders/webGetSubDepOrderPageReturn',
            method: 'post',
            data
        })
    },
    //

    saveToFillPriceOrder(data) {
        return request({
            url: 'api/nxdepartmentorders/giveOrderPrice',
            method: 'post',
            data
        })
    },

    giveOrderWeight(data) {
        return request({
            url: 'api/nxdepartmentorders/giveOrderWeight',
            method: 'post',
            data
        })
    },

    saveAccountBill(data) {
        return request({
            url: 'api/nxdepartmentbill/saveAccountBillWeb',
            method: 'post',
            data
        })
    },


    saveAccountReturnBill(data) {
        return request({
            url: 'api/nxdepartmentbill/saveAccountReturnBill',
            method: 'post',
            data
        })
    }



}
