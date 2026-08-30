'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { MoveClassification } from '../../types/review';

const MOOD_COLORS: Record<MoveClassification | 'ready' | 'thinking', string> = {
  blunder: '#e0483e',
  mistake: '#e29233',
  miss: '#e29233',
  inaccuracy: '#4c8fe0',
  good: '#d4cfc9',
  excellent: '#4caf6e',
  best: '#3fbf6a',
  great: '#3f7ce0',
  brilliant: '#2fd3c9',
  book: '#8a8a8a',
  ready: '#3d8b5c',
  thinking: '#c8a84b',
};

const CLASS_META: Record<MoveClassification | 'ready' | 'thinking', { label: string; icon: string }> = {
  blunder: { label: 'Blunder', icon: '!!' },
  mistake: { label: 'Mistake', icon: '?' },
  miss: { label: 'Miss', icon: '??' },
  inaccuracy: { label: 'Inaccuracy', icon: '?!' },
  good: { label: 'Good Move', icon: '✓' },
  excellent: { label: 'Excellent', icon: '✓' },
  best: { label: 'Best Move', icon: '★' },
  great: { label: 'Great Move', icon: '!' },
  brilliant: { label: 'Brilliant', icon: '!!' },
  book: { label: 'Book Move', icon: '📖' },
  ready: { label: 'Ready', icon: '✓' },
  thinking: { label: 'Analyzing', icon: '⏳' },
};

const MOUTH: Record<string, string> = {
  blunder: 'M90,94 Q100,86 110,94',
  mistake: 'M90,93 Q100,89 110,93',
  miss: 'M90,93 Q100,89 110,93',
  inaccuracy: 'M91,92 L109,92',
  good: 'M90,90 Q100,94 110,90',
  excellent: 'M88,89 Q100,97 112,89',
  best: 'M86,88 Q100,100 114,88',
  great: 'M87,89 Q100,98 113,89',
  brilliant: 'M86,87 Q100,101 114,87',
  ready: 'M90,90 Q100,94 110,90',
  thinking: 'M91,92 L109,92',
};

const BROW_L: Record<string, string> = {
  blunder: 'M82,74 Q90,79 98,73',
  mistake: 'M83,72 Q90,75 97,72',
  miss: 'M83,72 Q90,75 97,72',
  inaccuracy: 'M83,71 Q90,69 97,71',
  good: 'M83,70 Q90,67 97,70',
  excellent: 'M82,69 Q90,65 98,69',
  best: 'M81,68 Q90,63 99,68',
  great: 'M82,68 Q90,64 98,68',
  brilliant: 'M80,67 Q90,61 100,67',
  ready: 'M83,70 Q90,67 97,70',
  thinking: 'M83,71 Q90,69 97,71',
};

const BROW_R: Record<string, string> = {
  blunder: 'M102,73 Q110,79 118,74',
  mistake: 'M103,72 Q110,75 117,72',
  miss: 'M103,72 Q110,75 117,72',
  inaccuracy: 'M103,71 Q110,69 117,71',
  good: 'M103,70 Q110,67 117,70',
  excellent: 'M102,69 Q110,65 118,69',
  best: 'M101,68 Q110,63 119,68',
  great: 'M102,68 Q110,64 118,68',
  brilliant: 'M100,67 Q110,61 120,67',
  ready: 'M103,70 Q110,67 117,70',
  thinking: 'M103,71 Q110,69 117,71',
};

// Convert SAN notation to speakable text
export function readSan(san: string): string {
  if (!san) return san;
  const PIECE_NAMES: Record<string, string> = { K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight' };
  let s = san;
  if (s === 'O-O-O') return 'Queen-side castling';
  if (s === 'O-O') return 'King-side castling';
  s = s.replace(/[+#!?]/g, '');
  s = s.replace('x', ' takes ');
  s = s.replace(/=([QRBN])/, (_, p) => ', promoting to ' + (PIECE_NAMES[p] || p));
  const piece = PIECE_NAMES[s[0]];
  if (piece) {
    s = piece + ' ' + s.slice(1).trim();
  }
  s = s.replace(/\b([a-h])([1-8])\b/g, (_, f, r) => f.toUpperCase() + ' ' + r);
  return s;
}

interface CoachBotProps {
  mood: MoveClassification | 'ready' | 'thinking';
  message: string;
  san?: string;
  ttsEnabled: boolean;
  onWhyMistake?: () => void;
  showWhyMistake?: boolean;
}

export const CoachBot: React.FC<CoachBotProps> = ({
  mood,
  message,
  san,
  ttsEnabled,
  onWhyMistake,
  showWhyMistake = false,
}) => {
  const [displayText, setDisplayText] = useState(message);
  const [isTalking, setIsTalking] = useState(false);
  const typeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const moodColor = MOOD_COLORS[mood] || MOOD_COLORS.good;
  const meta = CLASS_META[mood] || CLASS_META.good;

  const mouthPath = MOUTH[mood] || MOUTH.good;
  const browLPath = BROW_L[mood] || BROW_L.good;
  const browRPath = BROW_R[mood] || BROW_R.good;

  // Speak text using browser SpeechSynthesis
  const speak = useCallback((text: string) => {
    if (!ttsEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const plain = text.replace(/<[^>]+>/g, '').trim();
    if (!plain) return;

    const utt = new SpeechSynthesisUtterance(plain);
    utt.rate = 1.05;
    utt.pitch = 1.0;
    utt.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferred = ['Microsoft Andrew', 'Google US English', 'Alex', 'Daniel'];
    for (const p of preferred) {
      const v = voices.find(voice => voice.name.includes(p));
      if (v) {
        utt.voice = v;
        break;
      }
    }

    utt.onstart = () => setIsTalking(true);
    utt.onend = () => setIsTalking(false);
    utt.onerror = () => setIsTalking(false);

    window.speechSynthesis.speak(utt);
  }, [ttsEnabled]);

  // Typewriter effect
  useEffect(() => {
    if (typeTimerRef.current) clearInterval(typeTimerRef.current);
    const plain = message.replace(/<[^>]+>/g, '');
    let i = 0;
    const speed = 16;

    setIsTalking(true);
    speak(san ? `${readSan(san)}. ${plain}` : plain);

    typeTimerRef.current = setInterval(() => {
      i++;
      setDisplayText(plain.slice(0, i));
      if (i >= plain.length) {
        if (typeTimerRef.current) clearInterval(typeTimerRef.current);
        setDisplayText(message);
        if (!ttsEnabled) setIsTalking(false);
      }
    }, speed);

    return () => {
      if (typeTimerRef.current) clearInterval(typeTimerRef.current);
    };
  }, [message, mood, san, speak, ttsEnabled]);

  return (
    <div className="coach-widget">
      {/* Robot Avatar */}
      <div className="coach-avatar-wrap">
        <div
          className={`coach-bot ${isTalking ? 'talking' : ''}`}
          data-mood={mood}
          style={{ '--mood': moodColor } as React.CSSProperties}
        >
          <div className="bot-glow" />
          <svg className="bot-svg" viewBox="0 0 200 200">
            <ellipse cx="100" cy="182" rx="48" ry="7" fill="rgba(0,0,0,.5)" />
            <g className="bot-body">
              <rect x="64" y="150" width="72" height="18" rx="4" className="bot-part bot-base" />
              <path d="M72,150 L74,112 Q100,100 126,112 L128,150 Z" className="bot-part bot-torso" />
              <g className="bot-head">
                <rect x="68" y="54" width="64" height="56" rx="13" className="bot-part bot-headshape" />
                <rect x="66" y="42" width="12" height="16" rx="3" className="bot-part bot-crenel" />
                <rect x="94" y="38" width="12" height="20" rx="3" className="bot-part bot-crenel" />
                <rect x="122" y="42" width="12" height="16" rx="3" className="bot-part bot-crenel" />
                <rect x="78" y="68" width="44" height="32" rx="9" className="bot-face" />
                <ellipse cx="92" cy="84" rx="5" ry="6" className="bot-eye" />
                <ellipse cx="108" cy="84" rx="5" ry="6" className="bot-eye" id="eyeR" />
                <path d={browLPath} className="bot-brow" />
                <path d={browRPath} className="bot-brow" />
                <path d={mouthPath} className="bot-mouth" />
              </g>
              <path d="M72,122 Q56,130 52,148" className="bot-part bot-arm bot-arm-l" />
              <path d="M128,122 Q144,130 148,148" className="bot-part bot-arm bot-arm-r" />
              <g className="status-badge">
                <circle cx="148" cy="66" r="14" className="badge-circle" />
                <text x="148" y="72" className="badge-icon" textAnchor="middle">
                  {meta.icon}
                </text>
              </g>
            </g>
          </svg>
        </div>
      </div>

      {/* Dialogue Bubble */}
      <div
        className="dialogue-box"
        style={{ borderLeftColor: moodColor }}
      >
        <div className="dialogue-header">
          <span className="dialogue-label" style={{ color: moodColor }}>
            {meta.label}
          </span>
          <span className="dialogue-icon" style={{ color: moodColor }}>
            {meta.icon}
          </span>
        </div>
        <p className="dialogue-text">
          {san && <span className="accent" style={{ color: moodColor }}>{san} — </span>}
          {displayText}
        </p>

        {showWhyMistake && onWhyMistake && (
          <div className="why-row">
            <button className="btn-why" onClick={onWhyMistake}>
              ⚠️ Why this is a mistake
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
