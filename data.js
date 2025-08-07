// This acts as a simulated datafeed for the TradingView Charting Library.
// In a real application, this would be replaced with API calls to a live data provider.

const datafeed = {
    onReady: (callback) => {
        console.log('[onReady]: Method call');
        setTimeout(() => callback({ supported_resolutions: ['1', '5', '15', '30', '60', '1D', '1W', '1M'] }), 0);
    },

    searchSymbols: (userInput, exchange, symbolType, onResultReadyCallback) => {
        // Implement symbol search if needed
        console.log('[searchSymbols]: Method call');
        onResultReadyCallback([]); // For now, we don't support symbol search
    },

    resolveSymbol: (symbolName, onSymbolResolvedCallback, onResolveErrorCallback) => {
        console.log('[resolveSymbol]: Method call', symbolName);
        const symbolInfo = {
            ticker: symbolName,
            name: symbolName,
            description: symbolName,
            type: 'stock',
            session: '24x7',
            timezone: 'Etc/UTC',
            exchange: 'GeminiEX',
            minmov: 1,
            pricescale: 100,
            has_intraday: true,
            has_no_volume: false,
            supported_resolutions: ['1', '5', '15', '30', '60', '1D', '1W', '1M'],
            volume_precision: 2,
            data_status: 'streaming',
        };
        setTimeout(() => onSymbolResolvedCallback(symbolInfo), 0);
    },

    getBars: (symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) => {
        console.log('[getBars]: Method call', symbolInfo.ticker, resolution);
        const { from, to, firstDataRequest } = periodParams;

        // --- Generate Mock Historical Data ---
        const bars = [];
        let now = Date.now();
        let price = 150; // Starting price

        for (let i = 0; i < 2000; i++) {
            let time = now - (2000 - i) * 60 * 1000; // 1-minute data points
            let open = price;
            let close = open + (Math.random() - 0.5) * 2;
            let high = Math.max(open, close) + Math.random();
            let low = Math.min(open, close) - Math.random();
            let volume = Math.random() * 10000;
            price = close;

            bars.push({ time, open, high, low, close, volume });
        }

        if (bars.length) {
            onHistoryCallback(bars, { noData: false });
        } else {
            onHistoryCallback([], { noData: true });
        }
    },

    subscribeBars: (symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) => {
        console.log('[subscribeBars]: Method call with subscriberUID:', subscriberUID);
        // This is where you would connect to a real-time WebSocket stream.
        // For this example, we will simulate a new tick every 2 seconds.
        setInterval(() => {
            const lastBar = {
                time: Date.now(),
                open: Math.random() * 10 + 150,
                high: Math.random() * 10 + 155,
                low: Math.random() * 5 + 145,
                close: Math.random() * 10 + 150,
                volume: Math.random() * 1000,
            };
            onRealtimeCallback(lastBar);
        }, 2000);
    },

    unsubscribeBars: (subscriberUID) => {
        console.log('[unsubscribeBars]: Method call with subscriberUID:', subscriberUID);
    },
};