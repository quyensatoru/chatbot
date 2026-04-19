const sessions = new Map();

export const getSession = (sessionId) => {
    console.log(sessions)
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, []);
    }
    return sessions.get(sessionId);
};

export const saveSession = (sessionId, history) => {
    sessions.set(sessionId, history);
};