require('dotenv').config()
const bearerToken = require('express-bearer-token');
const databaseMw = require('./middleware/database');
const Database = require('./db/database');
const database = new Database();
const root = require('./routes/root');
const check = require('./routes/check');
const statistic = require('./routes/statistic');
const user = require('./routes/user');
const message = require('./routes/message');
const locationPushSubscription = require('./routes/locationSubscription');
const translate = require('./routes/translate');
const notfound = require('./routes/notfound');
const cors = require('cors')
const express = require('express');
const helmet = require('helmet');
const app = express();
const cron = require('node-cron');

/*
“Helmet” is a collection of nine smaller middleware functions that are used to set security-relevant HTTP headers.

- The Content Security Policy header is set via csp to prevent cross-site scripting attacks and other cross-site injections.
- The X-Powered-By header is removed using hidePoweredBy.
- hsts is used to set Strict Transport Security headers, which are used to enforce secure (HTTP over SSL/TLS) connections to the server.
- ieNoOpen sets X-Download-Options headers for IE8+.
- NoCache sets Cache-Control and Pragma headers to disable client-side caching.
- NoSniff sets X-Content-Type-Options headers to prevent browsers from MIME sniffing of responses away from the declared content-type.
- The X-Frame-Options header is set via frameguard to ensure clickjacking protection.
- xssFilter sets X-XSS-Protection headers to enable XSS (cross-site scripting) filters in most current web browsers.
*/
app.use(helmet()); // Add security headers.

/*
Per RFC6750 this module will attempt to extract a bearer token from a request from these locations:

The key access_token in the request body.
The key access_token in the request params.
The value from the header Authorization: Bearer <token>.
(Optional) Get a token from cookies header with key access_token.
If a token is found, it will be stored on req.token. If one has been provided in more than one location, this will abort the request immediately by sending code 400 (per RFC6750).
*/
app.use(bearerToken());

/*
Enable cors for all routes.
*/
var corsOptions = {
  origin: process.env.ORIGIN,
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}
app.use(cors())

app.use(databaseMw(database));

// ROUTES
app.use('/', root);
app.use('/check', check);
app.use('/statistic', statistic);
app.use('/user', user);
app.use('/message', message);
app.use('/translate', translate);
app.use('/locationPushSubscription', locationPushSubscription);

// The last route
app.use('*', notfound);

// Start app
app.listen(process.env.PORT, () => {
  console.log(`Example app listening on port ${process.env.PORT}`);
  database.init();
})

// Cron
// ┌────────────── second (optional)
// │ ┌──────────── minute
// │ │ ┌────────── hour
// │ │ │ ┌──────── day of month
// │ │ │ │ ┌────── month
// │ │ │ │ │ ┌──── day of week
// │ │ │ │ │ │
// │ │ │ │ │ │
// * * * * * *

// Clean users every hour at minute 0
cron.schedule('0 * * * *', () => {
  tableUser.clean(database.db, function(err) {
    if (err) {}
  });
});

// Clean messages every 5 minutes
cron.schedule('*/5 * * * *', () => {
  tableMessage.cleanPublic(database.db, function(err) {
    if (err) {
      console.log(err);
    }
  });
});

// Clean location subscription every hour at minute 0
cron.schedule('0 * * * *', () => {
  tableLocationPushSubscription.clean(database.db, function(err) {
    if (err) {}
  });
});