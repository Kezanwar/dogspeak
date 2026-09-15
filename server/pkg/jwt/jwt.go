package jwt

import (
	"fmt"
	"time"

	gojwt "github.com/golang-jwt/jwt/v5"
)

// Signer issues and verifies HS256 (HMAC) tokens with a fixed secret and TTL.
// It centralises our JWT conventions — the algorithm, the expiry, and the
// security checks on verify — so the rest of the app never touches the JWT
// library directly. Reuse it anywhere we need signed, expiring tokens.
type Signer struct {
	secret []byte
	ttl    time.Duration
}

// New returns a Signer. secret is the HMAC key (keep it long and random); ttl is
// how long issued tokens stay valid.
func New(secret []byte, ttl time.Duration) *Signer {
	return &Signer{secret: secret, ttl: ttl}
}

// Sign issues a token that expires after the signer's TTL. subject is optional —
// pass "" when there's no identity to carry; otherwise it lands in the standard
// "sub" claim, ready for the day tokens need to name a user.
func (s *Signer) Sign(subject string) (string, error) {
	now := time.Now()
	claims := gojwt.RegisteredClaims{
		Subject:   subject,
		IssuedAt:  gojwt.NewNumericDate(now),
		ExpiresAt: gojwt.NewNumericDate(now.Add(s.ttl)),
	}
	return gojwt.NewWithClaims(gojwt.SigningMethodHS256, claims).SignedString(s.secret)
}

// Verify checks a token's signature and expiry and returns its subject. Any
// non-nil error means the token is invalid, expired, or signed with the wrong
// key or algorithm — callers should treat every error as "not authenticated".
func (s *Signer) Verify(token string) (string, error) {
	claims := &gojwt.RegisteredClaims{}
	t, err := gojwt.ParseWithClaims(token, claims, func(t *gojwt.Token) (any, error) {
		// Pin the algorithm: reject anything that isn't HMAC, to defeat
		// alg-confusion attacks ("none", or an asymmetric alg abusing our key).
		if _, ok := t.Method.(*gojwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.secret, nil
	})
	if err != nil {
		return "", err
	}
	if !t.Valid {
		return "", fmt.Errorf("invalid token")
	}
	return claims.Subject, nil
}
