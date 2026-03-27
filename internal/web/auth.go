package web

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"ops-tool/internal/config"
)

const (
	authCookieName = "ops_auth_token"
	authSessionTTL = 24 * time.Hour
)

type authSession struct {
	Username  string
	ExpiresAt time.Time
}

func (s *Server) handleAuthStatus(w http.ResponseWriter, r *http.Request) {
	username, ok := s.authenticatedUsername(r)
	writeJSON(w, http.StatusOK, map[string]any{
		"enabled":       true,
		"authenticated": ok,
		"username":      username,
	})
}

func (s *Server) handleAuthLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}

	req.Username = strings.TrimSpace(req.Username)
	req.Password = strings.TrimSpace(req.Password)
	authCfg := s.currentAuthConfig()
	if !authCredentialMatch(req.Username, authCfg.Username) || !authCredentialMatch(req.Password, authCfg.Password) {
		writeErr(w, http.StatusUnauthorized, authError("用户名或密码错误"))
		return
	}

	token, err := generateAuthToken()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	now := time.Now()
	s.authMu.Lock()
	s.cleanupExpiredSessionsLocked(now)
	s.authSessions[token] = authSession{
		Username:  authCfg.Username,
		ExpiresAt: now.Add(authSessionTTL),
	}
	s.authMu.Unlock()

	http.SetCookie(w, &http.Cookie{
		Name:     authCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   false,
		MaxAge:   int(authSessionTTL.Seconds()),
		Expires:  now.Add(authSessionTTL),
	})
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"username": authCfg.Username,
	})
}

func (s *Server) handleAuthLogout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(authCookieName)
	if err == nil {
		token := strings.TrimSpace(cookie.Value)
		if token != "" {
			s.authMu.Lock()
			delete(s.authSessions, token)
			s.authMu.Unlock()
		}
	}
	http.SetCookie(w, &http.Cookie{
		Name:     authCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   false,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
	})
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) authRequiredMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}
		if _, ok := s.authenticatedUsername(r); !ok {
			writeErr(w, http.StatusUnauthorized, authError("未登录或登录已过期"))
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) authenticatedUsername(r *http.Request) (string, bool) {
	cookie, err := r.Cookie(authCookieName)
	if err != nil {
		return "", false
	}
	token := strings.TrimSpace(cookie.Value)
	if token == "" {
		return "", false
	}

	now := time.Now()
	s.authMu.Lock()
	defer s.authMu.Unlock()
	s.cleanupExpiredSessionsLocked(now)
	session, ok := s.authSessions[token]
	if !ok {
		return "", false
	}
	if now.After(session.ExpiresAt) {
		delete(s.authSessions, token)
		return "", false
	}
	return session.Username, true
}

func (s *Server) cleanupExpiredSessionsLocked(now time.Time) {
	for token, session := range s.authSessions {
		if now.After(session.ExpiresAt) {
			delete(s.authSessions, token)
		}
	}
}

func (s *Server) currentAuthConfig() config.AuthConfig {
	s.mu.RLock()
	cfg := s.cfg.Core.Auth
	s.mu.RUnlock()
	cfg.Username = strings.TrimSpace(cfg.Username)
	cfg.Password = strings.TrimSpace(cfg.Password)
	if cfg.Username == "" {
		cfg.Username = "admin"
	}
	if cfg.Password == "" {
		cfg.Password = "123ABCdef"
	}
	return cfg
}

func generateAuthToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func authCredentialMatch(input, expected string) bool {
	a := []byte(strings.TrimSpace(input))
	b := []byte(strings.TrimSpace(expected))
	if len(a) == 0 || len(b) == 0 {
		return false
	}
	if len(a) != len(b) {
		return false
	}
	return subtle.ConstantTimeCompare(a, b) == 1
}

type authError string

func (e authError) Error() string { return string(e) }
