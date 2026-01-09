/**
 * js/admin.js
 * Logic for Admin Dashboard - Stats, User Management, Approvals
 */

// --- Global Data Cache ---
let allPendingUsers = [];

// --- Tab Switching Logic ---
function switchTab(tabName, linkEl) {
    // 1. Update Sidebar
    document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));
    linkEl.classList.add('active');

    // 2. Update Content
    document.querySelectorAll('.tab-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');

    // 3. Update Title
    document.getElementById('pageTitle').innerText = tabName.charAt(0).toUpperCase() + tabName.slice(1);

    // 4. Trigger Data Load if needed
    if (tabName === 'dashboard') loadStats();
    if (tabName === 'approvals') loadApprovals();
    if (tabName === 'students') loadUserTable('student', 'students-table-container');
    if (tabName === 'teachers') loadUserTable('teacher', 'teachers-table-container');
    if (tabName === 'departments') loadUserTable('department', 'depts-table-container');
    if (tabName === 'profile') loadProfile();
}

// --- 1. Real-time Stats ---
function loadStats() {
    // Note: For production, use distributed counters. Here we count client-side for simplicity.
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

// --- 2. Approvals Logic ---
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
    // UI Update
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

window.approveUser = async (uid) => {
    try {
        await db.collection('users').doc(uid).update({ status: 'approved' });
        // Toast callback logic here if needed
    } catch (e) { console.error(e); alert(e.message); }
};

window.rejectUser = async (uid) => {
    if (!confirm("Permantently remove this request?")) return;
    try {
        await db.collection('users').doc(uid).delete(); // Or set status: rejected
    } catch (e) { console.error(e); alert(e.message); }
};


// --- 3. User Tables (Generic) ---
function loadUserTable(role, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = "Fetching data...";

    db.collection('users').where('role', '==', role).where('status', '==', 'approved').onSnapshot(snap => {
        if (snap.empty) {
            container.innerHTML = "No users found.";
            return;
        }

        // Define Headers based on Role
        let headers = ['Name', 'Email'];
        if (role === 'student') headers.push('Reg No', 'Dept');
        if (role === 'department') headers.push('Dept ID');
        if (role === 'teacher') headers.push('Dept');

        let html = `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;

        snap.forEach(doc => {
            const u = doc.data();
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
    });
}

// --- 4. Single Student Add ---
async function handleAddSingleStudent(e) {
    e.preventDefault();
    const reg = document.getElementById('addRegNum').value;
    const name = document.getElementById('addName').value;
    const dept = document.getElementById('addDept').value;

    // Auto-generate synthetic email/pass
    const email = `${reg}@student.fms.local`;
    const tempPass = "welcome123"; // Default password

    try {
        // Warning: Requires secondary auth app or cloud function to not log out Admin.
        // Since we are client-side only: We can only create a Firestore Entry for them to "Claim" later 
        // OR we warn user that Admin will be logged out.
        // BETTER APPROACH: Just create the Firestore Doc with status 'approved'.
        // The user can then "Register" and since Firestore Doc exists, we might need logic to merge?
        // ACTUALLY: Let's create a "Pre-Approved" list or just let Admin create the doc.
        // Issue: Auth User creation logs in the new user immediately.

        // WORKAROUND: Just create the Firestore Data. The user must still "Register" but we can auto-approve if ID matches?
        // OR: Just alert "For Client-Side Only apps, please ask users to Register themselves. You can Approve them."

        // Let's implement the "Pre-fill" approach: Admin uploads data to 'students' collection (which is what Bulk Upload does).
        // Then Auth logic checks this collection during Registration? 
        // CURRENT LOGIC (from auth.js): Registration creates 'users' doc.

        // Let's use the Bulk Upload logic's target: 'students' collection. 
        // Wait, 'users' collection is the source of truth for Auth. 'students' collection was from the initial plan for Bulk.
        // Let's standardise: Admin adds to 'students' collection. 
        // When user registers, we check if they exist in 'students' collection => Auto Approve? 
        // For now, let's keep it simple: Admin simply adds to 'students' collection as a "Roster".

        await db.collection('students').doc(reg).set({
            student_id: reg,
            student_name: name,
            department: dept,
            email: email,
            has_submitted: false
        });

        alert("Student added to roster. They can now 'Register' and will be auto-verified (if logic added) or you approve them manually.");
        e.target.reset();

    } catch (err) {
        console.error(err);
        alert("Error adding student.");
    }
}

// --- 5. Bulk Upload & Sample ---
function downloadSample() {
    const csvContent = "data:text/csv;charset=utf-8," + "student_id,student_name,department,semester\n2024001,John Doe,CSE,1\n2024002,Jane Smith,ECE,1";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "student_sample.csv");
    document.body.appendChild(link);
    link.click();
}

async function handleBulkUpload() {
    // Re-using logic from previous admin.html but moving here
    const file = document.getElementById('csvFile').files[0];
    if (!file) return alert("Select file first");

    const status = document.getElementById('uploadStatus');
    status.innerText = "Parsing...";

    if (file.name.endsWith('.csv')) {
        Papa.parse(file, {
            header: true,
            complete: function (results) { processImport(results.data); }
        });
    } else {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);
            processImport(jsonData);
        };
        reader.readAsArrayBuffer(file);
    }

    async function processImport(data) {
        const batch = db.batch();
        let count = 0;
        data.forEach(row => {
            // Handle loose csv keys (remove whitespace)
            const id = row['student_id'] || row['student_id '];
            const name = row['student_name'];

            if (id && name) {
                const ref = db.collection('students').doc(id.toString());
                batch.set(ref, {
                    student_id: id,
                    student_name: name,
                    department: row['department'] || 'General',
                    email: `${id}@student.fms.local`
                });
                count++;
            }
        });

        if (count > 0) {
            await batch.commit();
            alert(`Uploaded ${count} students to Roster.`);
            status.innerText = "Done.";
        } else {
            status.innerText = "No valid rows found.";
        }
    }
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadProfile();
});

function loadProfile() {
    // Just display current email
    const user = firebase.auth().currentUser;
    if (user) {
        if (document.getElementById('profile-email'))
            document.getElementById('profile-email').innerText = user.email;
    }
}
