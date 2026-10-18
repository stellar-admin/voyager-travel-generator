# Voyager Travel

The back-office application for Voyager Travel, a fictitious small-group tour operator. It is an ASP.NET Core MVC app with ASP.NET Core Identity and Entity Framework Core on SQLite.

## Run

```bash
dotnet run --project src/VoyagerTravel
```

On the first run in Development, the app applies the migrations and seeds `src/VoyagerTravel/app.db`. Delete `app.db` to start again with fresh data, and `src/VoyagerTravel/uploads` to remove uploaded images. Seeded dates are relative to the day the database is created.

`dotnet ef database update --project src/VoyagerTravel` also creates and seeds the database. Restore the local `dotnet-ef` tool with `dotnet tool restore` first.

## Accounts

Every seeded account uses the password `Voyager-2026!`.

| Email | Role |
| --- | --- |
| admin@voyager.travel | Admin |
| priya@voyager.travel, tomas@voyager.travel, hannah@voyager.travel, kenji@voyager.travel, chloe@voyager.travel, liam@voyager.travel | Agent |
| viewer@voyager.travel | Viewer |

## Data model

The model lives in `src/VoyagerTravel/Models` and the `ApplicationDbContext` in `src/VoyagerTravel/Data`.

- **Catalogue:** countries, destinations (regions contain cities), trips, trip tags, itinerary days.
- **Operations:** departures, guides and their languages, room allocations.
- **Customers:** travellers, bookings, booking passengers, booking add-ons, payments, reviews.
- **Suppliers:** suppliers, accommodations and amenities, activities, supplier invoices.
- **Staff:** Identity users (`ApplicationUser`) in the Admin, Agent and Viewer roles. Bookings can be assigned to an agent.

Images are in `src/VoyagerTravel/wwwroot/images`; see `CREDITS.md` there for photo sources and licences.

## Uploaded images

Save uploaded images with `IImageStore` (`src/VoyagerTravel/Services`), which returns the URL to store on the record. The registered `LocalImageStore` stands in for blob storage: it writes to `src/VoyagerTravel/uploads`, which the app serves at `/uploads` and Git ignores. The seeded images in `wwwroot/images` are part of the app and are not uploads.
