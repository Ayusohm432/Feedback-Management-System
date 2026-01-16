/**
 * js/admin.js
 * Logic for Admin Dashboard - Stats, User Management, Approvals, Analytics, Rosters, Feedback
 */

// --- Global Data Cache ---
let allPendingUsers = [];
let allStudents = [];
let allTeachers = []; // Crucial for Feedback Filtering
let allDepartments = [];

// --- Tab Switching Logic ---
function switchTab(tabName, linkEl) {
    document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));
    linkEl.classList.add('active');
    document.querySelectorAll('.tab-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');

    // Title Map
    const map = {
        'dashboard': 'Overview',
        'analytics': 'Analytics & Reports',
        'feedback': 'Feedback Explorer',
        'approvals': 'Pending Requests',
        'students': 'Student Management',
        'teachers': 'Teacher Management',
        'departments': 'Department Management',
        'profile': 'My Profile'
    };
    document.getElementById('pageTitle').innerText = map[tabName] || 'Dashboard';

    if (tabName === 'dashboard') { loadStats(); loadActivityFeed(); }
    if (tabName === 'analytics') loadAnalytics();
    if (tabName === 'feedback') {
        // Populate filters if needed, then load
        if (allTeachers.length === 0) {
            // If not cached yet, fetch then populate
            db.collection('users').where('role', '==', 'teacher').get().then(snap => {
                snap.forEach(doc => allTeachers.push({ id: doc.id, ...doc.data() }));
                populateFeedbackFilters();
                loadFeedbackExplorer();
            });
        } else {
            populateFeedbackFilters();
            loadFeedbackExplorer();
        }
    }
    if (tabName === 'approvals') loadApprovals();
    if (tabName === 'students') loadUserTable('student', 'students-table-container');
    if (tabName === 'teachers') loadUserTable('teacher', 'teachers-table-container');
    if (tabName === 'departments') loadUserTable('department', 'departments-table-container');
    if (tabName === 'profile') loadProfile();
}

// --- 1. Real-time Stats & Activity ---
function loadStats() {
    db.collection('users').onSnapshot(snap => {
        let students = 0, teachers = 0, depts = 0, pending = 0;
        snap.forEach(doc => {
            const u = doc.data();
            if (u.status === 'pending') pending++;
            else {
                if (u.role === 'student') students++;
                if (u.role === 'teacher') teachers++;
                if (u.role === 'department') depts++;
            }
        });
        document.getElementById('count-student').innerText = students;
        document.getElementById('count-teacher').innerText = teachers;
        document.getElementById('count-dept').innerText = depts;
        document.getElementById('count-pending').innerText = pending;
    });
}
function loadActivityFeed() {
    const feed = document.getElementById('activity-feed');
    db.collection('users').orderBy('createdAt', 'desc').limit(5).get().then(snap => {
        if (snap.empty) { feed.innerHTML = "No recent activity."; return; }
        feed.innerHTML = "";
        snap.forEach(doc => {
            const u = doc.data();
            const date = u.createdAt ? new Date(u.createdAt.seconds * 1000).toLocaleDateString() : 'Recently';
            let icon = 'ri-notification-line';
            let color = '#666';
            let bg = '#f1f5f9';

            if (u.role === 'student') { icon = 'ri-user-smile-line'; color = '#2563eb'; bg = '#dbeafe'; }
            if (u.role === 'teacher') { icon = 'ri-user-star-line'; color = '#9333ea'; bg = '#f3e8ff'; }
            if (u.role === 'department') { icon = 'ri-building-line'; color = '#ea580c'; bg = '#ffedd5'; }

            const html = `
            <div class="activity-item">
                <div class="activity-icon" style="background:${bg}; color:${color};">
                    <i class="${icon}"></i>
                </div>
                <div>
                    <div style="font-size:0.95rem; font-weight:500;">New ${u.role} Registration</div>
                    <div style="font-size:0.85em; color:#666;">${u.name} joined.</div>
                    <small style="color:#999; font-size:0.75em;">${date}</small>
                </div>
            </div>`;
            feed.insertAdjacentHTML('beforeend', html);
        });
    });
}

// --- 2. Analytics (Charts) ---
let deptChartInstance = null;
let partChartInstance = null;
async function loadAnalytics() {
    const feedbackSnap = await db.collection('feedback').get();
    const deptRatings = {};
    const ratingDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const dateTrend = {};

    feedbackSnap.forEach(doc => {
        const d = doc.data();
        // Avg Calculation
        let dept = d.department || 'General';
        if (!deptRatings[dept]) deptRatings[dept] = [];
        deptRatings[dept].push(Number(d.rating));

        // Distribution
        let r = Math.round(Number(d.rating));
        if (r < 1) r = 1; if (r > 5) r = 5;
        ratingDist[r]++;

        // Trend (Group by Date)
        if (d.submitted_at) {
            const dateKey = new Date(d.submitted_at.seconds * 1000).toLocaleDateString(); // e.g., "1/10/2026"
            dateTrend[dateKey] = (dateTrend[dateKey] || 0) + 1;
        }
    });

    // 1. Dept Performance
    const labels = Object.keys(deptRatings);
    const data = labels.map(dept => {
        const ratings = deptRatings[dept];
        return (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);
    });

    if (deptChartInstance) deptChartInstance.destroy();
    deptChartInstance = new Chart(document.getElementById('deptChart').getContext('2d'), {
        type: 'bar',
        data: { labels: labels.length ? labels : ['No Data'], datasets: [{ label: 'Avg Rating', data: data.length ? data : [0], backgroundColor: 'rgba(59, 130, 246, 0.5)', borderColor: 'rgb(59, 130, 246)', borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 5 } } }
    });

    // 2. Participation (Mock vs Real ratio if possible, or keep as is)
    if (partChartInstance) partChartInstance.destroy();
    partChartInstance = new Chart(document.getElementById('participationChart').getContext('2d'), {
        type: 'doughnut',
        data: { labels: ['Submitted', 'Pending'], datasets: [{ data: [feedbackSnap.size, Math.max(0, 100 - feedbackSnap.size)], backgroundColor: ['#10b981', '#e5e7eb'] }] },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // 3. Rating Distribution
    const distData = [ratingDist[1], ratingDist[2], ratingDist[3], ratingDist[4], ratingDist[5]];
    const ctx3 = document.getElementById('ratingDistChart').getContext('2d');
    if (window.ratingDistInstance) window.ratingDistInstance.destroy();
    window.ratingDistInstance = new Chart(ctx3, {
        type: 'polarArea',
        data: {
            labels: ['1 Star', '2 Stars', '3 Stars', '4 Stars', '5 Stars'],
            datasets: [{
                data: distData,
                backgroundColor: ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // 4. Trend
    const sortedDates = Object.keys(dateTrend).sort((a, b) => new Date(a) - new Date(b)).slice(-7); // Last 7 recorded days
    const trendData = sortedDates.map(d => dateTrend[d]);
    const ctx4 = document.getElementById('feedbackTrendChart').getContext('2d');
    if (window.trendInstance) window.trendInstance.destroy();
    window.trendInstance = new Chart(ctx4, {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [{
                label: 'Submissions',
                data: trendData,
                borderColor: '#6366f1',
                tension: 0.3,
                fill: true,
                backgroundColor: 'rgba(99, 102, 241, 0.1)'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { set: 1 } } } }
    });
}

// --- 3. User Tables & Search & Review Control ---
function loadUserTable(role, containerId) {
    const container = document.getElementById(containerId);
    db.collection('users').where('role', '==', role).where('status', '==', 'approved').onSnapshot(snap => {
        let users = [];
        snap.forEach(doc => users.push({ id: doc.id, ...doc.data() }));
        if (role === 'student') { allStudents = users; updateStudentDeptDropdown(users); filterStudentList(); }
        if (role === 'teacher') { allTeachers = users; updateDeptDropdown(users); filterTeacherList(); }
        if (role === 'department') { allDepartments = users; updateDeptFilterDropdowns(users); filterDepartmentList(); }
    });
}

// User Filters (Same as before)
function updateStudentDeptDropdown(students) {
    const depts = [...new Set(students.map(s => s.department || 'General'))];
    const sel = document.getElementById('studentDeptFilter');
    const curr = sel.value;
    sel.innerHTML = '<option value="all">All Departments</option>';
    depts.forEach(d => sel.innerHTML += `<option value="${d}">${d}</option>`);
    if (depts.includes(curr)) sel.value = curr;
}
function filterStudentList() {
    const filterDept = document.getElementById('studentDeptFilter').value;
    const filterDegree = document.getElementById('studentDegreeFilter').value;
    const filterSem = document.getElementById('studentSemFilter').value;
    const container = document.getElementById('students-table-container');

    let filtered = allStudents;

    if (filterDept !== 'all') {
        filtered = filtered.filter(s => (s.department || 'General') === filterDept);
    }
    if (filterDegree !== 'all') {
        filtered = filtered.filter(s => (s.degree || 'B.Tech') === filterDegree);
    }
    if (filterSem !== 'all') {
        filtered = filtered.filter(s => (s.semester || '1').toString() === filterSem);
    }

    renderUserTable(filtered, 'student', container);
}
function updateDeptDropdown(teachers) {
    const depts = [...new Set(teachers.map(t => t.department || 'General'))];
    const sel = document.getElementById('teacherDeptFilter');
    const curr = sel.value;
    sel.innerHTML = '<option value="all">All Departments</option>';
    depts.forEach(d => sel.innerHTML += `<option value="${d}">${d}</option>`);
    if (depts.includes(curr)) sel.value = curr;
}
function filterTeacherList() {
    const filter = document.getElementById('teacherDeptFilter').value;
    const container = document.getElementById('teachers-table-container');
    if (filter === 'all') renderUserTable(allTeachers, 'teacher', container);
    else renderUserTable(allTeachers.filter(t => (t.department || 'General') === filter), 'teacher', container);
}

function updateDeptFilterDropdowns(departments) {
    const names = [...new Set(departments.map(d => d.name))];
    const sessions = [...new Set(departments.map(d => d.session || ''))].filter(s => s);

    const nameSel = document.getElementById('deptFilterName');
    const sessSel = document.getElementById('deptFilterSession');

    // Save current selection
    const currName = nameSel.value;
    const currSess = sessSel.value;

    nameSel.innerHTML = '<option value="all">All Departments</option>';
    names.forEach(n => nameSel.innerHTML += `<option value="${n}">${n}</option>`);

    sessSel.innerHTML = '<option value="all">All Sessions</option>';
    sessions.forEach(s => sessSel.innerHTML += `<option value="${s}">${s}</option>`);

    // Restore selection if valid
    if (names.includes(currName)) nameSel.value = currName;
    if (sessions.includes(currSess)) sessSel.value = currSess;
}

function filterDepartmentList() {
    const filterName = document.getElementById('deptFilterName').value;
    const filterSession = document.getElementById('deptFilterSession').value;
    const container = document.getElementById('departments-table-container');

    let filtered = allDepartments;

    if (filterName !== 'all') {
        filtered = filtered.filter(d => d.name === filterName);
    }
    if (filterSession !== 'all') {
        filtered = filtered.filter(d => (d.session || '') === filterSession);
    }

    renderUserTable(filtered, 'department', container);
}
function renderUserTable(users, role, container) {
    if (users.length === 0) { container.innerHTML = "No users found."; return; }
    let headers = [];
    if (role === 'student') headers = ['<input type="checkbox" onchange="toggleAllStudents(this)">', 'Name', 'Email', 'Reg No', 'Dept', 'Degree - Sem', 'Session'];
    else headers = ['Name', 'Email'];

    if (role === 'department') headers.push('Dept ID', 'Name', 'Session');
    if (role === 'teacher') headers.push('Dept', 'Review Status', 'Subjects');

    let html = `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
    users.forEach(u => {
        const degreeInfo = role === 'student' ? `${u.degree || 'B.Tech'} - S${u.semester || '1'}` : '';

        html += `<tr>
            ${role === 'student' ? `
                <td><input type="checkbox" class="student-checkbox" value="${u.id}"></td>
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td>${u.regNum || '-'}</td>
                <td>${u.department || 'General'}</td>
                <td>${degreeInfo}</td>
                <td>${u.session || '-'}</td>` : `
                <td>${u.name}</td>
                <td>${u.email}</td>
            `}
            ${role === 'department' ? `<td>${u.deptId || '-'}</td><td>${u.name}</td><td>${(u.sessionsList && u.sessionsList.length > 0)
                ? u.sessionsList.map(s => `<span style="color: #000;">${s.name}</span>`).join(', ')
                : (u.session || '-')
                }</td>` : ''}
            ${role === 'teacher' ? `<td>${u.department || 'General'}</td><td><label class="switch"><input type="checkbox" ${u.isReviewOpen ? 'checked' : ''} onchange="toggleReviewStatus('${u.id}', this.checked)"><span class="slider round"></span></label><span style="font-size:0.8em; margin-left:0.5rem; color:${u.isReviewOpen ? '#16a34a' : '#999'}">${u.isReviewOpen ? 'Open' : 'Closed'}</span></td><td><button class="btn btn-sm btn-outline" onclick="openSubjectModal('${u.id}')">Manage</button></td>` : ''}
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}
window.toggleReviewStatus = async (uid, isOpen) => { try { await db.collection('users').doc(uid).update({ isReviewOpen: isOpen }); } catch (e) { console.error(e); } };
function handleGlobalSearch(query) {
    const term = query.toLowerCase();
    if (document.getElementById('tab-students').classList.contains('active')) {
        renderUserTable(allStudents.filter(u => u.name.toLowerCase().includes(term) || u.email.includes(term)), 'student', document.getElementById('students-table-container'));
    }
}
async function createUserInSecondaryApp(email, password) {
    const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
    try { const userCred = await secondaryApp.auth().createUserWithEmailAndPassword(email, password); const uid = userCred.user.uid; await secondaryApp.delete(); return uid; } catch (err) { await secondaryApp.delete(); throw err; }
}
// --- Validation Logic ---
const VALIDATORS = {
    regNum: (val) => /^\d{11}$/.test(val) || "Registration Number must be 11 digits.",
    deptCode: (val) => /^\d{3}$/.test(val) || "Department Code must be 3 digits.",
    deptCode: (val) => /^\d{3}$/.test(val) || "Department Code must be 3 digits.",
    password: (val) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(val) || "Password too weak. (Min 8 chars, Upper, Lower, Num, Special)",
    session: (val) => {
        if (!/^\d{4}-\d{2}$/.test(val)) return "Session format: YYYY-YY (e.g. 2023-27)";
        const [y, yy] = val.split('-').map(Number);
        const startYY = y % 100;
        return (yy === startYY + 4) || "Session duration must be 4 years.";
    }
};

async function handleAddSingleStudent(e) {
    e.preventDefault();
    const reg = document.getElementById('addRegNum').value;
    const name = document.getElementById('addName').value;
    const dept = document.getElementById('addDept').value; // Returns ID (105)
    // Dept Check (Dropdown ensures valid ID, but good to be safe)

    const session = document.getElementById('addSession').value;
    const pass = document.getElementById('addPassword').value;
    const degree = document.getElementById('addDegree').value;
    const semester = document.getElementById('addSemester').value;
    const email = `${reg}@student.fms.local`;

    try {
        // Validation
        // Validation
        const vReg = VALIDATORS.regNum(reg); if (vReg !== true) throw new Error(vReg);
        const vSess = VALIDATORS.session(session); if (vSess !== true) throw new Error(vSess);
        const vPass = VALIDATORS.password(pass); if (vPass !== true) throw new Error(vPass);

        // Check Duplicates
        const dupReg = await db.collection('users').where('regNum', '==', reg).get();
        if (!dupReg.empty) throw new Error("Student with this Register Number already exists.");

        const dupEmail = await db.collection('users').where('email', '==', email).get();
        if (!dupEmail.empty) throw new Error("User with this Email already exists.");

        const uid = await createUserInSecondaryApp(email, pass);
        await db.collection('users').doc(uid).set({
            uid: uid, name: name, email: email, role: 'student', status: 'approved',
            regNum: reg, department: dept, session: session,
            degree: degree, semester: semester || '1',
            year: Math.ceil((semester || 1) / 2).toString(), // Compat
            createdAt: new Date()
        });
        alert(`Student Created!`); e.target.reset();
        // Reset Semester dropdown
        document.getElementById('addSemester').innerHTML = '<option value="" disabled selected>Sem</option>';
    } catch (err) { alert("Error: " + err.message); }
}

async function handleBulkUpload() {
    const file = document.getElementById('csvFile').files[0]; if (!file) return alert("Select file first");
    Papa.parse(file, {
        header: true, complete: async function (results) {
            let count = 0;
            for (let row of results.data) {
                if (row.student_id && row.password) {
                    try {
                        const email = `${row.student_id}@student.fms.local`;
                        const uid = await createUserInSecondaryApp(email, row.password);
                        await db.collection('users').doc(uid).set({
                            uid: uid, name: row.name, email: email, role: 'student', status: 'approved',
                            regNum: row.student_id, department: row.department, session: row.session,
                            degree: row.degree || 'B.Tech', semester: row.semester || '1',
                            year: Math.ceil((row.semester || 1) / 2).toString(),
                            createdAt: new Date()
                        });
                        count++;
                    } catch (err) { }
                }
            }
            alert(`Successfully created ${count} users.`);
        }
    });
}

function downloadSample() { const csvContent = "data:text/csv;charset=utf-8," + "student_id,name,department,session,password\n2024001,John Doe,CSE,2023-27,password123"; const link = document.createElement("a"); link.href = encodeURI(csvContent); link.download = "student_full_import.csv"; document.body.appendChild(link); link.click(); }

async function handleAddSingleTeacher(e) {
    e.preventDefault();
    const name = document.getElementById('addTeacherName').value;
    const email = document.getElementById('addTeacherEmail').value;
    const dept = document.getElementById('addTeacherDept').value;
    const pass = document.getElementById('addTeacherPassword').value;

    try {
        const vPass = VALIDATORS.password(pass); if (vPass !== true) throw new Error(vPass);
        const vDept = VALIDATORS.deptCode(dept); if (vDept !== true) throw new Error(vDept);

        // Check Duplicate
        const dupEmail = await db.collection('users').where('email', '==', email).get();
        if (!dupEmail.empty) throw new Error("Teacher with this Email already exists.");

        const uid = await createUserInSecondaryApp(email, pass);
        await db.collection('users').doc(uid).set({
            uid: uid, name: name, email: email, role: 'teacher', status: 'approved',
            department: dept, isReviewOpen: false, createdAt: new Date()
        });
        alert(`Teacher Created!`); e.target.reset();
    } catch (err) { alert("Error: " + err.message); }
}

async function handleBulkTeacherUpload() { const file = document.getElementById('teacherCsvFile').files[0]; if (!file) return alert("Select file first"); Papa.parse(file, { header: true, complete: async function (results) { let count = 0; for (let row of results.data) { if (row.email && row.password) { try { const uid = await createUserInSecondaryApp(row.email, row.password); await db.collection('users').doc(uid).set({ uid: uid, name: row.name, email: row.email, role: 'teacher', status: 'approved', department: row.department, isReviewOpen: false, createdAt: new Date() }); count++; } catch (err) { } } } alert(`Created ${count} teachers.`); } }); }
function downloadTeacherSample() { const csvContent = "data:text/csv;charset=utf-8," + "name,email,department,password\nDr. Smith,smith@clg.edu,CSE,securepass"; const link = document.createElement("a"); link.href = encodeURI(csvContent); link.download = "teacher_full_import.csv"; document.body.appendChild(link); link.click(); }

async function handleAddSingleDept(e) {
    e.preventDefault();
    const id = document.getElementById('addDeptId').value;
    const name = document.getElementById('addDeptName').value.toUpperCase();
    const session = document.getElementById('addDeptSession').value;
    const pass = document.getElementById('addDeptPassword').value;
    const email = `${id}@dept.fms.local`;

    try {
        const vCode = VALIDATORS.deptCode(id); if (vCode !== true) throw new Error(vCode);
        // const vName = VALIDATORS.deptEnum(name); if (vName !== true) throw new Error(vName);
        const vSess = VALIDATORS.session(session); if (vSess !== true) throw new Error(vSess);

        const vPass = VALIDATORS.password(pass); if (vPass !== true) throw new Error(vPass);

        // Check Duplicate
        const dupId = await db.collection('users').where('deptId', '==', id).get();
        if (!dupId.empty) throw new Error("Department with this ID already exists.");

        const dupEmail = await db.collection('users').where('email', '==', email).get();
        if (!dupEmail.empty) throw new Error("Department with this Email already exists.");

        const uid = await createUserInSecondaryApp(email, pass);
        await db.collection('users').doc(uid).set({
            uid: uid, name: name, email: email, role: 'department', status: 'approved',
            deptId: id, session: session, createdAt: new Date()
        });
        alert("Department Account Created."); e.target.reset();
    } catch (e) { alert("Error: " + e.message); }
}
function loadApprovals() { const listContainer = document.getElementById('approvals-list-container'); listContainer.innerHTML = 'Loading...'; db.collection('users').where('status', '==', 'pending').onSnapshot(snap => { allPendingUsers = []; snap.forEach(doc => allPendingUsers.push({ id: doc.id, ...doc.data() })); renderApprovals('all'); }); }
function filterApprovals(role, tabEl) { document.querySelectorAll('.sub-tab').forEach(el => el.classList.remove('active')); tabEl.classList.add('active'); renderApprovals(role); }
function renderApprovals(filterRole) { const container = document.getElementById('approvals-list-container'); const filtered = filterRole === 'all' ? allPendingUsers : allPendingUsers.filter(u => u.role === filterRole); if (filtered.length === 0) { container.innerHTML = `<p style="padding:1rem;">No pending requests for ${filterRole}.</p>`; return; } let html = '<table class="w-full"><thead><tr><th>Name</th><th>Role</th><th>Info</th><th>Actions</th></tr></thead><tbody>'; filtered.forEach(u => { html += `<tr><td><strong>${u.name}</strong><br><small>${u.email}</small></td><td><span class="pill pill-pending">${u.role.toUpperCase()}</span></td><td>${u.role === 'student' ? u.regNum : (u.deptId || 'N/A')}</td><td><button class="btn btn-primary" onclick="approveUser('${u.id}')">Approve</button> <button class="btn btn-outline" onclick="rejectUser('${u.id}')">Reject</button></td></tr>`; }); html += '</tbody></table>'; container.innerHTML = html; }
window.approveUser = async (uid) => {
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (!userDoc.exists) return;
        const u = userDoc.data();

        if (u.role === 'student' && u.department && u.session && u.degree) {
            const deptId = u.department;
            // Find Department User Doc (Query by deptId field or iterate? Depts are Users with role='department' and deptId=...)
            // Actually, we need the doc ID of the department user to update it.
            // Let's query:
            const deptSnap = await db.collection('users').where('role', '==', 'department').where('deptId', '==', deptId).limit(1).get();

            if (!deptSnap.empty) {
                const deptDocRef = deptSnap.docs[0].ref;
                const deptData = deptSnap.docs[0].data();
                let sessions = deptData.sessionsList || [];

                // Check if session exists
                // We match Name AND Degree.
                const exists = sessions.find(s => s.name === u.session && s.degree === u.degree);

                if (!exists) {
                    // Auto-create session
                    console.log(`Auto-creating session ${u.session} (${u.degree}) for Dept ${deptId}`);
                    sessions.push({
                        name: u.session,
                        degree: u.degree,
                        isActive: false // Default to Inactive? Or Active? User said "so that student can be directly linked". 
                        // If we just add it to list, they are linked by string. 
                    });
                    await deptDocRef.update({ sessionsList: sessions });
                }
            }
        }

        await db.collection('users').doc(uid).update({ status: 'approved' });
        loadApprovals(); // Refresh UI
    } catch (e) { console.error(e); alert("Error approving user: " + e.message); }
};
window.rejectUser = async (uid) => { if (!confirm("Permantently remove this request?")) return; try { await db.collection('users').doc(uid).delete(); } catch (e) { console.error(e); } };
async function loadProfile() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    // 1. Auth Details (Tab & Header)
    if (document.getElementById('profile-email')) document.getElementById('profile-email').innerText = user.email;
    if (document.getElementById('profile-uid')) document.getElementById('profile-uid').innerText = user.uid;
    if (document.getElementById('top-bar-email')) document.getElementById('top-bar-email').innerText = user.email;

    if (user.metadata) {
        if (document.getElementById('profile-joined')) document.getElementById('profile-joined').innerText = new Date(user.metadata.creationTime).toLocaleDateString();
        if (document.getElementById('profile-last-login')) document.getElementById('profile-last-login').innerText = new Date(user.metadata.lastSignInTime).toLocaleString();
    }

    // 2. Firestore Details
    try {
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists) {
            const data = doc.data();
            const name = data.name || "Admin User";

            // Update Profile Tab
            if (document.getElementById('profile-name')) document.getElementById('profile-name').innerText = name;
            if (document.getElementById('profile-role')) document.getElementById('profile-role').innerText = (data.role || 'ADMIN').toUpperCase();
            if (document.getElementById('profile-status')) document.getElementById('profile-status').innerText = (data.status || 'Active');

            // Update Top Bar
            if (document.getElementById('top-bar-name')) document.getElementById('top-bar-name').innerText = name;

            // Update Avatars (Both Tab and Header)
            const initial = name.charAt(0);
            const avatarUrl = `https://ui-avatars.com/api/?name=${initial}&background=0D8ABC&color=fff&size=128`;
            if (document.getElementById('profile-avatar')) document.getElementById('profile-avatar').src = avatarUrl;
            if (document.getElementById('top-bar-avatar')) document.getElementById('top-bar-avatar').src = avatarUrl;

            // Pre-fill Edit Form
            if (document.getElementById('editProfileName')) document.getElementById('editProfileName').value = name;
        }
    } catch (err) {
        console.error("Profile Load Error", err);
    }
}
async function handleUpdateProfile(e) { e.preventDefault(); const newName = document.getElementById('editProfileName').value; const user = firebase.auth().currentUser; try { await db.collection('users').doc(user.uid).update({ name: newName }); document.getElementById('profile-name').innerText = newName; document.getElementById('profile-avatar').src = `https://ui-avatars.com/api/?name=${newName.charAt(0)}&background=0D8ABC&color=fff&size=128`; alert("Profile Updated!"); } catch (err) { console.error(err); alert("Error updating profile."); } }

// --- 6. ADVANCED FEEDBACK EXPLORER ---

// Populate Dropdowns for Filtering
function populateFeedbackFilters() {
    // Departments
    const depts = [...new Set(allTeachers.map(t => t.department || 'General'))];
    const deptSel = document.getElementById('fbFilterDept');
    if (deptSel.options.length === 1) { // Prevents duplicates if run multiple times
        depts.forEach(d => deptSel.innerHTML += `<option value="${d}">${d}</option>`);
    }

    // Teachers (Should ideally be dependent on Dept, but listings all is fine for now)
    const teacherSel = document.getElementById('fbFilterTeacher');
    if (teacherSel.options.length === 1) {
        allTeachers.forEach(t => {
            teacherSel.innerHTML += `<option value="${t.id}">${t.name} (${t.department || 'Gen'})</option>`;
        });
    }
}

async function loadFeedbackExplorer() {
    const filterRating = document.getElementById('fbFilterRating').value;
    const filterDept = document.getElementById('fbFilterDept').value;
    const filterTeacher = document.getElementById('fbFilterTeacher').value;
    const filterDegree = document.getElementById('fbFilterDegree') ? document.getElementById('fbFilterDegree').value : 'all';
    const filterSem = document.getElementById('fbFilterSemester') ? document.getElementById('fbFilterSemester').value : 'all';
    const container = document.getElementById('feedback-explorer-container');
    container.innerHTML = '<p class="text-gray-500">Loading filters...</p>';

    // Fetch Last 200 Feedbacks (To act as a safe buffer for Client-Side Filtering)
    let query = db.collection('feedback').orderBy('submitted_at', 'desc').limit(200);

    try {
        const snap = await query.get();
        if (snap.empty) {
            container.innerHTML = '<p class="text-gray-500 col-span-full">No feedback records found.</p>';
            return;
        }

        let html = '';
        let count = 0;

        snap.forEach(doc => {
            const data = doc.data();

            // --- CLIENT-SIDE FILTERING ---
            let show = true;

            if (filterRating === 'low' && data.rating >= 3) show = false;
            if (filterRating === 'high' && data.rating <= 3) show = false;
            if (filterDegree !== 'all' && (data.degree || 'B.Tech') !== filterDegree) show = false;
            if (filterSem !== 'all' && (data.semester || '1').toString() !== filterSem) show = false;

            // 2. Department
            if (filterDept !== 'all') {
                // If feedback has dept data, use it. Else try to match teacher's dept?
                // Assuming feedback stores 'department' (added in student.html update)
                if ((data.department || 'General') !== filterDept) show = false;
            }

            // 3. Teacher
            if (filterTeacher !== 'all') {
                if (data.teacher_id !== filterTeacher) show = false;
            }

            if (show) {
                count++;
                const date = data.submitted_at ? new Date(data.submitted_at.seconds * 1000).toLocaleDateString() : 'N/A';
                const stars = '★'.repeat(data.rating) + '☆'.repeat(5 - data.rating);
                // Color Logic
                let colorClass = '#f59e0b'; // yellow
                let statusClass = 'neutral';
                if (data.rating <= 2) { colorClass = '#ef4444'; statusClass = 'negative'; }
                if (data.rating >= 4) { colorClass = '#10b981'; statusClass = 'positive'; }

                // Find Teacher Name (if not in feedback, look up in cache)
                let teacherName = "Unknown Teacher";
                if (allTeachers) {
                    const t = allTeachers.find(u => u.id === data.teacher_id);
                    if (t) teacherName = t.name;
                }

                html += `
                    <div class="feedback-card ${statusClass}">
                        <div class="feedback-header">
                            <div style="display:flex; align-items:center; gap:0.5rem;">
                                <img src="https://ui-avatars.com/api/?name=${teacherName}&background=random&size=32" style="width:32px; height:32px; border-radius:50%;">
                                <div style="line-height:1.2;">
                                    <div style="font-weight:600; font-size:0.95rem;">${teacherName}</div>
                                    <div style="font-size:0.75rem; color:#666;">${data.department || 'Gen'}</div>
                                </div>
                            </div>
                            <span class="rating-badge" style="background:${colorClass}20; color:${colorClass}">${data.rating} ★</span>
                        </div>
                        <div class="feedback-body">
                            <h4 style="margin-bottom:0.5rem; font-size:1em; color:#1e293b;">${data.subject || 'General'}</h4>
                            <p style="color:#475569; font-size:0.95em; line-height:1.5;">"${data.comments || ''}"</p>
                        </div>
                        <div class="feedback-footer">
                            <span><i class="ri-calendar-line"></i> ${date}</span>
                            <span>${data.session || '-'} | ${data.degree || 'B.Tech'} S${data.semester || '-'}</span>
                        </div>
                    </div>
                `;
            }
        });

        if (count === 0) {
            container.innerHTML = `<p style="color:#666; grid-column: 1/-1; text-align:center; padding:2rem;">No feedback matches the selected filters.</p>`;
        } else {
            container.innerHTML = html;
        }

    } catch (err) {
        console.error("Feedback Load Error", err);
        container.innerHTML = `<p style="color: red;">Error loading feedback.</p>`;
    }
}
let currentManageTeacherId = null;

// Safe lookup for teacher name
async function openSubjectModal(teacherId) {
    currentManageTeacherId = teacherId;
    document.getElementById('subjectModal').classList.add('active');

    // Find teacher name from loaded data if possible, or fetch
    let teacherName = "Teacher";
    if (typeof allTeachers !== 'undefined') {
        const t = allTeachers.find(u => u.id === teacherId);
        if (t) teacherName = t.name;
    }

    document.getElementById('subjectModalSubtitle').innerText = `Assign subjects to ${teacherName}`;

    // Populate Session Dropdown
    const sessSel = document.getElementById('assignSubSession');
    sessSel.innerHTML = '<option value="">Select Session</option>';

    // Ensure departments are loaded
    if (!allDepartments || allDepartments.length === 0) {
        const snap = await db.collection('users').where('role', '==', 'department').get();
        allDepartments = [];
        snap.forEach(doc => allDepartments.push({ id: doc.id, ...doc.data() }));
    }

    if (allTeachers && allDepartments) {
        const teacher = allTeachers.find(u => u.id === teacherId);
        if (teacher && teacher.department) {
            // Find Department Doc (Match Name OR DeptId)
            const tDept = teacher.department.toString().toUpperCase();
            const deptDoc = allDepartments.find(d =>
                (d.name && d.name.toUpperCase() === tDept) ||
                (d.deptId && d.deptId.toString() === tDept)
            );

            if (deptDoc) {
                const sessions = deptDoc.sessionsList || [];
                if (deptDoc.session && !sessions.find(s => s.name === deptDoc.session)) {
                    sessions.push({ name: deptDoc.session, isActive: true });
                }

                sessions.forEach(s => {
                    sessSel.innerHTML += `<option value="${s.name}">${s.name}</option>`;
                });
            } else {
                console.warn("Department Doc not found for:", teacher.department);
            }
        }
    }

    loadAssignedSubjects(teacherId);
}
// kept previous close function
function closeSubjectModal() {
    document.getElementById('subjectModal').classList.remove('active');
    currentManageTeacherId = null;
}

async function loadAssignedSubjects(teacherId) {
    const list = document.getElementById('assigned-subjects-list');
    list.innerHTML = 'Loading...';
    try {
        const doc = await db.collection('users').doc(teacherId).get();
        if (doc.exists) {
            const subjects = doc.data().assignedSubjects || [];
            if (subjects.length === 0) {
                list.innerHTML = '<p style="padding:1rem; color:#999; text-align:center;">No subjects assigned.</p>';
                return;
            }
            let html = '<table style="width:100%; border-collapse:collapse;"><thead><tr style="background:#f0f0f0; text-align:left;"><th style="padding:0.5rem;">Subject</th>                        <th style="padding:0.5rem;">Degree - Sem</th><th style="padding:0.5rem;">Status</th><th style="padding:0.5rem;">Action</th></tr></thead><tbody>';
            subjects.forEach((s, index) => {
                html += `
                    <tr style="border-bottom:1px solid #eee;">
                        <td style="padding:0.5rem;">${s.name}</td>
                        <td style="padding:0.5rem;">${s.degree || 'B.Tech'} - S${s.semester} <br><small style="color:#666;">${s.session || 'All'}</small></td>
                        <td style="padding:0.5rem;">
                            <label class="switch" style="transform:scale(0.8);">
                                <input type="checkbox" ${s.isOpen ? 'checked' : ''} onchange="toggleSubjectStatus('${teacherId}', ${index}, this.checked)">
                                <span class="slider round"></span>
                            </label>
                        </td>
                        <td style="padding:0.5rem;">
                            <button onclick="deleteSubject('${teacherId}', ${index})" style="color:red; background:none; border:none; cursor:pointer;"><i class="ri-delete-bin-line"></i></button>
                        </td>
                    </tr>
                `;
            });
            html += '</tbody></table>';
            list.innerHTML = html;
        }
    } catch (err) { console.error(err); list.innerHTML = 'Error loading.'; }
}

async function handleAddSubject(e) {
    e.preventDefault();
    if (!currentManageTeacherId) return;
    const name = document.getElementById('assignSubName').value;
    const degree = document.getElementById('assignSubDegree').value;
    const sem = document.getElementById('assignSubSem').value;
    const session = document.getElementById('assignSubSession').value.trim();

    try {
        const vSess = VALIDATORS.session(session); if (vSess !== true) throw new Error(vSess);

        const docRef = db.collection('users').doc(currentManageTeacherId);
        const doc = await docRef.get();
        let subjects = doc.data().assignedSubjects || [];

        subjects.push({
            name: name,
            degree: degree,
            semester: sem,
            session: session,
            isOpen: true // Default open
        });

        await docRef.update({ assignedSubjects: subjects });
        document.getElementById('addSubjectForm').reset();
        loadAssignedSubjects(currentManageTeacherId);
    } catch (err) { alert("Error adding subject: " + err.message); }
}

async function toggleSubjectStatus(teacherId, index, status) {
    try {
        const docRef = db.collection('users').doc(teacherId);
        const doc = await docRef.get();
        let subjects = doc.data().assignedSubjects || [];
        if (subjects[index]) {
            subjects[index].isOpen = status;
            await docRef.update({ assignedSubjects: subjects });
        }
    } catch (err) { console.error(err); }
}

async function deleteSubject(teacherId, index) {
    if (!confirm("Remove this subject?")) return;
    try {
        const docRef = db.collection('users').doc(teacherId);
        const doc = await docRef.get();
        let subjects = doc.data().assignedSubjects || [];
        subjects.splice(index, 1);
        await docRef.update({ assignedSubjects: subjects });
        loadAssignedSubjects(teacherId);
    } catch (err) { alert("Error deleting: " + err.message); }
}

// Bind to window for inline calls
window.openSubjectModal = openSubjectModal;
window.closeSubjectModal = closeSubjectModal;
window.handleAddSubject = handleAddSubject;
window.toggleSubjectStatus = toggleSubjectStatus;
window.deleteSubject = deleteSubject;

// --- Student Promotion/Demotion Logic ---

window.toggleAllStudents = (source) => {
    document.querySelectorAll('.student-checkbox').forEach(cb => cb.checked = source.checked);
};

window.promoteSelectedStudents = async () => {
    const selected = Array.from(document.querySelectorAll('.student-checkbox:checked')).map(cb => cb.value);
    if (selected.length === 0) return alert("No students selected.");
    if (!confirm(`Are you sure you want to PROMOTE ${selected.length} students?`)) return;

    await processBatchUpdate(selected, 1);
};

window.demoteSelectedStudents = async () => {
    const selected = Array.from(document.querySelectorAll('.student-checkbox:checked')).map(cb => cb.value);
    if (selected.length === 0) return alert("No students selected.");
    if (!confirm(`Are you sure you want to DEMOTE ${selected.length} students?`)) return;

    await processBatchUpdate(selected, -1);
};

window.promoteAllStudents = async () => {
    // Uses current filtered list (allStudents or filtered view)
    // We can grab IDs from the DOM to respect current filter
    const visibleIds = Array.from(document.querySelectorAll('.student-checkbox')).map(cb => cb.value);
    if (visibleIds.length === 0) return alert("No students listing.");
    if (!confirm(`Are you sure you want to PROMOTE ALL ${visibleIds.length} listed students?`)) return;

    await processBatchUpdate(visibleIds, 1);
};

async function processBatchUpdate(ids, direction) {
    let successCount = 0;
    let errorCount = 0;

    for (const uid of ids) {
        try {
            // Find student data in local cache to calculate next level
            const student = allStudents.find(s => s.id === uid);
            if (!student) continue;

            const currentSem = parseInt(student.semester) || 1;
            const currentYear = parseInt(student.year) || Math.ceil(currentSem / 2);
            const degree = student.degree || 'B.Tech';

            const { newYear, newSem } = calculateNewLevel(degree, currentSem, direction);

            if (newSem !== currentSem) {
                await db.collection('users').doc(uid).update({
                    year: newYear.toString(),
                    semester: newSem.toString()
                });
                successCount++;
            }
        } catch (e) {
            console.error(e);
            errorCount++;
        }
    }

    alert(`Operation Complete.\nUpdated: ${successCount}\nFailed: ${errorCount}`);
}

function calculateNewLevel(degree, sem, direction) {
    const semInt = parseInt(sem);
    let newSem = semInt + direction;
    // Ensure SEMESTERS is defined or default to B.Tech=8, M.Tech=4
    const limits = (typeof SEMESTERS !== 'undefined') ? SEMESTERS : { 'B.Tech': 8, 'M.Tech': 4 };
    const maxSem = limits[degree] || 8;

    if (newSem > maxSem) newSem = maxSem;
    if (newSem < 1) newSem = 1;

    // Derived Year
    const newYear = Math.ceil(newSem / 2);

    return { newYear, newSem };
}

// Init
document.addEventListener('DOMContentLoaded', () => { loadStats(); loadActivityFeed(); loadProfile(); });

// --- Export Functionality ---

async function exportSystemSummaryPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Get Filter Context
    const fDegree = document.getElementById('exportFilterDegree').value;
    const fSem = document.getElementById('exportFilterSemester').value;
    let filterText = "All Degrees, All Semesters";
    if (fDegree !== 'all' || fSem !== 'all') {
        filterText = `Degree: ${fDegree === 'all' ? 'All' : fDegree} | Sem: ${fSem === 'all' ? 'All' : fSem}`;
    }

    // Title
    doc.setFontSize(18);
    doc.text("Feedback Management System - System Summary", 14, 20);
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 28);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Report Range: ${filterText}`, 14, 34);
    doc.setTextColor(0);

    // Stats (These are live dashboard stats, might not reflect filters unless we recalculate. 
    // To match "details and performance based on feedback", we'll calculate filtered stats)

    let yPos = 45;
    doc.text("Loading filtered data...", 14, yPos);

    try {
        // Fetch Feedback for Stats
        let query = db.collection('feedback');
        if (fDegree !== 'all') query = query.where('degree', '==', fDegree);
        if (fSem !== 'all') query = query.where('semester', '==', fSem);

        const snap = await query.get();
        const totalFeedback = snap.size;
        let sumRating = 0;
        const deptRatings = {};

        snap.forEach(d => {
            const data = d.data();
            sumRating += Number(data.rating);
            const dept = data.department || 'General';
            if (!deptRatings[dept]) deptRatings[dept] = { sum: 0, count: 0 };
            deptRatings[dept].sum += Number(data.rating);
            deptRatings[dept].count++;
        });

        const avgRating = totalFeedback ? (sumRating / totalFeedback).toFixed(2) : "0.00";

        // Clean previous loading text area (approx)
        doc.setFillColor(255, 255, 255);
        doc.rect(10, 40, 100, 10, 'F');

        doc.setFontSize(12);
        doc.text(`Total Filtered Feedback: ${totalFeedback}`, 14, 45);
        doc.text(`Overall Average Rating: ${avgRating} / 5.0`, 14, 52);

        yPos = 65;

        // Department Performance Table (Filtered)
        const tableData = Object.keys(deptRatings).map(dept => [
            dept,
            (deptRatings[dept].sum / deptRatings[dept].count).toFixed(2),
            deptRatings[dept].count
        ]);

        if (tableData.length > 0) {
            doc.text("Department Performance (Filtered)", 14, yPos);
            doc.autoTable({
                startY: yPos + 5,
                head: [['Department', 'Avg Rating', 'Feedback Count']],
                body: tableData,
            });
            yPos = doc.lastAutoTable.finalY + 15;
        } else {
            doc.text("No data found for selected filters.", 14, yPos);
            yPos += 15;
        }

        // Charts (Note: Dashboard charts are "All Time" unless dashboard itself is filtered. 
        // We will skip dashboard charts here to avoid confusion, or include them with a disclaimer. 
        // User requested "details based on feedback", so the table above is better.)

        doc.save(`FMS_System_Summary_${fDegree}_${fSem}.pdf`);

    } catch (e) {
        console.warn("Export error:", e);
        doc.text("Error generating report data.", 14, yPos + 10);
        doc.save("FMS_Error.pdf");
    }
}

async function exportFeedbackDumpXLSX() {
    const btn = event.target ? event.target.closest('button') : null;
    let originalText = '';
    if (btn) { originalText = btn.innerHTML; btn.innerHTML = 'Generating...'; }

    try {
        const fDegree = document.getElementById('exportFilterDegree').value;
        const fSem = document.getElementById('exportFilterSemester').value;

        // Base Query
        let query = db.collection('feedback').orderBy('submitted_at', 'desc').limit(2000);

        const snap = await query.get();
        const data = [];

        snap.forEach(doc => {
            const d = doc.data();

            // Client-Side Filter
            if (fDegree !== 'all' && (d.degree || 'B.Tech') !== fDegree) return;
            if (fSem !== 'all' && (d.semester || '1').toString() !== fSem) return;

            const teacher = allTeachers.find(t => t.id === d.teacher_id);
            data.push({
                "Subject": d.subject || 'N/A',
                "Teacher Name": teacher ? teacher.name : 'Unknown',
                "Department": d.department || 'N/A',
                "Rating": d.rating,
                "Comments": d.comments || '',
                "Degree": d.degree || 'B.Tech',
                "Semester": d.semester || '-',
                "Session": d.session || '-',
                "Date": d.submitted_at ? new Date(d.submitted_at.seconds * 1000).toLocaleDateString() : '-'
            });
        });

        if (data.length === 0) {
            alert("No data found matching filters in recent 2000 records.");
            return;
        }

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Feedback Data");
        XLSX.writeFile(wb, `FMS_Dump_${fDegree}_${fSem}.xlsx`);

    } catch (e) {
        console.error(e);
        alert("Export failed: " + e.message);
    } finally {
        if (btn) btn.innerHTML = originalText;
    }
}

async function exportDeptComparisonXLSX() {
    const btn = event.target ? event.target.closest('button') : null;
    if (btn) btn.innerText = "Generating...";

    try {
        const fDegree = document.getElementById('exportFilterDegree').value;
        const fSem = document.getElementById('exportFilterSemester').value;

        const snap = await db.collection('feedback').get();
        const deptStats = {};

        snap.forEach(doc => {
            const d = doc.data();

            // Filter
            if (fDegree !== 'all' && (d.degree || 'B.Tech') !== fDegree) return;
            if (fSem !== 'all' && (d.semester || '1').toString() !== fSem) return;

            const dept = d.department || 'General';
            if (!deptStats[dept]) deptStats[dept] = { sum: 0, count: 0 };
            deptStats[dept].sum += Number(d.rating);
            deptStats[dept].count++;
        });

        const data = Object.keys(deptStats).map(dept => ({
            "Department": dept,
            "Average Rating": (deptStats[dept].sum / deptStats[dept].count).toFixed(2),
            "Total Feedbacks": deptStats[dept].count,
            "Filter Degree": fDegree === 'all' ? 'All' : fDegree,
            "Filter Sem": fSem === 'all' ? 'All' : fSem
        }));

        if (data.length === 0) return alert("No matching data.");

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Dept Performace");
        XLSX.writeFile(wb, `FMS_Dept_Perf_${fDegree}_S${fSem}.xlsx`);

    } catch (e) {
        console.error(e);
        alert("Export failed.");
    } finally {
        if (btn) btn.innerHTML = '<i class="ri-download-line"></i> Download Excel';
    }
}

async function exportSubjectWiseFeedbackPDF() {
    const btn = event.target ? event.target.closest('button') : null;
    if (btn) btn.innerText = "Generating...";

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const fDegree = document.getElementById('exportFilterDegree').value;
    const fSem = document.getElementById('exportFilterSemester').value;

    try {
        const snap = await db.collection('feedback').orderBy('submitted_at', 'desc').limit(2000).get();
        if (snap.empty) { alert("No data"); return; }

        // Group by Teacher -> Subject
        const teacherMap = {}; // { tid: { name: '..', dept: '..', subjects: { subName: [ {rating, comment, date} ] } } }

        snap.forEach(d => {
            const val = d.data();
            if (fDegree !== 'all' && (val.degree || 'B.Tech') !== fDegree) return;
            if (fSem !== 'all' && (val.semester || '1').toString() !== fSem) return;

            const tid = val.teacher_id;
            if (!teacherMap[tid]) {
                const tObj = allTeachers.find(t => t.id === tid);
                teacherMap[tid] = {
                    name: tObj ? tObj.name : 'Unknown',
                    dept: tObj ? (tObj.department || 'Gen') : 'Gen',
                    subjects: {}
                };
            }

            const sub = val.subject || 'General';
            if (!teacherMap[tid].subjects[sub]) teacherMap[tid].subjects[sub] = [];

            teacherMap[tid].subjects[sub].push({
                rating: val.rating,
                comment: val.comments || '',
                date: val.submitted_at ? new Date(val.submitted_at.seconds * 1000).toLocaleDateString() : '-'
            });
        });

        if (Object.keys(teacherMap).length === 0) { alert("No matching records found."); return; }

        doc.setFontSize(18);
        doc.text("Subject-wise Detailed Feedback Report", 14, 20);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);
        doc.text(`Filters: Degree=${fDegree} | Sem=${fSem}`, 14, 32);

        let yPos = 40;

        for (const tid of Object.keys(teacherMap)) {
            const tData = teacherMap[tid];

            // Check page break
            if (yPos > 250) { doc.addPage(); yPos = 20; }

            doc.setFillColor(240, 240, 240);
            doc.rect(14, yPos, 182, 10, 'F');
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text(`${tData.name} (${tData.dept})`, 16, yPos + 7);
            yPos += 15;

            for (const sub of Object.keys(tData.subjects)) {
                const feedList = tData.subjects[sub];
                if (yPos > 260) { doc.addPage(); yPos = 20; }

                doc.setFontSize(11);
                doc.setFont(undefined, 'normal');
                doc.text(`Subject: ${sub}`, 16, yPos);
                yPos += 5;

                const tableBody = feedList.map(f => [f.rating + "/5", f.comment, f.date]);

                doc.autoTable({
                    startY: yPos,
                    head: [['Rtg', 'Comment', 'Date']],
                    body: tableBody,
                    margin: { left: 14 },
                    theme: 'grid',
                    columnStyles: {
                        0: { cellWidth: 20 },
                        1: { cellWidth: 'auto' },
                        2: { cellWidth: 30 }
                    },
                    styles: { fontSize: 9 }
                });

                yPos = doc.lastAutoTable.finalY + 10;
            }
            yPos += 5;
        }

        doc.save(`Subject_Wise_Report_${fDegree}_${fSem}.pdf`);

    } catch (e) {
        console.error(e);
        alert("Error generating report");
    } finally {
        if (btn) btn.innerHTML = '<i class="ri-download-line"></i> Download PDF';
    }
}

window.exportSubjectWiseFeedbackPDF = exportSubjectWiseFeedbackPDF;

// Global Bind
window.exportSystemSummaryPDF = exportSystemSummaryPDF;
window.exportFeedbackDumpXLSX = exportFeedbackDumpXLSX;
window.exportDeptComparisonXLSX = exportDeptComparisonXLSX;

function downloadAdminStudentSample() {
    const csvContent = "data:text/csv;charset=utf-8," +
        "student_id,name,degree,semester,department,session,password\n" +
        "2024001,John Doe,B.Tech,1,105,2023-27,password123";
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "admin_student_sample.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function downloadAdminTeacherSample() {
    const csvContent = "data:text/csv;charset=utf-8," +
        "name,email,department,password\n" +
        "Dr. Smith,smith@clg.edu,105,securepass";
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "admin_teacher_sample.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

window.downloadAdminStudentSample = downloadAdminStudentSample;
window.downloadAdminTeacherSample = downloadAdminTeacherSample;
