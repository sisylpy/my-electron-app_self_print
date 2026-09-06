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
const mcpServer = read('src/mcp-server.js');
const mcpCli = read('src/mcp-server-cli.js');
const mcpPush = read('src/mcp-print-push.js');
const orderWriteGateway = read('src/order/order-write-gateway.js');
const dispatchGateway = read('src/dispatch/dispatch-gateway.js');
const placeOrder = read('vue/src/components/PlaceOrder.vue');
const historyOrders = read('vue/src/components/HistoryOrders.vue');
const publicConfig = read('vue/src/config/index.js');
const packageJson = JSON.parse(read('package.json'));
const mcpConfig = JSON.parse(read('src/mcp-config.json'));

check(!main.includes('executeJavaScript'), '主进程不执行渲染脚本文本');
check(!main.match(/\bexec\s*\(/), '主进程不通过 shell 拼接执行系统命令');
check(main.includes("const { execFile } = require('child_process')"), '系统命令使用参数数组执行');
check(!mcpServer.includes('executeJavaScript'), '内嵌 MCP 不执行渲染脚本文本');
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
check(preload.includes('salesAnalysis: Object.freeze')
  && main.includes("ipcMain.handle('sales-analysis-load-overview'")
  && dispatchGateway.includes("request('GET', 'sales-analysis/overview'")
  && !preload.includes('salesAnalysisRequest:'),
  '销售分析通过主进程只读白名单网关查询');
check(!main.includes("'mcp-call-api'"), '主进程没有任意 MCP API IPC');
check(!main.includes("'get-login-info-for-mcp'"), 'MCP 不通过脚本读取 localStorage');
check(!mcpServer.includes("Access-Control-Allow-Origin"), '内嵌 MCP 不开放 CORS');
check(!mcpCli.includes("Access-Control-Allow-Origin"), 'Stdio 打印桥不开放 CORS');
check(mcpServer.includes('Browser-origin requests are not allowed'), '内嵌 MCP 拒绝浏览器来源');
check(mcpCli.includes('Browser-origin requests are not allowed'), 'Stdio 打印桥拒绝浏览器来源');
check(mcpServer.includes('WWW-Authenticate'), '内嵌 MCP 要求 Bearer Token');
check(mcpCli.includes('WWW-Authenticate'), 'Stdio 打印桥要求 Bearer Token');
check(mcpServer.includes('PRODUCTION_BACKEND_ORIGIN'), '内嵌 MCP 限制生产后端来源');
check(
  mcpCli.includes('normalizeNongxinleApiBaseUrl'),
  'Stdio MCP 复用统一的生产后端来源校验'
);
check(main.includes('maxRedirects: 0'), 'MCP 后端请求禁止跨来源重定向');
check(mcpConfig.host === '127.0.0.1', '项目 MCP 配置只绑定 IPv4 回环地址');
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
