/**
 * auth.js
 * Handles Login, Registration, and "Pending" Status Checks.
 */

let selectedRole = null;
const DOMAIN = "fms.local"; // Synthetic domain for ID-based logins

// --- UI Toggle Functions ---

function openLoginModal(role) {
    selectedRole = role;
    document.getElementById('modalTitle').innerText = `${role.charAt(0).toUpperCase() + role.slice(1)} Login`;
    updateLoginFields(role); // Update labels if needed
    document.getElementById('loginModal').classList.add('active');
    document.getElementById('registerModal').classList.remove('active');
    document.getElementById('loginForm').reset();
    document.getElementById('loginError').style.display = 'none';
}

function closeLoginModal() {
    document.getElementById('loginModal').classList.remove('active');
}

function openRegisterModal() {
    if (!selectedRole) return alert("Please select a role first."); // Should not happen via flow
    document.getElementById('regModalTitle').innerText = `Register as ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}`;
    renderDynamicFields(selectedRole);
    document.getElementById('registerModal').classList.add('active');
    document.getElementById('loginModal').classList.remove('active');
    document.getElementById('registerForm').reset();
    document.getElementById('regError').style.display = 'none';
}

function closeRegisterModal() {
    document.getElementById('registerModal').classList.remove('active');
}

function switchToRegister() {
    openRegisterModal();
}

function switchToLogin() {
    openLoginModal(selectedRole);
}

// --- Dynamic Form Rendering ---

function updateLoginFields(role) {
    const lbl = document.querySelector('label[for="email"]');
    const inp = document.getElementById('email');

    if (role === 'student') {
        lbl.innerText = "Registration Number";
        inp.placeholder = "e.g. 2023001";
        inp.type = "text";
    } else if (role === 'department') {
        lbl.innerText = "Department ID";
        inp.placeholder = "e.g. CSE-01";
        inp.type = "text";
    } else {
        lbl.innerText = "Email Address";
        inp.placeholder = "name@example.com";
        inp.type = "email";
    }
}

function renderDynamicFields(role) {
    const container = document.getElementById('dynamicFields');
    let html = '';

    if (role === 'student') {
        html += `
      <div class="form-group">
        <label>Registration Number</label>
        <input type="text" id="regId" required placeholder="Unique Student ID">
      </div>
      <div class="form-group">
        <label>Department Code</label>
        <select id="regDept" required style="width:100%; padding:0.75rem; border-radius:0.5rem; border:1px solid #ccc;">
            <option value="CSE">CSE</option>
            <option value="ECE">ECE</option>
            <option value="MECH">MECH</option>
            <option value="CIVIL">CIVIL</option>
            <option value="EEE">EEE</option>
        </select>
      </div>
    `;
    } else if (role === 'department') {
        html += `
      <div class="form-group">
        <label>Department ID</label>
        <input type="text" id="regId" required placeholder="e.g. CSE-001">
      </div>
      <div class="form-group">
        <label>Session / BatchYear</label>
        <input type="text" id="regSession" required placeholder="e.g. 2023-2024">
      </div>
    `;
    } else if (role === 'teacher') {
        html += `
      <div class="form-group">
        <label>Email Address</label>
        <input type="email" id="regEmail" required placeholder="teacher@college.edu">
      </div>
      <div class="form-group">
        <label>Department</label>
        <input type="text" id="regDept" required placeholder="e.g. CSE">
      </div>
    `;
    } else {
        // Admin
        html += `
      <div class="form-group">
        <label>Email Address</label>
        <input type="email" id="regEmail" required placeholder="admin@college.edu">
      </div>
    `;
    }
    container.innerHTML = html;
}

// --- Helper: Email Generator ---
// Converts RegNum/ID to a synthetic email for Firebase Auth
function getAuthEmail(role, mode) {
    // mode is 'login' or 'register'
    if (role === 'student') {
        const id = document.getElementById(mode === 'login' ? 'email' : 'regId').value;
        return `${id}@student.${DOMAIN}`;
    }
    if (role === 'department') {
        const id = document.getElementById(mode === 'login' ? 'email' : 'regId').value;
        return `${id}@dept.${DOMAIN}`;
    }
    // Teachers/Admins use real input
    return document.getElementById(mode === 'login' ? 'email' : 'regEmail').value;
}

// --- Core Logic ---

async function handleRegisterForm(e) {
    e.preventDefault();
    const errorMsg = document.getElementById('regError');
    const btn = e.target.querySelector('button');

    errorMsg.style.display = 'none';
    btn.disabled = true;
    btn.innerText = "Registering...";

    try {
        const email = getAuthEmail(selectedRole, 'register');
        const password = document.getElementById('regPassword').value;
        const name = document.getElementById('regName').value;

        // 1. Create Auth User
        const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
        const user = cred.user;

        // 2. Prepare Profile Data
        let profile = {
            uid: user.uid,
            role: selectedRole,
            name: name,
            email: email,
            status: 'pending', // Default status
            createdAt: new Date()
        };

        // Add role-specific fields
        if (selectedRole === 'student') {
            profile.regNum = document.getElementById('regId').value;
            profile.department = document.getElementById('regDept').value;
        } else if (selectedRole === 'department') {
            profile.deptId = document.getElementById('regId').value;
            profile.session = document.getElementById('regSession').value;
        } else if (selectedRole === 'teacher') {
            profile.department = document.getElementById('regDept').value;
        }

        // 3. Save to Firestore
        await db.collection('users').doc(user.uid).set(profile);

        // 4. Sign Out & Notify
        await firebase.auth().signOut();

        alert("Registration Successful!\n\nYour account is now PENDING APPROVAL by an Admin.\nYou will not be able to login until approved.");
        closeRegisterModal();

    } catch (err) {
        console.error(err);
        errorMsg.innerText = err.message;
        errorMsg.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.innerText = "Submit Registration";
    }
}

async function handleLoginForm(e) {
    e.preventDefault();
    const errorMsg = document.getElementById('loginError');
    const btn = e.target.querySelector('button');

    errorMsg.style.display = 'none';
    btn.innerText = "Verifying...";
    btn.disabled = true;

    try {
        const email = getAuthEmail(selectedRole, 'login');
        const password = document.getElementById('password').value;

        // 1. Authenticate
        const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
        const user = cred.user;

        // 2. Check Firestore Profile Status
        const doc = await db.collection('users').doc(user.uid).get();

        if (!doc.exists) {
            // Legacy or manual users without profile doc?
            // For updated system, fail safely or allow if Admin
            if (selectedRole === 'admin') {
                proceedLogin(user.email);
                return;
            }
            throw new Error("User profile not found. Please contact support.");
        }

        const data = doc.data();

        if (data.role !== selectedRole && selectedRole !== 'admin') {
            throw new Error(`Role mismatch. This account is registered as ${data.role}.`);
        }

        if (data.status === 'pending') {
            await firebase.auth().signOut();
            throw new Error("Account is Pending Approval. Please contact Admin.");
        }

        if (data.status === 'rejected') {
            await firebase.auth().signOut();
            throw new Error("Account has been Rejected.");
        }

        // 3. Approved
        proceedLogin(user.email);

    } catch (err) {
        console.error(err);
        let msg = err.message;
        if (err.code === 'auth/user-not-found') msg = "User not found.";
        if (err.code === 'auth/wrong-password') msg = "Incorrect password.";
        errorMsg.innerText = msg;
        errorMsg.style.display = 'block';
        // Ensure logout if failed halfway
        if (firebase.auth().currentUser) firebase.auth().signOut();
    } finally {
        btn.innerText = "Sign In";
        btn.disabled = false;
    }
}

function proceedLogin(email) {
    localStorage.setItem("fms_role", selectedRole);
    localStorage.setItem("fms_user", email);
    window.location.href = `${selectedRole}.html`;
}

// Global Auth Check (unchanged but robust)
function checkAuth(requiredRole) {
    const role = localStorage.getItem("fms_role");
    firebase.auth().onAuthStateChanged((user) => {
        if (!user) {
            window.location.href = "index.html";
        } else {
            if (role !== requiredRole && role !== 'admin') {
                alert("Access Denied");
                window.location.href = "index.html";
            }
        }
    });
}

function logout() {
    if (confirm("Are you sure you want to logout?")) {
        firebase.auth().signOut().then(() => {
            localStorage.removeItem("fms_role");
            window.location.href = "index.html";
        });
    }
}
