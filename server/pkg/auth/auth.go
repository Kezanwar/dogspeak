package auth

import (
	"crypto/subtle"
	"net/http"
	"time"

	"dogspeak-server/pkg/jwt"
)

const cookieName = "session"

// Config holds everything the auth package needs. Wire it in main.go from env.
type Config struct {
	Password     string        // the shared room password
	Secret       []byte        // HMAC secret used to sign session tokens
	CookieDomain string        // e.g. ".dogspeak.xyz" in prod; "" for localhost dev
	CookieSecure bool          // true over HTTPS (prod); false for http://localhost
	TTL          time.Duration // how long a session lasts; defaults to 7 days
}

// Auth issues and verifies session cookies. It's stateless — the token is
// self-contained (signed by pkg/jwt), so there's no session store or database.
type Auth struct {
	cfg    Config
	signer *jwt.Signer
}

func New(cfg Config) *Auth {
	if cfg.TTL == 0 {
		cfg.TTL = 7 * 24 * time.Hour
	}
	return &Auth{
		cfg:    cfg,
		signer: jwt.New(cfg.Secret, cfg.TTL),
	}
}

// checkPassword compares in constant time so we don't leak the password by timing.
func (a *Auth) checkPassword(got string) bool {
	return subtle.ConstantTimeCompare([]byte(got), []byte(a.cfg.Password)) == 1
}

// mint issues a fresh session token. Login only proves password-knowledge, so
// no identity is carried (empty subject).
func (a *Auth) mint() (string, error) {
	return a.signer.Sign("")
}

// valid reports whether a token is correctly signed and unexpired.
func (a *Auth) valid(token string) bool {
	_, err := a.signer.Verify(token)
	return err == nil
}

// setCookie writes the session cookie holding token, valid for TTL.
func (a *Auth) setCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    token,
		Path:     "/",
		Domain:   a.cfg.CookieDomain,
		MaxAge:   int(a.cfg.TTL.Seconds()),
		HttpOnly: true, // JavaScript can't read it — XSS can't steal the token
		Secure:   a.cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode, // CSRF mitigation; fine across sub-domains
	})
}

// clearCookie overwrites the session cookie with an immediate expiry, deleting it.
func (a *Auth) clearCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    "",
		Path:     "/",
		Domain:   a.cfg.CookieDomain,
		MaxAge:   -1, // negative tells the browser to delete it now
		HttpOnly: true,
		Secure:   a.cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

// cookieToken pulls the raw token out of the request's session cookie.
func cookieToken(r *http.Request) string {
	c, err := r.Cookie(cookieName)
	if err != nil {
		return ""
	}
	return c.Value
}
