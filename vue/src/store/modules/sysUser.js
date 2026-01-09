// import { getToken, setToken, removeToken } from '@/utils/auth'
// import api from '@/api/user'


const sysUser = {
    namespaced: true,
    types: {
    // SET_AUTHENTICATED: 'SET_AUTHENTICATED',
    SET_USER: 'SET_USER'
    },

    state: {
        // token: getToken(),
        user: {}
    },
    mutations: {
        // SET_TOKEN: (state, token) => {
        //     state.token = token
        // },
        SET_USER: (state, user) => {
            state.user = user
        },

    },
    actions: {

        // 登录
        // Login ({ commit }, userInfo) {
        //     return new Promise((resolve, reject) => {
        //         api.login(userInfo).then(res => {
        //             if (res.code === 0) {
        //                 console.log(res.token);
        //                 console.log(res.username);
        //                 setToken(res.token)
        //                 commit('SET_TOKEN', res.token);
        //                 commit('SET_NAME', res.username);
        //             }
        //             resolve()
        //         }).catch(err => {
        //             reject(err)
        //         })
        //     })
        // },
        // 获取用户信息
        // GetUserInfo ({ commit }) {
        //     return new Promise((resolve, reject) => {
        //         api.getUserInfo().then(res => {
        //             // console.log(res)
        //             if (res.code === 0) {
        //                 // setToken(res.token)
        //                 // commit('SET_TOKEN', res.token);
        //                 commit('SET_USER', res.user);
        //                 // commit('SET_NAME', res.data.name)
        //                 // commit('SET_AVATAR', res.data.avatar)
        //                 // commit('SET_ROLES', res.data.role)
        //             }
        //             resolve(res)
        //         }).catch(error => {
        //             reject(error)
        //         })
        //     })
        // },
        //
        // // 登出
        LogOut ({ commit, state }) {
          return new Promise((resolve, reject) => {
            logout(state.token).then(() => {
              commit('SET_TOKEN', '')
              commit('SET_ROLES', [])
              removeToken()
              resolve()
            }).catch(error => {
              reject(error)
            })
          })
        },


    }

}



export default sysUser
