require('dotenv').config();
require('string.prototype.endswith');
require('string.prototype.startswith');

var INTERVAL_1M = 60;
var INTERVAL_5M = 5 * INTERVAL_1M;
var INTERVAL_10M = 10 * INTERVAL_1M;
var INTERVAL_30M = 30 * INTERVAL_1M;
var INTERVAL_1H = 60 * INTERVAL_1M;
var INTERVAL_6H = 6 * INTERVAL_1H;
var TIMESTAMP_FORMAT = "Y-MM-DD HH:mm:ss";
var ZERO_TIMESTAMP = "0000-00-00 00:00:00";

var mysql = require('mysql');
var async = require('async');
var moment = require('moment');
var numeral = require('numeral');
var bcrypt = require('bcrypt-nodejs');
var request = require('request');
var arraySort = require('array-sort');
var Telegraf = require('telegraf');
var commandParts = require('telegraf-command-parts');
var updateInterval = INTERVAL_5M;
var gainThreshold = 5.0;

var now = moment().unix();
var lastTick10m = now,
    lastTick30m = now,
    lastTick1h = now,
    lastTick6h = now;

var botApiUrl = 'https://api.telegram.org/bot' + process.env.TELEGRAM_BOT_API_KEY;
var exchanges = [];

var db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
});

var bot = new Telegraf(process.env.TELEGRAM_BOT_API_KEY);

bot.use(commandParts());

var log = function(message) {
    var dateNow = moment().format('Y-MM-DD HH:mm:ss');
    console.log('[' + dateNow + ']', message);

    if(process.env.APP_DEBUG === 'false') {
        var formData = {
            chat_id: process.env.TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: "HTML",
            disable_web_page_preview: true
        };

        request.post(botApiUrl + '/sendMessage', { form: formData }, function(error, response, body) {
            if(error || response.statusCode !== 200)
                console.log(error);
        });
    }
};

var init = function(callback) {
    db.connect(function(err) {
        if(err) throw err;

        if(callback != null)
            callback(null);
    });
};

var seedData = [
    ['exchanges', ['name'], [['indodax'], ['bittrex']]]
];

var seedDatabase = function(callback) {
    db.query("SELECT * FROM exchanges", function(err, result, fields) {
        if(err) throw err;

        if(!result.length) {
            log('Database is empty. Seeding..');

            if(!seedData.length)
                callback(null);
            else {
                var execSeed = function(i) {
                    var d = seedData[i];
                    var fieldNames = d[1].join();
                    var sql = 'INSERT INTO ' + d[0] + ' (' + fieldNames + ') VALUES ?';

                    db.query(sql, [d[2]], function(err, result) {
                        if(err) throw err;

                        if(i + 1 < seedData.length)
                            execSeed(i + 1);
                        else callback(null);
                    });
                };

                execSeed(0);
            }
        }
        else {
            for(var i = 0; i < result.length; ++i)
                exchanges[result[i].id] = result[i].name;

            callback(null);
        }
    });
};

var main = function(callback) {
    var tick = function() {
        db.query("SELECT * FROM exchanges", function(err, result, fields) {
            if (err) throw err;

            var exc = result;
            var syncSummaries = function(i) {
                var exchange = exc[i];
                var api = require('./api/api-' + exchange.name);

                api.getMarketSummaries(function(result, error) {
                    if(error !== null) {
                        log(error);
                        return;
                    }

                    var summaries = result;
                    db.query("SELECT * FROM markets WHERE exchange_id = ?", [exchange.id], function(err, result) {
                        if(err) throw err;

                        var dateNow = moment().format(TIMESTAMP_FORMAT);

                        if(!result.length) {
                            var values = [];

                            for(var j = 0; j < summaries.length; ++j) {
                                var summary = summaries[j];
                                values.push([exchange.id, summary.market, summary.high, summary.low, summary.volume, summary.lastPrice, summary.lastPrice, summary.lastPrice, summary.lastPrice, summary.lastPrice]);
                            }

                            log('Initial market sync for ' + exchange.name);

                            db.query("INSERT INTO markets (exchange_id, market, high, low, volume, last_price, last_price_10m, last_price_30m, last_price_1h, last_price_6h) VALUES ?", [values], function(err, result) {
                                if(err) throw err;

                                if(i + 1 < exc.length)
                                    syncSummaries(i + 1);
                            });
                        }
                        else {
                            var current = {};
                            var latest = {};
                            var gaining = [];

                            for(var j = 0; j < summaries.length; ++j)
                                latest[summaries[j].market] = summaries[j];

                            var now = moment().unix();
                            var tick10m = Math.abs(lastTick10m - now) >= INTERVAL_5M,
                                tick30m = Math.abs(lastTick30m - now) >= INTERVAL_30M,
                                tick1h = Math.abs(lastTick1h - now) >= INTERVAL_1H,
                                tick6h = Math.abs(lastTick6h - now) >= INTERVAL_6H;

                            for(var j = 0; j < result.length; ++j) {
                                var row = result[j];

                                row.high = latest[row.market].high;
                                row.low = latest[row.market].low;
                                row.volume = latest[row.market].volume;
                                row.last_price = latest[row.market].lastPrice;

                                var last10m = row.last_price_10m,
                                    last30m = row.last_price_30m,
                                    last1h = row.last_price_1h,
                                    last6h = row.last_price_6h;

                                if(tick6h) {
                                    row.change_6h = latest[row.market].lastPrice !== row.last_price_6h ? (latest[row.market].lastPrice - row.last_price_6h) / row.last_price * 100.0 : 0;
                                    row.last_price_6h = latest[row.market].lastPrice;
                                }
                                
                                if(tick1h) {
                                    row.change_1h = latest[row.market].lastPrice !== row.last_price_1h ? (latest[row.market].lastPrice - row.last_price_1h) / row.last_price * 100.0 : 0;
                                    row.last_price_1h = latest[row.market].lastPrice;
                                }
                                
                                if(tick30m) {
                                    row.change_30m = latest[row.market].lastPrice !== row.last_price_30m ? (latest[row.market].lastPrice - row.last_price_30m) / row.last_price * 100.0 : 0;
                                    row.last_price_30m = latest[row.market].lastPrice;
                                }
                                
                                if(tick10m) {
                                    row.change_10m = latest[row.market].lastPrice !== row.last_price_10m ? (latest[row.market].lastPrice - row.last_price_10m) / row.last_price * 100.0 : 0;
                                    row.last_price_10m = latest[row.market].lastPrice;
                                }

                                var amountChange = row.change_10m >= gainThreshold ? row.change_10m : (row.change_30m >= gainThreshold ? row.change_30m : (row.change_1h >= gainThreshold ? row.change_1h : row.change_6h));
                                var changeDuration = row.change_10m >= gainThreshold ? '5 minutes' : (row.change_30m >= gainThreshold ? '30 minutes' : (row.change_1h >= gainThreshold ? '1 hour' : '6 hours'));
                                var lastPrice = row.change_10m >= gainThreshold ? last10m : (row.change_30m >= gainThreshold ? last30m : (row.change_1h >= gainThreshold ? last1h : last6h));

                                if(row.market === "USDT-BTC" && amountChange <= -gainThreshold && amountChange !== 0 && lastPrice > latest[row.market].lastPrice) {
                                    var fromPrice = numeral(lastPrice).format('0.00000000');
                                    var toPrice = numeral(latest[row.market].lastPrice).format('0.00000000');
                                    var message = "Warning! BTC is dropping..:\n";
                                    message += '[bittrex] <a href="https://bittrex.com/Market/Index?MarketName=USDT-BTC">USDT-BTC</a>: ' + numeral(amountChange).format('0,0.00') + '% in ' + changeDuration + ' (' + fromPrice + ' to ' + toPrice + ")\n";

                                    log(message);
                                }
                                else {
                                    var lastNotification = row.last_notification_at === ZERO_TIMESTAMP ? 0 : moment(row.last_notification_at, TIMESTAMP_FORMAT).unix();

                                    if(Math.abs(lastNotification - now) >= INTERVAL_6H && (row.change_10m >= gainThreshold || row.change_30m >= gainThreshold || row.change_1h >= gainThreshold || row.change_6h >= gainThreshold)) {
                                        if(lastPrice < latest[row.market].lastPrice) {
                                            gaining[row.market] = { exchange: exchange.name, market: row.market, change: amountChange, duration: changeDuration, from: lastPrice, to: latest[row.market].lastPrice };
                                            row.last_notification_at = moment().format(TIMESTAMP_FORMAT);
                                        }
                                    }
                                }

                                current[row.market] = row;
                            }

                            var values = [];
                            for(var key in current) {
                                var row = current[key];
                                values.push([row.id, row.exchange_id, row.market, row.high, row.low, row.volume,
                                    row.last_price, row.last_price_10m, row.last_price_30m, row.last_price_1h, row.last_price_6h,
                                    row.change_10m, row.change_30m, row.change_1h, row.change_6h, row.last_notification_at]);
                            }

                            db.query("DELETE FROM markets WHERE exchange_id = " + exchange.id, function(err, result) {
                                if(err) throw err;

                                db.query("INSERT INTO markets (id, exchange_id, market, high, low, volume, last_price, last_price_10m, last_price_30m, last_price_1h, last_price_6h, change_10m, change_30m, change_1h, change_6h, last_notification_at) VALUES ?", [values], function(err, result) {
                                    if(err) throw err;

                                    if(i + 1 < exc.length)
                                        syncSummaries(i + 1);
                                });
                            });

                            if(i + 1 >= exc.length) {
                                if(tick10m)
                                    lastTick10m = now;
                                else if(tick30m)
                                    lastTick30m = now;
                                else if(tick1h)
                                    lastTick1h = now;
                                else if(tick6h)
                                    lastTick6h = now;
                            }

                            if(Object.keys(gaining).length) {
                                var message = "Significant price gain detected\n";

                                arraySort(gaining, 'change');

                                for(var market in gaining) {
                                    var fromPrice = gaining[market].from;
                                    var toPrice = gaining[market].to;

                                    if(market.endsWith('_idr')) {
                                        fromPrice = numeral(fromPrice).format('0,0');
                                        toPrice = numeral(toPrice).format('0,0');
                                    }
                                    else if(market.startsWith('BTC-')) {
                                        fromPrice = numeral(fromPrice).format('0.00000000');
                                        toPrice = numeral(toPrice).format('0.00000000');
                                    }

                                    var vipMarketSlug = '', vipMarketLabel = '';

                                    if(gaining[market].exchange === 'vip') {
                                        var fromMarket = market.substring(0, market.indexOf('_')).toUpperCase();
                                        var toMarket = market.substring(market.indexOf('_') + 1).toUpperCase();

                                        if(fromMarket === 'DRK')
                                            fromMarket = 'DASH';
                                        else if(fromMarket === 'STR')
                                            fromMarket = 'XLM';
                                        else if(fromMarket === 'NEM')
                                            fromMarket = 'XEM';

                                        vipMarketSlug = fromMarket + toMarket;
                                        vipMarketLabel = fromMarket +'/' + toMarket;
                                    }

                                    var marketLink = gaining[market].exchange === 'bittrex' ?
                                        '<a href="https://bittrex.com/Market/Index?MarketName=' + market + '">' + market + '</a>' :
                                        '<a href="https://vip.bitcoin.co.id/market/' + vipMarketSlug + '">' + vipMarketLabel + '</a>';

                                    message += '[' + gaining[market].exchange + '] ' + marketLink + ': ' + numeral(gaining[market].change).format('0,0.00') + '% in ' + gaining[market].duration + ' (' + fromPrice + ' to ' + toPrice + ")\n";
                                }

                                log(message);
                            }
                        }
                    });
                });
            };

            syncSummaries(0);
        });
    };

    log("Starting botcoin..\nGain threshold: " + gainThreshold + "%");

    tick();
    setInterval(tick, updateInterval * 1000);

    bot.startPolling();
};

if(process.env.APP_DEBUG === 'false') {
    var span = ['10m', '30m', '1h', '6h'];
    var spanDesc = ['10 minutes', '30 minutes', '1 hour', '6 hours'];
    for(var k in span) {
        bot.command('/top' + span[k], function(ctx) {
            var stateCommand = ctx.state.command;
            var cmd = stateCommand.command;
            var mySpan = cmd.substring(3);
            var mySpanIndex = span.indexOf(mySpan);
            var exchangeWhere = "";
            var exchangeId = exchanges.indexOf(stateCommand.args);

            if(exchangeId !== -1)
                exchangeWhere = "AND exchange_id = " + exchangeId;

            var query = "SELECT e.name AS exchange, market, change_" + mySpan + " AS _change FROM markets JOIN exchanges AS e ON e.id = exchange_id WHERE change_" + mySpan + " > 0 " + exchangeWhere + " ORDER BY change_" + mySpan + " DESC LIMIT 5";
            db.query(query, function(err, result) {
                if (err) throw err;

                var message = "Top " + spanDesc[mySpanIndex] + (exchangeWhere !== "" ? " in " + stateCommand.args : "") + ":\n";

                if(result.length) {
                    for(var i in result) {
                        var r = result[i];
                        message += "[" + r.exchange + "] " + r.market + ": " + numeral(r._change).format('0,0.00') + "%\n";
                    }
                }
                else message += "No data yet";

                ctx.reply(message);
            });
        });
    }
}

async.waterfall([
    init,
    seedDatabase
], main);
