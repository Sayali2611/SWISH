import React from "react";
import ExploreSearch from "../components/ExploreSearch";
import "../styles/ExploreSearch.css";

const Explore = () => {
  return (
    <div style={{ padding: "20px" }}>
      <h2>Explore Users</h2>
      <ExploreSearch onUserSelect={(user) => console.log("User:", user)} />
    </div>
  );
};

export default Explore;
