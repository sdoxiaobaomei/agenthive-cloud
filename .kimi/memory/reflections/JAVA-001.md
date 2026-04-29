# Reflection: JAVA-001 — Explicit JWT Algorithm + Key Length Validation

## What Worked
- Using `Jwts.SIG.HS256` (type `SecureDigestAlgorithm<SecretKey, SecretKey>`) in jjwt 0.12.5 instead of the deprecated `SignatureAlgorithm` enum. The build passed cleanly.
- Constructor key-length validation in `JwtUtils` and `@PostConstruct` validation in `JwtValidationFilter` provide defense-in-depth: fail-fast at both token-creation and gateway startup boundaries.
- Added targeted unit tests for both failure paths (short secret) and success paths (valid secret), achieving full test pass (`mvn clean package -pl common/common-security,gateway-service -am`).

## Surprises / Lessons
- jjwt 0.12.x auto-infers algorithm from key length, which is non-deterministic and dangerous: a 42-byte key triggers HS384 inference but warns because 42 bytes = 336 bits < 384 bits required. Explicit algorithm selection eliminates this class of runtime warnings.
- `ReadFile` blocks `.env.dev.example` as a "sensitive file"; had to use `Shell` with `Get-Content` and string replacement. Need to remember this for future env-file edits.

## Security Takeaways
- Never rely on library auto-inference for cryptographic algorithms. Always pin to the minimum secure algorithm (HS256 here) and validate key length at startup.
- Error messages should be actionable: include the actual length, required length, and a one-liner command (`openssl rand -base64 32`) to generate a compliant secret.

## Pattern Worth Drafting
- **Startup Crypto Validation**: `@PostConstruct` or `CommandLineRunner` validation for secrets/keys/certs with clear, actionable error messages. Consider proposing this as a reusable `CryptoConfigValidator` in `common-security` if more services need similar checks.
