import "./App.css";
import React, { useEffect, useState } from "react";
import Container from "react-bootstrap/Container";
import Navbar from "react-bootstrap/Navbar";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import axios from "axios";
import { Pie, Bar } from "react-chartjs-2";
import { Tweet } from 'react-twitter-widgets'

function App() {
  const [form, setForm] = useState({});
  const [searching, setSearching] = useState(false);
  const [average, setAverage] = useState();
  const [noSentiment, setNoSentiment] = useState();
  const [data, setData] = useState();

  /**
   * Function that gets tweets given a query
   * @param query : search query for tweets about a specific topic/item
   */
  async function tweetSearch(query) {
    setSearching(true);
    const encode = encodeURIComponent(query);
    try {
      const response = await axios.get("/getTweets", {
        headers: {
          query: `${encode}`,
          "Content-Type": "application/json",
        },
      });
      setData(response.data.data)
      sentimentCount(response.data.data.map((x) => x.sentimentValue));
    } catch (error) {
      console.error(error);
    }
    setSearching(false);
  }

  /**
   * Counts sentiment values and summarises
   * @param {array} data 
   */
  function sentimentCount(data) {
    let negCount = 0;
    let posCount = 0;
    let neuCount = 0;
    const arr = [0, 0];

    for (let i = 0; i < data.length; i++) {
      if (data[i] > 0) {
        posCount++;
        arr[0] += data[i];
      } else if (data[i] < 0) {
        negCount++;
        arr[1] -= data[i];
      } else {
        neuCount++;
      }
    }
    arr[0] = arr[0] / posCount;
    arr[1] = arr[1] / negCount;

    setAverage(arr);
    setNoSentiment([posCount, negCount, neuCount]);
  }

  const options = {
    legend: {
      display: false,
    },
    indexAxis: "x",
    elements: {
      bar: {
        borderWidth: 2,
      },
    },
    responsive: true,
    plugins: {
      labels: {
        display: "false",
      },
      title: {
        display: true,
        text: "Most Recent Posts' Sentiment Score Summary",
      },
    },
  };

    /**
   * Function that renders tweets given a query onto page
   * @param {array} tweets    Array of tweets and their data
   */
     const renderTweets = (tweets) => {
      if (!tweets) return;
      return tweets.map((tweet, tweetIndex) => (
        <div key={tweetIndex}>
          <br></br>
          <Tweet tweetId={tweet.id}/>
        </div>
      ))
    }

  return (
    <div className="App">
      <Navbar collapseOnSelect expand="lg" bg="dark" variant="dark">
        <Container>
          <Navbar.Brand href="/">Twitter Sentiment Analysis</Navbar.Brand>
          <Navbar.Toggle aria-controls="responsive-navbar-nav" />
        </Container>
      </Navbar>
      <br />
      <Form>
        <Form.Group>
          <Form.Label>Search a Twitter query</Form.Label>
          <Form.Control
            type="query"
            placeholder="Enter your query"
            onChange={(e) => setForm(e.target.value)}
          ></Form.Control>
        </Form.Group>
      </Form>
      <br />
      <Button
        size="lg"
        variant="danger"
        className="app-button"
        onClick={() => tweetSearch(form)}
        disabled={searching}
      >
        Search and Analyse Tweets
      </Button>
      <br />
      <br />
        {average && (
          <div style={{ width: 600, justifyContent: "center" }}>
            <Bar
              data={{
                labels: ["Positive Average Score", "Negative Average Score"],
                datasets: [
                  {
                    data: average,
                    backgroundColor: [
                      "rgba(75, 192, 192, 0.2)",
                      "rgba(255, 99, 132, 0.2)",
                    ],
                    borderColor: [
                      "rgba(75, 192, 192, 1)",
                      "rgba(255, 99, 132, 1)",
                    ],
                    borderWidth: 1,
                  },
                ],
              }}
              options={options}
            />
          </div>
        )}
        <br />
        <br />
        <br />
        {noSentiment && (
          <div style={{ width: 600, justifyContent: "center" }}>
            <Pie
              data={{
                labels: [
                  "Positive Sentiment",
                  "Negative Sentiment",
                  "Neutral Sentiment",
                ],
                datasets: [
                  {
                    data: noSentiment,
                    backgroundColor: [
                      "rgba(75, 192, 192, 0.2)",
                      "rgba(255, 99, 132, 0.2)",
                      "rgba(255, 206, 86, 0.2)",
                    ],
                    borderColor: [
                      "rgba(75, 192, 192, 1)",
                      "rgba(255, 99, 132, 1)",
                      "rgba(255, 206, 86, 1)",
                    ],
                    borderWidth: 1,
                  },
                ],
              }}
              options={{
                plugins: {
                  labels: {
                    display: "false",
                  },
                  title: {
                    display: true,
                    text: "Sum of Sentiment",
                  },
                },
              }}
            />
          </div>
        )}
        {data &&
          (
            renderTweets(data)
          )
        }
    </div>
  );
}

export default App;
