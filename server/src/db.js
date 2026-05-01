import mongoose from "mongoose";
import { cells, users } from "./data.js";
import { Cell, Circular, Meeting, Notification, Report, User } from "./models.js";

const MONGODB_URI = process.env.MONGODB_URI;

function requireMongoUri() {
  if (!MONGODB_URI) {
    throw new Error("Missing MONGODB_URI environment variable");
  }
}

export async function connectDatabase() {
  requireMongoUri();

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });

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
  await seedCollection(Cell, cells);
  await seedCollection(User, users);
  const admin = users.find((user) => user.id === "user-admin");
  if (admin) {
    await User.updateOne({ id: admin.id }, { $set: { email: admin.email } });
  }
}
