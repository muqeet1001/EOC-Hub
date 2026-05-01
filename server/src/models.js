import mongoose from "mongoose";
import { createModelProxy } from "./memory-store.js";

const deliverySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    email: { type: String, default: "" },
    emailStatus: { type: String, default: "pending" },
    emailedAt: { type: Date, default: null },
    emailError: { type: String, default: "" },
    messageId: { type: String, default: "" },
  },
  { _id: false },
);

const summarySchema = new mongoose.Schema(
  {
    keyPoints: [{ type: String }],
    decisions: [{ type: String }],
    actionItems: [{ type: String }],
  },
  { _id: false },
);

const baseOptions = {
  versionKey: false,
};

const cellSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
  },
  baseOptions,
);

const userSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, index: true },
    password: { type: String, required: true },
    role: { type: String, required: true, index: true },
    cellId: { type: String, default: null, index: true },
    phone: { type: String, default: "" },
    designation: { type: String, default: "" },
  },
  baseOptions,
);

const circularSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    cellId: { type: String, required: true, index: true },
    createdBy: { type: String, required: true },
    fileName: { type: String, default: "" },
    fileMimeType: { type: String, default: "" },
    fileSize: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now, index: true },
    readBy: [{ type: String }],
    deliveries: [deliverySchema],
  },
  baseOptions,
);

const meetingSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    circularId: { type: String, default: null },
    cellId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    scheduledAt: { type: Date, required: true },
    meetingLink: { type: String, required: true },
    createdBy: { type: String, required: true },
    attendees: [{ type: String }],
    status: { type: String, default: "Scheduled" },
  },
  baseOptions,
);

const reportSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    meetingId: { type: String, required: true, index: true },
    cellId: { type: String, required: true, index: true },
    summary: { type: summarySchema, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  baseOptions,
);

const notificationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, required: true },
    entityId: { type: String, required: true },
    read: { type: Boolean, default: false, index: true },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  baseOptions,
);

const cellModel = mongoose.models.Cell || mongoose.model("Cell", cellSchema);
const userModel = mongoose.models.User || mongoose.model("User", userSchema);
const circularModel = mongoose.models.Circular || mongoose.model("Circular", circularSchema);
const meetingModel = mongoose.models.Meeting || mongoose.model("Meeting", meetingSchema);
const reportModel = mongoose.models.Report || mongoose.model("Report", reportSchema);
const notificationModel =
  mongoose.models.Notification || mongoose.model("Notification", notificationSchema);

export const Cell = createModelProxy("Cell", cellModel);
export const User = createModelProxy("User", userModel);
export const Circular = createModelProxy("Circular", circularModel);
export const Meeting = createModelProxy("Meeting", meetingModel);
export const Report = createModelProxy("Report", reportModel);
export const Notification = createModelProxy("Notification", notificationModel);
