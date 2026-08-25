/**
 * MCP HTTP 服务器模块
 * 提供配送单相关的 MCP 工具接口，供 WorkBuddy 等 MCP Client 调用
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');
const {
  PRODUCTION_API_BASE_URL,
  PRODUCTION_BACKEND_ORIGIN,
  PRODUCTION_BACKEND_PATH,
} = require('./api-runtime');

// MCP 协议常量
const MCP_VERSION = '1.0.0';

// 默认配置
const DEFAULT_CONFIG = {
  port: 3001,
  host: '127.0.0.1',
  backendUrl: PRODUCTION_API_BASE_URL
};

const MAX_REQUEST_BODY_BYTES = 1024 * 1024;
let runtimeContext = {
  getDisUser: async () => null,
  callBackendApi: async () => {
    throw new Error('MCP backend context is not configured');
  },
  sendPrintTask: () => ({ ok: false, error: 'MCP print context is not configured' })
};

async function getDisUser() {
  return runtimeContext.getDisUser();
}

async function callBackendApi(apiPath, method = 'GET', data = null) {
  return runtimeContext.callBackendApi(apiPath, method, data);
}

/**
 * MCP 工具定义
 */
const MCP_TOOLS = [
  {
    name: 'get_delivery_customers',
    description:
      '获取今日有待打印配送单的 NX 客户列表。单部门（无子部门 / requiresPrintModeChoice=false）可直接 preview、confirm 打印，不必再问用户。仅当 requiresPrintModeChoice=true（有多子部门）时须先向用户确认：全店(all)、某一子部门(sub+id) 或每子部门各打(print_each_subdepartment_delivery_order)。',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'preview_delivery_order',
    description:
      '预览配送单。单部门可直接预览并随后 confirm 打印。仅当返回 requiresPrintModeChoice=true 时须让用户选定打印范围（同 get_delivery_customers）。',
    inputSchema: {
      type: 'object',
      properties: {
        department_id: {
          type: 'number',
          description: '部门ID（父部门 nxDepartmentId / depFatherId）'
        },
        print_mode: {
          type: 'string',
          enum: ['all', 'sub'],
          description: 'all=整店；sub=仅子部门（需 sub_department_id）',
          default: 'all'
        },
        sub_department_id: {
          type: 'number',
          description: '子部门ID（仅 print_mode=sub 时有效）',
          default: -1
        }
      },
      required: ['department_id']
    }
  },
  {
    name: 'confirm_print_delivery_order',
    description:
      '确认打印：print_mode=all 为全店合并，sub+sub_department_id 为单子部门。单部门可直接调用，无需再向用户确认。仅多子部门时须先问清模式或改用 print_each_subdepartment_delivery_order。',
    inputSchema: {
      type: 'object',
      properties: {
        department_id: {
          type: 'number',
          description: '部门ID（父部门 nxDepartmentId）'
        },
        print_mode: {
          type: 'string',
          enum: ['all', 'sub'],
          description: 'all=全店；sub=子部门打印',
          default: 'all'
        },
        sub_department_id: {
          type: 'number',
          description: '子部门ID（仅 print_mode=sub 时有效）',
          default: -1
        }
      },
      required: ['department_id']
    }
  },
  {
    name: 'dispatch_delivery_print_to_app',
    description:
      '仅下发打印意图到 GrainPrint 界面（不重复请求后端）。用于已确认数据后快速触发界面打印；须已登录且客户出现在今日配送单列表中。',
    inputSchema: {
      type: 'object',
      properties: {
        department_id: { type: 'number', description: '父部门 ID（depFatherId）' },
        print_mode: {
          type: 'string',
          enum: ['all', 'sub'],
          default: 'all'
        },
        sub_department_id: { type: 'number', default: -1 },
        department_name: { type: 'string', description: '可选，用于日志展示' },
        trade_no: { type: 'string', description: '可选' }
      },
      required: ['department_id']
    }
  },
  {
    name: 'print_each_subdepartment_delivery_order',
    description:
      '同一父门店下，按子部门逐个各触发一次打印（内部多次 confirm）。仅当用户明确要求「每个子部门都打一张」时使用；须已打开 GrainPrint。',
    inputSchema: {
      type: 'object',
      properties: {
        department_id: {
          type: 'number',
          description: '父部门 ID（今日列表中该行的 nxDepartmentId）；若误传子部门 id，会尝试归并到所属父行'
        },
        interval_ms: {
          type: 'number',
          description: '两次打印之间的间隔毫秒数，避免界面未消费完上一任务',
          default: 2800
        }
      },
      required: ['department_id']
    }
  }
];

/**
 * 与 mcp-server-cli / ApplyPanel 一致：phoneGetToFillDepOrders 表单参数
 */
function buildPhoneFillBody(disId, departmentId, printMode = 'all', subDepartmentId = -1) {
  const depFatherId = departmentId;
  const depId =
    printMode === 'sub' && Number(subDepartmentId) > 0 ? Number(subDepartmentId) : departmentId;
  return {
    depFatherId,
    depId,
    gbDepFatherId: -1,
    resFatherId: -1,
    disId
  };
}

/**
 * 与 mcp-server-cli.queue / App.vue.triggerPrintDeliveryOrder 一致的任务结构（IPC: mcp-print-trigger）
 */
function buildRendererPrintTask(disUser, innerData, departmentId, printMode, subDepartmentId) {
  const d = innerData || {};
  return {
    type: 'nx_delivery',
    taskId: Date.now(),
    departmentId,
    subDepartmentId: subDepartmentId != null ? Number(subDepartmentId) : -1,
    printMode: printMode === 'sub' ? 'sub' : 'all',
    departmentName: d.nxDepartmentName || d.depName || '未知',
    disId: disUser.nxDiuDistributerId != null ? String(disUser.nxDiuDistributerId) : '',
    tradeNo: d.tradeNo || '',
    total: d.total != null ? d.total : 0,
    timestamp: new Date().toISOString()
  };
}

/** 与 ApplyPanel 一致解析 phoneGetToFillDepOrders 的 data 块 */
function extractPhoneFillInner(response) {
  if (!response || response.code !== 0 || !response.data) {
    return null;
  }
  return response.data;
}

function extractPreviewOrders(inner) {
  if (!inner) return [];
  if (Array.isArray(inner.nxDepartmentOrdersEntities) && inner.nxDepartmentOrdersEntities.length) {
    return inner.nxDepartmentOrdersEntities;
  }
  if (!Array.isArray(inner.arr) || inner.arr.length === 0) return [];
  const first = inner.arr[0];
  if (first && Array.isArray(first.depOrders)) {
    return inner.arr.flatMap((d) => d.depOrders || []);
  }
  return inner.arr;
}

function sendPrintTaskToRenderer(task) {
  const result = runtimeContext.sendPrintTask(task);
  if (result && result.ok) {
    console.log('[MCP HTTP] 已派发 mcp-print-trigger（IPC + ack）', task.taskId, task.departmentName);
  }
  return result;
}

/**
 * 处理 MCP 请求
 */
async function handleMcpRequest(body) {
  const { method, params = {}, id } = body;
  
  // 处理 initialize 请求
  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: MCP_VERSION,
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'grain-print-mcp',
          version: '1.0.0'
        }
      }
    };
  }
  
  // 处理 tools/list 请求
  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: MCP_TOOLS
      }
    };
  }
  
  // 处理 tools/call 请求
  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    
    try {
      let result;
      
      if (name === 'get_delivery_customers') {
        result = await getDeliveryCustomers();
      } else if (name === 'preview_delivery_order') {
        const printMode = args.print_mode || 'all';
        result = await previewDeliveryOrder(args.department_id, printMode, args.sub_department_id);
      } else if (name === 'confirm_print_delivery_order') {
        const printMode = args.print_mode || 'all';
        result = await confirmPrintDeliveryOrder(args.department_id, printMode, args.sub_department_id);
      } else if (name === 'dispatch_delivery_print_to_app') {
        const printMode = args.print_mode || 'all';
        result = await dispatchDeliveryPrintToApp(
          args.department_id,
          printMode,
          args.sub_department_id,
          args.department_name,
          args.trade_no
        );
      } else if (name === 'print_each_subdepartment_delivery_order') {
        result = await printEachSubdepartmentDeliveryOrder(args.department_id, args.interval_ms);
      } else {
        throw new Error(`Unknown tool: ${name}`);
      }
      
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
            }
          ]
        }
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: error.message
        }
      };
    }
  }
  
  // 处理其他请求
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code: -32601,
      message: `Method not found: ${method}`
    }
  };
}

/**
 * 获取今日配送单客户列表
 */
async function getDeliveryCustomers() {
  const disUser = await getDisUser();
  
  if (!disUser || !disUser.nxDiuDistributerId) {
    return {
      success: false,
      error: '用户未登录或登录信息不存在'
    };
  }
  
  try {
    const apiPath = `nxdepartmentorders/webNxDisGetTodayOrderCustomer/${disUser.nxDiuDistributerId}`;
    const response = await callBackendApi(apiPath);
    
    // 响应格式: {data: {nxArr: [...]}}
    const data = response && response.data;
    const items = data && (data.nxArr || data);
    
    if (items && Array.isArray(items)) {
      // 格式化返回数据，只保留 NX 类型
      const customers = items
        .filter(item => item.nxDepartmentId && !item.gbDepartmentId) // 过滤 NX 类型
        .map((item) => {
          const subs = (item.nxDepartmentEntities || []).map((sub) => ({
            id: sub.nxDepartmentId,
            name: sub.nxDepartmentName,
            attrName: sub.nxDepartmentAttrName || '',
            printName: sub.nxDepartmentPrintName || sub.nxDepartmentName
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
                ? '有多子部门：须先让用户选定 — 全店(all) / 某一子部门(sub+id) / 每子部门各一张(print_each_subdepartment_delivery_order)。'
                : '无子部门：可直接 confirm_print_delivery_order（print_mode=all），无需再确认打印范围。'
          };
        });
      
      return {
        success: true,
        customers,
        total: customers.length,
        timestamp: new Date().toISOString()
      };
    }
    
    return {
      success: false,
      error: '获取客户列表失败',
      raw: response
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 根据今日客户列表解析父门店与子部门（用于多子部门时的 MCP 工作流说明）
 */
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

/**
 * 按子部门顺序各触发一次打印（每次走 confirm，中间间隔间隔毫秒）
 */
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
      taskId: r.taskId,
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
    message: allOk ? `已顺序下发 ${subs.length} 次子部门打印` : '部分子部门下发失败，见 results'
  };
}

/**
 * 预览配送单
 */
async function previewDeliveryOrder(departmentId, printMode = 'all', subDepartmentId = -1) {
  const disUser = await getDisUser();
  if (!disUser || !disUser.nxDiuDistributerId) {
    return {
      success: false,
      error: '用户未登录或登录信息不存在'
    };
  }

  try {
    const requestData = buildPhoneFillBody(
      disUser.nxDiuDistributerId,
      departmentId,
      printMode,
      subDepartmentId
    );

    const response = await callBackendApi(
      'nxdepartmentorders/phoneGetToFillDepOrders',
      'POST',
      requestData
    );

    const inner = extractPhoneFillInner(response);
    if (inner) {
      const orders = extractPreviewOrders(inner);
      const totalAmount = orders.reduce((sum, order) => {
        return sum + (order.nxDepartmentOrderSubTotal || 0);
      }, 0);

      const html = generatePreviewHtml(inner, orders, disUser);

      const result = {
        success: true,
        departmentId,
        printMode,
        subDepartmentId,
        departmentName: inner.nxDepartmentName || inner.depName || '未知客户',
        orderCount: orders.length,
        totalAmount,
        html,
        message: '预览数据生成成功'
      };
      const meta = await resolveTodayListParentMeta(departmentId);
      if (meta.ok) {
        result.requiresPrintModeChoice = meta.requiresPrintModeChoice;
        result.subDepartments = meta.subDepartments;
        result.subDepartmentCount = meta.subDepartmentCount;
        result.todayListParentId = meta.parentId;
        if (meta.departmentIdMatchedSub) {
          result.note = `department_id 在今日列表中对应子部门「${meta.matchedSubName}」，父部门 id=${meta.parentId}；若表示全店合并请在后续调用中使用父 id。`;
        }
        if (meta.requiresPrintModeChoice) {
          result.agentInstruction =
            '有多子部门：须先让用户选定 — 全店(all) / 单个子部门(sub+id) / 每子部门各打(print_each_subdepartment_delivery_order)。';
        } else {
          result.agentInstruction =
            '无子部门：可直接调用 confirm_print_delivery_order（print_mode=all），无需再向用户确认。';
        }
      }
      return result;
    }

    return {
      success: false,
      error: '获取订单数据失败',
      raw: response
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 生成预览 HTML
 */
function generatePreviewHtml(billData, orders, disUser) {
  const customerName = billData.nxDepartmentName || '未知客户';
  const disName = disUser.nxDistributerEntity?.nxDistributerName || '配送商';
  const date = new Date().toLocaleDateString('zh-CN');
  
  let orderRows = orders.map(order => `
    <tr>
      <td>${order.nxDepartmentOrderGoodsName || '-'}</td>
      <td>${order.nxDepartmentOrderGoodsStandard || '-'}</td>
      <td>${order.nxDepartmentOrderQuantity || 0}</td>
      <td>${order.nxDepartmentOrderPrice || 0}</td>
      <td>${order.nxDepartmentOrderSubTotal || 0}</td>
    </tr>
  `).join('');
  
  const totalAmount = orders.reduce((sum, o) => sum + (o.nxDepartmentOrderSubTotal || 0), 0);
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>配送单预览 - ${customerName}</title>
  <style>
    body { font-family: 'SimHei', Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
    h2 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
    .info { margin: 20px 0; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    th { background-color: #f5f5f5; }
    .total { text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <h2>配送单</h2>
  <div class="info">
    <p><strong>客户：</strong>${customerName}</p>
    <p><strong>配送商：</strong>${disName}</p>
    <p><strong>日期：</strong>${date}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>商品名称</th>
        <th>规格</th>
        <th>数量</th>
        <th>单价</th>
        <th>小计</th>
      </tr>
    </thead>
    <tbody>
      ${orderRows}
    </tbody>
  </table>
  <div class="total">总计：¥${totalAmount.toFixed(2)}</div>
  <div class="footer">
    <p>此为预览数据，请确认后调用 confirm_print_delivery_order 进行打印</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * 不重拉后端，仅把打印意图推到渲染进程（与 CLI 队列效果一致，走同一条 Bills 消费链路）
 */
async function dispatchDeliveryPrintToApp(
  departmentId,
  printMode = 'all',
  subDepartmentId = -1,
  departmentName,
  tradeNo
) {
  const disUser = await getDisUser();
  if (!disUser || !disUser.nxDiuDistributerId) {
    return { success: false, error: '用户未登录或登录信息不存在' };
  }
  const task = {
    type: 'nx_delivery',
    taskId: Date.now(),
    departmentId,
    subDepartmentId: subDepartmentId != null ? Number(subDepartmentId) : -1,
    printMode: printMode === 'sub' ? 'sub' : 'all',
    departmentName: departmentName || '未知',
    disId: String(disUser.nxDiuDistributerId),
    tradeNo: tradeNo || '',
    total: 0,
    timestamp: new Date().toISOString()
  };
  const sent = sendPrintTaskToRenderer(task);
  if (!sent.ok) {
    return { success: false, error: sent.error };
  }
  return {
    success: true,
    message: '已通知 GrainPrint 界面执行打印，请查看应用与打印机',
    task
  };
}

/**
 * 确认打印配送单：拉单 + mcp-print-trigger
 */
async function confirmPrintDeliveryOrder(departmentId, printMode = 'all', subDepartmentId = -1) {
  const disUser = await getDisUser();
  if (!disUser || !disUser.nxDiuDistributerId) {
    return {
      success: false,
      error: '用户未登录或登录信息不存在'
    };
  }

  try {
    const requestData = buildPhoneFillBody(
      disUser.nxDiuDistributerId,
      departmentId,
      printMode,
      subDepartmentId
    );

    const response = await callBackendApi(
      'nxdepartmentorders/phoneGetToFillDepOrders',
      'POST',
      requestData
    );

    const inner = extractPhoneFillInner(response);
    if (inner) {
      const task = buildRendererPrintTask(
        disUser,
        inner,
        departmentId,
        printMode,
        subDepartmentId
      );
      const sent = sendPrintTaskToRenderer(task);
      if (!sent.ok) {
        return { success: false, error: sent.error };
      }

      const orderCount = extractPreviewOrders(inner).length;
      const out = {
        success: true,
        message: '已通知 GrainPrint 执行打印，请查看打印机',
        departmentId,
        departmentName: task.departmentName,
        orderCount,
        taskId: task.taskId
      };
      const meta = await resolveTodayListParentMeta(departmentId);
      if (meta.ok && meta.requiresPrintModeChoice) {
        out.todayListSubDepartments = meta.subDepartments;
        if (printMode === 'all') {
          out.workflowWarning =
            '该客户今日列表含子部门：若用户只要某一子部门或每个子部门各打一张，请与用户确认后改用 print_mode=sub 或工具 print_each_subdepartment_delivery_order。';
        }
      }
      return out;
    }

    return {
      success: false,
      error: '获取订单数据失败',
      raw: response
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

function isLoopbackAddress(address) {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function hasValidBearerToken(req, expectedToken) {
  const authorization = String(req.headers.authorization || '');
  const prefix = 'Bearer ';
  if (!authorization.startsWith(prefix)) return false;
  const actualToken = authorization.slice(prefix.length);
  const expected = Buffer.from(expectedToken);
  const actual = Buffer.from(actualToken);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function normalizeMcpConfig(config = {}) {
  const port = Number(config.port);
  const backendUrl = String(config.backendUrl || DEFAULT_CONFIG.backendUrl).trim();
  let parsedBackendUrl;
  try {
    parsedBackendUrl = new URL(backendUrl);
  } catch {
    throw new Error('MCP backendUrl 无效');
  }
  const isLocalHttp =
    parsedBackendUrl.protocol === 'http:' &&
    ['127.0.0.1', 'localhost', '::1'].includes(parsedBackendUrl.hostname);
  const isProductionBackend =
    parsedBackendUrl.protocol === 'https:' &&
    parsedBackendUrl.origin === PRODUCTION_BACKEND_ORIGIN &&
    parsedBackendUrl.pathname === PRODUCTION_BACKEND_PATH;
  if (!isProductionBackend && !isLocalHttp) {
    throw new Error('MCP backendUrl 只允许农心乐正式接口或本机开发地址');
  }
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('MCP 端口必须在 1024-65535 范围内');
  }
  return {
    host: '127.0.0.1',
    port,
    backendUrl: backendUrl.endsWith('/') ? backendUrl : `${backendUrl}/`
  };
}

/**
 * 创建只允许本机、非浏览器来源且带 Bearer Token 的 MCP HTTP 服务器。
 */
function createMcpServer(
  port = DEFAULT_CONFIG.port,
  host = DEFAULT_CONFIG.host,
  options = {}
) {
  const config = normalizeMcpConfig({
    port,
    host,
    backendUrl: options.backendUrl || DEFAULT_CONFIG.backendUrl
  });
  const authToken = String(options.authToken || '');
  if (authToken.length < 32) {
    throw new Error('MCP 鉴权令牌缺失或强度不足');
  }
  runtimeContext = {
    getDisUser:
      typeof options.getDisUser === 'function'
        ? options.getDisUser
        : runtimeContext.getDisUser,
    callBackendApi:
      typeof options.callBackendApi === 'function'
        ? options.callBackendApi
        : runtimeContext.callBackendApi,
    sendPrintTask:
      typeof options.sendPrintTask === 'function'
        ? options.sendPrintTask
        : runtimeContext.sendPrintTask
  };

  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');

    if (!isLoopbackAddress(req.socket.remoteAddress)) {
      res.writeHead(403);
      res.end(JSON.stringify({ error: 'Local access only' }));
      return;
    }
    if (req.headers.origin || req.headers['sec-fetch-site']) {
      res.writeHead(403);
      res.end(JSON.stringify({ error: 'Browser-origin requests are not allowed' }));
      return;
    }
    if (!hasValidBearerToken(req, authToken)) {
      res.writeHead(401, { 'WWW-Authenticate': 'Bearer' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(405);
      res.end();
      return;
    }
    
    // 处理 JSON-RPC 请求
    if (
      req.method === 'POST' &&
      String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')
    ) {
      let body = '';
      let bodyBytes = 0;
      let bodyTooLarge = false;
      req.on('data', (chunk) => {
        if (bodyTooLarge) return;
        bodyBytes += chunk.length;
        if (bodyBytes > MAX_REQUEST_BODY_BYTES) {
          bodyTooLarge = true;
          res.writeHead(413);
          res.end(JSON.stringify({ error: 'Request body too large' }));
          req.destroy();
          return;
        }
        body += chunk;
      });
      req.on('end', async () => {
        if (bodyTooLarge) return;
        try {
          const request = JSON.parse(body);
          const response = await handleMcpRequest(request);
          res.writeHead(200);
          res.end(JSON.stringify(response));
        } catch (error) {
          res.writeHead(400);
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: -32700,
              message: 'Parse error'
            }
          }));
        }
      });
      return;
    }
    
    // 返回服务信息
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200);
      res.end(JSON.stringify({
        name: 'grain-print-mcp',
        version: '1.0.0',
        status: 'running',
        tools: MCP_TOOLS.map(t => t.name)
      }));
      return;
    }
    
    res.writeHead(404);
    res.end('Not Found');
  });
  
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(config.port, config.host, () => {
      console.log(`[MCP] 服务器已启动: http://${config.host}:${config.port}`);
      resolve(server);
    });
  });
}

/**
 * 保存 MCP 配置
 */
function saveMcpConfig(config) {
  const userDataPath = app.getPath('userData');
  const configPath = path.join(userDataPath, 'mcp-config.json');
  
  try {
    const normalized = normalizeMcpConfig(config);
    fs.writeFileSync(configPath, JSON.stringify(normalized, null, 2), {
      encoding: 'utf8',
      mode: 0o600
    });
    try {
      fs.chmodSync(configPath, 0o600);
    } catch {}
    console.log('[MCP] 配置已保存到:', configPath);
    return normalized;
  } catch (error) {
    console.error('[MCP] 保存配置失败:', error);
    throw error;
  }
}

/**
 * 加载 MCP 配置
 */
function loadMcpConfig() {
  const userDataPath = app.getPath('userData');
  const configPath = path.join(userDataPath, 'mcp-config.json');
  
  try {
    if (fs.existsSync(configPath)) {
      return normalizeMcpConfig(JSON.parse(fs.readFileSync(configPath, 'utf8')));
    }
  } catch (error) {
    console.error('[MCP] 加载配置失败:', error);
  }
  
  return normalizeMcpConfig(DEFAULT_CONFIG);
}

module.exports = {
  createMcpServer,
  saveMcpConfig,
  loadMcpConfig,
  normalizeMcpConfig,
  DEFAULT_CONFIG
};
