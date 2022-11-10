import "./App.css";
import React, { useEffect, useState } from "react";
import Container from "react-bootstrap/Container";
import Navbar from "react-bootstrap/Navbar";
import Row from "react-bootstrap/esm/Row";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import axios from "axios";
import Chart from 'chart.js/auto';
import { Pie, Bar } from 'react-chartjs-2';

function App() {
  const [form, setForm] = useState({});
  const [searching, setSearching] = useState(false);
  const [average, setAverage] = useState();
  const [noSentiment, setNoSentiment] = useState();

  /**
   * Function that gets tweets given a query
   * @param query : search query for tweets about a specific topic/item
   */
  async function tweetSearch(query) {
    setSearching(true);
    const encode = encodeURIComponent(query);
    try {
      const response = await axios.get("http://localhost:3001/getTweets", {
        headers: {
          query: `${encode}`,
          "Content-Type": "application/json",
        },
      });
      sentimentCount(response.data.data.map(x => x.sentimentValue))
    } catch (error) {
      console.error(error);
    }
    setSearching(false);
  }

  function sentimentCount(data) {
    let negCount = 0;
    let posCount = 0;
    let neuCount = 0;
    const arr = [0, 0]

    for (let i = 0; i < data.length; i++) {
      if (data[i] > 0) {
        posCount++
        arr[0] += data[i]
      }
      else if (data[i] < 0) {
        negCount++
        arr[1] -= data[i]
      }
      else {
        neuCount++
      }
    }
    arr[0] = arr[0] / posCount
    arr[1] = arr[1] / negCount

    setAverage(arr)
    setNoSentiment([posCount, negCount, neuCount])
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
      {average &&
        <>
          <p>Hi</p>
          <Bar
            data={{
              labels: ["Positive Score", "Negative Score"],
              datasets: [
                {
                  data: average,
                  backgroundColor: [
                    'rgba(75, 192, 192, 0.2)',
                    'rgba(255, 99, 132, 0.2)',
                  ],
                  borderColor: ["rgba(255, 99, 132, 1)", "rgba(75, 192, 192, 1)"],
                  borderWidth: 1,
                },
              ],
            }}
            options={options}
          />
        </>
      }
    </div>
  );
}

export default App;
