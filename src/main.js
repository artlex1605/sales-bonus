/* ========================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   ======================== */

/**
 * Рассчитывает выручку по товарной позиции с учётом скидки.
 * @param {Object} purchase - строка из record.items
 * @param {Object} _product - товар из data.products (зарезервировано на будущее)
 * @returns {number} revenue
 */
function calculateSimpleRevenue(purchase, _product) {
  const { discount, sale_price, quantity } = purchase;
  const discountLeft = 1 - (discount || 0) / 100; // остаток после скидки
  return sale_price * quantity * discountLeft;
}

/**
 * Рассчитывает бонус продавца по месту в рейтинге прибыли.
 * @param {number} index - позиция продавца в отсортированном массиве (0 — первый)
 * @param {number} total - всего продавцов
 * @param {Object} seller - объект статистики продавца (содержит profit)
 * @returns {number} bonus
 */
function calculateBonusByProfit(index, total, seller) {
  const { profit } = seller;
  if (index === 0) return profit * 0.15;                 // 1-е место: 15%
  if (index === 1 || index === 2) return profit * 0.10;  // 2-е и 3-е: 10%
  if (index === total - 1) return 0;                     // последнее место: 0%
  return profit * 0.05;                                  // остальные: 5%
}

/* ========================
   ГЛАВНАЯ ФУНКЦИЯ ОТЧЁТА
   ======================== */

/**
 * Строит отчёт по продавцам.
 * @param {Object} data - источник данных (customers, products, sellers, purchase_records)
 * @param {Object} options - зависимости { calculateRevenue, calculateBonus }
 * @returns {Array} отчёт по продавцам в требуемом формате
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

  // --- Получаем зависимости
  const { calculateRevenue, calculateBonus } = options || {};
  if (!calculateRevenue || !calculateBonus) {
    throw new Error("Отсутствуют функции расчёта выручки или бонуса");
  }

  // --- Промежуточная статистика по продавцам
  const sellerStats = data.sellers.map((seller) => ({
    id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    sales_count: 0,
    products_sold: {}
  }));

  // --- Индексы для быстрого доступа
  const sellerIndex = Object.fromEntries(
    sellerStats.map((s) => [s.id, s])
  );
  const productIndex = Object.fromEntries(
    data.products.map((p) => [p.sku, p])
  );

  // --- Подсчёты по всем чекам
  data.purchase_records.forEach((record) => {
    const seller = sellerIndex[record.seller_id];
    if (!seller) return;

    // Увеличиваем количество продаж (по чекам)
    seller.sales_count += 1;

    // По каждой позиции считаем выручку и прибыль
    record.items.forEach((item) => {
      const product = productIndex[item.sku];
      if (!product) return;

      // Себестоимость
      const cost = product.purchase_price * item.quantity;

      // Выручка с учётом скидки
      const revenue = calculateRevenue(item, product);

      // Прибыль
      const profit = revenue - cost;

      // Накапливаем
      seller.revenue += revenue;
      seller.profit += profit;

      // Учёт проданных товаров
      if (!seller.products_sold[item.sku]) {
        seller.products_sold[item.sku] = 0;
      }
      seller.products_sold[item.sku] += item.quantity;
    });
  });

  // --- Сортируем продавцов по прибыли (по убыванию)
  sellerStats.sort((a, b) => b.profit - a.profit);

  // --- Назначаем бонусы и формируем топ-10 товаров
  sellerStats.forEach((seller, index) => {
    seller.bonus = calculateBonus(index, sellerStats.length, seller);

    seller.top_products = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  });

  // --- Итоговый отчёт в нужном формате
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

/* Если стартер вызывает analyzeSalesData сам — ничего не делаем.
   Если нет — можно раскомментировать пример ниже:

// const report = analyzeSalesData(data, {
//   calculateRevenue: calculateSimpleRevenue,
//   calculateBonus: calculateBonusByProfit
// });
// console.table(report);

*/

// Экспортируем в глобальную область (на случай, если стартер так ожидает)
window.calculateSimpleRevenue = calculateSimpleRevenue;
window.calculateBonusByProfit = calculateBonusByProfit;
window.analyzeSalesData = analyzeSalesData;
