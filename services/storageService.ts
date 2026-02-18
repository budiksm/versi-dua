
import { storage } from '../firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Batas Ukuran
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];

export const StorageService = {
    
    // Validasi File sebelum diproses
    validateFile: (file: File): { valid: boolean; error?: string } => {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');

        if (!isImage && !isVideo) {
            return { valid: false, error: 'Tipe file tidak didukung. Gunakan JPG, PNG, atau MP4.' };
        }

        if (isImage) {
            if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
                return { valid: false, error: 'Format gambar harus JPG, PNG, atau WebP.' };
            }
            if (file.size > MAX_IMAGE_SIZE) {
                return { valid: false, error: 'Ukuran foto maksimal 5MB.' };
            }
        }

        if (isVideo) {
            if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
                return { valid: false, error: 'Format video harus MP4 atau WebM.' };
            }
            if (file.size > MAX_VIDEO_SIZE) {
                return { valid: false, error: 'Ukuran video maksimal 20MB.' };
            }
        }

        return { valid: true };
    },

    // Helper: Kompresi Gambar di Client-Side
    compressImage: (file: File, quality: number = 0.7, maxWidth: number = 1200): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Resize logic
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error("Gagal membuat canvas context"));
                        return;
                    }
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    canvas.toBlob(
                        (blob) => {
                            if (blob) resolve(blob);
                            else reject(new Error("Gagal kompresi gambar"));
                        },
                        'image/jpeg', // Force convert to optimized JPEG
                        quality
                    );
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    },

    // Helper: Convert Base64 string to Blob (untuk migrasi)
    base64ToBlob: (base64: string): Blob => {
        try {
            if (!base64.includes(',')) throw new Error("Format Base64 tidak valid (missing comma).");
            const arr = base64.split(',');
            const mimeMatch = arr[0].match(/:(.*?);/);
            if (!mimeMatch) throw new Error("Invalid Base64 MIME type");
            
            const mime = mimeMatch[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            return new Blob([u8arr], { type: mime });
        } catch (e) {
            console.error("Base64 decoding failed:", e);
            throw e;
        }
    },

    // Upload Blob/File ke Storage
    uploadFile: async (file: File, path: string): Promise<string> => {
        if (!storage) throw new Error("Firebase Storage belum diinisialisasi. Pastikan koneksi internet stabil.");
        
        let fileToUpload: Blob = file;

        // Auto-compress jika gambar
        if (file.type.startsWith('image/')) {
            try {
                fileToUpload = await StorageService.compressImage(file);
            } catch (e) {
                console.warn("Kompresi gagal, mengupload file asli.", e);
            }
        }
        
        const storageRef = ref(storage, path);
        
        try {
            const snapshot = await uploadBytes(storageRef, fileToUpload);
            const downloadURL = await getDownloadURL(snapshot.ref);
            return downloadURL;
        } catch (error: any) {
            console.error("Upload failed:", error);
            // CORS Detection
            if (error.message && (error.message.includes('network') || error.message.includes('retry'))) {
                throw new Error("Gagal koneksi Storage (Cek CORS)");
            }
            throw new Error("Gagal mengupload file ke server.");
        }
    },

    // Wrapper khusus untuk migrasi Base64
    uploadBase64: async (base64String: string, path: string): Promise<string> => {
        if (!storage) throw new Error("Firebase Storage belum diinisialisasi.");

        try {
            console.log(`[Storage] Converting Base64 to Blob for ${path}...`);
            const blob = StorageService.base64ToBlob(base64String);
            
            // Tentukan ekstensi dari MIME type untuk nama file
            let ext = 'jpg'; // default
            if (blob.type === 'image/png') ext = 'png';
            if (blob.type === 'image/webp') ext = 'webp';
            
            const finalPath = `${path}.${ext}`;
            const storageRef = ref(storage, finalPath);
            
            console.log(`[Storage] Starting uploadBytes to ${finalPath}...`);
            const snapshot = await uploadBytes(storageRef, blob);
            console.log(`[Storage] Upload complete. Fetching URL...`);
            
            const downloadURL = await getDownloadURL(snapshot.ref);
            return downloadURL;
        } catch (error: any) {
            console.error("Base64 Upload Critical Error:", error);
            let msg = error.message;
            // Explicitly detect network errors common with CORS blocks
            if (msg && (msg.includes('network') || msg.includes('retry') || msg.toLowerCase().includes('failed to fetch'))) {
                msg += " (POTENSI ERROR CORS: Cek Panduan di Migration Tool)";
            }
            throw new Error(`Storage Error: ${msg}`);
        }
    }
};
