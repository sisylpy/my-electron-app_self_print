const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
let failures = 0;

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function check(condition, message) {
  if (condition) {
    console.log(`PASS ${message}`);
  } else {
    failures += 1;
    console.error(`FAIL ${message}`);
  }
}

const main = read('src/main.js');
const preload = read('src/preload.js');
const mcpBridge = read('src/mcp-bridge-client.js');
const mcpPush = read('src/mcp-print-push.js');
const orderWriteGateway = read('src/order/order-write-gateway.js');
const dispatchGateway = read('src/dispatch/dispatch-gateway.js');
const readerBridge = read('src/wechat/reader-bridge.js');
const wechatOrderSource = read('vue/src/modules/order/components/workbench/WechatOrderSource.vue');
const placeOrder = read('vue/src/components/PlaceOrder.vue');
const historyOrders = read('vue/src/components/HistoryOrders.vue');
const customerOcrTraining = read('vue/src/modules/customer/components/CustomerOcrTrainingPanel.vue');
const publicConfig = read('vue/src/config/index.js');
const packageJson = JSON.parse(read('package.json'));

check(!main.includes('executeJavaScript'), '主进程不执行渲染脚本文本');
check(!main.match(/\bexec\s*\(/), '主进程不通过 shell 拼接执行系统命令');
check(
  /const\s*\{[^}]*\bexecFile\b[^}]*\}\s*=\s*require\('child_process'\)/.test(main)
    && !main.includes('execSync('),
  '系统命令使用参数数组执行'
);
check(!mcpPush.includes('executeJavaScript'), 'MCP 打印投递仅使用 IPC');
check(!preload.match(/\bipcRenderer\s*:\s*ipcRenderer\b/), 'preload 不暴露原始 ipcRenderer');
check(!preload.includes('mcpCallApi'), 'preload 不暴露任意 MCP API 代理');
check(preload.includes('orderWrite: Object.freeze')
  && !preload.includes('orderApiRequest'), 'preload 只暴露订单写入白名单');
check(orderWriteGateway.includes("http.post('ocr/pasteSearchGoods'")
  && !orderWriteGateway.includes('input.url'), '订单写网关不能请求任意 URL');
check(preload.includes('customerHistory: Object.freeze')
  && main.includes("ipcMain.handle('customer-history-load-months'")
  && dispatchGateway.includes("request('GET', 'customer-history/months'")
  && historyOrders.includes('window.electronAPI?.customerHistory?.loadMonths'),
  '客户历史订单通过主进程白名单网关读取');
check(!historyOrders.includes('Authorization'), '客户历史订单页面不接触登录令牌');
check(preload.includes('customerOcrTraining: Object.freeze')
  && main.includes("ipcMain.handle('customer-ocr-training-create'")
  && dispatchGateway.includes("request('POST', 'customer-ocr-training/tasks'")
  && !preload.includes('customerOcrTrainingRequest:'),
  '客户OCR训练仅通过主进程固定白名单动作访问');
check(!customerOcrTraining.includes('Authorization')
  && !customerOcrTraining.includes('accessToken'),
  '客户OCR训练页面不接触安全会话令牌');
check(preload.includes('wechatReader: Object.freeze')
  && preload.includes('wechatUi: Object.freeze')
  && preload.includes('customerWechatOrders: Object.freeze')
  && main.includes("ipcMain.handle('wechat-reader-get-messages'")
  && main.includes("ipcMain.handle('wechat-ui-inspect-unread'")
  && main.includes("ipcMain.handle('wechat-ui-read-unread'")
  && main.includes("ipcMain.handle('wechat-ui-workspace-open'")
  && main.includes("ipcMain.handle('wechat-ui-workspace-close'")
  && main.includes("ipcMain.handle('customer-wechat-messages-prepare'")
  && !preload.includes('wechatReaderRequest:'),
  '微信好友订单仅通过 Reader 与业务白名单动作访问');
check(!wechatOrderSource.includes('Authorization')
  && !wechatOrderSource.includes('accessToken')
  && !wechatOrderSource.includes('WLR_'),
  '微信好友订单页面不接触令牌、Reader 路径或材料配置');
check(readerBridge.includes('严禁记录 stdout 原文')
  && !readerBridge.includes('reader stdout text=')
  && readerBridge.includes('sanitizeDiagnosticText'),
  'Reader 日志不记录 stdout 内容且会脱敏 stderr');
check(preload.includes('salesAnalysis: Object.freeze')
  && main.includes("ipcMain.handle('sales-analysis-load-overview'")
  && main.includes("ipcMain.handle('sales-analysis-load-category-customers'")
  && main.includes("ipcMain.handle('sales-analysis-load-category-customer-products'")
  && dispatchGateway.includes("request('GET', 'sales-analysis/overview'")
  && dispatchGateway.includes('sales-analysis/categories/${categoryId}/customers`')
  && dispatchGateway.includes('sales-analysis/categories/${categoryId}/customers/${customerId}/products`')
  && !preload.includes('salesAnalysisRequest:'),
  '销售分析通过主进程只读白名单网关查询');
check(!main.includes("'mcp-call-api'"), '主进程没有任意 MCP API IPC');
check(!main.includes("'get-login-info-for-mcp'"), 'MCP 不通过脚本读取 localStorage');
check(
  mcpBridge.includes("host: '127.0.0.1'")
    && mcpBridge.includes("'X-Bridge-Secret': secret")
    && mcpBridge.includes('return 3011;'),
  '统一 MCP 桥仅连接本机 3011 并使用密钥鉴权'
);
check(!main.includes("require('./mcp-server')")
  && !main.includes('127.0.0.1:3002')
  && !preload.includes('updateMcpConfig')
  && !preload.includes('setMcpSessionUser'),
  '旧 3001/3002 MCP 运行入口与渲染 IPC 已移除');
check(!placeOrder.includes('api.deepseek.com'), '下单页不直连 DeepSeek');
check(!placeOrder.includes('DEEPSEEK_API_KEY'), '下单页不读取 DeepSeek Key');
check(!/(secretId|secretKey|apiKey)\s*[:=]\s*['"][A-Za-z0-9_-]{16,}['"]/i.test(publicConfig),
  '公开渲染配置不含长期密钥');
check(
  !packageJson.build.files.some((entry) => String(entry).includes('config/**/*')),
  '安装包不包含私密 config 目录'
);
check(
  packageJson.build.files.includes('!src/main-bf.js'),
  '安装包排除历史主进程备份文件'
);

if (failures > 0) {
  console.error(`Security smoke failed: ${failures}`);
  process.exit(1);
}

console.log('Security smoke passed.');
