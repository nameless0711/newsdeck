import React, { useEffect, useState, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Radio,
  Tags,
  Bookmark,
  FileText,
  Activity,
  Settings,
  Search,
  Plus,
  ArrowUpRight,
  ChevronRight,
  Sun,
  Moon,
  LogOut,
  X,
  RefreshCw,
  Download,
  Upload,
  Trash2,
  Pencil,
  Check,
  SlidersHorizontal,
  Menu,
  Bell,
  ArrowLeft,
  Folder,
} from "lucide-react";
import "./style.css";
type Row = Record<string, any>;
type SourceFolder = { id: string; name: string; source_count: number };
type Navigation = { page: string; topic: string; folder: string };
const unfiled = "unfiled";
const feedPages = ["dashboard", "favorites", "topic"];
const folderPages = [...feedPages, "sources"];
const pages = [...folderPages, "topics", "jobs", "briefings", "settings"];

function readNavigation(): Navigation {
  const params = new URLSearchParams(window.location.search);
  const page = params.get("view") || "dashboard";
  return {
    page: pages.includes(page) ? page : "dashboard",
    topic: feedPages.includes(page) ? params.get("topic") || "" : "",
    folder: folderPages.includes(page) ? params.get("folder") || "" : "",
  };
}

function writeNavigation(navigation: Navigation, replace = false) {
  const url = new URL(window.location.href);
  const params = { view: navigation.page === "dashboard" ? "" : navigation.page,
    topic: navigation.topic, folder: navigation.folder };
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  if (url.href !== window.location.href) {
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
  }
}

function sourcesInFolder(sources: Row[], folder: string) {
  if (!folder) return sources;
  return sources.filter((source) => folder === unfiled ? !source.folder_id : source.folder_id === folder);
}
function ArticleImage({ article, detail = false }: { article: Row; detail?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!article.image_url || failed) return null;
  return (
    <img
      className={detail ? "article-preview detail-preview" : "article-preview"}
      src={`/api/articles/${encodeURIComponent(article.id)}/image`}
      alt=""
      loading={detail ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
async function api(path: string, method = "GET", body?: any) {
  const r = await fetch("/api" + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Anfrage fehlgeschlagen");
  return data;
}
const fmt = (s: string | null, timeZone?: string) =>
  s
    ? new Date(s).toLocaleString("de-DE", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone,
      })
    : "Noch nicht";
const dateLabel = (s: string | null) =>
  s
    ? new Date(s).toLocaleDateString("de-DE", {
        day: "numeric",
        month: "short",
      })
    : "Datum unbekannt";
function App() {
  const [navigation, setNavigation] = useState(readNavigation);
  const { page, topic, folder } = navigation;
  const loadSequence = useRef(0);
  const [user, setUser] = useState<Row | null>(null),
    [checking, setChecking] = useState(true),
    [topics, setTopics] = useState<Row[]>([]),
    [sources, setSources] = useState<Row[]>([]),
    [folders, setFolders] = useState<SourceFolder[]>([]),
    [selectedSources, setSelectedSources] = useState<string[]>([]),
    [moveDestination, setMoveDestination] = useState(""),
    [status, setStatus] = useState<Row>({}),
    [articles, setArticles] = useState<Row[]>([]),
    [total, setTotal] = useState(0),
    [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("latest"),
    [source, setSource] = useState(""),
    [type, setType] = useState(""),
    [min, setMin] = useState("1"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [pagination, setPagination] = useState(1),
    [filters, setFilters] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [modal, setModal] = useState<{ kind: string; data: Row } | null>(null),
    [detail, setDetail] = useState<Row | null>(null),
    [jobs, setJobs] = useState<Row[]>([]),
    [briefings, setBriefings] = useState<Row[]>([]),
    [rules, setRules] = useState<Row[]>([]),
    [notifications, setNotifications] = useState<Row[]>([]),
    [users, setUsers] = useState<Row[]>([]),
    [mobile, setMobile] = useState(false),
    [dark, setDark] = useState(
      localStorage.getItem("newsdeck-theme") === "dark",
    );
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("newsdeck-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    api("/me")
      .then(setUser)
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q);
      setPagination(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const restore = () => {
      loadSequence.current++;
      setNavigation(readNavigation());
      setPagination(1);
      setArticles([]);
      setTotal(0);
      setSelectedSources([]);
      setMoveDestination("");
      setMobile(false);
      setModal(null);
      setDetail(null);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  const load = useCallback(async () => {
    if (!user) return;
    if (user.role !== "admin" && ["sources", "topics", "jobs"].includes(page)) {
      const next = { page: "dashboard", topic: "", folder };
      writeNavigation(next, true);
      setNavigation(next);
      return;
    }
    const sequence = ++loadSequence.current;
    try {
      const [t, s, st, f]: [Row[], Row[], Row, SourceFolder[]] = await Promise.all([
        api("/topics"),
        api("/sources"),
        api("/status"),
        api("/source-folders"),
      ]);
      if (sequence !== loadSequence.current) return;
      setTopics(t);
      setSources(s);
      setStatus(st);
      setFolders(f);
      if (folder && folder !== unfiled && !f.some((entry) => entry.id === folder)) {
        const fallback = { page, topic, folder: "" };
        writeNavigation(fallback, true);
        setNavigation(fallback);
        setPagination(1);
        setArticles([]);
        setTotal(0);
        setSelectedSources([]);
        setMoveDestination("");
        setNotice("Dieser Quellenordner ist nicht mehr verfügbar. Alle Quellen werden angezeigt.");
        return;
      }
      const visible = new Set(sourcesInFolder(s, folder).map((entry) => entry.id));
      setSelectedSources((ids) => ids.every((id) => visible.has(id)) ? ids : ids.filter((id) => visible.has(id)));
      if (source && !visible.has(source)) {
        setSource((id) => id === source ? "" : id);
        setPagination(1);
      }
      if (feedPages.includes(page)) {
        const p = new URLSearchParams({
          q: search,
          sort,
          page: String(source && !visible.has(source) ? 1 : pagination),
          min,
        });
        if (topic) p.set("topic", topic);
        if (source && visible.has(source)) p.set("source", source);
        if (folder) p.set("folder", folder);
        if (type) p.set("type", type);
        if (from) p.set("from", from);
        if (to) p.set("to", to);
        if (page === "favorites") p.set("favorite", "true");
        const a = await api("/articles?" + p);
        if (sequence !== loadSequence.current) return;
        setArticles(a.items);
        setTotal(a.total);
      }
      if (page === "jobs") setJobs(await api("/jobs"));
      if (page === "briefings") setBriefings(await api("/briefings"));
      if (page === "settings") {
        setRules(await api("/rules"));
        setNotifications(await api("/notifications"));
        if (user.role === "admin") setUsers(await api("/users"));
      }
    } catch (e) {
      if (sequence === loadSequence.current) setError((e as Error).message);
    }
  }, [
    user,
    page,
    topic,
    folder,
    search,
    sort,
    pagination,
    min,
    source,
    type,
    from,
    to,
  ]);
  useEffect(() => {
    void load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);
  async function act(fn: () => Promise<any>, message = "Gespeichert") {
    setBusy(true);
    setError("");
    try {
      await fn();
      setNotice(message);
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  function navigate(p: string, tid = "") {
    const next = { page: p, topic: tid, folder: folderPages.includes(p) ? folder : "" };
    if (p !== page || tid !== topic || next.folder !== folder) {
      loadSequence.current++;
      writeNavigation(next);
      setNavigation(next);
      setSelectedSources([]);
      setMoveDestination("");
    }
    setPagination(1);
    setMobile(false);
    setDetail(null);
  }
  function changeFolder(id: string) {
    if (id === folder) return;
    loadSequence.current++;
    const next = { ...navigation, folder: id };
    writeNavigation(next);
    setNavigation(next);
    setPagination(1);
    setArticles([]);
    setTotal(0);
    setSelectedSources([]);
    setMoveDestination("");
    if (!sourcesInFolder(sources, id).some((entry) => entry.id === source)) setSource("");
  }
  async function openArticle(id: string) {
    try {
      setDetail(await api("/articles/" + id));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const isAdmin = user?.role === "admin";
  const visibleSources = sourcesInFolder(sources, folder);
  const selectedVisible = visibleSources.filter((entry) => selectedSources.includes(entry.id)).map((entry) => entry.id);
  const currentFolder = folders.find((entry) => entry.id === folder);
  const newSource = () =>
    setModal({
      kind: "source",
      data: {
        name: "",
        url: "",
        description: "",
        type: "rss",
        topics: [],
        priority: 5,
        interval_minutes: 30,
        enabled: true,
        rights_confirmed: false,
        folder_id: currentFolder?.id ?? null,
      },
    });
  if (checking)
    return (
      <div className="loading">
        NEWSDECK <span>Wird geladen …</span>
      </div>
    );
  if (!user)
    return (
      <div className="login">
        <div className="login-art">
          <div className="brand">
            N<span>NEWSDECK</span>
          </div>
          <div>
            <small>IHR NACHRICHTENRADAR</small>
            <h1>
              Das Wichtige.
              <br />
              Im Blick.
            </h1>
            <p>
              Quellen verbinden. Entwicklungen verstehen.
              <br />
              Informiert entscheiden.
            </p>
          </div>
          <span className="login-foot">
            Unabhängig. Übersichtlich. Immer auf dem Laufenden.
          </span>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (
              await act(
                () => api("/login", "POST", Object.fromEntries(f)),
                "Angemeldet",
              )
            )
              setUser(await api("/me"));
          }}
        >
          <small>WILLKOMMEN BEI NEWSDECK</small>
          <h2>Ihr Überblick beginnt hier.</h2>
          <p>Melden Sie sich mit Ihrem NEWSDECK-Konto an.</p>
          <label>
            E-Mail
            <input name="email" type="email" required autoComplete="username" />
          </label>
          <label>
            Passwort
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
          {error && <div className="error">{error}</div>}
          <button className="primary" disabled={busy}>
            Anmelden <ArrowUpRight size={18} />
          </button>
          <p className="muted">
            Erster Start? Mit „npm run setup“ ein Administratorkonto einrichten.
          </p>
        </form>
      </div>
    );
  return (
    <div className="app">
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <a className="brand" href="/" onClick={(event) => {
          event.preventDefault();
          navigate("dashboard");
        }}>
          N
          <span>
            NEWSDECK<small>MEDIA INTELLIGENCE</small>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-icon">N</span>
          <div>
            Mein Newsroom<small>Persönlicher Arbeitsbereich</small>
          </div>
          <ChevronRight size={16} />
        </div>
        <div className="nav-label">ARBEITSPLATZ</div>
        <nav>
          {[
            ["dashboard", "Übersicht", LayoutDashboard],
            ["favorites", "Merkliste", Bookmark],
            ["briefings", "Tägliches Briefing", FileText],
          ].map(([id, label, Icon]: any) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => navigate(id)}
            >
              <Icon size={18} />
              {label}
              {id === "dashboard" && status.newCount > 0 && (
                <em>{status.newCount}</em>
              )}
            </button>
          ))}
        </nav>
        <div className="nav-label section-label">
          THEMEN{" "}
          {isAdmin && (
            <button
              title="Neues Thema"
              onClick={() =>
                setModal({
                  kind: "topic",
                  data: {
                    name: "",
                    color: "#659b75",
                    keywords: [],
                    exclusions: [],
                    description: "",
                    parent_id: null,
                  },
                })
              }
            >
              <Plus size={15} />
            </button>
          )}
        </div>
        <nav className="topic-nav">
          {topics.map((t) => (
            <button
              key={t.id}
              className={topic === t.id ? "active" : ""}
              onClick={() => navigate("topic", t.id)}
            >
              <i
                style={{
                  background: t.color,
                  marginLeft: t.parent_id ? 12 : 0,
                }}
              />
              {t.name}
              <span>{t.count}</span>
            </button>
          ))}
        </nav>
        <div className="nav-label">VERWALTUNG</div>
        <nav>
          {[
            ["sources", "Quellen", Radio],
            ["topics", "Themen verwalten", Tags],
            ["jobs", "System & Abrufe", Activity],
            ["settings", "Einstellungen", Settings],
          ]
            .filter(([id]) => isAdmin || id === "settings")
            .map(([id, label, Icon]: any) => (
              <button
                key={id}
                className={page === id ? "active" : ""}
                onClick={() => navigate(id)}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="worker-state">
            <i className={status.workerAlive ? "green" : "orange"} />
            <div>
              {status.workerAlive
                ? "Monitoring aktiv"
                : "Abrufdienst nicht aktiv"}
              <small>{status.sources || 0} aktive Quellen</small>
            </div>
          </div>
          <div className="account">
            <span>{user.email.slice(0, 1).toUpperCase()}</span>
            <div>
              {user.email}
              <small>{user.localNoLogin ? "Lokaler Zugriff" : isAdmin ? "Administrator" : "Lesekonto"}</small>
            </div>
            {!user.localNoLogin && <button
              title="Abmelden"
              onClick={async () => {
                await api("/logout", "POST");
                setUser(null);
              }}
            >
              <LogOut size={16} />
            </button>}
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <button
            className="mobile-menu"
            title="Menü öffnen"
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
          <span>
            Arbeitsplatz <ChevronRight size={13} />{" "}
            {page === "topic"
              ? topics.find((t) => t.id === topic)?.name
              : (
                  {
                    dashboard: "Übersicht",
                    favorites: "Merkliste",
                    sources: "Quellen",
                    topics: "Themen",
                    jobs: "System & Abrufe",
                    briefings: "Briefing",
                    settings: "Einstellungen",
                  } as Row
                )[page]}
          </span>
          <div>
            <span className="today">
              {new Date().toLocaleDateString("de-DE", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </span>
            <button
              title={
                dark ? "Hellen Modus aktivieren" : "Dunklen Modus aktivieren"
              }
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button
              title="Benachrichtigungen"
              onClick={() => navigate("settings")}
            >
              <Bell size={18} />
            </button>
          </div>
        </header>
        <div className="content">
          {error && (
            <div role="alert" className="error">
              {error}
              <button title="Schließen" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="toast">
              <Check size={16} />
              {notice}
            </div>
          )}
          {["dashboard", "topic", "favorites"].includes(page) && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    {page === "favorites"
                      ? "FÜR SPÄTER GESPEICHERT"
                      : page === "topic"
                        ? "IHR THEMENRADAR"
                        : "INFORMATIONEN, DIE WEITERBRINGEN"}
                  </div>
                  <h1>
                    {page === "favorites"
                      ? "Ihre Merkliste"
                      : page === "topic"
                        ? topics.find((t) => t.id === topic)?.name
                        : "Alles Wichtige im Blick."}
                  </h1>
                  <p>
                    Ihr kuratierter Überblick. Aus Ihren Quellen, für Ihre
                    Themen.
                  </p>
                </div>
                {isAdmin && (
                  <button className="primary" onClick={newSource}>
                    <Plus size={17} />
                    Quelle hinzufügen
                  </button>
                )}
              </div>
              {page === "dashboard" && (
                <div className="stats">
                  <div>
                    <span>
                      Gesammelte Meldungen <FileText size={16} />
                    </span>
                    <strong>{status.total || 0}</strong>
                    <small>In Ihrem Nachrichtenarchiv</small>
                  </div>
                  <div>
                    <span>
                      Neu seit letztem Besuch <Activity size={16} />
                    </span>
                    <strong>
                      {status.newCount || 0}
                      <b>NEU</b>
                    </strong>
                    <button
                      onClick={() =>
                        act(
                          () => api("/seen", "POST"),
                          "Besuch als gelesen markiert",
                        )
                      }
                    >
                      Als gesehen markieren <ChevronRight size={12} />
                    </button>
                  </div>
                  <div>
                    <span>
                      Aktive Quellen <Radio size={16} />
                    </span>
                    <strong>
                      {status.sources || 0}
                      <i className={status.errors ? "orange" : "green"} />
                    </strong>
                    <small>
                      {status.errors
                        ? `${status.errors} Quellen benötigen Aufmerksamkeit`
                        : "Ihr Quellen-Netzwerk"}
                    </small>
                  </div>
                  <div>
                    <span>
                      Letzte Aktualisierung <RefreshCw size={16} />
                    </span>
                    <strong className="time-value">
                      {status.lastSuccess
                        ? new Date(status.lastSuccess).toLocaleTimeString(
                            "de-DE",
                            { hour: "2-digit", minute: "2-digit" },
                          )
                        : "–"}
                      <small>{status.lastSuccess ? "Uhr" : ""}</small>
                    </strong>
                    <small>
                      {status.workerAlive
                        ? "Automatischer Abruf läuft"
                        : "Hintergrunddienst starten"}
                    </small>
                  </div>
                </div>
              )}
              <div className="news-layout">
                <section className="news-section">
                  <div className="section-heading">
                    <h2>
                      {page === "favorites"
                        ? "Gespeicherte Meldungen"
                        : "Nachrichtenübersicht"}{" "}
                      <span>{total}</span>
                    </h2>
                    <div className="segmented">
                      <button
                        className={sort === "latest" ? "selected" : ""}
                        onClick={() => {
                          setSort("latest");
                          setPagination(1);
                        }}
                      >
                        Neueste
                      </button>
                      <button
                        className={sort === "relevance" ? "selected" : ""}
                        onClick={() => {
                          setSort("relevance");
                          setPagination(1);
                        }}
                      >
                        Relevanteste
                      </button>
                    </div>
                  </div>
                  <div className="feed-folder">
                    <Folder size={17} aria-hidden="true" />
                    <label htmlFor="feed-folder">Quellenordner</label>
                    <select id="feed-folder" value={folder} onChange={(e) => changeFolder(e.target.value)}>
                      <option value="">Alle Quellen</option>
                      <FolderOptions folders={folders} unfiledValue={unfiled} />
                    </select>
                  </div>
                  <div className="search-row">
                    <div className="search">
                      <Search size={18} />
                      <input
                        aria-label="Nachrichten durchsuchen"
                        placeholder="Nachrichten durchsuchen …"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                      />
                      {q && (
                        <button title="Suche löschen" onClick={() => setQ("")}>
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <button
                      className={"secondary " + (filters ? "selected" : "")}
                      onClick={() => setFilters(!filters)}
                    >
                      <SlidersHorizontal size={16} />
                      Filter
                    </button>
                  </div>
                  {filters && (
                    <div className="filter-panel">
                      <label>
                        Quelle
                        <select
                          value={source}
                          onChange={(e) => {
                            setSource(e.target.value);
                            setPagination(1);
                          }}
                        >
                          <option value="">Alle Quellen</option>
                          {visibleSources.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Typ
                        <select
                          value={type}
                          onChange={(e) => {
                            setType(e.target.value);
                            setPagination(1);
                          }}
                        >
                          <option value="">Alle Typen</option>
                          <option value="rss">RSS / Atom</option>
                          <option value="website">Website</option>
                          <option value="instagram">Instagram</option>
                          <option value="instagram_rss">
                            Instagram über RSS
                          </option>
                          <option value="instagram_rsshub">
                            Instagram über lokalen RSSHub
                          </option>
                        </select>
                      </label>
                      <label>
                        Relevanz ab
                        <select
                          value={min}
                          onChange={(e) => {
                            setMin(e.target.value);
                            setPagination(1);
                          }}
                        >
                          {Array.from({ length: 10 }, (_, i) => (
                            <option key={i} value={i + 1}>
                              {i + 1}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Von
                        <input
                          type="date"
                          value={from}
                          onChange={(e) => {
                            setFrom(e.target.value);
                            setPagination(1);
                          }}
                        />
                      </label>
                      <label>
                        Bis
                        <input
                          type="date"
                          value={to}
                          onChange={(e) => {
                            setTo(e.target.value);
                            setPagination(1);
                          }}
                        />
                      </label>
                      <button
                        onClick={() => {
                          setSource("");
                          setType("");
                          setMin("1");
                          setFrom("");
                          setTo("");
                          setQ("");
                          changeFolder("");
                          setPagination(1);
                        }}
                      >
                        Zurücksetzen
                      </button>
                    </div>
                  )}
                  <div className="topic-chips">
                    <button
                      className={!topic ? "chosen" : ""}
                      onClick={() =>
                        navigate(
                          page === "favorites" ? "favorites" : "dashboard",
                        )
                      }
                    >
                      Alle Themen
                    </button>
                    {topics.slice(0, 6).map((t) => (
                      <button
                        key={t.id}
                        className={topic === t.id ? "chosen" : ""}
                        onClick={() => navigate(page, t.id)}
                      >
                        <i style={{ background: t.color }} />
                        {t.name}
                      </button>
                    ))}
                  </div>
                  {!articles.length ? (
                    <div className="empty">
                      <Radio size={36} />
                      <h3>
                        {status.total
                          ? "Keine passenden Meldungen"
                          : "Ihr Newsroom ist bereit."}
                      </h3>
                      <p>
                        {status.total
                          ? "Passen Sie Ihre Suche oder Filter an."
                          : "Fügen Sie eine Nachrichtenquelle hinzu. Der Hintergrunddienst sammelt neue Meldungen automatisch."}
                      </p>
                      {!status.total && isAdmin && (
                        <button className="primary" onClick={newSource}>
                          <Plus size={16} />
                          Erste Quelle verbinden
                        </button>
                      )}
                    </div>
                  ) : (
                    articles.map((a, index) => (
                      <article
                        className={
                          "news-card " +
                          (index === 0 && sort === "relevance"
                            ? "featured"
                            : "")
                        }
                        key={a.id}
                      >
                        <div className="card-meta">
                          <span className="source-avatar">
                            {a.source_name.slice(0, 1).toUpperCase()}
                          </span>
                          <b>{a.source_name}</b>
                          <span>·</span>
                          <time title={a.publication_verified === 1 ? "Veröffentlichungsdatum" : "Abrufdatum"}>
                            {dateLabel(a.publication_verified === 1 ? a.published_at : a.fetched_at)}
                          </time>
                          <span
                            className="relevance"
                            title={
                              a.ai_status === "done"
                                ? "KI-Relevanzbewertung"
                                : "Vorläufig: Priorität der Quelle"
                            }
                          >
                            {a.relevance}
                            <small>/10</small>
                          </span>
                          <button
                            className={a.favorite ? "bookmarked" : ""}
                            title={
                              a.favorite
                                ? "Aus Merkliste entfernen"
                                : "In Merkliste speichern"
                            }
                            onClick={() =>
                              act(
                                () =>
                                  api(
                                    "/articles/" + a.id + "/favorite",
                                    "PUT",
                                    { enabled: !a.favorite },
                                  ),
                                a.favorite
                                  ? "Aus Merkliste entfernt"
                                  : "In Merkliste gespeichert",
                              )
                            }
                          >
                            <Bookmark
                              size={19}
                              fill={a.favorite ? "currentColor" : "none"}
                            />
                          </button>
                        </div>
                        <button
                          className="headline"
                          onClick={() => openArticle(a.id)}
                        >
                          <h3>{a.title}</h3>
                        </button>
                        <ArticleImage key={a.image_url} article={a} />
                        <p>
                          {a.summary ||
                            a.description ||
                            "Öffnen Sie die Meldung für den verfügbaren Quelltext."}
                        </p>
                        <div className="card-footer">
                          <div>
                            {a.topics.map((t: Row) => (
                              <button
                                className="badge"
                                key={t.id}
                                style={{ color: t.color }}
                                onClick={() => navigate("topic", t.id)}
                              >
                                <i style={{ background: t.color }} />
                                {t.name}
                              </button>
                            ))}
                            <span className="fact">{a.fact_status}</span>
                            {a.ai_status !== "done" && (
                              <span className="fact">Ohne KI</span>
                            )}
                          </div>
                          <button
                            className="read-more"
                            onClick={() => openArticle(a.id)}
                          >
                            {Number(a.cluster_count) > 1
                              ? `${a.cluster_count} Berichte`
                              : "Details"}
                            <ArrowUpRight size={15} />
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                  {total > 30 && (
                    <div className="pagination">
                      <button
                        disabled={pagination === 1}
                        onClick={() => setPagination(pagination - 1)}
                      >
                        Zurück
                      </button>
                      <span>
                        Seite {pagination} / {Math.ceil(total / 30)}
                      </span>
                      <button
                        disabled={pagination * 30 >= total}
                        onClick={() => setPagination(pagination + 1)}
                      >
                        Weiter
                      </button>
                    </div>
                  )}
                </section>
                <aside className="right-rail">
                  <div className="rail-card briefing-teaser">
                    <div className="eyebrow">
                      <FileText size={15} /> IHR TÄGLICHER ÜBERBLICK
                    </div>
                    <h2>
                      Wissen, was
                      <br />
                      den Tag bewegt.
                    </h2>
                    <p>
                      Neue Meldungen und aktualisierte Geschichten, nach Themen
                      geordnet.
                    </p>
                    <button onClick={() => navigate("briefings")}>
                      Briefing öffnen <ArrowUpRight size={17} />
                    </button>
                    <div className="abstract-lines">
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                  <div className="rail-card">
                    <div className="section-heading">
                      <h3>Ihr Themenradar</h3>
                      <Tags size={17} />
                    </div>
                    {topics.map((t) => (
                      <button
                        className="radar-row"
                        key={t.id}
                        onClick={() => navigate("topic", t.id)}
                      >
                        <span>
                          <i style={{ background: t.color }} />
                          {t.name}
                        </span>
                        <b>{t.count}</b>
                        <div
                          style={{
                            width:
                              Math.max(
                                5,
                                Math.min(
                                  100,
                                  (Number(t.count) /
                                    Math.max(1, status.total)) *
                                    100,
                                ),
                              ) + "%",
                            background: t.color,
                          }}
                        />
                      </button>
                    ))}
                  </div>
                  <div className="rail-note">
                    <i className={status.workerAlive ? "green" : "orange"} />
                    <div>
                      <b>
                        {status.workerAlive
                          ? "Ihr Radar arbeitet weiter."
                          : "Radar wartet auf den Dienst."}
                      </b>
                      <p>
                        {status.workerAlive
                          ? "Auch wenn Sie dieses Fenster schließen, werden Ihre Quellen weiter geprüft."
                          : "Starten Sie den Worker, damit neue Meldungen automatisch eingehen."}
                      </p>
                    </div>
                  </div>
                </aside>
              </div>
            </>
          )}
          {page === "sources" && isAdmin && (
            <>
              <PageTitle
                eyebrow="IHR INFORMATIONSNETZWERK"
                title="Quellen verwalten"
                text="Verbinden Sie verlässliche Quellen mit Ihrem Newsroom."
                action={
                  <button className="primary" onClick={newSource}>
                    <Plus size={17} />
                    Quelle hinzufügen
                  </button>
                }
              />
              <section className="panel folder-panel" aria-label="Quellenordner">
                <div className="section-heading">
                  <h2>Quellenordner</h2>
                  <button className="secondary" onClick={() => setModal({ kind: "folder", data: { name: "" } })}>
                    <Plus size={15} /> Neuer Ordner
                  </button>
                </div>
                <nav className="topic-chips" aria-label="Quellen nach Ordner anzeigen">
                  {[
                    { id: "", name: "Alle Quellen", source_count: sources.length },
                    ...folders,
                    { id: unfiled, name: "Ohne Ordner", source_count: sourcesInFolder(sources, unfiled).length },
                  ].map((entry) => (
                    <button
                      key={entry.id}
                      aria-pressed={folder === entry.id}
                      className={folder === entry.id ? "chosen" : ""}
                      onClick={() => changeFolder(entry.id)}
                    >
                      {entry.name} ({entry.source_count})
                    </button>
                  ))}
                </nav>
                {currentFolder && (
                  <div className="folder-actions">
                    <button className="secondary" onClick={() => setModal({ kind: "folder", data: currentFolder })}>
                      <Pencil size={15} /> Ordner umbenennen
                    </button>
                    <button className="secondary" onClick={() => setModal({ kind: "delete-folder", data: currentFolder })}>
                      <Trash2 size={15} /> Ordner löschen
                    </button>
                  </div>
                )}
              </section>
              <div className="toolbar">
                <span>{visibleSources.length} Quellen angezeigt</span>
                <a className="secondary" href="/api/sources/export">
                  <Download size={16} />
                  JSON exportieren
                </a>
                <label className="secondary file-label">
                  <Upload size={16} />
                  JSON importieren
                  <input
                    type="file"
                    accept=".json"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      await act(async () => {
                        const results = await api(
                          "/sources/import",
                          "POST",
                          JSON.parse(await file.text()),
                        );
                        const failed = results.filter((r: Row) => !r.ok);
                        if (failed.length) {
                          await load();
                          throw new Error(failed.map((r: Row) => r.name + ": " + r.error).join("; "));
                        }
                      }, "Quellen importiert");
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {visibleSources.length > 0 && (
                <div className="panel folder-bulk">
                  <span aria-live="polite">{selectedVisible.length} ausgewählt</span>
                  <label>
                    Zielordner
                    <select value={moveDestination} onChange={(e) => setMoveDestination(e.target.value)}>
                      <option value="">Ziel wählen …</option>
                      <FolderOptions folders={folders} unfiledValue={unfiled} />
                    </select>
                  </label>
                  <button
                    className="secondary"
                    disabled={busy || !selectedVisible.length || !(moveDestination === unfiled || folders.some((f) => f.id === moveDestination))}
                    onClick={async () => {
                      if (await act(() => api("/sources/move", "POST", {
                        source_ids: selectedVisible,
                        folder_id: moveDestination === unfiled ? null : moveDestination,
                      }), "Quellen verschoben")) {
                        setSelectedSources([]);
                        setMoveDestination("");
                      }
                    }}
                  >
                    In Ordner verschieben
                  </button>
                </div>
              )}
              {!visibleSources.length && (
                <div className="empty">
                  <Radio size={35} />
                  <h3>{currentFolder ? "Dieser Ordner ist leer" : folder === unfiled ? "Keine Quellen ohne Ordner" : "Noch keine Quellen verbunden"}</h3>
                  <p>{currentFolder
                    ? "Fügen Sie hier eine Quelle hinzu oder verschieben Sie vorhandene Quellen aus der Gesamtansicht."
                    : folder === unfiled
                      ? "Alle vorhandenen Quellen sind einem Ordner zugeordnet."
                      : "Beginnen Sie mit einem RSS-Feed oder einer Website."}</p>
                  <button className="primary" onClick={newSource}>
                    Quelle hinzufügen
                  </button>
                </div>
              )}
              <div className="source-grid">
                {visibleSources.map((s) => (
                  <div className="panel source-card" key={s.id}>
                    <div className="section-heading">
                      <span className="source-avatar large">
                        {s.name.slice(0, 1)}
                      </span>
                      <span
                        className={
                          "status " + (s.enabled ? s.status : "disabled")
                        }
                      >
                        {!s.enabled
                          ? "Pausiert"
                          : (
                              {
                                pending: "Wartet",
                                running: "Wird abgerufen",
                                ok: "Aktiv",
                                error: "Fehler",
                              } as Row
                            )[s.status]}
                      </span>
                    </div>
                    <h2>{s.name}</h2>
                    <label className="source-selection">
                      <input
                        type="checkbox"
                        aria-label={s.name + " auswählen"}
                        checked={selectedVisible.includes(s.id)}
                        disabled={busy || (selectedVisible.length >= 500 && !selectedVisible.includes(s.id))}
                        onChange={(e) => setSelectedSources((ids) =>
                          e.target.checked ? [...ids, s.id] : ids.filter((id) => id !== s.id),
                        )}
                      />
                      Auswählen
                    </label>
                    <small className="source-folder-name">
                      <Folder size={14} aria-hidden="true" />
                      {folders.find((entry) => entry.id === s.folder_id)?.name || "Ohne Ordner"}
                    </small>
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.url}
                      <ArrowUpRight size={13} />
                    </a>
                    <p>{s.description || "Keine Beschreibung"}</p>
                    <div className="source-facts">
                      <span>
                        Typ
                        <b>
                          {s.type === "instagram_rss"
                            ? "Instagram über RSS"
                            : s.type === "instagram_rsshub"
                              ? "Instagram / RSSHub lokal"
                              : s.type.toUpperCase()}
                        </b>
                      </span>
                      <span>
                        Intervall<b>{s.interval_minutes} Min.</b>
                      </span>
                      <span>
                        Meldungen<b>{s.item_count}</b>
                      </span>
                    </div>
                    <small>Letzter Erfolg: {fmt(s.last_success)}</small>
                    {s.error && <div className="error">{s.error}</div>}
                    <div className="source-actions">
                      <button
                        className="secondary"
                        onClick={() => setModal({ kind: "source", data: s })}
                      >
                        <Pencil size={14} />
                        Bearbeiten
                      </button>
                      <button
                        title="Jetzt abrufen"
                        onClick={() =>
                          act(
                            () => api("/sources/" + s.id + "/fetch", "POST"),
                            "Abruf eingeplant",
                          )
                        }
                      >
                        <RefreshCw size={16} />
                      </button>
                      <button
                        title={
                          s.enabled ? "Quelle pausieren" : "Quelle aktivieren"
                        }
                        onClick={() =>
                          act(
                            () =>
                              api("/sources/" + s.id, "PUT", {
                                ...s,
                                enabled: !s.enabled,
                              }),
                            s.enabled ? "Quelle pausiert" : "Quelle aktiviert",
                          )
                        }
                      >
                        {s.enabled ? "Pause" : "Start"}
                      </button>
                      <button
                        title="Quelle löschen"
                        onClick={() =>
                          setModal({ kind: "delete-source", data: s })
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {page === "topics" && isAdmin && (
            <>
              <PageTitle
                eyebrow="ORDNUNG MIT SYSTEM"
                title="Ihre Themen"
                text="Themen, Unterthemen und Regeln für Ihren Nachrichtenstrom."
                action={
                  <button
                    className="primary"
                    onClick={() =>
                      setModal({
                        kind: "topic",
                        data: {
                          name: "",
                          color: "#659b75",
                          keywords: [],
                          exclusions: [],
                          description: "",
                          parent_id: null,
                        },
                      })
                    }
                  >
                    <Plus size={17} />
                    Thema erstellen
                  </button>
                }
              />
              <div className="source-grid">
                {topics.map((t) => (
                  <div className="panel" key={t.id}>
                    <div className="section-heading">
                      <span
                        className="topic-icon"
                        style={{ background: t.color }}
                      >
                        <Tags size={20} />
                      </span>
                      <span>{t.count} Meldungen</span>
                    </div>
                    <h2>{t.name}</h2>
                    <p>
                      {t.description ||
                        "Keine semantische Themenbeschreibung hinterlegt."}
                    </p>
                    {t.parent_id && (
                      <small>
                        Unterthema von{" "}
                        {topics.find((p) => p.id === t.parent_id)?.name}
                      </small>
                    )}
                    <p className="muted">
                      Suchbegriffe: {t.keywords.join(", ") || "Keine"}
                      <br />
                      Ausschlüsse: {t.exclusions.join(", ") || "Keine"}
                    </p>
                    <div className="source-actions">
                      <button
                        className="secondary"
                        onClick={() => setModal({ kind: "topic", data: t })}
                      >
                        <Pencil size={14} />
                        Bearbeiten
                      </button>
                      <button
                        title="Thema löschen"
                        onClick={() =>
                          setModal({ kind: "delete-topic", data: t })
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {page === "jobs" && (
            <>
              <PageTitle
                eyebrow="BETRIEB & TRANSPARENZ"
                title="System & Abrufe"
                text="Status Ihres Hintergrunddienstes und die letzten 100 Abrufe."
              />
              <div className="status-grid">
                <div className="panel">
                  <Activity />
                  <h3>
                    {status.workerAlive
                      ? "Hintergrunddienst aktiv"
                      : "Hintergrunddienst nicht erreichbar"}
                  </h3>
                  <p>Letztes Lebenszeichen: {fmt(status.heartbeat)}</p>
                </div>
                <div className="panel">
                  <Settings />
                  <h3>
                    {status.aiConfigured
                      ? "KI konfiguriert"
                      : "Regelbasierte Verarbeitung"}
                  </h3>
                  <p>
                    {status.aiConfigured
                      ? "Fehlgeschlagene Analysen werden erneut versucht."
                      : "Originaltexte und Themenregeln funktionieren auch ohne KI."}
                  </p>
                </div>
              </div>
              <div className="panel table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Quelle</th>
                      <th>Zeit</th>
                      <th>Status</th>
                      <th>Neu / geändert</th>
                      <th>Hinweis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j) => (
                      <tr key={j.id}>
                        <td>{j.source_name}</td>
                        <td>{fmt(j.started_at)}</td>
                        <td>
                          <span className={"status " + j.status}>
                            {j.status === "ok" ? "Erfolgreich" : "Fehler"}
                          </span>
                        </td>
                        <td>{j.found}</td>
                        <td>{j.error || "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!jobs.length && <p>Noch keine Abrufe protokolliert.</p>}
              </div>
            </>
          )}
          {page === "briefings" && (
            <>
              <PageTitle
                eyebrow="WENIGER SUCHEN. MEHR WISSEN."
                title="Ihr tägliches Briefing"
                text="Meldungen vom jeweiligen Kalendertag. Beiträge ohne verlässliches Veröffentlichungsdatum werden nicht berücksichtigt."
              />
              {!briefings.length && (
                <div className="empty">
                  <FileText size={36} />
                  <h3>Das Tagesbriefing wird vorbereitet.</h3>
                </div>
              )}
              {briefings.map((b) => (
                <div className="panel briefing" key={b.id}>
                  <div className="eyebrow">TAGESÜBERBLICK · {b.day.split("-").reverse().join(".")}</div>
                  <h2>Ihr Nachrichtenkompass</h2>
                  <div className="briefing-meta">
                    <small>{b.timezone} · Zuletzt aktualisiert {fmt(b.updated_at, b.timezone)}</small>
                    {b.is_today && <small className="briefing-current">Heute · laufend aktualisiert</small>}
                    {user.role === "admin" && (
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => act(
                          () => api(`/briefings/${b.day}/rebuild`, "POST"),
                          "Tagesbriefing neu berechnet.",
                        )}
                      >
                        <RefreshCw size={15} /> Neu berechnen
                      </button>
                    )}
                  </div>
                  {b.truncated === 1 && <p>Auswahl der 200 relevantesten Meldungen des Tages.</p>}
                  {!b.content.length && (
                    <p>Für diesen Tag liegen noch keine Meldungen mit verlässlichem Veröffentlichungsdatum vor.</p>
                  )}
                  {!!b.content.length && <p><small>Quellenauszüge ohne eigenständige Faktenprüfung.</small></p>}
                  {b.content.map((g: Row) => (
                    <section key={g.id}>
                      <h3>{g.topic}</h3>
                      {g.items.map((a: Row) => (
                        <button
                          className="briefing-item"
                          key={a.id}
                          onClick={() => openArticle(a.id)}
                        >
                          <b>{a.title}</b>
                          <p>{a.summary || a.description}</p>
                          <small>
                            {a.source_name} · Veröffentlicht {fmt(a.published_at, b.timezone)} · Relevanz {a.relevance}/10{" "}
                            <ArrowUpRight size={12} />
                          </small>
                        </button>
                      ))}
                    </section>
                  ))}
                </div>
              ))}
            </>
          )}
          {page === "settings" && (
            <>
              <PageTitle
                eyebrow="IHR NEWSROOM, IHRE REGELN"
                title="Einstellungen"
                text="Benachrichtigungen, Konten und Datenexport."
              />
              <div className="status-grid">
                <section className="panel">
                  <h2>Benachrichtigungen</h2>
                  <p>
                    Neue Meldungen mit hoher Relevanz landen hier und optional
                    in Ihrem E-Mail-Postfach.
                  </p>
                  <small>
                    {status.smtpConfigured
                      ? "SMTP konfiguriert"
                      : "E-Mail-Versand nicht konfiguriert. SMTP-Zugang in der Serverkonfiguration hinterlegen."}
                  </small>
                  <form
                    className="rule-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void act(
                        () =>
                          api("/rules", "POST", {
                            topic_id: f.get("topic") || null,
                            min_relevance: Number(f.get("min")),
                          }),
                        "Regel angelegt",
                      );
                    }}
                  >
                    <label>
                      Thema
                      <select name="topic">
                        <option value="">Alle Themen</option>
                        {topics.map((t) => (
                          <option value={t.id} key={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Relevanz ab
                      <input
                        type="number"
                        name="min"
                        min="1"
                        max="10"
                        defaultValue="8"
                      />
                    </label>
                    <button className="primary">Regel anlegen</button>
                  </form>
                  {rules.map((r) => (
                    <div className="rule" key={r.id}>
                      <span>
                        {topics.find((t) => t.id === r.topic_id)?.name ||
                          "Alle Themen"}{" "}
                        · ab {r.min_relevance}/10
                      </span>
                      <button
                        title="Regel löschen"
                        onClick={() =>
                          act(
                            () => api("/rules/" + r.id, "DELETE"),
                            "Regel gelöscht",
                          )
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </section>
                <section className="panel">
                  <h2>Daten & Konfiguration</h2>
                  <p>
                    Ihre Meldungen bleiben dauerhaft in der Datenbank. Ein
                    Archivexport enthält Nachrichten, Themen, Fassungen und
                    Briefings.
                  </p>
                  {isAdmin && (
                    <a className="secondary" href="/api/export">
                      <Download size={16} />
                      Archiv als JSON exportieren
                    </a>
                  )}
                  <hr />
                  <h3>KI-Verarbeitung</h3>
                  <p>
                    {status.aiConfigured
                      ? "Ein KI-Anbieter ist konfiguriert."
                      : "Ohne KI-Verbindung: Themenregeln und Quellenpriorität bilden die vorläufige Einordnung."}
                  </p>
                  <small>
                    Anbieter, Modell und Zugangsdaten werden ausschließlich über
                    die Serverkonfiguration gepflegt.
                  </small>
                </section>
              </div>
              <section className="panel">
                <h2>Ihre Hinweise</h2>
                {!notifications.length ? (
                  <p>Noch keine passenden Benachrichtigungen.</p>
                ) : (
                  notifications.map((n) => (
                    <div className="rule" key={n.id}>
                      <button onClick={() => openArticle(n.article_id)}>
                        {n.title}
                      </button>
                      <small>
                        {n.status === "sent"
                          ? "E-Mail versandt"
                          : n.error || "In der Anwendung verfügbar"}
                      </small>
                    </div>
                  ))
                )}
              </section>
              {isAdmin && (
                <section className="panel">
                  <div className="section-heading">
                    <h2>Benutzerkonten</h2>
                    <button
                      className="secondary"
                      onClick={() =>
                        setModal({
                          kind: "user",
                          data: { email: "", password: "", role: "reader" },
                        })
                      }
                    >
                      <Plus size={16} />
                      Konto hinzufügen
                    </button>
                  </div>
                  {users.map((u) => (
                    <div className="rule" key={u.id}>
                      <span>{u.email}</span>
                      <small>
                        {u.role === "admin" ? "Administrator" : "Lesekonto"}
                      </small>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
        </div>
        <footer className="footer">
          NEWSDECK <span>Ihre Quellen. Ihr Überblick.</span>
          <span>Originalquellen bleiben maßgeblich.</span>
        </footer>
      </main>
      {modal && (
        <Modal
          title={
            (
              {
                source: modal.data.id
                  ? "Quelle bearbeiten"
                  : "Neue Quelle verbinden",
                topic: modal.data.id ? "Thema bearbeiten" : "Neues Thema",
                folder: modal.data.id ? "Ordner umbenennen" : "Neuer Quellenordner",
                user: "Benutzerkonto anlegen",
                "delete-source": "Quelle löschen?",
                "delete-topic": "Thema löschen?",
                "delete-folder": "Quellenordner löschen?",
              } as Row
            )[modal.kind]
          }
          close={() => setModal(null)}
        >
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {modal.kind.startsWith("delete") ? (
            <>
              <p>
                „{modal.data.name}“ löschen?{" "}
                {modal.kind === "delete-source"
                  ? "Bereits gesammelte Meldungen bleiben im Archiv."
                  : modal.kind === "delete-folder"
                    ? "Der Ordner wird gelöscht. Quellen und Beiträge bleiben erhalten."
                    : "Die Meldungen bleiben erhalten; die Themenzuordnung wird entfernt."}
              </p>
              <div className="form-actions">
                <button className="secondary" onClick={() => setModal(null)}>
                  Abbrechen
                </button>
                <button
                  className="danger"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await act(
                        () =>
                          api(
                            "/" +
                              (modal.kind === "delete-source"
                                ? "sources/"
                                : modal.kind === "delete-folder"
                                  ? "source-folders/"
                                  : "topics/") +
                              modal.data.id,
                            "DELETE",
                          ),
                        "Gelöscht",
                      )
                    )
                      setModal(null);
                  }}
                >
                  Löschen
                </button>
              </div>
            </>
          ) : (
            <Editor
              kind={modal.kind}
              data={modal.data}
              topics={topics}
              folders={folders}
              busy={busy}
              onSave={async (data) => {
                const path =
                  modal.kind === "source"
                    ? "sources"
                    : modal.kind === "topic"
                      ? "topics"
                      : modal.kind === "folder"
                        ? "source-folders"
                        : "users";
                if (
                  await act(() =>
                    api(
                      "/" + path + (data.id ? "/" + data.id : ""),
                      data.id ? "PUT" : "POST",
                      data,
                    ),
                  )
                )
                  setModal(null);
              }}
            />
          )}
        </Modal>
      )}
      {detail && (
        <Modal wide title="Meldungsdetails" close={() => setDetail(null)}>
          <div className="detail-meta">
            {detail.source_name} ·{" "}
            {detail.publication_verified === 1
              ? "Veröffentlicht " + fmt(detail.published_at)
              : "Veröffentlichungsdatum nicht bestätigt"}{" "}
            · Abgerufen {fmt(detail.fetched_at)}
          </div>
          <h1 className="detail-title">{detail.title}</h1>
          <ArticleImage key={detail.image_url} article={detail} detail />
          <div className="detail-badges">
            <span className="badge">Relevanz {detail.relevance}/10</span>
            <span className="fact">{detail.fact_status}</span>
            <span className="fact">
              {detail.ai_status === "done" ? "KI-Analyse" : "Ohne KI-Analyse"}
            </span>
          </div>
          <p className="detail-summary">
            {detail.summary || detail.description}
          </p>
          <p className="info-note">{detail.fact_note}</p>
          <a
            className="primary"
            target="_blank"
            rel="noreferrer"
            href={detail.url}
          >
            Original öffnen <ArrowUpRight size={16} />
          </a>
          <h3>Verfügbarer Quelltext</h3>
          <div className="article-text">
            {detail.content ||
              "Die Quelle liefert keinen weiteren Artikeltext."}
          </div>
          <ArticleTopics
            article={detail}
            topics={topics}
            refresh={() => openArticle(detail.id)}
          />
          <h3>Berichte im selben Cluster</h3>
          <p className="muted">
            Automatische Ähnlichkeit der Überschriften; keine Bestätigung
            gleicher Sachverhalte.
          </p>
          {detail.related.map((a: Row) => (
            <a
              className="related"
              key={a.id}
              href={a.url}
              target="_blank"
              rel="noreferrer"
            >
              <span>
                {a.title}
                <small>{a.source_name}</small>
              </span>
              <ArrowUpRight size={17} />
            </a>
          ))}
          {detail.analyses.length > 0 &&
            detail.analyses.map((a: Row) => {
              const r = JSON.parse(a.result);
              return r.development ? (
                <div key={a.id}>
                  <h3>KI-Einordnung der Änderung</h3>
                  <p>{r.development}</p>
                  <small>
                    {fmt(a.created_at)} · {a.model}
                  </small>
                </div>
              ) : null;
            })}
          <h3>Entwicklungsverlauf</h3>
          {!detail.revisions.length ? (
            <p className="muted">
              Seit der Erfassung wurde keine Änderung am Quelltext festgestellt.
            </p>
          ) : (
            detail.revisions.map((r: Row) => (
              <details key={r.id}>
                <summary>
                  {fmt(r.changed_at)} · {r.change_note}
                </summary>
                <h4>{r.title}</h4>
                <p>{r.content}</p>
              </details>
            ))
          )}
          {isAdmin && (
            <>
              <h3>Themen manuell zuordnen</h3>
              <div className="checkbox-grid">
                {topics.map((t) => (
                  <label key={t.id}>
                    <input
                      type="checkbox"
                      disabled={busy}
                      checked={detail.topics.some(
                        (x: Row) => x.topic_id === t.id,
                      )}
                      onChange={async (e) => {
                        const ids = detail.topics.map((x: Row) => x.topic_id);
                        const next = e.target.checked
                          ? [...ids, t.id]
                          : ids.filter((x: string) => x !== t.id);
                        if (
                          await act(() =>
                            api("/articles/" + detail.id + "/topics", "PUT", {
                              topics: next,
                            }),
                          )
                        )
                          await openArticle(detail.id);
                      }}
                    />
                    {t.name}
                  </label>
                ))}
              </div>
              <p className="muted">
                Beim erneuten automatischen Zuordnen wird die manuelle Festlegung aufgehoben.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (await act(
                    () => api("/articles/" + detail.id + "/topics/automatic", "POST"),
                    "Automatische Zuordnung aktualisiert",
                  )) await openArticle(detail.id);
                }}
              >
                Erneut automatisch zuordnen
              </button>
              <details>
                <summary>Redaktionellen Faktenstatus setzen</summary>
                <form
                  className="fact-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    if (
                      await act(() =>
                        api(
                          "/articles/" + detail.id + "/fact",
                          "PUT",
                          Object.fromEntries(f),
                        ),
                      )
                    )
                      await openArticle(detail.id);
                  }}
                >
                  <label>
                    Status
                    <select name="status" defaultValue={detail.fact_status}>
                      {[
                        "Bestätigt",
                        "Einzelbericht",
                        "Unbestätigte Behauptung",
                        "Widersprüchliche Angaben",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Begründung / Belege
                    <textarea
                      name="note"
                      required
                      minLength={10}
                      placeholder="Unabhängige Belege und Quellen dokumentieren"
                    />
                  </label>
                  <button className="secondary">Prüfung speichern</button>
                </form>
              </details>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
const topicStatusText: Record<string, string> = {
  manual: "Manuell festgelegt",
  pending: "KI-Themenprüfung eingeplant",
  running: "KI-Themenprüfung läuft",
  retry: "KI-Themenprüfung wird wiederholt",
  failed: "KI-Themenprüfung fehlgeschlagen",
  outdated: "Regeln werden erneut angewendet",
  rules: "Automatisch nach Regeln geprüft",
  done: "Automatisch durch KI geprüft",
};
const topicConfidenceText: Record<string, string> = {
  niedrig: "niedrige Sicherheit",
  mittel: "mittlere Sicherheit",
  hoch: "hohe Sicherheit",
};

function ArticleTopics({
  article,
  topics,
  refresh,
}: {
  article: Row;
  topics: Row[];
  refresh: () => void;
}) {
  const status = article.topic_status;
  const assignments: Row[] = article.topics;
  const results: Row[] = article.topic_results;
  const waiting = ["pending", "running", "retry", "outdated"].includes(status);
  const suggestions = status === "outdated" ? [] : results.filter((result) =>
    !result.adopted && (status !== "done" || result.origin === "ai"),
  );
  return (
    <section className="article-topics" aria-label="Themenzuordnung">
      <h3>Themenzuordnung</h3>
      <p className="muted">{topicStatusText[status]}{waiting && assignments.length > 0 && " · Vorläufig"}</p>
      {article.topic_error && status !== "outdated" && <p className="info-note">{article.topic_error}</p>}
      {assignments.length ? (
        <ul>
          {assignments.map(({ topic_id }) => {
            const result = results.find((r) => r.topic_id === topic_id && r.adopted);
            const name = result?.name || topics.find((t) => t.id === topic_id)?.name;
            return (
              <li key={topic_id}>
                <strong>{name || "Thema"}</strong>
                {result && status !== "outdated" && (
                  <p>{result.reason} <small>({topicConfidenceText[result.confidence]})</small></p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p>{waiting ? "Noch kein Thema zugeordnet." : status === "manual"
          ? "Manuell ohne Themen gespeichert." : "Keine passenden Themen gefunden."}</p>
      )}
      {suggestions.length > 0 && (
        <details>
          <summary>Unsichere Vorschläge ({suggestions.length})</summary>
          <ul>
            {suggestions.map((r) => (
              <li key={r.topic_id}>
                <strong>{r.name}</strong>
                <p>{r.reason} <small>({topicConfidenceText[r.confidence]})</small></p>
              </li>
            ))}
          </ul>
        </details>
      )}
      {waiting && <button type="button" onClick={refresh}>Themenstatus aktualisieren</button>}
    </section>
  );
}

function PageTitle({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow: string;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {action}
    </div>
  );
}
function Modal({
  title,
  close,
  wide,
  children,
}: {
  title: string;
  close: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const prior = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";
    const timer = setTimeout(() => {
      document
        .querySelector<HTMLElement>(".modal button,.modal input")
        ?.focus();
    }, 0);
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const els = [
          ...document.querySelectorAll<HTMLElement>(
            ".modal button,.modal input,.modal select,.modal textarea,.modal a[href],.modal summary",
          ),
        ].filter((e) => !e.hasAttribute("disabled"));
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", f);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = "";
      document.removeEventListener("keydown", f);
      prior?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={"modal " + (wide ? "wide" : "")}
      >
        <header>
          <h2 id="modal-title">{title}</h2>
          <button title="Schließen" onClick={close}>
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function FolderOptions({ folders, unfiledValue }: { folders: SourceFolder[]; unfiledValue: string }) {
  return (
    <>
      {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
      <option value={unfiledValue}>Ohne Ordner</option>
    </>
  );
}

function Editor({
  kind,
  data,
  topics,
  folders,
  busy,
  onSave,
}: {
  kind: string;
  data: Row;
  topics: Row[];
  folders: SourceFolder[];
  busy: boolean;
  onSave: (d: Row) => void;
}) {
  const [d, setD] = useState(data),
    [note, setNote] = useState(""),
    [detecting, setDetecting] = useState(false);
  const set = (key: string, value: any) => setD({ ...d, [key]: value });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(d);
      }}
    >
      {kind === "source" ? (
        <>
          <label>
            Quellenordner
            <select value={d.folder_id ?? ""} onChange={(e) => set("folder_id", e.target.value || null)}>
              <FolderOptions folders={folders} unfiledValue="" />
            </select>
          </label>
          <label>
            Quellentyp
            <select
              value={d.type}
              onChange={(e) => {
                set("type", e.target.value);
                setNote("");
              }}
            >
              <option value="rss">RSS / Atom</option>
              <option value="instagram_rss">Instagram über RSS</option>
              <option value="instagram_rsshub">
                Instagram über lokalen RSSHub (kostenlos)
              </option>
              <option value="website">Website / Newsroom</option>
              <option value="instagram">Instagram (Meta API)</option>
            </select>
          </label>
          {d.type === "instagram_rsshub" && (
            <div className="info-note">
              <strong>Lokaler Abruf ohne Instagram-Anmeldung</strong>
              <p>
                Öffentliche Profiladresse einfügen und „Profil testen“ wählen.
                RSSHub läuft auf Ihrem Rechner; es wird kein RSS.app-Konto
                benötigt. Instagram kann den anonymen Zugriff sperren oder leere
                Ergebnisse liefern. Stories, private Profile und Hashtags werden
                hier nicht unterstützt.
              </p>
            </div>
          )}
          {d.type === "instagram_rss" && (
            <div className="info-note">
              <strong>Instagram-Profil als Nachrichtenquelle verbinden</strong>
              <ol>
                <li>
                  Öffentliches Instagram-Profil bei RSS.app in einen RSS-Feed
                  umwandeln.
                </li>
                <li>
                  Den dort erzeugten XML-/RSS-Link kopieren und unten einfügen.
                </li>
                <li>Mit „Feed prüfen“ testen und anschließend speichern.</li>
              </ol>
              <a
                className="secondary"
                href="https://rss.app/rss-feed/create-instagram-rss-feed"
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram-RSS-Generator öffnen <ArrowUpRight size={14} />
              </a>
              <p>
                RSS.app ist ein externer Dienst und kann ein kostenpflichtiges
                Konto erfordern. Unterstützt werden dort zugängliche öffentliche
                Profile. NEWSDECK ruft den Feed automatisch im eingestellten
                Intervall ab.
              </p>
            </div>
          )}
          <label>
            Name
            <input
              required
              value={d.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="z. B. Tagesschau"
            />
          </label>
          <label>
            {d.type === "instagram_rss"
              ? "Erzeugter RSS-Feed-Link"
              : d.type === "instagram_rsshub" || d.type === "instagram"
                ? "Öffentliche Instagram-Profiladresse"
                : "URL oder Feed-Adresse"}
            <div className="url-input">
              <input
                type="text"
                inputMode="url"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={d.url}
                onChange={(e) => set("url", e.target.value)}
                placeholder={
                  d.type === "instagram_rss"
                    ? "https://rss.app/feeds/….xml"
                    : d.type === "instagram_rsshub" || d.type === "instagram"
                      ? "https://www.instagram.com/nasa/"
                      : "www.beispiel.de oder https://…"
                }
              />
              <button
                type="button"
                className="secondary"
                disabled={detecting || !d.url}
                onClick={async () => {
                  setDetecting(true);
                  try {
                    const r = await api(
                      d.type === "instagram_rsshub"
                        ? "/rsshub/test"
                        : d.type === "instagram"
                          ? "/instagram/meta/test"
                          : "/sources/detect",
                      "POST",
                      {
                        url: d.url,
                      },
                    );
                    if (d.type === "instagram_rss" && r.type !== "rss") {
                      setNote(
                        "Kein RSS-/Atom-Feed erkannt. Bitte den erzeugten Feed-Link verwenden, nicht die Instagram-Adresse oder die Seite des Generators.",
                      );
                      return;
                    }
                    setD({
                      ...d,
                      type:
                        d.type === "instagram_rss" ? "instagram_rss" : r.type,
                      url: r.url,
                    });
                    setNote(r.note);
                  } catch (e) {
                    setNote((e as Error).message);
                  } finally {
                    setDetecting(false);
                  }
                }}
              >
                {detecting
                  ? "Prüft …"
                  : d.type === "instagram_rsshub" || d.type === "instagram"
                    ? "Profil testen"
                    : d.type === "instagram_rss"
                      ? "Feed prüfen"
                      : "Erkennen"}
              </button>
            </div>
          </label>
          {note && <p className="info-note">{note}</p>}
          <div className="form-grid">
            <label>
              Abrufintervall (Minuten)
              <input
                type="number"
                min="5"
                max="10080"
                required
                value={d.interval_minutes}
                onChange={(e) =>
                  set("interval_minutes", Number(e.target.value))
                }
              />
            </label>
          </div>
          {d.type === "instagram" && (
            <p className="info-note">
              Meta Business Discovery benötigt ein eingerichtetes professionelles
              Konto mit verknüpfter Facebook-Seite. „Profil testen“ prüft, ob
              Meta das Zielprofil über diesen Zugang freigibt.
            </p>
          )}
          <label>
            Beschreibung
            <textarea
              value={d.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </label>
          <label>
            Quellenpriorität (1–10)
            <input
              type="number"
              min="1"
              max="10"
              required
              value={d.priority}
              onChange={(e) => set("priority", Number(e.target.value))}
            />
          </label>
          <label>Themenhinweise der Quelle</label>
          <p className="muted">Diese Hinweise ergänzen die Auswertung des Beitragsinhalts.</p>
          <div className="checkbox-grid">
            {topics.map((t) => (
              <label key={t.id}>
                <input
                  type="checkbox"
                  checked={d.topics.includes(t.id)}
                  onChange={(e) =>
                    set(
                      "topics",
                      e.target.checked
                        ? [...d.topics, t.id]
                        : d.topics.filter((x: string) => x !== t.id),
                    )
                  }
                />
                {t.name}
              </label>
            ))}
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              checked={d.rights_confirmed}
              onChange={(e) => set("rights_confirmed", e.target.checked)}
            />
            Ich habe die Abruf- und Nutzungsbedingungen geprüft und darf die
            Inhalte für diesen Newsroom verwenden.
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={d.enabled}
              onChange={(e) => set("enabled", e.target.checked)}
            />
            Quelle aktivieren
          </label>
        </>
      ) : kind === "folder" ? (
        <label>
          Ordnername
          <input required maxLength={80} value={d.name} onChange={(e) => set("name", e.target.value)} />
        </label>
      ) : kind === "topic" ? (
        <>
          <div className="form-grid">
            <label>
              Name
              <input
                required
                value={d.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </label>
            <label>
              Farbe
              <input
                type="color"
                value={d.color}
                onChange={(e) => set("color", e.target.value)}
              />
            </label>
          </div>
          <label>
            Übergeordnetes Thema
            <select
              value={d.parent_id || ""}
              onChange={(e) => set("parent_id", e.target.value || null)}
            >
              <option value="">Keines (Hauptthema)</option>
              {topics
                .filter((t) => t.id !== d.id)
                .map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Inhaltliche Beschreibung für die KI
            <textarea
              value={d.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Welche Entwicklungen gehören zu diesem Thema?"
            />
          </label>
          <label>
            Suchbegriffe (durch Komma getrennt)
            <input
              defaultValue={d.keywords.join(", ")}
              onChange={(e) =>
                set(
                  "keywords",
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
            />
          </label>
          <label>
            Wörtliche Ausschlussbegriffe (durch Komma getrennt)
            <input
              defaultValue={d.exclusions.join(", ")}
              onChange={(e) =>
                set(
                  "exclusions",
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
            />
          </label>
          <p className="muted">
            Ein vollständiger Begriffstreffer schließt das Thema in beiden Verfahren aus.
          </p>
          <label>
            Inhaltliche Abgrenzung für die KI
            <textarea
              value={d.semantic_exclusions || ""}
              onChange={(e) => set("semantic_exclusions", e.target.value)}
              placeholder="Welche Kontexte gehören trotz ähnlicher Begriffe nicht zu diesem Thema?"
              maxLength={2000}
            />
          </label>
          <p className="muted">
            Geänderte Regeln werden im Hintergrund auch auf vorhandene Meldungen angewendet.
            Manuelle Zuordnungen werden bewahrt.
          </p>
        </>
      ) : (
        <>
          <label>
            E-Mail
            <input
              type="email"
              required
              value={d.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </label>
          <label>
            Startpasswort (mindestens 14 Zeichen)
            <input
              type="password"
              required
              minLength={14}
              value={d.password}
              onChange={(e) => set("password", e.target.value)}
            />
          </label>
          <label>
            Rolle
            <select
              value={d.role}
              onChange={(e) => set("role", e.target.value)}
            >
              <option value="reader">Lesekonto</option>
              <option value="admin">Administrator</option>
            </select>
          </label>
        </>
      )}
      <div className="form-actions">
        <button className="primary" disabled={busy || detecting}>
          {busy ? "Wird gespeichert …" : "Speichern"}
          <Check size={16} />
        </button>
      </div>
    </form>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
