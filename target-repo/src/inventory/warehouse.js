// Picks the closest warehouse that can fill the whole order line for a sku.
function pickWarehouse(warehouses, sku, qty) {
  const candidates = warehouses.filter((w) => (w.stock[sku] || 0) >= qty);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, w) => (w.distanceKm < best.distanceKm ? w : best));
}

module.exports = { pickWarehouse };
