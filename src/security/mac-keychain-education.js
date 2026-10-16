const fs = require('fs');
const path = require('path');

const CONTINUE_URL = 'https://keychain-help.grainprint.local/continue';
const CANCEL_URL = 'https://keychain-help.grainprint.local/cancel';

function buildMacKeychainEducationHtml(appName = '粒子') {
  const safeAppName = String(appName).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; form-action https://keychain-help.grainprint.local; base-uri 'none'">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mac 系统密码说明</title>
  <style>
    :root {
      color-scheme: light;
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", Arial, sans-serif;
      color: #173b30;
      background: transparent;
    }
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
    body {
      display: flex;
      align-items: stretch;
      justify-content: stretch;
      padding: 12px;
      background: transparent;
      -webkit-user-select: none;
    }
    .card {
      width: 100%;
      min-height: 100%;
      padding: 28px 30px 24px;
      border: 1px solid rgba(17, 153, 96, .18);
      border-radius: 26px;
      background:
        radial-gradient(circle at 92% 5%, rgba(81, 211, 146, .18), transparent 27%),
        linear-gradient(145deg, #ffffff 0%, #f7fcf9 100%);
      box-shadow: 0 24px 70px rgba(17, 65, 48, .22);
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      margin-bottom: 14px;
      color: #118957;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: .06em;
    }
    .eyebrow-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #16aa6c;
      box-shadow: 0 0 0 6px rgba(22, 170, 108, .12);
    }
    .heading {
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }
    .icon {
      flex: 0 0 58px;
      width: 58px;
      height: 58px;
      display: grid;
      place-items: center;
      border-radius: 18px;
      color: white;
      background: linear-gradient(145deg, #18ad6e, #07874f);
      box-shadow: 0 12px 24px rgba(8, 135, 79, .22);
      font-size: 29px;
    }
    h1 {
      margin: 1px 0 6px;
      color: #143d31;
      font-size: 25px;
      line-height: 1.25;
      letter-spacing: -.02em;
    }
    .lead {
      margin: 0;
      color: #647b72;
      font-size: 14px;
      line-height: 1.6;
    }
    .password-box {
      margin-top: 22px;
      padding: 18px 20px;
      border: 1px solid #bfe9d3;
      border-radius: 18px;
      background: #effaf4;
    }
    .password-label {
      margin-bottom: 6px;
      color: #608174;
      font-size: 12px;
      font-weight: 700;
    }
    .password-value {
      color: #0e7147;
      font-size: 21px;
      font-weight: 800;
    }
    .password-help {
      margin-top: 5px;
      color: #60776e;
      font-size: 13px;
    }
    .not-passwords {
      display: flex;
      gap: 10px;
      margin-top: 12px;
    }
    .not-passwords span {
      flex: 1;
      padding: 10px 12px;
      border-radius: 12px;
      color: #8a5555;
      background: #fff4f3;
      font-size: 13px;
      font-weight: 650;
      text-align: center;
    }
    .steps {
      margin: 17px 0 0;
      padding: 0;
      list-style: none;
      color: #506b61;
      font-size: 13px;
      line-height: 1.55;
    }
    .steps li {
      display: flex;
      gap: 9px;
      margin-top: 7px;
    }
    .step-number {
      flex: 0 0 20px;
      width: 20px;
      height: 20px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      color: #087e4b;
      background: #dff5e9;
      font-size: 11px;
      font-weight: 800;
    }
    .privacy {
      margin: 15px 0 0;
      padding: 11px 13px;
      border-radius: 12px;
      color: #526b62;
      background: #f4f7f5;
      font-size: 12px;
      line-height: 1.5;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 20px;
    }
    form { margin: 0; }
    button {
      height: 43px;
      padding: 0 20px;
      border: 0;
      border-radius: 13px;
      font: inherit;
      font-size: 14px;
      font-weight: 750;
      cursor: pointer;
    }
    .secondary { color: #5e716a; background: #edf2ef; }
    .primary {
      min-width: 210px;
      color: #fff;
      background: linear-gradient(135deg, #19aa6d, #078950);
      box-shadow: 0 10px 20px rgba(8, 137, 80, .22);
    }
  </style>
</head>
<body>
  <main class="card" role="dialog" aria-labelledby="title" aria-describedby="description">
    <div class="eyebrow"><span class="eyebrow-dot"></span>MAC 安全提示</div>
    <div class="heading">
      <div class="icon" aria-hidden="true">🔐</div>
      <div>
        <h1 id="title">下一步请输入 Mac 系统密码</h1>
        <p class="lead" id="description">系统随后会打开一个“钥匙串”确认窗口，这是 macOS 在保护本机登录信息。</p>
      </div>
    </div>

    <section class="password-box">
      <div class="password-label">系统窗口里要输入的是</div>
      <div class="password-value">当前这台 Mac 的开机 / 登录密码</div>
      <div class="password-help">就是你平时开机或解锁这台电脑时使用的密码。</div>
      <div class="not-passwords">
        <span>不是微信密码</span>
        <span>不是农心乐账号密码</span>
      </div>
    </section>

    <ol class="steps">
      <li><span class="step-number">1</span><span>点击下方“继续”，等待 macOS 系统密码框出现。</span></li>
      <li><span class="step-number">2</span><span>输入 Mac 开机/登录密码，再点“始终允许”（推荐）或“允许”。</span></li>
      <li><span class="step-number">3</span><span>系统窗口里的“${safeAppName} Safe Storage”就是本程序的本机安全存储，属于正常提示。</span></li>
    </ol>

    <p class="privacy">🔒 密码由 macOS 系统直接验证，本程序看不到、不会读取，也不会保存你的系统密码。</p>

    <div class="actions">
      <form method="get" action="${CANCEL_URL}"><button class="secondary" type="submit">稍后再说</button></form>
      <form method="get" action="${CONTINUE_URL}"><button class="primary" type="submit">我知道了，继续输入系统密码</button></form>
    </div>
  </main>
</body>
</html>`;
}

function createMacKeychainEducation({ app, BrowserWindow, getParentWindow }) {
  let pending = null;

  function markerPath() {
    return path.join(app.getPath('userData'), 'mac-keychain-explanation.json');
  }

  function sessionPath() {
    return path.join(app.getPath('userData'), 'desktop-dispatch-session.json');
  }

  function hasCurrentMarker() {
    try {
      const marker = JSON.parse(fs.readFileSync(markerPath(), 'utf8'));
      return [1, 2].includes(marker?.version) && Boolean(marker?.confirmedAt);
    } catch {
      return false;
    }
  }

  function needsExplanation(intent = 'read') {
    if (process.platform !== 'darwin' || hasCurrentMarker()) return false;
    return intent === 'write' || fs.existsSync(sessionPath());
  }

  function writeMarker() {
    const target = markerPath();
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify({
      version: 2,
      confirmedAt: new Date().toISOString(),
    }), { encoding: 'utf8', mode: 0o600 });
    try {
      fs.chmodSync(target, 0o600);
    } catch {
      // macOS 支持 chmod；这里仅避免异常阻断后续钥匙串读取。
    }
  }

  function showEducationWindow() {
    return new Promise((resolve) => {
      const parent = getParentWindow();
      let settled = false;
      const win = new BrowserWindow({
        parent: parent && !parent.isDestroyed() ? parent : undefined,
        modal: Boolean(parent && !parent.isDestroyed()),
        show: false,
        width: 600,
        height: 590,
        useContentSize: true,
        resizable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        frame: false,
        transparent: true,
        hasShadow: true,
        skipTaskbar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          devTools: false,
        },
      });

      const finish = (accepted) => {
        if (settled) return;
        settled = true;
        if (accepted) writeMarker();
        if (!win.isDestroyed()) win.destroy();
        resolve({ ok: accepted, shown: true });
      };

      win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      win.webContents.on('will-navigate', (event, targetUrl) => {
        event.preventDefault();
        if (targetUrl === CONTINUE_URL || targetUrl.startsWith(`${CONTINUE_URL}?`)) {
          finish(true);
        } else if (targetUrl === CANCEL_URL || targetUrl.startsWith(`${CANCEL_URL}?`)) {
          finish(false);
        }
      });
      win.webContents.on('before-input-event', (_event, input) => {
        if (input.key === 'Escape') finish(false);
      });
      win.on('closed', () => finish(false));
      win.once('ready-to-show', () => {
        win.show();
        win.focus();
      });
      win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildMacKeychainEducationHtml(app.getName()))}`);
    });
  }

  async function ensure(intent = 'read') {
    if (!needsExplanation(intent)) return { ok: true, shown: false };
    if (!pending) {
      pending = showEducationWindow().finally(() => {
        pending = null;
      });
    }
    return pending;
  }

  return {
    ensure,
    needsExplanation,
  };
}

module.exports = {
  buildMacKeychainEducationHtml,
  createMacKeychainEducation,
};
