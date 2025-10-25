/* КЕЙС */
{
	// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ

	// группировка массива по ключу
	function groupBy(array, keyFn) {
		return array.reduce((acc, item) => {
			let key = keyFn(item);
			if (!acc[key]) acc[key] = [];
			acc[key].push(item);
			return acc;
		}, {});
	}

	// группировка данных
	{
		let recordsBySeller = groupBy(data.purchase_records, record => record.seller_id);
		let recordsByCustumer = groupBy(data.purchase_records, record => record.customer_id);
		let recordsByProduct = groupBy(data.purchase_records.flatMap(record => record.items), 
			item => item.sku);

		//console.log('recordsBySeller: ', recordsBySeller);
		//console.log('recordsByCustumer: ', recordsByCustumer);
		//console.log('recordsByProduct: ', recordsByProduct);
	}

	// вычисление среднего значения
	function calculateAverage(values) {
		let sum = values.reduce((acc, value) => acc + value, 0);
		return sum / values.length || 0;
	}

	// анализ последовательности чисел на устойчивость
	function analyzeSequence(sequence, tolerance = 0.05) {
		let trends = {
			isStable: true,
			isIncreacing: false,
			isDecreasing: false,
		};

		if (sequence.length < 2) {
			return trends;
		}

		let start = sequence[0];
		let end = sequence[sequence.length - 1];
		let totalChange = end - start;

		for (let i = 1; i < sequence.length; i++) {
			let relativeChange = Math.abs(sequence[i] -  sequence[i - 1]) / 
			Math.abs(sequence[i - 1]);
			if (relativeChange > tolerance) {
				trends.isStable = false;
				break;
			}
		}

		trends.isIncreacing = totalChange > 0;
		trends.isDecreasing = totalChange < 0;

		return trends;
	}



	// ГЛАВНЫЕ ФУНКЦИИ

	// расчет прибыли
	function simpleProfit(item, product) {
		return item.sale_price * item.quantity * (1 - item.discount / 100)
			- product.purchase_price * item.quantity;
	}

	// накопительное вычисление прибыли, выручки и других метрик
	function baseMetrics(records, calculateProfit, products) {
		return records.reduce((acc, record) => {
			let sellerId = record.seller_id;
			let customerId = record.customer_id;

			if (!acc.sellers[sellerId]) acc.sellers[sellerId] = { revenue: 0,
				profit: 0, items: [], customers: new Set() };
			if (!acc.customers[customerId]) acc.customers[customerId] = { revenue: 0,
				profit: 0, items: [], sellers: new Set() };

			record.items.forEach(item => {
				let product = products.find(p => p.sku === item.sku);
				let profit = calculateProfit(item, product);

				acc.sellers[sellerId].revenue += item.sale_price * item.quantity * 
					(1 - item.discount / 100);
				acc.sellers[sellerId].profit += profit;
				acc.sellers[sellerId].items.push(item);
				acc.sellers[sellerId].customers.add(customerId);

				acc.customers[customerId].revenue += item.sale_price * item.quantity * 
					(1 - item.discount / 100);
				acc.customers[customerId].profit += profit;
				acc.customers[customerId].sellers.add(sellerId);

				if (!acc.products[item.sku]) acc.products[item.sku] = { quantity: 0, 
					revenue: 0 };
				acc.products[item.sku].quantity += item.quantity;
				acc.products[item.sku].revenue += item.sale_price * item.quantity * 
					(1 - item.discount / 100);
			});

			return acc;
		}, { sellers: {}, customers: {}, products: {} });
	}

	//console.log(baseMetrics(data.purchase_records, simpleProfit, data.products));

	// основная функция, вычисление бонусов по спец. условиям
	function calculateSpecialBonuses(data, options, bonusFunctions) {
		let { calculateProfit, accumulateMetrics } = options;

		// группировка данных
		let recordsBySeller = groupBy(data.purchase_records, record => record.seller_id);
		let recordsByCustumer = groupBy(data.purchase_records, record => record.customer_id);
		let recordsByProduct = groupBy(data.purchase_records.flatMap(record => record.items), 
			item => item.sku);

		// накопительная статистика
		let stats = accumulateMetrics(data.purchase_records, calculateProfit, data.products);
		
		// расчет бонусов
		return bonusFunctions.map(func =>
			func({
				stats,
				recordsBySeller,
				recordsByCustumer,
				recordsByProduct,
				sellers: data.sellers,
				customers: data.customers,
				products: data.products,
				calculateProfit
			})
		);
	}



	// БОНУСЫ

	// бонус за лучшего покупателя
	function bonusBestCostumer({ stats }) {
		let bestCustomer = Object.entries(stats.customers).reduce((max, [id, data]) => 
			data.revenue > (max?.revenue || 0) ? { id, ...data } : max, null);
		//console.log('#1', bestCustomer.sellers);

		let sellerId = Array.from(bestCustomer.sellers).reduce((topSeller, sellerId) => {
			let revenue = stats.sellers[sellerId]?.revenue || 0;
			return revenue > (topSeller?.revenue || 0 ? { sellerId, revenue } : topSeller);
		}, null).sellerId;

		return {
			category: 'Best Customer Seller',
			seller_id: sellerId,
			bonus: +(bestCustomer.revenue * 0.05).toFixed(2),
		};
	}

	// бонус за лучшее удержание клиента
	function bonusCustomerRetention({ stats }) {
		let bestRetention = Object.entries(stats.sellers).reduce((best, [sellerId, data]) => {
			let customerCounts = Array.from(data.customers).map(customerId =>
				stats.customers[customerId]?.revenue || 0);
			let maxCustomerRevenue = Math.max(...customerCounts);

			return maxCustomerRevenue > (best?.revenue || 0) ? { sellerId, 
				revenue: maxCustomerRevenue } : best;
		}, null);

		return {
			category: 'Best Customer Retention',
			seller_id: bestRetention.sellerId,
			bonus: 1000,
		};
	}

	// бонус за клиента с наибольшим чеком
	function bonusLargestSingleSale({ recordsBySeller }) {
		let largestSale = Object.entries(recordsBySeller).reduce((max, [sellerId, records]) => {
			let largestRecord = records.reduce((recordMax, record) =>
				record.total_amount > (recordMax?.total_amount || 0) ? record : recordMax, null);
			return largestRecord?.total_amount > (max?.total_amount || 0) ? largestRecord : max;
			}, null);

		return {
			category: 'Largest Single Sale',
			seller_id: largestSale.seller_id,
			bonus: +(largestSale.total_amount * 0.1).toFixed(2),
		};
	}

	// бонус за наибольший средний чек
	function bonusHighestAverageProgit({ stats }) {
		let bestSeller = Object.entries(stats.sellers).reduce((max, [sellerId, data]) => {
			let avgProfit = data.profit / (data.items.length || 1);
			return avgProfit > (max?.avgProfit || 0) ? { sellerId, avgProfit } : max;
		}, null);

		return {
			category: 'Hightst Average Progit',
			seller_id: bestSeller.sellerId,
			bonus: +(bestSeller.avgProgit * 0.1).toFixed(2),
		};
	}

	// бонус за стабильный рост прибыли
	function bonusStableGrowth({ recordsBySeller, calculateProfit, products }) {
		let bestSeller = Object.entries(recordsBySeller).reduce((best, [sellerId, records]) => {
			let monthlyProfits = groupBy(records, record => record.date.slice(0, 7));
			let monthlyAverages = Object.entries(monthlyProfits)
				.sort(([a], [b]) => new Date(a) - new Date(b))
				.map(([month, records]) =>
					calculateAverage(records.flatMap(record => 
						record.items.map(item => calculateProfit(item, products.find
							(p => p.sku === item.sku)
						))
					))
				);
			let { isStable, isIncreacing } = analyzeSequence(monthlyAverages, 0.05);

			if (isStable && isIncreacing) {
				let avgProfit = calculateAvarage(monthlyAverages);
				return avgProfit > (best?.avgProfit || 0) ? { sellerId, avgProfit } : best;
			}

			return best;
		}, null);

		return {
			category: 'Stable Growth',
			seller_id: bestSeller?.sellerId,
			bonus: +(bestSeller ? bestSeller.avgProfit * 0.15 : 0).toFixed(2),
		};
	}

	// вывов
	let specialBonuses = calculateSpecialBonuses(
		data,
		{
			calculateProfit: simpleProfit,
			accumulateMetrics: baseMetrics
		},
		[
			bonusBestCostumer,
			bonusCustomerRetention,
			bonusLargestSingleSale,
			bonusHighestAverageProgit,
			bonusStableGrowth
		]
	);
	/*
	if (console.table) {
		console.log('Кейс:'); 
		console.table(specialBonuses)}
	else console.log('Кейс:\n', specialBonuses)
	*/

	/* КОНЕЦ КЕЙСА */
}


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
    return 15;
	} else if (index === 1 || index === 2) {
			return 10;
	} else if (index === total - 1) {
			return 0;
	} else { // Для всех остальных
			return 5;
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
        // Увеличить количество продаж
				seller.sales_count += 1;
        // Увеличить общую сумму всех продаж
				seller.revenue += record.total_amount;

        // Расчёт прибыли для каждого товара
        record.items.forEach(item => {
            const product = productIndex[item.sku]; // Товар
            // Посчитать себестоимость (cost) товара как product.purchase_price, умноженную на количество товаров из чека
						let cost = product.purchase_price * item.quantity;
            // Посчитать выручку (revenue) с учётом скидки через функцию calculateRevenue
						let revenue = calculateSimpleRevenue(item, product);
            // Посчитать прибыль: выручка минус себестоимость
						let profit = revenue - cost;
        		// Увеличить общую накопленную прибыль (profit) у продавца
						seller.profit += profit;  

            // Учёт количества проданных товаров
            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            // По артикулу товара увеличить его проданное количество у продавца
						seller.products_sold[item.sku] += item.quantity;
        });
    });
    // @TODO: Сортировка продавцов по прибыли
		let sellerStatsSorted = sellerStats.toSorted((a, b) => b.profit - a.profit);

    // @TODO: Назначение премий на основе ранжирования
		sellerStatsSorted.forEach((seller, index) => {
        seller.bonus = calculateBonusByProfit(index, sellerStatsSorted.length, seller);// Считаем бонус
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