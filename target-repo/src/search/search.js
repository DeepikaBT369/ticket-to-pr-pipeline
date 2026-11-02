// Ranks products for a search query: more matching words in the name ranks higher.
function rankProducts(products, query) {
  const words = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return products.slice();
  return products
    .map((p) => ({ p, score: words.filter((w) => p.name.toLowerCase().includes(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.p);
}

module.exports = { rankProducts };
