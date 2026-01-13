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
