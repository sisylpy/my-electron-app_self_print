
const orders = {
    namespaced: true,
    types: {


    },

    state: {
        outDepId: "",
        applyType: "",



    },
    mutations: {
        SET_OUTDEPID: (state, data) => {
            state.outDepId = data
        },
        SET_APPLYTYPE: (state, data) => {
            state.applyType = data;
        },



    },
    actions: {
        set_OUTDEPID(context, data) {
            console.log(data);

            context.commit('SET_OUTDEPID', data)
        },
        set_APPLYTYPE (context, data) {
            context.commit('SET_APPLYTYPE', data);
        }




    }
}

export default orders
