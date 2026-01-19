const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const networkController = require("../controllers/networkController");

// Send request
router.post("/send/:id", auth, networkController.sendConnectionRequest);

// Cancel sent request
router.delete("/cancel/:id", auth, networkController.cancelConnectionRequest);

// Accept request
router.post("/accept/:id", auth, networkController.acceptConnection);

// Reject request
router.delete("/reject/:id", auth, networkController.rejectConnectionRequest);

// Incoming
router.get("/incoming", auth, networkController.getIncomingRequests);

// Outgoing
router.get("/outgoing", auth, networkController.getOutgoingRequests);

// Connections
router.get("/connections", auth, networkController.getConnections);

// Add this line to networkRoutes.js
router.get("/status/:userId", auth, networkController.getConnectionStatus);

module.exports = router;
