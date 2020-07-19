const TwitchClient = require('twitch').default;
const ChatClient = require('twitch-chat-client').default;
const WebHookListener = require('twitch-webhooks').default;
const MongoClient = require('mongodb').MongoClient;
const moment = require('moment');
const fs = require('fs-extra');
const request = require('request-promise');

const tempusURI = 'http://tempus.xyz/api';
const mongo_url = 'mongodb://localhost:27017';
const mongo_db_name = 'fibubot';

module.exports =  class fibubot {

    /**
     * just initiates twitchClient and chatClient variables
     */
    constructor() {
        this.twitchClient;
        this.chatClient;
        this.listener;

        this.subs = {};
        this.timedCommands = {};
    }

    /**
     * connects fibubot
     */
    async connect() {
        await this.chatClient.connect();
    }
    
    /**
     * @param {string} clientId 
     * @param {string} clientSecret 
     * @param {object} tokenData {accessToken, refreshToken, expiryTimestamp}
     */
    async setup(clientId, clientSecret, tokenData) {
        this.twitchClient = await this.createTwitchClient(clientId, clientSecret, tokenData);
        this.chatClient = await this.createChatClient();
        this.listener = await this.createListener();

        // sets up mongodb client
        this.mongoClient = new MongoClient(mongo_url, { useUnifiedTopology: true });
        this.mongoClient.connect();
        this.db = this.mongoClient.db(mongo_db_name);
    }

    /**
     * creates twitchClient from credentials
     * @param {string} clientId 
     * @param {string} clientSecret 
     * @param {object} tokenData {accessToken, refreshToken, expiryTimestamp}
     */
    async createTwitchClient(clientId, clientSecret, tokenData) {
        // initiate twitchClient with credentials passed in
        const twitchClient = TwitchClient.withCredentials(clientId, tokenData.accessToken, undefined, {
            clientSecret,
            refreshToken: tokenData.refreshToken,
            expiry: tokenData.expiryTimestamp === null ? null : new Date(tokenData.expiryTimestamp),
            // if accessToken expires, get a new one using
            onRefresh: async ({ accessToken, refreshToken, expiryDate }) => {
                const newTokenData = {
                    accessToken,
                    refreshToken,
                    expiryTimestamp: expiryDate === null ? null : expiryDate.getTime()
                };
                await fs.writeFile('./server/tokens.json', JSON.stringify(newTokenData, null, 4), 'UTF-8')
            }
        });
        return twitchClient;
    }

    /**
     * creates chatClient
     */
    async createChatClient() {
        const chatClient = await ChatClient.forTwitchClient(this.twitchClient);

        chatClient.onPrivmsg(async (channel, user, message, msg) => {
            await this.onmsg(channel, user, message, msg);
        });

        chatClient.onJoin((channel, user) => {
            console.log(`${user} has joined ${channel}`);
        });
        return chatClient;
    }

    /**
     * creates webhook listener
     */
    async createListener() {
        const listener = await WebHookListener.create(this.twitchClient, {
            hostName: 'd8b82ba148c3.ngrok.io',
            port: 8090,
            reverseProxy: { port: 443, ssl: true }
        });
        listener.listen();
        return listener;
    }

    /**
     * subscribe to when stream goes online and offline
     * @param {string} user 
     */
    async subscribeToStreamChanges(user) {
        const userId = (await this.twitchClient.helix.users.getUserByName(user.slice(1))).id;
        const sub = await this.listener.subscribeToStreamChanges(userId, async (stream) => {
            if(stream) {
                console.log(`${stream.userDisplayName} just went live with title: ${stream.title}`);
                await this.join(user);
                await this.createIntervals(user);
            } else {
                console.log(`${user.slice(1)} just went offline`);
                await this.part(user);
                await this.stopIntervals(user);
            }
        });
        await sub.start();
        this.subs[user] = sub;
        console.log(`subscribed to stream changes for ${user}`);
    }

    /**
     * creates intervals for timed commands and adds them to this.timedCommands
     * @param {string} user in the form #fibbbby
     */
    async createIntervals(user) {
        // const timedCommands = JSON.parse(await fs.readFile('./config.json', 'UTF-8')).timedCommands[user];
        const col_timedCommands = this.db.collection('timedCommands');
        const timedCommands = await col_timedCommands.findOne({'user': user});

        this.timedCommands[user] = [];
        for (let cmd of timedCommands.cmds) {
            const interval = setInterval(async () => {
                this.chatClient.say(user, cmd[1]);
            }, cmd[0]);
            this.timedCommands[user].push(interval);
        }
    }

    /**
     * stops intervals for user in this.timedIntervals
     * @param {string} user in the form #fibbbby 
     */
    async stopIntervals(user) {
        const intervals = this.timedCommands[user];
        for (let interval of intervals) {
            clearInterval(interval);
        }
    }

    /**
     * joins twitch channel chat
     * WORKS EVEN IF ERROR IS CAUGHT, NOT SURE WHY
     * @param {string} channel name of twitch channel
     */
    async join(channel) {
        try {
            await this.chatClient.join(channel);
        } catch(error) {
            // console.log(`failed to join ${channel}: ${error}`)
        }
    }

    /**
     * leaves twitch channel chat
     * @param {string} channel name of twitch channel
     */
    async part(channel) {
        try {
            await this.chatClient.part(channel);
        } catch(error) {
            // console.log(`failed to part ${channel}: ${error}`)
        }
    }

    /**
     * callback for chatClient.onPrivmsg()
     * implemented chat commands:
     *  - !ping
     *  - !dice
     *  - !uptime
     *  - !followage
     *  - !title <title>
     *  - !newcmd !<command name> <output>
     *  - !rank / !srank / !drank
     *  - !map / !m
     *  - !swr / !dwr
     *  - !stime / !dtime
     * @param {string} channel 
     * @param {string} user 
     * @param {string} message 
     * @param {object} msg 
     */
    async onmsg(channel, user, message, msg) {
        console.log(message);

        if (channel === "#fibubot") {
            console.log(`${channel}: ${user} said ${message}`);

            if (message.match(/^\!join/g)) {
                if (message.split(' ').length !== 3) {
                    this.chatClient.say(channel, `@${user} make sure to include your Steam ID and Tempus ID in the format !join <steamid> <tempusid>`);
                } else if (message.split(' ').length === 3) {

                    let parsedMsg = message.split(' ');
                    let steamId = parsedMsg[1];
                    let tempusId = parsedMsg[2];

                    if (!steamId.match(/^STEAM_/)) {
                        this.chatClient.say(channel, `@${user} your Steam ID is not valid`);
                    } else if (isNaN(tempusId)) {
                        this.chatClient.say(channel, `@${user} your Tempus ID is not valid`);
                    } else {
                        // follow the user's channel
                        const hUser = await this.twitchClient.helix.users.getUserByName(user);
                        hUser.follow();

                        // check if user is already in the database
                        const user_in_db = await this.db.collection('users').findOne({user: user});
                        if(user_in_db) {
                            await this.db.collection('users').updateOne(
                                { user: user },
                                { $set: { tempusId: tempusId, steamId: steamId } }
                            );
                            this.chatClient.say(channel, `@${user} updated successfully`);
                        } else {
                            await this.db.collection('users').insertOne({
                                user: user,
                                tempusId: tempusId,
                                steamId: steamId
                            });
                            await this.db.collection('commands').insertOne({
                                user: user,
                                cmds: {}
                            });
                            await this.db.collection('timedCommands').insertOne({
                                user: user,
                                cmds: []
                            });
                            await this.db.collection('spamFilter').insertOne({
                                user: user,
                                spam: []
                            });
                            this.chatClient.say(channel, `@${user} joined successfully`);
                        }
                    }
                }
            } else if (message === "!unregister") {
                const user_in_db = await this.db.collection('users').findOne({user: user});
                if(user_in_db) {
                    await this.db.collection('users').deleteOne({user: user});
                    await this.db.collection('commands').deleteOne({user: user});
                    await this.db.collection('timedCommands').deleteOne({user: user});
                    await this.db.collection('spamFilter').deleteOne({user: user});

                    this.chatClient.say(channel, `@${user} unregistered successfully`);
                } else {
                    this.chatClient.say(channel, `@${user} you haven't registered yet`);
                }
            }

        } else {

            // simple ping command
            if (message === '!ping') {
                console.log(`${channel}: ${user} said !ping`);
                this.chatClient.say(channel, 'Pong!');
            
            // gets uptime of stream, if the stream is live
            } else if (message === '!uptime') {
                console.log(`${channel}: ${user} said ${message}`);
                const stream = await this.twitchClient.helix.streams.getStreamByUserName(channel.slice(1)); // WAIT A COUPLE MINUTES AFTER GOING LIVE FOR THIS TO NOT RETURN NULL
                
                if(stream) {
                    const uptime = moment(stream.startDate).fromNow(true);
                    this.chatClient.say(channel, `live for ${uptime}`);
                } else {
                    this.chatClient.say(channel, `streamer is offline!`);
                }
                
            // gets followage of user to channel, if the user is following
            } else if (message === '!followage') {
                console.log(`${channel}: ${user} said ${message}`);
                const hUser = await this.twitchClient.helix.users.getUserByName(user);
                const streamer = await this.twitchClient.helix.users.getUserByName(channel.slice(1));
                const follows = await hUser.follows(streamer);
                if (follows) {
                    const followInfo = await hUser.getFollowTo(streamer);
                    const followDate = moment(followInfo.followDate).fromNow(true);
        
                    this.chatClient.say(channel, `${user} has been following for ${followDate}`);
                }
        
            // gets title of stream, or if user is mod, changes title
            } else if (message.match(/^\!title/g)) {
                console.log(`${channel}: ${user} said ${message}`);
                const streamer = await this.twitchClient.helix.users.getUserByName(channel.slice(1));
                const kChannel = await this.twitchClient.kraken.channels.getChannel(streamer);
        
                if (message.split(" ").length > 1 && (msg.userInfo.badges.has('moderator') || msg.userInfo.badges.has('broadcaster'))) {
                    const newTitle = message.slice(7);
                    const newData = {
                        "status": newTitle
                    };
        
                    await this.twitchClient.kraken.channels.updateChannel(kChannel, newData);
                    this.chatClient.say(channel, `title changed to "${newTitle}"`);
                } else {
                    this.chatClient.say(channel, `${kChannel.status}`);
                }
        
            // registers a new custom command for the channel
            } else if (message.match(/^\!newcmd/g)) {
                console.log(`${channel}: ${user} said ${message}`);
                if (message.split(" ").length > 2 && (msg.userInfo.badges.has('moderator') || msg.userInfo.badges.has('broadcaster'))) {
                    const commandName = message.split(" ")[1];
                    if (commandName[0] !== "!") {
                        this.chatClient.say(channel, `format the command like "!newcommand !<command name> <output text>"`);
                    } else {
                        const commandOutput = message.slice(commandName.length + 9); // 9 = !newcmd + whitespace
        
                        const col_customCommands = this.db.collection('commands');
                        const commandData = (await col_customCommands.findOne({user: channel.slice(1)})).cmds;
                        commandData[commandName] = commandOutput;

                        col_customCommands.updateOne(
                            { user: channel.slice(1) },
                            { $set: { cmds: commandData } }
                        );
        
                        this.chatClient.say(channel, `added new command ${commandName}`);
                    }
        
                } else if ((msg.userInfo.badges.has('moderator') || msg.userInfo.badges.has('broadcaster'))) {
                    this.chatClient.say(channel, `format the command like "!newcommand !<command name> <output text>"`);
                }
        
            
            /* 
            * TEMPUS - get rank/srank/drank of user
            * Tempus | (Soldier) fibu is ranked 186/56963 with 26458 points
            * Tempus | (Overall) fibu is ranked 315/75729 with 27493 points
            * Tempus | (Demoman) fibu is ranked 1262/39099 with 1035 points 
            */
            } else if (message === '!rank' || message === '!srank' || message === '!drank') {
                console.log(`${channel}: ${user} said ${message}`);
                // const tempusId = JSON.parse(await fs.readFile('./config.json', 'UTF-8')).users[channel].tempusId;
                const col_users = this.db.collection('users');
                const tempusId = (await col_users.findOne({user: channel.slice(1)})).tempusId;
                const rankData = await request(`${tempusURI}/players/id/${tempusId}/rank`, {json: true});
        
                if (message === '!rank') {
                    const rank = rankData.rank_info;
                    this.chatClient.say(channel, `(Overall) ${channel.slice(1)} is ranked ${rank.rank}/${rank.total_ranked} with ${rank.points} points`);
                } else if (message === '!srank') {
                    const rank = rankData.class_rank_info['3'];
                    this.chatClient.say(channel, `(Soldier) ${channel.slice(1)} is ranked ${rank.rank}/${rank.total_ranked} with ${rank.points} points`);
                } else if (message === '!drank') {
                    const rank = rankData.class_rank_info['4'];
                    this.chatClient.say(channel, `(Demoman) ${channel.slice(1)} is ranked ${rank.rank}/${rank.total_ranked} with ${rank.points} points`);
                }
            
        
            /**
             * TEMPUS - get map data of user
             * Tempus | jump_vulc_a2 by Torii
             * Tempus | Solly T6 | Demo T4
             */
            } else if (message === '!map' || message === '!m') {
                console.log(`${channel}: ${user} said ${message}`);
                // const steamId = JSON.parse(await fs.readFile('./config.json', 'UTF-8')).users[channel].steamId;
                const col_users = this.db.collection('users');
                const steamId = (await col_users.findOne({user: channel.slice(1)})).steamId;
                const servers = await request(`${tempusURI}/servers/statusList`, {json: true});
                
                // for each server, check if playerCount is > 0
                let flag = 0;
                for (let server of servers) {
                    if (flag) break;
                    if (server.game_info && server.game_info.playerCount > 0) {
                        for (let user of server.game_info.users) {
                            if (user.steamid === steamId) {
                                const map = server.game_info.currentMap;
                                const mapInfo = await request(`${tempusURI}/maps/name/${map}/fullOverview`, {json: true});
                                this.chatClient.say(channel, `${map} | Solly T${mapInfo.tier_info.soldier} | Demo T${mapInfo.tier_info.demoman}`);
        
                                flag = 1;
                                break;
                            }
                        }
                    }
                }
                if(!flag) {
                    this.chatClient.say(channel, `${channel.slice(1)} isn't in any Tempus server`);
                }
                
        
            /**
             * TEMPUS - get swr/dwr of current map
             * Tempus | (Solly WR) jump_it_final :: 03:55.04 :: Boshy
             * Tempus | (Demo WR) jump_it_final :: 03:30.48 :: Boshy
             */
            } else if (message === '!swr' || message === '!dwr') {
                console.log(`${channel}: ${user} said ${message}`);
                // const steamId = JSON.parse(await fs.readFile('./config.json', 'UTF-8')).users[channel].steamId;
                const col_users = this.db.collection('users');
                const steamId = (await col_users.findOne({user: channel.slice(1)})).steamId;
                const servers = await request(`${tempusURI}/servers/statusList`, {json: true});
                
                // for each server, check if playerCount is > 0
                let flag = 0;
                for (let server of servers) {
                    if (flag) break;
                    if (server.game_info && server.game_info.playerCount > 0) {
                        for (let user of server.game_info.users) {
                            if (user.steamid === steamId) {
                                const map = server.game_info.currentMap;
                                const mapInfo = await request(`${tempusURI}/maps/name/${map}/fullOverview`, {json: true});
        
                                if (message === '!swr') {
                                    const wr = mapInfo.soldier_runs[0];
                                    const time = moment(wr.duration*1000).format('mm:ss.SS');
                                    this.chatClient.say(channel, `(Solly WR) ${map} :: ${time} :: ${wr.name}`);
                                } else {
                                    const wr = mapInfo.demoman_runs[0];
                                    const time = moment(wr.duration*1000).format('mm:ss.SS');
                                    this.chatClient.say(channel, `(Demo WR) ${map} :: ${time} :: ${wr.name}`);
                                }
        
                                flag = 1;
                                break;
                            }
                        }
                    }
                }
                if(!flag) {
                    this.chatClient.say(channel, `${channel.slice(1)} isn't in any Tempus server`);
                }
        
        
            /**
             * TEMPUS - get personal best time, ONLY IF YOU ARE IN TOP 50
             * Tempus | (Solly) Torii is ranked 10/472 on jump_finite_v2 with time: 04:11.60
             * Tempus | (Demo) hee is ranked 10/551 on jump_finite_v2 with time: 02:04.60
             */
            } else if (message === '!stime' || message === '!dtime') {
                console.log(`${channel}: ${user} said ${message}`);
                // const steamId = JSON.parse(await fs.readFile('./config.json', 'UTF-8')).users[channel].steamId;
                const col_users = this.db.collection('users');
                const steamId = (await col_users.findOne({user: channel.slice(1)})).steamId;
                const servers = await request(`${tempusURI}/servers/statusList`, {json: true});
                
                // for each server, check if playerCount is > 0
                let flag = 0;
                let runFound = 0;
                for (let server of servers) {
                    if (flag) break;
                    if (server.game_info && server.game_info.playerCount > 0) {
                        for (let user of server.game_info.users) {
                            if (user.steamid === steamId) {
                                const map = server.game_info.currentMap;
                                const mapInfo = await request(`${tempusURI}/maps/name/${map}/zones/typeindex/map/1/records/list`, {json: true});
        
                                if (message === '!stime') {
                                    const runs = mapInfo.results.soldier;
                                    for (let run of runs) {
                                        if (run.player_info.steamid === steamId) {
                                            const time = moment(run.duration*1000).format('mm:ss.SS');
                                            this.chatClient.say(channel, `(Solly) ${channel.slice(1)} is ranked ${run.rank} on ${map} with time: ${time}`);
                                            runFound = 1;
                                        }
                                    }
                                    
                                } else {
                                    const runs = mapInfo.results.demoman;
                                    for (let run of runs) {
                                        if (run.player_info.steamid === steamId) {
                                            const time = moment(run.duration*1000).format('mm:ss.SS');
                                            this.chatClient.say(channel, `(Demo) ${channel.slice(1)} is ranked ${run.rank} on ${map} with time: ${time}`);
                                            runFound = 1;
                                        }
                                    }
                                }
        
                                flag = 1;
                                break;
                            }
                        }
                    }
                }
                if(!flag) {
                    this.chatClient.say(channel, `${channel.slice(1)} isn't in any Tempus server`);
                } else if (flag && !runFound) {
                    this.chatClient.say(channel, `No run found within top 50`);
                }
            
            } else {
        
                // check for filtered words as last thing
                const col_spamFilter = this.db.collection('spamFilter');
                const filterList = (await col_spamFilter.findOne({user: channel.slice(1)})).spam;
                for (let badword of filterList) {
                    if (message.includes(badword)) {
                        console.log(`${channel}: ${user} said "${message}" which contains a bad word`);
                        this.chatClient.say(channel, `${user}, you've been timed out for 30 seconds, stop saying bad words`);
                        break;
                    }
                }
        
                // check for custom commands
                const col_customCommands = this.db.collection('commands');
                const customCommands = (await col_customCommands.findOne({user: channel.slice(1)})).cmds;
                for (let commandName in customCommands) {
                    if (message === commandName) {
                        console.log(`${channel}: ${user} said ${message}`);
                        this.chatClient.say(channel, `${customCommands[commandName]}`);
                        break;
                    }
                }
            }
        }
    }    

}