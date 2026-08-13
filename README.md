# DailyHabits

A responsive habit tracking and analytics application built with semantic HTML, modern CSS, vanilla JavaScript modules, Firebase Authentication, and Cloud Firestore.

## Run locally

The Firebase-ready website is entirely inside `public/`:

```powershell
npx -y firebase-tools@latest serve
```

Open the local URL printed by the CLI. You can create an account or use **Try interactive demo** without signing in.

## Firebase project

- Project: `habit-tracker-010`
- Web app: `1:875350993556:web:b4400a6e9c94227bb26281`
- Firestore: Standard edition, Native mode, `nam5` multi-region
- Authentication: email/password
- Hosting source: `public/`

The Firebase web configuration is safe to include in frontend code because authorization is enforced by Firebase Authentication and Firestore Security Rules. Never commit Admin SDK credentials, service-account JSON, private keys, or passwords.

## Features

- Secure account creation, login, logout, and password reset
- Protected authenticated dashboard
- User-scoped Firestore storage for habits, completion dates, notes, profile, and preferences
- Habit create, edit, archive, restore, delete, and daily completion
- Current/best streak calculations based on completion dates
- Monthly calendar and weekly/monthly analytics
- Searchable notes
- Responsive desktop/mobile interface
- Light, dark, and system themes
- Separate local demo mode with realistic sample data
- Accessible dialogs, confirmations, toasts, empty states, and focus handling

## Security rules

`firestore.rules` applies default-deny access, checks the authenticated path owner, validates every writable schema, limits all string sizes, protects immutable timestamps, and prevents users from accessing another UID's data.

Validate before deployment:

```powershell
npx -y firebase-tools@latest deploy --only firestore:rules --project habit-tracker-010 --dry-run
```

Deploy when ready:

```powershell
npx -y firebase-tools@latest deploy --project habit-tracker-010
```
