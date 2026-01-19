import React, { useEffect, useState } from "react";
import axios from "axios";

function IncomingRequests() {
  const [requests, setRequests] = useState([]);

  const token = localStorage.getItem("token");

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/network/incoming`, {
      headers: { Authorization: token },
    });
    setRequests(res.data);
  };

  const acceptRequest = async (id) => {
    await axios.post(
      `${import.meta.env.VITE_API_URL}/api/network/accept/${id}`,
      {},
      { headers: { Authorization: token } }
    );
    alert("Connection Accepted");
    loadRequests();
  };

  const cancelRequest = async (id) => {
    await axios.delete(
      `${import.meta.env.VITE_API_URL}/api/network/cancel/${id}`,
      { headers: { Authorization: token } }
    );
    alert("Request Canceled");
    loadRequests();
  };

  return (
    <div>
      <h2>Incoming Requests</h2>

      {requests.length === 0 && <p>No Requests</p>}

      {requests.map((user) => (
        <div key={user._id} style={{ marginBottom: "10px" }}>
          <span>{user.name}</span>
          <button onClick={() => acceptRequest(user._id)}>Accept</button>
          <button onClick={() => cancelRequest(user._id)}>Cancel</button>
        </div>
      ))}
    </div>
  );
}

export default IncomingRequests;
