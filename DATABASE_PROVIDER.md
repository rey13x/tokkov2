# Database Provider

The application uses Turso by default.

Vercel should have these variables configured:

```text
DATABASE_PROVIDER=turso
TURSO_URL=...
TURSO_AUTH_TOKEN=...
```

Firebase Firestore is only used when explicitly enabled with:

```text
DATABASE_PROVIDER=firebase
```

Firebase Messaging remains available for native push notifications regardless of the database provider.