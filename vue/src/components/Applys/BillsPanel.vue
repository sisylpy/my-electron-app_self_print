<template>


        <div class="col-md-10">
                <div class="box box-primary">
                    <div class="box-header with-border">
                        <h3 class="box-title">{{depName}}</h3>
                    </div>

                    <div class="box-body">
                        <div class="nav-tabs-justified">
                            <ul class="nav nav-tabs">
                                <li   :class="monthIndex == index ? 'active' : '' "  v-for="(item,index) in monthArr" v-bind:key="item.nxDepartmentId"><a  data-toggle="tab" @click="changeMonthIndex(index)">{{item.month}}月</a></li>
                            </ul>
                            <div class="tab-content">
                                <div class="tab-pane active" id="inBill">
                                    <div class="my_panel">
                                        <div class="panel panel-default">
                                            <div class="panel-body no-padding" style="min-height: 400px; ">
                                                <div class="box-body table-responsive no-padding">

                                                    <table class="table table-hover" >
                                                        <tbody>
                                                        <tr>
                                                            <th style="width: 10px">#</th>
                                                            <th>日期</th>
                                                            <th>总额</th>
                                                            <th>星期</th>
                                                            <th>操作</th>
                                                        </tr>
                                                        <tr v-for="(item, index) in bills">
                                                            <td>{{index+1}}</td>
                                                            <td>{{item.nxDbDate}}</td>
                                                            <td v-if="item.nxDbDepId !== item.nxDbDepFatherId">{{item.nxDbTotal}}({{item.nxDepartmentEntity.nxDepartmentAttrName}})</td>
                                                            <td v-else>{{item.nxDbTotal}}</td>

                                                            <td>{{item.nxDbDay}}</td>
                                                            <td><span class="badge bg-light-blue" @click="openDeatil(index, item.nxDepartmentBillId)">查看</span></td>
                                                        </tr>

                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>
                            <!-- /.tab-pane -->

                        </div>

                    </div>

                </div>

            <div style="display: none" id="testDelivery"></div>

        </div>
<!--@printOk="printOk"-->
</template>

<script>
    import api from '../../api/order/customer'

    export default {
        name: "BillsPanel",
        props: ['nxDepId', 'depName'],
        computed: {
            disUser() {
                return this.$store.state.disUser;
            },
            disName() {
                return this.$store.state.disUser.nxDistributerEntity.nxDistributerName;
            },
            disId() {
                return this.$store.state.disUser.nxDistributerEntity.nxDistributerId;
            },
        },
        watch: {
            nxDepId: function (newVal) {
                this.nxDepId = newVal;
                this.monthIndex = 0;
                api.disGetUnSettleAccountBills(this.nxDepId).then(res => {
                    this.monthArr = res.data;
                    this.bills = res.data[0].arr;

                });

            },

            depName: function (newVal) {
                this.depName = newVal;
            },
        },

        components: {

        },
        data() {
            return {

                isactive: 0,
                monthArr: [],
                monthIndex: 0,
                bills: [],
                billItem: "",
                depNamePrint: ""

            }
        },

        methods: {

            changeMonthIndex(index){
                this.monthIndex = index;
                this.bills = this.monthArr[index].arr;
            },

            openDeatil(index,id){
                this.applyArrPrint = "";
                this.billItem = "";
                this.depNamePrint = "";
                api.getReturnBillApplys(id).then(res => {
                    if(res){
                        this.billItem = res.data;

                        console.log(res);
                        if(this.billItem.nxDbDepId !== this.billItem.nxDbDepFatherId){
                            this.depNamePrint = this.depName + "-" + this.billItem.nxDepartmentEntity.nxDepartmentAttrName;
                        }else{
                            this.depNamePrint = this.depName;
                        }
                        $('#modal_detail').show();
                        this.applyArrPrint = this.billItem.nxDepartmentOrdersEntities;
                        this.printAgain();

                    }
                });
            },


            printAgain: function () {

                var arr = this.applyArrPrint;
                var arrLen = this.applyArrPrint.length;
                var totalGoods = 60;
                var totalPriPage = Math.ceil(arrLen / totalGoods);
                if (totalPriPage <= 1) {
                    var applyBody = `<div id="page1" class="applyBody"  ></div>`
                    $('#testDelivery').append(applyBody);
                    var top = `<div class="" style="width: 100%; float: left; height: 50px; "></div>`
                    $('#page1').append(top);

                    var header = `<div class="header" style="width: 100%; float:left; ">
                            <div style=" width: 85%; margin-left: 7.5%; line-height: 36px;  float:left; font-size: 14px; " >
                               <div  style="width: 34%; float: left; ">
                                  <div style="line-height: 36px; font-size: 14px;">单位: `+ this.depNamePrint + `  </div>
                               </div>
                               <div style="width: 33%; float: left; text-align: center; font-size: 24px;"> ` + this.disName + `送货单 </div>

                               <div style="width: 33%; float: left;  text-align: right; font-size: 12px; ">
                                <div style="line-height: 18px;">共1页-第1页</div>
                               <div style="line-height: 18px;">时间: ` + this.billItem.nxDbDate +`</div>
                               </div>
                            </div>
                          </div>`;

                    $('#page1').append(header);

                    var content = `<div class="content_bill" style="width: 90%; margin-left: 5%; float: left; border-bottom:1px solid gray; border-right:  1px solid gray;  "></div>`

                    $('#page1').append(content);

                    var left = `<div class="left_bill" style="float: left; width: 50%;"></div>`
                    $('.content_bill:eq(0)').append(left);

                    var oneTitle = `<div style="box-sizing: border-box; float:left; width: 100%; line-height: 30px; text-align: center;font-size: 12px;border-bottom: 1px solid gray;border-top: 1px solid gray;">
                                <div style="box-sizing: border-box; float:left; width: 10%; border-right: 1px solid gray; border-left: 1px solid gray;">序号</div>
                                <div style="box-sizing: border-box; float:left; width: 30%; border-right: 1px solid gray; ">商品</div>
                                <div style="box-sizing: border-box; float:left; width: 10%; border-right: 1px solid gray; ">数量</div>
                                <div style="box-sizing: border-box; float:left; width: 15%; border-right: 1px solid gray; ">规格</div>
                                <div style="box-sizing: border-box; float:left; width: 15%; border-right: 1px solid gray; ">单价</div>
                                <div style="box-sizing: border-box; float:left; width: 20%; border-right: 1px solid gray; ">小计</div>
                                </div>`;
                    $('.left_bill:eq(0)').append(oneTitle);


                    var middle = `<div class="middle_bill" style="float: left; width: 50%;"></div>`
                    $('.content_bill:eq(0)').append(middle);

                    var oneTitle = `<div style="box-sizing: border-box; float:left; width: 100%;  line-height: 30px; text-align: center;font-size: 12px;border-bottom: 1px solid gray;border-top: 1px solid gray;">
                                <div style="box-sizing: border-box; float:left; width: 10%; border-right: 1px solid gray; ">序号</div>
                                <div style="box-sizing: border-box; float:left; width: 30%; border-right: 1px solid gray; ">商品</div>
                                <div style="box-sizing: border-box; float:left; width: 10%; border-right: 1px solid gray; ">数量</div>
                                <div style="box-sizing: border-box; float:left; width: 15%; border-right: 1px solid gray; ">规格</div>
                                <div style="box-sizing: border-box; float:left; width: 15%; border-right: 1px solid gray; ">单价</div>
                                <div style="box-sizing: border-box; float:left; width: 20%; border-right: 1px solid gray; ">小计</div>
                                </div>`;
                    $('.middle_bill:eq(0)').append(oneTitle);





                    for (var j = 0; j < arr.length; j++) {
                        if (j < totalGoods / 2) {
                            var oneItem = `<div class="oneItem" style="float: left;width: 100%; border-bottom: 1px solid gray;
                                                                        line-height: 24px; font-size: 12px; text-align: center;"></div>`
                            $('.left_bill:eq(0)').append(oneItem);
                            var index = Number(j) + 1;

                            var indexC = `<div style="word-break:keep-all;box-sizing: border-box;float: left; width: 10%; border-right: 1px solid gray;border-left: 1px solid gray; " >`+ index + `</div>`
                            var nxDgGoodsName = `<div style="word-break:keep-all;box-sizing: border-box;float: left; width: 30%; border-right: 1px solid gray; text-align: left; padding-left: 10px;" >` + arr[j]['nxDistributerGoodsEntity']['nxDgGoodsName'] + `</div>`
                            var nxDoWeight = `<div style="word-break:keep-all;box-sizing: border-box;float: left; width: 10%; border-right: 1px solid gray; " >` + arr[j]['nxDoWeight'] + `</div>`
                            var nxDoStandard = `<div style="word-break:keep-all;box-sizing: border-box;float: left; width: 15%; border-right: 1px solid gray; " >` + arr[j]['nxDistributerGoodsEntity']['nxDgGoodsStandardname'] + `</div>`
                            var nxDoPrice = `<div style="word-break:keep-all;box-sizing: border-box;float: left; width: 15%; border-right: 1px solid gray; " >` + arr[j]['nxDoPrice'] + `</div>`
                            var nxDoSubtotal = `<div style="word-break:keep-all;box-sizing: border-box;float: left; width: 20%; border-right: 1px solid gray; " >` + arr[j]['nxDoSubtotal'] + `</div>`;

                            $('.oneItem:eq(' + j + ')').append(indexC);
                            $('.oneItem:eq(' + j + ')').append(nxDgGoodsName);
                            $('.oneItem:eq(' + j + ')').append(nxDoWeight);
                            $('.oneItem:eq(' + j + ')').append(nxDoStandard);
                            $('.oneItem:eq(' + j + ')').append(nxDoPrice);
                            $('.oneItem:eq(' + j + ')').append(nxDoSubtotal);

                        } else if (totalGoods / 2 <= j && j < totalGoods ) {
                            var index = Number(j) + 1;

                            var oneItem = `<div class="oneItem" style="float: left;width: 100%; border-bottom: 1px solid gray;
                                                                        line-height: 24px; text-align: center;font-size: 12px;"></div>`
                            $('.middle_bill:eq(0)').append(oneItem);
                            var indexC = `<div style="word-break:keep-all;box-sizing: border-box;float: left; width: 10%; border-right: 1px solid gray;" >`+ index + `</div>`
                            var nxDgGoodsName = `<div style="word-break:keep-all;box-sizing: border-box;float: left; width: 30%;  border-right: 1px solid gray; text-align: left; padding-left: 10px;" >` + arr[j]['nxDistributerGoodsEntity']['nxDgGoodsName'] + `</div>`
                            var nxDoWeight = `<div style="word-break:keep-all;box-sizing: border-box;float: left; width: 10%; border-right: 1px solid gray; " >` + arr[j]['nxDoWeight'] + `</div>`
                            var nxDoStandard = `<div style="word-break:keep-all;box-sizing: border-box;float: left; width: 15%; border-right: 1px solid gray; " >` + arr[j]['nxDistributerGoodsEntity']['nxDgGoodsStandardname'] + `</div>`
                            var nxDoPrice = `<div style="word-break:keep-all;box-sizing: border-box;float: left; width: 15%; border-right: 1px solid gray; " >` + arr[j]['nxDoPrice'] + `</div>`
                            var nxDoSubtotal = `<div style="word-break:keep-all;box-sizing: border-box;float: left; width: 20%; border-right: 1px solid gray; " >` + arr[j]['nxDoSubtotal'] + `</div>`;

                            $('.oneItem:eq(' + j + ')').append(indexC);
                            $('.oneItem:eq(' + j + ')').append(nxDgGoodsName);
                            $('.oneItem:eq(' + j + ')').append(nxDoWeight);
                            $('.oneItem:eq(' + j + ')').append(nxDoStandard);
                            $('.oneItem:eq(' + j + ')').append(nxDoPrice);
                            $('.oneItem:eq(' + j + ')').append(nxDoSubtotal);

                        }
                    }

                    var sub = `<div style="box-sizing: border-box; float:left; width: 100%; line-height: 24px; text-align: center;font-size: 13px;border-top: 1px solid gray;">

                                <div style="box-sizing: border-box; float:left; width: 80%; border-left: 1px solid gray; padding-right: 10px; text-align: right;">合计:</div>
                                <div style="box-sizing: border-box; float:left; width: 20%; border-right: 1px solid gray; text-align: right; padding-right: 10px;">` + this.billItem.nxDbTotal +`</div>
                                </div>`;
                    $('.content_bill').append(sub);

                    var footer = `<div class="header" style="width: 100%; float:left; font-size: 14px;">
                            <div style=" width: 100%; line-height: 36px;  float:left;" >
                               <div style="width: 60%;margin-left: 5%; float: left; ">收货人: </div>
                               <div style="width: 33%; float: left; ">送货人: </div>
                            </div>
                          </div>`;
                    $('#page1').append(footer);

                } else {

                    for (var i = 1; i <= totalPriPage; i++) {
                        console.log("dayu 45 ge le;")
                        var newi = i - 1

                        var applyBody = `<div id=page` + i + ` class="applyBody" ></div>`
                        $('#testDelivery').append(applyBody);
                        var top = `<div class="" style="width: 100%; float: left; height: 50px; "></div>`
                        $('#' + "page" + i).append(top);

                        var header = `<div class="header" style="width: 100%; float:left; ">

                            <div style=" width: 85%; margin-left: 7.5%; line-height: 36px;  float:left; font-size: 12px; " >
                               <div style="width: 34%; float: left; ">时间: ` + this.todayDate +   `&nbsp&nbsp` + `总金额：` + this.nxDoSubtotal + `元</div>
                            <div style=" width: 33%; float: left;text-align: center; font-size: 20px;">` + this.depName + `</div>

                            <div style="width: 33%; float: left; text-align: right; ">共` + totalPriPage + `页  第` + i + `页  </div>
                            </div>
                          </div>`;
                        $('#' + "page" + i).append(header);

                        var content = `<div class="content_bill" style="width: 90%; margin-left: 5%;float: left; "></div>`

                        $('#page' + i).append(content);

                        var left = `<div class="left_bill" style="float: left; width: 33%;"></div>`
                        $('.content_bill:eq(' + newi + ')').append(left);

                        var oneTitle = `<div style="box-sizing: border-box; float:left; width: 100%;  line-height: 30px; text-align: center;font-size: 12px;border-bottom: 1px solid gray;border-top: 1px solid gray;">
                                <div style="box-sizing: border-box; float:left; width: 35%; border-right: 1px solid gray; border-left: 1px solid gray;">商品</div>
                                <div style="box-sizing: border-box; float:left; width: 15%; border-right: 1px solid gray; ">数量</div>
                                <div style="box-sizing: border-box; float:left; width: 15%; border-right: 1px solid gray; ">规格</div>
                                <div style="box-sizing: border-box; float:left; width: 15%; border-right: 1px solid gray; ">单价</div>
                                <div style="box-sizing: border-box; float:left; width: 20%; border-right: 1px solid gray; ">小计</div>
                                </div>`;
                        $('.left_bill:eq(' + newi + ')').append(oneTitle);

                        var middle = `<div class="middle_bill" style="float: left; width: 33%;"></div>`
                        $('.content_bill:eq(' + newi + ')').append(middle);

                        var oneTitle = `<div style="box-sizing: border-box; float:left; width: 100%;  line-height: 30px; text-align: center;font-size: 12px;border-bottom: 1px solid gray;border-top: 1px solid gray;">
                                  <div style="box-sizing: border-box; float:left; width: 35%; border-right: 1px solid gray; ">商品</div>
                                <div style="box-sizing: border-box; float:left; width: 15%; border-right: 1px solid gray; ">数量</div>
                                <div style="box-sizing: border-box; float:left; width: 15%; border-right: 1px solid gray; ">规格</div>
                                <div style="box-sizing: border-box; float:left; width: 15%; border-right: 1px solid gray; ">单价</div>
                                <div style="box-sizing: border-box; float:left; width: 20%; border-right: 1px solid gray; ">小计</div>
                               </div>`;
                        $('.middle_bill:eq(' + newi + ')').append(oneTitle);


                        var right = `<div class="right_bill" style="float: left;width: 33%;  "></div>`
                        $('.content_bill:eq(' + newi + ')').append(right);

                        var oneTitle = `<div style="box-sizing: border-box; float:left; width: 100%;  line-height: 30px; text-align: center;font-size: 12px;border-bottom: 1px solid gray;border-top: 1px solid gray;">
                                  <div style="box-sizing: border-box; float:left; width: 35%; border-right: 1px solid gray; ">商品</div>
                                <div style="box-sizing: border-box; float:left; width: 15%; border-right: 1px solid gray; ">数量</div>
                                <div style="box-sizing: border-box; float:left; width: 15%; border-right: 1px solid gray; ">规格</div>
                                <div style="box-sizing: border-box; float:left; width: 15%; border-right: 1px solid gray; ">单价</div>
                                <div style="box-sizing: border-box; float:left; width: 20%; border-right: 1px solid gray; ">小计</div>
                               </div>`;
                        $('.right_bill:eq(' + newi + ')').append(oneTitle);


                        for (var j = i * totalGoods - totalGoods; j < i * totalGoods; j++) {

                            if (j < arrLen) {

                                if (j < (i - 1) * totalGoods + totalGoods / 3) {

                                    var oneItem = `<div class="oneItem" style="float: left;width: 100%; border-bottom: 1px solid gray;
                                                                        line-height: 24px; text-align: center;font-size: 11px;"></div>`
                                    $('.left_bill:eq(' + newi + ')').append(oneItem);

                                    var nxDgGoodsName = `<div style="word-break:keep-all;box-sizing: border-box;float: left; width: 35%; border-right: 1px solid gray;border-left: 1px solid gray; " >` + arr[j]['nxDistributerGoodsEntity']['nxDgGoodsName'] + `</div>`
                                    var nxDoWeight = `<div style="word-break:keep-all;box-sizing: border-box;float: left; width: 15%; border-right: 1px solid gray; " >` + arr[j]['nxDoWeight'] + `</div>`
                                    var nxDoStandard = `<div style="word-break:keep-all;box-sizing: border-box;float: left; width: 15%; border-right: 1px solid gray; " >` + arr[j]['nxDistributerGoodsEntity']['nxDgGoodsStandardname'] + `</div>`
                                    var nxDoPrice = `<div style="word-break:keep-all;box-sizing: border-box;float: left; width: 15%; border-right: 1px solid gray; " >` + arr[j]['nxDoPrice'] + `</div>`
                                    var nxDoSubtotal = `<div style="word-break:keep-all;box-sizing: border-box;float: left; width: 20%; border-right: 1px solid gray; " >` + arr[j]['nxDoSubtotal'] + `</div>`;

                                    $('.oneItem:eq(' + j + ')').append(nxDgGoodsName);
                                    $('.oneItem:eq(' + j + ')').append(nxDoWeight);
                                    $('.oneItem:eq(' + j + ')').append(nxDoStandard);
                                    $('.oneItem:eq(' + j + ')').append(nxDoPrice);
                                    $('.oneItem:eq(' + j + ')').append(nxDoSubtotal);


                                } else if (j >= (i - 1) * totalGoods + totalGoods / 3 && j < ((i - 1) * totalGoods + totalGoods / 3) * 2) {

                                    var oneItem = `<div class="oneItem" style="float: left;width: 100%; border-bottom: 1px solid gray;
                                                                        line-height: 24px; text-align: center;font-size: 11px;"></div>`
                                    $('.middle_bill:eq(' + newi + ')').append(oneItem);

                                    var nxDgGoodsName = `<div style="word-break:keep-all;box-sizing: border-box;float: left; width: 35%; border-right: 1px solid gray; " >` + arr[j]['nxDistributerGoodsEntity']['nxDgGoodsName'] + `</div>`
                                    var nxDoWeight = `<div style="word-break:keep-all;box-sizing: border-box;float: left; width: 15%; border-right: 1px solid gray; " >` + arr[j]['nxDoWeight'] + `</div>`
                                    var nxDoStandard = `<div style="word-break:keep-all;box-sizing: border-box;float: left; width: 15%; border-right: 1px solid gray; " >` + arr[j]['nxDistributerGoodsEntity']['nxDgGoodsStandardname'] + `</div>`
                                    var nxDoPrice = `<div style="word-break:keep-all;box-sizing: border-box;float: left; width: 15%; border-right: 1px solid gray; " >` + arr[j]['nxDoPrice'] + `</div>`
                                    var nxDoSubtotal = `<div style="word-break:keep-all;box-sizing: border-box;float: left; width: 20%; border-right: 1px solid gray; " >` + arr[j]['nxDoSubtotal'] + `</div>`;

                                    $('.oneItem:eq(' + j + ')').append(nxDgGoodsName);
                                    $('.oneItem:eq(' + j + ')').append(nxDoWeight);
                                    $('.oneItem:eq(' + j + ')').append(nxDoStandard);
                                    $('.oneItem:eq(' + j + ')').append(nxDoPrice);
                                    $('.oneItem:eq(' + j + ')').append(nxDoSubtotal);

                                } else {

                                    var oneItem = `<div class="oneItem" style="float: left;width: 100%; border-bottom: 1px solid gray;
                                                                        line-height: 24px; text-align: center;font-size: 11px;"></div>`
                                    $('.right_bill:eq(' + newi + ')').append(oneItem);

                                    var nxDgGoodsName = `<div style="word-break:keep-all;box-sizing: border-box;float: left; width: 35%; border-right: 1px solid gray; " >` + arr[j]['nxDistributerGoodsEntity']['nxDgGoodsName'] + `</div>`
                                    var nxDoWeight = `<div style="word-break:keep-all;box-sizing: border-box;float: left; width: 15%; border-right: 1px solid gray; " >` + arr[j]['nxDoWeight'] + `</div>`
                                    var nxDoStandard = `<div style="word-break:keep-all;box-sizing: border-box;float: left; width: 15%; border-right: 1px solid gray; " >` + arr[j]['nxDistributerGoodsEntity']['nxDgGoodsStandardname'] + `</div>`
                                    var nxDoPrice = `<div style="word-break:keep-all;box-sizing: border-box;float: left; width: 15%; border-right: 1px solid gray; " >` + arr[j]['nxDoPrice'] + `</div>`
                                    var nxDoSubtotal = `<div style="word-break:keep-all;box-sizing: border-box;float: left; width: 20%; border-right: 1px solid gray; " >` + arr[j]['nxDoSubtotal'] + `</div>`;

                                    $('.oneItem:eq(' + j + ')').append(nxDgGoodsName);
                                    $('.oneItem:eq(' + j + ')').append(nxDoWeight);
                                    $('.oneItem:eq(' + j + ')').append(nxDoStandard);
                                    $('.oneItem:eq(' + j + ')').append(nxDoPrice);
                                    $('.oneItem:eq(' + j + ')').append(nxDoSubtotal);

                                }
                            }
                        }
                    }
                    var fenye = `<div style="page-break-after:always"></div>`

                    $('#page1').append(fenye);
                }

                var printStr = "<html><head><meta http-equiv='Content-Type' content='text/html; charset=utf-8'>" +
                    "<style media=\"print\">" +
                    "    @page {" +
                    "      size: auto;  /* auto is the initial value */\n" +
                    "      margin: 0mm; /* this affects the margin in the printer settings */\n" +

                    "    }" +
                    "</style>" +
                    "</head><body style='height: 140px; margin: 0;'>";
                var content = "";
                for (var m = 0; m < totalPriPage; m++) {
                    var newm = m + 1;
                    var str = document.getElementById('page' + newm + '').innerHTML;
                    content = content + str;
                }


                printStr = printStr + content + "</body></html>";
                var pwin = window.open("Print.htm", "print"); //如果是本地测试，需要先新建Print.htm，如果是在域中使用，则不需
                pwin.document.write(printStr);
                pwin.document.close();     //这句很重要，没有就无法实现
                pwin.print();

            },
        }
    }
</script>

<style scoped>

    .category {
        padding-left: 0;
    }

</style>
