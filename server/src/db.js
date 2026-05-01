import mongoose from "mongoose";
import { cells, users } from "./data.js";
import { readBooleanEnv, readEnv } from "./env.js";
import { enableMemoryStore, isMemoryStoreEnabled } from "./memory-store.js";
import { Cell, Circular, Meeting, Notification, Report, User } from "./models.js";

const MONGODB_URI = readEnv("MONGODB_URI");
const ENABLE_MEMORY_FALLBACK = readBooleanEnv("ENABLE_MEMORY_FALLBACK", false);
const ENABLE_DEMO_SEED_DATA = readBooleanEnv("ENABLE_DEMO_SEED_DATA", false);

function hasMongoUri() {
  if (!MONGODB_URI) {
    if (!ENABLE_MEMORY_FALLBACK) {
      throw new Error("Missing MONGODB_URI environment variable");
    }

    enableMemoryStore("Missing MONGODB_URI environment variable");
    console.warn("MONGODB_URI is missing. Starting with in-memory demo data instead.");
    return false;
  }

  return true;
}

export async function connectDatabase() {
  if (isMemoryStoreEnabled()) {
    return null;
  }

  if (!hasMongoUri()) {
    return null;
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
  } catch (error) {
    if (!ENABLE_MEMORY_FALLBACK) {
      throw error;
    }

    enableMemoryStore(error.message || "MongoDB connection failed");
    console.warn(
      `MongoDB connection failed. Starting with in-memory demo data instead. (${error.message})`,
    );
    return null;
  }

  return mongoose.connection;
}

async function seedCollection(Model, documents) {
  for (const document of documents) {
    const existing = await Model.findOne({ id: document.id }).lean();
    if (!existing) {
      await Model.create(document);
    }
  }
}

export async function ensureSeedData() {
  if (isMemoryStoreEnabled()) {
    return;
  }

  if (!ENABLE_DEMO_SEED_DATA) {
    return;
  }

  await seedCollection(Cell, cells);
  await seedCollection(User, users);
  const admin = users.find((user) => user.id === "user-admin");
  if (admin) {
    await User.updateOne({ id: admin.id }, { $set: { email: admin.email } });
  }
}
