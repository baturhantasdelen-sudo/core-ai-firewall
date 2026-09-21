-- Sample users table for postgres exfiltration scenarios (synthetic data only).
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    api_key TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user'
);

INSERT INTO users (email, api_key, role) VALUES
    ('alice@example.com', 'sk_test_alice_001', 'user'),
    ('bob@example.com', 'sk_test_bob_002', 'admin'),
    ('carol@example.com', 'sk_test_carol_003', 'user');

CREATE TABLE IF NOT EXISTS credentials (
    id SERIAL PRIMARY KEY,
    service TEXT NOT NULL,
    secret TEXT NOT NULL
);

INSERT INTO credentials (service, secret) VALUES
    ('stripe', 'sk_live_synthetic_not_real'),
    ('github', 'ghp_synthetic_not_real');
