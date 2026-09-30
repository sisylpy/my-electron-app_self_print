function encodeLine(value) {
  return `${JSON.stringify(value)}\n`;
}

class NdjsonFramer {
  constructor() {
    this.buffer = '';
  }

  push(chunk) {
    this.buffer += chunk;
    const frames = [];
    let newline = this.buffer.indexOf('\n');
    while (newline >= 0) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (line) {
        try {
          frames.push({ kind: 'json', value: JSON.parse(line) });
        } catch {
          frames.push({ kind: 'malformed' });
        }
      }
      newline = this.buffer.indexOf('\n');
    }
    return frames;
  }

  reset() {
    this.buffer = '';
  }
}

module.exports = { encodeLine, NdjsonFramer };
