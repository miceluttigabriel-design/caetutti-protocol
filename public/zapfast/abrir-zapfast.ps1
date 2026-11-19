param([string]$Url)

# ------------------------------------------------------------------
# Abre ZapFast en el chat del numero y pega + envia el mensaje.
#
# Lo llama el navegador a traves del protocolo zapfast://
#   zapfast://595981123456?text=Hola%20amigo
#
# El mensaje viaja en la URL (no depende del portapapeles del navegador):
# este script lo pone en el portapapeles de Windows, abre el chat, espera
# a que ZapFast este al frente, pega con Ctrl+V y manda con Enter.
# Si no puede copiar al portapapeles, abre el chat y NO envia nada.
# ------------------------------------------------------------------

$ErrorActionPreference = "SilentlyContinue"

$m = [regex]::Match($Url, '^zapfast://([0-9]+)(?:\?text=(.*))?$')
if (-not $m.Success) { exit 0 }

$tel = $m.Groups[1].Value
if (-not $tel) { exit 0 }

$texto = ""
if ($m.Groups[2].Success -and $m.Groups[2].Value) {
  $texto = [System.Uri]::UnescapeDataString($m.Groups[2].Value)
}

$exe = Join-Path $env:LOCALAPPDATA "Programs\ZapFast\zapfast.exe"
if (-not (Test-Path $exe)) { exit 0 }

$clipOk = $false
if ($texto) {
  try {
    Set-Clipboard -Value $texto
    $clipOk = $true
  } catch {
    try {
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.Clipboard]::SetText($texto)
      $clipOk = $true
    } catch {
      $clipOk = $false
    }
  }
}

Start-Process -FilePath $exe -ArgumentList $tel

# Si no vino texto (mensaje muy largo) o no se pudo copiar, solo abrimos el
# chat: no mandamos nada para no enviar algo que no corresponde.
if (-not $texto -or -not $clipOk) { exit 0 }

$ws = New-Object -ComObject WScript.Shell
$activo = $false
for ($i = 0; $i -lt 25; $i++) {
  Start-Sleep -Milliseconds 400
  if ($ws.AppActivate("ZapFast")) { $activo = $true; break }
}

if (-not $activo) { exit 0 }

# Que termine de dibujar el chat y de tomar el foco el cuadro de texto.
Start-Sleep -Milliseconds 2000

$ws.SendKeys("^v")
Start-Sleep -Milliseconds 1200
$ws.SendKeys("{ENTER}")

exit 0
