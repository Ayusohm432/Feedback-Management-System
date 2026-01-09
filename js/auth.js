const firebaseConfig = {
  apiKey: "AIzaSyCmHGbZnF4mrkxytznnqW9OsQw-CMlFy-I",
  authDomain: "feedback-management-syst-5344a.firebaseapp.com",
  projectId: "feedback-management-syst-5344a",
  storageBucket: "feedback-management-syst-5344a.firebasestorage.app",
  messagingSenderId: "1023059072824",
  appId: "1:1023059072824:web:9da5a70b6bd2698d5ed3cd",
  measurementId: "G-CHJSKQ7HXK"
};

function login(role){
 localStorage.setItem("role",role);
 window.location.href=role+".html";
}
