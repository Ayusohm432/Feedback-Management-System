/**
 * js/admin.js
 * Logic for Admin Dashboard - Stats, User Management, Approvals, Analytics, Rosters, Feedback
 */

// --- Global Data Cache ---
let allPendingUsers = [];
let allStudents = [];
let allTeachers = []; // Crucial for Feedback Filtering

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
        if (role === 'department') renderUserTable(users, role, container);
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
    const filterYear = document.getElementById('studentYearFilter').value;
    const filterSem = document.getElementById('studentSemFilter').value;
    const container = document.getElementById('students-table-container');

    let filtered = allStudents;

    if (filterDept !== 'all') {
        filtered = filtered.filter(s => (s.department || 'General') === filterDept);
    }
    if (filterYear !== 'all') {
        filtered = filtered.filter(s => (s.year || '1').toString() === filterYear);
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
function renderUserTable(users, role, container) {
    if (users.length === 0) { container.innerHTML = "No users found."; return; }
    let headers = [];
    if (role === 'student') headers = ['<input type="checkbox" onchange="toggleAllStudents(this)">', 'Name', 'Email', 'Reg No', 'Dept', 'Year/Sem', 'Session'];
    else headers = ['Name', 'Email'];

    if (role === 'department') headers.push('Dept ID', 'Name', 'Session');
    if (role === 'teacher') headers.push('Dept', 'Review Status', 'Subjects');

    let html = `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
    users.forEach(u => {
        html += `<tr>
            ${role === 'student' ? `
                <td><input type="checkbox" class="student-checkbox" value="${u.id}"></td>
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td>${u.regNum || '-'}</td>
                <td>${u.department || 'General'}</td>
                <td>Y${u.year || '1'}-S${u.semester || '1'}</td>
                <td>${u.session || '-'}</td>` : `
                <td>${u.name}</td>
                <td>${u.email}</td>
            `}
            ${role === 'department' ? `<td>${u.deptId || '-'}</td><td>${u.name}</td><td>${u.session || '-'}</td>` : ''}
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
async function handleAddSingleStudent(e) {
    e.preventDefault();
    const reg = document.getElementById('addRegNum').value;
    const name = document.getElementById('addName').value;
    const dept = document.getElementById('addDept').value;
    const session = document.getElementById('addSession').value;
    const pass = document.getElementById('addPassword').value;
    const year = document.getElementById('addYear').value;
    const semester = document.getElementById('addSemester').value;
    const email = `${reg}@student.fms.local`;
    try {
        const uid = await createUserInSecondaryApp(email, pass);
        await db.collection('users').doc(uid).set({
            uid: uid, name: name, email: email, role: 'student', status: 'approved',
            regNum: reg, department: dept, session: session,
            year: year || '1', semester: semester || '1',
            createdAt: new Date()
        });
        alert(`Student Created!`); e.target.reset();
    } catch (err) { alert("Error: " + err.message); }
}
async function handleBulkUpload() {
    const file = document.getElementById('csvFile').files[0]; if (!file) return alert("Select file first");
    Papa.parse(file, { header: true, complete: async function (results) { let count = 0; for (let row of results.data) { if (row.student_id && row.password) { try { const email = `${row.student_id}@student.fms.local`; const uid = await createUserInSecondaryApp(email, row.password); await db.collection('users').doc(uid).set({ uid: uid, name: row.name, email: email, role: 'student', status: 'approved', regNum: row.student_id, department: row.department, session: row.session, year: row.year || '1', semester: row.semester || '1', createdAt: new Date() }); count++; } catch (err) { } } } alert(`Successfully created ${count} users.`); } });
}
function downloadSample() { const csvContent = "data:text/csv;charset=utf-8," + "student_id,name,department,session,password\n2024001,John Doe,CSE,2023-27,password123"; const link = document.createElement("a"); link.href = encodeURI(csvContent); link.download = "student_full_import.csv"; document.body.appendChild(link); link.click(); }
async function handleAddSingleTeacher(e) { e.preventDefault(); const name = document.getElementById('addTeacherName').value; const email = document.getElementById('addTeacherEmail').value; const dept = document.getElementById('addTeacherDept').value; const pass = document.getElementById('addTeacherPassword').value; try { const uid = await createUserInSecondaryApp(email, pass); await db.collection('users').doc(uid).set({ uid: uid, name: name, email: email, role: 'teacher', status: 'approved', department: dept, isReviewOpen: false, createdAt: new Date() }); alert(`Teacher Created!`); e.target.reset(); } catch (err) { alert("Error: " + err.message); } }
async function handleBulkTeacherUpload() { const file = document.getElementById('teacherCsvFile').files[0]; if (!file) return alert("Select file first"); Papa.parse(file, { header: true, complete: async function (results) { let count = 0; for (let row of results.data) { if (row.email && row.password) { try { const uid = await createUserInSecondaryApp(row.email, row.password); await db.collection('users').doc(uid).set({ uid: uid, name: row.name, email: row.email, role: 'teacher', status: 'approved', department: row.department, isReviewOpen: false, createdAt: new Date() }); count++; } catch (err) { } } } alert(`Created ${count} teachers.`); } }); }
function downloadTeacherSample() { const csvContent = "data:text/csv;charset=utf-8," + "name,email,department,password\nDr. Smith,smith@clg.edu,CSE,securepass"; const link = document.createElement("a"); link.href = encodeURI(csvContent); link.download = "teacher_full_import.csv"; document.body.appendChild(link); link.click(); }
async function handleAddSingleDept(e) { e.preventDefault(); const id = document.getElementById('addDeptId').value; const name = document.getElementById('addDeptName').value; const session = document.getElementById('addDeptSession').value; const pass = document.getElementById('addDeptPassword').value; const email = `${id}@dept.fms.local`; try { const uid = await createUserInSecondaryApp(email, pass); await db.collection('users').doc(uid).set({ uid: uid, name: name, email: email, role: 'department', status: 'approved', deptId: id, session: session, createdAt: new Date() }); alert("Department Account Created."); e.target.reset(); } catch (e) { alert("Error: " + e.message); } }
function loadApprovals() { const listContainer = document.getElementById('approvals-list-container'); listContainer.innerHTML = 'Loading...'; db.collection('users').where('status', '==', 'pending').onSnapshot(snap => { allPendingUsers = []; snap.forEach(doc => allPendingUsers.push({ id: doc.id, ...doc.data() })); renderApprovals('all'); }); }
function filterApprovals(role, tabEl) { document.querySelectorAll('.sub-tab').forEach(el => el.classList.remove('active')); tabEl.classList.add('active'); renderApprovals(role); }
function renderApprovals(filterRole) { const container = document.getElementById('approvals-list-container'); const filtered = filterRole === 'all' ? allPendingUsers : allPendingUsers.filter(u => u.role === filterRole); if (filtered.length === 0) { container.innerHTML = `<p style="padding:1rem;">No pending requests for ${filterRole}.</p>`; return; } let html = '<table class="w-full"><thead><tr><th>Name</th><th>Role</th><th>Info</th><th>Actions</th></tr></thead><tbody>'; filtered.forEach(u => { html += `<tr><td><strong>${u.name}</strong><br><small>${u.email}</small></td><td><span class="pill pill-pending">${u.role.toUpperCase()}</span></td><td>${u.role === 'student' ? u.regNum : (u.deptId || 'N/A')}</td><td><button class="btn btn-primary" onclick="approveUser('${u.id}')">Approve</button> <button class="btn btn-outline" onclick="rejectUser('${u.id}')">Reject</button></td></tr>`; }); html += '</tbody></table>'; container.innerHTML = html; }
window.approveUser = async (uid) => { try { await db.collection('users').doc(uid).update({ status: 'approved' }); } catch (e) { console.error(e); } };
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
    const filterYear = document.getElementById('fbFilterYear') ? document.getElementById('fbFilterYear').value : 'all';
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
            if (filterYear !== 'all' && (data.year || '1') !== filterYear) show = false;
            if (filterSem !== 'all' && (data.semester || '1') !== filterSem) show = false;

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
                            <span>${data.session || '-'} | Y${data.year || '-'}</span>
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
            let html = '<table style="width:100%; border-collapse:collapse;"><thead><tr style="background:#f0f0f0; text-align:left;"><th style="padding:0.5rem;">Subject</th><th style="padding:0.5rem;">Year/Sem</th><th style="padding:0.5rem;">Status</th><th style="padding:0.5rem;">Action</th></tr></thead><tbody>';
            subjects.forEach((s, index) => {
                html += `
                    <tr style="border-bottom:1px solid #eee;">
                        <td style="padding:0.5rem;">${s.name}</td>
                        <td style="padding:0.5rem;">Y${s.year}-S${s.semester}</td>
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
    const year = document.getElementById('assignSubYear').value;
    const sem = document.getElementById('assignSubSem').value;

    try {
        const docRef = db.collection('users').doc(currentManageTeacherId);
        const doc = await docRef.get();
        let subjects = doc.data().assignedSubjects || [];

        subjects.push({
            name: name,
            year: year,
            semester: sem,
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

    // Show loading state if possible or just alert at end
    // For better UX, we could disable buttons

    for (const uid of ids) {
        try {
            // Find student data in local cache to calculate next level
            const student = allStudents.find(s => s.id === uid);
            if (!student) continue;

            const currentYear = parseInt(student.year) || 1;
            const currentSem = parseInt(student.semester) || 1;

            const { newYear, newSem } = calculateNewLevel(currentYear, currentSem, direction);

            if (newYear !== currentYear || newSem !== currentSem) {
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

function calculateNewLevel(year, sem, direction) {
    // Logic: 
    // Promote (+1): 1-1 -> 1-2 -> 2-3 -> 2-4 -> 3-5 -> 3-6 -> 4-7 -> 4-8 -> Graduated?
    // Wait, typical engineering: Year 1 (Sem 1, 2), Year 2 (Sem 3, 4), Year 3 (Sem 5, 6), Year 4 (Sem 7, 8)
    // So Sem is the driver.
    // Sem 1 -> 2 (Same Year 1)
    // Sem 2 -> 3 (Year changes to 2)

    let newSem = sem + direction;
    let newYear = year;

    if (direction > 0) { // Promoting
        // If New Sem is Odd (e.g., 3, 5, 7), it means we just finished an Even sem, so Year increases
        // Example: Was Sem 2. New Sem 3. Year was 1. Now Year 2.
        // Formula: Year = Math.ceil(newSem / 2)
        newYear = Math.ceil(newSem / 2);
    } else { // Demoting
        if (newSem < 1) {
            newSem = 1;
            newYear = 1;
        } else {
            newYear = Math.ceil(newSem / 2);
        }
    }

    // Safety caps
    if (newYear > 4) newYear = 4; // Assuming 4 year course, or let it go to 5? Let's cap at 4-8 for now or maybe 5-9? 
    // Actually, let's just restrict logic to Math.ceil. If they go to Sem 9, Year is 5.

    return { newYear, newSem };
}

// Init
document.addEventListener('DOMContentLoaded', () => { loadStats(); loadActivityFeed(); loadProfile(); });

// --- Export Functionality ---

async function exportSystemSummaryPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text("Feedback Management System - System Summary", 14, 20);
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 30);

    // Stats
    const sCount = document.getElementById('count-student').innerText;
    const tCount = document.getElementById('count-teacher').innerText;
    const dCount = document.getElementById('count-dept').innerText;

    doc.text(`Total Students: ${sCount}`, 14, 45);
    doc.text(`Total Teachers: ${tCount}`, 14, 52);
    doc.text(`Active Departments: ${dCount}`, 14, 59);

    let yPos = 70;

    // Charts
    try {
        if (deptChartInstance) {
            const img = deptChartInstance.toBase64Image();
            doc.addImage(img, 'PNG', 14, yPos, 180, 80);
            doc.text("Department Performance (Avg Rating)", 14, yPos - 5);
            yPos += 95;
        }

        if (window.trendInstance) {
            if (yPos > 200) { doc.addPage(); yPos = 20; }
            const img = window.trendInstance.toBase64Image();
            doc.addImage(img, 'PNG', 14, yPos, 180, 80);
            doc.text("Submission Trend (Last 7 Days)", 14, yPos - 5);
        }
    } catch (e) {
        console.warn("Chart export error:", e);
        doc.text("Chart data unavailable for export.", 14, yPos);
    }

    doc.save("FMS_System_Summary.pdf");
}

async function exportFeedbackDumpXLSX() {
    // Show Loading
    const btn = event.target ? event.target.closest('button') : null;
    let originalText = '';
    if (btn) { originalText = btn.innerHTML; btn.innerHTML = 'Generating...'; }

    try {
        const snap = await db.collection('feedback').orderBy('submitted_at', 'desc').limit(2000).get();
        const data = [];

        // Pre-fetch teacher names if needed, but we have allTeachers global
        // Map data
        snap.forEach(doc => {
            const d = doc.data();
            const teacher = allTeachers.find(t => t.id === d.teacher_id);
            data.push({
                "Subject": d.subject || 'N/A',
                "Teacher Name": teacher ? teacher.name : 'Unknown',
                "Department": d.department || 'N/A',
                "Rating": d.rating,
                "Comments": d.comments || '',
                "Year": d.year || '-',
                "Semester": d.semester || '-',
                "Date": d.submitted_at ? new Date(d.submitted_at.seconds * 1000).toLocaleDateString() : '-'
            });
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Feedback Data");
        XLSX.writeFile(wb, "FMS_Feedback_Dump.xlsx");

    } catch (e) {
        console.error(e);
        alert("Export failed: " + e.message);
    } finally {
        if (btn) btn.innerHTML = originalText;
    }
}

async function exportDeptComparisonXLSX() {
    try {
        const snap = await db.collection('feedback').get();
        const deptStats = {};

        // Aggregate
        snap.forEach(doc => {
            const d = doc.data();
            const dept = d.department || 'General';
            if (!deptStats[dept]) deptStats[dept] = { sum: 0, count: 0 };
            deptStats[dept].sum += Number(d.rating);
            deptStats[dept].count++;
        });

        const data = Object.keys(deptStats).map(dept => ({
            "Department": dept,
            "Average Rating": (deptStats[dept].sum / deptStats[dept].count).toFixed(2),
            "Total Feedbacks": deptStats[dept].count
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Department Performance");
        XLSX.writeFile(wb, "FMS_Dept_Performance.xlsx");

    } catch (e) {
        console.error(e);
        alert("Export failed.");
    }
}

// Global Bind
window.exportSystemSummaryPDF = exportSystemSummaryPDF;
window.exportFeedbackDumpXLSX = exportFeedbackDumpXLSX;
window.exportDeptComparisonXLSX = exportDeptComparisonXLSX;
