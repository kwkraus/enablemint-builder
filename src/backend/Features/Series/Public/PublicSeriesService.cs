using EnableFront.Builder.Features.Series.Public.Dtos;
using EnableFront.Builder.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace EnableFront.Builder.Features.Series.Public;

public class PublicSeriesService
{
    private readonly AppDbContext _db;
    private readonly ILogger<PublicSeriesService>? _logger;

    public PublicSeriesService(AppDbContext db, ILogger<PublicSeriesService>? logger = null)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Returns the public projection for <paramref name="id"/>, or <see langword="null"/> when no
    /// series exists for that id <em>or</em> when the series exists but <c>IsPublic == false</c>.
    /// Both cases are intentionally indistinguishable to callers (see FR-008/FR-016/SC-004/SC-005):
    /// the caller (endpoint) must map a null result to the same generic not-found response either
    /// way, so this method never signals which case occurred.
    /// </summary>
    public async Task<PublicSeriesResponseDto?> GetPublicSeriesAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var series = await _db.Series
            .FirstOrDefaultAsync(s => s.SeriesId == id && s.IsPublic, cancellationToken);

        if (series is null)
        {
            _logger?.LogInformation("Public series request for {SeriesId} resolved to not-found", id);
            return null;
        }

        var sessions = await _db.Sessions
            .Where(s => s.SeriesId == id)
            .OrderBy(s => s.StartsAt)
            .Select(s => new PublicSessionDto(
                s.SessionId,
                s.Title,
                s.StartsAt,
                s.EndsAt,
                s.RegistrationUrl,
                s.Description))
            .ToListAsync(cancellationToken);

        _logger?.LogInformation(
            "Public series request for {SeriesId} resolved to a public series with {SessionCount} sessions",
            id, sessions.Count);

        return new PublicSeriesResponseDto(series.Title, series.Details, series.ImageUrl, sessions);
    }
}
