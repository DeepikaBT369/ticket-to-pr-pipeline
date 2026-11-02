function formatOrderId(n) {
  return `ORD-${String(n).padStart(6, '0')}`;
}

function parseOrderId(id) {
  const m = /^ORD-(\d{6,})$/.exec(id);
  return m ? Number(m[1]) : null;
}

module.exports = { formatOrderId, parseOrderId };
