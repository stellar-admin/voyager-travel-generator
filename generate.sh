#!/usr/bin/env bash
# Builds a fresh Voyager Travel app: the stock ASP.NET Core MVC template with Identity on SQLite,
# plus the domain model, a seeded database and bundled images.
#
#   ./generate.sh [target] [--force]
#
# The target defaults to ../voyager-travel. An existing target is only replaced with --force.
set -euo pipefail

seed_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
target="$seed_dir/../voyager-travel"
force=false

for arg in "$@"; do
  case "$arg" in
    --force) force=true ;;
    -*) echo "Unknown option: $arg" >&2; exit 1 ;;
    *) target="$arg" ;;
  esac
done

target="$(realpath -m "$target")"
sdk_version="10.0.400"
project="VoyagerTravel"
app="$target/src/$project"

if [[ "$target" == "$seed_dir" || "$target" == "$seed_dir"/* ]]; then
  echo "The target must be outside $seed_dir." >&2
  exit 1
fi

if [[ -e "$target" ]]; then
  if [[ "$force" != true ]]; then
    echo "$target already exists. Pass --force to delete and recreate it." >&2
    exit 1
  fi

  echo "Deleting $target"
  rm -rf "$target"
fi

mkdir -p "$target"
cd "$target"

echo "Creating the solution"
dotnet new globaljson --sdk-version "$sdk_version" --roll-forward latestFeature > /dev/null
dotnet new gitignore > /dev/null
dotnet new sln --name "$project" > /dev/null
dotnet new mvc --auth Individual --name "$project" --output "src/$project" > /dev/null
dotnet sln add "src/$project" > /dev/null

ef_version="$(sed -nE 's/.*Include="Microsoft\.EntityFrameworkCore\.Sqlite" Version="([^"]+)".*/\1/p' "$app/$project.csproj")"
dotnet new tool-manifest > /dev/null
dotnet tool install dotnet-ef --version "$ef_version" > /dev/null
dotnet add "src/$project" package Bogus --version 35.6.5 > /dev/null

echo "Adding the domain model, seeding and images"
rm -rf "$app/Data/Migrations" "$app/app.db"
cp -R "$seed_dir/overlay/." "$target/"
cp -R "$seed_dir/assets/images" "$app/wwwroot/images"
perl -i -pe 's/IdentityUser/ApplicationUser/g; $_ .= "\@using VoyagerTravel.Data\r\n" if $. == 1' "$app/Views/Shared/_LoginPartial.cshtml"
printf '\n# SQLite database, created and seeded on first run\n*.db\n*.db-shm\n*.db-wal\n' >> .gitignore

echo "Creating the initial migration"
dotnet ef migrations add InitialCreate --project "src/$project" --output-dir Data/Migrations | grep -iE "error|warn" || true
dotnet build --nologo --verbosity quiet

echo "Committing"
git init --quiet --initial-branch master
git -c core.safecrlf=false add --all
git commit --quiet --message "Create the Voyager Travel app"

echo "Done: $target"
echo "Run it with: dotnet run --project $target/src/$project"
