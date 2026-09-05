import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Copy, Check, Download, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface TwoFactorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TwoFactorModal: React.FC<TwoFactorModalProps> = ({ isOpen, onClose }) => {
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState<'status' | 'setup' | 'backup'>('status');
  const [setupData, setSetupData] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disablePassword, setDisablePassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setStep(user?.totpEnabled ? 'status' : 'setup');
      if (!user?.totpEnabled) {
        initiateSetup();
      }
    }
  }, [isOpen, user?.totpEnabled]);

  const initiateSetup = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/auth/2fa/setup', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initialize 2FA setup');
      setSetupData(data);
      setStep('setup');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: verifyCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid verification code');

      setBackupCodes(data.backupCodes || []);
      await refreshUser();
      setStep('backup');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: disablePassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to disable 2FA');

      await refreshUser();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const copySecret = () => {
    if (setupData?.secret) {
      navigator.clipboard.writeText(setupData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadBackupCodes = () => {
    const text = `Gatekeeper Dashboard Emergency Backup Codes\nGenerated: ${new Date().toISOString()}\n\n` +
      backupCodes.map((c, i) => `${i + 1}. ${c}`).join('\n') +
      '\n\nKeep these codes in a secure password manager or offline safe. Each code can only be used once.';
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gatekeeper-backup-codes-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-dark border border-border-subtle rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-accent-primary" />
            <h3 className="text-base font-bold text-text-primary">Two-Factor Authentication (TOTP)</h3>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-status-critical/15 border border-status-critical/30 rounded-xl text-xs text-status-critical flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* State 1: 2FA Already Active */}
          {step === 'status' && user?.totpEnabled && (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-status-healthy/10 border border-status-healthy/30 rounded-xl flex items-center gap-3">
                <ShieldCheck className="w-8 h-8 text-status-healthy shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-text-primary">2FA is currently active</h4>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Your account requires a 6-digit TOTP code during authentication.
                  </p>
                </div>
              </div>

              <form onSubmit={handleDisable} className="mt-4 pt-4 border-t border-border-subtle flex flex-col gap-3">
                <span className="text-xs font-semibold text-text-muted">Disable Two-Factor Authentication</span>
                <input
                  type="password"
                  required
                  placeholder="Enter your current account password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  className="w-full px-3.5 py-2 bg-card-dark border border-border-subtle rounded-xl text-sm text-text-primary focus:outline-none focus:border-border-focus"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2 bg-status-critical/20 hover:bg-status-critical/30 text-status-critical font-semibold rounded-xl text-xs transition-colors border border-status-critical/30"
                >
                  {isLoading ? 'Disabling...' : 'Confirm & Disable 2FA'}
                </button>
              </form>
            </div>
          )}

          {/* State 2: 2FA Setup Flow */}
          {step === 'setup' && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-text-secondary leading-relaxed">
                Scan the QR code below using your preferred authenticator app (Google Authenticator, Authy, 1Password, Bitwarden).
              </p>

              {setupData ? (
                <div className="flex flex-col sm:flex-row items-center gap-6 bg-card-dark p-4 rounded-xl border border-border-subtle">
                  <div className="bg-white p-2 rounded-lg shrink-0 shadow-md">
                    <img src={setupData.qrCodeDataUrl} alt="2FA QR Code" className="w-36 h-36" />
                  </div>

                  <div className="flex flex-col gap-2 min-w-0 w-full">
                    <span className="text-[11px] font-semibold text-text-muted uppercase">Manual Secret Key:</span>
                    <div className="flex items-center gap-2 bg-surface-dark border border-border-subtle px-3 py-2 rounded-lg text-xs font-mono text-white select-all overflow-x-auto">
                      <span className="truncate">{setupData.secret}</span>
                      <button
                        type="button"
                        onClick={copySecret}
                        className="text-text-muted hover:text-white p-1 ml-auto"
                        title="Copy Secret"
                      >
                        {copied ? <Check className="w-4 h-4 text-status-healthy" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-text-muted text-xs">
                  Generating secure secret...
                </div>
              )}

              <form onSubmit={handleVerify} className="mt-2 flex flex-col gap-3">
                <label className="text-xs font-semibold text-text-primary">
                  Enter 6-digit confirmation code from authenticator:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-2.5 bg-card-dark border border-border-subtle rounded-xl text-center text-lg font-mono font-bold tracking-widest text-text-primary focus:outline-none focus:border-border-focus"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || verifyCode.length !== 6}
                    className="px-6 bg-accent-primary hover:bg-accent-hover text-white text-xs font-semibold rounded-xl shadow-md shadow-accent-primary/20 transition-all disabled:opacity-50"
                  >
                    {isLoading ? 'Verifying...' : 'Activate'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* State 3: Backup Codes Generated */}
          {step === 'backup' && (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-status-healthy/15 border border-status-healthy/30 rounded-xl text-xs text-status-healthy flex items-center gap-2">
                <Check className="w-5 h-5 shrink-0" />
                <span className="font-bold">Two-Factor Authentication is now enabled!</span>
              </div>

              <p className="text-xs text-text-secondary leading-relaxed">
                Save these emergency recovery codes in a safe place. If you ever lose access to your authenticator app, each code can be used once to log in.
              </p>

              <div className="grid grid-cols-2 gap-2 bg-card-dark p-4 rounded-xl border border-border-subtle font-mono text-xs text-center text-white">
                {backupCodes.map((code, idx) => (
                  <div key={idx} className="bg-surface-dark border border-border-subtle py-1.5 rounded-lg select-all">
                    {code}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 mt-2">
                <button
                  type="button"
                  onClick={downloadBackupCodes}
                  className="flex items-center gap-2 px-4 py-2 bg-card-dark hover:bg-card-dark-hover border border-border-subtle rounded-xl text-xs font-semibold text-white transition-colors"
                >
                  <Download className="w-4 h-4 text-accent-primary" />
                  <span>Download Codes (.txt)</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 bg-accent-primary hover:bg-accent-hover text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-accent-primary/20"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
