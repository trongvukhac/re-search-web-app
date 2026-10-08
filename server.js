#!/usr/bin/env node
/* RE:SEARCH local application server — Node.js 24+ (no third-party runtime). */
const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const DATABASE_DIR = process.env.RESEARCH_DB_DIR || path.join(ROOT, "data");
const DATABASE_PATH = process.env.RESEARCH_DB_PATH || path.join(DATABASE_DIR, "research.db");
const SESSION_AGE_SECONDS = 60 * 60 * 24 * 14;

// ============================================================
// FEATURE FLAG: Kích hoạt tính năng RE:SEARCH ARENA
// ============================================================
const ARENA_ENABLED = true;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".webm": "audio/webm",
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
    edited_at TEXT,
    read_count INTEGER NOT NULL DEFAULT 0
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
  CREATE TABLE IF NOT EXISTS document_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_anonymous INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
  CREATE TABLE IF NOT EXISTS user_streak_shields (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    shields INTEGER NOT NULL DEFAULT 0,
    last_milestone_rewarded INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS study_sessions (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    goal TEXT,
    mode TEXT NOT NULL DEFAULT 'pomodoro',
    duration_minutes INTEGER NOT NULL DEFAULT 25,
    remaining_seconds INTEGER NOT NULL DEFAULT 1500,
    target_end_ms INTEGER NOT NULL DEFAULT 0,
    is_running INTEGER NOT NULL DEFAULT 0,
    started_at_ms INTEGER NOT NULL DEFAULT 0,
    last_ping_ms INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_ping TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
try { db.exec("ALTER TABLE posts ADD COLUMN read_count INTEGER NOT NULL DEFAULT 0;"); } catch (e) {}
try { db.exec("ALTER TABLE study_sessions ADD COLUMN mode TEXT NOT NULL DEFAULT 'pomodoro';"); } catch (e) {}
try { db.exec("ALTER TABLE study_sessions ADD COLUMN remaining_seconds INTEGER NOT NULL DEFAULT 1500;"); } catch (e) {}
try { db.exec("ALTER TABLE study_sessions ADD COLUMN target_end_ms INTEGER NOT NULL DEFAULT 0;"); } catch (e) {}
try { db.exec("ALTER TABLE study_sessions ADD COLUMN is_running INTEGER NOT NULL DEFAULT 0;"); } catch (e) {}
try { db.exec("ALTER TABLE study_sessions ADD COLUMN started_at_ms INTEGER NOT NULL DEFAULT 0;"); } catch (e) {}
try { db.exec("ALTER TABLE study_sessions ADD COLUMN cycle_index INTEGER NOT NULL DEFAULT 1;"); } catch (e) {}
try { db.exec("ALTER TABLE study_sessions ADD COLUMN wallpaper TEXT DEFAULT 'default';"); } catch (e) {}
try { db.exec("ALTER TABLE study_sessions ADD COLUMN aura TEXT DEFAULT 'emerald';"); } catch (e) {}
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS document_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      is_anonymous INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
} catch (e) {}
try { db.exec("ALTER TABLE document_comments ADD COLUMN edited_at TEXT;"); } catch (e) {}
try {
  db.exec(`
    INSERT INTO user_streak_shields (user_id, shields, last_milestone_rewarded, updated_at)
    SELECT id, 1, 0, CURRENT_TIMESTAMP FROM users
    ON CONFLICT(user_id) DO UPDATE SET shields = CASE WHEN shields = 0 THEN 1 ELSE shields END;
  `);
} catch (e) {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email TEXT NOT NULL COLLATE NOCASE,
      code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','used','expired','revoked')),
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      used_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_password_resets_email_status ON password_resets(email, status);
    CREATE INDEX IF NOT EXISTS idx_password_resets_code ON password_resets(code);
  `);
} catch (e) {}

// --- BẢNG DỮ LIỆU HOẠT ĐỘNG THI ĐUA HÀNG TUẦN (WEEKLY COMPETITION) ---
db.exec(`
  CREATE TABLE IF NOT EXISTS weekly_competitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    week_number INTEGER NOT NULL,
    week_key TEXT UNIQUE NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    topic_name TEXT NOT NULL,
    phase1_topic TEXT NOT NULL,
    phase2_topic TEXT NOT NULL,
    phase3_topic TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','concluded')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS competition_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    competition_id INTEGER NOT NULL REFERENCES weekly_competitions(id) ON DELETE CASCADE,
    phase INTEGER NOT NULL CHECK(phase IN (1, 2, 3)),
    question_index INTEGER NOT NULL CHECK(question_index BETWEEN 1 AND 10),
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    correct_option TEXT NOT NULL CHECK(correct_option IN ('A','B','C')),
    explanation TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(competition_id, phase, question_index)
  );

  CREATE TABLE IF NOT EXISTS competition_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_token TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    competition_id INTEGER NOT NULL REFERENCES weekly_competitions(id) ON DELETE CASCADE,
    phase INTEGER NOT NULL CHECK(phase IN (1, 2, 3)),
    attempt_number INTEGER NOT NULL CHECK(attempt_number IN (1, 2)),
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TEXT,
    initial_seconds INTEGER NOT NULL DEFAULT 600,
    remaining_seconds INTEGER NOT NULL DEFAULT 600,
    server_start_timestamp_ms INTEGER NOT NULL,
    accumulated_penalty_seconds INTEGER NOT NULL DEFAULT 0,
    current_question_index INTEGER NOT NULL DEFAULT 1,
    correct_count INTEGER NOT NULL DEFAULT 0,
    first_try_correct_count INTEGER NOT NULL DEFAULT 0,
    correct_points INTEGER NOT NULL DEFAULT 0,
    first_try_bonus INTEGER NOT NULL DEFAULT 0,
    time_points INTEGER NOT NULL DEFAULT 0,
    total_score INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress', 'completed', 'expired')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS competition_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES competition_sessions(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES competition_questions(id),
    question_index INTEGER NOT NULL,
    tries_count INTEGER NOT NULL DEFAULT 0,
    is_correct INTEGER NOT NULL DEFAULT 0,
    is_first_try INTEGER NOT NULL DEFAULT 0,
    history_json TEXT NOT NULL DEFAULT '[]',
    penalty_seconds INTEGER NOT NULL DEFAULT 0,
    is_finalized INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, question_index)
  );

  CREATE TABLE IF NOT EXISTS competition_phase_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    competition_id INTEGER NOT NULL REFERENCES weekly_competitions(id) ON DELETE CASCADE,
    phase INTEGER NOT NULL CHECK(phase IN (1, 2, 3)),
    best_session_id INTEGER REFERENCES competition_sessions(id),
    best_score INTEGER NOT NULL DEFAULT 0,
    attempts_used INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, competition_id, phase)
  );

  CREATE TABLE IF NOT EXISTS competition_weekly_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    competition_id INTEGER NOT NULL REFERENCES weekly_competitions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rank INTEGER NOT NULL,
    total_stars INTEGER NOT NULL,
    phases_participated INTEGER NOT NULL,
    participation_bonus INTEGER NOT NULL,
    activity_points_awarded INTEGER NOT NULL,
    shields_awarded INTEGER NOT NULL,
    awarded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(competition_id, user_id)
  );
`);
try { db.exec("ALTER TABLE competition_sessions ADD COLUMN is_paused INTEGER NOT NULL DEFAULT 0;"); } catch (e) {}
try { db.exec("ALTER TABLE competition_sessions ADD COLUMN paused_remaining_seconds INTEGER;"); } catch (e) {}
try { db.exec("ALTER TABLE competition_sessions ADD COLUMN exit_count INTEGER NOT NULL DEFAULT 0;"); } catch (e) {}
try { db.exec("ALTER TABLE competition_sessions ADD COLUMN is_on_time INTEGER NOT NULL DEFAULT 0;"); } catch (e) {}
try { db.exec("ALTER TABLE competition_sessions ADD COLUMN on_time_bonus INTEGER NOT NULL DEFAULT 0;"); } catch (e) {}
try { db.exec("ALTER TABLE competition_phase_results ADD COLUMN on_time_bonus INTEGER NOT NULL DEFAULT 0;"); } catch (e) {}

const defaultTopics = [
  "Đề tài", "Lý thuyết", "Phương pháp", 
  "Dữ liệu & phân tích", "Viết nghiên cứu", 
  "Tài liệu", "Thảo luận chung"
];
for (const t of defaultTopics) {
  db.prepare(`INSERT OR IGNORE INTO topics (name, status) VALUES (?, 'approved')`).run(t);
}

const attempts = new Map();
function getClientIp(request) {
  const flyIp = request.headers["fly-client-ip"];
  if (flyIp && typeof flyIp === "string") return flyIp.trim();
  const forwarded = request.headers["x-forwarded-for"];
  if (forwarded && typeof forwarded === "string") {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  return request.socket?.remoteAddress || "local";
}
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
const recentCheers = [];
function cleanupCheers() {
  const now = Date.now();
  while (recentCheers.length > 0 && now - recentCheers[0].timestamp > 60000) {
    recentCheers.shift();
  }
}
const readCooldowns = new Map();
function canRecordRead(identifier, postId) {
  const key = `${identifier}:${postId}`;
  const now = Date.now();
  const lastRead = readCooldowns.get(key);
  if (lastRead && now - lastRead < 30 * 60 * 1000) {
    return false;
  }
  readCooldowns.set(key, now);
  if (readCooldowns.size > 5000) {
    for (const [k, time] of readCooldowns.entries()) {
      if (now - time > 35 * 60 * 1000) readCooldowns.delete(k);
    }
  }
  return true;
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

function getStreakTier(streak) {
  const s = Number(streak) || 0;
  if (s >= 50) return 5;
  if (s >= 30) return 4;
  if (s >= 14) return 3;
  if (s >= 7) return 2;
  if (s >= 3) return 1;
  return 0;
}

function calculateUserStreak(userId, todayDate, formatYMD) {
  if (!userId) {
    return {
      streak: 0,
      streakTier: 0,
      shields: 0,
      autoShieldUsed: false,
      streakStartDate: "9999-99-99",
      streakStartCreatedAt: "9999-99-99",
    };
  }

  const uRow = db.prepare("SELECT role FROM users WHERE id = ?").get(userId);
  if (uRow && (uRow.role === "admin" || uRow.role === "ta")) {
    return {
      streak: 52,
      streakTier: 5,
      shields: 3,
      autoShieldUsed: false,
      streakStartDate: "2026-08-01",
      streakStartCreatedAt: "2026-08-01T00:00:00Z",
    };
  }

  if (!todayDate) {
    todayDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  }
  if (!formatYMD) {
    formatYMD = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
  }

  const today = formatYMD(todayDate);
  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = formatYMD(yesterdayDate);
  const dayBeforeDate = new Date(todayDate);
  dayBeforeDate.setDate(dayBeforeDate.getDate() - 2);
  const dayBefore = formatYMD(dayBeforeDate);

  let shieldRow = db.prepare("SELECT * FROM user_streak_shields WHERE user_id = ?").get(userId);
  if (!shieldRow) {
    try {
      db.prepare("INSERT OR IGNORE INTO user_streak_shields (user_id, shields, last_milestone_rewarded) VALUES (?, 1, 0)").run(userId);
      shieldRow = db.prepare("SELECT * FROM user_streak_shields WHERE user_id = ?").get(userId) || { user_id: userId, shields: 1, last_milestone_rewarded: 0 };
    } catch (e) {
      shieldRow = { user_id: userId, shields: 1, last_milestone_rewarded: 0 };
    }
  }

  const activities = db
    .prepare("SELECT activity_date, created_at FROM activity_days WHERE user_id=? ORDER BY activity_date DESC")
    .all(userId);
  const streakRestores = db
    .prepare("SELECT restored_date, created_at FROM streak_restores WHERE user_id=?")
    .all(userId);

  const activityMap = new Map();
  activities.forEach(a => activityMap.set(a.activity_date, a.created_at));
  const restoreMap = new Map();
  streakRestores.forEach(r => restoreMap.set(r.restored_date, r.created_at));

  // Auto-shield logic: if missed yesterday, active on dayBefore or dayBefore was restored, and have shields > 0
  let autoShieldUsed = false;
  if (!activityMap.has(yesterday) && !restoreMap.has(yesterday) && shieldRow.shields > 0) {
    const wasActiveBefore = activityMap.has(dayBefore) || restoreMap.has(dayBefore);
    const dayBefore3 = formatYMD(new Date(todayDate.getTime() - 3 * 86400000));
    const usedConsecutiveRestores = restoreMap.has(dayBefore) && restoreMap.has(dayBefore3);

    if (wasActiveBefore && !usedConsecutiveRestores) {
      db.prepare("INSERT OR IGNORE INTO streak_restores(user_id, restored_date) VALUES (?,?)").run(userId, yesterday);
      restoreMap.set(yesterday, new Date().toISOString());
      shieldRow.shields = Math.max(0, shieldRow.shields - 1);
      db.prepare("UPDATE user_streak_shields SET shields = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(shieldRow.shields, userId);
      autoShieldUsed = true;
    }
  }

  let currentStreak = 0;
  let streakStartDate = null;
  let streakStartCreatedAt = null;

  let checkDate = new Date(todayDate);
  if (!activityMap.has(today) && !restoreMap.has(today)) {
    checkDate = yesterdayDate;
  }

  while (true) {
    const dateStr = formatYMD(checkDate);
    if (activityMap.has(dateStr)) {
      currentStreak++;
      streakStartDate = dateStr;
      streakStartCreatedAt = activityMap.get(dateStr) || dateStr;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (restoreMap.has(dateStr)) {
      streakStartDate = dateStr;
      streakStartCreatedAt = restoreMap.get(dateStr) || dateStr;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Check milestones and grant new shields
  const milestones = [
    { streak: 7, reward: 1 },
    { streak: 14, reward: 1 },
    { streak: 30, reward: 2 },
    { streak: 50, reward: 2 },
  ];

  let newShields = 0;
  let highestPassed = shieldRow.last_milestone_rewarded || 0;
  for (const m of milestones) {
    if (currentStreak >= m.streak && highestPassed < m.streak) {
      newShields += m.reward;
      if (m.streak > highestPassed) highestPassed = m.streak;
    }
  }

  if (newShields > 0) {
    shieldRow.shields = Math.min(3, shieldRow.shields + newShields);
    shieldRow.last_milestone_rewarded = highestPassed;
    db.prepare("UPDATE user_streak_shields SET shields = ?, last_milestone_rewarded = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(shieldRow.shields, highestPassed, userId);
  }

  const streakTier = getStreakTier(currentStreak);

  return {
    streak: currentStreak,
    streakTier,
    shields: shieldRow.shields,
    autoShieldUsed,
    streakStartDate: streakStartDate || "9999-99-99",
    streakStartCreatedAt: streakStartCreatedAt || "9999-99-99",
  };
}

function getAuthorStreakTier(userId) {
  if (!userId) return 0;
  try {
    const info = calculateUserStreak(userId);
    return info.streakTier || 0;
  } catch (e) {
    return 0;
  }
}

function publicUser(user, streakInfo = null) {
  const info = streakInfo || (user.id ? calculateUserStreak(user.id) : { streak: 0, streakTier: 0, shields: 0 });
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
    streak: info.streak || 0,
    streakTier: info.streakTier || 0,
    shields: info.shields || 0,
  };
}
function requireUser(request, response) {
  const session = sessionFrom(request);
  if (!session) {
    error(response, 401, "Bạn cần đăng nhập để thực hiện thao tác này.");
    return null;
  }
  if (session.locked_until) {
    const lockStr = session.locked_until.endsWith("Z") ? session.locked_until : session.locked_until.replace(" ", "T") + "Z";
    if (Date.parse(lockStr) > Date.now()) {
      error(response, 403, "Tài khoản của bạn đã bị khóa 12 tiếng do hành vi tiêu cực.");
      return null;
    }
  }
  return session;
}
function requireCsrf(request, response, session) {
  const headerToken = request.headers["x-csrf-token"];
  if (headerToken && headerToken === session.csrf_token) {
    return true;
  }
  const isSameOrigin = (
    request.headers["sec-fetch-site"] === "same-origin" ||
    request.headers["sec-fetch-site"] === "none"
  );
  if (isSameOrigin && session.csrf_token) {
    return true;
  }
  error(
    response,
    403,
    "Phiên làm việc không hợp lệ. Vui lòng tải lại trang.",
  );
  return false;
}
function isAdmin(user) {
  return Boolean(user && (user.role === "admin" || user.role === "ta" || user.role === "lecturer"));
}
function isSuperAdmin(user) {
  return Boolean(user && (user.role === "admin" || user.role === "ta"));
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
  const limits = { post_created: 5, response_created: 10, document_approved: 5, document_discussion: 20 };
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
function isSecureRequest(request) {
  if (process.env.FLY_APP_NAME) return true;
  if (!request) return false;
  return (
    request.headers["x-forwarded-proto"] === "https" ||
    Boolean(request.socket && request.socket.encrypted)
  );
}

function createSession(response, userId, request = null) {
  const token = randomToken(),
    csrf = randomToken(),
    expiresAt = new Date(Date.now() + SESSION_AGE_SECONDS * 1000).toISOString();
  db.prepare(
    "INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES (?,?,?,?)",
  ).run(sha(token), userId, csrf, expiresAt);
  const secureAttr = isSecureRequest(request) ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `research_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_AGE_SECONDS}${secureAttr}`,
  );
  return csrf;
}
function clearSession(request, response) {
  const token = parseCookies(request).research_session;
  if (token)
    db.prepare("DELETE FROM sessions WHERE token_hash=?").run(sha(token));
  const secureAttr = isSecureRequest(request) ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `research_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureAttr}`,
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
        ? { displayName: "Sinh viên ẩn danh", initials: "?", streakTier: 0 }
        : {
            id: row.author_id,
            displayName: row.display_name,
            initials: row.avatar || getAvatarEmoji(row.display_name),
            role: row.role,
            streakTier: getAuthorStreakTier(row.author_id),
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
    readCount: Number(row.read_count || 0),
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

/* --- DIRECT AUDIO STREAMING PROXY (GitHub Releases -> Azure Blob Storage with Range / Partial Content support) --- */
const AUDIO_TRACK_URLS = {
  // 4 Âm thanh môi trường
  env_1: "https://github.com/trongvukhac/re-search-web-app/releases/download/v1.0-audio/Campfire.by.the.Forest.Riverbank.mp3",
  env_2: "https://github.com/trongvukhac/re-search-web-app/releases/download/v1.0-audio/tropical.island-wave.and.bird.sounds.mp3",
  env_3: "https://github.com/trongvukhac/re-search-web-app/releases/download/v1.0-audio/Cafe.Ambience.mp3",
  env_4: "https://github.com/trongvukhac/re-search-web-app/releases/download/v1.0-audio/NYC.Sunrise.Morning.Traffic.Sounds.mp3",

  // 9 Âm thanh phối hợp
  mix_1: "https://github.com/trongvukhac/re-search-web-app/releases/download/v1.0-audio/N.c.ch.y.mp3",
  mix_2: "https://github.com/trongvukhac/re-search-web-app/releases/download/v1.0-audio/M.a.rao.mp3",
  mix_3: "https://github.com/trongvukhac/re-search-web-app/releases/download/v1.0-audio/Ti.ng.chuong.gio.mp3",
  mix_4: "https://github.com/trongvukhac/re-search-web-app/releases/download/v1.0-audio/Ti.ng.chim.hot.mp3",
  mix_5: "https://github.com/trongvukhac/re-search-web-app/releases/download/v1.0-audio/Ti.ng.la.xao.x.c.mp3",
  mix_6: "https://github.com/trongvukhac/re-search-web-app/releases/download/v1.0-audio/Ti.ng.gio.th.i.mp3",
  mix_7: "https://github.com/trongvukhac/re-search-web-app/releases/download/v1.0-audio/Ti.ng.d.keu.mp3",
  mix_8: "https://github.com/trongvukhac/re-search-web-app/releases/download/v1.0-audio/Ti.ng.l.a.chay.mp3",
  mix_9: "https://github.com/trongvukhac/re-search-web-app/releases/download/v1.0-audio/Ti.ng.song.bi.n.mp3",

  // 4 Âm nhạc tập trung
  music_1: "https://github.com/trongvukhac/re-search-web-app/releases/download/v1.0-audio/After.Hours.Moody.R.B.Mix.mp3",
  music_2: "https://github.com/trongvukhac/re-search-web-app/releases/download/v1.0-audio/soft.and.smooth.japanese.jazz.mp3",
  music_3: "https://github.com/trongvukhac/re-search-web-app/releases/download/v1.0-audio/summer.lofi.mp3",
  music_4: "https://github.com/trongvukhac/re-search-web-app/releases/download/v1.0-audio/1.Hour1990s.Tokyo.City.Pop.mp3"
};

const azureAudioUrlCache = new Map(); // trackId -> { url: string, expiresAt: number }

function resolveGitHubRedirect(ghUrl) {
  return new Promise((resolve, reject) => {
    const req = https.get(ghUrl, (res) => {
      res.resume(); // Ensure stream data is consumed to free the socket
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(res.headers.location);
      } else if (res.statusCode === 200) {
        resolve(ghUrl);
      } else {
        reject(new Error(`GitHub redirect failed with status ${res.statusCode}`));
      }
    });
    req.setTimeout(10000, () => {
      req.destroy(new Error("GitHub redirect request timed out"));
    });
    req.on("error", reject);
  });
}

async function getAudioAzureUrl(trackId, forceRefresh = false) {
  if (!forceRefresh) {
    const cached = azureAudioUrlCache.get(trackId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url;
    }
  }
  const ghUrl = AUDIO_TRACK_URLS[trackId];
  if (!ghUrl) return null;
  try {
    const directUrl = await resolveGitHubRedirect(ghUrl);
    azureAudioUrlCache.set(trackId, {
      url: directUrl,
      expiresAt: Date.now() + 10 * 60 * 1000 // Cache 10 mins (Azure SAS token typically expires in 30-60 mins)
    });
    return directUrl;
  } catch (err) {
    console.error(`Failed to resolve GitHub redirect for ${trackId}:`, err.message);
    return null;
  }
}

async function fetchAzureAudioStream(trackId, reqMethod, headers, isRetry = false) {
  const directUrl = await getAudioAzureUrl(trackId, isRetry);
  if (!directUrl) return null;

  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(directUrl);
      const options = {
        method: reqMethod,
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers
      };

      const azureReq = https.request(options, async (azureRes) => {
        // If expired SAS token or forbidden, retry once with a fresh URL
        if ((azureRes.statusCode === 403 || azureRes.statusCode === 401) && !isRetry) {
          azureAudioUrlCache.delete(trackId);
          try {
            const retried = await fetchAzureAudioStream(trackId, reqMethod, headers, true);
            return resolve(retried);
          } catch (e) {
            return resolve({ statusCode: azureRes.statusCode, headers: azureRes.headers, stream: azureRes, req: azureReq });
          }
        }
        resolve({ statusCode: azureRes.statusCode, headers: azureRes.headers, stream: azureRes, req: azureReq });
      });

      azureReq.setTimeout(15000, () => {
        azureReq.destroy(new Error("Azure audio stream timed out"));
      });

      azureReq.on("error", (err) => {
        if (!isRetry) {
          azureAudioUrlCache.delete(trackId);
        }
        reject(err);
      });

      azureReq.end();
    } catch (e) {
      reject(e);
    }
  });
}

async function streamAudioTrack(request, response, trackId) {
  try {
    const directUrl = await getAudioAzureUrl(trackId);
    if (!directUrl) {
      return error(response, 404, "Không tìm thấy tệp âm thanh.");
    }

    // Direct 302 redirect with CORS and edge cache headers:
    // Enables the browser to stream directly from Azure Blob CDN with multi-threaded byte-ranges,
    // achieving sub-50ms TTFB and instant playback with zero server latency!
    response.writeHead(302, {
      "Location": directUrl,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Range, Accept-Encoding",
      "Access-Control-Expose-Headers": "Location, Content-Range, Content-Length, Accept-Ranges",
      "Cache-Control": "public, max-age=1200",
      "X-Content-Type-Options": "nosniff"
    });
    response.end();
  } catch (err) {
    console.error(`Audio stream handler error (${trackId}):`, err.message);
    if (!response.headersSent) {
      error(response, 500, "Không thể tải tệp âm thanh.");
    }
  }
}

async function prewarmAudioUrls() {
  const trackIds = Object.keys(AUDIO_TRACK_URLS);
  for (const trackId of trackIds) {
    try {
      await getAudioAzureUrl(trackId, true);
    } catch (e) {}
  }
}
prewarmAudioUrls();
setInterval(prewarmAudioUrls, 20 * 60 * 1000);

// =========================================================================
// HOẠT ĐỘNG THI ĐUA ĐỊNH KỲ HÀNG TUẦN (WEEKLY COMPETITION MODULE)
// =========================================================================

let simulatedTimeOffsetMs = 0;

function getVietnamNow() {
  const effectiveMs = Date.now() + simulatedTimeOffsetMs;
  return new Date(new Date(effectiveMs).toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
}

function getVietnamRealNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
}

function getVietnamTimestampMs() {
  return Date.now() + simulatedTimeOffsetMs;
}

function formatYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getWeekRange(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  // ISO week calculation
  const target = new Date(monday.valueOf());
  const dayNr = (monday.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target) / 604800000);
  const year = monday.getFullYear();
  const weekKey = `${year}-W${String(weekNumber).padStart(2, "0")}`;

  return { monday, sunday, mondayStr: formatYMD(monday), sundayStr: formatYMD(sunday), year, weekNumber, weekKey };
}

function getPhaseForDayOfWeek(dayOfWeek) {
  if (dayOfWeek === 1 || dayOfWeek === 2) return 1;
  if (dayOfWeek === 3 || dayOfWeek === 4) return 2;
  if (dayOfWeek === 5 || dayOfWeek === 6) return 3;
  return 0; // Sunday
}

const SAMPLE_COMPETITION_QUESTIONS = {
  1: [ // Giai đoạn 1: Thứ Hai – Thứ Ba
    {
      index: 1,
      text: "Khoảng trống nghiên cứu (Research Gap) trong bài báo khoa học là gì?",
      optionA: "Vùng kiến thức chưa được giải quyết hoặc chưa được khám phá đầy đủ trong các tài liệu trước đây.",
      optionB: "Khoảng cách thời gian nghỉ giữa hai dự án nghiên cứu khoa học.",
      optionC: "Số trang tài liệu còn thiếu trong báo cáo nghiệm thu đề tài.",
      correct: "A",
      explanation: "Research Gap là vấn đề hoặc khoảng trống tri thức mà các công trình nghiên cứu trước chưa giải quyết trọn vẹn."
    },
    {
      index: 2,
      text: "Biến độc lập (Independent Variable) trong mô hình nghiên cứu có vai trò gì?",
      optionA: "Biến chịu sự tác động và thay đổi theo sự biến thiên của biến khác.",
      optionB: "Biến được xem là nguyên nhân hoặc yếu tố chủ động tạo ra sự thay đổi ở biến phụ thuộc.",
      optionC: "Biến hoàn toàn không có bất kỳ mối tương quan nào trong mô hình nghiên cứu.",
      correct: "B",
      explanation: "Biến độc lập là yếu tố tác động, nguyên nhân làm thay đổi giá trị của biến phụ thuộc."
    },
    {
      index: 3,
      text: "Mục đích quan trọng nhất của việc Tổng quan tài liệu (Literature Review) là gì?",
      optionA: "Tóm tắt lại toàn bộ sách giáo khoa nhập môn của chuyên ngành.",
      optionB: "Sao chép lại nguyên văn bảng số liệu của các nghiên cứu trước để tiết kiệm chi phí.",
      optionC: "Hệ thống hóa nền tảng lý thuyết và xác định khoảng trống nghiên cứu cần giải quyết.",
      correct: "C",
      explanation: "Tổng quan tài liệu giúp xác định cơ sở lý thuyết, các nghiên cứu tương tự và tìm ra khoảng trống tri thức cần thực hiện."
    },
    {
      index: 4,
      text: "Phương pháp chọn mẫu ngẫu nhiên đơn giản (Simple Random Sampling) có đặc điểm nào?",
      optionA: "Mọi phần tử trong tổng thể đều có xác suất được chọn vào mẫu như nhau.",
      optionB: "Chỉ chọn những đối tượng thuận tiện nhất ở gần người nghiên cứu.",
      optionC: "Chọn đối tượng dựa trên sự quen biết cá nhân của nghiên cứu viên.",
      correct: "A",
      explanation: "Chọn mẫu ngẫu nhiên đơn giản đảm bảo mọi phần tử trong quần thể đều có cơ hội được chọn ngang nhau."
    },
    {
      index: 5,
      text: "Giả thuyết không (Null Hypothesis - H0) thường phát biểu điều gì?",
      optionA: "Có sự khác biệt hoặc mối quan hệ tác động rất lớn giữa các biến số.",
      optionB: "Không có sự khác biệt hoặc không có mối liên hệ có ý nghĩa thống kê giữa các biến.",
      optionC: "Đề tài nghiên cứu đã thất bại và không thể thu thập dữ liệu.",
      correct: "B",
      explanation: "Giả thuyết không (H0) giả định rằng không có sự khác biệt hoặc không có tác động giữa các nhóm khảo sát."
    },
    {
      index: 6,
      text: "Độ tin cậy (Reliability) của thang đo phản ánh tiêu chí nào sau đây?",
      optionA: "Mức độ thang đo đo đúng bản chất của khái niệm cần đo lường.",
      optionB: "Mức độ ổn định và tính nhất quán của kết quả qua các lần đo lường lặp lại.",
      optionC: "Tốc độ phản hồi khảo sát trung bình của người tham gia.",
      correct: "B",
      explanation: "Độ tin cậy thể hiện tính nhất quán và khả năng lặp lại kết quả của công cụ đo lường."
    },
    {
      index: 7,
      text: "Phương pháp nghiên cứu định tính (Qualitative Research) phù hợp nhất khi nào?",
      optionA: "Khi muốn đo lường chính xác số liệu và kiểm định mô hình định lượng diện rộng.",
      optionB: "Khi muốn khám phá sâu hiện tượng mới, tìm hiểu ý nghĩa, động cơ và bối cảnh trải nghiệm.",
      optionC: "Khi muốn khảo sát tự động hàng triệu đối tượng trong thời gian 1 giờ.",
      correct: "B",
      explanation: "Nghiên cứu định tính tập trung vào việc hiểu sâu bản chất, hành vi, động cơ và bối cảnh hiện tượng."
    },
    {
      index: 8,
      text: "Tính giá trị nội tại (Internal Validity) của nghiên cứu đề cập đến điều gì?",
      optionA: "Mức độ kết luận về mối quan hệ nhân quả có thực sự đúng và không bị biến nhiễu chi phối.",
      optionB: "Khả năng mở rộng và khái quát hóa kết quả nghiên cứu ra toàn bộ thế giới.",
      optionC: "Tổng số nguồn tài trợ tài chính được duyệt nội bộ cho đề tài.",
      correct: "A",
      explanation: "Tính giá trị nội tại phản ánh độ tin cậy của mối quan hệ nhân quả giữa biến độc lập và phụ thuộc."
    },
    {
      index: 9,
      text: "Thiết kế nghiên cứu cắt ngang (Cross-sectional Study) có đặc trưng cơ bản nào?",
      optionA: "Thu thập dữ liệu từ các đối tượng nghiên cứu tại một thời điểm xác định duy nhất.",
      optionB: "Theo dõi và đo lường sự biến đổi của một nhóm đối tượng liên tục trong nhiều năm.",
      optionC: "Thực hiện thí nghiệm có đối chứng lặp đi lặp lại trong phòng lab kín.",
      correct: "A",
      explanation: "Nghiên cứu cắt ngang thu thập dữ liệu tại một thời điểm xác định nhằm mô tả thực trạng hiện tượng."
    },
    {
      index: 10,
      text: "Nguyên tắc đạo đức cốt lõi hàng đầu trong nghiên cứu có người tham gia là gì?",
      optionA: "Công khai toàn bộ danh tính và số điện thoại của người tham gia lên báo cáo.",
      optionB: "Sự đồng thuận tự nguyện có hiểu biết (Informed Consent) và bảo mật thông tin cá nhân.",
      optionC: "Ép buộc người tham gia phải trả lời đúng theo kỳ vọng của nghiên cứu viên.",
      correct: "B",
      explanation: "Sự đồng thuận có hiểu biết (Informed Consent) là nguyên tắc đạo đức cốt lõi trong nghiên cứu với con người."
    }
  ],
  2: [ // Giai đoạn 2: Thứ Tư – Thứ Năm
    {
      index: 1,
      text: "Trong kiểm định thống kê, giá trị p-value < 0.05 (mức ý nghĩa 5%) cho thấy điều gì?",
      optionA: "Bác bỏ giả thuyết không H0 và kết luận kết quả có ý nghĩa thống kê.",
      optionB: "Chấp nhận giả thuyết H0 và kết luận không có sự khác biệt nào.",
      optionC: "Dữ liệu khảo sát không hợp lệ và phải xóa bỏ toàn bộ tập mẫu.",
      correct: "A",
      explanation: "p-value < 0.05 chỉ ra rằng xác suất xảy ra ngẫu nhiên là rất nhỏ, do đó bác bỏ H0 để chấp nhận H1."
    },
    {
      index: 2,
      text: "Hệ số tương quan Pearson (r) có giá trị nằm trong khoảng giới hạn nào?",
      optionA: "Từ 0 đến +1.",
      optionB: "Từ -1 đến +1.",
      optionC: "Từ -100 đến +100.",
      correct: "B",
      explanation: "Hệ số tương quan Pearson luôn nằm trong khoảng [-1, 1], với -1 là tương quan nghịch hoàn hảo và +1 là thuận hoàn hảo."
    },
    {
      index: 3,
      text: "Hệ số Cronbach's Alpha thường được dùng trong phân tích dữ liệu nhằm mục đích gì?",
      optionA: "Đánh giá độ tin cậy và sự nhất quán nội tại (Internal Consistency) của thang đo.",
      optionB: "Đo lường thời gian chạy thuật toán hồi quy của máy tính.",
      optionC: "Tính toán giá trị trung bình cộng của biến định lượng.",
      correct: "A",
      explanation: "Cronbach's Alpha đo lường độ tin cậy và sự nhất quán nội tại giữa các câu hỏi trong cùng một thang đo."
    },
    {
      index: 4,
      text: "Kiểm định Independent Samples T-Test phù hợp để sử dụng trong trường hợp nào?",
      optionA: "So sánh giá trị trung bình của 2 nhóm mẫu độc lập trên một biến định lượng liên tục.",
      optionB: "So sánh tỷ lệ phần trăm của 10 nhóm định danh khác nhau.",
      optionC: "Dự báo giá trị của chuỗi thời gian trong tương lai 5 năm.",
      correct: "A",
      explanation: "Independent Samples T-Test dùng để so sánh trung bình (mean) giữa hai nhóm mẫu riêng biệt độc lập."
    },
    {
      index: 5,
      text: "Phân tích phương sai một yếu tố (One-Way ANOVA) được sử dụng khi nào?",
      optionA: "So sánh giá trị trung bình giữa 3 nhóm mẫu độc lập trở lên.",
      optionB: "Kiểm tra mối quan hệ phi tuyến tính giữa 2 biến nhị phân.",
      optionC: "Tính toán khoảng cách Euclid giữa các cụm dữ liệu.",
      correct: "A",
      explanation: "ANOVA một yếu tố cho phép so sánh giá trị trung bình giữa 3 nhóm mẫu độc lập trở lên."
    },
    {
      index: 6,
      text: "Trong phân tích hồi quy tuyến tính, hệ số xác định R-squared (R²) cho biết điều gì?",
      optionA: "Tỷ lệ phần trăm sự biến thiên của biến phụ thuộc được giải thích bởi các biến độc lập.",
      optionB: "Số lượng quan sát tối thiểu cần có để chạy mô hình.",
      optionC: "Sai số ngẫu nhiên của mô hình phân tích.",
      correct: "A",
      explanation: "R² (Hệ số xác định) phản ánh mức độ phù hợp của mô hình, biểu thị phần trăm biến thiên của Y do các X giải thích."
    },
    {
      index: 7,
      text: "Điểm dị biệt (Outlier) trong tập dữ liệu khảo sát là gì?",
      optionA: "Giá trị nằm cách biệt bất thường so với phần lớn các quan sát khác trong mẫu dữ liệu.",
      optionB: "Giá trị xuất hiện với tần số nhiều nhất trong mẫu (Mode).",
      optionC: "Dòng dữ liệu bị bỏ trống do người dùng không nhập thông tin.",
      correct: "A",
      explanation: "Outlier là các giá trị ngoại lai, quá lớn hoặc quá nhỏ bất thường so với phân phối dữ liệu chung."
    },
    {
      index: 8,
      text: "Thang đo Likert 5 mức độ (từ 'Rất không đồng ý' đến 'Rất đồng ý') thuộc loại thang đo nào?",
      optionA: "Thang đo định danh (Nominal Scale).",
      optionB: "Thang đo thứ bậc (Ordinal Scale).",
      optionC: "Thang đo tỷ lệ tuyệt đối (Ratio Scale).",
      correct: "B",
      explanation: "Thang đo Likert sắp xếp theo thứ tự mức độ thái độ/ý kiến nên bản chất là thang đo thứ bậc (Ordinal)."
    },
    {
      index: 9,
      text: "Độ lệch chuẩn (Standard Deviation) đo lường đặc trưng thống kê nào sau đây?",
      optionA: "Mức độ phân tán của các giá trị quan sát xung quanh giá trị trung bình.",
      optionB: "Tổng số lượng câu hỏi có trong bảng khảo sát.",
      optionC: "Thời gian trung bình để hoàn thành một lượt khảo sát.",
      correct: "A",
      explanation: "Độ lệch chuẩn phản ánh độ phân tán hay mức độ biến động của các quan sát so với giá trị trung bình."
    },
    {
      index: 10,
      text: "Hiện tượng Đa cộng tuyến (Multicollinearity) trong mô hình hồi quy xảy ra khi nào?",
      optionA: "Các biến độc lập trong mô hình có mối tương quan tuyến tính rất cao với nhau.",
      optionB: "Kích thước mẫu khảo sát vượt quá 10.000 đối tượng.",
      optionC: "Biến phụ thuộc có giá trị hoàn toàn không đổi.",
      correct: "A",
      explanation: "Đa cộng tuyến xảy ra khi giữa các biến độc lập có tương quan cao, làm sai lệch ước lượng hệ số hồi quy."
    }
  ],
  3: [ // Giai đoạn 3: Thứ Sáu – Thứ Bảy
    {
      index: 1,
      text: "Cấu trúc IMRaD phổ biến trong bài báo khoa học quốc tế gồm những phần cốt lõi nào?",
      optionA: "Introduction, Methodology, Results, and Discussion.",
      optionB: "Index, Main text, References, and Data analysis.",
      optionC: "Information, Motivation, Research, and Documentation.",
      correct: "A",
      explanation: "IMRaD gồm 4 phần cốt lõi: Mở đầu (Introduction), Phương pháp (Methods), Kết quả (Results) và Thảo luận (Discussion)."
    },
    {
      index: 2,
      text: "Hành vi Đạo văn (Plagiarism) trong công bố học thuật được định nghĩa là gì?",
      optionA: "Trích dẫn đầy đủ nguồn gốc bài báo của tác giả khác theo đúng chuẩn quy định.",
      optionB: "Sử dụng ý tưởng, từ ngữ hoặc kết quả của người khác mà không trích dẫn nguồn hợp lệ.",
      optionC: "Hợp tác nghiên cứu với tác giả thuộc trường đại học khác.",
      correct: "B",
      explanation: "Đạo văn là việc sử dụng công trình, ý tưởng hoặc từ ngữ của người khác mà không trích dẫn hoặc thừa nhận quyền tác giả."
    },
    {
      index: 3,
      text: "Mã định danh số DOI (Digital Object Identifier) trên ấn phẩm khoa học dùng để làm gì?",
      optionA: "Cung cấp đường liên kết truy cập vĩnh viễn và duy nhất đến bài báo trên internet.",
      optionB: "Giới hạn số lượt xem bài báo chỉ dành riêng cho tác giả.",
      optionC: "Tính toán số tiền bản quyền tác giả phải nộp hàng năm.",
      correct: "A",
      explanation: "DOI là chuỗi ký tự duy nhất cung cấp liên kết truy cập cố định và đáng tin cậy đến ấn phẩm khoa học trực tuyến."
    },
    {
      index: 4,
      text: "Quy trình phản biện kín kép (Double-Blind Peer Review) có đặc điểm nào sau đây?",
      optionA: "Cả tác giả bài báo và người phản biện đều được giấu danh tính đối với nhau.",
      optionB: "Tác giả biết người phản biện nhưng người phản biện không biết tác giả.",
      optionC: "Bài viết được công khai bình chọn trực tiếp trên diễn đàn mở.",
      correct: "A",
      explanation: "Double-blind review ẩn danh tính của cả hai bên nhằm đảm bảo tính khách quan và công bằng tối đa trong đánh giá học thuật."
    },
    {
      index: 5,
      text: "Theo chuẩn trích dẫn APA 7th, định dạng trích dẫn trong văn bản (In-text citation) nào là đúng?",
      optionA: "[Nguyen, 2023, tap 1]",
      optionB: "(Nguyen, 2023) hoặc Nguyen (2023)",
      optionC: "<Citation: Nguyen_2023>",
      correct: "B",
      explanation: "Chuẩn APA 7th quy định trích dẫn họ tác giả và năm xuất bản trong ngoặc đơn dạng (Author, Year)."
    },
    {
      index: 6,
      text: "Phần Tóm tắt bài báo (Abstract) có dung lượng phổ biến khoảng bao nhiêu từ?",
      optionA: "Từ 150 đến 250 từ.",
      optionB: "Từ 1.000 đến 2.000 từ.",
      optionC: "Chỉ đúng 1 câu duy nhất.",
      correct: "A",
      explanation: "Tóm tắt bài báo (Abstract) thường cô đọng toàn bộ nghiên cứu trong khoảng 150 - 250 từ."
    },
    {
      index: 7,
      text: "Chỉ số H-index của một nhà khoa học thể hiện điều gì?",
      optionA: "Số năm thâm niên làm việc tại các viện nghiên cứu khoa học.",
      optionB: "Số lượng bài báo (h) đã được trích dẫn ít nhất (h) lần, đo lường năng suất và tầm ảnh hưởng.",
      optionC: "Số lượng đề tài nghiên cứu đã được nghiệm thu loại xuất sắc.",
      correct: "B",
      explanation: "H-index đánh giá đồng thời cả năng suất công bố và tầm ảnh hưởng trích dẫn của nhà khoa học."
    },
    {
      index: 8,
      text: "Phần Thảo luận (Discussion) trong bài báo khoa học có vai trò quan trọng nhất là gì?",
      optionA: "Chép lại toàn bộ các bảng số liệu kết quả mà không đưa ra nhận xét.",
      optionB: "Diễn giải ý nghĩa phát hiện, so sánh với các nghiên cứu trước và nêu hạn chế của đề tài.",
      optionC: "Cung cấp thông tin tiểu sử cá nhân và sở thích của nhóm tác giả.",
      correct: "B",
      explanation: "Phần Discussion diễn giải ý nghĩa phát hiện, liên hệ với lý thuyết/thực nghiệm trước đó và chỉ ra giới hạn nghiên cứu."
    },
    {
      index: 9,
      text: "Hiện tượng Tự đạo văn (Self-plagiarism) xảy ra trong trường hợp nào?",
      optionA: "Sử dụng lại các đoạn nội dung lớn từ bài viết đã công bố của chính mình mà không trích dẫn.",
      optionB: "Trích dẫn đầy đủ và chuẩn xác các công trình trước đây của chính mình.",
      optionC: "Đăng tải bài báo lên website cá nhân sau khi được tạp chí cho phép.",
      correct: "A",
      explanation: "Tự đạo văn là việc tái sử dụng nội dung công trình đã công bố của chính mình mà không có trích dẫn rõ ràng."
    },
    {
      index: 10,
      text: "Từ khóa (Keywords) trong bài báo khoa học nhằm phục vụ mục đích chính nào?",
      optionA: "Giúp người đọc và hệ thống cơ sở dữ liệu học thuật dễ dàng tìm kiếm và lập chỉ mục bài báo.",
      optionB: "Đếm số lượng chữ cái có trong bài báo khoa học.",
      optionC: "Thay thế hoàn toàn cho danh mục tài liệu tham khảo ở cuối bài.",
      correct: "A",
      explanation: "Keywords giúp định vị, lập chỉ mục và tăng khả năng bài báo được tìm thấy trong các cơ sở dữ liệu học thuật."
    }
  ]
};

function seedSampleCompetitionQuestions(competitionId) {
  const insertQuestion = db.prepare(`
    INSERT OR IGNORE INTO competition_questions (
      competition_id, phase, question_index, question_text, option_a, option_b, option_c, correct_option, explanation
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const phase of [1, 2, 3]) {
    const list = SAMPLE_COMPETITION_QUESTIONS[phase] || [];
    for (const q of list) {
      insertQuestion.run(
        competitionId,
        phase,
        q.index,
        q.text,
        q.optionA,
        q.optionB,
        q.optionC,
        q.correct,
        q.explanation
      );
    }
  }
}

function getOrCreateCurrentCompetition(vnDate) {
  const { weekKey, mondayStr, sundayStr, year, weekNumber } = getWeekRange(vnDate);
  let comp = db.prepare("SELECT * FROM weekly_competitions WHERE week_key = ?").get(weekKey);
  if (!comp) {
    db.prepare(`
      INSERT INTO weekly_competitions (
        year, week_number, week_key, start_date, end_date, topic_name, phase1_topic, phase2_topic, phase3_topic, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(
      year,
      weekNumber,
      weekKey,
      mondayStr,
      sundayStr,
      "Phương pháp Nghiên cứu & Xử lý Dữ liệu Khoa học",
      "Phương pháp & Thiết kế Nghiên cứu Khoa học",
      "Thu thập & Phân tích Dữ liệu Nghiên cứu",
      "Viết báo cáo & Trích dẫn Khoa học"
    );
    comp = db.prepare("SELECT * FROM weekly_competitions WHERE week_key = ?").get(weekKey);
    seedSampleCompetitionQuestions(comp.id);
  }
  return comp;
}

function getCompetitionTimeState(vnDate, comp) {
  const dayOfWeek = vnDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const hours = vnDate.getHours();
  const minutes = vnDate.getMinutes();
  const seconds = vnDate.getSeconds();
  const timeInMinutes = hours * 60 + minutes;

  // Sunday = Summary Day
  if (dayOfWeek === 0) {
    const secondsUntilMonday = ((24 - hours - 1) * 3600) + ((59 - minutes) * 60) + (60 - seconds);
    return {
      phase: 3,
      isSunday: true,
      state: "sunday_summary",
      stateLabel: "Vinh danh & Tổng kết tuần",
      ctaText: "Xem bảng vinh danh",
      phaseName: "Tổng kết tuần thi đấu",
      phaseTopic: comp.topic_name,
      secondsUntilNext: Math.max(0, secondsUntilMonday),
      nextStateLabel: "Tuần thi đấu mới",
      isReady: true,
      visible: true
    };
  }

  const phase = getPhaseForDayOfWeek(dayOfWeek);
  const phaseTopic = phase === 1 ? comp.phase1_topic : phase === 2 ? comp.phase2_topic : comp.phase3_topic;
  const phaseDays = phase === 1 ? "Thứ Hai – Thứ Ba" : phase === 2 ? "Thứ Tư – Thứ Năm" : "Thứ Sáu – Thứ Bảy";
  const phaseName = `Giai đoạn ${phase} (${phaseDays})`;

  // Check if phase has 10 questions
  const qCount = db.prepare("SELECT count(*) as c FROM competition_questions WHERE competition_id = ? AND phase = ?").get(comp.id, phase)?.c || 0;
  const isReady = qCount >= 10;

  let state = "reviewing";
  let stateLabel = "Đang tổng kết";
  let ctaText = "Xem bảng xếp hạng";
  let secondsUntilNext = 0;
  let nextStateLabel = "Sắp mở cổng (16:00)";

  // 19:00 – 23:00 (1140 to 1380 mins): Đang mở cổng
  if (timeInMinutes >= 19 * 60 && timeInMinutes < 23 * 60) {
    state = "open";
    stateLabel = "Đang mở cổng (19:00 - 23:00)";
    ctaText = "Tham gia ngay";
    secondsUntilNext = ((23 * 60 - timeInMinutes - 1) * 60) + (60 - seconds);
    nextStateLabel = "Đóng cổng & Tổng kết (23:00)";
  }
  // 16:00 – 19:00 (960 to 1140 mins): Sắp mở cổng
  else if (timeInMinutes >= 16 * 60 && timeInMinutes < 19 * 60) {
    state = "upcoming";
    stateLabel = "Sắp mở cổng thi đấu";
    ctaText = "Xem thể lệ & Chuẩn bị";
    secondsUntilNext = ((19 * 60 - timeInMinutes - 1) * 60) + (60 - seconds);
    nextStateLabel = "Mở cổng trả lời (19:00)";
  }
  // 23:00 – 16:00 hôm sau: Đang tổng kết
  else {
    state = "reviewing";
    stateLabel = "Đang tổng kết & Xếp hạng";
    ctaText = "Xem bảng xếp hạng";
    if (hours >= 23) {
      secondsUntilNext = ((24 - hours + 16 - 1) * 3600) + ((59 - minutes) * 60) + (60 - seconds);
    } else {
      secondsUntilNext = ((16 - hours - 1) * 3600) + ((59 - minutes) * 60) + (60 - seconds);
    }
    nextStateLabel = "Sắp mở cổng (16:00)";
  }

  return {
    phase,
    isSunday: false,
    state: isReady ? state : "not_ready",
    stateLabel,
    ctaText,
    phaseName,
    phaseTopic,
    secondsUntilNext: Math.max(0, secondsUntilNext),
    nextStateLabel,
    isReady,
    questionsCount: qCount,
    visible: isReady
  };
}

function awardCompetitionSundayRewards(competitionId) {
  try {
    const comp = db.prepare("SELECT * FROM weekly_competitions WHERE id = ?").get(competitionId);
    if (!comp) return { error: "Không tìm thấy tuần thi đấu." };

    // Get all participants who have played at least 1 phase
    const participants = db.prepare(`
      SELECT 
        u.id as userId,
        u.display_name as displayName,
        u.email,
        u.role,
        count(DISTINCT r.phase) as phasesParticipated,
        sum(r.best_score) as totalStars,
        min(r.updated_at) as firstCompletedAt
      FROM users u
      JOIN competition_phase_results r ON u.id = r.user_id
      WHERE r.competition_id = ?
      GROUP BY u.id
      ORDER BY totalStars DESC, firstCompletedAt ASC
    `).all(competitionId);

    if (!participants.length) {
      return { awarded: 0, message: "Chưa có thành viên nào tham gia tuần này." };
    }

    const insertReward = db.prepare(`
      INSERT OR IGNORE INTO competition_weekly_rewards (
        competition_id, user_id, rank, total_stars, phases_participated, participation_bonus, activity_points_awarded, shields_awarded
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertEvent = db.prepare(`
      INSERT INTO contribution_events (
        user_id, event_type, points, reference_type, reference_id, reason
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    let awardedCount = 0;

    db.exec("BEGIN");
    try {
      for (let i = 0; i < participants.length; i++) {
        const p = participants[i];
        const rank = i + 1;

        // Check if already awarded
        const existing = db.prepare("SELECT id FROM competition_weekly_rewards WHERE competition_id = ? AND user_id = ?").get(competitionId, p.userId);
        if (existing) continue;

        // Participation bonus
        let partBonus = 1;
        if (p.phasesParticipated === 2) partBonus = 3;
        else if (p.phasesParticipated >= 3) partBonus = 5;

        // Rank base reward
        let rankActivityPoints = 5;
        let shields = 1;

        if (rank === 1) {
          rankActivityPoints = 20;
          shields = 2;
        } else if (rank === 2) {
          rankActivityPoints = 18;
          shields = 2;
        } else if (rank === 3) {
          rankActivityPoints = 15;
          shields = 2;
        } else if (rank <= 10) {
          rankActivityPoints = 10;
          shields = 1;
        }

        const totalPointsToAward = rankActivityPoints + partBonus;

        // Add activity points
        insertEvent.run(
          p.userId,
          "competition_reward",
          rankActivityPoints,
          "competition",
          competitionId,
          `Thưởng Top ${rank} Hoạt động thi đua tuần (${comp.week_key}): +${rankActivityPoints}đ, +${shields} khiên bảo vệ chuỗi`
        );

        if (partBonus > 0) {
          insertEvent.run(
            p.userId,
            "competition_phase_bonus",
            partBonus,
            "competition",
            competitionId,
            `Thưởng tham gia ${p.phasesParticipated}/3 giai đoạn thi đua tuần (${comp.week_key}): +${partBonus}đ hoạt động`
          );
        }

        // Add shields
        db.prepare(`
          INSERT INTO user_streak_shields (user_id, shields, last_milestone_rewarded, updated_at)
          VALUES (?, ?, 0, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id) DO UPDATE SET 
            shields = MIN(3, shields + ?),
            updated_at = CURRENT_TIMESTAMP
        `).run(p.userId, shields, shields);

        insertReward.run(
          competitionId,
          p.userId,
          rank,
          p.totalStars,
          p.phasesParticipated,
          partBonus,
          totalPointsToAward,
          shields
        );

        awardedCount++;
      }

      db.prepare("UPDATE weekly_competitions SET status = 'concluded' WHERE id = ?").run(competitionId);
      db.exec("COMMIT");
      console.log(`[Weekly Competition] Đã tổng kết và trao thưởng cho ${awardedCount} thành viên tuần ${comp.week_key}`);
      return { awarded: awardedCount, ok: true };
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  } catch (err) {
    console.error("Lỗi trao thưởng thi đua tuần:", err);
    return { error: err.message };
  }
}

async function api(request, response, url) {
  const pathName = url.pathname;
  const method = request.method;
  if (["GET", "HEAD"].includes(method) && pathName.startsWith("/api/audio/")) {
    const trackId = pathName.replace("/api/audio/", "").replace(".mp3", "").split("/").pop();
    if (!AUDIO_TRACK_URLS[trackId]) {
      return error(response, 404, "Không tìm thấy track âm thanh.");
    }
    return await streamAudioTrack(request, response, trackId);
  }
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
    if (!user || !requireCsrf(request, response, user)) return;

    const freshUser = db.prepare("SELECT * FROM users WHERE id=?").get(user.id);
    if (!freshUser || (freshUser.shields || 0) < 1) {
      return error(response, 400, "Bạn không có đủ khiên bảo vệ để khôi phục chuỗi.");
    }

    const todayDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    const yesterdayDate = new Date(todayDate); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const y = yesterdayDate.getFullYear();
    const m = String(yesterdayDate.getMonth()+1).padStart(2, '0');
    const day = String(yesterdayDate.getDate()).padStart(2, '0');
    const yesterday = `${y}-${m}-${day}`;
    
    const already = db.prepare("SELECT 1 FROM streak_restores WHERE user_id=? AND restored_date=?").get(user.id, yesterday);
    if (already) {
      return error(response, 400, "Chuỗi của ngày hôm qua đã được khôi phục trước đó.");
    }

    db.prepare("INSERT INTO streak_restores(user_id,restored_date) VALUES (?,?)").run(user.id, yesterday);
    db.prepare("UPDATE users SET shields = MAX(0, shields - 1) WHERE id=?").run(user.id);
    return json(response, 200, { success: true });
  }
  if (method === "POST" && pathName === "/api/auth/register") {
    const clientIp = getClientIp(request);
    if (
      !rateLimit(`register:${clientIp}`, 5, 60 * 60 * 1000)
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
      const csrfToken = createSession(response, user.id, request);
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
    const clientIp = getClientIp(request);
    if (!rateLimit(`login:${clientIp}`, 10, 15 * 60 * 1000))
      return error(response, 429, "Bạn đã thử đăng nhập quá nhiều lần.");
    const { email, password } = await readJSON(request);
    const user = db
      .prepare("SELECT * FROM users WHERE email=?")
      .get((email || "").trim().toLowerCase());
    if (!user || !verifyPassword(password || "", user.password_hash))
      return error(response, 401, "Email hoặc mật khẩu chưa đúng.");
    const csrfToken = createSession(response, user.id, request);
    return json(response, 200, { user: publicUser(user), csrfToken });
  }
  if (method === "POST" && pathName === "/api/auth/logout") {
    const user = requireUser(request, response);
    if (!user || !requireCsrf(request, response, user)) return;
    clearSession(request, response);
    return json(response, 200, { ok: true });
  }
  if (method === "POST" && pathName === "/api/auth/forgot-password-request") {
    const ip = getClientIp(request);
    if (!rateLimit(`forgot-pw:${ip}`, 5, 15 * 60 * 1000))
      return error(
        response,
        429,
        "Bạn đã gửi yêu cầu quá nhiều lần. Vui lòng thử lại sau 15 phút.",
      );
    const { email } = await readJSON(request);
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return error(response, 400, "Vui lòng nhập địa chỉ email hợp lệ.");
    }
    const user = db
      .prepare("SELECT id, email, display_name, role FROM users WHERE email=?")
      .get(cleanEmail);
    if (!user) {
      return error(
        response,
        404,
        "Không tìm thấy tài khoản với email này. Vui lòng kiểm tra lại chính xác email sinh viên của bạn.",
      );
    }
    // Hủy và xóa các yêu cầu trước đó của user này để không lưu mã rác
    db.prepare("DELETE FROM password_resets WHERE user_id=?").run(user.id);

    // Sinh mã OTP 6 chữ số an toàn
    const code = crypto.randomInt(100000, 1000000).toString();
    // Hết hạn sau 24 giờ
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    db.prepare(
      "INSERT INTO password_resets (user_id, email, code, status, expires_at) VALUES (?, ?, ?, 'pending', ?)",
    ).run(user.id, user.email, code, expiresAt);

    console.log(
      `[PASSWORD_RESET_REQUEST] User: ${user.display_name} (${user.email}) -> Code: ${code} (Expires: ${expiresAt})`,
    );

    return json(response, 200, {
      ok: true,
      message:
        "Yêu cầu cấp mã thành công! Vui lòng liên hệ với TA/Admin để lấy mã xác thực 6 chữ số.",
      email: user.email,
    });
  }
  if (method === "POST" && pathName === "/api/auth/reset-password") {
    const ip = getClientIp(request);
    if (!rateLimit(`reset-pw:${ip}`, 10, 15 * 60 * 1000))
      return error(
        response,
        429,
        "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút.",
      );
    const { email, code, newPassword } = await readJSON(request);
    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanCode = (code || "").toString().trim();

    if (!cleanEmail || !cleanCode || !newPassword) {
      return error(
        response,
        400,
        "Vui lòng điền đầy đủ Email, mã xác thực 6 chữ số và mật khẩu mới.",
      );
    }
    if (typeof newPassword !== "string" || newPassword.length < 12) {
      return error(
        response,
        400,
        "Mật khẩu mới phải có độ dài tối thiểu 12 ký tự.",
      );
    }

    const resetReq = db
      .prepare(
        "SELECT * FROM password_resets WHERE email=? AND code=? AND status='pending' ORDER BY id DESC LIMIT 1",
      )
      .get(cleanEmail, cleanCode);

    if (!resetReq) {
      return error(
        response,
        400,
        "Mã xác thực không hợp lệ hoặc đã hết hạn/bị xóa. Vui lòng liên hệ với TA/Admin để lấy mã.",
      );
    }

    if (new Date(resetReq.expires_at).getTime() < Date.now()) {
      db.prepare("DELETE FROM password_resets WHERE id=?").run(resetReq.id);
      return error(
        response,
        400,
        "Mã xác thực này đã hết hạn và đã bị xóa. Vui lòng liên hệ với TA/Admin để lấy mã mới.",
      );
    }

    // Cập nhật mật khẩu mới cho user
    db.prepare(
      "UPDATE users SET password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(hashPassword(newPassword), resetReq.user_id);

    // Lập tức xóa mã xác thực khỏi hệ thống ngay khi đã sử dụng thành công
    db.prepare("DELETE FROM password_resets WHERE id=?").run(resetReq.id);

    // Xóa tất cả các phiên đăng nhập cũ để đảm bảo an toàn tuyệt đối
    db.prepare("DELETE FROM sessions WHERE user_id=?").run(resetReq.user_id);

    return json(response, 200, {
      ok: true,
      message:
        "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay bằng mật khẩu mới.",
    });
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
              streakTier: 0,
            }
          : {
              displayName: r.display_name,
              role: r.role,
              initials: r.avatar || getAvatarEmoji(r.display_name),
              streakTier: getAuthorStreakTier(r.author_id),
            },
        anonymous: Boolean(r.is_anonymous),
      }));
    return json(response, 200, { post: serializePost(row, viewer), responses });
  }
  const readMatch = pathName.match(/^\/api\/posts\/(\d+)\/read$/);
  if (method === "POST" && readMatch) {
    const postId = Number(readMatch[1]);
    const post = db.prepare("SELECT id, read_count FROM posts WHERE id=? AND status='visible'").get(postId);
    if (!post) return error(response, 404, "Không tìm thấy bài đăng.");
    const viewer = sessionFrom(request);
    const identifier = viewer ? `u:${viewer.id}` : `ip:${getClientIp(request)}`;
    if (viewer) {
      const todayVN = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
      // Luôn ghi nhận ngày hoạt động để duy trì chuỗi
      db.prepare("INSERT OR IGNORE INTO activity_days(user_id,activity_date) VALUES (?,?)").run(viewer.id, todayVN);

      // Chỉ ghi lại bài đọc đầu tiên trong ngày vào lịch sử đóng góp (tránh spam thừa thông tin)
      const alreadyLoggedToday = db.prepare(`
        SELECT 1 FROM contribution_events 
        WHERE user_id = ? AND event_type IN ('post_read', 'document_read') 
          AND date(datetime(created_at, '+7 hours')) = ?
        LIMIT 1
      `).get(viewer.id, todayVN);

      if (!alreadyLoggedToday) {
        db.prepare(
          "INSERT INTO contribution_events(user_id,event_type,points,reference_type,reference_id,reason) VALUES (?,?,?,?,?,?)"
        ).run(viewer.id, "post_read", 0, "post", postId, "Đọc bài đăng giữ chuỗi");
      }
    }
    if (canRecordRead(identifier, postId)) {
      db.prepare("UPDATE posts SET read_count = read_count + 1 WHERE id=?").run(postId);
      const updated = db.prepare("SELECT read_count FROM posts WHERE id=?").get(postId);
      return json(response, 200, { success: true, counted: true, readCount: Number(updated.read_count || 0) });
    } else {
      return json(response, 200, { success: true, counted: false, readCount: Number(post.read_count || 0) });
    }
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
    if (typeof content !== "string") {
      return error(response, 400, "Định dạng không hợp lệ.");
    }
    if (content.trim().length < 10) {
      return error(response, 400, "Phản hồi cần có ít nhất 10 ký tự.");
    }
    if (content.trim().length > 50000) {
      return error(response, 400, "Phản hồi quá dài (vượt quá giới hạn cho phép).");
    }
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
    if (typeof content !== "string") {
      return error(response, 400, "Định dạng không hợp lệ.");
    }
    if (content.trim().length < 10) {
      return error(response, 400, "Nội dung phản hồi cần có ít nhất 10 ký tự.");
    }
    if (content.trim().length > 50000) {
      return error(response, 400, "Nội dung phản hồi quá dài.");
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
        const lockedUntil = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
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

    const existingVote = db.prepare(
      "SELECT vote_value FROM votes WHERE user_id=? AND target_type=? AND target_id=?"
    ).get(user.id, targetType, Number(idText));
    const oldValue = existingVote ? existingVote.vote_value : 0;
    if (oldValue === value) {
      return json(response, 200, { ok: true, unchanged: true });
    }

    try {
      db.prepare(
        "INSERT INTO votes(user_id,target_type,target_id,vote_value) VALUES (?,?,?,?) ON CONFLICT(user_id,target_type,target_id) DO UPDATE SET vote_value=?",
      ).run(user.id, targetType, Number(idText), value, value);
      const delta = value - oldValue;
      if (delta !== 0) {
        recordContribution(
          target.author_id,
          "helpful_received",
          delta,
          targetType,
          Number(idText),
        );
      }
      return json(response, 201, { ok: true });
    } catch {
      return error(response, 409, "Không thể cập nhật đánh giá.");
    }
  }
  if (method === "GET" && pathName === "/api/leaderboard") {
    const topUsers = db
      .prepare(`
        SELECT u.id, u.display_name as displayName, u.avatar, u.role, coalesce(sum(c.points), 0) as totalPoints
        FROM users u
        JOIN contribution_events c ON u.id = c.user_id
        WHERE u.role NOT IN ('admin', 'lecturer')
        GROUP BY u.id
        ORDER BY totalPoints DESC
        LIMIT 5
      `)
      .all()
      .map(u => ({
        id: u.id,
        displayName: u.displayName,
        avatar: u.avatar,
        initials: u.avatar || getAvatarEmoji(u.displayName),
        role: u.role,
        totalPoints: Number(u.totalPoints),
        streakTier: getAuthorStreakTier(u.id)
      }));

    const todayDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    const formatYMD = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    const students = db
      .prepare("SELECT id, display_name as displayName, avatar, role FROM users WHERE role = 'student'")
      .all();

    const streakList = students.map(s => {
      const streakInfo = calculateUserStreak(s.id, todayDate, formatYMD);
      return {
        id: s.id,
        displayName: s.displayName,
        avatar: s.avatar,
        initials: s.avatar || getAvatarEmoji(s.displayName),
        role: s.role,
        streak: streakInfo.streak,
        streakTier: streakInfo.streakTier,
        streakStartDate: streakInfo.streakStartDate,
        streakStartCreatedAt: streakInfo.streakStartCreatedAt
      };
    });

    streakList.sort((a, b) => {
      if (b.streak !== a.streak) return b.streak - a.streak;
      if (a.streakStartDate !== b.streakStartDate) return a.streakStartDate.localeCompare(b.streakStartDate);
      if (a.streakStartCreatedAt !== b.streakStartCreatedAt) return a.streakStartCreatedAt.localeCompare(b.streakStartCreatedAt);
      return a.id - b.id;
    });

    const topStreakUsers = streakList.slice(0, 5);

    return json(response, 200, {
      leaderboard: topUsers,
      streakLeaderboard: topStreakUsers
    });
  }
  if (method === "GET" && pathName === "/api/me/contributions") {
    const user = requireUser(request, response);
    if (!user) return;
    const stats = db
      .prepare(
        "SELECT coalesce(sum(points),0) total FROM contribution_events WHERE user_id=?",
      )
      .get(user.id);
    const postCount = db.prepare("SELECT count(*) as c FROM posts WHERE author_id=? AND status='visible'").get(user.id).c;
    const responseCount = db.prepare("SELECT count(*) as c FROM responses WHERE author_id=? AND status='visible'").get(user.id).c;
    stats.count = postCount + responseCount;
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
    
    const streakInfo = calculateUserStreak(user.id, todayDate, formatYMD);

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
      ORDER BY c.created_at DESC, c.id DESC
    `;
    const recent = db.prepare(query + " LIMIT 5").all(user.id);
    return json(response, 200, {
      total: Number(stats.total),
      count: Number(stats.count),
      activityDays: activity,
      streak: streakInfo.streak,
      streakTier: streakInfo.streakTier,
      shields: streakInfo.shields,
      autoShieldUsed: Boolean(streakInfo.autoShieldUsed),
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
        ORDER BY c.created_at DESC, c.id DESC
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
    if (!user || !requireCsrf(request, response, user)) return;
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

  if (method === "POST" && pathName === "/api/me/change-password") {
    const user = requireUser(request, response);
    if (!user || !requireCsrf(request, response, user)) return;
    const { currentPassword, newPassword } = await readJSON(request);

    if (typeof currentPassword !== "string" || !currentPassword) {
      return error(response, 400, "Vui lòng nhập mật khẩu hiện tại.");
    }
    if (typeof newPassword !== "string" || newPassword.length < 12) {
      return error(
        response,
        400,
        "Mật khẩu mới phải có độ dài tối thiểu 12 ký tự.",
      );
    }

    const fullUser = db
      .prepare("SELECT * FROM users WHERE id=?")
      .get(user.id);
    if (!fullUser || !verifyPassword(currentPassword, fullUser.password_hash)) {
      return error(response, 400, "Mật khẩu hiện tại không chính xác.");
    }
    if (verifyPassword(newPassword, fullUser.password_hash)) {
      return error(
        response,
        400,
        "Mật khẩu mới không được trùng với mật khẩu hiện tại.",
      );
    }

    db.prepare(
      "UPDATE users SET password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(hashPassword(newPassword), user.id);

    return json(response, 200, {
      ok: true,
      message: "Đổi mật khẩu thành công!",
    });
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
        submittedByStreakTier: getAuthorStreakTier(d.submitted_by),
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
  const docReadMatch = pathName.match(/^\/api\/documents\/(\d+)\/read$/);
  if (method === "POST" && docReadMatch) {
    const docId = Number(docReadMatch[1]);
    const doc = db.prepare("SELECT id FROM documents WHERE id=? AND status='approved'").get(docId);
    if (!doc) return error(response, 404, "Không tìm thấy tài liệu.");
    const viewer = sessionFrom(request);
    if (viewer) {
      const todayVN = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
      // Luôn ghi nhận ngày hoạt động để duy trì chuỗi
      db.prepare("INSERT OR IGNORE INTO activity_days(user_id,activity_date) VALUES (?,?)").run(viewer.id, todayVN);

      // Chỉ ghi lại tài liệu đầu tiên trong ngày vào lịch sử đóng góp (tránh spam thừa thông tin)
      const alreadyLoggedToday = db.prepare(`
        SELECT 1 FROM contribution_events 
        WHERE user_id = ? AND event_type IN ('post_read', 'document_read') 
          AND date(datetime(created_at, '+7 hours')) = ?
        LIMIT 1
      `).get(viewer.id, todayVN);

      if (!alreadyLoggedToday) {
        db.prepare(
          "INSERT INTO contribution_events(user_id,event_type,points,reference_type,reference_id,reason) VALUES (?,?,?,?,?,?)"
        ).run(viewer.id, "document_read", 0, "document", docId, "Xem tài liệu giữ chuỗi");
      }
    }
    return json(response, 200, { success: true });
  }

  // --- DOCUMENT DISCUSSION / COMMENTS ENDPOINTS ---
  const docCommentsMatch = pathName.match(/^\/api\/documents\/(\d+)\/comments$/);
  if (method === "GET" && docCommentsMatch) {
    const docId = Number(docCommentsMatch[1]);
    const doc = db.prepare("SELECT id FROM documents WHERE id=?").get(docId);
    if (!doc) return error(response, 404, "Không tìm thấy tài liệu.");
    const viewer = sessionFrom(request);
    const comments = db
      .prepare(
        `SELECT c.*, u.display_name, u.avatar, u.role
         FROM document_comments c
         JOIN users u ON u.id = c.user_id
         WHERE c.document_id = ?
         ORDER BY c.created_at ASC`
      )
      .all(docId)
      .map((c) => ({
        id: c.id,
        documentId: c.document_id,
        content: c.content,
        createdAt: c.created_at.replace(' ', 'T') + 'Z',
        editedAt: c.edited_at ? c.edited_at.replace(' ', 'T') + 'Z' : null,
        isAuthor: viewer && viewer.id === c.user_id,
        author: c.is_anonymous && !isAdmin(viewer)
          ? {
              displayName: "Sinh viên ẩn danh",
              role: "student",
              initials: "?",
              streakTier: 0,
            }
          : {
              displayName: c.display_name,
              role: c.role,
              initials: c.avatar || getAvatarEmoji(c.display_name),
              streakTier: getAuthorStreakTier(c.user_id),
            },
        anonymous: Boolean(c.is_anonymous),
      }));
    return json(response, 200, { comments });
  }

  if (method === "POST" && docCommentsMatch) {
    const user = requireUser(request, response);
    if (!user || !requireCsrf(request, response, user)) return;
    if (!rateLimit(`doc_comment:${user.id}`, 25, 60 * 60 * 1000))
      return error(response, 429, "Bạn đã gửi quá nhiều thảo luận. Hãy thử lại sau.");

    const docId = Number(docCommentsMatch[1]);
    const doc = db.prepare("SELECT id, title FROM documents WHERE id=?").get(docId);
    if (!doc) return error(response, 404, "Không tìm thấy tài liệu.");

    const { content, isAnonymous } = await readJSON(request);
    if (typeof content !== "string" || content.trim().length === 0) {
      return error(response, 400, "Vui lòng nhập nội dung thảo luận.");
    }
    if (content.trim().length > 3000) {
      return error(response, 400, "Nội dung thảo luận không được vượt quá 3000 ký tự.");
    }

    const res = db
      .prepare(
        "INSERT INTO document_comments(document_id, user_id, content, is_anonymous) VALUES (?,?,?,?)"
      )
      .run(docId, user.id, content.trim(), isAnonymous ? 1 : 0);

    const todayVN = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
    db.prepare("INSERT OR IGNORE INTO activity_days(user_id,activity_date) VALUES (?,?)").run(user.id, todayVN);

    recordContribution(
      user.id,
      "document_discussion",
      3,
      "document",
      docId,
      `Bạn đã thảo luận về tài liệu "${doc.title.trim()}"`
    );

    const inserted = db
      .prepare(
        `SELECT c.*, u.display_name, u.avatar, u.role
         FROM document_comments c
         JOIN users u ON u.id = c.user_id
         WHERE c.id = ?`
      )
      .get(res.lastInsertRowid);

    return json(response, 201, {
      comment: {
        id: inserted.id,
        documentId: inserted.document_id,
        content: inserted.content,
        createdAt: inserted.created_at.replace(' ', 'T') + 'Z',
        editedAt: null,
        isAuthor: true,
        author: inserted.is_anonymous && !isAdmin(user)
          ? {
              displayName: "Sinh viên ẩn danh",
              role: "student",
              initials: "?",
              streakTier: 0,
            }
          : {
              displayName: inserted.display_name,
              role: inserted.role,
              initials: inserted.avatar || getAvatarEmoji(inserted.display_name),
              streakTier: getAuthorStreakTier(inserted.user_id),
            },
        anonymous: Boolean(inserted.is_anonymous),
      }
    });
  }

  const patchDocCommentMatch = pathName.match(/^\/api\/documents\/comments\/(\d+)$/);
  if (method === "PATCH" && patchDocCommentMatch) {
    const user = requireUser(request, response);
    if (!user || !requireCsrf(request, response, user)) return;

    const commentId = Number(patchDocCommentMatch[1]);
    const comment = db.prepare("SELECT * FROM document_comments WHERE id=?").get(commentId);
    if (!comment) return error(response, 404, "Không tìm thấy thảo luận.");

    if (comment.user_id !== user.id) {
      return error(response, 403, "Chỉ tác giả mới được phép chỉnh sửa thảo luận.");
    }

    // Kiểm tra thời hạn 30 phút
    const createdAtTime = new Date(comment.created_at.replace(' ', 'T') + 'Z').getTime();
    if (Date.now() - createdAtTime > 30 * 60 * 1000) {
      return error(response, 403, "Đã hết thời hạn 30 phút để chỉnh sửa thảo luận.");
    }

    const { content } = await readJSON(request);
    if (typeof content !== "string" || content.trim().length === 0) {
      return error(response, 400, "Vui lòng nhập nội dung thảo luận.");
    }
    if (content.trim().length > 3000) {
      return error(response, 400, "Nội dung thảo luận không được vượt quá 3000 ký tự.");
    }

    db.prepare("UPDATE document_comments SET content=?, edited_at=CURRENT_TIMESTAMP WHERE id=?").run(
      content.trim(),
      commentId
    );

    return json(response, 200, { success: true });
  }

  const delDocCommentMatch = pathName.match(/^\/api\/documents\/comments\/(\d+)$/);
  if (method === "DELETE" && delDocCommentMatch) {
    const user = requireUser(request, response);
    if (!user || !requireCsrf(request, response, user)) return;

    const commentId = Number(delDocCommentMatch[1]);
    const comment = db.prepare("SELECT * FROM document_comments WHERE id=?").get(commentId);
    if (!comment) return error(response, 404, "Không tìm thấy thảo luận.");

    // Chỉ tác giả bình luận, Admin hoặc Giảng viên (và TA) mới có quyền xoá
    const isOwner = comment.user_id === user.id;
    const isPrivileged = user.role === "admin" || user.role === "lecturer" || user.role === "ta";
    if (!isOwner && !isPrivileged) {
      return error(response, 403, "Bạn không có quyền xoá thảo luận này.");
    }

    const doc = db.prepare("SELECT title FROM documents WHERE id=?").get(comment.document_id);

    // Hoàn trả (trừ lại) 3 điểm cho thảo luận bị xoá
    recordContribution(
      comment.user_id,
      "document_comment_deleted",
      -3,
      "document",
      comment.document_id,
      `Thảo luận về tài liệu "${doc?.title ? doc.title.trim() : ''}" đã bị xóa`
    );

    db.prepare("DELETE FROM document_comments WHERE id=?").run(commentId);
    return json(response, 200, { success: true });
  }

  // --- STUDY LOUNGE ENDPOINTS (Open for all users - Beta) ---

  if (method === "GET" && pathName === "/api/study/lounge") {
    cleanupCheers();
    const user = sessionFrom(request);
    const nowMs = Date.now();

    const activeRows = db.prepare(`
      SELECT s.user_id, s.goal, s.mode, s.duration_minutes, s.remaining_seconds,
             s.target_end_ms, s.is_running, s.started_at_ms, s.last_ping_ms,
             s.cycle_index, s.started_at, s.last_ping, s.wallpaper, s.aura,
             u.display_name, u.role, u.avatar
      FROM study_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE (s.is_running = 1 AND (? - s.last_ping_ms) < 300000)
         OR (s.last_ping_ms > 0 AND (? - s.last_ping_ms) < 180000)
         OR (s.last_ping IS NOT NULL AND (unixepoch('now') - unixepoch(s.last_ping)) < 180)
      ORDER BY s.is_running DESC, s.last_ping_ms DESC
    `).all(nowMs, nowMs);

    const todayDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    const learners = activeRows.map(r => {
      const streakInfo = calculateUserStreak(r.user_id, todayDate);
      let remainingSecs = r.remaining_seconds;
      if (r.is_running && r.target_end_ms > 0) {
        remainingSecs = Math.max(0, Math.floor((r.target_end_ms - nowMs) / 1000));
      }
      return {
        userId: r.user_id,
        name: r.display_name || "Học giả NCKH",
        role: r.role,
        avatar: r.avatar || (r.role === 'admin' ? '🛡️' : (r.role === 'ta' ? '🎓' : '🦊')),
        streak: streakInfo.streak,
        streakTier: streakInfo.streakTier,
        goal: r.goal || "Nghiên cứu khoa học",
        mode: r.mode || "focus",
        durationMinutes: r.duration_minutes || 25,
        remainingSeconds: remainingSecs,
        cycleIndex: r.cycle_index || 1,
        isRunning: Boolean(r.is_running),
        wallpaper: r.wallpaper || 'default',
        aura: r.aura || 'emerald',
        isSelf: user ? user.id === r.user_id : false
      };
    });

    let mySession = null;
    if (user) {
      const myRow = db.prepare("SELECT * FROM study_sessions WHERE user_id = ?").get(user.id);
      if (myRow) {
        let remainingSecs = myRow.remaining_seconds;
        if (myRow.is_running && myRow.target_end_ms > 0) {
          remainingSecs = Math.max(0, Math.floor((myRow.target_end_ms - nowMs) / 1000));
        }
        mySession = {
          mode: myRow.mode || 'focus',
          durationMinutes: myRow.duration_minutes || 25,
          remainingSeconds: remainingSecs,
          cycleIndex: myRow.cycle_index || 1,
          targetEndMs: myRow.target_end_ms || 0,
          isRunning: Boolean(myRow.is_running),
          goal: myRow.goal || '',
          wallpaper: myRow.wallpaper || 'default',
          aura: myRow.aura || 'emerald',
          startedAtMs: myRow.started_at_ms || nowMs,
          lastPingMs: myRow.last_ping_ms || nowMs
        };
      }
    }

    let myCheers = [];
    if (user) {
      myCheers = recentCheers.filter(c => c.recipientId === user.id && (Date.now() - c.timestamp) < 45000);
    }

    return json(response, 200, {
      learners,
      activeCount: learners.length,
      mySession,
      myCheers
    });
  }

  if (method === "POST" && pathName === "/api/study/sync") {
    const user = requireUser(request, response);
    if (!user || !requireCsrf(request, response, user)) return;
    try {
      const body = await readJSON(request);
      const validModes = ['focus', 'pomodoro', 'deep', 'shortbreak', 'longbreak'];
      const mode = validModes.includes(body.mode) ? body.mode : 'focus';
      const durationMinutes = Math.max(1, Math.min(720, Number(body.durationMinutes) || 25));
      const cycleIndex = Math.max(1, Math.min(4, Number(body.cycleIndex) || 1));
      const isRunning = body.isRunning ? 1 : 0;
      const goal = (body.goal || "").trim().slice(0, 100);
      const wallpaper = typeof body.wallpaper === 'string' ? body.wallpaper.slice(0, 50) : 'default';
      const aura = typeof body.aura === 'string' ? body.aura.slice(0, 50) : 'emerald';
      const nowMs = Date.now();
      let remainingSeconds = Math.max(0, Math.min(durationMinutes * 60, Number(body.remainingSeconds) || (durationMinutes * 60)));
      let targetEndMs = Number(body.targetEndMs) || 0;

      if (isRunning) {
        if (!targetEndMs || targetEndMs <= nowMs) {
          targetEndMs = nowMs + remainingSeconds * 1000;
        } else {
          remainingSeconds = Math.max(0, Math.floor((targetEndMs - nowMs) / 1000));
        }
      } else {
        targetEndMs = 0;
      }

      const existing = db.prepare("SELECT * FROM study_sessions WHERE user_id = ?").get(user.id);
      const startedAtMs = existing && existing.started_at_ms ? existing.started_at_ms : nowMs;

      db.prepare(`
        INSERT INTO study_sessions (
          user_id, goal, mode, duration_minutes, remaining_seconds, target_end_ms, is_running, started_at_ms, last_ping_ms, cycle_index, wallpaper, aura, started_at, last_ping
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          goal = excluded.goal,
          mode = excluded.mode,
          duration_minutes = excluded.duration_minutes,
          remaining_seconds = excluded.remaining_seconds,
          target_end_ms = excluded.target_end_ms,
          is_running = excluded.is_running,
          last_ping_ms = excluded.last_ping_ms,
          cycle_index = excluded.cycle_index,
          wallpaper = excluded.wallpaper,
          aura = excluded.aura,
          last_ping = CURRENT_TIMESTAMP
      `).run(user.id, goal, mode, durationMinutes, remainingSeconds, targetEndMs, isRunning, startedAtMs, nowMs, cycleIndex, wallpaper, aura);

      return json(response, 200, {
        success: true,
        mySession: {
          mode,
          durationMinutes,
          remainingSeconds,
          cycleIndex,
          targetEndMs,
          isRunning: Boolean(isRunning),
          goal,
          wallpaper,
          aura,
          startedAtMs,
          lastPingMs: nowMs
        }
      });
    } catch (e) {
      console.error("study sync error:", e);
      return error(response, 400, "Dữ liệu không hợp lệ.");
    }
  }

  if (method === "POST" && pathName === "/api/study/ping") {
    const user = requireUser(request, response);
    if (!user) return;
    try {
      const body = await readJSON(request);
      const goal = (body.goal || "").trim().slice(0, 100);
      const mode = (body.mode === 'deep' || body.mode === 'shortbreak') ? body.mode : 'pomodoro';
      const durationMinutes = Math.max(1, Math.min(720, Number(body.durationMinutes) || 25));
      const remainingSeconds = Math.max(0, Number(body.remainingSeconds) || 0);
      const targetEndMs = Number(body.targetEndMs) || 0;
      const isRunning = body.isRunning ? 1 : 0;
      const nowMs = Date.now();

      db.prepare(`
        INSERT INTO study_sessions (
          user_id, goal, mode, duration_minutes, remaining_seconds, target_end_ms, is_running, started_at_ms, last_ping_ms, started_at, last_ping
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          goal = excluded.goal,
          mode = excluded.mode,
          duration_minutes = excluded.duration_minutes,
          remaining_seconds = excluded.remaining_seconds,
          target_end_ms = excluded.target_end_ms,
          is_running = excluded.is_running,
          last_ping_ms = excluded.last_ping_ms,
          last_ping = CURRENT_TIMESTAMP
      `).run(user.id, goal, mode, durationMinutes, remainingSeconds, targetEndMs, isRunning, nowMs, nowMs);

      return json(response, 200, { success: true });
    } catch {
      return error(response, 400, "Dữ liệu không hợp lệ.");
    }
  }

  if (method === "POST" && pathName === "/api/study/leave") {
    const user = sessionFrom(request);
    if (user) {
      db.prepare("DELETE FROM study_sessions WHERE user_id = ?").run(user.id);
    }
    return json(response, 200, { success: true });
  }

  if (method === "POST" && pathName === "/api/study/complete") {
    const user = requireUser(request, response);
    if (!user || !requireCsrf(request, response, user)) return;
    try {
      const body = await readJSON(request);
      const minutes = Number(body.durationMinutes) || 0;
      const cycles = Math.max(0, Number(body.cyclesCompleted) || (minutes >= 40 ? 2 : (minutes >= 20 ? 1 : 0)));
      const goal = (body.goal || "Tự học NCKH").trim().slice(0, 100);

      // Tính ngày Thứ Hai của tuần hiện tại theo giờ VN (GMT+7)
      const vnNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
      const vnDayIndex = vnNow.getDay() === 0 ? 6 : vnNow.getDay() - 1;
      const mondayDate = new Date(vnNow);
      mondayDate.setDate(vnNow.getDate() - vnDayIndex);
      const y = mondayDate.getFullYear();
      const m = String(mondayDate.getMonth() + 1).padStart(2, '0');
      const d = String(mondayDate.getDate()).padStart(2, '0');
      const mondayDateStr = `${y}-${m}-${d}`;

      // Kiểm tra xem tuần này đã nhận điểm study_session (+10đ) chưa
      const hasWeeklyStudyReward = db.prepare(`
        SELECT count(*) as c FROM contribution_events 
        WHERE user_id = ? AND event_type = 'study_session' AND points > 0 
          AND date(datetime(created_at, '+7 hours')) >= ?
      `).get(user.id, mondayDateStr).c > 0;

      let pointsAwarded = 0;
      let toastMessage = "";
      let reason = "";

      // Phải hoàn thành tối thiểu 2 lượt (hoặc >= 40 phút) và chưa nhận trong tuần
      if (cycles >= 2 || minutes >= 40) {
        if (!hasWeeklyStudyReward) {
          pointsAwarded = 10;
          reason = `Hoàn thành ca tự học Pomodoro (${cycles} lượt, ${minutes} phút) - Thưởng tuần +10đ`;
          toastMessage = `🎉 Hoàn thành xuất sắc ca tự học (${cycles} lượt)! +10 điểm thưởng tuần & giữ chuỗi thành công!`;
        } else {
          pointsAwarded = 0;
          reason = `Hoàn thành ca tự học Pomodoro (${cycles} lượt, ${minutes} phút) - Đã nhận thưởng tuần này (1 lần/tuần)`;
          toastMessage = `🎉 Hoàn tất ca tự học (${cycles} lượt)! Tuần này bạn đã nhận 10đ thưởng ca học (tối đa 1 lần/tuần). Hoạt động đã được ghi nhận giữ chuỗi!`;
        }
      } else {
        pointsAwarded = 0;
        reason = `Hoàn thành ca tự học (${minutes} phút, ${cycles} lượt) - Cần tối thiểu 2 lượt để nhận thưởng tuần (+10đ)`;
        toastMessage = `🎉 Hoàn tất ca học (${minutes} phút)! Bạn cần hoàn thành tối thiểu 2 lượt Pomodoro để nhận 10đ thưởng tuần. Hoạt động đã được ghi nhận giữ chuỗi!`;
      }

      if (minutes >= 20 || cycles >= 1) {
        recordContribution(user.id, "study_session", pointsAwarded, "study", null, reason);
      }
      db.prepare("DELETE FROM study_sessions WHERE user_id = ?").run(user.id);

      const streakInfo = calculateUserStreak(user.id);
      return json(response, 200, {
        success: true,
        pointsAwarded,
        message: toastMessage,
        streak: streakInfo.streak,
        streakTier: streakInfo.streakTier
      });
    } catch {
      return error(response, 400, "Không thể lưu ca tự học.");
    }
  }

  if (method === "POST" && pathName === "/api/study/cheer") {
    const user = requireUser(request, response);
    if (!user || !requireCsrf(request, response, user)) return;
    try {
      const senderStreak = calculateUserStreak(user.id);
      if ((senderStreak.streak || 0) < 3 && !isAdmin(user)) {
        return error(response, 403, "Cần đạt chuỗi hoạt động từ 3 ngày để mở khóa tính năng cổ vũ.");
      }
      const body = await readJSON(request);
      const recipientId = Number(body.recipientId);
      const allowedCheers = ["👏", "☕", "🔥", "❤️", "💡", "🚀"];
      const cheerType = allowedCheers.includes(body.cheerType) ? body.cheerType : "👏";
      if (!recipientId || recipientId === user.id) {
        return error(response, 400, "Người nhận không hợp lệ.");
      }

      // Debounce cheer from same sender to same recipient within 2 seconds
      const now = Date.now();
      const recentDup = recentCheers.find(
        c => c.recipientId === recipientId && c.senderId === user.id && (now - c.timestamp) < 2000
      );
      if (recentDup) {
        return json(response, 200, { success: true, debounced: true });
      }

      cleanupCheers();
      recentCheers.push({
        id: Date.now() + Math.random(),
        recipientId,
        senderId: user.id,
        senderName: user.display_name || user.displayName || user.email.split("@")[0],
        senderAvatar: user.avatar || "🦊",
        senderStreakTier: senderStreak.streakTier !== undefined ? senderStreak.streakTier : getAuthorStreakTier(user.id),
        cheerType,
        timestamp: Date.now()
      });
      return json(response, 200, { success: true });
    } catch {
      return error(response, 400, "Không thể gửi cổ vũ.");
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
      pendingPasswordResets: count(
        "SELECT count(*) count FROM password_resets WHERE status='pending' AND datetime(expires_at) >= datetime('now')",
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

  if (method === "GET" && pathName === "/api/admin/password-resets") {
    const user = requireUser(request, response);
    if (!user || !isSuperAdmin(user))
      return user
        ? error(response, 403, "Chỉ TA/Admin mới có quyền này.")
        : undefined;

    // Tự động xóa các mã đã quá hạn hoặc không còn pending
    db.prepare(
      "DELETE FROM password_resets WHERE datetime(expires_at) < datetime('now') OR status != 'pending'",
    ).run();

    const rows = db
      .prepare(
        `SELECT 
          pr.id,
          pr.user_id,
          pr.email,
          pr.code,
          pr.status,
          pr.expires_at,
          pr.created_at,
          pr.used_at,
          u.display_name,
          u.student_id,
          u.real_name,
          u.class_name,
          u.role
        FROM password_resets pr
        JOIN users u ON u.id = pr.user_id
        WHERE pr.status = 'pending' AND datetime(pr.expires_at) >= datetime('now')
        ORDER BY pr.id DESC
        LIMIT 100`,
      )
      .all();

    const pendingCount = db
      .prepare(
        "SELECT count(*) as count FROM password_resets WHERE status='pending' AND datetime(expires_at) >= datetime('now')",
      )
      .get().count;

    return json(response, 200, {
      requests: rows,
      pendingCount: Number(pendingCount),
    });
  }

  if (method === "POST" && pathName === "/api/admin/password-resets/revoke") {
    const user = requireUser(request, response);
    if (!user || !isSuperAdmin(user))
      return user
        ? error(response, 403, "Chỉ TA/Admin mới có quyền này.")
        : undefined;
    if (!requireCsrf(request, response, user)) return;

    const { id } = await readJSON(request);
    db.prepare("DELETE FROM password_resets WHERE id=?").run(id);

    return json(response, 200, {
      ok: true,
      message: "Đã hủy và xóa mã xác thực này thành công.",
    });
  }

  // --- WEEKLY COMPETITION APIS ---
  let competitionResultsVersion = Date.now();

  function notifyCompetitionResultsChanged() {
    competitionResultsVersion = Date.now();
  }

  function updateUserPhaseBestScore(userId, competitionId, phase, score, sessionId, onTimeBonus = 0) {
    const existing = db.prepare(
      "SELECT * FROM competition_phase_results WHERE user_id = ? AND competition_id = ? AND phase = ?"
    ).get(userId, competitionId, phase);

    notifyCompetitionResultsChanged();

    if (existing) {
      const newBest = Math.max(existing.best_score, score);
      const newAttempts = existing.attempts_used + 1;
      const bestSessionId = (score >= existing.best_score) ? sessionId : existing.best_session_id;
      const bestBonus = Math.max(existing.on_time_bonus || 0, onTimeBonus || 0);

      db.prepare(`
        UPDATE competition_phase_results 
        SET best_score = ?, attempts_used = ?, best_session_id = ?, on_time_bonus = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newBest, newAttempts, bestSessionId, bestBonus, existing.id);
      return newBest;
    } else {
      db.prepare(`
        INSERT INTO competition_phase_results (user_id, competition_id, phase, best_session_id, best_score, attempts_used, on_time_bonus)
        VALUES (?, ?, ?, ?, ?, 1, ?)
      `).run(userId, competitionId, phase, sessionId, score, onTimeBonus || 0);
      return score;
    }
  }

  if (method === "GET" && pathName === "/api/competition/status") {
    const user = sessionFrom(request);
    // Feature flag: khoá tạm thời Arena với người dùng không phải là Admin
    if (!ARENA_ENABLED && (!user || user.role !== "admin")) {
      return json(response, 200, { ok: true, visible: true, isReady: false, locked: true });
    }
    const vnNow = getVietnamNow();
    const comp = getOrCreateCurrentCompetition(vnNow);
    const timeState = getCompetitionTimeState(vnNow, comp);

    let userStatus = {
      authenticated: false,
      attemptsUsed: 0,
      maxAttempts: 1,
      canPlay: false,
      bestScore: 0,
      hasPlayedPhase: false
    };

    if (user) {
      const phaseToQuery = timeState.phase || 1;
      const phaseRes = db.prepare(
        "SELECT best_score, attempts_used FROM competition_phase_results WHERE user_id = ? AND competition_id = ? AND phase = ?"
      ).get(user.id, comp.id, phaseToQuery);

      const attemptsUsed = phaseRes?.attempts_used || 0;
      const bestScore = phaseRes?.best_score || 0;
      const hasPlayedPhase = attemptsUsed > 0;
      const canPlay = (timeState.state === "open" || isSuperAdmin(user)) && timeState.isReady && attemptsUsed < 1;

      userStatus = {
        authenticated: true,
        attemptsUsed,
        maxAttempts: 1,
        canPlay,
        bestScore,
        hasPlayedPhase
      };
    }

    return json(response, 200, {
      ok: true,
      resultsVersion: competitionResultsVersion,
      serverTime: vnNow.toISOString(),
      serverTimestampMs: getVietnamTimestampMs(),
      isSimulated: simulatedTimeOffsetMs !== 0,
      week: {
        id: comp.id,
        weekKey: comp.week_key,
        weekNumber: comp.week_number,
        startDate: comp.start_date,
        endDate: comp.end_date,
        topicName: comp.topic_name,
        phase1Topic: comp.phase1_topic,
        phase2Topic: comp.phase2_topic,
        phase3Topic: comp.phase3_topic,
        status: comp.status
      },
      ...timeState,
      userStatus
    });
  }

  if (method === "GET" && pathName === "/api/competition/overview") {
    const user = sessionFrom(request);
    if (!ARENA_ENABLED && (!user || user.role !== "admin")) {
      return json(response, 200, { ok: true, locked: true });
    }
    const vnNow = getVietnamNow();
    const comp = getOrCreateCurrentCompetition(vnNow);
    const timeState = getCompetitionTimeState(vnNow, comp);

    let userSummary = null;
    let userStatus = null;
    let defaultAvailablePhase = null;
    let phasesStatus = [];

    if (!timeState.isSunday) {
      defaultAvailablePhase = timeState.phase || 1;
    }

    if (user) {
      const curPhase = timeState.phase || 1;

      const pResults = db.prepare(
        "SELECT phase, best_score, attempts_used, on_time_bonus FROM competition_phase_results WHERE user_id = ? AND competition_id = ?"
      ).all(user.id, comp.id);

      const p1Row = pResults.find(r => r.phase === 1);
      const p2Row = pResults.find(r => r.phase === 2);
      const p3Row = pResults.find(r => r.phase === 3);

      const p1 = p1Row?.best_score || 0;
      const p2 = p2Row?.best_score || 0;
      const p3 = p3Row?.best_score || 0;
      
      let phasesParticipated = 0;
      if (p1 > 0 || (p1Row && p1Row.attempts_used > 0)) phasesParticipated++;
      if (p2 > 0 || (p2Row && p2Row.attempts_used > 0)) phasesParticipated++;
      if (p3 > 0 || (p3Row && p3Row.attempts_used > 0)) phasesParticipated++;

      let bonusPoints = 0;
      if (phasesParticipated === 1) bonusPoints = 1;
      else if (phasesParticipated === 2) bonusPoints = 3;
      else if (phasesParticipated >= 3) bonusPoints = 5;

      let p1Bonus = p1Row?.on_time_bonus || 0;
      if (!p1Bonus) {
        const s1 = db.prepare("SELECT on_time_bonus, is_on_time FROM competition_sessions WHERE user_id = ? AND competition_id = ? AND phase = 1 AND status IN ('completed', 'expired') ORDER BY id DESC LIMIT 1").get(user.id, comp.id);
        if (s1 && (s1.on_time_bonus > 0 || s1.is_on_time === 1)) {
          p1Bonus = s1.on_time_bonus || 50;
          try {
            db.prepare("UPDATE competition_phase_results SET on_time_bonus = ? WHERE user_id = ? AND competition_id = ? AND phase = 1").run(p1Bonus, user.id, comp.id);
          } catch (e) {}
        }
      }
      let p2Bonus = p2Row?.on_time_bonus || 0;
      if (!p2Bonus) {
        const s2 = db.prepare("SELECT on_time_bonus, is_on_time FROM competition_sessions WHERE user_id = ? AND competition_id = ? AND phase = 2 AND status IN ('completed', 'expired') ORDER BY id DESC LIMIT 1").get(user.id, comp.id);
        if (s2 && (s2.on_time_bonus > 0 || s2.is_on_time === 1)) {
          p2Bonus = s2.on_time_bonus || 50;
          try {
            db.prepare("UPDATE competition_phase_results SET on_time_bonus = ? WHERE user_id = ? AND competition_id = ? AND phase = 2").run(p2Bonus, user.id, comp.id);
          } catch (e) {}
        }
      }

      const totalOnTimeBonus = p1Bonus + p2Bonus;
      const weeklyTotal = p1 + p2 + p3;

      userSummary = {
        phase1Score: p1,
        phase2Score: p2,
        phase3Score: p3,
        weeklyTotal,
        totalOnTimeBonus,
        phasesParticipated,
        bonusPoints
      };

      const completedP1 = db.prepare("SELECT count(*) as c FROM competition_sessions WHERE user_id = ? AND competition_id = ? AND phase = 1 AND status IN ('completed', 'expired')").get(user.id, comp.id)?.c || 0;
      const completedP2 = db.prepare("SELECT count(*) as c FROM competition_sessions WHERE user_id = ? AND competition_id = ? AND phase = 2 AND status IN ('completed', 'expired')").get(user.id, comp.id)?.c || 0;
      const completedP3 = db.prepare("SELECT count(*) as c FROM competition_sessions WHERE user_id = ? AND competition_id = ? AND phase = 3 AND status IN ('completed', 'expired')").get(user.id, comp.id)?.c || 0;

      const activeSession = db.prepare(
        "SELECT * FROM competition_sessions WHERE user_id = ? AND competition_id = ? AND status = 'in_progress'"
      ).get(user.id, comp.id);

      let hasActiveSession = false;
      let activePhase = curPhase;
      let activeRemaining = 0;
      let activeQuestionIndex = 1;
      let isPaused = false;
      let exitCount = 0;

      if (activeSession) {
        const nowMs = getVietnamTimestampMs();
        let remaining = activeSession.remaining_seconds;
        if (!activeSession.is_paused) {
          const elapsed = Math.max(0, Math.floor((nowMs - activeSession.server_start_timestamp_ms) / 1000));
          remaining = Math.min(600, Math.max(0, activeSession.remaining_seconds - elapsed - (activeSession.accumulated_penalty_seconds || 0)));
        } else {
          remaining = Math.min(600, Math.max(0, activeSession.remaining_seconds));
        }

        if (remaining > 0) {
          hasActiveSession = true;
          activePhase = activeSession.phase;
          activeRemaining = remaining;
          activeQuestionIndex = activeSession.current_question_index || 1;
          isPaused = Boolean(activeSession.is_paused);
          exitCount = activeSession.exit_count || 0;
        } else {
          db.prepare("UPDATE competition_sessions SET status = 'expired', remaining_seconds = 0, is_paused = 0, finished_at = CURRENT_TIMESTAMP WHERE id = ?").run(activeSession.id);
        }
      }

      phasesStatus = [
        {
          phase: 1,
          name: "Giai đoạn 1",
          days: "Thứ Hai – Thứ Ba",
          topic: comp.phase1_topic,
          isCompleted: completedP1 >= 1,
          score: p1,
          bestScore: p1,
          isCurrent: curPhase === 1 && !timeState.isSunday,
          isAvailable: !timeState.isSunday && (curPhase >= 1) && (completedP1 < 1 || (hasActiveSession && activePhase === 1)),
          isCatchUp: !timeState.isSunday && curPhase > 1 && completedP1 < 1,
          isOnTime: curPhase === 1 && !timeState.isSunday,
          onTimeBonusEligible: (curPhase === 1 && !timeState.isSunday) ? 50 : 0,
          onTimeBonusEarned: p1Bonus,
          hasActive: hasActiveSession && activePhase === 1
        },
        {
          phase: 2,
          name: "Giai đoạn 2",
          days: "Thứ Tư – Thứ Năm",
          topic: comp.phase2_topic,
          isCompleted: completedP2 >= 1,
          score: p2,
          bestScore: p2,
          isCurrent: curPhase === 2 && !timeState.isSunday,
          isAvailable: !timeState.isSunday && (curPhase >= 2) && (completedP2 < 1 || (hasActiveSession && activePhase === 2)),
          isCatchUp: !timeState.isSunday && curPhase > 2 && completedP2 < 1,
          isOnTime: curPhase === 2 && !timeState.isSunday,
          onTimeBonusEligible: (curPhase === 2 && !timeState.isSunday) ? 50 : 0,
          onTimeBonusEarned: p2Bonus,
          hasActive: hasActiveSession && activePhase === 2
        },
        {
          phase: 3,
          name: "Giai đoạn 3",
          days: "Thứ Sáu – Thứ Bảy",
          topic: comp.phase3_topic,
          isCompleted: completedP3 >= 1,
          score: p3,
          bestScore: p3,
          isCurrent: curPhase === 3 && !timeState.isSunday,
          isAvailable: !timeState.isSunday && (curPhase >= 3) && (completedP3 < 1 || (hasActiveSession && activePhase === 3)),
          isCatchUp: false,
          isOnTime: false,
          onTimeBonusEligible: 0,
          onTimeBonusEarned: 0,
          hasActive: hasActiveSession && activePhase === 3
        }
      ];

      defaultAvailablePhase = null;
      if (hasActiveSession) {
        defaultAvailablePhase = activePhase;
      } else {
        const firstUncompleted = phasesStatus.find(p => p.isAvailable && !p.isCompleted);
        if (firstUncompleted) {
          defaultAvailablePhase = firstUncompleted.phase;
        }
      }

      const curCompleted = (curPhase === 1 ? completedP1 : curPhase === 2 ? completedP2 : completedP3);

      userStatus = {
        attemptsUsed: curCompleted,
        maxAttempts: 1,
        hasActiveSession,
        activePhase,
        activeRemaining,
        activeQuestionIndex,
        isPaused,
        exitCount,
        defaultAvailablePhase,
        phasesStatus,
        totalOnTimeBonus,
        bestScore: (curPhase === 1 ? p1 : (curPhase === 2 ? p2 : p3))
      };
    }

    return json(response, 200, {
      ok: true,
      resultsVersion: competitionResultsVersion,
      week: comp,
      phase: timeState.phase,
      isSunday: Boolean(timeState.isSunday),
      timeState,
      userSummary,
      userStatus,
      totalOnTimeBonus: userStatus?.totalOnTimeBonus ?? userSummary?.totalOnTimeBonus ?? 0,
      defaultAvailablePhase,
      phasesStatus
    });
  }

  if (method === "GET" && pathName === "/api/competition/phase/result") {
    const user = requireUser(request, response);
    if (!user) return;

    const vnNow = getVietnamNow();
    const comp = getOrCreateCurrentCompetition(vnNow);
    const phase = Math.min(3, Math.max(1, Number(url.searchParams.get("phase")) || 1));

    const phaseRes = db.prepare(
      "SELECT * FROM competition_phase_results WHERE user_id = ? AND competition_id = ? AND phase = ?"
    ).get(user.id, comp.id, phase);

    let session = null;
    if (phaseRes && phaseRes.best_session_id) {
      session = db.prepare("SELECT * FROM competition_sessions WHERE id = ?").get(phaseRes.best_session_id);
    }
    if (!session) {
      session = db.prepare(
        "SELECT * FROM competition_sessions WHERE user_id = ? AND competition_id = ? AND phase = ? AND status IN ('completed', 'expired') ORDER BY id DESC LIMIT 1"
      ).get(user.id, comp.id, phase);
    }

    if (!phaseRes && !session) {
      return error(response, 404, `Bạn chưa có kết quả bài thi cho Giai đoạn ${phase}.`);
    }

    const totalScore = session?.total_score ?? phaseRes?.best_score ?? 0;
    const correctCount = session?.correct_count ?? 0;
    const correctPoints = session?.correct_points ?? (correctCount * 40);
    const firstTryCount = session?.first_try_correct_count ?? 0;
    const firstTryBonus = session?.first_try_bonus ?? (firstTryCount * 10);
    const remainingSeconds = session?.remaining_seconds ?? 0;
    const timePoints = session?.time_points ?? remainingSeconds;
    const onTimeBonus = phaseRes?.on_time_bonus || session?.on_time_bonus || 0;

    const result = {
      phase,
      totalScore,
      correctCount,
      correctAnswersCount: correctCount,
      correctPoints,
      firstTryCount,
      firstTryBonusPoints: firstTryBonus,
      remainingSeconds,
      timePoints,
      onTimeBonus,
      phaseBestScore: phaseRes?.best_score ?? totalScore,
      finishedAt: session?.finished_at || phaseRes?.updated_at || "",
      isHistorical: true
    };

    return json(response, 200, {
      ok: true,
      phase,
      result
    });
  }

  if (method === "GET" && pathName === "/api/competition/leaderboard") {
    const vnNow = getVietnamNow();
    const comp = getOrCreateCurrentCompetition(vnNow);
    const timeState = getCompetitionTimeState(vnNow, comp);
    const user = sessionFrom(request);

    const phaseParam = url.searchParams.get("phase") || (timeState.isSunday ? "week" : String(timeState.phase || 1));

    let results = [];
    if (phaseParam === "week") {
      results = db.prepare(`
        SELECT 
          u.id as userId,
          u.display_name as displayName,
          u.email,
          u.avatar,
          u.role,
          coalesce(s.shields, 0) as shields,
          sum(r.best_score) as totalScore,
          count(DISTINCT r.phase) as phasesCount,
          min(r.updated_at) as firstCompletedAt
        FROM users u
        JOIN competition_phase_results r ON u.id = r.user_id
        LEFT JOIN user_streak_shields s ON s.user_id = u.id
        WHERE r.competition_id = ?
        GROUP BY u.id
        ORDER BY totalScore DESC, firstCompletedAt ASC
      `).all(comp.id);
    } else {
      const phaseNum = Math.min(3, Math.max(1, Number(phaseParam) || 1));
      results = db.prepare(`
        SELECT 
          u.id as userId,
          u.display_name as displayName,
          u.email,
          u.avatar,
          u.role,
          coalesce(s.shields, 0) as shields,
          r.best_score as totalScore,
          r.attempts_used as attemptsUsed,
          r.updated_at as completedAt
        FROM users u
        JOIN competition_phase_results r ON u.id = r.user_id
        LEFT JOIN user_streak_shields s ON s.user_id = u.id
        WHERE r.competition_id = ? AND r.phase = ?
        ORDER BY r.best_score DESC, r.updated_at ASC
      `).all(comp.id, phaseNum);
    }

    const todayDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    const formatted = results.map((row, idx) => {
      const streakInfo = calculateUserStreak(row.userId, todayDate);
      return {
        rank: idx + 1,
        userId: row.userId,
        displayName: row.displayName,
        avatar: row.avatar || getAvatarEmoji(row.displayName),
        role: row.role,
        streak: streakInfo.streak,
        streakTier: streakInfo.streakTier,
        shields: row.shields,
        score: row.totalScore,
        phasesCount: row.phasesCount,
        isCurrentUser: Boolean(user && user.id === row.userId)
      };
    });

    const top10 = formatted.slice(0, 10);
    let currentUserEntry = null;

    if (user) {
      const myIndex = formatted.findIndex(r => r.userId === user.id);
      if (myIndex !== -1) {
        const myRank = myIndex + 1;
        const myItem = formatted[myIndex];
        currentUserEntry = {
          rank: myRank,
          userId: myItem.userId,
          displayName: myItem.displayName,
          initials: myItem.initials || myItem.displayName?.slice(0, 2) || "U",
          avatar: myItem.avatar,
          role: myItem.role,
          streak: myItem.streak,
          streakTier: myItem.streakTier,
          score: myItem.score,
          isTop10: myRank <= 10,
          isTop11Plus: myRank > 10,
          label: myRank > 10 ? "Top 11+" : `#${myRank}`
        };
      }
    }

    const isSunday = Boolean(timeState.isSunday || timeState.state === "sunday_summary");
    const weekNumStr = String(comp.week_number || 1).padStart(2, "0");
    const isWeekPhase = (phaseParam === "week");
    let phaseTitle = isWeekPhase ? `Bảng xếp hạng tuần ${weekNumStr}` : "Bảng xếp hạng giai đoạn";

    let canShow = false;
    if (isWeekPhase) {
      canShow = isSunday;
    } else {
      const pNum = Math.min(3, Math.max(1, Number(phaseParam) || 1));
      if (isSunday) {
        canShow = true;
      } else if (pNum < timeState.phase) {
        canShow = true;
      } else if (pNum === timeState.phase) {
        canShow = (timeState.state === "reviewing" || timeState.state === "summary");
      } else {
        canShow = false;
      }
    }

    if (url.searchParams.get("admin_preview") === "true" && user?.role === "admin") {
      canShow = true;
    }

    return json(response, 200, {
      ok: true,
      resultsVersion: competitionResultsVersion,
      phase: phaseParam,
      phaseTitle,
      weekNumber: comp.week_number || 1,
      weekNumberStr: weekNumStr,
      canShow,
      message: canShow ? null : "Chờ chút nhé",
      totalParticipants: canShow ? formatted.length : 0,
      top10: canShow ? top10 : [],
      currentUserEntry: canShow ? currentUserEntry : null,
      currentUserRank: canShow ? currentUserEntry : null,
      isLocked: isWeekPhase ? isSunday : (timeState.phase > Number(phaseParam) || isSunday)
    });
  }

  if (method === "POST" && pathName === "/api/competition/session/start") {
    const user = requireUser(request, response);
    if (!user) return;
    if (!requireCsrf(request, response, user)) return;

    if (!ARENA_ENABLED && user.role !== "admin") {
      return error(response, 403, "Đấu trường Arena đang tạm khoá để thử nghiệm nội bộ.");
    }

    const vnNow = getVietnamNow();
    const comp = getOrCreateCurrentCompetition(vnNow);
    const timeState = getCompetitionTimeState(vnNow, comp);

    if (timeState.state !== "open" && !isSuperAdmin(user)) {
      return error(response, 403, "Cổng thi đấu hiện không mở. Khung giờ thi đấu là 19h00 - 23h00.");
    }

    const body = await readJSON(request);
    const requestedPhase = Number(body?.phase || body?.targetPhase);

    const nowMs = getVietnamTimestampMs();
    const currentPhase = timeState.phase || 1;

    let activeSession = db.prepare(
      "SELECT * FROM competition_sessions WHERE user_id = ? AND competition_id = ? AND status = 'in_progress'"
    ).get(user.id, comp.id);

    let sessionPhase = currentPhase;

    if (activeSession) {
      sessionPhase = activeSession.phase;
      if (requestedPhase && requestedPhase !== activeSession.phase) {
        return error(response, 400, `Bạn đang có bài thi Giai đoạn ${activeSession.phase} dở dang. Vui lòng hoàn thành trước khi bắt đầu giai đoạn khác.`);
      }
    } else {
      if (requestedPhase) {
        if (requestedPhase < 1 || requestedPhase > currentPhase) {
          return error(response, 400, "Giai đoạn này không hợp lệ hoặc chưa mở.");
        }
        sessionPhase = requestedPhase;
      } else {
        sessionPhase = currentPhase;
      }

      const completedSessions = db.prepare(
        "SELECT count(*) as c FROM competition_sessions WHERE user_id = ? AND competition_id = ? AND phase = ? AND status IN ('completed', 'expired')"
      ).get(user.id, comp.id, sessionPhase)?.c || 0;

      const hasPhaseResult = db.prepare(
        "SELECT count(*) as c FROM competition_phase_results WHERE user_id = ? AND competition_id = ? AND phase = ? AND attempts_used >= 1"
      ).get(user.id, comp.id, sessionPhase)?.c || 0;

      if (completedSessions >= 1 || hasPhaseResult >= 1) {
        return error(response, 400, "Bạn chỉ có 1 lượt thi duy nhất cho giai đoạn này và đã hoàn thành.");
      }
    }

    const phase = sessionPhase;
    const questions = db.prepare(
      "SELECT id, question_index, question_text, option_a, option_b, option_c FROM competition_questions WHERE competition_id = ? AND phase = ? ORDER BY question_index ASC"
    ).all(comp.id, phase);

    if (questions.length < 10) {
      return error(response, 400, "Bộ câu hỏi cho giai đoạn này chưa sẵn sàng.");
    }

    const isResumed = Boolean(activeSession);
    if (activeSession) {
      let remaining = activeSession.remaining_seconds;
      if (!activeSession.is_paused) {
        const elapsed = Math.max(0, Math.floor((nowMs - activeSession.server_start_timestamp_ms) / 1000));
        remaining = Math.min(600, Math.max(0, activeSession.remaining_seconds - elapsed - (activeSession.accumulated_penalty_seconds || 0)));
      } else {
        remaining = Math.min(600, Math.max(0, activeSession.remaining_seconds));
      }

      if (remaining <= 0) {
        db.prepare("UPDATE competition_sessions SET status = 'expired', remaining_seconds = 0, is_paused = 0, finished_at = CURRENT_TIMESTAMP WHERE id = ?").run(activeSession.id);
        return error(response, 400, "Phiên thi của bạn đã hết thời gian và đã kết thúc.");
      } else {
        db.prepare("UPDATE competition_sessions SET server_start_timestamp_ms = ?, remaining_seconds = ?, accumulated_penalty_seconds = 0, is_paused = 0 WHERE id = ?").run(nowMs, remaining, activeSession.id);
        activeSession.remaining_seconds = remaining;
        activeSession.server_start_timestamp_ms = nowMs;
        activeSession.is_paused = 0;
      }
    }

    if (!activeSession) {
      const sessionToken = randomToken();
      const attemptNumber = 1;
      const isOnTime = (phase === currentPhase && (phase === 1 || phase === 2)) ? 1 : 0;

      db.prepare(`
        INSERT INTO competition_sessions (
          session_token, user_id, competition_id, phase, attempt_number, server_start_timestamp_ms, initial_seconds, remaining_seconds, is_paused, exit_count, is_on_time, on_time_bonus, status
        ) VALUES (?, ?, ?, ?, ?, ?, 600, 600, 0, 0, ?, 0, 'in_progress')
      `).run(sessionToken, user.id, comp.id, phase, attemptNumber, nowMs, isOnTime);

      activeSession = db.prepare("SELECT * FROM competition_sessions WHERE session_token = ?").get(sessionToken);
    }

    const currentQIndex = activeSession.current_question_index || 1;
    const currentQ = questions.find(q => q.question_index === currentQIndex) || questions[0];

    const answerRow = db.prepare("SELECT tries_count, is_correct, is_finalized, history_json FROM competition_answers WHERE session_id = ? AND question_index = ?").get(activeSession.id, currentQ.question_index);

    const formattedQuestions = questions.map(q => ({
      id: q.id,
      questionIndex: q.question_index,
      questionText: q.question_text,
      optionA: q.option_a,
      optionB: q.option_b,
      optionC: q.option_c
    }));

    const phaseTopic = phase === 1 ? comp.phase1_topic : (phase === 2 ? comp.phase2_topic : comp.phase3_topic);
    const phaseDays = phase === 1 ? "Thứ Hai – Thứ Ba" : (phase === 2 ? "Thứ Tư – Thứ Năm" : "Thứ Sáu – Thứ Bảy");
    const phaseName = `Giai đoạn ${phase} (${phaseDays})`;

    return json(response, 200, {
      ok: true,
      isResumed: isResumed && Boolean(activeSession),
      sessionToken: activeSession.session_token,
      phase,
      phaseName,
      phaseTopic,
      isOnTime: Boolean(activeSession.is_on_time),
      potentialOnTimeBonus: activeSession.is_on_time ? 50 : 0,
      isCatchUp: phase < currentPhase,
      attemptNumber: activeSession.attempt_number,
      totalQuestions: 10,
      currentQuestionIndex: currentQ.question_index,
      remainingSeconds: activeSession.remaining_seconds,
      durationSeconds: activeSession.remaining_seconds,
      initialSeconds: 600,
      exitCount: activeSession.exit_count || 0,
      exitsLeft: Math.max(0, 2 - (activeSession.exit_count || 0)),
      isPaused: false,
      correctCount: activeSession.correct_count,
      firstTryCorrectCount: activeSession.first_try_correct_count,
      correctPoints: activeSession.correct_points,
      firstTryBonus: activeSession.first_try_bonus,
      currentTriesCount: answerRow?.tries_count || 0,
      disabledOptions: answerRow ? JSON.parse(answerRow.history_json || "[]") : [],
      questions: formattedQuestions,
      question: {
        id: currentQ.id,
        index: currentQ.question_index,
        text: currentQ.question_text,
        optionA: currentQ.option_a,
        optionB: currentQ.option_b,
        optionC: currentQ.option_c
      }
    });
  }

  if (method === "POST" && pathName === "/api/competition/session/answer") {
    const user = requireUser(request, response);
    if (!user) return;
    if (!requireCsrf(request, response, user)) return;

    const body = await readJSON(request);
    const { sessionToken, selectedOption } = body;
    let questionIndex = body.questionIndex;

    if (!sessionToken || !selectedOption) {
      return error(response, 400, "Thông tin câu trả lời không hợp lệ.");
    }

    const session = db.prepare("SELECT * FROM competition_sessions WHERE session_token = ? AND user_id = ?").get(sessionToken, user.id);
    if (!session) return error(response, 404, "Không tìm thấy phiên thi đấu.");

    const currentExpectedIndex = session.current_question_index || 1;
    if (questionIndex !== undefined && questionIndex !== null && Number(questionIndex) !== currentExpectedIndex) {
      return error(response, 400, `Thứ tự câu hỏi không khớp. Phiên thi đang ở câu ${currentExpectedIndex}.`);
    }
    questionIndex = currentExpectedIndex;

    if (session.status !== "in_progress") {
      const resData = {
        phase: session.phase,
        totalScore: session.total_score,
        correctPoints: session.correct_points,
        firstTryBonus: session.first_try_bonus,
        firstTryBonusPoints: session.first_try_bonus,
        timePoints: session.time_points,
        remainingSeconds: session.remaining_seconds,
        correctCount: session.correct_count,
        correctAnswersCount: session.correct_count,
        firstTryCount: session.first_try_correct_count,
        phaseBestScore: session.total_score
      };
      return json(response, 200, {
        sessionCompleted: true,
        isQuizCompleted: true,
        message: "Phiên thi đấu đã kết thúc.",
        result: resData,
        finalResult: resData
      });
    }

    const nowMs = getVietnamTimestampMs();
    let effectiveRemaining = session.remaining_seconds;
    if (!session.is_paused) {
      const elapsed = Math.max(0, Math.floor((nowMs - session.server_start_timestamp_ms) / 1000));
      effectiveRemaining = Math.min(600, Math.max(0, session.remaining_seconds - elapsed - (session.accumulated_penalty_seconds || 0)));
    } else {
      effectiveRemaining = Math.min(600, Math.max(0, session.remaining_seconds));
    }

    if (effectiveRemaining <= 0 || selectedOption === "TIMEOUT") {
      effectiveRemaining = 0;
      const onTimeBonus = (session.is_on_time === 1 && (session.phase === 1 || session.phase === 2)) ? 50 : 0;
      const finalScore = session.correct_points + session.first_try_bonus + onTimeBonus;
      db.prepare(`
        UPDATE competition_sessions 
        SET status = 'expired', remaining_seconds = 0, time_points = 0, on_time_bonus = ?, total_score = ?, finished_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(onTimeBonus, finalScore, session.id);

      const bestScore = updateUserPhaseBestScore(user.id, session.competition_id, session.phase, finalScore, session.id, onTimeBonus);

      const resData = {
        phase: session.phase,
        totalScore: finalScore,
        correctPoints: session.correct_points,
        firstTryBonus: session.first_try_bonus,
        firstTryBonusPoints: session.first_try_bonus,
        timePoints: 0,
        onTimeBonus,
        remainingSeconds: 0,
        correctCount: session.correct_count,
        correctAnswersCount: session.correct_count,
        firstTryCount: session.first_try_correct_count,
        bestScore,
        phaseBestScore: bestScore
      };

      return json(response, 200, {
        isCorrect: false,
        sessionCompleted: true,
        isQuizCompleted: true,
        timeExpired: true,
        remainingSeconds: 0,
        remainingTime: 0,
        result: resData,
        finalResult: resData
      });
    }

    const question = db.prepare(
      "SELECT * FROM competition_questions WHERE competition_id = ? AND phase = ? AND question_index = ?"
    ).get(session.competition_id, session.phase, questionIndex);

    if (!question) return error(response, 404, "Không tìm thấy câu hỏi.");
    if (body.questionId && Number(body.questionId) !== question.id) {
      return error(response, 400, "Mã câu hỏi không khớp với câu hỏi hiện tại.");
    }

    let answerRow = db.prepare(
      "SELECT * FROM competition_answers WHERE session_id = ? AND question_index = ?"
    ).get(session.id, questionIndex);

    if (!answerRow) {
      db.prepare(`
        INSERT INTO competition_answers (session_id, question_id, question_index, tries_count, is_correct, history_json)
        VALUES (?, ?, ?, 0, 0, '[]')
      `).run(session.id, question.id, questionIndex);
      answerRow = db.prepare("SELECT * FROM competition_answers WHERE session_id = ? AND question_index = ?").get(session.id, questionIndex);
    }

    if (answerRow.is_finalized) {
      return error(response, 400, "Câu hỏi này đã hoàn thành.");
    }

    const history = JSON.parse(answerRow.history_json || "[]");
    if (history.includes(selectedOption)) {
      return error(response, 400, "Bạn đã chọn đáp án này rồi.");
    }

    history.push(selectedOption);
    const triesCount = answerRow.tries_count + 1;
    const isCorrect = (selectedOption === question.correct_option);

    if (isCorrect) {
      const isFirstTry = (triesCount === 1) ? 1 : 0;
      const addCorrectPts = 40;
      const addBonusPts = isFirstTry ? 10 : 0;
      const pointsEarned = addCorrectPts + addBonusPts;

      const newCorrectPoints = session.correct_points + addCorrectPts;
      const newFirstTryBonus = session.first_try_bonus + addBonusPts;
      const newCorrectCount = session.correct_count + 1;
      const newFirstTryCount = session.first_try_correct_count + isFirstTry;

      db.prepare(`
        UPDATE competition_answers 
        SET tries_count = ?, is_correct = 1, is_first_try = ?, history_json = ?, is_finalized = 1
        WHERE id = ?
      `).run(triesCount, isFirstTry, JSON.stringify(history), answerRow.id);

      const nextQIndex = questionIndex + 1;

      if (nextQIndex > 10) {
        const timeBonus = effectiveRemaining;
        const onTimeBonus = (session.is_on_time === 1 && (session.phase === 1 || session.phase === 2)) ? 50 : 0;
        const totalScore = newCorrectPoints + newFirstTryBonus + timeBonus + onTimeBonus;

        db.prepare(`
          UPDATE competition_sessions
          SET current_question_index = 10,
              correct_count = ?,
              first_try_correct_count = ?,
              correct_points = ?,
              first_try_bonus = ?,
              time_points = ?,
              on_time_bonus = ?,
              total_score = ?,
              remaining_seconds = ?,
              status = 'completed',
              finished_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(newCorrectCount, newFirstTryCount, newCorrectPoints, newFirstTryBonus, timeBonus, onTimeBonus, totalScore, effectiveRemaining, session.id);

        const bestScore = updateUserPhaseBestScore(user.id, session.competition_id, session.phase, totalScore, session.id, onTimeBonus);

        const resData = {
          phase: session.phase,
          totalScore,
          correctPoints: newCorrectPoints,
          firstTryBonus: newFirstTryBonus,
          firstTryBonusPoints: newFirstTryBonus,
          timePoints: timeBonus,
          onTimeBonus,
          remainingSeconds: effectiveRemaining,
          correctCount: newCorrectCount,
          correctAnswersCount: newCorrectCount,
          firstTryCount: newFirstTryCount,
          bestScore,
          phaseBestScore: bestScore
        };

        return json(response, 200, {
          isCorrect: true,
          isFirstTry: Boolean(isFirstTry),
          isFirstTryBonus: Boolean(isFirstTry),
          pointsEarned,
          correctOption: question.correct_option,
          explanation: question.explanation,
          sessionCompleted: true,
          isQuizCompleted: true,
          remainingSeconds: effectiveRemaining,
          remainingTime: effectiveRemaining,
          result: resData,
          finalResult: resData
        });
      } else {
        db.prepare(`
          UPDATE competition_sessions
          SET current_question_index = ?,
              correct_count = ?,
              first_try_correct_count = ?,
              correct_points = ?,
              first_try_bonus = ?,
              remaining_seconds = ?,
              server_start_timestamp_ms = ?,
              accumulated_penalty_seconds = 0
          WHERE id = ?
        `).run(nextQIndex, newCorrectCount, newFirstTryCount, newCorrectPoints, newFirstTryBonus, effectiveRemaining, nowMs, session.id);

        const nextQ = db.prepare(
          "SELECT id, question_index, question_text, option_a, option_b, option_c FROM competition_questions WHERE competition_id = ? AND phase = ? AND question_index = ?"
        ).get(session.competition_id, session.phase, nextQIndex);

        return json(response, 200, {
          isCorrect: true,
          isFirstTry: Boolean(isFirstTry),
          isFirstTryBonus: Boolean(isFirstTry),
          pointsEarned,
          correctOption: question.correct_option,
          explanation: question.explanation,
          sessionCompleted: false,
          isQuizCompleted: false,
          currentQuestionIndex: nextQIndex,
          remainingSeconds: effectiveRemaining,
          remainingTime: effectiveRemaining,
          correctCount: newCorrectCount,
          firstTryCorrectCount: newFirstTryCount,
          correctPoints: newCorrectPoints,
          firstTryBonus: newFirstTryBonus,
          nextQuestion: nextQ ? {
            id: nextQ.id,
            index: nextQ.question_index,
            text: nextQ.question_text,
            optionA: nextQ.option_a,
            optionB: nextQ.option_b,
            optionC: nextQ.option_c
          } : null
        });
      }
    } else {
      // WRONG ANSWER
      const penalty = 30;
      const newPenaltyTotal = session.accumulated_penalty_seconds + penalty;
      effectiveRemaining = Math.max(0, effectiveRemaining - penalty);

      if (effectiveRemaining === 0) {
        db.prepare(`
          UPDATE competition_answers 
          SET tries_count = ?, history_json = ?, is_finalized = 1, penalty_seconds = penalty_seconds + ?
          WHERE id = ?
        `).run(triesCount, JSON.stringify(history), penalty, answerRow.id);

        const finalScore = session.correct_points + session.first_try_bonus;
        db.prepare(`
          UPDATE competition_sessions 
          SET accumulated_penalty_seconds = ?,
              remaining_seconds = 0,
              time_points = 0,
              total_score = ?,
              status = 'expired',
              finished_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(newPenaltyTotal, finalScore, session.id);

        const bestScore = updateUserPhaseBestScore(user.id, session.competition_id, session.phase, finalScore, session.id);

        const resData = {
          phase: session.phase,
          totalScore: finalScore,
          correctPoints: session.correct_points,
          firstTryBonus: session.first_try_bonus,
          firstTryBonusPoints: session.first_try_bonus,
          timePoints: 0,
          remainingSeconds: 0,
          correctCount: session.correct_count,
          correctAnswersCount: session.correct_count,
          firstTryCount: session.first_try_correct_count,
          bestScore,
          phaseBestScore: bestScore
        };

        return json(response, 200, {
          isCorrect: false,
          triesCount,
          penaltySeconds: penalty,
          remainingSeconds: 0,
          remainingTime: 0,
          sessionCompleted: true,
          isQuizCompleted: true,
          timeExpired: true,
          result: resData,
          finalResult: resData
        });
      }

      if (triesCount < 3) {
        db.prepare(`
          UPDATE competition_answers 
          SET tries_count = ?, history_json = ?, penalty_seconds = penalty_seconds + ?
          WHERE id = ?
        `).run(triesCount, JSON.stringify(history), penalty, answerRow.id);

        db.prepare(`
          UPDATE competition_sessions 
          SET remaining_seconds = ?,
              server_start_timestamp_ms = ?,
              accumulated_penalty_seconds = 0
          WHERE id = ?
        `).run(effectiveRemaining, nowMs, session.id);

        return json(response, 200, {
          isCorrect: false,
          triesCount,
          penaltySeconds: penalty,
          remainingSeconds: effectiveRemaining,
          remainingTime: effectiveRemaining,
          allowRetry: true,
          disabledOptions: history,
          sessionCompleted: false,
          isQuizCompleted: false
        });
      } else {
        db.prepare(`
          UPDATE competition_answers 
          SET tries_count = ?, history_json = ?, is_finalized = 1, penalty_seconds = penalty_seconds + ?
          WHERE id = ?
        `).run(triesCount, JSON.stringify(history), penalty, answerRow.id);

        const nextQIndex = questionIndex + 1;

        if (nextQIndex > 10) {
          const timeBonus = effectiveRemaining;
          const onTimeBonus = (session.is_on_time === 1 && (session.phase === 1 || session.phase === 2)) ? 50 : 0;
          const totalScore = session.correct_points + session.first_try_bonus + timeBonus + onTimeBonus;

          db.prepare(`
            UPDATE competition_sessions 
            SET current_question_index = 10,
                accumulated_penalty_seconds = ?,
                time_points = ?,
                on_time_bonus = ?,
                total_score = ?,
                remaining_seconds = ?,
                status = 'completed',
                finished_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(newPenaltyTotal, timeBonus, onTimeBonus, totalScore, effectiveRemaining, session.id);

          const bestScore = updateUserPhaseBestScore(user.id, session.competition_id, session.phase, totalScore, session.id, onTimeBonus);

          const resData = {
            phase: session.phase,
            totalScore,
            correctPoints: session.correct_points,
            firstTryBonus: session.first_try_bonus,
            firstTryBonusPoints: session.first_try_bonus,
            timePoints: timeBonus,
            onTimeBonus,
            remainingSeconds: effectiveRemaining,
            correctCount: session.correct_count,
            correctAnswersCount: session.correct_count,
            firstTryCount: session.first_try_correct_count,
            bestScore,
            phaseBestScore: bestScore
          };

          return json(response, 200, {
            isCorrect: false,
            triesCount: 3,
            penaltySeconds: penalty,
            correctOption: question.correct_option,
            explanation: question.explanation,
            sessionCompleted: true,
            isQuizCompleted: true,
            remainingSeconds: effectiveRemaining,
            remainingTime: effectiveRemaining,
            result: resData,
            finalResult: resData
          });
        } else {
          db.prepare(`
            UPDATE competition_sessions 
            SET current_question_index = ?,
                remaining_seconds = ?,
                server_start_timestamp_ms = ?,
                accumulated_penalty_seconds = 0
            WHERE id = ?
          `).run(nextQIndex, effectiveRemaining, nowMs, session.id);

          const nextQ = db.prepare(
            "SELECT id, question_index, question_text, option_a, option_b, option_c FROM competition_questions WHERE competition_id = ? AND phase = ? AND question_index = ?"
          ).get(session.competition_id, session.phase, nextQIndex);

          return json(response, 200, {
            isCorrect: false,
            triesCount: 3,
            penaltySeconds: penalty,
            isLocked: true,
            correctOption: question.correct_option,
            explanation: question.explanation,
            sessionCompleted: false,
            isQuizCompleted: false,
            currentQuestionIndex: nextQIndex,
            remainingSeconds: effectiveRemaining,
            remainingTime: effectiveRemaining,
            nextQuestion: nextQ ? {
              id: nextQ.id,
              index: nextQ.question_index,
              text: nextQ.question_text,
              optionA: nextQ.option_a,
              optionB: nextQ.option_b,
              optionC: nextQ.option_c
            } : null
          });
        }
      }
    }
  }

  if (method === "POST" && pathName === "/api/competition/session/heartbeat") {
    const user = requireUser(request, response);
    if (!user) return;
    const { sessionToken } = await readJSON(request);
    const session = db.prepare("SELECT * FROM competition_sessions WHERE session_token = ? AND user_id = ?").get(sessionToken, user.id);
    if (!session) return error(response, 404, "Không tìm thấy phiên.");
    
    const nowMs = getVietnamTimestampMs();
    let remaining = session.remaining_seconds;
    if (!session.is_paused) {
      const elapsed = Math.max(0, Math.floor((nowMs - session.server_start_timestamp_ms) / 1000));
      remaining = Math.min(600, Math.max(0, session.remaining_seconds - elapsed - (session.accumulated_penalty_seconds || 0)));
    } else {
      remaining = Math.min(600, Math.max(0, session.remaining_seconds));
    }
    return json(response, 200, { ok: true, remainingSeconds: remaining, status: session.status, isPaused: Boolean(session.is_paused), exitCount: session.exit_count || 0 });
  }

  if (method === "POST" && pathName === "/api/competition/session/pause") {
    const user = requireUser(request, response);
    if (!user) return;
    if (!requireCsrf(request, response, user)) return;

    const body = await readJSON(request);
    const { sessionToken } = body;
    if (!sessionToken) return error(response, 400, "Thiếu sessionToken.");

    const session = db.prepare("SELECT * FROM competition_sessions WHERE session_token = ? AND user_id = ?").get(sessionToken, user.id);
    if (!session) return error(response, 404, "Không tìm thấy phiên thi đấu.");

    if (session.status !== "in_progress") {
      return json(response, 200, { ok: true, status: session.status, isPaused: false, message: "Phiên thi đấu đã kết thúc." });
    }

    const nowMs = getVietnamTimestampMs();
    let serverRemaining = session.remaining_seconds;
    if (!session.is_paused) {
      const elapsed = Math.max(0, Math.floor((nowMs - session.server_start_timestamp_ms) / 1000));
      serverRemaining = Math.min(600, Math.max(0, session.remaining_seconds - elapsed - (session.accumulated_penalty_seconds || 0)));
    } else {
      serverRemaining = Math.min(600, Math.max(0, session.remaining_seconds));
    }

    const currentExits = session.exit_count || 0;
    const newExitCount = currentExits + 1;

    // Check if this is the 3rd exit: LIMIT IS MAX 2 EXITS!
    if (newExitCount >= 3) {
      // Dừng và tính điểm bài thi luôn
      const onTimeBonus = (session.is_on_time === 1 && (session.phase === 1 || session.phase === 2)) ? 50 : 0;
      const totalScore = (session.correct_points || 0) + (session.first_try_bonus || 0) + onTimeBonus;
      db.prepare(`
        UPDATE competition_sessions 
        SET status = 'completed',
            remaining_seconds = 0,
            is_paused = 0,
            exit_count = ?,
            on_time_bonus = ?,
            total_score = ?,
            finished_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newExitCount, onTimeBonus, totalScore, session.id);

      const bestScore = updateUserPhaseBestScore(user.id, session.competition_id, session.phase, totalScore, session.id, onTimeBonus);

      const resData = {
        phase: session.phase,
        totalScore,
        correctPoints: session.correct_points,
        firstTryBonus: session.first_try_bonus,
        firstTryBonusPoints: session.first_try_bonus,
        timePoints: 0,
        onTimeBonus,
        remainingSeconds: 0,
        correctCount: session.correct_count,
        correctAnswersCount: session.correct_count,
        firstTryCount: session.first_try_correct_count,
        bestScore,
        phaseBestScore: bestScore
      };

      return json(response, 200, {
        ok: true,
        completed: true,
        forcedSubmit: true,
        exitCount: newExitCount,
        message: "Bạn đã thoát lần thứ 3. Hệ thống đã dừng và tính điểm bài thi của bạn!",
        result: resData
      });
    }

    // Normal exit (lần 1 hoặc 2): Lưu tiến trình và tạm dừng thời gian
    if (serverRemaining <= 0) {
      db.prepare("UPDATE competition_sessions SET status = 'expired', remaining_seconds = 0, is_paused = 0, exit_count = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?").run(newExitCount, session.id);
      return json(response, 200, {
        ok: true,
        completed: true,
        timeExpired: true,
        exitCount: newExitCount,
        remainingSeconds: 0,
        message: "Bài thi đã hết thời gian làm bài."
      });
    }

    db.prepare(`
      UPDATE competition_sessions 
      SET remaining_seconds = ?,
          server_start_timestamp_ms = ?,
          accumulated_penalty_seconds = 0,
          is_paused = 1,
          exit_count = ?
      WHERE id = ?
    `).run(serverRemaining, nowMs, newExitCount, session.id);

    return json(response, 200, {
      ok: true,
      completed: false,
      isPaused: true,
      remainingSeconds: serverRemaining,
      currentQuestionIndex: session.current_question_index,
      exitCount: newExitCount,
      exitsLeft: 2 - newExitCount,
      message: `Đã lưu tiến trình câu hỏi và tạm dừng thời gian. Bạn còn ${2 - newExitCount} lần thoát.`
    });
  }

  // --- ADMIN COMPETITION APIS ---
  if (method === "GET" && pathName === "/api/admin/competition/overview") {
    const user = requireUser(request, response);
    if (!user || !isSuperAdmin(user)) return user ? error(response, 403, "Chỉ TA/Admin mới có quyền này.") : undefined;

    const vnNow = getVietnamNow();
    const comp = getOrCreateCurrentCompetition(vnNow);
    const timeState = getCompetitionTimeState(vnNow, comp);

    const qCounts = {
      phase1: db.prepare("SELECT count(*) as c FROM competition_questions WHERE competition_id = ? AND phase = 1").get(comp.id)?.c || 0,
      phase2: db.prepare("SELECT count(*) as c FROM competition_questions WHERE competition_id = ? AND phase = 2").get(comp.id)?.c || 0,
      phase3: db.prepare("SELECT count(*) as c FROM competition_questions WHERE competition_id = ? AND phase = 3").get(comp.id)?.c || 0
    };

    const participantsCount = db.prepare(
      "SELECT count(DISTINCT user_id) as c FROM competition_phase_results WHERE competition_id = ?"
    ).get(comp.id)?.c || 0;

    const totalSessions = db.prepare(
      "SELECT count(*) as c FROM competition_sessions WHERE competition_id = ?"
    ).get(comp.id)?.c || 0;

    const allWeeks = db.prepare("SELECT * FROM weekly_competitions ORDER BY id DESC LIMIT 10").all();

    return json(response, 200, {
      ok: true,
      currentCompetition: comp,
      timeState,
      qCounts,
      participantsCount,
      totalSessions,
      simulatedTimeOffsetMs,
      serverTime: vnNow.toISOString(),
      allWeeks
    });
  }

  if (method === "GET" && pathName === "/api/admin/competition/questions") {
    const user = requireUser(request, response);
    if (!user || !isSuperAdmin(user)) return user ? error(response, 403, "Chỉ TA/Admin mới có quyền này.") : undefined;

    const vnNow = getVietnamNow();
    const comp = getOrCreateCurrentCompetition(vnNow);
    const compId = Number(url.searchParams.get("competitionId")) || comp.id;
    const phase = Math.min(3, Math.max(1, Number(url.searchParams.get("phase")) || 1));

    const questions = db.prepare(
      "SELECT id, question_index, question_text, option_a, option_b, option_c, correct_option, explanation FROM competition_questions WHERE competition_id = ? AND phase = ? ORDER BY question_index ASC"
    ).all(compId, phase);

    const formatted = questions.map(q => ({
      id: q.id,
      question_index: q.question_index,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      correct_option: q.correct_option,
      explanation: q.explanation || "",
      // Aliases for camelCase
      questionNumber: q.question_index,
      questionText: q.question_text,
      optionA: q.option_a,
      optionB: q.option_b,
      optionC: q.option_c,
      correctOption: q.correct_option
    }));

    return json(response, 200, {
      ok: true,
      competitionId: compId,
      phase,
      questions: formatted
    });
  }

  if (method === "POST" && pathName === "/api/admin/competition/questions") {
    const user = requireUser(request, response);
    if (!user || !isSuperAdmin(user)) return user ? error(response, 403, "Chỉ TA/Admin mới có quyền này.") : undefined;
    if (!requireCsrf(request, response, user)) return;

    const body = await readJSON(request);
    const { phase, questions } = body;
    // competitionId optional - auto-resolve from current competition
    const vnNow = getVietnamNow();
    const currentComp = getOrCreateCurrentCompetition(vnNow);
    const competitionId = body.competitionId || currentComp.id;

    if (!competitionId || !phase || !Array.isArray(questions)) {
      return error(response, 400, "Dữ liệu câu hỏi không hợp lệ.");
    }

    db.exec("BEGIN");
    try {
      // 1. Delete dependent answers to prevent FOREIGN KEY constraint failed error
      db.prepare(`
        DELETE FROM competition_answers 
        WHERE question_id IN (
          SELECT id FROM competition_questions WHERE competition_id = ? AND phase = ?
        )
      `).run(competitionId, phase);

      // 2. Delete old questions for this phase
      db.prepare("DELETE FROM competition_questions WHERE competition_id = ? AND phase = ?").run(competitionId, phase);

      const insert = db.prepare(`
        INSERT INTO competition_questions (
          competition_id, phase, question_index, question_text, option_a, option_b, option_c, correct_option, explanation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const idx = i + 1;
        insert.run(
          competitionId,
          phase,
          idx,
          q.question_text || q.questionText || q.text || `Câu hỏi ${idx}`,
          q.option_a || q.optionA || "Đáp án A",
          q.option_b || q.optionB || "Đáp án B",
          q.option_c || q.optionC || "Đáp án C",
          q.correct_option || q.correctOption || q.correct || "A",
          q.explanation || ""
        );
      }
      db.exec("COMMIT");
      return json(response, 200, { ok: true, count: questions.length });
    } catch (e) {
      db.exec("ROLLBACK");
      return error(response, 500, e.message);
    }
  }

  if (method === "POST" && pathName === "/api/admin/competition/update-topics") {
    const user = requireUser(request, response);
    if (!user || !isSuperAdmin(user)) return user ? error(response, 403, "Chỉ TA/Admin mới có quyền này.") : undefined;
    if (!requireCsrf(request, response, user)) return;

    const body = await readJSON(request);
    // competitionId optional - auto-resolve; accept weekTopic or topicName
    const vnNow = getVietnamNow();
    const currentComp = getOrCreateCurrentCompetition(vnNow);
    const competitionId = body.competitionId || currentComp.id;
    const topicName = body.topicName || body.weekTopic || null;
    const weekNumber = (body.weekNumber !== undefined && body.weekNumber !== null && !isNaN(parseInt(body.weekNumber, 10))) 
      ? parseInt(body.weekNumber, 10) 
      : null;
    const { phase1Topic = null, phase2Topic = null, phase3Topic = null } = body;
    if (!competitionId) return error(response, 400, "Thiếu competitionId.");

    db.prepare(`
      UPDATE weekly_competitions 
      SET week_number = coalesce(?, week_number),
          topic_name = coalesce(?, topic_name),
          phase1_topic = coalesce(?, phase1_topic),
          phase2_topic = coalesce(?, phase2_topic),
          phase3_topic = coalesce(?, phase3_topic)
      WHERE id = ?
    `).run(weekNumber, topicName, phase1Topic, phase2Topic, phase3Topic, competitionId);

    return json(response, 200, { ok: true, weekNumber });
  }

  if (method === "POST" && pathName === "/api/admin/competition/seed-samples") {
    const user = requireUser(request, response);
    if (!user || !isSuperAdmin(user)) return user ? error(response, 403, "Chỉ TA/Admin mới có quyền này.") : undefined;
    if (!requireCsrf(request, response, user)) return;

    const vnNow = getVietnamNow();
    const comp = getOrCreateCurrentCompetition(vnNow);
    seedSampleCompetitionQuestions(comp.id);
    return json(response, 200, { ok: true, message: "Đã nạp 30 câu hỏi mẫu cho 3 giai đoạn." });
  }

  if (method === "POST" && pathName === "/api/admin/competition/simulate-time") {
    const user = requireUser(request, response);
    if (!user || !isSuperAdmin(user)) return user ? error(response, 403, "Chỉ TA/Admin mới có quyền này.") : undefined;
    if (!requireCsrf(request, response, user)) return;

    const { preset, customIso } = await readJSON(request);
    const realVnNow = getVietnamRealNow();

    if (preset === "real" || preset === "reset") {
      simulatedTimeOffsetMs = 0;
    } else if (preset === "upcoming" || preset === "16:30") {
      const target = new Date(realVnNow);
      if (target.getDay() === 0) target.setDate(target.getDate() + 1);
      target.setHours(16, 30, 0, 0);
      simulatedTimeOffsetMs = target.getTime() - realVnNow.getTime();
    } else if (preset === "open" || preset === "19:30") {
      const target = new Date(realVnNow);
      if (target.getDay() === 0) target.setDate(target.getDate() + 1);
      target.setHours(19, 30, 0, 0);
      simulatedTimeOffsetMs = target.getTime() - realVnNow.getTime();
    } else if (preset === "reviewing" || preset === "23:30") {
      const target = new Date(realVnNow);
      if (target.getDay() === 0) target.setDate(target.getDate() + 1);
      target.setHours(23, 30, 0, 0);
      simulatedTimeOffsetMs = target.getTime() - realVnNow.getTime();
    } else if (preset === "sunday" || preset === "summary") {
      const { sunday } = getWeekRange(realVnNow);
      const target = new Date(sunday);
      target.setHours(10, 0, 0, 0);
      simulatedTimeOffsetMs = target.getTime() - realVnNow.getTime();
    } else if (customIso) {
      const target = new Date(customIso);
      simulatedTimeOffsetMs = target.getTime() - realVnNow.getTime();
    }

    notifyCompetitionResultsChanged();

    const currentSimVnNow = getVietnamNow();
    return json(response, 200, {
      ok: true,
      simulatedTimeOffsetMs,
      serverTime: currentSimVnNow.toISOString(),
      displayTime: currentSimVnNow.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
    });
  }

  if (method === "POST" && pathName === "/api/admin/competition/conclude-week") {
    const user = requireUser(request, response);
    if (!user || !isSuperAdmin(user)) return user ? error(response, 403, "Chỉ TA/Admin mới có quyền này.") : undefined;
    if (!requireCsrf(request, response, user)) return;

    const vnNow = getVietnamNow();
    const comp = getOrCreateCurrentCompetition(vnNow);
    const result = awardCompetitionSundayRewards(comp.id);
    return json(response, 200, { ok: true, result });
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
  const headers = {
    "Content-Type": MIME[extension] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
  };
  if (relative.startsWith("/public/") || [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".ico", ".mp3", ".wav", ".woff2", ".ttf"].includes(extension)) {
    headers["Cache-Control"] = "public, max-age=86400, stale-while-revalidate=604800";
  } else if ([".css", ".js"].includes(extension)) {
    headers["Cache-Control"] = "public, max-age=3600";
  }
  response.writeHead(200, headers);
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
});

// --- Cron Job Thưởng Điểm Năng Động Tuần (+5 điểm) ---
function checkAndAwardWeeklyRewards() {
  try {
    const vnNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    const dayOfWeek = vnNow.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const hours = vnNow.getHours();

    const formatYMD = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    const weeksToCheck = [];

    // Nếu là tối Chủ Nhật từ 23h trở đi (gần kết thúc tuần), xét duyệt ngay cho tuần hiện tại
    if (dayOfWeek === 0 && hours >= 23) {
      const currentSunday = new Date(vnNow.getFullYear(), vnNow.getMonth(), vnNow.getDate());
      const currentMonday = new Date(currentSunday);
      currentMonday.setDate(currentSunday.getDate() - 6);
      weeksToCheck.push({ monday: formatYMD(currentMonday), sunday: formatYMD(currentSunday) });
    }

    // Luôn kiểm tra tuần trước đó (kết thúc vào Chủ Nhật vừa qua) để tránh sót nếu server khởi động lại
    const daysSinceLastSunday = dayOfWeek === 0 ? 7 : dayOfWeek;
    const lastSunday = new Date(vnNow.getFullYear(), vnNow.getMonth(), vnNow.getDate() - daysSinceLastSunday);
    const lastMonday = new Date(lastSunday);
    lastMonday.setDate(lastSunday.getDate() - 6);
    weeksToCheck.push({ monday: formatYMD(lastMonday), sunday: formatYMD(lastSunday) });

    for (const week of weeksToCheck) {
      const key = `weekly_active_reward_${week.sunday}`;
      const kv = db.prepare("SELECT value FROM kv_store WHERE key = ?").get(key);
      if (!kv) {
        const users = db.prepare(`
          SELECT user_id, count(DISTINCT activity_date) as activeDays 
          FROM activity_days 
          WHERE activity_date >= ? AND activity_date <= ?
          GROUP BY user_id
          HAVING activeDays >= 3
        `).all(week.monday, week.sunday);

        const insertEvent = db.prepare(
          "INSERT INTO contribution_events(user_id,event_type,points,reference_type,reference_id,reason) VALUES (?,?,?,?,?,?)"
        );

        db.exec("BEGIN");
        try {
          for (const u of users) {
            insertEvent.run(
              u.user_id,
              'weekly_active_reward',
              5,
              null,
              null,
              `Điểm năng động tuần (Thắp sáng ${u.activeDays}/7 ngày từ ${week.monday} đến ${week.sunday})`
            );
          }
          db.prepare("INSERT INTO kv_store(key, value) VALUES (?, '1')").run(key);
          db.exec("COMMIT");
          console.log(`Cronjob: Điểm năng động tuần (+5đ) (${week.monday} -> ${week.sunday}) đã trao cho ${users.length} thành viên.`);
        } catch (err) {
          db.exec("ROLLBACK");
          throw err;
        }
      }
    }
  } catch (e) {
    console.error("Cronjob thưởng tuần lỗi:", e);
  }
}

// Dọn dẹp dữ liệu cũ nếu từng tồn tại sự kiện thưởng tuần +10đ trùng lặp
try {
  db.prepare("DELETE FROM contribution_events WHERE event_type = 'weekly_active_reward' AND (points = 10 OR reason = 'Thưởng điểm hoạt động tích cực tuần vừa rồi')").run();
  db.prepare("DELETE FROM kv_store WHERE key LIKE 'reward_given_%'").run();
} catch (e) {}

// Chạy kiểm tra khi khởi động và định kỳ mỗi 1 phút (+5 điểm năng động tuần và tổng kết thi đua Chủ Nhật)
function checkAndAwardSundayCompetitionRewards() {
  try {
    const vnNow = getVietnamNow();
    if (vnNow.getDay() === 0) {
      const comp = getOrCreateCurrentCompetition(vnNow);
      if (comp && comp.status !== 'concluded') {
        awardCompetitionSundayRewards(comp.id);
      }
    }
  } catch (e) {
    console.error("Cronjob thi đua tuần lỗi:", e);
  }
}

checkAndAwardWeeklyRewards();
checkAndAwardSundayCompetitionRewards();
setInterval(checkAndAwardWeeklyRewards, 60000);
setInterval(checkAndAwardSundayCompetitionRewards, 60000);

server.listen(PORT, "::", () =>
  console.log(`RE:SEARCH đang chạy tại http://[::]:${PORT}`),
);
