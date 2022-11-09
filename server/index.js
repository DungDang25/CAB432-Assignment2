require("dotenv").config();
var redis = require("redis");
const express = require("express");
var router = express.Router();
const AWS = require("aws-sdk");
const { env } = require("process");
const axios = require("axios");
const { getSentiment } = require("../client/module/sentiment");
const csvjson = require("csvjson");
const csv = require("csvtojson");

const app = express();

// ============ Configure Twitter Functions ============
const twitter = require("twitter-api-sdk");
const BEARER_TOKEN = process.env.BEARER_TOKEN;

//const query = req.headers.query
async function getTweets(query) {
  try {
    const response = await axios.get(
      `https://api.twitter.com/2/tweets/search/recent?query=${query}%20lang%3Aen%20-is%3Aretweet&max_results=10&tweet.fields=author_id,created_at,id`,
      {
        headers: {
          Authorization: `Bearer ${BEARER_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    const tweetSentiments = [];
    for (let i = 0; i < response.data.data.length; i++) {
      const sentiment = getSentiment(response.data.data[i]);
      tweetSentiments[i] = {
        sentiment: sentiment.sentiment,
        sentimentValue: sentiment.sentiment_value,
      };
    }
    return tweetSentiments;
  } catch (e) {
    const errorLog = e;
    console.error(errorLog);
    return 0;
  }
}

// ============ Configure AWS and s3 functions ============

// For local dev
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const sessionToken = process.env.AWS_SESSION_TOKEN;
console.log(`AWS Key ID: ${accessKeyId} \n`);
console.log(`AWS Secret Key: ${secretAccessKey} \n`);
console.log(`AWS Session Token: ${sessionToken} \n`);
const region = "ap-southeast-2";
const bucketName = "n10693769-twitter-sentiment";

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
};

AWS.config.update(AWSConfig);
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

// ============ Configure Redis ============
// On scaling
// const elasti =
//   "n10693769-assignment-2-001.n10693769-assignment-2.km2jzi.apse2.cache.amazonaws.com:6379";
// const redisClient = redis.createClient({
//   url: `redis://${elasti}`,
// });

// Local dev
const redisClient = redis.createClient();
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.log(err);
  }
})();

// ============ MAIN FUNCTIONS ============
async function cache_store(query, bucketName, res) {
  const redisKey = `${query}.csv`;

  const result = await redisClient.get(redisKey);
  const resultCounter = await redisClient.get(`${query}-counter.txt`);

  bucketCreate(bucketName);

  const params = { Bucket: bucketName, Key: redisKey };

  if (result && resultCounter) {
    // Serve from redis
    console.log("============ Serve from Redis ============");
    console.log("Redis");
    const resultJSON = JSON.parse(result);
    const counterJSON = JSON.parse(resultCounter);
    //res.json(resultJSON);
    console.log(resultJSON);
    console.log(counterJSON)
  } else {
    s3.headObject(params, async function (res, err) {
      if (res && res.name === "NotFound") {
        // Serve from Twitter API
        console.log(
          "============ Not Found in S3 Or Redis. Serve From Twitter ============"
        );
        const response = getTweets(query);
        let csvData;
        // Convert data to csv format
        await response.then(function (result) {
          csvData = csvjson.toCSV(result, { headers: "key" });
        });

        // store new counter text file
        await s3
          .putObject({
            Bucket: bucketName,
            Key: `${query}-counter.txt`,
            Body: `counter=1`,
          })
          .promise();
        // cache counter into redis
        redisClient.setEx(
          `${query}-counter.txt`,
          3600,
          JSON.stringify({ key: query, data: 1 })
        );
        // s3 params for csv
        const objectParams = {
          Bucket: bucketName,
          Key: redisKey,
          Body: csvData,
          ContentType: "text/csv",
        };
        // store csv in s3
        await s3.putObject(objectParams).promise();
        console.log(`Successfully uploaded data to ${bucketName}/${redisKey}`);
        // Cache data in redis
        redisClient.setEx(
          redisKey,
          3600,
          JSON.stringify({ key: query, data: csvData })
        );
        await response.then(function (result) {
          //res.send([result, 1]);
          console.log([result, 1]);
        });
      } else if (res) {
        // Handle other errors here....
        console.log(err);
      } else {
        console.log("============ Not found in Redis. Check S3 ============");
        const s3Result = s3.getObject(params).createReadStream();
        console.log(s3Result);
        // Serve from S3
        const s3JSON = await csv().fromStream(s3Result);
        console.log(s3JSON);
        //res.json(s3JSON);
        s3JSON.source = "Redis Cache";
        redisClient.setEx(
          redisKey,
          3600,
          JSON.stringify({ key: query, data: s3JSON })
        );
      }
    });
    // Not found in Redis. Check if in S3
  }
}

// app.get("/getTweets", (req, res) => {
//     const query = req.headers.query;
//     cache_store(query, bucketName, res)
// });

cache_store("Vietnam", bucketName, "res");

//app.listen(3001);
