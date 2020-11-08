/*
 * A utility for retrieving the values of console variables.
 *
 * Console variables are normally set by naming them and specifying their value like so: "voice_loopback 1".
 * To retrieve the current value of a console variable, you can simply submit its name and the console will return
 * its value. The format is a little loose so this utility provides helper functions for retrieving the values.
 * Here is the output from submitting "game_mode":
 *
 * "game_mode" = "1" ( def. "0" ) game client replicated                            - The current game mode (based on game type). See GameModes.txt.
 */
const net = require('net');
const readline = require('readline');
const ini = require('ini');
const fs = require('fs');

const config = ini.parse(fs.readFileSync('./config.ini', 'utf-8'));

const whitespaceRegExp = /\s{2,}/g;
const paddingDashesRegExp = RegExp('-{2,}');
const voicePlayerVolumeRegExp = RegExp('(\\d+)\ +(.*)\ +(\\d\\.\\d{2})')
const cvarEchoRegExp = RegExp('^\"([a-zA-Z_]+)\" = \"(\\d+)\".*');
const mapFromStatusRegExp = RegExp('^map\ +: ([a-zA-Z_]+) at:.*');
const port = config.csgo.netcon_port;
const gameModeStrings = [
    ["casual", "armsrace", "training", "custom", "cooperative", "skirmish"],
    ["competitive", "demolition"],
    ["wingman", "deathmatch"]
];


/**
 * See https://totalcsgo.com/command/gametype
 * @returns {Promise<string>} the human friendly summarization of what
 * game mode is being played. This ignores the case of Scrim Competitive 5v5
 * and will always refer to Scrim Competitive 5v5 and 2v2 as "wingman".
 */
const getGameModeString = async () => {
    const gameMode = await getCvar('game_mode');
    const gameType = await getCvar('game_type');

    return gameModeStrings[gameMode][gameType];
}

const getCvar = async (cvarName) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.setEncoding('utf8');
    const reader = readline.createInterface({
        input: socket,
        crlfDelay: Infinity
    });
    socket.write(`${cvarName}\n`);
    for await (const line of reader) {
        if (cvarEchoRegExp.test(line)) {
            let cvarOutput = cvarEchoRegExp.exec(line);
            if (cvarOutput[1] === cvarName) {
                reader.close();
                socket.end();
                return Number(cvarOutput[2]);
            }
        }
    }
}

const setCvar = (cvarName, value) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.setEncoding('utf8');
    socket.write(`${cvarName} ${value}\n`);
    socket.end();
}

const setVoicePlayerVolumeByName = async (playerName, volume) => {
    let players = await getVoicePlayerVolumeValues();
    await setVoicePlayerVolume(players.find(value => value.PlayerName === playerName).PlayerNumber, volume);
}

const setVoicePlayerVolume = async (playerNumber, volume) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.setEncoding('utf8');
    socket.write(`voice_player_volume ${playerNumber} ${volume}\n`);
    socket.end();
}

const getVoicePlayerVolumeValues = async () => {
    const isVoicePlayerVolumePadding = (text) => {
        const processedLine = text.replace(whitespaceRegExp, ' ').trim();
        const splitText = processedLine.split(' ');
        let parsedLineIsPaddingCharacters = true;
        for (let element of splitText) {
            if (!paddingDashesRegExp.test(element)) {
                parsedLineIsPaddingCharacters = false;
                break;
            }
        }
        return parsedLineIsPaddingCharacters;
    }
    let players = [];
    let reading = false;

    const socket = net.connect(port, '127.0.0.1');
    socket.setEncoding('utf8');
    const reader = readline.createInterface({
        input: socket,
        crlfDelay: Infinity
    });

    socket.write('voice_player_volume\n');

    for await (const line of reader) {
        if (reading) {
            if (isVoicePlayerVolumePadding(line)) {
                //The second time we see padding, the command output is effectively done.
                reading = false;
                reader.close();
                socket.end();
                return players;
            }

            let playerInfo = voicePlayerVolumeRegExp.exec(line);
            const playerVolume = {
                PlayerNumber: playerInfo[1],
                PlayerName: playerInfo[2].trim(),
                Volume: playerInfo[3],
            };
            if (reading) {
                players.push(playerVolume);
            }
        }
        if (isVoicePlayerVolumePadding(line)) {
            reading = true;
            players = [];
        }
    }
}

const getMapName = async (excludePrefix) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.setEncoding('utf8');
    const reader = readline.createInterface({
        input: socket,
        crlfDelay: Infinity
    });
    socket.write('status\n');
    for await (const line of reader) {
        if (mapFromStatusRegExp.test(line)) {
            let mapLine = mapFromStatusRegExp.exec(line);
            reader.close();
            socket.end();
            if (excludePrefix) {
                return mapLine[1].substr(mapLine[1].indexOf('_') + 1);
            } else {
                return mapLine[1];
            }
        }
    }
}

module.exports = bruh = {
    setVoicePlayerVolumeByName,
    getCvar,
    setCvar,
    getGameModeString,
    getMapName,
}

// (async () => {
//     let output = await getVoicePlayerVolumeValues();
//     console.log(output);
// })();