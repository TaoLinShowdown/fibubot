const fs = require('fs-extra');
const MongoClient = require('mongodb').MongoClient;
const express = require('express');
const cors = require('cors')
const bodyParser = require('body-parser');
const fibubot = require('./fibubot');

// express api
const app = express();
const port = 8091;

// mongodb
const mongo_url = 'mongodb://localhost:27017';
const mongo_db_name = 'fibubot';
const client = new MongoClient(mongo_url, { useUnifiedTopology: true });

(async () => {

    /**
     * creating and connecting fibubot instance 
     */
    const tokenData = JSON.parse(await fs.readFile('./server/tokens.json', 'UTF-8'));
    const credentialsData = JSON.parse(await fs.readFile('./server/credentials.json', 'UTF-8'));
    const bot = new fibubot();
    await bot.setup(credentialsData.clientId, credentialsData.clientSecret, tokenData);
    await bot.connect();

    /**
     * connecting to mongodb
     */
    await client.connect();
    const db = client.db(mongo_db_name);
    const col_users = db.collection('users');

    /**
     * setting up listeners for when streams go live 
     */
    await bot.join('fibubot');
    const users = await col_users.find().toArray();
    for (let user of users) {
        // await bot.subscribeToStreamChanges(user.user);
        await bot.join(user.user);
    }

    /**
     * setting up express api server
     */
    app.use(bodyParser.json());
    app.use(cors());

    // returns all information about a user: steamid, tempusid, spamfilter, customcommands, timedcommands
    app.get('/users/:username', async (req, res) => {
        console.log(`GET request for user: ${req.params.username}`)

        const user_info = await db.collection('users').findOne({user: req.params.username});
        const spamFilter = await db.collection('spamFilter').findOne({user: req.params.username});
        const customCommands = await db.collection('commands').findOne({user: req.params.username});
        const timedCommands = await db.collection('timedCommands').findOne({user: req.params.username});
        return res.status(200).json({user_info, spamFilter, customCommands, timedCommands});
    });

    // updates a user
    app.post('/updateuser/:username', async (req, res) => {
        // console.log(req.body);
        const { tempusId, steamId, tempusOnly, spam, customCommands, timedCommands } = req.body;

        await db.collection('users').updateOne(
            { user: req.params.username }, 
            { $set: { tempusId, steamId, tempusOnly } }
        );

        await db.collection('spamFilter').updateOne(
            { user: req.params.username },
            { $set: { spam } }
        );

        await db.collection('commands').updateOne(
            { user: req.params.username },
            { $set: { cmds: customCommands } }
        );

        await db.collection('timedCommands').updateOne(
            { user: req.params.username },
            { $set: { cmds: timedCommands } }
        );

        const user_info = await db.collection('users').findOne({user: req.params.username});
        const spamFilter = await db.collection('spamFilter').findOne({user: req.params.username});
        const customCommandsN = await db.collection('commands').findOne({user: req.params.username});
        const timedCommandsN = await db.collection('timedCommands').findOne({user: req.params.username});
        return res.status(200).json({user_info, spamFilter, customCommandsN, timedCommandsN});
    });

    app.listen(port, () => {
        console.log(`api listening to port ${port}`);
    })

})();
