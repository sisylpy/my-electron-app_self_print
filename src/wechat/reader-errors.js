class ReaderError extends Error {
  constructor(payload) {
    super(payload.message);
    this.name = 'ReaderError';
    this.payload = payload;
  }
}

function transportError(code, message, retryable = false) {
  return new ReaderError({
    code,
    message,
    retryable,
    needsReinit: false,
    needsUserAction: false,
    userAction: null,
    diagnosticId: code,
  });
}

const TRANSPORT_ERROR = Object.freeze({
  NOT_CONFIGURED: 'READER_NOT_CONFIGURED',
  START_TIMEOUT: 'READER_START_TIMEOUT',
  REQUEST_TIMEOUT: 'READER_REQUEST_TIMEOUT',
  CRASHED: 'READER_CRASHED',
  PROTOCOL_ERROR: 'READER_PROTOCOL_ERROR',
  BAD_REQUEST: 'READER_BAD_REQUEST',
  SHUTTING_DOWN: 'READER_SHUTTING_DOWN',
});

module.exports = { ReaderError, transportError, TRANSPORT_ERROR };
