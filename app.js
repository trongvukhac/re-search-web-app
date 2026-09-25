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
  { days: 3, tier: 1, title: "Sinh viên năng động", color: "Xanh lam", desc: "Mở khoá giao diện thẻ thành tích mới" },
  { days: 7, tier: 2, title: "Học giả bền bỉ", color: "Vàng ánh kim", desc: "Mở khoá viền avatar đặc sắc" },
  { days: 14, tier: 3, title: "Nhà nghiên cứu", color: "Tím huyền bí", desc: "Mở khoá màu tên rực rỡ và avatar đặc sắc" },
  { days: 30, tier: 4, title: "Bậc thầy học thuật", color: "Đỏ ruby", desc: "Mở khóa giao diện độc quyền, màu tên rực rỡ và avatar đặc sắc" },
  { days: 50, tier: 5, title: "Độc nhất vô nhị", color: "Gradient tím + đỏ", desc: "Mở khoá giao diện đẳng cấp sang trọng, hào quang rực rỡ đón chờ!" }
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
            <p class="milestone-desc">${m.desc}</p>
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
          <span class="avatar avatar-sm ${getAvatarClass(session?.streakTier, false, session?.role)}" id="replyAvatarLabel" style="${(!session?.role || session?.role === 'student') ? 'background: var(--primary); color: white;' : ''}">${session?.initials || '?'}</span>
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
    go(link.dataset.route);
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
      avatarLabel.style.background = 'var(--primary)';
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
   STUDY LOUNGE CONTROLLER (Phòng Tự Học NCKH)
   ========================================================================== */

let studyState = {
  mode: 'pomodoro', // 'pomodoro' (25), 'deep' (50), 'shortbreak' (5)
  durationMinutes: 25,
  remainingSeconds: 25 * 60,
  isRunning: false,
  timerInterval: null,
  pingInterval: null,
  pollingInterval: null,
  elapsedSessionSeconds: 0,
  goal: '',
  audioCtx: null,
  activeSounds: {
    rain: false,
    cafe: false,
    waves: false
  },
  soundGains: {
    rain: null,
    cafe: null,
    waves: null
  },
  soundSources: {
    rain: null,
    cafe: null,
    waves: null
  }
};

function formatMMSS(totalSecs) {
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateTimerDisplay() {
  const clock = $("#timerClock");
  const progressCircle = $("#timerProgressCircle");
  const label = $("#timerStatusLabel");
  if (!clock) return;

  clock.textContent = formatMMSS(studyState.remainingSeconds);

  const totalSecs = studyState.durationMinutes * 60;
  const progress = totalSecs > 0 ? (1 - studyState.remainingSeconds / totalSecs) : 0;
  // Circumference = 2 * PI * 88 ~= 553
  const offset = 553 * progress;
  if (progressCircle) {
    progressCircle.style.strokeDashoffset = offset;
  }

  if (label) {
    if (studyState.isRunning) {
      label.textContent = studyState.mode === 'shortbreak' ? '☕ Đang nghỉ ngơi' : '🔥 Đang tập trung cao độ';
      label.style.color = 'var(--primary)';
    } else if (studyState.remainingSeconds < totalSecs) {
      label.textContent = '⏸ Đang tạm dừng';
      label.style.color = 'var(--muted)';
    } else {
      label.textContent = 'Sẵn sàng ca học';
      label.style.color = 'var(--muted)';
    }
  }
}

function setStudyMode(mode, duration) {
  if (studyState.isRunning) {
    if (!confirm("Ca học hiện tại đang chạy. Bạn có muốn đổi chế độ và đặt lại thời gian?")) {
      return;
    }
    pauseStudyTimer();
  }
  studyState.mode = mode;
  studyState.durationMinutes = duration;
  studyState.remainingSeconds = duration * 60;
  studyState.elapsedSessionSeconds = 0;

  $$(".study-mode-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.studyMode === mode);
  });

  updateTimerDisplay();
  const startBtn = $("#studyStartBtn");
  const pauseBtn = $("#studyPauseBtn");
  const completeBtn = $("#studyCompleteBtn");
  if (startBtn) startBtn.style.display = "inline-flex";
  if (pauseBtn) pauseBtn.style.display = "none";
  if (completeBtn) completeBtn.style.display = "none";
}

function startStudyTimer() {
  if (studyState.isRunning) return;
  studyState.isRunning = true;
  studyState.goal = ($("#studyGoalInput") ? $("#studyGoalInput").value : "").trim();

  const startBtn = $("#studyStartBtn");
  const pauseBtn = $("#studyPauseBtn");
  const completeBtn = $("#studyCompleteBtn");
  if (startBtn) startBtn.style.display = "none";
  if (pauseBtn) pauseBtn.style.display = "inline-flex";
  if (completeBtn) completeBtn.style.display = studyState.mode !== 'shortbreak' ? "inline-flex" : "none";

  if (studyState.audioCtx && studyState.audioCtx.state === 'suspended') {
    studyState.audioCtx.resume();
  }

  pingStudySession();

  studyState.timerInterval = setInterval(() => {
    if (studyState.remainingSeconds > 0) {
      studyState.remainingSeconds--;
      studyState.elapsedSessionSeconds++;
      updateTimerDisplay();
    } else {
      finishStudySession(true);
    }
  }, 1000);

  if (!studyState.pingInterval) {
    studyState.pingInterval = setInterval(pingStudySession, 40000);
  }

  updateTimerDisplay();
}

function pauseStudyTimer() {
  studyState.isRunning = false;
  if (studyState.timerInterval) {
    clearInterval(studyState.timerInterval);
    studyState.timerInterval = null;
  }
  const startBtn = $("#studyStartBtn");
  const pauseBtn = $("#studyPauseBtn");
  if (startBtn) startBtn.style.display = "inline-flex";
  if (pauseBtn) pauseBtn.style.display = "none";
  updateTimerDisplay();
}

function resetStudyTimer() {
  pauseStudyTimer();
  studyState.remainingSeconds = studyState.durationMinutes * 60;
  studyState.elapsedSessionSeconds = 0;
  const completeBtn = $("#studyCompleteBtn");
  if (completeBtn) completeBtn.style.display = "none";
  updateTimerDisplay();
  if (session) {
    fetch("/api/study/leave", { method: "POST" }).catch(() => {});
  }
}

async function finishStudySession(autoCompleted = false) {
  pauseStudyTimer();
  playChimeSound();

  const totalElapsedMins = Math.round(studyState.elapsedSessionSeconds / 60);
  const isFullSession = autoCompleted && (studyState.mode === 'pomodoro' || studyState.mode === 'deep');
  const durationToCredit = isFullSession ? studyState.durationMinutes : totalElapsedMins;

  if (session && durationToCredit >= 20) {
    try {
      const res = await api("/api/study/complete", {
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
  } else if (durationToCredit >= 25) {
    toast(`🎉 Hoàn thành ca tự học ${durationToCredit} phút! (Đăng nhập để lưu điểm & giữ chuỗi)`);
  } else {
    toast(`Ca học kết thúc (${durationToCredit} phút).`);
  }

  studyState.remainingSeconds = studyState.durationMinutes * 60;
  studyState.elapsedSessionSeconds = 0;
  const completeBtn = $("#studyCompleteBtn");
  if (completeBtn) completeBtn.style.display = "none";
  updateTimerDisplay();
  fetchStudyLounge();
}

async function pingStudySession() {
  if (!session || !studyState.isRunning) return;
  const currentDurationMins = Math.round(studyState.elapsedSessionSeconds / 60);
  try {
    await fetch("/api/study/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goal: studyState.goal,
        durationMinutes: currentDurationMins
      })
    });
  } catch (e) {}
}

async function fetchStudyLounge() {
  try {
    const res = await fetch("/api/study/lounge").then(r => r.json());
    if (!res) return;

    const count = res.activeCount || 0;
    const badge1 = $("#studyLiveCount");
    const badge2 = $("#coStudyCountBadge");
    if (badge1) badge1.textContent = count;
    if (badge2) badge2.textContent = `${count} học giả`;

    const list = $("#coStudyList");
    if (list) {
      if (!res.learners || res.learners.length === 0) {
        list.innerHTML = `<div class="co-study-empty">Chưa có ai trong phòng. Bấm <b>Bắt đầu học</b> để là người đầu tiên!</div>`;
      } else {
        list.innerHTML = res.learners.map(l => {
          const tierClass = `tier-${l.streakTier || 0}`;
          const isSelfClass = l.isSelf ? 'is-self' : '';
          const nameDisplay = l.isSelf ? `${escapeHTML(l.name)} (Bạn)` : escapeHTML(l.name);
          const roleBadge = l.role === 'admin' ? '<span class="lb-role lb-role-admin">Admin</span>' : (l.role === 'ta' ? '<span class="lb-role lb-role-ta">TA</span>' : '');
          
          return `
            <div class="co-study-item ${isSelfClass}">
              <span class="avatar avatar-sm ${tierClass}">${escapeHTML(l.avatar || '🦊')}</span>
              <div class="co-study-info">
                <div class="co-study-name">
                  ${nameDisplay} ${roleBadge}
                </div>
                <div class="co-study-goal">🎯 ${escapeHTML(l.goal || 'Nghiên cứu khoa học')}</div>
              </div>
              <span class="co-study-time">⏱️ ${l.durationMinutes || 0}m</span>
              ${!l.isSelf && session ? `
                <div class="co-study-cheers">
                  <button class="cheer-btn" title="Cổ vũ" onclick="sendStudyCheer(${l.userId}, '👏')">👏</button>
                  <button class="cheer-btn" title="Mời cà phê" onclick="sendStudyCheer(${l.userId}, '☕')">☕</button>
                  <button class="cheer-btn" title="Cố lên" onclick="sendStudyCheer(${l.userId}, '🔥')">🔥</button>
                </div>
              ` : ''}
            </div>
          `;
        }).join("");
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

window.sendStudyCheer = async function(recipientId, cheerType) {
  if (!session) {
    openAuth();
    return;
  }
  try {
    const res = await api("/api/study/cheer", {
      method: "POST",
      body: JSON.stringify({ recipientId, cheerType })
    });
    if (res && res.success) {
      toast(`Đã gửi ${cheerType} cổ vũ bạn cùng học!`);
    }
  } catch (e) {
    toast("Không thể gửi cổ vũ.");
  }
};

/* --- WEB AUDIO SYNTHESIZER (Ambient Sounds, 0 Network Traffic) --- */
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

function createNoiseBuffer(ctx, type) {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let lastOut = 0.0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    if (type === 'rain') {
      data[i] = (lastOut * 0.93) + (white * 0.07);
      lastOut = data[i];
    } else if (type === 'waves') {
      data[i] = (lastOut * 0.985) + (white * 0.015);
      lastOut = data[i];
    } else {
      data[i] = (lastOut * 0.88) + (white * 0.12);
      lastOut = data[i];
    }
  }
  return buffer;
}

function toggleSoundTrack(soundType) {
  const ctx = getAudioContext();
  if (!ctx) {
    toast("Trình duyệt không hỗ trợ âm thanh Web Audio.");
    return;
  }

  const isCurrentlyActive = studyState.activeSounds[soundType];
  const trackBtn = $(`#toggle${capitalize(soundType)}Btn`);
  const trackCard = trackBtn ? trackBtn.closest('.ambient-track') : null;

  if (isCurrentlyActive) {
    try {
      if (studyState.soundSources[soundType]) {
        studyState.soundSources[soundType].stop();
        studyState.soundSources[soundType].disconnect();
      }
    } catch (e) {}
    studyState.soundSources[soundType] = null;
    studyState.activeSounds[soundType] = false;
    if (trackBtn) trackBtn.textContent = "Bật";
    if (trackCard) trackCard.classList.remove('active');
  } else {
    try {
      const buffer = createNoiseBuffer(ctx, soundType);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const gainNode = ctx.createGain();
      const slider = $(`#volume${capitalize(soundType)}`);
      const vol = slider ? (Number(slider.value) / 100) * 0.25 : 0.12;
      gainNode.gain.setValueAtTime(vol, ctx.currentTime);

      const filter = ctx.createBiquadFilter();
      if (soundType === 'rain') {
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, ctx.currentTime);
      } else if (soundType === 'waves') {
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, ctx.currentTime);
      } else {
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, ctx.currentTime);
      }

      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);

      source.start(0);

      studyState.soundSources[soundType] = source;
      studyState.soundGains[soundType] = gainNode;
      studyState.activeSounds[soundType] = true;

      if (trackBtn) trackBtn.textContent = "Tắt";
      if (trackCard) trackCard.classList.add('active');
    } catch (e) {
      console.error(e);
    }
  }
}

function updateSoundVolume(soundType, val) {
  const gain = studyState.soundGains[soundType];
  if (gain && studyState.audioCtx) {
    gain.gain.setValueAtTime((val / 100) * 0.25, studyState.audioCtx.currentTime);
  }
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function playChimeSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3); // A5
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
  } catch (e) {}
}

/* --- TO-DO CHECKLIST MANAGER (localStorage) --- */
const TODO_STORAGE_KEY = "research_study_todos_v1";

function loadStudyTodos() {
  const listEl = $("#studyTodoList");
  if (!listEl) return;
  let todos = [];
  try {
    todos = JSON.parse(localStorage.getItem(TODO_STORAGE_KEY) || "[]");
  } catch (e) {
    todos = [];
  }

  if (todos.length === 0) {
    listEl.innerHTML = `<li class="todo-item" style="color:var(--muted); font-size:12px; justify-content:center;">Chưa có ghi chú nào.</li>`;
    return;
  }

  listEl.innerHTML = todos.map((t, idx) => `
    <li class="todo-item ${t.done ? 'done' : ''}">
      <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleStudyTodo(${idx})" />
      <span>${escapeHTML(t.text)}</span>
      <button class="todo-del-btn" onclick="deleteStudyTodo(${idx})" title="Xoá">×</button>
    </li>
  `).join("");
}

function saveStudyTodos(todos) {
  try {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos));
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
    todos = JSON.parse(localStorage.getItem(TODO_STORAGE_KEY) || "[]");
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
    todos = JSON.parse(localStorage.getItem(TODO_STORAGE_KEY) || "[]");
  } catch (e) {}
  if (todos[idx]) {
    todos[idx].done = !todos[idx].done;
    saveStudyTodos(todos);
  }
};

window.deleteStudyTodo = function(idx) {
  let todos = [];
  try {
    todos = JSON.parse(localStorage.getItem(TODO_STORAGE_KEY) || "[]");
  } catch (e) {}
  todos.splice(idx, 1);
  saveStudyTodos(todos);
};

function clearCompletedTodos() {
  let todos = [];
  try {
    todos = JSON.parse(localStorage.getItem(TODO_STORAGE_KEY) || "[]");
  } catch (e) {}
  todos = todos.filter(t => !t.done);
  saveStudyTodos(todos);
}

/* --- ROUTE LIFECYCLE --- */
function onEnterStudyLounge() {
  fetchStudyLounge();
  loadStudyTodos();
  updateTimerDisplay();

  if (!studyState.pollingInterval) {
    studyState.pollingInterval = setInterval(fetchStudyLounge, 25000);
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
      const duration = Number(btn.dataset.duration) || 25;
      setStudyMode(mode, duration);
    };
  });

  const startBtn = $("#studyStartBtn");
  if (startBtn) startBtn.onclick = startStudyTimer;

  const pauseBtn = $("#studyPauseBtn");
  if (pauseBtn) pauseBtn.onclick = pauseStudyTimer;

  const resetBtn = $("#studyResetBtn");
  if (resetBtn) resetBtn.onclick = resetStudyTimer;

  const completeBtn = $("#studyCompleteBtn");
  if (completeBtn) completeBtn.onclick = () => finishStudySession(false);

  const rainBtn = $("#toggleRainBtn");
  if (rainBtn) rainBtn.onclick = () => toggleSoundTrack('rain');
  const cafeBtn = $("#toggleCafeBtn");
  if (cafeBtn) cafeBtn.onclick = () => toggleSoundTrack('cafe');
  const waveBtn = $("#toggleWaveBtn");
  if (waveBtn) waveBtn.onclick = () => toggleSoundTrack('waves');

  const volRain = $("#volumeRain");
  if (volRain) volRain.oninput = (e) => updateSoundVolume('rain', e.target.value);
  const volCafe = $("#volumeCafe");
  if (volCafe) volCafe.oninput = (e) => updateSoundVolume('cafe', e.target.value);
  const volWave = $("#volumeWave");
  if (volWave) volWave.oninput = (e) => updateSoundVolume('waves', e.target.value);

  const masterAmbientBtn = $("#toggleAmbientMaster");
  if (masterAmbientBtn) {
    masterAmbientBtn.onclick = () => {
      const anyActive = Object.values(studyState.activeSounds).some(v => v);
      if (anyActive) {
        ['rain', 'cafe', 'waves'].forEach(s => {
          if (studyState.activeSounds[s]) toggleSoundTrack(s);
        });
        masterAmbientBtn.textContent = "Bật tất cả";
      } else {
        ['rain', 'cafe', 'waves'].forEach(s => {
          if (!studyState.activeSounds[s]) toggleSoundTrack(s);
        });
        masterAmbientBtn.textContent = "Tắt tất cả";
      }
    };
  }

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
}

initStudyLoungeEvents();

renderHome();
renderPosts();
renderDocuments();
go(location.hash.slice(1) || "home");
hydrateServer();


