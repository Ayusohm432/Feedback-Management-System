Based on the source code and existing documentation provided, here is a complete and detailed **README.md** file for the Feedback Management System (FMS).

---

# Feedback Management System (FMS)

## 📌 Project Overview

The Feedback Management System (FMS) is a secure, web-based platform designed for academic institutions to collect and analyze feedback from students regarding their teachers and courses. The system features a role-based access control architecture, providing specialized dashboards for Students, Teachers, Departments, and Administrators.

Key goals include ensuring **student anonymity**, providing **real-time performance analytics** for educators, and enabling **data-driven decision-making** for academic administrators.

---

## 🏗️ System Architecture

* **Frontend**: Built with HTML5, CSS3 (using a custom HSL-based color palette), and modern JavaScript (ES6+).
* **Database**: Uses **Firebase Firestore** as a centralized, real-time cloud database.
* **Authentication**: Managed via **Firebase Authentication**.
* **Hosting**: Deployed on **GitHub Pages**.

---

## 👥 User Roles & Features

### 1. Student Dashboard

* **Anonymous Feedback**: Submit ratings (1-5 stars) and comments for assigned subjects.
* **Open Reviews**: A dedicated section showing which teachers and subjects are currently open for feedback based on the student's Year and Semester.
* **Submission History**: View a log of previously submitted feedback (comments are hidden for privacy).
* **Profile Management**: View registration details, department, and current academic session.

### 2. Teacher Dashboard

* **Performance Analytics**: Real-time charts showing rating trends, distribution, and performance by subject or session.
* **Feedback Explorer**: Browse student comments with filtering options for ratings and academic years.
* **Reporting**: Export detailed performance reports as PDF (including a "Certificate of Excellence" for high ratings) or Excel.
* **Subject Overview**: View list of currently assigned subjects and their review status.

### 3. Department Dashboard

* **Faculty Management**: Add teachers, manage their assigned subjects, and toggle their feedback availability.
* **Student Administration**: Handle student registrations, batch-promote or demote students between semesters, and manage bulk CSV uploads.
* **Academic Sessions**: Create and manage academic sessions (e.g., "2023-27") to organize data.
* **Departmental Analytics**: Monitor overall participation rates and subject-wise performance within the department.

### 4. Admin Dashboard

* **Global Overview**: Track system-wide statistics for total students, teachers, and pending approvals.
* **User Approvals**: Review and approve/reject new registration requests from all roles.
* **Advanced Analytics**: Access global feedback trends and cross-departmental performance comparisons.
* **System Reports**: Export complete system-wide data dumps and performance summaries.

---

## 🛠️ Technology Stack

* **Core**: HTML5, CSS3, JavaScript (Vanilla).
* **Icons & Fonts**: Remix Icon, Google Fonts (Outfit).
* **Data Visualization**: Chart.js.
* **Data Processing**: PapaParse (for CSV bulk uploads).
* **Export Tools**: jsPDF, AutoTable (for PDF generation), XLSX (for Excel reports).

---

## ⚙️ Configuration & Setup

The system connects to Firebase using the following configuration (found in `js/firebase.js`):

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "feedback-management-syst-5344a.firebaseapp.com",
  projectId: "feedback-management-syst-5344a",
  // ... rest of config
};

```

---

## 🤝 Project Credits

* **Institution**: Gaya College of Engineering
* **Guidance**: Prof. Pratik Ranjan (Assistant Professor, Dept. of CSE)
* **Developers**:
* **Ayush Kumar** (Roll: 23CSE09LE, Reg: 23105110902)
* **Priyanshu Kumar** (Roll: 22CSE14, Reg: 22105110024)
