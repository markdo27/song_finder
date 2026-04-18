# 🎵 Song Finder

> ML-powered music similarity search with deep audio analysis — BPM, key, chords, structure, instruments, and more.

![Song Finder](https://img.shields.io/badge/built%20with-React%20%2B%20FastAPI-7c3aed?style=flat-square)
![cosine.club](https://img.shields.io/badge/powered%20by-cosine.club-06b6d4?style=flat-square)

## What It Does

- 🔍 **Paste any URL** — YouTube, SoundCloud, Bandcamp, or Spotify
- 💿 **Similarity scores** — animated rings showing how close each match is (e.g. `87%`)
- ⚡ **Deep analysis** — BPM, musical key, chord progressions, song structure, instruments, energy
- ▶ **Built-in player** — YouTube embeds with animated waveform visualizer
- 📋 **Playlist builder** — save and manage digs via cosine.club API

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Vite + React (JSX) |
| Styling | Vanilla CSS (dark glassmorphism) |
| Backend | FastAPI (Python) |
| Audio Analysis | [bpm-detector](https://github.com/libraz/bpm-detector) |
| Similarity API | [cosine.club](https://cosine.club) |

## Setup

### 1. Install Python backend dependencies

```bash
cd backend
pip install -r requirements.txt
pip install "git+https://github.com/libraz/bpm-detector.git"
```

### 2. Install frontend dependencies

```bash
cd frontend
npm install
```

### 3. Configure

- Get a free API key from [cosine.club/account/api](https://cosine.club/account/api)
- Open the app → click ⚙ Settings → paste your API key

### 4. Run (both services with one command)

```bash
cd frontend
npm run dev
```

This starts:
- **Frontend** → `http://localhost:5173`
- **Backend (analyzer)** → `http://localhost:8000`

## Usage

1. Paste a YouTube / SoundCloud / Bandcamp URL — or type `Artist - Track`
2. Hit **Find Similar** → similarity-ranked results appear with `%` scores
3. Click **⚡ Analyze** on any card → BPM, key, chords, structure slide in
4. Click **▶ Play** to listen inline
5. Click **+ Save** to add to your cosine.club playlist

## Architecture

```
Frontend (React/Vite)
  ├── cosine.club API     → similarity search, playlists
  └── FastAPI Backend     → bpm-detector audio analysis
       └── yt-dlp        → audio download from URLs
```

## License

MIT
