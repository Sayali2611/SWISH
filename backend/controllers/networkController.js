const User = require("../models/User");

// ---------------------------------------------------------
// Send Request
// ---------------------------------------------------------
exports.sendConnectionRequest = async (req, res) => {
  try {
    const senderId = req.user.id;
    const receiverId = req.params.id;

    if (senderId === receiverId)
      return res.status(400).json({ message: "You cannot send request to yourself" });

    const sender = await User.findById(senderId);
    const receiver = await User.findById(receiverId);

    // Already connected?
    if (sender.connections.includes(receiverId))
      return res.status(400).json({ message: "Already connected" });

    // Already sent?
    if (sender.sentRequests.includes(receiverId))
      return res.status(400).json({ message: "Request already sent" });

    // Already received from same user?
    if (sender.receivedRequests.includes(receiverId))
      return res.status(400).json({ message: "This user already sent you a request" });

    sender.sentRequests.push(receiverId);
    receiver.receivedRequests.push(senderId);

    await sender.save();
    await receiver.save();

    res.json({ message: "Connection request sent" });
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// ---------------------------------------------------------
// Accept Request
// ---------------------------------------------------------
exports.acceptConnection = async (req, res) => {
  try {
    const receiverId = req.user.id; 
    const senderId = req.params.id; 

    const receiver = await User.findById(receiverId);
    const sender = await User.findById(senderId);

    // Remove request
    receiver.receivedRequests = receiver.receivedRequests.filter(id => id.toString() !== senderId);
    sender.sentRequests = sender.sentRequests.filter(id => id.toString() !== receiverId);

    // Add to connections
    receiver.connections.push(senderId);
    sender.connections.push(receiverId);

    await receiver.save();
    await sender.save();

    res.json({ message: "Connection accepted" });
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// ---------------------------------------------------------
// Reject Request
// ---------------------------------------------------------
exports.rejectConnectionRequest = async (req, res) => {
  try {
    const receiverId = req.user.id;
    const senderId = req.params.id;

    const receiver = await User.findById(receiverId);
    const sender = await User.findById(senderId);

    receiver.receivedRequests = receiver.receivedRequests.filter(id => id.toString() !== senderId);
    sender.sentRequests = sender.sentRequests.filter(id => id.toString() !== receiverId);

    await receiver.save();
    await sender.save();

    res.json({ message: "Request rejected" });
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// ---------------------------------------------------------
// Cancel Outgoing Request
// ---------------------------------------------------------
exports.cancelConnectionRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const receiverId = req.params.id;

    const sender = await User.findById(userId);
    const receiver = await User.findById(receiverId);

    sender.sentRequests = sender.sentRequests.filter(id => id.toString() !== receiverId);
    receiver.receivedRequests = receiver.receivedRequests.filter(id => id.toString() !== userId);

    await sender.save();
    await receiver.save();

    res.json({ message: "Request cancelled" });
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// ---------------------------------------------------------
// Incoming Requests
// ---------------------------------------------------------
exports.getIncomingRequests = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate("receivedRequests", "name email profilePhoto");

    res.json(user.receivedRequests);
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};

// ---------------------------------------------------------
// Outgoing Requests
// ---------------------------------------------------------
exports.getOutgoingRequests = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate("sentRequests", "name email profilePhoto");

    res.json(user.sentRequests);
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};

// ---------------------------------------------------------
// Connections
// ---------------------------------------------------------
exports.getConnections = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate("connections", "name email profilePhoto");

    res.json(user.connections);
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};
// ---------------------------------------------------------
// Get connection status with a user
// ---------------------------------------------------------
exports.getConnectionStatus = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = req.params.userId;

    if (currentUserId === targetUserId) {
      return res.json({
        status: "self",
        message: "This is your own profile"
      });
    }

    const currentUser = await User.findById(currentUserId);

    // Check connection status
    const isConnected = currentUser.connections.includes(targetUserId);
    const hasSentRequest = currentUser.sentRequests.includes(targetUserId);
    const hasReceivedRequest = currentUser.receivedRequests.includes(targetUserId);

    let status = "none";
    let message = "";

    if (isConnected) {
      status = "connected";
      message = "You are connected with this user";
    } else if (hasSentRequest) {
      status = "request_sent";
      message = "Connection request sent - pending";
    } else if (hasReceivedRequest) {
      status = "request_received";
      message = "You have a connection request from this user";
    } else {
      status = "not_connected";
      message = "Not connected";
    }

    res.json({
      status,
      message,
      canSendRequest: !isConnected && !hasSentRequest && !hasReceivedRequest
    });
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};
