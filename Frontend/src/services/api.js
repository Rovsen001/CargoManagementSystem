import axios from 'axios';

// Bütün istəklər üçün standart URL təyin edirik
const api = axios.create({
    baseURL: 'http://localhost:5000/api',
});

// Hər sorğuya avtomatik olaraq giriş token-ini əlavə edirik
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;