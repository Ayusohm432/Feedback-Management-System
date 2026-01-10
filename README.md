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

### 🏠 Landing Page

The entry point of the system allows users to select their specific role (Student, Teacher, Department, or Admin) to log in or register.

> **<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/dfe679dc-ef6c-4a6d-aef1-be5162292148" />
**

### 1. Student Dashboard

* **Anonymous Feedback**: Submit ratings (1-5 stars) and comments for assigned subjects.
* **Open Reviews**: A dedicated section showing which teachers and subjects are currently open for feedback based on the student's Year and Semester.
* **Submission History**: View a log of previously submitted feedback (comments are hidden for privacy).
* **Profile Management**: View registration details, department, and current academic session.

> **<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/a7d2b927-19d6-4bd8-9067-b0a1828db21f" />
**

### 2. Teacher Dashboard

* **Performance Analytics**: Real-time charts showing rating trends, distribution, and performance by subject or session.
* **Feedback Explorer**: Browse student comments with filtering options for ratings and academic years.
* **Reporting**: Export detailed performance reports as PDF (including a "Certificate of Excellence" for high ratings) or Excel.
* **Subject Overview**: View a list of currently assigned subjects and their review status.

> **<img width="1919" height="1079" alt="image" src="https://github.com/user-attachments/assets/18ec2f10-6759-4b13-8746-a9b1e350f891" />
**

### 3. Department Dashboard

* **Faculty Management**: Add teachers, manage their assigned subjects, and toggle their feedback availability.
* **Student Administration**: Handle student registrations, batch-promote or demote students between semesters, and manage bulk CSV uploads.
* **Academic Sessions**: Create and manage academic sessions (e.g., "2023-27") to organize data.
* **Departmental Analytics**: Monitor overall participation rates and subject-wise performance within the department.

> **<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/f816971c-cda7-4460-b1da-f6729ce9145a" />
**

### 4. Admin Dashboard

* **Global Overview**: Track system-wide statistics for total students, teachers, and pending approvals.
* **User Approvals**: Review and approve/reject new registration requests from all roles.
* **Advanced Analytics**: Access global feedback trends and cross-departmental performance comparisons.
* **System Reports**: Export complete system-wide data dumps and performance summaries.

> **<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/ac763c49-be73-41f3-a4b8-cea1a55137fb" />
**

---

## 🛠️ Technology Stack

* **Core**: HTML5, CSS3, JavaScript (Vanilla).
* **Icons & Fonts**: Remix Icon, Google Fonts (Outfit).
* **Data Visualization**: Chart.js.
* **Data Processing**: PapaParse (for CSV bulk uploads).
* **Export Tools**: jsPDF, AutoTable (for PDF generation), XLSX (for Excel reports).

---

## ⚙️ Configuration & Setup

### Firebase Configuration

The system connects to Firebase using the following configuration (found in `js/firebase.js`):

```javascript
const firebaseConfig = {
  apiKey: "AIzaS........................",
  authDomain: "feedback-managemen....................",
  // ... rest of config
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

```

### How to Run Locally

1. Clone the repository:
```bash
git clone https://github.com/ayusohm432/feedback-management-system.git

```


2. Open `index.html` in any modern web browser.
3. Ensure you have an active internet connection to connect to the Firebase backend.

---

## 🎓 Institutional Details

* **Institution**: Gaya College of Engineering
* **Affiliation**: Managed by Bihar Engineering University
* **Location**: Sri Krishna Nagar, P.O Nagariyawan, Via Buniyadganj, Gaya - 823301, Bihar

---

## 🤝 Project Guidance & Developers

### Guided By:

* **Prof. Pratik Ranjan**
* Assistant Professor, Dept. of Computer Science & Engg.



### Developed By:

* **Ayush Kumar**
* Roll No: 23CSE09LE | Registration No: 23105110902
* Final Year CSE


* **Priyanshu Kumar**
* Roll No: 22CSE14 | Registration No: 22105110024
* Final Year CSE



---

*© 2026 Feedback Management System. All Rights Reserved.*
