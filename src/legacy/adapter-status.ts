/** Migration inventory. Known defects in the reference remain open until their owning modules replace this adapter. */
export const LEGACY_ADAPTER_STATUS = {
  source: 'cine_shot_visualizer_3d_pro.html',
  referencePreserved: true,
  implementedHere: ['four-view navigation shell', 'basic Canvas 2D scene sketch', 'core state/action wiring'],
  pending: ['legacy control extraction', 'correct camera/gate/DoF and animated camera evaluation', 'shot snapshots and persistence', 'full fidelity rendering and interaction'],
  knownFindings: ['A01-A24 remain audit findings unless explicitly implemented by a module'],
} as const;
