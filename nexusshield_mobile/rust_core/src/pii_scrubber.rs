use lazy_static::lazy_static;
use regex::Regex;

lazy_static! {
    static ref CARD_CANDIDATE_RE: Regex =
        Regex::new(r"\b(?:\d[ -]*?){13,19}\b").expect("card candidate");
    static ref SSN_RE: Regex =
        Regex::new(r"\b\d{3}-\d{2}-\d{4}\b").expect("ssn");
    static ref TCKN_CANDIDATE_RE: Regex = Regex::new(r"\b[1-9]\d{10}\b").expect("tckn");
    static ref PHONE_RE: Regex = Regex::new(
        r"(?x)
        (?:
          \+?\d{1,3}[\s-]?
        )?
        (?:\(?\d{3}\)?[\s-]?)
        \d{3}[\s-]?\d{4}
        ",
    )
    .expect("phone");
    static ref EMAIL_RE: Regex =
        Regex::new(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b").expect("email");
    static ref OPENAI_KEY_RE: Regex =
        Regex::new(r"\bsk-[A-Za-z0-9_-]{10,}\b").expect("openai key");
    static ref GITHUB_KEY_RE: Regex =
        Regex::new(r"\bghp_[A-Za-z0-9]{20,}\b").expect("github key");
    static ref BEARER_RE: Regex =
        Regex::new(r"(?i)\bbearer\s+[A-Za-z0-9._\-+/=]{8,}\b").expect("bearer");
    static ref PASSWORD_KV_RE: Regex = Regex::new(
        r"(?i)(password|passwd|pwd|api[_-]?key|secret|token)\s*[:=]\s*\S+",
    )
    .expect("password kv");
}

pub fn scrub_pii_stream(input: &str) -> String {
    let mut out = input.to_string();
    out = scrub_credit_cards(&out);
    out = OPENAI_KEY_RE
        .replace_all(&out, "[HIDDEN_API_KEY]")
        .into_owned();
    out = GITHUB_KEY_RE
        .replace_all(&out, "[HIDDEN_API_KEY]")
        .into_owned();
    out = BEARER_RE
        .replace_all(&out, "[HIDDEN_BEARER_TOKEN]")
        .into_owned();
    out = PASSWORD_KV_RE
        .replace_all(&out, "[HIDDEN_PASSWORD]")
        .into_owned();
    out = scrub_tckn(&out);
    out = SSN_RE.replace_all(&out, "[HIDDEN_SSN]").into_owned();
    out = EMAIL_RE.replace_all(&out, "[HIDDEN_EMAIL]").into_owned();
    out = PHONE_RE.replace_all(&out, "[HIDDEN_PHONE]").into_owned();
    out
}

fn scrub_credit_cards(input: &str) -> String {
    CARD_CANDIDATE_RE
        .replace_all(input, |caps: &regex::Captures| {
            let raw = caps.get(0).map(|m| m.as_str()).unwrap_or("");
            if luhn_valid(raw) {
                "[HIDDEN_CREDIT_CARD]".to_string()
            } else {
                raw.to_string()
            }
        })
        .into_owned()
}

fn scrub_tckn(input: &str) -> String {
    TCKN_CANDIDATE_RE
        .replace_all(input, |caps: &regex::Captures| {
            let raw = caps.get(0).map(|m| m.as_str()).unwrap_or("");
            if tckn_valid(raw) {
                "[HIDDEN_TCKN]".to_string()
            } else {
                raw.to_string()
            }
        })
        .into_owned()
}

fn digits_only(value: &str) -> Vec<u8> {
    value
        .chars()
        .filter(|c| c.is_ascii_digit())
        .map(|c| c as u8 - b'0')
        .collect()
}

fn luhn_valid(raw: &str) -> bool {
    let digits = digits_only(raw);
    if !(13..=19).contains(&digits.len()) {
        return false;
    }
    let mut sum = 0u32;
    let parity = digits.len() % 2;
    for (i, d) in digits.iter().enumerate() {
        let mut n = *d as u32;
        if i % 2 == parity {
            n *= 2;
            if n > 9 {
                n -= 9;
            }
        }
        sum += n;
    }
    sum % 10 == 0
}

fn tckn_valid(raw: &str) -> bool {
    let digits = digits_only(raw);
    if digits.len() != 11 || digits[0] == 0 {
        return false;
    }
    let d10: u32 = digits[..10].iter().map(|&d| d as u32).sum();
    if digits[9] as u32 != d10 % 10 {
        return false;
    }
    let odd_sum: u32 = digits[0] as u32
        + digits[2] as u32
        + digits[4] as u32
        + digits[6] as u32
        + digits[8] as u32;
    let even_sum: u32 = digits[1] as u32 + digits[3] as u32 + digits[5] as u32 + digits[7] as u32;
    let d11 = ((odd_sum * 7) + even_sum) % 10;
    digits[10] as u32 == d11
}
