require('dotenv').config();
var redis = require("redis");
const express = require("express");
var router = express.Router();
const AWS = require("aws-sdk");
const { env } = require("process");
const axios = require("axios");
const { getSentiment } = require("../client/module/sentiment");
const csvjson = require('csvjson');

const app = express();

// ============ Configure Twitter Functions ============ 
const twitter = require("twitter-api-sdk")
const BEARER_TOKEN = process.env.BEARER_TOKEN

//const query = req.headers.query
async function getTweets(query) {
    try {
        const response = await axios.get(
            `https://api.twitter.com/2/tweets/search/recent?query=${query}%20lang%3Aen%20-is%3Aretweet&max_results=10&tweet.fields=author_id,created_at,id`,
            {
                headers: {
                    Authorization: `Bearer ${BEARER_TOKEN}`,
                    'Content-Type': 'application/json'
                },
            }
        );
        //console.log(response.data.data)
        const tweetSentiments = []
        for (let i = 0; i < response.data.data.length; i++) {
            console.log(response.data.data[i].text)
            const sentiment = getSentiment(response.data.data[i])
            tweetSentiments[i] = {sentiment: sentiment.sentiment, sentimentValue: sentiment.sentiment_value}
        }
        const body = JSON.stringify({
            source: "S3 Bucket",
            ...tweetSentiments,
        });
        console.log(tweetSentiments)
        console.log(body)
        return tweetSentiments
    } catch (e) {
        const errorLog = e;
        console.error(errorLog);
        return 0
    }
}


// ============ Configure AWS and s3 functions ============ 

// For local dev
const accessKeyId = process.env.AWS_ACCESS_KEY_ID
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
const sessionToken = process.env.AWS_SESSION_TOKEN
console.log(`AWS Key ID: ${accessKeyId} \n`)
console.log(`AWS Secret Key: ${secretAccessKey} \n`)
console.log(`AWS Session Token: ${sessionToken} \n`)
const region = "ap-southeast-2";
const bucketName = "n10693769-twitter-sentiment"

// For when scaling
// AWS.config.credentials = new AWS.EC2MetadataCredentials({
//     httpOptions: { timeout: 5000 }, // 5 second timeout
//     maxRetries: 10, // retry 10 times
//     retryDelayOptions: { base: 200 }, // see AWS.Config for information
//     logger: console // see AWS.Config for information
// });

const AWSConfig = {
    region,
    accessKeyId,
    secretAccessKey,
    sessionToken,
}

AWS.config.update(AWSConfig)
var s3 = new AWS.S3();

// Create unique bucket name
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
const elasti = 'n10693769-assignment-2-001.n10693769-assignment-2.km2jzi.apse2.cache.amazonaws.com:6379'
const redisClient = redis.createClient({
    url: `redis://${elasti}`
});

// MAIN FUNCTIONS
async function cache_store(query, bucketName, res) {
    const redisKey = `query:${query}`
    
    const result = await redisClient.get(redisKey)

    const params = { Bucket: bucketName, Key: redisKey };

    if (result) {
        // Serve from redis
        console.log("Redis")
        const resultJSON = JSON.parse(result);
        res.json(resultJSON);
    } else {
        // Not found in Redis. Check if in S3
        try {
            const s3Result = await s3.getObject(params).promise();
            // Serve from S3
            const s3JSON = JSON.parse(s3Result.Body);
            res.json(s3JSON);
            s3JSON.source = "Redis Cache"
            redisClient.setEx(
                redisKey,
                3600,
                JSON.stringify({ ...s3JSON })
            );
        } catch (err) {
            if (err.statusCode === 404) {
                // Serve from Twitter API
                const response = getTweets(query);
                //const response = await axios.get(searchUrl);
                //const responseJSON = response.data;
                // const body = JSON.stringify({
                //     source: "S3 Bucket",
                //     ...responseJSON,
                // });
                const csvData = csvjson.toCSV(response, { headers: 'key' });
                const objectParams = { Bucket: bucketName, Key: redisKey, Body: csvData };
                await s3.putObject(objectParams).promise();
                console.log(`Successfully uploaded data to ${bucketName}/${redisKey}`);
                redisClient.setEx(
                    redisKey,
                    3600,
                    JSON.stringify({ source: "Redis Cache", ...responseJSON })
                );
                res.json({ source: "Wikipedia API", ...responseJSON });
            } else {
                // Something else went wrong when accessing S3
                res.json(err);
            }
        }
    }
}

app.get('/getTweets', (req, res) => {
    const query = req.headers.query
    const tweets = getTweets(query, res)

})

getTweets('COVID');

app.listen(3001);