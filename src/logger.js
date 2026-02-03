const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4
};

export function createLogger(level = "info") {
  const current = levels[level] ?? levels.info;
  const log = (lvl, msg, meta) => {
    if (levels[lvl] > current) return;
    const stamp = new Date().toISOString();
    if (meta) {
      // Keep meta on one line to make logs easy to scan.
      console.log(`[${stamp}] ${lvl.toUpperCase()}: ${msg} ${JSON.stringify(meta)}`);
    } else {
      console.log(`[${stamp}] ${lvl.toUpperCase()}: ${msg}`);
    }
  };

  return {
    error: (m, meta) => log("error", m, meta),
    warn: (m, meta) => log("warn", m, meta),
    info: (m, meta) => log("info", m, meta),
    debug: (m, meta) => log("debug", m, meta),
    trace: (m, meta) => log("trace", m, meta)
  };
}