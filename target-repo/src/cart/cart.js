// Shopping cart helpers. A cart is { items: [{ sku, name, price, qty }] }.
function addItem(cart, item) {
  const existing = cart.items.find((i) => i.sku === item.sku);
  if (existing) {
    return {
      ...cart,
      items: cart.items.map((i) => (i.sku === item.sku ? { ...i, qty: i.qty + (item.qty || 1) } : i)),
    };
  }
  return { ...cart, items: [...cart.items, { ...item, qty: item.qty || 1 }] };
}

function removeItem(cart, sku) {
  return { ...cart, items: cart.items.filter((i) => i.sku !== sku) };
}

function itemCount(cart) {
  return cart.items.reduce((n, i) => n + i.qty, 0);
}

function subtotal(cart) {
  return cart.items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

module.exports = { addItem, removeItem, itemCount, subtotal };
