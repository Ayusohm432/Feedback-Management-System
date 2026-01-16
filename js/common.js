/**
 * js/common.js
 * Common utilities for FMS
 */

const DEGREES = ['B.Tech', 'M.Tech'];

const SEMESTERS = {
    'B.Tech': 8,
    'M.Tech': 4
};

/**
 * Updates the semester dropdown based on the selected degree.
 * @param {string} degreeSelectId - The ID of the degree select element.
 * @param {string} semesterSelectId - The ID of the semester select element.
 * @param {boolean} includeAllOption - Whether to include an "All Semesters" option.
 */
function updateSemesterOptions(degreeSelectId, semesterSelectId, includeAllOption = false) {
    const degreeSelect = document.getElementById(degreeSelectId);
    const semesterSelect = document.getElementById(semesterSelectId);

    if (!degreeSelect || !semesterSelect) return;

    const degree = degreeSelect.value;
    const maxSemesters = SEMESTERS[degree] || 0;

    // Attempt to preserve current selection
    const currentVal = semesterSelect.value;

    semesterSelect.innerHTML = '';

    if (includeAllOption) {
        const allOpt = document.createElement('option');
        allOpt.value = 'all';
        allOpt.innerText = 'All Semesters';
        semesterSelect.appendChild(allOpt);
    } else {
        const defOpt = document.createElement('option');
        defOpt.value = "";
        defOpt.disabled = true;
        defOpt.selected = true;
        defOpt.innerText = "Select Semester";
        semesterSelect.appendChild(defOpt);
    }

    if (maxSemesters > 0) {
        for (let i = 1; i <= maxSemesters; i++) {
            const opt = document.createElement('option');
            opt.value = i.toString();
            opt.innerText = `Sem ${i}`;
            if (opt.value === currentVal) opt.selected = true;
            semesterSelect.appendChild(opt);
        }
    }
}

/**
 * Toggles the sidebar visibility on mobile.
 */
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
}

// Close sidebar when a menu item is clicked (Mobile UX)
document.addEventListener('DOMContentLoaded', () => {
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    sidebarLinks.forEach(link => {
        link.addEventListener('click', () => {
            // If sidebar is active (mobile view mostly), close it
            if (sidebar && sidebar.classList.contains('active')) {
                sidebar.classList.remove('active');
                if (overlay) overlay.classList.remove('active');
            }
        });
    });
});

/**
 * Initializes the drag-and-drop file upload UI.
 * @param {string} inputId - ID of the hidden file input
 * @param {string} zoneId - ID of the drop zone container
 * @param {string} displayId - ID of the element to display file name
 */
function setupFileUploadUI(inputId, zoneId, displayId) {
    const input = document.getElementById(inputId);
    const zone = document.getElementById(zoneId);
    const display = document.getElementById(displayId);

    if (!input || !zone || !display) return;

    // Trigger input click on zone click
    zone.addEventListener('click', () => input.click());

    // Drag events
    ['dragenter', 'dragover'].forEach(eventName => {
        zone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.add('active');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        zone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.remove('active');
        }, false);
    });

    // Drop handler
    zone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            input.files = files;
            updateDisplay(files[0].name);
        }
    }, false);

    // Input change handler
    input.addEventListener('change', () => {
        if (input.files.length > 0) {
            updateDisplay(input.files[0].name);
        }
    });

    function updateDisplay(name) {
        // Accessing 'display' from closure requires this function to be inside setupFileUploadUI
        // But 'display' is defined in setupFileUploadUI scope.
        // Re-fix the structure.
        if (display) {
            display.innerText = name;
            display.style.color = 'var(--primary)';
        }
        const icon = zone ? zone.querySelector('.upload-icon i') : null;
        if (icon) {
            icon.className = 'ri-file-check-line';
        }
    }
}

/**
 * Hashes a string using SHA-256 for privacy.
 * @param {string} str - The string to hash (e.g., student UID).
 * @returns {Promise<string>} - The hex string of the hash.
 */
async function hashStudentId(str) {
    const msgBuffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
