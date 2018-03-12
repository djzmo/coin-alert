'use strict';

var dbm;
var type;
var seed;

/**
  * We receive the dbmigrate dependency from dbmigrate initially.
  * This enables us to not have to rely on NODE_PATH.
  */
exports.setup = function(options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function(db) {
  return db.createTable('markets', {
      id: {type: 'int', unsigned: true, primaryKey: true, autoIncrement: true},
      exchange_id: {
          type: 'int',
          unsigned: true,
          foreignKey: {name: 'markets_exchange_id_fk', table: 'exchanges', rules: {onDelete: 'CASCADE'}, mapping: 'id'}
      },
      market: 'string',
      high: {type: 'decimal', length: '21,8', defaultValue: 0},
      low: {type: 'decimal', length: '21,8', defaultValue: 0},
      volume: {type: 'decimal', length: '21,8', defaultValue: 0},
      last_price: {type: 'decimal', length: '21,8', defaultValue: 0},
      last_price_10m: {type: 'decimal', length: '21,8', defaultValue: 0},
      last_price_30m: {type: 'decimal', length: '21,8', defaultValue: 0},
      last_price_1h: {type: 'decimal', length: '21,8', defaultValue: 0},
      last_price_6h: {type: 'decimal', length: '21,8', defaultValue: 0},
      change_10m: {type: 'decimal', length: '5,2', defaultValue: 0},
      change_30m: {type: 'decimal', length: '5,2', defaultValue: 0},
      change_1h: {type: 'decimal', length: '5,2', defaultValue: 0},
      change_6h: {type: 'decimal', length: '5,2', defaultValue: 0},
      last_notification_at: {type: 'timestamp', defaultValue: '0000-00-00 00:00:00' }
  });
};

exports.down = function(db) {
  return db.dropTable('markets');
};

exports._meta = {
  "version": 1
};
