<?php
// contact-form.php

// ===== CONFIG =====
$TO_EMAIL   = "sdgraphicsonfire@gmail.com";   // destino
$TO_NAME    = "Pickle Funding";
$FROM_EMAIL = "no-reply@tudominio.com";       // remitente válido de TU dominio
$FROM_NAME  = "Pickle Funding Forms";

$USE_SMTP   = true; // true = SMTP; false = mail() del servidor

// --- SMTP de tu hosting (recomendado) ---
// Pide a tu proveedor estos datos y rellénalos:
$SMTP_HOST = "smtp.tudominio.com";
$SMTP_USER = "usuario@tudominio.com";
$SMTP_PASS = "TU_PASSWORD_SMTP";
$SMTP_PORT = 587;        // 587 TLS / 465 SSL
$SMTP_SECURE = "tls";    // "tls" o "ssl"

/* ---- OPCIÓN SMTP con Gmail (si no tienes SMTP del hosting) ----
   - Activa 2FA en Gmail
   - Crea un "App Password" y úsalo como $SMTP_PASS
$SMTP_HOST = "smtp.gmail.com";
$SMTP_USER = "tu_gmail@gmail.com";
$SMTP_PASS = "APP_PASSWORD_16_DIGITOS";
$SMTP_PORT = 587;
$SMTP_SECURE = "tls";
$FROM_EMAIL = $SMTP_USER;
*/

// ===== Seguridad =====
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');

// Solo POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405); echo "Method Not Allowed"; exit;
}

// Helper
function val($k){ return trim($_POST[$k] ?? ''); }

// Requeridos
$required = [
  'legal_company_name','ein','business_start_date','state_incorporation',
  'industry','business_address','business_city','business_state','business_zip',
  'process_cc','financing_amount','owner_fullname','owner_ownership',
  'owner_ssn','owner_dob','owner_email','owner_phone','owner_address',
  'avg_monthly_sales','monthly_deposits','agree_terms'
];
$errors=[]; foreach($required as $r){ if(val($r)==='') $errors[]=$r; }
if ($errors) { http_response_code(400); echo "Missing: ".implode(', ',$errors); exit; }

// Subidas
$uploadDir = __DIR__ . '/uploads';
if (!is_dir($uploadDir)) { mkdir($uploadDir,0755,true); }

function saveUpload($field, $prefix){
  global $uploadDir;
  if (!isset($_FILES[$field]) || $_FILES[$field]['error']!==UPLOAD_ERR_OK) return null;
  $f=$_FILES[$field]; $ext=strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
  if(!in_array($ext,['pdf','jpg','jpeg','png'])) return null;
  if($f['size']>15*1024*1024) return null;
  $name=$prefix.'_'.time().'_'.bin2hex(random_bytes(4)).'.'.$ext;
  $dest=$uploadDir.'/'.$name;
  return move_uploaded_file($f['tmp_name'],$dest) ? $dest : null;
}
$bs1=saveUpload('bank_statement_1','bank1');
$bs2=saveUpload('bank_statement_2','bank2');
$bs3=saveUpload('bank_statement_3','bank3');

// ID múltiple
$ids=[];
if (!empty($_FILES['id_images']['name'])) {
  if (is_array($_FILES['id_images']['name'])) {
    $n=count($_FILES['id_images']['name']);
    for($i=0;$i<$n;$i++){
      if($_FILES['id_images']['error'][$i]===UPLOAD_ERR_OK){
        $tmp=['name'=>$_FILES['id_images']['name'][$i],'tmp_name'=>$_FILES['id_images']['tmp_name'][$i],'size'=>$_FILES['id_images']['size'][$i]];
        $ext=strtolower(pathinfo($tmp['name'], PATHINFO_EXTENSION));
        if(!in_array($ext,['pdf','jpg','jpeg','png']) || $tmp['size']>15*1024*1024) continue;
        $dest=$uploadDir.'/id_'.time().'_'.bin2hex(random_bytes(3)).'.'.$ext;
        if(move_uploaded_file($tmp['tmp_name'],$dest)) $ids[]=$dest;
      }
    }
  } else {
    $one=saveUpload('id_images','id'); if($one) $ids[]=$one;
  }
}

// Firma base64 → PNG
$sigPath=null;
if (!empty($_POST['signature_dataurl'])) {
  $data=$_POST['signature_dataurl'];
  if (preg_match('/^data:image\/png;base64,/', $data)) {
    $data=base64_decode(substr($data, strpos($data, ',')+1));
    if($data!==false){
      $sigPath=$uploadDir.'/signature_'.time().'_'.bin2hex(random_bytes(4)).'.png';
      file_put_contents($sigPath,$data);
    }
  }
}

// Cuerpo
$fields = [
  'Legal Company Name' => val('legal_company_name'),
  'Doing Business As'  => val('dba'),
  'Website'            => val('website'),
  'EIN'                => val('ein'),
  'Business Start Date'=> val('business_start_date'),
  'State of Incorporation' => val('state_incorporation'),
  'Industry'           => val('industry'),
  'Address'            => val('business_address'),
  'City'               => val('business_city'),
  'State'              => val('business_state'),
  'Zip'                => val('business_zip'),
  'Process CC'         => val('process_cc'),
  'Financing Amount'   => val('financing_amount'),
  'Owner Full Name'    => val('owner_fullname'),
  'Ownership %'        => val('owner_ownership'),
  'FICO'               => val('owner_fico'),
  'SSN'                => val('owner_ssn'),
  'DOB'                => val('owner_dob'),
  'Owner Email'        => val('owner_email'),
  'Owner Phone'        => val('owner_phone'),
  'Owner Address'      => val('owner_address'),
  'Avg Monthly Sales'  => val('avg_monthly_sales'),
  'Monthly Deposits'   => val('monthly_deposits'),
  'Current Loans'      => val('current_loans'),
];
$body="New Merchant Application\n\n";
foreach($fields as $k=>$v){ $body.=sprintf("%s: %s\n",$k,$v); }

// PHPMailer
require __DIR__.'/email-template/phpmailer/PHPMailerAutoload.php'; // ajusta si tu path es distinto
$mail=new PHPMailer(true);
try{
  if($USE_SMTP){
    $mail->isSMTP();
    $mail->Host=$SMTP_HOST;
    $mail->SMTPAuth=true;
    $mail->Username=$SMTP_USER;
    $mail->Password=$SMTP_PASS;
    $mail->SMTPSecure=$SMTP_SECURE;
    $mail->Port=$SMTP_PORT;
  }
  $mail->setFrom($FROM_EMAIL,$FROM_NAME);
  $mail->addAddress($TO_EMAIL,$TO_NAME);
  $mail->Subject='New Funding Application - '.val('legal_company_name');
  $mail->Body=$body;

  foreach([$bs1,$bs2,$bs3] as $p){ if($p) $mail->addAttachment($p); }
  foreach($ids as $p){ $mail->addAttachment($p); }
  if($sigPath) $mail->addAttachment($sigPath);

  $mail->send();
  header('Location: /application-submitted.html'); //Listo
  exit;

}catch(Exception $e){
  http_response_code(500);
  echo "Mailer Error: ".$mail->ErrorInfo;
}
