import { useState, useEffect } from 'react';
import { personalityAPI } from '../../services/api';

const TRAIT_LABELS = {
    openness: 'Openness',
    conscientiousness: 'Conscientiousness',
    extraversion: 'Extraversion',
    agreeableness: 'Agreeableness',
    neuroticism: 'Neuroticism',
};

function initials(name) {
    return (name || '?')
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join('');
}

function BackArrow() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
    );
}

function BigFiveBar({ label, value }) {
    return (
        <div className="big-five-row">
            <div className="big-five-label">{label}</div>
            <div className="big-five-bar-bg">
                <div className="big-five-bar" style={{ width: `${Math.round(value * 100)}%` }} />
            </div>
            <div className="big-five-val">{Math.round(value * 100)}</div>
        </div>
    );
}

function ProfileCard({ profile, onClick }) {
    const cs = profile.personality?.communicationStyle;
    return (
        <div className="profile-card" onClick={() => onClick(profile.username)}>
            <div className="profile-card-top">
                <div className="profile-avatar">{initials(profile.displayName)}</div>
                <div>
                    <div className="profile-name">{profile.displayName}</div>
                    <div className="profile-username">@{profile.username}</div>
                    {profile.email && <div className="profile-email">{profile.email}</div>}
                </div>
            </div>
            {cs && (
                <div className="profile-tags">
                    <span className="badge badge-indigo">{cs.tone}</span>
                    <span className="badge badge-gray">{cs.verbosity}</span>
                    <span className="badge badge-gray">{cs.directness}</span>
                </div>
            )}
            <div className="profile-stat-row">
                <span>{profile.dataSummary?.totalMessages?.toLocaleString() || '—'} messages</span>
                <span>{profile.analyzedAt ? new Date(profile.analyzedAt).toLocaleDateString() : ''}</span>
            </div>
        </div>
    );
}

function ProfileDetail({ profile, onBack }) {
    const { personality: p, llmContext: c, dataSummary: d } = profile;
    const cs = p?.communicationStyle;
    const wb = p?.workBehavior;
    const t = p?.personalityTraits;
    const bf = t?.bigFive;

    return (
        <div>
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                <button className="back-btn" onClick={onBack}><BackArrow /> All Profiles</button>
                <div style={{ flex: 1 }} />
                <span className="badge badge-green">
                    Analyzed {new Date(profile.analyzedAt).toLocaleDateString()}
                </span>
            </div>

            {/* Hero */}
            <div className="card" style={{ marginBottom: 16, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div className="profile-avatar" style={{ width: 56, height: 56, fontSize: 20 }}>
                        {initials(profile.displayName)}
                    </div>
                    <div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.5px' }}>
                            {profile.displayName}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-3)' }}>@{profile.username}</div>
                        {profile.email && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{profile.email}</div>}
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                        {cs && <>
                            <span className="badge badge-indigo">{cs.tone}</span>
                            <span className="badge badge-gray">MBTI: {t?.mbtiTendency}</span>
                        </>}
                    </div>
                </div>
                {c?.personaSummary && (
                    <div className="persona-box" style={{ marginTop: 16 }}>
                        "{c.personaSummary}"
                    </div>
                )}
            </div>

            <div className="profile-detail">
                {/* Data Summary */}
                <div className="detail-section">
                    <div className="section-header">📊 Activity Summary</div>
                    <div className="section-body">
                        <div className="kv-row"><span className="kv-key">Total messages</span><span className="kv-val">{d?.totalMessages?.toLocaleString()}</span></div>
                        <div className="kv-row"><span className="kv-key">Most active day</span><span className="kv-val">{d?.mostActiveDay || '—'}</span></div>
                        <div className="kv-row"><span className="kv-key">Most active hour</span><span className="kv-val">{d?.mostActiveHour != null ? `${d.mostActiveHour}:00` : '—'}</span></div>
                        <div className="kv-row"><span className="kv-key">Avg msg length</span><span className="kv-val">{d?.avgMessageLength} chars</span></div>
                        <div className="kv-row"><span className="kv-key">Reply ratio</span><span className="kv-val">{d?.replyRatio}%</span></div>
                        <div className="kv-row"><span className="kv-key">File share ratio</span><span className="kv-val">{d?.fileShareRatio}%</span></div>
                        {d?.topChannels?.length > 0 && (
                            <div className="kv-row" style={{ alignItems: 'flex-start' }}>
                                <span className="kv-key">Top channels</span>
                                <span className="kv-val" style={{ fontSize: 11 }}>{d.topChannels.slice(0, 3).join(', ')}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Communication Style */}
                <div className="detail-section">
                    <div className="section-header">💬 Communication Style</div>
                    <div className="section-body">
                        {cs && <>
                            <div className="kv-row"><span className="kv-key">Tone</span><span className="kv-val"><span className="badge badge-indigo">{cs.tone}</span></span></div>
                            <div className="kv-row"><span className="kv-key">Directness</span><span className="kv-val">{cs.directness}</span></div>
                            <div className="kv-row"><span className="kv-key">Verbosity</span><span className="kv-val">{cs.verbosity}</span></div>
                            <div className="kv-row"><span className="kv-key">Emoji usage</span><span className="kv-val">{cs.emojiUsage}</span></div>
                            <div className="kv-row"><span className="kv-key">Humor level</span><span className="kv-val">{cs.humorLevel}</span></div>
                            <div className="kv-row"><span className="kv-key">Formality</span>
                                <span className="kv-val">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <div style={{ width: 60, height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${cs.languageFormality * 100}%`, background: 'var(--accent)', borderRadius: 3 }} />
                                        </div>
                                        {(cs.languageFormality * 100).toFixed(0)}%
                                    </div>
                                </span>
                            </div>
                            <div className="kv-row"><span className="kv-key">Format preference</span><span className="kv-val">{cs.preferredFormat}</span></div>
                        </>}
                    </div>
                </div>

                {/* Big Five */}
                <div className="detail-section">
                    <div className="section-header">🧠 Big Five Personality</div>
                    <div className="section-body">
                        {bf && Object.entries(TRAIT_LABELS).map(([k, label]) => (
                            <BigFiveBar key={k} label={label} value={bf[k] ?? 0.5} />
                        ))}
                        {t && (
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                                <div className="kv-row"><span className="kv-key">MBTI tendency</span><span className="kv-val"><strong>{t.mbtiTendency}</strong></span></div>
                                <div className="kv-row"><span className="kv-key">MBTI confidence</span><span className="kv-val">{t.mbtiConfidence}</span></div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Work Behavior */}
                <div className="detail-section">
                    <div className="section-header">⚙️ Work Behavior</div>
                    <div className="section-body">
                        {wb && <>
                            <div className="kv-row"><span className="kv-key">Collaboration</span><span className="kv-val">{wb.collaborationStyle}</span></div>
                            <div className="kv-row"><span className="kv-key">Problem solving</span><span className="kv-val">{wb.problemSolving}</span></div>
                            <div className="kv-row"><span className="kv-key">Response pattern</span><span className="kv-val">{wb.responsePattern}</span></div>
                            <div className="kv-row"><span className="kv-key">Initiative level</span><span className="kv-val">{wb.initiativeLevel}</span></div>
                            <div className="kv-row"><span className="kv-key">Q-asking freq</span><span className="kv-val">{wb.questionAskingFrequency}</span></div>
                            {wb.activeTimeSlots?.length > 0 && (
                                <div className="kv-row"><span className="kv-key">Active slots</span><span className="kv-val">{wb.activeTimeSlots.join(', ')}</span></div>
                            )}
                        </>}
                    </div>
                </div>

                {/* Key adjectives & strengths */}
                {t && (
                    <div className="detail-section">
                        <div className="section-header">✨ Traits & Strengths</div>
                        <div className="section-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {t.keyAdjectives?.length > 0 && (
                                <div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }}>Key adjectives</div>
                                    <div className="tags-list">
                                        {t.keyAdjectives.map((a, i) => <span key={i} className="tag accent">{a}</span>)}
                                    </div>
                                </div>
                            )}
                            {t.strengths?.length > 0 && (
                                <div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }}>Strengths</div>
                                    <div className="tags-list">
                                        {t.strengths.map((s, i) => <span key={i} className="tag">{s}</span>)}
                                    </div>
                                </div>
                            )}
                            {t.potentialFrictionPoints?.length > 0 && (
                                <div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }}>Watch out for</div>
                                    <div className="tags-list">
                                        {t.potentialFrictionPoints.map((s, i) => <span key={i} className="tag" style={{ background: 'var(--warning-light)', color: 'var(--warning)', border: 'none' }}>{s}</span>)}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* LLM Context */}
                {c && (
                    <div className="detail-section">
                        <div className="section-header">🤖 LLM Interaction Guide</div>
                        <div className="section-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {c.interactionGuide && (
                                <div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }}>How to interact</div>
                                    <div style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.6 }}>{c.interactionGuide}</div>
                                </div>
                            )}
                            {c.motivators?.length > 0 && (
                                <div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }}>Motivators</div>
                                    <div className="tags-list">{c.motivators.map((m, i) => <span key={i} className="tag">{m}</span>)}</div>
                                </div>
                            )}
                            {c.avoidWithUser?.length > 0 && (
                                <div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }}>Avoid</div>
                                    <div className="tags-list">{c.avoidWithUser.map((a, i) => <span key={i} className="tag" style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none' }}>{a}</span>)}</div>
                                </div>
                            )}
                            {c.communicationTips?.length > 0 && (
                                <div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }}>Tips</div>
                                    <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        {c.communicationTips.map((tip, i) => <li key={i} style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.5 }}>{tip}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Expertise & Topics */}
                {wb && (wb.expertiseSignals?.length > 0 || wb.topicsOfInterest?.length > 0) && (
                    <div className="detail-section full-width">
                        <div className="section-header">🎯 Expertise & Interests</div>
                        <div className="section-body" style={{ display: 'flex', gap: 24 }}>
                            {wb.expertiseSignals?.length > 0 && (
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8 }}>Expertise signals</div>
                                    <div className="tags-list">{wb.expertiseSignals.map((e, i) => <span key={i} className="tag accent">{e}</span>)}</div>
                                </div>
                            )}
                            {wb.topicsOfInterest?.length > 0 && (
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8 }}>Topics of interest</div>
                                    <div className="tags-list">{wb.topicsOfInterest.map((t, i) => <span key={i} className="tag">{t}</span>)}</div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function PersonalityViewer() {
    const [profiles, setProfiles] = useState([]);
    const [selected, setSelected] = useState(null);
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        (async () => {
            setLoading(true);
            const res = await personalityAPI.list();
            if (res.success) {
                setProfiles(res.data.users ?? [])
            }
            else setError(res.error || 'Failed to load profiles');
            setLoading(false);
        })();
    }, []);

    const handleSelect = async (username) => {
        setSelected(username);
        setLoadingDetail(true);
        const res = await personalityAPI.getOne(username);
        if (res.success) setDetail(res.data);
        setLoadingDetail(false);
    };

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <span className="spinner" style={{ width: 32, height: 32 }} />
        </div>
    );

    if (error) return <div className="alert alert-error">⚠ {error}</div>;

    if (selected) {
        if (loadingDetail) return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                <span className="spinner" style={{ width: 32, height: 32 }} />
            </div>
        );
        if (detail) return <ProfileDetail profile={detail} onBack={() => { setSelected(null); setDetail(null); }} />;
    }

    return (
        <div>
            <div style={{ marginBottom: 20, fontSize: 13, color: 'var(--text-2)' }}>
                {profiles.length} personality profile{profiles.length !== 1 ? 's' : ''} analyzed — click a card to view details.
            </div>
            <div className="profiles-grid">
                {profiles.map((p) => (
                    <ProfileCard key={p.username || p.userId} profile={p} onClick={handleSelect} />
                ))}
            </div>
        </div>
    );
}
