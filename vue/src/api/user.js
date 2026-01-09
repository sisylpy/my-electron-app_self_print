import request from '../utils/request'

export default {
    // 登录
    login(data) {
        return request({
            url: '/sys/loginNx',
            method: 'post',
            data
        })
    },
  


    logout() {
        return request({
            url: '/sys/out',
            method: 'get',

        })
    }


}
