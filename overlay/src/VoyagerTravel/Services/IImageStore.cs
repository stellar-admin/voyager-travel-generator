namespace VoyagerTravel.Services;

/// <summary>
/// Stores uploaded images and returns the URL to save with the record that uses them.
/// </summary>
public interface IImageStore
{
    /// <summary>
    /// Saves an uploaded image under a new unique name in a folder such as "destinations".
    /// </summary>
    /// <returns>The image's URL, for example /uploads/destinations/3f2c….webp.</returns>
    Task<string> SaveAsync(IFormFile file, string folder, CancellationToken cancellationToken = default);
}
