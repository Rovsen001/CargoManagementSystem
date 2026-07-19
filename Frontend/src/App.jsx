import React from 'react'; // 👈 BAX BU ƏSAS SƏTİR ƏSKİK İMİŞ!
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Packages from './pages/Packages';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<MainLayout />}>
                    {/* İndi ana səhifə açıldıqda ilk Dashboard görsənəcək */}
                    <Route index element={<Dashboard />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="packages" element={<Packages />} />
                </Route>
            </Routes>
        </Router>
    );
}

export default App;