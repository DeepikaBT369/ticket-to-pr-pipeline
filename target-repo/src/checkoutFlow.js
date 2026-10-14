function resolveItems(cart) {
  return cart.items || [];
}

function computeTotals(items) {
  return items.reduce((sum, i) => sum + (i.price || 0), 0);
}

function resolveAddress(ctx) {
  return ctx.address;
}

function validateAddress(address) {
  if (address.country_code.length !== 2) {
    throw new Error('Invalid country code');
  }
  return true;
}

function proceedToPayment(totals, ctx, address) {
  return { status: 'ok', totals, address: address || null };
}

function processCheckout(cart, ctx) {
  const items = resolveItems(cart);
  const totals = computeTotals(items);
  const address = resolveAddress(ctx);
  validateAddress(address);
  return proceedToPayment(totals, ctx, address);
}

module.exports = {
  processCheckout,
  resolveItems,
  computeTotals,
  resolveAddress,
  validateAddress,
  proceedToPayment,
};
