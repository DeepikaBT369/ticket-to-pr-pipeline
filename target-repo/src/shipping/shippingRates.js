// Shipping price by parcel weight. Tiers (inclusive upper bounds):
//   up to 1 kg    -> 5.00
//   up to 5 kg    -> 9.00
//   over 5 kg     -> 15.00
function shippingRate(weightKg) {
  if (!(weightKg > 0)) throw new Error('Weight must be positive');
  if (weightKg < 1) return 5;
  if (weightKg < 5) return 9;
  return 15;
}

function shippingCost(items) {
  const total = items.reduce((w, i) => w + i.weightKg * (i.qty || 1), 0);
  return shippingRate(total);
}

module.exports = { shippingRate, shippingCost };
