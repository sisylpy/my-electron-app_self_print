/**
 * MCP CLI 服务器 (Stdio 传输)
 * 使用 stdin/stdout 进行 JSON-RPC 通信
 * 适用于 CodeBuddy、Cursor 等 MCP Client
 */

const http = require('http');

// 性能优化：移除所有调试日志输出
const DEBUG = false;
function log(...args) { if (DEBUG) console.error(...args); }

// MCP 协议常量
const MCP_VERSION = '2024-11-05';

// HTTP 服务器配置
const HTTP_PORT = 3002;
// 使用 127.0.0.1，与 Electron 主进程轮询地址一致，避免仅绑定 IPv4 时 localhost 走 ::1 连不上
const HTTP_HOST = '127.0.0.1';

// 打印任务队列（供 Electron 轮询）
let pendingPrintTasks = [];

// 创建简单的 HTTP 服务器（供 Electron 轮询打印任务）
function createHttpServer() {
  const server = http.createServer((req, res) => {
    // 设置 CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    const pathname = (req.url || '').split('?')[0];
    // GET /print-tasks - 获取待处理的打印任务
    if (req.method === 'GET' && pathname === '/print-tasks') {
      const tasks = pendingPrintTasks;
      pendingPrintTasks = [];  // 获取后清除
      res.writeHead(200);
      res.end(JSON.stringify({ tasks }));
      return;
    }
    
    // POST /print-task - 添加打印任务（由 MCP tools/call 调用）
    if (req.method === 'POST' && pathname === '/print-task') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const task = JSON.parse(body);
          pendingPrintTasks.push(task);
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, taskId: Date.now() }));
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }
    
    // GET /status - 健康检查
    if (req.method === 'GET' && pathname === '/status') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok', pendingTasks: pendingPrintTasks.length }));
      return;
    }
    
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  });
  
  server.listen(HTTP_PORT, HTTP_HOST, () => {
    log(`[MCP HTTP] 打印任务服务器运行在 http://${HTTP_HOST}:${HTTP_PORT}`);
  });
  
  return server;
}

// 启动 HTTP 服务器
let httpServer = null;

function startHttpServer() {
  if (!httpServer) {
    httpServer = createHttpServer();
  }
}

function stopHttpServer() {
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
}

// 工具定义
const MCP_TOOLS = [
  {
    name: 'get_delivery_customers',
    description:
      '获取今日有待打印配送单的 NX 客户列表。单部门（requiresPrintModeChoice=false）可直接 confirm 打印。仅 requiresPrintModeChoice=true 时须先问用户选 all / sub / 逐项打印。',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'preview_delivery_order',
    description:
      '预览配送单。单部门可直接 confirm。仅 requiresPrintModeChoice=true 时须让用户选定范围。',
    inputSchema: {
      type: 'object',
      properties: {
        department_id: { type: 'number', description: '部门ID（主客户ID）' },
        print_mode: { 
          type: 'string', 
          description: '打印模式：all=全店打印，sub=分部门打印', 
          enum: ['all', 'sub'],
          default: 'all'
        },
        sub_department_id: { type: 'number', description: '子部门ID（仅 print_mode=sub 时有效）', default: -1 }
      },
      required: ['department_id']
    }
  },
  {
    name: 'confirm_print_delivery_order',
    description:
      '确认打印：单部门可直接调用。多子部门须先问用户或逐项用 print_each_subdepartment_delivery_order。',
    inputSchema: {
      type: 'object',
      properties: {
        department_id: { type: 'number', description: '部门ID（主客户ID）' },
        print_mode: { 
          type: 'string', 
          description: '打印模式：all=全店打印，sub=分部门打印', 
          enum: ['all', 'sub'],
          default: 'all'
        },
        sub_department_id: { type: 'number', description: '子部门ID（仅 print_mode=sub 时有效）', default: -1 }
      },
      required: ['department_id']
    }
  },
  {
    name: 'print_each_subdepartment_delivery_order',
    description:
      '对同一父门店下每个子部门各入队一次打印任务（内部多次 confirm，间隔 interval_ms）。',
    inputSchema: {
      type: 'object',
      properties: {
        department_id: { type: 'number', description: '父部门 id；误传子部门 id 时会归并到所属父行' },
        interval_ms: { type: 'number', description: '两次打印间隔毫秒', default: 2800 }
      },
      required: ['department_id']
    }
  },
  {
    name: 'get_app_status',
    description: '获取应用状态和登录信息',
    inputSchema: { type: 'object', properties: {}, required: [] }
  }
];

// 应用状态（通过环境变量或命令行参数传入）
const CONFIG = {
  apiUrl: process.env.GRAIN_API_URL || 'http://192.168.0.105:8080/nongxinle_war_exploded/api/',
  disId: process.env.GRAIN_DIS_ID || null
};

/**
 * 发送 JSON-RPC 响应到 stdout
 */
function sendResponse(id, result, error = null) {
  const response = {
    jsonrpc: '2.0',
    id
  };
  
  if (error) {
    response.error = error;
  } else {
    response.result = result;
  }
  
  log('[MCP] 发送响应:', 'method', '->', id);
  console.log(JSON.stringify(response));
}

/**
 * 发送通知（无 id）
 */
function sendNotification(method, params = {}) {
  console.log(JSON.stringify({
    jsonrpc: '2.0',
    method,
    params
  }));
}

/**
 * 处理 MCP 请求
 */
async function handleRequest(request) {
  const { id, method, params = {} } = request;
  
  log('[MCP] 收到请求:', method, params);
  
  try {
    switch (method) {
      case 'initialize':
        sendResponse(id, {
          protocolVersion: MCP_VERSION,
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'grain-print-mcp',
            version: '1.0.0'
          }
        });
        break;
        
      case 'tools/list':
        sendResponse(id, {
          tools: MCP_TOOLS
        });
        break;
        
      case 'tools/call':
        const { name, arguments: args } = params;
        
        if (name === 'get_delivery_customers') {
          const result = await getDeliveryCustomers();
          sendResponse(id, {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          });
        } 
        else if (name === 'preview_delivery_order') {
          const printMode = args.print_mode || 'all';
          const result = await previewDeliveryOrder(args.department_id, printMode, args.sub_department_id);
          sendResponse(id, {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          });
        }
        else if (name === 'confirm_print_delivery_order') {
          const printMode = args.print_mode || 'all';
          const result = await confirmPrintDeliveryOrder(args.department_id, printMode, args.sub_department_id);
          sendResponse(id, {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          });
        }
        else if (name === 'print_each_subdepartment_delivery_order') {
          const result = await printEachSubdepartmentDeliveryOrder(args.department_id, args.interval_ms);
          sendResponse(id, {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          });
        }
        else if (name === 'get_app_status') {
          const result = {
            status: 'running',
            apiUrl: CONFIG.apiUrl,
            configuredDisId: CONFIG.disId,
            timestamp: new Date().toISOString()
          };
          sendResponse(id, {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          });
        }
        else {
          sendResponse(id, null, {
            code: -32601,
            message: `Unknown tool: ${name}`
          });
        }
        break;
        
      case 'ping':
        sendResponse(id, {});
        break;
        
      default:
        sendResponse(id, null, {
          code: -32601,
          message: `Method not found: ${method}`
        });
    }
  } catch (error) {
    log('[MCP] 处理请求出错:', error);
    sendResponse(id, null, {
      code: -32603,
      message: error.message
    });
  }
}

/**
 * 获取今日配送单客户列表
 * 注意：由于是独立进程，这里需要通过 HTTP API 直接调用
 */
// 缓存客户列表（60秒有效）
let customersCache = null;
let customersCacheTime = 0;
const CACHE_TTL = 60000;

/**
 * 获取配送商今日订单客户列表
 * @returns {Promise<{success: boolean, customers?: Array, total?: number, error?: string}>}
 * @example
 * // 返回结构
 * {
 *   success: true,
 *   customers: [
 *     { id: 1418, name: "客户名称", hasSubDepartments: true, orderCount: 5, totalAmount: 1234.56 },
 *     ...
 *   ],
 *   total: 10
 * }
 */
async function getDeliveryCustomers() {
  if (!CONFIG.disId) {
    return {
      success: false,
      error: '未配置配送商ID'
    };
  }
  
  // 检查缓存
  const now = Date.now();
  if (customersCache && (now - customersCacheTime) < CACHE_TTL) {
    return { success: true, customers: customersCache, total: customersCache.length, cached: true };
  }
  
  try {
    const response = await fetch(`${CONFIG.apiUrl}nxdepartmentorders/webNxDisGetTodayOrderCustomer/${CONFIG.disId}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    const items = data?.data?.nxArr || data?.nxArr || [];
    
    const customers = items
      .filter(item => item.nxDepartmentId && !item.gbDepartmentId)
      .map(item => {
        const subs = (item.nxDepartmentEntities || []).map(sub => ({
          id: sub.nxDepartmentId,
          name: sub.nxDepartmentName
        }));
        return {
          id: item.nxDepartmentId,
          name: item.nxDepartmentName,
          attrName: item.nxDepartmentAttrName || '',
          printName: item.nxDepartmentPrintName || item.nxDepartmentName,
          subAmount: item.nxDepartmentSubAmount || 0,
          subDepartments: subs,
          subDepartmentCount: subs.length,
          requiresPrintModeChoice: subs.length > 0,
          agentNote:
            subs.length > 0
              ? '有多子部门：须先让用户选择全店(all) / 单子部门(sub+id) / 逐项打印(print_each_subdepartment_delivery_order)。'
              : '无子部门：可直接 confirm_print_delivery_order（print_mode=all），无需再确认打印范围。'
        };
      });
    
    // 更新缓存
    customersCache = customers;
    customersCacheTime = now;
    
    return { success: true, customers, total: customers.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function resolveTodayListParentMeta(departmentId) {
  const list = await getDeliveryCustomers();
  if (!list.success || !Array.isArray(list.customers)) {
    return { ok: false, error: list.error || '无法获取今日客户列表' };
  }
  const want = Number(departmentId);
  if (!want || Number.isNaN(want)) {
    return { ok: false, error: 'departmentId 无效' };
  }
  for (const c of list.customers) {
    if (Number(c.id) === want) {
      const subs = c.subDepartments || [];
      return {
        ok: true,
        parentId: Number(c.id),
        parentName: c.name,
        subDepartments: subs,
        subDepartmentCount: subs.length,
        requiresPrintModeChoice: subs.length > 0,
        departmentIdMatchedSub: false
      };
    }
  }
  for (const c of list.customers) {
    const subs = c.subDepartments || [];
    const hit = subs.find((s) => Number(s.id) === want);
    if (hit) {
      return {
        ok: true,
        parentId: Number(c.id),
        parentName: c.name,
        subDepartments: subs,
        subDepartmentCount: subs.length,
        requiresPrintModeChoice: true,
        departmentIdMatchedSub: true,
        matchedSubId: want,
        matchedSubName: hit.name
      };
    }
  }
  return { ok: false, error: '今日列表中未找到该部门' };
}

async function printEachSubdepartmentDeliveryOrder(departmentId, intervalMs) {
  const meta = await resolveTodayListParentMeta(departmentId);
  if (!meta.ok) {
    return { success: false, error: meta.error };
  }
  const subs = meta.subDepartments || [];
  if (subs.length === 0) {
    return {
      success: false,
      error: '该客户无子部门，请使用 confirm_print_delivery_order（print_mode=all）',
      parentId: meta.parentId
    };
  }
  const gap = Math.max(800, Number(intervalMs) || 2800);
  const results = [];
  for (let i = 0; i < subs.length; i++) {
    const sub = subs[i];
    const sid = Number(sub.id);
    const r = await confirmPrintDeliveryOrder(meta.parentId, 'sub', sid);
    results.push({
      subDepartmentId: sid,
      subDepartmentName: sub.name,
      success: !!r.success,
      message: r.message,
      error: r.error
    });
    if (i < subs.length - 1) {
      await new Promise((res) => setTimeout(res, gap));
    }
  }
  const allOk = results.every((x) => x.success);
  return {
    success: allOk,
    parentId: meta.parentId,
    parentName: meta.parentName,
    subDepartmentCount: subs.length,
    results,
    message: allOk ? `已顺序入队 ${subs.length} 次子部门打印` : '部分子部门入队失败，见 results'
  };
}

/**
 * 预览配送单
 * @param {number} departmentId - 主客户ID（depFatherId）
 * @param {number} [subDepartmentId=-1] - 子部门ID（仅当 hasSubDepartments=true 时有效，-1 表示全部）
 * @returns {Promise<{success: boolean, departmentId?: number, departmentName?: string, hasSubDepartments?: boolean, subDepartmentCount?: number, subDepartments?: Array, totalAmount?: number, orderCount?: number, orders?: Array, error?: string}>}
 * @example
 * // 无子部门时返回
 * {
 *   success: true,
 *   departmentId: 1418,
 *   departmentName: "XX客户",
 *   hasSubDepartments: false,
 *   totalAmount: 96.0,
 *   orderCount: 2,
 *   orders: [{ goodsName, standard, quantity, price, subtotal }]
 * }
 *
 * // 有子部门时返回
 * {
 *   success: true,
 *   departmentId: 1418,
 *   departmentName: "XX客户",
 *   hasSubDepartments: true,
 *   subDepartmentCount: 2,
 *   subDepartments: [{ id, name, orderCount, subtotal }],
 *   totalAmount: 96.0,
 *   orders: [{ goodsName, standard, quantity, price, subtotal }]
 * }
 */
async function previewDeliveryOrder(departmentId, printMode = 'all', subDepartmentId = -1) {
  if (!CONFIG.disId) {
    return { success: false, error: '未配置配送商ID' };
  }
  
  try {
    // 根据打印模式确定 depId
    const depId = printMode === 'sub' && subDepartmentId > 0 ? subDepartmentId : departmentId;
    
    // 使用 URL query string 传参（后端只接受这种格式）
    const queryParams = new URLSearchParams({
      disId: CONFIG.disId,
      depFatherId: departmentId,
      depId: depId,
      gbDepFatherId: -1,
      resFatherId: -1
    }).toString();
    
    const response = await fetch(`${CONFIG.apiUrl}nxdepartmentorders/phoneGetToFillDepOrders?${queryParams}`, {
      method: 'POST'
    });
    
    const data = await response.json();
    
    if (data?.data) {
      const apiData = data.data;
      
      // 检查是否有子部门结构（arr 数组，每个元素有 depOrders）
      const arr = apiData.arr || [];
      const hasSubDepartments = arr.length > 0 && arr[0]?.hasOwnProperty('depOrders');
      
      let orders = [];
      let subDepartments = [];
      let totalAmount = 0;
      
      if (hasSubDepartments) {
        // 有子部门：遍历子部门，收集所有订单
        subDepartments = arr.map(dep => {
          const depOrders = dep.depOrders || [];
          const depSubtotal = dep.depSubtotal || depOrders.reduce((sum, o) => sum + (o.nxDepartmentOrderSubTotal || 0), 0);
          orders = orders.concat(depOrders);
          return {
            id: dep.depId,
            name: dep.depName,
            orderCount: depOrders.length,
            subtotal: depSubtotal
          };
        });
        // 使用 API 返回的 total（所有子部门的总和）
        totalAmount = parseFloat(apiData.total) || 0;
      } else {
        // 没有子部门：直接使用 nxDepartmentOrdersEntities
        orders = apiData.nxDepartmentOrdersEntities || [];
        totalAmount = orders.reduce((sum, o) => sum + (o.nxDepartmentOrderSubTotal || 0), 0);
      }
      
      const result = {
        success: true,
        departmentId,
        departmentName: apiData.nxDepartmentName || '未知',
        hasSubDepartments,
        subDepartmentCount: subDepartments.length,
        subDepartments,
        totalAmount,  // 这是正确的总额
        orderCount: orders.length,
        orders: orders.map(o => ({
          goodsName: o.nxDepartmentOrderGoodsName,
          standard: o.nxDepartmentOrderGoodsStandard,
          quantity: o.nxDepartmentOrderQuantity,
          price: o.nxDepartmentOrderPrice,
          subtotal: o.nxDepartmentOrderSubTotal
        }))
      };
      const meta = await resolveTodayListParentMeta(departmentId);
      if (meta.ok) {
        result.requiresPrintModeChoice = meta.requiresPrintModeChoice;
        result.todayListParentId = meta.parentId;
        if (meta.departmentIdMatchedSub) {
          result.note = `department_id 在今日列表中为子部门「${meta.matchedSubName}」，父 id=${meta.parentId}。`;
        }
        if (meta.requiresPrintModeChoice) {
          result.agentInstruction =
            '有多子部门：须先让用户选定 — 全店(all) / 单子部门(sub+id) / 每子部门各打(print_each_subdepartment_delivery_order)。';
        } else {
          result.agentInstruction =
            '无子部门：可直接 confirm_print_delivery_order（print_mode=all），无需再向用户确认。';
        }
      }
      return result;
    }
    
    return { success: false, error: '获取订单失败' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 确认打印配送单
 * @param {number} departmentId - 主客户ID（depFatherId）
 * @param {string} printMode - 打印模式：'all'=全店打印，'sub'=分部门打印
 * @param {number} [subDepartmentId=-1] - 子部门ID（仅当 printMode='sub' 时有效）
 * @returns {Promise<{success: boolean, departmentId?: number, departmentName?: string, tradeNo?: string, total?: number, error?: string}>}
 * @example
 * {
 *   success: true,
 *   departmentId: 1418,
 *   departmentName: "XX客户",
 *   tradeNo: "20260501120001",
 *   total: 96.0
 * }
 */
async function confirmPrintDeliveryOrder(departmentId, printMode = 'all', subDepartmentId = -1) {
  if (!CONFIG.disId) {
    return {
      success: false,
      error: '未配置配送商ID'
    };
  }
  
  try {
    // 根据打印模式确定 depId
    // printMode='all': depId = depFatherId（全店打印）
    // printMode='sub': depId = subDepartmentId（分部门打印）
    const depId = printMode === 'sub' && subDepartmentId > 0 ? subDepartmentId : departmentId;
    
    // 使用 URL query string 传参（后端只接受这种格式）
    const queryParams = new URLSearchParams({
      disId: CONFIG.disId,
      depFatherId: departmentId,
      depId: depId,
      gbDepFatherId: -1,
      resFatherId: -1
    }).toString();
    
    const response = await fetch(`${CONFIG.apiUrl}nxdepartmentorders/phoneGetToFillDepOrders?${queryParams}`, {
      method: 'POST'
    });
    
    const data = await response.json();
    
    if (data?.data) {
      const apiData = data.data;
      const resolvedSubId =
        printMode === 'sub' && Number(subDepartmentId) > 0 ? Number(subDepartmentId) : -1;
      
      // 创建打印任务
      const printTask = {
        type: 'nx_delivery',
        departmentId,
        subDepartmentId: resolvedSubId,
        printMode: printMode === 'sub' ? 'sub' : 'all',
        departmentName: apiData.nxDepartmentName || '未知',
        disId: CONFIG.disId,
        tradeNo: apiData.tradeNo || '',
        total: apiData.total || 0,
        timestamp: new Date().toISOString()
      };
      
      // 直接添加到打印任务队列（不再通过 HTTP 请求）
      printTask.taskId = Date.now();
      pendingPrintTasks.push(printTask);
      log('[MCP] 打印任务已添加到队列:', printTask.departmentName, '队列长度:', pendingPrintTasks.length);
      
      const out = {
        success: true,
        message: '打印任务已发送到 GrainPrint 应用，请检查打印机',
        departmentId,
        departmentName: apiData.nxDepartmentName,
        tradeNo: apiData.tradeNo,
        total: apiData.total,
        taskId: printTask.taskId
      };
      const meta = await resolveTodayListParentMeta(departmentId);
      if (meta.ok && meta.requiresPrintModeChoice && printMode === 'all') {
        out.workflowWarning =
          '今日列表含子部门：若用户只要某一子部门或每子部门各打一张，请确认后改用 sub 或 print_each_subdepartment_delivery_order。';
        out.todayListSubDepartments = meta.subDepartments;
      }
      return out;
    }
    
    return {
      success: false,
      error: '获取订单数据失败'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// 直接监听 stdin 数据
process.stdin.setEncoding('utf8');

let buffer = '';

process.stdin.on('data', (chunk) => {
  buffer += chunk;
  
  // 按换行符分割消息
  const lines = buffer.split('\n');
  buffer = lines.pop() || ''; // 保留最后一个不完整的行
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    try {
      const request = JSON.parse(trimmed);
      handleRequest(request);
    } catch (e) {
      log('[MCP] JSON 解析错误:', trimmed.substring(0, 100), e.message);
    }
  }
});

process.stdin.on('close', () => {
  log('[MCP] stdin 关闭');
  stopHttpServer();
  process.exit(0);
});

process.stdin.on('error', (err) => {
  log('[MCP] stdin 错误:', err);
  stopHttpServer();
  process.exit(1);
});

// 启动 HTTP 服务器（供 Electron 轮询打印任务）
startHttpServer();

// 启动提示
console.error('[MCP] GrainPrint MCP Server (Stdio) v1.0.0 已启动');
console.error('[MCP] HTTP 服务器运行在 http://127.0.0.1:3002');
console.error('[MCP] 使用 GRAIN_DIS_ID:', CONFIG.disId || '未设置');
