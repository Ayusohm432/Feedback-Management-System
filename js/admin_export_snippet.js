
// --- Export Funtionality ---

async function exportSystemSummaryPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text("Feedback Management System - System Summary", 14, 20);
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 30);

    // Stats
    const sCount = document.getElementById('count-student').innerText;
    const tCount = document.getElementById('count-teacher').innerText;
    const dCount = document.getElementById('count-dept').innerText;

    doc.text(`Total Students: ${sCount}`, 14, 45);
    doc.text(`Total Teachers: ${tCount}`, 14, 52);
    doc.text(`Active Departments: ${dCount}`, 14, 59);

    let yPos = 70;

    // Charts
    try {
        if (deptChartInstance) {
            const img = deptChartInstance.toBase64Image();
            doc.addImage(img, 'PNG', 14, yPos, 180, 80);
            doc.text("Department Performance (Avg Rating)", 14, yPos - 5);
            yPos += 95;
        }

        if (window.trendInstance) {
            if (yPos > 200) { doc.addPage(); yPos = 20; }
            const img = window.trendInstance.toBase64Image();
            doc.addImage(img, 'PNG', 14, yPos, 180, 80);
            doc.text("Submission Trend (Last 7 Days)", 14, yPos - 5);
        }
    } catch (e) {
        console.warn("Chart export error:", e);
        doc.text("Chart data unavailable for export.", 14, yPos);
    }

    doc.save("FMS_System_Summary.pdf");
}

async function exportFeedbackDumpXLSX() {
    // Show Loading
    const btn = event.target.closest('button');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Generating...';

    try {
        const snap = await db.collection('feedback').orderBy('submitted_at', 'desc').limit(2000).get();
        const data = [];

        // Pre-fetch teacher names if needed, but we have allTeachers global
        // Map data
        snap.forEach(doc => {
            const d = doc.data();
            const teacher = allTeachers.find(t => t.id === d.teacher_id);
            data.push({
                "Subject": d.subject || 'N/A',
                "Teacher Name": teacher ? teacher.name : 'Unknown',
                "Department": d.department || 'N/A',
                "Rating": d.rating,
                "Comments": d.comments || '',
                "Year": d.year || '-',
                "Semester": d.semester || '-',
                "Date": d.submitted_at ? new Date(d.submitted_at.seconds * 1000).toLocaleDateString() : '-'
            });
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Feedback Data");
        XLSX.writeFile(wb, "FMS_Feedback_Dump.xlsx");

    } catch (e) {
        console.error(e);
        alert("Export failed: " + e.message);
    } finally {
        btn.innerHTML = originalText;
    }
}

async function exportDeptComparisonXLSX() {
    try {
        const snap = await db.collection('feedback').get();
        const deptStats = {};

        // Aggregate
        snap.forEach(doc => {
            const d = doc.data();
            const dept = d.department || 'General';
            if (!deptStats[dept]) deptStats[dept] = { sum: 0, count: 0 };
            deptStats[dept].sum += Number(d.rating);
            deptStats[dept].count++;
        });

        const data = Object.keys(deptStats).map(dept => ({
            "Department": dept,
            "Average Rating": (deptStats[dept].sum / deptStats[dept].count).toFixed(2),
            "Total Feedbacks": deptStats[dept].count
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Department Performance");
        XLSX.writeFile(wb, "FMS_Dept_Performance.xlsx");

    } catch (e) {
        console.error(e);
        alert("Export failed.");
    }
}

// Global Bind
window.exportSystemSummaryPDF = exportSystemSummaryPDF;
window.exportFeedbackDumpXLSX = exportFeedbackDumpXLSX;
window.exportDeptComparisonXLSX = exportDeptComparisonXLSX;
