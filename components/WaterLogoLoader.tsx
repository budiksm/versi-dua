
import React from 'react';

interface WaterLogoLoaderProps {
  progress?: number; // 0 to 100 (Optional, if we want to control fill manually)
  isIndeterminate?: boolean; // If true, fills automatically via CSS animation
}

const WaterLogoLoader: React.FC<WaterLogoLoaderProps> = ({ isIndeterminate = true }) => {
  return (
    <div className="flex flex-col items-center justify-center">
      <style>{`
        @keyframes wave {
          0% { transform: translate3d(-50%, 0, 0); }
          50% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        @keyframes fill-up {
          0% { transform: translateY(100%); }
          100% { transform: translateY(0%); }
        }
        .water-wave {
          animation: wave 4s linear infinite;
        }
        .water-fill {
          animation: fill-up 2.5s ease-in-out forwards;
        }
      `}</style>

      <div className="relative w-32 h-32">
        {/* SVG Container */}
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full drop-shadow-xl"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* DEFINISI BENTUK LOGO (SHIELD SEKOLAH) */}
            {/* Jika punya SVG Logo sendiri, ganti path di bawah ini */}
            <path
              id="school-logo-shape"
              d="M50 2 
                 L85 15 
                 Q95 50 85 85 
                 L50 98 
                 L15 85 
                 Q5 50 15 15 
                 Z"
            />
            
            {/* Masking agar air hanya muncul di dalam logo */}
            <clipPath id="logo-clip">
              <use href="#school-logo-shape" />
            </clipPath>
          </defs>

          {/* Background Logo (Kosong/Abu-abu tipis) */}
          <use href="#school-logo-shape" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="2" />

          {/* Group Air dengan Masking */}
          <g clipPath="url(#logo-clip)">
            {/* Container animasi naik turun (Fill) */}
            <g className={isIndeterminate ? "water-fill" : ""} style={!isIndeterminate ? { transform: 'translateY(0%)' } : {}}>
                
                {/* Gelombang Air (Wave) */}
                {/* Kita buat lebar 200% agar bisa digeser kiri-kanan (animasi wave) */}
                <path
                  className="water-wave"
                  fill="#4f46e5" // Warna Indigo-600
                  fillOpacity="0.8"
                  d="M0 100 
                     V50 
                     Q25 40 50 50 
                     T100 50 
                     T150 50 
                     T200 50 
                     V100 
                     Z"
                  transform="translate(0, 10) scale(2, 2)" 
                  // Scale diperbesar agar menutup seluruh area saat naik
                />
            </g>
          </g>

          {/* Outline Logo (Agar bentuk tetap tegas) */}
          <use href="#school-logo-shape" fill="none" stroke="#312e81" strokeWidth="2" strokeOpacity="0.2" />
        </svg>
      </div>
      
      <div className="mt-6 text-center space-y-2">
        <h2 className="text-xl font-bold text-slate-800 animate-pulse">SMKN JAYAKERTA</h2>
        <p className="text-xs text-indigo-500 font-medium uppercase tracking-widest">Memuat Data Sekolah...</p>
      </div>
    </div>
  );
};

export default WaterLogoLoader;
