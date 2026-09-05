import React, { useState, useEffect } from 'react';
import { X, User, Palette, Network, Users, ShieldCheck, KeyRound, Check, AlertCircle, Trash2, Plus, LogOut, RotateCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme, ThemeMode } from '../../context/ThemeContext';
import { TwoFactorModal } from './TwoFactorModal';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'profile' | 'theme' | 'npm' | 'users';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, initialTab = 'profile' }) => {
  if (!isOpen) return null;

  const { user, refreshUser, logout } = useAuth();
  const { themeMode, setThemeMode } = useTheme();

  const [activeTab, setActiveTab] = useState<'profile' | 'theme' | 'npm' | 'users'>(initialTab);
  const [is2faModalOpen, setIs2faModalOpen] = useState(false);

  // Profile Form State
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  // NPM Integration Form State
  const [npmHost, setNpmHost] = useState(user?.preferences?.npmEndpoint || '');
  const [npmUser, setNpmUser] = useState(user?.preferences?.npmIdentity || '');
  const [npmPass, setNpmPass] = useState('');
  const [npmTestResult, setNpmTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTestingNpm, setIsTestingNpm] = useState(false);
  const [isSyncingNpm, setIsSyncingNpm] = useState(false);
  const [isResettingNpm, setIsResettingNpm] = useState(false);

  useEffect(() => {
    if (user?.preferences?.npmEndpoint !== undefined) {
      setNpmHost(user.preferences.npmEndpoint || '');
    }
    if (user?.preferences?.npmIdentity !== undefined) {
      setNpmUser(user.preferences.npmIdentity || '');
    }
  }, [user?.preferences?.npmEndpoint, user?.preferences?.npmIdentity]);

  // User Management State (Admin only)
  const [usersList, setUsersList] = useState<any[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user');
  const [userMgmtMessage, setUserMgmtMessage] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'users' && user?.role === 'admin') {
      fetchUsers();
    }
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/v1/users', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUsersList(data.users || []);
      }
    } catch {}
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);
    try {
      const res = await fetch('/api/v1/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ displayName, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');
      await refreshUser();
      setProfileMessage('Profile updated successfully');
    } catch (err: any) {
      setProfileMessage(`Error: ${err.message}`);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);
    try {
      const res = await fetch('/api/v1/users/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');
      setCurrentPassword('');
      setNewPassword('');
      setProfileMessage('Password changed successfully');
    } catch (err: any) {
      setProfileMessage(`Error: ${err.message}`);
    }
  };

  const handleTestNpm = async () => {
    setIsTestingNpm(true);
    setNpmTestResult(null);
    try {
      const res = await fetch('/api/v1/npm/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ host: npmHost, identity: npmUser, secret: npmPass }),
      });
      const data = await res.json();
      setNpmTestResult(data);
    } catch (err: any) {
      setNpmTestResult({ success: false, message: err.message });
    } finally {
      setIsTestingNpm(false);
    }
  };

  const handleSaveAndSyncNpm = async () => {
    setIsSyncingNpm(true);
    setNpmTestResult(null);
    try {
      await fetch('/api/v1/users/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ npmEndpoint: npmHost, npmIdentity: npmUser }),
      });

      const res = await fetch('/api/v1/npm/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ host: npmHost, identity: npmUser, secret: npmPass }),
      });
      const data = await res.json();
      if (data.status === 'connected') {
        setNpmTestResult({ success: true, message: `Successfully connected! Synchronized ${data.hostCount} hosts from NPM.` });
        await refreshUser();
        window.dispatchEvent(new Event('gatekeeper:sync-success'));
      } else {
        setNpmTestResult({ success: false, message: data.message || 'Synchronization failed' });
      }
    } catch (err: any) {
      setNpmTestResult({ success: false, message: err.message });
    } finally {
      setIsSyncingNpm(false);
    }
  };

  const handleResetNpm = async () => {
    if (!confirm('Are you sure you want to clear your saved Nginx Proxy Manager configuration?')) return;
    setIsResettingNpm(true);
    setNpmTestResult(null);
    try {
      const res = await fetch('/api/v1/npm/reset', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setNpmHost('');
        setNpmUser('');
        setNpmPass('');
        setNpmTestResult({ success: true, message: 'NPM connection settings cleared.' });
        await refreshUser();
        window.dispatchEvent(new Event('gatekeeper:sync-success'));
      }
    } catch (err: any) {
      setNpmTestResult({ success: false, message: `Failed to reset: ${err.message}` });
    } finally {
      setIsResettingNpm(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserMgmtMessage(null);
    try {
      const res = await fetch('/api/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: newUsername,
          email: newUserEmail,
          password: newUserPass,
          role: newUserRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      setNewUsername('');
      setNewUserEmail('');
      setNewUserPass('');
      setUserMgmtMessage('User created successfully');
      fetchUsers();
    } catch (err: any) {
      setUserMgmtMessage(`Error: ${err.message}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      const res = await fetch(`/api/v1/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch {}
  };

  const hasSavedSecret = Boolean(user?.preferences?.hasSavedNpmSecret);
  const canAuthenticateNpm = Boolean(npmHost.trim() && npmUser.trim() && (npmPass.trim() || hasSavedSecret));

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-surface-dark border border-border-subtle rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle shrink-0">
            <h2 className="text-lg font-bold text-text-primary">System & Profile Settings</h2>
            <button onClick={onClose} className="text-text-muted hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center px-6 border-b border-border-subtle/60 gap-4 text-xs font-semibold text-text-secondary shrink-0 overflow-x-auto">
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-3 flex items-center gap-1.5 border-b-2 transition-all ${
                activeTab === 'profile' ? 'border-accent-primary text-text-primary font-bold' : 'border-transparent hover:text-white'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Profile & Security</span>
            </button>
            <button
              onClick={() => setActiveTab('theme')}
              className={`py-3 flex items-center gap-1.5 border-b-2 transition-all ${
                activeTab === 'theme' ? 'border-accent-primary text-text-primary font-bold' : 'border-transparent hover:text-white'
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>Appearance & Themes</span>
            </button>
            <button
              onClick={() => setActiveTab('npm')}
              className={`py-3 flex items-center gap-1.5 border-b-2 transition-all ${
                activeTab === 'npm' ? 'border-accent-primary text-text-primary font-bold' : 'border-transparent hover:text-white'
              }`}
            >
              <Network className="w-4 h-4" />
              <span>NPM Integration</span>
            </button>
            {user?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('users')}
                className={`py-3 flex items-center gap-1.5 border-b-2 transition-all ${
                  activeTab === 'users' ? 'border-accent-primary text-text-primary font-bold' : 'border-transparent hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>User Accounts</span>
              </button>
            )}
          </div>

          {/* Tab Content Body */}
          <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
            {/* Tab 1: Profile & Security */}
            {activeTab === 'profile' && (
              <div className="flex flex-col gap-6">
                {profileMessage && (
                  <div className="p-3 bg-card-dark border border-border-subtle rounded-xl text-xs text-white">
                    {profileMessage}
                  </div>
                )}

                {/* Profile Details */}
                <form onSubmit={handleSaveProfile} className="bg-card-dark p-4 rounded-xl border border-border-subtle flex flex-col gap-4">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-accent-primary" />
                    <span>Personal Profile</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-text-muted block mb-1">Display Name</label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-dark border border-border-subtle rounded-xl text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted block mb-1">Email Address</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-dark border border-border-subtle rounded-xl text-xs text-white"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="self-end px-4 py-1.5 bg-accent-primary hover:bg-accent-hover text-white text-xs font-semibold rounded-xl"
                  >
                    Save Profile
                  </button>
                </form>

                {/* 2FA Status Card */}
                <div className="bg-card-dark p-4 rounded-xl border border-border-subtle flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className={`w-6 h-6 ${user?.totpEnabled ? 'text-status-healthy' : 'text-text-muted'}`} />
                    <div>
                      <h4 className="text-sm font-bold text-white">Two-Factor Authentication</h4>
                      <p className="text-xs text-text-secondary">
                        {user?.totpEnabled ? 'Enabled and protecting your login' : 'Enhance security with an authenticator app'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIs2faModalOpen(true)}
                    className="px-4 py-2 bg-surface-dark hover:bg-surface-dark/80 border border-border-subtle text-xs font-semibold text-white rounded-xl"
                  >
                    {user?.totpEnabled ? 'Manage 2FA' : 'Enroll 2FA'}
                  </button>
                </div>

                {/* Password Change */}
                <form onSubmit={handleChangePassword} className="bg-card-dark p-4 rounded-xl border border-border-subtle flex flex-col gap-4">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-accent-primary" />
                    <span>Change Password</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-text-muted block mb-1">Current Password</label>
                      <input
                        type="password"
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-dark border border-border-subtle rounded-xl text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted block mb-1">New Password (min 8 chars)</label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-dark border border-border-subtle rounded-xl text-xs text-white"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="self-end px-4 py-1.5 bg-accent-primary hover:bg-accent-hover text-white text-xs font-semibold rounded-xl"
                  >
                    Update Password
                  </button>
                </form>

                {/* Session Sign Out */}
                <div className="bg-card-dark p-4 rounded-xl border border-status-critical/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-status-critical/10 flex items-center justify-center text-status-critical">
                      <LogOut className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Log Out of Gatekeeper</h4>
                      <p className="text-xs text-text-secondary">
                        Terminate your session on this browser
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      logout();
                    }}
                    className="px-4 py-2 bg-status-critical hover:bg-status-critical/80 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: Theme & Appearance */}
            {activeTab === 'theme' && (
              <div className="flex flex-col gap-4">
                <h4 className="text-sm font-bold text-white">Visual Design System</h4>
                <p className="text-xs text-text-secondary">
                  Choose your interface appearance. The Indigo Slate dark mode is inspired by modern operations centers.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setThemeMode('dark')}
                    className={`p-4 rounded-xl border text-left flex flex-col gap-2 transition-all ${
                      themeMode === 'dark' ? 'border-accent-primary bg-card-dark ring-2 ring-accent-primary/20' : 'border-border-subtle bg-surface-dark'
                    }`}
                  >
                    <div className="w-full h-8 rounded-lg bg-[#14152c] border border-[#2f3366] flex items-center px-2">
                      <div className="w-3 h-3 rounded-full bg-[#5364f0]" />
                    </div>
                    <span className="text-xs font-bold text-text-primary">Indigo Slate</span>
                    <span className="text-[10px] text-text-muted">Default rich dark mode</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setThemeMode('light')}
                    className={`p-4 rounded-xl border text-left flex flex-col gap-2 transition-all ${
                      themeMode === 'light' ? 'border-accent-primary bg-card-dark ring-2 ring-accent-primary/20' : 'border-border-subtle bg-surface-dark'
                    }`}
                  >
                    <div className="w-full h-8 rounded-lg bg-[#f4f5fa] border border-[#dce1f0] flex items-center px-2">
                      <div className="w-3 h-3 rounded-full bg-[#5364f0]" />
                    </div>
                    <span className="text-xs font-bold text-text-primary">Slate Breeze</span>
                    <span className="text-[10px] text-text-muted">Clean high-contrast light mode</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setThemeMode('system')}
                    className={`p-4 rounded-xl border text-left flex flex-col gap-2 transition-all ${
                      themeMode === 'system' ? 'border-accent-primary bg-card-dark ring-2 ring-accent-primary/20' : 'border-border-subtle bg-surface-dark'
                    }`}
                  >
                    <div className="w-full h-8 rounded-lg bg-gradient-to-r from-[#14152c] to-[#f4f5fa] border border-border-subtle flex items-center px-2">
                      <div className="w-3 h-3 rounded-full bg-[#5364f0]" />
                    </div>
                    <span className="text-xs font-bold text-text-primary">Follow System</span>
                    <span className="text-[10px] text-text-muted">Sync with OS color preference</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tab 3: NPM Integration */}
            {activeTab === 'npm' && (
              <div className="flex flex-col gap-4">
                <h4 className="text-sm font-bold text-white">Nginx Proxy Manager Upstream</h4>
                <p className="text-xs text-text-secondary">
                  Connect to your local or remote NPM instance to autonomously synchronize all proxy hosts and SSL certificates.
                </p>

                {npmTestResult && (
                  <div
                    className={`p-3.5 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 border ${
                      npmTestResult.success
                        ? 'bg-status-healthy/10 text-status-healthy border-status-healthy/30'
                        : 'bg-status-critical/10 text-status-critical border-status-critical/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {npmTestResult.success ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                      <span className="font-medium leading-relaxed">{npmTestResult.message}</span>
                    </div>
                    {npmTestResult.success && !npmTestResult.message.includes('Synchronized') && (
                      <button
                        type="button"
                        onClick={handleSaveAndSyncNpm}
                        disabled={isSyncingNpm}
                        className="self-start sm:self-auto px-3.5 py-1.5 bg-status-healthy hover:bg-status-healthy/90 text-white font-bold rounded-lg shadow-md transition-all shrink-0 flex items-center gap-1"
                      >
                        <span>{isSyncingNpm ? 'Importing...' : 'Import Hosts Now'}</span>
                      </button>
                    )}
                  </div>
                )}

                <div className="bg-card-dark p-4 rounded-xl border border-border-subtle flex flex-col gap-3">
                  <div>
                    <label className="text-xs text-text-muted block mb-1">NPM API Endpoint URL</label>
                    <input
                      type="text"
                      value={npmHost}
                      onChange={(e) => setNpmHost(e.target.value)}
                      placeholder="http://host.docker.internal:81"
                      className="w-full px-3 py-2 bg-surface-dark border border-border-subtle rounded-xl text-xs text-white font-mono"
                    />
                    <span className="text-[11px] text-text-secondary block mt-1.5 leading-relaxed bg-surface-dark/60 p-2.5 rounded-lg border border-border-subtle/40">
                      💡 <strong>Container Networking Tip:</strong> If Nginx Proxy Manager is running on the same host machine (accessible at <code className="text-accent-hover font-mono">http://localhost:81</code> in your host browser), enter <code className="text-accent-hover font-mono font-bold">http://host.docker.internal:81</code> or your local LAN IP (e.g. <code className="text-accent-hover font-mono">http://192.168.x.x:81</code>) here so the Docker container can route to the host machine.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-text-muted block mb-1">Admin Email / Username</label>
                      <input
                        type="text"
                        value={npmUser}
                        onChange={(e) => setNpmUser(e.target.value)}
                        placeholder="admin@example.com"
                        className="w-full px-3 py-2 bg-surface-dark border border-border-subtle rounded-xl text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted block mb-1">Password / API Secret</label>
                      <input
                        type="password"
                        value={npmPass}
                        onChange={(e) => setNpmPass(e.target.value)}
                        placeholder={hasSavedSecret ? '•••••••••••• (saved)' : 'Enter NPM password'}
                        className="w-full px-3 py-2 bg-surface-dark border border-border-subtle rounded-xl text-xs text-white font-mono"
                      />
                      {hasSavedSecret ? (
                        <span className="text-[11px] text-status-healthy flex items-center gap-1 mt-1 font-medium">
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          <span>Password saved in database. Leave blank to keep existing, or type new password.</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-amber-400 flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Password required to authenticate with NPM.</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-3 pt-3 border-t border-border-subtle/50">
                    <button
                      type="button"
                      onClick={handleResetNpm}
                      disabled={isResettingNpm || isTestingNpm || isSyncingNpm || (!npmHost && !npmUser && !hasSavedSecret)}
                      className="px-3 py-2 bg-surface-dark hover:bg-status-critical/10 hover:text-status-critical hover:border-status-critical/30 border border-border-subtle rounded-xl text-xs font-semibold text-text-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
                      title="Clear saved NPM host, identity, and password"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isResettingNpm ? 'animate-spin' : ''}`} />
                      <span>{isResettingNpm ? 'Clearing...' : 'Clear Settings'}</span>
                    </button>

                    <div className="flex items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={handleTestNpm}
                        disabled={isTestingNpm || isSyncingNpm || !canAuthenticateNpm}
                        className="px-4 py-2 bg-surface-dark hover:bg-card-dark-hover border border-border-subtle rounded-xl text-xs font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {isTestingNpm ? 'Testing...' : 'Test Connection'}
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveAndSyncNpm}
                        disabled={isSyncingNpm || isTestingNpm || !canAuthenticateNpm}
                        className="px-5 py-2 bg-accent-primary hover:bg-accent-hover text-white text-xs font-semibold rounded-xl shadow-md shadow-accent-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                      >
                        <span>{isSyncingNpm ? 'Synchronizing...' : 'Save & Sync Hosts'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: User Management (Admin Only) */}
            {activeTab === 'users' && user?.role === 'admin' && (
              <div className="flex flex-col gap-6">
                {userMgmtMessage && (
                  <div className="p-3 bg-card-dark border border-border-subtle rounded-xl text-xs text-white">
                    {userMgmtMessage}
                  </div>
                )}

                {/* Create New User */}
                <form onSubmit={handleCreateUser} className="bg-card-dark p-4 rounded-xl border border-border-subtle flex flex-col gap-3">
                  <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    <Plus className="w-4 h-4 text-accent-primary" />
                    <span>Create User Account</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Username"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="px-3 py-2 bg-surface-dark border border-border-subtle rounded-xl text-xs text-text-primary"
                    />
                    <input
                      type="email"
                      required
                      placeholder="Email Address"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      className="px-3 py-2 bg-surface-dark border border-border-subtle rounded-xl text-xs text-text-primary"
                    />
                    <input
                      type="password"
                      required
                      placeholder="Password (min 8 chars)"
                      value={newUserPass}
                      onChange={(e) => setNewUserPass(e.target.value)}
                      className="px-3 py-2 bg-surface-dark border border-border-subtle rounded-xl text-xs text-text-primary"
                    />
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as any)}
                      className="px-3 py-2 bg-surface-dark border border-border-subtle rounded-xl text-xs text-text-primary"
                    >
                      <option value="user">Standard User</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="self-end px-4 py-1.5 bg-accent-primary hover:bg-accent-hover text-white text-xs font-semibold rounded-xl"
                  >
                    Add User
                  </button>
                </form>

                {/* Users List */}
                <div className="flex flex-col gap-2">
                  <h4 className="text-xs font-bold text-text-muted uppercase">Existing Accounts ({usersList.length})</h4>
                  <div className="bg-card-dark rounded-xl border border-border-subtle divide-y divide-border-subtle/50 overflow-hidden">
                    {usersList.map((u) => (
                      <div key={u.id} className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-surface-dark border border-border-subtle flex items-center justify-center font-bold text-xs text-text-primary">
                            {u.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-text-primary flex items-center gap-2">
                              <span>{u.displayName || u.username}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-primary/20 text-accent-hover font-normal">
                                {u.role}
                              </span>
                            </div>
                            <div className="text-[11px] text-text-muted">{u.email}</div>
                          </div>
                        </div>

                        {u.id !== user.id && (
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="text-text-muted hover:text-status-critical p-1.5 transition-colors"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <TwoFactorModal isOpen={is2faModalOpen} onClose={() => setIs2faModalOpen(false)} />
    </>
  );
};
