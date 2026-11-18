import prisma from "../config/db.js";
import { emitNotification, emitCRMEvent } from "../socket.js";

const GOOGLE_CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

// Helper to attempt Google Calendar API creation if token is available
async function tryCreateGoogleCalendarEvent(userId, { title, description, startAt, endAt, attendeeEmails = [] }) {
  try {
    const connection = await prisma.googleWorkspaceConnection.findUnique({
      where: { userId },
    });

    if (!connection || !connection.accessToken) {
      return null;
    }

    const payload = {
      summary: title,
      description: description || "Planitt CRM Meeting",
      start: { dateTime: new Date(startAt).toISOString() },
      end: { dateTime: new Date(endAt).toISOString() },
      attendees: attendeeEmails.map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: `planitt-meet-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    };

    const res = await fetch(`${GOOGLE_CALENDAR_EVENTS_URL}?conferenceDataVersion=1`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        eventId: data.id,
        meetUrl: data.hangoutLink || data.conferenceData?.entryPoints?.[0]?.uri || null,
        htmlLink: data.htmlLink || null,
      };
    }
  } catch (err) {
    console.warn("Could not sync with Google Calendar API:", err.message);
  }
  return null;
}

export async function getCalendarEvents(req, res) {
  try {
    const { start, end } = req.query;
    const startDate = start ? new Date(start) : new Date(Date.now() - 30 * 86400000);
    const endDate = end ? new Date(end) : new Date(Date.now() + 60 * 86400000);

    const [events, tasks, leaves] = await Promise.all([
      prisma.calendarEvent.findMany({
        where: {
          startAt: { gte: startDate, lte: endDate },
        },
        include: {
          organizer: { select: { id: true, name: true, email: true, avatarUrl: true } },
          project: { select: { id: true, name: true } },
          deal: { select: { id: true, title: true } },
        },
        orderBy: { startAt: "asc" },
      }),
      prisma.task.findMany({
        where: {
          deadlineAt: { gte: startDate, lte: endDate },
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          deadlineAt: true,
          project: { select: { id: true, name: true } },
        },
      }),
      prisma.leaveRequest.findMany({
        where: {
          status: "APPROVED",
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          reason: true,
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
    ]);

    // Format tasks and leaves as calendar items
    const taskEvents = tasks.map((t) => ({
      id: `task_${t.id}`,
      title: `Task Due: ${t.title}`,
      description: `Status: ${t.status} | Priority: ${t.priority}`,
      startAt: t.deadlineAt,
      endAt: t.deadlineAt,
      type: "TASK_DEADLINE",
      project: t.project,
    }));

    const leaveEvents = leaves.map((l) => ({
      id: `leave_${l.id}`,
      title: `Leave: ${l.user.name}`,
      description: l.reason || "Approved Leave",
      startAt: l.startDate,
      endAt: l.endDate,
      type: "LEAVE",
      user: l.user,
    }));

    const standardEvents = events.map((e) => ({
      ...e,
      type: "MEETING",
    }));

    res.json({
      events: [...standardEvents, ...taskEvents, ...leaveEvents],
    });
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    res.status(500).json({ error: "Failed to fetch calendar events" });
  }
}

export async function createCalendarEvent(req, res) {
  try {
    const { title, description, startAt, endAt, projectId, dealId, attendeeIds = [] } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Meeting title is required" });
    }

    const start = startAt ? new Date(startAt) : new Date();
    const end = endAt ? new Date(endAt) : new Date(start.getTime() + 30 * 60000);

    // Fetch attendee emails
    let attendeeEmails = [];
    if (attendeeIds.length > 0) {
      const attendees = await prisma.user.findMany({
        where: { id: { in: attendeeIds } },
        select: { id: true, email: true },
      });
      attendeeEmails = attendees.map((a) => a.email);
    }

    // Try Google Calendar sync
    const googleResult = await tryCreateGoogleCalendarEvent(req.user.id, {
      title,
      description,
      startAt: start,
      endAt: end,
      attendeeEmails,
    });

    // Fallback unique Google Meet link if Google Calendar sync isn't hooked yet
    const cleanMeetingCode = `${Math.random().toString(36).substring(2, 5)}-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`;
    const meetUrl = googleResult?.meetUrl || `https://meet.google.com/${cleanMeetingCode}`;

    const event = await prisma.calendarEvent.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        startAt: start,
        endAt: end,
        meetUrl,
        googleEventId: googleResult?.eventId || null,
        organizerId: req.user.id,
        projectId: projectId || null,
        dealId: dealId || null,
        attendeeIds: attendeeIds || [],
      },
      include: {
        organizer: { select: { id: true, name: true, email: true, avatarUrl: true } },
        project: { select: { id: true, name: true } },
        deal: { select: { id: true, title: true } },
      },
    });

    emitCRMEvent("calendar:event_created", event);

    // Notify attendees
    for (const attendeeId of attendeeIds) {
      if (attendeeId !== req.user.id) {
        emitNotification(attendeeId, {
          id: `meet_${event.id}`,
          type: "MEETING_INVITE",
          title: `Meeting Invite: ${event.title}`,
          message: `${event.organizer.name} invited you to a meeting on ${start.toLocaleDateString()} at ${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`,
          href: event.meetUrl,
          priority: "HIGH",
          read: false,
          createdAt: new Date().toISOString(),
        });
      }
    }

    res.status(201).json(event);
  } catch (error) {
    console.error("Error creating calendar event:", error);
    res.status(500).json({ error: "Failed to create calendar event" });
  }
}

export async function quickMeet(req, res) {
  try {
    const { title = "Quick Instant Meeting", channelId, projectId, attendeeIds = [] } = req.body;

    const start = new Date();
    const end = new Date(start.getTime() + 45 * 60000);

    const cleanCode = `${Math.random().toString(36).substring(2, 5)}-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`;
    const meetUrl = `https://meet.google.com/${cleanCode}`;

    const event = await prisma.calendarEvent.create({
      data: {
        title,
        startAt: start,
        endAt: end,
        meetUrl,
        organizerId: req.user.id,
        projectId: projectId || null,
        attendeeIds,
      },
      include: {
        organizer: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    // If initiated from a channel, post message directly to channel
    if (channelId) {
      await prisma.chatMessage.create({
        data: {
          channelType: "CHANNEL",
          channelId,
          authorId: req.user.id,
          content: `Started instant Google Meet: ${title}`,
          messageType: "MEETING",
          meetingUrl: meetUrl,
          meetingTitle: title,
        },
      });
    }

    emitCRMEvent("meet:instant_created", event);
    res.status(201).json(event);
  } catch (error) {
    console.error("Error creating quick meet:", error);
    res.status(500).json({ error: "Failed to create quick meet" });
  }
}

export async function deleteCalendarEvent(req, res) {
  try {
    const { id } = req.params;
    await prisma.calendarEvent.delete({ where: { id } });
    emitCRMEvent("calendar:event_deleted", { id });
    res.json({ success: true, message: "Calendar event deleted" });
  } catch (error) {
    console.error("Error deleting calendar event:", error);
    res.status(500).json({ error: "Failed to delete calendar event" });
  }
}
