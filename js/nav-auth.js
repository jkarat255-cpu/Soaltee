// Navigation auth/profile logic for JobPrep Pro

document.addEventListener('DOMContentLoaded', function () {
    const loginBtn = document.getElementById('loginBtn');
    const profileMenu = document.getElementById('profileMenu');
    const profileIcon = document.getElementById('profileIcon');
    const profileDropdown = document.getElementById('profileDropdown');
    const logoutBtn = document.getElementById('logoutBtn');
    const userRole = localStorage.getItem('userRole');

    function showProfile() {
        if (loginBtn) loginBtn.style.display = 'none';
        if (profileMenu) profileMenu.classList.remove('hidden');
    }
    function showLogin() {
        if (loginBtn) loginBtn.style.display = '';
        if (profileMenu) profileMenu.classList.add('hidden');
    }

    if (userRole) {
        showProfile();
    } else {
        showLogin();
    }

    // Dropdown toggle
    if (profileIcon && profileDropdown) {
        profileIcon.addEventListener('click', function (e) {
            e.stopPropagation();
            profileDropdown.classList.toggle('hidden');
        });
        // Hide dropdown when clicking outside
        document.addEventListener('click', function () {
            profileDropdown.classList.add('hidden');
        });
    }

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
            localStorage.removeItem('userRole');
            localStorage.removeItem('userEmail');
            // Optionally sign out from Supabase session as well
            if (window.supabase) {
                window.supabase.auth.signOut();
            }
            showLogin();
            window.location.href = 'index.html';
        });
    }
}); 