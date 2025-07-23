// Tab switching logic for auth.html

document.addEventListener('DOMContentLoaded', function () {
    // Main tabs
    const seekerTab = document.getElementById('seekerTab');
    const employerTab = document.getElementById('employerTab');
    const seekerForms = document.getElementById('seekerForms');
    const employerForms = document.getElementById('employerForms');

    // Sub-tabs for seeker
    const seekerSignInTab = document.getElementById('seekerSignInTab');
    const seekerSignUpTab = document.getElementById('seekerSignUpTab');
    const seekerSignInForm = document.getElementById('seekerSignInForm');
    const seekerSignUpForm = document.getElementById('seekerSignUpForm');

    // Sub-tabs for employer
    const employerSignInTab = document.getElementById('employerSignInTab');
    const employerSignUpTab = document.getElementById('employerSignUpTab');
    const employerSignInForm = document.getElementById('employerSignInForm');
    const employerSignUpForm = document.getElementById('employerSignUpForm');

    // Main tab switching
    seekerTab.addEventListener('click', function () {
        seekerTab.classList.add('text-blue-600', 'border-blue-600');
        seekerTab.classList.remove('text-gray-500', 'border-transparent');
        employerTab.classList.remove('text-blue-600', 'border-blue-600');
        employerTab.classList.add('text-gray-500', 'border-transparent');
        seekerForms.classList.remove('hidden');
        employerForms.classList.add('hidden');
    });
    employerTab.addEventListener('click', function () {
        employerTab.classList.add('text-blue-600', 'border-blue-600');
        employerTab.classList.remove('text-gray-500', 'border-transparent');
        seekerTab.classList.remove('text-blue-600', 'border-blue-600');
        seekerTab.classList.add('text-gray-500', 'border-transparent');
        employerForms.classList.remove('hidden');
        seekerForms.classList.add('hidden');
    });

    // Seeker sub-tab switching
    seekerSignInTab.addEventListener('click', function () {
        seekerSignInTab.classList.add('text-blue-600', 'border-blue-600');
        seekerSignInTab.classList.remove('text-gray-500', 'border-transparent');
        seekerSignUpTab.classList.remove('text-blue-600', 'border-blue-600');
        seekerSignUpTab.classList.add('text-gray-500', 'border-transparent');
        seekerSignInForm.classList.remove('hidden');
        seekerSignUpForm.classList.add('hidden');
    });
    seekerSignUpTab.addEventListener('click', function () {
        seekerSignUpTab.classList.add('text-blue-600', 'border-blue-600');
        seekerSignUpTab.classList.remove('text-gray-500', 'border-transparent');
        seekerSignInTab.classList.remove('text-blue-600', 'border-blue-600');
        seekerSignInTab.classList.add('text-gray-500', 'border-transparent');
        seekerSignUpForm.classList.remove('hidden');
        seekerSignInForm.classList.add('hidden');
    });

    // Employer sub-tab switching
    employerSignInTab.addEventListener('click', function () {
        employerSignInTab.classList.add('text-blue-600', 'border-blue-600');
        employerSignInTab.classList.remove('text-gray-500', 'border-transparent');
        employerSignUpTab.classList.remove('text-blue-600', 'border-blue-600');
        employerSignUpTab.classList.add('text-gray-500', 'border-transparent');
        employerSignInForm.classList.remove('hidden');
        employerSignUpForm.classList.add('hidden');
    });
    employerSignUpTab.addEventListener('click', function () {
        employerSignUpTab.classList.add('text-blue-600', 'border-blue-600');
        employerSignUpTab.classList.remove('text-gray-500', 'border-transparent');
        employerSignInTab.classList.remove('text-blue-600', 'border-blue-600');
        employerSignInTab.classList.add('text-gray-500', 'border-transparent');
        employerSignUpForm.classList.remove('hidden');
        employerSignInForm.classList.add('hidden');
    });
}); 