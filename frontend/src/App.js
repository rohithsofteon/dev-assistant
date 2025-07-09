import React, { useState, useEffect } from 'react';
import logo from './logo.png';
import loginBg from './login-bg.png';
import LoginForm from './LoginForm';
import UserManagement from './UserManagement';
import TeamManagement from './TeamManagement';
import SettingsPage from './SettingsPage';
import Chat from './Chat';
import { getBaseUrl } from './utils';
import { styles, YELLOW } from './styles';
import { Settings } from 'lucide-react';
import ChangePasswordForm from './ChangePasswordForm';
import { useNavigate } from 'react-router-dom';

const App = () => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [selectedModuleId, setSelectedModuleId] = useState(''); // For module filtering
  const [modules, setModules] = useState([]);

  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');  const [loginError, setLoginError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showSettingsPage, setShowSettingsPage] = useState(false);
  const [showUserMgmt, setShowUserMgmt] = useState(false);
  const [showTeamMgmt, setShowTeamMgmt] = useState(false);
  const [role, setRole] = useState(0); // 1 = admin, 0 = user
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [logoutHover, setLogoutHover] = useState(false);
  const [userConfig, setUserConfig] = useState(null); // Store user configuration
  const [navState, setNavState] = useState({ showSidebar: true, navExpanded: true, navWidth: 280 });
  const navigate = useNavigate();

  // Login logic
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${getBaseUrl()}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('token', data.token);
        setLoggedIn(true);
        setLoginError('');
        setRole(data.role || 0);
        setUserConfig(data.config); // Store user config from login response
        // Check mustChangePassword flag and show change password form if needed
        if (data.mustChangePassword) {
          setShowChangePassword(true);
        } else {
          setShowChangePassword(false);
        }
      } else {
        setLoginError(data.error || 'Login failed');
      }
    } catch (err) {
      setLoginError('Error connecting to server');
    }
  };

  // Settings icon animation
  const rotateStyle = `
    .settings-rotate {
      display: inline-flex;
      transition: transform 0.25s cubic-bezier(.4,2,.6,1);
      vertical-align: middle;
    }
    .settings-rotate.active {
      transform: rotate(30deg);
    }
  `;
  const handlePasswordChangeSuccess = () => {
    setShowChangePassword(false);
    setLoggedIn(false);
    setUsername('');
    setPassword('');
    localStorage.removeItem('token');
    navigate('/'); // Redirect to login page after password change
  };

  // Fetch modules when logged in
  useEffect(() => {
    if (loggedIn) {
      const fetchModules = async () => {
        try {
          const token = localStorage.getItem('token');
          const res = await fetch(`${getBaseUrl()}/api/modules`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const data = await res.json();
          setModules(data.modules || []);
        } catch (err) {
          console.error('Error fetching modules:', err);
          setModules([]);
        }
      };
      fetchModules();
    }
  }, [loggedIn]);

  if (!loggedIn && !showChangePassword) {
    // Show LoginForm with "Forgot Password?" logic
    return (
      <LoginForm
        username={username}
        setUsername={setUsername}
        password={password}
        setPassword={setPassword}
        loginError={loginError}
        handleLogin={handleLogin}
        loginBg={loginBg}
        logo={logo}
        onForgotPassword={async () => {
          if (!username) {
            setLoginError('Please enter your username to reset password.');
            return;
          }
          // Check if user exists (call backend)
          try {
            const res = await fetch(`${getBaseUrl()}/api/check-user`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username }),
            });
            const data = await res.json();
            if (!data.exists) {
              setLoginError('Username is not correct.');
            } else {
              setShowChangePassword(true);
              setLoginError('');
            }
          } catch {
            setLoginError('Server error. Please try again.');
          }
        }}
      />
    );
  }

  // Only show the ChangePasswordForm with background, no nav/header/settings/logo
  if (showChangePassword) {
    return (
      <ChangePasswordForm
        username={username}
        onSuccess={handlePasswordChangeSuccess}
      />
    );
  }
  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
        }
        html, body {
          margin: 0;
          padding: 0;
          overflow-x: hidden;
          width: 100%;
          max-width: 100vw;
        }
        #root {
          width: 100%;
          max-width: 100vw;
          overflow-x: hidden;
        }
      `}</style>
      <div style={styles.container}>
      <style>{rotateStyle}</style>
      <header style={{
        ...styles.header,
        marginLeft: navState.navWidth + 'px',
        width: `calc(100% - ${navState.navWidth}px)`,
        transition: 'margin-left 0.3s ease, width 0.3s ease',
      }}>
        <div style={styles.headerContent}>
          {/* Logo - Center */}
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '120px',
            height: '70px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <img
              src={logo}
              alt="RFP Assistant Logo"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = 'none';
              }}
            />
          </div>          <div style={{
            position: 'absolute',
            right: '0',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            {/* Settings Icon */}
            <button
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#6b7280',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                fontSize: 22,
                transition: 'color 0.2s',
                borderRadius: '6px',
              }}
              onClick={() => setShowSettingsPage(true)}
              title="Settings"
              onMouseEnter={(e) => e.target.style.color = '#374151'}
              onMouseLeave={(e) => e.target.style.color = '#6b7280'}
            >
              <span className={`settings-rotate${showSettingsPage ? ' active' : ''}`}>
                <Settings size={20} />
              </span>
            </button>
            
            {/* Logout Icon */}
            <button
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#6b7280',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.2s',
                borderRadius: '6px',
              }}
              title="Logout"
              onClick={() => {
                setShowSettings(false);
                setShowSettingsPage(false);
                setLoggedIn(false);
                setUsername('');
                setPassword('');
                localStorage.removeItem('token');
                navigate('/', { replace: true });
              }}
              onMouseEnter={(e) => e.target.style.color = '#374151'}
              onMouseLeave={(e) => e.target.style.color = '#6b7280'}
            >
              <svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </header>      {showUserMgmt && (
        <UserManagement
          show={showUserMgmt}
          onClose={() => setShowUserMgmt(false)}
          role={role}
        />
      )}
      {showTeamMgmt && (
        <TeamManagement
          show={showTeamMgmt}
          onClose={() => setShowTeamMgmt(false)}
          role={role}
        />
      )}
      {showSettingsPage && (
        <SettingsPage
          onBack={() => setShowSettingsPage(false)}
          role={role}
          onConfigUpdated={(newConfig) => setUserConfig(newConfig)}
        />
      )}

      {!showSettingsPage && (
        <Chat
          chatHistory={chatHistory}
          setChatHistory={setChatHistory}
          loading={loading}
          setLoading={setLoading}
          question={question}
          setQuestion={setQuestion}
          getBaseUrl={getBaseUrl}
          selectedModuleId={selectedModuleId}
          setSelectedModuleId={setSelectedModuleId}
          modules={modules}
          userConfig={userConfig}
          onNavStateChange={setNavState}
        />
      )}
      </div>
    </>
  );
};

export default App;