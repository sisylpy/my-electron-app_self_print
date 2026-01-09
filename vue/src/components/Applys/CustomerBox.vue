<template>

    <div class="">

        <div class="col-md-2">

            <div class="box  box-primary">

                <div class="box-header with-border">
                    <h3 class="box-title">客户</h3>
                </div>

                <div class="box-body no-padding scrollable">
                    <ul class="nav nav-pills nav-stacked">
                        <li v-for="(item,index) in depList" v-bind:key="item.nxDepartmentId"
                            :id="item.nxDepartmentId"
                            :class="isactive == index ? 'active' : '' "
                            @click='onclick(index, item.nxDepartmentId,item.nxDepartmentAttrName ,item.nxDepartmentType)'>
                            <a>{{item.nxDepartmentName}}</a></li>
                    </ul>
                </div>
                <!-- /.box-body -->
            </div>

        </div>

    </div>


</template>

<script>
    import api from '../../api/order/customer'

    export default {
        name: "CustomerBox",
        props:['getDepInfo'],
        computed: {
            disUser() {
                return this.$store.state.disUser;
            },

        },

        data() {
            return {

                resList: [],
                gbList: [],
                depList: [],
                isactive: 0,
                gbDepId: -1,
                resFatherId: -1,
                gbDisId: -1,
                comId: -1,
                nxDepId: "",
                depName: "",
                depType: "",

            }
        },


        mounted() {

            var disId = this.disUser.nxDiuDistributerId;
            api.disGetCustomer(disId).then(res => {
                if (res) {
                    console.log(res);
                    // this.resList = res.data.settleTypeThree;
                    // this.gbList = res.data.settleTypeOne;
                    this.depList = res.data;
                    this.nxDepId = res.data[0].nxDepartmentId;
                    this.depName = res.data[0].nxDepartmentName;
                    this.depType =  res.data[0].nxDepartmentType;
                    this.getDepInfo(this.nxDepId, this.depName, this.depType)

                }
            })

        },


        methods: {

            onclick(index, nxDepId, depName, depType) {
                this.isactive = index;
                this.nxDepId = nxDepId;
                this.depName = depName;
                this.depType = depType;
                this.getDepInfo(this.nxDepId,this.depName);
            },

        }
    }
</script>

<style scoped>
    .scrollable {

        width: 100%;

        height: 400px;

        overflow: auto;

    }

</style>
