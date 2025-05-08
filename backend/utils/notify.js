// https://angular.dev/ecosystem/service-workers/push-notifications
const webpush = require('web-push');
const { getEncryptionPrivateKey } = require('../utils/keyStore');
const cryptoUtil = require('../utils/cryptoUtils');


const placeSubscriptions = function (logger, db, plusCode, userId, message) {
    try {
        let sql = `
        SELECT tablePlace.id, tablePlace.userId, tablePlace.subscribed, tablePlace.name, tablePlace.plusCodes, tableUser.subscription
        FROM tablePlace
        INNER JOIN tableUser ON tablePlace.userId = tableUser.id
        WHERE tablePlace.plusCodes LIKE '%${plusCode}%'
        AND tablePlace.subscribed = 1
        AND tablePlace.userId <> '${userId}';`;
        db.all(sql, (err, rows) => {
            if (undefined != rows) {
                rows.forEach(async (row) => {
                    if (row.subscription != '') {
                        let placeName = '';
                        try {
                            placeName = await cryptoUtil.decrypt(getEncryptionPrivateKey(), row.name);
                        } catch (ex) {
                            logger.info(`error: ${ex}`);
                        }
                        const payload = {
                            "notification": {
                                "title": `Messagedrop @${placeName}`,
                                "body": message,
                                "icon": "assets/icons/notify-icon.png",
                                "vibrate": [100, 50, 100],
                                "data": {
                                    "dateOfArrival": Date.now(),
                                    "primaryKey": { "type": "place", "id": plusCode },
                                    "onActionClick": {
                                        "default": {
                                            "operation": "focusLastFocusedOrOpen"
                                        }
                                    },
                                }
                            }
                        };
                        sendNotification(logger, JSON.parse(row.subscription), payload);
                    }
                });
            }
        });
    } catch (error) {
        logger.error(`placeSubscriptions: ${error}`);
    }
}

const contactSubscriptions = function (logger, db, userId, contactUserId, message) {
    try {
        let sql = `
        SELECT tableContact.id, tableContact.userId, tableContact.contactUserId, tableContact.subscribed, tableContact.name, tableUser.subscription
        FROM tableContact
        INNER JOIN tableUser ON tableContact.userId = tableUser.id
        WHERE contactUserId = '${userId}'
        AND userId = '${contactUserId}'
        AND subscribed = 1;`;
        db.all(sql, (err, rows) => {
            if (undefined != rows) {
                rows.forEach(async (row) => {
                    logger.info(`name: ${JSON.parse(row.name)}`);
                    if (row.subscription != '') {
                        let contactName = '';
                        try {
                            contactName = await cryptoUtil.decrypt(getEncryptionPrivateKey(), row.name);
                        } catch (ex) {
                            logger.info(`error: ${ex}`);
                        }
                        logger.info(`contactName: ${contactName}`);
                        const payload = {
                            "notification": {
                                "title": `New message from @${contactName}`,
                                "body": message,
                                "icon": "assets/icons/notify-icon.png",
                                "vibrate": [100, 50, 100],
                                "data": {
                                    "dateOfArrival": Date.now(),
                                    "primaryKey": { "type": "contact", "id": row.id },
                                    "onActionClick": {
                                        "default": {
                                            "operation": "focusLastFocusedOrOpen",
                                        }
                                    },
                                }
                            }
                        };
                        logger.info(`contactSubscriptions: ${JSON.stringify(payload)}`);
                        sendNotification(logger, JSON.parse(row.subscription), payload);
                    }
                });
            }
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