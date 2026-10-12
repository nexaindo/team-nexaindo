# NEXAINDO WiFi Operations

Aplikasi PWA berbahasa Indonesia untuk administrasi pelanggan internet. Tampilan responsif dark navy/cyan, login administrator, pelanggan, paket, status koneksi, tagihan bulanan, catatan pembayaran, dan ringkasan omzet.

## Isi proyek

- `index.html` — halaman aplikasi dan dialog.
- `styles.css` — tampilan responsif.
- `app.js` — logika aplikasi dan koneksi Supabase.
- `config.js` — konfigurasi publik Supabase (wajib diisi).
- `supabase-schema.sql` — tabel, fungsi pemeriksaan admin, dan kebijakan RLS.
- `manifest.webmanifest`, `sw.js`, `assets/icon.svg` — dukungan PWA.

## 1. Buat backend/database gratis di Supabase

1. Buat akun dan proyek di https://supabase.com.
2. Buka **SQL Editor** pada proyek tersebut.
3. Salin seluruh isi `supabase-schema.sql`, lalu jalankan.
4. Buka **Authentication → Users → Add user**. Buat akun administrator dengan email dan password kuat. Matikan public sign-ups di Authentication settings jika tersedia/aktif.
5. Salin UUID akun admin yang baru dibuat.
6. Di SQL Editor jalankan perintah ini, dengan UUID asli:
   ```sql
   insert into public.admin_users (user_id, role)
   values ('UUID-USER-ADMIN-DI-SINI', 'admin')
   on conflict (user_id) do nothing;
   ```
7. Buka **Project Settings → API** (atau bagian Connect/API Keys pada dashboard baru). Salin Project URL dan publishable key. Untuk proyek lama, anon key juga bisa digunakan. Jangan gunakan `service_role` atau secret key di browser.

## 2. Hubungkan aplikasi ke Supabase

Buka `config.js`, ganti nilai placeholder:

```js
window.NEXAINDO_CONFIG = {
  SUPABASE_URL: "https://PROJECT-ANDA.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_..." 
};
```

Gunakan URL dan publishable/anon key milik proyek Anda. Key ini memang digunakan di browser; keamanan data bergantung pada login dan kebijakan Row Level Security (RLS) di SQL yang disediakan. Jangan pernah menaruh service role key di sini.

## 3. Hosting gratis dengan Cloudflare Pages

Cloudflare Pages cocok untuk situs HTML statis dan dapat terhubung ke GitHub untuk deploy otomatis.

1. Buat akun GitHub: https://github.com.
2. Buat repository baru bernama `nexaindo-wifi-operations`.
3. Upload semua isi folder ini ke root repository (pastikan `index.html` berada di root).
4. Buat akun Cloudflare: https://dash.cloudflare.com.
5. Masuk **Workers & Pages → Create → Pages → Connect to Git**.
6. Hubungkan GitHub dan pilih repository `nexaindo-wifi-operations`.
7. Pengaturan build:
   - Production branch: `main`
   - Framework preset: `None`
   - Build command: kosong atau `exit 0`
   - Build output directory: `/` atau `.` sesuai pilihan dashboard
8. Klik deploy. Cloudflare akan memberi URL seperti `https://nama-proyek.pages.dev`.

Dokumentasi: https://developers.cloudflare.com/pages/framework-guides/deploy-anything/ dan https://developers.cloudflare.com/pages/configuration/git-integration/

Alternatif: GitHub Pages juga dapat menyajikan situs statis, tetapi Cloudflare Pages lebih praktis untuk deployment dari GitHub. Database tetap disediakan oleh Supabase, bukan oleh layanan hosting statis.

## 4. Pasang di Android sebagai PWA

1. Buka URL `https://...pages.dev` yang diberikan Cloudflare menggunakan Chrome Android.
2. Buka menu ⋮ Chrome.
3. Pilih **Install app** atau **Tambahkan ke layar utama**.
4. Buka ikon NEXAINDO di layar utama dan login memakai akun admin.

Service worker menyimpan kerangka aplikasi untuk membantu pemuatan ulang, tetapi data pelanggan memerlukan koneksi internet dan tidak disimpan offline.

## Fitur saat ini

- Login email/password melalui Supabase Auth.
- Dashboard jumlah pelanggan aktif/offline, total tagihan bulan ini, pembayaran bulan ini, dan grafik 6 bulan.
- Tambah, edit, cari, dan hapus pelanggan.
- Tambah, edit, dan hapus paket internet.
- Buat tagihan untuk pelanggan yang belum memiliki tagihan pada bulan berjalan.
- Catat pembayaran; tagihan ditandai lunas ketika pembayaran tunggal sama dengan atau lebih besar dari tagihan.
- Data online lintas perangkat dengan autentikasi dan RLS.

## Batasan dan hal yang perlu diketahui

- Status Aktif/Offline pada versi ini **diubah manual oleh admin**; belum membaca status router/OLT/PPPoE secara langsung.
- Pembayaran sebagian dicatat, tetapi status tagihan otomatis menjadi lunas hanya jika satu transaksi pembayaran mencapai nilai tagihan. Untuk mendukung cicilan/akumulasi pembayaran, logika perlu ditingkatkan.
- Pengingat WhatsApp otomatis, integrasi payment gateway, laporan PDF, pembagian per admin, dan audit log belum termasuk.
- Selalu uji dulu dengan data contoh sebelum memasukkan data pelanggan sungguhan.
- RLS melindungi tabel dari pengguna yang tidak terdaftar sebagai admin. Jangan pernah menonaktifkan RLS atau memasukkan secret/service-role key ke frontend.
- Backup dan kuota gratis tergantung kebijakan masing-masing layanan. Periksa batas dan kebijakan terbaru dari penyedia.

## Jika muncul error

- `Invalid API key`: periksa URL dan publishable/anon key di `config.js`.
- `new row violates row-level security policy`: pastikan UUID user admin telah dimasukkan ke `public.admin_users`.
- Tabel tidak ditemukan: jalankan ulang SQL schema di proyek Supabase yang benar.
- Setelah mengubah file, tunggu deploy selesai lalu refresh situs. Jika PWA masih memakai versi lama, tutup aplikasi lalu buka lagi; service worker cache dapat perlu diperbarui.
