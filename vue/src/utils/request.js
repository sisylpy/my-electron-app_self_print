import axios from 'axios'
import config from '../config/index' // 路径配置

// 创建axios 实例
const service = axios.create({
    baseURL: config.baseURL, // api的base_url
    timeout: 10000,  // 请求超时时间


})

// request 拦截器
service.interceptors.request.use(
    config => {

        // if (token) {  // 每次发送请求之前判断是否存在token，如果存在，则统一在http请求的header都加上token，不用每次请求都手动添加了
        //     config.headers.Authorization = token;
        // }

        // 设置后台shiro验证用户带token，终于在这里解决了！
        config.withCredentials = true;



        // if(sessionStorage.getItem('token')){
        //     console.log("======= requst sesionStorage....");
        //     console.log(sessionStorage.getItem('token'))
        //
        //
        // }else {
        //     // sessionStorage.setItem('token'.res.d)
        //     console.log(sessionStorage.getItem('token'));
        // }





        return config
    },
    error => {
        //  这里处理一些请求出错的情况

        Promise.reject(error)
    }
)

// response 拦截器
service.interceptors.response.use(
    response => {
        const res = response.data
        // 这里处理一些response 正常放回时的逻辑




        return res
    },
    error => {
        // 这里处理一些response 出错时的逻辑

        return Promise.reject(error)
    }
)






export default service
