(function () {
  const form = document.getElementById('merchant-app');
  if (!form) return;

  // --- LÓGICA DEL WIZARD (PASOS) ---
  const steps = Array.from(form.querySelectorAll('.step'));
  const nextBtns = form.querySelectorAll('[data-next]');
  const prevBtns = form.querySelectorAll('[data-prev]');
  const progressBar = document.getElementById('progressBar');
  const submitBtn = document.getElementById('pfSubmit');
  let currentStep = 0;

  function updateWizard() {
    const progress = ((currentStep + 1) / steps.length) * 100;
    progressBar.style.width = `${progress}%`;
    steps.forEach((step, index) => {
      step.classList.toggle('d-none', index !== currentStep);
      step.classList.toggle('active', index === currentStep);
    });

    // Si el paso actual contiene el canvas de la firma, redimensionarlo.
    if (steps[currentStep].querySelector('#signaturePad')) {
      resizeCanvas();
    }
  }

  function validateStep(stepIndex) {
    const currentStepElement = steps[stepIndex];
    const inputs = currentStepElement.querySelectorAll('input[required], select[required]');
    let isValid = true;
    inputs.forEach(input => {
      if (!input.value.trim()) {
        input.classList.add('is-invalid');
        isValid = false;
      } else {
        input.classList.remove('is-invalid');
      }
    });
    if (!isValid) {
      alert('Please fill out all required fields before continuing.');
    }
    return isValid;
  }

  nextBtns.forEach(button => {
    button.addEventListener('click', () => {
      if (validateStep(currentStep) && currentStep < steps.length - 1) {
        currentStep++;
        updateWizard();
      }
    });
  });

  prevBtns.forEach(button => {
    button.addEventListener('click', () => {
      if (currentStep > 0) {
        currentStep--;
        updateWizard();
      }
    });
  });

  // --- INICIALIZACIÓN DE LA FIRMA ---
  const canvas = document.getElementById('signaturePad');
  let signaturePad = null;
  if (canvas) {
    signaturePad = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(0, 0, 0)'
    });
    
    document.getElementById('clearSig').addEventListener('click', () => signaturePad.clear());
    document.getElementById('undoSig').addEventListener('click', () => {
        const data = signaturePad.toData();
        if (data && data.length > 0) {
            data.pop();
            signaturePad.fromData(data);
        }
    });
  }

  function resizeCanvas() {
    if (!signaturePad) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
    signaturePad.clear(); // Limpiar después de redimensionar para asegurar un estado limpio
  }
  
  // Ajustar si la ventana cambia de tamaño
  window.addEventListener("resize", resizeCanvas);


  // --- LÓGICA PARA ZONAS DE CARGA DE ARCHIVOS (DRAG & DROP) ---
  document.querySelectorAll('.pf-drop').forEach(dropZone => {
    const input = document.getElementById(dropZone.dataset.for);
    if (!input) return;

    const fileListContainer = dropZone.querySelector('.pf-files');

    const updateFileList = () => {
        fileListContainer.innerHTML = '';
        if (!input.files || input.files.length === 0) return;
        
        const fileNames = Array.from(input.files).map(f => f.name).join(', ');
        fileListContainer.innerHTML = `<div class="pf-file-item">${fileNames} (${input.files.length} file(s))</div>`;
    };

    dropZone.addEventListener('click', () => input.click());
    input.addEventListener('change', updateFileList);
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('is-dragging'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('is-dragging'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('is-dragging');
        if (e.dataTransfer.files.length) {
            input.files = e.dataTransfer.files;
            updateFileList();
        }
    });
  });

  // --- LÓGICA DE ENVÍO DEL FORMULARIO ---
  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });

  function grabSignatureDataURL() {
    return (signaturePad && !signaturePad.isEmpty()) ? signaturePad.toDataURL('image/png') : '';
  }

  function buildSubject(fields) {
    const company = fields['legal_company_name'] || 'Unknown Company';
    return `Web Application — ${company}`;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateStep(currentStep)) return;
    
    const originalHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="btn-double-text">Sending…</span>';

    try {
      const fd = new FormData(form);
      const fields = {};
      for (const [name, value] of fd.entries()) {
        if (!(value instanceof File) || (value instanceof File && value.size === 0)) {
          fields[name] = value;
        }
      }

      const inputs = form.querySelectorAll('input[type="file"]');
      const filesPayload = [];
      for (const input of inputs) {
        if (!input.files || input.files.length === 0) continue;
        for (const f of input.files) {
          if (f.size === 0) continue;
          const base64 = await fileToBase64(f);
          filesPayload.push({ name: f.name, type: f.type, base64 });
        }
      }

      const signatureDataUrl = grabSignatureDataURL();
      const subject = buildSubject(fields);

      const res = await fetch('/.netlify/functions/send-funding-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'partners@picklefunding.com',
          subject,
          fields,
          files: filesPayload,
          signatureDataUrl
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `HTTP Error ${res.status}`);
      }
      
      window.location.href = '/thanks-funding';

    } catch (err) {
      alert(`There was an error submitting your application. Please try again.\n\n${(err && err.message) || err}`);
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHTML;
    }
  });
  
  updateWizard();
})();