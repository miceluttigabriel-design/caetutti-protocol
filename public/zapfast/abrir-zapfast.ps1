param([string]$Url)

# ------------------------------------------------------------------
# Abre ZapFast en el chat del numero, pega el mensaje y lo envia.
#
# Lo llama el navegador a traves del protocolo zapfast://
#   zapfast://595981123456?text=Hola%20amigo
#   zapfast://595981123456/?text=Hola%20amigo   (Chrome agrega la barra)
#
# A ZapFast se le pasa un link https://wa.me/<numero>: con el numero
# pelado la app a veces no abre el chat cuando ya esta corriendo.
#
# ZapFast a veces queda colgado en "Loading older messages from your phone".
# Este conector espera solo 4 s y, si no cargo, lo reinicia (arranca en ~1 s).
# Despues clickea el cuadro de mensaje usando el rect que da Accessibilidad:
# asi no importa el DPI ni la barra de tareas.
#
# Si algo falla, deja el chat abierto y el mensaje copiado, y NO envia
# nada. Deja un registro en ultimo-intento.txt.
# ------------------------------------------------------------------

$ErrorActionPreference = "SilentlyContinue"

# La pantalla de esta PC esta al 125%. Sin esto, Windows escala las
# coordenadas del plan de respaldo.
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class DpiZap {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
# No llamamos a SetProcessDPIAware: las coordenadas de Accessibilidad y
# del mouse se combinan mejor sin esa correccion (125% de escala).

$dir = Join-Path $env:LOCALAPPDATA "ZapFastAbrir"
$logPath = Join-Path $dir "ultimo-intento.txt"
Remove-Item $logPath -Force -ErrorAction SilentlyContinue

function Log([string]$msg) {
  try {
    Add-Content -Path $logPath -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') | $msg" -Encoding UTF8
  } catch {}
}

$t0 = Get-Date
Log "inicio | conector v7"

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

# --- Ventana ---------------------------------------------------------
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class VentanaZap {
  public delegate bool EnumProc(IntPtr h, IntPtr l);

  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool f);
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
  [DllImport("user32.dll")] public static extern void SwitchToThisWindow(IntPtr h, bool altTab);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, UIntPtr e);
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT p);
  [DllImport("user32.dll")] public static extern bool IsHungAppWindow(IntPtr h);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [StructLayout(LayoutKind.Sequential)]
  public struct POINT { public int X; public int Y; }

  public static IntPtr Buscar(uint pid) {
    IntPtr mejor = IntPtr.Zero;
    long area = 0;
    EnumWindows(delegate(IntPtr h, IntPtr l) {
      uint p;
      GetWindowThreadProcessId(h, out p);
      if (p == pid) {
        RECT r;
        GetWindowRect(h, out r);
        long a = (long)(r.Right - r.Left) * (long)(r.Bottom - r.Top);
        if (a > area) { area = a; mejor = h; }
      }
      return true;
    }, IntPtr.Zero);
    return mejor;
  }

  public static IntPtr Activar(IntPtr h) {
    if (h == IntPtr.Zero) return IntPtr.Zero;

    ShowWindow(h, 3);   // SW_MAXIMIZE: siempre entra en la pantalla
    BringWindowToTop(h);
    SetForegroundWindow(h);

    if (GetForegroundWindow() != h) {
      // Truco clasico: un ALT destraba el permiso de foco de Windows.
      keybd_event(0x12, 0, 0, UIntPtr.Zero);
      keybd_event(0x12, 0, 2, UIntPtr.Zero);
      SetForegroundWindow(h);
    }

    if (GetForegroundWindow() != h) {
      uint fgPid;
      uint fg = GetWindowThreadProcessId(GetForegroundWindow(), out fgPid);
      uint yo = GetCurrentThreadId();
      AttachThreadInput(yo, fg, true);
      SetForegroundWindow(h);
      BringWindowToTop(h);
      AttachThreadInput(yo, fg, false);
    }

    if (GetForegroundWindow() != h) {
      SwitchToThisWindow(h, true);
    }

    return h;
  }

  // Con Accessibilidad no hace falta maximizar: hacerlo cambia el diseno
  // justo cuando queremos enfocar el cuadro y el foco cae en un panel.
  public static IntPtr ActivarUIA(IntPtr h) {
    if (h == IntPtr.Zero) return IntPtr.Zero;
    BringWindowToTop(h);
    SetForegroundWindow(h);
    if (GetForegroundWindow() != h) {
      keybd_event(0x12, 0, 0, UIntPtr.Zero);
      keybd_event(0x12, 0, 2, UIntPtr.Zero);
      SetForegroundWindow(h);
    }
    if (GetForegroundWindow() != h) {
      uint fgPid;
      uint fg = GetWindowThreadProcessId(GetForegroundWindow(), out fgPid);
      uint yo = GetCurrentThreadId();
      AttachThreadInput(yo, fg, true);
      SetForegroundWindow(h);
      BringWindowToTop(h);
      AttachThreadInput(yo, fg, false);
    }
    if (GetForegroundWindow() != h) {
      SwitchToThisWindow(h, true);
    }
    return h;
  }

  public static bool AlFrente(IntPtr h) {
    return GetForegroundWindow() == h;
  }

  public static bool PuntoEsDe(int x, int y, uint pid) {
    POINT p = new POINT();
    p.X = x; p.Y = y;
    uint dueno;
    GetWindowThreadProcessId(WindowFromPoint(p), out dueno);
    return dueno == pid;
  }

  public static void Click(int x, int y) {
    SetCursorPos(x, y);
    System.Threading.Thread.Sleep(120);
    mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero);
    System.Threading.Thread.Sleep(60);
    mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);
  }
}
"@

# --- Accessibilidad: esperar a que ZapFast cargue de verdad ---------
$uiA = $true
try {
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
} catch {
  $uiA = $false
  Log "sin UIAutomation: uso el plan de respaldo"
}

function Obtener-VentanaCargada([uint32]$pidz) {
  try {
    $condPid = New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::ProcessIdProperty, [int]$pidz)
    $condEdit = New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
      [System.Windows.Automation.ControlType]::Edit)
    $tops = [System.Windows.Automation.AutomationElement]::RootElement.FindAll(
      [System.Windows.Automation.TreeScope]::Children, $condPid)

    $mejor = $null
    $mejorAncho = 0
    foreach ($top in $tops) {
      try {
        $h = [IntPtr][int]$top.Current.NativeWindowHandle
        if ($h -eq [IntPtr]::Zero) { continue }
        if ([VentanaZap]::IsHungAppWindow($h)) { continue }
        $edits = $top.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condEdit)
        foreach ($e in $edits) {
          # El buscador mide ~260 px; el cuadro de mensaje, >1000 px.
          $ancho = $e.Current.BoundingRectangle.Width
          if ($ancho -gt 400 -and $ancho -gt $mejorAncho) {
            $mejorAncho = $ancho
            $mejor = [pscustomobject]@{
              Handle = $h
              Composer = $e
              Nombre = $e.Current.Name
            }
          }
        }
      } catch {}
    }
    return $mejor
  } catch {
    return $null
  }
}

function FocoEstaEnMensaje($ventana) {
  try {
    $f = [System.Windows.Automation.AutomationElement]::FocusedElement
    if (-not $f) { return $false }
    if ($f.Current.ControlType -ne [System.Windows.Automation.ControlType]::Edit) { return $false }
    if ($f.Current.Name -ne $ventana.Nombre) { return $false }
    return $true
  } catch {
    return $false
  }
}

function Clic-EnMensaje($ventana) {
  try {
    $r = $ventana.Composer.Current.BoundingRectangle
    if ($r.Width -lt 100 -or $r.Height -lt 5) { return $false }
    $x = [int]($r.X + $r.Width / 2)
    $y = [int]($r.Y + $r.Height / 2)
    # Otros programas pueden robar el foco mientras cargaba: lo volvemos
    # a poner al frente justo antes de clickear.
    for ($k = 0; $k -lt 6; $k++) {
      [void][VentanaZap]::ActivarUIA($ventana.Handle)
      Start-Sleep -Milliseconds 250
      if ([VentanaZap]::AlFrente($ventana.Handle)) { break }
    }
    if (-not [VentanaZap]::AlFrente($ventana.Handle)) {
      Log "ZapFast no quedo al frente antes del clic"
      return $false
    }
    # Usamos el rect que da Accessibilidad: cae justo en el cuadro,
    # sin depender del tamano de la ventana ni de la barra de tareas.
    [VentanaZap]::Click($x, $y)
    Start-Sleep -Milliseconds 450
    Log "clic en el cuadro ($x,$y)"
    $ok = FocoEstaEnMensaje $ventana
    if (-not $ok) {
      try {
        $f = [System.Windows.Automation.AutomationElement]::FocusedElement
        Log "foco tras clic: '$($f.Current.Name)' ($($f.Current.ControlType.ProgrammaticName))"
      } catch {}
    }
    return $ok
  } catch {
    return $false
  }
}

function Enfocar-Mensaje($ventana) {
  try {
    $ventana.Composer.SetFocus()
    Start-Sleep -Milliseconds 350
    $ok = FocoEstaEnMensaje $ventana
    if (-not $ok) {
      try {
        $f = [System.Windows.Automation.AutomationElement]::FocusedElement
        Log "foco no esperado: '$($f.Current.Name)' ($($f.Current.ControlType.ProgrammaticName))"
      } catch {}
    }
    return $ok
  } catch {
    Log "SetFocus fallo: $($_.Exception.Message)"
    return $false
  }
}

# --- Abrir el chat ---------------------------------------------------
Start-Process -FilePath $exe -ArgumentList "https://wa.me/$tel"

# Sin texto (mensaje muy largo) solo abrimos el chat y no mandamos nada.
if (-not $texto) { Log "solo abri el chat"; exit 0 }

$ws = New-Object -ComObject WScript.Shell
$zproc = $null
$zpid = 0
$h = [IntPtr]::Zero
$ventana = $null
$reiniciado = $false

if ($uiA) {
  # ZapFast puede quedar colgado en "Loading older messages from your phone".
  # Esperamos solo 4 s: si no carga, lo reiniciamos (arranca en ~1 s).
  $ventana = $null
  for ($n = 0; $n -lt 8; $n++) {
    $zproc = Get-Process zapfast -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($zproc) {
      $zpid = [uint32]$zproc.Id
      $ventana = Obtener-VentanaCargada $zpid
      if ($ventana) {
        $h = [VentanaZap]::ActivarUIA($ventana.Handle)
        if ($h -ne [IntPtr]::Zero -and [VentanaZap]::AlFrente($h)) { break }
      }
    }
    Start-Sleep -Milliseconds 500
  }

  if (-not $ventana) {
    Log "ZapFast estaba cargando: lo reinicio"
    $reiniciado = $true
    Start-Process -FilePath $exe -ArgumentList "quit" -WindowStyle Hidden
    Start-Sleep -Seconds 2
    Stop-Process -Name zapfast -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Start-Process -FilePath $exe -ArgumentList "https://wa.me/$tel"

    for ($n = 0; $n -lt 16; $n++) {
      $zproc = Get-Process zapfast -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($zproc) {
        $zpid = [uint32]$zproc.Id
        $ventana = Obtener-VentanaCargada $zpid
        if ($ventana) {
          $h = [VentanaZap]::ActivarUIA($ventana.Handle)
          if ($h -ne [IntPtr]::Zero -and [VentanaZap]::AlFrente($h)) { break }
        }
      }
      Start-Sleep -Milliseconds 500
    }
  }

  if ($reiniciado) {
    Log "espero 2s a que ZapFast se estabilice"
    Start-Sleep -Seconds 2
  }

  if (-not $ventana) {
    Log "ZapFast no cargo: el mensaje queda en el portapapeles"
    exit 0
  }
  if (-not [VentanaZap]::AlFrente($h)) {
    Log "no pude poner al frente la ventana cargada"
    exit 0
  }
  Log "ZapFast listo en $([int]((Get-Date) - $t0).TotalSeconds)s: cuadro '$($ventana.Nombre)'"

  $focoOk = $false
  for ($i = 0; $i -lt 6; $i++) {
    $focoOk = Clic-EnMensaje $ventana
    if ($focoOk) { break }
    # Al reiniciar, ZapFast puede cambiar de ventana: buscamos el cuadro otra vez.
    if ($zpid) {
      $nueva = Obtener-VentanaCargada ([uint32]$zpid)
      if ($nueva) {
        $ventana = $nueva
        $h = [VentanaZap]::ActivarUIA($ventana.Handle)
      }
    }
    Start-Sleep -Milliseconds 400
  }
  if (-not $focoOk) {
    Log "no pude enfocar el cuadro: no envio, mensaje queda copiado"
    exit 0
  }
  Log "cuadro de mensaje enfocado (clic sobre Accessibilidad)"

  if ($clipOk) {
    $ws.SendKeys("^a")
    Start-Sleep -Milliseconds 150
    $ws.SendKeys("^v")
    Start-Sleep -Milliseconds 1300
    if (-not [VentanaZap]::AlFrente($h) -or -not (FocoEstaEnMensaje $ventana)) {
      Log "perdi el foco despues de pegar: no envio, revisa el chat"
      exit 0
    }
    $ws.SendKeys("{ENTER}")
    Log "pegado y Enter enviados"
    exit 0
  }

  # Sin portapapeles: escribimos tecla por tecla sobre el cuadro enfocado.
  Log "respaldo: escribiendo el texto"
} else {
  # --- Plan de respaldo sin Accessibilidad: clic verificado ----------
  for ($n = 0; $n -lt 60; $n++) {
    $zproc = Get-Process zapfast -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($zproc) {
      $zpid = [uint32]$zproc.Id
      $h = [VentanaZap]::Activar([VentanaZap]::Buscar($zpid))
      if ($h -ne [IntPtr]::Zero -and [VentanaZap]::AlFrente($h)) { break }
    }
    Start-Sleep -Milliseconds 500
  }
  if (-not $zproc -or $h -eq [IntPtr]::Zero -or -not [VentanaZap]::AlFrente($h)) {
    Log "no pude poner ZapFast al frente"
    exit 0
  }
  Start-Sleep -Seconds 8
  [void][VentanaZap]::Activar($h)

  $r = New-Object 'VentanaZap+RECT'
  [void][VentanaZap]::GetWindowRect($h, [ref]$r)
  $w = $r.Right - $r.Left
  $area = [System.Windows.Forms.Screen]::FromHandle($h).WorkingArea
  $cy = [Math]::Min($r.Bottom - 31, $area.Bottom - 60)
  $cx = $r.Left + [int]($w * 0.65)
  if (-not [VentanaZap]::PuntoEsDe($cx, $cy, $zpid)) {
    Log "el punto ($cx,$cy) no es de ZapFast: no hago clic"
    exit 0
  }
  [VentanaZap]::Click($cx, $cy)
  Log "clique verificado en el cuadro ($cx,$cy)"
  Start-Sleep -Milliseconds 400

  if (-not [VentanaZap]::AlFrente($h)) { Log "perdi el foco despues del clic"; exit 0 }
  if ($clipOk) {
    $ws.SendKeys("^v")
    Start-Sleep -Milliseconds 1300
    if (-not [VentanaZap]::AlFrente($h)) { Log "perdi el foco despues de pegar: no envio"; exit 0 }
    $ws.SendKeys("{ENTER}")
    Log "pegado y Enter enviados"
    exit 0
  }
}

# --- Respaldo: escribir el texto directo ----------------------------
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
$focoFinal = if ($uiA -and $ventana) { FocoEstaEnMensaje $ventana } else { [VentanaZap]::AlFrente($h) }
if ($focoFinal) {
  [void][TecladoUnicode]::Key(0x0D, $false)
  [void][TecladoUnicode]::Key(0x0D, $true)
  Log "respaldo: $escritos caracteres escritos y Enter enviado"
} else {
  Log "respaldo: $escritos caracteres escritos pero perdi el foco: no envie"
}
exit 0
