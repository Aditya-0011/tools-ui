# Tools UI

Personal tools for the platform: Folio for markdown notes and Stencil for templated text.

[![React Version](https://img.shields.io/badge/React-19.3-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-Build-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4.3-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)

## Overview

The tools UI talks to the `tools` gRPC backend through the API gateway. Sign-in happens on the Console, and each tool is shown only to users who have its permission (`tools.folio`, `tools.stencil`). Admins see every tool.

## Architecture

- **Framework**: React 19 with the React Compiler, built with Vite
- **Package manager**: `bun`
- **Styling**: Tailwind CSS v4 with `shadcn` tooling on `@base-ui/react` primitives, dark only, violet accent
- **State**: `@tanstack/react-query` and `@tanstack/react-form`
- **Routing**: React Router v8 data router (needed for the unsaved-changes guard)

## Features

- **Folio**: markdown notes in virtual folders built from note paths, client-side title search, markdown viewer with GFM and code highlighting (loaded on demand), create, rename, move, delete, and folder move or delete.
- **Caching**: the note list loads once per visit. Note bodies are cached by note and version in IndexedDB and are never refetched while the version is unchanged. IndexedDB is cleared on logout, on logout in another tab, and when a different user signs in.
- **Editing**: an exclusive edit lock per note, renewed every 60 seconds while editing, with take-over from a stale session. Saving happens only on Save or Ctrl/Cmd+S. Unsaved text is mirrored to a local draft for crash recovery and offered back on reopen.
- **Import and export**: `.md` export per note and multi-file `.md` import into the current folder, paced to respect rate limits.
- **Stencil**: renders delimited data through a text pattern in the browser, with saved patterns.

## Platform routing

- `/folio`: browse, read and edit notes (`?folder=` and `?note=` deep-link the selection)
- `/stencil`: render data through a pattern

## Getting started

### Prerequisites

- [Bun](https://bun.sh/) to manage dependencies and run scripts

### Configuration

Export these variables directly in your shell environment (see `.env.sample`):

| Variable             | Description                              | Required |
| :------------------- | :--------------------------------------- | :------: |
| `VITE_AUTH_API_URL`  | Endpoint for the public auth API routes  | **Yes**  |
| `VITE_TOOLS_API_URL` | Endpoint for the public tools API routes | **Yes**  |
| `VITE_CONSOLE_URL`   | Base URL of the deployed console UI      | **Yes**  |

### Running locally

```bash
bun install
bun run dev
```

### Build for production

```bash
bun run build
```
