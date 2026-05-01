<template>
    <div class="mb-3" style="flex-shrink: 0;">
        <div class="form-group d-flex gap-3 align-items-center flex-wrap">
            <label class="mb-0" style="cursor: pointer;">
                <input
                    type="radio"
                    :checked="modelValue === 'excel'"
                    value="excel"
                    class="me-2"
                    @change="$emit('update:modelValue', 'excel')">
                上传Excel表
            </label>
            <label class="mb-0" style="cursor: pointer;">
                <input
                    type="radio"
                    :checked="modelValue === 'image'"
                    value="image"
                    class="me-2"
                    @change="$emit('update:modelValue', 'image')">
                上传图片
            </label>
            <label class="mb-0" style="cursor: pointer;">
                <input
                    type="radio"
                    :checked="modelValue === 'paste'"
                    value="paste"
                    class="me-2"
                    @change="$emit('update:modelValue', 'paste')">
                复制粘贴
            </label>
            <label class="mb-0" style="cursor: pointer;">
                <input
                    type="radio"
                    :checked="modelValue === 'excel-paste'"
                    value="excel-paste"
                    class="me-2"
                    @change="$emit('update:modelValue', 'excel-paste')">
                📋 Excel 粘贴
            </label>
            <label class="mb-0" style="cursor: pointer;">
                <input
                    type="radio"
                    :checked="modelValue === 'auto'"
                    value="auto"
                    class="me-2"
                    @change="$emit('update:modelValue', 'auto')">
                🔄 转订单
            </label>
        </div>
    </div>
</template>

<script>
export default {
    name: 'UploadTypeSelector',
    props: {
        modelValue: {
            type: String,
            default: 'excel'
        }
    },
    emits: ['update:modelValue']
}
</script>












