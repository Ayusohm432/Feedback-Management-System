/**
 * js/student.js
 * Logic for Student Dashboard
 */

let currentUserDoc = null;
let teacherDataMap = {}; // Cache to check isReviewOpen

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
                loadHistory();
            } else {
                alert("Profile not found.");
                logout();
            }
        }
    });

    // Form Listener
    document.getElementById('feedbackForm').onsubmit = submitFeedback;
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
    // Ideally we would count a subcollection or use an aggregation, 
    // but for now we'll count docs in history simply.
    // Or just query once.
    const uid = firebase.auth().currentUser.uid;
    db.collection('feedback').where('student_id', '==', uid).get().then(snap => {
        document.getElementById('stat-given').innerText = snap.size;
    });
}

function loadTeachers() {
    const sel = document.getElementById('teacher_select');
    // Ideally filter by Student's Department, but for now show all or maybe matching department
    let query = db.collection('users').where('role', '==', 'teacher');

    // Optional: Filter by department if we want strict mode
    // if(currentUserDoc.department) { query = query.where('department', '==', currentUserDoc.department); }

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
    });
}

function checkReviewStatus() {
    const sel = document.getElementById('teacher_select');
    const uid = sel.value;
    const btn = document.getElementById('submitBtn');
    const msg = document.getElementById('statusMsg');

    if (!uid) {
        btn.disabled = false; msg.style.display = 'none'; return;
    }

    const teacher = teacherDataMap[uid];
    // If isReviewOpen is FALSE (or undefined), block it.
    if (!teacher.isReviewOpen) {
        btn.disabled = true;
        btn.style.opacity = 0.5;
        btn.innerText = "Reviews Closed";
        msg.style.display = 'block';
    } else {
        btn.disabled = false;
        btn.style.opacity = 1;
        btn.innerText = "Submit Feedback";
        msg.style.display = 'none';
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

    // Re-check
    if (!teacher.isReviewOpen) {
        return alert("Reviews are closed for this teacher.");
    }

    // Prepare Data
    // NOTE: In a real system, 'session' should come from the DEPT active session. 
    // Assuming teacher object has 'activeSession' or we take it from somewhere. 
    // For now, we'll try to find it in the teacher object or default to '2025-26'.
    // Better yet: Teacher's department should have an active session. But teacher object itself has `department`.
    // Let's assume standard session for now or 'N/A' if not set.
    const session = teacher.activeSession || 'General';

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
        checkReviewStatus(); // reset button state
        loadStats(); // update count
    } catch (err) { console.error(err); alert("Error submitting feedback."); }
}

function loadHistory() {
    const uid = firebase.auth().currentUser.uid;
    const container = document.getElementById('history-container');
    container.innerHTML = 'Loading...';

    // Use client side sort to avoid index hell on dynamic query
    db.collection('feedback').where('student_id', '==', uid).onSnapshot(snap => {
        if (snap.empty) {
            container.innerHTML = "No feedback history.";
            return;
        }

        // Convert & Sort
        const docs = [];
        snap.forEach(d => docs.push(d.data()));
        docs.sort((a, b) => (b.submitted_at?.seconds || 0) - (a.submitted_at?.seconds || 0));

        let html = '';
        docs.forEach(d => {
            const tName = teacherDataMap[d.teacher_id] ? teacherDataMap[d.teacher_id].name : 'Teacher';
            const date = d.submitted_at ? new Date(d.submitted_at.seconds * 1000).toLocaleDateString() : 'N/A';
            const stars = '★'.repeat(d.rating) + '☆'.repeat(5 - d.rating);

            html += `
             <div class="feedback-card">
                <div style="padding:1rem; border-bottom:1px solid #f0f0f0; display:flex; justify-content:space-between;">
                    <div>
                        <strong style="color:#333;">${tName}</strong> 
                        <span style="color:#666; font-size:0.9em;">(${d.subject})</span>
                    </div>
                    <div style="color:#f59e0b;">${stars}</div>
                </div>
                <div style="padding:1rem; color:#555; font-size:0.95em;">
                    "${d.comments || 'No comments'}"
                </div>
                <div style="background:#fafafa; padding:0.5rem 1rem; border-top:1px solid #f0f0f0; font-size:0.8em; color:#888;">
                    Submitted on ${date} • Session: ${d.session || 'N/A'}
                </div>
             </div>`;
        });

        container.innerHTML = html;
    });
}
