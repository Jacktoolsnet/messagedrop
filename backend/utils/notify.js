const webpush = require('web-push');

const placeSubscriptions = function (logger, db, plusCode, userId, message) {
    try{
        let sql = `
        SELECT placeId, subscribed, tablePlace.userId, tablePlace.name, tableUser.subscription
        FROM tablePlacePlusCode
        INNER JOIN tablePlace ON tablePlace.id = tablePlacePlusCode.placeId
        INNER JOIN tableUser ON tablePlace.userId = tableUser.id
        WHERE plusCode = '${plusCode}'
        AND subscribed = 1
        AND tablePlace.userId <> '${userId}';`;
        db.all(sql, (err, rows) => {
            rows.forEach((row) => {
                logger.info(row);
                const payload = {
                    "notification": {
                        "title": `Messagedrop @${row.name}`,
                        "body": message,
                        "icon": "assets/icons/notify-icon.png",
                        "vibrate": [100, 50, 100],
                        "data": {
                            "dateOfArrival": Date.now(),
                            "primaryKey": plusCode,
                            "onActionClick": {
                                "default": { 
                                    "operation": "focusLastFocusedOrOpen",
                                    "url": '/'
                                }
                            },
                        }
                    }
                };
                sendNotification(logger, JSON.parse(row.subscription), payload);
              });
        });
    } catch (error) {
        logger.error(`placeSubscriptions: ${error}`);
    }
}

function sendNotification(logger, subscription, payload) {
    try{
        webpush.setVapidDetails(
            'https://messagedrop.de',
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );
        webpush
            .sendNotification(subscription, JSON.stringify(payload))
            .then((result) => {})
            .catch((error) => {logger.error(`webpush.sendNotification: ${error}`);});
    } catch (error) {
        logger.error(`sendNotification: ${error}`);
    }
}

module.exports = {
    placeSubscriptions
}