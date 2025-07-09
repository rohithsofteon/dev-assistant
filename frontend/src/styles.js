export const styles = {  container: {
    minHeight: '100vh',
    height: '100vh',
    background: '#f8f9fa',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    maxWidth: '100vw',
    boxSizing: 'border-box',
  },

  header: {
    position: 'relative',
    background: '#ffffff',
    borderBottom: '1px solid #e5e5e5',
    zIndex: 10,
    height: '64px',
    flexShrink: 0,
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 24px',
    justifyContent: 'center',
    position: 'relative',
    height: '100%',
  },
  logo: {
    position: 'absolute',
    left: '0',
    width: '120px',
    height: '70px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  title: {
    color: 'white',
    fontSize: '1.5rem',
    fontWeight: 'bold',
    marginLeft: '1rem',
  },  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: 'calc(100vh - 64px)',
    background: 'transparent',
    margin: '0',
    padding: '0',
    overflow: 'hidden',
  },
  chatContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: 'transparent',
    overflow: 'hidden',
    padding: '0',
    margin: '0',
    width: '100%',
    height: '100%',
  },  message: {
    marginBottom: '0',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px 0',
    width: '100%',
    transition: 'background-color 0.2s ease',
  },  userMessage: {
    backgroundColor: 'transparent',
  },

  botMessage: {
    backgroundColor: 'transparent',
  },messageContent: {
    maxWidth: '100%',
    padding: '0',
    borderRadius: '0',
    display: 'block',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    overflowWrap: 'break-word',
    fontSize: '16px',
    margin: 0,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    boxShadow: 'none',
    position: 'relative',
    color: '#2d3748',
    border: 'none',
    background: 'transparent',
    overflow: 'hidden',
  },

  userMessageContent: {
    color: '#374151',
    fontWeight: '400',
    border: 'none',
    background: 'transparent',
    boxShadow: 'none',
  },
  botMessageContent: {
    color: '#374151',
    border: 'none',
    background: 'transparent',
    boxShadow: 'none',
  },  inputContainer: {
    flexShrink: 0,
    padding: '24px 0 32px 0',
    background: 'transparent',
    borderTop: '1px solid #e2e8f0',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.04)',
  },
  form: {
    maxWidth: '768px',
    margin: '0 auto',
    display: 'flex',
    gap: '12px',
    alignItems: 'end',
    padding: '0 24px',
    width: '100%',
    boxSizing: 'border-box',
  },  input: {
    flex: 1,
    padding: '14px 18px',
    borderRadius: '24px',
    border: '2px solid #e2e8f0',
    background: '#ffffff',
    color: '#2d3748',
    fontSize: '16px',
    outline: 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    resize: 'none',
    minHeight: '24px',
    maxHeight: '200px',
    lineHeight: '1.5',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
  },  button: {
    padding: '12px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#10a37f',
    color: '#ffffff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s ease, transform 0.1s ease, box-shadow 0.2s ease',
    fontWeight: '500',
    fontSize: '14px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    width: '44px',
    height: '44px',
    boxShadow: '0 2px 8px rgba(16, 163, 127, 0.3)',
  },  buttonDisabled: {
    backgroundColor: '#cbd5e0',
    color: '#a0aec0',
    cursor: 'not-allowed',
    boxShadow: 'none',
    transform: 'none',
  },
};

// Colors
export const YELLOW = '#FFD700';
export const MATTE_BLACK = '#181818';
export const BUTTON_DARK = '#222';

// Reusable Components

export const themedActionButton = (color = BUTTON_DARK) => ({
  width: '100%',
  padding: '0.8rem 0',
  borderRadius: 8,
  border: 'none',
  background: YELLOW,
  color: MATTE_BLACK,
  fontWeight: 700,
  fontSize: '1.08rem',
  cursor: 'pointer',
  letterSpacing: 1,
  fontFamily: 'Raleway, Inter, Segoe UI, Arial, sans-serif',
  transition: 'background 0.2s, box-shadow 0.2s',
  boxShadow: '0 2px 8px rgba(0,0,0,0.13)',
});

export const themedCloseButton = {
  position: 'absolute',
  top: 10,
  right: 14,
  background: 'none',
  border: 'none',
  color: YELLOW,
  fontSize: 22,
  cursor: 'pointer',
  fontWeight: 700,
  fontFamily: 'Raleway, Inter, Segoe UI, Arial, sans-serif',
  transition: 'color 0.2s',
};

export const userMgmtFormInput = {
  width: '100%',
  padding: '0.7rem 1rem',
  borderRadius: 8,
  border: 'none',
  background: '#0d1f0d',
  color: '#fff',
  fontSize: '1.08rem',
  outline: 'none',
  boxSizing: 'border-box',
  fontWeight: 400,
  letterSpacing: 1,
  marginBottom: 0,
  marginTop: 0,
  transition: 'border 0.2s, background 0.2s, color 0.2s',
};

export const userMgmtFormLabel = {
  color: '#fff',
  fontWeight: 500,
  display: 'block',
  marginBottom: 6,
  letterSpacing: 1,
  fontSize: '1.01rem',
};

export const userMgmtFormSection = {
  marginBottom: 14,
};

// Chat-specific Styles
export const sourceAttribution = {
  fontSize: '0.9em',
  color: '#666',
  borderTop: '1px solid #eee',
  paddingTop: '8px',
  marginTop: '8px'
};

// Add global CSS for markdown tables
const styleSheet = document.createElement("style");
styleSheet.innerText = `
.markdown-table {
  border-collapse: collapse;
  width: 100%;
  max-width: 100%;
  margin: 1.5em 0;
  font-size: 14px;
  background: #ffffff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
  display: block;
  overflow-x: auto;
  white-space: nowrap;
}
.markdown-table th, .markdown-table td {
  border: 1px solid #e5e7eb;
  padding: 12px 16px;
  text-align: left;
  word-break: break-word;
  max-width: 200px;
}
.markdown-table th {
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  font-weight: 600;
  color: #374151;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.markdown-table tr:nth-child(even) {
  background: #f8fafc;
}
.markdown-table tr:hover {
  background: #fef3c7;
  transition: background 0.2s ease;
}
.markdown-table td {
  vertical-align: top;
  color: #4b5563;
  line-height: 1.5;
}
.markdown-table tbody tr {
  border-bottom: 1px solid #e5e7eb;
}
`;
document.head.appendChild(styleSheet);