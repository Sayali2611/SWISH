import React, { useEffect, useState } from "react";
import axios from "axios";

function Connections() {
  const [connections, setConnections] = useState([]);

  const token = localStorage.getItem("token");

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/users/me`, {
      headers: { Authorization: token },
    });
    setConnections(res.data.connections);
  };

  return (
    <div>
      <h2>Your Connections</h2>

      {connections.length === 0 && <p>No connections yet</p>}

      {connections.map((c) => (
        <div key={c._id}>
          <span>{c.name}</span>
        </div>
      ))}
    </div>
  );
}

export default Connections;
