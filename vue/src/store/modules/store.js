
const store = {
    namespaced: true,
    types: {


    },

    state: {
        // storeId: "",
        // storeName: "",
        // bussinessType: "",





    },
    mutations: {
        SET_STOREID: () => {
          state.storeId = data ;
        },
        SET_STORENAME: () => {
            state.storeName = data ;
        },
        SET_BUSINESSTYPE: (state, data) => {
            state.bussinessType = data;
        },
        // SET_STOREOUTTYPE: (state, data) => {
        //     state.storeOutType = data;
        // },
        // SET_STOREORDERTYPE: (state, data) => {
        //     state.storeOrderType = data;
        // },



    },
    actions: {
        set_STOREID: () => {
            context.commit('SET_STOREID', data);
        },
        set_STORENAME: () => {
            context.commit('SET_STORENAME', data);
        },
        set_BUSINESSTYPE (context, data) {
            context.commit('SET_BUSINESSTYPE', data);
        },
        // set_STOREOUTTYPE (context, data) {
        //     context.commit('SET_STOREOUTTYPE', data);
        // },
        // set_STOREORDERTYPE (context, data) {
        //     context.commit('SET_STOREORDERTYPE', data);
        // }




    }
}

export default store
