const webpush = require('web-push');

const placeSubscriptions = function (db, plusCode, userId, message) {
    try{
        let sql = `
        SELECT placeId, subscribed, tablePlace.userId, tableUser.subscription
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
                        "title": "New message dropped",
                        "body": message,
                        "icon": "assets/markers/messages-marker.svg",
                        "vibrate": [100, 50, 100],
                        "data": {
                            "dateOfArrival": Date.now(),
                            "primaryKey": row.plusCode
                        },
                        "actions": [{
                            "action": "explore",
                            "title": "Go to the location"
                        }]
                    }
                };
                sendNotification(JSON.parse(row.subscription), payload);
              });
        });
    } catch (error) {
        console.log(error);
    }
}

function sendNotification(subscription, payload) {
    try{
        webpush.setVapidDetails(
            'https://messagedrop.de',
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );
        webpush
            .sendNotification(subscription, JSON.stringify(payload))
            .then((result) => {})
            .catch((error) => {});
    } catch (error) {
        console.log(error);
    }
}

module.exports = {
    placeSubscriptions
}