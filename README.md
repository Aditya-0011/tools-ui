# Tools UI

The personal tools dashboard for the platform: Folio for markdown notes and Stencil for templated text.

[![React Version](https://img.shields.io/badge/React-19.3-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-Build-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4.3-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)

## Overview

The tools UI interacts with the `tools` gRPC backend via the API gateway. Sign-in happens on the Console, and each tool is shown only to users who have its permission (`tools.folio`, `tools.stencil`). Admins see every tool.

## Architecture

This section explains the technologies and physical layout of the tools UI.

- **Framework**: Built with React 19 and compiled using Vite for hot-module replacement
- **Package manager**: Managed and executed using `bun`
- **Styling**: Styled with Tailwind CSS v4, utilizing `shadcn` tooling and `@base-ui/react` primitives, with a violet accent
- **State**: Uses `@tanstack/react-query` for asynchronous state management and `@tanstack/react-form` for form handling
- **Routing**: Client-side navigation handled by the React Router v8 data router (needed for the unsaved-changes guard)
- **Workers**: Stencil renders in a Web Worker so large inputs never block the page

### Project structure

- `public/`: Static assets
- `src/`: React component source code
- `tests/`: `bun test` suites for the Stencil engine and shared helpers
- `index.html`: Application entrypoint template
- `package.json`: Dependencies and scripts
- `vite.config.ts`: Vite configuration

## Features

This section outlines the capabilities of the tools UI.

- **Performance**: Bootstrapped with Vite and React 19 Compiler plugins for rendering performance; the markdown viewer and code highlighting load on demand.
- **Design**: Built using `@base-ui/react` and Tailwind CSS, with a dark-only theme and flat, full-height panes.
- **Folio**: Markdown notes in virtual folders built from note paths, client-side title search, a GFM viewer with code highlighting, and create, rename, move and delete for notes and folders.
- **Caching**: The note list loads once per visit. Note bodies are cached by note and version in IndexedDB and are never refetched while the version is unchanged. IndexedDB is cleared on logout, on logout in another tab, and when a different user signs in.
- **Editing**: An exclusive edit lock per note, renewed every 60 seconds while editing, with take-over from a stale session. Saving happens only on Save or Ctrl/Cmd+S. Unsaved text is mirrored to a local draft for crash recovery and offered back on reopen.
- **Import and export**: `.md` export per note and multi-file `.md` import into the current folder, paced to respect rate limits.
- **Stencil**: Renders delimited data through a text pattern entirely in the browser, with saved patterns and a cheat sheet. Pasted data is never sent to the server.

## Platform routing

The tools dashboard is structured around its tools:

- `/folio`: Browse, read and edit notes (`?folder=` and `?note=` deep-link the selection)
- `/stencil`: Render data through a pattern and manage saved patterns

## Getting started

This section explains how to run the tools UI locally.

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

Install dependencies and start the development server:

```bash
bun install
bun run dev
```

### Tests

Run the unit tests:

```bash
bun test
```

### Build for production

Compile the application into static HTML, CSS, and JS assets for deployment:

```bash
bun run build
```
