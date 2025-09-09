<?php
// contact-form.php  (reemplaza por completo el contenido de tu archivo)

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// ============== SETTINGS ==============
$TO_EMAIL   = 'subs@picklefunding.com';
$TO_NAME    = 'Pickle Funding Submissions';
$FROM_EMAIL = 'no-reply@picklefunding.com';   // usa tu dominio real
$FROM_NAME  = 'Pickle Funding Web';

// SMTP (Hostinger u otro). Si no tienes SMTP aún, llena estos datos.
// Si prefieres probar sin SMTP, pon $USE_SMTP = false;
$USE_SMTP   = true;
$SMTP_HOST  = 'smtp.tu-dominio.com';
$SMTP_USER  = 'usuario@tu-dominio.com';
$SMTP_PASS  = 'CONTRASEÑA';
$SMTP_PORT  = 587;
$SMTP_SECURE= 'tls'; // 'tls' o 'ssl'

// ============== HELPERS ==============
function val($key, $default='') {
  return isset($_POST[$key]) ? trim((string)$_POST[$key]) : $default;
}

// ============== ONLY POST ==============
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo 'Method Not Allowed';
  exit;
}

// ===== Subject con Legal Company Name =====
$company = val('legal_company_name', 'Unknown Company');
$subject = 'Web Application – ' . $company;

// ===== Cuerpo del correo (texto plano legible) =====
$fields = [
  'Legal Company Name' => val('legal_company_name'),
  'Doing Business As'  => val('dba'),
  'Company Website'    => val('website'),
  'Tax ID / EIN'       => val('ein'),
  'Business Start Date'=> val('business_start_date'),
  'State of Inc.'      => val('state_incorporation'),
  'Industry'           => val('industry'),
  'Address'            => val('business_address'),
  'City'               => val('business_city'),
  'State'              => val('business_state'),
  'Zip'                => val('business_zip'),
  'Process CC?'        => val('process_cc'),
  'Financing Amount'   => val('financing_amount'),
  'Owner Full Name'    => val('owner_fullname'),
  'Ownership %'        => val('owner_ownership'),
  'FICO'               => val('owner_fico'),
  'SSN (masked)'       => (function(){
                            $raw = val('owner_ssn');
                            if ($raw === '') return '';
                            return str_repeat('*', max(0, strlen($raw)-4)).substr($raw, -4);
                          })(),
  'DOB'                => val('owner_dob'),
  'Owner Email'        => val('owner_email'),
  'Owner Phone'        => val('owner_phone'),
  'Owner Address'      => val('owner_address'),
  'Avg Monthly Sales'  => val('avg_monthly_sales'),
  'Monthly Deposits'   => val('monthly_deposits'),
  'Current Loans'      => val('current_loans'),
];

$body  = "New Web Application\n\n";
foreach ($fields as $k => $v) {
  if ($v !== '') $body .= sprintf("%s: %s\n", $k, $v);
}

// ===== Firma (dataURL PNG) si llega =====
$sigTempPath = '';
if (!empty($_POST['signature_dataurl'])) {
  $data = $_POST['signature_dataurl'];
  if (preg_match('/^data:image\/png;base64,/', $data)) {
    $data = base64_decode(substr($data, strpos($data, ',') + 1));
    $sigTempPath = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'signature_' . uniqid() . '.png';
    file_put_contents($sigTempPath, $data);
  }
}

// ============== PHPMailer ==============
require __DIR__ . '/phpmailer/Exception.php';
require __DIR__ . '/phpmailer/PHPMailer.php';
require __DIR__ . '/phpmailer/SMTP.php';

$mail = new PHPMailer(true);

try {
  if ($USE_SMTP) {
    $mail->isSMTP();
    $mail->Host       = $SMTP_HOST;
    $mail->SMTPAuth   = true;
    $mail->Username   = $SMTP_USER;
    $mail->Password   = $SMTP_PASS;
    $mail->SMTPSecure = $SMTP_SECURE;
    $mail->Port       = $SMTP_PORT;
  }
  // Si no usas SMTP, PHPMailer usará mail() del sistema.

  $mail->setFrom($FROM_EMAIL, $FROM_NAME);
  $mail->addAddress($TO_EMAIL, $TO_NAME);

  // Reply-To del dueño para que puedan responderle directo
  $ownerEmail = val('owner_email');
  $ownerName  = val('owner_fullname');
  if (filter_var($ownerEmail, FILTER_VALIDATE_EMAIL)) {
    $mail->addReplyTo($ownerEmail, $ownerName);
  }

  $mail->Subject = $subject;
  $mail->isHTML(false);          // texto plano
  $mail->Body    = $body;
  $mail->AltBody = $body;

  // ===== Adjuntos opcionales =====
  $attachFields = ['bank_statement_1','bank_statement_2','bank_statement_3'];
  foreach ($attachFields as $f) {
    if (!empty($_FILES[$f]['tmp_name']) && is_uploaded_file($_FILES[$f]['tmp_name'])) {
      $mail->addAttachment($_FILES[$f]['tmp_name'], $_FILES[$f]['name']);
    }
  }

  // ID - múltiples
  if (!empty($_FILES['id_images']['name'])) {
    $names = $_FILES['id_images']['name'];
    $tmps  = $_FILES['id_images']['tmp_name'];
    if (is_array($names)) {
      foreach ($names as $i => $name) {
        if (!empty($tmps[$i]) && is_uploaded_file($tmps[$i])) {
          $mail->addAttachment($tmps[$i], $name);
        }
      }
    } elseif (is_uploaded_file($_FILES['id_images']['tmp_name'])) {
      // por si el input no vino como multiple en algún navegador
      $mail->addAttachment($_FILES['id_images']['tmp_name'], $_FILES['id_images']['name']);
    }
  }

  // Firma como adjunto
  if ($sigTempPath && file_exists($sigTempPath)) {
    $mail->addAttachment($sigTempPath, 'signature.png');
  }

  $mail->send();

  // Limpieza
  if ($sigTempPath && file_exists($sigTempPath)) { @unlink($sigTempPath); }

  // Página de gracias (ya la tienes en el proyecto)
  header('Location: /application-submitted.html');
  exit;

} catch (Exception $e) {
  if ($sigTempPath && file_exists($sigTempPath)) { @unlink($sigTempPath); }
  http_response_code(500);
  echo 'Mailer Error: ' . $mail->ErrorInfo;
  exit;
}