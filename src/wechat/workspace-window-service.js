const path = require('path');

const MIN_DOCK_WIDTH = 1280;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function computeWorkspaceLayout(workArea) {
  const area = {
    x: Math.round(Number(workArea?.x) || 0),
    y: Math.round(Number(workArea?.y) || 0),
    width: Math.round(Number(workArea?.width) || 0),
    height: Math.round(Number(workArea?.height) || 0),
  };
  if (area.width < MIN_DOCK_WIDTH || area.height < 680) {
    return { mode: 'app-only', workArea: area };
  }
  const gap = 8;
  const wechatWidth = clamp(Math.round(area.width * 0.42), 540, area.width - 760);
  return {
    mode: 'docked',
    workArea: area,
    wechat: {
      x: area.x,
      y: area.y,
      width: wechatWidth,
      height: area.height,
    },
    app: {
      x: area.x + wechatWidth + gap,
      y: area.y,
      width: area.width - wechatWidth - gap,
      height: area.height,
    },
  };
}

function parseBounds(text) {
  const values = String(text || '').trim().split(',').map(Number);
  if (values.length !== 4 || values.some(value => !Number.isFinite(value))) {
    throw new Error('无法读取微信窗口位置');
  }
  const [x, y, width, height] = values.map(Math.round);
  return { x, y, width, height };
}

function macDockArgs(bounds) {
  return [
    // `activate` only brings the process forward. When the user previously
    // closed WeChat's main window, the process stays alive with zero AX
    // windows and `activate` does not recreate it. `reopen` follows the same
    // behaviour as clicking WeChat in the Dock and restores the chat window.
    '-e', 'tell application "WeChat" to reopen',
    '-e', 'tell application "System Events" to tell process "WeChat"',
    '-e', 'set frontmost to true',
    '-e', 'repeat 30 times',
    '-e', 'if exists window "微信" then exit repeat',
    '-e', 'delay 0.1',
    '-e', 'end repeat',
    '-e', 'if not (exists window "微信") then error "WECHAT_MAIN_WINDOW_NOT_FOUND"',
    '-e', 'set targetWindow to window "微信"',
    '-e', 'set oldPosition to position of targetWindow',
    '-e', 'set oldSize to size of targetWindow',
    // WeChat applies its minimum-size constraint when the size changes. Set
    // the size first, then pin the origin again so the window cannot drift to
    // the right and end up underneath GrainPrint.
    '-e', `set size of targetWindow to {${bounds.width}, ${bounds.height}}`,
    '-e', `set position of targetWindow to {${bounds.x}, ${bounds.y}}`,
    '-e', 'delay 0.08',
    '-e', `set position of targetWindow to {${bounds.x}, ${bounds.y}}`,
    '-e', 'perform action "AXRaise" of targetWindow',
    '-e', 'return (item 1 of oldPosition as text) & "," & (item 2 of oldPosition as text) & "," & (item 1 of oldSize as text) & "," & (item 2 of oldSize as text)',
    '-e', 'end tell',
  ];
}

function macRestoreArgs(bounds) {
  return [
    '-e', 'tell application "System Events" to tell process "WeChat"',
    '-e', 'if exists window "微信" then',
    '-e', 'set targetWindow to window "微信"',
    '-e', `set size of targetWindow to {${bounds.width}, ${bounds.height}}`,
    '-e', `set position of targetWindow to {${bounds.x}, ${bounds.y}}`,
    '-e', 'end if',
    '-e', 'end tell',
  ];
}

function macConversationTitleArgs() {
  return [
    '-e', 'tell application "System Events"',
    '-e', 'if not (exists process "WeChat") then return ""',
    '-e', 'tell process "WeChat"',
    // Only observe a deliberate click inside WeChat. Reading its accessibility
    // tree while GrainPrint is active would add needless background work and
    // could mistake a programmatic transition for a user selection.
    '-e', 'if frontmost is false then return ""',
    '-e', 'if not (exists window "微信") then return ""',
    '-e', 'set rootSplit to first splitter group of first splitter group of first group of window "微信"',
    '-e', 'set chatHeader to first static text of first group of first splitter group of first group of rootSplit',
    '-e', 'return name of chatHeader as text',
    '-e', 'end tell',
    '-e', 'end tell',
  ];
}

function normalizeObservedConversationTitle(value) {
  return String(value || '')
    .trim()
    .replace(/\s*[（(]\d+[）)]\s*$/u, '')
    .trim();
}

function findSelectedConversationAvatarRect(bitmap, imageSize, windowBounds) {
  const width = Math.round(Number(imageSize?.width) || 0);
  const height = Math.round(Number(imageSize?.height) || 0);
  const windowWidth = Math.max(1, Number(windowBounds?.width) || width);
  const windowHeight = Math.max(1, Number(windowBounds?.height) || height);
  if (!Buffer.isBuffer(bitmap) || width < 240 || height < 240) return null;
  const bytesPerPixel = Math.floor(bitmap.length / (width * height));
  if (bytesPerPixel < 3) return null;

  const scaleX = width / windowWidth;
  const scaleY = height / windowHeight;
  // WeChat's left navigation and conversation list are fixed at roughly
  // 60pt and 180pt. Use those stable columns instead of a whole-window ratio,
  // because the docked chat area becomes wider on large displays.
  const listLeft = clamp(Math.round(60 * scaleX), 0, width - 1);
  const listRight = clamp(Math.round(240 * scaleX), listLeft + 1, width);
  const firstRow = clamp(Math.round(58 * scaleY), 0, height - 1);
  const lastRow = clamp(Math.round(height - (8 * scaleY)), firstRow + 1, height);
  const sampleStep = Math.max(1, Math.round(2 * scaleX));
  const sampleCount = Math.max(1, Math.floor((listRight - listLeft) / sampleStep));
  const greenThreshold = Math.max(12, Math.floor(sampleCount * 0.42));
  const selectedRows = [];

  for (let y = firstRow; y < lastRow; y += 1) {
    let greenPixels = 0;
    for (let x = listLeft; x < listRight; x += sampleStep) {
      const offset = ((y * width) + x) * bytesPerPixel;
      const channelA = bitmap[offset];
      const green = bitmap[offset + 1];
      const channelC = bitmap[offset + 2];
      if (green >= 105 && green - Math.max(channelA, channelC) >= 24) greenPixels += 1;
    }
    if (greenPixels >= greenThreshold) selectedRows.push(y);
  }
  if (!selectedRows.length) return null;

  const groups = [];
  let start = selectedRows[0];
  let previous = start;
  selectedRows.slice(1).forEach((row) => {
    if (row > previous + 1) {
      groups.push({ start, end: previous });
      start = row;
    }
    previous = row;
  });
  groups.push({ start, end: previous });

  const expectedRowHeight = 64 * scaleY;
  const selected = groups
    .map(group => ({ ...group, height: group.end - group.start + 1 }))
    .filter(group => group.height >= expectedRowHeight * 0.45)
    .sort((left, right) => (
      Math.abs(left.height - expectedRowHeight) - Math.abs(right.height - expectedRowHeight)
    ))[0];
  if (!selected) return null;

  const avatarSize = clamp(
    Math.round(Math.min(36 * scaleX, 36 * scaleY)),
    24,
    Math.min(width, height)
  );
  const centerY = Math.round((selected.start + selected.end) / 2);
  return {
    x: clamp(Math.round(72 * scaleX), 0, width - avatarSize),
    y: clamp(Math.round(centerY - (avatarSize / 2)), 0, height - avatarSize),
    width: avatarSize,
    height: avatarSize,
  };
}

function windowsScript(moduleDir) {
  return path.join(moduleDir, 'ui-automation', 'windows', 'dock-window.ps1');
}

function windowsArgs(script, mode, bounds) {
  return [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    script,
    '-Mode',
    mode,
    '-X',
    String(bounds.x),
    '-Y',
    String(bounds.y),
    '-Width',
    String(bounds.width),
    '-Height',
    String(bounds.height),
  ];
}

function createWechatWorkspaceWindowService(options = {}) {
  const platform = options.platform || process.platform;
  const moduleDir = options.moduleDir || __dirname;
  const execFileAsync = options.execFileAsync;
  const screen = options.screen;
  const desktopCapturer = options.desktopCapturer;
  const getMainWindow = options.getMainWindow;
  const powershell = options.powershell || process.env.JCYX_WECHAT_UI_POWERSHELL || 'powershell.exe';
  let session = null;
  let conversationWatcher = null;
  let conversationWatcherRunning = false;
  let conversationWatcherGeneration = 0;
  let lastConversationTitle = '';

  if (typeof execFileAsync !== 'function' || !screen || typeof getMainWindow !== 'function') {
    throw new Error('微信订单工作台窗口服务配置不完整');
  }

  async function dockWechat(bounds) {
    if (platform === 'darwin') {
      const result = await execFileAsync('osascript', macDockArgs(bounds), {
        encoding: 'utf8',
        timeout: 10000,
      });
      return parseBounds(result.stdout);
    }
    if (platform === 'win32') {
      const result = await execFileAsync(
        powershell,
        windowsArgs(windowsScript(moduleDir), 'Dock', bounds),
        { encoding: 'utf8', timeout: 10000, windowsHide: true }
      );
      return parseBounds(result.stdout);
    }
    throw new Error('当前系统暂不支持微信窗口停靠');
  }

  async function restoreWechat(bounds) {
    if (!bounds) return;
    if (platform === 'darwin') {
      await execFileAsync('osascript', macRestoreArgs(bounds), {
        encoding: 'utf8',
        timeout: 10000,
      });
      return;
    }
    if (platform === 'win32') {
      await execFileAsync(
        powershell,
        windowsArgs(windowsScript(moduleDir), 'Restore', bounds),
        { encoding: 'utf8', timeout: 10000, windowsHide: true }
      );
    }
  }

  async function captureSelectedConversationAvatar() {
    if (platform !== 'darwin'
        || !session?.wechatBounds
        || typeof desktopCapturer?.getSources !== 'function') return '';
    const bounds = session.wechatBounds;
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: {
        width: Math.max(640, Math.round(bounds.width * 2)),
        height: Math.max(640, Math.round(bounds.height * 2)),
      },
      fetchWindowIcons: false,
    });
    const source = sources.find(candidate => (
      /^(微信|WeChat)$/iu.test(String(candidate?.name || '').trim())
    )) || sources.find(candidate => /微信|WeChat/iu.test(String(candidate?.name || '')));
    const image = source?.thumbnail;
    if (!image || image.isEmpty?.()) return '';
    const size = image.getSize();
    const crop = findSelectedConversationAvatarRect(image.toBitmap(), size, bounds);
    if (!crop) return '';
    return image.crop(crop).resize({ width: 72, height: 72, quality: 'best' }).toDataURL();
  }

  function restoreMainWindow(saved) {
    const window = getMainWindow();
    if (!window || window.isDestroyed()) return;
    // The native macOS close button can arrive while Electron is transitioning
    // the workbench out of its docked state. Make the recovery explicit instead
    // of relying on `show()` to also undo a minimized window.
    if (typeof window.isMinimized === 'function'
        && window.isMinimized()
        && typeof window.restore === 'function') {
      window.restore();
    }
    if (saved.bounds) window.setBounds(saved.bounds);
    if (saved.maximized) window.maximize();
    if (saved.fullScreen) window.setFullScreen(true);
    window.show();
    window.focus();
  }

  function publishConversationTitle(title, avatarDataUrl = '') {
    const window = getMainWindow();
    if (!window || window.isDestroyed()) return;
    const webContents = window.webContents;
    if (!webContents
        || (typeof webContents.isDestroyed === 'function' && webContents.isDestroyed())) return;
    webContents.send('wechat-ui-conversation-changed', { title, avatarDataUrl });
  }

  async function observeConversationTitle(generation) {
    if (platform !== 'darwin'
        || !session
        || conversationWatcherRunning
        || generation !== conversationWatcherGeneration) return;
    const appWindow = getMainWindow();
    if (appWindow?.isFocused?.()) return;
    const observedSession = session;
    conversationWatcherRunning = true;
    try {
      const result = await execFileAsync('osascript', macConversationTitleArgs(), {
        encoding: 'utf8',
        timeout: 1500,
      });
      if (generation !== conversationWatcherGeneration || session !== observedSession) return;
      const title = normalizeObservedConversationTitle(result.stdout);
      if (!title) return;
      const conversationChanged = title !== lastConversationTitle;
      lastConversationTitle = title;
      // Re-publish the lightweight title while WeChat is frontmost. The
      // renderer can deliberately clear its selected-chat context after a
      // failed programmatic focus or a saved task; suppressing an unchanged
      // title here would then leave the two processes permanently out of sync.
      publishConversationTitle(title);
      if (!conversationChanged) return;
      const avatarDataUrl = await captureSelectedConversationAvatar();
      if (generation !== conversationWatcherGeneration
          || session !== observedSession
          || title !== lastConversationTitle
          || !avatarDataUrl) return;
      publishConversationTitle(title, avatarDataUrl);
    } catch {
      // Accessibility can be briefly unavailable while WeChat redraws. The
      // next lightweight observation will retry without interrupting the user.
    } finally {
      conversationWatcherRunning = false;
    }
  }

  function stopConversationWatcher() {
    conversationWatcherGeneration += 1;
    if (conversationWatcher) clearInterval(conversationWatcher);
    conversationWatcher = null;
    lastConversationTitle = '';
  }

  function startConversationWatcher() {
    stopConversationWatcher();
    if (platform !== 'darwin') return;
    const generation = conversationWatcherGeneration;
    conversationWatcher = setInterval(() => {
      void observeConversationTitle(generation);
    }, 450);
    conversationWatcher.unref?.();
  }

  return Object.freeze({
    captureSelectedConversationAvatar,
    isOpen() {
      return Boolean(session);
    },
    focus() {
      const window = getMainWindow();
      if (!window || window.isDestroyed()) {
        return { ok: false, error: { code: 'APP_WINDOW_MISSING', message: '订单工作台窗口不可用' } };
      }
      window.show();
      window.focus();
      return { ok: true };
    },
    async open() {
      if (session) return { ok: true, result: session.layout };
      const window = getMainWindow();
      if (!window || window.isDestroyed()) {
        return { ok: false, error: { code: 'APP_WINDOW_MISSING', message: '订单工作台窗口不可用' } };
      }
      const saved = {
        bounds: window.getBounds(),
        maximized: window.isMaximized(),
        fullScreen: window.isFullScreen(),
      };
      const display = screen.getDisplayMatching(saved.bounds);
      const layout = computeWorkspaceLayout(display?.workArea || display?.bounds);
      if (layout.mode !== 'docked') {
        // Even without enough room to dock WeChat, the order launcher is still
        // an active workspace. Track it so the native red close button returns
        // to the app home page instead of destroying the BrowserWindow.
        session = { saved, wechatBounds: null, layout };
        return {
          ok: true,
          result: { ...layout, message: '当前屏幕空间不足，微信保持为独立窗口' },
        };
      }
      try {
        if (saved.fullScreen) window.setFullScreen(false);
        if (saved.maximized) window.unmaximize();
        window.setBounds(layout.app);
        if (typeof window.showInactive === 'function') window.showInactive();
        else window.show();
        // Place the app first and WeChat last so the selected conversation can
        // be observed after docking. Once its title/avatar have been published,
        // return keyboard and mouse focus to the right-hand workbench. Without
        // this hand-off macOS consumes the user's first button click merely to
        // activate Electron, making every launcher action appear to need two
        // clicks.
        const wechatBounds = await dockWechat(layout.wechat);
        session = { saved, wechatBounds, layout };
        startConversationWatcher();
        await observeConversationTitle(conversationWatcherGeneration);
        window.show();
        window.focus();
        return { ok: true, result: layout };
      } catch (error) {
        restoreMainWindow(saved);
        return {
          ok: false,
          error: {
            code: 'WECHAT_DOCK_FAILED',
            message: /WECHAT_MAIN_WINDOW_NOT_FOUND/u.test(String(error?.stderr || error?.message || ''))
              ? '没有找到微信主窗口，请先打开已登录的微信'
              : '微信窗口停靠失败，已保留普通订单工作台',
          },
        };
      }
    },

    async close() {
      const current = session;
      stopConversationWatcher();
      session = null;
      if (!current) return { ok: true };
      let warning = '';
      try {
        await restoreWechat(current.wechatBounds);
      } catch {
        warning = '微信窗口位置未能自动恢复';
      }
      restoreMainWindow(current.saved);
      return { ok: true, warning };
    },

    async dispose() {
      await this.close();
    },
  });
}

module.exports = {
  MIN_DOCK_WIDTH,
  computeWorkspaceLayout,
  createWechatWorkspaceWindowService,
  findSelectedConversationAvatarRect,
  parseBounds,
};
