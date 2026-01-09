<template>


    <div class="row " style="min-height: 600px; ">

        <div class="box-body row " id="body">

            <div class="col-md-4 col-sm-3">
                <div class="col-md-12 col-sm-12">
                    <div class="form-group">

                        <label>订货店铺:</label>
                        <select class="form-control select2" id="replaceStore">
                            <option v-for="(item) in settleTypeTwo" :value="item.depName"
                                    :depid="item.depId" :fatherid="item.depFatherId">
                                {{item.depName}}
                            </option>
                        </select>
                    </div>
                </div>

                <div class="col-md-12  col-sm-12" id="paste">

                    <div class="form-group"
                         style="font-size: 12px; display: flex; flex-flow: row nowrap;  justify-content:flex-start; ">
                        <label style="margin-right: 30px;" class="">
                            <input type="radio" name="r1" class="flat-red " value="paste"
                            >
                            粘贴文字
                        </label>
                        <label style="margin-right: 30px;">
                            <input type="radio" name="r1" class="flat-red" value="file"
                            >
                            上传Excel表
                        </label>
                    </div>

                    <div class="row-c" id="pastePart">
                          <textarea :disabled="saveCount >  -1" class="col-md-10 col-sm-10" id="pasteContent"
                                    rows="20" cols="28"
                                    style="padding: 10px;font-size: 14px; "
                                    placeholder="粘贴格式为：
“商品+数量+订货单位”
鸡蛋一筐，
虾皮二斤，
西红柿10斤" v-model="sentence"> </textarea>
                        <div class="col-md-2 col-sm-2" v-if="saveCount == -1">
                            <button v-if="sentence.length > 0" class="btn-success btn-sm" style="margin-top: 20px;"
                                    @click="stepOne">转换订单
                            </button>

                            <button v-if="sentence.length > 0" class="btn-warning btn-sm" style="margin-top: 50px;"
                                    @click="clearPaste">清除内容
                            </button>
                        </div>
                    </div>

                    <div id="fillPart" style="display: none">
                        <text>上传Excel订单表</text>
                        <input type="file"  id="people-export" ref="inputer" @change="fileUpload"/>
                    </div>

                </div>

            </div>

            <div class="col-md-8  col-sm-12" id="orderPart">

                <div class="box">
                    <div class="row" style="background-color:#f9f9f9; padding: 10px 10px; ">
                        <div class="col-md-10  col-sm-10" style=" line-height: 32px;">
                            转换订单:
                        </div>
                        <div class="col-md-2 col-sm-2" v-if="saveCount == -1 && searchGoodsArr.length > 0">
                            <button class="btn-success btn-sm" @click="savePasteOrders">保存订单
                            </button>
                        </div>
                    </div>

                    <div class="scrollable-div row box-body no-padding" v-if="saveCount == -1">
                        <div class="col-md-12  " v-if="searchGoodsArr.length > 0" v-for="(apply,orderIndex) in searchGoodsArr" :key="orderIndex">

                            <div class="row"
                                 style="padding-top: 5px; padding-bottom: 5px; position: relative;float: left; font-size: 14px;
                                            display: flex;flex-flow: row wrap;justify-content: flex-start;align-items: center;">

                                <!-- 圆点 -->
                                <div class="body-item" style="width: 5%;">
                                    {{orderIndex + 1}}
                                </div>
                                <!-- 名字-->

                                <div class="body-item" style="width: 40%;  position: relative;  ">
                                    <input v-if="apply.nxDoDisGoodsId !== null " class="goodsName"
                                           :id='+ orderIndex + "_pasteOne_goodsName"'
                                           :orderindex="orderIndex" :standard="apply.nxDoStandard"
                                           placeholder="" autocomplete="off" v-model="apply.nxDoGoodsName"
                                           style="color: #3c8dbc; width: 95%; padding: 5px; border: none; border-bottom: 1px solid lightgray; "/>
                                    <input v-else class="goodsName" :id='+ orderIndex + "_pasteOne_goodsName"'
                                           :orderindex="orderIndex" :standard="apply.nxDoStandard"
                                           placeholder="" autocomplete="off" v-model="apply.nxDoGoodsName"
                                           style="width: 95%; padding: 5px; border: none; border-bottom: 1px solid lightgray; "/>

                                </div>

                                <!-- 数量 -->
                                <div class="body-item"
                                     style="width:20%; display: flex; flex-flow: row nowrap; align-items: center; ">
                                    <input type="number" class="quantity" :id='+ orderIndex + "_pasteOne_quantity"'
                                           :orderindex="orderIndex"
                                           style="width: 70%; padding: 5px; border: none; border-bottom: 1px solid lightgray;"
                                           autocomplete="off" v-model="apply.nxDoQuantity"/>
                                </div>

                                <!-- 规格 -->
                                <div class="body-item"
                                     style="width: 20%; display: flex; flex-flow: row nowrap; align-items: center; ">
                                    <input type="text" class="standard" :orderindex="orderIndex"
                                           style="width: 100%; padding: 5px; border: none; border-bottom: 1px solid lightgray;"
                                           :id='+ orderIndex + "_pasteOne_remark"' autocomplete="off"
                                           v-model="apply.nxDoStandard"/>
                                </div>
                                <!--  -->
                                <div class="body-item"
                                     style="width: 7.5%; display: flex; flex-flow: row nowrap; align-items: center;"
                                     @click="delPaste(orderIndex)">
                                    <img class="row_icon" src="../../assets/ashbin.png" alt="">
                                </div>
                                <!--  -->
<!--                                <div class="body-item"-->
<!--                                     style="width: 7.5%; display: flex; flex-flow: row nowrap; align-items: center;"-->
<!--                                     @click="showNewGoods(orderIndex,apply.nxDoGoodsName, apply.nxDoStandard)">-->
<!--                                    <img class="row_icon" src="../../assets/logo.png" alt="">-->
<!--                                </div>-->
                                <!--  -->

                            </div>

                        </div>
                    </div>

                    <div class="scrollable-div row box-body no-padding" v-else>
                        <div v-if="searchGoodsArr.length > 0">
                            <div class="col-md-12"  v-for="(apply,orderIndex) in searchGoodsArr" :key="orderIndex">

                                <div class="" v-if="apply.nxDoStatus == -2">
                                    <div class="row"
                                         style="padding-top: 5px; padding-bottom: 5px; position: relative;float: left; font-size: 14px;
                                            display: flex;flex-flow: row wrap;justify-content: flex-start;align-items: center; ">

                                        <!-- 圆点 -->
                                        <div class="body-item" style="width: 5%;">
                                            {{orderIndex + 1}}
                                        </div>
                                        <!-- 名字-->

                                        <div class="body-item" style="width: 40%;  position: relative; ">
                                            <input class="goodsName" :id='+ orderIndex + "_pasteOne_goodsName"'
                                                   :orderindex="orderIndex"
                                                   placeholder="" autocomplete="off" v-model="apply.nxDoGoodsName"
                                                   style="width: 95%; padding: 5px; border: none; border-bottom: 1px solid lightgray; "/>
                                        </div>

                                        <!-- 数量 -->
                                        <div class="body-item"
                                             style="width:20%; display: flex; flex-flow: row nowrap; align-items: center; ">
                                            <input type="number" class="quantity" :id='+ orderIndex + "_pasteOne_quantity"'
                                                   :orderindex="orderIndex"
                                                   style="width: 70%; padding: 5px; border: none; border-bottom: 1px solid lightgray;"
                                                   autocomplete="off" v-model="apply.nxDoQuantity"/>
                                        </div>

                                        <!-- 规格 -->
                                        <div class="body-item"
                                             style="width: 20%; display: flex; flex-flow: row nowrap; align-items: center; ">
                                            <input type="text" class="standard" :orderindex="orderIndex"
                                                   style="width: 100%; padding: 5px; border: none; border-bottom: 1px solid lightgray;"
                                                   :id='+ orderIndex + "_pasteOne_remark"' autocomplete="off"
                                                   v-model="apply.nxDoStandard"/>
                                        </div>
                                        <!--  -->
                                        <div class="body-item"
                                             style="width: 7.5%; display: flex; flex-flow: row nowrap; align-items: center;"
                                             @click="showNewGoods(orderIndex,apply.nxDoGoodsName, apply.nxDoStandard)">
                                            <img class="row_icon" src="../../assets/logo.png" alt="">
                                        </div>
                                        <!--  -->


                                    </div>

                                    <div v-if="apply.nxDistributerGoodsEntityList.length > 0" style="position:relative;">
                                        <ul
                                                style=" width: 60%;  background: #f9f9f9; padding: 4px 10px;padding-inline-start: 0; overflow: auto; max-height: 200px;  float: left; margin-left: 25px;">
                                            <li class="goods_line"
                                                v-for="(goods, goodsIndex) in apply.nxDistributerGoodsEntityList"
                                                style="list-style: none; line-height: 30px; height: 30px; border: 1px solid gray;">

                                                <span class="brand" v-if="goods.nxDgGoodsBrand !== null  &&  goods.nxDgGoodsBrand.length > 0">[{{goods.nxDgGoodsBrand}}]</span>
                                                <span class="margin-l-right">{{goods.nxDgGoodsName}}</span>
                                                <span v-if="goods.nxDgGoodsStandardWeight !== null && goods.nxDgGoodsStandardWeight.length > 0">({{goods.nxDgGoodsStandardWeight}}/{{goods.nxDgGoodsStandardname}})</span>
                                                <span v-else>({{goods.nxDgGoodsStandardname}})</span>

                                                <span class="btn_span" style="float: right"
                                                      @click="selectOrderNxGoods(goodsIndex, orderIndex,goods.nxDistributerGoodsId)">选择G</span>

                                                <span v-if="goods.nxDgGoodsName !== apply.nxDoGoodsName " class="btn_img"
                                                      style="align-items: center;margin-right: 10px;float: right"
                                                      @click="addAlias(orderIndex, goodsIndex)">
                                                                <img class="span_icon" src="../../assets/Altgo_.png"
                                                                     alt="添加别名">
                                                            </span>

                                            </li>
                                            <li style="width: auto; font-size:12px; color: gray; ">没有数据啦！</li>
                                        </ul>
                                    </div>

                                </div>

                                <div class="row" v-else style="width: 100%; padding-top: 5px; padding-bottom: 5px; position: relative;float: left; font-size: 14px;
                                            display: flex;flex-flow: row wrap;justify-content: flex-start;align-items: center; ">

                                    <!-- 圆点 -->
                                    <div class="body-item" style="width: 5%;">
                                        {{orderIndex + 1}}
                                    </div>
                                    <!-- 名字-->
                                    <div class="body-item" style="width: 40%; display: flex; ">
                                        <div>{{apply.nxDoGoodsName}}</div>
                                    </div>
                                    <!-- 数量 -->
                                    <div class="body-item"
                                         style="width: 20%; display: flex; flex-flow: row nowrap; align-items: center;">
                                        <div>{{apply.nxDoQuantity}}</div>
                                    </div>
                                    <!-- 规格 -->
                                    <div class="body-item"
                                         style="width: 20%; display: flex; flex-flow: row nowrap; align-items: center;">
                                        <div>{{apply.nxDoStandard}}</div>
                                        <!-- 备注按钮 -->
                                        <div class="body-item">
                                            <button type="button" class="btn btn-box-tool showBtn" data-toggle="tooltip"
                                                    title="Contacts"
                                                    data-widget="chat-pane-toggle" :id='+ apply + "_pasteOne_btn"'>
                                                <i class="fa fa-comments "></i></button>
                                            <input class="remark" disabled="disabled" type="text"
                                                   style=" background: gray; color: #fff; position: absolute;left: 0; top: 0; line-height: 30px; display: none; "
                                                   name="remark" v-model="apply.nxDoRemark"/>
                                        </div>
                                    </div>


                                    <!--  -->
                                    <div class="body-item"
                                         style="width: 7.5%; display: flex; flex-flow: row nowrap; align-items: center; ">
                                        <img class="row_icon" src="../../assets/correct.png" alt=""
                                             style="width: 20px; height: 20px;">
                                    </div>
                                    <!--  -->
                                    <div class="body-item" style="width: 7.5%; display: flex; flex-flow: row nowrap;
                        align-items: center;" @click="showEditOrder(orderIndex)">
                                        <img class="row_icon" src="../../assets/edit-3.png" alt="">
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                </div>

            </div>

        </div>


        <AddNewGoods :goodsName="goodsName" :standard="standard" @submit-add="addGoodsOk"/>
        <EditOrderModal :editOrder="editOrder" @submit-add="updateOrder"/>

        <WarnOrder :warnWords="warnWords" :warnType="warnType"/>
        <WarnGoods/>
    </div>


</template>

<script>

    import api from '@/api/order/customer'
    import apiDis from '@/api/order/distributer'
    import AddNewGoods from '@/components/Applys/AddNewGoods.vue'
    import EditOrderModal from '@/components/Applys/EditOrderModal.vue'
    import WarnOrder from '@/components/Applys/WarnOrder.vue'
    import WarnGoods from '@/components/Applys/WarnGoods.vue'

    export default {
        name: "ReplaceOrder",
        data() {
            return {
                settleTypeTwo: [],
                depName: "",
                depIndex: "0",
                warnStore: "",
                storeList: [],
                selectedFile: null,  // 选中的文件
                searchGoodsArr: [],
                saveCount: -1,
                finishCount: -1,
                sentence: "",
                depId: "",
                depFatherId: "",
                goodsName: " ",
                standard: "",
                orderArrIndex: "-1",
                goodsId: "",
                goodsArrIndex: "",
                beforeId: "-1",
                queryArr: [],
                editOrder: "",

                warnWords: "",
                warnType: "",
                timeoutId: "",
                searchArr: [],
                buttonClicked: false,


            }
        },

        components: {
            AddNewGoods,
            EditOrderModal,
            WarnOrder,
            WarnGoods
        },

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

            todayDate() {
                var today = new Date();
                var year = today.getFullYear();//获取年份
                var month = today.getMonth() + 1;//获取月份
                var day = today.getDate();//获取日期
                console.log(year + "-" + month + "-" + day);
                return year + "-" + month + "-" + day;
            },

            arr() {
                var arr = this.$store.state.pasteArr;
                if (arr.length > 0) {
                    return arr;
                } else {
                    return [];
                }
            }

        },

        mounted() {

            var that = this;
            that.sentence = $('#pasteContent').val();


            $('input[type=radio].flat-red').eq(0).iCheck('check');


            $('#pasteContent').change('', function (e) {
                var newText = $(this).val();
                console.log("Textarea内容发生变化：" + newText);
                that._formatSentence(newText);
            })

            $('#body').on('click', '.showBtn', function (e) {
                var btn = $('#' + e.currentTarget.id);
                var remark = $(btn).siblings('input[name="remark"]');
                console.log(btn)
                // console.log(remark)

                if (remark.is(':visible')) {
                    console.log("visibel")
                    $(remark).hide(200);

                } else {
                    $(remark).show(500);
                    console.log("hdieiieiei")
                }
            })

            $('input[name="remark"]').on('change', function () {
                if ($(this).val().length > 0) {
                    console.log($(this).parent().next().children());
                    $(this).siblings('button').children('i').addClass('active');
                } else {
                    $(this).siblings('button').children('i').removeClass('active');
                }
            })

            $('input[type=radio][name=r1]').on('ifChecked', function (obj) {

                if ($(this).val() == "paste") {
                    console.log("shi paste");
                    $('#selectImg').attr("disabled", "disabled");
                    $('#forAddImg').css("color", "gray")
                    $('#fillPart').hide();
                    $('#pastePart').show();
                    $('#people-export').val("");
                }
                if ($(this).val() == "file") {
                    console.log("file upaloadkk");
                    $('#selectImg').attr("disabled", "disabled");
                    $('#forAddImg').attr("color", "gray");
                    $('#fillPart').show();
                    $('#pastePart').hide();
                    $('#people-export').val("");
                }


                var depName = that.depName;
                var arr = that.arr;
                if (arr.length > 0) {
                    for (var i = 0; i < arr.length; i++) {
                        var name = arr[i].depName;
                        if (depName === name) {
                            that.searchGoodsArr = arr[i].arr;
                            that.saveCount = arr[i].saveCount;
                            that.sentence = arr[i].sentence;
                            $('#orderPart').show();
                            i = arr[i].length;
                        } else {
                            that.sentence = "";
                            that.saveCount = -1;
                            that.finishCount = -1;
                            that.searchGoodsArr = [];
                            $('#orderPart').hide();
                        }
                    }

                    var updateArr = [];
                    for (var i = 0; i < arr.length; i++) {
                        var depArr = arr[i].arr;
                        if (depArr.length > 0) {
                            var finishCount = 0;
                            for (var j = 0; j < depArr.length; j++) {
                                var status = depArr[j].nxDoStatus;
                                console.log(j + "--=j ===", status);
                                if (status == 0) {
                                    finishCount = finishCount + 1;
                                }
                            }
                            if (finishCount !== depArr.length) {
                                updateArr.push(arr[i]);
                            }
                        }
                    }
                    if (updateArr.length > 0) {
                        that.$store.commit('$_setPasteOrder', updateArr);
                    } else {
                        localStorage.removeItem('pasteArr'); //
                        that.searchGoodsArr = [];
                        that.sentence = "";
                        that.finishCount = -1;
                        that.saveCount = -1;
                    }
                }
            })

            //选择店铺
            $('#replaceStore').on('change', function () {

                console.log("选择店铺选择店铺选择店铺");

                $('#people-export').val("");

                var obj = $('#replaceStore');
                var depName = obj.val();
                that.depName = depName;
                that.depId = $("#replaceStore option:selected").attr('depid');
                that.depFatherId = $("#replaceStore option:selected").attr('fatherid');
                var arr = that.arr;
                if (arr.length > 0) {
                    for (var i = 0; i < arr.length; i++) {
                        var name = arr[i].depName;
                        if (depName === name) {
                            that.searchGoodsArr = arr[i].arr;
                            that.saveCount = arr[i].saveCount;
                            that.finishCount = arr[i].finishCount;
                            that.sentence = arr[i].sentence;
                            $('#orderPart').show();
                            i = arr[i].length;
                        } else {
                            that.sentence = "";
                            that.saveCount = -1;
                            that.finishCount = -1;
                            that.searchGoodsArr = [];
                            $('#orderPart').hide();
                        }
                    }

                    var updateArr = [];

                    for (var i = 0; i < arr.length; i++) {
                        var depArr = arr[i].arr;
                        if (depArr.length > 0) {
                            var finishCount = 0;
                            for (var j = 0; j < depArr.length; j++) {
                                var status = depArr[j].nxDoStatus;
                                if (status == 0) {
                                    finishCount = finishCount + 1;
                                }
                            }
                            if (finishCount !== depArr.length) {
                                updateArr.push(arr[i]);
                            }
                        }
                    }
                    if (updateArr.length > 0) {
                        that.$store.commit('$_setPasteOrder', updateArr);
                    } else {
                        localStorage.removeItem('pasteArr'); //
                        that.searchGoodsArr = [];
                        that.sentence = "";
                        that.saveCount = -1;
                        that.finishCount = -1;

                    }


                }

            });

            //初始化select选择框
            $('.select2').select2({
                language: 'zh-CN',
                width: '100%',
                placeholder: '请选择店铺'

            })

            //iCheck for checkbox and radio inputs
            $('input[type="checkbox"].minimal, input[type="radio"].minimal').iCheck({
                checkboxClass: 'icheckbox_minimal-blue',
                radioClass: 'iradio_minimal-blue'
            });

            //Flat red color scheme for iCheck
            $('input[type="checkbox"].flat-red, input[type="radio"].flat-red').iCheck({
                checkboxClass: 'icheckbox_flat-green',
                radioClass: 'iradio_flat-green'
            });

            $('#body').on('mouseover', 'li', function (e) {
                $(this).css("background-color", "#dddddd");
            });

            $('#body').on('mouseleave', 'li', function (e) {
                $(this).css("background-color", "");
            });

            $('#body').on('blur', '.goodsName', function (e) {

                that.buttonClicked = false;
                setTimeout(function () {
                    if (!that.buttonClicked) {
                        console.log("haijinlaiiamamamamaammamamamamammammamamma")
                        that.queryArr = [];
                        $('#search_result').remove();

                    }
                }, 200);

            });


            $('#body').on('focus', '.goodsName', function (e) {

                //获取当前输入框
                var input = $('#' + e.currentTarget.id);
                var index = input.attr('orderindex');
                var standard = input.attr("standard");
                that.orderArrIndex = index;
                that.buttonClicked = false;
                //1.2 获取输入内容
                var value = e.currentTarget.value;

                if (value.length > 0) {
                    //1.1 删除原来查询结果
                    $('#search_result').remove();
                       var data = "disId=" + that.disId + "&searchStr=" + value +
                        "&depId=" + that.depId;
                    apiDis.queryDisGoodsByQuickSearchWithDepId(data).then(res => {
                        if (res) {

                            //1.0 获取商品数组
                            that.queryArr = res.data;
                            this.queryArr = res.data;

                            if (this.queryArr.length > 0) {
                                //1.1 删除原来查询结果
                                $('#query_result li').remove();

                                //1.3.1 获取当前光标位置
                                var top = input.offset().top;
                                var left = input.offset().left;
                                var width = input.width();
                                var height = input.height();

                                //1.3.2 添加绝对定位的div
                                var newdiv = ` <div class="search_result with-border" style="background: #fff; border: 1px solid #ddd" id="search_result">
                                <ul id="query_result"  style=" width: 100%; background: #f9f9f9; padding: 4px 10px; padding-inline-start: 0; overflow: auto; max-height: 200px;  float: left; ">
                                </ul>
                            </div>`

                                //1.3.3 添加搜索页面到根元素#app
                                $('#app').append(newdiv);

                                //1.3.4 计算搜索页面到定位
                                var $search_result = $('#search_result');
                                $($search_result).width(width * 2);
                                $($search_result).css({position: "absolute"})
                                $($search_result).css("left", left);
                                $($search_result).css("top", top + height + 10);

                                //1.3.5 获取新搜索页面
                                var $query_result = $('#query_result');
                                //1.3.6 添加li到新搜索页面
                                for (var i = 0; i < this.queryArr.length; i++) {
                                    var goods = this.queryArr[i];
                                    var attr = `goodsindex=` + i + ` goodsid=` + goods.nxDistributerGoodsId;
                                    var brand = "";
                                    if (goods.nxDgGoodsBrand !== null && goods.nxDgGoodsBrand.length > 0) {
                                        brand = "[" + goods.nxDgGoodsBrand + "]";
                                    }

                                    var goodsName = goods.nxDgGoodsName;
                                    var goodsStandard = "";
                                    if (goods.nxDgGoodsStandardWeight !== null && goods.nxDgGoodsStandardWeight.length > 0) {
                                        goodsStandard = goods.nxDgGoodsStandardWeight + "/" + goods.nxDgGoodsStandardname;
                                    } else {
                                        goodsStandard = goods.nxDgGoodsStandardname;
                                    }

                                    if (value !== goodsName) {
                                        $($query_result).append(`<li class="goods_line" style="list-style: none; line-height: 30px; height: 30px;border-bottom: 1px solid lightgrey;" ` + attr + `>
                                            <span class="brand">${brand}</span>
                                             <span class="margin-l-right">${goodsName}</span>
                                              <span class="">${goodsStandard}</span>
                                              <span class="btn_span query-item " style="float: right" ` + attr + `>选择Focus</span>
                                              <span class="btn_img" ` + attr + ` style="align-items: center;margin-right: 10px;float: right" @click="addAlias" > 加别名Focus</span>
                                              </li>`);
                                    } else {

                                        if (standard == goodsStandard) {
                                            $($query_result).append(`<li class="goods_line" style="color: #0d6aad; list-style: none; line-height: 30px; height: 30px;border-bottom: 1px solid lightgrey;" ` + attr + `>
                                            <span class="brand">${brand}</span>
                                             <span class="margin-l-right">${goodsName}</span>
                                              <span class="">${goodsStandard}</span>
<!--                                              <span class="btn_span query-item" style="float: right"` + attr + ` >选择</span>-->
                                              </li>`);
                                        } else {
                                            $($query_result).append(`<li class="goods_line" style="list-style: none; line-height: 30px; height: 30px;border-bottom: 1px solid lightgrey;" ` + attr + `>
                                            <span class="brand">${brand}</span>
                                             <span class="margin-l-right">${goodsName}</span>
                                              <span class="">${goodsStandard}</span>
                                              <span class="btn_span query-item" style="float: right"` + attr + ` >选择focus</span>
                                              </li>`);
                                        }
                                    }
                                }

                                // <img class="span_icon" src="`+ url + `">-->


                                //1.3.7 给第一条数据添加背景色
                                // var item = $('.query-item')[0];
                                // $(item).css('background', '#ddd');


                                // 2，点击搜索结果的商品
                                $('.query-item').on('click', function (e) {
                                    // 处理按钮点击事件的逻辑
                                    that.buttonClicked = true;
                                    var goodsIndex = $(this).attr('goodsindex');
                                    var goodsId = $(this).attr('goodsid');
                                    that.goodsArrIndex = goodsIndex;
                                    that.goodsId = goodsId;
                                    console.log("shimeiyouqururrugogo", that.queryArr.length)
                                    that._choiceBeforeSaveGoods();

                                });
                            }
                        }
                    })
                }

            });

            // 失去焦点


            //shuru-----
            $('#body').on('keyup', '.goodsName', function (e) {

                //获取当前输入框
                var input = $('#' + e.currentTarget.id);
                var index = input.attr('orderindex');
                that.orderArrIndex = index;

                //如果不是"回车，向下，空格，删除"4个按键
                if (e.keyCode !== 40 && e.keyCode !== 13 && e.keyCode !== 32) {

                    console.log("给商品输入框初始化输入事件和选择搜索页面事件");
                    //1.1 删除原来查询结果
                    $('#search_result').remove();

                    //1.2 获取输入内容
                    var value = e.currentTarget.value;
                    console.log(value)

                    if (value.length === 0) {
                        $('#search_result').remove();
                    }

                    if (value.length > 0) {

                        var data = "disId=" + that.disId + "&searchStr=" + value +
                            "&depId=" + that.depId;
                        console.log(data);
                        apiDis.queryDisGoodsByQuickSearchWithDepId(data).then(res => {
                            if (res) {
                                //1.0 获取商品数组
                                this.queryArr = res.data;
                                that.queryArr = res.data;
                                if (this.queryArr.length > 0) {

                                    //1.1 删除原来查询结果
                                    $('#query_result li').remove();

                                    //1.3.1 获取当前光标位置
                                    var top = input.offset().top;
                                    var left = input.offset().left;
                                    var width = input.width();
                                    var height = input.height();

                                    //1.3.2 添加绝对定位的div
                                    var newdiv = ` <div class="search_result with-border" style="background: #fff; border: 1px solid #ddd" id="search_result">
                                <ul id="query_result"  style=" width: 100%; background: #f9f9f9; padding: 4px 10px; padding-inline-start: 0; overflow: auto; max-height: 200px;  float: left; ">
                                </ul>
                            </div>`

                                    //1.3.3 添加搜索页面到根元素#app
                                    $('#app').append(newdiv);

                                    //1.3.4 计算搜索页面到定位
                                    var $search_result = $('#search_result');
                                    $($search_result).width(width * 2);
                                    $($search_result).css({position: "absolute"})
                                    $($search_result).css("left", left);
                                    $($search_result).css("top", top + height + 10);

                                    //1.3.5 获取新搜索页面
                                    var $query_result = $('#query_result');
                                    //1.3.6 添加li到新搜索页面
                                    for (var i = 0; i < this.queryArr.length; i++) {
                                        var goods = this.queryArr[i];
                                        var id = goods.nxDistributerGoodsId + "_goods_line";
                                        // var attr = `goodsId=` + goods.goodsId + ` fatherId=` + goods.fatherId + `   outDepId=` + goods.outDepId + `   standard=` + goods.applyStandardName;
                                        var attr = `goodsindex=` + i + ` goodsid=` + goods.nxDistributerGoodsId;

                                        var brand = "";
                                        if (goods.nxDgGoodsBrand !== null && goods.nxDgGoodsBrand.length > 0) {
                                            brand = "[" + goods.nxDgGoodsBrand + "]";
                                        }

                                        var goodsName = goods.nxDgGoodsName;
                                        var standard = "";
                                        if (goods.nxDgGoodsStandardWeight !== null && goods.nxDgGoodsStandardWeight.length > 0) {
                                            standard = goods.nxDgGoodsStandardWeight + "/" + goods.nxDgGoodsStandardname;
                                        } else {
                                            standard = goods.nxDgGoodsStandardname;
                                        }

                                        if (value !== goodsName) {
                                            $($query_result).append(`<li class="goods_line" style="list-style: none; line-height: 30px; height: 30px;border-bottom: 1px solid lightgrey;" ` + attr + `>
                                            <span class="brand">${brand}</span>
                                             <span class="margin-l-right">${goodsName}</span>
                                              <span class="">${standard}</span>
                                              <span class="btn_span query-item" ` + attr + ` style="float: right"  >选择Type</span>
                                              <span class="btn_img" ` + attr + ` style="align-items: center;margin-right: 10px;float: right" > 加别名Type</span>
                                              </li>`);
                                        } else {


                                            if (standard == goodsStandard) {
                                                $($query_result).append(`<li class="goods_line" style="color: #0d6aad; list-style: none; line-height: 30px; height: 30px;border-bottom: 1px solid lightgrey;" ` + attr + `>
                                            <span class="brand">${brand}</span>
                                             <span class="margin-l-right">${goodsName}</span>
                                              <span class="">${goodsStandard}</span>
<!--                                              <span class="btn_span query-item" style="float: right"` + attr + ` >选择</span>-->
                                              </li>`);
                                            } else {
                                                $($query_result).append(`<li class="goods_line" style="list-style: none; line-height: 30px; height: 30px;border-bottom: 1px solid lightgrey;" ` + attr + `>
                                            <span class="brand">${brand}</span>
                                             <span class="margin-l-right">${goodsName}</span>
                                              <span class="">${goodsStandard}</span>
                                              <span class="btn_span query-item" ` + attr + ` style="float: right" >选择Type</span>
                                              </li>`);
                                            }
                                        }


                                    }


                                    //1.3.7 给第一条数据添加背景色
                                    // var item = $('.query-item')[0];
                                    // $(item).css('background', '#ddd');


                                    // 2，点击搜索结果的商品
                                    $('.query-item').on('click', function (e) {

                                        // if (that.inputFocused) {
                                        //     // 输入框获得焦点时的处理逻辑
                                        // } else {
                                        //     // 处理按钮点击事件的逻辑
                                        // }

                                        // var goodsName = $(this).text();
                                        // var goodsId = $(this).attr('goodsid');
                                        // var standardName = $(this).attr('standard');
                                        // var fatherId = $(this).attr('fatherId');
                                        // var outDepId = $(this).attr('outDepId');
                                        // console.log(goodsId);
                                        console.log("hai?????");
                                        // that.buttonClicked = true;
                                        var goodsIndex = $(this).attr('goodsindex');
                                        var goodsId = $(this).attr('goodsid');
                                        that.goodsArrIndex = goodsIndex;
                                        that.goodsId = goodsId;
                                        console.log("shimeiyouqururrugogo", goodsIndex)
                                        console.log("shimeiyouqururrugogo", that.goodsArrIndex)
                                        that._choiceBeforeSaveGoods();

                                        //选择点击商品到行内
                                        // selectGoods(goodsName, goodsId, standardName, fatherId, outDepId);

                                    });
                                }
                            }
                        })
                    } else {
                        // $(input).val("请输入商品的名称的拼音");

                        this.warn = "请输入商品的名称的拼音"
                    }
                }


            });


            this.getAllOutDep();


        },


        beforeDestroy(){
            console.log("beforeDeoryrybeforeDeoryrybeforeDeoryry----------")
            console.log(this.depFatherId,"depfahtidididiiddidd........")
            console.log(this.arr,"arrarrarrarrarr........")
            var arr = this.arr;
            if (arr.length > 0) {
                // for (var i = 0; i < arr.length; i++) {
                //     var name = arr[i].depName;
                //     if (depName === name) {
                //         this.searchGoodsArr = arr[i].arr;
                //         that.saveCount = arr[i].saveCount;
                //         that.finishCount = arr[i].finishCount;
                //         that.sentence = arr[i].sentence;
                //         i = arr[i].length;
                //     } else {
                //         that.sentence = "";
                //         that.saveCount = -1;
                //         that.finishCount = -1;
                //         that.searchGoodsArr = [];
                //     }
                // }

                // var updateArr = [];
                //
                // for (var i = 0; i < arr.length; i++) {
                //     var depArr = arr[i].arr;
                //     if (depArr.length > 0) {
                //         var finishCount = 0;
                //         for (var j = 0; j < depArr.length; j++) {
                //             var status = depArr[j].nxDoStatus;
                //             if (status == 0) {
                //                 finishCount = finishCount + 1;
                //             }
                //         }
                //         if (finishCount !== depArr.length) {
                //             updateArr.push(arr[i]);
                //         }
                //     }
                // }
                //
                // if (updateArr.length > 0) {
                //     this.$store.commit('$_setPasteOrder', updateArr);
                // } else {
                //     localStorage.removeItem('pasteArr'); //
                //     this.searchGoodsArr = [];
                //     this.sentence = "";
                //     this.saveCount = -1;
                //     this.finishCount = -1;
                //
                // }

            }
        },

        updated(){
            console.log("updatedupdatedupdatedupdatedupdated--------")

        },

        methods: {


            delPaste(index) {

                this.searchGoodsArr.splice(index, 1);

            },


            updateOrder(order) {
                console.log("orderlaialalallaalaa");
                console.log(order);

            },


            showEditOrder(index) {
                this.orderArrIndex = index;
                this.editOrder = this.searchGoodsArr[index];
                $('#modal_order').show();

            },


            selectOrderNxGoods(goodsIndex, orderIndex, goodsId) {
                this.orderArrIndex = orderIndex;
                this.goodsArrIndex = goodsIndex;
                this.goodsId = goodsId;
                this._choiceGoods();

            },

            addGoodsOk(item) {

                this.goodsId = item.nxDistributerGoodsId;

                this._choiceAddOkGoods(item);
            },

            _choiceBeforeSaveGoods: function () {
                var index = this.orderArrIndex;
                var goodsIndex = this.goodsArrIndex;
                var order = this.searchGoodsArr[index];
                var canSave =  this._checkOrderItemContent(order, index);
                if(canSave){
                    var goods = this.queryArr[goodsIndex];
                    var name = "";
                    var brand = "";
                    if (goods.nxDgGoodsBrand !== null && goods.nxDgGoodsBrand.length > 0) {
                        brand = "[" + goods.nxDgGoodsBrand + ']';
                    }
                    if (goods.nxDgGoodsStandardWeight !== null && goods.nxDgGoodsStandardWeight.length > 0) {
                        name = goods.nxDgGoodsName + " " + goods.nxDgGoodsStandardWeight + "/" + goods.nxDgGoodsStandardname;
                    } else {
                        name = goods.nxDgGoodsName + " " + goods.nxDgGoodsStandardname;
                    }
                    order.nxDoGoodsName = brand + name;

                    order.nxDoDisGoodsId = this.goodsId;
                    this.bus.$emit('loading', true);
                    apiDis.choiceGoodsForApply(order).then(res => {
                        if (res.code == 0) {
                            this.bus.$emit('loading', false);
                            this.searchGoodsArr[this.orderArrIndex] = res.data;
                            this.queryArr = [];
                            $('#search_result').remove();
                            this._checkFinishOrder();
                            this.$forceUpdate();
                            this._updateStore();
                        }
                    })
                }
            },

            _choiceAddOkGoods() {
                var that = this;
                var index = this.orderArrIndex;
                var order = this.searchGoodsArr[index];
                order.nxDoDisGoodsId = this.goodsId;
                console.log(order);
                this.bus.$emit('loading', true);
                apiDis.choiceGoodsForApply(order).then(res => {
                    if (res) {
                        this.bus.$emit('loading', false);
                        that.searchGoodsArr[that.orderArrIndex] = res.data;
                        that._checkFinishOrder();
                        that.$forceUpdate();
                        that._updateStore();
                    }
                })
            },

            _checkFinishOrder(){
                var arr = this.searchGoodsArr;
                var finishCount = 0;
                if(arr.length > 0){
                    for(var i = 0; i < arr.length; i++){
                        var status = arr[i].nxDoStatus;
                        if(status == 0){
                            finishCount = finishCount + 1;
                        }
                    }

                }
                this.finishCount = finishCount;
            },


            _choiceGoods() {
                var that = this;
                var index = this.orderArrIndex;
                var goodsIndex = this.goodsArrIndex;
                var order = this.searchGoodsArr[index];
                var goods = this.searchGoodsArr[index].nxDistributerGoodsEntityList[goodsIndex];
                var name = "";
                if (goods.nxDgGoodsBrand !== null && goods.nxDgGoodsBrand.length > 0) {
                    name = "[" + goods.nxDgGoodsBrand + ']' + goods.nxDgGoodsName;
                }else{
                    name = goods.nxDgGoodsName;
                }
                if (goods.nxDgGoodsStandardWeight !== null && goods.nxDgGoodsStandardWeight.length > 0) {
                    name = name + goods.nxDgGoodsStandardWeight + "/" + goods.nxDgGoodsStandardname;
                }

                order.nxDoGoodsName = name;
                order.nxDoDisGoodsId = this.goodsId;

                this.bus.$emit('loading', true);
                apiDis.choiceGoodsForApply(order).then(res => {
                    if (res) {
                        this.bus.$emit('loading', false);
                        that.searchGoodsArr[that.orderArrIndex] = res.data;
                        that.searchGoodsArr[that.orderArrIndex].nxDistributerGoodsEntityList = [];
                        that._checkFinishOrder();
                        that.$forceUpdate();
                        that._updateStore();
                    }
                })
            },


            savePasteOrders: function () {
                var that = this;
                var canSave = this._checkOrderContent();
                if (canSave) {
                    this.bus.$emit('loading', true);
                    api.searchGoods(this.searchGoodsArr).then(res => {
                        if (res) {
                            this.bus.$emit('loading', false);
                            this.searchGoodsArr = res.data;
                            if (this.searchGoodsArr.length > 0) {
                                var saveCount = 0;
                                var finishCount = 0;
                                for (var i = 0; i < this.searchGoodsArr.length; i++) {
                                    var status = this.searchGoodsArr[i].nxDoStatus;
                                    if (status == -1) {
                                        saveCount = saveCount + 1;
                                    }
                                    if (status == 0) {
                                        finishCount = finishCount + 1;
                                    }
                                }
                                console.log("fincidhcounttt,t,t", finishCount)
                                that.saveCount = saveCount;
                                that.finishCount = finishCount;
                                if(finishCount == res.data.length){
                                    that._delStore();
                                }else{
                                    that._updateStore();
                                }

                            }
                        }
                    })
                }
            },


            _updateStore() {
                var that = this;
                var depName = that.depName;
                var arr = that.arr;
                console.log("updateStorageeeeegrareageeee" , that.arr.length);
                if (arr.length > 0) {
                    var tempArr = [];
                    for (var i = 0; i < arr.length; i++) {
                        var name = arr[i].depName;
                        if (name == depName ) {
                            if(that.finishCount !== that.searchGoodsArr.length){
                                arr[i].arr = that.searchGoodsArr;
                                arr[i].sentence = that.sentence;
                                arr[i].saveCount = that.saveCount;
                                arr[i].finishCount = that.finishCount;
                                tempArr.push(arr[i]);
                            }
                        }else{
                            tempArr.push(arr[i]);
                        }

                    }
                    if(tempArr.length > 0){
                        that.$store.commit('$_setPasteOrder', tempArr);
                    }else{
                        localStorage.removeItem('pasteArr'); //
                    }
                }
            },


            _delStore() {
                console.log("_delStore_delStore_delStore_delStore_delStore");
                var depName = this.depName;
                var arr = this.arr;
                if (arr.length > 0) {
                    var tempArr = [];
                    console.log("depanmeme", depName);
                    for (var i = 0; i < arr.length; i++) {
                        var name = arr[i].depName;
                        if (name !== depName) {
                            console.log("depanmeme!!!!!====", depName);
                            tempArr.push(arr[i]);
                        }
                    }
                    if (tempArr.length > 0) {
                        this.$store.commit('$_setPasteOrder', tempArr);
                    } else {
                        localStorage.removeItem('pasteArr'); //
                    }
                }
            },

            showNewGoods: function (index, goodsName, standard) {
                console.log("addNewGoodsaddNewGoods")
                this.queryArr = [];
                this.goodsName = goodsName;
                this.orderArrIndex = index;
                this.standard = standard;
                $('#modal_add_new_goods').show();
            },


            addAlias(goodsName, aliasName) {
                this.warnGoosName = goodsName;
                this.warnAliasName = aliasName;
                $('#warn_goods').show();
            },


            fileUpload(event) {

                // 上传文件
                var file = event.target.files;
                var formData = new FormData();
                formData.append('file', file[0])
                formData.append('depId', this.depId)
                formData.append('depFatherId', this.depFatherId)
                formData.append('disId', this.disId)
                formData.append('disUserId', this.disUser.nxDistributerUserId)
                let config = {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                }
                // 文件上传
                this.bus.$emit('loading', true);
                api.uploadDepOrderData(formData)
                    .then(res => {
                        if (res) {
                            this.bus.$emit('loading', false);
                            this.searchGoodsArr = res.data;
                            if (res.data.length > 0) {
                                var saveCount = 0;
                                var finishCount = 0;
                                for (var i = 0; i < this.searchGoodsArr.length; i++) {
                                    var status = this.searchGoodsArr[i].nxDoStatus;
                                    if (status == -1) {
                                        saveCount = saveCount + 1;
                                    }
                                    if (status == 0) {
                                        finishCount = finishCount + 1;
                                    }
                                }
                                this.saveCount = saveCount;
                                this.finishCount = finishCount;
                                if(finishCount !== res.data.length){
                                   var stroeArr = this.arr;
                                   var data = {
                                       depName: this.depName,
                                       saveCount: this.saveCount,
                                       finishCount: this.finishCount,
                                       arr: res.data,
                                       sentence: this.sentence,
                                   }
                                   stroeArr.push(data);
                                    this.$store.commit('$_setPasteOrder', stroeArr);
                                }

                                $('#orderPart').show();
                            }

                        }
                    })
            },

            clearPaste() {
                $('#pasteContent').val("");
                this._delStore();
                this.searchGoodsArr = [];
                this.sentence = "";
                this.saveCount = -1;
            },


            _formatSentence(str) {
                console.log("原始句子", str);
                str = str.trim();
                str = str.replace(/:/g, '');
                str = str.replace(/：/g, '');
                str = str.replace(/(^\s*)|(\s*$)/g, ""); //1 去除两端的空格
                console.log("去除两端的空格", str);
                str = str.replace(/\s+/g, "，"); // 2 把所有的空格替换为，
                console.log("把所有的空格替换为，", str);
                str = str.replace(/\、+/g, "，"); // 3 把所有的、替换为，
                console.log("把所有的、替换为，", str);
                str = str.replace(/\。+/g, "，");  // 4 把所有的。替换为，
                console.log("把所有的。替换为，", str);
                str = str.replace(/\,+/g, "，");  // 5 把所有的,替换为，
                console.log("把所有的。替换为，", str);
                // str = str.replace(/\.+/g, "，");  // 6 把所有的.替换为，
                console.log("把所有的。替换为，", str);
                str = str.replace(/\n\f\r\t\v/g, "，");  // 7 把所有的符号替换为，
                console.log("把所有的符号替换为，", str);
                str = str.replace(new RegExp('，+', "gm"), '，\n'); //6 把多个，替换为1 个，=======
                console.log("把多个，替换为1 个，=======", str);

                var lastStr = str.charAt(str.length - 2);
                console.log("charAt，=======", lastStr);

                if (lastStr == "，") {
                    str = str.slice(0, -2);
                    console.log("把多个，替换为1 个，=======", str);
                }
                this.sentence = str;

                // return str;

            },

            // abc(str) {
            //     if (str.indexOf("半")) {
            //         str = str.replace(new RegExp("半", "g"), "0.5");
            //     }
            //     if (str.indexOf("一")) {
            //         str = str.replace(new RegExp("一", "g"), "1");
            //     }
            //     if (str.indexOf("二")) {
            //         str = str.replace(new RegExp("二", "g"), "2");
            //     }
            //     if (str.indexOf("两")) {
            //         str = str.replace(new RegExp("两", "g"), "2");
            //     }
            //     if (str.indexOf("三")) {
            //         str = str.replace(new RegExp("三", "g"), "3");
            //     }
            //     if (str.indexOf("四")) {
            //         str = str.replace(new RegExp("四", "g"), "4");
            //     }
            //     if (str.indexOf("五")) {
            //         str = str.replace(new RegExp("五", "g"), "5");
            //     }
            //     if (str.indexOf("六")) {
            //         str = str.replace(new RegExp("六", "g"), "6");
            //     }
            //     if (str.indexOf("七")) {
            //         str = str.replace(new RegExp("七", "g"), "7");
            //     }
            //     if (str.indexOf("八")) {
            //         str = str.replace(new RegExp("八", "g"), "8");
            //     }
            //     if (str.indexOf("九")) {
            //         str = str.replace(new RegExp("九", "g"), "9");
            //     }
            //     if (str.indexOf("十")) {
            //         str = str.replace(new RegExp("十", "g"), "10");
            //     }
            //
            //     return str;
            // },

            abc(sentence) {
                var that = this;
                var result = "";
                const chineseNumberPattern = /[\u96f6\u4e00\u4e8c\u4e09\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u4E24\u534A]+/g; //句子中含有连续的汉字数字的个数
                const matches = sentence.match(chineseNumberPattern);
                console.log("句子中含有连续的汉字数字的个数matchess==", matches);
                if(matches){
                    if (matches.length == 1) {
                        result = that._countChineseNumber(sentence)
                    }

                    //todo
                    // if (matches.length == 2) {
                    //   result = that._transTwoPlace(sentence)
                    // }
                }else{
                    result = sentence;

                }

                return result;

            },


            _countChineseNumber(sentence) {
                var that = this;
                var result = "";
                const chineseNumberPattern = /[\u96f6\u4e00\u4e8c\u4e09\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u4E24\u534A]/g; //判断句子中含有汉字数字的个数
                const matches = sentence.match(chineseNumberPattern);
                console.log("判断句子中含有汉字数字的个数判断句子中含有汉字数字的个数", matches);
                if (matches.length == 1) {
                    result = that._transOnesPlace(sentence)
                }
                if (matches.length == 2) {
                    var chineseNum = matches[0] + matches[1];
                    result = that._transTwoPlace(sentence, chineseNum)
                }
                return result;
            },

            _transOnesPlace(str) {
                console.log("_transOnesPlace_transOnesPlace--str====", str)
                if (str.indexOf("半")) {
                    str = str.replace(new RegExp("半", "g"), "0.5");
                }
                if (str.indexOf("一")) {
                    str = str.replace(new RegExp("一", "g"), "1");
                }
                if (str.indexOf("二")) {
                    str = str.replace(new RegExp("二", "g"), "2");
                }
                if (str.indexOf("两")) {
                    str = str.replace(new RegExp("两", "g"), "2");
                }
                if (str.indexOf("三")) {
                    str = str.replace(new RegExp("三", "g"), "3");
                }
                if (str.indexOf("四")) {
                    str = str.replace(new RegExp("四", "g"), "4");
                }
                if (str.indexOf("五")) {
                    str = str.replace(new RegExp("五", "g"), "5");
                }
                if (str.indexOf("六")) {
                    str = str.replace(new RegExp("六", "g"), "6");
                }
                if (str.indexOf("七")) {
                    str = str.replace(new RegExp("七", "g"), "7");
                }
                if (str.indexOf("八")) {
                    str = str.replace(new RegExp("八", "g"), "8");
                }
                if (str.indexOf("九")) {
                    str = str.replace(new RegExp("九", "g"), "9");
                }
                if (str.indexOf("十")) {
                    str = str.replace(new RegExp("十", "g"), "10");
                }
                console.log("oneplarerelslslsltltlt==", str)
                return str;
            },


            _transTwoPlace(sentence, chineseNum) {
                console.log("transtowwplaceeee", chineseNum);
                var alaNumber= this._transTwoChineseNumber(chineseNum);
                const parts = sentence.replace(chineseNum,alaNumber);
                console.log("partspartsparts====" , parts)
                return parts;
            },



            _transTwoChineseNumber(chineseNum) {
                const chineseDigits = {
                    '零': 0,
                    '一': 1,
                    '二': 2,
                    '三': 3,
                    '四': 4,
                    '五': 5,
                    '六': 6,
                    '七': 7,
                    '八': 8,
                    '九': 9,
                };
                const multipliers = {
                    '十': 10
                };

                let result = 0;
                let tempNum = 0;

                for (let i = 0; i < chineseNum.length; i++) {
                    const char = chineseNum[i];
                    if (chineseDigits[char] != null) {
                        tempNum = chineseDigits[char];
                        if (i === chineseNum.length - 1) {
                            result += tempNum;
                        }
                    } else if (multipliers[char] != null) {
                        result += tempNum === 0 ? multipliers[char] : tempNum * multipliers[char];
                        tempNum = 0;
                    }
                }

                console.log("_transThreePlacechineseNumchines==", result)
                return result;
            },

            _transThreeChineseNumber(chineseNum) {
                const chineseDigits = {
                    '零': 0,
                    '一': 1,
                    '二': 2,
                    '三': 3,
                    '四': 4,
                    '五': 5,
                    '六': 6,
                    '七': 7,
                    '八': 8,
                    '九': 9,
                };
                const multipliers = {
                    '十': 10
                };

                let result = 0;
                let tempNum = 0;

                for (let i = 0; i < chineseNum.length; i++) {
                    const char = chineseNum[i];
                    if (chineseDigits[char] != null) {
                        tempNum = chineseDigits[char];
                        if (i === chineseNum.length - 1) {
                            result += tempNum;
                        }
                    } else if (multipliers[char] != null) {
                        result += tempNum === 0 ? multipliers[char] : tempNum * multipliers[char];
                        tempNum = 0;
                    }
                }

                console.log("_transThreePlacechineseNumchines==", result)
                return result;
            },

            stepOne() {
                var str = $('#pasteContent').val();
                this._formatSentence(str);

                var sentence = this.sentence;
                if (sentence.length > 0) {
                    const arr = sentence.split("，\n");
                    console.log(arr);
                    var temp = [];
                    var checkItem = null;
                    var checkStandard = null;
                    var checkQuantity = null;

                    for (var i = 0; i < arr.length; i++) {
                        var item = this.abc(arr[i]);
                        var result = item.split(/\d\.?\d*/g);
                        var resultNumber = "";

                        const pattern = /\d+\.\d+/; //小数格式
                        if (pattern.test(item)) {
                            console.log('句子中包含小数');
                            var data = item.match(pattern);
                            console.log(data);
                            if (data.length == 1) {
                                resultNumber = data[0];
                            }
                        } else {
                            console.log('句子中不包含小数');
                            resultNumber = item.replace(/[^\d\.]/g, " ");
                            resultNumber = resultNumber.replace(/\s+/g, '');
                        }
                        var name = result[0];
                        var standard = result[1];

                        console.log("namename==", name)
                        console.log("resultNumberresultNumber==", resultNumber)
                        console.log("standardstandard==", standard)
                        if (name.length > 0 && typeof (name) != "undefined" && typeof (standard) != "undefined" && standard.length > 0 && resultNumber.length > 0) {
                            name = name.replace("\n", "");
                            standard = standard.replace("\n", "");
                            var item = {
                                nxDoStatus: -2,
                                nxDoIsAgent: this.disUser.nxDistributerUserId,
                                nxDoDepartmentId: this.depId,
                                nxDoDepartmentFatherId: this.depFatherId,
                                nxDoGoodsName: name,
                                nxDoDisGoodsId: null,
                                nxDoQuantity: resultNumber,
                                nxDoStandard: standard,
                                nxDoStandardWarn: 0,
                                goodsNameWarn: 0,
                                nxDoDistributerId: this.disId,
                                nxDistributerGoodsEntityList: [],
                            }
                            temp.push(item);

                        } else {
                            i = arr.length - 1;
                            checkItem = name;
                            checkStandard = standard;
                            checkQuantity = resultNumber;
                        }
                    }

                    if (checkItem !== null) {
                        console.log('"!!!!' + checkItem + checkQuantity + checkStandard + '"')
                        this.warnType = "style";
                        if (typeof checkItem === 'undefined') {
                            checkItem = "行有错误"
                        }
                        if (typeof checkQuantity === 'undefined') {
                            checkQuantity = "行有错误"
                        }
                        if (typeof checkStandard === 'undefined') {
                            checkStandard = "行有错误"
                        }
                        this.warnWords = checkItem + checkQuantity + checkStandard;

                        $('#warn_order').show();
                    } else {
                        this.searchGoodsArr = temp;
                        $('#orderPart').show();
                    }

                    var data = {
                        depName: this.depName,
                        arr: temp,
                        saveCount: this.saveCount,
                        sentence: this.sentence,
                        finishCount: this.finishCount,
                    }
                    var list = this.arr;
                    list.push(data);
                    this.$store.commit('$_setPasteOrder', list);
                }

            },


            _checkOrderContent() {
                console.log("_checkOrderContent_checkOrderContent")
                var arr = this.searchGoodsArr;
                var canSave = true;
                for (var i = 0; i < arr.length; i++) {
                    var order = arr[i];
                    var name = order.nxDoGoodsName;
                    var standard = order.nxDoStandard;
                    var quantity = order.nxDoQuantity;
                    var standarWarn = order.nxDoStandardWarn;
                    if (standard.length > 2 && standarWarn == 0) {
                        this.warnType = "standard";
                        this.warnWords = name + " " + quantity + " " + standard;
                        canSave = false;
                        $('#warn_order').show();
                        return canSave;

                    } else {
                        if (name.length > 0 && standard.length > 0 && Number(quantity) > 0) {
                        } else {
                            i = arr.length - 1;
                            canSave = false;
                            this.warnType = "less";
                            this.warnWords = name + " " + quantity + " " + standard;
                            $('#warn_order').show();
                        }
                    }
                }
                console.log("rerereerrcanSave===================", canSave)
                return canSave;
            },


            _checkOrderItemContent(order,i) {
                var that = this;
                var canSave = true;
                var name = order.nxDoGoodsName;
                var standard = order.nxDoStandard;
                var quantity = order.nxDoQuantity;
                var standarWarn = order.nxDoStandardWarn;
                console.log(name);
                console.log(quantity);
                console.log(standard);
                console.log(standarWarn);
                console.log("consstandandnlelelengngnngngngn")
                if (standard.length > 2 && standarWarn == 0) {

                    // wx.showModal({
                    //     title: '单位是否正确?',
                    //     content: name + " " + quantity + " " + standard,
                    //     showCancel: true, //是否显示取消按钮-----》false去掉取消按钮
                    //     cancelText: "确定正确", //默认是“取消”
                    //     cancelColor: 'black', //取消文字的颜色
                    //     confirmText: "修改单位", //默认是“确定”
                    //     confirmColor: '#147062', //确定文字的颜色
                    //     success: function (res) {
                    //         if (res.cancel) {
                    //             //点击取消
                    //             console.log("您点击了取消i",i)
                    //             var data = "orderArr[" + i + "].nxDoStandardWarn";
                    //             that.setData({
                    //                 [data]: 1
                    //             })
                    //             that._choiceGoods();
                    //         } else if (res.confirm) {
                    //             //点击确定
                    //             console.log("您点击了确定")
                    //         }
                    //     }
                    //
                    // })

                    canSave = false;
                    $('#warn_order').show();
                    return canSave;


                } else {
                    if (name.length > 0 && standard.length > 0 && Number(quantity) > 0) {
                        if (standarWarn > 0) {

                            canSave = true;
                        }
                    } else {
                        // i = arr.length - 1;
                        // console.log("rong", i);
                        // wx.showModal({
                        //     title: '订单是否缺少内容?',
                        //     content: name + " " + quantity + " " + standard,
                        //     showCancel: false,
                        //     confirmText: "知道了", //默认是“确定”
                        //     confirmColor: 'gray'
                        // })
                        canSave = false;
                        $('#warn_order').show();
                        return canSave;
                    }
                }
                console.log("rerereerrcanSave===================", canSave)
                return canSave;
            },


            showRemark: function (e) {

                var remark = $(btn).siblings('input[name="remark"]').val();
            },

            getAllOutDep: function () {
                this.bus.$emit('loading', true);

                //获取所有店铺列表
                api.disGetCustomer(this.disId).then(res => {
                    if (res) {
                        this.bus.$emit('loading', false);
                        // var arr = res.data.settleTypeTwo;
                        var arr = res.data;
                        this.searchGoodsArr = [];
                        console.log(arr.length);
                        var temp = [];
                        if (arr.length > 0) {

                            for (var i = 0; i < arr.length; i++) {

                                var depName = arr[i].nxDepartmentAttrName;
                                console.log(depName);
                                var depId = arr[i].nxDepartmentId;
                                var depFatherId = arr[i].nxDepartmentId;

                                if (arr[i].nxDepartmentEntities.length > 0) {
                                    var subs = arr[i].nxDepartmentEntities;

                                    for (var j = 0; j < subs.length; j++) {
                                        var subName = subs[j].nxDepartmentAttrName;
                                        var tempName = arr[i].nxDepartmentAttrName + "-" + subName;
                                        depId = subs[j].nxDepartmentId;
                                        depFatherId = subs[j].nxDepartmentFatherId;
                                        var item = {
                                            depName: tempName,
                                            depId: depId,
                                            depFatherId: depFatherId,
                                            disId: this.disId,
                                        }
                                        temp.push(item);
                                    }

                                } else {
                                    var item = {
                                        depName: depName,
                                        depId: depId,
                                        depFatherId: depFatherId,
                                        disId: this.disId,
                                    }
                                    temp.push(item);
                                }

                            }
                        }

                        this.storeList = res.data;
                        this.depName = temp[0].depName;
                        this.depId = temp[0].depId;
                        this.depFatherId = temp[0].depFatherId;
                        this.settleTypeTwo = temp;

                        var that = this;

                        var arrStorage = that.arr;

                        if (arrStorage.length > 0) {
                            var depNameZero = temp[0].depName;
                            console.log("dpanamezeroroor", depNameZero)
                            for (var i = 0; i < arrStorage.length; i++) {
                                var name = arrStorage[i].depName;
                                if (depNameZero == name) {
                                    console.log( "i=======", i ,"namenamenam===", name);
                                    that.searchGoodsArr = arrStorage[i].arr;
                                    that.sentence = arrStorage[i].sentence;
                                    that.saveCount = arrStorage[i].saveCount;
                                    that.finishCount = arrStorage[i].finishCount;
                                    console.log("thiaaaaas.searchGoodsArr=======" , that.saveCount);
                                }

                            }
                        }

                    }
                });
            },

            _initData() {

                var that = this;

                this.goodsName = "";
                this.standard = "";
                this.orderArrIndex = "-1";
                this.goodsId = "";
                this.beforeId = "-1";
                this.queryArr = [];
                this.editOrder = "";
                this.saveCount = "-1";
                this.warnWords = "";
                this.warnType = "";
                this.sentence = "";
                $('#people-export').val("");

            }
        }
    }

</script>

<style scoped>

    .p-3 {
        width: 100%;
        border: 0.25rem dashed #ddd;
        /*min-height: 500px;*/
        /*max-height: 550px;*/

    }

    .p-4 {
        width: 100%;
        /*border: 0.25rem dashed #ededed;*/
        /*min-height: 400px;*/
        /*max-height: 450px;*/
        overflow-y: auto;
        display: flex;
        flex-flow: column nowrap;
        background: #282828;
        align-items: center;
        /*justify-content: center;*/

    }

    .paste {
        width: 100%;
        border: 0.25rem dashed #ddd;
        min-height: 350px;
        max-height: 400px;
        overflow-y: auto;

    }

    .applys-part {
        overflow-y: auto;
        /*max-height: 400px;*/
        padding-bottom: 50px;
        border: 1px solid lightgray;
        border-radius: 2px;
        padding-top: 10px;
        display: flex;;
        flex-flow: row wrap;
        justify-content: flex-start;
        padding-left: 10px;
        padding-right: 10px;

    }

    #body {
        /*overflow-y: auto;*/
        /*max-height: 360px;*/
        /*padding-bottom: 50px;*/

    }

    .nav-tabs-custom {
        margin-bottom: 0;
    }

    .paste textarea {
        margin: 0 auto;
        /*border: 1px solid red;*/
        width: 100%;

    }

    #replaceUl .active {
        display: block;;
    }

    .margin-right {
        margin-right: 20px;
    }

    .felx-row-2 {
        display: flex;
        flex-flow: row nowrap;
        padding-left: 5px;
        padding-right: 5px;
        justify-content: center;
    }

    .fa.active {
        color: blue;
        position: relative;

    }

    .scrollable-div {
        /*width: 200px;*/
        height: 500px;
        overflow: auto;
        background: #fff;
    }

    .row_icon {
        width: 20px;
        height: 20px;
    }

</style>
