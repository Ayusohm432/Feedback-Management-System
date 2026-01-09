/**
 * js/admin.js
 * Logic for Admin Dashboard - Stats, User Management, Approvals, Analytics
 */

// --- Global Data Cache ---
let allPendingUsers = [];
let allStudents = [];
let allTeachers = [];

// --- Tab Switching Logic ---
function switchTab(tabName, linkEl) {
    // 1. Update Sidebar
    document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));
    linkEl.classList.add('active');

    // 2. Update Content
    document.querySelectorAll('.tab-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');

    // 3. Update Title
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

    // 4. Trigger Data Load if needed
    if (tabName === 'dashboard') { loadStats(); loadActivityFeed(); }
    if (tabName === 'analytics') loadAnalytics();
    if (tabName === 'feedback') loadFeedbackExplorer();
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

function loadActivityFeed() {
    const feed = document.getElementById('activity-feed');
    // In a real app, query a separate 'audit_logs' collection.
    // Here we simulate activity based on recent user creations using 'users' collection timestamp
    // Assuming createdAt exists.

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
    // Determine Department Performance (Avg Rating per Dept)
    // 1. Fetch all feedback
    const feedbackSnap = await db.collection('feedback').get();
    const deptRatings = {}; // { 'CSE': [4, 5, 3], 'ECE': [2, 4] }

    feedbackSnap.forEach(doc => {
        const d = doc.data();
        // Assuming feedback has 'department' field (or we fetch teacher->dept)
        // Let's assume teacher doc has dept, feedback has teacher_id. 
        // For simplicity in this demo, feedback has 'department' field or we group by feedback content.
        let dept = d.department || 'General';
        if (!deptRatings[dept]) deptRatings[dept] = [];
        deptRatings[dept].push(Number(d.rating));
    });

    const labels = Object.keys(deptRatings);
    const data = labels.map(dept => {
        const ratings = deptRatings[dept];
        const sum = ratings.reduce((a, b) => a + b, 0);
        return (sum / ratings.length).toFixed(1);
    });

    // Render Bar Chart
    const ctx1 = document.getElementById('deptChart').getContext('2d');
    if (deptChartInstance) deptChartInstance.destroy();

    deptChartInstance = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: labels.length ? labels : ['No Data'],
            datasets: [{
                label: 'Avg Rating',
                data: data.length ? data : [0],
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                borderColor: 'rgb(59, 130, 246)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, max: 5 } }
        }
    });

    // Render Participation Doughnut
    // Dummy Logic for Demo: 60% participated
    const ctx2 = document.getElementById('participationChart').getContext('2d');
    if (partChartInstance) partChartInstance.destroy();

    partChartInstance = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: ['Submitted', 'Pending'],
            datasets: [{
                data: [65, 35], // Mock data as getting exact aggregations requires heavy queries
                backgroundColor: ['#10b981', '#e5e7eb']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// --- 3. Feedback Explorer ---
function loadFeedbackExplorer() {
    const filter = document.getElementById('feedbackFilter').value;
    const container = document.getElementById('feedback-explorer-container');

    let query = db.collection('feedback').orderBy('submitted_at', 'desc').limit(20);

    if (filter === 'low') query = db.collection('feedback').where('rating', '<', 3).limit(20);
    if (filter === 'high') query = db.collection('feedback').where('rating', '>', 4).limit(20);

    container.innerHTML = "Fetching...";

    query.get().then(snap => {
        if (snap.empty) { container.innerHTML = "No feedback matches criteria."; return; }

        let html = '<div style="display:grid; gap:1rem;">';
        snap.forEach(doc => {
            const f = doc.data();
            const color = f.rating < 3 ? '#ef4444' : (f.rating > 4 ? '#22c55e' : '#f59e0b');
            html += `
                <div style="background:#fff; padding:1rem; border:1px solid #eee; border-left: 4px solid ${color}; border-radius:4px;">
                    <div style="display:flex; justify-content:space-between;">
                        <strong>${f.subject || 'Subject'}</strong>
                        <span style="font-weight:bold; color:${color}">${f.rating}/5</span>
                    </div>
                    <p style="margin:0.5rem 0; color:#444;">"${f.comments}"</p>
                    <small style="color:#999;">To: Teacher ID ${f.teacher_id} | Dept: ${f.department || 'N/A'}</small>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    }).catch(err => {
        // Index errors common with compound queries
        if (err.message.includes("requires an index")) {
            container.innerHTML = `<p style="color:orange">System Notice: This query requires a Firestore Index. <br>Please create one in Firebase Console for 'feedback' (rating + submitted_at).</p>`;
        } else {
            console.error(err);
        }
    });
}

// --- 4. User Tables & Search ---
function loadUserTable(role, containerId) {
    const container = document.getElementById(containerId);
    // container.innerHTML = "Fetching data..."; // Don't wipe if search

    db.collection('users').where('role', '==', role).where('status', '==', 'approved').onSnapshot(snap => {
        let users = [];
        snap.forEach(doc => users.push(doc.data()));

        // Cache for search
        if (role === 'student') allStudents = users;
        // ... cache others if needed

        renderUserTable(users, role, container);
    });
}

function renderUserTable(users, role, container) {
    if (users.length === 0) { container.innerHTML = "No users."; return; }

    let headers = ['Name', 'Email'];
    if (role === 'student') headers.push('Reg No', 'Dept');
    if (role === 'department') headers.push('Dept ID');

    let html = `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;

    users.forEach(u => {
        html += `<tr>
            <td>${u.name}</td>
            <td>${u.email}</td>
            ${role === 'student' ? `<td>${u.regNum || '-'}</td><td>${u.department || '-'}</td>` : ''}
            ${role === 'department' ? `<td>${u.deptId || '-'}</td>` : ''}
            ${role === 'teacher' ? `<td>${u.department || '-'}</td>` : ''}
        </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// Search Handler (Global or Tab Specific)
function handleGlobalSearch(query) {
    const term = query.toLowerCase();

    // Simplistic: Only searching loaded students currently
    // Implementing client-side search on the active tab is usually better
    // For now, let's just log or try to filter the active table

    // If Students Tab Active:
    if (document.getElementById('tab-students').classList.contains('active')) {
        const filtered = allStudents.filter(u =>
            u.name.toLowerCase().includes(term) ||
            u.email.toLowerCase().includes(term) ||
            (u.regNum && u.regNum.toLowerCase().includes(term))
        );
        renderUserTable(filtered, 'student', document.getElementById('students-table-container'));
    }
}


// --- 5. Approvals (Existing Logic) ---
function loadApprovals() {
    const listContainer = document.getElementById('approvals-list-container');
    listContainer.innerHTML = 'Loading...';

    db.collection('users').where('status', '==', 'pending').onSnapshot(snap => {
        allPendingUsers = [];
        snap.forEach(doc => allPendingUsers.push({ id: doc.id, ...doc.data() }));
        renderApprovals('all'); // Default view
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

    if (filtered.length === 0) {
        container.innerHTML = `<p style="padding:1rem; color:#666;">No pending requests for ${filterRole}.</p>`;
        return;
    }

    let html = '<table class="w-full"><thead><tr><th>Name</th><th>Role</th><th>Info</th><th>Actions</th></tr></thead><tbody>';

    filtered.forEach(u => {
        const info = u.role === 'student' ? `Reg: ${u.regNum}` : (u.deptId || 'N/A');
        html += `
            <tr>
                <td><strong>${u.name}</strong><br><small>${u.email}</small></td>
                <td><span class="pill pill-pending">${u.role.toUpperCase()}</span></td>
                <td>${info}</td>
                <td>
                    <button class="btn btn-primary" style="padding:0.25rem 0.75rem; font-size:0.8rem;" onclick="approveUser('${u.id}')">Approve</button>
                    <button class="btn btn-outline" style="padding:0.25rem 0.75rem; font-size:0.8rem; border-color:#ef4444; color:#ef4444;" onclick="rejectUser('${u.id}')">Reject</button>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// User Actions
window.approveUser = async (uid) => {
    try { await db.collection('users').doc(uid).update({ status: 'approved' }); } catch (e) { console.error(e); }
};
window.rejectUser = async (uid) => {
    if (!confirm("Permantently remove this request?")) return;
    try { await db.collection('users').doc(uid).delete(); } catch (e) { console.error(e); }
};

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadActivityFeed();
    loadProfile();
});

function loadProfile() {
    const user = firebase.auth().currentUser;
    if (user && document.getElementById('profile-email')) {
        document.getElementById('profile-email').innerText = user.email;
    }
}

// Bulk Upload & Single Add
async function handleAddSingleStudent(e) {
    e.preventDefault();
    const reg = document.getElementById('addRegNum').value;
    const name = document.getElementById('addName').value;
    const dept = document.getElementById('addDept').value;
    const email = `${reg}@student.fms.local`;

    try {
        await db.collection('students').doc(reg).set({
            student_id: reg, student_name: name, department: dept, email: email,
            has_submitted: false
        });
        alert("Added to Roster.");
        e.target.reset();
    } catch (err) { alert("Error adding student."); }
}

function downloadSample() {
    const csvContent = "data:text/csv;charset=utf-8," + "student_id,student_name,department\n2024001,John Doe,CSE";
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "student_sample.csv";
    document.body.appendChild(link);
    link.click();
}

async function handleBulkUpload() {
    const file = document.getElementById('csvFile').files[0];
    if (!file) return alert("Select file first");

    const status = document.getElementById('uploadStatus');
    status.innerText = "Parsing...";

    Papa.parse(file, {
        header: true,
        complete: async function (results) {
            const batch = db.batch();
            let count = 0;
            results.data.forEach(row => {
                const id = row['student_id'];
                if (id) {
                    const ref = db.collection('students').doc(id.toString());
                    batch.set(ref, {
                        student_id: id, student_name: row['student_name'], department: row['department'],
                        email: `${id}@student.fms.local`
                    });
                    count++;
                }
            });
            if (count > 0) { await batch.commit(); alert(`Uploaded ${count} students.`); }
            status.innerText = "Done.";
        }
    });
}
