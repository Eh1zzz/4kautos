  // Flutterwave redirects here with ?status=&tx_ref=&transaction_id=. This page is
  // just feedback — the authoritative escrow update happens server-side via webhook.
  const p = new URLSearchParams(location.search);
  const status = (p.get('status') || '').toLowerCase();
  const icon = document.getElementById('pay-icon');
  const title = document.getElementById('pay-title');
  const msg = document.getElementById('pay-msg');

  if (status === 'successful' || status === 'completed') {
    icon.textContent = '✅';
    title.textContent = 'Payment received';
    msg.textContent = 'Your funds are now held safely in escrow — released to the seller only once you confirm the vehicle. Taking you to your dashboard…';
  } else if (status === 'cancelled') {
    icon.textContent = '↩️';
    title.textContent = 'Payment cancelled';
    msg.textContent = 'No charge was made. Returning you to your dashboard — you can start the payment again anytime.';
  } else {
    icon.textContent = '⏳';
    title.textContent = 'Checking your payment…';
    msg.textContent = 'Your dashboard will show the latest status — we confirm every payment securely on our server. Taking you there now…';
  }
  // Always return to the app — the dashboard reflects the real (webhook-confirmed) status.
  setTimeout(() => { location.href = 'profile.html'; }, 3000);
