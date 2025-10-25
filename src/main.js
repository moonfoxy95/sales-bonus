/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
   // @TODO: Расчет выручки от операции
	let { discount, sale_price, quantity } = purchase;
	discount = 1 - (purchase.discount / 100);
  return sale_price * quantity * discount;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    // @TODO: Расчет бонуса от позиции в рейтинге
	const { profit } = seller;

	if (index === 0) {
		let discount = 15;
    return profit * (discount / 100);
	} else if (index === 1 || index === 2) {
		let discount = 10;
			return profit * (discount / 100);
	} else if (index === total - 1) {
			return 0;
	} else { // Для всех остальных
		let discount = 5;
			return profit * (discount / 100);
	}
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
    // @TODO: Проверка входных данных
		const { calculateRevenue, calculateBonus } = options;
		if (!calculateRevenue || !calculateBonus) return;
		if (!data.sellers
			|| !data.products
			|| !data.purchase_records
		) return;

    // @TODO: Проверка наличия опций

    // @TODO: Подготовка промежуточных данных для сбора статистики
		const sellerStats = data.sellers.map(seller => ({
   		// Заполним начальными данными
			id: seller.id,
			name: `${seller.first_name} ${seller.last_name}`,
			revenue: 0,
			profit: 0, 
			sales_count: 0, 
			products_sold: {},
		}));
		

    // @TODO: Индексация продавцов и товаров для быстрого доступа
		const sellerIndex = Object.fromEntries(sellerStats.map(item => [item.id, item])); // Ключом будет id, значением — запись из sellerStats
		const productIndex = Object.fromEntries(data.products.map(item => [item.sku, item])); // Ключом будет sku, значением — запись из data.products
		
    // @TODO: Расчет выручки и прибыли для каждого продавца
		data.purchase_records.forEach(record => { // Чек 
        const seller = sellerIndex[record.seller_id]; // Продавец
				if (!seller) return;

        // Увеличить количество продаж
				seller.sales_count += 1;
        // Увеличить общую сумму всех продаж
				seller.revenue += record.total_amount;

        // Расчёт прибыли для каждого товара
        record.items.forEach(item => {
            const product = productIndex[item.sku]; // Товар
						if (!product) return;

            // Посчитать себестоимость (cost) товара как product.purchase_price, умноженную на количество товаров из чека
						let cost = product.purchase_price * item.quantity;
            // Посчитать выручку (revenue) с учётом скидки через функцию calculateRevenue
						let revenue = calculateRevenue(item, product);
            // Посчитать прибыль: выручка минус себестоимость
						let profit = revenue - cost;
        		// Увеличить общую накопленную прибыль (profit) у продавца
						seller.profit += profit;  

            // Учёт количества проданных товаров
            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            // По артикулу товара увеличить его проданное количество у продавца
						seller.products_sold[item.sku] = (seller.products_sold[item.sku] || 0) + item.quantity;
        });
    });
    // @TODO: Сортировка продавцов по прибыли
		let sellerStatsSorted = sellerStats.sort((a, b) => b.profit - a.profit);

    // @TODO: Назначение премий на основе ранжирования
		sellerStatsSorted.forEach((seller, index) => {
        seller.bonus = calculateBonus(index, sellerStatsSorted.length, seller);// Считаем бонус
        seller.top_products = Object.entries(seller.products_sold)
					.map(([sku, quantity]) => ({ sku, quantity }))// Формируем топ-10 товаров
					.sort((a, b) => b.quantity - a.quantity)
					.slice(0, 10);
		});
    // @TODO: Подготовка итоговой коллекции с нужными полями
		return sellerStatsSorted.map(seller => ({
        seller_id: seller.id, // Строка, идентификатор продавца
        name: seller.name, // Строка, имя продавца
        revenue: +(seller.revenue).toFixed(2), // Число с двумя знаками после точки, выручка продавца
        profit: +(seller.profit).toFixed(2), // Число с двумя знаками после точки, прибыль продавца
        sales_count: parseInt(seller.sales_count), // Целое число, количество продаж продавца
        top_products: seller.top_products, // Массив объектов вида: { "sku": "SKU_008","quantity": 10}, топ-10 товаров продавца
        bonus: +(seller.bonus).toFixed(2), // Число с двумя знаками после точки, бонус продавца
		}));
}

/* Вывод главной функции analyzeSalesData
[{
	seller_id: 'seller_1', // Идентификатор продавца
	name: 'Alexey Petrov', // Имя и фамилия продавца
	revenue: 123456, // Общая выручка с учётом скидок
	profit: 12345, // Прибыль от продаж продавца
	sales_count: 20, // Количество продаж
	top_products: [  // Топ-10 проданных товаров в штуках
			{
					sku: 'SKU_001', // Артикул товара
					quantity: 12, // Сколько продано
			},
	],
	bonus: 1234, // Итоговый бонус в рублях, не процент
}];
*/