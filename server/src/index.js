import "dotenv/config";
import path from "node:path";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import multer from "multer";
import { connectDatabase, ensureSeedData } from "./db.js";
import { roles } from "./data.js";
import { getMailerStatus } from "./email.js";
import { readEnv, readNumberEnv } from "./env.js";
import { getMemoryStoreReason, isMemoryStoreEnabled } from "./memory-store.js";
import { Circular, User } from "./models.js";
import {
  buildBootstrap,
  canHeadManageCell,
  createCircular,
  createMeeting,
  findUserById,
  generateSummary,
  getAccountContext,
  hasCellAccess,
  joinMeeting,
  markCircularRead,
  markNotificationRead,
} from "./services.js";

const app = express();
const PORT = readNumberEnv("PORT", 4000);
const JWT_SECRET = readEnv("JWT_SECRET");
const ADMIN_EMAIL = readEnv("ADMIN_EMAIL");
const ADMIN_PASSWORD = readEnv("ADMIN_PASSWORD");
const MAX_ATTACHMENT_SIZE_MB = readNumberEnv("MAX_ATTACHMENT_SIZE_MB", 10);

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET must be set before starting the server");
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_ATTACHMENT_SIZE_MB * 1024 * 1024,
  },
});

app.use(cors());
app.use(express.json());

function publicBaseUrl() {
  return readEnv("PUBLIC_APP_URL", `http://localhost:${PORT}`);
}

function safeAttachmentName(originalName) {
  const parsed = path.parse(originalName || "circular.pdf");
  const base = parsed.name
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  const ext = parsed.ext || ".pdf";

  return `${base || "circular"}${ext}`;
}

function buildAttachment(file) {
  if (!file) {
    return null;
  }

  return {
    fileName: safeAttachmentName(file.originalname),
    fileMimeType: file.mimetype,
    fileSize: file.size,
    buffer: file.buffer,
  };
}

async function authRequired(req, res, next) {
  // Always use admin user - no authentication required
  let fallbackUser =
    (await User.findOne({ role: roles.ADMIN }).lean()) ?? (await User.findOne({}).lean());

  if (!fallbackUser && ADMIN_EMAIL) {
    const created = await User.create({
      id: "user-admin",
      name: "Admin",
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD || "",
      role: roles.ADMIN,
      cellId: null,
      phone: "",
      designation: "",
    });
    fallbackUser = created.toObject();
  }

  if (!fallbackUser) {
    return res.status(500).json({ message: "No admin user configured" });
  }

  req.user = fallbackUser;
  next();
}

function allowRoles(...allowed) {
  return async (req, res, next) => {
    const accountContext = await getAccountContext(req.user);

    if (!allowed.includes(accountContext.effectiveRole)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
}

app.get("/api/health", async (_req, res) => {
  res.json({
    status: "ok",
    database: isMemoryStoreEnabled() ? "memory-fallback" : "connected",
    fallbackReason: isMemoryStoreEnabled() ? getMemoryStoreReason() : null,
    mailer: getMailerStatus(),
  });
});

// Login endpoint removed - no authentication required

app.get("/api/bootstrap", authRequired, async (req, res) => {
  res.json(await buildBootstrap(req.user));
});

app.get("/api/circulars/:id", authRequired, async (req, res) => {
  const circular = await Circular.findOne({ id: req.params.id }).lean();
  if (!circular) {
    return res.status(404).json({ message: "Circular not found" });
  }

  if (!(await hasCellAccess(req.user, circular.cellId))) {
    return res.status(403).json({ message: "No cross-cell visibility allowed" });
  }

  return res.json(circular);
});

app.post(
  "/api/circulars",
  authRequired,
  allowRoles(roles.ADMIN),
  upload.single("file"),
  async (req, res) => {
    try {
      const { title, description, cellId } = req.body;

      if (!title || !description || !cellId) {
        return res.status(400).json({ message: "Title, description, and cell are required" });
      }

      if (req.file && req.file.mimetype !== "application/pdf") {
        return res.status(400).json({ message: "Only PDF circular attachments are supported" });
      }

      const attachment = buildAttachment(req.file);
      const circular = await createCircular({
        title,
        description,
        cellId,
        createdBy: req.user.id,
        attachment,
      });

      return res.status(201).json(circular);
    } catch (error) {
      return res.status(500).json({ message: error.message || "Failed to create circular" });
    }
  },
);

app.patch("/api/circulars/:id/read", authRequired, async (req, res) => {
  const circular = await Circular.findOne({ id: req.params.id }).lean();
  if (!circular) {
    return res.status(404).json({ message: "Circular not found" });
  }

  if (!(await hasCellAccess(req.user, circular.cellId))) {
    return res.status(403).json({ message: "No cross-cell visibility allowed" });
  }

  res.json(await markCircularRead(req.params.id, req.user.id));
});

app.post(
  "/api/meetings",
  authRequired,
  allowRoles(roles.ADMIN, roles.CELL_HEAD),
  async (req, res) => {
    const { circularId, cellId, title, scheduledAt, meetingLink } = req.body;

    if (!title || !scheduledAt || !meetingLink || !cellId) {
      return res
        .status(400)
        .json({ message: "Title, date/time, meeting link, and cell are required" });
    }

    if (!(await canHeadManageCell(req.user, cellId))) {
      return res.status(403).json({ message: "Cell heads can schedule only for their cell" });
    }

    const meeting = await createMeeting({
      circularId,
      cellId,
      title,
      scheduledAt,
      meetingLink,
      createdBy: req.user.id,
    });

    return res.status(201).json(meeting);
  },
);

app.patch("/api/meetings/:id/join", authRequired, async (req, res) => {
  const meeting = await joinMeeting(req.params.id, req.user.id);
  if (!meeting) {
    return res.status(404).json({ message: "Meeting not found" });
  }

  if (!(await hasCellAccess(req.user, meeting.cellId))) {
    return res.status(403).json({ message: "No cross-cell visibility allowed" });
  }

  return res.json(meeting);
});

app.post(
  "/api/meetings/:id/summary",
  authRequired,
  allowRoles(roles.ADMIN, roles.CELL_HEAD),
  async (req, res) => {
    const report = await generateSummary(req.params.id);
    if (!report) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    if (!(await canHeadManageCell(req.user, report.cellId))) {
      return res.status(403).json({ message: "Cell heads can summarize only for their cell" });
    }

    return res.status(201).json(report);
  },
);

app.patch("/api/notifications/:id/read", authRequired, async (req, res) => {
  const notification = await markNotificationRead(req.params.id, req.user.id);
  if (!notification) {
    return res.status(404).json({ message: "Notification not found" });
  }

  return res.json(notification);
});

app.use((error, _req, res, next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      message: `Attachment exceeds the ${MAX_ATTACHMENT_SIZE_MB} MB upload limit`,
    });
  }

  if (error) {
    return res.status(500).json({ message: error.message || "Unexpected server error" });
  }

  return next();
});

async function start() {
  try {
    await connectDatabase();
    await ensureSeedData();
    app.listen(PORT, () => {
      const storeLabel = isMemoryStoreEnabled() ? "memory fallback" : "MongoDB";
      console.log(`EOC Hub backend running at ${publicBaseUrl()} using ${storeLabel}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

start();
