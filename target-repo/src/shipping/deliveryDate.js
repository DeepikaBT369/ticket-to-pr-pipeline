// Estimated delivery date. Deliveries happen Monday to Friday only.
// Dates are handled in UTC so results do not depend on the server time zone.
function isWeekend(date) {
  const d = date.getUTCDay();
  return d === 0 || d === 6;
}

function addBusinessDays(start, days) {
  const result = new Date(start.getTime());
  let remaining = days;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    remaining--;
  }
  return result;
}

module.exports = { isWeekend, addBusinessDays };
