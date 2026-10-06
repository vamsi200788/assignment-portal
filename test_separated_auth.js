async function testSeparatedAuth() {
  console.log('>>> Testing Separated Student and Professor Portal Logins & Registration...\n');
  const baseUrl = 'http://localhost:5000';

  // 1. TEST STUDENT REGISTRATION
  console.log('--- 1. Testing Student Registration ---');
  const stuRegPayload = {
    name: 'Samantha Reed',
    rollNo: 'CS2026-077',
    department: 'Computer Science',
    email: `samantha_${Date.now()}@student.edu`,
    password: 'password123',
    role: 'student'
  };

  const stuRegRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stuRegPayload)
  }).then(r => r.json());

  console.log('[PASS] Student registered:', stuRegRes.user.name, 'Roll:', stuRegRes.user.rollNo, 'Role:', stuRegRes.user.role);
  if (stuRegRes.user.role !== 'student' || stuRegRes.user.rollNo !== 'CS2026-077') {
    throw new Error('Student registration failed verification');
  }

  // 2. TEST STUDENT LOGIN VIA EMAIL & ROLL NUMBER
  console.log('\n--- 2. Testing Student Login & Cross-Role Protection ---');
  const stuEmailLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: stuRegPayload.email,
      password: 'password123',
      expectedRole: 'student'
    })
  }).then(r => r.json());
  console.log('[PASS] Student login with email successful:', stuEmailLogin.user.name);

  const stuRollLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'CS2026-077',
      password: 'password123',
      expectedRole: 'student'
    })
  }).then(r => r.json());
  console.log('[PASS] Student login with Roll Number successful:', stuRollLogin.user.name);

  // Cross-role attempt: Faculty logging in through Student portal
  const crossStuAttempt = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'turing@university.edu',
      password: 'password123',
      expectedRole: 'student'
    })
  });
  const crossStuData = await crossStuAttempt.json();
  console.log('[PASS] Cross-role rejection (Faculty trying Student portal): Status =', crossStuAttempt.status, 'Message =', crossStuData.message);
  if (crossStuAttempt.status !== 403) {
    throw new Error('Expected 403 Forbidden for cross-role login');
  }

  // 3. TEST PROFESSOR REGISTRATION
  console.log('\n--- 3. Testing Professor Registration ---');
  const profRegPayload = {
    name: 'Prof. Claude Shannon',
    facultyId: 'FAC-991',
    department: 'Information Theory & Systems',
    email: `shannon_${Date.now()}@university.edu`,
    password: 'password123',
    role: 'faculty'
  };

  const profRegRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profRegPayload)
  }).then(r => r.json());

  console.log('[PASS] Professor registered:', profRegRes.user.name, 'Faculty ID:', profRegRes.user.facultyId, 'Role:', profRegRes.user.role);
  if (profRegRes.user.role !== 'faculty' || profRegRes.user.facultyId !== 'FAC-991') {
    throw new Error('Professor registration failed verification');
  }

  // 4. TEST PROFESSOR LOGIN & CROSS-ROLE REJECTION
  console.log('\n--- 4. Testing Professor Login & Cross-Role Protection ---');
  const profLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: profRegPayload.email,
      password: 'password123',
      expectedRole: 'faculty'
    })
  }).then(r => r.json());
  console.log('[PASS] Professor login successful:', profLogin.user.name);

  // Cross-role attempt: Student logging in through Professor portal
  const crossProfAttempt = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alice@student.edu',
      password: 'password123',
      expectedRole: 'faculty'
    })
  });
  const crossProfData = await crossProfAttempt.json();
  console.log('[PASS] Cross-role rejection (Student trying Professor portal): Status =', crossProfAttempt.status, 'Message =', crossProfData.message);
  if (crossProfAttempt.status !== 403) {
    throw new Error('Expected 403 Forbidden for cross-role login');
  }

  console.log('\n================================================================');
  console.log('ALL SEPARATED LOGIN & REGISTRATION CHECKS PASSED SUCCESSFULLY!');
  console.log('================================================================');
}

testSeparatedAuth().catch(err => {
  console.error('[FAIL]', err);
  process.exit(1);
});
