// Lista de permisos del sistema (single source of truth)
// Usado por: frontend (sidebar), API (validación), grupos (asignación)

export const PERMISOS = [
  { key: "ver_dashboard", label: "Dashboard", grupo: "General" },
  { key: "ver_importar", label: "Importar Datos", grupo: "General" },
  { key: "ver_clientes", label: "Clientes", grupo: "Negocio" },
  { key: "ver_cuotas", label: "Cuotas", grupo: "Negocio" },
  { key: "ver_mantenimiento_cuotas", label: "Mantenimiento Cuotas", grupo: "Negocio" },
  { key: "ver_ventas", label: "Ventas por Mes", grupo: "Negocio" },
  { key: "ver_reglas", label: "Reglas de Notificación", grupo: "Notificaciones" },
  { key: "ver_proyectado", label: "Proyectado / Objetivos", grupo: "Negocio" },
  { key: "ver_notificaciones", label: "Notificaciones WhatsApp", grupo: "Notificaciones" },
  { key: "ver_comunicaciones", label: "Comunicaciones", grupo: "Notificaciones" },
  { key: "ver_recordatorios", label: "Recordatorios", grupo: "Notificaciones" },
  { key: "ver_contactos_dia", label: "Contactos del Día", grupo: "Notificaciones" },
  { key: "ver_historial", label: "Historial", grupo: "Notificaciones" },
  { key: "ver_configuracion", label: "Configuración del Sistema", grupo: "Admin" },
  { key: "ver_sucursales", label: "Ver Sucursales (filtros)", grupo: "Admin" },
  { key: "admin_usuarios", label: "Administrar Usuarios y Grupos", grupo: "Admin" },
  { key: "sync_licencias", label: "Sincronizar Licencias", grupo: "Admin" },
] as const;

export type PermisoKey = (typeof PERMISOS)[number]["key"];

export function permisosByGrupo() {
  const grupos: Record<string, typeof PERMISOS> = {};
  for (const p of PERMISOS) {
    if (!grupos[p.grupo]) grupos[p.grupo] = [];
    grupos[p.grupo].push(p);
  }
  return grupos;
}

// Variables disponibles para plantillas de mensajes
export const VARIABLES_PLANTILLA = [
  { key: "{Entidad}", desc: "Nombre del cliente" },
  { key: "{Codigo Entidad}", desc: "Código único del cliente" },
  { key: "{Ci Entidad}", desc: "Cédula de identidad" },
  { key: "{Ruc Entidad}", desc: "RUC del cliente" },
  { key: "{Localidad}", desc: "Localidad del cliente" },
  { key: "{Telefono}", desc: "Teléfono principal" },
  { key: "{Telefono_pivot}", desc: "Teléfono alternativo" },
  { key: "{Fecha Vcto}", desc: "Fecha de vencimiento" },
  { key: "{Fecha Emision}", desc: "Fecha de emisión" },
  { key: "{Saldo en Gs}", desc: "Saldo en Guaraníes" },
  { key: "{Saldo Guarani}", desc: "Saldo Guaraní" },
  { key: "{Saldo Dolar}", desc: "Saldo en Dólares" },
  { key: "{Venc Mes}", desc: "Monto del mes de vencimiento" },
  { key: "{Dias Atrasado}", desc: "Días de atraso (con signo)" },
  { key: "{dias_texto}", desc: 'Frase amigable: "vencerá en X días"' },
  { key: "{dias_estado}", desc: 'Estado: "por vencer", "vence hoy", "vencida"' },
  { key: "{dias_absolutos}", desc: "Número sin signo: 3" },
  { key: "{Vendedor}", desc: "Vendedor asignado" },
  { key: "{Sucursal}", desc: "Sucursal" },
  { key: "{Moneda}", desc: "Moneda" },
] as const;

export const VARIABLES_AGRUPADAS = [
  { key: "{Entidad}", desc: "Nombre del cliente (cabecera/pie)" },
  { key: "{Total Gs}", desc: "Suma total de saldos (cabecera/pie)" },
  { key: "{Cantidad Cuotas}", desc: "Número de cuotas (cabecera/pie)" },
  { key: "{Fecha Vcto}", desc: "Vencimiento de la cuota (detalle)" },
  { key: "{Fecha Emision}", desc: "Emisión de la cuota (detalle)" },
  { key: "{Saldo en Gs}", desc: "Saldo de la cuota (detalle)" },
  { key: "{Dias Atrasado}", desc: "Días de atraso (con signo)" },
  { key: "{dias_texto}", desc: 'Frase amigable: "vencerá en X días"' },
  { key: "{dias_estado}", desc: 'Estado: "por vencer", "vence hoy", "vencida"' },
  { key: "{dias_absolutos}", desc: "Número sin signo" },
  { key: "{Vendedor}", desc: "Vendedor (detalle)" },
  { key: "{Sucursal}", desc: "Sucursal (detalle)" },
  { key: "{Moneda}", desc: "Moneda (detalle)" },
] as const;
