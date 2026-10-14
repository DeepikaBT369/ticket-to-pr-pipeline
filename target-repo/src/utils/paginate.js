function chunk(list, size) {
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
