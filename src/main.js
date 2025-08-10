/**
 * Рассчитывает выручку по позиции с учётом скидки.
 * @param {Object} purchase - элемент из record.items
 * @param {Object} _product - товар из data.products (зарезервировано под расширение логики)
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
  const { discount = 0, sale_price, quantity } = purchase;
  const left = 1 - discount / 100; // доля, остающаяся после скидки
  return sale_price * quantity * left;
}

/**
 * Рассчитывает бонус продавца в зависимости от места по прибыли.
 * 1 место — 15%, 2–3 — 10%, последние — 0%, остальные — 5%.
 * @param {number} index - место в отсортированном массиве (0 — первый)
 * @param {number} total - всего продавцов
 * @param {Object} seller - объект статистики продавца (содержит profit)
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
  const { profit } = seller;
  if (index === 0) return profit * 0.15;
  if (index === 1 || index === 2) return profit * 0.10;
  if (index === total - 1) return 0;
  return profit * 0.05;
}

/**
 * Главная функция анализа данных и построения отчёта.
 * @param {Object} data - { customers, products, sellers, purchase_records }
 * @param {Object} options - { calculateRevenue, calculateBonus }
 * @returns {Array}
 */
function analyzeSalesData(data, options) {
  // --- Проверка входных данных
  if (
    !data ||
    !Array.isArray(data.sellers) || data.sellers.length === 0 ||
    !Array.isArray(data.products) || data.products.length === 0 ||
    !Array.isArray(data.purchase_records) || data.purchase_records.length === 0
  ) {
    throw new Error("Некорректные входные данные");
  }

  // --- Проверка опций / зависимостей
  const { calculateRevenue, calculateBonus } = options || {};
  if (!calculateRevenue || !calculateBonus) {
    throw new Error("Отсутствуют функции расчёта выручки или бонуса");
  }

  // --- Промежуточная структура статистики по продавцам
  const sellerStats = data.sellers.map((seller) => ({
    id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    sales_count: 0,     // количество чеков
    products_sold: {}   // агрегатор по SKU: количество
  }));

  // --- Индексы для быстрого доступа
  const sellerIndex = Object.fromEntries(sellerStats.map((s) => [s.id, s]));
  const productIndex = Object.fromEntries(data.products.map((p) => [p.sku, p]));

  // --- Обход всех чеков и позиций
  data.purchase_records.forEach((record) => {
    const seller = sellerIndex[record.seller_id];
    if (!seller) return;

    // один чек = одна продажа
    seller.sales_count += 1;

    record.items.forEach((item) => {
      const product = productIndex[item.sku];
      if (!product) return;

      const cost = product.purchase_price * item.quantity;        // себестоимость
      const revenue = calculateRevenue(item, product);             // выручка с учётом скидки
      const profit = revenue - cost;                               // прибыль

      seller.revenue += revenue;
      seller.profit += profit;

      if (!seller.products_sold[item.sku]) {
        seller.products_sold[item.sku] = 0;
      }
      seller.products_sold[item.sku] += item.quantity;
    });
  });

  // --- Сортировка продавцов по прибыли (убывание)
  sellerStats.sort((a, b) => b.profit - a.profit);

  // --- Назначение бонусов и формирование топ-10 товаров
  sellerStats.forEach((seller, index) => {
    seller.bonus = calculateBonus(index, sellerStats.length, seller);

    seller.top_products = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  });

  // --- Итоговый отчёт
  return sellerStats.map((seller) => ({
    seller_id: seller.id,
    name: seller.name,
    revenue: +seller.revenue.toFixed(2),
    profit: +seller.profit.toFixed(2),
    sales_count: seller.sales_count,
    top_products: seller.top_products,
    bonus: +seller.bonus.toFixed(2)
  }));
}

/* универсальный экспорт для браузера и Node (GitHub Actions) */
if (typeof window !== "undefined") {
  window.calculateSimpleRevenue = calculateSimpleRevenue;
  window.calculateBonusByProfit = calculateBonusByProfit;
  window.analyzeSalesData = analyzeSalesData;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    calculateSimpleRevenue,
    calculateBonusByProfit,
    analyzeSalesData,
  };
}
