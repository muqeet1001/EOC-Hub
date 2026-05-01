import React, { useEffect, useMemo, useState } from "react";

function resolveApiBase() {
  const rawBase = import.meta.env.VITE_API_BASE || "";
  return rawBase.endsWith("/") ? rawBase.slice(0, -1) : rawBase;
}

const API_BASE = resolveApiBase();

function apiUrl(path) {
  if (!API_BASE) {
    return path;
  }

  if (path.startsWith("http")) {
    return path;
  }

  const trimmedBase = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;
  if (path === trimmedBase || path.startsWith(`${trimmedBase}/`)) {
    return path;
  }

  if (trimmedBase === "/api" && path.startsWith("/api")) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${normalizedPath}`;
}

async function requestJson(path, { method = "GET", body, isFormData = false } = {}) {
  const headers = {};

  if (body && !isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(apiUrl(path), {
    method,
    headers,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    const error = new Error(payload?.message || "Request failed");
    error.status = response.status;
    throw error;
  }

  return payload;
}

function formatWhen(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function LoadingView({ label }) {
  return (
    <div className="loading-screen">
      <div className="panel">
        <h3>{label}</h3>
        <p className="muted">Hold tight while we sync your workspace.</p>
      </div>
    </div>
  );
}

export default function App() {
  const [bootstrap, setBootstrap] = useState(null);
  const [activeView, setActiveView] = useState("compose");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(true);
  const [composeForm, setComposeForm] = useState({ title: "", description: "", cellId: "" });
  const [composeFile, setComposeFile] = useState(null);
  const [composeStatus, setComposeStatus] = useState({ error: "", success: "" });
  const [composeLoading, setComposeLoading] = useState(false);

  const user = bootstrap?.user ?? null;
  const isAdmin = user?.role === "Admin";
  const dashboard = bootstrap?.dashboard ?? {};
  const cells = bootstrap?.cells ?? [];
  const recentCirculars = dashboard.recentCirculars ?? [];

  const recipientGroup = useMemo(() => {
    if (!composeForm.cellId) {
      return null;
    }

    return (bootstrap?.membersDirectory ?? []).find((entry) => entry.id === composeForm.cellId);
  }, [bootstrap, composeForm.cellId]);

  useEffect(() => {
    const loadBootstrap = async () => {
      setLoading(true);
      setAuthError("");
      try {
        const payload = await requestJson("/api/bootstrap");
        setBootstrap(payload);
        if (!composeForm.cellId && payload.cells?.length) {
          setComposeForm((prev) => ({ ...prev, cellId: payload.cells[0].id }));
        }
      } catch (error) {
        setAuthError(error.message || "Unable to load your workspace.");
      } finally {
        setLoading(false);
      }
    };

    loadBootstrap();
  }, []);

  useEffect(() => {
    if (!composeForm.cellId && cells.length && isAdmin) {
      setComposeForm((prev) => ({ ...prev, cellId: cells[0].id }));
    }
  }, [cells, composeForm.cellId, isAdmin]);

  const handleComposeChange = (event) => {
    const { name, value } = event.target;
    setComposeForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleComposeSubmit = async (event) => {
    event.preventDefault();
    setComposeStatus({ error: "", success: "" });
    setComposeLoading(true);

    try {
      const formData = new FormData();
      formData.append("title", composeForm.title.trim());
      formData.append("description", composeForm.description.trim());
      formData.append("cellId", composeForm.cellId);
      if (composeFile) {
        formData.append("file", composeFile);
      }

      await requestJson("/api/circulars", {
        method: "POST",
        body: formData,
        isFormData: true,
      });

      const payload = await requestJson("/api/bootstrap");
      setBootstrap(payload);
      setComposeForm((prev) => ({ ...prev, title: "", description: "" }));
      setComposeFile(null);
      setComposeStatus({ error: "", success: "Circular sent and queued for delivery." });
    } catch (error) {
      setComposeStatus({ error: error.message || "Unable to send the circular.", success: "" });
    } finally {
      setComposeLoading(false);
    }
  };

  if (!bootstrap) {
    if (loading) {
      return <LoadingView label="Loading workspace" />;
    }

    return (
      <div className="loading-screen">
        <div className="panel">
          <h3>Unable to load workspace</h3>
          <p className="muted">{authError || "Please refresh and try again."}</p>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: "dashboard", label: "Dashboard" },
    { id: "circulars", label: "Circulars" },
    ...(isAdmin ? [{ id: "compose", label: "Send Circular" }] : []),
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="stack">
          <div>
            <h2>EOC Hub</h2>
            <p className="sidebar-copy">Circular distribution workspace.</p>
          </div>
          <div className="stack compact">
            <div>
              <strong>{user?.name}</strong>
              <p className="muted-dark">{user?.role}</p>
            </div>
            <div className="stack compact">
              <span className="muted">{user?.email}</span>
              <span className="muted">{user?.cellName || "All cells"}</span>
            </div>
          </div>
        </div>
        <div className="stack">
          <div className="nav-list">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`nav-btn${activeView === item.id ? " active" : ""}`}
                onClick={() => setActiveView(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </aside>
      <main className="content">
        <header className="topbar">
          <div className="topbar-copy">
            <p className="eyebrow">{user?.role}</p>
            <h1>{dashboard.heroTitle || "EOC Workspace"}</h1>
            <p className="topbar-subtext">
              {isAdmin
                ? "Coordinate circulars, meetings, and member updates across every cell."
                : "Stay on top of the latest circulars and meeting updates for your cell."}
            </p>
          </div>
          <div className="status-stack">
            <span className="pill">Last sync: {formatWhen(new Date())}</span>
            <span className="pill subtle">Ready</span>
          </div>
        </header>

        {authError ? <div className="alert">{authError}</div> : null}

        {activeView === "dashboard" ? (
          <section className="stack">
            <div className="stats-grid admin-stats">
              {(dashboard.stats || []).map((stat) => (
                <div key={stat.label} className="stat-card">
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </div>
              ))}
            </div>
            <div className="panel">
              <div className="detail-header">
                <div>
                  <h3>Recent circulars</h3>
                  <p className="muted">Latest broadcasts across your visible cells.</p>
                </div>
                <span className="pill subtle">{recentCirculars.length} items</span>
              </div>
              <div className="stack">
                {recentCirculars.length ? (
                  recentCirculars.map((circular) => (
                    <div key={circular.id} className="recipient-row">
                      <div>
                        <strong>{circular.title}</strong>
                        <p>
                          {circular.cellName} · {formatWhen(circular.createdAt)}
                        </p>
                      </div>
                      <div className="recipient-meta">
                        <span>{circular.deliverySummary?.sent ?? 0} sent</span>
                        <span>{circular.deliverySummary?.read ?? 0} read</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="muted">No circulars yet. Send the first update when ready.</p>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {activeView === "circulars" ? (
          <section className="panel stack">
            <div>
              <h3>Circular history</h3>
              <p className="muted">Track sent circulars and delivery status.</p>
            </div>
            <div className="stack">
              {(bootstrap.circulars || []).length ? (
                bootstrap.circulars.map((circular) => (
                  <div key={circular.id} className="sent-circular-card">
                    <div className="detail-header">
                      <div>
                        <h3>{circular.title}</h3>
                        <p className="muted">
                          {circular.cellName} · {formatWhen(circular.createdAt)}
                        </p>
                      </div>
                      <div className="status-stack">
                        <span className="status-chip total">
                          {circular.deliverySummary?.total ?? 0} recipients
                        </span>
                        <span className="status-chip read">
                          {circular.deliverySummary?.read ?? 0} read
                        </span>
                        <span className="status-chip unread">
                          {circular.deliverySummary?.unread ?? 0} unread
                        </span>
                      </div>
                    </div>
                    <p className="muted">{circular.description}</p>
                  </div>
                ))
              ) : (
                <p className="muted">No circulars are available for your account yet.</p>
              )}
            </div>
          </section>
        ) : null}

        {activeView === "compose" ? (
          <section className="compose-grid">
            <form className="form-card stack" onSubmit={handleComposeSubmit}>
              <div>
                <h3>Send a new circular</h3>
                <p className="muted">
                  Admin access required. Upload a PDF and broadcast it to a selected cell.
                </p>
              </div>
              {composeStatus.error ? <div className="alert">{composeStatus.error}</div> : null}
              {composeStatus.success ? (
                <div className="success-banner">{composeStatus.success}</div>
              ) : null}
              <label className="stack compact">
                <span>Circular title</span>
                <input
                  className="input"
                  name="title"
                  value={composeForm.title}
                  onChange={handleComposeChange}
                  placeholder="Enter a clear subject"
                  required
                />
              </label>
              <label className="stack compact">
                <span>Description</span>
                <textarea
                  className="input input-area"
                  name="description"
                  value={composeForm.description}
                  onChange={handleComposeChange}
                  placeholder="Provide summary details for recipients"
                  required
                />
              </label>
              <label className="stack compact">
                <span>Target cell</span>
                <select
                  className="input"
                  name="cellId"
                  value={composeForm.cellId}
                  onChange={handleComposeChange}
                  required
                >
                  {cells.map((cell) => (
                    <option key={cell.id} value={cell.id}>
                      {cell.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="file-drop">
                <span>Attach PDF (optional)</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => setComposeFile(event.target.files?.[0] ?? null)}
                />
                <strong>{composeFile?.name || "PDF attachment is optional."}</strong>
              </label>
              <button
                className="primary-btn"
                type="submit"
                disabled={composeLoading || !composeForm.cellId}
              >
                {composeLoading ? "Sending circular..." : "Send circular"}
              </button>
            </form>
            <div className="panel stack">
              <div>
                <h3>Recipient preview</h3>
                <p className="muted">
                  {recipientGroup ? recipientGroup.name : "Select a cell to preview recipients."}
                </p>
              </div>
              <div className="recipient-preview-list">
                {recipientGroup?.members?.length ? (
                  recipientGroup.members.map((member) => (
                    <div key={member.id} className="member-row">
                      <strong>{member.name}</strong>
                      <span>{member.designation || member.role}</span>
                      <span>{member.email}</span>
                    </div>
                  ))
                ) : (
                  <p className="muted">No recipients available for this cell.</p>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {!isAdmin && activeView === "dashboard" ? (
          <div className="panel">
            <h3>Admin-only action</h3>
            <p className="muted">
              Circular uploads are available only to admins. Your view stays focused on
              circulars, meetings, and notifications for your cell.
            </p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
