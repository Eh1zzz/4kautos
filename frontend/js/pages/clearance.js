  const params = new URLSearchParams(location.search);

  // Prefill from a car detail page (?cif=<amount>&cur=<NGN|USD>)
  if (params.get('cif')) document.getElementById('cif-value').value = params.get('cif');
  if (params.get('cur')) document.getElementById('cif-cur').value = params.get('cur') === 'USD' ? 'USD' : 'NGN';

  const r = n => Math.round(Number(n) || 0).toLocaleString('en-US');
  function moneyPair(ngn, usd) {
    const d = Money.display();
    const primary   = d === 'USD' ? `$${r(usd)}` : `₦${r(ngn)}`;
    const secondary = d === 'USD' ? `₦${r(ngn)}` : `$${r(usd)}`;
    return `<span class="price-main">${primary}</span><span class="price-sub">≈ ${secondary}</span>`;
  }
  const stars = n => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));

  function agentCard(a, rate) {
    const priced = a.totalNgn != null;
    return `
      <div class="agent-card ${a.bestRate ? 'best' : ''}">
        ${a.bestRate ? '<span class="best-badge">Best Rate</span>' : ''}
        <div class="agent-head">
          <div>
            <div class="agent-name">${esc(a.name)} ${a.verified ? '<span class="verified-tick" title="Verified">✓</span>' : ''}</div>
            <div class="agent-meta">${stars(a.rating)} ${a.rating} · ${a.reviews ?? ''} reviews · ${esc(a.port || '')}</div>
          </div>
          ${priced ? `<div class="agent-total js-price-static">${moneyPair(a.totalNgn, a.totalUsd)}</div>` : ''}
        </div>
        <div class="agent-services">${(a.services || []).map(s => `<span class="svc-chip">${esc(s)}</span>`).join('')}</div>
        <div class="agent-foot">
          <span class="agent-turn">⏱ ~${a.turnaroundDays} days</span>
          ${priced ? `<span class="agent-fee">Agent fee: $${r(a.agentFeeUsd)}</span>` : `<span class="agent-fee">From $${r(a.baseFeeUsd)} + ${a.ratePercent}%</span>`}
          <a class="agent-call" href="tel:${esc((a.phone||'').replace(/\s/g,''))}">📞 ${esc(a.phone || '')}</a>
        </div>
      </div>`;
  }

  async function loadDirectory() {
    const host = document.getElementById('agents-directory');
    try {
      const agents = await API.getClearanceAgents();
      host.innerHTML = agents
        .sort((a, b) => b.rating - a.rating)
        .map(a => agentCard(a)).join('');
    } catch {
      host.innerHTML = '<p class="empty-state">Could not load agents. Start the backend server.</p>';
    }
  }

  async function runEstimate() {
    const raw = parseFloat(document.getElementById('cif-value').value);
    if (!Number.isFinite(raw) || raw <= 0) { toast('Enter a vehicle value first', 'error'); return; }
    const cur = document.getElementById('cif-cur').value;
    const year = parseInt(document.getElementById('cif-year').value, 10) || undefined;

    const spinner = document.getElementById('clearance-spinner');
    const intro = document.getElementById('clearance-intro');
    const out = document.getElementById('clearance-output');
    spinner.classList.remove('hidden'); intro.classList.add('hidden'); out.classList.add('hidden');

    const body = cur === 'USD' ? { cifValueUsd: raw, year } : { cifValueNgn: raw, year };
    const buyerLoc = (API.getUser && API.getUser()?.location) || '';
    if (buyerLoc) body.destinationLocale = buyerLoc;
    try {
      const d = await API.estimateClearance(body);
      spinner.classList.add('hidden'); out.classList.remove('hidden');

      const g = d.government, rate = d.fx.usdToNgn;
      const dest = d.destination || { country: 'Nigeria' };
      const line = (label, usd) => `<div class="duty-row"><span>${label}</span><span>${moneyPair(usd * rate, usd)}</span></div>`;

      document.getElementById('duty-head').textContent = `Estimated Charges · ${dest.country}`;
      document.getElementById('duty-grid').innerHTML = g.estimate
        ? line(`Estimated import charges (~${g.effectiveDutyPct}%)`, g.total)
        : line('Import Duty (20%)', g.importDuty) + line('NAC Levy (15%)', g.nacLevy) +
          line('ETLS (0.5%)', g.etls) + line('CISS (1%)', g.ciss) +
          line('Port Surcharge (7%)', g.surcharge) + line('VAT (7.5%)', g.vat);
      document.getElementById('duty-total').innerHTML = moneyPair(g.totalNgn, g.total);

      // Nigeria → vetted agents; elsewhere → the destination's contact protocol.
      if (d.agents && d.agents.length) {
        document.getElementById('agents-head').textContent = 'Agents · Best Rate First';
        document.getElementById('agents-list').innerHTML = d.agents.map(a => agentCard(a, rate)).join('');
      } else {
        document.getElementById('agents-head').textContent = `Clearance & handover · ${dest.country}`;
        document.getElementById('agents-list').innerHTML =
          `<div class="agent-card"><div class="agent-head"><b>${esc(dest.contact?.channel || 'International desk')}</b></div>
             <p style="color:var(--text2);font-size:.9rem;margin:.4rem 0">${esc(dest.contact?.protocol || '')}</p>
             <p style="color:var(--text3);font-size:.82rem">Port of entry: ${esc(dest.port || '—')}</p></div>`;
      }

      const note = d.notes && d.notes.length ? `<strong>Note:</strong> ${d.notes.map(esc).join(' ')}<br>` : '';
      const fxLine = `Rate used: $1 = ₦${r(rate)} (${d.fx.source}).`;
      document.getElementById('disclaimer').innerHTML = `${note}${esc(d.disclaimer)} ${fxLine}`;
      out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      spinner.classList.add('hidden'); intro.classList.remove('hidden');
      toast(e.message || 'Estimate failed', 'error');
    }
  }

  document.getElementById('estimate-btn').addEventListener('click', runEstimate);
  loadDirectory();
  if (params.get('cif')) runEstimate();
