# Excel 订单解析接口文档

## 接口概述

该接口用于解析上传的 Excel 表格文件，自动识别订单商品信息，并可选择性地自动保存订单。

**接口路径：** `/api/ocr/recognizeOrderFromExcel`  
**请求方法：** `POST`  
**Content-Type：** `multipart/form-data`

---

## 功能特点

- ✅ 支持 `.xls` 和 `.xlsx` 格式
- ✅ 支持多个 Sheet（自动遍历所有 Sheet）
- ✅ 灵活格式，无需固定模板（由 AI 智能识别）
- ✅ 不识别表头，读取所有数据行
- ✅ 自动识别商品名称、数量、规格、备注
- ✅ 可选自动保存订单（需提供部门ID和分销商ID）

---

## 请求参数

### 必填参数

| 参数名 | 类型 | 说明 |
|--------|------|------|
| `file` | MultipartFile | Excel 文件（.xls 或 .xlsx 格式） |

### 可选参数

| 参数名 | 类型 | 说明 |
|--------|------|------|
| `depId` | Integer | 部门ID。如果提供，将自动查询商品并保存订单 |
| `disId` | Integer | 分销商ID。如果提供，将自动查询商品并保存订单 |
| `depFatherId` | Integer | 部门父ID。如果不提供，将从部门信息中自动获取 |
| `userId` | Integer | 用户ID。默认为 -1 |

**注意：** 
- 如果同时提供了 `depId` 和 `disId`，系统会自动查询商品并保存订单
- 如果只提供 `file`，则仅返回解析结果，不保存订单

---

## 文件要求

- **文件格式：** `.xls` 或 `.xlsx`
- **文件大小：** 最大 10MB
- **格式要求：** 灵活格式，无需固定模板
  - 可以包含表头，也可以不包含
  - 可以包含多个 Sheet
  - 由 AI 自动识别商品信息

---

## 返回结果

### 成功响应（未提供 depId 和 disId）

仅返回解析结果，不保存订单。

```json
{
  "code": 200,
  "msg": "success",
  "excelText": "Excel读取的原始文本内容",
  "items": [
    {
      "name": "商品名称",
      "qty": "数量",
      "unit": "单位",
      "remark": "备注"
    }
  ],
  "parsedResult": "DeepSeek原始返回结果（用于调试）"
}
```

### 成功响应（提供了 depId 和 disId）

自动查询商品并保存订单，返回查询和保存结果。

```json
{
  "code": 200,
  "msg": "success",
  "data": [
    {
      "orderId": 123,
      "goodsName": "商品名称",
      "quantity": "数量",
      "standard": "规格",
      "remark": "备注",
      "status": "订单状态",
      "disGoodsId": 456,
      "matchedGoods": [
        {
          "goodsId": 789,
          "goodsName": "匹配到的商品名称",
          "standard": "规格"
        }
      ]
    }
  ]
}
```

### 错误响应

```json
{
  "code": -1,
  "msg": "错误信息"
}
```

---

## 常见错误码

| 错误信息 | 说明 | 解决方案 |
|----------|------|----------|
| `Excel文件不能为空` | 未上传文件 | 请确保上传了 Excel 文件 |
| `文件格式不支持，请上传 .xls 或 .xlsx 格式的 Excel 文件` | 文件格式不正确 | 请使用 .xls 或 .xlsx 格式 |
| `文件大小超过限制，最大支持 10MB` | 文件过大 | 请压缩文件或分批上传 |
| `Excel 文件中没有可读取的数据` | Excel 文件为空 | 请确保 Excel 文件包含数据 |
| `订单解析失败：DeepSeek 返回结果无效` | AI 解析失败 | 请检查 Excel 文件格式，确保包含商品信息 |
| `处理订单失败: xxx` | 订单保存失败 | 请检查 depId 和 disId 是否正确 |

---

## 请求示例

### JavaScript / Axios 示例

```javascript
// 仅解析，不保存订单
const formData = new FormData();
formData.append('file', fileInput.files[0]);

axios.post('/api/ocr/recognizeOrderFromExcel', formData, {
  headers: {
    'Content-Type': 'multipart/form-data'
  }
})
.then(response => {
  console.log('解析结果:', response.data);
  console.log('商品列表:', response.data.items);
})
.catch(error => {
  console.error('解析失败:', error.response.data);
});

// 解析并自动保存订单
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('depId', 123);
formData.append('disId', 456);
formData.append('userId', 789);

axios.post('/api/ocr/recognizeOrderFromExcel', formData, {
  headers: {
    'Content-Type': 'multipart/form-data'
  }
})
.then(response => {
  console.log('订单保存结果:', response.data.data);
})
.catch(error => {
  console.error('处理失败:', error.response.data);
});
```

### jQuery 示例

```javascript
// 仅解析，不保存订单
var formData = new FormData();
formData.append('file', $('#fileInput')[0].files[0]);

$.ajax({
  url: '/api/ocr/recognizeOrderFromExcel',
  type: 'POST',
  data: formData,
  processData: false,
  contentType: false,
  success: function(response) {
    console.log('解析结果:', response);
    console.log('商品列表:', response.items);
  },
  error: function(xhr) {
    console.error('解析失败:', xhr.responseJSON);
  }
});

// 解析并自动保存订单
var formData = new FormData();
formData.append('file', $('#fileInput')[0].files[0]);
formData.append('depId', 123);
formData.append('disId', 456);
formData.append('userId', 789);

$.ajax({
  url: '/api/ocr/recognizeOrderFromExcel',
  type: 'POST',
  data: formData,
  processData: false,
  contentType: false,
  success: function(response) {
    console.log('订单保存结果:', response.data);
  },
  error: function(xhr) {
    console.error('处理失败:', xhr.responseJSON);
  }
});
```

### Vue.js 示例

```vue
<template>
  <div>
    <input type="file" @change="handleFileChange" accept=".xls,.xlsx" />
    <button @click="parseExcel">解析 Excel</button>
    <button @click="parseAndSave">解析并保存订单</button>
  </div>
</template>

<script>
export default {
  data() {
    return {
      file: null,
      depId: 123,
      disId: 456,
      userId: 789
    }
  },
  methods: {
    handleFileChange(event) {
      this.file = event.target.files[0];
    },
    
    // 仅解析
    async parseExcel() {
      if (!this.file) {
        alert('请选择文件');
        return;
      }
      
      const formData = new FormData();
      formData.append('file', this.file);
      
      try {
        const response = await this.$http.post('/api/ocr/recognizeOrderFromExcel', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        
        console.log('解析结果:', response.data);
        this.$message.success('解析成功！');
      } catch (error) {
        console.error('解析失败:', error);
        this.$message.error(error.response?.data?.msg || '解析失败');
      }
    },
    
    // 解析并保存
    async parseAndSave() {
      if (!this.file) {
        alert('请选择文件');
        return;
      }
      
      const formData = new FormData();
      formData.append('file', this.file);
      formData.append('depId', this.depId);
      formData.append('disId', this.disId);
      formData.append('userId', this.userId);
      
      try {
        const response = await this.$http.post('/api/ocr/recognizeOrderFromExcel', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        
        console.log('订单保存结果:', response.data.data);
        this.$message.success('订单保存成功！');
      } catch (error) {
        console.error('处理失败:', error);
        this.$message.error(error.response?.data?.msg || '处理失败');
      }
    }
  }
}
</script>
```

### React 示例

```jsx
import React, { useState } from 'react';
import axios from 'axios';

function ExcelOrderParser() {
  const [file, setFile] = useState(null);
  const [depId, setDepId] = useState(123);
  const [disId, setDisId] = useState(456);
  const [userId, setUserId] = useState(789);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  // 仅解析
  const parseExcel = async () => {
    if (!file) {
      alert('请选择文件');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('/api/ocr/recognizeOrderFromExcel', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setResult(response.data);
      alert('解析成功！');
    } catch (error) {
      console.error('解析失败:', error);
      alert(error.response?.data?.msg || '解析失败');
    } finally {
      setLoading(false);
    }
  };

  // 解析并保存
  const parseAndSave = async () => {
    if (!file) {
      alert('请选择文件');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('depId', depId);
    formData.append('disId', disId);
    formData.append('userId', userId);

    try {
      const response = await axios.post('/api/ocr/recognizeOrderFromExcel', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setResult(response.data);
      alert('订单保存成功！');
    } catch (error) {
      console.error('处理失败:', error);
      alert(error.response?.data?.msg || '处理失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input type="file" onChange={handleFileChange} accept=".xls,.xlsx" />
      <button onClick={parseExcel} disabled={loading}>
        解析 Excel
      </button>
      <button onClick={parseAndSave} disabled={loading}>
        解析并保存订单
      </button>
      
      {result && (
        <div>
          <h3>解析结果：</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default ExcelOrderParser;
```

---

## Excel 文件格式说明

### 格式要求

- **灵活格式**：无需固定模板，支持任意格式的 Excel 文件
- **多 Sheet 支持**：可以包含多个 Sheet，系统会自动遍历所有 Sheet
- **表头处理**：可以包含表头，也可以不包含，AI 会自动识别

### 推荐格式示例

虽然不要求固定格式，但以下格式更容易被正确识别：

| 商品名称 | 数量 | 规格 | 备注 |
|---------|------|------|------|
| 苹果 | 10 | 斤 | 红富士 |
| 香蕉 | 5 | 斤 | 进口 |
| 橙子 | 8 | 斤 | 赣南脐橙 |

或者：

| 名称 | 数量 | 单位 | 说明 |
|------|------|------|------|
| 苹果 | 10 | 斤 | 红富士 |
| 香蕉 | 5 | 斤 | 进口 |

**注意：** 即使格式不完全一致，AI 也会尝试识别。建议确保 Excel 中包含商品名称、数量等信息。

---

## 注意事项

1. **文件大小限制**：单个文件最大 10MB
2. **格式支持**：仅支持 `.xls` 和 `.xlsx` 格式
3. **数据要求**：Excel 文件必须包含可读取的数据
4. **自动保存**：如果提供了 `depId` 和 `disId`，系统会自动查询商品并保存订单
5. **解析准确性**：AI 解析的准确性取决于 Excel 文件的格式和内容清晰度
6. **多 Sheet**：如果 Excel 包含多个 Sheet，所有 Sheet 的数据都会被读取和解析

---

## 与图片识别接口的对比

| 特性 | Excel 解析接口 | 图片识别接口 |
|------|---------------|-------------|
| 输入格式 | Excel 文件 | 图片 Base64 |
| 识别方式 | 直接读取单元格 | OCR 文字识别 |
| 格式要求 | 灵活格式 | 图片清晰即可 |
| 多 Sheet | ✅ 支持 | ❌ 不适用 |
| 表头处理 | AI 自动识别 | AI 自动识别 |
| 接口路径 | `/api/ocr/recognizeOrderFromExcel` | `/api/ocr/recognizeOrder` |

---

## 更新日志

- **2025-01-XX**：初始版本发布
  - 支持 Excel 文件解析
  - 支持多 Sheet
  - 支持灵活格式
  - 支持自动保存订单

---

## 技术支持

如有问题，请联系后端开发团队。

