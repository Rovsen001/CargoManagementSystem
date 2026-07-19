import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Packages from './pages/Packages';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<MainLayout />}>
                    {/* Ana səhifə açıldıqda birbaşa Packages görünsün */}
                    <Route index element={<Packages />} />
                    <Route path="packages" element={<Packages />} />
                </Route>
            </Routes>
        </Router>
    );
}

export default App;