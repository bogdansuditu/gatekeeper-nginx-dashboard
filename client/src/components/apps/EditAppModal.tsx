import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { AppItem } from '../../types';

interface EditAppModalProps {
  app: AppItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (appId: string, customTitle: string, customDescription: string) => Promise<void>;
}

export const EditAppModal: React.FC<EditAppModalProps> = ({ app, isOpen, onClose, onSave }) => {
  if (!isOpen || !app) return null;

  const [title, setTitle] = useState(app.customTitle || app.domainName.split('.')[0]);
  const [description, setDescription] = useState(app.customDescription || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(app.id, title, description);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-dark border border-border-subtle rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <h3 className="text-base font-bold text-text-primary">Edit Application Card</h3>
          <button onClick={onClose} className="text-text-muted hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1.5">
              Domain / Upstream Route
            </label>
            <input
              type="text"
              disabled
              value={app.domainName}
              className="w-full px-3.5 py-2 bg-card-dark/50 border border-border-subtle rounded-xl text-sm text-text-muted cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1.5">
              Display Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Nextcloud Hub"
              className="w-full px-3.5 py-2 bg-card-dark border border-border-subtle rounded-xl text-sm text-text-primary focus:outline-none focus:border-border-focus transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1.5">
              Custom Subtitle / Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Personal cloud storage and file synchronization"
              className="w-full px-3.5 py-2 bg-card-dark border border-border-subtle rounded-xl text-sm text-text-primary focus:outline-none focus:border-border-focus transition-colors resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 mt-2 pt-4 border-t border-border-subtle/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-card-dark hover:bg-card-dark-hover border border-border-subtle rounded-xl text-xs font-semibold text-text-secondary hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2 bg-accent-primary hover:bg-accent-hover text-white text-xs font-semibold rounded-xl shadow-md shadow-accent-primary/25 transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
