using System.Text.RegularExpressions;

namespace VoyagerTravel.Services;

/// <summary>
/// Stores images in the uploads folder next to the app, standing in for blob storage. The folder is
/// served at /uploads and ignored by Git; delete it together with app.db to start over.
/// </summary>
public partial class LocalImageStore(IWebHostEnvironment environment) : IImageStore
{
    public const string FolderName = "uploads";
    public const string RequestPath = "/uploads";

    public static string GetRoot(IWebHostEnvironment environment) =>
        Path.Combine(environment.ContentRootPath, FolderName);

    public async Task<string> SaveAsync(IFormFile file, string folder, CancellationToken cancellationToken = default)
    {
        if (!FolderPattern().IsMatch(folder))
        {
            throw new ArgumentException("Use lowercase letters, digits and dashes, such as \"destinations\".", nameof(folder));
        }

        var directory = Path.Combine(GetRoot(environment), folder);
        Directory.CreateDirectory(directory);

        var name = $"{Guid.NewGuid():N}{Path.GetExtension(file.FileName).ToLowerInvariant()}";
        await using (var stream = File.Create(Path.Combine(directory, name)))
        {
            await file.CopyToAsync(stream, cancellationToken);
        }

        return $"{RequestPath}/{folder}/{name}";
    }

    [GeneratedRegex("^[a-z0-9-]+$")]
    private static partial Regex FolderPattern();
}
