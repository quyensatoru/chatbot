import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
    baseURL: API_BASE_URL + '/api',
    headers: { 'Content-Type': 'application/json' },
});

export const documentsAPI = {
    list: async () => {
        try {
            const r = await api.get('/documents');
            return r.data;
        } catch (e) {
            return { success: false, error: e.response?.data?.error || e.message };
        }
    },
    upload: async (file) => {
        try {
            const fd = new FormData();
            fd.append('file', file);
            const r = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            return r.data;
        } catch (e) {
            return { success: false, error: e.response?.data?.error || e.message };
        }
    },
    delete: async (docId) => {
        try {
            const r = await api.delete(`/documents/${docId}`);
            return r.data;
        } catch (e) {
            return { success: false, error: e.response?.data?.error || e.message };
        }
    },
};

export const chatAPI = {
    send: async (query, conversationId) => {
        try {
            const r = await api.post('/chat/agent', { query, conversationId });
            return r.data;
        } catch (e) {
            return { success: false, error: e.response?.data?.error || e.message };
        }
    },
    getHistory: async (conversationId) => {
        try {
            const r = await api.get(`/chat/${conversationId}`);
            return r.data;
        } catch (e) {
            return { success: false, error: e.response?.data?.error || e.message };
        }
    },
    clearHistory: async (conversationId) => {
        try {
            const r = await api.delete(`/chat/${conversationId}`);
            return r.data;
        } catch (e) {
            return { success: false, error: e.response?.data?.error || e.message };
        }
    },
};

export const personalityAPI = {
    list: async () => {
        try {
            const r = await api.get('/personality');
            return r.data;
        } catch (e) {
            return { success: false, error: e.response?.data?.error || e.message };
        }
    },
    getOne: async (username) => {
        try {
            const r = await api.get(`/personality/${username}`);
            return r.data;
        } catch (e) {
            return { success: false, error: e.response?.data?.error || e.message };
        }
    },
};

export const healthAPI = {
    check: async () => {
        try {
            const r = await api.get('/health');
            return r.data;
        } catch (e) {
            return { success: false, error: e.response?.data?.error || e.message };
        }
    },
};
