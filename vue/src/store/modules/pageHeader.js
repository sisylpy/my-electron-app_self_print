// import { getToken, setToken, removeToken } from '@/utils/auth'
import api from '@/api/user'


const pageHeader = {
    namespaced: true,
    types: {
        // SET_AUTHENTICATED: 'SET_AUTHENTICATED',
        SET_USER: 'SET_NAVTITLE'
    },

    state: {
        navTitle: ""
    },
    mutations: {
        SET_NAVTITLE: (state, data) => {

            state.navTitle = data
        }

    },
    actions: {

        setNavTitle(context, data) {
            console.log(data);

            context.commit('SET_NAVTITLE', data)
        },


    }

}


export default pageHeader
