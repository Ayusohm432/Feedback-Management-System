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
    if (tabName === 'departments') loadUserTable('department', 'depts-table-container');
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
function loadActivityFeed() { /* Same as before */
    const feed = document.getElementById('activity-feed');
    db.collection('users').orderBy('createdAt', 'desc').limit(5).get().then(snap => {
        if (snap.empty) { feed.innerHTML = "No recent activity."; return; }
        feed.innerHTML = "";
        snap.forEach(doc => {
            const u = doc.data();
            const date = u.createdAt ? new Date(u.createdAt.seconds * 1000).toLocaleDateString() : 'Recently';
            let icon = 'ri-user-line';
            if (u.role === 'student') icon = 'ri-user-smile-line';
            if (u.role === 'teacher') icon = 'ri-presentation-line';
            const html = `<div class="activity-item"><div class="activity-icon"><i class="${icon}"></i></div><div><strong>New ${u.role} Registration</strong><div style="font-size:0.9em; color:#666;">${u.name} joined.</div><small style="color:#999;">${date}</small></div></div>`;
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
    feedbackSnap.forEach(doc => {
        const d = doc.data();
        let dept = d.department || 'General';
        if (!deptRatings[dept]) deptRatings[dept] = [];
        deptRatings[dept].push(Number(d.rating));
    });
    const labels = Object.keys(deptRatings);
    const data = labels.map(dept => {
        const ratings = deptRatings[dept];
        return (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);
    });

    const ctx1 = document.getElementById('deptChart').getContext('2d');
    if (deptChartInstance) deptChartInstance.destroy();
    deptChartInstance = new Chart(ctx1, { type: 'bar', data: { labels: labels.length ? labels : ['No Data'], datasets: [{ label: 'Avg Rating', data: data.length ? data : [0], backgroundColor: 'rgba(59, 130, 246, 0.5)', borderColor: 'rgb(59, 130, 246)', borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 5 } } } });

    const ctx2 = document.getElementById('participationChart').getContext('2d');
    if (partChartInstance) partChartInstance.destroy();
    partChartInstance = new Chart(ctx2, { type: 'doughnut', data: { labels: ['Submitted', 'Pending'], datasets: [{ data: [65, 35], backgroundColor: ['#10b981', '#e5e7eb'] }] }, options: { responsive: true, maintainAspectRatio: false } });
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
    const filter = document.getElementById('studentDeptFilter').value;
    const container = document.getElementById('students-table-container');
    if (filter === 'all') renderUserTable(allStudents, 'student', container);
    else renderUserTable(allStudents.filter(s => (s.department || 'General') === filter), 'student', container);
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
    let headers = ['Name', 'Email'];
    if (role === 'student') headers.push('Reg No', 'Dept', 'Session');
    if (role === 'department') headers.push('Dept ID', 'Name', 'Session');
    if (role === 'teacher') headers.push('Dept', 'Review Status');

    let html = `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
    users.forEach(u => {
        html += `<tr>
            <td>${u.name}</td>
            <td>${u.email}</td>
            ${role === 'student' ? `<td>${u.regNum || '-'}</td><td>${u.department || 'General'}</td><td>${u.session || '-'}</td>` : ''}
            ${role === 'department' ? `<td>${u.deptId || '-'}</td><td>${u.name}</td><td>${u.session || '-'}</td>` : ''}
            ${role === 'teacher' ? `<td>${u.department || 'General'}</td><td><label class="switch"><input type="checkbox" ${u.isReviewOpen ? 'checked' : ''} onchange="toggleReviewStatus('${u.id}', this.checked)"><span class="slider round"></span></label><span style="font-size:0.8em; margin-left:0.5rem; color:${u.isReviewOpen ? '#16a34a' : '#999'}">${u.isReviewOpen ? 'Open' : 'Closed'}</span></td>` : ''}
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
    e.preventDefault(); const reg = document.getElementById('addRegNum').value; const name = document.getElementById('addName').value; const dept = document.getElementById('addDept').value; const session = document.getElementById('addSession').value; const pass = document.getElementById('addPassword').value; const email = `${reg}@student.fms.local`;
    try { const uid = await createUserInSecondaryApp(email, pass); await db.collection('users').doc(uid).set({ uid: uid, name: name, email: email, role: 'student', status: 'approved', regNum: reg, department: dept, session: session, createdAt: new Date() }); alert(`Student Created!`); e.target.reset(); } catch (err) { alert("Error: " + err.message); }
}
async function handleBulkUpload() {
    const file = document.getElementById('csvFile').files[0]; if (!file) return alert("Select file first");
    Papa.parse(file, { header: true, complete: async function (results) { let count = 0; for (let row of results.data) { if (row.student_id && row.password) { try { const email = `${row.student_id}@student.fms.local`; const uid = await createUserInSecondaryApp(email, row.password); await db.collection('users').doc(uid).set({ uid: uid, name: row.name, email: email, role: 'student', status: 'approved', regNum: row.student_id, department: row.department, session: row.session, createdAt: new Date() }); count++; } catch (err) { } } } alert(`Successfully created ${count} users.`); } });
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
async function loadProfile() { const user = firebase.auth().currentUser; if (!user) return; document.getElementById('profile-email').innerText = user.email; document.getElementById('profile-uid').innerText = user.uid; if (user.metadata) { document.getElementById('profile-joined').innerText = new Date(user.metadata.creationTime).toLocaleDateString(); document.getElementById('profile-last-login').innerText = new Date(user.metadata.lastSignInTime).toLocaleString(); } try { const doc = await db.collection('users').doc(user.uid).get(); if (doc.exists) { const data = doc.data(); const name = data.name || "Admin User"; document.getElementById('profile-name').innerText = name; document.getElementById('profile-role').innerText = (data.role || 'ADMIN').toUpperCase(); document.getElementById('profile-status').innerText = (data.status || 'Active'); const initial = name.charAt(0); document.getElementById('profile-avatar').src = `https://ui-avatars.com/api/?name=${initial}&background=0D8ABC&color=fff&size=128`; if (document.getElementById('editProfileName')) document.getElementById('editProfileName').value = name; } } catch (err) { console.error("Profile Load Error", err); } }
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

            // 1. Rating
            if (filterRating === 'low' && data.rating >= 3) show = false;
            if (filterRating === 'high' && data.rating <= 3) show = false;

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
                if (data.rating <= 2) colorClass = '#ef4444'; // red
                if (data.rating >= 4) colorClass = '#10b981'; // green

                // Find Teacher Name (if not in feedback, look up in cache)
                let teacherName = "Unknown Teacher";
                if (allTeachers) {
                    const t = allTeachers.find(u => u.id === data.teacher_id);
                    if (t) teacherName = t.name;
                }

                html += `
                    <div class="feedback-card">
                        <div class="feedback-header">
                            <div>
                                <span class="rating-badge" style="background:${colorClass}20; color:${colorClass}">${data.rating}/5</span>
                                <span style="font-weight:600; margin-left:0.5rem;">${teacherName}</span>
                            </div>
                            <small style="color:#999">${date}</small>
                        </div>
                        <div class="feedback-body">
                            <h4 style="margin-bottom:0.5rem; font-size:1em;">${data.subject || 'Subject Not Specified'}</h4>
                            <p style="color:#444; font-size:0.95em; line-height:1.5;">"${data.comments || ''}"</p>
                        </div>
                        <div class="feedback-footer">
                            <span>${data.department || 'General'}</span>
                            <span style="color:${colorClass}">${stars}</span>
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
// Init
document.addEventListener('DOMContentLoaded', () => { loadStats(); loadActivityFeed(); loadProfile(); });
