const { Resend } = require('resend');

exports.handler = async function(event) {
  // Solo permitir peticiones POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // --- Log para depuración: Ver qué estamos recibiendo ---
  console.log("Received body from form:", event.body);

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const payload = JSON.parse(event.body);

    const { to, subject, fields, files, signatureDataUrl } = payload;

    // --- Verificación básica de datos ---
    if (!to || !subject || !fields) {
        console.error("Validation Error: Missing 'to', 'subject', or 'fields' in payload.");
        return { statusCode: 400, body: "Bad Request: Missing required email fields." };
    }

    // Construir el cuerpo del correo en HTML
    let emailHtml = `<h1>New Funding Application</h1><h2>${fields['legal_company_name'] || ''}</h2><hr>`;
    for (const [key, value] of Object.entries(fields)) {
      if (value) {
        const fieldName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        emailHtml += `<p><strong>${fieldName}:</strong> ${value}</p>`;
      }
    }

    // Preparar los archivos adjuntos
    const attachments = [];
    if (files && files.length > 0) {
      for (const file of files) {
        attachments.push({
          filename: file.name,
          content: file.base64.split("base64,")[1],
        });
      }
    }
    if (signatureDataUrl) {
      attachments.push({
        filename: 'signature.png',
        content: signatureDataUrl.split("base64,")[1],
      });
    }

    console.log(`Attempting to send email to: ${to} with subject: ${subject}`);

    const data = await resend.emails.send({
      from: 'Onboarding <onboarding@resend.dev>', // Tu dominio verificado en Resend
      to: [to],
      subject: subject,
      html: emailHtml,
      attachments: attachments,
    });

    console.log("Email sent successfully!", data);

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };

  } catch (error) {
    // --- Log de errores detallado ---
    console.error("!!! AN ERROR OCCURRED !!!", error);
    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({ message: 'Error sending email', error: error.message }),
    };
  }
};
