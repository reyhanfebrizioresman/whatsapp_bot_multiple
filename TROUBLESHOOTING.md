# Troubleshooting Guide - WhatsApp Multi Session

## Masalah Koneksi Connect-Reconnect

### Gejala
- Session sudah berhasil scan QR dan masuk, tapi terus-menerus connect-reconnect
- Status session tidak berubah dari "connecting"
- Log menunjukkan "Client disconnected" berulang kali

### Penyebab
1. **Logic reconnect yang terlalu agresif** - Kode lama akan selalu mencoba reconnect
2. **Tidak ada penanganan disconnect reason yang tepat**
3. **Session yang sudah ter-authenticate tidak dikenali**
4. **Tidak ada batasan jumlah reconnect attempts**

### Solusi yang Sudah Diterapkan

#### 1. Perbaikan Logic Reconnect
- Menambahkan batasan maksimal 3 kali reconnect attempts
- Menggunakan exponential backoff delay (3s, 6s, 12s, dst)
- Hanya reconnect untuk `connectionLost` dan `connectionClosed`, bukan untuk `loggedOut`

#### 2. Penanganan Session yang Sudah Connected
- Mengecek apakah session sudah connected sebelum membuat koneksi baru
- Mengembalikan socket yang sudah ada jika session sudah connected

#### 3. Automatic Cleanup Service
- Membersihkan session yang bermasalah setiap 5 menit
- Menghapus session yang connecting terlalu lama (>10 menit)
- Menghapus session dengan QR yang terlalu lama (>5 menit)

#### 4. Force Cleanup Endpoints
- `/session/force-cleanup/:token` - Force cleanup session tertentu
- `/session/reset-reconnect/:token` - Reset reconnect attempts

### Cara Menggunakan

#### 1. Restart Server
```bash
# Stop server
Ctrl+C

# Start server
npm start
```

#### 2. Force Cleanup Session Tertentu
```bash
# Via API
curl -X POST http://localhost:3000/session/force-cleanup/YOUR_SESSION_TOKEN

# Atau gunakan script
node cleanup-sessions.js
```

#### 3. Reset Reconnect Attempts
```bash
curl -X POST http://localhost:3000/session/reset-reconnect/YOUR_SESSION_TOKEN
```

#### 4. Restart Session
```bash
curl -X POST http://localhost:3000/session/restart/YOUR_SESSION_TOKEN
```

### Monitoring

#### 1. Cek Status Session
```bash
curl http://localhost:3000/session/status/YOUR_SESSION_TOKEN
```

#### 2. Cek Semua Session
```bash
curl http://localhost:3000/sessions
```

#### 3. Log Monitoring
Perhatikan log berikut:
- `Session connected successfully` - Session berhasil connect
- `Client disconnected` - Session terputus
- `Should reconnect: true/false` - Apakah akan reconnect
- `Reconnect attempts: X` - Jumlah percobaan reconnect
- `Auto-cleanup: Removing...` - Automatic cleanup berjalan

### Best Practices

1. **Jangan restart session terlalu sering** - Tunggu minimal 30 detik
2. **Gunakan force cleanup** jika session stuck di connecting
3. **Monitor log** untuk melihat pola disconnect
4. **Pastikan koneksi internet stabil**
5. **Jangan scan QR di multiple device** untuk session yang sama

### Debug Mode

Untuk debugging lebih detail, tambahkan di `services/whatsappService.js`:
```javascript
const logger = pino({ level: 'debug' }); // Ganti 'silent' dengan 'debug'
```

### Jika Masih Bermasalah

1. **Hapus folder session** di `sessions/YOUR_SESSION_TOKEN`
2. **Restart server**
3. **Buat session baru**
4. **Scan QR dengan device yang berbeda**
5. **Pastikan WhatsApp di device tidak sedang digunakan**

### Contact Support

Jika masalah masih berlanjut, siapkan informasi berikut:
- Log error lengkap
- Session token yang bermasalah
- Versi WhatsApp di device
- Jenis device (Android/iOS)
- Koneksi internet (WiFi/Mobile Data) 