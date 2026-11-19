import prisma from "../config/db.js";
import { emitCRMEvent, getIo } from "../socket.js";

const DEFAULT_CHANNEL_NAMES = [
  { name: "general", description: "General team discussion", channelType: "STANDARD", isDefault: true },
  { name: "announcements", description: "Official updates and announcements", channelType: "ANNOUNCEMENT", isDefault: false },
  { name: "tasks-and-ops", description: "Daily tasks and operational alignment", channelType: "TASKS", isDefault: false },
  { name: "deals-and-clients", description: "Client leads, deals, and sales discussion", channelType: "DEALS", isDefault: false },
];

export async function ensureDefaultChannels(parentType, parentId) {
  const where = parentType === "DEPARTMENT" ? { departmentId: parentId } : { projectId: parentId };
  const count = await prisma.teamChannel.count({ where });

  if (count === 0) {
    for (const ch of DEFAULT_CHANNEL_NAMES) {
      await prisma.teamChannel.create({
        data: {
          name: ch.name,
          description: ch.description,
          channelType: ch.channelType,
          isDefault: ch.isDefault,
          ...(parentType === "DEPARTMENT" ? { departmentId: parentId } : { projectId: parentId }),
        },
      }).catch(() => {});
    }
  }
}

export async function getChannels(req, res) {
  try {
    const { departmentId, projectId } = req.query;

    if (!departmentId && !projectId) {
      return res.status(400).json({ error: "departmentId or projectId is required" });
    }

    if (departmentId) {
      await ensureDefaultChannels("DEPARTMENT", departmentId);
    } else if (projectId) {
      await ensureDefaultChannels("PROJECT", projectId);
    }

    const channels = await prisma.teamChannel.findMany({
      where: {
        ...(departmentId ? { departmentId } : {}),
        ...(projectId ? { projectId } : {}),
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    res.json(channels);
  } catch (error) {
    console.error("Error fetching channels:", error);
    res.status(500).json({ error: "Failed to fetch channels" });
  }
}

export async function createChannel(req, res) {
  try {
    const { name, description, channelType, departmentId, projectId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Channel name is required" });
    }

    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");

    const channel = await prisma.teamChannel.create({
      data: {
        name: cleanName,
        description: description?.trim() || null,
        channelType: channelType || "STANDARD",
        createdById: req.user.id,
        departmentId: departmentId || null,
        projectId: projectId || null,
      },
    });

    emitCRMEvent("channel:created", channel);
    res.status(201).json(channel);
  } catch (error) {
    console.error("Error creating channel:", error);
    if (error.code === "P2002") {
      return res.status(409).json({ error: "A channel with this name already exists in this team" });
    }
    res.status(500).json({ error: "Failed to create channel" });
  }
}

export async function getChannelMessages(req, res) {
  try {
    const { channelId } = req.params;
    const { limit = 50, before } = req.query;

    const messages = await prisma.chatMessage.findMany({
      where: {
        channelId,
        isDeleted: false,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      take: Number(limit),
      orderBy: { createdAt: "asc" },
      include: {
        author: {
          select: { id: true, name: true, email: true, role: true, avatarUrl: true },
        },
        replies: {
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    res.json(messages);
  } catch (error) {
    console.error("Error fetching channel messages:", error);
    res.status(500).json({ error: "Failed to fetch channel messages" });
  }
}

export async function postChannelMessage(req, res) {
  try {
    const { channelId } = req.params;
    const { content, messageType = "TEXT", attachmentUrl, attachmentFileName, attachmentMimeType, replyToId, meetingUrl, meetingTitle } = req.body;

    if ((!content || !content.trim()) && !attachmentUrl && !meetingUrl) {
      return res.status(400).json({ error: "Message content or attachment/meeting is required" });
    }

    const channel = await prisma.teamChannel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }

    const message = await prisma.chatMessage.create({
      data: {
        channelType: "CHANNEL",
        content: content?.trim() || (meetingUrl ? `Started Google Meet: ${meetingTitle || "Instant Meeting"}` : ""),
        messageType: meetingUrl ? "MEETING" : messageType,
        authorId: req.user.id,
        channelId: channel.id,
        departmentId: channel.departmentId,
        projectId: channel.projectId,
        attachmentUrl: attachmentUrl || null,
        attachmentFileName: attachmentFileName || null,
        attachmentMimeType: attachmentMimeType || null,
        replyToId: replyToId || null,
        meetingUrl: meetingUrl || null,
        meetingTitle: meetingTitle || null,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, role: true, avatarUrl: true },
        },
      },
    });

    // Broadcast message via Socket.IO
    const io = getIo();
    if (io) {
      io.emit(`channel:${channelId}:message`, message);
      if (channel.departmentId) {
        io.to(`department:${channel.departmentId}`).emit("channel:message_broadcast", { channelId, message });
      }
      if (channel.projectId) {
        io.to(`project:${channel.projectId}`).emit("channel:message_broadcast", { channelId, message });
      }
    }

    res.status(201).json(message);
  } catch (error) {
    console.error("Error posting channel message:", error);
    res.status(500).json({ error: "Failed to post channel message" });
  }
}

export async function toggleMessageReaction(req, res) {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;

    if (!emoji) {
      return res.status(400).json({ error: "Emoji is required" });
    }

    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    const reactions = (typeof message.reactions === "object" && message.reactions !== null)
      ? { ...message.reactions }
      : {};

    const userList = Array.isArray(reactions[emoji]) ? [...reactions[emoji]] : [];
    const existingIndex = userList.indexOf(userId);

    if (existingIndex > -1) {
      userList.splice(existingIndex, 1);
    } else {
      userList.push(userId);
    }

    if (userList.length === 0) {
      delete reactions[emoji];
    } else {
      reactions[emoji] = userList;
    }

    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: { reactions },
      select: { id: true, reactions: true, channelId: true },
    });

    const io = getIo();
    if (io && updated.channelId) {
      io.emit(`channel:${updated.channelId}:reaction`, updated);
    }

    res.json(updated);
  } catch (error) {
    console.error("Error toggling reaction:", error);
    res.status(500).json({ error: "Failed to toggle reaction" });
  }
}
