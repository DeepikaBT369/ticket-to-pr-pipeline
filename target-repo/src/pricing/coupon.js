// Percentage coupons. A coupon is { code, percent, expires: 'YYYY-MM-DD', minSubtotal }.
// A coupon stays valid for the whole of its expiry day (UTC).
function isCouponValid(coupon, now = new Date()) {
  if (!coupon) return false;
  if (coupon.expires && now > new Date(coupon.expires)) return false;
  return true;
}

function couponDiscount(coupon, subtotal, now = new Date()) {
  if (!isCouponValid(coupon, now)) return 0;
  if (coupon.minSubtotal && subtotal < coupon.minSubtotal) return 0;
  return Math.round(subtotal * coupon.percent) / 100;
}

module.exports = { isCouponValid, couponDiscount };
