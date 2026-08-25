import ProductPanel from '../components/ProductPanel.vue';
    import Toast from '@/components/Toast.vue';
    import {createOrderListState} from '../stores/orderWorkspaceState';
    import {
        disposeVoiceSubscriptions,
        isVoiceRuntimeAvailable,
        requestTextToSpeech,
        startVoiceRecognition,
        stopVoiceRecognition,
        subscribeVoiceEvents
    } from './voiceInputService';

    export default {
        name: 'OrderEditor',
        components: {
            ProductPanel,
            Toast
        },
        data() {
            return createOrderListState();
        },
        watch: {
            // 当匹配商品列表显示时，默认选中第一项；若上方有推荐商品则优先选中上方，否则才选中下方 nxGoodsEntities
            showMatchedGoods: {
                handler(val) {
                    if (val && typeof val === 'object') {
                        Object.keys(val).forEach(oi => {
                            const idx = parseInt(oi, 10);
                            if (!isNaN(idx) && val[oi] && this.orderItems && this.orderItems[idx]) {
                                const list = this.orderItems[idx].nxDistributerGoodsEntityList;
                                if (list && list.length > 0 && !(this.orderArrIndex === idx && (this.strArr?.length > 0 || this.nxArr?.length > 0))) {
                                    this.selectedMatchedGoodsIndex = {...this.selectedMatchedGoodsIndex, [idx]: 0};
                                    // 上方有推荐商品时，取消下方 nxGoodsEntities 的选中，使默认选中上方第一条
                                    if (this.orderArrIndex === idx && (this.strArr?.length || 0) === 0 && (this.nxArr?.length || 0) === 0) {
                                        this.selectedNxGoodsIndex = -1;
                                    }
                                }
                            }
                        });
                    }
                    // 收起匹配商品后，若当前订单有 nxGoodsEntities 则默认选中其第一项
                    if (this.orderArrIndex != null && this.orderItems && this.orderArrIndex < this.orderItems.length
                        && (this.strArr?.length || 0) === 0 && (this.nxArr?.length || 0) === 0) {
                        const item = this.orderItems[this.orderArrIndex];
                        const noMatchedShown = !val?.[this.orderArrIndex];
                        if (noMatchedShown && item?.nxGoodsEntities?.length > 0) {
                            this.selectedNxGoodsIndex = 0;
                        }
                    }
                    // 不在 watcher 中清空 stoppedIndex：父组件 resetSearchAndMatchedGoodsState 会设置 showMatchedGoods={}，
                    // 若此时选择商品后即将自动继续朗读，清空会导致从第一条开始。收起时清空仅在 handleToggleMatchedGoods 中处理。
                },
                deep: true
            },
            // 当搜索下拉框显示时，默认选中第一项，并取消输入框焦点（避免回车冲突）
            'orderArrIndex': function (val) {
                if (val != null && this.orderItems && val < this.orderItems.length) {
                    const total = (this.strArr?.length || 0) + (this.nxArr?.length || 0);
                    if (total > 0) {
                        this.selectedSearchResultIndex = 0;
                        this._blurGoodsNameInputWhenSearchVisible(val);
                    } else {
                        const item = this.orderItems[val];
                        const hasMatchedGoods = item?.nxDistributerGoodsEntityList?.length > 0 && this.showMatchedGoods?.[val];
                        const hasNxGoods = item?.nxGoodsEntities?.length > 0;
                        if (hasMatchedGoods) {
                            this.selectedMatchedGoodsIndex = {...this.selectedMatchedGoodsIndex, [val]: 0};
                            this.selectedNxGoodsIndex = -1;
                        } else if (hasNxGoods) {
                            this.selectedNxGoodsIndex = 0;
                        }
                    }
                }
            },
            'strArr': function () {
                if (this.orderArrIndex != null && ((this.strArr?.length || 0) + (this.nxArr?.length || 0)) > 0) {
                    this.selectedSearchResultIndex = 0;
                    this._blurGoodsNameInputWhenSearchVisible(this.orderArrIndex);
                }
            },
            'nxArr': function () {
                if (this.orderArrIndex != null && ((this.strArr?.length || 0) + (this.nxArr?.length || 0)) > 0) {
                    this.selectedSearchResultIndex = 0;
                    this._blurGoodsNameInputWhenSearchVisible(this.orderArrIndex);
                } else if (this.orderArrIndex != null && (this.strArr?.length || 0) === 0 && (this.nxArr?.length || 0) === 0) {
                    const item = this.orderItems?.[this.orderArrIndex];
                    const hasMatchedGoods = item?.nxDistributerGoodsEntityList?.length > 0 && this.showMatchedGoods?.[this.orderArrIndex];
                    const hasNxGoods = item?.nxGoodsEntities?.length > 0;
                    if (hasMatchedGoods) {
                        this.selectedMatchedGoodsIndex = {...this.selectedMatchedGoodsIndex, [this.orderArrIndex]: 0};
                        this.selectedNxGoodsIndex = -1;
                    } else if (hasNxGoods) {
                        this.selectedNxGoodsIndex = 0;
                    }
                }
            },
            // 监听订单列表长度变化，当插入新订单时，更新停止序号和队列
            'orderItems.length': {
                handler(newLength, oldLength) {
                    const actualOldLength = this.previousOrderItemsLength || (oldLength || 0);

                    console.log('[OrderList] watch orderItems.length 触发:', {
                        oldLength: actualOldLength,
                        newLength: newLength,
                        orderItemsLength: this.orderItems ? this.orderItems.length : 0
                    });

                    // 首次加载，记录长度
                    if (actualOldLength === 0) {
                        this.previousOrderItemsLength = newLength;
                        return;
                    }

                    // 如果订单数量减少（删除了订单）
                    if (newLength < actualOldLength && this.orderItems) {
                        const newItems = this.orderItems;

                        console.log('[OrderList] 检测到订单删除');
                        console.log('  - 旧订单数量:', actualOldLength, '新订单数量:', newLength);
                        console.log('  - 当前队列长度:', this.ttsQueue.length);
                        console.log('  - 当前 stoppedIndex:', this.stoppedIndex);

                        // ✅ 如果 stoppedIndex >= 0，需要通过订单引用来找到新位置
                        if (this.stoppedIndex >= 0 && this.stoppedOrderRef) {
                            // 在新的订单列表中找到停止的订单
                            const newStoppedIndex = newItems.findIndex(item => item === this.stoppedOrderRef);
                            if (newStoppedIndex >= 0) {
                                // 订单还在，更新索引
                                const oldStoppedIndex = this.stoppedIndex;
                                this.stoppedIndex = newStoppedIndex;
                                console.log('[OrderList] 停止序号从', oldStoppedIndex, '更新为', this.stoppedIndex, '（通过订单引用找到新位置）');
                            } else {
                                // 订单被删除了，从上一条订单继续读
                                const oldStoppedIndex = this.stoppedIndex;
                                if (oldStoppedIndex > 0) {
                                    // 从上一条订单继续
                                    this.stoppedIndex = oldStoppedIndex - 1;
                                    // 更新订单引用
                                    if (this.orderItems && this.stoppedIndex < this.orderItems.length) {
                                        this.stoppedOrderRef = this.orderItems[this.stoppedIndex];
                                    }
                                    console.log('[OrderList] 停止的订单已被删除，从上一条订单继续，停止序号从', oldStoppedIndex, '更新为', this.stoppedIndex);
                                } else {
                                    // 没有上一条订单，重置停止状态
                                    console.log('[OrderList] 停止的订单已被删除，且没有上一条订单，重置停止状态');
                                    this.stoppedIndex = -1;
                                    this.stoppedOrderRef = null;
                                }
                            }
                        } else if (this.stoppedIndex >= 0) {
                            // 如果没有保存订单引用，但 stoppedIndex 有效
                            // 如果 stoppedIndex >= 新长度，说明删除的订单在 stoppedIndex 之后，stoppedIndex 不变
                            // 如果 stoppedIndex < 新长度，需要检查当前订单是否还是原来的订单
                            // 由于无法确定，保守策略：如果 stoppedIndex >= 新长度，从上一条继续；否则保持不变
                            if (this.stoppedIndex >= newLength) {
                                // 从上一条订单继续
                                if (this.stoppedIndex > 0) {
                                    const oldStoppedIndex = this.stoppedIndex;
                                    this.stoppedIndex = oldStoppedIndex - 1;
                                    // 更新订单引用
                                    if (this.orderItems && this.stoppedIndex < this.orderItems.length) {
                                        this.stoppedOrderRef = this.orderItems[this.stoppedIndex];
                                    }
                                    console.log('[OrderList] stoppedIndex 超出范围，从上一条订单继续，停止序号从', oldStoppedIndex, '更新为', this.stoppedIndex);
                                } else {
                                    console.log('[OrderList] stoppedIndex 超出范围，且没有上一条订单，重置停止状态');
                                    this.stoppedIndex = -1;
                                    this.stoppedOrderRef = null;
                                }
                            } else {
                                // 尝试保存当前订单引用
                                if (this.orderItems && this.stoppedIndex < this.orderItems.length) {
                                    this.stoppedOrderRef = this.orderItems[this.stoppedIndex];
                                    console.log('[OrderList] 保存停止订单引用，stoppedIndex:', this.stoppedIndex);
                                }
                            }
                        }

                        // ✅ 重新生成 ttsQueue，确保队列中的文本与当前的 orderItems 一致
                        const oldQueueLength = this.ttsQueue.length;
                        const oldCurrentIndex = this.currentTTSIndex;

                        // ✅ 重要：队列必须和订单一一对应，不进行过滤，保持索引一致
                        const orderTexts = newItems
                            .map((item, index) => {
                                const text = this.formatOrderText(item, index + 1);
                                return text ? text.trim() : '';
                            });

                        this.ttsQueue = [...orderTexts];

                        // ✅ 更新 currentTTSIndex：如果之前已经播放到某个位置，需要相应调整
                        if (this.stoppedIndex >= 0) {
                            // stoppedIndex 是订单索引，currentTTSIndex 也应该是订单索引（因为队列和订单一一对应）
                            this.currentTTSIndex = this.stoppedIndex + 1;
                        } else {
                            // 如果停止状态被重置，currentTTSIndex 也应该重置
                            this.currentTTSIndex = 0;
                        }

                        console.log('[OrderList] 已重新生成 ttsQueue（删除后）:');
                        console.log('  - 旧队列长度:', oldQueueLength, '新队列长度:', this.ttsQueue.length);
                        console.log('  - 订单数量:', newItems.length);
                        console.log('  - 旧 currentTTSIndex:', oldCurrentIndex, '新 currentTTSIndex:', this.currentTTSIndex);
                        console.log('  - stoppedIndex:', this.stoppedIndex);

                        // 验证：队列长度应该等于订单数量
                        if (this.ttsQueue.length !== newItems.length) {
                            console.error('[OrderList] ⚠️ 错误：队列长度与订单数量不匹配！', {
                                queueLength: this.ttsQueue.length,
                                orderItemsLength: newItems.length
                            });
                        }

                        // 清空音频缓存，因为订单顺序已改变
                        this.clearTtsCache();

                        // ✅ 清理索引相关的本地状态，防止删除后后续订单显示错位
                        // goodsNameInputValues、selectedMatchedGoodsIndex 以 orderIndex 为 key，
                        // 删除后索引会前移，若不清理会导致「原索引 N 的值」错误显示在「新索引 N-1 的订单」上
                        this.goodsNameInputValues = {};
                        this.selectedMatchedGoodsIndex = {};
                        for (let i = newLength; i in this.orderItemRefs; i++) {
                            delete this.orderItemRefs[i];
                        }
                        if (this.keyboardSelectedOrderIndex >= newLength) {
                            this.keyboardSelectedOrderIndex = newLength > 0 ? newLength - 1 : -1;
                        }
                    }
                    // 如果订单数量增加（插入了新订单）
                    else if (newLength > actualOldLength && this.orderItems) {
                        const newItems = this.orderItems;
                        const oldLength = actualOldLength;

                        // 找到新插入的订单位置（通过比较新旧订单列表）
                        // 由于我们无法直接获取旧的订单列表，需要通过其他方式判断
                        // 简单方法：假设插入位置在 stoppedIndex 附近，或者遍历找到第一个新增的订单
                        let insertIndex = -1;

                        // 方法：如果 stoppedIndex >= 0，假设插入位置在 stoppedIndex 之前或等于 stoppedIndex
                        // 否则，需要比较订单内容来找到插入位置
                        // 由于无法获取旧列表，我们采用简化策略：重新生成整个队列

                        console.log('[OrderList] 检测到订单插入');
                        console.log('  - 旧订单数量:', oldLength, '新订单数量:', newLength);
                        console.log('  - 当前队列长度:', this.ttsQueue.length);
                        console.log('  - 当前 stoppedIndex:', this.stoppedIndex);

                        // ✅ 如果 stoppedIndex >= 0，需要通过订单引用来找到新位置
                        if (this.stoppedIndex >= 0 && this.stoppedOrderRef) {
                            // 在新的订单列表中找到停止的订单
                            const newStoppedIndex = newItems.findIndex(item => item === this.stoppedOrderRef);
                            if (newStoppedIndex >= 0) {
                                const oldStoppedIndex = this.stoppedIndex;
                                this.stoppedIndex = newStoppedIndex;
                                console.log('[OrderList] 停止序号从', oldStoppedIndex, '更新为', this.stoppedIndex, '（通过订单引用找到新位置）');
                            } else {
                                console.warn('[OrderList] 无法找到停止的订单引用，保持 stoppedIndex 不变');
                            }
                        } else if (this.stoppedIndex >= 0 && this.orderItems && this.stoppedIndex < this.orderItems.length) {
                            // 如果没有保存订单引用，尝试通过索引获取订单引用
                            this.stoppedOrderRef = this.orderItems[this.stoppedIndex];
                            console.log('[OrderList] 保存停止订单引用，stoppedIndex:', this.stoppedIndex);
                        }

                        // ✅ 无论队列是否为空，都重新生成 ttsQueue，确保队列中的文本与当前的 orderItems 一致
                        const oldQueueLength = this.ttsQueue.length;
                        const oldCurrentIndex = this.currentTTSIndex;

                        // ✅ 重要：队列必须和订单一一对应，不进行过滤，保持索引一致
                        const orderTexts = newItems
                            .map((item, index) => {
                                const text = this.formatOrderText(item, index + 1);
                                return text ? text.trim() : '';
                            });

                        this.ttsQueue = [...orderTexts];

                        // ✅ 更新 currentTTSIndex：如果之前已经播放到某个位置，需要相应调整
                        // stoppedIndex 已经更新了，currentTTSIndex 应该对应到 stoppedIndex + 1
                        if (this.stoppedIndex >= 0) {
                            // stoppedIndex 是订单索引，currentTTSIndex 也应该是订单索引（因为队列和订单一一对应）
                            this.currentTTSIndex = this.stoppedIndex + 1;
                        }

                        console.log('[OrderList] 已重新生成 ttsQueue:');
                        console.log('  - 旧队列长度:', oldQueueLength, '新队列长度:', this.ttsQueue.length);
                        console.log('  - 订单数量:', newItems.length);
                        console.log('  - 旧 currentTTSIndex:', oldCurrentIndex, '新 currentTTSIndex:', this.currentTTSIndex);
                        console.log('  - stoppedIndex:', this.stoppedIndex);
                        console.log('  - 队列前10条:', this.ttsQueue.slice(0, 10).map((t, i) => `[${i}]${t ? t.substring(0, 30) + '...' : '(空)'}`));

                        // 验证：队列长度应该等于订单数量
                        if (this.ttsQueue.length !== newItems.length) {
                            console.error('[OrderList] ⚠️ 错误：队列长度与订单数量不匹配！', {
                                queueLength: this.ttsQueue.length,
                                orderItemsLength: newItems.length
                            });
                        }

                        // 清空音频缓存，因为订单顺序已改变
                        this.clearTtsCache();
                    }

                    // 更新记录的长度
                    this.previousOrderItemsLength = newLength;
                },
                immediate: false
            },
            // 监听订单内容变化（深度监听），当订单内容更新时，重新生成队列
            orderItems: {
                handler(newItems, oldItems) {
                    // 只在有队列且订单数量没有变化时，才重新生成队列（内容更新）
                    if (this.ttsQueue.length > 0 && newItems && oldItems && newItems.length === oldItems.length) {
                        console.log('[OrderList] 检测到订单内容更新，重新生成队列');

                        // 重新生成队列
                        const orderTexts = newItems
                            .map((item, index) => {
                                const text = this.formatOrderText(item, index + 1);
                                return text ? text.trim() : '';
                            });

                        this.ttsQueue = [...orderTexts];

                        // 清空音频缓存，因为订单内容已改变
                        this.clearTtsCache();

                        console.log('[OrderList] 已重新生成 ttsQueue（内容更新）:');
                        console.log('  - 队列长度:', this.ttsQueue.length);
                        console.log('  - 订单数量:', newItems.length);
                        console.log('  - stoppedIndex:', this.stoppedIndex);
                        console.log('  - currentTTSIndex:', this.currentTTSIndex);

                        // 若处于朗读暂停状态，且停止处的订单已不再是 -2（如选择商品后），自动继续朗读
                        // 注意：selectSearchResult 等会显式调用 continueReading，此处延迟 300ms 以避免重复调用导致 play 被新 load 中断
                        if (this.stoppedIndex >= 0 && this.stoppedIndex < newItems.length) {
                            const stoppedOrder = newItems[this.stoppedIndex];
                            if (stoppedOrder && stoppedOrder.nxDoStatus !== -2) {
                                console.log('[OrderList] 停止处订单已更新为非 -2，将自动继续朗读');
                                this.$nextTick(() => {
                                    setTimeout(() => {
                                        if (this.continueReading) this.continueReading();
                                    }, 300);
                                });
                            }
                        }
                    }

                    // 同步商品名称：当外部更新商品名称时，清空对应的本地值
                    if (newItems && oldItems && newItems.length === oldItems.length) {
                        newItems.forEach((item, index) => {
                            const oldItem = oldItems[index];
                            if (oldItem && item.nxDoGoodsName !== oldItem.nxDoGoodsName) {
                                // 如果商品名称从外部更新了，清空本地值，使用新的外部值
                                if (index in this.goodsNameInputValues) {
                                    delete this.goodsNameInputValues[index];
                                }
                            }
                        });
                    }
                },
                deep: true, // 深度监听订单内容变化
                immediate: false
            },
            // 同步 TTS 状态给父组件（供 ImageUpload 播放按钮显示）
            isTTSPlaying() {
                this._emitTTSState();
            },
            isTTSLoading() {
                this._emitTTSState();
            },
            stoppedIndex() {
                this._emitTTSState();
            },
            // 监听"在之前添加新订单"的添加索引变化，自动聚焦到商品名称输入框
            addingOrderBeforeIndex(val) {
                console.log('🎯 [OrderList watch] addingOrderBeforeIndex 变化:', val);
                if (val !== null && val >= 0) {
                    // 使用双重 nextTick 确保 DOM 完全渲染后再聚焦
                    this.$nextTick(() => {
                        this.$nextTick(() => this.focusBeforeOrderInput('before-order-goods-name', val));
                    });
                }
            },
            // 监听"在之前添加新订单"的商品选择变化，自动聚焦到数量输入框
            'beforeOrderForm.selectedGoods'(val) {
                console.log('🎯 [OrderList watch] beforeOrderForm.selectedGoods 变化:', val);
                console.log('📍 [OrderList watch] addingOrderBeforeIndex:', this.addingOrderBeforeIndex);
                if (val && this.addingOrderBeforeIndex >= 0) {
                    console.log('✅ [OrderList watch] 准备聚焦到数量输入框');
                    this.$nextTick(() => this.focusBeforeOrderInput('before-order-quantity', this.addingOrderBeforeIndex));
                }
            }
        },
        computed: {
            // 当前朗读的订单文本（供外部组件使用）
            currentReadingText() {
                return this.getCurrentReadingText();
            },
            // 当前朗读的订单索引（供外部组件使用）
            currentReadingIndex() {
                // currentTTSIndex 是下一个要播放的，所以当前播放的是 currentTTSIndex - 1
                return this.currentTTSIndex > 0 ? this.currentTTSIndex - 1 : -1;
            }
        },
        mounted() {
            // 创建全局唯一的 audio 实例
            this.ttsAudio = new Audio();
            this.ttsAudio.preload = 'auto';

            // 初始化订单列表长度记录
            this.previousOrderItemsLength = this.orderItems ? this.orderItems.length : 0;

            // 朗读状态下全局快捷键（焦点在 OrderList 外时仍生效）
            this._handleReadingKeydownGlobal = (e) => {
                const inContainer = this.$refs.scrollContainer && this.$refs.scrollContainer.contains(e.target);
                const isReadingState = this.isTTSPlaying || this.isTTSLoading || this.stoppedIndex >= 0;
                const isShortcutKey = e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter';
                if (isShortcutKey) {
                    console.log('[OrderList] document keydown key=', e.key, 'inContainer=', inContainer, 'isReadingState=', isReadingState);
                }
                // 如果焦点在"在之前添加新订单"的输入框中，不处理全局快捷键
                const target = e.target;
                const isInBeforeOrderInput = target && (
                    target.getAttribute('data-input-type')?.startsWith('before-order') ||
                    target.closest('[data-input-type^="before-order"]')
                );
                if (isInBeforeOrderInput) {
                    console.log('[OrderList] 焦点在"在之前添加新订单"输入框中，跳过全局处理');
                    return;
                }
                if (inContainer) return;
                if (!isShortcutKey) return;
                // 空格：仅朗读状态下处理
                if (e.key === ' ' && !isReadingState) return;
                const isSearchVisible = this.orderArrIndex != null && this.orderArrIndex >= 0 && this.orderItems && this.orderArrIndex < this.orderItems.length
                    && ((this.strArr?.length || 0) + (this.nxArr?.length || 0)) > 0;
                const searchTotal = (this.strArr?.length || 0) + (this.nxArr?.length || 0);
                const isNxGoodsVisible = !isSearchVisible && this.orderArrIndex != null && this.orderArrIndex >= 0 && this.orderItems && this.orderArrIndex < this.orderItems.length
                    && this.showMatchedGoods?.[this.orderArrIndex]
                    && (this.strArr?.length || 0) === 0 && (this.nxArr?.length || 0) === 0
                    && (this.orderItems[this.orderArrIndex]?.nxGoodsEntities?.length || 0) > 0;
                const nxGoodsTotal = isNxGoodsVisible ? (this.orderItems[this.orderArrIndex]?.nxGoodsEntities?.length || 0) : 0;
                let hasMatchedGoods = false;
                let matchedOrderIndex = -1;
                if (!isSearchVisible && this.showMatchedGoods && this.orderItems) {
                    for (let i = 0; i < this.orderItems.length; i++) {
                        const list = this.orderItems[i]?.nxDistributerGoodsEntityList;
                        if (list?.length > 0 && this.showMatchedGoods[i]
                            && !(this.orderArrIndex === i && (this.strArr?.length > 0 || this.nxArr?.length > 0))) {
                            hasMatchedGoods = true;
                            matchedOrderIndex = i;
                            break;
                        }
                    }
                }
                // 焦点在容器外时，搜索/匹配列表的上下键和回车由 document 处理（blur 后焦点在 body，scrollContainer 收不到 keydown）
                if (isSearchVisible && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter')) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.key === 'ArrowDown') {
                        this.selectedSearchResultIndex = Math.min(this.selectedSearchResultIndex + 1, searchTotal - 1);
                        this.scrollSearchResultIntoView();
                    } else if (e.key === 'ArrowUp') {
                        if (this.selectedSearchResultIndex <= 0) {
                            // 在最上一个时再按向上键，关闭搜索并聚焦商品名称输入框
                            this.$emit('close-str');
                            const orderIndex = this.orderArrIndex;
                            if (orderIndex != null && this.orderItems && orderIndex < this.orderItems.length) {
                                this.$nextTick(() => this.focusStoppedOrderInput(orderIndex, this.orderItems[orderIndex]));
                            }
                        } else {
                            this.selectedSearchResultIndex = Math.max(this.selectedSearchResultIndex - 1, 0);
                            this.scrollSearchResultIntoView();
                        }
                    } else if (e.key === 'Enter') {
                        this.confirmSearchResultSelection();
                    }
                    return;
                }
                const bothVisibleForOrder = hasMatchedGoods && matchedOrderIndex >= 0 && isNxGoodsVisible && matchedOrderIndex === this.orderArrIndex;
                if (bothVisibleForOrder && this.selectedNxGoodsIndex >= 0 && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const orderIndex = this.orderArrIndex;
                    const item = this.orderItems[orderIndex];
                    const list = item?.nxGoodsEntities || [];
                    const matchedList = item?.nxDistributerGoodsEntityList || [];
                    const matchedMaxIdx = matchedList.length - 1;
                    const bothVisible = matchedList.length > 0 && this.showMatchedGoods?.[orderIndex];
                    if (e.key === 'ArrowDown') {
                        this.selectedNxGoodsIndex = Math.min(this.selectedNxGoodsIndex + 1, nxGoodsTotal - 1);
                        this.scrollNxGoodsIntoView();
                    } else if (e.key === 'ArrowUp') {
                        if (this.selectedNxGoodsIndex <= 0) {
                            if (bothVisible) {
                                this.selectedMatchedGoodsIndex = {...this.selectedMatchedGoodsIndex, [orderIndex]: matchedMaxIdx};
                                this.selectedNxGoodsIndex = -1;
                                this.scrollMatchedGoodsIntoView(orderIndex);
                            } else {
                                this.$emit('close-str');
                                if (orderIndex != null && this.orderItems && orderIndex < this.orderItems.length) {
                                    this.$nextTick(() => this.focusStoppedOrderInput(orderIndex, this.orderItems[orderIndex]));
                                }
                            }
                        } else {
                            this.selectedNxGoodsIndex = Math.max(this.selectedNxGoodsIndex - 1, 0);
                            this.scrollNxGoodsIntoView();
                        }
                    } else if (e.key === 'Enter') {
                        const goods = list[this.selectedNxGoodsIndex];
                        if (goods) this.$emit('download-goods-nx', { goods, orderIndex });
                    }
                    return;
                }
                if (hasMatchedGoods && matchedOrderIndex >= 0 && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter')) {
                    const item = this.orderItems[matchedOrderIndex];
                    const list = item?.nxDistributerGoodsEntityList || [];
                    const maxIdx = list.length - 1;
                    const curIdx = this.selectedMatchedGoodsIndex[matchedOrderIndex] ?? 0;
                    const bothVisible = isNxGoodsVisible && matchedOrderIndex === this.orderArrIndex;
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.key === 'ArrowDown') {
                        if (bothVisible && curIdx === maxIdx) {
                            this.selectedNxGoodsIndex = 0;
                            this.scrollNxGoodsIntoView();
                        } else {
                            this.selectedMatchedGoodsIndex = {
                                ...this.selectedMatchedGoodsIndex,
                                [matchedOrderIndex]: Math.min(curIdx + 1, maxIdx)
                            };
                            this.scrollMatchedGoodsIntoView(matchedOrderIndex);
                        }
                    } else if (e.key === 'ArrowUp') {
                        if (curIdx <= 0) {
                            this.$emit('toggle-matched-goods', matchedOrderIndex);
                        } else {
                            this.selectedMatchedGoodsIndex = {
                                ...this.selectedMatchedGoodsIndex,
                                [matchedOrderIndex]: curIdx - 1
                            };
                            this.scrollMatchedGoodsIntoView(matchedOrderIndex);
                        }
                    } else if (e.key === 'Enter') {
                        this.$emit('select-matched-goods', {item, orderIndex: matchedOrderIndex, goodsIndex: curIdx});
                    }
                    return;
                }
                if (isNxGoodsVisible && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const orderIndex = this.orderArrIndex;
                    const item = this.orderItems[orderIndex];
                    const list = item?.nxGoodsEntities || [];
                    if (e.key === 'ArrowDown') {
                        this.selectedNxGoodsIndex = Math.min(this.selectedNxGoodsIndex + 1, nxGoodsTotal - 1);
                        this.scrollNxGoodsIntoView();
                    } else if (e.key === 'ArrowUp') {
                        if (this.selectedNxGoodsIndex <= 0) {
                            this.$emit('close-str');
                            if (orderIndex != null && this.orderItems && orderIndex < this.orderItems.length) {
                                this.$nextTick(() => this.focusStoppedOrderInput(orderIndex, this.orderItems[orderIndex]));
                            }
                        } else {
                            this.selectedNxGoodsIndex = Math.max(this.selectedNxGoodsIndex - 1, 0);
                            this.scrollNxGoodsIntoView();
                        }
                    } else if (e.key === 'Enter') {
                        const goods = list[this.selectedNxGoodsIndex];
                        if (goods) this.$emit('download-goods-nx', { goods, orderIndex });
                    }
                    return;
                }
                // 上下键/空格：用于选择订单或朗读控制
                const handled = this._handleReadingShortcuts(e.key);
                if (handled) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('[OrderList] document 已处理快捷键 key=', e.key);
                }
            };
            document.addEventListener('keydown', this._handleReadingKeydownGlobal, true);

            // 更新 TTS 播放器高度（等待 DOM 渲染完成）
            this.$nextTick(() => {
                this.updateTtsPlayerHeight();
            });
            this._emitTTSState();

            // 语音监听集中由服务管理，并在组件卸载时成组释放。
            if (isVoiceRuntimeAvailable()) {
                this.voiceListenerCleanups = subscribeVoiceEvents({
                    onRecognitionResult: (result) => {
                        console.log('[OrderList] 收到识别结果:', result);
                        this.recognitionResult = result;
                    },
                    onRecognitionError: (error) => {
                        console.error('[OrderList] 识别错误:', error);
                        this.recognitionResult = {error};
                    },
                    onTtsResult: (result) => {
                        console.log('[OrderList] 收到TTS结果（预取）:', result);
                    },
                    onTtsError: (error) => {
                        const errMsg = (error && error.error) ? String(error.error) : '';
                        if (errMsg.includes('stream has been aborted') || errMsg.includes('aborted')) {
                            console.warn('[OrderList] TTS 请求中断（将重试）:', errMsg);
                            return;
                        }
                        console.error('[OrderList] TTS错误:', error);
                        this.isTTSLoading = false;
                        this.ttsError = errMsg || 'TTS合成失败';
                    }
                });
            }
        },
        updated() {
            // 更新 TTS 播放器高度（当内容变化时）
            this.updateTtsPlayerHeight();
        },
        beforeUnmount() {
            document.removeEventListener('keydown', this._handleReadingKeydownGlobal, true);
            // PCM 模式下，音频在主进程录制，不需要清理渲染进程资源
            // 如果正在录音，请求主进程停止
            if (this.isRecording && isVoiceRuntimeAvailable()) {
                stopVoiceRecognition().catch(err => {
                    console.error('[OrderList] 清理时停止录音失败:', err);
                });
            }
            disposeVoiceSubscriptions(this.voiceListenerCleanups);
            this.voiceListenerCleanups = [];

            // 清理 TTS 播放
            if (this.ttsAudio) {
                this.ttsAudio.pause();
                this.ttsAudio.src = '';
            }
            if (this.ttsAudioUrl) {
                URL.revokeObjectURL(this.ttsAudioUrl);
                this.ttsAudioUrl = null;
            }
        },
        methods: {
            // 显示 Toast 提示
            showToast(message, type = 'info', duration = 3000) {
                this.toastMessage = message;
                this.toastType = type;
                this.toastDuration = duration;
                this.toastVisible = true;
            },

            _emitTTSState() {
                this.$emit('tts-state', {
                    isTTSPlaying: this.isTTSPlaying,
                    isTTSLoading: this.isTTSLoading,
                    stoppedIndex: this.stoppedIndex
                });
            },
            // 处理商品名称输入框键盘事件（用于"在之前添加新订单"表单）
            handleBeforeOrderGoodsNameKeydown(event) {
                // 中文输入法组字时，↑↓ 用于选候选字
                if (event.isComposing) return;

                const form = this.beforeOrderForm;
                if (event.key === 'Enter') {
                    event.preventDefault();
                    const currentInputValue = event.target.value;
                    console.log('🔑 [handleBeforeOrderGoodsNameKeydown] ========== 按下回车 ==========');
                    console.log('🔑 [handleBeforeOrderGoodsNameKeydown] 当前输入值:', `"${currentInputValue}"`);
                    console.log('🔑 [handleBeforeOrderGoodsNameKeydown] showSearchResults:', form.showSearchResults);
                    console.log('🔑 [handleBeforeOrderGoodsNameKeydown] lastSearchStr:', `"${form.lastSearchStr || 'null'}"`);
                    console.log('🔑 [handleBeforeOrderGoodsNameKeydown] disArr.length:', form.disArr?.length || 0);
                    console.log('🔑 [handleBeforeOrderGoodsNameKeydown] nxArr.length:', form.nxArr?.length || 0);
                    
                    // 判断是否满足选择商品的条件
                    const hasSearchResults = form.showSearchResults && (form.disArr?.length > 0 || form.nxArr?.length > 0);
                    const inputValueMatch = currentInputValue === form.lastSearchStr;
                    
                    console.log('🔑 [handleBeforeOrderGoodsNameKeydown] 有搜索结果:', hasSearchResults);
                    console.log('🔑 [handleBeforeOrderGoodsNameKeydown] 输入值与上次搜索一致:', inputValueMatch);
                    
                    // 如果搜索结果已显示且有结果,且当前输入值和上次搜索的值一致,选择当前选中的商品
                    if (hasSearchResults && inputValueMatch) {
                        console.log('✅ [handleBeforeOrderGoodsNameKeydown] 条件满足,选择商品');
                        const idx = form.selectedSearchIndex ?? 0;
                        const disLen = form.disArr?.length || 0;
                        if (idx < disLen) {
                            this.$emit('select-before-order-goods', form.disArr[idx]);
                            return;
                        }
                        if (idx < disLen + (form.nxArr?.length || 0)) {
                            this.$emit('download-goods-nx', { goods: form.nxArr[idx - disLen], orderIndex: this.addingOrderBeforeIndex });
                            return;
                        }
                    }
                    // 否则触发搜索
                    const goodsName = currentInputValue;
                    if (!goodsName || !goodsName.trim()) {
                        console.log('⚠️ [handleBeforeOrderGoodsNameKeydown] 商品名称为空，不触发搜索');
                        return;
                    }
                    console.log('🔍 [handleBeforeOrderGoodsNameKeydown] 条件不满足,触发新搜索');
                    console.log('📤 [handleBeforeOrderGoodsNameKeydown] 准备 emit before-order-goods-name-enter，值:', goodsName);
                    this.$emit('before-order-goods-name-enter', { type: 'search', searchStr: goodsName });
                } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                    // 如果搜索结果已显示且有结果，上下键选择商品
                    if (form.showSearchResults && (form.disArr?.length > 0 || form.nxArr?.length > 0)) {
                        console.log('⬇️ [handleBeforeOrderGoodsNameKeydown] 按下:', event.key, 'selectedSearchIndex:', form.selectedSearchIndex, 'total:', (form.disArr?.length || 0) + (form.nxArr?.length || 0));
                        event.preventDefault();
                        event.stopPropagation();
                        const total = (form.disArr?.length || 0) + (form.nxArr?.length || 0);
                        if (event.key === 'ArrowDown') {
                            form.selectedSearchIndex = (form.selectedSearchIndex + 1) % total;
                        } else if (event.key === 'ArrowUp') {
                            form.selectedSearchIndex = form.selectedSearchIndex <= 0 ? total - 1 : form.selectedSearchIndex - 1;
                        }
                        console.log('⬆️ [handleBeforeOrderGoodsNameKeydown] 更新后 selectedSearchIndex:', form.selectedSearchIndex);
                        this.$nextTick(() => this.scrollBeforeOrderSearchIntoView());
                    }
                }
            },
            // 处理"在之前添加新订单"的商品名称输入事件
            onBeforeOrderGoodsNameInput(event) {
                const value = event.target.value;
                const form = this.beforeOrderForm;
                console.log('📝 [onBeforeOrderGoodsNameInput] 输入值:', value, '旧值:', form.goodsName, 'showSearchResults:', form.showSearchResults);
                form.goodsName = value;
                // 隐藏之前的搜索结果，这样用户修改输入后按回车会触发新搜索而不是选择旧商品
                if (form.showSearchResults) {
                    form.showSearchResults = false;
                    form.searchResults = []; // 清空搜索结果
                    form.disArr = [];
                    form.nxArr = [];
                    form.selectedSearchIndex = 0;
                    form.lastSearchStr = null;
                    form.selectedGoods = null; // 清空已选择的商品
                    console.log('🔄 [onBeforeOrderGoodsNameInput] 输入改变，重置所有搜索相关状态');
                } else {
                    console.log('ℹ️ [onBeforeOrderGoodsNameInput] 搜索结果未显示,无需隐藏');
                }
            },
            // 插入订单表单：是否可保存（与 ManualEntryUpload.vue 的 canAddBeforeOrder 逻辑一致）
            canAddBeforeOrder(form) {
                if (!form.goodsName || !String(form.goodsName).trim()) return false;
                if (form.selectedGoods) {
                    return !!(form.quantity && String(form.quantity).trim() && form.standard && String(form.standard).trim());
                }
                return true;
            },
            // 滚动搜索结果到可视区域
            scrollBeforeOrderSearchIntoView() {
                const container = this.$refs.scrollContainer;
                if (!container || !this.beforeOrderForm) return;
                const dropdown = container.querySelector('[data-input-type="before-order-goods-name"]')?.parentElement.querySelector('.border.rounded.mt-1.bg-white.shadow-lg');
                if (!dropdown) {
                    console.log('⚠️ [scrollBeforeOrderSearchIntoView] 未找到下拉容器');
                    return;
                }
                const idx = this.beforeOrderForm.selectedSearchIndex ?? 0;
                const el = dropdown.querySelector(`[data-search-index="${idx}"]`);
                if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            },
            // 处理"在之前添加新订单"的数量输入框回车 - 跳转到规格输入框
            onBeforeOrderQuantityEnter(e, item, orderIndex) {
                if (e.isComposing) return;
                e.preventDefault();
                this.focusBeforeOrderInput('before-order-standard', orderIndex);
            },
            // 处理"在之前添加新订单"的规格输入框回车 - 保存订单
            onBeforeOrderStandardEnter(e, item, orderIndex) {
                if (e.isComposing) return;
                e.preventDefault();
                const form = this.beforeOrderForm;
                if (form.selectedGoods && form.quantity && form.standard) {
                    this.$emit('save-before-order', { item, orderIndex });
                }
            },
            // 处理"在之前添加新订单"的 Tab 键跳转
            onBeforeOrderTab(e, inputType, orderIndex) {
                const types = ['before-order-goods-name', 'before-order-quantity', 'before-order-standard'];
                const idx = types.indexOf(inputType);
                const direction = e.shiftKey ? -1 : 1;
                const nextIdx = idx + direction;
                if (nextIdx >= 0 && nextIdx < 3) {
                    e.preventDefault();
                    this.focusBeforeOrderInput(types[nextIdx], orderIndex);
                }
            },
            // 聚焦到"在之前添加新订单"的指定输入框
            focusBeforeOrderInput(inputType, orderIndex) {
                console.log('🎯 [focusBeforeOrderInput] 准备聚焦:', { inputType, orderIndex });
                this.$nextTick(() => {
                    const container = this.$refs.scrollContainer;
                    console.log('📦 [focusBeforeOrderInput] container:', container);
                    if (!container) {
                        console.log('⚠️ [focusBeforeOrderInput] container 为空');
                        return;
                    }
                    // 查找对应订单行的输入框
                    const orderItem = container.querySelector(`[data-order-index="${orderIndex}"]`);
                    console.log('📦 [focusBeforeOrderInput] orderItem:', orderItem);
                    if (!orderItem) {
                        console.log('⚠️ [focusBeforeOrderInput] 找不到订单行:', orderIndex);
                        // 列出所有订单行进行调试
                        const allOrderItems = container.querySelectorAll('[data-order-index]');
                        console.log('🔍 [focusBeforeOrderInput] 所有订单行:', Array.from(allOrderItems).map(el => el.getAttribute('data-order-index')));
                        return;
                    }
                    const el = orderItem.querySelector(`[data-input-type="${inputType}"]`);
                    console.log('📦 [focusBeforeOrderInput] input element:', el);
                    if (el) {
                        el.focus();
                        console.log('✅ [focusBeforeOrderInput] 已聚焦到输入框:', inputType);
                    } else {
                        console.log('⚠️ [focusBeforeOrderInput] 找不到输入框:', { inputType, orderIndex });
                        // 列出订单行中所有输入框进行调试
                        const allInputs = orderItem.querySelectorAll('[data-input-type]');
                        console.log('🔍 [focusBeforeOrderInput] 订单行中所有输入框:', Array.from(allInputs).map(el => el.getAttribute('data-input-type')));
                    }
                });
            },

            // 获取商品名称输入框的值（优先使用本地值，否则使用 item 的值）
            getGoodsNameValue(item, orderIndex) {
                if (this.goodsNameInputValues.hasOwnProperty(orderIndex)) {
                    return this.goodsNameInputValues[orderIndex];
                }
                return item.nxDoGoodsName || '';
            },

            // 处理商品名称输入（只更新本地值，不触发查询）
            handleGoodsNameInput(event, item, orderIndex) {
                const value = event.target.value;
                // 开始输入时关闭推荐商品列表，键盘不再作用于推荐商品
                if (this.showMatchedGoods?.[orderIndex]) {
                    this.$emit('toggle-matched-goods', orderIndex);
                }
                // 只更新本地值，不触发查询（Vue 3 直接赋值即可）
                this.goodsNameInputValues[orderIndex] = value;
            },

            // 处理商品名称获得焦点
            handleGoodsNameFocus(item, orderIndex) {
                // 输入框获焦时取消订单选中状态及推荐商品选中索引，避免回车与输入框的回车冲突
                this.keyboardSelectedOrderIndex = -1;
                this.selectedSearchResultIndex = -1;
                this.selectedNxGoodsIndex = -1;
                const skipClose = this._skipCloseMatchedGoodsOnNextFocus;
                // 朗读停止后自动聚焦时（skipClose）不删除选中索引，保留推荐商品第一条的选中状态
                if (!skipClose && this.showMatchedGoods?.[orderIndex]) {
                    delete this.selectedMatchedGoodsIndex[orderIndex];
                }
                this._skipCloseMatchedGoodsOnNextFocus = false;
                // 用 nextTick 延迟收起，避免 DOM 更新导致焦点丢失
                this.$nextTick(() => {
                    const needCloseSearch = this.orderArrIndex === orderIndex && ((this.strArr?.length || 0) + (this.nxArr?.length || 0)) > 0;
                    if (!skipClose && this.showMatchedGoods?.[orderIndex]) {
                        this.$emit('toggle-matched-goods', orderIndex);
                    }
                    if (needCloseSearch) {
                        this.$emit('close-str');
                        // 关闭搜索后 DOM 会更新，延迟聚焦确保输入框能正确获得焦点
                        setTimeout(() => {
                            const el = this.orderItemRefs?.[orderIndex]?.querySelector?.('[data-order-input="goods-name"]');
                            if (el && document.activeElement !== el) el.focus();
                        }, 50);
                    } else {
                        this.$nextTick(() => {
                            const el = this.orderItemRefs?.[orderIndex]?.querySelector?.('[data-order-input="goods-name"]');
                            if (el && document.activeElement !== el) el.focus();
                        });
                    }
                });
                if (!(orderIndex in this.goodsNameInputValues)) {
                    this.goodsNameInputValues[orderIndex] = item.nxDoGoodsName || '';
                }
                this.$emit('goods-name-focus', {item, orderIndex});
            },

            // 数量/规格输入框获焦时，自动收起匹配商品和搜索下拉
            handleQuantityOrStandardFocus(orderIndex) {
                this.keyboardSelectedOrderIndex = -1;
                this.selectedSearchResultIndex = -1;
                this.selectedNxGoodsIndex = -1;
                if (this.showMatchedGoods?.[orderIndex]) {
                    delete this.selectedMatchedGoodsIndex[orderIndex];
                }
                this.$nextTick(() => {
                    if (this.showMatchedGoods?.[orderIndex]) {
                        this.$emit('toggle-matched-goods', orderIndex);
                    }
                    const hasSearchOrNxGoods = this.orderArrIndex === orderIndex && (
                        ((this.strArr?.length || 0) + (this.nxArr?.length || 0)) > 0
                        || (this.orderItems?.[orderIndex]?.nxGoodsEntities?.length || 0) > 0
                    );
                    if (hasSearchOrNxGoods) {
                        this.$emit('close-str');
                    }
                });
            },

            // 数量输入框回车：规格有内容则展开推荐商品，否则聚焦规格
            handleQuantityEnter(event, item, orderIndex) {
                event.preventDefault();
                event.stopPropagation();
                // 确保数量值同步到父组件（回车时 input 可能尚未完成更新）
                const quantityInput = event.target;
                if (quantityInput && quantityInput.value !== undefined) {
                    this.$emit('quantity-input', { item, orderIndex, value: quantityInput.value });
                }
                const standard = item.nxDoStandard;
                const hasStandard = standard != null && standard !== '' && String(standard).trim() !== '';
                if (hasStandard) {
                    // 规格有内容：展开推荐商品（若有），并失去数量焦点以便回车能选中推荐商品
                    if (item.nxDistributerGoodsEntityList && item.nxDistributerGoodsEntityList.length > 0) {
                        this.handleToggleMatchedGoods(orderIndex);
                        if (event.target && event.target.blur) event.target.blur();
                    }
                } else {
                    // 规格无内容：聚焦到规格输入框
                    this.$nextTick(() => {
                        const el = this.orderItemRefs?.[orderIndex]?.querySelector?.('[data-order-input="standard"]');
                        if (el && !el.disabled) el.focus();
                    });
                }
            },

            // 规格输入框回车：数量有值则展开推荐商品，否则聚焦数量
            handleStandardEnter(event, item, orderIndex) {
                event.preventDefault();
                event.stopPropagation();
                // 确保规格值同步到父组件（回车时 input 可能尚未完成更新）
                const standardInput = event.target;
                if (standardInput && standardInput.value !== undefined) {
                    this.$emit('standard-change', { item, orderIndex, value: standardInput.value });
                }
                const quantity = item.nxDoQuantity;
                const hasQuantity = quantity != null && quantity !== '' && !isNaN(Number(quantity));
                if (hasQuantity) {
                    // 数量有值：展开推荐商品（若有），并失去规格焦点以便回车能选中推荐商品
                    if (item.nxDistributerGoodsEntityList && item.nxDistributerGoodsEntityList.length > 0) {
                        this.handleToggleMatchedGoods(orderIndex);
                        if (event.target && event.target.blur) event.target.blur();
                    }
                } else {
                    // 数量无值：聚焦到数量输入框
                    this.$nextTick(() => {
                        const el = this.orderItemRefs?.[orderIndex]?.querySelector?.('[data-order-input="quantity"]');
                        if (el && !el.disabled) el.focus();
                    });
                }
            },

            // Tab 顺序切换：商品名 → 数量 → 规格（跨订单循环）
            handleTabKey(e, orderIndex, inputType) {
                const len = this.orderItems?.length || 0;
                if (len === 0) return;
                const inputs = ['goods-name', 'quantity', 'standard'];
                const idx = inputs.indexOf(inputType);
                if (idx < 0) return;
                const direction = e.shiftKey ? -1 : 1;
                let nextOrderIndex = orderIndex;
                let nextIdx = idx + direction;
                if (nextIdx >= 3) {
                    nextIdx = 0;
                    nextOrderIndex = (orderIndex + 1) % len;
                } else if (nextIdx < 0) {
                    nextIdx = 2;
                    nextOrderIndex = orderIndex - 1;
                    if (nextOrderIndex < 0) nextOrderIndex = len - 1;
                }
                const nextType = inputs[nextIdx];
                const nextEl = this.orderItemRefs?.[nextOrderIndex]?.querySelector?.(`[data-order-input="${nextType}"]`);
                if (nextEl && !nextEl.disabled) {
                    e.preventDefault();
                    this.$nextTick(() => nextEl.focus());
                }
            },

            // 处理商品名称回车键（同步值并触发查询）
            handleGoodsNameEnter(event, item, orderIndex) {
                event.preventDefault();
                // 搜索下拉框、推荐系统商品或推荐商品已显示时，回车交给 handleGoodsListKeydown 用于选中，不触发搜索
                // 必须同时检查 showMatchedGoods：输入框获焦后列表会收起，此时回车应触发搜索而非选中
                const hasSearchResults = this.orderArrIndex === orderIndex && ((this.strArr?.length || 0) + (this.nxArr?.length || 0)) > 0;
                const hasNxGoodsEntities = this.orderArrIndex === orderIndex && this.showMatchedGoods?.[orderIndex]
                    && (this.strArr?.length || 0) === 0 && (this.nxArr?.length || 0) === 0 && (item?.nxGoodsEntities?.length || 0) > 0;
                const hasMatchedGoods = this.showMatchedGoods?.[orderIndex] && item?.nxDistributerGoodsEntityList?.length > 0
                    && !(this.orderArrIndex === orderIndex && (this.strArr?.length > 0 || this.nxArr?.length > 0));
                if (hasSearchResults || hasNxGoodsEntities || hasMatchedGoods) {
                    return; // 让 handleGoodsListKeydown 处理回车（选中）
                }
                const value = event.target.value;
                // 先同步值到 item.nxDoGoodsName,这样父组件的 handleGoodsNameInput 才能获取到最新值
                item.nxDoGoodsName = value;
                this.$emit('goods-name-input', {item, orderIndex, value: value});
                delete this.goodsNameInputValues[orderIndex];
                this.$nextTick(() => this.scrollToOrderItem(orderIndex));
            },

            // 处理订单操作（如果正在朗读，先停止朗读）
            handleOrderAction(action, orderIndex) {
                // 如果正在朗读，先停止朗读并设置停止序号
                this.stopReadingAtOrder(orderIndex);
                // 执行原操作
                action();
            },

            // 朗读状态快捷键：空格停止；上下键关闭朗读并切换选中订单（供 handleGoodsListKeydown 和 document 监听复用）
            // 上下键在非朗读状态下也可用于切换选中订单
            _handleReadingShortcuts(key) {
                console.log('[OrderList] _handleReadingShortcuts key=', key, 'orderItemsLen=', this.orderItems?.length, 'isTTSPlaying=', this.isTTSPlaying, 'isTTSLoading=', this.isTTSLoading, 'stoppedIndex=', this.stoppedIndex, 'keyboardSelectedOrderIndex=', this.keyboardSelectedOrderIndex);
                if (!this.orderItems || this.orderItems.length === 0) return false;
                if (key === ' ') {
                    const isReadingState = this.isTTSPlaying || this.isTTSLoading || this.stoppedIndex >= 0;
                    if (this.isTTSPlaying || this.isTTSLoading) {
                        // 正在朗读：停止并保留位置，便于再次空格继续
                        const stoppedAt = this.currentTTSIndex > 0 ? this.currentTTSIndex - 1 : 0;
                        console.log('[OrderList] 快捷键: 空格 -> 停止朗读，保留位置 stoppedAt=', stoppedAt);
                        this.stopReadingAtOrder(stoppedAt);
                        this.keyboardSelectedOrderIndex = stoppedAt;
                        this.scrollToOrderItem(stoppedAt);
                        this.$nextTick(() => this.focusStoppedOrderInput(stoppedAt, this.orderItems[stoppedAt]));
                    } else if (this.stoppedIndex >= 0) {
                        // 已暂停：再次空格则继续朗读
                        console.log('[OrderList] 快捷键: 空格 -> 继续朗读');
                        this.continueReading();
                    } else {
                        return false;
                    }
                    return true;
                }
                if (key === 'ArrowUp' || key === 'ArrowDown') {
                    const isReadingState = this.isTTSPlaying || this.isTTSLoading || this.stoppedIndex >= 0;
                    const currentIndex = isReadingState
                        ? (this.isTTSPlaying || this.isTTSLoading
                            ? (this.currentTTSIndex > 0 ? this.currentTTSIndex - 1 : 0)
                            : (this.stoppedIndex >= 0 ? this.stoppedIndex : 0))
                        : (this.keyboardSelectedOrderIndex >= 0 ? this.keyboardSelectedOrderIndex : 0);
                    const newIndex = key === 'ArrowUp'
                        ? Math.max(0, currentIndex - 1)
                        : Math.min(this.orderItems.length - 1, currentIndex + 1);
                    console.log('[OrderList] 快捷键: 上下键 currentIndex=', currentIndex, 'newIndex=', newIndex, 'isReadingState=', isReadingState);
                    this.keyboardSelectedOrderIndex = newIndex;
                    if (isReadingState) {
                        if (this.ttsAudio) {
                            this.ttsAudio.pause();
                            this.ttsAudio.src = '';
                            this.ttsAudio.onended = null;
                            this.ttsAudio.onerror = null;
                            this.ttsAudio.onplay = null;
                        }
                        this.isTTSPlaying = false;
                        this.isTTSLoading = false;
                        this.stoppedIndex = -1;
                        this.stoppedOrderRef = null;
                        this.ttsQueue = [];
                        this.currentTTSIndex = 0;
                        this.ttsAudioUrl = null;
                        this.ttsError = null;
                        this.clearTtsCache();
                    }
                    this.scrollToOrderItem(newIndex);
                    // 选中订单后不立刻聚焦：只有向上键到最上面一个订单(index 0)时才聚焦；鼠标点击输入框自然聚焦
                    if (key === 'ArrowUp' && newIndex === 0) {
                        this.$nextTick(() => this.focusStoppedOrderInput(newIndex, this.orderItems[newIndex]));
                    }
                    return true;
                }
                return false;
            },

            // 商品列表快捷键：上下键选择、回车确认（匹配商品 + 搜索下拉）
            // 朗读状态下：空格停止朗读；上下键关闭朗读并切换选中订单
            // 搜索下拉或推荐商品展开时，上下键用于列表内导航，不用于选择订单
            handleGoodsListKeydown(e) {
                const isSearchVisible = this.orderArrIndex != null && this.orderArrIndex >= 0 && this.orderItems && this.orderArrIndex < this.orderItems.length
                    && ((this.strArr?.length || 0) + (this.nxArr?.length || 0)) > 0;
                const searchTotal = (this.strArr?.length || 0) + (this.nxArr?.length || 0);

                const isFromGoodsNameInput = e.target?.closest?.('[data-order-input="goods-name"]') || e.target?.getAttribute?.('data-order-input') === 'goods-name';
                const isFromOrderInput = e.target?.closest?.('[data-order-input]') || e.target?.getAttribute?.('data-order-input');

                let matchedOrderIndex = -1;
                if (!isSearchVisible && this.showMatchedGoods && this.orderItems) {
                    for (let i = 0; i < this.orderItems.length; i++) {
                        const list = this.orderItems[i]?.nxDistributerGoodsEntityList;
                        if (list?.length > 0 && this.showMatchedGoods[i]
                            && !(this.orderArrIndex === i && (this.strArr?.length > 0 || this.nxArr?.length > 0))) {
                            matchedOrderIndex = i;
                            break;
                        }
                    }
                }

                const isNxGoodsVisible = this.orderArrIndex != null && this.orderArrIndex >= 0 && this.orderItems && this.orderArrIndex < this.orderItems.length
                    && this.showMatchedGoods?.[this.orderArrIndex]
                    && (this.strArr?.length || 0) === 0 && (this.nxArr?.length || 0) === 0
                    && (this.orderItems[this.orderArrIndex]?.nxGoodsEntities?.length || 0) > 0;
                const nxGoodsTotal = isNxGoodsVisible ? (this.orderItems[this.orderArrIndex]?.nxGoodsEntities?.length || 0) : 0;

                // 若焦点在商品名称输入框且按回车：仅当无搜索下拉、无推荐商品、无 nxGoodsEntities 时，交给 handleGoodsNameEnter 触发搜索
                if (isFromGoodsNameInput && e.key === 'Enter') {
                    if (!isSearchVisible && matchedOrderIndex < 0 && !isNxGoodsVisible) return;
                }

                if (isSearchVisible) {
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        e.stopPropagation();
                        this.selectedSearchResultIndex = Math.min(this.selectedSearchResultIndex + 1, searchTotal - 1);
                        this.scrollSearchResultIntoView();
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        e.stopPropagation();
                        if (this.selectedSearchResultIndex <= 0) {
                            // 在最上一个时再按向上键，关闭搜索并聚焦商品名称输入框
                            this.$emit('close-str');
                            const orderIndex = this.orderArrIndex;
                            if (orderIndex != null && this.orderItems && orderIndex < this.orderItems.length) {
                                this.$nextTick(() => this.focusStoppedOrderInput(orderIndex, this.orderItems[orderIndex]));
                            }
                        } else {
                            this.selectedSearchResultIndex = Math.max(this.selectedSearchResultIndex - 1, 0);
                            this.scrollSearchResultIntoView();
                        }
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        this.confirmSearchResultSelection();
                    }
                } else if (isNxGoodsVisible && matchedOrderIndex === this.orderArrIndex && this.selectedNxGoodsIndex >= 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const orderIndex = this.orderArrIndex;
                    const item = this.orderItems[orderIndex];
                    const list = item?.nxGoodsEntities || [];
                    const matchedList = item?.nxDistributerGoodsEntityList || [];
                    const matchedMaxIdx = matchedList.length - 1;
                    const bothVisible = matchedList.length > 0 && this.showMatchedGoods?.[orderIndex];
                    if (e.key === 'ArrowDown') {
                        this.selectedNxGoodsIndex = Math.min(this.selectedNxGoodsIndex + 1, nxGoodsTotal - 1);
                        this.scrollNxGoodsIntoView();
                    } else if (e.key === 'ArrowUp') {
                        if (this.selectedNxGoodsIndex <= 0) {
                            if (bothVisible) {
                                this.selectedMatchedGoodsIndex = {...this.selectedMatchedGoodsIndex, [orderIndex]: matchedMaxIdx};
                                this.selectedNxGoodsIndex = -1;
                                this.scrollMatchedGoodsIntoView(orderIndex);
                            } else {
                                this.$emit('close-str');
                                if (orderIndex != null && this.orderItems && orderIndex < this.orderItems.length) {
                                    this.$nextTick(() => this.focusStoppedOrderInput(orderIndex, this.orderItems[orderIndex]));
                                }
                            }
                        } else {
                            this.selectedNxGoodsIndex = Math.max(this.selectedNxGoodsIndex - 1, 0);
                            this.scrollNxGoodsIntoView();
                        }
                    } else if (e.key === 'Enter') {
                        const goods = list[this.selectedNxGoodsIndex];
                        if (goods) this.$emit('download-goods-nx', { goods, orderIndex });
                    }
                } else if (matchedOrderIndex >= 0) {
                    const item = this.orderItems[matchedOrderIndex];
                    const list = item?.nxDistributerGoodsEntityList || [];
                    const maxIdx = list.length - 1;
                    const curIdx = this.selectedMatchedGoodsIndex[matchedOrderIndex] ?? 0;
                    const bothVisible = isNxGoodsVisible && matchedOrderIndex === this.orderArrIndex;

                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        e.stopPropagation();
                        if (bothVisible && curIdx === maxIdx) {
                            this.selectedNxGoodsIndex = 0;
                            this.scrollNxGoodsIntoView();
                        } else {
                            this.selectedMatchedGoodsIndex = {
                                ...this.selectedMatchedGoodsIndex,
                                [matchedOrderIndex]: Math.min(curIdx + 1, maxIdx)
                            };
                            this.scrollMatchedGoodsIntoView(matchedOrderIndex);
                        }
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        e.stopPropagation();
                        if (curIdx <= 0) {
                            // 在第一条时按向上键，关闭匹配商品列表
                            this.$emit('toggle-matched-goods', matchedOrderIndex);
                        } else {
                            this.selectedMatchedGoodsIndex = {
                                ...this.selectedMatchedGoodsIndex,
                                [matchedOrderIndex]: curIdx - 1
                            };
                            this.scrollMatchedGoodsIntoView(matchedOrderIndex);
                        }
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        this.$emit('select-matched-goods', {item, orderIndex: matchedOrderIndex, goodsIndex: curIdx});
                    }
                } else if (isNxGoodsVisible && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const orderIndex = this.orderArrIndex;
                    const item = this.orderItems[orderIndex];
                    const list = item?.nxGoodsEntities || [];
                    if (e.key === 'ArrowDown') {
                        this.selectedNxGoodsIndex = Math.min(this.selectedNxGoodsIndex + 1, nxGoodsTotal - 1);
                        this.scrollNxGoodsIntoView();
                    } else if (e.key === 'ArrowUp') {
                        if (this.selectedNxGoodsIndex <= 0) {
                            this.$emit('close-str');
                            if (orderIndex != null && this.orderItems && orderIndex < this.orderItems.length) {
                                this.$nextTick(() => this.focusStoppedOrderInput(orderIndex, this.orderItems[orderIndex]));
                            }
                        } else {
                            this.selectedNxGoodsIndex = Math.max(this.selectedNxGoodsIndex - 1, 0);
                            this.scrollNxGoodsIntoView();
                        }
                    } else if (e.key === 'Enter') {
                        const goods = list[this.selectedNxGoodsIndex];
                        if (goods) this.$emit('download-goods-nx', { goods, orderIndex });
                    }
                } else if ((e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') && !isSearchVisible && !isNxGoodsVisible && matchedOrderIndex < 0) {
                    // 搜索下拉、nxGoodsEntities、推荐商品都关闭时，上下键/空格用于选择订单或朗读控制
                    const isReadingState = this.isTTSPlaying || this.isTTSLoading || this.stoppedIndex >= 0;
                    // 因 -2 停止朗读后，若焦点在输入框内，空格不触发继续朗读，用于正常输入
                    const stoppedOrder = this.stoppedIndex >= 0 && this.orderItems && this.orderItems[this.stoppedIndex];
                    const isStoppedByStatus2 = stoppedOrder && stoppedOrder.nxDoStatus === -2;
                    if (e.key === ' ' && isFromOrderInput && isStoppedByStatus2) {
                        return; // 不拦截，让空格正常插入输入框
                    }
                    if (e.key === ' ' && !isReadingState) { /* 空格仅朗读时处理 */
                    } else {
                        const handled = this._handleReadingShortcuts(e.key);
                        if (handled) {
                            e.preventDefault();
                            e.stopPropagation();
                        }
                    }
                }
            },
            scrollSearchResultIntoView() {
                this.$nextTick(() => {
                    const container = this.$refs.scrollContainer;
                    if (!container) return;
                    const el = container.querySelector(`.search-results-container .goods-item[data-goods-index="${this.selectedSearchResultIndex}"]`);
                    if (el) el.scrollIntoView({block: 'nearest', behavior: 'smooth'});
                });
            },
            scrollMatchedGoodsIntoView(orderIndex) {
                this.$nextTick(() => {
                    const container = this.$refs.scrollContainer;
                    if (!container) return;
                    const idx = this.selectedMatchedGoodsIndex[orderIndex] ?? 0;
                    const el = container.querySelector(`.matched-goods-list[data-order-index="${orderIndex}"] .matched-goods-item[data-goods-index="${idx}"]`);
                    if (el) el.scrollIntoView({block: 'nearest', behavior: 'smooth'});
                });
            },
            scrollNxGoodsIntoView() {
                this.$nextTick(() => {
                    const container = this.$refs.scrollContainer;
                    if (!container) return;
                    const el = container.querySelector(`.nx-goods-entities-container .goods-item[data-goods-index="${this.selectedNxGoodsIndex}"]`);
                    if (el) el.scrollIntoView({block: 'nearest', behavior: 'smooth'});
                });
            },
            confirmSearchResultSelection() {
                const idx = this.selectedSearchResultIndex;
                const strLen = this.strArr?.length || 0;
                const orderIndex = this.orderArrIndex;
                if (orderIndex == null || orderIndex >= (this.orderItems?.length || 0)) return;
                let goods;
                if (idx < strLen) {
                    goods = this.strArr[idx];
                    if (goods) this.$emit('select-search-result', {goods, orderIndex});
                } else {
                    goods = this.nxArr[idx - strLen];
                    if (goods) this.$emit('download-goods-nx', {goods, orderIndex});
                }
            },

            // 展开/收起匹配商品：展开时滚动订单到顶部，便于查看推荐商品列表
            handleToggleMatchedGoods(orderIndex) {
                const isExpanded = !!this.showMatchedGoods[orderIndex];
                const hasSearchResults = this.orderArrIndex === orderIndex && ((this.strArr?.length || 0) + (this.nxArr?.length || 0)) > 0;
                const willClose = isExpanded || hasSearchResults;
                console.log('[OrderList] handleToggleMatchedGoods', { orderIndex, isExpanded, hasSearchResults, orderArrIndex: this.orderArrIndex, strArrLen: this.strArr?.length, nxArrLen: this.nxArr?.length });
                this.handleOrderAction(() => {
                    if (willClose) {
                        // 收起时清除本地输入缓存，使 getGoodsNameValue 返回父组件恢复后的 item.nxDoGoodsName
                        delete this.goodsNameInputValues[orderIndex];
                        // 关闭时传对象，父组件需 hasSearchResults 来清空搜索
                        this.$emit('toggle-matched-goods', { orderIndex, hasSearchResults });
                    } else {
                        // 展开时传数字，兼容 TaskOrder 等仅做简单 toggle 的父组件
                        this.$emit('toggle-matched-goods', orderIndex);
                    }
                    if (!willClose) {
                        this.$nextTick(() => this.scrollToOrderItem(orderIndex));
                    } else {
                        // 收起时清空停止序号
                        this.stoppedIndex = -1;
                        this.stoppedOrderRef = null;
                    }
                }, orderIndex);
            },

            // 更新 TTS 播放器高度
            updateTtsPlayerHeight() {
                if (this.$refs.ttsPlayerContainer) {
                    this.$nextTick(() => {
                        const height = this.$refs.ttsPlayerContainer.offsetHeight;
                        if (height !== this.ttsPlayerHeight) {
                            this.ttsPlayerHeight = height;
                            console.log('[OrderList] TTS播放器高度已更新:', height);
                        }
                    });
                } else {
                    this.ttsPlayerHeight = 0;
                }
            },

            // 清空所有 TTS 缓存（音频缓存、请求缓存、重试记录）
            clearTtsCache() {
                this.ttsAudioCache = {};
                this.ttsRequestCache = {};
                this.ttsRequestRetries = {};
                console.log('[OrderList] 已清空所有 TTS 缓存');
            },

            async startRecording() {
                // ✅ 防止重复启动（使用同步锁）
                if (this.isStarting) {
                    console.warn('[OrderList] 正在启动中，忽略重复启动');
                    return;
                }

                if (this.isRecording) {
                    console.warn('[OrderList] 已经在录音中，忽略重复启动');
                    return;
                }

                if (this.isStopping) {
                    console.warn('[OrderList] 正在停止中，忽略启动请求');
                    return;
                }

                // ✅ 立即设置锁和状态，防止重复点击
                this.isStarting = true;
                this.isRecording = true;

                try {
                    console.log('[OrderList] 请求主进程开始 PCM 录音...');
                    this.recordingError = null;

                    // ✅ 只发送开始命令，音频在主进程录制
                    if (isVoiceRuntimeAvailable()) {
                        const startResult = await startVoiceRecognition();
                        console.log('[OrderList] 主进程录音启动结果:', startResult);

                        if (!startResult.success) {
                            throw new Error('启动主进程录音失败: ' + startResult.error);
                        }
                    } else {
                        throw new Error('electronAPI 不可用');
                    }

                    console.log('[OrderList] PCM 录音已开始（主进程录制）');
                } catch (error) {
                    console.error('[OrderList] 录音启动失败:', error);
                    this.recordingError = error.message;
                    this.isRecording = false;

                    // 显示错误提示
                    let errorMessage = '启动录音失败';
                    if (error.message.includes('node-record-lpcm16')) {
                        errorMessage = '录音库未安装，请运行: npm install node-record-lpcm16';
                    } else {
                        errorMessage = error.message || '未知错误';
                    }

                    this.showToast(errorMessage, 'error');
                } finally {
                    // ✅ 释放启动锁
                    this.isStarting = false;
                }
            },

            async stopRecording() {
                console.log('[OrderList] stopRecording 被调用');
                console.log('[OrderList] isStopping:', this.isStopping);
                console.log('[OrderList] isRecording:', this.isRecording);

                // ✅ 防止重复点击
                if (this.isStopping) {
                    console.log('[OrderList] stopRecording 已在执行，忽略重复点击');
                    return;
                }

                this.isStopping = true;
                this.isRecording = false; // ✅ 立刻更新 UI，避免重复点触发 start

                console.log('[OrderList] 请求主进程停止 PCM 录音...');

                try {
                    // ✅ 只发送停止命令，主进程会停止录音并发送识别请求
                    if (isVoiceRuntimeAvailable()) {
                        const result = await stopVoiceRecognition();
                        console.log('[OrderList] 主进程录音停止结果:', result);
                    } else {
                        console.warn('[OrderList] electronAPI 不可用');
                    }
                } catch (error) {
                    console.error('[OrderList] stopRecording 异常:', error);
                } finally {
                    // ✅ 释放停止锁
                    this.isStopping = false;
                    this.isRecording = false;
                }
            },


            // 播放 TTS Base64 音频（使用全局唯一的 audio 实例，带播放锁）
            async playTtsBase64WithCallback(audioBase64, onEndedCallback = null) {
                // 播放锁：如果正在播放，直接返回
                if (this.isTTSPlaying) {
                    console.warn('[OrderList] 正在播放中，忽略重复播放请求');
                    return false;
                }

                try {
                    console.log('[OrderList] 准备播放TTS音频');

                    // ✅ 先不要立刻把 isPlaying=true，等 onplay 事件

                    // base64 -> binary -> blob -> URL
                    const binary = atob(audioBase64);
                    const len = binary.length;
                    const bytes = new Uint8Array(len);
                    for (let i = 0; i < len; i++) {
                        bytes[i] = binary.charCodeAt(i);
                    }

                    const blob = new Blob([bytes], {type: 'audio/wav'});
                    const url = URL.createObjectURL(blob);

                    // 保存 URL 用于显示
                    if (this.ttsAudioUrl) {
                        URL.revokeObjectURL(this.ttsAudioUrl);
                    }
                    this.ttsAudioUrl = url;

                    // 使用全局唯一的 audio 实例
                    const audio = this.ttsAudio;

                    // 清理函数
                    const cleanup = () => {
                        URL.revokeObjectURL(url);
                        audio.onended = null;
                        audio.onerror = null;
                        audio.onplay = null;
                    };

                    // 返回 Promise，便于处理
                    return new Promise((resolve) => {
                        // ✅ 只有在 onplay 事件时才设置播放锁
                        audio.onplay = () => {
                            this.isTTSPlaying = true;
                            console.log('[OrderList] onplay - 音频真正开始播放');

                            // 检查当前播放的订单是否在可视范围内（currentTTSIndex 是下一个要播放的，所以当前播放的是 currentTTSIndex - 1）
                            const currentReadingIndex = this.currentTTSIndex > 0 ? this.currentTTSIndex - 1 : -1;
                            if (currentReadingIndex >= 0) {
                                this.$nextTick(() => {
                                    if (!this.isOrderInViewport(currentReadingIndex)) {
                                        console.log('[OrderList] 播放时订单不在可视范围内，自动滚动，索引:', currentReadingIndex);
                                        this.scrollToOrderItem(currentReadingIndex);
                                    }
                                });
                            }
                        };

                        // 设置播放完成回调
                        audio.onended = () => {
                            // ✅ 检查是否已停止（队列被清空）
                            if (this.ttsQueue.length === 0) {
                                console.log('[OrderList] 播放已停止，忽略 onended');
                                cleanup();
                                resolve(false);
                                return;
                            }

                            console.log('[OrderList] onended - 音频播放完成');
                            cleanup();
                            this.isTTSPlaying = false; // ✅ 必须复位
                            this.ttsAudioUrl = null;

                            // 调用回调，继续播放下一条（如果队列未清空）
                            if (onEndedCallback && this.ttsQueue.length > 0) {
                                onEndedCallback();
                            }
                            resolve(true);
                        };

                        // 设置错误回调
                        audio.onerror = (e) => {
                            // ✅ 检查是否已停止（队列被清空）
                            if (this.ttsQueue.length === 0) {
                                console.log('[OrderList] 播放已停止，忽略 onerror');
                                cleanup();
                                resolve(false);
                                return;
                            }

                            console.error('[OrderList] onerror - audio 播放失败:', e);
                            cleanup();
                            this.isTTSPlaying = false; // ✅ 必须复位
                            this.ttsAudioUrl = null;
                            this.ttsError = '音频播放失败';

                            // 播放失败，继续下一条（如果队列未清空）
                            if (onEndedCallback && this.ttsQueue.length > 0) {
                                onEndedCallback();
                            }
                            resolve(false);
                        };

                        // 设置新的源
                        audio.src = url;

                        // 播放音频
                        audio.play()
                            .then(() => {
                                console.log('[OrderList] play() 调用成功，等待 onplay 事件');
                                // 注意：不在这里设置 isTTSPlaying，等 onplay 事件
                            })
                            .catch(err => {
                                console.error('[OrderList] play() 失败:', err);
                                cleanup();
                                this.isTTSPlaying = false; // ✅ 必须复位
                                this.ttsAudioUrl = null;
                                this.ttsError = '播放失败: ' + err.message;

                                // 播放失败，继续下一条
                                if (onEndedCallback) {
                                    onEndedCallback();
                                }
                                resolve(false);
                            });
                    });
                } catch (e) {
                    console.error('[OrderList] playTtsBase64WithCallback 异常:', e);
                    this.isTTSPlaying = false; // ✅ 必须复位
                    this.ttsError = '播放音频失败: ' + e.message;

                    // 异常时也继续下一条
                    if (onEndedCallback) {
                        onEndedCallback();
                    }
                    return false;
                }
            },

            // 格式化订单内容为文本（优化版：更简洁自然）
            formatOrderText(item, index) {
                let text = '';

                // 序号（数字后面用句号停一下，更自然）
                text += `第${index}条,`;

                // 商品名称
                if (item.nxDoGoodsName) {
                    text += item.nxDoGoodsName;
                }

                // 数量+单位（用空格分隔，不用逗号）
                if (item.nxDoQuantity && item.nxDoStandard) {
                    text += item.nxDoQuantity + item.nxDoStandard;
                } else if (item.nxDoQuantity) {
                    text += item.nxDoQuantity;
                } else if (item.nxDoStandard) {
                    text += item.nxDoStandard;
                }

                // 备注（如果有）
                if (item.nxDoRemark && item.nxDoRemark.trim()) {
                    text += '。备注' + item.nxDoRemark;
                } else {
                    text += '。';
                }

                // 如果订单状态为 -2（需要确定商品），添加提示并标记需要停止
                // if (item.nxDoStatus === -2) {
                //     text += '需要确定商品';
                // }

                return text;
            },

            // 重头开始朗读（停止当前播放并重新开始）
            async restartReading() {
                console.log('[OrderList] 重头开始朗读');

                // 先停止当前播放
                if (this.isTTSPlaying || this.isTTSLoading) {
                    // 停止音频播放
                    if (this.ttsAudio) {
                        this.ttsAudio.pause();
                        this.ttsAudio.src = '';
                        // 清理事件监听器，防止 onended 继续触发
                        this.ttsAudio.onended = null;
                        this.ttsAudio.onerror = null;
                        this.ttsAudio.onplay = null;
                    }

                    // 释放播放锁
                    this.isTTSPlaying = false;
                    this.isTTSLoading = false;

                    // 清空队列
                    this.ttsQueue = [];
                    this.currentTTSIndex = 0;

                    // 重置所有朗读相关参数
                    this.ttsAudioUrl = null;
                    this.ttsError = null;
                    this.clearTtsCache();
                    this.ttsSessionId = null;
                }

                // ✅ 无论当前状态如何，都要重置暂停状态
                this.stoppedIndex = -1;
                this.stoppedOrderRef = null;

                // 等待一小段时间确保停止操作完成
                await new Promise(resolve => setTimeout(resolve, 100));

                // 重新开始朗读
                await this.readOrderList();
            },

            // 朗读订单列表（分段合成 + 队列播放）
            async readOrderList() {
                if (!this.orderItems || this.orderItems.length === 0) {
                    this.showToast('没有订单可朗读', 'warning');
                    return;
                }
                this.keyboardSelectedOrderIndex = -1;

                // ✅ 调试日志：定位播放锁问题
                console.log('[OrderList] 开始朗读 isPlaying=', this.isTTSPlaying);
                console.log('[OrderList] audioEl exists=', !!this.ttsAudio);
                console.log('[OrderList] audioEl.paused=', this.ttsAudio?.paused);

                if (this.isTTSPlaying) {
                    console.log('[OrderList] 正在播放中，忽略重复请求');
                    return;
                }

                // ✅ 确保播放锁初始为 false（不要在这里设置为 true）
                this.isTTSLoading = true;
                this.isTTSPlaying = false; // 确保初始为 false
                this.ttsError = null;
                this.ttsAudioUrl = null;
                this.currentTTSIndex = 0;
                this.clearTtsCache(); // 清空缓存

                // 生成统一的 SessionId（便于排查）
                this.ttsSessionId = `order_${Date.now()}`;

                try {
                    // 格式化所有订单内容（每条单独）
                    // ✅ 重要：队列必须和订单一一对应，不进行过滤，保持索引一致
                    const orderTexts = this.orderItems
                        .map((item, index) => {
                            const text = this.formatOrderText(item, index + 1);
                            return text ? text.trim() : '';
                        });

                    if (orderTexts.length === 0) {
                        throw new Error('没有有效的订单内容可朗读');
                    }

                    console.log('[OrderList] 准备朗读订单，共', orderTexts.length, '条');
                    console.log('[OrderList] 订单文本:', orderTexts);

                    // 初始化播放队列（存储文本）
                    this.ttsQueue = [...orderTexts];

                    // 预取第一条和第二条
                    await this.prefetchTTS(0);
                    this.prefetchTTS(1); // 不 await，后台预取

                    // 开始播放第一条
                    await this.playNextInQueue();
                } catch (error) {
                    console.error('[OrderList] 朗读订单失败:', error);
                    this.isTTSLoading = false;
                    this.isTTSPlaying = false;
                    this.ttsError = error.message;
                }
            },

            // 从指定订单开始朗读
            async readOrderListFromIndex(startOrderIndex) {
                if (!this.orderItems || this.orderItems.length === 0) {
                    this.showToast('没有订单可朗读', 'warning');
                    return;
                }
                if (startOrderIndex < 0 || startOrderIndex >= this.orderItems.length) {
                    return;
                }
                this.keyboardSelectedOrderIndex = -1;
                // 关闭已打开的推荐商品
                this.$emit('close-all-matched-goods');
                // 停止当前播放
                if (this.ttsAudio) {
                    this.ttsAudio.pause();
                    this.ttsAudio.src = '';
                    this.ttsAudio.onended = null;
                    this.ttsAudio.onerror = null;
                    this.ttsAudio.onplay = null;
                }
                this.isTTSPlaying = false;
                this.isTTSLoading = true;
                this.stoppedIndex = -1;
                this.stoppedOrderRef = null;
                this.ttsError = null;
                this.ttsAudioUrl = null;
                this.clearTtsCache();
                this.ttsSessionId = `order_${Date.now()}`;

                try {
                    const orderTexts = this.orderItems
                        .map((item, index) => {
                            const text = this.formatOrderText(item, index + 1);
                            return text ? text.trim() : '';
                        });
                    if (orderTexts.length === 0) throw new Error('没有有效的订单内容可朗读');

                    this.ttsQueue = [...orderTexts];
                    this.currentTTSIndex = startOrderIndex;

                    await this.prefetchTTS(startOrderIndex);
                    this.prefetchTTS(startOrderIndex + 1);
                    this.scrollToOrderItem(startOrderIndex);
                    await this.playNextInQueue();
                } catch (error) {
                    console.error('[OrderList] 从这里开始朗读失败:', error);
                    this.isTTSLoading = false;
                    this.isTTSPlaying = false;
                    this.ttsError = error.message;
                }
            },

            // 停止朗读（完全重置）
            stopReading() {
                console.log('[OrderList] 停止朗读，当前索引:', this.currentTTSIndex);

                // 停止音频播放
                if (this.ttsAudio) {
                    this.ttsAudio.pause();
                    this.ttsAudio.src = '';
                    // 清理事件监听器，防止 onended 继续触发
                    this.ttsAudio.onended = null;
                    this.ttsAudio.onerror = null;
                    this.ttsAudio.onplay = null;
                }

                // 释放播放锁
                this.isTTSPlaying = false;
                this.isTTSLoading = false;

                // ✅ 记住停止的序号（在清空队列之前，currentTTSIndex 已经是下一个要播放的，所以当前播放的是 currentTTSIndex - 1）
                const stoppedIndex = this.currentTTSIndex > 0 ? this.currentTTSIndex - 1 : 0;
                this.stoppedIndex = stoppedIndex; // 保存停止位置
                // 保存停止的订单引用，用于在订单插入后找到新位置
                if (this.orderItems && stoppedIndex >= 0 && stoppedIndex < this.orderItems.length) {
                    this.stoppedOrderRef = this.orderItems[stoppedIndex];
                }

                // ✅ 清空队列，防止继续播放
                this.ttsQueue = [];
                this.currentTTSIndex = 0;

                // ✅ 重置所有朗读相关参数
                this.ttsAudioUrl = null;
                this.ttsError = null;
                this.clearTtsCache();
                this.ttsSessionId = null;
                this.stoppedIndex = -1; // 重置停止位置
                this.stoppedOrderRef = null; // 重置停止订单引用

                console.log('[OrderList] 停止的序号:', stoppedIndex, '队列已清空，所有参数已重置');

                return stoppedIndex;
            },

            // 停止朗读并设置停止序号为指定订单序号（用于订单操作时）
            stopReadingAtOrder(orderIndex) {
                // 如果正在朗读，则停止
                if (this.isTTSPlaying || this.isTTSLoading) {
                    console.log('[OrderList] 订单操作触发停止朗读，订单序号:', orderIndex);

                    // 停止音频播放
                    if (this.ttsAudio) {
                        this.ttsAudio.pause();
                        this.ttsAudio.src = '';
                        // 清理事件监听器，防止 onended 继续触发
                        this.ttsAudio.onended = null;
                        this.ttsAudio.onerror = null;
                        this.ttsAudio.onplay = null;
                    }

                    // 释放播放锁
                    this.isTTSPlaying = false;
                    this.isTTSLoading = false;

                    // ✅ 设置停止序号为点击操作的订单序号
                    this.stoppedIndex = orderIndex;
                    // 保存停止的订单引用，用于在订单插入后找到新位置
                    if (this.orderItems && orderIndex >= 0 && orderIndex < this.orderItems.length) {
                        this.stoppedOrderRef = this.orderItems[orderIndex];
                    }

                    // ✅ 清空队列，防止继续播放
                    this.ttsQueue = [];
                    this.currentTTSIndex = 0;

                    // ✅ 重置朗读相关参数（但保留 stoppedIndex）
                    this.ttsAudioUrl = null;
                    this.ttsError = null;
                    this.clearTtsCache();
                    this.ttsSessionId = null;

                    console.log('[OrderList] 已停止朗读，停止序号设置为:', orderIndex);
                }
            },

            // 暂停朗读（保留队列和位置）
            pauseReading() {
                console.log('[OrderList] 暂停朗读，当前索引:', this.currentTTSIndex);

                // 暂停音频播放
                if (this.ttsAudio) {
                    this.ttsAudio.pause();
                    // 不清理 src 和事件监听器，保留状态以便继续
                }

                // 释放播放锁，但保留队列和位置
                this.isTTSPlaying = false;
                this.isTTSLoading = false;

                // 记住暂停的位置
                const pausedIndex = this.currentTTSIndex > 0 ? this.currentTTSIndex - 1 : 0;
                this.stoppedIndex = pausedIndex;
                // 保存暂停的订单引用，用于在订单插入后找到新位置
                if (this.orderItems && pausedIndex >= 0 && pausedIndex < this.orderItems.length) {
                    this.stoppedOrderRef = this.orderItems[pausedIndex];
                }

                console.log('[OrderList] 暂停的序号:', pausedIndex);

                // 滚动到暂停的订单顶部
                this.$nextTick(() => {
                    this.scrollToOrderItemTop(pausedIndex);
                });
            },

            // 检查订单是否在可视范围内（朗读时订单会展开推荐商品列表，需把订单顶到尽量高的位置）
            isOrderInViewport(orderIndex) {
                const orderItemEl = this.orderItemRefs[orderIndex];
                const container = this.$refs.scrollContainer;

                if (!orderItemEl || !container) {
                    return false;
                }

                const containerRect = container.getBoundingClientRect();
                const itemRect = orderItemEl.getBoundingClientRect();

                // 表头高度 + 最小间距，避免订单被 sticky 表头遮挡
                const tableHeaderHeight = (this.$refs.tableHeader && this.$refs.tableHeader.offsetHeight) || 36;
                const topOffsetPx = tableHeaderHeight + 8;
                const topThreshold = containerRect.top + topOffsetPx;
                return itemRect.top >= topThreshold && itemRect.bottom <= containerRect.bottom;
            },

            // 获取朗读时滚动使用的顶部偏移（表头高度 + 8px，避免被表头遮挡）
            _getScrollTopOffset() {
                const tableHeaderHeight = (this.$refs.tableHeader && this.$refs.tableHeader.offsetHeight) || 36;
                return tableHeaderHeight + 8;
            },

            // 滚动到指定订单项的顶部（订单顶到表头下方，为下方推荐商品列表预留空间）
            scrollToOrderItemTop(orderIndex) {
                const orderItemEl = this.orderItemRefs[orderIndex];
                const container = this.$refs.scrollContainer;

                if (!orderItemEl) {
                    console.warn('[OrderList] 未找到订单项 DOM 元素，索引:', orderIndex);
                    return;
                }

                if (!container) {
                    console.warn('[OrderList] 未找到滚动容器');
                    return;
                }

                const containerRect = container.getBoundingClientRect();
                const itemRect = orderItemEl.getBoundingClientRect();
                const topOffsetPx = this._getScrollTopOffset();
                const scrollTop = container.scrollTop + (itemRect.top - containerRect.top) - topOffsetPx;

                container.scrollTo({
                    top: Math.max(0, scrollTop),
                    behavior: 'smooth'
                });

                console.log('[OrderList] 已滚动到订单项顶部，索引:', orderIndex, '顶部留白:', topOffsetPx, 'px');
            },

            // 朗读因 nxDoStatus === -2 停止后，自动聚焦到合适的输入框：商品名称可编辑则聚焦商品名称，否则聚焦数量或规格
            focusStoppedOrderInput(orderIndex, orderItem) {
                if (!orderItem || !this.orderItemRefs[orderIndex]) return;
                this._skipCloseMatchedGoodsOnNextFocus = true;  // 避免 handleGoodsNameFocus 立即关闭刚展开的推荐商品
                // 有推荐商品时，确保第一条为选中状态（handleGoodsNameFocus 不会删除）
                if (orderItem?.nxDistributerGoodsEntityList?.length > 0 && this.showMatchedGoods?.[orderIndex]) {
                    this.selectedMatchedGoodsIndex = {...this.selectedMatchedGoodsIndex, [orderIndex]: 0};
                    this.selectedNxGoodsIndex = -1;
                }
                const orderItemEl = this.orderItemRefs[orderIndex];
                const isValid = this.isValidOrderQuantityAndStandard && this.isValidOrderQuantityAndStandard(orderItem);

                let targetEl = null;
                if (isValid) {
                    // 商品名称可编辑，聚焦商品名称
                    targetEl = orderItemEl.querySelector('[data-order-input="goods-name"]');
                } else {
                    // 缺少数量或规格，优先聚焦数量，其次规格
                    const quantity = orderItem.nxDoQuantity;
                    const standard = orderItem.nxDoStandard;
                    const isValidQuantity = quantity != null && quantity !== '' && !isNaN(quantity);
                    const isValidStandard = standard != null && standard !== '' && String(standard).trim() !== '';

                    if (!isValidQuantity) {
                        targetEl = orderItemEl.querySelector('[data-order-input="quantity"]');
                    } else {
                        targetEl = orderItemEl.querySelector('[data-order-input="standard"]');
                    }
                }
                if (targetEl && !targetEl.disabled) {
                    this.$nextTick(() => {
                        targetEl.focus();
                        console.log('[OrderList] 朗读停止后自动聚焦，索引:', orderIndex, 'target:', targetEl?.getAttribute?.('data-order-input'));
                    });
                }
            },

            // 搜索商品下拉显示时，取消输入框焦点（避免回车与输入框冲突）
            _blurGoodsNameInputWhenSearchVisible(orderIndex) {
                if (orderIndex == null || orderIndex < 0 || !this.orderItemRefs?.[orderIndex]) return;
                const orderItemEl = this.orderItemRefs[orderIndex];
                const inputEl = orderItemEl?.querySelector?.('[data-order-input="goods-name"]');
                if (inputEl) {
                    this.$nextTick(() => inputEl.blur());
                }
            },

            // 获取当前朗读的订单文本
            getCurrentReadingText() {
                if (this.currentTTSIndex > 0 && this.currentTTSIndex <= this.ttsQueue.length) {
                    // currentTTSIndex 是下一个要播放的，所以当前播放的是 currentTTSIndex - 1
                    const currentIndex = this.currentTTSIndex - 1;
                    return this.ttsQueue[currentIndex] || '';
                }
                return '';
            },

            // 判断是否是当前正在朗读的订单
            isCurrentReadingOrder(orderIndex) {
                // currentTTSIndex 是下一个要播放的索引，所以当前播放的是 currentTTSIndex - 1
                const currentReadingIndex = this.currentTTSIndex > 0 ? this.currentTTSIndex - 1 : -1;
                return this.isTTSPlaying && currentReadingIndex === orderIndex;
            },

            // 判断是否是暂停的订单
            isPausedOrder(orderIndex) {
                return this.stoppedIndex >= 0 && this.stoppedIndex === orderIndex;
            },

            // 获取订单项背景色（含 nxDoPurchaseStatus 采购状态，参考 TodayOrders）
            getOrderItemBackgroundColor(item, orderIndex) {
                if (this.isPausedOrder(orderIndex)) return '#fee';
                if (this.isCurrentReadingOrder(orderIndex)) return '#fff3cd';
                if (this.keyboardSelectedOrderIndex === orderIndex) return '#e7f3ff';
                // nxDoStatus > -1 时订单已提交，有 nxDoPurchaseStatus
                if (item && item.nxDoStatus > -1) {
                    const ps = item.nxDoPurchaseStatus;
                    if (ps == 4) return '#fff';           // 已采购
                    if (ps == 3) return '#f8d7da';       // liziClock
                    if (ps == 5) return '#d1ecf1';       // liziDelivery
                    if (ps != 4 && item.nxDoStatus == 0) return '#f1fbfd';  // liziBack
                }
                return '#fff';
            },

            // 点击暂停图标时取消朗读状态（清除 stoppedIndex，不再显示暂停）
            cancelPausedState() {
                this.stoppedIndex = -1;
                this.stoppedOrderRef = null;
                this.clearTtsCache();
                this._emitTTSState();
            },

            // 播放队列中的下一条（使用缓存和预取）
            async playNextInQueue() {
                // ✅ 检查是否已停止（队列被清空）
                if (this.ttsQueue.length === 0) {
                    console.log('[OrderList] 队列已清空，停止播放');
                    this.isTTSLoading = false;
                    this.isTTSPlaying = false;
                    return;
                }

                // 队列为空，播放完成
                if (this.currentTTSIndex >= this.ttsQueue.length) {
                    console.log('[OrderList] 所有订单朗读完成');
                    this.isTTSLoading = false;
                    this.isTTSPlaying = false;
                    this.stoppedIndex = -1; // 重置停止位置
                    this.stoppedOrderRef = null; // 重置停止订单引用
                    this.clearTtsCache(); // 清空缓存
                    return;
                }

                const index = this.currentTTSIndex;
                const text = this.ttsQueue[index];

                // ✅ 如果文本为空，跳过这条订单，继续下一条
                if (!text || text.trim() === '') {
                    console.log('[OrderList] 订单文本为空，跳过，索引:', index);
                    this.currentTTSIndex = index + 1;
                    await this.playNextInQueue();
                    return;
                }

                // 检查当前订单的状态（需要从 orderItems 中获取）
                const currentOrderItem = this.orderItems[index];
                const needStop = currentOrderItem && currentOrderItem.nxDoStatus === -2;

                console.log('[OrderList] 播放订单，索引:', index);
                console.log('  - 队列文本:', text ? text.substring(0, 50) + '...' : 'null');
                console.log('  - 订单项信息:', currentOrderItem ? {
                    index: index,
                    goodsName: currentOrderItem.nxDoGoodsName,
                    quantity: currentOrderItem.nxDoQuantity,
                    standard: currentOrderItem.nxDoStandard,
                    status: currentOrderItem.nxDoStatus
                } : 'null');
                console.log('  - 剩余:', this.ttsQueue.length - index - 1, '需要停止:', needStop);

                // ✅ 验证：队列文本中的序号应该和订单索引 + 1 一致
                if (text && currentOrderItem) {
                    const expectedOrderNumber = index + 1;
                    const textOrderNumber = text.match(/第(\d+)条/);
                    if (textOrderNumber && parseInt(textOrderNumber[1]) !== expectedOrderNumber) {
                        console.warn('[OrderList] ⚠️ 警告：队列文本序号与订单索引不匹配！', {
                            queueIndex: index,
                            textOrderNumber: textOrderNumber[1],
                            expectedOrderNumber: expectedOrderNumber,
                            actualGoodsName: currentOrderItem.nxDoGoodsName
                        });
                    }
                }

                try {
                    // 获取音频（优先从缓存，没有则请求）
                    let audioBase64 = this.ttsAudioCache[index];

                    if (!audioBase64) {
                        console.log('[OrderList] 缓存未命中，请求 TTS，索引:', index);
                        audioBase64 = await this.prefetchTTS(index);
                    } else {
                        console.log('[OrderList] 使用缓存音频，索引:', index);
                    }

                    // 若在 await 期间被 stopReading 清空队列，立即退出
                    if (this.ttsQueue.length === 0) {
                        console.log('[OrderList] 队列已清空（stopReading），停止播放');
                        this.isTTSLoading = false;
                        this.isTTSPlaying = false;
                        return;
                    }

                    if (!audioBase64) {
                        throw new Error('获取音频失败');
                    }

                    // 预取下一条和下下一条（后台异步，不阻塞）
                    if (index + 1 < this.ttsQueue.length) {
                        this.prefetchTTS(index + 1); // 不 await
                    }
                    if (index + 2 < this.ttsQueue.length) {
                        this.prefetchTTS(index + 2); // 不 await
                    }

                    // 检查当前订单是否在可视范围内，如果不在则自动滚动
                    this.$nextTick(() => {
                        if (!this.isOrderInViewport(index)) {
                            console.log('[OrderList] 订单不在可视范围内，自动滚动，索引:', index);
                            this.scrollToOrderItem(index);
                        }
                    });

                    // 播放音频，播放完成后继续下一条
                    this.currentTTSIndex = index + 1;
                    await this.playTtsBase64WithCallback(audioBase64, () => {
                        // 如果当前订单状态为 -2，停止朗读
                        // 因 -2 停止时设置的参数：stoppedIndex, stoppedOrderRef, isTTSLoading=false, isTTSPlaying=false（保留 ttsQueue/currentTTSIndex 用于继续）
                        if (needStop) {
                            console.log('[OrderList] 订单状态为 -2，停止朗读，索引:', index);
                            this.stoppedIndex = index; // 记住停止的位置
                            // 保存停止的订单引用，用于在订单插入后找到新位置
                            if (this.orderItems && index >= 0 && index < this.orderItems.length) {
                                this.stoppedOrderRef = this.orderItems[index];
                            }
                            this.isTTSLoading = false;
                            this.isTTSPlaying = false;

                            // 自动展开匹配商品（如果满足条件）
                            if (currentOrderItem &&
                                this.isValidOrderQuantityAndStandard &&
                                this.isValidOrderQuantityAndStandard(currentOrderItem) &&
                                currentOrderItem.nxDistributerGoodsEntityList &&
                                currentOrderItem.nxDistributerGoodsEntityList.length > 0) {
                                console.log('[OrderList] 自动展开匹配商品，索引:', index);
                                // 如果当前未展开，则展开
                                if (!this.showMatchedGoods[index]) {
                                    this.$emit('toggle-matched-goods', index);
                                }

                                // 滚动到该订单项的最佳可视位置
                                this.$nextTick(() => {
                                    this.scrollToOrderItem(index);
                                    this.focusStoppedOrderInput(index, currentOrderItem);
                                });
                            } else {
                                console.log('[OrderList] 不满足自动展开条件:', {
                                    hasItem: !!currentOrderItem,
                                    hasValidator: !!this.isValidOrderQuantityAndStandard,
                                    isValid: this.isValidOrderQuantityAndStandard ? this.isValidOrderQuantityAndStandard(currentOrderItem) : false,
                                    hasMatchedGoods: !!(currentOrderItem && currentOrderItem.nxDistributerGoodsEntityList && currentOrderItem.nxDistributerGoodsEntityList.length > 0)
                                });

                                // 无匹配商品时，若有商品名称则触发搜索（相当于在商品名称输入框按回车）
                                const goodsName = this.getGoodsNameValue(currentOrderItem, index) || currentOrderItem?.nxDoGoodsName || '';
                                const didTriggerSearch = !!(goodsName && this.isValidOrderQuantityAndStandard?.(currentOrderItem));
                                if (didTriggerSearch) {
                                    this.$emit('goods-name-input', {
                                        item: currentOrderItem,
                                        orderIndex: index,
                                        value: goodsName
                                    });
                                    delete this.goodsNameInputValues[index];
                                }
                                // 滚动到该订单项；无论是否触发搜索，都聚焦输入框（无推荐商品时用户也需要输入）
                                this.$nextTick(() => {
                                    this.scrollToOrderItem(index);
                                    this.focusStoppedOrderInput(index, currentOrderItem);
                                });
                            }

                            // 不清空队列，保留状态以便继续朗读
                            return;
                        }
                        // 播放完成，继续播放下一条
                        this.playNextInQueue();
                    });
                } catch (error) {
                    console.error('[OrderList] 播放队列项失败:', error);
                    // 继续播放下一条
                    this.currentTTSIndex = index + 1;
                    await this.playNextInQueue();
                }
            },

            // 预取 TTS 音频（后台异步，不阻塞）
            // 优化：添加重试机制、请求去重、错误处理
            async prefetchTTS(index) {
                if (index >= this.ttsQueue.length) {
                    return null;
                }

                // 如果缓存中已有，直接返回
                if (this.ttsAudioCache[index]) {
                    return this.ttsAudioCache[index];
                }

                const text = this.ttsQueue[index];
                if (!text || !text.trim()) {
                    return null;
                }

                // 请求去重：如果已有相同索引的请求正在进行，等待该请求完成
                if (this.ttsRequestCache[index]) {
                    console.log('[OrderList] 请求已在进行中，等待完成，索引:', index);
                    try {
                        return await this.ttsRequestCache[index];
                    } catch (error) {
                        // 如果等待的请求失败，继续执行新的请求
                        console.warn('[OrderList] 等待的请求失败，重新请求，索引:', index);
                    }
                }

                // 创建请求 Promise 并缓存
                const requestPromise = this._fetchTTSWithRetry(index, text);
                this.ttsRequestCache[index] = requestPromise;

                try {
                    const result = await requestPromise;
                    // 请求成功后清除缓存
                    delete this.ttsRequestCache[index];
                    delete this.ttsRequestRetries[index];
                    return result;
                } catch (error) {
                    // 请求失败后清除缓存，允许后续重试
                    delete this.ttsRequestCache[index];
                    // 保留重试次数，用于下次重试
                    return null;
                }
            },

            // 获取 TTS 请求槽位（限制并发，避免 Windows 下 stream aborted）
            async _acquireTTSSlot() {
                while (this.ttsActiveRequests >= this.ttsMaxConcurrent) {
                    await new Promise(r => setTimeout(r, 80));
                }
                this.ttsActiveRequests++;
            },
            _releaseTTSSlot() {
                this.ttsActiveRequests = Math.max(0, this.ttsActiveRequests - 1);
            },

            // 带重试机制的 TTS 请求
            async _fetchTTSWithRetry(index, text, retryCount = 0) {
                await this._acquireTTSSlot();
                try {
                    console.log('[OrderList] 请求 TTS，索引:', index, '重试次数:', retryCount, '文本:', text.substring(0, 20) + '...');

                    if (!isVoiceRuntimeAvailable()) {
                        throw new Error('electronAPI 不可用');
                    }

                    // 调用 TTS 接口
                    const result = await requestTextToSpeech(text, this.ttsSessionId);

                    // 检查结果
                    if (!result) {
                        throw new Error('TTS 接口返回空结果');
                    }

                    if (!result.success) {
                        const errorMsg = result.error || 'TTS 合成失败';
                        throw new Error(errorMsg);
                    }

                    if (!result.data || !result.data.Response || !result.data.Response.Audio) {
                        throw new Error('TTS 响应格式错误：缺少音频数据');
                    }

                    const audioBase64 = result.data.Response.Audio;

                    // 验证音频数据
                    if (!audioBase64 || typeof audioBase64 !== 'string' || audioBase64.length === 0) {
                        throw new Error('TTS 音频数据为空');
                    }

                    // 缓存音频数据
                    this.ttsAudioCache[index] = audioBase64;
                    console.log('[OrderList] ✅ TTS 请求成功，索引:', index, '音频长度:', audioBase64.length);

                    return audioBase64;

                } catch (error) {
                    const isNetworkError = error.message.includes('timeout') ||
                        error.message.includes('network') ||
                        error.message.includes('ECONNRESET') ||
                        error.message.includes('ENOTFOUND') ||
                        error.message.includes('stream has been aborted') ||
                        error.message.includes('aborted');

                    const isRetryable = isNetworkError ||
                        error.message.includes('不可用') ||
                        (retryCount < this.ttsMaxRetries);

                    // 记录重试次数
                    this.ttsRequestRetries[index] = (this.ttsRequestRetries[index] || 0) + 1;

                    if (isRetryable && retryCount < this.ttsMaxRetries) {
                        const delay = this.ttsRetryDelay * (retryCount + 1); // 指数退避
                        console.warn(`[OrderList] ⚠️ TTS 请求失败，${delay}ms 后重试，索引: ${index}, 错误:`, error.message);

                        // 等待后重试（finally 会释放槽位，重试时会重新获取）
                        await new Promise(resolve => setTimeout(resolve, delay));
                        return this._fetchTTSWithRetry(index, text, retryCount + 1);
                    } else {
                        // 达到最大重试次数或不可重试的错误
                        console.error(`[OrderList] ❌ TTS 请求最终失败，索引: ${index}, 错误:`, error.message);
                        throw error;
                    }
                } finally {
                    this._releaseTTSSlot();
                }
            },

            // 继续朗读订单（从停止的位置继续）
            // forceContinue: 父组件在选择商品后显式调用时传 true，跳过 nxDoStatus === -2 的检查
            continueReading(forceContinue = false) {
                console.log('[OrderList] 继续朗读，停止位置:', this.stoppedIndex, 'forceContinue:', forceContinue);
                console.log('[OrderList] 当前状态:', {
                    stoppedIndex: this.stoppedIndex,
                    currentTTSIndex: this.currentTTSIndex,
                    ttsQueueLength: this.ttsQueue.length,
                    orderItemsLength: this.orderItems.length
                });

                if (this.isTTSPlaying) {
                    console.log('[OrderList] 正在播放中，忽略继续请求');
                    return;
                }
                if (this.isTTSLoading) {
                    console.log('[OrderList] 正在加载中，忽略重复继续请求（避免 play 被新 load 中断）');
                    return;
                }

                // ✅ 检查停止的订单状态是否为 -2（需要确定商品），如果是则不能继续（除非 forceContinue）
                if (!forceContinue && this.stoppedIndex >= 0 && this.stoppedIndex < this.orderItems.length) {
                    const stoppedOrder = this.orderItems[this.stoppedIndex];
                    console.log('[OrderList] 停止的订单信息:', {
                        index: this.stoppedIndex,
                        goodsName: stoppedOrder?.nxDoGoodsName,
                        status: stoppedOrder?.nxDoStatus
                    });

                    if (stoppedOrder && stoppedOrder.nxDoStatus === -2) {
                        console.log('[OrderList] 停止的订单状态为 -2，需要确定商品，不能继续朗读');
                        this.showToast('当前订单需要确定商品，请先处理后再继续朗读', 'warning');
                        return;
                    }
                }

                // 如果队列为空，重新初始化
                if (this.ttsQueue.length === 0) {
                    // 重新格式化订单内容
                    // ✅ 重要：队列必须和订单一一对应，不进行过滤，保持索引一致
                    const orderTexts = this.orderItems
                        .map((item, index) => {
                            const text = this.formatOrderText(item, index + 1);
                            return text ? text.trim() : '';
                        });

                    this.ttsQueue = [...orderTexts];
                    console.log('[OrderList] 重新初始化队列，共', this.ttsQueue.length, '条，订单数量:', this.orderItems.length);

                    // 验证：队列长度应该等于订单数量
                    if (this.ttsQueue.length !== this.orderItems.length) {
                        console.error('[OrderList] ⚠️ 错误：队列长度与订单数量不匹配！', {
                            queueLength: this.ttsQueue.length,
                            orderItemsLength: this.orderItems.length
                        });
                    }
                }

                // ✅ 从停止的订单开始读（而不是从下一条开始）
                const startIndex = this.stoppedIndex >= 0 ? this.stoppedIndex : 0;

                console.log('[OrderList] 继续朗读计算:', {
                    stoppedIndex: this.stoppedIndex,
                    startIndex: startIndex,
                    ttsQueueLength: this.ttsQueue.length,
                    willPlayText: this.ttsQueue[startIndex] ? this.ttsQueue[startIndex].substring(0, 30) + '...' : 'null',
                    orderItemAtStartIndex: this.orderItems[startIndex] ? {
                        index: startIndex,
                        goodsName: this.orderItems[startIndex].nxDoGoodsName,
                        quantity: this.orderItems[startIndex].nxDoQuantity,
                        standard: this.orderItems[startIndex].nxDoStandard
                    } : 'null'
                });

                if (startIndex >= this.ttsQueue.length) {
                    console.log('[OrderList] 已到达队列末尾，无需继续');
                    this.isTTSLoading = false;
                    this.isTTSPlaying = false;
                    this.stoppedIndex = -1; // 重置停止位置
                    return;
                }

                this.currentTTSIndex = startIndex;
                this.isTTSLoading = true;
                this.isTTSPlaying = false; // 确保初始为 false
                this.ttsError = null;
                this.stoppedIndex = -1; // 重置停止位置（继续播放后清除）
                this.stoppedOrderRef = null; // 重置停止订单引用
                this.keyboardSelectedOrderIndex = -1; // 继续朗读时取消淡蓝选中状态

                // 预取当前条和下一条
                this.prefetchTTS(startIndex);
                this.prefetchTTS(startIndex + 1); // 不 await，后台预取

                // 开始播放
                this.playNextInQueue();
            },

            // 滚动到指定订单项（把订单顶到容器顶部，为下方推荐商品列表预留空间）
            scrollToOrderItem(orderIndex) {
                const orderItemEl = this.orderItemRefs[orderIndex];
                const container = this.$refs.scrollContainer;

                if (!orderItemEl) {
                    console.warn('[OrderList] 未找到订单项 DOM 元素，索引:', orderIndex);
                    return;
                }

                if (!container) {
                    console.warn('[OrderList] 未找到滚动容器');
                    return;
                }

                // 计算目标元素相对于滚动容器的位置
                const containerRect = container.getBoundingClientRect();
                const itemRect = orderItemEl.getBoundingClientRect();

                // 表头高度 + 8px，避免订单被 sticky 表头遮挡，同时为下方推荐商品列表预留空间
                const topOffsetPx = this._getScrollTopOffset();
                const scrollTop = container.scrollTop + (itemRect.top - containerRect.top) - topOffsetPx;

                container.scrollTo({
                    top: Math.max(0, scrollTop),
                    behavior: 'smooth'
                });

                console.log('[OrderList] 已滚动到订单项，索引:', orderIndex, '顶部留白:', topOffsetPx, 'px');
            },

            // 按最大长度拆分文本（兜底方案）
            splitTextByMaxLen(text, maxLen = 100) {
                const chunks = [];
                const sentences = text.split(/[，。]/).filter(s => s.trim());

                let current = '';
                for (const sentence of sentences) {
                    const trimmed = sentence.trim();
                    if (!trimmed) continue;

                    if (!current) {
                        current = trimmed;
                    } else if ((current.length + 1 + trimmed.length) <= maxLen) {
                        current += '，' + trimmed;
                    } else {
                        chunks.push(current + '。');
                        current = trimmed;
                    }
                }
                if (current) {
                    chunks.push(current + '。');
                }

                return chunks.length > 0 ? chunks : [text];
            }
        },
        props: {
            orderItems: {
                type: Array,
                default: () => []
            },
            emptyMessage: {
                type: String,
                default: '请在上传文件后，系统将自动解析订单'
            },
            addingOrderBeforeIndex: {
                type: Number,
                default: null
            },
            beforeOrderForm: {
                type: Object,
                default: () => ({})
            },
            showMatchedGoods: {
                type: Object,
                default: () => ({})
            },
            orderArrIndex: {
                type: Number,
                default: null
            },
            strArr: {
                type: Array,
                default: () => []
            },
            nxArr: {
                type: Array,
                default: () => []
            },
            isValidOrderQuantityAndStandard: {
                type: Function,
                default: () => true
            },
            sourceType: {
                type: String,
                default: '' // 上传模式：'image', 'excel', 'paste', 'auto' 等
            },
            disId: {
                type: [Number, String],
                default: null // 当前登录配送商 ID，用于在推荐/搜索商品列表中显示非当前配送商商品的来源
            }
        },
        emits: [
            'tts-state',
            'cancel-add-order-before',
            'before-order-goods-name-input',
            'before-order-goods-name-enter',
            'before-order-goods-name-keydown',
            'select-before-order-goods',
            'close-before-order-search-results',
            'download-goods-nx',
            'before-order-quantity-input',
            'before-order-standard-input',
            'before-order-remark-input',
            'save-before-order',
            'save-new-goods-from-before-order',
            'goods-name-input',
            'goods-name-focus',
            'goods-name-blur',
            'toggle-matched-goods',
            'close-all-matched-goods',
            'quantity-input',
            'standard-change',
            'update-order',
            'save-new-goods',
            'add-new-order-before',
            'delete-order',
            'remark-input',
            'select-matched-goods',
            'close-str',
            'select-search-result',
            'download-goods-nx'
        ]
    }
