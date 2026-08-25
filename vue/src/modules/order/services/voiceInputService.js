function runtimeApi() {
  return typeof window !== 'undefined' ? window.electronAPI : null;
}

function requireMethod(name) {
  const api = runtimeApi();
  if (!api || typeof api[name] !== 'function') {
    throw new Error('语音服务仅在 Electron 客户端中可用');
  }
  return api[name].bind(api);
}

export function isVoiceRuntimeAvailable() {
  const api = runtimeApi();
  return Boolean(
    api
    && typeof api.startVoiceRecognition === 'function'
    && typeof api.stopVoiceRecognition === 'function'
    && typeof api.textToSpeech === 'function'
  );
}

export function startVoiceRecognition() {
  return requireMethod('startVoiceRecognition')();
}

export function stopVoiceRecognition() {
  return requireMethod('stopVoiceRecognition')();
}

export function requestTextToSpeech(text, sessionId) {
  return requireMethod('textToSpeech')(text, sessionId);
}

function subscribe(name, handler) {
  const api = runtimeApi();
  if (!api || typeof api[name] !== 'function') return () => {};
  const cleanup = api[name](handler);
  return typeof cleanup === 'function' ? cleanup : () => {};
}

export function subscribeVoiceEvents({
  onRecognitionResult,
  onRecognitionError,
  onTtsResult,
  onTtsError,
} = {}) {
  return [
    subscribe('onVoiceRecognitionResult', onRecognitionResult),
    subscribe('onVoiceRecognitionError', onRecognitionError),
    subscribe('onTTSResult', onTtsResult),
    subscribe('onTTSError', onTtsError),
  ];
}

export function disposeVoiceSubscriptions(cleanups = []) {
  cleanups.forEach((cleanup) => {
    try {
      cleanup();
    } catch (error) {
      console.warn('[VoiceInputService] 清理监听失败:', error);
    }
  });
}
