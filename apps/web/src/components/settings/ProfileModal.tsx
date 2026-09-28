'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from '@/components/ui/ImageWrapper';
import { CIVIL_STATUSES, GENDERS, LANGUAGES, type AccountUser } from '@/types/settings';

interface ProfileModalProps {
  isOpen: boolean;
  user: AccountUser | null;
  submitting: boolean;
  avatarBusy: boolean;
  onClose: () => void;
  onSubmit: (input: Record<string, unknown>) => void;
  onAvatar: (file: File) => void;
  onRemoveAvatar: () => void;
}

function field(user: AccountUser | null, key: keyof AccountUser): string {
  const v = user?.[key];
  if (key === 'birthDate' && typeof v === 'string') return v.slice(0, 10);
  return typeof v === 'string' ? v : '';
}

export default function ProfileModal({
  isOpen,
  user,
  submitting,
  avatarBusy,
  onClose,
  onSubmit,
  onAvatar,
  onRemoveAvatar,
}: ProfileModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [civilStatus, setCivilStatus] = useState('');
  const [nationality, setNationality] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('Asia/Manila');
  const [currency, setCurrency] = useState('PHP');

  useEffect(() => {
    if (isOpen && user) {
      setFirstName(field(user, 'firstName'));
      setLastName(field(user, 'lastName'));
      setMiddleName(field(user, 'middleName'));
      setUsername(field(user, 'username'));
      setPhone(field(user, 'phone'));
      setGender(field(user, 'gender'));
      setCivilStatus(field(user, 'civilStatus'));
      setNationality(field(user, 'nationality'));
      setBirthDate(field(user, 'birthDate'));
      setLanguage(user.preferredLanguage || 'en');
      setTimezone(user.timezone || 'Asia/Manila');
      setCurrency(user.currency || 'PHP');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, user]);

  if (!isOpen) return null;

  const canSubmit = !submitting && firstName.trim() !== '' && lastName.trim() !== '';

  const handleSubmit = () => {
    if (!canSubmit) return;
    const opt = (v: string) => (v.trim() === '' ? null : v.trim());
    onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      middleName: opt(middleName),
      username: opt(username),
      phone: opt(phone),
      gender: gender || null,
      civilStatus: civilStatus || null,
      nationality: opt(nationality),
      birthDate: birthDate || null,
      preferredLanguage: language,
      timezone: timezone.trim() || 'Asia/Manila',
      currency: currency.trim().toUpperCase() || 'PHP',
    });
  };

  const inputCls =
    'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:bg-white';
  const labelCls = 'block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5';

  const content = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 pb-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-gray-900">Edit profile</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
              <i className="fas fa-times" />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0">
              {user?.profilePicture?.url ? (
                <Image src={user.profilePicture.url} alt="Avatar" width={64} height={64} className="object-cover w-full h-full" />
              ) : (
                <i className="fas fa-user text-gray-400 text-xl" />
              )}
            </div>
            <div className="flex gap-2">
              <label className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-[13px] font-bold text-gray-700 cursor-pointer">
                {avatarBusy ? <i className="fas fa-spinner fa-spin mr-1" /> : <i className="fas fa-camera mr-1" />}
                {user?.profilePicture ? 'Change' : 'Upload'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  className="hidden"
                  disabled={avatarBusy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onAvatar(f);
                    e.target.value = '';
                  }}
                />
              </label>
              {user?.profilePicture && (
                <button
                  type="button"
                  onClick={onRemoveAvatar}
                  disabled={avatarBusy}
                  className="px-3.5 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-[13px] font-bold disabled:opacity-60"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>First name *</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Last name *</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Middle name</label>
              <input value={middleName} onChange={(e) => setMiddleName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Username</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Birth date</label>
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Gender</label>
              <select value={gender} onChange={(e) => setGender(e.target.value)} className={inputCls}>
                <option value="">Select…</option>
                {GENDERS.map((g) => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Civil status</label>
              <select value={civilStatus} onChange={(e) => setCivilStatus(e.target.value)} className={inputCls}>
                <option value="">Select…</option>
                {CIVIL_STATUSES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Nationality</label>
              <input value={nationality} onChange={(e) => setNationality(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Language</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className={inputCls}>
                {LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Timezone</label>
              <input value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <input value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 py-2.5 text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#239459' }}
          >
            {submitting ? <i className="fas fa-spinner fa-spin mr-2" /> : <i className="fas fa-save mr-2" />}
            Save changes
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
