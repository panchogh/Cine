import type { FrameGate, FrameModel, ProjectDocument, ViewId } from '../contracts';
import { deriveEffectiveGate, fieldOfView } from '../core/geometry';
import { depthOfField as calculateDepthOfField, resolveFocus } from '../core/optics';
import { evaluateCamera } from '../core/camera';
import type { MotionParameters } from '../core/camera';

/** Build the single frame snapshot shared by view rendering and camera capture. */
export function deriveFrame(project: ProjectDocument, timeSeconds: number, activeView: ViewId): FrameModel {
  const motion = project.camera.motion;
  let parameters: MotionParameters = {};
  if (motion.kind === 'push_in') parameters = { pushInDistanceM: motion.pushInDistanceM };
  if (motion.kind === 'orbit') parameters = { orbitTargetM: motion.orbitTargetM, orbitDegrees: motion.orbitDegrees };
  if (motion.kind === 'handheld') parameters = { handheld: motion.handheld };

  const evaluation = evaluateCamera(project, timeSeconds, parameters);
  const camera = evaluation.camera;
  const gate: FrameGate = deriveEffectiveGate({
    sensorGateMm: project.camera.sensorGateMm,
    outputAspect: project.camera.outputAspect,
    squeeze: project.camera.squeeze,
  });
  const focus = resolveFocus(project, camera);
  const warnings = [evaluation.warning, focus.warning].filter((warning): warning is string => !!warning);
  let depthOfField: FrameModel['metrics']['depthOfField'] = null;
  if (focus.axialDistanceM > 0) {
    try {
      depthOfField = calculateDepthOfField({
        focalLengthMm: project.camera.focalLengthMm,
        fNumber: project.camera.fNumber,
        circleOfConfusionMm: project.camera.circleOfConfusionMm,
        focusDistanceM: focus.axialDistanceM,
      });
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : 'No se pudieron calcular los límites de foco.');
    }
  }
  const frame: FrameModel = {
    camera,
    gate,
    squeeze: project.camera.squeeze,
    actors: project.scene.actors.map(({ id, name, positionM, heightM, yawDeg, pose, color }) => ({ id, name, positionM, heightM, yawDeg, pose, color })),
    locationId: project.scene.locationId,
    activeView,
    timeSeconds,
    metrics: {
      fieldOfView: fieldOfView(gate, project.camera.focalLengthMm, project.camera.squeeze),
      depthOfField,
      focus,
    },
    warnings,
    look: { ndStops: project.look.ndStops, grainPercent: project.look.grainPercent, shutterAngleDeg: project.look.shutterAngleDeg, frameRate: project.look.frameRate },
  };
  return frame;
}
