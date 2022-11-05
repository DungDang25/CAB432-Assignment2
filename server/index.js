

// const app = express();

// console.log(process.env.bearer_token)
// const client = new Client(process.env.bearer_token);



// async function main() {
//     const stream = client.tweets.sampleStream({
//         "tweet.fields": ["author_id"],
//     });
//     for await (const tweet of stream) {
//         if (tweet.data?.text.includes("Korea")) {
//             console.log("Tweet ID:" + tweet.data?.id + "\nText: " + tweet.data?.text + "\n");
//         }
//     }
// }

require('dotenv').config();
var redis = require("redis");
const express = require("express");
var router = express.Router();
var AWS = require("aws-sdk");
const { env } = require("process");
var { getSentiment } = require("../client/module/sentiment");
const redisClient = redis.createClient({

});

const app = express();

const { TwitterApi } = require('twitter-api-v2');
const { ETwitterStreamEvent } = require('twitter-api-v2');

console.log(process.env.BEARER_TOKEN)


// Configure Twitter Client


const client = new TwitterApi(process.env.BEARER_TOKEN);


// Configure AWS
var configAWS = {

};
AWS.config.update(configAWS);

// Redis stuff







async function main() {
    const rules = await client.v2.streamRules();

    const searchValue = 'TWICE';

    // Counter 
    let i = 0

    // Handle if the rules array is not empty/undefined by default
    if (rules.data !== undefined) {
        console.log(rules.data.map(rule => rule.value));
        while (i < rules.data.length) {
            const value = rules.data[i].value;
            const deleteRules = await client.v2.updateStreamRules({
                delete: {
                    values: [value],
                },
            });
            i++
        }
    }

    const addedRules = await client.v2.updateStreamRules({
        add: [
            { value: `${searchValue}` },
        ],
    });

    const stream = await client.v2.searchStream();

    stream.on(ETwitterStreamEvent.Connected, () => console.log('Stream is started.'));

    stream.on(
        // Emitted when Node.js {response} is closed by remote or using .close().
        ETwitterStreamEvent.ConnectionClosed,
        () => console.log('Connection has been closed.'),
    );

    // Start stream!
    await stream.connect({ autoReconnect: true, autoReconnectRetries: Infinity });
    i = 0
    for await (const { data } of stream) {
        if (i !== 10) {
            console.log('This is my tweet:', data.text);
            console.log(getSentiment(data))
            i++;
            
        }
        else {
            // Delete search parameter after finish
            const deleteRules = await client.v2.updateStreamRules({
                delete: {
                    values: [searchValue],
                },
            });

            // Close stream
            stream.close();
        }
    }
}


main();