// Calls fn until it succeeds or the attempts run out.
async function retry(fn, attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn(i);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

module.exports = { retry };
