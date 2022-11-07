require('dotenv').config();
var redis = require("redis");
const express = require("express");
var router = express.Router();
const AWS = require("aws-sdk");
const { env } = require("process");
var { getSentiment } = require("../../client/module/sentiment");

const app = express();

const { TwitterApi } = require('twitter-api-v2');
const { ETwitterStreamEvent } = require('twitter-api-v2');



// Configure Twitter Client
const client = new TwitterApi(process.env.BEARER_TOKEN);


// Configure AWS
// Create unique bucket name
const bucketName = "n10693769-twitter-sentiment"
AWS.config.update({ region: 'ap-southeast-2' });
const s3 = new AWS.S3({ apiVersion: "2006-03-01", region: AWS.config.region });

async function bucketCreate(bucketName) {
    try {
        await s3.createBucket({ Bucket: bucketName }).promise();
        console.log(`Created bucket: ${bucketName}`);
    } catch (err) {
        // We will ignore 409 errors which indicate that the bucket already exists
        if (err.statusCode !== 409) {
            console.log(`Error creating bucket: ${err}`);
        }
    }
}

// Configure Redis
const redisClient = redis.createClient();
async function redisConnect() {
    try {
        await redisClient.connect();
    } catch (err) {
        console.log(err);
    }
}

// MAIN FUNCTIONS
// async function cache_store(data, bucketName, res) {
//     const redisKey = 'sentimentValues'

//     const result = await redisClient.get(redisKey)

//     const params = { Bucket: bucketName, Key: redisKey };

//     if (result) {
//         // Serve from redis
//         console.log("Redis")
//         const resultJSON = JSON.parse(result);
//         res.json(resultJSON);
//     } else {
//         // Check if in S3
//         try {
//             const s3Result = await s3.getObject(params).promise();
//             console.log("here")
//             // Serve from S3
//             const s3JSON = JSON.parse(s3Result.Body);
//             res.json(s3JSON);
//             s3JSON.source = "Redis Cache"
//             redisClient.setEx(
//                 redisKey,
//                 3600,
//                 JSON.stringify({ ...s3JSON })
//             );
//         } catch (err) {
//             if (err.statusCode === 404) {
//                 // Serve from Wikipedia API
//                 const response = await axios.get(searchUrl);
//                 const responseJSON = response.data;
//                 const body = JSON.stringify({
//                     source: "S3 Bucket",
//                     ...responseJSON,
//                 });
//                 const objectParams = { Bucket: bucketName, Key: redisKey, Body: body };
//                 await s3.putObject(objectParams).promise();
//                 console.log(`Successfully uploaded data to ${bucketName}/${redisKey}`);
//                 redisClient.setEx(
//                     redisKey,
//                     3600,
//                     JSON.stringify({ source: "Redis Cache", ...responseJSON })
//                 );
//                 res.json({ source: "Wikipedia API", ...responseJSON });
//             } else {
//                 // Something else went wrong when accessing S3
//                 res.json(err);
//             }
//         }
//     }
// }

async function stream(topic, res) {
    const rules = await client.v2.streamRules();

    const array = []
    const searchQuery = `${topic} lang:en -is:retweet`

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

    // Add search value to stream
    const addedRules = await client.v2.updateStreamRules({
        add: [
            { value: `${searchQuery}` },
        ],
    });

    const stream = await client.v2.searchStream();

    stream.on(
        // Emitted when Node.js {response} is closed by remote or using .close().
        ETwitterStreamEvent.ConnectionClosed,
        () => console.log('Connection has been closed.'),
    );

    // Start stream!
    await stream.connect({ autoReconnect: true, autoReconnectRetries: Infinity });
    i = 0
    for await (const { data } of stream) {
        if (i !== 100) {
            //console.log(data.text);
            //console.log(getSentiment(data))
            array[i] = data.text
            i++;
            // res.(data.tex)
        }
        else {
            // Delete search parameter after finish
            const deleteRules = await client.v2.updateStreamRules({
                delete: {
                    values: [searchQuery],
                },
            });
            console.log(i)
            console.log(array)
            // res.send(array)
            // Close stream
            stream.close();
        }
    }
}

app.get('/stream', (req, res) => {
    const topic = req.headers.topic
    stream(topic, res)
})

stream('COVID', 'res');

app.listen(3001);