import { secretDetectors } from '@/lib/engine/detectors/secrets';
import { globalPiiDetectors, trPiiDetectors } from '@/lib/engine/detectors/pii';
import type { Detector, Profile } from '@/lib/engine/types';

export const allDetectors: Detector[] = [...secretDetectors, ...trPiiDetectors, ...globalPiiDetectors];

export function detectorsForProfile(profile: Profile): Detector[] {
  return allDetectors.filter(
    (detector) => detector.profiles.length === 0 || detector.profiles.includes(profile),
  );
}
