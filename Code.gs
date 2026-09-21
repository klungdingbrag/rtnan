/**
 * APLIKASI KAS RT.001 RW.001 DK. GAJAH, DESA SUROREJAN
 * Controller Backend & Business Logic
 */

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// -------------------------------------------------------------
// HELPER & SECURITY ENKRIPSI
// -------------------------------------------------------------
function hashPassword(str) {
  var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8);
  var txtHash = "";
  for (var i = 0; i < rawHash.length; i++) {
    var val = rawHash[i];
    if (val < 0) val += 256;
    var byteStr = val.toString(16);
    if (byteStr.length == 1) byteStr = "0" + byteStr;
    txtHash += byteStr;
  }
  return txtHash;
}

function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function generateId(prefix) {
  return prefix + "-" + Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyyMMddHHmmss") + "-" + Math.floor(Math.random() * 900 + 100);
}

function logActivity(user, tipeAksi, idReferensi, keterangan) {
  var sheet = getSheet("LOG_AUDIT");
  sheet.appendRow([
    generateId("LOG"),
    new Date(),
    user || "Sistem",
    tipeAksi,
    idReferensi || "-",
    keterangan || "-"
  ]);
}

// -------------------------------------------------------------
// AUTENTIKASI ADMIN
// -------------------------------------------------------------
function loginAdmin(username, password) {
  var sheet = getSheet("USERS");
  var data = sheet.getDataRange().getValues();
  var inputHash = hashPassword(password);

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).toLowerCase() === String(username).toLowerCase().trim()) {
      if (data[i][2] === inputHash) {
        logActivity(data[i][1], "LOGIN", data[i][0], "Admin login berhasil");
        return {
          success: true,
          user: {
            id_user: data[i][0],
            username: data[i][1],
            nama_lengkap: data[i][3],
            role: data[i][4]
          }
        };
      } else {
        return { success: false, message: "Password yang Anda masukkan salah." };
      }
    }
  }
  return { success: false, message: "Username admin tidak ditemukan." };
}

function changePassword(username, oldPassword, newPassword) {
  var sheet = getSheet("USERS");
  var data = sheet.getDataRange().getValues();
  var oldHash = hashPassword(oldPassword);
  var newHash = hashPassword(newPassword);

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).toLowerCase() === String(username).toLowerCase().trim()) {
      if (data[i][2] === oldHash) {
        sheet.getRange(i + 1, 3).setValue(newHash);
        logActivity(username, "GANTI_PASSWORD", data[i][0], "Perubahan password admin");
        return { success: true, message: "Password berhasil diperbarui." };
      } else {
        return { success: false, message: "Password lama tidak cocok." };
      }
    }
  }
  return { success: false, message: "User tidak ditemukan." };
}

function tambahAdmin(currentAdmin, username, password, namaLengkap, role) {
  var sheet = getSheet("USERS");
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).toLowerCase() === String(username).toLowerCase().trim()) {
      return { success: false, message: "Username sudah digunakan." };
    }
  }

  var newId = generateId("USR");
  sheet.appendRow([
    newId,
    username.trim(),
    hashPassword(password),
    namaLengkap.trim(),
    role || "Admin",
    new Date().toISOString()
  ]);

  logActivity(currentAdmin, "TAMBAH_ADMIN", newId, "Menambahkan admin baru: " + username);
  return { success: true, message: "Admin baru berhasil ditambahkan." };
}

function getAdminUsers() {
  var sheet = getSheet("USERS");
  var data = sheet.getDataRange().getValues();
  var result = [];
  for (var i = 1; i < data.length; i++) {
    result.push({
      id_user: data[i][0],
      username: data[i][1],
      nama_lengkap: data[i][3],
      role: data[i][4],
      created_at: data[i][5]
    });
  }
  return result;
}

// -------------------------------------------------------------
// PENGAMBILAN DATA (PUBLIK & INTERN ADMIN)
// -------------------------------------------------------------
// Tambahkan fungsi pembantu format tanggal aman di Code.gs
function formatTanggal(val, pattern) {
  if (!val) return "-";
  try {
    var d = (val instanceof Date) ? val : new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return Utilities.formatDate(d, "Asia/Jakarta", pattern || "yyyy-MM-dd HH:mm");
  } catch (e) {
    return String(val);
  }
}

// Perbaikan getDashboardData (bebas dari objek Date mentah & aman dari baris kosong)
function getDashboardData(tahun, isAdmin) {
  tahun = tahun ? parseInt(tahun) : new Date().getFullYear();
  
  // 1. Data Transaksi Kas
  var kasSheet = getSheet("TRANSAKSI_KAS");
  var rawKas = kasSheet.getDataRange().getValues();
  var totalMasuk = 0;
  var totalKeluar = 0;
  var transaksiKas = [];

  for (var i = 1; i < rawKas.length; i++) {
    var row = rawKas[i];
    if (!row[0] || String(row[0]).trim() === "") continue; // Lewati baris kosong

    var status = String(row[6] || "AKTIF");
    var nominal = Number(row[4]) || 0;
    var jenis = String(row[2] || "");

    if (status === "AKTIF") {
      if (jenis === "Pemasukan") totalMasuk += nominal;
      if (jenis === "Pengeluaran") totalKeluar += nominal;
    }

    if (isAdmin || status === "AKTIF") {
      transaksiKas.push({
        id_transaksi: String(row[0]),
        tgl_transaksi: formatTanggal(row[1], "yyyy-MM-dd HH:mm"),
        jenis: jenis,
        kategori: String(row[3] || "-"),
        nominal: nominal,
        keterangan: String(row[5] || "-"),
        status: status,
        user_input: String(row[7] || "-")
      });
    }
  }

  transaksiKas.reverse();

  // 2. Data Warga (Konversi semua field menjadi String)
  var wargaSheet = getSheet("WARGA");
  var rawWarga = wargaSheet.getDataRange().getValues();
  var daftarWarga = [];

  for (var w = 1; w < rawWarga.length; w++) {
    var wRow = rawWarga[w];
    if (!wRow[0] || String(wRow[0]).trim() === "") continue; // Lewati baris kosong

    var statusWarga = String(wRow[4] || "Aktif");
    if (isAdmin || statusWarga === "Aktif") {
      daftarWarga.push({
        id_warga: String(wRow[0]),
        no_kk: isAdmin ? String(wRow[1] || "-") : "*** DISAMARKAN ***",
        nama_kk: String(wRow[2] || "Tanpa Nama"),
        no_hp: isAdmin ? String(wRow[3] || "-") : "*** DISAMARKAN ***",
        status_aktif: statusWarga,
        tgl_terdaftar: formatTanggal(wRow[5], "yyyy-MM-dd") // Aman: dikirim sebagai String
      });
    }
  }

  // Pengurutan aman terhadap nama non-string
  daftarWarga.sort(function(a, b) {
    return String(a.nama_kk).localeCompare(String(b.nama_kk));
  });

  // 3. Data Iuran Bulanan
  var iuranSheet = getSheet("IURAN_BULANAN");
  var rawIuran = iuranSheet.getDataRange().getValues();
  var iuranMap = {};

  for (var u = 1; u < rawIuran.length; u++) {
    var uRow = rawIuran[u];
    if (!uRow[0] || String(uRow[0]).trim() === "") continue;

    var uTahun = parseInt(uRow[2]);
    if (uTahun === tahun) {
      var idW = String(uRow[1]);
      var bln = parseInt(uRow[3]);
      if (!iuranMap[idW]) iuranMap[idW] = {};
      iuranMap[idW][bln] = {
        id_iuran: String(uRow[0]),
        status: String(uRow[6] || "Belum Lunas"),
        nominal: Number(uRow[4]) || 0,
        tgl_bayar: formatTanggal(uRow[5], "dd/MM/yyyy"),
        id_transaksi_kas: String(uRow[7] || "")
      };
    }
  }

  var matrixIuran = daftarWarga.map(function(w) {
    var bulanData = {};
    for (var m = 1; m <= 12; m++) {
      if (iuranMap[w.id_warga] && iuranMap[w.id_warga][m]) {
        bulanData[m] = iuranMap[w.id_warga][m].status;
      } else {
        bulanData[m] = "Belum Lunas";
      }
    }
    return {
      id_warga: w.id_warga,
      nama_kk: w.nama_kk,
      no_kk: w.no_kk,
      no_hp: w.no_hp,
      bulan: bulanData
    };
  });

  // 4. Data Anggaran Kerja
  var anggaranSheet = getSheet("ANGGARAN_KERJA");
  var rawAnggaran = anggaranSheet.getDataRange().getValues();
  var daftarAnggaran = [];

  for (var a = 1; a < rawAnggaran.length; a++) {
    var aRow = rawAnggaran[a];
    if (!aRow[0] || String(aRow[0]).trim() === "") continue;

    if (parseInt(aRow[1]) === tahun) {
      daftarAnggaran.push({
        id_program: String(aRow[0]),
        tahun: parseInt(aRow[1]),
        nama_kegiatan: String(aRow[2] || "-"),
        target_anggaran: Number(aRow[3]) || 0,
        realisasi_anggaran: Number(aRow[4]) || 0,
        keterangan: String(aRow[5] || ""),
        status_program: String(aRow[6] || "Direncanakan")
      });
    }
  }

  // 5. Data Log Audit
  var logs = [];
  if (isAdmin) {
    var logSheet = getSheet("LOG_AUDIT");
    var rawLogs = logSheet.getDataRange().getValues();
    for (var l = rawLogs.length - 1; l >= Math.max(1, rawLogs.length - 100); l--) {
      if (!rawLogs[l][0] || String(rawLogs[l][0]).trim() === "") continue;
      logs.push({
        id_log: String(rawLogs[l][0]),
        timestamp: formatTanggal(rawLogs[l][1], "dd/MM/yyyy HH:mm:ss"),
        user_pelaksana: String(rawLogs[l][2] || "Sistem"),
        tipe_aksi: String(rawLogs[l][3] || "-"),
        id_referensi: String(rawLogs[l][4] || "-"),
        alasan_keterangan: String(rawLogs[l][5] || "-")
      });
    }
  }

  return {
    tahun: tahun,
    ringkasan: {
      totalMasuk: totalMasuk,
      totalKeluar: totalKeluar,
      saldoKas: totalMasuk - totalKeluar,
      totalWarga: daftarWarga.length
    },
    transaksiKas: transaksiKas,
    matrixIuran: matrixIuran,
    daftarWarga: daftarWarga,
    daftarAnggaran: daftarAnggaran,
    logs: logs
  };
}

// Perbaikan simpanWarga: simpan No KK & No HP sebagai teks murni agar tidak terpotong
function simpanWarga(data, adminUser) {
  var sheet = getSheet("WARGA");
  var raw = sheet.getDataRange().getValues();
  
  if (data.id_warga) {
    for (var i = 1; i < raw.length; i++) {
      if (raw[i][0] === data.id_warga) {
        sheet.getRange(i + 1, 2, 1, 4).setValues([[
          "'" + String(data.no_kk || "").replace(/'/g, ""),
          String(data.nama_kk || "").trim(),
          "'" + String(data.no_hp || "").replace(/'/g, ""),
          data.status_aktif || "Aktif"
        ]]);
        logActivity(adminUser, "UPDATE_WARGA", data.id_warga, "Memperbarui warga: " + data.nama_kk);
        return { success: true, message: "Data warga berhasil diperbarui." };
      }
    }
  } else {
    var newId = generateId("WRG");
    sheet.appendRow([
      newId,
      "'" + String(data.no_kk || "").replace(/'/g, ""),
      String(data.nama_kk || "").trim(),
      "'" + String(data.no_hp || "").replace(/'/g, ""),
      "Aktif",
      Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd")
    ]);
    logActivity(adminUser, "TAMBAH_WARGA", newId, "Menambahkan kepala keluarga: " + data.nama_kk);
    return { success: true, message: "Kepala keluarga berhasil ditambahkan." };
  }
}

// -------------------------------------------------------------
// MANAJEMEN WARGA (ADMIN)
// -------------------------------------------------------------
function simpanWarga(data, adminUser) {
  var sheet = getSheet("WARGA");
  var raw = sheet.getDataRange().getValues();
  
  if (data.id_warga) {
    // Mode Edit
    for (var i = 1; i < raw.length; i++) {
      if (raw[i][0] === data.id_warga) {
        sheet.getRange(i + 1, 2, 1, 4).setValues([[
          data.no_kk,
          data.nama_kk,
          data.no_hp,
          data.status_aktif || "Aktif"
        ]]);
        logActivity(adminUser, "UPDATE_WARGA", data.id_warga, "Memperbarui data warga: " + data.nama_kk);
        return { success: true, message: "Data warga berhasil diperbarui." };
      }
    }
  } else {
    // Mode Baru
    var newId = generateId("WRG");
    sheet.appendRow([
      newId,
      data.no_kk,
      data.nama_kk,
      data.no_hp,
      "Aktif",
      Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd")
    ]);
    logActivity(adminUser, "TAMBAH_WARGA", newId, "Menambahkan kepala keluarga baru: " + data.nama_kk);
    return { success: true, message: "Kepala keluarga berhasil ditambahkan." };
  }
}

function hapusWarga(id_warga, adminUser) {
  var sheet = getSheet("WARGA");
  var raw = sheet.getDataRange().getValues();
  for (var i = 1; i < raw.length; i++) {
    if (raw[i][0] === id_warga) {
      var namaKK = raw[i][2];
      sheet.deleteRow(i + 1);
      logActivity(adminUser, "HAPUS_WARGA", id_warga, "Menghapus warga: " + namaKK);
      return { success: true, message: "Data warga berhasil dihapus." };
    }
  }
  return { success: false, message: "Data warga tidak ditemukan." };
}

// -------------------------------------------------------------
// TRANSAKSI KAS & PEMBAYARAN IURAN MULTI-BULAN
// -------------------------------------------------------------
function simpanKasManual(data, adminUser) {
  var sheet = getSheet("TRANSAKSI_KAS");
  var newId = generateId("TRX");
  var nominal = Math.abs(Number(data.nominal));

  sheet.appendRow([
    newId,
    data.tgl_transaksi || new Date(),
    data.jenis, // "Pemasukan" atau "Pengeluaran"
    data.kategori,
    nominal,
    data.keterangan,
    "AKTIF",
    adminUser
  ]);

  logActivity(adminUser, "INPUT_KAS", newId, data.jenis + " sebesar Rp " + nominal.toLocaleString("id-ID") + " - " + data.keterangan);
  return { success: true, message: "Transaksi kas berhasil disimpan." };
}

function prosesBayarIuranMultiBulan(param, adminUser) {
  // param: { id_warga, nama_kk, tahun, bulanArray: [1, 2, 3...] }
  var nominalPerBulan = 10000;
  var jumlahBulan = param.bulanArray.length;
  if (jumlahBulan === 0) {
    return { success: false, message: "Pilih minimal 1 bulan iuran." };
  }

  var totalNominal = jumlahBulan * nominalPerBulan;
  var bulanNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  var listNamaBulan = param.bulanArray.map(function(b) { return bulanNames[b - 1]; }).join(", ");

  var idTrxKas = generateId("TRX-IUR");
  var kasSheet = getSheet("TRANSAKSI_KAS");
  var tglSekarang = new Date();
  var ketKas = "Iuran Kas - " + param.nama_kk + " (" + listNamaBulan + " " + param.tahun + ")";

  // 1. Simpan 1 baris di TRANSAKSI_KAS
  kasSheet.appendRow([
    idTrxKas,
    tglSekarang,
    "Pemasukan",
    "Iuran Warga",
    totalNominal,
    ketKas,
    "AKTIF",
    adminUser
  ]);

  // 2. Update atau Insert record di IURAN_BULANAN
  var iuranSheet = getSheet("IURAN_BULANAN");
  var rawIuran = iuranSheet.getDataRange().getValues();

  param.bulanArray.forEach(function(bln) {
    var foundIndex = -1;
    for (var r = 1; r < rawIuran.length; r++) {
      if (rawIuran[r][1] === param.id_warga && parseInt(rawIuran[r][2]) === parseInt(param.tahun) && parseInt(rawIuran[r][3]) === parseInt(bln)) {
        foundIndex = r + 1;
        break;
      }
    }

    if (foundIndex > -1) {
      iuranSheet.getRange(foundIndex, 5, 1, 4).setValues([[
        nominalPerBulan,
        tglSekarang,
        "Lunas",
        idTrxKas
      ]]);
    } else {
      iuranSheet.appendRow([
        generateId("IUR"),
        param.id_warga,
        parseInt(param.tahun),
        parseInt(bln),
        nominalPerBulan,
        tglSekarang,
        "Lunas",
        idTrxKas
      ]);
    }
  });

  logActivity(adminUser, "BAYAR_IURAN", idTrxKas, "Penerimaan iuran " + param.nama_kk + " (" + jumlahBulan + " bulan: Rp " + totalNominal.toLocaleString("id-ID") + ")");
  return { success: true, message: "Pembayaran iuran " + jumlahBulan + " bulan berhasil dicatat!" };
}

// -------------------------------------------------------------
// PEMBATALAN TRANSAKSI (VOID & AUTO-ROLLBACK IURAN)
// -------------------------------------------------------------
function batalkanTransaksiKas(idTransaksi, alasan, adminUser) {
  var kasSheet = getSheet("TRANSAKSI_KAS");
  var rawKas = kasSheet.getDataRange().getValues();
  var foundKasIndex = -1;
  var jenis = "";
  var nominal = 0;
  var keterangan = "";

  for (var i = 1; i < rawKas.length; i++) {
    if (rawKas[i][0] === idTransaksi) {
      if (rawKas[i][6] === "DIBATALKAN") {
        return { success: false, message: "Transaksi ini sudah dibatalkan sebelumnya." };
      }
      foundKasIndex = i + 1;
      jenis = rawKas[i][2];
      nominal = rawKas[i][4];
      keterangan = rawKas[i][5];
      break;
    }
  }

  if (foundKasIndex === -1) {
    return { success: false, message: "ID Transaksi tidak ditemukan." };
  }

  // 1. Ubah status transaksi menjadi DIBATALKAN (Soft Delete)
  kasSheet.getRange(foundKasIndex, 7).setValue("DIBATALKAN");

  // 2. Rollback Iuran Bulanan jika transaksi ini berasal dari pembayaran iuran
  var iuranSheet = getSheet("IURAN_BULANAN");
  var rawIuran = iuranSheet.getDataRange().getValues();
  var rollbackCount = 0;

  for (var j = 1; j < rawIuran.length; j++) {
    if (rawIuran[j][7] === idTransaksi) {
      // Kolom: nominal, tgl_bayar, status_bayar, id_transaksi_kas
      iuranSheet.getRange(j + 1, 6, 1, 3).setValues([[
        "",            // tgl_bayar kosong
        "Belum Lunas", // status kembali belum lunas
        ""             // kosongkan link id_transaksi
      ]]);
      rollbackCount++;
    }
  }

  // 3. Catat di Log Audit
  var catatanLog = "Membatalkan TRX " + idTransaksi + " (" + jenis + " Rp " + Number(nominal).toLocaleString("id-ID") + "). Alasan: " + alasan;
  if (rollbackCount > 0) {
    catatanLog += " | Otomatis mengembalikan " + rollbackCount + " bulan iuran menjadi Belum Lunas.";
  }
  logActivity(adminUser, "PEMBATALAN_KAS", idTransaksi, catatanLog);

  return { 
    success: true, 
    message: "Transaksi berhasil dibatalkan!" + (rollbackCount > 0 ? " (" + rollbackCount + " status iuran warga berhasil di-rollback ke Belum Lunas)." : "")
  };
}

// -------------------------------------------------------------
// MANAJEMEN ANGGARAN KERJA (ADMIN)
// -------------------------------------------------------------
function simpanAnggaran(data, adminUser) {
  var sheet = getSheet("ANGGARAN_KERJA");
  var raw = sheet.getDataRange().getValues();

  if (data.id_program) {
    for (var i = 1; i < raw.length; i++) {
      if (raw[i][0] === data.id_program) {
        sheet.getRange(i + 1, 2, 1, 6).setValues([[
          parseInt(data.tahun),
          data.nama_kegiatan,
          Number(data.target_anggaran) || 0,
          Number(data.realisasi_anggaran) || 0,
          data.keterangan || "",
          data.status_program || "Direncanakan"
        ]]);
        logActivity(adminUser, "UPDATE_ANGGARAN", data.id_program, "Memperbarui anggaran: " + data.nama_kegiatan);
        return { success: true, message: "Program kerja berhasil diperbarui." };
      }
    }
  } else {
    var newId = generateId("PRG");
    sheet.appendRow([
      newId,
      parseInt(data.tahun),
      data.nama_kegiatan,
      Number(data.target_anggaran) || 0,
      Number(data.realisasi_anggaran) || 0,
      data.keterangan || "",
      data.status_program || "Direncanakan"
    ]);
    logActivity(adminUser, "TAMBAH_ANGGARAN", newId, "Menambahkan program kerja: " + data.nama_kegiatan);
    return { success: true, message: "Program kerja berhasil ditambahkan." };
  }
}

function hapusAnggaran(id_program, adminUser) {
  var sheet = getSheet("ANGGARAN_KERJA");
  var raw = sheet.getDataRange().getValues();
  for (var i = 1; i < raw.length; i++) {
    if (raw[i][0] === id_program) {
      sheet.deleteRow(i + 1);
      logActivity(adminUser, "HAPUS_ANGGARAN", id_program, "Menghapus mata anggaran");
      return { success: true, message: "Program anggaran berhasil dihapus." };
    }
  }
  return { success: false, message: "Program tidak ditemukan." };
}

// -------------------------------------------------------------
// EXPORT LAPORAN KE PDF LANGSUNG
// -------------------------------------------------------------
function exportPdfLaporan(tipeLaporan, tahun) {
  tahun = tahun ? parseInt(tahun) : new Date().getFullYear();
  var db = getDashboardData(tahun, false);
  var tglCetak = Utilities.formatDate(new Date(), "Asia/Jakarta", "dd MMMM yyyy, HH:mm");

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8">';
  html += '<style>';
  html += 'body { font-family: Arial, sans-serif; font-size: 11px; color: #1f2937; margin: 20px; }';
  html += '.header { text-align: center; border-bottom: 2px solid #065F46; padding-bottom: 8px; margin-bottom: 15px; }';
  html += '.header h2 { margin: 0; color: #065F46; font-size: 16px; text-transform: uppercase; }';
  html += '.header h4 { margin: 4px 0 0 0; color: #374151; font-weight: normal; font-size: 12px; }';
  html += '.badge-box { background: #F0FDF4; border: 1px solid #BBF7D0; padding: 10px; border-radius: 6px; margin-bottom: 15px; }';
  html += 'table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }';
  html += 'th, td { border: 1px solid #D1D5DB; padding: 6px 8px; text-align: left; }';
  html += 'th { background-color: #065F46; color: white; font-weight: bold; font-size: 10px; text-align: center; }';
  html += '.text-right { text-align: right; }';
  html += '.text-center { text-align: center; }';
  html += '.lunas { background-color: #DCFCE7; color: #166534; font-weight: bold; text-align: center; }';
  html += '.belum { background-color: #FEE2E2; color: #991B1B; font-weight: bold; text-align: center; }';
  html += '.ttd-table { margin-top: 30px; border: none; width: 100%; }';
  html += '.ttd-table td { border: none; text-align: center; width: 50%; }';
  html += '</style></head><body>';

  html += '<div class="header">';
  html += '<h2>RUKUN TETANGGA 001 RUKUN WARGA 001</h2>';
  html += '<h4>DUKUH GAJAH, DESA SUROREJAN, KECAMATAN PURING, KABUPATEN KEBUMEN</h4>';
  html += '<p style="margin:4px 0 0 0; font-size:10px; color:#6B7280;">Laporan Keuangan & Iuran Periode Tahun ' + tahun + ' (Dicetak pada: ' + tglCetak + ' WIB)</p>';
  html += '</div>';

  html += '<div class="badge-box">';
  html += '<strong>RINGKASAN SALDO KAS SAAT INI:</strong><br>';
  html += '• Total Pemasukan: <b>Rp ' + db.ringkasan.totalMasuk.toLocaleString('id-ID') + '</b><br>';
  html += '• Total Pengeluaran: <b>Rp ' + db.ringkasan.totalKeluar.toLocaleString('id-ID') + '</b><br>';
  html += '• <strong>Saldo Kas Bersih: Rp ' + db.ringkasan.saldoKas.toLocaleString('id-ID') + '</strong>';
  html += '</div>';

  if (tipeLaporan === "KAS" || tipeLaporan === "SEMUA") {
    html += '<h3>Buku Kas Umum (Pemasukan & Pengeluaran)</h3>';
    html += '<table>';
    html += '<tr><th style="width:5%">No</th><th style="width:18%">Tanggal</th><th style="width:12%">Jenis</th><th style="width:18%">Kategori</th><th>Keterangan</th><th style="width:18%">Nominal</th></tr>';
    
    var count = 1;
    db.transaksiKas.forEach(function(t) {
      if (t.status === "AKTIF") {
        html += '<tr>';
        html += '<td class="text-center">' + (count++) + '</td>';
        html += '<td>' + t.tgl_transaksi + '</td>';
        html += '<td>' + t.jenis + '</td>';
        html += '<td>' + t.kategori + '</td>';
        html += '<td>' + t.keterangan + '</td>';
        html += '<td class="text-right">Rp ' + t.nominal.toLocaleString('id-ID') + '</td>';
        html += '</tr>';
      }
    });
    html += '</table>';
  }

  if (tipeLaporan === "IURAN" || tipeLaporan === "SEMUA") {
    html += '<h3>Status Pembayaran Iuran Warga Tahun ' + tahun + ' (Rp 10.000 / Bulan)</h3>';
    html += '<table>';
    html += '<tr><th style="width:5%">No</th><th>Nama Kepala Keluarga</th>';
    var blnSingkat = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    blnSingkat.forEach(function(b) { html += '<th style="width:5%">' + b + '</th>'; });
    html += '</tr>';

    db.matrixIuran.forEach(function(w, idx) {
      html += '<tr>';
      html += '<td class="text-center">' + (idx + 1) + '</td>';
      html += '<td><b>' + w.nama_kk + '</b></td>';
      for (var m = 1; m <= 12; m++) {
        var isLunas = w.bulan[m] === "Lunas";
        html += '<td class="' + (isLunas ? 'lunas' : 'belum') + '">' + (isLunas ? 'L' : '-') + '</td>';
      }
      html += '</tr>';
    });
    html += '</table>';
    html += '<p style="font-size:9px; color:#4B5563;">* Keterangan: <b>L</b> = Lunas (Rp 10.000), <b>-</b> = Belum Lunas</p>';
  }

  // Tanda Tangan Pengurus RT
  html += '<table class="ttd-table">';
  html += '<tr>';
  html += '<td>Mengetahui,<br><b>Ketua RT 001 RW 001</b><br><br><br><br>_____________________</td>';
  html += '<td>Surorejan, ' + Utilities.formatDate(new Date(), "Asia/Jakarta", "dd MMMM yyyy") + '<br><b>Bendahara RT 001</b><br><br><br><br>_____________________</td>';
  html += '</tr>';
  html += '</table>';

  html += '</body></html>';

  var blob = Utilities.newBlob(html, "text/html", "Laporan.html").getAs("application/pdf");
  var filename = "Laporan_Kas_RT01_RW01_Tahun_" + tahun + ".pdf";

  return {
    filename: filename,
    base64: Utilities.base64Encode(blob.getBytes())
  };
}


// =============================================================
// RT API BRIDGE - FRONTEND GITHUB -> GOOGLE APPS SCRIPT
// =============================================================
// Lapisan ini hanya menjadi penghubung API. Business logic yang
// sudah ada di atas sengaja tidak diubah.
//
// Frontend eksternal sebaiknya mengirim POST sederhana dengan
// field "payload" berisi JSON string. Hindari application/json
// agar browser tidak memerlukan CORS preflight OPTIONS.
//
// Format request:
// {
//   "action": "loginAdmin",
//   "username": "...",
//   "password": "..."
// }
//
// Untuk action admin, gunakan:
// {
//   "action": "namaAction",
//   "token": "TOKEN_DARI_LOGIN",
//   ...parameter action...
// }

var API_SESSION_PREFIX = "RT_API_SESSION_";
var API_SESSION_TTL_SECONDS = 21600; // 6 jam

function apiJsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function apiParseRequest(e) {
  try {
    if (e && e.postData && e.postData.contents) {
      var raw = String(e.postData.contents).trim();
      if (raw) {
        try {
          return JSON.parse(raw);
        } catch (jsonError) {
          // Bukan JSON; lanjut ke parameter payload.
        }
      }
    }

    if (e && e.parameter && e.parameter.payload) {
      return JSON.parse(String(e.parameter.payload));
    }

    if (e && e.parameter) {
      return e.parameter;
    }

    return {};
  } catch (err) {
    throw new Error("Format request API tidak valid.");
  }
}

function apiCreateSession(user) {
  var token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
  var session = {
    username: user.username,
    id_user: user.id_user,
    nama_lengkap: user.nama_lengkap,
    role: user.role,
    created_at: new Date().toISOString()
  };

  CacheService.getScriptCache().put(
    API_SESSION_PREFIX + token,
    JSON.stringify(session),
    API_SESSION_TTL_SECONDS
  );

  return token;
}

function apiGetSession(token) {
  if (!token) return null;

  var raw = CacheService.getScriptCache().get(API_SESSION_PREFIX + String(token));
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function apiRequireSession(token) {
  var session = apiGetSession(token);
  if (!session) {
    throw new Error("Sesi admin tidak valid atau sudah kedaluwarsa. Silakan login kembali.");
  }
  return session;
}

function apiLogout(token) {
  if (token) {
    CacheService.getScriptCache().remove(API_SESSION_PREFIX + String(token));
  }
  return { success: true, message: "Logout berhasil." };
}

function apiHandleAction(request) {
  var action = String(request.action || "").trim();

  if (!action) {
    throw new Error("Parameter action wajib diisi.");
  }

  // -----------------------------------------------------------
  // PUBLIC ACTIONS
  // -----------------------------------------------------------
  if (action === "health") {
    var spreadsheetStatus = {
      connected: false,
      name: ""
    };

    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      if (ss) {
        spreadsheetStatus.connected = !!ss.getId();
        spreadsheetStatus.name = ss.getName();
      }
    } catch (healthSheetError) {
      spreadsheetStatus.connected = false;
    }

    return {
      success: true,
      service: "Kas RT API",
      status: "online",
      backend: "online",
      spreadsheet: spreadsheetStatus,
      timestamp: new Date().toISOString()
    };
  }

  if (action === "loginAdmin") {
    var loginResult = loginAdmin(
      String(request.username || ""),
      String(request.password || "")
    );

    if (!loginResult || !loginResult.success) {
      return loginResult || {
        success: false,
        message: "Login gagal."
      };
    }

    var token = apiCreateSession(loginResult.user);

    return {
      success: true,
      user: loginResult.user,
      token: token,
      expires_in: API_SESSION_TTL_SECONDS
    };
  }

  if (action === "logout") {
    return apiLogout(request.token);
  }

  // Data publik tetap menggunakan mode non-admin sehingga
  // No KK dan No HP tetap disamarkan seperti aplikasi saat ini.
  if (action === "getDashboardData") {
    var publicYear = request.tahun ? parseInt(request.tahun, 10) : new Date().getFullYear();
    return {
      success: true,
      data: getDashboardData(publicYear, false)
    };
  }

  // Export PDF saat ini memang menggunakan mode publik/non-admin.
  if (action === "exportPdfLaporan") {
    var pdfYear = request.tahun ? parseInt(request.tahun, 10) : new Date().getFullYear();
    var pdfType = String(request.tipeLaporan || "SEMUA");
    return {
      success: true,
      data: exportPdfLaporan(pdfType, pdfYear)
    };
  }

  // -----------------------------------------------------------
  // PROTECTED ADMIN ACTIONS
  // -----------------------------------------------------------
  var session = apiRequireSession(request.token);
  var adminUser = session.username;

  switch (action) {
    case "getDashboardDataAdmin":
      var adminYear = request.tahun ? parseInt(request.tahun, 10) : new Date().getFullYear();
      return {
        success: true,
        data: getDashboardData(adminYear, true)
      };

    case "changePassword":
      return changePassword(
        adminUser,
        String(request.oldPassword || ""),
        String(request.newPassword || "")
      );

    case "tambahAdmin":
      return tambahAdmin(
        adminUser,
        String(request.username || ""),
        String(request.password || ""),
        String(request.namaLengkap || ""),
        String(request.role || "Admin")
      );

    case "getAdminUsers":
      return {
        success: true,
        data: getAdminUsers()
      };

    case "simpanKasManual":
      return simpanKasManual(
        request.data || {},
        adminUser
      );

    case "prosesBayarIuranMultiBulan":
      return prosesBayarIuranMultiBulan(
        request.param || {},
        adminUser
      );

    case "batalkanTransaksiKas":
      return batalkanTransaksiKas(
        String(request.idTransaksi || ""),
        String(request.alasan || ""),
        adminUser
      );

    case "simpanWarga":
      return simpanWarga(
        request.data || {},
        adminUser
      );

    case "hapusWarga":
      return hapusWarga(
        String(request.id_warga || ""),
        adminUser
      );

    case "simpanAnggaran":
      return simpanAnggaran(
        request.data || {},
        adminUser
      );

    case "hapusAnggaran":
      return hapusAnggaran(
        String(request.id_program || ""),
        adminUser
      );

    default:
      throw new Error("Action API tidak dikenal atau tidak diizinkan: " + action);
  }
}

function doPost(e) {
  try {
    var request = apiParseRequest(e);
    var result = apiHandleAction(request);

    return apiJsonResponse({
      success: result && result.success !== false,
      result: result
    });
  } catch (err) {
    return apiJsonResponse({
      success: false,
      message: err && err.message ? err.message : String(err)
    });
  }
}

// Mendukung request GET sederhana untuk health-check dan data publik.
// doGet normal tetap menjalankan aplikasi GAS apabila parameter api
// tidak diberikan.
function getApiBridgeHtml() {
  var html = '<!doctype html><html><head><base target="_top"></head><body>' +
    '<script>' +
    '(function() {' +
    '  var ALLOWED_PARENT_ORIGIN = "https://klungdingbrag.github.io";' +
    '  window.addEventListener("message", function(event) {' +
    '    if (event.origin !== ALLOWED_PARENT_ORIGIN) return;' +
    '    if (!event.source || !event.data || event.data.type !== "RTNAN_API_REQUEST") return;' +
    '    var requestId = String(event.data.requestId || "");' +
    '    var payload = event.data.payload;' +
    '    if (!requestId || !payload || typeof payload !== "object") return;' +
    '    google.script.run' +
    '      .withSuccessHandler(function(result) {' +
    '        event.source.postMessage({' +
    '          type: "RTNAN_API_RESPONSE",' +
    '          requestId: requestId,' +
    '          ok: true,' +
    '          result: result' +
    '        }, event.origin);' +
    '      })' +
    '      .withFailureHandler(function(error) {' +
    '        event.source.postMessage({' +
    '          type: "RTNAN_API_RESPONSE",' +
    '          requestId: requestId,' +
    '          ok: false,' +
    '          error: error && error.message ? error.message : String(error)' +
    '        }, ALLOWED_PARENT_ORIGIN);' +
    '      })' +
    '      .apiHandleAction(payload);' +
    '  });' +
    '  window.parent.postMessage({ type: "RTNAN_API_READY" }, "*");' +
    '})();' +
    '<\/script></body></html>';

  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doGet(e) {
  if (e && e.parameter && e.parameter.bridge === "1") {
    return getApiBridgeHtml();
  }

  if (e && e.parameter && e.parameter.api === "1") {
    try {
      var request = e.parameter.payload
        ? JSON.parse(String(e.parameter.payload))
        : e.parameter;

      var result = apiHandleAction(request);

      return apiJsonResponse({
        success: result && result.success !== false,
        result: result
      });
    } catch (err) {
      return apiJsonResponse({
        success: false,
        message: err && err.message ? err.message : String(err)
      });
    }
  }

  var template = HtmlService.createTemplateFromFile("index");
  return template.evaluate()
    .setTitle("Kas RT.001 RW.001 Dk. Gajah - Desa Surorejan")
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
