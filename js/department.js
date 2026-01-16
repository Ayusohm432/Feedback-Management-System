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
                const sessions = currentDeptDoc.sessionsList || [];
                const activeB = sessions.find(s => s.degree === 'B.Tech' && s.isActive)?.name || 'None';
                const activeM = sessions.find(s => s.degree === 'M.Tech' && s.isActive)?.name || 'None';
                // Fallback for old data
                const legacyActive = currentDeptDoc.activeSession;
                const displaySess = (sessions.length > 0) ? `B.Tech: ${activeB} | M.Tech: ${activeM}` : `Active: ${legacyActive || 'None'}`;

                document.getElementById('current-session-display').innerText = displaySess;
                // document.getElementById('pSessionDisplay').innerText = actSess; // Removed as it might be complex to display single
                // Auto-fill session if only one active? handled in addStudent dynamically

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
const VALIDATORS = {
    regNum: (val) => /^\d{11}$/.test(val) || "Registration Number must be 11 digits.",
    password: (val) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(val) || "Password too weak. (Min 8 chars, Upper, Lower, Num, Special)",
    session: (val) => {
        if (!/^\d{4}-\d{2}$/.test(val)) return "Session format: YYYY-YY (e.g. 2023-27)";
        const [y, yy] = val.split('-').map(Number);
        const startYY = y % 100;
        return (yy === startYY + 4) || "Session duration must be 4 years (e.g., 23-27).";
    }
};

function loadSessionsList() {
    // Migrating to sessionsList (Array of Objects: {name, degree, isActive})
    // If old sessionsHistory (Array of Strings) exists, we might need to display them or migrate.
    // For now, prefer sessionsList.
    let list = currentDeptDoc.sessionsList || [];

    // Compatibility: If list empty but history exists, show history as 'Unknown Degree' or 'B.Tech' default?
    if (list.length === 0 && currentDeptDoc.sessionsHistory) {
        list = currentDeptDoc.sessionsHistory.map(s => ({ name: s, degree: 'B.Tech', isActive: s === currentDeptDoc.activeSession }));
    }

    const container = document.getElementById('sessions-list-container');
    if (!list.length) { container.innerHTML = "<p>No sessions created yet.</p>"; return; }

    let html = '<table class="w-full"><thead><tr><th>Session</th><th>Degree</th><th>Status</th><th>Action</th></tr></thead><tbody>';
    list.forEach(s => {
        html += `<tr>
            <td><strong>${s.name}</strong></td>
             <td>${s.degree || 'B.Tech'}</td>
            <td>${s.isActive ? '<span class="pill pill-active">Active</span>' : '<span style="color:#999;">Inactive</span>'}</td>
            <td>
                ${!s.isActive ? `<button class="btn btn-outline" style="padding:0.25rem 0.5rem; font-size:0.8em;" onclick="setActiveSession('${s.name}', '${s.degree}')">Set Active</button>` : 'Selected'}
            </td>
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

async function createNewSession() {
    const s = document.getElementById('newSessionName').value.trim();
    const deg = document.getElementById('newSessionDegree').value;
    if (!s) return alert("Enter session name");

    // Validate Session
    const vSess = VALIDATORS.session(s);
    if (vSess !== true) return alert(vSess);

    let list = currentDeptDoc.sessionsList || [];
    if (list.some(x => x.name === s && x.degree === deg)) return alert("Session exists for this degree");

    try {
        // Deactivate other sessions of same degree
        list = list.map(item => {
            if (item.degree === deg) return { ...item, isActive: false };
            return item;
        });

        // Add new
        list.push({ name: s, degree: deg, isActive: true });

        // Update activeSession string for legacy/global support if needed? 
        // Maybe just keep 'activeSession' as the LAST created one, or remove usage.
        // We'll update 'sessionsList'.

        await db.collection('users').doc(firebase.auth().currentUser.uid).update({
            sessionsList: list,
            // Update legacy fields to prevent errors in other parts if they rely on it, 
            // though we should move away from them.
            activeSession: s,
            sessionsHistory: firebase.firestore.FieldValue.arrayUnion(s)
        });
        alert(`Session ${s} (${deg}) created and set active.`);
        window.location.reload();
    } catch (e) { console.error(e); alert("Error"); }
}

async function setActiveSession(name, degree) {
    if (!confirm(`Set ${name} as active for ${degree}?`)) return;
    try {
        let list = currentDeptDoc.sessionsList || [];
        // Compatibility migration if empty
        if (list.length === 0 && currentDeptDoc.sessionsHistory) {
            list = currentDeptDoc.sessionsHistory.map(s => ({ name: s, degree: 'B.Tech', isActive: s === currentDeptDoc.activeSession }));
        }

        list = list.map(item => {
            if (item.degree === degree) {
                return { ...item, isActive: item.name === name };
            }
            return item;
        });

        await db.collection('users').doc(firebase.auth().currentUser.uid).update({
            sessionsList: list,
            activeSession: name // Legacy compat
        });
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
    const filterDegree = document.getElementById('deptStudentDegreeFilter') ? document.getElementById('deptStudentDegreeFilter').value : 'all';
    const filterSem = document.getElementById('deptStudentSemFilter') ? document.getElementById('deptStudentSemFilter').value : 'all';
    const container = document.getElementById('dept-students-list');

    let filtered = allDeptStudents;

    if (filterDegree !== 'all') {
        filtered = filtered.filter(s => (s.degree || 'B.Tech') === filterDegree);
    }
    if (filterSem !== 'all') {
        filtered = filtered.filter(s => (s.semester || '1').toString() === filterSem);
    }

    renderStudentTable(filtered, container);
}

function renderStudentTable(students, container) {
    if (students.length === 0) { container.innerHTML = "<p>No particular students found.</p>"; return; }

    let html = '<table class="w-full"><thead><tr><th><input type="checkbox" onchange="toggleAllStudents(this)"></th><th>Reg No</th><th>Name</th><th>Degree/Sem</th><th>Session</th></tr></thead><tbody>';
    students.forEach(s => {
        html += `<tr>
            <td><input type="checkbox" class="student-checkbox" value="${s.id}"></td>
            <td>${s.regNum}</td>
            <td>${s.name}</td>
            <td>${s.degree || 'B.Tech'}-S${s.semester || '1'}</td>
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
        const fDegree = document.getElementById('fbFilterDegree') ? document.getElementById('fbFilterDegree').value : 'all';
        const fSem = document.getElementById('fbFilterSemester') ? document.getElementById('fbFilterSemester').value : 'all';

        let html = '';
        snap.forEach(doc => {
            const d = doc.data();
            let show = true;
            if (fTeacher !== 'all' && d.teacher_id !== fTeacher) show = false;
            if (fRating === 'low' && d.rating >= 3) show = false;
            if (fRating === 'high' && d.rating <= 3) show = false;
            if (fDegree !== 'all' && (d.degree || 'B.Tech') !== fDegree) show = false;
            if (fSem !== 'all' && (d.semester || '1').toString() !== fSem) show = false;

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
                            <span>${d.session || '-'} | ${d.degree || 'B.Tech'} S${d.semester || '-'}</span>
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
    const degree = document.getElementById('sDegree').value;
    const semester = document.getElementById('sSemester').value;

    // Find active session for this degree
    let session = null;
    if (currentDeptDoc.sessionsList) {
        session = currentDeptDoc.sessionsList.find(s => s.degree === degree && s.isActive)?.name;
    } else {
        // Fallback
        session = currentDeptDoc.activeSession;
    }

    if (!session) return alert(`No Active Session found for ${degree}. Please set one in Sessions tab.`);

    const email = `${reg}@student.fms.local`;
    try {
        // Validation
        const vReg = VALIDATORS.regNum(reg); if (vReg !== true) throw new Error(vReg);
        const vPass = VALIDATORS.password(pass); if (vPass !== true) throw new Error(vPass);

        // Check Duplicates
        const dupReg = await db.collection('users').where('regNum', '==', reg).get();
        if (!dupReg.empty) throw new Error("Student with this Register Number already exists.");

        const dupEmail = await db.collection('users').where('email', '==', email).get();
        if (!dupEmail.empty) throw new Error("User with this Email already exists.");

        const uid = await createUserInSecondaryApp(email, pass);
        await db.collection('users').doc(uid).set({
            uid, name, email, role: 'student', status: 'approved',
            regNum: reg, department: currentDeptId, session: session,
            degree: degree, semester: semester || '1',
            year: Math.ceil((semester || 1) / 2).toString(), // Compat
            createdAt: new Date()
        });
        alert("Student Created!"); e.target.reset();
        document.getElementById('sSession').value = session;
        // Reset Semester
        document.getElementById('sSemester').innerHTML = '<option value="" disabled selected>Sem</option>';
    } catch (e) { alert(e.message); }
}

async function handleDeptAddTeacher(e) {
    e.preventDefault();
    const name = document.getElementById('tName').value;
    const email = document.getElementById('tEmail').value;
    const pass = document.getElementById('tPass').value;
    try {
        // Validation
        const vPass = VALIDATORS.password(pass); if (vPass !== true) throw new Error(vPass);

        // Check Duplicate
        const dupEmail = await db.collection('users').where('email', '==', email).get();
        if (!dupEmail.empty) throw new Error("Teacher with this Email already exists.");

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
                            degree: r.degree || 'B.Tech', semester: r.semester || '1',
                            year: Math.ceil((r.semester || 1) / 2).toString(),
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

window.approveUser = async (uid) => {
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (!userDoc.exists) return;
        const u = userDoc.data();

        if (u.role === 'student' && u.department && u.session && u.degree) {
            // We are in Department Dashboard, so 'currentDeptDoc' and 'currentDeptId' should be available globally or we fetch.
            // Using logic similar to admin.js for safety, or relying on currentDeptDoc if available?
            // currentDeptDoc is loaded in Department Dashboard.
            if (currentDeptDoc && currentDeptId === u.department) {
                let sessions = currentDeptDoc.sessionsList || [];
                const exists = sessions.find(s => s.name === u.session && s.degree === u.degree);

                if (!exists) {
                    sessions.push({
                        name: u.session,
                        degree: u.degree,
                        isActive: false
                    });
                    // Update Local and DB
                    currentDeptDoc.sessionsList = sessions; // Optimistic update
                    await db.collection('users').doc(firebase.auth().currentUser.uid).update({ sessionsList: sessions });
                }
            }
        }
        await db.collection('users').doc(uid).update({ status: 'approved' });
    } catch (e) { console.error(e); alert("Error: " + e.message); }
}
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

    // Populate Session Dropdown
    const sessSel = document.getElementById('assignSubSession');
    sessSel.innerHTML = '<option value="">Select Session</option>';

    // currentDeptDoc should be available globally in department.js
    if (typeof currentDeptDoc !== 'undefined') {
        const sessions = currentDeptDoc.sessionsList || [];
        // Fallback legacy
        if (currentDeptDoc.session && !sessions.find(s => s.name === currentDeptDoc.session)) {
            sessions.push({ name: currentDeptDoc.session, isActive: true });
        }
        sessions.forEach(s => {
            sessSel.innerHTML += `<option value="${s.name}">${s.name}</option>`;
        });
    }

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
    const limits = (typeof SEMESTERS !== 'undefined') ? SEMESTERS : { 'B.Tech': 8, 'M.Tech': 4 };
    const maxSem = limits[degree] || 8; // Default B.Tech

    if (newSem > maxSem) newSem = maxSem;
    if (newSem < 1) newSem = 1;

    // Derived Year
    const newYear = Math.ceil(newSem / 2);

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

    // Filter Context
    const fDegree = document.getElementById('exportFilterDegree').value;
    const fSem = document.getElementById('exportFilterSemester').value;
    let filterText = (fDegree === 'all' && fSem === 'all') ? "All Sessions" : `Filtered: Degree ${fDegree !== 'all' ? fDegree : 'All'} / Sem ${fSem !== 'all' ? fSem : 'All'}`;

    // Title
    doc.setFontSize(18);
    doc.text(`Department Report: ${document.getElementById('pNameDisplay').innerText}`, 14, 20);
    doc.setFontSize(12);
    doc.text(`Active Session: ${document.getElementById('current-session-display').innerText.split(': ')[1]}`, 14, 28);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 34);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(filterText, 14, 40);
    doc.setTextColor(0);

    let yPos = 50;

    // Filters require fetching fresh data to calculate accurate stats for report
    // If filters are 'all', we could use the stats on screen, but consistency is better.
    doc.text("Processing data...", 14, yPos);

    try {
        let query = db.collection('feedback').where('department', '==', currentDeptId);
        if (fYear !== 'all') query = query.where('year', '==', fYear);
        if (fSem !== 'all') query = query.where('semester', '==', fSem);

        const snap = await query.get();
        let totalFb = snap.size;
        let sumRating = 0;

        const teacherStats = {}; // {tid: {sum, count, name}}

        snap.forEach(d => {
            const data = d.data();
            sumRating += Number(data.rating);

            if (!teacherStats[data.teacher_id]) teacherStats[data.teacher_id] = { sum: 0, count: 0 };
            teacherStats[data.teacher_id].sum += Number(data.rating);
            teacherStats[data.teacher_id].count++;
        });

        // Cover Loading
        doc.setFillColor(255, 255, 255);
        doc.rect(10, 45, 100, 10, 'F');

        const studs = document.getElementById('stat-students').innerText;
        const teachs = document.getElementById('stat-teachers').innerText;
        doc.setFontSize(11);
        doc.text(`Registered Students: ${studs} | Registered Teachers: ${teachs}`, 14, yPos);
        doc.text(`Total ${filterText} Feedback: ${totalFb}`, 14, yPos + 7);
        yPos += 15;

        // Teacher Performance Table
        const tRows = await Promise.all(Object.keys(teacherStats).map(async tid => {
            // resolve name
            let name = "Unknown";
            const t = allMyTeachers.find(u => u.id === tid);
            if (t) name = t.name;
            else {
                // fallback fetch if not in cache? unlikely if dept user mgmt works
                name = tid.substr(0, 8) + '...';
            }
            const avg = (teacherStats[tid].sum / teacherStats[tid].count).toFixed(2);
            return [name, avg, teacherStats[tid].count];
        }));

        if (tRows.length > 0) {
            doc.text("Teacher Performance Summary", 14, yPos);
            doc.autoTable({
                startY: yPos + 5,
                head: [['Teacher Name', 'Avg Rating', 'Feedback Count']],
                body: tRows,
            });
            yPos = doc.lastAutoTable.finalY + 15;
        } else {
            doc.text("No feedback data for selected filters.", 14, yPos);
            yPos += 15;
        }

        // Add Charts if space permits. 
        // Note: The on-screen charts are "All data". If we want filtered charts, we'd need to re-render them hidden or warn user.
        // We will skip screenshots of dashboard charts if filters are on, to avoid misleading data.
        if (fYear === 'all' && fSem === 'all') {
            const charts = [
                { id: 'deptSubjectChart', title: 'Subject Performance (Overall)' },
                { id: 'deptParticipationChart', title: 'Participation Rate (Overall)' }
            ];
            for (let c of charts) {
                const canvas = document.getElementById(c.id);
                if (canvas) {
                    if (yPos > 230) { doc.addPage(); yPos = 20; }
                    try {
                        const img = canvas.toDataURL('image/png');
                        doc.addImage(img, 'PNG', 14, yPos, 180, 80);
                        doc.text(c.title, 14, yPos - 5);
                        yPos += 95;
                    } catch (e) { }
                }
            }
        } else {
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text("(Charts omitted for filtered reports)", 14, yPos);
        }

        doc.save(`Dept_Report_Y${fYear}_S${fSem}.pdf`);

    } catch (e) {
        console.error(e);
        doc.text("Error generating report.", 14, yPos + 10);
        doc.save("Report_Error.pdf");
    }
}

async function exportTeacherRatingsXLSX() {
    const btn = event.target ? event.target.closest('button') : null;
    if (btn) btn.innerText = "Exporting...";

    try {
        const fYear = document.getElementById('exportFilterYear').value;
        const fSem = document.getElementById('exportFilterSemester').value;
        const note = (fYear === 'all' && fSem === 'all') ? "" : `Filtered Year:${fYear} Sem:${fSem}`;

        // Fetch
        let query = db.collection('feedback').where('department', '==', currentDeptId);
        if (fYear !== 'all') query = query.where('year', '==', fYear);
        if (fSem !== 'all') query = query.where('semester', '==', fSem);

        const snap = await query.get();
        if (snap.empty) { alert("No data."); return; }

        const teacherStats = {};
        snap.forEach(d => {
            const data = d.data();
            if (!teacherStats[data.teacher_id]) teacherStats[data.teacher_id] = { sum: 0, count: 0 };
            teacherStats[data.teacher_id].sum += Number(data.rating);
            teacherStats[data.teacher_id].count++;
        });

        const data = Object.keys(teacherStats).map(tid => {
            const t = allMyTeachers.find(u => u.id === tid);
            return {
                "Teacher Name": t ? t.name : tid,
                "Email": t ? t.email : '-',
                "Average Rating": (teacherStats[tid].sum / teacherStats[tid].count).toFixed(2),
                "Feedback Count": teacherStats[tid].count,
                "Filter Context": note
            };
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Teacher Ratings");
        XLSX.writeFile(wb, `Teacher_Ratings_${fYear}_${fSem}.xlsx`);

    } catch (e) {
        console.error(e);
        alert("Export Error");
    } finally {
        if (btn) btn.innerHTML = '<i class="ri-download-line"></i> Download Excel';
    }
}

// Global Bind
window.exportDeptReportPDF = exportDeptReportPDF;
window.exportTeacherRatingsXLSX = exportTeacherRatingsXLSX;

function downloadDeptStudentSample() {
    const csvContent = "data:text/csv;charset=utf-8," +
        "student_id,name,degree,semester,password\n" +
        "2024001,John Doe,B.Tech,1,password123";
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "dept_student_sample.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function downloadDeptTeacherSample() {
    const csvContent = "data:text/csv;charset=utf-8," +
        "name,email,password\n" +
        "Dr. Smith,smith@fms.local,password123";
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "dept_teacher_sample.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

window.downloadDeptStudentSample = downloadDeptStudentSample;
window.downloadDeptTeacherSample = downloadDeptTeacherSample;
