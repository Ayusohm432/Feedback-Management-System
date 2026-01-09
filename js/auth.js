
function login(role){
 localStorage.setItem("role",role);
 window.location.href=role+".html";
}
