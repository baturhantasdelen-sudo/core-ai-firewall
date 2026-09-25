use crate::deepfake_check::{analyze_media_frame, DeepfakeAnalysisResult};
use crate::pii_scrubber::scrub_pii_stream;

/// On-device PII scrubbing for outbound AI prompts and proxy payloads.
#[flutter_rust_bridge::frb(sync)]
pub fn scrub_pii(input: String) -> String {
    scrub_pii_stream(&input)
}

#[flutter_rust_bridge::frb(sync)]
pub fn scrub_pii_stream_api(input: String) -> String {
    scrub_pii_stream(&input)
}

/// Returns synthetic/deepfake likelihood in `[0.0, 1.0]` (higher = more suspicious).
#[flutter_rust_bridge::frb(sync)]
pub fn verify_c2pa_signature(image_bytes: Vec<u8>) -> f32 {
    analyze_media_frame(image_bytes).confidence_score
}

#[flutter_rust_bridge::frb(sync)]
pub fn analyze_media_frame_api(frame_bytes: Vec<u8>) -> DeepfakeAnalysisResult {
    analyze_media_frame(frame_bytes)
}
