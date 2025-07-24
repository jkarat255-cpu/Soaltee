// Supabase Auth logic for JobPrep Pro
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://ajlbsparzifaqlcwcsdh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqbGJzcGFyemlmYXFsY3djc2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyOTU4NjYsImV4cCI6MjA2ODg3MTg2Nn0.qJCIb1q1ug4CiwqWKryZt_1LQWIWVnXk3o53VxO--HQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper to show messages
function showAuthMessage(msg, color = 'red') {
  const el = document.getElementById('authMessage');
  el.textContent = msg;
  el.className = `mt-4 text-center text-sm text-${color}-600`;
}

// Seeker Sign In
const seekerSignInForm = document.getElementById('seekerSignInForm');
if (seekerSignInForm) {
  seekerSignInForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('seekerSignInEmail').value;
    const password = document.getElementById('seekerSignInPassword').value;
    showAuthMessage('Signing in...', 'blue');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) return showAuthMessage(authError.message);
    if (!authData.session.user.email_confirmed_at) {
      return showAuthMessage('Please verify your email before signing in.');
    }
    // Check if user exists in user(seeker) table by email only
    let { data, error: seekerError } = await supabase.from('user(seeker)').select('*').eq('email', email).single();
    if (seekerError || !data) {
      // Insert into user(seeker) table if not exists, with name, email, password
      const name = document.getElementById('seekerSignUpName')?.value || email.split('@')[0];
      await supabase.from('user(seeker)').insert([{ name, email, password }]);
    }
    // Store role and redirect
    localStorage.setItem('userRole', 'seeker');
    localStorage.setItem('userEmail', email);
    showAuthMessage('Signed in successfully! Redirecting...', 'green');
    setTimeout(() => { window.location.href = 'index.html'; }, 1000);
  });
}
// Employer Sign In
const employerSignInForm = document.getElementById('employerSignInForm');
if (employerSignInForm) {
  employerSignInForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('employerSignInEmail').value;
    const password = document.getElementById('employerSignInPassword').value;
    showAuthMessage('Signing in...', 'blue');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) return showAuthMessage(authError.message);
    if (!authData.session.user.email_confirmed_at) {
      return showAuthMessage('Please verify your email before signing in.');
    }
    // Check if user exists in user(employer) table by email only
    let { data, error: empError } = await supabase.from('user(employer)').select('*').eq('email', email).single();
    if (empError || !data) {
      // Insert into user(employer) table if not exists, with name, email, password
      const name = document.getElementById('employerSignUpName')?.value || email.split('@')[0];
      await supabase.from('user(employer)').insert([{ name, email, password }]);
    }
    // Store role and redirect
    localStorage.setItem('userRole', 'employer');
    localStorage.setItem('userEmail', email);
    showAuthMessage('Signed in successfully! Redirecting...', 'green');
    setTimeout(() => { window.location.href = 'index.html'; }, 1000);
  });
}
// Seeker Sign Up
const seekerSignUpForm = document.getElementById('seekerSignUpForm');
if (seekerSignUpForm) {
  seekerSignUpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('seekerSignUpName').value;
    const email = document.getElementById('seekerSignUpEmail').value;
    const password = document.getElementById('seekerSignUpPassword').value;
    showAuthMessage('Signing up...', 'blue');
    const { user, error } = await supabase.auth.signUp({ email, password });
    if (error) return showAuthMessage(error.message);
    // Do NOT insert into user(seeker) table here
    showAuthMessage('Check your email for verification!', 'green');
  });
}
// Employer Sign Up
const employerSignUpForm = document.getElementById('employerSignUpForm');
if (employerSignUpForm) {
  employerSignUpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('employerSignUpName').value;
    const email = document.getElementById('employerSignUpEmail').value;
    const password = document.getElementById('employerSignUpPassword').value;
    showAuthMessage('Signing up...', 'blue');
    const { user, error } = await supabase.auth.signUp({ email, password });
    if (error) return showAuthMessage(error.message);
    // Do NOT insert into user(employer) table here
    showAuthMessage('Check your email for verification!', 'green');
  });
} 