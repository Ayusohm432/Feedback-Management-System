/**
 * js/admin.js
 * Logic for Admin Dashboard - Stats, User Management, Approvals, Analytics, Rosters
 */

// --- Global Data Cache ---
let allPendingUsers = [];
let allStudents = [];
let allTeachers = [];

// --- Tab Switching Logic ---
function switchTab(tabName, linkEl) {
    document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));
    linkEl.classList.add('active');
    document.querySelectorAll('.tab-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');

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
    if (tabName === 'approvals') loadApprovals(); // RELOAD APPROVALS ON TAB SWITCH
    if (tabName === 'students') loadUserTable('student', 'students-table-container');
    if (tabName === 'teachers') loadUserTable('teacher', 'teachers-table-container');
    if (tabName === 'departments') loadUserTable('department', 'depts-table-container');
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
            let icon = 'ri-user-line';
            if (u.role === 'student') icon = 'ri-user-smile-line';
            if (u.role === 'teacher') icon = 'ri-presentation-line';

            const html = `
                <div class="activity-item">
                    <div class="activity-icon"><i class="${icon}"></i></div>
                    <div>
                        <strong>New ${u.role} Registration</strong>
                        <div style="font-size:0.9em; color:#666;">${u.name} joined.</div>
                        <small style="color:#999;">${date}</small>
                    </div>
                </div>
            `;
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

    deptChartInstance = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: labels.length ? labels : ['No Data'],
            datasets: [{ label: 'Avg Rating', data: data.length ? data : [0], backgroundColor: 'rgba(59, 130, 246, 0.5)', borderColor: 'rgb(59, 130, 246)', borderWidth: 1 }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 5 } } }
    });

    const ctx2 = document.getElementById('participationChart').getContext('2d');
    if (partChartInstance) partChartInstance.destroy();

    partChartInstance = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: ['Submitted', 'Pending'],
            datasets: [{ data: [65, 35], backgroundColor: ['#10b981', '#e5e7eb'] }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// --- 3. User Tables & Search & Review Control ---
function loadUserTable(role, containerId) {
    const container = document.getElementById(containerId);

    db.collection('users').where('role', '==', role).where('status', '==', 'approved').onSnapshot(snap => {
        let users = [];
        snap.forEach(doc => users.push({ id: doc.id, ...doc.data() }));

        if (role === 'student') {
            allStudents = users;
            updateStudentDeptDropdown(users);
            filterStudentList();
        }
        if (role === 'teacher') {
            allTeachers = users;
            updateDeptDropdown(users); // Teacher Filter
            filterTeacherList();
        }
        if (role === 'department') renderUserTable(users, role, container);
    });
}

// Update Filters
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

// Render Table
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
            ${role === 'teacher' ? `
                <td>${u.department || 'General'}</td>
                <td>
                    <label class="switch">
                        <input type="checkbox" ${u.isReviewOpen ? 'checked' : ''} onchange="toggleReviewStatus('${u.id}', this.checked)">
                        <span class="slider round"></span>
                    </label>
                    <span style="font-size:0.8em; margin-left:0.5rem; color:${u.isReviewOpen ? '#16a34a' : '#999'}">${u.isReviewOpen ? 'Open' : 'Closed'}</span>
                </td>
            ` : ''}
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

// Review Toggle
window.toggleReviewStatus = async (uid, isOpen) => {
    try { await db.collection('users').doc(uid).update({ isReviewOpen: isOpen }); }
    catch (e) { console.error(e); }
};

// --- HELPER: Create User in Secondary App ---
async function createUserInSecondaryApp(email, password) {
    // 1. Initialize Secondary App
    const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
    try {
        // 2. Create User
        const userCred = await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
        const uid = userCred.user.uid;
        // 3. Delete App to avoid cleanup issues
        await secondaryApp.delete();
        return uid;
    } catch (err) {
        await secondaryApp.delete();
        throw err;
    }
}

// --- 4. Add User & Bulk Upload Logic (UPDATED) ---

// STUDENT
async function handleAddSingleStudent(e) {
    e.preventDefault();
    const reg = document.getElementById('addRegNum').value;
    const name = document.getElementById('addName').value;
    const dept = document.getElementById('addDept').value;
    const session = document.getElementById('addSession').value;
    const pass = document.getElementById('addPassword').value;
    const email = `${reg}@student.fms.local`;

    try {
        const uid = await createUserInSecondaryApp(email, pass);
        // Create Doc
        await db.collection('users').doc(uid).set({
            uid: uid, name: name, email: email, role: 'student', status: 'approved',
            regNum: reg, department: dept, session: session, createdAt: new Date()
        });
        alert(`Student Created!\nEmail: ${email}\nUID: ${uid}`);
        e.target.reset();
    } catch (err) { console.error(err); alert("Error: " + err.message); }
}

async function handleBulkUpload() {
    const file = document.getElementById('csvFile').files[0];
    if (!file) return alert("Select file first");
    document.getElementById('uploadStatus').innerText = "Parsing...";

    Papa.parse(file, {
        header: true,
        complete: async function (results) {
            let count = 0;
            document.getElementById('uploadStatus').innerText = `Processing ${results.data.length} rows...`;

            for (let row of results.data) {
                if (row.student_id && row.password) {
                    try {
                        const email = `${row.student_id}@student.fms.local`;
                        const uid = await createUserInSecondaryApp(email, row.password);
                        await db.collection('users').doc(uid).set({
                            uid: uid, name: row.name, email: email, role: 'student', status: 'approved',
                            regNum: row.student_id, department: row.department, session: row.session, createdAt: new Date()
                        });
                        count++;
                    } catch (err) { console.error("Row Error", row, err); }
                }
            }
            alert(`Successfully created ${count} users.`);
            document.getElementById('uploadStatus').innerText = "Done.";
        }
    });
}
function downloadSample() {
    const csvContent = "data:text/csv;charset=utf-8," + "student_id,name,department,session,password\n2024001,John Doe,CSE,2023-27,password123";
    const link = document.createElement("a"); link.href = encodeURI(csvContent); link.download = "student_full_import.csv"; document.body.appendChild(link); link.click();
}

// TEACHER
async function handleAddSingleTeacher(e) {
    e.preventDefault();
    const name = document.getElementById('addTeacherName').value;
    const email = document.getElementById('addTeacherEmail').value;
    const dept = document.getElementById('addTeacherDept').value;
    const pass = document.getElementById('addTeacherPassword').value;

    try {
        const uid = await createUserInSecondaryApp(email, pass);
        await db.collection('users').doc(uid).set({
            uid: uid, name: name, email: email, role: 'teacher', status: 'approved',
            department: dept, isReviewOpen: false, createdAt: new Date()
        });
        alert(`Teacher Created!`);
        e.target.reset();
    } catch (err) { alert("Error: " + err.message); }
}

async function handleBulkTeacherUpload() {
    const file = document.getElementById('teacherCsvFile').files[0];
    if (!file) return alert("Select file first");

    Papa.parse(file, {
        header: true,
        complete: async function (results) {
            let count = 0;
            for (let row of results.data) {
                if (row.email && row.password) {
                    try {
                        const uid = await createUserInSecondaryApp(row.email, row.password);
                        await db.collection('users').doc(uid).set({
                            uid: uid, name: row.name, email: row.email, role: 'teacher', status: 'approved',
                            department: row.department, isReviewOpen: false, createdAt: new Date()
                        });
                        count++;
                    } catch (err) { console.error(err); }
                }
            }
            alert(`Created ${count} teachers.`);
        }
    });
}
function downloadTeacherSample() {
    const csvContent = "data:text/csv;charset=utf-8," + "name,email,department,password\nDr. Smith,smith@clg.edu,CSE,securepass";
    const link = document.createElement("a"); link.href = encodeURI(csvContent); link.download = "teacher_full_import.csv"; document.body.appendChild(link); link.click();
}

// DEPARTMENT
async function handleAddSingleDept(e) {
    e.preventDefault();
    const id = document.getElementById('addDeptId').value;
    const name = document.getElementById('addDeptName').value;
    const session = document.getElementById('addDeptSession').value;
    const pass = document.getElementById('addDeptPassword').value;
    const email = `${id}@dept.fms.local`;

    try {
        const uid = await createUserInSecondaryApp(email, pass);
        await db.collection('users').doc(uid).set({
            uid: uid, name: name, email: email, role: 'department', status: 'approved',
            deptId: id, session: session, createdAt: new Date()
        });
        alert("Department Account Created."); e.target.reset();
    } catch (e) { alert("Error: " + e.message); }
}


// --- Approvals (FIXED) ---
function loadApprovals() {
    const listContainer = document.getElementById('approvals-list-container');
    listContainer.innerHTML = 'Loading...';
    // Fix: Clear array to prevent dupes if called multiple times
    db.collection('users').where('status', '==', 'pending').onSnapshot(snap => {
        allPendingUsers = [];
        snap.forEach(doc => allPendingUsers.push({ id: doc.id, ...doc.data() }));
        renderApprovals('all');
    });
}
function filterApprovals(role, tabEl) {
    document.querySelectorAll('.sub-tab').forEach(el => el.classList.remove('active'));
    tabEl.classList.add('active');
    renderApprovals(role);
}
function renderApprovals(filterRole) {
    const container = document.getElementById('approvals-list-container');
    const filtered = filterRole === 'all' ? allPendingUsers : allPendingUsers.filter(u => u.role === filterRole);

    if (filtered.length === 0) { container.innerHTML = `<p style="padding:1rem;">No pending requests for ${filterRole}.</p>`; return; }
    let html = '<table class="w-full"><thead><tr><th>Name</th><th>Role</th><th>Info</th><th>Actions</th></tr></thead><tbody>';
    filtered.forEach(u => {
        // Ensure buttons have correct ID
        html += `<tr>
            <td><strong>${u.name}</strong><br><small>${u.email}</small></td>
            <td><span class="pill pill-pending">${u.role.toUpperCase()}</span></td>
            <td>${u.role === 'student' ? u.regNum : (u.deptId || 'N/A')}</td>
            <td>
                <button class="btn btn-primary" onclick="approveUser('${u.id}')">Approve</button> 
                <button class="btn btn-outline" onclick="rejectUser('${u.id}')">Reject</button>
            </td>
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

// EXPOSE TO WINDOW FOR ONCLICK TO WORK
window.approveUser = async (uid) => {
    try { await db.collection('users').doc(uid).update({ status: 'approved' }); } catch (e) { console.error(e); }
};
window.rejectUser = async (uid) => {
    if (!confirm("Permantently remove this request?")) return;
    try { await db.collection('users').doc(uid).delete(); } catch (e) { console.error(e); }
};

// Init
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadActivityFeed();
    loadProfile();
});
function loadProfile() { const u = firebase.auth().currentUser; if (u && document.getElementById('profile-email')) document.getElementById('profile-email').innerText = u.email; }
