/**
 * js/department.js
 * Logic for Department Dashboard
 */

let currentDeptId = null; // e.g., "105"
let currentDeptDoc = null;
let allMyTeachers = [];

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

                document.getElementById('pName').value = dName;
                document.getElementById('pId').value = currentDeptId;

                // Active Session Logic
                const actSess = currentDeptDoc.activeSession || 'NOT SET';
                document.getElementById('current-session-display').innerText = `Active Session: ${actSess}`;
                document.getElementById('pSessionDisplay').value = actSess;
                if (document.getElementById('sSession')) document.getElementById('sSession').value = actSess;

                // Load Data
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

        // Convert to array and sort
        let users = [];
        snap.forEach(doc => users.push(doc.data()));
        users.sort((a, b) => {
            const tA = a.createdAt ? a.createdAt.seconds : 0;
            const tB = b.createdAt ? b.createdAt.seconds : 0;
            return tB - tA;
        });

        // Take top 5
        users = users.slice(0, 5);

        let html = '';
        users.forEach(d => {
            const date = d.createdAt ? new Date(d.createdAt.seconds * 1000).toLocaleDateString() : 'Just now';
            const icon = d.role === 'student' ? 'ri-user-line' : (d.role === 'teacher' ? 'ri-user-tie-line' : 'ri-user-settings-line');
            const bg = d.role === 'student' ? '#e0f2fe' : (d.role === 'teacher' ? '#dcfce7' : '#f3f4f6');
            const color = d.role === 'student' ? '#0284c7' : (d.role === 'teacher' ? '#16a34a' : '#4b5563');

            html += `
            <div style="display:flex; align-items:center; gap:1rem; padding:0.75rem 0; border-bottom:1px solid #eee;">
                <div style="width:32px; height:32px; background:${bg}; color:${color}; border-radius:50%; display:flex; align-items:center; justify-content:center;">
                    <i class="${icon}"></i>
                </div>
                <div>
                    <div style="font-size:0.9em;"><strong>New ${d.role}</strong> joined: ${d.name}</div>
                    <small style="color:#999; font-size:0.8em;">${date}</small>
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
            const container = document.getElementById('dept-students-list');
            if (snap.empty) { container.innerHTML = "<p>No particular students.</p>"; return; }
            let html = '<table class="w-full"><thead><tr><th>Reg No</th><th>Name</th><th>Session</th></tr></thead><tbody>';
            snap.forEach(doc => {
                const s = doc.data();
                html += `<tr><td>${s.regNum}</td><td>${s.name}</td><td>${s.session}</td></tr>`;
            });
            html += '</tbody></table>';
            container.innerHTML = html;
        });
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
                const tName = allMyTeachers.find(t => t.id === d.teacher_id)?.name || 'Unknown Faculty';
                const date = d.submitted_at ? new Date(d.submitted_at.seconds * 1000).toLocaleDateString() : 'N/A';
                const color = d.rating < 3 ? '#ef4444' : (d.rating >= 4 ? '#10b981' : '#f59e0b');
                const stars = '★'.repeat(d.rating) + '☆'.repeat(5 - d.rating);

                html += `
                <div class="feedback-card">
                    <div style="padding:1rem; border-bottom:1px solid #f0f0f0; display:flex; justify-content:space-between; align-items:center;">
                         <div>
                            <span style="font-weight:600; font-size:0.95em;">${tName}</span>
                         </div>
                         <div style="color:${color}; font-weight:bold;">${stars}</div>
                    </div>
                    <div style="padding:1rem;">
                        <span style="background:#f3f4f6; color:#555; font-size:0.75em; padding:0.2rem 0.5rem; border-radius:4px;">${d.subject || 'General'}</span>
                        <p style="margin-top:0.75rem; color:#444; font-size:0.95em; line-height:1.5;">"${d.comments || 'No comments'}"</p>
                    </div>
                    <div style="background:#fafafa; padding:0.5rem 1rem; border-top:1px solid #f0f0f0; display:flex; justify-content:space-between; font-size:0.8em; color:#888;">
                        <span>${d.session || 'N/A'} | Year ${d.year || '-'} Sem ${d.semester || '-'}</span>
                        <span>${date}</span>
                    </div>
                </div>`;
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
                 <button class="btn btn-primary" style="padding:0.25rem 0.5rem; font-size:0.8em;" onclick="approveUser('${doc.id}')">Approve</button>
                 <button class="btn btn-outline" style="padding:0.25rem 0.5rem; font-size:0.8em;" onclick="rejectUser('${doc.id}')">Reject</button>`;

            if (u.role === 'student') {
                sCount++;
                sHTML += `<tr><td>${u.name}</td><td>${u.regNum || '-'}</td><td>${actionBtns}</td></tr>`;
            } else if (u.role === 'teacher') {
                tCount++;
                tHTML += `<tr><td>${u.name}</td><td>${u.email}</td><td>${actionBtns}</td></tr>`;
            }
        });

        sHTML += '</tbody></table>';
        tHTML += '</tbody></table>';

        sContainer.innerHTML = sCount ? sHTML : '<p style="color:#666; padding:1rem;">No pending students.</p>';
        tContainer.innerHTML = tCount ? tHTML : '<p style="color:#666; padding:1rem;">No pending teachers.</p>';
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

function loadDeptAnalytics() {
    const ctx = document.getElementById('deptPerformanceChart').getContext('2d');
    db.collection('feedback').where('department', '==', currentDeptId).get().then(snap => {
        const map = {};
        snap.forEach(d => {
            const data = d.data();
            if (!map[data.teacher_id]) map[data.teacher_id] = [];
            map[data.teacher_id].push(data.rating);
        });

        const labels = [], data = [];
        allMyTeachers.forEach(t => {
            labels.push(t.name);
            const r = map[t.id] || [];
            data.push(r.length ? (r.reduce((a, b) => a + b, 0) / r.length) : 0);
        });

        new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ label: 'Avg Rating', data, backgroundColor: '#3b82f6' }] }, options: { scales: { y: { max: 5 } } } });
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

// Bind to window
window.openSubjectModal = openSubjectModal;
window.closeSubjectModal = closeSubjectModal;
window.handleAddSubject = handleAddSubject;
window.toggleSubjectStatus = toggleSubjectStatus;
window.deleteSubject = deleteSubject;
