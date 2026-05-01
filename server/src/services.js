import { randomUUID } from "node:crypto";
import { roles } from "./data.js";
import { sendCircularEmail } from "./email.js";
import { Cell, Circular, Meeting, Notification, Report, User } from "./models.js";

async function getCellMap() {
  const cells = await Cell.find().lean();
  return new Map(cells.map((cell) => [cell.id, cell.name]));
}

export async function findUserById(userId) {
  return User.findOne({ id: userId }).lean();
}

export async function getAccountUsers(user) {
  if (!user) {
    return [];
  }

  if (user.role === roles.ADMIN) {
    return [user];
  }

  return User.find({ email: user.email }).lean();
}

export async function getAccountContext(user) {
  const accountUsers = await getAccountUsers(user);
  const cellIds = [...new Set(accountUsers.map((item) => item.cellId).filter(Boolean))];
  const effectiveRole = accountUsers.some((item) => item.role === roles.ADMIN)
    ? roles.ADMIN
    : accountUsers.some((item) => item.role === roles.CELL_HEAD)
      ? roles.CELL_HEAD
      : roles.CELL_MEMBER;

  return {
    accountUsers,
    accountUserIds: accountUsers.map((item) => item.id),
    cellIds,
    effectiveRole,
  };
}

export async function hasCellAccess(user, cellId) {
  const accountContext = await getAccountContext(user);
  return (
    accountContext.effectiveRole === roles.ADMIN || accountContext.cellIds.includes(cellId)
  );
}

export async function canHeadManageCell(user, cellId) {
  const accountContext = await getAccountContext(user);

  if (accountContext.effectiveRole === roles.ADMIN) {
    return true;
  }

  return accountContext.accountUsers.some(
    (accountUser) => accountUser.role === roles.CELL_HEAD && accountUser.cellId === cellId,
  );
}

export async function sanitizeUser(user, preloaded = {}) {
  if (!user) {
    return null;
  }

  const accountContext = preloaded.accountContext ?? (await getAccountContext(user));
  const cellMap = preloaded.cellMap ?? (await getCellMap());
  const cellNames = accountContext.cellIds.map((cellId) => cellMap.get(cellId)).filter(Boolean);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: accountContext.effectiveRole,
    cellId: accountContext.cellIds[0] ?? user.cellId,
    cellName:
      cellNames.length > 1 ? `${cellNames[0]} + ${cellNames.length - 1} more` : cellNames[0] ?? "",
    cellNames,
    phone: user.phone ?? "",
    designation: user.designation ?? "",
  };
}

async function enrichCircular(circular, cellMap) {
  const recipients = await User.find({ cellId: circular.cellId }).lean();
  const recipientMap = new Map((circular.deliveries ?? []).map((delivery) => [delivery.userId, delivery]));

  const recipientPayload = await Promise.all(
    recipients.map(async (recipient) => {
      const delivery = recipientMap.get(recipient.id) ?? {
        userId: recipient.id,
        read: circular.readBy?.includes(recipient.id) ?? false,
        readAt: null,
      };

      const sanitized = await sanitizeUser(recipient, {
        accountContext: {
          accountUsers: [recipient],
          accountUserIds: [recipient.id],
          cellIds: [recipient.cellId].filter(Boolean),
          effectiveRole: recipient.role,
        },
        cellMap,
      });

      return {
        ...sanitized,
        read: delivery.read,
        readAt: delivery.readAt,
        emailStatus: delivery.emailStatus ?? "pending",
        emailedAt: delivery.emailedAt ?? null,
        emailError: delivery.emailError ?? "",
        messageId: delivery.messageId ?? "",
      };
    }),
  );

  const headRecipient =
    recipientPayload.find((recipient) => recipient.role === roles.CELL_HEAD) ?? null;

  return {
    ...circular,
    cellName: cellMap.get(circular.cellId) ?? "All Cells",
    recipients: recipientPayload,
    deliverySummary: {
      total: recipientPayload.length,
      read: recipientPayload.filter((recipient) => recipient.read).length,
      unread: recipientPayload.filter((recipient) => !recipient.read).length,
      sent: recipientPayload.filter((recipient) => recipient.emailStatus === "sent").length,
      failed: recipientPayload.filter((recipient) => recipient.emailStatus === "failed").length,
      skipped: recipientPayload.filter((recipient) => recipient.emailStatus === "skipped").length,
      notConfigured: recipientPayload.filter(
        (recipient) => recipient.emailStatus === "not_configured",
      ).length,
      pending: recipientPayload.filter((recipient) => recipient.emailStatus === "pending").length,
    },
    headRecipient,
    headStatus: {
      assigned: Boolean(headRecipient),
      read: headRecipient?.read ?? false,
      unread: headRecipient ? !headRecipient.read : false,
      readAt: headRecipient?.readAt ?? null,
    },
  };
}

async function getMembersDirectory(user, accountContext, cellMap) {
  const visibleCells =
    accountContext.effectiveRole === roles.ADMIN
      ? await Cell.find().lean()
      : await Cell.find({ id: { $in: accountContext.cellIds } }).lean();

  const members = await User.find({
    cellId: { $in: visibleCells.map((cell) => cell.id) },
  }).lean();

  return Promise.all(
    visibleCells.map(async (cell) => ({
      id: cell.id,
      name: cell.name,
      members: await Promise.all(
        members
          .filter((member) => member.cellId === cell.id)
          .map((member) =>
            sanitizeUser(member, {
              accountContext: {
                accountUsers: [member],
                accountUserIds: [member.id],
                cellIds: [member.cellId].filter(Boolean),
                effectiveRole: member.role,
              },
              cellMap,
            }),
          ),
      ),
    })),
  );
}

async function getVisibleCirculars(user, accountContext) {
  if (accountContext.effectiveRole === roles.ADMIN) {
    return Circular.find().sort({ createdAt: -1 }).lean();
  }

  return Circular.find({ cellId: { $in: accountContext.cellIds } })
    .sort({ createdAt: -1 })
    .lean();
}

async function getVisibleMeetings(user, accountContext) {
  if (accountContext.effectiveRole === roles.ADMIN) {
    return Meeting.find().sort({ scheduledAt: -1 }).lean();
  }

  return Meeting.find({ cellId: { $in: accountContext.cellIds } })
    .sort({ scheduledAt: -1 })
    .lean();
}

async function getVisibleReports(user, accountContext) {
  if (accountContext.effectiveRole === roles.ADMIN) {
    return Report.find().sort({ createdAt: -1 }).lean();
  }

  if (accountContext.effectiveRole === roles.CELL_HEAD) {
    return Report.find({ cellId: { $in: accountContext.cellIds } })
      .sort({ createdAt: -1 })
      .lean();
  }

  return [];
}

async function getVisibleNotifications(user, accountContext) {
  return Notification.find({ userId: { $in: accountContext.accountUserIds } })
    .sort({ createdAt: -1 })
    .lean();
}

async function getDashboardData(user, accountContext, payload) {
  if (accountContext.effectiveRole === roles.ADMIN) {
    const totalCells = await Cell.countDocuments();
    const totalMembers = await User.countDocuments({ role: { $ne: roles.ADMIN } });

    return {
      heroTitle: "Chairman Control Center",
      stats: [
        { label: "Total Cells", value: totalCells },
        { label: "Circulars", value: payload.circulars.length },
        { label: "Active Meetings", value: payload.meetings.length },
        { label: "Members", value: totalMembers },
      ],
      recentCirculars: payload.circulars.slice(0, 5),
      meetings: payload.meetings.slice(0, 5),
      reports: payload.reports.slice(0, 5),
      notifications: payload.notifications.slice(0, 5),
      membersDirectory: payload.membersDirectory,
    };
  }

  const sanitized = await sanitizeUser(user, { accountContext, cellMap: payload.cellMap });

  return {
    heroTitle:
      accountContext.cellIds.length > 1 ? "Multi-Cell Workspace" : `${sanitized.cellName} Workspace`,
    stats: [
      { label: "My Circulars", value: payload.circulars.length },
      { label: "My Meetings", value: payload.meetings.length },
      { label: "Notifications", value: payload.notifications.length },
      { label: "Reports", value: payload.reports.length },
    ],
    recentCirculars: payload.circulars.slice(0, 5),
    meetings: payload.meetings.slice(0, 5),
    reports: payload.reports.slice(0, 5),
    notifications: payload.notifications.slice(0, 5),
    membersDirectory: payload.membersDirectory,
  };
}

export async function createCircular({
  title,
  description,
  cellId,
  createdBy,
  attachment,
}) {
  const recipients = await User.find({ cellId }).lean();
  const cell = await Cell.findOne({ id: cellId }).lean();
  const cellName = cell?.name ?? cellId;
  const circular = await Circular.create({
    id: randomUUID(),
    title,
    description,
    cellId,
    createdBy,
    fileName: attachment?.fileName ?? "",
    fileMimeType: attachment?.fileMimeType ?? "",
    fileSize: attachment?.fileSize ?? 0,
    createdAt: new Date(),
    readBy: [],
    deliveries: recipients.map((recipient) => ({
      userId: recipient.id,
      read: false,
      readAt: null,
      email: recipient.email ?? "",
      emailStatus: "pending",
      emailedAt: null,
      emailError: "",
      messageId: "",
    })),
  });

  if (recipients.length) {
    const deliveryResults = await Promise.all(
      recipients.map((recipient) =>
        sendCircularEmail({
          recipient,
          cellName,
          circular: circular.toObject(),
          attachment,
        }),
      ),
    );

    circular.deliveries.forEach((delivery, index) => {
      const result = deliveryResults[index];
      delivery.emailStatus = result.status;
      delivery.emailedAt = result.sentAt;
      delivery.emailError = result.error ?? "";
      delivery.messageId = result.messageId ?? "";
    });

    await circular.save();
  }

  if (recipients.length) {
    await Notification.insertMany(
      recipients.map((recipient) => ({
        id: randomUUID(),
        userId: recipient.id,
        title: `New circular for ${cell?.name ?? cellId}`,
        message: `${title} has been shared with your cell.`,
        type: "circular",
        entityId: circular.id,
        read: false,
        createdAt: new Date(),
      })),
    );
  }

  return enrichCircular(circular.toObject(), await getCellMap());
}

export async function markCircularRead(circularId, userId) {
  const circular = await Circular.findOne({ id: circularId });
  if (!circular) {
    return null;
  }

  const activeUser = await User.findOne({ id: userId }).lean();
  const accountContext = await getAccountContext(activeUser);
  const targetUserIds = accountContext.accountUsers
    .filter((accountUser) => accountUser.cellId === circular.cellId)
    .map((accountUser) => accountUser.id);

  const effectiveTargets = targetUserIds.length ? targetUserIds : [userId];

  effectiveTargets.forEach((targetUserId) => {
    if (!circular.readBy.includes(targetUserId)) {
      circular.readBy.push(targetUserId);
    }

    const delivery = circular.deliveries.find((item) => item.userId === targetUserId);
    if (delivery) {
      delivery.read = true;
      delivery.readAt = delivery.readAt ?? new Date();
    }
  });

  await circular.save();
  return circular.toObject();
}

export async function createMeeting({
  circularId,
  cellId,
  title,
  scheduledAt,
  meetingLink,
  createdBy,
}) {
  const meeting = await Meeting.create({
    id: randomUUID(),
    circularId,
    cellId,
    title,
    scheduledAt: new Date(scheduledAt),
    meetingLink,
    createdBy,
    attendees: [createdBy],
    status: "Scheduled",
  });

  const recipients = await User.find({ cellId }).lean();
  if (recipients.length) {
    const cell = await Cell.findOne({ id: cellId }).lean();
    await Notification.insertMany(
      recipients.map((recipient) => ({
        id: randomUUID(),
        userId: recipient.id,
        title: `Meeting scheduled for ${cell?.name ?? cellId}`,
        message: `${title} has been added to your calendar.`,
        type: "meeting",
        entityId: meeting.id,
        read: false,
        createdAt: new Date(),
      })),
    );
  }

  return meeting.toObject();
}

export async function joinMeeting(meetingId, userId) {
  const meeting = await Meeting.findOne({ id: meetingId });
  if (!meeting) {
    return null;
  }

  if (!meeting.attendees.includes(userId)) {
    meeting.attendees.push(userId);
    await meeting.save();
  }

  return meeting.toObject();
}

export async function generateSummary(meetingId) {
  const meeting = await Meeting.findOne({ id: meetingId });
  if (!meeting) {
    return null;
  }

  const circular = await Circular.findOne({ id: meeting.circularId }).lean();
  const existingReport = await Report.findOne({ meetingId: meeting.id });

  const summary = {
    keyPoints: [
      `Meeting focused on ${meeting.title}.`,
      `Primary circular context: ${circular?.title ?? "General coordination"}.`,
      "Attendance and member concerns were captured for follow-up.",
    ],
    decisions: [
      "Proceed with cell-specific outreach and awareness activities.",
      "Escalate unresolved issues to the chairman dashboard.",
    ],
    actionItems: [
      "Share meeting minutes with all notified members.",
      "Track completion of the assigned follow-up tasks.",
    ],
  };

  if (existingReport) {
    existingReport.summary = summary;
    existingReport.createdAt = new Date();
    await existingReport.save();
    meeting.status = "Summarized";
    await meeting.save();
    return existingReport.toObject();
  }

  const report = await Report.create({
    id: randomUUID(),
    meetingId: meeting.id,
    cellId: meeting.cellId,
    summary,
    createdAt: new Date(),
  });

  meeting.status = "Summarized";
  await meeting.save();
  return report.toObject();
}

export async function markNotificationRead(notificationId, userId) {
  const activeUser = await User.findOne({ id: userId }).lean();
  const accountContext = await getAccountContext(activeUser);
  const notification = await Notification.findOne({
    id: notificationId,
    userId: { $in: accountContext.accountUserIds },
  });

  if (!notification) {
    return null;
  }

  notification.read = true;
  await notification.save();
  return notification.toObject();
}

export async function buildBootstrap(user) {
  const accountContext = await getAccountContext(user);
  const cellMap = await getCellMap();

  const [cells, rawCirculars, meetings, reports, notifications, membersDirectory] = await Promise.all([
    Cell.find().lean(),
    getVisibleCirculars(user, accountContext),
    getVisibleMeetings(user, accountContext),
    getVisibleReports(user, accountContext),
    getVisibleNotifications(user, accountContext),
    getMembersDirectory(user, accountContext, cellMap),
  ]);

  const circulars = await Promise.all(
    rawCirculars.map((circular) => enrichCircular(circular, cellMap)),
  );

  const meetingPayload = meetings.map((meeting) => ({
    ...meeting,
    cellName: cellMap.get(meeting.cellId) ?? "All Cells",
  }));

  const reportPayload = reports.map((report) => ({
    ...report,
    cellName: cellMap.get(report.cellId) ?? "All Cells",
  }));

  const sanitizedUser = await sanitizeUser(user, { accountContext, cellMap });
  const dashboard = await getDashboardData(user, accountContext, {
    circulars,
    meetings: meetingPayload,
    reports: reportPayload,
    notifications,
    membersDirectory,
    cellMap,
  });

  return {
    user: sanitizedUser,
    cells,
    circulars,
    meetings: meetingPayload,
    reports: reportPayload,
    notifications,
    dashboard,
    membersDirectory,
  };
}
