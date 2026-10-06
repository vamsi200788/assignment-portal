# EduSubmit - Assignment Submission & Grading Portal

A modern, full-stack Assignment Submission and Evaluation Portal built to resolve the widespread chaos of assignment submissions scattered across emails, chat channels, messaging groups, and paper piles.

---

## 🎯 Problem It Solves
- **Lost Submissions:** Eliminates lost files in chaotic email inboxes and long group chat threads.
- **Automated Deadline Enforcement:** Removes disputes about on-time vs. late submissions by automatically comparing upload timestamps against assignment deadlines down to the minute.
- **Missing Student Tracking:** Gives faculty real-time, categorized rosters (Submitted On-Time, Late Submissions, Missing / Overdue) so faculty can immediately see who hasn't submitted yet.
- **Streamlined Grading & Feedback:** Enables faculty to grade submissions, write qualitative feedback/remarks, and immediately deliver scores and remarks directly to the student portal.
- **Offline / Email Fallback:** Includes a "Log Offline / Email Submission" feature so faculty can record paper copies or emailed files without disrupting the central roster.

---

## ✨ Key Functionalities & Features

### 1. Distinct & Separated Portals (Students vs. Professors)
- **Portal Selection Gateway:** Clear entry portal selector separating Student access from Professor/Faculty access.
- **Dedicated Student Authentication:**
  - **Student Sign In:** Login using Student University Email or **Student Roll Number** (e.g., `CS2026-001`). Enforces that only registered students can enter.
  - **Student Registration:** Requires Full Name, Student Roll Number / ID (e.g., `CS2026-009`), Student Email, Department, and Password. Automatically enrolls the student into active course assignments so they can start submitting immediately.
- **Dedicated Professor / Faculty Authentication:**
  - **Professor Sign In:** Login using Institutional Faculty Email (e.g., `turing@university.edu`). Enforces faculty role verification.
  - **Professor Registration:** Requires Full Name & Title (e.g., `Prof. Richard Feynman`), Faculty / Staff ID (e.g., `FAC-501`), Institutional Email, Department, and Password.
- **Cross-Role Protection:** If a student attempts to log in via the Professor Portal (or vice versa), the system blocks unauthorized entry and directs them to their appropriate portal.
- **Instant Demo Switcher:** Top bar still includes 1-click demo personas and quick shortcuts to test both portals seamlessly.

### 2. Assignment Creation with Attachments & Deadlines (Faculty)
- Post assignments specifying Course Code, Course Name, Title, Detailed Description/Rubric, Max Marks, and Deadline.
- Upload course attachments (assignment briefs, starter code, specifications, PDFs).
- Handy **Quick Test Deadline Presets** (`+10 Minutes`, `+1 Day`, `+3 Days`, `-5 Minutes (Past Due)`) to test late vs on-time behavior in seconds.

### 3. Student Submission Workflow (Student)
- Clean submission interface with countdown timers indicating remaining time or overdue status.
- Drag-and-drop file upload supporting source code (`.js`, `.py`, `.java`, `.cpp`), archives (`.zip`), PDFs, and documents.
- Optional submission notes/comments for the instructor.
- Re-submission support.

### 4. Automatic Late Submission Detection
- Compares submission timestamp (`submittedAt`) against the assignment deadline.
- Automatically marks submissions as:
  - **On-Time** (Green badge) if submitted before deadline.
  - **Late** (Amber badge) if submitted after deadline, computing the exact duration (e.g., `+3h 15m late`).

### 5. Categorized Faculty Rosters (Submitted, Late, Missing)
- Dedicated interactive tabs:
  - **All Students:** Full course roster with live status badges.
  - **Submitted On-Time:** All on-time submissions.
  - **Late Submissions:** All late submissions with exact delay duration.
  - **Missing / Not Submitted:** Students who have not yet submitted, clearly identifying whether the deadline has passed (Overdue) or is still upcoming. Includes a 1-click **"Send Reminder"** and **"Log Offline Submission"** action.
  - **Graded:** Submissions that have already been evaluated.
- Summary metric cards showing Total Enrolled, On-Time, Late, Missing, and Graded counts.
- **Export to CSV:** Download the full grade sheet with student roll numbers, timestamps, late durations, marks, and remarks.

### 6. Awarding Marks & Remarks (Faculty to Student)
- Award numeric marks validated against the assignment's maximum marks.
- Qualitative remarks and feedback textarea with **Quick Feedback Snippets** (e.g., "Outstanding work", "Missing tests", "Late penalty applied").
- Student immediately views the awarded marks, percentage score badge, evaluator name, evaluation timestamp, and faculty remarks.

### 7. File Download & Code Previewer
- In-portal code and text preview modal allowing faculty to review student code directly inside the application before downloading.

---

## 🚀 How to Run

### Method 1: Using the Batch Script
Simply double-click `start.bat` in the project folder.

### Method 2: Command Line
```powershell
# From the project directory:
$env:Path = "$PWD\nodejs;" + $env:Path
node server.js
```
The application will start on:
**[http://localhost:5000](http://localhost:5000)**

---

## 👥 Pre-Seeded Demo Accounts

You can switch between any of these users with 1 click using the **Quick Switch Demo User** dropdown in the top header:

| Role | Name | Department / Roll No | Purpose / Demo Scenario |
| :--- | :--- | :--- | :--- |
| **Faculty** | Prof. Alan Turing | Computer Science | Instructor for CS301 & CS402 |
| **Faculty** | Prof. Ada Lovelace | Software Systems | Instructor for SE205 |
| **Student** | Alice Smith | CS2026-001 | On-time submitter (Graded: 96/100) |
| **Student** | Bob Johnson | CS2026-002 | Late submitter (+3h 15m delay, Graded: 82/100) |
| **Student** | Charlie Davis | CS2026-003 | Missing submission for Assignment 1 |
| **Student** | Diana Evans | CS2026-004 | On-time submission, pending evaluation |
| **Student** | Ethan Clark | CS2026-005 | Enrolled student |
| **Student** | Fiona Patel | CS2026-006 | Enrolled student |

---

## 🧪 Automated Testing

An automated verification test script `test_flows.js` is included in the project root:
```powershell
node test_flows.js
```
This tests:
1. Fetching users and authentication
2. Faculty posting an assignment with attachment and deadline
3. Student submitting before deadline (`isLate: false`)
4. Student submitting after deadline (`isLate: true`, duration calculation)
5. Faculty viewing categorized lists (On-time, Late, Missing)
6. Faculty awarding marks and remarks
7. Student portal receiving marks and remarks in real-time
