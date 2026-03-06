import { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, doc, updateDoc, where, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useTheme } from '../../contexts/ThemeContext';
import { X, Send, MessageSquare, Check, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import type { User } from 'firebase/auth';

const ADMIN_UID = '7Ldd1nNF7vcDpjxpjaOe5xx1Nrh2';
const CATEGORIES = ['bug', 'feature', 'question', 'general'] as const;
type Category = (typeof CATEGORIES)[number];

interface FeedbackItem {
  id: string;
  userId: string;
  userName: string;
  message: string;
  category: Category;
  status: 'open' | 'addressed';
  adminNote: string;
  createdAt: Timestamp | null;
}

interface FeedbackPanelProps {
  user: User;
  onClose: () => void;
}

const CATEGORY_COLORS: Record<Category, string> = {
  bug: 'bg-red-500/15 text-red-400',
  feature: 'bg-purple-500/15 text-purple-400',
  question: 'bg-blue-500/15 text-blue-400',
  general: 'bg-gray-500/15 text-gray-400',
};

const CATEGORY_COLORS_LIGHT: Record<Category, string> = {
  bug: 'bg-red-100 text-red-600',
  feature: 'bg-purple-100 text-purple-600',
  question: 'bg-blue-100 text-blue-600',
  general: 'bg-gray-100 text-gray-600',
};

export function FeedbackPanel({ user, onClose }: FeedbackPanelProps) {
  const theme = useTheme();
  const isDark = theme === 'dark';
  const isAdmin = user.uid === ADMIN_UID;

  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<Category>('general');
  const [sending, setSending] = useState(false);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<'all' | 'open' | 'addressed'>('all');

  // Subscribe to feedback collection
  useEffect(() => {
    const feedbackRef = collection(db, 'feedback');
    const q = isAdmin
      ? query(feedbackRef, orderBy('createdAt', 'desc'))
      : query(feedbackRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'));

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FeedbackItem));
      setItems(data);
    });
    return unsub;
  }, [user.uid, isAdmin]);

  const handleSubmit = useCallback(async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        userId: user.uid,
        userName: user.displayName ?? user.email?.split('@')[0] ?? 'Unknown',
        message: message.trim(),
        category,
        status: 'open',
        adminNote: '',
        createdAt: Timestamp.now(),
      });
      setMessage('');
      setCategory('general');
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    } finally {
      setSending(false);
    }
  }, [message, category, user]);

  const markAddressed = useCallback(async (itemId: string) => {
    const note = adminNotes[itemId] ?? '';
    await updateDoc(doc(db, 'feedback', itemId), {
      status: 'addressed',
      adminNote: note,
    });
    setExpandedId(null);
  }, [adminNotes]);

  const reopen = useCallback(async (itemId: string) => {
    await updateDoc(doc(db, 'feedback', itemId), { status: 'open' });
  }, []);

  const filtered = items.filter((i) => filter === 'all' || i.status === filter);
  const openCount = items.filter((i) => i.status === 'open').length;

  const formatDate = (ts: Timestamp | null) => {
    if (!ts) return '';
    const d = ts.toDate();
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className={`relative w-full max-w-md h-full flex flex-col shadow-2xl transition-colors
        ${isDark ? 'bg-[#1a1a2e]' : 'bg-white'}`}
      >
        {/* Header */}
        <div className={`shrink-0 flex items-center justify-between px-5 py-4 border-b
          ${isDark ? 'border-white/10' : 'border-gray-200'}`}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            <h2 className={`font-semibold ${isDark ? 'text-white/90' : 'text-gray-900'}`}>Feedback</h2>
            {openCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-500 text-white">{openCount}</span>
            )}
          </div>
          <button onClick={onClose} className={`cursor-pointer p-1.5 rounded-lg transition-colors
            ${isDark ? 'text-white/40 hover:text-white/70 hover:bg-white/5' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Submit form */}
        <div className={`shrink-0 px-5 py-4 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What's on your mind?"
            rows={3}
            className={`w-full rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors
              ${isDark ? 'bg-white/5 text-white/90 placeholder:text-white/25 border border-white/10' : 'bg-gray-50 text-gray-900 placeholder:text-gray-400 border border-gray-200'}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
            }}
          />
          <div className="flex items-center justify-between mt-3">
            <div className="flex gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`cursor-pointer px-2.5 py-1 text-[11px] font-medium rounded-full transition-all
                    ${category === c
                      ? isDark ? CATEGORY_COLORS[c] + ' ring-1 ring-current/30' : CATEGORY_COLORS_LIGHT[c] + ' ring-1 ring-current/30'
                      : isDark ? 'text-white/30 hover:text-white/50 bg-white/5' : 'text-gray-400 hover:text-gray-600 bg-gray-100'
                    }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <button
              onClick={handleSubmit}
              disabled={!message.trim() || sending}
              className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                bg-blue-600 text-white hover:bg-blue-500
                disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Send className="w-3 h-3" />
              Send
            </button>
          </div>
        </div>

        {/* Filter tabs (admin only) */}
        {isAdmin && (
          <div className={`shrink-0 flex gap-1 px-5 py-2 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
            {(['all', 'open', 'addressed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`cursor-pointer px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors
                  ${filter === f
                    ? isDark ? 'bg-white/10 text-white/80' : 'bg-gray-200 text-gray-900'
                    : isDark ? 'text-white/30 hover:text-white/50' : 'text-gray-400 hover:text-gray-600'
                  }`}
              >
                {f}{f === 'open' && openCount > 0 ? ` (${openCount})` : ''}
              </button>
            ))}
          </div>
        )}

        {/* Feedback list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {filtered.length === 0 && (
            <p className={`text-sm text-center py-8 ${isDark ? 'text-white/20' : 'text-gray-300'}`}>
              {items.length === 0 ? 'No feedback yet. Be the first!' : 'No items match this filter.'}
            </p>
          )}
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`rounded-lg border p-3 transition-colors
                ${item.status === 'addressed'
                  ? isDark ? 'border-white/5 bg-white/[0.02] opacity-60' : 'border-gray-100 bg-gray-50/50 opacity-60'
                  : isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'
                }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {isAdmin && (
                    <span className={`text-[10px] font-medium ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
                      {item.userName}
                    </span>
                  )}
                  <p className={`text-sm whitespace-pre-wrap break-words ${isDark ? 'text-white/80' : 'text-gray-800'}`}>
                    {item.message}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full
                    ${isDark ? CATEGORY_COLORS[item.category] : CATEGORY_COLORS_LIGHT[item.category]}`}>
                    {item.category}
                  </span>
                  {item.status === 'addressed' ? (
                    <Check className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-amber-400/60" />
                  )}
                </div>
              </div>

              <div className={`flex items-center justify-between mt-2 text-[10px] ${isDark ? 'text-white/20' : 'text-gray-300'}`}>
                <span>{formatDate(item.createdAt)}</span>
                {isAdmin && item.status === 'open' && (
                  <button
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    className={`cursor-pointer flex items-center gap-1 text-[10px] font-medium transition-colors
                      ${isDark ? 'text-blue-400/60 hover:text-blue-400' : 'text-blue-500/60 hover:text-blue-500'}`}
                  >
                    Respond {expandedId === item.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                )}
                {isAdmin && item.status === 'addressed' && (
                  <button
                    onClick={() => reopen(item.id)}
                    className={`cursor-pointer text-[10px] font-medium transition-colors
                      ${isDark ? 'text-white/20 hover:text-white/40' : 'text-gray-300 hover:text-gray-500'}`}
                  >
                    Reopen
                  </button>
                )}
              </div>

              {/* Admin note (for addressed items) */}
              {item.adminNote && item.status === 'addressed' && (
                <div className={`mt-2 px-2.5 py-2 rounded text-xs italic
                  ${isDark ? 'bg-green-500/5 text-green-400/70' : 'bg-green-50 text-green-600'}`}>
                  {item.adminNote}
                </div>
              )}

              {/* Admin response form */}
              {isAdmin && expandedId === item.id && (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={adminNotes[item.id] ?? ''}
                    onChange={(e) => setAdminNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    placeholder="Add a note (optional)..."
                    rows={2}
                    className={`w-full rounded px-2.5 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-green-500/50
                      ${isDark ? 'bg-white/5 text-white/70 placeholder:text-white/20' : 'bg-gray-50 text-gray-700 placeholder:text-gray-400'}`}
                  />
                  <button
                    onClick={() => markAddressed(item.id)}
                    className="cursor-pointer flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded
                      bg-green-600 text-white hover:bg-green-500 transition-colors"
                  >
                    <Check className="w-3 h-3" />
                    Mark Addressed
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
