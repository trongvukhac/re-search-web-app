/* RE:SEARCH — Sổ tay khám phá, Lịch tháng, Mở Rương x1/x10, Túi đồ & Vật phẩm Đấu trường */

const VN_TZ = "Asia/Ho_Chi_Minh";

function getVNDateKey(dateObj = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: VN_TZ }).format(dateObj);
}

function getVNDateParts(dateObj = new Date()) {
  const key = getVNDateKey(dateObj);
  const [y, m, d] = key.split("-").map(Number);
  return { year: y, month: m, day: d, dateKey: key, yearMonth: `${y}-${String(m).padStart(2, "0")}` };
}

function getDaysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function getVNMSTimestamp() {
  return Date.now();
}

const DAILY_TASKS_CONFIG = [
  { key: "login", label: "Đăng nhập", energy: 5, points: 0, maxEnergyPerDay: 5, maxPointsPerDay: 0, space: "chung" },
  { key: "light_streak", label: "Thắp sáng chuỗi", energy: 10, points: 0, maxEnergyPerDay: 10, maxPointsPerDay: 0, space: "chung" },
  { key: "read_post", label: "Đọc bài đăng (1 phút)", energy: 10, points: 0, maxEnergyPerDay: 10, maxPointsPerDay: 0, space: "dien_dan" },
  { key: "read_doc", label: "Đọc tài liệu (1 phút)", energy: 10, points: 0, maxEnergyPerDay: 10, maxPointsPerDay: 0, space: "dien_dan" },
  { key: "create_post", label: "Đăng bài thảo luận", energy: 35, points: 3, maxEnergyPerDay: 35, maxPointsPerDay: 6, contribEventType: "post_created", space: "dien_dan" },
  { key: "reply_post", label: "Phản hồi bài đăng", energy: 30, points: 2, maxEnergyPerDay: 30, maxPointsPerDay: 4, contribEventType: "response_created", space: "dien_dan" },
  { key: "study_25m", label: "Tự học 25 phút", energy: 35, points: 2, maxEnergyPerDay: 35, maxPointsPerDay: 2, contribEventType: "study_session", space: "tu_hoc" },
  { key: "arena_play", label: "Tham gia 1 lượt thi đấu trường", energy: 20, points: 0, maxEnergyPerDay: 20, maxPointsPerDay: 0, space: "chung" },
  { key: "active_60m", label: "Hoạt động 60 phút", energy: 65, points: 0, maxEnergyPerDay: 65, maxPointsPerDay: 0, space: "chung" }
];

const DAILY_TASK_MAP = new Map(DAILY_TASKS_CONFIG.map(t => [t.key, t]));

const STUDY_WALLPAPER_CATALOG = [
  { key: "thao_nguyen_ky_bi", name: "Thảo nguyên kỳ bí", cssBg: "linear-gradient(135deg, #14532d 0%, #22c55e 50%, #86efac 100%)", imageUrl: "/public/assets/wallpapers/thao-nguyen-ky-bi.webp", isExchangeEvent: true },
  { key: "sky_observatory", name: "Chinh phục bầu trời", cssBg: "linear-gradient(135deg, #0369a1 0%, #0284c7 50%, #38bdf8 100%)", imageUrl: "/covers/chinh-phuc-bau-troi.webp", isSeasonReward: true }
];

// Chỉ dùng các Khung/Ảnh bìa giới hạn (loại trừ đặc quyền Mùa AS1 và vật phẩm chuỗi)
const DECOR_TRIAL_POOL = [
  { decorType: "frame", itemId: "ton_vinh_phai_dep", name: "Khung Tôn vinh phái đẹp" },
  { decorType: "frame", itemId: "bua_tiec_ma_mi", name: "Khung Bữa tiệc ma mị" },
  { decorType: "frame", itemId: "phep_mau_mua_dong", name: "Khung Phép màu mùa đông" },
  { decorType: "cover", itemId: "ton_vinh_phai_dep", name: "Ảnh bìa Tôn vinh phái đẹp" },
  { decorType: "cover", itemId: "bua_tiec_ma_mi", name: "Ảnh bìa Bữa tiệc ma mị" },
  { decorType: "cover", itemId: "phep_mau_mua_dong", name: "Ảnh bìa Phép màu mùa đông" }
];

const BANNER_CYCLE_EPOCH_MS = Date.parse("2026-12-01T00:00:00+07:00");
const BANNER_CYCLE_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

const EXCHANGE_BANNER_CATALOG = [
  {
    cycleCode: "cycle_1",
    name: "Thảo nguyên kỳ bí",
    bannerImageUrl: "/public/assets/banners/thao-nguyen-ky-bi.webp",
    rewards: [
      { rewardKey: "frame", name: "Thảo nguyên kỳ bí", subLabel: "Khung thẻ tên", decorType: "frame", decorId: "thao_nguyen_ky_bi", cost: 1 },
      { rewardKey: "cover", name: "Thảo nguyên kỳ bí", subLabel: "Ảnh bìa thẻ tên", decorType: "cover", decorId: "thao_nguyen_ky_bi", imageUrl: "/covers/thao-nguyen-ky-bi.webp", cost: 1 },
      { rewardKey: "study_bg", name: "Thảo nguyên kỳ bí", subLabel: "Hình nền Phòng tự học", bgKey: "thao_nguyen_ky_bi", imageUrl: "/public/assets/wallpapers/thao-nguyen-ky-bi.webp", cssBg: "linear-gradient(135deg, #14532d 0%, #22c55e 50%, #86efac 100%)", cost: 1 }
    ]
  },
  {
    cycleCode: "cycle_2",
    name: "Phép màu mùa đông",
    rewards: [
      { rewardKey: "frame", name: "Khung Phép màu mùa đông", subLabel: "Khung thẻ tên", decorType: "frame", decorId: "phep_mau_mua_dong", cost: 1 },
      { rewardKey: "cover", name: "Ảnh bìa Phép màu mùa đông", subLabel: "Ảnh bìa thẻ tên", decorType: "cover", decorId: "phep_mau_mua_dong", imageUrl: "/covers/phepmaumuadong.webp", cost: 1 },
      { rewardKey: "study_bg", name: "Nhà gỗ Mùa đông", subLabel: "Ảnh nền Phòng tự học", bgKey: "winter_cabin", imageUrl: "/covers/vuong-quoc-mua-dong.webp", cssBg: "linear-gradient(135deg, #164e63 0%, #0e7490 50%, #67e8f9 100%)", cost: 1 }
    ]
  },
  {
    cycleCode: "cycle_3",
    name: "Kỷ nguyên hoàng kim",
    rewards: [
      { rewardKey: "frame", name: "Khung Kỷ nguyên hoàng kim", subLabel: "Khung thẻ tên", decorType: "frame", decorId: "gold", cost: 1 },
      { rewardKey: "cover", name: "Ảnh bìa Kỷ nguyên hoàng kim", subLabel: "Ảnh bìa thẻ tên", decorType: "cover", decorId: "ky_nguyen_hoang_kim", imageUrl: "/covers/ky-nguyen-hoang-kim.webp", cost: 1 },
      { rewardKey: "study_bg", name: "Đại sảnh Hoàng kim", subLabel: "Ảnh nền Phòng tự học", bgKey: "golden_hall", imageUrl: "/covers/ky-nguyen-hoang-kim.webp", cssBg: "linear-gradient(135deg, #78350f 0%, #b45309 50%, #fbbf24 100%)", cost: 1 }
    ]
  }
];

function getActiveExchangeBanner(nowMs = Date.now()) {
  const startMs = BANNER_CYCLE_EPOCH_MS;
  const endMs = startMs + BANNER_CYCLE_DURATION_MS; // 2026-12-31T00:00:00+07:00 (hết 30/12/2026)
  const tpl = EXCHANGE_BANNER_CATALOG[0];
  const isOpen = nowMs >= startMs && nowMs < endMs;
  const status = nowMs < startMs ? "upcoming" : (nowMs < endMs ? "open" : "ended");
  return {
    cycleIndex: 0,
    bannerKey: `${tpl.cycleCode}_0`,
    name: tpl.name,
    imageUrl: tpl.bannerImageUrl || "/public/assets/banners/thao-nguyen-ky-bi.webp",
    tokenItemKey: "mythic_mushroom",
    tokenName: "Nấm thần kỳ",
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(endMs).toISOString(),
    isOpen,
    status,
    startsInMs: Math.max(0, startMs - nowMs),
    remainingMs: Math.max(0, endMs - nowMs),
    rewards: tpl.rewards
  };
}

const ITEM_METADATA = {
  pts_1: { name: "1 Điểm hoạt động", category: "diem", rarity: "common", desc: "Cộng trực tiếp 1 điểm hoạt động vào bảng xếp hạng tuần.", whereUsed: "Hệ thống điểm" },
  pts_2: { name: "2 Điểm hoạt động", category: "diem", rarity: "common", desc: "Cộng trực tiếp 2 điểm hoạt động vào bảng xếp hạng tuần.", whereUsed: "Hệ thống điểm" },
  pts_3: { name: "3 Điểm hoạt động", category: "diem", rarity: "rare", desc: "Cộng trực tiếp 3 điểm hoạt động vào bảng xếp hạng tuần.", whereUsed: "Hệ thống điểm" },
  pts_5: { name: "5 Điểm hoạt động", category: "diem", rarity: "epic", desc: "Cộng trực tiếp 5 điểm hoạt động vào bảng xếp hạng tuần.", whereUsed: "Hệ thống điểm" },

  shield_normal: { name: "Khiên Thường", category: "khien", rarity: "common", durationDays: 3, desc: "Kích hoạt ngay khi nhận. Tự động bảo vệ chuỗi nếu lỡ bỏ lỡ 1 ngày (Hạn 3 ngày).", whereUsed: "Chuỗi học tập" },
  shield_sparkle: { name: "Khiên Lấp Lánh", category: "khien", rarity: "rare", durationDays: 7, desc: "Kích hoạt ngay khi nhận. Khiên cao cấp bảo vệ chuỗi (Hạn 7 ngày).", whereUsed: "Chuỗi học tập" },
  shield_radiant: { name: "Khiên Long Lanh", category: "khien", rarity: "legendary", durationDays: 30, desc: "Kích hoạt ngay khi nhận. Siêu hiếm bảo vệ chuỗi bền bỉ suốt 30 ngày.", whereUsed: "Chuỗi học tập" },
  shield_milestone: { name: "Khiên Bền Bỉ", category: "khien", rarity: "rare", durationDays: null, desc: "Khiên vĩnh viễn không hết hạn nhận từ quà khởi đầu hoặc đạt mốc chuỗi.", whereUsed: "Chuỗi học tập" },

  arena_loupe_1: { name: "Kính lúp thường", category: "dau_truong", rarity: "common", desc: "Loại bỏ ngẫu nhiên 1 đáp án sai ở câu hỏi hiện tại.", whereUsed: "Đấu trường (Trong trận)" },
  arena_loupe_2: { name: "Kính lúp vạn năng", category: "dau_truong", rarity: "rare", desc: "Loại bỏ ngẫu nhiên 2 đáp án sai ở câu hỏi hiện tại.", whereUsed: "Đấu trường (Trong trận)" },
  arena_hourglass: { name: "Đồng hồ cát", category: "dau_truong", rarity: "common", desc: "Ngưng đọng đồng hồ đếm ngược câu hỏi trong 5s / 10s / 15s theo cấp.", whereUsed: "Đấu trường (Trong trận)" },
  arena_lamp: { name: "Đèn thần", category: "dau_truong", rarity: "common", desc: "Mở 1 gợi ý tư duy cho bất kỳ câu hỏi nào trong lúc thi.", whereUsed: "Đấu trường (Trong trận)" },
  arena_hammer: { name: "Búa thần", category: "dau_truong", rarity: "rare", desc: "Phá bỏ giới hạn 60s ở câu hiện tại và giữ trọn vẹn 60 sao nếu trả lời đúng.", whereUsed: "Đấu trường (Trong trận)" },
  arena_eye: { name: "Mắt thần", category: "dau_truong_hiem", rarity: "epic", desc: "Áp dụng cả chặng: cho biết đáp án vừa chọn đúng hay sai và được chọn lại khi sai (tổng tiêu hao 1 / 3 / 5 lần).", whereUsed: "Đấu trường (Chuẩn bị vào trận)" },
  arena_cloak: { name: "Áo choàng tiên tri", category: "dau_truong_hiem", rarity: "epic", desc: "Áp dụng cả chặng: sau khi xong 10 câu sẽ báo các câu đang chọn sai để sửa lại tối đa 1 / 2 / 3 câu.", whereUsed: "Đấu trường (Chuẩn bị vào trận)" },

  double_pts_1: { name: "Thẻ x2 Điểm (Cấp I)", category: "the_diem", rarity: "rare", bonusCap: 5, desc: "Nhân đôi điểm hoạt động nhận được (tối đa cộng thêm 5 điểm).", whereUsed: "Kích hoạt trong Túi đồ" },
  double_pts_2: { name: "Thẻ x2 Điểm (Cấp II)", category: "the_diem", rarity: "epic", bonusCap: 10, desc: "Nhân đôi điểm hoạt động nhận được (tối đa cộng thêm 10 điểm).", whereUsed: "Kích hoạt trong Túi đồ" },
  double_pts_3: { name: "Thẻ x2 Điểm (Cấp III)", category: "the_diem", rarity: "legendary", bonusCap: 15, desc: "Nhân đôi điểm hoạt động nhận được (tối đa cộng thêm 15 điểm).", whereUsed: "Kích hoạt trong Túi đồ" },

  trial_decor: { name: "Thẻ trang trí hạn giờ", category: "trang_tri", rarity: "epic", desc: "Tự động mở dùng thử Khung hoặc Ảnh bìa giới hạn trong 1 / 3 / 7 ngày. Trùng món đã có quy đổi điểm hoạt động.", whereUsed: "Thẻ tên cá nhân" },

  mythic_mushroom: { name: "Nấm thần kỳ", category: "cuc_pham", rarity: "mythic", desc: "Vật phẩm Cực phẩm vĩnh viễn không hạn dùng. Dùng để đổi Khung thẻ tên, Ảnh bìa hoặc Ảnh nền Phòng tự học tại mục Đổi thưởng giới hạn (làm mới danh mục theo từng kỳ). Có thể tích trữ chờ các kỳ sau.", whereUsed: "Đổi thưởng giới hạn" }
};

// Bảng tỷ lệ rơi Rương May Mắn (5 bậc: Thường, Phổ thông - Xanh lam, Hiếm - Tím, Siêu hiếm - Vàng, Cực phẩm - Đỏ)
const GACHA_TABLE = [
  // 1. Điểm hoạt động
  { itemKey: "pts_1", level: 1, qty: 1, weight: 130, rarity: "common" },
  { itemKey: "pts_2", level: 1, qty: 2, weight: 70, rarity: "common" },
  { itemKey: "pts_3", level: 1, qty: 3, weight: 20, rarity: "rare" },
  { itemKey: "pts_5", level: 1, qty: 5, weight: 12, rarity: "epic" },

  // 2. Khiên bảo vệ chuỗi (3 ngày, 7 ngày, 30 ngày - Siêu hiếm)
  { itemKey: "shield_normal", level: 1, qty: 1, durationDays: 3, weight: 125, rarity: "common" },
  { itemKey: "shield_sparkle", level: 2, qty: 1, durationDays: 7, weight: 32, rarity: "rare" },
  { itemKey: "shield_radiant", level: 3, qty: 1, durationDays: 30, weight: 6, rarity: "legendary" },

  // 3. Vật phẩm hỗ trợ Đấu trường - Thường & Phổ thông
  { itemKey: "arena_loupe_1", level: 1, qty: 1, weight: 120, rarity: "common" },
  { itemKey: "arena_loupe_1", level: 1, qty: 2, weight: 55, rarity: "common" },
  { itemKey: "arena_loupe_1", level: 1, qty: 3, weight: 14, rarity: "rare" },

  { itemKey: "arena_loupe_2", level: 1, qty: 1, weight: 32, rarity: "rare" },
  { itemKey: "arena_loupe_2", level: 1, qty: 2, weight: 14, rarity: "rare" },
  { itemKey: "arena_loupe_2", level: 1, qty: 3, weight: 5, rarity: "epic" },

  { itemKey: "arena_hourglass", level: 1, qty: 1, freezeSeconds: 5, weight: 95, rarity: "common" },
  { itemKey: "arena_hourglass", level: 2, qty: 1, freezeSeconds: 10, weight: 24, rarity: "rare" },
  { itemKey: "arena_hourglass", level: 3, qty: 1, freezeSeconds: 15, weight: 10, rarity: "epic" },

  { itemKey: "arena_lamp", level: 1, qty: 1, weight: 120, rarity: "common" },
  { itemKey: "arena_lamp", level: 1, qty: 2, weight: 48, rarity: "common" },
  { itemKey: "arena_lamp", level: 1, qty: 3, weight: 18, rarity: "rare" },

  { itemKey: "arena_hammer", level: 1, qty: 1, weight: 24, rarity: "rare" },
  { itemKey: "arena_hammer", level: 1, qty: 2, weight: 10, rarity: "epic" },
  { itemKey: "arena_hammer", level: 1, qty: 3, weight: 6, rarity: "legendary" },

  // 4. Vật phẩm Đấu trường - Hiếm & Siêu hiếm
  { itemKey: "arena_eye", level: 1, qty: 1, charges: 1, weight: 15, rarity: "epic" },
  { itemKey: "arena_eye", level: 2, qty: 1, charges: 3, weight: 8, rarity: "epic" },
  { itemKey: "arena_eye", level: 3, qty: 1, charges: 5, weight: 6, rarity: "legendary" },

  { itemKey: "arena_cloak", level: 1, qty: 1, fixLimit: 1, weight: 15, rarity: "epic" },
  { itemKey: "arena_cloak", level: 2, qty: 1, fixLimit: 2, weight: 8, rarity: "epic" },
  { itemKey: "arena_cloak", level: 3, qty: 1, fixLimit: 3, weight: 6, rarity: "legendary" },

  // 5. Thẻ nhân đôi điểm hoạt động (I: 5đ, II: 10đ, III: 15đ)
  { itemKey: "double_pts_1", level: 1, qty: 1, bonusCap: 5, weight: 26, rarity: "rare" },
  { itemKey: "double_pts_2", level: 2, qty: 1, bonusCap: 10, weight: 14, rarity: "epic" },
  { itemKey: "double_pts_3", level: 3, qty: 1, bonusCap: 15, weight: 8, rarity: "legendary" },

  // 6. Vật phẩm trang trí (1n/3n/7n)
  { itemKey: "trial_decor", level: 1, qty: 1, durationDays: 1, convertPts: 1, weight: 12, rarity: "rare" },
  { itemKey: "trial_decor", level: 2, qty: 1, durationDays: 3, convertPts: 2, weight: 7, rarity: "epic" },
  { itemKey: "trial_decor", level: 3, qty: 1, durationDays: 7, convertPts: 3, weight: 5, rarity: "legendary" },

  // 7. Cực phẩm (Đỏ) - Nấm thần kỳ: xác suất rơi tự nhiên rất thấp (< mỗi món Vàng), chủ yếu nhận qua bảo hiểm 50 lượt
  { itemKey: "mythic_mushroom", level: 1, qty: 1, weight: 2, rarity: "mythic" }
];

function initHandbookTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_energy_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date_key TEXT NOT NULL,
      total_energy INTEGER NOT NULL DEFAULT 0,
      tasks_json TEXT NOT NULL DEFAULT '{}',
      active_seconds INTEGER NOT NULL DEFAULT 0,
      key_awarded INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, date_key)
    );

    CREATE TABLE IF NOT EXISTS user_chest_wallet (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      keys_count INTEGER NOT NULL DEFAULT 0,
      pity_counter INTEGER NOT NULL DEFAULT 0,
      total_opened INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_key TEXT NOT NULL,
      category TEXT NOT NULL,
      rarity TEXT NOT NULL DEFAULT 'common',
      level INTEGER NOT NULL DEFAULT 1,
      quantity INTEGER NOT NULL DEFAULT 1,
      remaining_bonus INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT DEFAULT NULL,
      activated_at TEXT DEFAULT NULL,
      meta_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_user_inventory_user ON user_inventory(user_id, item_key);

    CREATE TABLE IF NOT EXISTS chest_open_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      open_mode TEXT NOT NULL DEFAULT 'x1',
      item_key TEXT NOT NULL,
      item_name TEXT NOT NULL,
      rarity TEXT NOT NULL DEFAULT 'common',
      quantity INTEGER NOT NULL DEFAULT 1,
      is_converted INTEGER NOT NULL DEFAULT 0,
      converted_points INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_study_backgrounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bg_key TEXT NOT NULL,
      expires_at TEXT,
      unlocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, bg_key)
    );

    CREATE TABLE IF NOT EXISTS competition_phase_rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL REFERENCES weekly_competitions(id) ON DELETE CASCADE,
      phase INTEGER NOT NULL CHECK(phase IN (1, 2, 3)),
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      class_code TEXT NOT NULL,
      rank INTEGER NOT NULL,
      points_awarded INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(competition_id, phase, user_id)
    );
  `);

  try { db.exec("ALTER TABLE user_study_backgrounds ADD COLUMN expires_at TEXT;"); } catch (e) { }

  const qCols = db.prepare("PRAGMA table_info(competition_questions)").all().map(c => c.name);
  if (!qCols.includes("hint")) {
    try { db.exec("ALTER TABLE competition_questions ADD COLUMN hint TEXT"); } catch (e) { }
  }
  if (!qCols.includes("option_d")) {
    try { db.exec("ALTER TABLE competition_questions ADD COLUMN option_d TEXT"); } catch (e) { }
  }

  const sessCols = db.prepare("PRAGMA table_info(competition_sessions)").all().map(c => c.name);
  if (!sessCols.includes("active_items_json")) {
    try { db.exec("ALTER TABLE competition_sessions ADD COLUMN active_items_json TEXT NOT NULL DEFAULT '{}'"); } catch (e) { }
  }
  if (!sessCols.includes("item_effects_json")) {
    try { db.exec("ALTER TABLE competition_sessions ADD COLUMN item_effects_json TEXT NOT NULL DEFAULT '{}'"); } catch (e) { }
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_mythic_unlocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      month_key TEXT NOT NULL,
      item_key TEXT NOT NULL,
      unlocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, month_key, item_key)
    );

    CREATE TABLE IF NOT EXISTS user_banner_redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      banner_key TEXT NOT NULL,
      reward_key TEXT NOT NULL,
      redeemed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, banner_key, reward_key)
    );

    CREATE TABLE IF NOT EXISTS admin_gift_claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reward_kind TEXT NOT NULL CHECK(reward_kind IN ('keys', 'item')),
      item_key TEXT,
      level INTEGER NOT NULL DEFAULT 1,
      quantity INTEGER NOT NULL DEFAULT 1,
      item_name TEXT NOT NULL,
      cta_label TEXT NOT NULL,
      claimed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const walletCols = db.prepare("PRAGMA table_info(user_chest_wallet)").all().map(c => c.name);
  const walletAdditions = [
    ["month_key", "TEXT NOT NULL DEFAULT ''"],
    ["month_opened", "INTEGER NOT NULL DEFAULT 0"],
    ["pity_10", "INTEGER NOT NULL DEFAULT 0"],
    ["pity_50", "INTEGER NOT NULL DEFAULT 0"],
    ["pity_60_claimed", "INTEGER NOT NULL DEFAULT 0"],
    ["pity_70_claimed", "INTEGER NOT NULL DEFAULT 0"],
    ["pity_80_claimed", "INTEGER NOT NULL DEFAULT 0"]
  ];
  for (const [colName, colDef] of walletAdditions) {
    if (!walletCols.includes(colName)) {
      try { db.exec(`ALTER TABLE user_chest_wallet ADD COLUMN ${colName} ${colDef}`); } catch (e) { }
    }
  }

  try {
    const shieldCols = db.prepare("PRAGMA table_info(user_streak_shields)").all().map(c => c.name);
    if (!shieldCols.includes("shields_migrated")) {
      db.exec("ALTER TABLE user_streak_shields ADD COLUMN shields_migrated INTEGER NOT NULL DEFAULT 0");
    }
  } catch (e) { }

  // Đồng bộ kích hoạt ngay lập tức cho mọi khiên đang tồn tại & chuyển khiên cũ trước cập nhật thành Khiên Thường
  try {
    const nowIso = new Date().toISOString();
    const legacyExpiresIso = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(`
      UPDATE user_inventory
      SET activated_at = COALESCE(activated_at, created_at, ?)
      WHERE category = 'khien' AND activated_at IS NULL
    `).run(nowIso);
    db.prepare(`
      UPDATE user_inventory
      SET item_key = 'shield_normal',
          rarity = 'common',
          level = 1,
          expires_at = COALESCE(expires_at, ?),
          activated_at = COALESCE(activated_at, ?),
          meta_json = '{"source":"legacy_migrated","durationDays":3}'
      WHERE item_key = 'shield_milestone' AND meta_json LIKE '%milestone_migrated%'
    `).run(legacyExpiresIso, nowIso);
  } catch (e) { }
}

function getMaxShieldsForStreak(streak) {
  const s = Number(streak) || 0;
  if (s >= 365) return 8;
  if (s >= 200) return 6;
  if (s >= 100) return 5;
  if (s >= 50) return 4;
  return 3;
}

function purgeExpiredInventory(db, userId) {
  const hasExpired = db.prepare(`
    SELECT 1 FROM user_inventory
    WHERE user_id = ? AND (quantity <= 0 OR (expires_at IS NOT NULL AND julianday(expires_at) <= julianday('now')))
    LIMIT 1
  `).get(userId);
  if (!hasExpired) return;
  db.prepare(`
    DELETE FROM user_inventory
    WHERE user_id = ? AND (quantity <= 0 OR (expires_at IS NOT NULL AND julianday(expires_at) <= julianday('now')))
  `).run(userId);
}

function getInventoryShieldsCount(db, userId, skipPurge = false) {
  if (!skipPurge) purgeExpiredInventory(db, userId);
  const row = db.prepare(`
    SELECT coalesce(sum(quantity), 0) as total
    FROM user_inventory
    WHERE user_id = ? AND category = 'khien' AND quantity > 0
  `).get(userId);
  return Number(row?.total || 0);
}

function getLowestPriorityShieldRow(db, userId) {
  return db.prepare(`
    SELECT id, item_key, rarity, quantity, expires_at
    FROM user_inventory
    WHERE user_id = ? AND category = 'khien' AND quantity > 0
    ORDER BY
      CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END ASC,
      CASE WHEN expires_at IS NULL THEN 999999999.0 ELSE julianday(expires_at) END ASC,
      CASE rarity
        WHEN 'common' THEN 1
        WHEN 'rare' THEN 2
        WHEN 'epic' THEN 3
        WHEN 'legendary' THEN 4
        ELSE 5
      END ASC,
      id ASC
    LIMIT 1
  `).get(userId);
}

function decrementInventoryRow(db, row) {
  if (!row) return;
  if (Number(row.quantity) > 1) {
    db.prepare("UPDATE user_inventory SET quantity = quantity - 1 WHERE id = ?").run(row.id);
  } else {
    db.prepare("DELETE FROM user_inventory WHERE id = ?").run(row.id);
  }
}

function syncStreakShieldsTableCount(db, userId, total) {
  try {
    db.prepare("UPDATE user_streak_shields SET shields = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(total, userId);
  } catch (e) { }
}

function reconcileUserShields(db, userId, maxShields = 3) {
  if (!userId) return 0;
  const nowIso = new Date().toISOString();
  const cap = Math.max(1, Number(maxShields) || 3);
  let legacyShieldCount = null;

  try {
    const legacyRow = db.prepare("SELECT shields, shields_migrated FROM user_streak_shields WHERE user_id = ?").get(userId);
    if (legacyRow) {
      legacyShieldCount = Number(legacyRow.shields);
      if (!legacyRow.shields_migrated) {
        const legacyCount = Math.max(0, legacyShieldCount || 0);
        if (legacyCount > 0) {
          for (let i = 0; i < legacyCount; i++) {
            addInventoryStackItem(db, userId, "shield_normal", 1, 1, {
              rarity: "common",
              durationDays: 3,
              activatedAt: nowIso,
              meta: { source: "legacy_migrated", durationDays: 3 }
            });
          }
        }
        db.prepare("UPDATE user_streak_shields SET shields_migrated = 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(userId);
      }
    }
  } catch (e) { }

  const needsActivation = db.prepare(`
    SELECT 1 FROM user_inventory
    WHERE user_id = ? AND category = 'khien' AND activated_at IS NULL
    LIMIT 1
  `).get(userId);
  if (needsActivation) {
    db.prepare(`
      UPDATE user_inventory
      SET activated_at = COALESCE(activated_at, created_at, ?)
      WHERE user_id = ? AND category = 'khien' AND activated_at IS NULL
    `).run(nowIso, userId);
  }

  purgeExpiredInventory(db, userId);
  let total = getInventoryShieldsCount(db, userId, true);

  while (total > cap) {
    const dropRow = getLowestPriorityShieldRow(db, userId);
    if (!dropRow) break;
    decrementInventoryRow(db, dropRow);
    total -= 1;
  }

  if (legacyShieldCount === null || legacyShieldCount !== total) {
    syncStreakShieldsTableCount(db, userId, total);
  }
  return total;
}

function getShieldPriorityTuple(durationDays, expiresAt, rarity) {
  const isPerm = (!durationDays && !expiresAt) ? 1 : 0;
  const expMs = isPerm
    ? Number.MAX_SAFE_INTEGER
    : (durationDays ? Date.now() + durationDays * 24 * 60 * 60 * 1000 : (expiresAt ? Date.parse(expiresAt) : 0));
  const rarMap = { common: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
  return { isPerm, expMs: Number.isFinite(expMs) ? expMs : 0, rarRank: rarMap[rarity] || 1 };
}

function isShieldStrictlyStronger(incoming, existingRow) {
  if (!existingRow) return true;
  const a = getShieldPriorityTuple(incoming.durationDays, incoming.expiresAt, incoming.rarity);
  const b = getShieldPriorityTuple(null, existingRow.expires_at, existingRow.rarity);
  if (a.isPerm !== b.isPerm) return a.isPerm > b.isPerm;
  if (!a.isPerm && Math.abs(a.expMs - b.expMs) > 60000) return a.expMs > b.expMs;
  return a.rarRank > b.rarRank;
}

function grantShieldWithCapacity(db, userId, itemKey, level, durationDays, rarity, maxShields = 3, qty = 1) {
  if (!userId) return 0;
  const cap = Math.max(1, Number(maxShields) || 3);
  const amount = Math.max(1, Number(qty) || 1);
  const nowIso = new Date().toISOString();
  const resolvedRarity = rarity || ITEM_METADATA[itemKey]?.rarity || "common";

  for (let i = 0; i < amount; i++) {
    let total = reconcileUserShields(db, userId, cap);
    if (total >= cap) {
      const dropRow = getLowestPriorityShieldRow(db, userId);
      if (dropRow && !isShieldStrictlyStronger({ durationDays, expiresAt: null, rarity: resolvedRarity }, dropRow)) {
        // Không ghi đè khiên đang có thời hạn/phẩm chất cao hơn hoặc tương đương — giữ nguyên khiên tốt hơn
        continue;
      }
      if (dropRow) {
        decrementInventoryRow(db, dropRow);
      }
    }
    addInventoryStackItem(db, userId, itemKey, level || 1, 1, {
      durationDays: durationDays || null,
      expiresAt: null,
      activatedAt: nowIso,
      rarity: resolvedRarity,
      meta: durationDays ? { durationDays } : { permanent: true }
    });
  }

  return reconcileUserShields(db, userId, cap);
}

function consumeSoonestInventoryShield(db, userId) {
  purgeExpiredInventory(db, userId);
  const shieldRow = getLowestPriorityShieldRow(db, userId);
  if (!shieldRow) return false;
  decrementInventoryRow(db, shieldRow);
  const left = getInventoryShieldsCount(db, userId);
  syncStreakShieldsTableCount(db, userId, left);
  return shieldRow;
}

function applyActiveDoubleBonus(db, userId, basePoints, sourceLabel) {
  const pts = Math.max(0, Math.floor(Number(basePoints) || 0));
  if (pts <= 0) return 0;

  const activeCard = db.prepare(`
    SELECT id, item_key, level, remaining_bonus
    FROM user_inventory
    WHERE user_id = ? AND category = 'the_diem' AND activated_at IS NOT NULL AND remaining_bonus > 0
    ORDER BY activated_at ASC, id ASC
    LIMIT 1
  `).get(userId);

  if (!activeCard) return 0;
  const bonus = Math.min(pts, Number(activeCard.remaining_bonus || 0));
  if (bonus <= 0) return 0;

  const left = Number(activeCard.remaining_bonus) - bonus;
  if (left <= 0) {
    db.prepare("DELETE FROM user_inventory WHERE id = ?").run(activeCard.id);
  } else {
    db.prepare("UPDATE user_inventory SET remaining_bonus = ? WHERE id = ?").run(left, activeCard.id);
  }

  db.prepare(`
    INSERT INTO contribution_events (user_id, event_type, points, reference_type, reference_id, reason)
    VALUES (?, 'double_card_bonus', ?, 'inventory', ?, ?)
  `).run(userId, bonus, activeCard.id, `Thẻ x2 điểm (${sourceLabel || "Hoạt động"}): +${bonus}đ`);

  return bonus;
}

function grantActivityPointsWithDouble(db, userId, eventType, points, refType, refId, reason) {
  const cleanPts = Math.floor(Number(points) || 0);
  if (cleanPts <= 0) return 0;

  db.prepare(`
    INSERT INTO contribution_events (user_id, event_type, points, reference_type, reference_id, reason)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, eventType, cleanPts, refType || null, refId || null, reason || eventType);

  const extra = applyActiveDoubleBonus(db, userId, cleanPts, reason || eventType);
  return cleanPts + extra;
}

function getOrCreateDailyLog(db, userId, dateKey = getVNDateKey()) {
  let row = db.prepare("SELECT * FROM daily_energy_logs WHERE user_id = ? AND date_key = ?").get(userId, dateKey);
  if (!row) {
    db.prepare(`
      INSERT OR IGNORE INTO daily_energy_logs (user_id, date_key, total_energy, tasks_json, active_seconds, key_awarded)
      VALUES (?, ?, 0, '{}', 0, 0)
    `).run(userId, dateKey);
    row = db.prepare("SELECT * FROM daily_energy_logs WHERE user_id = ? AND date_key = ?").get(userId, dateKey);
  }
  return row;
}

function getOrCreateChestWallet(db, userId) {
  const currentMonthKey = getVNDateParts().yearMonth;
  let w = db.prepare("SELECT * FROM user_chest_wallet WHERE user_id = ?").get(userId);
  if (!w) {
    db.prepare(`
      INSERT OR IGNORE INTO user_chest_wallet (user_id, keys_count, pity_counter, total_opened, month_key, month_opened, pity_10, pity_50, pity_60_claimed, pity_70_claimed, pity_80_claimed)
      VALUES (?, 0, 0, 0, ?, 0, 0, 0, 0, 0, 0)
    `).run(userId, currentMonthKey);
    w = db.prepare("SELECT * FROM user_chest_wallet WHERE user_id = ?").get(userId);
  } else if (w.month_key !== currentMonthKey) {
    // Hết tháng: giữ nguyên số chìa khóa (keys_count) và tiến trình pity_10 / pity_50 (chu kỳ banner tự reset theo mốc 30 ngày)
    db.prepare(`
      UPDATE user_chest_wallet
      SET month_key = ?, month_opened = 0, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(currentMonthKey, userId);
    w = db.prepare("SELECT * FROM user_chest_wallet WHERE user_id = ?").get(userId);
  }
  return w;
}

function getUserMushroomCount(db, userId) {
  if (!userId) return 0;
  const row = db.prepare("SELECT coalesce(sum(quantity), 0) as total FROM user_inventory WHERE user_id = ? AND item_key = 'mythic_mushroom' AND quantity > 0").get(userId);
  return Number(row?.total || 0);
}

function getExchangeBannerForUser(db, userId) {
  const banner = getActiveExchangeBanner();
  const redeemedRows = userId
    ? db.prepare("SELECT reward_key FROM user_banner_redemptions WHERE user_id = ? AND banner_key = ?").all(userId, banner.bannerKey)
    : [];
  const redeemedSet = new Set(redeemedRows.map(r => r.reward_key));
  return {
    ...banner,
    mushroomCount: getUserMushroomCount(db, userId),
    rewards: banner.rewards.map(r => ({
      ...r,
      redeemed: redeemedSet.has(r.rewardKey)
    }))
  };
}

function getGuaranteeStatus(db, userId, wallet = null) {
  const w = wallet || getOrCreateChestWallet(db, userId);
  const pity10 = Number(w.pity_10 || 0);
  const pity50 = Number(w.pity_50 || 0);
  return {
    monthKey: w.month_key || getVNDateParts().yearMonth,
    totalOpened: Number(w.total_opened || 0),
    pity10Count: pity10,
    rareIn10Remaining: Math.max(1, 10 - pity10),
    pity50Count: pity50,
    mythicIn50Remaining: Math.max(1, 50 - pity50),
    mushroomCount: getUserMushroomCount(db, userId)
  };
}

function recordDailyTaskProgress(db, userId, actionKey, refId = null) {
  if (!userId) return { ok: false };
  const cfg = DAILY_TASK_MAP.get(actionKey);
  if (!cfg) return { ok: false };

  const dateKey = getVNDateKey();
  const row = getOrCreateDailyLog(db, userId, dateKey);
  let tasks = {};
  try { tasks = JSON.parse(row.tasks_json || "{}"); } catch { tasks = {}; }

  const cur = tasks[actionKey] || { energyEarned: 0, pointsEarned: 0, count: 0 };
  let addedEnergy = 0;
  let addedPoints = 0;

  if (cur.energyEarned < cfg.maxEnergyPerDay) {
    addedEnergy = Math.min(cfg.energy, cfg.maxEnergyPerDay - cur.energyEarned);
    cur.energyEarned += addedEnergy;
  }
  if (cfg.points > 0 && cur.pointsEarned < cfg.maxPointsPerDay && !cfg.contribEventType) {
    addedPoints = Math.min(cfg.points, cfg.maxPointsPerDay - cur.pointsEarned);
    cur.pointsEarned += addedPoints;
  }

  if (addedEnergy === 0 && addedPoints === 0) {
    return { ok: true, alreadyCompleted: true, addedEnergy: 0, addedPoints: 0, totalEnergy: row.total_energy, keyAwardedNow: false };
  }

  cur.count = (cur.count || 0) + 1;
  tasks[actionKey] = cur;

  const newTotalEnergy = (row.total_energy || 0) + addedEnergy;
  let keyAwardedNow = false;
  let newKeyAwardedFlag = row.key_awarded ? 1 : 0;

  if (newTotalEnergy >= 100 && !newKeyAwardedFlag) {
    newKeyAwardedFlag = 1;
    keyAwardedNow = true;
    getOrCreateChestWallet(db, userId);
    db.prepare("UPDATE user_chest_wallet SET keys_count = keys_count + 3, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(userId);
  }

  db.prepare(`
    UPDATE daily_energy_logs
    SET total_energy = ?, tasks_json = ?, key_awarded = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(newTotalEnergy, JSON.stringify(tasks), newKeyAwardedFlag, row.id);

  if (addedPoints > 0 && !cfg.contribEventType) {
    grantActivityPointsWithDouble(db, userId, `handbook_${actionKey}`, addedPoints, "handbook", refId || 0, `Sổ tay khám phá: ${cfg.label}`);
  }

  if (actionKey === "light_streak" || actionKey === "create_post" || actionKey === "reply_post" || actionKey === "study_25m") {
    db.prepare("INSERT OR IGNORE INTO activity_days (user_id, activity_date) VALUES (?, ?)").run(userId, dateKey);
  }

  return {
    ok: true,
    actionKey,
    label: cfg.label,
    addedEnergy,
    addedPoints,
    totalEnergy: newTotalEnergy,
    keyAwardedNow
  };
}

function getMonthlyEnergyCalendar(db, userId, dateObj = new Date()) {
  const { year, month, day: todayDay } = getVNDateParts(dateObj);
  const daysInMonth = getDaysInMonth(year, month);
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;

  const rows = db.prepare(`
    SELECT date_key, total_energy
    FROM daily_energy_logs
    WHERE user_id = ? AND date_key LIKE ?
  `).all(userId, `${prefix}%`);

  const energyByDate = new Map();
  for (const r of rows) {
    energyByDate.set(r.date_key, Number(r.total_energy || 0));
  }

  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dk = `${prefix}${String(d).padStart(2, "0")}`;
    const energy = energyByDate.get(dk) || 0;
    let level = 0;
    if (energy >= 150) level = 4;
    else if (energy >= 100) level = 3;
    else if (energy >= 50) level = 2;
    else if (energy > 0) level = 1;

    days.push({
      day: d,
      dateKey: dk,
      energy,
      level,
      isToday: d === todayDay
    });
  }

  return { year, month, daysInMonth, monthLabel: `Tháng ${month}/${year}`, days };
}

function addInventoryStackItem(db, userId, itemKey, level, qty, extra = {}) {
  const meta = ITEM_METADATA[itemKey] || { name: itemKey, category: "khac", rarity: "common" };
  const expiresAt = extra.durationDays
    ? new Date(Date.now() + extra.durationDays * 24 * 60 * 60 * 1000).toISOString()
    : (extra.expiresAt || null);

  // Vật phẩm tiêu hao vĩnh viễn không hạn (Đấu trường) -> gộp stack theo (item_key, level)
  if (!expiresAt && meta.category !== "the_diem" && meta.category !== "trang_tri") {
    const existing = db.prepare(`
      SELECT id, quantity FROM user_inventory
      WHERE user_id = ? AND item_key = ? AND level = ? AND expires_at IS NULL
      LIMIT 1
    `).get(userId, itemKey, level || 1);
    if (existing) {
      db.prepare("UPDATE user_inventory SET quantity = quantity + ? WHERE id = ?").run(qty, existing.id);
      return existing.id;
    }
  }

  // Thẻ khiên có hạn dùng 3n / 7n -> tạo dòng riêng theo hạn mới nhận để không ghi đè hạn của khiên cũ
  const info = db.prepare(`
    INSERT INTO user_inventory (user_id, item_key, category, rarity, level, quantity, remaining_bonus, expires_at, activated_at, meta_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    itemKey,
    meta.category,
    extra.rarity || meta.rarity || "common",
    level || 1,
    qty || 1,
    extra.bonusCap || 0,
    expiresAt,
    extra.activatedAt || null,
    JSON.stringify(extra.meta || {})
  );
  return info.lastInsertRowid;
}

function rollWeightedReward(options = {}) {
  const { minRarity = null, excludedKeys = new Set(), exactItemKey = null, suppressEarlyEpic = false } = typeof options === "boolean"
    ? { minRarity: options ? "epic" : null }
    : options;

  if (exactItemKey) {
    const exact = GACHA_TABLE.find(e => e.itemKey === exactItemKey);
    if (exact) return exact;
  }

  const rarityRank = { common: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
  const minRank = minRarity ? (rarityRank[minRarity] || 1) : 1;

  let pool = GACHA_TABLE.filter(e => {
    if (excludedKeys && excludedKeys.has(e.itemKey)) return false;
    return (rarityRank[e.rarity] || 1) >= minRank;
  });
  if (!pool.length) {
    pool = GACHA_TABLE.filter(e => !(excludedKeys && excludedKeys.has(e.itemKey)));
  }

  // Cơ chế ngầm: trước lượt thứ 7 kể từ lần reset gần nhất, giảm mạnh xác suất ra Hiếm (Tím), Siêu hiếm (Vàng) & Cực phẩm (Đỏ)
  const weightedPool = pool.map(e => {
    let w = Number(e.weight) || 1;
    if (suppressEarlyEpic && minRank < 3) {
      if (e.rarity === "mythic") {
        w = Math.max(0.05, w * 0.04);
      } else if (e.rarity === "epic" || e.rarity === "legendary") {
        w = Math.max(0.2, w * 0.08);
      }
    }
    return { entry: e, w };
  });

  const totalWeight = weightedPool.reduce((sum, x) => sum + x.w, 0);
  let r = Math.random() * totalWeight;
  for (const x of weightedPool) {
    r -= x.w;
    if (r <= 0) return x.entry;
  }
  return weightedPool[0].entry;
}

function formatRolledDisplayName(entry, extraMeta = {}) {
  const base = ITEM_METADATA[entry.itemKey]?.name || entry.itemKey;
  if (entry.itemKey === "arena_hourglass") return `${base} (${entry.freezeSeconds}s)`;
  if (entry.itemKey === "arena_eye") return `${base} Cấp ${entry.level === 1 ? "I" : entry.level === 2 ? "II" : "III"} (${entry.charges} lượt)`;
  if (entry.itemKey === "arena_cloak") return `${base} Cấp ${entry.level === 1 ? "I" : entry.level === 2 ? "II" : "III"} (${entry.fixLimit} câu)`;
  if (entry.itemKey === "shield_normal") return `${base} (3 ngày)`;
  if (entry.itemKey === "shield_sparkle") return `${base} (7 ngày)`;
  if (entry.itemKey === "shield_radiant") return `${base} (30 ngày)`;
  if (entry.itemKey === "shield_milestone") return `${base} (Vĩnh viễn)`;
  if (entry.itemKey === "trial_decor") return `${extraMeta.decorName || base} (${entry.durationDays} ngày)`;
  if (entry.itemKey === "study_bg") return `Nền tự học: ${extraMeta.bgName || base}`;
  if (entry.itemKey.startsWith("pts_") || entry.itemKey.startsWith("mythic_")) return base;
  return entry.qty > 1 ? `${base} x${entry.qty}` : base;
}

function processChestRollForUser(db, userId, entry, userRow, ctxOpts = {}) {
  const nowIso = new Date().toISOString();
  const isPrivileged = userRow && (userRow.role === "admin" || userRow.role === "ta");

  // 1. Điểm hoạt động
  if (entry.itemKey.startsWith("pts_")) {
    const awarded = grantActivityPointsWithDouble(db, userId, "gacha_points", entry.qty, "chest", 0, `Điểm hoạt động nhận từ Rương may mắn (+${entry.qty}đ)`);
    return {
      itemKey: entry.itemKey,
      name: formatRolledDisplayName(entry),
      rarity: entry.rarity,
      category: "diem",
      quantity: entry.qty,
      awardedPoints: awarded,
      isConverted: false,
      convertedPoints: 0,
      autoActivated: true
    };
  }

  // 2. Khiên bảo vệ chuỗi (3 ngày / 7 ngày / 30 ngày) — kích hoạt ngay khi nhận & thay thế theo hạn/phẩm chất nếu đầy
  if (entry.itemKey.startsWith("shield_")) {
    const cap = Math.max(3, Number(ctxOpts.maxShields) || 3);
    const totalAfter = grantShieldWithCapacity(
      db,
      userId,
      entry.itemKey,
      entry.level,
      entry.durationDays,
      entry.rarity,
      cap,
      1
    );
    return {
      itemKey: entry.itemKey,
      name: formatRolledDisplayName(entry),
      rarity: entry.rarity,
      category: "khien",
      quantity: 1,
      durationDays: entry.durationDays,
      totalShieldsAfter: totalAfter,
      maxShields: cap,
      isConverted: false,
      convertedPoints: 0,
      autoActivated: true
    };
  }

  // 3. Thẻ trang trí thử nghiệm (Khung / Ảnh bìa 1n, 3n, 7n) -> Tự kích hoạt + Đưa vào túi đồ
  if (entry.itemKey === "trial_decor") {
    const pick = DECOR_TRIAL_POOL[Math.floor(Math.random() * DECOR_TRIAL_POOL.length)];
    // Kiểm tra xem người dùng đã sở hữu vĩnh viễn chưa (hoặc Admin có sẵn tất cả)
    const permOwned = isPrivileged || Boolean(
      db.prepare("SELECT 1 FROM user_limited_items WHERE user_id = ? AND item_type = ? AND item_id = ? AND expires_at IS NULL").get(userId, pick.decorType, pick.itemId)
    );

    if (permOwned) {
      const convPts = entry.convertPts || 3;
      grantActivityPointsWithDouble(db, userId, "gacha_convert", convPts, "chest", 0, `Quy đổi thẻ trang trí trùng (${pick.name}): +${convPts}đ`);
      return {
        itemKey: entry.itemKey,
        name: formatRolledDisplayName(entry, { decorName: pick.name }),
        rarity: entry.rarity,
        category: "trang_tri",
        quantity: 1,
        isConverted: true,
        convertedPoints: convPts,
        autoActivated: false
      };
    }

    const expIso = new Date(Date.now() + entry.durationDays * 24 * 60 * 60 * 1000).toISOString();
    // Kích hoạt vào user_limited_items và đeo luôn lên thẻ tên người dùng!
    const existingLim = db.prepare("SELECT expires_at FROM user_limited_items WHERE user_id = ? AND item_type = ? AND item_id = ?").get(userId, pick.decorType, pick.itemId);
    let finalExpiresIso = expIso;
    if (existingLim) {
      const baseMs = Math.max(Date.now(), existingLim.expires_at ? new Date(existingLim.expires_at).getTime() : Date.now());
      finalExpiresIso = new Date(baseMs + entry.durationDays * 24 * 60 * 60 * 1000).toISOString();
      db.prepare("UPDATE user_limited_items SET expires_at = ? WHERE user_id = ? AND item_type = ? AND item_id = ?").run(finalExpiresIso, userId, pick.decorType, pick.itemId);
    } else {
      db.prepare("INSERT INTO user_limited_items (user_id, item_type, item_id, unlocked_at, expires_at) VALUES (?, ?, ?, ?, ?)").run(userId, pick.decorType, pick.itemId, nowIso, finalExpiresIso);
    }

    // Tự động kích hoạt (đeo ngay)
    if (pick.decorType === "frame") {
      db.prepare("UPDATE users SET namecard_frame = ? WHERE id = ?").run(pick.itemId, userId);
    } else {
      db.prepare("UPDATE users SET cover_image = ? WHERE id = ?").run(pick.itemId, userId);
    }

    // Lưu vào túi đồ để hiển thị thời gian thử còn lại
    const existingInvTrial = db.prepare(`
      SELECT id FROM user_inventory
      WHERE user_id = ? AND item_key = 'trial_decor' AND json_extract(meta_json, '$.itemId') = ? AND json_extract(meta_json, '$.decorType') = ?
      LIMIT 1
    `).get(userId, pick.itemId, pick.decorType);

    if (existingInvTrial) {
      db.prepare("UPDATE user_inventory SET expires_at = ?, activated_at = ?, level = ? WHERE id = ?")
        .run(finalExpiresIso, nowIso, entry.level, existingInvTrial.id);
    } else {
      addInventoryStackItem(db, userId, "trial_decor", entry.level, 1, {
        expiresAt: finalExpiresIso,
        activatedAt: nowIso,
        rarity: entry.rarity,
        meta: { decorType: pick.decorType, itemId: pick.itemId, decorName: pick.name, durationDays: entry.durationDays }
      });
    }

    return {
      itemKey: entry.itemKey,
      name: formatRolledDisplayName(entry, { decorName: pick.name }),
      rarity: entry.rarity,
      category: "trang_tri",
      quantity: 1,
      durationDays: entry.durationDays,
      expiresAt: finalExpiresIso,
      decorType: pick.decorType,
      decorId: pick.itemId,
      isConverted: false,
      convertedPoints: 0,
      autoActivated: true
    };
  }

  // 4. Ảnh nền Phòng tự học -> trùng hoặc danh mục không còn ảnh rương quy đổi +2đ
  if (entry.itemKey === "study_bg") {
    const eligibleBgs = STUDY_WALLPAPER_CATALOG.filter((b) => !b.isExchangeEvent && !b.isSeasonReward);
    const bgPick = eligibleBgs.length ? eligibleBgs[Math.floor(Math.random() * eligibleBgs.length)] : null;
    if (!bgPick) {
      const convPts = 2;
      grantActivityPointsWithDouble(db, userId, "gacha_convert", convPts, "chest", 0, `Quy đổi ảnh nền tự học: +2đ`);
      return {
        itemKey: entry.itemKey,
        name: "Ảnh nền Phòng tự học",
        rarity: entry.rarity,
        category: "trang_tri",
        quantity: 1,
        isConverted: true,
        convertedPoints: convPts,
        autoActivated: false
      };
    }
    const owned = db.prepare("SELECT 1 FROM user_study_backgrounds WHERE user_id = ? AND bg_key = ?").get(userId, bgPick.key);
    if (owned) {
      const convPts = 2;
      grantActivityPointsWithDouble(db, userId, "gacha_convert", convPts, "chest", 0, `Quy đổi ảnh nền tự học trùng (${bgPick.name}): +2đ`);
      return {
        itemKey: entry.itemKey,
        name: formatRolledDisplayName(entry, { bgName: bgPick.name }),
        rarity: entry.rarity,
        category: "trang_tri",
        quantity: 1,
        isConverted: true,
        convertedPoints: convPts,
        autoActivated: false
      };
    }

    db.prepare("INSERT OR IGNORE INTO user_study_backgrounds (user_id, bg_key) VALUES (?, ?)").run(userId, bgPick.key);
    addInventoryStackItem(db, userId, "study_bg", 1, 1, {
      rarity: entry.rarity,
      meta: { bgKey: bgPick.key, bgName: bgPick.name, imageUrl: bgPick.imageUrl, cssBg: bgPick.cssBg }
    });
    return {
      itemKey: entry.itemKey,
      name: formatRolledDisplayName(entry, { bgName: bgPick.name }),
      rarity: entry.rarity,
      category: "trang_tri",
      quantity: 1,
      bgKey: bgPick.key,
      bgName: bgPick.name,
      isConverted: false,
      convertedPoints: 0,
      autoActivated: false
    };
  }

  // 4b. Vật phẩm Cực phẩm: Nấm thần kỳ (vĩnh viễn, cộng dồn không hạn dùng)
  if (entry.itemKey === "mythic_mushroom") {
    addInventoryStackItem(db, userId, "mythic_mushroom", 1, 1, {
      rarity: "mythic",
      meta: { pixelArt: true }
    });
    return {
      itemKey: "mythic_mushroom",
      name: ITEM_METADATA.mythic_mushroom.name,
      rarity: "mythic",
      category: "cuc_pham",
      quantity: 1,
      isConverted: false,
      convertedPoints: 0,
      autoActivated: false
    };
  }

  // 5. Vật phẩm Đấu trường & Thẻ x2 điểm
  const extraMeta = {};
  if (entry.freezeSeconds) extraMeta.freezeSeconds = entry.freezeSeconds;
  if (entry.charges) extraMeta.charges = entry.charges;
  if (entry.fixLimit) extraMeta.fixLimit = entry.fixLimit;
  if (entry.bonusCap) extraMeta.bonusCap = entry.bonusCap;

  addInventoryStackItem(db, userId, entry.itemKey, entry.level, entry.qty, {
    rarity: entry.rarity,
    bonusCap: entry.bonusCap || 0,
    meta: extraMeta
  });

  return {
    itemKey: entry.itemKey,
    name: formatRolledDisplayName(entry),
    rarity: entry.rarity,
    category: ITEM_METADATA[entry.itemKey]?.category || "dau_truong",
    level: entry.level,
    quantity: entry.qty,
    isConverted: false,
    convertedPoints: 0,
    autoActivated: false,
    ...extraMeta
  };
}

function getFormattedUserInventory(db, userId) {
  purgeExpiredInventory(db, userId);
  const rows = db.prepare(`
    SELECT * FROM user_inventory
    WHERE user_id = ? AND quantity > 0
    ORDER BY
      CASE rarity
        WHEN 'mythic' THEN 1
        WHEN 'legendary' THEN 2
        WHEN 'epic' THEN 3
        WHEN 'rare' THEN 4
        ELSE 5
      END,
      level DESC,
      id DESC
  `).all(userId);

  const nowMs = Date.now();
  const rarityRank = { mythic: 5, legendary: 4, epic: 3, rare: 2, common: 1 };
  const mapped = rows.map(r => {
    let meta = {};
    try { meta = JSON.parse(r.meta_json || "{}"); } catch { meta = {}; }
    const base = ITEM_METADATA[r.item_key] || { name: r.item_key, desc: "", whereUsed: "" };
    let displayName = base.name;
    let levelRoman = r.level === 3 ? "III" : (r.level === 2 ? "II" : "I");

    if (r.item_key === "arena_hourglass") {
      displayName = `${base.name} (${meta.freezeSeconds || r.level * 5}s)`;
    } else if (r.item_key === "arena_eye") {
      displayName = `${base.name} Cấp ${levelRoman}`;
    } else if (r.item_key === "arena_cloak") {
      displayName = `${base.name} Cấp ${levelRoman}`;
    } else if (r.item_key === "trial_decor") {
      displayName = meta.decorName || base.name;
    } else if (r.item_key === "study_bg" || r.item_key === "mythic_study_bg") {
      displayName = meta.bgName || base.name;
    } else if (r.item_key === "mythic_cover" || r.item_key === "mythic_frame") {
      displayName = meta.decorName || base.name;
    }

    const remainingMs = r.expires_at ? Math.max(0, new Date(r.expires_at).getTime() - nowMs) : null;
    return {
      id: r.id,
      itemKey: r.item_key,
      name: displayName,
      category: r.category,
      rarity: r.rarity,
      level: r.level,
      quantity: r.quantity,
      remainingBonus: r.remaining_bonus || 0,
      expiresAt: r.expires_at,
      remainingSeconds: remainingMs !== null ? Math.ceil(remainingMs / 1000) : null,
      activated: Boolean(r.activated_at),
      desc: base.desc,
      whereUsed: base.whereUsed,
      meta
    };
  });

  // Gộp các vật phẩm cùng loại (cùng itemKey + level / bgKey / decorId) thành 1 ô duy nhất trong Túi đồ
  const groupedMap = new Map();
  for (const item of mapped) {
    const subKey = item.itemKey === "study_bg"
      ? `study_bg::${item.meta?.bgKey || item.name}`
      : item.itemKey === "trial_decor"
        ? `trial_decor::${item.meta?.decorType || ""}::${item.meta?.decorId || item.name}`
        : `${item.itemKey}::${item.level}`;

    if (!groupedMap.has(subKey)) {
      groupedMap.set(subKey, {
        ...item,
        batches: [item],
        activatedCount: item.activated ? item.quantity : 0,
        unactivatedCount: item.activated ? 0 : item.quantity
      });
    } else {
      const grp = groupedMap.get(subKey);
      grp.quantity += item.quantity;
      grp.batches.push(item);
      if (item.activated) grp.activatedCount += item.quantity;
      else grp.unactivatedCount += item.quantity;
      if ((rarityRank[item.rarity] || 1) > (rarityRank[grp.rarity] || 1)) {
        grp.rarity = item.rarity;
      }
      if (!grp.activated && item.activated) {
        grp.activated = true;
      }
      if (item.remainingBonus > grp.remainingBonus) {
        grp.remainingBonus = item.remainingBonus;
      }
    }
  }

  return Array.from(groupedMap.values()).sort((a, b) => {
    const rDiff = (rarityRank[b.rarity] || 1) - (rarityRank[a.rarity] || 1);
    if (rDiff !== 0) return rDiff;
    return (b.level || 1) - (a.level || 1);
  });
}

function awardArenaPhasePoints(db, competitionId, phase) {
  const comp = db.prepare("SELECT * FROM weekly_competitions WHERE id = ?").get(competitionId);
  if (!comp) return { awarded: 0 };

  const phasePtsMap = {
    1: [5, 4, 3, 2, 1],
    2: [6, 5, 4, 3, 2],
    3: [9, 7, 5, 3, 2]
  };
  const tierPts = phasePtsMap[phase] || phasePtsMap[1];

  const rows = db.prepare(`
    SELECT r.user_id as userId, r.best_score as score, u.student_id as studentId, u.class_name as className,
           coalesce(s.remaining_seconds, 0) as remSec
    FROM competition_phase_results r
    JOIN users u ON u.id = r.user_id
    LEFT JOIN competition_sessions s ON s.id = r.best_session_id
    WHERE r.competition_id = ? AND r.phase = ? AND r.best_score > 0
      AND u.role NOT IN ('admin', 'ta', 'lecturer', 'member')
    ORDER BY r.best_score DESC, remSec DESC, r.user_id ASC
  `).all(competitionId, phase);

  const classes = ["06", "07", "TD"];
  let awarded = 0;

  for (const cls of classes) {
    const classRows = rows.filter(p => {
      const sId = String(p.studentId || "").trim();
      const cName = String(p.className || "").trim();
      if (cls === "06") return cName === "261_71RESE30312_06" || (!cName && sId);
      if (cls === "07") return cName === "261_71RESE30312_07";
      return cName !== "261_71RESE30312_06" && cName !== "261_71RESE30312_07";
    });

    for (let i = 0; i < classRows.length; i++) {
      const p = classRows[i];
      const rank = i + 1;
      const existing = db.prepare("SELECT 1 FROM competition_phase_rewards WHERE competition_id = ? AND phase = ? AND user_id = ?").get(competitionId, phase, p.userId);
      if (existing) continue;

      let pts = tierPts[4];
      if (rank === 1) pts = tierPts[0];
      else if (rank === 2) pts = tierPts[1];
      else if (rank === 3) pts = tierPts[2];
      else if (rank <= 10) pts = tierPts[3];

      db.prepare(`
        INSERT OR IGNORE INTO competition_phase_rewards (competition_id, phase, user_id, class_code, rank, points_awarded)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(competitionId, phase, p.userId, cls, rank, pts);

      grantActivityPointsWithDouble(
        db,
        p.userId,
        "arena_phase_reward",
        pts,
        "competition",
        competitionId,
        `Thưởng Hạng ${rank} Chặng ${phase} Đấu trường (${comp.week_key} - Bảng ${cls}): +${pts}đ`
      );
      awarded++;
    }
  }
  return { awarded };
}

function getChestCatalogWithRates() {
  const totalWeight = GACHA_TABLE.reduce((sum, entry) => sum + (Number(entry.weight) || 0), 0) || 1;
  return GACHA_TABLE.map((entry) => {
    const meta = ITEM_METADATA[entry.itemKey] || {};
    const pct = Number(((entry.weight / totalWeight) * 100).toFixed(2));
    let detailLabel = meta.name || entry.itemKey;
    if (entry.itemKey === "arena_hourglass" && entry.freezeSeconds) detailLabel += ` (${entry.freezeSeconds}s)`;
    else if (entry.itemKey === "arena_eye" && entry.charges) detailLabel += ` (${entry.charges} lần)`;
    else if (entry.itemKey === "arena_cloak" && entry.fixLimit) detailLabel += ` (${entry.fixLimit} câu)`;
    else if (entry.itemKey === "trial_decor" && entry.durationDays) detailLabel += ` (${entry.durationDays} ngày)`;
    else if (entry.itemKey.startsWith("shield_") && entry.durationDays) detailLabel += ` (${entry.durationDays} ngày)`;
    else if (entry.qty > 1 && !entry.itemKey.startsWith("pts_")) detailLabel += ` (x${entry.qty})`;

    return {
      itemKey: entry.itemKey,
      name: detailLabel,
      rarity: entry.rarity || meta.rarity || "common",
      level: entry.level || 1,
      qty: entry.qty || 1,
      ratePercent: pct,
      desc: meta.desc || "",
      whereUsed: meta.whereUsed || ""
    };
  });
}

function handleHandbookApi(ctx) {
  const { method, pathName, request, response, db, requireUser, requireCsrf, readJSON, json, error, sessionFrom, calculateUserStreak, isAdmin } = ctx;

  if (method === "GET" && pathName === "/api/handbook/state") {
    const user = sessionFrom(request);
    if (!user) {
      return json(response, 200, {
        authenticated: false,
        tasksConfig: DAILY_TASKS_CONFIG,
        totalEnergy: 0,
        energyTarget: 100,
        keysCount: 0,
        calendar: getMonthlyEnergyCalendar(db, 0),
        inventory: [],
        recentWins: [],
        studyBackgrounds: STUDY_WALLPAPER_CATALOG,
        exchangeBanner: getExchangeBannerForUser(db, 0),
        chestCatalog: getChestCatalogWithRates()
      });
    }

    // Tự động ghi nhận đăng nhập hôm nay khi tải Sổ tay khám phá
    recordDailyTaskProgress(db, user.id, "login", 0);
    const todayLog = getOrCreateDailyLog(db, user.id);
    let tasksState = {};
    try { tasksState = JSON.parse(todayLog.tasks_json || "{}"); } catch { tasksState = {}; }

    const todayKey = getVNDateKey();
    const dailyContribRows = db.prepare(`
      SELECT event_type, coalesce(sum(CASE WHEN points > 0 THEN points ELSE 0 END), 0) as pts
      FROM contribution_events
      WHERE user_id = ? AND date(datetime(created_at, '+7 hours')) = ?
        AND event_type IN ('post_created', 'response_created', 'study_session', 'handbook_create_post', 'handbook_reply_post', 'handbook_study_25m')
      GROUP BY event_type
    `).all(user.id, todayKey);
    const contribMap = new Map(dailyContribRows.map(r => [r.event_type, Number(r.pts || 0)]));

    const tasks = DAILY_TASKS_CONFIG.map(cfg => {
      const t = tasksState[cfg.key] || { energyEarned: 0, pointsEarned: 0, count: 0 };
      const syncedPts = cfg.contribEventType
        ? Math.min(cfg.maxPointsPerDay, (contribMap.get(cfg.contribEventType) || 0) + (contribMap.get(`handbook_${cfg.key}`) || 0))
        : (t.pointsEarned || 0);
      return {
        ...cfg,
        energyEarned: t.energyEarned || 0,
        pointsEarned: syncedPts,
        count: t.count || 0,
        isEnergyDone: (t.energyEarned || 0) >= cfg.maxEnergyPerDay,
        isFullyDone: (t.energyEarned || 0) >= cfg.maxEnergyPerDay && (cfg.maxPointsPerDay === 0 || syncedPts >= cfg.maxPointsPerDay)
      };
    });

    const wallet = getOrCreateChestWallet(db, user.id);
    const streakInfo = calculateUserStreak(user.id);
    const maxShields = streakInfo.maxShields || getMaxShieldsForStreak(streakInfo.streak || 0);
    const totalShields = reconcileUserShields(db, user.id, maxShields);
    const inventory = getFormattedUserInventory(db, user.id);
    const calendar = getMonthlyEnergyCalendar(db, user.id);
    const guaranteeStatus = getGuaranteeStatus(db, user.id, wallet);

    const rawBgs = db.prepare("SELECT bg_key, expires_at FROM user_study_backgrounds WHERE user_id = ?").all(user.id);
    const nowBgMs = Date.now();
    const isPrivBg = user.role === "admin" || user.role === "ta";
    const unlockedBgs = rawBgs
      .filter((r) => {
        if (isPrivBg || !r.expires_at || String(r.expires_at).startsWith("2099-")) return true;
        const t = Date.parse(r.expires_at);
        return !Number.isNaN(t) && t > nowBgMs;
      })
      .map((r) => r.bg_key);
    const recentWins = db.prepare(`
      SELECT l.item_name as itemName, l.rarity, l.created_at as createdAt, u.display_name as displayName
      FROM chest_open_logs l
      JOIN users u ON u.id = l.user_id
      WHERE l.rarity IN ('epic', 'legendary', 'mythic')
      ORDER BY l.id DESC
      LIMIT 8
    `).all();

    return json(response, 200, {
      authenticated: true,
      todayKey: todayLog.date_key,
      totalEnergy: todayLog.total_energy || 0,
      energyTarget: 100,
      maxEnergy: 200,
      activeSecondsToday: todayLog.active_seconds || 0,
      keyAwardedToday: Boolean(todayLog.key_awarded),
      keysCount: wallet.keys_count || 0,
      totalOpened: wallet.total_opened || 0,
      guaranteeStatus,
      tasks,
      calendar,
      inventory,
      streak: streakInfo.streak || 0,
      streakTier: streakInfo.streakTier || 0,
      shields: totalShields,
      maxShields,
      unlockedStudyBackgrounds: unlockedBgs,
      studyBackgroundsCatalog: STUDY_WALLPAPER_CATALOG,
      exchangeBanner: getExchangeBannerForUser(db, user.id),
      chestCatalog: getChestCatalogWithRates(),
      recentWins
    });
  }

  if (method === "POST" && pathName === "/api/handbook/heartbeat") {
    const user = requireUser(request, response);
    if (!user) return true;
    if (!requireCsrf(request, response, user)) return true;

    return (async () => {
      const body = await readJSON(request).catch(() => ({}));
      const addSeconds = Math.min(90, Math.max(0, Math.floor(Number(body.visibleSeconds) || 0)));
      const eventAction = typeof body.action === "string" ? body.action.trim() : "";
      const refId = Number(body.refId) || 0;

      const dateKey = getVNDateKey();
      const row = getOrCreateDailyLog(db, user.id, dateKey);
      const updates = [];

      if (addSeconds > 0) {
        const newSec = Math.min(86400, (row.active_seconds || 0) + addSeconds);
        db.prepare("UPDATE daily_energy_logs SET active_seconds = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(newSec, row.id);
        if (newSec >= 300) {
          const ls = recordDailyTaskProgress(db, user.id, "light_streak", 0);
          if (ls.addedEnergy > 0) updates.push(ls);
        }
        if (newSec >= 3600) {
          const a60 = recordDailyTaskProgress(db, user.id, "active_60m", 0);
          if (a60.addedEnergy > 0) updates.push(a60);
        }
      }

      if (eventAction === "read_post" || eventAction === "read_doc") {
        const resTask = recordDailyTaskProgress(db, user.id, eventAction, refId);
        if (resTask.addedEnergy > 0) updates.push(resTask);
      }

      const freshRow = getOrCreateDailyLog(db, user.id, dateKey);
      const wallet = getOrCreateChestWallet(db, user.id);
      return json(response, 200, {
        ok: true,
        totalEnergy: freshRow.total_energy || 0,
        activeSecondsToday: freshRow.active_seconds || 0,
        keysCount: wallet.keys_count || 0,
        updates
      });
    })();
  }

  if (method === "POST" && pathName === "/api/handbook/chest/open") {
    const user = requireUser(request, response);
    if (!user) return true;
    if (!requireCsrf(request, response, user)) return true;

    return (async () => {
      const body = await readJSON(request).catch(() => ({}));
      const mode = body.mode === "x10" ? "x10" : "x1";
      const keyCost = mode === "x10" ? 9 : 1;
      const rollCount = mode === "x10" ? 10 : 1;

      const wallet = getOrCreateChestWallet(db, user.id);
      if ((wallet.keys_count || 0) < keyCost) {
        return error(response, 400, `Bạn cần ${keyCost} chìa khóa để mở (hiện có ${wallet.keys_count || 0} chìa).`);
      }

      const deductRes = db.prepare("UPDATE user_chest_wallet SET keys_count = keys_count - ?, total_opened = total_opened + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND keys_count >= ?")
        .run(keyCost, rollCount, user.id, keyCost);
      if (!deductRes || deductRes.changes === 0) {
        return error(response, 400, "Không đủ chìa khóa để mở rương.");
      }

      const userRow = db.prepare("SELECT id, role FROM users WHERE id = ?").get(user.id);
      const streakNow = calculateUserStreak(user.id);
      const maxShields = streakNow.maxShields || getMaxShieldsForStreak(streakNow.streak || 0);
      const results = [];
      let monthOpened = Number(wallet.month_opened || 0);
      let pity10 = Number(wallet.pity_10 || 0);
      let pity50 = Number(wallet.pity_50 || 0);

      for (let i = 0; i < rollCount; i++) {
        monthOpened += 1;
        pity10 += 1;
        pity50 += 1;

        const rollOptions = {};
        if (pity50 >= 50) {
          // Mỗi 50 lượt: chắc chắn nhận 1 Cực phẩm (Nấm thần kỳ)
          rollOptions.exactItemKey = "mythic_mushroom";
        } else if (pity10 >= 10) {
          // Mỗi 10 lượt không trúng Tím+: chắc chắn nhận Hiếm (Tím) trở lên
          rollOptions.minRarity = "epic";
        } else if (pity10 < 7) {
          // Cơ chế ngầm: giảm xác suất ra Tím/Vàng sớm trước lượt thứ 7
          rollOptions.suppressEarlyEpic = true;
        }

        const picked = rollWeightedReward(rollOptions);
        const reward = processChestRollForUser(db, user.id, picked, userRow, { maxShields });

        // Nếu ra Tím (epic), Vàng (legendary) hoặc Đỏ (mythic) -> reset chu kỳ 10 lượt về 0
        if (reward.rarity === "epic" || reward.rarity === "legendary" || reward.rarity === "mythic") {
          pity10 = 0;
        }
        // Nếu ra Đỏ (mythic_mushroom) -> reset chu kỳ 50 lượt về 0
        if (reward.rarity === "mythic") {
          pity50 = 0;
        }

        db.prepare(`
          INSERT INTO chest_open_logs (user_id, open_mode, item_key, item_name, rarity, quantity, is_converted, converted_points)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(user.id, mode, reward.itemKey, reward.name, reward.rarity, reward.quantity || 1, reward.isConverted ? 1 : 0, reward.convertedPoints || 0);

        results.push(reward);
      }

      db.prepare(`
        UPDATE user_chest_wallet
        SET pity_counter = ?, month_opened = ?, pity_10 = ?, pity_50 = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(pity10, monthOpened, pity10, pity50, user.id);

      const updatedWallet = getOrCreateChestWallet(db, user.id);
      const syncedShields = reconcileUserShields(db, user.id, maxShields);

      return json(response, 200, {
        ok: true,
        mode,
        keyCost,
        keysCount: updatedWallet.keys_count || 0,
        shields: syncedShields,
        maxShields,
        guaranteeStatus: getGuaranteeStatus(db, user.id, updatedWallet),
        exchangeBanner: getExchangeBannerForUser(db, user.id),
        results,
        inventory: getFormattedUserInventory(db, user.id)
      });
    })();
  }

  if (method === "POST" && pathName === "/api/handbook/inventory/use") {
    const user = requireUser(request, response);
    if (!user) return true;
    if (!requireCsrf(request, response, user)) return true;

    return (async () => {
      const body = await readJSON(request).catch(() => ({}));
      const invId = Number(body.inventoryId);
      if (!invId) return error(response, 400, "Vật phẩm không hợp lệ.");

      purgeExpiredInventory(db, user.id);
      const item = db.prepare("SELECT * FROM user_inventory WHERE id = ? AND user_id = ?").get(invId, user.id);
      if (!item) return error(response, 404, "Không tìm thấy vật phẩm trong túi đồ hoặc đã hết hạn.");

      if (item.category === "the_diem") {
        const alreadyActive = db.prepare(`
          SELECT id FROM user_inventory
          WHERE user_id = ? AND category = 'the_diem' AND activated_at IS NOT NULL AND remaining_bonus > 0
        `).get(user.id);
        if (alreadyActive && alreadyActive.id !== item.id) {
          return error(response, 400, "Bạn đang kích hoạt một Thẻ nhân đôi khác. Hãy dùng hết trước khi bật thẻ mới.");
        }
        const nowIso = new Date().toISOString();
        db.prepare("UPDATE user_inventory SET activated_at = ? WHERE id = ?").run(nowIso, item.id);
        return json(response, 200, { ok: true, message: `Đã kích hoạt ${ITEM_METADATA[item.item_key]?.name || "Thẻ nhân đôi điểm"}!`, inventory: getFormattedUserInventory(db, user.id) });
      }

      if (item.item_key === "study_bg" || item.item_key === "mythic_study_bg") {
        let meta = {};
        try { meta = JSON.parse(item.meta_json || "{}"); } catch { meta = {}; }
        return json(response, 200, {
          ok: true,
          applyStudyBg: meta,
          message: `Đã chọn ảnh nền phòng tự học: ${meta.bgName || "Mới"}.`,
          inventory: getFormattedUserInventory(db, user.id)
        });
      }

      return error(response, 400, "Vật phẩm này được tự động dùng hoặc kích hoạt trong Đấu trường / Chuỗi.");
    })();
  }

  // Test helper dành riêng cho Quản trị viên trên môi trường thử nghiệm (Cấp nhanh chìa khóa để test Mở x1 / Mở x10)
  if (method === "POST" && pathName === "/api/handbook/test/grant-keys") {
    const user = requireUser(request, response);
    if (!user) return true;
    if (!isAdmin(user)) return error(response, 403, "Chỉ Quản trị viên mới có quyền cấp chìa khóa thử nghiệm.");
    if (!requireCsrf(request, response, user)) return true;

    return (async () => {
      const body = await readJSON(request).catch(() => ({}));
      const count = Math.min(50, Math.max(1, Number(body.keys) || 10));
      getOrCreateChestWallet(db, user.id);
      db.prepare("UPDATE user_chest_wallet SET keys_count = keys_count + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(count, user.id);
      const w = getOrCreateChestWallet(db, user.id);
      return json(response, 200, { ok: true, keysCount: w.keys_count, message: `Đã cộng +${count} chìa khóa thử nghiệm.` });
    })();
  }

  if (method === "POST" && pathName === "/api/handbook/exchange/redeem") {
    const user = requireUser(request, response);
    if (!user) return true;
    if (!requireCsrf(request, response, user)) return true;

    return (async () => {
      const body = await readJSON(request).catch(() => ({}));
      const rewardKey = String(body.rewardKey || "").trim();
      const banner = getActiveExchangeBanner();
      if (!banner.isOpen) {
        return error(
          response,
          403,
          banner.status === "ended"
            ? "Sự kiện Đổi thưởng Thảo nguyên kỳ bí đã kết thúc (chỉ mở từ 01/12/2026 đến 30/12/2026)."
            : "Sự kiện Đổi thưởng Thảo nguyên kỳ bí chỉ mở từ 01/12/2026 đến 30/12/2026."
        );
      }
      const targetReward = banner.rewards.find(r => r.rewardKey === rewardKey);
      if (!targetReward) return error(response, 400, "Phần thưởng không hợp lệ trong kỳ banner hiện tại.");

      const alreadyRedeemed = db.prepare("SELECT 1 FROM user_banner_redemptions WHERE user_id = ? AND banner_key = ? AND reward_key = ?")
        .get(user.id, banner.bannerKey, rewardKey);
      if (alreadyRedeemed) {
        return error(response, 400, "Bạn đã đổi phần thưởng này trong kỳ hiện tại rồi.");
      }

      const cost = Number(targetReward.cost || 1);
      const mushroomCount = getUserMushroomCount(db, user.id);
      if (mushroomCount < cost) {
        return error(response, 400, `Bạn cần ${cost} Nấm thần kỳ để đổi phần thưởng này (hiện có ${mushroomCount}).`);
      }

      // Trừ Nấm thần kỳ từ user_inventory
      let toDeduct = cost;
      const mushRows = db.prepare("SELECT id, quantity FROM user_inventory WHERE user_id = ? AND item_key = 'mythic_mushroom' AND quantity > 0 ORDER BY id ASC").all(user.id);
      for (const r of mushRows) {
        if (toDeduct <= 0) break;
        const take = Math.min(toDeduct, r.quantity);
        if (r.quantity - take <= 0) {
          db.prepare("DELETE FROM user_inventory WHERE id = ?").run(r.id);
        } else {
          db.prepare("UPDATE user_inventory SET quantity = quantity - ? WHERE id = ?").run(take, r.id);
        }
        toDeduct -= take;
      }

      db.prepare("INSERT INTO user_banner_redemptions (user_id, banner_key, reward_key) VALUES (?, ?, ?)")
        .run(user.id, banner.bannerKey, rewardKey);

      if (targetReward.decorType && targetReward.decorId) {
        db.prepare(`
          INSERT INTO user_limited_items (user_id, item_type, item_id, unlocked_at, expires_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP, '2099-12-31T23:59:59.000Z')
          ON CONFLICT(user_id, item_type, item_id) DO UPDATE SET expires_at = '2099-12-31T23:59:59.000Z'
        `).run(user.id, targetReward.decorType, targetReward.decorId);
      } else if (targetReward.bgKey) {
        db.prepare("INSERT OR IGNORE INTO user_study_backgrounds (user_id, bg_key) VALUES (?, ?)")
          .run(user.id, targetReward.bgKey);
      }

      return json(response, 200, {
        ok: true,
        message: `Đã đổi thành công: ${targetReward.name}!`,
        exchangeBanner: getExchangeBannerForUser(db, user.id),
        inventory: getFormattedUserInventory(db, user.id)
      });
    })();
  }

  // API nhận quà tặng từ Admin gửi qua Thông báo
  const giftClaimMatch = pathName.match(/^\/api\/handbook\/gifts\/(\d+)\/claim$/);
  if (method === "POST" && giftClaimMatch) {
    const user = requireUser(request, response);
    if (!user) return true;
    if (!requireCsrf(request, response, user)) return true;
    const giftId = Number(giftClaimMatch[1]);

    db.exec("BEGIN IMMEDIATE");
    try {
      const result = claimHandbookGift(db, user, giftId, calculateUserStreak);
      db.exec("COMMIT");
      if (result.notFound) return error(response, 404, "Không tìm thấy phần quà dành cho bạn.");
      return json(response, 200, result);
    } catch (err) {
      try { db.exec("ROLLBACK"); } catch (_) { }
      console.error("[Handbook Gift Claim Error]", err);
      return error(response, 500, "Không thể nhận quà lúc này. Vui lòng thử lại.");
    }
  }

  // Test helper dành riêng cho Quản trị viên: Reset mốc quay Cực phẩm & lịch sử đổi thưởng banner hiện tại để test
  if (method === "POST" && pathName === "/api/handbook/test/reset-mythics") {
    const user = requireUser(request, response);
    if (!user) return true;
    if (!isAdmin(user)) return error(response, 403, "Chỉ Quản trị viên mới có quyền reset Cực phẩm.");
    if (!requireCsrf(request, response, user)) return true;

    return (async () => {
      const banner = getActiveExchangeBanner();
      db.prepare("DELETE FROM user_banner_redemptions WHERE user_id = ? AND banner_key = ?").run(user.id, banner.bannerKey);
      getOrCreateChestWallet(db, user.id);
      db.prepare(`
        UPDATE user_chest_wallet
        SET month_opened = 0, pity_10 = 0, pity_50 = 0, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(user.id);
      return json(response, 200, { ok: true, message: "Đã reset mốc quay Cực phẩm (50 lượt), mốc 10 lượt và trạng thái đổi thưởng banner!" });
    })();
  }

  return false;
}

function resolveGiftItemDisplay(rewardKind, itemKey, level = 1) {
  if (rewardKind === "keys") {
    return { itemKey: "keys", level: 1, itemName: "Chìa khoá" };
  }
  const meta = ITEM_METADATA[itemKey];
  if (!meta) return null;
  const lv = Math.min(3, Math.max(1, parseInt(level, 10) || 1));
  const leveledKeys = new Set(["arena_hourglass", "arena_eye", "arena_cloak"]);
  let itemName = meta.name;
  if (leveledKeys.has(itemKey) && lv > 1) {
    const roman = lv === 3 ? "III" : "II";
    itemName = `${meta.name} (Cấp ${roman})`;
  }
  return { itemKey, level: leveledKeys.has(itemKey) ? lv : (itemKey === "double_pts_2" ? 2 : (itemKey === "double_pts_3" ? 3 : 1)), itemName };
}

/** Create a pending Admin gift record and return its formatted CTA label ("Nhận x<qty> <Tên>"). */
function createHandbookGiftClaim(db, { targetUserId, actorId = null, rewardKind = "keys", itemKey = null, level = 1, quantity = 1 }) {
  const qty = Math.min(999, Math.max(1, parseInt(quantity, 10) || 1));
  const resolved = resolveGiftItemDisplay(rewardKind, itemKey, level);
  if (!resolved) {
    throw new Error("Vật phẩm tặng không hợp lệ.");
  }
  const ctaLabel = `Nhận x${qty} ${resolved.itemName}`;
  const info = db.prepare(`
    INSERT INTO admin_gift_claims (user_id, actor_id, reward_kind, item_key, level, quantity, item_name, cta_label)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(targetUserId, actorId || null, rewardKind, resolved.itemKey, resolved.level, qty, resolved.itemName, ctaLabel);

  return {
    id: Number(info.lastInsertRowid),
    userId: targetUserId,
    rewardKind,
    itemKey: resolved.itemKey,
    level: resolved.level,
    quantity: qty,
    itemName: resolved.itemName,
    ctaLabel
  };
}

/** Atomically claim an Admin gift into the recipient's chest wallet, shields, or inventory. */
function claimHandbookGift(db, user, giftId, calculateUserStreakFn) {
  const claim = db.prepare("SELECT * FROM admin_gift_claims WHERE id = ? AND user_id = ?").get(giftId, user.id);
  if (!claim) return { notFound: true };
  if (claim.claimed_at) {
    const wallet = getOrCreateChestWallet(db, user.id);
    return {
      ok: true,
      alreadyClaimed: true,
      message: `Bạn đã ${claim.cta_label.toLowerCase()} trước đó rồi.`,
      claim,
      keysCount: wallet.keys_count || 0,
      inventory: getFormattedUserInventory(db, user.id)
    };
  }

  const qty = Math.max(1, Number(claim.quantity) || 1);
  const lv = Math.max(1, Number(claim.level) || 1);
  const meta = ITEM_METADATA[claim.item_key] || {};

  if (claim.reward_kind === "keys") {
    getOrCreateChestWallet(db, user.id);
    db.prepare("UPDATE user_chest_wallet SET keys_count = keys_count + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
      .run(qty, user.id);
  } else if (claim.item_key && claim.item_key.startsWith("pts_")) {
    const unitPts = parseInt(claim.item_key.split("_")[1], 10) || 1;
    const totalPts = unitPts * qty;
    grantActivityPointsWithDouble(db, user.id, "admin_gift_points", totalPts, "handbook", claim.id, `Quà tặng từ RE:SEARCH: +${totalPts}đ`);
  } else if (claim.item_key && claim.item_key.startsWith("shield_")) {
    const streakInfo = typeof calculateUserStreakFn === "function" ? calculateUserStreakFn(user.id) : { streak: 0 };
    const maxShields = getMaxShieldsForStreak(streakInfo.streak || 0);
    grantShieldWithCapacity(
      db,
      user.id,
      claim.item_key,
      lv,
      meta.durationDays || null,
      meta.rarity || "common",
      maxShields,
      qty
    );
  } else if (claim.item_key) {
    const extra = { rarity: meta.rarity || "common", meta: {} };
    if (claim.item_key === "arena_hourglass") extra.meta.freezeSeconds = lv * 5;
    else if (claim.item_key === "arena_eye") extra.meta.charges = lv === 3 ? 5 : (lv === 2 ? 3 : 1);
    else if (claim.item_key === "arena_cloak") extra.meta.fixLimit = lv;
    else if (claim.item_key.startsWith("double_pts_")) extra.bonusCap = meta.bonusCap || (lv * 5);

    if (meta.category === "the_diem") {
      for (let i = 0; i < qty; i++) {
        addInventoryStackItem(db, user.id, claim.item_key, lv, 1, extra);
      }
    } else {
      addInventoryStackItem(db, user.id, claim.item_key, lv, qty, extra);
    }
  }

  db.prepare("UPDATE admin_gift_claims SET claimed_at = CURRENT_TIMESTAMP WHERE id = ?").run(claim.id);
  const wallet = getOrCreateChestWallet(db, user.id);
  return {
    ok: true,
    alreadyClaimed: false,
    message: `Đã nhận thành công x${qty} ${claim.item_name}!`,
    claim: { ...claim, claimed_at: new Date().toISOString() },
    keysCount: wallet.keys_count || 0,
    inventory: getFormattedUserInventory(db, user.id)
  };
}

module.exports = {
  DAILY_TASKS_CONFIG,
  STUDY_WALLPAPER_CATALOG,
  ITEM_METADATA,
  initHandbookTables,
  getMaxShieldsForStreak,
  reconcileUserShields,
  grantShieldWithCapacity,
  recordDailyTaskProgress,
  applyActiveDoubleBonus,
  grantActivityPointsWithDouble,
  getMonthlyEnergyCalendar,
  getInventoryShieldsCount,
  consumeSoonestInventoryShield,
  getFormattedUserInventory,
  getActiveExchangeBanner,
  awardArenaPhasePoints,
  createHandbookGiftClaim,
  claimHandbookGift,
  handleHandbookApi
};
