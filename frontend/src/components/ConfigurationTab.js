import React, { useState, useEffect } from 'react';
import { getBaseUrl } from '../utils';

const ConfigurationTab = ({ onConfigSaved }) => {
  const [config, setConfig] = useState({
    response_mode: 'concise',
    show_source: 'Yes',
    explanation_level: 'intermediate',
    language_tone: 'neutral',
    step_by_step_mode: 'Off',
    follow_up_suggestions: 'Enabled',
    ask_for_clarification: 'Yes',
    chat_persona: 'Friendly',
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSavedMsg, setConfigSavedMsg] = useState('');
  const [loading, setLoading] = useState(true);

  // Load user's existing configuration on component mount
  useEffect(() => {
    const loadUserConfig = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${getBaseUrl()}/api/get_user_config`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data.config) {
            setConfig(data.config);
          }
        }
      } catch (err) {
        console.error('Error loading user config:', err);
      } finally {
        setLoading(false);
      }
    };

    loadUserConfig();
  }, []);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    setConfigSavedMsg('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${getBaseUrl()}/api/save_user_config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ config }),
      });
      
      if (res.ok) {
        setConfigSavedMsg('Configuration saved successfully!');
        setTimeout(() => setConfigSavedMsg(''), 3000);
        // Call the callback to update parent component's config
        if (onConfigSaved) {
          onConfigSaved(config);
        }
      } else {
        setConfigSavedMsg('Failed to save configuration');
        setTimeout(() => setConfigSavedMsg(''), 3000);
      }
    } catch (err) {
      console.error('Error saving config:', err);
      setConfigSavedMsg('Error saving configuration');
      setTimeout(() => setConfigSavedMsg(''), 3000);
    } finally {
      setSavingConfig(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        padding: '40px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#6b7280',
          fontSize: '16px',
        }}>
          <div className="spinner" style={{
            width: 20,
            height: 20,
            border: '3px solid #e5e7eb',
            borderTop: '3px solid #6366f1',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          Loading your configuration...
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: 0,
      width: '100%',
      background: '#fff',
      borderRadius: '0',
      boxShadow: 'none',
      border: 'none',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <h1 style={{ 
        color: '#111827', 
        fontSize: '24px', 
        fontWeight: 800, 
        margin: '40px 0 10px 40px', 
        letterSpacing: '0.5px', 
        textAlign: 'left' 
      }}>
        Chatbot Configuration
      </h1>
      <p style={{ 
        color: '#6b7280', 
        fontSize: '14px', 
        margin: '0 0 36px 40px', 
        textAlign: 'left', 
        maxWidth: 520 
      }}>
        </p>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '32px 36px',
        width: '100%',
        padding: '0 40px 40px 40px',
        boxSizing: 'border-box',
      }}>
        {/* Response Mode */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontWeight: 700, color: '#22223b', marginBottom: 2 }}>Response Mode</span>
          <select
            className="modern-dropdown"
            value={config.response_mode}
            onChange={e => setConfig({ ...config, response_mode: e.target.value })}
          >
            <option value="concise">Concise</option>
            <option value="detailed">Detailed</option>
          </select>
          <span style={{ color: '#9ca3af', fontSize: '12px', marginTop: 2 }}>Choose between brief or in-depth answers.</span>
        </div>

        {/* Show Source */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontWeight: 700, color: '#22223b', marginBottom: 2 }}>Show Source</span>
          <select
            className="modern-dropdown"
            value={config.show_source}
            onChange={e => setConfig({ ...config, show_source: e.target.value })}
          >
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
          <span style={{ color: '#9ca3af', fontSize: '12px', marginTop: 2 }}>Display document sources in answers.</span>
        </div>

        {/* Explanation Level */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontWeight: 700, color: '#22223b', marginBottom: 2 }}>Explanation Level</span>
          <select
            className="modern-dropdown"
            value={config.explanation_level}
            onChange={e => setConfig({ ...config, explanation_level: e.target.value })}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="expert">Expert</option>
          </select>
          <span style={{ color: '#9ca3af', fontSize: '12px', marginTop: 2 }}>Set the technical depth of explanations.</span>
        </div>

        {/* Language Tone */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontWeight: 700, color: '#22223b', marginBottom: 2 }}>Language Tone</span>
          <select
            className="modern-dropdown"
            value={config.language_tone}
            onChange={e => setConfig({ ...config, language_tone: e.target.value })}
          >
            <option value="formal">Formal</option>
            <option value="casual">Casual</option>
            <option value="neutral">Neutral</option>
          </select>
          <span style={{ color: '#9ca3af', fontSize: '12px', marginTop: 2 }}>Choose the tone for chatbot replies.</span>
        </div>

        {/* Step By Step Mode */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontWeight: 700, color: '#22223b', marginBottom: 2 }}>Step By Step Mode</span>
          <select
            className="modern-dropdown"
            value={config.step_by_step_mode}
            onChange={e => setConfig({ ...config, step_by_step_mode: e.target.value })}
          >
            <option value="On">On</option>
            <option value="Off">Off</option>
          </select>
          <span style={{ color: '#9ca3af', fontSize: '12px', marginTop: 2 }}>Enable stepwise breakdowns in answers.</span>
        </div>

        {/* Follow Up Suggestions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontWeight: 700, color: '#22223b', marginBottom: 2 }}>Follow Up Suggestions</span>
          <select
            className="modern-dropdown"
            value={config.follow_up_suggestions}
            onChange={e => setConfig({ ...config, follow_up_suggestions: e.target.value })}
          >
            <option value="Enabled">Enabled</option>
            <option value="Disable">Disable</option>
          </select>
          <span style={{ color: '#9ca3af', fontSize: '12px', marginTop: 2 }}>Show follow-up question suggestions.</span>
        </div>

        {/* Ask For Clarification */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontWeight: 700, color: '#22223b', marginBottom: 2 }}>Ask For Clarification</span>
          <select
            className="modern-dropdown"
            value={config.ask_for_clarification}
            onChange={e => setConfig({ ...config, ask_for_clarification: e.target.value })}
          >
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
          <span style={{ color: '#9ca3af', fontSize: '12px', marginTop: 2 }}>Ask for more info if the question is vague.</span>
        </div>

        {/* Chat Persona */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontWeight: 700, color: '#22223b', marginBottom: 2 }}>Chat Persona</span>
          <select
            className="modern-dropdown"
            value={config.chat_persona}
            onChange={e => setConfig({ ...config, chat_persona: e.target.value })}
          >
            <option value="Friendly">Friendly</option>
            <option value="Professional">Professional</option>
            <option value="Creative">Creative</option>
          </select>
          <span style={{ color: '#9ca3af', fontSize: '12px', marginTop: 2 }}>Set the assistant's personality style.</span>
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '24px 0 0 40px' }}>
        <button
          onClick={handleSaveConfig}
          disabled={savingConfig}
          style={{
            background: '#374151',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 32px',
            fontWeight: 700,
            fontSize: '16px',
            cursor: savingConfig ? 'not-allowed' : 'pointer',
            opacity: savingConfig ? 0.6 : 1,
            transition: 'all 0.2s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          {savingConfig && (
            <span className="spinner" style={{ 
              width: 18, 
              height: 18, 
              border: '3px solid #fff', 
              borderTop: '3px solid #6366f1', 
              borderRadius: '50%', 
              display: 'inline-block', 
              animation: 'spin 1s linear infinite' 
            }} />
          )}
          Save
        </button>
        {configSavedMsg && (
          <span style={{ 
            color: configSavedMsg.includes('saved') ? '#059669' : '#dc2626', 
            fontWeight: 600, 
            fontSize: '14px', 
            marginLeft: 10 
          }}>
            {configSavedMsg}
          </span>
        )}
      </div>
      
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        
        .modern-dropdown {
          width: 100%;
          padding: 14px 16px;
          background: #fff;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          color: #374151;
          font-size: 15px;
          font-weight: 400 !important;
          cursor: pointer;
          outline: none;
          transition: all 0.2s ease;
          appearance: none;
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
          background-position: right 12px center;
          background-repeat: no-repeat;
          background-size: 16px;
          padding-right: 40px;
        }
        
        .modern-dropdown:focus {
          border-color: #374151;
          box-shadow: 0 0 0 3px rgba(55, 65, 81, 0.1);
        }
        
        .modern-dropdown:hover {
          border-color: #9ca3af;
        }
        
        .modern-dropdown option {
          font-weight: 400 !important;
          color: #374151;
          background: #fff;
          padding: 8px 12px;
        }
      `}</style>
    </div>
  );
};

export default ConfigurationTab;
