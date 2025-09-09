(() => {
  const steps = [...document.querySelectorAll('.step')];
  const form  = document.getElementById('merchant-app');
  const alerts = document.getElementById('pfAlerts');
  const bar = document.getElementById('progressBar');

  const MAX_FILE = 25 * 1024 * 1024; // 25MB
  const MAX_TOTAL = 35 * 1024 * 1024; // 35MB

  // Signature
  const canvas = document.getElementById('signaturePad');
  let pad;
  function resizeCanvas() {
    if (!canvas) return;
    const r = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    canvas.width = rect.width * r; canvas.height = rect.height * r;
    canvas.getContext('2d').scale(r, r);
    if (pad) pad.clear();
  }
  if (canvas && window.SignaturePad) {
    pad = new SignaturePad(canvas, { backgroundColor: 'rgba(255,255,255,0)' });
    window.addEventListener('resize', resizeCanvas);
  }

  function showStep(n) {
    steps.forEach(s => s.classList.add('d-none','inactive'));
    const step = steps[n-1];
    step.classList.remove('d-none','inactive');
    step.classList.add('active');
    const pct = (n / steps.length) * 100;
    if (bar) bar.style.width = pct + '%';
    if (step.dataset.step === '5') setTimeout(resizeCanvas, 60);
    step.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  showStep(1);

  function activeIndex() {
    return steps.findIndex(s => !s.classList.contains('d-none'));
  }

  function validateCurrentStep() {
    const idx = activeIndex();
    const step = steps[idx];
    const inputs = step.querySelectorAll('input,select,textarea');
    for (const el of inputs) {
      if (el.required && !el.checkValidity()) { el.reportValidity(); return false; }
    }
    return true;
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-next]')) {
      if (!validateCurrentStep()) return;
      const idx = activeIndex();
      showStep(Math.min(idx+2, steps.length));
    }
    if (e.target.closest('[data-prev]')) {
      const idx = activeIndex();
      showStep(Math.max(idx, 1));
    }
  });

  // Dropzones (opcionales)
  const drops = document.querySelectorAll('.pf-drop');
  drops.forEach(area => {
    const forId = area.getAttribute('data-for');
    const input = document.getElementById(forId);
    const filesBox = area.querySelector('.pf-files');
    const multiple = area.hasAttribute('data-multiple');

    function setFiles(fileList) {
      const allowed = ['pdf','jpg','jpeg','png'];
      const dt = new DataTransfer();
      filesBox.innerHTML = '';
      let total = 0;
      let oversized = false;

      for (const f of fileList) {
        const ext = (f.name.split('.').pop() || '').toLowerCase();
        if (!allowed.includes(ext)) continue;
        total += f.size;
        if (f.size > MAX_FILE) oversized = true;
        dt.items.add(f);
        const pill = document.createElement('span');
        pill.className = 'pf-file-pill';
        pill.textContent = `${f.name} (${Math.round(f.size/1024)} KB)`;
        filesBox.appendChild(pill);
      }
      input.files = dt.files;

      // Mensajes informativos, NO bloquean
      const info = document.getElementById('fileInfo');
      if (!info) return;
      info.classList.add('d-none');
      let msg = '';
      if (oversized) msg += 'One or more files exceed 25MB. ';
      if (total > MAX_TOTAL) msg += 'Total upload size is high. ';
      if (msg) {
        info.textContent = msg + 'You can continue — our team will contact you to collect documents if needed.';
        info.classList.remove('d-none');
      }
    }

    area.addEventListener('click', () => input.click());
    input.addEventListener('change', () => setFiles(input.files));
    ['dragenter','dragover'].forEach(evt => area.addEventListener(evt, ev => {
      ev.preventDefault(); ev.stopPropagation(); area.classList.add('dragover');
    }));
    ['dragleave','dragend','drop'].forEach(evt => area.addEventListener(evt, ev => {
      ev.preventDefault(); ev.stopPropagation(); area.classList.remove('dragover');
    }));
    area.addEventListener('drop', ev => {
      const items = ev.dataTransfer.files;
      if (!multiple && items.length > 1) setFiles([items[0]]);
      else setFiles(items);
    });
  });

  // Helpers
  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });

  function flash(type, msg) {
    if (!alerts) return;
    alerts.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
    setTimeout(()=>alerts.innerHTML='', 6000);
  }

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateCurrentStep()) return;

    // Firma obligatoria
    if (pad && pad.isEmpty()) {
      flash('warning', 'Please provide your signature to continue.');
      showStep(5);
      return;
    }

    // Construye fields
    const fd = new FormData(form);
    const fields = {};
    fd.forEach((v, k) => {
      if (v instanceof File) return; // archivos aparte
      fields[k] = v;
    });

    // Archivos a base64 (opcionales)
    const fileIds = ['bank_statement_1','bank_statement_2','bank_statement_3','id_images'];
    const filesPayload = [];
    for (const id of fileIds) {
      const input = document.getElementById(id);
      if (!input || !input.files || !input.files.length) continue;
      for (const f of input.files) {
        const base64 = await toBase64(f);
        filesPayload.push({ name: f.name, type: f.type, base64 });
      }
    }

    const signatureDataUrl = pad ? pad.toDataURL('image/png') : '';

    // UI: enviando
    const btn = document.getElementById('pfSubmit');
    const origHtml = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = 'Sending…';

    try {
      const subject = `Web Application – ${fields.legal_company_name || 'Unknown Company'}`;
      const resp = await fetch('/.netlify/functions/send-funding-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          to: 'sdgraphicsonfire@gmail.com', // destino de prueba
          fields,
          files: filesPayload,
          signatureDataUrl
        })
      });

      if (!resp.ok) {
        const text = await resp.text();
        flash('danger', `There was an error submitting your application. Please try again.\n${text}`);
        btn.disabled = false; btn.innerHTML = origHtml;
        return;
      }

      // Éxito → thanks
      window.location.href = '/thanks-funding';
    } catch (err) {
      flash('danger', `Unexpected error: ${err.message}`);
      btn.disabled = false; btn.innerHTML = origHtml;
    }
  });
})();

