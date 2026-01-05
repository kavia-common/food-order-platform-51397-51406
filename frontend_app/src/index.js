import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import App from "./App";

// React 17 entrypoint: use ReactDOM.render instead of React 18's createRoot API.
ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root")
);
