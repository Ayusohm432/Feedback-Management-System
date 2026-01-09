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

function loadTeachers() {
    const sel = document.getElementById('teacher_select');
    let query = db.collection('users').where('role', '==', 'teacher');

    // Strict Filter: Only teachers from student's department
    if (currentUserDoc.department) query = query.where('department', '==', currentUserDoc.department);

    query.get().then(snap => {
        let count = 0;
        sel.innerHTML = '<option value="">Select Teacher...</option>'; // Reset

        snap.forEach(doc => {
            const t = doc.data();
            teacherDataMap[doc.id] = t;
            const opt = document.createElement('option');
            opt.value = doc.id;
            opt.innerText = `${t.name} (${t.department || 'Gen'})`;
            sel.appendChild(opt);
            count++;
        });
        document.getElementById('stat-teachers-count').innerText = count;
        checkReviewStatus();
    });
}

// NEW: Load Open Reviews for the dedicated tab
function loadOpenReviews() {
    const container = document.getElementById('open-reviews-grid');
    if (!container) return;

    container.innerHTML = 'Loading...';

    // We can reuse teacherDataMap if loaded, or query strict. 
    // Let's filter client-side from teacherDataMap to ensure sync, or re-query if list is large.
    // For safety, re-query or iterate existing cache if we trust loadTeachers called first. 
    // loadTeachers is async, so better safe to query or wait. 
    // Let's query users where role=teacher and isReviewOpen=true.

    db.collection('users').where('role', '==', 'teacher').where('isReviewOpen', '==', true).get().then(snap => {
        if (snap.empty) {
            container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem; color:#999; background:white; border-radius:8px; border:2px dashed #eee;">
                <i class="ri-lock-2-line" style="font-size:2rem; margin-bottom:1rem; display:block;"></i>
                No reviews are currently open.
            </div>`;
            return;
        }

        let html = '';
        snap.forEach(doc => {
            const t = doc.data();
            // Filter by Dept if student has one
            if (currentUserDoc.department && t.department !== currentUserDoc.department) return;

            // Check if already submitted
            const session = t.activeSession || 'General';
            const isDone = submittedSessions.has(`${firebase.auth().currentUser.uid}_${session}`);

            const btnHtml = isDone
                ? `<button class="btn btn-outline" disabled style="width:100%; opacity:0.6; font-size:0.9em;"><i class="ri-checkbox-circle-line"></i> Submitted</button>`
                : `<button class="btn btn-primary" style="width:100%;" onclick="startFeedback('${doc.id}')">Give Feedback <i class="ri-arrow-right-line"></i></button>`;

            html += `
            <div class="card" style="display:flex; flex-direction:column; gap:0.5rem; transition:transform 0.2s; border:1px solid #f0f0f0;">
                <div style="display:flex; align-items:center; gap:1rem; margin-bottom:0.5rem;">
                    <img src="https://ui-avatars.com/api/?name=${t.name}&background=random" style="width:48px; height:48px; border-radius:50%;">
                    <div>
                        <h4 style="margin:0;">${t.name}</h4>
                        <small style="color:#666;">${t.department || 'General'}</small>
                    </div>
                </div>
                <div style="background:#f8fafc; padding:0.5rem; border-radius:4px; font-size:0.85em; color:#64748b; display:flex; justify-content:space-between;">
                    <span>Session: <strong>${session}</strong></span>
                    <span style="color:#10b981; font-weight:600;">Open</span>
                </div>
                <div style="margin-top:auto; padding-top:1rem;">
                    ${btnHtml}
                </div>
            </div>`;
        });

        container.innerHTML = html || `<div style="grid-column:1/-1; text-align:center; color:#999;">No teachers in your department are currently accepting reviews.</div>`;
    });
}

function startFeedback(teacherId) {
    // 1. Switch Tab
    // Find the sidebar link for "Give Feedback" (index 2 now? Overview=0, Open=1, Give=2)
    const links = document.querySelectorAll('.sidebar-link');
    switchTab('give-feedback', links[2]);

    // 2. Set Select Value
    const sel = document.getElementById('teacher_select');
    sel.value = teacherId;

    // 3. Trigger Change
    checkReviewStatus();

    // 4. Scroll to top
    document.querySelector('main').scrollTop = 0;
}

function checkReviewStatus() {
    const sel = document.getElementById('teacher_select');
    const uid = sel.value;
    const btn = document.getElementById('submitBtn');
    const msg = document.getElementById('statusMsg');

    btn.disabled = false;
    btn.style.opacity = 1;
    btn.innerHTML = `Submit Feedback <i class="ri-send-plane-fill"></i>`;
    msg.style.display = 'none';

    if (!uid) return;

    const teacher = teacherDataMap[uid];
    if (!teacher) return;

    // 1. Check if Teacher is Open
    if (!teacher.isReviewOpen) {
        btn.disabled = true;
        btn.style.opacity = 0.6;
        btn.innerText = "Reviews Closed";
        msg.innerHTML = `<i class="ri-lock-2-line"></i> Reviews are currently <strong>CLOSED</strong> for this teacher.`;
        msg.style.display = 'block';
        return;
    }

    // 2. Check Duplicate
    const year = currentUserDoc.year || '1';
    const sem = currentUserDoc.semester || '1';
    const checkKey = `${uid}_${year}_${sem}`;

    if (submittedSessions.has(checkKey)) {
        btn.disabled = true;
        btn.style.opacity = 0.6;
        btn.innerText = "Already Submitted";
        msg.innerHTML = `<i class="ri-checkbox-circle-line"></i> You have already provided feedback for <strong>${session}</strong> session.`;
        msg.style.display = 'block';
        return;
    }
}

function setRating(val) {
    document.getElementById('ratingValue').value = val;
    document.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.rating-btn')[val - 1].classList.add('selected');
}

async function submitFeedback(e) {
    e.preventDefault();
    const rating = document.getElementById('ratingValue').value;
    if (!rating) return alert("Please select a rating.");

    const teacherId = document.getElementById('teacher_select').value;
    const teacher = teacherDataMap[teacherId];

    if (!teacher.isReviewOpen) {
        return alert("Reviews are closed for this teacher.");
    }

    const session = teacher.activeSession || 'General';

    const year = currentUserDoc.year || '1';
    const sem = currentUserDoc.semester || '1';

    if (submittedSessions.has(`${teacherId}_${year}_${sem}`)) {
        return alert("Duplicate review.");
    }

    const data = {
        student_id: firebase.auth().currentUser.uid,
        teacher_id: teacherId,
        subject: document.getElementById('subject').value,
        rating: parseInt(rating),
        comments: document.getElementById('comments').value,
        department: teacher.department || 'General',
        session: session,
        year: currentUserDoc.year || '1',
        semester: currentUserDoc.semester || '1',
        submitted_at: new Date()
    };

    try {
        await db.collection("feedback").add(data);
        alert("Feedback Submitted Successfully!");
        document.getElementById('feedbackForm').reset();
        setRating(0); // clear
        document.getElementById('ratingValue').value = "";

        // Refresh
        loadHistory();
        loadOpenReviews();
        loadStats();
        checkReviewStatus();

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
            if (data.teacher_id) {
                const ky = `${data.teacher_id}_${data.year || '1'}_${data.semester || '1'}`;
                submittedSessions.add(ky);
            }
        });

        checkReviewStatus(); // Sync
        loadOpenReviews(); // Refresh Open Reviews UI (disable buttons)

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
