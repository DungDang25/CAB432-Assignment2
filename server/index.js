require("dotenv").config();
var redis = require("redis");
const express = require("express");
var router = express.Router();
const AWS = require("aws-sdk");
const { env } = require("process");
const axios = require("axios");
const { getSentiment } = require("./module/sentiment");
const cors = require('cors')

const app = express();
app.use(cors())

// ============ Configure Twitter Functions ============
const twitter = require("twitter-api-sdk");
const { write } = require("fs");
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

// Write S3
async function s3Write(bucketName, key, query, data) {
  await s3
    .putObject({
      Bucket: bucketName,
      Key: key,
      Body: JSON.stringify({
        key: query,
        timestamp: `${new Date().toISOString()}`,
        data: data,
      }),
    })
    .promise();
}

//async function s3Read()

// ============ Configure Redis and Redis Functions ============
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

// Write to Redis
function redisWrite(key, data) {
  redisClient.setEx(key, 3600, JSON.stringify(data));
}

// ============ MAIN FUNCTIONS ============
function checkDate(data) {
  if (typeof data === "undefined" || !Object.keys(data).length) {
    return 0;
  }

  if (data) {
    const then = new Date(data);
    const now = new Date();
    const msBetweenDates = Math.abs(then.getTime() - now.getTime());
    const hoursBetweenDates = msBetweenDates / (60 * 60 * 1000);
    if (hoursBetweenDates < 12) {
      return 1;
    } else {
      return 0;
    }
  }
}

app.get("/getTweets", async (req, res) => {
    const query = req.headers.query;
    const key = `${query}-tracker`;

    const tracker = await redisClient.get(key);
  
    bucketCreate(bucketName);
  
    const params = { Bucket: bucketName, Key: key };

    if (tracker && checkDate(JSON.parse(tracker).timestamp)) {
      // Serve from redis
      console.log("============ Serve from Redis ============");
      console.log("Redis");
      const trackerJSON = JSON.parse(tracker);
      console.log(trackerJSON);
      //resolve.json(trackerJSON);
      res.send(trackerJSON)
    } else {
      s3.headObject(params, async function (resolve, err) {
        if (resolve && resolve.name === "NotFound") {
          // Serve from Twitter API
          console.log(
            "============ Not Found in S3 Or Redis. Serve From Twitter ============"
          );
          const response = getTweets(query);
          let data;
          // Convert data to csv format
          await response.then(function (result) {
            data = result
          });
          // store to s3
          s3Write(bucketName, key, query, data)
          // cache into redis
          const trackerRedis = {
            key: query,
            timestamp: `${new Date().toISOString()}`,
            data: data,
          };
          redisClient.setEx(key, 3600, JSON.stringify(trackerRedis));
          console.log(trackerRedis)
          res.send(trackerRedis)
        } else {
          console.log("============ Not found in Redis. Check S3 ============");
          // Get tracker
          const s3Tracker = await s3.getObject(params).promise();
          const trackerJSON = JSON.parse(s3Tracker.Body);
          if (checkDate(trackerJSON.timestamp) === 0) {
            const response = getTweets(query);
            let data;
            // Convert data to csv format
            await response.then(function (result) {
              data = result
            });
            // store to s3
            s3Write(bucketName, key, query, data)
            const trackerRedis = {
              key: query,
              timestamp: `${new Date().toISOString()}`,
              data: data
            };
            redisWrite(key, trackerRedis);
            res.send(trackerRedis)
          } else {
            redisClient.setEx(key, 3600, JSON.stringify(trackerJSON));
            res.send(trackerJSON)
          }
        }
      });
    }
});

app.listen(3001);
