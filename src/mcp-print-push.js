/**
 * 将 MCP 打印任务送达渲染进程：先发 IPC，再以 executeJavaScript 后援
 * （开发环境下偶发 IPC 不入栈时，后援仍可调用 window.__grainHandleMcpPrintTask）
 */
const { Buffer } = require('buffer');

/** @param {string} atobSerialized 已 JSON.stringify 的 base64 字符串 */
function buildInjectPromiseSource(atobSerialized) {
  return (
    'new Promise(function(resolve){' +
      'function run(){' +
        'try{' +
          'var t=JSON.parse(atob(' +
          atobSerialized +
          '));' +
          "if(typeof window.__grainHandleMcpPrintTask==='function'){" +
            'window.__grainHandleMcpPrintTask(t);' +
            "resolve('ok:'+(t.taskId!=null?String(t.taskId):''));" +
          "}else{resolve('no-handler');}" +
        "}catch(e){resolve('err:'+String(e&&e.message?e.message:e));}" +
      '}' +
      'requestAnimationFrame(function(){requestAnimationFrame(run);});' +
    '});'
  );
}

function runInject(webContents, b64Raw, label) {
  const atobSerialized = JSON.stringify(b64Raw);
  const src = buildInjectPromiseSource(atobSerialized);
  return webContents
    .executeJavaScript(src, true)
    .then((ret) => {
      console.log(`[MCP] inject 后援结果(${label}):`, ret);
      return ret;
    })
    .catch((err) => {
      console.warn(`[MCP] executeJavaScript 后援异常(${label}):`, err.message);
      return 'reject:' + err.message;
    });
}

function pushMcpPrintTaskToRenderer(webContents, task) {
  if (!webContents || webContents.isDestroyed()) {
    return;
  }
  try {
    webContents.send('mcp-print-trigger', task);
  } catch (e) {
    console.warn('[MCP] webContents.send 失败:', e.message);
  }
  let b64;
  try {
    b64 = Buffer.from(JSON.stringify(task), 'utf8').toString('base64');
  } catch (e) {
    console.warn('[MCP] 任务序列化失败:', e.message);
    return;
  }
  runInject(webContents, b64, '立即').then((ret) => {
    if (String(ret) === 'no-handler') {
      setTimeout(() => {
        runInject(webContents, b64, '500ms重试');
      }, 500);
    }
  });
}

module.exports = { pushMcpPrintTaskToRenderer };
