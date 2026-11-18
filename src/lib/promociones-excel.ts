import * as XLSX from "xlsx";
import { normalizarTelefonoPY } from "@/lib/meta";
import { ALIAS_COLUMNAS, buscarValor } from "@/lib/promociones";

export interface FilaPromo {
  nombre: string;
  telefono: string;
  telefonoNormalizado: string | null;
  modelo: string | null;
  localidad: string | null;
  ci: string | null;
  notas: string | null;
}

export interface ResultadoParseo {
  filas: FilaPromo[];
  totalFilas: number;
  sinNombre: number;
  sinTelefono: number;
  columnas: string[];
}

/**
 * Lee la primera hoja del Excel/CSV y devuelve los contactos.
 * Detecta las columnas por nombre (con alias) así no hace falta que el
 * archivo venga en un orden exacto.
 */
export function parsearExcelPromociones(buffer: ArrayBuffer): ResultadoParseo {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true, dense: true });
  const nombreHoja = wb.SheetNames[0];
  if (!nombreHoja) {
    return { filas: [], totalFilas: 0, sinNombre: 0, sinTelefono: 0, columnas: [] };
  }

  const hoja = wb.Sheets[nombreHoja];
  const crudas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, {
    defval: "",
    raw: false,
  });

  const columnas = crudas.length > 0 ? Object.keys(crudas[0]) : [];
  const filas: FilaPromo[] = [];
  let sinNombre = 0;
  let sinTelefono = 0;

  for (const fila of crudas) {
    const nombre = buscarValor(fila, [...ALIAS_COLUMNAS.nombre]) || "";
    const telefono = buscarValor(fila, [...ALIAS_COLUMNAS.telefono]) || "";

    // Fila vacía (Excel suele traer filas en blanco al final): se ignora.
    if (!nombre && !telefono) continue;

    if (!nombre) { sinNombre++; continue; }
    if (!telefono) { sinTelefono++; continue; }

    filas.push({
      nombre,
      telefono,
      telefonoNormalizado: normalizarTelefonoPY(telefono),
      modelo: buscarValor(fila, [...ALIAS_COLUMNAS.modelo]),
      localidad: buscarValor(fila, [...ALIAS_COLUMNAS.localidad]),
      ci: buscarValor(fila, [...ALIAS_COLUMNAS.ci]),
      notas: buscarValor(fila, [...ALIAS_COLUMNAS.notas]),
    });
  }

  return {
    filas,
    totalFilas: crudas.length,
    sinNombre,
    sinTelefono,
    columnas,
  };
}
