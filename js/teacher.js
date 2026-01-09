/**
 * js/teacher.js
 * Logic for Teacher Dashboard
 */

let currentUserDoc = null;

// Init
document.addEventListener('DOMContentLoaded', async () => {
    firebase.auth().onAuthStateChanged(async user => {
        if (user) {
            // Fetch User Details
            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists) {
                currentUserDoc = doc.data();

                // Init UI
                document.getElementById('t-name-display').innerText = currentUserDoc.name;
                document.getElementById('t-email-display').innerText = currentUserDoc.email;
                document.getElementById('t-avatar').src = `https://ui-avatars.com/api/?name=${currentUserDoc.name}&background=0D8ABC&color=fff`;

                // Profile Fields
                document.getElementById('pName').value = currentUserDoc.name;
                document.getElementById('pEmail').value = currentUserDoc.email;
                document.getElementById('pDept').value = currentUserDoc.department;

                // Load Data
                loadStats();
                loadTeacherFeedback();
                loadAnalytics();
            } else {
                alert("Profile not found.");
                logout();
            }
        }
    });
});

function switchTab(tab, el) {
    document.querySelectorAll('.sidebar-link').forEach(a => a.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    document.getElementById('pageTitle').innerText = tab.charAt(0).toUpperCase() + tab.slice(1);

    if (tab === 'analytics') loadAnalytics();
}

function loadStats() {
    const uid = firebase.auth().currentUser.uid;
    db.collection('feedback').where('teacher_id', '==', uid).onSnapshot(snap => {
        let total = 0;
        let sum = 0;
        snap.forEach(d => {
            total++;
            sum += d.data().rating;
        });

        const avg = total ? (sum / total).toFixed(1) : '0.0';
        document.getElementById('stat-avg-rating').innerText = avg;
        document.getElementById('stat-total-reviews').innerText = total;

        const isOpen = currentUserDoc.isReviewOpen;
        const statusEl = document.getElementById('stat-status');
        statusEl.innerText = isOpen ? 'Open' : 'Closed';
        statusEl.style.color = isOpen ? '#16a34a' : '#ef4444';
    });
}

async function loadTeacherFeedback() {
    const uid = firebase.auth().currentUser.uid;
    const container = document.getElementById('teacher-feedback-container');
    const listContainer = document.getElementById('recent-feedback-list'); // For overview

    if (container) container.innerHTML = 'Loading...';

    // Client-side filtering as usual
    const snap = await db.collection('feedback').where('teacher_id', '==', uid).orderBy('submitted_at', 'desc').limit(50).get();

    if (snap.empty) {
        if (container) container.innerHTML = "No feedback yet.";
        if (listContainer) listContainer.innerHTML = "No recent feedback.";
        return;
    }

    const filterRating = document.getElementById('tfFilterRating') ? document.getElementById('tfFilterRating').value : 'all';
    let html = '';
    let recentHtml = '';
    let count = 0;

    snap.forEach(doc => {
        const d = doc.data();
        const date = d.submitted_at ? new Date(d.submitted_at.seconds * 1000).toLocaleDateString() : 'N/A';
        const color = d.rating < 3 ? '#ef4444' : (d.rating >= 4 ? '#10b981' : '#f59e0b');
        const stars = '★'.repeat(d.rating) + '☆'.repeat(5 - d.rating);

        // Filter
        let show = true;
        if (filterRating !== 'all' && d.rating.toString() !== filterRating) show = false;

        const card = `
        <div class="feedback-card">
            <div style="padding:1rem; border-bottom:1px solid #f0f0f0; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:600; font-size:0.9em; color:#666;">${d.subject || 'General'}</span>
                    <div style="color:${color}; font-weight:bold;">${stars}</div>
            </div>
            <div style="padding:1rem;">
                <p style="color:#444; font-size:0.95em; line-height:1.5;">"${d.comments || 'No comments'}"</p>
            </div>
            <div style="background:#fafafa; padding:0.5rem 1rem; border-top:1px solid #f0f0f0; display:flex; justify-content:space-between; font-size:0.8em; color:#888;">
                <span>Session: ${d.session || 'N/A'}</span>
                <span>${date}</span>
            </div>
        </div>`;

        if (show) html += card;
        if (count < 3) recentHtml += card; // Top 3 for overview
        count++;
    });

    if (container) container.innerHTML = html || 'No feedback matches filters.';
    if (listContainer) listContainer.innerHTML = recentHtml;
}

function loadAnalytics() {
    const ctx = document.getElementById('teacherTrendChart');
    if (!ctx) return;

    // Simulating a trend since we don't have historical snapshots easily without hefty queries.
    // In a real app, we'd aggregate this on the backend or daily.
    // For now, we'll pull recent 10 and show a "Recent Feedback Trend" line
    const uid = firebase.auth().currentUser.uid;
    db.collection('feedback').where('teacher_id', '==', uid).orderBy('submitted_at', 'asc').limitToLast(10).get().then(snap => {
        const labels = [];
        const data = [];

        snap.forEach(d => {
            labels.push(new Date(d.data().submitted_at.seconds * 1000).toLocaleDateString());
            data.push(d.data().rating);
        });

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Rating (Recent 10)',
                    data: data,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, max: 5 }
                }
            }
        });
    });
}
