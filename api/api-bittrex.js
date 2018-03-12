var BittrexExchangeApi = function() {

    var api = require('node-bittrex-api');

    api.options({
        'apikey' : process.env.BITTREX_KEY,
        'apisecret' : process.env.BITTREX_SECRET
    });

    return {
        getMarketSummaries: function(callback) {
            api.getmarketsummaries(function(result, error) {
                if(result !== undefined && result !== null && result.success) {
                    var ret = [];

                    for(var i = 0; i < result.result.length; ++i) {
                        var market = result.result[i];

                        ret.push({
                            market: market.MarketName,
                            high: market.High,
                            low: market.Low,
                            volume: market.BaseVolume,
                            lastPrice: market.Bid
                        });
                    }

                    callback(ret, null);
                }
                else callback(null, error);
            });
        }
    };

}();

module.exports = BittrexExchangeApi;