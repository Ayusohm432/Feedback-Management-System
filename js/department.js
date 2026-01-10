/**
 * js/department.js
 * Logic for Department Dashboard
 */

let currentDeptId = null; // e.g., "105"
let currentDeptDoc = null;
let allMyTeachers = [];
let allDeptStudents = []; // Cache for student management logic

// Init
document.addEventListener('DOMContentLoaded', async () => {
    firebase.auth().onAuthStateChanged(async user => {
        if (user) {
            // Fetch Dept Details
            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists) {
                currentDeptDoc = doc.data();
                currentDeptId = currentDeptDoc.deptId || currentDeptDoc.department;

                // Init UI
                const dName = getDeptName(currentDeptId) || currentDeptDoc.name;
                document.getElementById('dept-name-display').innerText = dName;
                document.getElementById('dept-email-display').innerText = user.email;
                document.getElementById('dept-avatar').src = `https://ui-avatars.com/api/?name=${dName}&background=10b981&color=fff`;

                // Active Session Logic
                const actSess = currentDeptDoc.activeSession || 'NOT SET';
                document.getElementById('current-session-display').innerText = `Active Session: ${actSess}`;
                document.getElementById('pSessionDisplay').innerText = actSess;
                if (document.getElementById('sSession')) document.getElementById('sSession').value = actSess;

                // Load Data
                // Profile Section
                document.getElementById('pNameDisplay').innerText = dName;
                document.getElementById('pEmailDisplay').innerText = user.email;
                document.getElementById('pIdDisplay').innerText = currentDeptId;
                document.getElementById('profile-avatar-large').src = `https://ui-avatars.com/api/?name=${dName}&background=10b981&color=fff&size=200`;
                loadDeptStats();
                loadDeptTeachers();
                loadDeptStudents();
                loadDeptApprovals();
                loadDeptFeedback();
                loadSessionsList();
                loadRecentActivity();
            } else {
                alert("Department profile not found.");
                logout();
            }
        }
    });
});

function getDeptName(code) {
    const map = {
        '101': 'Civil Engineering',
        '103': 'Mechanical Engineering',
        '104': 'EEE',
        '105': 'CSE',
        '106': 'ECE'
    };
    return map[code] || code;
}

function switchTab(tab, el) {
    document.querySelectorAll('.sidebar-link').forEach(a => a.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    document.getElementById('pageTitle').innerText = tab.charAt(0).toUpperCase() + tab.slice(1);

    if (tab === 'analytics') loadDeptAnalytics();
    if (tab === 'feedback') loadDeptFeedback();
    if (tab === 'sessions') loadSessionsList();
}

// --- 1. SESSIONS MGMT ---
function loadSessionsList() {
    const arr = currentDeptDoc.sessionsHistory || [];
    const container = document.getElementById('sessions-list-container');
    if (!arr.length) { container.innerHTML = "<p>No sessions created yet.</p>"; return; }

    let html = '<table class="w-full"><thead><tr><th>Session</th><th>Status</th><th>Action</th></tr></thead><tbody>';
    arr.forEach(s => {
        const isActive = s === currentDeptDoc.activeSession;
        html += `<tr>
            <td><strong>${s}</strong></td>
            <td>${isActive ? '<span class="pill pill-active">Active</span>' : '<span style="color:#999;">Inactive</span>'}</td>
            <td>
                ${!isActive ? `<button class="btn btn-outline" style="padding:0.25rem 0.5rem; font-size:0.8em;" onclick="setActiveSession('${s}')">Set Active</button>` : 'Selected'}
            </td>
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

async function createNewSession() {
    const s = document.getElementById('newSessionName').value.trim();
    if (!s) return alert("Enter session name");
    if (currentDeptDoc.sessionsHistory?.includes(s)) return alert("Session exists");

    try {
        await db.collection('users').doc(firebase.auth().currentUser.uid).update({
            activeSession: s,
            sessionsHistory: firebase.firestore.FieldValue.arrayUnion(s)
        });
        alert(`Session ${s} created and set active.`);
        window.location.reload();
    } catch (e) { console.error(e); alert("Error"); }
}

async function setActiveSession(s) {
    if (!confirm(`Set ${s} as active?`)) return;
    try {
        await db.collection('users').doc(firebase.auth().currentUser.uid).update({ activeSession: s });
        window.location.reload();
    } catch (e) { console.error(e); }
}

// --- 2. DATA LOADING ---

function loadDeptStats() {
    db.collection('users').where('department', '==', currentDeptId).onSnapshot(snap => {
        let sc = 0, tc = 0;
        snap.forEach(d => {
            if (d.data().role === 'student') sc++;
            if (d.data().role === 'teacher') tc++;
        });
        document.getElementById('stat-students').innerText = sc;
        document.getElementById('stat-teachers').innerText = tc;
    });
    // Count feedback by index if possible, else manual count in analytics
}

function loadRecentActivity() {
    // Client-side sort to avoid composite index requirement
    db.collection('users').where('department', '==', currentDeptId).onSnapshot(snap => {
        const container = document.getElementById('dept-activity-feed');
        if (snap.empty) {
            container.innerHTML = "<p style='color:#666; font-style:italic;'>No recent activity.</p>";
            return;
        }

        // Snapshot to array
        let users = [];
        snap.forEach(doc => users.push(doc.data()));

        // Sort descending by time
        users.sort((a, b) => {
            const tA = a.createdAt ? a.createdAt.seconds : 0;
            const tB = b.createdAt ? b.createdAt.seconds : 0;
            return tB - tA;
        });

        // Top 5
        users = users.slice(0, 5);

        let html = '';
        users.forEach(d => {
            const date = d.createdAt ? new Date(d.createdAt.seconds * 1000).toLocaleDateString() : 'Just now';

            let icon = 'ri-notification-line';
            let color = '#666';
            let bg = '#f1f5f9';

            if (d.role === 'student') { icon = 'ri-user-smile-line'; color = '#2563eb'; bg = '#dbeafe'; }
            if (d.role === 'teacher') { icon = 'ri-user-star-line'; color = '#9333ea'; bg = '#f3e8ff'; }

            html += `
            <div class="activity-item">
                <div class="activity-icon" style="background:${bg}; color:${color};">
                    <i class="${icon}"></i>
                </div>
                <div>
                    <div style="font-size:0.95rem; font-weight:500;">New ${d.role} Registration</div>
                    <div style="font-size:0.85em; color:#666;">${d.name} joined.</div>
                    <small style="color:#999; font-size:0.75em;">${date}</small>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    });
}

function loadDeptTeachers() {
    db.collection('users')
        .where('role', '==', 'teacher')
        .where('department', '==', currentDeptId)
        .onSnapshot(snap => {
            allMyTeachers = [];
            const container = document.getElementById('dept-teachers-list');
            if (snap.empty) { container.innerHTML = "<p>No teachers.</p>"; return; }

            let html = '<table class="w-full"><thead><tr><th>Name</th><th>Email</th><th>Reviews</th><th>Subjects</th></tr></thead><tbody>';
            snap.forEach(doc => {
                const t = { id: doc.id, ...doc.data() };
                allMyTeachers.push(t);
                html += `<tr>
                    <td>${t.name}</td>
                    <td>${t.email}</td>
                    <td>
                        <label class="switch">
                            <input type="checkbox" ${t.isReviewOpen ? 'checked' : ''} onchange="toggleTeacherReview('${t.id}', this.checked)">
                            <span class="slider round"></span>
                        </label>
                        <span style="font-size:0.8em; margin-left:0.5rem; color:${t.isReviewOpen ? '#16a34a' : '#999'}">${t.isReviewOpen ? 'Open' : 'Closed'}</span>
                    </td>
                    <td><button class="btn btn-sm btn-outline" onclick="openSubjectModal('${t.id}')">Manage</button></td>
                </tr>`;
            });
            html += '</tbody></table>';
            container.innerHTML = html;

            // Populate Filters
            const sel = document.getElementById('fbFilterTeacher');
            const curr = sel.value;
            sel.innerHTML = '<option value="all">All Teachers</option>';
            allMyTeachers.forEach(t => sel.innerHTML += `<option value="${t.id}">${t.name}</option>`);
            sel.value = curr;
        });
}

function loadDeptStudents() {
    db.collection('users')
        .where('role', '==', 'student')
        .where('department', '==', currentDeptId)
        .onSnapshot(snap => {
            allDeptStudents = []; // Reset
            const container = document.getElementById('dept-students-list');
            container.innerHTML = 'Loading students...';

            // Store raw objects
            allDeptStudents = [];
            snap.forEach(doc => {
                allDeptStudents.push({ id: doc.id, ...doc.data() });
            });

            // Initial Filter/Render
            filterDeptStudentList();
        });
}

function filterDeptStudentList() {
    const filterYear = document.getElementById('deptStudentYearFilter') ? document.getElementById('deptStudentYearFilter').value : 'all';
    const filterSem = document.getElementById('deptStudentSemFilter') ? document.getElementById('deptStudentSemFilter').value : 'all';
    const container = document.getElementById('dept-students-list');

    let filtered = allDeptStudents;

    if (filterYear !== 'all') {
        filtered = filtered.filter(s => (s.year || '1').toString() === filterYear);
    }
    if (filterSem !== 'all') {
        filtered = filtered.filter(s => (s.semester || '1').toString() === filterSem);
    }

    renderStudentTable(filtered, container);
}

function renderStudentTable(students, container) {
    if (students.length === 0) { container.innerHTML = "<p>No particular students found.</p>"; return; }

    let html = '<table class="w-full"><thead><tr><th><input type="checkbox" onchange="toggleAllStudents(this)"></th><th>Reg No</th><th>Name</th><th>Year/Sem</th><th>Session</th></tr></thead><tbody>';
    students.forEach(s => {
        html += `<tr>
            <td><input type="checkbox" class="student-checkbox" value="${s.id}"></td>
            <td>${s.regNum}</td>
            <td>${s.name}</td>
            <td>Y${s.year || '1'}-S${s.semester || '1'}</td>
            <td>${s.session}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

async function loadDeptFeedback() {
    const container = document.getElementById('dept-feedback-container');
    container.innerHTML = 'Loading feedback...';

    // Client-side filtering filter on recent 100
    // Fetch
    let query = db.collection('feedback').where('department', '==', currentDeptId).orderBy('submitted_at', 'desc').limit(100);

    try {
        const snap = await query.get();
        if (snap.empty) { container.innerHTML = "No feedback for this department."; return; }

        const fTeacher = document.getElementById('fbFilterTeacher').value;
        const fRating = document.getElementById('fbFilterRating').value;
        const fYear = document.getElementById('fbFilterYear') ? document.getElementById('fbFilterYear').value : 'all';
        const fSem = document.getElementById('fbFilterSemester') ? document.getElementById('fbFilterSemester').value : 'all';

        let html = '';
        snap.forEach(doc => {
            const d = doc.data();
            let show = true;
            if (fTeacher !== 'all' && d.teacher_id !== fTeacher) show = false;
            if (fRating === 'low' && d.rating >= 3) show = false;
            if (fRating === 'high' && d.rating <= 3) show = false;
            if (fYear !== 'all' && (d.year || '1') !== fYear) show = false;
            if (fSem !== 'all' && (d.semester || '1') !== fSem) show = false;

            if (show) {
                // Match Admin Dashboard Card Style
                const tName = allMyTeachers.find(t => t.id === d.teacher_id)?.name || 'Unknown Faculty';
                const date = d.submitted_at ? new Date(d.submitted_at.seconds * 1000).toLocaleDateString() : 'N/A';

                let colorClass = '#f59e0b';
                let statusClass = 'neutral';
                if (d.rating <= 2) { colorClass = '#ef4444'; statusClass = 'negative'; }
                if (d.rating >= 4) { colorClass = '#10b981'; statusClass = 'positive'; }

                html += `
                    <div class="feedback-card ${statusClass}">
                        <div class="feedback-header">
                            <div style="display:flex; align-items:center; gap:0.5rem;">
                                <img src="https://ui-avatars.com/api/?name=${tName}&background=random&size=32" style="width:32px; height:32px; border-radius:50%;">
                                <div style="line-height:1.2;">
                                    <div style="font-weight:600; font-size:0.95rem;">${tName}</div>
                                    <div style="font-size:0.75rem; color:#666;">${d.subject || 'General'}</div>
                                </div>
                            </div>
                            <span class="rating-badge" style="background:${colorClass}20; color:${colorClass}">${d.rating} ★</span>
                        </div>
                        <div class="feedback-body">
                             <!-- Admin uses H4 for subject, but we put it in header subtext for better Dept context where Dept is constant. 
                                  If we want exact match, we can put it here too, but let's keep Body for comments. 
                                  Actually, Admin puts Subject in Body H4. Let's do that for strict consistency if user insists?
                                  User said "Make it similar". 
                                  My previous plan: Header=Name+Subject. Body=Comment. 
                                  Admin Plan: Header=Name+Dept. Body=Subject+Comment.
                                  Since Dept is constant here, using Subject in Header is smarter use of space. 
                                  I will put Subject in Header subtext, and clear Body for just comment. -->
                            <p style="color:#475569; font-size:0.95em; line-height:1.5;">"${d.comments || ''}"</p>
                        </div>
                        <div class="feedback-footer">
                            <span><i class="ri-calendar-line"></i> ${date}</span>
                            <span>${d.session || '-'} | Y${d.year || '-'}</span>
                        </div>
                    </div>
                `;
            }
        });
        container.innerHTML = html || '<p style="grid-column:1/-1; text-align:center;">No feedback matches filters.</p>';
    } catch (e) {
        console.error(e);
        container.innerHTML = `Error: ${e.message}`;
    }
}

// Split Approvals
function loadDeptApprovals() {
    const sContainer = document.getElementById('dept-approvals-students');
    const tContainer = document.getElementById('dept-approvals-teachers');
    if (!sContainer || !tContainer) return;

    db.collection('users').where('department', '==', currentDeptId).where('status', '==', 'pending').onSnapshot(snap => {
        let sHTML = '<table class="w-full"><thead><tr><th>Name</th><th>Reg No</th><th>Action</th></tr></thead><tbody>';
        let tHTML = '<table class="w-full"><thead><tr><th>Name</th><th>Email</th><th>Action</th></tr></thead><tbody>';

        let sCount = 0, tCount = 0;

        snap.forEach(doc => {
            const u = doc.data();
            const actionBtns = `
                 <button class="btn btn-primary" style="padding:0.25rem 0.75rem; font-size:0.8em; border-radius:20px;" onclick="approveUser('${doc.id}')">Approve</button>
                 <button class="btn btn-outline" style="padding:0.25rem 0.75rem; font-size:0.8em; border-radius:20px; color:#ef4444; border-color:#ef4444;" onclick="rejectUser('${doc.id}')">Reject</button>`;

            const pill = `<span style="background:#fef3c7; color:#d97706; padding:0.2rem 0.6rem; border-radius:1rem; font-size:0.75em; font-weight:600;">Pending</span>`;

            if (u.role === 'student') {
                sCount++;
                sHTML += `<tr>
                    <td><div>${u.name}</div><small style="color:#666;">${pill}</small></td>
                    <td>${u.regNum || '-'}</td>
                    <td><div style="display:flex; gap:0.5rem;">${actionBtns}</div></td>
                </tr>`;
            } else if (u.role === 'teacher') {
                tCount++;
                tHTML += `<tr>
                    <td><div>${u.name}</div><small style="color:#666;">${pill}</small></td>
                    <td>${u.email}</td>
                    <td><div style="display:flex; gap:0.5rem;">${actionBtns}</div></td>
                </tr>`;
            }
        });

        sHTML += '</tbody></table>';
        tHTML += '</tbody></table>';

        sContainer.innerHTML = sCount ? sHTML : '<p style="color:#666; padding:1.5rem; text-align:center;">No pending students.</p>';
        tContainer.innerHTML = tCount ? tHTML : '<p style="color:#666; padding:1.5rem; text-align:center;">No pending teachers.</p>';
    });
}

// User Creation
async function handleDeptAddStudent(e) {
    e.preventDefault();
    const reg = document.getElementById('sReg').value.trim();
    const name = document.getElementById('sName').value.trim();
    const pass = document.getElementById('sPass').value;
    const year = document.getElementById('sYear').value;
    const semester = document.getElementById('sSemester').value;
    const session = currentDeptDoc.activeSession;

    if (!session) return alert("Please Create & Set an Active Session first in Sessions tab.");

    const email = `${reg}@student.fms.local`;
    try {
        const uid = await createUserInSecondaryApp(email, pass);
        await db.collection('users').doc(uid).set({
            uid, name, email, role: 'student', status: 'approved',
            regNum: reg, department: currentDeptId, session: session,
            year: year || '1', semester: semester || '1',
            createdAt: new Date()
        });
        alert("Student Created!"); e.target.reset();
        document.getElementById('sSession').value = session;
    } catch (e) { alert(e.message); }
}

async function handleDeptAddTeacher(e) {
    e.preventDefault();
    const name = document.getElementById('tName').value;
    const email = document.getElementById('tEmail').value;
    const pass = document.getElementById('tPass').value;
    try {
        const uid = await createUserInSecondaryApp(email, pass);
        await db.collection('users').doc(uid).set({
            uid, name, email, role: 'teacher', status: 'approved',
            department: currentDeptId, isReviewOpen: false, createdBy: currentDeptId,
            createdAt: new Date()
        });
        alert("Teacher Created!"); e.target.reset();
    } catch (e) { alert(e.message); }
}

async function handleDeptBulkStudent() {
    const file = document.getElementById('bulkStudentFile').files[0];
    if (!file) return alert("Select File");
    const session = currentDeptDoc.activeSession;
    if (!session) return alert("Set Active Session First!");

    Papa.parse(file, {
        header: true, complete: async (res) => {
            let n = 0;
            for (let r of res.data) {
                if (r.student_id && r.password) {
                    try {
                        const email = `${r.student_id}@student.fms.local`;
                        const uid = await createUserInSecondaryApp(email, r.password);
                        await db.collection('users').doc(uid).set({
                            uid, name: r.name, email, role: 'student', status: 'approved',
                            regNum: r.student_id, department: currentDeptId, session: session,
                            year: r.year || '1', semester: r.semester || '1',
                            createdAt: new Date()
                        });
                        n++;
                    } catch (e) { }
                }
            }
            alert(`Imported ${n} students for Session ${session}.`);
        }
    });
}

// Auth Helper
async function createUserInSecondaryApp(email, password) {
    const app = firebase.initializeApp(firebaseConfig, "Secondary");
    try { const uc = await app.auth().createUserWithEmailAndPassword(email, password); await app.delete(); return uc.user.uid; }
    catch (e) { await app.delete(); throw e; }
}

window.approveUser = async (uid) => { await db.collection('users').doc(uid).update({ status: 'approved' }); }
window.rejectUser = async (uid) => { if (confirm("Reject?")) await db.collection('users').doc(uid).delete(); }
window.toggleTeacherReview = async (tid, val) => { await db.collection('users').doc(tid).update({ isReviewOpen: val }); }

// --- 3. ANALYTICS (Redesigned) ---
let dSubChart = null, dPartChart = null, dDistChart = null, dTrendChart = null;

async function loadDeptAnalytics() {
    const feedbackSnap = await db.collection('feedback').where('department', '==', currentDeptId).get();

    // Aggregation Vars
    const subRatings = {};
    const ratingDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const dateTrend = {};

    feedbackSnap.forEach(doc => {
        const d = doc.data();

        // 1. Avg by Subject
        let sub = d.subject || 'General';
        if (!subRatings[sub]) subRatings[sub] = [];
        subRatings[sub].push(Number(d.rating));

        // 2. Distribution
        let r = Math.round(Number(d.rating));
        if (r < 1) r = 1; if (r > 5) r = 5;
        ratingDist[r]++;

        // 3. Trend
        if (d.submitted_at) {
            const dateKey = new Date(d.submitted_at.seconds * 1000).toLocaleDateString();
            dateTrend[dateKey] = (dateTrend[dateKey] || 0) + 1;
        }
    });

    // Chart 1: Subject Performance
    const labels = Object.keys(subRatings);
    const data = labels.map(s => {
        const arr = subRatings[s];
        return (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
    });

    if (dSubChart) dSubChart.destroy();
    dSubChart = new Chart(document.getElementById('deptSubjectChart').getContext('2d'), {
        type: 'bar',
        data: { labels: labels.length ? labels : ['No Data'], datasets: [{ label: 'Avg Rating', data: data.length ? data : [0], backgroundColor: 'rgba(16, 185, 129, 0.5)', borderColor: '#10b981', borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 5 } } }
    });

    // Chart 2: Participation (Dummy vs Real)
    if (dPartChart) dPartChart.destroy();
    dPartChart = new Chart(document.getElementById('deptParticipationChart').getContext('2d'), {
        type: 'doughnut',
        data: { labels: ['Submitted', 'Pending'], datasets: [{ data: [feedbackSnap.size, Math.max(0, 100 - feedbackSnap.size)], backgroundColor: ['#3b82f6', '#e5e7eb'] }] },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Chart 3: Distribution
    const distData = [ratingDist[1], ratingDist[2], ratingDist[3], ratingDist[4], ratingDist[5]];
    if (dDistChart) dDistChart.destroy();
    dDistChart = new Chart(document.getElementById('deptRatingDistChart').getContext('2d'), {
        type: 'polarArea',
        data: {
            labels: ['1 Star', '2 Stars', '3 Stars', '4 Stars', '5 Stars'],
            datasets: [{ data: distData, backgroundColor: ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'] }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Chart 4: Trend
    const sortedDates = Object.keys(dateTrend).sort((a, b) => new Date(a) - new Date(b)).slice(-7);
    const trendData = sortedDates.map(d => dateTrend[d]);
    if (dTrendChart) dTrendChart.destroy();
    dTrendChart = new Chart(document.getElementById('deptTrendChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [{ label: 'Submissions', data: trendData, borderColor: '#8b5cf6', tension: 0.3, fill: true, backgroundColor: 'rgba(139, 92, 246, 0.1)' }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { set: 1 } } } }
    });
}
// --- Manage Subjects Logic ---
let currentManageTeacherId = null;

// Safe lookup
async function openSubjectModal(teacherId) {
    currentManageTeacherId = teacherId;
    document.getElementById('subjectModal').classList.add('active');

    let teacherName = "Teacher";
    if (typeof allMyTeachers !== 'undefined') {
        const t = allMyTeachers.find(u => u.id === teacherId);
        if (t) teacherName = t.name;
    }

    document.getElementById('subjectModalSubtitle').innerText = `Assign subjects to ${teacherName}`;
    loadAssignedSubjects(teacherId);
}

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
            isOpen: true
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


// --- Student Promotion/Demotion Logic (Replicated from Admin) ---

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
    // Uses currently filtered list (we need to filter again or rely on what's visible, but filtering data is safer)
    // Actually, let's grab the already filtered list if possible, or just re-filter.
    // Easier: get unchecked checkboxes

    const visibleIds = Array.from(document.querySelectorAll('.student-checkbox')).map(cb => cb.value);

    if (visibleIds.length === 0) return alert("No students listing.");
    if (!confirm(`Are you sure you want to PROMOTE ALL ${visibleIds.length} listed students?`)) return;

    await processBatchUpdate(visibleIds, 1);
};

async function processBatchUpdate(ids, direction) {
    let successCount = 0;
    let errorCount = 0;

    // Note: In a real app, use a BatchWrite or Cloud Function.
    // Here we loop clientside.
    for (const uid of ids) {
        try {
            const student = allDeptStudents.find(s => s.id === uid);
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
    let newSem = sem + direction;
    let newYear = year;

    if (direction > 0) { // Promoting
        newYear = Math.ceil(newSem / 2);
    } else { // Demoting
        if (newSem < 1) {
            newSem = 1;
            newYear = 1;
        } else {
            newYear = Math.ceil(newSem / 2);
        }
    }

    if (newYear > 4) newYear = 4;

    return { newYear, newSem };
}

// Bind to window
window.openSubjectModal = openSubjectModal;
window.closeSubjectModal = closeSubjectModal;
window.handleAddSubject = handleAddSubject;
window.toggleSubjectStatus = toggleSubjectStatus;

// --- Export Functionality ---

async function exportDeptReportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text(`Department Report: ${document.getElementById('pNameDisplay').innerText}`, 14, 20);
    doc.setFontSize(12);
    doc.text(`Active Session: ${document.getElementById('current-session-display').innerText.split(': ')[1]}`, 14, 30);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 37);

    let yPos = 50;

    // Stats
    const studs = document.getElementById('stat-students').innerText;
    const teachs = document.getElementById('stat-teachers').innerText;
    const fbs = document.getElementById('stat-feedback').innerText;

    doc.text(`Students: ${studs} | Teachers: ${teachs} | Total Feedback: ${fbs}`, 14, yPos);
    yPos += 15;

    // Capture Charts via Canvas
    const charts = [
        { id: 'deptSubjectChart', title: 'Subject Performance' },
        { id: 'deptParticipationChart', title: 'Participation Rate' },
        { id: 'deptTrendChart', title: 'Submission Trend' }
    ];

    for (let c of charts) {
        const canvas = document.getElementById(c.id);
        if (canvas) {
            try {
                if (yPos > 250) { doc.addPage(); yPos = 20; }
                const img = canvas.toDataURL('image/png');
                doc.addImage(img, 'PNG', 14, yPos, 180, 80);
                doc.text(c.title, 14, yPos - 5);
                yPos += 90;
            } catch (e) {
                console.warn("Canvas export error:", e);
            }
        }
    }

    doc.save("Dept_Report.pdf");
}

async function exportTeacherRatingsXLSX() {
    const btn = event.target ? event.target.closest('button') : null;
    let originalText = '';
    if (btn) { originalText = btn.innerHTML; btn.innerHTML = 'Calculating...'; }

    try {
        // Fetch All Feedback for Dept
        const snap = await db.collection('feedback').where('department', '==', currentDeptId).get();
        const teacherStats = {};

        snap.forEach(doc => {
            const d = doc.data();
            const tid = d.teacher_id;
            if (!teacherStats[tid]) teacherStats[tid] = { sum: 0, count: 0 };
            teacherStats[tid].sum += Number(d.rating);
            teacherStats[tid].count++;
        });

        // Map to Teachers list
        const rows = allMyTeachers.map(t => {
            const stats = teacherStats[t.id] || { sum: 0, count: 0 };
            const avg = stats.count ? (stats.sum / stats.count).toFixed(2) : '0.00';
            return {
                "Teacher Name": t.name,
                "Email": t.email,
                "Average Rating": avg,
                "Total Reviews": stats.count
            };
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Teacher Ratings");
        XLSX.writeFile(wb, "Dept_Teacher_Ratings.xlsx");

    } catch (e) {
        console.error(e);
        alert("Export failed.");
    } finally {
        if (btn) btn.innerHTML = originalText;
    }
}

// Global Bind
window.exportDeptReportPDF = exportDeptReportPDF;
window.exportTeacherRatingsXLSX = exportTeacherRatingsXLSX;
