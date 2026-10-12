# Hallpass – Smart Examination Section Management System

**Hallpass** is a full-stack, enterprise-grade university examination portal developed for digitizing exam schedules, room seating allocation, candidate admittance, invigilator attendance recording, absentee statements, and student hall pass access.

- **Target Firebase Project:** `smart-examination-dac73`
- **Frontend:** React, Vite, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express.js, TypeScript, REST APIs
- **Database & Auth:** Firebase Cloud Firestore & Firebase Authentication (Email/Password)
- **Privileged Backend Integration:** Firebase Admin SDK with Bearer ID Token verification and Attribute-Based Access Control (ABAC)

---

## 1. System Architecture & Flow

```text
[Examination Admin]
       │
       ├── Creates Examination (Course, Session, Date, Eligible Classes)
       ├── Registers Examination Halls / Rooms (Capacity bounds)
       ├── Enrolls Students (Student Roll Numbers) & Staff (Staff Roll Numbers)
       ├── Executes Automated Seating Engine (Capacity validation, Collision guard)
       └── Publishes Allocations
              │
              ├──► [Student Portal]
              │      └── Views Hall Ticket / Hallpass with exact Seat & Room Number
              │
              └──► [Examination In-Charge / Invigilator]
                     ├── Opens Assigned Room Attendance Roster
                     ├── Marks Candidates: Present / Absent / Unmarked
                     ├── Blocks Submission if ANY Candidate is Unmarked
                     └── Finalizes Locked Submission
                            │
                            └──► [Controller of Examinations]
                                   ├── Real-Time Dashboard Metrics Auto-Update
                                   └── Consolidated Absentee Statement Generated
```

---

## 2. University Roles & Permissions

1. **Examination Admin (`admin`)**:
   - Manage examination schedules, courses, rooms, students, and staff directory.
   - Run automatic or manual room seat allocation with capacity overflow warnings.
   - Publish hallpasses to candidates.
   - View complete administrative dashboard metrics and absentee statements.

2. **Examination In-Charge (`incharge`)**:
   - Access only halls assigned to their profile.
   - Mark candidate attendance live during examination sessions.
   - Strict unmark validation: All candidates must be Present or Absent before final submission.
   - Generate official printable attendance sheets with candidate signature strips.

3. **Student (`student`)**:
   - View only personal examination hallpasses and seat assignments once published.
   - Zero access to other candidate records or administrative operations.

---

## 3. Resolving the Firebase Admin SDK Configuration Issue

If you previously encountered:
```text
[Firebase] Admin SDK project configuration:
{ projectId: 'unresolved' }
"Failed to fetch"
```

### Why it happened:
1. `admin.initializeApp()` was invoked without explicitly resolving `projectId` or credentials.
2. The backend was running on port 4000 while the frontend was requesting port 5173 without CORS allowlisting or reverse-proxy routing.

### How Hallpass permanently resolves it:
1. **Explicit Project Binding**: `backend/src/config/firebase.ts` specifies `FIREBASE_PROJECT_ID=smart-examination-dac73` across all initializers.
2. **Unified Development Routing**: In Vite development, Express is mounted as a dev server middleware directly on `/api/*`, ensuring **zero CORS issues and zero port mismatch**.
3. **Multi-Strategy Credential Fallback**:
   - If `FIREBASE_SERVICE_ACCOUNT_KEY` (raw or base64 JSON) is provided: Loads `admin.credential.cert(serviceAccount)`.
   - If running in Cloud Run / GCP: Loads `admin.credential.applicationDefault()`.
   - If local demo mode: Smoothly falls back to resilient persistent store without server crashes or unhandled rejections.

---

## 4. Environment Configuration

### Frontend (`frontend/.env` or root `.env`)
```bash
VITE_FIREBASE_API_KEY="AIzaSy..."
VITE_FIREBASE_AUTH_DOMAIN="smart-examination-dac73.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="smart-examination-dac73"
VITE_FIREBASE_STORAGE_BUCKET="smart-examination-dac73.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="942734749702"
VITE_FIREBASE_APP_ID="1:942734749702:web:abcdef123456"
VITE_API_BASE_URL=""
```

### Backend (`backend/.env` or root `.env`)
```bash
PORT=4000
NODE_ENV=development
FIREBASE_PROJECT_ID="smart-examination-dac73"
CORS_ORIGIN="http://localhost:3000,http://localhost:5173"

# Optional: Place service account JSON string for full production Admin SDK
# FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"smart-examination-dac73",...}
```

---

## 5. Quick-Start Instructions

### Unified Dev Mode (Recommended for Webathon / AI Studio):
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the integrated full-stack portal.

### Standalone Backend Execution (Port 4000):
```bash
npx tsx server.ts
```

### Run Automated Test Suite:
```bash
npx tsx --test test/system.test.ts
```

---

## 6. User Account Registration & Login

Hallpass uses institutional identity management:

1. **User Registration**:
   - Register on the portal with your legal name, university email, role (Student, In-Charge, or Admin), department, and roll number.
   - For students: Provide your university roll number (e.g. `21CS101`).
   - For staff/in-charges: Provide your staff roll number / faculty ID (e.g. `FAC-CSE-01` or `ADM-01`).

2. **Dual-Factor Authentication**:
   - The login page checks that the entered university email matches the stored institutional roll number.
   - Access to dashboards is determined strictly by the authorized role stored in the database.
