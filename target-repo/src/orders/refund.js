// Refunds for an order. Amounts are in cents.
// refundedSoFar is the total already refunded on this order.
function maxRefundable(orderTotal, refundedSoFar) {
  return Math.max(0, orderTotal - refundedSoFar);
}

function partialRefund(orderTotal, refundedSoFar, requested) {
  if (requested <= 0) throw new Error('Refund amount must be positive');
  // A refund can never exceed what is still refundable on the order.
  const allowed = Math.min(requested, orderTotal);
  return { amount: allowed, totalRefunded: refundedSoFar + allowed };
}

module.exports = { maxRefundable, partialRefund };
