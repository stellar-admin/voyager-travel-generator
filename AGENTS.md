# Voyager Travel generator

This repository generates the Voyager Travel app; read `README.md` first. The generated app (by default `../voyager-travel-sample`) is a separate repository with its own history.

- The generated app must stay a plain ASP.NET Core MVC app with Identity, EF Core on SQLite and seed data. Do not add admin screens, UI libraries or references to any particular admin framework, here or in the generated app.
- Prefer the .NET CLI in `generate.sh`; use the overlay only for files the CLI cannot produce.
- Seed data must be deterministic: draw all randomness from the seeder's fixed-seed Bogus fakers and anchor dates on the seeding day.
- Keep `Catalog.cs` the single source for destinations and trips; `tools/images/photos.mjs` parses it.
- Only bundle CC0 or public-domain photos, converted to WebP by `photos.mjs`.
- `./generate.sh --force` deletes the target. Never run it against a target that may contain someone's work without asking.
