
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
import { WifiOff, AlertTriangle, RotateCcw } from 'lucide-react';
import WaterLogoLoader from './components/WaterLogoLoader';
import { isConfigMissing } from './firebaseConfig';

const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState(false);

  useEffect(() => {
    const initApp = async () => {
      // Langsung connect menggunakan config hardcoded
      const success = await DataService.initializeData();
      if (success) {
          // Beri sedikit delay agar loading screen tidak kedip terlalu cepat
          setTimeout(() => setIsInitializing(false), 1500);
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
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-30 pointer-events-none"></div>
        <WaterLogoLoader />
      </div>
    );
  }

  // Tampilan Error Fatal (Hanya jika developer lupa isi config atau internet mati total)
  if (initError || isConfigMissing) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl flex flex-col items-center max-w-md text-center w-full border border-slate-200">
                <div className="bg-red-100 p-4 rounded-full mb-4">
                    {isConfigMissing ? <AlertTriangle className="h-10 w-10 text-red-600" /> : <WifiOff className="h-10 w-10 text-red-600" />}
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">
                    {isConfigMissing ? "Konfigurasi Database Belum Diisi" : "Gagal Terhubung ke Server"}
                </h2>
                <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                    {isConfigMissing 
                        ? "Developer: Silakan buka file firebaseConfig.ts dan isi data 'apiKey', 'projectId', dll dengan benar." 
                        : "Pastikan perangkat Anda terhubung ke internet. Aplikasi ini wajib online untuk memuat data sekolah."}
                </p>
                
                {!isConfigMissing && (
                    <button 
                        onClick={() => window.location.reload()}
                        className="w-full px-6 py-3 bg-slate-800 text-white rounded-xl font-bold shadow-md hover:bg-slate-900 transition-colors flex items-center justify-center gap-2"
                    >
                        <RotateCcw className="h-4 w-4" /> Coba Lagi
                    </button>
                )}
            </div>
            <p className="mt-8 text-xs text-slate-400 text-center">
                SMKN Jayakerta Management System v1.0 (Production)
            </p>
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
              <Route path="dashboard" element={<TeacherDashboard />} />
              <Route path="classes" element={<ClassList />} />
              <Route path="classes/:classId" element={<StudentList />} />
              <Route path="student/:studentId" element={<StudentProfile />} />
              <Route path="poe-ibu" element={<PoeIbu />} />
              <Route path="student/input" element={<StudentInput />} />
              <Route path="osis/input" element={<OsisInput />} />
              <Route path="bk/active" element={<ActiveCoaching />} />
              <Route path="bk/monitoring" element={<BKStudentMonitoring />} />
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
