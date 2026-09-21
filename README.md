Sistem Informasi Kas & Transparansi Keuangan RT.001 RW.001
Dukuh Gajah, Desa Surorejan, Kecamatan Puring, Kabupaten Kebumen
Aplikasi pengelolaan kas berbasis web (Single Page Application) yang dibangun di atas platform Google Apps Script dan Google Sheets. Sistem ini dirancang dengan pendekatan Dual-Access: menyediakan transparansi mutasi keuangan dan status iuran bagi seluruh warga tanpa login, serta panel kontrol terotentikasi (SHA-256 encryption) khusus pengurus RT untuk tata kelola administrasi keuangan, iuran multi-bulan, pembatalan transaksi (void & rollback), dan pelaporan otomatis.

📌 Fitur Utama
Mode Transparansi Publik (Tanpa Login):
Ringkasan saldo kas real-time (Total Pemasukan, Total Pengeluaran, Saldo Kas Saat Ini).
Buku kas umum aktif (pemasukan & pengeluaran).
Matriks kepatuhan iuran bulanan warga (Rp 10.000/bulan) sepanjang tahun.
Proteksi Privasi Warga: Nomor KK dan Nomor HP otomatis disamarkan (*** DISAMARKAN ***) untuk publik.
Pemantauan progres rencana kerja dan realisasi anggaran kas.
Panel Kontrol Pengurus (Login Admin Terenkripsi):
Keamanan kata sandi menggunakan hash satu arah SHA-256.
Fitur ganti password mandiri dan penambahan akun pengurus baru.
Manajemen data master Kepala Keluarga (Tambah, Ubah, Hapus, status Aktif/Pindah/Almarhum).
Otomatisasi Pembayaran Iuran Multi-Bulan:
Warga dapat membayar iuran sekaligus untuk beberapa bulan (misal: 6 bulan langsung).
Sistem otomatis menandai bulan-bulan terpilih menjadi Lunas dan menerbitkan satu baris transaksi pemasukan di buku kas.
Mekanisme Pembatalan Bersih (Void & Auto-Rollback):
Transaksi salah input tidak dihapus permanen (soft delete berstatus DIBATALKAN) untuk menjaga integritas pembukuan.
Jika transaksi iuran dibatalkan, status pembayaran seluruh bulan yang bersangkutan otomatis kembali menjadi Belum Lunas.
Setiap pembatalan wajib menyertakan alasan tertulis yang terekam di lembar audit.
Audit Trail / History Log:
Rekam jejak seluruh aktivitas penting (login, input kas, tambah warga, pembatalan, edit anggaran) tercatat otomatis di sheet LOG_AUDIT.
Pelaporan Instan (WhatsApp & PDF):
Share WhatsApp: Tombol generator pesan sekali klik yang menyusun rekap mutasi kas terkini berformat rapi untuk disebar ke grup RT.
Export PDF Resmi: Konversi langsung dokumen HTML ber-kop surat resmi RT menjadi file PDF siap unduh langsung di peramban tanpa perantara Google Drive.

🗄️ Skema Database (Google Sheets)
Fungsi otomatisasi Setup.gs akan mengonfigurasi 6 lembar kerja (sheets) berikut:
Nama Sheet
Keterangan & Peruntukan
Struktur Kolom
USERS
Data kredensial pengurus RT
id_user, username, password_hash, nama_lengkap, role, created_at
WARGA
Master kepala keluarga
id_warga, no_kk, nama_kk, no_hp, status_aktif, tgl_terdaftar
IURAN_BULANAN
Pencatatan iuran wajib (Rp 10.000/bln)
id_iuran, id_warga, tahun, bulan, nominal, tgl_bayar, status_bayar, id_transaksi_kas
TRANSAKSI_KAS
Buku kas umum masuk & keluar
id_transaksi, tgl_transaksi, jenis, kategori, nominal, keterangan, status, user_input
ANGGARAN_KERJA
Rencana vs realisasi pemakaian kas
id_program, tahun, nama_kegiatan, target_anggaran, realisasi_anggaran, keterangan, status_program
LOG_AUDIT
Jejak audit operasional & pembatalan
id_log, timestamp, user_pelaksana, tipe_aksi, id_referensi, alasan_keterangan


📁 Struktur Berkas
├── Setup.gs       # Script inisialisasi database dan akun super admin
├── Code.gs        # Backend controller, API, hashing SHA-256, PDF generator
├── index.html     # Frontend GitHub Pages
├── css/
│   └── style.css  # Styling frontend
└── js/
    ├── api.js      # Transport GitHub Pages -> Apps Script
    └── app.js      # UI, state, rendering, modal dan event

🚀 Panduan Pemasangan & Penerapan (Deployment)
Langkah 1: Persiapan Spreadsheet
Buka Google Sheets dan buat dokumen baru bernama Kas RT 001 RW 001 Dk Gajah.
Masuk ke menu Ekstensi > Apps Script.
Langkah 2: Backend Apps Script
Gunakan `Code.gs` sebagai backend pada project Google Apps Script yang terhubung dengan spreadsheet.
Fungsi business logic/database yang sudah ada tetap berada di Apps Script.

Frontend tidak perlu disalin ke Apps Script. Frontend dijalankan dari GitHub Pages menggunakan:
- `index.html`
- `css/style.css`
- `js/api.js`
- `js/app.js`

Pastikan URL Web App Apps Script pada `js/api.js` menunjuk ke deployment backend yang aktif.
Langkah 3: Inisialisasi Database
Pada menu navigasi editor Apps Script, pilih berkas Setup.gs.
Pilih fungsi setupDatabase pada dropdown toolbar atas, lalu klik tombol Jalankan (Run).
Berikan izin akses (permission review) akun Google Anda jika dialog otorisasi muncul.
Buka kembali Google Sheets Anda; periksa apakah 6 sheet beserta header warna emerald telah terbentuk otomatis.
Langkah 4: Publikasi sebagai Aplikasi Web
Klik tombol Terapkan (Deploy) di pojok kanan atas > pilih Penerapan baru (New deployment).
Klik ikon gerigi (Pilih jenis) > pilih Aplikasi Web (Web app).
Atur konfigurasi berikut:
Deskripsi: Rilis Versi 1.0 Kas RT Gajah
Jalankan sebagai (Execute as): Saya (email pemilik spreadsheet)
Yang memiliki akses (Who has access): Siapa saja (Anyone) (wajib dipilih agar dashboard publik dapat dibuka warga tanpa kewajiban login akun Google).
Klik Terapkan (Deploy) dan salin tautan URL Aplikasi Web yang disediakan.

🔑 Kredensial Default Akun Admin
Username: admin
Password: 123456
Sangat Dianjurkan: Setelah pertama kali masuk ke aplikasi, segera masuk ke Panel Admin RT > klik 🔑 Ganti Password untuk memperbarui password default.

📖 Panduan Penggunaan Sistem
1. Tata Kelola Warga & Kepala Keluarga
Login sebagai admin, buka tab ⚙️ Panel Admin RT.
Klik + Tambah Kepala Keluarga.
Masukkan Nama Lengkap KK, Nomor KK, dan Nomor WhatsApp aktif (format diawali tanda petik tunggal otomatis untuk mempertahankan keutuhan 16 digit angka KK).
Data yang disimpan otomatis menyinkronkan matriks iuran untuk 12 bulan pada tahun berjalan.
2. Mencatat Pembayaran Iuran Warga (Multi-Bulan)
Pada menu utama, klik tab 👥 Iuran Warga > klik tombol 💳 Bayar Iuran Multi-Bulan.
Pilih nama Kepala Keluarga yang menyetorkan iuran.
Beri tanda centang pada bulan yang dibayarkan (misal: Januari hingga Juni) atau gunakan tombol Pilih Semua (12 Bulan). Total nominal dihitung otomatis (Rp 10.000 / bulan).
Klik Catat Pembayaran Kas. Status pada tabel otomatis berubah menjadi hijau (✓) dan mutasi kas masuk langsung diterbitkan di Buku Kas.
3. Membatalkan Transaksi yang Salah Input (Void)
Pada tab 📒 Buku Kas, cari baris transaksi yang salah dimasukkan.
Klik tombol merah Batal (Void) di kolom aksi.
Masukkan alasan pembatalan (contoh: "Kelebihan nominal transfer" atau "Salah pilih warga"), lalu konfirmasi.
Nominal transaksi langsung dieksklusikan dari perhitungan saldo, status mutasi dicoret menjadi DIBATALKAN, dan jika mutasi tersebut merupakan pembayaran iuran, status bulan warga terkait otomatis dikembalikan ke status Belum Lunas.
4. Pelaporan
WhatsApp: Klik tombol hijau 💬 Laporan WA di bilah atas. Sistem akan membuka aplikasi WhatsApp dengan pesan terformat rapi berisi posisi saldo, total masuk/keluar, dan perincian kas RT.
Cetak Dokumen PDF: Klik tombol 📄 Export PDF di bilah navigasi atas. Pilih format dokumen (Buku Kas, Status Iuran, atau Laporan Terpadu), lalu sistem akan mengunduh dokumen resmi lengkap dengan kop RT dan kolom tanda tangan pengurus.

🛠️ Pemeliharaan & Pembaruan Kode
Setiap kali melakukan modifikasi pada file .gs atau .html:
Simpan perubahan dengan menekan Ctrl + S.
Klik Terapkan (Deploy) > Kelola penerapan (Manage deployments).
Klik ikon pensil (Edit), pilih versi: Versi baru (New version), lalu klik Terapkan (Deploy).
Lakukan penyegaran halaman (Hard Refresh / Ctrl + F5) pada peramban klien.



## Struktur Frontend Baru

Repository ini sekarang dipisahkan secara tegas antara **backend Apps Script** dan **frontend GitHub Pages**.

```text
rtnan/
├── Code.gs              # Backend: Google Apps Script + Google Sheets
├── index.html           # Frontend GitHub Pages
├── css/
│   └── style.css        # Styling frontend
└── js/
    ├── api.js           # Satu-satunya lapisan komunikasi frontend -> GAS
    └── app.js           # UI, state, rendering, modal, event
```

### Jalur komunikasi

```text
GitHub Pages
    │
    ├── Public read ────── JSONP GET ────────┐
    │                                         ▼
    │                              Google Apps Script
    │                                         │
    │                                         ▼
    │                                   Google Sheets
    │
    └── Admin / write ─── Form POST ────────►│
                               │             │
                               └─ Cache ──────┘
                                  ▲
                                  │
                           JSONP polling
```

Frontend **tidak lagi menggunakan** `google.script.run`, iframe bridge, Cloudflare Worker, proxy, atau `fetch()` CORS ke Apps Script.

- `health`, `getDashboardData`, dan `exportPdfLaporan` memakai JSONP karena semuanya merupakan pembacaan publik.
- Login, logout, perubahan password, input kas, pembayaran iuran, void, warga, anggaran, dan administrasi memakai POST form sederhana.
- Hasil POST disimpan sementara di `CacheService`, kemudian frontend mengambil hasilnya melalui request polling JSONP.
- Password dan token admin tidak dimasukkan ke query string POST.
- Lapisan business logic yang sudah ada di `Code.gs` tetap menjadi sumber kebenaran database.

> Setelah perubahan pada `Code.gs`, deployment Web App Apps Script harus diperbarui ke versi baru. Frontend GitHub Pages tidak perlu diubah URL-nya.

