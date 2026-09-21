/**
 * APLIKASI KAS RT.001 RW.001 DK. GAJAH, DESA SUROREJAN
 * Script Inisialisasi Database Spreadsheet
 */

function setupDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var sheetsDef = [
    {
      name: "USERS",
      headers: ["id_user", "username", "password_hash", "nama_lengkap", "role", "created_at"],
      widths: [100, 120, 220, 180, 120, 150]
    },
    {
      name: "WARGA",
      headers: ["id_warga", "no_kk", "nama_kk", "no_hp", "status_aktif", "tgl_terdaftar"],
      widths: [100, 180, 220, 150, 100, 150]
    },
    {
      name: "IURAN_BULANAN",
      headers: ["id_iuran", "id_warga", "tahun", "bulan", "nominal", "tgl_bayar", "status_bayar", "id_transaksi_kas"],
      widths: [120, 100, 80, 70, 100, 140, 110, 140]
    },
    {
      name: "TRANSAKSI_KAS",
      headers: ["id_transaksi", "tgl_transaksi", "jenis", "kategori", "nominal", "keterangan", "status", "user_input"],
      widths: [130, 120, 110, 140, 120, 260, 110, 130]
    },
    {
      name: "ANGGARAN_KERJA",
      headers: ["id_program", "tahun", "nama_kegiatan", "target_anggaran", "realisasi_anggaran", "keterangan", "status_program"],
      widths: [110, 80, 240, 130, 130, 200, 120]
    },
    {
      name: "LOG_AUDIT",
      headers: ["id_log", "timestamp", "user_pelaksana", "tipe_aksi", "id_referensi", "alasan_keterangan"],
      widths: [120, 160, 130, 150, 130, 300]
    }
  ];

  sheetsDef.forEach(function(def) {
    var sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
    }
    
    // Set Header jika sheet masih kosong
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(def.headers);
      var headerRange = sheet.getRange(1, 1, 1, def.headers.length);
      headerRange.setBackground("#065F46"); // Emerald Dark
      headerRange.setFontColor("#FFFFFF");
      headerRange.setFontWeight("bold");
      headerRange.setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
    }
    
    // Atur Lebar Kolom
    for (var i = 0; i < def.widths.length; i++) {
      sheet.setColumnWidth(i + 1, def.widths[i]);
    }
  });

  // Buat User Admin Pertama (admin / 123456) jika belum ada
  var userSheet = ss.getSheetByName("USERS");
  if (userSheet.getLastRow() === 1) {
    var passHash = hashPassword("123456");
    userSheet.appendRow([
      "USR-001",
      "admin",
      passHash,
      "Bendahara RT.001 Dk. Gajah",
      "Super Admin",
      new Date().toISOString()
    ]);
  }

  // Buat Data Contoh Anggaran jika kosong
  var anggaranSheet = ss.getSheetByName("ANGGARAN_KERJA");
  if (anggaranSheet.getLastRow() === 1) {
    var thn = new Date().getFullYear();
    anggaranSheet.appendRow(["PRG-01", thn, "Kerja Bakti & Kebersihan Saluran", 500000, 0, "Pembelian konsumsi dan plastik sampah", "Direncanakan"]);
    anggaranSheet.appendRow(["PRG-02", thn, "Penerangan Jalan Lingkungan Dk. Gajah", 750000, 0, "Penggantian lampu LED jalan RT", "Direncanakan"]);
    anggaranSheet.appendRow(["PRG-03", thn, "Santunan Warga Sakit / Duka", 600000, 0, "Dana sosial warga", "Direncanakan"]);
  }

  // Hapus Sheet bawaan "Sheet1" jika ada
  var defaultSheet = ss.getSheetByName("Sheet1") || ss.getSheetByName("Sheet 1");
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch(e) {}
  }

  Logger.log("Inisialisasi Database Kas RT 001 Berhasil!");
}