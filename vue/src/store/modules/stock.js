
const stock = {
    namespaced: true,
    types: {


    },

    state: {
        stockType: "",



    },
    mutations: {
        SET_STOCKTYPE: (state, data) => {
            state.stockType = data;
        },



    },
    actions: {
        set_STOCKTYPE (context, data) {
            context.commit('SET_STOCKTYPE', data);
        }




    }
}

export default stock
