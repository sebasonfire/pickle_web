export default async (req) => {
  try {
    const data = JSON.parse(req.body || "{}");
    const {
      name = "",
      email = "",
      phone = "",
      subject = "",
      message = "",
      comment = "",
    } = data;

    const msg = message || comment || "";
    const subj = `Contact — ${subject || "No subject"} (from website contact section)`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",      // remitente de prueba OK
        to: ["sebastiandelgadomultimedia@gmail.com"], // << tu correo de prueba
        subject: subj,
        text:
`New contact submission
----------------------
Name:   ${name}
Email:  ${email}
Phone:  ${phone}
Subject:${subject}
Message:
${msg}`,
        html:
`<p><strong>New contact submission</strong></p>
<ul>
  <li><strong>Name:</strong> ${name}</li>
  <li><strong>Email:</strong> ${email}</li>
  <li><strong>Phone:</strong> ${phone}</li>
  <li><strong>Subject:</strong> ${subject}</li>
</ul>
<p><strong>Message:</strong><br>${(msg || "").replace(/\n/g,"<br>")}</p>`
      }),
    });

    if (!res.ok) {
      const errTxt = await res.text();
      console.error("Resend API error:", errTxt);
      return new Response(JSON.stringify({ ok:false, error: "Email send failed" }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok:true }), { status: 200 });
  } catch (e) {
    console.error("Function error:", e);
    return new Response(JSON.stringify({ ok:false, error: "Server error" }), { status: 500 });
  }
};
