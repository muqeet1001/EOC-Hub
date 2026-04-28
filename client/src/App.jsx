import { useEffect, useState } from "react";

const API_BASE = "http://localhost:4000/api";
const FILE_BASE = "http://localhost:4000";
const defaultMeetingForm = {
  circularId: "",
  title: "",
  cellId: "",
  scheduledAt: "",
  meetingLink: "",
};

const demoCredentials = [
  { role: "Admin", email: "admin@eochub.test", password: "admin123" },
  { role: "OBC Cell Head", email: "salims.me@hkbk.edu.in", password: "head123" },
  { role: "OBC Cell Member", email: "dineshh.me@hkbk.edu.in", password: "member123" },
  { role: "Cell Head", email: "hod.cse@hkbk.edu.in", password: "head123" },
  { role: "Cell Member", email: "sumaiyab.mb@hkbk.edu.in", password: "member123" },
];

const landingCells = [
  {
    name: "OBC Cell",
    head: "Dr. Salim Sharieff",
    audience: "OBC students, staff, and applicants seeking fair access and support.",
    issues: "Reservation guidance, scholarship awareness, welfare access, and discrimination concerns.",
  },
  {
    name: "Population Studies Cell",
    head: "Prof. Khallikkunaisa",
    audience: "Students and faculty engaging with population awareness and social research topics.",
    issues: "Population literacy, awareness initiatives, and community-focused academic engagement.",
  },
  {
    name: "SC Cell",
    head: "Prof. Seema Shivapur",
    audience: "SC/ST students and staff needing representation, support, and grievance redressal.",
    issues: "Equity concerns, scholarship access, reservation support, and social inclusion matters.",
  },
  {
    name: "Women Cell",
    head: "Dr. Tabassum Ara",
    audience: "Women students and staff looking for guidance, welfare support, and institutional assistance.",
    issues: "Women's welfare, safety, mentoring, participation, and support for institutional concerns.",
  },
  {
    name: "Women's Study Cell",
    head: "Dr. Tabassum Ara",
    audience: "Students and faculty interested in gender awareness, policy understanding, and women's development.",
    issues: "Gender awareness, women's empowerment, research, outreach, and sensitization initiatives.",
  },
  {
    name: "International Students Cell",
    head: "Prof. Sumaiya Banu",
    audience: "International students and exchange learners adapting to academic and campus life.",
    issues: "Onboarding help, campus integration, academic assistance, and communication support.",
  },
  {
    name: "Minority Cell",
    head: "Dr. Maaz Ahmed",
    audience: "Minority students and staff who need equitable support, inclusion, and representation.",
    issues: "Minority welfare, grievance support, awareness, access to schemes, and inclusive participation.",
  },
  {
    name: "Counselling & Mentoring Cell",
    head: "Dr. Smitha Kurian",
    audience: "Students who need mentoring, emotional support, academic direction, or personal guidance.",
    issues: "Counselling, mentoring, adjustment issues, academic stress, and personal development support.",
  },
  {
    name: "Differently Abled Cell",
    head: "Dr. A Syed Mustafa",
    audience: "Persons with disabilities who require accessible infrastructure and academic accommodations.",
    issues: "Accessibility, accommodation requests, barrier-free learning, and inclusive campus support.",
  },
  {
    name: "Remedial Coaching Cell",
    head: "Dr. Chandrakumar K",
    audience: "Students needing extra academic reinforcement or structured learning support.",
    issues: "Remedial classes, foundational academic help, learning gaps, and progression support.",
  },
  {
    name: "National Service Scheme (NSS) Cell",
    head: "Dr. Salim Sharieff",
    audience: "Students interested in social service, outreach, volunteer work, and civic responsibility.",
    issues: "Volunteer coordination, service activities, outreach programs, and community participation.",
  },
  {
    name: "Prevention of Sexual Harassment (POSH) Cell",
    head: "Prof. Khallikkunaisa",
    audience: "Any student or staff member facing sexual harassment, unsafe conduct, or workplace misconduct.",
    issues: "POSH complaints, confidential reporting, awareness, and safe institutional response mechanisms.",
  },
  {
    name: "Gender Sensitization Cell",
    head: "Prof. Khallikkunaisa",
    audience: "Students and staff seeking a more respectful, inclusive, and gender-aware campus environment.",
    issues: "Gender sensitization, awareness sessions, inclusion initiatives, and respectful-campus concerns.",
  },
  {
    name: "Human Studies Cell",
    head: "Prof. Khallikkunaisa",
    audience: "Students and faculty engaging with social, ethical, and human-centered academic concerns.",
    issues: "Human values, ethics, awareness activities, and social development-focused initiatives.",
  },
];

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("eoc-token") ?? "");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [loading, setLoading] = useState(false);
  const [circularForm, setCircularForm] = useState({
    title: "",
    description: "",
    cellId: "",
    file: null,
  });
  const [meetingForm, setMeetingForm] = useState(defaultMeetingForm);

  useEffect(() => {
    if (!token) {
      return;
    }

    refreshBootstrap(token);
  }, [token]);

  async function apiFetch(path, options = {}, customToken = token) {
    const headers = {
      ...(options.headers ?? {}),
    };

    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
    }

    if (customToken) {
      headers.Authorization = `Bearer ${customToken}`;
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

  async function refreshBootstrap(currentToken = token) {
    try {
      setLoading(true);
      const bootstrap = await apiFetch("/bootstrap", {}, currentToken);
      setData(bootstrap);
      setError("");
      setSelectedBoardId((currentBoardId) => {
        if (!bootstrap.membersDirectory?.length) {
          return "";
        }

        if (
          currentBoardId &&
          bootstrap.membersDirectory.some((cell) => cell.id === currentBoardId)
        ) {
          return currentBoardId;
        }

        return "";
      });
      if (!meetingForm.cellId && bootstrap.user?.cellId) {
        setMeetingForm((form) => ({ ...form, cellId: bootstrap.user.cellId }));
      }
    } catch (requestError) {
      setError(requestError.message);
      if (requestError.message.toLowerCase().includes("token")) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    try {
      setLoading(true);
      const result = await apiFetch(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        },
        "",
      );
      localStorage.setItem("eoc-token", result.token);
      setToken(result.token);
      setData(result.bootstrap);
      setError("");
      setSelectedBoardId("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("eoc-token");
    setToken("");
    setData(null);
    setActiveTab("dashboard");
    setSelectedBoardId("");
  }

  async function handleCircularSubmit(event) {
    event.preventDefault();
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("title", circularForm.title);
      formData.append("description", circularForm.description);
      formData.append("cellId", circularForm.cellId);
      if (circularForm.file) {
        formData.append("file", circularForm.file);
      }

      await apiFetch("/circulars", {
        method: "POST",
        body: formData,
      });

      setCircularForm({ title: "", description: "", cellId: "", file: null });
      await refreshBootstrap();
      setActiveTab(canViewSentCirculars ? "sent-circulars" : "circulars");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleMeetingSubmit(event) {
    event.preventDefault();
    try {
      setLoading(true);
      await apiFetch("/meetings", {
        method: "POST",
        body: JSON.stringify(meetingForm),
      });
      setMeetingForm({
        ...defaultMeetingForm,
        cellId: data?.user?.cellId ?? "",
      });
      await refreshBootstrap();
      setActiveTab("meetings");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function markCircularRead(circularId) {
    await apiFetch(`/circulars/${circularId}/read`, { method: "PATCH" });
    await refreshBootstrap();
  }

  async function joinMeeting(meetingId) {
    await apiFetch(`/meetings/${meetingId}/join`, { method: "PATCH" });
    await refreshBootstrap();
  }

  async function generateSummary(meetingId) {
    await apiFetch(`/meetings/${meetingId}/summary`, { method: "POST" });
    await refreshBootstrap();
    setActiveTab("reports");
  }

  async function markNotificationRead(notificationId) {
    await apiFetch(`/notifications/${notificationId}/read`, { method: "PATCH" });
    await refreshBootstrap();
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

  if (!data) {
    return <LandingPage onLogin={login} loading={loading} error={error} />;
  }

  const { user, cells, circulars, meetings, reports, notifications, dashboard, membersDirectory } =
    data;
  const selectedBoard =
    membersDirectory.find((cell) => cell.id === selectedBoardId) ?? null;
  const canCreateCircular = user.role === "Admin";
  const canCreateMeeting = user.role === "Admin" || user.role === "Cell Head";
  const canViewReports = user.role === "Admin" || user.role === "Cell Head";
  const canViewSentCirculars = user.role === "Admin";

  return (
    <div className="shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Equal Opportunity Cell</p>
          <h2>EOC Hub</h2>
          <p className="sidebar-copy">{user.name}</p>
          <p className="sidebar-copy muted">
            {user.role}
            {user.cellId ? ` | ${user.cellName}` : ""}
          </p>
        </div>

        <nav className="nav-list">
          {[
            ["dashboard", "Dashboard"],
            ["circulars", "Circulars"],
            ...(canViewSentCirculars ? [["sent-circulars", "Sent Circulars"]] : []),
            ["meetings", "Meetings"],
            ["notifications", "Notifications"],
            ...(canViewReports ? [["reports", "Reports"]] : []),
            ...(canCreateCircular ? [["create-circular", "Create Circular"]] : []),
            ...(canCreateMeeting ? [["create-meeting", "Create Meeting"]] : []),
          ].map(([key, label]) => (
            <button
              key={key}
              className={activeTab === key ? "nav-btn active" : "nav-btn"}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>

        <button className="ghost-btn" onClick={logout}>
          Logout
        </button>
      </aside>

      <main className="content">
        <header className="topbar">
          <div className="topbar-copy">
            <p className="eyebrow">Dashboard</p>
            <h1>{dashboard.heroTitle}</h1>
            <p className="topbar-subtext">
              View your boards, circulars, meetings, notifications, reports, and members in one
              simple workspace.
            </p>
          </div>
          <div className="badge-row">
            <button className="topbar-logout-btn" onClick={logout}>
              Logout
            </button>
          </div>
        </header>

        {error ? <div className="alert">{error}</div> : null}

        {activeTab === "dashboard" ? (
          <section className="stack">
            <div className="stats-grid">
              {dashboard.stats.map((stat) => (
                <article key={stat.label} className="stat-card">
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </article>
              ))}
            </div>
            <section className="dashboard-section">
              <div className="section-heading-simple">
                <p className="eyebrow">Updates</p>
                <h3>Recent activity</h3>
              </div>
              <div className="panel-grid">
                <ListPanel
                  title="Recent Circulars"
                  items={dashboard.recentCirculars}
                  renderItem={(item) => (
                    <>
                      <strong>{item.title}</strong>
                      <span>{item.cellName}</span>
                    </>
                  )}
                />
                <ListPanel
                  title="Notifications"
                  items={dashboard.notifications}
                  renderItem={(item) => (
                    <>
                      <strong>{item.title}</strong>
                      <span>{item.message}</span>
                    </>
                  )}
                />
              </div>
            </section>
            {user.role === "Admin" ? (
              <section className="panel dashboard-section">
                <div className="section-heading-simple">
                  <p className="eyebrow">Board Directory</p>
                  <h3>Open a board and view all members</h3>
                </div>
                <div className="board-grid">
                  {membersDirectory.map((cell) => (
                    <button
                      key={cell.id}
                      className={
                        selectedBoard?.id === cell.id ? "board-card active" : "board-card"
                      }
                      onClick={() => setSelectedBoardId(cell.id)}
                    >
                      <p className="eyebrow">Board</p>
                      <h3>{cell.name}</h3>
                      <span className="pill subtle">{cell.members.length} members</span>
                    </button>
                  ))}
                </div>
                {selectedBoard ? (
                  <div className="board-detail">
                    <div className="detail-header">
                      <div>
                        <p className="eyebrow">Selected Board</p>
                        <h3>{selectedBoard.name}</h3>
                      </div>
                      <span className="pill">{selectedBoard.members.length} members</span>
                    </div>
                    <div className="stack compact">
                      {selectedBoard.members.length ? (
                        selectedBoard.members.map((member) => (
                          <div key={member.id} className="member-row">
                            <strong>{member.name}</strong>
                            <span>{member.role}</span>
                            <span>{member.email}</span>
                            <span>{member.phone || "No phone"}</span>
                          </div>
                        ))
                      ) : (
                        <p className="muted-dark">No members added yet.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="board-empty-state">
                    <p className="eyebrow">Select a Board</p>
                    <h3>Click any board above to view its members</h3>
                    <p className="muted-dark">
                      The member list will appear here after you choose a cell.
                    </p>
                  </div>
                )}
              </section>
            ) : null}
          </section>
        ) : null}

        {activeTab === "circulars" ? (
          <section className="stack">
            {circulars.map((circular) => (
              <article key={circular.id} className="detail-card">
                <div className="detail-header">
                  <div>
                    <p className="eyebrow">{circular.cellName}</p>
                    <h3>{circular.title}</h3>
                  </div>
                  <span className="pill subtle">{new Date(circular.createdAt).toLocaleString()}</span>
                </div>
                <p>{circular.description}</p>
                <div className="action-row">
                    {circular.fileUrl ? (
                      <button
                        className="ghost-btn link-btn"
                        onClick={() => openCircularFile(circular.id)}
                        type="button"
                      >
                        Download PDF
                      </button>
                    ) : null}
                  <button className="ghost-btn" onClick={() => markCircularRead(circular.id)}>
                    Mark as Read
                  </button>
                  <button className="primary-btn" onClick={() => setActiveTab("meetings")}>
                    Join Meeting
                  </button>
                </div>
              </article>
            ))}
          </section>
        ) : null}

        {activeTab === "sent-circulars" && canViewSentCirculars ? (
            <section className="stack">
              <div className="section-heading-simple">
                <p className="eyebrow">Admin Tracking</p>
                <h3>Sent circulars and cell head status</h3>
              </div>
              {circulars.map((circular) => (
                <article key={circular.id} className="detail-card">
                <div className="detail-header">
                  <div>
                    <p className="eyebrow">{circular.cellName}</p>
                    <h3>{circular.title}</h3>
                  </div>
                  <span className="pill subtle">
                    {new Date(circular.createdAt).toLocaleString()}
                  </span>
                  </div>
                  <p>{circular.description}</p>
                  {circular.headRecipient ? (
                    <div className="stack compact">
                      <div className="recipient-row">
                        <div>
                          <strong>{circular.headRecipient.name}</strong>
                          <p>{circular.headRecipient.email}</p>
                        </div>
                        <div className="recipient-meta">
                          <span>Cell Head</span>
                          <span
                            className={
                              circular.headStatus.read ? "status-chip read" : "status-chip unread"
                            }
                          >
                            {circular.headStatus.read ? "Read" : "Unread"}
                          </span>
                          <span>
                            {circular.headStatus.readAt
                              ? `Read at ${new Date(circular.headStatus.readAt).toLocaleString()}`
                              : "Not opened yet"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="muted-dark">No cell head is assigned for this cell yet.</p>
                  )}
                </article>
              ))}
            </section>
        ) : null}

        {activeTab === "meetings" ? (
          <section className="stack">
            {meetings.map((meeting) => (
              <article key={meeting.id} className="detail-card">
                <div className="detail-header">
                  <div>
                    <p className="eyebrow">{meeting.cellName}</p>
                    <h3>{meeting.title}</h3>
                  </div>
                  <span className="pill subtle">{meeting.status}</span>
                </div>
                <p>{new Date(meeting.scheduledAt).toLocaleString()}</p>
                <div className="action-row">
                  <a
                    className="primary-btn link-btn"
                    href={meeting.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Meeting Link
                  </a>
                  <button className="ghost-btn" onClick={() => joinMeeting(meeting.id)}>
                    Join Meeting
                  </button>
                  {canViewReports ? (
                    <button className="ghost-btn" onClick={() => generateSummary(meeting.id)}>
                      Generate AI Summary
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </section>
        ) : null}

        {activeTab === "notifications" ? (
          <section className="stack">
            {notifications.map((notification) => (
              <article key={notification.id} className="list-card">
                <div>
                  <strong>{notification.title}</strong>
                  <p>{notification.message}</p>
                </div>
                <button
                  className="ghost-btn"
                  onClick={() => markNotificationRead(notification.id)}
                  disabled={notification.read}
                >
                  {notification.read ? "Read" : "Mark Read"}
                </button>
              </article>
            ))}
          </section>
        ) : null}

        {activeTab === "reports" && canViewReports ? (
          <section className="stack">
            {reports.map((report) => (
              <article key={report.id} className="detail-card">
                <div className="detail-header">
                  <div>
                    <p className="eyebrow">{report.cellName}</p>
                    <h3>Minutes of Meeting</h3>
                  </div>
                  <span className="pill subtle">{new Date(report.createdAt).toLocaleString()}</span>
                </div>
                <SummaryBlock title="Key Points" items={report.summary.keyPoints} />
                <SummaryBlock title="Decisions" items={report.summary.decisions} />
                <SummaryBlock title="Action Items" items={report.summary.actionItems} />
              </article>
            ))}
          </section>
        ) : null}

        {activeTab === "create-circular" && canCreateCircular ? (
          <section className="form-card">
            <h3>Create Circular</h3>
            <form className="stack" onSubmit={handleCircularSubmit}>
              <input
                className="input"
                placeholder="Title"
                value={circularForm.title}
                onChange={(event) =>
                  setCircularForm((form) => ({ ...form, title: event.target.value }))
                }
                required
              />
              <textarea
                className="input input-area"
                placeholder="Description"
                value={circularForm.description}
                onChange={(event) =>
                  setCircularForm((form) => ({ ...form, description: event.target.value }))
                }
                required
              />
              <select
                className="input"
                value={circularForm.cellId}
                onChange={(event) =>
                  setCircularForm((form) => ({ ...form, cellId: event.target.value }))
                }
                required
              >
                <option value="">Select Cell</option>
                {cells.map((cell) => (
                  <option key={cell.id} value={cell.id}>
                    {cell.name}
                  </option>
                ))}
              </select>
              <input
                className="input"
                type="file"
                accept=".pdf"
                onChange={(event) =>
                  setCircularForm((form) => ({ ...form, file: event.target.files?.[0] ?? null }))
                }
              />
              <button className="primary-btn" disabled={loading}>
                Send Circular
              </button>
            </form>
          </section>
        ) : null}

        {activeTab === "create-meeting" && canCreateMeeting ? (
          <section className="form-card">
            <h3>Schedule Meeting</h3>
            <form className="stack" onSubmit={handleMeetingSubmit}>
              <input
                className="input"
                placeholder="Meeting title"
                value={meetingForm.title}
                onChange={(event) =>
                  setMeetingForm((form) => ({ ...form, title: event.target.value }))
                }
                required
              />
              <select
                className="input"
                value={meetingForm.cellId}
                onChange={(event) =>
                  setMeetingForm((form) => ({ ...form, cellId: event.target.value }))
                }
                required
              >
                <option value="">Select Cell</option>
                {cells.map((cell) => (
                  <option key={cell.id} value={cell.id}>
                    {cell.name}
                  </option>
                ))}
              </select>
              <select
                className="input"
                value={meetingForm.circularId}
                onChange={(event) =>
                  setMeetingForm((form) => ({ ...form, circularId: event.target.value }))
                }
              >
                <option value="">Related Circular (optional)</option>
                {circulars
                  .filter((circular) => !meetingForm.cellId || circular.cellId === meetingForm.cellId)
                  .map((circular) => (
                    <option key={circular.id} value={circular.id}>
                      {circular.title}
                    </option>
                  ))}
              </select>
              <input
                className="input"
                type="datetime-local"
                value={meetingForm.scheduledAt}
                onChange={(event) =>
                  setMeetingForm((form) => ({ ...form, scheduledAt: event.target.value }))
                }
                required
              />
              <input
                className="input"
                placeholder="Google Meet / Zoom link"
                value={meetingForm.meetingLink}
                onChange={(event) =>
                  setMeetingForm((form) => ({ ...form, meetingLink: event.target.value }))
                }
                required
              />
              <button className="primary-btn" disabled={loading}>
                Notify Members
              </button>
            </form>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function LoginForm({ onSubmit, loading }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
      <form
        className="stack login-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(email, password);
        }}
      >
        <label className="input-label login-input-group">
          <span>Official Email</span>
          <input
            className="input"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="input-label login-input-group">
          <span>Password</span>
          <input
            className="input"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button className="primary-btn login-submit-btn" disabled={loading}>
          {loading ? "Signing In..." : "Login to Portal"}
        </button>
      </form>
    );
  }

function LandingPage({ onLogin, loading, error }) {
  const [highlightLogin, setHighlightLogin] = useState(false);

  function focusLogin() {
    setHighlightLogin(true);
    const loginSection = document.getElementById("portal");
    loginSection?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setHighlightLogin(false), 1800);
  }

  return (
    <div className="landing-shell">
      <nav className="landing-nav">
        <div className="landing-brand">
          <span className="landing-brand-mark">E</span>
          <span>EOC Connect</span>
        </div>
        <div className="landing-nav-links">
          <a href="#about">About</a>
          <a href="#features">Features</a>
          <a href="#portal">Portal</a>
        </div>
        <button
          className="landing-outline-btn"
          onClick={focusLogin}
        >
          Login
        </button>
      </nav>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <p className="eyebrow">Official Equal Opportunity Cell Website</p>
            <h1>
              Login to
              <span> EOC Connect</span>
              and enter the portal quickly.
            </h1>
            <p className="landing-lead">
              This website is the central place for Equal Opportunity Cell communication. Users can
              sign in with their assigned account to view circulars, meetings, notifications,
              reports, and board information based on their role.
            </p>
            <div className="landing-cta-row">
              <button
                className="landing-primary-btn"
                onClick={focusLogin}
              >
                Login Now
              </button>
              <a className="landing-text-link" href="#about">
                Learn About the Portal
              </a>
            </div>
            <div className="landing-highlights">
              <div className="highlight-chip">Direct login access</div>
              <div className="highlight-chip">Role-based dashboard</div>
              <div className="highlight-chip">Circulars and notifications</div>
            </div>
            <div className="landing-hero-metadata">
              <article className="hero-meta-card">
                <strong>Who Uses It</strong>
                <p>Chairman, cell heads, faculty members, staff, and student representatives.</p>
              </article>
              <article className="hero-meta-card">
                <strong>Why It Exists</strong>
                <p>To manage official circulars, cell communication, meetings, and reports in one place.</p>
              </article>
              <article className="hero-meta-card">
                <strong>What Happens After Login</strong>
                <p>You see only the data and actions that belong to your role and cell access.</p>
              </article>
            </div>
          </div>

          <div className="landing-hero-panel">
            <div
              className={highlightLogin ? "hero-portal-card login-highlight login-priority-card" : "hero-portal-card login-priority-card"}
              id="portal"
            >
              <p className="eyebrow">Portal Login</p>
              <h3>Sign in to continue</h3>
              <p>
                Use your assigned email and password to enter the EOC portal.
              </p>
              <div className="landing-login-notes">
                <div className="landing-login-note">
                  <strong>Step 1</strong>
                  <span>Enter your official email</span>
                </div>
                <div className="landing-login-note">
                  <strong>Step 2</strong>
                  <span>Enter your password</span>
                </div>
                <div className="landing-login-note">
                  <strong>Step 3</strong>
                  <span>Open your dashboard</span>
                </div>
              </div>
              <LoginForm onSubmit={onLogin} loading={loading} />
              {error ? <p className="error-text">{error}</p> : null}
              <div className="landing-login-footer">
                <span>Need access help?</span>
                <p>Contact the chairman or your cell head for account support.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-summary-grid simple" id="about">
          <article className="summary-card">
            <h3>About the Website</h3>
            <p>
              This is the official website and portal for the Equal Opportunity Cell.
            </p>
          </article>
          <article className="summary-card accent">
            <h3>Who Can Use It</h3>
            <p>
              Students, faculty, staff, board heads, and admin users can all use the platform.
            </p>
          </article>
          <article className="summary-card dark">
            <h3>What You Can Do</h3>
            <p>
              After login, users can check circulars, meetings, notifications, reports, and member
              details based on their role.
            </p>
          </article>
        </section>

        <section className="landing-panel" id="features">
          <div className="section-heading">
            <p className="eyebrow">Main Features</p>
            <h2>What the portal gives you</h2>
            <p>
              The website is mainly for understanding the platform and quickly entering the working
              EOC portal.
            </p>
          </div>
          <div className="quick-help-grid simple">
            <article className="quick-help-card">
              <h3>Login Access</h3>
              <p>Enter the portal directly from the landing page.</p>
            </article>
            <article className="quick-help-card">
              <h3>Role-Based Use</h3>
              <p>Admin, cell heads, and members each get the correct view.</p>
            </article>
            <article className="quick-help-card">
              <h3>Board Management</h3>
              <p>Chairman can view all boards and open member details board by board.</p>
            </article>
            <article className="quick-help-card">
              <h3>Meetings & Reports</h3>
              <p>Track circulars, meetings, AI summaries, and reports from one portal.</p>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}

function ListPanel({ title, items, renderItem }) {
  return (
    <section className="panel">
      <div className="detail-header">
        <h3>{title}</h3>
      </div>
      <div className="stack compact">
        {items.length ? (
          items.map((item) => (
            <article key={item.id} className="list-card">
              {renderItem(item)}
            </article>
          ))
        ) : (
          <p className="muted-dark">No items yet.</p>
        )}
      </div>
    </section>
  );
}

function SummaryBlock({ title, items }) {
  return (
    <div className="summary-block">
      <h4>{title}</h4>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;
