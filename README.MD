# Coin Alert #
A NodeJS-based script to retrieve the most recent cryptocurrency prices and send alert to predetermined Telegram group to monitor significant price changes.

## Supported Exchanges ##

- Bittrex - [https://bittrex.com](https://bittrex.com)
- Indodax (Bitcoin.co.id) - [https://indodax.com](https://indodax.com)

## Installation ##

Navigate to the repository and install the required dependencies using the following command.

```npm install```

Install db-migrate and one of its preferred driver globally

```
npm install -g db-migrate
npm install -g db-migrate-mysql
```

Fill the configuration values in ```.env``` and ```database.json``` and then migrate the database using the following command.

```db-migrate up```

Finally, run Coin Alert with:

```node coin-alert.js```

..or preferably with [pm2](https://www.npmjs.com/package/pm2):

```pm2 start coin-alert```

--------------------------------------------------------------------------------------------------

This software is provided 'as-is', without any express or implied
warranty. In no event will the authors be held liable for any damages
arising from the use of this software.

### License ###

This is an open-sourced software licensed under the [GNU GPL v3 license](http://www.gnu.org/licenses/gpl-3.0.en.html).