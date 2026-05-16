# IoT Smart Gate Access System

Sistem akses pintu (Gate Access) berbasis IoT dengan fitur pembayaran (pay-per-tap), Idempotency, dan Two-Phase Acknowledgment.

## 🚀 Fitur Utama
- **Edge (ESP32):** Membaca RFID RC522, kontrol Servo, dan handle logic offline buffer.
- **Backend (Node.js):** REST API dengan PostgreSQL, Idempotency handling, dan Auto-Refund.
- **Frontend (Mobile Webview):** Dashboard premium untuk cek saldo dan riwayat transaksi.
- **Dockerized:** Seluruh stack (DB, Backend, Frontend) siap dijalankan dengan Docker Compose.

## 🛠️ Tech Stack
- **Hardware:** ESP32, RFID-RC522, Servo MG996R/SG90.
- **Backend:** Node.js, Express, PostgreSQL.
- **Frontend:** Vanilla JS, CSS (Glassmorphism design).
- **Orchestration:** Docker Compose.

## 📋 Prasyarat
- Docker & Docker Compose
- Arduino IDE (untuk upload code ke ESP32)
- Library Arduino: `MFRC522`, `ArduinoJson`, `ESP32Servo`, `HTTPClient`.

## ⚙️ Cara Menjalankan

### 1. Jalankan Backend & Database
Buka terminal di root folder, lalu jalankan:
```bash
docker-compose up -d
```
Ini akan menjalankan:
- **PostgreSQL** di port `5432`
- **Backend API** di port `3000`
- **Frontend** di port `8080`

### 2. Setup ESP32
- Buka file `iot/esp32-rfid-gate.ino` di Arduino IDE.
- Ubah `ssid` dan `password` sesuai WiFi Anda.
- Ubah `serverUrl` ke alamat IP komputer Anda (misal: `http://192.168.1.15:3000/api`).
- Upload ke ESP32.

### 3. Akses Dashboard
Buka browser di HP atau komputer dan akses:
`http://localhost:8080` (atau IP host anda di port 8080).

## 💡 Alur Kerja (Workflow)
1. **Tap Kartu:** ESP32 membaca RFID dan mengirim request `/api/pay` dengan `idempotency_key`.
2. **Potong Saldo:** Backend memvalidasi saldo dan mengubah status transaksi menjadi `PENDING`.
3. **Buka Pintu:** Jika response sukses, ESP32 menggerakkan Servo.
4. **Konfirmasi:** ESP32 mengirim request `/api/confirm` untuk mengubah status ke `SUCCESS`.
5. **Auto-Refund:** Jika dalam 60 detik tidak ada konfirmasi (misal: pintu macet atau ESP32 mati), sistem otomatis mengembalikan saldo.

## 🗄️ Struktur Database
- `users`: Data pengguna.
- `cards`: Data kartu RFID dan saldo.
- `merchants`: Lokasi gate.
- `transactions`: Log transaksi (PENDING, SUCCESS, REFUNDED).
