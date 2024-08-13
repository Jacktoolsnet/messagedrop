const placeSubscriptions = function (db, plusCode, userId) {
    try{
        let sql = `
        SELECT placeId, subscribed, tablePlace.userId, tableUser.subscription
        FROM tablePlacePlusCode
        INNER JOIN tablePlace ON tablePlace.id = tablePlacePlusCode.placeId
        INNER JOIN tableUser ON tablePlace.userId = tableUser.id
        WHERE plusCode = '${plusCode}'
        AND subscribed = 1
        AND tablePlace.userID <> '${userId}';`;
        console.log(sql);
        db.all(sql, (err, rows) => {
            rows.forEach((row) => {
                console.log(row);
              });
        });
    } catch (error) {
        throw error;
    }
}

module.exports = {
    placeSubscriptions
}