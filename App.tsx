
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
      console.log("☁️ Aplikasi memulai sinkronisasi cloud...");
      // initializeData sekarang me-return Promise yang menunggu data Cloud masuk semua
      const success = await DataService.initializeData();
      
      if (success) {
          console.log("✅ Sinkronisasi Berhasil. Membuka aplikasi.");
          // Tambahkan sedikit delay estetika
          setTimeout(() => setIsInitializing(false), 1000);
      } else {
          setInitError(true);
          setIsInitializing(false);
      }
    };
    initApp();
  }, []);

  if (isInitializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
        <WaterLogoLoader />
        <div className="mt-4 flex flex-col items-center">
            <div className="flex items-center gap-2 text-indigo-600 font-bold animate-pulse">
                <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-.3s]"></div>
                <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-.5s]"></div>
                <span>Sinkronisasi Cloud...</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Mohon tunggu, sedang mengambil data sekolah terbaru.</p>
        </div>
      </div>
    );
  }

  if (initError || isConfigMissing) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4 text-center">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-red-100">
                <div className="bg-red-100 p-4 rounded-full mb-4 w-fit mx-auto">
                    <AlertTriangle className="h-10 w-10 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Gagal Memuat Data</h2>
                <p className="text-slate-500 text-sm mb-6">
                    Aplikasi gagal terhubung ke server. Periksa koneksi internet Anda dan segarkan halaman.
                </p>
                <button 
                    onClick={() => window.location.reload()}
                    className="w-full px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-md hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                >
                    <RotateCcw className="h-4 w-4" /> Segarkan Halaman
                </button>
            </div>
        </div>
      );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        
        {/* Protected Routes */}
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
