const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;

// Directories
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const ASSIGNMENTS_UPLOAD_DIR = path.join(UPLOADS_DIR, 'assignments');
const SUBMISSIONS_UPLOAD_DIR = path.join(UPLOADS_DIR, 'submissions');

// Ensure directories exist
[DATA_DIR, UPLOADS_DIR, ASSIGNMENTS_UPLOAD_DIR, SUBMISSIONS_UPLOAD_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer Storage for Assignment Attachments
const assignmentStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ASSIGNMENTS_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const unique = crypto.randomBytes(4).toString('hex');
    cb(null, `asg_${Date.now()}_${base}${ext}`);
  }
});

// Configure Multer Storage for Student Submissions
const submissionStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, SUBMISSIONS_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const unique = crypto.randomBytes(4).toString('hex');
    cb(null, `sub_${Date.now()}_${base}${ext}`);
  }
});

const uploadAssignment = multer({
  storage: assignmentStorage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

const uploadSubmission = multer({
  storage: submissionStorage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Helper: Read DB
function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return { users: [], courses: [], assignments: [], submissions: [] };
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading db.json:', err);
    return { users: [], courses: [], assignments: [], submissions: [] };
  }
}

// Helper: Write DB
function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing db.json:', err);
    return false;
  }
}

// Format duration helper (minutes to "Xh Ym" or "X mins")
function formatDuration(minutes) {
  if (minutes <= 0) return 'On Time';
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);
  return parts.join(' ') + ' late';
}

// ==========================================
// 1. AUTH & USER ENDPOINTS
// ==========================================

// Get all users (for fast switching / directory)
app.get('/api/auth/users', (req, res) => {
  const db = readDb();
  const safeUsers = db.users.map(({ password, ...u }) => u);
  res.json({ success: true, users: safeUsers });
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, password, userId, expectedRole } = req.body;
  const db = readDb();

  let user;
  if (userId) {
    user = db.users.find(u => u.id === userId);
  } else if (email) {
    user = db.users.find(u =>
      u.email.toLowerCase() === email.toLowerCase() ||
      (u.rollNo && u.rollNo.toLowerCase() === email.toLowerCase())
    );
    if (user && password && user.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid password credentials' });
    }
  }

  if (!user) {
    return res.status(404).json({ success: false, message: 'Account not found with provided email or roll number' });
  }

  // Enforce separated portal logins
  if (expectedRole && user.role !== expectedRole) {
    if (expectedRole === 'faculty') {
      return res.status(403).json({
        success: false,
        message: 'This account is registered as a Student. Please use the Student Portal to log in.'
      });
    } else {
      return res.status(403).json({
        success: false,
        message: 'This account is registered as Professor / Faculty. Please use the Professor Portal to log in.'
      });
    }
  }

  const { password: _, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// Register
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, role, department, rollNo, facultyId } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ success: false, message: 'Name, email, and portal role are required' });
  }

  const db = readDb();
  if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ success: false, message: 'An account with this email is already registered.' });
  }

  if (role === 'student') {
    if (!rollNo) {
      return res.status(400).json({ success: false, message: 'Student Roll Number is required for student registration.' });
    }
    if (db.users.some(u => u.role === 'student' && u.rollNo && u.rollNo.toLowerCase() === rollNo.toLowerCase())) {
      return res.status(400).json({ success: false, message: `Student Roll Number '${rollNo}' is already registered.` });
    }
  }

  const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';
  const prefix = role === 'faculty' ? 'fac_' : 'stu_';
  const newUser = {
    id: `${prefix}${Date.now()}`,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password: password || 'password123',
    role,
    department: (department || (role === 'faculty' ? 'Computer Science & Engineering' : 'General Engineering')).trim(),
    rollNo: role === 'student' ? rollNo.trim().toUpperCase() : undefined,
    facultyId: role === 'faculty' ? (facultyId ? facultyId.trim().toUpperCase() : `FAC-${Date.now().toString().slice(-4)}`) : undefined,
    avatar: initials
  };

  // If student, automatically enroll into active assignments
  if (role === 'student') {
    db.assignments.forEach(a => {
      if (!a.enrolledStudents) a.enrolledStudents = [];
      if (!a.enrolledStudents.includes(newUser.id)) {
        a.enrolledStudents.push(newUser.id);
      }
    });
  }

  db.users.push(newUser);
  writeDb(db);

  const { password: _, ...safeUser } = newUser;
  res.status(201).json({
    success: true,
    user: safeUser,
    message: `Registered successfully as ${role === 'faculty' ? 'Professor' : 'Student'}!`
  });
});

// ==========================================
// 2. ASSIGNMENTS ENDPOINTS
// ==========================================

// Get all assignments with enriched statistics
app.get('/api/assignments', (req, res) => {
  const db = readDb();
  const studentId = req.query.studentId;
  const facultyId = req.query.facultyId;
  const now = new Date();

  const allStudentIds = db.users.filter(u => u.role === 'student').map(u => u.id);

  let filtered = db.assignments;
  if (facultyId) {
    // Show assignments created by this faculty
    filtered = filtered.filter(a => a.facultyId === facultyId);
  }

  const enriched = filtered.map(assignment => {
    const deadlineDate = new Date(assignment.deadline);
    const isPastDeadline = now > deadlineDate;

    // Enrolled students for this assignment
    const enrolledIds = assignment.enrolledStudents && assignment.enrolledStudents.length > 0
      ? assignment.enrolledStudents
      : allStudentIds;

    // Submissions for this assignment
    const assignmentSubmissions = db.submissions.filter(s => s.assignmentId === assignment.id);
    const submittedStudentIds = new Set(assignmentSubmissions.map(s => s.studentId));

    const submittedCount = assignmentSubmissions.length;
    const lateCount = assignmentSubmissions.filter(s => s.isLate).length;
    const onTimeCount = assignmentSubmissions.filter(s => !s.isLate).length;
    const missingCount = enrolledIds.filter(id => !submittedStudentIds.has(id)).length;
    const gradedCount = assignmentSubmissions.filter(s => s.grade && s.grade.marks !== null).length;

    // Calculate average marks if graded
    const gradedSubs = assignmentSubmissions.filter(s => s.grade && typeof s.grade.marks === 'number');
    const avgMarks = gradedSubs.length > 0
      ? Math.round((gradedSubs.reduce((acc, cur) => acc + cur.grade.marks, 0) / gradedSubs.length) * 10) / 10
      : null;

    // If query includes studentId, attach their personal submission state
    let mySubmission = null;
    let myStatus = 'missing'; // 'submitted_ontime', 'submitted_late', 'missing_overdue', 'missing_pending'
    if (studentId) {
      mySubmission = assignmentSubmissions.find(s => s.studentId === studentId) || null;
      if (mySubmission) {
        myStatus = mySubmission.isLate ? 'submitted_late' : 'submitted_ontime';
      } else {
        myStatus = isPastDeadline ? 'missing_overdue' : 'missing_pending';
      }
    }

    return {
      ...assignment,
      isPastDeadline,
      stats: {
        totalEnrolled: enrolledIds.length,
        submittedCount,
        onTimeCount,
        lateCount,
        missingCount,
        gradedCount,
        avgMarks
      },
      mySubmission,
      myStatus
    };
  });

  // Sort by deadline descending
  enriched.sort((a, b) => new Date(b.deadline) - new Date(a.deadline));

  res.json({ success: true, assignments: enriched });
});

// Get single assignment with full details & rosters
app.get('/api/assignments/:id', (req, res) => {
  const db = readDb();
  const assignment = db.assignments.find(a => a.id === req.params.id);
  if (!assignment) {
    return res.status(404).json({ success: false, message: 'Assignment not found' });
  }

  const now = new Date();
  const deadlineDate = new Date(assignment.deadline);
  const isPastDeadline = now > deadlineDate;

  const allStudents = db.users.filter(u => u.role === 'student');
  const enrolledStudents = assignment.enrolledStudents && assignment.enrolledStudents.length > 0
    ? allStudents.filter(s => assignment.enrolledStudents.includes(s.id))
    : allStudents;

  const submissions = db.submissions.filter(s => s.assignmentId === assignment.id);
  const submissionMap = new Map();
  submissions.forEach(s => submissionMap.set(s.studentId, s));

  // Build complete roster with status
  const studentRoster = enrolledStudents.map(student => {
    const sub = submissionMap.get(student.id);
    let status = 'missing';
    let statusLabel = isPastDeadline ? 'Missing / Overdue' : 'Pending Submission';
    let badgeClass = isPastDeadline ? 'badge-danger' : 'badge-warning';

    if (sub) {
      if (sub.isLate) {
        status = 'late';
        statusLabel = `Submitted Late (+${formatDuration(sub.lateDurationMinutes)})`;
        badgeClass = 'badge-warning';
      } else {
        status = 'on_time';
        statusLabel = 'Submitted On-Time';
        badgeClass = 'badge-success';
      }
    }

    return {
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        rollNo: student.rollNo,
        department: student.department,
        avatar: student.avatar
      },
      submission: sub || null,
      status,
      statusLabel,
      badgeClass,
      isGraded: !!(sub && sub.grade && sub.grade.marks !== null)
    };
  });

  const onTimeList = studentRoster.filter(r => r.status === 'on_time');
  const lateList = studentRoster.filter(r => r.status === 'late');
  const missingList = studentRoster.filter(r => r.status === 'missing');
  const submittedList = studentRoster.filter(r => r.submission !== null);

  res.json({
    success: true,
    assignment: {
      ...assignment,
      isPastDeadline
    },
    counts: {
      totalEnrolled: studentRoster.length,
      submitted: submittedList.length,
      onTime: onTimeList.length,
      late: lateList.length,
      missing: missingList.length,
      graded: submittedList.filter(s => s.isGraded).length
    },
    roster: studentRoster,
    lists: {
      submitted: submittedList,
      onTime: onTimeList,
      late: lateList,
      missing: missingList
    }
  });
});

// Create Assignment (Faculty)
app.post('/api/assignments', uploadAssignment.single('attachmentFile'), (req, res) => {
  const { facultyId, title, description, courseCode, courseName, deadline, maxMarks, allowLate, enrolledStudents } = req.body;

  if (!title || !deadline || !facultyId) {
    return res.status(400).json({ success: false, message: 'Title, deadline, and facultyId are required' });
  }

  const db = readDb();
  const faculty = db.users.find(u => u.id === facultyId && u.role === 'faculty');
  if (!faculty) {
    return res.status(403).json({ success: false, message: 'Valid faculty user required' });
  }

  let attachment = null;
  if (req.file) {
    attachment = {
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      mimeType: req.file.mimetype
    };
  }

  // Parse enrolled students if provided
  let enrolled = [];
  if (enrolledStudents) {
    try {
      enrolled = typeof enrolledStudents === 'string' ? JSON.parse(enrolledStudents) : enrolledStudents;
    } catch {
      enrolled = db.users.filter(u => u.role === 'student').map(u => u.id);
    }
  } else {
    enrolled = db.users.filter(u => u.role === 'student').map(u => u.id);
  }

  const newAssignment = {
    id: `asg_${Date.now()}`,
    facultyId,
    facultyName: faculty.name,
    courseCode: courseCode || 'GEN101',
    courseName: courseName || 'General Course',
    title: title.trim(),
    description: description ? description.trim() : '',
    maxMarks: parseInt(maxMarks) || 100,
    deadline: new Date(deadline).toISOString(),
    createdAt: new Date().toISOString(),
    attachment,
    allowLate: allowLate === 'true' || allowLate === true,
    enrolledStudents: enrolled
  };

  db.assignments.unshift(newAssignment);
  writeDb(db);

  res.status(201).json({ success: true, assignment: newAssignment });
});

// Delete Assignment
app.delete('/api/assignments/:id', (req, res) => {
  const db = readDb();
  const index = db.assignments.findIndex(a => a.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Assignment not found' });
  }

  // Also remove associated submissions
  db.assignments.splice(index, 1);
  db.submissions = db.submissions.filter(s => s.assignmentId !== req.params.id);
  writeDb(db);

  res.json({ success: true, message: 'Assignment deleted' });
});

// ==========================================
// 3. SUBMISSIONS ENDPOINTS
// ==========================================

// Student submits an assignment (File upload + Automatic Late Calculation)
app.post('/api/submissions', uploadSubmission.single('submissionFile'), (req, res) => {
  const { assignmentId, studentId, comments, simulatedTime } = req.body;

  if (!assignmentId || !studentId) {
    return res.status(400).json({ success: false, message: 'Assignment ID and Student ID are required' });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please upload a submission file' });
  }

  const db = readDb();
  const assignment = db.assignments.find(a => a.id === assignmentId);
  if (!assignment) {
    return res.status(404).json({ success: false, message: 'Assignment not found' });
  }

  const student = db.users.find(u => u.id === studentId && u.role === 'student');
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' });
  }

  // Determine submission timestamp (support optional simulated time for testing/demo)
  const submittedAtDate = simulatedTime ? new Date(simulatedTime) : new Date();
  const deadlineDate = new Date(assignment.deadline);

  // AUTOMATIC LATE CALCULATION
  const isLate = submittedAtDate.getTime() > deadlineDate.getTime();
  const lateDurationMs = isLate ? (submittedAtDate.getTime() - deadlineDate.getTime()) : 0;
  const lateDurationMinutes = Math.floor(lateDurationMs / 60000);

  const fileInfo = {
    originalName: req.file.originalname,
    filename: req.file.filename,
    size: req.file.size,
    mimeType: req.file.mimetype
  };

  // Check if student previously submitted, if so update/resubmit
  const existingIndex = db.submissions.findIndex(s => s.assignmentId === assignmentId && s.studentId === studentId);

  let submissionRecord;
  if (existingIndex !== -1) {
    submissionRecord = {
      ...db.submissions[existingIndex],
      submittedAt: submittedAtDate.toISOString(),
      isLate,
      lateDurationMinutes,
      comments: comments ? comments.trim() : db.submissions[existingIndex].comments,
      file: fileInfo,
      resubmitted: true
    };
    db.submissions[existingIndex] = submissionRecord;
  } else {
    submissionRecord = {
      id: `sub_${Date.now()}`,
      assignmentId,
      studentId,
      studentName: student.name,
      studentRollNo: student.rollNo,
      studentEmail: student.email,
      submittedAt: submittedAtDate.toISOString(),
      isLate,
      lateDurationMinutes,
      comments: comments ? comments.trim() : '',
      file: fileInfo,
      grade: null
    };
    db.submissions.unshift(submissionRecord);
  }

  writeDb(db);

  res.status(201).json({
    success: true,
    message: isLate
      ? `Submission received. Note: Marked as LATE by ${formatDuration(lateDurationMinutes)}.`
      : 'Submission received successfully ON TIME!',
    submission: submissionRecord
  });
});

// Faculty records an offline / email / paper submission on behalf of a student
app.post('/api/submissions/record-offline', (req, res) => {
  const { assignmentId, studentId, submissionDate, comments, marks, remarks, facultyName } = req.body;

  if (!assignmentId || !studentId) {
    return res.status(400).json({ success: false, message: 'Assignment ID and Student ID are required' });
  }

  const db = readDb();
  const assignment = db.assignments.find(a => a.id === assignmentId);
  const student = db.users.find(u => u.id === studentId);

  if (!assignment || !student) {
    return res.status(404).json({ success: false, message: 'Assignment or Student not found' });
  }

  const submittedAtDate = submissionDate ? new Date(submissionDate) : new Date();
  const deadlineDate = new Date(assignment.deadline);
  const isLate = submittedAtDate.getTime() > deadlineDate.getTime();
  const lateDurationMs = isLate ? (submittedAtDate.getTime() - deadlineDate.getTime()) : 0;
  const lateDurationMinutes = Math.floor(lateDurationMs / 60000);

  const newSubmission = {
    id: `sub_${Date.now()}`,
    assignmentId,
    studentId,
    studentName: student.name,
    studentRollNo: student.rollNo,
    studentEmail: student.email,
    submittedAt: submittedAtDate.toISOString(),
    isLate,
    lateDurationMinutes,
    comments: comments || 'Recorded by Faculty (Physical paper / Email submission)',
    file: {
      originalName: 'offline_paper_submission.txt',
      filename: 'distributed_cache_spec.txt',
      size: 512,
      mimeType: 'text/plain'
    },
    grade: marks !== undefined && marks !== '' ? {
      marks: Number(marks),
      remarks: remarks || 'Graded upon receipt',
      gradedAt: new Date().toISOString(),
      gradedBy: facultyName || 'Faculty'
    } : null
  };

  const existingIdx = db.submissions.findIndex(s => s.assignmentId === assignmentId && s.studentId === studentId);
  if (existingIdx !== -1) {
    db.submissions[existingIdx] = newSubmission;
  } else {
    db.submissions.unshift(newSubmission);
  }

  writeDb(db);
  res.json({ success: true, submission: newSubmission });
});

// Faculty awards Marks & Remarks to a student submission
app.post('/api/submissions/:id/grade', (req, res) => {
  const { marks, remarks, gradedBy } = req.body;
  const db = readDb();

  const submission = db.submissions.find(s => s.id === req.params.id);
  if (!submission) {
    return res.status(404).json({ success: false, message: 'Submission not found' });
  }

  const assignment = db.assignments.find(a => a.id === submission.assignmentId);
  const maxMarks = assignment ? assignment.maxMarks : 100;

  const numericMarks = parseFloat(marks);
  if (isNaN(numericMarks) || numericMarks < 0 || numericMarks > maxMarks) {
    return res.status(400).json({
      success: false,
      message: `Marks must be a number between 0 and maximum marks (${maxMarks})`
    });
  }

  submission.grade = {
    marks: numericMarks,
    remarks: remarks ? remarks.trim() : 'Good work.',
    gradedAt: new Date().toISOString(),
    gradedBy: gradedBy || 'Faculty Evaluator'
  };

  writeDb(db);

  res.json({
    success: true,
    message: 'Grade and remarks awarded successfully',
    submission
  });
});

// ==========================================
// 4. FILE DOWNLOAD & PREVIEW
// ==========================================

app.get('/api/files/:type/:filename', (req, res) => {
  const { type, filename } = req.params;
  const targetDir = type === 'assignments' ? ASSIGNMENTS_UPLOAD_DIR : SUBMISSIONS_UPLOAD_DIR;
  const safeFilename = path.basename(filename);
  const filePath = path.join(targetDir, safeFilename);

  if (!fs.existsSync(filePath)) {
    // If not found in target dir, check fallback in uploads
    const fallbackPath = path.join(UPLOADS_DIR, 'assignments', safeFilename);
    if (fs.existsSync(fallbackPath)) {
      return res.download(fallbackPath);
    }
    return res.status(404).json({ success: false, message: 'File not found on server' });
  }

  res.download(filePath, safeFilename);
});

// Preview text/code files directly in browser
app.get('/api/files/preview/:type/:filename', (req, res) => {
  const { type, filename } = req.params;
  const targetDir = type === 'assignments' ? ASSIGNMENTS_UPLOAD_DIR : SUBMISSIONS_UPLOAD_DIR;
  const safeFilename = path.basename(filename);
  const filePath = path.join(targetDir, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  res.sendFile(filePath);
});

// ==========================================
// 5. SYSTEM & STATS UTILITIES
// ==========================================

// Global Stats
app.get('/api/system/stats', (req, res) => {
  const db = readDb();
  const totalAssignments = db.assignments.length;
  const totalSubmissions = db.submissions.length;
  const lateSubmissions = db.submissions.filter(s => s.isLate).length;
  const onTimeSubmissions = totalSubmissions - lateSubmissions;
  const gradedSubmissions = db.submissions.filter(s => s.grade && s.grade.marks !== null).length;
  const pendingGrading = totalSubmissions - gradedSubmissions;

  res.json({
    success: true,
    stats: {
      totalAssignments,
      totalSubmissions,
      lateSubmissions,
      onTimeSubmissions,
      gradedSubmissions,
      pendingGrading,
      totalStudents: db.users.filter(u => u.role === 'student').length,
      totalFaculty: db.users.filter(u => u.role === 'faculty').length
    }
  });
});

// Reset Demo Data
app.post('/api/system/reset', (req, res) => {
  const seedTemplate = {
    users: [
      { id: "fac_1", name: "Prof. Alan Turing", email: "turing@university.edu", password: "password123", role: "faculty", department: "Computer Science & Engineering", avatar: "AT" },
      { id: "fac_2", name: "Prof. Ada Lovelace", email: "ada@university.edu", password: "password123", role: "faculty", department: "Software Systems & Computing", avatar: "AL" },
      { id: "stu_1", name: "Alice Smith", email: "alice@student.edu", password: "password123", role: "student", rollNo: "CS2026-001", department: "Computer Science", avatar: "AS" },
      { id: "stu_2", name: "Bob Johnson", email: "bob@student.edu", password: "password123", role: "student", rollNo: "CS2026-002", department: "Computer Science", avatar: "BJ" },
      { id: "stu_3", name: "Charlie Davis", email: "charlie@student.edu", password: "password123", role: "student", rollNo: "CS2026-003", department: "Computer Science", avatar: "CD" },
      { id: "stu_4", name: "Diana Evans", email: "diana@student.edu", password: "password123", role: "student", rollNo: "CS2026-004", department: "Computer Science", avatar: "DE" },
      { id: "stu_5", name: "Ethan Clark", email: "ethan@student.edu", password: "password123", role: "student", rollNo: "CS2026-005", department: "Computer Science", avatar: "EC" },
      { id: "stu_6", name: "Fiona Patel", email: "fiona@student.edu", password: "password123", role: "student", rollNo: "CS2026-006", department: "Computer Science", avatar: "FP" }
    ],
    courses: [
      { id: "crs_cs301", code: "CS301", name: "Distributed Systems & Cloud Computing", facultyId: "fac_1" },
      { id: "crs_cs402", code: "CS402", name: "Modern Database Engineering", facultyId: "fac_1" },
      { id: "crs_se205", code: "SE205", name: "Microservices & DevOps Architecture", facultyId: "fac_2" }
    ],
    assignments: [
      {
        id: "asg_101",
        facultyId: "fac_1",
        facultyName: "Prof. Alan Turing",
        courseCode: "CS301",
        courseName: "Distributed Systems & Cloud Computing",
        title: "Assignment 1: Distributed In-Memory Cache Implementation",
        description: "Design and implement a distributed in-memory key-value cache supporting LRU eviction, node partitioning via consistent hashing, and virtual nodes. Include performance benchmarks and unit test suite.",
        maxMarks: 100,
        deadline: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        attachment: {
          originalName: "distributed_cache_spec.txt",
          filename: "distributed_cache_spec.txt",
          size: 655,
          mimeType: "text/plain"
        },
        allowLate: true,
        enrolledStudents: ["stu_1", "stu_2", "stu_3", "stu_4", "stu_5", "stu_6"]
      },
      {
        id: "asg_102",
        facultyId: "fac_1",
        facultyName: "Prof. Alan Turing",
        courseCode: "CS402",
        courseName: "Modern Database Engineering",
        title: "Assignment 2: Cloud Database Schema & Index Optimization",
        description: "Analyze the e-commerce workload logs provided. Design an optimized 3NF / star schema in PostgreSQL, define composite indexes, and include EXPLAIN ANALYZE query plans.",
        maxMarks: 50,
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days in future
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        attachment: {
          originalName: "distributed_cache_spec.txt",
          filename: "distributed_cache_spec.txt",
          size: 655,
          mimeType: "text/plain"
        },
        allowLate: true,
        enrolledStudents: ["stu_1", "stu_2", "stu_3", "stu_4", "stu_5", "stu_6"]
      },
      {
        id: "asg_103",
        facultyId: "fac_2",
        facultyName: "Prof. Ada Lovelace",
        courseCode: "SE205",
        courseName: "Microservices & DevOps Architecture",
        title: "Assignment 3: Containerized Microservices API with Health Checks",
        description: "Build a multi-container Docker Compose setup containing an API Gateway, an Auth microservice, and a Product catalog. Configure liveness and readiness health checks.",
        maxMarks: 80,
        deadline: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6 hours in future
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        attachment: null,
        allowLate: true,
        enrolledStudents: ["stu_1", "stu_2", "stu_3", "stu_4", "stu_5", "stu_6"]
      }
    ],
    submissions: [
      {
        id: "sub_201",
        assignmentId: "asg_101",
        studentId: "stu_1",
        studentName: "Alice Smith",
        studentRollNo: "CS2026-001",
        studentEmail: "alice@student.edu",
        submittedAt: new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000).toISOString(),
        isLate: false,
        lateDurationMinutes: 0,
        comments: "Implemented with 150 virtual nodes per partition. Verified with 10k concurrent benchmark operations.",
        file: {
          originalName: "alice_cache_submission.js",
          filename: "alice_cache_submission.js",
          size: 384,
          mimeType: "application/javascript"
        },
        grade: {
          marks: 96,
          remarks: "Outstanding work, Alice! The hash ring distribution algorithm is well structured and unit tests are comprehensive.",
          gradedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          gradedBy: "Prof. Alan Turing"
        }
      },
      {
        id: "sub_202",
        assignmentId: "asg_101",
        studentId: "stu_2",
        studentName: "Bob Johnson",
        studentRollNo: "CS2026-002",
        studentEmail: "bob@student.edu",
        submittedAt: new Date(Date.now() - (2 * 24 * 60 * 60 * 1000 - 3.25 * 60 * 60 * 1000)).toISOString(),
        isLate: true,
        lateDurationMinutes: 195,
        comments: "Resolved concurrency lock contention before uploading. Apologies for submitting after the deadline.",
        file: {
          originalName: "bob_cache_submission.py",
          filename: "bob_cache_submission.py",
          size: 395,
          mimeType: "text/x-python"
        },
        grade: {
          marks: 82,
          remarks: "Good core logic and recovery handling. Marked as Late (3h 15m delay). A 5-mark late penalty was factored in.",
          gradedAt: new Date(Date.now() - 0.5 * 24 * 60 * 60 * 1000).toISOString(),
          gradedBy: "Prof. Alan Turing"
        }
      },
      {
        id: "sub_203",
        assignmentId: "asg_101",
        studentId: "stu_4",
        studentName: "Diana Evans",
        studentRollNo: "CS2026-004",
        studentEmail: "diana@student.edu",
        submittedAt: new Date(Date.now() - (2 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000)).toISOString(),
        isLate: false,
        lateDurationMinutes: 0,
        comments: "Attached project code with benchmark graphs comparing LRU vs LFU performance under high load.",
        file: {
          originalName: "diana_benchmark_suite.js",
          filename: "alice_cache_submission.js",
          size: 384,
          mimeType: "application/javascript"
        },
        grade: null
      }
    ]
  };

  writeDb(seedTemplate);
  res.json({ success: true, message: 'Database reset to initial demo state' });
});

// Fallback route for SPA
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  Assignment Submission Portal running at:`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
