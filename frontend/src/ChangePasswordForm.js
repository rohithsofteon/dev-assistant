import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import loginBg from './login-bg.png';

const YELLOW = '#FFD700';

function ChangePasswordForm({ username, onSuccess }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [btnHover, setBtnHover] = useState(false);
  const [backHover, setBackHover] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newPassword || !confirm) {
      setError('Please fill in all fields.');
      return;
    }
    if (newPassword !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Password changed successfully!');
        setTimeout(() => {
          if (onSuccess) onSuccess();
          navigate('/');
        }, 1200);
      } else {
        setError(data.error || 'Failed to change password.');
      }
    } catch (err) {
      setError('Server error.');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: `url(${loginBg}) center center / cover no-repeat`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: 'rgba(30, 64, 35, 0.92)',
          borderRadius: '18px',
          boxShadow: '0 8px 32px rgba(46,139,73,0.18)',
          padding: '2.5rem 2rem 2rem 2rem',
          minWidth: 340,
          width: '100%',
          maxWidth: 380,
          backdropFilter: 'blur(10px)',
          border: '1.5px solid #2E8B49',
          position: 'relative',
        }}
      >
        {/* Thicker and bigger back icon with hover effect */}
        <button
          type="button"
          onClick={() => {
            // Clear any password state if needed, then redirect
            window.location.href = '/';
          }}
          onMouseEnter={() => setBackHover(true)}
          onMouseLeave={() => setBackHover(false)}
          style={{
            position: 'absolute',
            left: 12,
            top: 16,
            background: 'none',
            border: 'none',
            color: YELLOW,
            cursor: 'pointer',
            padding: 0,
            zIndex: 2,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
          }}
          title="Back to Login"
        >
          <svg
            width={backHover ? 38 : 28}
            height={backHover ? 38 : 28}
            viewBox="0 0 24 24"
            fill="none"
            stroke={YELLOW}
            strokeWidth={backHover ? 3.2 : 2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transition: 'width 0.18s, height 0.18s, stroke-width 0.18s',
              display: 'block',
            }}
          >
            <polyline points="15 18 9 12 15 6" />
            <line x1="9" y1="12" x2="21" y2="12" />
          </svg>
        </button>
        <h2
          style={{
            color: YELLOW,
            textAlign: 'center',
            marginBottom: 24,
            letterSpacing: 1,
            fontWeight: 700,
            fontSize: '2rem',
          }}
        >
          Change Password
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 18 }}>
            <label
              style={{
                color: YELLOW,
                fontWeight: 600,
                display: 'block',
                marginBottom: 6,
              }}
            >
              New Password:
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.7rem 1rem',
                borderRadius: 8,
                border: '1.5px solid #bbb',
                background: 'rgba(255,255,255,0.18)',
                color: '#fff',
                fontSize: '1rem',
                outline: 'none',
                boxSizing: 'border-box',
                fontWeight: 500,
                letterSpacing: 1,
              }}
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label
              style={{
                color: YELLOW,
                fontWeight: 600,
                display: 'block',
                marginBottom: 6,
              }}
            >
              Confirm Password:
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.7rem 1rem',
                borderRadius: 8,
                border: '1.5px solid #bbb',
                background: 'rgba(255,255,255,0.18)',
                color: '#fff',
                fontSize: '1rem',
                outline: 'none',
                boxSizing: 'border-box',
                fontWeight: 500,
                letterSpacing: 1,
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
                background: btnHover ? YELLOW : '#2E8B49',
                color: btnHover ? '#181818' : 'white',
                fontWeight: 700,
                fontSize: '1.08rem',
                cursor: 'pointer',
                letterSpacing: 1,
                transition: 'background 0.2s, color 0.2s',
                boxShadow: '0 2px 8px rgba(46,139,73,0.08)',
              }}
              onMouseEnter={() => setBtnHover(true)}
              onMouseLeave={() => setBtnHover(false)}
            >
              Change Password
            </button>
          </div>
          {error && (
            <div
              style={{
                color: '#ff4d4f',
                marginTop: 14,
                textAlign: 'center',
                fontWeight: 500,
              }}
            >
              {error}
            </div>
          )}
          {success && (
            <div
              style={{
                color: 'lightgreen',
                marginTop: 14,
                textAlign: 'center',
                fontWeight: 500,
              }}
            >
              {success}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default ChangePasswordForm;