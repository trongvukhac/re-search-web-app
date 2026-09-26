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
  return Boolean(user && user.role === "admin");
}
window.canAccessStudyLounge = canAccessStudyLounge;

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
  return '';
}

const STREAK_MILESTONES = [
  {
    days: 3,
    tier: 1,
    title: "Sinh viên năng động",
    color: "Xanh lam",
    forumDesc: "Mở khoá giao diện thẻ thành tích mới",
    studyDesc: "Chờ nhé, sắp có rồi"
  },
  {
    days: 7,
    tier: 2,
    title: "Học giả bền bỉ",
    color: "Vàng ánh kim",
    forumDesc: "Mở khoá viền avatar đặc sắc",
    studyDesc: "Chờ nhé, sắp có rồi"
  },
  {
    days: 14,
    tier: 3,
    title: "Nhà nghiên cứu tài năng",
    color: "Tím huyền bí",
    forumDesc: "Mở khoá màu tên rực rỡ và avatar đặc sắc",
    studyDesc: "Chờ nhé, sắp có rồi"
  },
  {
    days: 30,
    tier: 4,
    title: "Bậc thầy học thuật",
    color: "Đỏ ruby",
    forumDesc: "Mở khóa giao diện độc quyền, màu tên rực rỡ và avatar đặc sắc",
    studyDesc: "Chờ nhé, sắp có rồi"
  },
  {
    days: 50,
    tier: 5,
    title: "Độc nhất vô nhị",
    color: "Gradient tím + đỏ",
    forumDesc: "Mở khoá giao diện đẳng cấp sang trọng, hào quang rực rỡ đón chờ!",
    studyDesc: "Chờ nhé, sắp có rồi"
  }
];

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
                <span class="milestone-perk-text perk-study-waiting">${m.studyDesc}</span>
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

  const isAdmin = Boolean(user && user.role === "admin");
  const badgeDesk = $("#studyNavBadgeDesktop");
  const badgeMob = $("#studyNavBadgeMobile");
  if (badgeDesk) {
    badgeDesk.textContent = isAdmin ? "Admin Test" : "Bảo trì";
    badgeDesk.className = `study-nav-badge ${isAdmin ? "admin" : ""}`;
    badgeDesk.style.display = "inline-block";
  }
  if (badgeMob) {
    badgeMob.textContent = isAdmin ? "Admin" : "Bảo trì";
    badgeMob.className = `study-nav-badge mobile ${isAdmin ? "admin" : ""}`;
    badgeMob.style.display = "inline-block";
  }

  const notice = $("#studyLockedNotice");
  const mainStudy = $("#studyMainContent");
  if (notice) notice.style.display = isAdmin ? "none" : "block";
  if (mainStudy) mainStudy.style.display = isAdmin ? "block" : "none";

  if (isAdmin) {
    if (typeof updateStudyStreakPerks === "function") {
      updateStudyStreakPerks();
    }
    if (typeof fetchStudyLounge === "function") {
      fetchStudyLounge();
    }
  } else {
    if (typeof stopAllStudyAudio === "function") {
      stopAllStudyAudio();
    }
    if (typeof pauseStudyTimer === "function" && studyState.isRunning) {
      pauseStudyTimer(false);
    }
    if (location.hash === "#study") {
      go("home");
    }
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

async function hydrateServer() {
  if (!serverMode) return;
  try {
    const current = await requestAPI("/api/session", { headers: {} });
    csrfToken = current.csrfToken;
    applySession(current.user);

    if (typeof initialRequestedRoute !== "undefined" && initialRequestedRoute === "study") {
      if (canAccessStudyLounge(current.user)) {
        go("study");
      } else {
        toast(STUDY_MAINTENANCE_MSG);
      }
    }

    const [postsData, docsData, leaderboardData, topicsData] = await Promise.all([
      requestAPI("/api/posts").catch(() => ({ posts: [] })),
      requestAPI("/api/documents").catch(() => ({ documents: [] })),
      requestAPI("/api/leaderboard").catch(() => ({ leaderboard: [] })),
      requestAPI("/api/topics").catch(() => ({ topics: [] })),
    ]);

    if (topicsData.topics) {
      allTopics = topicsData.topics;
      topics = allTopics.filter(t => t.status === "approved").map(t => t.name);
      renderTopicsDropdown();
    }

    if (postsData.posts) {
      posts = postsData.posts.map(normalizePost);
      renderHome();
      renderPosts();

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
          date: formatTime(d.createdAt || d.date),
          url: d.url || d.sourceUrl,
        });
      });
      renderDocuments();
    }

    if (current.authenticated) {
      if ($("#accountGrid")) $("#accountGrid").style.display = "";
      if ($("#editProfile")) $("#editProfile").style.display = "";
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
      if ($("#logoutButton")) $("#logoutButton").style.display = "none";
      if ($("#adminPanel")) $("#adminPanel").style.display = "none";
    }
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
    study_session: "🎧"
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
      case "admin_adjustment": return r.points > 0 ? `Được TA cộng điểm: ${escapeHTML(r.reason || '')}` : `Bị trừ điểm do vi phạm quy định: ${escapeHTML(r.reason || '')}`;
      case "response_deleted": return `Phản hồi của bạn đã bị xóa`;
      case "post_deleted": return `Câu hỏi của bạn đã bị xóa`;
      case "post_hidden": return `Bài đăng của bạn đã bị xoá`;
      case "response_hidden": return `Bài đăng gốc đã bị xoá. Phản hồi của bạn không được tính điểm.`;
      case "weekly_active_reward": return r.reason || `Thưởng điểm hoạt động tích cực tuần vừa rồi`;
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
  const timerSvg = `<svg class="timer-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><circle class="progress edit-progress-${type}-${id}" cx="12" cy="12" r="10"></circle></svg>`;

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
    <div class="post-stats"><span class="post-tag">${post.topic}</span><span style="font-weight:600; color:var(--primary)">▲ ${post.upvotes}</span><span style="font-weight:600; color:var(--sage-5)">💬 ${post.responses}</span></div>
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
        return `<article class="document-card" data-doc="${d.id}" style="position:relative;">${delBtn}<div class="document-type" data-format="${d.format}">${d.format}</div><p class="eyebrow">${d.type === "course" ? "TÀI LIỆU MÔN HỌC" : "TÀI LIỆU THAM KHẢO"}</p><h2>${d.title}</h2><div class="document-desc ql-editor">${DOMPurify.sanitize(d.desc)}</div><div class="document-footer"><span>${d.author}</span><span>${d.date}</span></div></article>`;
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
        $("#viewerIframe").src = previewUrl;
        $("#viewerTitle").textContent = doc.title;
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

function go(route) {
  if (route === "study" && !canAccessStudyLounge()) {
    toast(STUDY_MAINTENANCE_MSG);
    const activeEl = document.querySelector(".page.active-page");
    const currentActive = activeEl ? activeEl.dataset.page : null;
    const fallback = (currentActive && currentActive !== "study") ? currentActive : "home";
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

  $$("dialog").forEach((d) => d.close());
  $$(".page").forEach((p) =>
    p.classList.toggle("active-page", p.dataset.page === route),
  );
  $$("[data-route]").forEach((a) =>
    a.classList.toggle("active", a.dataset.route === route),
  );
  history.replaceState(null, "", `#${route}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (route === "forum") renderPosts();
  if (route === "study") onEnterStudyLounge();
  else onLeaveStudyLounge();
  updateResponsiveAsidePlacement();
}
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

const docViewerModalEl = $("#documentViewerModal");
if (docViewerModalEl) {
  docViewerModalEl.addEventListener("close", () => {
    stopDocReadTracking();
    const iframe = $("#viewerIframe");
    if (iframe) iframe.src = "about:blank";
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
        <span style="margin: 0 0 0 12px; font-weight:600; color:var(--sage-5); font-size: 11px; display: flex; align-items: center;">💬 ${post.responseCount} phản hồi</span>
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
$$(".auth-tab").forEach((tab) =>
  tab.addEventListener("click", () => {
    const registering = tab.dataset.authMode === "register";
    $("#authModal").classList.toggle("registering", registering);
    $$(".auth-tab").forEach((t) => t.classList.toggle("active", t === tab));
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
  }),
);
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
  localStorage.setItem("bannerNextShow", nextTime.toString());
};

function checkAndShowBanner() {
  const now = new Date();
  const cutoff = new Date("2026-09-16T00:00:00+07:00"); 
  if (now > cutoff) return;

  const nextShow = localStorage.getItem("bannerNextShow");
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
    const r = document.querySelector(`.response .detail-actions button[onclick*="voteResponse(${id},"]`).closest(".response");
    if (r) {
      const contentEl = r.querySelector(".collapsible-content") || r.querySelector(".response-copy");
      content = contentEl.innerHTML; // Using innerHTML as fallback
      // Actually we'd better fetch raw from API, but we don't have a direct GET /responses/:id.
      // Wait, we can get it from the detail view response map, but we'll fetch from DOM for now or request it.
      // To be safe, we'll try to find it in the DOM and unescape or use Quill.
    }
    $("#editTitleLabel").style.display = "none";
  }

  $("#editType").value = type;
  $("#editId").value = id;
  if (editEditor) {
    editEditor.root.innerHTML = DOMPurify.sanitize(content);
  }
  $("#editModal").showModal();
};

$("#editForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  setSubmitLoading(e, true);
  const type = $("#editType").value;
  const id = $("#editId").value;
  const rawText = editEditor ? editEditor.getText().trim() : "";
  if (rawText.length < 5) {
    toast("Nội dung quá ngắn.");
    setSubmitLoading(e, false);
    return;
  }
  
  const content = editEditor.root.innerHTML;
  const title = type === "posts" ? $("#editTitle").value.trim() : "";

  try {
    await requestAPI(`/api/${type}/${id}`, {
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
    } else {
      // For response, refresh the current post detail
      const currentPostId = document.querySelector("#detailContent").getAttribute("data-current-post");
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
}

async function loadAdminMembers() {
  const data = await requestAPI("/api/admin/users");
  $("#adminUserList").innerHTML = data.users
    .map(
      (u) => `
    <tr style="border-bottom: 1px solid var(--sage-2);">
      <td style="padding: 12px 8px;"><strong>${u.displayName}</strong><br><small>${u.email}</small></td>
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
  });
});

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
$("#editProfile").onclick = () =>
  toast("Chỉnh sửa hồ sơ sẽ được lưu vào tài khoản của bạn.");
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
  $("#editProfileModal").showModal();
};

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
  "“Từng bước nhỏ tạo nên bước tiến lớn.”",
  "“Sự tập trung hôm nay là thành tựu nghiên cứu ngày mai.”",
  "“Nghiên cứu không phải chạy nước rút, mà là marathon bền bỉ.”",
  "“Đơn giản hóa vấn đề, kiên trì từng hiệp Pomodoro.”",
  "“Kỷ luật là cầu nối giữa mục tiêu và sự hoàn thành.”",
  "“Một tâm trí tĩnh lặng là cội nguồn của mọi sáng tạo.”"
];

let defaultStudyDocTitle = document.title || "RE:SEARCH - Diễn đàn Sinh viên & NCKH";

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

function rotateStudyQuote() {
  const quoteEl = $("#timerQuoteText");
  if (!quoteEl) return;
  const rand = STUDY_QUOTES[Math.floor(Math.random() * STUDY_QUOTES.length)];
  quoteEl.textContent = rand;
}

/* --- 3. STREAK PERKS EVALUATOR --- */
function getUserStudyStreak() {
  const curSession = session || (typeof window !== 'undefined' && window.session);
  if (!curSession) return 0;
  if (curSession.role === 'admin') return 999;
  return Number(curSession.streak || 0);
}

window.updateStudyStreakPerks = function() {
  const streak = getUserStudyStreak();
  const curSession = session || (typeof window !== 'undefined' && window.session);
  const isAdmin = curSession && curSession.role === 'admin';

  const chipVal = $("#studyUserStreakVal");
  if (chipVal) chipVal.textContent = isAdmin ? "Admin" : streak;

  // Streak 3: Ambient Environment Audio (4 Tracks) & Co-Study interaction
  const envUnlocked = true;
  const badgeEnvLock = $("#badgeEnvLock");
  const bannerEnvLocked = $("#bannerEnvLocked");
  if (badgeEnvLock) badgeEnvLock.style.display = "none";
  if (bannerEnvLocked) bannerEnvLocked.style.display = "none";

  // Streak 7: Mixable Sounds (9 Tracks)
  const mixUnlocked = true;
  const badgeMixLock = $("#badgeMixLock");
  const bannerMixLocked = $("#bannerMixLocked");
  if (badgeMixLock) badgeMixLock.style.display = "none";
  if (bannerMixLocked) bannerMixLocked.style.display = "none";

  // Streak 7: Focus Music (4 Tracks)
  const musicUnlocked = true;
  const badgeMusicLock = $("#badgeMusicLock");
  const bannerMusicLocked = $("#bannerMusicLocked");
  if (badgeMusicLock) badgeMusicLock.style.display = "none";
  if (bannerMusicLocked) bannerMusicLocked.style.display = "none";

  // Streak 14: Preset Wallpapers & Clock Color Customization
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

  // Streak 30: Custom Audio Upload (Max 3 Env, Max 5 Mix, Max 3 Music) & Custom Wallpaper Upload
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

  const wallUploadUnlocked = streak >= 30;
  const badgeWallUploadLock = $("#badgeWallUploadLock");
  const btnUploadWall = $("#btnUploadWall");
  if (badgeWallUploadLock) {
    badgeWallUploadLock.className = `perk-badge ${wallUploadUnlocked ? 'unlocked' : ''}`;
    badgeWallUploadLock.textContent = wallUploadUnlocked ? "" : "🔒 30d";
    badgeWallUploadLock.style.display = wallUploadUnlocked ? "none" : "inline-flex";
  }
  if (btnUploadWall) btnUploadWall.disabled = !wallUploadUnlocked;

  // Streak 50: Master Customization & Gradient Palettes & Unlimited Uploads
  const masterCustomUnlocked = streak >= 50;
  const badgeMasterCustomLock = $("#badgeMasterCustomLock");
  if (badgeMasterCustomLock) {
    badgeMasterCustomLock.className = `perk-badge ${masterCustomUnlocked ? 'unlocked' : ''}`;
    badgeMasterCustomLock.textContent = masterCustomUnlocked ? "" : "🔒 50d";
    badgeMasterCustomLock.style.display = masterCustomUnlocked ? "none" : "inline-flex";
  }
  const palettePicker = $("#colorPalettePicker");
  if (palettePicker) palettePicker.classList.toggle("locked-feature", !masterCustomUnlocked);

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
    }
  }

  renderEnvironmentAudioGrid();
  renderMixAudioGrid();
  renderWallpaperPresets();
  renderClockColorPicker();
  renderColorPalette();
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
      cycleLabel.textContent = "Hiệp 0/4 (Chưa bắt đầu)";
    } else if (studyState.mode === 'focus') {
      cycleLabel.textContent = `Hiệp ${studyState.cycleIndex}/4 (Tập trung)`;
    } else if (studyState.mode === 'shortbreak') {
      cycleLabel.textContent = `Nghỉ ngắn (${studySettings.shortBreakMins}m) - Sau hiệp ${studyState.cycleIndex > 1 ? studyState.cycleIndex - 1 : 1}`;
    } else if (studyState.mode === 'longbreak') {
      cycleLabel.textContent = `Nghỉ dài (${studySettings.longBreakMins}m) - Hoàn tất chu kỳ 4 hiệp!`;
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
      toast(`☕ Hoàn thành hiệp tập trung! Nghỉ giải lao ${studySettings.shortBreakMins} phút.`);
      if (studySettings.autoStartBreaks) {
        startStudyTimer();
      }
    } else {
      studyState.cycleIndex = 4;
      studyState.mode = 'longbreak';
      studyState.durationMinutes = studySettings.longBreakMins;
      studyState.remainingSeconds = studySettings.longBreakMins * 60;
      toast(`🏆 Hoàn thành trọn vẹn 4 hiệp Pomodoro! Nghỉ dài ${studySettings.longBreakMins} phút.`);
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
    toast(`⏱️ Bắt đầu hiệp tập trung ${studyState.cycleIndex}/4! Hãy giữ nhịp độ.`);
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
        goal: studyState.goal
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
  const durationToCredit = isFocus ? (autoCompleted ? studyState.durationMinutes : totalElapsedMins) : 0;

  if (session && durationToCredit >= 20) {
    try {
      const res = await requestAPI("/api/study/complete", {
        method: "POST",
        body: JSON.stringify({
          durationMinutes: durationToCredit,
          goal: studyState.goal || "Tự học NCKH"
        })
      });
      if (res && res.success) {
        if (res.pointsAwarded > 0) {
          toast(`🎉 Hoàn thành xuất sắc ca tự học ${durationToCredit} phút! +${res.pointsAwarded} điểm đóng góp & giữ chuỗi!`);
        } else {
          toast(`🎉 Hoàn tất ca học ${durationToCredit} phút!`);
        }
        loadContributions();
      }
    } catch (e) {
      console.error(e);
    }
  } else if (durationToCredit >= 20) {
    toast(`🎉 Hoàn thành ca tự học ${durationToCredit} phút! (Đăng nhập để lưu điểm & giữ chuỗi)`);
  } else {
    toast("🎉 Đã hoàn tất ca học!");
  }

  if (!autoCompleted) {
    // Khi bấm hoàn thành: reset thời gian về hiệp 0 và thoát khu vực bàn tròn
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
async function fetchStudyLounge() {
  if (!canAccessStudyLounge()) return;
  try {
    const res = await requestAPI("/api/study/lounge");
    if (!res) return;

    let learners = res.learners || [];

    // If local user is currently studying, guarantee they appear in the live list
    if (studyState.isRunning || (studyState.remainingSeconds < studyState.durationMinutes * 60)) {
      const hasSelf = learners.some(l => l.isSelf || (session && l.userId === session.id));
      if (!hasSelf) {
        const myStreak = getUserStudyStreak();
        learners.unshift({
          userId: session ? session.id : 0,
          name: session ? session.displayName : "Khách",
          role: session ? session.role : "student",
          avatar: session ? (session.initials || "🦊") : "🦊",
          streak: myStreak,
          streakTier: session ? (session.streakTier || 0) : 0,
          goal: studyState.goal || "Nghiên cứu khoa học",
          mode: studyState.mode,
          durationMinutes: studyState.durationMinutes,
          remainingSeconds: studyState.remainingSeconds,
          cycleIndex: studyState.cycleIndex,
          isRunning: studyState.isRunning,
          isSelf: true
        });
      }
    }

    const totalCount = Math.max(res.activeCount || 0, learners.length);
    const badge1 = $("#studyLiveCount");
    const badge2 = $("#coStudyCountBadge");
    if (badge1) badge1.textContent = totalCount;
    if (badge2) badge2.textContent = `${totalCount} người trong phòng`;

    const list = $("#coStudyList");
    if (list) {
      if (learners.length === 0) {
        list.innerHTML = `<div class="co-study-empty">Chưa có ai trong phòng. Bấm <b>Bắt đầu học</b> để là người đầu tiên!</div>`;
      } else {
        const userStreak = getUserStudyStreak();
        const canCheer = userStreak >= 3;

        list.innerHTML = learners.map(l => {
          const tierClass = `tier-${l.streakTier || 0}`;
          const isSelfClass = l.isSelf ? 'is-self' : '';
          const nameDisplay = l.isSelf ? `${escapeHTML(l.name)} (Bạn)` : escapeHTML(l.name);
          const roleBadge = l.role === 'admin' ? '<span class="lb-role lb-role-admin">Admin</span>' : (l.role === 'ta' ? '<span class="lb-role lb-role-ta">TA</span>' : '');
          const statusIcon = l.isRunning ? (l.mode === 'shortbreak' ? '☕' : (l.mode === 'longbreak' ? '🌿' : '🔥')) : '⏸️';
          const remainingMin = Math.ceil((l.remainingSeconds || 0) / 60);

          return `
            <div class="co-study-item ${isSelfClass}">
              <span class="avatar avatar-sm ${tierClass}">${escapeHTML(l.avatar || '🦊')}</span>
              <div class="co-study-info">
                <div class="co-study-name">
                  ${nameDisplay} ${roleBadge}
                </div>
                <div class="co-study-goal">🎯 ${escapeHTML(l.goal || 'Nghiên cứu khoa học')}</div>
              </div>
              <span class="co-study-time">${statusIcon} ${l.isRunning ? `${remainingMin}m` : 'Tạm dừng'}</span>
              ${!l.isSelf && session ? `
                <div class="co-study-cheers">
                  <button class="cheer-btn ${canCheer ? '' : 'locked'}" title="${canCheer ? 'Vỗ tay tán thưởng' : 'Mở khóa ở chuỗi 3 ngày 🔥'}" onclick="${canCheer ? `sendStudyCheer(${l.userId}, '👏')` : 'notifyCheerLocked()'}">👏</button>
                  <button class="cheer-btn ${canCheer ? '' : 'locked'}" title="${canCheer ? 'Mời cà phê tỉnh táo' : 'Mở khóa ở chuỗi 3 ngày 🔥'}" onclick="${canCheer ? `sendStudyCheer(${l.userId}, '☕')` : 'notifyCheerLocked()'}">☕</button>
                  <button class="cheer-btn ${canCheer ? '' : 'locked'}" title="${canCheer ? 'Tiếp lửa quyết tâm' : 'Mở khóa ở chuỗi 3 ngày 🔥'}" onclick="${canCheer ? `sendStudyCheer(${l.userId}, '🔥')` : 'notifyCheerLocked()'}">🔥</button>
                  <button class="cheer-btn ${canCheer ? '' : 'locked'}" title="${canCheer ? 'Gửi tim yêu thương' : 'Mở khóa ở chuỗi 3 ngày 🔥'}" onclick="${canCheer ? `sendStudyCheer(${l.userId}, '❤️')` : 'notifyCheerLocked()'}">❤️</button>
                  <button class="cheer-btn ${canCheer ? '' : 'locked'}" title="${canCheer ? 'Gợi ý ý tưởng sáng tạo' : 'Mở khóa ở chuỗi 3 ngày 🔥'}" onclick="${canCheer ? `sendStudyCheer(${l.userId}, '💡')` : 'notifyCheerLocked()'}">💡</button>
                  <button class="cheer-btn ${canCheer ? '' : 'locked'}" title="${canCheer ? 'Tăng tốc về đích' : 'Mở khóa ở chuỗi 3 ngày 🔥'}" onclick="${canCheer ? `sendStudyCheer(${l.userId}, '🚀')` : 'notifyCheerLocked()'}">🚀</button>
                </div>
              ` : ''}
            </div>
          `;
        }).join("");
      }
    }

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
  }
}

function showCheerToast(c) {
  const toastId = `cheer-${c.id}`;
  if (document.getElementById(toastId)) return;
  const toastEl = document.createElement("div");
  toastEl.id = toastId;
  toastEl.className = "floating-cheer";
  toastEl.innerHTML = `<span>${c.cheerType}</span> <span><b>${escapeHTML(c.senderName)}</b> vừa gửi cổ vũ đến bạn!</span>`;
  document.body.appendChild(toastEl);
  setTimeout(() => {
    if (toastEl.parentElement) toastEl.remove();
  }, 4000);
}

window.notifyCheerLocked = function() {
  toast("🔒 Tính năng Cổ vũ tương tác mở khóa ở Chuỗi 3 ngày (Sinh viên năng động)!");
};

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

  try {
    const res = await requestAPI("/api/study/cheer", {
      method: "POST",
      body: JSON.stringify({ recipientId, cheerType })
    });
    if (res && res.success) {
      toast(`Đã gửi ${cheerType} cổ vũ bạn cùng học!`);
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

function createPinkNoiseBuffer(ctx) {
  const bufferSize = ctx.sampleRate * 3;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
    b6 = white * 0.115926;
  }
  return buffer;
}

function createBrownNoiseBuffer(ctx) {
  const bufferSize = ctx.sampleRate * 3;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let lastOut = 0.0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    data[i] = (lastOut + (0.02 * white)) / 1.02;
    lastOut = data[i];
    data[i] *= 2.5;
  }
  return buffer;
}

function createWhiteNoiseBuffer(ctx) {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.2;
  }
  return buffer;
}

/* --- 6.1 GIAO DIỆN & PHÁT ÂM THANH MÔI TRƯỜNG (4 Âm thanh hỗn hợp sẵn, loop vô tận) --- */
function renderEnvironmentAudioGrid() {
  const grid = $("#envAudioGrid");
  if (!grid) return;

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

  if (DEFAULT_ENV_AUDIO_SOURCES && DEFAULT_ENV_AUDIO_SOURCES[trackId]) {
    let player = studyState.envAudioPlayers[trackId];
    if (!player || player.error) {
      if (player) { try { player.pause(); player.src = ""; } catch (e) {} }
      player = new Audio(DEFAULT_ENV_AUDIO_SOURCES[trackId]);
      player.loop = true; // Phát vòng lặp
      player.preload = "auto";
      studyState.envAudioPlayers[trackId] = player;
    }
    player.volume = Math.max(0, Math.min(1, userVol));
    const playPromise = player.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => {
        if (e.name === "AbortError") return;
        console.warn("Env audio stream error:", e);
        toast("Nhấp vào trang để cho phép phát âm thanh môi trường.");
      });
    }
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
      try {
        ext.pause();
        ext.currentTime = 0;
      } catch (e) {}
    }
    studyState.activeEnvTrack = null;
    updateEnvGridDOM();
  }

  if (studyState.activeCustomEnvId) {
    if (studyState.customEnvAudioPlayer) {
      try {
        studyState.customEnvAudioPlayer.pause();
        studyState.customEnvAudioPlayer.currentTime = 0;
      } catch (e) {}
      studyState.customEnvAudioPlayer = null;
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
  if (studyState.envGainNode && studyState.audioCtx) {
    studyState.envGainNode.gain.setValueAtTime(userVol * 0.28, studyState.audioCtx.currentTime);
  }
}

/* --- 6.2 GIAO DIỆN & PHÁT ÂM THANH PHỐI HỢP (9 Âm thanh đơn lẻ, mix cùng lúc, loop vô tận) --- */
/* --- 6.2 GIAO DIỆN & PHÁT ÂM THANH PHỐI HỢP (9 Âm thanh đơn lẻ, mix cùng lúc, loop vô tận) --- */
function renderMixAudioGrid() {
  const grid = $("#mixAudioGrid");
  if (!grid) return;

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
  const track = MIX_SOUND_TRACKS.find(t => t.id === trackId);
  const isCurrentlyActive = !!studyState.activeMixSounds[trackId];

  if (isCurrentlyActive) {
    // STOP TRACK
    const ext = studyState.mixAudioPlayers[trackId];
    if (ext) {
      try {
        ext.pause();
        ext.currentTime = 0;
      } catch (e) {}
    }
    studyState.activeMixSounds[trackId] = false;
  } else {
    // START TRACK
    const savedVol = studyState.mixVolumes[trackId] ?? (track ? track.defaultVol : 40);
    const userVol = savedVol / 100;

    if (DEFAULT_MIX_AUDIO_SOURCES && DEFAULT_MIX_AUDIO_SOURCES[trackId]) {
      let player = studyState.mixAudioPlayers[trackId];
      if (!player || player.error) {
        if (player) { try { player.pause(); player.src = ""; } catch (e) {} }
        player = new Audio(DEFAULT_MIX_AUDIO_SOURCES[trackId]);
        player.loop = true; // Phát vòng lặp
        player.preload = "auto";
        studyState.mixAudioPlayers[trackId] = player;
      }
      player.volume = Math.max(0, Math.min(1, userVol));
      const playPromise = player.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          if (e.name === "AbortError") return;
          console.warn("Mix stream error:", e);
          toast("Nhấp vào trang để cho phép phát âm thanh.");
        });
      }
      studyState.activeMixSounds[trackId] = true;
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
  const gain = studyState.mixSoundGains[trackId];
  if (gain && studyState.audioCtx) {
    gain.gain.setValueAtTime(userVol * 0.3, studyState.audioCtx.currentTime);
  }
}

/* --- 6.3 GIAO DIỆN & PHÁT ÂM NHẠC TẬP TRUNG (4 Bản nhạc, loop vô tận) --- */
function renderMusicAudioGrid() {
  const grid = $("#musicAudioGrid");
  if (!grid) return;

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

  if (DEFAULT_MUSIC_AUDIO_SOURCES && DEFAULT_MUSIC_AUDIO_SOURCES[trackId]) {
    let player = studyState.musicAudioPlayers[trackId];
    if (!player || player.error) {
      if (player) { try { player.pause(); player.src = ""; } catch (e) {} }
      player = new Audio(DEFAULT_MUSIC_AUDIO_SOURCES[trackId]);
      player.loop = true; // Phát vòng lặp
      player.preload = "auto";
      studyState.musicAudioPlayers[trackId] = player;
    }
    player.volume = Math.max(0, Math.min(1, userVol));
    const playPromise = player.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => {
        if (e.name === "AbortError") return;
        console.warn("Music audio stream error:", e);
        toast("Nhấp vào trang để cho phép phát âm thanh.");
      });
    }
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
      try {
        ext.pause();
        ext.currentTime = 0;
      } catch (e) {}
    }
    studyState.activeMusicTrack = null;
    updateMusicGridDOM();
  }

  if (studyState.activeCustomMusicId) {
    if (studyState.customMusicAudioPlayer) {
      try {
        studyState.customMusicAudioPlayer.pause();
        studyState.customMusicAudioPlayer.currentTime = 0;
      } catch (e) {}
      studyState.customMusicAudioPlayer = null;
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
  if (studyState.musicGainNode && studyState.audioCtx) {
    studyState.musicGainNode.gain.setValueAtTime(userVol * 0.22, studyState.audioCtx.currentTime);
  }
}

function stopAllStudyAudio() {
  stopCurrentEnvAudio();
  stopCurrentMusicAudio();

  // Stop all active mix sounds
  MIX_SOUND_TRACKS.forEach(t => {
    if (studyState.activeMixSounds[t.id]) {
      toggleMixTrack(t.id);
    }
  });

  // Stop all active custom mix sounds
  Object.keys(studyState.activeCustomMixSounds).forEach(id => {
    if (studyState.activeCustomMixSounds[id]) {
      toggleCustomMixAudioPlay(id);
    }
  });

  renderEnvironmentAudioGrid();
  renderMixAudioGrid();
  renderMusicAudioGrid();
  loadCustomAudioFromDB();
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

function renderCustomAudioList(category, containerEl, tracks) {
  if (!containerEl) return;
  if (!tracks || tracks.length === 0) {
    const emptyHints = {
      env: "Chưa có âm thanh môi trường tải lên nào. Bạn có thể tải bài dài yêu thích (mưa, sóng biển, suối...) để phát lặp!",
      mix: "Chưa có âm thanh phối hợp tải lên nào. Bạn có thể tải hiệu ứng âm thanh để mix cùng lúc!",
      music: "Chưa có bản nhạc tải lên nào. Bạn có thể tải các bản nhạc lofi/nhẹ nhàng yêu thích của bạn!"
    };
    containerEl.innerHTML = `<p style="font-size:12px; color:var(--muted); padding:10px 0; margin:0;">${emptyHints[category] || "Chưa có tệp tải lên."}</p>`;
    return;
  }

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
  const input = $("#customEnvAudioInput");
  if (input) input.click();
};

window.triggerUploadMixAudio = function() {
  const input = $("#customMixAudioInput");
  if (input) input.click();
};

window.triggerUploadMusicAudio = function() {
  const input = $("#customMusicAudioInput");
  if (input) input.click();
};

async function handleCustomAudioUpload(file, category) {
  if (!file) return;

  const streak = getUserStudyStreak();
  const isMaxStreak = streak >= 50;

  if (!isMaxStreak && file.size > 50 * 1024 * 1024) {
    toast("Tệp âm thanh quá lớn (tối đa 50MB cho mỗi tệp).");
    return;
  }

  const allTracks = await idbGetAll("custom_audio");
  const countInCategory = allTracks.filter(t => t.category === category).length;
  const maxAllowed = (category === 'mix' ? 5 : 3);
  if (!isMaxStreak && countInCategory >= maxAllowed) {
    toast(`Bạn đã tải tối đa ${maxAllowed} tệp cho mục này. Đạt Chuỗi 50 ngày để mở khóa tải không giới hạn!`);
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
  { id: 'default', name: 'Mặc định RE:SEARCH', style: 'linear-gradient(135deg, rgba(20,24,22,0.95), rgba(12,16,14,0.98))' },
  { id: 'library', name: 'Thư viện cổ Oxford', style: 'linear-gradient(135deg, #1f1d1a 0%, #11100e 100%)' },
  { id: 'cafe', name: 'Góc Cafe ấm áp', style: 'linear-gradient(135deg, #2b1f1a 0%, #17110e 100%)' },
  { id: 'mountain', name: 'Sương mù trên núi', style: 'linear-gradient(135deg, #182226 0%, #0d1417 100%)' },
  { id: 'sunset', name: 'Hoàng hôn giảng đường', style: 'linear-gradient(135deg, #2d1822 0%, #150b10 100%)' },
  { id: 'zen', name: 'Tối giản Than chì (Zen)', style: 'linear-gradient(135deg, #151515 0%, #0a0a0a 100%)' }
];

function renderWallpaperPresets() {
  const cont = $("#wallpaperPresetsList");
  if (!cont) return;
  const streak = getUserStudyStreak();
  const unlocked = streak >= 14;

  cont.innerHTML = WALLPAPER_PRESETS.map(p => {
    const isSelected = studySettings.activeWallpaper === p.id;
    return `
      <div class="preset-thumb-card ${isSelected ? 'selected' : ''}" onclick="${unlocked ? `applyStudyWallpaperPreset('${p.id}')` : `notifyPerkLocked(14, 'Kho hình nền học thuật')`}">
        <div class="preset-thumb-color" style="background: ${p.style};"></div>
        <span>${p.name}</span>
      </div>
    `;
  }).join("");
}

function applyStudyWallpaperPreset(presetId) {
  const p = WALLPAPER_PRESETS.find(x => x.id === presetId);
  if (!p) return;
  studySettings.activeWallpaper = presetId;
  saveStudySettings(false);

  const bgLayer = $("#studyBackgroundLayer");
  if (bgLayer) {
    bgLayer.style.backgroundImage = p.style;
    bgLayer.style.backgroundSize = "cover";
  }
  renderWallpaperPresets();
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
  const unlocked = streak >= 14;

  cont.innerHTML = CLOCK_COLORS.map(c => {
    const isSelected = (studySettings.clockColor || 'default') === c.id;
    return `
      <button type="button" class="clock-color-swatch ${isSelected ? 'active' : ''}" style="background:${c.color};" title="${c.name}" onclick="${unlocked ? `applyClockColor('${c.id}')` : `notifyPerkLocked(14, 'Tinh chỉnh màu sắc đồng hồ')`}"></button>
    `;
  }).join("");
}

function applyClockColor(colorId) {
  const c = CLOCK_COLORS.find(x => x.id === colorId);
  if (!c) return;
  studySettings.clockColor = colorId;
  saveStudySettings(false);

  const clock = $("#timerClock");
  if (clock) {
    clock.style.color = (c.id === 'default' ? '' : c.color);
  }
  const prog = $("#timerProgressCircle");
  if (prog && c.id !== 'default') {
    prog.style.stroke = c.color;
  }
  renderClockColorPicker();
  toast(`Đã đổi màu đồng hồ: ${c.name}`);
}

async function triggerWallpaperUpload() {
  const streak = getUserStudyStreak();
  if (streak < 30) {
    toast("🔒 Tính năng Tải hình nền cá nhân mở khóa ở Chuỗi 30 ngày (Bậc thầy học thuật)!");
    return;
  }
  const input = $("#customWallInput");
  if (input) input.click();
}

async function handleCustomWallpaperUpload(file) {
  if (!file) return;
  const streak = getUserStudyStreak();
  if (streak < 30) {
    toast("🔒 Tính năng Tải hình nền cá nhân mở khóa ở Chuỗi 30 ngày (Bậc thầy học thuật)!");
    return;
  }

  // Chuỗi 50 ngày (Độc nhất vô nhị): Mở khóa tải lên KHÔNG GIỚI HẠN dung lượng ảnh nền!
  const isMaxStreak = streak >= 50;
  if (!isMaxStreak && file.size > 10 * 1024 * 1024) {
    toast("Ảnh nền quá lớn (tối đa 10MB cho chuỗi dưới 50 ngày). Đạt Chuỗi 50 ngày để mở khóa không giới hạn!");
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    const item = {
      id: `wall_${Date.now()}`,
      name: file.name,
      dataUrl,
      createdAt: Date.now()
    };
    await idbPut("custom_wallpapers", item);

    studySettings.activeWallpaper = `custom_${item.id}`;
    saveStudySettings(false);

    const bgLayer = $("#studyBackgroundLayer");
    if (bgLayer) {
      bgLayer.style.backgroundImage = `url(${dataUrl})`;
      bgLayer.style.backgroundSize = "cover";
      bgLayer.style.backgroundPosition = "center";
    }
    const nameEl = $("#customWallName");
    if (nameEl) nameEl.textContent = file.name;
    toast(isMaxStreak ? `✨ [Chuỗi 50 ngày] Đã áp dụng ảnh nền không giới hạn: ${file.name}` : `Đã áp dụng ảnh nền cá nhân: ${file.name}`);
  };
  reader.readAsDataURL(file);
}

/* --- HÀO QUANG & MÀU SẮC GRADIENT ĐỘC QUYỀN (Streak >= 50) --- */
const COLOR_AURAS = [
  { id: 'emerald', name: 'Ngọc Lục Bảo', color: '#2e7d32', glow: 'rgba(46, 125, 50, 0.4)', isGradient: false },
  { id: 'cyan', name: 'Cyber Cyan', color: '#00b4d8', glow: 'rgba(0, 180, 216, 0.4)', isGradient: false },
  { id: 'amber', name: 'Hoàng Hôn Amber', color: '#e76f51', glow: 'rgba(231, 111, 81, 0.4)', isGradient: false },
  { id: 'purple', name: 'Tím Hoàng Gia', color: '#7209b7', glow: 'rgba(114, 9, 183, 0.4)', isGradient: false },
  { id: 'rose', name: 'Thạch Anh Hồng', color: '#e63946', glow: 'rgba(230, 57, 70, 0.4)', isGradient: false },
  { id: 'gold', name: 'Hào Quang Vàng Kim', color: '#d4af37', glow: 'rgba(212, 175, 55, 0.4)', isGradient: false },
  // Exclusive Gradients (Streak 50)
  { id: 'aurora', name: 'Cực Quang Neon (Gradient)', color: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)', glow: 'rgba(0, 242, 254, 0.4)', isGradient: true },
  { id: 'sunset_grad', name: 'Hoàng Kim Sang Trọng (Gradient)', color: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)', glow: 'rgba(246, 211, 101, 0.4)', isGradient: true },
  { id: 'cyberpunk', name: 'Tím Cyberpunk (Gradient)', color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', glow: 'rgba(240, 147, 251, 0.4)', isGradient: true },
  { id: 'cosmic', name: 'Vũ Trụ Huyền Ảo (Gradient)', color: 'linear-gradient(135deg, #5ee7df 0%, #b490ca 100%)', glow: 'rgba(94, 231, 223, 0.4)', isGradient: true }
];

function renderColorPalette() {
  const cont = $("#colorPalettePicker");
  if (!cont) return;
  const streak = getUserStudyStreak();
  const unlocked = streak >= 50;

  cont.innerHTML = COLOR_AURAS.map(c => {
    const isSelected = (studySettings.activeAura === c.id);
    return `
      <button type="button" class="color-swatch ${c.isGradient ? 'gradient' : ''} ${isSelected ? 'active' : ''}" style="background:${c.color};" title="${c.name}" onclick="${unlocked ? `applyColorAura('${c.id}')` : `notifyPerkLocked(50, 'Giao diện độc quyền & Phối màu Gradient')`}"></button>
    `;
  }).join("");
}

function applyColorAura(auraId) {
  const c = COLOR_AURAS.find(x => x.id === auraId);
  if (!c) return;
  studySettings.activeAura = auraId;
  saveStudySettings(false);

  const studyEl = $("#study");
  if (studyEl) {
    if (c.isGradient) {
      studyEl.style.setProperty("--primary", "#4facfe");
      studyEl.style.setProperty("--primary-glow", c.glow);
    } else {
      studyEl.style.setProperty("--primary", c.color);
      studyEl.style.setProperty("--primary-glow", c.glow);
    }
  }
  const progCircle = $("#timerProgressCircle");
  if (progCircle) {
    progCircle.style.stroke = c.isGradient ? "#00f2fe" : c.color;
  }

  renderColorPalette();
  toast(`Đã chuyển giao diện: ${c.name} ✨`);
}

function resetStudyTheme() {
  studySettings.activeWallpaper = 'default';
  studySettings.activeAura = 'emerald';
  studySettings.clockColor = 'default';
  saveStudySettings(false);

  const bgLayer = $("#studyBackgroundLayer");
  if (bgLayer) {
    bgLayer.style.backgroundImage = "";
  }
  const studyEl = $("#study");
  if (studyEl) {
    studyEl.style.removeProperty("--primary");
    studyEl.style.removeProperty("--primary-glow");
  }
  const progCircle = $("#timerProgressCircle");
  if (progCircle) {
    progCircle.style.removeProperty("stroke");
  }
  const clock = $("#timerClock");
  if (clock) {
    clock.style.removeProperty("color");
  }
  const nameEl = $("#customWallName");
  if (nameEl) nameEl.textContent = "Chưa chọn ảnh";

  renderWallpaperPresets();
  renderClockColorPicker();
  renderColorPalette();
  toast("Đã đặt lại giao diện mặc định.");
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
    const title = isFocus ? "🎉 Hoàn thành hiệp tập trung!" : "⏰ Hết giờ nghỉ giải lao!";
    const body = isFocus
      ? "Bạn đã hoàn thành xuất sắc hiệp học. Hãy đứng dậy vươn vai và thư giãn nhé!"
      : "Thời gian nghỉ đã hết. Sẵn sàng bắt đầu hiệp tập trung mới nào!";
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
  fetchStudyLounge();
  loadStudyTodos();
  renderEnvironmentAudioGrid();
  renderMixAudioGrid();
  renderMusicAudioGrid();
  loadCustomAudioFromDB();
  renderWallpaperPresets();
  renderClockColorPicker();
  renderColorPalette();
  updateTimerDisplay();

  // Apply saved clock color
  if (studySettings.clockColor && studySettings.clockColor !== 'default') {
    applyClockColor(studySettings.clockColor);
  }

  // Apply saved theme & aura
  if (studySettings.activeWallpaper && studySettings.activeWallpaper !== 'default') {
    if (studySettings.activeWallpaper.startsWith('custom_')) {
      idbGetAll("custom_wallpapers").then(walls => {
        const wallId = studySettings.activeWallpaper.replace('custom_', '');
        const target = walls.find(w => w.id === wallId);
        if (target && target.dataUrl) {
          const bgLayer = $("#studyBackgroundLayer");
          if (bgLayer) {
            bgLayer.style.backgroundImage = `url(${target.dataUrl})`;
            bgLayer.style.backgroundSize = "cover";
            bgLayer.style.backgroundPosition = "center";
          }
        }
      });
    } else {
      applyStudyWallpaperPreset(studySettings.activeWallpaper);
    }
  }
  if (studySettings.activeAura && studySettings.activeAura !== 'emerald') {
    applyColorAura(studySettings.activeAura);
  }

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

  // Initialize UI components
  renderEnvironmentAudioGrid();
  renderMixAudioGrid();
  renderMusicAudioGrid();
  loadCustomAudioFromDB();
  renderWallpaperPresets();
  renderClockColorPicker();
  renderColorPalette();
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

document.addEventListener("click", () => {
  if (studyState.audioCtx && studyState.audioCtx.state === "suspended") {
    studyState.audioCtx.resume();
  }
}, { once: true });

initStudyLoungeEvents();

renderHome();
renderPosts();
renderDocuments();
const initialRequestedRoute = (location.hash.slice(1) || "home");
if (initialRequestedRoute === "study" && serverMode) {
  go("home");
} else {
  go(initialRequestedRoute);
}
hydrateServer();


