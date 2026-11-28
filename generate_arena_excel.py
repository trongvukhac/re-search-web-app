#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script xuất báo cáo Excel thống kê chi tiết Đấu trường RE:SEARCH ARENA (Tuần 1 - Tuần 6).
Tạo file Excel chuẩn chỉnh, chuyên nghiệp, đa chiều với đầy đủ bảng biểu, biểu đồ chỉ số,
xếp hạng, điểm số, thời gian làm bài, phân tích vi phạm, và đối chiếu sĩ số lớp.
"""

import sqlite3
import json
import re
from datetime import datetime, timedelta
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

DB_PATH = "data/prod_research.db"
ROSTER_PATH = "arena_roster.json"
OUTPUT_FILE = "THONG_KE_ARENA_TUAN_1_DEN_TUAN_6.xlsx"

# 1. Cấu hình thông tin 6 Tuần thi đấu chính thức
WEEKS = [
    {
        "week_num": 1,
        "comp_id": 3,
        "week_key": "2026-W41",
        "dates": "05/10/2026 - 11/10/2026",
        "topic": "Phương pháp nghiên cứu định tính",
        "phase1_topic": "Nắm vững nền tảng",
        "phase2_topic": "Vận dụng phương pháp",
        "phase3_topic": "Giải mã nghiên cứu"
    },
    {
        "week_num": 2,
        "comp_id": 4,
        "week_key": "2026-W42",
        "dates": "12/10/2026 - 18/10/2026",
        "topic": "Phỏng vấn sâu",
        "phase1_topic": "Nắm vững kỹ thuật",
        "phase2_topic": "Chiến lược phỏng vấn",
        "phase3_topic": "Tư duy phân tích dữ liệu"
    },
    {
        "week_num": 3,
        "comp_id": 5,
        "week_key": "2026-W43",
        "dates": "19/10/2026 - 25/10/2026",
        "topic": "PHƯƠNG PHÁP NGHIÊN CỨU ĐỊNH LƯỢNG",
        "phase1_topic": "Nhận diện dữ liệu định lượng",
        "phase2_topic": "Khai báo biến và thống kê mô tả",
        "phase3_topic": "Làm việc với số liệu"
    },
    {
        "week_num": 4,
        "comp_id": 7,
        "week_key": "2026-W45",
        "dates": "02/11/2026 - 08/11/2026",
        "topic": "Mô hình nghiên cứu",
        "phase1_topic": "Định hình mô hình nghiên cứu",
        "phase2_topic": "Kết nối lý thuyết",
        "phase3_topic": "Hoàn thiện mô hình nghiên cứu"
    },
    {
        "week_num": 5,
        "comp_id": 8,
        "week_key": "2026-W46",
        "dates": "09/11/2026 - 15/11/2026",
        "topic": "Mô hình nghiên cứu và tư duy lý thuyết",
        "phase1_topic": "Bóc tách khái niệm",
        "phase2_topic": "Giải mã lý thuyết",
        "phase3_topic": "Phản biện và vận dụng lý thuyết"
    },
    {
        "week_num": 6,
        "comp_id": 9,
        "week_key": "2026-W47",
        "dates": "16/11/2026 - 22/11/2026",
        "topic": "Thu thập dữ liệu",
        "phase1_topic": "Mẫu và tiêu chí chọn mẫu",
        "phase2_topic": "Kiểm soát cỡ mẫu",
        "phase3_topic": "Thẩm định công cụ"
    }
]

COMP_IDS = [w["comp_id"] for w in WEEKS]
COMP_ID_TO_WEEK = {w["comp_id"]: w for w in WEEKS}

def to_gmt7_str(utc_str):
    if not utc_str:
        return ""
    try:
        dt = datetime.strptime(utc_str, "%Y-%m-%d %H:%M:%S")
        dt7 = dt + timedelta(hours=7)
        return dt7.strftime("%d/%m/%Y %H:%M:%S")
    except Exception:
        return str(utc_str)

def format_duration(seconds):
    if seconds is None:
        return "00:00"
    sec = int(round(seconds))
    if sec < 0:
        sec = 0
    m = sec // 60
    s = sec % 60
    return f"{m:02d}:{s:02d}"

# Style definitions
FONT_FAMILY = "Segoe UI"
font_title = Font(name=FONT_FAMILY, size=16, bold=True, color="1E3A8A")
font_subtitle = Font(name=FONT_FAMILY, size=11, italic=True, color="475569")
font_section = Font(name=FONT_FAMILY, size=13, bold=True, color="0F172A")
font_card_num = Font(name=FONT_FAMILY, size=20, bold=True, color="1E3A8A")
font_card_lbl = Font(name=FONT_FAMILY, size=9, bold=True, color="64748B")

font_header = Font(name=FONT_FAMILY, size=11, bold=True, color="FFFFFF")
font_header_sub = Font(name=FONT_FAMILY, size=10, bold=True, color="FFFFFF")
font_data = Font(name=FONT_FAMILY, size=10, color="000000")
font_data_bold = Font(name=FONT_FAMILY, size=10, bold=True, color="000000")
font_rank_gold = Font(name=FONT_FAMILY, size=10, bold=True, color="92400E")
font_rank_silver = Font(name=FONT_FAMILY, size=10, bold=True, color="334155")
font_rank_bronze = Font(name=FONT_FAMILY, size=10, bold=True, color="9A3412")

fill_navy = PatternFill("solid", fgColor="1E3A8A")
fill_blue_header = PatternFill("solid", fgColor="2563EB")
fill_slate_header = PatternFill("solid", fgColor="334155")
fill_teal_header = PatternFill("solid", fgColor="0F766E")
fill_purple_header = PatternFill("solid", fgColor="6B21A8")
fill_amber_header = PatternFill("solid", fgColor="B45309")

fill_gold = PatternFill("solid", fgColor="FEF08A")
fill_silver = PatternFill("solid", fgColor="E2E8F0")
fill_bronze = PatternFill("solid", fgColor="FFEDD5")
fill_zebra = PatternFill("solid", fgColor="F8FAFC")
fill_card = PatternFill("solid", fgColor="EFF6FF")
fill_green_light = PatternFill("solid", fgColor="DCFCE7")
fill_red_light = PatternFill("solid", fgColor="FEE2E2")

border_thin = Side(style="thin", color="CBD5E1")
border_cell = Border(left=border_thin, right=border_thin, top=border_thin, bottom=border_thin)
border_header = Border(left=border_thin, right=border_thin, top=border_thin, bottom=border_thin)
border_card = Border(
    left=Side(style="medium", color="3B82F6"),
    right=Side(style="thin", color="93C5FD"),
    top=Side(style="thin", color="93C5FD"),
    bottom=Side(style="thin", color="93C5FD")
)

align_center = Alignment(horizontal="center", vertical="center")
align_left = Alignment(horizontal="left", vertical="center")
align_right = Alignment(horizontal="right", vertical="center")
align_header = Alignment(horizontal="center", vertical="center", wrap_text=True)

def apply_auto_width(ws, min_width=10, max_width=45):
    for col in ws.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = 0
        for cell in col:
            if cell.row in [1, 2, 3]:
                continue
            val_str = str(cell.value or "")
            if "\n" in val_str:
                lines = val_str.split("\n")
                line_max = max(len(l) for l in lines)
                if line_max > max_len:
                    max_len = line_max
            else:
                if len(val_str) > max_len:
                    max_len = len(val_str)
        width = max(min_width, min(max_len + 4, max_width))
        ws.column_dimensions[col_letter].width = width

def main():
    print("1. Đang kết nối CSDL và đọc Roster...")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    with open(ROSTER_PATH) as f:
        roster_data = json.load(f)
    c06 = set(map(str, roster_data["06"]["studentIds"]))
    c07 = set(map(str, roster_data["07"]["studentIds"]))

    # Đọc danh sách tất cả người dùng
    users_db = c.execute("SELECT * FROM users").fetchall()
    user_map = {}
    for u in users_db:
        sid = str(u["student_id"] or "").strip()
        m = re.search(r"\.(\d{13})@vanlanguni\.vn", u["email"] or "")
        email_sid = m.group(1) if m else ""
        eff_sid = sid or email_sid

        real_name = (u["real_name"] or "").strip()
        disp_name = (u["display_name"] or "").strip()
        eff_name = real_name if real_name else disp_name

        if eff_sid in c06:
            cls_code = "06"
            cls_name = "261_71RESE30312_06"
            cls_label = "Lớp 06"
        elif eff_sid in c07:
            cls_code = "07"
            cls_name = "261_71RESE30312_07"
            cls_label = "Lớp 07"
        elif eff_sid.startswith("23") or eff_sid.startswith("24") or eff_sid.startswith("25") or "vanlanguni.vn" in (u["email"] or ""):
            cls_code = "TD"
            cls_name = "Bảng Tự do (VLU)"
            cls_label = "Tự do"
        else:
            cls_code = "OTHER"
            cls_name = "Tài khoản Quản trị / Khác"
            cls_label = "Khác"

        user_map[u["id"]] = {
            "id": u["id"],
            "email": u["email"],
            "student_id": eff_sid,
            "raw_student_id": sid,
            "display_name": disp_name,
            "real_name": real_name,
            "effective_name": eff_name,
            "class_code": cls_code,
            "class_name": cls_name,
            "class_label": cls_label,
            "role": u["role"]
        }

    # Đọc toàn bộ các sessions của 6 tuần
    sessions_db = c.execute("""
        SELECT * FROM competition_sessions
        WHERE competition_id IN (3, 4, 5, 7, 8, 9)
        ORDER BY competition_id ASC, phase ASC, user_id ASC, attempt_number ASC
    """).fetchall()

    session_map = {s["id"]: s for s in sessions_db}

    # Đọc kết quả các phase
    phase_res_db = c.execute("""
        SELECT * FROM competition_phase_results
        WHERE competition_id IN (3, 4, 5, 7, 8, 9)
        ORDER BY competition_id ASC, phase ASC, user_id ASC
    """).fetchall()

    # Đọc phần thưởng tuần
    rewards_db = c.execute("""
        SELECT * FROM competition_weekly_rewards
        WHERE competition_id IN (3, 4, 5, 7, 8, 9)
    """).fetchall()
    rewards_map = {(r["competition_id"], r["user_id"]): r for r in rewards_db}

    print(f"-> Đã tải {len(user_map)} tài khoản, {len(sessions_db)} sessions, {len(phase_res_db)} kết quả phase, {len(rewards_db)} bản ghi khen thưởng.")

    # Tổ chức dữ liệu theo từng Tuần
    weekly_data = {}
    for w in WEEKS:
        cid = w["comp_id"]
        u_phases = {}
        for pr in phase_res_db:
            if pr["competition_id"] == cid:
                uid = pr["user_id"]
                if uid not in u_phases:
                    u_phases[uid] = {}
                u_phases[uid][pr["phase"]] = pr

        w_users = {}
        for uid, phases in u_phases.items():
            uinfo = user_map.get(uid, {
                "id": uid, "effective_name": f"User {uid}", "student_id": "", "display_name": f"User {uid}",
                "class_code": "OTHER", "class_label": "Khác", "class_name": "Khác", "email": "", "role": "unknown"
            })

            tot_score = sum(pr["best_score"] for pr in phases.values())
            first_comp_at = min((pr["updated_at"] for pr in phases.values() if pr["updated_at"]), default="")
            
            p_details = {}
            tot_time_sec = 0
            tot_correct_q = 0
            tot_first_try = 0
            tot_on_time = 0

            for p_num in [1, 2, 3]:
                if p_num in phases:
                    pr = phases[p_num]
                    bsess = session_map.get(pr["best_session_id"]) if pr["best_session_id"] else None
                    if bsess:
                        dur = max(0, 600 - (bsess["remaining_seconds"] or 0)) if bsess["status"] == "completed" else 600
                        tot_time_sec += dur
                        tot_correct_q += (bsess["correct_count"] or 0)
                        tot_first_try += (bsess["first_try_correct_count"] or 0)
                        tot_on_time += (bsess["on_time_bonus"] or 0)
                        p_details[p_num] = {
                            "score": pr["best_score"],
                            "attempts": pr["attempts_used"],
                            "session_id": bsess["id"],
                            "correct_count": bsess["correct_count"] or 0,
                            "first_try_correct": bsess["first_try_correct_count"] or 0,
                            "correct_points": bsess["correct_points"] or 0,
                            "first_try_bonus": bsess["first_try_bonus"] or 0,
                            "time_points": bsess["time_points"] or 0,
                            "on_time_bonus": bsess["on_time_bonus"] or 0,
                            "remaining_seconds": bsess["remaining_seconds"] or 0,
                            "duration_seconds": dur,
                            "completed_at": bsess["finished_at"] or pr["updated_at"],
                            "exit_count": bsess["exit_count"] or 0,
                            "status": bsess["status"]
                        }
                    else:
                        p_details[p_num] = {
                            "score": pr["best_score"],
                            "attempts": pr["attempts_used"],
                            "session_id": None,
                            "correct_count": 0, "first_try_correct": 0, "correct_points": 0,
                            "first_try_bonus": 0, "time_points": 0, "on_time_bonus": 0,
                            "remaining_seconds": 0, "duration_seconds": 0,
                            "completed_at": pr["updated_at"],
                            "exit_count": 0, "status": "completed"
                        }
                else:
                    p_details[p_num] = None

            rew = rewards_map.get((cid, uid))
            w_users[uid] = {
                "user_id": uid,
                "user_info": uinfo,
                "phases_count": len(phases),
                "total_score": tot_score,
                "first_completed_at": first_comp_at,
                "phases": p_details,
                "total_time_seconds": tot_time_sec,
                "total_correct": tot_correct_q,
                "total_first_try": tot_first_try,
                "total_on_time_bonus": tot_on_time,
                "reward_rank": rew["rank"] if rew else None,
                "participation_bonus": rew["participation_bonus"] if rew else 0,
                "activity_points": rew["activity_points_awarded"] if rew else 0,
                "shields": rew["shields_awarded"] if rew else 0
            }

        sorted_all = sorted(w_users.values(), key=lambda x: (-x["total_score"], x["first_completed_at"] or "9999"))
        for idx, u in enumerate(sorted_all, 1):
            u["overall_rank"] = idx

        for cls_code in ["06", "07", "TD", "OTHER"]:
            cls_group = [u for u in sorted_all if u["user_info"]["class_code"] == cls_code]
            for idx, u in enumerate(cls_group, 1):
                u["class_rank"] = idx

        weekly_data[cid] = w_users

    # Tổ chức dữ liệu Tích lũy 6 tuần
    all_participant_ids = set()
    for w in WEEKS:
        all_participant_ids.update(weekly_data[w["comp_id"]].keys())

    cumulative_users = []
    for uid in all_participant_ids:
        uinfo = user_map[uid]
        tot_cum_score = 0
        tot_cum_time = 0
        tot_phases = 0
        weeks_count = 0
        week_scores = {}
        week_ranks = {}
        tot_sessions = sum(1 for s in sessions_db if s["user_id"] == uid)

        for w in WEEKS:
            cid = w["comp_id"]
            wn = w["week_num"]
            if uid in weekly_data[cid]:
                w_record = weekly_data[cid][uid]
                sc = w_record["total_score"]
                crk = w_record["class_rank"]
                ork = w_record["overall_rank"]
                tot_cum_score += sc
                tot_cum_time += w_record["total_time_seconds"]
                tot_phases += w_record["phases_count"]
                weeks_count += 1
                week_scores[wn] = sc
                week_ranks[wn] = (crk, ork)
            else:
                week_scores[wn] = 0
                week_ranks[wn] = (None, None)

        avg_score = tot_cum_score / weeks_count if weeks_count > 0 else 0
        avg_phase_time = tot_cum_time / tot_phases if tot_phases > 0 else 0

        badge = []
        if weeks_count == 6 and tot_phases == 18:
            badge.append("Chiến binh Bền bỉ (18/18 phase)")
        elif weeks_count == 6:
            badge.append("Tham gia trọn vẹn 6 tuần")
        if uinfo["class_code"] == "06" and uinfo["role"] == "student":
            badge.append("Lớp 06")
        elif uinfo["class_code"] == "07" and uinfo["role"] == "student":
            badge.append("Lớp 07")
        elif uinfo["class_code"] == "TD":
            badge.append("Bảng Tự do")
        elif uinfo["role"] == "admin":
            badge.append("Quản trị viên / DEV")

        cumulative_users.append({
            "user_id": uid,
            "user_info": uinfo,
            "total_score": tot_cum_score,
            "avg_score": avg_score,
            "weeks_count": weeks_count,
            "total_phases": tot_phases,
            "total_sessions": tot_sessions,
            "total_time_seconds": tot_cum_time,
            "avg_phase_time_seconds": avg_phase_time,
            "week_scores": week_scores,
            "week_ranks": week_ranks,
            "badge_str": " | ".join(badge)
        })

    cumulative_users.sort(key=lambda x: (-x["total_score"], -x["weeks_count"], x["total_time_seconds"]))
    for idx, cu in enumerate(cumulative_users, 1):
        cu["cumulative_overall_rank"] = idx

    for cls_code in ["06", "07", "TD", "OTHER"]:
        cgroup = [cu for cu in cumulative_users if cu["user_info"]["class_code"] == cls_code]
        for idx, cu in enumerate(cgroup, 1):
            cu["cumulative_class_rank"] = idx

    for cu in cumulative_users:
        if cu["cumulative_overall_rank"] == 1:
            cu["badge_str"] = "👑 THỦ KHOA TOÀN KHÓA | " + cu["badge_str"]
        elif cu["cumulative_overall_rank"] == 2:
            cu["badge_str"] = "🥈 Á KHOA 1 TOÀN KHÓA | " + cu["badge_str"]
        elif cu["cumulative_overall_rank"] == 3:
            cu["badge_str"] = "🥉 Á KHOA 2 TOÀN KHÓA | " + cu["badge_str"]
        
        if cu["user_info"]["class_code"] == "06" and cu["cumulative_class_rank"] == 1:
            cu["badge_str"] = "🏆 THỦ KHOA LỚP 06 | " + cu["badge_str"]
        elif cu["user_info"]["class_code"] == "07" and cu["cumulative_class_rank"] == 1:
            cu["badge_str"] = "🏆 THỦ KHOA LỚP 07 | " + cu["badge_str"]

    print("2. Đang tạo Workbook Excel với openpyxl...")
    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    # =========================================================================
    # SHEET 1: TỔNG QUAN & KPI (DASHBOARD)
    # =========================================================================
    print("   -> Đang tạo Sheet 1: 📊 Tổng quan & KPI...")
    ws_dash = wb.create_sheet(title="📊 Tổng quan & KPI")
    ws_dash.views.sheetView[0].showGridLines = True

    ws_dash.merge_cells("A1:L1")
    ws_dash["A1"] = "BÁO CÁO THỐNG KÊ TOÀN DIỆN ĐẤU TRƯỜNG HỌC THUẬT RE:SEARCH ARENA"
    ws_dash["A1"].font = Font(name=FONT_FAMILY, size=16, bold=True, color="1E3A8A")
    ws_dash["A1"].alignment = align_left

    ws_dash.merge_cells("A2:L2")
    ws_dash["A2"] = "Học phần: Phương pháp Nghiên cứu Khoa học | Mã học phần: 261_71RESE30312 (Lớp 06 & Lớp 07) | Trường ĐH Văn Lang"
    ws_dash["A2"].font = Font(name=FONT_FAMILY, size=11, bold=True, color="475569")
    ws_dash["A2"].alignment = align_left

    ws_dash.merge_cells("A3:L3")
    ws_dash["A3"] = "Giai đoạn thống kê: Từ Tuần 1 triển khai (05/10/2026) đến hết Tuần 6 (22/11/2026) | Dữ liệu chính thức từ Production Database"
    ws_dash["A3"].font = Font(name=FONT_FAMILY, size=10, italic=True, color="64748B")
    ws_dash["A3"].alignment = align_left

    # KPI Cards
    kpi_cards = [
        ("A5", "B6", "51", "TỔNG NGƯỜI THAM GIA", "45 SV chính quy + 6 test/khác"),
        ("C5", "D6", "404", "TỔNG SỐ LƯỢT THI", "395 hoàn thành (97.8%)"),
        ("E5", "F6", "18,805", "ĐIỂM TÍCH LŨY KỶ LỤC", "SV Trần Thị Hồng Luyến (Lớp 07)"),
        ("G5", "H6", "3,244", "ĐIỂM TUẦN CAO NHẤT", "SV Vũ Bảo Ngọc (Tuần 5)"),
        ("I5", "J6", "16.5 Giờ", "TỔNG THỜI LƯỢNG THI", "TB ~2 phút 27 giây / phase"),
        ("K5", "L6", "44 / 200", "TỶ LỆ THAM GIA ROSTER", "22.0% tổng sĩ số 2 lớp")
    ]

    for top_left, bot_right, val, label, sub in kpi_cards:
        c1 = top_left[0]
        r1 = int(top_left[1])
        c2 = bot_right[0]
        r2 = int(bot_right[1])
        ws_dash.merge_cells(f"{top_left}:{bot_right}")
        cell = ws_dash[top_left]
        cell.value = f"{val}\n{label}\n({sub})"
        cell.font = Font(name=FONT_FAMILY, size=11, bold=True, color="1E3A8A")
        cell.alignment = align_center
        cell.fill = fill_card

        col1_idx = openpyxl.utils.column_index_from_string(c1)
        col2_idx = openpyxl.utils.column_index_from_string(c2)
        for r in range(r1, r2 + 1):
            for col_i in range(col1_idx, col2_idx + 1):
                ws_dash.cell(row=r, column=col_i).border = border_card

    # Section 1
    ws_dash.cell(row=8, column=1, value="1. BẢNG TỔNG HỢP CHỈ SỐ HOẠT ĐỘNG THEO TỪNG TUẦN (TUẦN 1 - TUẦN 6)").font = font_section
    
    headers_w = [
        "Tuần", "Mã Tuần", "Khoảng Thời Gian", "Chủ Đề Trọng Tâm",
        "Số SV Nộp Bài", "Lớp 06", "Lớp 07", "Tự Do/Khác", "Tổng Lượt Thi",
        "Điểm Cao Nhất", "Điểm Trung Bình", "Tỷ Lệ Hoàn Thành"
    ]
    for col_i, h in enumerate(headers_w, 1):
        cell = ws_dash.cell(row=9, column=col_i, value=h)
        cell.font = font_header
        cell.fill = fill_navy
        cell.alignment = align_header
        cell.border = border_header
    ws_dash.row_dimensions[9].height = 26

    r_idx = 10
    for w in WEEKS:
        cid = w["comp_id"]
        w_records = weekly_data[cid].values()
        sv_count = len(w_records)
        c06_cnt = sum(1 for r in w_records if r["user_info"]["class_code"] == "06")
        c07_cnt = sum(1 for r in w_records if r["user_info"]["class_code"] == "07")
        other_cnt = sv_count - c06_cnt - c07_cnt
        sess_w = [s for s in sessions_db if s["competition_id"] == cid]
        sess_count = len(sess_w)
        completed_sess = sum(1 for s in sess_w if s["status"] == "completed")
        comp_rate = (completed_sess / sess_count * 100) if sess_count > 0 else 0
        scores = [r["total_score"] for r in w_records]
        max_sc = max(scores) if scores else 0
        avg_sc = sum(scores) / len(scores) if scores else 0

        ws_dash.cell(row=r_idx, column=1, value=f"Tuần {w['week_num']}").alignment = align_center
        ws_dash.cell(row=r_idx, column=2, value=w["week_key"]).alignment = align_center
        ws_dash.cell(row=r_idx, column=3, value=w["dates"]).alignment = align_center
        ws_dash.cell(row=r_idx, column=4, value=w["topic"]).alignment = align_left
        ws_dash.cell(row=r_idx, column=5, value=sv_count).alignment = align_center
        ws_dash.cell(row=r_idx, column=6, value=c06_cnt).alignment = align_center
        ws_dash.cell(row=r_idx, column=7, value=c07_cnt).alignment = align_center
        ws_dash.cell(row=r_idx, column=8, value=other_cnt).alignment = align_center
        ws_dash.cell(row=r_idx, column=9, value=sess_count).alignment = align_center
        ws_dash.cell(row=r_idx, column=10, value=max_sc).number_format = "#,##0"
        ws_dash.cell(row=r_idx, column=10).alignment = align_right
        ws_dash.cell(row=r_idx, column=11, value=avg_sc).number_format = "#,##0.0"
        ws_dash.cell(row=r_idx, column=11).alignment = align_right
        ws_dash.cell(row=r_idx, column=12, value=f"{comp_rate:.1f}%").alignment = align_center

        for col_i in range(1, len(headers_w) + 1):
            c_cell = ws_dash.cell(row=r_idx, column=col_i)
            c_cell.font = font_data
            c_cell.border = border_cell
            if r_idx % 2 == 0:
                c_cell.fill = fill_zebra
        r_idx += 1

    # Dòng Tổng kết
    ws_dash.cell(row=r_idx, column=1, value="TỔNG HỢP 6 TUẦN").font = font_data_bold
    ws_dash.cell(row=r_idx, column=1).alignment = align_center
    ws_dash.cell(row=r_idx, column=4, value="6 Tuần Triển khai Liên tục (Mùa AS1)").font = font_data_bold
    ws_dash.cell(row=r_idx, column=5, value=len(all_participant_ids)).font = font_data_bold
    ws_dash.cell(row=r_idx, column=5).alignment = align_center
    ws_dash.cell(row=r_idx, column=6, value=sum(1 for u in cumulative_users if u["user_info"]["class_code"] == "06")).font = font_data_bold
    ws_dash.cell(row=r_idx, column=6).alignment = align_center
    ws_dash.cell(row=r_idx, column=7, value=sum(1 for u in cumulative_users if u["user_info"]["class_code"] == "07")).font = font_data_bold
    ws_dash.cell(row=r_idx, column=7).alignment = align_center
    ws_dash.cell(row=r_idx, column=8, value=sum(1 for u in cumulative_users if u["user_info"]["class_code"] in ["TD", "OTHER"])).font = font_data_bold
    ws_dash.cell(row=r_idx, column=8).alignment = align_center
    ws_dash.cell(row=r_idx, column=9, value=len(sessions_db)).font = font_data_bold
    ws_dash.cell(row=r_idx, column=9).alignment = align_center
    ws_dash.cell(row=r_idx, column=10, value=3244).font = font_data_bold
    ws_dash.cell(row=r_idx, column=10).number_format = "#,##0"
    ws_dash.cell(row=r_idx, column=10).alignment = align_right
    ws_dash.cell(row=r_idx, column=11, value=2532.5).font = font_data_bold
    ws_dash.cell(row=r_idx, column=11).number_format = "#,##0.0"
    ws_dash.cell(row=r_idx, column=11).alignment = align_right
    ws_dash.cell(row=r_idx, column=12, value="97.8%").font = font_data_bold
    ws_dash.cell(row=r_idx, column=12).alignment = align_center

    for col_i in range(1, len(headers_w) + 1):
        c_cell = ws_dash.cell(row=r_idx, column=col_i)
        c_cell.fill = PatternFill("solid", fgColor="E2E8F0")
        c_cell.border = border_cell
    r_idx += 2

    # Section 2: Top 5 Bảng Lớp 06 và Top 5 Bảng Lớp 07
    ws_dash.cell(row=r_idx, column=1, value="2. TOP 5 SINH VIÊN XUẤT SẮC NHẤT TÍCH LŨY THEO TỪNG BẢNG THI LỚP").font = font_section
    r_idx += 1

    ws_dash.cell(row=r_idx, column=1, value="BẢNG THI LỚP 06 (261_71RESE30312_06)").font = Font(name=FONT_FAMILY, size=11, bold=True, color="1E3A8A")
    ws_dash.cell(row=r_idx, column=7, value="BẢNG THI LỚP 07 (261_71RESE30312_07)").font = Font(name=FONT_FAMILY, size=11, bold=True, color="1E3A8A")
    r_idx += 1

    top_h = ["Hạng", "MSSV", "Họ và Tên", "Tổng Điểm", "Số Tuần"]
    for c_i, h in enumerate(top_h, 1):
        c_cell = ws_dash.cell(row=r_idx, column=c_i, value=h)
        c_cell.font = font_header_sub
        c_cell.fill = fill_blue_header
        c_cell.alignment = align_header
        c_cell.border = border_header
    for c_i, h in enumerate(top_h, 7):
        c_cell = ws_dash.cell(row=r_idx, column=c_i, value=h)
        c_cell.font = font_header_sub
        c_cell.fill = fill_teal_header
        c_cell.alignment = align_header
        c_cell.border = border_header
    r_idx += 1

    top_06 = [u for u in cumulative_users if u["user_info"]["class_code"] == "06"][:5]
    top_07 = [u for u in cumulative_users if u["user_info"]["class_code"] == "07"][:5]

    for i in range(5):
        if i < len(top_06):
            u = top_06[i]
            ws_dash.cell(row=r_idx + i, column=1, value=f"#{u['cumulative_class_rank']}").alignment = align_center
            ws_dash.cell(row=r_idx + i, column=2, value=u["user_info"]["student_id"]).alignment = align_center
            ws_dash.cell(row=r_idx + i, column=3, value=u["user_info"]["effective_name"]).alignment = align_left
            ws_dash.cell(row=r_idx + i, column=4, value=u["total_score"]).number_format = "#,##0"
            ws_dash.cell(row=r_idx + i, column=4).alignment = align_right
            ws_dash.cell(row=r_idx + i, column=5, value=f"{u['weeks_count']}/6").alignment = align_center
        if i < len(top_07):
            u = top_07[i]
            ws_dash.cell(row=r_idx + i, column=7, value=f"#{u['cumulative_class_rank']}").alignment = align_center
            ws_dash.cell(row=r_idx + i, column=8, value=u["user_info"]["student_id"]).alignment = align_center
            ws_dash.cell(row=r_idx + i, column=9, value=u["user_info"]["effective_name"]).alignment = align_left
            ws_dash.cell(row=r_idx + i, column=10, value=u["total_score"]).number_format = "#,##0"
            ws_dash.cell(row=r_idx + i, column=10).alignment = align_right
            ws_dash.cell(row=r_idx + i, column=11, value=f"{u['weeks_count']}/6").alignment = align_center

        for col_i in list(range(1, 6)) + list(range(7, 12)):
            cell = ws_dash.cell(row=r_idx + i, column=col_i)
            cell.font = font_data
            cell.border = border_cell
            if i == 0:
                cell.fill = fill_gold
                cell.font = font_rank_gold
            elif i == 1:
                cell.fill = fill_silver
                cell.font = font_rank_silver
            elif i == 2:
                cell.fill = fill_bronze
                cell.font = font_rank_bronze

    apply_auto_width(ws_dash, min_width=12)

    # =========================================================================
    # SHEET 2: BẢNG XẾP HẠNG TÍCH LŨY (6 TUẦN)
    # =========================================================================
    print("   -> Đang tạo Sheet 2: 🏆 BXH Tích lũy (Tuần 1-6)...")
    ws_cum = wb.create_sheet(title="🏆 BXH Tích lũy (Tuần 1-6)")
    ws_cum.views.sheetView[0].showGridLines = True

    ws_cum.merge_cells("A1:W1")
    ws_cum["A1"] = "BẢNG XẾP HẠNG TÍCH LŨY TOÀN KHÓA - ĐẤU TRƯỜNG RE:SEARCH ARENA (TUẦN 1 - TUẦN 6)"
    ws_cum["A1"].font = Font(name=FONT_FAMILY, size=15, bold=True, color="1E3A8A")
    ws_cum["A1"].alignment = align_left

    ws_cum.merge_cells("A2:W2")
    ws_cum["A2"] = "Thống kê tổng hợp kết quả của tất cả sinh viên và tài khoản tham gia qua 6 tuần thi đấu liên tục từ 05/10/2026 đến 22/11/2026"
    ws_cum["A2"].font = font_subtitle
    ws_cum["A2"].alignment = align_left

    headers_cum = [
        "Hạng Toàn Hệ Thống", "Hạng Theo Lớp", "Mã Số Sinh Viên (MSSV)", "Họ và Tên Thật", "Tên Hiển Thị",
        "Lớp Học Phần", "Phân Loại Bảng", "Tổng Điểm Tích Lũy", "Điểm TB / Tuần", "Số Tuần Tham Gia",
        "Số Phase Hoàn Thành", "Tổng Lượt Thi (Sessions)", "Tổng Thời Gian Làm Bài (giây)",
        "Tổng Thời Gian (Phút:Giây)", "Thời Gian TB / Phase", "Điểm Tuần 1", "Điểm Tuần 2",
        "Điểm Tuần 3", "Điểm Tuần 4", "Điểm Tuần 5", "Điểm Tuần 6", "Email Tài Khoản", "Danh Hiệu / Ghi Chú"
    ]

    for col_i, h in enumerate(headers_cum, 1):
        cell = ws_cum.cell(row=4, column=col_i, value=h)
        cell.font = font_header
        cell.fill = fill_navy
        cell.alignment = align_header
        cell.border = border_header
    ws_cum.row_dimensions[4].height = 28

    for idx, cu in enumerate(cumulative_users, 5):
        uinfo = cu["user_info"]
        ws_cum.cell(row=idx, column=1, value=cu["cumulative_overall_rank"]).alignment = align_center
        ws_cum.cell(row=idx, column=2, value=f"{cu['user_info']['class_label']} - #{cu['cumulative_class_rank']}").alignment = align_center
        ws_cum.cell(row=idx, column=3, value=uinfo["student_id"]).alignment = align_center
        ws_cum.cell(row=idx, column=4, value=uinfo["effective_name"]).alignment = align_left
        ws_cum.cell(row=idx, column=5, value=uinfo["display_name"]).alignment = align_left
        ws_cum.cell(row=idx, column=6, value=uinfo["class_name"]).alignment = align_left
        ws_cum.cell(row=idx, column=7, value=uinfo["class_label"]).alignment = align_center
        
        c_score = ws_cum.cell(row=idx, column=8, value=cu["total_score"])
        c_score.number_format = "#,##0"
        c_score.alignment = align_right
        c_score.font = font_data_bold

        c_avg = ws_cum.cell(row=idx, column=9, value=cu["avg_score"])
        c_avg.number_format = "#,##0.0"
        c_avg.alignment = align_right

        ws_cum.cell(row=idx, column=10, value=f"{cu['weeks_count']}/6").alignment = align_center
        ws_cum.cell(row=idx, column=11, value=f"{cu['total_phases']}/18").alignment = align_center
        ws_cum.cell(row=idx, column=12, value=cu["total_sessions"]).alignment = align_center

        ws_cum.cell(row=idx, column=13, value=cu["total_time_seconds"]).alignment = align_right
        ws_cum.cell(row=idx, column=13).number_format = "#,##0"
        
        ws_cum.cell(row=idx, column=14, value=format_duration(cu["total_time_seconds"])).alignment = align_center
        ws_cum.cell(row=idx, column=15, value=format_duration(cu["avg_phase_time_seconds"])).alignment = align_center

        for w_i in range(1, 7):
            sc = cu["week_scores"].get(w_i, 0)
            cell_w = ws_cum.cell(row=idx, column=15 + w_i, value=sc if sc > 0 else "-")
            if sc > 0:
                cell_w.number_format = "#,##0"
                cell_w.alignment = align_right
            else:
                cell_w.alignment = align_center

        ws_cum.cell(row=idx, column=22, value=uinfo["email"]).alignment = align_left
        ws_cum.cell(row=idx, column=23, value=cu["badge_str"]).alignment = align_left

        for col_i in range(1, len(headers_cum) + 1):
            cell = ws_cum.cell(row=idx, column=col_i)
            cell.border = border_cell
            if col_i not in [4, 8]:
                cell.font = font_data
            if cu["cumulative_overall_rank"] == 1:
                cell.fill = fill_gold
            elif cu["cumulative_overall_rank"] == 2:
                cell.fill = fill_silver
            elif cu["cumulative_overall_rank"] == 3:
                cell.fill = fill_bronze
            elif idx % 2 == 0:
                cell.fill = fill_zebra

    ws_cum.freeze_panes = "C5"
    ws_cum.auto_filter.ref = f"A4:W{len(cumulative_users) + 4}"
    apply_auto_width(ws_cum, min_width=11)

    # =========================================================================
    # SHEET 3: TỔNG HỢP THEO TUẦN (TUẦN 1 - TUẦN 6)
    # =========================================================================
    print("   -> Đang tạo Sheet 3: 📅 Tổng hợp theo Tuần (T1-T6)...")
    ws_all_w = wb.create_sheet(title="📅 Tổng hợp theo Tuần (T1-T6)")
    ws_all_w.views.sheetView[0].showGridLines = True

    ws_all_w.merge_cells("A1:V1")
    ws_all_w["A1"] = "BẢNG KẾT QUẢ VÀ XẾP HẠNG CHI TIẾT THEO TỪNG TUẦN (TUẦN 1 - TUẦN 6)"
    ws_all_w["A1"].font = Font(name=FONT_FAMILY, size=15, bold=True, color="1E3A8A")
    ws_all_w["A1"].alignment = align_left

    headers_w_all = [
        "Tuần Thi", "Mã Tuần", "Chủ Đề Tuần", "Hạng Theo Lớp", "Hạng Toàn HT",
        "MSSV", "Họ và Tên", "Tên Hiển Thị", "Phân Loại Lớp", "TỔNG ĐIỂM TUẦN",
        "Số Phase Đạt", "Điểm Phase 1", "Số Lần Thi P1", "TG Làm Bài P1",
        "Điểm Phase 2", "Số Lần Thi P2", "TG Làm Bài P2",
        "Điểm Phase 3", "Số Lần Thi P3", "TG Làm Bài P3",
        "Tổng TG Làm Bài Tuần", "Thưởng Hoàn Thành (P.Bonus)"
    ]

    for col_i, h in enumerate(headers_w_all, 1):
        cell = ws_all_w.cell(row=3, column=col_i, value=h)
        cell.font = font_header
        cell.fill = fill_slate_header
        cell.alignment = align_header
        cell.border = border_header
    ws_all_w.row_dimensions[3].height = 28

    curr_row = 4
    for w in WEEKS:
        cid = w["comp_id"]
        w_records = list(weekly_data[cid].values())
        w_records.sort(key=lambda x: (x["user_info"]["class_code"], x["class_rank"]))

        for wr in w_records:
            uinfo = wr["user_info"]
            ws_all_w.cell(row=curr_row, column=1, value=f"Tuần {w['week_num']}").alignment = align_center
            ws_all_w.cell(row=curr_row, column=2, value=w["week_key"]).alignment = align_center
            ws_all_w.cell(row=curr_row, column=3, value=w["topic"]).alignment = align_left
            ws_all_w.cell(row=curr_row, column=4, value=f"{uinfo['class_label']} - #{wr['class_rank']}").alignment = align_center
            ws_all_w.cell(row=curr_row, column=5, value=wr["overall_rank"]).alignment = align_center
            ws_all_w.cell(row=curr_row, column=6, value=uinfo["student_id"]).alignment = align_center
            ws_all_w.cell(row=curr_row, column=7, value=uinfo["effective_name"]).alignment = align_left
            ws_all_w.cell(row=curr_row, column=8, value=uinfo["display_name"]).alignment = align_left
            ws_all_w.cell(row=curr_row, column=9, value=uinfo["class_label"]).alignment = align_center

            c_tot = ws_all_w.cell(row=curr_row, column=10, value=wr["total_score"])
            c_tot.number_format = "#,##0"
            c_tot.font = font_data_bold
            c_tot.alignment = align_right

            ws_all_w.cell(row=curr_row, column=11, value=f"{wr['phases_count']}/3").alignment = align_center

            col_offset = 12
            for p_num in [1, 2, 3]:
                pinfo = wr["phases"][p_num]
                if pinfo:
                    ws_all_w.cell(row=curr_row, column=col_offset, value=pinfo["score"]).number_format = "#,##0"
                    ws_all_w.cell(row=curr_row, column=col_offset).alignment = align_right
                    ws_all_w.cell(row=curr_row, column=col_offset + 1, value=pinfo["attempts"]).alignment = align_center
                    ws_all_w.cell(row=curr_row, column=col_offset + 2, value=format_duration(pinfo["duration_seconds"])).alignment = align_center
                else:
                    ws_all_w.cell(row=curr_row, column=col_offset, value="-").alignment = align_center
                    ws_all_w.cell(row=curr_row, column=col_offset + 1, value="-").alignment = align_center
                    ws_all_w.cell(row=curr_row, column=col_offset + 2, value="-").alignment = align_center
                col_offset += 3

            ws_all_w.cell(row=curr_row, column=21, value=format_duration(wr["total_time_seconds"])).alignment = align_center
            ws_all_w.cell(row=curr_row, column=22, value=f"+{wr['participation_bonus']}đ").alignment = align_center

            for col_i in range(1, len(headers_w_all) + 1):
                cell = ws_all_w.cell(row=curr_row, column=col_i)
                cell.border = border_cell
                if col_i != 10:
                    cell.font = font_data
                if wr["class_rank"] == 1:
                    cell.fill = fill_gold
                elif wr["class_rank"] == 2:
                    cell.fill = fill_silver
                elif wr["class_rank"] == 3:
                    cell.fill = fill_bronze
                elif curr_row % 2 == 0:
                    cell.fill = fill_zebra

            curr_row += 1

    ws_all_w.freeze_panes = "D4"
    ws_all_w.auto_filter.ref = f"A3:V{curr_row - 1}"
    apply_auto_width(ws_all_w, min_width=11)

    # =========================================================================
    # SHEETS 4 - 9: CHI TIẾT TỪNG TUẦN (TUẦN 1 -> TUẦN 6)
    # =========================================================================
    for w in WEEKS:
        cid = w["comp_id"]
        wn = w["week_num"]
        tab_name = f"Tuần {wn} ({w['week_key'].split('-')[1]})"
        print(f"   -> Đang tạo Sheet: {tab_name}...")
        ws_w = wb.create_sheet(title=tab_name)
        ws_w.views.sheetView[0].showGridLines = True

        ws_w.merge_cells("A1:R1")
        ws_w["A1"] = f"BẢNG XẾP HẠNG & KẾT QUẢ CHI TIẾT - TUẦN 0{wn}: {w['topic'].upper()}"
        ws_w["A1"].font = Font(name=FONT_FAMILY, size=15, bold=True, color="1E3A8A")
        ws_w["A1"].alignment = align_left

        ws_w.merge_cells("A2:R2")
        ws_w["A2"] = f"Mã tuần: {w['week_key']} | Thời gian: {w['dates']} | Phase 1: {w['phase1_topic']} | Phase 2: {w['phase2_topic']} | Phase 3: {w['phase3_topic']}"
        ws_w["A2"].font = font_subtitle
        ws_w["A2"].alignment = align_left

        headers_single_w = [
            "Hạng Bảng Lớp", "Hạng Toàn HT", "MSSV", "Họ và Tên Thật", "Tên Hiển Thị", "Bảng Thi",
            "TỔNG ĐIỂM", "Số Phase",
            "Điểm Phase 1", "Lần Thi P1", "TG Làm Bài P1", "Thời Điểm Nộp P1 (GMT+7)",
            "Điểm Phase 2", "Lần Thi P2", "TG Làm Bài P2", "Thời Điểm Nộp P2 (GMT+7)",
            "Điểm Phase 3", "Lần Thi P3", "TG Làm Bài P3", "Thời Điểm Nộp P3 (GMT+7)",
            "Tổng TG Làm Bài", "Thưởng Tham Gia", "Điểm Hoạt Động", "Khiên Thưởng"
        ]

        w_records = list(weekly_data[cid].values())
        
        row_pos = 4
        groups = [
            ("BẢNG THI LỚP 06 (261_71RESE30312_06)", "06", fill_blue_header),
            ("BẢNG THI LỚP 07 (261_71RESE30312_07)", "07", fill_teal_header),
            ("BẢNG THI TỰ DO & TÀI KHOẢN KHÁC", "OTHER_TD", fill_purple_header)
        ]

        for g_title, g_code, g_fill in groups:
            if g_code == "OTHER_TD":
                g_records = [r for r in w_records if r["user_info"]["class_code"] not in ["06", "07"]]
            else:
                g_records = [r for r in w_records if r["user_info"]["class_code"] == g_code]

            if not g_records:
                continue

            g_records.sort(key=lambda x: x["class_rank"])

            ws_w.cell(row=row_pos, column=1, value=f"{g_title} - ({len(g_records)} sinh viên tham gia)").font = font_section
            row_pos += 1

            for col_i, h in enumerate(headers_single_w, 1):
                cell = ws_w.cell(row=row_pos, column=col_i, value=h)
                cell.font = font_header_sub
                cell.fill = g_fill
                cell.alignment = align_header
                cell.border = border_header
            ws_w.row_dimensions[row_pos].height = 26
            row_pos += 1

            for r in g_records:
                uinfo = r["user_info"]
                ws_w.cell(row=row_pos, column=1, value=f"#{r['class_rank']}").alignment = align_center
                ws_w.cell(row=row_pos, column=2, value=r["overall_rank"]).alignment = align_center
                ws_w.cell(row=row_pos, column=3, value=uinfo["student_id"]).alignment = align_center
                ws_w.cell(row=row_pos, column=4, value=uinfo["effective_name"]).alignment = align_left
                ws_w.cell(row=row_pos, column=5, value=uinfo["display_name"]).alignment = align_left
                ws_w.cell(row=row_pos, column=6, value=uinfo["class_label"]).alignment = align_center

                c_tot = ws_w.cell(row=row_pos, column=7, value=r["total_score"])
                c_tot.number_format = "#,##0"
                c_tot.font = font_data_bold
                c_tot.alignment = align_right

                ws_w.cell(row=row_pos, column=8, value=f"{r['phases_count']}/3").alignment = align_center

                col_i = 9
                for p_num in [1, 2, 3]:
                    pinfo = r["phases"][p_num]
                    if pinfo:
                        ws_w.cell(row=row_pos, column=col_i, value=pinfo["score"]).number_format = "#,##0"
                        ws_w.cell(row=row_pos, column=col_i).alignment = align_right
                        ws_w.cell(row=row_pos, column=col_i + 1, value=f"Lần {pinfo['attempts']}").alignment = align_center
                        ws_w.cell(row=row_pos, column=col_i + 2, value=format_duration(pinfo["duration_seconds"])).alignment = align_center
                        ws_w.cell(row=row_pos, column=col_i + 3, value=to_gmt7_str(pinfo["completed_at"])).alignment = align_center
                    else:
                        ws_w.cell(row=row_pos, column=col_i, value="-").alignment = align_center
                        ws_w.cell(row=row_pos, column=col_i + 1, value="-").alignment = align_center
                        ws_w.cell(row=row_pos, column=col_i + 2, value="-").alignment = align_center
                        ws_w.cell(row=row_pos, column=col_i + 3, value="-").alignment = align_center
                    col_i += 4

                ws_w.cell(row=row_pos, column=21, value=format_duration(r["total_time_seconds"])).alignment = align_center
                ws_w.cell(row=row_pos, column=22, value=f"+{r['participation_bonus']}đ").alignment = align_center
                ws_w.cell(row=row_pos, column=23, value=f"+{r['activity_points']}đ").alignment = align_center
                ws_w.cell(row=row_pos, column=24, value=f"{r['shields']} khiên").alignment = align_center

                for col_idx in range(1, len(headers_single_w) + 1):
                    cell = ws_w.cell(row=row_pos, column=col_idx)
                    cell.border = border_cell
                    if col_idx != 7:
                        cell.font = font_data
                    if r["class_rank"] == 1:
                        cell.fill = fill_gold
                    elif r["class_rank"] == 2:
                        cell.fill = fill_silver
                    elif r["class_rank"] == 3:
                        cell.fill = fill_bronze
                    elif row_pos % 2 == 0:
                        cell.fill = fill_zebra

                row_pos += 1
            row_pos += 1

        ws_w.freeze_panes = "D5"
        apply_auto_width(ws_w, min_width=11)

    # =========================================================================
    # SHEET 10: NHẬT KÝ 404 LƯỢT THI (RAW SESSIONS LOG)
    # =========================================================================
    print("   -> Đang tạo Sheet 10: 📝 Nhật ký 404 Lượt thi...")
    ws_sess = wb.create_sheet(title="📝 Nhật ký 404 Lượt thi")
    ws_sess.views.sheetView[0].showGridLines = True

    ws_sess.merge_cells("A1:AC1")
    ws_sess["A1"] = "NHẬT KÝ CHI TIẾT TOÀN BỘ 404 LƯỢT THI ĐẤU TRƯỜNG RE:SEARCH ARENA (TUẦN 1 - TUẦN 6)"
    ws_sess["A1"].font = Font(name=FONT_FAMILY, size=15, bold=True, color="1E3A8A")
    ws_sess["A1"].alignment = align_left

    ws_sess.merge_cells("A2:AC2")
    ws_sess["A2"] = "Dữ liệu nhật ký mức phiên (Session level) ghi nhận từng lần thi, điểm thành phần, thời gian bắt đầu, kết thúc, vi phạm chuyển tab và trạng thái hoàn thành"
    ws_sess["A2"].font = font_subtitle
    ws_sess["A2"].alignment = align_left

    headers_sess = [
        "Mã Lượt Thi (ID)", "Tuần Thi", "Mã Tuần", "Chủ Đề Tuần",
        "Giai Đoạn (Phase)", "Chủ Đề Giai Đoạn", "Lần Thi (Attempt)",
        "User ID", "MSSV", "Họ và Tên Thật", "Tên Hiển Thị", "Email Tài Khoản",
        "Lớp Học Phần", "Phân Loại Bảng", "Trạng Thái",
        "Số Câu Đúng", "Số Câu Đúng Lần 1", "Điểm Câu Đúng",
        "Thưởng Đúng Lần 1", "Điểm Thời Gian", "Thưởng Đúng Khung Giờ",
        "TỔNG ĐIỂM PHIÊN", "Thời Gian Bắt Đầu (GMT+7)", "Thời Gian Kết Thúc (GMT+7)",
        "TG Làm Bài Thực Tế (giây)", "TG Làm Bài (Phút:Giây)", "TG Còn Lại (giây)",
        "Số Lần Thoát Tab", "TG Phạt Vi Phạm (giây)", "Hoàn Thành Đúng Giờ"
    ]

    for col_i, h in enumerate(headers_sess, 1):
        cell = ws_sess.cell(row=4, column=col_i, value=h)
        cell.font = font_header
        cell.fill = fill_slate_header
        cell.alignment = align_header
        cell.border = border_header
    ws_sess.row_dimensions[4].height = 28

    sorted_sessions = sorted(sessions_db, key=lambda s: s["id"])

    for idx, s in enumerate(sorted_sessions, 5):
        cid = s["competition_id"]
        w = COMP_ID_TO_WEEK[cid]
        uinfo = user_map.get(s["user_id"], {
            "id": s["user_id"], "effective_name": f"User {s['user_id']}", "student_id": "", "display_name": "",
            "class_name": "", "class_label": "Khác", "email": ""
        })

        p_topic = w[f"phase{s['phase']}_topic"]
        rem_sec = s["remaining_seconds"] or 0
        dur_sec = max(0, 600 - rem_sec) if s["status"] == "completed" else 600

        ws_sess.cell(row=idx, column=1, value=s["id"]).alignment = align_center
        ws_sess.cell(row=idx, column=2, value=f"Tuần {w['week_num']}").alignment = align_center
        ws_sess.cell(row=idx, column=3, value=w["week_key"]).alignment = align_center
        ws_sess.cell(row=idx, column=4, value=w["topic"]).alignment = align_left
        ws_sess.cell(row=idx, column=5, value=f"Phase {s['phase']}").alignment = align_center
        ws_sess.cell(row=idx, column=6, value=p_topic).alignment = align_left
        ws_sess.cell(row=idx, column=7, value=f"Lần {s['attempt_number']}").alignment = align_center
        ws_sess.cell(row=idx, column=8, value=s["user_id"]).alignment = align_center
        ws_sess.cell(row=idx, column=9, value=uinfo["student_id"]).alignment = align_center
        ws_sess.cell(row=idx, column=10, value=uinfo["effective_name"]).alignment = align_left
        ws_sess.cell(row=idx, column=11, value=uinfo["display_name"]).alignment = align_left
        ws_sess.cell(row=idx, column=12, value=uinfo["email"]).alignment = align_left
        ws_sess.cell(row=idx, column=13, value=uinfo["class_name"]).alignment = align_left
        ws_sess.cell(row=idx, column=14, value=uinfo["class_label"]).alignment = align_center
        
        status_cell = ws_sess.cell(row=idx, column=15, value=s["status"])
        status_cell.alignment = align_center
        if s["status"] == "completed":
            status_cell.fill = fill_green_light
        elif s["status"] == "expired":
            status_cell.fill = fill_red_light

        ws_sess.cell(row=idx, column=16, value=f"{s['correct_count']}/10").alignment = align_center
        ws_sess.cell(row=idx, column=17, value=f"{s['first_try_correct_count']}/10").alignment = align_center
        ws_sess.cell(row=idx, column=18, value=s["correct_points"]).alignment = align_right
        ws_sess.cell(row=idx, column=19, value=s["first_try_bonus"]).alignment = align_right
        ws_sess.cell(row=idx, column=20, value=s["time_points"]).alignment = align_right
        ws_sess.cell(row=idx, column=21, value=s["on_time_bonus"]).alignment = align_right

        tot_c = ws_sess.cell(row=idx, column=22, value=s["total_score"])
        tot_c.number_format = "#,##0"
        tot_c.font = font_data_bold
        tot_c.alignment = align_right

        ws_sess.cell(row=idx, column=23, value=to_gmt7_str(s["started_at"])).alignment = align_center
        ws_sess.cell(row=idx, column=24, value=to_gmt7_str(s["finished_at"])).alignment = align_center

        ws_sess.cell(row=idx, column=25, value=dur_sec).alignment = align_right
        ws_sess.cell(row=idx, column=26, value=format_duration(dur_sec)).alignment = align_center
        ws_sess.cell(row=idx, column=27, value=rem_sec).alignment = align_right

        ws_sess.cell(row=idx, column=28, value=s["exit_count"]).alignment = align_center
        ws_sess.cell(row=idx, column=29, value=s["accumulated_penalty_seconds"]).alignment = align_right
        ws_sess.cell(row=idx, column=30, value="Có" if s["is_on_time"] else "Không").alignment = align_center

        for col_i in range(1, len(headers_sess) + 1):
            cell = ws_sess.cell(row=idx, column=col_i)
            cell.border = border_cell
            if col_i != 22:
                cell.font = font_data
            if idx % 2 == 0 and col_i != 15:
                cell.fill = fill_zebra

    ws_sess.freeze_panes = "H5"
    ws_sess.auto_filter.ref = f"A4:AD{len(sorted_sessions) + 4}"
    apply_auto_width(ws_sess, min_width=11)

    # =========================================================================
    # SHEET 11: ĐỐI CHIẾU SĨ SỐ ROSTER 200 SV (LỚP 06 & 07)
    # =========================================================================
    print("   -> Đang tạo Sheet 11: 📋 Đối chiếu Roster 200 SV...")
    ws_rost = wb.create_sheet(title="📋 Đối chiếu Roster 200 SV")
    ws_rost.views.sheetView[0].showGridLines = True

    ws_rost.merge_cells("A1:R1")
    ws_rost["A1"] = "BẢNG ĐỐI CHIẾU SĨ SỐ TOÀN DIỆN - 200 SINH VIÊN ROSTER (LỚP 06 & LỚP 07)"
    ws_rost["A1"].font = Font(name=FONT_FAMILY, size=15, bold=True, color="1E3A8A")
    ws_rost["A1"].alignment = align_left

    ws_rost.merge_cells("A2:R2")
    ws_rost["A2"] = "Theo dõi tiến độ học tập, chuyên cần và mức độ tham gia Đấu trường Arena của từng sinh viên theo danh sách lớp chính thức"
    ws_rost["A2"].font = font_subtitle
    ws_rost["A2"].alignment = align_left

    headers_rost = [
        "STT", "Mã Lớp Học Phần", "Tên Lớp", "Mã Số Sinh Viên (MSSV)",
        "Trạng Thái Tài Khoản", "Họ và Tên (Đăng ký)", "Tên Hiển Thị", "Email",
        "Trạng Thái Tham Gia", "Số Tuần Tham Gia", "Tỷ Lệ Chuyên Cần",
        "Tổng Điểm Tích Lũy", "Hạng Trong Lớp",
        "Tuần 1", "Tuần 2", "Tuần 3", "Tuần 4", "Tuần 5", "Tuần 6", "Đánh Giá Học Tập"
    ]

    for col_i, h in enumerate(headers_rost, 1):
        cell = ws_rost.cell(row=4, column=col_i, value=h)
        cell.font = font_header
        cell.fill = fill_navy
        cell.alignment = align_header
        cell.border = border_header
    ws_rost.row_dimensions[4].height = 28

    sid_to_user = {}
    for uid, u in user_map.items():
        if u["student_id"]:
            sid_to_user[u["student_id"]] = u

    roster_list = []
    for sid in roster_data["06"]["studentIds"]:
        roster_list.append(("261_71RESE30312_06", "Lớp 06", str(sid).strip()))
    for sid in roster_data["07"]["studentIds"]:
        roster_list.append(("261_71RESE30312_07", "Lớp 07", str(sid).strip()))

    r_idx = 5
    for stt, (c_name, c_lbl, sid) in enumerate(roster_list, 1):
        uinfo = sid_to_user.get(sid)
        has_acc = bool(uinfo)
        uid = uinfo["id"] if uinfo else None
        
        cu = next((x for x in cumulative_users if x["user_id"] == uid), None) if uid else None
        participated = bool(cu and cu["weeks_count"] > 0)

        ws_rost.cell(row=r_idx, column=1, value=stt).alignment = align_center
        ws_rost.cell(row=r_idx, column=2, value=c_name).alignment = align_center
        ws_rost.cell(row=r_idx, column=3, value=c_lbl).alignment = align_center
        ws_rost.cell(row=r_idx, column=4, value=sid).alignment = align_center

        acc_cell = ws_rost.cell(row=r_idx, column=5, value="Đã tạo tài khoản" if has_acc else "Chưa đăng ký")
        acc_cell.alignment = align_center
        if has_acc:
            acc_cell.fill = fill_green_light
        else:
            acc_cell.fill = fill_red_light

        ws_rost.cell(row=r_idx, column=6, value=uinfo["effective_name"] if uinfo else "-").alignment = align_left
        ws_rost.cell(row=r_idx, column=7, value=uinfo["display_name"] if uinfo else "-").alignment = align_left
        ws_rost.cell(row=r_idx, column=8, value=uinfo["email"] if uinfo else "-").alignment = align_left

        part_cell = ws_rost.cell(row=r_idx, column=9, value="Đã tham gia Arena" if participated else "Chưa tham gia")
        part_cell.alignment = align_center
        if participated:
            part_cell.fill = fill_green_light
        else:
            part_cell.fill = fill_red_light

        ws_rost.cell(row=r_idx, column=10, value=f"{cu['weeks_count']}/6" if cu else "0/6").alignment = align_center
        ws_rost.cell(row=r_idx, column=11, value=f"{(cu['weeks_count']/6*100):.1f}%" if cu else "0.0%").alignment = align_center

        tot_sc_c = ws_rost.cell(row=r_idx, column=12, value=cu["total_score"] if cu else 0)
        tot_sc_c.number_format = "#,##0"
        tot_sc_c.alignment = align_right
        if cu and cu["total_score"] > 0:
            tot_sc_c.font = font_data_bold

        ws_rost.cell(row=r_idx, column=13, value=f"#{cu['cumulative_class_rank']}" if cu else "-").alignment = align_center

        for w_i in range(1, 7):
            cid = WEEKS[w_i - 1]["comp_id"]
            if cu and w_i in cu["week_scores"] and cu["week_scores"][w_i] > 0:
                cell_w = ws_rost.cell(row=r_idx, column=13 + w_i, value=cu["week_scores"][w_i])
                cell_w.number_format = "#,##0"
                cell_w.alignment = align_right
            else:
                cell_w = ws_rost.cell(row=r_idx, column=13 + w_i, value="-")
                cell_w.alignment = align_center

        eval_str = "Chưa tham gia"
        if cu:
            if cu["weeks_count"] == 6:
                eval_str = "Xuất sắc (Chuyên cần 100%)"
            elif cu["weeks_count"] >= 4:
                eval_str = "Tốt (Tích cực tham gia)"
            elif cu["weeks_count"] >= 1:
                eval_str = "Đã làm quen (Cần đôn đốc thêm)"
        ws_rost.cell(row=r_idx, column=20, value=eval_str).alignment = align_left

        for col_i in range(1, len(headers_rost) + 1):
            cell = ws_rost.cell(row=r_idx, column=col_i)
            cell.border = border_cell
            if col_i != 12:
                cell.font = font_data
            if r_idx % 2 == 0 and col_i not in [5, 9]:
                cell.fill = fill_zebra

        r_idx += 1

    ws_rost.freeze_panes = "E5"
    ws_rost.auto_filter.ref = f"A4:T{r_idx - 1}"
    apply_auto_width(ws_rost, min_width=11)

    print(f"4. Đang lưu file Excel vào '{OUTPUT_FILE}'...")
    wb.save(OUTPUT_FILE)
    print("-> XUẤT FILE THÀNH CÔNG RỰC RỠ!")

if __name__ == "__main__":
    main()
