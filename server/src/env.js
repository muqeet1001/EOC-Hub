function normalizeEnvValue(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.trim();
}

export function readEnv(name, fallback = "") {
  return normalizeEnvValue(process.env[name], fallback);
}

export function readNumberEnv(name, fallback) {
  const rawValue = readEnv(name, String(fallback));
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readBooleanEnv(name, fallback = false) {
  const rawValue = readEnv(name);

  if (!rawValue) {
    return fallback;
  }

  if (["true", "1", "yes", "on"].includes(rawValue.toLowerCase())) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(rawValue.toLowerCase())) {
    return false;
  }

  return fallback;
}
