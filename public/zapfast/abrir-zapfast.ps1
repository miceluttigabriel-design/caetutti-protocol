param([string]$Url)

# ------------------------------------------------------------------
# Abre ZapFast en el chat del numero y pega + envia el mensaje.
#
# Lo llama el navegador a traves del protocolo zapfast://
#   zapfast://595981123456?text=Hola%20amigo
#   zapfast://595981123456/?text=Hola%20amigo   (Chrome agrega la barra)
#
# El mensaje viaja en la URL. Este script lo pone en el portapapeles,
# abre el chat, espera a que ZapFast este al frente, pega con Ctrl+V y
# manda con Enter. Si el portapapeles falla, escribe el texto tecla por
# tecla (SendInput Unicode) como respaldo.
#
# Deja un registro en ultimo-intento.txt para poder diagnosticar.
# ------------------------------------------------------------------

$ErrorActionPreference = "SilentlyContinue"

$dir = Join-Path $env:LOCALAPPDATA "ZapFastAbrir"
$logPath = Join-Path $dir "ultimo-intento.txt"
Remove-Item $logPath -Force -ErrorAction SilentlyContinue

function Log([string]$msg) {
  try {
    Add-Content -Path $logPath -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') | $msg" -Encoding UTF8
  } catch {}
}

Log "inicio | conector v3"

if (-not $Url) { Log "sin URL"; exit 0 }

# --- Parsear la URL -------------------------------------------------
$u = "$Url".Trim()
if ($u -notmatch '(?i)^zapfast://') {
  Log "no es zapfast:// (recibi: $($u.Substring(0, [Math]::Min(40, $u.Length))))"
  exit 0
}
$u = $u.Substring(10)

Log "resto: $($u.Substring(0, [Math]::Min(120, $u.Length)))"

$iQ = $u.IndexOf('?')
if ($iQ -ge 0) {
  $ruta = $u.Substring(0, $iQ)
  $consulta = $u.Substring($iQ + 1)
} else {
  $ruta = $u
  $consulta = ""
}

# La barra final que agrega Chrome no molesta: sacamos todo lo que no sea numero.
$tel = ($ruta -replace '[^0-9]', '')
if (-not $tel) {
  Log "sin telefono (ruta: $ruta)"
  exit 0
}

$texto = ""
if ($consulta) {
  foreach ($par in ($consulta -split '&')) {
    $iE = $par.IndexOf('=')
    if ($iE -gt 0 -and $par.Substring(0, $iE) -eq 'text') {
      $texto = [System.Uri]::UnescapeDataString($par.Substring($iE + 1))
      break
    }
  }
}

Log "telefono=$tel | texto=$($texto.Length) caracteres"

$exe = Join-Path $env:LOCALAPPDATA "Programs\ZapFast\zapfast.exe"
if (-not (Test-Path $exe)) { Log "no encontre zapfast.exe"; exit 0 }

# --- Portapapeles con reintentos ------------------------------------
$clipOk = $false
if ($texto) {
  for ($n = 1; $n -le 10; $n++) {
    try { Set-Clipboard -Value $texto; $clipOk = $true; break } catch {}
    try {
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.Clipboard]::SetText($texto)
      $clipOk = $true
      break
    } catch {}
    Start-Sleep -Milliseconds 250
  }
}
Log "portapapeles=$clipOk"

# --- Abrir el chat ---------------------------------------------------
Start-Process -FilePath $exe -ArgumentList $tel

# Sin texto (mensaje muy largo) solo abrimos el chat y no mandamos nada.
if (-not $texto) { Log "solo abri el chat"; exit 0 }

$ws = New-Object -ComObject WScript.Shell
$activo = $false
for ($n = 0; $n -lt 30; $n++) {
  Start-Sleep -Milliseconds 400
  if ($ws.AppActivate("ZapFast")) { $activo = $true; break }
}
if (-not $activo) { Log "no pude activar la ventana"; exit 0 }

# Que termine de dibujar el chat y de tomar el foco el cuadro de texto.
Start-Sleep -Milliseconds 2500
[void]$ws.AppActivate("ZapFast")
Start-Sleep -Milliseconds 300

if ($clipOk) {
  $ws.SendKeys("^v")
  Start-Sleep -Milliseconds 1500
  $ws.SendKeys("{ENTER}")
  Log "pegado y Enter enviados"
  exit 0
}

# --- Respaldo: escribir el texto directo ----------------------------
# Se usa cuando Windows no deja tocar el portapapeles. Va tecla por tecla.
Log "respaldo: escribiendo el texto"

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class TecladoUnicode {
  [StructLayout(LayoutKind.Sequential)]
  public struct INPUT { public uint type; public InputUnion U; }

  [StructLayout(LayoutKind.Explicit)]
  public struct InputUnion {
    [FieldOffset(0)] public KEYBDINPUT ki;
    [FieldOffset(0)] public MOUSEINPUT mi;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct KEYBDINPUT {
    public ushort wVk;
    public ushort wScan;
    public uint dwFlags;
    public uint time;
    public IntPtr dwExtraInfo;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct MOUSEINPUT {
    public int dx;
    public int dy;
    public uint mouseData;
    public uint dwFlags;
    public uint time;
    public IntPtr dwExtraInfo;
  }

  [DllImport("user32.dll", SetLastError = true)]
  private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

  private static INPUT Unicode(ushort code) {
    INPUT a = new INPUT();
    a.type = 1;
    a.U.ki.wVk = 0;
    a.U.ki.wScan = code;
    a.U.ki.dwFlags = 4;
    return a;
  }

  private static INPUT Virtual(ushort vk, bool up) {
    INPUT a = new INPUT();
    a.type = 1;
    a.U.ki.wVk = vk;
    a.U.ki.wScan = 0;
    a.U.ki.dwFlags = up ? 2u : 0u;
    return a;
  }

  public static uint Char(ushort code) {
    INPUT[] a = new INPUT[] { Unicode(code) };
    return SendInput(1, a, Marshal.SizeOf(typeof(INPUT)));
  }

  public static uint Key(ushort vk, bool up) {
    INPUT[] a = new INPUT[] { Virtual(vk, up) };
    return SendInput(1, a, Marshal.SizeOf(typeof(INPUT)));
  }
}
"@

$escritos = 0
foreach ($ch in $texto.ToCharArray()) {
  $code = [int]$ch
  if ($code -eq 13) { continue }
  if ($code -ge 0xD800 -and $code -le 0xDFFF) { continue }  # emoji: no se puede escribir asi
  if ($code -eq 0xFE0F) { continue }

  if ($code -eq 10) {
    # Shift+Enter = salto de linea dentro del mensaje.
    [void][TecladoUnicode]::Key(0x10, $false)
    [void][TecladoUnicode]::Key(0x0D, $false)
    [void][TecladoUnicode]::Key(0x0D, $true)
    [void][TecladoUnicode]::Key(0x10, $true)
  } else {
    [void][TecladoUnicode]::Char([uint16]$code)
  }

  $escritos++
  if ($escritos % 40 -eq 0) { Start-Sleep -Milliseconds 15 }
}

Start-Sleep -Milliseconds 1000
[void][TecladoUnicode]::Key(0x0D, $false)
[void][TecladoUnicode]::Key(0x0D, $true)

Log "respaldo: $escritos caracteres escritos y Enter enviado"
exit 0
