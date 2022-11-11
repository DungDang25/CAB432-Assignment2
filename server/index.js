require("dotenv").config();
var redis = require("redis");
const express = require("express");
var router = express.Router();
const AWS = require("aws-sdk");
const { env } = require("process");
const axios = require("axios");
const { getSentiment } = require("./module/sentiment");
const cors = require('cors')
const path = require('path');

const app = express();
app.use(cors())

// ============ Configure Twitter Functions ============
const twitter = require("twitter-api-sdk");
const BEARER_TOKEN = process.env.BEARER_TOKEN;

/**
 * 
 * @param {string} query 
 * @returns array 
 */
async function getTweets(query) {
  try {
    const response = await axios.get(
      `https://api.twitter.com/2/tweets/search/recent?query=${query}%20lang%3Aen%20-is%3Aretweet&max_results=100&tweet.fields=author_id,created_at,id`,
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
        id: response.data.data[i].id
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
// const accessKeyId = "ASIA5DYSEEJ45GGQR4ND"
// const secretAccessKey = "gSL6Fd7f+Duv4gLW+dgC6Q7KrlgkJrLHj33Kk3V5"
// const sessionToken = "IQoJb3JpZ2luX2VjEJT//////////wEaDmFwLXNvdXRoZWFzdC0yIkcwRQIhALf4V3/iBcI4LjAV/wQNfHCDLyGC011lzYDr0KJBJ7QmAiBtczYTNKE60ytFb7w9XFJPzzXNUoMBO7pLp4d+2+yf7Sq5AwiN//////////8BEAIaDDkwMTQ0NDI4MDk1MyIMSAEm19KBJNDJNef0Ko0DuVqHySmpRKiiI2AwGU2tWv3s1l28LMf5pRSS4sOWAdOvlJvkQnALHCqpDr8jDGIDZqJpxU9puNBdooGy1gtC9PAcMhe6+o6uSnd/+UK1U6A+ttSF0hiZQKn2kV6zhF8Ai1JyN+Ksflq/Bn8fRT9wJZIGmzdKLZDPktFwFOz/25P7uCMbvIE6GF6JiJ8b8c2PGNT7AAEIDxO9JoOTDJmYM25jxWKkn1Lfe62We+39uR5KnApa7sS18ia0CpwG3mWDDniQ5aACHGLrgKU5hmgqLDJoH5seVH0/BGG4L74t2tbfm6ZY6RuV0lQYHzUs50ojXJ5kvCCpUxIaLYNNTU/Yv4rXqNXO/fe7vx9+dN1pmFmCEzJVvvTMcbKajaWFmMFYi97RQwoodE9/dJuNPURbfV7qwfiTHaPxi5B8m5gArCdcJ1z0DNng5ceyLAJlzJqHtkv2+GXn9OLr0Fou3lTa8q4dyYn+B+r0BPbTvv+k5x5q5F+LMtXhL2exAL38dGEbnbDXA4uTaT9i0448czCD4ribBjqmAYC4qt6YMGFNqAV00h8qK39a0R+aAj/RYHd2SNObnE48IhJTs394FfZrPjw9gGRfUUrBJdum+FVeviPpNZ/S8rx5TdDjxQXrqQu3ohdSUSgkPj57QJY97CxXVd394G4BOUBBC8OwjNHp9gIFUryA2mtEfbiWlxiITpLw/ZSDYQ3SQPScQkLBZL542gM9/eLcxp4KzPshWUbLnyFd2nYPH0NmM/FvD5U="
// console.log(`AWS Key ID: ${accessKeyId} \n`);
// console.log(`AWS Secret Key: ${secretAccessKey} \n`);
// console.log(`AWS Session Token: ${sessionToken} \n`);
// const region = "ap-southeast-2";
// const bucketName = "n10693769-twitter-sentiment";

//For when scaling
AWS.config.credentials = new AWS.EC2MetadataCredentials({
    httpOptions: { timeout: 5000 }, // 5 second timeout
    maxRetries: 10, // retry 10 times
    retryDelayOptions: { base: 200 }, // see AWS.Config for information
    logger: console // see AWS.Config for information
});

// const AWSConfig = {
//   region,
//   accessKeyId,
//   secretAccessKey,
//   sessionToken,
// };

AWS.config.update(AWSConfig);
var s3 = new AWS.S3();

// Create unique bucket name
async function bucketCreate(bucketName) {
  try {
    await s3.createBucket({ Bucket: bucketName}).promise();
    console.log(`Created bucket: ${bucketName}`);
  } catch (err) {
    // We will ignore 409 errors which indicate that the bucket already exists
    if (err.statusCode !== 409) {
      console.log(`Error creating bucket: ${err}`);
    }
  }
}

bucketCreate(bucketName)


/**
 * 
 * @param {string} bucketName 
 * @param {string} key 
 * @param {string} query 
 * @param {JSON} data 
 */
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
const redisClient = redis.createClient({
  socket: {
    host:"n10693769-assignment2-cache.km2jzi.ng.0001.apse2.cache.amazonaws.com",
    port:6379,
  },
});
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.log(err);
  }
})();

// Local dev
// const redisClient = redis.createClient();
// (async () => {
//   try {
//     await redisClient.connect();
//   } catch (err) {
//     console.log(err);
//   }
// })();

// Write to Redis
/**
 * 
 * @param {string} key 
 * @param {JSON} data 
 */
function redisWrite(key, data) {
  redisClient.setEx(key, 3600, JSON.stringify(data));
}

// ============ MAIN FUNCTIONS ============
/**
 * 
 * @param {string} data 
 * @returns 0 or 1
 */
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
      console.log("============ Data still valid within 12 hours. Serve from Redis ============");
      const trackerJSON = JSON.parse(tracker);
      console.log(trackerJSON)
      res.send(trackerJSON)
    } else {
      s3.headObject(params, async function (resolve, err) {
        if (resolve && resolve.name === "NotFound") {
          // Serve from Twitter API
          console.log(
            "============ Not Found in S3 Or Redis. Serve From Twitter ============"
          );
          const response = getTweets(query);
          const decodeQuery = decodeURI(query)
          let data;
          await response.then(function (result) {
            data = result
          });
          s3Write(bucketName, key, decodeQuery, data)
          const trackerRedis = {
            key: decodeQuery,
            timestamp: `${new Date().toISOString()}`,
            data: data,
          };
          console.log(trackerRedis)
          redisClient.setEx(key, 3600, JSON.stringify(trackerRedis));
          res.send(trackerRedis)
        } else {
          console.log("============ Not found in Redis. Check S3 ============");
          // Get tracker
          const s3Tracker = await s3.getObject(params).promise();
          const trackerJSON = JSON.parse(s3Tracker.Body);
          if (checkDate(trackerJSON.timestamp) === 0) {
            console.log("============ Data older than 12 hours. Server from Twitter ============");
            const response = getTweets(query);
            const decodeQuery = decodeURI(query)
            let data;
            await response.then(function (result) {
              data = result
            });
            s3Write(bucketName, key, decodeQuery, data)
            const trackerRedis = {
              key: decodeQuery,
              timestamp: `${new Date().toISOString()}`,
              data: data
            };
            console.log(trackerRedis)
            redisWrite(key, trackerRedis);
            res.send(trackerRedis)
          } else {
            console.log("============ Data within 12 hours. Server from S3 ============");
            console.log(trackerJSON)
            redisClient.setEx(key, 3600, JSON.stringify(trackerJSON));
            res.send(trackerJSON)
          }
        }
      });
    }
});
 
app.use('/static', express.static(path.join(__dirname, './build//static')));
app.use('*', function (req, res) {
    res.sendFile('index.html', { root: path.join(__dirname, './build/') });
});
app.listen(3001);
