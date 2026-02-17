
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import ClassList from './pages/teacher/ClassList';
import StudentList from './pages/teacher/StudentList';
import StudentProfile from './pages/teacher/StudentProfile';
import ActiveCoaching from './pages/teacher/bk/ActiveCoaching';
import BKStudentMonitoring from './pages/teacher/bk/BKStudentMonitoring'; 
import KesiswaanMonitoring from './pages/teacher/KesiswaanMonitoring';
import KesiswaanAction from './pages/teacher/KesiswaanAction';
import TeacherInputLog from './pages/teacher/TeacherInputLog';
import PoeIbu from './pages/teacher/PoeIbu';
import KesiswaanPoeMonitoring from './pages/teacher/KesiswaanPoeMonitoring';
import ManageStudents from './pages/admin/ManageStudents';
import AccountManagement from './pages/admin/AccountManagement';
import PointConfiguration from './pages/admin/PointConfiguration';
import OsisInput from './pages/osis/OsisInput';
import StudentInput from './pages/student/StudentInput';
import { Role } from './types';
import { DataService } from './services/dataService';
import { WifiOff } from 'lucide-react';
import WaterLogoLoader from './components/WaterLogoLoader';

const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState(false);

  useEffect(() => {
    const initApp = async () => {
      // Strategi: BLOCKING INIT.
      // Kita tidak merender aplikasi sampai data cloud terunduh.
      const success = await DataService.initializeData();
      if (success) {
          // Tambahkan sedikit delay buatan agar animasi logo terlihat estetik (min 2 detik)
          setTimeout(() => {
             setIsInitializing(false);
          }, 2000);
      } else {
          setInitError(true);
          setIsInitializing(false);
      }
    };
    initApp();
  }, []);

  if (isInitializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 relative overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-30 pointer-events-none"></div>
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-50"></div>
        
        <WaterLogoLoader />
      </div>
    );
  }

  if (initError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl flex flex-col items-center max-w-md text-center">
                <WifiOff className="h-16 w-16 text-red-500 mb-4" />
                <h2 className="text-xl font-bold text-slate-800 mb-2">Koneksi Gagal</h2>
                <p className="text-slate-500 text-sm mb-6">
                    Aplikasi gagal terhubung ke database Cloud. Periksa koneksi internet Anda.
                    Aplikasi ini membutuhkan internet saat pertama kali dibuka untuk menghindari kehilangan data.
                </p>
                <button 
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 bg-red-600 text-white rounded-lg font-bold shadow-md hover:bg-red-700 transition-colors"
                >
                    Coba Lagi
                </button>
            </div>
        </div>
      );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        
        {/* Teacher / Kesiswaan / BK / Student / OSIS Routes */}
        <Route path="/teacher/*" element={
          <Layout role={Role.TEACHER}>
            <Routes>
              {/* Role STUDENT will be redirected to poe-ibu, OSIS to osis/input */}
              <Route path="dashboard" element={<TeacherDashboard />} />
              <Route path="classes" element={<ClassList />} />
              <Route path="classes/:classId" element={<StudentList />} />
              <Route path="student/:studentId" element={<StudentProfile />} />
              
              {/* POE IBU (Wali Kelas & Bendahara) */}
              <Route path="poe-ibu" element={<PoeIbu />} />
              
              {/* STUDENT Specific Route (Input Pelanggaran) */}
              <Route path="student/input" element={<StudentInput />} />
              
              {/* OSIS Specific Route */}
              <Route path="osis/input" element={<OsisInput />} />
              
              {/* BK Specific Routes */}
              <Route path="bk/active" element={<ActiveCoaching />} />
              <Route path="bk/monitoring" element={<BKStudentMonitoring />} />

              {/* Kesiswaan Specific Routes */}
              <Route path="kesiswaan/monitoring" element={<KesiswaanMonitoring />} />
              <Route path="kesiswaan/action" element={<KesiswaanAction />} />
              <Route path="kesiswaan/logs" element={<TeacherInputLog />} />
              <Route path="kesiswaan/poe-monitoring" element={<KesiswaanPoeMonitoring />} />
              
              <Route path="*" element={<Navigate to="dashboard" />} />
            </Routes>
          </Layout>
        } />

        {/* Admin Routes */}
        <Route path="/admin/*" element={
          <Layout role={Role.ADMIN}>
            <Routes>
              <Route path="students" element={<ManageStudents />} />
              <Route path="accounts" element={<AccountManagement />} />
              <Route path="config" element={<PointConfiguration />} />
              <Route path="*" element={<Navigate to="students" />} />
            </Routes>
          </Layout>
        } />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
