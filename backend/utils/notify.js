const webpush = require('web-push');

const placeSubscriptions = function (logger, db, plusCode, userId, message) {
    try {
        let sql = `
        SELECT tablePlacePlusCode.placeId, tablePlace.subscribed, tablePlace.userId, tablePlace.name, tableUser.subscription
        FROM tablePlacePlusCode
        INNER JOIN tablePlace ON tablePlace.id = tablePlacePlusCode.placeId
        INNER JOIN tableUser ON tablePlace.userId = tableUser.id
        WHERE plusCode = '${plusCode}'
        AND subscribed = 1
        AND tablePlace.userId <> '${userId}';`;
        db.all(sql, (err, rows) => {
            rows.forEach((row) => {
                const payload = {
                    "notification": {
                        "title": `Messagedrop @${row.name}`,
                        "body": message,
                        "icon": "assets/icons/notify-icon.png",
                        "vibrate": [100, 50, 100],
                        "data": {
                            "dateOfArrival": Date.now(),
                            "primaryKey": { "type": "place", "id": plusCode },
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

const contactSubscriptions = function (logger, db, userId, contactUserId, message) {
    try {
        let sql = `
        SELECT tableContact.id, tableContact.userId, tableContact.contactUserId, tableContact.subscribed, tableContact.name, tableContact.base64Avatar, tableUser.subscription
        FROM tableContact
        INNER JOIN tableUser ON tableContact.userId = tableUser.id
        WHERE contactUserId = '${userId}'
        AND userId = '${contactUserId}'
        AND subscribed = 1;`;
        logger.error(`sql: ${sql}`);
        db.all(sql, (err, rows) => {
            rows.forEach((row) => {
                logger.error(`sql-row: ${JSON.stringify(row)}`);
                const payload = {
                    "notification": {
                        "title": `New message from @${row.name}`,
                        "body": message,
                        "icon": "assets/icons/notify-icon.png",
                        "vibrate": [100, 50, 100],
                        "data": {
                            "dateOfArrival": Date.now(),
                            "primaryKey": { "type": "contact", "id": row.id },
                            "onActionClick": {
                                "default": {
                                    "operation": "focusLastFocusedOrOpen",
                                    "url": '/'
                                }
                            },
                        }
                    }
                };
                logger.error(`payload: ${JSON.stringify(payload)}`);
                sendNotification(logger, JSON.parse(row.subscription), payload);
            });
        });
    } catch (error) {
        logger.error(`contactSubscriptions: ${error}`);
    }
}

function sendNotification(logger, subscription, payload) {
    try {
        webpush.setVapidDetails(
            'https://messagedrop.de',
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );
        webpush
            .sendNotification(subscription, JSON.stringify(payload))
            .then((result) => { })
            .catch((error) => { logger.error(`webpush.sendNotification: ${error}`); });
    } catch (error) {
        logger.error(`sendNotification: ${error}`);
    }
}

module.exports = {
    placeSubscriptions,
    contactSubscriptions
}