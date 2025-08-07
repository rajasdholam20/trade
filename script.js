document.addEventListener('DOMContentLoaded', () => {

    // --- 1. STATE MANAGEMENT ---
    // A single, unified state for the entire application
    const state = {
        stocks: {},
        portfolio: {
            baseCapital: 100000,
            availableFunds: 100000,
            holdings: {},
            orders: [],
        },
        ui: {
            activeModule: 'watchlist',
            activeTrade: { symbol: null, type: 'BUY' },
            activeChart: { symbol: null },
            isDark: false
        },
        charts: {} // To hold all chart instances (sector, trade, detailed)
    };

    // --- 2. DATA INITIALIZATION ---
    // Using the more detailed data generation function
    function generateMockStockData(symbol, basePrice, sector) {
        const data = {
            symbol: symbol,
            sector: sector,
            price: basePrice,
            open: basePrice * (1 + (Math.random() - 0.5) * 0.02),
            high: basePrice * (1 + Math.random() * 0.03),
            low: basePrice * (1 - Math.random() * 0.03),
            volume: Math.floor(Math.random() * 2000000) + 500000,
            change: (Math.random() - 0.45) * 5,
            minuteData: [] // This will be used for all charts
        };

        let currentPrice = basePrice;
        const now = new Date();
        // Generate data for 5 days * 8 hours * 60 minutes
        for (let i = 5 * 8 * 60; i > 0; i--) {
            const timestamp = new Date(now.getTime() - i * 60000); // Subtract i minutes
            const open = currentPrice;
            const close = open * (1 + (Math.random() - 0.5) * 0.0005);
            const high = Math.max(open, close) * (1 + Math.random() * 0.0002);
            const low = Math.min(open, close) * (1 - Math.random() * 0.0002);
            const volume = Math.floor(Math.random() * 10000) + 1000;
            data.minuteData.push({ t: timestamp.getTime(), o: open, h: high, l: low, c: close, v: volume });
            currentPrice = close;
        }
        // Update final price and day's high/low from the generated data
        data.price = data.minuteData[data.minuteData.length - 1].c;
        data.high = Math.max(...data.minuteData.map(d => d.h));
        data.changePercent = (data.price / basePrice - 1) * 100;
        data.low = Math.min(...data.minuteData.map(d => d.l));
        return data;
    }

    function initializeData() {
        const stockList = [
            { symbol: 'GOOGL', basePrice: 175.50, sector: 'Technology' },
            { symbol: 'AAPL', basePrice: 214.20, sector: 'Technology' },
            { symbol: 'MSFT', basePrice: 447.60, sector: 'Technology' },
            { symbol: 'TSLA', basePrice: 183.00, sector: 'Automotive' },
            { symbol: 'IBM', basePrice: 170.60, sector: 'Technology' },
            { symbol: 'WMT', basePrice: 67.20, sector: 'Retail' },
            { symbol: 'AMZN', basePrice: 185.50, sector: 'E-commerce' }
        ];
        stockList.forEach(stock => {
            state.stocks[stock.symbol] = generateMockStockData(stock.symbol, stock.basePrice, stock.sector);
        });
    }

    // --- 3. UI RENDERING FUNCTIONS ---
    function renderAll() {
        renderWatchlist();
        renderOrders();
        renderPortfolio();
    }

    function renderWatchlist() {
        const tableBody = document.querySelector('#watchlist-table tbody');
        tableBody.innerHTML = '';
        Object.values(state.stocks).forEach(stock => {
            const lastClose = stock.minuteData[stock.minuteData.length - 2].c;
            const currentPrice = stock.price;
            const change = currentPrice - lastClose;
            const changePercent = (change / lastClose) * 100;
            const changeClass = change >= 0 ? 'profit' : 'loss';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${stock.symbol}</td>
                <td>₹${currentPrice.toFixed(2)}</td>
                <td class="${changeClass}">${change.toFixed(2)} (${changePercent.toFixed(2)}%)</td>
                <td>₹${stock.high.toFixed(2)}</td>
                <td>₹${stock.low.toFixed(2)}</td>
                <td>
                    <button class="btn btn-buy" data-symbol="${stock.symbol}">BUY</button>
                    <button class="btn btn-sell" data-symbol="${stock.symbol}">SELL</button>
                    <button class="btn btn-chart" data-symbol="${stock.symbol}">CHART</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    function renderOrders() {
        const tableBody = document.querySelector('#orders-table tbody');
        tableBody.innerHTML = '';
        const stockFilter = document.getElementById('order-stock-filter').value;
        const typeFilter = document.getElementById('order-type-filter').value;
        const statusFilter = document.getElementById('order-status-filter').value;

        const filteredOrders = state.portfolio.orders.filter(order =>
            (stockFilter === 'all' || order.symbol === stockFilter) &&
            (typeFilter === 'all' || order.type.toLowerCase() === typeFilter) &&
            (statusFilter === 'all' || order.status.toLowerCase() === statusFilter)
        );

        filteredOrders.forEach(order => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${order.symbol}</td>
                <td class="${order.type.toLowerCase() === 'buy' ? 'profit' : 'loss'}">${order.type}</td>
                <td>₹${order.price.toFixed(2)}</td>
                <td>${order.quantity}</td>
                <td><span class="status ${order.status.toLowerCase()}">${order.status}</span></td>
                <td>${new Date(order.timestamp).toLocaleString()}</td>
            `;
            tableBody.prepend(row); // Show newest orders first
        });
    }

    function renderPortfolio() {
        let totalInvested = 0, totalCurrentValue = 0;
        const holdingsBody = document.querySelector('#holdings-table tbody');
        holdingsBody.innerHTML = '';
        
        Object.keys(state.portfolio.holdings).forEach(symbol => {
            const holding = state.portfolio.holdings[symbol];
            const stock = state.stocks[symbol];
            const invested = holding.quantity * holding.avgPrice;
            const currentValue = holding.quantity * stock.price;
            const pl = currentValue - invested;
            const plClass = pl >= 0 ? 'profit' : 'loss';
            
            totalInvested += invested;
            totalCurrentValue += currentValue;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${symbol}</td>
                <td>${holding.quantity}</td>
                <td>₹${holding.avgPrice.toFixed(2)}</td>
                <td>₹${invested.toFixed(2)}</td>
                <td>₹${currentValue.toFixed(2)}</td>
                <td class="${plClass}">₹${pl.toFixed(2)}</td>
            `;
            holdingsBody.appendChild(row);
        });

        const overallPL = totalCurrentValue - totalInvested;
        const overallPLPercent = totalInvested > 0 ? (overallPL / totalInvested) * 100 : 0;
        const plClass = overallPL >= 0 ? 'profit' : 'loss';

        document.getElementById('invested-value').textContent = `₹${totalInvested.toFixed(2)}`;
        document.getElementById('current-value').textContent = `₹${totalCurrentValue.toFixed(2)}`;
        document.getElementById('remaining-funds').textContent = `₹${state.portfolio.availableFunds.toFixed(2)}`;
        const plElement = document.getElementById('portfolio-pl');
        plElement.textContent = `₹${overallPL.toFixed(2)} (${overallPLPercent.toFixed(2)}%)`;
        plElement.className = plClass;
        document.getElementById('profile-funds').textContent = `₹${state.portfolio.availableFunds.toFixed(2)}`;
        renderSectorChart();
    }
    
    // --- 4. CHARTING FUNCTIONS (ALL OF THEM) ---
    function renderSectorChart() {
        const sectorData = {};
        Object.keys(state.portfolio.holdings).forEach(symbol => {
            const holding = state.portfolio.holdings[symbol];
            const stock = state.stocks[symbol];
            const currentValue = holding.quantity * stock.price;
            sectorData[stock.sector] = (sectorData[stock.sector] || 0) + currentValue;
        });

        const ctx = document.getElementById('sector-pie-chart').getContext('2d');
        if (state.charts.sector) state.charts.sector.destroy();
        state.charts.sector = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(sectorData),
                datasets: [{
                    data: Object.values(sectorData),
                    backgroundColor: ['#4a90e2', '#50c878', '#f5a623', '#bd10e0', '#d0021b'],
                    borderColor: 'var(--bg-secondary)',
                }]
            },
            options: { responsive: true, plugins: { legend: { position: 'top', labels: { color: 'var(--text-primary)' } } } }
        });
    }

    function renderTradeChart(symbol) {
        const stock = state.stocks[symbol];
        if (!stock) return;

        const ctx = document.getElementById('trade-candle-chart').getContext('2d');
        if (state.charts.trade) state.charts.trade.destroy();
        
        // Use the last 60 minutes for the trade chart for relevance
        const tradeData = stock.minuteData.slice(-60);

        state.charts.trade = new Chart(ctx, {
            type: 'candlestick',
            data: {
                datasets: [{ data: tradeData, color: { up: 'var(--accent-green)', down: 'var(--accent-red)' } }]
            },
            options: {
                responsive: true,
                scales: { x: { display: false }, y: { display: false } },
                plugins: { legend: { display: false }, tooltip: { enabled: false } }
            }
        });
    }

    function aggregateData(data, interval) {
        if (interval <= 1) return data;
        const aggregated = [];
        let i = 0;
        while (i < data.length) {
            const intervalMillis = interval * 60000;
            const candleTime = Math.floor(data[i].t / intervalMillis) * intervalMillis;
            const group = data.filter(d => Math.floor(d.t / intervalMillis) * intervalMillis === candleTime);

            if (group.length > 0) {
                aggregated.push({
                    t: group[0].t,
                    o: group[0].o,
                    h: Math.max(...group.map(d => d.h)),
                    l: Math.min(...group.map(d => d.l)),
                    c: group[group.length - 1].c,
                    v: group.reduce((sum, d) => sum + d.v, 0)
                });
                i += group.length;
            } else { i++; }
        }
        return aggregated;
    }

    function drawDetailedChart() {
        const symbol = state.ui.activeChart.symbol;
        if (!symbol) return;

        const stock = state.stocks[symbol];
        const chartType = document.getElementById('chart-type-selector').value;
        const interval = parseInt(document.getElementById('candle-interval-selector').value, 10);
        const processedData = aggregateData(stock.minuteData, interval);
        const ctx = document.getElementById('detailed-stock-chart').getContext('2d');
        if (state.charts.detailed) state.charts.detailed.destroy();

        const datasets = [];
        const isDark = state.ui.isDark;
        const upColor = isDark ? '#50c878' : '#4caf50';
        const downColor = isDark ? '#ff4d4d' : '#f44336';
        const volUpColor = isDark ? 'rgba(80, 200, 120, 0.5)' : 'rgba(76, 175, 80, 0.5)';
        const volDownColor = isDark ? 'rgba(255, 77, 77, 0.5)' : 'rgba(244, 67, 54, 0.5)';

        // Price Chart (Candlestick or Line)
        if (chartType === 'candlestick') {
            datasets.push({
                type: 'candlestick', data: processedData, yAxisID: 'yPrice',
                color: { up: upColor, down: downColor, unchanged: 'gray' }
            });
        } else if (chartType === 'line') {
            datasets.push({
                type: 'line', data: processedData.map(p => ({ x: p.t, y: p.c })), yAxisID: 'yPrice',
                borderColor: 'var(--accent-blue)', borderWidth: 2, tension: 0.1, pointRadius: 0
            });
        }
        
        // Volume Chart (always present unless chartType is 'bar')
        datasets.push({
            type: 'bar', label: 'Volume',
            data: processedData.map(p => ({ x: p.t, y: p.v, color: p.c >= p.o ? volUpColor : volDownColor })),
            backgroundColor: processedData.map(p => p.c >= p.o ? volUpColor : volDownColor),
            yAxisID: 'yVolume'
        });

        state.charts.detailed = new Chart(ctx, {
            data: { datasets },
            options: {
                responsive: true, maintainAspectRatio: false, animation: false,
                scales: {
                    x: { type: 'time', time: { unit: interval > 120 ? 'day' : (interval > 5 ? 'hour' : 'minute') }, ticks: { color: 'var(--text-secondary)' }, grid: { color: 'var(--border-color)' } },
                    yPrice: { position: 'left', display: chartType !== 'bar', ticks: { color: 'var(--text-primary)' }, grid: { color: 'var(--border-color)' } },
                    yVolume: { position: 'right', display: true, grid: { drawOnChartArea: false }, ticks: { color: 'var(--text-secondary)', callback: value => `${(value / 1000).toFixed(0)}K` } }
                },
                plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } }
            }
        });
    }


    // --- 5. EVENT HANDLERS & UI LOGIC ---
    function handleNavClick(e) {
        e.preventDefault();
        const targetModule = e.target.closest('.nav-link').dataset.target;
        if (targetModule === state.ui.activeModule) return;
        document.querySelector('.nav-link.active').classList.remove('active');
        e.target.closest('.nav-link').classList.add('active');
        document.querySelector('.module.active').classList.remove('active');
        document.getElementById(targetModule).classList.add('active');
        state.ui.activeModule = targetModule;
        if (targetModule === 'portfolio') renderPortfolio();
        if (targetModule === 'orders') renderOrders();
    }

    function openTradeModal(symbol, type) {
        const stock = state.stocks[symbol];
        if (!stock) return;
        state.ui.activeTrade = { symbol, type };
        const modal = document.getElementById('quick-trade-modal');
        document.getElementById('trade-stock-symbol').textContent = `${type} ${symbol}`;
        document.getElementById('trade-current-value').textContent = `₹${stock.price.toFixed(2)}`;
        document.getElementById('trade-volume').textContent = stock.volume.toLocaleString();
        document.getElementById('price').value = stock.price.toFixed(2);
        const buyBtn = document.querySelector('.btn-trade.buy'), sellBtn = document.querySelector('.btn-trade.sell'), executeBtn = document.getElementById('execute-trade-btn');
        buyBtn.classList.toggle('active', type === 'BUY');
        sellBtn.classList.toggle('active', type === 'SELL');
        executeBtn.textContent = `Execute ${type}`;
        executeBtn.classList.toggle('sell-mode', type === 'SELL');
        modal.style.display = 'flex';
        renderTradeChart(symbol);
    }
    
    function closeTradeModal() {
        document.getElementById('quick-trade-modal').style.display = 'none';
        if (state.charts.trade) state.charts.trade.destroy();
    }

    function openChartModal(symbol) {
        state.ui.activeChart.symbol = symbol;
        const modal = document.getElementById('chart-modal');
        document.getElementById('chart-stock-symbol').textContent = `${symbol} - Detailed Chart`;
        modal.style.display = 'flex';
        drawDetailedChart();
    }

    function closeChartModal() {
        document.getElementById('chart-modal').style.display = 'none';
        if (state.charts.detailed) state.charts.detailed.destroy();
        state.ui.activeChart.symbol = null;
    }

    function handleTradeExecution(e) {
        e.preventDefault();
        const { symbol, type } = state.ui.activeTrade;
        const quantity = parseInt(document.getElementById('quantity').value);
        const price = parseFloat(document.getElementById('price').value);

        if (!symbol || !quantity || !price || quantity <= 0) return alert("Invalid order details.");
        
        if (type === 'BUY') {
            const cost = price * quantity;
            if (state.portfolio.availableFunds < cost) return alert("Insufficient funds.");
            state.portfolio.availableFunds -= cost;
            const h = state.portfolio.holdings[symbol];
            if (h) {
                h.avgPrice = ((h.avgPrice * h.quantity) + cost) / (h.quantity + quantity);
                h.quantity += quantity;
            } else {
                state.portfolio.holdings[symbol] = { quantity, avgPrice: price };
            }
        } else { // SELL
            const h = state.portfolio.holdings[symbol];
            if (!h || h.quantity < quantity) return alert("You do not own enough shares to sell.");
            state.portfolio.availableFunds += price * quantity;
            h.quantity -= quantity;
            if (h.quantity === 0) delete state.portfolio.holdings[symbol];
        }
        
        state.portfolio.orders.push({ symbol, type, price, quantity, status: 'Executed', timestamp: Date.now() });
        alert(`${type} order for ${quantity} ${symbol} @ ₹${price.toFixed(2)} executed!`);
        closeTradeModal();
        renderAll();
    }

    function populateFilterOptions() {
        const stockFilter = document.getElementById('order-stock-filter');
        Object.keys(state.stocks).forEach(symbol => {
            const option = document.createElement('option');
            option.value = symbol;
            option.textContent = symbol;
            stockFilter.appendChild(option);
        });
    }

    // --- 6. MAIN INITIALIZATION & EVENT LISTENERS ---
    function setupEventListeners() {
        document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', handleNavClick));
        document.getElementById('theme-toggle').addEventListener('change', (e) => {
            state.ui.isDark = e.target.checked;
            document.documentElement.className = e.target.checked ? 'dark-mode' : 'light-mode';
            renderAll(); // Re-render everything for theme changes
            if (state.ui.activeChart.symbol) drawDetailedChart();
        });

        document.getElementById('watchlist-table').addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;
            const symbol = button.dataset.symbol;
            if (button.classList.contains('btn-buy')) openTradeModal(symbol, 'BUY');
            else if (button.classList.contains('btn-sell')) openTradeModal(symbol, 'SELL');
            else if (button.classList.contains('btn-chart')) openChartModal(symbol);
        });

        document.getElementById('close-trade-button').addEventListener('click', closeTradeModal);
        document.getElementById('close-chart-button').addEventListener('click', closeChartModal);
        
        document.getElementById('trade-form').addEventListener('submit', handleTradeExecution);
        document.querySelectorAll('.btn-trade').forEach(btn => {
            btn.addEventListener('click', (e) => openTradeModal(state.ui.activeTrade.symbol, e.target.dataset.type));
        });
        
        document.getElementById('order-stock-filter').addEventListener('change', renderOrders);
        document.getElementById('order-type-filter').addEventListener('change', renderOrders);
        document.getElementById('order-status-filter').addEventListener('change', renderOrders);

        document.getElementById('chart-type-selector').addEventListener('change', drawDetailedChart);
        document.getElementById('candle-interval-selector').addEventListener('change', drawDetailedChart);
    }
    
    // --- App Start ---
    initializeData();
    populateFilterOptions();
    setupEventListeners();
    renderAll();
});




