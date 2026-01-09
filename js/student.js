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

                // Load Data
                loadStats();
                loadTeachers();
                loadHistory(); // This will also populate submittedSessions
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
        // Create counter element
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
            if (this.value.length > 500) {
                counter.style.color = 'red';
            } else {
                counter.style.color = '#999';
            }
        });
    }
});

function switchTab(tab, el) {
    document.querySelectorAll('.sidebar-link').forEach(a => a.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    document.getElementById('pageTitle').innerText = tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ');

    // Refresh history if switching to history
    if (tab === 'history') loadHistory();
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

    query.get().then(snap => {
        let count = 0;
        snap.forEach(doc => {
            const t = doc.data();
            teacherDataMap[doc.id] = t; // Store full obj
            const opt = document.createElement('option');
            opt.value = doc.id; // Use UID as value
            opt.innerText = `${t.name} (${t.department || 'General'})`;
            sel.appendChild(opt);
            count++;
        });
        document.getElementById('stat-teachers-count').innerText = count;

        // Check review status in case selection is preserved or default
        checkReviewStatus();
    });
}

function checkReviewStatus() {
    const sel = document.getElementById('teacher_select');
    const uid = sel.value;
    const btn = document.getElementById('submitBtn');
    const msg = document.getElementById('statusMsg');

    // Reset UI
    btn.disabled = false;
    btn.style.opacity = 1;
    btn.innerHTML = `Submit Feedback <i class="ri-send-plane-fill"></i>`;
    msg.style.display = 'none';
    msg.className = '';

    if (!uid) return;

    const teacher = teacherDataMap[uid];
    if (!teacher) return;

    // 1. Check if Teacher is Open
    if (!teacher.isReviewOpen) {
        btn.disabled = true;
        btn.style.opacity = 0.6;
        btn.innerText = "Reviews Closed";

        msg.innerHTML = `<i class="ri-lock-2-line"></i> Reviews are currently <strong>CLOSED</strong> for this teacher.`;
        msg.style.background = '#fee2e2';
        msg.style.color = '#ef4444';
        msg.style.display = 'block';
        return;
    }

    // 2. Check Duplicate for Session
    const session = teacher.activeSession || 'General';
    const checkKey = `${uid}_${session}`; // TeacherID_Session

    if (submittedSessions.has(checkKey)) {
        btn.disabled = true;
        btn.style.opacity = 0.6;
        btn.innerText = "Already Submitted";

        msg.innerHTML = `<i class="ri-checkbox-circle-line"></i> You have already provided feedback for <strong>${session}</strong> session.`;
        msg.style.background = '#dcfce7';
        msg.style.color = '#166534';
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

    // Double check duplicate
    if (submittedSessions.has(`${teacherId}_${session}`)) {
        return alert("You have already submitted feedback for this session.");
    }

    const data = {
        student_id: firebase.auth().currentUser.uid,
        teacher_id: teacherId,
        subject: document.getElementById('subject').value,
        rating: parseInt(rating),
        comments: document.getElementById('comments').value,
        department: teacher.department || 'General',
        session: session,
        submitted_at: new Date()
    };

    try {
        await db.collection("feedback").add(data);
        alert("Feedback Submitted Successfully!");
        // Reset Form
        document.getElementById('feedbackForm').reset();
        document.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('selected'));
        document.getElementById('ratingValue').value = "";

        // Update History & Stats immediately (Wait a bit for indexedDB or verify locally?)
        // Simply re-calling loadHistory will work as onSnapshot will trigger
        // But loadHistory is onSnapshot, so it should auto-update.
        // loadStats though needs manual trigger
        loadStats();

    } catch (err) { console.error(err); alert("Error submitting feedback."); }
}

function loadHistory() {
    const uid = firebase.auth().currentUser.uid;
    const container = document.getElementById('history-container');
    container.innerHTML = '<div style="text-align:center; padding:2rem; color:#666;">Loading history...</div>';

    // Real-time listener
    db.collection('feedback').where('student_id', '==', uid).onSnapshot(snap => {
        submittedSessions.clear();

        if (snap.empty) {
            container.innerHTML = `<div style="text-align:center; padding:2rem; border:2px dashed #eee; border-radius:8px; color:#999;">
                <i class="ri-history-line" style="font-size:2rem; display:block; margin-bottom:0.5rem;"></i>
                No feedback history yet.
            </div>`;
            checkReviewStatus(); // Update form state
            return;
        }

        const docs = [];
        snap.forEach(d => {
            const data = d.data();
            docs.push(data);
            if (data.teacher_id && data.session) {
                submittedSessions.add(`${data.teacher_id}_${data.session}`);
            }
        });

        // Update form validation
        checkReviewStatus();

        // Sort desc
        docs.sort((a, b) => (b.submitted_at?.seconds || 0) - (a.submitted_at?.seconds || 0));

        let html = '';
        docs.forEach(d => {
            const tName = teacherDataMap[d.teacher_id] ? teacherDataMap[d.teacher_id].name : 'Unknown Teacher';
            const date = d.submitted_at ? new Date(d.submitted_at.seconds * 1000).toLocaleDateString() : 'N/A';

            // PRIVACY MODE: Do not show Rating or Comments
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
                <!-- Hidden Content Placeholder -->
                <div style="padding:1rem; background:#f8fafc; color:#64748b; font-size:0.9em; font-style:italic;">
                    <i class="ri-lock-line" style="vertical-align:middle;"></i> Feedback content is hidden for privacy.
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
