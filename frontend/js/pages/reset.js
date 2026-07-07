  const token = new URLSearchParams(location.search).get('token');
  const err = document.getElementById('rp-error');
  const submit = document.getElementById('rp-submit');
  if (!token) {
    err.textContent = 'This reset link is missing its token. Request a new one from the login screen.';
    err.classList.remove('hidden');
    submit.disabled = true;
  }
  submit.addEventListener('click', async () => {
    const pw = document.getElementById('rp-password').value;
    const cf = document.getElementById('rp-confirm').value;
    err.classList.add('hidden');
    if (pw.length < 6) { err.textContent = 'Password must be at least 6 characters.'; err.classList.remove('hidden'); return; }
    if (pw !== cf)     { err.textContent = 'Passwords do not match.'; err.classList.remove('hidden'); return; }
    submit.disabled = true; const o = submit.textContent; submit.textContent = 'Updating…';
    try {
      await API.resetPassword(token, pw);
      document.getElementById('reset-form').classList.add('hidden');
      document.getElementById('reset-done').classList.remove('hidden');
    } catch (e) {
      err.textContent = e.message || 'Could not reset password. The link may have expired.';
      err.classList.remove('hidden');
      submit.disabled = false; submit.textContent = o;
    }
  });
