const { Resend } = require('resend');

exports.handler = async function(event) {
  console.log("--- Function send-funding-email invoked ---");

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const payload = JSON.parse(event.body);
    const { to, subject, fields, files, signatureDataUrl } = payload;

    // --- ¡¡¡ACCIÓN REQUERIDA!!! ---
    // ¡Asegúrate de que este sea tu dominio real verificado en Resend!
    const fromAddress = 'Pickle Funding <applications@picklefunding.com>'; // <-- CAMBIA ESTO

    console.log(`Preparing to send email from: ${fromAddress} to: ${to}`);

    if (!to || !subject || !fields) {
      console.error("Validation Error: Missing required fields.");
      return { statusCode: 400, body: "Bad Request: Missing required email fields." };
    }

    let emailHtml = `<h1>New Funding Application</h1><h2>${fields['legal_company_name'] || ''}</h2><hr>`;
    for (const [key, value] of Object.entries(fields)) {
      if (value) {
        const fieldName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        emailHtml += `<p><strong>${fieldName}:</strong> ${value}</p>`;
      }
    }

    const attachments = [];
    if (files && files.length > 0) {
      files.forEach(file => {
        attachments.push({ filename: file.name, content: file.base64.split("base64,")[1] });
      });
    }
    if (signatureDataUrl) {
      attachments.push({ filename: 'signature.png', content: signatureDataUrl.split("base64,")[1] });
    }
    
    console.log(`Sending email with ${attachments.length} attachments.`);

    const data = await resend.emails.send({
      from: fromAddress,
      to: ['sdgraphicsonfire@gmail.com'], // Lo dejamos con tu correo para la prueba
      subject: subject,
      html: emailHtml,
      attachments: attachments,
    });

    // ¡¡¡NUEVA VERIFICACIÓN IMPORTANTE!!!
    // Revisamos si Resend nos devolvió un error en la respuesta
    if (data.error) {
      console.error("!!! RESEND VALIDATION ERROR !!!", data.error);
      // Lanzamos un error para que caiga en el bloque catch y no dé una falsa sensación de éxito
      throw new Error(data.error.message);
    }

    console.log("--- Email sent successfully! ---", data);
    return { statusCode: 200, body: JSON.stringify(data) };

  } catch (error) {
    console.error("!!! CRITICAL ERROR !!!", error);
    // Ahora los errores de validación también llegarán aquí
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message || 'An internal server error occurred.' }),
    };
  }
};