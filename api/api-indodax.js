var VipExchangeApi = function() {

    var apiKey = process.env.INDODAX_KEY;
    var apiSecret = process.env.INDODAX_SECRET;
    var tradeApiUrl = "https://vip.bitcoin.co.id/tapi/";
    var publicApiUrl = "https://vip.bitcoin.co.id/api/";
    var request = require('request');
    var cloudscraper = require('cloudscraper');
    var numeral = require('numeral');

    return {
        getErrorBody: function(body) {
            if(body.indexOf('Service Unavailable') > -1 || body.indexOf('System Maintenance') > -1)
                return 'Service Unavailable';
            else if(body.indexOf('Checking your browser') > -1)
                return 'Interfered by Cloudflare';
            else return null;
        },
        getMarketSummaries: function(callback) {
            var url = 'https://api2.bitcoin.co.id/api/btc_idr/webdata';

            cloudscraper.get(url, function(error, response, body)
            {
                var errBody = getErrorBody(body);
                if(errBody !== null)
                    return callback(null, errBody);

                var data = error === null ? JSON.parse(body) : null;

                if(data != null) {
                    var ret = [];
                    var prices = data.prices;

                    for(var key in prices) {
                        var price = prices[key];
                        var marketName = key.substring(0, key.length - 3) + '_' + key.substring(key.length - 3);

                        if(key.substring(-3) === 'btc')
                            price = parseInt(price) * 0.00000001;
                        else price = parseInt(price);

                        ret.push({
                            market: marketName,
                            high: 0,
                            low: 0,
                            volume: 0,
                            lastPrice: price
                        });
                    }

                    callback(ret, null);
                }
                else callback(null, error);
            });
        }
    };

}();

module.exports = VipExchangeApi;
