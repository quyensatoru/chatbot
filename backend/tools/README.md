# 📋 Yêu Cầu Hệ Thống: Personal Assistant Automation Agent

> **Mục tiêu:** Xây dựng và cập nhật bộ công cụ (tools) cho một AI Agent có khả năng thực hiện các tác vụ hàng ngày như một người trợ lý cá nhân thực thụ.

---

## 1. Tổng Quan Hệ Thống

**Agent Type:** Autonomous Personal Assistant  
**Architecture:** Tool-calling LLM Agent (ReAct / Function Calling)  
**Ngôn ngữ khuyến nghị:** Python 3.11+  
**Framework gợi ý:** LangChain / LangGraph / AutoGen / CrewAI

---

## 2. Danh Sách Tools Cần Triển Khai

### 🗓️ 2.1 Quản Lý Lịch & Thời Gian

| Tool                    | Mô tả                                                           | Tích hợp                   |
| ----------------------- | --------------------------------------------------------------- | -------------------------- |
| `get_calendar_events`   | Lấy danh sách sự kiện theo ngày/tuần/tháng                      | Google Calendar / Outlook  |
| `create_calendar_event` | Tạo sự kiện mới với tiêu đề, thời gian, địa điểm, người tham dự | Google Calendar / Outlook  |
| `update_calendar_event` | Chỉnh sửa sự kiện hiện có                                       | Google Calendar / Outlook  |
| `delete_calendar_event` | Xóa hoặc hủy sự kiện                                            | Google Calendar / Outlook  |
| `set_reminder`          | Đặt nhắc nhở theo thời gian hoặc địa điểm                       | Google Calendar / Telegram |
| `check_availability`    | Kiểm tra lịch trống của bản thân hoặc người khác                | Google Calendar            |

---

### 📧 2.2 Quản Lý Email

| Tool                     | Mô tả                                                      | Tích hợp        |
| ------------------------ | ---------------------------------------------------------- | --------------- |
| `read_emails`            | Đọc email mới nhất, lọc theo người gửi / nhãn / từ khóa    | Gmail / Outlook |
| `send_email`             | Soạn và gửi email với tiêu đề, nội dung, CC, BCC, đính kèm | Gmail / Outlook |
| `reply_email`            | Trả lời email theo thread                                  | Gmail / Outlook |
| `search_emails`          | Tìm kiếm email theo nội dung, người gửi, khoảng thời gian  | Gmail / Outlook |
| `label_email`            | Gắn nhãn / phân loại email                                 | Gmail           |
| `draft_email`            | Lưu bản nháp email                                         | Gmail / Outlook |
| `summarize_email_thread` | Tóm tắt chuỗi email dài                                    | Gmail / Outlook |

---

### ✅ 2.3 Quản Lý Công Việc & Ghi Chú

| Tool             | Mô tả                                       | Tích hợp                  |
| ---------------- | ------------------------------------------- | ------------------------- |
| `create_task`    | Tạo task mới với deadline, priority, tags   | Notion / Todoist / Trello |
| `list_tasks`     | Liệt kê task theo trạng thái, deadline, tag | Notion / Todoist          |
| `update_task`    | Cập nhật trạng thái hoặc thông tin task     | Notion / Todoist          |
| `delete_task`    | Xóa task đã hoàn thành hoặc không cần thiết | Notion / Todoist          |
| `create_note`    | Tạo ghi chú nhanh                           | Notion / Obsidian         |
| `search_notes`   | Tìm kiếm ghi chú theo từ khóa               | Notion / Obsidian         |
| `append_to_note` | Thêm nội dung vào ghi chú hiện có           | Notion                    |

---

### 💬 2.4 Nhắn Tin & Giao Tiếp

| Tool                | Mô tả                                        | Tích hợp                |
| ------------------- | -------------------------------------------- | ----------------------- |
| `send_message`      | Gửi tin nhắn đến một người hoặc nhóm         | Telegram / Slack / Zalo |
| `read_messages`     | Đọc tin nhắn chưa xem                        | Telegram / Slack        |
| `send_notification` | Gửi thông báo đến thiết bị                   | Telegram Bot / Pushover |
| `schedule_message`  | Lên lịch gửi tin nhắn vào thời điểm chỉ định | Telegram / Slack        |

---

### 🔍 2.5 Tìm Kiếm & Thu Thập Thông Tin

| Tool            | Mô tả                                      | Tích hợp                            |
| --------------- | ------------------------------------------ | ----------------------------------- |
| `web_search`    | Tìm kiếm thông tin trên internet           | Google Search API / Serper / Tavily |
| `fetch_webpage` | Lấy và trích xuất nội dung từ URL          | BeautifulSoup / Playwright          |
| `summarize_url` | Tóm tắt nội dung trang web hoặc bài báo    | LLM + web fetch                     |
| `search_news`   | Tìm kiếm tin tức mới nhất theo chủ đề      | NewsAPI / Google News               |
| `get_weather`   | Lấy thông tin thời tiết hiện tại và dự báo | OpenWeatherMap API                  |
| `search_maps`   | Tìm kiếm địa điểm, đường đi                | Google Maps API                     |

---

### 📁 2.6 Quản Lý File & Tài Liệu

| Tool                 | Mô tả                                         | Tích hợp                  |
| -------------------- | --------------------------------------------- | ------------------------- |
| `list_files`         | Liệt kê file trong thư mục hoặc cloud drive   | Google Drive / Local      |
| `upload_file`        | Tải file lên cloud                            | Google Drive / Dropbox    |
| `download_file`      | Tải file xuống từ cloud                       | Google Drive / Dropbox    |
| `create_document`    | Tạo tài liệu mới (Word, PDF, Markdown)        | Google Docs / python-docx |
| `read_document`      | Đọc và trích xuất nội dung từ PDF, DOCX, XLSX | pdfplumber / python-docx  |
| `summarize_document` | Tóm tắt nội dung tài liệu                     | LLM + document reader     |
| `search_drive`       | Tìm kiếm file theo tên hoặc nội dung          | Google Drive API          |

---

### 🖥️ 2.7 Điều Khiển Máy Tính (Desktop Automation)

| Tool                | Mô tả                                       | Tích hợp               |
| ------------------- | ------------------------------------------- | ---------------------- |
| `take_screenshot`   | Chụp màn hình toàn bộ hoặc cửa sổ cụ thể    | pyautogui / mss        |
| `click_element`     | Click vào vị trí hoặc element trên màn hình | pyautogui / Playwright |
| `type_text`         | Gõ văn bản vào ô input                      | pyautogui              |
| `open_application`  | Mở ứng dụng theo tên                        | subprocess             |
| `run_command`       | Chạy lệnh terminal / shell                  | subprocess             |
| `copy_to_clipboard` | Sao chép nội dung vào clipboard             | pyperclip              |
| `get_clipboard`     | Lấy nội dung từ clipboard                   | pyperclip              |

---

### 💰 2.8 Tài Chính & Mua Sắm

| Tool                | Mô tả                                   | Tích hợp               |
| ------------------- | --------------------------------------- | ---------------------- |
| `check_expense`     | Xem chi tiêu theo danh mục và thời gian | Google Sheets / Notion |
| `add_expense`       | Ghi lại chi tiêu mới                    | Google Sheets / Notion |
| `get_exchange_rate` | Lấy tỷ giá ngoại tệ                     | ExchangeRate API       |
| `search_product`    | Tìm kiếm giá sản phẩm online            | Playwright + scraping  |

---

### 🔧 2.9 Tiện Ích & Hỗ Trợ

| Tool               | Mô tả                               | Tích hợp                     |
| ------------------ | ----------------------------------- | ---------------------------- |
| `translate_text`   | Dịch văn bản sang ngôn ngữ chỉ định | Google Translate API / DeepL |
| `text_to_speech`   | Chuyển văn bản thành giọng nói      | gTTS / ElevenLabs            |
| `speech_to_text`   | Chuyển giọng nói thành văn bản      | Whisper / Google STT         |
| `generate_image`   | Tạo hình ảnh từ mô tả               | DALL-E / Stable Diffusion    |
| `calculate`        | Thực hiện tính toán toán học        | Python eval / math           |
| `convert_timezone` | Chuyển đổi múi giờ                  | pytz                         |
| `generate_qr_code` | Tạo mã QR từ văn bản/URL            | qrcode library               |
| `shorten_url`      | Rút gọn URL                         | Bitly API                    |
| `get_current_time` | Lấy ngày giờ hiện tại theo múi giờ  | datetime + pytz              |

---

## 3. Kiến Trúc Tool (Tool Schema)

Mỗi tool cần tuân theo cấu trúc sau (chuẩn OpenAI Function Calling / Anthropic Tool Use):

```json
{
    "name": "tool_name",
    "description": "Mô tả ngắn gọn, rõ ràng để agent hiểu khi nào nên dùng tool này",
    "parameters": {
        "type": "object",
        "properties": {
            "param_1": {
                "type": "string",
                "description": "Mô tả parameter"
            },
            "param_2": {
                "type": "string",
                "enum": ["option_a", "option_b"],
                "description": "Chọn một trong các giá trị"
            }
        },
        "required": ["param_1"]
    }
}
```

---

## 4. Yêu Cầu Kỹ Thuật

### 4.1 Xử Lý Lỗi

- Mỗi tool phải có `try/except` và trả về lỗi theo định dạng chuẩn
- Retry logic cho các API call (tối thiểu 3 lần với exponential backoff)
- Timeout cho mỗi tool call: tối đa **30 giây**

### 4.2 Logging

- Ghi log mỗi tool call: tên tool, input, output, thời gian thực thi
- Lưu log theo ngày vào thư mục `/logs/`

### 4.3 Bảo Mật

- Tất cả API key lưu trong `.env` file, không hardcode
- Hỗ trợ xác thực OAuth 2.0 cho Google APIs
- Không log thông tin nhạy cảm (mật khẩu, token)

### 4.4 Cấu Trúc Thư Mục

```
agent/
├── tools/
│   ├── calendar_tools.py
│   ├── email_tools.py
│   ├── task_tools.py
│   ├── messaging_tools.py
│   ├── search_tools.py
│   ├── file_tools.py
│   ├── desktop_tools.py
│   ├── finance_tools.py
│   └── utility_tools.py
├── core/
│   ├── agent.py          # Agent loop chính
│   ├── tool_registry.py  # Đăng ký và quản lý tools
│   └── memory.py         # Bộ nhớ ngắn/dài hạn cho agent
├── config/
│   └── settings.py
├── logs/
├── .env
├── requirements.txt
└── README.md
```

---

## 5. Thứ Tự Ưu Tiên Triển Khai

| Ưu tiên              | Nhóm Tool                    | Lý do                       |
| -------------------- | ---------------------------- | --------------------------- |
| 🔴 P0 (Ngay lập tức) | Calendar, Email, Task        | Core workflow hàng ngày     |
| 🟠 P1 (Tuần 2)       | Messaging, Search, Utility   | Hỗ trợ giao tiếp và tra cứu |
| 🟡 P2 (Tuần 3)       | File Management, Finance     | Nâng cao hiệu suất          |
| 🟢 P3 (Tuần 4+)      | Desktop Automation, AI tools | Mở rộng khả năng            |

---

## 6. Tiêu Chí Nghiệm Thu

- [ ] Mỗi tool có unit test riêng với coverage ≥ 80%
- [ ] Agent có thể thực hiện chuỗi 5 tác vụ liên tiếp không cần can thiệp
- [ ] Thời gian phản hồi trung bình < 5 giây/tác vụ đơn giản
- [ ] Xử lý đúng các trường hợp lỗi và thông báo rõ ràng cho người dùng
- [ ] Tài liệu hóa đầy đủ cho từng tool (docstring + README)

---

## 7. Ghi Chú Cho Developer

> - Ưu tiên sử dụng **official SDK** của từng dịch vụ thay vì scraping.
> - Thiết kế tool theo nguyên tắc **Single Responsibility** — mỗi tool làm 1 việc duy nhất.
> - Viết `description` cho tool thật chi tiết, vì LLM dùng nó để quyết định gọi tool nào.
> - Nên dùng **Pydantic** để validate input/output của mỗi tool.
> - Hỗ trợ chạy tools **async** (asyncio) để tăng hiệu suất khi agent gọi nhiều tools song song.
