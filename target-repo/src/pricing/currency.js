// Money helpers. Internally money is integer cents.
function toCents(amount) {
  return Math.round(Number(amount) * 100);
}

function formatMoney(cents, currency = 'USD') {
  const symbol = { USD: '$', EUR: '€', GBP: '£' }[currency] || `${currency} `;
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${symbol}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

function convert(cents, rate) {
  return Math.round(cents * rate);
}

module.exports = { toCents, formatMoney, convert };
