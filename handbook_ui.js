/* ==========================================================================
   SỔ TAY NĂNG ĐỘNG, RƯƠNG MAY MẮN, TÚI ĐỒ & VẬT PHẨM ĐẤU TRƯỜNG ARENA
   100% Thuần Việt · 100% Biểu tượng SVG tự thiết kế (Không icon hệ thống)
   ========================================================================== */

(function () {
  "use strict";

  const hbState = {
    data: null,
    selectedSpace: "all",
    loading: false,
    visibleSecondsAcc: 0,
    lastTickAt: Date.now(),
    postReadTrack: { id: null, ms: 0, sentIds: new Set() },
    docReadTrack: { id: null, ms: 0, sentIds: new Set() },
    loadout: { eyeInvId: null, cloakInvId: null },
    freezeUntilMs: 0,
    hammerActive: false,
    cloakState: null
  };

  /* ------------------------------------------------------------------------
     BỘ BIỂU TƯỢNG SVG 2D NỔI PHONG CÁCH SQUIRCLE TƯƠI SÁNG (KHÔNG ICON HỆ THỐNG)
     ------------------------------------------------------------------------ */
  function squircleIcon(size, bgHex, rimHex, tintHex, innerMarkup) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="60" height="60" rx="18" fill="${bgHex}"/>
      <path d="M20 4h24c9 0 16 7 16 16v3C57 12 51 7.5 44 7.5H20C13 7.5 7 12 4 23v-3C4 11 11 4 20 4z" fill="#FFFFFF" opacity="0.24"/>
      <path d="M4 42c0 10.5 7 18 16 18h24c9 0 16-7.5 16-18v2c0 10-7 17.5-16 17.5H20C11 61.5 4 54 4 44v-2z" fill="${rimHex}" opacity="0.5"/>
      <path d="M10 49.5c8.5-4.5 15.5 2.8 22.5 0s13.5-3.8 21.5 0c-7 4.5-14.5 4.8-21.5 2.2s-14-2.8-22.5-2.2z" fill="${tintHex}" opacity="0.72"/>
      ${innerMarkup}
    </svg>`;
  }

  const SVG_ICONS = {
    book: (size = 18) => squircleIcon(size, "#22C55E", "#15803D", "#BBF7D0", `
      <rect x="17" y="13" width="30" height="34" rx="6" fill="#15803D" opacity="0.28" transform="translate(1.5,2.5)"/>
      <rect x="17" y="13" width="30" height="34" rx="6" fill="#FFFFFF"/>
      <rect x="22" y="19" width="20" height="4" rx="2" fill="#86EFAC"/>
      <rect x="22" y="27" width="16" height="3.5" rx="1.75" fill="#BBF7D0"/>
      <rect x="22" y="34" width="12" height="3.5" rx="1.75" fill="#BBF7D0"/>
      <circle cx="44" cy="41" r="6.5" fill="#FBBF24" stroke="#FFFFFF" stroke-width="2"/>
    `),
    energy: (size = 18) => squircleIcon(size, "#16C765", "#0E8A45", "#B8F8D2", `
      <path d="M35 11L17 34h12l-2 17 20-23H35l0-17z" fill="#0B7038" opacity="0.28" transform="translate(1.5,2.5)"/>
      <path d="M35 11L17 34h12l-2 17 20-23H35l0-17z" fill="#FFFFFF"/>
      <path d="M35 15L22 32h9l-1.2 10.5L42.5 29H35V15z" fill="#DCFCE7" opacity="0.7"/>
    `),
    key: (size = 18) => squircleIcon(size, "#FFB020", "#CC7700", "#FFE5A3", `
      <g fill="#B45309" opacity="0.28" transform="translate(1.5,2.5)">
        <circle cx="22" cy="39" r="10"/>
        <path d="M29 32L46 15l5 5-4 4 4 4-4.5 4.5-4-4-7.5 7.5z"/>
      </g>
      <circle cx="22" cy="39" r="10" fill="#FFFFFF"/>
      <circle cx="22" cy="39" r="4.2" fill="#FFB020"/>
      <path d="M28 33L45 16l5 5-4 4 4 4-4.5 4.5-4-4-7.5 7.5z" fill="#FFFFFF"/>
      <path d="M32 33l12-12 2.5 2.5-12 12z" fill="#FEF3C7"/>
    `),
    chest: (size = 24) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 120 120" fill="none" style="vertical-align:middle;overflow:visible;" aria-hidden="true" focusable="false">
      <ellipse cx="60" cy="108" rx="44" ry="7" fill="#042F2E" opacity="0.24"/>
      <path d="M16 58h88l-4 38c-.6 5-4.8 9-10 9H30c-5.2 0-9.4-4-10-9l-4-38z" fill="#0F766E"/>
      <path d="M18 62h84l-3 31c-.5 4-3.8 7-8 7H29c-4.2 0-7.5-3-8-7l-3-31z" fill="#115E59"/>
      <path d="M22 65h22v35H30c-4 0-6.5-2.5-7-6.5L22 65z" fill="#0D9488"/>
      <path d="M76 65h22l-1 28.5c-.5 4-3 6.5-7 6.5H76V65z" fill="#0D9488"/>
      <path d="M16 54c0-17 11-31 28-35h32c17 4 28 18 28 35v5H16v-5z" fill="#14B8A6"/>
      <path d="M25 53c0-13 8-24 21-28h28c13 4 21 15 21 28v3H25v-3z" fill="#2DD4BF"/>
      <ellipse cx="38" cy="33" rx="9" ry="4" transform="rotate(-24 38 33)" fill="#CCFBF1" opacity="0.65"/>
      <path d="M13 53c0-3.3 2.7-6 6-6h82c3.3 0 6 2.7 6 6v8c0 2.8-2.2 5-5 5H18c-2.8 0-5-2.2-5-5v-8z" fill="#F59E0B"/>
      <path d="M15 52c0-2.5 2-4.5 4.5-4.5h81c2.5 0 4.5 2 4.5 4.5v5.5H15V52z" fill="#FDE047"/>
      <path d="M40 19h11v86H39L40 19z" fill="#D97706"/>
      <path d="M42 19h7v86h-7V19z" fill="#FBBF24"/>
      <path d="M69 19h11l1 86H69V19z" fill="#D97706"/>
      <path d="M71 19h7v86h-7V19z" fill="#FBBF24"/>
      <path d="M21 96h78l-1.5 8c-.6 2.5-2.8 4-5.5 4H28c-2.7 0-4.9-1.5-5.5-4L21 96z" fill="#D97706"/>
      <rect x="46" y="47" width="28" height="27" rx="8" fill="#B45309"/>
      <rect x="48" y="48" width="24" height="23" rx="6.5" fill="#FEF08A"/>
      <path d="M60 53l7 7-7 8-7-8 7-7z" fill="#0284C7"/>
      <path d="M60 54.5l4.5 5-4.5 5.5-4.5-5.5 4.5-5z" fill="#7DD3FC"/>
      <circle cx="88" cy="31" r="2.6" fill="#FFFFFF" opacity="0.9"/>
    </svg>`,
    chestOpen: (size = 128) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 120 120" fill="none" style="vertical-align:middle;overflow:visible;" aria-hidden="true" focusable="false">
      <ellipse cx="60" cy="110" rx="45" ry="6.5" fill="#042F2E" opacity="0.28"/>
      <path d="M22 50L38 4h44l16 46-38 10z" fill="#FDE047" opacity="0.26"/>
      <!-- Nắp rương bật ngửa thẳng từ trước ra sau (phối cảnh nhìn trực diện mở ra phía sau) -->
      <path d="M22 44c2-19 14-31 38-31s36 12 38 31l-7 7H29l-7-7z" fill="#0F766E"/>
      <path d="M27 42c2-14 12-23 33-23s31 9 33 23l-5 5H32l-5-5z" fill="#14B8A6"/>
      <path d="M41 14h9v32h-9z" fill="#F59E0B"/><path d="M43 14h5v32h-5z" fill="#FEF08A"/>
      <path d="M70 14h9v32h-9z" fill="#F59E0B"/><path d="M72 14h5v32h-5z" fill="#FEF08A"/>
      <path d="M18 42h84l-6 14H24l-6-14z" fill="#B45309"/>
      <path d="M23 44h74l-5 10H28l-5-10z" fill="#FDE047"/>
      <!-- Lòng rương & kho báu tràn lên từ bên trong -->
      <polygon points="18,56 26,44 94,44 102,56" fill="#042F2E"/>
      <circle cx="43" cy="51" r="7.5" fill="#F59E0B"/><circle cx="43" cy="50" r="5" fill="#FEF08A"/>
      <circle cx="77" cy="51" r="7.5" fill="#F59E0B"/><circle cx="77" cy="50" r="5" fill="#FEF08A"/>
      <circle cx="60" cy="48" r="9.5" fill="#FBBF24"/><circle cx="60" cy="47" r="6" fill="#FEF9C3"/>
      <path d="M60 35l7 9-7 9-7-9 7-9z" fill="#38BDF8"/><path d="M60 38l4 6-4 6-4-6 4-6z" fill="#E0F2FE"/>
      <!-- Thân rương bên dưới cố định giữ nguyên hướng nhìn trực diện -->
      <path d="M16 58h88l-4 39c-.6 5-4.8 9-10 9H30c-5.2 0-9.4-4-10-9l-4-39z" fill="#0F766E"/>
      <path d="M18 62h84l-3 32c-.5 4-3.8 7-8 7H29c-4.2 0-7.5-3-8-7l-3-32z" fill="#115E59"/>
      <path d="M22 65h20v35H30c-4 0-6.5-2.5-7-6.5L22 65z" fill="#0D9488"/>
      <path d="M78 65h20l-1 28.5c-.5 4-3 6.5-7 6.5H78V65z" fill="#0D9488"/>
      <path d="M40 58h11v48H39L40 58z" fill="#D97706"/><path d="M42 58h7v48h-7V58z" fill="#FBBF24"/>
      <path d="M69 58h11l1 48H69V58z" fill="#D97706"/><path d="M71 58h7v48h-7V58z" fill="#FBBF24"/>
      <path d="M14 55h92c2.2 0 4 1.8 4 4v5c0 2.2-1.8 4-4 4H14c-2.2 0-4-1.8-4-4v-5c0-2.2 1.8-4 4-4z" fill="#F59E0B"/>
      <path d="M16 56h88v5H16v-5z" fill="#FDE047"/>
      <rect x="49" y="62" width="22" height="17" rx="5.5" fill="#B45309"/>
      <rect x="51" y="63" width="18" height="14" rx="4.5" fill="#FEF08A"/>
      <rect x="57.5" y="67" width="5" height="7" rx="2.5" fill="#0F766E"/>
      <!-- Sao lấp lánh bật lên -->
      <path d="M26 22l2.5 5.5 5.5 2.5-5.5 2.5L26 38l-2.5-5.5L18 30l5.5-2.5z" fill="#FEF08A"/>
      <path d="M94 20l2.5 5.5 5.5 2.5-5.5 2.5L94 36l-2.5-5.5L86 28l5.5-2.5z" fill="#FEF08A"/>
      <path d="M60 6l2 4.5 4.5 2-4.5 2L60 19l-2-4.5L53.5 12.5 58 10.5z" fill="#E0F2FE"/>
    </svg>`,
    chestBig: (size = 122) => SVG_ICONS.chest(size),
    calendar: (size = 18) => squircleIcon(size, "#22C55E", "#15803D", "#BBF7D0", `
      <rect x="14" y="16" width="36" height="31" rx="7" fill="#15803D" opacity="0.26" transform="translate(1.5,2.5)"/>
      <rect x="14" y="16" width="36" height="31" rx="7" fill="#FFFFFF"/>
      <path d="M14 23c0-3.8 3-7 7-7h22c4 0 7 3.2 7 7v4H14v-4z" fill="#DCFCE7"/>
      <rect x="21" y="12" width="4" height="8" rx="2" fill="#FFFFFF"/>
      <rect x="39" y="12" width="4" height="8" rx="2" fill="#FFFFFF"/>
      <rect x="20" y="31" width="6" height="5" rx="1.5" fill="#4ADE80"/>
      <rect x="29" y="31" width="6" height="5" rx="1.5" fill="#22C55E"/>
      <rect x="38" y="31" width="6" height="5" rx="1.5" fill="#86EFAC"/>
      <rect x="20" y="38.5" width="6" height="5" rx="1.5" fill="#22C55E"/>
      <rect x="29" y="38.5" width="6" height="5" rx="1.5" fill="#16A34A"/>
    `),
    flame: (size = 24) => squircleIcon(size, "#FF7A38", "#D9480F", "#FFD0B5", `
      <path d="M33 11c-5 7-13 13-13 23a12 12 0 0 0 24 0c0-6-3-11-6-14-1 3-3 5-5 6 .5-4.5-.2-10 0-15z" fill="#9A3412" opacity="0.28" transform="translate(1.5,2.5)"/>
      <path d="M33 11c-5 7-13 13-13 23a12 12 0 0 0 24 0c0-6-3-11-6-14-1 3-3 5-5 6 .5-4.5-.2-10 0-15z" fill="#FFFFFF"/>
      <path d="M32 27c-3 3-4.5 5.5-4.5 8.5a4.5 4.5 0 0 0 9 0c0-3-1.5-5.5-4.5-8.5z" fill="#FED7AA"/>
    `),
    bag: (size = 18) => squircleIcon(size, "#F59E0B", "#B45309", "#FDE68A", `
      <path d="M18 22h28l2.5 23a4 4 0 0 1-4 4.5h-25a4 4 0 0 1-4-4.5L18 22z" fill="#92400E" opacity="0.25" transform="translate(1.5,2.5)"/>
      <path d="M18 22h28l2.5 23a4 4 0 0 1-4 4.5h-25a4 4 0 0 1-4-4.5L18 22z" fill="#FFFFFF"/>
      <path d="M25 22v-3a7 7 0 0 1 14 0v3" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>
      <rect x="24" y="29" width="16" height="4" rx="2" fill="#FDE68A"/>
    `),
    check: (size = 13) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    sparkle: (size = 18) => squircleIcon(size, "#FFAE19", "#C27803", "#FFE7AD", `
      <path d="M32 13l4.5 13.5L50 31l-13.5 4.5L32 49l-4.5-13.5L14 31l13.5-4.5z" fill="#92400E" opacity="0.26" transform="translate(1.5,2.5)"/>
      <path d="M32 13l4.5 13.5L50 31l-13.5 4.5L32 49l-4.5-13.5L14 31l13.5-4.5z" fill="#FFFFFF"/>
    `),
    info: (size = 14) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9.5" fill="#FEF3C7" stroke="#B45309" stroke-width="1.8"/><path d="M12 10.5v6" stroke="#B45309" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="7.5" r="1.2" fill="#B45309"/></svg>`,
    points: (size = 24) => squircleIcon(size, "#FF9F1C", "#C86E00", "#FFE2A6", `
      <circle cx="32" cy="31" r="16" fill="#92400E" opacity="0.26" transform="translate(1.5,2.5)"/>
      <circle cx="32" cy="31" r="16" fill="#FFFFFF"/>
      <path d="M32 20l3.2 6.8 7.5 1-5.5 5.2 1.4 7.4L32 36.8l-6.6 3.6 1.4-7.4-5.5-5.2 7.5-1z" fill="#FFB84D"/>
    `),
    shield: (size = 24) => squircleIcon(size, "#4B8BFF", "#2563EB", "#BED7FF", `
      <path d="M32 13l-15 6v12c0 9.5 6.4 16 15 19 8.6-3 15-9.5 15-19V19l-15-6z" fill="#1D4ED8" opacity="0.28" transform="translate(1.5,2.5)"/>
      <path d="M32 13l-15 6v12c0 9.5 6.4 16 15 19 8.6-3 15-9.5 15-19V19l-15-6z" fill="#FFFFFF"/>
      <path d="M32 18v26c5.8-2.3 10-7.2 10-14v-8.5L32 18z" fill="#DBEAFE"/>
    `),
    shieldSparkle: (size = 24) => squircleIcon(size, "#9B6BFF", "#6D28D9", "#DDD0FF", `
      <path d="M32 13l-15 6v12c0 9.5 6.4 16 15 19 8.6-3 15-9.5 15-19V19l-15-6z" fill="#5B21B6" opacity="0.28" transform="translate(1.5,2.5)"/>
      <path d="M32 13l-15 6v12c0 9.5 6.4 16 15 19 8.6-3 15-9.5 15-19V19l-15-6z" fill="#FFFFFF"/>
      <path d="M32 22l2.4 5.5 5.6 2.2-5.6 2.2L32 37.5l-2.4-5.6L24 29.7l5.6-2.2z" fill="#C4B5FD"/>
    `),
    shieldRadiant: (size = 24) => squircleIcon(size, "#FFB020", "#B45309", "#FEF08A", `
      <path d="M32 12l-16 6.2v12.5c0 9.8 6.8 16.5 16 19.5 9.2-3 16-9.7 16-19.5V18.2L32 12z" fill="#92400E" opacity="0.28" transform="translate(1.5,2.5)"/>
      <path d="M32 12l-16 6.2v12.5c0 9.8 6.8 16.5 16 19.5 9.2-3 16-9.7 16-19.5V18.2L32 12z" fill="#FFFFFF"/>
      <path d="M32 18.5l3 7.5 8 .8-6 5.2 1.8 7.8-6.8-4.1-6.8 4.1 1.8-7.8-6-5.2 8-.8z" fill="#FBBF24"/>
      <path d="M49 11l1.5 3.3 3.3 1.5-3.3 1.5L49 20.6l-1.5-3.3-3.3-1.5 3.3-1.5z" fill="#FFFFFF"/>
    `),
    shieldMilestone: (size = 24) => squircleIcon(size, "#10B981", "#047857", "#A7F3D0", `
      <path d="M32 13l-15 6v12c0 9.5 6.4 16 15 19 8.6-3 15-9.5 15-19V19l-15-6z" fill="#065F46" opacity="0.28" transform="translate(1.5,2.5)"/>
      <path d="M32 13l-15 6v12c0 9.5 6.4 16 15 19 8.6-3 15-9.5 15-19V19l-15-6z" fill="#FFFFFF"/>
      <path d="M26 31l4.2 4.2 8.2-8.2" stroke="#10B981" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    `),
    magnifier1: (size = 24) => squircleIcon(size, "#4B8BFF", "#1D4ED8", "#C4DBFF", `
      <g fill="#1E40AF" opacity="0.28" transform="translate(1.5,2.5)">
        <circle cx="27" cy="27" r="12.5"/>
        <path d="M35.5 35.5l11 11" stroke="#1E40AF" stroke-width="6.5" stroke-linecap="round"/>
      </g>
      <path d="M35.5 35.5l10.5 10.5" stroke="#FFFFFF" stroke-width="6.5" stroke-linecap="round"/>
      <circle cx="27" cy="27" r="12.5" fill="#FFFFFF"/>
      <circle cx="27" cy="27" r="7.5" fill="#93C5FD"/>
      <rect x="22" y="25.5" width="10" height="3" rx="1.5" fill="#FFFFFF"/>
    `),
    magnifier2: (size = 24) => squircleIcon(size, "#9B6BFF", "#6D28D9", "#DFD3FF", `
      <g fill="#5B21B6" opacity="0.28" transform="translate(1.5,2.5)">
        <circle cx="27" cy="27" r="12.5"/>
        <path d="M35.5 35.5l11 11" stroke="#5B21B6" stroke-width="6.5" stroke-linecap="round"/>
      </g>
      <path d="M35.5 35.5l10.5 10.5" stroke="#FFFFFF" stroke-width="6.5" stroke-linecap="round"/>
      <circle cx="27" cy="27" r="12.5" fill="#FFFFFF"/>
      <circle cx="27" cy="27" r="7.5" fill="#C4B5FD"/>
      <path d="M27 21.5l1.4 3.5 3.6 1.5-3.6 1.5L27 31.5l-1.4-3.5L22 26.5l3.6-1.5z" fill="#FFFFFF"/>
    `),
    hourglass: (size = 24) => squircleIcon(size, "#14B8A6", "#0F766E", "#A7F3D0", `
      <g fill="#115E59" opacity="0.26" transform="translate(1.5,2.5)">
        <rect x="19" y="13" width="26" height="4.5" rx="2"/>
        <rect x="19" y="45" width="26" height="4.5" rx="2"/>
        <path d="M22 17.5c0 8.5 8 10 8 13.8s-8 5.2-8 13.7h20c0-8.5-8-10-8-13.7s8-5.3 8-13.8H22z"/>
      </g>
      <path d="M22 17.5c0 8.5 8 10 8 13.8s-8 5.2-8 13.7h20c0-8.5-8-10-8-13.7s8-5.3 8-13.8H22z" fill="#FFFFFF"/>
      <path d="M25 39.5c2-2.2 4.5-3.5 7-3.5s5 1.3 7 3.5H25z" fill="#5EEAD4"/>
      <rect x="19" y="13" width="26" height="4.5" rx="2.2" fill="#FFFFFF"/>
      <rect x="19" y="45" width="26" height="4.5" rx="2.2" fill="#FFFFFF"/>
    `),
    lamp: (size = 24) => squircleIcon(size, "#F59E0B", "#B45309", "#FDE68A", `
      <g fill="#92400E" opacity="0.28" transform="translate(1.5,2.5)">
        <path d="M14 34h26l8-8c2-2-.5-4.5-3-3l-5 2.5H19L12 31c-1.5 1.5-.5 3 2 3z"/>
        <path d="M19 34c2.5 7 7 10 11.5 10S39 41 41 34H19z"/>
        <rect x="22" y="45" width="16" height="4" rx="2"/>
      </g>
      <path d="M14 34h26l8-8c2-2-.5-4.5-3-3l-5 2.5H19L12 31c-1.5 1.5-.5 3 2 3z" fill="#FFFFFF"/>
      <path d="M19 34c2.5 7 7 10 11.5 10S39 41 41 34H19z" fill="#FEF3C7"/>
      <rect x="22" y="45" width="16" height="4" rx="2" fill="#FFFFFF"/>
      <path d="M31 12c2.5 3-2 5 0 8.5" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>
      <circle cx="36" cy="14" r="2.2" fill="#FFFFFF"/>
    `),
    hammer: (size = 24) => squircleIcon(size, "#FF7A3D", "#C2410C", "#FED7AA", `
      <g fill="#9A3412" opacity="0.28" transform="translate(1.5,2.5)">
        <rect x="14" y="14" width="24" height="13" rx="4" transform="rotate(-18 26 20.5)"/>
        <path d="M27 25l16 20" stroke="#9A3412" stroke-width="6.5" stroke-linecap="round"/>
      </g>
      <path d="M27 25l16 20" stroke="#FFF7ED" stroke-width="6.5" stroke-linecap="round"/>
      <rect x="14" y="14" width="24" height="13" rx="4.5" transform="rotate(-18 26 20.5)" fill="#FFFFFF"/>
      <path d="M44 13l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="#FED7AA"/>
    `),
    eye: (size = 24) => squircleIcon(size, "#F59E0B", "#B45309", "#FDE68A", `
      <path d="M11 31s8-13 21-13 21 13 21 13-8 13-21 13-21-13-21-13z" fill="#92400E" opacity="0.28" transform="translate(1.5,2.5)"/>
      <path d="M11 31s8-13 21-13 21 13 21 13-8 13-21 13-21-13-21-13z" fill="#FFFFFF"/>
      <circle cx="32" cy="31" r="7.5" fill="#F59E0B"/>
      <circle cx="32" cy="31" r="3.5" fill="#FFFFFF"/>
    `),
    cloak: (size = 24) => squircleIcon(size, "#8B5CF6", "#5B21B6", "#DDD6FE", `
      <path d="M32 12L17 22l-3.5 24h37L47 22 32 12z" fill="#4C1D95" opacity="0.28" transform="translate(1.5,2.5)"/>
      <path d="M32 12L17 22l-3.5 24h37L47 22 32 12z" fill="#FFFFFF"/>
      <path d="M25 21l7 8 7-8" stroke="#A78BFA" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="32" cy="32" r="3" fill="#C4B5FD"/>
    `),
    doublePts: (size = 24) => squircleIcon(size, "#22C55E", "#15803D", "#BBF7D0", `
      <rect x="13" y="17" width="38" height="28" rx="7" fill="#15803D" opacity="0.26" transform="translate(1.5,2.5)"/>
      <rect x="13" y="17" width="38" height="28" rx="7" fill="#FFFFFF"/>
      <text x="32" y="36" text-anchor="middle" font-size="18" font-weight="900" fill="#16A34A" font-family="system-ui, sans-serif">x2</text>
    `),
    decor: (size = 24) => squircleIcon(size, "#EC4899", "#BE185D", "#FBCFE8", `
      <rect x="14" y="14" width="36" height="34" rx="8" fill="#9D174D" opacity="0.26" transform="translate(1.5,2.5)"/>
      <rect x="14" y="14" width="36" height="34" rx="8" fill="#FFFFFF"/>
      <circle cx="24" cy="24" r="3.8" fill="#F472B6"/>
      <path d="M18 41l9-9 6 6 5-4.5 8 7.5H18z" fill="#F9A8D4"/>
    `),
    studyBg: (size = 24) => squircleIcon(size, "#4B8BFF", "#2563EB", "#BFDBFE", `
      <rect x="13" y="15" width="38" height="32" rx="7" fill="#1E40AF" opacity="0.26" transform="translate(1.5,2.5)"/>
      <rect x="13" y="15" width="38" height="32" rx="7" fill="#FFFFFF"/>
      <path d="M17 41l9-10 6.5 6.5L40 28l7 13H17z" fill="#93C5FD"/>
    `),
    mythicBg: (size = 24) => squircleIcon(size, "#FE5C4D", "#C82315", "#FFB3B0", `
      <rect x="13" y="15" width="38" height="32" rx="7" fill="#991B1B" opacity="0.28" transform="translate(1.5,2.5)"/>
      <rect x="13" y="15" width="38" height="32" rx="7" fill="#FFFFFF"/>
      <path d="M17 41l9-10 6.5 6.5L40 28l7 13H17z" fill="#FFB3B0"/>
      <circle cx="41.5" cy="22.5" r="3" fill="#FE5C4D"/>
    `),
    mythicCover: (size = 24) => squircleIcon(size, "#FE5C4D", "#C82315", "#FFB3B0", `
      <rect x="13" y="16" width="38" height="30" rx="7" fill="#991B1B" opacity="0.28" transform="translate(1.5,2.5)"/>
      <rect x="13" y="16" width="38" height="30" rx="7" fill="#FFFFFF"/>
      <path d="M18 40l8-9.5 6 6 7-8.5 7 12H18z" fill="#FFB3B0"/>
      <path d="M32 9l2 4.2 4.5.7-3.2 3.2.8 4.5-4.1-2.1-4.1 2.1.8-4.5-3.2-3.2 4.5-.7z" fill="#FFFFFF"/>
    `),
    pixelMushroomSprite: (size = 20) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
      <rect x="5" y="1" width="6" height="1" fill="#450A0A"/>
      <rect x="3" y="2" width="2" height="1" fill="#450A0A"/><rect x="11" y="2" width="2" height="1" fill="#450A0A"/>
      <rect x="2" y="3" width="1" height="2" fill="#450A0A"/><rect x="13" y="3" width="1" height="2" fill="#450A0A"/>
      <rect x="1" y="5" width="1" height="4" fill="#450A0A"/><rect x="14" y="5" width="1" height="4" fill="#450A0A"/>
      <rect x="5" y="2" width="6" height="1" fill="#EF4444"/>
      <rect x="3" y="3" width="10" height="2" fill="#EF4444"/>
      <rect x="2" y="5" width="12" height="4" fill="#DC2626"/>
      <rect x="5" y="2" width="2" height="2" fill="#FFFFFF"/>
      <rect x="10" y="3" width="2" height="2" fill="#FFFFFF"/>
      <rect x="3" y="6" width="2" height="2" fill="#FFFFFF"/>
      <rect x="7" y="5" width="2" height="2" fill="#FFFFFF"/>
      <rect x="11" y="6" width="2" height="2" fill="#FFFFFF"/>
      <rect x="2" y="9" width="12" height="1" fill="#450A0A"/>
      <rect x="3" y="10" width="1" height="4" fill="#450A0A"/><rect x="12" y="10" width="1" height="4" fill="#450A0A"/>
      <rect x="4" y="14" width="8" height="1" fill="#450A0A"/>
      <rect x="4" y="10" width="8" height="4" fill="#FEF3C7"/>
      <rect x="6" y="11" width="1" height="2" fill="#1F2937"/>
      <rect x="9" y="11" width="1" height="2" fill="#1F2937"/>
      <rect x="4" y="13" width="8" height="1" fill="#FDE68A"/>
    </svg>`,
    pixelMushroom: (size = 24) => squircleIcon(size, "#FE5C4D", "#C82315", "#FFB3B0", `
      <g transform="translate(14,12) scale(2.25)" shape-rendering="crispEdges">
        <rect x="5" y="1" width="6" height="1" fill="#450A0A"/>
        <rect x="3" y="2" width="2" height="1" fill="#450A0A"/><rect x="11" y="2" width="2" height="1" fill="#450A0A"/>
        <rect x="2" y="3" width="1" height="2" fill="#450A0A"/><rect x="13" y="3" width="1" height="2" fill="#450A0A"/>
        <rect x="1" y="5" width="1" height="4" fill="#450A0A"/><rect x="14" y="5" width="1" height="4" fill="#450A0A"/>
        <rect x="5" y="2" width="6" height="1" fill="#EF4444"/>
        <rect x="3" y="3" width="10" height="2" fill="#EF4444"/>
        <rect x="2" y="5" width="12" height="4" fill="#DC2626"/>
        <rect x="5" y="2" width="2" height="2" fill="#FFFFFF"/>
        <rect x="10" y="3" width="2" height="2" fill="#FFFFFF"/>
        <rect x="3" y="6" width="2" height="2" fill="#FFFFFF"/>
        <rect x="7" y="5" width="2" height="2" fill="#FFFFFF"/>
        <rect x="11" y="6" width="2" height="2" fill="#FFFFFF"/>
        <rect x="2" y="9" width="12" height="1" fill="#450A0A"/>
        <rect x="3" y="10" width="1" height="4" fill="#450A0A"/><rect x="12" y="10" width="1" height="4" fill="#450A0A"/>
        <rect x="4" y="14" width="8" height="1" fill="#450A0A"/>
        <rect x="4" y="10" width="8" height="4" fill="#FEF3C7"/>
        <rect x="6" y="11" width="1" height="2" fill="#1F2937"/>
        <rect x="9" y="11" width="1" height="2" fill="#1F2937"/>
        <rect x="4" y="13" width="8" height="1" fill="#FDE68A"/>
      </g>
    `),
    mythicFrame: (size = 24) => squircleIcon(size, "#FE5C4D", "#C82315", "#FFB3B0", `
      <rect x="14" y="14" width="36" height="36" rx="9" fill="#991B1B" opacity="0.28" transform="translate(1.5,2.5)"/>
      <rect x="14" y="14" width="36" height="36" rx="9" fill="#FFFFFF"/>
      <path d="M21 25l5.5 6L32 22l5.5 9L43 25l-2.5 14h-17L21 25z" fill="#FE5C4D"/>
      <circle cx="32" cy="22" r="2.2" fill="#FFB3B0"/>
    `),
    taskLogin: (size = 18) => squircleIcon(size, "#4B8BFF", "#1D4ED8", "#BFDBFE", `
      <rect x="14" y="14" width="36" height="36" rx="9" fill="#FFFFFF"/>
      <path d="M24 32h16M33 25l7 7-7 7" stroke="#3B82F6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    `),
    taskPost: (size = 18) => squircleIcon(size, "#FFB020", "#C76B00", "#FDE68A", `
      <rect x="14" y="14" width="36" height="36" rx="9" fill="#FFFFFF"/>
      <path d="M23 36l13-13 5 5-13 13H23v-5z" fill="#F59E0B"/>
    `),
    taskStudy: (size = 18) => squircleIcon(size, "#9B6BFF", "#6D28D9", "#DDD6FE", `
      <circle cx="32" cy="32" r="17" fill="#FFFFFF"/>
      <path d="M32 22v10l6.5 4" stroke="#8B5CF6" stroke-width="4" stroke-linecap="round"/>
    `)
  };

  function getItemIconSVG(itemKey, size = 26) {
    if (!itemKey) return SVG_ICONS.points(size);
    if (itemKey.startsWith("pts_") || itemKey.startsWith("points")) return SVG_ICONS.points(size);
    if (itemKey === "shield_radiant") return SVG_ICONS.shieldRadiant(size);
    if (itemKey === "shield_milestone") return SVG_ICONS.shieldMilestone(size);
    if (itemKey === "shield_sparkle") return SVG_ICONS.shieldSparkle(size);
    if (itemKey.startsWith("shield")) return SVG_ICONS.shield(size);
    if (itemKey === "arena_loupe_1" || itemKey === "arena_magnifier_1") return SVG_ICONS.magnifier1(size);
    if (itemKey === "arena_loupe_2" || itemKey === "arena_magnifier_2") return SVG_ICONS.magnifier2(size);
    if (itemKey.startsWith("arena_hourglass")) return SVG_ICONS.hourglass(size);
    if (itemKey === "arena_lamp") return SVG_ICONS.lamp(size);
    if (itemKey === "arena_hammer") return SVG_ICONS.hammer(size);
    if (itemKey.startsWith("arena_eye")) return SVG_ICONS.eye(size);
    if (itemKey.startsWith("arena_cloak")) return SVG_ICONS.cloak(size);
    if (itemKey.startsWith("double_pts")) return SVG_ICONS.doublePts(size);
    if (itemKey === "mythic_mushroom") return SVG_ICONS.pixelMushroom(size);
    if (itemKey === "mythic_study_bg") return SVG_ICONS.mythicBg(size);
    if (itemKey === "mythic_cover") return SVG_ICONS.mythicCover(size);
    if (itemKey === "mythic_frame") return SVG_ICONS.mythicFrame(size);
    if (itemKey.startsWith("study_bg")) return SVG_ICONS.studyBg(size);
    if (itemKey.startsWith("trial_decor") || itemKey.startsWith("decor")) return SVG_ICONS.decor(size);
    return SVG_ICONS.sparkle(size);
  }

  window.hbGetShieldIconSVG = (itemKey, size = 24) => getItemIconSVG(itemKey || "shield_normal", size);

  function getTaskIconSVG(taskKey) {
    if (taskKey === "login" || taskKey === "active_60m") return SVG_ICONS.taskLogin(16);
    if (taskKey === "light_streak" || taskKey === "streak") return SVG_ICONS.flame(16);
    if (taskKey === "study_25m") return SVG_ICONS.taskStudy(16);
    if (taskKey === "create_post" || taskKey === "reply_post") return SVG_ICONS.taskPost(16);
    return SVG_ICONS.book(16);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDurationRemaining(expiresAt) {
    if (!expiresAt) return "";
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (!Number.isFinite(diff) || diff <= 0) return "Hết hạn";
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (days >= 1) return `Còn ${days}n ${hours}g`;
    if (hours >= 1) return `Còn ${hours}g ${mins}p`;
    return `Còn ${Math.max(1, mins)}p`;
  }

  function rarityLabel(rarity) {
    if (rarity === "mythic") return "Cực phẩm";
    if (rarity === "legendary") return "Siêu hiếm";
    if (rarity === "epic") return "Hiếm";
    if (rarity === "rare") return "Phổ thông";
    return "Thường";
  }

  function rarityOrder() {
    return ["mythic", "legendary", "epic", "rare", "common"];
  }

  /* ------------------------------------------------------------------------
     API & ĐỒNG BỘ TRẠNG THÁI
     ------------------------------------------------------------------------ */
  async function loadHandbookState(quiet = false) {
    if (hbState.loading && quiet) return hbState.data;
    hbState.loading = true;
    try {
      const res = await window.requestAPI("/api/handbook/state");
      if (res) {
        hbState.data = res;
        window.handbookUnlockedStudyBackgrounds = res.unlockedStudyBackgrounds || [];
        window.handbookStudyWallpaperCatalog = res.studyBackgroundsCatalog || [];
        renderHomeBentoMini(res);
        renderHandbookPage(res);
        if (typeof window.renderWallpaperPresets === "function") {
          window.renderWallpaperPresets();
        }
      }
      return res;
    } catch (e) {
      if (!quiet) console.warn("[Handbook] Lỗi tải dữ liệu:", e);
      return null;
    } finally {
      hbState.loading = false;
    }
  }
  window.loadHandbookState = loadHandbookState;

  /* ------------------------------------------------------------------------
     THANH NĂNG LƯỢNG TRONG THẺ THÀNH TÍCH NĂNG ĐỘNG (#homeContributionCard)
     ------------------------------------------------------------------------ */
  function renderHomeBentoMini(data) {
    const el = document.getElementById("homeContribEnergyBar");
    if (!el) return;
    if (isGuestHandbookState(data)) {
      el.innerHTML = "";
      el.onclick = null;
      return;
    }

    const energy = Number(data.totalEnergy || 0);
    const pct = Math.min(100, Math.round((energy / (data.energyTarget || 100)) * 100));
    const keys = Number(data.keysCount || 0);

    el.onclick = () => { if (typeof window.go === "function") window.go("handbook"); };
    el.innerHTML = `
      <div class="hb-contrib-energy-row">
        <span style="display:inline-flex;align-items:center;gap:5px;">
          ${SVG_ICONS.energy(14)}
          <span>Năng lượng hôm nay</span>
        </span>
        <span style="display:inline-flex;align-items:center;gap:6px;">
          <span style="display:inline-flex;align-items:center;gap:3px;">${energy}/100 ${SVG_ICONS.energy(13)}</span>
          <span style="opacity:0.65;">·</span>
          <span style="display:inline-flex;align-items:center;gap:3px;">${keys} ${SVG_ICONS.key(13)}</span>
        </span>
      </div>
      <div class="hb-contrib-energy-track">
        <div class="hb-contrib-energy-fill" data-target-width="${pct}%" style="width:0%;"></div>
      </div>
    `;
    hbPlayEntranceAnimations();
  }

  /* ------------------------------------------------------------------------
     TRANG BENTO CHÍNH (#handbook)
     ------------------------------------------------------------------------ */
  function getVNTodayKey() {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
    } catch (_) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function hbPlayEntranceAnimations(forceCheck = true) {
    const todayKey = getVNTodayKey();
    let alreadyPlayedToday = false;
    try {
      alreadyPlayedToday = localStorage.getItem("hb_intro_anim_date") === todayKey;
    } catch (_) { }

    const shell = document.querySelector(".handbook-bento-shell");
    const bars = document.querySelectorAll(".hb-energy-bar-fill[data-target-width], .hb-contrib-energy-fill[data-target-width]");

    if (!alreadyPlayedToday && forceCheck) {
      try { localStorage.setItem("hb_intro_anim_date", todayKey); } catch (_) { }
      if (shell) {
        shell.classList.remove("is-animating");
        void shell.offsetWidth;
        shell.classList.add("is-animating");
      }
      bars.forEach((bar) => { bar.style.width = "0%"; });
      requestAnimationFrame(() => requestAnimationFrame(() => {
        bars.forEach((bar) => {
          bar.style.width = bar.getAttribute("data-target-width") || "0%";
        });
      }));
    } else {
      if (shell) shell.classList.remove("is-animating");
      bars.forEach((bar) => {
        bar.style.width = bar.getAttribute("data-target-width") || "0%";
      });
    }
  }
  window.hbPlayEntranceAnimations = hbPlayEntranceAnimations;

  function isGuestHandbookState(data) {
    if (data && data.authenticated === true) return false;
    return !window.session || !data || data.authenticated === false;
  }

  function renderGuestHandbookBento() {
    const msg = "Bạn cần đăng nhập để sử dụng tính năng này";
    const guestBlock = (iconHtml, title) => `
      <div class="hb-card-head">
        <div class="hb-card-title">${iconHtml} <span>${title}</span></div>
      </div>
      <div class="hb-guest-gate">
        <div class="hb-guest-gate-text">${msg}</div>
        <button type="button" class="button button-primary button-sm" onclick="if (typeof openAuth === 'function') openAuth(); else if (typeof go === 'function') go('account');">Đăng nhập</button>
      </div>
    `;
    const streakEl = document.getElementById("hbStreakCalendarBody");
    if (streakEl) streakEl.innerHTML = guestBlock(SVG_ICONS.calendar(18), "Lịch năng động");
    const tasksEl = document.getElementById("hbTasksBody");
    if (tasksEl) tasksEl.innerHTML = guestBlock(SVG_ICONS.energy(17), "Sổ tay khám phá");
    const chestEl = document.getElementById("hbChestBody");
    if (chestEl) chestEl.innerHTML = guestBlock(SVG_ICONS.chest(20), "Rương may mắn");
    const invEl = document.getElementById("hbInventoryBody");
    if (invEl) invEl.innerHTML = guestBlock(SVG_ICONS.bag(15), "Túi đồ");
  }

  function renderHandbookPage(data) {
    if (!data) return;
    renderExchangeBannerCard(data);
    renderCharacterAndEvent(data);
    if (isGuestHandbookState(data)) {
      renderGuestHandbookBento();
      return;
    }
    renderStreakAndCalendar(data);
    renderTasksCard(data);
    renderChestAndInventory(data);
    hbPlayEntranceAnimations(true);
  }

  function renderStreakAndCalendar(data) {
    const el = document.getElementById("hbStreakCalendarBody");
    if (!el) return;

    const cal = data.calendar || { monthLabel: "Tháng này", days: [], year: 2026, month: 1 };
    const firstDate = new Date(cal.year, (cal.month || 1) - 1, 1);
    const firstWeekday = (firstDate.getDay() + 6) % 7;

    const emptyCells = Array.from({ length: firstWeekday }, () => `<div class="hb-cal-cell is-empty"></div>`).join("");
    const dayCells = (cal.days || []).map((d) => {
      const todayCls = d.isToday ? "is-today" : "";
      return `<div class="hb-cal-cell level-${d.level || 0} ${todayCls}" title="Ngày ${d.day}: ${d.energy || 0} năng lượng">${d.day}</div>`;
    }).join("");

    const streak = Number(data.streak || 0);
    const streakTier = Number(data.streakTier || 0);
    const shields = Number(data.shields || 0);
    const maxShields = Number(data.maxShields || 3);
    const flameIconHtml = typeof window.getFlameSVG === "function"
      ? window.getFlameSVG(streakTier, 32)
      : SVG_ICONS.flame(26);

    el.innerHTML = `
      <div class="hb-card-head">
        <div class="hb-card-title">${SVG_ICONS.calendar(18)} <span>Lịch năng động</span></div>
        <span class="hb-card-pill">${escapeHtml(cal.monthLabel)}</span>
      </div>

      <div class="hb-streak-compact-row">
        <div class="hb-streak-left">
          <button type="button" class="hb-streak-flame-btn" onclick="if (window.openStreakJourneyModal) window.openStreakJourneyModal()" title="Bấm để xem Đặc quyền &amp; Hành trình giữ chuỗi" aria-label="Xem đặc quyền chuỗi">
            ${flameIconHtml}
          </button>
          <div>
            <div class="hb-streak-num">${streak} ngày</div>
            <div class="hb-streak-sub">Chuỗi học tập</div>
          </div>
        </div>
        <button type="button" class="hb-shield-pill-btn" onclick="if (window.openStreakShieldModal) window.openStreakShieldModal()" title="Bấm để xem danh sách &amp; chi tiết khiên (${shields}/${maxShields})">
          ${SVG_ICONS.shield(15)}
          <span>${shields}/${maxShields} khiên</span>
        </button>
      </div>

      <div class="hb-calendar-header">
        <span>Mật độ năng lượng</span>
        <div class="hb-calendar-legend" title="Nhạt đến đậm theo mức năng lượng">
          <span class="hb-legend-dot" style="background: var(--hb-cal-0)"></span>
          <span class="hb-legend-dot" style="background: var(--hb-cal-1)"></span>
          <span class="hb-legend-dot" style="background: var(--hb-cal-2)"></span>
          <span class="hb-legend-dot" style="background: var(--hb-cal-3)"></span>
          <span class="hb-legend-dot" style="background: var(--hb-cal-4)"></span>
        </div>
      </div>

      <div class="hb-calendar-weekdays">
        <span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span><span>CN</span>
      </div>

      <div class="hb-calendar-grid">
        ${emptyCells}${dayCells}
      </div>
    `;
  }

  function renderTasksCard(data) {
    const el = document.getElementById("hbTasksBody");
    if (!el) return;

    const tasks = Array.isArray(data.tasks) ? data.tasks : (Array.isArray(data.tasksConfig) ? data.tasksConfig : []);
    const filtered = hbState.selectedSpace === "all"
      ? tasks
      : tasks.filter((t) => t.space === hbState.selectedSpace);

    const energy = Number(data.totalEnergy || 0);
    const pct = Math.min(100, Math.round((energy / 100) * 100));

    const tabsHtml = [
      { id: "all", label: "Tất cả" },
      { id: "dien_dan", label: "Diễn đàn" },
      { id: "tu_hoc", label: "Tự học" },
      { id: "chung", label: "Chung" }
    ].map((tab) => `
      <button type="button" class="hb-space-tab ${hbState.selectedSpace === tab.id ? "active" : ""}" onclick="hbSetSpaceFilter('${tab.id}')">
        ${tab.label}
      </button>
    `).join("");

    const tasksHtml = filtered.map((t) => {
      const done = Boolean(t.isEnergyDone);
      const ptsLabel = t.points > 0
        ? `<span class="hb-metric-inline hb-badge-pt">+${t.points} ${SVG_ICONS.points(13)}</span>`
        : "";
      const ptsCapNote = t.points > 0 && t.maxPointsPerDay > t.points
        ? `<span>(${t.pointsEarned}/${t.maxPointsPerDay})</span>`
        : "";
      return `
        <div class="hb-task-item ${done ? "is-done" : ""}" title="${escapeHtml(t.label)}">
          <span class="hb-task-icon-wrap">${getTaskIconSVG(t.key)}</span>
          <div class="hb-task-info">
            <div class="hb-task-name">${escapeHtml(t.label)}</div>
            <div class="hb-task-rewards">
              <span class="hb-metric-inline hb-badge-nl">+${t.energy} ${SVG_ICONS.energy(13)}</span>
              ${ptsLabel}
              ${ptsCapNote}
            </div>
          </div>
          <span class="hb-task-status">${done ? SVG_ICONS.check(11) : ""}</span>
        </div>
      `;
    }).join("");

    el.innerHTML = `
      <div class="hb-card-head">
        <div class="hb-card-title">${SVG_ICONS.energy(17)} <span>Sổ tay khám phá</span></div>
        <div class="hb-space-tabs">${tabsHtml}</div>
      </div>

      <div class="hb-tasks-progress-strip">
        <span class="hb-tasks-progress-text">${energy} / 100 ${SVG_ICONS.energy(14)}</span>
        <div class="hb-energy-bar-track" style="flex:1;">
          <div class="hb-energy-bar-fill" data-target-width="${pct}%" style="width:0%;"></div>
        </div>
        <span class="hb-card-pill">${data.keyAwardedToday ? "Đã nhận +3" : "+3"} ${SVG_ICONS.key(12)}</span>
      </div>

      <div class="hb-tasks-grid">
        ${tasksHtml || `<div class="hb-inv-empty" style="grid-column:1/-1;">Chưa có mục nào</div>`}
      </div>
    `;
  }

  function formatCountdownDH(ms) {
    const safe = Math.max(0, Number(ms) || 0);
    const totalHours = Math.floor(safe / 3600000);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    return `${days} ngày ${hours} giờ`;
  }

  function getExchangeClosedMessage(banner) {
    return banner?.status === "ended"
      ? "Đổi thưởng Thảo nguyên kỳ bí đã kết thúc (chỉ mở từ 01/12 đến 30/12)."
      : "Đổi thưởng Thảo nguyên kỳ bí chỉ mở từ 01/12 đến 30/12.";
  }

  function renderExchangeBannerCard(data) {
    const el = document.getElementById("hbExchangeBannerCard");
    if (!el) return;
    const banner = data?.exchangeBanner || {};
    const isOpen = banner.isOpen === true;
    const bgUrl = banner.imageUrl || "/public/assets/banners/thao-nguyen-ky-bi.webp";
    el.style.backgroundImage = `url('${bgUrl}')`;
    el.classList.toggle("is-locked", !isOpen);
    el.setAttribute("aria-disabled", isOpen ? "false" : "true");
    el.title = isOpen
      ? "Mở Đổi thưởng giới hạn (01/12 – 30/12/2026)"
      : getExchangeClosedMessage(banner);
    el.innerHTML = `
      <span class="hb-ex-eyebrow-pill">Đổi thưởng giới hạn</span>
    `;
  }

  function renderCharacterAndEvent() {
    // Khung nhân vật đồng hành giữ sạch hoàn toàn (màu nền xanh đậm đặc trưng trong CSS), không chứa chữ hay icon
    const charEl = document.getElementById("hbCharacterEventBody");
    if (charEl) charEl.innerHTML = "";
  }

  function renderChestAndInventory(data) {
    const chestEl = document.getElementById("hbChestBody");
    const invEl = document.getElementById("hbInventoryBody");

    const keys = Number(data.keysCount || 0);
    const inv = Array.isArray(data.inventory) ? data.inventory : [];
    const isAdmin = Boolean(window.session && window.session.role === "admin");
    const g = data.guaranteeStatus || {};

    const rareLeft = Number(g.rareIn10Remaining || 10);
    const mythicLeft = Number(g.mythicIn50Remaining || 50);
    const trackTokenName = escapeHtml(data?.exchangeBanner?.tokenName || "Nấm thần kỳ");
    const trackLines = [
      `Nhận vật phẩm <span class="hb-rar-epic">Hiếm</span> trở lên sau <b>${rareLeft}/10</b> lượt mở rương`,
      `Chắc chắn nhận <span class="hb-rar-mythic">Cực phẩm</span> (<span class="hb-rar-mythic">${trackTokenName}</span>) sau <b>${mythicLeft}/50</b> lượt mở rương`
    ];

    if (chestEl) {
      chestEl.innerHTML = `
        <div class="hb-chest-panel">
          <div class="hb-chest-top">
            <div class="hb-chest-title-wrap">
              ${SVG_ICONS.chest(20)}
              <span class="hb-chest-title">Rương may mắn</span>
            </div>
            <div class="hb-chest-top-right">
              ${isAdmin ? `<button type="button" class="hb-rates-btn" onclick="hbGrantTestKeys()" title="Cộng 10 chìa thử nghiệm">+10 ${SVG_ICONS.key(12)}</button>` : ""}
              ${isAdmin ? `<button type="button" class="hb-rates-btn" onclick="hbResetTestMythics()" title="Reset mốc Cực phẩm để test quay lại">Reset đỏ</button>` : ""}
              <button type="button" class="hb-rates-btn" onclick="hbOpenChestRates()" title="Xem thể lệ, vật phẩm và tỷ lệ mở rương">
                ${SVG_ICONS.info(13)}
                <span>Tỷ lệ</span>
              </button>
              <span class="hb-keys-badge">${SVG_ICONS.key(13)} ${keys}</span>
            </div>
          </div>
          <div class="hb-chest-btns">
            <button type="button" class="hb-chest-open-btn is-x1" onclick="hbOpenChest('x1')" ${keys < 1 ? "disabled" : ""}>
              <span style="display:inline-flex;align-items:center;gap:4px;">Mở x1 (1 ${SVG_ICONS.key(13)})</span>
            </button>
            <button type="button" class="hb-chest-open-btn is-x10" onclick="hbOpenChest('x10')" ${keys < 9 ? "disabled" : ""}>
              <span style="display:inline-flex;align-items:center;gap:4px;">Mở x10 (9 ${SVG_ICONS.key(13)})</span>
            </button>
          </div>
          <div class="hb-chest-track-strip">
            ${trackLines.map((ln) => `<div>${ln}</div>`).join("")}
          </div>
        </div>
      `;
    }

    const shieldsSynced = Number(data.shields || 0);
    const maxShieldsSynced = Number(data.maxShields || 3);
    const invHtml = inv.length
      ? inv.map((item) => `
          <button type="button" class="hb-inv-slot rarity-${item.rarity || "common"}" onclick="hbOpenItemDetail(${item.id})" title="${escapeHtml(item.name)} (${rarityLabel(item.rarity)})">
            ${getItemIconSVG(item.itemKey, 25)}
            <span class="hb-inv-qty">${item.quantity}</span>
          </button>
        `).join("")
      : `<div class="hb-inv-empty">Túi đồ trống</div>`;

    if (invEl) {
      invEl.innerHTML = `
        <div class="hb-inventory-corner">
          <div class="hb-inv-head">
            <span style="display:inline-flex;align-items:center;gap:6px;">${SVG_ICONS.bag(15)} Túi đồ (${inv.length})</span>
            <span style="display:inline-flex;align-items:center;gap:6px;">
              <span class="hb-inv-shield-sync" title="Khiên giữ chuỗi đồng bộ theo mốc chuỗi">${SVG_ICONS.shield(12)} ${shieldsSynced}/${maxShieldsSynced} khiên</span>
              <span style="font-size:10.5px;color:var(--muted);font-weight:600;">Kéo ngang · Bấm xem</span>
            </span>
          </div>
          <div class="hb-inv-strip" id="hbInvStrip">${invHtml}</div>
        </div>
      `;
      attachHorizontalDragScroll(document.getElementById("hbInvStrip"));
    }
  }

  window.hbOpenExchangeModal = async function () {
    if (!window.session && !hbState.data?.authenticated) {
      if (typeof window.toast === "function") window.toast("Bạn cần đăng nhập để sử dụng tính năng này");
      return;
    }
    if (!hbState.data) await loadHandbookState(true);
    const dlg = document.getElementById("handbookExchangeModal");
    const body = document.getElementById("hbExchangeBody");
    if (!dlg || !body) return;

    const banner = hbState.data?.exchangeBanner || { name: "Thảo nguyên kỳ bí", isOpen: false, status: "upcoming", remainingMs: 0, mushroomCount: 0, rewards: [] };
    if (banner.isOpen !== true) {
      try { if (dlg.open) dlg.close(); } catch (_) { }
      if (typeof window.toast === "function") window.toast(getExchangeClosedMessage(banner));
      return;
    }
    const mushrooms = Number(banner.mushroomCount || 0);
    const rewards = Array.isArray(banner.rewards) ? banner.rewards : [];
    const frameRw = rewards.find(r => r.rewardKey === "frame") || {};
    const coverRw = rewards.find(r => r.rewardKey === "cover") || {};
    const bgRw = rewards.find(r => r.rewardKey === "study_bg") || {};

    const u = window.session || {};
    const displayName = escapeHtml(u.displayName || "Sinh viên RE:SEARCH");
    const roleLabel = u.role === "admin" ? "Quản trị viên" : (u.role === "ta" ? "Trợ giảng" : "Thành viên");
    const roleClass = `role-${u.role || "student"}`;
    const idText = u.studentId ? `ID ${escapeHtml(u.studentId)}` : `ID ${escapeHtml(u.userCode || String(u.id || 1).padStart(5, "0"))}`;
    const bioText = escapeHtml(u.bio || "Hỏi, trao đổi, cùng tiến bộ 🌱\nTìm hiểu sâu hơn, mỗi ngày một chút.");
    const avatarVal = escapeHtml(u.avatar || "🌱");
    const studyHours = u.hours ?? Math.floor((u.totalMinutes || u.studyStats?.totalMinutes || 0) / 60);
    const frameKey = escapeHtml(frameRw.decorId || "thao_nguyen_ky_bi");
    const coverSrc = coverRw.imageUrl || "/covers/thao-nguyen-ky-bi.webp";
    const bgSrc = bgRw.imageUrl || "/public/assets/wallpapers/thao-nguyen-ky-bi.webp";

    body.innerHTML = `
      <div class="hb-exchange-wrap">
        <div class="hb-exchange-head">
          <div class="hb-exchange-head-spacer" style="width:96px;"></div>
          <div class="hb-exchange-head-center">
            <div style="font-size:13px;font-weight:800;opacity:0.88;">Đổi thưởng giới hạn</div>
            <div style="font-size:21px;font-weight:900;text-transform:uppercase;letter-spacing:-0.01em;">${escapeHtml(banner.name)}</div>
            <div style="font-size:12px;font-weight:700;opacity:0.85;">Còn lại: ${formatCountdownDH(banner.remainingMs || 0)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="hb-exchange-token-pill">Đang có: ${mushrooms} ${SVG_ICONS.pixelMushroomSprite(18)}</span>
            <button type="button" class="hb-exchange-close-btn" onclick="document.getElementById('handbookExchangeModal').close()" aria-label="Đóng">✕</button>
          </div>
        </div>

        <div class="hb-exchange-grid">
          <div class="hb-exchange-col-left">
            <div class="hb-exchange-preview-card">
              <div class="studio-stage-scaler">
                <div class="namecard-stage">
                  <div class="namecard-canvas">
                    <div class="namecard-cover" style="background: url('${coverSrc}') center / cover no-repeat;"></div>
                    <div class="namecard-card">
                      <div class="namecard-cover-spacer"></div>
                      <div class="namecard-content-wrap">
                        <div class="namecard-header">
                          <div class="namecard-profile-row">
                            <div class="namecard-avatar-wrap">
                              <div class="namecard-avatar-circle">
                                <span>${avatarVal}</span>
                              </div>
                            </div>
                            <div class="namecard-identity">
                              <h2 class="namecard-display-name">${displayName}</h2>
                              <div class="namecard-badges">
                                <span class="namecard-role-badge ${roleClass}">${roleLabel}</span>
                                <span class="namecard-id-badge">${idText}</span>
                              </div>
                            </div>
                          </div>
                          <p class="namecard-bio">${bioText}</p>
                        </div>
                        <div class="namecard-body">
                          <div class="namecard-block">
                            <div class="namecard-block-header">
                              <div class="namecard-block-title">
                                <h3>Thống kê tự học &amp; Đấu trường</h3>
                              </div>
                            </div>
                            <div class="namecard-tiles namecard-tiles-2">
                              <div class="namecard-tile">
                                <div class="nc-tile-icon">🔥</div>
                                <span class="nc-tile-value">${hbState.data?.streak || 0} ngày</span>
                                <span class="nc-tile-label">Chuỗi học tập</span>
                              </div>
                              <div class="namecard-tile">
                                <div class="nc-tile-icon">⏱️</div>
                                <span class="nc-tile-value">${studyHours} giờ</span>
                                <span class="nc-tile-label">Tổng giờ tự học</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="namecard-frame-layer" data-frame="${frameKey}"></div>
                </div>
              </div>
            </div>
            <div class="hb-exchange-footer">
              <div class="hb-exchange-item-label">
                <b>${escapeHtml(frameRw.name || "Khung thẻ tên")}</b>
                <span>${escapeHtml(frameRw.subLabel || "Khung thẻ tên")}</span>
              </div>
              <button type="button" class="hb-exchange-redeem-btn" onclick="hbRedeemExchangeReward('frame')" ${frameRw.redeemed || mushrooms < (frameRw.cost || 1) ? "disabled" : ""}>
                ${frameRw.redeemed ? "Đã đổi" : `Đổi ${frameRw.cost || 1} ${SVG_ICONS.pixelMushroomSprite(16)}`}
              </button>
            </div>
          </div>

          <div class="hb-exchange-col-right">
            <div class="hb-exchange-land-card">
              <img src="${coverSrc}" alt="${escapeHtml(coverRw.name || "Ảnh bìa")}" />
            </div>
            <div class="hb-exchange-footer">
              <div class="hb-exchange-item-label">
                <b>${escapeHtml(coverRw.name || "Ảnh bìa thẻ tên")}</b>
                <span>${escapeHtml(coverRw.subLabel || "Ảnh bìa thẻ tên")}</span>
              </div>
              <button type="button" class="hb-exchange-redeem-btn" onclick="hbRedeemExchangeReward('cover')" ${coverRw.redeemed || mushrooms < (coverRw.cost || 1) ? "disabled" : ""}>
                ${coverRw.redeemed ? "Đã đổi" : `Đổi ${coverRw.cost || 1} ${SVG_ICONS.pixelMushroomSprite(16)}`}
              </button>
            </div>

            <div class="hb-exchange-land-card">
              <img src="${bgSrc}" alt="${escapeHtml(bgRw.name || "Ảnh nền Phòng tự học")}" />
            </div>
            <div class="hb-exchange-footer">
              <div class="hb-exchange-item-label">
                <b>${escapeHtml(bgRw.name || "Ảnh nền Phòng tự học")}</b>
                <span>${escapeHtml(bgRw.subLabel || "Ảnh nền Phòng tự học")}</span>
              </div>
              <button type="button" class="hb-exchange-redeem-btn" onclick="hbRedeemExchangeReward('study_bg')" ${bgRw.redeemed || mushrooms < (bgRw.cost || 1) ? "disabled" : ""}>
                ${bgRw.redeemed ? "Đã đổi" : `Đổi ${bgRw.cost || 1} ${SVG_ICONS.pixelMushroomSprite(16)}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    try {
      if (dlg.open) dlg.close();
      dlg.showModal();
    } catch (_) { }
  };

  window.hbRedeemExchangeReward = async function (rewardKey) {
    const banner = hbState.data?.exchangeBanner;
    if (!banner || banner.isOpen !== true) {
      if (typeof window.toast === "function") window.toast(getExchangeClosedMessage(banner));
      return;
    }
    try {
      const res = await window.requestAPI("/api/handbook/exchange/redeem", {
        method: "POST",
        body: JSON.stringify({ rewardKey })
      });
      if (typeof window.toast === "function") window.toast(res?.message || "Đã đổi thưởng thành công!");
      await loadHandbookState(true);
      if (typeof window.hydrateServer === "function") await window.hydrateServer(true);
      await hbOpenExchangeModal();
    } catch (e) {
      if (typeof window.toast === "function") window.toast(e.message || "Không thể đổi phần thưởng.");
    }
  };

  function attachHorizontalDragScroll(el) {
    if (!el) return;
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    el.addEventListener("mousedown", (e) => {
      isDown = true;
      startX = e.pageX - el.offsetLeft;
      scrollLeft = el.scrollLeft;
    });
    el.addEventListener("mouseleave", () => { isDown = false; });
    el.addEventListener("mouseup", () => { isDown = false; });
    el.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      el.scrollLeft = scrollLeft - (x - startX) * 1.4;
    });
  }

  window.hbSetSpaceFilter = function (space) {
    hbState.selectedSpace = space || "all";
    if (hbState.data) renderTasksCard(hbState.data);
  };

  window.hbFilterInventoryCategory = function () {
    const strip = document.getElementById("hbInvStrip");
    if (strip) strip.scrollTo({ left: 0, behavior: "smooth" });
  };

  /* ------------------------------------------------------------------------
     XEM DANH SÁCH VẬT PHẨM TRONG RƯƠNG & TỶ LỆ RƠI (4 HẠNG ĐỘ HIẾM)
     ------------------------------------------------------------------------ */
  window.hbOpenChestRates = async function () {
    if (!hbState.data) await loadHandbookState(true);
    const dlg = document.getElementById("handbookChestRatesModal");
    const body = document.getElementById("hbChestRatesBody");
    if (!dlg || !body) return;

    const banner = hbState.data?.exchangeBanner || {};
    const tokenName = escapeHtml(banner.tokenName || "Nấm thần kỳ");
    const bannerName = escapeHtml(banner.name || "Chinh phục bầu trời");
    let periodRangeText = "01/12/2026 – 30/12/2026";
    if (banner.startAt && banner.endAt) {
      try {
        const fmtVN = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });
        const startStr = fmtVN.format(new Date(banner.startAt));
        const endStr = fmtVN.format(new Date(new Date(banner.endAt).getTime() - 1000));
        periodRangeText = `${startStr} – ${endStr}`;
      } catch (_) { }
    }

    const catalog = hbState.data?.chestCatalog || [];
    const groupsHtml = rarityOrder().map((rar) => {
      const items = catalog.filter((c) => c.rarity === rar);
      if (!items.length) return "";
      const sumPct = items.reduce((s, it) => s + Number(it.ratePercent || 0), 0).toFixed(1);
      return `
        <div class="hb-rates-group">
          <div class="hb-rates-group-head">
            <span class="hb-card-pill hb-rarity-pill-${rar}">${rarityLabel(rar)}</span>
            <span style="color:var(--muted);">${sumPct}%</span>
          </div>
          <div class="hb-rates-items">
            ${items.map((it) => `
              <div class="hb-rate-row" title="${escapeHtml(it.desc || it.name)}">
                ${getItemIconSVG(it.itemKey, 22)}
                <span class="hb-rate-name">${escapeHtml(it.name)}</span>
                <span class="hb-rate-pct">${it.ratePercent}%</span>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }).join("");

    body.innerHTML = `
      <div class="hb-item-detail-wrap">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <div style="display:flex;align-items:center;gap:8px;font-size:15px;font-weight:800;">
            ${SVG_ICONS.chest(24)}
            <span>RƯƠNG MAY MẮN</span>
          </div>
          <button type="button" class="button button-outline button-sm" onclick="document.getElementById('handbookChestRatesModal').close()">Đóng</button>
        </div>
        <div class="hb-rates-scroll">
          <div class="hb-rates-rules-box">
            <div class="hb-rules-heading">QUY TẮC KHAI MỞ RƯƠNG MAY MẮN</div>
            <p class="hb-rules-intro">Mỗi lượt khai mở là một cơ hội nhận về những vật phẩm giá trị. Tích lũy tài nguyên để không bỏ lỡ những phần thưởng đặc biệt!</p>

            <h4>1. Phẩm chất vật phẩm</h4>
            <p>Vật phẩm trong Rương được phân thành 05 bậc phẩm chất:</p>
            <ul>
              <li><span class="hb-rar-common">Thường</span></li>
              <li><span class="hb-rar-rare">Phổ thông</span></li>
              <li><span class="hb-rar-epic">Hiếm</span></li>
              <li><span class="hb-rar-legendary">Siêu hiếm</span></li>
              <li><span class="hb-rar-mythic">Cực phẩm</span></li>
            </ul>
            <p>Phẩm chất càng cao, vật phẩm càng quý hiếm.</p>

            <h4>2. Cơ chế bảo chứng</h4>
            <p><span class="hb-rar-epic">Bảo chứng Hiếm – Mốc 10 lượt</span></p>
            <p>Sau tối đa 10 lượt khai mở liên tiếp, chắc chắn nhận được ít nhất 01 vật phẩm phẩm chất <span class="hb-rar-epic">Hiếm</span> trở lên.</p>
            <p>Nếu nhận được vật phẩm <span class="hb-rar-epic">Hiếm</span>, <span class="hb-rar-legendary">Siêu hiếm</span> hoặc <span class="hb-rar-mythic">Cực phẩm</span> trước khi đạt mốc 10 lượt, bộ đếm bảo chứng sẽ được đặt lại.</p>

            <p><span class="hb-rar-mythic">Bảo chứng Cực phẩm – Mốc 50 lượt</span></p>
            <p>Sau tối đa 50 lượt khai mở liên tiếp, chắc chắn nhận được 01 <span class="hb-rar-mythic">${tokenName}</span> thuộc phẩm chất <span class="hb-rar-mythic">Cực phẩm</span>.</p>
            <p>Nếu nhận được <span class="hb-rar-mythic">${tokenName}</span> trước khi đạt mốc 50 lượt, bộ đếm bảo chứng <span class="hb-rar-mythic">Cực phẩm</span> sẽ được đặt lại và bắt đầu chu kỳ mới.</p>
            <p>Hai bộ đếm bảo chứng hoạt động độc lập. Khi nhận được <span class="hb-rar-mythic">${tokenName}</span>, cả hai bộ đếm đều được đặt lại.</p>

            <h4>3. Hình thức khai mở</h4>
            <p>Bạn có thể lựa chọn một trong hai hình thức:</p>
            <ul>
              <li><b>Khai mở x1:</b> Tiêu hao 01 Chìa Khóa.</li>
              <li><b>Khai mở x10:</b> Tiêu hao 09 Chìa Khóa.</li>
            </ul>
            <p>Mỗi lượt khai mở trong <b>Khai mở x10</b> vẫn được tính riêng vào bộ đếm bảo chứng.</p>

            <h4>4. Quy đổi vật phẩm trùng (Quy đổi điểm)</h4>
            <p>Khi khai mở Rương trúng vật phẩm trang trí thuộc nhóm sử dụng lâu dài mà bạn đã sở hữu, hệ thống sẽ tự động quy đổi thành Điểm hoạt động:</p>
            <ul>
              <li><b>Thẻ trang trí hạn giờ (Khung / Ảnh bìa):</b> Nếu tài khoản đã sở hữu vĩnh viễn món trang trí được rút ra, thẻ tự động quy đổi thành <b>+1đ</b> (gói 1 ngày), <b>+2đ</b> (gói 3 ngày) hoặc <b>+3đ</b> (gói 7 ngày).</li>
              <li><b>Ảnh nền Phòng tự học:</b> Nếu đã sở hữu ảnh nền đó (hoặc kho ảnh nền trong Rương đã đầy), hệ thống tự động quy đổi thành <b>+2 Điểm hoạt động</b>.</li>
              <li>Điểm quy đổi được cộng trực tiếp vào Điểm hoạt động &amp; Bảng xếp hạng (có áp dụng nhân đôi nếu bạn đang kích hoạt <b>Thẻ x2 Điểm</b>).</li>
            </ul>

            <h4>5. Kỳ hạn đổi thưởng</h4>
            <p><span class="hb-rar-mythic">${tokenName}</span> là tài nguyên đặc biệt, không có thời hạn sử dụng và có thể được tích trữ qua nhiều kỳ đổi thưởng.</p>
            <p>Banner Đổi Thưởng Giới Hạn cung cấp các phần thưởng độc quyền như Khung Namecard, Ảnh bìa và Nền Phòng tự học. Danh mục phần thưởng được làm mới theo chu kỳ 30 ngày.</p>
            <ul>
              <li><b>Thời gian kỳ đổi thưởng ${bannerName}:</b> ${periodRangeText}.</li>
              <li>Khi kỳ mới bắt đầu, danh mục phần thưởng giới hạn sẽ được thay thế.</li>
              <li><span class="hb-rar-mythic">${tokenName}</span> đã tích lũy vẫn được bảo lưu, không bị thu hồi khi chuyển kỳ.</li>
              <li><b>Tiến trình bảo chứng được bảo toàn khi qua kỳ mới.</b> Số lượt khai mở đã tích lũy không bị đặt lại khi chuyển sang kỳ mới.</li>
            </ul>

            <h4>6. Lưu trữ tài nguyên</h4>
            <ul>
              <li>Chìa Khóa chưa sử dụng được bảo lưu khi chuyển sang tháng mới.</li>
              <li><span class="hb-rar-mythic">${tokenName}</span> đã tích lũy không bị thu hồi khi kết thúc tháng hoặc kỳ đổi thưởng.</li>
              <li>Các vật phẩm đã sở hữu được lưu trữ xuyên suốt, trừ những vật phẩm có thời hạn sử dụng riêng.</li>
            </ul>
            <p class="hb-rules-outro"><b>Chúc bạn may mắn và sớm sở hữu những vật phẩm mong muốn!</b></p>
          </div>
          ${groupsHtml}
        </div>
      </div>
    `;

    try {
      if (dlg.open) dlg.close();
      dlg.showModal();
    } catch (_) { }
  };

  /* ------------------------------------------------------------------------
     CHI TIẾT VẬT PHẨM TÚI ĐỒ & SỬ DỤNG
     ------------------------------------------------------------------------ */
  window.hbOpenItemDetail = function (invId) {
    const invList = hbState.data?.inventory || [];
    const item = invList.find((x) => x.id === Number(invId) || (Array.isArray(x.batches) && x.batches.some((b) => b.id === Number(invId))));
    const dlg = document.getElementById("handbookItemModal");
    const body = document.getElementById("hbItemDetailBody");
    if (!item || !dlg || !body) return;

    const batches = Array.isArray(item.batches) && item.batches.length ? item.batches : [item];
    const canActivateManual = item.itemKey.startsWith("double_pts") || item.itemKey.startsWith("study_bg") || item.itemKey === "mythic_study_bg";
    const firstUsableBatch = batches.find((b) => !b.activated) || batches[0];

    const batchesHtml = batches.length > 1 || item.expiresAt || item.itemKey.startsWith("double_pts")
      ? `
        <div class="hb-inv-batches-list">
          ${batches.map((b, idx) => {
        const bExp = b.expiresAt ? formatDurationRemaining(b.expiresAt) : "Không giới hạn";
        const statusText = b.activated
          ? (b.remainingBonus > 0 ? `Đang kích hoạt (còn +${b.remainingBonus}đ)` : "Đã kích hoạt")
          : "Chưa kích hoạt";
        const statusColor = b.activated ? "#d97706" : "#16a34a";
        return `
              <div class="hb-inv-batch-row">
                <div>
                  <div style="font-weight:800;">Nhóm #${idx + 1} · x${b.quantity}</div>
                  <div style="font-size:11px;color:var(--muted);">Hạn: ${escapeHtml(bExp)}</div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="font-size:11px;font-weight:800;color:${statusColor};">${escapeHtml(statusText)}</span>
                  ${canActivateManual && !b.activated ? `<button type="button" class="button button-primary button-sm" onclick="hbUseInventoryItem(${b.id})">Dùng</button>` : ""}
                </div>
              </div>
            `;
      }).join("")}
        </div>
      `
      : "";

    const remTime = item.expiresAt ? formatDurationRemaining(item.expiresAt) : "";

    body.innerHTML = `
      <div class="hb-item-detail-wrap">
        <div class="hb-item-detail-top">
          <div class="hb-item-detail-icon-box">${getItemIconSVG(item.itemKey, 42)}</div>
          <div class="hb-item-detail-meta">
            <h3>${escapeHtml(item.name)}</h3>
            <div class="hb-item-detail-badges">
              <span class="hb-card-pill hb-rarity-pill-${item.rarity || "common"}">${rarityLabel(item.rarity)}</span>
              <span class="hb-card-pill">Tổng số lượng: ${item.quantity}</span>
              ${item.level > 1 ? `<span class="hb-card-pill">Cấp ${item.level}</span>` : ""}
              ${remTime && batches.length === 1 ? `<span class="hb-card-pill" style="color:#16a34a;">${remTime}</span>` : ""}
              ${item.activatedCount > 0 ? `<span class="hb-card-pill" style="color:#d97706;">Đang kích hoạt: ${item.activatedCount}</span>` : ""}
            </div>
          </div>
        </div>

        <div class="hb-item-detail-box">
          ${escapeHtml(item.desc || "Vật phẩm phần thưởng trong Sổ tay khám phá.")}
          ${item.remainingBonus > 0 && batches.length === 1 ? `<div style="margin-top:6px;font-weight:700;color:#16a34a;">Hạn mức còn lại: +${item.remainingBonus} điểm</div>` : ""}
        </div>

        ${batchesHtml}

        <div class="hb-item-detail-where">
          Nơi dùng: ${escapeHtml(item.whereUsed || "RE:SEARCH")}
        </div>

        <div class="hb-item-detail-actions">
          <button type="button" class="button button-outline" onclick="document.getElementById('handbookItemModal').close()">Đóng</button>
          ${canActivateManual && firstUsableBatch ? `<button type="button" class="button button-primary" onclick="hbUseInventoryItem(${firstUsableBatch.id})">${(item.itemKey.startsWith("study_bg") || item.itemKey === "mythic_study_bg") ? "Áp dụng nền tự học" : "Kích hoạt ngay"}</button>` : ""}
          ${item.itemKey === "mythic_mushroom" ? `<button type="button" class="button button-primary" onclick="document.getElementById('handbookItemModal').close();hbOpenExchangeModal();">Mở Đổi thưởng giới hạn</button>` : ""}
        </div>
      </div>
    `;

    try {
      if (dlg.open) dlg.close();
      dlg.showModal();
    } catch (_) { }
  };

  window.hbUseInventoryItem = async function (invId) {
    try {
      const res = await window.requestAPI("/api/handbook/inventory/use", {
        method: "POST",
        body: JSON.stringify({ inventoryId: invId })
      });
      const dlg = document.getElementById("handbookItemModal");
      if (dlg && dlg.open) dlg.close();
      if (res?.message && typeof window.toast === "function") window.toast(res.message);
      if (res?.applyStudyBg && typeof window.applyStudyWallpaperPreset === "function") {
        await loadHandbookState(true);
        window.applyStudyWallpaperPreset(res.applyStudyBg);
      } else {
        await loadHandbookState(true);
      }
    } catch (e) {
      if (typeof window.toast === "function") window.toast(e.message || "Không thể sử dụng vật phẩm này.");
    }
  };

  /* ------------------------------------------------------------------------
     MỞ RƯƠNG MAY MẮN X1 / X10: CHẠM / BẤM SPAM TỤ LỰC — NHẢ RA MỚI KHAI MỞ
     ------------------------------------------------------------------------ */
  let activeChestReleaseTimer = null;

  async function executeChestReveal(mode, dlg, stage) {
    if (!dlg || !stage || stage.dataset.opening === "1") return;
    stage.dataset.opening = "1";

    const chestBtn = stage.querySelector("#hbChestInteractiveBtn");
    const statusLabel = stage.querySelector(".hb-chest-status-label");
    const cancelBtn = stage.querySelector("#hbChestCancelBtn");
    if (cancelBtn) cancelBtn.style.display = "none";
    if (chestBtn) {
      chestBtn.classList.remove("is-charging", "is-tap-bump");
      chestBtn.classList.add("is-shaking");
      chestBtn.disabled = true;
    }
    if (statusLabel) {
      statusLabel.textContent = `Đang khai mở Rương may mắn (${mode === "x10" ? "x10" : "x1"})...`;
    }

    try {
      const [res] = await Promise.all([
        window.requestAPI("/api/handbook/chest/open", {
          method: "POST",
          body: JSON.stringify({ mode })
        }),
        new Promise((r) => setTimeout(r, 620))
      ]);

      if (chestBtn) {
        chestBtn.classList.remove("is-shaking");
        chestBtn.innerHTML = SVG_ICONS.chestOpen(142);
        chestBtn.classList.add("is-open-reveal");
      }
      if (statusLabel) {
        statusLabel.textContent = "Khai mở thành công!";
      }
      await new Promise((r) => setTimeout(r, 540));

      const results = res?.results || [];
      const isSingle = results.length <= 1;

      const cardsHtml = results.map((r, idx) => {
        const subTxt = r.isConverted
          ? `Trùng: +${r.convertedPoints} điểm`
          : r.awardedPoints > 0
            ? `+${r.awardedPoints} điểm hoạt động`
            : r.autoActivated
              ? `Tự kích hoạt ${r.durationDays} ngày`
              : `Nhận x${r.quantity || 1}`;
        return `
          <div class="hb-gacha-card rarity-${r.rarity || "common"}" style="animation-delay: ${idx * 65}ms;">
            <div>${getItemIconSVG(r.itemKey, 36)}</div>
            <div class="hb-gacha-card-name">${escapeHtml(r.name)}</div>
            <div class="hb-gacha-card-sub">${escapeHtml(subTxt)}</div>
            ${r.isConverted ? `<span class="hb-gacha-converted">+${r.convertedPoints} quy đổi</span>` : ""}
          </div>
        `;
      }).join("");

      stage.innerHTML = `
        <div class="hb-chest-aura" style="opacity:0.55;"></div>
        <div class="hb-chest-result-top">${SVG_ICONS.chestOpen(42)}<span>Chúc mừng! Bạn nhận được</span></div>
        <div class="hb-gacha-grid ${isSingle ? "is-single" : ""}">${cardsHtml}</div>
        <div style="z-index:2;margin-top:6px;">
          <button type="button" class="button button-primary" onclick="document.getElementById('handbookChestModal').close()">Nhận tất cả</button>
        </div>
      `;

      await loadHandbookState(true);
      if (typeof window.hydrateServer === "function") window.hydrateServer();
    } catch (e) {
      if (dlg.open) dlg.close();
      if (typeof window.toast === "function") window.toast(e.message || "Không thể mở rương lúc này.");
    }
  }

  window.hbOpenChest = function (mode) {
    const dlg = document.getElementById("handbookChestModal");
    const stage = document.getElementById("hbChestStage");
    if (!dlg || !stage) return;

    if (activeChestReleaseTimer) {
      clearTimeout(activeChestReleaseTimer);
      activeChestReleaseTimer = null;
    }

    const modeLabel = mode === "x10" ? "Mở x10 (9 chìa)" : "Mở x1 (1 chìa)";
    stage.dataset.opening = "0";
    stage.innerHTML = `
      <div class="hb-chest-aura"></div>
      <div style="font-size:12px;font-weight:800;color:#FDE68A;letter-spacing:0.04em;text-transform:uppercase;z-index:2;">${modeLabel}</div>
      <button type="button" id="hbChestInteractiveBtn" class="hb-chest-hero-svg hb-chest-touch-btn" aria-label="Chạm để khai mở">
        ${SVG_ICONS.chest(136)}
      </button>
      <div class="hb-chest-status-label" style="font-size:15px;font-weight:800;letter-spacing:0.02em;z-index:2;">Chạm để khai mở</div>
      <button type="button" id="hbChestCancelBtn" class="button button-outline button-sm" style="z-index:2;color:#cbd5e1;border-color:rgba(148,163,184,0.35);" onclick="document.getElementById('handbookChestModal').close()">Đóng lại</button>
    `;

    try {
      if (dlg.open) dlg.close();
      dlg.showModal();
    } catch (_) { }

    const chestBtn = stage.querySelector("#hbChestInteractiveBtn");
    const auraEl = stage.querySelector(".hb-chest-aura");

    let pressDownAt = 0;
    let isPressed = false;
    let holdTick = null;
    let chargePct = 0;

    const updateAuraGlow = () => {
      if (auraEl) auraEl.style.opacity = String(0.45 + (Math.min(100, chargePct) / 100) * 0.55);
    };

    const startPress = (ev) => {
      if (ev && ev.cancelable) ev.preventDefault();
      if (stage.dataset.opening === "1" || isPressed) return;
      if (activeChestReleaseTimer) {
        clearTimeout(activeChestReleaseTimer);
        activeChestReleaseTimer = null;
      }
      isPressed = true;
      pressDownAt = Date.now();
      chargePct = Math.min(100, chargePct + 24);
      chestBtn.classList.remove("is-tap-bump");
      void chestBtn.offsetWidth;
      chestBtn.classList.add("is-charging", "is-tap-bump");
      updateAuraGlow();

      if (holdTick) clearInterval(holdTick);
      holdTick = setInterval(() => {
        if (!isPressed || stage.dataset.opening === "1") return;
        chargePct = Math.min(100, chargePct + 8);
        updateAuraGlow();
      }, 45);
    };

    const finishPress = () => {
      if (!isPressed) return;
      isPressed = false;
      if (holdTick) { clearInterval(holdTick); holdTick = null; }
      chestBtn.classList.remove("is-charging");
      if (stage.dataset.opening === "1") return;

      const heldMs = Date.now() - pressDownAt;
      // Giữ lâu (>= 450ms) thì nhả ra mở ngay; chạm nhanh cho phép bấm spam rồi nhả hẳn 380ms sau mới mở!
      if (heldMs >= 450) {
        chargePct = 100;
        updateAuraGlow();
        executeChestReveal(mode, dlg, stage);
      } else {
        activeChestReleaseTimer = setTimeout(() => {
          activeChestReleaseTimer = null;
          if (!dlg.open || isPressed) return;
          chargePct = 100;
          updateAuraGlow();
          executeChestReveal(mode, dlg, stage);
        }, 380);
      }
    };

    chestBtn.addEventListener("pointerdown", startPress);
    window.addEventListener("pointerup", finishPress, { passive: true });
    window.addEventListener("pointercancel", finishPress, { passive: true });
    chestBtn.addEventListener("keydown", (e) => {
      if ((e.key === " " || e.key === "Enter") && !e.repeat) startPress(e);
    });
    chestBtn.addEventListener("keyup", (e) => {
      if (e.key === " " || e.key === "Enter") finishPress();
    });

    const cleanupListeners = () => {
      if (holdTick) { clearInterval(holdTick); holdTick = null; }
      if (activeChestReleaseTimer) { clearTimeout(activeChestReleaseTimer); activeChestReleaseTimer = null; }
      window.removeEventListener("pointerup", finishPress);
      window.removeEventListener("pointercancel", finishPress);
    };
    dlg.addEventListener("close", cleanupListeners, { once: true });
  };

  window.hbGrantTestKeys = async function () {
    try {
      const res = await window.requestAPI("/api/handbook/test/grant-keys", {
        method: "POST",
        body: JSON.stringify({ keys: 10 })
      });
      if (typeof window.toast === "function") window.toast(res?.message || "Đã cấp 10 chìa rương thử nghiệm.");
      await loadHandbookState(true);
    } catch (e) {
      if (typeof window.toast === "function") window.toast(e.message || "Không thể cấp chìa.");
    }
  };

  window.hbResetTestMythics = async function () {
    try {
      const res = await window.requestAPI("/api/handbook/test/reset-mythics", {
        method: "POST",
        body: JSON.stringify({})
      });
      if (typeof window.toast === "function") window.toast(res?.message || "Đã reset vật phẩm Cực phẩm.");
      await loadHandbookState(true);
    } catch (e) {
      if (typeof window.toast === "function") window.toast(e.message || "Không thể reset Cực phẩm.");
    }
  };

  /* ------------------------------------------------------------------------
     THEO DÕI NGẦM: HOẠT ĐỘNG 60 PHÚT, ĐỌC BÀI ĐĂNG 1 PHÚT & ĐỌC TÀI LIỆU 1 PHÚT
     ------------------------------------------------------------------------ */
  function startSilentActivityObservers() {
    setInterval(async () => {
      if (!window.session) return;
      const now = Date.now();
      const dtSec = Math.round((now - hbState.lastTickAt) / 1000);
      hbState.lastTickAt = now;

      if (document.visibilityState === "visible") {
        hbState.visibleSecondsAcc += Math.min(20, Math.max(1, dtSec));
      }

      if (hbState.visibleSecondsAcc >= 15) {
        const sendSec = hbState.visibleSecondsAcc;
        hbState.visibleSecondsAcc = 0;
        try {
          const res = await window.requestAPI("/api/handbook/heartbeat", {
            method: "POST",
            body: JSON.stringify({ visibleSeconds: sendSec })
          });
          if (res?.updates?.length) {
            loadHandbookState(true);
          }
        } catch (_) { }
      }
    }, 15000);

    setInterval(async () => {
      if (!window.session || document.visibilityState !== "visible") return;

      const postPage = document.getElementById("postDetail");
      const detailModal = document.getElementById("detailModal");
      const activePostId = window.postReadActivePostId || null;
      const viewingPost = Boolean((postPage && postPage.classList.contains("active-page")) || (detailModal && detailModal.open));
      if (viewingPost && activePostId) {
        if (hbState.postReadTrack.id !== activePostId) {
          hbState.postReadTrack.id = activePostId;
          hbState.postReadTrack.ms = 0;
        }
        hbState.postReadTrack.ms += 2000;
        if (hbState.postReadTrack.ms >= 60000 && !hbState.postReadTrack.sentIds.has(activePostId)) {
          hbState.postReadTrack.sentIds.add(activePostId);
          try {
            await window.requestAPI("/api/handbook/heartbeat", {
              method: "POST",
              body: JSON.stringify({ visibleSeconds: 0, action: "read_post", refId: activePostId })
            });
            loadHandbookState(true);
          } catch (_) { }
        }
      } else {
        hbState.postReadTrack.id = null;
        hbState.postReadTrack.ms = 0;
      }

      const docModal = document.getElementById("documentViewerModal");
      const activeDocId = window.currentViewingDocId || null;
      if (docModal && docModal.open && activeDocId) {
        if (hbState.docReadTrack.id !== activeDocId) {
          hbState.docReadTrack.id = activeDocId;
          hbState.docReadTrack.ms = 0;
        }
        hbState.docReadTrack.ms += 2000;
        if (hbState.docReadTrack.ms >= 60000 && !hbState.docReadTrack.sentIds.has(activeDocId)) {
          hbState.docReadTrack.sentIds.add(activeDocId);
          try {
            await window.requestAPI("/api/handbook/heartbeat", {
              method: "POST",
              body: JSON.stringify({ visibleSeconds: 0, action: "read_doc", refId: activeDocId })
            });
            loadHandbookState(true);
          } catch (_) { }
        }
      } else {
        hbState.docReadTrack.id = null;
        hbState.docReadTrack.ms = 0;
      }
    }, 2000);
  }

  /* ------------------------------------------------------------------------
     ARENA SUPPORT ITEMS: TRANG BỊ TRƯỚC TRẬN & THANH VẬT PHẨM TRONG TRẬN
     ------------------------------------------------------------------------ */
  window.hbResetArenaLoadout = function () {
    hbState.loadout.eyeInvId = null;
    hbState.loadout.cloakInvId = null;
  };

  function summarizeMatchItem(it) {
    const k = String(it?.itemKey || "");
    const lv = Number(it?.level || 1);
    const meta = typeof it?.metaJson === "string" ? (() => { try { return JSON.parse(it.metaJson); } catch { return {}; } })() : (it?.meta || {});
    if (k.startsWith("arena_eye")) {
      const charges = Number(meta.charges || (lv === 3 ? 5 : (lv === 2 ? 3 : 1)));
      return { effect: `Báo & chọn lại câu sai (${charges} lần/trận)`, baseTitle: "Mắt thần", limitText: `Cấp ${lv} · ${charges} lần` };
    }
    if (k.startsWith("arena_cloak")) {
      const fixLimit = Number(meta.fixLimit || lv);
      return { effect: `Soát & sửa tối đa ${fixLimit} câu sai`, baseTitle: "Áo choàng tiên tri", limitText: `Cấp ${lv} · Tối đa ${fixLimit} câu` };
    }
    if (k === "arena_loupe_1") return { effect: "Loại 1 đáp án sai", limitText: "1/câu" };
    if (k === "arena_loupe_2") return { effect: "Loại 2 đáp án sai", limitText: "1/câu" };
    if (k.startsWith("arena_hourglass")) {
      const sec = Number(meta.freezeSeconds || (lv === 3 ? 15 : (lv === 2 ? 10 : 5)));
      return { effect: `Ngưng đọng ${sec}s`, limitText: `Cấp ${lv}` };
    }
    if (k === "arena_lamp") return { effect: "Mở gợi ý câu hỏi", limitText: "1/câu" };
    if (k === "arena_hammer") return { effect: "Bỏ giới hạn 60s · giữ 60⭐", limitText: "1/câu" };
    return { effect: it?.desc || "", limitText: `Cấp ${lv}` };
  }

  window.hbRenderArenaStartLoadout = async function (skipFetch = false, attemptsUsed = 0) {
    const container = document.getElementById("quizStartLoadoutContainer");
    if (!container) return;

    if (!skipFetch || !hbState.data) {
      await loadHandbookState(true);
    }

    const inv = hbState.data?.inventory || [];
    const eyes = inv.filter((x) => x.itemKey.startsWith("arena_eye") && x.quantity > 0);
    const cloaks = inv.filter((x) => x.itemKey.startsWith("arena_cloak") && x.quantity > 0);
    const inMatchItems = inv.filter((x) =>
      ["arena_loupe_1", "arena_loupe_2", "arena_hourglass", "arena_lamp", "arena_hammer"].includes(x.itemKey) &&
      x.quantity > 0
    );

    const pickedEye = eyes.find((x) => x.id === hbState.loadout.eyeInvId) || null;
    const pickedCloak = cloaks.find((x) => x.id === hbState.loadout.cloakInvId) || null;
    if (!pickedEye && hbState.loadout.eyeInvId) hbState.loadout.eyeInvId = null;
    if (!pickedCloak && hbState.loadout.cloakInvId) hbState.loadout.cloakInvId = null;

    const bestEye = pickedEye || eyes[0] || null;
    const bestCloak = pickedCloak || cloaks[0] || null;
    const totalEyes = eyes.reduce((s, x) => s + Number(x.quantity || 0), 0);
    const totalCloaks = cloaks.reduce((s, x) => s + Number(x.quantity || 0), 0);

    const renderPreMatchCard = (slot, item, totalQty, iconHtml, fallbackName) => {
      const isSelected = slot === "eye" ? Boolean(hbState.loadout.eyeInvId) : Boolean(hbState.loadout.cloakInvId);
      const rar = item?.rarity || "epic";
      const sum = item ? summarizeMatchItem(item) : null;
      const tip = item ? `${item.name} (${rarityLabel(rar)}) — ${item.desc || sum?.effect || ""}` : "Mở Rương may mắn để nhận vật phẩm này";
      return `
        <button type="button" class="arena-loadout-card ${isSelected ? "is-equipped" : ""} ${!item ? "is-empty" : ""}"
          title="${escapeHtml(tip)}"
          ${!item ? "disabled" : `onclick="hbToggleArenaLoadout('${slot}', ${item.id})"`}>
          ${iconHtml}
          <div class="arena-loadout-info">
            <div class="arena-loadout-head">
              <span class="arena-loadout-name">${item ? escapeHtml(item.name) : escapeHtml(fallbackName)}</span>
              ${item ? `<span class="hb-card-pill hb-rarity-pill-${rar}">${rarityLabel(rar)}</span>` : ""}
            </div>
            <div class="arena-loadout-sub">${item ? `${escapeHtml(sum.effect)} · Còn <b>${totalQty}</b>` : "Chưa sở hữu"}</div>
          </div>
        </button>
      `;
    };

    const inMatchHtml = inMatchItems.length
      ? inMatchItems.map((it) => {
        const rar = it.rarity || "common";
        const sum = summarizeMatchItem(it);
        const tip = `${it.name} (${rarityLabel(rar)} · ${sum.limitText}) — ${it.desc || sum.effect}`;
        return `
            <div class="arena-inmatch-chip rarity-${rar}" title="${escapeHtml(tip)}">
              ${getItemIconSVG(it.itemKey, 16)}
              <div class="arena-inmatch-chip-body">
                <div class="arena-inmatch-chip-top">
                  <span class="arena-inmatch-chip-name">${escapeHtml(it.name)}</span>
                  <span class="hb-card-pill hb-rarity-pill-${rar}">${rarityLabel(rar)}</span>
                  <span class="arena-inmatch-chip-qty">x${it.quantity}</span>
                </div>
                <div class="arena-inmatch-chip-effect">${escapeHtml(sum.effect)} · ${escapeHtml(sum.limitText)}</div>
              </div>
            </div>
          `;
      }).join("")
      : `<div class="arena-inmatch-chip-empty">Chưa có vật phẩm hỗ trợ trong trận.</div>`;

    container.innerHTML = `
      <div class="arena-loadout-box">
        <div class="arena-loadout-title">${SVG_ICONS.sparkle(14)} <span>Trang bị trước khi thi</span></div>
        <div class="arena-loadout-grid">
          ${renderPreMatchCard("eye", bestEye, totalEyes, SVG_ICONS.eye(20), "Mắt thần")}
          ${renderPreMatchCard("cloak", bestCloak, totalCloaks, SVG_ICONS.cloak(20), "Áo choàng tiên tri")}
        </div>
        <div class="arena-loadout-title" style="margin-top:6px;">${SVG_ICONS.bag(14)} <span>Vật phẩm sử dụng trong trận</span></div>
        <div class="arena-inmatch-preview-grid">${inMatchHtml}</div>
      </div>
    `;
  };

  window.hbToggleArenaLoadout = function (slot, invId) {
    if (slot === "eye") {
      hbState.loadout.eyeInvId = hbState.loadout.eyeInvId === invId ? null : invId;
    } else if (slot === "cloak") {
      hbState.loadout.cloakInvId = hbState.loadout.cloakInvId === invId ? null : invId;
    }
    window.hbRenderArenaStartLoadout(true);
  };

  window.hbGetArenaStartLoadout = function () {
    return {
      eyeInvId: hbState.loadout.eyeInvId || undefined,
      cloakInvId: hbState.loadout.cloakInvId || undefined
    };
  };

  window.hbSyncArenaSessionState = function (res) {
    if (!res) return;
    if (window.compState) {
      window.compState.attemptNumber = Number(res.attemptNumber || 1);
      window.compState.allowArenaItems = res.allowArenaItems !== false;
      window.compState.activeItems = res.activeItems || {};
      window.compState.arenaInventory = res.arenaInventory || [];
      window.compState.currentQuestionEffects = res.currentQuestionEffects || { disabledOptions: [], hammerActive: false, hintText: null };
    }
    hbState.freezeUntilMs = 0;
    hbState.hammerActive = Boolean(res.currentQuestionEffects?.hammerActive);
    renderArenaInMatchBar();
  };

  window.hbOnArenaQuestionRendered = function () {
    const q = window.compState?.activeQuestions?.[window.compState.currentQIndex];
    const optBtnD = document.getElementById("quizOptBtnD");
    const optD = document.getElementById("quizOptD");
    if (optBtnD && optD) {
      if (q && q.optionD) {
        optBtnD.style.display = "flex";
        optD.textContent = q.optionD;
      } else {
        optBtnD.style.display = "none";
        optD.textContent = "";
      }
    }

    const eff = window.compState?.currentQuestionEffects || {};
    hbState.hammerActive = Boolean(eff.hammerActive);
    hbState.freezeUntilMs = 0;

    if (Array.isArray(eff.disabledOptions) && eff.disabledOptions.length > 0) {
      eff.disabledOptions.forEach((opt) => hbDisableQuizOption(opt));
    }
    if (eff.hintText) {
      hbShowArenaHint(eff.hintText);
    }

    const cloakBox = document.getElementById("arenaCloakReviewPanel");
    if (cloakBox) cloakBox.style.display = "none";

    renderArenaInMatchBar();
  };

  function hbDisableQuizOption(opt, animate = false) {
    const btn = document.querySelector(`.quiz-option-btn[data-option="${opt}"]`);
    if (btn) {
      btn.disabled = true;
      btn.classList.remove("opt-selected");
      btn.classList.add("opt-eliminated");
      if (animate) {
        btn.classList.remove("opt-eliminated-anim");
        void btn.offsetWidth;
        btn.classList.add("opt-eliminated-anim");
      }
      btn.style.pointerEvents = "none";
    }
    if (window.compState && window.compState.selectedOption === opt) {
      window.compState.selectedOption = null;
      const confirmBtn = document.getElementById("quizConfirmNextBtn");
      if (confirmBtn) confirmBtn.disabled = true;
    }
  }

  function hbShowArenaHint(text) {
    const hintBox = document.getElementById("quizHintBox");
    const hintContent = document.getElementById("quizHintContent");
    if (hintBox && hintContent) {
      hintContent.textContent = text || "Chưa có gợi ý cho câu hỏi này.";
      hintBox.style.display = "block";
    }
  }

  function renderArenaInMatchBar() {
    const bar = document.getElementById("arenaInMatchItemBar");
    if (!bar || !window.compState || (window.compState.practice && window.compState.practice.active)) {
      if (bar) bar.style.display = "none";
      return;
    }

    bar.style.display = "flex";
    const inv = (window.compState.arenaInventory || []).filter((x) => !x.itemKey.startsWith("arena_eye") && !x.itemKey.startsWith("arena_cloak") && x.quantity > 0);
    const active = window.compState.activeItems || {};

    const pills = [];
    if (active.eyeRemaining > 0) {
      pills.push(`<span class="arena-buff-pill">${SVG_ICONS.eye(14)} Mắt thần: còn ${active.eyeRemaining}</span>`);
    }
    const cloakCap = Number(active.cloakLimit || active.cloakRemaining || 0);
    if (cloakCap > 0 && !active.cloakUsed) {
      pills.push(`<span class="arena-buff-pill">${SVG_ICONS.cloak(14)} Áo choàng: sửa ${cloakCap} câu</span>`);
    }
    if (hbState.hammerActive) {
      pills.push(`<span class="arena-buff-pill">${SVG_ICONS.hammer(14)} Búa thần: Đang bật</span>`);
    }

    const btnsHtml = inv.map((item) => `
      <button type="button" class="arena-use-item-btn" onclick="hbUseArenaMatchItem(${item.id})" title="${escapeHtml(item.name)}">
        ${getItemIconSVG(item.itemKey, 18)}
        <span>${escapeHtml(item.name)}</span>
        <span style="opacity:0.75;">x${item.quantity}</span>
      </button>
    `).join("");

    bar.innerHTML = pills.join("") + (btnsHtml || (!pills.length ? `<span class="arena-inmatch-empty">Chưa có vật phẩm hỗ trợ Đấu trường (Mở Rương để nhận)</span>` : ""));
  }

  window.hbUseArenaMatchItem = async function (invId) {
    if (!window.compState?.sessionToken) return;
    try {
      const res = await window.requestAPI("/api/competition/session/use-item", {
        method: "POST",
        body: JSON.stringify({
          sessionToken: window.compState.sessionToken,
          inventoryId: invId
        })
      });

      if (res.arenaInventory) window.compState.arenaInventory = res.arenaInventory;
      if (Array.isArray(res.removedOptions) && res.removedOptions.length > 0) {
        res.removedOptions.forEach((opt) => hbDisableQuizOption(opt, true));
        if (typeof window.toast === "function") {
          window.toast(`Đã phát hiện và loại ${res.removedOptions.length} đáp án sai!`);
        }
      }
      if (res.freezeSeconds > 0) {
        hbState.freezeUntilMs = Date.now() + res.freezeSeconds * 1000;
        if (typeof window.toast === "function") window.toast(`Ngưng đọng thời gian thêm ${res.freezeSeconds} giây!`);
      }
      if (res.hintText) {
        hbShowArenaHint(res.hintText);
      }
      if (res.hammerActive) {
        hbState.hammerActive = true;
        const digits = document.getElementById("quizTimerDigits");
        if (digits) digits.textContent = "∞";
      }

      window.compState.currentQuestionEffects = {
        disabledOptions: res.disabledOptions || [],
        hammerActive: hbState.hammerActive,
        hintText: res.hintText || null
      };
      renderArenaInMatchBar();
      loadHandbookState(true);
    } catch (e) {
      if (typeof window.toast === "function") window.toast(e.message || "Không thể dùng vật phẩm.");
    }
  };

  window.hbIsTimerPausedByItem = function () {
    if (hbState.hammerActive) {
      const digits = document.getElementById("quizTimerDigits");
      if (digits) digits.textContent = "∞";
      return true;
    }
    if (hbState.freezeUntilMs > Date.now()) {
      return true;
    }
    return false;
  };

  /* ------------------------------------------------------------------------
     XỬ LÝ KẾT QUẢ MẮT THẦN & ÁO CHOÀNG TIÊN TRI
     ------------------------------------------------------------------------ */
  window.hbHandleArenaAnswerSpecial = function (res, chosenOption) {
    if (!res) return false;

    if (res.eyeReveal) {
      window.compState.isSubmittingAnswer = false;
      if (window.compState.activeItems) {
        window.compState.activeItems.eyeRemaining = res.eyeRemaining;
      }
      renderArenaInMatchBar();

      if (res.isCorrect) {
        if (typeof window.toast === "function") window.toast("Mắt thần xác nhận: Đáp án chính xác!");
        return false;
      }

      hbDisableQuizOption(chosenOption);
      window.compState.selectedOption = null;
      const confirmBtn = document.getElementById("quizConfirmNextBtn");
      if (confirmBtn) confirmBtn.disabled = true;

      if (typeof window.toast === "function") {
        window.toast(res.allowRetry
          ? `Mắt thần: Đáp án chưa đúng! Hãy chọn lại (còn ${res.eyeRemaining} lượt).`
          : "Mắt thần đã hết lượt dùng ở chặng này.");
      }
      if (typeof window.startQuizTimer === "function") window.startQuizTimer();
      return true;
    }

    if (res.cloakReview) {
      hbOpenCloakReviewPanel(res);
      return true;
    }

    return false;
  };

  function hbOpenCloakReviewPanel(res) {
    const playView = document.getElementById("quizPlayView");
    const panel = document.getElementById("arenaCloakReviewPanel");
    if (!panel || !playView) return;

    hbState.cloakState = {
      limit: Number(res.cloakLimit || 1),
      wrongIndices: res.wrongQuestionIndices || [],
      questions: res.questionsSummary || [],
      picks: {}
    };

    const qGrid = document.getElementById("quizQuestionCard");
    const optsGrid = document.getElementById("quizOptionsGrid");
    const itemBar = document.getElementById("arenaInMatchItemBar");
    const actionBar = document.getElementById("quizExamActionBar");
    if (qGrid) qGrid.style.display = "none";
    if (optsGrid) optsGrid.style.display = "none";
    if (itemBar) itemBar.style.display = "none";
    if (actionBar) actionBar.style.display = "none";

    panel.style.display = "block";
    renderCloakReviewContent();
  }

  function renderCloakReviewContent() {
    const panel = document.getElementById("arenaCloakReviewPanel");
    const st = hbState.cloakState;
    if (!panel || !st) return;

    const pickedCount = Object.keys(st.picks).length;
    const wrongItems = (st.questions || []).filter((q) => st.wrongIndices.includes(q.index));

    panel.innerHTML = `
      <div class="arena-cloak-review-box">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <div style="display:flex;align-items:center;gap:8px;font-size:15px;font-weight:800;">
            ${SVG_ICONS.cloak(22)}
            <span>Áo choàng tiên tri — Phát hiện ${wrongItems.length} câu chưa đúng</span>
          </div>
          <span class="arena-buff-pill">Đã chọn sửa: ${pickedCount} / ${st.limit}</span>
        </div>

        <div style="display:flex;flex-direction:column;gap:9px;max-height:52vh;overflow-y:auto;">
          ${wrongItems.map((q) => {
      const opts = ["A", "B", "C", q.optionD ? "D" : null].filter(Boolean);
      return `
              <div class="arena-cloak-q-card">
                <div style="font-size:13px;font-weight:700;">Câu ${q.index}: ${escapeHtml(q.questionText)}</div>
                <div style="font-size:11.5px;color:#fca5a5;">Đã chọn trước đó: ${escapeHtml(q.selectedOption || "Hết giờ")}</div>
                <div class="arena-cloak-opts">
                  ${opts.map((opt) => {
        const txt = q[`option${opt}`];
        const isPicked = st.picks[q.index] === opt;
        const disabled = opt === q.selectedOption;
        return `
                      <button type="button" class="arena-cloak-opt-btn ${isPicked ? "is-picked" : ""}"
                        ${disabled ? "disabled style='opacity:0.4;text-decoration:line-through;'" : `onclick="hbPickCloakCorrection(${q.index}, '${opt}')"`}>
                        <strong>${opt}.</strong> ${escapeHtml(txt)}
                      </button>
                    `;
      }).join("")}
                </div>
              </div>
            `;
    }).join("")}
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button type="button" class="button button-primary" onclick="hbSubmitCloakCorrections()">
            Xác nhận &amp; Hoàn tất bài thi
          </button>
        </div>
      </div>
    `;
  }

  window.hbPickCloakCorrection = function (qIndex, opt) {
    const st = hbState.cloakState;
    if (!st) return;
    if (st.picks[qIndex] === opt) {
      delete st.picks[qIndex];
    } else {
      if (!st.picks[qIndex] && Object.keys(st.picks).length >= st.limit) {
        if (typeof window.toast === "function") window.toast(`Chỉ được chọn sửa tối đa ${st.limit} câu!`);
        return;
      }
      st.picks[qIndex] = opt;
    }
    renderCloakReviewContent();
  };

  window.hbSubmitCloakCorrections = async function () {
    const st = hbState.cloakState;
    if (!st || !window.compState?.sessionToken) return;
    const corrections = Object.entries(st.picks).map(([qIdx, opt]) => ({
      questionIndex: Number(qIdx),
      selectedOption: opt
    }));

    try {
      const res = await window.requestAPI("/api/competition/session/cloak-submit", {
        method: "POST",
        body: JSON.stringify({
          sessionToken: window.compState.sessionToken,
          corrections
        })
      });
      const panel = document.getElementById("arenaCloakReviewPanel");
      const qGrid = document.getElementById("quizQuestionCard");
      const optsGrid = document.getElementById("quizOptionsGrid");
      const actionBar = document.getElementById("quizExamActionBar");
      if (panel) panel.style.display = "none";
      if (qGrid) qGrid.style.display = "";
      if (optsGrid) optsGrid.style.display = "";
      if (actionBar) actionBar.style.display = "";
      if (typeof window.showQuizFinalResult === "function") {
        window.showQuizFinalResult(res.finalResult);
      }
    } catch (e) {
      if (typeof window.toast === "function") window.toast(e.message || "Lỗi khi hoàn tất sửa bài.");
    }
  };

  window.hbHydrateRuleItemIcons = function () {
    document.querySelectorAll("[data-arena-rule-icon]").forEach((el) => {
      const key = el.getAttribute("data-arena-rule-icon");
      const size = Number(el.getAttribute("data-icon-size") || 22);
      if (key === "key") {
        el.innerHTML = SVG_ICONS.key(size);
      } else {
        el.innerHTML = getItemIconSVG(key, size);
      }
    });
  };

  /* ------------------------------------------------------------------------
     KHỞI TẠO KHI TẢI TRANG
     ------------------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", () => {
    window.hbHydrateRuleItemIcons();
    startSilentActivityObservers();
    setTimeout(() => {
      loadHandbookState(true);
    }, 40);
  });
})();
