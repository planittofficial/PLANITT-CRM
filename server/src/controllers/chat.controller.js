import prisma from "../config/db.js";
import { emitCRMEvent } from "../socket.js";
import { deleteChatAssetFromCloudinaryByUrl, uploadChatAssetToCloudinary } from "../services/cloudinary.service.js";
import { sendSafeError } from "../middleware/error.middleware.js";

const LEADERSHIP_ROLES = ["SUPERADMIN", "ADMIN"];
const GROUP_ADMIN_ROLES = ["SUPERADMIN", "ADMIN", "MANAGER"];
const ACCESS_CACHE_TTL_MS = 30_000;
const accessCache = new Map();
const DIRECT_GROUP_PREFIX = "DM::";
const CHAT_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatarUrl: true,
  authProvider: true,
};

function isLeadership(user) {
  return LEADERSHIP_ROLES.includes(user.role);
}

function canManageGroups(user) {
  return GROUP_ADMIN_ROLES.includes(user.role);
}

function isDirectGroupName(name) {
  return typeof name === "string" && name.startsWith(DIRECT_GROUP_PREFIX);
}

function buildDirectGroupName(userAId, userBId) {
  const [a, b] = [String(userAId), String(userBId)].sort();
  return `${DIRECT_GROUP_PREFIX}${a}::${b}`;
}

function isDirectGroupMemberEditable(group) {
  return !isDirectGroupName(group?.name);
}

function canViewAllGroups(user) {
  return user.role === "SUPERADMIN";
}

function getVisibleProjectWhere(user) {
  if (isLeadership(user)) {
    return {};
  }

  if (user.role === "MANAGER") {
    return {
      OR: [
        { ownerId: user.userId },
        {
          tasks: {
            some: {
              assignments: {
                some: {
                  userId: user.userId,
                },
              },
            },
          },
        },
      ],
    };
  }

  return {
    tasks: {
      some: {
        assignments: {
          some: {
            userId: user.userId,
          },
        },
      },
    },
  };
}

function toMessagePayload(message) {
  return {
    id: message.id,
    channelType: message.channelType,
    departmentId: message.departmentId,
    projectId: message.projectId,
    groupId: message.groupId,
    messageType: message.messageType,
    content: message.content,
    attachmentUrl: message.attachmentUrl,
    attachmentMimeType: message.attachmentMimeType,
    attachmentFileName: message.attachmentFileName,
    isDeleted: message.isDeleted,
    deletedAt: message.deletedAt,
    replyTo: message.replyTo
      ? {
          id: message.replyTo.id,
          content: message.replyTo.content,
          messageType: message.replyTo.messageType,
          attachmentFileName: message.replyTo.attachmentFileName,
          isDeleted: message.replyTo.isDeleted,
          author: message.replyTo.author,
        }
      : null,
    createdAt: message.createdAt,
    author: message.author,
  };
}

async function getCurrentUser(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      departmentId: true,
    },
  });
}

async function canAccessDepartmentRoom(authUser, departmentId) {
  if (!departmentId) {
    return false;
  }

  if (isLeadership(authUser)) {
    return Boolean(await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true } }));
  }

  const user = await getCurrentUser(authUser.userId);
  return user?.departmentId === departmentId;
}

async function canAccessProjectRoom(authUser, projectId) {
  if (!projectId) {
    return false;
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ...getVisibleProjectWhere(authUser),
    },
    select: { id: true },
  });

  return Boolean(project);
}

async function canAccessRoom(authUser, channelType, channelId) {
  const cacheKey = `${authUser.userId}:${channelType}:${channelId}`;
  const cached = accessCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  let value = false;
  if (channelType === "DEPARTMENT") {
    value = await canAccessDepartmentRoom(authUser, channelId);
  } else if (channelType === "PROJECT") {
    value = await canAccessProjectRoom(authUser, channelId);
  } else if (channelType === "GROUP") {
    if (canViewAllGroups(authUser)) {
      value = Boolean(await prisma.chatGroup.findUnique({ where: { id: channelId }, select: { id: true } }));
    } else {
      value = Boolean(
        await prisma.chatGroupMember.findFirst({
          where: {
            groupId: channelId,
            userId: authUser.userId,
          },
          select: { id: true },
        })
      );
    }
  }

  accessCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + ACCESS_CACHE_TTL_MS,
  });
  return value;
}

function getMessageTypeFromMime(mimeType) {
  if (!mimeType) {
    return "TEXT";
  }

  if (mimeType === "application/pdf") {
    return "PDF";
  }

  if (mimeType.startsWith("image/")) {
    if (mimeType === "image/webp" || mimeType === "image/gif") {
      return "STICKER";
    }
    return "IMAGE";
  }

  return "TEXT";
}

function getCloudinaryResourceTypeFromMime(mimeType) {
  if (mimeType === "application/pdf") {
    return "raw";
  }
  return "image";
}

function isMediaMessage(message) {
  return Boolean(message.attachmentUrl) && ["IMAGE", "PDF", "STICKER"].includes(message.messageType);
}

export async function getChatRooms(req, res) {
  try {
    const currentUser = await getCurrentUser(req.user.userId);
    if (!currentUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const [departments, projects, groups, reads] = await Promise.all([
      prisma.department.findMany({
        where: isLeadership(req.user)
          ? {}
          : currentUser.departmentId
            ? { id: currentUser.departmentId }
            : { id: "__none__" },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          code: true,
          _count: {
            select: { users: true },
          },
        },
      }),
      prisma.project.findMany({
        where: getVisibleProjectWhere(req.user),
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          department: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      }),
      prisma.chatGroup.findMany({
        where: canViewAllGroups(req.user)
          ? {}
          : {
              members: {
                some: {
                  userId: req.user.userId,
                },
              },
            },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          description: true,
          members: {
            select: {
              userId: true,
              user: {
                select: CHAT_USER_SELECT,
              },
            },
          },
          _count: {
            select: { members: true },
          },
        },
      }),
      prisma.chatRoomRead.findMany({
        where: { userId: req.user.userId },
        select: { channelType: true, departmentId: true, projectId: true, groupId: true, lastReadAt: true },
      }),
    ]);

    const readMap = new Map(
      reads.map((read) => [
        `${read.channelType}:${
          read.channelType === "DEPARTMENT"
            ? read.departmentId
            : read.channelType === "PROJECT"
              ? read.projectId
              : read.groupId
        }`,
        read.lastReadAt,
      ])
    );

    const departmentIds = departments.map((department) => department.id);
    const projectIds = projects.map((project) => project.id);

    const groupIds = groups.map((group) => group.id);
    const [latestDepartmentMessages, latestProjectMessages, latestGroupMessages] = await Promise.all([
      departmentIds.length
        ? prisma.chatMessage.findMany({
            where: {
              channelType: "DEPARTMENT",
              departmentId: { in: departmentIds },
              hiddenBy: { none: { userId: req.user.userId } },
            },
            orderBy: [{ departmentId: "asc" }, { createdAt: "desc" }],
            distinct: ["departmentId"],
            select: {
              departmentId: true,
              authorId: true,
              content: true,
              messageType: true,
              attachmentFileName: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
      projectIds.length
        ? prisma.chatMessage.findMany({
            where: {
              channelType: "PROJECT",
              projectId: { in: projectIds },
              hiddenBy: { none: { userId: req.user.userId } },
            },
            orderBy: [{ projectId: "asc" }, { createdAt: "desc" }],
            distinct: ["projectId"],
            select: {
              projectId: true,
              authorId: true,
              content: true,
              messageType: true,
              attachmentFileName: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
      groupIds.length
        ? prisma.chatMessage.findMany({
            where: {
              channelType: "GROUP",
              groupId: { in: groupIds },
              hiddenBy: { none: { userId: req.user.userId } },
            },
            orderBy: [{ groupId: "asc" }, { createdAt: "desc" }],
            distinct: ["groupId"],
            select: {
              groupId: true,
              authorId: true,
              content: true,
              messageType: true,
              attachmentFileName: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const latestMap = new Map();
    for (const message of latestDepartmentMessages) {
      latestMap.set(`DEPARTMENT:${message.departmentId}`, message);
    }
    for (const message of latestProjectMessages) {
      latestMap.set(`PROJECT:${message.projectId}`, message);
    }
    for (const message of latestGroupMessages) {
      latestMap.set(`GROUP:${message.groupId}`, message);
    }

    function roomMeta(channelType, roomId) {
      const key = `${channelType}:${roomId}`;
      const lastMessage = latestMap.get(key);
      const lastReadAt = readMap.get(key) || new Date(0);
      const unreadCount =
        lastMessage && lastMessage.authorId !== req.user.userId && lastMessage.createdAt > lastReadAt ? 1 : 0;
      return {
        unreadCount,
        lastMessagePreview: lastMessage
          ? lastMessage.messageType === "TEXT"
            ? lastMessage.content
            : lastMessage.messageType === "PDF"
              ? `PDF: ${lastMessage.attachmentFileName || "Attachment"}`
              : "Image attachment"
          : "",
        lastMessageAt: lastMessage?.createdAt || null,
      };
    }

    const departmentWithMeta = await Promise.all(
      departments.map(async (department) => ({
        id: department.id,
        type: "DEPARTMENT",
        name: department.name,
        subtitle: `${department.code} | ${department._count.users} members`,
        ...roomMeta("DEPARTMENT", department.id),
      }))
    );

    const projectsWithMeta = await Promise.all(
      projects.map(async (project) => ({
        id: project.id,
        type: "PROJECT",
        name: project.name,
        subtitle: project.department?.name ?? "No department",
        department: project.department,
        ...roomMeta("PROJECT", project.id),
      }))
    );
    const groupsWithMeta = await Promise.all(
      groups.map(async (group) => {
        const isDirect = isDirectGroupName(group.name);
        const peer = isDirect
          ? group.members.find((member) => member.userId !== req.user.userId)?.user ?? null
          : null;

        return {
          id: group.id,
          type: "GROUP",
          name: isDirect ? (peer?.name || "One-to-one chat") : group.name,
          subtitle: isDirect
            ? `One-to-one${peer?.role ? ` | ${peer.role}` : ""}`
            : (group.description || `${group._count.members} members`),
          isDirect,
          directPeer: peer
            ? {
                id: peer.id,
                name: peer.name,
                role: peer.role,
                avatarUrl: peer.avatarUrl ?? null,
                authProvider: peer.authProvider ?? "password",
              }
            : null,
          ...roomMeta("GROUP", group.id),
        };
      })
    );

    return res.json({
      departments: departmentWithMeta,
      projects: projectsWithMeta,
      groups: groupsWithMeta,
    });
  } catch (err) {
    return sendSafeError(res, err, "Unable to fetch chat channels");
  }
}

export async function getChatMessages(req, res) {
  try {
    const channelType = String(req.query.type || "").toUpperCase();
    const channelId = String(req.query.id || "");

    if (!(await canAccessRoom(req.user, channelType, channelId))) {
      return res.status(403).json({ error: "You do not have access to this chat room" });
    }

    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 20), 120) : 40;
    const before = typeof req.query.before === "string" ? req.query.before.trim() : "";
    const beforeDate = before ? new Date(before) : null;
    const hasBeforeDate = beforeDate instanceof Date && !Number.isNaN(beforeDate.getTime());
    const messages = await prisma.chatMessage.findMany({
      where: {
        channelType,
        ...(channelType === "DEPARTMENT"
          ? { departmentId: channelId }
          : channelType === "PROJECT"
            ? { projectId: channelId }
            : { groupId: channelId }),
        hiddenBy: { none: { userId: req.user.userId } },
        ...(query ? { content: { contains: query, mode: "insensitive" } } : {}),
        ...(hasBeforeDate ? { createdAt: { lt: beforeDate } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      include: {
        author: {
          select: CHAT_USER_SELECT,
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            messageType: true,
            attachmentFileName: true,
            isDeleted: true,
            author: {
              select: CHAT_USER_SELECT,
            },
          },
        },
      },
    });

    const hasMore = messages.length > limit;
    const page = hasMore ? messages.slice(0, limit) : messages;
    const ordered = page.reverse().map(toMessagePayload);
    const nextBefore = page.length ? page[page.length - 1].createdAt : null;

    return res.json({
      messages: ordered,
      hasMore,
      nextBefore,
    });
  } catch (err) {
    return sendSafeError(res, err, "Unable to fetch chat messages");
  }
}

export async function createChatMessage(req, res) {
  try {
    const channelType = String(req.body.channelType || "").toUpperCase();
    const channelId = String(req.body.channelId || "");
    const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
    const attachmentUrl = typeof req.body.attachmentUrl === "string" ? req.body.attachmentUrl.trim() : "";
    const attachmentMimeType =
      typeof req.body.attachmentMimeType === "string" ? req.body.attachmentMimeType.trim() : "";
    const attachmentFileName =
      typeof req.body.attachmentFileName === "string" ? req.body.attachmentFileName.trim() : "";
    const messageTypeRaw = typeof req.body.messageType === "string" ? req.body.messageType.toUpperCase() : "TEXT";
    const messageType = ["TEXT", "IMAGE", "PDF", "STICKER"].includes(messageTypeRaw) ? messageTypeRaw : "TEXT";
    const replyToId = typeof req.body.replyToId === "string" ? req.body.replyToId.trim() : "";

    if (!content && !attachmentUrl) {
      return res.status(400).json({ error: "Message cannot be empty" });
    }

    if (content.length > 2000) {
      return res.status(400).json({ error: "Message is too long" });
    }

    if (!(await canAccessRoom(req.user, channelType, channelId))) {
      return res.status(403).json({ error: "You do not have access to this chat room" });
    }

    let replyTo = null;
    if (replyToId) {
      replyTo = await prisma.chatMessage.findUnique({
        where: { id: replyToId },
        select: {
          id: true,
          channelType: true,
          departmentId: true,
          projectId: true,
          groupId: true,
        },
      });

      if (!replyTo) {
        return res.status(404).json({ error: "Replied message not found" });
      }

      const sameRoom =
        replyTo.channelType === channelType &&
        ((channelType === "DEPARTMENT" && replyTo.departmentId === channelId) ||
          (channelType === "PROJECT" && replyTo.projectId === channelId) ||
          (channelType === "GROUP" && replyTo.groupId === channelId));

      if (!sameRoom) {
        return res.status(400).json({ error: "You can only reply within the same room" });
      }
    }

    const message = await prisma.chatMessage.create({
      data: {
        channelType,
        content,
        messageType,
        attachmentUrl: attachmentUrl || null,
        attachmentMimeType: attachmentMimeType || null,
        attachmentFileName: attachmentFileName || null,
        replyToId: replyTo?.id ?? null,
        authorId: req.user.userId,
        ...(channelType === "DEPARTMENT"
          ? { departmentId: channelId }
          : channelType === "PROJECT"
            ? { projectId: channelId }
            : { groupId: channelId }),
      },
      include: {
        author: {
          select: CHAT_USER_SELECT,
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            messageType: true,
            attachmentFileName: true,
            isDeleted: true,
            author: {
              select: CHAT_USER_SELECT,
            },
          },
        },
      },
    });

    const payload = toMessagePayload(message);
    emitCRMEvent("chat:message", payload);
    void prisma.chatRoomRead
      .upsert({
        where: {
          id: `${req.user.userId}:${channelType}:${channelId}`,
        },
        update: { lastReadAt: new Date() },
        create: {
          id: `${req.user.userId}:${channelType}:${channelId}`,
          userId: req.user.userId,
          channelType,
          ...(channelType === "DEPARTMENT"
            ? { departmentId: channelId }
            : channelType === "PROJECT"
              ? { projectId: channelId }
              : { groupId: channelId }),
          lastReadAt: new Date(),
        },
      })
      .catch(() => {});

    return res.status(201).json(payload);
  } catch (err) {
    return sendSafeError(res, err, "Unable to send chat message");
  }
}

export async function deleteChatMessage(req, res) {
  try {
    const messageId = String(req.params.id || "");
    const mode = String(req.query.mode || "everyone").toLowerCase();
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        authorId: true,
        channelType: true,
        departmentId: true,
        projectId: true,
        groupId: true,
        attachmentUrl: true,
        attachmentMimeType: true,
        isDeleted: true,
      },
    });

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    const channelId =
      message.channelType === "DEPARTMENT"
        ? message.departmentId
        : message.channelType === "PROJECT"
          ? message.projectId
          : message.groupId;
    if (!(await canAccessRoom(req.user, message.channelType, channelId))) {
      return res.status(403).json({ error: "You do not have access to this chat room" });
    }

    if (mode === "me") {
      await prisma.chatMessageHidden.upsert({
        where: {
          userId_messageId: {
            userId: req.user.userId,
            messageId: message.id,
          },
        },
        update: { hiddenAt: new Date() },
        create: {
          userId: req.user.userId,
          messageId: message.id,
        },
      });
      return res.json({ success: true });
    }

    const canDeleteEveryone = message.authorId === req.user.userId || isLeadership(req.user);
    if (!canDeleteEveryone) {
      return res.status(403).json({ error: "Only sender or admin can delete for everyone" });
    }

    if (message.isDeleted) {
      return res.status(200).json({ success: true });
    }

    if (message.attachmentUrl) {
      await deleteChatAssetFromCloudinaryByUrl(message.attachmentUrl, message.attachmentMimeType).catch(() => null);
    }

    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        content: "This message was deleted",
        attachmentUrl: null,
        attachmentMimeType: null,
        attachmentFileName: null,
        messageType: "TEXT",
      },
      include: {
        author: {
          select: CHAT_USER_SELECT,
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            messageType: true,
            attachmentFileName: true,
            isDeleted: true,
            author: {
              select: CHAT_USER_SELECT,
            },
          },
        },
      },
    });

    emitCRMEvent("chat:message:update", toMessagePayload(updated));
    return res.json({ success: true });
  } catch (err) {
    return sendSafeError(res, err, "Unable to delete chat message");
  }
}

export async function markChatRoomRead(req, res) {
  try {
    const channelType = String(req.body.channelType || "").toUpperCase();
    const channelId = String(req.body.channelId || "");
    if (!(await canAccessRoom(req.user, channelType, channelId))) {
      return res.status(403).json({ error: "You do not have access to this chat room" });
    }
    await prisma.chatRoomRead.upsert({
      where: {
        id: `${req.user.userId}:${channelType}:${channelId}`,
      },
      update: { lastReadAt: new Date() },
      create: {
        id: `${req.user.userId}:${channelType}:${channelId}`,
        userId: req.user.userId,
        channelType,
        ...(channelType === "DEPARTMENT"
          ? { departmentId: channelId }
          : channelType === "PROJECT"
            ? { projectId: channelId }
            : { groupId: channelId }),
        lastReadAt: new Date(),
      },
    });
    return res.json({ success: true });
  } catch (err) {
    return sendSafeError(res, err, "Unable to mark chat room as read");
  }
}

export async function createChatGroup(req, res) {
  try {
    if (!canManageGroups(req.user)) {
      return res.status(403).json({ error: "Only admin, manager, or superadmin can create groups" });
    }
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const description = typeof req.body.description === "string" ? req.body.description.trim() : "";
    const memberIds = Array.isArray(req.body.memberIds) ? req.body.memberIds.map(String) : [];
    if (!name) {
      return res.status(400).json({ error: "Group name is required" });
    }
    const uniqueMemberIds = [...new Set([req.user.userId, ...memberIds])];
    const group = await prisma.chatGroup.create({
      data: {
        name,
        description: description || null,
        createdById: req.user.userId,
        members: {
          create: uniqueMemberIds.map((userId) => ({
            userId,
            addedById: req.user.userId,
          })),
        },
      },
      include: {
        _count: { select: { members: true } },
      },
    });
    return res.status(201).json(group);
  } catch (err) {
    return sendSafeError(res, err, "Unable to fetch groups");
  }
}

export async function startDirectChat(req, res) {
  try {
    if (!canManageGroups(req.user)) {
      return res
        .status(403)
        .json({ error: "Only admin, manager, or superadmin can start one-to-one chats" });
    }

    const targetUserId = String(req.body.targetUserId || "").trim();
    if (!targetUserId) {
      return res.status(400).json({ error: "targetUserId is required" });
    }
    if (targetUserId === req.user.userId) {
      return res.status(400).json({ error: "You cannot start one-to-one chat with yourself" });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, role: true },
    });
    if (!targetUser) {
      return res.status(404).json({ error: "Target member not found" });
    }

    const directName = buildDirectGroupName(req.user.userId, targetUserId);
    const existing = await prisma.chatGroup.findFirst({
      where: { name: directName },
      include: { _count: { select: { members: true } } },
    });

    if (existing) {
      return res.json(existing);
    }

    const created = await prisma.chatGroup.create({
      data: {
        name: directName,
        description: "Direct one-to-one chat",
        createdById: req.user.userId,
        members: {
          create: [
            { userId: req.user.userId, addedById: req.user.userId },
            { userId: targetUserId, addedById: req.user.userId },
          ],
        },
      },
      include: {
        _count: { select: { members: true } },
      },
    });

    return res.status(201).json(created);
  } catch (err) {
    return sendSafeError(res, err, "Unable to start one-to-one chat");
  }
}

export async function getChatGroupById(req, res) {
  try {
    const groupId = String(req.params.id || "");
    if (!(await canAccessRoom(req.user, "GROUP", groupId))) {
      return res.status(403).json({ error: "You do not have access to this group" });
    }
    const group = await prisma.chatGroup.findUnique({
      where: { id: groupId },
      include: { _count: { select: { members: true } } },
    });
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }
    return res.json(group);
  } catch (err) {
    return sendSafeError(res, err, "Unable to create group");
  }
}

export async function getChatGroupMembers(req, res) {
  try {
    const groupId = String(req.params.id || "");
    if (!(await canAccessRoom(req.user, "GROUP", groupId))) {
      return res.status(403).json({ error: "You do not have access to this group" });
    }
    const members = await prisma.chatGroupMember.findMany({
      where: { groupId },
      include: {
        user: {
          select: CHAT_USER_SELECT,
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return res.json(members);
  } catch (err) {
    return sendSafeError(res, err, "Unable to update group");
  }
}

export async function updateChatGroup(req, res) {
  try {
    if (!canManageGroups(req.user)) {
      return res.status(403).json({ error: "Only admin, manager, or superadmin can update groups" });
    }
    const groupId = String(req.params.id || "");
    if (!(await canAccessRoom(req.user, "GROUP", groupId))) {
      return res.status(403).json({ error: "You do not have access to this group" });
    }
    const existingGroup = await prisma.chatGroup.findUnique({
      where: { id: groupId },
      select: { id: true, name: true },
    });
    if (!existingGroup) {
      return res.status(404).json({ error: "Group not found" });
    }
    if (!isDirectGroupMemberEditable(existingGroup)) {
      return res.status(400).json({ error: "One-to-one chat settings cannot be edited" });
    }
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const description = typeof req.body.description === "string" ? req.body.description.trim() : "";
    const group = await prisma.chatGroup.update({
      where: { id: groupId },
      data: {
        ...(name ? { name } : {}),
        ...(typeof req.body.description === "string" ? { description: description || null } : {}),
      },
    });
    return res.json(group);
  } catch (err) {
    return sendSafeError(res, err, "Unable to delete group");
  }
}

export async function deleteChatGroup(req, res) {
  try {
    if (!canManageGroups(req.user)) {
      return res.status(403).json({ error: "Only admin, manager, or superadmin can delete groups" });
    }
    const groupId = String(req.params.id || "");
    if (!(await canAccessRoom(req.user, "GROUP", groupId))) {
      return res.status(403).json({ error: "You do not have access to this group" });
    }
    const existingGroup = await prisma.chatGroup.findUnique({
      where: { id: groupId },
      select: { id: true, name: true },
    });
    if (!existingGroup) {
      return res.status(404).json({ error: "Group not found" });
    }
    if (!isDirectGroupMemberEditable(existingGroup)) {
      return res.status(400).json({ error: "One-to-one chats cannot be deleted from group controls" });
    }
    await prisma.chatGroup.delete({
      where: { id: groupId },
    });
    return res.status(204).send();
  } catch (err) {
    return sendSafeError(res, err, "Unable to add group member");
  }
}

export async function addChatGroupMembers(req, res) {
  try {
    if (!canManageGroups(req.user)) {
      return res.status(403).json({ error: "Only admin, manager, or superadmin can add members" });
    }
    const groupId = String(req.params.id || "");
    if (!(await canAccessRoom(req.user, "GROUP", groupId))) {
      return res.status(403).json({ error: "You do not have access to this group" });
    }
    const existingGroup = await prisma.chatGroup.findUnique({
      where: { id: groupId },
      select: { id: true, name: true },
    });
    if (!existingGroup) {
      return res.status(404).json({ error: "Group not found" });
    }
    if (!isDirectGroupMemberEditable(existingGroup)) {
      return res.status(400).json({ error: "One-to-one chats cannot add members" });
    }
    const memberIds = Array.isArray(req.body.memberIds) ? req.body.memberIds.map(String) : [];
    if (!memberIds.length) {
      return res.status(400).json({ error: "memberIds array is required" });
    }
    await prisma.chatGroupMember.createMany({
      data: [...new Set(memberIds)].map((userId) => ({
        groupId,
        userId,
        addedById: req.user.userId,
      })),
      skipDuplicates: true,
    });
    const members = await prisma.chatGroupMember.findMany({
      where: { groupId },
      include: {
        user: { select: CHAT_USER_SELECT },
      },
      orderBy: { createdAt: "asc" },
    });
    return res.json(members);
  } catch (err) {
    return sendSafeError(res, err, "Unable to remove group member");
  }
}

export async function removeChatGroupMember(req, res) {
  try {
    if (!canManageGroups(req.user)) {
      return res.status(403).json({ error: "Only admin, manager, or superadmin can remove members" });
    }
    const groupId = String(req.params.id || "");
    if (!(await canAccessRoom(req.user, "GROUP", groupId))) {
      return res.status(403).json({ error: "You do not have access to this group" });
    }
    const existingGroup = await prisma.chatGroup.findUnique({
      where: { id: groupId },
      select: { id: true, name: true },
    });
    if (!existingGroup) {
      return res.status(404).json({ error: "Group not found" });
    }
    if (!isDirectGroupMemberEditable(existingGroup)) {
      return res.status(400).json({ error: "One-to-one chats cannot remove members" });
    }
    const userId = String(req.params.userId || "");
    await prisma.chatGroupMember.deleteMany({
      where: { groupId, userId },
    });
    return res.json({ success: true });
  } catch (err) {
    return sendSafeError(res, err, "Unable to leave group");
  }
}

export async function clearChatLocal(req, res) {
  try {
    if (!canManageGroups(req.user)) {
      return res.status(403).json({ error: "Only superadmin, admin, or manager can clear chat" });
    }

    const channelType = String(req.params.type || "").toUpperCase();
    const channelId = String(req.params.id || "");
    if (!(await canAccessRoom(req.user, channelType, channelId))) {
      return res.status(403).json({ error: "You do not have access to this chat room" });
    }
    const messages = await prisma.chatMessage.findMany({
      where: {
        channelType,
        ...(channelType === "DEPARTMENT"
          ? { departmentId: channelId }
          : channelType === "PROJECT"
            ? { projectId: channelId }
            : { groupId: channelId }),
      },
      select: { id: true },
    });
    if (!messages.length) {
      return res.json({ success: true, hidden: 0 });
    }
    await prisma.chatMessageHidden.createMany({
      data: messages.map((message) => ({
        userId: req.user.userId,
        messageId: message.id,
      })),
      skipDuplicates: true,
    });
    return res.json({ success: true, hidden: messages.length });
  } catch (err) {
    return sendSafeError(res, err, "Unable to fetch group members");
  }
}

export async function getChatMedia(req, res) {
  try {
    const channelType = String(req.query.type || "").toUpperCase();
    const channelId = String(req.query.id || "");
    const mediaType = String(req.query.mediaType || "ALL").toUpperCase();

    if (!(await canAccessRoom(req.user, channelType, channelId))) {
      return res.status(403).json({ error: "You do not have access to this chat room" });
    }

    const messageTypeFilter =
      mediaType === "IMAGE"
        ? ["IMAGE", "STICKER"]
        : mediaType === "PDF"
          ? ["PDF"]
          : ["IMAGE", "STICKER", "PDF"];

    const messages = await prisma.chatMessage.findMany({
      where: {
        channelType,
        ...(channelType === "DEPARTMENT"
          ? { departmentId: channelId }
          : channelType === "PROJECT"
            ? { projectId: channelId }
            : { groupId: channelId }),
        hiddenBy: { none: { userId: req.user.userId } },
        isDeleted: false,
        attachmentUrl: { not: null },
        messageType: { in: messageTypeFilter },
      },
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: CHAT_USER_SELECT,
        },
      },
      take: 250,
    });

    return res.json(messages.map(toMessagePayload));
  } catch (err) {
    return sendSafeError(res, err, "Unable to mark messages as read");
  }
}

export async function deleteChatMedia(req, res) {
  try {
    const messageId = String(req.params.id || "");
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: {
        author: {
          select: CHAT_USER_SELECT,
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            messageType: true,
            attachmentFileName: true,
            isDeleted: true,
            author: {
              select: CHAT_USER_SELECT,
            },
          },
        },
      },
    });

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    const channelId =
      message.channelType === "DEPARTMENT"
        ? message.departmentId
        : message.channelType === "PROJECT"
          ? message.projectId
          : message.groupId;
    if (!(await canAccessRoom(req.user, message.channelType, channelId))) {
      return res.status(403).json({ error: "You do not have access to this chat room" });
    }

    if (!isMediaMessage(message)) {
      return res.status(400).json({ error: "This message does not contain media attachment" });
    }

    const canDeleteEveryone = message.authorId === req.user.userId || isLeadership(req.user);
    if (!canDeleteEveryone) {
      return res.status(403).json({ error: "Only sender or admin can delete media for everyone" });
    }

    await deleteChatAssetFromCloudinaryByUrl(message.attachmentUrl, message.attachmentMimeType).catch(() => null);

    const updated = await prisma.chatMessage.update({
      where: { id: message.id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        content: "This media was deleted",
        attachmentUrl: null,
        attachmentMimeType: null,
        attachmentFileName: null,
        messageType: "TEXT",
      },
      include: {
        author: {
          select: CHAT_USER_SELECT,
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            messageType: true,
            attachmentFileName: true,
            isDeleted: true,
            author: {
              select: CHAT_USER_SELECT,
            },
          },
        },
      },
    });

    emitCRMEvent("chat:message:update", toMessagePayload(updated));
    return res.json({ success: true });
  } catch (err) {
    return sendSafeError(res, err, "Unable to add reaction");
  }
}

export async function deleteChatMediaBulk(req, res) {
  try {
    const messageIds = Array.isArray(req.body.messageIds) ? req.body.messageIds.map(String) : [];
    if (!messageIds.length) {
      return res.status(400).json({ error: "messageIds array is required" });
    }

    const uniqueMessageIds = [...new Set(messageIds)].slice(0, 100);
    const messages = await prisma.chatMessage.findMany({
      where: { id: { in: uniqueMessageIds } },
      include: {
        author: {
          select: CHAT_USER_SELECT,
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            messageType: true,
            attachmentFileName: true,
            isDeleted: true,
            author: {
              select: CHAT_USER_SELECT,
            },
          },
        },
      },
    });

    const results = [];
    for (const message of messages) {
      const channelId =
        message.channelType === "DEPARTMENT"
          ? message.departmentId
          : message.channelType === "PROJECT"
            ? message.projectId
            : message.groupId;
      if (!(await canAccessRoom(req.user, message.channelType, channelId))) {
        results.push({ id: message.id, success: false, reason: "forbidden" });
        continue;
      }
      const canDeleteEveryone = message.authorId === req.user.userId || isLeadership(req.user);
      if (!canDeleteEveryone) {
        results.push({ id: message.id, success: false, reason: "not_allowed" });
        continue;
      }
      if (!isMediaMessage(message)) {
        results.push({ id: message.id, success: false, reason: "not_media" });
        continue;
      }

      await deleteChatAssetFromCloudinaryByUrl(message.attachmentUrl, message.attachmentMimeType).catch(() => null);

      const updated = await prisma.chatMessage.update({
        where: { id: message.id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          content: "This media was deleted",
          attachmentUrl: null,
          attachmentMimeType: null,
          attachmentFileName: null,
          messageType: "TEXT",
        },
        include: {
        author: {
          select: CHAT_USER_SELECT,
        },
        replyTo: {
          select: {
              id: true,
              content: true,
              messageType: true,
            attachmentFileName: true,
            isDeleted: true,
            author: {
              select: CHAT_USER_SELECT,
            },
          },
        },
        },
      });
      emitCRMEvent("chat:message:update", toMessagePayload(updated));
      results.push({ id: message.id, success: true });
    }

    return res.json({
      success: true,
      deletedCount: results.filter((r) => r.success).length,
      results,
    });
  } catch (err) {
    return sendSafeError(res, err, "Unable to remove reaction");
  }
}

export async function uploadChatAttachment(req, res) {
  try {
    const channelType = String(req.body.channelType || "").toUpperCase();
    const channelId = String(req.body.channelId || "");

    if (!(await canAccessRoom(req.user, channelType, channelId))) {
      return res.status(403).json({ error: "You do not have access to this chat room" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const messageType = getMessageTypeFromMime(req.file.mimetype);
    if (!["IMAGE", "PDF", "STICKER"].includes(messageType)) {
      return res.status(400).json({ error: "Unsupported file type. Only images and PDFs are allowed." });
    }

    const safeBaseName = req.file.originalname
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .slice(0, 50);
    const publicId = `${channelType.toLowerCase()}-${channelId}/${Date.now()}-${safeBaseName || "attachment"}`;

    const uploaded = await uploadChatAssetToCloudinary(req.file, {
      folder: "planitt-crm/chat",
      publicId,
      resourceType: getCloudinaryResourceTypeFromMime(req.file.mimetype),
    });

    return res.status(201).json({
      messageType,
      attachmentUrl: uploaded.secure_url,
      attachmentMimeType: req.file.mimetype,
      attachmentFileName: req.file.originalname,
      size: req.file.size,
    });
  } catch (err) {
    return sendSafeError(res, err, "Unable to upload attachment");
  }
}
