const { Client } = require("twitter-api-sdk")
require('dotenv').config();

console.log(process.env.bearer_token)
const client = new Client(process.env.bearer_token);

async function main() {
  const stream = client.tweets.sampleStream({
    "tweet.fields": ["author_id"],
  });
  for await (const tweet of stream) {
    console.log("Tweet ID:" + tweet.data?.text + "\nText: " + tweet.data?.text + "\n");
  }
}

main();