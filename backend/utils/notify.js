// https://angular.dev/ecosystem/service-workers/push-notifications
const webpush = require('web-push');
const { getEncryptionPrivateKey, getVapidKeys } = require('../utils/keyStore');
const cryptoUtil = require('../utils/cryptoUtils');


const placeSubscriptions = function (logger, db, lat, lon, userId, message) {
    try {
        const sql = `SELECT tablePlace.id, tablePlace.userId, tablePlace.subscribed, tablePlace.name, tablePlace.latMin,tablePlace.latMax,tablePlace.lonMin,tablePlace.lonMax,tableUser.subscription
        FROM tablePlace
        INNER JOIN tableUser ON tablePlace.userId = tableUser.id
        WHERE '${lat}' BETWEEN tablePlace.latMin AND tablePlace.latMax
        AND '${lon}' BETWEEN tablePlace.lonMin AND tablePlace.lonMax
        AND tablePlace.subscribed = 1
        AND tablePlace.userId <> '${userId}';`;
        db.all(sql, (err, rows) => {
            if (undefined != rows) {
                rows.forEach(async (row) => {
                    if (row.subscription != '') {
                        let placeName = '';
                        try {
                            placeName = await cryptoUtil.decrypt(getEncryptionPrivateKey(), JSON.parse(row.name));
                        } catch (cryptoError) {
                            logger.warn('Failed to decrypt place name', { error: cryptoError?.message });
                        }
                        const payload = {
                            "notification": {
                                "title": `Messagedrop @${placeName}`,
                                "body": message,
                                "icon": "assets/icons/notify-icon.png",
                                "vibrate": [100, 50, 100],
                                "data": {
                                    "dateOfArrival": Date.now(),
                                    "primaryKey": { "type": "place", "id": row.id },
                                    "onActionClick": {
                                        "default": {
                                            "operation": "focusLastFocusedOrOpen"
                                        }
                                    },
                                }
                            }
                        };
                        try {
                            const subscription = JSON.parse(row.subscription);
                            sendNotification(logger, subscription, payload);
                        } catch (parseError) {
                            logger.error('placeSubscriptions: invalid subscription JSON', {
                                error: parseError?.message,
                                subscription: row.subscription,
                                placeId: row.id,
                                userId: row.userId
                            });
                        }
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
                    if (row.subscription != '') {
                        let contactName = '';
                        try {
                            contactName = await cryptoUtil.decrypt(getEncryptionPrivateKey(), JSON.parse(row.name));
                        } catch (cryptoError) {
                            logger.warn('Failed to decrypt contact name', { error: cryptoError?.message });
                        }
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
                        try {
                            const subscription = JSON.parse(row.subscription);
                            sendNotification(logger, subscription, payload);
                        } catch (parseError) {
                            logger.error('contactSubscriptions: invalid subscription JSON', {
                                error: parseError?.message,
                                subscription: row.subscription,
                                contactId: row.id,
                                userId: row.userId
                            });
                        }
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
        const { publicKey, privateKey } = getVapidKeys();
        if (!publicKey || !privateKey) {
            logger.error('sendNotification: missing VAPID keys', { endpoint: subscription?.endpoint });
            return;
        }
        webpush.setVapidDetails(
            process.env.VAPID_SUBJECT || 'https://messagedrop.de',
            publicKey,
            privateKey
        );
        webpush
            .sendNotification(subscription, JSON.stringify(payload))
            .then(() => {
                logger.info('webpush notification queued', { endpoint: subscription?.endpoint });
            })
            .catch((error) => {
                logger.error('webpush.sendNotification failed', {
                    endpoint: subscription?.endpoint,
                    statusCode: error?.statusCode,
                    body: error?.body,
                    message: error?.message
                });
            });
    } catch (error) {
        logger.error('sendNotification failed', { error: error?.message, endpoint: subscription?.endpoint });
    }
}

module.exports = {
    placeSubscriptions,
    contactSubscriptions
}
