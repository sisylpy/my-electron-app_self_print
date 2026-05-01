<template>
    <section class="content-header">

        <h1>{{navTitle}}

        <button @click="goBack" class="btn btn-primary" style="float: right; margin: 10px 40px;">
        退出登录
      </button>

        </h1>


    </section>
</template>

<script>
    export default {
        name: "PageHeader",

        computed: {
        disUser() {
            return this.$store.state.disUser;
        },
        disId() {
            return this.$store.state.disUser.nxDistributerEntity.nxDistributerId;
        },
        navTitle() {
            return this.$store.state.disUser.nxDistributerEntity.nxDistributerName;
        },
    },
        data(){
            return{
               

        }
        },
        methods: {
    // 返回上两个页面
    goBack() {
      // 如果你使用的是 Vue Router，你可以使用 this.$router 来控制历史记录
      this.$router.go(-2);  // 返回上 2 个页面

      // 如果不使用 Vue Router，直接使用浏览器的 history API
      // window.history.go(-2);  // 这也会使页面返回上 2 个历史页面
    },
  },
    }
</script>

<style scoped >

.content-header{
    background: linear-gradient(to right, #6a11cb, #2575fc);
    color: #fff;
    text-align: center;

}

</style>

