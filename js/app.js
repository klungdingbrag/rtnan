// =============================================================
// FRONTEND STATE
// Transport API berada di js/api.js.
// File ini fokus pada UI, state, rendering, modal, dan event.
// =============================================================

const SESSION_STORAGE_KEY = "KAS_RT_SESSION";

let state = {
  user: null,
  token: null,
  tahun: new Date().getFullYear(),
  dashboardData: null
};

const BULAN_NAMES = [
  "Januari", "Februari", "Maret", "April",
  "Mei", "Juni", "Juli", "Agustus",
  "September", "Oktober", "November", "Desember"
];

console.info("[KAS RT] UI build: 20260921-04");

  function saveSession(result) {
    if (!result || !result.token || !result.user) {
      throw new Error("Respons login tidak memiliki token/user yang valid.");
    }

    state.token = result.token;
    state.user = result.user;

    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      token: result.token,
      user: result.user
    }));
  }

  function restoreSession() {
    const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!saved) return false;

    try {
      const session = JSON.parse(saved);

      if (!session || !session.token || !session.user) {
        clearSession();
        return false;
      }

      state.token = session.token;
      state.user = session.user;
      return true;
    } catch (e) {
      clearSession();
      return false;
    }
  }

  function clearSession() {
    state.token = null;
    state.user = null;
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }

  function requireToken() {
    if (!state.token) {
      throw new Error("Sesi admin tidak ditemukan. Silakan login kembali.");
    }
    return state.token;
  }

  async function apiLogin(username, password) {
    return apiRequest("loginAdmin", {
      username: username,
      password: password
    });
  }

  async function apiLogout() {
    if (!state.token) return null;

    try {
      return await apiRequest("logout", {
        token: state.token
      });
    } finally {
      clearSession();
    }
  }

  // -------------------------------------------------------------
  // SYSTEM CONNECTION MONITOR
  // -------------------------------------------------------------
  let connectionCheckInProgress = false;

  function setStatusPill(id, status, label) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = "status-pill " + status;
    el.innerText = label;
  }

  function setConnectionStatus(status, label) {
    const dot = document.getElementById("connectionStatusDot");
    const text = document.getElementById("connectionStatusLabel");
    if (dot) dot.className = "status-dot status-" + status;
    if (text) text.innerText = label;
  }

  function formatConnectionTime(date) {
    return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function updateConnectionDetailUI(detail) {
    setStatusPill("statusFrontend", detail.frontend ? "online" : "offline", detail.frontend ? "Online" : "Offline");
    setStatusPill("statusApi", detail.api ? "online" : "offline", detail.api ? "Connected" : "Offline");
    setStatusPill("statusBackend", detail.backend ? "online" : "offline", detail.backend ? "Responding" : "Offline");
    setStatusPill("statusSheets", detail.sheets ? "online" : "offline", detail.sheets ? "Accessible" : "Unavailable");
    setStatusPill("statusSession", detail.session ? "online" : "offline", detail.session ? "Active" : "Not active");
    const last = document.getElementById("statusLastCheck");
    const rt = document.getElementById("statusResponseTime");
    const err = document.getElementById("statusErrorMessage");
    if (last) last.innerText = detail.checkedAt || "-";
    if (rt) rt.innerText = detail.responseMs != null ? detail.responseMs + " ms" : "-";
    if (err) {
      err.innerText = detail.error || "";
      err.classList.toggle("hidden", !detail.error);
    }
  }

  async function checkBackendHealth(silent = false) {
    if (connectionCheckInProgress) return null;
    connectionCheckInProgress = true;

    setConnectionStatus("checking", "Checking...");
    setStatusPill("statusFrontend", "online", "Online");
    setStatusPill("statusApi", "checking", "Checking");
    setStatusPill("statusBackend", "checking", "Checking");
    setStatusPill("statusSheets", "checking", "Checking");
    setStatusPill("statusSession", state.token ? "online" : "offline", state.token ? "Active" : "Not active");

    const startedAt = performance.now();
    try {
      const result = await apiRequest("health");
      const responseMs = Math.round(performance.now() - startedAt);
      const sheetsOk = !!(result && result.spreadsheet && result.spreadsheet.connected);
      updateConnectionDetailUI({
        frontend: true,
        api: true,
        backend: !!(result && result.status === "online"),
        sheets: sheetsOk,
        session: !!state.token,
        checkedAt: formatConnectionTime(new Date()),
        responseMs: responseMs,
        error: sheetsOk ? "" : "API hidup, tetapi koneksi Google Sheets belum terkonfirmasi."
      });
      setConnectionStatus(sheetsOk ? "online" : "offline", sheetsOk ? "Backend Online" : "Backend Partial");
      return result;
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      updateConnectionDetailUI({
        frontend: true,
        api: false,
        backend: false,
        sheets: false,
        session: !!state.token,
        checkedAt: formatConnectionTime(new Date()),
        responseMs: Math.round(performance.now() - startedAt),
        error: message
      });
      setConnectionStatus("offline", "Backend Offline");
      if (!silent) console.error("[KAS RT] Health check gagal:", err);
      return null;
    } finally {
      connectionCheckInProgress = false;
    }
  }

  function openConnectionStatus() {
    openModal("modalConnectionStatus");
    checkBackendHealth(true);
  }

  document.addEventListener("DOMContentLoaded", function() {
    initBulanCheckboxes();
    restoreSession();
    updateAuthUI();
    checkBackendHealth(true);
    loadData();
  });

  function formatRupiah(num) {
    return "Rp " + Number(num || 0).toLocaleString("id-ID");
  }

  // -------------------------------------------------------------
  // TAB NAVIGATION & UI CONTROLLER
  // -------------------------------------------------------------
  function switchTab(tabName) {
    ['kas', 'iuran', 'anggaran', 'adminPanel'].forEach(t => {
      const btn = document.getElementById("tabBtn-" + t);
      const content = document.getElementById("tabContent-" + t);
      if (btn) btn.classList.remove("active-tab");
      if (content) content.classList.add("hidden");
    });

    const activeBtn = document.getElementById("tabBtn-" + tabName);
    const activeContent = document.getElementById("tabContent-" + tabName);
    if (activeBtn) activeBtn.classList.add("active-tab");
    if (activeContent) activeContent.classList.remove("hidden");
  }

  function updateAuthUI() {
    const isLoggedIn = !!state.user && !!state.token;
    document.getElementById("roleBadge").classList.toggle("hidden", !isLoggedIn);
    document.getElementById("btnLogin").classList.toggle("hidden", isLoggedIn);
    document.getElementById("userMenu").classList.toggle("hidden", !isLoggedIn);
    document.getElementById("tabBtn-adminPanel").classList.toggle("hidden", !isLoggedIn);

    document.getElementById("adminKasAction").classList.toggle("hidden", !isLoggedIn);
    document.getElementById("adminIuranAction").classList.toggle("hidden", !isLoggedIn);
    document.getElementById("adminAnggaranAction").classList.toggle("hidden", !isLoggedIn);
    document.getElementById("thAksiKas").classList.toggle("hidden", !isLoggedIn);

    if (isLoggedIn) {
      document.getElementById("labelUser").innerText =
        state.user.nama_lengkap || state.user.username || "Admin";
    }
  }

  // -------------------------------------------------------------
  // DATA FETCHER (GOOGLE SCRIPT RUN)
  // -------------------------------------------------------------
  async function loadData() {
    const selTahun = document.getElementById("selectTahun");
    state.tahun = parseInt(selTahun.value);

    try {
      let result;

      if (state.token) {
        result = await apiRequest("getDashboardDataAdmin", {
          token: state.token,
          tahun: state.tahun
        });
      } else {
        result = await apiRequest("getDashboardData", {
          tahun: state.tahun
        });
      }

      state.dashboardData = result.data || result;
      renderDashboard();
    } catch (err) {
      if (state.token) {
        clearSession();
        updateAuthUI();
      }
      alert("Gagal memuat data: " + err.message);
    }
  }

  function renderDashboard() {
    const data = state.dashboardData;
    if (!data) return;

    // 1. Ringkasan Saldo
    document.getElementById("cardSaldo").innerText = formatRupiah(data.ringkasan.saldoKas);
    document.getElementById("cardMasuk").innerText = formatRupiah(data.ringkasan.totalMasuk);
    document.getElementById("cardKeluar").innerText = formatRupiah(data.ringkasan.totalKeluar);
    document.getElementById("cardWarga").innerText = data.ringkasan.totalWarga + " KK";

    // 2. Tabel Buku Kas
    renderTableKas(data.transaksiKas);

    // 3. Tabel Matrix Iuran
    renderTableIuran(data.matrixIuran);

    // 4. Kartu Rencana & Realisasi Anggaran
    renderAnggaranCards(data.daftarAnggaran);

    // 5. Tabel Panel Admin (Jika Login)
    if (state.user) {
      renderMasterWarga(data.daftarWarga);
      renderAuditLogs(data.logs);
      populateSelectWarga(data.daftarWarga);
    }
  }

  // -------------------------------------------------------------
  // RENDER SECTIONS
  // -------------------------------------------------------------
  function renderTableKas(list) {
    const tbody = document.getElementById("tableKasBody");
    const isAdmin = !!state.user;
    if (!list || list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-slate-400">Belum ada transaksi kas pada periode ini.</td></tr>';
      return;
    }

    let html = "";
    list.forEach(t => {
      const isMasuk = t.jenis === "Pemasukan";
      const isBatal = t.status === "DIBATALKAN";
      
      html += `<tr class="${isBatal ? 'bg-slate-50 opacity-60 line-through' : 'hover:bg-slate-50/80'}">
        <td class="py-3 px-4 text-slate-500 text-[11px]">${t.tgl_transaksi}</td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 rounded text-[11px] font-bold ${isMasuk ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
            ${t.jenis}
          </span>
        </td>
        <td class="py-3 px-4 font-medium text-slate-700">${t.kategori}</td>
        <td class="py-3 px-4 text-slate-600">${t.keterangan}</td>
        <td class="py-3 px-4 text-right font-bold ${isMasuk ? 'text-emerald-700' : 'text-rose-600'}">
          ${formatRupiah(t.nominal)}
        </td>
        <td class="py-3 px-4 text-center">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${isBatal ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}">
            ${t.status}
          </span>
        </td>
        ${isAdmin ? `
          <td class="py-3 px-4 text-center">
            ${!isBatal ? `
              <button onclick="openModalVoid('${t.id_transaksi}')" class="text-[11px] bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2 py-1 rounded transition" title="Batalkan Transaksi">
                Batal (Void)
              </button>
            ` : '<span class="text-[10px] text-slate-400">Dibatalkan</span>'}
          </td>
        ` : ''}
      </tr>`;
    });
    tbody.innerHTML = html;
  }

  function renderTableIuran(matrix) {
    const tbody = document.getElementById("tableIuranBody");
    if (!matrix || matrix.length === 0) {
      tbody.innerHTML = '<tr><td colspan="14" class="py-6 text-center text-slate-400">Belum ada data kepala keluarga.</td></tr>';
      return;
    }

    let html = "";
    matrix.forEach((w, idx) => {
      html += `<tr class="hover:bg-slate-50/80">
        <td class="py-2.5 px-3 text-center text-slate-400">${idx + 1}</td>
        <td class="py-2.5 px-4 font-bold text-slate-800">${w.nama_kk}</td>`;
      
      for (let m = 1; m <= 12; m++) {
        const isLunas = w.bulan[m] === "Lunas";
        html += `<td class="py-2.5 px-1 text-center">
          <span class="${isLunas ? 'badge-lunas' : 'badge-belum'}">
            ${isLunas ? '✓' : '-'}
          </span>
        </td>`;
      }
      html += `</tr>`;
    });
    tbody.innerHTML = html;
  }

  function filterTabelIuran() {
    const input = document.getElementById("searchWarga").value.toLowerCase();
    const rows = document.getElementById("tableIuranBody").getElementsByTagName("tr");
    for (let i = 0; i < rows.length; i++) {
      const namaCol = rows[i].getElementsByTagName("td")[1];
      if (namaCol) {
        const text = namaCol.textContent || namaCol.innerText;
        rows[i].style.display = text.toLowerCase().indexOf(input) > -1 ? "" : "none";
      }
    }
  }

  function renderAnggaranCards(list) {
    const container = document.getElementById("cardsAnggaranContainer");
    const isAdmin = !!state.user;
    if (!list || list.length === 0) {
      container.innerHTML = '<div class="col-span-3 py-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">Belum ada mata anggaran untuk tahun ini.</div>';
      return;
    }

    let html = "";
    list.forEach(item => {
      const persen = item.target_anggaran > 0 ? Math.min(100, Math.round((item.realisasi_anggaran / item.target_anggaran) * 100)) : 0;
      html += `<div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div class="flex items-start justify-between gap-2">
          <h4 class="font-bold text-slate-800 text-sm">${item.nama_kegiatan}</h4>
          <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold ${item.status_program === 'Selesai' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
            ${item.status_program}
          </span>
        </div>
        <p class="text-xs text-slate-500">${item.keterangan || '-'}</p>
        <div class="space-y-1">
          <div class="flex justify-between text-xs">
            <span class="text-slate-500">Realisasi: <b>${formatRupiah(item.realisasi_anggaran)}</b></span>
            <span class="text-slate-500">Target: <b>${formatRupiah(item.target_anggaran)}</b></span>
          </div>
          <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div class="bg-emerald-600 h-2 rounded-full" style="width: ${persen}%"></div>
          </div>
          <p class="text-[10px] text-right text-slate-400 font-semibold">${persen}% terpakai</p>
        </div>
        ${isAdmin ? `
          <div class="pt-2 border-t border-slate-100 flex justify-end gap-2">
            <button onclick='editAnggaran(${JSON.stringify(item)})' class="text-[11px] text-emerald-700 font-semibold hover:underline">Edit</button>
            <button onclick="hapusAnggaranAction('${item.id_program}')" class="text-[11px] text-rose-600 font-semibold hover:underline">Hapus</button>
          </div>
        ` : ''}
      </div>`;
    });
    container.innerHTML = html;
  }

  function renderMasterWarga(list) {
    const tbody = document.getElementById("tableMasterWargaBody");
    if (!list || list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-slate-400">Belum ada data warga.</td></tr>';
      return;
    }

    let html = "";
    list.forEach((w, i) => {
      html += `<tr>
        <td class="py-2.5 px-3 text-slate-400">${i + 1}</td>
        <td class="py-2.5 px-3 font-bold text-slate-800">${w.nama_kk}</td>
        <td class="py-2.5 px-3 font-mono text-slate-600">${w.no_kk}</td>
        <td class="py-2.5 px-3 text-emerald-700 font-semibold">${w.no_hp}</td>
        <td class="py-2.5 px-3 text-center">
          <span class="text-[10px] px-2 py-0.5 rounded-full ${w.status_aktif === 'Aktif' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}">${w.status_aktif}</span>
        </td>
        <td class="py-2.5 px-3 text-center space-x-2">
          <button onclick='editWarga(${JSON.stringify(w)})' class="text-[11px] text-emerald-700 font-bold hover:underline">Edit</button>
          <button onclick="hapusWargaAction('${w.id_warga}')" class="text-[11px] text-rose-600 font-bold hover:underline">Hapus</button>
        </td>
      </tr>`;
    });
    tbody.innerHTML = html;
  }

  function renderAuditLogs(logs) {
    const tbody = document.getElementById("tableAuditBody");
    if (!logs || logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-slate-400">Belum ada riwayat aktivitas.</td></tr>';
      return;
    }

    let html = "";
    logs.forEach(l => {
      html += `<tr class="hover:bg-slate-50">
        <td class="py-2 px-3 text-slate-400 whitespace-nowrap text-[11px]">${l.timestamp}</td>
        <td class="py-2 px-3 font-bold text-slate-700">${l.user_pelaksana}</td>
        <td class="py-2 px-3"><span class="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-600">${l.tipe_aksi}</span></td>
        <td class="py-2 px-3 text-slate-500 font-mono text-[10px]">${l.id_referensi}</td>
        <td class="py-2 px-3 text-slate-600">${l.alasan_keterangan}</td>
      </tr>`;
    });
    tbody.innerHTML = html;
  }

  // -------------------------------------------------------------
  // MODAL LOGIC & ACTIONS
  // -------------------------------------------------------------
  function openModal(id) { document.getElementById(id).classList.remove("hidden"); }
  function closeModal(id) { document.getElementById(id).classList.add("hidden"); }

  function openModalLogin() { openModal("modalLogin"); }
  
  async function submitLogin(e) {
    e.preventDefault();
    const btn = document.getElementById("btnSubmitLogin");
    btn.disabled = true;
    btn.innerText = "Memverifikasi...";

    const u = document.getElementById("loginUsername").value;
    const p = document.getElementById("loginPassword").value;

    try {
      const result = await apiLogin(u, p);
      saveSession(result);

      closeModal("modalLogin");
      updateAuthUI();
      await loadData();
      switchTab("adminPanel");
    } catch (err) {
      alert("Login gagal: " + err.message);
    } finally {
      btn.disabled = false;
      btn.innerText = "Masuk";
    }
  }

  async function logoutAdmin() {
    try {
      await apiLogout();
    } catch (err) {
      clearSession();
    }

    updateAuthUI();
    switchTab("kas");
    loadData();
  }

  // KAS MANUAL
  function openModalKas(jenis) {
    document.getElementById("kasJenis").value = jenis;
    document.getElementById("modalKasTitle").innerText = "Input " + jenis + " Kas";
    document.getElementById("kasNominal").value = "";
    document.getElementById("kasKeterangan").value = "";
    openModal("modalKas");
  }

  async function submitKasManual(e) {
    e.preventDefault();

    const btn = document.getElementById("btnSubmitKas");
    btn.disabled = true;
    btn.innerText = "Menyimpan...";

    const data = {
      jenis: document.getElementById("kasJenis").value,
      kategori: document.getElementById("kasKategori").value,
      nominal: document.getElementById("kasNominal").value,
      keterangan: document.getElementById("kasKeterangan").value
    };

    try {
      const result = await apiRequest("simpanKasManual", {
        token: requireToken(),
        data: data
      });

      closeModal("modalKas");
      alert(result.message || "Transaksi kas berhasil disimpan.");
      await loadData();
    } catch (err) {
      alert("Gagal menyimpan transaksi kas: " + err.message);
    } finally {
      btn.disabled = false;
      btn.innerText = "Simpan Transaksi";
    }
  }

  // BAYAR IURAN MULTI-BULAN
  function initBulanCheckboxes() {
    const container = document.getElementById("bulanCheckboxes");
    let html = "";
    BULAN_NAMES.forEach((b, i) => {
      const idx = i + 1;
      html += `<label class="flex items-center space-x-1.5 p-2 rounded-lg border border-slate-200 hover:bg-emerald-50 cursor-pointer">
        <input type="checkbox" value="${idx}" class="chk-bulan rounded text-emerald-600 focus:ring-emerald-500" onchange="hitungTotalIuran()">
        <span class="text-xs font-semibold text-slate-700">${b.substr(0, 3)}</span>
      </label>`;
    });
    container.innerHTML = html;
  }

  function populateSelectWarga(list) {
    const sel = document.getElementById("iuranPilihWarga");
    let html = '<option value="">-- Pilih Nama Kepala Keluarga --</option>';
    list.forEach(w => {
      html += `<option value="${w.id_warga}" data-nama="${w.nama_kk}">${w.nama_kk}</option>`;
    });
    sel.innerHTML = html;
  }

  function openModalBayarIuran() {
    document.querySelectorAll(".chk-bulan").forEach(c => c.checked = false);
    hitungTotalIuran();
    openModal("modalBayarIuran");
  }

  function togglePilihSemuaBulan() {
    const chks = document.querySelectorAll(".chk-bulan");
    const allChecked = Array.from(chks).every(c => c.checked);
    chks.forEach(c => c.checked = !allChecked);
    hitungTotalIuran();
  }

  function hitungTotalIuran() {
    const chks = document.querySelectorAll(".chk-bulan:checked");
    const total = chks.length * 10000;
    document.getElementById("labelTotalIuran").innerText = formatRupiah(total);
  }

  function submitBayarIuran(e) {
    e.preventDefault();
    const sel = document.getElementById("iuranPilihWarga");
    const idWarga = sel.value;
    const namaKK = sel.options[sel.selectedIndex].getAttribute("data-nama");
    
    const selectedBulan = [];
    document.querySelectorAll(".chk-bulan:checked").forEach(c => {
      selectedBulan.push(parseInt(c.value));
    });

    if (!idWarga) {
      alert("Pilih kepala keluarga terlebih dahulu.");
      return;
    }
    if (selectedBulan.length === 0) {
      alert("Pilih minimal 1 bulan iuran.");
      return;
    }

    const btn = document.getElementById("btnSubmitIuran");
    btn.disabled = true;
    btn.innerText = "Memproses...";

    const param = {
      id_warga: idWarga,
      nama_kk: namaKK,
      tahun: state.tahun,
      bulanArray: selectedBulan
    };

    google.script.run
      .withSuccessHandler(function(res) {
        btn.disabled = false;
        btn.innerText = "Catat Pembayaran Kas";
        closeModal("modalBayarIuran");
        alert(res.message);
        loadData();
      })
      .withFailureHandler(function(err) {
        btn.disabled = false;
        btn.innerText = "Catat Pembayaran Kas";
        alert("Error: " + err.message);
      })
      .prosesBayarIuranMultiBulan(param, state.user.username);
  }

  // VOID / PEMBATALAN
  function openModalVoid(idTrx) {
    document.getElementById("voidIdTransaksi").value = idTrx;
    document.getElementById("voidAlasan").value = "";
    openModal("modalVoid");
  }

  function submitVoidTransaksi(e) {
    e.preventDefault();
    const btn = document.getElementById("btnSubmitVoid");
    btn.disabled = true;

    const idTrx = document.getElementById("voidIdTransaksi").value;
    const alasan = document.getElementById("voidAlasan").value;

    google.script.run
      .withSuccessHandler(function(res) {
        btn.disabled = false;
        closeModal("modalVoid");
        alert(res.message);
        loadData();
      })
      .withFailureHandler(function(err) {
        btn.disabled = false;
        alert("Error: " + err.message);
      })
      .batalkanTransaksiKas(idTrx, alasan, state.user.username);
  }

  // KELOLA WARGA
  function openModalWarga() {
    document.getElementById("wargaId").value = "";
    document.getElementById("wargaNama").value = "";
    document.getElementById("wargaNoKK").value = "";
    document.getElementById("wargaNoHP").value = "";
    document.getElementById("fieldStatusWarga").classList.add("hidden");
    document.getElementById("modalWargaTitle").innerText = "Tambah Kepala Keluarga";
    openModal("modalWarga");
  }

  function editWarga(w) {
    document.getElementById("wargaId").value = w.id_warga;
    document.getElementById("wargaNama").value = w.nama_kk;
    document.getElementById("wargaNoKK").value = w.no_kk;
    document.getElementById("wargaNoHP").value = w.no_hp;
    document.getElementById("wargaStatus").value = w.status_aktif || "Aktif";
    document.getElementById("fieldStatusWarga").classList.remove("hidden");
    document.getElementById("modalWargaTitle").innerText = "Edit Data Warga";
    openModal("modalWarga");
  }

  function submitSimpanWarga(e) {
    e.preventDefault();
    const btn = document.getElementById("btnSubmitWarga");
    btn.disabled = true;

    const data = {
      id_warga: document.getElementById("wargaId").value,
      nama_kk: document.getElementById("wargaNama").value,
      no_kk: document.getElementById("wargaNoKK").value,
      no_hp: document.getElementById("wargaNoHP").value,
      status_aktif: document.getElementById("wargaStatus").value
    };

    google.script.run
      .withSuccessHandler(function(res) {
        btn.disabled = false;
        closeModal("modalWarga");
        alert(res.message);
        loadData();
      })
      .withFailureHandler(function(err) {
        btn.disabled = false;
        alert("Error: " + err.message);
      })
      .simpanWarga(data, state.user.username);
  }

  function hapusWargaAction(id) {
    if (confirm("Apakah Anda yakin ingin menghapus data warga ini?")) {
      google.script.run
        .withSuccessHandler(function(res) {
          alert(res.message);
          loadData();
        })
        .hapusWarga(id, state.user.username);
    }
  }

  // KELOLA ANGGARAN
  function openModalAnggaran() {
    document.getElementById("anggaranId").value = "";
    document.getElementById("anggaranNama").value = "";
    document.getElementById("anggaranTarget").value = "";
    document.getElementById("anggaranRealisasi").value = "0";
    document.getElementById("anggaranKeterangan").value = "";
    document.getElementById("anggaranStatus").value = "Direncanakan";
    document.getElementById("modalAnggaranTitle").innerText = "Tambah Program Kerja";
    openModal("modalAnggaran");
  }

  function editAnggaran(a) {
    document.getElementById("anggaranId").value = a.id_program;
    document.getElementById("anggaranNama").value = a.nama_kegiatan;
    document.getElementById("anggaranTarget").value = a.target_anggaran;
    document.getElementById("anggaranRealisasi").value = a.realisasi_anggaran;
    document.getElementById("anggaranKeterangan").value = a.keterangan;
    document.getElementById("anggaranStatus").value = a.status_program;
    document.getElementById("modalAnggaranTitle").innerText = "Edit Program Kerja";
    openModal("modalAnggaran");
  }

  function submitSimpanAnggaran(e) {
    e.preventDefault();
    const btn = document.getElementById("btnSubmitAnggaran");
    btn.disabled = true;

    const data = {
      id_program: document.getElementById("anggaranId").value,
      tahun: state.tahun,
      nama_kegiatan: document.getElementById("anggaranNama").value,
      target_anggaran: document.getElementById("anggaranTarget").value,
      realisasi_anggaran: document.getElementById("anggaranRealisasi").value,
      status_program: document.getElementById("anggaranStatus").value,
      keterangan: document.getElementById("anggaranKeterangan").value
    };

    google.script.run
      .withSuccessHandler(function(res) {
        btn.disabled = false;
        closeModal("modalAnggaran");
        alert(res.message);
        loadData();
      })
      .withFailureHandler(function(err) {
        btn.disabled = false;
        alert("Error: " + err.message);
      })
      .simpanAnggaran(data, state.user.username);
  }

  function hapusAnggaranAction(id) {
    if (confirm("Hapus mata anggaran ini?")) {
      google.script.run
        .withSuccessHandler(function(res) {
          alert(res.message);
          loadData();
        })
        .hapusAnggaran(id, state.user.username);
    }
  }

  // KEAMANAN & ADMIN
  function openModalGantiPass() { openModal("modalGantiPass"); }
  function submitGantiPass(e) {
    e.preventDefault();
    const pLama = document.getElementById("passLama").value;
    const pBaru = document.getElementById("passBaru").value;
    google.script.run
      .withSuccessHandler(function(res) {
        alert(res.message);
        if (res.success) closeModal("modalGantiPass");
      })
      .changePassword(state.user.username, pLama, pBaru);
  }

  function openModalTambahAdmin() { openModal("modalTambahAdmin"); }
  function submitTambahAdmin(e) {
    e.preventDefault();
    const nama = document.getElementById("adminNamaLengkap").value;
    const u = document.getElementById("adminNewUsername").value;
    const p = document.getElementById("adminNewPassword").value;
    google.script.run
      .withSuccessHandler(function(res) {
        alert(res.message);
        if (res.success) closeModal("modalTambahAdmin");
      })
      .tambahAdmin(state.user.username, u, p, nama, "Admin");
  }

  // -------------------------------------------------------------
  // SHARE WHATSAPP & EXPORT PDF
  // -------------------------------------------------------------
  function shareWhatsApp() {
    const data = state.dashboardData;
    if (!data) {
      alert("Data kas belum siap.");
      return;
    }

    const tgl = new Date().toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' });
    let text = `*LAPORAN TRANSPARANSI KAS RT.001 RW.001*\n`;
    text += `*Dk. Gajah, Desa Surorejan, Puring, Kebumen*\n`;
    text += `_Per Tanggal: ${tgl}_\n\n`;
    text += `📊 *RINGKASAN KAS:*\n`;
    text += `• Total Pemasukan: ${formatRupiah(data.ringkasan.totalMasuk)}\n`;
    text += `• Total Pengeluaran: ${formatRupiah(data.ringkasan.totalKeluar)}\n`;
    text += `------------------------------------\n`;
    text += `💰 *SALDO KAS SAAT INI: ${formatRupiah(data.ringkasan.saldoKas)}*\n\n`;
    text += `👥 *Status Warga:* ${data.ringkasan.totalWarga} Kepala Keluarga\n`;
    text += `📌 _Iuran bulanan: Rp 10.000 / KK per bulan._\n\n`;
    text += `Laporan lengkap dapat diakses secara transparan melalui aplikasi Kas RT. Terima kasih atas partisipasi seluruh warga.`;

    const url = "https://api.whatsapp.com/send?text=" + encodeURIComponent(text);
    window.open(url, "_blank");
  }

  function openModalExportPdf() { openModal("modalExportPdf"); }
  
  function prosesUnduhPdf(tipe) {
    closeModal("modalExportPdf");
    const loader = alert("Sedang menyusun dan mengonversi dokumen PDF, silakan tunggu beberapa detik...");

    google.script.run
      .withSuccessHandler(function(res) {
        // Konversi Base64 ke Blob & Trigger Download Langsung di Browser
        const byteCharacters = atob(res.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const link = document.createElement("a");
        link.href = window.URL.createObjectURL(blob);
        link.download = res.filename;
        link.click();
      })
      .withFailureHandler(function(err) {
        alert("Gagal mengunduh PDF: " + err.message);
      })
      .exportPdfLaporan(tipe, state.tahun);
  }