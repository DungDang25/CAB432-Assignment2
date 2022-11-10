import "./App.css";
import React, { useEffect, useState } from "react";
import Container from "react-bootstrap/Container";
import Navbar from "react-bootstrap/Navbar";
import Row from "react-bootstrap/esm/Row";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
const axios = require("axios").default;

function App() {
  const [form, setForm] = useState({});
  const [searching, setSearching] = useState(false);
  const [tweets, setTweets] = useState();

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
      console.log(response)
    } catch (error) {
      console.error(error);
    }
    setSearching(false);
  }

  console.log(form);

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
    </div>
  );
}

export default App;
