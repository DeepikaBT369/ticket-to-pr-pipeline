const TRANSITIONS = {
  placed: ['paid', 'cancelled'],
  paid: ['shipped', 'refunded'],
  shipped: ['delivered'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

function advance(order, to) {
  if (!canTransition(order.status, to)) {
    throw new Error(`Cannot move order from ${order.status} to ${to}`);
  }
  return { ...order, status: to };
}

module.exports = { canTransition, advance };
