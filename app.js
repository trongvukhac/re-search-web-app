let topics = [];
let allTopics = [];
const seedPosts = [];
const documents = [];
let posts = [...seedPosts];
let currentFilter = "all";
let currentDocFilter = "all";
let anonymous = false;
let session = null;
let csrfToken = null;
const serverMode =
  location.protocol === "http:" || location.protocol === "https:";
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const STUDY_SETTINGS_KEY = "research_study_settings_v1";
const STUDY_MAINTENANCE_MSG = "Tính năng Phòng tự học đang được phát triển và cần thời gian để ổn định hệ thống, bạn quay lại sau nhé!";

function canAccessStudyLounge(user = (session || (typeof window !== "undefined" && window.session))) {
  return true;
}
window.canAccessStudyLounge = canAccessStudyLounge;

function canAccessArena(user = (session || (typeof window !== "undefined" && window.session))) {
  return true;
}
window.canAccessArena = canAccessArena;

const compState = {
  status: null,
  overview: null,
  currentSession: null,
  activeTab: "gateway",
  activeLbPhase: "1",
  cachedLeaderboard: {},
  lastResultsVersion: null,
  
  // Tickers
  homeTimerInterval: null,
  gatewayTimerInterval: null,
  quizTimerInterval: null,
  
  // Quiz live state
  currentQIndex: 0,
  questionTries: 0,
  isSubmittingAnswer: false,
  quizRemainingSeconds: 600,
  quizLiveStars: 0,
  quizTotalCorrect: 0,
  quizFirstTryBonusCount: 0,
  activeQuestions: [],
  sessionToken: null,
  
  // Confetti
  confettiAnimationId: null,
  
  // Admin
  adminSelectedPhase: 1,
  adminQuestions: [],
  
  // Audio
  audioCtx: null
};
window.compState = compState;

window.notifyPerkLocked = function(days, featureName) {
  toast(`🔒 Tính năng "${featureName}" mở khóa ở Chuỗi ${days} ngày! Bền bỉ học tập mỗi ngày để mở khóa nhé 🔥`);
};

function getInitialStudySettings() {
  const defaults = {
    focusMins: 25,
    shortBreakMins: 5,
    longBreakMins: 15,
    autoStartBreaks: true,
    autoStartPomodoros: false,
    browserNotifications: false,
    alarmSound: "bell",
    activeWallpaper: "default",
    wallpaperDim: 35,
    cardGlassOpacity: 50,
    activeAura: "emerald",
    clockColor: "default"
  };
  try {
    const saved = localStorage.getItem(STUDY_SETTINGS_KEY);
    return saved ? Object.assign(defaults, JSON.parse(saved)) : defaults;
  } catch (e) {
    return defaults;
  }
}

let studySettings = getInitialStudySettings();

let studyState = {
  mode: 'focus', // 'focus', 'shortbreak', 'longbreak'
  durationMinutes: 25,
  remainingSeconds: 25 * 60,
  targetEndMs: 0,
  cycleIndex: 1, // 1..4 (Hiệp 1/4 -> 4/4)
  completedFocusCycles: 0,
  accumulatedFocusMinutes: 0,
  isRunning: false,
  timerInterval: null,
  syncHeartbeatInterval: null,
  pollingInterval: null,
  elapsedSessionSeconds: 0,
  goal: '',
  lastSyncMs: 0,
  audioCtx: null,
  // 1. Ambient Environment Audio (4 Tracks + Custom)
  activeEnvTrack: null, // string trackId or null
  envAudioPlayers: {},  // trackId -> Audio element
  envNodes: null,       // synth nodes
  envGainNode: null,    // synth gainNode
  activeCustomEnvId: null,
  customEnvAudioPlayer: null,
  // 2. Mixable Sound Effects (9 Tracks + Custom)
  activeMixSounds: {},  // trackId -> boolean
  mixAudioPlayers: {},  // trackId -> Audio element
  mixSoundNodes: {},    // trackId -> synth nodes
  mixSoundGains: {},    // trackId -> gainNode
  activeCustomMixSounds: {}, // customTrackId -> boolean
  customMixAudioPlayers: {}, // customTrackId -> Audio element
  // 3. Focus Music Audio (4 Tracks + Custom)
  activeMusicTrack: null, // string trackId or null
  musicAudioPlayers: {},  // trackId -> Audio element
  musicNodes: null,       // synth nodes
  musicGainNode: null,    // synth gainNode
  activeCustomMusicId: null,
  customMusicAudioPlayer: null,
  // Custom audio lists
  customEnvAudioTracks: [],
  customMixAudioTracks: [],
  customMusicAudioTracks: [],
  activeSoundTab: 'env',
  // Saved user volume preferences per track
  envVolumes: {},
  mixVolumes: {},
  musicVolumes: {},
  customVolumes: {}
};

function setSubmitLoading(formOrEvent, isLoading) {
  let btn;
  if (formOrEvent instanceof Event) {
    btn = formOrEvent.target.querySelector('button[type="submit"]');
  } else if (formOrEvent instanceof Element) {
    btn = formOrEvent.querySelector('button[type="submit"]');
  }
  if (!btn) return;
  if (isLoading) {
    btn.disabled = true;
    if (!btn.dataset.originalText) {
      btn.dataset.originalText = btn.innerHTML;
    }
    btn.innerHTML = 'Đang xử lý...';
  } else {
    btn.disabled = false;
    if (btn.dataset.originalText) {
      btn.innerHTML = btn.dataset.originalText;
    }
  }
}

function initEditor(containerId, placeholder = "") {
  return new Quill(`#${containerId}`, {
    theme: 'snow',
    placeholder: placeholder,
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['link'],
        ['clean']
      ]
    }
  });
}
async function requestAPI(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Không thể kết nối với máy chủ.");
  return data;
}
function formatTime(isoStr) {
  if (!isoStr) return "Hôm nay";
  const date = new Date(isoStr);
  if (isNaN(date.getTime())) return "Hôm nay";
  
  const now = new Date();
  const isToday = date.getDate() === now.getDate() &&
                  date.getMonth() === now.getMonth() &&
                  date.getFullYear() === now.getFullYear();
                  
  const timeStr = date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `Hôm nay, ${timeStr}`;
  
  return `${date.toLocaleDateString("vi-VN", { day: '2-digit', month: '2-digit', year: 'numeric' })} lúc ${timeStr}`;
}
function stripHTML(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = DOMPurify.sanitize(html);
  return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
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

function getFlameSVG(tier = 0, size = 20, extraClass = '') {
  const t = Number(tier) || 0;
  let gradStops = '';
  let innerStops = '';
  if (t === 5) {
    gradStops = '<stop offset="0%" stop-color="#7048e8"/><stop offset="50%" stop-color="#f783ac"/><stop offset="100%" stop-color="#ff6b6b"/>';
    innerStops = '<stop offset="0%" stop-color="#ffd43b"/><stop offset="100%" stop-color="#ffffff"/>';
  } else if (t === 4) {
    gradStops = '<stop offset="0%" stop-color="#c92a2a"/><stop offset="100%" stop-color="#ff6b6b"/>';
    innerStops = '<stop offset="0%" stop-color="#ffa8a8"/><stop offset="100%" stop-color="#fff5f5"/>';
  } else if (t === 3) {
    gradStops = '<stop offset="0%" stop-color="#7048e8"/><stop offset="100%" stop-color="#b197fc"/>';
    innerStops = '<stop offset="0%" stop-color="#e599f7"/><stop offset="100%" stop-color="#ffffff"/>';
  } else if (t === 2) {
    gradStops = '<stop offset="0%" stop-color="#e67700"/><stop offset="100%" stop-color="#ffd43b"/>';
    innerStops = '<stop offset="0%" stop-color="#ffe066"/><stop offset="100%" stop-color="#fff9db"/>';
  } else if (t === 1) {
    gradStops = '<stop offset="0%" stop-color="#1864ab"/><stop offset="100%" stop-color="#4dabf7"/>';
    innerStops = '<stop offset="0%" stop-color="#a5d8ff"/><stop offset="100%" stop-color="#e7f5ff"/>';
  } else {
    gradStops = '<stop offset="0%" stop-color="#246247"/><stop offset="100%" stop-color="#6cb28e"/>';
    innerStops = '<stop offset="0%" stop-color="#a9d09b"/><stop offset="100%" stop-color="#dcebd5"/>';
  }

  const gradId = `flameGrad_${t}_${size}_${Math.floor(Math.random()*100000)}`;
  const innerGradId = `flameInner_${t}_${size}_${Math.floor(Math.random()*100000)}`;

  return `<svg class="flame-svg flame-tier-${t} ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="${gradId}" x1="0%" y1="100%" x2="0%" y2="0%">
        ${gradStops}
      </linearGradient>
      <linearGradient id="${innerGradId}" x1="0%" y1="100%" x2="0%" y2="0%">
        ${innerStops}
      </linearGradient>
    </defs>
    <path d="M12 2C12 2 14.5 5.5 14.5 8C14.5 9.2 13.8 10.2 13 11C14.5 10.5 16 11.5 16 13C16 14.2 15.2 15.2 14.2 15.7C15.8 15.2 18 16.5 18 18.5C18 20.4 16.4 22 14.5 22C10.5 22 6 18.5 6 13.5C6 8.5 12 2 12 2Z" fill="url(#${gradId})"/>
    <path d="M12 9.5C12 9.5 13.5 11.5 13.5 13C13.5 13.8 13 14.5 12.5 15C13.2 14.8 14 15.5 14 16.5C14 17.5 13.2 18.2 12.5 18.5C11.5 18.5 10 17.2 10 15C10 12.8 12 9.5 12 9.5Z" fill="url(#${innerGradId})"/>
  </svg>`;
}

function getAvatarClass(tier, isAnonymous = false, role = '') {
  if (isAnonymous) return 'ink';
  const t = Number(tier) || 0;
  const tierCls = t >= 2 ? `avatar-tier-${t}` : '';
  const roleCls = role === 'admin' ? '' : 'teal';
  return `${roleCls} ${tierCls}`.trim();
}

function getNameClass(tier) {
  const t = Number(tier) || 0;
  if (t >= 3) return `user-name-tier-${t}`;
  return 'user-name-default';
}

const STREAK_MILESTONES = [
  {
    days: 3,
    tier: 1,
    title: "Sinh viên năng động",
    color: "Xanh lam",
    forumDesc: "Mở khoá giao diện thẻ thành tích mới",
    studyDesc: "Mở kho âm thanh môi trường cơ bản, mở khoá tính năng tương tác trong không gian chung"
  },
  {
    days: 7,
    tier: 2,
    title: "Học giả bền bỉ",
    color: "Vàng ánh kim",
    forumDesc: "Mở khoá viền avatar đặc sắc",
    studyDesc: "Mở khoá toàn bộ âm thanh phối âm cơ bản, cho phép bạn tự tạo âm thanh theo ý thích"
  },
  {
    days: 14,
    tier: 3,
    title: "Nhà nghiên cứu tài năng",
    color: "Tím huyền bí",
    forumDesc: "Mở khoá màu tên rực rỡ và avatar đặc sắc",
    studyDesc: "Mở khoá kho hình nền cơ bản và tinh chỉnh màu sắc đồng hồ số"
  },
  {
    days: 30,
    tier: 4,
    title: "Bậc thầy học thuật",
    color: "Đỏ ruby",
    forumDesc: "Mở khóa giao diện độc quyền, màu tên rực rỡ và avatar đặc sắc",
    studyDesc: "Mở khoá tính năng tải âm thanh, cho phép bạn tuỳ biến theo sở thích cá nhân"
  },
  {
    days: 50,
    tier: 5,
    title: "Độc nhất vô nhị",
    color: "Gradient tím + đỏ",
    forumDesc: "Mở khoá giao diện đẳng cấp sang trọng, hào quang rực rỡ đón chờ!",
    studyDesc: "Mở khoá các giao diện độc quyền"
  }
];

function getStreakTitle(streak = 0, tier) {
  const s = Number(streak) || 0;
  const t = Number(tier !== undefined ? tier : getStreakTier(s));
  const milestone = STREAK_MILESTONES.slice().reverse().find(m => m.tier <= t && s >= m.days);
  if (milestone) return milestone.title;
  if (t === 5) return "Độc nhất vô nhị";
  if (t === 4) return "Bậc thầy học thuật";
  if (t === 3) return "Nhà nghiên cứu tài năng";
  if (t === 2) return "Học giả bền bỉ";
  if (t === 1) return "Sinh viên năng động";
  return "Tân binh";
}

window.openStreakJourneyModal = function() {
  const modal = document.getElementById("streakJourneyModal");
  if (!modal) return;
  
  const currentStreak = Number(session?.streak || window.currentStreakCount || 0);
  const listEl = document.getElementById("journeyMilestonesList");
  if (listEl) {
    listEl.innerHTML = STREAK_MILESTONES.map(m => {
      const isUnlocked = currentStreak >= m.days;
      const flame = getFlameSVG(m.tier, 26);
      return `
        <div class="journey-milestone-card ${isUnlocked ? 'unlocked' : ''}">
          <div class="milestone-badge-icon">${flame}</div>
          <div class="milestone-info">
            <div class="milestone-title-row">
              <span class="milestone-days">Mốc ${m.days} ngày · ${m.title}</span>
              <span class="milestone-status">${isUnlocked ? '✓ Đã mở khóa' : `Còn ${m.days - currentStreak} ngày`}</span>
            </div>
            <div class="milestone-perks-container">
              <div class="milestone-perk-row">
                <span class="milestone-perk-tag perk-forum">Diễn đàn</span>
                <span class="milestone-perk-text">${m.forumDesc}</span>
              </div>
              <div class="milestone-perk-row">
                <span class="milestone-perk-tag perk-study">Phòng tự học</span>
                <span class="milestone-perk-text">${m.studyDesc}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }
  modal.showModal();
};

window.closeStreakJourneyModal = function() {
  const modal = document.getElementById("streakJourneyModal");
  if (modal) modal.close();
};

function triggerMilestoneCelebration(streak, tier) {
  if (typeof currentRoute !== "undefined" && currentRoute !== "home") return;
  if (document.querySelector("dialog[open]")) return;
  if (tier < 1) return;

  const storageKey = `re_search_celebrated_tier_${session?.id || 'guest'}`;
  const lastCelebrated = Number(localStorage.getItem(storageKey) || 0);
  if (tier <= lastCelebrated) return;

  localStorage.setItem(storageKey, tier);

  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "999999";
  document.body.appendChild(canvas);

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext("2d");

  const particles = [];
  const colors = ["#ffd43b", "#f783ac", "#7048e8", "#4dabf7", "#ff6b6b", "#69db7c"];
  for (let i = 0; i < 70; i++) {
    particles.push({
      x: canvas.width * 0.5 + (Math.random() - 0.5) * 200,
      y: canvas.height * 0.35 + (Math.random() - 0.5) * 100,
      vx: (Math.random() - 0.5) * 12,
      vy: Math.random() * -10 - 4,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10,
      opacity: 1,
    });
  }

  let startTime = Date.now();
  function animate() {
    const elapsed = Date.now() - startTime;
    if (elapsed > 3500) {
      canvas.remove();
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35;
      p.rotation += p.rotSpeed;
      p.opacity = Math.max(0, 1 - elapsed / 3500);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.opacity;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  toast(`🎉 Chúc mừng bạn đã đạt chuỗi ${streak} ngày và mở khóa đặc quyền mới!`);
}

function normalizePost(p) {
  const authorObj = p.author || {};
  return {
    id: p.id,
    title: p.title,
    content: p.content,
    excerpt: stripHTML(p.content),
    topic: p.topic,
    author: p.isAuthor ? ("Bạn" + (p.isAnonymous || p.anonymous ? " (Ẩn danh)" : "")) : (authorObj.displayName || p.author),
    authorRole: authorObj.role || p.authorRole,
    streakTier: Number(authorObj.streakTier || p.streakTier || 0),
    initials: authorObj.initials || p.initials,
    time: formatTime(p.createdAt),
    createdAt: p.createdAt,
    editedAt: p.editedAt,
    isAuthor: p.isAuthor,
    upvotes: p.helpfulCount || p.upvotes || 0,
    responses: p.responseCount || p.responses || 0,
    anonymous: p.isAnonymous || p.anonymous,
    chosen: Boolean(p.selectedResponseId || p.chosen),
    isPinned: Boolean(p.isPinned),
    lecturerRecommended: Boolean(p.lecturerRecommended),
    readCount: Number(p.readCount || 0),
  };
}
window.getRoleDisplay = function(role) {
  if (role === "admin") return "Admin";
  if (role === "lecturer") return "Giảng viên";
  if (role === "ta") return "TA";
  return "Sinh viên";
};

function applySession(user) {
  session = user || null;
  const roleDisplay = getRoleDisplay(user?.role);
  const streakTier = Number(user?.streakTier || 0);

  // Apply theme shift
  if (streakTier >= 5) {
    document.documentElement.dataset.userTheme = "mythic";
  } else if (streakTier >= 4) {
    document.documentElement.dataset.userTheme = "ruby";
  } else {
    delete document.documentElement.dataset.userTheme;
  }

  $$(".profile-chip-text").forEach(
    (el) =>
      (el.innerHTML = user
        ? `<span class="${getNameClass(streakTier)}">${escapeHTML(user.displayName)}</span> <b>${roleDisplay}</b>`
        : "Đăng nhập"),
  );

  const accountName = $(".account-header h1");
  if (accountName) {
    accountName.textContent = user ? user.displayName : "Khách";
    accountName.className = getNameClass(streakTier);
  }

  const roleLabel = $(".role-label");
  if (roleLabel)
    roleLabel.textContent = user
      ? roleDisplay
      : "Chưa đăng nhập";

  const headerAvatar = $("#headerAvatar");
  if (headerAvatar) {
    headerAvatar.textContent = user ? user.initials || "🦊" : "🦊";
    headerAvatar.className = "avatar avatar-lg " + getAvatarClass(streakTier, false, user?.role);
  }

  const navAvatar = $("#navAvatar");
  if (navAvatar) {
    navAvatar.textContent = user ? user.initials || "🦊" : "🦊";
    navAvatar.className = "avatar avatar-sm " + getAvatarClass(streakTier, false, user?.role);
  }

  const changeBtn = $("#changeAvatarBtn");
  if (changeBtn) {
    if (user && !user.avatarChanged) {
      changeBtn.style.display = "block";
    } else {
      changeBtn.style.display = "none";
    }
  }

  if ($("#openChangePasswordBtn")) {
    $("#openChangePasswordBtn").style.display = user ? "" : "none";
  }
  if ($("#accountSecurityCard")) {
    $("#accountSecurityCard").style.display = user ? "block" : "none";
  }

  const badgeDesk = $("#studyNavBadgeDesktop");
  const badgeMob = $("#studyNavBadgeMobile");
  if (badgeDesk) {
    badgeDesk.textContent = "BETA";
    badgeDesk.className = "study-nav-badge beta";
    badgeDesk.style.display = "inline-block";
  }
  if (badgeMob) {
    badgeMob.textContent = "BETA";
    badgeMob.className = "study-nav-badge mobile beta";
    badgeMob.style.display = "inline-block";
  }

  const notice = $("#studyLockedNotice");
  const mainStudy = $("#studyMainContent");
  if (notice) notice.style.display = "none";
  if (mainStudy) mainStudy.style.display = "block";

  const arenaNotice = $("#arenaLockedNotice");
  const arenaMain = $("#arenaMainContent");
  if (canAccessArena(user)) {
    if (arenaNotice) arenaNotice.style.display = "none";
    if (arenaMain) arenaMain.style.display = "block";
    const adminBar = $("#arenaAdminBar");
    if (adminBar) adminBar.style.display = (user && user.role === "admin") ? "flex" : "none";
  } else {
    if (arenaNotice) arenaNotice.style.display = "block";
    if (arenaMain) arenaMain.style.display = "none";
  }

  if (typeof updateStudyStreakPerks === "function") {
    updateStudyStreakPerks();
  }
  if (typeof fetchStudyLounge === "function") {
    fetchStudyLounge();
  }
  if (currentActiveRoute === "arena") {
    onEnterArena();
  }
}

let currentLeaderboardTab = "contributions";
let cachedLeaderboardData = { leaderboard: [], streakLeaderboard: [] };

window.switchLeaderboardTab = function(tab) {
  currentLeaderboardTab = tab;
  $("#tabTopContrib")?.classList.toggle("active", tab === "contributions");
  $("#tabTopStreak")?.classList.toggle("active", tab === "streak");
  renderLeaderboard();
};

function renderLeaderboard() {
  const lbEl = $("#leaderboardList");
  if (!lbEl) return;

  const isContrib = currentLeaderboardTab === "contributions";
  const list = isContrib
    ? (cachedLeaderboardData.leaderboard || [])
    : (cachedLeaderboardData.streakLeaderboard || []);

  if (!list || list.length === 0) {
    lbEl.innerHTML = `<p style="color: var(--muted); font-size: 13px; text-align: center; padding: 12px 0;">${isContrib ? "Chưa có dữ liệu đóng góp." : "Chưa có dữ liệu chuỗi."}</p>`;
    return;
  }

  lbEl.innerHTML = list
    .map(
      (user, idx) => `
    <div class="leaderboard-item">
      <div class="lb-avatar-wrap">
        <span class="avatar avatar-sm ${getAvatarClass(user.streakTier, false, user.role)}">${user.initials || '?'}</span>
        <span class="lb-rank-badge rank-${idx + 1}">${idx + 1}</span>
      </div>
      <div class="lb-info">
        <span class="lb-name ${getNameClass(user.streakTier)}">${escapeHTML(user.displayName)}</span>
        ${user.role && user.role !== 'student' ? `<span class="lb-role lb-role-${user.role}">${getRoleDisplay(user.role)}</span>` : ""}
      </div>
      <div class="lb-points">${isContrib ? `${user.totalPoints}đ` : `<span style="display:inline-flex;align-items:center;gap:3px;">${getFlameSVG(user.streakTier || 0, 15)} ${user.streak} ngày</span>`}</div>
    </div>
  `
    )
    .join("");
}

let initialStudyRouteHandled = false;

async function hydrateServer() {
  if (!serverMode) return;
  try {
    const current = await requestAPI("/api/session", { headers: {} });
    csrfToken = current.csrfToken;
    applySession(current.user);

    // Only navigate to requested study route ONCE on initial app boot
    if (!initialStudyRouteHandled && typeof initialRequestedRoute !== "undefined" && initialRequestedRoute === "study") {
      initialStudyRouteHandled = true;
      if (canAccessStudyLounge(current.user)) {
        go("study", false);
      } else {
        toast(STUDY_MAINTENANCE_MSG);
      }
    }

    const isHome = !currentActiveRoute || currentActiveRoute === "home";
    const shouldFetchForumLb = isHome && (!cachedLeaderboardData?.leaderboard?.length);

    const [postsData, docsData, leaderboardData, topicsData] = await Promise.all([
      requestAPI("/api/posts").catch(() => ({ posts: [] })),
      requestAPI("/api/documents").catch(() => ({ documents: [] })),
      shouldFetchForumLb ? requestAPI("/api/leaderboard").catch(() => null) : Promise.resolve(null),
      requestAPI("/api/topics").catch(() => ({ topics: [] })),
    ]);

    if (topicsData.topics) {
      allTopics = topicsData.topics;
      topics = allTopics.filter(t => t.status === "approved").map(t => t.name);
      renderTopicsDropdown();
    }

    if (postsData.posts) {
      posts = postsData.posts.map(normalizePost);
      // Only re-render home/forum if relevant to avoid scroll/DOM disruptions
      if (!currentActiveRoute || currentActiveRoute === "home") renderHome();
      if (currentActiveRoute === "forum") renderPosts();

      const communityPosts = posts.filter((p) => p.authorRole !== "admin");
      const totalPosts = communityPosts.length;
      const answeredPosts = communityPosts.filter((p) => p.responses > 0).length;
      const ratio =
        totalPosts > 0 ? Math.round((answeredPosts / totalPosts) * 100) : 0;
      const elTotal = $("#statTotalPosts");
      const elRatio = $("#statAnsweredRatio");
      if (elTotal) elTotal.textContent = totalPosts;
      if (elRatio) elRatio.textContent = ratio + "%";
    }

    if (leaderboardData) {
      cachedLeaderboardData = leaderboardData;
      renderLeaderboard();
      updateResponsiveAsidePlacement();
    }
    if (docsData.documents) {
      documents.length = 0;
      docsData.documents.forEach((d) => {
        documents.push({
          id: d.id,
          type: d.category || d.type,
          format: d.format || "LINK",
          title: d.title,
          desc: d.desc || d.description,
          author: d.submittedBy || d.author,
          streakTier: Number(d.submittedByStreakTier || d.streakTier || 0),
          date: formatTime(d.createdAt || d.date),
          url: d.url || d.sourceUrl,
        });
      });
      if (!currentActiveRoute || currentActiveRoute === "documents") renderDocuments();
    }

    if (current.authenticated) {
      if ($("#accountGrid")) $("#accountGrid").style.display = "";
      if ($("#editProfile")) $("#editProfile").style.display = "";
      if ($("#openChangePasswordBtn")) $("#openChangePasswordBtn").style.display = "";
      if ($("#accountSecurityCard")) $("#accountSecurityCard").style.display = "block";
      if ($("#logoutButton")) $("#logoutButton").style.display = "";

      try {
        const profileData = await requestAPI("/api/me/contributions");
        if (profileData) {
          const streak = Number(profileData.streak || 0);
          const streakTier = Number(profileData.streakTier || getStreakTier(streak));
          window.currentStreakCount = streak;
          window.currentStreakTier = streakTier;

          const contribCard = $("#homeContributionCard");
          if (contribCard) {
            contribCard.setAttribute("data-streak-tier", streakTier);
          }

          const flameHero = $("#streakFlameHero");
          if (flameHero) {
            flameHero.innerHTML = getFlameSVG(streakTier, 46);
          }

          if ($("#activityStreak"))
            $("#activityStreak").innerHTML = `${streak} <span>ngày</span>`;

          const tierLabel = $("#streakTierLabel");
          if (tierLabel) {
            tierLabel.textContent = getStreakTitle(streak, streakTier);
          }

          const shieldsCount = $("#streakShieldsCount");
          if (shieldsCount) {
            shieldsCount.textContent = profileData.shields || 0;
          }

          const shieldNotice = $("#streakShieldNotice");
          if (shieldNotice) {
            shieldNotice.style.display = profileData.autoShieldUsed ? "block" : "none";
          }

          if ($("#profilePoints"))
            $("#profilePoints").textContent = profileData.total || 0;
          if ($("#profileStreak"))
            $("#profileStreak").innerHTML = `${streak} <em>ngày</em>`;
          if ($("#profileCount"))
            $("#profileCount").textContent = profileData.count || 0;

          if ($("#restoreStreakContainer")) {
             $("#restoreStreakContainer").style.display = profileData.canRestoreStreak ? "block" : "none";
          }

          // Trigger celebration check on home page if unlocked new milestone!
          triggerMilestoneCelebration(streak, streakTier);

          const grid = $("#activityGrid");
          if (grid) {
            const days = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
            const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));

            window.restoreStreak = async function() {
              try {
                const btn = document.querySelector("#restoreStreakContainer button");
                if(btn) {
                  btn.disabled = true;
                  btn.textContent = "Đang khôi phục...";
                }
                await requestAPI("/api/auth/restore-streak", { method: "POST" });
                window.location.reload();
              } catch(e) {
                toast("Không thể khôi phục chuỗi.");
              }
            };
            const today = now.getDay();
            const vnDayIndex = today === 0 ? 6 : today - 1;
            
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - vnDayIndex);
            
            const weekDates = [];
            for (let i = 0; i < 7; i++) {
               const d = new Date(startOfWeek);
               d.setDate(startOfWeek.getDate() + i);
               const y = d.getFullYear();
               const m = String(d.getMonth()+1).padStart(2, '0');
               const day = String(d.getDate()).padStart(2, '0');
               weekDates.push(`${y}-${m}-${day}`);
            }

            const activeSet = new Set(profileData.activityDays || []);

            grid.innerHTML = days
              .map((d, i) => {
                const dateStr = weekDates[i];
                const isActive = activeSet.has(dateStr);
                const isToday = i === vnDayIndex;
                const isPast = i < vnDayIndex;

                let cls = "";
                let mark = "";

                if (isActive) {
                   cls = "done";
                   mark = getFlameSVG(streakTier, 14);
                } else if (isToday) {
                   cls = "today";
                   mark = `<span style="opacity: 0.5;">${getFlameSVG(0, 13)}</span>`;
                } else {
                   mark = "○";
                }

                return `<div class="day ${cls}"><small>${d}</small><i>${mark}</i></div>`;
              })
              .join("");
          }

          const container = $("#recentContributionsContainer");
          if (container && profileData.recentContributions) {
            container.innerHTML = profileData.recentContributions.length
              ? profileData.recentContributions
                  .map(renderActivityRow)
                  .join("")
              : `<p class="empty-state">Chưa có hoạt động nào gần đây.</p>`;
          }
          if ($("#myPostsContainer")) {
             const myPosts = posts.filter(p => p.isAuthor);
             if (myPosts.length > 0) {
                 $("#myPostsContainer").innerHTML = myPosts.map(postCard).join("");
                 $$("#myPostsContainer .post-card").forEach(el => 
                    el.addEventListener("click", () => openDetail(Number(el.dataset.postId)))
                 );
             } else {
                 $("#myPostsContainer").innerHTML = `<p class="empty-state">Bạn chưa đăng bài đăng nào.</p>`;
             }
          }
          if ($("#savedPostsContainer")) {
             try {
                const savedData = await requestAPI(`/api/users/${current.user.id}/saved-posts`);
                if (savedData && savedData.posts && savedData.posts.length > 0) {
                   const normalizedSaved = savedData.posts.map(normalizePost);
                   $("#savedPostsContainer").innerHTML = normalizedSaved.map(postCard).join("");
                   $$("#savedPostsContainer .post-card").forEach(el => 
                      el.addEventListener("click", () => openDetail(Number(el.dataset.postId)))
                   );
                } else {
                   $("#savedPostsContainer").innerHTML = `<p class="empty-state">Chưa có bài đăng nào được lưu.</p>`;
                }
             } catch(e) {
                console.error(e);
             }
          }
        }
      } catch (e) {
        if (e.message && e.message.includes("bị khóa")) {
          toast(e.message);
        }
      }
      if (current.user?.role === "admin" || current.user?.role === "ta") {
        if ($("#adminPanel")) $("#adminPanel").style.display = "";
        try {
          const adminData = await requestAPI("/api/admin/overview");
          if (adminData) {
            if ($("#adminTotalUsers"))
              $("#adminTotalUsers").textContent = adminData.members || 0;
            if ($("#adminPendingDocs"))
              $("#adminPendingDocs").textContent =
                adminData.pendingDocuments || 0;
          }
        } catch (e) {}
      } else {
        if ($("#adminPanel")) $("#adminPanel").style.display = "none";
      }
    } else {
      if ($("#accountGrid")) $("#accountGrid").style.display = "none";
      if ($("#editProfile")) $("#editProfile").style.display = "none";
      if ($("#openChangePasswordBtn")) $("#openChangePasswordBtn").style.display = "none";
      if ($("#accountSecurityCard")) $("#accountSecurityCard").style.display = "none";
      if ($("#logoutButton")) $("#logoutButton").style.display = "none";
      if ($("#adminPanel")) $("#adminPanel").style.display = "none";
    }

    // Tải trạng thái module thi đua tuần
    loadWeeklyCompetitionStatus();
  } catch {
    toast("Không thể tải dữ liệu máy chủ.");
  }
}
function openAuth() {
  const modal = $("#authModal");
  modal.classList.remove("registering");
  $$(".auth-tab").forEach((tab, i) => tab.classList.toggle("active", i === 0));
  $("#authTitle").textContent = "Đăng nhập để tiếp tục";
  $("#authSubmit").innerHTML = "Đăng nhập <span>→</span>";
  $("#authName").required = false;
  $("#authForm").reset();
  modal.showModal();
  $("#authEmail").focus();
}

function renderActivityRow(r) {
  const icons = {
    post_created: "↳",
    response_created: "💬",
    helpful_received: "✦",
    document_approved: "↗",
    admin_adjustment: "⚙",
    response_deleted: "✕",
    post_deleted: "✕",
    post_hidden: "👁️",
    response_hidden: "👁️",
    weekly_active_reward: "🎁",
    post_read: "📖",
    document_read: "📄",
    study_session: "🎧",
    document_discussion: "💬",
    document_comment_deleted: "✕"
  };
  
  const getSnippet = () => {
    if (!r.referenceContent) return "";
    let t = r.referenceContent.trim();
    if (t.length > 30) t = t.substring(0, 30) + "...";
    return ` <i>"${escapeHTML(t)}"</i>`;
  };
  
  const getActionText = () => {
    switch (r.action) {
      case "post_created": return `Bạn đã đăng câu hỏi${getSnippet()}`;
      case "response_created": return `Bạn đã trả lời${getSnippet()}`;
      case "helpful_received": return `Bài đăng${getSnippet()} nhận được lượt Vote`;
      case "document_approved": return `Tài liệu${getSnippet()} đã được duyệt`;
      case "post_read": return `Đọc bài đăng${getSnippet()} (giữ chuỗi)`;
      case "document_read": return `Xem tài liệu${getSnippet()} (giữ chuỗi)`;
      case "study_session": return `Hoàn thành ca tự học NCKH: ${escapeHTML(r.reason || 'Tự học tập trung')}`;
      case "document_discussion": return escapeHTML(r.reason || `Bạn đã thảo luận về tài liệu`);
      case "document_comment_deleted": return escapeHTML(r.reason || `Thảo luận tài liệu của bạn đã bị xóa`);
      case "admin_adjustment": return r.points > 0 ? `Được TA cộng điểm: ${escapeHTML(r.reason || '')}` : `Bị trừ điểm do vi phạm quy định: ${escapeHTML(r.reason || '')}`;
      case "response_deleted": return `Phản hồi của bạn đã bị xóa`;
      case "post_deleted": return `Câu hỏi của bạn đã bị xóa`;
      case "post_hidden": return `Bài đăng của bạn đã bị xoá`;
      case "response_hidden": return `Bài đăng gốc đã bị xoá. Phản hồi của bạn không được tính điểm.`;
      case "weekly_active_reward": return r.reason || `Điểm năng động tuần`;
      default: return r.action;
    }
  };

  const sign = r.points > 0 ? "+" : "";
  return `<div class="activity-row">
    <span class="activity-icon">${icons[r.action] || "•"}</span>
    <div><strong>${getActionText()}</strong><p>${formatTime(r.date)}</p></div>
    <span class="activity-points">${sign}${r.points}</span>
  </div>`;
}

function escapeHTML(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}
const editTimers = new Map();
let globalTimerInterval = null;

function renderEditBtn(id, createdAtStr, type) {
  if (!session) return "";
  const createdAt = new Date(createdAtStr).getTime();
  const thirtyMins = 30 * 60 * 1000;
  if (Date.now() - createdAt >= thirtyMins) return ""; 

  const penSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`;
  const timerSvg = `<svg class="edit-countdown-svg timer-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><circle class="progress edit-progress-${type}-${id}" cx="12" cy="12" r="10"></circle></svg>`;

  editTimers.set(`${type}-${id}`, createdAt);

  return `<button class="edit-timer-btn" onclick="event.stopPropagation(); openEditModal('${type}', ${id})" title="Chỉnh sửa (trong vòng 30 phút)">
    ${timerSvg}
    ${penSvg}
  </button>`;
}

function updateEditTimers() {
  const thirtyMins = 30 * 60 * 1000;
  const now = Date.now();
  const maxDash = 63;

  for (const [key, createdAt] of editTimers.entries()) {
    const els = document.querySelectorAll(`.edit-progress-${key}`);
    if (els.length === 0) {
      editTimers.delete(key);
      continue;
    }
    const diff = now - createdAt;
    if (diff >= thirtyMins) {
      els.forEach(el => {
        const btn = el.closest(".edit-timer-btn");
        if (btn) btn.style.display = "none";
      });
      editTimers.delete(key);
    } else {
      const fraction = diff / thirtyMins;
      els.forEach(el => {
        el.style.strokeDashoffset = fraction * maxDash;
      });
    }
  }
}
if (!globalTimerInterval) {
  globalTimerInterval = setInterval(updateEditTimers, 1000);
}

function getEditedIndicator(editedAt) {
  if (!editedAt) return "";
  return `<span class="edited-indicator" title="Đã chỉnh sửa lúc ${formatTime(editedAt)}">
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
  </span>`;
}

function postCard(post) {
  const adminBtn =
    session?.role === "admin"
      ? `<button class="button button-outline" style="position:absolute; right: 40px; top: 10px; font-size: 10px; padding: 2px 6px; color: var(--error); border-color: var(--error);" onclick="event.stopPropagation(); hidePost(${post.id})">Ẩn bài</button>`
      : "";
  const editBtn = post.isAuthor ? renderEditBtn(post.id, post.createdAt, 'posts') : "";
  const pinnedIcon = post.isPinned
    ? `<span title="Đã ghim" style="color:var(--primary)">📌 </span>`
    : "";
  return `<article class="post-card ${post.authorRole === "admin" ? "admin-post" : ""}" data-post-id="${post.id}" style="position: relative;">
    ${adminBtn}${editBtn}
    <span class="avatar avatar-xs ${getAvatarClass(post.streakTier, post.anonymous, post.authorRole)}">${post.initials}</span>
    <div>
      <div class="post-meta" style="${post.lecturerRecommended ? 'margin: 0 0 2px 0;' : 'margin: 6px 0 2px 0;'}">
        <div style="line-height: 1.2;">${pinnedIcon}<b class="${getNameClass(post.streakTier)}">${escapeHTML(post.author)}</b>${post.authorRole === "lecturer" ? ' <span style="color: var(--primary); font-weight: 700; margin-left: 4px; font-size: 11px;">[Giảng viên]</span>' : ""}${post.anonymous ? " · Ẩn danh" : ""} · ${post.time}${getEditedIndicator(post.editedAt)}</div>
        ${post.lecturerRecommended ? '<div style="font-size: 11px; color: var(--primary); font-weight: 600; margin-top: 3px; display: flex; align-items: center; gap: 4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg> Giảng viên đề xuất</div>' : ''}
      </div>
      <h3 style="margin-top: 0;">${escapeHTML(post.title)}</h3>
      <div class="post-copy-preview">${escapeHTML(post.excerpt)}</div>
    </div>
    <div class="post-stats"><span class="post-tag">${post.topic}</span><span style="font-weight:600; color:var(--primary)">▲ ${post.upvotes}</span><span style="font-weight:600; color:var(--sage-5); display: inline-flex; align-items: center; gap: 4px;"><svg class="icon-chat-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>${post.responses}</span></div>
  </article>`;
}

window.hidePost = async (id) => {
  if (confirm("Bạn có chắc chắn muốn ẩn bài đăng này không?")) {
    try {
      await requestAPI(`/api/admin/posts/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "hidden" }),
      });
      toast("Đã ẩn bài đăng.");
      hydrateServer();
    } catch (e) {
      toast(e.message);
    }
  }
};
function renderPosts() {
  const term = $("#forumSearch").value.trim().toLowerCase();
  let result = posts.filter((p) =>
    `${p.title} ${p.excerpt} ${p.topic}`.toLowerCase().includes(term),
  );
  const topic = $("#topicFilter").value;
  if (topic !== "all") result = result.filter((p) => p.topic === topic);
  if (currentFilter === "new") {
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    result = result.filter(p => new Date(p.createdAt) >= yesterday);
    result.sort((a, b) => b.id - a.id);
  }
  if (currentFilter === "popular") result.sort((a, b) => b.upvotes - a.upvotes);
  if (currentFilter === "unanswered")
    result = result.filter((p) => p.responses === 0);

  result.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));

  const html = result.length
    ? result.map(postCard).join("")
    : `<div class="empty-state"><h3>Chưa tìm thấy nội dung phù hợp</h3><p>Thử dùng từ khóa khác hoặc đặt câu hỏi mới.</p></div>`;
  $("#forumFeed").innerHTML = html;
  $$(".forum-feed .post-card").forEach((el) =>
    el.addEventListener("click", () => openDetail(Number(el.dataset.postId))),
  );
}
function renderHome() {
  const newest = posts.slice(0, 3);
  $("#homePostList").innerHTML = newest.map(postCard).join("");
  $$("#homePostList .post-card").forEach((el) =>
    el.addEventListener("click", () => openDetail(Number(el.dataset.postId))),
  );
  const topicsHtml = topics
    .map((t) => `<button class="topic" data-topic="${t}">${t}</button>`)
    .join("");
  $("#topicCloud").innerHTML = topicsHtml;
  
  const mobileTopicCloud = $("#mobileTopicCloud");
  if (mobileTopicCloud) mobileTopicCloud.innerHTML = topicsHtml;
  $$(".topic").forEach((el) =>
    el.addEventListener("click", () => {
      go("forum");
      $("#topicFilter").value = el.dataset.topic;
      renderPosts();
    }),
  );

  const pinnedPost = posts.find((p) => p.isPinned);
  const pinnedContainer = $("#pinnedNotificationContainer");
  if (pinnedContainer) {
    if (pinnedPost) {
      pinnedContainer.innerHTML = `
        <section class="announcement" style="cursor: pointer" onclick="openDetail(${pinnedPost.id})">
          <div class="announcement-icon">📌</div>
          <div>
            <p class="eyebrow">THÔNG BÁO ĐƯỢC GHIM</p>
            <h2>${escapeHTML(pinnedPost.title)}</h2>
            <div class="post-copy-preview">${escapeHTML(pinnedPost.excerpt)}</div>
          </div>
          <button class="arrow-circle" aria-label="Xem thông báo">→</button>
        </section>
      `;
    } else {
      pinnedContainer.innerHTML = "";
    }
  }

  const globalRecent = $("#globalRecentContributions");
  if (globalRecent) {
    globalRecent.innerHTML = newest
      .map(
        (p) => `
      <li>
        <span class="avatar avatar-xs ${getAvatarClass(p.streakTier, p.anonymous, p.authorRole)}">${p.initials}</span>
        <p>
          <strong class="${getNameClass(p.streakTier)}">${escapeHTML(p.author)}</strong> vừa đặt câu hỏi<br />
          <small>${p.time}</small>
        </p>
      </li>
    `,
      )
      .join("");
  }
}
function renderDocuments() {
  let list = documents.filter(
    (d) => currentDocFilter === "all" || d.type === currentDocFilter,
  );
  const isAdminOrTA = session?.role === "admin" || session?.role === "ta" || session?.role === "lecturer";
  $("#documentGrid").innerHTML = list
    .map(
      (d) => {
        const delBtn = isAdminOrTA ? `<button class="delete-doc-btn" onclick="deleteDocument(event, ${d.id})" style="position:absolute; top:8px; right:8px; background:transparent; color:var(--error); border:none; padding:8px; cursor:pointer; font-size:16px; line-height:1; z-index:10;" aria-label="Xoá tài liệu">✕</button>` : "";
        return `<article class="document-card" data-doc="${d.id}" style="position:relative;">${delBtn}<div class="document-type" data-format="${d.format}">${d.format}</div><p class="eyebrow">${d.type === "course" ? "TÀI LIỆU MÔN HỌC" : "TÀI LIỆU THAM KHẢO"}</p><h2>${d.title}</h2><div class="document-desc ql-editor">${DOMPurify.sanitize(d.desc)}</div><div class="document-footer"><span class="${getNameClass(d.streakTier)}">${escapeHTML(d.author)}</span><span>${d.date}</span></div></article>`;
      }
    )
    .join("");
  $$(".document-card").forEach((el) =>
    el.addEventListener("click", () => {
      const doc = documents.find((d) => d.id === Number(el.dataset.doc));
      if (doc && doc.url) {
        let previewUrl = doc.url;
        if (
          previewUrl.includes("drive.google.com") &&
          previewUrl.includes("/view")
        ) {
          previewUrl = previewUrl.replace(/\/view.*$/, "/preview");
        }
        currentViewingDocId = doc.id;
        isDocDiscussionOpen = false;
        updateDocDiscussionUIState();
        if (typeof setDocAnonymousReply === "function") setDocAnonymousReply(false);
        loadDocComments(doc.id);
        $("#viewerIframe").src = previewUrl;
        const titleEl = $("#viewerTitle");
        if (titleEl) {
          titleEl.textContent = doc.title;
          titleEl.setAttribute("title", doc.title);
        }
        $("#documentViewerModal").showModal();
        startDocReadTracking(doc.id);
      } else {
        toast("Tài liệu này không có link hợp lệ.");
      }
    }),
  );
}

function updateResponsiveAsidePlacement() {
  const cardsContainer = document.getElementById("forumCommunityAsideCards");
  const homeSlot = document.getElementById("homeCommunityAsideSlot");
  const forumSlot = document.getElementById("forumCommunityAsideSlot");

  if (!cardsContainer || !homeSlot || !forumSlot) return;

  const isMobile = window.innerWidth <= 900;
  if (isMobile) {
    if (homeSlot !== cardsContainer.parentElement) {
      homeSlot.appendChild(cardsContainer);
    }
  } else {
    if (forumSlot !== cardsContainer.parentElement) {
      forumSlot.appendChild(cardsContainer);
    }
  }
}

window.addEventListener("resize", updateResponsiveAsidePlacement);

let currentActiveRoute = null;

function go(route, scrollToTop = true) {
  if (route === "study" && !canAccessStudyLounge()) {
    toast(STUDY_MAINTENANCE_MSG);
    const activeEl = document.querySelector(".page.active-page");
    const currentActive = activeEl ? activeEl.dataset.page : null;
    const fallback = (currentActive && currentActive !== "study") ? currentActive : "home";
    currentActiveRoute = fallback;
    history.replaceState(null, "", `#${fallback}`);
    $$(".page").forEach((p) =>
      p.classList.toggle("active-page", p.dataset.page === fallback),
    );
    $$("[data-route]").forEach((a) =>
      a.classList.toggle("active", a.dataset.route === fallback),
    );
    updateResponsiveAsidePlacement();
    return;
  }

  const isSameRoute = (currentActiveRoute === route);
  currentActiveRoute = route;

  if (!isSameRoute) {
    $$("dialog").forEach((d) => {
      if (d.open) d.close();
    });
  }

  $$(".page").forEach((p) =>
    p.classList.toggle("active-page", p.dataset.page === route),
  );
  $$("[data-route]").forEach((a) =>
    a.classList.toggle("active", a.dataset.route === route),
  );
  if (location.hash !== `#${route}`) {
    history.replaceState(null, "", `#${route}`);
  }

  // Only scroll to top when actually navigating to a new route and scrollToTop is true
  if (scrollToTop && !isSameRoute) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (route === "forum") renderPosts();
  if (route === "documents") renderDocuments();
  if (route === "study") onEnterStudyLounge();
  else onLeaveStudyLounge();
  if (route === "arena") onEnterArena();
  else onLeaveArena();
  updateResponsiveAsidePlacement();
  showMobileNav();
}
/* ==========================================================================
   MOBILE FLOATING NAVIGATION SMART SCROLL HIDE/SHOW
   ========================================================================== */
let lastMobileScrollY = typeof window !== "undefined" ? window.scrollY || 0 : 0;
let mobileScrollUpAccumulator = 0;
let mobileScrollDownAccumulator = 0;
let mobileNavScrollTimeout = null;
let isMobileNavHidden = false;
let isMobileNavSuspended = true;

function hideMobileNav() {
  const nav = document.querySelector(".mobile-nav");
  const fab = document.querySelector(".mobile-fab");
  if (nav) nav.classList.add("nav-hidden");
  if (fab) fab.classList.add("nav-hidden");
  isMobileNavHidden = true;
}

function showMobileNav() {
  const nav = document.querySelector(".mobile-nav");
  const fab = document.querySelector(".mobile-fab");
  if (nav) nav.classList.remove("nav-hidden");
  if (fab) fab.classList.remove("nav-hidden");
  isMobileNavHidden = false;
}

window.hideMobileNav = hideMobileNav;
window.showMobileNav = showMobileNav;

function initMobileNavScrollHandler() {
  lastMobileScrollY = Math.max(
    0,
    (typeof window !== "undefined" &&
      (window.scrollY ||
        window.pageYOffset ||
        document.documentElement.scrollTop)) ||
      0
  );
  showMobileNav();

  setTimeout(() => {
    isMobileNavSuspended = false;
    lastMobileScrollY = Math.max(0, window.scrollY || 0);
  }, 350);

  const onScroll = () => {
    if (window.innerWidth > 900) return;
    if (document.querySelector("dialog[open]")) return;

    const currentY = Math.max(
      0,
      window.scrollY ||
        window.pageYOffset ||
        document.documentElement.scrollTop ||
        0
    );

    if (isMobileNavSuspended) {
      lastMobileScrollY = currentY;
      return;
    }

    const delta = currentY - lastMobileScrollY;

    // Always restore when near top
    if (currentY <= 40) {
      showMobileNav();
      mobileScrollUpAccumulator = 0;
      mobileScrollDownAccumulator = 0;
      lastMobileScrollY = currentY;
      return;
    }

    if (delta > 0) {
      // Scrolling DOWN -> hide after minor threshold
      mobileScrollDownAccumulator += delta;
      mobileScrollUpAccumulator = 0;

      if (mobileScrollDownAccumulator > 20 && currentY > 60) {
        hideMobileNav();
      }
    } else if (delta < 0) {
      // Scrolling UP -> accumulate and wait for scroll end or significant upward gesture
      const upDelta = Math.abs(delta);
      mobileScrollUpAccumulator += upDelta;
      mobileScrollDownAccumulator = 0;

      if (mobileNavScrollTimeout) {
        clearTimeout(mobileNavScrollTimeout);
      }

      // If user scrolls up by a clear intentional amount (>= 30px)
      if (mobileScrollUpAccumulator >= 30) {
        showMobileNav();
      } else {
        // Debounce when gesture stops: only show if user made a deliberate upward movement (>= 15px) or reached near top
        mobileNavScrollTimeout = setTimeout(() => {
          if (mobileScrollUpAccumulator >= 15 || currentY <= 50) {
            showMobileNav();
          }
          mobileScrollUpAccumulator = 0;
        }, 150);
      }
    }

    lastMobileScrollY = currentY;
  };

  window.addEventListener("scroll", onScroll, { passive: true });

  if ("onscrollend" in window) {
    window.addEventListener("scrollend", () => {
      if (window.innerWidth > 900) return;
      if (mobileScrollUpAccumulator >= 30 || (window.scrollY || 0) <= 50) {
        showMobileNav();
      }
      mobileScrollUpAccumulator = 0;
    }, { passive: true });
  }
}

/* ==========================================================================
   UNIVERSAL MODAL SCROLL LOCK & BACKGROUND INTERACTION BLOCKER
   ========================================================================== */
let savedBodyScrollY = 0;
let isBodyScrollLocked = false;

function lockBodyScroll() {
  if (isBodyScrollLocked) return;
  savedBodyScrollY =
    window.scrollY ||
    window.pageYOffset ||
    document.documentElement.scrollTop ||
    0;
  const scrollbarWidth =
    window.innerWidth - document.documentElement.clientWidth;

  document.documentElement.classList.add("modal-scroll-locked");
  document.body.classList.add("modal-scroll-locked");

  document.body.style.position = "fixed";
  document.body.style.top = `-${savedBodyScrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  }
  isBodyScrollLocked = true;
}

function unlockBodyScroll() {
  if (!isBodyScrollLocked) return;
  document.documentElement.classList.remove("modal-scroll-locked");
  document.body.classList.remove("modal-scroll-locked");

  const restoreY = savedBodyScrollY;
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  document.body.style.paddingRight = "";

  isBodyScrollLocked = false;
  window.scrollTo(0, restoreY);
}

function syncModalScrollLock() {
  const openDialogs = document.querySelectorAll("dialog[open]");
  if (openDialogs && openDialogs.length > 0) {
    lockBodyScroll();
  } else {
    unlockBodyScroll();
  }
}

window.lockBodyScroll = lockBodyScroll;
window.unlockBodyScroll = unlockBodyScroll;
window.syncModalScrollLock = syncModalScrollLock;

// Intercept prototype methods of HTMLDialogElement for automatic sync
if (typeof HTMLDialogElement !== "undefined" && HTMLDialogElement.prototype) {
  const originalShowModal = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function (...args) {
    const res = originalShowModal.apply(this, args);
    syncModalScrollLock();
    return res;
  };

  const originalShow = HTMLDialogElement.prototype.show;
  HTMLDialogElement.prototype.show = function (...args) {
    const res = originalShow.apply(this, args);
    syncModalScrollLock();
    return res;
  };

  const originalClose = HTMLDialogElement.prototype.close;
  HTMLDialogElement.prototype.close = function (...args) {
    const res = originalClose.apply(this, args);
    requestAnimationFrame(() => syncModalScrollLock());
    return res;
  };
}

// Intercept close/cancel events on all dialogs
window.addEventListener("close", () => requestAnimationFrame(syncModalScrollLock), true);
window.addEventListener("cancel", () => requestAnimationFrame(syncModalScrollLock), true);

// MutationObserver for any dynamic [open] attribute changes
try {
  const dialogObserver = new MutationObserver(() => {
    syncModalScrollLock();
  });
  dialogObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["open"],
    subtree: true,
  });
} catch (e) {
  console.warn("Dialog MutationObserver error:", e);
}

// Block touchmove & wheel outside active modal content
function handleModalOutsideScroll(e) {
  const openDialogs = document.querySelectorAll("dialog[open]");
  if (!openDialogs || openDialogs.length === 0) return;

  const closestDialog = e.target && e.target.closest ? e.target.closest("dialog[open]") : null;
  if (!closestDialog) {
    if (e.cancelable) e.preventDefault();
    return;
  }

  // If target is the dialog itself (clicking or dragging on backdrop area outside inner box)
  if (e.target === closestDialog) {
    const rect = closestDialog.getBoundingClientRect();
    const isInsideDialogBox =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;
    if (!isInsideDialogBox && e.cancelable) {
      e.preventDefault();
    }
  }
}

window.addEventListener("wheel", handleModalOutsideScroll, { passive: false });
window.addEventListener("touchmove", handleModalOutsideScroll, { passive: false });

// Ensure input focusout cleans up any visual viewport translation on mobile
document.addEventListener("focusout", (e) => {
  if (
    e.target &&
    (e.target.tagName === "INPUT" ||
      e.target.tagName === "TEXTAREA" ||
      e.target.tagName === "SELECT" ||
      e.target.isContentEditable)
  ) {
    window.scrollTo(window.scrollX, window.scrollY);
  }
});

window.addEventListener("click", (e) => {
  if (e.target.tagName === "DIALOG") {
    const noBackdropCloseIds = [
      "detailModal",
      "questionModal",
      "documentViewerModal",
      "documentModal",
      "editModal"
    ];
    if (noBackdropCloseIds.includes(e.target.id)) return;
    e.target.close();
  }
});
$("#filterButton").onclick = () => {
  $("#filters").classList.toggle("open");
};
function openQuestion() {
  if (serverMode && !session) {
    openAuth();
    return;
  }
  const modal = $("#questionModal");
  $("#questionForm").reset();
  anonymous = false;
  $$(".identity-choice").forEach((b, i) =>
    b.classList.toggle("selected", i === 0),
  );
  modal.showModal();
  $("#questionTitle").focus();
}
let postReadTimer = null;
let postReadActivePostId = null;
let postReadTracked = false;
let postReadAccumulatedMs = 0;
let postReadLastActiveTime = null;

function stopPostReadTracking() {
  if (postReadTimer) {
    clearInterval(postReadTimer);
    postReadTimer = null;
  }
  postReadActivePostId = null;
  postReadTracked = false;
  postReadAccumulatedMs = 0;
  postReadLastActiveTime = null;
}

function updatePostReadAccumulator() {
  if (!postReadActivePostId || postReadTracked) return;
  const now = Date.now();
  if (document.visibilityState === "visible" && postReadLastActiveTime) {
    postReadAccumulatedMs += (now - postReadLastActiveTime);
  }
  postReadLastActiveTime = document.visibilityState === "visible" ? now : null;
}

let docReadTimer = null;
let docReadActiveDocId = null;
let docReadTracked = false;
let docReadAccumulatedMs = 0;
let docReadLastActiveTime = null;

function stopDocReadTracking() {
  if (docReadTimer) {
    clearInterval(docReadTimer);
    docReadTimer = null;
  }
  docReadActiveDocId = null;
  docReadTracked = false;
  docReadAccumulatedMs = 0;
  docReadLastActiveTime = null;
}

function updateDocReadAccumulator() {
  if (!docReadActiveDocId || docReadTracked) return;
  const now = Date.now();
  if (document.visibilityState === "visible" && docReadLastActiveTime) {
    docReadAccumulatedMs += (now - docReadLastActiveTime);
  }
  docReadLastActiveTime = document.visibilityState === "visible" ? now : null;
}

function startDocReadTracking(docId) {
  if (docReadActiveDocId !== docId) {
    stopDocReadTracking();
    docReadActiveDocId = docId;
    docReadTracked = false;
    docReadAccumulatedMs = 0;
    docReadLastActiveTime = document.visibilityState === "visible" ? Date.now() : null;

    docReadTimer = setInterval(async () => {
      const modal = $("#documentViewerModal");
      if (!modal || !modal.open || docReadActiveDocId !== docId) {
        stopDocReadTracking();
        return;
      }

      updateDocReadAccumulator();

      if (docReadAccumulatedMs >= 60000 && !docReadTracked) {
        docReadTracked = true;
        clearInterval(docReadTimer);
        docReadTimer = null;

        try {
          if (serverMode && session) {
            await requestAPI(`/api/documents/${docId}/read`, { method: "POST" });
            if (typeof loadContributions === "function") {
              loadContributions();
            }
          }
        } catch (err) {
          console.error("Failed to record document read:", err);
        }
      }
    }, 1000);
  }
}

document.addEventListener("visibilitychange", () => {
  updatePostReadAccumulator();
  updateDocReadAccumulator();
});

const detailModalEl = $("#detailModal");
if (detailModalEl) {
  detailModalEl.addEventListener("close", () => {
    stopPostReadTracking();
  });
}

let currentViewingDocId = null;
let isDocDiscussionOpen = false;

window.toggleDocDiscussion = function() {
  if (!currentViewingDocId) return;
  isDocDiscussionOpen = !isDocDiscussionOpen;
  updateDocDiscussionUIState();
  if (isDocDiscussionOpen) {
    loadDocComments(currentViewingDocId);
    setTimeout(() => {
      const input = $("#docCommentInput");
      if (input) input.focus();
    }, 150);
  }
};

function updateDocDiscussionUIState() {
  const panel = $("#docDiscussionPanel");
  const iconChat = $("#docBtnIconChat");
  const iconClose = $("#docBtnIconClose");
  const toggleBtn = $("#docDiscussionToggleBtn");

  if (panel) {
    panel.style.display = isDocDiscussionOpen ? "flex" : "none";
  }
  if (iconChat) iconChat.style.display = isDocDiscussionOpen ? "none" : "flex";
  if (iconClose) iconClose.style.display = isDocDiscussionOpen ? "flex" : "none";
  if (toggleBtn) {
    toggleBtn.classList.toggle("is-open", isDocDiscussionOpen);
    toggleBtn.setAttribute("title", isDocDiscussionOpen ? "Đóng thảo luận" : "Thảo luận tài liệu");
    toggleBtn.setAttribute("aria-label", isDocDiscussionOpen ? "Đóng thảo luận" : "Thảo luận tài liệu");
  }
  if (isDocDiscussionOpen && typeof setDocAnonymousReply === "function") {
    const anonInput = $("#docCommentAnon");
    setDocAnonymousReply(anonInput ? anonInput.checked : false);
  }
}

window.toggleDocAnonymousDropdown = function(e) {
  const dd = document.getElementById("docAnonymousDropdown");
  if (dd) {
    dd.classList.toggle("show");
    if (e) e.stopPropagation();
  }
};

window.setDocAnonymousReply = function(isAnon, e) {
  const anonInput = document.getElementById("docCommentAnon");
  if (anonInput) anonInput.checked = isAnon;
  const avatarLabel = document.getElementById("docReplyAvatarLabel");
  if (avatarLabel) {
    if (isAnon) {
      avatarLabel.textContent = "🎭";
      avatarLabel.className = "avatar avatar-sm";
      avatarLabel.style.background = "#64748b";
      avatarLabel.style.color = "#ffffff";
    } else {
      const initials = (session && session.initials) || "?";
      avatarLabel.textContent = initials;
      avatarLabel.className = `avatar avatar-sm ${getAvatarClass(session?.streakTier, false, session?.role)}`;
      if (!session?.role || session?.role === "student") {
        avatarLabel.style.background = ((session?.streakTier || 0) >= 3) ? "" : "var(--primary)";
        avatarLabel.style.color = "#ffffff";
      } else {
        avatarLabel.style.background = "";
        avatarLabel.style.color = "";
      }
    }
  }
  const dd = document.getElementById("docAnonymousDropdown");
  if (dd) dd.classList.remove("show");
  if (e) e.stopPropagation();
};

async function loadDocComments(docId) {
  if (!docId) return;
  try {
    const res = await requestAPI(`/api/documents/${docId}/comments`);
    const comments = res?.comments || [];
    renderDocCommentsList(comments);
    const countBadge = $("#docCommentCountBadge");
    if (countBadge) countBadge.textContent = comments.length;
    const fabBadge = $("#docFabBadge");
    if (fabBadge) {
      fabBadge.textContent = comments.length;
      fabBadge.style.display = comments.length > 0 ? "flex" : "none";
    }
  } catch (e) {
    console.error("Error loading document comments:", e);
  }
}

function renderDocCommentsList(comments) {
  const listEl = $("#docDiscussionList");
  if (!listEl) return;
  if (!comments || comments.length === 0) {
    listEl.innerHTML = `
      <div class="doc-comment-empty">
        <div class="doc-comment-empty-icon">
          <svg class="icon-chat-svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <p>Chưa có thảo luận nào cho tài liệu này.</p>
        <span>Hãy là người đầu tiên đặt câu hỏi hoặc trao đổi!</span>
      </div>
    `;
    return;
  }
  const isPrivileged = session?.role === "admin" || session?.role === "ta" || session?.role === "lecturer";
  listEl.innerHTML = comments.map(c => {
    const delBtn = isPrivileged ? `
      <button type="button" class="doc-comment-del-btn" onclick="deleteDocComment(${c.id})" title="Xoá thảo luận" aria-label="Xoá thảo luận">✕</button>
    ` : "";
    const editBtn = c.isAuthor ? renderEditBtn(c.id, c.createdAt, "document_comments") : "";
    const roleBadge = c.author.role === "lecturer" ? ' <span class="doc-comment-role-badge">[Giảng viên]</span>'
      : (c.author.role === "ta" ? ' <span class="doc-comment-role-badge">[TA]</span>'
      : (c.author.role === "admin" ? ' <span class="doc-comment-role-badge">[Admin]</span>' : ''));

    return `
      <div class="doc-comment-card" id="docComment-${c.id}">
        <div class="doc-comment-top">
          <div class="doc-comment-author-info">
            <span class="avatar avatar-xs ${getAvatarClass(c.author.streakTier, c.anonymous, c.author.role)}">${escapeHTML(c.author.initials || '?')}</span>
            <strong class="${getNameClass(c.author.streakTier)}">${escapeHTML(c.author.displayName)}</strong>
            ${roleBadge}
            ${c.anonymous ? '<span class="doc-comment-anon-badge">· Ẩn danh</span>' : ''}
          </div>
          <div class="doc-comment-actions">
            ${editBtn}
            ${delBtn}
          </div>
        </div>
        <div class="doc-comment-content">${escapeHTML(c.content)}</div>
      </div>
    `;
  }).join("");
  listEl.scrollTop = listEl.scrollHeight;
  if (typeof updateEditTimers === "function") updateEditTimers();
}

window.handleSendDocComment = async function(e) {
  if (e) e.preventDefault();
  if (!session) {
    openAuth();
    toast("Vui lòng đăng nhập để tham gia thảo luận tài liệu.");
    return;
  }
  if (!currentViewingDocId) return;
  const input = $("#docCommentInput");
  const anonCheck = $("#docCommentAnon");
  const content = input ? input.value.trim() : "";
  if (!content) return;
  const isAnonymous = anonCheck ? anonCheck.checked : false;

  const btn = $("#btnSendDocComment");
  if (btn) btn.disabled = true;

  try {
    await requestAPI(`/api/documents/${currentViewingDocId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content, isAnonymous })
    });
    if (input) input.value = "";
    toast("Đã gửi thảo luận thành công! 🎉");
    await loadDocComments(currentViewingDocId);
    if (typeof loadContributions === "function") loadContributions();
  } catch (err) {
    toast(err.message || "Gửi thảo luận thất bại.");
  } finally {
    if (btn) btn.disabled = false;
  }
};

window.deleteDocComment = async function(commentId) {
  if (!confirm("Bạn có chắc chắn muốn xoá thảo luận này không?")) return;
  try {
    await requestAPI(`/api/documents/comments/${commentId}`, {
      method: "DELETE"
    });
    toast("Đã xoá thảo luận.");
    await loadDocComments(currentViewingDocId);
    if (typeof loadContributions === "function") loadContributions();
  } catch (err) {
    toast(err.message || "Xoá thảo luận thất bại.");
  }
};

const docViewerModalEl = $("#documentViewerModal");
if (docViewerModalEl) {
  docViewerModalEl.addEventListener("close", () => {
    stopDocReadTracking();
    const iframe = $("#viewerIframe");
    if (iframe) iframe.src = "about:blank";
    currentViewingDocId = null;
    isDocDiscussionOpen = false;
    updateDocDiscussionUIState();
  });
}

async function openDetail(id) {
  window.currentDetailPostId = id;
  const modal = $("#detailModal");
  modal.showModal();
  $("#detailContent").innerHTML =
    `<div class="modal-head"><h2>Đang tải...</h2></div>`;
  $("#detailContent").setAttribute("data-current-post", id);

  if (postReadActivePostId !== id) {
    stopPostReadTracking();
    postReadActivePostId = id;
    postReadTracked = false;
    postReadAccumulatedMs = 0;
    postReadLastActiveTime = document.visibilityState === "visible" ? Date.now() : null;

    postReadTimer = setInterval(async () => {
      const modal = $("#detailModal");
      if (!modal || !modal.open || postReadActivePostId !== id) {
        stopPostReadTracking();
        return;
      }

      updatePostReadAccumulator();

      if (postReadAccumulatedMs >= 60000 && !postReadTracked) {
        postReadTracked = true;
        clearInterval(postReadTimer);
        postReadTimer = null;

        try {
          const res = await requestAPI(`/api/posts/${id}/read`, { method: "POST" });
          if (res && typeof res.readCount === "number") {
            const countEl = $("#detailPostReadCount");
            if (countEl && postReadActivePostId === id) {
              countEl.textContent = `${res.readCount} lượt đọc`;
            }
            if (Array.isArray(window.posts)) {
              const p = window.posts.find(x => x.id === id);
              if (p) p.readCount = res.readCount;
            }
          }
          if (serverMode && session && typeof loadContributions === "function") {
            loadContributions();
          }
        } catch (err) {
          console.error("Failed to update post read count:", err);
        }
      }
    }, 1000);
  }

  try {
    const data = await requestAPI(`/api/posts/${id}`);
    const post = data.post;
    const replies = data.responses;

    const responseMap = new Map();
    replies.forEach(r => { r.children = []; responseMap.set(r.id, r); });
    const roots = [];
    replies.forEach(r => {
      if (r.parentId && responseMap.has(r.parentId)) {
        responseMap.get(r.parentId).children.push(r);
      } else {
        roots.push(r);
      }
    });

    function renderResponse(r, level = 0) {
      const deleteBtn =
        session?.role === "admin" || session?.role === "ta"
          ? `<button class="button button-outline button-sm" style="color: var(--error); border-color: var(--error); margin-left: 8px;" onclick="deleteResponse(${r.id})">Xoá</button>`
          : "";
      
      let childHtml = "";
      if (r.children.length > 0) {
        childHtml = `<div class="response-children">` + r.children.map(c => renderResponse(c, level + 1)).join("") + `</div>`;
        if (level === 0) {
          childHtml += `<div style="border-bottom: 1px solid var(--line); margin-top: 13px;"></div>`;
        }
      }

      const editBtn = r.isAuthor ? renderEditBtn(r.id, r.createdAt, 'responses') : "";
      const targetParentId = level >= 2 ? r.parentId : r.id;

      return `
      <div class="response" style="position: relative;">
        ${editBtn}
        <span class="avatar avatar-xs ${getAvatarClass(r.author?.streakTier, r.anonymous, r.author?.role)}">${r.author.initials}</span>
        <div style="flex: 1;">
          <div class="response-meta" style="${r.lecturerRecommended ? 'margin: 0 0 4px 0;' : 'margin: 6px 0 2px 0;'}">
            <div style="line-height: 1.2;">
              <b class="${getNameClass(r.author?.streakTier)}">${r.isAuthor ? "Bạn" : escapeHTML(r.author.displayName)}</b>${r.author.role === "lecturer" ? ' <span style="color: var(--primary); font-weight: 700; margin-left: 4px; font-size: 11px;">[Giảng viên]</span>' : ""}${r.anonymous ? " · Ẩn danh" : ""} <span style="font-size: 10px; color: #888; margin-left: 6px;">${formatTime(r.createdAt)}</span>
              ${getEditedIndicator(r.editedAt)}
              ${r.selected ? '<span class="chosen-label">✓ Câu trả lời được chọn</span>' : ""}
            </div>
            ${r.lecturerRecommended ? '<div style="font-size: 11px; color: var(--primary); font-weight: 600; margin-top: 3px; display: flex; align-items: center; gap: 4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg> Giảng viên đề xuất</div>' : ''}
          </div>
          <div class="response-copy collapsible-wrapper"><div class="collapsible-content ql-editor">${DOMPurify.sanitize(r.content)}</div><button type="button" class="read-more-btn" onclick="toggleReadMore(this)">Xem thêm</button></div>
          <div class="detail-actions" style="margin-top:8px; display:flex; align-items:center; border: none; padding: 0;">
            <button class="button button-outline button-sm" onclick="voteResponse(${r.id}, 1)">▲ <span>Hữu ích</span></button>
            <span style="font-weight:600; color:var(--primary); width:16px; text-align:center;">${r.helpfulCount}</span>
            <button class="button button-outline button-sm" onclick="voteResponse(${r.id}, -1)">▼ <span>Không hữu ích</span></button>
            <button class="button button-outline button-sm" style="margin-left: 8px;" onclick="showReplyForm(${r.id}, ${post.id}, ${targetParentId})">Phản hồi</button>
            ${deleteBtn}
          </div>
          <div id="reply-form-${r.id}" style="display:none; margin-top:8px;"></div>
        </div>
      </div>
      ${childHtml}
    `;
    }

    const responsesHTML = roots.length
      ? roots.map((r) => renderResponse(r, 0)).join("")
      : `<p class="detail-copy">Câu hỏi này chưa có phản hồi. Hãy là người đầu tiên đóng góp một góc nhìn hoặc nguồn tài liệu hữu ích.</p>`;

    let adminBtns = "";
    if (session?.role === "admin") {
      const pinText = post.isPinned ? "Bỏ ghim" : "Ghim bài";
      adminBtns = `<button class="button button-outline" style="color: var(--primary); border-color: var(--primary);" onclick="pinPost(${post.id}, ${!post.isPinned})">${pinText}</button>
                   <button class="button button-outline" style="color: var(--error); border-color: var(--error);" onclick="hidePost(${post.id})">Ẩn bài đăng</button>`;
    }
    const editBtn = post.isAuthor ? renderEditBtn(post.id, post.createdAt, 'posts') : "";

    $("#detailContent").innerHTML = `
      <div class="modal-head" style="position: relative;">
        <div>
          <p class="eyebrow">${post.topic.toUpperCase()}</p>
          <h2 class="detail-title">${post.isPinned ? "📌 " : ""}${escapeHTML(post.title)}</h2>
        </div>
        <div style="display: flex; gap: 8px;">
          ${editBtn ? `<div style="position:relative; width:24px; height:24px; margin-top: -2px;">${editBtn}</div>` : ""}
          <button class="close-modal" id="closeDetail" aria-label="Đóng" style="margin-left: 0;">×</button>
        </div>
      </div>
      <div style="display: flex; gap: 12px; margin-top: -8px; margin-bottom: 0;">
        <span class="avatar avatar-xs ${getAvatarClass(post.author?.streakTier || post.streakTier, post.anonymous, post.author?.role)}">${post.author.initials || post.initials || "?"}</span>
        <div class="detail-meta" style="flex: 1; margin: 0; ${post.lecturerRecommended ? 'margin-top: -2px;' : 'margin-top: 6px;'}">
          <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px; line-height: 1.2;">
            <div>
              <b class="${getNameClass(post.author?.streakTier || post.streakTier)}">${post.author.displayName || post.author}</b>${post.author?.role === "lecturer" ? ' <span style="color: var(--primary); font-weight: 700; margin-left: 4px; font-size: 11px;">[Giảng viên]</span>' : ""} <span style="font-size: 10px; color: #888; margin-left: 6px;">${formatTime(post.createdAt)}</span>${getEditedIndicator(post.editedAt)}
            </div>
            <div class="post-read-count" id="detailPostReadCount" style="font-size: 11px; color: var(--muted); white-space: nowrap; flex-shrink: 0;">
              ${post.readCount || 0} lượt đọc
            </div>
          </div>
          ${post.lecturerRecommended ? '<div style="font-size: 11px; color: var(--primary); font-weight: 600; margin-top: 3px; display: flex; align-items: center; gap: 4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg> Giảng viên đề xuất</div>' : ''}
        </div>
      </div>
      <div class="detail-copy ql-editor">${DOMPurify.sanitize(post.content || post.excerpt)}</div>
      <div class="detail-actions">
        <button class="button button-outline button-sm" onclick="votePost(${post.id}, 1)">▲ <span>Hữu ích</span></button>
        <span style="font-weight:600; color:var(--primary)">${post.helpfulCount || post.upvotes || 0}</span>
        <button class="button button-outline button-sm" onclick="votePost(${post.id}, -1)">▼ <span>Không hữu ích</span></button>
        <span style="margin: 0 0 0 12px; font-weight:600; color:var(--sage-5); font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><svg class="icon-chat-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>${post.responseCount} phản hồi</span>
        <button class="button button-outline button-sm" style="margin-left: 12px; border: none; padding: 0 8px; color: ${post.isSaved ? 'var(--primary)' : 'var(--sage-5)'};" onclick="toggleSavePost(${post.id})">
          ${post.isSaved ? '★ Đã lưu' : '☆ Lưu'}
        </button>
        <div style="flex:1"></div>
        ${adminBtns}
      </div>
      <h3 class="detail-response-title">Phản hồi</h3>
      <div id="responsesContainer">${responsesHTML}</div>
    `;

    $("#pinnedReplyContainer").innerHTML = `
      <form id="replyForm" class="reply-bar collapsed">
        <div class="reply-avatar-dropdown" onclick="toggleAnonymousDropdown(event)">
          <span class="avatar avatar-sm ${getAvatarClass(session?.streakTier, false, session?.role)}" id="replyAvatarLabel" style="${(!session?.role || session?.role === 'student') ? ((session?.streakTier >= 3) ? '' : 'background: var(--primary); color: white;') : ''}">${session?.initials || '?'}</span>
          <span class="dropdown-arrow">▼</span>
          <div id="anonymousDropdown" class="dropdown-menu">
            <div onclick="setAnonymousReply(false)">Phản hồi công khai</div>
            <div onclick="setAnonymousReply(true)">Phản hồi ẩn danh</div>
          </div>
        </div>
        
        <div class="reply-pill">
          <div id="replyContentContainer"></div>
          <div class="reply-actions">
             <button type="button" class="btn-expand-tools" onclick="expandReplyTools()">+</button>
             <button type="button" class="btn-collapse-tools" onclick="collapseReplyTools()">Thu gọn</button>
             <button type="submit" class="btn-send">➤</button>
          </div>
        </div>
        <input type="checkbox" id="replyAnonymous" style="display:none;">
      </form>
    `;

    $("#closeDetail").onclick = () => modal.close();

    $("#closeDetail").onclick = () => modal.close();
    
    const replyEditor = initEditor("replyContentContainer", "Chia sẻ góc nhìn hoặc gợi ý tài liệu...");

    $("#replyForm").onsubmit = async (e) => {
      e.preventDefault();
      setSubmitLoading(e, true);
      if (serverMode && !session) {
        openAuth();
        setSubmitLoading(e, false);
        return;
      }
      const rawText = replyEditor.getText().trim();
      if (rawText.length < 10) {
        toast("Phản hồi cần có ít nhất 10 ký tự.");
        setSubmitLoading(e, false);
        return;
      }
      const content = replyEditor.root.innerHTML;
      const isAnonymous = $("#replyAnonymous").checked;
      if (content.length < 10) {
        setSubmitLoading(e, false);
        return;
      }
      try {
        await requestAPI(`/api/posts/${post.id}/responses`, {
          method: "POST",
          body: JSON.stringify({ content, isAnonymous }),
        });
        toast("Đã gửi phản hồi.");
        openDetail(id); // Tải lại chi tiết
        hydrateServer(); // Cập nhật lại số lượng phản hồi ngoài trang chủ
      } catch (err) {
        toast(err.message);
      } finally {
        setSubmitLoading(e, false);
      }
    };

    setTimeout(() => {
      document.querySelectorAll('#detailModal .response-copy .collapsible-content').forEach(el => {
        if (el.scrollHeight > el.clientHeight) {
          el.classList.add('has-overflow');
          el.nextElementSibling.style.display = 'inline-block';
        }
      });
    }, 10);
  } catch (err) {
    $("#detailContent").innerHTML =
      `<div class="modal-head"><div><h2 class="detail-title">Lỗi khi tải</h2></div><button class="close-modal" onclick="this.closest('dialog').close()">×</button></div><p class="detail-copy">${err.message}</p>`;
  }
}
function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  
  if (el.showPopover) {
    try { el.showPopover(); } catch(e) {} // ignore if already open
  }
  
  el.classList.add("show");
  
  // Clear any existing timeout to avoid premature hiding
  if (el.toastTimeout) clearTimeout(el.toastTimeout);
  
  el.toastTimeout = setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => {
      if (el.hidePopover && !el.classList.contains("show")) {
        try { el.hidePopover(); } catch(e) {}
      }
    }, 200); // Wait for transition
  }, 2500);
}

function renderTopicsDropdown() {
  const filter = $("#topicFilter");
  const qTopic = $("#questionTopic");
  if (filter) {
    const val = filter.value;
    filter.innerHTML = `<option value="all">Tất cả chủ đề</option>` + topics.map(t => `<option value="${t}">${t}</option>`).join('');
    filter.value = topics.includes(val) ? val : "all";
  }
  if (qTopic) {
    const val = qTopic.value;
    qTopic.innerHTML = topics.map(t => `<option value="${t}">${t}</option>`).join('');
    if (topics.includes(val)) qTopic.value = val;
  }
}
renderTopicsDropdown();

$("#proposeTopicBtn")?.addEventListener("click", async () => {
  if (serverMode && !session) return openAuth();
  const name = prompt("Nhập tên chủ đề mới (3-50 ký tự):");
  if (!name) return;
  if (name.trim().length < 3 || name.trim().length > 50) return toast("Tên chủ đề phải từ 3 đến 50 ký tự");
  try {
    const res = await requestAPI("/api/topics", {
      method: "POST",
      body: JSON.stringify({ name: name.trim() })
    });
    if (res.status === "approved") {
      toast("Đã thêm chủ đề mới.");
      topics.push(name.trim());
      allTopics.push({ name: name.trim(), status: 'approved' });
      renderTopicsDropdown();
      renderHome();
    } else {
      toast("Đã gửi đề xuất bổ sung chủ đề. Vui lòng chờ TA duyệt");
    }
  } catch (e) {
    toast(e.message);
  }
});
$$("[data-route]").forEach((link) =>
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const route = link.dataset.route;
    if (route === "study" && !canAccessStudyLounge()) {
      toast(STUDY_MAINTENANCE_MSG);
      return;
    }
    go(route);
  }),
);
$(".profile-chip").addEventListener("click", () => {
  if (serverMode && !session) openAuth();
});
$("#askFromHome").onclick = openQuestion;
$("#askFromForum").onclick = openQuestion;
$("#mobileAsk").onclick = openQuestion;
$("#openSearch").onclick = () => {
  go("forum");
  setTimeout(() => $("#forumSearch").focus(), 80);
};
$("#homeSearch").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    go("forum");
    $("#forumSearch").value = e.currentTarget.value;
    renderPosts();
  }
});
$("#forumSearch").addEventListener("input", renderPosts);
$$(".filter-chip").forEach((c) =>
  c.addEventListener("click", () => {
    currentFilter = c.dataset.filter;
    $$(".filter-chip").forEach((x) => x.classList.toggle("selected", x === c));
    renderPosts();
  }),
);
$("#topicFilter").onchange = renderPosts;
$$(".identity-choice").forEach((btn) =>
  btn.addEventListener("click", () => {
    anonymous = btn.dataset.anonymous === "true";
    $$(".identity-choice").forEach((b) =>
      b.classList.toggle("selected", b === btn),
    );
  }),
);
$$("#authModal .auth-tab[data-auth-mode]").forEach((tab) =>
  tab.addEventListener("click", () => {
    const registering = tab.dataset.authMode === "register";
    $("#authModal").classList.toggle("registering", registering);
    $$("#authModal .auth-tab[data-auth-mode]").forEach((t) => t.classList.toggle("active", t === tab));
    $("#authTitle").textContent = registering
      ? "Tạo tài khoản mới"
      : "Đăng nhập để tiếp tục";
    $("#authSubmit").innerHTML = registering
      ? "Tạo tài khoản <span>→</span>"
      : "Đăng nhập <span>→</span>";
    $("#authName").required = registering;
    $("#authPassword").autocomplete = registering
      ? "new-password"
      : "current-password";
    if ($("#authForgotWrapper")) {
      $("#authForgotWrapper").style.display = registering ? "none" : "flex";
    }
  }),
);

// --- FORGOT PASSWORD FLOW ---
function openForgotPasswordView() {
  if ($("#authForm")) $("#authForm").style.display = "none";
  if ($("#forgotForm")) $("#forgotForm").style.display = "block";
  if ($("#forgotStep1")) $("#forgotStep1").style.display = "block";
  if ($("#forgotStep2")) $("#forgotStep2").style.display = "none";
  if ($("#authEmail") && $("#forgotEmail") && $("#authEmail").value) {
    $("#forgotEmail").value = $("#authEmail").value.trim();
  }
  if ($("#forgotEmail")) $("#forgotEmail").focus();
}

function closeForgotPasswordView() {
  if ($("#forgotForm")) $("#forgotForm").style.display = "none";
  if ($("#authForm")) $("#authForm").style.display = "block";
}

if ($("#authForgotPasswordBtn")) {
  $("#authForgotPasswordBtn").addEventListener("click", (e) => {
    e.preventDefault();
    openForgotPasswordView();
  });
}

if ($("#forgotCancelBtn")) {
  $("#forgotCancelBtn").addEventListener("click", (e) => {
    e.preventDefault();
    closeForgotPasswordView();
  });
}

if ($("#alreadyHaveCodeLink")) {
  $("#alreadyHaveCodeLink").addEventListener("click", (e) => {
    e.preventDefault();
    if ($("#forgotEmail") && $("#forgotStep2Email") && $("#forgotEmail").value) {
      $("#forgotStep2Email").value = $("#forgotEmail").value.trim();
    }
    $("#forgotStep1").style.display = "none";
    $("#forgotStep2").style.display = "block";
    if ($("#forgotCode")) $("#forgotCode").focus();
  });
}

if ($("#forgotBackToStep1Btn")) {
  $("#forgotBackToStep1Btn").addEventListener("click", (e) => {
    e.preventDefault();
    $("#forgotStep2").style.display = "none";
    $("#forgotStep1").style.display = "block";
  });
}

if ($("#forgotRequestSubmitBtn")) {
  $("#forgotRequestSubmitBtn").addEventListener("click", async (e) => {
    e.preventDefault();
    const email = ($("#forgotEmail")?.value || "").trim();
    if (!email || !email.includes("@")) {
      toast("Vui lòng nhập địa chỉ email hợp lệ.");
      return;
    }
    const btn = $("#forgotRequestSubmitBtn");
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = "Đang gửi yêu cầu...";
    try {
      const data = await requestAPI("/api/auth/forgot-password-request", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      toast(data.message || "Đã gửi yêu cầu tới TA/Admin!");
      if ($("#forgotStep2Email")) {
        $("#forgotStep2Email").value = data.email || email;
      }
      $("#forgotStep1").style.display = "none";
      $("#forgotStep2").style.display = "block";
      if ($("#forgotCode")) $("#forgotCode").focus();
    } catch (err) {
      toast(err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  });
}

if ($("#forgotResetSubmitBtn")) {
  $("#forgotResetSubmitBtn").addEventListener("click", async (e) => {
    e.preventDefault();
    const email = ($("#forgotStep2Email")?.value || "").trim();
    const code = ($("#forgotCode")?.value || "").trim();
    const newPassword = $("#forgotNewPassword")?.value || "";
    const confirmPassword = $("#forgotConfirmPassword")?.value || "";

    if (!email || !code || !newPassword) {
      toast("Vui lòng điền đầy đủ Email, Mã xác thực và Mật khẩu mới.");
      return;
    }
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      toast("Mã xác thực gồm đúng 6 chữ số.");
      return;
    }
    if (newPassword.length < 12) {
      toast("Mật khẩu mới phải có tối thiểu 12 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast("Mật khẩu xác nhận không khớp với mật khẩu mới.");
      return;
    }

    const btn = $("#forgotResetSubmitBtn");
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = "Đang xử lý...";
    try {
      const data = await requestAPI("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email, code, newPassword }),
      });
      toast(data.message || "Đặt lại mật khẩu thành công!");
      // Reset form
      if ($("#forgotCode")) $("#forgotCode").value = "";
      if ($("#forgotNewPassword")) $("#forgotNewPassword").value = "";
      if ($("#forgotConfirmPassword")) $("#forgotConfirmPassword").value = "";
      // Chuyển về login
      closeForgotPasswordView();
      if ($("#authEmail")) $("#authEmail").value = email;
      if ($("#authPassword")) {
        $("#authPassword").value = "";
        $("#authPassword").focus();
      }
    } catch (err) {
      toast(err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  });
}

$("#authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  setSubmitLoading(e, true);
  const registering = $("#authModal").classList.contains("registering");
  try {
    const payload = {
      email: $("#authEmail").value.trim(),
      password: $("#authPassword").value,
    };
    if (registering) payload.displayName = $("#authName").value.trim();
    const data = await requestAPI(
      registering ? "/api/auth/register" : "/api/auth/login",
      { method: "POST", body: JSON.stringify(payload) },
    );
    csrfToken = data.csrfToken;
    applySession(data.user);
    $("#authModal").close();
    await hydrateServer();
    toast(
      registering
        ? "Tài khoản đã được tạo. Chào mừng bạn đến RE:SEARCH!"
        : "Đăng nhập thành công.",
    );
  } catch (err) {
    toast(err.message);
  } finally {
    setSubmitLoading(e, false);
  }
});
let questionEditor;
let docDescEditor;
let editEditor;
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("questionContentContainer")) {
    questionEditor = initEditor("questionContentContainer", "Mô tả điều bạn đã hiểu, phần còn chưa rõ và bối cảnh nếu có…");
  }
  if (document.getElementById("docDescContainer")) {
    docDescEditor = initEditor("docDescContainer", "Tài liệu này hữu ích cho phần nào?");
  }
  if (document.getElementById("editContentContainer")) {
    editEditor = initEditor("editContentContainer", "Chỉnh sửa nội dung...");
  }

  const flameHero = $("#streakFlameHero");
  if (flameHero && !flameHero.innerHTML) {
    flameHero.innerHTML = getFlameSVG(0, 46);
  }

  const tierLabel = $("#streakTierLabel");
  if (tierLabel && !tierLabel.textContent.trim()) {
    tierLabel.textContent = getStreakTitle(0, 0);
  }

  const grid = $("#activityGrid");
  if (grid && !grid.innerHTML) {
    const days = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
    grid.innerHTML = days.map(d => `<div class="day"><small>${d}</small><i>○</i></div>`).join("");
  }
  
  checkAndShowBanner();
});

window.closeBanner = function(hours) {
  const banner = document.getElementById("assignmentBanner");
  if (banner) banner.close();
  const nextTime = new Date().getTime() + hours * 60 * 60 * 1000;
  localStorage.setItem("bannerNextShow_newupdate", nextTime.toString());
};

function checkAndShowBanner() {
  const now = new Date();
  // Hiện banner "New update" đến hết ngày 05/10/2026 giờ Việt Nam
  const cutoff = new Date("2026-10-05T23:59:59+07:00");
  if (now > cutoff) return;

  const nextShow = localStorage.getItem("bannerNextShow_newupdate");
  if (nextShow && now.getTime() < parseInt(nextShow, 10)) {
    return;
  }

  const banner = document.getElementById("assignmentBanner");
  if (banner && typeof banner.showModal === "function") {
    banner.showModal();
  }
}

window.openEditModal = async (type, id) => {
  let content = "";
  let title = "";

  if (type === "posts") {
    const post = posts.find(p => p.id === id);
    if (post) {
      const data = await requestAPI(`/api/posts/${id}`);
      content = data.post.rawContent || data.post.content;
      title = data.post.title;
      $("#editTitleLabel").style.display = "block";
      $("#editTitle").value = title;
    }
  } else if (type === "responses") {
    const r = document.querySelector(`.response .detail-actions button[onclick*="voteResponse(${id},"]`)?.closest(".response");
    if (r) {
      const contentEl = r.querySelector(".collapsible-content") || r.querySelector(".response-copy");
      content = contentEl ? contentEl.innerHTML : "";
    }
    $("#editTitleLabel").style.display = "none";
  } else if (type === "document_comments") {
    const card = document.getElementById(`docComment-${id}`);
    if (card) {
      const contentEl = card.querySelector(".doc-comment-content");
      if (contentEl) {
        content = contentEl.innerText || contentEl.textContent || "";
      }
    }
    $("#editTitleLabel").style.display = "none";
  }

  $("#editType").value = type;
  $("#editId").value = id;
  if (editEditor) {
    if (type === "document_comments") {
      editEditor.setText(content.trim() ? content.trim() + "\n" : "");
    } else {
      editEditor.root.innerHTML = DOMPurify.sanitize(content);
    }
  }
  $("#editModal").showModal();
};

$("#editForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  setSubmitLoading(e, true);
  const type = $("#editType").value;
  const id = $("#editId").value;
  const rawText = editEditor ? editEditor.getText().trim() : "";
  const minLen = type === "document_comments" ? 1 : 5;
  if (rawText.length < minLen) {
    toast("Nội dung quá ngắn.");
    setSubmitLoading(e, false);
    return;
  }
  
  const content = type === "document_comments" ? rawText : editEditor.root.innerHTML;
  const title = type === "posts" ? $("#editTitle").value.trim() : "";

  try {
    const endpoint = type === "document_comments" ? `/api/documents/comments/${id}` : `/api/${type}/${id}`;
    await requestAPI(endpoint, {
      method: "PATCH",
      body: JSON.stringify({ content, title })
    });
    toast("Cập nhật thành công!");
    $("#editModal").close();
    
    // Refresh content based on type
    if (type === "posts") {
      hydrateServer();
      if ($("#detailModal").open) {
        openDetail(id);
      }
    } else if (type === "document_comments") {
      if (currentViewingDocId) {
        loadDocComments(currentViewingDocId);
      }
    } else {
      // For response, refresh the current post detail
      const currentPostId = document.querySelector("#detailContent")?.getAttribute("data-current-post");
      if (currentPostId) {
        openDetail(currentPostId);
      } else {
        // Fallback if data attribute isn't set, just reload detail if open
        const firstPostId = window.currentDetailPostId;
        if (firstPostId) openDetail(firstPostId);
      }
    }
  } catch (err) {
    toast(err.message || "Lỗi khi cập nhật.");
  } finally {
    setSubmitLoading(e, false);
  }
});

$("#questionForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  setSubmitLoading(e, true);
  const title = $("#questionTitle").value.trim();
  const rawText = questionEditor ? questionEditor.getText().trim() : "";
  if (title.length < 12 || rawText.length < 25) {
    toast("Tiêu đề hoặc nội dung quá ngắn.");
    setSubmitLoading(e, false);
    return;
  }
  const content = questionEditor.root.innerHTML;
  let newPost = {
    id: Date.now(),
    title,
    excerpt: content,
    topic: $("#questionTopic").value,
    author: anonymous ? "Ẩn danh" : "Sinh viên",
    initials: anonymous ? "?" : "🦊",
    time: "Hôm nay",
    useful: 0,
    responses: 0,
    anonymous,
  };
  try {
    if (serverMode) {
      const data = await requestAPI("/api/posts", {
        method: "POST",
        body: JSON.stringify({
          title,
          content,
          topic: newPost.topic,
          isAnonymous: anonymous,
        }),
      });
      newPost = normalizePost(data.post);
    }
    posts.unshift(newPost);
    $("#questionModal").close();
    renderPosts();
    renderHome();
    go("forum");
    toast("Câu hỏi đã được đăng. +2 Điểm đóng góp");
    hydrateServer();
  } catch (err) {
    toast(err.message);
  } finally {
    setSubmitLoading(e, false);
  }
});
$$(".tab").forEach((tab) =>
  tab.addEventListener("click", () => {
    currentDocFilter = tab.dataset.docFilter;
    $$(".tab").forEach((t) => t.classList.toggle("active", t === tab));
    renderDocuments();
  }),
);
$("#shareDocument").onclick = () => {
  if (serverMode && !session) {
    openAuth();
    return;
  }
  const modal = $("#documentModal");
  $("#documentForm").reset();
  modal.showModal();
  $("#docTitle").focus();
};

$("#documentForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  setSubmitLoading(e, true);
  if (serverMode && !session) {
    setSubmitLoading(e, false);
    return;
  }

  const title = $("#docTitle").value.trim();
  const rawText = docDescEditor ? docDescEditor.getText().trim() : "";
  const desc = docDescEditor ? docDescEditor.root.innerHTML : "";
  const url = $("#docUrl").value.trim();
  const cat = $("#docCategory").value;
  const format = $("#docFormat").value;

  try {
    if (serverMode) {
      await requestAPI("/api/documents", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: desc,
          sourceUrl: url,
          category: cat,
          format,
        }),
      });
      toast("Đã gửi đề xuất tài liệu chờ duyệt.");
      $("#documentForm").reset();
      $("#documentModal").close();
      hydrateServer();
    }
  } catch (err) {
    toast(err.message);
  } finally {
    setSubmitLoading(e, false);
  }
});
$("#logoutButton").onclick = async () => {
  if (serverMode) {
    try {
      await requestAPI("/api/auth/logout", { method: "POST" });
      session = null;
      window.location.reload();
    } catch (e) {
      toast("Đăng xuất thất bại.");
    }
  }
};
async function loadAdminOverview() {
  const data = await requestAPI("/api/admin/overview");
  $("#adminMembers").textContent = data.members;
  $("#adminPosts").textContent = data.posts;
  $("#adminUnanswered").textContent = data.unanswered;
  $("#adminDocs").textContent = data.pendingDocuments;
  $("#adminTopics").textContent = data.pendingTopics;
  if ($("#adminPendingResetsCount")) {
    $("#adminPendingResetsCount").textContent = data.pendingPasswordResets || 0;
  }
  if ($("#adminPendingResetBadge")) {
    const count = data.pendingPasswordResets || 0;
    if (count > 0) {
      $("#adminPendingResetBadge").textContent = count;
      $("#adminPendingResetBadge").style.display = "inline-block";
    } else {
      $("#adminPendingResetBadge").style.display = "none";
    }
  }
}

async function loadAdminPasswordResets() {
  const tbody = $("#adminPasswordResetsBody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" style="padding: 24px; text-align: center; color: var(--muted)">Đang tải danh sách...</td></tr>`;
  try {
    const data = await requestAPI("/api/admin/password-resets");
    if ($("#adminPendingResetBadge")) {
      const count = data.pendingCount || 0;
      if (count > 0) {
        $("#adminPendingResetBadge").textContent = count;
        $("#adminPendingResetBadge").style.display = "inline-block";
      } else {
        $("#adminPendingResetBadge").style.display = "none";
      }
    }
    if ($("#adminPendingResetsCount")) {
      $("#adminPendingResetsCount").textContent = data.pendingCount || 0;
    }
    if (!data.requests || data.requests.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding: 24px; text-align: center; color: var(--muted)">Chưa có yêu cầu khôi phục mật khẩu nào.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.requests
      .map((r) => {
        const isPending = r.status === "pending";
        const statusBadge = isPending
          ? `<span style="background: rgba(245, 158, 11, 0.15); color: #b45309; padding: 2px 8px; border-radius: 12px; font-weight: 600; font-size: 11px;">Chờ cấp</span>`
          : r.status === "used"
          ? `<span style="background: rgba(16, 185, 129, 0.15); color: #047857; padding: 2px 8px; border-radius: 12px; font-weight: 600; font-size: 11px;">Đã dùng</span>`
          : r.status === "expired"
          ? `<span style="background: rgba(107, 114, 128, 0.15); color: #4b5563; padding: 2px 8px; border-radius: 12px; font-weight: 600; font-size: 11px;">Hết hạn</span>`
          : `<span style="background: rgba(239, 68, 68, 0.15); color: #b91c1c; padding: 2px 8px; border-radius: 12px; font-weight: 600; font-size: 11px;">Đã hủy</span>`;

        const studentInfo =
          `<strong>${escapeHTML(r.display_name || "Chưa đặt tên")}</strong>` +
          (r.student_id ? `<br><small style="color:var(--muted)">MSSV: ${escapeHTML(r.student_id)}</small>` : "") +
          (r.class_name ? ` • <small style="color:var(--muted)">Lớp: ${escapeHTML(r.class_name)}</small>` : "") +
          `<br><small style="color:var(--muted)">${escapeHTML(r.email)}</small>`;

        const codeBox = `<div style="display:flex; align-items:center; gap:6px;">
          <span style="font-family: monospace; font-size: 15px; font-weight: 800; letter-spacing: 1.5px; background: var(--sage-2); padding: 3px 8px; border-radius: 4px; color: ${isPending ? "var(--ink)" : "var(--muted)"};">${r.code}</span>
          <button type="button" class="button button-subtle button-small" style="padding: 2px 6px; font-size: 11px;" title="Sao chép mã" onclick="copyResetCode('${r.code}')">📋 Copy</button>
        </div>`;

        const timeCreated = new Date(r.created_at).toLocaleString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          day: "2-digit",
          month: "2-digit",
        });
        const timeExpiry = new Date(r.expires_at).toLocaleString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          day: "2-digit",
          month: "2-digit",
        });

        const actions = isPending
          ? `<button type="button" class="button button-outline button-small" style="padding: 3px 8px; font-size: 11px; color: #dc2626; border-color: #fca5a5;" onclick="revokeResetRequest(${r.id})">Hủy mã</button>`
          : `<span style="color:var(--muted); font-size:12px;">—</span>`;

        return `<tr style="border-bottom: 1px solid var(--sage-2);">
          <td style="padding: 10px 8px; white-space: nowrap; color: var(--muted);">${timeCreated}</td>
          <td style="padding: 10px 8px;">${studentInfo}</td>
          <td style="padding: 10px 8px;">${codeBox}</td>
          <td style="padding: 10px 8px; white-space: nowrap; font-size: 12px; color: var(--muted);">${timeExpiry}</td>
          <td style="padding: 10px 8px;">${statusBadge}</td>
          <td style="padding: 10px 8px; text-align: right;">${actions}</td>
        </tr>`;
      })
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding: 24px; text-align: center; color: #dc2626">Lỗi tải dữ liệu: ${escapeHTML(err.message)}</td></tr>`;
  }
}

window.copyResetCode = function(code) {
  navigator.clipboard.writeText(code).then(() => {
    toast(`Đã sao chép mã xác thực: ${code}`);
  }).catch(() => {
    prompt("Mã xác thực của sinh viên:", code);
  });
};

window.revokeResetRequest = async function(id) {
  if (!confirm("Bạn có chắc chắn muốn hủy mã xác thực này không?")) return;
  try {
    await requestAPI("/api/admin/password-resets/revoke", {
      method: "POST",
      body: JSON.stringify({ id }),
    });
    toast("Đã hủy mã xác thực.");
    loadAdminPasswordResets();
  } catch (err) {
    toast(err.message);
  }
};

if ($("#refreshAdminResetsBtn")) {
  $("#refreshAdminResetsBtn").onclick = () => loadAdminPasswordResets();
}

async function loadAdminMembers() {
  const data = await requestAPI("/api/admin/users");
  $("#adminUserList").innerHTML = data.users
    .map(
      (u) => `
    <tr style="border-bottom: 1px solid var(--sage-2);">
      <td style="padding: 12px 8px;"><strong class="${getNameClass(u.streakTier)}">${escapeHTML(u.displayName)}</strong><br><small>${escapeHTML(u.email)}</small></td>
      <td style="padding: 12px 8px;">${getRoleDisplay(u.role)}</td>
      <td style="padding: 12px 8px;"><strong style="color: var(--primary)">${u.totalPoints || 0}</strong></td>
      <td style="padding: 12px 8px; display: flex; gap: 8px;">
        <button class="button button-outline" style="padding: 4px 8px; font-size: 12px;" onclick="changeUserRole(${u.id}, '${u.role}')">Đổi quyền</button>
        <button class="button button-outline" style="padding: 4px 8px; font-size: 12px;" onclick="adjustUserPoints(${u.id})">Cộng/Trừ điểm</button>
      </td>
    </tr>
  `,
    )
    .join("");
}

window.changeUserRole = async (id, currentRole) => {
  const newRole = prompt(`Nhập quyền mới (student, lecturer, admin). Hiện tại: ${currentRole}`);
  if (!newRole) return;
  if (!["student", "lecturer", "admin"].includes(newRole)) {
    toast("Quyền không hợp lệ! Hãy nhập student, lecturer hoặc admin.");
    return;
  }
  if (confirm(`Bạn muốn chuyển thành viên này thành ${newRole}?`)) {
    try {
      await requestAPI(`/api/admin/users/${id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      toast("Đổi quyền thành công!");
      loadAdminMembers();
    } catch (e) {
      toast(e.message);
    }
  }
};

window.adjustUserPoints = async (id) => {
  const points = prompt("Nhập số điểm cần cộng (hoặc số âm để trừ):");
  if (!points || isNaN(points)) return;
  const reason = prompt("Lý do điều chỉnh:");
  if (!reason) return;
  try {
    await requestAPI(`/api/admin/contributions/adjust`, {
      method: "POST",
      body: JSON.stringify({ userId: id, points: Number(points), reason }),
    });
    toast("Điều chỉnh điểm thành công!");
  } catch (e) {
    toast(e.message);
  }
};

async function loadAdminDocuments() {
  const data = await requestAPI("/api/documents");
  const topicsData = await requestAPI("/api/topics");
  
  const pendingDocs = data.documents.filter((d) => d.status === "pending");
  const pendingTopics = (topicsData.topics || []).filter((t) => t.status === "pending");
  
  $("#adminDocList").innerHTML = pendingDocs.length
    ? pendingDocs
        .map(
          (d) => `
    <div style="padding: 16px; border: 1px solid var(--sage-2); border-radius: 8px;">
      <h3 style="margin: 0 0 8px 0;">${d.title} <span style="font-size: 12px; font-weight: normal; color: var(--sage-4);">(${d.format})</span></h3>
      <p style="margin: 0 0 12px 0;">Đề xuất bởi: ${d.submittedBy}</p>
      <div style="display: flex; gap: 8px;">
        <button class="button button-primary" style="padding: 6px 12px; font-size: 14px;" onclick="reviewDoc(${d.id}, 'approved')">Duyệt</button>
        <button class="button button-outline" style="padding: 6px 12px; font-size: 14px; color: var(--error); border-color: var(--error);" onclick="reviewDoc(${d.id}, 'rejected')">Từ chối</button>
        <a href="${d.sourceUrl}" target="_blank" class="button button-outline" style="padding: 6px 12px; font-size: 14px;">Xem file</a>
      </div>
    </div>
  `,
        )
        .join("")
    : "<p>Không có tài liệu nào đang chờ duyệt.</p>";

  $("#adminTopicList").innerHTML = pendingTopics.length
    ? pendingTopics
        .map(
          (t) => `
    <div style="padding: 16px; border: 1px solid var(--sage-2); border-radius: 8px;">
      <h3 style="margin: 0 0 8px 0;">${t.name}</h3>
      <p style="margin: 0 0 12px 0;">Đề xuất bởi: ${t.createdBy}</p>
      <div style="display: flex; gap: 8px;">
        <button class="button button-primary" style="padding: 6px 12px; font-size: 14px;" onclick="reviewTopic(${t.id}, 'approve')">Duyệt</button>
        <button class="button button-outline" style="padding: 6px 12px; font-size: 14px; color: var(--error); border-color: var(--error);" onclick="reviewTopic(${t.id}, 'reject')">Từ chối</button>
      </div>
    </div>
  `,
        )
        .join("")
    : "<p>Không có chủ đề nào đang chờ duyệt.</p>";
}

window.reviewDoc = async (id, status) => {
  try {
    await requestAPI(`/api/admin/documents/${id}/review`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    toast(
      status === "approved" ? "Đã duyệt tài liệu!" : "Đã từ chối tài liệu.",
    );
    loadAdminDocuments();
    hydrateServer();
  } catch (e) {
    toast(e.message);
  }
};

window.reviewTopic = async (id, action) => {
  try {
    await requestAPI(`/api/admin/topics/${id}/review`, {
      method: "PATCH",
      body: JSON.stringify({ action }),
    });
    toast(
      action === "approve" ? "Đã duyệt chủ đề!" : "Đã từ chối chủ đề.",
    );
    loadAdminDocuments();
    hydrateServer();
  } catch (e) {
    toast(e.message);
  }
};

$$(".admin-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".admin-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    $$(".admin-tab-content").forEach((c) => (c.style.display = "none"));
    const target = tab.dataset.adminTab;
    if (target === "overview") {
      $("#adminTabOverview").style.display = "block";
      loadAdminOverview();
    }
    if (target === "members") {
      $("#adminTabMembers").style.display = "block";
      loadAdminMembers();
    }
    if (target === "documents") {
      $("#adminTabDocuments").style.display = "block";
      loadAdminDocuments();
    }
    if (target === "competition") {
      $("#adminTabCompetition").style.display = "block";
      loadAdminCompetition();
    }
    if (target === "password-resets") {
      $("#adminTabPasswordResets").style.display = "block";
      loadAdminPasswordResets();
    }
  });
});

function switchAdminTab(targetTab) {
  const modal = $("#adminModal");
  if (modal && !modal.open) {
    try { modal.showModal(); } catch (e) {}
  }
  const tabBtn = $(`.admin-tab[data-admin-tab="${targetTab}"]`);
  if (tabBtn) tabBtn.click();
}
window.switchAdminTab = switchAdminTab;

$("#adminButton").onclick = async () => {
  if (serverMode) {
    try {
      $$(".admin-tab")[0].click(); // Click "Overview" tab to load it
    } catch (e) {
      toast("Không thể tải dữ liệu quản trị.");
      return;
    }
  }
  $("#adminModal").showModal();
};
$("#closeAdmin").onclick = () => $("#adminModal").close();

if ($("#viewAllContributionsBtn")) {
  $("#viewAllContributionsBtn").onclick = async () => {
    const res = await requestAPI("/api/me/history");
    if (!res || !res.history) return;
    const content = res.history.length ? res.history.map(renderActivityRow).join("") : `<p class="empty-state">Chưa có hoạt động nào.</p>`;
    $("#historyContent").innerHTML = content;
    $("#historyModal").showModal();
  };
}
if ($("#closeHistory")) {
  $("#closeHistory").onclick = () => $("#historyModal").close();
}
$("#openGuide").onclick = () =>
  document.getElementById("guideModal").showModal();
window.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    go("forum");
    setTimeout(() => $("#forumSearch").focus(), 60);
  }
});
window.addEventListener("hashchange", () =>
  go(location.hash.slice(1) || "home"),
);
window.deleteResponse = async (id) => {
  if (!confirm("Bạn có chắc chắn muốn xoá bình luận này?")) return;
  try {
    await requestAPI(`/api/admin/responses/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "deleted" }),
    });
    toast("Đã xoá bình luận.");
    const postId = $("#detailModal")
      .querySelector(".detail-actions button")
      .getAttribute("onclick")
      .match(/\d+/)[0];
    openDetail(postId);
    hydrateServer();
  } catch (err) {
    toast(err.message);
  }
};

window.deleteDocument = async (e, id) => {
  e.stopPropagation();
  if (!confirm("Bạn có chắc chắn muốn xoá tài liệu này?")) return;
  try {
    await requestAPI(`/api/admin/documents/${id}`, {
      method: "DELETE",
    });
    toast("Đã xoá tài liệu thành công.");
    hydrateServer();
  } catch (err) {
    toast(err.message);
  }
};

window.showReplyForm = (containerId, postId, actualParentId) => {
  if (serverMode && !session) return openAuth();
  const container = document.getElementById(`reply-form-${containerId}`);
  if (container.style.display === "block") {
    container.style.display = "none";
    container.innerHTML = "";
    return;
  }
  
  // Close all other inline forms
  document.querySelectorAll('[id^="reply-form-"]').forEach(el => {
    el.style.display = "none";
    el.innerHTML = "";
  });

  container.style.display = "block";
  const parentArg = actualParentId ? `, ${actualParentId}` : "";
  container.innerHTML = `
    <form onsubmit="event.preventDefault(); submitInlineReply(${containerId}, ${postId}${parentArg})">
      <div id="inlineReplyContentContainer-${containerId}" style="height: 80px; margin-top: 4px; border-radius: 8px;"></div>
      <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 8px;">
        <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer;">
          <input type="checkbox" id="inlineReplyAnonymous-${containerId}" style="width: auto; margin: 0; accent-color: var(--primary);">
          Ẩn danh
        </label>
        <div>
          <button type="button" class="button button-outline button-sm" onclick="document.getElementById('reply-form-${containerId}').style.display='none'">Hủy</button>
          <button type="submit" class="button button-primary button-sm">Gửi</button>
        </div>
      </div>
    </form>
  `;
  window.inlineReplyEditor = initEditor(`inlineReplyContentContainer-${containerId}`, "Viết phản hồi...");
  window.inlineReplyEditor.focus();
};

window.submitInlineReply = async (containerId, postId, actualParentId) => {
  if (!window.inlineReplyEditor) return;
  const rawText = window.inlineReplyEditor.getText().trim();
  const isAnonymous = document.getElementById(`inlineReplyAnonymous-${containerId}`).checked;
  const parentId = actualParentId || containerId;
  
  if (rawText.length < 10) {
    toast("Phản hồi cần có ít nhất 10 ký tự.");
    return;
  }
  const content = window.inlineReplyEditor.root.innerHTML;
  
  const formEl = document.getElementById(`reply-form-${containerId}`);
  setSubmitLoading(formEl, true);
  try {
    await requestAPI(`/api/posts/${postId}/responses`, {
      method: "POST",
      body: JSON.stringify({ content, isAnonymous, parentId }),
    });
    toast("Đã gửi phản hồi.");
    openDetail(postId);
    hydrateServer();
  } catch (err) {
    toast(err.message);
  } finally {
    setSubmitLoading(formEl, false);
  }
};

window.switchAccountTab = (tab) => {
  ["#tabContributionsBtn", "#tabMyPostsBtn", "#tabSavedPostsBtn"].forEach(id => {
    if ($(id)) $(id).classList.remove("active");
  });
  ["#recentContributionsContainer", "#myPostsContainer", "#savedPostsContainer"].forEach(id => {
    if ($(id)) $(id).style.display = "none";
  });

  if (tab === 'contributions') {
    if ($("#tabContributionsBtn")) $("#tabContributionsBtn").classList.add("active");
    if ($("#recentContributionsContainer")) $("#recentContributionsContainer").style.display = "block";
    if ($("#viewAllContributionsBtn")) $("#viewAllContributionsBtn").style.display = "";
  } else if (tab === 'myPosts') {
    if ($("#tabMyPostsBtn")) $("#tabMyPostsBtn").classList.add("active");
    if ($("#myPostsContainer")) $("#myPostsContainer").style.display = "grid";
    if ($("#viewAllContributionsBtn")) $("#viewAllContributionsBtn").style.display = "none";
  } else {
    if ($("#tabSavedPostsBtn")) $("#tabSavedPostsBtn").classList.add("active");
    if ($("#savedPostsContainer")) $("#savedPostsContainer").style.display = "grid";
    if ($("#viewAllContributionsBtn")) $("#viewAllContributionsBtn").style.display = "none";
  }
};

window.toggleSavePost = async (id) => {
  if (serverMode && !session) return openAuth();
  try {
    const data = await requestAPI(`/api/posts/${id}/save`, { method: "POST" });
    if (data.isSaved) {
      toast("Đã lưu bài đăng.");
    } else {
      toast("Đã bỏ lưu bài đăng.");
    }
    if (window.currentDetailPostId === id) {
      openDetail(id);
    }
    if (window.currentProfileId) {
      loadProfile(window.currentProfileId);
    }
    hydrateServer();
  } catch (err) {
    toast(err.message);
  }
};

window.votePost = async (id, value) => {
  if (serverMode && !session) return openAuth();
  try {
    await requestAPI(`/api/posts/${id}/vote`, {
      method: "POST",
      body: JSON.stringify({ value }),
    });
    toast("Đã ghi nhận lượt Vote.");
    hydrateServer();
    if ($("#detailModal").open) {
      setTimeout(() => openDetail(id), 100);
    }
  } catch (e) {
    toast(e.message);
  }
};

window.voteResponse = async (id, value) => {
  if (serverMode && !session) return openAuth();
  try {
    await requestAPI(`/api/responses/${id}/vote`, {
      method: "POST",
      body: JSON.stringify({ value }),
    });
    toast("Đã ghi nhận lượt Vote.");
    hydrateServer();
    const postId = $("#detailModal")
      .querySelector(".detail-actions button")
      .getAttribute("onclick")
      .match(/\d+/)[0];
    setTimeout(() => openDetail(postId), 100);
  } catch (e) {
    toast(e.message);
  }
};

window.pinPost = async (id, isPinned) => {
  try {
    await requestAPI(`/api/admin/posts/${id}/pin`, {
      method: "PATCH",
      body: JSON.stringify({ isPinned }),
    });
    toast("Đã " + (isPinned ? "ghim" : "bỏ ghim") + " bài đăng.");
    hydrateServer();
    if ($("#detailModal").open) {
      setTimeout(() => openDetail(id), 100);
    }
  } catch (e) {
    toast(e.message);
  }
};

$("#editProfile").onclick = () => {
  if (!session) return;
  $("#profileDisplayName").value = session.displayName || "";
  $("#profileStudentId").value = session.studentId || "";
  $("#profileRealName").value = session.realName || "";
  $("#profileClassName").value = session.className || "";

  // Reset tab về Thông tin cá nhân
  switchProfileTab("info");
  if ($("#currentPasswordInput")) $("#currentPasswordInput").value = "";
  if ($("#newPasswordInput")) $("#newPasswordInput").value = "";
  if ($("#confirmPasswordInput")) $("#confirmPasswordInput").value = "";

  $("#editProfileModal").showModal();
};

function openChangePasswordDialog() {
  if (!session) return;
  switchProfileTab("password");
  if ($("#currentPasswordInput")) $("#currentPasswordInput").value = "";
  if ($("#newPasswordInput")) $("#newPasswordInput").value = "";
  if ($("#confirmPasswordInput")) $("#confirmPasswordInput").value = "";
  $("#editProfileModal").showModal();
  setTimeout(() => {
    if ($("#currentPasswordInput")) $("#currentPasswordInput").focus();
  }, 100);
}

if ($("#openChangePasswordBtn")) {
  $("#openChangePasswordBtn").onclick = openChangePasswordDialog;
}
if ($("#cardChangePasswordBtn")) {
  $("#cardChangePasswordBtn").onclick = openChangePasswordDialog;
}

function switchProfileTab(tabName) {
  const isInfo = tabName === "info";
  if ($("#profileTabInfoBtn")) $("#profileTabInfoBtn").classList.toggle("active", isInfo);
  if ($("#profileTabPasswordBtn")) $("#profileTabPasswordBtn").classList.toggle("active", !isInfo);
  if ($("#editProfileForm")) $("#editProfileForm").style.display = isInfo ? "block" : "none";
  if ($("#changePasswordForm")) $("#changePasswordForm").style.display = isInfo ? "none" : "block";
  if ($("#editProfileModalTitle")) {
    $("#editProfileModalTitle").textContent = isInfo ? "Thiết lập tài khoản" : "Đổi mật khẩu";
  }
}

if ($("#profileTabInfoBtn")) {
  $("#profileTabInfoBtn").onclick = () => switchProfileTab("info");
}
if ($("#profileTabPasswordBtn")) {
  $("#profileTabPasswordBtn").onclick = () => switchProfileTab("password");
}

$("#editProfileForm").onsubmit = async (e) => {
  e.preventDefault();
  setSubmitLoading(e, true);
  try {
    await requestAPI("/api/me/profile", {
      method: "PATCH",
      body: JSON.stringify({
        displayName: $("#profileDisplayName").value.trim(),
        studentId: $("#profileStudentId").value.trim(),
        realName: $("#profileRealName").value.trim(),
        className: $("#profileClassName").value.trim(),
      }),
    });
    toast("Đã cập nhật hồ sơ!");
    $("#editProfileModal").close();
    hydrateServer();
  } catch (err) {
    toast(err.message);
  } finally {
    setSubmitLoading(e, false);
  }
};

if ($("#changePasswordForm")) {
  $("#changePasswordForm").onsubmit = async (e) => {
    e.preventDefault();
    const currentPassword = $("#currentPasswordInput")?.value || "";
    const newPassword = $("#newPasswordInput")?.value || "";
    const confirmPassword = $("#confirmPasswordInput")?.value || "";

    if (!currentPassword) {
      toast("Vui lòng nhập mật khẩu hiện tại.");
      return;
    }
    if (newPassword.length < 12) {
      toast("Mật khẩu mới phải có tối thiểu 12 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast("Mật khẩu xác nhận không khớp.");
      return;
    }

    setSubmitLoading(e, true);
    try {
      const res = await requestAPI("/api/me/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      toast(res.message || "Đổi mật khẩu thành công!");
      if ($("#currentPasswordInput")) $("#currentPasswordInput").value = "";
      if ($("#newPasswordInput")) $("#newPasswordInput").value = "";
      if ($("#confirmPasswordInput")) $("#confirmPasswordInput").value = "";
      switchProfileTab("info");
      $("#editProfileModal").close();
    } catch (err) {
      toast(err.message);
    } finally {
      setSubmitLoading(e, false);
    }
  };
}

window.promptChangeAvatar = async function() {
  const newAvatar = prompt("Bạn chỉ được đổi Avatar 1 lần duy nhất!\n\nHãy nhập 1 biểu tượng (Emoji) hoặc ký tự bạn muốn dùng làm Avatar:");
  if (!newAvatar) return;
  const trimmed = newAvatar.trim();
  if (trimmed.length === 0 || trimmed.length > 8) {
    toast("Avatar không hợp lệ (hãy chọn 1 icon ngắn).");
    return;
  }
  const confirmChange = confirm(`Bạn có chắc chắn muốn dùng "${trimmed}" làm Avatar vĩnh viễn không?`);
  if (!confirmChange) return;
  
  try {
    const btn = document.getElementById("changeAvatarBtn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "...";
    }
    await requestAPI("/api/me/avatar", {
      method: "PATCH",
      body: JSON.stringify({ avatar: trimmed })
    });
    toast("Đã đổi avatar thành công!");
    window.location.reload();
  } catch(e) {
    toast(e.message || "Lỗi khi đổi avatar.");
    const btn = document.getElementById("changeAvatarBtn");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Đổi";
    }
  }
};

// Auto-polling (Làm mới ngầm 30s/lần)
setInterval(() => {
  if (serverMode) {
    hydrateServer();
  }
}, 30000);

window.toggleReadMore = function(btn) {
  const content = btn.previousElementSibling;
  if (content.classList.contains('expanded')) {
    content.classList.remove('expanded');
    btn.textContent = 'Xem thêm';
  } else {
    content.classList.add('expanded');
    btn.textContent = 'Thu gọn';
  }
};

window.expandReplyTools = function() {
  const form = document.getElementById('replyForm');
  if (form) {
    form.classList.remove('collapsed');
    form.classList.add('expanded');
    const editor = document.querySelector('#replyContentContainer .ql-editor');
    if (editor) editor.focus();
  }
};

window.collapseReplyTools = function() {
  const form = document.getElementById('replyForm');
  if (form) {
    form.classList.remove('expanded');
    form.classList.add('collapsed');
  }
};

window.toggleAnonymousDropdown = function(e) {
  const dd = document.getElementById('anonymousDropdown');
  if (dd) {
    dd.classList.toggle('show');
    e.stopPropagation();
  }
};

window.setAnonymousReply = function(isAnon) {
  document.getElementById('replyAnonymous').checked = isAnon;
  const avatarLabel = document.getElementById('replyAvatarLabel');
  if (isAnon) {
    avatarLabel.textContent = '?';
    avatarLabel.classList.remove('teal');
    avatarLabel.style.background = '#888';
  } else {
    const initials = (session && session.initials) || '?';
    avatarLabel.textContent = initials;
    if (session && session.role !== 'admin') {
      avatarLabel.classList.add('teal');
    }
    if (!session || !session.role || session.role === 'student') {
      avatarLabel.style.background = ((session?.streakTier || 0) >= 3) ? '' : 'var(--primary)';
    } else {
      avatarLabel.style.background = '';
    }
  }
};

document.addEventListener('click', () => {
  const dd = document.getElementById('anonymousDropdown');
  if (dd) dd.classList.remove('show');
  const ddDoc = document.getElementById('docAnonymousDropdown');
  if (ddDoc) ddDoc.classList.remove('show');
});

/* ==========================================================================
   STUDY LOUNGE CONTROLLER (Phòng Tự Học NCKH - Multi-Device Synchronized)
   ========================================================================== */

/* --- 1. INDEXEDDB CLIENT STORAGE (Zero Server Bloat) --- */
const STUDY_IDB_NAME = "RE_SEARCH_STUDY_DB";
const STUDY_IDB_VERSION = 3;
let studyIdbInstance = null;

function getStudyDB() {
  return new Promise((resolve) => {
    if (studyIdbInstance) return resolve(studyIdbInstance);
    if (!window.indexedDB) {
      console.warn("IndexedDB not supported");
      return resolve(null);
    }
    const req = window.indexedDB.open(STUDY_IDB_NAME, STUDY_IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("custom_audio")) {
        db.createObjectStore("custom_audio", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("custom_wallpapers")) {
        db.createObjectStore("custom_wallpapers", { keyPath: "id" });
      }
    };
    req.onsuccess = (e) => {
      studyIdbInstance = e.target.result;
      resolve(studyIdbInstance);
    };
    req.onerror = (e) => {
      console.warn("IndexedDB open error:", e);
      resolve(null);
    };
  });
}

async function idbPut(storeName, item) {
  const db = await getStudyDB();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      store.put(item);
      tx.oncomplete = () => resolve(true);
      tx.onerror = (err) => {
        console.warn("idbPut transaction error:", err);
        resolve(false);
      };
    } catch (e) {
      console.warn("idbPut error:", e);
      resolve(false);
    }
  });
}

async function idbGetAll(storeName) {
  const db = await getStudyDB();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (err) => {
        console.warn("idbGetAll error:", err);
        resolve([]);
      };
    } catch (e) {
      console.warn("idbGetAll exception:", e);
      resolve([]);
    }
  });
}

async function idbDelete(storeName, id) {
  const db = await getStudyDB();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      store.delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = (err) => {
        console.warn("idbDelete error:", err);
        resolve(false);
      };
    } catch (e) {
      console.warn("idbDelete exception:", e);
      resolve(false);
    }
  });
}


const STUDY_QUOTES = [
  {
    en: "There are no secrets to success. It results from preparation, hard work, and learning from failure.",
    author: "General Colin Powell",
    vi: "Thành công không đến từ những bí quyết, thành công đến từ sự có chuẩn bị, chăm chỉ làm việc và bài học sau những lần thất bại."
  },
  {
    en: "However difficult life may seem, there is always something you can do and succeed at.",
    author: "Stephen Hawking",
    vi: "Dù cuộc đời bạn có khó khăn tới đâu, sẽ luôn tồn tại điều mà bạn có thể làm và thành công rực rỡ."
  },
  {
    en: "The best way to predict your future is to create it.",
    author: "Abraham Lincoln",
    vi: "Cách tốt nhất để dự đoán tương lai của bạn chính là tạo ra nó."
  },
  {
    en: "Hard work beats talent when talent doesn’t work hard.",
    author: "Tim Notke",
    vi: "Chăm chỉ sẽ chiến thắng Tài năng khi sự tài năng không chịu làm việc chăm chỉ."
  },
  {
    en: "Ninety-nine percent of failure comes from people who have the habit of making excuses.",
    author: "John Maxwell",
    vi: "Chín mươi chín phần trăm của sự thất bại đến từ những người luôn có thói quen trốn tránh công việc."
  },
  {
    en: "There are no shortcuts to any place worth going.",
    author: "Beverly Sills",
    vi: "Không có con đường tắt nào dẫn tới nơi tốt đẹp."
  },
  {
    en: "Success is not final; failure is not fatal. It’s the courage to continue that counts.",
    author: "Winston Churchill",
    vi: "Thành công chưa phải đã xong, thất bại không phải là kết thúc. Điều quan trọng nhất là dũng cảm bước tiếp trên con đường mình đã chọn."
  },
  {
    en: "The harder I work, the more luck I seem to have.",
    author: "Leonardo da Vinci",
    vi: "Tôi càng làm việc chăm chỉ bao nhiêu, tôi càng cảm thấy mình trở nên may mắn bấy nhiêu."
  },
  {
    en: "Failure is the opportunity to begin again intelligently.",
    author: "Henry Ford",
    vi: "Thất bại là cơ hội giúp bạn bắt đầu lại theo một cách sáng suốt hơn."
  },
  {
    en: "I don’t measure a man’s success by how he climbs but by how he bounces when he hits bottom.",
    author: "George S. Patton",
    vi: "Quan điểm của tôi không đánh giá thành công của một người qua cách anh ta phát triển đi lên mà qua cách anh ta vực dậy sau những lần chạm đáy."
  },
  {
    en: "Procrastination makes easy things hard, hard things hardest.",
    author: "Mason Cooley",
    vi: "Sự trì hoãn khiến những điều đơn giản trở nên khó khăn, và những điều đang khó khăn trở nên càng khó khăn hơn."
  },
  {
    en: "The secret of success is to do the common things uncommonly well.",
    author: "John D. Rockefeller",
    vi: "Bí mật của thành công là đó làm tốt từ những điều nhỏ nhặt nhất."
  },
  {
    en: "There’s no substitute for hard work.",
    author: "Thomas Edison",
    vi: "Không gì có thể thay thế được sự chăm chỉ."
  },
  {
    en: "Procrastination is like a credit card: it’s a lot of fun until you get the bill.",
    author: "Christopher Parker",
    vi: "Cảm giác của sự trì hoãn giống như khi ta dùng thẻ tín dụng: rất thích thú cho đến khi bạn nhận được cái giá phải trả."
  },
  {
    en: "If your dreams don’t scare you, they aren’t big enough.",
    author: "Muhammad Ali",
    vi: "Nếu những ước mơ không khiến bạn cảm thấy sợ hãi khi nghĩ đến, những ước mơ đó chắc chắn chưa đủ lớn."
  },
  {
    en: "The Success warrior is an average man with laser-like focus.",
    author: "Bruce Lee",
    vi: "Những chiến binh thành công thực chất là những con người bình thường với sự tập trung cao độ."
  },
  {
    en: "By perseverance, the snail reached the ark.",
    author: "Charles Spurgeon",
    vi: "Bằng sự bền bỉ, những chú ốc sên đã tới được con tàu Nô-ê."
  },
  {
    en: "Forget the mistake; remember the lesson.",
    author: "Khuyết danh",
    vi: "Bạn có thể quên đi những lỗi sai nhưng phải nhớ được những bài học."
  },
  {
    en: "To change your life, you must first change your day.",
    author: "Khuyết danh",
    vi: "Muốn thay đổi cuộc đời bạn, đầu tiên hãy thay đổi mỗi ngày của bạn."
  },
  {
    en: "Life has two rules. 1. Never quit. 2. Never forget the first one.",
    author: "Khuyết danh",
    vi: "Cuộc sống có 2 nguyên tắc: 1. Không bao giờ bỏ cuộc. 2. Không bao giờ quên nguyên tắc 1."
  },
  {
    en: "You don’t drown by falling in the water; you drown by staying there.",
    author: "Ed Cole",
    vi: "Bạn bị nhấn chìm không phải do ngã xuống nước, bạn bị nhấn chìm bởi việc không biết tiến lên."
  },
  {
    en: "If you cannot do great things, do little things in a great way.",
    author: "Napoleon Hill",
    vi: "Nếu bạn không thể làm được những điều vĩ đại, hãy làm một điều nhỏ bé một cách vĩ đại."
  },
  {
    en: "You may encounter defeats, but you must not be defeated.",
    author: "Maya Angelou",
    vi: "Bạn có thể đối mặt với sự thất bại, nhưng nhất định bạn không được phép thất bại."
  },
  {
    en: "You cannot change your future, but you can change your habits, and surely your habits will change your future.",
    author: "Dr. A.P.J. Abdul Kalam",
    vi: "Bạn không thể thay đổi tương lai của mình, nhưng bạn có thể thay đổi những thói quen, và những thói quen sẽ thay đổi tương lai của bạn."
  },
  {
    en: "Doubt kills more dreams than failure ever will.",
    author: "Karim Siddiki",
    vi: "Sự nghi ngờ sẽ giết chết những ước mơ của bạn nhiều hơn là những thất bại sẽ làm."
  },
  {
    en: "My advice is never do tomorrow what you can do today.",
    author: "Charles Dickens",
    vi: "Lời khuyên của tôi là không bao giờ để ngày mai làm những điều hôm nay bạn có thể làm."
  },
  {
    en: "The beautiful thing about learning is that no one can take it from you.",
    author: "B.B. King",
    vi: "Vẻ đẹp của việc học hành là không ai có quyền tước nó khỏi tay bạn."
  },
  {
    en: "If you can dream it, you can do it.",
    author: "Walt Disney",
    vi: "Nếu bạn có thể mơ về nó, thì bạn có thể làm được nó."
  },
  {
    en: "Things do not happen; they are made to happen.",
    author: "John F. Kennedy",
    vi: "Những sự việc không tự nhiên mà xảy ra, chúng được tác động để xảy ra."
  },
  {
    en: "All of us don’t have equal talents. But all of us have an equal opportunity to develop our talents.",
    author: "Dr. A.P.J. Abdul Kalam",
    vi: "Chúng ta không công bằng trong việc sở hữu tài năng, nhưng chúng ta được công bằng ở việc nắm giữ cơ hội phát triển tài năng."
  },
  {
    en: "Success is the sum of all efforts, repeated day in and day out.",
    author: "Robert Collier",
    vi: "Thành công là tổng hợp của tất cả sự nỗ lực, cố gắng ngày qua ngày."
  },
  {
    en: "Success doesn’t come to you; you go to it.",
    author: "Marva Collins",
    vi: "Thành công không tự đến với bạn, chính bạn sẽ đi tìm nó."
  },
  {
    en: "Success is the Progressive Realisation of a worthy goal.",
    author: "Earl Nightingale",
    vi: "Thành công là quá trình nhận thức được những mục tiêu xứng đáng."
  },
  {
    en: "Be the Boss - like Beyoncé",
    author: "Beyoncé",
    vi: "Hãy làm chủ - hãy như Beyoncé."
  },
  {
    en: "To be a winner, you must plan, prepare to win, and expect to win.",
    author: "Zig Ziglar",
    vi: "Để trở thành người chiến thắng, bạn buộc phải lên kế hoạch, chuẩn bị và mưu cầu chiến thắng."
  },
  {
    en: "And why do we fall, Bruce? So we learn to pick ourselves up.",
    author: "Thomas Wayne",
    vi: "Anh có biết tại sao chúng ta lại vấp ngã không Bruce? Bởi vì chúng ta sẽ học được cách tự nâng bản thân dậy sau đó."
  },
  {
    en: "If you fell down yesterday, stand up today.",
    author: "H. G. Wells",
    vi: "Nếu như bạn vừa vấp ngã ngày hôm qua, hãy đứng dậy và bước tiếp vào hôm nay."
  },
  {
    en: "The day you take complete responsibility for yourself and the day you stop making any excuses, that’s the day you start at the top.",
    author: "O.J. Simpson",
    vi: "Ngày mà bạn hoàn toàn biết tự chịu trách nhiệm và ngừng đưa ra những lời biện minh, đó là ngày mà bạn thành công nhất."
  },
  {
    en: "Do the best you can until you know better. Then, when you know better, do better.",
    author: "Maya Angelou",
    vi: "Hãy cố gắng hết sức cho đến khi bạn biết nhiều hơn. Sau khi biết nhiều hơn, hãy làm tốt hơn."
  },
  {
    en: "Don’t say you don’t have enough time. You have the same hours per day given to Helen Keller, Pasteur, Michelangelo, Mother Teresa, Leonardo da Vinci, Thomas Jefferson, and Albert Einstein.",
    author: "H. Jackson Brown Jr.",
    vi: "Đừng nói rằng bạn không có đủ thời gian. Quỹ thời gian mỗi ngày bằng với quỹ thời gian mỗi ngày mà những người thành công như Albert Einstein có."
  },
  {
    en: "When we are no longer able to change a situation, we are challenged to change ourselves.",
    author: "Viktor Frankl",
    vi: "Khi mà bạn không thể thay đổi tình huống xảy ra được nữa, đó là lúc chúng ta được thử thách để thay đổi bản thân."
  },
  {
    en: "Make sure your own worst enemy doesn’t live between your two ears.",
    author: "Laird Hamilton",
    vi: "Hãy đảm bảo rằng kẻ thù lớn nhất của bạn không nằm ngay trong đầu bạn."
  },
  {
    en: "Don’t wish it was easier; wish you’re better.",
    author: "Jim Rohn",
    vi: "Đừng mong mọi chuyện dễ dàng hơn, hãy mong chúng tốt hơn."
  },
  {
    en: "Start where you are. Use what you have. Do what you can.",
    author: "Arthur Ashe",
    vi: "Bắt đầu tại nơi bạn đứng. Dùng những thứ bạn có. Làm những điều mà bạn có thể."
  },
  {
    en: "Good things come to people who wait, but better things come to people who go and get them.",
    author: "Khuyết danh",
    vi: "Những điều tốt đẹp sẽ đến với những người biết kiên nhẫn, nhưng những điều tốt hơn sẽ dành cho những người biết tự giành lấy nó."
  },
  {
    en: "I don’t regret the things I have done. I regret what I didn’t when I had the chance.",
    author: "Khuyết danh",
    vi: "Tôi không bao giờ hối hận về những điều tôi đã làm. Tôi hối hận về những điều tôi không làm khi mình đã có cơ hội để làm nó."
  },
  {
    en: "The Expert in everything was once a beginner.",
    author: "Khuyết danh",
    vi: "Bất kỳ chuyên gia nào cũng đều có thời gian mới bắt đầu."
  },
  {
    en: "The only place where success comes before work is the dictionary.",
    author: "Vidal Sassoon",
    vi: "Nơi duy nhất mà thành công đến trước cả khi làm là ở cuốn từ điển."
  },
  {
    en: "If it’s important to you, you’ll find a way. If not, you’ll find an excuse.",
    author: "Ryan Blair",
    vi: "Nếu điều đó là đủ quan trọng, bạn sẽ tìm cách. Nếu không, bạn chắc chắn sẽ tìm sự biện minh."
  },
  {
    en: "Challenges are what make life interesting. Overcoming them is what makes life meaningful.",
    author: "Joshua J. Marine",
    vi: "Sự thử thách là những điều khiến cho cuộc sống trở nên thú vị. Vượt qua chúng khiến cuộc sống trở nên đáng sống hơn."
  },
  {
    en: "It’s going to be easy, but it’s going to be worth it.",
    author: "Khuyết danh",
    vi: "Mọi chuyện sẽ trở nên đơn giản hơn, và mọi chuyện sẽ trở nên xứng đáng."
  },
  {
    en: "The pain you feel today is the strength you’ll feel tomorrow.",
    author: "Khuyết danh",
    vi: "Nỗi đau của bạn ngày hôm nay sẽ là sức mạnh cho bạn vào ngày hôm sau."
  },
  {
    en: "Believe you can do, and you’re halfway done.",
    author: "Khuyết danh",
    vi: "Tin vào bản thân mình, bạn đã thành công được một nửa."
  }
];

let defaultStudyDocTitle = document.title || "RE:SEARCH - Diễn đàn Sinh viên & NCKH";
let lastStudyQuoteIndex = -1;

function formatMMSS(totalSecs) {
  const safe = Math.max(0, Math.floor(totalSecs));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateTabTitle() {
  if (studyState.isRunning) {
    const timeStr = formatMMSS(studyState.remainingSeconds);
    const icon = studyState.mode === 'focus' ? '🔥' : '☕';
    const label = studyState.mode === 'focus' ? 'Tập trung' : (studyState.mode === 'shortbreak' ? 'Nghỉ ngắn' : 'Nghỉ dài');
    document.title = `(${timeStr}) ${icon} ${label} | RE:SEARCH`;
  } else {
    document.title = defaultStudyDocTitle;
  }
}

function rotateStudyQuote(animate = true) {
  const quoteWrap = $("#timerQuoteWrap");
  const quoteEl = $("#timerQuoteText");
  if (!quoteEl) return;

  let nextIdx;
  if (STUDY_QUOTES.length <= 1) {
    nextIdx = 0;
  } else {
    do {
      nextIdx = Math.floor(Math.random() * STUDY_QUOTES.length);
    } while (nextIdx === lastStudyQuoteIndex);
  }
  lastStudyQuoteIndex = nextIdx;
  const q = STUDY_QUOTES[nextIdx];

  const renderContent = () => {
    const authorSpan = (q.author && q.author !== "Khuyết danh" && q.author !== "Unknown")
      ? ` <span class="quote-author">— ${q.author}</span>`
      : "";
    quoteEl.innerHTML = `<span class="quote-vi">“${q.vi.replace(/^["“]|["”]$/g, "")}”</span>${authorSpan}`;
    if (quoteWrap) {
      quoteWrap.title = q.en ? `“${q.en}”\n(Bấm để đổi câu nói truyền cảm hứng)` : "Bấm để đổi câu nói truyền cảm hứng";
    }
  };

  if (animate) {
    quoteEl.style.opacity = "0";
    quoteEl.style.transform = "translateY(3px)";
    setTimeout(() => {
      renderContent();
      quoteEl.style.opacity = "1";
      quoteEl.style.transform = "translateY(0)";
    }, 180);
  } else {
    renderContent();
  }
}

/* --- 3. STREAK PERKS EVALUATOR --- */
function getUserStudyStreak() {
  const curSession = session || (typeof window !== 'undefined' && window.session);
  if (!curSession) return 0;
  if (curSession.role === 'admin' || curSession.role === 'ta' || curSession.role === 'lecturer') return 999;
  return Number(curSession.streak || 0);
}

window.updateStudyStreakPerks = function() {
  const streak = getUserStudyStreak();
  const curSession = session || (typeof window !== 'undefined' && window.session);
  const isAdmin = curSession && curSession.role === 'admin';

  const chipVal = $("#studyUserStreakVal");
  if (chipVal) chipVal.textContent = isAdmin ? "Admin" : streak;

  // Streak 3: Ambient Environment Audio (4 Tracks) & Co-Study interaction
  const envUnlocked = streak >= 3;
  const badgeEnvLock = $("#badgeEnvLock");
  const bannerEnvLocked = $("#bannerEnvLocked");
  if (badgeEnvLock) {
    badgeEnvLock.className = `perk-badge ${envUnlocked ? 'unlocked' : ''}`;
    badgeEnvLock.textContent = envUnlocked ? "" : "🔒 3d";
    badgeEnvLock.style.display = envUnlocked ? "none" : "inline-flex";
  }
  if (bannerEnvLocked) {
    bannerEnvLocked.style.display = envUnlocked ? "none" : "block";
  }

  // Streak 7: Mixable Sounds (9 Tracks) & Focus Music (4 Tracks)
  const mixUnlocked = streak >= 7;
  const badgeMixLock = $("#badgeMixLock");
  const bannerMixLocked = $("#bannerMixLocked");
  if (badgeMixLock) {
    badgeMixLock.className = `perk-badge ${mixUnlocked ? 'unlocked' : ''}`;
    badgeMixLock.textContent = mixUnlocked ? "" : "🔒 7d";
    badgeMixLock.style.display = mixUnlocked ? "none" : "inline-flex";
  }
  if (bannerMixLocked) {
    bannerMixLocked.style.display = mixUnlocked ? "none" : "block";
  }

  const musicUnlocked = streak >= 7;
  const badgeMusicLock = $("#badgeMusicLock");
  const bannerMusicLocked = $("#bannerMusicLocked");
  if (badgeMusicLock) {
    badgeMusicLock.className = `perk-badge ${musicUnlocked ? 'unlocked' : ''}`;
    badgeMusicLock.textContent = musicUnlocked ? "" : "🔒 7d";
    badgeMusicLock.style.display = musicUnlocked ? "none" : "inline-flex";
  }
  if (bannerMusicLocked) {
    bannerMusicLocked.style.display = musicUnlocked ? "none" : "block";
  }

  // Streak 14: Preset Wallpapers (7 System Wallpapers) & Clock Color Customization (5 Colors)
  const wallPresetUnlocked = streak >= 14;
  const badgeWallPresetLock = $("#badgeWallPresetLock");
  if (badgeWallPresetLock) {
    badgeWallPresetLock.className = `perk-badge ${wallPresetUnlocked ? 'unlocked' : ''}`;
    badgeWallPresetLock.textContent = wallPresetUnlocked ? "" : "🔒 14d";
    badgeWallPresetLock.style.display = wallPresetUnlocked ? "none" : "inline-flex";
  }
  const wallPresetWrap = $(".wallpaper-presets-wrap");
  if (wallPresetWrap) wallPresetWrap.classList.toggle("locked-feature", !wallPresetUnlocked);

  const clockColorUnlocked = streak >= 14;
  const badgeClockColorLock = $("#badgeClockColorLock");
  if (badgeClockColorLock) {
    badgeClockColorLock.className = `perk-badge ${clockColorUnlocked ? 'unlocked' : ''}`;
    badgeClockColorLock.textContent = clockColorUnlocked ? "" : "🔒 14d";
    badgeClockColorLock.style.display = clockColorUnlocked ? "none" : "inline-flex";
  }
  const clockColorWrap = $(".clock-color-wrap");
  if (clockColorWrap) clockColorWrap.classList.toggle("locked-feature", !clockColorUnlocked);

  // Streak 30: Custom Audio Upload (Max 3 Env, Max 5 Mix, Max 3 Music) & First 5 Color Palettes
  const customAudioUnlocked = streak >= 30;
  const badgeCustomEnvLock = $("#badgeCustomEnvLock");
  const badgeCustomMixLock = $("#badgeCustomMixLock");
  const badgeCustomMusicLock = $("#badgeCustomMusicLock");
  const btnUploadEnvAudio = $("#btnUploadEnvAudio");
  const btnUploadMixAudio = $("#btnUploadMixAudio");
  const btnUploadMusicAudio = $("#btnUploadMusicAudio");
  if (badgeCustomEnvLock) {
    badgeCustomEnvLock.className = `perk-badge ${customAudioUnlocked ? 'unlocked' : ''}`;
    badgeCustomEnvLock.textContent = customAudioUnlocked ? "" : "🔒 30d";
    badgeCustomEnvLock.style.display = customAudioUnlocked ? "none" : "inline-flex";
  }
  if (badgeCustomMixLock) {
    badgeCustomMixLock.className = `perk-badge ${customAudioUnlocked ? 'unlocked' : ''}`;
    badgeCustomMixLock.textContent = customAudioUnlocked ? "" : "🔒 30d";
    badgeCustomMixLock.style.display = customAudioUnlocked ? "none" : "inline-flex";
  }
  if (badgeCustomMusicLock) {
    badgeCustomMusicLock.className = `perk-badge ${customAudioUnlocked ? 'unlocked' : ''}`;
    badgeCustomMusicLock.textContent = customAudioUnlocked ? "" : "🔒 30d";
    badgeCustomMusicLock.style.display = customAudioUnlocked ? "none" : "inline-flex";
  }
  if (btnUploadEnvAudio) btnUploadEnvAudio.disabled = !customAudioUnlocked;
  if (btnUploadMixAudio) btnUploadMixAudio.disabled = !customAudioUnlocked;
  if (btnUploadMusicAudio) btnUploadMusicAudio.disabled = !customAudioUnlocked;

  // Streak 50: Master Customization (All 10 Color Palettes), Unlimited Audio Uploads & Custom Wallpaper Upload
  const wallUploadUnlocked = streak >= 50;
  const badgeWallUploadLock = $("#badgeWallUploadLock");
  const btnUploadWall = $("#btnUploadWall");
  if (badgeWallUploadLock) {
    badgeWallUploadLock.className = `perk-badge ${wallUploadUnlocked ? 'unlocked' : ''}`;
    badgeWallUploadLock.textContent = wallUploadUnlocked ? "" : "🔒 50d";
    badgeWallUploadLock.style.display = wallUploadUnlocked ? "none" : "inline-flex";
  }
  if (btnUploadWall) btnUploadWall.disabled = !wallUploadUnlocked;

  const badgeMasterCustomLock = $("#badgeMasterCustomLock");
  if (badgeMasterCustomLock) {
    if (streak >= 50) {
      badgeMasterCustomLock.style.display = "none";
    } else if (streak >= 30) {
      badgeMasterCustomLock.className = "perk-badge";
      badgeMasterCustomLock.textContent = "🔒 50d (Thêm 5 phối màu)";
      badgeMasterCustomLock.style.display = "inline-flex";
    } else {
      badgeMasterCustomLock.className = "perk-badge";
      badgeMasterCustomLock.textContent = "🔒 30d (Mở 5 phối màu)";
      badgeMasterCustomLock.style.display = "inline-flex";
    }
  }

  const badgeCustomEnvLimit = $("#badgeCustomEnvLimit");
  const badgeCustomMixLimit = $("#badgeCustomMixLimit");
  const badgeCustomMusicLimit = $("#badgeCustomMusicLimit");
  if (streak >= 50) {
    if (badgeCustomEnvLimit) {
      badgeCustomEnvLimit.textContent = "✨ Không giới hạn (50d)";
      badgeCustomEnvLimit.classList.add("unlimited");
    }
    if (badgeCustomMixLimit) {
      badgeCustomMixLimit.textContent = "✨ Không giới hạn (50d)";
      badgeCustomMixLimit.classList.add("unlimited");
    }
    if (badgeCustomMusicLimit) {
      badgeCustomMusicLimit.textContent = "✨ Không giới hạn (50d)";
      badgeCustomMusicLimit.classList.add("unlimited");
    }
  } else {
    if (badgeCustomEnvLimit) {
      badgeCustomEnvLimit.textContent = `Tối đa 3 tệp (${studyState.customEnvAudioTracks?.length || 0}/3)`;
      badgeCustomEnvLimit.classList.remove("unlimited");
    }
    if (badgeCustomMixLimit) {
      badgeCustomMixLimit.textContent = `Tối đa 5 tệp (${studyState.customMixAudioTracks?.length || 0}/5)`;
      badgeCustomMixLimit.classList.remove("unlimited");
    }
    if (badgeCustomMusicLimit) {
      badgeCustomMusicLimit.textContent = `Tối đa 3 tệp (${studyState.customMusicAudioTracks?.length || 0}/3)`;
      badgeCustomMusicLimit.classList.remove("unlimited");
    }
  }

  const customWallName = $("#customWallName");
  if (customWallName && !studySettings.activeWallpaper?.startsWith("custom_")) {
    if (streak >= 50) {
      customWallName.textContent = "Không giới hạn dung lượng ảnh (Chuỗi 50 ngày)";
    } else {
      customWallName.textContent = "Mở khóa tải ảnh riêng ở Chuỗi 50 ngày";
    }
  }

  renderEnvironmentAudioGrid();
  renderMixAudioGrid();
  renderMusicAudioGrid();
  renderWallpaperPresets();
  renderClockColorPicker();
  renderColorPalette();
  renderCustomWallpapersList();
  loadCustomAudioFromDB();
};

/* --- 4. TIMER DISPLAY & POMODORO CYCLE --- */
function updateTimerDisplay() {
  const clock = $("#timerClock");
  const progressCircle = $("#timerProgressCircle");
  const label = $("#timerStatusLabel");
  const startBtn = $("#studyStartBtn");
  const startBtnText = $("#studyStartBtnText");
  const pauseBtn = $("#studyPauseBtn");
  const completeBtn = $("#studyCompleteBtn");
  const cycleLabel = $("#studyCycleLabel");

  if (clock) {
    clock.textContent = formatMMSS(studyState.remainingSeconds);
  }

  const totalSecs = studyState.durationMinutes * 60;
  const progress = totalSecs > 0 ? (1 - Math.max(0, studyState.remainingSeconds) / totalSecs) : 0;
  const offset = 660 * progress;
  if (progressCircle) {
    progressCircle.style.strokeDashoffset = offset;
  }

  if (label) {
    if (studyState.isRunning) {
      if (studyState.mode === 'shortbreak') {
        label.textContent = '☕ Đang nghỉ ngắn phục hồi';
        label.style.color = '#38bdf8';
      } else if (studyState.mode === 'longbreak') {
        label.textContent = '🌿 Đang nghỉ dài nạp năng lượng';
        label.style.color = '#4ade80';
      } else {
        label.textContent = '🔥 Đang tập trung cao độ';
        label.style.color = 'var(--primary)';
      }
    } else if (studyState.remainingSeconds < totalSecs) {
      label.textContent = '⏸ Đang tạm dừng';
      label.style.color = 'var(--muted)';
    } else {
      label.textContent = 'Sẵn sàng ca học';
      label.style.color = 'var(--muted)';
    }
  }

  if (startBtnText) {
    if (studyState.remainingSeconds < totalSecs && !studyState.isRunning) {
      startBtnText.textContent = "Tiếp tục";
    } else if (studyState.mode === 'shortbreak' || studyState.mode === 'longbreak') {
      startBtnText.textContent = "Bắt đầu nghỉ";
    } else {
      startBtnText.textContent = "Bắt đầu học";
    }
  }

  if (cycleLabel) {
    if (studyState.cycleIndex === 0) {
      cycleLabel.textContent = "Lượt 0/4 (Chưa bắt đầu)";
    } else if (studyState.mode === 'focus') {
      cycleLabel.textContent = `Lượt ${studyState.cycleIndex}/4 (Tập trung)`;
    } else if (studyState.mode === 'shortbreak') {
      cycleLabel.textContent = `Nghỉ ngắn (${studySettings.shortBreakMins}m) - Sau lượt ${studyState.cycleIndex > 1 ? studyState.cycleIndex - 1 : 1}`;
    } else if (studyState.mode === 'longbreak') {
      cycleLabel.textContent = `Nghỉ dài (${studySettings.longBreakMins}m) - Hoàn tất chu kỳ 4 lượt!`;
    }
  }

  // Update dynamic mode button labels
  const labelFocus = $("#labelModeFocus");
  const labelShortBreak = $("#labelModeShortBreak");
  const labelLongBreak = $("#labelModeLongBreak");
  if (labelFocus) labelFocus.textContent = `⏱️ ${studySettings.focusMins} phút`;
  if (labelShortBreak) labelShortBreak.textContent = `☕ ${studySettings.shortBreakMins} phút`;
  if (labelLongBreak) labelLongBreak.textContent = `🌿 ${studySettings.longBreakMins} phút`;

  $$("#studyCycleDots .cycle-dot").forEach((dot) => {
    const c = Number(dot.dataset.cycle);
    dot.classList.remove("active", "completed");
    if (studyState.cycleIndex === 0) {
      // Chưa bắt đầu: không sáng dot nào
    } else if (studyState.mode === 'longbreak') {
      dot.classList.add("completed");
    } else if (c < studyState.cycleIndex) {
      dot.classList.add("completed");
    } else if (c === studyState.cycleIndex) {
      dot.classList.add("active");
    }
  });

  if (startBtn) startBtn.style.display = studyState.isRunning ? "none" : "inline-flex";
  if (pauseBtn) pauseBtn.style.display = studyState.isRunning ? "inline-flex" : "none";
  if (completeBtn) {
    // Nút hoàn thành xuất hiện khi đồng hồ chạy
    completeBtn.style.display = studyState.isRunning ? "inline-flex" : "none";
  }

  $("#btnModeFocus")?.classList.toggle("active", studyState.mode === 'focus');
  $("#btnModeShortBreak")?.classList.toggle("active", studyState.mode === 'shortbreak');
  $("#btnModeLongBreak")?.classList.toggle("active", studyState.mode === 'longbreak');

  updateTabTitle();
  if (typeof updateSelfCoStudyCard === 'function') {
    updateSelfCoStudyCard();
  }
}

function setStudyMode(mode, duration) {
  let standardMode = mode;
  if (mode === 'pomodoro') standardMode = 'focus';
  if (mode === 'deep') {
    standardMode = 'focus';
    duration = duration || 50;
  }

  if (studyState.isRunning) {
    pauseStudyTimer(false);
  }

  studyState.mode = standardMode;
  const finalDuration = duration || (
    standardMode === 'focus' ? studySettings.focusMins :
    standardMode === 'shortbreak' ? studySettings.shortBreakMins :
    studySettings.longBreakMins
  );

  studyState.durationMinutes = finalDuration;
  studyState.remainingSeconds = finalDuration * 60;
  studyState.targetEndMs = 0;
  studyState.elapsedSessionSeconds = 0;

  updateTimerDisplay();
  syncStudyToServer();
}

function advanceStudyCycle(manualSkip = false) {
  pauseStudyTimer(false);

  if (studyState.mode === 'focus') {
    if (studyState.cycleIndex === 0) {
      studyState.cycleIndex = 1;
    }
    if (studyState.cycleIndex < 4) {
      studyState.cycleIndex++;
      studyState.mode = 'shortbreak';
      studyState.durationMinutes = studySettings.shortBreakMins;
      studyState.remainingSeconds = studySettings.shortBreakMins * 60;
      toast(`☕ Hoàn thành lượt tập trung! Nghỉ giải lao ${studySettings.shortBreakMins} phút.`);
      if (studySettings.autoStartBreaks) {
        startStudyTimer();
      }
    } else {
      studyState.cycleIndex = 4;
      studyState.mode = 'longbreak';
      studyState.durationMinutes = studySettings.longBreakMins;
      studyState.remainingSeconds = studySettings.longBreakMins * 60;
      toast(`🏆 Hoàn thành trọn vẹn 4 lượt Pomodoro! Nghỉ dài ${studySettings.longBreakMins} phút.`);
      if (studySettings.autoStartBreaks) {
        startStudyTimer();
      }
    }
  } else {
    // Was in break (shortbreak or longbreak) -> Advance to Focus
    if (studyState.mode === 'longbreak') {
      studyState.cycleIndex = 1;
    }
    studyState.mode = 'focus';
    studyState.durationMinutes = studySettings.focusMins;
    studyState.remainingSeconds = studySettings.focusMins * 60;
    toast(`⏱️ Bắt đầu lượt tập trung ${studyState.cycleIndex}/4! Hãy giữ nhịp độ.`);
    if (studySettings.autoStartPomodoros) {
      startStudyTimer();
    }
  }

  studyState.targetEndMs = studyState.isRunning ? Date.now() + studyState.remainingSeconds * 1000 : 0;
  studyState.elapsedSessionSeconds = 0;
  rotateStudyQuote();
  updateTimerDisplay();
  syncStudyToServer();
}

async function syncStudyToServer() {
  if (!canAccessStudyLounge()) return;
  if (!session) return;
  try {
    const res = await requestAPI("/api/study/sync", {
      method: "POST",
      body: JSON.stringify({
        mode: studyState.mode,
        durationMinutes: studyState.durationMinutes,
        remainingSeconds: studyState.remainingSeconds,
        targetEndMs: studyState.targetEndMs,
        isRunning: studyState.isRunning,
        cycleIndex: studyState.cycleIndex,
        goal: studyState.goal,
        wallpaper: studySettings.activeWallpaper || 'default',
        aura: studySettings.activeAura || 'emerald'
      })
    });
    studyState.lastSyncMs = Date.now();
    return res;
  } catch (e) {
    console.warn("syncStudyToServer:", e);
  }
}

function startLocalTimerTick() {
  studyState.isRunning = true;
  if (studyState.timerInterval) {
    clearInterval(studyState.timerInterval);
  }

  studyState.timerInterval = setInterval(() => {
    const now = Date.now();
    if (studyState.targetEndMs > 0) {
      const remaining = Math.max(0, Math.floor((studyState.targetEndMs - now) / 1000));
      studyState.remainingSeconds = remaining;
      studyState.elapsedSessionSeconds++;
      updateTimerDisplay();
      if (remaining <= 0) {
        finishStudySession(true);
      }
    } else {
      if (studyState.remainingSeconds > 0) {
        studyState.remainingSeconds--;
        studyState.elapsedSessionSeconds++;
        updateTimerDisplay();
      } else {
        finishStudySession(true);
      }
    }
  }, 1000);

  if (!studyState.syncHeartbeatInterval) {
    studyState.syncHeartbeatInterval = setInterval(syncStudyToServer, 20000);
  }
}

async function startStudyTimer() {
  if (studyState.isRunning) return;
  if (studyState.cycleIndex === 0) {
    studyState.cycleIndex = 1;
  }
  studyState.goal = ($("#studyGoalInput") ? $("#studyGoalInput").value : "").trim();
  studyState.targetEndMs = Date.now() + studyState.remainingSeconds * 1000;

  if (studyState.audioCtx && studyState.audioCtx.state === 'suspended') {
    studyState.audioCtx.resume();
  }

  startLocalTimerTick();
  updateTimerDisplay();
  await syncStudyToServer();
  await fetchStudyLounge();
}

async function pauseStudyTimer(sync = true) {
  studyState.isRunning = false;
  if (studyState.timerInterval) {
    clearInterval(studyState.timerInterval);
    studyState.timerInterval = null;
  }
  if (studyState.targetEndMs > 0) {
    studyState.remainingSeconds = Math.max(0, Math.floor((studyState.targetEndMs - Date.now()) / 1000));
    studyState.targetEndMs = 0;
  }
  updateTimerDisplay();
  if (sync) {
    await syncStudyToServer();
    await fetchStudyLounge();
  }
}

async function resetStudyTimer() {
  await pauseStudyTimer(false);
  studyState.completedFocusCycles = 0;
  studyState.accumulatedFocusMinutes = 0;
  studyState.remainingSeconds = studyState.durationMinutes * 60;
  studyState.targetEndMs = 0;
  studyState.elapsedSessionSeconds = 0;
  if (session) {
    try {
      await requestAPI("/api/study/leave", { method: "POST" });
    } catch (e) {}
  }
  updateTimerDisplay();
  await fetchStudyLounge();
  toast("Đã đặt lại đồng hồ.");
}

async function finishStudySession(autoCompleted = false) {
  await pauseStudyTimer(false);
  playAlarmSound(studySettings.alarmSound);
  sendStudyNotification();

  const totalElapsedMins = Math.round(studyState.elapsedSessionSeconds / 60);
  const isFocus = (studyState.mode === 'focus' || studyState.mode === 'pomodoro');

  if (isFocus) {
    if (autoCompleted) {
      studyState.completedFocusCycles = (studyState.completedFocusCycles || 0) + 1;
      studyState.accumulatedFocusMinutes = (studyState.accumulatedFocusMinutes || 0) + studyState.durationMinutes;
    } else {
      if (totalElapsedMins >= 20) {
        studyState.completedFocusCycles = (studyState.completedFocusCycles || 0) + 1;
      }
      studyState.accumulatedFocusMinutes = (studyState.accumulatedFocusMinutes || 0) + totalElapsedMins;
    }
  }

  const durationToCredit = isFocus ? (autoCompleted ? (studyState.accumulatedFocusMinutes || studyState.durationMinutes) : (studyState.accumulatedFocusMinutes || totalElapsedMins)) : 0;
  const cyclesToCredit = studyState.completedFocusCycles || 0;

  if (session && (durationToCredit >= 20 || cyclesToCredit >= 1)) {
    try {
      const res = await requestAPI("/api/study/complete", {
        method: "POST",
        body: JSON.stringify({
          durationMinutes: durationToCredit,
          cyclesCompleted: cyclesToCredit,
          goal: studyState.goal || "Tự học NCKH"
        })
      });
      if (res && res.success) {
        if (res.message) {
          toast(res.message);
        } else if (res.pointsAwarded > 0) {
          toast(`🎉 Hoàn thành xuất sắc ca tự học (${cyclesToCredit} lượt)! +${res.pointsAwarded} điểm thưởng tuần & giữ chuỗi!`);
        } else {
          toast(`🎉 Hoàn tất ca học (${cyclesToCredit} lượt)! Hoạt động đã được ghi nhận.`);
        }
        loadContributions();
      }
    } catch (e) {
      console.error(e);
    }
  } else if (durationToCredit >= 20 || cyclesToCredit >= 1) {
    toast(`🎉 Hoàn thành ca tự học ${durationToCredit} phút! (Đăng nhập để lưu điểm & giữ chuỗi)`);
  } else {
    toast("🎉 Đã hoàn tất ca học!");
  }

  if (!autoCompleted) {
    // Khi bấm hoàn thành: reset thời gian về lượt 0 và thoát khu vực bàn tròn
    studyState.completedFocusCycles = 0;
    studyState.accumulatedFocusMinutes = 0;
    studyState.cycleIndex = 0;
    studyState.mode = 'focus';
    studyState.durationMinutes = studySettings.focusMins;
    studyState.remainingSeconds = studySettings.focusMins * 60;
    studyState.targetEndMs = 0;
    studyState.elapsedSessionSeconds = 0;

    if (session) {
      try {
        await requestAPI("/api/study/leave", { method: "POST" });
      } catch (e) {}
    }

    updateTimerDisplay();
    await fetchStudyLounge();
  } else {
    advanceStudyCycle(false);
  }
}

// Background tab throttling resolution via Page Visibility & Focus APIs
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    if (studyState.isRunning && studyState.targetEndMs > 0) {
      const remaining = Math.max(0, Math.floor((studyState.targetEndMs - Date.now()) / 1000));
      studyState.remainingSeconds = remaining;
      updateTimerDisplay();
      if (remaining <= 0) {
        finishStudySession(true);
      }
    }
    fetchStudyLounge();
  }
});
window.addEventListener("focus", () => {
  if (studyState.isRunning && studyState.targetEndMs > 0) {
    const remaining = Math.max(0, Math.floor((studyState.targetEndMs - Date.now()) / 1000));
    studyState.remainingSeconds = remaining;
    updateTimerDisplay();
  }
  fetchStudyLounge();
});

/* --- 5. CO-STUDY LOUNGE (Real-Time Synchronized) --- */
let lastFetchedLearners = [];

const WALLPAPER_CARD_GRADIENTS = {
  default_light: 'linear-gradient(135deg, #ffffff 0%, #f0f8f4 100%)',
  default_light_self: 'linear-gradient(135deg, #ffffff 0%, #e3f5ec 100%)',
  default_glass: 'linear-gradient(135deg, rgba(255, 255, 255, 0.92) 0%, rgba(240, 248, 243, 0.9) 100%)',
  default_glass_self: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(228, 245, 236, 0.92) 100%)',
  library: 'linear-gradient(135deg, #4d2813 0%, #361a0a 50%, #1e0d05 100%)', // Rich Oxford warm mahogany brown
  cafe: 'linear-gradient(135deg, #3f271a 0%, #29170d 50%, #160b05 100%)', // Warm roasted coffee mocha
  mountain: 'linear-gradient(135deg, #1b3834 0%, #102522 50%, #071513 100%)', // Mountain pine mist teal slate
  sunset: 'linear-gradient(135deg, #521e2d 0%, #35101d 50%, #1e0710 100%)', // Sunset dusk burgundy rose
  lofi: 'linear-gradient(135deg, #371a4f 0%, #220e33 50%, #11051c 100%)', // Lo-fi twilight neon purple
  zen: 'linear-gradient(135deg, #1e3822 0%, #112315 50%, #061309 100%)', // Zen tranquil bamboo green
  space: 'linear-gradient(135deg, #131a44 0%, #090e29 50%, #030514 100%)' // Space cosmic midnight navy
};

function getWallpaperCardInfo(wallId, isSelf) {
  const isDefault = (!wallId || wallId === 'default');
  const studyEl = document.getElementById("study");
  const hasCustomBg = studyEl ? studyEl.classList.contains("has-custom-bg") : false;

  if (isDefault) {
    if (hasCustomBg) {
      return {
        gradient: isSelf ? WALLPAPER_CARD_GRADIENTS.default_glass_self : WALLPAPER_CARD_GRADIENTS.default_glass,
        isDark: false
      };
    } else {
      return {
        gradient: isSelf ? WALLPAPER_CARD_GRADIENTS.default_light_self : WALLPAPER_CARD_GRADIENTS.default_light,
        isDark: false
      };
    }
  }

  if (WALLPAPER_CARD_GRADIENTS[wallId]) {
    return {
      gradient: WALLPAPER_CARD_GRADIENTS[wallId],
      isDark: true
    };
  }

  // Custom uploaded wallpaper or others
  return {
    gradient: 'linear-gradient(135deg, rgba(26, 32, 44, 0.88) 0%, rgba(15, 19, 28, 0.94) 100%)',
    isDark: true
  };
}

const AURA_STYLES = {
  emerald: { border: 'rgba(16, 185, 129, 0.85)', glow: 'rgba(16, 185, 129, 0.35)', primary: '#10b981' },
  cyan: { border: 'rgba(0, 242, 254, 0.85)', glow: 'rgba(0, 242, 254, 0.35)', primary: '#00f2fe' },
  amber: { border: 'rgba(255, 126, 95, 0.85)', glow: 'rgba(255, 126, 95, 0.35)', primary: '#ff7e5f' },
  purple: { border: 'rgba(181, 23, 158, 0.85)', glow: 'rgba(181, 23, 158, 0.35)', primary: '#b5179e' },
  rose: { border: 'rgba(255, 65, 108, 0.85)', glow: 'rgba(255, 65, 108, 0.35)', primary: '#ff416c' },
  gold: { border: 'rgba(255, 215, 0, 0.9)', glow: 'rgba(245, 159, 0, 0.4)', primary: '#ffd700' },
  aurora: { border: 'rgba(0, 242, 254, 0.9)', glow: 'rgba(0, 242, 254, 0.45)', primary: '#00f2fe' },
  sunset_grad: { border: 'rgba(253, 160, 133, 0.9)', glow: 'rgba(253, 160, 133, 0.45)', primary: '#fda085' },
  cyberpunk: { border: 'rgba(240, 147, 251, 0.9)', glow: 'rgba(240, 147, 251, 0.45)', primary: '#f093fb' },
  cosmic: { border: 'rgba(94, 231, 223, 0.9)', glow: 'rgba(94, 231, 223, 0.45)', primary: '#5ee7df' }
};

function getAuraCardStyle(auraId, isSelf, isDark = true) {
  const a = AURA_STYLES[auraId] || (isSelf ? AURA_STYLES.emerald : null);
  if (!a) {
    return {
      border: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(18, 61, 48, 0.12)',
      glow: isDark ? 'none' : '0 2px 8px rgba(18, 61, 48, 0.04)'
    };
  }
  return {
    border: a.border,
    glow: `0 4px 16px ${a.glow}`
  };
}

function getSelfPresenceData() {
  const curSession = session || (typeof window !== 'undefined' && window.session);
  const myStreak = getUserStudyStreak();
  const goalInput = $("#studyGoalInput");
  const goalText = (studyState.goal && studyState.goal.trim()) ? studyState.goal.trim() : (goalInput ? goalInput.value.trim() : "") || "Nghiên cứu khoa học";
  const userTier = (curSession && curSession.streakTier !== undefined) ? curSession.streakTier : (myStreak >= 50 ? 5 : (myStreak >= 30 ? 4 : (myStreak >= 14 ? 3 : (myStreak >= 7 ? 2 : (myStreak >= 3 ? 1 : 0)))));

  return {
    userId: curSession ? curSession.id : 0,
    name: curSession ? curSession.displayName : "Bạn",
    role: curSession ? curSession.role : "student",
    avatar: curSession ? (curSession.avatar || curSession.initials || (curSession.role === 'admin' ? '🛡️' : (curSession.role === 'ta' ? '🎓' : '🦊'))) : "🦊",
    streak: myStreak,
    streakTier: userTier,
    goal: goalText,
    mode: studyState.mode || 'focus',
    durationMinutes: studyState.durationMinutes || 25,
    remainingSeconds: studyState.remainingSeconds,
    cycleIndex: studyState.cycleIndex || 1,
    isRunning: Boolean(studyState.isRunning),
    wallpaper: studySettings.activeWallpaper || 'default',
    aura: studySettings.activeAura || 'emerald',
    isSelf: true
  };
}

let lastRenderedCoStudySig = "";

function updateSelfCoStudyCard() {
  const selfCard = document.querySelector("#coStudyList .co-study-item.is-self");
  if (!selfCard) return;

  const selfData = getSelfPresenceData();
  let statusText = '';
  let statusIcon = '';
  if (selfData.isRunning) {
    const remainingMin = Math.max(1, Math.ceil((selfData.remainingSeconds || 0) / 60));
    if (selfData.mode === 'shortbreak') {
      statusIcon = '☕';
      statusText = `${remainingMin}m`;
    } else if (selfData.mode === 'longbreak') {
      statusIcon = '🌿';
      statusText = `${remainingMin}m`;
    } else {
      statusIcon = '🔥';
      statusText = `${remainingMin}m`;
    }
  } else {
    if (selfData.remainingSeconds < (selfData.durationMinutes * 60) && selfData.remainingSeconds > 0) {
      statusIcon = '⏸️';
      statusText = 'Tạm dừng';
    } else {
      statusIcon = '✨';
      statusText = 'Sẵn sàng';
    }
  }

  const badgeEl = selfCard.querySelector(".co-study-status-badge");
  const timeEl = selfCard.querySelector(".co-study-time");
  if (badgeEl) {
    badgeEl.className = `co-study-status-badge ${selfData.isRunning ? 'running' : 'idle'}`;
  }
  if (timeEl) {
    const newHtml = `${statusIcon} ${statusText}`;
    if (timeEl.innerHTML !== newHtml) {
      timeEl.innerHTML = newHtml;
    }
  }
}

function renderCoStudyList(rawLearners = [], force = false) {
  let learners = Array.isArray(rawLearners) ? [...rawLearners] : [];
  const curSession = session || (typeof window !== 'undefined' && window.session);
  const myStreak = getUserStudyStreak();

  // Find self if already in list and replace with live local state, or unshift self
  const selfIdx = learners.findIndex(l => l.isSelf || (curSession && l.userId === curSession.id));
  const selfData = getSelfPresenceData();

  if (selfIdx >= 0) {
    learners.splice(selfIdx, 1);
  }
  // Always guarantee self is at the top of the shared study room
  learners.unshift(selfData);

  const activeCount = learners.filter(l => Boolean(l.isRunning)).length;
  const totalCount = learners.length;
  const badge1 = $("#studyLiveCount");
  const badge2 = $("#coStudyCountBadge");
  if (badge1) badge1.textContent = activeCount;
  if (badge2) badge2.textContent = `${totalCount} người trong phòng`;

  const list = $("#coStudyList");
  if (!list) return;

  // Generate a signature of learners data to avoid resetting DOM & CSS animations if unchanged
  const sig = learners.map(l => `${l.userId}_${l.name}_${l.streakTier}_${l.goal}_${l.isRunning}_${l.mode}_${l.wallpaper}_${l.aura}`).join("|");
  if (!force && sig === lastRenderedCoStudySig && list.children.length === learners.length) {
    // If only timer changed for self, do an in-place update without re-creating nodes
    updateSelfCoStudyCard();
    return;
  }
  lastRenderedCoStudySig = sig;

  const canCheer = myStreak >= 3;

  list.innerHTML = learners.map(l => {
    const isSelfClass = l.isSelf ? 'is-self' : '';
    const nameDisplay = l.isSelf ? `${escapeHTML(l.name)} (Bạn)` : escapeHTML(l.name);
    const roleBadge = l.role === 'admin' ? '<span class="lb-role lb-role-admin">Admin</span>' : (l.role === 'ta' ? '<span class="lb-role lb-role-ta">TA</span>' : '');
    
    let statusText = '';
    let statusIcon = '';
    if (l.isRunning) {
      const remainingMin = Math.max(1, Math.ceil((l.remainingSeconds || 0) / 60));
      if (l.mode === 'shortbreak') {
        statusIcon = '☕';
        statusText = `${remainingMin}m`;
      } else if (l.mode === 'longbreak') {
        statusIcon = '🌿';
        statusText = `${remainingMin}m`;
      } else {
        statusIcon = '🔥';
        statusText = `${remainingMin}m`;
      }
    } else {
      if (l.remainingSeconds < (l.durationMinutes * 60) && l.remainingSeconds > 0) {
        statusIcon = '⏸️';
        statusText = 'Tạm dừng';
      } else {
        statusIcon = '✨';
        statusText = 'Sẵn sàng';
      }
    }

    const cardInfo = getWallpaperCardInfo(l.wallpaper, l.isSelf);
    const auraStyle = getAuraCardStyle(l.aura, l.isSelf, cardInfo.isDark);
    const cardThemeClass = cardInfo.isDark ? 'theme-dark-card' : 'theme-light-card';
    const cardInlineStyle = `background: ${cardInfo.gradient}; border: 1.5px solid ${auraStyle.border}; box-shadow: ${auraStyle.glow};`;
    const avatarClass = getAvatarClass(l.streakTier, false, l.role);
    const nameClass = getNameClass(l.streakTier);

    return `
      <div class="co-study-item ${isSelfClass} ${cardThemeClass}" style="${cardInlineStyle}">
        <div class="co-study-header-row">
          <span class="avatar avatar-sm ${avatarClass}">${escapeHTML(l.avatar || '🦊')}</span>
          <div class="co-study-info">
            <div class="co-study-name">
              <span class="co-study-user-title ${nameClass}">${nameDisplay}</span> ${roleBadge}
            </div>
            <div class="co-study-goal">🎯 ${escapeHTML(l.goal || 'Nghiên cứu khoa học')}</div>
          </div>
          <div class="co-study-status-badge ${l.isRunning ? 'running' : 'idle'}">
            <span class="co-study-time">${statusIcon} ${statusText}</span>
          </div>
        </div>
        ${!l.isSelf && curSession ? `
          <div class="co-study-cheers-row">
            <span class="co-study-cheers-label">Gửi cổ vũ:</span>
            <div class="co-study-cheers">
              <button class="cheer-btn ${canCheer ? '' : 'locked'}" title="${canCheer ? 'Vỗ tay tán thưởng' : 'Mở khóa ở chuỗi 3 ngày 🔥'}" onclick="${canCheer ? `sendStudyCheer(${l.userId}, '👏')` : 'notifyCheerLocked()'}">👏</button>
              <button class="cheer-btn ${canCheer ? '' : 'locked'}" title="${canCheer ? 'Mời cà phê tỉnh táo' : 'Mở khóa ở chuỗi 3 ngày 🔥'}" onclick="${canCheer ? `sendStudyCheer(${l.userId}, '☕')` : 'notifyCheerLocked()'}">☕</button>
              <button class="cheer-btn ${canCheer ? '' : 'locked'}" title="${canCheer ? 'Tiếp lửa quyết tâm' : 'Mở khóa ở chuỗi 3 ngày 🔥'}" onclick="${canCheer ? `sendStudyCheer(${l.userId}, '🔥')` : 'notifyCheerLocked()'}">🔥</button>
              <button class="cheer-btn ${canCheer ? '' : 'locked'}" title="${canCheer ? 'Gửi tim yêu thương' : 'Mở khóa ở chuỗi 3 ngày 🔥'}" onclick="${canCheer ? `sendStudyCheer(${l.userId}, '❤️')` : 'notifyCheerLocked()'}">❤️</button>
              <button class="cheer-btn ${canCheer ? '' : 'locked'}" title="${canCheer ? 'Gợi ý ý tưởng sáng tạo' : 'Mở khóa ở chuỗi 3 ngày 🔥'}" onclick="${canCheer ? `sendStudyCheer(${l.userId}, '💡')` : 'notifyCheerLocked()'}">💡</button>
              <button class="cheer-btn ${canCheer ? '' : 'locked'}" title="${canCheer ? 'Tăng tốc về đích' : 'Mở khóa ở chuỗi 3 ngày 🔥'}" onclick="${canCheer ? `sendStudyCheer(${l.userId}, '🚀')` : 'notifyCheerLocked()'}">🚀</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join("");
}

async function fetchStudyLounge() {
  if (!canAccessStudyLounge()) return;
  try {
    const res = await requestAPI("/api/study/lounge");
    if (!res) return;

    lastFetchedLearners = res.learners || [];
    renderCoStudyList(lastFetchedLearners);

    // CROSS-DEVICE REAL-TIME SYNC
    if (res.mySession) {
      const s = res.mySession;
      const now = Date.now();
      if (s.isRunning) {
        const serverRemaining = Math.max(0, Math.floor((s.targetEndMs - now) / 1000));
        if (!studyState.isRunning || Math.abs(studyState.remainingSeconds - serverRemaining) > 2) {
          studyState.mode = s.mode;
          studyState.durationMinutes = s.durationMinutes;
          studyState.remainingSeconds = serverRemaining;
          studyState.targetEndMs = s.targetEndMs;
          studyState.cycleIndex = s.cycleIndex || 1;
          studyState.goal = s.goal || '';

          const goalInput = $("#studyGoalInput");
          if (goalInput && !goalInput.matches(":focus")) {
            goalInput.value = studyState.goal;
          }

          if (!studyState.isRunning) {
            startLocalTimerTick();
          }
          updateTimerDisplay();
        }
      } else {
        if (studyState.isRunning && (now - studyState.lastSyncMs > 5000)) {
          pauseStudyTimer(false);
          studyState.remainingSeconds = s.remainingSeconds;
          updateTimerDisplay();
        }
      }
    }

    if (res.myCheers && res.myCheers.length > 0) {
      res.myCheers.forEach(c => {
        showCheerToast(c);
      });
    }
  } catch (e) {
    console.error("fetchStudyLounge error:", e);
    // Even if offline, still render local presence
    renderCoStudyList(lastFetchedLearners);
  }
}

const seenCheerIds = new Set();

function showCheerToast(c) {
  if (!c || !c.id) return;
  const toastKey = `${c.id}_${c.timestamp || ''}`;
  if (seenCheerIds.has(toastKey)) return;
  seenCheerIds.add(toastKey);
  if (seenCheerIds.size > 200) {
    const firstKey = seenCheerIds.values().next().value;
    seenCheerIds.delete(firstKey);
  }

  const toastId = `cheer-${c.id}`;
  if (document.getElementById(toastId)) return;
  const toastEl = document.createElement("div");
  toastEl.id = toastId;
  toastEl.className = "floating-cheer";
  toastEl.innerHTML = `<span>${c.cheerType}</span> <span><b class="${getNameClass(c.senderStreakTier)}">${escapeHTML(c.senderName)}</b> vừa gửi cổ vũ đến bạn!</span>`;
  document.body.appendChild(toastEl);
  setTimeout(() => {
    if (toastEl.parentElement) toastEl.remove();
  }, 4000);
}

window.notifyCheerLocked = function() {
  toast("🔒 Tính năng Cổ vũ tương tác mở khóa ở Chuỗi 3 ngày (Sinh viên năng động)!");
};

let isSendingStudyCheer = false;

window.sendStudyCheer = async function(recipientId, cheerType) {
  if (!canAccessStudyLounge()) {
    toast(STUDY_MAINTENANCE_MSG);
    return;
  }
  if (!session) {
    openAuth();
    return;
  }
  const userStreak = getUserStudyStreak();
  if (userStreak < 3) {
    toast("🔒 Tính năng Cổ vũ tương tác mở khóa ở Chuỗi 3 ngày (Sinh viên năng động)!");
    return;
  }

  if (isSendingStudyCheer) return;
  isSendingStudyCheer = true;
  setTimeout(() => { isSendingStudyCheer = false; }, 1200);

  try {
    const res = await requestAPI("/api/study/cheer", {
      method: "POST",
      body: JSON.stringify({ recipientId, cheerType })
    });
    if (res && res.success) {
      if (!res.debounced) {
        toast(`Đã gửi ${cheerType} cổ vũ bạn cùng học!`);
      }
    } else if (res && res.error) {
      toast(res.error);
    }
  } catch (e) {
    toast("Không thể gửi cổ vũ.");
  }
};

/* --- 6. DEFAULT AUDIO SOURCES (Streamed via server proxy /api/audio/:trackId.mp3) --- */
const DEFAULT_ENV_AUDIO_SOURCES = {
  env_1: "/api/audio/env_1.mp3",
  env_2: "/api/audio/env_2.mp3",
  env_3: "/api/audio/env_3.mp3",
  env_4: "/api/audio/env_4.mp3"
};

const DEFAULT_MIX_AUDIO_SOURCES = {
  mix_1: "/api/audio/mix_1.mp3",
  mix_2: "/api/audio/mix_2.mp3",
  mix_3: "/api/audio/mix_3.mp3",
  mix_4: "/api/audio/mix_4.mp3",
  mix_5: "/api/audio/mix_5.mp3",
  mix_6: "/api/audio/mix_6.mp3",
  mix_7: "/api/audio/mix_7.mp3",
  mix_8: "/api/audio/mix_8.mp3",
  mix_9: "/api/audio/mix_9.mp3"
};

const DEFAULT_MUSIC_AUDIO_SOURCES = {
  music_1: "/api/audio/music_1.mp3",
  music_2: "/api/audio/music_2.mp3",
  music_3: "/api/audio/music_3.mp3",
  music_4: "/api/audio/music_4.mp3"
};

/* --- 4 ÂM THANH MÔI TRƯỜNG CƠ BẢN (Khoảng 1 tiếng, hỗn hợp sẵn) --- */
const AMBIENT_ENV_TRACKS = [
  { id: 'env_1', name: 'Lửa trại bên bờ suối', sub: 'Ánh lửa ấm bên dòng suối giữa rừng sâu, hòa cùng tiếng nước và âm thanh thiên nhiên tĩnh lặng.', icon: '🪵', reqStreak: 0, defaultVol: 50 },
  { id: 'env_2', name: 'Thanh âm đảo nhiệt đới', sub: 'Tiếng sóng vỗ dịu dàng hòa cùng tiếng chim giữa không gian đảo nhiệt đới thanh bình.', icon: '🏝️', reqStreak: 0, defaultVol: 50 },
  { id: 'env_3', name: 'Góc cà phê', sub: 'Âm thanh quán cà phê nhẹ nhàng hòa cùng tiếng ồn trắng và âm nhạc, tạo không gian thư giãn và tập trung.', icon: '☕', reqStreak: 0, defaultVol: 50 },
  { id: 'env_4', name: 'Bình minh phố thị', sub: 'Thanh âm giao thông buổi sớm hòa cùng nhịp sống khi thành phố dần thức giấc.', icon: '🌅', reqStreak: 0, defaultVol: 50 }
];

/* --- 9 ÂM THANH PHỐI HỢP ĐƠN LẺ (Cho phép mix nhiều âm cùng lúc) --- */
const MIX_SOUND_TRACKS = [
  { id: 'mix_1', soundType: 'stream', name: 'Tiếng nước chảy', sub: 'Dòng nước chảy len lỏi qua những dòng suối', icon: '🌊', reqStreak: 0, defaultVol: 40 },
  { id: 'mix_2', soundType: 'rain', name: 'Tiếng mưa', sub: 'Mưa rơi tí tách trên mái hiên nhà', icon: '🌧️', reqStreak: 0, defaultVol: 40 },
  { id: 'mix_3', soundType: 'windchime', name: 'Tiếng chuông gió', sub: 'Chuông gió ngân vang khe khẽ trong làn gió', icon: '🎐', reqStreak: 0, defaultVol: 30 },
  { id: 'mix_4', soundType: 'birds', name: 'Tiếng chim hót', sub: 'Tiếng chim hót trong trẻo giữa không gian yên bình', icon: '🐦', reqStreak: 0, defaultVol: 35 },
  { id: 'mix_5', soundType: 'leaves', name: 'Tiếng lá xào xạc', sub: 'Tiếng lá xanh xào xạc trên những tán cây', icon: '🍃', reqStreak: 0, defaultVol: 40 },
  { id: 'mix_6', soundType: 'wind', name: 'Tiếng gió thổi', sub: 'Tiếng gió thổi bên ngoài khung cửa sổ', icon: '💨', reqStreak: 0, defaultVol: 35 },
  { id: 'mix_7', soundType: 'crickets', name: 'Tiếng dế kêu', sub: 'Tiếng dế rả rích giữa màn đêm yên tĩnh.', icon: '🦗', reqStreak: 0, defaultVol: 30 },
  { id: 'mix_8', soundType: 'campfire', name: 'Tiếng lửa cháy', sub: 'Tiếng củi cháy tí tách, đều và nhẹ.', icon: '🔥', reqStreak: 0, defaultVol: 35 },
  { id: 'mix_9', soundType: 'waves', name: 'Tiếng sóng biển', sub: 'Tiếng những con sóng nhẹ nhàng vỗ vào bờ.', icon: '🌊', reqStreak: 0, defaultVol: 45 }
];

/* --- 4 BẢN ÂM NHẠC TẬP TRUNG (Phát vòng lặp) --- */
const MUSIC_SOUND_TRACKS = [
  { id: 'music_1', name: 'R&B trầm lắng', sub: 'Playlist những giai điệu R&B hiện đại, trầm lắng và mượt mà, mang theo cảm giác thành phố khi đêm xuống.', icon: '🌃', reqStreak: 0, defaultVol: 45 },
  { id: 'music_2', name: 'Jazz dịu dàng', sub: 'Playlist nhạc jazz Nhật Bản cổ điển, mang sắc trầm ấm và không khí thư thả, không chút vội vàng.', icon: '🎷', reqStreak: 0, defaultVol: 45 },
  { id: 'music_3', name: 'Lofi êm dịu', sub: 'Giai điệu lofi êm dịu giữa rừng thông, mang lại cảm giác ấm áp, bình yên và nhẹ nhõm.', icon: '🌲', reqStreak: 0, defaultVol: 45 },
  { id: 'music_4', name: 'City Pop rực rỡ', sub: 'Giai điệu City Pop hoài niệm đưa bạn về Tokyo thập niên 1990, giữa ánh đèn neon và nhịp sống đêm sôi động.', icon: '🌆', reqStreak: 0, defaultVol: 45 }
];

function getAudioContext() {
  if (!studyState.audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      studyState.audioCtx = new AudioContext();
    }
  }
  if (studyState.audioCtx && studyState.audioCtx.state === 'suspended') {
    studyState.audioCtx.resume();
  }
  return studyState.audioCtx;
}

function fadeAudioIn(player, targetVol, durationMs = 250) {
  if (!player) return;
  const target = Math.max(0, Math.min(1, targetVol));
  player.volume = 0;
  const playPromise = player.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      const steps = 10;
      const stepTime = Math.max(10, Math.floor(durationMs / steps));
      let currentStep = 0;
      const interval = setInterval(() => {
        currentStep++;
        if (player.paused) {
          clearInterval(interval);
          return;
        }
        player.volume = Math.min(target, (currentStep / steps) * target);
        if (currentStep >= steps) {
          clearInterval(interval);
          player.volume = target;
        }
      }, stepTime);
    }).catch(e => {
      if (e.name === "AbortError") return;
      console.warn("Audio play warning:", e);
    });
  }
}

function fadeAudioOut(player, durationMs = 180, onComplete) {
  if (!player || player.paused) {
    if (onComplete) onComplete();
    return;
  }
  const startVol = player.volume;
  const steps = 8;
  const stepTime = Math.max(10, Math.floor(durationMs / steps));
  let currentStep = 0;
  const interval = setInterval(() => {
    currentStep++;
    player.volume = Math.max(0, startVol * (1 - (currentStep / steps)));
    if (currentStep >= steps) {
      clearInterval(interval);
      try {
        player.pause();
        player.currentTime = 0;
      } catch (e) {}
      if (onComplete) onComplete();
    }
  }, stepTime);
}

/* --- 6.1 GIAO DIỆN & PHÁT ÂM THANH MÔI TRƯỜNG (4 Âm thanh hỗn hợp sẵn, loop vô tận) --- */
function renderEnvironmentAudioGrid() {
  const grid = $("#envAudioGrid");
  if (!grid) return;

  const existingCards = grid.querySelectorAll(".ambient-track");
  if (existingCards.length === AMBIENT_ENV_TRACKS.length) {
    updateEnvGridDOM();
    updateMasterAmbientButtonState();
    return;
  }

  grid.innerHTML = AMBIENT_ENV_TRACKS.map(t => {
    const isActive = (studyState.activeEnvTrack === t.id);
    const savedVol = studyState.envVolumes[t.id] ?? t.defaultVol;

    return `
      <div class="ambient-track ${isActive ? 'active' : ''}" id="cardEnv_${t.id}">
        <div class="ambient-track-info">
          <span style="font-size:24px; flex-shrink:0;">${t.icon}</span>
          <div style="flex:1; min-width:0; overflow:hidden;">
            <div class="ambient-name"><strong>${escapeHTML(t.name)}</strong></div>
            <small style="color:var(--muted); font-size:11px; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(t.sub)}</small>
          </div>
          <button type="button" class="ambient-track-toggle button-sm" onclick="toggleEnvTrack('${t.id}')">
            ${isActive ? 'Tắt' : 'Bật'}
          </button>
        </div>
        <div class="ambient-slider-row" style="display:flex; align-items:center; gap:8px;">
          <input type="range" class="ambient-slider" id="volEnv_${t.id}" min="0" max="100" value="${savedVol}" oninput="updateEnvVolume('${t.id}', this.value)" />
        </div>
      </div>
    `;
  }).join("");

  updateMasterAmbientButtonState();
}

function updateEnvGridDOM() {
  AMBIENT_ENV_TRACKS.forEach(t => {
    const card = $(`#cardEnv_${t.id}`);
    if (card) {
      const active = (studyState.activeEnvTrack === t.id);
      card.classList.toggle('active', active);
      const btn = card.querySelector('.ambient-track-toggle');
      if (btn) btn.textContent = active ? 'Tắt' : 'Bật';
    }
  });
}

function toggleEnvTrack(trackId) {
  const streak = getUserStudyStreak();
  if (streak < 3) {
    notifyPerkLocked(3, "Kho âm thanh môi trường cơ bản");
    return;
  }

  const track = AMBIENT_ENV_TRACKS.find(t => t.id === trackId);

  // 1. Nếu track này đang phát -> Tắt
  if (studyState.activeEnvTrack === trackId) {
    stopCurrentEnvAudio();
    updateEnvGridDOM();
    toast(`Đã tắt ${track ? track.name : ''}.`);
    updateMasterAmbientButtonState();
    return;
  }

  // 2. Nếu đang phát track môi trường khác (kể cả custom env) -> Dừng trước khi bật mới
  stopCurrentEnvAudio();

  // Bật track mới với loop vô tận
  const savedVol = studyState.envVolumes[trackId] ?? (track ? track.defaultVol : 50);
  const userVol = savedVol / 100;

  getAudioContext();

  if (DEFAULT_ENV_AUDIO_SOURCES && DEFAULT_ENV_AUDIO_SOURCES[trackId]) {
    let player = studyState.envAudioPlayers[trackId];
    if (!player || player.error) {
      if (player) { try { player.pause(); player.src = ""; } catch (e) {} }
      player = new Audio(DEFAULT_ENV_AUDIO_SOURCES[trackId]);
      player.loop = true;
      player.preload = "auto";
      studyState.envAudioPlayers[trackId] = player;
    }
    fadeAudioIn(player, userVol, 250);
    studyState.activeEnvTrack = trackId;
  }

  updateEnvGridDOM();
  toast(`Đang phát: ${track ? track.name : trackId} (Vòng lặp) 🎧`);
  updateMasterAmbientButtonState();
}

function stopCurrentEnvAudio() {
  if (studyState.activeEnvTrack) {
    const ext = studyState.envAudioPlayers[studyState.activeEnvTrack];
    if (ext) {
      fadeAudioOut(ext, 180);
    }
    studyState.activeEnvTrack = null;
    updateEnvGridDOM();
  }

  if (studyState.activeCustomEnvId) {
    if (studyState.customEnvAudioPlayer) {
      fadeAudioOut(studyState.customEnvAudioPlayer, 180, () => {
        studyState.customEnvAudioPlayer = null;
      });
    }
    const oldCustomId = studyState.activeCustomEnvId;
    studyState.activeCustomEnvId = null;
    updateCustomTrackDOM(oldCustomId, false);
  }
}

function updateEnvVolume(trackId, val) {
  studyState.envVolumes[trackId] = Number(val);
  const userVol = Number(val) / 100;
  const ext = studyState.envAudioPlayers[trackId];
  if (ext) ext.volume = Math.max(0, Math.min(1, userVol));
}

/* --- 6.2 GIAO DIỆN & PHÁT ÂM THANH PHỐI HỢP (9 Âm thanh đơn lẻ, mix cùng lúc, loop vô tận) --- */
function renderMixAudioGrid() {
  const grid = $("#mixAudioGrid");
  if (!grid) return;

  const existingCards = grid.querySelectorAll(".ambient-track");
  if (existingCards.length === MIX_SOUND_TRACKS.length) {
    MIX_SOUND_TRACKS.forEach(t => updateMixGridDOM(t.id));
    updateMasterAmbientButtonState();
    return;
  }

  grid.innerHTML = MIX_SOUND_TRACKS.map(t => {
    const isActive = !!studyState.activeMixSounds[t.id];
    const savedVol = studyState.mixVolumes[t.id] ?? t.defaultVol;

    return `
      <div class="ambient-track ${isActive ? 'active' : ''}" id="cardMix_${t.id}">
        <div class="ambient-track-info">
          <span style="font-size:24px; flex-shrink:0;">${t.icon}</span>
          <div style="flex:1; min-width:0; overflow:hidden;">
            <div class="ambient-name"><strong>${escapeHTML(t.name)}</strong></div>
            <small style="color:var(--muted); font-size:11px; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(t.sub)}</small>
          </div>
          <button type="button" class="ambient-track-toggle button-sm" onclick="toggleMixTrack('${t.id}')">
            ${isActive ? 'Tắt' : 'Bật'}
          </button>
        </div>
        <div class="ambient-slider-row" style="display:flex; align-items:center; gap:8px;">
          <input type="range" class="ambient-slider" id="volMix_${t.id}" min="0" max="100" value="${savedVol}" oninput="updateMixVolume('${t.id}', this.value)" />
        </div>
      </div>
    `;
  }).join("");

  updateMasterAmbientButtonState();
}

function updateMixGridDOM(trackId) {
  const card = $(`#cardMix_${trackId}`);
  if (card) {
    const active = !!studyState.activeMixSounds[trackId];
    card.classList.toggle('active', active);
    const btn = card.querySelector('.ambient-track-toggle');
    if (btn) btn.textContent = active ? 'Tắt' : 'Bật';
  }
}

function toggleMixTrack(trackId) {
  const streak = getUserStudyStreak();
  if (streak < 7) {
    notifyPerkLocked(7, "Toàn bộ âm thanh phối âm cơ bản");
    return;
  }

  const track = MIX_SOUND_TRACKS.find(t => t.id === trackId);
  const isCurrentlyActive = !!studyState.activeMixSounds[trackId];

  if (isCurrentlyActive) {
    // STOP TRACK
    studyState.activeMixSounds[trackId] = false;
    const ext = studyState.mixAudioPlayers[trackId];
    if (ext) {
      fadeAudioOut(ext, 180);
    }
  } else {
    // START TRACK
    studyState.activeMixSounds[trackId] = true;
    const savedVol = studyState.mixVolumes[trackId] ?? (track ? track.defaultVol : 40);
    const userVol = savedVol / 100;

    if (DEFAULT_MIX_AUDIO_SOURCES && DEFAULT_MIX_AUDIO_SOURCES[trackId]) {
      let player = studyState.mixAudioPlayers[trackId];
      if (!player || player.error) {
        if (player) { try { player.pause(); player.src = ""; } catch (e) {} }
        player = new Audio(DEFAULT_MIX_AUDIO_SOURCES[trackId]);
        player.loop = true;
        player.preload = "auto";
        studyState.mixAudioPlayers[trackId] = player;
      }
      fadeAudioIn(player, userVol, 250);
    }
  }

  // Update this specific track card in-place (no innerHTML wipe = zero slider reset & instant response!)
  updateMixGridDOM(trackId);
  updateMasterAmbientButtonState();
}

function updateMixVolume(trackId, val) {
  studyState.mixVolumes[trackId] = Number(val);
  const userVol = Number(val) / 100;
  const ext = studyState.mixAudioPlayers[trackId];
  if (ext) ext.volume = Math.max(0, Math.min(1, userVol));
}

/* --- 6.3 GIAO DIỆN & PHÁT ÂM NHẠC TẬP TRUNG (4 Bản nhạc, loop vô tận) --- */
function renderMusicAudioGrid() {
  const grid = $("#musicAudioGrid");
  if (!grid) return;

  const existingCards = grid.querySelectorAll(".ambient-track");
  if (existingCards.length === MUSIC_SOUND_TRACKS.length) {
    updateMusicGridDOM();
    updateMasterAmbientButtonState();
    return;
  }

  grid.innerHTML = MUSIC_SOUND_TRACKS.map(t => {
    const isActive = (studyState.activeMusicTrack === t.id);
    const savedVol = studyState.musicVolumes[t.id] ?? t.defaultVol;

    return `
      <div class="ambient-track ${isActive ? 'active' : ''}" id="cardMusic_${t.id}">
        <div class="ambient-track-info">
          <span style="font-size:24px; flex-shrink:0;">${t.icon}</span>
          <div style="flex:1; min-width:0; overflow:hidden;">
            <div class="ambient-name"><strong>${escapeHTML(t.name)}</strong></div>
            <small style="color:var(--muted); font-size:11px; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(t.sub)}</small>
          </div>
          <button type="button" class="ambient-track-toggle button-sm" onclick="toggleMusicTrack('${t.id}')">
            ${isActive ? 'Tắt' : 'Bật'}
          </button>
        </div>
        <div class="ambient-slider-row" style="display:flex; align-items:center; gap:8px;">
          <input type="range" class="ambient-slider" id="volMusic_${t.id}" min="0" max="100" value="${savedVol}" oninput="updateMusicVolume('${t.id}', this.value)" />
        </div>
      </div>
    `;
  }).join("");

  updateMasterAmbientButtonState();
}

function updateMusicGridDOM() {
  MUSIC_SOUND_TRACKS.forEach(t => {
    const card = $(`#cardMusic_${t.id}`);
    if (card) {
      const active = (studyState.activeMusicTrack === t.id);
      card.classList.toggle('active', active);
      const btn = card.querySelector('.ambient-track-toggle');
      if (btn) btn.textContent = active ? 'Tắt' : 'Bật';
    }
  });
}

function toggleMusicTrack(trackId) {
  const streak = getUserStudyStreak();
  if (streak < 7) {
    notifyPerkLocked(7, "Kho âm nhạc tập trung");
    return;
  }

  const track = MUSIC_SOUND_TRACKS.find(t => t.id === trackId);

  // 1. Nếu track này đang phát -> Tắt
  if (studyState.activeMusicTrack === trackId) {
    stopCurrentMusicAudio();
    updateMusicGridDOM();
    toast(`Đã tắt ${track ? track.name : ''}.`);
    updateMasterAmbientButtonState();
    return;
  }

  // 2. Dừng track nhạc khác (kể cả custom music) trước khi bật
  stopCurrentMusicAudio();

  const savedVol = studyState.musicVolumes[trackId] ?? (track ? track.defaultVol : 45);
  const userVol = savedVol / 100;

  getAudioContext();

  if (DEFAULT_MUSIC_AUDIO_SOURCES && DEFAULT_MUSIC_AUDIO_SOURCES[trackId]) {
    let player = studyState.musicAudioPlayers[trackId];
    if (!player || player.error) {
      if (player) { try { player.pause(); player.src = ""; } catch (e) {} }
      player = new Audio(DEFAULT_MUSIC_AUDIO_SOURCES[trackId]);
      player.loop = true;
      player.preload = "auto";
      studyState.musicAudioPlayers[trackId] = player;
    }
    fadeAudioIn(player, userVol, 250);
    studyState.activeMusicTrack = trackId;
  }

  updateMusicGridDOM();
  toast(`Đang phát: ${track ? track.name : trackId} (Vòng lặp) 🎵`);
  updateMasterAmbientButtonState();
}

function stopCurrentMusicAudio() {
  if (studyState.activeMusicTrack) {
    const ext = studyState.musicAudioPlayers[studyState.activeMusicTrack];
    if (ext) {
      fadeAudioOut(ext, 180);
    }
    studyState.activeMusicTrack = null;
    updateMusicGridDOM();
  }

  if (studyState.activeCustomMusicId) {
    if (studyState.customMusicAudioPlayer) {
      fadeAudioOut(studyState.customMusicAudioPlayer, 180, () => {
        studyState.customMusicAudioPlayer = null;
      });
    }
    const oldCustomId = studyState.activeCustomMusicId;
    studyState.activeCustomMusicId = null;
    updateCustomTrackDOM(oldCustomId, false);
  }
}

function updateMusicVolume(trackId, val) {
  studyState.musicVolumes[trackId] = Number(val);
  const userVol = Number(val) / 100;
  const ext = studyState.musicAudioPlayers[trackId];
  if (ext) ext.volume = Math.max(0, Math.min(1, userVol));
}

function stopAllStudyAudio() {
  stopCurrentEnvAudio();
  stopCurrentMusicAudio();

  // Stop all active mix sounds
  MIX_SOUND_TRACKS.forEach(t => {
    if (studyState.activeMixSounds[t.id]) {
      const ext = studyState.mixAudioPlayers[t.id];
      if (ext) {
        fadeAudioOut(ext, 180);
      }
      studyState.activeMixSounds[t.id] = false;
      updateMixGridDOM(t.id);
    }
  });

  // Stop all active custom mix sounds
  Object.keys(studyState.activeCustomMixSounds).forEach(id => {
    if (studyState.activeCustomMixSounds[id]) {
      toggleCustomMixAudioPlay(id);
    }
  });

  updateEnvGridDOM();
  updateMusicGridDOM();
  updateMasterAmbientButtonState();
}

function updateMasterAmbientButtonState() {
  const masterBtn = $("#toggleAmbientMaster");
  if (!masterBtn) return;
  const anyActive = (studyState.activeEnvTrack !== null) ||
                    (studyState.activeMusicTrack !== null) ||
                    (studyState.activeCustomEnvId !== null) ||
                    (studyState.activeCustomMusicId !== null) ||
                    Object.values(studyState.activeMixSounds).some(v => v) ||
                    Object.values(studyState.activeCustomMixSounds).some(v => v);

  masterBtn.textContent = anyActive ? "Tắt tất cả" : "Bật tất cả";
}

/* --- 7. ALARM CHIMES (Synthesized Offline Web Audio) --- */
function playAlarmSound(alarmType = "bell") {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (alarmType === "ding") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1567.98, now);
      osc.frequency.exponentialRampToValueAtTime(2093.00, now + 0.05);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.25);
    } else if (alarmType === "servicebell") {
      [0, 0.12].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(2400, now + offset);
        gain.gain.setValueAtTime(0.25, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.5);
      });
    } else if (alarmType === "singingbowl") {
      [216, 220, 650].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);
        const initialGain = idx === 2 ? 0.08 : 0.25;
        gain.gain.setValueAtTime(initialGain, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.8);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 4.0);
      });
    } else if (alarmType === "chime") {
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + (i * 0.18);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.22, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.95);
      });
    } else {
      [587.33, 1174.66, 1761.99].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);
        const initialGain = 0.25 / (i + 1);
        gain.gain.setValueAtTime(initialGain, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 2.1);
      });
    }
  } catch (e) {
    console.warn("Alarm play error:", e);
  }
}

function playChimeSound() {
  playAlarmSound(studySettings.alarmSound || "bell");
}

function previewSelectedAlarm() {
  const sel = $("#settingEndAlarm");
  const val = sel ? sel.value : "bell";
  playAlarmSound(val);
}

/* --- 8. CUSTOM AUDIO UPLOAD, PERSISTENT STORAGE & PLAYBACK --- */
// Persistent Volume Store for Custom Audio
try {
  const savedCustomVols = localStorage.getItem("research_custom_audio_vols");
  if (savedCustomVols) {
    studyState.customVolumes = Object.assign({}, JSON.parse(savedCustomVols), studyState.customVolumes);
  }
} catch (e) {}

function getTrackBlobUrl(track) {
  if (track.objectUrl) return track.objectUrl;
  let blob = null;
  if (track.data) {
    blob = new Blob([track.data], { type: track.type || "audio/mpeg" });
  } else if (track.blob) {
    blob = track.blob;
  }
  if (blob) {
    track.objectUrl = URL.createObjectURL(blob);
    return track.objectUrl;
  }
  return null;
}

function updateCustomTrackDOM(id, isActive) {
  const card = $(`#cardCustom_${id}`);
  if (card) {
    card.classList.toggle('active', isActive);
    const btn = card.querySelector('.ambient-track-toggle');
    if (btn) btn.textContent = isActive ? 'Tắt' : 'Bật';
  }
}

async function loadCustomAudioFromDB() {
  const allTracks = await idbGetAll("custom_audio");
  studyState.customEnvAudioTracks = allTracks.filter(t => t.category === 'env');
  studyState.customMusicAudioTracks = allTracks.filter(t => t.category === 'music');
  studyState.customMixAudioTracks = allTracks.filter(t => t.category === 'mix' || (!t.category && t.category !== 'env' && t.category !== 'music'));

  const streak = getUserStudyStreak();
  const isMaxStreak = streak >= 50;

  // Render Custom Environment Audio List (UI identical to default tracks)
  renderCustomAudioList('env', $("#customEnvAudioList"), studyState.customEnvAudioTracks);

  // Render Custom Mix Audio List (UI identical to default tracks)
  renderCustomAudioList('mix', $("#customMixAudioList"), studyState.customMixAudioTracks);

  // Render Custom Music Audio List (UI identical to default tracks)
  renderCustomAudioList('music', $("#customMusicAudioList"), studyState.customMusicAudioTracks);

  // Update limit badges
  const badgeCustomEnvLimit = $("#badgeCustomEnvLimit");
  const badgeCustomMixLimit = $("#badgeCustomMixLimit");
  const badgeCustomMusicLimit = $("#badgeCustomMusicLimit");
  if (badgeCustomEnvLimit) {
    if (isMaxStreak) {
      badgeCustomEnvLimit.textContent = "✨ Không giới hạn (50d)";
      badgeCustomEnvLimit.classList.add("unlimited");
    } else {
      badgeCustomEnvLimit.textContent = `Tối đa 3 tệp (${studyState.customEnvAudioTracks.length}/3)`;
      badgeCustomEnvLimit.classList.remove("unlimited");
    }
  }
  if (badgeCustomMixLimit) {
    if (isMaxStreak) {
      badgeCustomMixLimit.textContent = "✨ Không giới hạn (50d)";
      badgeCustomMixLimit.classList.add("unlimited");
    } else {
      badgeCustomMixLimit.textContent = `Tối đa 5 tệp (${studyState.customMixAudioTracks.length}/5)`;
      badgeCustomMixLimit.classList.remove("unlimited");
    }
  }
  if (badgeCustomMusicLimit) {
    if (isMaxStreak) {
      badgeCustomMusicLimit.textContent = "✨ Không giới hạn (50d)";
      badgeCustomMusicLimit.classList.add("unlimited");
    } else {
      badgeCustomMusicLimit.textContent = `Tối đa 3 tệp (${studyState.customMusicAudioTracks.length}/3)`;
      badgeCustomMusicLimit.classList.remove("unlimited");
    }
  }

  updateMasterAmbientButtonState();
}

const customAudioListSignatures = {};

function renderCustomAudioList(category, containerEl, tracks) {
  if (!containerEl) return;
  if (!tracks || tracks.length === 0) {
    if (customAudioListSignatures[category] !== "empty") {
      const emptyHints = {
        env: "Chưa có âm thanh môi trường tải lên nào. Bạn có thể tải bài dài yêu thích (mưa, sóng biển, suối...) để phát lặp!",
        mix: "Chưa có âm thanh phối hợp tải lên nào. Bạn có thể tải hiệu ứng âm thanh để mix cùng lúc!",
        music: "Chưa có bản nhạc tải lên nào. Bạn có thể tải các bản nhạc lofi/nhẹ nhàng yêu thích của bạn!"
      };
      containerEl.innerHTML = `<p style="font-size:12px; color:var(--muted); padding:10px 0; margin:0;">${emptyHints[category] || "Chưa có tệp tải lên."}</p>`;
      customAudioListSignatures[category] = "empty";
    }
    return;
  }

  const listSig = tracks.map(t => `${t.id}_${t.name}_${t.size}`).join("|");
  const existingCards = containerEl.querySelectorAll(".custom-track");

  if (customAudioListSignatures[category] === listSig && existingCards.length === tracks.length) {
    tracks.forEach(t => {
      let isActive = false;
      if (category === 'env') isActive = (studyState.activeCustomEnvId === t.id);
      else if (category === 'music') isActive = (studyState.activeCustomMusicId === t.id);
      else isActive = !!studyState.activeCustomMixSounds[t.id];
      updateCustomTrackDOM(t.id, isActive);
    });
    return;
  }

  customAudioListSignatures[category] = listSig;
  const categoryIcons = { env: '🌿', mix: '🎛️', music: '🎵' };
  const icon = categoryIcons[category] || '🎵';

  containerEl.innerHTML = tracks.map(t => {
    let isActive = false;
    if (category === 'env') isActive = (studyState.activeCustomEnvId === t.id);
    else if (category === 'music') isActive = (studyState.activeCustomMusicId === t.id);
    else isActive = !!studyState.activeCustomMixSounds[t.id];

    const sizeMb = (t.size ? (t.size / (1024 * 1024)).toFixed(1) : "0.0");
    const savedVol = studyState.customVolumes[t.id] ?? 50;

    return `
      <div class="ambient-track custom-track ${isActive ? 'active' : ''}" id="cardCustom_${t.id}">
        <div class="ambient-track-info">
          <span style="font-size:24px; flex-shrink:0;">${icon}</span>
          <div style="flex:1; min-width:0; overflow:hidden;">
            <div class="ambient-name"><strong>${escapeHTML(t.name)}</strong></div>
            <small style="color:var(--muted); font-size:11px; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${sizeMb} MB • Âm thanh tải lên • Lưu trên máy
            </small>
          </div>
          <button type="button" class="ambient-track-toggle button-sm" onclick="toggleCustomAudio('${t.id}')">
            ${isActive ? 'Tắt' : 'Bật'}
          </button>
          <button type="button" class="ambient-track-delete" onclick="confirmDeleteCustomAudioTrack('${t.id}')" title="Xóa tệp âm thanh này">
            🗑️
          </button>
        </div>
        <div class="ambient-slider-row" style="display:flex; align-items:center; gap:8px;">
          <input type="range" class="ambient-slider" id="volCustom_${t.id}" min="0" max="100" value="${savedVol}" oninput="updateCustomAudioVolume('${t.id}', this.value)" />
        </div>
      </div>
    `;
  }).join("");
}

window.updateCustomAudioVolume = function(id, val) {
  const numVal = Number(val);
  studyState.customVolumes[id] = numVal;
  try {
    localStorage.setItem("research_custom_audio_vols", JSON.stringify(studyState.customVolumes));
  } catch (e) {}

  const userVol = Math.max(0, Math.min(1, numVal / 100));
  if (studyState.activeCustomEnvId === id && studyState.customEnvAudioPlayer) {
    studyState.customEnvAudioPlayer.volume = userVol;
  }
  if (studyState.activeCustomMusicId === id && studyState.customMusicAudioPlayer) {
    studyState.customMusicAudioPlayer.volume = userVol;
  }
  if (studyState.customMixAudioPlayers[id]) {
    studyState.customMixAudioPlayers[id].volume = userVol;
  }
};

window.toggleCustomAudio = function(id) {
  const allTracks = [
    ...(studyState.customEnvAudioTracks || []),
    ...(studyState.customMixAudioTracks || []),
    ...(studyState.customMusicAudioTracks || [])
  ];
  const track = allTracks.find(t => t.id === id);
  if (!track) return;

  if (track.category === 'env') {
    toggleCustomEnvAudio(track);
  } else if (track.category === 'music') {
    toggleCustomMusicAudio(track);
  } else {
    toggleCustomMixAudio(track);
  }
};

function toggleCustomEnvAudio(track) {
  const id = track.id;
  if (studyState.activeCustomEnvId === id) {
    stopCurrentEnvAudio();
    updateCustomTrackDOM(id, false);
    toast(`Đã tắt ${track.name}.`);
    updateMasterAmbientButtonState();
    return;
  }

  // Dừng track môi trường hiện tại (cả mặc định lẫn custom khác)
  stopCurrentEnvAudio();
  updateEnvGridDOM();

  const audioUrl = getTrackBlobUrl(track);
  if (!audioUrl) {
    toast("Không thể đọc tệp âm thanh môi trường.");
    return;
  }

  let player = studyState.customEnvAudioPlayer;
  if (!player || player.src !== audioUrl || player.error) {
    if (player) { try { player.pause(); } catch(e){} }
    player = new Audio(audioUrl);
    player.loop = true;
    player.preload = "auto";
    studyState.customEnvAudioPlayer = player;
  }

  const savedVol = studyState.customVolumes[id] ?? 50;
  player.volume = Math.max(0, Math.min(1, savedVol / 100));

  const p = player.play();
  if (p !== undefined) {
    p.catch(e => {
      if (e.name === "AbortError") return;
      console.warn("Custom env play error:", e);
      toast("Nhấp vào trang để cho phép phát âm thanh.");
    });
  }

  studyState.activeCustomEnvId = id;
  // Cập nhật DOM các track custom env khác
  (studyState.customEnvAudioTracks || []).forEach(t => {
    updateCustomTrackDOM(t.id, t.id === id);
  });

  toast(`Đang phát: ${track.name} (Vòng lặp) 🌿`);
  updateMasterAmbientButtonState();
}

function toggleCustomMusicAudio(track) {
  const id = track.id;
  if (studyState.activeCustomMusicId === id) {
    stopCurrentMusicAudio();
    updateCustomTrackDOM(id, false);
    toast(`Đã tắt ${track.name}.`);
    updateMasterAmbientButtonState();
    return;
  }

  // Dừng track âm nhạc hiện tại (cả mặc định lẫn custom khác)
  stopCurrentMusicAudio();
  updateMusicGridDOM();

  const audioUrl = getTrackBlobUrl(track);
  if (!audioUrl) {
    toast("Không thể đọc tệp âm nhạc.");
    return;
  }

  let player = studyState.customMusicAudioPlayer;
  if (!player || player.src !== audioUrl || player.error) {
    if (player) { try { player.pause(); } catch(e){} }
    player = new Audio(audioUrl);
    player.loop = true;
    player.preload = "auto";
    studyState.customMusicAudioPlayer = player;
  }

  const savedVol = studyState.customVolumes[id] ?? 50;
  player.volume = Math.max(0, Math.min(1, savedVol / 100));

  const p = player.play();
  if (p !== undefined) {
    p.catch(e => {
      if (e.name === "AbortError") return;
      console.warn("Custom music play error:", e);
      toast("Nhấp vào trang để cho phép phát âm thanh.");
    });
  }

  studyState.activeCustomMusicId = id;
  // Cập nhật DOM các track custom music khác
  (studyState.customMusicAudioTracks || []).forEach(t => {
    updateCustomTrackDOM(t.id, t.id === id);
  });

  toast(`Đang phát: ${track.name} (Vòng lặp) 🎵`);
  updateMasterAmbientButtonState();
}

function toggleCustomMixAudio(track) {
  const id = track.id;
  const isPlaying = !!studyState.activeCustomMixSounds[id];

  if (isPlaying) {
    const p = studyState.customMixAudioPlayers[id];
    if (p) {
      try {
        p.pause();
        p.currentTime = 0;
      } catch (e) {}
    }
    studyState.activeCustomMixSounds[id] = false;
    updateCustomTrackDOM(id, false);
    toast(`Đã tắt ${track.name}.`);
    updateMasterAmbientButtonState();
    return;
  }

  const audioUrl = getTrackBlobUrl(track);
  if (!audioUrl) {
    toast("Không thể đọc tệp âm thanh phối hợp.");
    return;
  }

  let player = studyState.customMixAudioPlayers[id];
  if (!player || player.src !== audioUrl || player.error) {
    if (player) { try { player.pause(); } catch(e){} }
    player = new Audio(audioUrl);
    player.loop = true;
    player.preload = "auto";
    studyState.customMixAudioPlayers[id] = player;
  }

  const savedVol = studyState.customVolumes[id] ?? 50;
  player.volume = Math.max(0, Math.min(1, savedVol / 100));

  const p = player.play();
  if (p !== undefined) {
    p.catch(e => {
      if (e.name === "AbortError") return;
      console.warn("Custom mix play error:", e);
      toast("Nhấp vào trang để cho phép phát âm thanh.");
    });
  }

  studyState.activeCustomMixSounds[id] = true;
  updateCustomTrackDOM(id, true);
  toast(`Đang mix: ${track.name} 🎛️`);
  updateMasterAmbientButtonState();
}

window.confirmDeleteCustomAudioTrack = async function(id) {
  const allTracks = [
    ...(studyState.customEnvAudioTracks || []),
    ...(studyState.customMixAudioTracks || []),
    ...(studyState.customMusicAudioTracks || [])
  ];
  const track = allTracks.find(t => t.id === id);
  const trackName = track ? `"${track.name}"` : "tệp âm thanh này";

  const ok = window.confirm(`Bạn có chắc chắn muốn xóa ${trackName} không? Tệp âm thanh đã lưu trên máy sẽ bị xóa vĩnh viễn.`);
  if (!ok) return;

  // 1. Dừng phát nếu đang chạy
  if (studyState.activeCustomEnvId === id) {
    stopCurrentEnvAudio();
  }
  if (studyState.activeCustomMusicId === id) {
    stopCurrentMusicAudio();
  }
  if (studyState.activeCustomMixSounds[id]) {
    const p = studyState.customMixAudioPlayers[id];
    if (p) {
      try { p.pause(); p.currentTime = 0; } catch (e) {}
      delete studyState.customMixAudioPlayers[id];
    }
    studyState.activeCustomMixSounds[id] = false;
  }

  // 2. Thu hồi object URL nếu có
  if (track && track.objectUrl) {
    try { URL.revokeObjectURL(track.objectUrl); } catch (e) {}
  }

  // 3. Xóa trong IndexedDB
  await idbDelete("custom_audio", id);

  toast(`Đã xóa ${trackName}.`);
  await loadCustomAudioFromDB();
};

window.triggerUploadEnvAudio = function() {
  const streak = getUserStudyStreak();
  if (streak < 30) {
    notifyPerkLocked(30, "Tính năng tải âm thanh tùy biến");
    return;
  }
  const input = $("#customEnvAudioInput");
  if (input) input.click();
};

window.triggerUploadMixAudio = function() {
  const streak = getUserStudyStreak();
  if (streak < 30) {
    notifyPerkLocked(30, "Tính năng tải âm thanh tùy biến");
    return;
  }
  const input = $("#customMixAudioInput");
  if (input) input.click();
};

window.triggerUploadMusicAudio = function() {
  const streak = getUserStudyStreak();
  if (streak < 30) {
    notifyPerkLocked(30, "Tính năng tải âm thanh tùy biến");
    return;
  }
  const input = $("#customMusicAudioInput");
  if (input) input.click();
};

async function handleCustomAudioUpload(file, category) {
  if (!file) return;

  const streak = getUserStudyStreak();
  if (streak < 30) {
    notifyPerkLocked(30, "Tính năng tải âm thanh tùy biến");
    return;
  }

  const isMaxStreak = streak >= 50;

  if (!isMaxStreak && file.size > 50 * 1024 * 1024) {
    toast("Tệp âm thanh quá lớn (tối đa 50MB cho mỗi tệp).");
    return;
  }

  const allTracks = await idbGetAll("custom_audio");
  const countInCategory = allTracks.filter(t => t.category === category).length;
  // Giới hạn: tối đa 3 âm thanh môi trường, 3 âm nhạc và 5 âm thanh phối âm
  const maxAllowed = (category === 'mix' ? 5 : 3);
  if (!isMaxStreak && countInCategory >= maxAllowed) {
    const catName = category === 'env' ? 'âm thanh môi trường' : (category === 'mix' ? 'âm thanh phối hợp' : 'bản nhạc');
    toast(`Bạn đã tải tối đa ${maxAllowed} ${catName}. Đạt Chuỗi 50 ngày để mở khóa tải không giới hạn!`);
    return;
  }

  toast(`Đang xử lý và lưu "${file.name}"...`);

  try {
    const arrayBuffer = await file.arrayBuffer();
    const trackItem = {
      id: `custom_${category}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      category: category,
      name: file.name,
      size: file.size,
      type: file.type || "audio/mpeg",
      data: arrayBuffer,
      createdAt: Date.now()
    };

    const ok = await idbPut("custom_audio", trackItem);
    if (ok) {
      toast(`✨ Đã lưu tệp "${file.name}" vào bộ nhớ máy (lưu trữ cục bộ cho đến khi bạn xóa)!`);
      await loadCustomAudioFromDB();
    } else {
      toast("Lỗi: Không thể lưu tệp âm thanh vào bộ nhớ trình duyệt.");
    }
  } catch (err) {
    console.error("Custom audio upload error:", err);
    toast("Không thể đọc tệp âm thanh: " + (err.message || "vui lòng thử lại"));
  }
}

window.handleCustomEnvAudioUpload = (file) => handleCustomAudioUpload(file, 'env');
window.handleCustomMixAudioUpload = (file) => handleCustomAudioUpload(file, 'mix');
window.handleCustomMusicAudioUpload = (file) => handleCustomAudioUpload(file, 'music');

/* --- 9. WALLPAPER PRESETS, CLOCK COLOR & EXCLUSIVE COLOR GRADIENTS --- */
const WALLPAPER_PRESETS = [
  { id: 'default', name: 'Mặc định RE:SEARCH', type: 'gradient', src: '', style: 'linear-gradient(135deg, rgba(20,24,22,0.95), rgba(12,16,14,0.98))' },
  { id: 'library', name: 'Thư viện cổ Oxford', type: 'image', src: '/public/assets/wallpapers/library.jpg', style: 'url(/public/assets/wallpapers/library.jpg)' },
  { id: 'cafe', name: 'Góc Cafe ấm áp', type: 'image', src: '/public/assets/wallpapers/cafe.jpg', style: 'url(/public/assets/wallpapers/cafe.jpg)' },
  { id: 'mountain', name: 'Sương mù trên núi', type: 'image', src: '/public/assets/wallpapers/mountain.jpg', style: 'url(/public/assets/wallpapers/mountain.jpg)' },
  { id: 'sunset', name: 'Hoàng hôn giảng đường', type: 'image', src: '/public/assets/wallpapers/sunset.jpg', style: 'url(/public/assets/wallpapers/sunset.jpg)' },
  { id: 'lofi', name: 'Góc học Lo-fi Chill', type: 'image', src: '/public/assets/wallpapers/lofi.jpg', style: 'url(/public/assets/wallpapers/lofi.jpg)' },
  { id: 'zen', name: 'Không gian Thiền (Zen)', type: 'image', src: '/public/assets/wallpapers/zen.jpg', style: 'url(/public/assets/wallpapers/zen.jpg)' },
  { id: 'space', name: 'Vũ trụ & Ngàn sao', type: 'image', src: '/public/assets/wallpapers/space.jpg', style: 'url(/public/assets/wallpapers/space.jpg)' }
];

function renderWallpaperPresets() {
  const cont = $("#wallpaperPresetsList");
  if (!cont) return;
  const streak = getUserStudyStreak();

  const existingCards = cont.querySelectorAll(".preset-thumb-card");
  if (existingCards.length === WALLPAPER_PRESETS.length) {
    existingCards.forEach((card, idx) => {
      const p = WALLPAPER_PRESETS[idx];
      if (!p) return;
      const isSelected = studySettings.activeWallpaper === p.id;
      const isUnlocked = (p.id === 'default' || streak >= 14);
      const clickAction = isUnlocked
        ? `applyStudyWallpaperPreset('${p.id}')`
        : `notifyPerkLocked(14, 'Kho hình nền cơ bản')`;

      card.classList.toggle("selected", isSelected);
      card.classList.toggle("locked", !isUnlocked);
      card.setAttribute("onclick", clickAction);
      card.title = `${p.name}${!isUnlocked ? ' (Mở khóa ở Chuỗi 14 ngày)' : ''}`;

      let indicator = card.querySelector(".preset-active-indicator");
      if (isSelected && !indicator) {
        card.insertAdjacentHTML("beforeend", '<span class="preset-active-indicator">✓</span>');
      } else if (!isSelected && indicator) {
        indicator.remove();
      }
    });
    return;
  }

  cont.innerHTML = WALLPAPER_PRESETS.map(p => {
    const isSelected = studySettings.activeWallpaper === p.id;
    const isUnlocked = (p.id === 'default' || streak >= 14);
    const thumbStyle = (p.type === 'image' && p.src)
      ? `background-image: url('${p.src}'); background-size: cover; background-position: center;`
      : `background: ${p.style};`;
    const clickAction = isUnlocked
      ? `applyStudyWallpaperPreset('${p.id}')`
      : `notifyPerkLocked(14, 'Kho hình nền cơ bản')`;

    return `
      <div class="preset-thumb-card ${isSelected ? 'selected' : ''} ${!isUnlocked ? 'locked' : ''}" data-preset-id="${p.id}" onclick="${clickAction}" title="${escapeHTML(p.name)}${!isUnlocked ? ' (Mở khóa ở Chuỗi 14 ngày)' : ''}">
        <div class="preset-thumb-color" style="${thumbStyle}"></div>
        <span class="preset-thumb-name">${escapeHTML(p.name)}</span>
        ${isSelected ? '<span class="preset-active-indicator">✓</span>' : ''}
      </div>
    `;
  }).join("");
}

function applyStudyWallpaperPreset(presetId) {
  const streak = getUserStudyStreak();
  if (presetId !== 'default' && streak < 14) {
    notifyPerkLocked(14, "Kho hình nền cơ bản");
    return;
  }

  const p = WALLPAPER_PRESETS.find(x => x.id === presetId);
  if (!p) return;
  studySettings.activeWallpaper = presetId;
  saveStudySettings(false);

  const studyEl = $("#study");
  const bgLayer = $("#studyBackgroundLayer");
  if (presetId === 'default') {
    if (studyEl) studyEl.classList.remove("has-custom-bg");
    if (bgLayer) bgLayer.style.backgroundImage = "";
  } else {
    if (studyEl) studyEl.classList.add("has-custom-bg");
    if (bgLayer) {
      bgLayer.style.backgroundImage = p.style;
      bgLayer.style.backgroundSize = "cover";
      bgLayer.style.backgroundPosition = "center";
      bgLayer.style.backgroundRepeat = "no-repeat";
    }
  }
  const nameEl = $("#customWallName");
  if (nameEl && !studySettings.activeWallpaper.startsWith("custom_")) {
    nameEl.textContent = "Chưa chọn ảnh";
  }
  renderWallpaperPresets();
  renderCustomWallpapersList();
  applyWallpaperDim(studySettings.wallpaperDim);
  applyCardGlass(studySettings.cardGlassOpacity);
  syncStudyToServer();
  if (typeof renderCoStudyList === 'function') {
    renderCoStudyList(lastFetchedLearners);
  }
  toast(`Đã chọn hình nền: ${p.name}`);
}

/* --- CLOCK COLOR CUSTOMIZATION (Streak >= 14) --- */
const CLOCK_COLORS = [
  { id: 'default', name: 'Trắng nguyên bản', color: '#ffffff' },
  { id: 'emerald', name: 'Ngọc Lục Bảo', color: '#10b981' },
  { id: 'sky', name: 'Xanh Thanh Thiên', color: '#38bdf8' },
  { id: 'amber', name: 'Hổ Phách Ấm', color: '#f59e0b' },
  { id: 'purple', name: 'Tím Thạch Anh', color: '#a855f7' },
  { id: 'rose', name: 'Hồng San Hô', color: '#f43f5e' }
];

function renderClockColorPicker() {
  const cont = $("#clockColorPicker");
  if (!cont) return;
  const streak = getUserStudyStreak();

  const existingSwatches = cont.querySelectorAll(".clock-color-swatch");
  if (existingSwatches.length === CLOCK_COLORS.length) {
    existingSwatches.forEach((btn, idx) => {
      const c = CLOCK_COLORS[idx];
      if (!c) return;
      const isSelected = (studySettings.clockColor || 'default') === c.id;
      const isUnlocked = (c.id === 'default' || streak >= 14);
      btn.classList.toggle("active", isSelected);
      btn.classList.toggle("locked", !isUnlocked);
      const clickAction = isUnlocked
        ? `applyClockColor('${c.id}')`
        : `notifyPerkLocked(14, 'Tinh chỉnh màu sắc đồng hồ số')`;
      btn.setAttribute("onclick", clickAction);
    });
    return;
  }

  cont.innerHTML = CLOCK_COLORS.map(c => {
    const isSelected = (studySettings.clockColor || 'default') === c.id;
    const isUnlocked = (c.id === 'default' || streak >= 14);
    const clickAction = isUnlocked
      ? `applyClockColor('${c.id}')`
      : `notifyPerkLocked(14, 'Tinh chỉnh màu sắc đồng hồ số')`;

    return `
      <button type="button" class="clock-color-swatch ${isSelected ? 'active' : ''} ${!isUnlocked ? 'locked' : ''}" style="background:${c.color};" title="${escapeHTML(c.name)}${!isUnlocked ? ' (Mở khóa ở Chuỗi 14 ngày)' : ''}" onclick="${clickAction}"></button>
    `;
  }).join("");
}

function applyClockColor(colorId) {
  const c = CLOCK_COLORS.find(x => x.id === colorId);
  if (!c) return;
  const streak = getUserStudyStreak();
  if (c.id !== 'default' && streak < 14) {
    notifyPerkLocked(14, "Tinh chỉnh màu sắc đồng hồ số");
    return;
  }

  studySettings.clockColor = colorId;
  saveStudySettings(false);

  const clock = $("#timerClock");
  if (clock) {
    clock.style.color = (c.id === 'default' ? '' : c.color);
  }
  renderClockColorPicker();
  toast(`Đã đổi màu số đồng hồ: ${c.name}`);
}

async function triggerWallpaperUpload() {
  const streak = getUserStudyStreak();
  if (streak < 50) {
    notifyPerkLocked(50, "Tải ảnh nền cá nhân");
    return;
  }
  const input = $("#customWallInput");
  if (input) input.click();
}

async function handleCustomWallpaperUpload(file) {
  if (!file) return;
  const streak = getUserStudyStreak();
  if (streak < 50) {
    notifyPerkLocked(50, "Tải ảnh nền cá nhân");
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    const item = {
      id: `wall_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: file.name,
      dataUrl,
      size: file.size,
      createdAt: Date.now()
    };
    await idbPut("custom_wallpapers", item);

    studySettings.activeWallpaper = `custom_${item.id}`;
    saveStudySettings(false);

    const studyEl = $("#study");
    if (studyEl) studyEl.classList.add("has-custom-bg");

    const bgLayer = $("#studyBackgroundLayer");
    if (bgLayer) {
      bgLayer.style.backgroundImage = `url(${dataUrl})`;
      bgLayer.style.backgroundSize = "cover";
      bgLayer.style.backgroundPosition = "center";
    }
    const nameEl = $("#customWallName");
    if (nameEl) nameEl.textContent = file.name;

    renderWallpaperPresets();
    await renderCustomWallpapersList();
    toast(`✨ [Chuỗi 50 ngày] Đã áp dụng ảnh nền cá nhân: ${file.name}`);
  };
  reader.readAsDataURL(file);
}

let lastRenderedCustomWallpapersSig = "";

async function renderCustomWallpapersList() {
  const cont = $("#customWallpapersList");
  if (!cont) return;
  const streak = getUserStudyStreak();
  const unlocked = streak >= 50;

  const walls = (await idbGetAll("custom_wallpapers")) || [];

  const badgeLimit = $("#badgeCustomWallLimit");
  if (badgeLimit) {
    if (unlocked) {
      badgeLimit.textContent = `✨ Không giới hạn (${walls.length})`;
      badgeLimit.classList.add("unlimited");
    } else {
      badgeLimit.textContent = `Mở khóa ở Chuỗi 50 ngày`;
      badgeLimit.classList.remove("unlimited");
    }
  }

  if (walls.length === 0) {
    if (lastRenderedCustomWallpapersSig !== "empty") {
      cont.innerHTML = `<p style="font-size:12px; color:var(--muted); padding:6px 0; margin:0; grid-column: 1 / -1;">Chưa có ảnh nền cá nhân nào. Hãy tải lên ảnh yêu thích của bạn!</p>`;
      lastRenderedCustomWallpapersSig = "empty";
    }
    return;
  }

  const listSig = walls.map(w => `${w.id}_${w.name}_${w.size}`).join("|") + `_unlocked:${unlocked}`;
  const existingCards = cont.querySelectorAll(".custom-wallpaper-card");

  if (lastRenderedCustomWallpapersSig === listSig && existingCards.length === walls.length) {
    existingCards.forEach((card, idx) => {
      const w = walls[idx];
      if (!w) return;
      const isSelected = studySettings.activeWallpaper === `custom_${w.id}`;
      card.classList.toggle("selected", isSelected);
      card.classList.toggle("locked", !unlocked);

      const preview = card.querySelector(".custom-wallpaper-preview");
      if (preview) {
        let tag = preview.querySelector(".custom-wall-active-tag");
        if (isSelected && !tag) {
          preview.insertAdjacentHTML("afterbegin", '<span class="custom-wall-active-tag">Đang dùng</span>');
        } else if (!isSelected && tag) {
          tag.remove();
        }
      }
    });
    return;
  }

  lastRenderedCustomWallpapersSig = listSig;
  cont.innerHTML = walls.map(w => {
    const isSelected = studySettings.activeWallpaper === `custom_${w.id}`;
    const sizeMb = (w.size ? (w.size / (1024 * 1024)).toFixed(1) : "0.0");
    const clickAction = unlocked
      ? `applyCustomWallpaper('${w.id}')`
      : `notifyPerkLocked(50, 'Tải ảnh nền cá nhân')`;

    return `
      <div class="custom-wallpaper-card ${isSelected ? 'selected' : ''} ${!unlocked ? 'locked' : ''}" onclick="${clickAction}">
        <div class="custom-wallpaper-preview" style="background-image: url(${w.dataUrl});">
          ${isSelected ? '<span class="custom-wall-active-tag">Đang dùng</span>' : ''}
          <button type="button" class="custom-wall-del-btn" title="Xoá ảnh này" onclick="event.stopPropagation(); confirmDeleteCustomWallpaper('${w.id}')">✕</button>
        </div>
        <div class="custom-wallpaper-meta">
          <span class="custom-wallpaper-name" title="${escapeHTML(w.name)}">${escapeHTML(w.name)}</span>
          <span class="custom-wallpaper-size">${sizeMb} MB</span>
        </div>
      </div>
    `;
  }).join("");
}

async function applyCustomWallpaper(wallId) {
  const streak = getUserStudyStreak();
  if (streak < 50) {
    notifyPerkLocked(50, "Tải ảnh nền cá nhân");
    return;
  }

  const walls = await idbGetAll("custom_wallpapers");
  const target = walls.find(w => w.id === wallId);
  if (!target) return;

  studySettings.activeWallpaper = `custom_${target.id}`;
  saveStudySettings(false);

  const studyEl = $("#study");
  if (studyEl) studyEl.classList.add("has-custom-bg");

  const bgLayer = $("#studyBackgroundLayer");
  if (bgLayer) {
    bgLayer.style.backgroundImage = `url(${target.dataUrl})`;
    bgLayer.style.backgroundSize = "cover";
    bgLayer.style.backgroundPosition = "center";
  }
  const nameEl = $("#customWallName");
  if (nameEl) nameEl.textContent = target.name;

  renderWallpaperPresets();
  renderCustomWallpapersList();
  syncStudyToServer();
  if (typeof renderCoStudyList === 'function') {
    renderCoStudyList(lastFetchedLearners);
  }
  toast(`Đã áp dụng ảnh nền: ${target.name}`);
}

async function confirmDeleteCustomWallpaper(wallId) {
  const walls = await idbGetAll("custom_wallpapers");
  const target = walls.find(w => w.id === wallId);
  const name = target?.name || "ảnh nền";
  if (!confirm(`Bạn có chắc muốn xoá "${name}" khỏi bộ nhớ máy?`)) return;

  await idbDelete("custom_wallpapers", wallId);
  toast(`Đã xoá ảnh nền: ${name}`);

  if (studySettings.activeWallpaper === `custom_${wallId}`) {
    applyStudyWallpaperPreset('default');
  } else {
    await renderCustomWallpapersList();
  }
}

function handleWallpaperDimChange(val) {
  val = Math.max(0, Math.min(80, Number(val) || 35));
  studySettings.wallpaperDim = val;
  saveStudySettings(false);
  applyWallpaperDim(val);
}

function applyWallpaperDim(val) {
  const dim = (typeof val !== 'undefined' ? val : (studySettings.wallpaperDim ?? 35));
  const valEl = $("#wallpaperDimVal");
  if (valEl) valEl.textContent = `${dim}%`;
  const sliderEl = $("#wallpaperDimSlider");
  if (sliderEl && sliderEl.value != dim) sliderEl.value = dim;

  const studyEl = $("#study");
  if (studyEl) {
    const opacity = (dim / 100).toFixed(2);
    studyEl.style.setProperty("--study-overlay-opacity", opacity);
  }
}

function handleCardGlassChange(val) {
  val = Math.max(15, Math.min(90, Number(val) || 50));
  studySettings.cardGlassOpacity = val;
  saveStudySettings(false);
  applyCardGlass(val);
}

function applyCardGlass(val) {
  const op = (typeof val !== 'undefined' ? val : (studySettings.cardGlassOpacity ?? 50));
  const valEl = $("#studyCardGlassVal");
  if (valEl) valEl.textContent = `${op}%`;
  const sliderEl = $("#studyCardGlassSlider");
  if (sliderEl && sliderEl.value != op) sliderEl.value = op;

  const studyEl = $("#study");
  if (studyEl) {
    const opacity = (op / 100).toFixed(2);
    studyEl.style.setProperty("--study-card-opacity", opacity);
  }
}

function toggleStudyZenView() {
  const study = $("#study");
  if (!study) return;
  const isZen = study.classList.toggle("study-zen-view");
  const icon = $("#studyZenIcon");
  const text = $("#studyZenText");
  const btn = $("#studyZenToggleBtn");
  if (isZen) {
    if (icon) icon.textContent = "📊";
    if (text) text.textContent = "Đầy đủ";
    if (btn) btn.classList.add("active");
    toast("✨ Đã bật chế độ tối giản");
  } else {
    if (icon) icon.textContent = "🖼️";
    if (text) text.textContent = "Tối giản";
    if (btn) btn.classList.remove("active");
    toast("Đã mở lại toàn bộ bảng điều khiển.");
  }
}

/* --- HÀO QUANG & MÀU SẮC GRADIENT ĐỘC QUYỀN (Streak >= 30: 5 đầu; Streak >= 50: cả 10) --- */
const COLOR_AURAS = [
  { 
    id: 'emerald', 
    name: 'Ngọc Lục Bảo Tinh Hoa', 
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #34d399 100%)', 
    primary: '#10b981', 
    glow: 'rgba(16, 185, 129, 0.45)',
    stops: ['#10b981', '#34d399']
  },
  { 
    id: 'cyan', 
    name: 'Lam Băng Sương Mai', 
    gradient: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 50%, #00c6fb 100%)', 
    primary: '#00f2fe', 
    glow: 'rgba(0, 242, 254, 0.45)',
    stops: ['#00f2fe', '#4facfe']
  },
  { 
    id: 'amber', 
    name: 'Hỏa Diệm Hoàng Hôn', 
    gradient: 'linear-gradient(135deg, #ff7e5f 0%, #feb47b 50%, #ff5e62 100%)', 
    primary: '#ff7e5f', 
    glow: 'rgba(255, 126, 95, 0.45)',
    stops: ['#ff7e5f', '#feb47b']
  },
  { 
    id: 'purple', 
    name: 'Tím Hoàng Gia Huyền Bí', 
    gradient: 'linear-gradient(135deg, #7048e8 0%, #b5179e 50%, #da77f2 100%)', 
    primary: '#b5179e', 
    glow: 'rgba(181, 23, 158, 0.45)',
    stops: ['#7048e8', '#da77f2']
  },
  { 
    id: 'rose', 
    name: 'Thạch Anh Hồng Ngọc', 
    gradient: 'linear-gradient(135deg, #ff416c 0%, #ff4b2b 50%, #ff758c 100%)', 
    primary: '#ff416c', 
    glow: 'rgba(255, 65, 108, 0.45)',
    stops: ['#ff416c', '#ff758c']
  },
  { 
    id: 'gold', 
    name: 'Hoàng Gia Vàng Kim', 
    gradient: 'linear-gradient(135deg, #f59f00 0%, #ffd700 50%, #f08c00 100%)', 
    primary: '#f59f00', 
    glow: 'rgba(245, 159, 0, 0.45)',
    stops: ['#f59f00', '#ffd700']
  },
  { 
    id: 'aurora', 
    name: 'Cực Quang Cửu Thiên', 
    gradient: 'linear-gradient(135deg, #00f2fe 0%, #38ef7d 50%, #11998e 100%)', 
    primary: '#00f2fe', 
    glow: 'rgba(0, 242, 254, 0.5)',
    stops: ['#00f2fe', '#38ef7d']
  },
  { 
    id: 'sunset_grad', 
    name: 'Hoàng Kim Sang Trọng', 
    gradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 50%, #ff6b6b 100%)', 
    primary: '#fda085', 
    glow: 'rgba(253, 160, 133, 0.5)',
    stops: ['#f6d365', '#ff6b6b']
  },
  { 
    id: 'cyberpunk', 
    name: 'Tím Cyberpunk Neon', 
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 50%, #4facfe 100%)', 
    primary: '#f093fb', 
    glow: 'rgba(240, 147, 251, 0.5)',
    stops: ['#f093fb', '#4facfe']
  },
  { 
    id: 'cosmic', 
    name: 'Vũ Trụ Vô Tận', 
    gradient: 'linear-gradient(135deg, #5ee7df 0%, #b490ca 50%, #667eea 100%)', 
    primary: '#5ee7df', 
    glow: 'rgba(94, 231, 223, 0.5)',
    stops: ['#5ee7df', '#667eea']
  }
];

function renderColorPalette() {
  const cont = $("#colorPalettePicker");
  if (!cont) return;
  const streak = getUserStudyStreak();

  const existingSwatches = cont.querySelectorAll(".color-swatch");
  if (existingSwatches.length === COLOR_AURAS.length) {
    existingSwatches.forEach((btn, idx) => {
      const c = COLOR_AURAS[idx];
      if (!c) return;
      const isSelected = (studySettings.activeAura === c.id);
      let isUnlocked = true;
      let reqDays = 0;
      if (idx >= 1 && idx <= 4) {
        isUnlocked = streak >= 30;
        reqDays = 30;
      } else if (idx >= 5) {
        isUnlocked = streak >= 50;
        reqDays = 50;
      }

      btn.classList.toggle("active", isSelected);
      btn.classList.toggle("locked", !isUnlocked);
      const clickAction = isUnlocked
        ? `applyColorAura('${c.id}')`
        : `notifyPerkLocked(${reqDays}, 'Phối màu ${escapeHTML(c.name)}')`;
      btn.setAttribute("onclick", clickAction);
    });
    return;
  }

  cont.innerHTML = COLOR_AURAS.map((c, idx) => {
    const isSelected = (studySettings.activeAura === c.id);
    let isUnlocked = true;
    let reqDays = 0;
    if (idx >= 1 && idx <= 4) {
      isUnlocked = streak >= 30;
      reqDays = 30;
    } else if (idx >= 5) {
      isUnlocked = streak >= 50;
      reqDays = 50;
    }

    const clickAction = isUnlocked
      ? `applyColorAura('${c.id}')`
      : `notifyPerkLocked(${reqDays}, 'Phối màu ${escapeHTML(c.name)}')`;

    return `
      <button type="button" class="color-swatch ${isSelected ? 'active' : ''} ${!isUnlocked ? 'locked' : ''}" style="background:${c.gradient};" title="${escapeHTML(c.name)}${!isUnlocked ? ` (Mở khóa ở Chuỗi ${reqDays} ngày)` : ''}" onclick="${clickAction}"></button>
    `;
  }).join("");
}

function applyColorAura(auraId) {
  const idx = COLOR_AURAS.findIndex(x => x.id === auraId);
  const c = idx !== -1 ? COLOR_AURAS[idx] : COLOR_AURAS[0];
  const streak = getUserStudyStreak();

  if (idx >= 1 && idx <= 4 && streak < 30) {
    notifyPerkLocked(30, `Phối màu ${c.name}`);
    return;
  }
  if (idx >= 5 && streak < 50) {
    notifyPerkLocked(50, `Phối màu ${c.name}`);
    return;
  }

  studySettings.activeAura = c.id;
  saveStudySettings(false);

  const studyEl = $("#study");
  if (studyEl) {
    studyEl.style.setProperty("--primary", c.primary);
    studyEl.style.setProperty("--primary-gradient", c.gradient);
    studyEl.style.setProperty("--primary-glow", c.glow);
  }
  const stop1 = $("#timerGradStop1");
  const stop2 = $("#timerGradStop2");
  if (stop1 && stop2) {
    stop1.setAttribute("stop-color", c.stops[0]);
    stop2.setAttribute("stop-color", c.stops[1]);
  }
  const progCircle = $("#timerProgressCircle");
  if (progCircle) {
    progCircle.style.stroke = "url(#timerGrad)";
  }

  renderColorPalette();
  syncStudyToServer();
  if (typeof renderCoStudyList === 'function') {
    renderCoStudyList(lastFetchedLearners);
  }
  toast(`Đã chuyển phối màu: ${c.name} ✨`);
}

function resetStudyTheme() {
  studySettings.activeWallpaper = 'default';
  studySettings.activeAura = 'emerald';
  studySettings.clockColor = 'default';
  studySettings.wallpaperDim = 35;
  studySettings.cardGlassOpacity = 50;
  saveStudySettings(false);

  const studyEl = $("#study");
  if (studyEl) {
    studyEl.classList.remove("has-custom-bg");
    studyEl.classList.remove("study-zen-view");
    studyEl.style.removeProperty("--primary");
    studyEl.style.removeProperty("--primary-gradient");
    studyEl.style.removeProperty("--primary-glow");
    studyEl.style.removeProperty("--study-overlay-opacity");
    studyEl.style.removeProperty("--study-card-opacity");
  }
  const bgLayer = $("#studyBackgroundLayer");
  if (bgLayer) {
    bgLayer.style.backgroundImage = "";
  }
  const stop1 = $("#timerGradStop1");
  const stop2 = $("#timerGradStop2");
  if (stop1 && stop2) {
    stop1.setAttribute("stop-color", "#10b981");
    stop2.setAttribute("stop-color", "#34d399");
  }
  const progCircle = $("#timerProgressCircle");
  if (progCircle) {
    progCircle.style.stroke = "url(#timerGrad)";
  }
  const clock = $("#timerClock");
  if (clock) {
    clock.style.removeProperty("color");
  }
  const nameEl = $("#customWallName");
  if (nameEl) nameEl.textContent = "Chưa chọn ảnh";

  applyWallpaperDim(35);
  applyCardGlass(50);
  renderWallpaperPresets();
  renderClockColorPicker();
  renderColorPalette();
  renderCustomWallpapersList();
  syncStudyToServer();
  if (typeof renderCoStudyList === 'function') {
    renderCoStudyList(lastFetchedLearners);
  }
  toast("Đã đặt lại không gian học tập mặc định.");
}

window.notifyPerkLocked = function(days, perkName) {
  toast(`🔒 ${perkName} mở khóa ở Chuỗi ${days} ngày!`);
};

/* --- 11. FULLSCREEN ZEN MODE --- */
function toggleStudyFullscreen() {
  const isZen = document.body.classList.toggle("study-zen-fullscreen");
  const btn = $("#studyFullscreenBtn");
  if (btn) btn.textContent = isZen ? "✕" : "⛶";
  if (isZen) {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  } else {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }
}

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) {
    document.body.classList.remove("study-zen-fullscreen");
    const btn = $("#studyFullscreenBtn");
    if (btn) btn.textContent = "⛶";
  }
});

/* --- 12. PUSH NOTIFICATION --- */
function sendStudyNotification() {
  if (!studySettings.browserNotifications) return;
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    const isFocus = (studyState.mode === 'focus');
    const title = isFocus ? "🎉 Hoàn thành lượt tập trung!" : "⏰ Hết giờ nghỉ giải lao!";
    const body = isFocus
      ? "Bạn đã hoàn thành xuất sắc lượt học. Hãy đứng dậy vươn vai và thư giãn nhé!"
      : "Thời gian nghỉ đã hết. Sẵn sàng bắt đầu lượt tập trung mới nào!";
    try {
      new Notification(title, {
        body,
        icon: "/favicon.ico"
      });
    } catch (e) {}
  }
}

/* --- 13. SETTINGS MODAL HANDLERS --- */
window.openStudySettingsModal = function() {
  const modal = $("#studySettingsModal");
  if (!modal) return;

  const fInput = $("#settingFocusMins");
  const sInput = $("#settingShortBreakMins");
  const lInput = $("#settingLongBreakMins");
  const aBreaks = $("#settingAutoStartBreaks");
  const aPoms = $("#settingAutoStartPomodoros");
  const bNotifs = $("#settingBrowserNotifications");
  const selAlarm = $("#settingEndAlarm");

  if (fInput) fInput.value = studySettings.focusMins;
  if (sInput) sInput.value = studySettings.shortBreakMins;
  if (lInput) lInput.value = studySettings.longBreakMins;
  if (aBreaks) aBreaks.checked = studySettings.autoStartBreaks;
  if (aPoms) aPoms.checked = studySettings.autoStartPomodoros;
  if (bNotifs) {
    bNotifs.checked = studySettings.browserNotifications;
    bNotifs.onchange = () => {
      if (bNotifs.checked && "Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
      }
    };
  }
  if (selAlarm) selAlarm.value = studySettings.alarmSound;

  modal.showModal();
};

window.stepDuration = function(type, delta) {
  let input = null;
  let min = 1, max = 120;
  if (type === 'focus') {
    input = $("#settingFocusMins");
    min = 1; max = 120;
  } else if (type === 'shortbreak') {
    input = $("#settingShortBreakMins");
    min = 1; max = 30;
  } else if (type === 'longbreak') {
    input = $("#settingLongBreakMins");
    min = 5; max = 60;
  }
  if (!input) return;
  const current = Number(input.value) || min;
  const next = Math.max(min, Math.min(max, current + delta));
  input.value = next;
};

window.saveStudySettings = function(closeModal = true) {
  const fInput = $("#settingFocusMins");
  const sInput = $("#settingShortBreakMins");
  const lInput = $("#settingLongBreakMins");
  const aBreaks = $("#settingAutoStartBreaks");
  const aPoms = $("#settingAutoStartPomodoros");
  const bNotifs = $("#settingBrowserNotifications");
  const selAlarm = $("#settingEndAlarm");

  if (fInput) studySettings.focusMins = Math.max(1, Math.min(120, Number(fInput.value) || 25));
  if (sInput) studySettings.shortBreakMins = Math.max(1, Math.min(30, Number(sInput.value) || 5));
  if (lInput) studySettings.longBreakMins = Math.max(5, Math.min(60, Number(lInput.value) || 15));
  if (aBreaks) studySettings.autoStartBreaks = aBreaks.checked;
  if (aPoms) studySettings.autoStartPomodoros = aPoms.checked;
  if (selAlarm) studySettings.alarmSound = selAlarm.value;

  if (bNotifs) {
    studySettings.browserNotifications = bNotifs.checked;
    if (bNotifs.checked && "Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }

  try {
    localStorage.setItem(STUDY_SETTINGS_KEY, JSON.stringify(studySettings));
  } catch (e) {}

  if (!studyState.isRunning) {
    if (studyState.mode === 'focus') {
      studyState.durationMinutes = studySettings.focusMins;
      studyState.remainingSeconds = studySettings.focusMins * 60;
    } else if (studyState.mode === 'shortbreak') {
      studyState.durationMinutes = studySettings.shortBreakMins;
      studyState.remainingSeconds = studySettings.shortBreakMins * 60;
    } else if (studyState.mode === 'longbreak') {
      studyState.durationMinutes = studySettings.longBreakMins;
      studyState.remainingSeconds = studySettings.longBreakMins * 60;
    }
    updateTimerDisplay();
  }

  if (closeModal) {
    const modal = $("#studySettingsModal");
    if (modal) modal.close();
    toast("Đã lưu cấu hình Pomodoro!");
  }
};

/* --- 14. TO-DO CHECKLIST MANAGER (localStorage) --- */
const STUDY_TODO_STORAGE_KEY = "research_study_todos_v1";

function updateTodoProgressBar() {
  const bar = $("#todoProgressBar");
  if (!bar) return;
  let todos = [];
  try {
    todos = JSON.parse(localStorage.getItem(STUDY_TODO_STORAGE_KEY) || "[]");
  } catch (e) {
    todos = [];
  }
  if (todos.length === 0) {
    bar.style.width = "0%";
    return;
  }
  const done = todos.filter(t => t.done).length;
  const pct = Math.round((done / todos.length) * 100);
  bar.style.width = `${pct}%`;
}

function loadStudyTodos() {
  const listEl = $("#studyTodoList");
  if (!listEl) return;
  let todos = [];
  try {
    todos = JSON.parse(localStorage.getItem(STUDY_TODO_STORAGE_KEY) || "[]");
  } catch (e) {
    todos = [];
  }

  if (todos.length === 0) {
    listEl.innerHTML = `<li class="todo-item" style="color:var(--muted); font-size:12px; justify-content:center;">Chưa có ghi chú nào.</li>`;
    updateTodoProgressBar();
    return;
  }

  listEl.innerHTML = todos.map((t, idx) => `
    <li class="todo-item ${t.done ? 'done' : ''}">
      <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleStudyTodo(${idx})" />
      <span>${escapeHTML(t.text)}</span>
      <button class="todo-del-btn" onclick="deleteStudyTodo(${idx})" title="Xoá">×</button>
    </li>
  `).join("");

  updateTodoProgressBar();
}

function saveStudyTodos(todos) {
  try {
    localStorage.setItem(STUDY_TODO_STORAGE_KEY, JSON.stringify(todos));
  } catch (e) {}
  loadStudyTodos();
}

function addStudyTodo() {
  const input = $("#newTodoInput");
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  let todos = [];
  try {
    todos = JSON.parse(localStorage.getItem(STUDY_TODO_STORAGE_KEY) || "[]");
  } catch (e) {
    todos = [];
  }
  todos.push({ text, done: false });
  input.value = "";
  saveStudyTodos(todos);
}

window.toggleStudyTodo = function(idx) {
  let todos = [];
  try {
    todos = JSON.parse(localStorage.getItem(STUDY_TODO_STORAGE_KEY) || "[]");
  } catch (e) {}
  if (todos[idx]) {
    todos[idx].done = !todos[idx].done;
    saveStudyTodos(todos);
  }
};

window.deleteStudyTodo = function(idx) {
  let todos = [];
  try {
    todos = JSON.parse(localStorage.getItem(STUDY_TODO_STORAGE_KEY) || "[]");
  } catch (e) {}
  todos.splice(idx, 1);
  saveStudyTodos(todos);
};

function clearCompletedTodos() {
  let todos = [];
  try {
    todos = JSON.parse(localStorage.getItem(STUDY_TODO_STORAGE_KEY) || "[]");
  } catch (e) {}
  todos = todos.filter(t => !t.done);
  saveStudyTodos(todos);
}

/* --- 15. ROUTE LIFECYCLE & EVENT INITIALIZATION --- */
function onEnterStudyLounge() {
  if (!canAccessStudyLounge()) {
    toast(STUDY_MAINTENANCE_MSG);
    go("home");
    return;
  }
  updateStudyStreakPerks();
  renderCoStudyList(lastFetchedLearners);
  fetchStudyLounge();
  loadStudyTodos();
  renderEnvironmentAudioGrid();
  renderMixAudioGrid();
  renderMusicAudioGrid();
  loadCustomAudioFromDB();
  renderWallpaperPresets();
  renderCustomWallpapersList();
  renderClockColorPicker();
  renderColorPalette();
  updateTimerDisplay();
  rotateStudyQuote(false);

  // Apply saved wallpaper dim & card glass opacity
  applyWallpaperDim(studySettings.wallpaperDim ?? 35);
  applyCardGlass(studySettings.cardGlassOpacity ?? 50);

  // Apply saved clock color
  if (studySettings.clockColor && studySettings.clockColor !== 'default') {
    applyClockColor(studySettings.clockColor);
  }

  // Apply saved theme & aura
  const studyEl = $("#study");
  if (studySettings.activeWallpaper && studySettings.activeWallpaper !== 'default') {
    if (studySettings.activeWallpaper.startsWith('custom_')) {
      idbGetAll("custom_wallpapers").then(walls => {
        const wallId = studySettings.activeWallpaper.replace('custom_', '');
        const target = walls.find(w => w.id === wallId);
        if (target && target.dataUrl) {
          if (studyEl) studyEl.classList.add("has-custom-bg");
          const bgLayer = $("#studyBackgroundLayer");
          if (bgLayer) {
            bgLayer.style.backgroundImage = `url(${target.dataUrl})`;
            bgLayer.style.backgroundSize = "cover";
            bgLayer.style.backgroundPosition = "center";
          }
          const nameEl = $("#customWallName");
          if (nameEl) nameEl.textContent = target.name;
        } else {
          if (studyEl) studyEl.classList.remove("has-custom-bg");
        }
      });
    } else {
      applyStudyWallpaperPreset(studySettings.activeWallpaper);
    }
  } else {
    if (studyEl) studyEl.classList.remove("has-custom-bg");
  }
  applyColorAura(studySettings.activeAura || 'emerald');

  if (!studyState.pollingInterval) {
    studyState.pollingInterval = setInterval(fetchStudyLounge, 15000);
  }
}

function onLeaveStudyLounge() {
  if (studyState.pollingInterval) {
    clearInterval(studyState.pollingInterval);
    studyState.pollingInterval = null;
  }
}

function initStudyLoungeEvents() {
  $$(".study-mode-btn").forEach(btn => {
    btn.onclick = () => {
      const mode = btn.dataset.studyMode;
      setStudyMode(mode);
    };
  });

  const startBtn = $("#studyStartBtn");
  if (startBtn) startBtn.onclick = startStudyTimer;

  const pauseBtn = $("#studyPauseBtn");
  if (pauseBtn) pauseBtn.onclick = () => pauseStudyTimer(true);

  const resetBtn = $("#studyResetBtn");
  if (resetBtn) resetBtn.onclick = resetStudyTimer;

  const nextBtn = $("#studyNextBtn");
  if (nextBtn) nextBtn.onclick = () => advanceStudyCycle(true);

  const completeBtn = $("#studyCompleteBtn");
  if (completeBtn) completeBtn.onclick = () => finishStudySession(false);

  const fullscreenBtn = $("#studyFullscreenBtn");
  if (fullscreenBtn) fullscreenBtn.onclick = toggleStudyFullscreen;

  // Sound arena tab switching: 'env' vs 'mix' vs 'music'
  $$(".sound-tab").forEach(tab => {
    tab.onclick = () => {
      const tabName = tab.dataset.soundTab;
      $$(".sound-tab").forEach(t => t.classList.toggle("active", t === tab));
      const targetPaneId = (tabName === 'music') ? 'paneMusicAudio' : (tabName === 'mix') ? 'paneMixAudio' : 'paneEnvAudio';
      $$(".sound-tab-pane").forEach(p => {
        p.style.display = (p.id === targetPaneId) ? "block" : "none";
      });
      studyState.activeSoundTab = tabName;
    };
  });

  // Sound master toggle: stop all or play default env
  const masterAmbientBtn = $("#toggleAmbientMaster");
  if (masterAmbientBtn) {
    masterAmbientBtn.onclick = () => {
      const anyActive = (studyState.activeEnvTrack !== null) ||
                        (studyState.activeMusicTrack !== null) ||
                        (studyState.activeCustomEnvId !== null) ||
                        (studyState.activeCustomMusicId !== null) ||
                        Object.values(studyState.activeMixSounds).some(v => v) ||
                        Object.values(studyState.activeCustomMixSounds).some(v => v);
      if (anyActive) {
        stopAllStudyAudio();
      } else {
        toggleEnvTrack('env_1');
      }
      updateMasterAmbientButtonState();
    };
  }

  // Custom audio file inputs (Rạch ròi: Môi trường, Phối hợp & Âm nhạc)
  const envAudioInput = $("#customEnvAudioInput");
  if (envAudioInput) {
    envAudioInput.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handleCustomEnvAudioUpload(file);
      envAudioInput.value = "";
    };
  }

  const mixAudioInput = $("#customMixAudioInput");
  if (mixAudioInput) {
    mixAudioInput.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handleCustomMixAudioUpload(file);
      mixAudioInput.value = "";
    };
  }

  const musicAudioInput = $("#customMusicAudioInput");
  if (musicAudioInput) {
    musicAudioInput.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handleCustomMusicAudioUpload(file);
      musicAudioInput.value = "";
    };
  }

  const wallInput = $("#customWallInput");
  if (wallInput) {
    wallInput.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handleCustomWallpaperUpload(file);
      wallInput.value = "";
    };
  }

  // To-do checklist buttons
  const addTodoBtn = $("#addTodoBtn");
  if (addTodoBtn) addTodoBtn.onclick = addStudyTodo;
  const todoInput = $("#newTodoInput");
  if (todoInput) {
    todoInput.onkeydown = (e) => {
      if (e.key === "Enter") addStudyTodo();
    };
  }
  const clearTodoBtn = $("#clearCompletedTodos");
  if (clearTodoBtn) clearTodoBtn.onclick = clearCompletedTodos;

  // Motivational quote interaction
  const quoteWrap = $("#timerQuoteWrap");
  if (quoteWrap) {
    quoteWrap.onclick = () => rotateStudyQuote(true);
  }
  rotateStudyQuote(false);

  // Initialize UI components
  renderEnvironmentAudioGrid();
  renderMixAudioGrid();
  renderMusicAudioGrid();
  loadCustomAudioFromDB();
  renderWallpaperPresets();
  renderCustomWallpapersList();
  renderClockColorPicker();
  renderColorPalette();
  applyWallpaperDim(studySettings.wallpaperDim ?? 35);
  applyCardGlass(studySettings.cardGlassOpacity ?? 50);
}

window.studyState = studyState;
window.toggleEnvTrack = toggleEnvTrack;
window.toggleMixTrack = toggleMixTrack;
window.toggleMusicTrack = toggleMusicTrack;
window.updateEnvVolume = updateEnvVolume;
window.updateMixVolume = updateMixVolume;
window.updateMusicVolume = updateMusicVolume;
window.toggleCustomAudio = toggleCustomAudio;
window.confirmDeleteCustomAudioTrack = confirmDeleteCustomAudioTrack;
window.updateCustomAudioVolume = updateCustomAudioVolume;
window.applyStudyWallpaperPreset = applyStudyWallpaperPreset;
window.applyCustomWallpaper = applyCustomWallpaper;
window.confirmDeleteCustomWallpaper = confirmDeleteCustomWallpaper;
window.triggerWallpaperUpload = triggerWallpaperUpload;
window.handleCustomWallpaperUpload = handleCustomWallpaperUpload;
window.handleWallpaperDimChange = handleWallpaperDimChange;
window.handleCardGlassChange = handleCardGlassChange;
window.applyCardGlass = applyCardGlass;
window.toggleStudyZenView = toggleStudyZenView;
window.applyClockColor = applyClockColor;
window.applyColorAura = applyColorAura;
window.resetStudyTheme = resetStudyTheme;
window.STUDY_QUOTES = STUDY_QUOTES;
window.rotateStudyQuote = rotateStudyQuote;

document.addEventListener("click", () => {
  if (studyState.audioCtx && studyState.audioCtx.state === "suspended") {
    studyState.audioCtx.resume();
  }
}, { once: true });

initStudyLoungeEvents();
initMobileNavScrollHandler();

renderHome();
renderPosts();
renderDocuments();
const initialRequestedRoute = (location.hash.slice(1) || "home");
if (initialRequestedRoute === "study" && serverMode) {
  go("home", false);
} else {
  go(initialRequestedRoute, false);
}
hydrateServer();

/* ==========================================================================
   RE:SEARCH - HOẠT ĐỘNG THI ĐUA ĐỊNH KỲ HÀNG TUẦN (WEEKLY COMPETITION ARENA)
   ========================================================================== */



function playCompSound(type) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!compState.audioCtx) {
      compState.audioCtx = new AudioContext();
    }
    if (compState.audioCtx.state === "suspended") {
      compState.audioCtx.resume();
    }

    const ctx = compState.audioCtx;
    const now = ctx.currentTime;

    if (type === "correct") {
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0.12, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.22);
      });
    } else if (type === "wrong") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.25);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    } else if (type === "penalty") {
      [180, 140].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, now + i * 0.09);
        gain.gain.setValueAtTime(0.08, now + i * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.09);
        osc.stop(now + i * 0.09 + 0.08);
      });
    } else if (type === "victory") {
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + i * 0.1);
        gain.gain.setValueAtTime(0.18, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.55);
      });
    }
  } catch (e) {}
}

function launchQuizConfetti() {
  const canvas = $("#quizConfettiCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const parent = canvas.parentElement || document.body;
  canvas.width = parent.clientWidth || 800;
  canvas.height = parent.clientHeight || 500;

  const particles = [];
  const colors = ["#246247", "#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#8b5cf6", "#eab308"];
  for (let i = 0; i < 80; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2,
      r: Math.random() * 5 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.floor(Math.random() * 10) - 10,
      tiltAngleIncremental: (Math.random() * 0.07) + 0.05,
      tiltAngle: 0,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.7) * 14,
      gravity: 0.18,
      opacity: 1
    });
  }

  if (compState.confettiAnimationId) cancelAnimationFrame(compState.confettiAnimationId);

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.98;
      p.tiltAngle += p.tiltAngleIncremental;
      p.tilt = Math.sin(p.tiltAngle) * 10;
      p.opacity -= 0.006;

      if (p.opacity > 0) {
        alive = true;
        ctx.beginPath();
        ctx.lineWidth = p.r;
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.moveTo(p.x + p.tilt + (p.r / 4), p.y);
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + (p.r / 4));
        ctx.stroke();
      }
    });
    ctx.globalAlpha = 1;
    if (alive) {
      compState.confettiAnimationId = requestAnimationFrame(draw);
    }
  }
  draw();
}

function formatCompSeconds(sec) {
  if (sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

async function loadWeeklyCompetitionStatus() {
  if (!serverMode) return;
  try {
    const data = await requestAPI("/api/competition/status");
    compState.status = data;

    // Detect if any student submitted a new score (làm bù or on-time)
    if (data.resultsVersion) {
      if (compState.lastResultsVersion && compState.lastResultsVersion !== data.resultsVersion) {
        // Results changed! Invalidate cached leaderboard
        compState.cachedLeaderboard = {};
        if (compState.activeTab === "leaderboard") {
          loadAndRenderLeaderboard(compState.activeLbPhase || 1, true);
        }
      }
      compState.lastResultsVersion = data.resultsVersion;
    }

    const moduleEl = $("#weeklyCompetitionModule");
    if (!moduleEl) return;

    if (!data.visible || !data.isReady) {
      moduleEl.style.display = "none";
      return;
    }

    moduleEl.style.display = "block";
    renderWeeklyCompetitionCard(data);
  } catch (e) {
    const moduleEl = $("#weeklyCompetitionModule");
    if (moduleEl) moduleEl.style.display = "none";
  }
}

function normalizeCompData(raw) {
  if (!raw) return {};
  const isSunday = Boolean(raw.isSunday || raw.timeState?.isSunday);
  const phase = raw.phase || raw.timeState?.phase || 1;
  let state = raw.state || raw.timeState?.state || "closed";
  if (state === "upcoming") {
    state = "countdown";
  }
  const stateLabel = raw.stateLabel || raw.timeState?.stateLabel || "Cổng thi đấu";
  const weekTopic = raw.weekTopic || raw.week?.topic_name || raw.week?.topicName || "Phương pháp Nghiên cứu & Xử lý Dữ liệu Khoa học";
  const phaseTopic = raw.phaseTopic || raw.timeState?.phaseTopic || raw.week?.[`phase${phase}_topic`] || raw.week?.[`phase${phase}Topic`] || "";
  const weekNumber = raw.week?.week_number || raw.week?.weekNumber || raw.currentCompetition?.week_number || raw.weekNumber || 1;
  const weekTitle = raw.weekTitle || `TUẦN ${String(weekNumber).padStart(2, "0")}`;
  const remainingSeconds = typeof raw.secondsUntilNext === "number" ? raw.secondsUntilNext : (typeof raw.timeState?.secondsUntilNext === "number" ? raw.timeState.secondsUntilNext : (raw.remainingSeconds || 0));
  const userAttempts = raw.userStatus?.attemptsUsed ?? (raw.userAttempts || 0);
  const userBestScore = raw.userStatus?.bestScore ?? (raw.userBestScore || 0);
  const hasActiveSession = Boolean(raw.userStatus?.hasActiveSession || raw.hasActiveSession);
  const activeRemaining = raw.userStatus?.activeRemaining ?? (raw.activeRemaining || 0);
  const activeQuestionIndex = raw.userStatus?.activeQuestionIndex ?? (raw.activeQuestionIndex || 1);
  const isPaused = Boolean(raw.userStatus?.isPaused || raw.isPaused);
  const exitCount = raw.userStatus?.exitCount ?? (raw.exitCount || 0);
  const phasesStatus = Array.isArray(raw.phasesStatus) ? raw.phasesStatus : (Array.isArray(raw.userStatus?.phasesStatus) ? raw.userStatus.phasesStatus : []);
  const maxAttempts = raw.maxAttempts || raw.userStatus?.maxAttempts || 1;
  const totalOnTimeBonus = raw.totalOnTimeBonus ?? raw.userStatus?.totalOnTimeBonus ?? raw.userSummary?.totalOnTimeBonus ?? 0;
  const defaultAvailablePhase = (raw.userStatus?.defaultAvailablePhase !== undefined)
    ? raw.userStatus.defaultAvailablePhase
    : (raw.defaultAvailablePhase !== undefined ? raw.defaultAvailablePhase : null);

  return {
    isSunday,
    phase,
    state,
    stateLabel,
    weekTopic,
    phaseTopic,
    weekTitle,
    weekNumber,
    remainingSeconds,
    userAttempts,
    userBestScore,
    hasActiveSession,
    activeRemaining,
    activeQuestionIndex,
    isPaused,
    exitCount,
    phasesStatus,
    maxAttempts,
    totalOnTimeBonus,
    defaultAvailablePhase,
    visible: raw.visible ?? raw.timeState?.visible ?? true,
    isReady: raw.isReady ?? raw.timeState?.isReady ?? true
  };
}

function renderWeeklyCompetitionCard(raw) {
  const data = normalizeCompData(raw);
  const badgeEl = $("#compStatusBadge");
  const badgeTextEl = $("#compStatusBadgeText");
  const weekTag = $("#compWeekTag");
  const topicTitle = $("#compTopicTitle");
  const phaseSubtitle = $("#compPhaseSubtitle");
  const timerLabel = $("#compTimerLabel");
  const countdownTicker = $("#compCountdownTicker");
  const attemptsTeaser = $("#compAttemptsTeaser");
  const bestScoreTeaser = $("#compBestScoreTeaser");
  const ctaBtn = $("#compCtaBtn");
  const ctaText = $("#compCtaText");

  if (!badgeEl) return;

  if (topicTitle) topicTitle.textContent = data.weekTopic || "Chủ đề Nghiên cứu Khoa học";
  if (phaseSubtitle) {
    if (data.isSunday) {
      phaseSubtitle.textContent = "Chủ Nhật: Tổng kết toàn tuần & Trao thưởng";
    } else {
      phaseSubtitle.textContent = `Giai đoạn ${data.phase}: ${data.phaseTopic || ""}`;
    }
  }
  if (weekTag) weekTag.textContent = data.weekTitle || `TUẦN ${String(data.weekNumber || 1).padStart(2, "0")}`;

  if (attemptsTeaser) {
    attemptsTeaser.textContent = `Số lượt thi: ${data.userAttempts || 0}/1`;
  }
  if (bestScoreTeaser) {
    if (data.userBestScore > 0) {
      bestScoreTeaser.style.display = "inline-flex";
      bestScoreTeaser.textContent = `⭐ ${data.userBestScore}`;
    } else {
      bestScoreTeaser.style.display = "none";
    }
  }

  const cardEl = $("#weeklyCompetitionModule");
  if (cardEl) {
    cardEl.classList.remove("theme-state-open", "theme-state-summary", "theme-state-upcoming", "theme-state-sunday");
    if (data.isSunday) {
      cardEl.classList.add("theme-state-sunday");
    } else if (data.state === "open") {
      cardEl.classList.add("theme-state-open");
    } else if (data.state === "countdown" || data.state === "upcoming") {
      cardEl.classList.add("theme-state-upcoming");
    } else {
      cardEl.classList.add("theme-state-summary");
    }
  }

  badgeEl.className = "comp-status-badge";
  if (data.isSunday) {
    badgeEl.classList.add("status-sunday");
    if (badgeTextEl) badgeTextEl.textContent = "TỔNG KẾT TUẦN";
    if (timerLabel) timerLabel.textContent = "Kết thúc tuần sau:";
    if (ctaText) ctaText.textContent = "Xem bảng xếp hạng";
    if (ctaBtn) ctaBtn.className = "comp-cta-button cta-sunday";
  } else if (data.state === "open") {
    badgeEl.classList.add("status-open");
    if (badgeTextEl) badgeTextEl.textContent = "ĐANG MỞ CỔNG (19h - 23h)";
    if (timerLabel) timerLabel.textContent = "Thời gian mở cổng còn lại:";
    if (ctaText) ctaText.textContent = "Tham gia ngay";
    if (ctaBtn) ctaBtn.className = "comp-cta-button cta-open";
  } else if (data.state === "countdown" || data.state === "upcoming") {
    badgeEl.classList.add("status-upcoming");
    if (badgeTextEl) badgeTextEl.textContent = "SẮP MỞ CỔNG (16h - 19h)";
    if (timerLabel) timerLabel.textContent = "Mở cổng sau:";
    if (ctaText) ctaText.textContent = "Xem thể lệ & thông tin";
    if (ctaBtn) ctaBtn.className = "comp-cta-button cta-countdown";
  } else {
    badgeEl.classList.add("status-summary");
    if (badgeTextEl) badgeTextEl.textContent = data.state === "closed" ? "CỔNG ĐÃ ĐÓNG" : "ĐANG TỔNG KẾT";
    if (timerLabel) timerLabel.textContent = data.state === "closed" ? "Thời gian còn lại:" : "Mở countdown sau:";
    if (ctaText) ctaText.textContent = "Xem bảng xếp hạng";
    if (ctaBtn) ctaBtn.className = "comp-cta-button cta-summary";
  }

  if (compState.homeTimerInterval) clearInterval(compState.homeTimerInterval);
  let localRemainingSec = data.remainingSeconds || 0;
  if (countdownTicker) countdownTicker.textContent = formatCompSeconds(localRemainingSec);

  compState.homeTimerInterval = setInterval(() => {
    localRemainingSec--;
    if (localRemainingSec <= 0) {
      clearInterval(compState.homeTimerInterval);
      loadWeeklyCompetitionStatus();
    } else {
      if (countdownTicker) countdownTicker.textContent = formatCompSeconds(localRemainingSec);
    }
  }, 1000);
}

async function onEnterArena() {
  const user = session || (typeof window !== "undefined" && window.session);
  const isAdmin = Boolean(user && user.role === "admin");
  const lockedNotice = $("#arenaLockedNotice");
  const mainContent = $("#arenaMainContent");

  if (!canAccessArena(user)) {
    if (lockedNotice) lockedNotice.style.display = "block";
    if (mainContent) mainContent.style.display = "none";
    return;
  }

  if (lockedNotice) lockedNotice.style.display = "none";
  if (mainContent) mainContent.style.display = "block";
  const adminBar = $("#arenaAdminBar");
  if (adminBar) adminBar.style.display = isAdmin ? "flex" : "none";

  try {
    const overview = await requestAPI("/api/competition/overview");
    compState.overview = overview;
    if (overview.resultsVersion) {
      if (compState.lastResultsVersion && compState.lastResultsVersion !== overview.resultsVersion) {
        compState.cachedLeaderboard = {};
      }
      compState.lastResultsVersion = overview.resultsVersion;
    }
    renderCompetitionOverview(overview);

    const norm = normalizeCompData(overview);
    if (!compState.activeTab) {
      if (norm.state === "open" || norm.state === "countdown") {
        switchCompTab("gateway");
      } else {
        switchCompTab("leaderboard");
      }
    } else {
      switchCompTab(compState.activeTab);
    }
  } catch (e) {
    console.error("Error loading Arena overview:", e);
  }
}

function onLeaveArena() {
  if (compState.gatewayTimerInterval) clearInterval(compState.gatewayTimerInterval);
}

window.onEnterArena = onEnterArena;
window.onLeaveArena = onLeaveArena;

async function openCompetitionModal(initialTab = null) {
  go("arena");
  if (initialTab) {
    switchCompTab(initialTab);
  }
}

function closeCompetitionModal() {
  if (compState.gatewayTimerInterval) clearInterval(compState.gatewayTimerInterval);
}

function handleCompetitionCtaClick() {
  const norm = normalizeCompData(compState.status);
  if (norm.state === "open") {
    openCompetitionModal("gateway");
  } else if (norm.state === "summary" || norm.state === "reviewing" || norm.state === "sunday_summary") {
    openCompetitionModal("leaderboard");
  } else {
    openCompetitionModal("gateway");
  }
}

function switchCompTab(tabName) {
  compState.activeTab = tabName;
  $$(".comp-tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.compTab === tabName);
  });
  $$(".comp-tab-panel").forEach(panel => {
    panel.style.display = "none";
  });

  if (tabName === "gateway") {
    const gEl = $("#compTabGateway");
    if (gEl) gEl.style.display = "block";
    if (compState.overview) renderGatewayTab(compState.overview);
  } else if (tabName === "leaderboard") {
    const lEl = $("#compTabLeaderboard");
    if (lEl) lEl.style.display = "block";
    loadAndRenderLeaderboard(compState.activeLbPhase || 1);
  } else if (tabName === "rules") {
    const rEl = $("#compTabRules");
    if (rEl) rEl.style.display = "block";
  }
}

function renderCompetitionOverview(raw) {
  const data = normalizeCompData(raw);
  const heroStatusTag = $("#arenaHeroStatusTag");
  if (heroStatusTag && data.phaseName) {
    heroStatusTag.textContent = data.phaseName.toUpperCase();
  }
  const seasonTag = $("#arenaTagSeason");
  if (seasonTag) {
    const weekNum = data.weekNumber || 1;
    seasonTag.textContent = `TUẦN ${String(weekNum).padStart(2, "0")}`;
  }
}

function renderGatewayTab(raw) {
  const data = normalizeCompData(raw);
  const statusBadge = $("#gatewayStatusBadge");
  const statusText = $("#gatewayStatusText");
  const phaseTag = $("#gatewayPhaseTag");
  const phaseTitle = $("#gatewayPhaseTitle");
  const weekTitle = $("#gatewayWeekTitle");
  const clockLabel = $("#gatewayClockLabel");
  const clockDigits = $("#gatewayClockDigits");
  const userAttempts = $("#userAttemptsCount");
  const bestScore = $("#userPhaseBestScore");
  const userTotalOnTimeBonus = $("#userTotalOnTimeBonus");
  const attemptsPhaseLabel = $("#attemptsPhaseLabel");
  const startBtn = $("#gatewayStartQuizBtn");
  const startBtnText = $("#gatewayStartBtnText");
  const blockedMsg = $("#gatewayBlockedMsg");

  const gatewayHero = $("#compGatewayHero") || $(".comp-gateway-hero");
  if (gatewayHero) {
    gatewayHero.classList.remove("theme-state-open", "theme-state-summary", "theme-state-upcoming", "theme-state-sunday");
    if (data.isSunday) {
      gatewayHero.classList.add("theme-state-sunday");
    } else if (data.state === "open") {
      gatewayHero.classList.add("theme-state-open");
    } else if (data.state === "countdown" || data.state === "upcoming") {
      gatewayHero.classList.add("theme-state-upcoming");
    } else {
      gatewayHero.classList.add("theme-state-summary");
    }
  }

  if (statusBadge) {
    statusBadge.className = "comp-status-badge";
    if (data.isSunday) {
      statusBadge.classList.add("status-sunday");
      if (statusText) statusText.textContent = "TỔNG KẾT TUẦN";
      if (clockLabel) clockLabel.textContent = "Kết thúc tuần sau:";
    } else if (data.state === "open") {
      statusBadge.classList.add("status-open");
      if (statusText) statusText.textContent = "ĐANG MỞ CỔNG (19h - 23h)";
      if (clockLabel) clockLabel.textContent = "Thời gian mở cổng còn lại:";
    } else if (data.state === "countdown" || data.state === "upcoming") {
      statusBadge.classList.add("status-upcoming");
      if (statusText) statusText.textContent = "SẮP MỞ CỔNG (16h - 19h)";
      if (clockLabel) clockLabel.textContent = "Mở cổng trả lời sau:";
    } else {
      statusBadge.classList.add("status-summary");
      if (statusText) statusText.textContent = data.state === "closed" ? "CỔNG ĐÃ ĐÓNG" : "ĐANG TỔNG KẾT";
      if (clockLabel) clockLabel.textContent = data.state === "closed" ? "Thời gian còn lại:" : "Mở countdown sau:";
    }
  }

  if (phaseTag) {
    phaseTag.textContent = data.isSunday ? "Tổng kết tuần" : `Giai đoạn ${data.phase}`;
  }
  if (phaseTitle) {
    phaseTitle.textContent = data.phaseTopic || data.weekTopic || "Chủ đề giai đoạn";
  }
  if (weekTitle) {
    weekTitle.textContent = `Chủ đề tuần: ${data.weekTopic || ""}`;
  }
  if (attemptsPhaseLabel) {
    attemptsPhaseLabel.textContent = data.isSunday ? "Tổng kết toàn tuần" : `Giai đoạn ${data.phase}`;
  }

  const attempts = data.userAttempts || 0;
  if (userAttempts) userAttempts.innerHTML = `${attempts} / 1 <span class="attempt-sub">lượt</span>`;
  if (bestScore) bestScore.innerHTML = `${data.userBestScore || 0} <span class="attempt-sub">⭐</span>`;
  if (userTotalOnTimeBonus) userTotalOnTimeBonus.innerHTML = `${data.totalOnTimeBonus || 0} / 100 <span class="attempt-sub">⭐</span>`;

  // Render 3-Phase Journey Grid (Làm bù & Đặc quyền đúng hạn)
  const phasesGrid = $("#gatewayPhasesGrid");
  if (phasesGrid) {
    const phases = data.phasesStatus || [];
    let gridHTML = "";
    phases.forEach(p => {
      const pDays = p.phase === 1 ? "Thứ Hai – Thứ Ba" : (p.phase === 2 ? "Thứ Tư – Thứ Năm" : "Thứ Sáu – Thứ Bảy");
      let cardClass = "phase-journey-card";
      let chipHTML = "";
      let scoreInfoHTML = "";
      let actionBtnHTML = "";

      if (p.isCompleted) {
        cardClass += " card-completed";
        chipHTML = '<span class="pj-status-chip chip-completed">✅ ĐÃ XONG</span>';
        const phaseScore = (p.score !== undefined) ? p.score : (p.bestScore ?? 0);
        scoreInfoHTML = `<div class="pj-score-box"><span class="pj-score-label">Điểm:</span><span class="pj-score-val">⭐ ${phaseScore}</span></div>`;
        actionBtnHTML = `<button type="button" class="pj-action-btn btn-view-result" onclick="openPhaseResultModal(${p.phase})">Xem lịch sử hoàn thành</button>`;
      } else if (p.hasActiveSession) {
        cardClass += " card-on-time";
        chipHTML = '<span class="pj-status-chip chip-on-time">⏸️ ĐANG LÀM DỞ</span>';
        scoreInfoHTML = `<div class="pj-score-box"><span class="pj-score-label">Còn lại:</span><span class="pj-score-val">${formatCompSeconds(p.activeRemaining || 600)}</span></div>`;
        actionBtnHTML = `<button type="button" class="pj-action-btn btn-resume" onclick="startCompetitionQuiz(${p.phase})">Tiếp tục bài thi</button>`;
      } else if (data.state === "open" && p.isAvailable) {
        if (p.isOnTime) {
          cardClass += " card-on-time";
          chipHTML = '<span class="pj-status-chip chip-on-time">🟢 ĐÚNG HẠN (+50⭐)</span>';
          scoreInfoHTML = `<div class="pj-score-box"><span class="pj-score-label">Đặc quyền:</span><span class="pj-score-val" style="color: #34d399;">+50 ⭐ đúng hạn</span></div>`;
          actionBtnHTML = `<button type="button" class="pj-action-btn btn-play-ontime" onclick="openQuizStartConfirmModal(${p.phase})">Bắt đầu thi (+50 ⭐)</button>`;
        } else if (p.isCatchUp) {
          cardClass += " card-catch-up";
          chipHTML = '<span class="pj-status-chip chip-catch-up">🔄 LÀM BÙ TUẦN</span>';
          scoreInfoHTML = `<div class="pj-score-box"><span class="pj-score-label">Chế độ:</span><span class="pj-score-val" style="color: #fbbf24;">Làm bù (Không +50⭐)</span></div>`;
          actionBtnHTML = `<button type="button" class="pj-action-btn btn-play-catchup" onclick="openQuizStartConfirmModal(${p.phase})">Làm bù GĐ ${p.phase}</button>`;
        } else {
          cardClass += " card-on-time";
          chipHTML = '<span class="pj-status-chip chip-on-time">🟢 ĐANG MỞ</span>';
          scoreInfoHTML = `<div class="pj-score-box"><span class="pj-score-label">Chặng cuối tuần:</span><span class="pj-score-val">Tối đa 1.100 ⭐</span></div>`;
          actionBtnHTML = `<button type="button" class="pj-action-btn btn-play-ontime" onclick="openQuizStartConfirmModal(${p.phase})">Bắt đầu Giai đoạn 3</button>`;
        }
      } else {
        cardClass += " card-locked";
        const lockLabel = (data.state === "countdown" || data.state === "upcoming") ? "SẮP MỞ CỔNG" : (p.phase > data.phase ? "CHƯA MỞ" : "ĐÃ ĐÓNG CỔNG");
        chipHTML = `<span class="pj-status-chip chip-locked">🔒 ${lockLabel}</span>`;
        scoreInfoHTML = `<div class="pj-score-box"><span class="pj-score-label">Trạng thái:</span><span class="pj-score-val" style="color: #94a3b8;">${lockLabel}</span></div>`;
        actionBtnHTML = `<button type="button" class="pj-action-btn btn-disabled" disabled>${lockLabel}</button>`;
      }

      gridHTML += `
        <div class="${cardClass}">
          <div class="pj-card-top">
            <div>
              <div class="pj-phase-num">Giai đoạn ${p.phase}</div>
              <div class="pj-phase-days">${pDays}</div>
            </div>
            ${chipHTML}
          </div>
          <div class="pj-topic" title="${escapeHTML(p.topic || "")}">${escapeHTML(p.topic || "Nội dung câu hỏi chuyên đề")}</div>
          ${scoreInfoHTML}
          ${actionBtnHTML}
        </div>
      `;
    });
    phasesGrid.innerHTML = gridHTML;
  }

  if (blockedMsg) blockedMsg.style.display = "none";
  if (startBtn) {
    if (data.state === "open") {
      if (data.hasActiveSession) {
        startBtn.disabled = false;
        startBtn.style.opacity = "1";
        startBtn.style.cursor = "pointer";
        const remTime = formatCompSeconds(data.activeRemaining || 600);
        if (startBtnText) startBtnText.textContent = `Tiếp tục bài thi (còn ${remTime})`;
        startBtn.onclick = () => startCompetitionQuiz();
        if (blockedMsg) {
          blockedMsg.style.display = "block";
          blockedMsg.style.color = "#38bdf8";
          blockedMsg.style.background = "rgba(14, 165, 233, 0.12)";
          blockedMsg.style.border = "1px solid rgba(14, 165, 233, 0.35)";
          blockedMsg.style.borderRadius = "8px";
          blockedMsg.style.padding = "8px 12px";
          const exitCount = data.exitCount || 0;
          blockedMsg.innerHTML = `⏸️ <strong>Bài thi đang tạm dừng (Câu ${data.activeQuestionIndex || 1}/10, còn ${remTime}):</strong> Đã sử dụng <strong>${exitCount}/2 lần thoát</strong> (còn ${Math.max(0, 2 - exitCount)} lần). Bấm nút trên để tiếp tục làm bài!`;
        }
      } else if (data.defaultAvailablePhase) {
        startBtn.disabled = false;
        startBtn.style.opacity = "1";
        startBtn.style.cursor = "pointer";
        const targetP = data.defaultAvailablePhase;
        const pObj = (data.phasesStatus || []).find(p => p.phase === targetP);
        if (pObj && pObj.isCatchUp) {
          if (startBtnText) startBtnText.textContent = `Làm bù Giai đoạn ${targetP}`;
        } else if (targetP === 3) {
          if (startBtnText) startBtnText.textContent = `Bắt đầu Giai đoạn 3 (Chặng cuối tuần)`;
        } else {
          if (startBtnText) startBtnText.textContent = `Bắt đầu Giai đoạn ${targetP} (+50 ⭐ đúng hạn)`;
        }
        startBtn.onclick = () => openQuizStartConfirmModal(targetP);
      } else {
        const completedPhases = (data.phasesStatus || []).filter(p => p.isCompleted);
        const targetReviewPhase = (data.phasesStatus || []).find(p => p.phase === data.phase && p.isCompleted)?.phase || completedPhases[completedPhases.length - 1]?.phase || 1;
        startBtn.disabled = false;
        startBtn.style.opacity = "1";
        startBtn.style.cursor = "pointer";
        if (startBtnText) startBtnText.textContent = `Xem lịch sử hoàn thành (GĐ ${targetReviewPhase})`;
        startBtn.onclick = () => openPhaseResultModal(targetReviewPhase);
        if (blockedMsg) {
          blockedMsg.style.display = "block";
          blockedMsg.style.color = "#38bdf8";
          blockedMsg.style.background = "rgba(14, 165, 233, 0.12)";
          blockedMsg.style.border = "1px solid rgba(14, 165, 233, 0.35)";
          blockedMsg.style.borderRadius = "8px";
          blockedMsg.style.padding = "8px 12px";
          blockedMsg.innerHTML = `✅ <strong>Bạn đã hoàn thành lượt thi Giai đoạn ${targetReviewPhase}!</strong> Bấm nút trên hoặc từng thẻ giai đoạn bên dưới để xem lại kết quả bài làm.`;
        }
      }
    } else {
      const isCountdown = (data.state === "countdown" || data.state === "upcoming");
      const currentPhaseStatus = (data.phasesStatus || []).find(p => p.phase === data.phase);
      const hasCompletedCurrent = currentPhaseStatus?.isCompleted || data.userAttempts >= 1;
      const completedPhases = (data.phasesStatus || []).filter(p => p.isCompleted);
      if (hasCompletedCurrent || (completedPhases.length > 0 && !isCountdown)) {
        const targetReviewPhase = (data.phasesStatus || []).find(p => p.phase === data.phase && p.isCompleted)?.phase || completedPhases[completedPhases.length - 1]?.phase || 1;
        startBtn.disabled = false;
        startBtn.style.opacity = "1";
        startBtn.style.cursor = "pointer";
        if (startBtnText) startBtnText.textContent = `Xem lịch sử hoàn thành (GĐ ${targetReviewPhase})`;
        startBtn.onclick = () => openPhaseResultModal(targetReviewPhase);
        if (blockedMsg) {
          blockedMsg.style.display = "block";
          blockedMsg.style.color = "#38bdf8";
          blockedMsg.style.background = "rgba(14, 165, 233, 0.12)";
          blockedMsg.style.border = "1px solid rgba(14, 165, 233, 0.35)";
          blockedMsg.style.borderRadius = "8px";
          blockedMsg.style.padding = "8px 12px";
          blockedMsg.innerHTML = `✅ <strong>Bạn đã hoàn thành lượt thi Giai đoạn ${targetReviewPhase}!</strong> Bấm nút trên hoặc từng thẻ giai đoạn bên dưới để xem lại kết quả bài làm.`;
        }
      } else {
        startBtn.disabled = true;
        startBtn.style.opacity = "0.6";
        startBtn.style.cursor = "not-allowed";
        startBtn.onclick = null;
        if (isCountdown) {
          if (startBtnText) startBtnText.textContent = "Cổng chưa mở (Mở lúc 19:00)";
          if (blockedMsg) {
            blockedMsg.style.display = "block";
            blockedMsg.style.color = "";
            blockedMsg.style.background = "";
            blockedMsg.style.border = "";
            blockedMsg.style.borderRadius = "";
            blockedMsg.style.padding = "";
            blockedMsg.textContent = "Cổng trả lời sẽ mở từ 19h00 đến 23h00. Vui lòng quay lại đúng giờ!";
          }
        } else {
          if (startBtnText) startBtnText.textContent = "Cổng thi đấu đang đóng";
          if (blockedMsg) {
            blockedMsg.style.display = "block";
            blockedMsg.style.color = "";
            blockedMsg.style.background = "";
            blockedMsg.style.border = "";
            blockedMsg.style.borderRadius = "";
            blockedMsg.style.padding = "";
            blockedMsg.textContent = "Hệ thống đang trong khung giờ tổng kết. Bạn có thể xem bảng xếp hạng tạm thời.";
          }
        }
      }
    }
  }

  if (compState.gatewayTimerInterval) clearInterval(compState.gatewayTimerInterval);
  let localSec = data.remainingSeconds || 0;
  if (clockDigits) clockDigits.textContent = formatCompSeconds(localSec);

  compState.gatewayTimerInterval = setInterval(() => {
    localSec--;
    if (localSec <= 0) {
      clearInterval(compState.gatewayTimerInterval);
      openCompetitionModal(compState.activeTab);
    } else {
      if (clockDigits) clockDigits.textContent = formatCompSeconds(localSec);
    }
  }, 1000);
}

async function switchLbPhase(phase) {
  compState.activeLbPhase = String(phase);
  $$(".lb-phase-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.lbPhase === String(phase));
  });
  await loadAndRenderLeaderboard(phase);
}

async function loadAndRenderLeaderboard(phase, forceRefresh = false) {
  const podiumWrap = $("#compPodiumWrap");
  const lbList = $("#compLbList");
  const noticeEl = $("#lbSummaryNotice");

  // In reviewing / summary time (or if data already cached and not forceRefresh):
  // Return cached leaderboard immediately to avoid reloading every 30s!
  if (!forceRefresh && compState.cachedLeaderboard && compState.cachedLeaderboard[phase]) {
    const cachedData = compState.cachedLeaderboard[phase];
    if (noticeEl) {
      if (String(phase) === "week" || cachedData.phase === "week") {
        const weekNum = String(cachedData.weekNumber || 1).padStart(2, "0");
        noticeEl.textContent = `Bảng xếp hạng tuần ${weekNum}`;
      } else {
        noticeEl.textContent = "Bảng xếp hạng giai đoạn";
      }
    }
    renderLeaderboardUI(cachedData);
    return;
  }

  if (podiumWrap) podiumWrap.innerHTML = `<div style="text-align:center; padding: 24px; color: var(--muted);">Đang tải bảng xếp hạng...</div>`;
  if (lbList) lbList.innerHTML = "";

  try {
    const data = await requestAPI(`/api/competition/leaderboard?phase=${phase}`);
    compState.cachedLeaderboard[phase] = data;
    if (data.resultsVersion) {
      compState.lastResultsVersion = data.resultsVersion;
    }

    if (noticeEl) {
      if (String(phase) === "week" || data.phase === "week") {
        const weekNum = String(data.weekNumber || 1).padStart(2, "0");
        noticeEl.textContent = `Bảng xếp hạng tuần ${weekNum}`;
      } else {
        noticeEl.textContent = "Bảng xếp hạng giai đoạn";
      }
    }

    renderLeaderboardUI(data);
  } catch (e) {
    if (podiumWrap) podiumWrap.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--muted);">${e.message || "Không thể tải bảng xếp hạng"}</div>`;
  }
}

window.refreshArenaLeaderboard = async function() {
  const btn = $("#lbRefreshBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Đang tải...";
  }
  compState.cachedLeaderboard = {};
  await loadAndRenderLeaderboard(compState.activeLbPhase || 1, true);
  if (btn) {
    btn.disabled = false;
    btn.textContent = "🔄 Làm mới";
  }
};

function renderLeaderboardUI(data) {
  const podiumWrap = $("#compPodiumWrap");
  const lbList = $("#compLbList");
  if (!podiumWrap || !lbList) return;

  if (data.canShow === false) {
    podiumWrap.innerHTML = `
      <div class="comp-lb-waiting-wrap" style="text-align: center; padding: 48px 20px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.12); border-radius: 16px; margin: 24px 0;">
        <div style="font-size: 40px; margin-bottom: 12px;">⏳</div>
        <div style="font-size: 20px; font-weight: 700; color: var(--text); margin-bottom: 8px;">Chờ chút nhé</div>
        <div style="font-size: 14px; color: var(--muted); max-width: 420px; margin: 0 auto; line-height: 1.6;">
          Bảng xếp hạng chỉ xuất hiện thông tin khi tới giờ tổng kết sau khi đóng cổng thi.
        </div>
      </div>
    `;
    lbList.innerHTML = "";
    return;
  }

  const top10 = data.top10 || [];
  const currentUserEntry = data.currentUserEntry;

  if (top10.length === 0) {
    podiumWrap.innerHTML = `<div class="comp-lb-empty">Chưa có thành viên nào hoàn thành lượt thi trong giai đoạn này.</div>`;
    lbList.innerHTML = "";
    return;
  }

  const top1 = top10.find(u => u.rank === 1);
  const top2 = top10.find(u => u.rank === 2);
  const top3 = top10.find(u => u.rank === 3);

  let podiumHTML = "";

  if (top2) {
    const top2AvatarClass = getAvatarClass(top2.streakTier, false, top2.role);
    const top2NameClass = getNameClass(top2.streakTier);
    podiumHTML += `
      <div class="podium-col rank-2">
        <div class="podium-avatar-wrap">
          <span class="podium-crown silver">🥈</span>
          <div class="podium-avatar avatar ${top2AvatarClass}">${escapeHTML(top2.avatar || top2.initials || "U")}</div>
        </div>
        <div class="podium-name ${top2NameClass}" title="${escapeHTML(top2.displayName)}">${getFlameSVG(top2.streakTier, 14)} <span>${escapeHTML(top2.displayName)}</span></div>
        <div class="podium-score">⭐ ${top2.score}</div>
        <div class="podium-stand stand-2">
          <span class="stand-num">2</span>
        </div>
      </div>
    `;
  } else {
    podiumHTML += `<div class="podium-col rank-2 empty"></div>`;
  }

  if (top1) {
    const top1AvatarClass = getAvatarClass(top1.streakTier, false, top1.role);
    const top1NameClass = getNameClass(top1.streakTier);
    podiumHTML += `
      <div class="podium-col rank-1">
        <div class="podium-avatar-wrap">
          <span class="podium-crown gold">👑</span>
          <div class="podium-avatar rank-1-avatar avatar avatar-lg ${top1AvatarClass}">${escapeHTML(top1.avatar || top1.initials || "U")}</div>
        </div>
        <div class="podium-name font-bold ${top1NameClass}" title="${escapeHTML(top1.displayName)}">${getFlameSVG(top1.streakTier, 16)} <span>${escapeHTML(top1.displayName)}</span></div>
        <div class="podium-score gold-score">⭐ ${top1.score}</div>
        <div class="podium-stand stand-1">
          <span class="stand-num">1</span>
        </div>
      </div>
    `;
  }

  if (top3) {
    const top3AvatarClass = getAvatarClass(top3.streakTier, false, top3.role);
    const top3NameClass = getNameClass(top3.streakTier);
    podiumHTML += `
      <div class="podium-col rank-3">
        <div class="podium-avatar-wrap">
          <span class="podium-crown bronze">🥉</span>
          <div class="podium-avatar avatar ${top3AvatarClass}">${escapeHTML(top3.avatar || top3.initials || "U")}</div>
        </div>
        <div class="podium-name ${top3NameClass}" title="${escapeHTML(top3.displayName)}">${getFlameSVG(top3.streakTier, 14)} <span>${escapeHTML(top3.displayName)}</span></div>
        <div class="podium-score">⭐ ${top3.score}</div>
        <div class="podium-stand stand-3">
          <span class="stand-num">3</span>
        </div>
      </div>
    `;
  } else {
    podiumHTML += `<div class="podium-col rank-3 empty"></div>`;
  }

  podiumWrap.innerHTML = podiumHTML;

  const rest = top10.filter(u => u.rank >= 4);
  let rowsHTML = "";

  rest.forEach(u => {
    const isCurrent = currentUserEntry && currentUserEntry.userId === u.userId;
    const avatarClass = getAvatarClass(u.streakTier, false, u.role);
    const nameClass = getNameClass(u.streakTier);
    rowsHTML += `
      <div class="comp-lb-row ${isCurrent ? "is-current-user" : ""}">
        <span class="comp-lb-rank">#${u.rank}</span>
        <div class="comp-lb-user">
          <span class="avatar avatar-sm ${avatarClass}">${escapeHTML(u.avatar || u.initials || "U")}</span>
          <span class="comp-lb-name ${nameClass}">${getFlameSVG(u.streakTier, 15)} <span class="lb-name-text">${escapeHTML(u.displayName)}</span> ${isCurrent ? '<span class="you-tag">(Bạn)</span>' : ""}</span>
        </div>
        <span class="comp-lb-score">⭐ ${u.score}</span>
      </div>
    `;
  });

  if (currentUserEntry && currentUserEntry.rank > 10) {
    const myAvatarClass = getAvatarClass(currentUserEntry.streakTier, false, currentUserEntry.role);
    const myNameClass = getNameClass(currentUserEntry.streakTier);
    rowsHTML += `
      <div class="comp-lb-row is-current-user top-11-plus-row">
        <span class="comp-lb-rank">#${currentUserEntry.rank}</span>
        <div class="comp-lb-user">
          <span class="avatar avatar-sm ${myAvatarClass}">${escapeHTML(currentUserEntry.avatar || currentUserEntry.initials || "U")}</span>
          <span class="comp-lb-name ${myNameClass}">${getFlameSVG(currentUserEntry.streakTier, 15)} <span class="lb-name-text">${escapeHTML(currentUserEntry.displayName)}</span> <span class="you-tag">(Bạn)</span></span>
        </div>
        <span class="comp-lb-score">⭐ ${currentUserEntry.score}</span>
      </div>
    `;
  }

  lbList.innerHTML = rowsHTML;
}

function openQuizStartConfirmModal(phase) {
  if (!session) {
    openAuth();
    return;
  }
  const modal = $("#quizStartConfirmModal");
  if (!modal) return;

  const currentPhase = compState.overview?.phase || 1;
  const isSunday = Boolean(compState.overview?.isSunday);
  const targetPhase = Number(phase || currentPhase);

  const phaseObj = (compState.overview?.phasesStatus || []).find(p => p.phase === targetPhase);
  if (phaseObj && phaseObj.isCompleted) {
    toast(`Bạn đã hoàn thành bài thi Giai đoạn ${targetPhase} rồi (1/1 lượt).`);
    return;
  }

  compState.pendingStartPhase = targetPhase;

  const titleEl = $("#quizStartTitle");
  const phaseTagEl = $("#quizStartPhaseTag");
  const promptTextEl = $("#quizStartPromptText");
  const bonusCardEl = $("#quizStartBonusCard");
  const proceedBtnEl = $("#quizStartProceedBtn");

  const daysText = targetPhase === 1 ? "Thứ Hai – Thứ Ba" : (targetPhase === 2 ? "Thứ Tư – Thứ Năm" : "Thứ Sáu – Thứ Bảy");
  if (titleEl) titleEl.textContent = `Xác nhận lượt thi - Giai đoạn ${targetPhase}`;
  if (phaseTagEl) phaseTagEl.textContent = `Giai đoạn ${targetPhase} (${daysText})`;

  // Mandatory prompt required by user
  if (promptTextEl) {
    promptTextEl.textContent = "Bạn chỉ có 1 lượt thi duy nhất cho giai đoạn này, bắt đầu thi chứ?";
  }

  const isOnTime = (targetPhase === currentPhase && (targetPhase === 1 || targetPhase === 2) && !isSunday);
  const isCatchUp = targetPhase < currentPhase;

  if (bonusCardEl) {
    if (isOnTime) {
      bonusCardEl.className = "quiz-start-bonus-card on-time";
      bonusCardEl.innerHTML = `
        <span style="font-size: 22px;">🎁</span>
        <div>
          <strong>ĐẶC QUYỀN ĐÚNG HẠN: +50 ⭐ THƯỞNG THÊM!</strong><br>
          Bạn đang tham gia đúng hạn Giai đoạn ${targetPhase}. Hệ thống sẽ cộng thêm <strong>+50 ⭐</strong> vào tổng điểm khi bạn hoàn thành bài thi! (Tối đa toàn bài: <strong>1.150 ⭐</strong>).
        </div>
      `;
    } else if (isCatchUp) {
      bonusCardEl.className = "quiz-start-bonus-card catch-up";
      bonusCardEl.innerHTML = `
        <span style="font-size: 22px;">🔄</span>
        <div>
          <strong>LƯỢT LÀM BÙ TRONG TUẦN</strong><br>
          Bạn đang làm bù Giai đoạn ${targetPhase} đã qua. Bạn vẫn được tính điểm bài thi bình thường (tối đa <strong>1.100 ⭐</strong>), nhưng <em>không nhận điểm thưởng đúng hạn (+50 ⭐)</em>.
        </div>
      `;
    } else {
      bonusCardEl.className = "quiz-start-bonus-card final-phase";
      bonusCardEl.innerHTML = `
        <span style="font-size: 22px;">🏁</span>
        <div>
          <strong>GIAI ĐOẠN 3 - CHẶNG CUỐI TUẦN</strong><br>
          Đây là giai đoạn cuối cùng trước khi tổng kết trao giải vào Chủ Nhật. Lỡ giai đoạn này sẽ <strong>không có cơ hội làm bù</strong>! Điểm tối đa: <strong>1.100 ⭐</strong>.
        </div>
      `;
    }
  }

  if (proceedBtnEl) {
    proceedBtnEl.innerHTML = isOnTime ? "Bắt đầu thi (+50 ⭐)" : (isCatchUp ? `Bắt đầu làm bù GĐ ${targetPhase}` : "Bắt đầu thi ngay");
  }

  modal.showModal();
}

function closeQuizStartConfirmModal() {
  const modal = $("#quizStartConfirmModal");
  if (modal) modal.close();
  compState.pendingStartPhase = null;
}

async function proceedStartQuizSession() {
  const targetPhase = compState.pendingStartPhase || compState.overview?.defaultAvailablePhase || compState.overview?.phase || 1;
  closeQuizStartConfirmModal();
  await executeStartQuizSession(targetPhase);
}

async function startCompetitionQuiz(targetPhase) {
  if (!session) {
    openAuth();
    return;
  }

  // If user has an active paused session, resume directly without prompt
  if (compState.overview?.hasActiveSession) {
    await executeStartQuizSession(targetPhase);
    return;
  }

  const phase = targetPhase || compState.overview?.defaultAvailablePhase;
  if (!phase) {
    toast("Bạn đã hoàn thành các lượt thi khả dụng tuần này.");
    return;
  }

  const phaseObj = (compState.overview?.phasesStatus || []).find(p => p.phase === Number(phase));
  if (phaseObj && phaseObj.isCompleted) {
    toast(`Bạn đã hoàn thành bài thi Giai đoạn ${phase} rồi (1/1 lượt).`);
    return;
  }

  openQuizStartConfirmModal(phase);
}

async function executeStartQuizSession(targetPhase) {
  try {
    const payload = {};
    if (targetPhase) payload.phase = Number(targetPhase);

    const res = await requestAPI("/api/competition/session/start", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    compState.sessionToken = res.sessionToken;
    compState.activeQuestions = res.questions || [];
    compState.currentQIndex = res.currentQuestionIndex ? Math.max(0, res.currentQuestionIndex - 1) : 0;
    compState.questionTries = res.currentTriesCount || 0;
    const rawRemSec = typeof res.remainingSeconds === "number" ? res.remainingSeconds : (res.durationSeconds || 600);
    compState.quizRemainingSeconds = Math.min(600, Math.max(0, rawRemSec));
    compState.exitCount = res.exitCount || 0;
    compState.quizLiveStars = (res.correctPoints || 0) + (res.firstTryBonus || 0);
    compState.quizTotalCorrect = res.correctCount || 0;
    compState.quizFirstTryBonusCount = res.firstTryCorrectCount || 0;
    compState.isSubmittingAnswer = false;
    compState.initialDisabledOptions = Array.isArray(res.disabledOptions) ? res.disabledOptions : [];
    compState.currentSessionPhase = res.phase;
    compState.potentialOnTimeBonus = res.potentialOnTimeBonus || 0;

    closeCompetitionModal();
    const quizModal = $("#competitionQuizModal");
    if (!quizModal) return;

    $("#quizPlayView").style.display = "block";
    $("#quizResultView").style.display = "none";
    if (res.phase) {
      const phaseBadge = $("#quizPhaseBadge");
      const bonusTag = res.isOnTime ? " (+50⭐ đúng hạn)" : (res.isCatchUp ? " (Làm bù)" : "");
      if (phaseBadge) phaseBadge.textContent = `Giai đoạn ${res.phase}${bonusTag}`;
    }

    quizModal.showModal();
    renderQuizQuestion();
    startQuizTimer();
  } catch (e) {
    toast(e.message || "Không thể bắt đầu lượt thi.");
  }
}

function promptQuizExit() {
  const exitModal = $("#quizExitConfirmModal");
  if (!exitModal) return;

  const timeLeftEl = $("#quizExitTimeLeft");
  const currentQEl = $("#quizExitCurrentQ");
  const currentStarsEl = $("#quizExitCurrentStars");
  const exitCountEl = $("#quizExitCountBadge");
  const guaranteeCard = $("#quizExitGuaranteeCard");
  const guaranteeText = $("#quizExitGuaranteeText");
  const confirmBtn = $("#quizExitConfirmBtn");
  const exitBadgeIcon = $("#quizExitBadgeIcon");
  const exitTitle = $("#quizExitTitle");
  const exitSubTitle = $("#quizExitSubTitle");

  const currentExits = compState.exitCount || 0;
  const isFinalExit = currentExits >= 2;

  if (timeLeftEl) {
    timeLeftEl.textContent = formatCompSeconds(compState.quizRemainingSeconds || 0);
  }
  if (currentQEl) {
    const totalQ = compState.activeQuestions?.length || 10;
    currentQEl.textContent = `Câu ${compState.currentQIndex + 1} / ${totalQ}`;
  }
  if (currentStarsEl) {
    currentStarsEl.textContent = `⭐ ${compState.quizLiveStars || 0}`;
  }
  if (exitCountEl) {
    exitCountEl.textContent = `${currentExits} / 2`;
    exitCountEl.style.color = isFinalExit ? "#ef4444" : "#38bdf8";
  }

  if (isFinalExit) {
    if (exitBadgeIcon) exitBadgeIcon.textContent = "🚨";
    if (exitTitle) exitTitle.textContent = "Cảnh báo thoát lần 3";
    if (exitSubTitle) exitSubTitle.textContent = "Hệ thống sẽ dừng và tính điểm bài thi luôn!";
    if (guaranteeCard) {
      guaranteeCard.className = "quiz-exit-guarantee-card danger-mode";
    }
    if (guaranteeText) {
      guaranteeText.innerHTML = `
        <strong style="color: #f87171; font-size: 14px;">🚨 CẢNH BÁO: ĐÃ HẾT LƯỢT THOÁT CHO PHÉP!</strong><br>
        Bạn đã sử dụng đủ <strong>2/2 lần thoát</strong>. Nếu bạn xác nhận thoát bây giờ (lần thứ 3), hệ thống sẽ <strong>DỪNG VÀ TÍNH ĐIỂM BÀI THI NGAY LẬP TỨC</strong> theo kết quả các câu đã làm (lượt thi này sẽ kết thúc hoàn toàn)!<br>
        <span style="font-size: 12px; color: #fca5a5; margin-top: 4px; display: inline-block;">💡 <em>Khuyên bạn nên bấm "Tiếp tục làm bài ngay" để không bị mất lượt thi này!</em></span>
      `;
    }
    if (confirmBtn) {
      confirmBtn.className = "button quiz-exit-confirm-btn danger-confirm-btn";
      confirmBtn.innerHTML = `🔴 Dừng bài thi & Nộp điểm ngay`;
    }
  } else {
    if (exitBadgeIcon) exitBadgeIcon.textContent = "⏸️";
    if (exitTitle) exitTitle.textContent = "Tạm dừng & Thoát bài thi";
    if (exitSubTitle) exitSubTitle.textContent = "Lưu tiến trình & tạm dừng đồng hồ khi ra màn hình chính";
    if (guaranteeCard) {
      guaranteeCard.className = "quiz-exit-guarantee-card pause-mode";
    }
    if (guaranteeText) {
      const exitsAfter = 1 - currentExits;
      guaranteeText.innerHTML = `
        <strong>⏸️ Tạm dừng thời gian & Lưu tiến trình:</strong><br>
        Khi bạn bấm xác nhận thoát ra màn hình chính, thời gian sẽ được <strong>TẠM DỪNG</strong> và lưu lại toàn bộ tiến trình. Lượt thi này <em>KHÔNG bị tính là mất</em>.<br>
        ⚠️ <strong>Giới hạn:</strong> Bạn chỉ được thoát tối đa <strong>2 lần</strong> (sau lần này còn <strong>${exitsAfter}</strong> lần). Nếu thoát lần thứ 3, hệ thống sẽ dừng và tính điểm bài thi luôn!<br>
        <span style="font-size: 12px; color: #f59e0b; margin-top: 4px; display: inline-block;">⏱️ <em>Lưu ý: Trong lúc đang mở bảng này (chưa bấm xác nhận thoát), đồng hồ vẫn tiếp tục đếm ngược để chống gian lận!</em></span>
      `;
    }
    if (confirmBtn) {
      confirmBtn.className = "button button-outline quiz-exit-confirm-btn";
      confirmBtn.innerHTML = `Thoát & Tạm dừng thời gian`;
    }
  }

  exitModal.showModal();
}

function cancelQuizExit() {
  const exitModal = $("#quizExitConfirmModal");
  if (exitModal && exitModal.open) {
    exitModal.close();
  }
}

async function confirmQuizExit() {
  const confirmBtn = $("#quizExitConfirmBtn");
  const originalText = confirmBtn ? confirmBtn.innerHTML : "Thoát & Tạm dừng thời gian";
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `⏳ Đang xử lý...`;
  }

  let res = null;
  try {
    if (compState.sessionToken) {
      res = await requestAPI("/api/competition/session/pause", {
        method: "POST",
        body: JSON.stringify({
          sessionToken: compState.sessionToken
        })
      });
    }
  } catch (err) {
    console.warn("Lỗi khi thoát phiên thi đấu:", err);
  }

  if (compState.quizTimerInterval) {
    clearInterval(compState.quizTimerInterval);
    compState.quizTimerInterval = null;
  }

  const exitModal = $("#quizExitConfirmModal");
  if (exitModal && exitModal.open) exitModal.close();

  const quizModal = $("#competitionQuizModal");
  if (quizModal && quizModal.open) quizModal.close();

  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = originalText;
  }

  if (res && res.completed && res.forcedSubmit) {
    toast(res.message || "⚠️ Đã dừng và tính điểm bài thi do thoát lần thứ 3!");
    if (res.result) {
      renderQuizFinalResult(res.result);
      if (quizModal) quizModal.showModal();
    }
  } else {
    compState.exitCount = res?.exitCount ?? ((compState.exitCount || 0) + 1);
    toast(res?.message || `⏸️ Đã lưu tiến trình câu hỏi và tạm dừng thời gian. Bạn còn ${Math.max(0, 2 - compState.exitCount)} lần thoát.`);
  }

  if (typeof loadWeeklyCompetitionOverview === "function") {
    loadWeeklyCompetitionOverview();
  }
}

function startQuizTimer() {
  if (compState.quizTimerInterval) clearInterval(compState.quizTimerInterval);

  updateQuizTimerUI();
  compState.quizTimerInterval = setInterval(() => {
    compState.quizRemainingSeconds--;
    if (compState.quizRemainingSeconds <= 0) {
      compState.quizRemainingSeconds = 0;
      updateQuizTimerUI();
      clearInterval(compState.quizTimerInterval);
      toast("⏱️ Đã hết 10 phút làm bài!");
      finishQuizSessionTimeExpired();
    } else {
      updateQuizTimerUI();
    }
  }, 1000);
}

function updateQuizTimerUI() {
  const digits = $("#quizTimerDigits");
  const bar = $("#quizTimerProgressBar");
  const displayWrap = $("#quizTimerDisplay");

  const sec = Math.min(600, Math.max(0, Number(compState.quizRemainingSeconds) || 0));
  compState.quizRemainingSeconds = sec;
  const timeFormatted = formatCompSeconds(sec);
  if (digits) digits.textContent = timeFormatted;

  // Live update exit modal time counter if open
  const exitTimeLeftEl = $("#quizExitTimeLeft");
  if (exitTimeLeftEl) exitTimeLeftEl.textContent = timeFormatted;

  const pct = Math.max(0, Math.min(100, (sec / 600) * 100));
  if (bar) {
    bar.style.width = `${pct}%`;
    if (sec <= 60) {
      bar.classList.add("is-danger");
      if (displayWrap) displayWrap.classList.add("low-time");
    } else {
      bar.classList.remove("is-danger");
      if (displayWrap) displayWrap.classList.remove("low-time");
    }
  }

  const starsBadge = $("#quizLiveStars");
  if (starsBadge) starsBadge.textContent = `⭐ ${compState.quizLiveStars}`;
}

function renderQuizQuestion() {
  const q = compState.activeQuestions[compState.currentQIndex];
  if (!q) return;

  const counter = $("#quizQuestionCounter");
  const questionText = $("#quizQuestionText");
  const optA = $("#quizOptA");
  const optB = $("#quizOptB");
  const optC = $("#quizOptC");

  if (counter) counter.textContent = `Câu ${compState.currentQIndex + 1} / ${compState.activeQuestions.length}`;
  if (questionText) questionText.textContent = q.questionText;
  if (optA) optA.textContent = q.optionA;
  if (optB) optB.textContent = q.optionB;
  if (optC) optC.textContent = q.optionC;

  updateTriesUI(compState.questionTries || 0);

  const disabledOpts = compState.initialDisabledOptions || [];
  $$(".quiz-option-btn").forEach(btn => {
    const opt = btn.getAttribute("data-option");
    if (disabledOpts.includes(opt)) {
      btn.disabled = true;
      btn.className = "quiz-option-btn opt-wrong";
      btn.style.pointerEvents = "none";
    } else {
      btn.disabled = false;
      btn.className = "quiz-option-btn";
      btn.style.pointerEvents = "auto";
    }
  });
  compState.initialDisabledOptions = [];

  compState.isSubmittingAnswer = false;
}

function updateTriesUI(triesUsed) {
  const triesDots = $$("#quizTriesPill .tries-dot");
  const triesText = $("#quizTriesText");

  triesDots.forEach((dot, idx) => {
    dot.className = "tries-dot";
    if (idx < triesUsed) {
      dot.classList.add("used");
    } else if (idx === triesUsed) {
      dot.classList.add("active");
    }
  });

  if (triesText) {
    if (triesUsed === 0) {
      triesText.textContent = "Lần thử 1/3 (Sai: -30s)";
    } else if (triesUsed === 1) {
      triesText.textContent = "Lần thử 2/3 (Sai: -30s)";
    } else if (triesUsed === 2) {
      triesText.textContent = "Lần thử cuối 3/3!";
    }
  }
}

async function submitQuizAnswer(selectedOption) {
  if (compState.isSubmittingAnswer) return;
  const q = compState.activeQuestions[compState.currentQIndex];
  if (!q) return;

  compState.isSubmittingAnswer = true;
  const btn = document.querySelector(`.quiz-option-btn[data-option="${selectedOption}"]`);

  try {
    const res = await requestAPI("/api/competition/session/answer", {
      method: "POST",
      body: JSON.stringify({
        sessionToken: compState.sessionToken,
        questionId: q.id,
        selectedOption: selectedOption,
        answerIndex: compState.questionTries + 1
      })
    });

    if (res.isCorrect) {
      if (btn) btn.classList.add("opt-correct");
      playCompSound("correct");

      const bonusToast = $("#quizBonusToast");
      if (bonusToast) {
        bonusToast.textContent = res.isFirstTryBonus ? `+${res.pointsEarned} ⭐ (Thưởng lần đầu!)` : `+${res.pointsEarned} ⭐`;
        bonusToast.style.display = "block";
        setTimeout(() => { bonusToast.style.display = "none"; }, 1200);
      }

      compState.quizLiveStars += res.pointsEarned;
      compState.quizTotalCorrect++;
      if (res.isFirstTryBonus) compState.quizFirstTryBonusCount++;
      if (typeof res.remainingTime === "number") {
        compState.quizRemainingSeconds = Math.min(600, Math.max(0, res.remainingTime));
      } else if (typeof res.remainingSeconds === "number") {
        compState.quizRemainingSeconds = Math.min(600, Math.max(0, res.remainingSeconds));
      }
      updateQuizTimerUI();

      setTimeout(() => {
        if (res.isQuizCompleted || compState.currentQIndex >= compState.activeQuestions.length - 1) {
          showQuizFinalResult(res.finalResult);
        } else {
          compState.currentQIndex++;
          compState.questionTries = 0;
          renderQuizQuestion();
        }
      }, 700);

    } else {
      if (btn) {
        btn.classList.add("opt-wrong");
        btn.disabled = true;
      }
      playCompSound("wrong");

      const penaltyToast = $("#quizPenaltyToast");
      if (penaltyToast) {
        penaltyToast.textContent = "-30 GIÂY ⏱️";
        penaltyToast.style.display = "block";
        setTimeout(() => { penaltyToast.style.display = "none"; }, 1200);
      }

      if (typeof res.remainingTime === "number") {
        compState.quizRemainingSeconds = Math.min(600, Math.max(0, res.remainingTime));
      } else if (typeof res.remainingSeconds === "number") {
        compState.quizRemainingSeconds = Math.min(600, Math.max(0, res.remainingSeconds));
      } else {
        compState.quizRemainingSeconds = Math.min(600, Math.max(0, compState.quizRemainingSeconds - 30));
      }
      updateQuizTimerUI();

      compState.questionTries++;

      if (res.isQuizCompleted || compState.quizRemainingSeconds <= 0) {
        setTimeout(() => {
          showQuizFinalResult(res.finalResult);
        }, 800);
      } else if (res.isLocked || compState.questionTries >= 3) {
        toast("❌ Đã hết 3 lần thử ở câu này! Chuyển sang câu tiếp theo.");
        setTimeout(() => {
          if (compState.currentQIndex >= compState.activeQuestions.length - 1) {
            showQuizFinalResult(res.finalResult);
          } else {
            compState.currentQIndex++;
            compState.questionTries = 0;
            renderQuizQuestion();
          }
        }, 900);
      } else {
        updateTriesUI(compState.questionTries);
        compState.isSubmittingAnswer = false;
      }
    }
  } catch (e) {
    toast(e.message || "Lỗi khi nộp câu trả lời.");
    compState.isSubmittingAnswer = false;
  }
}

async function finishQuizSessionTimeExpired() {
  try {
    const res = await requestAPI("/api/competition/session/answer", {
      method: "POST",
      body: JSON.stringify({
        sessionToken: compState.sessionToken,
        questionId: compState.activeQuestions[compState.currentQIndex]?.id || 0,
        selectedOption: "TIMEOUT",
        answerIndex: 1
      })
    });
    showQuizFinalResult(res.finalResult);
  } catch (e) {
    showQuizFinalResult({
      totalScore: compState.quizLiveStars,
      correctPoints: compState.quizTotalCorrect * 40,
      firstTryBonusPoints: compState.quizFirstTryBonusCount * 10,
      timePoints: 0,
      correctAnswersCount: compState.quizTotalCorrect,
      firstTryCount: compState.quizFirstTryBonusCount,
      remainingSeconds: 0,
      phaseBestScore: compState.quizLiveStars
    });
  }
}

function showQuizFinalResult(result, options = {}) {
  if (compState.quizTimerInterval) clearInterval(compState.quizTimerInterval);

  $("#quizPlayView").style.display = "none";
  $("#quizResultView").style.display = "block";

  const isHistorical = Boolean(options.isHistorical || result?.isHistorical);
  const titleEl = $("#quizResultTitle");
  const subtitleEl = $("#resultSubtitle");

  if (titleEl) {
    if (isHistorical) {
      const phaseNum = options.phase || result?.phase;
      titleEl.textContent = phaseNum ? `KẾT QUẢ GIAI ĐOẠN ${phaseNum}` : "LỊCH SỬ KẾT QUẢ BÀI THI";
    } else {
      titleEl.textContent = "KẾT THÚC LƯỢT THI";
    }
  }

  if (subtitleEl) {
    if (isHistorical) {
      const phaseNum = options.phase || result?.phase;
      const daysText = phaseNum === 1 ? "Thứ Hai – Thứ Ba" : (phaseNum === 2 ? "Thứ Tư – Thứ Năm" : "Thứ Sáu – Thứ Bảy");
      subtitleEl.textContent = `Kết quả chính thức bài thi Giai đoạn ${phaseNum || ""}${phaseNum ? ` (${daysText})` : ""}`;
    } else {
      subtitleEl.textContent = "Chúc mừng bạn đã hoàn thành bài thi!";
    }
  }

  const totalScore = result?.totalScore ?? compState.quizLiveStars;
  const correctCount = result?.correctAnswersCount ?? compState.quizTotalCorrect;
  const correctPts = result?.correctPoints ?? (correctCount * 40);
  const firstTryCount = result?.firstTryCount ?? compState.quizFirstTryBonusCount;
  const firstTryPts = result?.firstTryBonusPoints ?? (firstTryCount * 10);
  const remainingSec = result?.remainingSeconds ?? compState.quizRemainingSeconds;
  const timePts = result?.timePoints ?? remainingSec;
  const curPhase = Number(options.phase || result?.phase || compState.currentQuizSession?.phase || 1);
  const maxScore = (curPhase === 3) ? 1100 : 1150;
  if ($("#resultMaxScoreLabel")) $("#resultMaxScoreLabel").textContent = `/ ${maxScore}`;

  if ($("#resultTotalScore")) $("#resultTotalScore").textContent = totalScore;
  if ($("#resultCorrectCount")) $("#resultCorrectCount").textContent = `${correctCount} / 10`;
  if ($("#resultCorrectPts")) $("#resultCorrectPts").textContent = `+${correctPts} ⭐`;
  if ($("#resultFirstTryCount")) $("#resultFirstTryCount").textContent = `${firstTryCount} / 10`;
  if ($("#resultFirstTryPts")) $("#resultFirstTryPts").textContent = `+${firstTryPts} ⭐`;
  if ($("#resultRemainingTime")) $("#resultRemainingTime").textContent = `${remainingSec} giây`;
  if ($("#resultTimePts")) $("#resultTimePts").textContent = `+${timePts} ⭐`;

  const onTimeBonus = result?.onTimeBonus ?? 0;
  const bonusStatus = $("#resultOnTimeBonusStatus");
  const bonusPts = $("#resultOnTimeBonusPts");
  if (bonusStatus && bonusPts) {
    if (onTimeBonus > 0) {
      bonusStatus.textContent = "Đúng hạn GĐ";
      bonusStatus.style.color = "#34d399";
      bonusPts.textContent = `+${onTimeBonus} ⭐`;
      bonusPts.style.color = "#34d399";
    } else {
      bonusStatus.textContent = "Làm bù / GĐ 3";
      bonusStatus.style.color = "#94a3b8";
      bonusPts.textContent = "+0 ⭐";
      bonusPts.style.color = "#94a3b8";
    }
  }

  if ($("#resultPhaseRecordText")) {
    const bonusTag = onTimeBonus > 0 ? " (Đã gồm thưởng đúng hạn)" : "";
    $("#resultPhaseRecordText").textContent = `${totalScore} ⭐${bonusTag}`;
  }

  if (!isHistorical) {
    playCompSound("victory");
    launchQuizConfetti();
  }
  compState.cachedLeaderboard = {};
  loadWeeklyCompetitionStatus();
  if (typeof loadWeeklyCompetitionOverview === "function") {
    loadWeeklyCompetitionOverview();
  }
}

async function openPhaseResultModal(phase) {
  if (!session) {
    openAuth();
    return;
  }
  try {
    const res = await requestAPI(`/api/competition/phase/result?phase=${phase}`);
    if (!res || !res.result) {
      toast(`Không tìm thấy kết quả bài thi của Giai đoạn ${phase}.`);
      return;
    }
    const quizModal = $("#competitionQuizModal");
    if (!quizModal) return;

    showQuizFinalResult(res.result, { isHistorical: true, phase });
    if (!quizModal.open) {
      quizModal.showModal();
    }
  } catch (e) {
    toast(e.message || `Không thể tải kết quả bài thi Giai đoạn ${phase}.`);
  }
}

function closeQuizAndGoHome() {
  const modal = $("#competitionQuizModal");
  if (modal) modal.close();
  if (compState.confettiAnimationId) cancelAnimationFrame(compState.confettiAnimationId);
  loadWeeklyCompetitionStatus();
  if (typeof loadWeeklyCompetitionOverview === "function") {
    loadWeeklyCompetitionOverview();
  }
}

function closeQuizAndOpenLeaderboard() {
  const modal = $("#competitionQuizModal");
  if (modal) modal.close();
  if (compState.confettiAnimationId) cancelAnimationFrame(compState.confettiAnimationId);
  if (typeof loadWeeklyCompetitionOverview === "function") {
    loadWeeklyCompetitionOverview();
  }
  openCompetitionModal("leaderboard");
}

async function loadAdminCompetition() {
  try {
    const data = await requestAPI("/api/admin/competition/overview");
    const comp = data.currentCompetition || {};
    if ($("#adminWeekNumber")) $("#adminWeekNumber").value = comp.week_number || data.week_number || 1;
    if ($("#adminWeekTopicName")) $("#adminWeekTopicName").value = comp.topic_name || data.weekTopic || "";
    if ($("#adminPhase1Topic")) $("#adminPhase1Topic").value = comp.phase1_topic || data.phase1Topic || "";
    if ($("#adminPhase2Topic")) $("#adminPhase2Topic").value = comp.phase2_topic || data.phase2Topic || "";
    if ($("#adminPhase3Topic")) $("#adminPhase3Topic").value = comp.phase3_topic || data.phase3Topic || "";

    const simLabel = $("#adminSimCurrentTime");
    if (simLabel) {
      simLabel.textContent = data.simulatedTimeStr || data.serverTimeStr || "Giờ thực tế";
    }

    await loadAdminPhaseQuestions(compState.adminSelectedPhase || 1);
  } catch (e) {
    toast("Không thể tải thông tin thi đua quản trị.");
  }
}

async function saveAdminCompetitionTopics() {
  try {
    const weekNum = parseInt($("#adminWeekNumber")?.value, 10);
    await requestAPI("/api/admin/competition/update-topics", {
      method: "POST",
      body: JSON.stringify({
        weekNumber: isNaN(weekNum) ? null : weekNum,
        weekTopic: $("#adminWeekTopicName")?.value || "",
        phase1Topic: $("#adminPhase1Topic")?.value || "",
        phase2Topic: $("#adminPhase2Topic")?.value || "",
        phase3Topic: $("#adminPhase3Topic")?.value || ""
      })
    });
    toast("✅ Đã lưu thông tin chủ đề thi đua!");
    loadWeeklyCompetitionStatus();
  } catch (e) {
    toast(e.message || "Lỗi khi lưu chủ đề.");
  }
}

function collectCurrentAdminQuestionsFromDOM() {
  const cards = $$("#adminQuestionsList .admin-q-card");
  if (!cards || !cards.length) return null;
  const list = [];
  cards.forEach((card, idx) => {
    const text = card.querySelector(".admin-q-text")?.value?.trim() || "";
    const optA = card.querySelector(".admin-q-a")?.value?.trim() || "";
    const optB = card.querySelector(".admin-q-b")?.value?.trim() || "";
    const optC = card.querySelector(".admin-q-c")?.value?.trim() || "";
    const correct = card.querySelector(".admin-q-correct")?.value || "A";
    list.push({
      questionNumber: idx + 1,
      questionText: text,
      optionA: optA,
      optionB: optB,
      optionC: optC,
      correctOption: correct
    });
  });
  return list;
}

async function switchAdminPhaseTab(phase) {
  const oldPhase = compState.adminSelectedPhase || 1;
  if (oldPhase !== phase) {
    // Lưu các câu hỏi đang sửa trên giao diện vào bản nháp bộ nhớ tạm
    const currentEdits = collectCurrentAdminQuestionsFromDOM();
    if (currentEdits && currentEdits.some(q => q.questionText || q.optionA)) {
      if (!compState.adminPhaseDrafts) compState.adminPhaseDrafts = {};
      compState.adminPhaseDrafts[oldPhase] = currentEdits;
    }
  }

  compState.adminSelectedPhase = phase;
  $$(".admin-phase-tab-btn").forEach((btn, i) => {
    btn.classList.toggle("active", i === (phase - 1));
  });

  // Nếu giai đoạn này đang có bản nháp (do vừa nhập Excel hoặc vừa gõ), ưu tiên hiển thị ngay
  if (compState.adminPhaseDrafts && compState.adminPhaseDrafts[phase] && compState.adminPhaseDrafts[phase].length > 0) {
    compState.adminQuestions = compState.adminPhaseDrafts[phase];
    renderAdminQuestionsList();
    const badge = $("#adminPhaseStatusBadge");
    if (badge) {
      const cnt = compState.adminQuestions.length;
      badge.textContent = `📝 ${cnt}/10 câu (Bản nháp chưa lưu)`;
      badge.style.color = "#d97706";
    }
  } else {
    await loadAdminPhaseQuestions(phase);
  }
}

async function loadAdminPhaseQuestions(phase) {
  const container = $("#adminQuestionsList");
  const badge = $("#adminPhaseStatusBadge");
  if (!container) return;

  container.innerHTML = `<div style="padding:12px; color:var(--muted); text-align:center;">Đang tải câu hỏi...</div>`;

  try {
    const res = await requestAPI(`/api/admin/competition/questions?phase=${phase}`);
    // Chuẩn hóa mọi biến thể thuộc tính từ server để hiển thị trọn vẹn lên giao diện
    compState.adminQuestions = (res.questions || []).map((q, idx) => ({
      id: q.id,
      questionNumber: q.questionNumber || q.question_index || (idx + 1),
      questionText: q.questionText || q.question_text || "",
      optionA: q.optionA || q.option_a || "",
      optionB: q.optionB || q.option_b || "",
      optionC: q.optionC || q.option_c || "",
      correctOption: (q.correctOption || q.correct_option || "A").toUpperCase(),
      explanation: q.explanation || ""
    }));

    if (badge) {
      const cnt = compState.adminQuestions.length;
      badge.textContent = cnt === 10 ? `🟢 ${cnt}/10 câu (Đạt chuẩn)` : `⚠️ ${cnt}/10 câu (Cần đủ 10 câu)`;
      badge.style.color = cnt === 10 ? "#246247" : "#d97706";
    }

    renderAdminQuestionsList();
  } catch (e) {
    container.innerHTML = `<div style="padding:12px; color:red;">${e.message}</div>`;
  }
}

function renderAdminQuestionsList() {
  const container = $("#adminQuestionsList");
  if (!container) return;

  if (compState.adminQuestions.length === 0) {
    container.innerHTML = `<div style="padding:16px; text-align:center; color:var(--muted);">Giai đoạn này chưa có câu hỏi nào. Bấm "+ Thêm câu hỏi", "Nhập từ Excel" hoặc "Tải bộ 30 câu hỏi mẫu".</div>`;
    return;
  }

  container.innerHTML = compState.adminQuestions.map((q, idx) => {
    const qText = q.questionText || q.question_text || "";
    const optA = q.optionA || q.option_a || "";
    const optB = q.optionB || q.option_b || "";
    const optC = q.optionC || q.option_c || "";
    const correct = (q.correctOption || q.correct_option || "A").toUpperCase();
    return `
      <div class="admin-q-card" data-idx="${idx}" style="background:var(--sage-2); border:1px solid var(--line); border-radius:6px; padding:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <strong style="font-size:12px; color:var(--ink);">Câu ${idx + 1}</strong>
          <button type="button" class="button button-sm button-outline" style="color:#ef4444; padding:2px 6px; font-size:11px;" onclick="adminRemoveQuestion(${idx})">Xóa</button>
        </div>
        <input type="text" class="input-field admin-q-text" style="width:100%; margin-bottom:6px; font-size:12px;" placeholder="Nội dung câu hỏi..." value="${escapeHTML(qText)}" />
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr 110px; gap:6px; align-items:center;">
          <input type="text" class="input-field admin-q-a" style="font-size:11px;" placeholder="Đáp án A" value="${escapeHTML(optA)}" />
          <input type="text" class="input-field admin-q-b" style="font-size:11px;" placeholder="Đáp án B" value="${escapeHTML(optB)}" />
          <input type="text" class="input-field admin-q-c" style="font-size:11px;" placeholder="Đáp án C" value="${escapeHTML(optC)}" />
          <select class="input-field admin-q-correct" style="font-size:11px; padding:4px;">
            <option value="A" ${correct === "A" ? "selected" : ""}>Đúng: A</option>
            <option value="B" ${correct === "B" ? "selected" : ""}>Đúng: B</option>
            <option value="C" ${correct === "C" ? "selected" : ""}>Đúng: C</option>
          </select>
        </div>
      </div>
    `;
  }).join("");
}

function adminAddEmptyQuestion() {
  if (compState.adminQuestions.length >= 10) {
    toast("Giai đoạn đã có tối đa 10 câu hỏi.");
    return;
  }
  compState.adminQuestions.push({
    questionText: "",
    optionA: "",
    optionB: "",
    optionC: "",
    correctOption: "A"
  });
  renderAdminQuestionsList();
  const badge = $("#adminPhaseStatusBadge");
  if (badge) {
    const cnt = compState.adminQuestions.length;
    badge.textContent = `${cnt}/10 câu`;
  }
}

function adminRemoveQuestion(idx) {
  compState.adminQuestions.splice(idx, 1);
  renderAdminQuestionsList();
  const badge = $("#adminPhaseStatusBadge");
  if (badge) {
    const cnt = compState.adminQuestions.length;
    badge.textContent = `${cnt}/10 câu`;
  }
}

async function adminSaveQuestions() {
  const cards = $$("#adminQuestionsList .admin-q-card");
  const questions = [];
  cards.forEach((card, idx) => {
    const text = card.querySelector(".admin-q-text")?.value?.trim();
    const optA = card.querySelector(".admin-q-a")?.value?.trim();
    const optB = card.querySelector(".admin-q-b")?.value?.trim();
    const optC = card.querySelector(".admin-q-c")?.value?.trim();
    const correct = card.querySelector(".admin-q-correct")?.value || "A";
    if (text && optA && optB && optC) {
      questions.push({
        questionNumber: idx + 1,
        questionText: text,
        optionA: optA,
        optionB: optB,
        optionC: optC,
        correctOption: correct
      });
    }
  });

  if (questions.length !== 10) {
    if (!confirm(`Bạn mới nhập ${questions.length}/10 câu hỏi hợp lệ. Giai đoạn cần đủ 10 câu để hiển thị trên trang chủ. Bạn có muốn lưu bản nháp này không?`)) {
      return;
    }
  }

  const curPhase = compState.adminSelectedPhase || 1;
  try {
    await requestAPI("/api/admin/competition/questions", {
      method: "POST",
      body: JSON.stringify({
        phase: curPhase,
        questions: questions
      })
    });
    // Xóa bản nháp tạm của giai đoạn này sau khi đã lưu DB thành công
    if (compState.adminPhaseDrafts) {
      delete compState.adminPhaseDrafts[curPhase];
    }
    toast("✅ Đã lưu bộ câu hỏi giai đoạn thành công!");
    await loadAdminPhaseQuestions(curPhase);
    loadWeeklyCompetitionStatus();
  } catch (e) {
    toast(e.message || "Lỗi khi lưu bộ câu hỏi.");
  }
}

async function adminSeedSampleQuestions() {
  if (!confirm("Hành động này sẽ nạp 30 câu hỏi mẫu chuẩn Nghiên cứu Khoa học (10 câu/giai đoạn) vào cơ sở dữ liệu. Bạn có chắc chắn?")) return;
  try {
    const res = await requestAPI("/api/admin/competition/seed-samples", {
      method: "POST"
    });
    toast(`⚡ Đã tải thành công ${res.count || 30} câu hỏi mẫu!`);
    await loadAdminCompetition();
    loadWeeklyCompetitionStatus();
  } catch (e) {
    toast(e.message || "Lỗi khi nạp câu hỏi mẫu.");
  }
}

async function adminSetSimTime(preset) {
  try {
    const res = await requestAPI("/api/admin/competition/simulate-time", {
      method: "POST",
      body: JSON.stringify({ preset })
    });
    toast(`⏰ Đã đổi sang mốc giờ mô phỏng: ${preset.toUpperCase()} (${res.simulatedTimeStr || ""})`);
    await loadAdminCompetition();
    await loadWeeklyCompetitionStatus();
    if (typeof loadWeeklyCompetitionOverview === "function") {
      await loadWeeklyCompetitionOverview();
    }
  } catch (e) {
    toast(e.message || "Lỗi khi đặt giờ mô phỏng.");
  }
}

async function adminConcludeWeekNow() {
  if (!confirm("Bạn có chắc chắn muốn chốt điểm và trao thưởng (+điểm hoạt động +khiên) cho toàn bộ thành viên tuần này ngay bây giờ?")) return;
  try {
    const res = await requestAPI("/api/admin/competition/conclude-week", {
      method: "POST"
    });
    toast(`🏆 ${res.message || "Đã tổng kết và trao thưởng thành công!"}`);
    hydrateServer();
  } catch (e) {
    toast(e.message || "Lỗi khi tổng kết tuần.");
  }
}

// --- EXCEL TEMPLATE & IMPORT FOR ARENA QUESTIONS (HỖ TRỢ 1 GIAI ĐOẠN HOẶC CẢ 3 GIAI ĐOẠN) ---
function adminDownloadExcelTemplate() {
  const currentPhase = compState.adminSelectedPhase || 1;
  
  const p1Questions = [
    { "STT": 1, "Giai đoạn": 1, "Câu hỏi": "Bước đầu tiên trong quy trình nghiên cứu khoa học chuẩn là gì?", "Đáp án A": "Xác định vấn đề và câu hỏi nghiên cứu", "Đáp án B": "Tiến hành thu thập dữ liệu thực địa ngay", "Đáp án C": "Viết báo cáo kết quả và thảo luận", "Đáp án đúng (A/B/C)": "A" },
    { "STT": 2, "Giai đoạn": 1, "Câu hỏi": "Phương pháp nghiên cứu nào thường sử dụng bảng hỏi (survey) để thu thập dữ liệu định lượng?", "Đáp án A": "Nghiên cứu định tính phỏng vấn sâu", "Đáp án B": "Nghiên cứu điều tra khảo sát (Survey research)", "Đáp án C": "Phương pháp quan sát tham dự", "Đáp án đúng (A/B/C)": "B" },
    { "STT": 3, "Giai đoạn": 1, "Câu hỏi": "Biến độc lập (Independent Variable) trong mô hình nghiên cứu có đặc điểm gì?", "Đáp án A": "Là nguyên nhân tác động đến biến phụ thuộc", "Đáp án B": "Là kết quả bị chi phối bởi biến phụ thuộc", "Đáp án C": "Là biến không bao giờ thay đổi giá trị", "Đáp án đúng (A/B/C)": "A" },
    { "STT": 4, "Giai đoạn": 1, "Câu hỏi": "Giả thuyết nghiên cứu (Hypothesis) là gì?", "Đáp án A": "Một kết luận chắc chắn đã được chứng minh 100%", "Đáp án B": "Một câu hỏi chưa có hướng trả lời", "Đáp án C": "Một phỏng đoán có căn cứ khoa học về mối quan hệ giữa các biến", "Đáp án đúng (A/B/C)": "C" },
    { "STT": 5, "Giai đoạn": 1, "Câu hỏi": "Chọn mẫu ngẫu nhiên đơn giản (Simple Random Sampling) thuộc loại chọn mẫu nào?", "Đáp án A": "Chọn mẫu theo xác suất (Probability sampling)", "Đáp án B": "Chọn mẫu phi xác suất (Non-probability sampling)", "Đáp án C": "Chọn mẫu thuận tiện (Convenience sampling)", "Đáp án đúng (A/B/C)": "A" },
    { "STT": 6, "Giai đoạn": 1, "Câu hỏi": "Tổng quan tài liệu (Literature Review) đóng vai trò gì quan trọng nhất?", "Đáp án A": "Chỉ để làm cho bài viết dài hơn", "Đáp án B": "Xác định khoảng trống nghiên cứu và xây dựng khung lý thuyết", "Đáp án C": "Sao chép nguyên văn các công trình trước", "Đáp án đúng (A/B/C)": "B" },
    { "STT": 7, "Giai đoạn": 1, "Câu hỏi": "Nghiên cứu thực nghiệm (Experimental Research) có ưu thế nổi bật nào?", "Đáp án A": "Dễ tiến hành và không tốn kém", "Đáp án B": "Khẳng định mối quan hệ nhân quả mạnh mẽ nhờ kiểm soát biến ngoại lai", "Đáp án C": "Không cần thu thập dữ liệu", "Đáp án đúng (A/B/C)": "B" },
    { "STT": 8, "Giai đoạn": 1, "Câu hỏi": "Khái niệm 'Khoảng trống nghiên cứu' (Research Gap) nghĩa là gì?", "Đáp án A": "Vấn đề chưa được giải quyết hoặc chưa được khám phá thấu đáo", "Đáp án B": "Khoảng cách địa lý giữa các nhà nghiên cứu", "Đáp án C": "Thời gian nghỉ giữa hai đợt khảo sát", "Đáp án đúng (A/B/C)": "A" },
    { "STT": 9, "Giai đoạn": 1, "Câu hỏi": "Thang đo Likert 5 mức độ thường được xếp vào loại thang đo nào?", "Đáp án A": "Thang đo định danh (Nominal)", "Đáp án B": "Thang đo thứ bậc (Ordinal) hoặc giả định khoảng cách (Interval)", "Đáp án C": "Thang đo tỷ lệ (Ratio)", "Đáp án đúng (A/B/C)": "B" },
    { "STT": 10, "Giai đoạn": 1, "Câu hỏi": "Hành vi nào sau đây vi phạm nghiêm trọng nhất đạo đức trong nghiên cứu khoa học?", "Đáp án A": "Trích dẫn đầy đủ nguồn tham khảo học thuật", "Đáp án B": "Bảo mật danh tính người tham gia khảo sát", "Đáp án C": "Đạo văn (Plagiarism) và ngụy tạo số liệu khảo sát", "Đáp án đúng (A/B/C)": "C" }
  ];

  const p2Questions = [
    { "STT": 1, "Giai đoạn": 2, "Câu hỏi": "Chỉ số Cronbach's Alpha thường dùng để đo lường điều gì trong SPSS?", "Đáp án A": "Độ tin cậy nhất quán nội tại của thang đo", "Đáp án B": "Mức độ tương quan giữa hai biến định lượng", "Đáp án C": "Sự khác biệt trung bình giữa hai nhóm", "Đáp án đúng (A/B/C)": "A" },
    { "STT": 2, "Giai đoạn": 2, "Câu hỏi": "Giá trị Cronbach's Alpha đạt từ bao nhiêu trở lên được xem là thang đo sử dụng tốt?", "Đáp án A": "Từ 0.70 trở lên", "Đáp án B": "Từ 0.30 trở lên", "Đáp án C": "Từ 0.99 trở lên", "Đáp án đúng (A/B/C)": "A" },
    { "STT": 3, "Giai đoạn": 2, "Câu hỏi": "Hệ số tương quan biến - tổng (Corrected Item-Total Correlation) nhỏ hơn bao nhiêu thì nên loại biến quan sát?", "Đáp án A": "Nhỏ hơn 0.30", "Đáp án B": "Nhỏ hơn 0.70", "Đáp án C": "Nhỏ hơn 0.50", "Đáp án đúng (A/B/C)": "A" },
    { "STT": 4, "Giai đoạn": 2, "Câu hỏi": "Chỉ số KMO trong phân tích nhân tố khám phá (EFA) cần đạt tối thiểu bao nhiêu?", "Đáp án A": "KMO >= 0.50", "Đáp án B": "KMO >= 0.05", "Đáp án C": "KMO >= 0.90", "Đáp án đúng (A/B/C)": "A" },
    { "STT": 5, "Giai đoạn": 2, "Câu hỏi": "Giá trị p-value trong kiểm định Sig nhỏ hơn bao nhiêu thì bác bỏ giả thuyết H0 (mức 5%)?", "Đáp án A": "p > 0.05", "Đáp án B": "p < 0.05", "Đáp án C": "p = 0.50", "Đáp án đúng (A/B/C)": "B" },
    { "STT": 6, "Giai đoạn": 2, "Câu hỏi": "Hệ số R bình phương hiệu chỉnh (Adjusted R-squared) biểu thị điều gì?", "Đáp án A": "Mức độ phù hợp của mô hình hồi quy đối với dữ liệu thực tế", "Đáp án B": "Số lượng quan sát của mẫu", "Đáp án C": "Độ phân tán của biến phụ thuộc", "Đáp án đúng (A/B/C)": "A" },
    { "STT": 7, "Giai đoạn": 2, "Câu hỏi": "Hiện tượng đa cộng tuyến trong hồi quy tuyến tính thường được phát hiện qua chỉ số nào?", "Đáp án A": "Hệ số phóng đại phương sai VIF", "Đáp án B": "Hệ số skewness", "Đáp án C": "Chỉ số kurtosis", "Đáp án đúng (A/B/C)": "A" },
    { "STT": 8, "Giai đoạn": 2, "Câu hỏi": "Kiểm định Independent Samples T-Test dùng để so sánh gì?", "Đáp án A": "Trung bình của 2 nhóm độc lập", "Đáp án B": "Tỷ lệ của nhiều nhóm", "Đáp án C": "Độ lệch chuẩn của 3 nhóm trở lên", "Đáp án đúng (A/B/C)": "A" },
    { "STT": 9, "Giai đoạn": 2, "Câu hỏi": "Phân tích phương sai một yếu tố (One-way ANOVA) dùng khi nào?", "Đáp án A": "So sánh trung bình của từ 3 nhóm độc lập trở lên", "Đáp án B": "So sánh 2 biến định tính", "Đáp án C": "Xác định hệ số tương quan", "Đáp án đúng (A/B/C)": "A" },
    { "STT": 10, "Giai đoạn": 2, "Câu hỏi": "Dữ liệu thứ cấp (Secondary Data) là loại dữ liệu nào sau đây?", "Đáp án A": "Dữ liệu do nhà nghiên cứu tự làm khảo sát thu thập trực tiếp", "Đáp án B": "Dữ liệu có sẵn từ niên giám thống kê, báo cáo, nghiên cứu trước", "Đáp án C": "Dữ liệu chỉ bao gồm hình ảnh và video ghi hình", "Đáp án đúng (A/B/C)": "B" }
  ];

  const p3Questions = [
    { "STT": 1, "Giai đoạn": 3, "Câu hỏi": "Cấu trúc chuẩn IMRAD của một bài báo khoa học gồm những phần nào?", "Đáp án A": "Introduction, Methods, Results, and Discussion", "Đáp án B": "Index, Main, Review, Appendix, Data", "Đáp án C": "Idea, Model, Research, Action, Draft", "Đáp án đúng (A/B/C)": "A" },
    { "STT": 2, "Giai đoạn": 3, "Câu hỏi": "Trong trích dẫn theo chuẩn APA 7th, tài liệu có 3 tác giả trở lên trong bài viết được trích thế nào?", "Đáp án A": "Liệt kê đầy đủ tất cả tên tác giả", "Đáp án B": "Tên tác giả đầu tiên kèm 'et al.' (hoặc 'và cs.')", "Đáp án C": "Chỉ ghi tên nhà xuất bản", "Đáp án đúng (A/B/C)": "B" },
    { "STT": 3, "Giai đoạn": 3, "Câu hỏi": "Phần Tóm tắt (Abstract) của bài báo khoa học thường có độ dài khoảng bao nhiêu từ?", "Đáp án A": "Khoảng 150 - 250 từ", "Đáp án B": "Trên 1.000 từ", "Đáp án C": "Dưới 20 từ", "Đáp án đúng (A/B/C)": "A" },
    { "STT": 4, "Giai đoạn": 3, "Câu hỏi": "Phần Thảo luận (Discussion) có nhiệm vụ chính là gì?", "Đáp án A": "Liệt kê lại toàn bộ các số liệu bảng biểu", "Đáp án B": "Diễn giải ý nghĩa kết quả, so sánh với các nghiên cứu trước và nêu hàm ý", "Đáp án C": "Mô tả cách thu thập dữ liệu", "Đáp án đúng (A/B/C)": "B" },
    { "STT": 5, "Giai đoạn": 3, "Câu hỏi": "Mã số định danh số học thuật quốc tế của bài báo khoa học là gì?", "Đáp án A": "ISBN", "Đáp án B": "DOI (Digital Object Identifier)", "Đáp án C": "ISSN", "Đáp án đúng (A/B/C)": "B" },
    { "STT": 6, "Giai đoạn": 3, "Câu hỏi": "Chỉ số H-index đo lường điều gì của một nhà nghiên cứu?", "Đáp án A": "Tổng số tiền tài trợ nghiên cứu nhận được", "Đáp án B": "Cả năng suất công bố và tầm ảnh hưởng trích dẫn", "Đáp án C": "Số năm kinh nghiệm giảng dạy", "Đáp án đúng (A/B/C)": "B" },
    { "STT": 7, "Giai đoạn": 3, "Câu hỏi": "Bình duyệt kín hai chiều (Double-blind peer review) nghĩa là gì?", "Đáp án A": "Cả tác giả và người phản biện đều không biết danh tính của nhau", "Đáp án B": "Tác giả biết người phản biện nhưng người phản biện không biết tác giả", "Đáp án C": "Bài viết được công khai cho cộng đồng nhận xét tự do", "Đáp án đúng (A/B/C)": "A" },
    { "STT": 8, "Giai đoạn": 3, "Câu hỏi": "Khi diễn giải lại (paraphrase) ý tưởng của tác giả khác, ta có cần trích dẫn nguồn không?", "Đáp án A": "Không cần vì đã viết lại bằng lời của mình", "Đáp án B": "Bắt buộc phải ghi nguồn trích dẫn đầy đủ", "Đáp án C": "Chỉ cần trích dẫn nếu copy nguyên văn", "Đáp án đúng (A/B/C)": "B" },
    { "STT": 9, "Giai đoạn": 3, "Câu hỏi": "Phần Hàm ý quản trị (Managerial Implications) nhằm trả lời câu hỏi nào?", "Đáp án A": "Nghiên cứu tốn bao nhiêu chi phí?", "Đáp án B": "Ai là người hướng dẫn nghiên cứu?", "Đáp án C": "Kết quả nghiên cứu này giúp ích gì cho các nhà quản lý trong thực tiễn?", "Đáp án đúng (A/B/C)": "C" },
    { "STT": 10, "Giai đoạn": 3, "Câu hỏi": "Phần Giới hạn nghiên cứu (Limitations) được đưa vào nhằm mục đích gì?", "Đáp án A": "Chỉ ra những ranh giới, hạn chế của đề tài và mở ra hướng nghiên cứu tiếp theo", "Đáp án B": "Thừa nhận bài báo không đạt chất lượng", "Đáp án C": "Tránh bị người đọc đặt câu hỏi", "Đáp án đúng (A/B/C)": "A" }
  ];

  const all3Phases = [...p1Questions, ...p2Questions, ...p3Questions];

  const colWidths = [
    { wch: 6 },  // STT
    { wch: 12 }, // Giai đoạn
    { wch: 65 }, // Câu hỏi
    { wch: 38 }, // A
    { wch: 38 }, // B
    { wch: 38 }, // C
    { wch: 22 }  // Đáp án đúng
  ];

  if (window.XLSX) {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Tất cả 3 giai đoạn (30 câu)
    const wsAll = XLSX.utils.json_to_sheet(all3Phases);
    wsAll['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, wsAll, "Tat_Ca_3_Giai_Doan");

    // Sheet 2, 3, 4: Từng giai đoạn riêng biệt
    const ws1 = XLSX.utils.json_to_sheet(p1Questions);
    ws1['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws1, "Giai_Doan_1");

    const ws2 = XLSX.utils.json_to_sheet(p2Questions);
    ws2['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws2, "Giai_Doan_2");

    const ws3 = XLSX.utils.json_to_sheet(p3Questions);
    ws3['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws3, "Giai_Doan_3");

    XLSX.writeFile(wb, "RE_SEARCH_Arena_Mau_Cau_Hoi_3_Giai_Doan.xlsx");
    toast("📥 Đã tải file Excel mẫu 3 giai đoạn (.xlsx) thành công! Bạn có thể nhập 1 giai đoạn hoặc cả 3 giai đoạn cùng lúc.");
  } else {
    // Fallback CSV with all 30 rows
    let csv = "\uFEFFSTT,Giai đoạn,Câu hỏi,Đáp án A,Đáp án B,Đáp án C,Đáp án đúng (A/B/C)\n";
    all3Phases.forEach(r => {
      csv += `${r["STT"]},${r["Giai đoạn"]},"${r["Câu hỏi"].replace(/"/g, '""')}","${r["Đáp án A"].replace(/"/g, '""')}","${r["Đáp án B"].replace(/"/g, '""')}","${r["Đáp án C"].replace(/"/g, '""')}",${r["Đáp án đúng (A/B/C)"]}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "RE_SEARCH_Arena_Mau_Cau_Hoi_3_Giai_Doan.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast("📥 Đã tải file mẫu (.csv) 3 giai đoạn thành công!");
  }
}

async function adminHandleExcelUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  event.target.value = ""; // reset file input

  try {
    const data = await file.arrayBuffer();
    const currentPhase = compState.adminSelectedPhase || 1;
    const phaseMap = { 1: [], 2: [], 3: [] };

    // Trợ lý đọc ô theo từ khóa tiếng Việt linh hoạt (không phân biệt hoa thường, dấu, khoảng trắng)
    function getCellVal(row, keywords, fallbackIndex) {
      const entries = Object.entries(row);
      // 1. So khớp chính xác sau khi chuẩn hóa
      for (const [k, v] of entries) {
        const cleanK = k.trim().toLowerCase();
        for (const kw of keywords) {
          if (cleanK === kw.toLowerCase()) {
            if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
          }
        }
      }
      // 2. So khớp chứa từ khóa
      for (const [k, v] of entries) {
        const cleanK = k.trim().toLowerCase();
        for (const kw of keywords) {
          if (cleanK.includes(kw.toLowerCase())) {
            if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
          }
        }
      }
      // 3. Fallback theo vị trí cột nếu có
      if (fallbackIndex !== undefined && fallbackIndex < entries.length) {
        const v = entries[fallbackIndex][1];
        if (v !== undefined && v !== null) return String(v).trim();
      }
      return "";
    }

    if (window.XLSX) {
      const wb = XLSX.read(data, { type: "array" });
      
      // Đọc toàn bộ các sheet trong workbook
      wb.SheetNames.forEach(sheetName => {
        const sheet = wb.Sheets[sheetName];
        const sheetRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        
        let sheetDefaultPhase = currentPhase;
        const sLower = sheetName.toLowerCase().replace(/[\s_-]+/g, "");
        if (sLower.includes("giaidoan1") || sLower.includes("gd1") || sLower === "1") sheetDefaultPhase = 1;
        else if (sLower.includes("giaidoan2") || sLower.includes("gd2") || sLower === "2") sheetDefaultPhase = 2;
        else if (sLower.includes("giaidoan3") || sLower.includes("gd3") || sLower === "3") sheetDefaultPhase = 3;

        sheetRows.forEach(row => {
          const qText = getCellVal(row, ["câu hỏi", "cau hoi", "nội dung câu hỏi", "nội dung", "noi dung", "đề bài", "de bai", "question", "bài tập", "câu"]);
          const optA = getCellVal(row, ["đáp án a", "dap an a", "lựa chọn a", "phương án a", "option a", "a"]);
          const optB = getCellVal(row, ["đáp án b", "dap an b", "lựa chọn b", "phương án b", "option b", "b"]);
          const optC = getCellVal(row, ["đáp án c", "dap an c", "lựa chọn c", "phương án c", "option c", "c"]);

          let rawCorrect = getCellVal(row, ["đáp án đúng (a/b/c)", "đáp án đúng", "dap an dung", "đáp án", "dap an", "kết quả", "đúng", "dung", "correct option", "correct", "key", "answer"]).toUpperCase().trim();
          let correct = "A";
          if (rawCorrect.includes("A") || rawCorrect === "1") correct = "A";
          else if (rawCorrect.includes("B") || rawCorrect === "2") correct = "B";
          else if (rawCorrect.includes("C") || rawCorrect === "3") correct = "C";

          const rawPhase = getCellVal(row, ["giai đoạn", "giai doan", "gđ", "gd", "phase", "đợt", "dot", "chặng"]);
          let phaseVal = sheetDefaultPhase;
          if (rawPhase) {
            const m = rawPhase.match(/[1-3]/);
            if (m) phaseVal = parseInt(m[0], 10);
          }

          if (qText && optA && optB && optC) {
            const exists = phaseMap[phaseVal].some(q => q.questionText === qText);
            if (!exists) {
              phaseMap[phaseVal].push({
                questionNumber: phaseMap[phaseVal].length + 1,
                questionText: qText,
                optionA: optA,
                optionB: optB,
                optionC: optC,
                correctOption: correct
              });
            }
          }
        });
      });
    } else {
      // Basic CSV fallback
      const text = new TextDecoder("utf-8").decode(data);
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) throw new Error("File không chứa dữ liệu câu hỏi.");
      const headers = lines[0].split(",").map(h => h.replace(/^["'\s]+|["'\s]+$/g, ""));
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map(c => c.replace(/^["'\s]+|["'\s]+$/g, ""));
        const row = {};
        headers.forEach((h, idx) => { row[h] = cols[idx] || ""; });

        const qText = getCellVal(row, ["câu hỏi", "cau hoi", "nội dung câu hỏi", "nội dung", "noi dung", "đề bài", "de bai", "question", "bài tập", "câu"]);
        const optA = getCellVal(row, ["đáp án a", "dap an a", "lựa chọn a", "phương án a", "option a", "a"]);
        const optB = getCellVal(row, ["đáp án b", "dap an b", "lựa chọn b", "phương án b", "option b", "b"]);
        const optC = getCellVal(row, ["đáp án c", "dap an c", "lựa chọn c", "phương án c", "option c", "c"]);
        let rawCorrect = getCellVal(row, ["đáp án đúng (a/b/c)", "đáp án đúng", "dap an dung", "đáp án", "dap an", "kết quả", "đúng", "dung", "correct option", "correct", "key", "answer"]).toUpperCase().trim();
        let correct = "A";
        if (rawCorrect.includes("A") || rawCorrect === "1") correct = "A";
        else if (rawCorrect.includes("B") || rawCorrect === "2") correct = "B";
        else if (rawCorrect.includes("C") || rawCorrect === "3") correct = "C";

        const rawPhase = getCellVal(row, ["giai đoạn", "giai doan", "gđ", "gd", "phase", "đợt", "dot", "chặng"]);
        let phaseVal = currentPhase;
        if (rawPhase) {
          const m = rawPhase.match(/[1-3]/);
          if (m) phaseVal = parseInt(m[0], 10);
        }

        if (qText && optA && optB && optC) {
          phaseMap[phaseVal].push({
            questionNumber: phaseMap[phaseVal].length + 1,
            questionText: qText,
            optionA: optA,
            optionB: optB,
            optionC: optC,
            correctOption: correct
          });
        }
      }
    }

    const phasesWithQuestions = [1, 2, 3].filter(p => phaseMap[p].length > 0);
    const totalFound = phasesWithQuestions.reduce((acc, p) => acc + phaseMap[p].length, 0);

    if (totalFound === 0) {
      throw new Error("Không nhận diện được câu hỏi hợp lệ. Vui lòng kiểm tra file Excel theo đúng định dạng mẫu (Câu hỏi, Đáp án A, B, C, Đáp án đúng).");
    }

    // Lưu toàn bộ câu hỏi của tất cả các giai đoạn vào bản nháp bộ nhớ tạm
    if (!compState.adminPhaseDrafts) compState.adminPhaseDrafts = {};
    for (const p of [1, 2, 3]) {
      if (phaseMap[p].length > 0) {
        compState.adminPhaseDrafts[p] = phaseMap[p].slice(0, 10);
      }
    }

    // Trường hợp file chứa câu hỏi cho NHIỀU HƠN 1 GIAI ĐOẠN (ví dụ cả 3 giai đoạn)
    if (phasesWithQuestions.length > 1) {
      const summaryList = phasesWithQuestions.map(p => `• Giai đoạn ${p}: ${phaseMap[p].length} câu`).join("\n");
      const autoSave = confirm(
        `🎉 Phát hiện file Excel chứa câu hỏi cho ${phasesWithQuestions.length} giai đoạn:\n${summaryList}\n\n` +
        `Bạn có muốn HỆ THỐNG TỰ ĐỘNG LƯU TRỰC TIẾP TẤT CẢ các giai đoạn này vào cơ sở dữ liệu không?\n\n` +
        `• Bấm [OK]: Tự động lưu tất cả ${phasesWithQuestions.length} giai đoạn ngay lập tức.\n` +
        `• Bấm [Cancel]: Lưu vào bản nháp để bạn có thể xem duyệt qua từng giai đoạn trước khi bấm Lưu.`
      );

      if (autoSave) {
        let savedTotal = 0;
        for (const p of phasesWithQuestions) {
          const qList = phaseMap[p].slice(0, 10).map((q, idx) => ({
            question_index: idx + 1,
            question_text: q.questionText,
            option_a: q.optionA,
            option_b: q.optionB,
            option_c: q.optionC,
            correct_option: q.correctOption,
            explanation: ""
          }));

          await requestAPI("/api/admin/competition/questions", {
            method: "POST",
            body: JSON.stringify({
              phase: p,
              questions: qList
            })
          });
          delete compState.adminPhaseDrafts[p];
          savedTotal += qList.length;
        }

        toast(`🎉 Đã nạp và lưu thành công ${savedTotal} câu hỏi cho cả ${phasesWithQuestions.length} giai đoạn!`);
        await loadAdminPhaseQuestions(currentPhase);
        loadWeeklyCompetitionStatus();
        return;
      }
    }

    // Nếu chỉ nhập 1 giai đoạn hoặc người dùng chọn Cancel để duyệt trước
    const targetPhase = phaseMap[currentPhase].length > 0 ? currentPhase : phasesWithQuestions[0];
    if (targetPhase !== currentPhase) {
      compState.adminSelectedPhase = targetPhase;
      $$(".admin-phase-tab-btn").forEach((btn, i) => {
        btn.classList.toggle("active", i === (targetPhase - 1));
      });
    }

    compState.adminQuestions = (compState.adminPhaseDrafts[targetPhase] || []).slice(0, 10);
    renderAdminQuestionsList();

    const badge = $("#adminPhaseStatusBadge");
    if (badge) {
      const cnt = compState.adminQuestions.length;
      badge.textContent = `📝 ${cnt}/10 câu (Bản nháp Excel - Chưa lưu)`;
      badge.style.color = "#d97706";
    }

    toast(`🎉 Đã nạp ${compState.adminQuestions.length} câu hỏi cho Giai đoạn ${targetPhase}! Bạn có thể chuyển tab để xem các giai đoạn khác, hoặc bấm "Lưu 10 câu hỏi giai đoạn" để hoàn tất.`);
  } catch (err) {
    console.error("Lỗi đọc file Excel:", err);
    toast(`❌ Lỗi đọc file: ${err.message}`);
  }
}

// Window attachments for inline HTML onclick attributes
window.openCompetitionModal = openCompetitionModal;
window.closeCompetitionModal = closeCompetitionModal;
window.handleCompetitionCtaClick = handleCompetitionCtaClick;
window.switchCompTab = switchCompTab;
window.switchLbPhase = switchLbPhase;
window.startCompetitionQuiz = startCompetitionQuiz;
window.submitQuizAnswer = submitQuizAnswer;
window.closeQuizAndGoHome = closeQuizAndGoHome;
window.closeQuizAndOpenLeaderboard = closeQuizAndOpenLeaderboard;
window.saveAdminCompetitionTopics = saveAdminCompetitionTopics;
window.switchAdminPhaseTab = switchAdminPhaseTab;
window.adminSeedSampleQuestions = adminSeedSampleQuestions;
window.adminAddEmptyQuestion = adminAddEmptyQuestion;
window.adminRemoveQuestion = adminRemoveQuestion;
window.adminSaveQuestions = adminSaveQuestions;
window.adminSetSimTime = adminSetSimTime;
window.adminConcludeWeekNow = adminConcludeWeekNow;
window.loadWeeklyCompetitionStatus = loadWeeklyCompetitionStatus;
window.adminDownloadExcelTemplate = adminDownloadExcelTemplate;
window.adminHandleExcelUpload = adminHandleExcelUpload;
window.promptQuizExit = promptQuizExit;
window.cancelQuizExit = cancelQuizExit;
window.confirmQuizExit = confirmQuizExit;
window.openQuizStartConfirmModal = openQuizStartConfirmModal;
window.closeQuizStartConfirmModal = closeQuizStartConfirmModal;
window.proceedStartQuizSession = proceedStartQuizSession;
window.openPhaseResultModal = openPhaseResultModal;

// Safe cancel listeners for Arena Quiz modals
document.addEventListener("DOMContentLoaded", () => {
  const quizModal = $("#competitionQuizModal");
  if (quizModal) {
    quizModal.addEventListener("cancel", (e) => {
      const resView = $("#quizResultView");
      if (resView && resView.style.display !== "none") {
        closeQuizAndGoHome();
        return;
      }
      e.preventDefault();
      promptQuizExit();
    });
  }
  const exitModal = $("#quizExitConfirmModal");
  if (exitModal) {
    exitModal.addEventListener("cancel", () => {
      cancelQuizExit();
    });
  }
  const startModal = $("#quizStartConfirmModal");
  if (startModal) {
    startModal.addEventListener("cancel", () => {
      closeQuizStartConfirmModal();
    });
  }
});

// Auto-pause if user closes tab or navigates away
window.addEventListener("beforeunload", () => {
  const quizModal = $("#competitionQuizModal");
  if (quizModal && quizModal.open && compState.sessionToken && compState.quizRemainingSeconds > 0) {
    const payload = JSON.stringify({
      sessionToken: compState.sessionToken,
      clientRemainingSeconds: compState.quizRemainingSeconds
    });
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/competition/session/pause", blob);
    }
  }
});




