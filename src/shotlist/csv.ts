import type { CameraDocument, ProjectDocument, ProjectShot } from '../contracts';
import { isIndependentSnapshot } from '../project/schema';

/** Literal domain text is never rewritten; formula neutralization applies only to CSV representation. */
export function literalText(value: unknown): string { return value == null ? '' : String(value); }
export function csvCell(value: unknown): string {
  let rendered = literalText(value);
  if (/^[\t\r\n ]*[=+\-@]/.test(rendered)) rendered = `'${rendered}`;
  return `"${rendered.replaceAll('"', '""')}"`;
}

export function exportShotCsv(project: ProjectDocument): Blob {
  const rows: unknown[][] = [[
    'shot_id', 'name', 'notes', 'captured_at_s', 'focal_length_mm', 'focus_distance_m', 'f_number',
    'actor_count', 'location_id', 'nd_stops', 'grain_percent', 'shutter_angle_deg', 'frame_rate_fps',
  ]];
  for (const shot of project.shots) {
    rows.push(rowForShot(project, shot));
  }
  return new Blob([`\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' });
}

/** Owns one temporary download URL and revokes the previous URL on the next export. */
export function createObjectUrlLease(api: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'> = URL): { replace(blob: Blob): string; dispose(): void } {
  let current: string | null = null;
  return {
    replace(blob) {
      if (current) api.revokeObjectURL(current);
      current = api.createObjectURL(blob);
      return current;
    },
    dispose() { if (current) api.revokeObjectURL(current); current = null; },
  };
}

function rowForShot(project: ProjectDocument, shot: ProjectShot): unknown[] {
  const camera = shot.camera;
  const snapshot = isIndependentSnapshot(shot) ? shot : null;
  const focus = camera.focus.kind === 'manual' ? camera.focus.distanceM : findActorDistance(snapshot ?? project, camera, camera.focus.actorId);
  const look = snapshot?.look ?? project.look;
  const location = snapshot?.scene.locationId ?? project.scene.locationId;
  return [shot.id, shot.name, shot.notes, shot.capturedAtS, camera.focalLengthMm, focus,
    camera.fNumber, shot.actorIds.length, location, look.ndStops, look.grainPercent, look.shutterAngleDeg, look.frameRate];
}
function findActorDistance(project: Pick<ProjectDocument, 'scene'>, camera: CameraDocument, actorId: string): number | string {
  const actor = project.scene.actors.find(a => a.id === actorId);
  return actor ? Math.hypot(actor.positionM.x - camera.positionM.x, actor.positionM.y - camera.positionM.y, actor.positionM.z - camera.positionM.z) : '';
}

/** RFC 4180-style parser; accepts CRLF/LF, escaped quotes, quoted commas and quoted newlines. */
export function parseCsv(source: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false; let afterQuote = false;
  const input = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; afterQuote = true; }
      else cell += c;
    } else if (c === '"') {
      if (cell.length || afterQuote) throw new Error(`Comilla inesperada en posición ${i}.`);
      quoted = true;
    } else if (c === ',') { row.push(cell); cell = ''; afterQuote = false; }
    else if (c === '\r' || c === '\n') {
      if (c === '\r' && input[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = ''; afterQuote = false;
    } else if (afterQuote) throw new Error(`Contenido inesperado tras comilla en posición ${i}.`);
    else cell += c;
  }
  if (quoted) throw new Error('CSV truncado: campo entrecomillado sin cierre.');
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
