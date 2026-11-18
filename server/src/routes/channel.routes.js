import express from "express";
import {
  getChannels,
  createChannel,
  getChannelMessages,
  postChannelMessage,
  toggleMessageReaction,
} from "../controllers/channel.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getChannels);
router.post("/", createChannel);
router.get("/:channelId/messages", getChannelMessages);
router.post("/:channelId/messages", postChannelMessage);
router.post("/messages/:messageId/reaction", toggleMessageReaction);

export default router;
