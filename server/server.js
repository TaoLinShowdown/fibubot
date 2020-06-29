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
    const users = await col_users.find().toArray();
    for (let user of users) {
        // await bot.subscribeToStreamChanges(user.user);
        await bot.join('fibbbby');
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

    // creates a new user
    app.put('/newuser/:username', async (req, res) => {
        await db.collection('users').insertOne({
            user: req.params.username,
            tempusId: null,
            steamId: null
        });
        await db.collection('commands').insertOne({
            user: req.params.username,
            cmds: {}
        });
        await db.collection('timedCommands').insertOne({
            user: req.params.username,
            cmds: []
        });
        await db.collection('spamFilter').insertOne({
            user: req.params.username,
            spam: []
        });
        return res.json('user has been added');
    });

    // removes a user
    app.delete('/deleteuser/:username', async (req, res) => {
        await db.collection('users').deleteOne({user: req.params.username});
        await db.collection('commands').deleteOne({user: req.params.username});
        await db.collection('timedCommands').deleteOne({user: req.params.username});
        await db.collection('spamFilter').deleteOne({user: req.params.username});
        return res.json('user has been deleted');
    });

    // updates a user

    app.listen(port, () => {
        console.log(`api listening to port ${port}`);
    })

})();
