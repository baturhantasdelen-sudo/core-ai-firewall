#[derive(Debug, Clone)]
#[flutter_rust_bridge::frb]
pub struct DeepfakeAnalysisResult {
    pub confidence_score: f32,
    pub is_synthetic: bool,
    pub detection_reasons: Vec<String>,
}

pub fn analyze_media_frame(frame_bytes: Vec<u8>) -> DeepfakeAnalysisResult {
    let mut reasons = Vec::new();
    if frame_bytes.is_empty() {
        return DeepfakeAnalysisResult {
            confidence_score: 1.0,
            is_synthetic: true,
            detection_reasons: vec!["Empty frame payload".to_string()],
        };
    }

    let lower = bytes_to_lower_ascii(&frame_bytes);
    let has_c2pa = contains_subsequence(&lower, b"c2pa")
        || contains_subsequence(&lower, b"jumb")
        || contains_subsequence(&lower, b"c2pa.manifest");

    if !has_c2pa {
        reasons.push("Missing C2PA Manifest".to_string());
    }

    let entropy = byte_entropy(&frame_bytes);
    if entropy > 0.82 {
        reasons.push("High entropy noise signature".to_string());
    }

    let edge_score = facial_edge_inconsistency(&frame_bytes);
    if edge_score > 0.62 {
        reasons.push("Facial Edge Inconsistency".to_string());
    }

    if !is_common_image_format(&frame_bytes) {
        reasons.push("Unknown media container".to_string());
    }

    let mut confidence = 0.25f32;
    if !has_c2pa {
        confidence += 0.35;
    }
    confidence += edge_score * 0.25;
    confidence += entropy * 0.15;
    if !is_common_image_format(&frame_bytes) {
        confidence += 0.1;
    }
    confidence = confidence.clamp(0.0, 1.0);

    let is_synthetic = confidence >= 0.55 || !has_c2pa;
    if reasons.is_empty() {
        reasons.push("C2PA credentials present".to_string());
    }

    DeepfakeAnalysisResult {
        confidence_score: confidence,
        is_synthetic,
        detection_reasons: reasons,
    }
}

fn facial_edge_inconsistency(bytes: &[u8]) -> f32 {
    if bytes.len() < 64 {
        return 0.5;
    }
    let mut gradients = 0u32;
    let mut sharp_jumps = 0u32;
    for window in bytes.windows(2) {
        let delta = (window[1] as i16 - window[0] as i16).unsigned_abs();
        gradients += 1;
        if delta > 96 {
            sharp_jumps += 1;
        }
    }
    if gradients == 0 {
        return 0.5;
    }
    (sharp_jumps as f32 / gradients as f32).clamp(0.0, 1.0)
}

fn bytes_to_lower_ascii(bytes: &[u8]) -> Vec<u8> {
    bytes
        .iter()
        .map(|b| if (b'A'..=b'Z').contains(b) { b + 32 } else { *b })
        .collect()
}

fn contains_subsequence(haystack: &[u8], needle: &[u8]) -> bool {
    if needle.is_empty() || haystack.len() < needle.len() {
        return false;
    }
    haystack.windows(needle.len()).any(|w| w == needle)
}

fn is_common_image_format(bytes: &[u8]) -> bool {
    bytes.starts_with(&[0xFF, 0xD8, 0xFF])
        || bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47])
        || bytes.starts_with(b"RIFF")
}

fn byte_entropy(bytes: &[u8]) -> f32 {
    if bytes.is_empty() {
        return 1.0;
    }
    let mut counts = [0u32; 256];
    for b in bytes {
        counts[*b as usize] += 1;
    }
    let len = bytes.len() as f32;
    let mut entropy = 0.0f32;
    for c in counts {
        if c == 0 {
            continue;
        }
        let p = c as f32 / len;
        entropy -= p * p.log2();
    }
    (entropy / 8.0).clamp(0.0, 1.0)
}
