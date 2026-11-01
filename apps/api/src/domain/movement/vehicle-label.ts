/** Parts of a GTFS-RT `vehicle.label` that could be recognised. Absent parts are omitted. */
export interface VehicleLabel {
  readonly lineCode?: string;
  readonly trainNumber?: string;
  readonly platform?: string;
}

// Cercanías: `C1-23578-PLATF.(4)`, `R2N-25470`. Long distance: bare `15064`.
const LINE_AND_TRAIN = /^([A-Za-z]\w*)-(\d+)(?:-PLATF\.(?:\(([^)]*)\)?)?)?$/;
const BARE_TRAIN = /^\d+$/;

/** Parses a vehicle label into Line code, Train number and platform. Never throws. */
export function parseVehicleLabel(label: unknown): VehicleLabel {
  if (typeof label !== 'string') return {};
  const text = label.trim();

  const match = LINE_AND_TRAIN.exec(text);
  if (match) {
    const [, lineCode, trainNumber, rawPlatform] = match;
    const platform = rawPlatform?.trim();
    return {
      lineCode: lineCode as string,
      trainNumber: trainNumber as string,
      ...(platform && { platform }),
    };
  }
  if (BARE_TRAIN.test(text)) return { trainNumber: text };
  return {};
}
