import 'dart:math';
import 'dart:typed_data';

import '../models/deepfake_analysis.dart';

/// Pure-Dart fallback mirroring `rust_core` until the native library is built.
class NexusCoreDart {
  static final _cardCandidateRe = RegExp(r'\b(?:\d[ -]*?){13,19}\b');
  static final _ssnRe = RegExp(r'\b\d{3}-\d{2}-\d{4}\b');
  static final _tcknCandidateRe = RegExp(r'\b[1-9]\d{10}\b');
  static final _phoneRe = RegExp(
    r'(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3}\)?[\s-]?)\d{3}[\s-]?\d{4}',
  );
  static final _emailRe = RegExp(
    r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b',
  );
  static final _openAiKeyRe = RegExp(r'\bsk-[A-Za-z0-9_-]{10,}\b');
  static final _githubKeyRe = RegExp(r'\bghp_[A-Za-z0-9]{20,}\b');
  static final _bearerRe = RegExp(
    r'\bbearer\s+[A-Za-z0-9._\-+/=]{8,}\b',
    caseSensitive: false,
  );
  static final _passwordKvRe = RegExp(
    r'(password|passwd|pwd|api[-_]?key|secret|token)\s*[:=]\s*\S+',
    caseSensitive: false,
  );

  String scrubPii(String input) => scrubPiiStream(input);

  String scrubPiiStream(String input) {
    var out = _scrubCreditCards(input);
    out = out.replaceAll(_openAiKeyRe, '[HIDDEN_API_KEY]');
    out = out.replaceAll(_githubKeyRe, '[HIDDEN_API_KEY]');
    out = out.replaceAll(_bearerRe, '[HIDDEN_BEARER_TOKEN]');
    out = out.replaceAll(_passwordKvRe, '[HIDDEN_PASSWORD]');
    out = _scrubTckn(out);
    out = out.replaceAll(_ssnRe, '[HIDDEN_SSN]');
    out = out.replaceAll(_emailRe, '[HIDDEN_EMAIL]');
    out = out.replaceAll(_phoneRe, '[HIDDEN_PHONE]');
    return out;
  }

  String _scrubCreditCards(String input) {
    return input.replaceAllMapped(_cardCandidateRe, (match) {
      final raw = match.group(0) ?? '';
      return _luhnValid(raw) ? '[HIDDEN_CREDIT_CARD]' : raw;
    });
  }

  String _scrubTckn(String input) {
    return input.replaceAllMapped(_tcknCandidateRe, (match) {
      final raw = match.group(0) ?? '';
      return _tcknValid(raw) ? '[HIDDEN_TCKN]' : raw;
    });
  }

  bool _luhnValid(String raw) {
    final digits = _digitsOnly(raw);
    if (digits.length < 13 || digits.length > 19) return false;
    var sum = 0;
    final parity = digits.length % 2;
    for (var i = 0; i < digits.length; i++) {
      var n = digits[i];
      if (i % 2 == parity) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
    }
    return sum % 10 == 0;
  }

  bool _tcknValid(String raw) {
    final digits = _digitsOnly(raw);
    if (digits.length != 11 || digits[0] == 0) return false;
    final d10 = digits.sublist(0, 10).reduce((a, b) => a + b);
    if (digits[9] != d10 % 10) return false;
    final odd = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
    final even = digits[1] + digits[3] + digits[5] + digits[7];
    return digits[10] == ((odd * 7) + even) % 10;
  }

  List<int> _digitsOnly(String value) {
    return value
        .split('')
        .where((c) => int.tryParse(c) != null)
        .map(int.parse)
        .toList();
  }

  double verifyC2paSignature(Uint8List imageBytes) {
    return analyzeMediaFrame(imageBytes).confidenceScore;
  }

  DeepfakeAnalysis analyzeMediaFrame(Uint8List frameBytes) {
    if (frameBytes.isEmpty) {
      return const DeepfakeAnalysis(
        confidenceScore: 1.0,
        isSynthetic: true,
        detectionReasons: ['Empty frame payload'],
      );
    }

    final reasons = <String>[];
    final lower = frameBytes.map((b) {
      if (b >= 65 && b <= 90) return b + 32;
      return b;
    }).toList();

    final hasC2pa = _containsAscii(lower, 'c2pa') ||
        _containsAscii(lower, 'jumb') ||
        _containsAscii(lower, 'c2pa.manifest');
    if (!hasC2pa) {
      reasons.add('Missing C2PA Manifest');
    }

    final entropy = _byteEntropy(frameBytes);
    if (entropy > 0.82) {
      reasons.add('High entropy noise signature');
    }

    final edgeScore = _facialEdgeInconsistency(frameBytes);
    if (edgeScore > 0.62) {
      reasons.add('Facial Edge Inconsistency');
    }

    if (!_isCommonImageFormat(frameBytes)) {
      reasons.add('Unknown media container');
    }

    var confidence = 0.25;
    if (!hasC2pa) confidence += 0.35;
    confidence += edgeScore * 0.25;
    confidence += entropy * 0.15;
    if (!_isCommonImageFormat(frameBytes)) confidence += 0.1;
    confidence = confidence.clamp(0.0, 1.0);

    final isSynthetic = confidence >= 0.55 || !hasC2pa;
    if (reasons.isEmpty) {
      reasons.add('C2PA credentials present');
    }

    return DeepfakeAnalysis(
      confidenceScore: confidence,
      isSynthetic: isSynthetic,
      detectionReasons: reasons,
    );
  }

  double _facialEdgeInconsistency(Uint8List bytes) {
    if (bytes.length < 64) return 0.5;
    var gradients = 0;
    var sharpJumps = 0;
    for (var i = 0; i < bytes.length - 1; i++) {
      final delta = (bytes[i + 1] - bytes[i]).abs();
      gradients++;
      if (delta > 96) sharpJumps++;
    }
    if (gradients == 0) return 0.5;
    return (sharpJumps / gradients).clamp(0.0, 1.0);
  }

  bool _containsAscii(List<int> haystack, String needle) {
    final n = needle.codeUnits;
    if (n.isEmpty || haystack.length < n.length) return false;
    for (var i = 0; i <= haystack.length - n.length; i++) {
      var ok = true;
      for (var j = 0; j < n.length; j++) {
        if (haystack[i + j] != n[j]) {
          ok = false;
          break;
        }
      }
      if (ok) return true;
    }
    return false;
  }

  bool _isCommonImageFormat(Uint8List bytes) {
    if (bytes.length < 4) return false;
    return (bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF) ||
        (bytes[0] == 0x89 &&
            bytes[1] == 0x50 &&
            bytes[2] == 0x4E &&
            bytes[3] == 0x47) ||
        (bytes[0] == 0x52 &&
            bytes[1] == 0x49 &&
            bytes[2] == 0x46 &&
            bytes[3] == 0x46);
  }

  double _byteEntropy(Uint8List bytes) {
    if (bytes.isEmpty) return 1.0;
    final counts = List<int>.filled(256, 0);
    for (final b in bytes) {
      counts[b]++;
    }
    final len = bytes.length;
    var entropy = 0.0;
    for (final c in counts) {
      if (c == 0) continue;
      final p = c / len;
      entropy -= p * (log(p) / ln2);
    }
    return (entropy / 8).clamp(0.0, 1.0);
  }
}
