const candidateA = `function resolveItems(cart) {
  return cart.items || [];
}

function computeTotals(items) {
  return items.reduce((sum, i) => sum + (i.price || 0), 0);
}

function resolveAddress(ctx) {
  return ctx.address;
}

function validateAddress(address) {
  // Guard: if there's no address at all, skip the check.
  if (!address) return true;
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
`;

const candidateB = `function resolveItems(cart) {
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

  // Skip address validation entirely for digital-only orders.
  const requiresShipping = items.some((i) => i.requiresPhysicalDelivery);
  if (!requiresShipping) {
    return proceedToPayment(totals, ctx);
  }

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
`;

const candidateC = `function resolveItems(cart) {
  return cart.items || [];
}

function computeTotals(items) {
  return items.reduce((sum, i) => sum + (i.price || 0), 0);
}

function resolveAddress(ctx) {
  // Default to an empty address instead of undefined.
  return ctx.address || { country_code: '' };
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
`;

const discountA = `function applyDiscount(subtotal, discountAmount) {
  return Math.max(0, subtotal - discountAmount);
}

module.exports = { applyDiscount };
`;

const discountB = `function applyDiscount(subtotal, discountAmount) {
  const raw = subtotal - discountAmount;
  return raw < 0 ? 0 : raw + 1;
}

module.exports = { applyDiscount };
`;

const discountC = `function applyDiscount(subtotal, discountAmount) {
  return subtotal - discountAmount;
}

module.exports = { applyDiscount };
`;

const paginateA = `function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) {
    out.push({ items: list.slice(i, i + size) });
  }
  return out;
}

function paginate(list, page, pageSize) {
  const pages = chunk(list, pageSize);
  const target = pages[page - 1];
  return target ? target.items : [];
}

module.exports = { paginate, chunk };
`;

const paginateB = `function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) {
    out.push({ items: list.slice(i, i + size) });
  }
  return out;
}

function paginate(list, page, pageSize) {
  const pages = chunk(list, pageSize);
  const target = pages[page];
  return target ? target.items : [];
}

module.exports = { paginate, chunk };
`;

const paginateC = `function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) {
    out.push({ items: list.slice(i, i + size) });
  }
  return out;
}

function paginate(list, page, pageSize) {
  const pages = chunk(list, pageSize);
  return pages[page - 1].items;
}

module.exports = { paginate, chunk };
`;

const taxA = `function calculateTax(amount, rate) {
  return Math.round(amount * rate * 100) / 100;
}

module.exports = { calculateTax };
`;

const taxB = `function calculateTax(amount, rate) {
  return Math.floor(amount * rate * 100) / 100;
}

module.exports = { calculateTax };
`;

const taxC = `function calculateTax(amount, rate) {
  return amount * rate;
}

module.exports = { calculateTax };
`;

const emailA = `function isValidEmail(email) {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
}

module.exports = { isValidEmail };
`;

const emailB = `function isValidEmail(email) {
  return /^[A-Za-z0-9]+@[A-Za-z0-9]+\\.[A-Za-z]+$/.test(email);
}

module.exports = { isValidEmail };
`;

const emailC = `function isValidEmail(email) {
  return email.includes('@');
}

module.exports = { isValidEmail };
`;

module.exports = {
  'BUG-4821': {
    title: 'Checkout fails with TypeError when cart contains a digital product and shipping address is missing.',
    description:
      "Steps to reproduce:\n1. Add a digital product to cart\n2. Begin checkout without a saved address\n3. Click \"Proceed to payment\"\n\n" +
      "Expected: redirect to address form or show inline error\n" +
      "Actual: TypeError: Cannot read properties of undefined (reading 'country_code')\n" +
      "        at validateAddress (src/checkoutFlow.js)",
    keywords: ['address', 'checkout', 'validate', 'country_code', 'cart'],
    targetFile: 'src/checkoutFlow.js',
    testFile: 'tests/checkout.test.js',
    candidates: [
      {
        id: 'FIX-A',
        title: 'Guard clause on address access',
        description:
          'Add a guard in validateAddress() that treats a missing address as valid, skipping the country_code check entirely.',
        content: candidateA,
      },
      {
        id: 'FIX-B',
        title: 'Skip address validation for digital-only orders',
        description:
          'Detect all-digital carts in processCheckout and bypass address validation before it runs.',
        content: candidateB,
      },
      {
        id: 'FIX-C',
        title: 'Default to an empty address object',
        description:
          'Fall back to an empty address object in resolveAddress() so downstream code never sees undefined.',
        content: candidateC,
      },
    ],
  },
  'BUG-4822': {
    title: 'Total goes negative when a discount code exceeds the cart subtotal.',
    description:
      "Steps to reproduce:\n1. Add items totaling $10 to cart\n2. Apply a discount code worth $15\n3. View cart total\n\n" +
      "Expected: total floors at $0.00\n" +
      "Actual: total shows -$5.00 and flows into tax/payment calculations downstream\n" +
      "        at applyDiscount (src/pricing/discount.js)",
    keywords: ['discount', 'total', 'subtotal', 'pricing', 'negative'],
    targetFile: 'src/pricing/discount.js',
    testFile: 'tests/discount.test.js',
    candidates: [
      {
        id: 'FIX-A',
        title: 'Clamp discounted total at zero',
        description:
          'Wrap the subtraction in Math.max(0, ...) so a discount larger than the subtotal floors at zero instead of going negative.',
        content: discountA,
      },
      {
        id: 'FIX-B',
        title: 'Guard with an off-by-one adjustment',
        description:
          'Adds a zero-floor guard but adjusts the non-negative branch by +1, intended as a rounding safeguard.',
        content: discountB,
      },
      {
        id: 'FIX-C',
        title: 'No-op (unchanged)',
        description: 'Leaves the subtraction as-is; included as a baseline candidate.',
        content: discountC,
      },
    ],
  },
  'BUG-4823': {
    title: 'Dashboard crashes with TypeError when requesting a page past the last page.',
    description:
      "Steps to reproduce:\n1. Load a list with 5 items, page size 2 (3 pages total)\n2. Request page 5\n\n" +
      "Expected: returns an empty array\n" +
      "Actual: TypeError: Cannot read properties of undefined (reading 'items')\n" +
      "        at paginate (src/utils/paginate.js)",
    keywords: ['pagination', 'page', 'paginate', 'list', 'crash'],
    targetFile: 'src/utils/paginate.js',
    testFile: 'tests/paginate.test.js',
    candidates: [
      {
        id: 'FIX-A',
        title: 'Guard against a missing page',
        description:
          'Checks whether the requested page exists in the chunked list before reading .items, returning an empty array otherwise.',
        content: paginateA,
      },
      {
        id: 'FIX-B',
        title: 'Guard using the wrong index',
        description:
          'Adds a guard but indexes pages[page] instead of pages[page - 1], shifting every valid page off by one.',
        content: paginateB,
      },
      {
        id: 'FIX-C',
        title: 'No-op (unchanged)',
        description: 'Leaves the direct index access as-is; included as a baseline candidate.',
        content: paginateC,
      },
    ],
  },
  'BUG-4824': {
    title: 'Order tax shows fractions of a cent (e.g. 1.649175) instead of a rounded amount.',
    description:
      "Steps to reproduce:\n1. Add an item costing $19.99\n2. Apply 8.25% sales tax\n3. View the order summary\n\n" +
      "Expected: tax shows $1.65\n" +
      "Actual: tax shows 1.649175 and the long decimal flows into the payment total\n" +
      "        at calculateTax (src/pricing/tax.js)",
    keywords: ['tax', 'calculateTax', 'rate', 'cents', 'rounding'],
    targetFile: 'src/pricing/tax.js',
    testFile: 'tests/tax.test.js',
    candidates: [
      {
        id: 'FIX-A',
        title: 'Round tax to the nearest cent',
        description: 'Multiply by 100, round to the nearest whole number, then divide by 100 so tax always has at most 2 decimals.',
        content: taxA,
      },
      {
        id: 'FIX-B',
        title: 'Round tax down to the cent',
        description: 'Uses Math.floor instead of Math.round, so tax is always truncated rather than rounded.',
        content: taxB,
      },
      {
        id: 'FIX-C',
        title: 'No-op (unchanged)',
        description: 'Leaves the calculation as-is; included as a baseline candidate.',
        content: taxC,
      },
    ],
  },
  'BUG-4825': {
    title: 'Signup accepts invalid email addresses such as "user@" with no domain.',
    description:
      "Steps to reproduce:\n1. Open the signup form\n2. Enter the email \"user@\"\n3. Submit\n\n" +
      "Expected: form shows an \"invalid email\" error\n" +
      "Actual: the address is accepted and a confirmation email bounces\n" +
      "        at isValidEmail (src/utils/email.js)",
    keywords: ['email', 'isValidEmail', 'signup', 'validate', 'domain'],
    targetFile: 'src/utils/email.js',
    testFile: 'tests/email.test.js',
    candidates: [
      {
        id: 'FIX-A',
        title: 'Require text, an @, and a dotted domain',
        description: 'Replace the simple "@" check with a pattern requiring something before the @ and a domain with a dot after it.',
        content: emailA,
      },
      {
        id: 'FIX-B',
        title: 'Strict letters-and-digits pattern',
        description: 'Only allows letters and digits before the @, which rejects valid addresses that use + or . in the name.',
        content: emailB,
      },
      {
        id: 'FIX-C',
        title: 'No-op (unchanged)',
        description: 'Leaves the "@" check as-is; included as a baseline candidate.',
        content: emailC,
      },
    ],
  },
};
