import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://localhost:4000/api";

const emptyCircularForm = {
  title: "",
  description: "",
  cellId: "",
  file: null,
};

function App() {
  const [data, setData] = useState(null);
  const [activeView, setActiveView] = useState("compose");
  const [selectedCellId, setSelectedCellId] = useState("");
  const [memberTab, setMemberTab] = useState("all");
  const [circularForm, setCircularForm] = useState(emptyCircularForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);

  useEffect(() => {
    refreshBootstrap();
  }, []);

  useEffect(() => {
    if (!data?.cells?.length || selectedCellId) {
      return;
    }

    const firstCellId = data.cells[0].id;
    setSelectedCellId(firstCellId);
    setCircularForm((form) => ({ ...form, cellId: firstCellId }));
  }, [data, selectedCellId]);

  async function apiFetch(path, options = {}) {
    const headers = {
      ...(options.headers ?? {}),
    };

    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || "Request failed");
    }

    return payload;
  }

  async function refreshBootstrap() {
    try {
      setLoading(true);
      const bootstrap = await apiFetch("/bootstrap");
      setData(bootstrap);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function chooseCell(cellId) {
    setSelectedCellId(cellId);
    setCircularForm((form) => ({ ...form, cellId }));
  }

  function openMembersTab(tabId) {
    setMemberTab(tabId);
    if (tabId !== "all") {
      chooseCell(tabId);
    }
    setActiveView("cells");
  }

  async function handleCircularSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("title", circularForm.title.trim());
      formData.append("description", circularForm.description.trim());
      formData.append("cellId", circularForm.cellId || selectedCellId);
      if (circularForm.file) {
        formData.append("file", circularForm.file);
      }

      const circular = await apiFetch("/circulars", {
        method: "POST",
        body: formData,
      });

      setCircularForm({ ...emptyCircularForm, cellId: selectedCellId });
      setFileInputKey((key) => key + 1);
      setSuccess(buildSendMessage(circular));
      await refreshBootstrap();
      setActiveView("sent");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function openCircularFile(circularId) {
    try {
      setLoading(true);
      const response = await apiFetch(`/circulars/${circularId}/file`);
      if (response?.url) {
        window.open(response.url, "_blank", "noopener,noreferrer");
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  const membersDirectory = data?.membersDirectory ?? [];
  const cells = data?.cells ?? [];
  const circulars = data?.circulars ?? [];
  const selectedCell = useMemo(
    () => membersDirectory.find((cell) => cell.id === selectedCellId) ?? null,
    [membersDirectory, selectedCellId],
  );
  const selectedMembers = selectedCell?.members ?? [];
  const selectedEmails = selectedMembers.filter((member) => Boolean(member.email));
  const stats = [
    { label: "Cells", value: cells.length },
    { label: "Members", value: membersDirectory.reduce((sum, cell) => sum + cell.members.length, 0) },
    { label: "Circulars Sent", value: circulars.length },
    { label: "Selected Emails", value: selectedEmails.length },
  ];

  return (
    <div className="shell admin-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Admin Workspace</p>
          <h2>EOC Circular Desk</h2>
          <p className="sidebar-copy">No login required</p>
          <p className="sidebar-copy muted">Upload circulars and email selected cells.</p>
        </div>

        <nav className="nav-list">
          {[
            ["compose", "Send Circular"],
            ["cells", "Cell Members"],
            ["sent", "Sent Circulars"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={activeView === key ? "nav-btn active" : "nav-btn"}
              onClick={() => setActiveView(key)}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>

        <button className="ghost-btn" onClick={refreshBootstrap} disabled={loading} type="button">
          {loading ? "Refreshing..." : "Refresh Data"}
        </button>
      </aside>

      <main className="content">
        <header className="topbar">
          <div className="topbar-copy">
            <p className="eyebrow">Circular Distribution</p>
            <h1>Send one circular to every member in a selected cell</h1>
            <p className="topbar-subtext">
              Pick a cell, attach the circular PDF, and the system will create the record and email
              each member address listed under that cell.
            </p>
          </div>
          <div className="status-stack">
            <span className="pill">Admin Mode</span>
            <span className="pill subtle">No Auth</span>
          </div>
        </header>

        {error ? <div className="alert">{error}</div> : null}
        {success ? <div className="success-banner">{success}</div> : null}

        <section className="stats-grid admin-stats">
          {stats.map((stat) => (
            <article key={stat.label} className="stat-card">
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </article>
          ))}
        </section>

        {activeView === "compose" ? (
          <section className="compose-grid">
            <CellSelector
              cells={membersDirectory}
              selectedCellId={selectedCellId}
              onSelect={chooseCell}
              onOpenMembers={openMembersTab}
            />

            <section className="form-card">
              <div className="detail-header">
                <div>
                  <p className="eyebrow">New Circular</p>
                  <h3>Upload and send</h3>
                </div>
                <span className="pill subtle">
                  {selectedCell ? `${selectedEmails.length} emails` : "Select a cell"}
                </span>
              </div>

              <form className="stack" onSubmit={handleCircularSubmit}>
                <input
                  className="input"
                  placeholder="Circular title"
                  value={circularForm.title}
                  onChange={(event) =>
                    setCircularForm((form) => ({ ...form, title: event.target.value }))
                  }
                  required
                />
                <textarea
                  className="input input-area"
                  placeholder="Short message for the email"
                  value={circularForm.description}
                  onChange={(event) =>
                    setCircularForm((form) => ({ ...form, description: event.target.value }))
                  }
                  required
                />
                <select
                  className="input"
                  value={circularForm.cellId || selectedCellId}
                  onChange={(event) => chooseCell(event.target.value)}
                  required
                >
                  <option value="">Select Cell</option>
                  {cells.map((cell) => (
                    <option key={cell.id} value={cell.id}>
                      {cell.name}
                    </option>
                  ))}
                </select>
                <label className="file-drop">
                  <span>Upload circular PDF</span>
                  <input
                    key={fileInputKey}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(event) =>
                      setCircularForm((form) => ({
                        ...form,
                        file: event.target.files?.[0] ?? null,
                      }))
                    }
                  />
                  <strong>{circularForm.file?.name ?? "Choose a PDF file"}</strong>
                </label>
                <button className="primary-btn" disabled={loading || !selectedCellId}>
                  {loading ? "Sending..." : "Send to Cell Members"}
                </button>
              </form>
            </section>

            <RecipientPreview selectedCell={selectedCell} members={selectedMembers} />
          </section>
        ) : null}

        {activeView === "cells" ? (
          <CellMembersTabs
            cells={membersDirectory}
            activeTab={memberTab}
            onTabChange={openMembersTab}
          />
        ) : null}

        {activeView === "sent" ? (
          <SentCirculars circulars={circulars} onOpenFile={openCircularFile} />
        ) : null}
      </main>
    </div>
  );
}

function CellSelector({ cells, selectedCellId, onSelect, onOpenMembers }) {
  return (
    <section className="panel cell-selector">
      <div className="section-heading-simple">
        <p className="eyebrow">Step 1</p>
        <h3>Choose cell</h3>
      </div>
      <button className="all-cells-btn" onClick={() => onOpenMembers("all")} type="button">
        View All Cells
      </button>
      <div className="cell-picker-list">
        {cells.map((cell) => (
          <div key={cell.id} className={selectedCellId === cell.id ? "cell-picker active" : "cell-picker"}>
            <button onClick={() => onSelect(cell.id)} type="button">
              <span>{cell.name}</span>
              <strong>{cell.members.length}</strong>
            </button>
            <button className="mini-link-btn" onClick={() => onOpenMembers(cell.id)} type="button">
              Members
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function CellMembersTabs({ cells, activeTab, onTabChange }) {
  const totalMembers = cells.reduce((sum, cell) => sum + cell.members.length, 0);
  const activeCell = cells.find((cell) => cell.id === activeTab) ?? null;

  return (
    <section className="panel members-workspace">
      <div className="detail-header">
        <div>
          <p className="eyebrow">Cell Members</p>
          <h3>{activeCell ? activeCell.name : "All Cells"}</h3>
        </div>
        <span className="pill">{activeCell ? activeCell.members.length : totalMembers} members</span>
      </div>

      <div className="member-tabs" role="tablist" aria-label="Cell member tabs">
        <button
          className={activeTab === "all" ? "member-tab active" : "member-tab"}
          onClick={() => onTabChange("all")}
          type="button"
          role="tab"
        >
          All Cells
        </button>
        {cells.map((cell) => (
          <button
            key={cell.id}
            className={activeTab === cell.id ? "member-tab active" : "member-tab"}
            onClick={() => onTabChange(cell.id)}
            type="button"
            role="tab"
          >
            {cell.name}
          </button>
        ))}
      </div>

      {activeCell ? (
        <MemberTable members={activeCell.members} />
      ) : (
        <div className="all-cells-grid">
          {cells.map((cell) => (
            <article key={cell.id} className="cell-members-card">
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Cell</p>
                  <h3>{cell.name}</h3>
                </div>
                <button className="ghost-btn" onClick={() => onTabChange(cell.id)} type="button">
                  Open
                </button>
              </div>
              <MemberTable members={cell.members.slice(0, 4)} compact />
              {cell.members.length > 4 ? (
                <p className="muted-dark">{cell.members.length - 4} more members</p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function MemberTable({ members, compact = false }) {
  if (!members.length) {
    return <p className="muted-dark">No members are added yet.</p>;
  }

  return (
    <div className={compact ? "member-table compact-table" : "member-table"}>
      <div className="member-table-head">
        <span>Name</span>
        <span>Role</span>
        <span>Email</span>
        {!compact ? <span>Phone</span> : null}
      </div>
      {members.map((member) => (
        <article key={member.id} className="member-table-row">
          <strong>{member.name}</strong>
          <span>{member.designation || member.role}</span>
          <span>{member.email || "No email address"}</span>
          {!compact ? <span>{member.phone || "No phone"}</span> : null}
        </article>
      ))}
    </div>
  );
}

function RecipientPreview({ selectedCell, members }) {
  if (!selectedCell) {
    return (
      <section className="panel">
        <p className="eyebrow">Recipients</p>
        <h3>Select a cell first</h3>
        <p className="muted-dark">The member email preview will appear here.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="detail-header">
        <div>
          <p className="eyebrow">Recipients</p>
          <h3>{selectedCell.name}</h3>
        </div>
        <span className="pill">{members.length} members</span>
      </div>
      <div className="recipient-preview-list">
        {members.length ? (
          members.map((member) => (
            <article key={member.id} className="member-row recipient-preview-row">
              <strong>{member.name}</strong>
              <span>{member.designation || member.role}</span>
              <span>{member.email || "No email address"}</span>
            </article>
          ))
        ) : (
          <p className="muted-dark">No members are added to this cell yet.</p>
        )}
      </div>
    </section>
  );
}

function SentCirculars({ circulars, onOpenFile }) {
  return (
    <section className="stack">
      <div className="section-heading-simple">
        <p className="eyebrow">Delivery History</p>
        <h3>Sent circulars and email status</h3>
      </div>
      {circulars.length ? (
        circulars.map((circular) => (
          <article key={circular.id} className="detail-card sent-circular-card">
            <div className="detail-header">
              <div>
                <p className="eyebrow">{circular.cellName}</p>
                <h3>{circular.title}</h3>
              </div>
              <span className="pill subtle">{new Date(circular.createdAt).toLocaleString()}</span>
            </div>
            <p>{circular.description}</p>
            <div className="delivery-summary-row">
              <span className="status-chip total">
                {circular.deliverySummary?.total ?? circular.recipients?.length ?? 0} recipients
              </span>
              <span className="status-chip read">
                {circular.deliverySummary?.sent ?? 0} sent
              </span>
              <span className="status-chip unread">
                {circular.deliverySummary?.failed ?? 0} failed
              </span>
              <span className="status-chip muted-status">
                {circular.deliverySummary?.notConfigured ?? 0} not configured
              </span>
            </div>
            {circular.fileUrl ? (
              <button className="ghost-btn link-btn" onClick={() => onOpenFile(circular.id)}>
                Open Uploaded PDF
              </button>
            ) : null}
            <div className="email-status-grid">
              {(circular.recipients ?? []).map((recipient) => (
                <article key={recipient.id} className="recipient-row">
                  <div>
                    <strong>{recipient.name}</strong>
                    <p>{recipient.email}</p>
                  </div>
                  <div className="recipient-meta">
                    <span>{recipient.designation || recipient.role}</span>
                    <span className={`status-chip ${statusClass(recipient.emailStatus)}`}>
                      {formatEmailStatus(recipient.emailStatus)}
                    </span>
                    <span>
                      {recipient.emailedAt
                        ? new Date(recipient.emailedAt).toLocaleString()
                        : recipient.emailError || "Waiting for SMTP"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </article>
        ))
      ) : (
        <section className="panel">
          <p className="muted-dark">No circulars have been sent yet.</p>
        </section>
      )}
    </section>
  );
}

function statusClass(status) {
  if (status === "sent") {
    return "read";
  }

  if (status === "failed" || status === "skipped") {
    return "unread";
  }

  return "muted-status";
}

function formatEmailStatus(status) {
  if (!status) {
    return "Pending";
  }

  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildSendMessage(circular) {
  const summary = circular.deliverySummary;
  if (!summary) {
    return "Circular created and member emails were processed.";
  }

  if (summary.sent > 0) {
    return `Circular sent to ${summary.sent} member email${summary.sent === 1 ? "" : "s"}.`;
  }

  if (summary.notConfigured > 0) {
    return "Circular saved. SMTP is not configured yet, so emails were recorded as not configured.";
  }

  return "Circular saved. Check delivery history for each recipient status.";
}

export default App;
