// Stock is a plain map of sku -> units on hand.
function reserve(stock, sku, qty) {
  const have = stock[sku] || 0;
  if (qty <= 0) throw new Error('Quantity must be positive');
  if (have < qty) throw new Error(`Insufficient stock for ${sku}`);
  return { ...stock, [sku]: have - qty };
}

function release(stock, sku, qty) {
  return { ...stock, [sku]: (stock[sku] || 0) + qty };
}

function isLow(stock, sku, threshold = 5) {
  return (stock[sku] || 0) <= threshold;
}

module.exports = { reserve, release, isLow };
