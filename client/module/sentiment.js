const Sentiment = require("sentiment");

// Initialise variable sen for sentiment score
var senObj = new Sentiment();

// Tweet Texts will be sent to the Sentiment Analysis Unit
senObj.getSentiment = (tweet) => {
    const senScore = sen.analyze(tweet.text);

    // Calculate the score
    scoreValue = senScore.score;

    // Check the values of the sentiment scores + - or 0
    if (scoreValue > 0) {
        value = "Positive";
    } else if (scoreValue = 0) {
        value = "Neutral";
    } else {
        value = "Negative";
    }

    // return the values above 

    return senObj.appendSentiment(tweet, value, scoreValue);
};


// Transfer the evaluation score to the client 

senObj.appendSentiment = (tweet, value, scoreValue) => {
    var evalTweet = {
        sentiment: value,
        score_value: scoreValue,
        text: tweet.text,
        id_str: tweet.id_str,
        timestamp:  tweet.timestamp,
        generated_at: tweet.generated_at,
    };
    return evalTweet;
};


module.exports = senObj;
