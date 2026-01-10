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

                // Profile Fields (New Design)
                document.getElementById('pNameDisplay').innerText = currentUserDoc.name;
                document.getElementById('pEmailDisplay').innerText = currentUserDoc.email;
                document.getElementById('pDeptDisplay').innerText = currentUserDoc.department || 'N/A';
                document.getElementById('pIdDisplay').innerText = user.uid; // Or custom field if exists
                document.getElementById('profile-avatar-large').src = `https://ui-avatars.com/api/?name=${currentUserDoc.name}&background=0D8ABC&color=fff&size=128`;

                // Load Data
                loadStats();
                loadMySubjects();
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

        statusEl.style.color = isOpen ? '#16a34a' : '#ef4444';
    });
}

function loadMySubjects() {
    const list = document.getElementById('my-subjects-container');
    if (!list) return;

    if (!currentUserDoc.assignedSubjects || currentUserDoc.assignedSubjects.length === 0) {
        list.innerHTML = '<div style="color:#999; text-align:center; padding:1rem; border:1px dashed #eee; border-radius:4px;">No subjects assigned yet.</div>';
        return;
    }

    let html = '<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:1rem;">';
    currentUserDoc.assignedSubjects.forEach(s => {
        html += `
         <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:0.75rem; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <div style="font-weight:600; font-size:0.95em;">${s.name}</div>
                <div style="font-size:0.8em; color:#666;">Year ${s.year} • Sem ${s.semester}</div>
            </div>
            <div style="font-size:0.75em; padding:0.2rem 0.5rem; border-radius:4px; ${s.isOpen ? 'background:#dcfce7; color:#16a34a;' : 'background:#fee2e2; color:#ef4444;'}">
                ${s.isOpen ? 'Open' : 'Closed'}
            </div>
         </div>`;
    });
    html += '</div>';
    list.innerHTML = html;
}

async function loadTeacherFeedback() {
    const uid = firebase.auth().currentUser.uid;
    const container = document.getElementById('teacher-feedback-container');
    const listContainer = document.getElementById('recent-feedback-list'); // For overview
    const sessionSelect = document.getElementById('tfFilterSession');
    const subjectSelect = document.getElementById('tfFilterSubject');

    if (container) container.innerHTML = 'Loading...';

    // Fetch ALL feedback for this teacher (client-side sort/filter to avoid index issues)
    // using onSnapshot for real-time
    db.collection('feedback').where('teacher_id', '==', uid).onSnapshot(snap => {
        if (snap.empty) {
            if (container) container.innerHTML = "No feedback yet.";
            if (listContainer) listContainer.innerHTML = "No recent feedback.";
            return;
        }

        // 1. Convert to Array and Collect Filter Options
        let allFeedback = [];
        let sessionsSet = new Set();
        let subjectsSet = new Set();

        snap.forEach(doc => {
            const d = doc.data();
            allFeedback.push(d);
            if (d.session) sessionsSet.add(d.session);
            if (d.subject) subjectsSet.add(d.subject);
        });

        // 2. Sort by Date Descending (Client-Side)
        allFeedback.sort((a, b) => {
            const tA = a.submitted_at ? a.submitted_at.seconds : 0;
            const tB = b.submitted_at ? b.submitted_at.seconds : 0;
            return tB - tA;
        });

        // 3. Populate Session Filter
        if (sessionSelect && sessionSelect.children.length <= 1) {
            const currentSel = sessionSelect.value;
            // Remove old options (keep 'All')
            while (sessionSelect.options.length > 1) { sessionSelect.remove(1); }
            Array.from(sessionsSet).sort().reverse().forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.innerText = s;
                sessionSelect.appendChild(opt);
            });
            sessionSelect.value = currentSel;
        }

        // 4. Populate Subject Filter
        if (subjectSelect && subjectSelect.children.length <= 1) {
            const currentSel = subjectSelect.value;
            while (subjectSelect.options.length > 1) { subjectSelect.remove(1); }
            Array.from(subjectsSet).sort().forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.innerText = s;
                subjectSelect.appendChild(opt);
            });
            subjectSelect.value = currentSel;
        }

        // 5. Get Filter Values
        const filterRating = document.getElementById('tfFilterRating') ? document.getElementById('tfFilterRating').value : 'all';
        const filterSession = sessionSelect ? sessionSelect.value : 'all';
        const filterSubject = subjectSelect ? subjectSelect.value : 'all';
        const filterYear = document.getElementById('tfFilterYear') ? document.getElementById('tfFilterYear').value : 'all';
        const filterSemester = document.getElementById('tfFilterSemester') ? document.getElementById('tfFilterSemester').value : 'all';

        let html = '';
        let recentHtml = '';
        let count = 0;

        // 6. Generate HTML
        allFeedback.forEach(d => {
            // Apply Filters
            if (filterRating !== 'all' && d.rating.toString() !== filterRating) return;
            if (filterSession !== 'all' && d.session !== filterSession) return;
            if (filterSubject !== 'all' && d.subject !== filterSubject) return;
            if (filterYear !== 'all' && (d.year || '1') !== filterYear) return;
            if (filterSemester !== 'all' && (d.semester || '1') !== filterSemester) return;

            const date = d.submitted_at ? new Date(d.submitted_at.seconds * 1000).toLocaleDateString() : 'N/A';

            let colorClass = '#f59e0b';
            let statusClass = 'neutral';
            if (d.rating <= 2) { colorClass = '#ef4444'; statusClass = 'negative'; }
            if (d.rating >= 4) { colorClass = '#10b981'; statusClass = 'positive'; }

            const card = `
            <div class="feedback-card ${statusClass}">
                <div class="feedback-header">
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                         <img src="https://ui-avatars.com/api/?name=${currentUserDoc.name}&background=random&size=32" style="width:32px; height:32px; border-radius:50%;">
                        <div style="line-height:1.2;">
                            <div style="font-weight:600; font-size:0.95rem;">${d.subject || 'General'}</div>
                            <div style="font-size:0.75rem; color:#666;">${currentUserDoc.name}</div>
                        </div>
                    </div>
                    <span class="rating-badge" style="background:${colorClass}20; color:${colorClass}">${d.rating} ★</span>
                </div>
                <div class="feedback-body">
                    <p style="color:#475569; font-size:0.95em; line-height:1.5;">"${d.comments || 'No comments'}"</p>
                </div>
                <div class="feedback-footer">
                    <span><i class="ri-calendar-line"></i> ${date}</span>
                    <span>${d.session || '-'} | Y${d.year || '-'}</span>
                </div>
            </div>`;

            html += card;
        });

        // Recent Activity (Top 3 of ALL, ignoring filters for overview, or maybe we want filtered? Logic: Dashboard Overview usually implies global recent)
        // Let's stick to Global Recent for the overview list
        const overviewTop3 = allFeedback.slice(0, 3);
        overviewTop3.forEach(d => {
            const date = d.submitted_at ? new Date(d.submitted_at.seconds * 1000).toLocaleDateString() : 'N/A';
            const color = d.rating < 3 ? '#ef4444' : (d.rating >= 4 ? '#10b981' : '#f59e0b');
            const stars = '★'.repeat(d.rating) + '☆'.repeat(5 - d.rating);
            recentHtml += `
            <div class="feedback-card" style="margin-bottom:1rem;">
                <div style="padding:1rem; border-bottom:1px solid #f0f0f0; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:600; font-size:0.9em; color:#666;">${d.subject || 'General'}</span>
                        <div style="color:${color}; font-weight:bold;">${stars}</div>
                </div>
                <div style="padding:1rem;">
                    <p style="color:#444; font-size:0.95em; line-height:1.5;">"${d.comments || 'No comments'}"</p>
                </div>
                 <div style="background:#fafafa; padding:0.5rem 1rem; border-top:1px solid #f0f0f0; font-size:0.8em; color:#888;">
                    <span>${date}</span>
                </div>
            </div>`;
        });

        if (container) container.innerHTML = html || '<p style="grid-column:1/-1; text-align:center; color:#666;">No feedback matches filters.</p>';
        if (listContainer) listContainer.innerHTML = recentHtml || '<p style="color:#666;">No recent feedback.</p>';
    });
}

// Store chart instances to destroy them before re-rendering
const chartInstances = {};

async function loadAnalytics() {
    const uid = firebase.auth().currentUser.uid;

    // Fetch ALL feedback for analytics
    // Using simple get() as analytics doesn't need real-time snap usually, but ensures we have data
    const snap = await db.collection('feedback').where('teacher_id', '==', uid).get();

    if (snap.empty) return; // TODO: Show empty state

    let docs = [];
    snap.forEach(d => docs.push(d.data()));

    // --- PREPROCESS DATA ---

    // 1. Trend (Sort by date asc)
    const trendDocs = [...docs].sort((a, b) => (a.submitted_at?.seconds || 0) - (b.submitted_at?.seconds || 0));

    // 2. Rating Distribution
    const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    // 3. Subject Performance
    const subjectStats = {}; // { "Math": {sum: 10, count: 2} }

    // 4. Session Analysis
    const sessionStats = {}; // { "2023": {sum: 15, count: 3} }

    trendDocs.forEach(d => {
        // Ratings
        if (d.rating >= 1 && d.rating <= 5) ratingCounts[d.rating]++;

        // Subject
        const subj = d.subject || 'Unknown';
        if (!subjectStats[subj]) subjectStats[subj] = { sum: 0, count: 0 };
        subjectStats[subj].sum += d.rating;
        subjectStats[subj].count++;

        // Session
        const sess = d.session || 'Unknown';
        if (!sessionStats[sess]) sessionStats[sess] = { sum: 0, count: 0 };
        sessionStats[sess].sum += d.rating;
        sessionStats[sess].count++;
    });

    // --- HELPER TO DESTROY OLD CHART ---
    const resetChart = (id) => {
        if (chartInstances[id]) {
            chartInstances[id].destroy();
        }
    };

    // --- RENDER 1: TREND (Line) ---
    // Take last 20 for readability
    const recentTrend = trendDocs.slice(-20);
    resetChart('teacherTrendChart');
    const ctx1 = document.getElementById('teacherTrendChart');
    if (ctx1) {
        chartInstances['teacherTrendChart'] = new Chart(ctx1, {
            type: 'line',
            data: {
                labels: recentTrend.map(d => d.submitted_at ? new Date(d.submitted_at.seconds * 1000).toLocaleDateString() : ''),
                datasets: [{
                    label: 'Rating',
                    data: recentTrend.map(d => d.rating),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 5 } } }
        });
    }

    // --- RENDER 2: DISTRIBUTION (Doughnut) ---
    resetChart('ratingDistributionChart');
    const ctx2 = document.getElementById('ratingDistributionChart');
    if (ctx2) {
        chartInstances['ratingDistributionChart'] = new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: ['1 Star', '2 Stars', '3 Stars', '4 Stars', '5 Stars'],
                datasets: [{
                    data: [ratingCounts[1], ratingCounts[2], ratingCounts[3], ratingCounts[4], ratingCounts[5]],
                    backgroundColor: ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // --- RENDER 3: SUBJECT PERFORMANCE (Bar) ---
    const subjLabels = Object.keys(subjectStats);
    const subjData = subjLabels.map(s => (subjectStats[s].sum / subjectStats[s].count).toFixed(2));

    resetChart('subjectPerformanceChart');
    const ctx3 = document.getElementById('subjectPerformanceChart');
    if (ctx3) {
        chartInstances['subjectPerformanceChart'] = new Chart(ctx3, {
            type: 'bar',
            data: {
                labels: subjLabels,
                datasets: [{
                    label: 'Avg Rating',
                    data: subjData,
                    backgroundColor: '#8b5cf6'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 5 } } }
        });
    }

    // --- RENDER 4: SESSION ANALYSIS (Bar) ---
    const sessLabels = Object.keys(sessionStats).sort(); // Sort sessions
    const sessData = sessLabels.map(s => (sessionStats[s].sum / sessionStats[s].count).toFixed(2));

    resetChart('sessionComparisonChart');
    const ctx4 = document.getElementById('sessionComparisonChart');
    if (ctx4) {
        chartInstances['sessionComparisonChart'] = new Chart(ctx4, {
            type: 'bar',
            data: {
                labels: sessLabels,
                datasets: [{
                    label: 'Avg Rating',
                    data: sessData,
                    backgroundColor: '#06b6d4'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 5 } } }
        });
    }
}
