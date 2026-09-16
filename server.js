#!/usr/bin/env node
/* RE:SEARCH local application server — Node.js 24+ (no third-party runtime). */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const DATABASE_DIR = path.join(ROOT, "data");
const DATABASE_PATH = path.join(DATABASE_DIR, "research.db");
const SESSION_AGE_SECONDS = 60 * 60 * 24 * 14;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

fs.mkdirSync(DATABASE_DIR, { recursive: true });
const db = new DatabaseSync(DATABASE_PATH);
db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student','lecturer','admin')),
    student_id TEXT,
    real_name TEXT,
    class_name TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    csrf_token TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    topic TEXT NOT NULL,
    is_anonymous INTEGER NOT NULL DEFAULT 0 CHECK(is_anonymous IN (0,1)),
    status TEXT NOT NULL DEFAULT 'visible' CHECK(status IN ('visible','hidden','deleted')),
    selected_response_id INTEGER,
    is_pinned INTEGER NOT NULL DEFAULT 0 CHECK(is_pinned IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    edited_at TEXT
  );
  CREATE TABLE IF NOT EXISTS responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id INTEGER NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    is_anonymous INTEGER NOT NULL DEFAULT 0 CHECK(is_anonymous IN (0,1)),
    status TEXT NOT NULL DEFAULT 'visible' CHECK(status IN ('visible','hidden','deleted')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    edited_at TEXT
  );
  CREATE TABLE IF NOT EXISTS votes (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK(target_type IN ('post','response')),
    target_id INTEGER NOT NULL,
    vote_value INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id, target_type, target_id)
  );
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submitted_by INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    source_url TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('course','reference')),
    format TEXT NOT NULL DEFAULT 'Khác',
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
    reviewed_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS contribution_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    event_type TEXT NOT NULL,
    points INTEGER NOT NULL,
    reference_type TEXT,
    reference_id INTEGER,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS activity_days (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id, activity_date)
  );
  CREATE TABLE IF NOT EXISTS streak_restores (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    restored_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id, restored_date)
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    subject_type TEXT NOT NULL,
    subject_id INTEGER,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS kv_store (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'approved',
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS saved_posts (
    user_id INTEGER REFERENCES users(id),
    post_id INTEGER REFERENCES posts(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, post_id)
  );
`);

try { db.exec("ALTER TABLE users ADD COLUMN student_id TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN real_name TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN class_name TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN avatar TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN avatar_changed INTEGER NOT NULL DEFAULT 0;"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN locked_until TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE posts ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0 CHECK(is_pinned IN (0,1));"); } catch (e) {}
try { db.exec("ALTER TABLE votes ADD COLUMN vote_value INTEGER NOT NULL DEFAULT 1;"); } catch (e) {}
try { db.exec("ALTER TABLE documents ADD COLUMN format TEXT NOT NULL DEFAULT 'Khác';"); } catch (e) {}
try { db.exec("ALTER TABLE responses ADD COLUMN parent_id INTEGER REFERENCES responses(id) ON DELETE CASCADE;"); } catch (e) {}
try { db.exec("ALTER TABLE posts ADD COLUMN edited_at TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE responses ADD COLUMN edited_at TEXT;"); } catch (e) {}

const defaultTopics = [
  "Đề tài", "Lý thuyết", "Phương pháp", 
  "Dữ liệu & phân tích", "Viết nghiên cứu", 
  "Tài liệu", "Thảo luận chung"
];
for (const t of defaultTopics) {
  db.prepare(`INSERT OR IGNORE INTO topics (name, status) VALUES (?, 'approved')`).run(t);
}

const attempts = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const v = attempts.get(key) || [];
  const kept = v.filter((t) => now - t < windowMs);
  kept.push(now);
  attempts.set(key, kept);
  return kept.length <= max;
}
const downvoteAttempts = new Map();
function recordDownvoteAndCheckSpam(userId) {
  const now = Date.now();
  const history = downvoteAttempts.get(userId) || [];
  const recent = history.filter(t => now - t < 10 * 60 * 1000); // 10 minutes
  recent.push(now);
  downvoteAttempts.set(userId, recent);
  return recent.length >= 5;
}
function sha(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
function randomToken() {
  return crypto.randomBytes(32).toString("base64url");
}
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const digest = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${digest}`;
}
function verifyPassword(password, encoded) {
  const [type, salt, digest] = encoded.split("$");
  if (type !== "scrypt" || !salt || !digest) return false;
  const calculated = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(calculated, Buffer.from(digest, "hex"));
}
function parseCookies(request) {
  return Object.fromEntries(
    (request.headers.cookie || "")
      .split(";")
      .map((v) => v.trim())
      .filter(Boolean)
      .map((v) => {
        const i = v.indexOf("=");
        return [v.slice(0, i), decodeURIComponent(v.slice(i + 1))];
      }),
  );
}
function json(response, status, body, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  response.end(JSON.stringify(body));
}
function error(response, status, message) {
  json(response, status, { error: message });
}
async function readJSON(request) {
  let raw = "";
  for await (const c of request) {
    raw += c;
    if (raw.length > 1_000_000) throw new Error("PAYLOAD_TOO_LARGE");
  }
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error("INVALID_JSON");
  }
}
function sessionFrom(request) {
  const token = parseCookies(request).research_session;
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT s.csrf_token, s.expires_at, u.id, u.email, u.display_name, u.role, u.student_id, u.real_name, u.class_name, u.avatar, u.avatar_changed, u.locked_until FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?`,
    )
    .get(sha(token));
  if (!row || Date.parse(row.expires_at) < Date.now()) return null;
  return row;
}
const ANIMAL_EMOJIS = ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐧", "🦉", "🐢", "🦖", "🐳", "🐙", "🦄", "🐝", "🦋", "🐞"];

function getAvatarEmoji(str) {
  if (!str) return "K";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ANIMAL_EMOJIS[Math.abs(hash) % ANIMAL_EMOJIS.length];
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    initials: user.avatar || getAvatarEmoji(user.display_name),
    avatarChanged: Boolean(user.avatar_changed),
    role: user.role,
    studentId: user.student_id || "",
    realName: user.real_name || "",
    className: user.class_name || "",
  };
}
function requireUser(request, response) {
  const session = sessionFrom(request);
  if (!session) {
    error(response, 401, "Bạn cần đăng nhập để thực hiện thao tác này.");
    return null;
  }
  if (session.locked_until && Date.parse(session.locked_until) > Date.now()) {
    error(response, 403, "Tài khoản của bạn đã bị khóa 12 tiếng do hành vi tiêu cực.");
    return null;
  }
  return session;
}
function requireCsrf(request, response, session) {
  if (request.headers["x-csrf-token"] !== session.csrf_token) {
    error(
      response,
      403,
      "Phiên làm việc không hợp lệ. Vui lòng tải lại trang.",
    );
    return false;
  }
  return true;
}
function isAdmin(user) {
  return user.role === "admin" || user.role === "ta" || user.role === "lecturer";
}
function isSuperAdmin(user) {
  return user.role === "admin" || user.role === "ta";
}
function recordContribution(
  userId,
  type,
  points,
  referenceType,
  referenceId,
  reason = null,
) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());
  db.prepare(
    "INSERT OR IGNORE INTO activity_days(user_id,activity_date) VALUES (?,?)",
  ).run(userId, today);
  const limits = { post_created: 5, response_created: 10, document_approved: 5 };
  const maxAllowed = limits[type];
  if (maxAllowed) {
    const countObj = db.prepare(
      "SELECT count(*) as c FROM contribution_events WHERE user_id=? AND event_type=? AND points > 0 AND created_at >= datetime('now', '-24 hours')"
    ).get(userId, type);
    if (countObj.c >= maxAllowed) {
      points = 0;
      reason = (reason || type) + " (Giới hạn nhận điểm 24h)";
    }
  }

  db.prepare(
    "INSERT INTO contribution_events(user_id,event_type,points,reference_type,reference_id,reason) VALUES (?,?,?,?,?,?)",
  ).run(userId, type, points, referenceType, referenceId, reason);
}
function createSession(response, userId) {
  const token = randomToken(),
    csrf = randomToken(),
    expiresAt = new Date(Date.now() + SESSION_AGE_SECONDS * 1000).toISOString();
  db.prepare(
    "INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES (?,?,?,?)",
  ).run(sha(token), userId, csrf, expiresAt);
  response.setHeader(
    "Set-Cookie",
    `research_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_AGE_SECONDS}`,
  );
  return csrf;
}
function clearSession(request, response) {
  const token = parseCookies(request).research_session;
  if (token)
    db.prepare("DELETE FROM sessions WHERE token_hash=?").run(sha(token));
  response.setHeader(
    "Set-Cookie",
    "research_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
  );
}

function serializePost(row, viewer) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    topic: row.topic,
    isAnonymous: Boolean(row.is_anonymous),
    author:
      row.is_anonymous && !isAdmin(viewer)
        ? { displayName: "Sinh viên ẩn danh", initials: "?" }
        : {
            id: row.author_id,
            displayName: row.display_name,
            initials: row.avatar || getAvatarEmoji(row.display_name),
            role: row.role,
          },
    createdAt: row.created_at.replace(' ', 'T') + 'Z',
    updatedAt: row.updated_at.replace(' ', 'T') + 'Z',
    editedAt: row.edited_at ? row.edited_at.replace(' ', 'T') + 'Z' : null,
    isAuthor: viewer && viewer.id === row.author_id,
    helpfulCount: Number(row.helpful_count),
    responseCount: Number(row.response_count),
    selectedResponseId: row.selected_response_id,
    isPinned: Boolean(row.is_pinned),
    lecturerRecommended: Boolean(row.lecturer_recommended > 0),
    isSaved: Boolean(row.is_saved),
  };
}
function listPosts(viewer, search = "") {
  const needle = `%${search.trim()}%`;
  const rows = db
    .prepare(
      `SELECT p.*,u.display_name,u.avatar,u.role,(SELECT coalesce(sum(vote_value),0) FROM votes v WHERE v.target_type='post' AND v.target_id=p.id) helpful_count,(SELECT count(*) FROM responses r WHERE r.post_id=p.id AND r.status='visible') response_count,(SELECT count(*) FROM votes v JOIN users vu ON vu.id=v.user_id WHERE v.target_type='post' AND v.target_id=p.id AND v.vote_value > 0 AND vu.role='lecturer') lecturer_recommended FROM posts p JOIN users u ON u.id=p.author_id WHERE p.status='visible' AND (p.title LIKE ? OR p.content LIKE ? OR p.topic LIKE ?) ORDER BY p.is_pinned DESC, p.created_at DESC`,
    )
    .all(needle, needle, needle);
  return rows.map((r) => serializePost(r, viewer));
}
function bootstrapAdmin() {
  const email = process.env.RESEARCH_INITIAL_ADMIN_EMAIL;
  const password = process.env.RESEARCH_INITIAL_ADMIN_PASSWORD;
  if (
    !email ||
    !password ||
    db.prepare("SELECT count(*) count FROM users").get().count
  )
    return;
  if (password.length < 12)
    throw new Error(
      "RESEARCH_INITIAL_ADMIN_PASSWORD phải có ít nhất 12 ký tự.",
    );
  db.prepare(
    "INSERT INTO users(email,password_hash,display_name,role) VALUES (?,?,?,?)",
  ).run(
    email,
    hashPassword(password),
    process.env.RESEARCH_INITIAL_ADMIN_NAME || "TA Quản trị",
    "admin",
  );
  console.log(`Đã tạo TA/Admin đầu tiên: ${email}`);
}
bootstrapAdmin();

async function api(request, response, url) {
  const pathName = url.pathname;
  const method = request.method;
  if (method === "GET" && pathName === "/api/health")
    return json(response, 200, { ok: true });
  if (method === "GET" && pathName === "/api/session") {
    const session = sessionFrom(request);
    return json(response, 200, {
      authenticated: Boolean(session),
      user: session ? publicUser(session) : null,
      csrfToken: session?.csrf_token || null,
    });
  }

  if (method === "POST" && pathName === "/api/auth/restore-streak") {
    const user = requireUser(request, response);
    if (!user) return;
    const todayDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    const yesterdayDate = new Date(todayDate); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const y = yesterdayDate.getFullYear();
    const m = String(yesterdayDate.getMonth()+1).padStart(2, '0');
    const day = String(yesterdayDate.getDate()).padStart(2, '0');
    const yesterday = `${y}-${m}-${day}`;
    
    db.prepare("INSERT OR IGNORE INTO streak_restores(user_id,restored_date) VALUES (?,?)").run(user.id, yesterday);
    return json(response, 200, { success: true });
  }
  if (method === "POST" && pathName === "/api/auth/register") {
    if (
      !rateLimit(`register:${request.socket.remoteAddress}`, 5, 60 * 60 * 1000)
    )
      return error(response, 429, "Bạn đã thử đăng ký quá nhiều lần.");
    const { email, password, displayName } = await readJSON(request);
    if (
      !/^\S+@\S+\.\S+$/.test(email || "") ||
      typeof displayName !== "string" ||
      displayName.trim().length < 2 ||
      typeof password !== "string" ||
      password.length < 12
    )
      return error(
        response,
        400,
        "Hãy nhập email hợp lệ, tên hiển thị và mật khẩu từ 12 ký tự.",
      );
    try {
      const result = db
        .prepare(
          "INSERT INTO users(email,password_hash,display_name,role) VALUES (?,?,?,?)",
        )
        .run(
          email.trim().toLowerCase(),
          hashPassword(password),
          displayName.trim().slice(0, 80),
          "student",
        );
      const user = db
        .prepare("SELECT * FROM users WHERE id=?")
        .get(result.lastInsertRowid);
      const csrfToken = createSession(response, user.id);
      return json(response, 201, { user: publicUser(user), csrfToken });
    } catch (e) {
      return error(
        response,
        e.message.includes("UNIQUE") ? 409 : 500,
        e.message.includes("UNIQUE")
          ? "Email này đã được dùng."
          : "Không thể tạo tài khoản.",
      );
    }
  }
  if (method === "POST" && pathName === "/api/auth/login") {
    if (!rateLimit(`login:${request.socket.remoteAddress}`, 10, 15 * 60 * 1000))
      return error(response, 429, "Bạn đã thử đăng nhập quá nhiều lần.");
    const { email, password } = await readJSON(request);
    const user = db
      .prepare("SELECT * FROM users WHERE email=?")
      .get((email || "").trim().toLowerCase());
    if (!user || !verifyPassword(password || "", user.password_hash))
      return error(response, 401, "Email hoặc mật khẩu chưa đúng.");
    const csrfToken = createSession(response, user.id);
    return json(response, 200, { user: publicUser(user), csrfToken });
  }
  if (method === "POST" && pathName === "/api/auth/logout") {
    const user = requireUser(request, response);
    if (!user || !requireCsrf(request, response, user)) return;
    clearSession(request, response);
    return json(response, 200, { ok: true });
  }
  if (method === "GET" && pathName === "/api/posts") {
    const viewer = sessionFrom(request) || { role: "student" };
    return json(response, 200, {
      posts: listPosts(viewer, url.searchParams.get("q") || ""),
    });
  }
  if (method === "POST" && pathName === "/api/posts") {
    const user = requireUser(request, response);
    if (!user || !requireCsrf(request, response, user)) return;
    if (!rateLimit(`post:${user.id}`, 8, 60 * 60 * 1000))
      return error(
        response,
        429,
        "Bạn đã đăng quá nhiều câu hỏi trong một giờ.",
      );
    const { title, content, topic, isAnonymous } = await readJSON(request);
    const allowedTopics = db.prepare("SELECT name FROM topics WHERE status = 'approved'").all().map(t => t.name);
    if (
      typeof title !== "string" ||
      title.trim().length < 12 ||
      title.trim().length > 140 ||
      typeof content !== "string" ||
      content.trim().length < 25 ||
      content.trim().length > 10000 ||
      !allowedTopics.includes(topic)
    )
      return error(response, 400, "Nội dung câu hỏi chưa hợp lệ.");
    const anonymous = isAdmin(user) ? 0 : isAnonymous ? 1 : 0;
    const result = db
      .prepare(
        "INSERT INTO posts(author_id,title,content,topic,is_anonymous) VALUES (?,?,?,?,?)",
      )
      .run(user.id, title.trim(), content.trim(), topic, anonymous);
    recordContribution(
      user.id,
      "post_created",
      2,
      "post",
      result.lastInsertRowid,
    );
    const post = db
      .prepare(
        `SELECT p.*,u.display_name,u.avatar,u.role,0 helpful_count,0 response_count FROM posts p JOIN users u ON u.id=p.author_id WHERE p.id=?`,
      )
      .get(result.lastInsertRowid);
    return json(response, 201, { post: serializePost(post, user) });
  }
  const postIdMatch = pathName.match(/^\/api\/posts\/(\d+)$/);
  if (method === "GET" && postIdMatch) {
    const viewer = sessionFrom(request) || { role: "student" };
    const row = db
      .prepare(
        `SELECT p.*,u.display_name,u.avatar,u.role,(SELECT coalesce(sum(vote_value),0) FROM votes v WHERE v.target_type='post' AND v.target_id=p.id) helpful_count,(SELECT count(*) FROM responses r WHERE r.post_id=p.id AND r.status='visible') response_count,(SELECT count(*) FROM votes v JOIN users vu ON vu.id=v.user_id WHERE v.target_type='post' AND v.target_id=p.id AND v.vote_value > 0 AND vu.role='lecturer') lecturer_recommended,(SELECT 1 FROM saved_posts sp WHERE sp.post_id=p.id AND sp.user_id=?) is_saved FROM posts p JOIN users u ON u.id=p.author_id WHERE p.id=? AND p.status='visible'`,
      )
      .get(viewer?.id || null, Number(postIdMatch[1]));
    if (!row) return error(response, 404, "Không tìm thấy bài đăng.");
    const responses = db
      .prepare(
        `SELECT r.*,u.display_name,u.avatar,u.role,(SELECT coalesce(sum(vote_value),0) FROM votes v WHERE v.target_type='response' AND v.target_id=r.id) helpful_count,(SELECT count(*) FROM votes v JOIN users vu ON vu.id=v.user_id WHERE v.target_type='response' AND v.target_id=r.id AND v.vote_value > 0 AND vu.role='lecturer') lecturer_recommended FROM responses r JOIN users u ON u.id=r.author_id WHERE r.post_id=? AND r.status='visible' ORDER BY r.created_at ASC`,
      )
      .all(row.id)
      .map((r) => ({
        id: r.id,
        parentId: r.parent_id || null,
        content: r.content,
        createdAt: r.created_at.replace(' ', 'T') + 'Z',
        editedAt: r.edited_at ? r.edited_at.replace(' ', 'T') + 'Z' : null,
        isAuthor: viewer && viewer.id === r.author_id,
        helpfulCount: Number(r.helpful_count),
        lecturerRecommended: Boolean(r.lecturer_recommended > 0),
        selected: row.selected_response_id === r.id,
        author: r.is_anonymous && !isAdmin(viewer)
          ? {
              displayName: "Sinh viên ẩn danh",
              role: "student",
              initials: "?",
            }
          : {
              displayName: r.display_name,
              role: r.role,
              initials: r.avatar || getAvatarEmoji(r.display_name),
            },
        anonymous: Boolean(r.is_anonymous),
      }));
    return json(response, 200, { post: serializePost(row, viewer), responses });
  }
  const saveMatch = pathName.match(/^\/api\/posts\/(\d+)\/save$/);
  if (method === "POST" && saveMatch) {
    const user = requireUser(request, response);
    if (!user || !requireCsrf(request, response, user)) return;
    const postId = Number(saveMatch[1]);
    const existing = db.prepare("SELECT 1 FROM saved_posts WHERE user_id=? AND post_id=?").get(user.id, postId);
    if (existing) {
      db.prepare("DELETE FROM saved_posts WHERE user_id=? AND post_id=?").run(user.id, postId);
      return json(response, 200, { isSaved: false });
    } else {
      db.prepare("INSERT INTO saved_posts(user_id, post_id) VALUES (?,?)").run(user.id, postId);
      return json(response, 200, { isSaved: true });
    }
  }
  const savedPostsMatch = pathName.match(/^\/api\/users\/(\d+)\/saved-posts$/);
  if (method === "GET" && savedPostsMatch) {
    const user = requireUser(request, response);
    if (!user) return;
    const targetUserId = Number(savedPostsMatch[1]);
    if (user.id !== targetUserId && !isAdmin(user)) return error(response, 403, "Không có quyền.");
    const rows = db.prepare(`SELECT p.*,u.display_name,u.avatar,u.role,(SELECT coalesce(sum(vote_value),0) FROM votes v WHERE v.target_type='post' AND v.target_id=p.id) helpful_count,(SELECT count(*) FROM responses r WHERE r.post_id=p.id AND r.status='visible') response_count,(SELECT count(*) FROM votes v JOIN users vu ON vu.id=v.user_id WHERE v.target_type='post' AND v.target_id=p.id AND v.vote_value > 0 AND vu.role='lecturer') lecturer_recommended, 1 as is_saved FROM posts p JOIN users u ON u.id=p.author_id JOIN saved_posts sp ON sp.post_id=p.id WHERE sp.user_id=? AND p.status='visible' ORDER BY sp.created_at DESC`).all(targetUserId);
    return json(response, 200, { posts: rows.map(r => serializePost(r, user)) });
  }
  const responseMatch = pathName.match(/^\/api\/posts\/(\d+)\/responses$/);
  if (method === "POST" && responseMatch) {
    const user = requireUser(request, response);
    if (!user || !requireCsrf(request, response, user)) return;
    if (!rateLimit(`response:${user.id}`, 20, 60 * 60 * 1000))
      return error(response, 429, "Bạn đã phản hồi quá nhiều, thử lại sau.");
    const { content, isAnonymous, parentId } = await readJSON(request);
    if (
      typeof content !== "string" ||
      content.trim().length < 10 ||
      content.trim().length > 10000
    )
      return error(response, 400, "Phản hồi cần có ít nhất 10 ký tự.");
    const post = db
      .prepare("SELECT id FROM posts WHERE id=? AND status='visible'")
      .get(Number(responseMatch[1]));
    if (!post) return error(response, 404, "Không tìm thấy bài đăng.");

    let finalParentId = null;
    if (parentId) {
      const parent = db.prepare("SELECT id FROM responses WHERE id=? AND post_id=? AND status='visible'").get(parentId, post.id);
      if (!parent) return error(response, 400, "Bình luận cha không hợp lệ.");
      finalParentId = parent.id;
    }

    const anonymous = isAdmin(user) ? 0 : isAnonymous ? 1 : 0;
    const result = db
      .prepare(
        "INSERT INTO responses(post_id,author_id,content,is_anonymous,parent_id) VALUES (?,?,?,?,?)",
      )
      .run(post.id, user.id, content.trim(), anonymous, finalParentId);
    const points = finalParentId ? 1 : 4;
    recordContribution(
      user.id,
      "response_created",
      points,
      "response",
      result.lastInsertRowid,
    );
    return json(response, 201, { id: Number(result.lastInsertRowid) });
  }

  const editMatch = pathName.match(/^\/api\/(posts|responses)\/(\d+)$/);
  if (method === "PATCH" && editMatch) {
    const type = editMatch[1]; // 'posts' or 'responses'
    const id = parseInt(editMatch[2], 10);
    const user = requireUser(request, response);
    if (!user || !requireCsrf(request, response, user)) return;

    const { content, title } = await readJSON(request);
    if (typeof content !== "string" || content.trim().length < 5) {
      return error(response, 400, "Nội dung quá ngắn.");
    }

    const row = db.prepare(`SELECT author_id, created_at, status FROM ${type} WHERE id=?`).get(id);
    if (!row) return error(response, 404, "Không tìm thấy.");
    if (row.status !== "visible") return error(response, 403, "Không thể chỉnh sửa nội dung đã bị ẩn.");
    if (row.author_id !== user.id) return error(response, 403, "Chỉ tác giả mới được phép chỉnh sửa.");

    // Kiểm tra thời gian 30 phút (1800000 ms)
    const createdAtTime = new Date(row.created_at.replace(' ', 'T') + 'Z').getTime();
    if (Date.now() - createdAtTime > 30 * 60 * 1000) {
      return error(response, 403, "Đã hết thời hạn 30 phút để chỉnh sửa.");
    }

    if (type === "posts") {
      if (typeof title !== "string" || title.trim().length < 5) {
        return error(response, 400, "Tiêu đề quá ngắn.");
      }
      db.prepare(`UPDATE posts SET title=?, content=?, edited_at=CURRENT_TIMESTAMP WHERE id=?`).run(title.trim(), content.trim(), id);
    } else {
      db.prepare(`UPDATE responses SET content=?, edited_at=CURRENT_TIMESTAMP WHERE id=?`).run(content.trim(), id);
    }
    return json(response, 200, { success: true });
  }
  const voteMatch = pathName.match(/^\/api\/(posts|responses)\/(\d+)\/vote$/);
  if (method === "POST" && voteMatch) {
    const user = requireUser(request, response);
    if (!user || !requireCsrf(request, response, user)) return;
    if (!rateLimit(`vote:${user.id}`, 60, 60 * 60 * 1000))
      return error(response, 429, "Bạn thao tác quá nhanh, thử lại sau.");
    const { value } = await readJSON(request);
    if (![-1, 1].includes(value)) return error(response, 400, "Invalid vote");

    if (value === -1) {
      if (recordDownvoteAndCheckSpam(user.id)) {
        const lockedUntil = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString().replace('T', ' ').replace('Z', '');
        db.prepare("UPDATE users SET locked_until=? WHERE id=?").run(lockedUntil, user.id);
        recordContribution(user.id, "penalty", -50, null, null, "Hệ thống nhận diện hành vi tiêu cực với cộng đồng");
        downvoteAttempts.delete(user.id);
        return error(response, 403, "Tài khoản của bạn đã bị khóa 12 tiếng do hành vi tiêu cực.");
      }
    }

    const [, kind, idText] = voteMatch;
    const targetType = kind === "posts" ? "post" : "response";
    const table = targetType === "post" ? "posts" : "responses";
    const target = db
      .prepare(`SELECT author_id FROM ${table} WHERE id=? AND status='visible'`)
      .get(Number(idText));
    if (!target) return error(response, 404, "Không tìm thấy nội dung.");
    if (target.author_id === user.id)
      return error(response, 400, "Bạn không thể tự vote nội dung của mình.");
    try {
      db.prepare(
        "INSERT INTO votes(user_id,target_type,target_id,vote_value) VALUES (?,?,?,?) ON CONFLICT(user_id,target_type,target_id) DO UPDATE SET vote_value=?",
      ).run(user.id, targetType, Number(idText), value, value);
      recordContribution(
        target.author_id,
        "helpful_received",
        value > 0 ? 1 : -1,
        targetType,
        Number(idText),
      );
      return json(response, 201, { ok: true });
    } catch {
      return error(response, 409, "Bạn đã đánh dấu nội dung này là Hữu ích.");
    }
  }
  if (method === "GET" && pathName === "/api/leaderboard") {
    const topUsers = db
      .prepare(`
        SELECT u.id, u.display_name as displayName, u.role, coalesce(sum(c.points), 0) as totalPoints
        FROM users u
        JOIN contribution_events c ON u.id = c.user_id
        WHERE u.role NOT IN ('admin', 'lecturer')
        GROUP BY u.id
        ORDER BY totalPoints DESC
        LIMIT 5
      `)
      .all();
    return json(response, 200, { leaderboard: topUsers });
  }
  if (method === "GET" && pathName === "/api/me/contributions") {
    const user = requireUser(request, response);
    if (!user) return;
    const stats = db
      .prepare(
        "SELECT coalesce(sum(points),0) total, count(*) count FROM contribution_events WHERE user_id=?",
      )
      .get(user.id);
    const activity = db
      .prepare(
        "SELECT activity_date FROM activity_days WHERE user_id=? ORDER BY activity_date DESC",
      )
      .all(user.id)
      .map((x) => x.activity_date);

    const todayDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    const formatYMD = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth()+1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };
    const today = formatYMD(todayDate);
    const yesterdayDate = new Date(todayDate); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = formatYMD(yesterdayDate);
    const dayBeforeDate = new Date(todayDate); dayBeforeDate.setDate(dayBeforeDate.getDate() - 2);
    const dayBefore = formatYMD(dayBeforeDate);

    const streakRestores = db
      .prepare(
        "SELECT restored_date FROM streak_restores WHERE user_id=?",
      )
      .all(user.id)
      .map((x) => x.restored_date);
    const streakRestoresSet = new Set(streakRestores);

    const activitySet = new Set(activity);
    const canRestoreStreak = activitySet.has(dayBefore) && !activitySet.has(yesterday) && !streakRestoresSet.has(yesterday);
    
    let currentStreak = 0;
    let checkDate = new Date(todayDate);
    if (!activitySet.has(today) && !streakRestoresSet.has(today)) checkDate = yesterdayDate;
    
    while(true) {
        const dateStr = formatYMD(checkDate);
        if(activitySet.has(dateStr)) {
            const prevDateStr = formatYMD(new Date(checkDate.getTime() - 86400000));
            if (streakRestoresSet.has(prevDateStr) && !activitySet.has(prevDateStr)) {
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1);
            }
        } else if (streakRestoresSet.has(dateStr)) {
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }

    const query = `
      SELECT 
        c.event_type as action, 
        c.points, 
        c.created_at,
        c.reason,
        CASE
          WHEN c.reference_type = 'post' THEN (SELECT title FROM posts WHERE id = c.reference_id)
          WHEN c.reference_type = 'response' THEN (SELECT content FROM responses WHERE id = c.reference_id)
          WHEN c.reference_type = 'document' THEN (SELECT title FROM documents WHERE id = c.reference_id)
          ELSE NULL
        END as reference_content
      FROM contribution_events c 
      WHERE c.user_id=? 
      ORDER BY c.created_at DESC
    `;
    const recent = db.prepare(query + " LIMIT 5").all(user.id);
    return json(response, 200, {
      total: Number(stats.total),
      count: Number(stats.count),
      activityDays: activity,
      streak: currentStreak,
      canRestoreStreak: canRestoreStreak,
      recentContributions: recent.map((r) => ({
        action: r.action,
        points: r.points,
        date: r.created_at.replace(' ', 'T') + 'Z',
        reason: r.reason,
        referenceContent: r.reference_content,
      })),
    });
  }
  if (method === "GET" && pathName === "/api/me/history") {
    const user = requireUser(request, response);
    if (!user) return;
    const history = db
      .prepare(`
        SELECT 
          c.event_type as action, 
          c.points, 
          c.created_at,
          c.reason,
          CASE
            WHEN c.reference_type = 'post' THEN (SELECT title FROM posts WHERE id = c.reference_id)
            WHEN c.reference_type = 'response' THEN (SELECT content FROM responses WHERE id = c.reference_id)
            WHEN c.reference_type = 'document' THEN (SELECT title FROM documents WHERE id = c.reference_id)
            ELSE NULL
          END as reference_content
        FROM contribution_events c 
        WHERE c.user_id=? 
        ORDER BY c.created_at DESC
      `)
      .all(user.id);
    return json(response, 200, {
      history: history.map((r) => ({
        action: r.action,
        points: r.points,
        date: r.created_at.replace(' ', 'T') + 'Z',
        reason: r.reason,
        referenceContent: r.reference_content,
      })),
    });
  }
  if (method === "PATCH" && pathName === "/api/me/avatar") {
    const user = requireUser(request, response);
    if (!user) return;
    if (user.avatar_changed) {
      return error(response, 400, "Bạn đã đổi avatar 1 lần rồi, không thể đổi thêm.");
    }
    const { avatar } = await readJSON(request);
    if (!avatar || typeof avatar !== "string" || avatar.trim().length === 0 || avatar.length > 8) {
      return error(response, 400, "Avatar không hợp lệ (hãy chọn 1 icon ngắn).");
    }
    db.prepare("UPDATE users SET avatar=?, avatar_changed=1 WHERE id=?").run(avatar.trim(), user.id);
    return json(response, 200, { success: true });
  }

  if (method === "PATCH" && pathName === "/api/me/profile") {
    const user = requireUser(request, response);
    if (!user || !requireCsrf(request, response, user)) return;
    const { studentId, realName, className, displayName } =
      await readJSON(request);
    db.prepare(
      "UPDATE users SET student_id=?, real_name=?, class_name=?, display_name=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(
      studentId || null,
      realName || null,
      className || null,
      displayName || user.displayName,
      user.id,
    );
    return json(response, 200, { ok: true });
  }
  if (method === "GET" && pathName === "/api/topics") {
    const viewer = sessionFrom(request);
    const rows = db
      .prepare(
        isAdmin(viewer) 
          ? `SELECT t.*, u.display_name FROM topics t LEFT JOIN users u ON u.id=t.created_by ORDER BY t.status DESC, t.created_at ASC`
          : `SELECT t.* FROM topics t WHERE t.status='approved' ORDER BY t.created_at ASC`
      )
      .all();
    return json(response, 200, {
      topics: rows.map(t => ({
        id: t.id,
        name: t.name,
        status: t.status,
        createdBy: t.display_name,
        createdAt: t.created_at.replace(' ', 'T') + 'Z',
      }))
    });
  }
  if (method === "POST" && pathName === "/api/topics") {
    const user = requireUser(request, response);
    if (!user || !requireCsrf(request, response, user)) return;
    if (!rateLimit(`topic:${user.id}`, 5, 60 * 60 * 1000))
      return error(response, 429, "Bạn đề xuất chủ đề quá nhiều, thử lại sau.");
    const { name } = await readJSON(request);
    try {
      if (typeof name !== "string" || name.trim().length < 3 || name.trim().length > 50) {
        return error(response, 400, "Tên chủ đề phải từ 3 đến 50 ký tự.");
      }
      const existing = db.prepare("SELECT * FROM topics WHERE name COLLATE NOCASE = ?").get(name.trim());
      if (existing) {
        return error(response, 400, "Chủ đề này đã tồn tại.");
      }
      const isTaOrAdmin = isAdmin(user);
      db.prepare("INSERT INTO topics (name, status, created_by) VALUES (?, ?, ?)")
        .run(name.trim(), isTaOrAdmin ? 'approved' : 'pending', user.id);
      
      return json(response, 200, { ok: true, status: isTaOrAdmin ? 'approved' : 'pending' });
    } catch (e) {
      return error(response, 500, "Lỗi khi thêm chủ đề: " + e.message);
    }
  }
  if (method === "GET" && pathName === "/api/documents") {
    const viewer = sessionFrom(request);
    const rows = db
      .prepare(
        `SELECT d.*,u.display_name FROM documents d JOIN users u ON u.id=d.submitted_by WHERE d.status='approved' OR ?='admin' ORDER BY d.created_at DESC`,
      )
      .all(viewer?.role || "student");
    return json(response, 200, {
      documents: rows.map((d) => ({
        id: d.id,
        title: d.title,
        description: d.description,
        sourceUrl: d.source_url,
        category: d.category,
        format: d.format,
        status: d.status,
        submittedBy: d.display_name,
        createdAt: d.created_at.replace(' ', 'T') + 'Z',
      })),
    });
  }
  if (method === "POST" && pathName === "/api/documents") {
    const user = requireUser(request, response);
    if (!user || !requireCsrf(request, response, user)) return;
    if (!rateLimit(`document:${user.id}`, 15, 60 * 60 * 1000))
      return error(response, 429, "Bạn đăng tài liệu quá nhiều, thử lại sau.");
    const { title, description, sourceUrl, category, format } =
      await readJSON(request);
    try {
      const link = new URL(sourceUrl);
      if (!["https:", "http:"].includes(link.protocol)) throw new Error();
      if (
        typeof title !== "string" ||
        title.trim().length < 3 ||
        typeof description !== "string" ||
        description.trim().length < 3 ||
        !["course", "reference"].includes(category) ||
        !["PDF", "Hình ảnh", "Video", "Khác"].includes(format)
      )
        throw new Error();
      const result = db
        .prepare(
          "INSERT INTO documents(submitted_by,title,description,source_url,category,format,status,reviewed_by) VALUES (?,?,?,?,?,?,?,?)",
        )
        .run(
          user.id,
          title.trim(),
          description.trim(),
          link.href,
          category,
          format,
          isAdmin(user) ? "approved" : "pending",
          isAdmin(user) ? user.id : null,
        );
      if (isAdmin(user)) {
        recordContribution(
          user.id,
          "document_approved",
          5,
          "document",
          result.lastInsertRowid,
        );
      }
      return json(response, 201, {
        id: Number(result.lastInsertRowid),
        status: isAdmin(user) ? "approved" : "pending",
      });
    } catch {
      return error(response, 400, "Thông tin tài liệu chưa hợp lệ.");
    }
  }
  if (method === "GET" && pathName === "/api/admin/overview") {
    const user = requireUser(request, response);
    if (!user || !isSuperAdmin(user))
      return user
        ? error(response, 403, "Chỉ TA/Admin mới có quyền này.")
        : undefined;
    const count = (q) => Number(db.prepare(q).get().count);
    return json(response, 200, {
      members: count("SELECT count(*) count FROM users"),
      posts: count("SELECT count(*) count FROM posts"),
      unanswered: count(
        "SELECT count(*) count FROM posts WHERE status='visible' AND id NOT IN (SELECT post_id FROM responses WHERE status='visible')",
      ),
      pendingDocuments: count(
        "SELECT count(*) count FROM documents WHERE status='pending'",
      ),
      pendingTopics: count(
        "SELECT count(*) count FROM topics WHERE status='pending'",
      ),
    });
  }
  if (method === "GET" && pathName === "/api/admin/users") {
    const user = requireUser(request, response);
    if (!user || !isSuperAdmin(user))
      return user
        ? error(response, 403, "Chỉ TA/Admin mới có quyền này.")
        : undefined;
    const users = db
      .prepare(
        "SELECT u.id, u.email, u.display_name, u.role, u.created_at, coalesce(sum(c.points), 0) as totalPoints FROM users u LEFT JOIN contribution_events c ON u.id = c.user_id GROUP BY u.id ORDER BY u.created_at DESC",
      )
      .all()
      .map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.display_name,
        role: u.role,
        createdAt: u.created_at.replace(' ', 'T') + 'Z',
        totalPoints: u.totalPoints,
      }));
    return json(response, 200, { users });
  }
  const roleMatch = pathName.match(/^\/api\/admin\/users\/(\d+)\/role$/);
  if (method === "PATCH" && roleMatch) {
    const user = requireUser(request, response);
    if (!user) return;
    if (!requireCsrf(request, response, user)) return;
    if (!isSuperAdmin(user))
      return error(response, 403, "Chỉ TA/Admin mới có quyền này.");
    const { role, reason } = await readJSON(request);
    if (!["student", "lecturer", "admin"].includes(role))
      return error(response, 400, "Vai trò không hợp lệ.");
    const targetId = Number(roleMatch[1]);
    if (targetId === user.id && role !== "admin")
      return error(
        response,
        400,
        "TA/Admin không thể tự hạ quyền tài khoản hiện tại.",
      );
    const changed = db
      .prepare(
        "UPDATE users SET role=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      )
      .run(role, targetId);
    if (!changed.changes)
      return error(response, 404, "Không tìm thấy tài khoản.");
    db.prepare(
      "INSERT INTO audit_logs(actor_id,action,subject_type,subject_id,reason) VALUES (?,?,?,?,?)",
    ).run(
      user.id,
      "role_changed",
      "user",
      targetId,
      typeof reason === "string" ? reason.slice(0, 500) : null,
    );
    return json(response, 200, { ok: true });
  }
  const moderationMatch = pathName.match(
    /^\/api\/admin\/posts\/(\d+)\/status$/,
  );
  if (method === "PATCH" && moderationMatch) {
    const user = requireUser(request, response);
    if (!user) return;
    if (!requireCsrf(request, response, user)) return;
    if (!isAdmin(user))
      return error(response, 403, "Chỉ TA/Admin mới có quyền này.");
    const { status, reason } = await readJSON(request);
    if (!["visible", "hidden", "deleted"].includes(status))
      return error(response, 400, "Trạng thái không hợp lệ.");
    const postId = Number(moderationMatch[1]);
    const post = db.prepare("SELECT author_id, status FROM posts WHERE id=?").get(postId);
    if (!post) return error(response, 404, "Không tìm thấy bài đăng.");
    
    const changed = db
      .prepare(
        "UPDATE posts SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      )
      .run(status, postId);
      
    if ((status === "hidden" || status === "deleted") && post.status === "visible") {
      recordContribution(
        post.author_id,
        `post_${status}`,
        -2,
        "post",
        postId,
        `Bài đăng bị ${status === "hidden" ? "ẩn" : "xoá"} bởi Admin`
      );
      
      const responses = db.prepare("SELECT id, author_id FROM responses WHERE post_id=? AND status='visible'").all(postId);
      for (const r of responses) {
        recordContribution(
          r.author_id,
          `response_${status}`,
          -4,
          "response",
          r.id,
          `Bài đăng gốc bị ${status === "hidden" ? "ẩn" : "xoá"} bởi Admin`
        );
        db.prepare("UPDATE responses SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(status, r.id);
      }
    }
    db.prepare(
      "INSERT INTO audit_logs(actor_id,action,subject_type,subject_id,reason) VALUES (?,?,?,?,?)",
    ).run(
      user.id,
      `post_${status}`,
      "post",
      postId,
    );
    return json(response, 200, { ok: true });
  }
  const responseModMatch = pathName.match(
    /^\/api\/admin\/responses\/(\d+)\/status$/,
  );
  if (method === "PATCH" && responseModMatch) {
    const user = requireUser(request, response);
    if (!user) return;
    if (!requireCsrf(request, response, user)) return;
    if (!isAdmin(user))
      return error(response, 403, "Chỉ TA/Admin mới có quyền này.");
    const { status, reason } = await readJSON(request);
    if (!["visible", "hidden", "deleted"].includes(status))
      return error(response, 400, "Trạng thái không hợp lệ.");
    const responseId = Number(responseModMatch[1]);
    const resp = db.prepare("SELECT author_id, status FROM responses WHERE id=?").get(responseId);
    if (!resp) return error(response, 404, "Không tìm thấy bình luận.");
    
    const changed = db
      .prepare(
        "UPDATE responses SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      )
      .run(status, responseId);
      
    if ((status === "deleted" || status === "hidden") && resp.status === "visible") {
      recordContribution(
        resp.author_id,
        `response_${status}`,
        -4,
        "response",
        responseId,
        `Bình luận bị ${status === "hidden" ? "ẩn" : "xoá"} bởi Admin`
      );
    }

    db.prepare(
      "INSERT INTO audit_logs(actor_id,action,subject_type,subject_id,reason) VALUES (?,?,?,?,?)",
    ).run(
      user.id,
      `response_${status}`,
      "response",
      responseId,
      typeof reason === "string" ? reason.slice(0, 500) : null,
    );
    return json(response, 200, { ok: true });
  }
  const pinMatch = pathName.match(/^\/api\/admin\/posts\/(\d+)\/pin$/);
  if (method === "PATCH" && pinMatch) {
    const user = requireUser(request, response);
    if (!user) return;
    if (!requireCsrf(request, response, user)) return;
    if (!isAdmin(user))
      return error(response, 403, "Chỉ TA/Admin mới có quyền này.");
    const { isPinned } = await readJSON(request);
    const postId = Number(pinMatch[1]);
    const changed = db
      .prepare(
        "UPDATE posts SET is_pinned=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
      )
      .run(isPinned ? 1 : 0, postId);
    if (!changed.changes)
      return error(response, 404, "Không tìm thấy bài đăng.");
    return json(response, 200, { ok: true });
  }
  const topicReviewMatch = pathName.match(
    /^\/api\/admin\/topics\/(\d+)\/review$/,
  );
  if (method === "PATCH" && topicReviewMatch) {
    const user = requireUser(request, response);
    if (!user) return;
    if (!requireCsrf(request, response, user)) return;
    if (!isAdmin(user))
      return error(response, 403, "Chỉ TA/Admin mới có quyền này.");
    const { action } = await readJSON(request);
    const id = Number(topicReviewMatch[1]);
    const topic = db.prepare("SELECT id FROM topics WHERE id=?").get(id);
    if (!topic) return error(response, 404, "Không tìm thấy chủ đề.");
    if (action === "approve") {
      db.prepare("UPDATE topics SET status='approved' WHERE id=?").run(id);
    } else if (action === "reject") {
      db.prepare("DELETE FROM topics WHERE id=?").run(id);
    } else {
      return error(response, 400, "Action không hợp lệ");
    }
    db.prepare(
      "INSERT INTO audit_logs(actor_id,action,subject_type,subject_id,reason) VALUES (?,?,?,?,?)",
    ).run(
      user.id,
      `topic_${action}`,
      "topic",
      id,
      null,
    );
    return json(response, 200, { ok: true });
  }
  const documentReviewMatch = pathName.match(
    /^\/api\/admin\/documents\/(\d+)\/review$/,
  );
  if (method === "PATCH" && documentReviewMatch) {
    const user = requireUser(request, response);
    if (!user) return;
    if (!requireCsrf(request, response, user)) return;
    if (!isAdmin(user))
      return error(response, 403, "Chỉ TA/Admin mới có quyền này.");
    const { status, reason } = await readJSON(request);
    if (!["approved", "rejected"].includes(status))
      return error(response, 400, "Trạng thái duyệt không hợp lệ.");
    const id = Number(documentReviewMatch[1]);
    const doc = db
      .prepare("SELECT submitted_by FROM documents WHERE id=?")
      .get(id);
    if (!doc) return error(response, 404, "Không tìm thấy tài liệu.");
    db.prepare(
      "UPDATE documents SET status=?,reviewed_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(status, user.id, id);
    if (status === "approved")
      recordContribution(
        doc.submitted_by,
        "document_approved",
        5,
        "document",
        id,
      );
    db.prepare(
      "INSERT INTO audit_logs(actor_id,action,subject_type,subject_id,reason) VALUES (?,?,?,?,?)",
    ).run(
      user.id,
      `document_${status}`,
      "document",
      id,
      typeof reason === "string" ? reason.slice(0, 500) : null,
    );
    return json(response, 200, { ok: true });
  }
  const deleteDocMatch = pathName.match(
    /^\/api\/admin\/documents\/(\d+)$/,
  );
  if (method === "DELETE" && deleteDocMatch) {
    const user = requireUser(request, response);
    if (!user) return;
    if (!requireCsrf(request, response, user)) return;
    if (!isAdmin(user))
      return error(response, 403, "Chỉ TA/Admin mới có quyền này.");
    const id = Number(deleteDocMatch[1]);
    const doc = db.prepare("SELECT id FROM documents WHERE id=?").get(id);
    if (!doc) return error(response, 404, "Không tìm thấy tài liệu.");
    db.prepare("DELETE FROM documents WHERE id=?").run(id);
    db.prepare(
      "INSERT INTO audit_logs(actor_id,action,subject_type,subject_id,reason) VALUES (?,?,?,?,?)",
    ).run(user.id, "document_deleted", "document", id, "Xóa tài liệu");
    return json(response, 200, { ok: true });
  }
  if (method === "POST" && pathName === "/api/admin/contributions/adjust") {
    const user = requireUser(request, response);
    if (!user) return;
    if (!requireCsrf(request, response, user)) return;
    if (!isSuperAdmin(user))
      return error(response, 403, "Chỉ TA/Admin mới có quyền này.");
    const { userId, points, reason } = await readJSON(request);
    if (
      !Number.isInteger(userId) ||
      !Number.isInteger(points) ||
      points === 0 ||
      Math.abs(points) > 1000 ||
      typeof reason !== "string" ||
      reason.trim().length < 5
    )
      return error(
        response,
        400,
        "Điều chỉnh điểm cần có người nhận, giá trị hợp lệ và lý do rõ ràng.",
      );
    const target = db.prepare("SELECT id FROM users WHERE id=?").get(userId);
    if (!target) return error(response, 404, "Không tìm thấy tài khoản.");
    recordContribution(
      userId,
      "admin_adjustment",
      points,
      "user",
      userId,
      reason.trim().slice(0, 500),
    );
    db.prepare(
      "INSERT INTO audit_logs(actor_id,action,subject_type,subject_id,reason) VALUES (?,?,?,?,?)",
    ).run(
      user.id,
      "contribution_adjusted",
      "user",
      userId,
      reason.trim().slice(0, 500),
    );
    return json(response, 200, { ok: true });
  }
  return error(response, 404, "Không tìm thấy API này.");
}

function serveStatic(request, response, url) {
  let relative =
    url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  if (relative.includes("\0"))
    return error(response, 400, "Đường dẫn không hợp lệ.");
  const file = path.resolve(ROOT, `.${relative}`);
  if (
    !file.startsWith(ROOT + path.sep) ||
    !fs.existsSync(file) ||
    fs.statSync(file).isDirectory()
  )
    return error(response, 404, "Không tìm thấy trang.");
  const extension = path.extname(file);
  response.writeHead(200, {
    "Content-Type": MIME[extension] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
  });
  fs.createReadStream(file).pipe(response);
}
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(
      request.url,
      `http://${request.headers.host || "localhost"}`,
    );
    if (url.pathname.startsWith("/api/"))
      return await api(request, response, url);
    if (["GET", "HEAD"].includes(request.method))
      return serveStatic(request, response, url);
    return error(response, 405, "Phương thức không được hỗ trợ.");
  } catch (e) {
    console.error(e);
    if (!response.headersSent)
      error(
        response,
        e.message === "PAYLOAD_TOO_LARGE" ? 413 : 400,
        e.message === "INVALID_JSON"
          ? "Dữ liệu gửi lên không hợp lệ."
          : "Không thể xử lý yêu cầu.",
      );
  }
// --- Cron Job Thưởng Tuần ---
setInterval(() => {
  try {
    const now = new Date();
    const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    
    let targetSunday = new Date(vnTime.getTime());
    
    if (vnTime.getUTCDay() === 0 && (vnTime.getUTCHours() < 23 || (vnTime.getUTCHours() === 23 && vnTime.getUTCMinutes() < 59))) {
      targetSunday = new Date(vnTime.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (vnTime.getUTCDay() !== 0) {
      const daysSinceSunday = vnTime.getUTCDay();
      targetSunday = new Date(vnTime.getTime() - daysSinceSunday * 24 * 60 * 60 * 1000);
    }
    
    const targetSundayDateStr = targetSunday.toISOString().split('T')[0];
    const targetMondayTime = new Date(targetSunday.getTime() - 6 * 24 * 60 * 60 * 1000);
    const targetMondayDateStr = targetMondayTime.toISOString().split('T')[0];
    
    const key = `reward_given_${targetSundayDateStr}`;
    const kv = db.prepare("SELECT value FROM kv_store WHERE key = ?").get(key);
    if (!kv) {
      const users = db.prepare(`
        SELECT user_id, count(DISTINCT activity_date) as activeDays 
        FROM activity_days 
        WHERE activity_date >= ? AND activity_date <= ?
        GROUP BY user_id
        HAVING activeDays >= 3
      `).all(targetMondayDateStr, targetSundayDateStr);
      
      const insertEvent = db.prepare(
        "INSERT INTO contribution_events(user_id,event_type,points,reference_type,reference_id,reason) VALUES (?,?,?,?,?,?)"
      );
      
      db.transaction(() => {
        for (const u of users) {
          insertEvent.run(u.user_id, 'weekly_active_reward', 10, null, null, "Thưởng điểm hoạt động tích cực tuần vừa rồi");
        }
        db.prepare("INSERT INTO kv_store(key, value) VALUES (?, '1')").run(key);
      })();
      console.log(`Cronjob: Thưởng tuần (${targetMondayDateStr} -> ${targetSundayDateStr}) đã chạy cho ${users.length} user.`);
    }
  } catch (e) {
    console.error("Cronjob thưởng tuần lỗi:", e);
  }
}, 60000);

});
server.listen(PORT, "::", () =>
  console.log(`RE:SEARCH đang chạy tại http://[::]:${PORT}`),
);
