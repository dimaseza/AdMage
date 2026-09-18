# 📋 PRD — AdMage

> **Platform:** AI-powered content creation untuk affiliate, brand, dan agency
> **Author:** Scalar Studio
> **Status:** Draft v1.0
> **Tanggal:** September 2026

---

## 1. 🎯 Ringkasan Produk

Platform berbasis AI yang memungkinkan affiliate, brand, dan agency untuk membuat konten pemasaran (gambar & video) secara otomatis — mulai dari product refinement, product shot, campaign image, hingga UGC-style video — dalam satu dashboard.

### Masalah yang Diselesaikan
- Konten visual berkualitas mahal dan lambat diproduksi
- Affiliator kesulitan bikin variasi konten untuk banyak produk
- Brand butuh konsistensi visual campaign tanpa biaya produksi tinggi
- Agency butuh scaling konten tanpa nambah headcount

---

## 2. 👥 Target User

| Persona | Kebutuhan | Pain Point |
|---------|-----------|------------|
| **Affiliator** | Bikin konten produk cepat & variatif | Ga punya tim kreatif, modal terbatas |
| **Brand** | Konten campaign konsisten | Biaya produksi mahal, slow turnaround |
| **Agency** | Scale konten banyak klien | Headcount terbatas, repetitif |

---

## 3. ⚙️ Alur User (User Flow)

```
1. Register & Login
2. Buat Project (per brand/produk)
   ├── Upload foto produk (dari HP/kamera)
   ├── Atur brand guidelines (warna, tone)
   └── Tentukan platform target (TikTok, IG, Shopee, dll)
3. Generate Konten
   ├── Refine Image (Grok Imagine) — bikin foto produk jadi pro
   ├── Product Shot (Soul V2) — generate produk dengan model/background
   ├── Campaign Image (Marketing Studio) — iklan siap pakai
   └── Video Ads (Kling 3.0) — video promosi dari image/reference
4. Kelola & Download
   ├── Riwayat generate
   ├── Download batch
   └── (V2) Schedule posting
```

---

## 4. 📦 Feature Set

### V1 — MVP

| Fitur | AI Engine | Credit |
|-------|-----------|--------|
| **Refine Image** — refine foto produk jadi berkualitas studio | Grok Imagine 2.0 | 1 credit |
| **Text-to-Image** — generate produk dari teks + reference | Soul V2 Standard | 1 credit |
| **Campaign Image** — generate iklan dengan preset campaign | Marketing Studio Image | 2 credits |
| **Video Ads** — generate video promosi dari image/reference | Kling 3.0 Standard | 20 credits (5s) / 30 credits (10s) |
| **Project Management** — buat, edit, hapus project per brand | - | - |
| **Gallery** — riwayat & koleksi generate | - | - |

### V2 — Advanced

| Fitur | AI Engine | Credit |
|-------|-----------|--------|
| **UGC Creator** — bikin konten gaya user-generated content | Kling 3.0 + prompt engine | 15 credits |
| **Batch Generate** — generate banyak varian sekaligus | Multi-queue | 2× credit per variant |
| **Custom LoRA** — train model untuk 1 produk spesifik | FAL AI (FLUX LoRA Fast) | 150 credits (one-time) |
| **Scheduled Posting** — integrasi API ecommerce & sosmed | Shopee / Tokopedia / IG / TikTok | - |

### V3 — Scale

| Fitur | Keterangan |
|-------|------------|
| Team dashboard | Multi-user per akun |
| Brand kit | Simpan guidelines reusable |
| API publik | White-label untuk agency |
| Analytics | Report performa konten |

---

## 5. 🤖 AI Engine Stack

### Higgsfield API (Primary)

| Model | Fungsi | Harga (est.) |
|-------|--------|-------------|
| **Grok Imagine 2.0** | Image refine & transform | ~$0.003/image |
| **Soul V2 Standard** | Text-to-image generation | ~$0.004/image |
| **Marketing Studio Image** | Campaign image with presets | ~$0.006/image |
| **Kling 3.0 Standard** | Text/video generation | ~$0.10/5s video |

### FAL AI (V2 — Custom LoRA)

| Fitur | Harga |
|-------|-------|
| **FLUX LoRA Fast Training** | $2.00 flat per training |
| **FLUX.2 [dev] Trainer V2** | $6.40 per 1.000 steps |

---

## 6. 💰 Monetisasi & Pricing

### Credit System

> 1 credit = Rp 250 (fixed value across tiers)

| Aksi | Credit | Jual (Rp) | Cost API (Rp) | Profit |
|------|:------:|:---------:|:-------------:|:------:|
| Grok Imagine (refine) | 1 | 250 | 50 | **200** |
| Soul V2 (TTI) | 1 | 250 | 66 | **184** |
| Marketing Studio | 2 | 500 | 100 | **400** |
| Kling 5s video | 20 | 5.000 | 1.650 | **3.350** |
| Kling 10s video | 30 | 7.500 | 2.475 | **5.025** |
| Custom LoRA (V2) | 150 | 37.500 | 33.000 | **4.500** |

### Tier Subscription

| Tier | Harga | Credits | Bonus | Nilai/Credit |
|------|-------|---------|-------|:-----------:|
| 🥉 **Starter** | **Rp 50.000** | 200 | - | Rp 250 |
| 🥈 **Pro** | **Rp 100.000** | 500 | - | Rp 200 |
| 🥇 **Business** | **Rp 200.000** | 1.000 | + 1x Custom LoRA | Rp 167 |
| 🏆 **Enterprise** | **Rp 500.000** | 2.500 | + 3x Custom LoRA | Rp 200 |

### Profit Margin per Tier

| Tier | Revenue | HPP (mix) | Profit | Margin |
|------|:-------:|:---------:|:------:|:-----:|
| **Starter** | Rp 50.000 | ~Rp 9.350 | **Rp 40.650** | **81%** |
| **Pro** | Rp 100.000 | ~Rp 20.800 | **Rp 79.200** | **79%** |
| **Business** | Rp 200.000 | ~Rp 55.800 | **Rp 144.200** | **72%** |
| **Enterprise** | Rp 500.000 | ~Rp 215.000 | **Rp 285.000** | **57%** |

> ⚠️ Skenario terburuk (heavy video): semua tier masih untung minimal **41%**

### Top-Up Credits

- Tambahan credit bisa dibeli kapan saja
- Minimum top-up: 100 credits (Rp 25.000)
- Berlaku selamanya (tidak hangus)

---

## 7. 🛠️ Tech Stack

| Layer | Pilihan |
|-------|---------|
| **Frontend** | Next.js (React) |
| **Backend** | Next.js API Routes / Node.js Express |
| **AI API** | Higgsfield API (primary) + FAL AI (LoRA training) |
| **Storage** | Cloudflare R2 (murah, egress gratis) |
| **Database** | PostgreSQL (Supabase / Neon) |
| **Auth** | NextAuth.js / Clerk |
| **Queue** | BullMQ (antrean generate) |
| **Deploy** | Vercel (frontend) + Railway/Render (backend) |

---

## 8. 🗓️ Roadmap

| Fase | Timeline | Fitur |
|------|----------|-------|
| **V1 MVP** | Q4 2026 | Refine, TTI, Campaign, Video, Auth, Gallery, Subscription |
| **V2 Growth** | Q1 2027 | UGC Creator, Batch Generate, Custom LoRA, Scheduled Post |
| **V3 Scale** | Q2 2027 | Team dashboard, Brand kit, API publik, Analytics |

---

## 9. 🎨 Brand Identity

> **Nama:** AdMage (Scalar Studio)
> **Target tone:** Profesional, modern, trustable

---

## 10. 📊 Metrik Sukses (KPI)

| Metrik | Target V1 | Target V2 |
|--------|-----------|-----------|
| Registered users | 500 | 5.000 |
| Active subscribers | 100 | 1.000 |
| Total generates | 10.000/bulan | 100.000/bulan |
| Revenue | Rp 15jt/bulan | Rp 150jt/bulan |
| Churn rate | <10% | <5% |

---

## 11. ⚠️ Risiko & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| API cost naik | Lock pricing kontrak dengan Higgsfield, pasang margin buffer |
| Model AI ketinggalan | Pantau update model, ganti provider kalo perlu |
| User boncos (heavy video) | Video udah dipress credit-nya, semua tier masih untung |
| Competitor murah | Fokus di UGC & user experience, bukan harga |