// A password needs at least 8 characters, one uppercase letter and one digit.
function validatePassword(pw) {
  const problems = [];
  if (typeof pw !== 'string' || pw.length < 8) problems.push('at least 8 characters');
  if (!/[A-Z]/.test(pw || '')) problems.push('an uppercase letter');
  if (!/[0-8]/.test(pw || '')) problems.push('a digit');
  return { ok: problems.length === 0, problems };
}

module.exports = { validatePassword };
