function normalizeName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

function displayName(user) {
  const full = normalizeName(`${user.firstName || ''} ${user.lastName || ''}`);
  return full || user.email || 'Guest';
}

module.exports = { normalizeName, displayName };
