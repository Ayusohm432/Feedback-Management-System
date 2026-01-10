/**
 * js/student.js
 * Logic for Student Dashboard
 */

let currentUserDoc = null;
let teacherDataMap = {}; // Cache to check isReviewOpen
const submittedSessions = new Set(); // Stores set of "teacherId_session" to checking duplicates

// Init
document.addEventListener('DOMContentLoaded', async () => {
    firebase.auth().onAuthStateChanged(async user => {
        if (user) {
            // Fetch User Details
            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists) {
                currentUserDoc = doc.data();

                // Init UI
                document.getElementById('s-name-display').innerText = currentUserDoc.name;
                document.getElementById('s-email-display').innerText = currentUserDoc.email;
                document.getElementById('s-avatar').src = `https://ui-avatars.com/api/?name=${currentUserDoc.name}&background=0D8ABC&color=fff`;

                // Profile Fields
                document.getElementById('pName').value = currentUserDoc.name;
                document.getElementById('pEmail').value = currentUserDoc.email;
                document.getElementById('pDept').value = currentUserDoc.department;
                document.getElementById('pYear').value = currentUserDoc.year || '-';
                document.getElementById('pSem').value = currentUserDoc.semester || '-';

                // Load Data
                loadStats();
                loadTeachers(); // This populates select
                loadHistory();
                loadOpenReviews(); // New tab data
            } else {
                alert("Profile not found.");
                logout();
            }
        }
    });

    // Form Listener
    document.getElementById('feedbackForm').onsubmit = submitFeedback;

    // Char Counter
    const commentBox = document.getElementById('comments');
    if (commentBox) {
        const counter = document.createElement('div');
        counter.id = 'char-counter';
        counter.style.textAlign = 'right';
        counter.style.fontSize = '0.8em';
        counter.style.color = '#999';
        counter.style.marginTop = '0.25rem';
        counter.innerText = '0 chars';
        commentBox.parentNode.appendChild(counter);

        commentBox.addEventListener('input', function () {
            counter.innerText = `${this.value.length} chars`;
            this.value.length > 500 ? counter.style.color = 'red' : counter.style.color = '#999';
        });
    }
});

function switchTab(tab, el) {
    document.querySelectorAll('.sidebar-link').forEach(a => a.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    document.getElementById('pageTitle').innerText = tab.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());

    if (tab === 'history') loadHistory();
    if (tab === 'open-reviews') loadOpenReviews();
}

function loadStats() {
    const uid = firebase.auth().currentUser.uid;
    db.collection('feedback').where('student_id', '==', uid).get().then(snap => {
        document.getElementById('stat-given').innerText = snap.size;
    });
}

// 1. UPDATED loadTeachers
function loadTeachers() {
    const sel = document.getElementById('teacher_select');
    let query = db.collection('users').where('role', '==', 'teacher');

    // Strict Filter: Only teachers from student's department
    if (currentUserDoc.department) query = query.where('department', '==', currentUserDoc.department);

    query.get().then(snap => {
        let count = 0;
        sel.innerHTML = '<option value="">Select Teacher...</option>';

        snap.forEach(doc => {
            const t = doc.data();
            teacherDataMap[doc.id] = t;

            // NEW: Only add teacher if they have at least one OPEN subject for my Year/Sem
            const valid = hasValidSubjects(t);
            if (valid) {
                const opt = document.createElement('option');
                opt.value = doc.id;
                opt.innerText = `${t.name} (${t.department || 'Gen'})`;
                sel.appendChild(opt);
                count++;
            }
        });
        document.getElementById('stat-teachers-count').innerText = count;
        checkReviewStatus();
    });
}

// Helper to check if teacher has valid subjects for current student
function hasValidSubjects(teacher) {
    if (!teacher.assignedSubjects || !Array.isArray(teacher.assignedSubjects)) return false; // Strict mode: must have assigned subjects
    const myYear = (currentUserDoc.year || '1').toString();
    const mySem = (currentUserDoc.semester || '1').toString();

    // Find at least one subject that is Open AND matches Year/Sem
    return teacher.assignedSubjects.some(s => s.isOpen && s.year.toString() === myYear && s.semester.toString() === mySem);
}

function getValidSubjects(teacher) {
    if (!teacher.assignedSubjects) return [];
    const myYear = (currentUserDoc.year || '1').toString();
    const mySem = (currentUserDoc.semester || '1').toString();
    return teacher.assignedSubjects.filter(s => s.isOpen && s.year.toString() === myYear && s.semester.toString() === mySem);
}



// Helper for consistent key generation
function getFeedbackKey(tid, year, sem, session, subject) {
    return `${tid}_${year}_${sem}_${session}_${subject}`;
}

// 2. UPDATED loadOpenReviews
function loadOpenReviews() {
    const container = document.getElementById('open-reviews-grid');
    if (!container) return;
    container.innerHTML = 'Loading...';

    // We rely on loadTeachers having populated teacherDataMap mostly, but to be safe, we query.
    // Actually, let's query all teachers in dept and filter client side for better subject logic
    let query = db.collection('users').where('role', '==', 'teacher');
    if (currentUserDoc.department) query = query.where('department', '==', currentUserDoc.department);

    query.get().then(snap => {
        if (snap.empty) {
            container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem; color:#999; border:2px dashed #eee;">No reviews open.</div>`;
            return;
        }

        let html = '';
        let visibleCount = 0;

        const myYear = (currentUserDoc.year || '1').toString();
        const mySem = (currentUserDoc.semester || '1').toString();

        snap.forEach(doc => {
            const t = doc.data();
            const tid = doc.id;
            teacherDataMap[tid] = t; // Ensure cache update

            // VALIDATION
            const validSubjects = getValidSubjects(t);
            if (validSubjects.length === 0) return; // Skip teacher if no subjects for me

            visibleCount++;
            const session = t.activeSession || 'General';

            // Check if ALL valid subjects are submitted
            let pendingSubjects = [];
            validSubjects.forEach(s => {
                // Key: Teacher + Year + Sem + Session + SubjectName
                const key = getFeedbackKey(tid, myYear, mySem, session, s.name);
                if (!submittedSessions.has(key)) {
                    pendingSubjects.push(s.name);
                }
            });

            const isDone = pendingSubjects.length === 0;

            const btnHtml = isDone
                ? `<button class="btn btn-outline" disabled style="width:100%; opacity:0.6;"><i class="ri-checkbox-circle-line"></i> All Submitted</button>`
                : `<button class="btn btn-primary" style="width:100%;" onclick="startFeedback('${tid}')">Give Feedback (${pendingSubjects.length}) <i class="ri-arrow-right-line"></i></button>`;

            html += `
            <div class="card" style="display:flex; flex-direction:column; gap:0.5rem; border:1px solid #f0f0f0;">
                <div style="display:flex; align-items:center; gap:1rem;">
                    <img src="https://ui-avatars.com/api/?name=${t.name}&background=random" style="width:48px; border-radius:50%;">
                    <div>
                        <h4 style="margin:0;">${t.name}</h4>
                        <small style="color:#666;">${t.department || 'Gen'}</small>
                    </div>
                </div>
                <div style="background:#f8fafc; padding:0.5rem; font-size:0.85em; color:#64748b; margin-top:0.5rem;">
                    <strong>Subjects:</strong> ${validSubjects.map(s => s.name).join(', ')}
                </div>
                <div style="margin-top:auto; padding-top:1rem;">
                    ${btnHtml}
                </div>
            </div>`;
        });

        container.innerHTML = html || `<div style="grid-column:1/-1; text-align:center; color:#999;">No reviews available for your Year/Semester.</div>`;
    });
}

function startFeedback(teacherId) {
    const links = document.querySelectorAll('.sidebar-link');
    switchTab('give-feedback', links[2]);

    const sel = document.getElementById('teacher_select');
    sel.value = teacherId;

    // Trigger update of subjects
    checkReviewStatus();

    document.querySelector('main').scrollTop = 0;
}

function checkReviewStatus() {
    const sel = document.getElementById('teacher_select');
    const uid = sel.value;
    const subSel = document.getElementById('subject');
    const btn = document.getElementById('submitBtn');
    const msg = document.getElementById('statusMsg');

    // Reset UI
    btn.disabled = false;
    btn.style.opacity = 1;
    btn.innerHTML = `Submit Feedback <i class="ri-send-plane-fill"></i>`;
    msg.style.display = 'none';
    subSel.innerHTML = '<option value="" disabled selected>Select Subject</option>';

    if (!uid) return;

    const teacher = teacherDataMap[uid];
    if (!teacher) return;

    // 1. Validation (Subject based)
    const validSubjects = getValidSubjects(teacher);
    if (validSubjects.length === 0) {
        btn.disabled = true;
        btn.innerText = "No Subjects";
        msg.innerHTML = "No subjects assigned to this teacher for your Year/Semester are open for review.";
        msg.style.display = 'block';
        return;
    }

    // 2. Populate Subject Dropdown (Only non-submitted ones?)
    // Creating options
    const session = teacher.activeSession || 'General';
    let availableCount = 0;
    const year = (currentUserDoc.year || '1').toString();
    const sem = (currentUserDoc.semester || '1').toString();

    validSubjects.forEach(s => {
        // Check duplicate using standard Key
        const key = getFeedbackKey(uid, year, sem, session, s.name);
        if (!submittedSessions.has(key)) {
            const opt = document.createElement('option');
            opt.value = s.name;
            opt.innerText = s.name;
            subSel.appendChild(opt);
            availableCount++;
        }
    });

    if (availableCount === 0) {
        btn.disabled = true;
        btn.innerText = "All Submitted";
        msg.innerHTML = "You have already submitted feedback for all open subjects of this teacher.";
        msg.style.display = 'block';
    }
}


function setRating(val) {
    // Update hidden input
    document.getElementById('ratingValue').value = val === 0 ? "" : val;

    // Visual Update
    document.querySelectorAll('.rating-btn').forEach((btn, index) => {
        // Buttons are in order 1-5
        if (val > 0 && index + 1 === val) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
}

async function submitFeedback(e) {
    e.preventDefault();
    const rating = document.getElementById('ratingValue').value;
    if (!rating) return alert("Please select a rating.");

    const teacherId = document.getElementById('teacher_select').value;
    const subject = document.getElementById('subject').value;
    if (!subject) return alert("Please select a subject.");

    const teacher = teacherDataMap[teacherId];
    const session = teacher.activeSession || 'General';

    const year = (currentUserDoc.year || '1').toString();
    const sem = (currentUserDoc.semester || '1').toString();

    // STRICT DUPLICATE CHECK
    const key = getFeedbackKey(teacherId, year, sem, session, subject);

    if (submittedSessions.has(key)) {
        return alert("Duplicate review: You have already submitted feedback for this subject.");
    }

    const data = {
        student_id: firebase.auth().currentUser.uid,
        teacher_id: teacherId,
        subject: subject,
        rating: parseInt(rating),
        comments: document.getElementById('comments').value,
        department: teacher.department || 'General',
        session: session,
        year: year,
        semester: sem,
        submitted_at: new Date()
    };

    try {
        await db.collection("feedback").add(data);
        alert("Feedback Submitted Successfully!");
        document.getElementById('feedbackForm').reset();
        setRating(0);
        document.getElementById('ratingValue').value = "";
        loadHistory();
        // Note: loadHistory calls loadOpenReviews and checkReviewStatus internally, 
        // so UI will refresh and submittedSessions will be updated.
    } catch (err) { console.error(err); alert("Error submitting feedback."); }
}

function loadHistory() {
    const uid = firebase.auth().currentUser.uid;
    const container = document.getElementById('history-container');
    container.innerHTML = '<div style="text-align:center; padding:2rem; color:#666;">Loading history...</div>';

    db.collection('feedback').where('student_id', '==', uid).onSnapshot(snap => {
        submittedSessions.clear();

        if (snap.empty) {
            container.innerHTML = `<div style="text-align:center; padding:2rem; border:2px dashed #eee; border-radius:8px; color:#999;">
                <i class="ri-history-line" style="font-size:2rem; display:block; margin-bottom:0.5rem;"></i>
                No feedback history yet.
            </div>`;
            checkReviewStatus(); // Update after loading history to sync dup check
            return;
        }

        const docs = [];
        snap.forEach(d => {
            const data = d.data();
            docs.push(data);
            if (data.teacher_id && data.year && data.semester && data.session && data.subject) {
                // STANDARD KEY Generation from DB Data
                const key = getFeedbackKey(data.teacher_id, data.year, data.semester, data.session, data.subject);
                submittedSessions.add(key);
            } else if (data.teacher_id && data.session && data.subject) {
                // Fallback for old data without year/sem explicitly stored? 
                // If we assume old data is invalid or we just try to map it.
                // Ideally all data has year/sem. If not, we might miss duplicates, but for new data it works.
                // Let's try to be safe.
                const y = data.year || (currentUserDoc.year || '1').toString();
                const s = data.semester || (currentUserDoc.semester || '1').toString();
                const key = getFeedbackKey(data.teacher_id, y, s, data.session, data.subject);
                submittedSessions.add(key);
            }
        });

        checkReviewStatus(); // Sync
        loadOpenReviews();

        docs.sort((a, b) => (b.submitted_at?.seconds || 0) - (a.submitted_at?.seconds || 0));

        let html = '';
        docs.forEach(d => {
            const tName = teacherDataMap[d.teacher_id] ? teacherDataMap[d.teacher_id].name : 'Teacher';
            const date = d.submitted_at ? new Date(d.submitted_at.seconds * 1000).toLocaleDateString() : 'N/A';

            html += `
             <div class="feedback-card" style="border-left: 4px solid var(--primary);">
                <div style="padding:1rem; border-bottom:1px solid #f0f0f0; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong style="color:#333; font-size:1.05em;">${tName}</strong> 
                        <div style="font-size:0.85em; color:#666; margin-top:2px;">${d.subject}</div>
                    </div>
                    <div style="color:#10b981; background:#ecfdf5; padding:0.25rem 0.75rem; border-radius:2rem; font-size:0.8em; font-weight:600; display:flex; align-items:center; gap:0.25rem;">
                        <i class="ri-check-double-line"></i> Submitted
                    </div>
                </div>
                <!-- Privacy Mask -->
                <div style="padding:1rem; background:#f8fafc; color:#64748b; font-size:0.9em; font-style:italic;">
                    <i class="ri-lock-line" style="vertical-align:middle;"></i> Content hidden for privacy.
                </div>
                <div style="background:white; padding:0.5rem 1rem; border-top:1px solid #f0f0f0; font-size:0.8em; color:#94a3b8; display:flex; justify-content:space-between;">
                    <span>Session: <strong>${d.session || 'N/A'}</strong></span>
                    <span>${date}</span>
                </div>
             </div>`;
        });

        container.innerHTML = html;
    });
}
