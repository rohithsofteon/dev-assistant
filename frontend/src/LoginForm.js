import React from 'react';

function LoginForm(props) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: `url(${props.loginBg}) center center / cover no-repeat`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '18px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
          padding: '2.5rem 2rem 2rem 2rem',
          minWidth: 340,
          width: '100%',
          maxWidth: 380,
          border: '1.5px solid #eaeaea',
        }}
      >
        {/* Add Login title */}
        <h2
          style={{
            color: '#111',
            textAlign: 'center',
            marginBottom: 24,
            letterSpacing: 1,
            fontWeight: 700,
            fontSize: '2rem',
          }}
        >
          Login
        </h2>
        <form onSubmit={props.handleLogin}>
          <div style={{ marginBottom: 18 }}>
            <label
              style={{
                color: '#222',
                fontWeight: 600,
                display: 'block',
                marginBottom: 6,
              }}
            >
              Username:
            </label>
            <input
              type="text"
              value={props.username}
              onChange={e => props.setUsername(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.7rem 1rem',
                borderRadius: 8,
                border: '1.5px solid #e0e0e0',
                background: '#f5f6fa',
                color: '#111',
                fontSize: '1rem',
                outline: 'none',
                boxSizing: 'border-box',
                fontWeight: 500,
                letterSpacing: 1,
                transition: 'border 0.2s',
              }}
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label
              style={{
                color: '#222',
                fontWeight: 600,
                display: 'block',
                marginBottom: 6,
              }}
            >
              Password:
            </label>
            <input
              type="password"
              value={props.password}
              onChange={e => props.setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.7rem 1rem',
                borderRadius: 8,
                border: '1.5px solid #e0e0e0',
                background: '#f5f6fa',
                color: '#111',
                fontSize: '1rem',
                outline: 'none',
                boxSizing: 'border-box',
                fontWeight: 500,
                letterSpacing: 1,
                transition: 'border 0.2s',
              }}
            />
          </div>
          <div>
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '0.8rem 0',
                borderRadius: 8,
                border: 'none',
                background: '#111',
                color: 'white',
                fontWeight: 700,
                fontSize: '1.08rem',
                cursor: 'pointer',
                letterSpacing: 1,
                transition: 'background 0.2s, color 0.2s',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
            >
              Login
            </button>
          </div>
          {props.loginError && (
            <div
              style={{
                color: '#ff4d4f',
                marginTop: 14,
                textAlign: 'center',
                fontWeight: 500,
              }}
            >
              {props.loginError}
            </div>
          )}
        </form>
        <div style={{ marginTop: 18, textAlign: 'center' }}>
          <button
            type="button"
            style={{
              background: 'none',
              border: 'none',
              color: '#222',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '1rem',
              marginTop: 8,
              opacity: 0.7,
            }}
            onClick={props.onForgotPassword}
          >
            Forgot Password?
          </button>
        </div>
      </div>
    </div>
  );
}

export default LoginForm;
