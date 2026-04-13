import axios from 'axios';

// Use environment variables for API URL (Vite uses import.meta.env)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL + '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Documents API
export const documentsAPI = {
  list: async () => {
    try {
      const response = await api.get('/documents');
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  },

  upload: async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  },

  delete: async (docId) => {
    try {
      const response = await api.delete(`/documents/${docId}`);
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  },
};

// Chat API
export const chatAPI = {
  send: async (query, conversationId) => {
    try {
      const response = await api.post('/chat/agent', {
        query,
        conversationId,
      });
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  },

  getHistory: async (conversationId) => {
    try {
      const response = await api.get(`/chat/${conversationId}`);
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  },

  clearHistory: async (conversationId) => {
    try {
      const response = await api.delete(`/chat/${conversationId}`);
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  },
};

export default { documentsAPI, chatAPI };