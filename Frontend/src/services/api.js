import axios from 'axios';

// Bütün istəklər üçün standart URL təyin edirik
const api = axios.create({
    baseURL: 'http://localhost:5000/api',
});

export default api;