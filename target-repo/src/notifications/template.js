// Fills {{placeholders}} in a notification template, e.g.
//   renderTemplate('Hi {{name}}, order {{id}} shipped.', { name: 'Ada', id: 'ORD-1' })
// Unknown placeholders are left as they are so they are easy to spot.
function renderTemplate(template, vars) {
  let out = String(template);
  Object.keys(vars).forEach((key) => {
    out = out.replace(`{{${key}}}`, String(vars[key]));
  });
  return out;
}

function orderShippedMessage(order) {
  return renderTemplate('Hi {{name}}, your order {{id}} has shipped. Thanks, {{name}}!', {
    name: order.customerName,
    id: order.id,
  });
}

module.exports = { renderTemplate, orderShippedMessage };
