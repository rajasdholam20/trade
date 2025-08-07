window.onload = function() {
    // Get the stock symbol from the URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const symbol = urlParams.get('symbol') || 'AAPL'; // Default to AAPL if no symbol is provided

    const widgetOptions = {
        symbol: symbol,
        datafeed: datafeed, // Our simulated datafeed from data.js
        interval: '15',     // Default interval
        container_id: "tv_chart_container",
        library_path: "charting_library/",
        locale: "en",
        disabled_features: ["use_localstorage_for_settings"],
        enabled_features: [
            "study_templates", // Enables saving indicator templates
            "side_toolbar_in_fullscreen_mode",
            "header_in_fullscreen_mode"
        ],
        charts_storage_url: 'https://saveload.tradingview.com',
        charts_storage_api_version: "1.1",
        client_id: 'tradingview.com',
        user_id: 'public_user_id',
        fullscreen: false,
        autosize: true,
        studies_overrides: {},
        theme: "Light" // Default theme
    };

    const tvWidget = new TradingView.widget(widgetOptions);

    tvWidget.onChartReady(() => {
        console.log('TradingView Chart is ready');
        
        // --- Here you can add default indicators ---
        tvWidget.chart().createStudy('Moving Average', false, false, { length: 20 });
        tvWidget.chart().createStudy('Bollinger Bands', false, false, { length: 20, "StdDev": 2 });
    });
};