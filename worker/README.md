# RTNAN API Gateway

Folder ini berisi Cloudflare Worker yang menjadi API gateway antara GitHub Pages dan Google Apps Script.

## Arsitektur

GitHub Pages -> Cloudflare Worker -> Google Apps Script -> Google Sheets

Worker hanya menerima POST dari origin:

https://klungdingbrag.github.io

Endpoint GAS tidak diekspos ke browser setelah frontend dipindahkan menggunakan gateway.

## Deploy

1. Buat/login akun Cloudflare.
2. Buka Workers & Pages.
3. Buat Worker baru bernama `rtnan-api`.
4. Masukkan isi `worker/index.js` sebagai Worker code, atau deploy folder ini menggunakan Wrangler.
5. Setelah deploy, Cloudflare akan memberikan URL seperti:
   `https://rtnan-api.<subdomain>.workers.dev`
6. Endpoint frontend yang dipakai adalah:
   `https://rtnan-api.<subdomain>.workers.dev/api`

Catatan: kode saat ini belum memakai secret untuk URL GAS karena URL Web App GAS memang merupakan endpoint deployment. Untuk keamanan tambahan, URL GAS dapat dipindahkan ke Worker secret pada tahap berikutnya.

## Penting

Jangan mengaktifkan worker sebagai open proxy. Kode ini sengaja mengunci Origin ke:

https://klungdingbrag.github.io

dan hanya menerima POST.

Setelah URL Worker diketahui, update `js/app.js` agar `GAS_API_URL` menunjuk ke URL Worker tersebut.
