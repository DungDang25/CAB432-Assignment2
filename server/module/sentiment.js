const Sentiment = require("sentiment");

var sentimentObject = new Sentiment();

//Send Tweet Text to Sentiment Analysis
sentimentObject.getSentiment = (data) => {
    const sentimentScore = sentimentObject.analyze(data.text);
    value = sentimentScore.score;
    if (value > 0) {
        score = "Positive Vibe";
    } else if (value < 0) {
        score = "Negative Vibe";
    } else {
        score = "Neutral Vibe";
    }
    return sentimentObject.appendSentiment(data, score, value);
};

//Generate a var sentimentResult to store information
sentimentObject.appendSentiment = (data, sentiment, value) => {
    var sentimentResult = {
        text: data.text,
        sentiment: sentiment,
        sentiment_value: value,
        // generated_on: data.created_at,
        // timestamp_ms: data.timestamp_ms,
        // id_str: data.id_str,
    };
    return sentimentResult;
};

module.exports = sentimentObject;