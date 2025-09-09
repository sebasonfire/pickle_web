/* /js/wizard-funding.js  —  envío robusto con límite total del payload y mejor UX */
(function () {
  const form = document.getElementById('merchant-app');
  if (!form) return;

  const alerts = document.getElementById('pfAlerts');
  const submitBtn = document.getElementById('pfSubmit') || form.querySelector('button[type="submit"]');

  const BODY_BUDGET = 6.5 * 1024 * 1024; // ~6.5MB presupuesto para el JSON completo (evita el límite de 10MB de Netlify)
  const MAX_FILE_NOTE = 'Some files were not sent because of size. We will contact you to collect them directly after you finish.';

  const showAlert = (type, html) => {
    if (!alerts) return alert(html.replace(/<[^>]*>/g, '')); // fallback
    alerts.innerHTML = `<div class="alert alert-${type}">${html}</div>`;
    alerts.scrollIntoView({behavior:'smooth', block:'start'});
  };

  // helpers
  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });

  const grabSignatureDataURL = () => {
    const hidden = document.getElementById('signatureDataUrl');
    if (hidden && hidden.value) return hidden.value;
    const canvas = document.getElementById('signaturePad');
    try { return canvas ? canvas.toDataURL('image/png') : ''; } catch { return ''; }
  };

  const buildSubject = (fields) => {
    const c = fields['legal_company_name'] || fields['Legal Company Name'] || 'Unknown Company';
    return `Web Application — ${c}`;
  };

  // Empaqueta archivos sin pasarse del presupuesto del cuerpo
  async function gatherFilesWithinBudget(inputs, budget) {
    const picked = [];
    let used = 0;
    for (const input of inputs) {
      if (!input.files || !input.files.length) continue;
      for (const f of input.files) {
        // estimación rápida del tamaño en base64: size * 4/3
        const est = Math.ceil((f.size * 4) / 3) + 200; // +200 por metadatos
        if (used + est > budget) {
          picked.push({ skipped: true, name: f.name });
          continue;
        }
        const base64 = await fileToBase64(f);
        used += base64.length; // char length ~ bytes para nuestro presupuesto
        if (used > budget) { // por si el cálculo quedó justo
          picked.push({ skipped: true, name: f.name });
          continue;
        }
        picked.push({ name: f.name, type: f.type, base64 });
      }
    }
    return picked;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const orig = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span class="btn-double-text">Sending…</span>'; }
    showAlert('info', 'Submitting your application…');

    try {
      // 1) Campos
      const fd = new FormData(form);
      const fields = {};
      for (const [k, v] of fd.entries()) if (!(v instanceof File)) fields[k] = v;

      // 2) Firma opcional
      const signatureDataUrl = grabSignatureDataURL();

      // 3) Archivos dentro de presupuesto (dejamos margen para campos/firma)
      const inputs = form.querySelectorAll('input[type="file"]');
      const filesPayload = await gatherFilesWithinBudget(inputs, BODY_BUDGET - JSON.stringify(fields).length - (signatureDataUrl?.length || 0) - 2048);
      const skippedFiles = filesPayload.filter(x => x.skipped).map(x => x.name);
      const filesToSend = filesPayload.filter(x => !x.skipped);

      if (skippedFiles.length) {
        showAlert('warning', `${MAX_FILE_NOTE}<br><small>Skipped: ${skippedFiles.join(', ')}</small>`);
      }

      // 4) Subject
      const subject = buildSubject(fields);

      // 5) Envío a Netlify Function
      const res = await fetch('/.netlify/functions/send-funding-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'sdgraphicsonfire@gmail.com',
          subject,
          fields,
          files: filesToSend,
          signatureDataUrl
        })
      });

      // 6) Manejo de error con detalle
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const t = await res.text();
          msg = t || msg;
        } catch {}
        throw new Error(msg);
      }

      // 7) OK → gracias
      window.location.href = '/thanks-funding';
    } catch (err) {
      const msg = (err && err.message) || String(err);
      showAlert('danger', `There was an error submitting your application. Please try again.<br><small>${msg}</small>`);
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = orig; }
    }
  });
})();
