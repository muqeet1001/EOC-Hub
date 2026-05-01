import { cells, circulars, meetings, notifications, reports, users } from "./data.js";

function cloneValue(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function createCollections() {
  return {
    Cell: cloneValue(cells),
    User: cloneValue(users),
    Circular: cloneValue(circulars),
    Meeting: cloneValue(meetings),
    Report: cloneValue(reports),
    Notification: cloneValue(notifications),
  };
}

let memoryStoreEnabled = false;
let memoryStoreReason = "";
let collections = createCollections();

function normalizeComparable(value) {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string") {
    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) {
      return timestamp;
    }
  }

  return value;
}

function matchesFilter(document, filter = {}) {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = document[key];

    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      if ("$in" in expected) {
        return expected.$in.includes(actual);
      }

      if ("$ne" in expected) {
        return actual !== expected.$ne;
      }
    }

    return actual === expected;
  });
}

function sortDocuments(documents, sortSpec) {
  if (!sortSpec) {
    return documents;
  }

  const [field, direction = 1] = Object.entries(sortSpec)[0] ?? [];

  if (!field) {
    return documents;
  }

  return [...documents].sort((left, right) => {
    const leftValue = normalizeComparable(left[field]);
    const rightValue = normalizeComparable(right[field]);

    if (leftValue === rightValue) {
      return 0;
    }

    if (leftValue == null) {
      return direction >= 0 ? -1 : 1;
    }

    if (rightValue == null) {
      return direction >= 0 ? 1 : -1;
    }

    return leftValue > rightValue ? direction : -direction;
  });
}

function stripPrivateFields(document) {
  const plainDocument = {};

  for (const [key, value] of Object.entries(document ?? {})) {
    if (!key.startsWith("_")) {
      plainDocument[key] = value;
    }
  }

  return plainDocument;
}

class MemoryDocument {
  constructor(model, data) {
    Object.defineProperty(this, "_model", {
      value: model,
      enumerable: false,
      writable: false,
    });

    Object.assign(this, cloneValue(data));
  }

  toObject() {
    return cloneValue(stripPrivateFields(this));
  }

  async save() {
    this._model._saveDocument(this.toObject());
    return this;
  }
}

class MemoryQuery {
  constructor(model, filter = {}, single = false) {
    this.model = model;
    this.filter = filter;
    this.single = single;
    this.sortSpec = null;
    this.asLean = false;
  }

  sort(sortSpec) {
    this.sortSpec = sortSpec;
    return this;
  }

  lean() {
    this.asLean = true;
    return this.exec();
  }

  async exec() {
    const matched = sortDocuments(this.model._findDocuments(this.filter), this.sortSpec);

    if (this.single) {
      const document = matched[0] ?? null;
      if (!document) {
        return null;
      }

      return this.asLean ? cloneValue(document) : new MemoryDocument(this.model, document);
    }

    return this.asLean
      ? matched.map((document) => cloneValue(document))
      : matched.map((document) => new MemoryDocument(this.model, document));
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }

  finally(onFinally) {
    return this.exec().finally(onFinally);
  }
}

class MemoryModel {
  constructor(name) {
    this.name = name;
  }

  _getCollection() {
    return collections[this.name];
  }

  _findDocuments(filter = {}) {
    return this._getCollection().filter((document) => matchesFilter(document, filter));
  }

  _saveDocument(nextDocument) {
    const collection = this._getCollection();
    const index = collection.findIndex((document) => document.id === nextDocument.id);

    if (index >= 0) {
      collection[index] = cloneValue(nextDocument);
      return;
    }

    collection.push(cloneValue(nextDocument));
  }

  find(filter = {}) {
    return new MemoryQuery(this, filter, false);
  }

  findOne(filter = {}) {
    return new MemoryQuery(this, filter, true);
  }

  async create(payload) {
    const nextDocument = cloneValue(payload);
    this._getCollection().push(nextDocument);
    return new MemoryDocument(this, nextDocument);
  }

  async insertMany(payloads) {
    payloads.forEach((payload) => {
      this._getCollection().push(cloneValue(payload));
    });

    return payloads.map((payload) => new MemoryDocument(this, payload));
  }

  async updateOne(filter = {}, update = {}) {
    const document = this._findDocuments(filter)[0];

    if (!document) {
      return { matchedCount: 0, modifiedCount: 0 };
    }

    if (update.$set) {
      Object.assign(document, cloneValue(update.$set));
    }

    this._saveDocument(document);
    return { matchedCount: 1, modifiedCount: 1 };
  }

  async countDocuments(filter = {}) {
    return this._findDocuments(filter).length;
  }
}

export function enableMemoryStore(reason = "MongoDB unavailable") {
  if (!memoryStoreEnabled) {
    collections = createCollections();
  }

  memoryStoreEnabled = true;
  memoryStoreReason = reason;
}

export function isMemoryStoreEnabled() {
  return memoryStoreEnabled;
}

export function getMemoryStoreReason() {
  return memoryStoreReason;
}

export function createModelProxy(name, mongooseModel) {
  const memoryModel = new MemoryModel(name);

  return {
    find(filter = {}) {
      return isMemoryStoreEnabled() ? memoryModel.find(filter) : mongooseModel.find(filter);
    },
    findOne(filter = {}) {
      return isMemoryStoreEnabled() ? memoryModel.findOne(filter) : mongooseModel.findOne(filter);
    },
    async create(payload) {
      return isMemoryStoreEnabled() ? memoryModel.create(payload) : mongooseModel.create(payload);
    },
    async insertMany(payloads) {
      return isMemoryStoreEnabled()
        ? memoryModel.insertMany(payloads)
        : mongooseModel.insertMany(payloads);
    },
    async updateOne(filter = {}, update = {}) {
      return isMemoryStoreEnabled()
        ? memoryModel.updateOne(filter, update)
        : mongooseModel.updateOne(filter, update);
    },
    async countDocuments(filter = {}) {
      return isMemoryStoreEnabled()
        ? memoryModel.countDocuments(filter)
        : mongooseModel.countDocuments(filter);
    },
    _saveDocument(document) {
      return memoryModel._saveDocument(document);
    },
    _findDocuments(filter = {}) {
      return memoryModel._findDocuments(filter);
    },
  };
}
