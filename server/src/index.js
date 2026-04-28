import "dotenv/config";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { connectDatabase, ensureSeedData } from "./db.js";
import { roles } from "./data.js";
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
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "eoc-hub-secret";

const upload = multer({ storage: multer.memoryStorage() });

const cloudinaryConfigured =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

app.use(cors());
app.use(express.json());

async function uploadCircularFile(file) {
  if (!file) {
    return { fileUrl: null, filePublicId: null };
  }

  if (!cloudinaryConfigured) {
    throw new Error("Cloudinary is not configured. Add Cloudinary environment variables.");
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: process.env.CLOUDINARY_FOLDER || "eoc-hub/circulars",
        resource_type: "raw",
        public_id: `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve({
          fileUrl: result?.secure_url ?? null,
          filePublicId: result?.public_id ?? null,
        });
      },
    );

    stream.end(file.buffer);
  });
}

function buildSignedFileUrl(filePublicId) {
  if (!filePublicId || !cloudinaryConfigured) {
    return null;
  }

  const extensionMatch = filePublicId.match(/^(.*)\.([^.]+)$/);
  const format = extensionMatch ? extensionMatch[2] : undefined;

  return cloudinary.utils.private_download_url(filePublicId, format, {
    resource_type: "raw",
    type: "upload",
    attachment: false,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
  });
}

async function authRequired(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Missing token" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await findUserById(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: "Invalid token user" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
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
  res.json({ status: "ok", database: "connected" });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const accountUsers = await User.find({ email }).lean();
  const user = accountUsers.find((item) => item.password === password);

  if (!user) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: "8h",
  });

  return res.json({
    token,
    bootstrap: await buildBootstrap(user),
  });
});

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

app.get("/api/circulars/:id/file", authRequired, async (req, res) => {
  const circular = await Circular.findOne({ id: req.params.id }).lean();
  if (!circular) {
    return res.status(404).json({ message: "Circular not found" });
  }

  if (!(await hasCellAccess(req.user, circular.cellId))) {
    return res.status(403).json({ message: "No cross-cell visibility allowed" });
  }

  if (!circular.filePublicId) {
    return res.status(404).json({ message: "No file available for this circular" });
  }

  const signedUrl = buildSignedFileUrl(circular.filePublicId);
  if (!signedUrl) {
    return res.status(500).json({ message: "Cloudinary is not configured." });
  }

  return res.json({ url: signedUrl });
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

      const uploadResult = await uploadCircularFile(req.file);
      const circular = await createCircular({
        title,
        description,
        cellId,
        createdBy: req.user.id,
        fileUrl: uploadResult.fileUrl,
        filePublicId: uploadResult.filePublicId,
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

async function start() {
  try {
    await connectDatabase();
    await ensureSeedData();
    app.listen(PORT, () => {
      console.log(`EOC Hub backend running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

start();
