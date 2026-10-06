const fs = require('fs');
const path = require('path');

async function runTests() {
  console.log('>>> Starting Automated Verification of Portal Requirements...');
  const baseUrl = 'http://localhost:5000';

  // 1. Check Auth / Users
  const usersRes = await fetch(`${baseUrl}/api/auth/users`).then(r => r.json());
  console.log(`[PASS] Users fetched: ${usersRes.users.length} total users.`);

  // 2. Faculty creates a new assignment with a 5-minute future deadline
  const tenMinutesFuture = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  
  // Create multipart boundary for assignment creation
  const dummyFilePath = path.join(__dirname, 'test_prompt.txt');
  fs.writeFileSync(dummyFilePath, 'Specification for Cloud DevOps Assignment', 'utf-8');

  const formData = new FormData();
  formData.append('facultyId', 'fac_1');
  formData.append('courseCode', 'TEST101');
  formData.append('courseName', 'Automated Testing Lab');
  formData.append('title', 'E2E Test Assignment: Microservices Architecture');
  formData.append('description', 'Build a containerized sample API');
  formData.append('maxMarks', '100');
  formData.append('deadline', tenMinutesFuture);
  formData.append('allowLate', 'true');
  
  const fileBlob = new Blob([fs.readFileSync(dummyFilePath)], { type: 'text/plain' });
  formData.append('attachmentFile', fileBlob, 'test_prompt.txt');

  const createRes = await fetch(`${baseUrl}/api/assignments`, {
    method: 'POST',
    body: formData
  }).then(r => r.json());

  console.log(`[PASS] Faculty created assignment: id=${createRes.assignment.id}, title="${createRes.assignment.title}"`);
  const asgId = createRes.assignment.id;

  // 3. Student (stu_3, Charlie) uploads submission BEFORE deadline -> Expect isLate: false
  const subFormData = new FormData();
  subFormData.append('assignmentId', asgId);
  subFormData.append('studentId', 'stu_3');
  subFormData.append('comments', 'Submitting on-time before the 10m deadline');
  const subFileBlob = new Blob(['// Charlie code implementation'], { type: 'text/plain' });
  subFormData.append('submissionFile', subFileBlob, 'charlie_solution.js');

  const onTimeSubRes = await fetch(`${baseUrl}/api/submissions`, {
    method: 'POST',
    body: subFormData
  }).then(r => r.json());

  console.log(`[PASS] Charlie submission: isLate=${onTimeSubRes.submission.isLate}, message="${onTimeSubRes.message}"`);
  if (onTimeSubRes.submission.isLate !== false) {
    throw new Error('Expected submission to be ON TIME but got isLate=true');
  }

  // 4. Student (stu_5, Ethan) uploads submission AFTER deadline (simulated 20 mins in future) -> Expect isLate: true
  const simulatedLateTime = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 20 mins after deadline
  const lateFormData = new FormData();
  lateFormData.append('assignmentId', asgId);
  lateFormData.append('studentId', 'stu_5');
  lateFormData.append('comments', 'Submitted after troubleshooting connection errors');
  lateFormData.append('simulatedTime', simulatedLateTime);
  const lateFileBlob = new Blob(['// Ethan late submission code'], { type: 'text/plain' });
  lateFormData.append('submissionFile', lateFileBlob, 'ethan_solution.js');

  const lateSubRes = await fetch(`${baseUrl}/api/submissions`, {
    method: 'POST',
    body: lateFormData
  }).then(r => r.json());

  console.log(`[PASS] Ethan submission: isLate=${lateSubRes.submission.isLate}, durationMinutes=${lateSubRes.submission.lateDurationMinutes}, message="${lateSubRes.message}"`);
  if (lateSubRes.submission.isLate !== true) {
    throw new Error('Expected submission to be LATE but got isLate=false');
  }

  // 5. Faculty views assignment: checks submitted, late and missing lists
  const detailRes = await fetch(`${baseUrl}/api/assignments/${asgId}`).then(r => r.json());
  console.log(`[PASS] Assignment Roster Counts: Total Enrolled=${detailRes.counts.totalEnrolled}, Submitted=${detailRes.counts.submitted}, OnTime=${detailRes.counts.onTime}, Late=${detailRes.counts.late}, Missing=${detailRes.counts.missing}`);
  
  if (detailRes.counts.onTime !== 1 || detailRes.counts.late !== 1) {
    throw new Error('Mismatch in onTime or late counts');
  }

  // 6. Faculty awards marks & remarks to Charlie (stu_3)
  const charlieSubId = onTimeSubRes.submission.id;
  const gradeRes = await fetch(`${baseUrl}/api/submissions/${charlieSubId}/grade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      marks: 95,
      remarks: 'Flawless microservices configuration and tests! Well done.',
      gradedBy: 'Prof. Alan Turing'
    })
  }).then(r => r.json());

  console.log(`[PASS] Faculty awarded marks: ${gradeRes.submission.grade.marks}/100, remarks="${gradeRes.submission.grade.remarks}"`);

  // 7. Verify Student view reflects awarded marks and remarks immediately
  const studentCheckRes = await fetch(`${baseUrl}/api/assignments?studentId=stu_3`).then(r => r.json());
  const charlieAsg = studentCheckRes.assignments.find(a => a.id === asgId);
  console.log(`[PASS] Student sees awarded marks: ${charlieAsg.mySubmission.grade.marks} and remarks: "${charlieAsg.mySubmission.grade.remarks}"`);

  if (charlieAsg.mySubmission.grade.marks !== 95) {
    throw new Error('Student did not see awarded marks!');
  }

  // Clean up test file
  if (fs.existsSync(dummyFilePath)) fs.unlinkSync(dummyFilePath);

  console.log('\n=======================================================');
  console.log('ALL REQUIREMENTS FULLY TESTED & VERIFIED SUCCESSFULLY!');
  console.log('=======================================================');
}

runTests().catch(err => {
  console.error('[FAIL] Test failed:', err);
  process.exit(1);
});
