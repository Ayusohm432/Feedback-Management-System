/**
 * auth.js
 * Handles login UI, Firebase Auth, and Session Management.
 */

let selectedRole = null;

// UI: Open Login Modal
function openLoginModal(role) {
    selectedRole = role;
    document.getElementById('modalTitle').innerText = `Login as ${role.charAt(0).toUpperCase() + role.slice(1)}`;
    document.getElementById('loginModal').classList.add('active');
    document.getElementById('loginError').style.display = 'none';
    document.getElementById('loginForm').reset();
}

// UI: Close Login Modal
function closeLoginModal() {
    document.getElementById('loginModal').classList.remove('active');
    selectedRole = null;
}

// Core: Handle Form Submission
async function handleLoginForm(e) {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('loginError');
    const btn = e.target.querySelector('button');

    // Basic Validation
    if (!email || !password) {
        showError("Please fill in all fields.");
        return;
    }

    // Loading State
    const originalBtnText = btn.innerText;
    btn.innerText = "Verifying...";
    btn.disabled = true;
    errorMsg.style.display = 'none';

    try {
        // 1. Firebase Authentication
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        console.log(`User ${user.email} authenticated. Checking role permission...`);

        // 2. Role Verification (Optional but Recommended)
        // In a real app, you would query Firestore to check if this email belongs to the selectedRole collection.
        // For this demo, we will trust the Auth and simply redirect.
        // However, if it's ADMIN, let's allow any valid login for now for simplicity, 
        // or you can hardcode specific admin emails here.

        // Save Selection
        localStorage.setItem("fms_role", selectedRole);
        localStorage.setItem("fms_user", user.email);

        // Redirect
        window.location.href = `${selectedRole}.html`;

    } catch (error) {
        console.error("Login Error:", error);
        let message = "Invalid email or password.";
        if (error.code === 'auth/user-not-found') message = "User not found.";
        if (error.code === 'auth/wrong-password') message = "Incorrect password.";
        showError(message);
    } finally {
        btn.innerText = originalBtnText;
        btn.disabled = false;
    }

    function showError(msg) {
        errorMsg.innerText = msg;
        errorMsg.style.display = 'block';
    }
}

// Global: Check Auth on implementation pages
function checkAuth(requiredRole) {
    // Use a slight delay to allow Firebase to restore auth state if needed, 
    // but localStorage is faster for immediate UI blocking.
    const role = localStorage.getItem("fms_role");

    // Strict Real Auth Check listener
    firebase.auth().onAuthStateChanged((user) => {
        if (!user) {
            // Not logged in at all
            console.warn("No active Firebase user found.");
            window.location.href = "index.html";
        } else {
            // Logged in, now check role mismatch
            if (!role) {
                // Should not happen if flow was followed
                window.location.href = "index.html";
            } else if (role !== requiredRole && role !== 'admin') {
                alert(`Access Denied: You are not a ${requiredRole}`);
                window.location.href = "index.html";
            }
        }
    });
}

function logout() {
    firebase.auth().signOut().then(() => {
        localStorage.removeItem("fms_role");
        localStorage.removeItem("fms_user");
        window.location.href = "index.html";
    });
}
